/**
 * Breadboard CPU Template
 * Loads a fully pre-wired, labeled, color-coded SAP-1 CPU onto the breadboard.
 * Depends on: bb-core.js, bb-components.js, bb-engine.js
 */

// ─── Template Programs ────────────────────────────────────────────────────
const CPU_TEMPLATE_PROGRAMS = {
  'add-two-numbers': {
    name: 'Add Two Numbers',
    desc: 'Loads 5 into A, adds 3 from address 14, outputs result (8), then halts.',
    bytes: [
      0x55, // LDI 5      — Load immediate 5 into A
      0x2E, // ADD 14     — A = A + RAM[14] (RAM[14]=3 → result 8)
      0xE0, // OUT        — Display A on output
      0xF0, // HLT        — Stop
      0x00, 0x00, 0x00, 0x00,  // unused
      0x00, 0x00, 0x00, 0x00,  // unused
      0x00, 0x00, 0x03, 0x00,  // [14]=3 (data)
    ],
  },
  'count-to-five': {
    name: 'Count to 5',
    desc: 'Counts from 1 to 5 and displays each value. Uses a loop with zero-flag check.',
    bytes: [
      0x51, // LDI 1      — [0] Start A=1
      0xE0, // OUT        — [1] Display A
      0x2F, // ADD 15     — [2] A = A + RAM[15] (add 1)
      0x39, // SUB 9      — [3] Compare: A - RAM[9] (value 6 at addr 9) — sets ZF if A==6
      0x87, // JZ 7       — [4] If ZF (A was 6), jump to HLT at addr 7
      0x29, // ADD 9      — [5] A = A + RAM[9] (undo the subtract: add 6 back, keep value)
      0x61, // JMP 1      — [6] Loop back to OUT
      0xF0, // HLT        — [7] Done
      0x00, // [8] unused
      0x06, // [9] comparison value: 6 (stop when A reaches 6)
      0x00, 0x00, 0x00, 0x00, 0x00,
      0x01, // [15] increment: 1
    ],
  },
  'store-and-load': {
    name: 'Store and Load',
    desc: 'Loads immediate 42 (=0x2A, lower 4 bits = 0x0A = 10) into A, stores it at address 15, clears A, then reloads from address 15 and displays it.',
    bytes: [
      0x5A, // LDI 10 (0x0A) — A = 10 (lower nibble of 0x5A)
      0x4F, // STA 15        — RAM[15] = A
      0x50, // LDI 0         — A = 0
      0x1F, // LDA 15        — A = RAM[15]
      0xE0, // OUT           — Display A (should show 10)
      0xF0, // HLT           — Stop
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, // [15] will be written by STA
    ],
  },
};

// ─── Component descriptions for connected wires section ──────────────────
const WIRE_DESCRIPTIONS = {
  clock:    'Clock pulse — synchronizes all components',
  data:     'Data bus — carries 8-bit values between components',
  address:  'Address bus — carries 4-bit RAM addresses',
  control:  'Control signal — activates component behavior each T-state',
  alu:      'ALU connection — arithmetic operands or results',
  feedback: 'Feedback — sends component state back to Control Unit',
};

