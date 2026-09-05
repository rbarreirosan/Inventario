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

  // Envía datos al Apps Script. Probamos varios métodos porque cada
  // navegador (sobre todo iOS) bloquea unos u otros:
  //   1) navigator.sendBeacon  -> el más confiable en iPhone (POST simple,
  //      no sujeto a CORS). Límite ~64 KB.
  //   2) fetch no-cors (keepalive) -> para payloads grandes o si no hay beacon.
  //   3) formulario oculto -> iframe -> último recurso (funciona en escritorio).
  // El backend lee el JSON desde el cuerpo (postData.contents) o del campo
  // "data" (formulario), así que cualquiera de los tres entrega el dato.
  async function postText(payload) {
    const json = JSON.stringify(payload);

    // 1) sendBeacon (ideal para iOS).
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([json], { type: 'text/plain;charset=utf-8' });
        if (blob.size < 60000 && navigator.sendBeacon(apiUrl(), blob)) {
          return { ok: true, via: 'beacon' };
        }
      }
    } catch (e) { /* seguimos con el siguiente método */ }

    // 2) fetch no-cors (no podemos leer la respuesta, pero entrega el dato).
    try {
      await fetch(apiUrl(), {
        method: 'POST', mode: 'no-cors', keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: json
      });
      return { ok: true, via: 'fetch' };
    } catch (e) { /* seguimos con el formulario */ }

    // 3) Formulario oculto hacia un iframe (último recurso).
    return await postForm(json);
  }

  // Envío por formulario oculto (campo "data") apuntado a un iframe.
  function postForm(json) {
    return new Promise(resolve => {
      let listo = false;
      const terminar = () => { if (!listo) { listo = true; resolve({ ok: true, via: 'form' }); } };
      try {
        const nombre = 'inv_sink_' + Math.random().toString(36).slice(2);
        const iframe = document.createElement('iframe');
        iframe.name = nombre;
        iframe.style.display = 'none';
        iframe.addEventListener('load', terminar);
        document.body.appendChild(iframe);

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = apiUrl();
        form.target = nombre;
        form.style.display = 'none';
        const campo = document.createElement('input');
        campo.type = 'hidden';
        campo.name = 'data';
        campo.value = json;
        form.appendChild(campo);
        document.body.appendChild(form);
        form.submit();

        setTimeout(() => {
          terminar();
          try { form.remove(); } catch {}
          try { iframe.remove(); } catch {}
        }, 3000);
      } catch (e) {
        terminar();
      }
    });
  }

  // --- Catálogo -----------------------------------------------------

  async function getCatalogo({ forzar = false } = {}) {
    // Si no forzamos y hay caché, lo devolvemos al instante.
    if (!forzar) {
      const cache = leerCache();
      if (cache && cache.length) return cache;
    }

    if (modoDemo()) {
      // En demo no hay servidor: si ya hay catálogo cacheado (con posibles
      // altas del usuario), lo conservamos; si no, generamos el de ejemplo.
      const cache = leerCache();
      if (cache && cache.length) return cache;
      const demo = catalogoDemo();
      guardarCache(demo);
      return demo;
    }

    try {
      const resp = await fetch(apiUrl() + '?_=' + Date.now(), { method: 'GET', cache: 'no-store' });
      const data = await resp.json();
      if (!data.ok || !Array.isArray(data.catalogo)) throw new Error(data.error || 'Respuesta inválida');
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

    // Sin conexión: guardar en la cola para reintentar al volver la señal.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      encolar(registros);
      throw new Error('sin conexión');
    }

    await postText({ registros });
    return { ok: true, guardados: registros.length };
  }

  // --- Agregar / actualizar un producto en el catálogo -------------

  // producto = {codigo_barras, nombre, marca, origen, categoria, presentacion, precio}
  async function agregarProducto(producto) {
    if (!producto || !producto.codigo_barras) throw new Error('Falta el código de barras');

    if (modoDemo()) {
      // Sin backend: solo lo agregamos al catálogo cacheado localmente.
      const cache = leerCache() || [];
      const i = cache.findIndex(p => String(p.codigo_barras) === String(producto.codigo_barras));
      if (i >= 0) cache[i] = { ...cache[i], ...producto }; else cache.push(producto);
      guardarCache(cache);
      return { ok: true, demo: true };
    }

    await postText({ accion: 'agregar_catalogo', producto });
    return { ok: true };
  }

  // Borra un conteo del Google Sheet (por fecha + código de barras).
  async function borrarConteo(fecha, codigo_barras) {
    if (modoDemo()) return { ok: true, demo: true };
    if (!codigo_barras) return { ok: true, sinCodigo: true };
    await postText({ accion: 'borrar_conteo', fecha, codigo_barras });
    return { ok: true };
  }

  // --- PDFs en Drive: guardar y listar historial -------------------

  // Sube el PDF (base64) a Drive. `etiqueta` distingue reportes del mismo día
  // (ej. "Eurolub", "Proveedor"). Devuelve {ok, url, ...} o {ok:false}.
  async function guardarPDF(fecha, base64, etiqueta) {
    if (modoDemo()) return { ok: false, demo: true };
    await postText({ accion: 'guardar_pdf', fecha, base64, etiqueta: etiqueta || '' });
    return { ok: true };
  }

  // Lee el diagnóstico del servidor (qué recibió en el último POST).
  // Usa SIEMPRE la URL configurada (la correcta), sin depender de teclear nada.
  async function getDebug() {
    if (modoDemo()) return { modo: 'demo' };
    try {
      const resp = await fetch(apiUrl() + '?accion=debug&_=' + Date.now(), { cache: 'no-store' });
      const data = await resp.json();
      return data;
    } catch (e) {
      return { error_lectura: String(e && e.message ? e.message : e) };
    }
  }

  // Lista los PDFs guardados. Devuelve un array, [] si no hay,
  // o null si el Apps Script todavía no tiene esta función (versión vieja).
  async function getHistorial() {
    if (modoDemo()) return null;
    try {
      const resp = await fetch(apiUrl() + '?accion=historial&_=' + Date.now(), { cache: 'no-store' });
      const data = await resp.json();
      if (!data.ok || !Array.isArray(data.archivos)) return null;
      return data.archivos;
    } catch {
      return null;
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
      await postText({ registros: cola });
      escribirCola([]);
      return cola.length;
    } catch {
      return 0; // sigue pendiente, se reintenta después
    }
  }

  // --- Catálogo de ejemplo (modo demo) -----------------------------

  function catalogoDemo() {
    return [
      { codigo_barras: '7501234500011', nombre: '0W-20 Super Eco',        marca: 'Eurolub',   origen: 'Almacén',   categoria: 'Aceite',       presentacion: '1 L',    precio: '189.00', clave: '337001' },
      { codigo_barras: '7501234500028', nombre: '15W-40 Turbo Diesel',    marca: 'Eurolub',   origen: 'Almacén',   categoria: 'Aceite',       presentacion: '4 L',    precio: '620.00', clave: '337004' },
      { codigo_barras: '7501234500035', nombre: 'Limpia Inyectores',      marca: 'Gamez',     origen: 'Almacén',   categoria: 'Aditivo',      presentacion: '250 ml', precio: '95.00' },
      { codigo_barras: '7501234500042', nombre: 'Anticongelante Verde',   marca: 'Gamez',     origen: 'Almacén',   categoria: 'Refrigerante', presentacion: '1 L',    precio: '145.00' },
      { codigo_barras: '7501234500059', nombre: 'Supreme 20W-50',         marca: 'Chevron',   origen: 'Proveedor', categoria: 'Aceite',       presentacion: '1 L',    precio: '165.00' },
      { codigo_barras: '7501234500066', nombre: 'Elite 5W-30',            marca: 'Repsol',    origen: 'Proveedor', categoria: 'Aceite',       presentacion: '4 L',    precio: '740.00' },
      { codigo_barras: '7501234500073', nombre: 'MaxLife 10W-40',         marca: 'Valvoline', origen: 'Proveedor', categoria: 'Aceite',       presentacion: '1 L',    precio: '175.00' },
      { codigo_barras: '7501234500080', nombre: 'GTX 20W-50',             marca: 'Castrol',   origen: 'Proveedor', categoria: 'Aceite',       presentacion: '1 L',    precio: '180.00' },
      { codigo_barras: '7501234500097', nombre: 'Anticongelante 50/50',   marca: 'Prestone',  origen: 'Proveedor', categoria: 'Refrigerante', presentacion: '1 L',    precio: '210.00' },
      { codigo_barras: '7501234500103', nombre: 'Refrigerante Concentrado', marca: 'Prestone', origen: 'Proveedor', categoria: 'Refrigerante', presentacion: '3.78 L', precio: '520.00' },
      { codigo_barras: '7501234500110', nombre: 'Tratamiento Motor',      marca: 'Bardhal',   origen: 'Proveedor', categoria: 'Aditivo',      presentacion: '473 ml', precio: '260.00' }
    ];
  }

  return { getCatalogo, guardarConteo, agregarProducto, borrarConteo, guardarPDF, getHistorial, getDebug, sincronizarPendientes, pendientes, modoDemo };
})();
