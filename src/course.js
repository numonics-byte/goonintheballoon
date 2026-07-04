import * as THREE from 'three';
import { toon } from './materials.js';
import { BLOOM_LAYER } from './postfx.js';

export const RING_RADIUS = 17;
const SPAWN = new THREE.Vector3(0, 40, 20);

// Builds the glowing checkpoint rings and provides plane-crossing pass tests.
// Per-racer progress (timer, splits, current checkpoint) lives in RaceTracker.
export class Course {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.rings = [];     // { mesh, halo, center: Vector3, normal: Vector3 }
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this.time = 0;
  }

  get count() {
    return this.rings.length;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.group.clear();
    this.rings = [];
  }

  build(courseData) {
    this.dispose();
    const cps = courseData.checkpoints;
    for (let i = 0; i < cps.length; i++) {
      const cp = cps[i];
      const center = new THREE.Vector3(cp.x, cp.y, cp.z);

      // Normal points roughly along the course direction (toward next ring),
      // rotated by the checkpoint's yaw for variety.
      const next = cps[i + 1] || cps[i - 1];
      const normal = new THREE.Vector3(
        next ? (cps[i + 1] ? next.x - cp.x : cp.x - next.x) : 0,
        0,
        next ? (cps[i + 1] ? next.z - cp.z : cp.z - next.z) : -1
      );
      if (normal.lengthSq() < 0.001) normal.set(0, 0, -1);
      normal.normalize();
      // apply yaw
      const yaw = cp.yaw || 0;
      const cos = Math.cos(yaw), sin = Math.sin(yaw);
      const nx = normal.x * cos - normal.z * sin;
      const nz = normal.x * sin + normal.z * cos;
      normal.set(nx, 0, nz).normalize();

      const isFinish = i === cps.length - 1;
      const color = isFinish ? 0xffffff : 0xffcc33;
      const mat = toon(color, { emissive: color, emissiveIntensity: 0.5 });
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, 1.1, 12, 40), mat);
      // orient torus (default axis +Z) to the desired normal
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      mesh.position.copy(center);
      mesh.layers.enable(BLOOM_LAYER);
      this.group.add(mesh);

      // faint additive halo to make rings glow/readable at distance
      const haloMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const halo = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, 3.2, 10, 40), haloMat);
      halo.quaternion.copy(mesh.quaternion);
      halo.position.copy(center);
      halo.layers.enable(BLOOM_LAYER);
      this.group.add(halo);

      this.rings.push({ mesh, halo, center, normal, finish: isFinish });
    }

    // Tall locator beam over the active ring so it's findable from anywhere.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 600, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x3affc8, transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    beam.layers.enable(BLOOM_LAYER);
    this.group.add(beam);
    this.beam = beam;

    this.setActive(0);
  }

  startPosition() {
    // spawn just before the first ring
    if (this.rings[0]) {
      return this._tmp2.copy(this.rings[0].center)
        .addScaledVector(this.rings[0].normal, -30)
        .clone();
    }
    return SPAWN.clone();
  }

  ringCenter(i) {
    return this.rings[i] ? this.rings[i].center : null;
  }

  // Highlight the active ring; dim completed and upcoming ones distinctly.
  setActive(index) {
    this.activeIndex = index;
    // move the locator beam to the active ring (hide once finished)
    if (this.beam) {
      const r = this.rings[index];
      if (r) { this.beam.visible = true; this.beam.position.set(r.center.x, 300, r.center.z); }
      else this.beam.visible = false;
    }
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      if (i < index) {
        r.mesh.material.emissive.setHex(0x2f7d3a);
        r.mesh.material.color.setHex(0x2f7d3a);
        r.mesh.material.emissiveIntensity = 0.25;
        r.halo.material.opacity = 0.05;
      } else if (i === index) {
        const c = r.finish ? 0xffffff : 0x3affc8;
        r.mesh.material.emissive.setHex(c);
        r.mesh.material.color.setHex(c);
        r.halo.material.color.setHex(c);
        r.halo.material.opacity = 0.32;
      } else {
        r.mesh.material.emissive.setHex(0xffcc33);
        r.mesh.material.color.setHex(0xffcc33);
        r.mesh.material.emissiveIntensity = 0.4;
        r.halo.material.opacity = 0.12;
      }
    }
  }

  update(delta) {
    this.time += delta;
    // pulse the active ring
    const r = this.rings[this.activeIndex];
    if (r) {
      const p = 0.55 + Math.sin(this.time * 4) * 0.35;
      r.mesh.material.emissiveIntensity = p + 0.3;
      r.halo.scale.setScalar(1 + Math.sin(this.time * 4) * 0.06);
    }
  }

  // True if the segment prev->cur crosses ring i within its radius.
  passesThrough(i, prev, cur) {
    const r = this.rings[i];
    if (!r) return false;
    const n = r.normal;
    const c = r.center;
    const dPrev = this._tmp.copy(prev).sub(c).dot(n);
    const dCur = this._tmp.copy(cur).sub(c).dot(n);
    if (dPrev === dCur) return false;
    if ((dPrev > 0) === (dCur > 0)) return false; // no plane crossing
    const t = dPrev / (dPrev - dCur);
    // intersection point
    const ix = prev.x + (cur.x - prev.x) * t;
    const iy = prev.y + (cur.y - prev.y) * t;
    const iz = prev.z + (cur.z - prev.z) * t;
    // radial distance from center (component perpendicular to normal)
    this._tmp.set(ix - c.x, iy - c.y, iz - c.z);
    const along = this._tmp.dot(n);
    this._tmp2.copy(n).multiplyScalar(along);
    const radial = this._tmp.sub(this._tmp2).length();
    return radial <= RING_RADIUS;
  }
}

// Tracks one racer's progress around the course. Used for both player and AI.
export class RaceTracker {
  constructor(course) {
    this.course = course;
    this.reset();
  }

  reset() {
    this.index = 0;          // next checkpoint to clear
    this.started = false;
    this.finished = false;
    this.time = 0;
    this.finishTime = 0;
    this.splits = [];
    this._prev = new THREE.Vector3();
    this._havePrev = false;
  }

  get done() {
    return this.finished;
  }

  // Call each frame with the racer's current position & whether it has moved.
  // Returns { passed: bool, finished: bool }.
  update(delta, pos, moving) {
    let passed = false;
    if (!this.started && moving) this.started = true;
    if (this.started && !this.finished) this.time += delta;

    if (this._havePrev && !this.finished) {
      if (this.course.passesThrough(this.index, this._prev, pos)) {
        passed = true;
        this.splits.push(this.time);
        this.index++;
        if (this.index >= this.course.count) {
          this.finished = true;
          this.finishTime = this.time;
        }
      }
    }
    this._prev.copy(pos);
    this._havePrev = true;
    return { passed, finished: passed && this.finished };
  }

  // For resets: the center of the last cleared ring (or null for spawn).
  lastCheckpointCenter() {
    if (this.index <= 0) return null;
    return this.course.ringCenter(this.index - 1);
  }
}

export function formatTime(t) {
  if (t == null) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t * 100) % 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
