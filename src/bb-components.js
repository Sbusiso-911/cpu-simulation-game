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
    // 4 ports now (was 3) — accommodates the extra address-source components
    // introduced in the Extended SAP-1: Stack Pointer (pushes/pops), RAM
    // (for 2-byte instruction operand fetch), and Reg B (as a temp during
    // CALL).  Each port = one IN + one OUT; all INs feed all OUTs.
    this.pins = [
      makePin('P0_IN', 'in',  8, 'left',  0),  makePin('P0_OUT','out', 8, 'right', 0),  // e.g. PC source
      makePin('P1_IN', 'in',  8, 'left',  1),  makePin('P1_OUT','out', 8, 'right', 1),  // e.g. SP source
      makePin('P2_IN', 'in',  8, 'left',  2),  makePin('P2_OUT','out', 8, 'right', 2),  // e.g. MAR dest / RAM source
      makePin('P3_IN', 'in',  8, 'left',  3),  makePin('P3_OUT','out', 8, 'right', 3),  // e.g. Reg-B temp (CALL)
    ];
    this.h = 12 + 4 * 16 + 12;
  }
  _bodyColor()   { return '#0a1a00'; }
  _headerColor() { return '#1a2a00'; }

  simulate() {
    let drivers = 0;
    let val = 0;
    for (let i = 0; i < 4; i++) {
      const p = this.getPin('P' + i + '_IN');
      if (p && p.value !== 0) { drivers++; val = p.value; }
    }
    this._value = val & 0xFF;
    this._contention = drivers > 1;
    for (let i = 0; i < 4; i++) {
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
      this._contention ? 'CONTENTION!' : '0x' + (this._value).toString(16).toUpperCase().padStart(2, '0'),
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
    return 'The Address Bus is the 8-bit highway used to select a RAM address (0–255). It carries values from the PC (during fetch), the Stack Pointer (during PUSH/POP), or the data bus (during execute) to the Memory Address Register. The MAR then holds that address steady while RAM is read or written. This separation keeps the address stable even as the data bus changes.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  ALU
// ══════════════════════════════════════════════════════════════════
class ALUComponent extends BreadboardComponent {
  constructor(x, y) {
    super('ALU', x, y, 'ALU');
    // Resized to fit 10 left-side mode inputs (A, B, SUB, CLK, ENABLE +
    // ANDI, ORI, XORI, SHLI, SHRI).  Pin spacing is 16px with pad=12, so
    // 10 pins → slot 9 at y=156, need h ≥ 168.
    this.w = 150; this.h = 180;
    this._result = 0;
    this._cf = 0; this._zf = 0;
    this._opLabel = '+';
  }
  _initPins() {
    this.pins = [
      // Data inputs
      makePin('A',     'in',  8, 'left',  0),
      makePin('B',     'in',  8, 'left',  1),
      // Core control
      makePin('CLK',   'in',  1, 'left',  2),
      makePin('ENABLE','in',  1, 'left',  3),   // EO signal — tri-state output
      // Mode inputs — one per ALU operation.  No mode high = ADD (default).
      makePin('SUB',   'in',  1, 'left',  4),   // SU
      makePin('ANDI',  'in',  1, 'left',  5),   // AND
      makePin('ORI',   'in',  1, 'left',  6),   // OR
      makePin('XORI',  'in',  1, 'left',  7),   // XOR
      makePin('SHLI',  'in',  1, 'left',  8),   // shift left
      makePin('SHRI',  'in',  1, 'left',  9),   // shift right
      // Outputs
      makePin('OUT',   'out', 8, 'right', 0),
      makePin('CF',    'out', 1, 'right', 1),
      makePin('ZF',    'out', 1, 'right', 2),
    ];
  }
  _bodyColor()   { return '#1a0e00'; }
  _headerColor() { return '#2a1800'; }

  simulate() {
    const a    = this.getPin('A').value & 0xFF;
    const b    = this.getPin('B').value & 0xFF;
    const sub  = this.getPin('SUB').value;
    const andi = this.getPin('ANDI').value;
    const ori  = this.getPin('ORI').value;
    const xori = this.getPin('XORI').value;
    const shli = this.getPin('SHLI').value;
    const shri = this.getPin('SHRI').value;

    // Mode priority: exactly one mode signal should be high at a time.  If
    // multiple fire (a wiring error), later checks win; default falls to ADD.
    let result, cf, label;
    if (shri) {
      // Shift right by 1 — LSB falls out into CF.
      result = (a >> 1) & 0xFF;
      cf     = a & 1;
      label  = 'A>>1';
    } else if (shli) {
      // Shift left by 1 — MSB falls out into CF.
      result = (a << 1) & 0xFF;
      cf     = (a >> 7) & 1;
      label  = 'A<<1';
    } else if (xori) {
      result = (a ^ b) & 0xFF;
      cf     = 0;
      label  = 'A^B';
    } else if (ori) {
      result = (a | b) & 0xFF;
      cf     = 0;
      label  = 'A|B';
    } else if (andi) {
      result = (a & b) & 0xFF;
      cf     = 0;
      label  = 'A&B';
    } else if (sub) {
      result = (a - b) & 0x1FF;
      cf     = a >= b ? 1 : 0;
      result = result & 0xFF;
      label  = 'A-B';
    } else {
      // Default — ADD
      const full = (a + b) & 0x1FF;
      cf     = full > 0xFF ? 1 : 0;
      result = full & 0xFF;
      label  = 'A+B';
    }

    this._result  = result;
    this._cf      = cf;
    this._zf      = (result === 0) ? 1 : 0;
    this._opLabel = label;

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

    ctx.font         = `${Math.max(8, 9*cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#ffaa00';
    ctx.fillText(`${this._opLabel} = ${this._result}`, cx, cy);
    ctx.fillStyle = '#9ab';
    ctx.fillText(`A=${a}  B=${b}`, cx, cy + 13 * cam.scale);
    ctx.fillStyle = '#4a6278';
    ctx.fillText(`CF=${this._cf} ZF=${this._zf}`, cx, cy + 26 * cam.scale);
  }

  get description() {
    return 'The ALU (Arithmetic Logic Unit) is the CPU\'s calculator. It supports seven operations selected by mode pins: ADD (default), SUB (A-B via the SU signal), AND (ANDI), OR (ORI), XOR (XORI), shift-left by 1 (SHLI) and shift-right by 1 (SHRI). Only one mode pin should be asserted at a time — otherwise the priority order is shift > XOR > OR > AND > SUB > ADD. After every operation it updates the Carry Flag and Zero Flag. The EO (Enable Out) signal puts the result onto the data bus. In hardware this is a bank of adders, AND/OR/XOR gates, and a shifter, all feeding a multiplexer controlled by the mode pins.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  RAM MODULE
// ══════════════════════════════════════════════════════════════════
class RAMComponent extends BreadboardComponent {
  constructor(x, y) {
    super('RAM', x, y, 'RAM 256x8');
    this.w = 150; this.h = 180;
    this._mem         = new Uint8Array(256);  // current contents
    this._originalMem = new Uint8Array(256);  // snapshot taken at load — used by Reset
    this._lastAddr = 0;
    this._editing = false;
  }
  _initPins() {
    this.pins = [
      makePin('ADDR',  'in',  8, 'left',  0),   // 8-bit address from MAR
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
    for (let i = 0; i < Math.min(bytes.length, 256); i++) this._mem[i] = bytes[i] & 0xFF;
    // Snapshot — this is the "known good" state we can revert to.
    this._originalMem.set(this._mem);
  }

  // Restore RAM to the snapshot taken at the last load (or last manual snapshot).
  resetToOriginal() {
    this._mem.set(this._originalMem);
  }

  // Take a fresh snapshot of current RAM (call this when you're happy with current state).
  snapshot() {
    this._originalMem.set(this._mem);
  }

  // Called from double-click handler to open RAM editor.
  // With 256 bytes and 2-byte instruction encoding, each row edits one byte.
  // The editor is scrollable and shows all 256 addresses; mnemonics are
  // suggested for opcode bytes only (byte-granularity, not instruction-level).
  openEditor() {
    // Opcode → mnemonic map — matches the Extended SAP-1 CU microcode.
    const mnemonics = {
      0x00:'NOP', 0x01:'LDA', 0x02:'ADD', 0x03:'SUB', 0x04:'STA', 0x05:'LDI',
      0x06:'JMP', 0x07:'JC',  0x08:'JZ',  0x09:'AND', 0x0A:'OR',  0x0B:'XOR',
      0x0C:'SHL', 0x0D:'SHR', 0x0E:'OUT', 0x0F:'HLT',
      0x10:'PUSH',0x11:'POP', 0x12:'CALL',0x13:'RET', 0x14:'IN',  0x15:'RTI',
      0x16:'JNZ', 0x17:'JNC', 0x18:'LDB', 0x19:'CMP',
      0x1A:'LDA_IND', 0x1B:'STA_IND',
    };
    const revMnem = {};
    for (const [k,v] of Object.entries(mnemonics)) revMnem[v] = parseInt(k);
    // Which mnemonics are 1-byte (no operand) — the rest take an operand.
    const oneByte = new Set(['NOP','SHL','SHR','OUT','HLT','PUSH','POP','RET','IN','RTI']);

    // Default to mnemonics ON — but persist the user's preference across opens.
    if (typeof window._ramShowMnemonics === 'undefined') window._ramShowMnemonics = true;
    const showMnem = window._ramShowMnemonics;

    let html = '<div style="font-family:monospace;font-size:12px;background:#111;padding:12px;border-radius:8px;max-width:480px;max-height:85vh;display:flex;flex-direction:column">';
    html += '<div style="color:#ffaa00;font-size:14px;font-weight:bold;margin-bottom:6px">RAM Editor — 256 bytes</div>';
    html += '<div style="color:#888;font-size:10px;margin-bottom:6px">Per-byte edit. Enter hex (1E), decimal (30), or a mnemonic. For 2-byte instructions, put the opcode in address N and the operand byte in N+1.</div>';

    // Legend / toggle bar
    html += '<div style="color:#aaa;font-size:10px;margin-bottom:8px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">';
    html += `<label style="cursor:pointer"><input type="checkbox" id="ram-mnem-toggle" ${showMnem ? 'checked' : ''} /> Show mnemonics</label>`;
    html += '<span style="color:#aa8855">■ modified since load</span>';
    html += '<span style="color:#666">■ unchanged</span>';
    html += '</div>';

    html += '<div style="overflow-y:auto;flex:1">';
    let modifiedCount = 0;
    for (let i = 0; i < 256; i++) {
      const val  = this._mem[i];
      const orig = this._originalMem[i];
      const isModified = (val !== orig);
      if (isModified) modifiedCount++;

      const mnem = mnemonics[val];
      // The text shown in the input box: mnemonic if toggled on AND the byte matches an opcode, else the raw number.
      const display = (showMnem && mnem !== undefined && val !== 0)
                    ? mnem
                    : String(val);
      const rowBg    = isModified ? '#3a2a10' : ((i % 2 === 0) ? '#181818' : '#121212');
      const inputBg  = isModified ? '#4a3a18' : '#222';
      const inputCol = isModified ? '#ffe699' : '#ffcc00';

      html += `<div style="display:flex;align-items:center;margin:0;padding:1px 4px;background:${rowBg}">`;
      html += `<span style="color:#666;width:48px;font-size:10px">0x${i.toString(16).toUpperCase().padStart(2,'0')}:</span>`;
      html += `<input id="ram-edit-${i}" value="${display}" style="background:${inputBg};color:${inputCol};border:1px solid #333;padding:2px 6px;width:110px;font-family:monospace;font-size:11px;border-radius:3px" />`;
      html += `<span style="color:#444;font-size:9px;margin-left:6px">= 0x${val.toString(16).toUpperCase().padStart(2,'0')}</span>`;
      if (isModified) {
        html += `<span style="color:#aa8855;font-size:9px;margin-left:8px">was 0x${orig.toString(16).toUpperCase().padStart(2,'0')}</span>`;
      }
      html += `</div>`;
    }
    html += '</div>';

    html += `<div style="color:#aa8855;font-size:10px;margin-top:8px">${modifiedCount} byte${modifiedCount === 1 ? '' : 's'} modified since load</div>`;

    html += '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">';
    html += '<button id="ram-save-btn"     style="background:#2a6a2a;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-family:monospace">Save edits</button>';
    html += '<button id="ram-reset-btn"    style="background:#6a4a2a;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-family:monospace" title="Restore RAM to the snapshot taken when the program was loaded">Reset to load</button>';
    html += '<button id="ram-snapshot-btn" style="background:#2a4a6a;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-family:monospace" title="Take a fresh snapshot — current values become the new ‘original’">Snapshot now</button>';
    html += '<button id="ram-cancel-btn"   style="background:#444;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-family:monospace">Close</button>';
    html += '</div>';
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

    // Save edits — parse each input box and write into RAM. Does NOT change the snapshot.
    document.getElementById('ram-save-btn').addEventListener('click', () => {
      for (let i = 0; i < 256; i++) {
        const input = document.getElementById(`ram-edit-${i}`);
        if (!input) continue;
        const raw = input.value.trim().toUpperCase();
        let val = 0;
        if (revMnem[raw] !== undefined) {
          val = revMnem[raw] & 0xFF;
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

    // Close — discard any unsaved input changes; RAM contents NOT touched.
    document.getElementById('ram-cancel-btn').addEventListener('click', () => {
      overlay.style.display = 'none';
    });

    // Reset to load — restore RAM to the last snapshot. Wipes any execution-time mutations.
    document.getElementById('ram-reset-btn').addEventListener('click', () => {
      if (!confirm('Reset RAM to the snapshot taken when the program was loaded? Any changes (from running the program or editing) will be lost.')) return;
      self.resetToOriginal();
      if (typeof bbSaveState === 'function') bbSaveState();
      overlay.style.display = 'none';
      // Reopen with refreshed values
      self.openEditor();
    });

    // Snapshot now — declare current RAM as the new "known good" baseline.
    document.getElementById('ram-snapshot-btn').addEventListener('click', () => {
      self.snapshot();
      // Refresh the editor so highlights clear
      overlay.style.display = 'none';
      self.openEditor();
    });

    // Mnemonics toggle — persisted in window so it's remembered across opens
    const toggle = document.getElementById('ram-mnem-toggle');
    if (toggle) {
      toggle.addEventListener('change', (e) => {
        window._ramShowMnemonics = e.target.checked;
        overlay.style.display = 'none';
        self.openEditor();
      });
    }
  }

  get description() {
    return 'RAM (Random Access Memory) stores the program and its data. This 256-byte memory grid is addressed by the MAR — the CPU sets an address, then either reads (RD=1, DOUT → data bus) or writes (WR=1, data bus → DIN). Programs now use 2-byte instruction encoding (opcode byte + operand byte), so addresses 0–255 can hold up to 128 instructions. The stack grows downward from 0xFF. Double-click the RAM chip to edit its contents directly. In Ben Eater\'s design, this is a 74LS189 SRAM scaled up.';
  }

  simulate(risingEdge) {
    const addr = this.getPin('ADDR').value & 0xFF;  // 8-bit address (0–255)
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
    ctx.fillText(`[0x${addr.toString(16).toUpperCase().padStart(2,'0')}] = 0x${val.toString(16).toUpperCase().padStart(2,'0')}`, cx, sy + sh * 0.35);

    if (cam.scale >= 0.5) {
      // With 256 bytes we show a small window — 8 addresses centred on the
      // currently-accessed one, in two columns of 4.
      const fs = Math.max(7, 8 * cam.scale);
      ctx.font = `${fs}px monospace`;
      const startY = sy + sh * 0.5;
      const lineH = fs + 2;
      const windowStart = Math.max(0, Math.min(248, addr - 3));
      for (let i = 0; i < 8; i++) {
        const a = windowStart + i;
        const v = this._mem[a];
        const y = startY + (i % 4) * lineH;
        const x = i < 4 ? sx + 10 * cam.scale : sx + sw / 2 + 5 * cam.scale;
        ctx.fillStyle = a === addr ? '#ffcc00' : '#665500';
        const hex = v.toString(16).toUpperCase().padStart(2, '0');
        ctx.textAlign = 'left';
        ctx.fillText(`${a.toString(16).toUpperCase().padStart(2,'0')}: ${hex}`, x, y);
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
      makePin('DIN',    'in',  8, 'left',  3),   // 8-bit input from address bus (for JMP)
      makePin('ENABLE', 'in',  1, 'left',  4),   // CO signal — output to address bus
      makePin('RESET',  'in',  1, 'left',  5),
      makePin('DOUT',   'out', 8, 'right', 0),   // 8-bit output to address bus
    ];
  }
  _bodyColor()   { return '#0d1e40'; }
  _headerColor() { return '#142060'; }

  simulate(risingEdge) {
    if (risingEdge) {
      if (this.getPin('RESET').value) { this._count = 0; }
      else if (this.getPin('LOAD').value)  { this._count = this.getPin('DIN').value & 0xFF; }
      else if (this.getPin('INC').value)   { this._count = (this._count + 1) & 0xFF; }
    }
    this.getPin('DOUT').value = this.getPin('ENABLE').value ? this._count : 0;
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    this._drawValueBadge(ctx, cam, sx, sy, sw, sh, this._count, 8);
  }

  get description() {
    return 'The Program Counter (PC) keeps track of which instruction the CPU is executing next. It is 8-bit so it can address 256 bytes of RAM. Every fetch cycle, the PC outputs its address (CO signal) to select the instruction from RAM, then increments (CE signal) to point to the next one. Jump instructions load a new address into the PC directly (J signal), changing which instruction executes next — that\'s how loops and branches work. Equivalent to a 74LS161 binary counter cascaded to 8 bits.';
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
      makePin('DIN',  'in',  8, 'left',  0),   // 8-bit input from address bus
      makePin('CLK',  'in',  1, 'left',  1),
      makePin('LOAD', 'in',  1, 'left',  2),   // MI signal
      makePin('ADDR', 'out', 8, 'right', 0),   // 8-bit output hardwired to RAM
    ];
  }
  _bodyColor()   { return '#0d2a1a'; }
  _headerColor() { return '#143820'; }

  simulate(risingEdge) {
    if (risingEdge && this.getPin('CLK').value && this.getPin('LOAD').value) {
      this._stored = this.getPin('DIN').value & 0xFF;  // full 8-bit
    }
    this.getPin('ADDR').value = this._stored;
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    this._drawValueBadge(ctx, cam, sx, sy, sw, sh, this._stored, 8);
  }

  get description() {
    return 'The Memory Address Register (MAR) is an 8-bit latch that holds the current RAM address being accessed. It acts as a buffer between the address bus and RAM — the CPU puts an address on the bus, MAR latches it (MI signal), then the bus is free for other data while RAM uses the stable address from MAR. Without this buffer, the address on the bus and the data on the bus would collide. Equivalent to a 74LS173 register cascaded to 8 bits.';
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
    // With 8-bit opcodes and 2-byte instruction encoding, the IR holds only
    // the opcode byte.  Operand bytes flow through the data bus directly into
    // their destination (MAR, A, B, or PC via J).  OPERAND / OPERAND_D pins
    // are kept as zero-valued stubs so legacy templates don't crash, but they
    // no longer carry meaningful data.
    this.pins = [
      makePin('DIN',       'in',  8, 'left',  0),  // 8-bit input from data bus
      makePin('CLK',       'in',  1, 'left',  1),
      makePin('LOAD',      'in',  1, 'left',  2),  // II signal — latch from bus
      makePin('ENABLE',    'in',  1, 'left',  3),  // IO signal (deprecated in 2-byte mode)
      makePin('OPCODE',    'out', 8, 'right', 0),  // Full 8-bit opcode → CU
      makePin('OPERAND',   'out', 8, 'right', 1),  // legacy — always 0 now
      makePin('OPERAND_D', 'out', 8, 'right', 2),  // legacy — always 0 now
    ];
  }
  _bodyColor()   { return '#2a0f2a'; }
  _headerColor() { return '#3a1a3a'; }

  simulate(risingEdge) {
    if (risingEdge && this.getPin('CLK').value && this.getPin('LOAD').value) {
      this._stored = this.getPin('DIN').value & 0xFF;
    }
    // OPCODE always outputs the full 8-bit byte (CU uses it directly)
    this.getPin('OPCODE').value = this._stored;
    // Legacy stubs — always zero.  In 2-byte encoding the operand lives in
    // the NEXT byte in RAM, not inside the IR, so these pins have no job.
    this.getPin('OPERAND').value   = 0;
    this.getPin('OPERAND_D').value = 0;
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const mnemonics = {
      0x00:'NOP', 0x01:'LDA', 0x02:'ADD', 0x03:'SUB', 0x04:'STA', 0x05:'LDI',
      0x06:'JMP', 0x07:'JC',  0x08:'JZ',  0x09:'AND', 0x0A:'OR',  0x0B:'XOR',
      0x0C:'SHL', 0x0D:'SHR', 0x0E:'OUT', 0x0F:'HLT',
      0x10:'PUSH',0x11:'POP', 0x12:'CALL',0x13:'RET', 0x14:'IN',  0x15:'RTI',
      0x16:'JNZ', 0x17:'JNC', 0x18:'LDB', 0x19:'CMP',
      0x1A:'LDA_IND', 0x1B:'STA_IND',
    };
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
    return 'The Instruction Register holds the opcode byte fetched from RAM during the fetch cycle. With 8-bit opcodes and 2-byte instruction encoding, the IR no longer stores the operand — operand bytes live in the NEXT byte of RAM and are fetched separately by the CU, flowing directly through the data bus to their destination (MAR for memory ops, A for LDI, PC via J for jumps, etc.). The OPCODE output wires permanently to the CU so it knows which instruction to execute. The legacy OPERAND / OPERAND_D pins are kept as zero stubs for backwards compatibility.';
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

    // ASCII char (printable bytes 32..126)
    const v = this._displayed;
    const ascii = (v >= 32 && v < 127) ? `'${String.fromCharCode(v)}'` : '·';
    ctx.font      = `${Math.max(7, 9*cam.scale)}px monospace`;
    ctx.fillStyle = '#7a9b6a';
    ctx.fillText(ascii, cx, cy + 24*cam.scale);
  }

  get description() {
    return 'The Output Display shows the result of an OUT instruction — the current value of Register A at the moment OUT was executed. Renders the byte three ways: decimal (e.g. 72), hex (0x48), and ASCII character (\'H\') when the byte is in the printable range 32..126. The OI (Output In) control signal latches the data bus value into the display on a clock edge. The display remembers its last value until the next OUT instruction.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  LED BANK — memory-mapped 8-bit LED array
//  Mapped at address 0xF4 by default. STA 0xF4 writes A's bits to LEDs.
//  Each bit drives one LED (bit 0 = leftmost, bit 7 = rightmost).
// ══════════════════════════════════════════════════════════════════
class LEDBankComponent extends BreadboardComponent {
  constructor(x, y) {
    super('LEDBank', x, y, 'LED BANK');
    this.w = 220; this.h = 80;
    this._state       = 0;       // 8 LED bits (current display)
    this._mappedAddr  = 0xF4;    // I/O address this device responds to
  }
  _initPins() {
    this.pins = [
      makePin('ADDR', 'in', 8, 'left', 0),  // wire to MAR.ADDR (alongside RAM.ADDR)
      makePin('DIN',  'in', 8, 'left', 1),  // wire to data bus output
      makePin('WR',   'in', 1, 'left', 2),  // wire to CU.RI
      makePin('CLK',  'in', 1, 'left', 3),  // wire to CLOCK.CLK
    ];
  }
  _bodyColor()   { return '#1a0a1a'; }
  _headerColor() { return '#2a1a2a'; }

  simulate(risingEdge) {
    if (risingEdge && this.getPin('CLK').value && this.getPin('WR').value) {
      const addr = this.getPin('ADDR').value & 0xFF;
      if (addr === this._mappedAddr) {
        this._state = this.getPin('DIN').value & 0xFF;
      }
    }
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cy   = sy + sh / 2 + 4 * cam.scale;
    const ledR = Math.max(6, 9 * cam.scale);
    const gap  = Math.max(18, 22 * cam.scale);
    const startX = sx + sw / 2 - (gap * 3.5);

    // Draw 8 LEDs (bit 7 = leftmost in display, bit 0 = rightmost)
    for (let i = 0; i < 8; i++) {
      const bit  = (this._state >> (7 - i)) & 1;
      const cx   = startX + i * gap;
      // Outer dim ring (always visible)
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(cx, cy, ledR + 1, 0, Math.PI * 2);
      ctx.fill();
      // LED itself
      ctx.fillStyle = bit ? '#ff3030' : '#3a0808';
      ctx.beginPath();
      ctx.arc(cx, cy, ledR, 0, Math.PI * 2);
      ctx.fill();
      // Glow when on
      if (bit) {
        ctx.fillStyle = 'rgba(255, 100, 100, 0.4)';
        ctx.beginPath();
        ctx.arc(cx, cy, ledR + 3, 0, Math.PI * 2);
        ctx.fill();
        // Inner highlight
        ctx.fillStyle = '#ffaaaa';
        ctx.beginPath();
        ctx.arc(cx - ledR * 0.3, cy - ledR * 0.3, ledR * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bit labels under each LED (7..0)
    ctx.font         = `${Math.max(7, 8 * cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = '#5a6a7a';
    for (let i = 0; i < 8; i++) {
      const cx = startX + i * gap;
      ctx.fillText((7 - i).toString(), cx, cy + ledR + 3);
    }

    // Address tag and current value
    ctx.font      = `${Math.max(8, 10 * cam.scale)}px monospace`;
    ctx.fillStyle = '#88ddff';
    ctx.textAlign = 'left';
    ctx.fillText('@ 0x' + this._mappedAddr.toString(16).toUpperCase(),
                 sx + 6, sy + sh - 16 * cam.scale);
    ctx.textAlign = 'right';
    ctx.fillText('= 0x' + this._state.toString(16).toUpperCase().padStart(2,'0'),
                 sx + sw - 6, sy + sh - 16 * cam.scale);
  }

  get description() {
    return 'LED Bank — a memory-mapped 8-bit output device. Each bit of address 0xF4 drives one of 8 LEDs (bit 7 leftmost, bit 0 rightmost). Write to it with STA 0xF4: the byte in A appears on the LEDs. This is real-CPU style I/O — no new opcode needed, just store to a special address. Wire ADDR to MAR.ADDR (alongside RAM), DIN to the data bus, WR to CU.RI, CLK to the clock.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  KEYBOARD — memory-mapped input device
//  Mapped at 0xF1. When user types, the ASCII byte is placed at RAM[0xF1].
//  LDA 0xF1 reads it. Auto-clears to 0 after read (so polling loops work).
// ══════════════════════════════════════════════════════════════════
let _keyboardListenerInstalled = false;
const _keyboardInstances = new Set();

function _installKeyboardListener() {
  if (_keyboardListenerInstalled) return;
  _keyboardListenerInstalled = true;
  document.addEventListener('keydown', (e) => {
    // Don't capture when user is typing in a real input field
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
    if (_keyboardInstances.size === 0) return;

    let code = 0;
    if (e.key.length === 1)         code = e.key.charCodeAt(0);
    else if (e.key === 'Enter')      code = 13;
    else if (e.key === 'Backspace')  code = 8;
    else if (e.key === 'Tab')        code = 9;
    else if (e.key === 'Escape')     code = 27;
    else if (e.key === ' ')          code = 32;
    if (!code) return;

    e.preventDefault();
    for (const kb of _keyboardInstances) {
      kb._receiveKey(code);
    }
  });
}

class KeyboardComponent extends BreadboardComponent {
  constructor(x, y) {
    super('Keyboard', x, y, 'KEYBOARD');
    this.w = 220; this.h = 90;
    this._lastKey    = 0;
    this._buffer     = [];      // recent keys, for the visual log
    this._mappedAddr = 0xF1;
    this._irqPending = false;   // true if a key was captured but not yet read
    _installKeyboardListener();
    _keyboardInstances.add(this);
  }
  _initPins() {
    this.pins = [
      makePin('ADDR',    'in',  8, 'left',  0),  // wire to MAR.ADDR (for read auto-clear)
      makePin('RD',      'in',  1, 'left',  1),  // wire to CU.RO (for read auto-clear)
      makePin('CLK',     'in',  1, 'left',  2),  // wire to CLOCK.CLK
      makePin('IRQ_OUT', 'out', 1, 'right', 0),  // pulled high when a key is pending → wire to CU.IRQ
    ];
  }
  _bodyColor()   { return '#0a1a14'; }
  _headerColor() { return '#1a2a24'; }

  _receiveKey(code) {
    this._lastKey = code & 0xFF;
    this._buffer.push(code & 0xFF);
    if (this._buffer.length > 16) this._buffer.shift();
    this._irqPending = true;     // raise IRQ until CPU reads the key
    // Push directly into RAM[0xF1] so LDA 0xF1 reads it
    this._writeToMappedRAM(this._lastKey);
  }

  _writeToMappedRAM(value) {
    const BB = window.BB;
    if (!BB || !BB.components) return;
    for (const comp of BB.components) {
      if (comp && comp._mem && comp._mem.length > this._mappedAddr) {
        comp._mem[this._mappedAddr] = value & 0xFF;
      }
    }
  }

  simulate(risingEdge) {
    // Drive IRQ_OUT based on pending state (every tick, not just rising edge)
    this.getPin('IRQ_OUT').value = this._irqPending ? 1 : 0;

    // Auto-clear RAM[0xF1] right after the CPU reads it.
    // Detect a read: rising clock edge with RD=1 and ADDR=0xF1.
    if (risingEdge && this.getPin('CLK').value && this.getPin('RD').value) {
      const addr = this.getPin('ADDR').value & 0xFF;
      if (addr === this._mappedAddr) {
        this._irqPending = false;       // CPU is reading → drop IRQ
        // Defer clear by one tick so the LDA actually grabs the byte first.
        setTimeout(() => this._writeToMappedRAM(0), 0);
      }
    }
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2;

    ctx.font         = `bold ${Math.max(11, 13*cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = '#88ffaa';
    const keyChar = (this._lastKey >= 32 && this._lastKey < 127)
      ? `'${String.fromCharCode(this._lastKey)}'` : `0x${this._lastKey.toString(16).padStart(2,'0')}`;
    ctx.fillText(`Last key: ${keyChar} (${this._lastKey})`, cx, sy + 18 * cam.scale);

    // Recent buffer
    const str = this._buffer
      .map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '·')
      .join('');
    ctx.font      = `${Math.max(9, 11*cam.scale)}px monospace`;
    ctx.fillStyle = '#66ccff';
    ctx.fillText(str || '(type to test)', cx, sy + 38 * cam.scale);

    // Address tag
    ctx.font      = `${Math.max(7, 9*cam.scale)}px monospace`;
    ctx.fillStyle = '#5a6a7a';
    ctx.fillText(`@ 0x${this._mappedAddr.toString(16).toUpperCase()} — type anywhere on page`,
                 cx, sy + sh - 16 * cam.scale);
  }

  get description() {
    return 'Keyboard — memory-mapped input at 0xF1, with optional interrupt output. Type any key on the page (not into a text input) and the ASCII byte appears at RAM[0xF1]. LDA 0xF1 reads the key into A; the byte auto-clears to 0 after read. Special keys: Enter=13, Backspace=8, Tab=9, Esc=27, Space=32. The IRQ_OUT pin goes HIGH when a key is pending and drops once the CPU reads it — wire IRQ_OUT to CONTROL UNIT.IRQ to enable interrupt-driven keyboard handling. Wire ADDR to MAR.ADDR, RD to CU.RO, CLK to CLOCK.CLK.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  TIMER — 16-bit free-running counter mapped to 0xF2 (low) and 0xF3 (high)
//  Increments on every clock tick. Any write to 0xF2 resets to 0.
// ══════════════════════════════════════════════════════════════════
class TimerComponent extends BreadboardComponent {
  constructor(x, y) {
    super('Timer', x, y, 'TIMER');
    this.w = 200; this.h = 90;
    this._count       = 0;        // 16-bit counter (0..65535)
    this._mappedLo    = 0xF2;
    this._mappedHi    = 0xF3;
  }
  _initPins() {
    this.pins = [
      makePin('ADDR', 'in', 8, 'left', 0),  // wire to MAR.ADDR
      makePin('WR',   'in', 1, 'left', 1),  // wire to CU.RI (detect reset)
      makePin('CLK',  'in', 1, 'left', 2),  // wire to CLOCK.CLK
    ];
  }
  _bodyColor()   { return '#0a141e'; }
  _headerColor() { return '#1a2438'; }

  _writeToMappedRAM() {
    const BB = window.BB;
    if (!BB || !BB.components) return;
    const lo = this._count & 0xFF;
    const hi = (this._count >> 8) & 0xFF;
    for (const comp of BB.components) {
      if (comp && comp._mem && comp._mem.length > this._mappedHi) {
        comp._mem[this._mappedLo] = lo;
        comp._mem[this._mappedHi] = hi;
      }
    }
  }

  simulate(risingEdge) {
    if (!risingEdge || !this.getPin('CLK').value) return;
    // Check for reset write before incrementing
    if (this.getPin('WR').value) {
      const addr = this.getPin('ADDR').value & 0xFF;
      if (addr === this._mappedLo) {
        this._count = 0;
        this._writeToMappedRAM();
        return;
      }
    }
    // Otherwise increment
    this._count = (this._count + 1) & 0xFFFF;
    this._writeToMappedRAM();
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2;

    // Big counter value
    ctx.font         = `bold ${Math.max(14, 18*cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = '#ffcc66';
    ctx.fillText(this._count.toString(), cx, sy + 18 * cam.scale);

    // Hex breakdown: high : low
    const hi = (this._count >> 8) & 0xFF;
    const lo = this._count & 0xFF;
    ctx.font      = `${Math.max(8, 10*cam.scale)}px monospace`;
    ctx.fillStyle = '#7a9b6a';
    ctx.fillText(`HI=0x${hi.toString(16).toUpperCase().padStart(2,'0')}  LO=0x${lo.toString(16).toUpperCase().padStart(2,'0')}`,
                 cx, sy + 42 * cam.scale);

    // Address tag
    ctx.font      = `${Math.max(7, 9*cam.scale)}px monospace`;
    ctx.fillStyle = '#5a6a7a';
    ctx.fillText(`@ 0x${this._mappedLo.toString(16).toUpperCase()} (LO) / 0x${this._mappedHi.toString(16).toUpperCase()} (HI)`,
                 cx, sy + sh - 16 * cam.scale);
  }

  get description() {
    return 'Timer — a 16-bit free-running counter that ticks up on every clock cycle. Read the low byte at 0xF2 and the high byte at 0xF3 (LDA 0xF2 / LDA 0xF3). Write any value to 0xF2 to reset the counter to 0 (STA 0xF2). Use it for delays (poll until the count reaches N), animations (do X every M ticks), and timeouts (give up after K ticks). Wire ADDR to MAR.ADDR, WR to CU.RI, CLK to CLOCK.CLK. The high byte changes once every 256 ticks — useful for slow human-visible blinks.';
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
    // Extended CU — now has 28 output signals total.  Height is sized
    // for 28 right-side pins at 16px spacing + 12px top padding.
    this.w = 220; this.h = 490;
    this._tState = 0;        // T-state counter (0-4)
    this._lastClk = 0;       // edge detection
    this._halted = false;
    this._powered = false;   // no signals until first clock pulse
    // Interrupt support
    this._ie         = 0;      // Interrupt Enable flag (0 at reset; EI sets, DI clears)
    this._savedPC    = 0;      // saved PC for return from interrupt
    this._intVector  = 0xFE;   // fixed interrupt handler address

    // Microcode table: [opcode][t-state] = control word (bitmask).
    // Bit ordering (now 28 bits):
    //   CO=0,CE=1,MI=2,RO=3,RI=4,II=5,IO=6,AI=7,AO=8,BI=9,EO=10,SU=11,
    //   OI=12,FI=13,HLT=14,J=15, ANDI=16, ORI=17, XORI=18, SHLI=19, SHRI=20,
    //   BO=21, PCI=22, SPO=23, SPI=24, SPD=25, SPUP=26, INO=27
    const CO=1<<0, CE=1<<1, MI=1<<2, RO=1<<3, RI=1<<4, II=1<<5, IO=1<<6,
          AI=1<<7, AO=1<<8, BI=1<<9, EO=1<<10,SU=1<<11,OI=1<<12,FI=1<<13,HLT=1<<14,J=1<<15,
          ANDI=1<<16, ORI=1<<17, XORI=1<<18, SHLI=1<<19, SHRI=1<<20,
          BO=1<<21, PCI=1<<22, SPO=1<<23, SPI=1<<24, SPD=1<<25, SPUP=1<<26, INO=1<<27;

    // Fetch is always T0: CO|MI, T1: RO|II|CE
    const FETCH = [CO|MI, RO|II|CE];

    // Microcode table: [opcode(0-255)][T-state(0-7)] = control word.
    // 8 T-states per instruction — enough for CALL (longest, uses T0..T7).
    this._tStateCount = 8;
    this._microcode = new Array(256).fill(null).map(() => new Array(8).fill(0));
    // Fill fetch for every possible opcode
    for (let op = 0; op < 256; op++) {
      this._microcode[op][0] = FETCH[0];
      this._microcode[op][1] = FETCH[1];
    }

    // ─── Execute phase (T2+) — full Extended SAP-1 instruction set ───
    // Two-byte instructions follow the pattern:
    //   T2: CO|MI        — PC → MAR (prepare to read the operand byte)
    //   T3: RO|<dest>|CE — operand → dest, PC++
    // One-byte instructions use T2+ directly.
    // CALL is the longest (T2..T7) because it has to save PC, decrement SP,
    // and jump — see below.

    // 0x00 NOP — no execute phase; fetch alone counts as one NOP cycle.

    // 0x01 LDA addr  — A ← RAM[addr]
    this._microcode[0x01][2] = CO|MI;
    this._microcode[0x01][3] = RO|MI|CE;      // operand (address) → MAR, PC++
    this._microcode[0x01][4] = RO|AI;          // RAM[addr] → A

    // 0x02 ADD addr  — A ← A + RAM[addr]
    this._microcode[0x02][2] = CO|MI;
    this._microcode[0x02][3] = RO|MI|CE;
    this._microcode[0x02][4] = RO|BI;
    this._microcode[0x02][5] = EO|AI|FI;

    // 0x03 SUB addr  — A ← A − RAM[addr]
    this._microcode[0x03][2] = CO|MI;
    this._microcode[0x03][3] = RO|MI|CE;
    this._microcode[0x03][4] = RO|BI;
    this._microcode[0x03][5] = EO|AI|SU|FI;

    // 0x04 STA addr  — RAM[addr] ← A
    this._microcode[0x04][2] = CO|MI;
    this._microcode[0x04][3] = RO|MI|CE;
    this._microcode[0x04][4] = AO|RI;

    // 0x05 LDI imm   — A ← imm
    this._microcode[0x05][2] = CO|MI;
    this._microcode[0x05][3] = RO|AI|CE;       // operand (imm) → A, PC++

    // 0x06 JMP addr  — PC ← addr (unconditional)
    this._microcode[0x06][2] = CO|MI;
    this._microcode[0x06][3] = RO|J;           // operand → PC

    // 0x07 JC addr   — If CF: PC ← addr, else PC advances past operand
    this._microcode[0x07][2] = CO|MI|CE;       // step PC past operand preemptively
    this._microcode[0x07][3] = RO|J;           // J masked in simulate() if CF=0

    // 0x08 JZ addr   — If ZF: PC ← addr
    this._microcode[0x08][2] = CO|MI|CE;
    this._microcode[0x08][3] = RO|J;           // J masked in simulate() if ZF=0

    // 0x09 AND addr  — A ← A AND RAM[addr]
    this._microcode[0x09][2] = CO|MI;
    this._microcode[0x09][3] = RO|MI|CE;
    this._microcode[0x09][4] = RO|BI;
    this._microcode[0x09][5] = EO|AI|ANDI|FI;

    // 0x0A OR addr   — A ← A OR RAM[addr]
    this._microcode[0x0A][2] = CO|MI;
    this._microcode[0x0A][3] = RO|MI|CE;
    this._microcode[0x0A][4] = RO|BI;
    this._microcode[0x0A][5] = EO|AI|ORI|FI;

    // 0x0B XOR addr  — A ← A XOR RAM[addr]
    this._microcode[0x0B][2] = CO|MI;
    this._microcode[0x0B][3] = RO|MI|CE;
    this._microcode[0x0B][4] = RO|BI;
    this._microcode[0x0B][5] = EO|AI|XORI|FI;

    // 0x0C SHL       — A ← A << 1  (1-byte instruction)
    this._microcode[0x0C][2] = EO|AI|SHLI|FI;

    // 0x0D SHR       — A ← A >> 1  (1-byte instruction)
    this._microcode[0x0D][2] = EO|AI|SHRI|FI;

    // 0x0E OUT       — OUTPUT ← A  (1-byte instruction)
    this._microcode[0x0E][2] = AO|OI;

    // 0x0F HLT       — halt clock
    this._microcode[0x0F][2] = HLT;

    // 0x10 PUSH      — RAM[SP] ← A ; SP--     (1-byte instruction)
    this._microcode[0x10][2] = SPO|MI;
    this._microcode[0x10][3] = AO|RI;
    this._microcode[0x10][4] = SPD;

    // 0x11 POP       — SP++ ; A ← RAM[SP]
    this._microcode[0x11][2] = SPUP;
    this._microcode[0x11][3] = SPO|MI;
    this._microcode[0x11][4] = RO|AI;

    // 0x12 CALL addr — push return-PC, then PC ← addr.  Longest instruction
    //                  (uses T2..T7).  Uses B as a scratch register to hold
    //                  the target address while we push the return PC.
    this._microcode[0x12][2] = CO|MI|CE;       // MAR = addr of operand, PC++ (PC now post-call)
    this._microcode[0x12][3] = RO|BI;          // operand (target) → B (temp)
    this._microcode[0x12][4] = SPO|MI;         // SP → MAR (for stack push)
    this._microcode[0x12][5] = CO|RI;          // PC → RAM[SP] (save return addr)
    this._microcode[0x12][6] = SPD;            // SP--
    this._microcode[0x12][7] = BO|J;           // B (target) → bus → PC

    // 0x13 RET       — PC ← RAM[SP+1] ; SP++
    this._microcode[0x13][2] = SPUP;
    this._microcode[0x13][3] = SPO|MI;
    this._microcode[0x13][4] = RO|J;           // RAM[SP] → PC

    // 0x14 IN        — A ← INPUT reg  (1-byte instruction)
    this._microcode[0x14][2] = INO|AI;

    // 0x15 RTI       — Return from Interrupt: restore PC from _savedPC,
    //                  re-enable IE. The actual PC restore + IE set happens
    //                  via side-effect in simulate() (T2 of this opcode);
    //                  microcode is left empty so no signals fire.
    this._microcode[0x15][2] = 0;

    // 0x16 JNZ addr  — If NOT ZF: PC ← addr
    this._microcode[0x16][2] = CO|MI|CE;
    this._microcode[0x16][3] = RO|J;           // J masked in simulate() if ZF=1

    // 0x17 JNC addr  — If NOT CF: PC ← addr
    this._microcode[0x17][2] = CO|MI|CE;
    this._microcode[0x17][3] = RO|J;           // J masked in simulate() if CF=1

    // 0x18 LDB imm   — B ← imm
    this._microcode[0x18][2] = CO|MI;
    this._microcode[0x18][3] = RO|BI|CE;

    // 0x19 CMP addr  — flags ← A − RAM[addr], no writeback to A
    this._microcode[0x19][2] = CO|MI;
    this._microcode[0x19][3] = RO|MI|CE;
    this._microcode[0x19][4] = RO|BI;
    this._microcode[0x19][5] = EO|SU|FI;       // NOT AI — A unchanged

    // 0x1A LDA_IND addr — A ← RAM[ RAM[addr] ]   (indirect load via pointer)
    //   T2: PC → MAR (point at operand byte)
    //   T3: RAM[MAR] → MAR, PC++   (operand byte = address-of-pointer)
    //   T4: RAM[MAR] → MAR         (dereference: pointer value = data address)
    //   T5: RAM[MAR] → A           (final load)
    this._microcode[0x1A][2] = CO|MI;
    this._microcode[0x1A][3] = RO|MI|CE;
    this._microcode[0x1A][4] = RO|MI;
    this._microcode[0x1A][5] = RO|AI;

    // 0x1B STA_IND addr — RAM[ RAM[addr] ] ← A   (indirect store via pointer)
    //   T2: PC → MAR
    //   T3: operand → MAR, PC++
    //   T4: RAM[MAR] → MAR (dereference)
    //   T5: A → RAM[MAR]
    this._microcode[0x1B][2] = CO|MI;
    this._microcode[0x1B][3] = RO|MI|CE;
    this._microcode[0x1B][4] = RO|MI;
    this._microcode[0x1B][5] = AO|RI;

    // 0x1C EI        — Enable Interrupts (set IE flag to 1).  No bus traffic.
    //                  Side-effect handled in simulate() at T2.
    this._microcode[0x1C][2] = 0;

    // 0x1D DI        — Disable Interrupts (clear IE flag).  Side-effect at T2.
    this._microcode[0x1D][2] = 0;

    // Store bit constants for simulate
    this._SIG = {
      CO,CE,MI,RO,RI,II,IO,AI,AO,BI,EO,SU,OI,FI,HLT,J,
      ANDI,ORI,XORI,SHLI,SHRI,
      BO,PCI,SPO,SPI,SPD,SPUP,INO,
    };
  }

  _initPins() {
    this.pins = [
      // Inputs (left side)
      makePin('CLK',    'in',  1, 'left', 0),   // Clock
      makePin('OPCODE', 'in',  8, 'left', 1),   // Opcode from IR (upper 4 used)
      makePin('CF',     'in',  1, 'left', 2),   // Carry flag
      makePin('ZF',     'in',  1, 'left', 3),   // Zero flag
      makePin('RST',    'in',  1, 'left', 4),   // Reset
      makePin('IRQ',    'in',  1, 'left', 5),   // Interrupt Request from peripheral(s)

      // Outputs — control signals (right side, top to bottom).
      // Slot order matches the bit positions in the microcode word, so
      // existing wiring templates (which use slots 0..15) remain valid and
      // the new mode signals appear below them as slots 16..20.
      makePin('CO',   'out', 1, 'right', 0),
      makePin('CE',   'out', 1, 'right', 1),
      makePin('MI',   'out', 1, 'right', 2),
      makePin('RO',   'out', 1, 'right', 3),
      makePin('RI',   'out', 1, 'right', 4),
      makePin('II',   'out', 1, 'right', 5),
      makePin('IO',   'out', 1, 'right', 6),
      makePin('AI',   'out', 1, 'right', 7),
      makePin('AO',   'out', 1, 'right', 8),
      makePin('BI',   'out', 1, 'right', 9),
      makePin('EO',   'out', 1, 'right', 10),
      makePin('SU',   'out', 1, 'right', 11),
      makePin('OI',   'out', 1, 'right', 12),
      makePin('FI',   'out', 1, 'right', 13),
      makePin('HLT',  'out', 1, 'right', 14),
      makePin('J',    'out', 1, 'right', 15),
      // ALU mode signals — for the extended ALU.
      makePin('ANDI', 'out', 1, 'right', 16),
      makePin('ORI',  'out', 1, 'right', 17),
      makePin('XORI', 'out', 1, 'right', 18),
      makePin('SHLI', 'out', 1, 'right', 19),
      makePin('SHRI', 'out', 1, 'right', 20),
      // Stack, input, and extra bus-control signals — match the Extended
      // SAP-1 simulator (cpu.js).  Microcode that fires these requires the
      // 8-bit opcode refactor, scheduled for Phase 2.  For now they're
      // available as CU outputs that can be manually exercised.
      makePin('BO',   'out', 1, 'right', 21),   // B register → bus
      makePin('PCI',  'out', 1, 'right', 22),   // PC ← bus (used by CALL/RET)
      makePin('SPO',  'out', 1, 'right', 23),   // SP → address bus
      makePin('SPI',  'out', 1, 'right', 24),   // SP ← bus
      makePin('SPD',  'out', 1, 'right', 25),   // SP decrement
      makePin('SPUP', 'out', 1, 'right', 26),   // SP increment
      makePin('INO',  'out', 1, 'right', 27),   // Input register → bus
    ];
  }

  _bodyColor()   { return '#2a0a0a'; }
  _headerColor() { return '#4a1a1a'; }

  simulate(risingEdge) {
    // Reset
    if (this.getPin('RST').value) {
      this._tState = 0;
      this._halted = false;
      this._ie     = 0;          // interrupts off at reset
    }

    // Only advance on risingEdge (called from step 3 of bbPropagate)
    // This ensures registers latch with CURRENT signals before CU advances
    if (risingEdge) {
      if (!this._powered) {
        this._powered = true;
        this._tState = 0;  // start at T0
      } else if (!this._halted) {
        this._tState = (this._tState + 1) % this._tStateCount;
      }

      // ── Interrupt entry ─────────────────────────────────────────────
      // Check at the start of a new instruction (T-state just wrapped to 0).
      // If IRQ is high and IE is set, save PC and redirect to handler @ 0xFE.
      if (this._tState === 0 && this.getPin('IRQ').value && this._ie) {
        const pc = this._findPC();
        if (pc) {
          this._savedPC = pc._count & 0xFF;
          pc._count     = this._intVector;    // 0xFE
          this._ie      = 0;                  // disable further IRQs until RTI
        }
      }
    }

    // All 28 control signals, in bit-position order 0..27 — matches the
    // microcode word layout exactly so index `i` ↔ bit `i`.
    const ALL_SIGS = [
      'CO','CE','MI','RO','RI','II','IO','AI','AO','BI','EO','SU',
      'OI','FI','HLT','J',
      'ANDI','ORI','XORI','SHLI','SHRI',
      'BO','PCI','SPO','SPI','SPD','SPUP','INO',
    ];

    // No signals until powered
    if (!this._powered) {
      for (const s of ALL_SIGS) this.getPin(s).value = 0;
      return;
    }

    const S = this._SIG;
    // 8-bit opcode — use the full byte from IR.  Supports the Extended SAP-1
    // instruction set (opcodes 0x00–0x19).  Any opcode above 0x19 is treated
    // as NOP (all-zero microcode).
    const opcode = this.getPin('OPCODE').value & 0xFF;
    let word = this._microcode[opcode][this._tState] | 0;

    // Conditional jumps — mask out J when the branch condition is NOT met.
    // All four conditional branches (JC / JZ / JNZ / JNC) fire J on T3.
    if (this._tState === 3) {
      const cf = this.getPin('CF').value;
      const zf = this.getPin('ZF').value;
      if (opcode === 0x07 && !cf) word &= ~S.J;   // JC  but CF=0
      if (opcode === 0x08 && !zf) word &= ~S.J;   // JZ  but ZF=0
      if (opcode === 0x16 &&  zf) word &= ~S.J;   // JNZ but ZF=1
      if (opcode === 0x17 &&  cf) word &= ~S.J;   // JNC but CF=1
    }

    // HLT
    if (word & S.HLT) this._halted = true;

    // ── Side-effect opcodes for interrupts ──────────────────────────
    // These fire their effect once at T2 of each instance (then T-state
    // advances and the rest of T-states are NOPs that do nothing).
    if (this._tState === 2 && risingEdge) {
      if (opcode === 0x1C) this._ie = 1;          // EI
      if (opcode === 0x1D) this._ie = 0;          // DI
      if (opcode === 0x15) {                       // RTI
        const pc = this._findPC();
        if (pc) pc._count = this._savedPC & 0xFF;
        this._ie = 1;
      }
    }

    // Output all signals — bit i of `word` drives ALL_SIGS[i]
    for (let i = 0; i < ALL_SIGS.length; i++) {
      this.getPin(ALL_SIGS[i]).value = (word >> i) & 1;
    }
  }

  _findPC() {
    const BB = window.BB;
    if (!BB || !BB.components) return null;
    for (const c of BB.components) {
      if (c && c.type === 'PC') return c;
    }
    return null;
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

      // Show opcode (full 8-bit)
      const opcode = this.getPin('OPCODE').value & 0xFF;
      const mnemonics = {
        0x00:'NOP', 0x01:'LDA', 0x02:'ADD', 0x03:'SUB', 0x04:'STA', 0x05:'LDI',
        0x06:'JMP', 0x07:'JC',  0x08:'JZ',  0x09:'AND', 0x0A:'OR',  0x0B:'XOR',
        0x0C:'SHL', 0x0D:'SHR', 0x0E:'OUT', 0x0F:'HLT',
        0x10:'PUSH',0x11:'POP', 0x12:'CALL',0x13:'RET', 0x14:'IN',  0x15:'RTI',
        0x16:'JNZ', 0x17:'JNC', 0x18:'LDB', 0x19:'CMP',
        0x1A:'LDA_IND', 0x1B:'STA_IND',
      };
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
//  STACK POINTER — 8-bit register with increment, decrement, load, reset
// ══════════════════════════════════════════════════════════════════
class StackPointerComponent extends BreadboardComponent {
  constructor(x, y) {
    super('SP', x, y, 'STACK PTR');
    this.w = 150; this.h = 160;
    this._sp = 0xFF;           // stack grows downward — start at top of RAM
    this._lastClk = 0;
  }
  _initPins() {
    this.pins = [
      // Inputs — pin names match the CU signal that drives them, so wiring
      // CU.SPO → SP.SPO, CU.SPI → SP.SPI etc. reads like "connect signal
      // to its target."
      makePin('DIN',  'in',  8, 'left', 0),
      makePin('CLK',  'in',  1, 'left', 1),
      makePin('SPI',  'in',  1, 'left', 2),   // load DIN on clock edge
      makePin('SPD',  'in',  1, 'left', 3),   // decrement on clock edge
      makePin('SPUP', 'in',  1, 'left', 4),   // increment on clock edge
      makePin('SPO',  'in',  1, 'left', 5),   // tri-state output enable
      makePin('RST',  'in',  1, 'left', 6),   // reset to 0xFF
      // Outputs
      makePin('Q',      'out', 8, 'right', 0),   // tri-state, gated by SPO
      makePin('DIRECT', 'out', 8, 'right', 1),   // always outputs current SP
    ];
  }
  _bodyColor()   { return '#1a0e2a'; }
  _headerColor() { return '#2a1a3a'; }

  simulate(risingEdge) {
    // Async reset — as soon as RST is high, SP jumps to 0xFF
    if (this.getPin('RST').value) {
      this._sp = 0xFF;
    }
    if (risingEdge) {
      if (this.getPin('SPI').value) {
        this._sp = this.getPin('DIN').value & 0xFF;
      } else if (this.getPin('SPD').value) {
        this._sp = (this._sp - 1) & 0xFF;
      } else if (this.getPin('SPUP').value) {
        this._sp = (this._sp + 1) & 0xFF;
      }
    }
    const spo = this.getPin('SPO').value;
    this.getPin('Q').value      = spo ? this._sp : 0;
    this.getPin('DIRECT').value = this._sp;
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2;
    const cy = sy + sh / 2 + 4 * cam.scale;
    ctx.font         = `bold ${Math.max(10, 13*cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#cc88ff';
    ctx.fillText('SP = 0x' + this._sp.toString(16).padStart(2, '0').toUpperCase(), cx, cy);
    ctx.font = `${Math.max(8, 9*cam.scale)}px monospace`;
    ctx.fillStyle = '#4a3a5a';
    ctx.fillText('grows downward', cx, cy + 18 * cam.scale);
  }

  get description() {
    return 'The Stack Pointer is a dedicated 8-bit register that holds the current top-of-stack address. It resets to 0xFF (top of RAM) because the stack grows downward in memory. The CU drives its four mode pins: SPI loads a new SP value from the data bus, SPD decrements (after a PUSH), SPUP increments (after a POP), and SPO tri-state-enables its output onto the address bus. Together with PUSH/POP/CALL/RET instructions, this component makes function calls and local variables possible.';
  }
}

// ══════════════════════════════════════════════════════════════════
//  INPUT REGISTER — exposes a user-settable 8-bit value to the bus
// ══════════════════════════════════════════════════════════════════
class InputRegisterComponent extends BreadboardComponent {
  constructor(x, y) {
    super('InputReg', x, y, 'INPUT REG');
    this.w = 140; this.h = 110;
    this._value = 0;
  }
  _initPins() {
    this.pins = [
      // Inputs
      makePin('VALUE', 'in',  8, 'left', 0),   // external source (Switch/Const)
      makePin('CLK',   'in',  1, 'left', 1),
      makePin('INO',   'in',  1, 'left', 2),   // tri-state output enable
      // Outputs
      makePin('Q',     'out', 8, 'right', 0),   // tri-state, gated by INO
      makePin('DIRECT','out', 8, 'right', 1),   // always presents VALUE
    ];
  }
  _bodyColor()   { return '#0e1a2a'; }
  _headerColor() { return '#1a2a40'; }

  simulate() {
    this._value = this.getPin('VALUE').value & 0xFF;
    const ino = this.getPin('INO').value;
    this.getPin('Q').value      = ino ? this._value : 0;
    this.getPin('DIRECT').value = this._value;
  }

  _renderInterior(ctx, cam, sx, sy, sw, sh) {
    if (cam.scale < 0.4) return;
    const cx = sx + sw / 2;
    const cy = sy + sh / 2 + 4 * cam.scale;
    ctx.font         = `bold ${Math.max(10, 13*cam.scale)}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#66aaff';
    ctx.fillText('IN = ' + this._value, cx, cy);
    ctx.font = `${Math.max(7, 9*cam.scale)}px monospace`;
    ctx.fillStyle = '#3a5a8a';
    ctx.fillText('(wire VALUE ← Switch/Const)', cx, cy + 18 * cam.scale);
  }

  get description() {
    return 'The Input Register holds the value of an external input source — typically a bank of switches or a sensor. Wire any 8-bit source (Switch bank, Constant, etc.) to its VALUE pin, and the IN instruction will read that value when the CU asserts INO. This is how the CPU receives data from the outside world. Conceptually identical to a memory-mapped input port.';
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
    case 'SP':      return new StackPointerComponent(x, y);
    case 'InputReg':return new InputRegisterComponent(x, y);
    case 'LEDBank': return new LEDBankComponent(x, y);
    case 'Keyboard':return new KeyboardComponent(x, y);
    case 'Timer':   return new TimerComponent(x, y);
    default:        return new RegisterComponent(x, y, type);
  }
}

// ── PALETTE DEFINITIONS ────────────────────────────────────────────────────
const PALETTE_ITEMS = [
  { section: 'Clock & Control' },
  { type: 'Clock',    label: 'Clock',        desc: 'Generates CLK pulses', pins: 'CLK out' },
  { type: 'CU',       label: 'Control Unit', desc: 'Microcode EEPROM — decodes opcode + T-state → 28 signals (full Extended SAP-1)', pins: 'OPCODE,CF,ZF → CO,CE,MI,RO,RI,II,IO,AI,AO,BI,EO,SU,OI,FI,HLT,J, ANDI,ORI,XORI,SHLI,SHRI, BO,PCI,SPO,SPI,SPD,SPUP,INO' },
  { type: 'Switch',   label: 'Switch',       desc: 'Manual 1-bit toggle',  pins: '1-bit out' },
  { type: 'Const',    label: 'Constant',     desc: '8-bit constant value', pins: '8-bit out' },

  { section: 'Registers' },
  { type: 'Register', label: '8-Bit Reg',    desc: 'Latch + tri-state buf',pins: 'D/Q/CLK/LOAD/EN' },
  { type: 'IR',       label: 'Instr Reg',    desc: 'Holds current opcode (8-bit, 2-byte encoding)', pins: 'DIN(8) / OPCODE(8); OPERAND pins deprecated' },
  { type: 'MAR',      label: 'Addr Reg',     desc: 'Memory address hold',  pins: 'DIN(8) / ADDR(8)' },
  { type: 'Flags',    label: 'Flags',        desc: 'CF and ZF storage',    pins: 'CF/ZF in/out' },

  { section: 'Buses' },
  { type: 'Bus',      label: 'Data Bus',     desc: '8-bit shared data highway',  pins: '5 ports (IN+OUT each)' },
  { type: 'AddrBus',  label: 'Addr Bus',     desc: '8-bit address highway (256-byte reach)', pins: '4 ports (IN+OUT each)' },

  { section: 'Compute' },
  { type: 'ALU',      label: 'ALU',          desc: 'ADD/SUB/AND/OR/XOR/SHL/SHR',  pins: 'A,B,SUB,ANDI,ORI,XORI,SHLI,SHRI → OUT,CF,ZF' },
  { type: 'PC',       label: 'Prog Counter', desc: '8-bit up-counter',     pins: 'DIN(8)/DOUT(8)/INC/LOAD/EN' },
  { type: 'SP',       label: 'Stack Ptr',    desc: '8-bit up/down counter (stack pointer)', pins: 'DIN/SPI/SPD/SPUP/SPO/RST → Q/DIRECT' },

  { section: 'Memory & I/O' },
  { type: 'RAM',      label: 'RAM 256x8',    desc: '256-byte memory',      pins: 'ADDR/DIN/DOUT/WR/RD' },
  { type: 'InputReg', label: 'Input Reg',    desc: 'External input port (user-settable)', pins: 'VALUE/INO → Q/DIRECT' },
  { type: 'Output',   label: 'Output Disp',  desc: '7-seg style display',  pins: 'DIN/CLK/LOAD' },
  { type: 'LEDBank',  label: 'LED Bank',     desc: 'Memory-mapped 8 LEDs at 0xF4 — STA 0xF4 lights them', pins: 'ADDR/DIN/WR/CLK' },
  { type: 'Keyboard', label: 'Keyboard',     desc: 'Memory-mapped input at 0xF1 + IRQ_OUT for interrupts — LDA 0xF1 reads key.', pins: 'ADDR/RD/CLK/IRQ_OUT' },
  { type: 'Timer',    label: 'Timer',        desc: '16-bit free-running counter at 0xF2 (low) / 0xF3 (high). Write 0xF2 to reset.', pins: 'ADDR/WR/CLK' },
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
window.LEDBankComponent           = LEDBankComponent;
window.KeyboardComponent          = KeyboardComponent;
window.TimerComponent             = TimerComponent;
window.createComponent            = createComponent;
window.PALETTE_ITEMS              = PALETTE_ITEMS;
