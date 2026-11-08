# Simulación 3D del Rover Perseverance (NASA)

Simulación interactiva en el navegador del rover Perseverance explorando el cráter Jezero en Marte.

## Stack

| Área | Herramienta | Motivo |
|---|---|---|
| Render 3D | Three.js | Estándar web, gran ecosistema |
| Build | Vite + TypeScript | Arranque rápido, tipado |
| Física | Rapier (`@dimforge/rapier3d-compat`) | Rápida, soporta joints y vehículos |
| UI / HUD | HTML + CSS (o lil-gui para debug) | Simple |
| Modelos | glTF/GLB | Modelo oficial NASA 3D Resources (dominio público) |
| Terreno | Heightmap (DEM de Jezero, HiRISE/MOLA) | Realismo topográfico |
| Tests | Vitest | Lógica de movimiento y física |

## Estado actual (2026-11-07)

Hecho:
- **Escena de Marte:**
  - dunas procedurales y unas 700 rocas instanciadas
  - cielo caramelo con halo solar
  - polvo en suspensión
  - sol de tarde con sombras suaves
  - Fobos y Deimos
  - post-procesado: bloom, viñeta y ACES
- **Rover oficial de la NASA** (`public/models/perseverance.glb`, comprimido con Draco):
  - escalado a 3 m y apoyado en el terreno, inclinándose con la pendiente
  - manejo con WASD o flechas
  - huellas con dibujo de grousers
  - cámara de seguimiento orbitable
- **Colisión con rocas grandes** (escala ≥ 0.4) mediante círculos en XZ; las pequeñas se pueden pisar.
- **`npm run check`**: Playwright con el Chrome del sistema en modo invisible. Hace:
  - prueba de manejo de 12 m
  - prueba de colisión contra una roca
  - captura en `screenshots/check.png`
  - lista de errores de consola

Pendiente: Rapier, HUD, cámaras a bordo, brazo robótico, misión e Ingenuity (ver fases).

Piezas del modelo que son cámaras (para las cámaras a bordo):
`Mastcam_Z_cams`, `NavCams`, `hazcams_front`, `hazcams_rear`, `WATSON`, `Up_Look_Camera`, `Down_Look_Camera`, `lens`.

## Comandos

```bash
npm install
npm run dev      # servidor en http://localhost:5173
npm run check    # captura + errores de consola + pruebas de manejo y colisión (correr tras cada cambio grande)
npm run build    # tsc + build de producción
npx tsc --noEmit # verificación de tipos
```

## Notas técnicas (versiones actuales)

- **Three.js r187:**
  - `PCFSoftShadowMap` fue eliminado; se usa `PCFShadowMap` con `shadow.radius`.
  - `THREE.Clock` está obsoleto; se usa `THREE.Timer`.
- **Draco:** el GLB de la NASA usa compresión Draco. El decodificador está copiado en `public/draco/`, así que no depende de una CDN.
- **Ruedas:** en el modelo las 6 ruedas son una sola malla (`Wheels_objs`), así que no pueden girar por separado.
- **Velocidad:** la del rover está acelerada a 2.5 m/s; la real es de unos 4.2 cm/s.
- **`npm run check`:**
  - Conduce por distancia y no por tiempo, porque el Chrome invisible (SwiftShader) va a unos 20 FPS.
  - Ignora los avisos `GL Driver Message`, que vienen del navegador y no de la app.
  - Usa `window.__debug` (odómetro, huellas, FPS, apuntar a roca, hueco con la roca) y `window.__sceneReady`.

## Estructura del proyecto

```
perseverancia/
├── CLAUDE.md
├── plan.md                  # plan del paisaje de Marte
├── index.html
├── package.json
├── scripts/check.mjs        # npm run check
├── public/
│   ├── draco/               # decodificador Draco
│   ├── models/perseverance.glb
│   ├── textures/        # suelo marciano, normal map, cielo
│   └── terrain/jezero_heightmap.png
└── src/
    ├── main.ts              # punto de entrada, bucle principal
    ├── core/
    │   ├── Engine.ts        # renderer, escena, loop con delta time fijo
    │   ├── Input.ts         # teclado / gamepad
    │   └── Loader.ts        # carga de assets con progreso
    ├── world/
    │   ├── Terrain.ts       # malla + collider desde heightmap
    │   ├── Sky.ts           # cielo butterscotch, sol, polvo
    │   ├── Lighting.ts      # luz solar + ambiente
    │   ├── Rocks.ts         # rocas instanciadas (InstancedMesh) + rockColliders
    │   ├── Moons.ts         # Fobos y Deimos
    │   └── Dust.ts          # partículas de polvo
    ├── rover/
    │   ├── Rover.ts         # carga del GLB, conducción, apoyo en terreno, colisiones
    │   ├── Tracks.ts        # huellas (InstancedMesh en búfer circular)
    │   ├── Suspension.ts    # rocker-bogie
    │   ├── Drive.ts         # control de ruedas y dirección
    │   ├── RoboticArm.ts    # brazo con cinemática inversa
    │   └── Mast.ts          # Mastcam-Z (pan/tilt)
    ├── camera/
    │   └── CameraRig.ts     # órbita, seguimiento, cámara a bordo
    ├── ui/
    │   ├── Hud.ts           # velocidad, inclinación, posición, hora solar
    │   └── Controls.ts      # panel de ayuda y ajustes
    └── utils/
        └── math.ts
```

## Paso a paso

### Fase 1 — Base del proyecto
1. Inicializar Vite + TypeScript e instalar dependencias (ver comandos).
2. Crear `Engine.ts`: renderer WebGL, escena, cámara perspectiva, `resize`, bucle con `requestAnimationFrame`.
3. Añadir un cubo de prueba con luz para validar que el render funciona.
4. Inicializar Rapier (`await RAPIER.init()`) y un paso de física con timestep fijo (1/60 s).

