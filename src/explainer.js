/**
 * CPU Simulator — Animated Explainer Engine
 * Cinematic animation system. Episode 1: "How a CPU Executes an Instruction"
 *
 * Architecture:
 *   ExplainerEngine  — timeline runner, animation primitives, canvas renderer
 *   EPISODES         — array of episode factories (each builds a timeline)
 *   Watch mode UI    — canvas overlay + controls injected into the page
 *
 * Does NOT modify cpu.js, assembler.js, ui.js, style.css, or any bb-*.js file.
 */

/* ═══════════════════════════════════════════════════════════
   EASING FUNCTIONS
═══════════════════════════════════════════════════════════ */

const Ease = {
  linear:    t => t,
  inOut:     t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t,
  out:       t => 1-(1-t)*(1-t),
  outCubic:  t => 1 - Math.pow(1-t, 3),
  outQuart:  t => 1 - Math.pow(1-t, 4),
  inCubic:   t => t*t*t,
  bounce:    t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1/d1)       return n1*t*t;
    if (t < 2/d1)       return n1*(t-=1.5/d1)*t + 0.75;
    if (t < 2.5/d1)     return n1*(t-=2.25/d1)*t + 0.9375;
    return n1*(t-=2.625/d1)*t + 0.984375;
  },
  elasticOut: t => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10*t) * Math.sin((t-0.075) * (2*Math.PI) / 0.3) + 1;
  },
};

/* ═══════════════════════════════════════════════════════════
   COLOUR PALETTE
═══════════════════════════════════════════════════════════ */

const C = {
  bg:           '#06090f',
  bgPanel:      '#0a0f1a',
  pc:           '#00ddff',
  pcDim:        '#003a50',
  mar:          '#00cc88',
  marDim:       '#003322',
  ram:          '#44bb66',
  ramDim:       '#0a2010',
  ir:           '#bb66ff',
  irDim:        '#2a0a40',
  regA:         '#4488ff',
  regADim:      '#0a1a40',
  regB:         '#2266cc',
  regBDim:      '#05102a',
  alu:          '#ff8844',
  aluDim:       '#2a1200',
  out:          '#ffcc00',
  outDim:       '#2a2000',
  bus:          '#ffcc00',
  busDim:       'rgba(255,204,0,0.12)',
  addrBus:      '#00cc88',
  addrBusDim:   'rgba(0,204,136,0.12)',
  ctrlBus:      '#ff4444',
  ctrlBusDim:   'rgba(255,68,68,0.12)',
  ctrl:         '#ff4444',
  ctrlDim:      '#2a0808',
  textPrimary:  '#e8f0f8',
  textSecondary:'#7a9ab8',
  textMuted:    '#3a5268',
  textCode:     '#79c0ff',
  white:        '#ffffff',
  black:        '#000000',
  dataGlow:     '#ffffff',
  particleA:    '#4488ff',
  particleB:    '#00ddff',
  success:      '#00ff88',
};

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */

function lerp(a, b, t) { return a + (b-a)*t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return [r, g, b];
}

