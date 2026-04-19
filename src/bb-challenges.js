/**
 * Breadboard Build Mode — Challenge definitions and verification
 * Depends on bb-core.js, bb-components.js
 */

// ─────────────────────────────────────────────────────────────────
//  CHALLENGE DEFINITIONS
// ─────────────────────────────────────────────────────────────────
const BB_CHALLENGES = [

  // ── CHALLENGE 1 ─────────────────────────────────────────────────
  {
    id: 'bb1',
    num: 1,
    title: 'Light It Up',
    shortDesc: 'Connect a Constant to the Output Display.',
    description: `
      <p>Your first task: get <strong>any value</strong> to appear on the Output Display.</p>
      <p>Drag a <strong>Constant</strong> chip and an <strong>Output Display</strong> onto the board. Then:</p>
      <ul>
        <li>Wire the Constant's <code>OUT</code> pin to the Output's <code>DIN</code> pin.</li>
        <li>Drag a <strong>Switch</strong> (for LOAD) and a <strong>Clock</strong>.</li>
        <li>Wire <strong>Switch OUT → Output LOAD</strong> and <strong>Clock CLK → Output CLK</strong>.</li>
        <li>Set the switch to 1 (double-click it), then click <strong>Pulse</strong>.</li>
      </ul>`,
    learnText: 'Every component on a real breadboard needs power connections and a clock signal. The LOAD signal acts like a "write enable" — without it the register ignores the data bus even when the clock ticks.',
    requiredTypes: ['Const', 'Output', 'Clock'],
    attempts: 0,
    stars: 0,
    solved: false,
    // Verification: Output display has received a non-zero value
    check(board) {
      const outputs = board.components.filter(c => c.type === 'Output');
      if (!outputs.length) return { pass: false, msg: 'No Output Display found on the board.' };
      const out = outputs[0];
      if (out._displayed === 0) return { pass: false, msg: 'Output shows 0. Make sure LOAD=1 and Pulse the clock.' };
      return { pass: true, msg: `Output shows ${out._displayed}. The display is alive!` };
    },
    // Solution wiring spec (used by Show Solution)
    solution: [
      { from: { type: 'Const', pin: 'OUT'  }, to: { type: 'Output', pin: 'DIN'  } },
      { from: { type: 'Clock', pin: 'CLK'  }, to: { type: 'Output', pin: 'CLK'  } },
      { from: { type: 'Switch',pin: 'OUT'  }, to: { type: 'Output', pin: 'LOAD' } },
    ],
    solutionLayout: [
      { type: 'Clock',  x: 80,  y: 150 },
      { type: 'Switch', x: 80,  y: 290, opts: { label: 'LOAD' } },
      { type: 'Const',  x: 300, y: 150, opts: { value: 42 } },
      { type: 'Output', x: 530, y: 200 },
    ],
  },

  // ── CHALLENGE 2 ─────────────────────────────────────────────────
  {
    id: 'bb2',
    num: 2,
    title: 'Store a Value',
    shortDesc: 'Latch a value from a Constant into a Register.',
    description: `
      <p>Now let's use a proper <strong>8-bit Register</strong>. Registers are the fastest storage in the CPU — they live right on the chip.</p>
      <p>Wire up:</p>
      <ul>
        <li><strong>Constant OUT → Register D</strong> (data input)</li>
        <li><strong>Switch OUT → Register LOAD</strong></li>
        <li><strong>Clock CLK → Register CLK</strong></li>
        <li><strong>Register Q → Output DIN</strong></li>
        <li>Wire Clock and Switch to Output as well (always-LOAD the output)</li>
      </ul>
      <p>Set Switch=1, then Pulse. The register latches the value. The Output displays it.</p>`,
    learnText: 'On a rising clock edge, if LOAD=1, the register captures D into its internal flip-flops. After that, Q always outputs the stored value when ENABLE=1. This is a 74LS173 or 74HC574 in the real world.',
    requiredTypes: ['Clock', 'Register', 'Const', 'Output'],
    attempts: 0,
    stars: 0,
    solved: false,
    check(board) {
      const regs = board.components.filter(c => c.type === 'Register');
      if (!regs.length) return { pass: false, msg: 'No 8-bit Register found.' };
      const reg = regs[0];
      if (reg._stored === 0) return { pass: false, msg: 'Register stores 0. Set LOAD=1 on a clock edge.' };
      const outs = board.components.filter(c => c.type === 'Output');
      if (!outs.length) return { pass: false, msg: 'Add an Output Display to see the result.' };
      if (outs[0]._displayed === 0) return { pass: false, msg: `Register has ${reg._stored} but Output shows 0. Check Register ENABLE and Output LOAD.` };
      return { pass: true, msg: `Register stored ${reg._stored} and Output shows ${outs[0]._displayed}. Latching works!` };
    },
    solution: [
      { from: { type: 'Const',    pin: 'OUT'    }, to: { type: 'Register', pin: 'D'      } },
      { from: { type: 'Clock',    pin: 'CLK'    }, to: { type: 'Register', pin: 'CLK'    } },
      { from: { type: 'Switch',   pin: 'OUT'    }, to: { type: 'Register', pin: 'LOAD'   } },
      { from: { type: 'Switch',   pin: 'OUT'    }, to: { type: 'Register', pin: 'ENABLE' } },
      { from: { type: 'Register', pin: 'Q'      }, to: { type: 'Output',   pin: 'DIN'   } },
      { from: { type: 'Clock',    pin: 'CLK'    }, to: { type: 'Output',   pin: 'CLK'   } },
      { from: { type: 'Switch',   pin: 'OUT'    }, to: { type: 'Output',   pin: 'LOAD'  } },
    ],
    solutionLayout: [
      { type: 'Clock',    x: 60,  y: 150 },
      { type: 'Switch',   x: 60,  y: 310, opts: { label: 'LOAD/EN' } },
      { type: 'Const',    x: 280, y: 80,  opts: { value: 37 } },
      { type: 'Register', x: 280, y: 230, opts: { label: 'REG-A' } },
      { type: 'Output',   x: 510, y: 200 },
    ],
  },

  // ── CHALLENGE 3 ─────────────────────────────────────────────────
  {
    id: 'bb3',
    title: 'Move Data Through the Bus',
    num: 3,
    shortDesc: 'Transfer a value from Register A to Register B via the Bus.',
    description: `
      <p>The <strong>Bus</strong> is the shared highway. Only one component should drive it at a time.</p>
      <p>Build this path:</p>
      <ul>
        <li>Constant → <strong>Reg A</strong> (load a value into A)</li>
        <li>Reg A <code>Q</code> → <strong>Bus IN0</strong></li>
        <li>Bus <code>OUT0</code> → Reg B <code>D</code></li>
        <li>Clock → both registers</li>
        <li>Use a <strong>Switch</strong> for "ENABLE on A" and a separate <strong>Switch</strong> for "LOAD on B"</li>
      </ul>
      <p>Step 1: Load the Constant into A (LOAD_A=1, Pulse). Step 2: Enable A and Load B (EN_A=1, LOAD_B=1, Pulse).</p>`,
    learnText: 'This is the essence of how the CPU moves data. AO (A Out) = ENABLE on Register A. BI (B In) = LOAD on Register B. They fire at the same T-state, so in one clock tick, A drives the bus and B reads it.',
    requiredTypes: ['Clock', 'Register', 'Bus'],
    attempts: 0,
    stars: 0,
    solved: false,
    check(board) {
      const regs = board.components.filter(c => c.type === 'Register');
      if (regs.length < 2) return { pass: false, msg: 'Need at least 2 Registers (A and B).' };
      const buses = board.components.filter(c => c.type === 'Bus');
      if (!buses.length) return { pass: false, msg: 'Add a Bus to connect the registers.' };
      const busComp = buses[0];
      // Check that bus has a non-zero value and two registers have matching stored values
      const nonZeroRegs = regs.filter(r => r._stored !== 0);
      if (nonZeroRegs.length < 2) return { pass: false, msg: `Only ${nonZeroRegs.length}/2 registers have non-zero values. Load A first, then transfer to B.` };
      const vals = nonZeroRegs.map(r => r._stored);
      if (vals[0] !== vals[1]) return { pass: false, msg: `Reg values differ: ${vals[0]} vs ${vals[1]}. Make sure B loaded from A via the bus.` };
      return { pass: true, msg: `Both registers hold ${vals[0]}. Data moved through the bus successfully!` };
    },
    solutionLayout: [
      { type: 'Clock',    x: 60,  y: 150 },
      { type: 'Const',    x: 60,  y: 340, opts: { value: 55 } },
      { type: 'Switch',   x: 280, y: 80,  opts: { label: 'LOAD_A' } },
      { type: 'Switch',   x: 280, y: 180, opts: { label: 'EN_A' } },
      { type: 'Switch',   x: 280, y: 280, opts: { label: 'LOAD_B' } },
      { type: 'Register', x: 450, y: 120, opts: { label: 'REG-A' } },
      { type: 'Bus',      x: 450, y: 310 },
      { type: 'Register', x: 680, y: 260, opts: { label: 'REG-B' } },
    ],
  },

  // ── CHALLENGE 4 ─────────────────────────────────────────────────
  {
    id: 'bb4',
    num: 4,
    title: 'Read from Memory',
    shortDesc: 'Set MAR to address 3, then read RAM[3] onto the bus.',
    description: `
      <p>Time to use <strong>RAM</strong>. Memory access always needs two steps:</p>
      <ol>
        <li>Put the <em>address</em> into the <strong>MAR</strong> (Memory Address Register)</li>
        <li>RAM reads from that address and puts the data on the bus</li>
      </ol>
      <p>Wire it up:</p>
      <ul>
        <li>A <strong>Constant (value=3)</strong> → MAR DIN</li>
        <li>Switch → MAR LOAD, Clock → MAR CLK</li>
        <li>MAR ADDR → RAM ADDR</li>
        <li>Switch → RAM RD</li>
        <li>RAM DOUT → Output DIN</li>
      </ul>
      <p>The RAM starts with test values pre-loaded. Address 3 holds <strong>0x2A (42)</strong>.</p>`,
    learnText: 'In Ben Eater\'s computer this is the CO+MI step (PC to MAR) followed by RO+II+CE (RAM to IR). The MAR is the middleman: you tell it which address, then RAM automatically serves that location\'s contents.',
    requiredTypes: ['Clock', 'MAR', 'RAM', 'Output'],
    attempts: 0,
    stars: 0,
    solved: false,
    setup(board) {
      // Pre-load RAM with test data when challenge starts
      const rams = board.components.filter(c => c.type === 'RAM');
      rams.forEach(ram => {
        ram._mem[0] = 10; ram._mem[1] = 20; ram._mem[2] = 30; ram._mem[3] = 42;
        ram._mem[4] = 50; ram._mem[5] = 60;
      });
    },
    check(board) {
      const mars = board.components.filter(c => c.type === 'MAR');
      if (!mars.length) return { pass: false, msg: 'Add a MAR (Memory Address Register).' };
      const rams = board.components.filter(c => c.type === 'RAM');
      if (!rams.length) return { pass: false, msg: 'Add a RAM module.' };
      const outs = board.components.filter(c => c.type === 'Output');
      if (!outs.length) return { pass: false, msg: 'Add an Output Display.' };
      if (outs[0]._displayed !== 42) {
        return { pass: false, msg: `Output shows ${outs[0]._displayed}, expected 42. Check MAR=3 → RAM RD → Output.` };
      }
      return { pass: true, msg: 'Output shows 42 — RAM[3] read successfully!' };
    },
    solutionLayout: [
      { type: 'Clock',  x: 60,  y: 150 },
      { type: 'Const',  x: 60,  y: 310, opts: { value: 3 } },
      { type: 'Switch', x: 270, y: 80,  opts: { label: 'MAR_LOAD' } },
      { type: 'Switch', x: 270, y: 200, opts: { label: 'RAM_RD' } },
      { type: 'Switch', x: 270, y: 320, opts: { label: 'OUT_LOAD' } },
      { type: 'MAR',    x: 450, y: 120 },
      { type: 'RAM',    x: 450, y: 280 },
      { type: 'Output', x: 680, y: 200 },
    ],
  },

  // ── CHALLENGE 5 ─────────────────────────────────────────────────
  {
    id: 'bb5',
    num: 5,
    title: 'The Counter',
    shortDesc: 'Connect a Program Counter that counts up and displays each value.',
    description: `
      <p>The <strong>Program Counter</strong> is what makes a CPU march through a program. It auto-increments every time <code>INC=1</code> and the clock ticks.</p>
      <p>Wire:</p>
      <ul>
        <li>Clock CLK → PC CLK</li>
        <li>A Switch → PC INC (set to 1 so it counts)</li>
        <li>A Switch → PC ENABLE (set to 1 to drive output)</li>
        <li>PC DOUT → Bus IN0</li>
        <li>Bus OUT0 → Output DIN</li>
        <li>Clock and a Switch-LOAD to the Output</li>
      </ul>
      <p>Once wired, click <strong>Auto-Run</strong> in the Controls tab and watch it count!</p>`,
    learnText: 'The PC is a 74LS163 4-bit counter in Ben Eater\'s design. Every clock cycle where CE (Counter Enable) is asserted, PC increments. CO (Counter Out) puts the PC value on the address bus so RAM can be addressed for the fetch.',
    requiredTypes: ['Clock', 'PC', 'Output'],
    attempts: 0,
    stars: 0,
    solved: false,
    check(board) {
      const pcs = board.components.filter(c => c.type === 'PC');
      if (!pcs.length) return { pass: false, msg: 'Add a Program Counter.' };
      const pc = pcs[0];
      if (pc._count === 0) return { pass: false, msg: 'PC is still at 0. Set INC=1 and Pulse a few times.' };
      const outs = board.components.filter(c => c.type === 'Output');
      if (!outs.length) return { pass: false, msg: 'Add an Output Display.' };
      if (outs[0]._displayed === 0) return { pass: false, msg: `PC is at ${pc._count} but Output shows 0. Check PC ENABLE and Output LOAD.` };
      return { pass: true, msg: `PC is counting! Currently at ${pc._count}, Output shows ${outs[0]._displayed}.` };
    },
    solutionLayout: [
      { type: 'Clock',  x: 60,  y: 150 },
      { type: 'Switch', x: 60,  y: 290, opts: { label: 'INC' } },
      { type: 'Switch', x: 60,  y: 390, opts: { label: 'PC_EN' } },
      { type: 'PC',     x: 280, y: 180 },
      { type: 'Bus',    x: 480, y: 230 },
      { type: 'Output', x: 680, y: 240 },
    ],
  },

  // ── CHALLENGE 6 ─────────────────────────────────────────────────
  {
    id: 'bb6',
    num: 6,
    title: 'Fetch an Instruction',
    shortDesc: 'Wire PC → MAR → RAM → IR — the full fetch cycle.',
    description: `
      <p>This is the <strong>big one</strong>. Every instruction execution starts with a <em>fetch</em>:</p>
      <ol>
        <li><strong>T0:</strong> PC drives address bus → MAR latches it</li>
        <li><strong>T1:</strong> RAM[MAR] → data bus → IR latches it, PC increments</li>
      </ol>
      <p>You need: <strong>Clock, PC, MAR, RAM, IR, Bus, plus Switches for each control signal</strong>.</p>
      <ul>
        <li>PC DOUT → Bus IN0 → MAR DIN (T0: CO+MI)</li>
        <li>MAR ADDR → RAM ADDR</li>
        <li>RAM DOUT → Bus IN0 → IR DIN (T1: RO+II)</li>
        <li>Switches control: PC_EN (CO), MAR_LOAD (MI), RAM_RD (RO), IR_LOAD (II), PC_INC (CE)</li>
      </ul>
      <p>Manually step through T0 then T1 by toggling the right switches each pulse.</p>`,
    learnText: 'You just built the instruction fetch unit. Every CPU design — from the 6502 to modern Zen 4 — starts every instruction cycle exactly this way. The specific control signals have different names but the logic is identical: PC tells RAM where to look, RAM sends back the opcode, the IR holds it.',
    requiredTypes: ['Clock', 'PC', 'MAR', 'RAM', 'IR'],
    attempts: 0,
    stars: 0,
    solved: false,
    check(board) {
      const pcs  = board.components.filter(c => c.type === 'PC');
      const mars = board.components.filter(c => c.type === 'MAR');
      const rams = board.components.filter(c => c.type === 'RAM');
      const irs  = board.components.filter(c => c.type === 'IR');
      if (!pcs.length)  return { pass: false, msg: 'Add a Program Counter.' };
      if (!mars.length) return { pass: false, msg: 'Add a MAR.' };
      if (!rams.length) return { pass: false, msg: 'Add a RAM module.' };
      if (!irs.length)  return { pass: false, msg: 'Add an Instruction Register.' };

      // Check wires: PC connected to MAR (directly or via bus)
      const hasPC2MAR = board.wires.some(w =>
        (w.from.comp.type === 'PC' && w.to.comp.type === 'MAR') ||
        (w.from.comp.type === 'PC' && w.to.comp.type === 'Bus') ||
        (w.from.comp.type === 'Bus' && w.to.comp.type === 'MAR')
      );
      const hasRAM2IR = board.wires.some(w =>
        (w.from.comp.type === 'RAM' && w.to.comp.type === 'IR') ||
        (w.from.comp.type === 'RAM' && w.to.comp.type === 'Bus') ||
        (w.from.comp.type === 'Bus' && w.to.comp.type === 'IR')
      );
      const hasMAR2RAM = board.wires.some(w =>
        (w.from.comp.type === 'MAR' && w.to.comp.type === 'RAM') ||
        w.from.pin === 'ADDR' || w.to.pin === 'ADDR'
      );

      if (!hasPC2MAR)  return { pass: false, msg: 'PC not connected to MAR. Wire PC DOUT → MAR DIN (via Bus).' };
      if (!hasMAR2RAM) return { pass: false, msg: 'MAR not connected to RAM. Wire MAR ADDR → RAM ADDR.' };
      if (!hasRAM2IR)  return { pass: false, msg: 'RAM not connected to IR. Wire RAM DOUT → IR DIN (via Bus).' };

      if (irs[0]._stored === 0) return { pass: false, msg: 'IR is empty. Step through T0 (CO+MI) then T1 (RO+II+CE).' };

      return { pass: true, msg: `Fetch cycle wired! IR holds 0x${irs[0]._stored.toString(16).toUpperCase().padStart(2,'0')} — the full fetch path works!` };
    },
    solutionLayout: [
      { type: 'Clock',  x: 40,  y: 120 },
      { type: 'Switch', x: 40,  y: 240, opts: { label: 'CO' } },
      { type: 'Switch', x: 40,  y: 320, opts: { label: 'MI' } },
      { type: 'Switch', x: 40,  y: 400, opts: { label: 'RO' } },
      { type: 'Switch', x: 40,  y: 480, opts: { label: 'II' } },
      { type: 'Switch', x: 40,  y: 560, opts: { label: 'CE' } },
      { type: 'PC',     x: 230, y: 100 },
      { type: 'Bus',    x: 420, y: 220 },
      { type: 'MAR',    x: 420, y: 100 },
      { type: 'RAM',    x: 620, y: 150 },
      { type: 'IR',     x: 620, y: 360 },
    ],
  },

  // ── CHALLENGE 7 ─────────────────────────────────────────────────
  {
    id: 'bb7',
    num: 7,
    title: 'Build the ALU Path',
    shortDesc: 'Wire A + B through the ALU, result back to A.',
    description: `
      <p>Now let's do <strong>arithmetic</strong>. The ALU takes two inputs and produces a result.</p>
      <p>Wire this datapath:</p>
      <ul>
        <li>Two <strong>Constants</strong> (e.g. 12 and 30) → Reg A and Reg B</li>
        <li>Reg A Q → ALU A input</li>
        <li>Reg B Q → ALU B input</li>
        <li>ALU OUT → Bus → Reg A D (result goes back into A)</li>
        <li>ALU CF → Flags CF_IN, ALU ZF → Flags ZF_IN</li>
        <li>Clock and Switches for all LOAD/ENABLE signals</li>
      </ul>
      <p>Load A and B, then set ENABLE on both and pulse to compute. Result appears on the Output.</p>`,
    learnText: 'This is the EO+AI+FI step — ALU Out, A In, Flags In. All three signals fire simultaneously. The ALU result flows onto the bus, A latches it, and the carry/zero flags update. In real hardware this is nanoseconds. Here you\'re doing it by hand.',
    requiredTypes: ['ALU', 'Register', 'Flags'],
    attempts: 0,
    stars: 0,
    solved: false,
    check(board) {
      const alus  = board.components.filter(c => c.type === 'ALU');
      const regs  = board.components.filter(c => c.type === 'Register');
      const flags = board.components.filter(c => c.type === 'Flags');
      if (!alus.length)  return { pass: false, msg: 'Add an ALU.' };
      if (regs.length < 2) return { pass: false, msg: 'Add at least 2 Registers (A and B).' };
      if (!flags.length) return { pass: false, msg: 'Add a Flags Register.' };

      const alu = alus[0];
      if (alu._result === 0 && alu.getPin('A').value === 0) {
        return { pass: false, msg: 'ALU inputs are 0. Load values into Reg A and Reg B first.' };
      }

      // Check wires: Register → ALU and ALU → Register
      const hasReg2ALU = board.wires.some(w =>
        w.from.comp.type === 'Register' && w.to.comp.type === 'ALU'
      );
      const hasALU2Reg = board.wires.some(w =>
        w.from.comp.type === 'ALU' && (w.to.comp.type === 'Register' || w.to.comp.type === 'Bus')
      );
      const hasALU2Flags = board.wires.some(w =>
        w.from.comp.type === 'ALU' && w.to.comp.type === 'Flags'
      );

      if (!hasReg2ALU) return { pass: false, msg: 'Connect a Register to the ALU input (A or B pin).' };
      if (!hasALU2Reg) return { pass: false, msg: 'Connect ALU OUT back to a Register or Bus.' };
      if (!hasALU2Flags) return { pass: false, msg: 'Connect ALU CF and ZF to the Flags register.' };

      return { pass: true, msg: `ALU computed ${alu.getPin('A').value} + ${alu.getPin('B').value} = ${alu._result}. Datapath works!` };
    },
    solutionLayout: [
      { type: 'Clock',    x: 40,  y: 140 },
      { type: 'Const',    x: 40,  y: 280, opts: { value: 12 } },
      { type: 'Const',    x: 40,  y: 380, opts: { value: 30 } },
      { type: 'Switch',   x: 220, y: 80,  opts: { label: 'LOAD_A' } },
      { type: 'Switch',   x: 220, y: 180, opts: { label: 'LOAD_B' } },
      { type: 'Switch',   x: 220, y: 280, opts: { label: 'EN_ALU' } },
      { type: 'Register', x: 420, y: 120, opts: { label: 'REG-A' } },
      { type: 'Register', x: 420, y: 300, opts: { label: 'REG-B' } },
      { type: 'ALU',      x: 620, y: 200 },
      { type: 'Flags',    x: 820, y: 200 },
      { type: 'Output',   x: 820, y: 350 },
    ],
  },

  // ── CHALLENGE 8 ─────────────────────────────────────────────────
  {
    id: 'bb8',
    num: 8,
    title: 'Complete CPU',
    shortDesc: 'Wire ALL components into a working CPU datapath.',
    description: `
      <p>The final challenge: build the <strong>complete CPU datapath</strong>.</p>
      <p>You need every component: Clock, PC, MAR, RAM, IR, Reg A, Reg B, ALU, Flags, Bus, Output.</p>
      <p>The full wiring:</p>
      <ul>
        <li><strong>Fetch:</strong> PC → Bus → MAR → RAM ADDR; RAM DOUT → Bus → IR</li>
        <li><strong>Execute:</strong> RAM DOUT → Bus → Reg A (for LDA); Reg A+B → ALU → Bus → Reg A</li>
        <li><strong>Output:</strong> Reg A → Output</li>
        <li>All LOAD/ENABLE/INC signals controlled by Switches</li>
      </ul>
      <p>A test program is pre-loaded in RAM: LDI 7, OUT, HLT. Manually step through it!</p>`,
    learnText: 'You just built an 8-bit computer from scratch. Every transistor, every flip-flop, every control signal — you placed it and connected it. Intel 4004 (1971): 2,300 transistors. What you built today is conceptually identical.',
    requiredTypes: ['Clock', 'PC', 'MAR', 'RAM', 'IR', 'Register', 'ALU', 'Flags', 'Output'],
    attempts: 0,
    stars: 0,
    solved: false,
    setup(board) {
      const rams = board.components.filter(c => c.type === 'RAM');
      rams.forEach(ram => {
        // LDI 7, OUT, HLT  (opcodes from our ISA)
        ram._mem[0] = 0x05; ram._mem[1] = 7;   // LDI 7
        ram._mem[2] = 0x0E;                      // OUT
        ram._mem[3] = 0x0F;                      // HLT
      });
    },
    check(board) {
      const required = ['PC','MAR','RAM','IR','Register','ALU','Flags','Output'];
      for (const t of required) {
        if (!board.components.some(c => c.type === t)) {
          return { pass: false, msg: `Missing component: ${t}. Add all required components.` };
        }
      }
      if (board.wires.length < 8) {
        return { pass: false, msg: `Only ${board.wires.length} wires. A complete CPU needs at least 8 connections.` };
      }
      const outs = board.components.filter(c => c.type === 'Output');
      if (outs[0]._displayed === 0) {
        return { pass: false, msg: 'Output shows 0. Step through the fetch-execute cycle to run the program.' };
      }
      return { pass: true, msg: `Complete CPU built! Output shows ${outs[0]._displayed}. You built a computer from scratch!` };
    },
    solutionLayout: [
      { type: 'Clock',    x: 40,  y: 200 },
      { type: 'Switch',   x: 40,  y: 350, opts: { label: 'CO'   } },
      { type: 'Switch',   x: 40,  y: 420, opts: { label: 'MI'   } },
      { type: 'Switch',   x: 40,  y: 490, opts: { label: 'RO'   } },
      { type: 'Switch',   x: 40,  y: 560, opts: { label: 'II'   } },
      { type: 'Switch',   x: 40,  y: 630, opts: { label: 'CE'   } },
      { type: 'Switch',   x: 40,  y: 700, opts: { label: 'AI'   } },
      { type: 'Switch',   x: 40,  y: 770, opts: { label: 'AO'   } },
      { type: 'Switch',   x: 40,  y: 840, opts: { label: 'EO'   } },
      { type: 'Switch',   x: 40,  y: 910, opts: { label: 'OI'   } },
      { type: 'PC',       x: 230, y: 120 },
      { type: 'MAR',      x: 430, y: 120 },
      { type: 'RAM',      x: 630, y: 80  },
      { type: 'IR',       x: 630, y: 300 },
      { type: 'Bus',      x: 430, y: 340 },
      { type: 'Register', x: 230, y: 500, opts: { label: 'REG-A' } },
      { type: 'Register', x: 430, y: 600, opts: { label: 'REG-B' } },
      { type: 'ALU',      x: 630, y: 530 },
      { type: 'Flags',    x: 830, y: 530 },
      { type: 'Output',   x: 830, y: 300 },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
//  STAR RATING LOGIC
// ─────────────────────────────────────────────────────────────────
function calcStars(challenge, attemptCount, wireCount, minWires) {
  if (attemptCount === 1)  return 3;
  if (attemptCount <= 3)   return 2;
  return 1;
}

window.BB_CHALLENGES = BB_CHALLENGES;
window.calcStars     = calcStars;
