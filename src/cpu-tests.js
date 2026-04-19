/**
 * CPU Verification Test Suite
 * ============================
 * Each test loads a small program, runs it, and verifies the result.
 * If ALL tests pass → you can trust the CPU. Any failure means
 * the CPU has a bug — not your program.
 *
 * Usage in browser:
 *   const results = runAllCPUTests();    // returns {passed, failed, total, tests:[...]}
 *   document.body.appendChild(renderTestResults(results)); // visual report
 *
 * Or auto-render to a tab via initTestUI().
 */

// ─────────────────────────────────────────────
//  TEST INFRASTRUCTURE
// ─────────────────────────────────────────────

// Opcodes (must match cpu.js)
const OP = {
  NOP: 0x00, LDA: 0x01, ADD: 0x02, SUB: 0x03, STA: 0x04, LDI: 0x05,
  JMP: 0x06, JC:  0x07, JZ:  0x08, AND: 0x09, OR:  0x0A, XOR: 0x0B,
  SHL: 0x0C, SHR: 0x0D, OUT: 0x0E, HLT: 0x0F,
  PUSH:0x10, POP: 0x11, CALL:0x12, RET: 0x13, IN:  0x14, RTI: 0x15,
  JNZ: 0x16, JNC: 0x17, LDB: 0x18, CMP: 0x19,
};

/**
 * Run a program and return the final CPU state.
 * @param {Array} bytes - Program bytes to load into RAM starting at address 0.
 * @param {Object} opts - Optional setup: {input, sp, ramOverrides:{addr:val}}
 * @returns {CPU} the CPU after execution
 */
function runProgram(bytes, opts) {
  opts = opts || {};
  const cpu = new CPU();
  cpu.loadProgram(bytes);
  if (opts.input !== undefined) cpu.setInput(opts.input);
  if (opts.sp !== undefined) cpu.SP = opts.sp & 0xFF;
  if (opts.ramOverrides) {
    for (const [addr, val] of Object.entries(opts.ramOverrides)) {
      cpu.writeRAM(parseInt(addr, 10), val);
    }
  }
  cpu.run(10000); // safety cap
  return cpu;
}

/**
 * A single test definition.
 * @param {string} name - Human-readable test name
 * @param {Function} fn - Test function: receives runProgram, OP. Throws if fail.
 */
function makeTest(name, fn) {
  return { name, fn };
}

/**
 * Assert helper — throws with descriptive message on failure.
 */
function expect(actual, expected, what) {
  if (actual !== expected) {
    throw new Error(`${what}: expected ${expected} (0x${(expected & 0xFF).toString(16).padStart(2,'0')}), got ${actual} (0x${(actual & 0xFF).toString(16).padStart(2,'0')})`);
  }
}

// ─────────────────────────────────────────────
//  THE TESTS
// ─────────────────────────────────────────────