// ─── Main template loader ─────────────────────────────────────────────────
function bbLoadTemplate(programKey) {
  programKey = programKey || 'add-two-numbers';
  const prog = CPU_TEMPLATE_PROGRAMS[programKey];
  if (!prog) { bbLog('Unknown template program: ' + programKey, 'err'); return; }

  // Clear existing board
  BB.components = [];
  BB.wires      = [];
  BB.selected   = null;
  bbStopAutoRun();

  // ── Layout constants ──────────────────────────────────────────────────
  // The board is organized left-to-right following data flow.
  // Each row has a clear conceptual role.
  //
  //  ROW 1 (y=40):   CLOCK (left)                    OUTPUT DISPLAY (right)
  //  ROW 2 (y=200):  PC  ←→ ADDR BUS ←→  MAR
  //  ROW 3 (y=380):        DATA BUS  ←→  RAM
  //  ROW 4 (y=560):  REG A      REG B      INSTR REG
  //  ROW 5 (y=740):      ALU              CONTROL UNIT
  //  ROW 6 (y=920):    FLAGS

  const R = {
    // Row 1
    clock:    { x:  60, y:  40 },
    output:   { x: 980, y:  40 },
    // Row 2
    pc:       { x:  60, y: 200 },
    addrBus:  { x: 380, y: 200 },
    mar:      { x: 680, y: 200 },
    // Row 3
    dataBus:  { x: 380, y: 380 },
    ram:      { x: 680, y: 340 },
    // Row 4
    regA:     { x:  60, y: 560 },
    regB:     { x: 280, y: 560 },
    ir:       { x: 680, y: 560 },
    // Row 5
    alu:      { x: 160, y: 740 },
    cu:       { x: 600, y: 700 },
    // Row 6
    flags:    { x: 160, y: 920 },
  };

  // ── Place components ──────────────────────────────────────────────────
  const clock   = createComponent('Clock',    R.clock.x,   R.clock.y);
  const output  = createComponent('Output',   R.output.x,  R.output.y);
  const pc      = createComponent('PC',       R.pc.x,      R.pc.y);
  const addrBus = createComponent('AddrBus',  R.addrBus.x, R.addrBus.y);
  const mar     = createComponent('MAR',      R.mar.x,     R.mar.y);
  const dataBus = createComponent('Bus',      R.dataBus.x, R.dataBus.y);
  const ram     = createComponent('RAM',      R.ram.x,     R.ram.y);
  const regA    = createComponent('Register', R.regA.x,    R.regA.y, { label: 'REG A' });
  const regB    = createComponent('Register', R.regB.x,    R.regB.y, { label: 'REG B' });
  const ir      = createComponent('IR',       R.ir.x,      R.ir.y);
  const alu     = createComponent('ALU',      R.alu.x,     R.alu.y);
  const cu      = createComponent('CU',       R.cu.x,      R.cu.y);
  const flags   = createComponent('Flags',    R.flags.x,   R.flags.y);

  // Load program into RAM
  if (prog.bytes) {
    ram.loadBytes(prog.bytes);
  }

  // Add all components
  const allComps = [clock, output, pc, addrBus, mar, dataBus, ram, regA, regB, ir, alu, cu, flags];
  for (const c of allComps) BB.components.push(c);

  // ── Helper: add wire with label and color ──────────────────────────────
  function addWire(fromComp, fromPin, toComp, toPin, label, colorCat) {
    if (!fromComp.getPin(fromPin)) { console.warn(`Template: ${fromComp.label} missing pin ${fromPin}`); return null; }
    if (!toComp.getPin(toPin))     { console.warn(`Template: ${toComp.label} missing pin ${toPin}`);   return null; }
    const wire    = new Wire(fromComp, fromPin, toComp, toPin);
    wire.label    = label   || null;
    wire.color    = (WIRE_CAT_COLORS && WIRE_CAT_COLORS[colorCat]) || wire.color;
    // Mark pins connected
    const fp = fromComp.getPin(fromPin);
    const tp = toComp.getPin(toPin);
    if (fp) fp._connected = true;
    if (tp) tp._connected = true;
    BB.wires.push(wire);
    return wire;
  }

  // ── CLOCK DISTRIBUTION (green) ────────────────────────────────────────
  addWire(clock, 'CLK', cu,      'CLK',  'CLK to CU',     'clock');
  addWire(clock, 'CLK', regA,    'CLK',  'CLK to A',      'clock');
  addWire(clock, 'CLK', regB,    'CLK',  'CLK to B',      'clock');
  addWire(clock, 'CLK', mar,     'CLK',  'CLK to MAR',    'clock');
  addWire(clock, 'CLK', ir,      'CLK',  'CLK to IR',     'clock');
  addWire(clock, 'CLK', ram,     'CLK',  'CLK to RAM',    'clock');
  addWire(clock, 'CLK', pc,      'CLK',  'CLK to PC',     'clock');
  addWire(clock, 'CLK', flags,   'CLK',  'CLK to FLAGS',  'clock');
  addWire(clock, 'CLK', output,  'CLK',  'CLK to OUTPUT', 'clock');

  // ── DATA BUS connections (amber) ──────────────────────────────────────
  // Reg A drives bus (AO), bus loads Reg A (AI)
  addWire(regA,    'Q',     dataBus, 'P0_IN',  'A out (AO)',    'data');
  addWire(dataBus, 'P0_OUT',regA,    'D',       'Bus to A (AI)', 'data');
  // Reg B drives bus (BI source), bus loads B
  addWire(regB,    'Q',     dataBus, 'P1_IN',  'B out (BO)',    'data');
  addWire(dataBus, 'P1_OUT',regB,    'D',       'Bus to B (BI)', 'data');
  // RAM drives bus (RO), bus writes RAM (RI)
  addWire(ram,     'DOUT',  dataBus, 'P2_IN',  'RAM out (RO)',  'data');
  addWire(dataBus, 'P2_OUT',ram,     'DIN',     'Bus to RAM (RI)','data');
  // ALU drives bus (EO)
  addWire(alu,     'OUT',   dataBus, 'P3_IN',  'ALU out (EO)',  'data');
  // Bus loads IR (II)
  addWire(dataBus, 'P3_OUT',ir,      'DIN',     'Bus to IR (II)','data');
  // IR operand drives data bus for LDI (IO signal)
  addWire(ir,      'OPERAND_D', dataBus, 'P4_IN', 'IR imm to bus (LDI)', 'data');
  // Bus loads Output (OI)
  addWire(dataBus, 'P4_OUT',output,  'DIN',     'Bus to OUT (OI)','data');

  // ── ADDRESS BUS connections (blue) ────────────────────────────────────
  // PC drives address bus (CO)
  addWire(pc,      'DOUT',  addrBus, 'P0_IN',  'PC addr (CO)',  'address');
  // IR operand drives address bus (IO)
  addWire(ir,      'OPERAND',addrBus,'P1_IN',  'IR operand (IO)','address');
  // Address bus feeds MAR (MI)
  addWire(addrBus, 'P2_OUT',mar,     'DIN',     'Addr to MAR (MI)','address');
  // Address bus loads PC for JMP (J)
  addWire(addrBus, 'P0_OUT',pc,      'DIN',     'Bus to PC (JMP)', 'address');
  // MAR selects RAM address (permanently connected)
  addWire(mar,     'ADDR',  ram,     'ADDR',   'MAR to RAM addr', 'address');

  // ── ALU connections (orange) ──────────────────────────────────────────
  // DIRECT pins always output the stored value (unlike Q which needs ENABLE)
  addWire(regA,  'DIRECT',  alu, 'A',  'A to ALU (always)',  'alu');
  addWire(regB,  'DIRECT',  alu, 'B',  'B to ALU (always)',  'alu');
  addWire(alu,   'CF', flags,'CF_IN','Carry flag',  'alu');
  addWire(alu,   'ZF', flags,'ZF_IN','Zero flag',   'alu');

  // ── CONTROL UNIT signal outputs (red) ────────────────────────────────
  addWire(cu, 'CO',  pc,     'ENABLE', 'CO: PC out',    'control');
  addWire(cu, 'CE',  pc,     'INC',    'CE: PC inc',    'control');
  addWire(cu, 'MI',  mar,    'LOAD',   'MI: MAR in',    'control');
  addWire(cu, 'RO',  ram,    'RD',     'RO: RAM out',   'control');
  addWire(cu, 'RI',  ram,    'WR',     'RI: RAM in',    'control');
  addWire(cu, 'II',  ir,     'LOAD',   'II: IR in',     'control');
  addWire(cu, 'IO',  ir,     'ENABLE', 'IO: IR operand','control');
  addWire(cu, 'AI',  regA,   'LOAD',   'AI: A in',      'control');
  addWire(cu, 'AO',  regA,   'ENABLE', 'AO: A out',     'control');
  addWire(cu, 'BI',  regB,   'LOAD',   'BI: B in',      'control');
  addWire(cu, 'EO',  alu,    'ENABLE', 'EO: ALU out',   'control');
  addWire(cu, 'SU',  alu,    'SUB',    'SU: subtract',  'control');
  addWire(cu, 'OI',  output, 'LOAD',   'OI: Output in', 'control');
  addWire(cu, 'FI',  flags,  'LOAD',   'FI: Flags in',  'control');
  addWire(cu, 'J',   pc,     'LOAD',   'J: jump',       'control');

  // ── FEEDBACK to Control Unit (purple) ─────────────────────────────────
  addWire(ir,    'OPCODE', cu, 'OPCODE', 'Opcode to CU',  'feedback');
  addWire(flags, 'CF',     cu, 'CF',     'CF to CU',      'feedback');
  addWire(flags, 'ZF',     cu, 'ZF',     'ZF to CU',      'feedback');

  // ── Camera: fit everything ─────────────────────────────────────────────
  // Board spans roughly x:40–1140, y:40–1020
  // Find actual bounds from placed components
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of BB.components) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.w);
    maxY = Math.max(maxY, c.y + c.h);
  }
  const padW = 80, padH = 60;
  const boardW = maxX - minX + padW * 2;
  const boardH = maxY - minY + padH * 2;
  const canvasW = BB.canvas ? BB.canvas.width  : 900;
  const canvasH = BB.canvas ? BB.canvas.height : 600;
  const fitScale = Math.min(canvasW / boardW, canvasH / boardH, 1.0);
  BB.cam = {
    scale: Math.max(0.3, fitScale),
    ox: padW * fitScale - minX * fitScale,
    oy: padH * fitScale - minY * fitScale,
  };

  bbRefreshPinConnected();

  // Auto-pulse once to power on the CU (initialization cycle)
  // This sets CU to T0 and outputs the first fetch signals (CO|MI)
  bbPulse();

  bbSaveState();
  bbUpdateInspector();
  bbLog(`Template loaded: "${prog.name}". CU powered on at T0. Press Pulse to step through!`, 'ok');

  // Activate Controls tab
  bbActivateSidebarTab('controls');
}

