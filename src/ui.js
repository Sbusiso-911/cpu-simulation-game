/**
 * CPU Simulator UI Controller — Enhanced
 * All visualization, interaction, and tab logic.
 */

// ─────────────────────────────────────────
//  APP STATE
// ─────────────────────────────────────────

const App = {
  cpu:               null,
  assembler:         null,
  lastState:         null,
  runInterval:       null,
  runSpeed:          200,
  clockWaveform:     [],
  waveformMax:       48,
  outputHistory:     [],
  maxOutputHistory:  50,
  // History (execution timeline)
  execHistory:       [],
  maxExecHistory:    200,
  selectedHistoryIdx: -1,
  // Challenges
  challenges:        [],
  currentChallenge:  null,
  solvedChallenges:  new Set(),
  // Microcode editing
  editedMicrocode:   {},   // opcode → array of control words
  // Pipeline data
  pipelineRows:      [],
  maxPipelineRows:   8,
  // Bus flow animation
  busFlowActive:     false,
  busFlowTimer:      null,
};

// ─────────────────────────────────────────
//  CHALLENGES DATA
// ─────────────────────────────────────────

const CHALLENGES = [
  {
    id: 'ch1',
    title: 'Load and Output',
    difficulty: 'Beginner',
    description: 'Write a program that loads the value 7 into the A register and outputs it.',
    hint: 'Use LDI to load an immediate value, then OUT to display it. Finish with HLT.',
    expectedOutput: [7],
    checkOutput: (outputs) => outputs.length > 0 && outputs[outputs.length - 1] === 7,
  },
  {
    id: 'ch2',
    title: 'Add 3 + 5',
    difficulty: 'Beginner',
    description: 'Store 3 and 5 in memory, add them together, and output the result (8).',
    hint: 'Use .org and .byte to place your data, then LDA, ADD, OUT, HLT. Remember: 2-byte instructions need an address operand.',
    expectedOutput: [8],
    checkOutput: (outputs) => outputs.length > 0 && outputs[outputs.length - 1] === 8,
  },
  {
    id: 'ch3',
    title: 'Count from 1 to 5',
    difficulty: 'Beginner',
    description: 'Output the values 1, 2, 3, 4, 5 in order using a loop.',
    hint: 'Use a counter variable in RAM. LDA the counter, OUT it, ADD 1, CMP 5, JZ done, JMP loop. Or use JNZ.',
    expectedOutput: [1, 2, 3, 4, 5],
    checkOutput: (outputs) => {
      if (outputs.length < 5) return false;
      const last5 = outputs.slice(-5);
      return last5.every((v, i) => v === i + 1);
    },
  },
  {
    id: 'ch4',
    title: 'Multiply 3 × 4',
    difficulty: 'Intermediate',
    description: 'Compute 3 × 4 = 12 using only ADD (no multiply instruction). Output the result.',
    hint: 'Add the multiplicand (3) to an accumulator exactly 4 times using a loop counter.',
    expectedOutput: [12],
    checkOutput: (outputs) => outputs.length > 0 && outputs[outputs.length - 1] === 12,
  },
  {
    id: 'ch5',
    title: 'Echo Input',
    difficulty: 'Beginner',
    description: 'Read the value from the Input register and echo it to output. Set Input to 42 before running.',
    hint: 'Use IN to read the input register into A, then OUT, then HLT.',
    expectedOutput: [42],
    checkOutput: (outputs) => outputs.length > 0 && outputs[outputs.length - 1] === 42,
  },
  {
    id: 'ch6',
    title: 'Subroutine: Double',
    difficulty: 'Intermediate',
    description: 'Write a subroutine that doubles A (A = A + A). Call it with A=5. Output should be 10.',
    hint: 'Use CALL to jump to your subroutine. Inside, use STA and ADD to double. RET to return. The stack saves the return address automatically.',
    expectedOutput: [10],
    checkOutput: (outputs) => outputs.length > 0 && outputs[outputs.length - 1] === 10,
  },
  {
    id: 'ch7',
    title: 'Fibonacci First 5',
    difficulty: 'Advanced',
    description: 'Output the first 5 Fibonacci numbers: 1, 1, 2, 3, 5.',
    hint: 'Keep track of two consecutive Fibonacci numbers in RAM. Each iteration: output current, compute next = a + b, shift: a = b, b = next.',
    expectedOutput: [1, 1, 2, 3, 5],
    checkOutput: (outputs) => {
      if (outputs.length < 5) return false;
      const first5 = outputs.slice(0, 5);
      return first5.join(',') === '1,1,2,3,5';
    },
  },
  {
    id: 'ch8',
    title: 'Bit Mask',
    difficulty: 'Intermediate',
    description: 'Load 0xFF (255). AND it with 0x0F to extract the lower nibble. Output the result (15).',
    hint: 'Store 0x0F in memory. Use LDI 0xFF, then AND with the memory location, then OUT.',
    expectedOutput: [15],
    checkOutput: (outputs) => outputs.length > 0 && outputs[outputs.length - 1] === 15,
  },
];

// ─────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────

function initApp() {
  App.cpu       = new CPU();
  App.assembler = new Assembler(INSTRUCTIONS);
  App.challenges = CHALLENGES;

  updateProgramSelector();
  loadProgram('Hello Output');

  bindControls();
  buildRegistersGrid();
  buildMemoryEditorGrid();
  buildChallengesList();
  buildMicrocodeEditor();
  buildPipelineView();

  const initialState = App.cpu.captureState('Ready. Press Step or Run.');
  App.lastState = initialState;
  updateFullDisplay(initialState);

  // Editor change
  document.getElementById('editor').addEventListener('input', () => {
    const el = document.getElementById('assemble-status');
    if (el) { el.className = ''; el.textContent = ''; }
  });

  // Speed slider
  document.getElementById('speed-slider').addEventListener('input', (e) => {
    App.runSpeed = parseInt(e.target.value);
    document.getElementById('speed-label').textContent = App.runSpeed + 'ms';
    if (App.runInterval) { clearInterval(App.runInterval); startRunLoop(); }
  });

  // Input register field
  document.getElementById('input-register').addEventListener('input', (e) => {
    const val = parseInt(e.target.value) || 0;
    App.cpu.setInput(Math.max(0, Math.min(255, val)));
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    switch (e.key) {
      case ' ':       e.preventDefault(); App.runInterval ? doPause() : doRun(); break;
      case 'ArrowRight':
      case 's':       e.preventDefault(); doStep(); break;
      case 'i':       e.preventDefault(); doStepInstruction(); break;
      case 'r':       e.preventDefault(); doReset(); break;
    }
  });
}

// ─────────────────────────────────────────
//  CONTROLS BINDING
// ─────────────────────────────────────────

function bindControls() {
  document.getElementById('btn-step').addEventListener('click', doStep);
  document.getElementById('btn-step-instr').addEventListener('click', doStepInstruction);
  document.getElementById('btn-run').addEventListener('click', doRun);
  document.getElementById('btn-pause').addEventListener('click', doPause);
  document.getElementById('btn-reset').addEventListener('click', doReset);
  document.getElementById('btn-assemble').addEventListener('click', doAssemble);
  document.getElementById('btn-assemble-run').addEventListener('click', doAssembleAndRun);
  document.getElementById('btn-interrupt').addEventListener('click', doInterrupt);
  document.getElementById('btn-clear-output').addEventListener('click', () => {
    App.outputHistory = [];
    renderOutputHistory();
  });
  document.getElementById('btn-clear-history').addEventListener('click', () => {
    App.execHistory = [];
    renderHistoryList();
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + target).classList.add('active');
      if (target === 'pipeline') drawPipelineCanvas();
      if (target === 'microcode') buildMicrocodeEditor();
    });
  });

  // Program select
  document.getElementById('program-select').addEventListener('change', (e) => {
    if (e.target.value) loadProgram(e.target.value);
  });
}

// ─────────────────────────────────────────
//  ACTIONS
// ─────────────────────────────────────────

function doStep() {
  stopRunLoop();
  const state = App.cpu.step();
  _afterStep([state]);
  updateFullDisplay(state);
}

function doStepInstruction() {
  stopRunLoop();
  const states = App.cpu.stepInstruction();
  _afterStep(states);
  updateFullDisplay(states[states.length - 1]);
}

function doRun() {
  if (App.cpu.halted) return;
  document.getElementById('btn-run').classList.add('active');
  document.getElementById('btn-pause').classList.remove('hidden');
  startRunLoop();
}

