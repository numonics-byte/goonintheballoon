import * as THREE from 'three';
import { toon } from './materials.js';

// Builds the per-course world: gradient skybox, themed ground + instanced props,
// and drifting "wind clouds" that visually advertise each altitude band's wind.
export class Environment {
  constructor(scene, lights) {
    this.scene = scene;
    this.lights = lights;       // { hemi, sun }
    this.group = new THREE.Group();
    scene.add(this.group);
    this.clouds = [];           // { mesh } moved by wind each frame
    this._tmp = new THREE.Vector2();
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const m = Array.isArray(o.material) ? o.material : [o.material];
        m.forEach((mm) => mm.dispose());
      }
    });
    this.group.clear();
    this.clouds = [];
    if (this.sky) {
      this.sky.geometry.dispose();
      this.sky.material.dispose();
      this.group.remove(this.sky);
    }
  }

  build(course) {
    this.dispose();
    const { scene, lights } = this;

    // --- palette / fog / lights ---
    scene.background = new THREE.Color(course.sky);
    scene.fog = new THREE.FogExp2(course.fog, course.fogDensity);
    lights.hemi.color.setHex(course.hemiSky);
    lights.hemi.groundColor.setHex(course.hemiGround);
    lights.sun.color.setHex(course.sun);

    // --- gradient sky dome ---
    this._buildSky(course);

    // --- ground ---
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000, 1, 1),
      toon(course.ground)
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.group.add(ground);
    this.ground = ground;

    // --- themed props (instanced) ---
    this._buildProps(course);

    // --- wind clouds ---
    this._buildClouds(course);
  }

  _buildSky(course) {
    const geo = new THREE.SphereGeometry(900, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(course.skyTop) },
        bottom: { value: new THREE.Color(course.sky) },
      },
      vertexShader: `
        varying vec3 vP;
        void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      // Banded + Bayer-dithered gradient for a retro 16-bit sky.
      fragmentShader: `
        varying vec3 vP;
        uniform vec3 top; uniform vec3 bottom;
        float bayer(vec2 p){
          int x = int(mod(p.x, 4.0));
          int y = int(mod(p.y, 4.0));
          int i = x + y * 4;
          int m[16];
          m[0]=0;  m[1]=8;  m[2]=2;  m[3]=10;
          m[4]=12; m[5]=4;  m[6]=14; m[7]=6;
          m[8]=3;  m[9]=11; m[10]=1; m[11]=9;
          m[12]=15;m[13]=7; m[14]=13;m[15]=5;
          for(int k=0;k<16;k++){ if(k==i) return float(m[k]) / 16.0; }
          return 0.0;
        }
        void main(){
          float h = clamp((normalize(vP).y * 0.5 + 0.5), 0.0, 1.0);
          h = pow(h, 0.8);
          float bands = 5.0;
          float d = bayer(gl_FragCoord.xy) - 0.5;       // -0.5..0.5 dither
          float hb = floor(h * bands + d) / bands;       // quantize w/ dither
          gl_FragColor = vec4(mix(bottom, top, clamp(hb, 0.0, 1.0)), 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.group.add(this.sky);
  }

  // Instanced repeated props keep draw calls low even with hundreds of objects.
  _buildProps(course) {
    const theme = course.theme;
    const rand = mulberry32(0xC0FFEE ^ theme.length);

    const makeInstanced = (geo, mat, count, place) => {
      const inst = new THREE.InstancedMesh(geo, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;
      const m = new THREE.Matrix4();
      for (let i = 0; i < count; i++) {
        place(m, i, rand);
        inst.setMatrixAt(i, m);
      }
      inst.instanceMatrix.needsUpdate = true;
      this.group.add(inst);
      return inst;
    };

    // Scatter helper avoiding the central race corridor a bit.
    const scatter = (m, scaleRange, yBase, color, i, r) => {
      const side = r() < 0.5 ? -1 : 1;
      const x = side * (60 + r() * 220);
      const z = -r() * 900 + 100;
      const s = scaleRange[0] + r() * (scaleRange[1] - scaleRange[0]);
      m.makeScale(s, s * (yBase || 1), s);
      m.setPosition(x, 0, z);
    };

    if (theme === 'canyon') {
      const mat = toon(0xb5703a);
      makeInstanced(new THREE.CylinderGeometry(10, 16, 60, 6), mat, 70, (m, i, r) => {
        const s = 0.6 + r() * 2.2;
        const side = r() < 0.5 ? -1 : 1;
        m.makeScale(s, s, s);
        m.setPosition(side * (50 + r() * 260), 30 * s, -r() * 950 + 60);
      });
    } else if (theme === 'frosty') {
      const trunk = toon(0x5a4326);
      const snow = toon(0xf4fbff);
      // snowy peaks
      makeInstanced(new THREE.ConeGeometry(30, 90, 5), snow, 40, (m, i, r) => {
        const s = 0.7 + r() * 2.4;
        const side = r() < 0.5 ? -1 : 1;
        m.makeScale(s, s, s);
        m.setPosition(side * (70 + r() * 280), 45 * s, -r() * 950 + 60);
      });
      // pines
      makeInstanced(new THREE.ConeGeometry(6, 22, 6), trunk, 90, (m, i, r) => scatter(m, [0.6, 1.6], 1, 0, i, r));
    } else if (theme === 'city') {
      const mat = toon(0x6b7686);
      makeInstanced(new THREE.BoxGeometry(14, 1, 14), mat, 120, (m, i, r) => {
        const h = 20 + r() * 130;
        const side = r() < 0.5 ? -1 : 1;
        m.makeScale(1, h, 1);
        m.setPosition(side * (45 + r() * 240), h / 2, -r() * 900 + 80);
      });
    } else if (theme === 'tropical') {
      // sea is the ground color; add little islands + palms
      const sand = toon(0xe9d8a6);
      const palm = toon(0x2e8b57);
      makeInstanced(new THREE.CylinderGeometry(18, 22, 4, 16), sand, 30, (m, i, r) => {
        const side = r() < 0.5 ? -1 : 1;
        const s = 0.8 + r() * 2;
        m.makeScale(s, 1, s);
        m.setPosition(side * (60 + r() * 240), 1.5, -r() * 950 + 80);
      });
      makeInstanced(new THREE.ConeGeometry(7, 16, 6), palm, 60, (m, i, r) => scatter(m, [0.7, 1.4], 1, 0, i, r));
    }
  }

  // Drifting clouds sit at the center altitude of each wind band and move with
  // that band's wind, so a player can "read the wind" by looking around.
  _buildClouds(course) {
    const tex = makeCloudTexture();
    const layers = course.wind;
    for (let li = 0; li < layers.length; li++) {
      const alt = layers[li].altitude + 10;
      const count = 14;
      for (let i = 0; i < count; i++) {
        const mat = new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          fog: true,
        });
        const sp = new THREE.Sprite(mat);
        const s = 30 + Math.random() * 50;
        sp.scale.set(s, s * 0.6, 1);
        sp.position.set(
          (Math.random() - 0.5) * 600,
          alt + (Math.random() - 0.5) * 18,
          -Math.random() * 900
        );
        sp.userData.alt = alt;
        this.group.add(sp);
        this.clouds.push(sp);
      }
    }
  }

  // wind: Wind system; center: balloon position to wrap clouds around.
  update(delta, wind, center) {
    for (const c of this.clouds) {
      const w = wind.getWindAt(c.userData.alt);
      c.position.x += w.x * delta * 1.4;
      c.position.z += w.y * delta * 1.4;
      // wrap within a box around the player so clouds are always present
      const span = 500;
      if (c.position.x - center.x > span) c.position.x -= span * 2;
      if (c.position.x - center.x < -span) c.position.x += span * 2;
      if (c.position.z - center.z > span) c.position.z -= span * 2;
      if (c.position.z - center.z < -span) c.position.z += span * 2;
    }
  }
}

// --- helpers ---
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let _cloudTex = null;
function makeCloudTexture() {
  if (_cloudTex) return _cloudTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _cloudTex = new THREE.CanvasTexture(c);
  return _cloudTex;
}
