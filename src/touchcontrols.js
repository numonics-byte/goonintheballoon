export const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

export class TouchControls {
  constructor(input) {
    this.input = input;
    this.el = null;
    if (!IS_TOUCH) return;
    this._build();
  }

  _build() {
    this.el = document.createElement('div');
    this.el.id = 'touch-controls';
    this.el.classList.add('tc-hidden');
    this.el.innerHTML = `
      <div class="tc-joy-wrap">
        <div class="tc-joystick" id="tc-joy">
          <div class="tc-knob" id="tc-knob"></div>
        </div>
      </div>
      <div class="tc-btn-group">
        <button class="tc-btn tc-boost" id="tc-boost">BOOST</button>
        <button class="tc-btn tc-item" id="tc-item">ITEM</button>
      </div>
    `;
    document.body.appendChild(this.el);

    this._joy = this.el.querySelector('#tc-joy');
    this._knob = this.el.querySelector('#tc-knob');
    this._boostBtn = this.el.querySelector('#tc-boost');
    this._itemBtn = this.el.querySelector('#tc-item');

    this._joyId = null;
    this._joyOrigin = { x: 0, y: 0 };
    this._maxR = 44;

    this._wireJoystick();
    this._wireButtons();
  }

  _wireJoystick() {
    this._joy.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this._joyId !== null) return;
      const t = e.changedTouches[0];
      this._joyId = t.identifier;
      const r = this._joy.getBoundingClientRect();
      this._joyOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this._moveJoy(t.clientX, t.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this._joyId) {
          e.preventDefault();
          this._moveJoy(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
        }
      }
    }, { passive: false });

    const release = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this._joyId) {
          this._joyId = null;
          this._resetJoy();
        }
      }
    };
    window.addEventListener('touchend', release);
    window.addEventListener('touchcancel', release);
  }

  _moveJoy(cx, cy) {
    const dx = cx - this._joyOrigin.x;
    const dy = cy - this._joyOrigin.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, this._maxR);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    this._knob.style.transform = `translate(${nx * clamped}px, ${ny * clamped}px)`;

    const ratio = clamped / this._maxR;
    const dead = 0.22;
    this.input.left  = nx < -dead && ratio > dead;
    this.input.right = nx > dead  && ratio > dead;
    this.input.up    = ny < -dead && ratio > dead;
    this.input.down  = ny > dead  && ratio > dead;
  }

  _resetJoy() {
    this._knob.style.transform = 'translate(0px, 0px)';
    this.input.left = false;
    this.input.right = false;
    this.input.up = false;
    this.input.down = false;
  }

  _wireButtons() {
    const hold = (btn, key) => {
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); this.input[key] = true; }, { passive: false });
      btn.addEventListener('touchend',   (e) => { e.preventDefault(); this.input[key] = false; });
      btn.addEventListener('touchcancel',(e) => { e.preventDefault(); this.input[key] = false; });
    };
    hold(this._boostBtn, 'fwd');
    this._itemBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
    }, { passive: false });
    this._itemBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true }));
    });
    this._itemBtn.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true }));
    });
  }

  show() { if (this.el) this.el.classList.remove('tc-hidden'); }

  hide() {
    if (!this.el) return;
    this.el.classList.add('tc-hidden');
    this._resetJoy();
    this.input.fwd = false;
  }
}
