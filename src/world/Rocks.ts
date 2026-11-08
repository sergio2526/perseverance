import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt } from './Terrain';
import { mulberry32, valueNoise } from '../utils/noise';

function rockGeometry(seed: number): THREE.BufferGeometry {
  const rnd = mulberry32(seed);
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 2));
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const sx = 0.8 + rnd() * 0.6;
  const sy = 0.45 + rnd() * 0.35;
  const sz = 0.8 + rnd() * 0.6;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = valueNoise(v.x * 2.1 + seed, v.z * 2.1 + v.y * 1.7) * 0.25 + (rnd() - 0.5) * 0.12;
    v.multiplyScalar(1 + n);
    pos.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Huella circular (plano XZ) de una roca que bloquea al rover. */
export interface RockCollider { x: number; z: number; r: number }

/** Rocas por encima de esta escala son obstáculos; las menores se pueden pisar. */
const MIN_BLOCKING_SIZE = 0.4;

/** Colisionadores de las rocas grandes; se llena al llamar a createRocks. */
export const rockColliders: RockCollider[] = [];

/** Rocas dispersas en varias formas, con InstancedMesh por forma. */
export function createRocks(count = 700, radius = 260): THREE.Group {
  const group = new THREE.Group();
  const rnd = mulberry32(1234);
  const shapes = 4;
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, flatShading: true });
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const e = new THREE.Euler();
  const col = new THREE.Color();

  for (let k = 0; k < shapes; k++) {
    const n = Math.floor(count / shapes);
    const mesh = new THREE.InstancedMesh(rockGeometry(k * 31 + 7), mat, n);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    for (let i = 0; i < n; i++) {
      // Más densidad cerca de la cámara
      const r = Math.pow(rnd(), 1.25) * radius + 9;
      const a = rnd() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r + 20;
      const size = 0.15 + Math.pow(rnd(), 4) * 2.6;
      p.set(x, heightAt(x, z) + size * 0.15, z);
      e.set((rnd() - 0.5) * 0.5, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.5);
      q.setFromEuler(e);
      s.setScalar(size);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      if (size >= MIN_BLOCKING_SIZE) rockColliders.push({ x, z, r: size * 1.05 });
      const t = rnd();
      col.setRGB(0.3 + t * 0.14, 0.15 + t * 0.07, 0.09 + t * 0.04);
      mesh.setColorAt(i, col);
    }
    group.add(mesh);
  }
  return group;
}
