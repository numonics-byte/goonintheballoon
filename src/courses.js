// Central course definitions. Shared by environment, wind, course, and menus.
// Each course defines its palette/skybox tint, altitude-banded wind layers,
// checkpoint ring placements, and an environment theme for props.
//
// Wind layers: { altitude, dir: [x, z] (will be normalized), strength }
// Checkpoints: { x, y, z, yaw } — yaw orients the ring's pass-through plane.

import * as THREE from 'three';

// Helper to fan a sequence of checkpoints out so each sits in a band that needs
// a different wind layer to reach. Coordinates are hand-placed for variety.
export const COURSES = [
  {
    id: 'canyon',
    name: 'Canyon Clash',
    subtitle: 'LEVEL 1',
    theme: 'canyon',
    sky: 0x9fd0ff,
    skyTop: 0x4a86d6,
    fog: 0xcfe6ff,
    fogDensity: 0.0016,
    ground: 0xc08a4a,
    hemiSky: 0xbfe3ff,
    hemiGround: 0x8a5a30,
    sun: 0xfff3d6,
    preview: 'linear-gradient(160deg,#e8b06b,#9c5a2c 55%,#5e3318)',
    wind: [
      { altitude: 0, dir: [1, 0.2], strength: 3 },
      { altitude: 35, dir: [0.3, 1], strength: 6 },
      { altitude: 70, dir: [-1, 0.4], strength: 7 },
      { altitude: 110, dir: [-0.2, -1], strength: 8 },
      { altitude: 160, dir: [1, -0.3], strength: 9 },
    ],
    checkpoints: [
      { x: 0, y: 45, z: -70, yaw: 0 },
      { x: 80, y: 70, z: -150, yaw: 0.6 },
      { x: 40, y: 110, z: -250, yaw: -0.3 },
      { x: -70, y: 80, z: -340, yaw: -0.8 },
      { x: -120, y: 55, z: -450, yaw: 0.2 },
      { x: -30, y: 95, z: -560, yaw: 0.5 },
      { x: 90, y: 130, z: -660, yaw: 0.1 },
      { x: 0, y: 60, z: -760, yaw: 0 },
    ],
  },
  {
    id: 'frosty',
    name: 'Frosty Ascent',
    subtitle: 'LEVEL 2',
    theme: 'frosty',
    sky: 0xdff1ff,
    skyTop: 0x9cc6e8,
    fog: 0xeaf6ff,
    fogDensity: 0.0022,
    ground: 0xf2f7fb,
    hemiSky: 0xffffff,
    hemiGround: 0xbcd0e0,
    sun: 0xffffff,
    preview: 'linear-gradient(160deg,#eaf6ff,#bcd6ec 55%,#7fa3c4)',
    wind: [
      { altitude: 0, dir: [0.5, -1], strength: 4 },
      { altitude: 40, dir: [-0.6, -1], strength: 7 },
      { altitude: 85, dir: [-1, 0.2], strength: 9 },
      { altitude: 140, dir: [0.4, 1], strength: 10 },
      { altitude: 200, dir: [1, 0.6], strength: 11 },
    ],
    // A climbing course — checkpoints push steadily upward.
    checkpoints: [
      { x: 0, y: 50, z: -80, yaw: 0 },
      { x: -60, y: 90, z: -170, yaw: -0.4 },
      { x: -110, y: 130, z: -280, yaw: -0.2 },
      { x: -40, y: 170, z: -390, yaw: 0.4 },
      { x: 70, y: 200, z: -500, yaw: 0.3 },
      { x: 120, y: 160, z: -620, yaw: 0.1 },
      { x: 30, y: 210, z: -730, yaw: 0 },
    ],
  },
  {
    id: 'city',
    name: 'City Dash',
    subtitle: 'LEVEL 3',
    theme: 'city',
    sky: 0xbcd2ec,
    skyTop: 0x6f8fb8,
    fog: 0xc8d6e8,
    fogDensity: 0.0018,
    ground: 0x4a4f5a,
    hemiSky: 0xdfeaff,
    hemiGround: 0x40454e,
    sun: 0xfff0d0,
    preview: 'linear-gradient(160deg,#9fb6d4,#5b6f8c 55%,#2e3744)',
    wind: [
      { altitude: 0, dir: [1, 0], strength: 4 },
      { altitude: 30, dir: [0, -1], strength: 6 },
      { altitude: 60, dir: [-1, 0], strength: 7 },
      { altitude: 95, dir: [0, 1], strength: 8 },
      { altitude: 140, dir: [1, 0.5], strength: 9 },
    ],
    // Weaving between towers at varied low/mid altitudes.
    checkpoints: [
      { x: 0, y: 40, z: -70, yaw: 0 },
      { x: 60, y: 75, z: -160, yaw: 0.7 },
      { x: -20, y: 55, z: -250, yaw: -0.5 },
      { x: -80, y: 100, z: -350, yaw: -0.2 },
      { x: 10, y: 70, z: -450, yaw: 0.3 },
      { x: 90, y: 110, z: -560, yaw: 0.2 },
      { x: 0, y: 50, z: -670, yaw: 0 },
    ],
  },
  {
    id: 'tropical',
    name: 'Tropical Drift',
    subtitle: 'LEVEL 4',
    theme: 'tropical',
    sky: 0x8fe0ff,
    skyTop: 0x2aa6e0,
    fog: 0xbff0ff,
    fogDensity: 0.0014,
    ground: 0x2bb6c8,
    hemiSky: 0xcffaff,
    hemiGround: 0x1f8fa0,
    sun: 0xfff6cf,
    preview: 'linear-gradient(160deg,#9bf0ff,#36c0d8 55%,#178fa8)',
    // Strong steady sea winds (coastal feel) — fewer, broader layers.
    wind: [
      { altitude: 0, dir: [1, -0.3], strength: 7 },
      { altitude: 45, dir: [1, 0.2], strength: 10 },
      { altitude: 90, dir: [0.6, 1], strength: 12 },
      { altitude: 150, dir: [-0.4, 1], strength: 13 },
    ],
    checkpoints: [
      { x: 0, y: 50, z: -80, yaw: 0 },
      { x: 90, y: 80, z: -180, yaw: 0.5 },
      { x: 140, y: 120, z: -300, yaw: 0.2 },
      { x: 60, y: 90, z: -420, yaw: -0.4 },
      { x: -50, y: 130, z: -540, yaw: -0.3 },
      { x: -110, y: 70, z: -660, yaw: 0.3 },
      { x: -20, y: 110, z: -770, yaw: 0 },
    ],
  },
];

export function getCourse(id) {
  return COURSES.find((c) => c.id === id) || COURSES[0];
}

// Normalize a raw wind layer dir into a THREE.Vector2 scaled by strength.
export function windVector(layer) {
  const v = new THREE.Vector2(layer.dir[0], layer.dir[1]);
  if (v.lengthSq() > 0) v.normalize();
  return v.multiplyScalar(layer.strength);
}
