# Paso 1 — Crear el Google Sheet (tu "base de datos")

Piensa en el Google Sheet como el cuaderno donde vive todo: el listado de
productos (Catálogo) y cada conteo que haces (Conteos). La app lee y escribe
en ese cuaderno.

Necesitas crear **una sola hoja de cálculo** con **dos pestañas** adentro.

---

## 1.1 Crear la hoja

1. Entra a **https://sheets.google.com** con tu cuenta de Google.
2. Haz clic en el rectángulo con el **+** ("En blanco") para crear una hoja nueva.
3. Arriba a la izquierda, donde dice *"Hoja de cálculo sin título"*, haz clic y
   escribe un nombre, por ejemplo: **Inventario ECOM Prestone**.

---

## 1.2 Crear la pestaña "Catálogo"

Abajo del todo verás una pestaña que dice **"Hoja 1"**.

1. Haz **doble clic** sobre "Hoja 1" y cámbiale el nombre a exactamente:

   ```
   Catálogo
   ```

   ⚠️ Respeta el acento en la **á**. Debe decir `Catálogo`, no `Catalogo`.

2. En la **fila 1** (la primera), escribe estos 7 títulos, uno en cada columna
   (columnas A, B, C, D, E, F, G):

   | A | B | C | D | E | F | G |
   |---|---|---|---|---|---|---|
   | codigo_barras | nombre | marca | origen | categoria | presentacion | precio |

   👉 Escríbelos **sin acentos ni espacios** tal como están arriba
   (`codigo_barras`, `categoria`, `presentacion`). Así la app los entiende bien.

   > 💡 El orden de las columnas **no importa**: la app las reconoce por su
   > nombre de título. Si ya tenías columnas creadas, solo agrega las de
   > **`nombre`** y **`precio`** donde quieras.

   > 💵 La columna **`precio`** es **opcional**. Se ve dentro de la app (en el
   > Catálogo y al capturar), pero **NUNCA aparece en el PDF**: el PDF solo
   > lleva los productos y sus cantidades. Si no quieres manejar precios, puedes
   > dejar esa columna vacía o no crearla.

3. A partir de la **fila 2**, empieza a capturar tus productos. Ejemplo:

   | codigo_barras | nombre | marca | origen | categoria | presentacion | precio |
   |---------------|--------|----------|-----------|-------------|-------|-------|
   | 4025377226057 | 0W-20 Super Eco | Eurolub | Almacén | Aceite | 5 L | 189.00 |
   | 7501234500059 | Supreme 20W-50 | Chevron | Proveedor | Aceite | 1 L | 165.00 |
   | 7501234500097 | Anticongelante 50/50 | Prestone | Proveedor | Refrigerante | 1 L | 210.00 |

### Qué poner en cada columna

- **codigo_barras**: el número que aparece bajo el código de barras del producto.
  (Puedes escanearlo con la app más adelante para verlo, o teclearlo a mano.)
- **nombre**: el nombre del producto para identificarlo de un vistazo, por
  ejemplo `0W-20 Super Eco`. Es lo que verás grande en la app al capturar.
- **marca**: la marca del producto.
- **origen**: se llena según la marca. Usa esta tabla fija:

  | Origen | Marcas |
  |-----------|--------|
  | **Almacén** | Eurolub, Gamez |
  | **Proveedor** | Chevron, Repsol, Valvoline, Castrol, Prestone, Bardhal |

- **categoria**: Aceite, Refrigerante o Aditivo (o la que uses).
- **presentacion**: el tamaño/envase, por ejemplo `1 L`, `4 L`, `250 ml`.
- **precio** (opcional): el precio del producto, por ejemplo `189.00` (solo el
  número, sin el signo `$`). Se ve en la app pero **no** sale en el PDF.

> 💡 **Regla importante:** el *origen* siempre depende de la *marca*, nunca del
> producto individual. Eurolub y Gamez son siempre **Almacén**; las demás son
> siempre **Proveedor**. La app usa esto para decidir si te pide "cuántas cajas
> pedir" (solo para Almacén).

---

## 1.3 Crear la pestaña "Conteos"

Aquí la app irá guardando automáticamente cada producto que cuentes.
Tú **no** escribes aquí a mano; solo la creas vacía con sus títulos.

1. Abajo, junto a la pestaña "Catálogo", haz clic en el **+** para crear otra
   pestaña.
2. Cámbiale el nombre (doble clic) a exactamente:

   ```
   Conteos
   ```

3. En la **fila 1**, escribe estos 4 títulos:

   | A | B | C | D |
   |---|---|---|---|
   | fecha | codigo_barras | existencia | cajas_a_pedir |

   Deja el resto de la pestaña vacío. La app la va llenando sola.

---

## ✅ Resultado

Debes tener **una** hoja de cálculo con **dos pestañas** abajo:

```
[ Catálogo ]  [ Conteos ]
```

Cuando lo tengas así, pasa al **Paso 2** (`docs/02-apps-script.md`) para
conectar la app con esta hoja.
