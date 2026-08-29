/**
 * api.js — comunicación con el backend (Google Apps Script).
 *
 * Expone dos funciones principales:
 *   API.getCatalogo()          -> descarga el catálogo (array de productos)
 *   API.guardarConteo(regs)    -> guarda uno o varios registros de conteo
 *
 * Diseñado para funcionar sin conexión: el catálogo se cachea en el
 * teléfono, y los conteos que no se puedan enviar se guardan en una
 * "cola" y se reintentan después.
 */
const API = (() => {
  const CACHE_CATALOGO = 'inv_catalogo_cache';
  const COLA_PENDIENTES = 'inv_cola_pendientes';

  function apiUrl() {
    return (window.CONFIG && window.CONFIG.API_URL || '').trim();
  }

  function modoDemo() {
    return apiUrl() === '';
  }

  // --- Catálogo -----------------------------------------------------

  async function getCatalogo({ forzar = false } = {}) {
    // Si no forzamos y hay caché, lo devolvemos al instante.
    if (!forzar) {
      const cache = leerCache();
      if (cache && cache.length) return cache;
    }

    if (modoDemo()) {
      const demo = catalogoDemo();
      guardarCache(demo);
      return demo;
    }

    try {
      const resp = await fetch(apiUrl(), { method: 'GET' });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'Respuesta inválida');
      guardarCache(data.catalogo);
      return data.catalogo;
    } catch (err) {
      // Sin conexión: usar lo último que se descargó.
      const cache = leerCache();
      if (cache && cache.length) return cache;
      throw err;
    }
  }

  function leerCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_CATALOGO)) || null; }
    catch { return null; }
  }
  function guardarCache(catalogo) {
    try { localStorage.setItem(CACHE_CATALOGO, JSON.stringify(catalogo)); }
    catch {}
  }

  // --- Guardar conteos ---------------------------------------------

  // Recibe un array de registros {fecha, codigo_barras, existencia, cajas_a_pedir}
  async function guardarConteo(registros) {
    if (!Array.isArray(registros)) registros = [registros];
    if (!registros.length) return { ok: true, guardados: 0 };

    if (modoDemo()) {
      // En demo no hay backend: lo damos por guardado localmente.
      return { ok: true, guardados: registros.length, demo: true };
    }

    try {
      const resp = await fetch(apiUrl(), {
        method: 'POST',
        // text/plain evita el "preflight" CORS que Apps Script no maneja.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ registros })
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'Error al guardar');
      return data;
    } catch (err) {
      // Sin conexión: guardar en la cola para reintentar luego.
      encolar(registros);
      throw err;
    }
  }

  // --- Cola de pendientes (offline) --------------------------------

  function leerCola() {
    try { return JSON.parse(localStorage.getItem(COLA_PENDIENTES)) || []; }
    catch { return []; }
  }
  function escribirCola(arr) {
    try { localStorage.setItem(COLA_PENDIENTES, JSON.stringify(arr)); } catch {}
  }
  function encolar(registros) {
    const cola = leerCola().concat(registros);
    escribirCola(cola);
  }
  function pendientes() { return leerCola().length; }

  // Intenta enviar todo lo que quedó pendiente. Devuelve cuántos envió.
  async function sincronizarPendientes() {
    if (modoDemo()) { escribirCola([]); return 0; }
    const cola = leerCola();
    if (!cola.length) return 0;
    try {
      const resp = await fetch(apiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ registros: cola })
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || 'Error al sincronizar');
      escribirCola([]);
      return cola.length;
    } catch {
      return 0; // sigue pendiente, se reintenta después
    }
  }

  // --- Catálogo de ejemplo (modo demo) -----------------------------

  function catalogoDemo() {
    return [
      { codigo_barras: '7501234500011', nombre: '0W-20 Super Eco',        marca: 'Eurolub',   origen: 'Almacén',   categoria: 'Aceite',       presentacion: '1 L' },
      { codigo_barras: '7501234500028', nombre: '15W-40 Turbo Diesel',    marca: 'Eurolub',   origen: 'Almacén',   categoria: 'Aceite',       presentacion: '4 L' },
      { codigo_barras: '7501234500035', nombre: 'Limpia Inyectores',      marca: 'Gamez',     origen: 'Almacén',   categoria: 'Aditivo',      presentacion: '250 ml' },
      { codigo_barras: '7501234500042', nombre: 'Anticongelante Verde',   marca: 'Gamez',     origen: 'Almacén',   categoria: 'Refrigerante', presentacion: '1 L' },
      { codigo_barras: '7501234500059', nombre: 'Supreme 20W-50',         marca: 'Chevron',   origen: 'Proveedor', categoria: 'Aceite',       presentacion: '1 L' },
      { codigo_barras: '7501234500066', nombre: 'Elite 5W-30',            marca: 'Repsol',    origen: 'Proveedor', categoria: 'Aceite',       presentacion: '4 L' },
      { codigo_barras: '7501234500073', nombre: 'MaxLife 10W-40',         marca: 'Valvoline', origen: 'Proveedor', categoria: 'Aceite',       presentacion: '1 L' },
      { codigo_barras: '7501234500080', nombre: 'GTX 20W-50',             marca: 'Castrol',   origen: 'Proveedor', categoria: 'Aceite',       presentacion: '1 L' },
      { codigo_barras: '7501234500097', nombre: 'Anticongelante 50/50',   marca: 'Prestone',  origen: 'Proveedor', categoria: 'Refrigerante', presentacion: '1 L' },
      { codigo_barras: '7501234500103', nombre: 'Refrigerante Concentrado', marca: 'Prestone', origen: 'Proveedor', categoria: 'Refrigerante', presentacion: '3.78 L' },
      { codigo_barras: '7501234500110', nombre: 'Tratamiento Motor',      marca: 'Bardhal',   origen: 'Proveedor', categoria: 'Aditivo',      presentacion: '473 ml' }
    ];
  }

  return { getCatalogo, guardarConteo, sincronizarPendientes, pendientes, modoDemo };
})();
