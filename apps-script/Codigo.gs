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

// Carpeta de Google Drive donde se guardan los PDF de los conteos.
var CARPETA_PDF = 'Inventario — Conteos (PDF)';

/**
 * GET: la app llama esta función para descargar el catálogo,
 * o el historial de PDFs si se pide ?accion=historial.
 */
function doGet(e) {
  try {
    // Historial de PDFs guardados en Drive.
    if (e && e.parameter && e.parameter.accion === 'historial') {
      return historial();
    }

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
    // La app puede enviar el dato de dos formas:
    //  1) como campo de formulario "data" (método a prueba de CORS), o
    //  2) como cuerpo de texto plano (método anterior).
    if (e && e.parameter && e.parameter.data) {
      cuerpo = JSON.parse(e.parameter.data);
    } else if (e && e.postData && e.postData.contents) {
      cuerpo = JSON.parse(e.postData.contents);
    }

    // Si la app pide agregar/actualizar un producto del CATÁLOGO:
    if (cuerpo.accion === 'agregar_catalogo') {
      return agregarACatalogo(cuerpo.producto || {});
    }

    // Si la app pide guardar el PDF del conteo en Google Drive:
    if (cuerpo.accion === 'guardar_pdf') {
      return guardarPDF(cuerpo);
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
      var datos = hoja.getDataRange().getValues();

      // Índice de los renglones que YA existen, por fecha + código de barras,
      // para poder ACTUALIZAR en vez de duplicar.
      var indice = {};
      for (var i = 1; i < datos.length; i++) {
        var f = _txt(datos[i][0]);
        var c = _txt(datos[i][1]);
        if (c) indice[f + '||' + c] = i + 1; // número de fila en la hoja
      }

      // Si en un mismo envío llega el mismo código varias veces, nos quedamos
      // con el último (evita conflictos dentro del propio lote).
      var unicos = {};
      var soloUnicos = [];
      registros.forEach(function (r) {
        var cod = _txt(r.codigo_barras);
        if (cod) {
          var k = (r.fecha || _hoy()) + '||' + cod;
          if (unicos[k] == null) { unicos[k] = soloUnicos.length; soloUnicos.push(r); }
          else { soloUnicos[unicos[k]] = r; }
        } else {
          soloUnicos.push(r); // sin código: no se puede identificar, se agrega tal cual
        }
      });

      var nuevos = [];
      soloUnicos.forEach(function (r) {
        var fecha = r.fecha || _hoy();
        var cod = _txt(r.codigo_barras);
        var fila = [
          fecha,
          cod,
          r.existencia === '' || r.existencia == null ? '' : Number(r.existencia),
          r.cajas_a_pedir === '' || r.cajas_a_pedir == null ? '' : Number(r.cajas_a_pedir)
        ];
        var key = fecha + '||' + cod;
        if (cod && indice[key]) {
          // Ya existe ese producto ese día -> actualizar su renglón (no duplicar).
          hoja.getRange(indice[key], 1, 1, 4).setValues([fila]);
        } else {
          nuevos.push(fila);
        }
      });

      // Los que no existían, se agregan de una sola vez al final.
      if (nuevos.length) {
        hoja.getRange(hoja.getLastRow() + 1, 1, nuevos.length, 4).setValues(nuevos);
      }
    } finally {
      lock.releaseLock();
    }

    return _json({ ok: true, guardados: registros.length });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

/**
 * Agrega (o actualiza) un producto en la pestaña "Catálogo".
 * Si el código de barras ya existe, actualiza esa fila; si no, agrega una nueva.
 * Escribe cada dato en su columna correcta según los encabezados.
 *
 * producto = { codigo_barras, nombre, marca, origen, categoria, presentacion, precio }
 * Devuelve: { ok:true, actualizado:true|false }
 */
function agregarACatalogo(producto) {
  var codigo = _txt(producto.codigo_barras);
  if (!codigo) return _json({ ok: false, error: 'Falta el código de barras' });
  if (!_txt(producto.marca)) return _json({ ok: false, error: 'Falta la marca' });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(HOJA_CATALOGO);
  if (!hoja) return _json({ ok: false, error: 'No existe la pestaña "' + HOJA_CATALOGO + '"' });

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var datos = hoja.getDataRange().getValues();
    var idx = _indiceColumnas(datos[0]);
    var numCols = datos[0].length;

    // Arma la fila respetando la posición de cada columna.
    function ponerEn(fila, col, valor) { if (col >= 0) fila[col] = valor; }
    function nuevaFila(base) {
      var fila = base ? base.slice() : new Array(numCols).fill('');
      ponerEn(fila, idx.codigo_barras, codigo);
      ponerEn(fila, idx.nombre,        _txt(producto.nombre));
      ponerEn(fila, idx.marca,         _txt(producto.marca));
      ponerEn(fila, idx.origen,        _txt(producto.origen));
      ponerEn(fila, idx.categoria,     _txt(producto.categoria));
      ponerEn(fila, idx.presentacion,  _txt(producto.presentacion));
      ponerEn(fila, idx.precio,        _txt(producto.precio));
      return fila;
    }

    // ¿Ya existe ese código? -> actualizar esa fila.
    for (var i = 1; i < datos.length; i++) {
      if (_txt(datos[i][idx.codigo_barras]) === codigo) {
        var actualizada = nuevaFila(datos[i]);
        hoja.getRange(i + 1, 1, 1, numCols).setValues([actualizada]);
        return _json({ ok: true, actualizado: true });
      }
    }

    // No existe -> agregar al final.
    hoja.getRange(hoja.getLastRow() + 1, 1, 1, numCols).setValues([nuevaFila(null)]);
    return _json({ ok: true, actualizado: false });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------- PDFs en Google Drive ----------

/**
 * Devuelve (creándola si no existe) la carpeta de Drive de los PDFs.
 * Guarda su id para no buscarla cada vez.
 */
function _carpetaPDF() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CARPETA_PDF_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* se recrea abajo */ }
  }
  var it = DriveApp.getFoldersByName(CARPETA_PDF);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_PDF);
  props.setProperty('CARPETA_PDF_ID', folder.getId());
  return folder;
}