function startRunLoop() {
  stopRunLoop();
  App.runInterval = setInterval(() => {
    if (App.cpu.halted) { stopRunLoop(); return; }
    // Check breakpoint
    if (App.cpu.tState === 0 && App.cpu.breakpoints.has(App.cpu.PC)) {
      stopRunLoop();
      const st = App.cpu.captureState(`BREAKPOINT at 0x${toHex2(App.cpu.PC)}`);
      updateFullDisplay(st);
      return;
    }
    const state = App.cpu.step();
    _afterStep([state]);
    updateFullDisplay(state);
  }, App.runSpeed);
}

function doPause() {
  stopRunLoop();
}

function stopRunLoop() {
  if (App.runInterval) { clearInterval(App.runInterval); App.runInterval = null; }
  document.getElementById('btn-run').classList.remove('active');
  document.getElementById('btn-pause').classList.add('hidden');
}

function doReset() {
  stopRunLoop();
  const prevRAM = Array.from(App.cpu.RAM);
  const prevBP  = new Set(App.cpu.breakpoints);
  App.cpu.reset();
  prevRAM.forEach((v, i) => (App.cpu.RAM[i] = v));
  prevBP.forEach(bp => App.cpu.breakpoints.add(bp));
  App.clockWaveform  = [];
  App.outputHistory  = [];
  App.pipelineRows   = [];
  const state = App.cpu.captureState('Reset. Program preserved.');
  App.lastState = state;
  updateFullDisplay(state);
  renderOutputHistory();
  checkChallengeOnOutput();
}

function doInterrupt() {
  if (App.cpu.halted) return;
  App.cpu.triggerInterrupt();
  const hint = document.getElementById('instr-panel-hint');
  if (hint) hint.textContent = '— Interrupt triggered! CPU will save state and jump to 0xF0';
}

function doAssemble() {
  stopRunLoop();
  const source = document.getElementById('editor').value;
  const bytes  = App.assembler.assemble(source);
  const statusEl = document.getElementById('assemble-status');

  if (App.assembler.errors.length) {
    statusEl.className = 'assemble-status status-error';
    statusEl.textContent = 'Error: ' + App.assembler.errors.join('\n');
    return;
  }
  if (bytes) {
    App.cpu.reset();
    App.cpu.loadProgram(bytes);
    App.clockWaveform = [];
    App.outputHistory = [];
    App.pipelineRows  = [];
    statusEl.className = 'assemble-status status-ok';
    const cnt = App.assembler.listing.length;
    statusEl.textContent = `Assembled OK — ${cnt} statement(s), ${bytes.filter(b=>b).length} non-zero bytes`;
    if (App.assembler.warnings.length) {
      statusEl.textContent += '\nWarnings: ' + App.assembler.warnings.join('; ');
    }
    const state = App.cpu.captureState('Program loaded. Ready.');
    App.lastState = state;
    updateFullDisplay(state);
    renderAssemblyListing();
  }
}

function doAssembleAndRun() {
  doAssemble();
  if (!App.assembler.errors.length) doRun();
}

function _afterStep(states) {
  for (const s of states) {
    App.clockWaveform.push(1);
    if (App.clockWaveform.length > App.waveformMax) App.clockWaveform.shift();
    if (s.controlWord & CS.OI) {
      App.outputHistory.push({ value: s.OUT, cycle: s.clockCycles });
      if (App.outputHistory.length > App.maxOutputHistory) App.outputHistory.shift();
      checkChallengeOnOutput();
    }
    // Pipeline tracking
    if (s.tState === 0 || s.tState === 1 || s.tState >= 2) {
      _trackPipeline(s);
    }
  }
  App.lastState = states[states.length - 1];
  // Exec history
  App.execHistory.push(App.lastState);
  if (App.execHistory.length > App.maxExecHistory) App.execHistory.shift();
}

function _trackPipeline(state) {
  const t = state.tState;
  if (t === 0) {
    // New instruction starting — add a pipeline row
    App.pipelineRows.push({
      instrName: state.instrName,
      pc: state.PC,
      cycle: state.clockCycles,
      stages: ['IF', null, null],
    });
    if (App.pipelineRows.length > App.maxPipelineRows) App.pipelineRows.shift();
  } else if (t === 1 && App.pipelineRows.length > 0) {
    const row = App.pipelineRows[App.pipelineRows.length - 1];
    row.stages[1] = 'ID';
  } else if (t >= 2 && App.pipelineRows.length > 0) {
    const row = App.pipelineRows[App.pipelineRows.length - 1];
    row.stages[2] = 'EX';
  }
}

// ─────────────────────────────────────────
//  PROGRAM LOADER
// ─────────────────────────────────────────

function updateProgramSelector() {
  const sel = document.getElementById('program-select');
  sel.innerHTML = '<option value="">-- Choose Example --</option>';
  for (const name of Object.keys(EXAMPLE_PROGRAMS)) {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  }
}

function loadProgram(name) {
  const prog = EXAMPLE_PROGRAMS[name];
  if (!prog) return;
  document.getElementById('editor').value = prog.source;
  document.getElementById('program-description').textContent = prog.description;
  document.getElementById('program-select').value = name;
  doAssemble();
}

// ─────────────────────────────────────────
//  FULL DISPLAY UPDATE
// ─────────────────────────────────────────

function updateFullDisplay(state) {
  renderRegisters(state);
  renderBuses(state);
  renderControlSignals(state);
  renderMemoryGrid(state);
  renderClock(state);
  renderInstructionInfo(state);
  renderOutputHistory();
  renderCPUDiagram(state);
  triggerBusFlowAnimation(state);
  // Update history tab if visible
  if (document.getElementById('tab-history').classList.contains('active')) {
    renderHistoryList();
  }
}

// ─────────────────────────────────────────
//  REGISTERS GRID  (build once, then update)
// ─────────────────────────────────────────

const REG_DEFS = [
  { id: 'reg-PC',  label: 'PC',  key: 'PC',  bits: 8, color: '#1c4587' },
  { id: 'reg-MAR', label: 'MAR', key: 'MAR', bits: 8, color: '#1a4721' },
  { id: 'reg-SP',  label: 'SP',  key: 'SP',  bits: 8, color: '#3d1c5c' },
  { id: 'reg-IR',  label: 'IR',  key: 'IR',  bits: 8, color: '#4a1942', special: 'ir' },
  { id: 'reg-A',   label: 'A',   key: 'A',   bits: 8, color: '#1a3a5c' },
  { id: 'reg-B',   label: 'B',   key: 'B',   bits: 8, color: '#1e3a1e' },
  { id: 'reg-ALU', label: 'ALU', key: 'ALU', bits: 8, color: '#4a2800', special: 'alu' },
  { id: 'reg-OUT', label: 'OUT', key: 'OUT', bits: 8, color: '#3d1c00', special: 'out' },
];

function buildRegistersGrid() {
  const grid = document.getElementById('registers-grid');
  if (!grid) return;
  grid.innerHTML = REG_DEFS.map(r => `
    <div class="register-card" id="${r.id}" style="border-left:3px solid ${r.color}">
      <div class="reg-label">${r.label}</div>
      <div class="reg-value-row">
        <span class="reg-binary" id="${r.id}-bin">--------</span>
      </div>
      <div class="reg-triline">
        <span class="reg-hex"  id="${r.id}-hex">0x--</span>
        <span class="reg-dec"  id="${r.id}-dec">---</span>
        <span class="reg-bin2" id="${r.id}-bin2">--------</span>
      </div>
    </div>
  `).join('');
}

