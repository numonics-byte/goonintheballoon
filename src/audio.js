import { Howl, Howler } from 'howler';

// Music: the finished soundtrack, one file per game "role". Streamed via
// html5 and crossfaded by playTrack(). SFX (burner/wind/chime/text-beep) are
// still synthesized WAV data-URIs.
const MUSIC = {
  title: '/soundtrack/title.mp3',
  menu: '/soundtrack/menu.mp3',
  'cs-intro': '/soundtrack/cs-intro.mp3',
  'cs-canyon': '/soundtrack/cs-canyon.mp3',
  'cs-frosty': '/soundtrack/cs-frosty.mp3',
  'cs-city': '/soundtrack/cs-city.mp3',
  'cs-outro': '/soundtrack/cs-outro.mp3',
  'race-canyon': '/soundtrack/race-canyon.mp3',
  'race-frosty': '/soundtrack/race-frosty.mp3',
  'race-city': '/soundtrack/race-city.mp3',
  'race-tropical': '/soundtrack/race-tropical.mp3',
  'results-canyon': '/soundtrack/results-canyon.mp3',
  'results-frosty': '/soundtrack/results-frosty.mp3',
  'results-city': '/soundtrack/results-city.mp3',
  'results-tropical': '/soundtrack/results-tropical.mp3',
};

export class AudioManager {
  constructor() {
    this.ready = false;
    this.master = 0.8;
    this.musicVol = 0.5;
    this.sfxVol = 0.9;
    this.muted = false;
    this._unlocked = false;   // becomes true on the first user gesture
    this._tracks = {};        // role -> Howl (lazily created)
    this._current = null;     // role of the active music track
    this._musicIntent = null; // role queued before audio was unlocked
    this._pauseTimers = [];   // pending fade-out pause timeouts
  }

  _clearPauseTimers() {
    this._pauseTimers.forEach(clearTimeout);
    this._pauseTimers = [];
  }

  init() {
    if (this.ready) return;
    this.ready = true;
    // we stream up to 15 html5 music tracks over a session (default pool is 10)
    Howler.html5PoolSize = 20;

    this.burner = new Howl({
      src: [genWavURI(genNoise(1.2, 0.18))],
      format: ['wav'], loop: true, volume: 0,
    });
    this.wind = new Howl({
      src: [genWavURI(genNoise(2.0, 0.06))],
      format: ['wav'], loop: true, volume: 0,
    });
    this.chime = new Howl({
      src: [genWavURI(genChime(1.1))],
      format: ['wav'], volume: this.sfxVol,
    });
    this.textBeep = new Howl({
      src: [genWavURI(genTextBeep(0.06))],
      format: ['wav'], volume: this.sfxVol,
    });

    Howler.volume(this.muted ? 0 : this.master);
  }

  _ensureTrack(role) {
    if (this._tracks[role]) return this._tracks[role];
    const src = MUSIC[role];
    if (!src) return null;
    const h = new Howl({ src: [src], html5: true, loop: true, volume: 0 });
    this._tracks[role] = h;
    return h;
  }

  // Crossfade to a soundtrack role (see MUSIC). Playback only starts once the
  // audio is unlocked by a user gesture, so we never double-trigger blocked
  // HTML5 streams; an already-playing role just fades back up (idempotent).
  playTrack(role) {
    this._musicIntent = role;
    if (this._unlocked) this._applyTrack(role);
  }

  // Call from the first user gesture: unlock and start the intended track.
  unlock() {
    if (!this.ready) this.init();
    this._unlocked = true;
    if (this._musicIntent) this._applyTrack(this._musicIntent);
  }

  _applyTrack(role) {
    if (!this.ready) this.init();
    // Cancel any pending pause timeouts so stale timers don't silence a track
    // that was just re-started by a rapid transition.
    this._clearPauseTimers();
    // Stop all other tracks — including ones still loading (h.playing() === false
    // during the async HTML5 load phase). stop() cancels a pending deferred play.
    for (const [name, h] of Object.entries(this._tracks)) {
      if (name !== role) {
        if (h.volume() > 0) h.fade(h.volume(), 0, 200);
        const t = h;
        const id = setTimeout(() => { t.stop(); }, 250);
        this._pauseTimers.push(id);
      }
    }
    const track = this._ensureTrack(role);
    if (!track) return;
    this._current = role;
    track.loop(true);
    if (!track.playing()) { track.volume(0); track.play(); }
    // Fade from current volume (handles mid-fade-out recovery and initial fade-in).
    track.fade(track.volume(), this.musicVol, 600);
  }