// ─── Wire click detection ─────────────────────────────────────────────────
// Returns the wire nearest to screen point (sx,sy) or null
function bbGetWireNear(sx, sy, maxDist) {
  maxDist = maxDist || 300; // squared dist
  let best = null;
  let bestD = maxDist;
  for (const wire of BB.wires) {
    const fp = wire.from.comp.getPinScreenPos(wire.from.pin, BB.cam);
    const tp = wire.to.comp.getPinScreenPos(wire.to.pin, BB.cam);
    if (!fp || !tp) continue;
    const dx   = tp.x - fp.x;
    const cpOff = Math.min(Math.abs(dx) * 0.5 + 30, 80);
    // Sample 7 points along bezier
    for (const t of [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9]) {
      const cp1x = fp.x + cpOff, cp1y = fp.y;
      const cp2x = tp.x - cpOff, cp2y = tp.y;
      const bx = (1-t)**3 * fp.x + 3*(1-t)**2*t * cp1x + 3*(1-t)*t**2 * cp2x + t**3 * tp.x;
      const by = (1-t)**3 * fp.y + 3*(1-t)**2*t * cp1y + 3*(1-t)*t**2 * cp2y + t**3 * tp.y;
      const d = (sx - bx)**2 + (sy - by)**2;
      if (d < bestD) { bestD = d; best = wire; }
    }
  }
  return best;
}

