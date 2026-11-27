/* ==========================================================================
   app.js: coordina todo (arranque, pantalla, eventos)
   Flujo general:
     1. Al abrir: leer datos de LocalStorage (o cargar los iniciales).
     2. Dibujar la pantalla a partir de esos datos (render...).
     3. Cuando la persona toca un botón: cambiar los datos -> guardar -> volver a dibujar.
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- Estado y utilidades ---------- */
  let state;                 // todos los datos de la app (ver Medication.defaultState)
  let historyMedId = null;   // medicamento seleccionado en el historial
  let doseCtx = null;        // qué se está haciendo en la ventana de toma: { mode, medId, index }
  let toastTimer = null;
  let lastTodayText = '';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const findMed = id => state.medications.find(m => m.id === id);

  // Los nombres los escribe la persona: se "escapan" antes de insertarlos como HTML.
  const esc = value => String(value).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fmtStamp = date => Medication.formatDate(date, true) + ', ' + Medication.formatTime(date);

  function persist() {
    const ok = MedStorage.save(state);
    if (!ok && MedStorage.isAvailable()) {
      showToast('No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado.');
    }
    return ok;
  }

  /* ---------- Mensajes ---------- */
  function showToast(message, opts = {}) {
    const toast = $('#toast');
    clearTimeout(toastTimer);
    toast.innerHTML = '<span></span>';
    $('span', toast).textContent = message;
    if (opts.actionLabel) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = opts.actionLabel;
      btn.addEventListener('click', () => { hideToast(); opts.onAction(); });
      toast.appendChild(btn);
    }
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    toastTimer = setTimeout(hideToast, opts.actionLabel ? 7000 : 3500);
  }

  function hideToast() {
    const toast = $('#toast');
    toast.classList.remove('is-visible');
    setTimeout(() => { if (!toast.classList.contains('is-visible')) toast.hidden = true; }, 250);
  }

  // Pregunta de confirmación. Devuelve una promesa: true si confirma, false si cancela.
  function askConfirm({ title, message, confirmText = 'Confirmar', danger = false }) {
    return new Promise(resolve => {
      const dlg = $('#confirm-dialog');
      const ok = $('#confirm-ok');
      $('#confirm-title').textContent = title;
      $('#confirm-message').textContent = message;
      ok.textContent = confirmText;
      ok.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
      let result = false;
      const onClose = () => { dlg.removeEventListener('close', onClose); resolve(result); };
      dlg.addEventListener('close', onClose);
      ok.onclick = () => { result = true; dlg.close(); };
      $('#confirm-cancel').onclick = () => dlg.close();
      dlg.showModal();
    });
  }

  function showFormError(el, message) {
    el.textContent = message;
    el.hidden = !message;
  }

  /* ---------- Pantalla de bienvenida ---------- */
  function renderWelcome() {
    const now = new Date();
    $('#welcome-fields').innerHTML = state.medications.map((med, i) => {
      const last = Medication.getLastTaken(med);
      let values = { date: '', time: '' };
      if (last) {
        values = Medication.toInputValues(last);
      } else if (med.suggestedTime) {
        // Hora inicial conocida (ej. 18:00): proponemos su última ocurrencia, la persona confirma la fecha.
        const guess = Medication.mostRecentAt(med.suggestedTime, now);
        if (guess) values = Medication.toInputValues(guess);
      }
      return '<fieldset class="med-fieldset"><legend>' + esc(med.name) + '</legend>' +
        '<p class="hint">' + Medication.formatInterval(med.intervalHours) + '. Última toma:</p>' +
        '<div class="field-row">' +
        '<div class="field"><label for="w-date-' + i + '">Fecha</label>' +
        '<input type="date" id="w-date-' + i + '" value="' + values.date + '"></div>' +
        '<div class="field"><label for="w-time-' + i + '">Hora</label>' +
        '<input type="time" id="w-time-' + i + '" value="' + values.time + '"></div>' +
        '</div></fieldset>';
    }).join('');
  }

  function onWelcomeSubmit(event) {
    event.preventDefault();
    const errorEl = $('#welcome-error');
    const entries = [];
    for (let i = 0; i < state.medications.length; i++) {
      const med = state.medications[i];
      const dateStr = $('#w-date-' + i).value;
      const timeStr = $('#w-time-' + i).value;
      if (!dateStr && !timeStr) continue;                       // sin registro todavía
      const date = Medication.fromInputValues(dateStr, timeStr);
      if (!date) return showFormError(errorEl, 'Completá fecha y hora de ' + med.name + ', o dejá ambos campos vacíos.');
      if (date.getTime() > Date.now() + 60000) return showFormError(errorEl, 'La última toma de ' + med.name + ' no puede ser futura.');
      entries.push({ med, date });
    }
    showFormError(errorEl, '');
    entries.forEach(({ med, date }) => Medication.addDose(med, date));
    state.setupDone = true;
    persist();
    showApp();
  }

  /* ---------- Tarjetas de la pantalla principal ---------- */
  function cardHTML(med) {
    const now = new Date();
    const last = Medication.getLastTaken(med);
    const next = Medication.getNextDose(med);
    const habitual = Medication.formatList(med.schedule);
    const nextBlock = next
      ? '<p class="next-time">' + Medication.formatTime(next) + '</p>' +
        '<p class="next-day">' + esc(Medication.formatDay(next, now)) + ', ' + esc(Medication.formatDate(next)) + '</p>'
      : '<p class="next-time is-empty">--:--</p><p class="next-day">Registrá una toma para calcular el horario</p>';
    const countdown = next
      ? '<p class="countdown-text" role="timer"></p><p class="countdown-sub"></p>'
      : '<p class="countdown-text">Sin registros todavía</p><p class="countdown-sub"></p>';

    return '<article class="card glass' + (next ? '' : ' is-empty') + '" data-med-id="' + esc(med.id) + '" aria-label="' + esc(med.name) + '">' +
      '<header class="card-head"><h2 class="med-name">' + esc(med.name) + '</h2>' +
      '<span class="chip">' + Medication.formatInterval(med.intervalHours) + '</span></header>' +
      '<div class="next"><p class="label">Próxima toma</p>' + nextBlock + '</div>' +
      '<div class="countdown">' + countdown + '</div>' +
      '<div class="progress" role="progressbar" aria-label="Avance del intervalo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="progress-bar"></span></div>' +
      '<dl class="facts">' +
      '<div><dt>Última toma</dt><dd>' + (last ? esc(Medication.formatTime(last)) + ', ' + esc(Medication.formatDay(last, now)) + ' (' + esc(Medication.formatDate(last)) + ')' : 'Sin registro') + '</dd></div>' +
      (habitual ? '<div><dt>Horarios habituales</dt><dd>' + esc(habitual) + '</dd></div>' : '') +
      '</dl>' +
      '<div class="actions">' +
      '<button type="button" class="btn btn-primary" data-action="take-now">Registrar toma ahora</button>' +
      '<div class="actions-row">' +
      '<button type="button" class="btn btn-glass" data-action="take-manual">Registrar otra hora</button>' +
      '<button type="button" class="btn btn-ghost" data-action="edit-last"' + (last ? '' : ' disabled') + '>Editar última toma</button>' +
      '</div></div></article>';
  }

  function renderCards() {
    $('#cards').innerHTML = state.medications.map(cardHTML).join('');
    Timer.tickNow();
  }

  function onCardClick(event) {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const med = findMed(btn.closest('.card').dataset.medId);
    if (!med) return;
    const action = btn.dataset.action;
    if (action === 'take-now') takeNow(med);
    if (action === 'take-manual') openDoseDialog({ mode: 'add', medId: med.id });
    if (action === 'edit-last' && med.history.length) openDoseDialog({ mode: 'edit', medId: med.id, index: med.history.length - 1 });
  }

  // Registra la hora actual del dispositivo solo para ESTE medicamento.
  function takeNow(med) {
    const before = med.history.slice();
    const now = new Date();
    Medication.addDose(med, now);
    persist();
    renderAll();
    showToast(med.name + ' registrado a las ' + Medication.formatTime(now) + '.', {
      actionLabel: 'Deshacer',
      onAction: () => { med.history = before; persist(); renderAll(); }
    });
  }

  /* ---------- Ventana para registrar / editar una toma ---------- */
  function openDoseDialog(ctx) {
    doseCtx = ctx;
    const med = findMed(ctx.medId);
    const isEdit = ctx.mode === 'edit';
    const date = isEdit ? Medication.parseISO(med.history[ctx.index]) : new Date();
    const values = Medication.toInputValues(date);
    $('#dose-title').textContent = isEdit ? 'Editar toma' : 'Registrar otra hora';
    $('#dose-med').textContent = med.name;
    $('#dose-date').value = values.date;
    $('#dose-time').value = values.time;
    $('#dose-delete').hidden = !isEdit;
    showFormError($('#dose-error'), '');
    $('#dose-dialog').showModal();
  }

  async function onDoseSubmit(event) {
    event.preventDefault();
    const med = findMed(doseCtx.medId);
    const errorEl = $('#dose-error');
    const date = Medication.fromInputValues($('#dose-date').value, $('#dose-time').value);
    if (!date) return showFormError(errorEl, 'Completá la fecha y la hora.');
    if (date.getTime() > Date.now() + 60000) return showFormError(errorEl, 'La fecha y la hora no pueden ser futuras.');
    showFormError(errorEl, '');

    if (doseCtx.mode === 'add') {
      const last = Medication.getLastTaken(med);
      if (last && date < last) {
        const ok = await askConfirm({
          title: '¿Agregar una toma anterior?',
          message: 'Esa fecha es anterior a la última toma registrada (' + fmtStamp(last) + '). Se agregará al historial y la próxima toma no cambiará.'
        });
        if (!ok) return;
      }
      Medication.addDose(med, date);
      showToast('Toma de ' + med.name + ' registrada: ' + fmtStamp(date) + '.');
    } else {
      const old = Medication.parseISO(med.history[doseCtx.index]);
      if (old.getTime() !== date.getTime()) {
        const ok = await askConfirm({
          title: '¿Modificar este registro?',
          message: 'La toma de ' + med.name + ' pasará de ' + fmtStamp(old) + ' a ' + fmtStamp(date) + '. Los horarios se recalcularán.'
        });
        if (!ok) return;
        Medication.replaceDose(med, doseCtx.index, date);
        showToast('Registro actualizado.');
      }
    }
    persist();
    $('#dose-dialog').close();
    renderAll();
  }

  async function onDoseDelete() {
    const med = findMed(doseCtx.medId);
    const old = Medication.parseISO(med.history[doseCtx.index]);
    const ok = await askConfirm({
      title: '¿Eliminar este registro?',
      message: 'Se eliminará la toma de ' + med.name + ' del ' + fmtStamp(old) + '.',
      confirmText: 'Eliminar', danger: true
    });
    if (!ok) return;
    Medication.removeDose(med, doseCtx.index);
    persist();
    $('#dose-dialog').close();
    renderAll();
    showToast('Registro eliminado.');
  }

  /* ---------- Historial ---------- */
  function renderHistory() {
    if (!findMed(historyMedId)) historyMedId = state.medications[0].id;
    $('#history-tabs').innerHTML = state.medications.map(m =>
      '<button type="button" role="tab" class="seg-btn' + (m.id === historyMedId ? ' is-active' : '') + '" aria-selected="' + (m.id === historyMedId) + '" data-med-id="' + esc(m.id) + '">' + esc(m.name) + '</button>'
    ).join('');

    const med = findMed(historyMedId);
    const items = med.history.map((iso, index) => ({ date: Medication.parseISO(iso), index }))
      .reverse().slice(0, 30);                 // más recientes primero
    $('#history-list').innerHTML = items.length
      ? items.map(({ date, index }) =>
          '<li class="history-item glass"><div class="h-info"><p class="h-date">' + esc(Medication.formatDate(date, true)) + '</p>' +
          '<p class="h-med">' + esc(med.name) + '</p></div>' +
          '<p class="h-time">' + Medication.formatTime(date) + '</p>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-edit-index="' + index + '" aria-label="Editar toma del ' + esc(fmtStamp(date)) + '">Editar</button></li>'
        ).join('')
      : '<li class="empty-note">Todavía no hay tomas registradas para ' + esc(med.name) + '. Registrá la primera desde Inicio.</li>';
  }

  /* ---------- Configuración ---------- */
  function renderSettings() {
    $('#settings-fields').innerHTML = state.medications.map((med, i) => {
      const last = Medication.getLastTaken(med);
      const v = last ? Medication.toInputValues(last) : { date: '', time: '' };
      return '<fieldset class="med-fieldset glass form-card"><legend>' + esc(med.name) + '</legend>' +
        '<div class="field"><label for="s-name-' + i + '">Nombre del medicamento</label>' +
        '<input type="text" id="s-name-' + i + '" maxlength="40" value="' + esc(med.name) + '"></div>' +
        '<div class="field"><label for="s-int-' + i + '">Intervalo en horas</label>' +
        '<input type="number" id="s-int-' + i + '" min="0.5" max="168" step="0.5" inputmode="decimal" value="' + med.intervalHours + '"></div>' +
        '<div class="field"><label for="s-sch-' + i + '">Horarios habituales</label>' +
        '<input type="text" id="s-sch-' + i + '" placeholder="08:00, 20:00" value="' + esc(med.schedule.join(', ')) + '">' +
        '<p class="hint">Separalos con coma. Son informativos: el cálculo usa la última toma registrada.</p></div>' +
        '<div class="field-row"><div class="field"><label for="s-date-' + i + '">Última toma, fecha</label>' +
        '<input type="date" id="s-date-' + i + '" value="' + v.date + '"></div>' +
        '<div class="field"><label for="s-time-' + i + '">Hora</label>' +
        '<input type="time" id="s-time-' + i + '" value="' + v.time + '"></div></div>' +
        '</fieldset>';
    }).join('');
    const notifToggle = $('#notif-toggle');
    if (notifToggle) {
      notifToggle.checked = state.notifications && 'Notification' in window && Notification.permission === 'granted';
    }
    showFormError($('#settings-error'), '');
  }

  async function onSettingsSubmit(event) {
    event.preventDefault();
    const errorEl = $('#settings-error');
    const updates = [];

    for (let i = 0; i < state.medications.length; i++) {
      const med = state.medications[i];
      const name = $('#s-name-' + i).value.trim();
      const interval = parseFloat($('#s-int-' + i).value.replace(',', '.'));
      const schedule = Medication.parseSchedule($('#s-sch-' + i).value);
      const dateStr = $('#s-date-' + i).value;
      const timeStr = $('#s-time-' + i).value;

      if (!name) return showFormError(errorEl, 'Escribí un nombre para el medicamento ' + (i + 1) + '.');
      if (!(interval >= 0.5 && interval <= 168)) return showFormError(errorEl, 'El intervalo de ' + name + ' debe estar entre 0,5 y 168 horas.');
      if (schedule === null) return showFormError(errorEl, 'Revisá los horarios habituales de ' + name + '. Formato: 08:00, 20:00.');

      let newLast = null;
      if (dateStr || timeStr) {
        newLast = Medication.fromInputValues(dateStr, timeStr);
        if (!newLast) return showFormError(errorEl, 'Completá fecha y hora de la última toma de ' + name + '.');
        if (newLast.getTime() > Date.now() + 60000) return showFormError(errorEl, 'La última toma de ' + name + ' no puede ser futura.');
      }
      updates.push({ med, name, interval, schedule, newLast });
    }
    showFormError(errorEl, '');

    // Si cambia una "última toma" ya registrada, pedimos confirmación.
    const changes = updates.filter(u => {
      const current = Medication.getLastTaken(u.med);
      return u.newLast && current && current.getTime() !== u.newLast.getTime();
    });
    if (changes.length) {
      const detail = changes.map(u => u.name + ': ' + fmtStamp(Medication.getLastTaken(u.med)) + ' a ' + fmtStamp(u.newLast)).join('. ');
      const ok = await askConfirm({ title: '¿Modificar la última toma?', message: detail + '. La próxima toma se recalculará.' });
      if (!ok) return;
    }

    updates.forEach(u => {
      u.med.name = u.name;
      u.med.intervalHours = u.interval;
      u.med.schedule = u.schedule;
      if (u.newLast) {
        const current = Medication.getLastTaken(u.med);
        if (!current) Medication.addDose(u.med, u.newLast);
        else if (current.getTime() !== u.newLast.getTime()) Medication.replaceDose(u.med, u.med.history.length - 1, u.newLast);
      }
    });
    persist();
    renderAll();
    renderSettings();
    showToast('Cambios guardados.');
  }

  async function onNotifToggle(event) {
    const toggle = event.target;
    if (!toggle.checked) { state.notifications = false; persist(); return; }
    if (!('Notification' in window)) {
      toggle.checked = false;
      return showToast('Este navegador no admite avisos.');
    }
    const permission = await Notification.requestPermission();
    state.notifications = permission === 'granted';
    toggle.checked = state.notifications;
    persist();
    showToast(state.notifications ? 'Avisos activados mientras MediTime esté abierta.' : 'Permiso denegado: no se activaron los avisos.');
  }

  async function onReset() {
    const ok = await askConfirm({
      title: '¿Restablecer valores iniciales?',
      message: 'Se borrarán los registros, el historial y los cambios de configuración de este dispositivo. No se puede deshacer.',
      confirmText: 'Restablecer', danger: true
    });
    if (!ok) return;
    MedStorage.clear();
    state = Medication.defaultState();
    historyMedId = null;
    showWelcome();
  }

  /* ---------- Avisos del navegador (opcional) ---------- */
  function onDue(med) {
    if (!state.notifications || !('Notification' in window) || Notification.permission !== 'granted') return;
    const title = 'MediTime';
    const options = { body: 'Horario de toma alcanzado: ' + med.name, icon: 'assets/icons/icon-192.png', tag: 'meditime-' + med.id };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(reg => reg.showNotification(title, options)).catch(() => { try { new Notification(title, options); } catch (e) { /* sin acción */ } });
    } else {
      try { new Notification(title, options); } catch (e) { /* sin acción */ }
    }
  }

  /* ---------- Navegación entre secciones ---------- */
  function showView(name) {
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + name; });
    $$('.nav-btn').forEach(b => {
      const active = b.dataset.view === name;
      b.classList.toggle('is-active', active);
      if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (name === 'history') renderHistory();
    if (name === 'settings') renderSettings();
    window.scrollTo({ top: 0 });
  }

  function renderAll() {
    renderCards();
    if (!$('#view-history').hidden) renderHistory();
  }

  function showWelcome() {
    $('#app').hidden = true;
    $('#welcome').hidden = false;
    renderWelcome();
    showFormError($('#welcome-error'), '');
    window.scrollTo({ top: 0 });
  }

  function showApp() {
    $('#welcome').hidden = true;
    $('#app').hidden = false;
    showView('home');
    renderAll();
  }

  /* ---------- Arranque ---------- */
  function init() {
    const loaded = MedStorage.load();
    const banner = $('#storage-banner');
    if (!MedStorage.isAvailable()) {
      banner.textContent = 'El almacenamiento local no está disponible en este navegador (¿modo privado?). Podés usar MediTime, pero los registros se perderán al cerrar la página.';
      banner.hidden = false;
    } else if (loaded.error === 'corrupt') {
      banner.textContent = 'No se pudieron leer los datos guardados, así que MediTime empezó de cero. Se conservó una copia de respaldo en el navegador.';
      banner.hidden = false;
    }
    state = Medication.normalizeState(loaded.state);

    $('#welcome-form').addEventListener('submit', onWelcomeSubmit);
    $('#cards').addEventListener('click', onCardClick);
    $('#dose-form').addEventListener('submit', onDoseSubmit);
    $('#dose-cancel').addEventListener('click', () => $('#dose-dialog').close());
    $('#dose-delete').addEventListener('click', onDoseDelete);
    $('#settings-form').addEventListener('submit', onSettingsSubmit);
    const notifToggle = $('#notif-toggle');
    if (notifToggle) notifToggle.addEventListener('change', onNotifToggle);
    $('#reset-btn').addEventListener('click', onReset);
    $$('.nav-btn').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
    $('#history-tabs').addEventListener('click', e => {
      const btn = e.target.closest('[data-med-id]');
      if (btn) { historyMedId = btn.dataset.medId; renderHistory(); }
    });
    $('#history-list').addEventListener('click', e => {
      const btn = e.target.closest('[data-edit-index]');
      if (btn) openDoseDialog({ mode: 'edit', medId: historyMedId, index: Number(btn.dataset.editIndex) });
    });

    Timer.start({
      getMedications: () => state.medications,
      onDue,
      onTick: now => {
        const text = Medication.formatLongDate(now);
        if (text !== lastTodayText) { lastTodayText = text; $('#today').textContent = text; }
      }
    });

    if (state.setupDone) showApp(); else showWelcome();

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* la app funciona igual sin service worker */ });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
