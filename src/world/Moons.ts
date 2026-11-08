import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { valueNoise } from '../utils/noise';

function moonGeometry(sx: number, sy: number, sz: number, seed: number): THREE.BufferGeometry {
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 4));
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = valueNoise(v.x * 3 + seed, v.y * 3 + v.z * 2) * 0.08
      + valueNoise(v.x * 9 - seed, v.z * 9 + v.y * 5) * 0.025;
    v.multiplyScalar(1 + n);
    pos.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Fobos y Deimos, irregulares, en el cielo. */
export function createMoons(): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc4b09c,
    roughness: 1,
    emissive: 0xe8cdb0,
    emissiveIntensity: 0.5,
    fog: false,
  });

  const place = (mesh: THREE.Mesh, az: number, el: number, dist: number) => {
    const a = THREE.MathUtils.degToRad(az);
    const e = THREE.MathUtils.degToRad(el);
    mesh.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).multiplyScalar(dist);
  };

  const phobos = new THREE.Mesh(moonGeometry(24, 18, 20, 3), mat);
  phobos.name = 'Phobos';
  place(phobos, -22, 15, 1000);
  phobos.rotation.set(0.4, 1.2, 0.2);

  const deimos = new THREE.Mesh(moonGeometry(10, 8, 9, 11), mat);
  deimos.name = 'Deimos';
  place(deimos, -2, 19, 1100);

  group.add(phobos, deimos);
  return group;
}
