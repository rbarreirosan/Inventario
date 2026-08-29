/**
 * scanner.js — cámara + lectura de código de barras.
 *
 * Usa la librería html5-qrcode (cargada en index.html desde un CDN),
 * que soporta códigos de barras 1D (EAN/UPC, típicos de productos)
 * y códigos QR.
 *
 * Uso:
 *   Scanner.abrir(codigo => { ...match contra catálogo... });
 *   Scanner.cerrar();
 */
const Scanner = (() => {
  let instancia = null;
  let activo = false;
  let onLeido = null;

  const overlay = () => document.getElementById('scanner-overlay');
  const contenedor = () => document.getElementById('scanner-reader');

  async function abrir(callback) {
    onLeido = callback;
    overlay().hidden = false;

    // Verificar que la librería esté cargada.
    if (typeof Html5Qrcode === 'undefined') {
      mostrarError('No se pudo cargar el lector de códigos. Revisa tu conexión.');
      return;
    }

    try {
      instancia = new Html5Qrcode('scanner-reader', { verbose: false });
      activo = true;
      await instancia.start(
        { facingMode: 'environment' }, // cámara trasera
        {
          fps: 12,
          qrbox: { width: 260, height: 160 },
          aspectRatio: 1.4
        },
        onScanSuccess,
        () => { /* ignorar frames sin lectura */ }
      );
    } catch (err) {
      mostrarError('No se pudo abrir la cámara. Da permiso de cámara al navegador o usa "Agregar manual".');
    }
  }

  function onScanSuccess(texto) {
    if (!activo) return;
    // Vibración corta como confirmación (si el dispositivo lo soporta).
    if (navigator.vibrate) navigator.vibrate(40);
    const codigo = String(texto).trim();
    // Cerramos la cámara y devolvemos el código.
    cerrar();
    if (onLeido) onLeido(codigo);
  }

  async function cerrar() {
    activo = false;
    overlay().hidden = true;
    ocultarError();
    if (instancia) {
      try { await instancia.stop(); } catch {}
      try { instancia.clear(); } catch {}
      instancia = null;
    }
  }

  function mostrarError(msg) {
    const el = document.getElementById('scanner-error');
    if (el) { el.textContent = msg; el.hidden = false; }
  }
  function ocultarError() {
    const el = document.getElementById('scanner-error');
    if (el) el.hidden = true;
  }

  return { abrir, cerrar };
})();
