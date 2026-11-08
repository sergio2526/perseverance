import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createTerrain, heightAt } from './world/Terrain';
import { createRocks, rockColliders } from './world/Rocks';
import { createSky, HORIZON_COLOR } from './world/Sky';
import { createLighting, SUN_DIR } from './world/Lighting';
import { createMoons } from './world/Moons';
import { Dust } from './world/Dust';
import { Rover } from './rover/Rover';
import { Input } from './core/Input';

declare global {
  interface Window {
    __sceneReady?: boolean;
    __debug?: {
      odometer: () => number;
      tracks: () => number;
      fps: () => number;
      aimAtNearestRock: () => number;
      rockGap: () => number;
    };
  }
}

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
document.body.appendChild(renderer.domElement);

// Escena
const scene = new THREE.Scene();
const fogColor = HORIZON_COLOR.clone();
scene.fog = new THREE.FogExp2(fogColor, 0.0042);
scene.background = fogColor;

const { group: lights, sun } = createLighting();
scene.add(lights);
scene.add(createSky(SUN_DIR));
scene.add(createTerrain());
scene.add(createRocks());
scene.add(createMoons());
const dust = new Dust();
scene.add(dust.points);

// Rover (zona de salida sin rocas, mirando hacia el sol)
const rover = new Rover(0, 20, -0.25);
scene.add(rover.root, rover.tracks.mesh);
const input = new Input();
let roverReady = false;
rover
  .load('/models/perseverance.glb')
  .then(() => {
    roverReady = true;
    console.log('Piezas del rover que son cámaras:', rover.cameraParts.join(', '));
  })
  .catch((e: unknown) => console.error('No se pudo cargar el rover:', e));

// Cámara de seguimiento: detrás y arriba del rover, orbitable con el ratón
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 4000);
const controls = new OrbitControls(camera, renderer.domElement);
const followOffset = new THREE.Vector3(Math.sin(-0.25) * 9 + 3, 3.2, Math.cos(-0.25) * 9);
controls.target.copy(rover.root.position).add(new THREE.Vector3(0, 1.2, 0));
camera.position.copy(rover.root.position).add(followOffset);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 4;
controls.maxDistance = 60;
controls.update();
const lastRoverPos = rover.root.position.clone();
let odometer = 0;
let fps = 0;
// Distancia (m) entre el centro del rover y la roca grande más cercana, menos su radio
const nearestRock = () => {
  const p = rover.root.position;
  let best = rockColliders[0];
  let bestD = Infinity;
  for (const r of rockColliders) {
    const d = Math.hypot(r.x - p.x, r.z - p.z) - r.r;
    if (d < bestD) { bestD = d; best = r; }
  }
  return { rock: best, gap: bestD };
};
window.__debug = {
  odometer: () => odometer,
  tracks: () => rover.tracks.mesh.count,
  fps: () => fps,
  // Orienta el rover hacia la roca grande más cercana (para probar colisiones)
  aimAtNearestRock: () => {
    const { rock, gap } = nearestRock();
    const p = rover.root.position;
    rover.yaw = Math.atan2(-(rock.x - p.x), -(rock.z - p.z));
    return gap;
  },
  rockGap: () => nearestRock().gap,
};

// Post-procesado
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.25, 0.6, 0.95);
composer.addPass(bloom);
const vignette = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, strength: { value: 0.55 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float strength; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      c.rgb *= mix(1.0, smoothstep(0.85, 0.25, d), strength);
      gl_FragColor = c;
    }
  `,
});
composer.addPass(vignette);
composer.addPass(new OutputPass());

// La sombra sigue a la cámara
function updateShadowFocus(): void {
  const focus = controls.target;
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(SUN_DIR, 300);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

const timer = new THREE.Timer();
let frames = 0;
renderer.setAnimationLoop((now: number) => {
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();

  // Conducción y seguimiento: la cámara se traslada con el rover y gira tras él
  const prevYaw = rover.yaw;
  rover.update(dt, input.throttle, input.steer, rockColliders);
  const delta = rover.root.position.clone().sub(lastRoverPos);
  lastRoverPos.copy(rover.root.position);
  odometer += delta.length();
  if (dt > 0) fps += (1 / dt - fps) * 0.1;
  camera.position.add(delta);
  controls.target.add(delta);
  const dYaw = rover.yaw - prevYaw;
  if (dYaw !== 0) {
    const off = camera.position.clone().sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), dYaw);
    camera.position.copy(controls.target).add(off);
  }
  controls.target.y += (rover.root.position.y + 1.2 - controls.target.y) * Math.min(1, dt * 4);
  controls.update();
  // Mantener la cámara sobre el terreno
  const ground = heightAt(camera.position.x, camera.position.z) + 1.5;
  if (camera.position.y < ground) camera.position.y = ground;
  updateShadowFocus();
  dust.update(dt, camera.position, t);
  composer.render();
  if (roverReady && ++frames === 10) window.__sceneReady = true;
});
