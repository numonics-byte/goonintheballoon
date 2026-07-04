// Comedic story cutscenes for the Grand Prix League "rescue" campaign.
// Each scene plays over a full-screen pixel-art backplate (with a slow Ken-Burns
// zoom). Lines reveal with a typewriter effect; click / Space / Enter advances,
// Esc or SKIP bails. Speaker names are colour-coded.

import { IS_TOUCH } from './touchcontrols.js';

const C = '/cutscenes/';

// Per-speaker accent colours for the name tag.
const SPEAKER_COLORS = {
  JOEL: '#ffcc33',
  ASA: '#ff7ad0',
  'THE AGENT': '#7ad0ff',
  CHAD: '#ff5a9e',
  'THE EXEC': '#ff5a3c',
  'NEWS ANCHOR': '#9fb6d4',
  NARRATOR: '#9fb6d4',
};

export const CUTSCENES = {
  intro: {
    title: 'THE CALL TO ACTION',
    music: 'cs-intro',
    video: C + 'cut_scene_1.mp4',
    setting: "Joel's Command Center — six monitors, a mountain of tissues, an ocean of GOON JUICE. He's deep in a session when every screen flips to an emergency broadcast.",
    lines: [
      { who: 'NEWS ANCHOR', text: "GLOBAL ALERT — Breaking news! Legendary adult film star Asa Akira is stranded at the very peak of the Himalayas! Extreme blizzards have grounded all helicopters. Only a low-tech, wind-powered vessel could possibly navigate the updrafts to reach her." },
      { who: 'JOEL', text: "They said my obsession was a weakness. Today... it's her only hope." },
      { who: 'NARRATOR', text: 'Outside, three black militarized balloons rise into the sky, emblazoned with corporate studio logos.' },
      { who: 'JOEL', text: "The Studio Executives... they're going after her. Not to save her — to lock her into an exclusive multi-year contract! Not on my watch." },
      { who: 'JOEL', text: 'Time to rise to the occasion.' },
    ],
  },
  mid: [
    {
      title: 'CUT SCENE 1 — THE FOOTHILLS',
      music: 'cs-canyon',
      video: C + 'cut_scene_2.mp4',
      setting: "Mid-air over snowy pines. Joel's patchwork 'TEAM GOON' rig — sock, lube bottle and all — clips the sleek black AGENCY balloon. Its pilot, a frantic man in a tailored suit, waves a clipboard.",
      lines: [
        { who: 'THE AGENT', text: "Are you crazy, kid?! Do you know the liability you're causing? She has three shoots this week! The logistics are a nightmare!" },
        { who: 'JOEL', text: "She's not a scheduling block, Gary! She's an artist! And she needs a blanket, not a contract!" },
        { who: 'THE AGENT', text: "You can't outrun the industry, Joel! The Talent is already in the Cloud Layer!" },
        { who: 'JOEL', text: "Tell 'em to hold their breath. I'm coming." },
      ],
    },
    {
      title: 'CUT SCENE 2 — THE CLOUD LAYER',
      music: 'cs-frosty',
      video: C + 'cut_scene_chad_cloud.mp4',
      setting: "A freezing, turbulent atmosphere. Chadwick 'The Brick' Steele dangles from a rocky outcrop, his grip failing and his tan visibly fading. Joel's patchwork balloon drifts into view overhead.",
      lines: [
        { who: 'CHAD', text: "Bro! My blue chew is freezing up here! Turn back! If anyone is gonna rescue her for the views, it's me! I've got an exclusive OnlyFans scene to film with Asa!" },
        { who: 'JOEL', text: "You don't respect the craft, Chad! You're just in it for the exposure! I'm in it for the love of the game. I didn't download 99 scenes of Asa to not get to 100." },
        { who: 'CHAD', text: "Obviously! Do you know how hard it is to maintain this girthy hog at 15,000 feet? Just let me have this win, bro!" },
        { who: 'JOEL', text: "A true gentleman never lets a bro steal the glory." },
        { who: 'NARRATOR', text: "Joel throws a heavy sandbag overboard, dropping weight and launching his balloon vertically past Chad, leaving him in a cloud of snow." },
      ],
    },
    {
      title: 'CUT SCENE 4 — THE DEATH ZONE',
      music: 'cs-city',
      video: C + 'cut_scene_4.mp4',
      setting: 'The perilous, jagged peaks just below the summit. The air is thin. A massive, heavily armored dreadnought of a balloon blocks Joel\'s path. The Studio Exec, smoking a cigar despite the altitude, glares down at him.',
      lines: [
        { who: 'THE EXEC', text: "End of the line, kid. We own the distribution rights to this mountain rescue. Turn your little arts-and-crafts project around." },
        { who: 'JOEL', text: "You can buy the rights, but you can't buy heart! And my balloon is fueled by pure, unadulterated dedication!" },
        { who: 'THE EXEC', text: "Dedication doesn't pay the overhead! Ram him!" },
        { who: 'NARRATOR', text: "The Exec's balloon lunges, but Joel expertly maneuvers, catching a thermal updraft. The Exec's balloon misses, tangling its basket on a jagged ice spire." },
        { who: 'THE EXEC', text: "Curse you, Joel! You'll never survive the final ascent! The wind shear will tear you apart!" },
        { who: 'JOEL', text: "I've weathered worse storms in the comment sections." },
      ],
    },
  ],
  end: {
    video: C + 'end_scene.mp4',
    credit: 'THIS IS A CAN U FEEL IT GAMES PRODUCTION.',
  },
  outro: {
    title: 'THE PEAK',
    music: 'cs-outro',
    image: C + 'outro_scene.jpeg',
    setting: 'The serene, sunlit summit beside the GOON CAVE sign, a fairytale castle far below. Asa Akira huddles in a heavy red parka, thoroughly annoyed. Joel touches down and falls to one knee.',
    lines: [
      { who: 'JOEL', text: "M'lady. The industry tried to stop me, but I have braved the elements to secure your safety." },
      { who: 'ASA', text: 'Are you... flying a balloon made out of vintage bedsheets and powered by a gaming PC?' },
      { who: 'JOEL', text: 'Water-cooled, actually. Your chariot awaits.' },
      { who: 'ASA', text: "Honestly? It beats dealing with my agent. Does this thing have a heater?" },
      { who: 'JOEL', text: 'Only the warmth of my unwavering respect.' },
      { who: 'ASA', text: "Great. I'll just sit near the burner. Let's get out of here, kid." },
      { who: 'NARRATOR', text: 'They float off toward the GOON CAVE as an 8-bit hero anthem swells. THE END.' },
    ],
  },
};

