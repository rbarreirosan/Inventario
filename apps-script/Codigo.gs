/**
 * Inventario ECOM / Prestone — Backend (Google Apps Script Web App)
 * ------------------------------------------------------------------
 * Este archivo vive DENTRO del Google Sheet (Extensiones > Apps Script).
 * Expone dos "endpoints" (URLs de API) que la app usa:
 *
 *   doGet()  -> devuelve el Catálogo completo en formato JSON
 *   doPost() -> recibe uno o varios registros de conteo y los agrega
 *               a la pestaña "Conteos"
 *
 * No necesitas entender el código para usarlo. Solo cópialo tal cual,
 * y sigue la guía docs/02-apps-script.md para publicarlo.
 */

// Nombres EXACTOS de las pestañas del Sheet (respetar mayúsculas/acentos).
var HOJA_CATALOGO = 'Catálogo';
var HOJA_CONTEOS  = 'Conteos';

/**
 * GET: la app llama esta función para descargar el catálogo.
 * Devuelve: { ok: true, catalogo: [ {codigo_barras, marca, origen, categoria, presentacion}, ... ] }
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(HOJA_CATALOGO);
    if (!hoja) {
      return _json({ ok: false, error: 'No existe la pestaña "' + HOJA_CATALOGO + '"' });
    }

    var datos = hoja.getDataRange().getValues(); // incluye el encabezado
    var catalogo = [];
    if (datos.length < 2) return _json({ ok: true, catalogo: [], total: 0 });

    // Leemos las columnas POR NOMBRE de encabezado (no por posición),
    // así puedes poner "nombre" y las demás columnas en el orden que quieras.
    var idx = _indiceColumnas(datos[0]);

    // Empezamos en 1 para saltar la fila de encabezados.
    for (var i = 1; i < datos.length; i++) {
      var fila = datos[i];
      var codigo = _txt(fila[idx.codigo_barras]);
      if (!codigo) continue; // saltar filas vacías

      catalogo.push({
        codigo_barras: codigo,
        nombre:        _txt(fila[idx.nombre]),
        marca:         _txt(fila[idx.marca]),
        origen:        _txt(fila[idx.origen]),
        categoria:     _txt(fila[idx.categoria]),
        presentacion:  _txt(fila[idx.presentacion]),
        precio:        _txt(fila[idx.precio])
      });
    }

    return _json({ ok: true, catalogo: catalogo, total: catalogo.length });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

/**
 * POST: la app envía un registro de conteo (o varios) para guardarlos.
 *
 * Acepta dos formatos en el cuerpo (body) de la petición:
 *   1) Un solo registro:
 *      { "fecha": "...", "codigo_barras": "...", "existencia": 5, "cajas_a_pedir": 2 }
 *   2) Varios registros a la vez:
 *      { "registros": [ {..}, {..}, ... ] }
 *
 * Devuelve: { ok: true, guardados: N }
 */
function doPost(e) {
  try {
    var cuerpo = {};
    if (e && e.postData && e.postData.contents) {
      cuerpo = JSON.parse(e.postData.contents);
    }

    var registros = [];
    if (cuerpo.registros && cuerpo.registros.length) {
      registros = cuerpo.registros;
    } else if (cuerpo.codigo_barras) {
      registros = [cuerpo];
    }

    if (!registros.length) {
      return _json({ ok: false, error: 'No se recibieron registros para guardar' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = ss.getSheetByName(HOJA_CONTEOS);
    if (!hoja) {
      return _json({ ok: false, error: 'No existe la pestaña "' + HOJA_CONTEOS + '"' });
    }

    // Un candado evita que dos guardados simultáneos se pisen.
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var filas = registros.map(function (r) {
        return [
          r.fecha || _hoy(),
          _txt(r.codigo_barras),
          r.existencia === '' || r.existencia == null ? '' : Number(r.existencia),
          r.cajas_a_pedir === '' || r.cajas_a_pedir == null ? '' : Number(r.cajas_a_pedir)
        ];
      });

      // Escribimos todas las filas de una sola vez (más rápido).
      var inicio = hoja.getLastRow() + 1;
      hoja.getRange(inicio, 1, filas.length, 4).setValues(filas);
    } finally {
      lock.releaseLock();
    }

    return _json({ ok: true, guardados: registros.length });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

// ---------- utilidades internas ----------

/**
 * Recibe la fila de encabezados y devuelve en qué columna está cada campo.
 * Acepta variaciones comunes (con/sin acento, "producto" como sinónimo de
 * "nombre"). Si una columna no existe, devuelve -1 (se guarda como vacío).
 */
function _indiceColumnas(encabezados) {
  var mapa = {};
  for (var c = 0; c < encabezados.length; c++) {
    mapa[_norm(encabezados[c])] = c;
  }
  function buscar(nombres) {
    for (var k = 0; k < nombres.length; k++) {
      if (mapa[nombres[k]] !== undefined) return mapa[nombres[k]];
    }
    return -1;
  }
  return {
    codigo_barras: buscar(['codigo_barras', 'codigo', 'codigobarras', 'barcode']),
    nombre:        buscar(['nombre', 'producto', 'descripcion']),
    marca:         buscar(['marca']),
    origen:        buscar(['origen']),
    categoria:     buscar(['categoria']),
    presentacion:  buscar(['presentacion', 'presentacion', 'presentaci']),
    precio:        buscar(['precio', 'costo', 'preciounitario'])
  };
}

// Normaliza un encabezado: minúsculas, sin acentos ni espacios.
function _norm(s) {
  return String(s || '')
    .trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[\s_]+/g, '');
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _txt(v) {
  return (v === null || v === undefined) ? '' : String(v).trim();
}

function _hoy() {
  var tz = Session.getScriptTimeZone() || 'America/Mexico_City';
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}
