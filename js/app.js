/**
 * app.js — lógica principal de la app.
 *
 * - Descarga el catálogo y hace el "match" al escanear.
 * - Maneja la navegación entre pantallas (Conteo / Captura / Resumen / Catálogo).
 * - Guarda la sesión de conteo en el teléfono para que no se pierda.
 * - Envía los conteos al Google Sheet y genera el PDF.
 *
 * Reglas de negocio clave:
 *   - El ORIGEN (Almacén/Proveedor) se DERIVA de la marca, no se captura.
 *   - Solo productos de Almacén muestran el campo "Cajas a pedir".
 */
const App = (() => {
  const SESION = 'inv_sesion';
  const APP_VERSION = 'v15';

  let catalogo = [];
  let porCodigo = new Map();
  let sesion = cargarSesion();   // { fecha, items: [...] }
  let capturaActual = null;      // item en edición en la pantalla Captura

  // ---------------------------------------------------------------
  // Arranque
  // ---------------------------------------------------------------
  async function init() {
    const vEl = document.getElementById('app-version');
    if (vEl) vEl.textContent = APP_VERSION;
    registrarSW();
    conectarNav();
    conectarConteo();
    conectarCaptura();
    conectarResumen();
    conectarCatalogo();
    conectarEstadoRed();

    if (API.modoDemo()) mostrarAvisoDemo();

    await cargarCatalogo();
    renderConteo();
    mostrar('conteo');

    // Intentar enviar lo que quedó pendiente de sesiones anteriores.
    API.sincronizarPendientes().then(actualizarBadgePendientes);
  }

  async function cargarCatalogo({ forzar = false } = {}) {
    try {
      catalogo = await API.getCatalogo({ forzar });
    } catch {
      catalogo = [];
      toast('No se pudo cargar el catálogo. Revisa tu conexión.');
    }
    porCodigo = new Map();
    catalogo.forEach(p => porCodigo.set(String(p.codigo_barras), p));
  }

  // ---------------------------------------------------------------
  // Navegación
  // ---------------------------------------------------------------
  function mostrar(pantalla) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.toggle('active', s.id === 'screen-' + pantalla);
    });
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.nav === pantalla);
    });
    // El nav inferior solo se muestra en pantallas principales.
    const conNav = ['conteo', 'resumen', 'catalogo', 'historial'].includes(pantalla);
    document.getElementById('bottom-nav').hidden = !conNav;
    window.scrollTo(0, 0);

    if (pantalla === 'resumen') renderResumen();
    if (pantalla === 'catalogo') renderCatalogo();
    if (pantalla === 'conteo') renderConteo();
    if (pantalla === 'historial') renderHistorial();
  }

  function conectarNav() {
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.addEventListener('click', () => mostrar(b.dataset.nav));
    });
  }

  // ---------------------------------------------------------------
  // Pantalla CONTEO
  // ---------------------------------------------------------------
  function conectarConteo() {
    document.getElementById('btn-escanear').addEventListener('click', () => {
      Scanner.abrir(alEscanear);
    });
    document.getElementById('btn-cerrar-scanner').addEventListener('click', () => Scanner.cerrar());
    document.getElementById('btn-manual').addEventListener('click', abrirManual);
    document.getElementById('btn-refrescar-catalogo').addEventListener('click', async () => {
      toast('Actualizando catálogo…');
      await cargarCatalogo({ forzar: true });
      toast('Catálogo actualizado');
      renderConteo();
    });
  }

  function alEscanear(codigo) {
    const prod = porCodigo.get(String(codigo));
    if (prod) {
      abrirCaptura(prod);
    } else {
      // Código no está en el catálogo -> crear producto nuevo.
      abrirCaptura(nuevoProductoDesdeCodigo(codigo), true);
    }
  }

  function renderConteo() {
    const total = sesion.items.length;
    document.getElementById('progreso-num').textContent = total;
    document.getElementById('sesion-fecha').textContent = sesion.fecha;

    const lista = document.getElementById('lista-capturados');
    const recientes = [...sesion.items].reverse();
    if (!recientes.length) {
      lista.innerHTML = `<li class="vacio">Aún no capturas productos. Toca <b>Escanear</b> para empezar.</li>`;
      return;
    }
    lista.innerHTML = recientes.map(i => filaCapturado(i)).join('');
    lista.querySelectorAll('[data-editar]').forEach(el => {
      el.addEventListener('click', () => {
        const item = sesion.items.find(x => x.id === el.dataset.editar);
        if (item) abrirCaptura(item);
      });
    });
  }

  function filaCapturado(i) {
    const alm = esAlmacen(i);
    const detalle = [i.marca, i.presentacion].filter(Boolean).join(' · ');
    const extra = alm
      ? `<span class="pill pill-rojo">${i.cajas_a_pedir ? i.cajas_a_pedir + ' cajas' : 'sin pedido'}</span>`
      : '';
    return `
      <li class="cap" data-editar="${i.id}">
        <div class="cap-main">
          <div class="cap-marca">${esc(i.nombre || i.marca || '—')}</div>
          <div class="cap-det">${esc(detalle)}</div>
        </div>
        <div class="cap-right">
          <div class="cap-exist">${i.existencia ?? 0}<span>u</span></div>
          ${extra}
        </div>
      </li>`;
  }

  // ---------------------------------------------------------------
  // Agregar manual (buscador de catálogo)
  // ---------------------------------------------------------------
  function abrirManual() {
    const modal = document.getElementById('modal-manual');
    modal.hidden = false;
    const input = document.getElementById('manual-buscar');
    input.value = '';
    renderManual('');
    input.focus();
    input.oninput = () => renderManual(input.value);
    document.getElementById('btn-cerrar-manual').onclick = () => { modal.hidden = true; };
    document.getElementById('btn-cerrar-manual-bg').onclick = () => { modal.hidden = true; };
    document.getElementById('btn-nuevo-producto').onclick = () => {
      modal.hidden = true;
      abrirCaptura(nuevoProductoDesdeCodigo(input.value.trim()), true);
    };
  }

  function renderManual(q) {
    q = q.toLowerCase().trim();
    const res = !q ? catalogo : catalogo.filter(p =>
      [p.codigo_barras, p.nombre, p.marca, p.categoria, p.presentacion]
        .join(' ').toLowerCase().includes(q));
    const cont = document.getElementById('manual-resultados');
    if (!res.length) {
      cont.innerHTML = `<li class="vacio">Sin coincidencias. Puedes crear un producto nuevo.</li>`;
      return;
    }
    cont.innerHTML = res.slice(0, 50).map(p => `
      <li class="manual-item" data-cod="${esc(p.codigo_barras)}">
        <div>
          <div class="cap-marca">${esc(p.nombre || p.marca)}</div>
          <div class="cap-det">${esc([p.marca, p.categoria, p.presentacion].filter(Boolean).join(' · '))}</div>
        </div>
        <span class="pill ${esAlmacen(p) ? 'pill-rojo' : 'pill-gris'}">${esc(p.origen || (esAlmacen(p) ? 'Almacén' : 'Proveedor'))}</span>
      </li>`).join('');
    cont.querySelectorAll('.manual-item').forEach(el => {
      el.addEventListener('click', () => {
        document.getElementById('modal-manual').hidden = true;
        abrirCaptura(porCodigo.get(el.dataset.cod));
      });
    });
  }

  // ---------------------------------------------------------------
  // Pantalla CAPTURA
  // ---------------------------------------------------------------
  function conectarCaptura() {
    document.getElementById('btn-captura-volver').addEventListener('click', () => mostrar('conteo'));

    // Steppers existencia
    stepper('exist', () => capturaActual.existencia, v => capturaActual.existencia = v);
    stepper('cajas', () => capturaActual.cajas_a_pedir, v => capturaActual.cajas_a_pedir = v);

    document.getElementById('btn-guardar-siguiente').addEventListener('click', () => {
      guardarCaptura();
      Scanner.abrir(alEscanear);
    });
    document.getElementById('btn-guardar').addEventListener('click', () => {
      guardarCaptura();
      mostrar('conteo');
    });
  }

  function abrirCaptura(prod, esNuevo = false) {
    // Si ya existe en la sesión, editamos ese item; si no, creamos copia.
    const existente = sesion.items.find(x => x.id === prod.id || (prod.codigo_barras && x.codigo_barras === prod.codigo_barras));
    if (existente) {
      capturaActual = existente;
    } else {
      capturaActual = {
        id: prod.id || uid(),
        codigo_barras: prod.codigo_barras || '',
        nombre: prod.nombre || '',
        marca: prod.marca || '',
        origen: prod.origen || (esAlmacen(prod) ? 'Almacén' : 'Proveedor'),
        categoria: prod.categoria || '',
        presentacion: prod.presentacion || '',
        precio: prod.precio || '',
        existencia: 0,
        cajas_a_pedir: '',
        _nuevo: esNuevo
      };
    }
    renderCaptura();
    mostrar('captura');
  }

  function renderCaptura() {
    const i = capturaActual;
    const alm = esAlmacen(i);

    document.getElementById('captura-marca').textContent = i.nombre || i.marca || 'Producto nuevo';
    document.getElementById('captura-marca-pill').textContent = i.marca || '—';
    document.getElementById('captura-categoria').textContent = i.categoria || '—';
    document.getElementById('captura-presentacion').textContent = i.presentacion || '';
    document.getElementById('captura-codigo').textContent = i.codigo_barras ? '#' + i.codigo_barras : 'sin código';
    const precioEl = document.getElementById('captura-precio');
    precioEl.textContent = fmtPrecio(i.precio);
    precioEl.hidden = !i.precio;

    // Banner condicional según ORIGEN (derivado de la marca).
    const banner = document.getElementById('captura-banner');
    banner.className = 'banner ' + (alm ? 'banner-rojo' : 'banner-gris');
    banner.innerHTML = alm
      ? `<b>Almacén</b> · Indica cuántas <b>cajas pedir</b> abajo.`
      : `<b>Proveedor</b> · Solo se reporta la existencia (no se piden cajas).`;

    // Campos editables si es producto nuevo (marca/categoría/presentación).
    const edit = document.getElementById('captura-edicion');
    edit.hidden = !i._nuevo;
    if (i._nuevo) construirEdicionNuevo(i);

    document.getElementById('exist-val').value = i.existencia ?? 0;
    const cajasWrap = document.getElementById('cajas-wrap');
    cajasWrap.hidden = !alm;            // solo Almacén ve "Cajas a pedir"
    document.getElementById('cajas-val').value = i.cajas_a_pedir === '' ? '' : (i.cajas_a_pedir ?? '');
  }

  function construirEdicionNuevo(i) {
    const marcas = [...(window.CONFIG.MARCAS_ALMACEN || []), ...(window.CONFIG.MARCAS_PROVEEDOR || [])];
    const selMarca = document.getElementById('nuevo-marca');
    selMarca.innerHTML = `<option value="">Elige marca…</option>` +
      marcas.map(m => `<option ${m === i.marca ? 'selected' : ''}>${esc(m)}</option>`).join('');
    selMarca.onchange = () => {
      i.marca = selMarca.value;
      i.origen = (window.CONFIG.MARCAS_ALMACEN || []).includes(i.marca) ? 'Almacén' : 'Proveedor';
      renderCaptura(); // refresca banner y campo de cajas
    };
    const nom = document.getElementById('nuevo-nombre');
    nom.value = i.nombre || '';
    nom.oninput = () => { i.nombre = nom.value; document.getElementById('captura-marca').textContent = i.nombre || i.marca || 'Producto nuevo'; };
    const cat = document.getElementById('nuevo-categoria');
    cat.value = i.categoria || '';
    cat.oninput = () => i.categoria = cat.value;
    const pres = document.getElementById('nuevo-presentacion');
    pres.value = i.presentacion || '';
    pres.oninput = () => i.presentacion = pres.value;
  }

  // Botones − / + y campo numérico
  function stepper(nombre, get, set) {
    const input = document.getElementById(nombre + '-val');
    document.getElementById(nombre + '-menos').addEventListener('click', () => {
      const v = Math.max(0, (parseInt(input.value, 10) || 0) - 1);
      input.value = v; set(v);
    });
    document.getElementById(nombre + '-mas').addEventListener('click', () => {
      const v = (parseInt(input.value, 10) || 0) + 1;
      input.value = v; set(v);
    });
    input.addEventListener('input', () => {
      const raw = input.value.trim();
      set(raw === '' ? (nombre === 'cajas' ? '' : 0) : Math.max(0, parseInt(raw, 10) || 0));
    });
  }

  function guardarCaptura() {
    const i = capturaActual;
    if (!i.marca) { toast('Elige una marca primero.'); return false; }
    i.existencia = parseInt(document.getElementById('exist-val').value, 10) || 0;
    if (esAlmacen(i)) {
      const c = document.getElementById('cajas-val').value.trim();
      i.cajas_a_pedir = c === '' ? '' : (parseInt(c, 10) || 0);
    } else {
      i.cajas_a_pedir = '';
    }
    delete i._nuevo;

    // Insertar o actualizar en la sesión (dedupe por id).
    const idx = sesion.items.findIndex(x => x.id === i.id);
    if (idx >= 0) sesion.items[idx] = i; else sesion.items.push(i);
    guardarSesion();

    // Enviar al Sheet en segundo plano.
    enviarRegistro(i);
    toast('Guardado: ' + (i.marca || 'producto'));
    return true;
  }

  function enviarRegistro(i) {
    const registro = {
      fecha: sesion.fecha,
      codigo_barras: i.codigo_barras,
      existencia: i.existencia,
      cajas_a_pedir: esAlmacen(i) ? (i.cajas_a_pedir === '' ? '' : i.cajas_a_pedir) : ''
    };
    API.guardarConteo([registro])
      .then(() => actualizarBadgePendientes())
      .catch(() => { actualizarBadgePendientes(); });
  }

  // ---------------------------------------------------------------
  // Pantalla RESUMEN
  // ---------------------------------------------------------------
  function conectarResumen() {
    document.getElementById('btn-generar-pdf').addEventListener('click', async () => {
      if (!sesion.items.length) { toast('No hay productos para el PDF.'); return; }
      const scope = document.getElementById('pdf-scope').value || 'todo';
      const { items, titulo, etiqueta } = filtrarParaPDF(scope);
      if (!items.length) { toast('No hay productos de ese tipo en el conteo.'); return; }

      const base64 = PDFReporte.generar({ fecha: sesion.fecha, items, titulo });
      // Guardar una copia en Google Drive (si hay Sheet conectado).
      if (!API.modoDemo() && base64) {
        toast('Guardando copia en Drive…');
        try {
          await API.guardarPDF(sesion.fecha, base64, etiqueta);
        } catch (e) { /* el envío por formulario no lanza; seguimos a verificar */ }

        // Verificamos con la confirmación del PROPIO servidor: su último POST
        // debe reportar paso "pdf_ok" y reciente. Es más confiable que contar.
        await new Promise(r => setTimeout(r, 1800));
        const dbg = await API.getDebug();
        const up = dbg && dbg.ultimo_post;
        // Éxito si el PDF LLEGÓ al servidor hace poco y NO hubo error.
        // (No exigimos "pdf_ok" porque no todas las versiones del backend lo escriben.)
        const reciente = up && up.accion === 'guardar_pdf'
                       && (Date.now() - new Date(up.ts).getTime() < 90000);
        const conError = up && (up.paso === 'pdf_ERROR' || up.paso === 'pdf_sin_base64');
        if (reciente && !conError) {
          toast('PDF guardado en Drive ✓');
          if (document.getElementById('screen-historial').classList.contains('active')) renderHistorial();
        } else if (conError) {
          alert('No se pudo guardar en Drive.\n\nError del servidor: ' + (up.error || up.paso));
        } else {
          alert('DIAGNÓSTICO (' + APP_VERSION + ')\n\nEl envío no llegó al servidor.\n\nÚltimo POST recibido:\n\n' + JSON.stringify(dbg, null, 2));
        }
      }
    });
    document.getElementById('btn-sync-sheet').addEventListener('click', async () => {
      toast('Enviando a Google Sheets…');
      // Reenviar toda la sesión (por si algo quedó pendiente).
      try {
        await API.guardarConteo(sesion.items.map(aRegistro));
        await API.sincronizarPendientes();
        toast(API.modoDemo() ? 'Modo demo: no hay Sheet conectado.' : 'Enviado a Google Sheets ✓');
      } catch {
        toast('Sin conexión: se reintentará automáticamente.');
      }
      actualizarBadgePendientes();
    });
    document.getElementById('btn-nueva-sesion').addEventListener('click', () => {
      if (!confirm('¿Empezar un conteo nuevo? Se limpiará la lista actual (lo ya enviado queda en el Sheet).')) return;
      sesion = { fecha: hoy(), items: [] };
      guardarSesion();
      mostrar('conteo');
      toast('Conteo nuevo iniciado');
    });
  }

  function renderResumen() {
    const alm = sesion.items.filter(esAlmacen);
    const prov = sesion.items.filter(i => !esAlmacen(i));
    document.getElementById('resumen-almacen').innerHTML = bloqueResumen(alm, true);
    document.getElementById('resumen-proveedor').innerHTML = bloqueResumen(prov, false);
    conectarEdicionResumen();
    document.getElementById('resumen-vacio').hidden = sesion.items.length > 0;
    poblarScopePDF();
  }

  // Llena el selector "Generar PDF de:" según lo que haya en el conteo.
  function poblarScopePDF() {
    const sel = document.getElementById('pdf-scope');
    if (!sel) return;
    const prev = sel.value;
    const hayAlm = sesion.items.some(esAlmacen);
    const hayProv = sesion.items.some(i => !esAlmacen(i));
    const marcas = [...new Set(sesion.items.map(i => i.marca).filter(Boolean))].sort();

    const ops = [`<option value="todo">Todo el conteo</option>`];
    if (hayAlm) ops.push(`<option value="almacen">Solo almacén</option>`);
    if (hayProv) ops.push(`<option value="proveedor">Solo proveedor (compras)</option>`);
    marcas.forEach(m => ops.push(`<option value="marca:${esc(m)}">Solo ${esc(m)}</option>`));
    sel.innerHTML = ops.join('');
    // Conservar la elección previa si sigue disponible.
    if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
  }

  // Devuelve {items, titulo, etiqueta} según el filtro elegido.
  function filtrarParaPDF(scope) {
    if (scope === 'almacen') return { items: sesion.items.filter(esAlmacen), titulo: 'Solo almacén', etiqueta: 'Almacen' };
    if (scope === 'proveedor') return { items: sesion.items.filter(i => !esAlmacen(i)), titulo: 'Solo proveedor', etiqueta: 'Proveedor' };
    if (scope && scope.indexOf('marca:') === 0) {
      const marca = scope.slice(6);
      return { items: sesion.items.filter(i => i.marca === marca), titulo: marca, etiqueta: marca };
    }
    return { items: sesion.items.slice(), titulo: '', etiqueta: '' };
  }

  function bloqueResumen(items, conCajas) {
    if (!items.length) return `<p class="vacio">Sin productos.</p>`;
    const grupos = {};
    items.forEach(i => (grupos[i.marca || '—'] ??= []).push(i));
    return Object.keys(grupos).sort().map(marca => `
      <div class="grupo">
        <h4>${esc(marca)}</h4>
        ${grupos[marca].map(i => `
          <div class="res-fila" data-id="${i.id}">
            <div class="res-desc">
              <div class="res-nombre">${esc(i.nombre || i.categoria || i.codigo_barras || '—')}</div>
              <div class="res-sub">${esc([i.presentacion, i.categoria].filter(Boolean).join(' · '))}</div>
            </div>
            <label class="res-campo">Exist.
              <input type="number" inputmode="numeric" min="0" value="${i.existencia ?? 0}" data-campo="existencia">
            </label>
            ${conCajas ? `<label class="res-campo res-cajas">Cajas
              <input type="number" inputmode="numeric" min="0" value="${i.cajas_a_pedir === '' ? '' : (i.cajas_a_pedir ?? '')}" data-campo="cajas_a_pedir">
            </label>` : ''}
          </div>`).join('')}
      </div>`).join('');
  }

  function conectarEdicionResumen() {
    document.querySelectorAll('#screen-resumen .res-fila input').forEach(inp => {
      inp.addEventListener('change', () => {
        const id = inp.closest('.res-fila').dataset.id;
        const item = sesion.items.find(x => x.id === id);
        if (!item) return;
        const campo = inp.dataset.campo;
        const raw = inp.value.trim();
        item[campo] = raw === '' ? (campo === 'cajas_a_pedir' ? '' : 0) : (parseInt(raw, 10) || 0);
        guardarSesion();
        enviarRegistro(item);
      });
    });
  }

  // ---------------------------------------------------------------
  // Pantalla CATÁLOGO
  // ---------------------------------------------------------------
  function conectarCatalogo() {
    document.getElementById('filtro-marca').addEventListener('change', renderCatalogo);
    document.getElementById('filtro-categoria').addEventListener('change', renderCatalogo);
    document.getElementById('btn-agregar-catalogo').addEventListener('click', () => abrirCatalogoModal());
    document.getElementById('btn-cerrar-cat').addEventListener('click', cerrarCatalogoModal);
    document.getElementById('btn-cerrar-cat-bg').addEventListener('click', cerrarCatalogoModal);
    document.getElementById('cat-escanear').addEventListener('click', () => {
      Scanner.abrir(codigo => { document.getElementById('cat-codigo').value = codigo; });
    });
    document.getElementById('cat-marca').addEventListener('change', actualizarOrigenHint);
    document.getElementById('btn-guardar-catalogo').addEventListener('click', guardarEnCatalogo);
  }

  function abrirCatalogoModal(codigoInicial = '') {
    // Poblar marca
    const marcas = [...(window.CONFIG.MARCAS_ALMACEN || []), ...(window.CONFIG.MARCAS_PROVEEDOR || [])];
    document.getElementById('cat-marca').innerHTML =
      `<option value="">Elige marca…</option>` + marcas.map(m => `<option>${esc(m)}</option>`).join('');
    // Sugerencias de categoría (las que ya existen)
    const cats = [...new Set(catalogo.map(p => p.categoria).filter(Boolean))].sort();
    document.getElementById('cat-categorias-list').innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
    // Limpiar campos
    ['cat-codigo', 'cat-nombre', 'cat-categoria', 'cat-presentacion', 'cat-precio'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('cat-codigo').value = codigoInicial;
    document.getElementById('cat-origen-hint').hidden = true;
    document.getElementById('modal-catalogo').hidden = false;
  }

  function cerrarCatalogoModal() {
    document.getElementById('modal-catalogo').hidden = true;
  }

  function actualizarOrigenHint() {
    const marca = document.getElementById('cat-marca').value;
    const hint = document.getElementById('cat-origen-hint');
    if (!marca) { hint.hidden = true; return; }
    const esAlm = (window.CONFIG.MARCAS_ALMACEN || []).includes(marca);
    hint.hidden = false;
    hint.className = 'origen-hint ' + (esAlm ? 'origen-almacen' : 'origen-proveedor');
    hint.textContent = esAlm
      ? 'Origen: Almacén (se le pedirán cajas al contar)'
      : 'Origen: Proveedor (solo se reporta existencia)';
  }

  async function guardarEnCatalogo() {
    const codigo = document.getElementById('cat-codigo').value.trim();
    const marca = document.getElementById('cat-marca').value;
    const nombre = document.getElementById('cat-nombre').value.trim();
    if (!codigo) { toast('Escanea o escribe el código de barras.'); return; }
    if (!marca) { toast('Elige una marca.'); return; }

    const esAlm = (window.CONFIG.MARCAS_ALMACEN || []).includes(marca);
    const producto = {
      codigo_barras: codigo,
      nombre,
      marca,
      origen: esAlm ? 'Almacén' : 'Proveedor',
      categoria: document.getElementById('cat-categoria').value.trim(),
      presentacion: document.getElementById('cat-presentacion').value.trim(),
      precio: document.getElementById('cat-precio').value.trim()
    };

    const btn = document.getElementById('btn-guardar-catalogo');
    btn.disabled = true;
    toast('Guardando en el catálogo…');
    try {
      await API.agregarProducto(producto);
      await cargarCatalogo({ forzar: true });
      renderCatalogo();
      cerrarCatalogoModal();
      toast('Producto guardado en el catálogo ✓');
    } catch (err) {
      toast('No se pudo guardar: ' + (err.message || 'revisa tu conexión'));
    } finally {
      btn.disabled = false;
    }
  }

  function renderCatalogo() {
    // Poblar filtros
    const marcas = [...new Set(catalogo.map(p => p.marca).filter(Boolean))].sort();
    const cats = [...new Set(catalogo.map(p => p.categoria).filter(Boolean))].sort();
    poblarSelect('filtro-marca', marcas, 'Todas las marcas');
    poblarSelect('filtro-categoria', cats, 'Todas las categorías');

    const fMarca = document.getElementById('filtro-marca').value;
    const fCat = document.getElementById('filtro-categoria').value;
    const filas = catalogo.filter(p =>
      (!fMarca || p.marca === fMarca) && (!fCat || p.categoria === fCat));

    document.getElementById('catalogo-total').textContent = filas.length + ' productos';
    const tbody = document.getElementById('catalogo-body');
    if (!filas.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="vacio">Sin productos. Agrégalos en la pestaña "Catálogo" del Google Sheet.</td></tr>`;
      return;
    }
    tbody.innerHTML = filas.map(p => `
      <tr>
        <td><b>${esc(p.nombre || '—')}</b></td>
        <td><span class="pill ${esAlmacen(p) ? 'pill-rojo' : 'pill-gris'}">${esc(p.marca)}</span></td>
        <td>${esc(p.categoria)}</td>
        <td>${esc(p.presentacion)}</td>
        <td class="precio">${esc(fmtPrecio(p.precio))}</td>
        <td class="cod">${esc(p.codigo_barras)}</td>
      </tr>`).join('');
  }

  function poblarSelect(id, valores, etiquetaTodos) {
    const sel = document.getElementById(id);
    const actual = sel.value;
    sel.innerHTML = `<option value="">${etiquetaTodos}</option>` +
      valores.map(v => `<option ${v === actual ? 'selected' : ''}>${esc(v)}</option>`).join('');
  }

  // ---------------------------------------------------------------
  // Pantalla HISTORIAL (PDFs guardados en Drive)
  // ---------------------------------------------------------------
  let historialConectado = false;
  function conectarHistorial() {
    if (historialConectado) return;
    historialConectado = true;
    document.getElementById('btn-refrescar-historial').addEventListener('click', renderHistorial);
  }

  async function renderHistorial() {
    conectarHistorial();
    const grid = document.getElementById('historial-grid');
    const estado = document.getElementById('historial-estado');
    grid.innerHTML = '';
    estado.hidden = false;

    if (API.modoDemo()) {
      estado.textContent = 'Conecta tu Google Sheet para guardar y ver PDFs.';
      return;
    }

    estado.textContent = 'Cargando historial…';
    const archivos = await API.getHistorial();

    if (archivos === null) {
      estado.innerHTML = 'El historial aún no está activo. Falta <b>actualizar el Apps Script</b> a la versión nueva (ver la guía). En cuanto lo hagas, aquí aparecerán tus PDFs.';
      return;
    }
    if (!archivos.length) {
      estado.textContent = 'Aún no has guardado ningún PDF. Genera uno desde Resumen y aparecerá aquí.';
      return;
    }

    estado.hidden = true;
    grid.innerHTML = archivos.map(a => `
      <a class="hist-card" href="${esc(a.url)}" target="_blank" rel="noopener">
        <div class="hist-ic">▤</div>
        <div class="hist-fecha">${esc(fechaBonita(a.fecha))}${a.hora ? ' · ' + esc(a.hora) : ''}</div>
        <div class="hist-etiqueta">${esc(a.etiqueta ? a.etiqueta : 'Todo el conteo')}</div>
        <div class="hist-abrir">Abrir PDF</div>
      </a>`).join('');
  }

  // Cuenta cuántos PDFs hay en el historial (null si no está disponible).
  async function contarHistorial() {
    const arch = await API.getHistorial();
    return arch === null ? null : arch.length;
  }

  // "2026-09-02" -> "2 sep 2026"; si no hay fecha, usa el nombre.
  function fechaBonita(iso) {
    if (!iso) return 'Conteo';
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const p = iso.split('-');
    if (p.length !== 3) return iso;
    return parseInt(p[2], 10) + ' ' + (meses[parseInt(p[1], 10) - 1] || '') + ' ' + p[0];
  }

  // ---------------------------------------------------------------
  // Estado de red / pendientes
  // ---------------------------------------------------------------
  function conectarEstadoRed() {
    window.addEventListener('online', async () => {
      const n = await API.sincronizarPendientes();
      if (n) toast(n + ' registro(s) sincronizado(s)');
      actualizarBadgePendientes();
    });
    window.addEventListener('offline', actualizarBadgePendientes);
    actualizarBadgePendientes();
  }

  function actualizarBadgePendientes() {
    const n = API.pendientes();
    const badge = document.getElementById('badge-pendientes');
    if (n > 0) { badge.hidden = false; badge.textContent = n + ' sin enviar'; }
    else badge.hidden = true;
  }

  // ---------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------
  function esAlmacen(i) {
    if (!i) return false;
    if (i.origen) return String(i.origen).toLowerCase().startsWith('almac');
    return (window.CONFIG.MARCAS_ALMACEN || []).includes(i.marca);
  }

  function nuevoProductoDesdeCodigo(codigo) {
    return { id: uid(), codigo_barras: (codigo || '').trim(), nombre: '', marca: '', origen: '', categoria: '', presentacion: '' };
  }

  function aRegistro(i) {
    return {
      fecha: sesion.fecha,
      codigo_barras: i.codigo_barras,
      existencia: i.existencia,
      cajas_a_pedir: esAlmacen(i) ? (i.cajas_a_pedir === '' ? '' : i.cajas_a_pedir) : ''
    };
  }

  function cargarSesion() {
    try {
      const s = JSON.parse(localStorage.getItem(SESION));
      if (s && s.items) {
        // Si la sesión es de otro día, empezamos una nueva.
        if (s.fecha !== hoy()) return { fecha: hoy(), items: [] };
        return s;
      }
    } catch {}
    return { fecha: hoy(), items: [] };
  }
  function guardarSesion() {
    try { localStorage.setItem(SESION, JSON.stringify(sesion)); } catch {}
  }

  function hoy() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function uid() { return 'x' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }

  // Formatea el precio como moneda ($). Devuelve '' si no hay precio.
  function fmtPrecio(p) {
    if (p === '' || p == null) return '';
    const n = Number(String(p).replace(/[^0-9.\-]/g, ''));
    if (!isFinite(n)) return String(p); // si no es un número, muéstralo tal cual
    return '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function mostrarAvisoDemo() {
    const el = document.getElementById('aviso-demo');
    if (el) el.hidden = false;
  }

  function registrarSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