  resumeMenu() { this.unlock(); }

  // Silence all music (fade + pause).
  stopMusic() {
    this._musicIntent = null;
    this._current = null;
    this._clearPauseTimers();
    for (const h of Object.values(this._tracks)) {
      if (h.volume() > 0) h.fade(h.volume(), 0, 200);
      const t = h;
      const id = setTimeout(() => { t.stop(); }, 250);
      this._pauseTimers.push(id);
    }
  }

  startAmbient() {
    if (!this.ready) this.init();
    if (!this.burner.playing()) this.burner.play();
    if (!this.wind.playing()) this.wind.play();
  }

  stopAmbient() {
    if (!this.ready) return;
    this.burner.volume(0);
    this.wind.volume(0);
  }

  // Called each frame while racing.
  update(delta, { burning, altitude, maxAltitude }) {
    if (!this.ready) return;
    const target = burning ? 0.6 : 0.0;
    this.burner.volume(lerpVol(this.burner.volume(), target, delta * 6));
    // wind ambient rises with altitude (thinner, louder air up high)
    const wt = 0.12 + 0.4 * Math.min(1, altitude / maxAltitude);
    this.wind.volume(lerpVol(this.wind.volume(), wt, delta * 2));
  }

  checkpoint() {
    if (!this.ready) return;
    this.chime.volume(this.sfxVol);
    this.chime.play();
  }

  playTextBeep() {
    if (!this.ready) return;
    this.textBeep.volume(this.sfxVol);
    this.textBeep.play();
  }

  // ---- settings ----
  setMaster(v) {
    this.master = v;
    if (!this.muted) Howler.volume(v);
  }
  setMusic(v) {
    this.musicVol = v;
    if (!this.ready) return;
    for (const h of Object.values(this._tracks)) {
      if (h.playing()) h.volume(v);
    }
  }
  setSfx(v) { this.sfxVol = v; }
  setMuted(m) {
    this.muted = m;
    Howler.volume(m ? 0 : this.master);
  }
}

function lerpVol(a, b, t) { return a + (b - a) * Math.min(1, t); }

// ---------- tiny WAV synth ----------
const SR = 22050;

function genNoise(seconds, smooth) {
  const n = Math.floor(SR * seconds);
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    // one-pole lowpass for a softer "whoosh"
    prev = prev + smooth * (white - prev);
    out[i] = prev * 0.9;
  }
  // fade ends so the loop is seamless
  const f = Math.floor(SR * 0.03);
  for (let i = 0; i < f; i++) {
    const g = i / f;
    out[i] *= g;
    out[n - 1 - i] *= g;
  }
  return out;
}

function genTextBeep(seconds) {
  const n = Math.floor(SR * seconds);
  const out = new Float32Array(n);
  const freq = 600;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 90);
    const s = Math.sin(2 * Math.PI * freq * t) + (Math.random() * 0.2 - 0.1);
    out[i] = s * env * 0.15;
  }
  return out;
}

function genChime(seconds) {
  const n = Math.floor(SR * seconds);
  const out = new Float32Array(n);
  const freqs = [880, 1320, 1760, 2640];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.exp(-t * 5);
    let s = 0;
    for (let k = 0; k < freqs.length; k++) {
      s += Math.sin(2 * Math.PI * freqs[k] * t) * (1 / (k + 1));
    }
    out[i] = (s / 2) * env * 0.6;
  }
  return out;
}

function genWavURI(samples) {
  const n = samples.length;
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const w = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
  w(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);   // PCM
  view.setUint16(22, 1, true);   // mono
  view.setUint32(24, SR, true);
  view.setUint32(28, SR * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  w(36, 'data');
  view.setUint32(40, n * 2, true);
  let off = 44;
  for (let i = 0; i < n; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  // base64 encode
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}
