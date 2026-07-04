import * as THREE from 'three';
import { toon } from './materials.js';
import { BLOOM_LAYER } from './postfx.js';

// The "Gooner's Arsenal". Three pickups float along the course; flying through
// one stores it. Press E to use the held power-up.
//   lube  — Personal Lubricant: speed/lift burst + a slippery trail that makes
//           rivals who fly into it lose steering.
//   vpn   — Virtual Private Navigation: brief invincibility + phase, balloon
//           pixelates/goes translucent.
//   skeet — Skeet Shooter: fires a sticky splat that weighs a rival down.
export const POWERUPS = {
  lube: { name: 'LUBE BOOST', color: 0xffe24a, glyph: 'LUBE' },
  vpn: { name: 'VPN CLOAK', color: 0x5ad1ff, glyph: 'VPN' },
  skeet: { name: 'SKEET SHOT', color: 0xf2f2f2, glyph: 'SKEET' },
};
const TYPES = ['lube', 'vpn', 'skeet'];

export class PowerupSystem {
  constructor(scene, hud, effects, audio) {
    this.scene = scene;
    this.hud = hud;
    this.effects = effects;
    this.audio = audio;

    this.root = new THREE.Group();
    scene.add(this.root);
    this.pickups = [];
    this.trail = [];
    this.projectiles = [];

    this.inventory = null;        // held power-up type
    this.active = null;           // { type, timer, total }
    this._trailAccum = 0;
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.root.clear();
    this.pickups = [];
    this.trail = [];
    this.projectiles = [];
  }

  reset() {
    this.inventory = null;
    this.active = null;
    if (this.hud) this.hud.setPowerup(null, null);
  }

  // Place pickups between consecutive checkpoints.
  build(courseSys) {
    this.dispose();
    this.reset();
    const n = courseSys.count;
    for (let i = 0; i < n - 1; i++) {
      const a = courseSys.ringCenter(i);
      const b = courseSys.ringCenter(i + 1);
      if (!a || !b) continue;
      const mid = a.clone().lerp(b, 0.5);
      mid.x += (i % 2 === 0 ? 1 : -1) * 10;
      mid.y += 6;
      const type = TYPES[i % TYPES.length];
      this._spawnPickup(mid, type);
    }
  }

