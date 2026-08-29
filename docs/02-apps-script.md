# Paso 2 — Publicar el Apps Script (el "puente" entre la app y el Sheet)

El Apps Script es un pequeño programa que vive **dentro** de tu Google Sheet.
Su trabajo es doble:

- Cuando la app pide el catálogo → el script se lo entrega.
- Cuando la app manda un conteo → el script lo escribe en la pestaña "Conteos".

Ya te dejé el programa escrito en el archivo `apps-script/Codigo.gs`.
Tú solo tienes que **copiarlo y publicarlo**. No necesitas entenderlo.

---

## 2.1 Abrir el editor de Apps Script

1. Abre tu Google Sheet (el del Paso 1).
2. En el menú de arriba, haz clic en **Extensiones** → **Apps Script**.
3. Se abre una pestaña nueva con un editor de código. Verás un archivo llamado
   `Código.gs` con algo como `function myFunction() { }`.

---

## 2.2 Pegar el código

1. Selecciona **todo** lo que haya en ese editor (haz clic dentro y presiona
   `Ctrl+A`, o `Cmd+A` en Mac) y bórralo.
2. Abre el archivo **`apps-script/Codigo.gs`** de este proyecto (en GitHub o en
   tu computadora), selecciona **todo** su contenido y **cópialo**.
3. **Pégalo** en el editor de Apps Script (donde borraste lo anterior).
4. Haz clic en el ícono de **guardar** (💾, arriba) o presiona `Ctrl+S`.

> El proyecto se puede llamar como quieras. Si te pide un nombre, escribe
> "Inventario API".

---

## 2.3 Publicar como "Aplicación web"

1. Arriba a la derecha, haz clic en el botón azul **Implementar** →
   **Nueva implementación**.
2. Haz clic en el ícono de engranaje ⚙️ (junto a "Seleccionar tipo") y elige
   **Aplicación web**.
3. Llena así:
   - **Descripción**: `Inventario API` (o lo que quieras).
   - **Ejecutar como**: **Yo (tu correo)**.
   - **Quién tiene acceso**: **Cualquier usuario**.
     *(Esto permite que la app llame al script. No expone tu Sheet: solo
     entrega el catálogo y recibe conteos a través del script.)*
4. Haz clic en **Implementar**.
5. La primera vez, Google te pedirá **autorizar**:
   - Clic en **Autorizar acceso**.
   - Elige tu cuenta de Google.
   - Puede aparecer una pantalla que dice *"Google no ha verificado esta
     aplicación"*. Haz clic en **Configuración avanzada** → **Ir a Inventario
     API (no seguro)**. Es seguro: es **tu propio** script.
   - Clic en **Permitir**.

---

## 2.4 Copiar la URL (¡esto es lo importante!)

Al terminar, Google te muestra una **URL de la aplicación web** que termina en
**`/exec`**. Se ve más o menos así:

```
https://script.google.com/macros/s/AKfycb....(muy larga)..../exec
```

1. Haz clic en **Copiar**.
2. Guárdala; la vas a pegar en la app en el siguiente sub-paso.

---

## 2.5 Pegar la URL en la app

1. En este proyecto, abre el archivo **`js/config.js`**.
2. Busca la línea que dice:

   ```js
   API_URL: '',
   ```

3. Pega tu URL **entre las comillas**, así:

   ```js
   API_URL: 'https://script.google.com/macros/s/AKfycb..../exec',
   ```

4. Guarda el cambio.
   - Si editas en GitHub directamente: usa el lápiz ✏️ → pega → **Commit changes**.
   - Si más adelante trabajas en tu computadora: guarda y sube el cambio.

Cuando la app tenga esta URL, deja el "modo demo" y empieza a usar tu Sheet real:
el catálogo saldrá de tu pestaña "Catálogo" y cada conteo se guardará en "Conteos".

---

## 2.6 Probar que funciona (opcional pero recomendado)

Pega tu URL `/exec` directamente en el navegador y presiona Enter.
Deberías ver un texto tipo:

```json
{"ok":true,"catalogo":[ ... tus productos ... ],"total":3}
```

Si ves eso, ¡el puente funciona! 🎉

---

## ⚠️ Muy importante al hacer cambios después

Si en el futuro cambias el código del Apps Script, **la URL vieja NO se
actualiza sola**. Debes:

- **Implementar** → **Administrar implementaciones** → editar (lápiz) →
  en "Versión" elige **Nueva versión** → **Implementar**.

Así la URL sigue siendo la misma pero con tu código nuevo. (Si en cambio creas
una "Nueva implementación" te dará una URL distinta y tendrías que actualizar
`js/config.js` otra vez.)

Cuando termines, pasa al **Paso 3/4** (`docs/03-cloudflare-pages.md`) para poner
la app en línea e instalarla en tu iPhone.
