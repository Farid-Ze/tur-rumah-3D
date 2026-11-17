import { TOUR_STOPS, FLOORPLAN_BOUNDS, detectRoomLabel } from '../data_tur.js';

export class UIController {
  constructor(viewer, player, dollhouse) {
    this.viewer = viewer;
    this.player = player;
    this.dollhouse = dollhouse;

    this.currentStopIdx = 0;
    this.currentMode = 'tour'; // 'tour' | 'walk' | 'dollhouse'
    this.autoTourActive = false;
    this.autoTourTimerStart = 0;
    this.minimapVisible = true;

    this.el = {
      loadingOverlay: document.getElementById('loading-overlay'),
      loadingFill: document.getElementById('loading-fill'),
      loadingText: document.getElementById('loading-text'),
      modeButtons: document.querySelectorAll('[data-mode]'),
      styleButtons: document.querySelectorAll('[data-style]'),
      btnEdges: document.getElementById('btn-edges'),
      btnRoofToggle: document.getElementById('btn-roof-toggle'),
      btnMinimapToggle: document.getElementById('btn-minimap-toggle'),
      btnPointerLock: document.getElementById('btn-pointer-lock'),
      sunSlider: document.getElementById('sun-slider'),
      sunLabel: document.getElementById('sun-label'),
      roomBadge: document.getElementById('room-badge'),
      sceneTabs: document.getElementById('scene-tabs'),
      tourCounter: document.getElementById('tour-counter'),
      tourTitle: document.getElementById('tour-title'),
      tourDesc: document.getElementById('tour-desc'),
      btnPrevStop: document.getElementById('btn-prev-stop'),
      btnNextStop: document.getElementById('btn-next-stop'),
      btnAutoTour: document.getElementById('btn-auto-tour'),
      autoProgress: document.getElementById('auto-tour-progress'),
      minimapPanel: document.getElementById('minimap-panel'),
      minimapWrap: document.getElementById('minimap-canvas-wrap'),
      minimapDot: document.getElementById('minimap-dot'),
      minimapCone: document.getElementById('minimap-cone'),
      minimapRoomLabel: document.getElementById('minimap-room-label'),
      walkHint: document.getElementById('walk-hint'),
      helpToggle: document.getElementById('btn-help-toggle'),
      helpPopover: document.getElementById('help-popover'),
      mobilePad: document.getElementById('mobile-dpad'),
    };

    this._buildSceneTabs();
    this._bindEvents();
  }

  _buildSceneTabs() {
    this.el.sceneTabs.innerHTML = '';
    TOUR_STOPS.forEach((stop, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'scene-tab';
      btn.dataset.stopIndex = String(idx);
      btn.innerHTML = `<span class="tab-num">${stop.number}</span><span class="tab-name">${stop.shortLabel}</span>`;
      btn.addEventListener('click', () => {
        this.stopAutoTour();
        this.goToStop(idx);
      });
      this.el.sceneTabs.appendChild(btn);
    });
  }

