import * as THREE from 'three';
import { toon, toonVertex } from './materials.js';

// Simple, forgiving ARCADE physics: inputs drive a target velocity that the
// balloon eases toward, so controls feel direct and predictable (no heat/lift
// integration, no inertia fights, no fuel-out crashes).
export const PHYSICS = {
  climbSpeed: 26,       // up speed while burner held (m/s)
  descendSpeed: 28,     // down speed while venting
  vertResponse: 5.0,    // how fast vertical velocity reaches target (higher = snappier)
  moveSpeed: 30,        // horizontal speed from steering
  horizResponse: 4.0,   // how fast horizontal velocity reaches target
  windFactor: 0.4,      // how much the wind nudges you (gentle drift aid)
  fuelStart: 100,
  fuelBurn: 1.6,        // slow drain while burner held
  fuelRegen: 3.5,       // refills whenever the burner is off
  minAltitude: 5,       // soft floor — you bounce, you don't crash
  maxAltitude: 260,
};

const ENVELOPE_COLORS = [0xff5a3c, 0xffcc33, 0x4ea3ff, 0x6bff8f, 0xc06bff, 0xff7ad0];

// Multiply an 0xRRGGBB colour's channels by f (clamped) for lighter/darker tones.
function shade(hex, f) {
  const r = Math.min(255, Math.round(((hex >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((hex >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((hex & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

export class Balloon {
  constructor({ color = 0xff5a3c, isPlayer = false, name = 'Player' } = {}) {
    this.isPlayer = isPlayer;
    this.name = name;
    this.group = new THREE.Group();
    this._buildMesh(color);

    // --- physics state ---
    this.velocity = new THREE.Vector3();
    this.heat = 42;            // starts near neutral hover heat
    this.fuel = PHYSICS.fuelStart;
    this.burner = false;
    this.vent = false;
    this.alive = true;

    // power-up modifiers (set by the Gooner's Arsenal system, reset on expiry)
    this.mods = { windCouplingMul: 1, dragMul: 1, liftAdd: 0, weightAdd: 0 };
    this.invincible = false;
    this.steer = new THREE.Vector2(); // optional direct lateral input (world x, z)

    // input proxies the player sets each frame
    this.position = this.group.position;
  }

  // Wrap the envelope in studio branding: four decal panels around its widest
  // part so the logo reads from any angle (the chase cam, rivals, etc.).
  setLogo(tex) {
    if (this._logoGroup) this.group.remove(this._logoGroup);
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, alphaTest: 0.04,
      side: THREE.DoubleSide, depthWrite: true, toneMapped: false,
    });
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 4.6), mat);
      panel.position.set(Math.sin(a) * 6.2, 9, Math.cos(a) * 6.2);
      panel.rotation.y = a;
      g.add(panel);
    }
    this.group.add(g);
    this._logoGroup = g;
  }

  _buildMesh(color) {
    const g = this.group;

    // Envelope (sphere) — patchwork panels via per-vertex colors, cel shaded.
    const env = new THREE.Mesh(new THREE.SphereGeometry(6, 32, 20), toonVertex());
    env.scale.set(1, 1.18, 1);
    env.position.y = 9;
    env.castShadow = true;
    g.add(env);
    this.envelope = env;
    this._paintEnvelope(ENVELOPE_COLORS); // default: rainbow patchwork (player)

    // Burner glow (between envelope and basket) — emissive, brightens on burn.
    const burner = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 2.4, 10),
      toon(0xffae3a, { emissive: 0xff7a18, emissiveIntensity: 0 })
    );
    burner.position.y = 3.4;
    g.add(burner);
    this.burnerMesh = burner;

    // Basket (box)
    const basket = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.6), toon(0x8a5a2b));
    basket.position.y = 1.2;
    basket.castShadow = true;
    g.add(basket);
    this.basket = basket;

    // Suspension lines (thin cylinders)
    const lineMat = toon(0x33271a);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 5), lineMat);
      line.position.set(sx * 1.1, 5.2, sz * 1.1);
      line.rotation.z = sx * 0.06;
      g.add(line);
    }
  }

  // Paint the envelope's vertices into vertical patchwork gores.
  _paintEnvelope(colors) {
    const geo = this.envelope.geometry;
    const pos = geo.attributes.position;
    const n = pos.count;
    const arr = new Float32Array(n * 3);
    const gores = 8;
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(pos.getZ(i), pos.getX(i)); // -π..π
      const gi = Math.floor(((a + Math.PI) / (2 * Math.PI)) * gores) % gores;
      c.setHex(colors[gi % colors.length]); // stored linear (matches vertexColors)
      arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }

  // Rivals get a 2-3 tone patchwork built around their team colour.
  setColorIndex(i) {
    const base = ENVELOPE_COLORS[i % ENVELOPE_COLORS.length];
    this._paintEnvelope([base, shade(base, 0.6), shade(base, 1.3)]);
  }

  get altitude() {
    return this.group.position.y;
  }

  reset(pos) {
    this.group.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.heat = 42;
    this.fuel = PHYSICS.fuelStart;
    this.burner = false;
    this.vent = false;
    this.alive = true;
    this.mods = { windCouplingMul: 1, dragMul: 1, liftAdd: 0, weightAdd: 0 };
    this.invincible = false;
  }

  // wind: THREE.Vector2 (x, z) horizontal wind force from the Wind system.
  update(delta, wind) {
    const P = PHYSICS;
    const pos = this.group.position;
    const vel = this.velocity;
    const m = this.mods;

    // --- fuel: slow drain while burning, refills whenever the burner is off ---
    const burning = this.burner && this.fuel > 0;
    if (burning) this.fuel = Math.max(0, this.fuel - P.fuelBurn * delta);
    else this.fuel = Math.min(P.fuelStart, this.fuel + P.fuelRegen * delta);
    // heat is now cosmetic (drives the burner glow)
    this.heat += ((burning ? 100 : 0) - this.heat) * Math.min(1, delta * 4);

    // --- vertical: input picks a target speed; ease toward it (arcade) ---
    let targetVY = 0;
    if (burning) targetVY += P.climbSpeed;
    if (this.vent) targetVY -= P.descendSpeed;
    targetVY += m.liftAdd - m.weightAdd; // power-up modifiers (skeet sinks, etc.)
    vel.y += (targetVY - vel.y) * (1 - Math.exp(-P.vertResponse * delta));
    pos.y += vel.y * delta;
    if (pos.y < P.minAltitude) { pos.y = P.minAltitude; if (vel.y < 0) vel.y = 0; }
    if (pos.y > P.maxAltitude) { pos.y = P.maxAltitude; if (vel.y > 0) vel.y = 0; }

    // --- horizontal: steering picks a target velocity; wind adds a soft drift ---
    const speed = P.moveSpeed * m.windCouplingMul; // Lube boosts move speed
    let tvx = this.steer.x * speed;
    let tvz = this.steer.y * speed;
    if (wind) { tvx += wind.x * P.windFactor; tvz += wind.y * P.windFactor; }
    const kh = 1 - Math.exp(-P.horizResponse * delta);
    vel.x += (tvx - vel.x) * kh;
    vel.z += (tvz - vel.z) * kh;
    pos.x += vel.x * delta;
    pos.z += vel.z * delta;

    // --- visual feedback: burner glow + gentle lean into motion ---
    const mat = this.burnerMesh.material;
    const target = burning ? 2.2 : 0;
    mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, delta * 8);
    const lean = 0.01;
    this.group.rotation.z += (-vel.x * lean - this.group.rotation.z) * Math.min(1, delta * 3);
    this.group.rotation.x += (vel.z * lean - this.group.rotation.x) * Math.min(1, delta * 3);
  }

  // Player input bridge
  setInput({ burner, vent, steerX = 0, steerY = 0 }) {
    this.burner = !!burner;
    this.vent = !!vent;
    this.steer.set(steerX, steerY);
    if (this.steer.lengthSq() > 1) this.steer.normalize();
  }
}