const CPU_TESTS = [

  // ── Group 1: Basic data movement ──
  makeTest('NOP does nothing', () => {
    const cpu = runProgram([OP.NOP, OP.HLT]);
    expect(cpu.A, 0, 'A unchanged');
    expect(cpu.B, 0, 'B unchanged');
    expect(cpu.halted, true, 'halted');
  }),

  makeTest('LDI loads immediate into A', () => {
    const cpu = runProgram([OP.LDI, 42, OP.HLT]);
    expect(cpu.A, 42, 'A = 42');
  }),

  makeTest('LDI works with 0', () => {
    const cpu = runProgram([OP.LDI, 0, OP.HLT]);
    expect(cpu.A, 0, 'A = 0');
  }),

  makeTest('LDI works with 255', () => {
    const cpu = runProgram([OP.LDI, 255, OP.HLT]);
    expect(cpu.A, 255, 'A = 255');
  }),

  makeTest('LDB loads immediate into B', () => {
    const cpu = runProgram([OP.LDB, 99, OP.HLT]);
    expect(cpu.B, 99, 'B = 99');
  }),

  makeTest('LDA loads from RAM into A', () => {
    // Program: LDA 5, HLT, ..., RAM[5]=77
    const prog = [OP.LDA, 5, OP.HLT, 0, 0, 77];
    const cpu = runProgram(prog);
    expect(cpu.A, 77, 'A = RAM[5]');
  }),

  makeTest('STA stores A into RAM', () => {
    // Program: LDI 88, STA 7, HLT, _, _, _, _, _
    const prog = [OP.LDI, 88, OP.STA, 7, OP.HLT, 0, 0, 0];
    const cpu = runProgram(prog);
    expect(cpu.RAM[7], 88, 'RAM[7] = 88');
    expect(cpu.A, 88, 'A still = 88');
  }),

  // ── Group 2: Arithmetic ──
  makeTest('ADD: 5 + 3 = 8', () => {
    const prog = [OP.LDI, 5, OP.ADD, 6, OP.HLT, 0, 3];
    const cpu = runProgram(prog);
    expect(cpu.A, 8, 'A = 5+3');
    expect(cpu.ZF, 0, 'ZF should be 0');
    expect(cpu.CF, 0, 'CF should be 0');
  }),

  makeTest('ADD: 0 + 0 = 0, ZF set', () => {
    const prog = [OP.LDI, 0, OP.ADD, 6, OP.HLT, 0, 0];
    const cpu = runProgram(prog);
    expect(cpu.A, 0, 'A = 0');
    expect(cpu.ZF, 1, 'ZF = 1');
  }),

  makeTest('ADD: 200 + 100 = 44 (overflow), CF set', () => {
    const prog = [OP.LDI, 200, OP.ADD, 6, OP.HLT, 0, 100];
    const cpu = runProgram(prog);
    expect(cpu.A, 44, 'A = 300 mod 256');
    expect(cpu.CF, 1, 'CF = 1 (carry/overflow)');
  }),

  makeTest('SUB: 10 - 3 = 7', () => {
    const prog = [OP.LDI, 10, OP.SUB, 6, OP.HLT, 0, 3];
    const cpu = runProgram(prog);
    expect(cpu.A, 7, 'A = 10-3');
    expect(cpu.ZF, 0, 'ZF = 0');
  }),

  makeTest('SUB: 5 - 5 = 0, ZF set', () => {
    const prog = [OP.LDI, 5, OP.SUB, 6, OP.HLT, 0, 5];
    const cpu = runProgram(prog);
    expect(cpu.A, 0, 'A = 0');
    expect(cpu.ZF, 1, 'ZF = 1');
  }),

  makeTest('SUB: 3 - 5 = 254 (borrow), CF=0 (no-borrow convention)', () => {
    // This CPU uses "no-borrow" CF: CF=1 means A>=B (ok), CF=0 means A<B (borrow needed)
    const prog = [OP.LDI, 3, OP.SUB, 6, OP.HLT, 0, 5];
    const cpu = runProgram(prog);
    expect(cpu.A, 254, 'A = 3-5 (mod 256)');
    expect(cpu.CF, 0, 'CF = 0 (borrow occurred — A<B)');
  }),

  // ── Group 3: Logic ──
  makeTest('AND: 0xF0 & 0x0F = 0', () => {
    const prog = [OP.LDI, 0xF0, OP.AND, 6, OP.HLT, 0, 0x0F];
    const cpu = runProgram(prog);
    expect(cpu.A, 0, 'A = 0');
    expect(cpu.ZF, 1, 'ZF = 1');
  }),

  makeTest('AND: 0xFF & 0x55 = 0x55', () => {
    const prog = [OP.LDI, 0xFF, OP.AND, 6, OP.HLT, 0, 0x55];
    const cpu = runProgram(prog);
    expect(cpu.A, 0x55, 'A = 0x55');
  }),

  makeTest('OR: 0xF0 | 0x0F = 0xFF', () => {
    const prog = [OP.LDI, 0xF0, OP.OR, 6, OP.HLT, 0, 0x0F];
    const cpu = runProgram(prog);
    expect(cpu.A, 0xFF, 'A = 0xFF');
  }),

  makeTest('XOR: 0xFF ^ 0xFF = 0', () => {
    const prog = [OP.LDI, 0xFF, OP.XOR, 6, OP.HLT, 0, 0xFF];
    const cpu = runProgram(prog);
    expect(cpu.A, 0, 'A = 0');
    expect(cpu.ZF, 1, 'ZF = 1');
  }),

  makeTest('XOR: 0xAA ^ 0x55 = 0xFF', () => {
    const prog = [OP.LDI, 0xAA, OP.XOR, 6, OP.HLT, 0, 0x55];
    const cpu = runProgram(prog);
    expect(cpu.A, 0xFF, 'A = 0xFF');
  }),

  // ── Group 4: Shifts ──
  makeTest('SHL: 0x01 << 1 = 0x02', () => {
    const prog = [OP.LDI, 1, OP.SHL, OP.HLT];
    const cpu = runProgram(prog);
    expect(cpu.A, 2, 'A = 2');
  }),

  makeTest('SHL: 0x40 << 1 = 0x80', () => {
    const prog = [OP.LDI, 0x40, OP.SHL, OP.HLT];
    const cpu = runProgram(prog);
    expect(cpu.A, 0x80, 'A = 0x80');
  }),

  makeTest('SHL: 0x80 << 1 = 0x00, CF set (msb shifted out)', () => {
    const prog = [OP.LDI, 0x80, OP.SHL, OP.HLT];
    const cpu = runProgram(prog);
    expect(cpu.A, 0, 'A = 0');
    expect(cpu.CF, 1, 'CF = 1');
    expect(cpu.ZF, 1, 'ZF = 1');
  }),

  makeTest('SHR: 0x02 >> 1 = 0x01', () => {
    const prog = [OP.LDI, 2, OP.SHR, OP.HLT];
    const cpu = runProgram(prog);
    expect(cpu.A, 1, 'A = 1');
  }),

  makeTest('SHR: 0x01 >> 1 = 0x00, CF set (lsb shifted out)', () => {
    const prog = [OP.LDI, 1, OP.SHR, OP.HLT];
    const cpu = runProgram(prog);
    expect(cpu.A, 0, 'A = 0');
    expect(cpu.CF, 1, 'CF = 1');
  }),

  // ── Group 5: Compare ──
  makeTest('CMP equal: ZF set, A unchanged', () => {
    const prog = [OP.LDI, 7, OP.CMP, 6, OP.HLT, 0, 7];
    const cpu = runProgram(prog);
    expect(cpu.A, 7, 'A still 7');
    expect(cpu.ZF, 1, 'ZF = 1 (equal)');
  }),

  makeTest('CMP greater: ZF=0, CF=1 (A>=B, no borrow)', () => {
    const prog = [OP.LDI, 10, OP.CMP, 6, OP.HLT, 0, 5];
    const cpu = runProgram(prog);
    expect(cpu.A, 10, 'A still 10');
    expect(cpu.ZF, 0, 'ZF = 0');
    expect(cpu.CF, 1, 'CF = 1 (no borrow, A>=B)');
  }),

  makeTest('CMP less: ZF=0, CF=0 (A<B, borrow needed)', () => {
    const prog = [OP.LDI, 3, OP.CMP, 6, OP.HLT, 0, 5];
    const cpu = runProgram(prog);
    expect(cpu.A, 3, 'A still 3');
    expect(cpu.ZF, 0, 'ZF = 0');
    expect(cpu.CF, 0, 'CF = 0 (borrow, A<B)');
  }),

  // ── Group 6: Jumps ──
  makeTest('JMP unconditional', () => {
    // [0] LDI 1, [2] JMP 6, [4] LDI 99, [6] HLT
    // If JMP works, A stays 1. If broken, A becomes 99.
    const prog = [OP.LDI, 1, OP.JMP, 6, OP.LDI, 99, OP.HLT];
    const cpu = runProgram(prog);
    expect(cpu.A, 1, 'A = 1 (JMP skipped LDI 99)');
  }),

  makeTest('JZ taken when ZF=1', () => {
    // CMP 0 with 0 → ZF=1 → JZ jumps to HLT, skipping LDI 99
    // [0]LDI [1]0 [2]CMP [3]10 [4]JZ [5]9 [6]LDI [7]99 [8]HLT [9]HLT [10]0
    const prog = [OP.LDI, 0, OP.CMP, 10, OP.JZ, 9, OP.LDI, 99, OP.HLT, OP.HLT, 0];
    const cpu = runProgram(prog);
    expect(cpu.A, 0, 'A = 0 (JZ jumped, skipped LDI 99)');
  }),

  makeTest('JZ NOT taken when ZF=0', () => {
    // CMP 5 with 3 → ZF=0 → JZ does NOT jump → falls through to LDI 99
    const prog = [OP.LDI, 5, OP.CMP, 10, OP.JZ, 9, OP.LDI, 99, OP.HLT, OP.HLT, 3];
    const cpu = runProgram(prog);
    expect(cpu.A, 99, 'A = 99 (JZ did not jump)');
  }),

  makeTest('JNZ taken when ZF=0', () => {
    // CMP 5 with 3 → ZF=0 → JNZ jumps to HLT, skipping LDI 99
    const prog = [OP.LDI, 5, OP.CMP, 10, OP.JNZ, 9, OP.LDI, 99, OP.HLT, OP.HLT, 3];
    const cpu = runProgram(prog);
    expect(cpu.A, 5, 'A = 5 (JNZ jumped, skipped LDI 99)');
  }),

  makeTest('JNZ NOT taken when ZF=1', () => {
    // CMP equal → ZF=1 → JNZ should NOT jump → falls through to LDI 99
    // [0]LDI [1]0 [2]CMP [3]10 [4]JNZ [5]9 [6]LDI [7]99 [8]HLT [9]_pad [10]0
    const prog = [OP.LDI, 0, OP.CMP, 10, OP.JNZ, 9, OP.LDI, 99, OP.HLT, 0, 0];
    const cpu = runProgram(prog);
    expect(cpu.A, 99, 'A = 99 (JNZ did not jump, fell through to LDI 99)');
  }),

  makeTest('JC taken when CF=1 (after ADD overflow)', () => {
    // 200 + 100 = 300 → 44 with overflow CF=1 → JC jumps to HLT (skipping LDI 99)
    // [0]LDI [1]200 [2]ADD [3]10 [4]JC [5]9 [6]LDI [7]99 [8]HLT [9]HLT [10]100
    const prog = [OP.LDI, 200, OP.ADD, 10, OP.JC, 9, OP.LDI, 99, OP.HLT, OP.HLT, 100];
    const cpu = runProgram(prog);
    expect(cpu.A, 44, 'A = 44 (JC jumped, skipped LDI 99)');
  }),

  makeTest('JC NOT taken when CF=0 (no overflow)', () => {
    // 5 + 0 = 5, no overflow CF=0 → JC does NOT jump → falls through to LDI 99
    const prog = [OP.LDI, 5, OP.ADD, 10, OP.JC, 9, OP.LDI, 99, OP.HLT, OP.HLT, 0];
    const cpu = runProgram(prog);
    expect(cpu.A, 99, 'A = 99 (JC did not jump)');
  }),

  makeTest('JNC taken when CF=0 (no overflow)', () => {
    // 5 + 0 = 5, no overflow CF=0 → JNC jumps to HLT (skipping LDI 99)
    const prog = [OP.LDI, 5, OP.ADD, 10, OP.JNC, 9, OP.LDI, 99, OP.HLT, OP.HLT, 0];
    const cpu = runProgram(prog);
    expect(cpu.A, 5, 'A = 5 (JNC jumped, skipped LDI 99)');
  }),

  makeTest('JNC NOT taken when CF=1 (overflow)', () => {
    // 200 + 100 = overflow → CF=1 → JNC does NOT jump → falls through to LDI 99
    const prog = [OP.LDI, 200, OP.ADD, 10, OP.JNC, 9, OP.LDI, 99, OP.HLT, OP.HLT, 100];
    const cpu = runProgram(prog);
    expect(cpu.A, 99, 'A = 99 (JNC did not jump)');
  }),

  // ── Group 7: Output ──
  makeTest('OUT writes A to OUT register', () => {
    const prog = [OP.LDI, 42, OP.OUT, OP.HLT];
    const cpu = runProgram(prog);
    expect(cpu.OUT, 42, 'OUT = 42');
    expect(cpu.A, 42, 'A still 42');
  }),

  // ── Group 8: HLT ──
  makeTest('HLT stops the clock', () => {
    const prog = [OP.HLT, OP.LDI, 99]; // LDI should NEVER execute
    const cpu = runProgram(prog);
    expect(cpu.halted, true, 'halted');
    expect(cpu.A, 0, 'A unchanged (LDI 99 not executed)');
  }),

  // ── Group 9: Stack ──
  makeTest('PUSH stores A on stack, decrements SP', () => {
    const cpu = runProgram([OP.LDI, 42, OP.PUSH, OP.HLT]);
    expect(cpu.RAM[0xFF], 42, 'RAM[0xFF] = 42');
    expect(cpu.SP, 0xFE, 'SP decremented');
    expect(cpu.A, 42, 'A still 42');
  }),

  makeTest('POP retrieves value, increments SP', () => {
    // PUSH 99, LDI 0, POP, HLT
    const cpu = runProgram([OP.LDI, 99, OP.PUSH, OP.LDI, 0, OP.POP, OP.HLT]);
    expect(cpu.A, 99, 'A = 99 (popped back)');
    expect(cpu.SP, 0xFF, 'SP back at top');
  }),

  makeTest('PUSH/POP LIFO order', () => {
    // PUSH 5, PUSH 10, POP→A, expect A=10
    const cpu = runProgram([
      OP.LDI, 5, OP.PUSH,
      OP.LDI, 10, OP.PUSH,
      OP.POP,
      OP.HLT
    ]);
    expect(cpu.A, 10, 'A = 10 (last in, first out)');
  }),

  // ── Group 10: Input ──
  makeTest('IN reads INPUT register into A', () => {
    const cpu = runProgram([OP.IN, OP.HLT], { input: 73 });
    expect(cpu.A, 73, 'A = INPUT');
  }),

  // ── Group 11: Real programs ──
  makeTest('Program: 5 + 3 = 8 with output', () => {
    const prog = [
      OP.LDI, 5,        // [0,1] A = 5
      OP.ADD, 8,        // [2,3] A = A + RAM[8]
      OP.OUT,           // [4] OUT = A
      OP.HLT,           // [5]
      0, 0,             // [6,7] padding
      3,                // [8] data = 3
    ];
    const cpu = runProgram(prog);
    expect(cpu.A, 8, 'A = 8');
    expect(cpu.OUT, 8, 'OUT = 8');
  }),

  makeTest('Program: count loop 0→5', () => {
    // Loop: A=0; loop: A++; if A!=5 jmp loop; OUT; HLT
    // Use ADD with self-incrementing trick: LDI 0, then add 1 in a loop
    // Simpler: LDI 0 ; loop: ADD one ; CMP five ; JNZ loop ; OUT ; HLT
    const prog = [
      OP.LDI, 0,        // [0] A = 0
      OP.ADD, 13,       // [2] A += 1   (loop start at addr 2)
      OP.CMP, 14,       // [4] compare A with 5
      OP.JNZ, 2,        // [6] if not equal, jump back to loop
      OP.OUT,           // [8] output
      OP.HLT,           // [9]
      0, 0, 0,          // padding
      1,                // [13] = 1
      5,                // [14] = 5
    ];
    const cpu = runProgram(prog);
    expect(cpu.A, 5, 'A = 5 (loop exited)');
    expect(cpu.OUT, 5, 'OUT = 5');
  }),

  makeTest('Program: function call (CALL/RET)', () => {
    // Main: LDI 7, CALL func, OUT, HLT
    // func: ADD imm, RET    where imm=3 (so func adds 3 to A)
    // Func reads value from RAM[15]
    const prog = [
      OP.LDI, 7,         // [0] A = 7
      OP.CALL, 10,       // [2] call function at addr 10 (return addr = 4)
      OP.OUT,            // [4] OUT = A
      OP.HLT,            // [5]
      0, 0, 0, 0,        // padding
      OP.ADD, 14,        // [10] func: A += RAM[14]
      OP.RET,            // [12] return
      0,                 // padding
      3,                 // [14] = 3
    ];
    const cpu = runProgram(prog);
    expect(cpu.A, 10, 'A = 7+3 (function added 3)');
    expect(cpu.OUT, 10, 'OUT = 10');
    expect(cpu.SP, 0xFF, 'SP back at top after RET');
  }),

  makeTest('Program: nested function calls', () => {
    // main: LDI 1, CALL A, OUT, HLT
    // A: ADD one, CALL B, RET
    // B: ADD one, RET
    // Result: 1 + 1 + 1 = 3
    const prog = [
      OP.LDI, 1,         // [0] A = 1
      OP.CALL, 8,        // [2] call A
      OP.OUT,            // [4]
      OP.HLT,            // [5]
      0, 0,              // padding
      OP.ADD, 19,        // [8] A: A += 1
      OP.CALL, 14,       // [10] call B
      OP.RET,            // [12] A returns
      0,                 // padding
      OP.ADD, 19,        // [14] B: A += 1
      OP.RET,            // [16] B returns
      0, 0,              // padding
      1,                 // [19] = 1
    ];
    const cpu = runProgram(prog);
    expect(cpu.A, 3, 'A = 1+1+1 (nested calls each added 1)');
    expect(cpu.SP, 0xFF, 'SP back at top after both RETs');
  }),

  // ── Group 12: PC behavior ──
  makeTest('PC increments past 2-byte instructions correctly', () => {
    // 3 LDI instructions back to back
    const prog = [
      OP.LDI, 1,    // [0]
      OP.LDI, 2,    // [2]
      OP.LDI, 3,    // [4]
      OP.HLT,       // [6]
    ];
    const cpu = runProgram(prog);
    expect(cpu.A, 3, 'A = 3 (last LDI ran)');
    expect(cpu.PC, 7, 'PC past HLT');
  }),

  makeTest('Mix of 1-byte and 2-byte instructions', () => {
    // LDI 5, SHL (1 byte), LDI 7 — A should end up 7
    const prog = [OP.LDI, 5, OP.SHL, OP.LDI, 7, OP.HLT];
    const cpu = runProgram(prog);
    expect(cpu.A, 7, 'A = 7 (last LDI)');
  }),
];

