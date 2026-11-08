import * as THREE from 'three';
import { mulberry32 } from '../utils/noise';

function softDot(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const BOX = new THREE.Vector3(240, 40, 240);
const WIND = new THREE.Vector3(1.6, 0.05, -0.6);

/** Partículas de polvo en suspensión que derivan con el viento. */
export class Dust {
  readonly points: THREE.Points;
  private readonly pos: THREE.BufferAttribute;
  private readonly center = new THREE.Vector3();

  constructor(count = 4000) {
    const rnd = mulberry32(99);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (rnd() - 0.5) * BOX.x;
      arr[i * 3 + 1] = rnd() * BOX.y;
      arr[i * 3 + 2] = (rnd() - 0.5) * BOX.z;
    }
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(arr, 3);
    geo.setAttribute('position', this.pos);
    const mat = new THREE.PointsMaterial({
      size: 0.5,
      map: softDot(),
      color: 0xf0c090,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  update(dt: number, camPos: THREE.Vector3, time: number): void {
    this.center.copy(camPos);
    const a = this.pos.array as Float32Array;
    const gust = 1 + Math.sin(time * 0.4) * 0.5;
    for (let i = 0; i < a.length; i += 3) {
      a[i] += WIND.x * gust * dt;
      a[i + 1] += (WIND.y + Math.sin(time + i) * 0.05) * dt;
      a[i + 2] += WIND.z * gust * dt;
      // Envolver en una caja alrededor de la cámara
      for (let k = 0; k < 3; k++) {
        const half = k === 1 ? BOX.y : BOX.getComponent(k) / 2;
        const c = k === 1 ? camPos.y - 8 : this.center.getComponent(k);
        if (k === 1) {
          if (a[i + k] > c + half) a[i + k] -= half;
          else if (a[i + k] < c) a[i + k] += half;
        } else {
          if (a[i + k] > c + half) a[i + k] -= half * 2;
          else if (a[i + k] < c - half) a[i + k] += half * 2;
        }
      }
    }
    this.pos.needsUpdate = true;
  }
}