function rgbaStr(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function toBinary8(n) {
  return ((n >>> 0) & 0xFF).toString(2).padStart(8, '0');
}

function toHex2(n) {
  return ((n >>> 0) & 0xFF).toString(16).padStart(2, '0').toUpperCase();
}

/* ═══════════════════════════════════════════════════════════
   ANIMATION STEP BASE
═══════════════════════════════════════════════════════════ */

class Step {
  constructor(duration, drawFn, opts = {}) {
    this.duration  = duration;   // ms
    this.drawFn    = drawFn;     // (ctx, progress, engine) => void
    this.onStart   = opts.onStart  || null;
    this.onEnd     = opts.onEnd    || null;
    this.blocking  = opts.blocking !== false; // default blocking (waits before advancing)
    this.easing    = opts.easing   || Ease.inOut;
    this.label     = opts.label    || '';     // chapter label
    this.sceneId   = opts.sceneId  || 0;
    this.id        = opts.id       || null;
    this.audio     = opts.audio    || null;   // audio clip id (filename without .mp3)
  }
}

/* ═══════════════════════════════════════════════════════════
   EXPLAINER ENGINE
═══════════════════════════════════════════════════════════ */

class ExplainerEngine {
  constructor(canvas) {
    this.canvas      = canvas;
    this.ctx         = canvas.getContext('2d');
    this.timeline    = [];
    this.currentStep = 0;
    this.stepT       = 0;    // ms elapsed in current step
    this.lastTimestamp = 0;
    this.playing     = false;
    this.speed       = 1;
    this.rafId       = null;
    this.awaitingClick = false;
    this.showCaptions  = true;
    this.onStepChange  = null;   // callback(stepIndex, totalSteps)
    this.onSceneChange = null;   // callback(sceneLabel)
    this.onPlayChange  = null;   // callback(playing)
    this.onComplete    = null;   // callback()

    // Persistent "scene state" — layers that persist across steps
    this._layers = [];           // {id, draw(ctx, engine)} drawn every frame before step
    this._particles = [];        // active particle systems

    // Canvas dimensions (updated on resize)
    this.W = canvas.offsetWidth  || 1280;
    this.H = canvas.offsetHeight || 720;

    // Camera: for zoom effects
    this.cam = { x: 0, y: 0, scale: 1, tx: 0, ty: 0, ts: 1 };

    // Shared scene state readable by draw functions
    this.scene = {};

    // ── Audio system ──
    this._audioCache  = {};       // id → Audio element
    this._currentAudio = null;    // currently playing Audio element
    this._audioMuted   = false;
    this._audioVolume  = 0.85;    // 0..1
    this._audioBasePath = 'audio/'; // path prefix for MP3 files

    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(canvas.parentElement || canvas);
    this._onResize();
  }

  /* ── Dimensions ── */
  _onResize() {
    const wrap = this.canvas.parentElement;
    if (!wrap) return;
    this.W = wrap.clientWidth  || 1280;
    this.H = wrap.clientHeight || 720;
    this.canvas.width  = this.W;
    this.canvas.height = this.H;
    if (!this.playing) this._drawFrame(0);
  }

  /* ── Timeline management ── */
  addStep(step) {
    this.timeline.push(step);
    return this;
  }

  clear() {
    this.stopAudio();
    this.timeline    = [];
    this.currentStep = 0;
    this.stepT       = 0;
    this._layers     = [];
    this._particles  = [];
    this.scene       = {};
    this.cam         = { x:0, y:0, scale:1, tx:0, ty:0, ts:1 };
  }

  /* ── Playback control ── */
  play() {
    if (this.currentStep >= this.timeline.length) {
      this.currentStep = 0;
      this.stepT = 0;
    }
    this.playing = true;
    this.awaitingClick = false;
    this.lastTimestamp = performance.now();
    this.resumeAudio();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(ts => this._tick(ts));

    if (this.onPlayChange) this.onPlayChange(true);
  }

  pause() {

    this.playing = false;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.pauseAudio();
    if (this.onPlayChange) this.onPlayChange(false);
  }

  toggle() {
    if (this.awaitingClick) {
      this.advance();
    } else if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  // Called when user clicks canvas or presses space during waitForClick
  advance() {
    if (!this.awaitingClick) return;
    this.awaitingClick = false;
    this._moveToNextStep();
    this.play();
  }

  seekToStep(index) {
    const was = this.playing;
    this.pause();
    this.stopAudio();
    this.currentStep = clamp(index, 0, this.timeline.length - 1);
    this.stepT = 0;
    const step = this.timeline[this.currentStep];
    if (step && step.onStart) step.onStart(this);
    this._drawFrame(0);
    if (was) this.play();
    if (this.onStepChange) this.onStepChange(this.currentStep, this.timeline.length);
  }

  stepForward() {
    const was = this.playing;
    this.pause();
    this.awaitingClick = false;
    if (this.currentStep < this.timeline.length - 1) {
      this._moveToNextStep();
    }
    this._drawFrame(0);
    if (was) this.play();
  }

  stepBackward() {
    const was = this.playing;
    this.pause();
    this.stopAudio();
    this.awaitingClick = false;
    if (this.currentStep > 0) {
      this.currentStep--;
      this.stepT = 0;
      const step = this.timeline[this.currentStep];
      if (step && step.onStart) step.onStart(this);
    }
    this._drawFrame(0);
    if (was) this.play();
  }

  get progress() {
    if (!this.timeline.length) return 0;
    const totalTime = this.timeline.reduce((s, st) => s + st.duration, 0);
    let elapsed = 0;
    for (let i = 0; i < this.currentStep; i++) elapsed += this.timeline[i].duration;
    elapsed += this.stepT;
    return elapsed / totalTime;
  }

  get progressSteps() {
    return this.currentStep / Math.max(1, this.timeline.length - 1);
  }

  get totalDurationSec() {
    return this.timeline.reduce((s, st) => s + st.duration, 0) / 1000;
  }

  get elapsedSec() {
    let t = 0;
    for (let i = 0; i < this.currentStep; i++) t += this.timeline[i].duration;
    t += this.stepT;
    return t / 1000;
  }

  /* ── RAF loop ── */
  _tick(timestamp) {
    if (!this.playing) return;
    try {
      const dt = Math.min((timestamp - this.lastTimestamp) * this.speed, 200);
      this.lastTimestamp = timestamp;

      this.stepT += dt;

      const step = this.timeline[this.currentStep];
      if (!step) { this._onComplete(); return; }

      if (this.stepT >= step.duration) {
        // Step finished

        this._drawFrame(1);
        if (step.onEnd) step.onEnd(this);
        this._moveToNextStep();


        if (this.currentStep >= this.timeline.length) {

          this._onComplete();
          return;
        }
      } else {
        this._drawFrame(this.stepT / step.duration);
      }
    } catch (err) {
      console.error('[Explainer] tick error at step', this.currentStep, err);
    }

    // Always request next frame if still playing
    if (this.playing) {
      this.rafId = requestAnimationFrame(ts => this._tick(ts));
    }
  }

  _moveToNextStep() {
    if (this.currentStep < this.timeline.length - 1) {
      this.currentStep++;
      this.stepT = 0;
      const next = this.timeline[this.currentStep];
      if (next) {
        if (next.onStart) next.onStart(this);
        if (next.audio) this.playAudio(next.audio);
        if (next.label && this.onSceneChange) this.onSceneChange(next.label, next.sceneId);
        if (this.onStepChange) this.onStepChange(this.currentStep, this.timeline.length);
      }
    } else {
      this.currentStep = this.timeline.length;
    }
  }

  _onComplete() {
    this.playing = false;
    this.stopAudio();
    if (this.onPlayChange) this.onPlayChange(false);
    if (this.onComplete)   this.onComplete();
  }

  /* ── Draw ── */
  _drawFrame(rawProgress) {
    const step = this.timeline[this.currentStep];
    if (!step) return;
    const progress = step.easing(clamp(rawProgress, 0, 1));

    const ctx = this.ctx;
    ctx.save();

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, this.W, this.H);

    // Camera transform
    const cx = this.W / 2, cy = this.H / 2;
    const s = this.cam.scale;
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-cx + this.cam.x, -cy + this.cam.y);

    // Draw persistent layers
    for (const layer of this._layers) {
      ctx.save();
      try {
        layer.draw(ctx, this);
      } catch (err) {
        // Draw error on screen so user can see it
        ctx.restore();
        ctx.save();
        ctx.fillStyle = '#ff4444';
        ctx.font = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`LAYER ERROR [${layer.id}]: ${err.message}`, 10, 40);
        ctx.fillText(`${err.stack?.split('\n')[1]?.trim() || ''}`, 10, 58);
      }
      ctx.restore();
    }

    // Draw particles
    this._updateParticles(ctx);

    // Draw current step
    ctx.save();
    try {
      step.drawFn(ctx, progress, this);
    } catch (err) {
      ctx.restore();
      ctx.save();
      ctx.fillStyle = '#ff4444';
      ctx.font = '14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`STEP ERROR [${this.currentStep}]: ${err.message}`, 10, 80);
      ctx.fillText(`${err.stack?.split('\n')[1]?.trim() || ''}`, 10, 98);
    }
    ctx.restore();

    ctx.restore();
  }

  /* ── Particles ── */
  _updateParticles(ctx) {
    const now = performance.now();
    this._particles = this._particles.filter(p => {
      const age = (now - p.born) / p.life;
      if (age >= 1) return false;
      const ea = Ease.out(1 - age);
      ctx.save();
      ctx.globalAlpha = ea * p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      const sz = p.size * ea;
      ctx.beginPath();
      ctx.arc(
        p.x + p.vx * age * p.life / 1000,
        p.y + p.vy * age * p.life / 1000 + p.gravity * age * age * p.life / 1000,
        sz, 0, Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
      return true;
    });
  }

  spawnParticles(x, y, color, count = 12) {
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const angle  = (Math.PI * 2 * i / count) + Math.random() * 0.5;
      const speed  = 40 + Math.random() * 80;
      this._particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        gravity: 50,
        color,
        size:  2 + Math.random() * 3,
        alpha: 0.9,
        life:  600 + Math.random() * 400,
        born:  now,
      });
    }
  }

  /* ── Layer management ── */
  setLayer(id, drawFn) {
    const existing = this._layers.findIndex(l => l.id === id);
    if (existing >= 0) {
      this._layers[existing].draw = drawFn;
    } else {
      this._layers.push({ id, draw: drawFn });
    }
  }

  removeLayer(id) {
    this._layers = this._layers.filter(l => l.id !== id);
  }

  clearLayers() {
    this._layers = [];
  }

  /* ═══════════════════════════════════════
     DRAWING PRIMITIVES
  ═══════════════════════════════════════ */

  // ── Text: fade in optionally with typewriter ──
  drawText(ctx, text, x, y, opts = {}) {
    const {
      font      = '20px Inter, sans-serif',
      color     = C.textPrimary,
      alpha     = 1,
      align     = 'left',
      baseline  = 'alphabetic',
      shadow    = false,
      shadowColor = color,
      shadowBlur  = 15,
      maxWidth,
    } = opts;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (shadow) {
      ctx.shadowBlur  = shadowBlur;
      ctx.shadowColor = shadowColor;
    }
    if (maxWidth !== undefined) {
      ctx.fillText(text, x, y, maxWidth);
    } else {
      ctx.fillText(text, x, y);
    }
    ctx.restore();
  }

  // Typewriter text — pass progress 0..1, returns final revealed string
  typewriterText(ctx, text, x, y, progress, opts = {}) {
    const visible = Math.ceil(text.length * clamp(progress, 0, 1));
    const shown   = text.slice(0, visible);
    this.drawText(ctx, shown, x, y, opts);
  }

  // ── Wrapped text block ──
  drawTextBlock(ctx, lines, x, y, lineHeight, opts = {}) {
    lines.forEach((line, i) => {
      this.drawText(ctx, line, x, y + i * lineHeight, opts);
    });
  }

  // ── Fade text in/out ──
  fadeText(ctx, text, x, y, progress, opts = {}) {
    const a = opts.fadeOut ? 1 - progress : progress;
    this.drawText(ctx, text, x, y, { ...opts, alpha: a * (opts.baseAlpha || 1) });
  }

  // ── Component box ──
  drawComponent(ctx, label, subLabel, x, y, w, h, color, opts = {}) {
    const {
      alpha    = 1,
      scale    = 1,
      glow     = false,
      glowColor = color,
      glowAmt  = 20,
      valueText = null,
      valueColor = C.textCode,
      borderColor = null,
      headerH  = 22,
      compact  = false,  // mobile compact mode
      // binaryValue: when set, bits become the PRIMARY display
      // bitHighlight: array of 8 booleans — which bit positions are arriving (flash effect)
      // bitArrive: progress 0..1 for sequential bit-arrival animation
    } = opts;

    ctx.save();
    ctx.globalAlpha = alpha;

    const cx = x + w/2, cy = y + h/2;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    const r = 8;

    // Glow
    if (glow) {
      ctx.shadowBlur  = glowAmt;
      ctx.shadowColor = glowColor;
    }

    // Body
    ctx.fillStyle = rgbaStr(color, 0.12);
    ctx.strokeStyle = borderColor || rgbaStr(color, 0.7);
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.stroke();

    // Responsive sizing
    const hH = compact ? 16 : headerH;
    const labelSize = compact ? 9 : 11;
    const subSize = compact ? 7 : 9;
    const valSize = compact ? 10 : 14;

    // Header band
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgbaStr(color, 0.25);
    this._roundRectTop(ctx, x, y, w, hH, r);
    ctx.fill();

    // Label
    ctx.shadowBlur = glow ? 10 : 0;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.font = `bold ${labelSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w/2, y + hH/2);

    // ── PRIMARY BIT DISPLAY — bits are the main content ──
    if (opts.binaryValue !== undefined && opts.binaryValue >= 0) {
      const bits = opts.binaryValue.toString(2).padStart(8, '0');
      const bodyH = h - hH;

      if (compact) {
        // ── COMPACT (mobile): small bit cells at bottom ──
        const bitW = Math.min(8, (w - 8) / 9);
        const bitH = Math.min(8, bodyH * 0.38);
        const bitGap = 1;
        const totalBitsW = 8 * bitW + 7 * bitGap;
        let bx = x + (w - totalBitsW) / 2;
        const by = y + h - bitH - 4;

        for (let i = 0; i < 8; i++) {
          const bit = bits[i];
          const arriving = opts.bitHighlight && opts.bitHighlight[i];
          const bitColor = arriving ? '#ffffff' : (bit === '1' ? valueColor : color);
          ctx.fillStyle = bit === '1' ? rgbaStr(bitColor, arriving ? 1.0 : 0.75) : rgbaStr(color, 0.12);
          if (bit === '1' || arriving) {
            ctx.shadowBlur  = arriving ? 12 : 6;
            ctx.shadowColor = bitColor;
          } else {
            ctx.shadowBlur = 0;
          }
          ctx.fillRect(bx, by, bitW, bitH);
          ctx.shadowBlur = 0;
          ctx.strokeStyle = bit === '1' ? rgbaStr(bitColor, 0.6) : rgbaStr(color, 0.2);
          ctx.lineWidth = 0.5;
          ctx.strokeRect(bx, by, bitW, bitH);
          ctx.fillStyle = bit === '1' ? '#fff' : rgbaStr(color, 0.3);
          ctx.font = `bold ${Math.max(5, bitW * 0.75)}px JetBrains Mono, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(bit, bx + bitW / 2, by + bitH / 2);
          bx += bitW + bitGap;
        }

        // Decimal small text below header on compact
        if (valueText !== null) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = rgbaStr(valueColor, 0.7);
          ctx.font = `bold ${valSize - 2}px JetBrains Mono, Courier New, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(valueText, x + w/2, y + hH + bodyH * 0.38);
        }

      } else {
        // ── DESKTOP: large bits as PRIMARY content ──
        // Bit index labels: 7 6 5 4 3 2 1 0
        const bitW = Math.min(14, (w - 14) / 8.8);
        const bitH = Math.min(14, bodyH * 0.38);
        const bitGap = Math.min(2, (w - 14 - 8 * bitW) / 7);
        const totalBitsW = 8 * bitW + 7 * bitGap;
        let bx = x + (w - totalBitsW) / 2;
        const idxY = y + hH + 6;
        const bitY = idxY + 9;

        // Sub label above bits (small)
        if (subLabel) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = rgbaStr(color, 0.45);
          ctx.font = `${subSize}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(subLabel, x + w/2, y + hH + 4);
        }

        // Bit index numbers above each cell
        for (let i = 0; i < 8; i++) {
          const idxNum = 7 - i;
          ctx.fillStyle = rgbaStr(color, 0.35);
          ctx.font = `${Math.max(6, bitW * 0.55)}px JetBrains Mono, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowBlur = 0;
          ctx.fillText(`${idxNum}`, bx + bitW / 2, idxY);
          bx += bitW + bitGap;
        }

        // Bit cells
        bx = x + (w - totalBitsW) / 2;
        for (let i = 0; i < 8; i++) {
          const bit = bits[i];
          const arriving = opts.bitHighlight && opts.bitHighlight[i];
          const bitColor = arriving ? '#ffffff' : (bit === '1' ? valueColor : color);

          // Cell background
          ctx.fillStyle = bit === '1'
            ? rgbaStr(bitColor, arriving ? 1.0 : 0.82)
            : rgbaStr(color, 0.08);
          if (bit === '1' || arriving) {
            ctx.shadowBlur  = arriving ? 14 : 8;
            ctx.shadowColor = bitColor;
          } else {
            ctx.shadowBlur = 0;
          }
          this._roundRect(ctx, bx, bitY, bitW, bitH, 2);
          ctx.fill();

          ctx.shadowBlur = 0;
          ctx.strokeStyle = bit === '1' ? rgbaStr(bitColor, 0.7) : rgbaStr(color, 0.22);
          ctx.lineWidth = 0.75;
          this._roundRect(ctx, bx, bitY, bitW, bitH, 2);
          ctx.stroke();

          // Bit digit
          const digitColor = bit === '1' ? (arriving ? color : '#000') : rgbaStr(color, 0.35);
          ctx.fillStyle = digitColor;
          ctx.font = `bold ${Math.max(7, bitW * 0.72)}px JetBrains Mono, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(bit, bx + bitW / 2, bitY + bitH / 2);

          bx += bitW + bitGap;
        }

        // Decimal value small below bit cells
        if (valueText !== null) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = rgbaStr(valueColor, 0.65);
          ctx.font = `bold ${Math.max(9, valSize - 2)}px JetBrains Mono, Courier New, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const decY = bitY + bitH + (h - (bitY + bitH - y) - 6);
          ctx.fillText(valueText, x + w/2, decY > y + h - 5 ? y + h - 7 : decY);
        }
      }

    } else {
      // ── NO BINARY VALUE: original text-only display ──
      if (subLabel && !compact) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = rgbaStr(color, 0.55);
        ctx.font = `${subSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(subLabel, x + w/2, y + hH + 8);
      }

      if (valueText !== null) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = valueColor;
        ctx.font = `bold ${valSize}px JetBrains Mono, Courier New, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(valueText, x + w/2, y + h/2 + (compact ? 0 : (subLabel ? 4 : 0)));
      }
    }

    // ── Read/Write indicator badges ──
    // opts.rwState: 'read' | 'write' | 'both' | null
    if (opts.rwState) {
      const badgeH = compact ? 10 : 14;
      const badgeFont = `bold ${compact ? 6 : 8}px JetBrains Mono, monospace`;
      ctx.font = badgeFont;
      ctx.shadowBlur = 0;

      if (opts.rwState === 'read' || opts.rwState === 'both') {
        // READ badge (blue/cyan — data coming IN)
        const readLabel = compact ? 'IN' : '◄ READ';
        const readW = ctx.measureText(readLabel).width + 8;
        const readX = x - readW - 3;
        const readY = y + h / 2 - badgeH / 2;
        ctx.fillStyle = rgbaStr('#44ddff', 0.2);
        this._roundRect(ctx, readX, readY, readW, badgeH, 3);
        ctx.fill();
        ctx.strokeStyle = rgbaStr('#44ddff', 0.7);
        ctx.lineWidth = 1;
        this._roundRect(ctx, readX, readY, readW, badgeH, 3);
        ctx.stroke();
        ctx.fillStyle = '#44ddff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(readLabel, readX + readW / 2, readY + badgeH / 2);
      }

      if (opts.rwState === 'write' || opts.rwState === 'both') {
        // WRITE badge (amber — data going OUT)
        const writeLabel = compact ? 'OUT' : 'WRITE ►';
        const writeW = ctx.measureText(writeLabel).width + 8;
        const writeX = x + w + 3;
        const writeY = y + h / 2 - badgeH / 2;
        ctx.fillStyle = rgbaStr('#ffcc00', 0.2);
        this._roundRect(ctx, writeX, writeY, writeW, badgeH, 3);
        ctx.fill();
        ctx.strokeStyle = rgbaStr('#ffcc00', 0.7);
        ctx.lineWidth = 1;
        this._roundRect(ctx, writeX, writeY, writeW, badgeH, 3);
        ctx.stroke();
        ctx.fillStyle = '#ffcc00';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(writeLabel, writeX + writeW / 2, writeY + badgeH / 2);
      }
    }

    // ── Enable pins (IN/OUT) on component edges ──
    // opts.enablePins: array of { name, side:'left'|'right', type:'in'|'out'|'internal', active }
    // opts.compact controls sizing
    if (opts.enablePins && opts.enablePins.length > 0 && !opts.compact) {
      this._drawEnablePins(ctx, x, y, w, h, opts.enablePins, alpha);
    }

    ctx.restore();
  }

  // ── Draw enable/load pins on a component's edges ──
  // pins: array of { name, side:'left'|'right'|'top', type:'in'|'out'|'internal', active }
  _drawEnablePins(ctx, compX, compY, compW, compH, pins, compAlpha) {
    if (!pins || pins.length === 0) return;

    const pinR  = 4;      // pin circle radius
    const fontSz = 7;     // label font size

    // Group pins by base side for counting
    const leftPins  = pins.filter(p => p.side.includes('left'));
    const rightPins = pins.filter(p => p.side.includes('right'));
    const topPins   = pins.filter(p => p.side === 'top');

    const typeColors = {
      'in':       '#44ddff',   // cyan — reads from bus
      'out':      '#ffcc44',   // amber — writes to bus
      'internal': '#cccccc',   // white-ish — internal
    };

    const drawPin = (pin, px, py) => {
      const col   = typeColors[pin.type] || '#cccccc';
      const isAct = pin.active;

      ctx.save();
      ctx.globalAlpha = compAlpha * (isAct ? 1 : 0.35);

      const isLeft   = pin.side.includes('left');
      const isRight  = pin.side.includes('right');
      const isTop    = pin.side.includes('top') && !isLeft && !isRight;
      const isBottom = pin.side.includes('bottom') && !isLeft && !isRight;

      // Pin circle
      if (isAct) {
        ctx.shadowBlur  = 8;
        ctx.shadowColor = col;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.arc(px, py, pinR, 0, Math.PI * 2);
      ctx.fillStyle = isAct ? rgbaStr(col, 0.9) : rgbaStr(col, 0.15);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Label (with vertical offset to avoid overlaps between neighboring components)
      const lOff = pin.labelOffset || 0;
      ctx.globalAlpha = compAlpha * (isAct ? 1 : 0.35);
      ctx.fillStyle   = isAct ? col : rgbaStr(col, 0.55);
      if (isAct) { ctx.shadowBlur = 4; ctx.shadowColor = col; }
      ctx.font = `bold ${fontSz}px JetBrains Mono, monospace`;
      ctx.textBaseline = 'middle';

      if (isLeft) {
        ctx.textAlign = 'right';
        ctx.fillText(pin.name, px - 4, py + lOff);
      } else if (isRight) {
        ctx.textAlign = 'left';
        ctx.fillText(pin.name, px + 4, py + lOff);
      } else if (isBottom) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(pin.name, px + lOff, py + 3);
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(pin.name, px + lOff, py - 5);
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    };

    // ── Position each pin based on its side (supports corners) ──
    const margin = 10; // inset from corner

    for (const pin of pins) {
      let px, py;
      switch (pin.side) {
        case 'left':
          px = compX; py = compY + compH / 2; break;
        case 'right':
          px = compX + compW; py = compY + compH / 2; break;
        case 'top':
          px = compX + compW / 2; py = compY; break;
        case 'bottom':
          px = compX + compW / 2; py = compY + compH; break;
        case 'top-left':
          px = compX; py = compY + margin; break;
        case 'top-right':
          px = compX + compW; py = compY + margin; break;
        case 'bottom-left':
          px = compX; py = compY + compH - margin; break;
        case 'bottom-right':
          px = compX + compW; py = compY + compH - margin; break;
        default:
          px = compX; py = compY + compH / 2;
      }
      drawPin(pin, px, py);
    }

  }

  // ── Draw thin control wires from CU to each component's pin ──
  // cuX, cuY: CU bounding box top-left
  // cuW, cuH: CU bounding box size
  // compPinMap: array of { name, type, compX, compY, compW, compH, side, active }
  //   Each entry has a resolved screen position for the pin
  // On mobile this is a no-op (too cluttered)
  drawSignalWires(ctx, cuX, cuY, cuW, cuH, compPinMap, opts = {}) {
    const { alpha = 1, isMobile = false, controlBusY = 0 } = opts;
    if (isMobile || alpha <= 0 || !compPinMap || compPinMap.length === 0) return;

    const now = performance.now();
    const CTRL_SIGNALS = ['CO','CE','MI','RO','RI','II','IO','AI','AO','BI','EO','SU','OI','FI','HLT'];

    // Each signal gets its own dedicated line on the control bus (spaced 2.2px apart like drawBus)
    const ctrlLineSpacing = 5;
    const ctrlTotalH = (CTRL_SIGNALS.length - 1) * ctrlLineSpacing;
    const ctrlTopY = controlBusY - ctrlTotalH / 2;

    ctx.save();

    // 15 signal pins spread across CU top edge
    const cuTopY = cuY;
    const pinSpacing = cuW / (CTRL_SIGNALS.length + 1);

    // Pre-compute: count how many wires go to each component, assign horizontal offsets
    // so wires to the same component don't stack on top of each other
    const compWireCounts = {};  // key → count
    const compWireIndex = {};   // key → next index
    for (const entry of compPinMap) {
      const k = entry.key || entry.name;
      compWireCounts[k] = (compWireCounts[k] || 0) + 1;
    }
    // Reset index counters
    for (const k in compWireCounts) compWireIndex[k] = 0;

    for (const entry of compPinMap) {
      const isAct  = entry.active;
      const sigIdx = CTRL_SIGNALS.indexOf(entry.name);
      if (sigIdx < 0) continue;

      // CU top pin X for this signal
      const cuPinX = cuX + (sigIdx + 1) * pinSpacing;
      const cuPinY = cuTopY;

      // This signal's dedicated control bus line Y
      const busLineY = ctrlTopY + sigIdx * ctrlLineSpacing;

      // Component's enable pin position
      const pinX = entry.pinX;
      const pinY = entry.pinY;

      // Horizontal offset so wires to same component don't overlap
      const k = entry.key || entry.name;
      const nWires = compWireCounts[k] || 1;
      const wireIdx = compWireIndex[k] || 0;
      compWireIndex[k] = wireIdx + 1;
      const wireSpread = 14;  // pixels between parallel wires
      const wireOffsetX = (wireIdx - (nWires - 1) / 2) * wireSpread;
      const destX = pinX + wireOffsetX;

      ctx.globalAlpha = alpha * (isAct ? 1.0 : 0.5);

      if (isAct) {
        ctx.strokeStyle = C.ctrl;
        ctx.lineWidth   = 2;
        ctx.shadowBlur  = 6;
        ctx.shadowColor = C.ctrl;
      } else {
        ctx.strokeStyle = rgbaStr(C.ctrl, 0.5);
        ctx.lineWidth   = 1;
        ctx.shadowBlur  = 0;
      }
      ctx.setLineDash([]);

      // Route THROUGH the control bus:
      // CU pin → down to dedicated control bus line → horizontal along bus → up to component pin
      // Two separate paths: CU-to-bus and bus-to-component

      // Path 1: CU pin down to control bus
      ctx.beginPath();
      ctx.moveTo(cuPinX, cuPinY);
      ctx.lineTo(cuPinX, busLineY);
      ctx.stroke();

      // Path 2: along the control bus (horizontal) — this IS the bus line for this signal
      ctx.beginPath();
      ctx.moveTo(cuPinX, busLineY);
      ctx.lineTo(destX, busLineY);
      ctx.stroke();

      // Path 3: control bus up to component pin
      ctx.beginPath();
      ctx.moveTo(destX, busLineY);
      ctx.lineTo(destX, pinY);
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Label at CU pin
      ctx.fillStyle = isAct ? C.ctrl : rgbaStr(C.ctrl, 0.3);
      ctx.font = `bold ${isAct ? 6 : 5}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(entry.name, cuPinX, cuPinY - 9);

      // Label at component pin
      ctx.fillStyle = isAct ? C.ctrl : rgbaStr(C.ctrl, 0.35);
      ctx.font = `bold ${isAct ? 7 : 5}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = pinY < busLineY ? 'bottom' : 'top';
      ctx.fillText(entry.name, destX, pinY < busLineY ? pinY - 5 : pinY + 5);

      // No pulse dots — clean wires only, no junction markers
    }

    ctx.restore();
  }

  // ── Compute pin screen position for a given component + pin definition ──
  // Returns { pinX, pinY } in canvas coordinates
  _pinScreenPos(compX, compY, compW, compH, side, idx, total) {
    const margin = 10;
    switch (side) {
      case 'left':         return { pinX: compX, pinY: compY + compH / 2 };
      case 'right':        return { pinX: compX + compW, pinY: compY + compH / 2 };
      case 'top':          return { pinX: compX + compW / 2, pinY: compY };
      case 'bottom':       return { pinX: compX + compW / 2, pinY: compY + compH };
      case 'top-left':     return { pinX: compX, pinY: compY + margin };
      case 'top-right':    return { pinX: compX + compW, pinY: compY + margin };
      case 'bottom-left':  return { pinX: compX, pinY: compY + compH - margin };
      case 'bottom-right': return { pinX: compX + compW, pinY: compY + compH - margin };
      default:             return { pinX: compX, pinY: compY + compH / 2 };
    }
  }

  // ── Compute bit cell positions for a component ──
  // Returns array of 8 {x, y} positions (bit 7 first, bit 0 last)
  getBitCellPositions(compX, compY, compW, compH, compact = false) {
    const hH = compact ? 16 : 22;
    if (compact) {
      const bitW = Math.min(8, (compW - 8) / 9);
      const bitGap = 1;
      const totalBitsW = 8 * bitW + 7 * bitGap;
      const startX = compX + (compW - totalBitsW) / 2;
      const bitH = 7;
      const by = compY + compH - bitH - 2;
      const positions = [];
      for (let i = 0; i < 8; i++) {
        positions.push({
          x: startX + i * (bitW + bitGap) + bitW / 2,
          y: by + bitH / 2,
          top: by,
          bottom: by + bitH,
        });
      }
      return positions;
    } else {
      const bitW = Math.min(14, (compW - 14) / 8.8);
      const bitGap = Math.min(2, (compW - 14 - 8 * bitW) / 7);
      const totalBitsW = 8 * bitW + 7 * bitGap;
      const startX = compX + (compW - totalBitsW) / 2;
      const idxY = compY + hH + 6;
      const bitY = idxY + 9;
      const bitH = Math.min(14, (compH - hH - 20) * 0.38);
      const positions = [];
      for (let i = 0; i < 8; i++) {
        positions.push({
          x: startX + i * (bitW + bitGap) + bitW / 2,
          y: bitY + bitH / 2,
          top: bitY,
          bottom: bitY + bitH,
        });
      }
      return positions;
    }
  }

  // ── Draw wires from bus to component bit cells ──
  // busType: 'data' (8 wires), 'address' (4 wires), 'control' (1 wire)
  drawBitWires(ctx, busY, compX, compY, compW, compH, opts = {}) {
    const {
      alpha    = 1,
      color    = C.bus,
      active   = false,
      busValue = -1,
      compact  = false,
      above    = false,
      busType  = 'data',
    } = opts;

    const nLines      = busType === 'address' ? 4 : 8;
    const lineSpacing = busType === 'address' ? 3.0 : 3.5;
    const totalH      = (nLines - 1) * lineSpacing;

    const bitPositions = this.getBitCellPositions(compX, compY, compW, compH, compact);
    const cellOffset = busType === 'address' ? 4 : 0;

    ctx.save();
    ctx.globalAlpha = alpha;

    for (let i = 0; i < nLines; i++) {
      const busLineY = busY - totalH / 2 + i * lineSpacing;
      const cellIdx  = cellOffset + i;
      const cellPos  = bitPositions[Math.min(cellIdx, bitPositions.length - 1)];
      const bitIndex = (nLines - 1) - i;
      const bit      = busValue >= 0 ? ((busValue >>> bitIndex) & 1) : -1;

      // Each wire goes STRAIGHT from its bit cell X position down/up to the bus
      // No convergence — each wire has its own clear path
      const cellX     = cellPos.x;
      const cellEdgeY = above ? cellPos.bottom + 1 : cellPos.top - 1;

      if (active && bit >= 0) {
        ctx.strokeStyle = bit === 1 ? color : rgbaStr(color, 0.1);
        ctx.lineWidth   = bit === 1 ? 1.5 : 0.5;
        ctx.shadowBlur  = bit === 1 ? 4 : 0;
        ctx.shadowColor = color;
      } else if (active) {
        ctx.strokeStyle = rgbaStr(color, 0.3);
        ctx.lineWidth   = 0.5;
        ctx.shadowBlur  = 0;
      } else {
        ctx.strokeStyle = rgbaStr(color, 0.12);
        ctx.lineWidth   = 0.3;
        ctx.shadowBlur  = 0;
      }

      // Each wire goes straight from bit cell to bus — no corners, just diagonal
      const busCenterX = compX + compW / 2;
      const busLineX   = busCenterX + (i - (nLines - 1) / 2) * lineSpacing;

      ctx.beginPath();
      ctx.moveTo(cellX, cellEdgeY);
      ctx.lineTo(busLineX, busLineY);
      ctx.stroke();

      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  // ── Horizontal bus ──
  // busType: 'data' (8 lines, amber), 'address' (4 lines, green), 'control' (red)
  drawBus(ctx, x1, y, x2, opts = {}) {
    const {
      alpha    = 1,
      color    = C.bus,
      thick    = 6,
      active   = false,
      busValue = -1,   // -1 = don't show bits, otherwise show individual bit lines
      busType  = 'data',  // 'data' | 'address' | 'control'
    } = opts;

    const isMob = this.W < 600;

    // Number of parallel lines depends on bus type
    const CTRL_SIGNALS = ['CO','CE','MI','RO','RI','II','IO','AI','AO','BI','EO','SU','OI','FI','HLT'];
    let nLines, lineSpacing;
    if (busType === 'address') {
      nLines = 4;
      lineSpacing = 3.0;
    } else if (busType === 'control') {
      nLines = 15;
      lineSpacing = isMob ? 1.5 : 5;
    } else {
      nLines = 8;
      lineSpacing = 3.5;
    }
    const totalH = (nLines - 1) * lineSpacing;
    const topY   = y - totalH / 2;

    // Bus label
    let busLabel, busWidth;
    if (busType === 'address') {
      busLabel = isMob ? '/4' : 'ADDRESS BUS /4';
      busWidth = '4';
    } else if (busType === 'control') {
      busLabel = isMob ? 'CTRL /15' : 'CONTROL BUS /15';
      busWidth = '15';
    } else {
      busLabel = isMob ? '/8' : 'DATA BUS /8';
      busWidth = '8';
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    // Active signals list (for control bus)
    const activeSignals = opts.activeSignals || [];

    for (let i = 0; i < nLines; i++) {
      const bitY     = topY + i * lineSpacing;
      const bitIndex = (nLines - 1) - i;  // MSB at top

      let isHigh = false;
      if (busType === 'control') {
        // Each line = one named signal. Check if it's in the active list.
        const sigName = CTRL_SIGNALS[i];
        isHigh = activeSignals.includes(sigName);
      } else {
        isHigh = busValue >= 0 ? (((busValue >>> bitIndex) & 1) === 1) : false;
      }

      if (active && busType === 'control') {
        // Control bus: active signals bright red, inactive dim
        ctx.strokeStyle = isHigh ? color : rgbaStr(color, 0.08);
        ctx.lineWidth   = isHigh ? 1.8 : 0.5;
        ctx.shadowBlur  = isHigh ? 5 : 0;
        ctx.shadowColor = color;
      } else if (active && busValue >= 0) {
        ctx.strokeStyle = isHigh ? color : rgbaStr(color, 0.12);
        ctx.lineWidth   = isHigh ? 2 : 1;
        ctx.shadowBlur  = isHigh ? 6 : 0;
        ctx.shadowColor = color;
      } else if (active) {
        ctx.strokeStyle = rgbaStr(color, 0.4);
        ctx.lineWidth   = 1.5;
        ctx.shadowBlur  = 4;
        ctx.shadowColor = color;
      } else {
        ctx.strokeStyle = rgbaStr(color, 0.15);
        ctx.lineWidth   = busType === 'control' ? 0.5 : 1;
        ctx.shadowBlur  = 0;
      }

      ctx.beginPath();
      ctx.moveTo(x1, bitY);
      ctx.lineTo(x2, bitY);
      ctx.stroke();
    }

    // ── Labels on right end (desktop only) ──
    if (!isMob && active) {
      const labelX = x2 + 4;
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      if (busType === 'control') {
        // Show signal names instead of bit indices
        ctx.font = `bold ${Math.max(5, lineSpacing * 0.8)}px JetBrains Mono, monospace`;
        for (let i = 0; i < nLines; i++) {
          const bitY = topY + i * lineSpacing;
          const sigName = CTRL_SIGNALS[i];
          const isActive = activeSignals.includes(sigName);
          ctx.fillStyle = isActive ? color : rgbaStr(color, 0.2);
          ctx.fillText(sigName, labelX, bitY);
        }
      } else if (busValue >= 0) {
        // Show bit indices for data/address bus
        ctx.font = `bold 7px JetBrains Mono, monospace`;
        for (let i = 0; i < nLines; i++) {
          const bitY     = topY + i * lineSpacing;
          const bitIndex = (nLines - 1) - i;
          const bit      = (busValue >>> bitIndex) & 1;
          ctx.fillStyle = bit === 1 ? color : rgbaStr(color, 0.3);
          ctx.fillText(`${bitIndex}`, labelX, bitY);
        }
      }
    }

    // Bus label
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgbaStr(color, alpha * 0.55);
    ctx.font = `${isMob ? 6 : Math.max(7, Math.min(9, this.W / 160))}px JetBrains Mono, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(busLabel, x1 + 2, y - totalH / 2 - 6);

    if (!isMob && busWidth) {
      // Slash notation on desktop
      const slashX = x1 + (busType === 'address' ? 92 : 76);
      const slashY = y;
      ctx.strokeStyle = rgbaStr(color, alpha * 0.45);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(slashX - 4, slashY + totalH/2 + 2);
      ctx.lineTo(slashX + 4, slashY - totalH/2 - 2);
      ctx.stroke();
      ctx.fillStyle = rgbaStr(color, alpha * 0.55);
      ctx.font = `bold 9px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(busWidth, slashX + 8, slashY - totalH/2 - 4);
    }

    ctx.restore();
  }

  // ── Vertical bus segment ──
  drawBusV(ctx, x, y1, y2, opts = {}) {
    const {
      alpha  = 1,
      color  = C.bus,
      thick  = 3,
      active = false,
      busValue = -1,
    } = opts;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Draw 8 individual bit lines vertically
    const lineSpacing = 3.5;
    const totalW = 7 * lineSpacing;
    const leftX = x - totalW / 2;

    for (let i = 0; i < 8; i++) {
      const bitX = leftX + i * lineSpacing;
      const bit = busValue >= 0 ? ((busValue >>> (7 - i)) & 1) : -1;

      if (active && bit >= 0) {
        ctx.strokeStyle = bit === 1 ? color : rgbaStr(color, 0.12);
        ctx.lineWidth   = bit === 1 ? 2 : 1;
        if (bit === 1) {
          ctx.shadowBlur  = 5;
          ctx.shadowColor = color;
        } else {
          ctx.shadowBlur = 0;
        }
      } else if (active) {
        ctx.strokeStyle = rgbaStr(color, 0.35);
        ctx.lineWidth   = 1;
        ctx.shadowBlur  = 3;
        ctx.shadowColor = color;
      } else {
        ctx.strokeStyle = rgbaStr(color, 0.12);
        ctx.lineWidth   = 1;
        ctx.shadowBlur  = 0;
      }

      ctx.beginPath();
      ctx.moveTo(bitX, y1);
      ctx.lineTo(bitX, y2);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ── Animated data packet traveling from A to B ──
  drawDataFlow(ctx, x1, y1, x2, y2, progress, opts = {}) {
    const {
      value    = '',
      color    = C.dataGlow,
      alpha    = 1,
      size     = 14,
      glowAmt  = 20,
      easing   = Ease.inOut,
      numericValue = -1,  // if set, shows 8 individual bit squares
    } = opts;

    const t  = easing(clamp(progress, 0, 1));
    const px = lerp(x1, x2, t);
    const py = lerp(y1, y2, t);

    ctx.save();
    ctx.globalAlpha = alpha;

    const parsedValue = numericValue >= 0 ? numericValue :
      (value && !isNaN(parseInt(value))) ? parseInt(value) : -1;

    if (parsedValue >= 0) {
      // ── 8-BIT MODE: Show 8 labeled bit squares traveling in parallel ──
      const bits = parsedValue.toString(2).padStart(8, '0');
      const isMob = this.W < 600;
      // Square size — bigger on desktop so the digit "0" or "1" is readable
      const sqSize = isMob ? 5 : 9;
      const bitSpacing = isMob ? 4 : 7;
      const totalSpread = 7 * bitSpacing;

      // Determine flow direction
      const dx = x2 - x1, dy = y2 - y1;
      const isHorizontal = Math.abs(dx) > Math.abs(dy);

      for (let i = 0; i < 8; i++) {
        const bitIndex = 7 - i;    // i=0 is bit7 (MSB)
        const bit = (parsedValue >>> bitIndex) & 1;
        const offset = (i - 3.5) * bitSpacing;

        // Slight MSB-first stagger: bit 7 leads by a tiny amount
        const stagger = i * 0.015;
        const rawBitP = clamp(progress - stagger, 0, 1);
        const bitP    = easing(rawBitP);
        const bx = lerp(x1, x2, bitP) + (isHorizontal ? 0 : offset);
        const by = lerp(y1, y2, bitP) + (isHorizontal ? offset : 0);

        ctx.globalAlpha = alpha;

        if (bit === 1) {
          // HIGH bit — bright glowing square with "1"
          ctx.shadowBlur  = isMob ? 6 : 10;
          ctx.shadowColor = color;
          ctx.fillStyle   = color;
          this._roundRect(ctx, bx - sqSize/2, by - sqSize/2, sqSize, sqSize, 2);
          ctx.fill();

          // Digit inside square
          ctx.shadowBlur = 0;
          ctx.fillStyle  = '#000';
          ctx.font = `bold ${Math.max(5, sqSize * 0.72)}px JetBrains Mono, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('1', bx, by);

          // Trail for high bits
          for (let tr = 1; tr <= 3; tr++) {
            const trP  = easing(clamp(rawBitP - tr * 0.04, 0, 1));
            const trx  = lerp(x1, x2, trP) + (isHorizontal ? 0 : offset);
            const try2 = lerp(y1, y2, trP) + (isHorizontal ? offset : 0);
            const trSz = sqSize * (1 - tr / 4);
            ctx.globalAlpha = alpha * (1 - tr / 4) * 0.35;
            ctx.fillStyle   = color;
            ctx.shadowBlur  = 0;
            this._roundRect(ctx, trx - trSz/2, try2 - trSz/2, trSz, trSz, 1);
            ctx.fill();
          }
          ctx.globalAlpha = alpha;

        } else {
          // LOW bit — dim outlined square with "0"
          ctx.shadowBlur = 0;
          ctx.strokeStyle = rgbaStr(color, 0.25);
          ctx.lineWidth   = 0.75;
          ctx.fillStyle   = rgbaStr(color, 0.06);
          this._roundRect(ctx, bx - sqSize/2, by - sqSize/2, sqSize, sqSize, 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = rgbaStr(color, 0.35);
          ctx.font = `bold ${Math.max(5, sqSize * 0.72)}px JetBrains Mono, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('0', bx, by);
        }
      }

      // ── Bit index + value label floating above/beside the packet ──
      if (!isMob) {
        ctx.shadowBlur = 0;
        ctx.globalAlpha = alpha * 0.85;

        // Show individual bit indices above each square (near the midpoint of travel)
        const midT = easing(0.5);
        const midX = lerp(x1, x2, midT);
        const midY = lerp(y1, y2, midT);
        const labelOffY = isHorizontal ? -(totalSpread / 2 + 18) : 0;
        const labelOffX = isHorizontal ? 0 : (totalSpread / 2 + 22);

        // Show binary string with colored bits above the flow cluster
        const labelX = midX + labelOffX;
        const labelY = midY + labelOffY;

        ctx.font = `bold ${Math.max(9, size * 0.75)}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Background pill
        const pillW = 76;
        const pillH = 16;
        ctx.fillStyle = 'rgba(6,9,15,0.7)';
        this._roundRect(ctx, labelX - pillW/2, labelY - pillH/2, pillW, pillH, 4);
        ctx.fill();

        // Bit characters colored individually
        const charW = 8;
        const bitsStartX = labelX - (8 * charW) / 2 + charW / 2;
        for (let i = 0; i < 8; i++) {
          const bChar = bits[i];
          ctx.fillStyle = bChar === '1' ? color : rgbaStr(color, 0.32);
          if (bChar === '1') { ctx.shadowBlur = 3; ctx.shadowColor = color; }
          else { ctx.shadowBlur = 0; }
          ctx.fillText(bChar, bitsStartX + i * charW, labelY);
        }
        ctx.shadowBlur = 0;

        // Decimal = value below
        if (value) {
          ctx.globalAlpha = alpha * 0.7;
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.max(8, size * 0.65)}px JetBrains Mono, monospace`;
          ctx.fillText(`=${value}`, labelX, labelY + 14);
        }
      }

    } else {
      // ── ORIGINAL MODE: Single glowing orb ──
      // Trail
      const steps = 8;
      for (let i = 0; i < steps; i++) {
        const ti = easing(clamp(progress - i * 0.04, 0, 1));
        const tx = lerp(x1, x2, ti);
        const ty = lerp(y1, y2, ti);
        ctx.globalAlpha = alpha * (1 - i/steps) * 0.3;
        ctx.fillStyle   = color;
        ctx.beginPath();
        ctx.arc(tx, ty, size * 0.4 * (1 - i/steps), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = alpha;

      // Glow orb
      ctx.shadowBlur  = glowAmt;
      ctx.shadowColor = color;
      ctx.fillStyle   = rgbaStr(color, 0.3);
      ctx.beginPath();
      ctx.arc(px, py, size * 1.4, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.shadowBlur = glowAmt * 1.5;
      ctx.fillStyle  = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, size * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Value label
      if (value) {
        ctx.shadowBlur = 0;
        ctx.fillStyle  = '#ffffff';
        ctx.font       = `bold ${size}px JetBrains Mono, monospace`;
        ctx.textAlign  = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(value, px, py - size * 2);
      }
    }

    ctx.restore();
  }

  // ── Glow highlight on a rect ──
  pulseRect(ctx, x, y, w, h, color, intensity, opts = {}) {
    const r = opts.radius || 8;
    ctx.save();
    ctx.shadowBlur  = 20 * intensity;
    ctx.shadowColor = color;
    ctx.strokeStyle = rgbaStr(color, intensity);
    ctx.lineWidth   = 2 * intensity;
    this._roundRect(ctx, x, y, w, h, r);
    ctx.stroke();
    ctx.restore();
  }

  // ── Caption / subtitle ──
  drawCaption(ctx, text, alpha, opts = {}) {
    if (!this.showCaptions || !text) return;
    const isMob = this.W < 600;
    const {
      fontSize    = isMob ? 13 : 18,
      color       = C.textPrimary,
      maxWidth    = isMob ? this.W * 0.92 : this.W * 0.75,
      bottomPad   = isMob ? 55 : 90,
      y: yOverride,
    } = opts;

    const x  = this.W / 2;
    const y  = yOverride !== undefined ? yOverride : (this.H - bottomPad);
    const font = `${fontSize}px Inter, "Segoe UI", sans-serif`;

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);

    // Measure and draw background pill
    ctx.font = font;
    const metrics = ctx.measureText(text);
    const tw = Math.min(metrics.width + 40, maxWidth + 40);
    const th = fontSize + 18;
    ctx.fillStyle = 'rgba(6,9,15,0.78)';
    this._roundRect(ctx, x - tw/2, y - th/2, tw, th, 6);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font;
    ctx.fillText(text, x, y, maxWidth);

    ctx.restore();
  }

  // ── Arrow ──
  drawArrow(ctx, x1, y1, x2, y2, opts = {}) {
    const {
      color   = C.textSecondary,
      alpha   = 1,
      thick   = 2,
      headLen = 10,
    } = opts;

    const angle = Math.atan2(y2-y1, x2-x1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = thick;
    ctx.shadowBlur  = 6;
    ctx.shadowColor = color;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - 0.45), y2 - headLen * Math.sin(angle - 0.45));
    ctx.lineTo(x2 - headLen * Math.cos(angle + 0.45), y2 - headLen * Math.sin(angle + 0.45));
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // ── Bit display: 8 colored squares (standalone, larger) ──
  drawBits(ctx, value, x, y, opts = {}) {
    const {
      bitW    = 26,
      bitH    = 26,
      gap     = 4,
      color1  = C.bus,
      color0  = '#1a2030',
      alpha   = 1,
      label   = '',
      showIndex = false,   // show bit index numbers above cells
      // bitHighlight: array[8] booleans for landing flash
      bitHighlight = null,
    } = opts;

    ctx.save();
    ctx.globalAlpha = alpha;
    const totalW = 8 * (bitW + gap) - gap;
    let bx = x - totalW / 2;

    // Bit index labels above cells
    if (showIndex) {
      ctx.fillStyle = rgbaStr(C.textMuted, 0.6);
      ctx.font = `bold ${Math.max(7, bitW * 0.35)}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.shadowBlur = 0;
      for (let i = 7; i >= 0; i--) {
        ctx.fillText(`${i}`, bx + bitW/2, y - 2);
        bx += bitW + gap;
      }
      bx = x - totalW / 2;
    }

    for (let i = 7; i >= 0; i--) {
      const bit = (value >>> i) & 1;
      const arriving = bitHighlight && bitHighlight[7 - i];  // bitHighlight[0] = bit7
      const activeColor = arriving ? '#ffffff' : color1;

      ctx.fillStyle   = bit ? rgbaStr(activeColor, arriving ? 1.0 : 0.85) : color0;
      ctx.strokeStyle = bit ? rgbaStr(activeColor, arriving ? 1.0 : 0.55) : '#2a3548';
      ctx.lineWidth   = 1;
      if (bit || arriving) {
        ctx.shadowBlur  = arriving ? 16 : 10;
        ctx.shadowColor = activeColor;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      this._roundRect(ctx, bx, y, bitW, bitH, 3);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = bit ? (arriving ? color1 : '#000') : '#3a5268';
      ctx.font = `bold ${Math.max(9, bitW * 0.5)}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bit ? '1' : '0', bx + bitW/2, y + bitH/2);

      bx += bitW + gap;
    }

    if (label) {
      ctx.fillStyle = C.textMuted;
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.shadowBlur = 0;
      ctx.fillText(label, x, y + bitH + 5);
    }

    ctx.restore();
  }

  // ── RAM Grid: full 16-cell memory visualization ──
  // ramData: array of { addr, value, type:'opcode'|'operand'|'data'|'empty', mnemonic, label }
  // opts: { highlightAddr, highlightPair, alpha, compact, showAll }
  drawRAMGrid(ctx, x, y, width, height, ramData, opts = {}) {
    const {
      highlightAddr = -1,  // address currently being read (flash)
      highlightPair = -1,  // opcode address of currently-executing pair (bracket)
      alpha         = 1,
      compact       = false,
      showAll       = true, // if false, skip empty rows
    } = opts;

    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Type color map
    const TYPE_COLOR = {
      instruction: '#bb66ff',  // SAP-1 unified instruction (opcode+addr in one byte)
      opcode:  '#bb66ff',
      operand: '#00cc88',
      data:    '#ffcc00',
      empty:   '#1a2030',
    };

    const isMob = compact;
    const rows = showAll ? 16 : ramData.filter(r => r.type !== 'empty').length;
    const rowH = Math.min(height / (rows + 1.5), isMob ? 18 : 26);  // +1.5 for header
    const headerH = rowH * 0.85;
    const totalH  = headerH + rows * rowH;

    // Background panel
    ctx.fillStyle = 'rgba(6,9,15,0.88)';
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x, y, width, totalH + 10, 6);
    ctx.fill();
    ctx.stroke();

    // Column layout
    const addrW  = isMob ? 22 : 30;
    const decW   = isMob ? 20 : 26;
    const typeW  = isMob ? 28 : 52;
    const bitCellSz = isMob ? 0 : Math.min(11, (width - addrW - decW - typeW - 20) / 9);
    const bitsW  = isMob ? 0 : (8 * bitCellSz + 7 * 1 + 4);  // 7 gaps of 1px
    const labelX = x + addrW + bitsW + decW + 12;

    // Header row
    const hy = y + 5 + headerH / 2;
    ctx.fillStyle = 'rgba(120,160,200,0.4)';
    ctx.font = `bold ${isMob ? 7 : 8}px JetBrains Mono, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADDR', x + 3, hy);
    if (!isMob) {
      ctx.fillText('7 6 5 4 3 2 1 0', x + addrW + 3, hy);
    }
    ctx.fillText('DEC', x + addrW + bitsW + 3, hy);
    ctx.fillText('TYPE', labelX, hy);

    // Separator line under header
    ctx.strokeStyle = 'rgba(120,160,200,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 5 + headerH);
    ctx.lineTo(x + width - 2, y + 5 + headerH);
    ctx.stroke();

    // Build display list
    let displayRows;
    if (showAll) {
      // Full 16 rows: use provided ramData, fill gaps with empty
      const byAddr = {};
      for (const r of ramData) byAddr[r.addr] = r;
      displayRows = [];
      for (let i = 0; i < 16; i++) {
        displayRows.push(byAddr[i] || { addr: i, value: 0, type: 'empty', mnemonic: '', label: '' });
      }
    } else {
      displayRows = ramData.filter(r => r.type !== 'empty');
    }

    const now = performance.now();

    for (let ri = 0; ri < displayRows.length; ri++) {
      const row  = displayRows[ri];
      const ry   = y + 5 + headerH + ri * rowH + rowH / 2;
      const rowY = y + 5 + headerH + ri * rowH;
      const tc   = TYPE_COLOR[row.type] || TYPE_COLOR.empty;
      const isHL = row.addr === highlightAddr;
      // SAP-1: instructions are 1 byte — only highlight the exact address (no "+1" pairing)
      const isPairHL = row.addr === highlightPair;

      // Row background
      const rowAlpha = row.type === 'empty' ? 0.25 : 0.65;
      ctx.globalAlpha = alpha * rowAlpha;
      ctx.fillStyle = rgbaStr(tc, row.type === 'empty' ? 0.04 : 0.1);
      ctx.fillRect(x + 1, rowY + 1, width - 2, rowH - 2);

      // Highlighted row — bright border + glow
      if (isHL) {
        const pulse = 0.65 + Math.sin(now / 120) * 0.35;
        ctx.globalAlpha = alpha * pulse;
        ctx.strokeStyle = tc;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = tc;
        this._roundRect(ctx, x + 1, rowY + 1, width - 2, rowH - 2, 3);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner fill brightened
        ctx.fillStyle = rgbaStr(tc, 0.22);
        this._roundRect(ctx, x + 1, rowY + 1, width - 2, rowH - 2, 3);
        ctx.fill();
      } else if (isPairHL) {
        ctx.globalAlpha = alpha * 0.6;
        ctx.strokeStyle = rgbaStr(tc, 0.5);
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        this._roundRect(ctx, x + 1, rowY + 1, width - 2, rowH - 2, 3);
        ctx.stroke();
      }

      ctx.globalAlpha = alpha;

      // Address
      const addrColor = row.type === 'empty' ? 'rgba(80,100,130,0.5)' : 'rgba(150,180,220,0.7)';
      ctx.fillStyle = addrColor;
      ctx.font = `bold ${isMob ? 7 : 9}px JetBrains Mono, monospace`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(row.addr.toString().padStart(2, ' '), x + addrW, ry);

      if (!isMob) {
        // 8 bit cells — for instruction-type rows use SAP-1 4+4 split coloring
        const bits = row.value.toString(2).padStart(8, '0');
        const bitGap = 1;
        let bx = x + addrW + 3;
        const bby = rowY + (rowH - bitCellSz) / 2;
        const isSAP1Instr = row.type === 'instruction';
        const isNoOperand = isSAP1Instr && (row.mnemonic === 'OUT' || row.mnemonic === 'HLT');

        for (let bi = 0; bi < 8; bi++) {
          const bit = bits[bi];
          const isOne = bit === '1';
          // SAP-1: bits 7-4 (bi 0-3) = OPCODE (purple/ir), bits 3-0 (bi 4-7) = ADDRESS (green/mar)
          let bitColor = tc;
          if (isSAP1Instr) {
            if (bi < 4) {
              bitColor = C.ir;   // opcode bits — purple
            } else {
              bitColor = isNoOperand ? rgbaStr(C.mar, 0.45) : C.mar;  // address bits — green (dimmer if unused)
            }
          }

          ctx.fillStyle = isOne
            ? rgbaStr(bitColor, isHL ? 1.0 : (row.type === 'empty' ? 0.2 : 0.82))
            : rgbaStr(bitColor, row.type === 'empty' ? 0.04 : 0.1);
          if (isOne && isHL) { ctx.shadowBlur = 5; ctx.shadowColor = bitColor; }
          else { ctx.shadowBlur = 0; }
          ctx.fillRect(bx, bby, bitCellSz, bitCellSz);
          ctx.shadowBlur = 0;
          ctx.strokeStyle = rgbaStr(bitColor, isOne ? 0.5 : 0.12);
          ctx.lineWidth = 0.5;
          ctx.strokeRect(bx, bby, bitCellSz, bitCellSz);
          ctx.fillStyle = isOne
            ? (isHL ? '#000' : rgbaStr('#000', 0.85))
            : rgbaStr(bitColor, row.type === 'empty' ? 0.15 : 0.35);
          ctx.font = `bold ${Math.max(5, bitCellSz * 0.68)}px JetBrains Mono, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(bit, bx + bitCellSz / 2, bby + bitCellSz / 2);

          // SAP-1 divider: draw a thin vertical line between bit 4 and bit 3 (after bi=3)
          if (isSAP1Instr && bi === 3) {
            const divX = bx + bitCellSz + bitGap / 2;
            ctx.strokeStyle = rgbaStr(C.textMuted, 0.55);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(divX, bby - 2);
            ctx.lineTo(divX, bby + bitCellSz + 2);
            ctx.stroke();
          }

          bx += bitCellSz + bitGap;
        }

        // SAP-1 label row: tiny "OPC" / "ADR" labels under the bits (only if enough row height)
        if (isSAP1Instr && rowH >= 18) {
          const labelY = bby + bitCellSz + 1;
          const totalBW = 8 * bitCellSz + 7 * bitGap;
          const opcHalf  = 4 * bitCellSz + 3 * bitGap;
          const bx0 = x + addrW + 3;
          ctx.font = `${Math.max(4, bitCellSz * 0.5)}px Inter, sans-serif`;
          ctx.textBaseline = 'top';
          ctx.fillStyle = rgbaStr(C.ir, 0.5);
          ctx.textAlign = 'center';
          ctx.fillText('OPCODE', bx0 + opcHalf / 2, labelY);
          ctx.fillStyle = rgbaStr(C.mar, isNoOperand ? 0.25 : 0.5);
          ctx.fillText('OPERAND', bx0 + opcHalf + bitGap + opcHalf / 2, labelY);
        }
      }

      // Decimal value
      const decColor = row.type === 'empty' ? 'rgba(60,80,110,0.4)' : rgbaStr(tc, 0.8);
      ctx.fillStyle = decColor;
      ctx.font = `bold ${isMob ? 7 : 9}px JetBrains Mono, monospace`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(row.value.toString().padStart(3, ' '), x + addrW + bitsW + decW + 1, ry);

      // Type badge / label
      if (row.type !== 'empty') {
        const badgeW = isMob ? typeW - 2 : Math.min(typeW - 2, width - (labelX - x) - 4);
        const badgeH = rowH - 6;
        const badgeX = labelX;
        const badgeY = rowY + 3;

        // Badge background
        ctx.fillStyle = rgbaStr(tc, 0.18);
        ctx.strokeStyle = rgbaStr(tc, 0.4);
        ctx.lineWidth = 0.75;
        this._roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 3);
        ctx.fill();
        ctx.stroke();

        // Badge text: mnemonic if instruction/opcode, type label otherwise
        const badgeText = row.mnemonic
          ? row.mnemonic
          : (row.type === 'operand' ? 'ADDR' : (row.type === 'data' ? 'DATA' : row.type.toUpperCase()));
        ctx.fillStyle = rgbaStr(tc, isHL ? 1.0 : 0.85);
        ctx.font = `bold ${isMob ? 6 : 8}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (isHL) { ctx.shadowBlur = 6; ctx.shadowColor = tc; }
        ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);
        ctx.shadowBlur = 0;

        // Inline label to the right of badge (desktop only, if space)
        if (!isMob && row.label && width > 180) {
          const extraLabelX = badgeX + badgeW + 4;
          if (extraLabelX + 20 < x + width) {
            ctx.fillStyle = rgbaStr(tc, 0.5);
            ctx.font = `${7}px Inter, sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(row.label, extraLabelX, ry);
          }
        }
      } else {
        // Empty row — dim dash
        ctx.fillStyle = 'rgba(40,60,90,0.3)';
        ctx.font = `${isMob ? 6 : 8}px JetBrains Mono, monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('—', labelX, ry);
      }
    }

    ctx.restore();
  }

  // ── Instruction format legend ──
  // SAP-1 format: ONE byte, upper 4 bits = OPCODE, lower 4 bits = ADDRESS
  // instrByte: the full 8-bit instruction value (e.g. 0x1E for LDA 14)
  drawInstructionFormat(ctx, opts = {}) {
    const {
      alpha       = 1,
      mode        = 'decode',   // 'fetch' | 'decode'
      instrByte   = 0x1E,       // SAP-1: full 8-bit instruction byte (upper4=opcode, lower4=addr)
      opcodeName  = 'OPCODE',
      operandName = 'ADDRESS',
      operandType = 'address',  // 'address' | 'immediate'
      y: topY,                  // override Y position
    } = opts;

    const { W, H } = this;
    const isMob = W < 600;
    if (isMob && !opts.forceMobile) return;  // skip on mobile by default

    // SAP-1: split the byte into upper 4 (opcode) and lower 4 (address)
    const opcodeNibble  = (instrByte >>> 4) & 0x0F;  // bits 7-4
    const addressNibble = instrByte & 0x0F;           // bits 3-0

    const bY  = topY !== undefined ? topY : 8;
    const bW  = Math.min(W * 0.72, 520);
    const bH  = isMob ? 38 : 58;
    const bX  = W / 2 - bW / 2;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Background
    ctx.fillStyle = 'rgba(6,9,15,0.85)';
    ctx.strokeStyle = 'rgba(255,204,0,0.2)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, bX, bY, bW, bH, 6);
    ctx.fill();
    ctx.stroke();

    // ONE-BYTE header label
    ctx.fillStyle = rgbaStr(C.textMuted, 0.55);
    ctx.font = `bold ${isMob ? 7 : 9}px JetBrains Mono, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('ONE BYTE — SAP-1 FORMAT', bX + bW / 2, bY + 3);

    // The byte spans the full width — split into left half (opcode) and right half (address)
    const innerPad = 6;
    const innerW   = bW - innerPad * 2;
    const innerY   = bY + (isMob ? 14 : 17);
    const innerH   = bH - (isMob ? 19 : 24);
    const half     = innerW / 2 - 2;
    const leftX    = bX + innerPad;
    const rightX   = bX + bW / 2 + 2;
    const opColor  = operandType === 'immediate' ? C.regA : C.mar;

    // OPCODE half (purple)
    ctx.fillStyle = rgbaStr(C.ir, 0.18);
    ctx.strokeStyle = rgbaStr(C.ir, 0.6);
    ctx.lineWidth = 1;
    this._roundRect(ctx, leftX, innerY, half, innerH, 3);
    ctx.fill();
    ctx.stroke();

    // ADDRESS half (green)
    ctx.fillStyle = rgbaStr(opColor, 0.18);
    ctx.strokeStyle = rgbaStr(opColor, 0.6);
    this._roundRect(ctx, rightX, innerY, half, innerH, 3);
    ctx.fill();
    ctx.stroke();

    const midY     = innerY + innerH / 2;
    const fontSize = isMob ? 8 : 10;
    const valFont  = `bold ${isMob ? 9 : 11}px JetBrains Mono, monospace`;
    const lblFont  = `${fontSize}px Inter, sans-serif`;

    if (mode === 'fetch') {
      // During fetch: show the half-byte fields
      ctx.font = valFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.ir; ctx.shadowBlur = 6; ctx.shadowColor = C.ir;
      // "INSTRUCTION" label spanning the full width
      ctx.fillStyle = rgbaStr('#ffffff', alpha * 0.5);
      ctx.font = `bold ${Math.max(9, 10)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('◄──────── INSTRUCTION ────────►', leftX + half, midY - 16);
      ctx.fillText('BITS 7-4: OPCODE', leftX + half / 2, midY);
      ctx.fillStyle = opColor; ctx.shadowColor = opColor;
      ctx.fillText('BITS 3-0: OPERAND', rightX + half / 2, midY);
      ctx.shadowBlur = 0;

    } else {
      // During decode: show 4-bit cells for opcode and address
      const bitRow   = innerY + (isMob ? 3 : 4);
      const lblRow   = innerY + innerH - (isMob ? 2 : 3);
      const bitSz    = isMob ? 8 : 12;
      const bitGap   = isMob ? 1.5 : 2;
      const bitTotal4 = 4 * bitSz + 3 * bitGap;

      // Opcode 4 bits
      const opBits4 = opcodeNibble.toString(2).padStart(4, '0');
      let bx = leftX + (half) / 2 - bitTotal4 / 2;
      ctx.font = `bold ${Math.max(5, bitSz * 0.72)}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 4; i++) {
        const bit = opBits4[i];
        ctx.fillStyle = bit === '1' ? C.ir : rgbaStr(C.ir, 0.18);
        if (bit === '1') { ctx.shadowBlur = 4; ctx.shadowColor = C.ir; } else { ctx.shadowBlur = 0; }
        ctx.fillRect(bx, bitRow, bitSz, bitSz);
        ctx.fillStyle = bit === '1' ? '#000' : rgbaStr(C.ir, 0.5);
        ctx.shadowBlur = 0;
        ctx.fillText(bit, bx + bitSz / 2, bitRow + bitSz / 2);
        bx += bitSz + bitGap;
      }

      // Address 4 bits
      const adBits4 = addressNibble.toString(2).padStart(4, '0');
      bx = rightX + (half) / 2 - bitTotal4 / 2;
      for (let i = 0; i < 4; i++) {
        const bit = adBits4[i];
        ctx.fillStyle = bit === '1' ? opColor : rgbaStr(opColor, 0.18);
        if (bit === '1') { ctx.shadowBlur = 4; ctx.shadowColor = opColor; } else { ctx.shadowBlur = 0; }
        ctx.fillRect(bx, bitRow, bitSz, bitSz);
        ctx.fillStyle = bit === '1' ? '#000' : rgbaStr(opColor, 0.5);
        ctx.shadowBlur = 0;
        ctx.fillText(bit, bx + bitSz / 2, bitRow + bitSz / 2);
        bx += bitSz + bitGap;
      }

      // Labels below bits
      ctx.font = lblFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgbaStr(C.ir, 0.8);
      ctx.fillText(`${opcodeName}  (=${opcodeNibble})`, leftX + half / 2, lblRow);
      ctx.fillStyle = rgbaStr(opColor, 0.8);
      ctx.fillText(`${operandName}  (=${addressNibble})`, rightX + half / 2, lblRow);
    }

    ctx.restore();
  }

  // ── Architecture comparison: 3 instruction formats side by side ──
  // progress 0..1 controls which architectures are visible (staggered reveal)
  // highlightArch: 0=none, 1=SAP-1 highlight, 2=Extended, 3=x86
  drawArchComparison(ctx, opts = {}) {
    const {
      alpha         = 1,
      progress      = 1,   // 0..1 overall reveal
      highlightArch = 0,   // which arch to glow (1, 2, or 3); 0 = none
      dimOthers     = false, // fade non-highlighted archs
      x: ox,
      y: oy,
    } = opts;

    if (alpha <= 0) return;

    const { W, H } = this;
    const isMob = W < 600;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Layout: stack vertically on mobile, side-by-side on desktop
    // But we always draw stacked (architectures build on top of each other)
    const padX = isMob ? 8 : 40;
    const totalW = Math.min(W - padX * 2, isMob ? W - 16 : 680);
    const startX = ox !== undefined ? ox : W / 2 - totalW / 2;
    const startY = oy !== undefined ? oy : H * 0.08;

    // Architecture definitions
    const archs = [
      {
        id: 1,
        name: 'SAP-1 (Ben Eater)',
        tag: '1 BYTE',
        tagColor: C.ir,
        bytes: [
          { label: 'OPCODE', bits: '0001', nbits: 4, color: C.ir, meaning: '= LDA' },
          { label: 'OPERAND', bits: '1110', nbits: 4, color: C.mar, meaning: '= addr 14' },
        ],
        title: '◄── 1 INSTRUCTION ──►',
        total: '1 byte, 1 memory read',
        stats: '16 opcodes × 16 operand values = 16 instructions',
        caption: "SAP-1: 1 instruction = 1 byte. Opcode + operand packed together. Fast but limited.",
      },
      {
        id: 2,
        name: 'Extended (our simulator)',
        tag: '2 BYTES',
        tagColor: C.regA,
        bytes: [
          { label: 'OPCODE', bits: '00000001', nbits: 8, color: C.ir, meaning: '= LDA' },
          { label: 'OPERAND', bits: '00001110', nbits: 8, color: C.mar, meaning: '= addr 14' },
        ],
        title: '◄────── 1 INSTRUCTION ──────►',
        total: '2 bytes, 2 memory reads',
        stats: '256 opcodes × 256 operand values',
        caption: 'Extended: 1 instruction = 2 bytes. Opcode and operand each get a full byte.',
      },
      {
        id: 3,
        name: 'Modern CPU (x86)',
        tag: 'UP TO 15 BYTES',
        tagColor: C.alu,
        bytes: [
          { label: 'PREFIX', bits: '01100110', nbits: 8, color: C.textMuted, meaning: '' },
          { label: 'OPCODE', bits: '10001011', nbits: 8, color: C.ir, meaning: '' },
          { label: 'MOD/RM', bits: '00000101', nbits: 8, color: C.pc, meaning: '' },
          { label: 'ADDR LO', bits: '00001110', nbits: 8, color: C.mar, meaning: '' },
          { label: 'ADDR HI', bits: '00000000', nbits: 8, color: C.mar, meaning: '' },
        ],
        total: '5 bytes shown (up to 15)',
        stats: 'Thousands of opcodes × 4 billion addresses',
        caption: "x86: 1 instruction = 1 to 15 bytes. Complex but powerful — billions of addresses.",
      },
    ];

    // Each arch card height
    const cardH = isMob ? 56 : 80;
    const cardGap = isMob ? 8 : 14;

    for (let ai = 0; ai < archs.length; ai++) {
      const arch = archs[ai];

      // Stagger reveal: arch i appears after progress > i/3
      const archReveal = clamp((progress - ai * 0.28) / 0.25, 0, 1);
      if (archReveal <= 0) continue;

      const isHighlighted = highlightArch === arch.id;
      const isDimmed = dimOthers && highlightArch > 0 && !isHighlighted;
      const cardAlpha = alpha * archReveal * (isDimmed ? 0.28 : 1);

      const cy = startY + ai * (cardH + cardGap);
      const cardColor = arch.tagColor;

      ctx.save();
      ctx.globalAlpha = cardAlpha;

      // Card background
      ctx.fillStyle = rgbaStr(cardColor, isHighlighted ? 0.18 : 0.08);
      ctx.strokeStyle = rgbaStr(cardColor, isHighlighted ? 0.9 : 0.35);
      ctx.lineWidth = isHighlighted ? 2 : 1;
      if (isHighlighted) { ctx.shadowBlur = 18; ctx.shadowColor = cardColor; }
      this._roundRect(ctx, startX, cy, totalW, cardH, 6);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Architecture name + tag pill (left side)
      const nameX = startX + 8;
      const nameY = cy + (isMob ? 9 : 12);

      ctx.fillStyle = isHighlighted ? cardColor : rgbaStr(cardColor, 0.75);
      ctx.font = `bold ${isMob ? 8 : 11}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      if (isHighlighted) { ctx.shadowBlur = 6; ctx.shadowColor = cardColor; }
      ctx.fillText(arch.name, nameX, nameY);
      ctx.shadowBlur = 0;

      // Tag pill (byte count)
      const tagText = arch.tag;
      ctx.font = `bold ${isMob ? 7 : 9}px JetBrains Mono, monospace`;
      const tagW = ctx.measureText(tagText).width + 10;
      const tagH = isMob ? 12 : 16;
      const tagX = nameX;
      const tagY = nameY + (isMob ? 11 : 16);
      ctx.fillStyle = rgbaStr(cardColor, 0.22);
      ctx.strokeStyle = rgbaStr(cardColor, 0.55);
      ctx.lineWidth = 0.75;
      this._roundRect(ctx, tagX, tagY, tagW, tagH, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = cardColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tagText, tagX + tagW / 2, tagY + tagH / 2);

      // "INSTRUCTION" title spanning all byte boxes
      if (arch.title) {
        ctx.fillStyle = rgbaStr('#ffffff', alpha * 0.45);
        ctx.font = `bold ${isMob ? 6 : 8}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const titleAreaX = startX + (isMob ? 88 : 130);
        const titleAreaW = totalW - (isMob ? 90 : 132) - 4;
        ctx.fillText(arch.title, titleAreaX + titleAreaW / 2, cy + 2);
      }

      // Byte boxes — drawn in the right portion of the card
      const byteAreaX = startX + (isMob ? 88 : 130);
      const byteAreaW = totalW - (isMob ? 90 : 132) - 4;
      const byteH = isMob ? 28 : 44;
      const byteY = cy + (cardH - byteH) / 2;
      const nbytes = arch.bytes.length;
      const byteGap = isMob ? 2 : 4;
      const byteW = Math.min((byteAreaW - (nbytes - 1) * byteGap) / nbytes, isMob ? 52 : 88);

      for (let bi = 0; bi < nbytes; bi++) {
        const b = arch.bytes[bi];
        const bx = byteAreaX + bi * (byteW + byteGap);

        // Byte box
        ctx.fillStyle = rgbaStr(b.color, 0.16);
        ctx.strokeStyle = rgbaStr(b.color, isHighlighted ? 0.8 : 0.45);
        ctx.lineWidth = 0.75;
        this._roundRect(ctx, bx, byteY, byteW, byteH, 3);
        ctx.fill();
        ctx.stroke();

        // Label at top of byte box
        ctx.fillStyle = rgbaStr(b.color, 0.65);
        ctx.font = `${isMob ? 6 : 8}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(b.label, bx + byteW / 2, byteY + 2);

        // Bits — draw individual bit cells
        const bitsStr = b.bits;
        const nBits = bitsStr.length;
        const cellGap = 1;
        const cellW = Math.min((byteW - 6) / (nBits + 0.5), isMob ? 5.5 : 8);
        const cellH2 = isMob ? 8 : 12;
        const totalCellW = nBits * cellW + (nBits - 1) * cellGap;
        let cellX = bx + (byteW - totalCellW) / 2;
        const cellY = byteY + (isMob ? 13 : 17);

        ctx.font = `bold ${Math.max(4, cellW * 0.65)}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let ci = 0; ci < nBits; ci++) {
          const bit = bitsStr[ci];
          const isOne = bit === '1';
          ctx.fillStyle = isOne ? rgbaStr(b.color, 0.85) : rgbaStr(b.color, 0.1);
          if (isOne) { ctx.shadowBlur = 3; ctx.shadowColor = b.color; } else { ctx.shadowBlur = 0; }
          ctx.fillRect(cellX, cellY, cellW, cellH2);
          ctx.shadowBlur = 0;
          ctx.strokeStyle = rgbaStr(b.color, isOne ? 0.5 : 0.15);
          ctx.lineWidth = 0.4;
          ctx.strokeRect(cellX, cellY, cellW, cellH2);
          ctx.fillStyle = isOne ? '#000' : rgbaStr(b.color, 0.35);
          ctx.fillText(bit, cellX + cellW / 2, cellY + cellH2 / 2);
          cellX += cellW + cellGap;
        }

        // Meaning text below bits (desktop only)
        if (!isMob && b.meaning) {
          ctx.fillStyle = rgbaStr(b.color, 0.55);
          ctx.font = `${isMob ? 6 : 7.5}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.shadowBlur = 0;
          ctx.fillText(b.meaning, bx + byteW / 2, byteY + byteH - 2);
        }
      }

      // Stats line (bottom of card, desktop only)
      if (!isMob) {
        ctx.fillStyle = rgbaStr(cardColor, 0.45);
        ctx.font = `7.5px JetBrains Mono, monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.shadowBlur = 0;
        ctx.fillText(arch.stats, nameX, cy + cardH - 4);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  // ── Binary ALU operation display ──
  // Shows: operandA (binary), operandB (binary), result (binary), with bit-by-bit carry
  drawBinaryALU(ctx, valA, valB, result, progress, opts = {}) {
    const {
      alpha  = 1,
      x: cx,
      y: cy,
      width  = 260,
      op     = '+',
      colorA = C.regA,
      colorB = C.regB,
      colorR = C.success,
    } = opts;

    const { W, H } = this;
    const isMob = W < 600;
    if (isMob) return;  // skip on mobile — not enough space

    const bitsA = valA.toString(2).padStart(8, '0');
    const bitsB = valB.toString(2).padStart(8, '0');
    const bitsR = result.toString(2).padStart(8, '0');

    const x0 = (cx !== undefined ? cx : W / 2) - width / 2;
    const y0 = cy !== undefined ? cy : H * 0.3;
    const bitW  = Math.min(22, (width - 40) / 8.5);
    const bitH  = 18;
    const bitGap = Math.min(3, (width - 40 - 8 * bitW) / 7);
    const totalBW = 8 * bitW + 7 * bitGap;
    const bitsX = x0 + (width - totalBW) / 2 + 18;  // offset for operator char

    ctx.save();
    ctx.globalAlpha = alpha;

    const rowH = bitH + 10;
    const rowA = y0;
    const rowB = y0 + rowH;
    const rowR = y0 + rowH * 2 + 8;  // extra gap for separator

    // Helper: draw one row of bit cells
    const drawRow = (bits, rowY, color, showProg) => {
      for (let i = 0; i < 8; i++) {
        const bit = bits[i];
        const cellX = bitsX + i * (bitW + bitGap);
        // If showProg, fade in left-to-right
        const cellAlpha = showProg ? clamp((progress * 8 - (7 - i)) * 1.5, 0, 1) : 1;
        ctx.globalAlpha = alpha * cellAlpha;
        ctx.fillStyle = bit === '1' ? rgbaStr(color, 0.85) : rgbaStr(color, 0.1);
        ctx.strokeStyle = bit === '1' ? rgbaStr(color, 0.7) : rgbaStr(color, 0.2);
        ctx.lineWidth = 0.75;
        if (bit === '1') { ctx.shadowBlur = 8; ctx.shadowColor = color; } else { ctx.shadowBlur = 0; }
        this._roundRect(ctx, cellX, rowY, bitW, bitH, 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = bit === '1' ? '#000' : rgbaStr(color, 0.4);
        ctx.font = `bold ${Math.max(7, bitW * 0.5)}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bit, cellX + bitW / 2, rowY + bitH / 2);
        ctx.globalAlpha = alpha;
      }
    };

    // Row A (A register)
    ctx.fillStyle = colorA;
    ctx.font = `bold ${bitH * 0.65}px JetBrains Mono, monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', bitsX - 6, rowA + bitH / 2);
    drawRow(bitsA, rowA, colorA, false);

    // Decimal for A
    ctx.fillStyle = rgbaStr(colorA, 0.55);
    ctx.font = `${Math.max(8, bitW * 0.45)}px JetBrains Mono, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`= ${valA}`, bitsX + totalBW + 5, rowA + bitH / 2);

    // Operator
    ctx.fillStyle = C.textSecondary;
    ctx.font = `bold ${bitH * 0.7}px JetBrains Mono, monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(op, bitsX - 6, rowB + bitH / 2);
    drawRow(bitsB, rowB, colorB, false);

    // Decimal for B
    ctx.fillStyle = rgbaStr(colorB, 0.55);
    ctx.font = `${Math.max(8, bitW * 0.45)}px JetBrains Mono, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`= ${valB}`, bitsX + totalBW + 5, rowB + bitH / 2);

    // Separator line
    ctx.strokeStyle = rgbaStr(C.textMuted, 0.5);
    ctx.lineWidth = 1;
    const sepY = rowR - 5;
    ctx.beginPath();
    ctx.moveTo(bitsX - 20, sepY);
    ctx.lineTo(bitsX + totalBW + 20, sepY);
    ctx.stroke();

    // Result row — fade in from MSB to LSB based on progress
    if (progress > 0.3) {
      const rProg = clamp((progress - 0.3) / 0.7, 0, 1);
      ctx.fillStyle = colorR;
      ctx.font = `bold ${bitH * 0.65}px JetBrains Mono, monospace`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 6; ctx.shadowColor = colorR;
      ctx.fillText('=', bitsX - 6, rowR + bitH / 2);
      ctx.shadowBlur = 0;
      drawRow(bitsR, rowR, colorR, true);

      // Decimal result
      const decAlpha = clamp((progress - 0.85) / 0.15, 0, 1);
      if (decAlpha > 0) {
        ctx.globalAlpha = alpha * decAlpha;
        ctx.fillStyle = colorR;
        ctx.font = `bold ${Math.max(10, bitW * 0.6)}px JetBrains Mono, monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 8; ctx.shadowColor = colorR;
        ctx.fillText(`= ${result}`, bitsX + totalBW + 5, rowR + bitH / 2);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = alpha;
      }
    }

    ctx.restore();
  }

  /* ═══════════════════════════════════════
     CONTROL UNIT DRAWING PRIMITIVES
  ═══════════════════════════════════════ */

  // ── Control Unit component box ──
  // Draws the CU box with opcode + T-state inputs shown inside
  // opts: { alpha, glow, opcode, tstate, activeSignals, compact }
  drawControlUnit(ctx, x, y, w, h, opts = {}) {
    const {
      alpha   = 1,
      glow    = false,
      opcode  = '',       // e.g. 'LDA'
      tstate  = -1,       // current T-state 0-4, -1 = not shown
      compact = false,
    } = opts;

    if (alpha <= 0) return;
    const color = C.ctrl;
    const r = 8;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (glow) {
      ctx.shadowBlur  = 30;
      ctx.shadowColor = color;
    }

    // Body
    ctx.fillStyle   = rgbaStr(color, 0.15);
    ctx.strokeStyle = rgbaStr(color, 0.85);
    ctx.lineWidth   = 2;
    this._roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Header band
    ctx.fillStyle = rgbaStr(color, 0.3);
    this._roundRectTop(ctx, x, y, w, compact ? 16 : 20, r);
    ctx.fill();

    const labelSz = compact ? 8 : 10;
    const valSz   = compact ? 9 : 12;

    // Label
    if (glow) { ctx.shadowBlur = 10; ctx.shadowColor = color; }
    ctx.fillStyle = color;
    ctx.font = `bold ${labelSz}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CONTROL UNIT', x + w/2, y + (compact ? 8 : 10));
    ctx.shadowBlur = 0;

    if (!compact) {
      // Sub-label
      ctx.fillStyle = rgbaStr(color, 0.45);
      ctx.font = `7px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('opcode × T-state → signals', x + w/2, y + 22);

      // Opcode display
      if (opcode) {
        ctx.fillStyle = C.ir;
        ctx.font = `bold 9px JetBrains Mono, monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('OPC:', x + 6, y + h * 0.52);
        ctx.fillStyle = C.ir;
        ctx.shadowBlur = 6; ctx.shadowColor = C.ir;
        ctx.font = `bold ${valSz}px JetBrains Mono, monospace`;
        ctx.fillText(opcode, x + 30, y + h * 0.52);
        ctx.shadowBlur = 0;
      }

      // T-state display
      if (tstate >= 0) {
        ctx.fillStyle = rgbaStr(color, 0.55);
        ctx.font = `bold 9px JetBrains Mono, monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('T:', x + 6, y + h * 0.75);
        ctx.fillStyle = color;
        ctx.shadowBlur = 6; ctx.shadowColor = color;
        ctx.font = `bold ${valSz + 2}px JetBrains Mono, monospace`;
        ctx.fillText(`T${tstate}`, x + 22, y + h * 0.75);
        ctx.shadowBlur = 0;
      }
    } else {
      // Compact: just show T-state if active
      if (tstate >= 0) {
        ctx.fillStyle = color;
        ctx.shadowBlur = 6; ctx.shadowColor = color;
        ctx.font = `bold 9px JetBrains Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`T${tstate}`, x + w/2, y + h * 0.65);
        ctx.shadowBlur = 0;
      }
    }

    ctx.restore();
  }

  // ── Control signal line: CU → component ──
  // type: 'out' (amber, writes bus), 'in' (cyan, reads bus), 'internal' (white)
  // active: bool — if false, dim dashed; if true, bright glowing arrow
  drawSignalLine(ctx, fromX, fromY, toX, toY, label, active, type, opts = {}) {
    const {
      alpha   = 1,
      pulse   = 0,    // 0..1 pulse animation for active signals
      compact = false,
    } = opts;

    if (alpha <= 0) return;

    const typeColors = {
      'out':      '#ffcc44',   // amber — writes to bus
      'in':       '#44ddff',   // cyan — reads from bus
      'internal': '#ffffff',   // white — internal signals
    };
    const color = typeColors[type] || '#ffffff';
    const isActive = active && alpha > 0;

    ctx.save();
    ctx.globalAlpha = alpha * (isActive ? 1 : 0.25);

    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len < 2) { ctx.restore(); return; }

    // Arrow head size
    const headLen = compact ? 7 : 10;

    if (isActive) {
      // Bright glowing line
      ctx.shadowBlur  = compact ? 8 : 14;
      ctx.shadowColor = color;
      ctx.strokeStyle = color;
      ctx.lineWidth   = compact ? 1.5 : 2;
      ctx.setLineDash([]);
    } else {
      // Dim dashed line
      ctx.shadowBlur  = 0;
      ctx.strokeStyle = rgbaStr(color, 0.3);
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
    }

    // Shorten the line a bit so it doesn't overlap component box
    const margin = headLen + 2;
    const ux = dx / len, uy = dy / len;
    const x1 = fromX + ux * 4;
    const y1 = fromY + uy * 4;
    const x2 = toX   - ux * margin;
    const y2 = toY   - uy * margin;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrow head
    ctx.setLineDash([]);
    if (isActive) {
      const angle = Math.atan2(dy, dx);
      ctx.fillStyle = color;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.moveTo(toX - ux * margin, toY - uy * margin);
      ctx.lineTo(
        toX - ux*(margin + headLen) + uy*(headLen*0.4),
        toY - uy*(margin + headLen) - ux*(headLen*0.4)
      );
      ctx.lineTo(
        toX - ux*(margin + headLen) - uy*(headLen*0.4),
        toY - uy*(margin + headLen) + ux*(headLen*0.4)
      );
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Label
    if (label && !compact) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      // Perpendicular offset for label
      const perpX = -uy * 10;
      const perpY =  ux * 10;

      ctx.globalAlpha = alpha * (isActive ? 1 : 0.35);
      ctx.fillStyle   = isActive ? color : rgbaStr(color, 0.5);
      ctx.font = `bold 8px JetBrains Mono, monospace`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      if (isActive) { ctx.shadowBlur = 4; ctx.shadowColor = color; }
      ctx.fillText(label, midX + perpX, midY + perpY);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  // ── T-State counter: vertical stack of T-state boxes ──
  // currentT: -1 = none, 0-4 = active
  drawTStateCounter(ctx, x, y, currentT, maxT, opts = {}) {
    const {
      alpha   = 1,
      compact = false,
    } = opts;

    if (alpha <= 0) return;

    const color = C.ctrl;
    const boxW  = compact ? 28 : 38;
    const boxH  = compact ? 14 : 20;
    const gap   = compact ? 2  : 4;
    const now   = performance.now();

    ctx.save();
    ctx.globalAlpha = alpha;

    // Header label
    ctx.fillStyle = rgbaStr(color, 0.5);
    ctx.font = `bold ${compact ? 7 : 8}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('T-STATE', x + boxW/2, y - 2);

    for (let t = 0; t <= maxT; t++) {
      const ty = y + t * (boxH + gap);
      const isActive = t === currentT;
      const pulse = isActive ? 0.7 + Math.sin(now / 200) * 0.3 : 0;

      if (isActive) {
        ctx.shadowBlur  = 12;
        ctx.shadowColor = color;
        ctx.fillStyle   = rgbaStr(color, 0.35);
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1.5;
      } else {
        ctx.shadowBlur  = 0;
        ctx.fillStyle   = rgbaStr(color, 0.06);
        ctx.strokeStyle = rgbaStr(color, 0.25);
        ctx.lineWidth   = 0.75;
      }

      this._roundRect(ctx, x, ty, boxW, boxH, 3);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Label
      ctx.fillStyle = isActive ? color : rgbaStr(color, 0.4);
      ctx.font = `bold ${compact ? 7 : 9}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (isActive) { ctx.shadowBlur = 5; ctx.shadowColor = color; }
      ctx.fillText(`T${t}`, x + boxW/2, ty + boxH/2);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  // ── Signal list: shows active signals as "CO + MI" with description ──
  // signals: array of { name, type: 'out'|'in'|'internal', desc }
  // activeNames: array of signal name strings currently active
  drawSignalList(ctx, x, y, w, signals, activeNames, opts = {}) {
    const {
      alpha   = 1,
      compact = false,
    } = opts;

    if (alpha <= 0 || !signals || signals.length === 0) return;

    const color = C.ctrl;
    const lineH = compact ? 13 : 17;
    const padX  = compact ? 5  : 8;
    const padY  = compact ? 4  : 6;
    const totalH = padY * 2 + signals.length * lineH + (compact ? 14 : 18);

    ctx.save();
    ctx.globalAlpha = alpha;

    // Background panel
    ctx.fillStyle   = 'rgba(6,9,15,0.85)';
    ctx.strokeStyle = rgbaStr(color, 0.35);
    ctx.lineWidth   = 1;
    this._roundRect(ctx, x, y, w, totalH, 5);
    ctx.fill();
    ctx.stroke();

    // Header: "ACTIVE SIGNALS"
    ctx.fillStyle = rgbaStr(color, 0.55);
    ctx.font = `bold ${compact ? 7 : 8}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('ACTIVE SIGNALS', x + padX, y + padY);

    const typeColors = { 'out': '#ffcc44', 'in': '#44ddff', 'internal': '#cccccc' };

    // Active signal names in a row (e.g. "CO + MI")
    const active = signals.filter(s => activeNames.includes(s.name));
    const inactive = signals.filter(s => !activeNames.includes(s.name));

    let rowY = y + padY + (compact ? 12 : 16);

    // Render each signal line
    for (const sig of signals) {
      const isActive = activeNames.includes(sig.name);
      const sigColor = typeColors[sig.type] || '#cccccc';

      ctx.globalAlpha = alpha * (isActive ? 1 : 0.28);

      // Signal name badge
      const nameW = compact ? 20 : 26;
      ctx.fillStyle   = rgbaStr(sigColor, isActive ? 0.2 : 0.06);
      ctx.strokeStyle = rgbaStr(sigColor, isActive ? 0.7 : 0.2);
      ctx.lineWidth   = isActive ? 1 : 0.5;
      if (isActive) { ctx.shadowBlur = 6; ctx.shadowColor = sigColor; }
      this._roundRect(ctx, x + padX, rowY, nameW, lineH - 2, 2);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = isActive ? sigColor : rgbaStr(sigColor, 0.4);
      ctx.font = `bold ${compact ? 6 : 7.5}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (isActive) { ctx.shadowBlur = 4; ctx.shadowColor = sigColor; }
      ctx.fillText(sig.name, x + padX + nameW/2, rowY + (lineH-2)/2);
      ctx.shadowBlur = 0;

      // Description
      if (!compact && sig.desc) {
        ctx.globalAlpha = alpha * (isActive ? 0.8 : 0.2);
        ctx.fillStyle = isActive ? C.textPrimary : C.textMuted;
        ctx.font = `${7}px Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(sig.desc, x + padX + nameW + 5, rowY + (lineH-2)/2);
      }

      rowY += lineH;
    }

    ctx.globalAlpha = alpha;
    ctx.restore();
  }

  // ── Microcode table: the full ROM visualization ──
  // Shows all instructions × T-states, with current cell highlighted
  drawMicrocodeTable(ctx, x, y, w, h, activeOpcode, activeTstate, opts = {}) {
    const {
      alpha   = 1,
      compact = false,
    } = opts;

    if (alpha <= 0) return;

    const MICROCODE = [
      { op: 'FETCH', color: C.pc,   row: [
        ['CO|MI',    'RO|II|CE', '',        '',           ''],
      ]},
      { op: 'LDA',   color: C.regA, row: [
        ['',         '',         'IO|MI',   'RO|AI',      ''],
      ]},
      { op: 'ADD',   color: C.alu,  row: [
        ['',         '',         'IO|MI',   'RO|BI',      'EO|AI|FI'],
      ]},
      { op: 'SUB',   color: C.alu,  row: [
        ['',         '',         'IO|MI',   'RO|BI',      'EO|AI|SU|FI'],
      ]},
      { op: 'OUT',   color: C.out,  row: [
        ['',         '',         'AO|OI',   '',           ''],
      ]},
      { op: 'HLT',   color: C.ctrl, row: [
        ['',         '',         'HLT',     '',           ''],
      ]},
    ];

    const tHeaders = ['T0', 'T1', 'T2', 'T3', 'T4'];
    const labelW   = compact ? 32 : 44;
    const cellW    = (w - labelW - 6) / 5;
    const rowH     = compact ? 14 : 20;
    const hdrH     = compact ? 14 : 18;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Background
    ctx.fillStyle   = 'rgba(6,9,15,0.9)';
    ctx.strokeStyle = rgbaStr(C.ctrl, 0.3);
    ctx.lineWidth   = 1;
    const totalH = hdrH + MICROCODE.length * rowH + 8;
    this._roundRect(ctx, x, y, w, totalH, 5);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = rgbaStr(C.ctrl, 0.6);
    ctx.font = `bold ${compact ? 6 : 7.5}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MICROCODE ROM', x + w/2, y + hdrH/2);

    // T-state column headers
    for (let t = 0; t < 5; t++) {
      const cx = x + labelW + t * cellW + cellW/2;
      const isActiveT = t === activeTstate;
      ctx.fillStyle = isActiveT ? C.ctrl : rgbaStr(C.textMuted, 0.5);
      ctx.font = `bold ${compact ? 6 : 7}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (isActiveT) { ctx.shadowBlur = 5; ctx.shadowColor = C.ctrl; }
      ctx.fillText(tHeaders[t], cx, y + hdrH/2);
      ctx.shadowBlur = 0;
    }

    // Separator
    ctx.strokeStyle = rgbaStr(C.textMuted, 0.2);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + hdrH);
    ctx.lineTo(x + w - 2, y + hdrH);
    ctx.stroke();

    // Rows
    for (let ri = 0; ri < MICROCODE.length; ri++) {
      const entry = MICROCODE[ri];
      const ry = y + hdrH + ri * rowH;
      const isActiveRow = entry.op === activeOpcode || (entry.op === 'FETCH' && activeTstate <= 1);
      const rowColor = entry.color;

      // Row background
      ctx.fillStyle = rgbaStr(rowColor, isActiveRow ? 0.14 : 0.04);
      ctx.fillRect(x + 1, ry + 1, w - 2, rowH - 1);

      // Row label
      ctx.fillStyle = isActiveRow ? rowColor : rgbaStr(rowColor, 0.45);
      ctx.font = `bold ${compact ? 6 : 7.5}px JetBrains Mono, monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if (isActiveRow) { ctx.shadowBlur = 4; ctx.shadowColor = rowColor; }
      ctx.fillText(entry.op, x + 3, ry + rowH/2);
      ctx.shadowBlur = 0;

      // Cells
      const rowData = entry.row[0];
      for (let t = 0; t < 5; t++) {
        const cell = rowData[t] || '';
        const cx   = x + labelW + t * cellW;
        const isCurrent = isActiveRow && t === activeTstate;

        if (isCurrent && cell) {
          ctx.fillStyle   = rgbaStr(C.ctrl, 0.25);
          ctx.strokeStyle = C.ctrl;
          ctx.lineWidth   = 1;
          ctx.shadowBlur  = 8;
          ctx.shadowColor = C.ctrl;
          this._roundRect(ctx, cx + 1, ry + 2, cellW - 2, rowH - 4, 2);
          ctx.fill(); ctx.stroke();
          ctx.shadowBlur = 0;
        }

        if (cell) {
          ctx.fillStyle = isCurrent ? C.ctrl : rgbaStr(rowColor, isActiveRow ? 0.75 : 0.3);
          ctx.font = `bold ${compact ? 5 : 6.5}px JetBrains Mono, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (isCurrent) { ctx.shadowBlur = 4; ctx.shadowColor = C.ctrl; }
          ctx.fillText(cell, cx + cellW/2, ry + rowH/2);
          ctx.shadowBlur = 0;
        }
      }
    }

    ctx.restore();
  }

  /* ── Private helpers ── */
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x+w, y,   x+w, y+r);
    ctx.lineTo(x+w, y+h-r);
    ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h);
    ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r);
    ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
  }

  _roundRectTop(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h);
    ctx.lineTo(x, y+h);
    ctx.lineTo(x, y+r);
    ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
  }

  /* ── Convenience step builders (add to timeline) ── */

  // Fade in a full-screen text scene
  scene_titleCard(mainText, subText, duration = 3000, opts = {}) {
    const sceneId = opts.sceneId || 0;
    this.addStep(new Step(duration, (ctx, p, eng) => {
      const { W, H } = eng;
      // Phase: 0-0.15 fade in, 0.7-1.0 fade out (if opts.fadeOut)
      let alpha;
      if (opts.fadeOut) {
        if (p < 0.15) alpha = p / 0.15;
        else if (p > 0.80) alpha = 1 - (p - 0.80) / 0.20;
        else alpha = 1;
      } else {
        alpha = p < 0.15 ? p / 0.15 : 1;
      }

      // Subtle grid background
      ctx.save();
      ctx.globalAlpha = 0.04;
      ctx.strokeStyle = '#4488ff';
      ctx.lineWidth = 1;
      const gSize = 60;
      for (let gx = 0; gx < W; gx += gSize) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = 0; gy < H; gy += gSize) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }
      ctx.restore();

      eng.drawText(ctx, mainText, W/2, H/2 - (subText ? 20 : 0), {
        font:    opts.mainFont || `bold ${Math.min(W/18, 48)}px Inter, sans-serif`,
        color:   opts.mainColor || C.textPrimary,
        alpha,
        align:   'center',
        baseline:'middle',
        shadow:   true,
        shadowColor: opts.mainColor || '#4488ff',
        shadowBlur:  20,
      });

      if (subText) {
        eng.drawText(ctx, subText, W/2, H/2 + 30, {
          font:  opts.subFont || `${Math.min(W/30, 22)}px Inter, sans-serif`,
          color: opts.subColor || C.textSecondary,
          alpha: alpha * 0.85,
          align: 'center',
          baseline:'middle',
        });
      }
    }, { label: opts.label || '', sceneId, easing: Ease.linear, audio: opts.audio || null }));
    return this;
  }

  // Caption-only step
  scene_caption(text, duration = 3000, opts = {}) {
    this.addStep(new Step(duration, (ctx, p, eng) => {
      let alpha;
      if (p < 0.12)      alpha = p / 0.12;
      else if (p > 0.85) alpha = 1 - (p - 0.85) / 0.15;
      else               alpha = 1;
      eng.drawCaption(ctx, text, alpha, opts);
    }, { easing: Ease.linear, ...opts }));
    return this;
  }

  /* ═══════════════════════════════════════
     AUDIO SYSTEM
  ═══════════════════════════════════════ */

  /**
   * Preload all audio clips referenced by timeline steps.
   * Gracefully does nothing if files are missing (no errors thrown).
   */
  preloadAudio() {
    const ids = new Set();
    for (const step of this.timeline) {
      if (step.audio) ids.add(step.audio);
    }
    for (const id of ids) {
      if (this._audioCache[id]) continue;
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = this._audioBasePath + id + '.mp3';
      audio.volume = this._audioMuted ? 0 : this._audioVolume;
      // Graceful fallback: silently ignore load errors
      audio.addEventListener('error', () => {
        // Audio file not found — that's fine, narration is optional
      });
      this._audioCache[id] = audio;
    }
  }

  /**
   * Play a narration clip by id. Stops any currently playing clip first.
   */
  playAudio(id) {
    if (!id) return;
    this.stopAudio();
    let audio = this._audioCache[id];
    if (!audio) {
      // Try to create on the fly
      audio = new Audio();
      audio.src = this._audioBasePath + id + '.mp3';
      audio.addEventListener('error', () => {});
      this._audioCache[id] = audio;
    }
    audio.currentTime = 0;
    audio.volume = this._audioMuted ? 0 : this._audioVolume;
    this._currentAudio = audio;
    // play() returns a promise; ignore rejections (e.g. file not found)
    audio.play().catch(() => {});
  }

  /**
   * Stop any currently playing narration.
   */
  stopAudio() {
    if (this._currentAudio) {
      this._currentAudio.pause();
      this._currentAudio.currentTime = 0;
      this._currentAudio = null;
    }
  }

  /**
   * Pause the currently playing narration (resumable).
   */
  pauseAudio() {
    if (this._currentAudio && !this._currentAudio.paused) {
      this._currentAudio.pause();
    }
  }

  /**
   * Resume a paused narration clip.
   */
  resumeAudio() {
    if (this._currentAudio && this._currentAudio.paused && this._currentAudio.currentTime > 0) {
      this._currentAudio.play().catch(() => {});
    }
  }

  /**
   * Set mute state. Updates all cached audio elements.
   */
  setMuted(muted) {
    this._audioMuted = muted;
    const vol = muted ? 0 : this._audioVolume;
    for (const id in this._audioCache) {
      this._audioCache[id].volume = vol;
    }
    if (this._currentAudio) {
      this._currentAudio.volume = vol;
    }
  }

  /**
   * Set volume (0..1). Updates all cached audio elements.
   */
  setVolume(vol) {
    this._audioVolume = clamp(vol, 0, 1);
    if (!this._audioMuted) {
      for (const id in this._audioCache) {
        this._audioCache[id].volume = this._audioVolume;
      }
      if (this._currentAudio) {
        this._currentAudio.volume = this._audioVolume;
      }
    }
  }

  destroy() {
    this.pause();
    this.stopAudio();
    if (this._resizeObserver) this._resizeObserver.disconnect();
  }
}

/* ═══════════════════════════════════════════════════════════
   RAM METADATA — Episode 1 program layout
═══════════════════════════════════════════════════════════ */

// SAP-1 format: each instruction is 1 byte — upper 4 bits = opcode, lower 4 bits = address/data
// 0x1E = 0001|1110 → LDA (0001) address 14 (1110)
// 0x2F = 0010|1111 → ADD (0010) address 15 (1111)
// 0xE0 = 1110|0000 → OUT (1110) unused (0000)
// 0xF0 = 1111|0000 → HLT (1111) unused (0000)
const RAM_META = [
  { addr: 0,  value: 0x1E, type: 'instruction', mnemonic: 'LDA', operand: 14, label: 'Load from addr 14' },
  { addr: 1,  value: 0x2F, type: 'instruction', mnemonic: 'ADD', operand: 15, label: 'Add from addr 15'  },
  { addr: 2,  value: 0xE0, type: 'instruction', mnemonic: 'OUT', operand: 0,  label: 'Output Reg A'      },
  { addr: 3,  value: 0xF0, type: 'instruction', mnemonic: 'HLT', operand: 0,  label: 'Halt clock'        },
  { addr: 4,  value: 0,    type: 'empty',        mnemonic: '',    operand: 0,  label: '' },
  { addr: 5,  value: 0,    type: 'empty',        mnemonic: '',    operand: 0,  label: '' },
  { addr: 6,  value: 0,    type: 'empty',        mnemonic: '',    operand: 0,  label: '' },
  { addr: 7,  value: 0,    type: 'empty',        mnemonic: '',    operand: 0,  label: '' },
  { addr: 8,  value: 0,    type: 'empty',        mnemonic: '',    operand: 0,  label: '' },
  { addr: 9,  value: 0,    type: 'empty',        mnemonic: '',    operand: 0,  label: '' },
  { addr: 10, value: 0,    type: 'empty',        mnemonic: '',    operand: 0,  label: '' },
  { addr: 11, value: 0,    type: 'empty',        mnemonic: '',    operand: 0,  label: '' },
  { addr: 12, value: 0,    type: 'empty',        mnemonic: '',    operand: 0,  label: '' },
  { addr: 13, value: 0,    type: 'empty',        mnemonic: '',    operand: 0,  label: '' },
  { addr: 14, value: 28,   type: 'data',         mnemonic: '',    operand: 0,  label: '= 28' },
  { addr: 15, value: 14,   type: 'data',         mnemonic: '',    operand: 0,  label: '= 14' },
];

/* ═══════════════════════════════════════════════════════════
   EPISODE 1 — "How a CPU Executes an Instruction"
═══════════════════════════════════════════════════════════ */

/**
 * Builds the full Episode 1 timeline on the given engine.
 * Uses the engine's scene state (eng.scene) to track persistent
 * component positions and values so steps can read them.
 */
function buildEpisode1(eng) {
  eng.clear();

  // Convenience alias
  const e = eng;
  const add = (dur, fn, opts) => e.addStep(new Step(dur, fn, { easing: Ease.inOut, ...opts }));

  // ─── Layout: component positions (relative; scaled from 1280x720 space) ───
  // We compute positions as fractions of W/H so it scales to any canvas size.
  function layout(W, H) {
    const isMobile = W < 600;
    const isSmall  = W < 450;

    // Responsive margins
    const m = isMobile
      ? { t: 35, b: 70, l: 8, r: 8 }
      : { t: 40, b: 60, l: 15, r: 15 };

    // Components use the FULL width — RAM grid overlays on right when needed
    const cW = W - m.l - m.r;
    const cH = H - m.t - m.b;

    let cw, ch, busY, addressBusY, dataBusY, controlBusY, row3end;
    let pc, mar, ram, ir, a, b, alu, out;

    if (isMobile) {
      // ── MOBILE LAYOUT: 2 columns, 4 rows with 3 buses (compact spacing) ──
      cw = Math.min(cW * 0.44, 150);
      // 3 buses need ~8px gap each + 8px padding between them = ~30px total bus zone
      const busZone = 30;
      const totalRowsH = cH - busZone;
      ch = Math.min(totalRowsH / 4.3, 55);

      const gapX = cW - cw * 2;
      const col1 = m.l + gapX * 0.15;
      const col2 = m.l + cW - cw - gapX * 0.15;

      const rowGap = Math.max(3, (totalRowsH - ch * 4) / 5);

      const row1 = m.t + rowGap;
      const row2 = row1 + ch + rowGap;
      // 3 bus lines between row2 and row3, spaced 8px apart
      addressBusY = row2 + ch + 8;
      dataBusY    = addressBusY + 9;
      controlBusY = dataBusY + 9;
      busY = dataBusY;  // backward-compat alias
      const row3 = controlBusY + 7;
      const row4 = row3 + ch + rowGap;

      pc  = { x: col1, y: row1 };
      ram = { x: col2, y: row1 };
      mar = { x: col1, y: row2 };
      ir  = { x: col2, y: row2 };
      a   = { x: col1, y: row3 };
      b   = { x: col2, y: row3 };
      alu = { x: col1, y: row4 };
      out = { x: col2, y: row4 };
      row3end = row4 + ch;

    } else {
      // ── DESKTOP LAYOUT ──
      // Left 65%: 3 columns × 3 rows of components + buses
      // Right 35%: RAM grid (16 addresses) + CU + signals
      //
      // LEFT SIDE:
      // Row 1:  PC        MAR       RAM(chip)
      //         ═══ ADDR BUS ═══ DATA BUS ═══ CTRL BUS ═══
      // Row 2:  IR        ALU
      // Row 3:  REG A     REG B     OUTPUT
      //
      // RIGHT SIDE:
      // RAM grid (16 addresses)
      // CU
      // Signals / T-state

      // Reserve right side for RAM grid + CU
      const rightW = Math.min(W * 0.30, 280);
      const leftW  = cW - rightW - 20; // 20px gap between left and right

      // Component size based on left area
      cw = Math.min(leftW * 0.30, 130);
      ch = 75;

      // 3 columns pushed LEFT — small fixed gap between each
      const colGap = 30;
      const col1 = m.l;
      const col2 = col1 + cw + colGap;
      const col3 = col2 + cw + colGap;

      // Maximize vertical spread — use ALL available height
      // Row1 flush to top, buses in middle, row2 and row3 pushed down
      const row1 = m.t;                              // flush to top margin

      addressBusY = row1 + ch + 10;                  // just below row1
      dataBusY    = addressBusY + 18;                 // below address bus

      // Control bus gets big space — 15 lines at 5px each = 70px
      controlBusY = dataBusY + 50;                    // gap between data and control
      busY = dataBusY;

      const row2 = controlBusY + 55;                  // row2 well below control bus
      const row3 = H - m.b - ch;                      // row3 flush to bottom

      pc  = { x: col1, y: row1 };
      mar = { x: col2, y: row1 };
      ram = { x: col3, y: row1 };
      ir  = { x: col1, y: row2 };
      alu = { x: col2, y: row2 };
      a   = { x: col1, y: row3 };
      b   = { x: col2, y: row3 };
      out = { x: col3, y: row3 };
      row3end = row3 + ch;
    }

    // Add cx/cy to each position
    function addCenter(pos) {
      return { ...pos, cx: pos.x + cw/2, cy: pos.y + ch/2 };
    }

    // RAM grid: right side on desktop
    const rightStartX = isMobile ? 0 : (W - m.r - (Math.min(W * 0.30, 280)));
    const ramGridW = isMobile ? 0 : (W - m.r - rightStartX);
    const ramGrid = isMobile ? null : {
      x: rightStartX,
      y: m.t,
      w: ramGridW,
      h: (H - m.t - m.b) * 0.55,  // top 55% of right side
    };

    // Bus spans the left component area only
    const busX2 = isMobile ? (W - m.r - 5) : (rightStartX - 15);

    // Control Unit: right of OUTPUT (row3, col4 area), 15 signal lines come out the top
    let cuW, cuH, cuX, cuY;
    if (isMobile) {
      cuW = Math.min(cW * 0.5, 140);
      cuH = Math.min(ch * 0.7, 40);
      cuX = m.l + (cW - cuW) / 2;
      cuY = row3end + 6;
    } else {
      cuW = cw;
      cuH = ch;
      cuX = out.x + cw + 30;  // right of OUTPUT, same gap as between columns
      cuY = out.y;                  // same row as OUTPUT (row3)
    }

    // Signal list: below CU on desktop
    const sigListX = isMobile ? m.l : cuX;
    const sigListY = isMobile ? (cuY + cuH + 6) : (cuY + cuH + 8);
    const sigListW = isMobile ? Math.min(cW * 0.6, 160) : cuW;

    // T-state counter: right of CU on desktop
    const tStateX = isMobile ? (cuX + cuW + 4) : (cuX + cuW + 8);
    const tStateY = isMobile ? cuY : cuY;

    // Microcode table: below row3, left side
    const mcX = m.l;
    const mcY = row3end + 10;
    const mcW = isMobile ? (cW * 0.95) : Math.min(cW * 0.8, 500);

    return {
      cw, ch, cuW, cuH,
      busY, addressBusY, dataBusY, controlBusY,  // all 3 bus positions; busY = dataBusY alias
      isMobile,
      busX1: m.l + 5,
      busX2,
      ramGrid,
      pc:  addCenter(pc),
      mar: addCenter(mar),
      ram: addCenter(ram),
      ir:  addCenter(ir),
      a:   addCenter(a),
      b:   addCenter(b),
      alu: addCenter(alu),
      out: addCenter(out),
      cu:  { x: cuX, y: cuY, cx: cuX + cuW/2, cy: cuY + cuH/2 },
      sigList:  { x: sigListX, y: sigListY, w: sigListW },
      tState:   { x: tStateX, y: tStateY },
      microcode:{ x: mcX, y: mcY, w: mcW },
    };
  }

  // ── Signal definitions (all SAP-1 control signals) ──
  const SIGNALS = [
    { name:'CO',  type:'out',      desc:'PC outputs address to bus'        },
    { name:'CE',  type:'internal', desc:'PC counter increments'             },
    { name:'MI',  type:'in',       desc:'MAR reads address from bus'        },
    { name:'RO',  type:'out',      desc:'RAM outputs data to bus'           },
    { name:'RI',  type:'in',       desc:'RAM reads data from bus (write)'   },
    { name:'II',  type:'in',       desc:'IR reads instruction from bus'     },
    { name:'IO',  type:'out',      desc:'IR outputs operand to bus'         },
    { name:'AI',  type:'in',       desc:'Reg A reads data from bus'         },
    { name:'AO',  type:'out',      desc:'Reg A outputs data to bus'         },
    { name:'BI',  type:'in',       desc:'Reg B reads data from bus'         },
    { name:'EO',  type:'out',      desc:'ALU result goes to bus'            },
    { name:'SU',  type:'internal', desc:'ALU performs subtraction'          },
    { name:'OI',  type:'in',       desc:'Output register reads from bus'    },
    { name:'FI',  type:'internal', desc:'Flags register is updated'         },
    { name:'HLT', type:'internal', desc:'Clock halts'                       },
  ];

  // ── Microcode: which signals fire at each T-state ──
  // Key: 'FETCH_T0', 'FETCH_T1', 'LDA_T2', etc.
  const MICROCODE_SIGNALS = {
    'FETCH_T0': ['CO','MI'],
    'FETCH_T1': ['RO','II','CE'],
    'LDA_T2':   ['IO','MI'],
    'LDA_T3':   ['RO','AI'],
    'ADD_T2':   ['IO','MI'],
    'ADD_T3':   ['RO','BI'],
    'ADD_T4':   ['EO','AI','FI'],
    'SUB_T2':   ['IO','MI'],
    'SUB_T3':   ['RO','BI'],
    'SUB_T4':   ['EO','AI','SU','FI'],
    'OUT_T2':   ['AO','OI'],
    'HLT_T2':   ['HLT'],
  };

  // Shared mutable scene state
  const S = {
    pcVal:  0,
    marVal: 0,
    irText: '---',
    irVal: 0,
    aVal:   0,
    bVal:   0,
    aluVal: 0,
    outVal: '-',
    cf: 0, zf: 0,
    // component alpha (appear animation)
    alpha: { pc:0, mar:0, ram:0, ir:0, a:0, b:0, alu:0, out:0, bus:0, cu:0 },
    // active glow
    glow:  { pc:false, mar:false, ram:false, ir:false, a:false, b:false, alu:false, out:false, cu:false },
    // bus active — all 3 buses
    busActive: false,          // backward-compat alias for dataBusActive
    dataBusActive: false,
    dataBusValue: -1,          // 8-bit value currently on data bus
    addressBusActive: false,
    addressBusValue: -1,       // 4-bit value currently on address bus
    controlBusActive: false,
    busFlowProgress: -1,
    busFlowFrom: null,
    busFlowTo:   null,
    busFlowValue: '',
    busFlowColor: C.dataGlow,
    busFlowBusType: 'data',    // 'data' | 'address' | 'control' — which bus the active flow uses
    _busNumericValue: -1,  // numeric value for 8-bit line display
    // ── Control Unit state ──
    showControlUnit:  false,   // whether CU panel is visible
    currentTState:    -1,      // -1=not shown, 0-4 = active T-state
    activeSignals:    [],      // array of signal names currently firing
    cuOpcode:         '',      // opcode string shown inside CU ('LDA','ADD',...)
    showSignalLines:  false,   // whether to draw signal lines from CU to components
    showSignalList:   false,   // whether to draw signal list panel
    showMicrocode:    false,   // whether to draw microcode table
    microcodeAlpha:   0,
    signalListAlpha:  0,
    signalLinesAlpha: 0,
    // RAM memory cells
    ram: new Array(256).fill(0),
    ramHighlight: -1,
    // Caption
    caption: '',
    captionAlpha: 0,
    // Instruction format legend (top of screen) — SAP-1: driven by irVal
    showInstructionFormat: false,
    instrFmtMode: 'decode',    // 'fetch' | 'decode'
    instrFmtAlpha: 0,
    // Bit-arrival animation: tracks which bits have "landed" in destination
    // Array of 8 booleans per register — set during flow animations
    bitArrival: { pc: null, mar: null, ram: null, ir: null, a: null, b: null, alu: null, out: null },
    // RAM grid visualization
    showRAMGrid: false,
    ramGridAlpha: 0,
    ramGridHighlightAddr: -1,   // which address cell is currently flashing
    ramGridHighlightPair: -1,   // opcode addr of current instruction pair (0=LDA, 2=ADD, etc.)
    // Decode step state: tracks which decode sub-step is showing
    decodeStep: 0,  // 0=raw bits, 1=opcode lookup, 2=operand fetch, 3=combined meaning
  };

  // Pre-fill the program we animate — SAP-1 format (1 byte per instruction)
  // Upper 4 bits = opcode, lower 4 bits = address operand
  S.ram[0]  = 0x1E;  // LDA 14  → 0001|1110
  S.ram[1]  = 0x2F;  // ADD 15  → 0010|1111
  S.ram[2]  = 0xE0;  // OUT     → 1110|0000
  S.ram[3]  = 0xF0;  // HLT     → 1111|0000
  S.ram[14] = 28;
  S.ram[15] = 14;

  eng.scene = S;

  // ─── Base layer: draws all visible components ───
  function baseLayer(ctx, eng) {
    const { W, H } = eng;
    const L = layout(W, H);
    const mob = L.isMobile;  // compact mode on mobile

    // ── THREE BUSES ──
    // Which bus carries the active flow?
    const flowBusType = S.busFlowBusType || 'data';

    if (S.alpha.bus > 0) {
      // ── ADDRESS BUS (green, 4 lines) ──
      // Active when an address value is traveling on it
      const addrBusActive  = S.addressBusActive || (S.busActive && flowBusType === 'address');
      const addrBusValue   = addrBusActive
        ? (S.addressBusValue >= 0 ? S.addressBusValue : (flowBusType === 'address' ? S._busNumericValue : -1))
        : -1;

      eng.drawBus(ctx, L.busX1, L.addressBusY, L.busX2, {
        alpha:   S.alpha.bus,
        color:   C.addrBus,
        active:  addrBusActive,
        busValue: addrBusValue,
        busType: 'address',
      });

      // ── DATA BUS (amber, 8 lines) ──
      const dataBusActive  = S.dataBusActive || (S.busActive && flowBusType === 'data');
      const activeBusValue = dataBusActive
        ? (S.dataBusValue >= 0 ? S.dataBusValue : (flowBusType === 'data' ? S._busNumericValue || -1 : -1))
        : -1;

      eng.drawBus(ctx, L.busX1, L.dataBusY, L.busX2, {
        alpha:   S.alpha.bus,
        color:   C.bus,
        thick:   7,
        active:  dataBusActive,
        busValue: activeBusValue,
        busType: 'data',
      });

      // ── CONTROL BUS (red, 15 lines) ──
      eng.drawBus(ctx, L.busX1, L.controlBusY, L.busX2, {
        alpha:   S.alpha.bus,
        color:   C.ctrlBus,
        active:  S.controlBusActive || (S.activeSignals && S.activeSignals.length > 0),
        busType: 'control',
        activeSignals: S.activeSignals || [],
      });

      // ── Simple vertical drops from each component to its bus ──
      const allComps = [
        { pos: L.pc,  key: 'pc',  busY: L.addressBusY, color: C.addrBus, bus: 'address' },
        { pos: L.mar, key: 'mar', busY: L.addressBusY, color: C.addrBus, bus: 'address' },
        { pos: L.ram, key: 'ram', busY: L.dataBusY,    color: C.bus,     bus: 'data' },
        { pos: L.ir,  key: 'ir',  busY: L.dataBusY,    color: C.bus,     bus: 'data' },
        { pos: L.a,   key: 'a',   busY: L.dataBusY,    color: C.bus,     bus: 'data' },
        { pos: L.b,   key: 'b',   busY: L.dataBusY,    color: C.bus,     bus: 'data' },
        { pos: L.alu, key: 'alu', busY: L.dataBusY,    color: C.bus,     bus: 'data' },
        { pos: L.out, key: 'out', busY: L.dataBusY,    color: C.bus,     bus: 'data' },
      ];

      for (const c of allComps) {
        if (S.alpha[c.key] <= 0) continue;
        const compTop = c.pos.y;
        const compBottom = c.pos.y + L.ch;
        const isAbove = compTop + L.ch < c.busY;
        const isActiveComp = (S.busActive || S.dataBusActive || S.addressBusActive) && (
          (S.busFlowFrom && S.busFlowFrom.key === c.key) ||
          (S.busFlowTo   && S.busFlowTo.key   === c.key)
        );
        const bVal = isActiveComp ? (c.bus === 'address' ? addrBusValue : activeBusValue) : -1;

        // Each bit cell connects to its own bus line
        if (!mob) {
          eng.drawBitWires(ctx, c.busY, c.pos.x, c.pos.y, L.cw, L.ch, {
            alpha:   S.alpha.bus * S.alpha[c.key],
            color:   c.color,
            active:  isActiveComp,
            busValue: bVal,
            compact: false,
            above:   isAbove,
            busType: c.bus,
          });
        } else {
          const cx = c.pos.cx;
          const compEdgeY = isAbove ? compBottom : compTop;
          eng.drawBusV(ctx, cx, c.busY, compEdgeY, {
            alpha:  S.alpha.bus * S.alpha[c.key],
            color:  c.color,
            thick:  3,
            active: isActiveComp,
            busValue: bVal,
          });
        }
      }
    }

    // Determine read/write state for each component from active signals
    const sigs = S.activeSignals || [];
    const rw = {
      pc:  sigs.includes('CO') ? 'write' : (sigs.includes('CE') ? 'read' : null),
      mar: sigs.includes('MI') ? 'read' : null,
      ram: sigs.includes('RO') ? 'write' : (sigs.includes('RI') ? 'read' : null),
      ir:  sigs.includes('IO') ? 'write' : (sigs.includes('II') ? 'read' : null),
      a:   sigs.includes('AO') ? 'write' : (sigs.includes('AI') ? 'read' : null),
      b:   sigs.includes('BI') ? 'read' : null,
      alu: sigs.includes('EO') ? 'write' : null,
      out: sigs.includes('OI') ? 'read' : null,
    };

    // ── Enable pins: ALWAYS show on desktop so the student sees them ──
    // Pins are visible from the moment a component appears.
    // Active pins glow when CU fires the signal.
    const showPins = !mob;
    const showCUWires = !mob;

    function compPins(specs) {
      if (!showPins) return undefined;
      return specs.map(p => ({
        ...p,
        active: sigs.includes(p.name),
      }));
    }

    // Enable pins — positioned at corners/edges to avoid overlap between components
    // Row 1 (above bus): pins go on BOTTOM edges (toward bus)
    // Row 2 (below bus): pins go on TOP edges (toward bus)
    // Row 3 (bottom): pins on TOP edges

    // Enable pins — labelOffset shifts text up(-) or down(+) to avoid overlaps between neighbors

    // PC (row1 col1): CO bottom-right (label up), CE top-right
    const pcPins  = compPins([
      { name: 'CO', side: 'bottom-right', type: 'out',      labelOffset: -6 },
      { name: 'CE', side: 'top-right',    type: 'internal', labelOffset: 0  },
    ]);

    // MAR (row1 col2): MI bottom-left (label down, avoids PC's CO)
    const marPins = compPins([
      { name: 'MI', side: 'bottom-left', type: 'in', labelOffset: 6 },
    ]);

    // RAM (row1 col3): RI bottom-left (label down), RO bottom-right
    const ramPins = compPins([
      { name: 'RI', side: 'bottom-left',  type: 'in',  labelOffset: 6  },
      { name: 'RO', side: 'bottom-right', type: 'out', labelOffset: -6 },
    ]);

    // IR (row2 col1): II top-left, IO top-right (label up, avoids ALU's SU)
    const irPins  = compPins([
      { name: 'II', side: 'top-left',  type: 'in',  labelOffset: 0  },
      { name: 'IO', side: 'top-right', type: 'out', labelOffset: -6 },
    ]);

    // Reg A (row3 col1): AI top-left, AO top-right (label up, avoids Reg B's BI)
    const aPins   = compPins([
      { name: 'AI', side: 'top-left',  type: 'in',  labelOffset: 0  },
      { name: 'AO', side: 'top-right', type: 'out', labelOffset: -6 },
    ]);

    // Reg B (row3 col2): BI top-left (label down, avoids Reg A's AO)
    const bPins   = compPins([
      { name: 'BI', side: 'top-left', type: 'in', labelOffset: 6 },
    ]);

    // ALU (row2 col2): EO top-right, SU top-left (label down, avoids IR's IO)
    const aluPins = compPins([
      { name: 'EO', side: 'top-right', type: 'out',      labelOffset: 0 },
      { name: 'SU', side: 'top-left',  type: 'internal', labelOffset: 6 },
    ]);

    // Output (row3 col3): OI top-left
    const outPins = compPins([
      { name: 'OI', side: 'top-left', type: 'in', labelOffset: 0 },
    ]);

    // PC
    if (S.alpha.pc > 0) {
      eng.drawComponent(ctx, 'PC', 'Program Counter',
        L.pc.x, L.pc.y, L.cw, L.ch, C.pc, {
          alpha: S.alpha.pc,
          glow: S.glow.pc,
          glowColor: C.pc,
          glowAmt: 25,
          valueText: mob ? `${S.pcVal}` : `(${S.pcVal})`,
          valueColor: C.pc,
          binaryValue: S.pcVal,
          bitHighlight: S.bitArrival.pc,
          compact: mob,
          rwState: rw.pc,
          enablePins: pcPins,
        });
    }

    // MAR
    if (S.alpha.mar > 0) {
      eng.drawComponent(ctx, 'MAR', 'Memory Address Reg',
        L.mar.x, L.mar.y, L.cw, L.ch, C.mar, {
          alpha: S.alpha.mar,
          glow: S.glow.mar,
          glowColor: C.mar,
          glowAmt: 25,
          valueText: mob ? `${S.marVal}` : `(${S.marVal})`,
          valueColor: C.mar,
          binaryValue: S.marVal,
          bitHighlight: S.bitArrival.mar,
          compact: mob,
          rwState: rw.mar,
          enablePins: marPins,
        });
    }

    // RAM — show binary when cell is highlighted
    if (S.alpha.ram > 0) {
      const ramBinVal = S.ramHighlight >= 0 ? S.ram[S.ramHighlight] : -1;
      eng.drawComponent(ctx, 'RAM', mob ? '' : '16 × 8 bit',
        L.ram.x, L.ram.y, L.cw, L.ch, C.ram, {
          alpha: S.alpha.ram,
          glow: S.glow.ram,
          glowColor: C.ram,
          glowAmt: 25,
          // Show the highlighted cell's binary content as the primary display
          binaryValue: ramBinVal >= 0 ? ramBinVal : undefined,
          valueText: S.ramHighlight >= 0
            ? `[${S.ramHighlight}]=${S.ram[S.ramHighlight]}`
            : (mob ? '' : '16 × 8 bit'),
          valueColor: C.ram,
          compact: mob,
          rwState: rw.ram,
          enablePins: ramPins,
        });
    }

    // Hardwired MAR → RAM address lines (4 lines, not through any bus)
    if (S.alpha.mar > 0 && S.alpha.ram > 0 && !mob) {
      const marBitPos = eng.getBitCellPositions(L.mar.x, L.mar.y, L.cw, L.ch, false);
      const ramBitPos = eng.getBitCellPositions(L.ram.x, L.ram.y, L.cw, L.ch, false);
      ctx.save();
      ctx.globalAlpha = S.alpha.mar * S.alpha.ram;
      // MAR lower 4 bits (indices 4-7 = bits 3-0) connect to RAM address pins
      for (let i = 0; i < 4; i++) {
        const marIdx = 4 + i;  // MAR bit cells 4,5,6,7 = address bits 3,2,1,0
        const ramIdx = 4 + i;  // RAM address input pins (same positions)
        const marPos = marBitPos[marIdx];
        const ramPos = ramBitPos[ramIdx];
        const bit = (S.marVal >>> (3 - i)) & 1;
        const isActive = S.glow.mar || S.glow.ram;

        ctx.strokeStyle = isActive && bit ? C.mar : rgbaStr(C.mar, 0.5);
        ctx.lineWidth   = isActive && bit ? 2 : 1;
        ctx.shadowBlur  = isActive && bit ? 6 : 0;
        ctx.shadowColor = C.mar;

        // Draw straight line from MAR right edge to RAM left edge
        ctx.beginPath();
        ctx.moveTo(L.mar.x + L.cw + 2, marPos.y);
        ctx.lineTo(L.ram.x - 2, ramPos.y);
        ctx.stroke();
      }
      // Label
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgbaStr(C.mar, 0.7);
      ctx.font = 'bold 8px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const midX = (L.mar.x + L.cw + L.ram.x) / 2;
      const midY = (marBitPos[5].y + marBitPos[6].y) / 2;
      ctx.fillText('ADDR (4 lines)', midX, midY - 4);
      ctx.fillStyle = rgbaStr(C.mar, 0.5);
      ctx.font = 'bold 7px JetBrains Mono, monospace';
      ctx.fillText('hardwired — not on bus', midX, midY + 6);
      ctx.restore();
    }

    // IR
    if (S.alpha.ir > 0) {
      eng.drawComponent(ctx, 'IR', mob ? '' : 'Instruction Reg',
        L.ir.x, L.ir.y, L.cw, L.ch, C.ir, {
          alpha: S.alpha.ir,
          glow: S.glow.ir,
          compact: mob,
          glowColor: C.ir,
          glowAmt: 25,
          valueText: S.irText,
          valueColor: C.ir,
          binaryValue: S.irVal || 0,
          bitHighlight: S.bitArrival.ir,
          rwState: rw.ir,
          enablePins: irPins,
        });
    }

    // Register A
    if (S.alpha.a > 0) {
      eng.drawComponent(ctx, mob ? 'A' : 'REG A', mob ? '' : 'Accumulator',
        L.a.x, L.a.y, L.cw, L.ch, C.regA, {
          alpha: S.alpha.a,
          glow: S.glow.a,
          glowColor: C.regA,
          glowAmt: 25,
          valueText: `${S.aVal}`,
          valueColor: C.regA,
          binaryValue: S.aVal,
          bitHighlight: S.bitArrival.a,
          compact: mob,
          rwState: rw.a,
          enablePins: aPins,
        });
    }

    // Register B
    if (S.alpha.b > 0) {
      eng.drawComponent(ctx, mob ? 'B' : 'REG B', mob ? '' : 'Temp Register',
        L.b.x, L.b.y, L.cw, L.ch, C.regB, {
          alpha: S.alpha.b,
          glow: S.glow.b,
          glowColor: C.regB,
          glowAmt: 22,
          valueText: `${S.bVal}`,
          valueColor: C.regB,
          binaryValue: S.bVal,
          bitHighlight: S.bitArrival.b,
          compact: mob,
          rwState: rw.b,
          enablePins: bPins,
        });
    }

    // ALU
    if (S.alpha.alu > 0) {
      eng.drawComponent(ctx, 'ALU', mob ? '' : 'Arithmetic Unit',
        L.alu.x, L.alu.y, L.cw, L.ch, C.alu, {
          alpha: S.alpha.alu,
          glow: S.glow.alu,
          glowColor: C.alu,
          glowAmt: 28,
          valueText: S.aluVal ? `${S.aluVal}` : null,
          valueColor: C.alu,
          binaryValue: S.aluVal >= 0 ? S.aluVal : -1,
          compact: mob,
          rwState: rw.alu,
          enablePins: aluPins,
        });

      // ALU direct wires: 16 inputs at bottom, 8 outputs at top
      if (!mob) {
        const aluActive = S.glow.alu;
        const aluTop    = L.alu.y;
        const aluBottom = L.alu.y + L.ch;
        const aluCx     = L.alu.x + L.cw / 2;

        // --- 16 INPUT WIRES AT BOTTOM ---
        // Spread 16 wires evenly across ALU bottom: A bits on left, B bits on right
        const inputSpacing = Math.min(L.cw / 17, 7);
        const totalInputW  = 15 * inputSpacing;
        const inputStartX  = aluCx - totalInputW / 2;

        // A inputs: indices 0-7 (left half of ALU bottom)
        // Wires go UP from Reg A (row3 col1) to ALU bottom left half
        if (S.alpha.a > 0) {
          const aBitPos = eng.getBitCellPositions(L.a.x, L.a.y, L.cw, L.ch, false);
          ctx.save();
          ctx.globalAlpha = S.alpha.alu * S.alpha.a;
          for (let i = 0; i < 8; i++) {
            const bit = (S.aVal >>> (7 - i)) & 1;
            const inputX = inputStartX + i * inputSpacing;
            ctx.strokeStyle = aluActive && bit ? C.regA : rgbaStr(C.regA, 0.15);
            ctx.lineWidth   = aluActive && bit ? 1.2 : 0.5;
            ctx.shadowBlur  = aluActive && bit ? 3 : 0;
            ctx.shadowColor = C.regA;
            ctx.beginPath();
            // Straight diagonal from Reg A bit cell to ALU input pin
            ctx.moveTo(aBitPos[i].x, aBitPos[i].top - 1);
            ctx.lineTo(inputX, aluBottom);
            ctx.stroke();
            // No dots
          }
          ctx.shadowBlur = 0;
          ctx.fillStyle = rgbaStr(C.regA, 0.5);
          ctx.font = 'bold 6px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText('A(8)', inputStartX + 3.5 * inputSpacing, aluBottom + 2);
          ctx.restore();
        }

        // B inputs: indices 8-15 (right half of ALU bottom)
        // Wires go UP from Reg B (row3 col2) to ALU bottom right half
        if (S.alpha.b > 0) {
          const bBitPos = eng.getBitCellPositions(L.b.x, L.b.y, L.cw, L.ch, false);
          ctx.save();
          ctx.globalAlpha = S.alpha.alu * S.alpha.b;
          for (let i = 0; i < 8; i++) {
            const bit = (S.bVal >>> (7 - i)) & 1;
            const inputX = inputStartX + (i + 8) * inputSpacing;
            ctx.strokeStyle = aluActive && bit ? C.regB : rgbaStr(C.regB, 0.15);
            ctx.lineWidth   = aluActive && bit ? 1.2 : 0.5;
            ctx.shadowBlur  = aluActive && bit ? 3 : 0;
            ctx.shadowColor = C.regB;
            ctx.beginPath();
            // Straight diagonal from Reg B bit cell to ALU input pin
            ctx.moveTo(bBitPos[i].x, bBitPos[i].top - 1);
            ctx.lineTo(inputX, aluBottom);
            ctx.stroke();
            // No dots
          }
          ctx.shadowBlur = 0;
          ctx.fillStyle = rgbaStr(C.regB, 0.5);
          ctx.font = 'bold 6px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText('B(8)', inputStartX + 11.5 * inputSpacing, aluBottom + 2);
          ctx.restore();
        }

        // --- 8 OUTPUT WIRES AT TOP → to data bus ---
        if (S.aluVal >= 0) {
          const aluBitPos = eng.getBitCellPositions(L.alu.x, L.alu.y, L.cw, L.ch, false);
          ctx.save();
          ctx.globalAlpha = S.alpha.alu;
          for (let i = 0; i < 8; i++) {
            const bit = (S.aluVal >>> (7 - i)) & 1;
            ctx.strokeStyle = aluActive && bit ? C.alu : rgbaStr(C.alu, 0.15);
            ctx.lineWidth   = aluActive && bit ? 1.2 : 0.5;
            ctx.shadowBlur  = aluActive && bit ? 3 : 0;
            ctx.shadowColor = C.alu;
            ctx.beginPath();
            ctx.moveTo(aluBitPos[i].x, aluBitPos[i].top - 1);
            ctx.lineTo(aluBitPos[i].x, aluTop - 5);
            ctx.stroke();
            // No dots
          }
          ctx.shadowBlur = 0;
          ctx.fillStyle = rgbaStr(C.alu, 0.45);
          ctx.font = 'bold 6px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText('Result(8)→bus', L.alu.cx, aluTop - 7);
          ctx.restore();
        }
      }
    }

    // Output
    if (S.alpha.out > 0) {
      const outNum = parseInt(S.outVal);
      eng.drawComponent(ctx, mob ? 'OUT' : 'OUTPUT', mob ? '' : 'Display',
        L.out.x, L.out.y, L.cw, L.ch, C.out, {
          alpha: S.alpha.out,
          glow: S.glow.out,
          glowColor: C.out,
          glowAmt: 30,
          valueText: `${S.outVal}`,
          valueColor: C.out,
          binaryValue: !isNaN(outNum) && outNum >= 0 ? outNum : undefined,
          bitHighlight: S.bitArrival.out,
          compact: mob,
          rwState: rw.out,
          enablePins: outPins,
        });
    }

    // ── Signal wires from CU to component pins ──
    // Build a flat list of { signal, compKey, side, type } entries,
    // resolve each pin's screen position, and pass to drawSignalWires().
    if (showCUWires && L.cu) {
      // Map every signal to its component + pin side
      const sigPinDefs = [
        { name: 'CO',  key: 'pc',  side: 'bottom-right', type: 'out'      },
        { name: 'CE',  key: 'pc',  side: 'top-right',    type: 'internal' },
        { name: 'MI',  key: 'mar', side: 'bottom-left',  type: 'in'       },
        { name: 'RI',  key: 'ram', side: 'bottom-left',  type: 'in'       },
        { name: 'RO',  key: 'ram', side: 'bottom-right', type: 'out'      },
        { name: 'II',  key: 'ir',  side: 'top-left',     type: 'in'       },
        { name: 'IO',  key: 'ir',  side: 'top-right',    type: 'out'      },
        { name: 'AI',  key: 'a',   side: 'top-left',     type: 'in'       },
        { name: 'AO',  key: 'a',   side: 'top-right',    type: 'out'      },
        { name: 'BI',  key: 'b',   side: 'top-left',     type: 'in'       },
        { name: 'EO',  key: 'alu', side: 'top-right',    type: 'out'      },
        { name: 'SU',  key: 'alu', side: 'top-left',     type: 'internal' },
        { name: 'OI',  key: 'out', side: 'top-left',     type: 'in'       },
        { name: 'FI',  key: 'alu', side: 'bottom-left',  type: 'internal' },
        { name: 'HLT', key: 'pc',  side: 'top-left',     type: 'internal' },
      ];

      // Each pin has a unique corner — no counting needed
      const compPinMap = [];
      for (const d of sigPinDefs) {
        const compAlpha = S.alpha[d.key] || 0;
        if (compAlpha <= 0) continue;
        const compPos = L[d.key];
        if (!compPos) continue;

        const { pinX, pinY } = eng._pinScreenPos(
          compPos.x, compPos.y, L.cw, L.ch,
          d.side, 0, 1
        );

        compPinMap.push({
          name:   d.name,
          key:    d.key,    // component key for grouping (pc, mar, ram, etc.)
          type:   d.type,
          pinX,
          pinY,
          active: sigs.includes(d.name),
        });
      }

      eng.drawSignalWires(ctx,
        L.cu.x, L.cu.y, L.cuW, L.cuH,
        compPinMap,
        { alpha: 1, isMobile: mob, controlBusY: L.controlBusY }
      );
    }

    // Data flow — routed through the appropriate bus mid-point
    if (S.busFlowProgress >= 0 && S.busFlowProgress <= 1 &&
        S.busFlowFrom && S.busFlowTo) {
      const fromPos = L[S.busFlowFrom.key];
      const toPos   = L[S.busFlowTo.key];
      if (fromPos && toPos) {
        eng.drawDataFlow(ctx,
          fromPos.cx, fromPos.cy,
          toPos.cx,   toPos.cy,
          S.busFlowProgress, {
            value: S.busFlowValue,
            color: S.busFlowColor,
            alpha: S.alpha.bus,
            size: Math.min(eng.W / 80, 16),
            numericValue: S._busNumericValue,
          });
      }
    }

    // Keep busActive in sync with bus-specific flags (backward compat)
    S.busActive = S.dataBusActive || S.addressBusActive || (S.busFlowProgress >= 0);

    // ── Control Unit component ──
    if (S.showControlUnit && S.alpha.cu > 0) {
      const cuA = S.alpha.cu;
      eng.drawControlUnit(ctx, L.cu.x, L.cu.y, L.cuW, L.cuH, {
        alpha:    cuA,
        glow:     S.glow.cu,
        opcode:   S.cuOpcode,
        tstate:   S.currentTState,
        compact:  mob,
      });
    }

    // ── T-State counter ──
    if (S.showControlUnit && S.alpha.cu > 0 && !mob) {
      eng.drawTStateCounter(ctx, L.tState.x, L.tState.y, S.currentTState, 4, {
        alpha:   S.alpha.cu,
        compact: false,
      });
    }

    // ── Signal lines from CU to components (legacy center-to-center lines) ──
    // Only draw these when the new pin wires are NOT showing — pin wires replace them.
    if (!showCUWires && S.showControlUnit && S.showSignalLines && S.signalLinesAlpha > 0 && S.alpha.cu > 0) {
      const sla = S.signalLinesAlpha * S.alpha.cu;
      // Map signal names to their target component and type
      const sigToComp = {
        CO:  { key: 'pc',  type: 'out' },
        CE:  { key: 'pc',  type: 'internal' },
        MI:  { key: 'mar', type: 'in' },
        RO:  { key: 'ram', type: 'out' },
        RI:  { key: 'ram', type: 'in' },
        II:  { key: 'ir',  type: 'in' },
        IO:  { key: 'ir',  type: 'out' },
        AI:  { key: 'a',   type: 'in' },
        AO:  { key: 'a',   type: 'out' },
        BI:  { key: 'b',   type: 'in' },
        EO:  { key: 'alu', type: 'out' },
        SU:  { key: 'alu', type: 'internal' },
        OI:  { key: 'out', type: 'in' },
        FI:  { key: 'alu', type: 'internal' },
        HLT: { key: 'pc',  type: 'internal' },
      };
      // Only draw lines for signals whose target component is visible
      for (const sig of SIGNALS) {
        const target = sigToComp[sig.name];
        if (!target) continue;
        const compAlpha = S.alpha[target.key] || 0;
        if (compAlpha <= 0) continue;
        const compPos = L[target.key];
        if (!compPos) continue;

        const isActive = S.activeSignals.includes(sig.name);
        // Mobile: skip signal lines (too cluttered), show only signal list
        if (mob) continue;

        // Draw from CU edge to component center
        eng.drawSignalLine(ctx,
          L.cu.cx, L.cu.cy,
          compPos.cx, compPos.cy,
          sig.name, isActive, sig.type,
          { alpha: sla, compact: mob }
        );
      }
    }

    // ── Signal list panel ──
    if (S.showControlUnit && S.showSignalList && S.signalListAlpha > 0) {
      // Only show signals for currently-relevant instruction
      // Filter to current context signals
      const contextSignals = SIGNALS.filter(s => {
        // Always show CO, MI, RO, II, CE (fetch signals)
        const fetchSigs = ['CO','CE','MI','RO','II'];
        const execSigs  = { LDA:['IO','MI','RO','AI'], ADD:['IO','MI','RO','BI','EO','AI','FI'], OUT:['AO','OI'], HLT:['HLT'] };
        if (fetchSigs.includes(s.name)) return true;
        if (S.cuOpcode && execSigs[S.cuOpcode] && execSigs[S.cuOpcode].includes(s.name)) return true;
        return false;
      });
      eng.drawSignalList(ctx, L.sigList.x, L.sigList.y, L.sigList.w,
        contextSignals, S.activeSignals, {
          alpha:   S.signalListAlpha * S.alpha.cu,
          compact: mob,
        }
      );
    }

    // ── Microcode table ──
    if (S.showControlUnit && S.showMicrocode && S.microcodeAlpha > 0 && !mob) {
      eng.drawMicrocodeTable(ctx, L.microcode.x, L.microcode.y, L.microcode.w, 180,
        S.cuOpcode, S.currentTState, {
          alpha:   S.microcodeAlpha * S.alpha.cu,
          compact: false,
        }
      );
    }

    // Instruction format legend (top of screen) — SAP-1: uses irVal as the full instruction byte
    if (S.showInstructionFormat && S.instrFmtAlpha > 0) {
      // Derive opcode/address nibble names from live irVal
      const nibbleOpc = (S.irVal >>> 4) & 0x0F;
      const nibbleAdr = S.irVal & 0x0F;
      const knownMnemonics = { 1:'LDA', 2:'ADD', 3:'SUB', 4:'STA', 5:'LDI', 6:'JMP', 7:'JC', 8:'JZ', 14:'OUT', 15:'HLT' };
      const oName = knownMnemonics[nibbleOpc] || `OPC=${nibbleOpc}`;
      const aName = (nibbleOpc >= 14) ? '(unused)' : `addr ${nibbleAdr}`;
      eng.drawInstructionFormat(ctx, {
        alpha:       S.instrFmtAlpha,
        mode:        S.instrFmtMode,
        instrByte:   S.irVal || 0,
        opcodeName:  oName,
        operandName: aName,
        operandType: 'address',
      });
    }

    // RAM grid (desktop: right column; mobile: hidden in base layer, shown per-scene)
    if (S.showRAMGrid && S.ramGridAlpha > 0 && L.ramGrid && !mob) {
      const rg = L.ramGrid;
      // Build ramData from RAM_META, but substitute live S.ram values
      const liveData = RAM_META.map(m => ({
        ...m,
        value: S.ram[m.addr],
      }));
      eng.drawRAMGrid(ctx, rg.x, rg.y, rg.w, rg.h, liveData, {
        highlightAddr: S.ramGridHighlightAddr,
        highlightPair: S.ramGridHighlightPair,
        alpha:         S.ramGridAlpha,
        compact:       false,
        showAll:       true,
      });
    }
  }

  // Helper to animate component appearing (pop-in)
  function popIn(key, dur = 500) {
    return new Step(dur, (ctx, p, eng) => {
      S.alpha[key] = Ease.elasticOut(p);
    }, { easing: Ease.linear, label: '' });
  }

  // Helper: compute which bit cells have "arrived" in the destination.
  // Bits travel MSB-first with slight stagger; each bit "lands" when its
  // individual progress reaches 1.0.  Returns an array[8] of booleans.
  function computeBitArrival(numVal, flowProgress) {
    if (numVal < 0 || flowProgress < 0) return null;
    const result = new Array(8).fill(false);
    for (let i = 0; i < 8; i++) {
      const stagger = i * 0.015;
      const bitP = clamp(flowProgress - stagger, 0, 1);
      if (bitP >= 0.98) result[i] = true;  // i=0 is MSB (bit7)
    }
    return result;
  }

  // Helper to start a bus flow animation
  // opts.bus: 'data' (default), 'address', or 'control' — which bus carries this flow
  function flowStep(fromKey, toKey, value, color, dur = 800, caption = '', numericValue = -1, opts = {}) {
    const busType = opts.bus || 'data';
    const numVal = numericValue >= 0 ? numericValue :
      (value && !isNaN(parseInt(value))) ? parseInt(value) : -1;
    return new Step(dur, (ctx, p, eng) => {
      // Set the correct bus active based on type
      S.busFlowBusType = busType;
      if (busType === 'address') {
        S.addressBusActive = true;
        S.addressBusValue  = numVal;
        S.dataBusActive    = false;
      } else if (busType === 'control') {
        S.controlBusActive = true;
        S.dataBusActive    = false;
      } else {
        S.dataBusActive    = true;
        S.dataBusValue     = numVal;
        S.addressBusActive = false;
      }
      S.busActive        = true;  // backward-compat
      S.busFlowProgress  = p;
      S.busFlowFrom      = { key: fromKey };
      S.busFlowTo        = { key: toKey   };
      S.busFlowValue     = value;
      S.busFlowColor     = color || C.dataGlow;
      S._busNumericValue = numVal;
      if (numVal >= 0 && toKey) {
        S.bitArrival[toKey] = computeBitArrival(numVal, p);
      }
      if (caption) eng.drawCaption(ctx, caption, p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1);
    }, { easing: Ease.linear, label: '' });
  }

  // Caption step (clears all bus activity)
  function captStep(text, dur = 2500) {
    return new Step(dur, (ctx, p, eng) => {
      resetBus();
      const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
      eng.drawCaption(ctx, text, a);
    }, { easing: Ease.linear, label: '' });
  }

  // ──────────────────────────────────────────────────────────
  //  SCENE 1 — The Big Question (30s)
  // ──────────────────────────────────────────────────────────
  e.scene_titleCard(
    'How does a CPU actually work?',
    '',
    4000,
    { fadeOut: true, mainFont: `bold 42px Inter, sans-serif`,
      mainColor: C.textPrimary, sceneId: 1, label: 'Scene 1: The Big Question',
      audio: 'scene1a' }
  );

  // Right now, billions of CPUs are executing instructions.
  add(5000, (ctx, p, eng) => {
    const { W, H } = eng;
    const a = p < 0.12 ? p/0.12 : p > 0.82 ? (1-p)/0.18 : 1;

    // Subtle grid
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 1;
    const gSize = 60;
    for (let gx = 0; gx < W; gx += gSize) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = 0; gy < H; gy += gSize) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }
    ctx.restore();

    // Three lines of text, staggered fade-in
    const lines = [
      { text: 'Right now, billions of CPUs are executing instructions.', delay: 0.0, y: H * 0.33 },
      { text: 'Your phone. Your laptop. The server hosting this page.', delay: 0.3, y: H * 0.46 },
      { text: 'All doing the same fundamental thing.', delay: 0.6, y: H * 0.59 },
    ];
    for (const line of lines) {
      const la = clamp((p - line.delay) / 0.2, 0, 1) * a;
      if (la <= 0) continue;
      ctx.save();
      ctx.globalAlpha = la;
      ctx.fillStyle = C.textPrimary;
      ctx.font = `${Math.min(W/38, 18)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(line.text, W/2, line.y);
      ctx.restore();
    }
  }, { easing: Ease.linear, label: '', sceneId: 1 });

  // "By the end of this video..."
  add(5000, (ctx, p, eng) => {
    const { W, H } = eng;
    const a = p < 0.12 ? p/0.12 : p > 0.82 ? (1-p)/0.18 : 1;

    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 1;
    const gSize = 60;
    for (let gx = 0; gx < W; gx += gSize) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = 0; gy < H; gy += gSize) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = C.textSecondary;
    ctx.font = `${Math.min(W/38, 18)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("By the end of this video, you'll understand exactly what happens inside —", W/2, H * 0.40);
    ctx.restore();

    const la2 = clamp((p - 0.35) / 0.2, 0, 1) * a;
    ctx.save();
    ctx.globalAlpha = la2;
    ctx.fillStyle = C.textPrimary;
    ctx.font = `bold ${Math.min(W/26, 26)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#4488ff';
    ctx.fillText('step by step.', W/2, H * 0.54);
    ctx.restore();

    const la3 = clamp((p - 0.6) / 0.2, 0, 1) * a;
    ctx.save();
    ctx.globalAlpha = la3;
    ctx.fillStyle = C.textMuted;
    ctx.font = `${Math.min(W/48, 14)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No prior electronics knowledge needed.', W/2, H * 0.65);
    ctx.restore();
  }, { easing: Ease.linear, label: '', sceneId: 1 });

  e.scene_titleCard(
    "Let's watch one instruction execute,",
    'step by step.',
    5000,
    { fadeOut: true, mainFont: `bold 32px Inter, sans-serif`,
      mainColor: C.textPrimary, sceneId: 1, label: '',
      audio: 'scene1b' }
  );

  // ──────────────────────────────────────────────────────────
  //  SCENE 2 — Meet the Components (~4 min)
  // ──────────────────────────────────────────────────────────
  // Helper: reset control unit state
  function resetCU() {
    S.showControlUnit  = false;
    S.currentTState    = -1;
    S.activeSignals    = [];
    S.cuOpcode         = '';
    S.showSignalLines  = false;
    S.showSignalList   = false;
    S.showMicrocode    = false;
    S.microcodeAlpha   = 0;
    S.signalListAlpha  = 0;
    S.signalLinesAlpha = 0;
    S.alpha.cu         = 0;
    S.glow.cu          = false;
  }

  // Helper: set active signals for a given microcode key
  function setSignals(opcodeKey, tstate) {
    const key = `${opcodeKey}_T${tstate}`;
    S.activeSignals = MICROCODE_SIGNALS[key] || [];
  }

  // Helper: reset all bus state
  function resetBus() {
    S.busActive        = false;
    S.dataBusActive    = false;
    S.dataBusValue     = -1;
    S.addressBusActive = false;
    S.addressBusValue  = -1;
    S.controlBusActive = false;
    S.busFlowProgress  = -1;
    S.busFlowFrom      = null;
    S.busFlowTo        = null;
    S.busFlowValue     = '';
    S.busFlowBusType   = 'data';
    S._busNumericValue = -1;
  }

  // Reset state + install base layer
  add(50, (ctx, p, eng) => {
    Object.keys(S.alpha).forEach(k => S.alpha[k] = 0);
    Object.keys(S.glow ).forEach(k => S.glow [k] = false);
    resetBus();
    S.bitArrival = { pc:null, mar:null, ram:null, ir:null, a:null, b:null, alu:null, out:null };
    S.showInstructionFormat = false; S.instrFmtAlpha = 0;
    S.showRAMGrid = false; S.ramGridAlpha = 0;
    S.ramGridHighlightAddr = -1; S.ramGridHighlightPair = -1;
    resetCU();
    eng.setLayer('base', baseLayer);
  }, { label: 'Scene 2: Meet the Components', sceneId: 2, easing: Ease.linear });

  // ── PC ──
  add(700, (ctx, p, eng) => { S.alpha.pc = Ease.elasticOut(p); }, { easing: Ease.linear });
  add(2200, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'The Program Counter keeps track of WHERE we are in the program.', a);
  }, { easing: Ease.linear, audio: 'scene2_pc' });
  // Analogy
  add(4000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Think of it like a bookmark in a book — it marks the page you\'re currently reading.', a);
  }, { easing: Ease.linear });
  // Why it exists
  add(3500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Without the PC, someone would have to manually tell the CPU where each instruction is.', a);
  }, { easing: Ease.linear });
  add(3000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The PC automatically increments after each instruction fetch, so the CPU always knows what comes next.', a);
  }, { easing: Ease.linear });
  add(5500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Jumps and branches work by loading a NEW value into the PC — overwriting the increment — which makes execution "jump" to any instruction.', a);
  }, { easing: Ease.linear });
  // Brief pause before next
  add(400, () => {}, { easing: Ease.linear });

  // ── RAM ──
  add(700, (ctx, p, eng) => { S.alpha.ram = Ease.elasticOut(p); }, { easing: Ease.linear });
  add(2200, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'RAM holds the program — each address stores one byte.', a);
  }, { easing: Ease.linear, audio: 'scene2_ram' });
  // Analogy
  add(4000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Think of it like a bookshelf with numbered slots. Each slot holds exactly one piece of information.', a);
  }, { easing: Ease.linear });
  // Why
  add(5000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'RAM is volatile: it loses its contents when power is off. It stores the program the CPU is running RIGHT NOW.', a);
  }, { easing: Ease.linear });
  add(4500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Our CPU has 16 addresses — slots 0 through 15. Tiny, but enough to demonstrate every principle.', a);
  }, { easing: Ease.linear });
  add(400, () => {}, { easing: Ease.linear });

  // ── MAR ──
  add(700, (ctx, p, eng) => { S.alpha.mar = Ease.elasticOut(p); }, { easing: Ease.linear });
  add(2200, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'The Memory Address Register tells RAM WHICH address to read.', a);
  }, { easing: Ease.linear, audio: 'scene2_mar' });
  // Analogy
  add(4000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Think of it like your finger pointing at a specific slot on the bookshelf: "I want THIS one."', a);
  }, { easing: Ease.linear });
  // Why
  add(3500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'RAM needs to know WHERE to look before it can return data. The MAR holds that address.', a);
  }, { easing: Ease.linear });
  add(3000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The MAR is essentially a buffer between the bus and RAM\'s address pins — a hardware detail that matters.', a);
  }, { easing: Ease.linear });
  add(4500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'In SAP-1, the MAR is 4 bits wide — it can hold addresses 0-15. That is why we have exactly 16 memory locations. The MAR width defines the address space.', a);
  }, { easing: Ease.linear });
  add(400, () => {}, { easing: Ease.linear });

  // ── IR ──
  add(700, (ctx, p, eng) => { S.alpha.ir = Ease.elasticOut(p); }, { easing: Ease.linear });
  add(2200, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'The Instruction Register holds the instruction being executed.', a);
  }, { easing: Ease.linear, audio: 'scene2_ir' });
  // Analogy
  add(4000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Like reading a recipe step — you read it, hold it in your mind, then follow it.', a);
  }, { easing: Ease.linear });
  // Why
  add(3500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Once the instruction is fetched from RAM, the IR holds it while the Control Unit decodes it.', a);
  }, { easing: Ease.linear });
  add(3000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'In SAP-1, the upper 4 bits of the IR tell the CPU WHAT to do. The lower 4 bits say WHERE.', a);
  }, { easing: Ease.linear });
  add(4500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The IR is wired directly into the Control Unit. The upper nibble goes in — the microcode EEPROM looks it up and fires the right signals. No software involved.', a);
  }, { easing: Ease.linear });
  add(400, () => {}, { easing: Ease.linear });

  // ── Reg A ──
  add(700, (ctx, p, eng) => { S.alpha.a = Ease.elasticOut(p); }, { easing: Ease.linear });
  add(2200, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, "Register A is the CPU's working hand — it holds data being processed.", a);
  }, { easing: Ease.linear, audio: 'scene2_a' });
  // Analogy
  add(4000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, "Like a calculator's display — it shows what you're currently working with.", a);
  }, { easing: Ease.linear });
  // Why
  add(3500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The Accumulator. Every calculation flows through Register A — load into it, add to it, output from it.', a);
  }, { easing: Ease.linear });
  add(4500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'In more complex CPUs like x86, there are many registers — RAX, RBX, RCX, and so on. But SAP-1 has just one. And it turns out one is enough to compute anything.', a);
  }, { easing: Ease.linear });
  add(400, () => {}, { easing: Ease.linear });

  // ── Reg B ──
  add(700, (ctx, p, eng) => { S.alpha.b = Ease.elasticOut(p); }, { easing: Ease.linear });
  add(3000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Register B is the second operand for the ALU. When you ADD, B holds the value being added to A.', a);
  }, { easing: Ease.linear });
  add(3000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Think of A as your left hand and B as your right — the ALU brings them together.', a);
  }, { easing: Ease.linear });
  add(4000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Register B is temporary. After the ADD instruction, its value is no longer needed. It will be overwritten next time ADD fires.', a);
  }, { easing: Ease.linear });
  add(400, () => {}, { easing: Ease.linear });

  // ── ALU ──
  add(700, (ctx, p, eng) => { S.alpha.alu = Ease.elasticOut(p); }, { easing: Ease.linear });
  add(2200, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'The ALU does all the math — addition, subtraction, logic.', a);
  }, { easing: Ease.linear, audio: 'scene2_alu' });
  // Analogy
  add(4000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Like the brain of a calculator — the only part that actually does math.', a);
  }, { easing: Ease.linear });
  // Why
  add(3500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'At the hardware level, the ALU is made of logic gates — transistors wired to add bits together.', a);
  }, { easing: Ease.linear });
  add(3000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'It also sets FLAGS — the Carry Flag if an addition overflows, the Zero Flag if the result is zero.', a);
  }, { easing: Ease.linear });
  add(4500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Flags enable conditional jumps: JC (Jump if Carry), JZ (Jump if Zero). Without flags, there is no branching. No if-statements. No loops. Flags make programs intelligent.', a);
  }, { easing: Ease.linear });
  add(400, () => {}, { easing: Ease.linear });

  // ── Output ──
  add(700, (ctx, p, eng) => { S.alpha.out = Ease.elasticOut(p); }, { easing: Ease.linear });
  add(3000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The Output Register is the display — the only way the CPU communicates its result to the outside world.', a);
  }, { easing: Ease.linear });
  add(3000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'In Ben Eater\'s computer, this drives actual 7-segment displays. Here it shows the decimal value.', a);
  }, { easing: Ease.linear });
  add(4000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The output register is a D-type flip-flop. It latches whatever is on the bus when the OI signal fires, and holds it until overwritten.', a);
  }, { easing: Ease.linear });
  add(400, () => {}, { easing: Ease.linear });

  // ── Bus ──
  add(900, (ctx, p, eng) => { S.alpha.bus = Ease.out(p); }, { easing: Ease.linear });
  add(2500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, "The Bus is a shared highway — data travels between components on it.", a);
  }, { easing: Ease.linear, audio: 'scene2_bus' });
  // Analogy
  add(4000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Like a single-lane road connecting all buildings in a town — only one car can pass at a time.', a);
  }, { easing: Ease.linear });
  // Why
  add(3500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'This is called "bus contention" — if two components drive the bus at once, the signals collide. The Control Unit prevents this.', a);
  }, { easing: Ease.linear });
  add(3000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Our bus is 8 bits wide — 8 wires, each carrying a 0 or 1. Together they carry one byte per cycle.', a);
  }, { easing: Ease.linear });
  add(4500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'In SAP-1, only ONE component can drive the bus at a time. Components with OUT signals put data on the bus. Components with IN signals read from it.', a);
  }, { easing: Ease.linear });
  add(4500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The amber signals are OUTPUTS (they drive the bus). The cyan signals are INPUTS (they read from the bus). Watch for this pattern throughout the video.', a);
  }, { easing: Ease.linear });
  add(400, () => {}, { easing: Ease.linear });

  // ── Control Unit ──
  add(700, (ctx, p, eng) => {
    S.showControlUnit = true;
    S.alpha.cu = Ease.elasticOut(p);
    S.glow.cu  = false;
  }, { easing: Ease.linear });
  add(3000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    S.glow.cu = true;
    S.showSignalLines  = true;
    S.signalLinesAlpha = p < 0.3 ? p/0.3 : 1;
    eng.drawCaption(ctx, "The Control Unit is the brain. It tells every component WHEN to read or write.", a);
  }, { easing: Ease.linear, audio: 'scene2_cu' });
  // Analogy
  add(4000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    S.glow.cu = true;
    eng.drawCaption(ctx, "Like a conductor in an orchestra — it doesn't play any instrument, but it tells everyone WHEN to play.", a);
  }, { easing: Ease.linear });
  // Why
  add(3500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    S.glow.cu = true;
    eng.drawCaption(ctx, 'The Control Unit fires specific signals each clock cycle. These signals are called control signals or microcode.', a);
  }, { easing: Ease.linear });
  add(3500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    S.glow.cu = true;
    eng.drawCaption(ctx, 'Ben Eater burns microcode into an EEPROM chip. It\'s just a lookup table: opcode + T-state → which signals fire.', a);
  }, { easing: Ease.linear });

  add(2200, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    S.glow.cu = false;
    eng.drawCaption(ctx, "These are the building blocks. Now let's see them work together.", a);
  }, { easing: Ease.linear, audio: 'scene2_done' });

  add(5000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Each of these components is built from a handful of chips. The PC from a counter chip, the registers from flip-flops, the ALU from adder chips. Real, buildable hardware.', a);
  }, { easing: Ease.linear });

  // ──────────────────────────────────────────────────────────
  //  SCENE 2.5 — The Three Buses (~40s)
  // ──────────────────────────────────────────────────────────
  add(200, () => {
    resetBus();
    S.glow = { pc:false, mar:false, ram:false, ir:false, a:false, b:false, alu:false, out:false, cu:false };
    S.showSignalLines  = true;
    S.signalLinesAlpha = 1;
    S.showControlUnit  = true;
    S.alpha.cu         = 1;
    S.showSignalList   = false;
    S.signalListAlpha  = 0;
  }, { label: 'Scene 2.5: The Three Buses', sceneId: 2.5, easing: Ease.linear });

  // Intro: the single-bus problem
  add(5500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'You have just met all the components. They talk to each other over BUSES — shared electrical highways. But there are THREE different buses, each with a different job.', a);
  }, { easing: Ease.linear });

  // Step 1: reveal ADDRESS BUS highlight (glow PC and MAR, address bus active)
  add(5000, (ctx, p, eng) => {
    const revealP = p < 0.25 ? Ease.out(p / 0.25) : 1;
    S.addressBusActive = revealP > 0.1;
    S.addressBusValue  = -1;
    S.glow.pc  = revealP > 0.3;
    S.glow.mar = revealP > 0.3;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The ADDRESS BUS (green, 4 wires) carries WHERE to look in memory. Only the PC and MAR connect to it. It travels in one direction: towards memory.', a);
  }, { easing: Ease.linear });

  // Step 2: reveal DATA BUS (glow RAM/IR/A/B/ALU/Out)
  add(5500, (ctx, p, eng) => {
    const revealP = p < 0.25 ? Ease.out(p / 0.25) : 1;
    S.addressBusActive = false;
    S.dataBusActive    = revealP > 0.1;
    S.dataBusValue     = -1;
    S.glow.pc  = false; S.glow.mar = false;
    S.glow.ram = revealP > 0.3;
    S.glow.ir  = revealP > 0.3;
    S.glow.a   = revealP > 0.3;
    S.glow.b   = revealP > 0.3;
    S.glow.alu = revealP > 0.3;
    S.glow.out = revealP > 0.3;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The DATA BUS (amber, 8 wires) carries the actual information — instructions, numbers, results. RAM, registers, IR, ALU, and Output all connect here.', a);
  }, { easing: Ease.linear });

  // Step 3: reveal CONTROL BUS (glow CU, control bus active)
  add(5500, (ctx, p, eng) => {
    const revealP = p < 0.25 ? Ease.out(p / 0.25) : 1;
    S.dataBusActive    = false;
    S.controlBusActive = revealP > 0.1;
    S.glow.ram = false; S.glow.ir = false;
    S.glow.a   = false; S.glow.b  = false;
    S.glow.alu = false; S.glow.out = false;
    S.glow.cu  = revealP > 0.3;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The CONTROL BUS (red) carries WHEN and HOW to act — the signal lines from the Control Unit. CO, MI, RO, II, CE — all control signals travel here.', a);
  }, { easing: Ease.linear });

  // Step 4: all three buses visible together — traffic rule
  add(6000, (ctx, p, eng) => {
    S.controlBusActive = false;
    S.glow.cu = false;
    S.addressBusActive = true;
    S.dataBusActive    = true;
    S.controlBusActive = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The key rule: only ONE component can DRIVE a bus at a time. Two components driving simultaneously causes bus contention — like two people shouting different things into the same microphone.', a);
  }, { easing: Ease.linear });

  // Step 5: transition caption
  add(4500, (ctx, p, eng) => {
    S.addressBusActive = false;
    S.dataBusActive    = false;
    S.controlBusActive = false;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Now watch the buses in action. Every time data moves, you will see which bus it takes — and the CU is always the one who gives permission.', a);
  }, { easing: Ease.linear });

  // ──────────────────────────────────────────────────────────
  //  SCENE 3 — The Program (~3 min)
  // ──────────────────────────────────────────────────────────
  add(200, () => {
    S.showRAMGrid = false; S.ramGridAlpha = 0;
    S.ramGridHighlightAddr = -1; S.ramGridHighlightPair = -1;
    resetBus();
    resetCU();
  }, { label: 'Scene 3: The Program', sceneId: 3, easing: Ease.linear });

  // Helper: draw full-screen RAM grid scene (before the RAM moves to sidebar)
  // Used during scene 3 as a dedicated overlay. On mobile: compact list.
  // SAP-1 format: instruction type rows show 4+4 bit split (purple opcode | green address)
  function drawScene3RAM(ctx, revealProgress, captionText, captionAlpha, eng) {
    const { W, H } = eng;
    const isMob = W < 600;

    if (isMob) {
      // ── MOBILE: compact list of non-empty entries ──
      const colW = Math.min(W * 0.94, 400);
      const x0 = W / 2 - colW / 2;
      const y0 = H * 0.12;
      const entries = RAM_META.filter(r => r.type !== 'empty');
      const cellH = Math.min(26, (H * 0.65) / (entries.length + 1));

      ctx.save();
      ctx.fillStyle = C.textPrimary;
      ctx.font = `bold ${Math.min(W/22, 18)}px Inter, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('Our Program: Add 28 + 14', W/2, y0 - 26);
      ctx.restore();

      const TYPE_COLOR = { instruction:'#bb66ff', opcode:'#bb66ff', operand:'#00cc88', data:'#ffcc00', empty:'#1a2030' };
      const typeLabels  = { instruction:'INSTRUCTION', opcode:'OPCODE', operand:'OPERAND', data:'DATA' };

      for (let i = 0; i < entries.length; i++) {
        const en = entries[i];
        const rowFrac = i / entries.length;
        const ca = clamp((revealProgress - rowFrac) * entries.length * 1.1, 0, 1);
        if (ca <= 0) continue;
        const ey = y0 + cellH * (i + 1.2);
        const tc = TYPE_COLOR[en.type] || '#888';

        ctx.save();
        ctx.globalAlpha = ca;
        ctx.fillStyle = rgbaStr(tc, 0.12);
        ctx.strokeStyle = rgbaStr(tc, 0.4);
        ctx.lineWidth = 1;
        eng._roundRect(ctx, x0, ey, colW, cellH - 2, 3);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = 'rgba(150,180,220,0.6)';
        ctx.font = `bold 8px JetBrains Mono, monospace`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(String(en.addr).padStart(2,' '), x0+4, ey+cellH/2);

        // SAP-1: show 4+4 bit split for instruction rows on mobile
        const bits = en.value.toString(2).padStart(8,'0');
        if (en.type === 'instruction') {
          // opcode nibble in purple, address nibble in green
          ctx.font = `7px JetBrains Mono, monospace`;
          ctx.fillStyle = rgbaStr(C.ir, 0.75);
          ctx.fillText(bits.slice(0,4), x0+22, ey+cellH/2);
          ctx.fillStyle = rgbaStr(C.textMuted, 0.5);
          ctx.fillText('|', x0+22+26, ey+cellH/2);
          ctx.fillStyle = rgbaStr(C.mar, 0.75);
          ctx.fillText(bits.slice(4,8), x0+22+32, ey+cellH/2);
        } else {
          ctx.fillStyle = rgbaStr(tc,0.7);
          ctx.font = `7px JetBrains Mono, monospace`;
          ctx.fillText(bits, x0+22, ey+cellH/2);
        }

        ctx.fillStyle = rgbaStr(tc,0.85);
        ctx.font = `bold 7px Inter, sans-serif`;
        ctx.fillText(String(en.value).padStart(3,' '), x0+22+56, ey+cellH/2);

        const badge = en.mnemonic || typeLabels[en.type] || en.type.toUpperCase();
        ctx.fillStyle = rgbaStr(tc,0.2);
        ctx.strokeStyle = rgbaStr(tc,0.4); ctx.lineWidth=0.5;
        eng._roundRect(ctx, x0+22+72, ey+2, 36, cellH-4, 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = rgbaStr(tc,0.9);
        ctx.font=`bold 7px Inter, sans-serif`;
        ctx.textAlign='center';
        ctx.fillText(badge, x0+22+72+18, ey+cellH/2);

        if (en.label) {
          ctx.fillStyle = rgbaStr(tc,0.5);
          ctx.font=`7px Inter, sans-serif`;
          ctx.textAlign='left';
          ctx.fillText(en.label, x0+22+72+40, ey+cellH/2);
        }
        ctx.restore();
      }
    } else {
      // ── DESKTOP: full 16-row RAM grid, centered, with SAP-1 4+4 bit split ──
      const gridW = Math.min(W * 0.72, 500);
      const gridH = Math.min(H * 0.76, 480);
      const gridX = W / 2 - gridW / 2;
      const gridY = H * 0.16;

      // Title above grid
      ctx.save();
      const titleAlpha = clamp(revealProgress * 4, 0, 1);
      ctx.globalAlpha = titleAlpha;
      ctx.fillStyle = C.textPrimary;
      ctx.font = `bold ${Math.min(W/32, 20)}px Inter, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('RAM — Each instruction = OPCODE (4 bits) + OPERAND (4 bits) = 1 byte', W/2, gridY - 8);
      ctx.restore();

      // Build partial reveal
      const liveData = RAM_META.map((m, i) => {
        const isNonEmpty = m.type !== 'empty';
        let rowAlpha;
        if (isNonEmpty) {
          const nonEmptyIdx = RAM_META.filter((r,j) => r.type !== 'empty' && j <= i).length - 1;
          const nonEmptyCount = RAM_META.filter(r => r.type !== 'empty').length;
          rowAlpha = clamp((revealProgress - nonEmptyIdx / nonEmptyCount * 0.8) * nonEmptyCount * 1.1, 0, 1);
        } else {
          rowAlpha = clamp((revealProgress - 0.5) * 2, 0, 1);
        }
        return { ...m, value: S.ram[m.addr], _revealAlpha: rowAlpha };
      });

      ctx.save();
      ctx.globalAlpha = clamp(revealProgress * 3, 0, 0.88);
      ctx.fillStyle = 'rgba(6,9,15,0.88)';
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      eng._roundRect(ctx, gridX, gridY, gridW, gridH + 10, 6);
      ctx.fill(); ctx.stroke();
      ctx.restore();

      const rowH2 = (gridH - 22) / 16;
      const TYPE_COLOR = { instruction:'#bb66ff', opcode:'#bb66ff', operand:'#00cc88', data:'#ffcc00', empty:'#1a2030' };
      const addrW2 = 32, decW2 = 28, typeW2 = 72;
      const bitSz2 = Math.min(11, (gridW - addrW2 - decW2 - typeW2 - 20) / 9);
      const bitsW2 = 8 * bitSz2 + 7 * 1 + 4;
      const labelX2 = gridX + addrW2 + bitsW2 + decW2 + 12;

      // Header — show SAP-1 split annotation
      ctx.save();
      ctx.globalAlpha = clamp(revealProgress * 4, 0, 0.7);
      ctx.fillStyle = 'rgba(120,160,200,0.6)';
      ctx.font = `bold 8px JetBrains Mono, monospace`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const hy2 = gridY + 11;
      ctx.fillText('ADR', gridX+3, hy2);
      // Two-part header for SAP-1 split
      const bx0H = gridX + addrW2 + 3;
      const opcHalfW = 4 * bitSz2 + 3 * 1;
      ctx.fillStyle = rgbaStr(C.ir, 0.5);
      ctx.fillText('7 6 5 4', bx0H, hy2);
      ctx.fillStyle = rgbaStr(C.mar, 0.5);
      ctx.fillText('3 2 1 0', bx0H + opcHalfW + 4, hy2);
      ctx.fillStyle = 'rgba(120,160,200,0.6)';
      ctx.fillText('DEC', gridX+addrW2+bitsW2+3, hy2);
      ctx.fillStyle = rgbaStr(C.ir, 0.45);
      ctx.fillText('OPC', labelX2, hy2);
      ctx.fillStyle = rgbaStr(C.mar, 0.45);
      ctx.fillText('│ADR', labelX2 + 22, hy2);
      ctx.strokeStyle = 'rgba(120,160,200,0.15)'; ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(gridX+2, gridY+19); ctx.lineTo(gridX+gridW-2, gridY+19);
      ctx.stroke();
      ctx.restore();

      for (let ri = 0; ri < 16; ri++) {
        const row = liveData[ri];
        const ra  = row._revealAlpha;
        if (ra <= 0) continue;
        const tc   = TYPE_COLOR[row.type] || '#888';
        const rowY2 = gridY + 20 + ri * rowH2;
        const ry2   = rowY2 + rowH2 / 2;
        const isSAP1Instr = row.type === 'instruction';
        const isNoOperand = isSAP1Instr && (row.mnemonic === 'OUT' || row.mnemonic === 'HLT');

        ctx.save();
        ctx.globalAlpha = ra;

        ctx.fillStyle = rgbaStr(tc, row.type==='empty' ? 0.03 : 0.1);
        ctx.fillRect(gridX+1, rowY2+1, gridW-2, rowH2-2);

        ctx.fillStyle = row.type==='empty' ? 'rgba(60,80,110,0.4)' : 'rgba(160,190,230,0.7)';
        ctx.font = `bold 9px JetBrains Mono, monospace`;
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(String(row.addr).padStart(2,' '), gridX+addrW2-2, ry2);

        // Bit cells with SAP-1 color split
        const bits2 = row.value.toString(2).padStart(8,'0');
        const bitGap2=1;
        let bx2 = gridX + addrW2 + 3;
        const bby2 = rowY2 + (rowH2 - bitSz2) / 2;
        for (let bi=0; bi<8; bi++) {
          const bit=bits2[bi]; const isOne=bit==='1';
          // SAP-1: bits 0-3 = opcode (purple), bits 4-7 = address (green)
          let bitColor2 = tc;
          if (isSAP1Instr) {
            bitColor2 = bi < 4 ? C.ir : (isNoOperand ? rgbaStr(C.mar, 0.45) : C.mar);
          }
          ctx.fillStyle = isOne ? rgbaStr(bitColor2, row.type==='empty'?0.15:0.82) : rgbaStr(bitColor2,row.type==='empty'?0.04:0.1);
          if(isOne && row.type!=='empty'){ctx.shadowBlur=4; ctx.shadowColor=bitColor2;}else{ctx.shadowBlur=0;}
          ctx.fillRect(bx2, bby2, bitSz2, bitSz2);
          ctx.shadowBlur=0;
          ctx.strokeStyle=rgbaStr(bitColor2,isOne?0.45:0.1); ctx.lineWidth=0.5;
          ctx.strokeRect(bx2,bby2,bitSz2,bitSz2);
          ctx.fillStyle = isOne ? (row.type==='empty'?rgbaStr(bitColor2,0.6):'#000') : rgbaStr(bitColor2,row.type==='empty'?0.12:0.3);
          ctx.font=`bold ${Math.max(5,bitSz2*0.68)}px JetBrains Mono, monospace`;
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(bit, bx2+bitSz2/2, bby2+bitSz2/2);

          // SAP-1 divider between bit 3 and bit 4 (after bi=3)
          if (isSAP1Instr && bi === 3) {
            const divX2 = bx2 + bitSz2 + bitGap2 / 2;
            ctx.strokeStyle = rgbaStr(C.textMuted, 0.5);
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.moveTo(divX2, bby2 - 1); ctx.lineTo(divX2, bby2 + bitSz2 + 1);
            ctx.stroke();
          }
          bx2 += bitSz2+bitGap2;
        }

        // Dec
        ctx.fillStyle = row.type==='empty' ? 'rgba(50,70,100,0.3)' : rgbaStr(tc,0.75);
        ctx.font=`bold 9px JetBrains Mono, monospace`;
        ctx.textAlign='right'; ctx.textBaseline='middle';
        ctx.fillText(String(row.value).padStart(3,' '), gridX+addrW2+bitsW2+decW2+1, ry2);

        // Type badge — for SAP-1 instruction, show opcode + address nibble info
        if (row.type !== 'empty') {
          if (isSAP1Instr) {
            // Two micro-badges: OPC mnemonic | ADR nibble
            const opcBadgeW = 28;
            const adrBadgeW = 24;
            const badgeH2 = rowH2 - 6;
            const badgeY2 = rowY2 + 3;

            ctx.fillStyle = rgbaStr(C.ir, 0.2);
            ctx.strokeStyle = rgbaStr(C.ir, 0.45); ctx.lineWidth=0.75;
            eng._roundRect(ctx, labelX2, badgeY2, opcBadgeW, badgeH2, 2);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = rgbaStr(C.ir, 0.9);
            ctx.font=`bold 7.5px Inter, sans-serif`;
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(row.mnemonic || 'OP', labelX2+opcBadgeW/2, rowY2+rowH2/2);

            const adrX = labelX2 + opcBadgeW + 3;
            const adrNibble = row.value & 0x0F;
            const adrLabel = (row.mnemonic === 'OUT' || row.mnemonic === 'HLT')
              ? '—' : String(adrNibble);
            ctx.fillStyle = rgbaStr(C.mar, isNoOperand ? 0.12 : 0.2);
            ctx.strokeStyle = rgbaStr(C.mar, isNoOperand ? 0.25 : 0.45); ctx.lineWidth=0.75;
            eng._roundRect(ctx, adrX, badgeY2, adrBadgeW, badgeH2, 2);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = rgbaStr(C.mar, isNoOperand ? 0.4 : 0.9);
            ctx.font=`bold 7.5px JetBrains Mono, monospace`;
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(adrLabel, adrX+adrBadgeW/2, rowY2+rowH2/2);

            if (row.label) {
              ctx.fillStyle = rgbaStr(C.ir, 0.45);
              ctx.font=`6.5px Inter, sans-serif`;
              ctx.textAlign='left'; ctx.textBaseline='middle';
              ctx.fillText(row.label, adrX+adrBadgeW+4, ry2);
            }
          } else {
            // Data / legacy types
            const badgeW2 = typeW2 - 2;
            const badgeH2 = rowH2 - 6;
            ctx.fillStyle = rgbaStr(tc,0.18);
            ctx.strokeStyle = rgbaStr(tc,0.4); ctx.lineWidth=0.75;
            eng._roundRect(ctx, labelX2, rowY2+3, badgeW2, badgeH2, 3);
            ctx.fill(); ctx.stroke();
            const badge2 = row.mnemonic || (row.type==='data'?'DATA':row.type.toUpperCase());
            ctx.fillStyle = rgbaStr(tc,0.9);
            ctx.font=`bold 8px Inter, sans-serif`;
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillText(badge2, labelX2+badgeW2/2, rowY2+rowH2/2);
            if (row.label) {
              ctx.fillStyle = rgbaStr(tc, 0.5);
              ctx.font=`7px Inter, sans-serif`;
              ctx.textAlign='left'; ctx.textBaseline='middle';
              ctx.fillText(row.label, labelX2+badgeW2+5, ry2);
            }
          }
        } else {
          ctx.fillStyle='rgba(35,55,85,0.3)';
          ctx.font=`8px JetBrains Mono, monospace`;
          ctx.textAlign='left'; ctx.textBaseline='middle';
          ctx.fillText('—', labelX2, ry2);
        }
        ctx.restore();
      }
    }

    if (captionText) {
      eng.drawCaption(ctx, captionText, captionAlpha);
    }
  }

  // ── Architecture comparison scene (shown before the RAM grid reveal) ──
  // Tracks which arch step we're on (1-6)
  let archStep = 0;

  // Scene 3a: The "aha" moment — how should we encode LDA 14?
  add(3000, (ctx, p, eng) => {
    const { W, H } = eng;
    const isMob = W < 600;
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    archStep = 0;

    // Central question
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = C.textPrimary;
    ctx.font = `bold ${Math.min(W/18, 42)}px Inter, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowBlur = 20; ctx.shadowColor = C.ir;
    ctx.fillText('How do we store', W/2, H * 0.35);
    ctx.shadowBlur = 0;
    ctx.fillStyle = C.ir;
    ctx.font = `bold ${Math.min(W/14, 54)}px JetBrains Mono, monospace`;
    ctx.shadowBlur = 18; ctx.shadowColor = C.ir;
    ctx.fillText('LDA 14', W/2, H * 0.35 + (isMob ? 38 : 56));
    ctx.shadowBlur = 0;
    ctx.fillStyle = C.textPrimary;
    ctx.font = `bold ${Math.min(W/18, 42)}px Inter, sans-serif`;
    ctx.fillText('in memory?', W/2, H * 0.35 + (isMob ? 76 : 112));
    ctx.restore();

    eng.drawCaption(ctx, 'The instruction format is a design choice. How many bytes?', a);
  }, { easing: Ease.linear, label: 'Scene 3: The Program', sceneId: 3, audio: 'scene3_intro' });

  // Explanation before architectures
  add(4000, (ctx, p, eng) => {
    const { W, H } = eng;
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    archStep = 0;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = C.textPrimary;
    ctx.font = `bold ${Math.min(W/28, 28)}px Inter, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CPU designers have made different choices.', W/2, H * 0.35);
    ctx.fillStyle = C.textSecondary;
    ctx.font = `${Math.min(W/38, 18)}px Inter, sans-serif`;
    const la2 = clamp((p - 0.3) / 0.25, 0, 1) * a;
    ctx.globalAlpha = la2;
    ctx.fillText('More bytes = more power, but more complexity.', W/2, H * 0.47);
    ctx.fillText('Fewer bytes = simpler, but more limited.', W/2, H * 0.56);
    ctx.restore();
    eng.drawCaption(ctx, "Let's look at three architectures — from simple to complex.", a);
  }, { easing: Ease.linear });

  // Scene 3b: Reveal Architecture A (SAP-1)
  add(2800, (ctx, p, eng) => {
    const { W, H } = eng;
    const isMob = W < 600;
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    archStep = 1;
    const archY = isMob ? H * 0.12 : H * 0.08;
    eng.drawArchComparison(ctx, {
      alpha: a,
      progress: clamp(p * 4, 0, 1),
      highlightArch: 0,
      x: W / 2 - Math.min(W - 16, 680) / 2,
      y: archY,
    });
    eng.drawCaption(ctx, "Ben Eater's SAP-1: 1 byte per instruction. Opcode + operand share one byte.", a);
  }, { easing: Ease.linear, audio: 'scene3_data' });

  // Extra explanation of SAP-1 (8-10s)
  add(4000, (ctx, p, eng) => {
    const { W, H } = eng;
    const isMob = W < 600;
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    archStep = 1;
    const archY = isMob ? H * 0.12 : H * 0.08;
    eng.drawArchComparison(ctx, { alpha: a, progress: 1, highlightArch: 1, dimOthers: false,
      x: W / 2 - Math.min(W - 16, 680) / 2, y: archY });
    eng.drawCaption(ctx, 'SAP-1: 16 possible opcodes (4 bits) x 16 addresses (4 bits). Tiny but complete.', a);
  }, { easing: Ease.linear });

  add(4000, (ctx, p, eng) => {
    const { W, H } = eng;
    const isMob = W < 600;
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    archStep = 1;
    const archY = isMob ? H * 0.12 : H * 0.08;
    eng.drawArchComparison(ctx, { alpha: a, progress: 1, highlightArch: 1, dimOthers: false,
      x: W / 2 - Math.min(W - 16, 680) / 2, y: archY });
    eng.drawCaption(ctx, 'One memory read to fetch an instruction. Fast, simple, and teaches everything you need to know.', a);
  }, { easing: Ease.linear });

  // Scene 3c: Reveal Architecture B (Extended)
  add(2800, (ctx, p, eng) => {
    const { W, H } = eng;
    const isMob = W < 600;
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    archStep = 2;
    const archY = isMob ? H * 0.12 : H * 0.08;
    eng.drawArchComparison(ctx, {
      alpha: a,
      progress: clamp(0.3 + p * 3, 0, 1),
      highlightArch: 0,
      x: W / 2 - Math.min(W - 16, 680) / 2,
      y: archY,
    });
    eng.drawCaption(ctx, 'Extended: 2 bytes — separate opcode byte and address byte. More room.', a);
  }, { easing: Ease.linear });

  add(4000, (ctx, p, eng) => {
    const { W, H } = eng;
    const isMob = W < 600;
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    archStep = 2;
    const archY = isMob ? H * 0.12 : H * 0.08;
    eng.drawArchComparison(ctx, { alpha: a, progress: 1, highlightArch: 2, dimOthers: false,
      x: W / 2 - Math.min(W - 16, 680) / 2, y: archY });
    eng.drawCaption(ctx, 'Extended: 256 opcodes and 256 addresses. Two memory reads per instruction — slightly slower.', a);
  }, { easing: Ease.linear });

  // Scene 3d: Reveal Architecture C (x86)
  add(2800, (ctx, p, eng) => {
    const { W, H } = eng;
    const isMob = W < 600;
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    archStep = 3;
    const archY = isMob ? H * 0.12 : H * 0.08;
    eng.drawArchComparison(ctx, {
      alpha: a,
      progress: clamp(0.6 + p * 2, 0, 1),
      highlightArch: 0,
      x: W / 2 - Math.min(W - 16, 680) / 2,
      y: archY,
    });
    eng.drawCaption(ctx, "Your PC's CPU (x86): up to 15 bytes per instruction. Billions of addresses.", a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    const { W, H } = eng;
    const isMob = W < 600;
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    archStep = 3;
    const archY = isMob ? H * 0.12 : H * 0.08;
    eng.drawArchComparison(ctx, { alpha: a, progress: 1, highlightArch: 3, dimOthers: false,
      x: W / 2 - Math.min(W - 16, 680) / 2, y: archY });
    const caps = [
      { t: 0.0, text: 'x86 has thousands of opcodes, optional prefixes, and complex addressing modes.' },
      { t: 0.5, text: 'But the PRINCIPLE is identical: fetch bytes, decode them, execute signals. Same as SAP-1.' },
    ];
    let capText = caps[0].text;
    for (const c of caps) { if (p >= c.t) capText = c.text; }
    eng.drawCaption(ctx, capText, a);
  }, { easing: Ease.linear });

  // Scene 3e: Highlight SAP-1, dim others — "We'll use this one"
  add(3000, (ctx, p, eng) => {
    const { W, H } = eng;
    const isMob = W < 600;
    const a = p < 0.12 ? p/0.12 : 1;
    archStep = 4;
    const archY = isMob ? H * 0.12 : H * 0.08;
    eng.drawArchComparison(ctx, {
      alpha: a,
      progress: 1,
      highlightArch: 1,
      dimOthers: true,
      x: W / 2 - Math.min(W - 16, 680) / 2,
      y: archY,
    });

    // Explain the 4+4 bit split below
    const splitY = archY + (isMob ? 70 : 98) + (isMob ? 8 : 12);
    const splitA = clamp((p - 0.3) / 0.4, 0, 1) * a;
    if (splitA > 0) {
      ctx.save();
      ctx.globalAlpha = splitA;
      const boxW = Math.min(W - 32, 360);
      const boxH = isMob ? 38 : 52;
      const boxX = W / 2 - boxW / 2;
      ctx.fillStyle = 'rgba(187,102,255,0.1)';
      ctx.strokeStyle = 'rgba(187,102,255,0.45)';
      ctx.lineWidth = 1;
      eng._roundRect(ctx, boxX, splitY, boxW, boxH, 6);
      ctx.fill(); ctx.stroke();

      const midSplitY = splitY + boxH / 2;
      const halfW = boxW / 2 - 8;
      ctx.fillStyle = rgbaStr(C.ir, 0.85);
      ctx.font = `bold ${isMob ? 9 : 11}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowBlur = 6; ctx.shadowColor = C.ir;
      ctx.fillText('0001 = LDA', boxX + halfW / 2 + 4, midSplitY - (isMob ? 4 : 6));
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgbaStr(C.ir, 0.5);
      ctx.font = `${isMob ? 7 : 9}px Inter, sans-serif`;
      ctx.fillText('OPCODE (bits 7-4)', boxX + halfW / 2 + 4, midSplitY + (isMob ? 6 : 9));

      ctx.strokeStyle = rgbaStr(C.textMuted, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(boxX + boxW/2, splitY + 4);
      ctx.lineTo(boxX + boxW/2, splitY + boxH - 4);
      ctx.stroke();

      ctx.fillStyle = rgbaStr(C.mar, 0.85);
      ctx.font = `bold ${isMob ? 9 : 11}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowBlur = 6; ctx.shadowColor = C.mar;
      ctx.fillText('1110 = 14', boxX + boxW/2 + halfW/2 + 4, midSplitY - (isMob ? 4 : 6));
      ctx.shadowBlur = 0;
      ctx.fillStyle = rgbaStr(C.mar, 0.5);
      ctx.font = `${isMob ? 7 : 9}px Inter, sans-serif`;
      ctx.fillText('ADDRESS (bits 3-0)', boxX + boxW/2 + halfW/2 + 4, midSplitY + (isMob ? 6 : 9));
      ctx.restore();
    }

    eng.drawCaption(ctx, "We'll use SAP-1: one byte per instruction. Simple and teaches every concept.", a);
  }, { easing: Ease.linear });

  // Extra: emphasize the principles carry over
  add(6500, (ctx, p, eng) => {
    const { W, H } = eng;
    const isMob = W < 600;
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    archStep = 4;
    const archY = isMob ? H * 0.12 : H * 0.08;
    eng.drawArchComparison(ctx, { alpha: a * 0.6, progress: 1, highlightArch: 1, dimOthers: true,
      x: W / 2 - Math.min(W - 16, 680) / 2, y: archY });
    eng.drawCaption(ctx, 'We use SAP-1 because it is the simplest. But the PRINCIPLES are identical in every CPU ever built.', a);
  }, { easing: Ease.linear });

  // Scene 3: "Before the CPU has done anything..."
  add(4500, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Our program: LDA 28, ADD 14, output the result, then stop.', a);
  }, { easing: Ease.linear });

  add(7000, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'This is how ALL programs start — as a sequence of instructions in memory. From a game to an operating system. Just more instructions.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Four instructions. That is all it takes to add two numbers on a real CPU.', a);
  }, { easing: Ease.linear });

  // Scene 3 step: RAM grid reveals — show SAP-1 format with 4+4 split
  const scene3Captions = [
    { frac: 0.0,  text: 'RAM stores our program. Each address holds one byte.' },
    { frac: 0.25, text: 'PURPLE bits (7-4) = OPCODE: what operation to do.' },
    { frac: 0.50, text: 'GREEN bits (3-0) = ADDRESS: which memory location to use.' },
    { frac: 0.70, text: 'YELLOW = DATA values stored in memory.' },
    { frac: 0.85, text: 'SAP-1: one byte per instruction — opcode and address packed together.' },
  ];

  add(7000, (ctx, p, eng) => {
    let capText = scene3Captions[0].text;
    for (const c of scene3Captions) {
      if (p >= c.frac) capText = c.text;
    }
    const ca = p < 0.06 ? p/0.06 : p > 0.9 ? (1-p)/0.1 : 1;
    drawScene3RAM(ctx, Ease.outCubic(p), capText, ca, eng);
  }, { easing: Ease.linear, audio: 'scene3_data' });

  // Explain LDA instruction byte
  add(6500, (ctx, p, eng) => {
    drawScene3RAM(ctx, 1, null, 0, eng);
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    const caps = [
      { t: 0.0,  text: 'Address 0: 0x1E = 00011110. Upper nibble 0001 = LDA. Lower nibble 1110 = 14.' },
      { t: 0.5,  text: 'The CPU will load the value at address 14 into Register A. That value is 28.' },
    ];
    let capText = caps[0].text;
    for (const c of caps) { if (p >= c.t) capText = c.text; }
    eng.drawCaption(ctx, capText, a);
  }, { easing: Ease.linear });

  // Explain ADD instruction byte
  add(6500, (ctx, p, eng) => {
    drawScene3RAM(ctx, 1, null, 0, eng);
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    const caps = [
      { t: 0.0,  text: 'Address 1: 0x2F = 00101111. Upper nibble 0010 = ADD. Lower nibble 1111 = 15.' },
      { t: 0.5,  text: 'The CPU will add the value at address 15 to Register A. That value is 14.' },
    ];
    let capText = caps[0].text;
    for (const c of caps) { if (p >= c.t) capText = c.text; }
    eng.drawCaption(ctx, capText, a);
  }, { easing: Ease.linear });

  // Explain OUT and HLT
  add(4500, (ctx, p, eng) => {
    drawScene3RAM(ctx, 1, null, 0, eng);
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Address 2: OUT (1110|0000). Address 3: HLT (1111|0000). OUT and HLT have no operand.', a);
  }, { easing: Ease.linear });

  // Key insight: CPU hasn't done anything yet
  add(7000, (ctx, p, eng) => {
    drawScene3RAM(ctx, 1, null, 0, eng);
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    const caps = [
      { t: 0.0,  text: 'Notice — the CPU has not done anything yet. These are just bytes sitting in memory.' },
      { t: 0.5,  text: 'The CPU has to READ them to know what to do. That reading process is called FETCH.' },
    ];
    let capText = caps[0].text;
    for (const c of caps) { if (p >= c.t) capText = c.text; }
    eng.drawCaption(ctx, capText, a);
  }, { easing: Ease.linear });

  // Scene 3: hold the full grid, show SAP-1 instruction format legend
  add(5500, (ctx, p, eng) => {
    const { W, H } = eng;
    drawScene3RAM(ctx, 1, null, 0, eng);

    // SAP-1 instruction format legend
    const fmtAlpha = p < 0.2 ? p/0.2 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawInstructionFormat(ctx, {
      alpha:       fmtAlpha,
      mode:        'decode',
      instrByte:   0x1E,        // LDA 14 → 0001|1110
      opcodeName:  'LDA',
      operandName: 'addr 14',
      operandType: 'address',
      y:           H * 0.05,
    });

    const ca = p < 0.15 ? p/0.15 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'LDA 14 = 0x1E: OPCODE 0001 in upper nibble, ADDRESS 1110 in lower nibble.', ca);
  }, { easing: Ease.linear });

  // Transition: fade out scene 3 full-screen grid, activate sidebar grid
  add(700, (ctx, p, eng) => {
    const fadeOut = Ease.inOut(p);
    drawScene3RAM(ctx, 1, null, 0, eng);
    // Simultaneously bring in the sidebar grid
    S.showRAMGrid    = true;
    S.ramGridAlpha   = Ease.out(p);
    S.ramGridHighlightAddr = -1;
    S.ramGridHighlightPair = -1;
    // Overlay fade-out on the full-screen version
    ctx.save();
    ctx.fillStyle = `rgba(6,9,15,${fadeOut * 0.95})`;
    ctx.fillRect(0, 0, eng.W, eng.H);
    ctx.restore();
  }, { easing: Ease.linear });

  // ──────────────────────────────────────────────────────────
  //  SCENE 4 — FETCH: Getting the Instruction (~4 min)
  // ──────────────────────────────────────────────────────────
  add(200, () => {
    resetBus();
    S.glow = { pc:false, mar:false, ram:false, ir:false, a:false, b:false, alu:false, out:false, cu:false };
    S.bitArrival = { pc:null, mar:null, ram:null, ir:null, a:null, b:null, alu:null, out:null };
    S.showInstructionFormat = false; S.instrFmtAlpha = 0;
    S.showRAMGrid = true;
    S.ramGridAlpha = 1;
    S.ramGridHighlightAddr = -1;
    S.ramGridHighlightPair = 0;  // LDA at addr 0 (SAP-1: single byte)
    // CU: ensure visible, clear active state
    S.showControlUnit  = true;
    S.alpha.cu         = 1;
    S.currentTState    = -1;
    S.activeSignals    = [];
    S.cuOpcode         = 'FETCH';
    S.showSignalLines  = true;
    S.signalLinesAlpha = 1;
    S.showSignalList   = true;
    S.signalListAlpha  = 1;
    S.showMicrocode    = false;
    S.microcodeAlpha   = 0;
  }, { label: 'Scene 4: FETCH', sceneId: 4, easing: Ease.linear });

  // "FETCH" title overlay
  add(2500, (ctx, p, eng) => {
    const { W, H } = eng;
    const a = p < 0.15 ? p/0.15 : p > 0.75 ? (1-p)/0.25 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = C.pc;
    ctx.font = `bold ${Math.min(W/20, 54)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 30;
    ctx.shadowColor = C.pc;
    ctx.fillText('FETCH', W/2, H * 0.35);
    ctx.fillStyle = C.textSecondary;
    ctx.font = `${Math.min(W/38, 20)}px Inter, sans-serif`;
    ctx.shadowBlur = 0;
    ctx.fillText('Step 1: Get the next instruction from memory.', W/2, H * 0.35 + 50);
    ctx.restore();
  }, { easing: Ease.linear, audio: 'scene4_intro' });

  // Explain FETCH invariant
  add(5500, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The FETCH cycle ALWAYS starts the same way, no matter what instruction comes next.', a);
  }, { easing: Ease.linear });

  add(5500, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'LDA, ADD, OUT, HLT — every instruction begins with the same two T-states. Every time. Without exception.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Why do we always FETCH first? Because the CPU has no idea what to do until it reads the instruction from memory.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The CPU does not think ahead. It has no plan. It just reads one instruction, does it, reads the next, does it.', a);
  }, { easing: Ease.linear });

  add(7000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'This is called Von Neumann architecture — program and data live together in the same memory. One bus. One instruction at a time.', a);
  }, { easing: Ease.linear });

  // Show SAP-1 instruction format legend and highlight PC
  add(2000, (ctx, p, eng) => {
    S.glow.pc = true;
    S.showInstructionFormat = true;
    S.instrFmtMode = 'fetch';
    S.instrFmtAlpha = p < 0.2 ? p / 0.2 : 1;
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, "SAP-1: each address holds ONE byte. Upper 4 bits = opcode, lower 4 = address.", a);
  }, { easing: Ease.linear, audio: 'scene4_pc' });

  // PC is at address 0
  add(5000, (ctx, p, eng) => {
    S.glow.pc = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The Program Counter holds 0. That means: the next instruction is at address 0.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.pc = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The Control Unit now fires TWO signals simultaneously. This is T-state zero — T0.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.cu = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'T-states are just clock cycles. T0 means the first clock pulse of this instruction. The Control Unit has a 3-bit counter that tracks which T-state we are in.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.cu = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The T-state counter resets to 0 at the start of each new instruction. That is why every instruction always starts with FETCH — T0 and T1 are always fetch.', a);
  }, { easing: Ease.linear });

  // T0: CO signal explained
  add(3500, (ctx, p, eng) => {
    S.glow.pc = true;
    S.glow.cu = true;
    S.currentTState = 0;
    S.activeSignals = ['CO', 'MI'];
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'CO means Counter Out — the PC puts its value (0) onto the bus.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.pc = true;
    S.glow.cu = true;
    S.currentTState = 0;
    S.activeSignals = ['CO', 'MI'];
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'CO is an amber signal — amber means OUTPUT. The PC is driving the bus. No other component can drive the bus at the same time. Only one driver.', a);
  }, { easing: Ease.linear });

  add(3500, (ctx, p, eng) => {
    S.glow.mar = true;
    S.glow.cu = true;
    S.currentTState = 0;
    S.activeSignals = ['CO', 'MI'];
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'MI means MAR In — the Memory Address Register reads that value from the bus.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.mar = true;
    S.glow.cu = true;
    S.currentTState = 0;
    S.activeSignals = ['CO', 'MI'];
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'MI is a cyan signal — cyan means INPUT. The MAR is reading from the bus. CO writes, MI reads. Both happen in the SAME clock cycle — T0.', a);
  }, { easing: Ease.linear });

  add(4000, (ctx, p, eng) => {
    S.glow.mar = true;
    S.glow.cu = true;
    S.currentTState = 0;
    S.activeSignals = ['CO', 'MI'];
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'These signals fire simultaneously. In hardware, it all happens in one clock pulse — a single rising edge. The bus is just wires; reading and writing the same values is instant.', a);
  }, { easing: Ease.linear });

  // T0: PC → MAR — send address 0 (0000) — SLOW — travels on ADDRESS BUS
  add(2000, (ctx, p, eng) => {
    S.busFlowBusType   = 'address';
    S.addressBusActive = true;
    S.addressBusValue  = 0;
    S.dataBusActive    = false;
    S.busActive        = true;
    S.busFlowProgress  = p;
    S.busFlowFrom      = { key: 'pc'  };
    S.busFlowTo        = { key: 'mar' };
    S.busFlowValue     = '0';
    S.busFlowColor     = C.addrBus;
    S._busNumericValue = 0;   // 0000 — address 0
    S.glow.pc  = true;
    S.glow.mar = true;
    S.glow.cu  = true;
    S.bitArrival.mar = computeBitArrival(0, p);
    S.currentTState  = 0;
    S.activeSignals  = ['CO', 'MI'];
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'T0: CO fires. Address 0 (0000) travels on the ADDRESS BUS from PC to MAR.', a);
  }, { easing: Ease.linear });

  // T0 hold — MAR now holds 0
  add(3000, (ctx, p, eng) => {
    S.addressBusActive = false; S.addressBusValue = -1;
    S.busActive = false; S.busFlowProgress = -1;
    S.marVal = 0;
    S.bitArrival.mar = null;
    S.glow.cu = false;
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'T0: CO (amber) = PC OUTPUT on ADDRESS BUS. MI (cyan) = MAR INPUT. MAR now holds address 0.', a);
  }, { easing: Ease.linear, audio: 'scene4_t0' });

  add(3500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The MAR now knows which address to look at. It is pointing at slot 0 of RAM.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    S.glow.mar = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Notice: the MAR is separate from the PC. They can hold different addresses at the same time. This is intentional.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    S.glow.mar = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The PC says WHERE the next instruction is. The MAR tells RAM WHERE to look RIGHT NOW. Two different jobs.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.mar = false;
    S.glow.ram = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Now RAM receives the address from the MAR. RAM looks at slot 0 and prepares whatever byte is stored there.', a);
  }, { easing: Ease.linear });

  // T1 approach — explain each signal before showing it
  add(3500, (ctx, p, eng) => {
    S.glow.ram = true;
    S.glow.cu  = true;
    S.currentTState = 1;
    S.activeSignals = ['RO', 'II', 'CE'];
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'T1: three signals fire at once. RO, II, and CE.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.ram = true;
    S.glow.cu  = true;
    S.currentTState = 1;
    S.activeSignals = ['RO', 'II', 'CE'];
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Three signals, one clock pulse. The CPU designer deliberately combines these because they are safe to do simultaneously — no bus contention between them.', a);
  }, { easing: Ease.linear });

  add(3500, (ctx, p, eng) => {
    S.glow.ram = true;
    S.glow.cu  = true;
    S.currentTState = 1;
    S.activeSignals = ['RO', 'II', 'CE'];
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'RO means RAM Out — RAM reads address 0 from the MAR and puts that byte onto the bus.', a);
  }, { easing: Ease.linear });

  add(3500, (ctx, p, eng) => {
    S.glow.ir  = true;
    S.glow.cu  = true;
    S.currentTState = 1;
    S.activeSignals = ['RO', 'II', 'CE'];
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'II means Instruction Register In — the IR reads and latches the byte from the bus.', a);
  }, { easing: Ease.linear });

  add(3500, (ctx, p, eng) => {
    S.glow.pc  = true;
    S.glow.cu  = true;
    S.currentTState = 1;
    S.activeSignals = ['RO', 'II', 'CE'];
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'CE means Counter Enable — the PC increments by 1, getting ready for the NEXT instruction.', a);
  }, { easing: Ease.linear });

  // T1: RAM[0] → IR — the FULL instruction byte 0x1E (LDA 14 = 0001|1110) — SLOW — DATA BUS
  add(2200, (ctx, p, eng) => {
    S.busFlowBusType   = 'data';
    S.dataBusActive    = true;
    S.dataBusValue     = 0x1E;
    S.addressBusActive = false;
    S.busActive        = true;
    S.busFlowProgress  = p;
    S.busFlowFrom      = { key: 'ram' };
    S.busFlowTo        = { key: 'ir'  };
    S.busFlowValue     = 'LDA14';
    S.busFlowColor     = C.ir;
    S._busNumericValue = 0x1E;  // 00011110 — the complete SAP-1 instruction byte
    S.glow.ram = true;
    S.glow.ir  = true;
    S.glow.cu  = true;
    S.ramHighlight = 0;
    S.ramGridHighlightAddr = 0;
    S.ramGridHighlightPair = 0;
    S.bitArrival.ir = computeBitArrival(0x1E, p);
    S.currentTState  = 1;
    S.activeSignals  = ['RO', 'II', 'CE'];
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'T1: 0x1E = 00011110 travels on the DATA BUS from RAM into the Instruction Register.', a);
  }, { easing: Ease.linear });

  add(3000, (ctx, p, eng) => {
    S.dataBusActive = false; S.dataBusValue = -1;
    S.busActive = false; S.busFlowProgress = -1;
    S.irText = 'LDA 14'; S.irVal = 0x1E;
    S.ramHighlight = -1;
    S.ramGridHighlightAddr = -1;
    S.bitArrival.ir = null;
    S.pcVal = 1;  // PC increments to 1
    S.glow.cu = false;
    S.showInstructionFormat = true;
    S.instrFmtMode = 'decode';
    S.instrFmtAlpha = 1;
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'T1: RO = RAM output (amber) on DATA BUS. II = IR input (cyan). CE = PC+1 (CONTROL). Done!', a);
  }, { easing: Ease.linear, audio: 'scene4_t1' });

  // PC increment animation
  add(2000, (ctx, p, eng) => {
    const { W, H } = eng;
    const L = layout(W, H);
    const a = p < 0.15 ? p/0.15 : p > 0.7 ? (1-p)/0.3 : 1;
    eng.drawCaption(ctx, 'PC increments to 1 — ready for the NEXT instruction after this one completes.', a);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = C.pc;
    ctx.font = `bold ${Math.min(W/40, 18)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.shadowBlur = 10;
    ctx.shadowColor = C.pc;
    ctx.fillText('+1', L.pc.cx, L.pc.y - 10 + (1-Ease.out(p)) * 20);
    ctx.restore();
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.ir = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Look at the IR: it holds 0x1E = 00011110. That is LDA 14 packed into a single byte.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    S.glow.ir = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The upper nibble 0001 will tell the Control Unit which operation to perform. The lower nibble 1110 says which address to use.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.ir = false;
    S.glow.pc = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'And the PC is already at 1 — it moved on during T1 without waiting. Efficiency built into the design.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.pc = false;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Two clock cycles. Two T-states. That is all it takes to get an instruction from memory into the CPU. Every time.', a);
  }, { easing: Ease.linear });

  add(5500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'At this point in the cycle: MAR = 0, IR = 0x1E (LDA 14), PC = 1. Three registers updated in two clock pulses. The FETCH phase is complete.', a);
  }, { easing: Ease.linear });

  // SLOW MOTION REPLAY caption
  add(3500, (ctx, p, eng) => {
    S.glow.pc = false; S.glow.mar = false; S.glow.ram = false; S.glow.ir = false;
    S.showInstructionFormat = false; S.instrFmtAlpha = 0;
    S.currentTState = -1;
    S.activeSignals = [];
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, "That was the FETCH cycle. Let's replay it one more time to lock it in.", a);
  }, { easing: Ease.linear, audio: 'scene4_summary' });

  // REPLAY T0 — ADDRESS BUS
  add(1000, (ctx, p, eng) => {
    S.busFlowBusType   = 'address';
    S.addressBusActive = true;
    S.addressBusValue  = 0;
    S.dataBusActive    = false;
    S.busActive        = true;
    S.busFlowProgress  = p;
    S.busFlowFrom      = { key: 'pc'  };
    S.busFlowTo        = { key: 'mar' };
    S.busFlowValue     = '0';
    S.busFlowColor     = C.addrBus;
    S._busNumericValue = 0;
    S.glow.pc  = true;
    S.glow.mar = true;
    S.glow.cu  = true;
    S.bitArrival.mar = computeBitArrival(0, p);
    S.currentTState  = 0;
    S.activeSignals  = ['CO', 'MI'];
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'T0 replay: CO + MI. PC puts address 0 on ADDRESS BUS. MAR reads it.', a);
  }, { easing: Ease.linear });

  add(1500, (ctx, p, eng) => {
    S.addressBusActive = false; S.addressBusValue = -1;
    S.busActive = false; S.busFlowProgress = -1;
    S.marVal = 0; S.bitArrival.mar = null;
    S.glow.cu = false;
  }, { easing: Ease.linear });

  // REPLAY T1 — DATA BUS
  add(1000, (ctx, p, eng) => {
    S.busFlowBusType   = 'data';
    S.dataBusActive    = true;
    S.dataBusValue     = 0x1E;
    S.addressBusActive = false;
    S.busActive        = true;
    S.busFlowProgress  = p;
    S.busFlowFrom      = { key: 'ram' };
    S.busFlowTo        = { key: 'ir'  };
    S.busFlowValue     = 'LDA14';
    S.busFlowColor     = C.ir;
    S._busNumericValue = 0x1E;
    S.glow.ram = true;
    S.glow.ir  = true;
    S.glow.cu  = true;
    S.ramHighlight = 0;
    S.ramGridHighlightAddr = 0;
    S.bitArrival.ir = computeBitArrival(0x1E, p);
    S.currentTState  = 1;
    S.activeSignals  = ['RO', 'II', 'CE'];
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'T1 replay: RO + II + CE. RAM outputs 0x1E on DATA BUS, IR latches it, PC increments.', a);
  }, { easing: Ease.linear });

  add(2500, (ctx, p, eng) => {
    S.dataBusActive = false; S.dataBusValue = -1;
    S.busActive = false; S.busFlowProgress = -1;
    S.irText = 'LDA 14'; S.irVal = 0x1E;
    S.ramHighlight = -1;
    S.ramGridHighlightAddr = -1;
    S.bitArrival.ir = null;
    S.pcVal = 1;
    S.glow.pc = false; S.glow.mar = false; S.glow.ram = false; S.glow.ir = false;
    S.glow.cu = false;
    S.currentTState = -1;
    S.activeSignals = [];
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'FETCH complete. IR holds 0x1E. Every instruction starts this way: ADDRESS BUS → T0, DATA BUS → T1.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.ir = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Pause for a moment. In TWO clock pulses, the CPU moved address 0 from PC through MAR to RAM, then pulled a byte out of RAM into the IR, and incremented the PC. Remarkable efficiency.', a);
  }, { easing: Ease.linear });

  add(4000, (ctx, p, eng) => {
    S.glow.ir = false;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Now the CPU has the instruction. But it does not know what it means yet. That is DECODE.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Think of FETCH like the postal service delivering a letter. The CPU now holds the envelope — but has not opened it yet.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'DECODE opens the envelope. EXECUTE reads the letter and acts on it. Three phases. Three phases only.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'FETCH and EXECUTE move actual data across the bus. DECODE only identifies WHAT will happen next. No data moves during decode.', a);
  }, { easing: Ease.linear });

  // ──────────────────────────────────────────────────────────
  //  SCENE 5 — DECODE (~2 min)
  // ──────────────────────────────────────────────────────────
  add(200, () => {
    resetBus();
    // SAP-1 decode: IR holds 0x1E (LDA 14 = 0001|1110)
    S.showInstructionFormat = true;
    S.instrFmtMode    = 'decode';
    S.instrFmtAlpha   = 1;
    S.showRAMGrid = true;
    S.ramGridAlpha = 1;
    S.ramGridHighlightAddr = -1;
    S.ramGridHighlightPair = 0;
    S.decodeStep = 0;
    // CU: reads opcode from IR, show microcode lookup
    S.showControlUnit  = true;
    S.alpha.cu         = 1;
    S.cuOpcode         = 'LDA';
    S.currentTState    = -1;
    S.activeSignals    = [];
    S.showSignalLines  = false;
    S.signalLinesAlpha = 0;
    S.showSignalList   = false;
    S.signalListAlpha  = 0;
    S.showMicrocode    = true;
    S.microcodeAlpha   = 1;
  }, { label: 'Scene 5: DECODE', sceneId: 5, easing: Ease.linear });

  // Helper: SAP-1 decode visualization
  // Shows the IR byte (0x1E) split into 4+4 bits with step-by-step reveal
  function drawDecodeViz(ctx, p, eng, decStep) {
    const { W, H } = eng;
    const isMob = W < 600;
    const availW = isMob ? W : W * 0.72;
    const boxW   = Math.min(availW * 0.82, 440);
    const boxH   = isMob ? 70 : 106;
    const bx     = (isMob ? W : availW) / 2 - boxW / 2;
    const by     = H * 0.24;
    const split  = boxW * 0.5;
    const zoom   = 1 + Ease.out(Math.min(p * 2, 1)) * 0.25;
    const alpha  = p < 0.12 ? p / 0.12 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate((isMob ? W : availW)/2, by + boxH/2);
    ctx.scale(zoom, zoom);
    ctx.translate(-(isMob ? W : availW)/2, -(by + boxH/2));

    // DECODE title
    ctx.fillStyle = C.ir;
    ctx.font = `bold ${Math.min(W/32, 24)}px Inter, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.shadowBlur = 14; ctx.shadowColor = C.ir;
    ctx.fillText('DECODE', (isMob ? W : availW)/2, by - 10);
    ctx.shadowBlur = 0;

    // Sub-title: "IR = 0x1E = 00011110"
    ctx.fillStyle = rgbaStr(C.ir, 0.55);
    ctx.font = `${isMob ? 8 : 10}px JetBrains Mono, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('IR = 0x1E = 0001|1110', (isMob ? W : availW)/2, by - 1);

    const leftW  = split - 4;
    const rightW = boxW - split;
    const rightX = bx + split + 2;

    const opcodeActive  = decStep >= 1;
    const operandActive = decStep >= 2;
    const meaningActive = decStep >= 3;

    // ── OPCODE box (upper nibble: 0001 = LDA) ──
    ctx.fillStyle = rgbaStr(C.ir, opcodeActive ? 0.2 : 0.1);
    ctx.strokeStyle = rgbaStr(C.ir, opcodeActive ? 0.85 : 0.3);
    ctx.lineWidth = opcodeActive ? 2 : 1;
    if (opcodeActive) { ctx.shadowBlur = 12; ctx.shadowColor = C.ir; }
    eng._roundRect(ctx, bx, by, leftW, boxH, 8);
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    // Top label: "BITS 7-4 (upper nibble)"
    ctx.fillStyle = rgbaStr(C.ir, opcodeActive ? 0.65 : 0.3);
    ctx.font = `${isMob ? 7 : 9}px Inter, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('BITS 7-4 (upper nibble)', bx + leftW/2, by + 4);

    // 4-bit opcode cells: 0001
    if (!isMob) {
      const opBits4 = '0001';
      const bsz = Math.min(15, (leftW - 16) / 4.8);
      const bgap = 3;
      const btotal = 4*bsz + 3*bgap;
      let bbx = bx + (leftW - btotal) / 2;
      const bby = by + (boxH - bsz) / 2 - 4;
      ctx.font = `bold ${Math.max(6, bsz*0.65)}px JetBrains Mono, monospace`;
      for (let i = 0; i < 4; i++) {
        const bit = opBits4[i]; const isOne = bit === '1';
        ctx.fillStyle = isOne ? rgbaStr(C.ir, opcodeActive ? 0.95 : 0.45) : rgbaStr(C.ir, opcodeActive ? 0.12 : 0.07);
        if (isOne && opcodeActive) { ctx.shadowBlur = 6; ctx.shadowColor = C.ir; } else { ctx.shadowBlur = 0; }
        eng._roundRect(ctx, bbx, bby, bsz, bsz, 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = rgbaStr(C.ir, 0.3); ctx.lineWidth = 0.5;
        eng._roundRect(ctx, bbx, bby, bsz, bsz, 2); ctx.stroke();
        ctx.fillStyle = isOne ? '#000' : rgbaStr(C.ir, opcodeActive ? 0.45 : 0.22);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(bit, bbx + bsz/2, bby + bsz/2);
        bbx += bsz + bgap;
      }
    }

    // Opcode mnemonic (big)
    ctx.fillStyle = opcodeActive ? C.ir : rgbaStr(C.ir, 0.3);
    ctx.font = `bold ${Math.min(W/26, isMob ? 20 : 26)}px JetBrains Mono, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    if (opcodeActive) { ctx.shadowBlur = 8; ctx.shadowColor = C.ir; }
    ctx.fillText(opcodeActive ? 'LDA' : '?', bx + leftW/2, by + boxH - 6);
    ctx.shadowBlur = 0;

    ctx.fillStyle = rgbaStr(C.ir, opcodeActive ? 0.65 : 0.28);
    ctx.font = `${isMob ? 7 : 9}px Inter, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(opcodeActive ? 'OPCODE = 1 = LDA' : 'OPCODE ?', bx + leftW/2, by + boxH - 1);

    // ── ADDRESS box (lower nibble: 1110 = 14) ──
    ctx.fillStyle = rgbaStr(C.mar, operandActive ? 0.2 : 0.1);
    ctx.strokeStyle = rgbaStr(C.mar, operandActive ? 0.85 : 0.3);
    ctx.lineWidth = operandActive ? 2 : 1;
    if (operandActive) { ctx.shadowBlur = 12; ctx.shadowColor = C.mar; }
    eng._roundRect(ctx, rightX, by, rightW, boxH, 8);
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = rgbaStr(C.mar, operandActive ? 0.65 : 0.3);
    ctx.font = `${isMob ? 7 : 9}px Inter, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('BITS 3-0 (lower nibble)', rightX + rightW/2, by + 4);

    if (!isMob) {
      const adBits4 = '1110';
      const bsz = Math.min(15, (rightW - 16) / 4.8);
      const bgap = 3;
      const btotal = 4*bsz + 3*bgap;
      let bbx = rightX + (rightW - btotal) / 2;
      const bby = by + (boxH - bsz) / 2 - 4;
      ctx.font = `bold ${Math.max(6, bsz*0.65)}px JetBrains Mono, monospace`;
      for (let i = 0; i < 4; i++) {
        const bit = adBits4[i]; const isOne = bit === '1';
        ctx.fillStyle = isOne ? rgbaStr(C.mar, operandActive ? 0.95 : 0.45) : rgbaStr(C.mar, operandActive ? 0.12 : 0.07);
        if (isOne && operandActive) { ctx.shadowBlur = 6; ctx.shadowColor = C.mar; } else { ctx.shadowBlur = 0; }
        eng._roundRect(ctx, bbx, bby, bsz, bsz, 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = rgbaStr(C.mar, 0.3); ctx.lineWidth = 0.5;
        eng._roundRect(ctx, bbx, bby, bsz, bsz, 2); ctx.stroke();
        ctx.fillStyle = isOne ? '#000' : rgbaStr(C.mar, operandActive ? 0.45 : 0.22);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(bit, bbx + bsz/2, bby + bsz/2);
        bbx += bsz + bgap;
      }
    }

    ctx.fillStyle = operandActive ? C.mar : rgbaStr(C.mar, 0.3);
    ctx.font = `bold ${Math.min(W/26, isMob ? 20 : 26)}px JetBrains Mono, monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    if (operandActive) { ctx.shadowBlur = 8; ctx.shadowColor = C.mar; }
    ctx.fillText(operandActive ? '14' : '?', rightX + rightW/2, by + boxH - 6);
    ctx.shadowBlur = 0;

    ctx.fillStyle = rgbaStr(C.mar, operandActive ? 0.65 : 0.28);
    ctx.font = `${isMob ? 7 : 9}px Inter, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(operandActive ? 'ADDRESS = 14 = RAM[14]' : 'ADDRESS ?', rightX + rightW/2, by + boxH - 1);

    // Combined meaning box (step 3)
    if (meaningActive) {
      const mby = by + boxH + 14;
      const mbh = isMob ? 28 : 36;
      const mbw = boxW;
      const mAlpha = clamp((p - 0.7) / 0.18, 0, 1);
      ctx.globalAlpha = alpha * mAlpha;
      ctx.fillStyle = 'rgba(68,136,255,0.12)';
      ctx.strokeStyle = 'rgba(68,136,255,0.55)';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 12; ctx.shadowColor = '#4488ff';
      eng._roundRect(ctx, bx, mby, mbw, mbh, 6);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = C.textPrimary;
      ctx.font = `bold ${isMob ? 10 : 13}px Inter, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('LDA 14  =  Load value at RAM[14] into Register A', bx + mbw/2, mby + mbh/2);
      ctx.globalAlpha = alpha;
    }

    ctx.restore();
  }

  // Scene 5 pre-explanation
  add(4000, (ctx, p, eng) => {
    S.decodeStep = 0;
    S.glow.cu = true;
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'DECODE: the instruction is just a number — 0x1E = 00011110. To us it is meaningless.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.decodeStep = 0;
    S.glow.cu = true;
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'This is the key insight: the CPU does not "understand" instructions in any human sense. It just has a lookup table that says: if I see this bit pattern, fire these signals.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.decodeStep = 0;
    S.glow.cu = true;
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'There is no magic. No understanding. Just pattern matching. The Control Unit is a ROM — a Read-Only Memory — with signals burned in at each address.', a);
  }, { easing: Ease.linear });

  add(4000, (ctx, p, eng) => {
    S.decodeStep = 0;
    S.glow.cu = true;
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'But the Control Unit knows. It splits the byte in half and looks each half up in its microcode table.', a);
  }, { easing: Ease.linear });

  // Scene 5 step 1: raw IR byte shown, question marks — "what do these 8 bits mean?"
  add(3500, (ctx, p, eng) => {
    S.decodeStep = 0;
    S.ramGridHighlightAddr = -1;
    S.ramGridHighlightPair = 0;
    S.glow.cu = true;
    drawDecodeViz(ctx, p, eng, 0);
    const a = p < 0.12 ? p/0.12 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'DECODE: IR holds 0x1E = 00011110. The Control Unit reads the upper 4 bits.', a);
  }, { easing: Ease.linear, audio: 'scene5_decode' });

  // Scene 5 step 2: upper nibble lit — opcode = 0001 = LDA
  add(4000, (ctx, p, eng) => {
    S.decodeStep = 1;
    S.ramGridHighlightAddr = 0;
    S.ramGridHighlightPair = 0;
    S.glow.cu = true;
    S.glow.ir = true;
    drawDecodeViz(ctx, p, eng, 1);
    const a = p < 0.12 ? p/0.12 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'Upper nibble 0001 = LDA. The CU looks this up in its microcode table.', a);
  }, { easing: Ease.linear });

  add(4000, (ctx, p, eng) => {
    S.decodeStep = 1;
    S.glow.cu = true;
    S.glow.ir = true;
    drawDecodeViz(ctx, p, eng, 1);
    const a = p < 0.12 ? p/0.12 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, '0001 maps to LDA. The CU now knows it must load a value from memory into Register A.', a);
  }, { easing: Ease.linear });

  // Scene 5 step 3: lower nibble lit — address = 1110 = 14
  add(4000, (ctx, p, eng) => {
    S.decodeStep = 2;
    S.ramGridHighlightAddr = 0;
    S.glow.cu = false;
    S.glow.ir = false;
    drawDecodeViz(ctx, p, eng, 2);
    const a = p < 0.12 ? p/0.12 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'Lower nibble 1110 = 14. That is the RAM address. The table tells CU: fire IO+MI at T2, RO+AI at T3.', a);
  }, { easing: Ease.linear });

  add(4000, (ctx, p, eng) => {
    S.decodeStep = 2;
    drawDecodeViz(ctx, p, eng, 2);
    const a = p < 0.12 ? p/0.12 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, '1110 in binary is 14 in decimal. The CPU will fetch the value stored at RAM address 14.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.decodeStep = 2;
    S.glow.ir = true;
    drawDecodeViz(ctx, p, eng, 2);
    const a = p < 0.12 ? p/0.12 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'So the complete meaning of 0001|1110: OPERATION=LDA, TARGET ADDRESS=14. Two pieces of information, packed into a single byte. Compact and complete.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.decodeStep = 2;
    S.glow.ir = false;
    S.glow.cu = true;
    drawDecodeViz(ctx, p, eng, 2);
    const a = p < 0.12 ? p/0.12 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'The Control Unit now knows exactly what to do: for each T-state of LDA, which signals to fire. It does not reason about it — it just looks it up.', a);
  }, { easing: Ease.linear });

  // Scene 5 step 4: combined meaning lights up + microcode reveal
  add(4500, (ctx, p, eng) => {
    S.decodeStep = 3;
    S.ramGridHighlightAddr = -1;
    S.showMicrocode = true;
    S.microcodeAlpha = p < 0.3 ? p/0.3 : 1;
    drawDecodeViz(ctx, p, eng, 3);
    const a = p < 0.12 ? p/0.12 : p > 0.8 ? (1-p)/0.2 : 1;
    const captions = [
      'The microcode table IS the Control Unit — a lookup: opcode + T-state → signals.',
      'LDA at T2 → IO+MI. At T3 → RO+AI. This is burned into an EEPROM chip.',
    ];
    eng.drawCaption(ctx, captions[p > 0.5 ? 1 : 0], a);
  }, { easing: Ease.linear });

  // Microcode explanation
  add(4000, (ctx, p, eng) => {
    S.decodeStep = 3;
    S.showMicrocode = true;
    S.microcodeAlpha = 1;
    drawDecodeViz(ctx, p, eng, 3);
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Ben Eater burns this table into an EEPROM chip. It is literally just a lookup table in hardware.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.decodeStep = 3;
    S.showMicrocode = true;
    S.microcodeAlpha = 1;
    S.glow.cu = true;
    drawDecodeViz(ctx, p, eng, 3);
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Address into the EEPROM: opcode bits combined with T-state bits. Output: the control signal bits for that cycle. Hardware making decisions at nanosecond speed.', a);
  }, { easing: Ease.linear });

  add(4000, (ctx, p, eng) => {
    S.decodeStep = 3;
    S.showMicrocode = true;
    S.microcodeAlpha = 1;
    drawDecodeViz(ctx, p, eng, 3);
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'DECODE is complete. The CU knows: LDA 14. Now it must carry it out. That is EXECUTE.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    S.decodeStep = 3;
    S.showMicrocode = true;
    S.microcodeAlpha = 1;
    drawDecodeViz(ctx, p, eng, 3);
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Notice what DECODE did NOT do: it did not move any data. It only IDENTIFIED what needs to happen next.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    S.decodeStep = 3;
    S.showMicrocode = true;
    S.microcodeAlpha = 1;
    S.glow.cu = true;
    drawDecodeViz(ctx, p, eng, 3);
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The microcode table in the CU is like a recipe book. Opcode 0001 (LDA) tells it exactly which signals to fire at T2 and T3.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.decodeStep = 3;
    S.glow.cu = false;
    drawDecodeViz(ctx, p, eng, 3);
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'DECODE takes zero extra clock cycles in SAP-1. The upper nibble is wired directly into the control logic. Instant.', a);
  }, { easing: Ease.linear });

  // ──────────────────────────────────────────────────────────
  //  SCENE 6 — EXECUTE: LDA (~3 min)
  // ──────────────────────────────────────────────────────────
  add(200, () => {
    resetBus();
    S.glow = { pc:false, mar:false, ram:false, ir:false, a:false, b:false, alu:false, out:false, cu:false };
    S.glow.ir = true;
    S.bitArrival = { pc:null, mar:null, ram:null, ir:null, a:null, b:null, alu:null, out:null };
    S.showInstructionFormat = true;
    S.instrFmtMode    = 'decode';
    S.instrFmtAlpha   = 1;
    S.showRAMGrid = true;
    S.ramGridAlpha = 1;
    S.ramGridHighlightAddr = -1;
    S.ramGridHighlightPair = 0;
    S.showControlUnit  = true;
    S.alpha.cu         = 1;
    S.cuOpcode         = 'LDA';
    S.currentTState    = 2;
    S.activeSignals    = [];
    S.showSignalLines  = true;
    S.signalLinesAlpha = 1;
    S.showSignalList   = true;
    S.signalListAlpha  = 1;
    S.showMicrocode    = false;
    S.microcodeAlpha   = 0;
  }, { label: 'Scene 6: EXECUTE — LDA', sceneId: 6, easing: Ease.linear });

  // EXECUTE title
  add(2000, (ctx, p, eng) => {
    const { W, H } = eng;
    const a = p < 0.15 ? p/0.15 : p > 0.7 ? (1-p)/0.3 : 1;
    S.instrFmtAlpha = 1 - Ease.out(p);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = C.alu;
    ctx.font = `bold ${Math.min(W/20, 52)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 28;
    ctx.shadowColor = C.alu;
    ctx.fillText('EXECUTE', W/2, H * 0.35);
    ctx.fillStyle = C.textSecondary;
    ctx.font = `${Math.min(W/38, 20)}px Inter, sans-serif`;
    ctx.shadowBlur = 0;
    ctx.fillText('Step 3: Carry out the instruction.', W/2, H * 0.35 + 50);
    ctx.restore();
  }, { easing: Ease.linear, audio: 'scene6_intro' });

  // What LDA will do
  add(5500, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The CU knows: LDA 14. Load the value at address 14 into Register A.', a);
  }, { easing: Ease.linear });

  add(5500, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'LDA needs two T-states to execute: T2 to set up the address, T3 to load the data.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Why two T-states? Because loading from memory requires TWO things: first, tell RAM which address to read; second, actually read the data from that address.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'This is the LDA instruction format: opcode 0001 in the upper nibble, and the address 1110 (= 14) in the lower nibble.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The address 14 (binary 1110) is already inside the instruction byte. The IR holds the FULL instruction — both opcode and address in one byte.', a);
  }, { easing: Ease.linear });

  // T2 pre-explanation
  add(3500, (ctx, p, eng) => {
    S.glow.ir = true;
    S.glow.cu = true;
    S.currentTState = 2;
    S.activeSignals = ['IO', 'MI'];
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'T2: IO fires (amber). IO means IR Out — the lower nibble of IR (1110 = 14) goes onto the bus.', a);
  }, { easing: Ease.linear });

  add(3500, (ctx, p, eng) => {
    S.glow.mar = true;
    S.glow.cu  = true;
    S.currentTState = 2;
    S.activeSignals = ['IO', 'MI'];
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'T2: MI fires (cyan). MI means MAR In — the MAR reads address 14 from the bus.', a);
  }, { easing: Ease.linear });

  // T2: IR lower nibble → MAR — SLOW — ADDRESS BUS (operand address)
  add(1800, (ctx, p, eng) => {
    S.busFlowBusType   = 'address';
    S.addressBusActive = true;
    S.addressBusValue  = 14;
    S.dataBusActive    = false;
    S.busActive        = true;
    S.busFlowProgress  = p;
    S.busFlowFrom      = { key: 'ir'  };
    S.busFlowTo        = { key: 'mar' };
    S.busFlowValue     = '14';
    S.busFlowColor     = C.addrBus;
    S._busNumericValue = 14;
    S.glow.ir  = true;
    S.glow.mar = true;
    S.glow.cu  = true;
    S.bitArrival.mar = computeBitArrival(14, p);
    S.currentTState  = 2;
    S.activeSignals  = ['IO', 'MI'];
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'T2: CU fires IO + MI. Address 14 (1110) travels on the ADDRESS BUS from IR operand to MAR.', a);
  }, { easing: Ease.linear });

  add(3000, (ctx, p, eng) => {
    S.addressBusActive = false; S.addressBusValue = -1;
    S.busActive = false; S.busFlowProgress = -1;
    S.marVal = 14;
    S.bitArrival.mar = null;
    S.glow.cu = false;
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'T2: IO = IR Out (amber) — address on ADDRESS BUS. MI = MAR In (cyan). MAR = 14.', a);
  }, { easing: Ease.linear, audio: 'scene6_t2' });

  add(3500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The MAR now points at address 14. RAM will look at slot 14 and return its value.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.mar = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Notice: the IR sent out only its LOWER 4 bits (the address 1110 = 14) on the bus. The upper 4 bits (the opcode) stay inside the IR — they are not sent on the bus.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.mar = false;
    S.glow.ram = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'RAM receives address 14 from the MAR. It looks at that slot. There is 28 stored there — the number we want to load into Register A.', a);
  }, { easing: Ease.linear });

  // T3 pre-explanation
  add(3500, (ctx, p, eng) => {
    S.glow.ram = true;
    S.glow.cu  = true;
    S.currentTState = 3;
    S.activeSignals = ['RO', 'AI'];
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'T3: RO fires (amber). RO means RAM Out — RAM reads address 14 and puts 28 onto the bus.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    S.glow.a  = true;
    S.glow.cu = true;
    S.currentTState = 3;
    S.activeSignals = ['RO', 'AI'];
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'T3: AI fires (cyan). AI means A In — Register A reads the value from the bus and latches it.', a);
  }, { easing: Ease.linear });

  // T3: RAM[14] → Reg A — 28 = 00011100 — SLOW — DATA BUS
  add(2200, (ctx, p, eng) => {
    S.busFlowBusType   = 'data';
    S.dataBusActive    = true;
    S.dataBusValue     = 28;
    S.addressBusActive = false;
    S.busActive        = true;
    S.busFlowProgress  = p;
    S.busFlowFrom      = { key: 'ram' };
    S.busFlowTo        = { key: 'a'   };
    S.busFlowValue     = '28';
    S.busFlowColor     = C.regA;
    S._busNumericValue = 28;
    S.glow.ram = true;
    S.glow.a   = true;
    S.glow.cu  = true;
    S.ramHighlight = 14;
    S.ramGridHighlightAddr = 14;
    S.bitArrival.a = computeBitArrival(28, p);
    S.currentTState  = 3;
    S.activeSignals  = ['RO', 'AI'];
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'T3: 28 = 00011100 travels on the DATA BUS from RAM[14] into Register A.', a);
  }, { easing: Ease.linear });

  add(3000, (ctx, p, eng) => {
    S.dataBusActive = false; S.dataBusValue = -1;
    S.busActive = false; S.busFlowProgress = -1;
    S.aVal = 28; S.ramHighlight = -1;
    S.ramGridHighlightAddr = -1;
    S.glow.a = true;
    S.glow.cu = false;
    S.bitArrival.a = null;
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'T3: RO = RAM Out on DATA BUS (amber). AI = A In (cyan). Register A now holds 28 = 00011100!', a);
    if (p > 0.12 && p < 0.18) {
      const { W, H } = eng;
      const L = layout(W, H);
      eng.spawnParticles(L.a.cx, L.a.cy, C.regA, 18);
    }
  }, { easing: Ease.linear, audio: 'scene6_t3' });

  add(4000, (ctx, p, eng) => {
    S.glow.a = false;
    S.bitArrival.a = null;
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'Register A holds 28 = 00011100. Bits 4, 3, and 2 are HIGH: 16 + 8 + 4 = 28.', a);
    ctx.save();
    ctx.globalAlpha = a * 0.08;
    ctx.fillStyle = C.success;
    ctx.fillRect(0, 0, eng.W, eng.H);
    ctx.restore();
  }, { easing: Ease.linear, audio: 'scene6_done' });

  add(6000, (ctx, p, eng) => {
    S.glow.a = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, '28 in binary: 16 + 8 + 4 = 28. Bit 4 is 16, bit 3 is 8, bit 2 is 4. Binary is just powers of 2 added together. 00011100.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.a = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Every number in a computer is stored this way. 8 wires. Each either 0 or 1. Together they represent values from 0 to 255 in an 8-bit system.', a);
  }, { easing: Ease.linear });

  add(5500, (ctx, p, eng) => {
    S.glow.a = false;
    S.glow.ram = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'And RAM[14] holds the value 28 = 00011100. The same binary number was stored there when we loaded the program. LDA just moved it from memory into Register A.', a);
  }, { easing: Ease.linear });

  add(4000, (ctx, p, eng) => {
    S.glow.a = false;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'LDA is done. The CPU automatically goes back to FETCH for the next instruction — ADD.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'LDA took four T-states total: T0+T1 to fetch, T2+T3 to execute. That is typical for memory-access instructions.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    S.glow.a = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Register A now holds 28. It will hold this value until another instruction changes it. Registers are persistent storage — they hold state between instructions.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    S.glow.a = false;
    S.glow.pc = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The PC already moved to 1 during the fetch. The CPU immediately begins FETCH for address 1 — no pause, no gap.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.pc = false;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'This is why CPUs seem instantaneous. Each instruction is just a few clock cycles. At 1 MHz that is millions of instructions per second.', a);
  }, { easing: Ease.linear });

  // ──────────────────────────────────────────────────────────
  //  SCENE 7 — ADD Instruction (~2 min)
  // ──────────────────────────────────────────────────────────
  add(200, () => {
    resetBus();
    S.glow = { pc:false, mar:false, ram:false, ir:false, a:false, b:false, alu:false, out:false, cu:false };
    S.bitArrival = { pc:null, mar:null, ram:null, ir:null, a:null, b:null, alu:null, out:null };
    S.showInstructionFormat = false; S.instrFmtAlpha = 0;
    S.showRAMGrid = true;
    S.ramGridAlpha = 1;
    S.ramGridHighlightAddr = -1;
    S.ramGridHighlightPair = 1;  // ADD at addr 1
    S.showControlUnit  = true;
    S.alpha.cu         = 1;
    S.cuOpcode         = 'ADD';
    S.currentTState    = 0;
    S.activeSignals    = ['CO', 'MI'];
    S.showSignalLines  = true;
    S.signalLinesAlpha = 1;
    S.showSignalList   = true;
    S.signalListAlpha  = 1;
    S.showMicrocode    = false;
    S.microcodeAlpha   = 0;
  }, { label: 'Scene 7: ADD Instruction', sceneId: 7, easing: Ease.linear });

  add(3500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, "Next instruction: ADD 15 = 0x2F = 0010|1111. The FETCH cycle is the same as before.", a);
  }, { easing: Ease.linear, audio: 'scene7_intro' });

  add(5000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Watch: even though we are executing a DIFFERENT instruction, FETCH is identical. CO + MI, then RO + II + CE. Always.', a);
  }, { easing: Ease.linear });

  add(3500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'T0: CO + MI (PC=1 → MAR). T1: RO + II + CE (RAM[1] → IR, PC becomes 2). Always the same.', a);
  }, { easing: Ease.linear });

  // Quick fetch: PC=1 → MAR — ADDRESS BUS
  add(700, (ctx, p, eng) => {
    S.busFlowBusType   = 'address';
    S.addressBusActive = true;
    S.addressBusValue  = 1;
    S.dataBusActive    = false;
    S.busActive        = true;
    S.busFlowProgress  = p;
    S.busFlowFrom      = { key: 'pc'  };
    S.busFlowTo        = { key: 'mar' };
    S.busFlowValue     = '1';
    S.busFlowColor     = C.addrBus;
    S._busNumericValue = 1;
    S.bitArrival.mar   = computeBitArrival(1, p);
    S.glow.pc = true; S.glow.mar = true;
  }, { easing: Ease.linear });

  // RAM[1] → IR (ADD 15 = 0x2F = 00101111) — DATA BUS
  add(700, (ctx, p, eng) => {
    S.marVal           = 1;
    S.addressBusActive = false; S.addressBusValue = -1;
    S.busFlowBusType   = 'data';
    S.dataBusActive    = true;
    S.dataBusValue     = 0x2F;
    S.busActive        = true;
    S.busFlowProgress  = p;
    S.busFlowFrom      = { key: 'ram' };
    S.busFlowTo        = { key: 'ir'  };
    S.busFlowValue     = 'ADD15';
    S.busFlowColor     = C.ir;
    S._busNumericValue = 0x2F;
    S.bitArrival.ir    = computeBitArrival(0x2F, p);
    S.glow.ram = true; S.glow.ir = true;
    S.ramHighlight = 1;
    S.ramGridHighlightAddr = 1;
  }, { easing: Ease.linear });

  add(600, (ctx, p, eng) => {
    S.dataBusActive = false; S.dataBusValue = -1;
    S.busActive = false; S.busFlowProgress = -1;
    S.irText = 'ADD 15'; S.irVal = 0x2F;
    S.pcVal  = 2;
    S.ramHighlight = -1; S.ramGridHighlightAddr = -1;
    S.bitArrival.ir = null; S.bitArrival.mar = null;
    S.glow.pc = false; S.glow.mar = false; S.glow.ram = false;
    S.showInstructionFormat = true;
    S.instrFmtMode    = 'decode';
    S.instrFmtAlpha   = 1;
  }, { easing: Ease.linear });

  add(3000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'Fetch done! IR holds 0x2F = 0010|1111: ADD (0010) at address 15 (1111).', a);
  }, { easing: Ease.linear, audio: 'scene7_fetch' });

  add(5000, (ctx, p, eng) => {
    S.glow.ir = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Same FETCH, different instruction. Upper nibble 0010 tells the CU: run ADD microcode. Lower nibble 1111 = address 15. That is where the second number lives.', a);
  }, { easing: Ease.linear });

  // T2: IR lower nibble → MAR (address 15 = 1111) — ADDRESS BUS
  add(1400, (ctx, p, eng) => {
    S.busFlowBusType   = 'address';
    S.addressBusActive = true;
    S.addressBusValue  = 15;
    S.dataBusActive    = false;
    S.busActive        = true;
    S.busFlowProgress  = p;
    S.busFlowFrom      = { key: 'ir'  };
    S.busFlowTo        = { key: 'mar' };
    S.busFlowValue     = '15';
    S.busFlowColor     = C.addrBus;
    S._busNumericValue = 15;
    S.bitArrival.mar   = computeBitArrival(15, p);
    S.glow.ir  = true;
    S.glow.mar = true;
    S.glow.cu  = true;
    S.instrFmtAlpha = 1 - p;
    S.currentTState  = 2;
    S.activeSignals  = ['IO', 'MI'];
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'T2: CU fires IO + MI. Address 15 (1111) travels on the ADDRESS BUS from IR operand to MAR.', a);
  }, { easing: Ease.linear });

  add(2500, (ctx, p, eng) => {
    S.marVal = 15;
    S.addressBusActive = false; S.addressBusValue = -1;
    S.busActive = false; S.busFlowProgress = -1;
    S.bitArrival.mar = null;
    S.glow.cu = false;
    S.showInstructionFormat = false; S.instrFmtAlpha = 0;
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'T2 complete. MAR = 15. Address bus carried the 4-bit operand — same pattern as LDA!', a);
  }, { easing: Ease.linear, audio: 'scene7_t2' });

  // T3: RAM[15] → B — 14 = 00001110 — DATA BUS
  add(1500, (ctx, p, eng) => {
    S.busFlowBusType   = 'data';
    S.dataBusActive    = true;
    S.dataBusValue     = 14;
    S.addressBusActive = false;
    S.busActive        = true;
    S.busFlowProgress  = p;
    S.busFlowFrom      = { key: 'ram' };
    S.busFlowTo        = { key: 'b'   };
    S.busFlowValue     = '14';
    S.busFlowColor     = C.regB;
    S._busNumericValue = 14;
    S.bitArrival.b     = computeBitArrival(14, p);
    S.glow.ram = true; S.glow.b = true;
    S.glow.cu  = true;
    S.ramHighlight = 15;
    S.ramGridHighlightAddr = 15;
    S.currentTState  = 3;
    S.activeSignals  = ['RO', 'BI'];
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'T3: CU fires RO + BI. 14 (00001110) travels on the DATA BUS from RAM[15] into Register B.', a);
  }, { easing: Ease.linear });

  add(2500, (ctx, p, eng) => {
    S.bVal = 14;
    S.dataBusActive = false; S.dataBusValue = -1;
    S.busActive = false; S.busFlowProgress = -1;
    S.ramHighlight = -1;
    S.ramGridHighlightAddr = -1;
    S.bitArrival.b = null;
    S.glow.cu = false;
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'T3 complete. RO = RAM Out (amber). BI = B In (cyan). Reg B holds 14 = 00001110.', a);
  }, { easing: Ease.linear, audio: 'scene7_t3' });

  add(3000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'A = 28 (00011100). B = 14 (00001110). The ALU adds them together at T4.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    S.glow.a = true;
    S.glow.b = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'A and B are the two inputs to the ALU. The ALU is ALWAYS computing A + B (or A - B) — but the result is only PUT on the bus when EO fires.', a);
  }, { easing: Ease.linear });

  add(5500, (ctx, p, eng) => {
    S.glow.a = true;
    S.glow.b = false;
    S.glow.alu = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, '28 in A, 14 in B. Before T4 even fires, the ALU already has the answer: 42. It is sitting there, waiting. T4 is just the permission slip to put it on the bus.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.a = false;
    S.glow.b = false;
    S.glow.alu = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The ALU is pure combinational logic — no clock needed. As soon as A and B have values, the sum is instantly available at the output.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.alu = false;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Ben Eater built this with 74LS86 XOR gates and 74LS283 full adder chips. Ripple carry addition — each bit waits for the carry from the bit below it.', a);
  }, { easing: Ease.linear });

  // T4: ALU computes — show full binary addition — SLOW
  add(4000, (ctx, p, eng) => {
    const { W, H } = eng;
    S.glow.alu = true;
    S.glow.cu  = true;
    S.aluVal   = 42;
    S.currentTState  = 4;
    S.activeSignals  = ['EO', 'AI', 'FI'];
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;

    if (p > 0.12) {
      const aluProg = clamp((p - 0.12) / 0.88, 0, 1);
      eng.drawBinaryALU(ctx, 28, 14, 42, aluProg, {
        alpha: Ease.out(aluProg) * 0.95,
        x: W / 2,
        y: H * 0.2,
        width: Math.min(W * 0.55, 300),
        op: '+',
        colorA: C.regA,
        colorB: C.regB,
        colorR: C.success,
      });
    }

    eng.drawCaption(ctx, 'T4: EO + AI + FI fire. ALU adds A + B. 00011100 + 00001110 = 00101010.', a);
  }, { easing: Ease.linear, audio: 'scene7_t4' });

  add(4000, (ctx, p, eng) => {
    const { W, H } = eng;
    S.glow.alu = true;
    S.glow.cu  = true;
    S.aluVal   = 42;
    S.currentTState  = 4;
    S.activeSignals  = ['EO', 'AI', 'FI'];
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawBinaryALU(ctx, 28, 14, 42, 1, {
      alpha: 0.85,
      x: W / 2, y: H * 0.2,
      width: Math.min(W * 0.55, 300),
      op: '+', colorA: C.regA, colorB: C.regB, colorR: C.success,
    });
    eng.drawCaption(ctx, '28 + 14 = 42. The answer to everything! EO sends this result back to the bus.', a);
  }, { easing: Ease.linear });

  // ALU result → A — 42 = 00101010 — DATA BUS
  add(1500, (ctx, p, eng) => {
    S.busFlowBusType   = 'data';
    S.dataBusActive    = true;
    S.dataBusValue     = 42;
    S.addressBusActive = false;
    S.busActive        = true;
    S.busFlowProgress  = p;
    S.busFlowFrom      = { key: 'alu' };
    S.busFlowTo        = { key: 'a'   };
    S.busFlowValue     = '42';
    S.busFlowColor     = C.success;
    S._busNumericValue = 42;
    S.bitArrival.a     = computeBitArrival(42, p);
    S.glow.alu = true; S.glow.a = true;
    S.glow.cu  = true;
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'T4: EO fires — 42 (00101010) travels on the DATA BUS from ALU to Register A. AI reads. FI updates flags.', a);
  }, { easing: Ease.linear });

  add(3000, (ctx, p, eng) => {
    S.aVal = 42;
    S.dataBusActive = false; S.dataBusValue = -1;
    S.busActive = false; S.busFlowProgress = -1;
    S.glow.alu = false;
    S.glow.cu  = false;
    S.bitArrival.a = null;
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'Result: 42 = 00101010 is now in Register A. ADD complete.', a);
    if (p > 0.15 && p < 0.22) {
      const { W, H } = eng;
      const L = layout(W, H);
      eng.spawnParticles(L.a.cx, L.a.cy, C.success, 20);
    }
    const flashA = p < 0.3 ? Ease.out(p/0.3) * 0.85 : (1-p) * 0.85;
    ctx.save();
    ctx.globalAlpha = flashA;
    ctx.fillStyle = C.success;
    ctx.font = `bold ${Math.min(eng.W/8, 160)}px JetBrains Mono, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 60;
    ctx.shadowColor = C.success;
    ctx.fillText('42', eng.W/2, eng.H/2);
    ctx.restore();
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.a = true;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'ADD took five T-states: T0+T1 fetch, T2 address setup, T3 load to B, T4 ALU result to A.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    S.glow.a = false;
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The FI signal (Flags In) also fired at T4. If the result were 0, the Zero Flag would be set. If it overflowed 255, the Carry Flag.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'In this case, 42 is neither 0 nor greater than 255, so both flags remain 0. No overflow. Clean result.', a);
  }, { easing: Ease.linear });

  add(5500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'ADD took five total T-states. But the CPU runs at 1 MHz — that is 1,000,000 clock pulses per second. Five T-states take 5 microseconds.', a);
  }, { easing: Ease.linear });

  // ──────────────────────────────────────────────────────────
  //  SCENE 8 — OUT and HLT (20s)
  // ──────────────────────────────────────────────────────────
  add(200, () => {
    resetBus();
    S.glow = { pc:false, mar:false, ram:false, ir:false, a:false, b:false, alu:false, out:false, cu:false };
    S.bitArrival = { pc:null, mar:null, ram:null, ir:null, a:null, b:null, alu:null, out:null };
    S.showInstructionFormat = false; S.instrFmtAlpha = 0;
    // RAM grid: switch to OUT instruction (SAP-1: addr 2 = 0xE0)
    S.showRAMGrid = true;
    S.ramGridAlpha = 1;
    S.ramGridHighlightAddr = -1;
    S.ramGridHighlightPair = 2;  // OUT at addr 2 (SAP-1)
    // CU: OUT instruction
    S.showControlUnit  = true;
    S.alpha.cu         = 1;
    S.cuOpcode         = 'OUT';
    S.currentTState    = 0;
    S.activeSignals    = ['CO', 'MI'];
    S.showSignalLines  = true;
    S.signalLinesAlpha = 1;
    S.showSignalList   = true;
    S.signalListAlpha  = 1;
    S.showMicrocode    = false;
    S.microcodeAlpha   = 0;
  }, { label: 'Scene 8: OUT and HLT', sceneId: 8, easing: Ease.linear });

  // Fetch OUT (PC=2, RAM[2]=0xE0) — T0: PC→MAR on ADDRESS BUS
  add(700, (ctx, p, eng) => {
    S.busFlowBusType   = 'address';
    S.addressBusActive = true;
    S.addressBusValue  = 2;
    S.dataBusActive    = false;
    S.busActive        = true;
    S.busFlowProgress  = p;
    S.busFlowFrom      = { key: 'pc'  };
    S.busFlowTo        = { key: 'mar' };
    S.busFlowValue     = '2';
    S.busFlowColor     = C.addrBus;
    S._busNumericValue = 2;
    S.bitArrival.mar   = computeBitArrival(2, p);
  }, { easing: Ease.linear });

  // T1: RAM[2]→IR on DATA BUS
  add(700, (ctx, p, eng) => {
    S.marVal           = 2;
    S.addressBusActive = false; S.addressBusValue = -1;
    S.busFlowBusType   = 'data';
    S.dataBusActive    = true;
    S.dataBusValue     = 0xE0;
    S.busActive        = true;
    S.busFlowProgress  = p;
    S.busFlowFrom      = { key: 'ram' };
    S.busFlowTo        = { key: 'ir'  };
    S.busFlowValue     = 'OUT';
    S.busFlowColor     = C.out;
    S._busNumericValue = 0xE0;  // 11100000 — OUT in SAP-1 (upper nibble 1110 = OUT, lower 0000 unused)
    S.bitArrival.ir    = computeBitArrival(0xE0, p);
    S.ramHighlight = 2;
    S.ramGridHighlightAddr = 2;
  }, { easing: Ease.linear });

  add(400, (ctx, p, eng) => {
    S.irText = 'OUT'; S.irVal = 0xE0; S.pcVal = 3;
    S.dataBusActive = false; S.dataBusValue = -1;
    S.busActive = false; S.busFlowProgress = -1;
    S.ramHighlight = -1; S.ramGridHighlightAddr = -1;
    S.bitArrival.mar = null; S.bitArrival.ir = null;
  }, { easing: Ease.linear });

  // OUT explanation
  add(5000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'OUT instruction: copies the value in Register A to the Output display. Simple.', a);
  }, { easing: Ease.linear });

  // OUT: A → Output (42 = 00101010) — DATA BUS
  add(1800, (ctx, p, eng) => {
    S.busFlowBusType   = 'data';
    S.dataBusActive    = true;
    S.dataBusValue     = 42;
    S.addressBusActive = false;
    S.busActive        = true;
    S.busFlowProgress  = p;
    S.busFlowFrom      = { key: 'a'   };
    S.busFlowTo        = { key: 'out' };
    S.busFlowValue     = '42';
    S.busFlowColor     = C.out;
    S._busNumericValue = 42;
    S.bitArrival.out   = computeBitArrival(42, p);
    S.glow.a = true; S.glow.out = true;
    S.glow.cu = true;
    S.cuOpcode       = 'OUT';
    S.currentTState  = 2;
    S.activeSignals  = ['AO', 'OI'];
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'T2: AO fires — 42 (00101010) travels on the DATA BUS from Register A to the Output display. OI reads.', a);
  }, { easing: Ease.linear });

  add(3500, (ctx, p, eng) => {
    S.outVal = 42;
    S.dataBusActive = false; S.dataBusValue = -1;
    S.busActive = false; S.busFlowProgress = -1;
    S.glow.a = false; S.glow.out = true;
    S.glow.cu = false;
    S.bitArrival.out = null;
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'OUT: Register A (42 = 00101010) is sent to the Output display. The result is visible.', a);
    if (p > 0.2 && p < 0.28) {
      const { W, H } = eng;
      const L = layout(W, H);
      eng.spawnParticles(L.out.cx, L.out.cy, C.out, 18);
    }
  }, { easing: Ease.linear, audio: 'scene8_out' });

  // Fetch HLT (PC=3, RAM[3]=0xF0) — T0: PC→MAR on ADDRESS BUS
  add(700, (ctx, p, eng) => {
    S.busFlowBusType   = 'address';
    S.addressBusActive = true;
    S.addressBusValue  = 3;
    S.dataBusActive    = false;
    S.busActive        = true;
    S.busFlowProgress  = p;
    S.busFlowFrom      = { key: 'pc'  };
    S.busFlowTo        = { key: 'mar' };
    S.busFlowValue     = '3';
    S.busFlowColor     = C.addrBus;
    S._busNumericValue = 3;
    S.bitArrival.mar   = computeBitArrival(3, p);
    S.glow.out = false;
  }, { easing: Ease.linear });

  // T1: RAM[3]→IR on DATA BUS
  add(700, (ctx, p, eng) => {
    S.marVal           = 3;
    S.addressBusActive = false; S.addressBusValue = -1;
    S.busFlowBusType   = 'data';
    S.dataBusActive    = true;
    S.dataBusValue     = 0xF0;
    S.busActive        = true;
    S.busFlowProgress  = p;
    S.busFlowFrom      = { key: 'ram' };
    S.busFlowTo        = { key: 'ir'  };
    S.busFlowValue     = 'HLT';
    S.busFlowColor     = C.ctrl;
    S._busNumericValue = 0xF0;  // 11110000 — HLT in SAP-1
    S.bitArrival.ir    = computeBitArrival(0xF0, p);
    S.ramHighlight = 3;
    S.ramGridHighlightAddr = 3;
    S.ramGridHighlightPair = 3;  // HLT at addr 3 (SAP-1)
  }, { easing: Ease.linear });

  add(500, (ctx, p, eng) => {
    S.irText = 'HLT'; S.irVal = 0xF0; S.pcVal = 4;
    S.dataBusActive = false; S.dataBusValue = -1;
    S.busActive = false; S.busFlowProgress = -1;
    S.ramHighlight = -1;
    S.ramGridHighlightAddr = -1;
    S.ramGridHighlightPair = -1;
    S.bitArrival.mar = null; S.bitArrival.ir = null;
    // CU fires HLT signal
    S.cuOpcode       = 'HLT';
    S.currentTState  = 2;
    S.activeSignals  = ['HLT'];
    S.glow.cu = true;
  }, { easing: Ease.linear });

  add(5500, (ctx, p, eng) => {
    S.glow.cu = false;
    const a = p < 0.1 ? p/0.1 : p > 0.8 ? (1-p)/0.2 : 1;
    eng.drawCaption(ctx, 'HLT: CU fires the HLT signal. The clock stops. Program complete. Output = 42.', a);
    const dim = p > 0.3 ? Ease.out((p-0.3)/0.7) * 0.7 : 0;
    ctx.save();
    ctx.fillStyle = `rgba(6,9,15,${dim})`;
    ctx.fillRect(0, 0, eng.W, eng.H);
    ctx.restore();
    if (dim > 0) {
      const { W, H } = eng;
      const L = layout(W, H);
      eng.drawComponent(ctx, 'OUTPUT', 'Display',
        L.out.x, L.out.y, L.cw, L.ch, C.out, {
          alpha: 1,
          glow: true,
          glowColor: C.out,
          glowAmt: 30 + Math.sin(Date.now()/300)*8,
          valueText: '42',
          valueColor: C.out,
        });
    }
  }, { easing: Ease.linear, audio: 'scene8_hlt' });

  add(5500, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'We added 28 + 14 and got 42. Four instructions. That is all it took.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'LDA loaded a value. ADD added another. OUT displayed the result. HLT stopped the clock.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'OUT is the simplest execute cycle of all: just one T-state. AO fires — Register A puts 42 on the bus. OI fires — Output Register reads it.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'HLT tells the clock to stop. In real hardware this is a wire that disables the oscillator. No more clock pulses — no more T-states.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Notice HLT does not destroy the output. The output register HOLDS its value, even with the clock stopped. That is why you can still read the result.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    const a = p < 0.1 ? p/0.1 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'We just ran a complete program on a real CPU architecture. LDA, ADD, OUT, HLT. Four instructions. Four FETCH cycles. A total of about 16 clock cycles.', a);
  }, { easing: Ease.linear });

  // ──────────────────────────────────────────────────────────
  //  SCENE 9 — The Big Picture (~2 min)
  // ──────────────────────────────────────────────────────────
  add(200, () => {
    resetBus();
    S.glow = { pc:false, mar:false, ram:false, ir:false, a:false, b:false, alu:false, out:false, cu:false };
    S.bitArrival = { pc:null, mar:null, ram:null, ir:null, a:null, b:null, alu:null, out:null };
    S.showInstructionFormat = false; S.instrFmtAlpha = 0;
    S.ramGridAlpha = 0;
    S.showRAMGrid = false;
    Object.keys(S.alpha).forEach(k => S.alpha[k] = 1);
    S.showControlUnit  = true;
    S.currentTState    = -1;
    S.activeSignals    = [];
    S.cuOpcode         = '';
    S.showSignalLines  = true;
    S.signalLinesAlpha = 0.5;
    S.showSignalList   = false;
    S.showMicrocode    = false;
  }, { label: 'Scene 9: The Big Picture', sceneId: 9, easing: Ease.linear });

  // Recap title
  add(5000, (ctx, p, eng) => {
    const { W, H } = eng;
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = C.textPrimary;
    ctx.font = `bold ${Math.min(W/22, 36)}px Inter, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowBlur = 18; ctx.shadowColor = '#4488ff';
    ctx.fillText("Let's zoom out.", W/2, H * 0.4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = C.textSecondary;
    ctx.font = `${Math.min(W/38, 18)}px Inter, sans-serif`;
    const la2 = clamp((p - 0.4) / 0.2, 0, 1) * a;
    ctx.globalAlpha = la2;
    ctx.fillText('What did we just see?', W/2, H * 0.55);
    ctx.restore();
  }, { easing: Ease.linear });

  // Recap items
  add(5500, (ctx, p, eng) => {
    const { W, H } = eng;
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    const items = [
      { delay: 0.0, color: C.pc,   text: '1. FETCH — get the instruction from RAM into the IR. (T0: CO+MI, T1: RO+II+CE)' },
      { delay: 0.3, color: C.ir,   text: '2. DECODE — the Control Unit splits the byte and looks up the microcode.' },
      { delay: 0.6, color: C.alu,  text: '3. EXECUTE — signals fire, data moves, ALU computes. The instruction is done.' },
    ];
    ctx.save();
    for (const item of items) {
      const ia = clamp((p - item.delay) / 0.2, 0, 1) * a;
      if (ia <= 0) continue;
      ctx.globalAlpha = ia;
      ctx.fillStyle = item.color;
      ctx.font = `${Math.min(W/42, 15)}px Inter, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowBlur = 6; ctx.shadowColor = item.color;
      const idx = items.indexOf(item);
      ctx.fillText(item.text, W/2, H * 0.28 + idx * (H * 0.16));
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    eng.drawCaption(ctx, 'Fetch. Decode. Execute. This cycle repeats for every instruction. Forever.', a);
  }, { easing: Ease.linear });

  // Cycle path animation: PC → MAR → RAM → IR → (execute loop)
  add(6000, (ctx, p, eng) => {
    const { W, H } = eng;
    const L = layout(W, H);
    const a = p < 0.1 ? p/0.1 : 1;
    ctx.save();
    ctx.globalAlpha = a;

    const nodes = [L.pc, L.mar, L.ram, L.ir];
    for (let i = 0; i < nodes.length - 1; i++) {
      const frac = clamp((p * (nodes.length) - i) , 0, 1);
      const fromX = nodes[i].cx, fromY = nodes[i].cy;
      const toX   = nodes[i+1].cx, toY = nodes[i+1].cy;
      eng.drawArrow(ctx, fromX, fromY, toX, toY, {
        color: C.bus,
        alpha: Ease.out(frac) * 0.8,
        thick: 2,
      });
    }

    const captions = [
      'Every program you\'ve ever run uses this same cycle.',
      'Fetch. Decode. Execute. Billions of times per second.',
      'Games, apps, AI — all built from these simple steps.',
      'Now you know how a CPU actually works.',
    ];
    const ci = Math.min(3, Math.floor(p * 4.5));
    const fa = p < 0.1 ? p/0.1 : (ci < 3 ? 1 : p > 0.85 ? (1-p)/0.15 : 1);
    eng.drawCaption(ctx, captions[ci], fa);

    ctx.restore();
  }, { easing: Ease.linear, audio: 'scene9a' });

  add(5000, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Every program ever written — from the first video game to a large language model — runs on this same cycle.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'What makes modern CPUs fast is not a different approach. It is doing MORE of these cycles per second, and doing MULTIPLE of them at the same time — pipelining.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'In a pipelined CPU, while one instruction is executing, the next is already being decoded, and the one after that is already being fetched. All at once.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'But the FOUNDATION is identical. FETCH. DECODE. EXECUTE. You have seen it with your own eyes, signal by signal.', a);
  }, { easing: Ease.linear });

  // Real world connection
  add(4500, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'Your phone does this billions of times per second. Same principle — just wider buses, more registers, more instructions.', a);
  }, { easing: Ease.linear });

  add(5500, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'A modern CPU has 64-bit registers, thousands of instructions, and out-of-order execution. But it still FETCHES from memory, DECODES the opcode, and EXECUTES signals.', a);
  }, { easing: Ease.linear });

  add(4000, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'You now understand how a CPU works. Not in theory — you SAW it happen, signal by signal.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'You saw CO put an address on the bus. You saw MI latch it into the MAR. You saw RO pull a byte from RAM. You saw the ALU add two numbers in binary.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The next time you hear "clock speed" or "cache hit" or "instruction pipeline" — you will know exactly what those things mean at the hardware level.', a);
  }, { easing: Ease.linear });

  add(5000, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'You built a mental model that most computer science graduates do not have. That is worth something.', a);
  }, { easing: Ease.linear });

  add(6000, (ctx, p, eng) => {
    const a = p < 0.12 ? p/0.12 : p > 0.85 ? (1-p)/0.15 : 1;
    eng.drawCaption(ctx, 'The next step: try it yourself. Write your own program. Watch every signal fire. Change a value in RAM and see the output change. This is how you build real intuition.', a);
  }, { easing: Ease.linear });

  // "Try it yourself" CTA
  add(5000, (ctx, p, eng) => {
    const { W, H } = eng;
    const a = p < 0.15 ? p/0.15 : p > 0.8 ? (1-p)/0.2 : 1;

    ctx.save();
    ctx.globalAlpha = a;

    const bw = Math.min(W * 0.6, 480);
    const bh = 90;
    const bx = W/2 - bw/2;
    const by = H/2 - bh/2;

    ctx.fillStyle = 'rgba(68,136,255,0.12)';
    ctx.strokeStyle = 'rgba(68,136,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#4488ff';
    eng._roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = C.textPrimary;
    ctx.font = `bold ${Math.min(W/36, 20)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("Try it yourself", W/2, by + 28);

    ctx.fillStyle = C.textSecondary;
    ctx.font = `${Math.min(W/45, 14)}px Inter, sans-serif`;
    ctx.fillText("Switch to Free Mode and step through a real program", W/2, by + 54);
    ctx.fillText("Every button click is one clock cycle.", W/2, by + 72);

    ctx.restore();
  }, { easing: Ease.linear, audio: 'scene10' });

  // ──────────────────────────────────────────────────────────
  //  SCENE 10 — Credits (5s)
  // ──────────────────────────────────────────────────────────
  add(200, () => {
    eng.clearLayers();
  }, { label: 'Scene 10: Credits', sceneId: 10, easing: Ease.linear });

  e.scene_titleCard(
    '8-Bit CPU Simulator',
    'Episode 2: How Transistors Make Logic Gates — Coming Soon',
    4000,
    { fadeOut: true, sceneId: 10,
      mainFont:  `bold 28px Inter, sans-serif`,
      mainColor: C.textSecondary,
      subFont:   `16px Inter, sans-serif`,
      subColor:  C.textMuted,
    }
  );
}

/* ═══════════════════════════════════════════════════════════
   EPISODE REGISTRY
═══════════════════════════════════════════════════════════ */

const EPISODES = [
  {
    id:       1,
    title:    'How a CPU Executes an Instruction',
    duration: '~3 min',
    build:    buildEpisode1,
    chapters: [
      { id: 1,   label: 'The Big Question' },
      { id: 2,   label: 'Meet the Components' },
      { id: 2.5, label: 'The Three Buses' },
      { id: 3,   label: 'The Program' },
      { id: 4,  label: 'FETCH' },
      { id: 5,  label: 'DECODE' },
      { id: 6,  label: 'EXECUTE — LDA' },
      { id: 7,  label: 'ADD Instruction' },
      { id: 8,  label: 'OUT and HLT' },
      { id: 9,  label: 'The Big Picture' },
      { id: 10, label: 'Credits' },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════
   WATCH MODE UI
═══════════════════════════════════════════════════════════ */

let _explainerEngine = null;
let _explainerRoot   = null;
let _currentEpisode  = 0;
let _currentSceneId  = 1;
let _controlsHideTimer = null;
let _controlsVisible   = true;
let _captionsOn = true;

function buildWatchUI() {
  if (document.getElementById('explainer-root')) return;

  const root = document.createElement('div');
  root.id = 'explainer-root';
  root.innerHTML = `
    <div id="explainer-canvas-wrap">
      <canvas id="explainer-canvas"></canvas>
      <div id="explainer-click-hint">Click / tap to continue</div>
    </div>

    <div id="explainer-controls">
      <!-- Progress bar row -->
      <div id="explainer-progress-wrap">
        <div id="explainer-progress-bar">
          <div id="explainer-progress-fill" style="width:0%"></div>
        </div>
        <span id="explainer-time-label">0:00</span>
      </div>

      <!-- Buttons row -->
      <div id="explainer-btn-row">
        <button class="explainer-step-btn" id="explainer-btn-prev" title="Previous step (Left arrow)">&#9664;</button>
        <button id="explainer-btn-play" title="Play / Pause (Space)">&#9654;</button>
        <button class="explainer-step-btn" id="explainer-btn-next" title="Next step (Right arrow)">&#9654;&#9654;</button>

        <div id="explainer-btn-spacer"></div>

        <span id="explainer-chapter-label">Scene 1: The Big Question</span>

        <select id="explainer-episode-select" title="Choose episode">
          ${EPISODES.map((ep, i) => `<option value="${i}">Ep ${ep.id}: ${ep.title}</option>`).join('')}
        </select>

        <select id="explainer-speed-select" title="Playback speed">
          <option value="0.5">0.5x</option>
          <option value="1" selected>1x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
          <option value="3">3x</option>
        </select>

        <button id="explainer-btn-narration" class="active" title="Toggle captions">CC</button>
        <button id="explainer-btn-mute" title="Mute/Unmute audio (M)">&#x1F50A;</button>
        <input type="range" id="explainer-volume-slider" min="0" max="100" value="85"
               title="Volume" style="width:60px;vertical-align:middle;cursor:pointer;accent-color:#4488ff;">
        <button id="explainer-btn-fullscreen" title="Fullscreen (F)">&#x26F6;</button>
        <button id="explainer-btn-close" title="Exit Watch Mode">Exit</button>
      </div>
    </div>

    <div id="explainer-loader">
      <div class="explainer-loader-dots">
        <div class="explainer-loader-dot"></div>
        <div class="explainer-loader-dot"></div>
        <div class="explainer-loader-dot"></div>
      </div>
    </div>
  `;

  document.body.appendChild(root);
  _explainerRoot = root;

  // Create engine
  const canvas = document.getElementById('explainer-canvas');
  _explainerEngine = new ExplainerEngine(canvas);

  // Wire engine callbacks
  _explainerEngine.onPlayChange = (playing) => {
    const btn = document.getElementById('explainer-btn-play');
    if (btn) btn.innerHTML = playing ? '&#9646;&#9646;' : '&#9654;';
  };

  _explainerEngine.onStepChange = (step, total) => {
    updateProgressUI();
    resetControlsHide();
  };

  _explainerEngine.onSceneChange = (label, sceneId) => {
    _currentSceneId = sceneId;
    const el = document.getElementById('explainer-chapter-label');
    if (el) el.textContent = label || '';
    updateChapterMarkers(sceneId);
  };

  _explainerEngine.onComplete = () => {
    updateProgressUI();
    const btn = document.getElementById('explainer-btn-play');
    if (btn) btn.innerHTML = '&#9654;';
    // Show replay hint
    const hint = document.getElementById('explainer-click-hint');
    if (hint) {
      hint.textContent = 'Episode complete — click Play to watch again';
      hint.style.opacity = '0.75';
    }
  };

  // Wire controls
  document.getElementById('explainer-btn-play').addEventListener('click', () => {
    if (_explainerEngine) _explainerEngine.toggle();
    resetControlsHide();
  });

  document.getElementById('explainer-btn-prev').addEventListener('click', () => {
    if (_explainerEngine) _explainerEngine.stepBackward();
    resetControlsHide();
  });

  document.getElementById('explainer-btn-next').addEventListener('click', () => {
    if (_explainerEngine) _explainerEngine.stepForward();
    resetControlsHide();
  });

  document.getElementById('explainer-btn-close').addEventListener('click', exitWatchMode);

  document.getElementById('explainer-btn-fullscreen').addEventListener('click', toggleFullscreen);

  document.getElementById('explainer-btn-narration').addEventListener('click', () => {
    _captionsOn = !_captionsOn;
    if (_explainerEngine) _explainerEngine.showCaptions = _captionsOn;
    const btn = document.getElementById('explainer-btn-narration');
    if (btn) btn.classList.toggle('active', _captionsOn);
  });

  document.getElementById('explainer-btn-mute').addEventListener('click', () => {
    if (!_explainerEngine) return;
    const muted = !_explainerEngine._audioMuted;
    _explainerEngine.setMuted(muted);
    const btn = document.getElementById('explainer-btn-mute');
    if (btn) btn.innerHTML = muted ? '&#x1F507;' : '&#x1F50A;';
  });

  document.getElementById('explainer-volume-slider').addEventListener('input', (e) => {
    if (!_explainerEngine) return;
    const vol = parseInt(e.target.value, 10) / 100;
    _explainerEngine.setVolume(vol);
    // If user drags volume up from 0, unmute
    if (vol > 0 && _explainerEngine._audioMuted) {
      _explainerEngine.setMuted(false);
      const btn = document.getElementById('explainer-btn-mute');
      if (btn) btn.innerHTML = '&#x1F50A;';
    }
  });

  document.getElementById('explainer-episode-select').addEventListener('change', (e) => {
    loadEpisode(parseInt(e.target.value, 10));
  });

  document.getElementById('explainer-speed-select').addEventListener('change', (e) => {
    if (_explainerEngine) _explainerEngine.speed = parseFloat(e.target.value);
  });

  // Progress bar click
  const progBar = document.getElementById('explainer-progress-bar');
  progBar.addEventListener('click', (e) => {
    if (!_explainerEngine || !_explainerEngine.timeline.length) return;
    const rect = progBar.getBoundingClientRect();
    const frac = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const targetStep = Math.round(frac * (_explainerEngine.timeline.length - 1));
    _explainerEngine.seekToStep(targetStep);
    resetControlsHide();
  });

  // Canvas click: only advance if awaiting, do NOT pause/play on tap
  // (pause/play is handled by the play button to avoid accidental pauses on mobile)
  canvas.addEventListener('click', () => {
    if (!_explainerEngine) return;
    if (_explainerEngine.awaitingClick) {
      _explainerEngine.advance();
    }
    // If paused, resume on tap (but tapping while playing does NOT pause)
    if (!_explainerEngine.playing && !_explainerEngine.awaitingClick) {
      _explainerEngine.play();
    }
    resetControlsHide();
  });

  // Hover on canvas: show controls
  const wrap = document.getElementById('explainer-canvas-wrap');
  wrap.addEventListener('mousemove', () => {
    showControls();
    resetControlsHide();
  });

  wrap.addEventListener('touchstart', () => {
    showControls();
    resetControlsHide();
  }, { passive: true });

  // Keyboard handling
  document.addEventListener('keydown', onExplainerKey);

  // Build chapter markers
  buildChapterMarkers();

  // Load first episode
  loadEpisode(0);
}

function buildChapterMarkers() {
  const bar = document.getElementById('explainer-progress-bar');
  if (!bar) return;
  // Markers will be positioned after episode is loaded
}

function updateChapterMarkers(currentSceneId) {
  const bar = document.getElementById('explainer-progress-bar');
  if (!bar || !_explainerEngine) return;

  // Remove old markers
  bar.querySelectorAll('.explainer-chapter-mark').forEach(el => el.remove());

  const ep = EPISODES[_currentEpisode];
  if (!ep || !ep.chapters || !_explainerEngine.timeline.length) return;

  const total = _explainerEngine.timeline.length;

  // Compute where each scene starts (by sceneId) in the step list
  const sceneStarts = {};
  _explainerEngine.timeline.forEach((step, i) => {
    if (step.label && !sceneStarts[step.sceneId]) {
      sceneStarts[step.sceneId] = i / total;
    }
  });

  ep.chapters.forEach(ch => {
    const pos = sceneStarts[ch.id];
    if (pos === undefined) return;
    const mark = document.createElement('div');
    mark.className = 'explainer-chapter-mark';
    if (ch.id < currentSceneId) mark.classList.add('passed');
    mark.style.left = `${pos * 100}%`;
    mark.title = ch.label;
    bar.appendChild(mark);
  });
}

function loadEpisode(index) {
  if (!_explainerEngine) return;
  _currentEpisode = index;
  const ep = EPISODES[index];
  if (!ep) return;

  const loader = document.getElementById('explainer-loader');
  if (loader) loader.classList.add('visible');

  // Small delay for visual polish
  setTimeout(() => {
    _explainerEngine.pause();
    ep.build(_explainerEngine);
    _explainerEngine.showCaptions = _captionsOn;

    // Preload all audio clips for this episode
    _explainerEngine.preloadAudio();

    const firstStep = _explainerEngine.timeline[0];
    if (firstStep && firstStep.onStart) firstStep.onStart(_explainerEngine);
    if (firstStep && firstStep.label) {
      const el = document.getElementById('explainer-chapter-label');
      if (el) el.textContent = firstStep.label;
    }

    if (loader) loader.classList.remove('visible');

    updateProgressUI();
    updateChapterMarkers(1);
    _explainerEngine._drawFrame(0);

    // Play audio for the first step if it has one
    if (firstStep && firstStep.audio) {
      _explainerEngine.playAudio(firstStep.audio);
    }

    // Force resize to pick up correct dimensions
    _explainerEngine._onResize();

    _explainerEngine.play();

    // Hide click hint — animation auto-plays
    const hint = document.getElementById('explainer-click-hint');
    if (hint) hint.style.display = 'none';
  }, 120);
}

function updateProgressUI() {
  if (!_explainerEngine) return;
  const fill = document.getElementById('explainer-progress-fill');
  if (fill) fill.style.width = `${_explainerEngine.progress * 100}%`;

  const elapsed = _explainerEngine.elapsedSec;
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60);
  const label = document.getElementById('explainer-time-label');
  if (label) label.textContent = `${mins}:${secs.toString().padStart(2,'0')}`;
}

// Poll progress bar during playback
setInterval(() => {
  if (_explainerEngine && _explainerEngine.playing) {
    updateProgressUI();
  }
}, 250);

function showControls() {
  const ctrl = document.getElementById('explainer-controls');
  if (ctrl) ctrl.classList.remove('hidden');
  _controlsVisible = true;
}

function hideControls() {
  const ctrl = document.getElementById('explainer-controls');
  if (ctrl) ctrl.classList.add('hidden');
  _controlsVisible = false;
}

function resetControlsHide() {
  showControls();
  if (_controlsHideTimer) clearTimeout(_controlsHideTimer);
  _controlsHideTimer = setTimeout(hideControls, 3500);
}

function toggleFullscreen() {
  const root = document.getElementById('explainer-root');
  if (!root) return;
  if (!document.fullscreenElement) {
    root.requestFullscreen && root.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen && document.exitFullscreen();
  }
}

function onExplainerKey(e) {
  if (!document.body.classList.contains('watch-mode')) return;
  switch (e.key) {
    case ' ':
    case 'Space':
      e.preventDefault();
      if (_explainerEngine) _explainerEngine.toggle();
      resetControlsHide();
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (_explainerEngine) _explainerEngine.stepForward();
      resetControlsHide();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (_explainerEngine) _explainerEngine.stepBackward();
      resetControlsHide();
      break;
    case 'f':
    case 'F':
      toggleFullscreen();
      break;
    case 'Escape':
      if (document.fullscreenElement) {
        document.exitFullscreen && document.exitFullscreen();
      } else {
        exitWatchMode();
      }
      break;
    case 'c':
    case 'C':
      _captionsOn = !_captionsOn;
      if (_explainerEngine) _explainerEngine.showCaptions = _captionsOn;
      break;
    case 'm':
    case 'M':
      if (_explainerEngine) {
        const muted = !_explainerEngine._audioMuted;
        _explainerEngine.setMuted(muted);
        const muteBtn = document.getElementById('explainer-btn-mute');
        if (muteBtn) muteBtn.innerHTML = muted ? '&#x1F507;' : '&#x1F50A;';
      }
      break;
  }
}

/* ═══════════════════════════════════════════════════════════
   ENTER / EXIT WATCH MODE
═══════════════════════════════════════════════════════════ */

function enterWatchMode() {
  // Build UI if not yet done
  buildWatchUI();

  document.body.classList.add('watch-mode');
  document.body.classList.remove('learn-mode');

  // Pause any running CPU
  if (window.stopRunLoop) window.stopRunLoop();

  // Start animation if engine is idle
  if (_explainerEngine && !_explainerEngine.playing) {
    _explainerEngine.play();
  }

  resetControlsHide();
}

function exitWatchMode() {
  document.body.classList.remove('watch-mode');

  if (_explainerEngine) {
    _explainerEngine.pause();
    _explainerEngine.stopAudio();
  }

  if (_controlsHideTimer) clearTimeout(_controlsHideTimer);
  showControls();

  // Tell mode toggle to sync visually
  if (window._explainerExitCallback) window._explainerExitCallback();
}

/* ═══════════════════════════════════════════════════════════
   INJECT "Watch" OPTION INTO THE MODE TOGGLE
   We wait for tutorial.js to create the mode toggle,
   then extend it with a Watch option.
═══════════════════════════════════════════════════════════ */

function injectWatchToggle() {
  const toggle = document.getElementById('mode-toggle');
  if (!toggle) {
    // Retry — tutorial.js may not have run yet
    setTimeout(injectWatchToggle, 80);
    return;
  }

  // Avoid double injection
  if (document.getElementById('toggle-watch')) return;

  const watchOpt = document.createElement('span');
  watchOpt.className    = 'mode-toggle-option';
  watchOpt.id           = 'toggle-watch';
  watchOpt.textContent  = 'Watch';
  watchOpt.title        = 'Animated explainer videos';
  toggle.appendChild(watchOpt);

  watchOpt.addEventListener('click', () => {
    // Deactivate others
    toggle.querySelectorAll('.mode-toggle-option').forEach(o => o.classList.remove('active'));
    watchOpt.classList.add('active');

    // Exit other modes
    if (document.body.classList.contains('build-mode') && window.exitBuildMode) {
      window.exitBuildMode();
    }
    if (window.clearComponentDimming) window.clearComponentDimming();

    enterWatchMode();
  });

  // When exiting watch mode from inside the player, sync the toggle
  window._explainerExitCallback = () => {
    toggle.querySelectorAll('.mode-toggle-option').forEach(o => o.classList.remove('active'));
    const freeOpt = document.getElementById('toggle-free');
    if (freeOpt) freeOpt.classList.add('active');
    if (window.enterFreeMode) window.enterFreeMode();
  };
}

/* ═══════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════ */

window.addEventListener('DOMContentLoaded', () => {
  // Wait one tick for tutorial.js to finish building the mode toggle
  setTimeout(injectWatchToggle, 40);
});

// Expose for external use
window.enterWatchMode = enterWatchMode;
window.exitWatchMode  = exitWatchMode;
window.ExplainerEngine = ExplainerEngine;
