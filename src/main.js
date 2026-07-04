import * as THREE from 'three';
import '@fontsource/press-start-2p';
import '@fontsource/vt323';
import './style.css';
import { PostFX, BLOOM_LAYER } from './postfx.js';

import { Balloon, PHYSICS } from './balloon.js';
import { Wind } from './wind.js';
import { ChaseCamera } from './camera.js';
import { Course, RaceTracker, formatTime } from './course.js';
import { Environment } from './environment.js';
import { Effects } from './effects.js';
import { HUD } from './hud.js';
import { AudioManager } from './audio.js';
import { makeRivals } from './ai.js';
import { Menus, addTime } from './menu.js';
import { COURSES, getCourse } from './courses.js';
import { PowerupSystem } from './powerups.js';
import { CutscenePlayer, CUTSCENES } from './cutscene.js';
import { LOGOS } from './logos.js';
import { TouchControls, IS_TOUCH } from './touchcontrols.js';

const UP = new THREE.Vector3(0, 1, 0);

class Game {
  constructor() {
    this.state = 'title'; // title | playing | paused | results
    this.mode = 'timeattack';
    this.course = null;

    this._initRenderer();
    this._initScene();
    this._initInput();
    this._initSystems();

    this.menus.showTitle();

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  // ---------------- core three.js setup ----------------
  _initRenderer() {
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('app').appendChild(renderer.domElement);
    this.renderer = renderer;

    window.addEventListener('resize', () => this._onResize());
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 2000);
    this.camera.position.set(0, 40, 60);

    // hemisphere + directional (sun) with shadows
    const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a5a30, 0.9);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff3d6, 1.5);
    sun.position.set(80, 160, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 500;
    const d = 140; // tight frustum around the balloon for crisp shadows
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    this.lights = { hemi, sun };

    // pixel-art render pipeline (chunky pixels + outlines + emissive glow)
    this.postfx = new PostFX(this.renderer, this.scene, this.camera, { pixelSize: 5, bloom: false });
  }

  _initSystems() {
    this.environment = new Environment(this.scene, this.lights);
    this.courseSys = new Course(this.scene);
    this.wind = new Wind(COURSES[0]);
    this.chase = new ChaseCamera(this.camera);
    this.audio = new AudioManager();

    this.player = new Balloon({ isPlayer: true, name: 'Joel Chester', color: 0xff5a3c });
    this.player.setLogo(LOGOS.rk()); // player flies under Reality Kings
    this.scene.add(this.player.group);
    this.tracker = new RaceTracker(this.courseSys);

    // floating guidance arrow that always points at the next checkpoint
    this.guideArrow = new THREE.Mesh(
      new THREE.ConeGeometry(1.3, 3.6, 8),
      new THREE.MeshBasicMaterial({ color: 0x3affc8, transparent: true, opacity: 0.9, toneMapped: false })
    );
    this.guideArrow.visible = false;
    this.guideArrow.layers.enable(BLOOM_LAYER);
    this.scene.add(this.guideArrow);

    this.rivals = [];

    this.hud = new HUD();
    this.effects = null; // created after menus build #flash element

    this.menus = new Menus({
      onStart: (opts) => this.startRace(opts),
      onResume: () => this.resume(),
      onRestart: () => this.startRace({ courseId: this.course.id, mode: this.mode }),
      onQuit: () => this.quitToMenu(),
      onEscape: () => this.togglePause(),
      getSettings: () => ({
        master: this.audio.master, music: this.audio.musicVol,
        muted: this.audio.muted,
      }),
      onSetMaster: (v) => this.audio.setMaster(v),
      onSetMusic: (v) => this.audio.setMusic(v),
      onSetMute: (v) => this.audio.setMuted(v),
      onMenuMusic: (which) => this.audio.playTrack(which === 'select' ? 'menu' : 'title'),
      onTitleStart: () => this.introThenSelect(),
      onPlayTrack: (role) => this.audio.playTrack(role),
    });
    this.effects = new Effects(this.scene, this.menus.flash);
    this.powerups = new PowerupSystem(this.scene, this.hud, this.effects, this.audio);
    this.cutscene = new CutscenePlayer();
    this.cutscene.setAudio(this.audio);
    this.touchControls = new TouchControls(this.input);
    this.introSeen = false;
    this.shownCutscenes = new Set();

    // simple debug overlay (toggle with backquote) for physics tuning
    this.debugEl = document.createElement('div');
    this.debugEl.id = 'debug';
    this.debugEl.style.display = 'none';
    document.body.appendChild(this.debugEl);
  }

  _initInput() {
    // W/S/Up/Down = altitude  |  A/D/Left/Right = horizontal strafe  |  Space = forward boost
    this.input = { up: false, down: false, left: false, right: false, fwd: false };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': this.input.up = true; e.preventDefault(); break;
        case 'KeyS': case 'ArrowDown': this.input.down = true; e.preventDefault(); break;
        case 'KeyA': case 'ArrowLeft': this.input.left = true; break;
        case 'KeyD': case 'ArrowRight': this.input.right = true; break;
        case 'Space': this.input.fwd = true; e.preventDefault(); break;
        case 'KeyR': if (this.state === 'playing') this.resetToCheckpoint(); break;
        case 'KeyE': if (this.state === 'playing') this.powerups.use(this.player, this.rivals); break;
        case 'Backquote': this.debugEl.style.display = this.debugEl.style.display === 'none' ? 'block' : 'none'; break;
      }
    });
    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': this.input.up = false; break;
        case 'KeyS': case 'ArrowDown': this.input.down = false; break;
        case 'KeyA': case 'ArrowLeft': this.input.left = false; break;
        case 'KeyD': case 'ArrowRight': this.input.right = false; break;
        case 'Space': this.input.fwd = false; break;
      }
    });
    // Unlock audio on the earliest possible gesture — mousemove fires as soon
    // as the cursor enters the window, well before the user clicks START, so
    // the title track is already playing by the time they press the button.
    const unlock = () => {
      this.audio.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('mousemove', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('mousemove', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  // ---------------- race lifecycle ----------------
  // Title START: play the intro cutscene once, then open level select.
  introThenSelect() {
    if (!this.introSeen) {
      this.introSeen = true;
      this.menus.hide();
      this.cutscene.play(CUTSCENES.intro, () => this.menus.showCourseSelect());
    } else {
      this.menus.showCourseSelect();
    }
  }

  startRace(opts) {
    this._beginRace(opts);
  }

  _beginRace({ courseId, mode }) {
    this.course = getCourse(courseId);
    this.mode = mode;

    this.wind.setCourse(this.course);
    this.environment.build(this.course);
    this.courseSys.build(this.course);
    this.powerups.build(this.courseSys);

    const start = this.courseSys.startPosition();
    this.player.reset(start);
    // restore envelope material in case a VPN effect was active when we ended
    const env = this.player.envelope.material;
    env.opacity = 1; env.transparent = false;
    env.emissive.setHex(0x000000); env.emissiveIntensity = 1;
    this.tracker.reset();

    // rivals
    this.rivals.forEach((r) => this.scene.remove(r.group));
    this.rivals = [];
    if (mode === 'race') {
      this.rivals = makeRivals(this.courseSys, this.wind);
      this.rivals.forEach((r, i) => {
        this.scene.add(r.group);
        if (r.logo && LOGOS[r.logo]) r.balloon.setLogo(LOGOS[r.logo]());
        const p = start.clone();
        p.x += (i - 1) * 16;       // spread across the start line
        p.z += 6 + i * 2;
        r.reset(p);
      });
    }

    this.chase.reset(this.player);
    this.finished = false;
    this.finishData = null;

    this.menus.hide();
    this.hud.show();
    this.hud.showSplits([]);
    this.hud.toast(IS_TOUCH ? 'JOYSTICK · BOOST · ITEM' : 'W/S ALTITUDE · A/D STRAFE · SPACE FORWARD · E ITEM', 3000);
    this.touchControls.show();
    this.audio.init();
    this.audio.startAmbient();
    this.audio.playTrack('race-' + this.course.id);
    this.state = 'playing';
  }

  finishRace() {
    if (this.finished) return;
    this.finished = true;
    this.state = 'results';
    this.audio.stopAmbient();
    this.guideArrow.visible = false;
    this.hud.hide();
    this.touchControls.hide();

    if (this.mode === 'timeattack') {
      const rank = addTime(this.course.id, this.tracker.finishTime);
      this.finishData = { mode: 'timeattack', courseId: this.course.id, time: this.tracker.finishTime, rank };
    } else {
      // Order: finished racers by time, then unfinished by progress.
      const racers = [
        { name: 'Joel Chester', me: true, tracker: this.tracker },
        ...this.rivals.map((r) => ({ name: r.balloon.name, me: false, tracker: r.tracker })),
      ];
      racers.sort((a, b) => this._progress(b.tracker) - this._progress(a.tracker));
      const order = racers.map((r) => ({
        name: r.name, me: r.me,
        time: r.tracker.finished ? r.tracker.finishTime : null,
      }));
      this.finishData = { mode: 'race', courseId: this.course.id, order };
    }
    this._finishFlow();
  }

  // After a finish, play the course's story cutscene (once per session) then
  // show the results screen. Course order in COURSES drives the campaign beats.
  // Courses 0-2 each have a mid cutscene; Tropical (idx 3) triggers the outro.
  _finishFlow() {
    const idx = COURSES.findIndex((c) => c.id === this.course.id);
    const show = () => { this.audio.playTrack('results-' + this.course.id); this.menus.showResults(this.finishData); };

    const playOnce = (scene, key, onDone) => {
      if (scene && !this.shownCutscenes.has(key)) {
        this.shownCutscenes.add(key);
        this.cutscene.play(scene, onDone);
      } else {
        onDone();
      }
    };

    if (idx >= 0 && idx < COURSES.length - 1) {
      // Courses 0–2: play mid cutscene then auto-start the next level.
      const next = COURSES[idx + 1];
      playOnce(CUTSCENES.mid[idx], 'cs' + idx, () => this.startRace({ courseId: next.id, mode: this.mode }));
    } else if (idx === COURSES.length - 1) {
      // Final course (Tropical): outro → end credits → results screen.
      playOnce(CUTSCENES.outro, 'outro', () => this.cutscene.play(CUTSCENES.end, show));
    } else {
      show();
    }
  }

  _progress(tracker) {
    // higher = further along; finished racers rank by inverse time
    if (tracker.finished) return 1e9 - tracker.finishTime;
    const next = this.courseSys.ringCenter(tracker.index);
    let dist = 0;
    if (next) dist = next.distanceTo(this.player.group.position); // rough
    return tracker.index * 1000 - dist;
  }

  resetToCheckpoint() {
    const c = this.tracker.lastCheckpointCenter();
    const pos = c ? c.clone() : this.courseSys.startPosition();
    this.player.reset(pos);
    // keep the timer running as a penalty (don't reset tracker timing)
    this.player.group.position.copy(pos);
    this.hud.toast('RESET');
  }

  togglePause() {
    if (this.state === 'playing') { this.state = 'paused'; this.touchControls.hide(); this.menus.showPause(); }
    else if (this.state === 'paused') this.resume();
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.menus.hide();
    this.hud.show();
    this.touchControls.show();
    this.clock.getDelta(); // discard time spent paused
  }
  quitToMenu() {
    this.state = 'title';
    this.hud.hide();
    this.touchControls.hide();
    this.guideArrow.visible = false;
    this.audio.stopAmbient();
    this.menus.showCourseSelect(); // triggers menu-screen music
  }

  // ---------------- per-frame ----------------
  _frame() {
    const delta = Math.min(this.clock.getDelta(), 0.05); // clamp to avoid jumps

    if (this.state === 'playing') this._updatePlaying(delta);

    this.postfx.render();
  }

  _updatePlaying(delta) {
    const player = this.player;

    // Optional direct steering, mapped relative to the camera's forward so
    // left/right/forward feel intuitive (inert while PHYSICS.steerAccel === 0).
    // A/D = strafe left/right; Space = push forward along camera heading.
    const mx = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const mf = this.input.fwd ? 1 : 0;
    let steerX = 0, steerY = 0;
    if (mx || mf) {
      const h = this.chase.heading;
      const fl = Math.hypot(h.x, h.z) || 1;
      const fX = h.x / fl, fZ = h.z / fl;   // forward (horizontal)
      const rX = -fZ, rZ = fX;              // right = forward rotated -90°
      steerX = rX * mx + fX * mf;
      steerY = rZ * mx + fZ * mf;
    }
    // W/Up = climb, S/Down = descend — no Shift needed.
    player.setInput({ burner: this.input.up, vent: this.input.down, steerX, steerY });

    this.wind.update(delta);
    this.courseSys.update(delta);

    // player physics
    const w = this.wind.getWindAt(player.altitude);
    player.update(delta, w);

    // ground collision → reset
    if (player.altitude < 3) {
      this.resetToCheckpoint();
    }

    // progress / checkpoints
    const moving = this.input.burner || this.input.vent || player.velocity.lengthSq() > 0.5;
    const res = this.tracker.update(delta, player.group.position, moving);
    if (res.passed) {
      this.courseSys.setActive(this.tracker.index);
      this.audio.checkpoint();
      this.effects.checkpointPulse(this.chase);
      this.hud.showSplits(this.tracker.splits);
      this.hud.toast(this.tracker.finished ? 'FINISH!' : `CHECKPOINT ${this.tracker.index}`);
    }
    if (this.tracker.finished) { this.finishRace(); return; }

    // rivals
    for (const r of this.rivals) r.update(delta);

    // next checkpoint drives the camera framing and the guidance arrow
    const nextRing = this.courseSys.ringCenter(this.tracker.index);
    this._updateGuideArrow(player, nextRing);

    // camera, environment, effects
    this.chase.update(delta, player, nextRing);
    this._followShadow();
    this.environment.update(delta, this.wind, player.group.position);
    this.effects.emitFromBalloon(delta, player);
    this.effects.update(delta);
    this.powerups.update(delta, { player, rivals: this.rivals, time: this.courseSys.time });

    // audio
    this.audio.update(delta, {
      burning: this.input.up && player.fuel > 0,
      altitude: player.altitude, maxAltitude: PHYSICS.maxAltitude,
    });

    // HUD
    const layer = this.wind.getLayerInfo(player.altitude);
    let place = 0, placeTotal = 0;
    if (this.mode === 'race') {
      placeTotal = this.rivals.length + 1;
      const myP = this._progress(this.tracker);
      place = 1 + this.rivals.filter((r) => this._progress(r.tracker) > myP).length;
    }
    this.hud.update(delta, {
      altitude: player.altitude, fuel: player.fuel, time: this.tracker.time,
      index: this.tracker.index, count: this.courseSys.count,
      wind: { dir: layer.dir, strength: layer.strength },
      place, placeTotal, mode: this.mode,
    });

    if (this.debugEl.style.display !== 'none') {
      this.debugEl.textContent =
        `alt   ${player.altitude.toFixed(1)}\n` +
        `vy    ${player.velocity.y.toFixed(2)}\n` +
        `heat  ${player.heat.toFixed(1)}\n` +
        `fuel  ${player.fuel.toFixed(1)}\n` +
        `wind  ${layer.strength.toFixed(1)}\n` +
        `time  ${formatTime(this.tracker.time)}`;
    }
  }

  // keep the sun's shadow frustum centered on the balloon
  _followShadow() {
    const p = this.player.group.position;
    this.sun.position.set(p.x + 80, p.y + 160, p.z + 60);
    this.sun.target.position.copy(p);
    this.sun.target.updateMatrixWorld();
  }

  // Floating arrow above the balloon, aimed (in 3D) at the next checkpoint.
  _updateGuideArrow(player, target) {
    const arrow = this.guideArrow;
    if (!target) { arrow.visible = false; return; }
    const p = player.group.position;
    arrow.visible = true;
    arrow.position.set(p.x, p.y + 20, p.z);
    const dir = this._arrowDir || (this._arrowDir = new THREE.Vector3());
    dir.copy(target).sub(p);
    if (dir.lengthSq() < 0.001) return;
    dir.normalize();
    // cone points +Y by default; rotate that to the direction of the target
    arrow.quaternion.setFromUnitVectors(UP, dir);
    // gentle bob
    arrow.position.y += Math.sin(this.courseSys.time * 3) * 0.6;
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.postfx.setSize(window.innerWidth, window.innerHeight);
  }
}

new Game();
