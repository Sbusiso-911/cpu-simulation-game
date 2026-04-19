/**
 * bb-electronics.js — Electronic component library for the breadboard simulator.
 * Depends on bb-core.js (BreadboardComponent, makePin via bb-components.js)
 *
 * Categories:
 *   Power · Passive · Logic Gates · Combinational · Sequential
 *   Semiconductors · Display · ICs (74LS series)
 */

'use strict';

// ─── shared pin factory (mirrors bb-components.js) ─────────────────────────
function _mp(name, dir, bits, side, index) {
  return { name, dir, bits: bits || 1, side, index, value: 0, _connected: false };
}

// ─── canvas helpers ─────────────────────────────────────────────────────────
function _rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════════
//  POWER COMPONENTS
// ═══════════════════════════════════════════════════════════════════

class VCCComponent extends BreadboardComponent {
  constructor(x, y) {
    super('VCC', x, y, 'VCC');
    this.w = 80; this.h = 60;
  }
  _initPins() {
    this.pins = [ _mp('V+', 'out', 1, 'right', 0) ];
  }
  _bodyColor()   { return '#2a0000'; }
  _headerColor() { return '#440000'; }
  simulate() { this.getPin('V+').value = 255; }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.45) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    ctx.font = `bold ${Math.max(11, 14 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff4444';
    ctx.fillText('+5V', cx, cy);
  }
}

class GNDComponent extends BreadboardComponent {
  constructor(x, y) {
    super('GND', x, y, 'GND');
    this.w = 80; this.h = 60;
  }
  _initPins() {
    this.pins = [ _mp('GND', 'out', 1, 'right', 0) ];
  }
  _bodyColor()   { return '#0a0a0a'; }
  _headerColor() { return '#181818'; }
  simulate() { this.getPin('GND').value = 0; }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.45) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    // Ground symbol — three horizontal lines
    const lw = 14 * cam.scale;
    ctx.strokeStyle = '#aaaaaa'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const w2 = lw * (1 - i * 0.25);
      const yy = cy - 4 * cam.scale + i * 5 * cam.scale;
      ctx.beginPath(); ctx.moveTo(cx - w2, yy); ctx.lineTo(cx + w2, yy); ctx.stroke();
    }
  }
}

class BatteryComponent extends BreadboardComponent {
  constructor(x, y) {
    super('Battery', x, y, 'BATT');
    this.w = 90; this.h = 70;
    this._voltage = 5;
  }
  _initPins() {
    this.pins = [
      _mp('+', 'out', 1, 'right', 0),
      _mp('-', 'out', 1, 'right', 1),
    ];
  }
  _bodyColor()   { return '#1a2a0a'; }
  _headerColor() { return '#243610'; }
  simulate() {
    this.getPin('+').value = 255;
    this.getPin('-').value = 0;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.45) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    ctx.font = `bold ${Math.max(9, 11 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#88dd44';
    ctx.fillText(this._voltage + 'V', cx, cy);
  }
  getInspectorData() {
    const d = super.getInspectorData();
    d.voltage = this._voltage;
    return d;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PASSIVE COMPONENTS
// ═══════════════════════════════════════════════════════════════════

class ResistorComponent extends BreadboardComponent {
  constructor(x, y) {
    super('Resistor', x, y, 'RES');
    this.w = 100; this.h = 60;
    this._ohms = 1000;
  }
  _initPins() {
    this.pins = [
      _mp('A', 'in',  1, 'left',  0),
      _mp('B', 'out', 1, 'right', 0),
    ];
  }
  _bodyColor()   { return '#1a1600'; }
  _headerColor() { return '#2a2200'; }
  simulate() {
    // Digital sim: pass through (pull-up/pull-down use is contextual)
    this.getPin('B').value = this.getPin('A').value;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.45) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    // Zigzag resistor symbol
    const zw = 36 * cam.scale, zh = 8 * cam.scale;
    const zx = cx - zw / 2, zy = cy - zh / 2;
    ctx.strokeStyle = '#cc9922'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx + 8 * cam.scale, zy + zh / 2);
    ctx.lineTo(zx, zy + zh / 2);
    const segs = 6;
    for (let i = 0; i < segs; i++) {
      const px = zx + (i / segs) * zw;
      const py = zy + (i % 2 === 0 ? 0 : zh);
      ctx.lineTo(px + zw / segs, zy + (i % 2 === 0 ? zh : 0));
    }
    ctx.lineTo(sx + sw - 8 * cam.scale, zy + zh / 2);
    ctx.stroke();
    // Value label
    ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.fillStyle = '#cc9922'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const label = this._ohms >= 1000 ? (this._ohms / 1000) + 'k' : this._ohms;
    ctx.fillText(label + 'Ω', cx, zy + zh + 2 * cam.scale);
  }
}

class CapacitorComponent extends BreadboardComponent {
  constructor(x, y) {
    super('Capacitor', x, y, 'CAP');
    this.w = 100; this.h = 60;
    this._uf = 100;
    this._prev = 0;
  }
  _initPins() {
    this.pins = [
      _mp('A', 'in',  1, 'left',  0),
      _mp('B', 'out', 1, 'right', 0),
    ];
  }
  _bodyColor()   { return '#0a1a2a'; }
  _headerColor() { return '#102030'; }
  simulate() {
    const out = this._prev;
    this._prev = this.getPin('A').value;
    this.getPin('B').value = out;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.45) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 2 * cam.scale;
    const ph = 12 * cam.scale, gap = 4 * cam.scale, pw = 14 * cam.scale;
    ctx.strokeStyle = '#4488cc'; ctx.lineWidth = 1.5;
    // Left plate
    ctx.beginPath(); ctx.moveTo(sx + 10 * cam.scale, cy); ctx.lineTo(cx - gap / 2, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - gap / 2, cy - ph / 2); ctx.lineTo(cx - gap / 2, cy + ph / 2); ctx.stroke();
    // Right plate
    ctx.beginPath(); ctx.moveTo(cx + gap / 2, cy - ph / 2); ctx.lineTo(cx + gap / 2, cy + ph / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + gap / 2, cy); ctx.lineTo(sx + sw - 10 * cam.scale, cy); ctx.stroke();
    // Value
    const label = this._uf >= 1000 ? (this._uf / 1000) + 'mF' : this._uf + 'nF';
    ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.fillStyle = '#4488cc'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(label, cx, cy + ph / 2 + 2 * cam.scale);
  }
}

