import * as THREE from 'three';

// Damped chase rig that trails the balloon from behind and above. Because the
// balloon climbs/sinks a lot, vertical follow is damped more gently than the
// horizontal follow to avoid jarring snaps.
export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Object3D();      // smoothed look-at point
    this.curPos = new THREE.Vector3(0, 30, 40);
    this.curLook = new THREE.Vector3();
    this.heading = new THREE.Vector3(0, 0, -1); // smoothed travel direction
    this._tmp = new THREE.Vector3();
    this._desired = new THREE.Vector3();

    // tuning
    this.distance = 34;
    this.height = 14;
    this.posLerpXZ = 2.4;   // higher = snappier horizontal follow
    this.posLerpY = 1.2;    // gentler vertical follow
    this.lookLerp = 3.0;
    this.baseFov = camera.fov;
    this.shake = 0;
  }

  // Brief FOV punch + shake, used as a checkpoint pulse.
  pulse() {
    this.shake = 1;
  }

  reset(balloon) {
    const p = balloon.group.position;
    this.heading.set(0, 0, -1);
    this.curPos.set(p.x, p.y + this.height, p.z + this.distance);
    this.curLook.copy(p);
    this.camera.position.copy(this.curPos);
    this.camera.lookAt(this.curLook);
  }

  // target: world point to frame (next checkpoint). Falls back to travel dir.
  update(delta, balloon, target) {
    const p = balloon.group.position;
    const v = balloon.velocity;

    // Heading points toward the next checkpoint so "forward" stays stable and
    // the goal is always framed. Falls back to travel direction, then -Z.
    const horiz = this._tmp.set(0, 0, 0);
    if (target) horiz.set(target.x - p.x, 0, target.z - p.z);
    if (horiz.lengthSq() < 1) horiz.set(v.x, 0, v.z);
    if (horiz.lengthSq() > 0.4) {
      horiz.normalize();
      this.heading.lerp(horiz, Math.min(1, delta * 2.0)).normalize();
    }

    // Desired position: behind the heading, slightly above.
    this._desired.copy(p)
      .addScaledVector(this.heading, -this.distance)
      .add(this._tmp.set(0, this.height, 0));

    // Damp X/Z and Y separately (frame-rate independent).
    const kxz = 1 - Math.exp(-this.posLerpXZ * delta);
    const ky = 1 - Math.exp(-this.posLerpY * delta);
    this.curPos.x += (this._desired.x - this.curPos.x) * kxz;
    this.curPos.z += (this._desired.z - this.curPos.z) * kxz;
    this.curPos.y += (this._desired.y - this.curPos.y) * ky;

    // Look slightly ahead of the balloon along its heading.
    this._desired.copy(p).addScaledVector(this.heading, 8).add(this._tmp.set(0, 6, 0));
    const kl = 1 - Math.exp(-this.lookLerp * delta);
    this.curLook.lerp(this._desired, kl);

    this.camera.position.copy(this.curPos);

    // checkpoint pulse: quick FOV punch + tiny positional shake that decays
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - delta * 3);
      const s = this.shake;
      this.camera.position.x += Math.sin(performance.now() * 0.05) * s * 0.8;
      this.camera.position.y += Math.cos(performance.now() * 0.06) * s * 0.6;
      this.camera.fov = this.baseFov - s * 6;
      this.camera.updateProjectionMatrix();
    } else if (this.camera.fov !== this.baseFov) {
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
    }

    this.camera.lookAt(this.curLook);
  }
}
