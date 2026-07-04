import * as THREE from 'three';

// Flat cel/toon shading to match the 16-bit art: lit solids get hard banded
// shading (a few steps) instead of smooth gradients.
let _gradient = null;
function toonGradient(steps = 3) {
  if (_gradient) return _gradient;
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) {
    // spread the bands across the range (e.g. 3 steps -> ~85,170,255)
    data[i] = Math.round((i + 1) / steps * 255);
  }
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.unpackAlignment = 1; // 3-wide single-channel row isn't 4-byte aligned
  tex.needsUpdate = true;
  _gradient = tex;
  return tex;
}

// Cel-shaded material. opts: { emissive, emissiveIntensity, transparent, opacity }
export function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: toonGradient(3),
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
}

// Cel-shaded material driven by per-vertex colors (used for patchwork balloons).
export function toonVertex() {
  return new THREE.MeshToonMaterial({
    color: 0xffffff,
    vertexColors: true,
    gradientMap: toonGradient(3),
  });
}
