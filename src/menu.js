import { COURSES } from './courses.js';
import { formatTime } from './course.js';

const LB_KEY = 'gitb_leaderboard_v1';

// ---------- localStorage Time-Attack leaderboard ----------
function loadLB() {
  try { return JSON.parse(localStorage.getItem(LB_KEY)) || {}; }
  catch { return {}; }
}
function saveLB(data) {
  try { localStorage.setItem(LB_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}
export function getTimes(courseId) {
  return (loadLB()[courseId] || []).slice().sort((a, b) => a - b).slice(0, 5);
}
export function getBest(courseId) {
  const t = getTimes(courseId);
  return t.length ? t[0] : null;
}
// Returns rank (1-based) if it made the top 5, else null.
export function addTime(courseId, time) {
  const data = loadLB();
  const list = (data[courseId] || []).concat(time).sort((a, b) => a - b).slice(0, 5);
  data[courseId] = list;
  saveLB(data);
  const rank = list.indexOf(time);
  return rank >= 0 ? rank + 1 : null;
}

// ---------- Menu screen manager ----------
export class Menus {
  constructor(handlers) {
    // handlers: { onStart({courseId, mode}), onResume, onRestart, onQuit,
    //             onSetMaster, onSetMusic, onSetMute, getSettings }
    this.h = handlers;
    this.selectedCourse = COURSES[0].id;

    this.root = document.createElement('div');
    document.body.appendChild(this.root);

    // flash element for checkpoint pulses
    this.flash = document.createElement('div');
    this.flash.id = 'flash';
    document.body.appendChild(this.flash);

    this.screen = document.createElement('div');
    this.screen.className = 'screen hidden';
    this.root.appendChild(this.screen);

    this._bindKeys();
  }

  _bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.h.onEscape) this.h.onEscape();
    });
  }

  hide() { this.screen.classList.add('hidden'); }
  _open(bgUrl, html) {
    this.screen.className = 'screen';
    // Set all background properties inline so they're never split across the
    // cascade (the title-screen's `background: transparent` shorthand resets
    // class-level background-size/repeat, causing the image to tile on re-entry).
    this.screen.style.backgroundImage = bgUrl ? `url(${bgUrl})` : 'none';
    this.screen.style.backgroundSize = 'cover';
    this.screen.style.backgroundPosition = 'top center';
    this.screen.style.backgroundRepeat = 'no-repeat';
    this.screen.innerHTML = `<div class="scrim"></div>${html}`;
  }

  // ---------------- Title ----------------
  showTitle() {
    // Looping title video as the backdrop; buttons sit at the bottom.
    this._open(null, `
      <video class="title-video" src="/Title_video.mp4" autoplay muted loop playsinline></video>
      <div class="menu-list">
        <button class="btn" data-act="start">START</button>
        <button class="btn ghost" data-act="settings">SETTINGS</button>
      </div>
    `);
    this.screen.classList.add('title-screen');
    if (this.h.onMenuMusic) this.h.onMenuMusic('title');
    // START runs the intro cutscene first (if unseen), then opens level select.
    const start = () => (this.h.onTitleStart ? this.h.onTitleStart() : this.showCourseSelect());
    // onStartKey must be a let so the button click can remove it before it fires.
    let onStartKey;
    this.screen.querySelector('[data-act="start"]').onclick = () => {
      if (onStartKey) window.removeEventListener('keydown', onStartKey);
      start();
    };
    this.screen.querySelector('[data-act="settings"]').onclick = () => this.showSettings(() => this.showTitle());
    onStartKey = (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        window.removeEventListener('keydown', onStartKey);
        start();
      }
    };
    window.addEventListener('keydown', onStartKey);
  }

  // ---------------- Course select ----------------
  // Selectable level cards laid over the level-select artwork (which has open
  // sky up top), positioned so they don't cover the cast or "Select your race".
  showCourseSelect() {
    const cards = COURSES.map((c, i) => {
      const best = getBest(c.id);
      return `
        <div class="course-card ${c.id === this.selectedCourse ? 'selected' : ''}" data-course="${c.id}">
          <div class="num">[${i + 1}]</div>
          <div class="preview" style="background:${c.preview}"></div>
          <div class="cname">${c.name.toUpperCase()}</div>
          <div class="cdesc">${c.subtitle}</div>
          <div class="cdesc">${best != null ? 'BEST ' + formatTime(best) : 'NO TIME'}</div>
        </div>`;
    }).join('');

    this._open('/level_select.jpeg', `
      <div class="course-grid">${cards}</div>
      <button class="btn ghost level-back" data-act="back">&larr; BACK</button>
    `);
    this.screen.classList.add('cards-screen');
    if (this.h.onMenuMusic) this.h.onMenuMusic('select');

    const selectCard = (id) => {
      this.selectedCourse = id;
      this.screen.querySelectorAll('.course-card').forEach((el) =>
        el.classList.toggle('selected', el.dataset.course === id));
    };
    this.screen.querySelectorAll('.course-card').forEach((el) => {
      el.onclick = () => { selectCard(el.dataset.course); this.showModeSelect(); };
    });
    this.screen.querySelector('[data-act="back"]').onclick = () => this.showTitle();

    const onKey = (e) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= COURSES.length) { window.removeEventListener('keydown', onKey); selectCard(COURSES[n - 1].id); this.showModeSelect(); }
      else if (e.code === 'Escape') { window.removeEventListener('keydown', onKey); this.showTitle(); }
    };
    window.addEventListener('keydown', onKey);
    this._courseKeyHandler = onKey;
  }

  // ---------------- Mode select ----------------
  showModeSelect() {
    if (this._courseKeyHandler) window.removeEventListener('keydown', this._courseKeyHandler);
    const course = COURSES.find((c) => c.id === this.selectedCourse);
    this._open(null, `
      <h1 class="game-title" style="font-size:clamp(30px,5vw,56px)">${course.name.toUpperCase()}</h1>
      <div class="subtitle">CHOOSE MODE</div>
      <div class="menu-list">
        <button class="btn" data-act="time">TIME ATTACK</button>
        <button class="btn" data-act="race">RACE (vs 3 RIVALS)</button>
        <button class="btn ghost" data-act="lb">LEADERBOARD</button>
        <button class="btn ghost" data-act="back">BACK</button>
      </div>
    `);
    this.screen.style.background = `linear-gradient(160deg, #1a2b4a, #0a1426)`;
    this.screen.querySelector('[data-act="time"]').onclick = () =>
      this.h.onStart({ courseId: this.selectedCourse, mode: 'timeattack' });
    this.screen.querySelector('[data-act="race"]').onclick = () =>
      this.h.onStart({ courseId: this.selectedCourse, mode: 'race' });
    this.screen.querySelector('[data-act="lb"]').onclick = () => this.showLeaderboard();
    this.screen.querySelector('[data-act="back"]').onclick = () => this.showCourseSelect();
  }

  showSoundtrack(back) {
    const tracks = [
      { role: 'title',           name: 'Welcum Back' },
      { role: 'menu',            name: 'Slave to the Cave' },
      { role: 'cs-intro',        name: 'Asa Akira (Cut Scene)' },
      { role: 'race-canyon',     name: 'Lift Off' },
      { role: 'results-canyon',  name: 'The Return' },
      { role: 'cs-canyon',       name: 'Cut Scene 1' },
      { role: 'race-frosty',     name: 'Gooning on the Go' },
      { role: 'results-frosty',  name: 'Skeet' },
      { role: 'cs-frosty',       name: 'Chad vs. Joel' },
      { role: 'race-city',       name: "Don't Stop (Reprise)" },
      { role: 'results-city',    name: 'Ass & Titties' },
      { role: 'cs-city',         name: 'The Balloon Heist' },
      { role: 'race-tropical',   name: 'Post Nut Clarity' },
      { role: 'cs-outro',        name: 'The End' },
      { role: 'results-tropical', name: "Give It All Up (80's)" },
    ];
    const rows = tracks.map((t, i) =>
      `<div class="strack-row" data-role="${t.role}">
        <span class="strack-num">${i + 1}.</span>
        <span class="strack-name">${t.name}</span>
      </div>`
    ).join('');
    this._open(null, `
      <h1 class="game-title" style="font-size:clamp(24px,4vw,44px)">SOUNDTRACK</h1>
      <div class="panel" style="max-height:62vh;overflow-y:auto;padding:12px 18px;min-width:380px;width:min(520px,90vw)">${rows}</div>
      <div class="menu-list" style="margin-top:18px">
        <button class="btn ghost" data-act="back">BACK</button>
      </div>
    `);
    this.screen.style.background = 'linear-gradient(160deg, #1a2b4a, #0a1426)';
    this.screen.querySelectorAll('.strack-row').forEach((row) => {
      row.onclick = () => {
        this.screen.querySelectorAll('.strack-row').forEach((r) => r.classList.remove('playing'));
        row.classList.add('playing');
        if (this.h.onPlayTrack) this.h.onPlayTrack(row.dataset.role);
      };
    });
    this.screen.querySelector('[data-act="back"]').onclick = back;
  }

  showLeaderboard() {
    const course = COURSES.find((c) => c.id === this.selectedCourse);
    const times = getTimes(course.id);
    const rows = times.length
      ? times.map((t, i) => `<div class="lb-row ${i === 0 ? 'best' : ''}"><span class="rank">${i + 1}.</span><span>${formatTime(t)}</span></div>`).join('')
      : '<div class="lb-row"><span>No times yet — race Time Attack!</span></div>';
    this._open(null, `
      <h1 class="game-title" style="font-size:clamp(28px,4vw,48px)">${course.name.toUpperCase()}</h1>
      <div class="panel"><h2>TIME ATTACK — TOP 5</h2>${rows}</div>
      <div class="menu-list" style="margin-top:18px">
        <button class="btn ghost" data-act="back">BACK</button>
      </div>
    `);
    this.screen.style.background = `linear-gradient(160deg, #1a2b4a, #0a1426)`;
    this.screen.querySelector('[data-act="back"]').onclick = () => this.showModeSelect();
  }

  // ---------------- Pause ----------------
  showPause() {
    const s = this.h.getSettings();
    this._open(null, `
      <h1 class="game-title" style="font-size:clamp(30px,5vw,56px)">PAUSED</h1>
      <div class="menu-list">
        <button class="btn" data-act="resume">RESUME</button>
        <button class="btn" data-act="restart">RESTART</button>
        <button class="btn ghost" data-act="quit">QUIT TO MENU</button>
      </div>
      ${this._settingsBlock(s)}
    `);
    this.screen.style.background = 'rgba(6,12,26,0.55)';
    this.screen.querySelector('[data-act="resume"]').onclick = () => this.h.onResume();
    this.screen.querySelector('[data-act="restart"]').onclick = () => this.h.onRestart();
    this.screen.querySelector('[data-act="quit"]').onclick = () => this.h.onQuit();
    this._wireSettings();
  }

  // ---------------- Results ----------------
  showResults(data) {
    // data: { mode, courseId, time, rank, order:[{name,time,me}] }
    const course = COURSES.find((c) => c.id === data.courseId);
    let body = '';
    if (data.mode === 'race') {
      const rows = data.order.map((o, i) =>
        `<div class="lb-row ${o.me ? 'me' : ''}"><span class="rank">${i + 1}.</span><span>${o.name}</span><span>${o.time != null ? formatTime(o.time) : 'DNF'}</span></div>`
      ).join('');
      const place = data.order.findIndex((o) => o.me) + 1;
      body = `<div class="subtitle">${ordinal(place)} PLACE</div><div class="panel">${rows}</div>`;
    } else {
      const newRec = data.rank === 1 ? '<div class="subtitle" style="color:var(--good)">NEW BEST!</div>' : '';
      const times = getTimes(course.id);
      const rows = times.map((t, i) =>
        `<div class="lb-row ${t === data.time && i + 1 === data.rank ? 'best' : ''}"><span class="rank">${i + 1}.</span><span>${formatTime(t)}</span></div>`
      ).join('');
      body = `${newRec}<div class="results-time">${formatTime(data.time)}</div>
              <div class="panel"><h2>TOP 5</h2>${rows}</div>`;
    }
    this._open(null, `
      <h1 class="game-title" style="font-size:clamp(30px,5vw,56px)">FINISH!</h1>
      <div style="opacity:.8;margin-bottom:6px">${course.name}</div>
      ${body}
      <div class="row" style="margin-top:20px">
        <button class="btn" data-act="retry">RACE AGAIN</button>
        <button class="btn ghost" data-act="menu">MENU</button>
      </div>
    `);
    this.screen.style.background = `linear-gradient(160deg, #16335a, #081021)`;
    this.screen.querySelector('[data-act="retry"]').onclick = () =>
      this.h.onStart({ courseId: data.courseId, mode: data.mode });
    this.screen.querySelector('[data-act="menu"]').onclick = () => this.showCourseSelect();
  }

  // ---------------- Settings ----------------
  showSettings(back) {
    const s = this.h.getSettings();
    this._open(null, `
      <h1 class="game-title" style="font-size:clamp(28px,4vw,48px)">SETTINGS</h1>
      ${this._settingsBlock(s)}
      <div class="menu-list" style="margin-top:18px">
        <button class="btn ghost" data-act="soundtrack">SOUNDTRACK</button>
        <button class="btn ghost" data-act="back">BACK</button>
      </div>
    `);
    this.screen.style.background = `linear-gradient(160deg, #1a2b4a, #0a1426)`;
    this._wireSettings();
    this.screen.querySelector('[data-act="soundtrack"]').onclick = () => this.showSoundtrack(() => this.showSettings(back));
    this.screen.querySelector('[data-act="back"]').onclick = back;
  }

  _settingsBlock(s) {
    return `
      <div class="panel" style="min-width:360px">
        <div class="settings-row">
          <span>Master Volume</span>
          <input type="range" min="0" max="1" step="0.05" value="${s.master}" data-set="master">
        </div>
        <div class="settings-row">
          <span>Music Volume</span>
          <input type="range" min="0" max="1" step="0.05" value="${s.music}" data-set="music">
        </div>
        <div class="settings-row">
          <span>Mute</span>
          <input type="checkbox" data-set="mute" ${s.muted ? 'checked' : ''}>
        </div>
      </div>`;
  }

  _wireSettings() {
    const master = this.screen.querySelector('[data-set="master"]');
    const music = this.screen.querySelector('[data-set="music"]');
    const mute = this.screen.querySelector('[data-set="mute"]');
    if (master) master.oninput = () => this.h.onSetMaster(parseFloat(master.value));
    if (music) music.oninput = () => this.h.onSetMusic(parseFloat(music.value));
    if (mute) mute.onchange = () => this.h.onSetMute(mute.checked);
  }
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
