import * as THREE from 'three';

export const HORIZON_COLOR = new THREE.Color(0.76, 0.42, 0.2);

/** Cúpula de cielo marciano: caramelo en el horizonte, sol con halo. */
export function createSky(sunDir: THREE.Vector3): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      sunDir: { value: sunDir.clone().normalize() },
      horizon: { value: HORIZON_COLOR.clone() },
      zenith: { value: new THREE.Color(0.3, 0.16, 0.1) },
      halo: { value: new THREE.Color(1.0, 0.7, 0.42) },
      blueHalo: { value: new THREE.Color(0.6, 0.68, 0.78) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir, horizon, zenith, halo, blueHalo;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(horizon, zenith, pow(max(h, 0.0), 0.55));
        col = mix(col, horizon * 0.8, smoothstep(0.0, -0.2, h)); // bajo el horizonte
        float s = max(dot(d, sunDir), 0.0);
        col += halo * pow(s, 10.0) * 0.28;         // resplandor amplio cálido
        col = mix(col, blueHalo, pow(s, 220.0) * 0.4); // halo azulado cercano (atardecer marciano)
        col += vec3(1.0, 0.9, 0.75) * pow(s, 1200.0) * 1.2;
        col += vec3(1.0, 0.95, 0.88) * smoothstep(0.99965, 0.9999, s) * 12.0; // disco solar
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}