function renderRegisters(state) {
  for (const r of REG_DEFS) {
    const val = state[r.key];
    if (val === undefined) continue;
    const card = document.getElementById(r.id);
    if (!card) continue;

    // Flash on change
    if (App.lastState && App.lastState[r.key] !== val) {
      card.classList.remove('changed');
      void card.offsetWidth;
      card.classList.add('changed');
    }

    if (r.special === 'ir') {
      // IR: split opcode | operand display
      const instr = OPCODE_TABLE[val & 0xFF];
      const name  = instr ? instr.mnemonic : '???';
      const binEl = document.getElementById(`${r.id}-bin`);
      if (binEl) binEl.innerHTML = `
        <span class="ir-opcode" title="Opcode: ${name}">${formatBinary(toBin8(val))}</span>
      `;
      const hexEl = document.getElementById(`${r.id}-hex`);
      if (hexEl) hexEl.innerHTML =
        `<span class="ir-mnemonic">${name}</span>`;
      const decEl = document.getElementById(`${r.id}-dec`);
      if (decEl) decEl.textContent = `0x${toHex2(val)}`;
      const bin2El = document.getElementById(`${r.id}-bin2`);
      if (bin2El) bin2El.textContent = toBin8(val);
    } else if (r.special === 'out') {
      const binEl = document.getElementById(`${r.id}-bin`);
      if (binEl) binEl.innerHTML = `<span class="out-value">${val}</span>`;
      const hexEl = document.getElementById(`${r.id}-hex`);
      if (hexEl) hexEl.textContent = `0x${toHex2(val)}`;
      const decEl = document.getElementById(`${r.id}-dec`);
      if (decEl) decEl.textContent = val;
      const bin2El = document.getElementById(`${r.id}-bin2`);
      if (bin2El) bin2El.innerHTML = formatBinary(toBin8(val));
    } else {
      const binEl = document.getElementById(`${r.id}-bin`);
      if (binEl) binEl.innerHTML = formatBinary(toBin8(val));
      const hexEl = document.getElementById(`${r.id}-hex`);
      if (hexEl) hexEl.textContent = `0x${toHex2(val)}`;
      const decEl = document.getElementById(`${r.id}-dec`);
      if (decEl) decEl.textContent = val;
      const bin2El = document.getElementById(`${r.id}-bin2`);
      if (bin2El) bin2El.textContent = toBin8(val);
    }
  }

  // Flags
  ['CF', 'ZF'].forEach(f => {
    const el = document.getElementById('flag-' + f);
    if (!el) return;
    el.className = 'flag-bit' + (state[f] ? ' flag-set' : '');
    el.textContent = state[f] ? '1' : '0';
  });

  // SP in header
  const spH = document.getElementById('header-sp');
  if (spH) spH.textContent = toHex2(state.SP);
}

function formatBinary(binStr) {
  return binStr.split('').map((b, i) => {
    const nibble = Math.floor(i / 4);
    const cls    = b === '1' ? 'bit-high' : 'bit-low';
    const space  = (i === 4) ? ' style="margin-left:4px"' : '';
    return `<span class="${cls}"${space}>${b}</span>`;
  }).join('');
}

// ─────────────────────────────────────────
//  BUSES
// ─────────────────────────────────────────

function renderBuses(state) {
  const addrEl = document.getElementById('bus-address');
  if (addrEl) {
    const active = state.busDriver !== 'none';
    addrEl.innerHTML = `
      <div class="bus-label">Address Bus <span class="bus-width">(8-bit)</span></div>
      <div class="bus-bits">${formatBinary(toBin8(state.addressBus))}</div>
      <div class="bus-meta">0x${toHex2(state.addressBus)} = ${state.addressBus}</div>
    `;
  }

  const dataEl = document.getElementById('bus-data');
  if (dataEl) {
    const contention = state.busContention
      ? '<span class="contention-warning"> BUS CONTENTION!</span>' : '';
    dataEl.innerHTML = `
      <div class="bus-label">Data Bus <span class="bus-width">(8-bit)</span>${contention}</div>
      <div class="bus-bits ${state.busDriver !== 'none' ? 'bus-bits-active' : ''}">${formatBinary(toBin8(state.dataBus))}</div>
      <div class="bus-meta">0x${toHex2(state.dataBus)} = ${state.dataBus} &nbsp;|&nbsp; Driver: <strong>${state.busDriver}</strong></div>
    `;
    dataEl.classList.toggle('bus-active', state.busDriver !== 'none');
    dataEl.classList.toggle('bus-contention', state.busContention);
  }
}

// ─────────────────────────────────────────
//  CONTROL SIGNALS
// ─────────────────────────────────────────

function renderControlSignals(state) {
  const container = document.getElementById('control-signals');
  if (!container) return;
  const signals = getAllSignals(state.controlWord);
  container.innerHTML = signals.map(sig => `
    <div class="signal-chip ${sig.active ? 'signal-active' : 'signal-inactive'}"
         title="${getSignalDescription(sig.name)}">
      <span class="signal-name">${sig.name}</span>
      <span class="signal-val">${sig.active ? '1' : '0'}</span>
    </div>
  `).join('');
}

function getSignalDescription(name) {
  const d = {
    HLT:'Halt clock', MI:'MAR In — addr from bus', RI:'RAM In — write bus→RAM[MAR]',
    RO:'RAM Out — RAM[MAR]→bus', II:'IR In — load IR', AI:'A In', AO:'A Out',
    BI:'B In', BO:'B Out', EO:'ALU Out', SU:'ALU Subtract',
    ANDI:'ALU AND', ORI:'ALU OR', XORI:'ALU XOR', SHLI:'ALU Shift Left', SHRI:'ALU Shift Right',
    OI:'Output In', CE:'PC Increment', CO:'PC Out→address bus', J:'Jump (load PC)',
    FI:'Flags In — update CF/ZF', SPO:'SP Out→address bus', SPI:'SP In',
    SPD:'SP Decrement (SP--)', SPUP:'SP Increment (SP++)', INO:'Input Out→bus', PCI:'PC In',
  };
  return d[name] || name;
}

// ─────────────────────────────────────────
//  MEMORY GRID (256 bytes hex dump)
// ─────────────────────────────────────────

function buildMemoryEditorGrid() {
  const container = document.getElementById('memory-grid');
  if (!container) return;
  container.innerHTML = '';

  // 16 rows of 16 bytes each
  // Header row
  const hdr = document.createElement('div');
  hdr.className = 'mem-hex-dump-header';
  hdr.innerHTML = '<span>Addr</span>' +
    Array.from({length: 16}, (_, i) => `<span>+${i.toString(16).toUpperCase()}</span>`).join('') +
    '<span>Decoded</span>';
  container.appendChild(hdr);

  for (let row = 0; row < 16; row++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'mem-dump-row';
    rowEl.id = `mem-drow-${row}`;

    const base = row * 16;
    let inner = `<span class="mem-dump-addr" id="mem-row-addr-${row}">${toHex2(base)}</span>`;

    for (let col = 0; col < 16; col++) {
      const addr = base + col;
      inner += `<span class="mem-cell" id="mem-cell-${addr}"
        data-addr="${addr}" title="RAM[0x${toHex2(addr)}] — click to toggle breakpoint">00</span>`;
    }

    // ASCII-like decoded column
    inner += `<span class="mem-dump-ascii" id="mem-ascii-${row}"></span>`;
    rowEl.innerHTML = inner;
    container.appendChild(rowEl);
  }

  // Click handler for breakpoints
  container.addEventListener('click', (e) => {
    const cell = e.target.closest('.mem-cell');
    if (!cell) return;
    const addr = parseInt(cell.dataset.addr);
    App.cpu.toggleBreakpoint(addr);
    cell.classList.toggle('mem-breakpoint', App.cpu.breakpoints.has(addr));
    const st = App.cpu.captureState(
      App.cpu.breakpoints.has(addr)
        ? `Breakpoint SET at 0x${toHex2(addr)}`
        : `Breakpoint CLEARED at 0x${toHex2(addr)}`
    );
    updateFullDisplay(st);
  });

  // Double-click to edit a cell
  container.addEventListener('dblclick', (e) => {
    const cell = e.target.closest('.mem-cell');
    if (!cell) return;
    const addr = parseInt(cell.dataset.addr);
    const cur  = App.cpu.RAM[addr];
    const inp  = prompt(`Edit RAM[0x${toHex2(addr)}] (hex, e.g. 5E):`, toHex2(cur));
    if (inp !== null) {
      const val = parseInt(inp, 16);
      if (!isNaN(val)) {
        App.cpu.writeRAM(addr, val);
        const st = App.cpu.captureState(`Manual: RAM[0x${toHex2(addr)}] = 0x${toHex2(val)}`);
        updateFullDisplay(st);
      }
    }
  });
}

function renderMemoryGrid(state) {
  const pcRow  = Math.floor(state.PC  / 16);
  const marRow = Math.floor(state.MAR / 16);
  const spRow  = Math.floor(state.SP  / 16);

  for (let addr = 0; addr < 256; addr++) {
    const cell = document.getElementById(`mem-cell-${addr}`);
    if (!cell) continue;
    const val = state.RAM[addr];
    cell.textContent = toHex2(val);

    // Highlight classes
    cell.className = 'mem-cell';
    if (addr === state.PC)  cell.classList.add('mem-cell-pc');
    if (addr === state.MAR) cell.classList.add('mem-cell-mar');
    if (addr === state.SP)  cell.classList.add('mem-cell-sp');
    if (App.cpu.breakpoints.has(addr)) cell.classList.add('mem-breakpoint');

    // Instruction cells get a subtle tint
    const instr = OPCODE_TABLE[val];
    if (instr) cell.classList.add('mem-cell-instr');
  }

  // ASCII column
  for (let row = 0; row < 16; row++) {
    const base = row * 16;
    let ascii = '';
    for (let col = 0; col < 16; col++) {
      const v = state.RAM[base + col];
      ascii += (v >= 32 && v < 127) ? String.fromCharCode(v) : '.';
    }
    const el = document.getElementById(`mem-ascii-${row}`);
    if (el) el.textContent = ascii;
  }
}

