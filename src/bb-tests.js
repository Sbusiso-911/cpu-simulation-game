/**
 * Breadboard Component Verification Suite
 * ========================================
 * Each test instantiates a real breadboard chip class, sets its input pins,
 * calls simulate(), and verifies the output pins.
 *
 * If all tests pass → the chips behave correctly. When you build a circuit
 * and it doesn't work, you'll know it's a wiring problem (your bug),
 * not a chip problem (the simulator's bug).
 */

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

/** Set a pin's value (and mark it connected so the chip respects it). */
function setPin(comp, pinName, value) {
  const pin = comp.getPin(pinName);
  if (!pin) throw new Error('No pin named ' + pinName);
  pin.value = value;
  pin._connected = true;
}

/** Read a pin's value. */
function getPin(comp, pinName) {
  const pin = comp.getPin(pinName);
  if (!pin) throw new Error('No pin named ' + pinName);
  return pin.value;
}

/** Assert helper. */
function expectBB(actual, expected, what) {
  if (actual !== expected) {
    throw new Error(`${what}: expected ${expected}, got ${actual}`);
  }
}

/** Run simulate with a clock pulse (rising edge). */
function pulse(comp) {
  comp.simulate(true);
}

/** Run simulate without a clock edge (combinational settle). */
function settle(comp) {
  comp.simulate(false);
}

function bbTest(name, fn) {
  return { name, fn };
}

// ─────────────────────────────────────────────
//  THE TESTS
// ─────────────────────────────────────────────