  _bindEvents() {
    this.el.modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.stopAutoTour();
        this.setMode(btn.dataset.mode);
      });
    });

    this.el.styleButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setStyle(btn.dataset.style);
      });
    });

    this.el.btnEdges.addEventListener('click', () => {
      const next = !this.viewer.edgesEnabled;
      this.viewer.setEdgesVisible(next);
      this.el.btnEdges.classList.toggle('active', next);
    });

    this.el.btnRoofToggle.addEventListener('click', () => {
      const next = !this.viewer.maketCutaway;
      this.viewer.setMaketCutaway(next);
      this.el.btnRoofToggle.classList.toggle('active', next);
    });

    this.el.btnMinimapToggle.addEventListener('click', () => {
      this.minimapVisible = !this.minimapVisible;
      this.el.minimapPanel.classList.toggle('hidden', !this.minimapVisible);
      this.el.btnMinimapToggle.classList.toggle('active', this.minimapVisible);
    });

    if (this.el.helpToggle && this.el.helpPopover) {
      this.el.helpToggle.addEventListener('click', () => {
        const shown = !this.el.helpPopover.classList.contains('hidden');
        this.el.helpPopover.classList.toggle('hidden', shown);
        this.el.helpToggle.classList.toggle('active', !shown);
      });
    }

    this.el.btnPointerLock.addEventListener('click', () => {
      if (this.currentMode !== 'walk') {
        this.setMode('walk');
      }
      this.player.requestPointerLock();
    });

    this.el.sunSlider.addEventListener('input', (e) => {
      const h = parseFloat(e.target.value);
      this.viewer.setSunHour(h);
      const hh = Math.floor(h);
      const mm = Math.round((h - hh) * 60);
      this.el.sunLabel.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    });

    this.el.btnPrevStop.addEventListener('click', () => {
      this.stopAutoTour();
      const prev = (this.currentStopIdx - 1 + TOUR_STOPS.length) % TOUR_STOPS.length;
      this.goToStop(prev);
    });

    this.el.btnNextStop.addEventListener('click', () => {
      this.stopAutoTour();
      const next = (this.currentStopIdx + 1) % TOUR_STOPS.length;
      this.goToStop(next);
    });

    this.el.btnAutoTour.addEventListener('click', () => {
      if (this.autoTourActive) {
        this.stopAutoTour();
      } else {
        this.startAutoTour();
      }
    });

    // Click on synchronized orthographic floorplan to teleport directly into room
    this.el.minimapWrap.addEventListener('click', (e) => {
      const rect = this.el.minimapWrap.getBoundingClientRect();
      const u = Math.max(0.03, Math.min(0.97, (e.clientX - rect.left) / rect.width));
      const v = Math.max(0.03, Math.min(0.97, (e.clientY - rect.top) / rect.height));
      const x = FLOORPLAN_BOUNDS.minX + u * FLOORPLAN_BOUNDS.width;
      const z = FLOORPLAN_BOUNDS.minZ + v * FLOORPLAN_BOUNDS.depth;
      this.stopAutoTour();
      if (this.currentMode === 'dollhouse') {
        this.setMode('walk');
      }
      this.player.teleportToXZ(x, z);
      this.viewer.dirty = true;
      this.update();
    });

    // Pause auto-tour if user grabs view or starts walking
    this.player.onUserInteract = () => {
      if (this.autoTourActive) {
        this.stopAutoTour();
      }
    };

    // Keyboard shortcuts (1-9 Scenes, Space Auto-Tour, E Edges, M Maket 3D)
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        const idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
        if (idx < TOUR_STOPS.length) {
          this.stopAutoTour();
          this.goToStop(idx);
        }
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (this.autoTourActive) this.stopAutoTour();
        else this.startAutoTour();
      } else if (e.code === 'KeyE') {
        const next = !this.viewer.edgesEnabled;
        this.viewer.setEdgesVisible(next);
        this.el.btnEdges.classList.toggle('active', next);
      } else if (e.code === 'KeyM') {
        this.stopAutoTour();
        this.setMode(this.currentMode === 'dollhouse' ? 'tour' : 'dollhouse');
      } else if (e.code === 'ArrowRight' && this.currentMode === 'tour') {
        this.stopAutoTour();
        this.goToStop((this.currentStopIdx + 1) % TOUR_STOPS.length);
      } else if (e.code === 'ArrowLeft' && this.currentMode === 'tour') {
        this.stopAutoTour();
        this.goToStop((this.currentStopIdx - 1 + TOUR_STOPS.length) % TOUR_STOPS.length);
      }
    });

    // Virtual touch / click D-pad buttons for mobile or mouse-only users
    document.querySelectorAll('[data-vkey]').forEach((btn) => {
      const code = btn.dataset.vkey;
      const down = (ev) => {
        ev.preventDefault();
        this.stopAutoTour();
        if (this.currentMode === 'dollhouse') this.setMode('walk');
        this.player.setVirtualKey(code, true);
      };
      const up = () => this.player.setVirtualKey(code, false);
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointerleave', up);
      btn.addEventListener('pointercancel', up);
    });
  }

  setLoadingProgress(pct, label) {
    this.el.loadingFill.style.width = `${Math.round(pct)}%`;
    if (label) this.el.loadingText.textContent = label;
    if (pct >= 100) {
      setTimeout(() => {
        this.el.loadingOverlay.classList.add('fade-out');
      }, 250);
    }
  }

  setStyle(styleName) {
    this.viewer.setStyle(styleName);
    this.el.styleButtons.forEach((b) => {
      b.classList.toggle('active', b.dataset.style === styleName);
    });
    this.el.btnEdges.classList.toggle('active', this.viewer.edgesEnabled);
  }

  setMode(mode) {
    this.currentMode = mode;
    this.el.modeButtons.forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });

    if (mode === 'dollhouse') {
      this.player.setMode('dollhouse');
      this.viewer.setMaketCutaway(true);
      this.el.btnRoofToggle.classList.add('active');
      const stop9 = TOUR_STOPS[TOUR_STOPS.length - 1];
      this.dollhouse.activate(stop9.eye, stop9.target, stop9.fov, 750);
      this.currentStopIdx = TOUR_STOPS.length - 1;
      this._updateTourMeta(stop9);
      this.el.walkHint.textContent = 'Seret putar maket · Scroll zoom · Klik kanan geser';
      this.el.btnPointerLock.classList.add('hidden');
      this.el.mobilePad.classList.add('hidden');
    } else {
      this.dollhouse.deactivate();
      this.player.setMode(mode);
      if (this.viewer.maketCutaway && mode === 'tour' && !TOUR_STOPS[this.currentStopIdx].dollhouse) {
        this.viewer.setMaketCutaway(false);
        this.el.btnRoofToggle.classList.remove('active');
      }
      if (mode === 'walk') {
        this.viewer.setMaketCutaway(false);
        this.el.btnRoofToggle.classList.remove('active');
        this.el.walkHint.textContent = 'WASD gerak · Seret lihat · Shift lari · Klik denah teleport';
        this.el.btnPointerLock.classList.remove('hidden');
        this.el.mobilePad.classList.remove('hidden');
      } else {
        this.el.walkHint.textContent = 'Tab 1–9 pilih Scene · Seret putar 360° · E garis · M maket';
        this.el.btnPointerLock.classList.add('hidden');
        this.el.mobilePad.classList.add('hidden');
      }
    }
  }

  goToStop(idx, durationMs = 900) {
    const stop = TOUR_STOPS[idx];
    if (!stop) return;
    this.currentStopIdx = idx;
    this._updateTourMeta(stop);

    if (stop.dollhouse) {
      this.currentMode = 'dollhouse';
      this.el.modeButtons.forEach((b) => b.classList.toggle('active', b.dataset.mode === 'dollhouse'));
      this.player.setMode('dollhouse');
      this.viewer.setMaketCutaway(true);
      this.el.btnRoofToggle.classList.add('active');
      this.dollhouse.activate(stop.eye, stop.target, stop.fov, durationMs);
      this.el.walkHint.textContent = 'Seret putar maket · Scroll zoom · Klik tab ruang';
      this.el.btnPointerLock.classList.add('hidden');
      this.el.mobilePad.classList.add('hidden');
    } else {
      if (this.currentMode === 'dollhouse') {
        this.currentMode = 'tour';
        this.el.modeButtons.forEach((b) => b.classList.toggle('active', b.dataset.mode === 'tour'));
        this.dollhouse.deactivate();
        this.player.setMode('tour');
      }
      this.viewer.setMaketCutaway(false);
      this.el.btnRoofToggle.classList.remove('active');
      this.player.glideToPose(stop.eye, stop.target, stop.fov, durationMs);
    }
  }

  _updateTourMeta(stop) {
    this.el.tourCounter.textContent = `${stop.number}/${String(TOUR_STOPS.length).padStart(2, '0')}`;
    this.el.tourTitle.textContent = stop.title;
    if (this.el.tourDesc) this.el.tourDesc.textContent = stop.description;
    document.querySelectorAll('.scene-tab').forEach((tab) => {
      tab.classList.toggle('active', parseInt(tab.dataset.stopIndex, 10) === this.currentStopIdx);
    });
  }

  startAutoTour() {
    this.autoTourActive = true;
    this.autoTourTimerStart = performance.now();
    this.el.btnAutoTour.classList.add('playing');
    this.el.btnAutoTour.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><rect x="3.5" y="3" width="3" height="10" rx="0.8"/><rect x="9.5" y="3" width="3" height="10" rx="0.8"/></svg><span>Jeda</span>';
    this.goToStop(this.currentStopIdx);
  }

  stopAutoTour() {
    if (!this.autoTourActive) return;
    this.autoTourActive = false;
    this.el.btnAutoTour.classList.remove('playing');
    this.el.btnAutoTour.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M4.5 3l8 5-8 5V3z"/></svg><span>Tur</span>';
    this.el.autoProgress.style.width = '0%';
  }

  update() {
    // Advance guided auto-tour timeline
    if (this.autoTourActive) {
      const stop = TOUR_STOPS[this.currentStopIdx];
      const elapsed = performance.now() - this.autoTourTimerStart;
      const frac = Math.min(1, elapsed / stop.dwellMs);
      this.el.autoProgress.style.width = `${(frac * 100).toFixed(1)}%`;
      if (elapsed >= stop.dwellMs) {
        const nextIdx = (this.currentStopIdx + 1) % TOUR_STOPS.length;
        this.autoTourTimerStart = performance.now();
        this.goToStop(nextIdx, 1100);
      }
    }

    // Update Minimap Camera Indicator & Active Room Name (only when changed!)
    const cam = this.viewer.camera;
    const u = (cam.position.x - FLOORPLAN_BOUNDS.minX) / FLOORPLAN_BOUNDS.width;
    const v = (cam.position.z - FLOORPLAN_BOUNDS.minZ) / FLOORPLAN_BOUNDS.depth;
    const uc = `${(Math.max(0.02, Math.min(0.98, u)) * 100).toFixed(2)}%`;
    const vc = `${(Math.max(0.02, Math.min(0.98, v)) * 100).toFixed(2)}%`;

    const lookDir = this.player.getLookDirection();
    const angleDeg = `${((Math.atan2(lookDir.z, lookDir.x) * 180) / Math.PI).toFixed(1)}deg`;

    if (this._lastU !== uc || this._lastV !== vc) {
      this._lastU = uc;
      this._lastV = vc;
      this.el.minimapDot.style.left = uc;
      this.el.minimapDot.style.top = vc;
      this.el.minimapCone.style.left = uc;
      this.el.minimapCone.style.top = vc;
    }
    if (this._lastAngle !== angleDeg) {
      this._lastAngle = angleDeg;
      this.el.minimapCone.style.transform = `translate(0, -50%) rotate(${angleDeg})`;
    }

    const detected = this.currentMode === 'dollhouse'
      ? 'Maket 3D (Potongan Atap)'
      : detectRoomLabel(cam.position.x, cam.position.z);
    if (this._lastRoom !== detected) {
      this._lastRoom = detected;
      this.el.roomBadge.textContent = detected;
      this.el.minimapRoomLabel.textContent = detected;
    }
  }
}