// ─────────────────────────────────────────
//  CLOCK / WAVEFORM
// ─────────────────────────────────────────

function renderClock(state) {
  document.getElementById('clock-cycles').textContent = state.clockCycles;
  document.getElementById('instr-count').textContent  = state.instrCount;
  document.getElementById('t-state').textContent      = 'T' + state.tState;
  const ind = document.getElementById('halted-indicator');
  if (ind) {
    if (state.halted) {
      ind.textContent = 'HALTED'; ind.className = 'stat-value halted';
    } else if (state.inInterrupt) {
      ind.textContent = 'INT'; ind.className = 'stat-value interrupted';
    } else if (App.runInterval) {
      ind.textContent = 'RUNNING'; ind.className = 'stat-value running';
    } else {
      ind.textContent = 'PAUSED'; ind.className = 'stat-value paused';
    }
  }
  drawWaveform(state);
}

function drawWaveform(state) {
  const canvas = document.getElementById('waveform-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W   = canvas.width;
  const H   = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background grid
  ctx.strokeStyle = '#1a2030';
  ctx.lineWidth   = 1;
  for (let x = 0; x < W; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }

  const n = App.clockWaveform.length;
  if (n === 0) {
    ctx.fillStyle = '#444';
    ctx.font = '11px monospace';
    ctx.fillText('CLK waveform...', 8, H / 2 + 4);
    return;
  }

  const stepW = W / App.waveformMax;
  const high  = 6;
  const low   = H - 6;

  // Draw waveform
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth   = 2;
  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur  = 4;
  ctx.beginPath();

  let x = W - n * stepW;
  ctx.moveTo(x, low);
  for (let i = 0; i < n; i++) {
    // Rising edge
    ctx.lineTo(x, low);
    ctx.lineTo(x, high);
    ctx.lineTo(x + stepW * 0.45, high);
    // Falling edge
    ctx.lineTo(x + stepW * 0.45, low);
    ctx.lineTo(x + stepW, low);
    x += stepW;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Current position marker
  const curX = W - stepW * 0.5;
  ctx.strokeStyle = '#ffaa00';
  ctx.lineWidth   = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(curX, 0);
  ctx.lineTo(curX, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // T-state label
  ctx.fillStyle = '#ffaa00';
  ctx.font      = '10px monospace';
  ctx.fillText(`T${state ? state.tState : '?'}`, curX - 8, H - 2);

  // CLK label
  ctx.fillStyle = '#555';
  ctx.font      = '10px monospace';
  ctx.fillText('CLK', 2, 14);
}

// ─────────────────────────────────────────
//  CPU DIAGRAM
// ─────────────────────────────────────────

function renderCPUDiagram(state) {
  const el = document.getElementById('cpu-diagram');
  if (!el) return;
  const cw = state.controlWord;

  const a = (f) => f ? 'active' : '';
  const flow = (f) => f ? 'flow' : '';

  const pcDriving   = !!(cw & CS.CO);
  const ramDriving  = !!(cw & CS.RO);
  const aDriving    = !!(cw & CS.AO);
  const bDriving    = !!(cw & CS.BO);
  const aluDriving  = !!(cw & CS.EO);
  const inDriving   = !!(cw & CS.INO);
  const spDriving   = !!(cw & CS.SPO);
  const marLoading  = !!(cw & CS.MI);
  const irLoading   = !!(cw & CS.II);
  const aLoading    = !!(cw & CS.AI);
  const bLoading    = !!(cw & CS.BI);
  const outLoading  = !!(cw & CS.OI);
  const ramWriting  = !!(cw & CS.RI);
  const jumping     = !!(cw & CS.J);
  const pcInc       = !!(cw & CS.CE);
  const flagsLoad   = !!(cw & CS.FI);
  const spDec       = !!(cw & CS.SPD);
  const spUp        = !!(cw & CS.SPUP);

  const aluMode = (cw & CS.SU)   ? 'SUB'
    : (cw & CS.ANDI)  ? 'AND'
    : (cw & CS.ORI)   ? 'OR'
    : (cw & CS.XORI)  ? 'XOR'
    : (cw & CS.SHLI)  ? 'SHL'
    : (cw & CS.SHRI)  ? 'SHR'
    : 'ADD';

  const busActive = state.busDriver !== 'none';

  el.innerHTML = `
<div class="diagram-wrap">

  <!-- ROW 1: PC → MAR → RAM -->
  <div class="diagram-row">

    <div class="diagram-component ${a(pcDriving || pcInc || jumping)} comp-pc">
      <div class="comp-title">PROGRAM COUNTER</div>
      <div class="comp-value">${toBin8(state.PC)}</div>
      <div class="comp-meta">PC = 0x${toHex2(state.PC)} = ${state.PC}</div>
      <div class="comp-sigs">
        ${pcDriving ? '<span class="sig-tag out-tag">CO</span>' : ''}
        ${pcInc     ? '<span class="sig-tag">CE</span>' : ''}
        ${jumping   ? '<span class="sig-tag in-tag">J</span>' : ''}
      </div>
    </div>

    <div class="diagram-arrow ${flow(pcDriving)}" title="PC drives address bus on CO">→</div>

    <div class="diagram-component ${a(marLoading)} comp-mar">
      <div class="comp-title">MAR</div>
      <div class="comp-value">${toBin8(state.MAR)}</div>
      <div class="comp-meta">0x${toHex2(state.MAR)}</div>
      ${marLoading ? '<span class="sig-tag in-tag">MI</span>' : ''}
    </div>

    <div class="diagram-arrow ${flow(ramDriving || ramWriting)}" title="MAR addresses RAM">⇔</div>

    <div class="diagram-component ${a(ramDriving || ramWriting)} comp-ram">
      <div class="comp-title">RAM <span class="comp-subtitle">(256×8)</span></div>
      <div class="comp-value">${toHex2(state.RAM[state.MAR])}h</div>
      <div class="comp-meta">RAM[0x${toHex2(state.MAR)}]=${state.RAM[state.MAR]}</div>
      <div class="comp-sigs">
        ${ramDriving ? '<span class="sig-tag out-tag">RO</span>' : ''}
        ${ramWriting ? '<span class="sig-tag in-tag">RI</span>' : ''}
      </div>
    </div>

    <div class="diagram-spacer"></div>

    <div class="diagram-component ${a(spDec || spUp || spDriving)} comp-sp">
      <div class="comp-title">STACK PTR</div>
      <div class="comp-value">${toBin8(state.SP)}</div>
      <div class="comp-meta">SP = 0x${toHex2(state.SP)}</div>
      <div class="comp-sigs">
        ${spDriving ? '<span class="sig-tag out-tag">SPO</span>' : ''}
        ${spDec     ? '<span class="sig-tag">SPD</span>' : ''}
        ${spUp      ? '<span class="sig-tag">SPUP</span>' : ''}
      </div>
    </div>

  </div>

  <!-- ADDRESS BUS -->
  <div class="diagram-bus-row">
    <div class="diagram-bus addr-bus ${pcDriving || spDriving ? 'bus-active' : ''}">
      <span class="bus-label-diag">ADDR BUS</span>
      <span class="bus-value-diag">${formatBinary(toBin8(state.addressBus))}</span>
      <span class="bus-hex-diag">0x${toHex2(state.addressBus)}</span>
    </div>
  </div>

  <!-- DATA BUS -->
  <div class="diagram-bus-row">
    <div class="diagram-bus data-bus ${busActive ? 'bus-active' : ''} ${state.busContention ? 'bus-contention' : ''}">
      <span class="bus-label-diag">DATA BUS</span>
      <span class="bus-value-diag">${formatBinary(toBin8(state.dataBus))}</span>
      <span class="bus-hex-diag">${state.busDriver !== 'none' ? `0x${toHex2(state.dataBus)} ← ${state.busDriver}` : 'idle'}</span>
    </div>
  </div>

  <!-- ROW 2: IR | A | B | ALU | FLAGS | OUT -->
  <div class="diagram-row">

    <div class="diagram-component ${a(irLoading)} comp-ir">
      <div class="comp-title">INSTR REG (IR)</div>
      <div class="comp-value ir-split-diag">
        <span class="ir-op-nibble"  title="Opcode">${toBin8(state.IR & 0xFF).slice(0,4)}</span>
        <span class="ir-nibble-sep">.</span>
        <span class="ir-operand-nibble" title="Operand">${toBin8(state.IR & 0xFF).slice(4)}</span>
      </div>
      <div class="comp-meta"><span class="ir-mnemonic-diag">${state.instrName}</span> 0x${toHex2(state.IR)}</div>
      ${irLoading ? '<span class="sig-tag in-tag">II</span>' : ''}
    </div>

    <div class="diagram-component ${a(aLoading || aDriving)} comp-a">
      <div class="comp-title">A REGISTER</div>
      <div class="comp-value">${toBin8(state.A)}</div>
      <div class="comp-meta">0x${toHex2(state.A)} = ${state.A}</div>
      <div class="comp-sigs">
        ${aLoading ? '<span class="sig-tag in-tag">AI</span>'  : ''}
        ${aDriving ? '<span class="sig-tag out-tag">AO</span>' : ''}
      </div>
    </div>

    <div class="diagram-component ${a(bLoading || bDriving)} comp-b">
      <div class="comp-title">B REGISTER</div>
      <div class="comp-value">${toBin8(state.B)}</div>
      <div class="comp-meta">0x${toHex2(state.B)} = ${state.B}</div>
      <div class="comp-sigs">
        ${bLoading ? '<span class="sig-tag in-tag">BI</span>'  : ''}
        ${bDriving ? '<span class="sig-tag out-tag">BO</span>' : ''}
      </div>
    </div>

    <div class="diagram-component ${a(aluDriving)} comp-alu">
      <div class="comp-title">ALU <span class="comp-subtitle">${aluMode}</span></div>
      <div class="comp-value">${toBin8(state.ALU)}</div>
      <div class="comp-meta">= ${state.ALU} (0x${toHex2(state.ALU)})</div>
      <div class="comp-sigs">
        ${aluDriving ? '<span class="sig-tag out-tag">EO</span>' : ''}
        ${flagsLoad  ? '<span class="sig-tag">FI</span>'         : ''}
      </div>
    </div>

    <div class="diagram-component comp-flags">
      <div class="comp-title">FLAGS</div>
      <div class="flags-row">
        <div class="flag-diag ${state.CF ? 'flag-set' : ''}">CF<br>${state.CF}</div>
        <div class="flag-diag ${state.ZF ? 'flag-set' : ''}">ZF<br>${state.ZF}</div>
      </div>
    </div>

    <div class="diagram-component ${a(outLoading || inDriving)} comp-out">
      <div class="comp-title">OUTPUT</div>
      <div class="comp-value output-big">${state.OUT}</div>
      <div class="comp-meta">0x${toHex2(state.OUT)} | ${toBin8(state.OUT)}</div>
      ${outLoading ? '<span class="sig-tag in-tag">OI</span>'  : ''}
      ${inDriving  ? '<span class="sig-tag out-tag">INO</span>': ''}
    </div>

  </div>

  <!-- STATUS -->
  <div class="diagram-status">
    <span class="status-cycles">Cycle: <strong>${state.clockCycles}</strong></span>
    <span class="status-tstate">T: <strong>${state.tState}</strong></span>
    <span class="status-instr">Instr: <strong>${state.instrName}</strong></span>
    ${state.inInterrupt ? '<span class="status-int">IN INTERRUPT</span>' : ''}
    <span class="status-desc">${state.description || ''}</span>
  </div>

</div>`;
}

// ─────────────────────────────────────────
//  BUS FLOW ANIMATION
// ─────────────────────────────────────────

function triggerBusFlowAnimation(state) {
  if (!state || state.busDriver === 'none') return;
  const label = document.getElementById('bus-flow-label');
  if (label) {
    label.textContent = `${state.busDriver} → bus → ${getBusDestination(state.controlWord)}`;
    label.style.color = '#ffaa00';
    clearTimeout(App.busFlowTimer);
    App.busFlowTimer = setTimeout(() => {
      label.textContent = '';
    }, 800);
  }
}

function getBusDestination(cw) {
  const dests = [];
  if (cw & CS.MI)  dests.push('MAR');
  if (cw & CS.II)  dests.push('IR');
  if (cw & CS.AI)  dests.push('A');
  if (cw & CS.BI)  dests.push('B');
  if (cw & CS.OI)  dests.push('OUT');
  if (cw & CS.RI)  dests.push('RAM[MAR]');
  if (cw & CS.J)   dests.push('PC');
  return dests.join(', ') || 'bus idle';
}

// ─────────────────────────────────────────
//  INSTRUCTION INFO PANEL
// ─────────────────────────────────────────

function renderInstructionInfo(state) {
  const el = document.getElementById('instr-info');
  if (!el) return;

  const instrDef = OPCODE_TABLE[state.opcode];
  if (!instrDef) { el.innerHTML = '<span style="color:#555">No instruction</span>'; return; }

  // Pick correct microcode
  let microcode = instrDef.microcode;
  if (!microcode) {
    if (instrDef.name === 'JC' || instrDef.name === 'JNC') {
      microcode = state.CF ? (instrDef.microcode_cf1 || instrDef.microcode_zf0) : (instrDef.microcode_cf0 || instrDef.microcode_zf1);
    } else {
      microcode = state.ZF ? (instrDef.microcode_zf1 || instrDef.microcode_cf1) : (instrDef.microcode_zf0 || instrDef.microcode_cf0);
    }
  }
  if (!microcode) microcode = FETCH.concat([0]);

  const stepsHtml = microcode.map((cw, t) => {
    const active  = getActiveSignals(cw);
    const isCurr  = (t === state.tState);
    const phase   = t < 2 ? 'FETCH' : 'EXEC';
    return `<div class="micro-step ${isCurr ? 'micro-current' : ''}">
      <span class="micro-t">T${t}</span>
      <span class="micro-phase ${t < 2 ? 'phase-fetch' : 'phase-exec'}">${phase}</span>
      <span class="micro-signals">${active.length ? active.join(' | ') : 'NOP'}</span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="instr-left">
      <div class="instr-name">
        <span class="instr-mnemonic">${instrDef.mnemonic}</span>
        <span class="instr-opcode">0x${toHex2(instrDef.opcode)} · ${instrDef.bytes}B</span>
      </div>
      <div class="instr-desc">${instrDef.description}</div>
      <div class="instr-micro-title">Micro-steps:</div>
      <div class="instr-micro">${stepsHtml}</div>
    </div>
    <div class="instr-right">
      <div class="instr-narrative">${getNarrative(state)}</div>
    </div>
  `;
}

function getNarrative(state) {
  const t    = state.tState;
  const name = state.instrName;
  const cw   = state.controlWord;

  if (t === 0) return `<strong>T0 — FETCH Address:</strong> The Program Counter (PC=0x${toHex2(state.PC)}) drives the address bus. MAR latches this address. The CPU is saying: <em>"Look at memory location ${state.PC}."</em>`;
  if (t === 1) return `<strong>T1 — FETCH Data:</strong> RAM reads address 0x${toHex2(state.MAR)} and puts byte 0x${toHex2(state.IR)} on the data bus. IR captures it as opcode <strong>${name}</strong>. PC increments to ${state.PC}. <em>This is the instruction fetch — every single instruction starts with T0 and T1.</em>`;

  const narratives = {
    LDA: {
      2: `<strong>T2:</strong> CO+MI — PC drives address bus, MAR loads the <em>operand byte address</em>.`,
      3: `<strong>T3:</strong> RO+MI+CE — RAM puts the operand (target address=0x${toHex2(state.MAR)}) on bus, MAR loads it, PC advances past the operand byte.`,
      4: `<strong>T4:</strong> RO+AI — RAM[0x${toHex2(state.MAR)}]=${state.A} goes onto the bus, A register captures it. A is now loaded!`,
    },
    ADD: {
      2: `<strong>T2:</strong> Fetch operand byte (the source address).`,
      3: `<strong>T3:</strong> Source address → MAR. PC advances past operand.`,
      4: `<strong>T4:</strong> RO+BI — RAM[MAR]=${state.B} → B register. B holds the addend.`,
      5: `<strong>T5:</strong> EO+AI+FI — ALU computes A+B=${state.ALU}. Result → A. Flags updated: CF=${state.CF}, ZF=${state.ZF}.`,
    },
    SUB: {
      4: `<strong>T4:</strong> RO+BI — operand → B register.`,
      5: `<strong>T5:</strong> EO+AI+SU+FI — ALU computes A−B=${state.ALU}. SU signal enables subtraction mode. CF=${state.CF} (borrow indicator), ZF=${state.ZF}.`,
    },
    LDI: {
      2: `<strong>T2:</strong> CO+MI — fetch operand byte address.`,
      3: `<strong>T3:</strong> RO+AI+CE — RAM byte (the immediate value ${state.A}) goes directly into A. No address lookup needed!`,
    },
    STA: {
      4: `<strong>T4:</strong> AO+RI — A register (${state.A}) drives the bus, RI writes it to RAM[0x${toHex2(state.MAR)}]. Memory is being written! Watch the RI signal.`,
    },
    JMP: {
      3: `<strong>T3:</strong> RO+J — the address byte is loaded directly into PC. Next fetch comes from 0x${toHex2(state.PC)}. The J (Jump) signal bypasses the normal CE increment.`,
    },
    JC: {
      2: `<strong>T2:</strong> Fetch operand byte address.`,
      3: state.CF
        ? `<strong>T3 (TAKEN):</strong> CF=1, so RO+J loads the jump target into PC. Branch taken to 0x${toHex2(state.PC)}.`
        : `<strong>T3 (NOT TAKEN):</strong> CF=0, so we just do CE to skip the operand byte. Execution continues at 0x${toHex2(state.PC)}.`,
    },
    JZ: {
      3: state.ZF
        ? `<strong>T3 (TAKEN):</strong> ZF=1 — result was zero, branch taken to 0x${toHex2(state.PC)}.`
        : `<strong>T3 (NOT TAKEN):</strong> ZF=0 — result was non-zero, skip the operand and continue.`,
    },
    JNZ: {
      3: !state.ZF
        ? `<strong>T3 (TAKEN):</strong> ZF=0 — result non-zero, branch taken to 0x${toHex2(state.PC)}.`
        : `<strong>T3 (NOT TAKEN):</strong> ZF=1 — result was zero, no jump.`,
    },
    PUSH: {
      2: `<strong>T2:</strong> SPO+MI — Stack Pointer (0x${toHex2(state.SP)}) drives address bus, MAR loads SP value.`,
      3: `<strong>T3:</strong> AO+RI — A register (${state.A}) is written to RAM[SP]. The value is now on the stack.`,
      4: `<strong>T4:</strong> SPD — Stack Pointer decrements. SP is now 0x${toHex2(state.SP)}. Stack grows downward.`,
    },
    POP: {
      2: `<strong>T2:</strong> SPUP — SP increments first. SP = 0x${toHex2(state.SP)}.`,
      3: `<strong>T3:</strong> SPO+MI — SP value → address bus → MAR.`,
      4: `<strong>T4:</strong> RO+AI — RAM[SP] → A. The top of stack is now in A.`,
    },
    CALL: {
      2: `<strong>T2:</strong> Fetch operand byte (subroutine target address).`,
      3: `<strong>T3:</strong> RO+BI+CE — target address → B register. PC advances past operand (return address = ${state.PC}).`,
      4: `<strong>T4:</strong> SPO+MI — SP → MAR. Preparing to push return address.`,
      5: `<strong>T5:</strong> CO+RI — current PC (return addr = 0x${toHex2(state.PC)}) → RAM[SP]. Return address saved to stack.`,
      6: `<strong>T6:</strong> SPD — SP decremented. Stack pointer now = 0x${toHex2(state.SP)}.`,
      7: `<strong>T7:</strong> BO+J — target address from B → PC. CPU now jumps to subroutine.`,
    },
    RET: {
      2: `<strong>T2:</strong> SPUP — SP++ to pop. SP = 0x${toHex2(state.SP)}.`,
      3: `<strong>T3:</strong> SPO+MI — SP → MAR.`,
      4: `<strong>T4:</strong> RO+J — return address from RAM[SP] → PC. We're back in the calling code!`,
    },
    IN: {
      2: `<strong>T2:</strong> INO+AI — Input register (${state.INPUT}) drives the bus, A captures it. <em>This is like reading from a keyboard or sensor port.</em>`,
    },
    OUT: {
      2: `<strong>T2:</strong> AO+OI — A (${state.A}) drives the bus, OI loads it into the Output register. The display now shows ${state.A}. <em>Like writing to an LED segment display.</em>`,
    },
    HLT: {
      2: `<strong>T2 — HALT:</strong> HLT signal stops the clock. CPU is frozen with A=${state.A}. Press Reset to continue.`,
    },
    AND: {
      5: `<strong>T5:</strong> EO+AI+ANDI+FI — ALU computes A & B = ${state.A} & ${state.B} = ${state.ALU}. Bitwise AND: only bits set in BOTH inputs appear in output.`,
    },
    OR: {
      5: `<strong>T5:</strong> EO+AI+ORI+FI — ALU computes A | B = ${state.A} | ${state.B} = ${state.ALU}. Bitwise OR: bits set in EITHER input appear in output.`,
    },
    XOR: {
      5: `<strong>T5:</strong> EO+AI+XORI+FI — ALU computes A ^ B = ${state.A} ^ ${state.B} = ${state.ALU}. XOR: bits differ between inputs appear in output. XOR with 0xFF inverts!`,
    },
    SHL: {
      2: `<strong>T2:</strong> EO+AI+SHLI+FI — ALU shifts A left by 1. A was ${state.A}, now ${state.ALU}. The MSB shifts into CF = ${state.CF}. Shifting left = multiplying by 2!`,
    },
    SHR: {
      2: `<strong>T2:</strong> EO+AI+SHRI+FI — ALU shifts A right by 1. A was ${state.A}, now ${state.ALU}. The LSB shifts into CF = ${state.CF}. Shifting right = dividing by 2!`,
    },
    NOP: {
      2: `<strong>T2 — NOP:</strong> No signals active. The CPU simply advances to the next instruction. Useful for timing padding.`,
    },
    CMP: {
      5: `<strong>T5:</strong> EO+SU+FI — ALU computes A−B=${state.ALU} but does NOT update A (no AI signal). Only flags are updated: CF=${state.CF}, ZF=${state.ZF}. Use with JZ/JNZ/JC/JNC.`,
    },
    LDB: {
      3: `<strong>T3:</strong> RO+BI+CE — immediate value → B register directly. B = ${state.B}.`,
    },
  };

  const instr = narratives[name];
  if (instr && instr[t]) return instr[t];
  return `<strong>T${t} — ${name}:</strong> Control word: 0x${cw.toString(16).toUpperCase().padStart(8,'0')}. Active: ${getActiveSignals(cw).join(', ') || 'none'}.`;
}

// ─────────────────────────────────────────
//  OUTPUT HISTORY
// ─────────────────────────────────────────

function renderOutputHistory() {
  const el = document.getElementById('output-history');
  if (!el) return;
  if (App.outputHistory.length === 0) {
    el.innerHTML = '<div class="output-empty">No output yet. Run a program with OUT instructions.</div>';
    return;
  }
  el.innerHTML = App.outputHistory.map((item, i) => `
    <div class="output-entry">
      <span class="output-idx">#${i + 1}</span>
      <span class="output-dec">${item.value}</span>
      <span class="output-hex">0x${toHex2(item.value)}</span>
      <span class="output-bin">${formatBinary(toBin8(item.value))}</span>
      <span class="output-cycle">cy:${item.cycle}</span>
    </div>
  `).join('');
  el.scrollTop = el.scrollHeight;
}

// ─────────────────────────────────────────
//  ASSEMBLY LISTING
// ─────────────────────────────────────────

function renderAssemblyListing() {
  const el = document.getElementById('assembly-listing');
  if (!el) return;
  const listing = App.assembler.listing;
  if (!listing.length) {
    el.innerHTML = '<div class="listing-empty">Assemble a program first.</div>';
    return;
  }
  el.innerHTML = `
    <table class="listing-table">
      <thead><tr><th>Addr</th><th>Bytes</th><th>Source</th></tr></thead>
      <tbody>
        ${listing.map(item => `
          <tr id="listing-row-${item.addr}">
            <td class="listing-addr">0x${toHex2(item.addr)}</td>
            <td class="listing-hex">${(item.bytes||[item.byte]).map(b=>`<span>${toHex2(b)}</span>`).join(' ')}</td>
            <td class="listing-src">${escapeHtml(item.source)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

// ─────────────────────────────────────────
//  CHALLENGES
// ─────────────────────────────────────────

function buildChallengesList() {
  const el = document.getElementById('challenges-list');
  if (!el) return;
  el.innerHTML = CHALLENGES.map(ch => `
    <div class="challenge-card ${App.solvedChallenges.has(ch.id) ? 'solved' : ''}"
         id="chcard-${ch.id}" data-id="${ch.id}">
      <div class="ch-header">
        <span class="ch-title">${ch.title}</span>
        <span class="ch-diff diff-${ch.difficulty.toLowerCase()}">${ch.difficulty}</span>
        ${App.solvedChallenges.has(ch.id) ? '<span class="ch-solved">SOLVED</span>' : ''}
      </div>
      <div class="ch-desc">${ch.description}</div>
    </div>
  `).join('');

  el.querySelectorAll('.challenge-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      openChallenge(id);
    });
  });

  updateChallengeProgress();
}

function openChallenge(id) {
  const ch = CHALLENGES.find(c => c.id === id);
  if (!ch) return;
  App.currentChallenge = ch;

  document.getElementById('challenges-list').classList.add('hidden');
  const detail = document.getElementById('challenge-detail');
  detail.classList.remove('hidden');

  document.getElementById('challenge-title').textContent = ch.title;
  document.getElementById('challenge-desc').textContent  = ch.description;
  document.getElementById('challenge-expected').innerHTML =
    `<strong>Expected output:</strong> ${ch.expectedOutput.join(', ')}`;
  document.getElementById('challenge-result').classList.add('hidden');
  document.getElementById('challenge-hint').classList.add('hidden');

  document.getElementById('btn-close-challenge').onclick = () => {
    detail.classList.add('hidden');
    document.getElementById('challenges-list').classList.remove('hidden');
    App.currentChallenge = null;
  };

  document.getElementById('btn-check-challenge').onclick = () => {
    checkChallenge();
  };

  document.getElementById('btn-hint-challenge').onclick = () => {
    const hintEl = document.getElementById('challenge-hint');
    hintEl.textContent = ch.hint;
    hintEl.classList.remove('hidden');
  };
}

function checkChallenge() {
  if (!App.currentChallenge) return;
  const ch = App.currentChallenge;
  const outputs = App.outputHistory.map(o => o.value);
  const passed  = ch.checkOutput(outputs);

  const resultEl = document.getElementById('challenge-result');
  resultEl.classList.remove('hidden');

  if (passed) {
    resultEl.className = 'challenge-result challenge-pass';
    resultEl.innerHTML = `<strong>PASS!</strong> Correct output: ${outputs.slice(-ch.expectedOutput.length).join(', ')}`;
    App.solvedChallenges.add(ch.id);
    const card = document.getElementById(`chcard-${ch.id}`);
    if (card) card.classList.add('solved');
    updateChallengeProgress();
  } else {
    resultEl.className = 'challenge-result challenge-fail';
    resultEl.innerHTML = `<strong>Not yet.</strong> Your output: [${outputs.join(', ')}]. Expected: [${ch.expectedOutput.join(', ')}]`;
  }
}

function checkChallengeOnOutput() {
  // Auto-check running challenges
  if (!App.currentChallenge) return;
  // just do nothing automatically — user clicks Check Solution
}

function updateChallengeProgress() {
  const el = document.getElementById('challenge-progress');
  if (el) el.textContent = `${App.solvedChallenges.size} / ${CHALLENGES.length} solved`;
}

// ─────────────────────────────────────────
//  MICROCODE EDITOR
// ─────────────────────────────────────────

const ALL_SIGNALS = ['CO','MI','RO','RI','II','AI','AO','EO','SU','BI','BO','OI','CE','J','FI','SPO','SPD','SPUP','INO','ANDI','ORI','XORI','SHLI','SHRI','HLT'];

function buildMicrocodeEditor() {
  // Populate instruction selector
  const sel = document.getElementById('mc-instr-select');
  if (!sel) return;
  if (!sel.innerHTML.trim() || sel.innerHTML === '') {
    sel.innerHTML = Object.keys(INSTRUCTIONS).map(n =>
      `<option value="${n}">${n}</option>`
    ).join('');
    sel.addEventListener('change', renderMicrocodeGrid);
  }

  document.getElementById('btn-mc-reset').onclick = () => {
    const name = document.getElementById('mc-instr-select').value;
    if (App.editedMicrocode[name]) {
      delete App.editedMicrocode[name];
      renderMicrocodeGrid();
    }
  };

  document.getElementById('btn-mc-export').onclick = () => {
    const out = {};
    for (const [name, mc] of Object.entries(App.editedMicrocode)) {
      out[name] = mc.map(cw => '0x' + cw.toString(16).toUpperCase().padStart(8,'0'));
    }
    const json = JSON.stringify(out, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'microcode.json';
    a.click();
  };

  renderMicrocodeGrid();
}

function renderMicrocodeGrid() {
  const container = document.getElementById('microcode-editor');
  if (!container) return;
  const instrName = document.getElementById('mc-instr-select').value;
  const instrDef  = INSTRUCTIONS[instrName];
  if (!instrDef) return;

  // Get current microcode (edited or default)
  let mc = App.editedMicrocode[instrName];
  if (!mc) {
    const def = instrDef.microcode || instrDef.microcode_cf0 || instrDef.microcode_zf0 || FETCH.concat([0]);
    mc = [...def];
  }

  const signals = ALL_SIGNALS;
  let html = `
    <div class="mc-grid">
      <div class="mc-header-row">
        <span class="mc-tstate-col">T</span>
        ${signals.map(s => `<span class="mc-sig-col" title="${getSignalDescription(s)}">${s}</span>`).join('')}
        <span class="mc-actions-col">+/-</span>
      </div>
  `;

  mc.forEach((cw, t) => {
    const phase = t < 2 ? 'fetch' : 'exec';
    html += `<div class="mc-row mc-row-${phase}" data-t="${t}">
      <span class="mc-t">${t < 2 ? `T${t}(F)` : `T${t}`}</span>
      ${signals.map(s => {
        const bit   = CS[s] || 0;
        const active = !!(cw & bit);
        return `<button class="mc-cell ${active ? 'mc-cell-active' : ''}"
          data-t="${t}" data-sig="${s}" title="T${t}: toggle ${s}">${active ? '1' : '0'}</button>`;
      }).join('')}
      <span class="mc-del" data-t="${t}" title="Remove T-state">✕</span>
    </div>`;
  });

  html += `</div>
    <button class="btn btn-tiny" id="btn-mc-addrow">+ Add T-state</button>
  `;
  container.innerHTML = html;

  // Wire up cell toggles
  container.querySelectorAll('.mc-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const t   = parseInt(cell.dataset.t);
      const sig = cell.dataset.sig;
      const bit = CS[sig] || 0;
      const cur = App.editedMicrocode[instrName] || [...(instrDef.microcode || instrDef.microcode_cf0 || instrDef.microcode_zf0 || FETCH.concat([0]))];
      cur[t] ^= bit;
      App.editedMicrocode[instrName] = cur;
      // Apply to live CPU instruction
      _applyMicrocodeEdit(instrName, cur);
      renderMicrocodeGrid();
    });
  });

  // Delete row
  container.querySelectorAll('.mc-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const t   = parseInt(btn.dataset.t);
      const cur = App.editedMicrocode[instrName] || [...(instrDef.microcode || instrDef.microcode_cf0 || FETCH.concat([0]))];
      if (cur.length <= 2) return; // keep at least fetch cycle
      cur.splice(t, 1);
      App.editedMicrocode[instrName] = cur;
      _applyMicrocodeEdit(instrName, cur);
      renderMicrocodeGrid();
    });
  });

  // Add row
  const addBtn = document.getElementById('btn-mc-addrow');
  if (addBtn) addBtn.addEventListener('click', () => {
    const cur = App.editedMicrocode[instrName] || [...(instrDef.microcode || instrDef.microcode_cf0 || FETCH.concat([0]))];
    cur.push(0);
    App.editedMicrocode[instrName] = cur;
    _applyMicrocodeEdit(instrName, cur);
    renderMicrocodeGrid();
  });
}

