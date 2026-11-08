import * as THREE from 'three';

/** Huellas de las ruedas: marcas instanciadas en un búfer circular. */
export class Tracks {
  readonly mesh: THREE.InstancedMesh;
  private next = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3(1, 1, 1);

  constructor(private readonly max = 6000, width = 0.4, length = 0.32) {
    const geo = new THREE.PlaneGeometry(width, length);
    geo.rotateX(-Math.PI / 2);
    const tex = Tracks.treadTexture();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3a160a,
      map: tex,
      transparent: true,
      opacity: 0.85,
      roughness: 1,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  /** Deja una marca en `pos`, alineada al rumbo `yaw` y a la normal del suelo. */
  stamp(pos: THREE.Vector3, yaw: number, normal: THREE.Vector3): void {
    this.q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    this.q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    this.m.compose(pos, this.q, this.s);
    this.mesh.setMatrixAt(this.next, this.m);
    this.next = (this.next + 1) % this.max;
    this.mesh.count = Math.min(this.mesh.count + 1, this.max);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  // Patrón de los grousers (relieve en zigzag de las ruedas de Perseverance)
  private static treadTexture(): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 7;
    for (let y = -16; y < 80; y += 16) {
      g.beginPath();
      g.moveTo(4, y);
      g.lineTo(32, y + 8);
      g.lineTo(60, y);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(4, 0, 56, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
}
