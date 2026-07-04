import * as THREE from 'three';

const MAX = 600;

// Pooled point-particle system for burner flame/heat-shimmer, vent steam, and
// speed streaks, plus a screen flash + camera pulse on checkpoint.
export class Effects {
  constructor(scene, flashEl) {
    this.flashEl = flashEl;
    this.flashOn = 0;

    const positions = new Float32Array(MAX * 3);
    const colors = new Float32Array(MAX * 3);
    const sizes = new Float32Array(MAX);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.geo = geo;

    const mat = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      map: makeSprite(),
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    this._spawnAccum = 0;
  }

  _emit(x, y, z, vx, vy, vz, r, g, b, size, life) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    const p = this.geo.attributes.position.array;
    const c = this.geo.attributes.color.array;
    const s = this.geo.attributes.size.array;
    p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b;
    s[i] = size;
    this.life[i] = life; this.maxLife[i] = life;
  }

  // Particle emissions removed — AdditiveBlending white sprites blew out the
  // screen at gameplay speeds. The burner mesh glow in balloon.js handles visuals.
  emitFromBalloon(_delta, _balloon) {}

  update(delta) {
    const p = this.geo.attributes.position.array;
    const s = this.geo.attributes.size.array;
    const c = this.geo.attributes.color.array;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) {
        s[i] = 0;
        continue;
      }
      this.life[i] -= delta;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      p[i * 3] += this.vel[i * 3] * delta;
      p[i * 3 + 1] += this.vel[i * 3 + 1] * delta;
      p[i * 3 + 2] += this.vel[i * 3 + 2] * delta;
      // fade size with life
      s[i] = s[i] * (0.9 + 0.1 * t);
      // darken toward end (multiply current color toward 0)
      c[i * 3] *= 0.985; c[i * 3 + 1] *= 0.985; c[i * 3 + 2] *= 0.985;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;

    // screen flash decay
    if (this.flashOn > 0) {
      this.flashOn -= delta * 2.4;
      if (this.flashEl) this.flashEl.style.opacity = Math.max(0, this.flashOn) * 0.5;
    }
  }

  checkpointPulse(camera) {
    this.flashOn = 1;
    if (camera) camera.pulse && camera.pulse();
  }
}

function rand(s) { return (Math.random() - 0.5) * 2 * s; }

let _sprite = null;
function makeSprite() {
  if (_sprite) return _sprite;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _sprite = new THREE.CanvasTexture(c);
  return _sprite;
}