class InductorComponent extends BreadboardComponent {
  constructor(x, y) {
    super('Inductor', x, y, 'IND');
    this.w = 110; this.h = 60;
    this._mh = 10;
    this._prev = 0;
  }
  _initPins() {
    this.pins = [
      _mp('A', 'in',  1, 'left',  0),
      _mp('B', 'out', 1, 'right', 0),
    ];
  }
  _bodyColor()   { return '#0a1020'; }
  _headerColor() { return '#101828'; }
  simulate() {
    // Opposes changes: output = previous value
    const out = this._prev;
    this._prev = this.getPin('A').value;
    this.getPin('B').value = out;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.45) return;
    const cy = sy + sh / 2 + 2 * cam.scale;
    const r = 6 * cam.scale, loops = 4;
    const totalW = loops * 2 * r;
    const startX = sx + sw / 2 - totalW / 2;
    ctx.strokeStyle = '#6688ff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sx + 8 * cam.scale, cy); ctx.lineTo(startX, cy); ctx.stroke();
    for (let i = 0; i < loops; i++) {
      const lx = startX + i * 2 * r + r;
      ctx.beginPath(); ctx.arc(lx, cy, r, Math.PI, 0, false); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(startX + totalW, cy); ctx.lineTo(sx + sw - 8 * cam.scale, cy); ctx.stroke();
    // Value
    ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.fillStyle = '#6688ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(this._mh + 'mH', sx + sw / 2, cy + r + 2 * cam.scale);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  LOGIC GATE BASE — draws a schematic gate symbol
// ═══════════════════════════════════════════════════════════════════

class LogicGateBase extends BreadboardComponent {
  constructor(type, x, y, label, inputs, hasInvert) {
    super(type, x, y, label);
    this._inputs = inputs;
    this._hasInvert = hasInvert;
    this.w = 100;
    this.h = Math.max(60, 12 + inputs * 20);
  }
  _initPins() {
    this.pins = [];
    for (let i = 0; i < this._inputs; i++) {
      this.pins.push(_mp(String.fromCharCode(65 + i), 'in', 1, 'left', i));
    }
    this.pins.push(_mp('Y', 'out', 1, 'right', 0));
  }
  _bodyColor()   { return '#0d1a0d'; }
  _headerColor() { return '#152215'; }

  _getInputBits() {
    const r = [];
    for (let i = 0; i < this._inputs; i++) {
      r.push(this.getPin(String.fromCharCode(65 + i)).value > 0 ? 1 : 0);
    }
    return r;
  }
  _logicResult(bits) { return 0; } // override

  simulate() {
    const bits = this._getInputBits();
    let result = this._logicResult(bits);
    if (this._hasInvert) result = result ? 0 : 1;
    this.getPin('Y').value = result ? 255 : 0;
  }

  render(ctx, cam) {
    const sx = this.x * cam.scale + cam.ox;
    const sy = this.y * cam.scale + cam.oy;
    const sw = this.w * cam.scale;
    const sh = this.h * cam.scale;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur  = 8 * cam.scale;
    ctx.shadowOffsetY = 2 * cam.scale;
    ctx.fillStyle   = this._bodyColor();
    ctx.strokeStyle = this.selected ? '#00ff88' : '#2e3e52';
    ctx.lineWidth   = this.selected ? 2 : 1;
    _rr(ctx, sx, sy, sw, sh, 5 * cam.scale);
    ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();
    // Header
    ctx.fillStyle = this._headerColor();
    ctx.beginPath();
    ctx.moveTo(sx + 5 * cam.scale, sy);
    ctx.lineTo(sx + sw - 5 * cam.scale, sy);
    ctx.quadraticCurveTo(sx + sw, sy, sx + sw, sy + 5 * cam.scale);
    ctx.lineTo(sx + sw, sy + 16 * cam.scale);
    ctx.lineTo(sx, sy + 16 * cam.scale);
    ctx.lineTo(sx, sy + 5 * cam.scale);
    ctx.quadraticCurveTo(sx, sy, sx + 5 * cam.scale, sy);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e8f0f8';
    ctx.font = `bold ${Math.max(7, 9 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.label, sx + sw / 2, sy + 8 * cam.scale);
    ctx.restore();

    ctx.save();
    this._drawGateSymbol(ctx, cam, sx, sy, sw, sh);
    this._renderPins(ctx, cam);
    ctx.restore();
  }

  _drawGateSymbol(ctx, cam, sx, sy, sw, sh) {
    // Subclasses override — draw in center area below header
  }

  _drawValueLabel(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.6) return;
    const yv = this.getPin('Y').value;
    const cx = sx + sw / 2;
    const cy = sy + sh - 10 * cam.scale;
    ctx.font = `bold ${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = yv ? '#00ff88' : '#1a4a2a';
    ctx.fillText('Y=' + (yv ? '1' : '0'), cx, cy);
  }
}

// ─────────────────────────────────────────────────────────────────
//  AND / NAND
// ─────────────────────────────────────────────────────────────────
class ANDGateComponent extends LogicGateBase {
  constructor(x, y) { super('AND', x, y, 'AND', 2, false); }
  _logicResult(bits) { return bits.every(b => b) ? 1 : 0; }
  _drawGateSymbol(ctx, cam, sx, sy, sw, sh) {
    const gx = sx + 18 * cam.scale, gy = sy + 20 * cam.scale;
    const gw = 44 * cam.scale,      gh = sh - 28 * cam.scale;
    const yv = this.getPin('Y').value;
    ctx.strokeStyle = yv ? '#00ff88' : '#2a6a3a';
    ctx.lineWidth   = 1.5 * cam.scale;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + gw * 0.5, gy);
    ctx.arc(gx + gw * 0.5, gy + gh / 2, gh / 2, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(gx, gy + gh);
    ctx.closePath();
    ctx.stroke();
    this._drawValueLabel(ctx, cam, sx, sy, sw, sh);
  }
}

class NANDGateComponent extends LogicGateBase {
  constructor(x, y) { super('NAND', x, y, 'NAND', 2, true); }
  _logicResult(bits) { return bits.every(b => b) ? 1 : 0; }
  _drawGateSymbol(ctx, cam, sx, sy, sw, sh) {
    const gx = sx + 16 * cam.scale, gy = sy + 20 * cam.scale;
    const gw = 40 * cam.scale,      gh = sh - 28 * cam.scale;
    const yv = this.getPin('Y').value;
    ctx.strokeStyle = yv ? '#00ff88' : '#2a6a3a';
    ctx.lineWidth   = 1.5 * cam.scale;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + gw * 0.5, gy);
    ctx.arc(gx + gw * 0.5, gy + gh / 2, gh / 2, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(gx, gy + gh);
    ctx.closePath(); ctx.stroke();
    // Bubble
    const br = 4 * cam.scale;
    ctx.beginPath(); ctx.arc(gx + gw + br, gy + gh / 2, br, 0, Math.PI * 2); ctx.stroke();
    this._drawValueLabel(ctx, cam, sx, sy, sw, sh);
  }
}

// ─────────────────────────────────────────────────────────────────
//  OR / NOR
// ─────────────────────────────────────────────────────────────────
class ORGateComponent extends LogicGateBase {
  constructor(x, y) { super('OR', x, y, 'OR', 2, false); }
  _logicResult(bits) { return bits.some(b => b) ? 1 : 0; }
  _drawGateSymbol(ctx, cam, sx, sy, sw, sh) {
    this._drawORShape(ctx, cam, sx, sy, sw, sh, false, false);
    this._drawValueLabel(ctx, cam, sx, sy, sw, sh);
  }
  _drawORShape(ctx, cam, sx, sy, sw, sh, isXOR, hasInvert) {
    const gx = sx + 16 * cam.scale, gy = sy + 20 * cam.scale;
    const gw = 42 * cam.scale,      gh = sh - 28 * cam.scale;
    const yv = this.getPin('Y').value;
    ctx.strokeStyle = yv ? '#00ff88' : '#2a6a3a';
    ctx.lineWidth   = 1.5 * cam.scale;
    const cp = gh * 0.6;
    if (isXOR) {
      // Extra back curve
      ctx.beginPath();
      ctx.moveTo(gx - 4 * cam.scale, gy);
      ctx.quadraticCurveTo(gx + cp * 0.4 - 4 * cam.scale, gy + gh / 2, gx - 4 * cam.scale, gy + gh);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.quadraticCurveTo(gx + cp * 0.4, gy + gh / 2, gx, gy + gh);
    // Bottom curve to tip
    ctx.quadraticCurveTo(gx + gw * 0.5, gy + gh, gx + gw, gy + gh / 2);
    // Top curve from tip
    ctx.quadraticCurveTo(gx + gw * 0.5, gy, gx, gy);
    ctx.stroke();
    if (hasInvert) {
      const br = 4 * cam.scale;
      ctx.beginPath(); ctx.arc(gx + gw + br, gy + gh / 2, br, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

class NORGateComponent extends LogicGateBase {
  constructor(x, y) { super('NOR', x, y, 'NOR', 2, true); }
  _logicResult(bits) { return bits.some(b => b) ? 1 : 0; }
  _drawGateSymbol(ctx, cam, sx, sy, sw, sh) {
    // Reuse OR shape helper
    const gate = new ORGateComponent(0, 0);
    gate.pins = this.pins; // share pins for color
    gate._drawORShape.call(this, ctx, cam, sx, sy, sw, sh, false, true);
    this._drawValueLabel(ctx, cam, sx, sy, sw, sh);
  }
}

class XORGateComponent extends LogicGateBase {
  constructor(x, y) { super('XOR', x, y, 'XOR', 2, false); }
  _logicResult(bits) { return bits.reduce((a, b) => a ^ b, 0); }
  _drawGateSymbol(ctx, cam, sx, sy, sw, sh) {
    const dummy = new ORGateComponent(0, 0);
    dummy.pins = this.pins;
    dummy._drawORShape.call(this, ctx, cam, sx, sy, sw, sh, true, false);
    this._drawValueLabel(ctx, cam, sx, sy, sw, sh);
  }
}

class XNORGateComponent extends LogicGateBase {
  constructor(x, y) { super('XNOR', x, y, 'XNOR', 2, true); }
  _logicResult(bits) { return bits.reduce((a, b) => a ^ b, 0); }
  _drawGateSymbol(ctx, cam, sx, sy, sw, sh) {
    const dummy = new ORGateComponent(0, 0);
    dummy.pins = this.pins;
    dummy._drawORShape.call(this, ctx, cam, sx, sy, sw, sh, true, true);
    this._drawValueLabel(ctx, cam, sx, sy, sw, sh);
  }
}

// ─────────────────────────────────────────────────────────────────
//  NOT / BUFFER
// ─────────────────────────────────────────────────────────────────
class NOTGateComponent extends LogicGateBase {
  constructor(x, y) { super('NOT', x, y, 'NOT', 1, false); }
  simulate() {
    const a = this.getPin('A').value > 0 ? 0 : 255;
    this.getPin('Y').value = a;
  }
  _drawGateSymbol(ctx, cam, sx, sy, sw, sh) {
    const gx = sx + 18 * cam.scale, gy = sy + 20 * cam.scale;
    const gw = 40 * cam.scale,      gh = sh - 28 * cam.scale;
    const yv = this.getPin('Y').value;
    ctx.strokeStyle = yv ? '#00ff88' : '#2a6a3a';
    ctx.lineWidth   = 1.5 * cam.scale;
    // Triangle
    ctx.beginPath();
    ctx.moveTo(gx, gy); ctx.lineTo(gx + gw - 6 * cam.scale, gy + gh / 2);
    ctx.lineTo(gx, gy + gh); ctx.closePath(); ctx.stroke();
    // Bubble
    const br = 4 * cam.scale;
    ctx.beginPath(); ctx.arc(gx + gw - 6 * cam.scale + br, gy + gh / 2, br, 0, Math.PI * 2); ctx.stroke();
    this._drawValueLabel(ctx, cam, sx, sy, sw, sh);
  }
}

class BufferComponent extends LogicGateBase {
  constructor(x, y) {
    super('Buffer', x, y, 'BUF', 1, false);
    // Add optional tri-state enable
    this.pins.push(_mp('EN', 'in', 1, 'left', 1));
  }
  simulate() {
    const en = this.getPin('EN');
    const enabled = !en._connected || en.value > 0;
    this.getPin('Y').value = enabled ? this.getPin('A').value : 0;
  }
  _drawGateSymbol(ctx, cam, sx, sy, sw, sh) {
    const gx = sx + 18 * cam.scale, gy = sy + 20 * cam.scale;
    const gw = 40 * cam.scale,      gh = sh - 28 * cam.scale;
    const yv = this.getPin('Y').value;
    ctx.strokeStyle = yv ? '#00ff88' : '#2a6a3a';
    ctx.lineWidth   = 1.5 * cam.scale;
    ctx.beginPath();
    ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy + gh / 2);
    ctx.lineTo(gx, gy + gh); ctx.closePath(); ctx.stroke();
    this._drawValueLabel(ctx, cam, sx, sy, sw, sh);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  COMBINATIONAL LOGIC
// ═══════════════════════════════════════════════════════════════════

class HalfAdderComponent extends BreadboardComponent {
  constructor(x, y) {
    super('HalfAdder', x, y, 'HALF ADD');
    this.w = 120; this.h = 80;
  }
  _initPins() {
    this.pins = [
      _mp('A',   'in',  1, 'left',  0),
      _mp('B',   'in',  1, 'left',  1),
      _mp('S',   'out', 1, 'right', 0),
      _mp('C',   'out', 1, 'right', 1),
    ];
  }
  _bodyColor()   { return '#001a1a'; }
  _headerColor() { return '#002828'; }
  simulate() {
    const a = this.getPin('A').value > 0 ? 1 : 0;
    const b = this.getPin('B').value > 0 ? 1 : 0;
    this.getPin('S').value = (a ^ b) ? 255 : 0;
    this.getPin('C').value = (a & b) ? 255 : 0;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#00cccc';
    ctx.fillText('S=A⊕B  C=AB', cx, cy);
  }
}

class FullAdderComponent extends BreadboardComponent {
  constructor(x, y) {
    super('FullAdder', x, y, 'FULL ADD');
    this.w = 130; this.h = 90;
  }
  _initPins() {
    this.pins = [
      _mp('A',   'in',  1, 'left',  0),
      _mp('B',   'in',  1, 'left',  1),
      _mp('Cin', 'in',  1, 'left',  2),
      _mp('S',   'out', 1, 'right', 0),
      _mp('Co',  'out', 1, 'right', 1),
    ];
  }
  _bodyColor()   { return '#001a1a'; }
  _headerColor() { return '#002828'; }
  simulate() {
    const a = this.getPin('A').value > 0 ? 1 : 0;
    const b = this.getPin('B').value > 0 ? 1 : 0;
    const c = this.getPin('Cin').value > 0 ? 1 : 0;
    const sum = a + b + c;
    this.getPin('S').value  = (sum & 1) ? 255 : 0;
    this.getPin('Co').value = (sum >= 2) ? 255 : 0;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const a = this.getPin('A').value > 0 ? 1 : 0;
    const b = this.getPin('B').value > 0 ? 1 : 0;
    const c = this.getPin('Cin').value > 0 ? 1 : 0;
    const sum = a + b + c;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#00cccc';
    ctx.fillText(`${a}+${b}+${c}=${sum}`, cx, cy);
  }
}

class Adder4BitComponent extends BreadboardComponent {
  constructor(x, y) {
    super('Adder4', x, y, '4-BIT ADD');
    this.w = 150; this.h = 160;
  }
  _initPins() {
    this.pins = [
      _mp('A0', 'in',  1, 'left',  0), _mp('A1', 'in', 1, 'left', 1),
      _mp('A2', 'in',  1, 'left',  2), _mp('A3', 'in', 1, 'left', 3),
      _mp('B0', 'in',  1, 'left',  4), _mp('B1', 'in', 1, 'left', 5),
      _mp('B2', 'in',  1, 'left',  6), _mp('B3', 'in', 1, 'left', 7),
      _mp('Ci', 'in',  1, 'left',  8),
      _mp('S0', 'out', 1, 'right', 0), _mp('S1', 'out', 1, 'right', 1),
      _mp('S2', 'out', 1, 'right', 2), _mp('S3', 'out', 1, 'right', 3),
      _mp('Co', 'out', 1, 'right', 4),
    ];
    this.h = 12 + 9 * 16 + 12;
  }
  _bodyColor()   { return '#001a1a'; }
  _headerColor() { return '#002828'; }
  simulate() {
    const a = (this.getPin('A0').value > 0 ? 1 : 0) | ((this.getPin('A1').value > 0 ? 1 : 0) << 1)
            | ((this.getPin('A2').value > 0 ? 1 : 0) << 2) | ((this.getPin('A3').value > 0 ? 1 : 0) << 3);
    const b = (this.getPin('B0').value > 0 ? 1 : 0) | ((this.getPin('B1').value > 0 ? 1 : 0) << 1)
            | ((this.getPin('B2').value > 0 ? 1 : 0) << 2) | ((this.getPin('B3').value > 0 ? 1 : 0) << 3);
    const ci = this.getPin('Ci').value > 0 ? 1 : 0;
    const sum = a + b + ci;
    for (let i = 0; i < 4; i++) this.getPin('S' + i).value = ((sum >> i) & 1) ? 255 : 0;
    this.getPin('Co').value = sum > 15 ? 255 : 0;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2;
    ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#00cccc';
    ctx.fillText('74LS283', cx, cy);
  }
}

class Decoder2to4Component extends BreadboardComponent {
  constructor(x, y) {
    super('Dec2to4', x, y, 'DEC 2:4');
    this.w = 130; this.h = 110;
  }
  _initPins() {
    this.pins = [
      _mp('S0', 'in',  1, 'left',  0),
      _mp('S1', 'in',  1, 'left',  1),
      _mp('EN', 'in',  1, 'left',  2),
      _mp('Y0', 'out', 1, 'right', 0),
      _mp('Y1', 'out', 1, 'right', 1),
      _mp('Y2', 'out', 1, 'right', 2),
      _mp('Y3', 'out', 1, 'right', 3),
    ];
  }
  _bodyColor()   { return '#0d0d2a'; }
  _headerColor() { return '#181840'; }
  simulate() {
    const en = this.getPin('EN');
    const enabled = !en._connected || en.value > 0;
    const sel = (this.getPin('S0').value > 0 ? 1 : 0) | ((this.getPin('S1').value > 0 ? 1 : 0) << 1);
    for (let i = 0; i < 4; i++) {
      this.getPin('Y' + i).value = (enabled && i === sel) ? 255 : 0;
    }
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8888ff';
    ctx.fillText('2→4 DEC', cx, cy);
  }
}

class Decoder3to8Component extends BreadboardComponent {
  constructor(x, y) {
    super('Dec3to8', x, y, 'DEC 3:8');
    this.w = 140; this.h = 200;
  }
  _initPins() {
    this.pins = [
      _mp('S0', 'in',  1, 'left',  0),
      _mp('S1', 'in',  1, 'left',  1),
      _mp('S2', 'in',  1, 'left',  2),
      _mp('EN', 'in',  1, 'left',  3),
      _mp('Y0', 'out', 1, 'right', 0), _mp('Y1', 'out', 1, 'right', 1),
      _mp('Y2', 'out', 1, 'right', 2), _mp('Y3', 'out', 1, 'right', 3),
      _mp('Y4', 'out', 1, 'right', 4), _mp('Y5', 'out', 1, 'right', 5),
      _mp('Y6', 'out', 1, 'right', 6), _mp('Y7', 'out', 1, 'right', 7),
    ];
    this.h = 12 + 8 * 16 + 12;
  }
  _bodyColor()   { return '#0d0d2a'; }
  _headerColor() { return '#181840'; }
  simulate() {
    const en = this.getPin('EN');
    const enabled = !en._connected || en.value > 0;
    const sel = (this.getPin('S0').value > 0 ? 1 : 0)
              | ((this.getPin('S1').value > 0 ? 1 : 0) << 1)
              | ((this.getPin('S2').value > 0 ? 1 : 0) << 2);
    for (let i = 0; i < 8; i++) {
      this.getPin('Y' + i).value = (enabled && i === sel) ? 255 : 0;
    }
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2;
    ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8888ff';
    ctx.fillText('74LS138', cx, cy);
  }
}

class Encoder8to3Component extends BreadboardComponent {
  constructor(x, y) {
    super('Enc8to3', x, y, 'ENC 8:3');
    this.w = 140; this.h = 160;
  }
  _initPins() {
    this.pins = [
      _mp('I0', 'in', 1, 'left', 0), _mp('I1', 'in', 1, 'left', 1),
      _mp('I2', 'in', 1, 'left', 2), _mp('I3', 'in', 1, 'left', 3),
      _mp('I4', 'in', 1, 'left', 4), _mp('I5', 'in', 1, 'left', 5),
      _mp('I6', 'in', 1, 'left', 6), _mp('I7', 'in', 1, 'left', 7),
      _mp('A0', 'out', 1, 'right', 0),
      _mp('A1', 'out', 1, 'right', 1),
      _mp('A2', 'out', 1, 'right', 2),
      _mp('V',  'out', 1, 'right', 3),
    ];
    this.h = 12 + 8 * 16 + 12;
  }
  _bodyColor()   { return '#0d0d2a'; }
  _headerColor() { return '#181840'; }
  simulate() {
    let code = -1;
    for (let i = 7; i >= 0; i--) {
      if (this.getPin('I' + i).value > 0) { code = i; break; }
    }
    const valid = code >= 0;
    this.getPin('A0').value = (valid && (code & 1)) ? 255 : 0;
    this.getPin('A1').value = (valid && (code & 2)) ? 255 : 0;
    this.getPin('A2').value = (valid && (code & 4)) ? 255 : 0;
    this.getPin('V').value  = valid ? 255 : 0;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2;
    ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8888ff';
    ctx.fillText('8→3 ENC', cx, cy);
  }
}

class PriorityEncoderComponent extends BreadboardComponent {
  constructor(x, y) {
    super('PriEnc', x, y, 'PRI ENC');
    this.w = 140; this.h = 160;
  }
  _initPins() {
    this.pins = [
      _mp('I0', 'in', 1, 'left', 0), _mp('I1', 'in', 1, 'left', 1),
      _mp('I2', 'in', 1, 'left', 2), _mp('I3', 'in', 1, 'left', 3),
      _mp('I4', 'in', 1, 'left', 4), _mp('I5', 'in', 1, 'left', 5),
      _mp('I6', 'in', 1, 'left', 6), _mp('I7', 'in', 1, 'left', 7),
      _mp('A0', 'out', 1, 'right', 0),
      _mp('A1', 'out', 1, 'right', 1),
      _mp('A2', 'out', 1, 'right', 2),
      _mp('V',  'out', 1, 'right', 3),
    ];
    this.h = 12 + 8 * 16 + 12;
  }
  _bodyColor()   { return '#0d0d2a'; }
  _headerColor() { return '#181840'; }
  simulate() {
    // Highest active input wins (priority = I7 > I6 > ... > I0)
    let code = -1;
    for (let i = 7; i >= 0; i--) {
      if (this.getPin('I' + i).value > 0) { code = i; break; }
    }
    const valid = code >= 0;
    this.getPin('A0').value = (valid && (code & 1)) ? 255 : 0;
    this.getPin('A1').value = (valid && (code & 2)) ? 255 : 0;
    this.getPin('A2').value = (valid && (code & 4)) ? 255 : 0;
    this.getPin('V').value  = valid ? 255 : 0;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2;
    ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8888ff';
    ctx.fillText('PRI ENC', cx, cy);
  }
}

class Mux2to1Component extends BreadboardComponent {
  constructor(x, y) {
    super('Mux2to1', x, y, 'MUX 2:1');
    this.w = 120; this.h = 80;
  }
  _initPins() {
    this.pins = [
      _mp('D0', 'in',  1, 'left',  0),
      _mp('D1', 'in',  1, 'left',  1),
      _mp('S',  'in',  1, 'left',  2),
      _mp('Y',  'out', 1, 'right', 0),
    ];
  }
  _bodyColor()   { return '#1a0d2a'; }
  _headerColor() { return '#281840'; }
  simulate() {
    const s = this.getPin('S').value > 0 ? 1 : 0;
    this.getPin('Y').value = s ? this.getPin('D1').value : this.getPin('D0').value;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#aa66ff';
    ctx.fillText('S→Y', cx, cy);
  }
}

class Mux4to1Component extends BreadboardComponent {
  constructor(x, y) {
    super('Mux4to1', x, y, 'MUX 4:1');
    this.w = 130; this.h = 110;
  }
  _initPins() {
    this.pins = [
      _mp('D0', 'in',  1, 'left',  0), _mp('D1', 'in', 1, 'left', 1),
      _mp('D2', 'in',  1, 'left',  2), _mp('D3', 'in', 1, 'left', 3),
      _mp('S0', 'in',  1, 'left',  4), _mp('S1', 'in', 1, 'left', 5),
      _mp('Y',  'out', 1, 'right', 0),
    ];
  }
  _bodyColor()   { return '#1a0d2a'; }
  _headerColor() { return '#281840'; }
  simulate() {
    const s = (this.getPin('S0').value > 0 ? 1 : 0) | ((this.getPin('S1').value > 0 ? 1 : 0) << 1);
    this.getPin('Y').value = this.getPin('D' + s).value;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#aa66ff';
    ctx.fillText('4:1 MUX', cx, cy);
  }
}

class Mux8to1Component extends BreadboardComponent {
  constructor(x, y) {
    super('Mux8to1', x, y, 'MUX 8:1');
    this.w = 140; this.h = 200;
  }
  _initPins() {
    this.pins = [
      _mp('D0','in',1,'left',0), _mp('D1','in',1,'left',1),
      _mp('D2','in',1,'left',2), _mp('D3','in',1,'left',3),
      _mp('D4','in',1,'left',4), _mp('D5','in',1,'left',5),
      _mp('D6','in',1,'left',6), _mp('D7','in',1,'left',7),
      _mp('S0','in',1,'left',8), _mp('S1','in',1,'left',9), _mp('S2','in',1,'left',10),
      _mp('Y', 'out',1,'right',0),
    ];
    this.h = 12 + 11 * 16 + 12;
  }
  _bodyColor()   { return '#1a0d2a'; }
  _headerColor() { return '#281840'; }
  simulate() {
    const s = (this.getPin('S0').value > 0 ? 1 : 0)
            | ((this.getPin('S1').value > 0 ? 1 : 0) << 1)
            | ((this.getPin('S2').value > 0 ? 1 : 0) << 2);
    this.getPin('Y').value = this.getPin('D' + s).value;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2;
    ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#aa66ff';
    ctx.fillText('8:1 MUX', cx, cy);
  }
}

class Demux1to2Component extends BreadboardComponent {
  constructor(x, y) {
    super('Demux1to2', x, y, 'DEMUX 1:2');
    this.w = 120; this.h = 80;
  }
  _initPins() {
    this.pins = [
      _mp('D',  'in',  1, 'left',  0),
      _mp('S',  'in',  1, 'left',  1),
      _mp('Y0', 'out', 1, 'right', 0),
      _mp('Y1', 'out', 1, 'right', 1),
    ];
  }
  _bodyColor()   { return '#1a0d2a'; }
  _headerColor() { return '#281840'; }
  simulate() {
    const d = this.getPin('D').value;
    const s = this.getPin('S').value > 0 ? 1 : 0;
    this.getPin('Y0').value = s === 0 ? d : 0;
    this.getPin('Y1').value = s === 1 ? d : 0;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#aa66ff'; ctx.fillText('1:2', cx, cy);
  }
}

class Demux1to4Component extends BreadboardComponent {
  constructor(x, y) {
    super('Demux1to4', x, y, 'DEMUX 1:4');
    this.w = 130; this.h = 110;
  }
  _initPins() {
    this.pins = [
      _mp('D',  'in',  1, 'left',  0),
      _mp('S0', 'in',  1, 'left',  1),
      _mp('S1', 'in',  1, 'left',  2),
      _mp('Y0', 'out', 1, 'right', 0), _mp('Y1', 'out', 1, 'right', 1),
      _mp('Y2', 'out', 1, 'right', 2), _mp('Y3', 'out', 1, 'right', 3),
    ];
  }
  _bodyColor()   { return '#1a0d2a'; }
  _headerColor() { return '#281840'; }
  simulate() {
    const d = this.getPin('D').value;
    const s = (this.getPin('S0').value > 0 ? 1 : 0) | ((this.getPin('S1').value > 0 ? 1 : 0) << 1);
    for (let i = 0; i < 4; i++) this.getPin('Y' + i).value = (i === s) ? d : 0;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#aa66ff'; ctx.fillText('1:4', cx, cy);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SEQUENTIAL LOGIC
// ═══════════════════════════════════════════════════════════════════

class SRLatchComponent extends BreadboardComponent {
  constructor(x, y) {
    super('SRLatch', x, y, 'SR LATCH');
    this.w = 120; this.h = 90;
    this._q = 0;
  }
  _initPins() {
    this.pins = [
      _mp('S',  'in',  1, 'left',  0),
      _mp('R',  'in',  1, 'left',  1),
      _mp('Q',  'out', 1, 'right', 0),
      _mp('Qb', 'out', 1, 'right', 1),
    ];
  }
  _bodyColor()   { return '#1a1a00'; }
  _headerColor() { return '#2a2a00'; }
  simulate() {
    const s = this.getPin('S').value > 0 ? 1 : 0;
    const r = this.getPin('R').value > 0 ? 1 : 0;
    if (s && !r)      this._q = 1;
    else if (!s && r) this._q = 0;
    // s && r = invalid (hold both high — undefined behavior, keep state)
    this.getPin('Q').value  = this._q ? 255 : 0;
    this.getPin('Qb').value = this._q ? 0 : 255;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    ctx.font = `bold ${Math.max(9, 11 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = this._q ? '#ffff00' : '#4a4a00';
    ctx.fillText('Q=' + this._q, cx, cy);
  }
}

class DFlipFlopComponent extends BreadboardComponent {
  constructor(x, y) {
    super('DFF', x, y, 'D FF');
    this.w = 120; this.h = 100;
    this._q = 0;
    this._prevClk = 0;
  }
  _initPins() {
    this.pins = [
      _mp('D',   'in',  1, 'left',  0),
      _mp('CLK', 'in',  1, 'left',  1),
      _mp('Q',   'out', 1, 'right', 0),
      _mp('Qb',  'out', 1, 'right', 1),
    ];
  }
  _bodyColor()   { return '#001a1a'; }
  _headerColor() { return '#002828'; }
  simulate(risingEdge) {
    const clk = this.getPin('CLK').value > 0 ? 1 : 0;
    if (risingEdge && clk && !this._prevClk) {
      this._q = this.getPin('D').value > 0 ? 1 : 0;
    }
    this._prevClk = clk;
    this.getPin('Q').value  = this._q ? 255 : 0;
    this.getPin('Qb').value = this._q ? 0 : 255;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    ctx.font = `bold ${Math.max(9, 11 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = this._q ? '#00ffff' : '#004444';
    ctx.fillText('Q=' + this._q, cx, cy);
    // Clock triangle symbol
    ctx.strokeStyle = '#336666'; ctx.lineWidth = 1;
    const tx = sx + 18 * cam.scale, ty = sy + sh / 2 + 18 * cam.scale;
    ctx.beginPath();
    ctx.moveTo(tx, ty - 4 * cam.scale);
    ctx.lineTo(tx + 6 * cam.scale, ty);
    ctx.lineTo(tx, ty + 4 * cam.scale);
    ctx.stroke();
  }
}

class JKFlipFlopComponent extends BreadboardComponent {
  constructor(x, y) {
    super('JKFF', x, y, 'JK FF');
    this.w = 120; this.h = 100;
    this._q = 0;
    this._prevClk = 0;
  }
  _initPins() {
    this.pins = [
      _mp('J',   'in',  1, 'left',  0),
      _mp('K',   'in',  1, 'left',  1),
      _mp('CLK', 'in',  1, 'left',  2),
      _mp('Q',   'out', 1, 'right', 0),
      _mp('Qb',  'out', 1, 'right', 1),
    ];
  }
  _bodyColor()   { return '#001a1a'; }
  _headerColor() { return '#002828'; }
  simulate(risingEdge) {
    const clk = this.getPin('CLK').value > 0 ? 1 : 0;
    if (risingEdge && clk && !this._prevClk) {
      const j = this.getPin('J').value > 0 ? 1 : 0;
      const k = this.getPin('K').value > 0 ? 1 : 0;
      if (j && k)       this._q = 1 - this._q;  // toggle
      else if (j && !k) this._q = 1;
      else if (!j && k) this._q = 0;
      // !j && !k = hold
    }
    this._prevClk = clk;
    this.getPin('Q').value  = this._q ? 255 : 0;
    this.getPin('Qb').value = this._q ? 0 : 255;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    ctx.font = `bold ${Math.max(9, 11 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = this._q ? '#00ffff' : '#004444';
    ctx.fillText('Q=' + this._q, cx, cy);
  }
}

class TFlipFlopComponent extends BreadboardComponent {
  constructor(x, y) {
    super('TFF', x, y, 'T FF');
    this.w = 110; this.h = 90;
    this._q = 0;
    this._prevClk = 0;
  }
  _initPins() {
    this.pins = [
      _mp('T',   'in',  1, 'left',  0),
      _mp('CLK', 'in',  1, 'left',  1),
      _mp('Q',   'out', 1, 'right', 0),
      _mp('Qb',  'out', 1, 'right', 1),
    ];
  }
  _bodyColor()   { return '#001a1a'; }
  _headerColor() { return '#002828'; }
  simulate(risingEdge) {
    const clk = this.getPin('CLK').value > 0 ? 1 : 0;
    if (risingEdge && clk && !this._prevClk) {
      if (this.getPin('T').value > 0) this._q = 1 - this._q;
    }
    this._prevClk = clk;
    this.getPin('Q').value  = this._q ? 255 : 0;
    this.getPin('Qb').value = this._q ? 0 : 255;
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    ctx.font = `bold ${Math.max(9, 11 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = this._q ? '#00ffff' : '#004444';
    ctx.fillText('Q=' + this._q, cx, cy);
  }
}

class Counter4BitComponent extends BreadboardComponent {
  constructor(x, y) {
    super('Counter4', x, y, '4-BIT CTR');
    this.w = 140; this.h = 110;
    this._count = 0;
    this._prevClk = 0;
  }
  _initPins() {
    this.pins = [
      _mp('CLK',  'in',  1, 'left',  0),
      _mp('RST',  'in',  1, 'left',  1),
      _mp('EN',   'in',  1, 'left',  2),
      _mp('Q0',   'out', 1, 'right', 0),
      _mp('Q1',   'out', 1, 'right', 1),
      _mp('Q2',   'out', 1, 'right', 2),
      _mp('Q3',   'out', 1, 'right', 3),
    ];
  }
  _bodyColor()   { return '#0d1e40'; }
  _headerColor() { return '#142060'; }
  simulate(risingEdge) {
    const clk = this.getPin('CLK').value > 0 ? 1 : 0;
    if (this.getPin('RST').value > 0) { this._count = 0; }
    else if (risingEdge && clk && !this._prevClk && this.getPin('EN').value > 0) {
      this._count = (this._count + 1) & 0xF;
    }
    this._prevClk = clk;
    for (let i = 0; i < 4; i++) {
      this.getPin('Q' + i).value = ((this._count >> i) & 1) ? 255 : 0;
    }
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    ctx.font = `bold ${Math.max(10, 13 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#4488ff';
    ctx.fillText(this._count.toString(2).padStart(4, '0'), cx, cy);
    ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.fillStyle = '#2a4a88';
    ctx.fillText('= ' + this._count, cx, cy + 12 * cam.scale);
  }
}

class ShiftRegister8Component extends BreadboardComponent {
  constructor(x, y) {
    super('ShiftReg', x, y, '8-BIT SR');
    this.w = 150; this.h = 160;
    this._bits = 0;
    this._prevClk = 0;
  }
  _initPins() {
    this.pins = [
      _mp('SI',  'in',  1, 'left',  0),
      _mp('CLK', 'in',  1, 'left',  1),
      _mp('RST', 'in',  1, 'left',  2),
      _mp('Q0',  'out', 1, 'right', 0), _mp('Q1', 'out', 1, 'right', 1),
      _mp('Q2',  'out', 1, 'right', 2), _mp('Q3', 'out', 1, 'right', 3),
      _mp('Q4',  'out', 1, 'right', 4), _mp('Q5', 'out', 1, 'right', 5),
      _mp('Q6',  'out', 1, 'right', 6), _mp('Q7', 'out', 1, 'right', 7),
    ];
    this.h = 12 + 8 * 16 + 12;
  }
  _bodyColor()   { return '#0d1e40'; }
  _headerColor() { return '#142060'; }
  simulate(risingEdge) {
    if (this.getPin('RST').value > 0) { this._bits = 0; }
    const clk = this.getPin('CLK').value > 0 ? 1 : 0;
    if (risingEdge && clk && !this._prevClk) {
      const si = this.getPin('SI').value > 0 ? 1 : 0;
      this._bits = ((this._bits << 1) | si) & 0xFF;
    }
    this._prevClk = clk;
    for (let i = 0; i < 8; i++) {
      this.getPin('Q' + i).value = ((this._bits >> (7 - i)) & 1) ? 255 : 0;
    }
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.5) return;
    const cx = sx + sw / 2, cy = sy + sh / 2;
    ctx.font = `bold ${Math.max(9, 10 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#4488ff';
    ctx.fillText(this._bits.toString(2).padStart(8, '0'), cx, cy);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SEMICONDUCTORS
// ═══════════════════════════════════════════════════════════════════

// ─── Schematic symbol rendering helpers ─────────────────────────────────────

function _drawDiodeSymbol(ctx, cam, sx, sy, sw, sh, lit, color) {
  const cx = sx + sw / 2, cy = sy + sh / 2 + 4 * cam.scale;
  const r  = 8 * cam.scale;
  ctx.strokeStyle = lit ? color : '#336633';
  ctx.lineWidth   = 1.5 * cam.scale;
  // Triangle
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r * 0.7);
  ctx.lineTo(cx + r * 0.4, cy);
  ctx.lineTo(cx - r, cy + r * 0.7);
  ctx.closePath(); ctx.stroke();
  // Cathode bar
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.4, cy - r * 0.7);
  ctx.lineTo(cx + r * 0.4, cy + r * 0.7);
  ctx.stroke();
  // Leads
  ctx.beginPath();
  ctx.moveTo(sx + 6 * cam.scale, cy); ctx.lineTo(cx - r, cy);
  ctx.moveTo(cx + r * 0.4, cy);      ctx.lineTo(sx + sw - 6 * cam.scale, cy);
  ctx.stroke();
}

class DiodeComponent extends BreadboardComponent {
  constructor(x, y) {
    super('Diode', x, y, 'DIODE');
    this.w = 100; this.h = 60;
    this._vForward = 18;  // ~0.35V forward voltage drop (18/255 * 5V ≈ 0.35V for Si)
  }
  _initPins() {
    this.pins = [
      _mp('A', 'in',  1, 'left',  0),
      _mp('K', 'out', 1, 'right', 0),
    ];
  }
  _bodyColor()   { return '#0a1a0a'; }
  _headerColor() { return '#102010'; }
  simulate() {
    const anode = this.getPin('A').value;
    // Forward biased: anode must exceed forward voltage drop
    // Output = anode voltage minus diode drop (clamped to 0)
    if (anode > this._vForward) {
      this.getPin('K').value = Math.max(0, anode - this._vForward);
    } else {
      // Reverse biased or below threshold: no conduction
      this.getPin('K').value = 0;
    }
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.45) return;
    const lit = this.getPin('K').value > 0;
    _drawDiodeSymbol(ctx, cam, sx, sy, sw, sh, lit, '#44ff44');
    // Show voltage drop
    if (cam.scale >= 0.6) {
      const cx = sx + sw / 2, bot = sy + sh - 8 * cam.scale;
      ctx.font = `${Math.max(7, 7 * cam.scale)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = lit ? '#66ff66' : '#334433';
      const vDrop = (this._vForward / 255 * 5).toFixed(1);
      ctx.fillText('Vf=' + vDrop + 'V', cx, bot);
    }
  }
}

class LEDComponent extends BreadboardComponent {
  constructor(x, y) {
    super('LED', x, y, 'LED');
    this.w = 90; this.h = 70;
    this._color = 'red';
    this._vForward = 36;   // ~0.7V for red LED (36/255 * 5V ≈ 0.7V), real LEDs: 1.8-3.3V
    this._maxCurrent = 20; // mA typical
  }
  _initPins() {
    this.pins = [
      _mp('A', 'in',  1, 'left',  0),  // Anode (+ longer leg)
      _mp('K', 'out', 1, 'right', 0),  // Cathode (- shorter leg, must go to GND/lower)
    ];
  }
  _bodyColor()   { return '#1a0808'; }
  _headerColor() { return '#280e0e'; }
  simulate() {
    const anode = this.getPin('A').value;
    // LED requires forward voltage; brightness proportional to current above Vf
    if (anode > this._vForward) {
      // Current flows; cathode outputs reduced voltage
      this.getPin('K').value = Math.max(0, anode - this._vForward);
    } else {
      this.getPin('K').value = 0;
    }
    // Brightness 0-1 for rendering
    this._brightness = anode > this._vForward
      ? Math.min(1, (anode - this._vForward) / (255 - this._vForward))
      : 0;
  }
  _ledRgb() {
    switch (this._color) {
      case 'red':    return { r: 255, g: 40,  b: 40  };
      case 'green':  return { r: 40,  g: 255, b: 40  };
      case 'blue':   return { r: 40,  g: 100, b: 255 };
      case 'yellow': return { r: 255, g: 220, b: 0   };
      case 'white':  return { r: 220, g: 220, b: 255 };
      default:       return { r: 255, g: 40,  b: 40  };
    }
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.3) return;
    const b   = this._brightness || 0;
    const lit = b > 0;
    const cx  = sx + sw / 2, cy = sy + sh / 2 + 6 * cam.scale;
    const cr  = 12 * cam.scale;
    const rgb = this._ledRgb();
    const col = `rgb(${Math.floor(rgb.r * b)},${Math.floor(rgb.g * b)},${Math.floor(rgb.b * b)})`;
    const colFull = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
    const dim = `rgb(${Math.floor(rgb.r * 0.15)},${Math.floor(rgb.g * 0.15)},${Math.floor(rgb.b * 0.15)})`;

    ctx.save();
    if (lit) {
      ctx.shadowColor = colFull;
      ctx.shadowBlur  = 18 * cam.scale * b;
    }
    // LED circle — brightness affects gradient
    const grad = ctx.createRadialGradient(cx - cr * 0.25, cy - cr * 0.25, 0, cx, cy, cr);
    grad.addColorStop(0, lit ? `rgba(255,255,255,${b})` : '#2a2a2a');
    grad.addColorStop(0.3, lit ? col : dim);
    grad.addColorStop(1, lit ? `rgb(${Math.floor(rgb.r*0.6*b)},${Math.floor(rgb.g*0.6*b)},${Math.floor(rgb.b*0.6*b)})` : '#111');
    ctx.fillStyle   = grad;
    ctx.strokeStyle = lit ? col : '#333';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // Light ray lines when lit
    if (lit && cam.scale >= 0.6) {
      ctx.save();
      ctx.strokeStyle = colFull; ctx.lineWidth = 1; ctx.globalAlpha = 0.4 * b;
      for (let a = 0; a < 4; a++) {
        const angle = -Math.PI / 6 + a * Math.PI / 8;
        const rayLen = 6 * cam.scale * b;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * cr, cy + Math.sin(angle) * cr);
        ctx.lineTo(cx + Math.cos(angle) * (cr + rayLen), cy + Math.sin(angle) * (cr + rayLen));
        ctx.stroke();
      }
      ctx.restore();
    }
    // Show voltage info
    if (cam.scale >= 0.65) {
      const aV = (this.getPin('A').value / 255 * 5).toFixed(1);
      ctx.font = `${Math.max(6, 7 * cam.scale)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = lit ? colFull : '#333';
      ctx.fillText(lit ? aV + 'V' : 'OFF', cx, sy + sh - 10 * cam.scale);
    }
  }
}

// ─── BJT Transistors ─────────────────────────────────────────────────────────

class NPNTransistorComponent extends BreadboardComponent {
  constructor(x, y) {
    super('NPN', x, y, 'NPN BJT');
    this.w = 110; this.h = 100;
    // Electronics parameters (scaled to 0-255 ≈ 0-5V)
    this._vbe = 15;    // ~0.3V Base-Emitter forward voltage (15/255*5 ≈ 0.3V)
    this._hfe = 100;   // Current gain (beta)
    this._vcesat = 5;  // ~0.1V Collector-Emitter saturation voltage
    this._region = 'cutoff'; // cutoff, active, saturation
  }
  _initPins() {
    this.pins = [
      _mp('B', 'in',  1, 'left',   0),  // Base — control input
      _mp('C', 'in',  1, 'top',    0),  // Collector — high voltage in (from VCC through load)
      _mp('E', 'out', 1, 'bottom', 0),  // Emitter — output (to GND or next stage)
    ];
  }
  _bodyColor()   { return '#1a0a00'; }
  _headerColor() { return '#281500'; }
  simulate() {
    const vb = this.getPin('B').value;  // Base voltage
    const vc = this.getPin('C').value;  // Collector voltage (from supply through load)
    const ve = this.getPin('E').value;  // Emitter (feedback from what it's connected to)

    // NPN rules:
    // 1. Base-Emitter junction must be forward biased (Vb > Ve + Vbe)
    // 2. Current flows Collector → Emitter when on
    // 3. Ic = hFE × Ib (in active region)
    // 4. In saturation: Vce ≈ Vcesat, transistor fully on

    const vbe = vb - ve;

    if (vbe < this._vbe) {
      // CUTOFF: Base-Emitter not forward biased, no current flows
      this._region = 'cutoff';
      this.getPin('E').value = 0;
    } else {
      // Base-Emitter junction is forward biased
      // Base current proportional to (Vbe - threshold)
      const ib = (vbe - this._vbe) / 255;
      // Collector current = hFE × Ib (clamped by available collector voltage)
      const ic = Math.min(ib * this._hfe, 1.0);
      const vce = vc * (1 - ic);

      if (vce <= this._vcesat) {
        // SATURATION: transistor fully on, acts like closed switch
        // Emitter ≈ Collector - Vcesat
        this._region = 'saturation';
        this.getPin('E').value = Math.max(0, vc - this._vcesat);
      } else {
        // ACTIVE: linear region, current controlled by base
        this._region = 'active';
        this.getPin('E').value = Math.max(0, Math.min(255, Math.floor(vc * ic)));
      }
    }
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 2 * cam.scale;
    const r  = 16 * cam.scale;
    const on = this._region !== 'cutoff';
    ctx.strokeStyle = on ? '#ff8800' : '#663300'; ctx.lineWidth = 1.5 * cam.scale;
    // Circle
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    // Base line (vertical bar)
    ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy - r * 0.4); ctx.lineTo(cx - r * 0.6, cy + r * 0.4); ctx.stroke();
    // Collector line (up-right from base bar)
    ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy - r * 0.2); ctx.lineTo(cx + r * 0.4, cy - r * 0.7); ctx.stroke();
    // Emitter line (down-right from base bar)
    ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy + r * 0.2); ctx.lineTo(cx + r * 0.4, cy + r * 0.7); ctx.stroke();
    // NPN arrow on emitter (pointing outward = conventional current out)
    const ex = cx + r * 0.4, ey = cy + r * 0.7;
    ctx.beginPath();
    ctx.moveTo(ex - 4 * cam.scale, ey - 3 * cam.scale); ctx.lineTo(ex, ey); ctx.lineTo(ex - 3 * cam.scale, ey - 6 * cam.scale);
    ctx.stroke();
    // Region + voltages
    if (cam.scale >= 0.55) {
      const vb = (this.getPin('B').value / 255 * 5).toFixed(1);
      const vc = (this.getPin('C').value / 255 * 5).toFixed(1);
      const ve = (this.getPin('E').value / 255 * 5).toFixed(1);
      const colors = { cutoff: '#663300', active: '#ffaa44', saturation: '#ff8800' };
      ctx.fillStyle = colors[this._region];
      ctx.font = `bold ${Math.max(7, 8 * cam.scale)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(this._region.toUpperCase(), cx, sy + sh - 22 * cam.scale);
      ctx.font = `${Math.max(6, 7 * cam.scale)}px monospace`;
      ctx.fillStyle = '#aa8844';
      ctx.fillText('B=' + vb + ' C=' + vc + ' E=' + ve, cx, sy + sh - 12 * cam.scale);
    }
  }
}

class PNPTransistorComponent extends BreadboardComponent {
  constructor(x, y) {
    super('PNP', x, y, 'PNP BJT');
    this.w = 110; this.h = 100;
    this._veb = 15;    // ~0.3V Emitter-Base forward voltage
    this._hfe = 100;
    this._vcesat = 5;
    this._region = 'cutoff';
  }
  _initPins() {
    this.pins = [
      _mp('B', 'in',  1, 'left',   0),  // Base — control (must be LOWER than emitter to turn on)
      _mp('E', 'in',  1, 'top',    0),  // Emitter — high voltage in (from VCC)
      _mp('C', 'out', 1, 'bottom', 0),  // Collector — output (to load then GND)
    ];
  }
  _bodyColor()   { return '#1a0a00'; }
  _headerColor() { return '#281500'; }
  simulate() {
    const vb = this.getPin('B').value;
    const ve = this.getPin('E').value;

    // PNP rules (mirror of NPN):
    // 1. Emitter-Base junction must be forward biased (Ve > Vb + Veb)
    // 2. Current flows Emitter → Collector when on
    // 3. Turns ON when base is pulled LOW relative to emitter

    const veb = ve - vb;

    if (veb < this._veb) {
      // CUTOFF: not enough Veb, no current
      this._region = 'cutoff';
      this.getPin('C').value = 0;
    } else {
      const ib = (veb - this._veb) / 255;
      const ic = Math.min(ib * this._hfe, 1.0);
      const vec = ve * (1 - ic);

      if (vec <= this._vcesat) {
        this._region = 'saturation';
        this.getPin('C').value = Math.max(0, ve - this._vcesat);
      } else {
        this._region = 'active';
        this.getPin('C').value = Math.max(0, Math.min(255, Math.floor(ve * ic)));
      }
    }
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 2 * cam.scale;
    const r  = 16 * cam.scale;
    const on = this._region !== 'cutoff';
    ctx.strokeStyle = on ? '#ff8800' : '#663300'; ctx.lineWidth = 1.5 * cam.scale;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy - r * 0.4); ctx.lineTo(cx - r * 0.6, cy + r * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy - r * 0.2); ctx.lineTo(cx + r * 0.4, cy - r * 0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy + r * 0.2); ctx.lineTo(cx + r * 0.4, cy + r * 0.7); ctx.stroke();
    // PNP arrow on emitter (pointing inward = conventional current in)
    const emx = cx - r * 0.6 + 4 * cam.scale, emy = cy - r * 0.2;
    ctx.beginPath();
    ctx.moveTo(emx + 3 * cam.scale, emy - 4 * cam.scale); ctx.lineTo(emx, emy); ctx.lineTo(emx + 5 * cam.scale, emy + 2 * cam.scale);
    ctx.stroke();
    if (cam.scale >= 0.55) {
      const vb = (this.getPin('B').value / 255 * 5).toFixed(1);
      const ve = (this.getPin('E').value / 255 * 5).toFixed(1);
      const vcol = (this.getPin('C').value / 255 * 5).toFixed(1);
      const colors = { cutoff: '#663300', active: '#ffaa44', saturation: '#ff8800' };
      ctx.fillStyle = colors[this._region];
      ctx.font = `bold ${Math.max(7, 8 * cam.scale)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(this._region.toUpperCase(), cx, sy + sh - 22 * cam.scale);
      ctx.font = `${Math.max(6, 7 * cam.scale)}px monospace`;
      ctx.fillStyle = '#aa8844';
      ctx.fillText('E=' + ve + ' B=' + vb + ' C=' + vcol, cx, sy + sh - 12 * cam.scale);
    }
  }
}

// ─── MOSFETs ─────────────────────────────────────────────────────────────────

class NMOSFETComponent extends BreadboardComponent {
  constructor(x, y) {
    super('NMOS', x, y, 'N-MOSFET');
    this.w = 110; this.h = 110;
    // Electronics parameters
    this._vth = 51;     // ~1.0V Gate threshold voltage (51/255*5 ≈ 1V, real: 1-4V)
    this._rdsOn = 0.02; // On-resistance ratio (low = good switch)
    this._region = 'cutoff'; // cutoff, linear (triode), saturation
  }
  _initPins() {
    this.pins = [
      _mp('G', 'in',  1, 'left',   0),  // Gate — voltage-controlled input (no current flows in!)
      _mp('D', 'in',  1, 'top',    0),  // Drain — high voltage side
      _mp('S', 'out', 1, 'bottom', 0),  // Source — low voltage side (to GND)
    ];
  }
  _bodyColor()   { return '#0a001a'; }
  _headerColor() { return '#140028'; }
  simulate() {
    const vg = this.getPin('G').value;
    const vd = this.getPin('D').value;
    const vs = 0; // Source referenced to ground in typical N-MOS circuit

    // N-MOSFET rules:
    // 1. Gate is ISOLATED (no current flows into gate — this is key difference from BJT)
    // 2. Turns ON when Vgs > Vth (gate-source voltage exceeds threshold)
    // 3. In linear region: acts like variable resistor
    // 4. In saturation: current is ~constant regardless of Vds

    const vgs = vg - vs;

    if (vgs < this._vth) {
      // CUTOFF: gate voltage below threshold, channel closed
      this._region = 'cutoff';
      this.getPin('S').value = 0;
    } else {
      // Channel is open
      const overdrive = (vgs - this._vth) / 255; // Normalized overdrive voltage
      const vds = vd; // Drain-source voltage

      if (vds < (vgs - this._vth)) {
        // LINEAR (TRIODE) region: acts like a resistor, Vds is small
        this._region = 'linear';
        // Output proportional to drain, small voltage drop
        const drop = Math.floor(vd * this._rdsOn * (1 / Math.max(0.1, overdrive)));
        this.getPin('S').value = Math.max(0, vd - Math.min(drop, vd));
      } else {
        // SATURATION region: current controlled by Vgs, independent of Vds
        this._region = 'saturation';
        const ids = Math.min(1, overdrive * 2); // Normalized current
        this.getPin('S').value = Math.max(0, Math.min(255, Math.floor(vd * ids)));
      }
    }
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 2 * cam.scale;
    const on = this._region !== 'cutoff';
    ctx.strokeStyle = on ? '#aa44ff' : '#441166'; ctx.lineWidth = 1.5 * cam.scale;
    // Gate line (left vertical)
    ctx.beginPath(); ctx.moveTo(cx - 14 * cam.scale, cy - 10 * cam.scale);
    ctx.lineTo(cx - 14 * cam.scale, cy + 10 * cam.scale); ctx.stroke();
    // Gate insulator gap (shows isolation — no current flows into gate!)
    ctx.setLineDash([2 * cam.scale, 2 * cam.scale]);
    ctx.beginPath(); ctx.moveTo(cx - 10 * cam.scale, cy - 10 * cam.scale);
    ctx.lineTo(cx - 10 * cam.scale, cy + 10 * cam.scale); ctx.stroke();
    ctx.setLineDash([]);
    // Drain
    ctx.beginPath(); ctx.moveTo(cx - 10 * cam.scale, cy - 6 * cam.scale);
    ctx.lineTo(cx + 14 * cam.scale, cy - 6 * cam.scale); ctx.stroke();
    // Source
    ctx.beginPath(); ctx.moveTo(cx - 10 * cam.scale, cy + 6 * cam.scale);
    ctx.lineTo(cx + 14 * cam.scale, cy + 6 * cam.scale); ctx.stroke();
    // Arrow (N-channel: pointing inward)
    const ax = cx - 10 * cam.scale + 6 * cam.scale, ay = cy;
    ctx.beginPath();
    ctx.moveTo(ax - 3 * cam.scale, ay - 3 * cam.scale);
    ctx.lineTo(ax + 4 * cam.scale, ay); ctx.lineTo(ax - 3 * cam.scale, ay + 3 * cam.scale);
    ctx.closePath(); ctx.stroke();
    // Region info
    if (cam.scale >= 0.55) {
      const vg = (this.getPin('G').value / 255 * 5).toFixed(1);
      const vd = (this.getPin('D').value / 255 * 5).toFixed(1);
      const vs = (this.getPin('S').value / 255 * 5).toFixed(1);
      const colors = { cutoff: '#441166', linear: '#8844cc', saturation: '#aa44ff' };
      ctx.fillStyle = colors[this._region];
      ctx.font = `bold ${Math.max(7, 8 * cam.scale)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(this._region.toUpperCase(), cx, sy + sh - 24 * cam.scale);
      ctx.font = `${Math.max(6, 7 * cam.scale)}px monospace`;
      ctx.fillStyle = '#8866aa';
      ctx.fillText('G=' + vg + ' D=' + vd + ' S=' + vs, cx, sy + sh - 13 * cam.scale);
    }
  }
}

class PMOSFETComponent extends BreadboardComponent {
  constructor(x, y) {
    super('PMOS', x, y, 'P-MOSFET');
    this.w = 110; this.h = 110;
    this._vth = 51;     // |Vth| threshold
    this._rdsOn = 0.02;
    this._region = 'cutoff';
  }
  _initPins() {
    this.pins = [
      _mp('G', 'in',  1, 'left',   0),  // Gate — voltage-controlled (no current!)
      _mp('S', 'in',  1, 'top',    0),  // Source — high voltage side (to VCC)
      _mp('D', 'out', 1, 'bottom', 0),  // Drain — output (to load then GND)
    ];
  }
  _bodyColor()   { return '#0a001a'; }
  _headerColor() { return '#140028'; }
  simulate() {
    const vg = this.getPin('G').value;
    const vs = this.getPin('S').value;

    // P-MOSFET rules (complement of N-MOSFET):
    // 1. Gate is ISOLATED (no gate current)
    // 2. Turns ON when Vsg > |Vth| (gate pulled LOW relative to source)
    // 3. Source connects to VCC, Drain to load
    // 4. "Active LOW" control — pull gate to ground to turn on

    const vsg = vs - vg;

    if (vsg < this._vth) {
      // CUTOFF: gate not low enough relative to source
      this._region = 'cutoff';
      this.getPin('D').value = 0;
    } else {
      const overdrive = (vsg - this._vth) / 255;
      const vsd = vs; // Source-drain voltage

      if (vsd < (vsg - this._vth)) {
        this._region = 'linear';
        const drop = Math.floor(vs * this._rdsOn * (1 / Math.max(0.1, overdrive)));
        this.getPin('D').value = Math.max(0, vs - Math.min(drop, vs));
      } else {
        this._region = 'saturation';
        const ids = Math.min(1, overdrive * 2);
        this.getPin('D').value = Math.max(0, Math.min(255, Math.floor(vs * ids)));
      }
    }
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 2 * cam.scale;
    const on = this._region !== 'cutoff';
    ctx.strokeStyle = on ? '#ff44aa' : '#661133'; ctx.lineWidth = 1.5 * cam.scale;
    ctx.beginPath(); ctx.moveTo(cx - 14 * cam.scale, cy - 10 * cam.scale);
    ctx.lineTo(cx - 14 * cam.scale, cy + 10 * cam.scale); ctx.stroke();
    // Insulator gap (dashed = isolated gate)
    ctx.setLineDash([2 * cam.scale, 2 * cam.scale]);
    ctx.beginPath(); ctx.moveTo(cx - 10 * cam.scale, cy - 10 * cam.scale);
    ctx.lineTo(cx - 10 * cam.scale, cy + 10 * cam.scale); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(cx - 10 * cam.scale, cy - 6 * cam.scale);
    ctx.lineTo(cx + 14 * cam.scale, cy - 6 * cam.scale); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 10 * cam.scale, cy + 6 * cam.scale);
    ctx.lineTo(cx + 14 * cam.scale, cy + 6 * cam.scale); ctx.stroke();
    // P-channel arrow pointing outward + bubble on gate
    const ax = cx - 2 * cam.scale, ay = cy;
    ctx.beginPath();
    ctx.moveTo(ax + 4 * cam.scale, ay - 3 * cam.scale);
    ctx.lineTo(ax - 3 * cam.scale, ay); ctx.lineTo(ax + 4 * cam.scale, ay + 3 * cam.scale);
    ctx.closePath(); ctx.stroke();
    // Bubble on gate (indicates active-low)
    ctx.beginPath(); ctx.arc(cx - 12 * cam.scale, cy, 2 * cam.scale, 0, Math.PI * 2); ctx.stroke();
    if (cam.scale >= 0.55) {
      const vg = (this.getPin('G').value / 255 * 5).toFixed(1);
      const vs2 = (this.getPin('S').value / 255 * 5).toFixed(1);
      const vd = (this.getPin('D').value / 255 * 5).toFixed(1);
      const colors = { cutoff: '#661133', linear: '#cc3388', saturation: '#ff44aa' };
      ctx.fillStyle = colors[this._region];
      ctx.font = `bold ${Math.max(7, 8 * cam.scale)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(this._region.toUpperCase(), cx, sy + sh - 24 * cam.scale);
      ctx.font = `${Math.max(6, 7 * cam.scale)}px monospace`;
      ctx.fillStyle = '#aa6688';
      ctx.fillText('G=' + vg + ' S=' + vs2 + ' D=' + vd, cx, sy + sh - 13 * cam.scale);
    }
  }
}

class NJFETComponent extends BreadboardComponent {
  constructor(x, y) {
    super('NJFET', x, y, 'N-JFET');
    this.w = 110; this.h = 110;
    // N-JFET: depletion mode — NORMALLY ON
    this._vp = 102;  // Pinch-off voltage ~2V (102/255*5). Gate must go this far negative to shut off.
    this._region = 'linear';
  }
  _initPins() {
    this.pins = [
      _mp('G', 'in',  1, 'left',   0),  // Gate — reverse-biased junction (draws no current when properly biased)
      _mp('D', 'in',  1, 'top',    0),  // Drain
      _mp('S', 'out', 1, 'bottom', 0),  // Source
    ];
  }
  _bodyColor()   { return '#0a001a'; }
  _headerColor() { return '#140028'; }
  simulate() {
    const vg = this.getPin('G').value;
    const vd = this.getPin('D').value;

    // N-JFET rules:
    // 1. NORMALLY ON (depletion mode) — channel exists with zero gate bias
    // 2. Reverse bias gate-source (Vgs < 0, i.e., gate lower than source) to restrict current
    // 3. At Vgs = -Vp (pinch-off), channel fully closed
    // In our 0-255 model: source is at ~0V, so lower gate = more restriction

    // Vgs is effectively -(source_level - gate). Since source defaults ~0:
    // Gate at max (255) = Vgs=0 = fully on
    // Gate at 0 = Vgs=-5V = off (if Vp < 5V)

    const conductance = Math.min(1, vg / this._vp); // 0=fully pinched, 1+=fully open

    if (conductance <= 0.01) {
      this._region = 'cutoff';
      this.getPin('S').value = 0;
    } else if (conductance >= 0.95) {
      this._region = 'linear';
      this.getPin('S').value = Math.max(0, vd - 2); // tiny Rds drop
    } else {
      this._region = 'active';
      this.getPin('S').value = Math.max(0, Math.min(255, Math.floor(vd * conductance)));
    }
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 2 * cam.scale;
    const on = this._region !== 'cutoff';
    ctx.strokeStyle = on ? '#4488ff' : '#224466'; ctx.lineWidth = 1.5 * cam.scale;
    // Channel (vertical bar - solid because JFET has a physical channel)
    ctx.beginPath(); ctx.moveTo(cx, cy - 12 * cam.scale); ctx.lineTo(cx, cy + 12 * cam.scale); ctx.stroke();
    // Gate arrow pointing inward (N-channel)
    ctx.beginPath(); ctx.moveTo(cx - 14 * cam.scale, cy); ctx.lineTo(cx - 4 * cam.scale, cy); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 6 * cam.scale, cy - 3 * cam.scale);
    ctx.lineTo(cx - 2 * cam.scale, cy);
    ctx.lineTo(cx - 6 * cam.scale, cy + 3 * cam.scale);
    ctx.closePath(); ctx.fill();
    if (cam.scale >= 0.55) {
      const vg = (this.getPin('G').value / 255 * 5).toFixed(1);
      const vd = (this.getPin('D').value / 255 * 5).toFixed(1);
      const vs = (this.getPin('S').value / 255 * 5).toFixed(1);
      const colors = { cutoff: '#224466', active: '#4488ff', linear: '#66aaff' };
      ctx.fillStyle = colors[this._region];
      ctx.font = `bold ${Math.max(7, 8 * cam.scale)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(this._region.toUpperCase(), cx, sy + sh - 24 * cam.scale);
      ctx.font = `${Math.max(6, 7 * cam.scale)}px monospace`;
      ctx.fillStyle = '#6688aa';
      ctx.fillText('G=' + vg + ' D=' + vd + ' S=' + vs, cx, sy + sh - 13 * cam.scale);
    }
  }
}

class PJFETComponent extends BreadboardComponent {
  constructor(x, y) {
    super('PJFET', x, y, 'P-JFET');
    this.w = 110; this.h = 110;
    this._vp = 102;
    this._region = 'linear';
  }
  _initPins() {
    this.pins = [
      _mp('G', 'in',  1, 'left',   0),  // Gate
      _mp('S', 'in',  1, 'top',    0),  // Source (connects to VCC for P-channel)
      _mp('D', 'out', 1, 'bottom', 0),  // Drain (output)
    ];
  }
  _bodyColor()   { return '#0a001a'; }
  _headerColor() { return '#140028'; }
  simulate() {
    const vg = this.getPin('G').value;
    const vs = this.getPin('S').value;

    // P-JFET rules (complement of N-JFET):
    // 1. NORMALLY ON (depletion mode)
    // 2. Apply positive Vgs (gate higher than source) to restrict current
    // 3. At Vgs = +Vp, channel fully closed

    // Conductance decreases as gate goes HIGHER than source
    const vgs = vg - vs; // Positive = restricting
    const conductance = Math.min(1, Math.max(0, 1 - (Math.max(0, vg) / this._vp)));

    if (conductance <= 0.01) {
      this._region = 'cutoff';
      this.getPin('D').value = 0;
    } else if (conductance >= 0.95) {
      this._region = 'linear';
      this.getPin('D').value = Math.max(0, vs - 2);
    } else {
      this._region = 'active';
      this.getPin('D').value = Math.max(0, Math.min(255, Math.floor(vs * conductance)));
    }
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 2 * cam.scale;
    const on = this._region !== 'cutoff';
    ctx.strokeStyle = on ? '#ff88cc' : '#663355'; ctx.lineWidth = 1.5 * cam.scale;
    // Channel
    ctx.beginPath(); ctx.moveTo(cx, cy - 12 * cam.scale); ctx.lineTo(cx, cy + 12 * cam.scale); ctx.stroke();
    // Gate arrow pointing outward (P-channel)
    ctx.beginPath(); ctx.moveTo(cx - 14 * cam.scale, cy); ctx.lineTo(cx - 4 * cam.scale, cy); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 10 * cam.scale, cy - 3 * cam.scale);
    ctx.lineTo(cx - 14 * cam.scale, cy);
    ctx.lineTo(cx - 10 * cam.scale, cy + 3 * cam.scale);
    ctx.closePath(); ctx.fill();
    if (cam.scale >= 0.55) {
      const vg = (this.getPin('G').value / 255 * 5).toFixed(1);
      const vs2 = (this.getPin('S').value / 255 * 5).toFixed(1);
      const vd = (this.getPin('D').value / 255 * 5).toFixed(1);
      const colors = { cutoff: '#663355', active: '#ff88cc', linear: '#ffaadd' };
      ctx.fillStyle = colors[this._region];
      ctx.font = `bold ${Math.max(7, 8 * cam.scale)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(this._region.toUpperCase(), cx, sy + sh - 24 * cam.scale);
      ctx.font = `${Math.max(6, 7 * cam.scale)}px monospace`;
      ctx.fillStyle = '#aa6688';
      ctx.fillText('G=' + vg + ' S=' + vs2 + ' D=' + vd, cx, sy + sh - 13 * cam.scale);
    }
  }
}

class SCRComponent extends BreadboardComponent {
  constructor(x, y) {
    super('SCR', x, y, 'SCR');
    this.w = 110; this.h = 100;
    this._latched = false;
    this._vgt = 20;      // ~0.4V Gate trigger voltage
    this._holdCurrent = 5; // Minimum anode value to maintain latch (~0.1V = ~1mA holding current)
    this._vDrop = 8;     // ~0.15V forward voltage drop when conducting
  }
  _initPins() {
    this.pins = [
      _mp('A', 'in',  1, 'left',   0),  // Anode — positive supply side
      _mp('G', 'in',  1, 'left',   1),  // Gate — trigger input (small pulse latches it)
      _mp('K', 'out', 1, 'right',  0),  // Cathode — output (to load/GND)
    ];
  }
  _bodyColor()   { return '#1a0000'; }
  _headerColor() { return '#2a0000'; }
  simulate() {
    const anode = this.getPin('A').value;
    const gate  = this.getPin('G').value;

    // SCR (Silicon Controlled Rectifier) rules:
    // 1. Starts in OFF state — blocks current in both directions
    // 2. Gate pulse > Vgt AND anode > 0 → triggers ON (latches)
    // 3. Once latched, gate can be removed — SCR stays on
    // 4. Only turns OFF when anode current drops below holding current
    //    (in practice: anode voltage drops to ~0 or power is removed)
    // 5. Forward voltage drop ~1V when conducting

    if (this._latched) {
      // Check if holding current is maintained
      if (anode < this._holdCurrent) {
        this._latched = false; // Current too low, SCR turns off
      }
    } else {
      // Check for gate trigger
      if (gate >= this._vgt && anode > this._holdCurrent) {
        this._latched = true;  // Triggered! Latches on.
      }
    }

    if (this._latched && anode > 0) {
      // Conducting: Cathode = Anode - forward drop
      this.getPin('K').value = Math.max(0, anode - this._vDrop);
    } else {
      this.getPin('K').value = 0;
    }
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.45) return;
    const cx = sx + sw / 2, cy = sy + sh / 2 + 2 * cam.scale;
    _drawDiodeSymbol(ctx, cam, sx, sy, sw, sh, this._latched, '#ff4444');
    if (cam.scale >= 0.55) {
      const va = (this.getPin('A').value / 255 * 5).toFixed(1);
      const vk = (this.getPin('K').value / 255 * 5).toFixed(1);
      ctx.font = `bold ${Math.max(7, 8 * cam.scale)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = this._latched ? '#ff4444' : '#442222';
      ctx.fillText(this._latched ? 'LATCHED' : 'BLOCKING', cx, sy + sh - 24 * cam.scale);
      ctx.font = `${Math.max(6, 7 * cam.scale)}px monospace`;
      ctx.fillStyle = '#aa4444';
      ctx.fillText('A=' + va + 'V K=' + vk + 'V', cx, sy + sh - 13 * cam.scale);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  DISPLAY COMPONENTS
// ═══════════════════════════════════════════════════════════════════

class LEDBarComponent extends BreadboardComponent {
  constructor(x, y) {
    super('LEDBar', x, y, 'LED BAR');
    this.w = 160; this.h = 80;
    this._color = 'red';
  }
  _initPins() {
    this.pins = [];
    for (let i = 0; i < 8; i++) this.pins.push(_mp('D' + i, 'in', 1, 'left', i));
    this.pins.push(_mp('GND', 'in', 1, 'bottom', 0));
    this.h = 12 + 8 * 16 + 12;
  }
  _bodyColor()   { return '#1a0000'; }
  _headerColor() { return '#2a0000'; }
  simulate() { /* inputs drive display directly */ }
  _ledRgb() {
    switch (this._color) {
      case 'red':    return [255, 40, 40];
      case 'green':  return [40, 255, 40];
      case 'blue':   return [40, 100, 255];
      case 'yellow': return [255, 220, 0];
      default:       return [255, 40, 40];
    }
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.3) return;
    const [r, g, b] = this._ledRgb();
    const col = `rgb(${r},${g},${b})`;
    const dim = `rgb(${Math.floor(r*0.1)},${Math.floor(g*0.1)},${Math.floor(b*0.1)})`;
    // Draw 8 LED circles in a row
    const startX = sx + 14 * cam.scale;
    const spacing = (sw - 28 * cam.scale) / 7;
    const cr = Math.max(3, 6 * cam.scale);
    const cy = sy + sh / 2 + 6 * cam.scale;
    for (let i = 0; i < 8; i++) {
      const lx = startX + i * spacing;
      const pin = this.getPin('D' + i);
      const lit = pin && pin.value > 0;
      ctx.save();
      if (lit) { ctx.shadowColor = col; ctx.shadowBlur = 10 * cam.scale; }
      const grad = ctx.createRadialGradient(lx - cr * 0.2, cy - cr * 0.2, 0, lx, cy, cr);
      grad.addColorStop(0, lit ? 'white' : '#222');
      grad.addColorStop(0.4, lit ? col : dim);
      grad.addColorStop(1, lit ? `rgb(${Math.floor(r*0.5)},${Math.floor(g*0.5)},${Math.floor(b*0.5)})` : '#111');
      ctx.fillStyle = grad;
      ctx.strokeStyle = lit ? col : '#333';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(lx, cy, cr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
}

// ─── 7-Segment Display ────────────────────────────────────────────────────────

// Segment layout (a-g + dp):
//  aaa
// f   b
// f   b
//  ggg
// e   c
// e   c
//  ddd  dp

const SEG7_SEGS = {
  a: [1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 1],  // digits 0-9,A-F
  b: [1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 0, 0],
  c: [1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 0],
  d: [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0],
  e: [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1],
  f: [1, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1],
  g: [0, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1],
};

function _draw7Seg(ctx, sx, sy, sw, sh, segs, color, scale) {
  // segs = object with keys a-g, each 0 or 1
  const margin = 6 * scale;
  const w = sw - 2 * margin;
  const h = sh - 2 * margin;
  const x0 = sx + margin, y0 = sy + margin;
  const sw2 = w * 0.12, sl = w * 0.42, ss = w * 0.08;
  const offColor = '#1a0000', onColor = color;
  const lit = (seg) => segs[seg] ? onColor : offColor;

  // a — top horizontal
  ctx.fillStyle = lit('a');
  ctx.beginPath();
  ctx.moveTo(x0 + ss, y0 + ss);
  ctx.lineTo(x0 + sl, y0 + ss);
  ctx.lineTo(x0 + sl - ss, y0 + sw2 + ss);
  ctx.lineTo(x0 + ss, y0 + sw2 + ss);
  ctx.closePath(); ctx.fill();

  // b — top-right vertical
  ctx.fillStyle = lit('b');
  ctx.beginPath();
  ctx.moveTo(x0 + sl + ss, y0 + ss);
  ctx.lineTo(x0 + sl + sw2, y0 + ss);
  ctx.lineTo(x0 + sl + sw2 - ss, y0 + h * 0.45 + ss);
  ctx.lineTo(x0 + sl + ss * 0.5, y0 + h * 0.45 - ss);
  ctx.closePath(); ctx.fill();

  // c — bottom-right vertical
  ctx.fillStyle = lit('c');
  ctx.beginPath();
  ctx.moveTo(x0 + sl + ss * 0.5, y0 + h * 0.55 + ss);
  ctx.lineTo(x0 + sl + sw2 - ss, y0 + h * 0.55 + ss);
  ctx.lineTo(x0 + sl + sw2, y0 + h - ss);
  ctx.lineTo(x0 + sl + ss, y0 + h - ss);
  ctx.closePath(); ctx.fill();

  // d — bottom horizontal
  ctx.fillStyle = lit('d');
  ctx.beginPath();
  ctx.moveTo(x0 + ss, y0 + h - sw2 - ss);
  ctx.lineTo(x0 + sl - ss, y0 + h - sw2 - ss);
  ctx.lineTo(x0 + sl, y0 + h - ss);
  ctx.lineTo(x0 + ss, y0 + h - ss);
  ctx.closePath(); ctx.fill();

  // e — bottom-left vertical
  ctx.fillStyle = lit('e');
  ctx.beginPath();
  ctx.moveTo(x0, y0 + h * 0.55 + ss);
  ctx.lineTo(x0 + sw2 - ss, y0 + h * 0.55 + ss);
  ctx.lineTo(x0 + sw2, y0 + h - ss);
  ctx.lineTo(x0, y0 + h - ss);
  ctx.closePath(); ctx.fill();

  // f — top-left vertical
  ctx.fillStyle = lit('f');
  ctx.beginPath();
  ctx.moveTo(x0, y0 + ss);
  ctx.lineTo(x0 + sw2 - ss, y0 + ss);
  ctx.lineTo(x0 + sw2, y0 + h * 0.45 - ss);
  ctx.lineTo(x0, y0 + h * 0.45 + ss);
  ctx.closePath(); ctx.fill();

  // g — middle horizontal
  ctx.fillStyle = lit('g');
  ctx.beginPath();
  ctx.moveTo(x0 + ss, y0 + h * 0.5 - sw2 * 0.5);
  ctx.lineTo(x0 + sl - ss, y0 + h * 0.5 - sw2 * 0.5);
  ctx.lineTo(x0 + sl, y0 + h * 0.5);
  ctx.lineTo(x0 + sl - ss, y0 + h * 0.5 + sw2 * 0.5);
  ctx.lineTo(x0 + ss, y0 + h * 0.5 + sw2 * 0.5);
  ctx.lineTo(x0, y0 + h * 0.5);
  ctx.closePath(); ctx.fill();
}

class SevenSegDisplayComponent extends BreadboardComponent {
  constructor(x, y) {
    super('7Seg', x, y, '7-SEG');
    this.w = 130; this.h = 160;
    this._color = '#ff3300';
  }
  _initPins() {
    this.pins = [
      _mp('a',  'in', 1, 'left', 0), _mp('b', 'in', 1, 'left', 1),
      _mp('c',  'in', 1, 'left', 2), _mp('d', 'in', 1, 'left', 3),
      _mp('e',  'in', 1, 'left', 4), _mp('f', 'in', 1, 'left', 5),
      _mp('g',  'in', 1, 'left', 6), _mp('dp','in', 1, 'left', 7),
      _mp('COM','in', 1, 'bottom', 0),
    ];
    this.h = 12 + 8 * 16 + 14;
  }
  _bodyColor()   { return '#0a0000'; }
  _headerColor() { return '#1a0000'; }
  simulate() { /* inputs drive display directly */ }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.3) return;
    const segs = {};
    ['a','b','c','d','e','f','g'].forEach(s => {
      segs[s] = this.getPin(s).value > 0 ? 1 : 0;
    });
    const glow = Object.values(segs).some(v => v);
    ctx.save();
    if (glow) { ctx.shadowColor = this._color; ctx.shadowBlur = 12 * cam.scale; }
    const displayY = sy + 20 * cam.scale;
    const displayH = sh - 26 * cam.scale;
    _draw7Seg(ctx, sx + 4 * cam.scale, displayY, sw - 8 * cam.scale, displayH, segs, this._color, cam.scale);
    // DP
    if (this.getPin('dp').value > 0) {
      ctx.fillStyle = this._color;
      ctx.beginPath();
      ctx.arc(sx + sw - 14 * cam.scale, sy + sh - 18 * cam.scale, 3 * cam.scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

class SevenSegDecoderComponent extends BreadboardComponent {
  constructor(x, y) {
    super('7SegDec', x, y, '7-SEG DEC');
    this.w = 140; this.h = 160;
    this._color = '#ff3300';
  }
  _initPins() {
    this.pins = [
      _mp('B0', 'in', 1, 'left', 0), _mp('B1', 'in', 1, 'left', 1),
      _mp('B2', 'in', 1, 'left', 2), _mp('B3', 'in', 1, 'left', 3),
    ];
    this.h = 12 + 4 * 16 + 14;
  }
  _bodyColor()   { return '#0a0000'; }
  _headerColor() { return '#1a0000'; }
  simulate() { /* pure combinational display */ }
  _bcdValue() {
    return (this.getPin('B0').value > 0 ? 1 : 0)
         | ((this.getPin('B1').value > 0 ? 1 : 0) << 1)
         | ((this.getPin('B2').value > 0 ? 1 : 0) << 2)
         | ((this.getPin('B3').value > 0 ? 1 : 0) << 3);
  }
  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.3) return;
    const digit = this._bcdValue() & 0xF;
    const segs = {};
    ['a','b','c','d','e','f','g'].forEach(s => {
      segs[s] = SEG7_SEGS[s] ? SEG7_SEGS[s][digit] : 0;
    });
    const glow = digit > 0 || segs['g'];
    ctx.save();
    if (glow) { ctx.shadowColor = this._color; ctx.shadowBlur = 12 * cam.scale; }
    const displayY = sy + 20 * cam.scale;
    const displayH = sh - 26 * cam.scale;
    _draw7Seg(ctx, sx + 4 * cam.scale, displayY, sw - 8 * cam.scale, displayH, segs, this._color, cam.scale);
    ctx.restore();
    // Digit label
    if (cam.scale >= 0.5) {
      ctx.font = `${Math.max(7, 8 * cam.scale)}px monospace`;
      ctx.fillStyle = '#663300'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText(digit.toString(16).toUpperCase(), sx + sw - 6 * cam.scale, sy + sh - 14 * cam.scale);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  74LS SERIES ICs  — DIP package base
// ═══════════════════════════════════════════════════════════════════

/**
 * DIP IC base class.  Subclasses declare:
 *   this._icLabel  — e.g. '74LS00'
 *   this._dipPins  — array of { name, dir:'in'|'out'|'pwr', side:'left'|'right', index }
 *   plus override simulate()
 *
 * Rendered as a realistic DIP chip with pin numbers on both sides.
 */
class DIPChipBase extends BreadboardComponent {
  constructor(type, x, y, label) {
    super(type, x, y, label);
    this._icLabel = label;
  }
  _bodyColor()   { return '#111111'; }
  _headerColor() { return '#1a1a1a'; }

  render(ctx, cam) {
    const sx = this.x * cam.scale + cam.ox;
    const sy = this.y * cam.scale + cam.oy;
    const sw = this.w * cam.scale;
    const sh = this.h * cam.scale;

    ctx.save();
    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur  = 12 * cam.scale;
    ctx.shadowOffsetY = 3 * cam.scale;
    // Chip body
    ctx.fillStyle   = '#1c1c1c';
    ctx.strokeStyle = this.selected ? '#00ff88' : (this.highlighted ? '#ffaa00' : '#333333');
    ctx.lineWidth   = this.selected ? 2 : 1;
    _rr(ctx, sx, sy, sw, sh, 3 * cam.scale);
    ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();

    // Notch at top-center (DIP orientation)
    ctx.fillStyle = '#0a0a0a';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx + sw / 2, sy, 5 * cam.scale, 0, Math.PI);
    ctx.fill(); ctx.stroke();

    // IC label
    if (cam.scale >= 0.4) {
      ctx.fillStyle    = '#cccccc';
      ctx.font         = `bold ${Math.max(7, 9 * cam.scale)}px monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this._icLabel, sx + sw / 2, sy + sh / 2);
      if (cam.scale >= 0.7 && this._icSubLabel) {
        ctx.font      = `${Math.max(6, 7 * cam.scale)}px monospace`;
        ctx.fillStyle = '#666';
        ctx.fillText(this._icSubLabel, sx + sw / 2, sy + sh / 2 + 10 * cam.scale);
      }
    }
    ctx.restore();

    ctx.save();
    this._renderDIPPins(ctx, cam, sx, sy, sw, sh);
    ctx.restore();
  }

  _renderDIPPins(ctx, cam, sx, sy, sw, sh) {
    const leftPins  = this.pins.filter(p => p.side === 'left').sort((a, b) => a.index - b.index);
    const rightPins = this.pins.filter(p => p.side === 'right').sort((a, b) => a.index - b.index);
    const maxPins   = Math.max(leftPins.length, rightPins.length);
    const pinH      = sh / (maxPins + 1);
    const pinW      = 8 * cam.scale;

    const drawPin = (pin, px, py, leftSide) => {
      const isHigh = pin.value !== 0;
      const isPwr  = pin.dir === 'pwr';
      const col    = isPwr ? '#ff4444' : (isHigh ? (pin.dir === 'out' ? '#00ff88' : '#4488ff') : '#333');

      // Pin stub extending from chip edge
      ctx.strokeStyle = col;
      ctx.lineWidth   = 2 * cam.scale;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(leftSide ? px - pinW : px + pinW, py);
      ctx.stroke();
      // Dot
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(leftSide ? px - pinW : px + pinW, py, 2.5 * cam.scale, 0, Math.PI * 2);
      ctx.fill();
      // Label
      if (cam.scale >= 0.55) {
        ctx.font = `${Math.max(6, 7 * cam.scale)}px monospace`;
        ctx.fillStyle    = '#888';
        ctx.textBaseline = 'middle';
        ctx.textAlign    = leftSide ? 'right' : 'left';
        const offX = (leftSide ? -pinW - 4 * cam.scale : pinW + 4 * cam.scale);
        ctx.fillText(pin.name, px + offX, py);
      }
    };

    leftPins.forEach((pin, i) => {
      const py = sy + pinH * (i + 1);
      drawPin(pin, sx, py, true);
    });
    rightPins.forEach((pin, i) => {
      const py = sy + pinH * (i + 1);
      drawPin(pin, sx + sw, py, false);
    });
  }

  // Hit test still uses body
  _renderInterior() { /* handled by render() override */ }
}

// ─── 74LS00 — Quad 2-input NAND ──────────────────────────────────────────────
class IC_74LS00 extends DIPChipBase {
  constructor(x, y) {
    super('74LS00', x, y, '74LS00');
    this._icSubLabel = 'QUAD NAND';
    this.w = 120; this.h = 140;
  }
  _initPins() {
    this.pins = [
      _mp('1A', 'in', 1, 'left', 0), _mp('1B', 'in', 1, 'left', 1), _mp('1Y', 'out', 1, 'left', 2),
      _mp('2A', 'in', 1, 'left', 3), _mp('2B', 'in', 1, 'left', 4), _mp('2Y', 'out', 1, 'left', 5),
      _mp('GND','pwr',1, 'left', 6),
      _mp('3Y', 'out',1, 'right',0), _mp('3A','in',1,'right',1), _mp('3B','in',1,'right',2),
      _mp('4Y', 'out',1, 'right',3), _mp('4A','in',1,'right',4), _mp('4B','in',1,'right',5),
      _mp('VCC','pwr',1, 'right',6),
    ];
  }
  simulate() {
    const nand = (a, b) => (a > 0 && b > 0) ? 0 : 255;
    this.getPin('1Y').value = nand(this.getPin('1A').value, this.getPin('1B').value);
    this.getPin('2Y').value = nand(this.getPin('2A').value, this.getPin('2B').value);
    this.getPin('3Y').value = nand(this.getPin('3A').value, this.getPin('3B').value);
    this.getPin('4Y').value = nand(this.getPin('4A').value, this.getPin('4B').value);
  }
}

// ─── 74LS04 — Hex Inverter ────────────────────────────────────────────────────
class IC_74LS04 extends DIPChipBase {
  constructor(x, y) {
    super('74LS04', x, y, '74LS04');
    this._icSubLabel = 'HEX INV';
    this.w = 120; this.h = 140;
  }
  _initPins() {
    this.pins = [
      _mp('1A','in',1,'left',0), _mp('1Y','out',1,'left',1),
      _mp('2A','in',1,'left',2), _mp('2Y','out',1,'left',3),
      _mp('3A','in',1,'left',4), _mp('3Y','out',1,'left',5),
      _mp('GND','pwr',1,'left',6),
      _mp('4Y','out',1,'right',0), _mp('4A','in',1,'right',1),
      _mp('5Y','out',1,'right',2), _mp('5A','in',1,'right',3),
      _mp('6Y','out',1,'right',4), _mp('6A','in',1,'right',5),
      _mp('VCC','pwr',1,'right',6),
    ];
  }
  simulate() {
    const inv = (a) => a > 0 ? 0 : 255;
    ['1','2','3','4','5','6'].forEach(n => {
      this.getPin(n + 'Y').value = inv(this.getPin(n + 'A').value);
    });
  }
}

// ─── 74LS08 — Quad AND ────────────────────────────────────────────────────────
class IC_74LS08 extends DIPChipBase {
  constructor(x, y) {
    super('74LS08', x, y, '74LS08');
    this._icSubLabel = 'QUAD AND';
    this.w = 120; this.h = 140;
  }
  _initPins() {
    this.pins = [
      _mp('1A','in',1,'left',0), _mp('1B','in',1,'left',1), _mp('1Y','out',1,'left',2),
      _mp('2A','in',1,'left',3), _mp('2B','in',1,'left',4), _mp('2Y','out',1,'left',5),
      _mp('GND','pwr',1,'left',6),
      _mp('3Y','out',1,'right',0), _mp('3A','in',1,'right',1), _mp('3B','in',1,'right',2),
      _mp('4Y','out',1,'right',3), _mp('4A','in',1,'right',4), _mp('4B','in',1,'right',5),
      _mp('VCC','pwr',1,'right',6),
    ];
  }
  simulate() {
    const and = (a, b) => (a > 0 && b > 0) ? 255 : 0;
    this.getPin('1Y').value = and(this.getPin('1A').value, this.getPin('1B').value);
    this.getPin('2Y').value = and(this.getPin('2A').value, this.getPin('2B').value);
    this.getPin('3Y').value = and(this.getPin('3A').value, this.getPin('3B').value);
    this.getPin('4Y').value = and(this.getPin('4A').value, this.getPin('4B').value);
  }
}

// ─── 74LS32 — Quad OR ────────────────────────────────────────────────────────
class IC_74LS32 extends DIPChipBase {
  constructor(x, y) {
    super('74LS32', x, y, '74LS32');
    this._icSubLabel = 'QUAD OR';
    this.w = 120; this.h = 140;
  }
  _initPins() {
    this.pins = [
      _mp('1A','in',1,'left',0), _mp('1B','in',1,'left',1), _mp('1Y','out',1,'left',2),
      _mp('2A','in',1,'left',3), _mp('2B','in',1,'left',4), _mp('2Y','out',1,'left',5),
      _mp('GND','pwr',1,'left',6),
      _mp('3Y','out',1,'right',0), _mp('3A','in',1,'right',1), _mp('3B','in',1,'right',2),
      _mp('4Y','out',1,'right',3), _mp('4A','in',1,'right',4), _mp('4B','in',1,'right',5),
      _mp('VCC','pwr',1,'right',6),
    ];
  }
  simulate() {
    const or = (a, b) => (a > 0 || b > 0) ? 255 : 0;
    this.getPin('1Y').value = or(this.getPin('1A').value, this.getPin('1B').value);
    this.getPin('2Y').value = or(this.getPin('2A').value, this.getPin('2B').value);
    this.getPin('3Y').value = or(this.getPin('3A').value, this.getPin('3B').value);
    this.getPin('4Y').value = or(this.getPin('4A').value, this.getPin('4B').value);
  }
}

// ─── 74LS86 — Quad XOR ───────────────────────────────────────────────────────
class IC_74LS86 extends DIPChipBase {
  constructor(x, y) {
    super('74LS86', x, y, '74LS86');
    this._icSubLabel = 'QUAD XOR';
    this.w = 120; this.h = 140;
  }
  _initPins() {
    this.pins = [
      _mp('1A','in',1,'left',0), _mp('1B','in',1,'left',1), _mp('1Y','out',1,'left',2),
      _mp('2A','in',1,'left',3), _mp('2B','in',1,'left',4), _mp('2Y','out',1,'left',5),
      _mp('GND','pwr',1,'left',6),
      _mp('3Y','out',1,'right',0), _mp('3A','in',1,'right',1), _mp('3B','in',1,'right',2),
      _mp('4Y','out',1,'right',3), _mp('4A','in',1,'right',4), _mp('4B','in',1,'right',5),
      _mp('VCC','pwr',1,'right',6),
    ];
  }
  simulate() {
    const xor = (a, b) => ((a > 0) !== (b > 0)) ? 255 : 0;
    this.getPin('1Y').value = xor(this.getPin('1A').value, this.getPin('1B').value);
    this.getPin('2Y').value = xor(this.getPin('2A').value, this.getPin('2B').value);
    this.getPin('3Y').value = xor(this.getPin('3A').value, this.getPin('3B').value);
    this.getPin('4Y').value = xor(this.getPin('4A').value, this.getPin('4B').value);
  }
}

// ─── 74LS138 — 3-to-8 Decoder ────────────────────────────────────────────────
class IC_74LS138 extends DIPChipBase {
  constructor(x, y) {
    super('74LS138', x, y, '74LS138');
    this._icSubLabel = '3:8 DECODER';
    this.w = 130; this.h = 160;
  }
  _initPins() {
    this.pins = [
      _mp('A', 'in', 1,'left',0), _mp('B','in',1,'left',1), _mp('C','in',1,'left',2),
      _mp('G2A','in',1,'left',3), _mp('G2B','in',1,'left',4), _mp('G1','in',1,'left',5),
      _mp('Y7','out',1,'left',6), _mp('GND','pwr',1,'left',7),
      _mp('VCC','pwr',1,'right',0),
      _mp('Y0','out',1,'right',1), _mp('Y1','out',1,'right',2),
      _mp('Y2','out',1,'right',3), _mp('Y3','out',1,'right',4),
      _mp('Y4','out',1,'right',5), _mp('Y5','out',1,'right',6),
      _mp('Y6','out',1,'right',7),
    ];
  }
  simulate() {
    // Active LOW outputs; enabled when G1=1 AND G2A=0 AND G2B=0
    const g1  = this.getPin('G1').value > 0 ? 1 : 0;
    const g2a = this.getPin('G2A').value > 0 ? 1 : 0;
    const g2b = this.getPin('G2B').value > 0 ? 1 : 0;
    const enabled = g1 && !g2a && !g2b;
    const sel = (this.getPin('A').value > 0 ? 1 : 0)
              | ((this.getPin('B').value > 0 ? 1 : 0) << 1)
              | ((this.getPin('C').value > 0 ? 1 : 0) << 2);
    for (let i = 0; i < 8; i++) {
      // Active LOW: selected output is 0, others are 255
      this.getPin('Y' + i).value = (enabled && i === sel) ? 0 : 255;
    }
  }
}

// ─── 74LS173 — 4-bit D Register ──────────────────────────────────────────────
class IC_74LS173 extends DIPChipBase {
  constructor(x, y) {
    super('74LS173', x, y, '74LS173');
    this._icSubLabel = '4-BIT REG';
    this.w = 130; this.h = 160;
    this._stored = 0;
    this._prevClk = 0;
  }
  _initPins() {
    this.pins = [
      _mp('M',  'in',1,'left',0), _mp('N',  'in',1,'left',1),
      _mp('D1', 'in',1,'left',2), _mp('D2', 'in',1,'left',3),
      _mp('D3', 'in',1,'left',4), _mp('D4', 'in',1,'left',5),
      _mp('CLK','in',1,'left',6), _mp('GND','pwr',1,'left',7),
      _mp('VCC','pwr',1,'right',0), _mp('CLR','in',1,'right',1),
      _mp('Q1','out',1,'right',2), _mp('Q2','out',1,'right',3),
      _mp('Q3','out',1,'right',4), _mp('Q4','out',1,'right',5),
      _mp('G1','in',1,'right',6), _mp('G2','in',1,'right',7),
    ];
  }
  simulate(risingEdge) {
    if (this.getPin('CLR').value > 0) { this._stored = 0; }
    const clk = this.getPin('CLK').value > 0 ? 1 : 0;
    // Load on rising edge when G1=G2=0
    const g1 = this.getPin('G1').value, g2 = this.getPin('G2').value;
    if (risingEdge && clk && !this._prevClk && !g1 && !g2) {
      this._stored = (this.getPin('D1').value > 0 ? 1 : 0)
                   | ((this.getPin('D2').value > 0 ? 1 : 0) << 1)
                   | ((this.getPin('D3').value > 0 ? 1 : 0) << 2)
                   | ((this.getPin('D4').value > 0 ? 1 : 0) << 3);
    }
    this._prevClk = clk;
    // Output enable: M=N=0
    const oe = !(this.getPin('M').value > 0) && !(this.getPin('N').value > 0);
    for (let i = 0; i < 4; i++) {
      this.getPin('Q' + (i + 1)).value = (oe && ((this._stored >> i) & 1)) ? 255 : 0;
    }
  }
}

// ─── 74LS245 — Octal Bus Transceiver ─────────────────────────────────────────
class IC_74LS245 extends DIPChipBase {
  constructor(x, y) {
    super('74LS245', x, y, '74LS245');
    this._icSubLabel = 'BUS XCVR';
    this.w = 140; this.h = 200;
  }
  _initPins() {
    this.pins = [
      _mp('DIR','in',1,'left',0),
      _mp('A1','in',1,'left',1), _mp('A2','in',1,'left',2),
      _mp('A3','in',1,'left',3), _mp('A4','in',1,'left',4),
      _mp('A5','in',1,'left',5), _mp('A6','in',1,'left',6),
      _mp('A7','in',1,'left',7), _mp('A8','in',1,'left',8),
      _mp('GND','pwr',1,'left',9),
      _mp('OE', 'in',1,'right',0),
      _mp('B1','out',1,'right',1), _mp('B2','out',1,'right',2),
      _mp('B3','out',1,'right',3), _mp('B4','out',1,'right',4),
      _mp('B5','out',1,'right',5), _mp('B6','out',1,'right',6),
      _mp('B7','out',1,'right',7), _mp('B8','out',1,'right',8),
      _mp('VCC','pwr',1,'right',9),
    ];
    this.h = 12 + 10 * 16 + 12;
  }
  simulate() {
    const oe  = this.getPin('OE').value === 0;  // active low
    const dir = this.getPin('DIR').value > 0;   // 1=A→B, 0=B→A (simplified: A→B always)
    for (let i = 1; i <= 8; i++) {
      this.getPin('B' + i).value = (oe && dir) ? this.getPin('A' + i).value : 0;
    }
  }
}

// ─── 74LS283 — 4-bit Binary Adder ────────────────────────────────────────────
class IC_74LS283 extends DIPChipBase {
  constructor(x, y) {
    super('74LS283', x, y, '74LS283');
    this._icSubLabel = '4-BIT ADD';
    this.w = 130; this.h = 180;
  }
  _initPins() {
    this.pins = [
      _mp('S2','out',1,'left',0), _mp('B2','in',1,'left',1),
      _mp('A2','in',1,'left',2),  _mp('S1','out',1,'left',3),
      _mp('A1','in',1,'left',4),  _mp('B1','in',1,'left',5),
      _mp('C0','in',1,'left',6),  _mp('GND','pwr',1,'left',7),
      _mp('VCC','pwr',1,'right',0), _mp('C4','out',1,'right',1),
      _mp('S4','out',1,'right',2),  _mp('A4','in',1,'right',3),
      _mp('B4','in',1,'right',4),   _mp('S3','out',1,'right',5),
      _mp('A3','in',1,'right',6),   _mp('B3','in',1,'right',7),
    ];
  }
  simulate() {
    const a = (this.getPin('A1').value > 0 ? 1 : 0)
            | ((this.getPin('A2').value > 0 ? 1 : 0) << 1)
            | ((this.getPin('A3').value > 0 ? 1 : 0) << 2)
            | ((this.getPin('A4').value > 0 ? 1 : 0) << 3);
    const b = (this.getPin('B1').value > 0 ? 1 : 0)
            | ((this.getPin('B2').value > 0 ? 1 : 0) << 1)
            | ((this.getPin('B3').value > 0 ? 1 : 0) << 2)
            | ((this.getPin('B4').value > 0 ? 1 : 0) << 3);
    const ci = this.getPin('C0').value > 0 ? 1 : 0;
    const sum = a + b + ci;
    this.getPin('S1').value = ((sum >> 0) & 1) ? 255 : 0;
    this.getPin('S2').value = ((sum >> 1) & 1) ? 255 : 0;
    this.getPin('S3').value = ((sum >> 2) & 1) ? 255 : 0;
    this.getPin('S4').value = ((sum >> 3) & 1) ? 255 : 0;
    this.getPin('C4').value = sum > 15 ? 255 : 0;
  }
}

// ─── 74LS161 — Synchronous 4-bit Counter ─────────────────────────────────────
class IC_74LS161 extends DIPChipBase {
  constructor(x, y) {
    super('74LS161', x, y, '74LS161');
    this._icSubLabel = '4-BIT CTR';
    this.w = 130; this.h = 180;
    this._count = 0;
    this._prevClk = 0;
  }
  _initPins() {
    this.pins = [
      _mp('CLR','in',1,'left',0), _mp('CLK','in',1,'left',1),
      _mp('A',  'in',1,'left',2), _mp('B',  'in',1,'left',3),
      _mp('C',  'in',1,'left',4), _mp('D',  'in',1,'left',5),
      _mp('ENP','in',1,'left',6), _mp('GND','pwr',1,'left',7),
      _mp('VCC','pwr',1,'right',0), _mp('LOAD','in',1,'right',1),
      _mp('ENT','in',1,'right',2),
      _mp('QA','out',1,'right',3), _mp('QB','out',1,'right',4),
      _mp('QC','out',1,'right',5), _mp('QD','out',1,'right',6),
      _mp('RCO','out',1,'right',7),
    ];
  }
  simulate(risingEdge) {
    // CLR is synchronous on 74LS161, active low
    const clk  = this.getPin('CLK').value > 0 ? 1 : 0;
    const clr  = this.getPin('CLR').value;
    const load = this.getPin('LOAD').value;
    const enp  = this.getPin('ENP').value;
    const ent  = this.getPin('ENT').value;
    if (risingEdge && clk && !this._prevClk) {
      if (!clr) { this._count = 0; }
      else if (!load) {
        this._count = (this.getPin('A').value > 0 ? 1 : 0)
                    | ((this.getPin('B').value > 0 ? 1 : 0) << 1)
                    | ((this.getPin('C').value > 0 ? 1 : 0) << 2)
                    | ((this.getPin('D').value > 0 ? 1 : 0) << 3);
      } else if (enp > 0 && ent > 0) {
        this._count = (this._count + 1) & 0xF;
      }
    }
    this._prevClk = clk;
    this.getPin('QA').value = ((this._count >> 0) & 1) ? 255 : 0;
    this.getPin('QB').value = ((this._count >> 1) & 1) ? 255 : 0;
    this.getPin('QC').value = ((this._count >> 2) & 1) ? 255 : 0;
    this.getPin('QD').value = ((this._count >> 3) & 1) ? 255 : 0;
    this.getPin('RCO').value = (this._count === 15 && ent > 0) ? 255 : 0;
  }
}

// ─── 555 Timer ────────────────────────────────────────────────────────────────
class Timer555Component extends BreadboardComponent {
  constructor(x, y) {
    super('555', x, y, '555 TIMER');
    this.w = 140; this.h = 160;
    this._mode   = 'astable';  // 'astable' | 'monostable'
    this._period = 4;           // pulses between toggles
    this._tick   = 0;
    this._out    = 0;
    this._triggered = false;
    this._monoCount = 0;
  }
  _initPins() {
    this.pins = [
      _mp('VCC', 'in',  1, 'left',  0),
      _mp('TRIG','in',  1, 'left',  1),
      _mp('THR', 'in',  1, 'left',  2),
      _mp('RST', 'in',  1, 'left',  3),
      _mp('CV',  'in',  1, 'left',  4),
      _mp('GND', 'in',  1, 'left',  5),
      _mp('DIS', 'in',  1, 'left',  6),
      _mp('OUT', 'out', 1, 'right', 0),
    ];
  }
  _bodyColor()   { return '#2a1800'; }
  _headerColor() { return '#3a2200'; }

  simulate(risingEdge) {
    const rst = this.getPin('RST').value;
    if (rst === 0) { this._out = 0; this.getPin('OUT').value = 0; return; }

    if (this._mode === 'astable') {
      if (risingEdge) {
        this._tick++;
        if (this._tick >= this._period) {
          this._tick = 0;
          this._out  = this._out ? 0 : 1;
        }
      }
    } else {
      // Monostable: trigger on TRIG going low
      const trig = this.getPin('TRIG').value;
      if (trig === 0 && !this._triggered) {
        this._triggered = true;
        this._monoCount = this._period;
        this._out = 1;
      }
      if (this._triggered) {
        if (risingEdge) { this._monoCount--; }
        if (this._monoCount <= 0) { this._triggered = false; this._out = 0; }
      }
    }
    this.getPin('OUT').value = this._out ? 255 : 0;
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2, cy = sy + sh / 2;
    // 555 chip outline drawing
    ctx.strokeStyle = '#cc6600'; ctx.lineWidth = 1.5;
    ctx.beginPath(); _rr(ctx, sx + 10 * cam.scale, sy + 20 * cam.scale,
                         sw - 20 * cam.scale, sh - 40 * cam.scale, 4 * cam.scale);
    ctx.stroke();
    ctx.font = `${Math.max(7, 9 * cam.scale)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#cc6600';
    ctx.fillText(this._mode.toUpperCase(), cx, cy - 6 * cam.scale);
    ctx.fillStyle = this._out ? '#ffaa00' : '#443300';
    ctx.fillText('OUT=' + this._out, cx, cy + 8 * cam.scale);
    ctx.fillStyle = '#443300';
    ctx.fillText('T=' + this._period + ' pulses', cx, cy + 20 * cam.scale);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  EXTENDED createComponent — appended to the original factory
// ═══════════════════════════════════════════════════════════════════

(function patchCreateComponent() {
  const _orig = window.createComponent;
  window.createComponent = function(type, x, y, opts) {
    opts = opts || {};
    switch (type) {
      // Power
      case 'VCC':       return new VCCComponent(x, y);
      case 'GND':       return new GNDComponent(x, y);
      case 'Battery':   return new BatteryComponent(x, y);
      // Passive
      case 'Resistor':  return new ResistorComponent(x, y);
      case 'Capacitor': return new CapacitorComponent(x, y);
      case 'Inductor':  return new InductorComponent(x, y);
      // Logic gates
      case 'AND':       return new ANDGateComponent(x, y);
      case 'OR':        return new ORGateComponent(x, y);
      case 'NOT':       return new NOTGateComponent(x, y);
      case 'NAND':      return new NANDGateComponent(x, y);
      case 'NOR':       return new NORGateComponent(x, y);
      case 'XOR':       return new XORGateComponent(x, y);
      case 'XNOR':      return new XNORGateComponent(x, y);
      case 'Buffer':    return new BufferComponent(x, y);
      // Combinational
      case 'HalfAdder': return new HalfAdderComponent(x, y);
      case 'FullAdder': return new FullAdderComponent(x, y);
      case 'Adder4':    return new Adder4BitComponent(x, y);
      case 'Dec2to4':   return new Decoder2to4Component(x, y);
      case 'Dec3to8':   return new Decoder3to8Component(x, y);
      case 'Enc8to3':   return new Encoder8to3Component(x, y);
      case 'PriEnc':    return new PriorityEncoderComponent(x, y);
      case 'Mux2to1':   return new Mux2to1Component(x, y);
      case 'Mux4to1':   return new Mux4to1Component(x, y);
      case 'Mux8to1':   return new Mux8to1Component(x, y);
      case 'Demux1to2': return new Demux1to2Component(x, y);
      case 'Demux1to4': return new Demux1to4Component(x, y);
      // Sequential
      case 'SRLatch':   return new SRLatchComponent(x, y);
      case 'DFF':       return new DFlipFlopComponent(x, y);
      case 'JKFF':      return new JKFlipFlopComponent(x, y);
      case 'TFF':       return new TFlipFlopComponent(x, y);
      case 'Counter4':  return new Counter4BitComponent(x, y);
      case 'ShiftReg':  return new ShiftRegister8Component(x, y);
      // Semiconductors
      case 'Diode':     return new DiodeComponent(x, y);
      case 'LED':       return new LEDComponent(x, y);
      case 'NPN':       return new NPNTransistorComponent(x, y);
      case 'PNP':       return new PNPTransistorComponent(x, y);
      case 'NMOS':      return new NMOSFETComponent(x, y);
      case 'PMOS':      return new PMOSFETComponent(x, y);
      case 'NJFET':     return new NJFETComponent(x, y);
      case 'PJFET':     return new PJFETComponent(x, y);
      case 'SCR':       return new SCRComponent(x, y);
      // Display
      case 'LEDBar':    return new LEDBarComponent(x, y);
      case '7Seg':      return new SevenSegDisplayComponent(x, y);
      case '7SegDec':   return new SevenSegDecoderComponent(x, y);
      // ICs
      case '74LS00':    return new IC_74LS00(x, y);
      case '74LS04':    return new IC_74LS04(x, y);
      case '74LS08':    return new IC_74LS08(x, y);
      case '74LS32':    return new IC_74LS32(x, y);
      case '74LS86':    return new IC_74LS86(x, y);
      case '74LS138':   return new IC_74LS138(x, y);
      case '74LS173':   return new IC_74LS173(x, y);
      case '74LS245':   return new IC_74LS245(x, y);
      case '74LS283':   return new IC_74LS283(x, y);
      case '74LS161':   return new IC_74LS161(x, y);
      case '555':       return new Timer555Component(x, y);
      // Fall through to original
      default:          return _orig(type, x, y, opts);
    }
  };
})();

// ═══════════════════════════════════════════════════════════════════
//  EXTEND PALETTE_ITEMS (appended categories)
//  Called after PALETTE_ITEMS is defined in bb-components.js
// ═══════════════════════════════════════════════════════════════════

(function extendPalette() {
  const PA = window.PALETTE_ITEMS;
  if (!PA) { console.error('bb-electronics: PALETTE_ITEMS not found'); return; }

  // Rename existing CPU section for clarity
  const first = PA.find(p => p.section);
  if (first) first.section = 'CPU Modules';

  PA.push(
    // ── Power ──────────────────────────────────────────────────────
    { section: 'Power' },
    { type: 'VCC',      label: 'VCC (+5V)',  desc: 'Logic HIGH supply',       pins: 'V+ out' },
    { type: 'GND',      label: 'GND',        desc: 'Logic LOW / ground',      pins: 'GND out' },
    { type: 'Battery',  label: 'Battery',    desc: 'Configurable voltage src', pins: '+ / - out' },

    // ── Passive ─────────────────────────────────────────────────────
    { section: 'Passive Components' },
    { type: 'Resistor', label: 'Resistor',   desc: 'Pass-through, 1kΩ default', pins: 'A in / B out' },
    { type: 'Capacitor',label: 'Capacitor',  desc: '1-cycle delay element',    pins: 'A in / B out' },
    { type: 'Inductor', label: 'Inductor',   desc: 'Opposes changes (1-cycle hold)', pins: 'A in / B out' },

    // ── Logic Gates ─────────────────────────────────────────────────
    { section: 'Logic Gates' },
    { type: 'AND',   label: 'AND Gate',  desc: 'Y = A AND B',  pins: 'A,B → Y' },
    { type: 'OR',    label: 'OR Gate',   desc: 'Y = A OR B',   pins: 'A,B → Y' },
    { type: 'NOT',   label: 'NOT Gate',  desc: 'Y = NOT A',    pins: 'A → Y' },
    { type: 'NAND',  label: 'NAND Gate', desc: 'Y = NOT(A AND B)', pins: 'A,B → Y' },
    { type: 'NOR',   label: 'NOR Gate',  desc: 'Y = NOT(A OR B)',  pins: 'A,B → Y' },
    { type: 'XOR',   label: 'XOR Gate',  desc: 'Y = A XOR B',      pins: 'A,B → Y' },
    { type: 'XNOR',  label: 'XNOR Gate', desc: 'Y = NOT(A XOR B)', pins: 'A,B → Y' },
    { type: 'Buffer',label: 'Buffer',    desc: 'Tri-state buffer',  pins: 'A,EN → Y' },

    // ── Combinational ────────────────────────────────────────────────
    { section: 'Combinational Logic' },
    { type: 'HalfAdder', label: 'Half Adder',  desc: 'Sum=A⊕B, Carry=AB', pins: 'A,B → S,C' },
    { type: 'FullAdder', label: 'Full Adder',  desc: '3-input adder cell', pins: 'A,B,Cin → S,Co' },
    { type: 'Adder4',    label: '4-bit Adder', desc: 'Like 74LS283',       pins: 'A[4],B[4],Ci → S[4],Co' },
    { type: 'Dec2to4',   label: 'Dec 2:4',     desc: '2-input decoder',    pins: 'S0,S1,EN → Y0-Y3' },
    { type: 'Dec3to8',   label: 'Dec 3:8',     desc: 'Like 74LS138',       pins: 'S0-S2,EN → Y0-Y7' },
    { type: 'Enc8to3',   label: 'Enc 8:3',     desc: '8-to-3 encoder',     pins: 'I0-I7 → A0-A2,V' },
    { type: 'PriEnc',    label: 'Pri Encoder', desc: 'Priority encoder',   pins: 'I0-I7 → A0-A2,V' },
    { type: 'Mux2to1',   label: 'Mux 2:1',     desc: '2-input multiplexer',pins: 'D0,D1,S → Y' },
    { type: 'Mux4to1',   label: 'Mux 4:1',     desc: '4-input multiplexer',pins: 'D0-D3,S0,S1 → Y' },
    { type: 'Mux8to1',   label: 'Mux 8:1',     desc: '8-input multiplexer',pins: 'D0-D7,S0-S2 → Y' },
    { type: 'Demux1to2', label: 'Demux 1:2',   desc: '1-to-2 demux',       pins: 'D,S → Y0,Y1' },
    { type: 'Demux1to4', label: 'Demux 1:4',   desc: '1-to-4 demux',       pins: 'D,S0,S1 → Y0-Y3' },

    // ── Sequential ───────────────────────────────────────────────────
    { section: 'Sequential Logic' },
    { type: 'SRLatch',  label: 'SR Latch',   desc: 'Set-Reset latch',     pins: 'S,R → Q,Qb' },
    { type: 'DFF',      label: 'D Flip-Flop',desc: 'Edge-triggered D-FF', pins: 'D,CLK → Q,Qb' },
    { type: 'JKFF',     label: 'JK Flip-Flop',desc:'Toggle / Set / Reset', pins: 'J,K,CLK → Q,Qb' },
    { type: 'TFF',      label: 'T Flip-Flop', desc: 'Toggle on CLK when T=1',pins: 'T,CLK → Q,Qb' },
    { type: 'Counter4', label: '4-bit Counter',desc:'Up counter, 0-15',   pins: 'CLK,RST,EN → Q0-Q3' },
    { type: 'ShiftReg', label: 'Shift Reg 8', desc: 'Serial-in, 8-bit out',pins: 'SI,CLK,RST → Q0-Q7' },

    // ── Semiconductors ───────────────────────────────────────────────
    { section: 'Semiconductors' },
    { type: 'Diode', label: 'Diode',     desc: 'One-way signal pass',  pins: 'A → K' },
    { type: 'LED',   label: 'LED',       desc: 'Glowing indicator',    pins: 'A → K' },
    { type: 'NPN',   label: 'NPN BJT',   desc: 'Base-switched pass',   pins: 'B,C → E' },
    { type: 'PNP',   label: 'PNP BJT',   desc: 'Active-LOW switch',    pins: 'B,E → C' },
    { type: 'NMOS',  label: 'N-MOSFET',  desc: 'Voltage-ctrl switch',  pins: 'G,D → S' },
    { type: 'PMOS',  label: 'P-MOSFET',  desc: 'Complement NMOS',      pins: 'G,S → D' },
    { type: 'NJFET', label: 'N-JFET',    desc: 'Normally ON, gate=0→off',pins:'G,D → S' },
    { type: 'PJFET', label: 'P-JFET',    desc: 'Normally ON, gate=1→off',pins:'G,S → D' },
    { type: 'SCR',   label: 'SCR',       desc: 'Latching thyristor',   pins: 'A,G → K' },

    // ── Display ──────────────────────────────────────────────────────
    { section: 'Display' },
    { type: 'LEDBar',   label: 'LED Bar 8',   desc: '8 LEDs in a row',       pins: 'D0-D7,GND' },
    { type: '7Seg',     label: '7-Segment',   desc: 'Segment inputs a-g,dp', pins: 'a-g,dp,COM' },
    { type: '7SegDec',  label: '7-Seg+Decode',desc: 'BCD input, auto decode',pins: 'B0-B3 → digit' },

    // ── 74LS ICs ─────────────────────────────────────────────────────
    { section: 'ICs (74LS Series)' },
    { type: '74LS00',  label: '74LS00',  desc: 'Quad NAND gate',      pins: '4x NAND, DIP-14' },
    { type: '74LS04',  label: '74LS04',  desc: 'Hex inverter',        pins: '6x NOT, DIP-14' },
    { type: '74LS08',  label: '74LS08',  desc: 'Quad AND gate',       pins: '4x AND, DIP-14' },
    { type: '74LS32',  label: '74LS32',  desc: 'Quad OR gate',        pins: '4x OR, DIP-14' },
    { type: '74LS86',  label: '74LS86',  desc: 'Quad XOR gate',       pins: '4x XOR, DIP-14' },
    { type: '74LS138', label: '74LS138', desc: '3-to-8 decoder',      pins: 'A,B,C,G1,G2A,G2B → Y0-Y7' },
    { type: '74LS173', label: '74LS173', desc: '4-bit D register',    pins: 'D1-D4,CLK,CLR → Q1-Q4' },
    { type: '74LS245', label: '74LS245', desc: 'Octal bus transceiver',pins: 'A1-A8,DIR,OE → B1-B8' },
    { type: '74LS283', label: '74LS283', desc: '4-bit binary adder',  pins: 'A1-A4,B1-B4,C0 → S1-S4,C4' },
    { type: '74LS161', label: '74LS161', desc: 'Sync 4-bit counter',  pins: 'CLK,CLR,LOAD,ENP,ENT → QA-QD' },
    { type: '555',     label: '555 Timer',desc:'Astable/monostable',  pins: 'VCC,TRIG,THR,RST → OUT' }
  );
})();

// ═══════════════════════════════════════════════════════════════════
//  EXTENDED INSPECTOR — add property details for electronic parts
// ═══════════════════════════════════════════════════════════════════

(function patchInspector() {
  // Hook into bbUpdateInspector by extending getInspectorData on our components
  // The engine already calls getInspectorData(); we just need to ensure the
  // inspector renders extra properties.  We patch bbUpdateInspector to append
  // electronics-specific sections after the core engine renders pins.

  const _engineReady = () => typeof window.bbUpdateInspector === 'function';

  function _patchWhenReady() {
    if (!_engineReady()) { setTimeout(_patchWhenReady, 200); return; }

    const _origUpdate = window.bbUpdateInspector;
    window.bbUpdateInspector = function() {
      _origUpdate();
      // After original renders, inject extra props for electronic components
      const comp = window.BB && window.BB.selected;
      if (!comp) return;
      const pane = document.getElementById('bb-stab-inspector');
      if (!pane) return;

      let extra = '';

      if (comp instanceof ResistorComponent) {
        extra = `<div class="bb-prop-section">
          <div class="bb-prop-label">Resistance</div>
          <div class="bb-prop-value">${comp._ohms >= 1000 ? (comp._ohms/1000) + 'kΩ' : comp._ohms + 'Ω'}</div>
          <button class="bb-ctrl-btn" style="margin-top:4px;font-size:10px" onclick="bbElecSetProp('_ohms','Resistance (Ω):',${comp._ohms})">Edit</button>
        </div>`;
      } else if (comp instanceof CapacitorComponent) {
        extra = `<div class="bb-prop-section">
          <div class="bb-prop-label">Capacitance</div>
          <div class="bb-prop-value">${comp._uf}nF</div>
          <button class="bb-ctrl-btn" style="margin-top:4px;font-size:10px" onclick="bbElecSetProp('_uf','Capacitance (nF):',${comp._uf})">Edit</button>
        </div>`;
      } else if (comp instanceof InductorComponent) {
        extra = `<div class="bb-prop-section">
          <div class="bb-prop-label">Inductance</div>
          <div class="bb-prop-value">${comp._mh}mH</div>
          <button class="bb-ctrl-btn" style="margin-top:4px;font-size:10px" onclick="bbElecSetProp('_mh','Inductance (mH):',${comp._mh})">Edit</button>
        </div>`;
      } else if (comp instanceof BatteryComponent) {
        extra = `<div class="bb-prop-section">
          <div class="bb-prop-label">Voltage</div>
          <div class="bb-prop-value">${comp._voltage}V</div>
          <button class="bb-ctrl-btn" style="margin-top:4px;font-size:10px" onclick="bbElecSetProp('_voltage','Voltage (V):',${comp._voltage})">Edit</button>
        </div>`;
      } else if (comp instanceof LEDComponent) {
        extra = `<div class="bb-prop-section">
          <div class="bb-prop-label">LED Color</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
            ${['red','green','blue','yellow','white'].map(c =>
              `<button class="bb-ctrl-btn" style="font-size:10px;padding:2px 6px;background:${c === comp._color ? '#1e3a2a':'#0f1a26'};color:${c}" onclick="bbElecSetColor('${c}')">${c}</button>`
            ).join('')}
          </div>
        </div>`;
      } else if (comp instanceof LEDBarComponent) {
        extra = `<div class="bb-prop-section">
          <div class="bb-prop-label">Bar Color</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
            ${['red','green','blue','yellow'].map(c =>
              `<button class="bb-ctrl-btn" style="font-size:10px;padding:2px 6px;background:${c === comp._color ? '#1e3a2a':'#0f1a26'};color:${c}" onclick="bbElecSetColor('${c}')">${c}</button>`
            ).join('')}
          </div>
        </div>`;
      } else if (comp instanceof Timer555Component) {
        extra = `<div class="bb-prop-section">
          <div class="bb-prop-label">Mode</div>
          <div style="display:flex;gap:4px;margin-top:4px">
            <button class="bb-ctrl-btn" style="font-size:10px;background:${comp._mode==='astable'?'#1e3a2a':'#0f1a26'}" onclick="bbElec555Mode('astable')">Astable</button>
            <button class="bb-ctrl-btn" style="font-size:10px;background:${comp._mode==='monostable'?'#1e3a2a':'#0f1a26'}" onclick="bbElec555Mode('monostable')">Monostable</button>
          </div>
          <div class="bb-prop-label" style="margin-top:6px">Period (pulses)</div>
          <div class="bb-prop-value">${comp._period}</div>
          <button class="bb-ctrl-btn" style="margin-top:4px;font-size:10px" onclick="bbElecSetProp('_period','Period (clock pulses):',${comp._period})">Edit</button>
        </div>`;
      } else if (comp instanceof Counter4BitComponent || comp instanceof IC_74LS161) {
        extra = `<div class="bb-prop-section">
          <div class="bb-prop-label">Current Count</div>
          <div class="bb-prop-value val-dec">${comp._count}</div>
          <div class="bb-prop-value">${(comp._count).toString(2).padStart(4,'0')}</div>
        </div>`;
      } else if (comp instanceof ShiftRegister8Component) {
        extra = `<div class="bb-prop-section">
          <div class="bb-prop-label">Shift Register</div>
          <div class="bb-prop-value">${comp._bits.toString(2).padStart(8,'0')}</div>
          <div class="bb-prop-value val-hex">0x${comp._bits.toString(16).toUpperCase().padStart(2,'0')}</div>
        </div>`;
      } else if (comp instanceof SRLatchComponent) {
        extra = `<div class="bb-prop-section">
          <div class="bb-prop-label">Latch State</div>
          <div class="bb-prop-value" style="color:${comp._q?'#ffff00':'#4a4a00'}">Q = ${comp._q}</div>
        </div>`;
      } else if (comp instanceof SCRComponent) {
        extra = `<div class="bb-prop-section">
          <div class="bb-prop-label">SCR State</div>
          <div class="bb-prop-value" style="color:${comp._latched?'#ff4444':'#442222'}">${comp._latched ? 'LATCHED (conducting)' : 'OPEN'}</div>
        </div>`;
      }

      if (extra) {
        const tmp = document.createElement('div');
        tmp.innerHTML = extra;
        // Insert before delete button
        const delBtn = pane.querySelector('.bb-delete-btn');
        if (delBtn) { delBtn.parentNode.insertBefore(tmp, delBtn); }
        else         { pane.appendChild(tmp); }
      }
    };
  }
  _patchWhenReady();
})();

// ─── Inspector helper functions (called from inline HTML above) ──────────────
window.bbElecSetProp = function(prop, label, current) {
  const comp = window.BB && window.BB.selected;
  if (!comp) return;
  const v = prompt(label, current);
  if (v !== null) {
    const n = parseFloat(v);
    if (!isNaN(n) && n > 0) {
      comp[prop] = n;
      if (typeof window.bbSaveState === 'function') window.bbSaveState();
      if (typeof window.bbUpdateInspector === 'function') window.bbUpdateInspector();
    }
  }
};

window.bbElecSetColor = function(color) {
  const comp = window.BB && window.BB.selected;
  if (!comp) return;
  comp._color = color;
  if (typeof window.bbSaveState === 'function') window.bbSaveState();
  if (typeof window.bbUpdateInspector === 'function') window.bbUpdateInspector();
};

window.bbElec555Mode = function(mode) {
  const comp = window.BB && window.BB.selected;
  if (!comp || !(comp instanceof Timer555Component)) return;
  comp._mode = mode;
  comp._tick = 0; comp._out = 0; comp._triggered = false;
  if (typeof window.bbSaveState === 'function') window.bbSaveState();
  if (typeof window.bbUpdateInspector === 'function') window.bbUpdateInspector();
};

// ─── Extend bbReset to include electronic sequential components ──────────────
(function patchReset() {
  const _ready = () => typeof window.bbReset === 'function';
  function _patch() {
    if (!_ready()) { setTimeout(_patch, 200); return; }
    const _origReset = window.bbReset;
    window.bbReset = function() {
      _origReset();
      if (!window.BB) return;
      for (const comp of window.BB.components) {
        if (comp instanceof SRLatchComponent)    { comp._q = 0; }
        if (comp instanceof DFlipFlopComponent)  { comp._q = 0; comp._prevClk = 0; }
        if (comp instanceof JKFlipFlopComponent) { comp._q = 0; comp._prevClk = 0; }
        if (comp instanceof TFlipFlopComponent)  { comp._q = 0; comp._prevClk = 0; }
        if (comp instanceof Counter4BitComponent){ comp._count = 0; comp._prevClk = 0; }
        if (comp instanceof ShiftRegister8Component){ comp._bits = 0; comp._prevClk = 0; }
        if (comp instanceof CapacitorComponent)  { comp._prev = 0; }
        if (comp instanceof InductorComponent)   { comp._prev = 0; }
        if (comp instanceof SCRComponent)        { comp._latched = false; }
        if (comp instanceof Timer555Component)   { comp._tick = 0; comp._out = 0; comp._triggered = false; }
        if (comp instanceof IC_74LS161) { comp._count = 0; comp._prevClk = 0; }
        if (comp instanceof IC_74LS173){ comp._stored = 0; comp._prevClk = 0; }
      }
    };
  }
  _patch();
})();

// ─── Exports ─────────────────────────────────────────────────────────────────
window.VCCComponent           = VCCComponent;
window.GNDComponent           = GNDComponent;
window.BatteryComponent       = BatteryComponent;
window.ResistorComponent      = ResistorComponent;
window.CapacitorComponent     = CapacitorComponent;
window.InductorComponent      = InductorComponent;
window.ANDGateComponent       = ANDGateComponent;
window.ORGateComponent        = ORGateComponent;
window.NOTGateComponent       = NOTGateComponent;
window.NANDGateComponent      = NANDGateComponent;
window.NORGateComponent       = NORGateComponent;
window.XORGateComponent       = XORGateComponent;
window.XNORGateComponent      = XNORGateComponent;
window.BufferComponent        = BufferComponent;
window.HalfAdderComponent     = HalfAdderComponent;
window.FullAdderComponent     = FullAdderComponent;
window.Adder4BitComponent     = Adder4BitComponent;
window.Decoder2to4Component   = Decoder2to4Component;
window.Decoder3to8Component   = Decoder3to8Component;
window.Encoder8to3Component   = Encoder8to3Component;
window.PriorityEncoderComponent = PriorityEncoderComponent;
window.Mux2to1Component       = Mux2to1Component;
window.Mux4to1Component       = Mux4to1Component;
window.Mux8to1Component       = Mux8to1Component;
window.Demux1to2Component     = Demux1to2Component;
window.Demux1to4Component     = Demux1to4Component;
window.SRLatchComponent       = SRLatchComponent;
window.DFlipFlopComponent     = DFlipFlopComponent;
window.JKFlipFlopComponent    = JKFlipFlopComponent;
window.TFlipFlopComponent     = TFlipFlopComponent;
window.Counter4BitComponent   = Counter4BitComponent;
window.ShiftRegister8Component= ShiftRegister8Component;
window.DiodeComponent         = DiodeComponent;
window.LEDComponent           = LEDComponent;
window.NPNTransistorComponent = NPNTransistorComponent;
window.PNPTransistorComponent = PNPTransistorComponent;
window.NMOSFETComponent       = NMOSFETComponent;
window.PMOSFETComponent       = PMOSFETComponent;
window.NJFETComponent         = NJFETComponent;
window.PJFETComponent         = PJFETComponent;
window.SCRComponent           = SCRComponent;
window.LEDBarComponent        = LEDBarComponent;
window.SevenSegDisplayComponent    = SevenSegDisplayComponent;
window.SevenSegDecoderComponent    = SevenSegDecoderComponent;
window.IC_74LS00              = IC_74LS00;
window.IC_74LS04              = IC_74LS04;
window.IC_74LS08              = IC_74LS08;
window.IC_74LS32              = IC_74LS32;
window.IC_74LS86              = IC_74LS86;
window.IC_74LS138             = IC_74LS138;
window.IC_74LS173             = IC_74LS173;
window.IC_74LS245             = IC_74LS245;
window.IC_74LS283             = IC_74LS283;
window.IC_74LS161             = IC_74LS161;
window.Timer555Component      = Timer555Component;
