/**
 * Configuración de la app.
 * ------------------------------------------------------------------
 * PEGA AQUÍ la URL de tu Web App de Apps Script (termina en /exec).
 * La obtienes al publicar el Apps Script — ver docs/02-apps-script.md.
 *
 * Mientras esté vacía, la app funciona en "modo demo" con un catálogo
 * de ejemplo y sin guardar en Google Sheets (los conteos se quedan solo
 * en el teléfono). En cuanto pegues la URL, empieza a usar tu Sheet real.
 */
window.CONFIG = {
  // Ejemplo: 'https://script.google.com/macros/s/AKfy...MUY-LARGO.../exec'
  API_URL: 'https://script.google.com/macros/s/AKfycbxMNvX536hDaaa8ZXGnbWG3Jtjc5tvYVOzIM5gl0Rr8kNRfZbMqFMXvEUa_1gHNI3Nh/exec',

  // Marcas de "Almacén" (a estas se les pide "Cajas a pedir").
  // El resto se tratan como "Proveedor". Esto es solo un respaldo:
  // el origen real viene de la columna "origen" del catálogo.
  MARCAS_ALMACEN: ['Eurolub', 'Gamez'],
  MARCAS_PROVEEDOR: ['Chevron', 'Repsol', 'Valvoline', 'Castrol', 'Prestone', 'Bardhal'],

  // Texto que aparece en el PDF (a quién / de dónde).
  TALLER_NOMBRE: 'Taller — Inventario semanal'
};
