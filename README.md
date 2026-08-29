# Inventario ECOM / Prestone

App interna para el **conteo semanal de existencias** de productos automotrices
(aceites, refrigerantes, aditivos) en el taller.

Cada lunes: se escanea el código de barras de cada producto (o se agrega manual),
se captura la existencia física y, según la marca, se indica cuántas cajas pedir.
Al final se genera un **PDF** para enviar.

---

## Cómo está armado (sin tecnicismos)

```
  iPhone (app instalada)  ─┬─►  Escanea / captura / genera PDF   (todo en el teléfono)
                           │
                           └─►  Google Sheet   (guarda el catálogo y los conteos)
                                   ▲
                                   │  a través de un "puente" (Apps Script)
```

- **Frontend**: HTML + JavaScript puro (sin frameworks pesados). Es una **PWA**,
  o sea, se instala en el iPhone desde Safari.
- **Base de datos**: un **Google Sheet** con dos pestañas (`Catálogo`, `Conteos`).
- **Puente**: un **Google Apps Script** publicado como "aplicación web" que
  conecta la app con el Sheet.
- **PDF**: se genera en el propio teléfono con jsPDF (no necesita servidor).
- **Hosting**: **Cloudflare Pages** (gratis, sin límite mensual de builds).

---

## 📄 Guías paso a paso (empieza aquí)

Están pensadas para seguirse en orden, explicadas simple:

1. **[docs/01-google-sheet.md](docs/01-google-sheet.md)** — crear el Google Sheet.
2. **[docs/02-apps-script.md](docs/02-apps-script.md)** — publicar el Apps Script
   y pegar su URL en la app.
3. **[docs/03-cloudflare-pages.md](docs/03-cloudflare-pages.md)** — publicar en
   Cloudflare Pages e instalar en el iPhone.

> Mientras no pegues la URL del Apps Script en `js/config.js`, la app funciona en
> **modo demo** con un catálogo de ejemplo (útil para probar el diseño).

---

## Estructura del proyecto

```
/index.html              Pantalla única de la app (todas las vistas)
/manifest.webmanifest    Hace la app instalable (PWA)
/sw.js                   Service worker (abre rápido y funciona sin conexión)
/css/
  styles.css             Estilos. Los colores/tipografía están arriba como "tokens".
/js/
  config.js              ⚙️ AQUÍ pegas la URL del Apps Script y las marcas.
  api.js                 Habla con el Apps Script (getCatalogo / guardarConteo).
  scanner.js             Cámara + lectura de código de barras (html5-qrcode).
  pdf.js                 Genera el PDF (jsPDF).
  app.js                 Lógica principal y navegación entre pantallas.
/icons/                  Íconos de la app instalada.
/apps-script/
  Codigo.gs              Código para pegar en Apps Script (ver guía 2).
/docs/                   Las guías paso a paso.
```

---

## Las 4 pantallas

1. **Conteo** (principal): botón *Escanear*, *+ Agregar manual*, contador de
   progreso y lista de últimos capturados. Abajo, navegación
   *Conteo / Resumen / Catálogo*.
2. **Captura**: marca y categoría del producto, un **banner rojo** si es de
   **Almacén** (con campo *Cajas a pedir*) o **gris** si es de **Proveedor**
   (solo existencia). Existencia con botones **− / +** y teclado numérico al
   tocar el número.
3. **Resumen**: dos bloques — *Para pedir a almacén* y *Reporte a proveedor* —
   agrupados por marca y editables. Botón **Generar PDF**.
4. **Catálogo**: tabla con filtros por marca y categoría.

---

## Reglas de negocio

- El **origen** (Almacén / Proveedor) se **deriva de la marca**, no se captura.
  - **Almacén**: Eurolub, Gamez.
  - **Proveedor**: Chevron, Repsol, Valvoline, Castrol, Prestone, Bardhal.
- Solo los productos de **Almacén** muestran el campo **Cajas a pedir**.
- El **PDF** separa claramente ambos bloques (almacén vs. proveedor),
  agrupado por marca.

---

## Detalles útiles

- **Funciona sin conexión**: el catálogo se guarda en el teléfono y los conteos
  que no se puedan enviar quedan en una cola; se reintentan solos al volver la
  señal (verás un aviso *"X sin enviar"*).
- **La sesión no se pierde**: si cierras la app a media captura, al reabrir sigue
  ahí (se reinicia sola cada día nuevo).
- **Cambiar colores/tipografía**: edita los *tokens* al inicio de
  `css/styles.css` (por ejemplo `--rojo`, `--gris-prov`, `--font`).