// ─────────────────────────────────────────────
//  RUNNER
// ─────────────────────────────────────────────

function runAllCPUTests() {
  const results = { passed: 0, failed: 0, total: CPU_TESTS.length, tests: [] };
  for (const test of CPU_TESTS) {
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

// ─────────────────────────────────────────────
//  UI: render results as an HTML element
// ─────────────────────────────────────────────

function renderTestResults(results) {
  const root = document.createElement('div');
  root.style.cssText = 'font-family:monospace;font-size:12px;padding:12px;background:#0a0e1a;color:#cde;border-radius:6px;max-height:600px;overflow-y:auto;';

  const summary = document.createElement('div');
  const allPass = results.failed === 0;
  summary.style.cssText = `padding:10px;margin-bottom:12px;border-radius:4px;font-size:14px;font-weight:600;background:${allPass ? '#0a3a1a' : '#3a0a0a'};color:${allPass ? '#00ff88' : '#ff6666'};`;
  summary.textContent = `${results.passed}/${results.total} passed${results.failed ? ` — ${results.failed} FAILED` : ' — ALL TESTS PASS ✓'}`;
  root.appendChild(summary);

  for (const t of results.tests) {
    const row = document.createElement('div');
    row.style.cssText = `padding:6px 10px;border-left:3px solid ${t.passed ? '#00ff88' : '#ff4444'};margin-bottom:3px;background:${t.passed ? '#0a1a14' : '#1a0a0a'};`;
    const icon = document.createElement('span');
    icon.textContent = t.passed ? '✓ ' : '✗ ';
    icon.style.cssText = `color:${t.passed ? '#00ff88' : '#ff4444'};font-weight:700;margin-right:6px;`;
    row.appendChild(icon);
    const name = document.createElement('span');
    name.textContent = t.name;
    name.style.color = t.passed ? '#cde' : '#fcc';
    row.appendChild(name);
    if (t.error) {
      const err = document.createElement('div');
      err.textContent = '  → ' + t.error;
      err.style.cssText = 'color:#ff8888;font-size:11px;margin-top:4px;margin-left:18px;';
      row.appendChild(err);
    }
    root.appendChild(row);
  }
  return root;
}

// ─────────────────────────────────────────────
//  EXPOSE
// ─────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.runAllCPUTests = runAllCPUTests;
  window.renderTestResults = renderTestResults;
  window.CPU_TESTS = CPU_TESTS;

  // Wire the Run All Tests button (browser only)
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-run-tests');
    const out = document.getElementById('tests-results');
    if (!btn || !out) return;

    function runAndRender() {
      out.innerHTML = '<div style="color:#888;padding:8px;">Running tests...</div>';
      setTimeout(() => {
        out.innerHTML = '';
        // CPU tests
        const cpuHeader = document.createElement('h4');
        cpuHeader.textContent = 'CPU Engine Tests';
        cpuHeader.style.cssText = 'color:#4a8;margin:0 0 8px 0;font-family:monospace;';
        out.appendChild(cpuHeader);
        const cpuResults = runAllCPUTests();
        out.appendChild(renderTestResults(cpuResults));

        // Breadboard tests (if available)
        if (typeof runAllBBTests === 'function') {
          const bbHeader = document.createElement('h4');
          bbHeader.textContent = 'Breadboard Component Tests';
          bbHeader.style.cssText = 'color:#4a8;margin:16px 0 8px 0;font-family:monospace;';
          out.appendChild(bbHeader);
          const bbResults = runAllBBTests();
          out.appendChild(renderTestResults(bbResults));
        }
      }, 50);
    }

    btn.addEventListener('click', runAndRender);

    // Also auto-run when the Tests tab is clicked the first time
    let firstView = true;
    document.querySelectorAll('.tab-btn').forEach(b => {
      if (b.dataset.tab === 'tests') {
        b.addEventListener('click', () => {
          if (firstView) { firstView = false; runAndRender(); }
        });
      }
    });
  });
}
