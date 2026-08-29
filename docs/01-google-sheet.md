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

2. En la **fila 1** (la primera), escribe estos 5 títulos, uno en cada columna
   (columnas A, B, C, D, E):

   | A | B | C | D | E |
   |---|---|---|---|---|
   | codigo_barras | marca | origen | categoria | presentacion |

   👉 Escríbelos **sin acentos ni espacios** tal como están arriba
   (`codigo_barras`, `categoria`, `presentacion`). Así la app los entiende bien.

3. A partir de la **fila 2**, empieza a capturar tus productos. Ejemplo:

   | codigo_barras | marca | origen | categoria | presentacion |
   |---------------|----------|-----------|-------------|-------|
   | 7501234500011 | Eurolub | Almacén | Aceite | 1 L |
   | 7501234500059 | Chevron | Proveedor | Aceite | 1 L |
   | 7501234500097 | Prestone | Proveedor | Refrigerante | 1 L |

### Qué poner en cada columna

- **codigo_barras**: el número que aparece bajo el código de barras del producto.
  (Puedes escanearlo con la app más adelante para verlo, o teclearlo a mano.)
- **marca**: la marca del producto.
- **origen**: se llena según la marca. Usa esta tabla fija:

  | Origen | Marcas |
  |-----------|--------|
  | **Almacén** | Eurolub, Gamez |
  | **Proveedor** | Chevron, Repsol, Valvoline, Castrol, Prestone, Bardhal |

- **categoria**: Aceite, Refrigerante o Aditivo (o la que uses).
- **presentacion**: el tamaño/envase, por ejemplo `1 L`, `4 L`, `250 ml`.

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
