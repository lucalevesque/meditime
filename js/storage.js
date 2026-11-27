/* ==========================================================================
   storage.js: lectura y escritura en LocalStorage
   Es el único archivo que "habla" con localStorage. Si algún día querés
   cambiar dónde se guardan los datos, solo tocás este archivo.
   ========================================================================== */
const MedStorage = (() => {
  'use strict';

  const KEY = 'meditime:v1';      // nombre bajo el que se guardan todos los datos
  let available = null;           // cache: ¿funciona localStorage? (null = aún no probado)

  // Probamos escribir y borrar un dato. Puede fallar en modo privado o si el usuario lo bloqueó.
  function isAvailable() {
    if (available !== null) return available;
    try {
      const test = '__meditime_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      available = true;
    } catch (error) {
      available = false;
    }
    return available;
  }

  // Devuelve { ok, state, error }. state es null si todavía no hay nada guardado.
  function load() {
    if (!isAvailable()) return { ok: false, state: null, error: 'unavailable' };
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
      if (raw === null) return { ok: true, state: null };
      return { ok: true, state: JSON.parse(raw) };
    } catch (error) {
      // Datos ilegibles: los guardamos aparte para no perderlos y empezamos de cero.
      try { if (raw) localStorage.setItem(KEY + ':corrupt-backup', raw); } catch (e) { /* sin acción */ }
      return { ok: false, state: null, error: 'corrupt' };
    }
  }

  // Guarda el estado completo como texto JSON. Devuelve true si salió bien.
  function save(state) {
    if (!isAvailable()) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      return false; // por ejemplo: almacenamiento lleno
    }
  }

  function clear() {
    if (!isAvailable()) return false;
    try {
      localStorage.removeItem(KEY);
      return true;
    } catch (error) {
      return false;
    }
  }

  return { isAvailable, load, save, clear };
})();
