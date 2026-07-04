import * as THREE from 'three';
import { windVector } from './courses.js';

// Altitude-banded wind. Horizontal wind force is read by balloons via
// getWindAt(altitude); transitions between bands are linearly interpolated so
// climbing/descending gradually changes your drift.
export class Wind {
  constructor(course) {
    this.setCourse(course);
    this._tmp = new THREE.Vector2();
  }

  setCourse(course) {
    // Sorted bands with precomputed scaled vectors.
    this.layers = course.wind
      .map((l) => ({ altitude: l.altitude, vec: windVector(l), raw: l }))
      .sort((a, b) => a.altitude - b.altitude);
    // optional per-layer swirl/gust amount keyed by theme
    this.gust = course.theme === 'canyon' ? 1.4 : 0.4;
    this.theme = course.theme;
    this.time = 0;
  }

  update(delta) {
    this.time += delta;
  }

  // Returns a fresh Vector2 (x, z) of the blended wind at the given altitude.
  getWindAt(altitude) {
    const layers = this.layers;
    let out;
    if (altitude <= layers[0].altitude) {
      out = layers[0].vec.clone();
    } else if (altitude >= layers[layers.length - 1].altitude) {
      out = layers[layers.length - 1].vec.clone();
    } else {
      out = new THREE.Vector2();
      for (let i = 0; i < layers.length - 1; i++) {
        const a = layers[i];
        const b = layers[i + 1];
        if (altitude >= a.altitude && altitude <= b.altitude) {
          const t = (altitude - a.altitude) / (b.altitude - a.altitude);
          out.copy(a.vec).lerp(b.vec, t);
          break;
        }
      }
    }
    // Swirling gust component (stronger in canyons) — a slow rotating nudge.
    if (this.gust > 0.01) {
      const g = this.gust;
      out.x += Math.sin(this.time * 0.6 + altitude * 0.05) * g;
      out.y += Math.cos(this.time * 0.5 + altitude * 0.04) * g;
    }
    return out;
  }

  // Dominant layer info for the HUD compass (nearest band to a given altitude).
  getLayerInfo(altitude) {
    const w = this.getWindAt(altitude);
    return { dir: w.clone().normalize(), strength: w.length(), vec: w };
  }
}