### Fase 2 — Entorno marciano
5. `Terrain.ts`: generar `PlaneGeometry` desplazada con un heightmap; crear el collider `heightfield` en Rapier.
6. Texturas de suelo (color, normal, roughness) con repetición y mezcla por altura/pendiente.
7. `Sky.ts`: fondo color ocre/rosado, `Fog` para dar profundidad, sol pequeño y pálido.
8. `Lighting.ts`: `DirectionalLight` con sombras (PCFSoft) + `HemisphereLight` tenue.
9. `Rocks.ts`: dispersar rocas con `InstancedMesh` para rendimiento; colliders solo en las cercanas.

### Fase 3 — Modelo del rover
10. Descargar el modelo oficial de Perseverance desde NASA 3D Resources (formato GLB) y optimizarlo (Draco/meshopt).
11. Cargar con `GLTFLoader`; separar en nodos: chasis, 6 ruedas, mástil, brazo, antenas.
12. Si el modelo no viene segmentado, construir un modelo simplificado propio con primitivas (cajas y cilindros) como alternativa.
13. Ajustar escala real: ~3 m de largo, 2.7 m de ancho, ruedas de 52.5 cm de diámetro.

### Fase 4 — Física y conducción
14. Chasis como `RigidBody` dinámico; ruedas como cilindros con fricción alta.
15. `Suspension.ts`: implementar el sistema **rocker-bogie** con joints (revolute) para que el rover mantenga las 6 ruedas en contacto sobre terreno irregular.
16. `Drive.ts`: tracción independiente en 6 ruedas; dirección en las 4 ruedas de las esquinas (giro tipo Ackermann y giro sobre el propio eje).
17. Limitar velocidad máxima a ~4.2 cm/s reales (con un multiplicador de "tiempo acelerado" ajustable) y pendiente máxima segura de ~30°.
18. `Input.ts`: WASD/flechas para conducir, soporte opcional de gamepad.

### Fase 5 — Cámaras y HUD
19. `CameraRig.ts`: modos órbita libre, seguimiento trasero y cámara a bordo (Navcam/Mastcam-Z).
20. `Mast.ts`: control de pan/tilt del mástil con el ratón o teclas.
21. `Hud.ts`: velocidad, inclinación (pitch/roll), coordenadas, odómetro, sol marciano y temperatura simulada.

### Fase 6 — Instrumentos y misión
22. `RoboticArm.ts`: brazo de 5 articulaciones con cinemática inversa (FABRIK o CCD) para apuntar a una roca.
23. Interacción: seleccionar una roca → desplegar brazo → "tomar muestra" con animación.
24. Objetivos de misión: puntos de interés geológico en el cráter Jezero (delta, borde del cráter) con marcadores.
25. Helicóptero Ingenuity (opcional): modelo y vuelo simple con botón de despegue.

### Fase 7 — Pulido y rendimiento
26. Polvo en las ruedas (partículas), huellas persistentes en el suelo (decals o textura dinámica).
27. Post-procesado ligero: tone mapping ACES, bloom sutil, vignette.
28. Optimización: LOD en terreno y rocas, límite de pixel ratio, compresión de texturas (KTX2).
29. Pantalla de carga con progreso y menú de controles.

### Fase 8 — Calidad y publicación
30. Tests con Vitest de la lógica de `Drive` (cinemática de giro) y utilidades matemáticas.
31. Verificar rendimiento objetivo: 60 FPS en portátil medio, 30 FPS en móvil.
32. `npm run build` y despliegue en GitHub Pages / Netlify / Vercel.
33. Documentar en `README.md` controles, créditos y licencias de assets.

## Controles previstos

| Tecla | Acción |
|---|---|
| W / S | Avanzar / retroceder |
| A / D | Girar izquierda / derecha |
| Q / E | Giro sobre el propio eje |
| Shift | Modo rápido (tiempo acelerado) |
| C | Cambiar cámara |
| Ratón | Orbitar / mover mástil |
| R | Reiniciar posición |
| Espacio | Freno |

## Datos reales de referencia

- Masa: ~1025 kg
- Dimensiones: 3 m largo × 2.7 m ancho × 2.2 m alto
- Ruedas: 6 de aluminio, 52.5 cm de diámetro
- Velocidad máxima en terreno plano: ~4.2 cm/s (152 m/h)
- Lugar de aterrizaje: cráter Jezero (18.44° N, 77.45° E), 18 feb 2021
- Gravedad marciana: 3.721 m/s²
- Duración del sol marciano: 24 h 39 min 35 s

## Convenciones de código

- TypeScript estricto (`"strict": true`), sin `any`.
- Una clase por archivo; nombres en PascalCase para clases y camelCase para funciones.
- Unidades del SI (metros, kilogramos, segundos); convertir solo en el HUD.
- Física en timestep fijo; el render interpola entre pasos.
- Liberar recursos (`geometry.dispose()`, `material.dispose()`) al descartar objetos.
- Commits pequeños por fase, mensajes descriptivos.

## Créditos y licencias

- Modelo 3D: NASA 3D Resources (uso libre, ver términos en nasa.gov).
- Terreno: datos de Mars Reconnaissance Orbiter HiRISE / MOLA (NASA/JPL/University of Arizona).
- Verificar la licencia de cualquier textura adicional antes de incluirla.

## Orden de trabajo sugerido

Avanzar fase por fase y confirmar que cada una funciona antes de pasar a la siguiente. Hito mínimo jugable: **Fases 1 a 5** (rover conducible sobre terreno marciano con cámara y HUD).
