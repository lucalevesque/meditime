/* ==========================================================================
   medication.js: datos de medicamentos, cálculos y formato de fechas
   No toca la pantalla ni LocalStorage: solo trabaja con datos y fechas.
   ========================================================================== */
const Medication = (() => {
  'use strict';

  const HOUR_MS = 60 * 60 * 1000;
  const MAX_HISTORY = 100;                       // tomas que se conservan por medicamento
  const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/; // formato HH:MM

  /* ---------- Configuración inicial (editá acá nombres e intervalos) ---------- */
  function defaultState() {
    return {
      version: 1,
      setupDone: false,        // false = se muestra la pantalla de bienvenida
      notifications: false,    // avisos del navegador (opcional)
      medications: [
        {
          id: 'ultrabiotic-duo',
          name: 'Ultrabiotic Duo',
          intervalHours: 12,
          schedule: ['08:00', '20:00'], // horarios habituales (solo informativos)
          suggestedTime: '',            // hora sugerida en la bienvenida
          history: []                   // fechas ISO 8601, de la más antigua a la más nueva
        },
        {
          id: 'letondal',
          name: 'Letondal',
          intervalHours: 8,
          schedule: [],
          suggestedTime: '18:00',       // dato inicial: la fecha la confirma la persona
          history: []
        }
      ]
    };
  }

  /* ---------- Validación de lo que viene de LocalStorage ---------- */
  function parseISO(iso) {
    if (typeof iso !== 'string') return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Si los datos guardados están incompletos o dañados, se completan con valores seguros.
  function normalizeState(data) {
    const base = defaultState();
    if (!data || typeof data !== 'object' || !Array.isArray(data.medications)) return base;
    const medications = data.medications.map((m, i) => {
      const fallback = base.medications[i] || { id: 'med-' + (i + 1), name: 'Medicamento ' + (i + 1), intervalHours: 8, schedule: [], suggestedTime: '' };
      const interval = Number(m && m.intervalHours);
      const history = (m && Array.isArray(m.history) ? m.history : [])
        .map(parseISO).filter(Boolean)
        .sort((a, b) => a - b)
        .map(d => d.toISOString());
      return {
        id: (m && typeof m.id === 'string' && m.id) || fallback.id,
        name: (m && typeof m.name === 'string' && m.name.trim()) || fallback.name,
        intervalHours: interval > 0 && interval <= 168 ? interval : fallback.intervalHours,
        schedule: Array.isArray(m && m.schedule) ? m.schedule.filter(t => TIME_RE.test(t)) : fallback.schedule,
        suggestedTime: fallback.suggestedTime || '',
        history: history.slice(-MAX_HISTORY)
      };
    });
    if (!medications.length) return base;
    return {
      version: 1,
      setupDone: data.setupDone === true,
      notifications: data.notifications === true,
      medications
    };
  }

  /* ---------- Cálculos ---------- */
  function getLastTaken(med) {
    return med.history.length ? parseISO(med.history[med.history.length - 1]) : null;
  }

  // Próxima toma = última toma + intervalo. Se suman milisegundos sobre una fecha completa,
  // por eso los cambios de día, mes y año salen bien solos.
  function getNextDose(med) {
    const last = getLastTaken(med);
    return last ? new Date(last.getTime() + med.intervalHours * HOUR_MS) : null;
  }

  // Agrega una toma y mantiene el historial ordenado. Evita duplicar el mismo minuto exacto.
  function addDose(med, date) {
    const iso = date.toISOString();
    if (!med.history.includes(iso)) med.history.push(iso);
    med.history.sort();
    if (med.history.length > MAX_HISTORY) med.history = med.history.slice(-MAX_HISTORY);
  }

  function replaceDose(med, index, date) {
    med.history.splice(index, 1);
    addDose(med, date);
  }

  function removeDose(med, index) {
    med.history.splice(index, 1);
  }

  /* ---------- Fechas para los campos <input type="date|time"> ---------- */
  const pad = n => String(n).padStart(2, '0');

  function toInputValues(date) {
    return {
      date: date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()),
      time: pad(date.getHours()) + ':' + pad(date.getMinutes())
    };
  }

  // Construye una fecha en hora LOCAL del dispositivo a partir de "2026-11-26" y "18:00".
  function fromInputValues(dateStr, timeStr) {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
    const t = /^(\d{2}):(\d{2})$/.exec(timeStr || '');
    if (!d || !t) return null;
    const date = new Date(+d[1], +d[2] - 1, +d[3], +t[1], +t[2], 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Última ocurrencia de una hora (ej. 18:00) que no esté en el futuro.
  function mostRecentAt(timeStr, now) {
    const m = TIME_RE.exec(timeStr || '');
    if (!m) return null;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +m[1], +m[2], 0, 0);
    if (date > now) date.setDate(date.getDate() - 1);
    return date;
  }

  // "8:00, 20:00" -> ["08:00","20:00"]. Devuelve null si algún horario es inválido.
  function parseSchedule(text) {
    const parts = String(text || '').split(/[\s,;]+/).filter(Boolean);
    const result = [];
    for (const part of parts) {
      const m = TIME_RE.exec(part);
      if (!m) return null;
      result.push(pad(+m[1]) + ':' + m[2]);
    }
    return result;
  }

  /* ---------- Textos para mostrar ---------- */
  const LOCALE = 'es-AR';

  function formatTime(date) {
    return date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function formatDate(date, withYear) {
    const opts = { weekday: 'short', day: 'numeric', month: 'short' };
    if (withYear) opts.year = 'numeric';
    return date.toLocaleDateString(LOCALE, opts).replace(/[.,]/g, '');
  }

  function formatLongDate(date) {
    return date.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // "hoy", "mañana", "ayer" o la fecha corta.
  function formatDay(date, now) {
    const start = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff = Math.round((start(date) - start(now)) / 86400000);
    if (diff === 0) return 'hoy';
    if (diff === 1) return 'mañana';
    if (diff === -1) return 'ayer';
    return formatDate(date);
  }

  function formatInterval(hours) {
    return 'Cada ' + String(hours).replace('.', ',') + ' h';
  }

  function formatList(items) {
    if (!items.length) return '';
    return new Intl.ListFormat(LOCALE, { style: 'long', type: 'conjunction' }).format(items);
  }

  return {
    HOUR_MS, defaultState, normalizeState, parseISO,
    getLastTaken, getNextDose, addDose, replaceDose, removeDose,
    toInputValues, fromInputValues, mostRecentAt, parseSchedule,
    formatTime, formatDate, formatLongDate, formatDay, formatInterval, formatList
  };
})();