/**
 * Guarda el PDF (enviado por la app como base64) en la carpeta de Drive.
 * Si ya había un PDF de esa misma fecha, lo reemplaza (no duplica).
 * Devuelve: { ok:true, url, id, nombre }
 */
function guardarPDF(datos) {
  var fecha = _txt(datos.fecha) || _hoy();
  var b64 = String(datos.base64 || '');
  if (!b64) return _json({ ok: false, error: 'No se recibió el PDF' });

  // Si viene como data-uri ("data:application/pdf;base64,...."), quitamos el encabezado.
  var coma = b64.indexOf(',');
  if (b64.substring(0, 5) === 'data:' && coma >= 0) b64 = b64.substring(coma + 1);

  // La etiqueta (ej. "Eurolub", "Proveedor") permite tener varios PDFs por día
  // sin que se reemplacen entre sí. Solo se reemplaza el del mismo día + etiqueta.
  var etiqueta = _txt(datos.etiqueta).replace(/[^A-Za-z0-9]+/g, '');
  var bytes = Utilities.base64Decode(b64);
  var nombre = 'conteo-' + fecha + (etiqueta ? '-' + etiqueta : '') + '.pdf';
  var blob = Utilities.newBlob(bytes, 'application/pdf', nombre);

  var folder = _carpetaPDF();
  // Reemplazar el PDF de esa fecha si ya existía.
  var existentes = folder.getFilesByName(nombre);
  while (existentes.hasNext()) existentes.next().setTrashed(true);

  var file = folder.createFile(blob);
  // Cualquiera con el enlace puede verlo (para poder abrirlo desde la app).
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}

  return _json({ ok: true, url: file.getUrl(), id: file.getId(), nombre: nombre });
}

/**
 * Lista los PDFs guardados, más nuevos primero.
 * Devuelve: { ok:true, archivos:[ {nombre, fecha, url, id, actualizado}, ... ] }
 */
function historial() {
  var folder = _carpetaPDF();
  var it = folder.getFiles();
  var arr = [];
  while (it.hasNext()) {
    var f = it.next();
    var nombre = f.getName();
    // conteo-YYYY-MM-DD[-Etiqueta].pdf
    var m = nombre.match(/^conteo-(\d{4}-\d{2}-\d{2})(?:-(.+))?\.pdf$/i);
    arr.push({
      nombre: nombre,
      fecha: m ? m[1] : (nombre.match(/(\d{4}-\d{2}-\d{2})/) || ['', ''])[1],
      etiqueta: m && m[2] ? m[2] : '',
      url: f.getUrl(),
      id: f.getId(),
      actualizado: f.getLastUpdated().toISOString()
    });
  }
  arr.sort(function (a, b) {
    return (b.fecha + '|' + b.actualizado).localeCompare(a.fecha + '|' + a.actualizado);
  });
  return _json({ ok: true, archivos: arr });
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
