import * as THREE from 'three';
import { Balloon } from './balloon.js';
import { RaceTracker } from './course.js';

// Rival balloons. They use the exact same Balloon physics as the player. Their
// only "intelligence" is choosing an altitude whose wind band pushes them toward
// the next checkpoint, then burning/venting to hold that altitude.
export class AIBalloon {
  constructor({ name, colorIndex, logo, course, wind, skill = 0.85 }) {
    this.balloon = new Balloon({ name, isPlayer: false });
    this.balloon.setColorIndex(colorIndex);
    this.logo = logo;
    this.course = course;
    this.wind = wind;
    this.tracker = new RaceTracker(course);
    this.skill = skill;                         // 0..1, higher = tighter play
    this.altNoise = (Math.random() - 0.5) * 14; // persistent altitude bias
    this.jitterT = 0;
    this.jitter = 0;
    this.desiredAlt = 50;
    this._dir = new THREE.Vector2();
    this._w = new THREE.Vector2();
    this.debuffT = 0;    // Skeet hit: heavy/draggy, sinking
    this.confuseT = 0;   // Lube trail: lost steering
  }

  // Skeet Shooter splat: piles on weight + drag so they sink and slow.
  applyDebuff(seconds = 4) {
    this.debuffT = Math.max(this.debuffT, seconds);
    const m = this.balloon.mods;
    m.weightAdd = 10;      // heavy → sinks
    m.liftAdd = -6;
    m.windCouplingMul = 0.45; // sluggish → slow
  }

  // Lube trail: temporarily lose steering and drift.
  confuse(seconds = 2.5) {
    this.confuseT = Math.max(this.confuseT, seconds);
  }

  get group() { return this.balloon.group; }
  get position() { return this.balloon.group.position; }

  reset(pos) {
    this.balloon.reset(pos);
    this.tracker.reset();
    this.desiredAlt = pos.y;
  }

  // Choose the altitude band whose wind best points toward the target.
  _pickAltitude(target) {
    const pos = this.position;
    this._dir.set(target.x - pos.x, target.z - pos.z);
    const dist = this._dir.length();
    if (dist > 0.001) this._dir.divideScalar(dist);

    let bestAlt = target.y;
    let bestScore = -Infinity;
    for (let a = 10; a <= 240; a += 12) {
      const w = this.wind.getWindAt(a);
      const wl = this._w.copy(w);
      const wstr = wl.length();
      if (wstr > 0.001) wl.divideScalar(wstr);
      // score: alignment with desired direction, weighted by strength, minus a
      // penalty for being far from the target's own altitude.
      const align = wl.dot(this._dir);
      const altPenalty = Math.abs(a - target.y) * 0.012;
      const score = align * (0.6 + wstr * 0.06) - altPenalty;
      if (score > bestScore) {
        bestScore = score;
        bestAlt = a;
      }
    }
    // Blend the wind-optimal altitude with the target's altitude so the AI
    // still rises/sinks to actually fly through the ring.
    return THREE.MathUtils.lerp(bestAlt, target.y, 0.45) + this.altNoise;
  }

  update(delta) {
    const b = this.balloon;
    if (!b.alive) return;

    // tick power-up debuffs
    if (this.debuffT > 0) {
      this.debuffT -= delta;
      if (this.debuffT <= 0) {
        b.mods.weightAdd = 0; b.mods.liftAdd = 0; b.mods.windCouplingMul = 1;
      }
    }
    if (this.confuseT > 0) {
      this.confuseT -= delta;
      // flail: random burner/vent + random drift off the racing line
      b.burner = Math.random() < 0.5 && b.fuel > 0;
      b.vent = !b.burner && Math.random() < 0.3;
      b.steer.set((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.4);
      b.update(delta, this.wind.getWindAt(b.altitude));
      this.tracker.update(delta, this.position, b.velocity.lengthSq() > 0.5);
      return;
    }

    // wandering jitter so they aren't robotic
    this.jitterT -= delta;
    if (this.jitterT <= 0) {
      this.jitterT = 0.6 + Math.random() * 1.2;
      this.jitter = (Math.random() - 0.5) * (1 - this.skill) * 18;
    }

    let target = this.course.ringCenter(this.tracker.index);
    if (!target) target = this.course.ringCenter(this.course.count - 1);

    if (target && !this.tracker.finished) {
      const pos = this.position;
      // steer horizontally toward the checkpoint, with skill-scaled aim error
      this._dir.set(target.x - pos.x, target.z - pos.z);
      if (this._dir.lengthSq() > 0.01) this._dir.normalize();
      const aimErr = (1 - this.skill) * 0.6;
      this._dir.x += (Math.random() - 0.5) * aimErr;
      this._dir.y += (Math.random() - 0.5) * aimErr;
      if (this._dir.lengthSq() > 1) this._dir.normalize();
      b.steer.copy(this._dir);

      // climb/sink toward the ring's altitude
      this.desiredAlt = THREE.MathUtils.clamp(target.y + this.jitter, 12, 250);
    } else {
      b.steer.set(0, 0);
    }

    // Burn / vent toward desired altitude with a small dead-band (hysteresis).
    const err = this.desiredAlt - b.altitude;
    b.burner = err > 3 && b.fuel > 0;
    b.vent = err < -4;

    b.update(delta, this.wind.getWindAt(b.altitude));
    this.tracker.update(delta, this.position, b.velocity.lengthSq() > 0.5);
  }
}

export function makeRivals(course, wind) {
  return [
    new AIBalloon({ name: 'Bang Bros', colorIndex: 2, logo: 'bb', course, wind, skill: 0.92 }),
    new AIBalloon({ name: 'Dog Fart', colorIndex: 5, logo: 'df', course, wind, skill: 0.85 }),
    new AIBalloon({ name: 'Brazzers', colorIndex: 1, logo: 'brazz', course, wind, skill: 0.78 }),
  ];
}
