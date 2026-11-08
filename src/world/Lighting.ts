import * as THREE from 'three';

const ELEVATION = THREE.MathUtils.degToRad(9);
const AZIMUTH = THREE.MathUtils.degToRad(22);

/** Dirección hacia el sol (sol bajo de tarde, delante de la cámara). */
export const SUN_DIR = new THREE.Vector3(
  Math.sin(AZIMUTH) * Math.cos(ELEVATION),
  Math.sin(ELEVATION),
  -Math.cos(AZIMUTH) * Math.cos(ELEVATION),
).normalize();

export function createLighting(): { group: THREE.Group; sun: THREE.DirectionalLight } {
  const group = new THREE.Group();

  const sun = new THREE.DirectionalLight(0xffae6a, 4.2);
  sun.position.copy(SUN_DIR).multiplyScalar(300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const cam = sun.shadow.camera;
  cam.left = -140;
  cam.right = 140;
  cam.top = 140;
  cam.bottom = -140;
  cam.near = 10;
  cam.far = 800;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.06;
  sun.shadow.radius = 4;
  group.add(sun, sun.target);

  // Relleno: cielo caramelo arriba, suelo rojizo abajo
  const hemi = new THREE.HemisphereLight(0xe8a878, 0x4a2214, 0.9);
  group.add(hemi);

  return { group, sun };
}