// ─── Show wire detail tooltip ─────────────────────────────────────────────
function bbShowWireTooltip(wire, clientX, clientY) {
  let tip = document.getElementById('bb-wire-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'bb-wire-tooltip';
    tip.className = 'bb-wire-tooltip';
    document.body.appendChild(tip);
  }
  const fromLabel = `${wire.from.comp.label} · ${wire.from.pin}`;
  const toLabel   = `${wire.to.comp.label} · ${wire.to.pin}`;
  const val       = wire.value;
  const valStr    = wire.from.comp.getPin(wire.from.pin)?.bits === 8
    ? `0x${(val & 0xFF).toString(16).toUpperCase().padStart(2,'0')} (${val})`
    : `${val}`;

  tip.innerHTML = `
    <div class="wt-row wt-src"><span class="wt-lbl">From:</span> ${fromLabel}</div>
    <div class="wt-row wt-dst"><span class="wt-lbl">To:</span>   ${toLabel}</div>
    ${wire.label ? `<div class="wt-row wt-name"><span class="wt-lbl">Role:</span> ${wire.label}</div>` : ''}
    <div class="wt-row wt-val"><span class="wt-lbl">Value:</span> <span style="color:${wire.color}">${valStr}</span></div>
  `;
  tip.style.left    = (clientX + 14) + 'px';
  tip.style.top     = (clientY - 8)  + 'px';
  tip.style.display = 'block';
  tip.style.borderColor = wire.color;
}