function _applyMicrocodeEdit(instrName, newMc) {
  // Patch INSTRUCTIONS live
  if (INSTRUCTIONS[instrName]) {
    if (INSTRUCTIONS[instrName].microcode) {
      INSTRUCTIONS[instrName].microcode = newMc;
    } else if (INSTRUCTIONS[instrName].microcode_cf0) {
      // For conditional jumps, apply to both variants (simplified)
      INSTRUCTIONS[instrName].microcode_cf0 = newMc;
      INSTRUCTIONS[instrName].microcode_cf1 = newMc;
    } else if (INSTRUCTIONS[instrName].microcode_zf0) {
      INSTRUCTIONS[instrName].microcode_zf0 = newMc;
      INSTRUCTIONS[instrName].microcode_zf1 = newMc;
    }
    // Rebuild opcode table entry
    OPCODE_TABLE[INSTRUCTIONS[instrName].opcode] = { name: instrName, ...INSTRUCTIONS[instrName] };
  }
}

// ─────────────────────────────────────────
//  EXECUTION HISTORY
// ─────────────────────────────────────────

function renderHistoryList() {
  const el = document.getElementById('history-list');
  if (!el) return;
  if (App.execHistory.length === 0) {
    el.innerHTML = '<div class="history-empty">No history yet. Step through instructions to record states.</div>';
    return;
  }
  el.innerHTML = App.execHistory.map((s, i) => `
    <div class="history-entry ${i === App.selectedHistoryIdx ? 'history-selected' : ''}"
         data-idx="${i}">
      <span class="hist-cycle">cy${s.clockCycles}</span>
      <span class="hist-t">T${s.tState}</span>
      <span class="hist-instr">${s.instrName}</span>
      <span class="hist-pc">PC:${toHex2(s.PC)}</span>
      <span class="hist-a">A:${toHex2(s.A)}</span>
      <span class="hist-flags">${s.CF?'C':'·'}${s.ZF?'Z':'·'}</span>
      <span class="hist-desc">${s.description.slice(0,40)}</span>
    </div>
  `).join('');

  el.querySelectorAll('.history-entry').forEach(entry => {
    entry.addEventListener('click', () => {
      const idx = parseInt(entry.dataset.idx);
      App.selectedHistoryIdx = idx;
      showHistoryDetail(App.execHistory[idx]);
      // Re-render to highlight
      el.querySelectorAll('.history-entry').forEach(e => e.classList.remove('history-selected'));
      entry.classList.add('history-selected');
    });
  });

  if (App.selectedHistoryIdx < 0 || App.selectedHistoryIdx >= App.execHistory.length) {
    el.scrollTop = el.scrollHeight;
  }
}

