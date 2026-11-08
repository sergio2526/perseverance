import * as THREE from 'three';
import { fbm, valueNoise, smoothstep } from '../utils/noise';

const WIND = 0.6; // dirección del viento (rad) que orienta las crestas de las dunas
const COS_W = Math.cos(WIND);
const SIN_W = Math.sin(WIND);

/** Altura del terreno (m) en cualquier punto del mundo. */
export function heightAt(x: number, z: number): number {
  // Relieve base amplio
  const base = fbm(x * 0.003, z * 0.003, 5) * 16;

  // Campos de dunas: crestas transversales al viento, deformadas por ruido
  const u = x * COS_W + z * SIN_W;
  const w = -x * SIN_W + z * COS_W;
  const warp = fbm(x * 0.008, z * 0.008, 3) * 2.2;
  // Valor absoluto suavizado: crestas redondeadas, sin dientes de sierra en la malla
  const softAbs = (n: number) => Math.sqrt(n * n + 0.006);
  const ridge = 1 - softAbs(valueNoise(u * 0.022 + warp, w * 0.005));
  const ridge2 = 1 - softAbs(valueNoise(u * 0.05 + warp * 1.7, w * 0.012 + 40));
  const field = smoothstep(-0.25, 0.35, fbm(x * 0.0025 + 50, z * 0.0025, 3));
  const dunes = (Math.pow(ridge, 3) * 7 + Math.pow(ridge2, 3) * 0.8) * field;

  // Detalle fino
  const detail = fbm(x * 0.05, z * 0.05, 3) * 0.6;

  return base + dunes + detail;
}

export function createTerrain(size = 900, segments = 360): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  // Colores por vértice: óxido base, ocre en crestas, basalto en pendientes
  const normals = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const rust = new THREE.Color(0.55, 0.24, 0.12);
  const ochre = new THREE.Color(0.78, 0.46, 0.24);
  const basalt = new THREE.Color(0.22, 0.12, 0.08);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const slope = 1 - normals.getY(i);
    const n = fbm(x * 0.03, z * 0.03, 3);
    c.copy(rust).lerp(ochre, smoothstep(2, 14, y + n * 4));
    c.lerp(basalt, smoothstep(0.08, 0.3, slope + n * 0.06));
    const v = 0.92 + n * 0.12;
    colors[i * 3] = c.r * v;
    colors[i * 3 + 1] = c.g * v;
    colors[i * 3 + 2] = c.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}
