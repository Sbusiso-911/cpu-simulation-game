/**
 * Breadboard Build Mode — Core: constants, Wire, BreadboardComponent base
 */

// ─── Wire colors ───────────────────────────────────────────────────────────
const WIRE_COLORS = ['#ff4444','#4488ff','#00ff88','#ffcc00','#ff8844','#dde8f4','#bb66ff','#00ddff'];
let _wireColorIdx = 0;
function nextWireColor() { const c = WIRE_COLORS[_wireColorIdx % WIRE_COLORS.length]; _wireColorIdx++; return c; }

// ─── Pin descriptor ────────────────────────────────────────────────────────
// { name, dir:'in'|'out', bits:1|8, value:0, side:'left'|'right'|'top'|'bottom', index }

// ─── Wire color categories (used by template) ─────────────────────────────
const WIRE_CAT_COLORS = {
  clock:    '#00ff88',  // green  — clock distribution
  data:     '#ffaa00',  // amber  — data bus
  address:  '#4488ff',  // blue   — address bus
  control:  '#ff4444',  // red    — control signals
  alu:      '#ff8844',  // orange — ALU / flags
  feedback: '#aa66ff',  // purple — opcode / flag feedback to CU
};

// ─── Wire ──────────────────────────────────────────────────────────────────
class Wire {
  constructor(fromComp, fromPin, toComp, toPin) {
    this.id       = Wire._nextId++;
    this.from     = { comp: fromComp, pin: fromPin };
    this.to       = { comp: toComp,   pin: toPin   };
    this.color    = nextWireColor();
    this.active   = false;  // carrying non-zero data
    this.value    = 0;
    this.flashT   = 0;      // animation timer
    // Template features
    this.label    = null;   // optional string label shown at midpoint
    this.highlighted = false; // true when user clicks the wire
    this._highlightTime = 0;
  }
  getValue() {
    const p = this.from.comp.getPin(this.from.pin);
    return p ? p.value : 0;
  }
  render(ctx, cam) {
    const fp = this.from.comp.getPinScreenPos(this.from.pin, cam);
    const tp = this.to.comp.getPinScreenPos(this.to.pin, cam);
    if (!fp || !tp) return;

    const v = this.getValue();
    this.value  = v;
    this.active = v !== 0;

    // Highlight fade (1.5 sec)
    const hlAge  = Date.now() - this._highlightTime;
    const hlAlpha = this.highlighted ? Math.max(0, 1 - hlAge / 1500) : 0;
    if (this.highlighted && hlAlpha === 0) this.highlighted = false;

    ctx.save();
    const alpha  = this.active ? 1.0 : 0.55;
    const width  = this.active ? 2.5 : 1.5;
    const glow   = this.active ? 8 : 0;

    // Highlight ring (drawn first, underneath)
    if (this.highlighted && hlAlpha > 0) {
      const dx2 = tp.x - fp.x;
      const cpOff2 = Math.min(Math.abs(dx2) * 0.5 + 30, 80);
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = hlAlpha * 0.6;
      ctx.lineWidth   = 6;
      ctx.lineCap     = 'round';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur  = 12 * hlAlpha;
      ctx.beginPath();
      ctx.moveTo(fp.x, fp.y);
      ctx.bezierCurveTo(fp.x + cpOff2, fp.y, tp.x - cpOff2, tp.y, tp.x, tp.y);
      ctx.stroke();
      ctx.restore();
    }

    if (glow > 0) {
      ctx.shadowColor = this.color;
      ctx.shadowBlur  = glow;
    }

    ctx.strokeStyle = this.color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth   = width;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    // Bezier curve routing
    const dx = tp.x - fp.x;
    const dy = tp.y - fp.y;
    const cpOff = Math.min(Math.abs(dx) * 0.5 + 30, 80);

    ctx.beginPath();
    ctx.moveTo(fp.x, fp.y);
    ctx.bezierCurveTo(fp.x + cpOff, fp.y, tp.x - cpOff, tp.y, tp.x, tp.y);
    ctx.stroke();

    // Endpoint dots
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(fp.x, fp.y, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(tp.x, tp.y, 3, 0, Math.PI*2); ctx.fill();

    // Value label in middle if active and 8-bit
    if (this.active && this.from.comp.getPin(this.from.pin)?.bits === 8 && !this.label) {
      const mx = (fp.x + tp.x) / 2;
      const my = (fp.y + tp.y) / 2 - 8;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle   = '#0a0e14';
      ctx.fillRect(mx - 14, my - 8, 28, 12);
      ctx.fillStyle   = this.color;
      ctx.font        = 'bold 9px monospace';
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'middle';
      ctx.fillText('0x' + (v & 0xFF).toString(16).toUpperCase().padStart(2,'0'), mx, my - 2);
    }

    // Wire label — shown at midpoint when zoom >= 0.5
    if (this.label && cam.scale >= 0.5) {
      // Compute bezier midpoint (t=0.5)
      const t    = 0.5;
      const cp1x = fp.x + cpOff;
      const cp1y = fp.y;
      const cp2x = tp.x - cpOff;
      const cp2y = tp.y;
      const mx = (1-t)**3 * fp.x + 3*(1-t)**2*t * cp1x + 3*(1-t)*t**2 * cp2x + t**3 * tp.x;
      const my = (1-t)**3 * fp.y + 3*(1-t)**2*t * cp1y + 3*(1-t)*t**2 * cp2y + t**3 * tp.y;

      const fontSize = Math.max(8, 9 * Math.min(cam.scale, 1.2));
      ctx.font        = `${fontSize}px monospace`;
      const tw        = ctx.measureText(this.label).width;
      const padX      = 4;
      const padY      = 3;
      const bw        = tw + padX * 2;
      const bh        = fontSize + padY * 2;

      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 0.92;
      // Background pill
      ctx.fillStyle   = '#070d14';
      const bx = mx - bw / 2;
      const by = my - bh / 2;
      const br = 3;
      ctx.beginPath();
      ctx.moveTo(bx + br, by);
      ctx.lineTo(bx + bw - br, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
      ctx.lineTo(bx + bw, by + bh - br);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
      ctx.lineTo(bx + br, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
      ctx.lineTo(bx, by + br);
      ctx.quadraticCurveTo(bx, by, bx + br, by);
      ctx.closePath();
      ctx.fill();
      // Border matching wire color
      ctx.strokeStyle = this.color;
      ctx.lineWidth   = 0.8;
      ctx.globalAlpha = 0.6;
      ctx.stroke();

      // Label text
      ctx.globalAlpha  = 1.0;
      ctx.fillStyle    = this.active ? this.color : '#7a9ab8';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.label, mx, my);
    }

    ctx.restore();
  }

  // Trigger a highlight flash
  flash() {
    this.highlighted    = true;
    this._highlightTime = Date.now();
  }
}
Wire._nextId = 1;

// ─── BreadboardComponent base ──────────────────────────────────────────────
class BreadboardComponent {
  constructor(type, x, y, label) {
    this.id     = BreadboardComponent._nextId++;
    this.type   = type;
    this.x      = x;
    this.y      = y;
    this.w      = 120;
    this.h      = 80;
    this.label  = label || type;
    this.pins   = [];   // array of pin descriptors
    this.selected   = false;
    this.highlighted= false;
    this._initPins();
  }

  _initPins() { /* override */ }

  getPin(name) { return this.pins.find(p => p.name === name); }

  // Screen position of a pin given camera transform
  getPinScreenPos(pinName, cam) {
    const pin = this.getPin(pinName);
    if (!pin) return null;
    const lp  = this._pinLocalPos(pin);
    return {
      x: (this.x + lp.x) * cam.scale + cam.ox,
      y: (this.y + lp.y) * cam.scale + cam.oy,
    };
  }

  // World position of a pin
  getPinWorldPos(pinName) {
    const pin = this.getPin(pinName);
    if (!pin) return null;
    const lp = this._pinLocalPos(pin);
    return { x: this.x + lp.x, y: this.y + lp.y };
  }

  _pinLocalPos(pin) {
    const pad = 12;
    switch (pin.side) {
      case 'left':   return { x: 0,        y: pad + pin.index * 16 };
      case 'right':  return { x: this.w,   y: pad + pin.index * 16 };
      case 'top':    return { x: pad + pin.index * 16, y: 0 };
      case 'bottom': return { x: pad + pin.index * 16, y: this.h };
      default:       return { x: 0, y: 0 };
    }
  }

  // Hit-test world coords against component body
  hitTest(wx, wy) {
    return wx >= this.x && wx <= this.x + this.w &&
           wy >= this.y && wy <= this.y + this.h;
  }

  // Hit-test world coords against a specific pin (returns pin name or null)
  getPinAt(wx, wy, radius) {
    radius = radius || 8;
    for (const pin of this.pins) {
      const lp = this._pinLocalPos(pin);
      const px = this.x + lp.x;
      const py = this.y + lp.y;
      const dx = wx - px;
      const dy = wy - py;
      if (dx*dx + dy*dy <= radius*radius) return pin.name;
    }
    return null;
  }

  simulate() { /* override — update pin output values */ }

  // Base render (dark IC chip)
  render(ctx, cam) {
    const sx = this.x * cam.scale + cam.ox;
    const sy = this.y * cam.scale + cam.oy;
    const sw = this.w * cam.scale;
    const sh = this.h * cam.scale;
    const r  = 6 * cam.scale;

    ctx.save();

    // Drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur  = 10 * cam.scale;
    ctx.shadowOffsetY = 3 * cam.scale;

    // Body
    const bodyColor = this._bodyColor();
    ctx.fillStyle   = bodyColor;
    ctx.strokeStyle = this.selected ? '#00ff88' : (this.highlighted ? '#ffaa00' : '#2e3e52');
    ctx.lineWidth   = this.selected ? 2 : 1;
    this._roundRect(ctx, sx, sy, sw, sh, r);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.stroke();

    // Header bar
    ctx.fillStyle = this._headerColor();
    this._roundRect(ctx, sx, sy, sw, 18 * cam.scale, r, true);
    ctx.fill();

    // Label
    ctx.fillStyle    = '#e8f0f8';
    ctx.font         = `bold ${Math.max(8, 10 * cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur   = 0;
    ctx.fillText(this.label, sx + sw/2, sy + 9 * cam.scale);

    ctx.restore();

    // Draw pins and interior (separate save for no shadow)
    ctx.save();
    this._renderPins(ctx, cam);
    this._renderInterior(ctx, cam, sx, sy, sw, sh);
    ctx.restore();
  }

  _bodyColor()   { return '#111c28'; }
  _headerColor() { return '#1a2e44'; }

  _renderInterior(ctx, cam, sx, sy, sw, sh) { /* override */ }

  _renderPins(ctx, cam) {
    // Check if we're in wiring mode (BB is global)
    const wiring = typeof BB !== 'undefined' && BB.wiringFrom;

    for (const pin of this.pins) {
      const lp = this._pinLocalPos(pin);
      const px = (this.x + lp.x) * cam.scale + cam.ox;
      const py = (this.y + lp.y) * cam.scale + cam.oy;
      const r  = Math.max(3, 4.5 * cam.scale);

      const connected = pin._connected;
      const isHigh    = pin.value !== 0;

      // When wiring: highlight compatible input pins with a pulsing green ring
      let isWiringTarget = false;
      if (wiring && pin.dir === 'in' && !connected) {
        isWiringTarget = true;
      }

      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI*2);

      if (connected && isHigh) {
        ctx.fillStyle   = pin.dir === 'out' ? '#00ff88' : '#4488ff';
        ctx.strokeStyle = pin.dir === 'out' ? '#00cc66' : '#2266cc';
      } else if (connected) {
        ctx.fillStyle   = pin.dir === 'out' ? '#1a4a2a' : '#1a2a4a';
        ctx.strokeStyle = pin.dir === 'out' ? '#1e3e2e' : '#1e2e3e';
      } else {
        ctx.fillStyle   = '#0a1018';
        ctx.strokeStyle = '#2e3e52';
      }
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();

      // Pulsing ring on available input pins during wiring
      if (isWiringTarget) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
        const ringR = r + 3 + pulse * 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 230, 118, ${0.4 + pulse * 0.4})`;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Pin label (only at reasonable zoom)
      if (cam.scale >= 0.7) {
        const fontSize = Math.max(7, 8 * cam.scale);
        ctx.font        = `${fontSize}px monospace`;
        ctx.fillStyle   = isWiringTarget ? '#00e676' : '#4a6278';
        ctx.textBaseline= 'middle';
        const offX = pin.side === 'left' ? 6 * cam.scale : pin.side === 'right' ? -6 * cam.scale : 0;
        const offY = pin.side === 'top'  ? 6 * cam.scale : pin.side === 'bottom'? -6 * cam.scale : 0;
        ctx.textAlign   = pin.side === 'left' ? 'left' : pin.side === 'right' ? 'right' : 'center';
        ctx.fillText(pin.name, px + offX, py + offY);
      }
    }
  }

  _roundRect(ctx, x, y, w, h, r, topOnly) {
    ctx.beginPath();
    if (topOnly) {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    }
    ctx.closePath();
  }

  _drawValueBadge(ctx, cam, sx, sy, sw, sh, value, bits) {
    if (cam.scale < 0.5) return;
    const hex = (value & 0xFF).toString(16).toUpperCase().padStart(2,'0');
    const bin = (value & 0xFF).toString(2).padStart(8,'0');
    const dec = (value & 0xFF).toString(10);
    const cy  = sy + sh / 2 + 4 * cam.scale;

    ctx.font         = `bold ${Math.max(9, 11 * cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ffaa00';
    ctx.fillText('0x' + hex + ' = ' + dec, sx + sw/2, cy);

    if (cam.scale >= 0.75 && bits === 8) {
      ctx.font      = `${Math.max(7, 8.5 * cam.scale)}px monospace`;
      ctx.fillStyle = '#1a4a2a';
      ctx.fillStyle = '#00aa55';
      ctx.fillText(bin.slice(0,4) + ' ' + bin.slice(4), sx + sw/2, cy + 12 * cam.scale);
    }
  }

  getInspectorData() {
    return {
      name:        this.label,
      type:        this.type,
      description: this.description || null,
      pins:        this.pins.map(p => ({ name: p.name, dir: p.dir, value: p.value, connected: !!p._connected })),
    };
  }

  // Base description — override in subclasses
  get description() { return null; }
}
BreadboardComponent._nextId = 1;

// Export
window.Wire                 = Wire;
window.BreadboardComponent  = BreadboardComponent;
window.WIRE_COLORS          = WIRE_COLORS;
window.WIRE_CAT_COLORS      = WIRE_CAT_COLORS;
window.nextWireColor        = nextWireColor;
