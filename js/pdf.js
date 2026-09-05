/**
 * pdf.js — genera el PDF del conteo en el propio teléfono (sin servidor).
 *
 * Usa jsPDF (cargado en index.html desde un CDN).
 * El PDF separa claramente dos bloques:
 *    1) "Para pedir a almacén"  -> con columna Cajas a pedir
 *    2) "Reporte a proveedor"   -> solo existencias
 * Ambos agrupados por marca.
 *
 * Uso:
 *   PDFReporte.generar({ fecha, items });
 *   donde items = [{codigo_barras, marca, origen, categoria, presentacion, existencia, cajas_a_pedir}, ...]
 */
const PDFReporte = (() => {

  const COLORES = {
    rojo:    [201, 42, 42],   // almacén
    gris:    [90, 96, 104],   // proveedor
    tinta:   [24, 27, 31],
    suave:   [120, 126, 134],
    lineaBg: [242, 243, 245]
  };

  // titulo = texto opcional que describe el filtro (ej. "Eurolub", "Solo almacén").
  function generar({ fecha, items, titulo }) {
    if (typeof window.jspdf === 'undefined') {
      alert('No se pudo cargar el generador de PDF. Revisa tu conexión.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const margen = 40;
    const anchoPag = doc.internal.pageSize.getWidth();
    let y = margen;

    // --- Encabezado del documento ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...COLORES.tinta);
    doc.text('Conteo de existencias', margen, y);
    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...COLORES.suave);
    doc.text((window.CONFIG?.TALLER_NOMBRE || 'Inventario') + '  ·  ' + fecha, margen, y);
    y += 16;
    // Subtítulo con el filtro elegido (si aplica).
    if (titulo) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...COLORES.rojo);
      doc.text('Reporte: ' + titulo, margen, y);
      y += 16;
    }
    y += 8;

    const almacen   = items.filter(i => esAlmacen(i));
    const proveedor = items.filter(i => !esAlmacen(i));

    // --- Bloque 1: Almacén (con cajas a pedir) ---
    // Solo se muestra la sección si tiene productos (así un PDF filtrado
    // no arrastra secciones vacías).
    if (almacen.length) {
      y = seccion(doc, 'Para pedir a almacén', COLORES.rojo, y, margen, anchoPag);
      y = tabla(doc, agruparPorMarca(almacen), y, margen, anchoPag, true);
      y += 14;
    }

    // --- Bloque 2: Proveedor (solo existencias) ---
    if (proveedor.length) {
      y = asegurarEspacio(doc, y, margen, 80);
      y = seccion(doc, 'Reporte a proveedor', COLORES.gris, y, margen, anchoPag);
      y = tabla(doc, agruparPorMarca(proveedor), y, margen, anchoPag, false);
    }

    piePaginas(doc, margen, anchoPag);

    const suf = titulo ? '-' + titulo.replace(/[^A-Za-z0-9]+/g, '') : '';
    const nombre = 'conteo-' + fecha + suf + '.pdf';
    doc.save(nombre); // descarga/comparte en el teléfono

    // Devolvemos el PDF en base64 para poder guardar una copia en Drive.
    try {
      return doc.output('datauristring').split(',')[1];
    } catch {
      return '';
    }
  }

  function esAlmacen(i) {
    if (i.origen) return String(i.origen).toLowerCase().startsWith('almac');
    return (window.CONFIG?.MARCAS_ALMACEN || []).includes(i.marca);
  }

  function agruparPorMarca(lista) {
    const mapa = {};
    lista.forEach(i => { (mapa[i.marca || '—'] ??= []).push(i); });
    return Object.keys(mapa).sort().map(marca => ({ marca, items: mapa[marca] }));
  }

  function seccion(doc, titulo, color, y, margen, anchoPag) {
    doc.setFillColor(...color);
    doc.roundedRect(margen, y, anchoPag - margen * 2, 26, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(titulo.toUpperCase(), margen + 10, y + 17);
    return y + 26 + 10;
  }

  function tabla(doc, grupos, y, margen, anchoPag, conCajas) {
    const x0 = margen;
    const ancho = anchoPag - margen * 2;
    // Columnas: Producto (presentación) | Categoría | Existencia | (Cajas)
    const colExist = x0 + ancho - (conCajas ? 150 : 70);
    const colCajas = x0 + ancho - 60;

    grupos.forEach(g => {
      y = asegurarEspacio(doc, y, margen, 40);
      // Sub-encabezado de marca
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...COLORES.tinta);
      doc.text(g.marca, x0, y);
      // encabezados de columna
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORES.suave);
      doc.text('EXIST.', colExist, y);
      if (conCajas) doc.text('CAJAS', colCajas, y);
      y += 6;
      doc.setDrawColor(...COLORES.lineaBg);
      doc.line(x0, y, x0 + ancho, y);
      y += 12;

      g.items.forEach(i => {
        y = asegurarEspacio(doc, y, margen, 26);
        // Nombre del producto (línea principal)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...COLORES.tinta);
        const nombre = i.nombre || [i.categoria, i.presentacion].filter(Boolean).join(' · ') || i.codigo_barras || '—';
        doc.text(String(nombre), x0, y, { maxWidth: colExist - x0 - 10 });

        doc.setFont('helvetica', 'bold');
        doc.text(String(i.existencia ?? ''), colExist, y);
        if (conCajas) {
          const c = i.cajas_a_pedir;
          doc.setTextColor(...(Number(c) > 0 ? COLORES.rojo : COLORES.suave));
          doc.text(c === '' || c == null ? '—' : String(c), colCajas, y);
          doc.setTextColor(...COLORES.tinta);
        }

        // Clave interna (SAE): renglón propio, en negrita, para copiar/pegar.
        if (i.clave) {
          y += 12;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(...COLORES.rojo);
          doc.text('Clave SAE: ' + String(i.clave), x0, y);
        }

        // Subtítulo (presentación · categoría) si hay nombre
        if (i.nombre) {
          const sub = [i.presentacion, i.categoria].filter(Boolean).join(' · ');
          if (sub) {
            y += 11;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...COLORES.suave);
            doc.text(sub, x0, y);
          }
        }
        y += 16;
      });
      y += 8;
    });
    return y;
  }

  function vacio(doc, texto, y, margen) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...COLORES.suave);
    doc.text(texto, margen, y + 6);
    return y + 20;
  }

  function asegurarEspacio(doc, y, margen, necesario) {
    const alto = doc.internal.pageSize.getHeight();
    if (y + necesario > alto - margen) {
      doc.addPage();
      return margen;
    }
    return y;
  }

  function piePaginas(doc, margen, anchoPag) {
    const total = doc.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      const alto = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORES.suave);
      doc.text('Generado con Inventario  ·  página ' + p + ' de ' + total,
        anchoPag - margen, alto - 20, { align: 'right' });
    }
  }

  return { generar };
})();
