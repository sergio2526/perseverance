# Plan: Paisaje de Marte con Vite + Three.js

## Contexto
La carpeta `perseverancia` solo tiene `CLAUDE.md` y `.git`. El objetivo es una escena de Marte con calidad de película, visible en vivo en el navegador de Cursor:
- dunas y rocas
- cielo color caramelo con polvo
- sol de tarde con luz cálida y sombras suaves
- las dos lunas, Fobos y Deimos

Debe verse algo en menos de 2 minutos tras aprobar el plan; después se mejora. Habrá un script `npm run check`: Playwright con el Chrome instalado, en modo invisible y sin descargar navegadores. Guarda una captura y lista los errores de consola. Máximo 3 rondas de revisión.

Entorno: Node 26.11.1, npm 11.20.0, `/Applications/Google Chrome.app` disponible.

## Paso 1: Primer render rápido (menos de 2 minutos)
1. Crear los archivos del proyecto a mano en lugar de `npm create vite`, que es interactivo y la carpeta no está vacía:
   - `package.json` (type module; scripts `dev`, `build`, `check`)
   - `index.html`
   - `tsconfig.json` (estricto)
   - `src/main.ts`
   - `.gitignore` (node_modules, dist, screenshots)
2. Ejecutar `npm install three vite typescript @types/three` y `npm install -D playwright-core`. `playwright-core` nunca descarga navegadores.
3. Arrancar `npx vite --port 5173 --host` en segundo plano y abrir `http://localhost:5173` en el navegador de Cursor.
4. La primera versión de `main.ts` ya muestra algo: plano desplazado color arena, fondo caramelo con niebla, sol direccional y dos lunas pequeñas.

## Paso 2: Escena cinematográfica (módulos en `src/world/`)
- **`Terrain.ts`**
  - Plano de 600×600 m con unos 256² segmentos.
  - Altura con ruido por capas (función de ruido propia, sin dependencias extra).
  - Crestas de dunas con `1 - |ruido|` orientadas según el viento.
  - Colores por vértice que mezclan óxido, ocre y basalto oscuro según pendiente y altura.
  - `MeshStandardMaterial`, rugosidad 0.95; recibe sombras.
- **`Rocks.ts`**
  - Unas 400 rocas en un `InstancedMesh` con `IcosahedronGeometry` deformada.
  - Escala y rotación aleatorias; apoyadas sobre el terreno con la misma función de altura.
  - Proyectan y reciben sombras.
- **`Sky.ts`**
  - Esfera invertida grande con shader de degradado: caramelo en el horizonte, marrón rosado arriba y halo azulado alrededor del sol (como los atardeceres reales de Marte).
  - `FogExp2` en tono caramelo polvoriento.
- **`Lighting.ts`**
  - `DirectionalLight` cálida y baja (unos 8° de elevación, color #ffb070).
  - `PCFSoftShadowMap`, mapa de sombras de 4096, frustum ajustado y radio de sombra para suavizarlas.
  - `HemisphereLight` tenue (cielo caramelo, suelo oscuro).
  - Disco solar visible con un sprite y resplandor.
- **`Moons.ts`**
  - Fobos: más grande, irregular, gris marrón; esfera deformada.
  - Deimos: más pequeña y lejana.
  - Ambas iluminadas por el sol y colocadas en el cielo.
- **`Dust.ts`**
  - Unas 3000 partículas aditivas, suaves y color caramelo, que se desplazan despacio con el viento.
- **Renderer**
  - Tone mapping ACES, salida SRGB, exposición de alrededor de 1.1.
  - `EffectComposer` con `UnrealBloomPass` sutil (brillo del sol) y viñeta.
- **Cámara**
  - Ángulo bajo y cinematográfico mirando hacia el sol.
  - `OrbitControls` con amortiguación y una deriva automática lenta.

## Paso 3: `npm run check` (`scripts/check.mjs`)
- `playwright-core`: `chromium.launch({ channel: 'chrome', headless: true })` usa el Chrome instalado.
- Reutiliza `http://localhost:5173` si ya responde; si no, arranca Vite con su API `createServer`.
- Recoge los `console` error/warning y los `pageerror`, y luego abre la página.
- Espera la bandera `window.__sceneReady = true`, que `main.ts` marca tras los primeros frames, más unos 1.5 s.
- Guarda `screenshots/check.png` a 1280×720 e imprime los errores.
- Sale con código 1 si hay errores.
- Usa flags de WebGL para que Chrome invisible renderice (`--use-angle=swiftshader`, `--enable-unsafe-swiftshader`).

## Paso 4: Ciclo de revisión (máximo 3 rondas)
Tras cada mejora grande:
1. Ejecutar `npm run check`.
2. Mirar `screenshots/check.png`.
3. Corregir los errores y lo que falte en la imagen.

Lista de verificación de la captura:
- dunas
- rocas
- cielo caramelo
- polvo
- sol cálido
- sombras suaves
- dos lunas

Listo cuando no haya errores de consola y todo aparezca en la captura.

## Archivos
- `package.json`, `index.html`, `tsconfig.json`, `.gitignore`
- `src/main.ts`, `src/style.css`
- `src/world/{Terrain,Rocks,Sky,Lighting,Moons,Dust}.ts`, `src/utils/noise.ts`
- `scripts/check.mjs`

Sigue la estructura de `CLAUDE.md` (Rapier y el rover llegan en fases posteriores).

## Verificación
- El servidor de Vite queda corriendo en segundo plano; se ve en `http://localhost:5173` desde Cursor.
- `npm run check` termina con código 0 y la captura muestra todo lo de la lista.
- `npx tsc --noEmit` pasa sin errores.
