import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { heightAt } from '../world/Terrain';
import { Tracks } from './Tracks';
import type { RockCollider } from '../world/Rocks';

// Huella del rover aproximada con 3 círculos a lo largo del chasis (3 m × 2.7 m)
const BODY_CIRCLES = [-0.9, 0, 0.9];
const BODY_RADIUS = 1.3;

const LENGTH = 3.0; // m, largo real de Perseverance
const MAX_SPEED = 2.5; // m/s (acelerado; el real es ~0.042 m/s)
const ACCEL = 2.0;
const TURN_RATE = 0.8; // rad/s
const HALF_TRACK = 1.2; // m, mitad de la vía (2.7 m de ancho)
const HALF_BASE = 1.3; // m, mitad de la batalla
const STAMP_EVERY = 0.3; // m entre huellas

const CAMERA_PATTERN = /cam|watson|lens/i;
const NOT_CAMERA = /cover|bracket|wiring/i; // soportes, tapas y cables de las cámaras

/** Rover Perseverance: modelo oficial de la NASA, conducción WASD y huellas. */
export class Rover {
  readonly root = new THREE.Group();
  readonly tracks = new Tracks();
  /** Nombres de las piezas del modelo que son cámaras. */
  cameraParts: string[] = [];
  yaw = 0;
  speed = 0;
  private readonly model = new THREE.Group();
  private readonly normal = new THREE.Vector3(0, 1, 0);
  private distSinceStamp = 0;

  constructor(x: number, z: number, yaw = 0) {
    this.root.position.set(x, heightAt(x, z), z);
    this.yaw = yaw;
    this.root.add(this.model);
    this.settle(1);
  }

  async load(url: string): Promise<void> {
    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    const gltf = await loader.loadAsync(url);
    draco.dispose();
    const obj = gltf.scene;

    obj.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
      if (o.name && CAMERA_PATTERN.test(o.name) && !NOT_CAMERA.test(o.name)) this.cameraParts.push(o.name);
    });

    // Escala real: el lado mayor en planta mide 3 m; apoyado en el suelo y centrado
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    obj.scale.multiplyScalar(LENGTH / Math.max(size.x, size.z));
    box.setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
    // El frente del modelo (hazcams delanteras) mira hacia +Z; el rumbo 0 mira hacia -Z
    obj.rotation.y = Math.PI;
    this.model.add(obj);
  }

  /** Empuja al rover fuera de las rocas grandes. Devuelve true si chocó. */
  private resolveCollisions(colliders: readonly RockCollider[]): boolean {
    let hit = false;
    const pos = this.root.position;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const rock of colliders) {
        const reach = rock.r + BODY_RADIUS + 1;
        if (Math.abs(rock.x - pos.x) > reach || Math.abs(rock.z - pos.z) > reach) continue;
        for (const off of BODY_CIRCLES) {
          const dx = pos.x + fx * off - rock.x;
          const dz = pos.z + fz * off - rock.z;
          const min = rock.r + BODY_RADIUS;
          const d2 = dx * dx + dz * dz;
          if (d2 < min * min && d2 > 1e-8) {
            const d = Math.sqrt(d2);
            const push = min - d;
            pos.x += (dx / d) * push;
            pos.z += (dz / d) * push;
            hit = moved = true;
          }
        }
      }
      if (!moved) break;
    }
    return hit;
  }

  update(dt: number, throttle: number, steer: number, colliders: readonly RockCollider[] = []): void {
    // Velocidad con aceleración suave
    const target = throttle * MAX_SPEED;
    const dv = target - this.speed;
    this.speed += Math.sign(dv) * Math.min(Math.abs(dv), ACCEL * dt);

    // Giro (puede girar sobre su eje aun detenido, como el real)
    const turning = steer * TURN_RATE * dt * (this.speed < -0.05 ? -1 : 1);
    this.yaw += turning;

    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const before = this.root.position.clone();
    this.root.position.addScaledVector(fwd, this.speed * dt);
    if (this.resolveCollisions(colliders)) this.speed *= 0.5; // frena al chocar, puede deslizar
    const step = this.root.position.clone().sub(before).setY(0).length() * Math.sign(this.speed);
    this.settle(Math.min(1, dt * 8));

    // Huellas bajo las ruedas de ambos lados
    this.distSinceStamp += Math.abs(step) + Math.abs(turning) * HALF_TRACK;
    if (this.distSinceStamp >= STAMP_EVERY) {
      this.distSinceStamp = 0;
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      for (const side of [-1, 1]) {
        for (const axle of [-HALF_BASE, HALF_BASE]) {
          if (axle === HALF_BASE && Math.abs(this.speed) > 0.05) continue; // en marcha basta un eje
          const p = this.root.position.clone().addScaledVector(right, side * HALF_TRACK).addScaledVector(fwd, axle);
          // La malla interpola entre vértices cada 2.5 m, así que la huella va un poco más alta
          p.y = heightAt(p.x, p.z) + 0.12;
          this.tracks.stamp(p, this.yaw, this.normal);
        }
      }
    }
  }

  /** Apoya el rover en el terreno e inclina el chasis según la pendiente. */
  private settle(alpha: number): void {
    const { x, z } = this.root.position;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const sample = (f: number, r: number) => {
      const px = x + fwd.x * f + right.x * r;
      const pz = z + fwd.z * f + right.z * r;
      return new THREE.Vector3(px, heightAt(px, pz), pz);
    };
    const fl = sample(HALF_BASE, -HALF_TRACK);
    const fr = sample(HALF_BASE, HALF_TRACK);
    const bl = sample(-HALF_BASE, -HALF_TRACK);
    const br = sample(-HALF_BASE, HALF_TRACK);
    const front = fl.clone().add(fr).multiplyScalar(0.5);
    const back = bl.clone().add(br).multiplyScalar(0.5);
    const left = fl.clone().add(bl).multiplyScalar(0.5);
    const rightP = fr.clone().add(br).multiplyScalar(0.5);
    const forwardAxis = front.clone().sub(back).normalize();
    const rightAxis = rightP.clone().sub(left).normalize();
    const n = new THREE.Vector3().crossVectors(rightAxis, forwardAxis).normalize();
    this.normal.lerp(n, alpha).normalize();

    const y = (fl.y + fr.y + bl.y + br.y) / 4;
    this.root.position.y += (y - this.root.position.y) * alpha;

    // Orientación: eje Y = normal del suelo, rumbo = yaw
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.normal);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw));
    this.root.quaternion.copy(q);
  }
}
