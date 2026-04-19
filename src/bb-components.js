/**
 * Breadboard Build Mode — Component implementations
 * Depends on bb-core.js (BreadboardComponent, Wire)
 */

// ─── Helper ────────────────────────────────────────────────────────────────
function makePin(name, dir, bits, side, index) {
  return { name, dir, bits: bits || 1, side, index, value: 0, _connected: false };
}

// ══════════════════════════════════════════════════════════════════
//  CLOCK
// ══════════════════════════════════════════════════════════════════
class ClockComponent extends BreadboardComponent {
  constructor(x, y) {
    super('Clock', x, y, 'CLOCK');
    this.w = 120; this.h = 80;
    this._phase    = 0;   // 0 = low, 1 = high
    this._ticks    = 0;
    this._autoRun  = false;
    this._autoInterval = null;
  }
  _initPins() {
    this.pins = [
      makePin('CLK', 'out', 1, 'right', 0),
    ];
  }
  _bodyColor()   { return '#0d1e10'; }
  _headerColor() { return '#143020'; }

  pulse() {
    this._phase = 1;
    this.getPin('CLK').value = 1;
    this._ticks++;
    // Return to low after "pulse" — callers read value, then we drop it
    // actual drop happens after simulate propagation
  }
  latchLow() {
    this._phase = 0;
    this.getPin('CLK').value = 0;
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.45) return;
    const cx = sx + sw / 2;
    const cy = sy + sh / 2 + 6 * cam.scale;
    const bw = 30 * cam.scale;
    const bh = 14 * cam.scale;