function showHistoryDetail(state) {
  const el = document.getElementById('history-detail');
  if (!el) return;
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="hist-detail-title">Snapshot — Cycle ${state.clockCycles}</div>
    <div class="hist-detail-grid">
      <div class="hist-d-item"><span>PC</span><strong>0x${toHex2(state.PC)}</strong></div>
      <div class="hist-d-item"><span>MAR</span><strong>0x${toHex2(state.MAR)}</strong></div>
      <div class="hist-d-item"><span>IR</span><strong>${state.instrName}</strong></div>
      <div class="hist-d-item"><span>A</span><strong>0x${toHex2(state.A)} (${state.A})</strong></div>
      <div class="hist-d-item"><span>B</span><strong>0x${toHex2(state.B)}</strong></div>
      <div class="hist-d-item"><span>SP</span><strong>0x${toHex2(state.SP)}</strong></div>
      <div class="hist-d-item"><span>OUT</span><strong>${state.OUT}</strong></div>
      <div class="hist-d-item"><span>CF</span><strong>${state.CF}</strong></div>
      <div class="hist-d-item"><span>ZF</span><strong>${state.ZF}</strong></div>
      <div class="hist-d-item"><span>Bus</span><strong>${state.busDriver}</strong></div>
      <div class="hist-d-item"><span>DataBus</span><strong>0x${toHex2(state.dataBus)}</strong></div>
      <div class="hist-d-item"><span>T-State</span><strong>T${state.tState}</strong></div>
    </div>
    <div class="hist-signals">Active signals: <strong>${getActiveSignals(state.controlWord).join(', ') || 'none'}</strong></div>
    <div class="hist-desc-full">${state.description}</div>
  `;
}

// ─────────────────────────────────────────
//  PIPELINE VIEW
// ─────────────────────────────────────────

function buildPipelineView() {
  // Static canvas — drawn on tab open
  drawPipelineCanvas();
}

function drawPipelineCanvas() {
  const canvas = document.getElementById('pipeline-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W   = canvas.width;
  const H   = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#080d12';
  ctx.fillRect(0, 0, W, H);

  const stageColors = { IF: '#1c3a7a', ID: '#1a4721', EX: '#4a2800' };
  const stageNames  = ['IF', 'ID', 'EX'];
  const colW  = 80;
  const rowH  = 28;
  const startX = 110;
  const startY = 40;

  // Header: cycle numbers
  ctx.fillStyle = '#666';
  ctx.font = '11px monospace';
  for (let c = 0; c < 8; c++) {
    ctx.fillText(`Cy${c+1}`, startX + c * colW + 20, startY - 10);
  }

  // Column grid lines
  ctx.strokeStyle = '#1a2030';
  ctx.lineWidth = 1;
  for (let c = 0; c <= 8; c++) {
    const x = startX + c * colW;
    ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, startY + 6 * rowH + 10); ctx.stroke();
  }

  // Rows from pipeline history
  const rows = App.pipelineRows.length > 0 ? App.pipelineRows : _getExamplePipelineRows();
  rows.slice(-6).forEach((row, i) => {
    const y = startY + i * (rowH + 4);

    // Instruction label
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.fillText(`${toHex2(row.pc || i * 2)} ${row.instrName || 'NOP'}`, 4, y + rowH / 2 + 4);

    // Stages
    row.stages.forEach((stage, si) => {
      if (!stage) return;
      const startCycle = (row.cycle || 0) % 8;
      const cx = startX + ((startCycle + si) % 8) * colW;
      const color = stageColors[stage] || '#222';

      // Stage box with gradient
      const grad = ctx.createLinearGradient(cx, y, cx, y + rowH);
      grad.addColorStop(0, lightenColor(color, 30));
      grad.addColorStop(1, color);
      ctx.fillStyle = grad;
      ctx.strokeStyle = lightenColor(color, 50);
      ctx.lineWidth = 1;
      ctx.beginPath();
      const rx = cx + 2, ry = y, rw = colW - 4, rh = rowH - 2, rr = 4;
      if (ctx.roundRect) {
        ctx.roundRect(rx, ry, rw, rh, rr);
      } else {
        ctx.moveTo(rx + rr, ry);
        ctx.lineTo(rx + rw - rr, ry);
        ctx.arcTo(rx + rw, ry, rx + rw, ry + rr, rr);
        ctx.lineTo(rx + rw, ry + rh - rr);
        ctx.arcTo(rx + rw, ry + rh, rx + rw - rr, ry + rh, rr);
        ctx.lineTo(rx + rr, ry + rh);
        ctx.arcTo(rx, ry + rh, rx, ry + rh - rr, rr);
        ctx.lineTo(rx, ry + rr);
        ctx.arcTo(rx, ry, rx + rr, ry, rr);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#eee';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(stage, cx + colW / 2 - 8, y + rowH / 2 + 5);
    });
  });

  // Pipeline diagram header
  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('Pipelined Execution Diagram', 4, 20);

  // Non-pipelined vs pipelined comparison note
  ctx.fillStyle = '#666';
  ctx.font = '10px monospace';
  ctx.fillText('Our SAP-1 is sequential (one instruction fully before next).', 4, H - 30);
  ctx.fillText('Pipeline would overlap IF/ID/EX of consecutive instructions.', 4, H - 16);
}

function _getExamplePipelineRows() {
  // Static example showing pipeline concept
  const instrs = ['LDA', 'ADD', 'SUB', 'OUT', 'JMP', 'NOP'];
  return instrs.map((name, i) => ({
    instrName: name,
    pc: i * 2,
    cycle: i,
    stages: ['IF', 'ID', 'EX'],
  }));
}

function lightenColor(hex, amount) {
  // Parse simple #rrggbb or var(...)
  try {
    if (!hex.startsWith('#')) return hex;
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    const nr = Math.min(255, r + amount);
    const ng = Math.min(255, g + amount);
    const nb = Math.min(255, b + amount);
    return `#${nr.toString(16).padStart(2,'0')}${ng.toString(16).padStart(2,'0')}${nb.toString(16).padStart(2,'0')}`;
  } catch(e) { return hex; }
}

// ─────────────────────────────────────────
//  MISC HELPERS
// ─────────────────────────────────────────

function escapeHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function clearHighlight(el) {
  if (el) { el.className = ''; el.textContent = ''; }
}

function updateProgramSelector() {
  const sel = document.getElementById('program-select');
  sel.innerHTML = '<option value="">-- Choose Example --</option>';
  for (const name of Object.keys(EXAMPLE_PROGRAMS)) {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    sel.appendChild(opt);
  }
}

function loadProgram(name) {
  const prog = EXAMPLE_PROGRAMS[name];
  if (!prog) return;
  document.getElementById('editor').value = prog.source;
  document.getElementById('program-description').textContent = prog.description;
  document.getElementById('program-select').value = name;
  doAssemble();
}

// ─────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────

window.addEventListener('DOMContentLoaded', initApp);
