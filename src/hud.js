import { formatTime } from './course.js';
import { PHYSICS } from './balloon.js';

// DOM/canvas overlay HUD: altitude gauge, fuel bar, wind compass, race timer,
// and current checkpoint. Replaces the temporary debug text.
export class HUD {
  constructor(root = document.body) {
    const el = document.createElement('div');
    el.id = 'hud';
    el.className = 'hud-hidden';
    el.innerHTML = `
      <div class="timer">00:00.00</div>
      <div class="checkpoint">CHECKPOINT 0 / 0</div>
      <div class="splits"></div>
      <div class="place"></div>

      <div class="alt-gauge"><div class="fill"></div><div class="label">0 m</div></div>

      <div class="fuel">
        <div class="cap">FUEL</div>
        <div class="track"><div class="bar"></div></div>
      </div>

      <div class="compass">
        <div class="n">N</div>
        <div class="needle"></div>
        <div class="hub"></div>
        <div class="cap">WIND —</div>
      </div>

      <div class="powerup">
        <div class="pu-slot empty"><span class="pu-glyph">—</span></div>
        <div class="pu-hint">[E] USE</div>
        <div class="pu-active hud-hidden"><span class="pu-active-name"></span><div class="pu-active-bar"><div class="pu-active-fill"></div></div></div>
      </div>

      <div class="toast"></div>
    `;
    root.appendChild(el);
    this.el = el;
    this.timerEl = el.querySelector('.timer');
    this.cpEl = el.querySelector('.checkpoint');
    this.splitsEl = el.querySelector('.splits');
    this.placeEl = el.querySelector('.place');
    this.fillEl = el.querySelector('.alt-gauge .fill');
    this.altLabel = el.querySelector('.alt-gauge .label');
    this.fuelBar = el.querySelector('.fuel .bar');
    this.needle = el.querySelector('.compass .needle');
    this.compassCap = el.querySelector('.compass .cap');
    this.toastEl = el.querySelector('.toast');
    this.puSlot = el.querySelector('.pu-slot');
    this.puGlyph = el.querySelector('.pu-glyph');
    this.puActive = el.querySelector('.pu-active');
    this.puActiveName = el.querySelector('.pu-active-name');
    this.puActiveFill = el.querySelector('.pu-active-fill');
    this._toastTimer = 0;
  }

  // Held power-up slot. type = key (or null), info = { name, color, glyph }.
  setPowerup(type, info) {
    if (type && info) {
      this.puSlot.classList.remove('empty');
      this.puGlyph.textContent = info.glyph;
      this.puSlot.style.borderColor = '#' + info.color.toString(16).padStart(6, '0');
      this.puSlot.style.color = '#' + info.color.toString(16).padStart(6, '0');
    } else {
      this.puSlot.classList.add('empty');
      this.puGlyph.textContent = '—';
      this.puSlot.style.borderColor = '';
      this.puSlot.style.color = '';
    }
  }

  // Active timed effect readout. name=null hides it. pct is 0..1 remaining.
  setActiveEffect(name, pct) {
    if (name) {
      this.puActive.classList.remove('hud-hidden');
      this.puActiveName.textContent = name;
      this.puActiveFill.style.width = `${Math.max(0, pct) * 100}%`;
    } else {
      this.puActive.classList.add('hud-hidden');
    }
  }

  show() { this.el.classList.remove('hud-hidden'); }
  hide() { this.el.classList.add('hud-hidden'); }

  toast(text, ms = 1200) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this._toastTimer = ms / 1000;
  }

  // state: { altitude, fuel, time, index, count, wind:{dir,strength}, place, placeTotal, mode }
  update(delta, s) {
    // timer
    this.timerEl.textContent = formatTime(s.time);

    // checkpoint counter
    this.cpEl.textContent = `CHECKPOINT ${Math.min(s.index + 1, s.count)} / ${s.count}`;

    // altitude gauge
    const altPct = Math.max(0, Math.min(1, s.altitude / PHYSICS.maxAltitude));
    this.fillEl.style.height = `${altPct * 100}%`;
    this.altLabel.textContent = `${Math.round(s.altitude)} m`;

    // fuel bar w/ color shift
    const fpct = Math.max(0, s.fuel) / PHYSICS.fuelStart;
    this.fuelBar.style.width = `${fpct * 100}%`;
    this.fuelBar.style.background =
      fpct > 0.5 ? 'var(--good)' : fpct > 0.22 ? 'var(--warn)' : 'var(--bad)';

    // wind compass — needle points the way the wind blows (screen up = forward/-Z)
    if (s.wind) {
      // wind.dir is (x, z); on screen +x right, forward (-z) is up.
      const angle = Math.atan2(s.wind.dir.x, -s.wind.dir.y) * (180 / Math.PI);
      this.needle.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
      this.compassCap.textContent = `WIND ${s.wind.strength.toFixed(0)}`;
    }

    // placement (race mode)
    if (s.place && s.placeTotal) {
      this.placeEl.textContent = `${ordinal(s.place)} / ${s.placeTotal}`;
    } else {
      this.placeEl.textContent = '';
    }

    // toast fade
    if (this._toastTimer > 0) {
      this._toastTimer -= delta;
      if (this._toastTimer <= 0) this.toastEl.classList.remove('show');
    }
  }

  showSplits(splits) {
    if (!splits.length) {
      this.splitsEl.textContent = '';
      return;
    }
    const last = splits[splits.length - 1];
    this.splitsEl.textContent = `SPLIT ${formatTime(last)}`;
  }
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
