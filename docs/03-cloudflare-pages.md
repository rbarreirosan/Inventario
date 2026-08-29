# Paso 3/4 — Publicar en Cloudflare Pages e instalar en el iPhone

Aquí pones la app "en línea" (con una dirección web propia) usando **Cloudflare
Pages**, que es gratis y no tiene el límite mensual de builds que tiene Netlify.
Luego la instalas en tu iPhone como si fuera una app normal.

No hace falta usar la línea de comandos: todo se hace desde la página web de
Cloudflare, conectándola a tu GitHub.

---

## 3.1 Crear la cuenta de Cloudflare

1. Entra a **https://dash.cloudflare.com/sign-up**.
2. Regístrate con tu correo (es gratis).
3. Confirma tu correo si te lo pide.

---

## 3.2 Conectar tu repositorio de GitHub

1. En el panel de Cloudflare, en el menú de la izquierda, busca
   **Workers y Pages** (o "Compute" → "Workers & Pages").
2. Haz clic en **Crear** (Create) → pestaña **Pages** → **Conectar a Git**.
3. Cloudflare te pedirá permiso para acceder a tu GitHub. Haz clic en
   **Conectar GitHub** y autoriza.
   - Puedes darle acceso solo al repositorio **Inventario** (recomendado) o a
     todos. Con solo Inventario basta.
4. En la lista de repositorios, elige **Inventario** y haz clic en **Comenzar
   configuración** (Begin setup).

---

## 3.3 Configuración del build (muy importante)

Como esta app es "HTML puro" (no necesita compilarse), la configuración es
mínima. Llena así:

- **Nombre del proyecto**: `inventario` (o el que quieras; será parte de la URL).
- **Rama de producción (Production branch)**: `main`
- **Framework preset (Preajuste)**: **None** (Ninguno).
- **Build command (Comando de compilación)**: **déjalo VACÍO**.
- **Build output directory (Directorio de salida)**: escribe un punto y una
  diagonal, o simplemente déjalo en la raíz:

  ```
  /
  ```

  (Si no acepta `/`, deja el valor por defecto o escribe `./`.)

Luego haz clic en **Guardar e implementar** (Save and Deploy).

Cloudflare tardará unos segundos y te dará una dirección tipo:

```
https://inventario.pages.dev
```

¡Esa es tu app en línea! Ábrela en el navegador para probarla.

> 🔁 **Cada vez que subas un cambio a GitHub** (rama `main`), Cloudflare vuelve
> a publicar la app solo. No tienes que hacer nada más. Y no hay límite mensual
> de builds que te preocupe al inicio.

---

## 3.4 Instalar la app en el iPhone (PWA)

La app es una **PWA**: se instala desde el navegador, sin App Store.

1. En tu iPhone, abre **Safari** (tiene que ser Safari, no Chrome) y entra a tu
   dirección, por ejemplo `https://inventario.pages.dev`.
2. Toca el botón **Compartir** (el cuadro con la flecha hacia arriba, abajo en
   el centro).
3. Desliza hacia abajo y toca **Agregar a inicio** (Add to Home Screen).
4. Toca **Agregar** arriba a la derecha.

Ahora tienes el ícono de **Inventario** en tu pantalla de inicio. Al abrirlo se
ve a pantalla completa, como una app normal.

> 📷 **Permiso de cámara:** la primera vez que toques **Escanear**, el iPhone te
> preguntará si permites la cámara. Toca **Permitir**. (La cámara solo funciona
> en direcciones `https://`, y `pages.dev` ya es `https`, así que todo bien.)

---

## 3.5 Cuando actualices la app

Cada vez que cambies algo (tú o con ayuda), el cambio llega a GitHub y
Cloudflare vuelve a publicar en 1–2 minutos.

En el iPhone, para ver la versión nueva puede que tengas que **cerrar y volver a
abrir** la app instalada. Si guardaste una versión "offline" vieja, cerrar la
app y reabrirla soluciona el 99% de los casos.

> Nota técnica (por si acaso): la app usa un "service worker" con una versión
> (`inventario-v1` en el archivo `sw.js`). Si algún día un cambio no aparece,
> subir ese número (a `inventario-v2`, etc.) obliga a todos los teléfonos a
> descargar la versión nueva.

---

## ✅ Listo

- Paso 1: Google Sheet con pestañas **Catálogo** y **Conteos**. ✔️
- Paso 2: Apps Script publicado y su URL pegada en `js/config.js`. ✔️
- Paso 3/4: App publicada en Cloudflare Pages e instalada en el iPhone. ✔️

Cada lunes: abre la app, escanea, captura, y al final **Resumen → Generar PDF**
para enviarlo.