    // Clock waveform mini
    const pts = this._buildWaveform(cam);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x + sx + 8*cam.scale, p.y + sy + 26*cam.scale)
                                   : ctx.lineTo(p.x + sx + 8*cam.scale, p.y + sy + 26*cam.scale));
    ctx.stroke();

    // Phase indicator
    ctx.font         = `bold ${Math.max(8, 9*cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = this._phase ? '#00ff88' : '#1a4a2a';
    ctx.fillText(this._phase ? 'HIGH' : 'LOW', cx, sy + sh - 12 * cam.scale);
  }

  _buildWaveform(cam) {
    const w   = 100 * cam.scale;
    const h   = 18  * cam.scale;
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t   = i / 8;
      const bit = (Math.floor(i / 2) + this._phase) % 2;
      pts.push({ x: t * w, y: bit === 1 ? 0 : h });
    }
    return pts;
  }

  simulate() { /* CLK driven externally via pulse() */ }

  get description() {
    return 'The Clock generates regular pulses that synchronize every component. Think of it as the heartbeat of the CPU — every action (loading a register, reading RAM, incrementing the PC) happens in step with a clock edge. Without a clock, the CPU cannot advance. In Ben Eater\'s hardware, this is a 555-timer oscillator circuit.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  8-BIT REGISTER
// ══════════════════════════════════════════════════════════════════
class RegisterComponent extends BreadboardComponent {
  constructor(x, y, label) {
    super('Register', x, y, label || 'REG-A');
    this.w = 140; this.h = 110;
    this._stored = 0;
    this._color  = '#0d1e3a';
  }
  _initPins() {
    this.pins = [
      makePin('D',      'in',  8, 'left',  0),
      makePin('CLK',    'in',  1, 'left',  1),
      makePin('LOAD',   'in',  1, 'left',  2),
      makePin('ENABLE', 'in',  1, 'left',  3),
      makePin('Q',      'out', 8, 'right', 0),   // Tri-state: drives bus only when ENABLE
      makePin('DIRECT', 'out', 8, 'right', 1),   // Always outputs stored value (for ALU)
    ];
  }
  _bodyColor()   { return this._color; }
  _headerColor() { return '#142040'; }

  simulate(risingEdge) {
    const clk    = this.getPin('CLK').value;
    const load   = this.getPin('LOAD').value;
    const enable = this.getPin('ENABLE').value;
    const d      = this.getPin('D').value;

    if (risingEdge && clk && load) {
      this._stored = d & 0xFF;
    }

    this.getPin('Q').value = enable ? this._stored : 0;
    this.getPin('DIRECT').value = this._stored;  // Always available (e.g. for ALU)
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    this._drawValueBadge(ctx, cam, sx, sy, sw, sh, this._stored, 8);
  }

  get description() {
    return 'A Register is an 8-bit flip-flop with tri-state output. It can LOAD data from the bus (when AI or BI is high on a clock edge) and can DRIVE data onto the bus (when AO or BO is high). Register A is the accumulator — the ALU always reads from A. Register B is the second operand for ALU operations. In hardware, this is a 74LS173 register chip plus a 74LS245 bus transceiver.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  BUS (8-bit bundle)
// ══════════════════════════════════════════════════════════════════
class BusComponent extends BreadboardComponent {
  constructor(x, y) {
    super('Bus', x, y, 'DATA BUS');
    this.w = 160; this.h = 50;
    this._value = 0;
    this._driver = 'none';
  }
  _initPins() {
    // Each port has IN + OUT pair — wire a component's DOUT to a port's IN,
    // and wire the same port's OUT to other components' DIN.
    // This mirrors reality: each component connects to the bus at ONE point
    // and can both read and write through that connection.
    this.pins = [
      makePin('P0_IN', 'in',  8, 'left',  0),  makePin('P0_OUT','out', 8, 'right', 0),
      makePin('P1_IN', 'in',  8, 'left',  1),  makePin('P1_OUT','out', 8, 'right', 1),
      makePin('P2_IN', 'in',  8, 'left',  2),  makePin('P2_OUT','out', 8, 'right', 2),
      makePin('P3_IN', 'in',  8, 'left',  3),  makePin('P3_OUT','out', 8, 'right', 3),
      makePin('P4_IN', 'in',  8, 'left',  4),  makePin('P4_OUT','out', 8, 'right', 4),
    ];
    this.h = 12 + 5 * 16 + 12;
  }
  _bodyColor()   { return '#1a1600'; }
  _headerColor() { return '#2a2200'; }

  simulate() {
    // Read inputs — components set DOUT=0 when ENABLE is off,
    // so bus naturally clears when nobody is driving
    let drivers = 0;
    let val     = 0;
    for (let i = 0; i < 5; i++) {
      const p = this.getPin('P' + i + '_IN');
      if (p && p.value !== 0) { drivers++; val = p.value; }
    }
    this._value       = val;
    this._contention  = drivers > 1;
    for (let i = 0; i < 5; i++) {
      const p = this.getPin('P' + i + '_OUT');
      if (p) p.value = val;
    }
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2;
    const cy = sy + sh / 2 + 2;
    ctx.font         = `bold ${Math.max(9, 10*cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = this._contention ? '#ff4444' : (this._value ? '#ffaa00' : '#2a2200');
    ctx.fillText(
      this._contention ? 'CONTENTION!' : '0x' + (this._value & 0xFF).toString(16).toUpperCase().padStart(2,'0'),
      cx, cy + 8 * cam.scale
    );
    // Bus line graphic
    ctx.strokeStyle = this._contention ? '#ff4444' : (this._value ? '#ffaa00' : '#2a2200');
    ctx.lineWidth   = 3 * cam.scale;
    ctx.beginPath();
    ctx.moveTo(sx + 14 * cam.scale, sy + sh/2);
    ctx.lineTo(sx + sw - 14 * cam.scale, sy + sh/2);
    ctx.stroke();
  }

  get description() {
    return 'The Data Bus is the shared 8-bit highway that all components use to communicate. Only ONE component should drive the bus at any time — the Control Unit ensures this by activating only one "Out" signal per T-state. If two components try to drive simultaneously, you get BUS CONTENTION (shown in red), which can damage real hardware. This models the physical backplane wire shared by all chips.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  ADDRESS BUS (4-bit)
// ══════════════════════════════════════════════════════════════════
class AddressBusComponent extends BreadboardComponent {
  constructor(x, y) {
    super('AddrBus', x, y, 'ADDR BUS');
    this.w = 140; this.h = 50;
    this._value = 0;
  }
  _initPins() {
    // Each port = one connection point (IN + OUT pair)
    this.pins = [
      makePin('P0_IN', 'in',  4, 'left',  0),  makePin('P0_OUT','out', 4, 'right', 0),  // e.g. PC
      makePin('P1_IN', 'in',  4, 'left',  1),  makePin('P1_OUT','out', 4, 'right', 1),  // e.g. IR operand
      makePin('P2_IN', 'in',  4, 'left',  2),  makePin('P2_OUT','out', 4, 'right', 2),  // e.g. MAR
    ];
    this.h = 12 + 3 * 16 + 12;
  }
  _bodyColor()   { return '#0a1a00'; }
  _headerColor() { return '#1a2a00'; }

  simulate() {
    let drivers = 0;
    let val = 0;
    for (let i = 0; i < 3; i++) {
      const p = this.getPin('P' + i + '_IN');
      if (p && p.value !== 0) { drivers++; val = p.value; }
    }
    this._value = val & 0x0F;
    this._contention = drivers > 1;
    for (let i = 0; i < 3; i++) {
      const p = this.getPin('P' + i + '_OUT');
      if (p) p.value = this._value;
    }
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2;
    const cy = sy + sh / 2 + 2;
    ctx.font = `bold ${Math.max(9, 10*cam.scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this._contention ? '#ff4444' : (this._value ? '#44cc66' : '#1a2a00');
    ctx.fillText(
      this._contention ? 'CONTENTION!' : '0x' + (this._value).toString(16).toUpperCase(),
      cx, cy + 8 * cam.scale
    );
    ctx.strokeStyle = this._contention ? '#ff4444' : (this._value ? '#44cc66' : '#1a2a00');
    ctx.lineWidth = 3 * cam.scale;
    ctx.beginPath();
    ctx.moveTo(sx + 14 * cam.scale, sy + sh/2);
    ctx.lineTo(sx + sw - 14 * cam.scale, sy + sh/2);
    ctx.stroke();
  }

  get description() {
    return 'The Address Bus is the 4-bit highway used to select a RAM address (0–15). It carries the value from the Program Counter (during fetch) or the IR operand (during execute) to the Memory Address Register. The MAR then holds that address steady while RAM is read or written. This separation keeps the address stable even as the data bus changes.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  ALU
// ══════════════════════════════════════════════════════════════════
class ALUComponent extends BreadboardComponent {
  constructor(x, y) {
    super('ALU', x, y, 'ALU');
    this.w = 140; this.h = 120;
    this._result = 0;
    this._cf = 0; this._zf = 0;
  }
  _initPins() {
    this.pins = [
      makePin('A',    'in',  8, 'left',  0),
      makePin('B',    'in',  8, 'left',  1),
      makePin('SUB',  'in',  1, 'left',  2),
      makePin('CLK',    'in',  1, 'left',  3),
      makePin('ENABLE','in',  1, 'left',  4),   // EO signal — output result to bus
      makePin('OUT',   'out', 8, 'right', 0),
      makePin('CF',    'out', 1, 'right', 1),
      makePin('ZF',    'out', 1, 'right', 2),
    ];
  }
  _bodyColor()   { return '#1a0e00'; }
  _headerColor() { return '#2a1800'; }

  simulate() {
    const a   = this.getPin('A').value & 0xFF;
    const b   = this.getPin('B').value & 0xFF;
    const sub = this.getPin('SUB').value;

    let result, cf;
    if (sub) {
      result = (a - b) & 0x1FF;
      cf     = a >= b ? 1 : 0;
    } else {
      result = (a + b) & 0x1FF;
      cf     = result > 0xFF ? 1 : 0;
    }
    this._result = result & 0xFF;
    this._cf     = cf;
    this._zf     = this._result === 0 ? 1 : 0;

    const enable = this.getPin('ENABLE');
    this.getPin('OUT').value = (enable && enable.value) ? this._result : 0;
    this.getPin('CF').value  = this._cf;
    this.getPin('ZF').value  = this._zf;
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2;
    const cy = sy + sh / 2 + 4 * cam.scale;
    const a  = this.getPin('A').value;
    const b  = this.getPin('B').value;
    const op = this.getPin('SUB').value ? '-' : '+';

    ctx.font         = `${Math.max(8, 9*cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ffaa00';
    ctx.fillText(`${a} ${op} ${b} = ${this._result}`, cx, cy);
    ctx.fillStyle = '#4a6278';
    ctx.fillText(`CF=${this._cf} ZF=${this._zf}`, cx, cy + 13 * cam.scale);
  }

  get description() {
    return 'The ALU (Arithmetic Logic Unit) is the CPU\'s calculator. It adds (A + B) or subtracts (A - B) the values in registers A and B. After every operation it updates the Carry Flag (CF=1 if overflow) and Zero Flag (ZF=1 if result is zero). The EO (ALU Enable Out) signal puts the result onto the data bus so it can be stored back into A. In hardware, this is a pair of 74LS283 adder chips.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  RAM MODULE
// ══════════════════════════════════════════════════════════════════
class RAMComponent extends BreadboardComponent {
  constructor(x, y) {
    super('RAM', x, y, 'RAM 16x8');
    this.w = 150; this.h = 180;
    this._mem  = new Uint8Array(16);  // 16 addresses × 8 bits
    this._lastAddr = 0;
    this._editing = false;
  }
  _initPins() {
    this.pins = [
      makePin('ADDR',  'in',  4, 'left',  0),   // 4-bit address from MAR
      makePin('DIN',   'in',  8, 'left',  1),   // 8-bit data from data bus
      makePin('WR',    'in',  1, 'left',  2),   // RI signal — write
      makePin('RD',    'in',  1, 'left',  3),   // RO signal — read
      makePin('CLK',   'in',  1, 'left',  4),
      makePin('DOUT',  'out', 8, 'right', 0),   // 8-bit data to data bus
    ];
  }
  _bodyColor()   { return '#1a1200'; }
  _headerColor() { return '#2a1c00'; }

  loadBytes(bytes) {
    for (let i = 0; i < Math.min(bytes.length, 16); i++) this._mem[i] = bytes[i] & 0xFF;
  }

  // Called from double-click handler to open RAM editor
  openEditor() {
    const mnemonics = {0x00:'NOP',0x01:'LDA',0x02:'ADD',0x03:'SUB',0x04:'STA',
      0x05:'LDI',0x06:'JMP',0x07:'JC',0x08:'JZ',0x0E:'OUT',0x0F:'HLT'};
    const revMnem = {};
    for (const [k,v] of Object.entries(mnemonics)) revMnem[v] = parseInt(k);

    let html = '<div style="font-family:monospace;font-size:13px;background:#111;padding:12px;border-radius:8px;max-width:320px">';
    html += '<div style="color:#ffaa00;font-size:14px;font-weight:bold;margin-bottom:8px">RAM Editor — 16 addresses</div>';
    html += '<div style="color:#888;font-size:11px;margin-bottom:8px">Enter hex (1E) or mnemonic (LDA 14)</div>';
    for (let i = 0; i < 16; i++) {
      const val = this._mem[i];
      const opcode = (val >> 4) & 0x0F;
      const operand = val & 0x0F;
      const mnem = mnemonics[opcode];
      // Show mnemonic for instructions, plain decimal for data values
      let display;
      if (val === 0) {
        display = '0';
      } else if (mnem && opcode > 0) {
        display = operand > 0 ? `${mnem} ${operand}` : mnem;
      } else {
        display = String(val);
      }
      html += `<div style="display:flex;align-items:center;margin:2px 0">`;
      html += `<span style="color:#666;width:30px">${i.toString().padStart(2,' ')}:</span>`;
      html += `<input id="ram-edit-${i}" value="${display}" style="background:#222;color:#ffcc00;border:1px solid #333;padding:3px 6px;width:100px;font-family:monospace;font-size:12px;border-radius:3px" />`;
      html += `<span style="color:#444;font-size:10px;margin-left:6px">0x${val.toString(16).toUpperCase().padStart(2,'0')}</span>`;
      html += `</div>`;
    }
    html += '<button id="ram-save-btn" style="margin-top:10px;background:#2a6a2a;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-family:monospace">Save</button>';
    html += ' <button id="ram-cancel-btn" style="margin-top:10px;background:#444;color:#fff;border:none;padding:6px 16px;border-radius:4px;cursor:pointer;font-family:monospace">Cancel</button>';
    html += '</div>';

    // Show in a modal overlay
    let overlay = document.getElementById('ram-editor-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ram-editor-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = html;
    overlay.style.display = 'flex';

    const self = this;
    document.getElementById('ram-save-btn').addEventListener('click', () => {
      for (let i = 0; i < 16; i++) {
        const input = document.getElementById(`ram-edit-${i}`);
        const raw = input.value.trim().toUpperCase();
        let val = 0;
        // Try parsing as mnemonic first (e.g. "LDA 14")
        const parts = raw.split(/\s+/);
        if (revMnem[parts[0]] !== undefined) {
          val = (revMnem[parts[0]] << 4) | (parseInt(parts[1] || '0') & 0x0F);
        } else if (raw.startsWith('0X')) {
          val = parseInt(raw, 16) & 0xFF;
        } else if (/^\d+$/.test(raw)) {
          val = parseInt(raw) & 0xFF;
        } else if (/^[0-9A-F]{1,2}$/.test(raw)) {
          val = parseInt(raw, 16) & 0xFF;
        }
        self._mem[i] = val;
      }
      overlay.style.display = 'none';
      if (typeof bbSaveState === 'function') bbSaveState();
    });
    document.getElementById('ram-cancel-btn').addEventListener('click', () => {
      overlay.style.display = 'none';
    });
  }

  get description() {
    return 'RAM (Random Access Memory) stores the program and its data. This 16-byte memory grid is addressed by the MAR — the CPU sets an address, then either reads (RD=1, DOUT → data bus) or writes (WR=1, data bus → DIN). The program is stored in bytes at addresses 0–15. Double-click the RAM chip to edit its contents directly. In Ben Eater\'s design, this is a 74LS189 SRAM chip.';
  }

  simulate(risingEdge) {
    const addr = this.getPin('ADDR').value & 0x0F;  // 4-bit address
    const wrPin = this.getPin('WR');
    const rdPin = this.getPin('RD');
    const wr = wrPin._connected ? wrPin.value : 0;  // only write if WR is actually wired
    const rd = rdPin._connected ? rdPin.value : 0;  // only read if RD is actually wired
    this._lastAddr = addr;

    const clk = this.getPin('CLK').value;
    if (risingEdge && clk && wr === 1) {
      this._mem[addr] = this.getPin('DIN').value & 0xFF;
    }
    this.getPin('DOUT').value = rd ? this._mem[addr] : 0;
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.45) return;
    const addr = this._lastAddr;
    const val  = this._mem[addr];
    const cx   = sx + sw / 2;
    ctx.font         = `${Math.max(8, 9*cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#d29922';
    ctx.fillText(`[${addr}] = 0x${val.toString(16).toUpperCase().padStart(2,'0')}`, cx, sy + sh * 0.35);

    if (cam.scale >= 0.5) {
      // Show all 16 addresses
      const fs = Math.max(7, 8 * cam.scale);
      ctx.font = `${fs}px monospace`;
      const startY = sy + sh * 0.45;
      const lineH = fs + 2;
      for (let i = 0; i < 16; i++) {
        const v = this._mem[i];
        const y = startY + (i % 8) * lineH;
        const x = i < 8 ? sx + 10 * cam.scale : sx + sw / 2 + 5 * cam.scale;
        ctx.fillStyle = i === addr ? '#ffcc00' : '#665500';
        const hex = v.toString(16).toUpperCase().padStart(2, '0');
        ctx.textAlign = 'left';
        ctx.fillText(`${i.toString(16).toUpperCase()}: ${hex}`, x, y);
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════
//  PROGRAM COUNTER
// ══════════════════════════════════════════════════════════════════
class ProgramCounterComponent extends BreadboardComponent {
  constructor(x, y) {
    super('PC', x, y, 'PROG CTR');
    this.w = 140; this.h = 100;
    this._count = 0;
  }
  _initPins() {
    this.pins = [
      makePin('CLK',    'in',  1, 'left',  0),
      makePin('INC',    'in',  1, 'left',  1),   // CE signal — increment by 1
      makePin('LOAD',   'in',  1, 'left',  2),   // J signal — load from address bus
      makePin('DIN',    'in',  4, 'left',  3),   // 4-bit input from address bus (for JMP)
      makePin('ENABLE', 'in',  1, 'left',  4),   // CO signal — output to address bus
      makePin('RESET',  'in',  1, 'left',  5),
      makePin('DOUT',   'out', 4, 'right', 0),   // 4-bit output to address bus
    ];
  }
  _bodyColor()   { return '#0d1e40'; }
  _headerColor() { return '#142060'; }

  simulate(risingEdge) {
    if (risingEdge) {
      if (this.getPin('RESET').value) { this._count = 0; }
      else if (this.getPin('LOAD').value)  { this._count = this.getPin('DIN').value & 0x0F; }
      else if (this.getPin('INC').value)   { this._count = (this._count + 1) & 0x0F; }
    }
    this.getPin('DOUT').value = this.getPin('ENABLE').value ? this._count : 0;
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    this._drawValueBadge(ctx, cam, sx, sy, sw, sh, this._count, 4);
  }

  get description() {
    return 'The Program Counter (PC) keeps track of which instruction the CPU is executing next. Every fetch cycle, the PC outputs its address (CO signal) to select the instruction from RAM, then increments (CE signal) to point to the next one. Jump instructions load a new address into the PC directly (J signal), changing which instruction executes next — that\'s how loops and branches work. Equivalent to a 74LS161 binary counter.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  MAR (Memory Address Register)
// ══════════════════════════════════════════════════════════════════
class MARComponent extends BreadboardComponent {
  constructor(x, y) {
    super('MAR', x, y, 'MAR');
    this.w = 130; this.h = 90;
    this._stored = 0;
  }
  _initPins() {
    this.pins = [
      makePin('DIN',  'in',  4, 'left',  0),   // 4-bit input from address bus
      makePin('CLK',  'in',  1, 'left',  1),
      makePin('LOAD', 'in',  1, 'left',  2),   // MI signal
      makePin('ADDR', 'out', 4, 'right', 0),   // 4-bit output hardwired to RAM
    ];
  }
  _bodyColor()   { return '#0d2a1a'; }
  _headerColor() { return '#143820'; }

  simulate(risingEdge) {
    if (risingEdge && this.getPin('CLK').value && this.getPin('LOAD').value) {
      this._stored = this.getPin('DIN').value & 0x0F;  // 4-bit only
    }
    this.getPin('ADDR').value = this._stored;
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    this._drawValueBadge(ctx, cam, sx, sy, sw, sh, this._stored, 4);
  }

  get description() {
    return 'The Memory Address Register (MAR) is a 4-bit latch that holds the current RAM address being accessed. It acts as a buffer between the address bus and RAM — the CPU puts an address on the bus, MAR latches it (MI signal), then the bus is free for other data while RAM uses the stable address from MAR. Without this buffer, the address on the bus and the data on the bus would collide. Equivalent to a 74LS173 register.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  INSTRUCTION REGISTER
// ══════════════════════════════════════════════════════════════════
class InstructionRegisterComponent extends BreadboardComponent {
  constructor(x, y) {
    super('IR', x, y, 'INSTR REG');
    this.w = 140; this.h = 100;
    this._stored = 0;
  }
  _initPins() {
    this.pins = [
      makePin('DIN',       'in',  8, 'left',  0),  // 8-bit input from data bus
      makePin('CLK',       'in',  1, 'left',  1),
      makePin('LOAD',      'in',  1, 'left',  2),  // II signal — latch from bus
      makePin('ENABLE',    'in',  1, 'left',  3),  // IO signal — output operand
      makePin('OPCODE',    'out', 8, 'right', 0),  // Upper 4 bits → CU (always, full byte)
      makePin('OPERAND',   'out', 4, 'right', 1),  // Lower 4 bits → address bus (when ENABLE)
      makePin('OPERAND_D', 'out', 8, 'right', 2),  // Lower 4 bits → data bus (when ENABLE, for LDI)
    ];
  }
  _bodyColor()   { return '#2a0f2a'; }
  _headerColor() { return '#3a1a3a'; }

  simulate(risingEdge) {
    if (risingEdge && this.getPin('CLK').value && this.getPin('LOAD').value) {
      this._stored = this.getPin('DIN').value & 0xFF;
    }
    // OPCODE always outputs the full byte (CU reads upper 4 — hardwired)
    this.getPin('OPCODE').value = this._stored;
    const enabled = this.getPin('ENABLE').value;
    // OPERAND outputs lower 4 bits to address bus when IO is active
    this.getPin('OPERAND').value = enabled ? (this._stored & 0x0F) : 0;
    // OPERAND_D outputs lower 4 bits to data bus when IO is active (for LDI)
    this.getPin('OPERAND_D').value = enabled ? (this._stored & 0x0F) : 0;
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const mnemonics = {0x00:'NOP',0x01:'LDA',0x02:'ADD',0x03:'SUB',0x04:'STA',
      0x05:'LDI',0x06:'JMP',0x07:'JC',0x08:'JZ',0x0E:'OUT',0x0F:'HLT'};
    const mnem = mnemonics[this._stored] || '???';
    const cx   = (this.x + this.w/2) * cam.scale + cam.ox;
    const cy   = (this.y + this.h/2 + 4) * cam.scale + cam.oy;
    ctx.font         = `bold ${Math.max(9, 11*cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#dd88ff';
    ctx.fillText(mnem + ' (0x' + this._stored.toString(16).toUpperCase().padStart(2,'0') + ')', cx, cy);
  }

  get description() {
    return 'The Instruction Register holds the byte fetched from RAM during the fetch cycle. The upper 4 bits are the OPCODE (which instruction: ADD, LDA, JMP...) and the lower 4 bits are the OPERAND (which RAM address or immediate value to use). The OPCODE wires permanently to the Control Unit so it knows what instruction to execute. The OPERAND drives the address bus (IO signal) when needed for execute-phase memory accesses.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  FLAGS REGISTER
// ══════════════════════════════════════════════════════════════════
class FlagsComponent extends BreadboardComponent {
  constructor(x, y) {
    super('Flags', x, y, 'FLAGS');
    this.w = 130; this.h = 90;
    this._cf = 0; this._zf = 0;
  }
  _initPins() {
    this.pins = [
      makePin('CF_IN', 'in',  1, 'left',  0),
      makePin('ZF_IN', 'in',  1, 'left',  1),
      makePin('CLK',   'in',  1, 'left',  2),
      makePin('LOAD',  'in',  1, 'left',  3),
      makePin('CF',    'out', 1, 'right', 0),
      makePin('ZF',    'out', 1, 'right', 1),
    ];
  }
  _bodyColor()   { return '#1a1a00'; }
  _headerColor() { return '#2a2a00'; }

  simulate(risingEdge) {
    if (risingEdge && this.getPin('CLK').value && this.getPin('LOAD').value) {
      this._cf = this.getPin('CF_IN').value & 1;
      this._zf = this.getPin('ZF_IN').value & 1;
    }
    this.getPin('CF').value = this._cf;
    this.getPin('ZF').value = this._zf;
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2;
    const cy = sy + sh / 2 + 4 * cam.scale;
    ctx.font         = `bold ${Math.max(9,11*cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = this._cf ? '#00ff88' : '#1a4a2a';
    ctx.fillText(`CF=${this._cf}`, cx - 20*cam.scale, cy);
    ctx.fillStyle    = this._zf ? '#ffaa00' : '#2a2200';
    ctx.fillText(`ZF=${this._zf}`, cx + 20*cam.scale, cy);
  }

  get description() {
    return 'The Flags Register remembers the results of arithmetic operations. The Carry Flag (CF) is set when addition produces a result larger than 255, or when subtraction borrows. The Zero Flag (ZF) is set when the result is exactly zero. These flags persist until the next operation updates them (FI signal). Conditional jumps like JC and JZ check these flags to decide whether to branch — this is how the CPU makes decisions.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  OUTPUT DISPLAY
// ══════════════════════════════════════════════════════════════════
class OutputDisplayComponent extends BreadboardComponent {
  constructor(x, y) {
    super('Output', x, y, 'OUTPUT');
    this.w = 130; this.h = 90;
    this._displayed = 0;
    this._history   = [];
  }
  _initPins() {
    this.pins = [
      makePin('DIN',  'in',  8, 'left',  0),
      makePin('CLK',  'in',  1, 'left',  1),
      makePin('LOAD', 'in',  1, 'left',  2),
    ];
  }
  _bodyColor()   { return '#2a0e00'; }
  _headerColor() { return '#3a1a00'; }

  simulate(risingEdge) {
    if (risingEdge && this.getPin('CLK').value && this.getPin('LOAD').value) {
      const v = this.getPin('DIN').value & 0xFF;
      if (v !== this._displayed) {
        this._displayed = v;
        this._history.push(v);
        if (this._history.length > 16) this._history.shift();
      }
    }
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2;
    const cy = sy + sh / 2 + 2 * cam.scale;

    // Big number
    ctx.font         = `bold ${Math.max(14, 18*cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ff8844';
    ctx.fillText(this._displayed.toString(), cx, cy);

    // Hex
    ctx.font      = `${Math.max(7, 9*cam.scale)}px monospace`;
    ctx.fillStyle = '#4a6278';
    ctx.fillText('0x' + this._displayed.toString(16).toUpperCase().padStart(2,'0'), cx, cy + 14*cam.scale);
  }

  get description() {
    return 'The Output Display shows the result of an OUT instruction — the current value of Register A at the moment OUT was executed. This is like Ben Eater\'s 4-digit 7-segment display module. The OI (Output In) control signal latches the data bus value into the display on a clock edge. The display remembers its last value until the next OUT instruction, so it can be read at any time.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  CONTROL SIGNAL SWITCH (manual toggle)
// ══════════════════════════════════════════════════════════════════
class ControlSwitchComponent extends BreadboardComponent {
  constructor(x, y, label) {
    super('Switch', x, y, label || 'SW');
    this.w = 90; this.h = 60;
    this._state = 0;
  }
  _initPins() {
    this.pins = [ makePin('OUT', 'out', 1, 'right', 0) ];
  }
  _bodyColor()   { return '#101826'; }
  _headerColor() { return '#182030'; }

  toggle() { this._state = this._state ? 0 : 1; this.getPin('OUT').value = this._state; }
  simulate() { this.getPin('OUT').value = this._state; }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2;
    const cy = sy + sh / 2 + 6 * cam.scale;
    const br = 10 * cam.scale;
    ctx.fillStyle   = this._state ? '#00ff88' : '#1a3a2a';
    ctx.strokeStyle = this._state ? '#00cc66' : '#1e2e2e';
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, br, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle    = this._state ? '#001a0d' : '#4a6278';
    ctx.font         = `bold ${Math.max(8,9*cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this._state ? '1' : '0', cx, cy);
  }

  // Double-click toggles
  onDoubleClick() { this.toggle(); }

  get description() {
    return 'A manual Switch lets you force a control signal HIGH (1) or LOW (0) by double-clicking it. This is useful for manually testing individual components — for example, you can wire a switch to a register\'s LOAD pin and manually trigger a load without needing the full Control Unit. In real hardware this would be a physical toggle switch or a push button.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  CONSTANT VALUE SOURCE
// ══════════════════════════════════════════════════════════════════
class ConstantComponent extends BreadboardComponent {
  constructor(x, y, value) {
    super('Const', x, y, 'CONST');
    this.w = 90; this.h = 60;
    this._value = (value !== undefined) ? (value & 0xFF) : 42;
  }
  _initPins() {
    this.pins = [ makePin('OUT', 'out', 8, 'right', 0) ];
  }
  _bodyColor()   { return '#101820'; }
  _headerColor() { return '#182028'; }

  simulate() { this.getPin('OUT').value = this._value; }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2;
    const cy = sy + sh / 2 + 6 * cam.scale;
    ctx.font         = `bold ${Math.max(10,12*cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#79c0ff';
    ctx.fillText(this._value + ' (0x' + this._value.toString(16).toUpperCase().padStart(2,'0') + ')', cx, cy);
  }

  get description() {
    return 'A Constant outputs a fixed 8-bit value that never changes. Right-click it to set the value. Use it to provide fixed inputs for testing — for example, wiring a Constant to a register\'s D input lets you manually load a specific value. It is useful for isolated testing of individual components without building the full CPU.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  CONTROL UNIT (Microcode EEPROM)
// ══════════════════════════════════════════════════════════════════
class ControlUnitComponent extends BreadboardComponent {
  constructor(x, y) {
    super('CU', x, y, 'CONTROL UNIT');
    this.w = 200; this.h = 160;
    this._tState = 0;        // T-state counter (0-4)
    this._lastClk = 0;       // edge detection
    this._halted = false;
    this._powered = false;   // no signals until first clock pulse

    // Microcode table: [opcode][t-state] = control word (bitmask)
    // Each bit: CO=0,CE=1,MI=2,RO=3,RI=4,II=5,IO=6,AI=7,AO=8,BI=9,EO=10,SU=11,OI=12,FI=13,HLT=14,J=15
    const CO=1<<0, CE=1<<1, MI=1<<2, RO=1<<3, RI=1<<4, II=1<<5, IO=1<<6,
          AI=1<<7, AO=1<<8, BI=1<<9, EO=1<<10,SU=1<<11,OI=1<<12,FI=1<<13,HLT=1<<14,J=1<<15;

    // Fetch is always T0: CO|MI, T1: RO|II|CE
    const FETCH = [CO|MI, RO|II|CE];

    this._microcode = new Array(16).fill(null).map(() => [0,0,0,0,0]);
    // Fill fetch for all opcodes
    for (let op = 0; op < 16; op++) {
      this._microcode[op][0] = FETCH[0];
      this._microcode[op][1] = FETCH[1];
    }
    // Execute phase (T2+)
    this._microcode[0x01][2] = IO|MI;  this._microcode[0x01][3] = RO|AI;           // LDA
    this._microcode[0x02][2] = IO|MI;  this._microcode[0x02][3] = RO|BI; this._microcode[0x02][4] = EO|AI|FI;  // ADD
    this._microcode[0x03][2] = IO|MI;  this._microcode[0x03][3] = RO|BI; this._microcode[0x03][4] = EO|AI|SU|FI; // SUB
    this._microcode[0x04][2] = IO|MI;  this._microcode[0x04][3] = AO|RI;           // STA
    this._microcode[0x05][2] = IO|AI;                                               // LDI
    this._microcode[0x06][2] = IO|J;                                                // JMP
    this._microcode[0x07][2] = IO|J;   // JC — conditional, handled in simulate()
    this._microcode[0x08][2] = IO|J;   // JZ — conditional, handled in simulate()
    this._microcode[0x0E][2] = AO|OI;                                               // OUT
    this._microcode[0x0F][2] = HLT;                                                 // HLT

    // Store bit constants for simulate
    this._SIG = { CO,CE,MI,RO,RI,II,IO,AI,AO,BI,EO,SU,OI,FI,HLT,J };
  }

  _initPins() {
    this.pins = [
      // Inputs (left side)
      makePin('CLK',    'in',  1, 'left', 0),   // Clock
      makePin('OPCODE', 'in',  8, 'left', 1),   // Opcode from IR (upper 4 used)
      makePin('CF',     'in',  1, 'left', 2),   // Carry flag
      makePin('ZF',     'in',  1, 'left', 3),   // Zero flag
      makePin('RST',    'in',  1, 'left', 4),   // Reset

      // Outputs — control signals (right side, top to bottom)
      makePin('CO',  'out', 1, 'right', 0),
      makePin('CE',  'out', 1, 'right', 1),
      makePin('MI',  'out', 1, 'right', 2),
      makePin('RO',  'out', 1, 'right', 3),
      makePin('RI',  'out', 1, 'right', 4),
      makePin('II',  'out', 1, 'right', 5),
      makePin('IO',  'out', 1, 'right', 6),
      makePin('AI',  'out', 1, 'right', 7),
      makePin('AO',  'out', 1, 'right', 8),
      makePin('BI',  'out', 1, 'right', 9),
      makePin('EO',  'out', 1, 'right', 10),
      makePin('SU',  'out', 1, 'right', 11),
      makePin('OI',  'out', 1, 'right', 12),
      makePin('FI',  'out', 1, 'right', 13),
      makePin('HLT', 'out', 1, 'right', 14),
      makePin('J',   'out', 1, 'right', 15),
    ];
  }

  _bodyColor()   { return '#2a0a0a'; }
  _headerColor() { return '#4a1a1a'; }

  simulate(risingEdge) {
    // Reset
    if (this.getPin('RST').value) {
      this._tState = 0;
      this._halted = false;
    }

    // Only advance on risingEdge (called from step 3 of bbPropagate)
    // This ensures registers latch with CURRENT signals before CU advances
    if (risingEdge) {
      if (!this._powered) {
        this._powered = true;
        this._tState = 0;  // start at T0
      } else if (!this._halted) {
        this._tState = (this._tState + 1) % 5;
      }
    }

    // No signals until powered
    if (!this._powered) {
      const sigNames = ['CO','CE','MI','RO','RI','II','IO','AI','AO','BI','EO','SU','OI','FI','HLT','J'];
      for (const s of sigNames) this.getPin(s).value = 0;
      return;
    }

    const S = this._SIG;
    const opcode = (this.getPin('OPCODE').value >> 4) & 0x0F;
    let word = this._microcode[opcode][this._tState];

    // Conditional jumps — suppress J if flag not set
    if (opcode === 0x07 && this._tState === 2 && !this.getPin('CF').value) {
      word &= ~S.J;  // JC but CF=0 → don't jump
    }
    if (opcode === 0x08 && this._tState === 2 && !this.getPin('ZF').value) {
      word &= ~S.J;  // JZ but ZF=0 → don't jump
    }

    // HLT
    if (word & S.HLT) this._halted = true;

    // Output all signals
    const sigNames = ['CO','CE','MI','RO','RI','II','IO','AI','AO','BI','EO','SU','OI','FI','HLT','J'];
    for (let i = 0; i < sigNames.length; i++) {
      this.getPin(sigNames[i]).value = (word >> i) & 1;
    }
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.3) return;
    const cx = (this.x + this.w / 2) * cam.scale + cam.ox;
    const cy = (this.y + 55) * cam.scale + cam.oy;

    // Show current T-state
    ctx.font = `bold ${Math.max(10, 13 * cam.scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = !this._powered ? '#444444' : this._halted ? '#ff4444' : '#ff8844';
    ctx.fillText(!this._powered ? 'OFF' : this._halted ? 'HALTED' : `T${this._tState}`, cx, cy);

    // Show active signals
    if (cam.scale >= 0.5) {
      const sigNames = ['CO','CE','MI','RO','RI','II','IO','AI','AO','BI','EO','SU','OI','FI','HLT','J'];
      const active = [];
      for (const s of sigNames) {
        if (this.getPin(s).value) active.push(s);
      }
      if (active.length > 0) {
        ctx.font = `bold ${Math.max(8, 10 * cam.scale)}px monospace`;
        ctx.fillStyle = '#ff6666';
        ctx.fillText(active.join(' '), cx, cy + 18 * cam.scale);
      }

      // Show opcode
      const opcode = (this.getPin('OPCODE').value >> 4) & 0x0F;
      const mnemonics = {0:'NOP',1:'LDA',2:'ADD',3:'SUB',4:'STA',5:'LDI',6:'JMP',7:'JC',8:'JZ',14:'OUT',15:'HLT'};
      const mnem = mnemonics[opcode] || '???';
      ctx.font = `${Math.max(7, 9 * cam.scale)}px monospace`;
      ctx.fillStyle = '#aa6666';
      ctx.fillText(`opcode: ${mnem}`, cx, cy + 34 * cam.scale);
    }
  }

  get description() {
    return 'The Control Unit is the brain of the CPU. It reads the current opcode (from IR) and the T-state counter, then activates the exact control signals needed for that micro-step. It is implemented as a microcode ROM — a lookup table of [opcode][T-state] → control word. Every clock pulse advances the T-state and fires a different set of signals. The fetch cycle (T0: CO+MI, T1: RO+II+CE) is the same for every instruction; the execute phase (T2+) varies. In hardware, Ben Eater uses two 28C16 EEPROMs as the microcode ROM.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  COMPONENT FACTORY
// ══════════════════════════════════════════════════════════════════
function createComponent(type, x, y, opts) {
  opts = opts || {};
  switch (type) {
    case 'Clock':   return new ClockComponent(x, y);
    case 'Register':return new RegisterComponent(x, y, opts.label);
    case 'Bus':     return new BusComponent(x, y);
    case 'ALU':     return new ALUComponent(x, y);
    case 'RAM':     return new RAMComponent(x, y);
    case 'PC':      return new ProgramCounterComponent(x, y);
    case 'MAR':     return new MARComponent(x, y);
    case 'IR':      return new InstructionRegisterComponent(x, y);
    case 'Flags':   return new FlagsComponent(x, y);
    case 'Output':  return new OutputDisplayComponent(x, y);
    case 'Switch':  return new ControlSwitchComponent(x, y, opts.label);
    case 'Const':   return new ConstantComponent(x, y, opts.value);
    case 'CU':      return new ControlUnitComponent(x, y);
    case 'AddrBus': return new AddressBusComponent(x, y);
    default:        return new RegisterComponent(x, y, type);
  }
}

// ── PALETTE DEFINITIONS ────────────────────────────────────────────────────
const PALETTE_ITEMS = [
  { section: 'Clock & Control' },
  { type: 'Clock',    label: 'Clock',        desc: 'Generates CLK pulses', pins: 'CLK out' },
  { type: 'CU',       label: 'Control Unit', desc: 'Microcode EEPROM — decodes opcode + T-state → 15 signals', pins: 'OPCODE,CF,ZF → CO,CE,MI,RO,RI,II,IO,AI,AO,BI,EO,SU,OI,FI,HLT,J' },
  { type: 'Switch',   label: 'Switch',       desc: 'Manual 1-bit toggle',  pins: '1-bit out' },
  { type: 'Const',    label: 'Constant',     desc: '8-bit constant value', pins: '8-bit out' },

  { section: 'Registers' },
  { type: 'Register', label: '8-Bit Reg',    desc: 'Latch + tri-state buf',pins: 'D/Q/CLK/LOAD/EN' },
  { type: 'IR',       label: 'Instr Reg',    desc: 'Holds current opcode', pins: 'DIN(8) / OPCODE(8) / OPERAND(4)' },
  { type: 'MAR',      label: 'Addr Reg',     desc: 'Memory address hold',  pins: 'DIN(4) / ADDR(4)' },
  { type: 'Flags',    label: 'Flags',        desc: 'CF and ZF storage',    pins: 'CF/ZF in/out' },

  { section: 'Buses' },
  { type: 'Bus',      label: 'Data Bus',     desc: '8-bit shared data highway',  pins: '5 ports (IN+OUT each)' },
  { type: 'AddrBus',  label: 'Addr Bus',     desc: '4-bit address highway',     pins: '3 ports (IN+OUT each)' },

  { section: 'Compute' },
  { type: 'ALU',      label: 'ALU',          desc: 'Add / Subtract',       pins: 'A,B,SUB → OUT,CF,ZF' },
  { type: 'PC',       label: 'Prog Counter', desc: '4-bit up-counter',     pins: 'DIN(4)/DOUT(4)/INC/LOAD/EN' },

  { section: 'Memory & Output' },
  { type: 'RAM',      label: 'RAM 256x8',    desc: '256-byte memory',      pins: 'ADDR/DIN/DOUT/WR/RD' },
  { type: 'Output',   label: 'Output Disp',  desc: '7-seg style display',  pins: 'DIN/CLK/LOAD' },
];

// Export
window.ClockComponent             = ClockComponent;
window.RegisterComponent          = RegisterComponent;
window.BusComponent               = BusComponent;
window.ALUComponent               = ALUComponent;
window.RAMComponent               = RAMComponent;
window.ProgramCounterComponent    = ProgramCounterComponent;
window.MARComponent               = MARComponent;
window.InstructionRegisterComponent = InstructionRegisterComponent;
window.FlagsComponent             = FlagsComponent;
window.OutputDisplayComponent     = OutputDisplayComponent;
window.ControlSwitchComponent     = ControlSwitchComponent;
window.ConstantComponent          = ConstantComponent;
window.ControlUnitComponent       = ControlUnitComponent;
window.AddressBusComponent        = AddressBusComponent;
window.createComponent            = createComponent;
window.PALETTE_ITEMS              = PALETTE_ITEMS;