  _spawnPickup(pos, type) {
    const info = POWERUPS[type];
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(4, 0),
      toon(info.color, { emissive: info.color, emissiveIntensity: 0.6 })
    );
    mesh.position.copy(pos);
    mesh.layers.enable(BLOOM_LAYER);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(6, 12, 8),
      new THREE.MeshBasicMaterial({ color: info.color, transparent: true, opacity: 0.15, depthWrite: false })
    );
    mesh.add(halo);
    this.root.add(mesh);
    this.pickups.push({ mesh, type, baseY: pos.y, active: true, respawn: 0 });
  }

  // ---- using a held power-up ----
  use(player, rivals) {
    if (!this.inventory) return;
    const type = this.inventory;
    this.inventory = null;
    this.hud.setPowerup(null, null);

    if (type === 'lube') {
      this._setActive('lube', 4);
      const m = player.mods;
      m.windCouplingMul = 2.8; m.dragMul = 0.5; m.liftAdd = 5;
      // forward kick along current glide direction
      const h = this._tmp.set(player.velocity.x, 0, player.velocity.z);
      if (h.lengthSq() < 1) h.set(0, 0, -1);
      h.normalize().multiplyScalar(26);
      player.velocity.x += h.x; player.velocity.z += h.z; player.velocity.y += 6;
      this.hud.toast && this.hud.toast('LUBED UP!');
    } else if (type === 'vpn') {
      this._setActive('vpn', 5);
      player.invincible = true;
      player.envelope.material.transparent = true;
      player.envelope.material.opacity = 0.4;
      player.envelope.material.emissive.setHex(0x5ad1ff);
      player.envelope.material.emissiveIntensity = 0.6;
      this.audio && this.audio.checkpoint(); // stand-in "dial-up" blip
      this.hud.toast && this.hud.toast('INCOGNITO');
    } else if (type === 'skeet') {
      this._fireSkeet(player, rivals);
      this.hud.toast && this.hud.toast('SKEET!');
    }
  }

  _setActive(type, dur) {
    this.active = { type, timer: dur, total: dur };
  }

  _fireSkeet(player, rivals) {
    // aim at the nearest rival, else straight ahead
    let dir = this._tmp.set(player.velocity.x, 0, player.velocity.z);
    if (dir.lengthSq() < 1) dir.set(0, 0, -1);
    dir.normalize();
    let best = null, bestD = Infinity;
    for (const r of rivals) {
      const d = r.position.distanceTo(player.group.position);
      if (d < bestD && d < 300) { bestD = d; best = r; }
    }
    if (best) dir.copy(best.position).sub(player.group.position).normalize();

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 8, 6),
      toon(0xf6f6f6, { emissive: 0x999999, emissiveIntensity: 0.5 })
    );
    mesh.position.copy(player.group.position).y += 9;
    this.root.add(mesh);
    this.projectiles.push({
      mesh,
      vel: dir.multiplyScalar(120).clone(),
      life: 3,
    });
  }

  // ---- per-frame ----
  update(delta, { player, rivals = [], time }) {
    const t = time || performance.now() / 1000;

    // pickups: bob, spin, collect, respawn
    for (const p of this.pickups) {
      if (p.active) {
        p.mesh.rotation.y += delta * 1.5;
        p.mesh.position.y = p.baseY + Math.sin(t * 2 + p.baseY) * 1.2;
        if (player.group.position.distanceTo(p.mesh.position) < 11) {
          this.inventory = p.type;
          p.active = false;
          p.mesh.visible = false;
          p.respawn = 14;
          this.hud.setPowerup(p.type, POWERUPS[p.type]);
          this.hud.toast && this.hud.toast('GOT ' + POWERUPS[p.type].name);
        }
      } else {
        p.respawn -= delta;
        if (p.respawn <= 0) { p.active = true; p.mesh.visible = true; }
      }
    }

    // active timed effect
    if (this.active) {
      this.active.timer -= delta;

      if (this.active.type === 'lube') {
        // lay slippery trail behind the player
        this._trailAccum += delta;
        if (this._trailAccum > 0.08) {
          this._trailAccum = 0;
          this._addTrail(player.group.position);
        }
      }

      if (this.active.timer <= 0) this._endActive(player);
    }

    // trail: fade, and confuse rivals who touch it
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const seg = this.trail[i];
      seg.life -= delta;
      seg.mesh.material.opacity = Math.max(0, seg.life / seg.total) * 0.5;
      seg.mesh.rotation.z += delta;
      for (const r of rivals) {
        if (r.position.distanceTo(seg.mesh.position) < 9) r.confuse(2.2);
      }
      if (seg.life <= 0) {
        this.root.remove(seg.mesh);
        seg.mesh.geometry.dispose();
        seg.mesh.material.dispose();
        this.trail.splice(i, 1);
      }
    }

    // projectiles: travel, hit detection
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= delta;
      pr.mesh.position.addScaledVector(pr.vel, delta);
      let hit = false;
      for (const r of rivals) {
        if (pr.mesh.position.distanceTo(r.position) < 8 && !r.balloon.invincible) {
          r.applyDebuff(4);
          // white splat on their canopy
          r.balloon.envelope.material.color.lerp(new THREE.Color(0xeeeeee), 0.5);
          hit = true;
          break;
        }
      }
      if (hit || pr.life <= 0) {
        this.root.remove(pr.mesh);
        pr.mesh.geometry.dispose();
        pr.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }

    // HUD active-effect readout
    if (this.active) {
      this.hud.setActiveEffect(POWERUPS[this.active.type].name, this.active.timer / this.active.total);
    } else {
      this.hud.setActiveEffect(null, 0);
    }
  }

  _addTrail(pos) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(7, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffe24a, transparent: true, opacity: 0.5,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    mesh.position.copy(pos);
    mesh.position.y -= 2;
    mesh.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.4;
    this.root.add(mesh);
    this.trail.push({ mesh, life: 4, total: 4 });
  }

  _endActive(player) {
    const type = this.active.type;
    this.active = null;
    if (type === 'lube') {
      player.mods.windCouplingMul = 1; player.mods.dragMul = 1; player.mods.liftAdd = 0;
    } else if (type === 'vpn') {
      player.invincible = false;
      player.envelope.material.opacity = 1;
      player.envelope.material.transparent = false;
      player.envelope.material.emissive.setHex(0x000000);
      player.envelope.material.emissiveIntensity = 1;
    }
  }
}