export class CutscenePlayer {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'cutscene hidden';
    this.el.innerHTML = `
      <div class="cs-bg"></div>
      <video class="cs-video" muted loop playsinline></video>
      <div class="cs-title"></div>
      <div class="cs-stage">
        <div class="cs-setting"></div>
        <div class="cs-box">
          <div class="cs-who"></div>
          <div class="cs-text"></div>
          <div class="cs-next">${IS_TOUCH ? 'TAP' : 'CLICK / SPACE'} &rsaquo;</div>
        </div>
      </div>
      <div class="cs-credit-text"></div>
      <button class="cs-skip">SKIP &raquo;</button>
    `;
    document.body.appendChild(this.el);
    this.bgEl = this.el.querySelector('.cs-bg');
    this.videoEl = this.el.querySelector('.cs-video');
    this.settingEl = this.el.querySelector('.cs-setting');
    this.whoEl = this.el.querySelector('.cs-who');
    this.textEl = this.el.querySelector('.cs-text');
    this.titleEl = this.el.querySelector('.cs-title');
    this.boxEl = this.el.querySelector('.cs-box');
    this.nextEl = this.el.querySelector('.cs-next');
    this.creditEl = this.el.querySelector('.cs-credit-text');

    this.typing = false;
    this._typeTimer = null;
    this._fullText = '';
    this.audio = null;