const BB_TESTS = [

  // ── REGISTER ──
  bbTest('Register: stores value on rising clock + LOAD high', () => {
    const r = new RegisterComponent(0, 0, 'TEST');
    setPin(r, 'D', 42);
    setPin(r, 'CLK', 1);
    setPin(r, 'LOAD', 1);
    setPin(r, 'ENABLE', 1);
    pulse(r);
    expectBB(getPin(r, 'Q'), 42, 'Q outputs 42 when ENABLE high');
    expectBB(getPin(r, 'DIRECT'), 42, 'DIRECT always outputs stored value');
  }),

  bbTest('Register: ignores LOAD when LOAD=0', () => {
    const r = new RegisterComponent(0, 0, 'TEST');
    setPin(r, 'D', 42); setPin(r, 'CLK', 1); setPin(r, 'LOAD', 1); setPin(r, 'ENABLE', 1);
    pulse(r);
    setPin(r, 'D', 99); setPin(r, 'LOAD', 0);
    pulse(r);
    expectBB(getPin(r, 'Q'), 42, 'Q still 42 (no load)');
  }),

  bbTest('Register: ENABLE=0 disconnects Q from bus (Q=0)', () => {
    const r = new RegisterComponent(0, 0, 'TEST');
    setPin(r, 'D', 42); setPin(r, 'CLK', 1); setPin(r, 'LOAD', 1); setPin(r, 'ENABLE', 0);
    pulse(r);
    expectBB(getPin(r, 'Q'), 0, 'Q=0 when ENABLE off');
    expectBB(getPin(r, 'DIRECT'), 42, 'DIRECT still outputs 42 (always-on)');
  }),

  bbTest('Register: requires CLOCK rising edge to load', () => {
    const r = new RegisterComponent(0, 0, 'TEST');
    setPin(r, 'D', 42); setPin(r, 'CLK', 1); setPin(r, 'LOAD', 1); setPin(r, 'ENABLE', 1);
    settle(r);  // no rising edge
    expectBB(getPin(r, 'Q'), 0, 'Q=0 (no clock edge yet)');
    pulse(r);   // rising edge
    expectBB(getPin(r, 'Q'), 42, 'Q=42 after clock edge');
  }),

  // ── ALU ──
  bbTest('ALU: adds two numbers (5+3=8)', () => {
    const alu = new ALUComponent(0, 0);
    setPin(alu, 'A', 5); setPin(alu, 'B', 3); setPin(alu, 'SUB', 0); setPin(alu, 'ENABLE', 1);
    settle(alu);
    expectBB(getPin(alu, 'OUT'), 8, 'OUT = 5+3');
    expectBB(getPin(alu, 'CF'), 0, 'CF = 0 (no overflow)');
    expectBB(getPin(alu, 'ZF'), 0, 'ZF = 0 (result nonzero)');
  }),

  bbTest('ALU: ZF=1 when result is zero', () => {
    const alu = new ALUComponent(0, 0);
    setPin(alu, 'A', 0); setPin(alu, 'B', 0); setPin(alu, 'SUB', 0); setPin(alu, 'ENABLE', 1);
    settle(alu);
    expectBB(getPin(alu, 'ZF'), 1, 'ZF = 1');
  }),

  bbTest('ALU: CF=1 on overflow (200+100)', () => {
    const alu = new ALUComponent(0, 0);
    setPin(alu, 'A', 200); setPin(alu, 'B', 100); setPin(alu, 'SUB', 0); setPin(alu, 'ENABLE', 1);
    settle(alu);
    expectBB(getPin(alu, 'OUT'), 44, 'OUT = 300 mod 256 = 44');
    expectBB(getPin(alu, 'CF'), 1, 'CF = 1 (overflow)');
  }),

  bbTest('ALU: subtracts when SUB=1 (10-3=7)', () => {
    const alu = new ALUComponent(0, 0);
    setPin(alu, 'A', 10); setPin(alu, 'B', 3); setPin(alu, 'SUB', 1); setPin(alu, 'ENABLE', 1);
    settle(alu);
    expectBB(getPin(alu, 'OUT'), 7, 'OUT = 10-3');
    expectBB(getPin(alu, 'CF'), 1, 'CF = 1 (no borrow, A>=B)');
  }),

  bbTest('ALU: SUB with borrow (3-5)', () => {
    const alu = new ALUComponent(0, 0);
    setPin(alu, 'A', 3); setPin(alu, 'B', 5); setPin(alu, 'SUB', 1); setPin(alu, 'ENABLE', 1);
    settle(alu);
    expectBB(getPin(alu, 'OUT'), 254, 'OUT = 3-5 mod 256');
    expectBB(getPin(alu, 'CF'), 0, 'CF = 0 (borrow needed, A<B)');
  }),

  bbTest('ALU: ENABLE=0 disconnects OUT from bus', () => {
    const alu = new ALUComponent(0, 0);
    setPin(alu, 'A', 5); setPin(alu, 'B', 3); setPin(alu, 'SUB', 0); setPin(alu, 'ENABLE', 0);
    settle(alu);
    expectBB(getPin(alu, 'OUT'), 0, 'OUT = 0 when ENABLE off');
    expectBB(getPin(alu, 'CF'), 0, 'CF still computed');
    expectBB(getPin(alu, 'ZF'), 0, 'ZF still computed');
  }),

  // ── RAM ──
  bbTest('RAM: writes on clock edge when WR=1', () => {
    const ram = new RAMComponent(0, 0);
    setPin(ram, 'ADDR', 5); setPin(ram, 'DIN', 99); setPin(ram, 'WR', 1); setPin(ram, 'CLK', 1);
    pulse(ram);
    // Read it back
    setPin(ram, 'WR', 0); setPin(ram, 'RD', 1);
    settle(ram);
    expectBB(getPin(ram, 'DOUT'), 99, 'DOUT = 99 from address 5');
  }),

  bbTest('RAM: stores different values at different addresses', () => {
    const ram = new RAMComponent(0, 0);
    setPin(ram, 'CLK', 1); setPin(ram, 'WR', 1);
    // Write 11 to addr 3
    setPin(ram, 'ADDR', 3); setPin(ram, 'DIN', 11); pulse(ram);
    // Write 22 to addr 7
    setPin(ram, 'ADDR', 7); setPin(ram, 'DIN', 22); pulse(ram);
    // Read addr 3
    setPin(ram, 'WR', 0); setPin(ram, 'RD', 1);
    setPin(ram, 'ADDR', 3); settle(ram);
    expectBB(getPin(ram, 'DOUT'), 11, 'addr 3 = 11');
    setPin(ram, 'ADDR', 7); settle(ram);
    expectBB(getPin(ram, 'DOUT'), 22, 'addr 7 = 22');
  }),

  bbTest('RAM: RD=0 disconnects DOUT (=0)', () => {
    const ram = new RAMComponent(0, 0);
    setPin(ram, 'CLK', 1); setPin(ram, 'WR', 1);
    setPin(ram, 'ADDR', 0); setPin(ram, 'DIN', 42); pulse(ram);
    setPin(ram, 'WR', 0); setPin(ram, 'RD', 0);
    settle(ram);
    expectBB(getPin(ram, 'DOUT'), 0, 'DOUT = 0 when RD off');
  }),

  bbTest('RAM: WR=0 prevents writes', () => {
    const ram = new RAMComponent(0, 0);
    // Pre-load 7 at addr 0
    setPin(ram, 'CLK', 1); setPin(ram, 'WR', 1); setPin(ram, 'ADDR', 0); setPin(ram, 'DIN', 7);
    pulse(ram);
    // Try to write 99 with WR=0
    setPin(ram, 'WR', 0); setPin(ram, 'DIN', 99); pulse(ram);
    // Read back
    setPin(ram, 'RD', 1); settle(ram);
    expectBB(getPin(ram, 'DOUT'), 7, 'still 7 (write was blocked)');
  }),

  bbTest('RAM: loadBytes initializes memory', () => {
    const ram = new RAMComponent(0, 0);
    ram.loadBytes([10, 20, 30, 40]);
    setPin(ram, 'RD', 1);
    setPin(ram, 'ADDR', 0); settle(ram);
    expectBB(getPin(ram, 'DOUT'), 10, 'addr 0 = 10');
    setPin(ram, 'ADDR', 1); settle(ram);
    expectBB(getPin(ram, 'DOUT'), 20, 'addr 1 = 20');
    setPin(ram, 'ADDR', 2); settle(ram);
    expectBB(getPin(ram, 'DOUT'), 30, 'addr 2 = 30');
    setPin(ram, 'ADDR', 3); settle(ram);
    expectBB(getPin(ram, 'DOUT'), 40, 'addr 3 = 40');
  }),

  // ── PROGRAM COUNTER ──
  bbTest('PC: increments on clock when INC=1', () => {
    const pc = new ProgramCounterComponent(0, 0);
    setPin(pc, 'INC', 1); setPin(pc, 'LOAD', 0); setPin(pc, 'ENABLE', 1); setPin(pc, 'CLK', 1);
    settle(pc); // initial state: PC=0
    const initial = getPin(pc, 'DOUT');
    pulse(pc);
    expectBB(getPin(pc, 'DOUT'), (initial + 1) & 0x0F, 'PC incremented');
    pulse(pc);
    expectBB(getPin(pc, 'DOUT'), (initial + 2) & 0x0F, 'PC incremented again');
  }),

  bbTest('PC: loads value when LOAD=1', () => {
    const pc = new ProgramCounterComponent(0, 0);
    setPin(pc, 'DIN', 7); setPin(pc, 'LOAD', 1); setPin(pc, 'INC', 0); setPin(pc, 'ENABLE', 1); setPin(pc, 'CLK', 1);
    pulse(pc);
    expectBB(getPin(pc, 'DOUT'), 7, 'PC loaded with 7');
  }),

  bbTest('PC: ENABLE=0 disconnects DOUT', () => {
    const pc = new ProgramCounterComponent(0, 0);
    setPin(pc, 'DIN', 5); setPin(pc, 'LOAD', 1); setPin(pc, 'CLK', 1); setPin(pc, 'ENABLE', 0);
    pulse(pc);
    expectBB(getPin(pc, 'DOUT'), 0, 'DOUT=0 when ENABLE off');
  }),

  // ── MAR ──
  bbTest('MAR: latches address on clock', () => {
    const mar = new MARComponent(0, 0);
    setPin(mar, 'DIN', 5); setPin(mar, 'CLK', 1); setPin(mar, 'LOAD', 1);
    pulse(mar);
    expectBB(getPin(mar, 'ADDR'), 5, 'ADDR = 5 (latched)');
  }),

  // ── INSTRUCTION REGISTER ──
  bbTest('IR: latches byte on clock, outputs OPCODE (full byte) and OPERAND (lower nibble)', () => {
    const ir = new InstructionRegisterComponent(0, 0);
    setPin(ir, 'DIN', 0x1E); setPin(ir, 'CLK', 1); setPin(ir, 'LOAD', 1); setPin(ir, 'ENABLE', 1);
    pulse(ir);
    expectBB(getPin(ir, 'OPCODE'), 0x1E, 'OPCODE = full latched byte');
    expectBB(getPin(ir, 'OPERAND'), 14, 'OPERAND = lower nibble (when ENABLE=1)');
  }),

  bbTest('IR: OPERAND=0 when ENABLE=0', () => {
    const ir = new InstructionRegisterComponent(0, 0);
    setPin(ir, 'DIN', 0x1E); setPin(ir, 'CLK', 1); setPin(ir, 'LOAD', 1); setPin(ir, 'ENABLE', 0);
    pulse(ir);
    expectBB(getPin(ir, 'OPERAND'), 0, 'OPERAND tri-stated when ENABLE off');
    expectBB(getPin(ir, 'OPCODE'), 0x1E, 'OPCODE always available (hardwired)');
  }),

  // ── FLAGS ──
  bbTest('Flags: stores CF and ZF on clock', () => {
    const f = new FlagsComponent(0, 0);
    setPin(f, 'CF_IN', 1); setPin(f, 'ZF_IN', 0); setPin(f, 'CLK', 1); setPin(f, 'LOAD', 1);
    pulse(f);
    expectBB(getPin(f, 'CF'), 1, 'CF = 1');
    expectBB(getPin(f, 'ZF'), 0, 'ZF = 0');
  }),

  bbTest('Flags: requires LOAD signal to update', () => {
    const f = new FlagsComponent(0, 0);
    setPin(f, 'CF_IN', 1); setPin(f, 'ZF_IN', 1); setPin(f, 'CLK', 1); setPin(f, 'LOAD', 0);
    pulse(f);
    expectBB(getPin(f, 'CF'), 0, 'CF unchanged (LOAD off)');
    expectBB(getPin(f, 'ZF'), 0, 'ZF unchanged (LOAD off)');
  }),

  // ── BUS ──
  bbTest('Bus: passes value from input port to output ports', () => {
    const bus = new BusComponent(0, 0);
    setPin(bus, 'P0_IN', 42);
    settle(bus);
    expectBB(getPin(bus, 'P0_OUT'), 42, 'P0 out');
    expectBB(getPin(bus, 'P1_OUT'), 42, 'P1 out (broadcast)');
    expectBB(getPin(bus, 'P2_OUT'), 42, 'P2 out (broadcast)');
  }),

  bbTest('Bus: detects contention (two drivers)', () => {
    const bus = new BusComponent(0, 0);
    setPin(bus, 'P0_IN', 5);
    setPin(bus, 'P1_IN', 10);
    settle(bus);
    // Bus should detect contention — exact behavior may vary but it should warn
    // At minimum, the bus should NOT be silent (one of them takes effect)
    const out = getPin(bus, 'P0_OUT');
    if (out !== 5 && out !== 10) {
      throw new Error('Bus contention not handled correctly: got ' + out);
    }
  }),

  bbTest('Bus: empty when no driver', () => {
    const bus = new BusComponent(0, 0);
    setPin(bus, 'P0_IN', 0);
    setPin(bus, 'P1_IN', 0);
    settle(bus);
    expectBB(getPin(bus, 'P0_OUT'), 0, 'Bus = 0 when no driver');
  }),

  // ── CLOCK ──
  bbTest('Clock: outputs CLK pin', () => {
    const clk = new ClockComponent(0, 0);
    expectBB(typeof clk.getPin('CLK'), 'object', 'has CLK pin');
  }),

  // ── SWITCH ──
  bbTest('Switch: outputs its toggle state', () => {
    const sw = new ControlSwitchComponent(0, 0);
    sw._state = 1;
    settle(sw);
    expectBB(getPin(sw, 'OUT'), 1, 'OUT = 1 when on');
    sw._state = 0;
    settle(sw);
    expectBB(getPin(sw, 'OUT'), 0, 'OUT = 0 when off');
  }),

  bbTest('Switch: toggle() flips state', () => {
    const sw = new ControlSwitchComponent(0, 0);
    expectBB(sw._state, 0, 'starts at 0');
    sw.toggle();
    expectBB(sw._state, 1, 'after toggle: 1');
    sw.toggle();
    expectBB(sw._state, 0, 'after toggle again: 0');
  }),

  // ── CONSTANT ──
  bbTest('Constant: outputs its value', () => {
    const c = new ConstantComponent(0, 0);
    c._value = 42;
    settle(c);
    expectBB(getPin(c, 'OUT'), 42, 'OUT = constant value');
  }),

  // ── OUTPUT DISPLAY ──
  bbTest('Output Display: latches value on clock + LOAD', () => {
    const out = new OutputDisplayComponent(0, 0);
    setPin(out, 'DIN', 99); setPin(out, 'CLK', 1); setPin(out, 'LOAD', 1);
    pulse(out);
    expectBB(out._displayed, 99, 'displayed value = 99');
  }),

  bbTest('Output Display: ignores when LOAD=0', () => {
    const out = new OutputDisplayComponent(0, 0);
    setPin(out, 'DIN', 42); setPin(out, 'CLK', 1); setPin(out, 'LOAD', 1);
    pulse(out);
    setPin(out, 'DIN', 99); setPin(out, 'LOAD', 0);
    pulse(out);
    expectBB(out._displayed, 42, 'still 42 (load was off)');
  }),

  // ── INTEGRATION: a tiny circuit ──
  bbTest('Integration: REG → BUS → REG copy', () => {
    // Source register loaded with 77, ENABLE=1 → bus → dest register
    const src = new RegisterComponent(0, 0, 'SRC');
    const bus = new BusComponent(0, 0);
    const dst = new RegisterComponent(0, 0, 'DST');

    // Load src
    setPin(src, 'D', 77); setPin(src, 'CLK', 1); setPin(src, 'LOAD', 1); setPin(src, 'ENABLE', 1);
    pulse(src);

    // Wire src.Q → bus.P0_IN, bus.P0_OUT → dst.D
    setPin(bus, 'P0_IN', getPin(src, 'Q'));
    settle(bus);
    setPin(dst, 'D', getPin(bus, 'P0_OUT'));
    setPin(dst, 'CLK', 1); setPin(dst, 'LOAD', 1); setPin(dst, 'ENABLE', 1);
    pulse(dst);

    expectBB(getPin(dst, 'Q'), 77, 'value copied through bus');
  }),

  bbTest('Integration: REG_A + REG_B → ALU → result', () => {
    const ra = new RegisterComponent(0, 0, 'A');
    const rb = new RegisterComponent(0, 0, 'B');
    const alu = new ALUComponent(0, 0);

    setPin(ra, 'D', 10); setPin(ra, 'CLK', 1); setPin(ra, 'LOAD', 1); setPin(ra, 'ENABLE', 1);
    pulse(ra);
    setPin(rb, 'D', 5); setPin(rb, 'CLK', 1); setPin(rb, 'LOAD', 1); setPin(rb, 'ENABLE', 1);
    pulse(rb);

    // Direct wires from registers to ALU
    setPin(alu, 'A', getPin(ra, 'DIRECT'));
    setPin(alu, 'B', getPin(rb, 'DIRECT'));
    setPin(alu, 'SUB', 0); setPin(alu, 'ENABLE', 1);
    settle(alu);
    expectBB(getPin(alu, 'OUT'), 15, '10 + 5 = 15');
  }),
];

// ─────────────────────────────────────────────
//  RUNNER
// ─────────────────────────────────────────────

function runAllBBTests() {
  const results = { passed: 0, failed: 0, total: BB_TESTS.length, tests: [] };
  for (const test of BB_TESTS) {
    let result = { name: test.name, passed: false, error: null };
    try {
      test.fn();
      result.passed = true;
      results.passed++;
    } catch (e) {
      result.error = e.message;
      results.failed++;
    }
    results.tests.push(result);
  }
  return results;
}

// Combined runner — runs both CPU and breadboard tests
function runEverything() {
  const cpu = (typeof runAllCPUTests === 'function') ? runAllCPUTests() : null;
  const bb = runAllBBTests();
  return {
    cpu: cpu,
    bb: bb,
    total: (cpu ? cpu.total : 0) + bb.total,
    passed: (cpu ? cpu.passed : 0) + bb.passed,
    failed: (cpu ? cpu.failed : 0) + bb.failed,
  };
}

// ─────────────────────────────────────────────
//  EXPOSE
// ─────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.runAllBBTests = runAllBBTests;
  window.runEverything = runEverything;
  window.BB_TESTS = BB_TESTS;
}
