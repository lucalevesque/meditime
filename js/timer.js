/* ==========================================================================
   timer.js: cuentas regresivas
   Cada segundo recalcula cuánto falta para la próxima toma y actualiza solo
   los textos de cuenta regresiva. La cuenta NUNCA se guarda: se calcula
   restando "ahora" a la próxima toma.
   ========================================================================== */
const Timer = (() => {
  'use strict';

  let handle = null;
  let options = null;
  const wasPending = new Set(); // tomas que estaban "por llegar" mientras la app estaba abierta

  // 9300000 ms -> "2 h 35 min". Con menos de una hora se muestran también los segundos.
  function formatCountdown(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return h + ' h ' + m + ' min';
    if (m > 0) return m + ' min ' + s + ' s';
    return s + ' s';
  }

  function formatElapsed(ms) {
    const total = Math.floor(ms / 60000);
    if (total < 1) return 'recién llegó el horario';
    const h = Math.floor(total / 60);
    const m = total % 60;
    return 'hace ' + (h > 0 ? h + ' h ' + m + ' min' : m + ' min');
  }

  function tick() {
    const now = new Date();
    options.getMedications().forEach(med => {
      const card = document.querySelector('.card[data-med-id="' + med.id + '"]');
      const next = Medication.getNextDose(med);
      const last = Medication.getLastTaken(med);
      if (card && next && last) {
        const remaining = next.getTime() - now.getTime();
        const total = med.intervalHours * Medication.HOUR_MS;
        const due = remaining <= 0;
        const percent = Math.min(100, Math.max(0, ((now - last) / total) * 100));
        card.classList.toggle('is-due', due);
        card.querySelector('.countdown-text').textContent = due
          ? 'Horario de toma alcanzado'
          : 'Próxima toma en ' + formatCountdown(remaining);
        card.querySelector('.countdown-sub').textContent = due ? formatElapsed(-remaining) : '';
        card.querySelector('.progress-bar').style.width = percent.toFixed(1) + '%';
        card.querySelector('.progress').setAttribute('aria-valuenow', Math.round(percent));
      }
      // Aviso opcional: solo cuando el horario se alcanza con la app abierta.
      if (next && options.onDue) {
        const key = med.id + '|' + next.toISOString();
        if (next - now > 0) wasPending.add(key);
        else if (wasPending.has(key)) { wasPending.delete(key); options.onDue(med, next); }
      }
    });
    if (options.onTick) options.onTick(now);
  }

  // options: { getMedications, onDue, onTick }
  function start(opts) {
    options = opts;
    stop();
    tick();
    handle = setInterval(tick, 1000);
    // Al volver a la pestaña, actualizamos al instante (los navegadores frenan los timers en segundo plano).
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  }

  function stop() {
    if (handle) clearInterval(handle);
    handle = null;
  }

  return { start, stop, tickNow: () => options && tick(), formatCountdown };
})();