    this.el.addEventListener('pointerdown', (e) => {
      if (e.target.classList.contains('cs-skip')) return;
      this._advance();
    });
    this.el.querySelector('.cs-skip').addEventListener('click', () => this._finish());
    this._keyHandler = (e) => {
      if (this.el.classList.contains('hidden')) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this._advance(); }
      else if (e.code === 'Escape') this._finish();
    };
    window.addEventListener('keydown', this._keyHandler);
  }

  setAudio(audio) {
    this.audio = audio;
  }

  play(scene, onDone) {
    this.scene = scene;
    this.onDone = onDone;
    this.i = -1;
    this.el.classList.remove('hidden');
    if (this.audio && scene.music) this.audio.playTrack(scene.music);

    if (scene.video) {
      this.bgEl.style.background = 'transparent';
      this.bgEl.classList.remove('kb');
      this.videoEl.src = scene.video;
      this.videoEl.currentTime = 0;
      this.videoEl.style.display = 'block';
      this.videoEl.play().catch(() => {});
    } else {
      this.videoEl.style.display = 'none';
      this.videoEl.pause();
      this.videoEl.removeAttribute('src');
      if (scene.image) {
        this.bgEl.style.background =
          `linear-gradient(180deg, rgba(6,10,22,0.28), rgba(6,10,22,0.82)), url(${scene.image}) center/cover`;
      } else {
        this.bgEl.style.background = scene.bg || 'linear-gradient(160deg,#0a0f1f,#1a0f2a)';
      }
      this.bgEl.classList.remove('kb');
      void this.bgEl.offsetWidth;
      this.bgEl.classList.add('kb');
    }

    this.titleEl.textContent = scene.title || '';
    this.settingEl.textContent = scene.setting || '';

    if (scene.credit) {
      this.el.classList.add('credit-mode');
      this.creditEl.textContent = scene.credit;
    } else {
      this.el.classList.remove('credit-mode');
      this._advance();
    }
  }

  _advance() {
    if (this.scene && this.scene.credit) { this._finish(); return; }
    if (this.typing) { this._completeTyping(); return; }
    this.i++;
    if (!this.scene || this.i >= this.scene.lines.length) { this._finish(); return; }
    const line = this.scene.lines[this.i];
    this.whoEl.textContent = line.who;
    this.whoEl.style.background = SPEAKER_COLORS[line.who] || '#3a4a66';
    const narration = line.who === 'NARRATOR' || line.who === 'NEWS ANCHOR';
    this.boxEl.classList.toggle('narration', narration);
    this._startTyping(line.text);
  }

  _startTyping(text) {
    this._fullText = text;
    this.textEl.textContent = '';
    this.typing = true;
    this.nextEl.style.opacity = '0';
    let n = 0;
    clearInterval(this._typeTimer);

    let beepCount = 0;
    this._typeTimer = setInterval(() => {
      n += 2;
      this.textEl.textContent = text.slice(0, n);

      const char = text.charAt(n - 1);
      if (char && char !== ' ' && beepCount % 3 === 0) {
        if (this.audio && this.audio.playTextBeep) {
          this.audio.playTextBeep();
        }
      }
      beepCount++;

      if (n >= text.length) this._completeTyping();
    }, 16);
  }

  _completeTyping() {
    clearInterval(this._typeTimer);
    this.textEl.textContent = this._fullText;
    this.typing = false;
    this.nextEl.style.opacity = '1';
  }

  _finish() {
    if (this.el.classList.contains('hidden')) return;
    clearInterval(this._typeTimer);
    this.typing = false;
    this.el.classList.remove('credit-mode');
    this.videoEl.pause();
    this.videoEl.removeAttribute('src');
    this.videoEl.style.display = 'none';
    this.el.classList.add('hidden');
    const cb = this.onDone;
    this.onDone = null;
    this.scene = null;
    if (cb) cb();
  }
}