function bbHideWireTooltip() {
  const tip = document.getElementById('bb-wire-tooltip');
  if (tip) tip.style.display = 'none';
}

// ─── "What happens next?" overlay ────────────────────────────────────────
// Called after each pause; draws a pulsing annotation on next affected comp.
function bbWhatHappensNext() {
  const cu = BB.components.find(c => c instanceof ControlUnitComponent);
  if (!cu || !cu._powered || cu._halted) return null;

  const tNext  = (cu._tState + 1) % 5;  // next T-state after next pulse
  const S      = cu._SIG;
  const opcode = (cu.getPin('OPCODE').value >> 4) & 0x0F;
  let nextWord = cu._microcode[opcode] ? cu._microcode[opcode][tNext] : 0;

  // Build a human-readable summary
  const sigNames = ['CO','CE','MI','RO','RI','II','IO','AI','AO','BI','EO','SU','OI','FI','HLT','J'];
  const active = [];
  for (let i = 0; i < sigNames.length; i++) {
    if ((nextWord >> i) & 1) active.push(sigNames[i]);
  }

  const explanations = {
    'CO|MI':  'PC will output its address → MAR will capture it (Fetch step 1)',
    'RO|II|CE': 'RAM will output instruction → IR will latch it → PC increments (Fetch step 2)',
    'IO|MI':  'IR operand will address the memory → MAR will capture it',
    'RO|AI':  'RAM will output data → Register A will load it (LDA execute)',
    'RO|BI':  'RAM will output data → Register B will load it (for ALU)',
    'EO|AI|FI': 'ALU result will go to A → flags will update (ADD/SUB result)',
    'EO|AI|SU|FI': 'ALU will subtract → result into A → flags update (SUB)',
    'IO|AI':  'IR immediate operand will load directly into A (LDI)',
    'IO|J':   'IR operand will become the new PC value (JMP)',
    'AO|OI':  'A register will output → Output display will latch it (OUT)',
    'AO|RI':  'A register will write to RAM at MAR address (STA)',
    'HLT':    'CPU will halt — the clock will stop',
  };

  const key = active.join('|');
  const explain = explanations[key] || (active.length ? `T${tNext}: ${active.join(' + ')}` : `T${tNext}: NOP`);

  return { tNext, active, explain };
}

// ─── Template program selector helper ─────────────────────────────────────
function bbGetTemplatePrograms() {
  return Object.entries(CPU_TEMPLATE_PROGRAMS).map(([key, prog]) => ({ key, ...prog }));
}

// ─── Export ───────────────────────────────────────────────────────────────
window.bbLoadTemplate      = bbLoadTemplate;
window.bbGetWireNear       = bbGetWireNear;
window.bbShowWireTooltip   = bbShowWireTooltip;
window.bbHideWireTooltip   = bbHideWireTooltip;
window.bbWhatHappensNext   = bbWhatHappensNext;
window.bbGetTemplatePrograms = bbGetTemplatePrograms;
window.CPU_TEMPLATE_PROGRAMS = CPU_TEMPLATE_PROGRAMS;
