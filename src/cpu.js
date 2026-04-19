/**
 * 8-bit CPU Simulator - Core Engine (Enhanced)
 * Extended SAP-1 with 256-byte RAM, stack, more ALU ops, interrupts
 *
 * Architecture:
 *   - 8-bit data bus
 *   - 8-bit address bus (256 bytes of RAM)
 *   - Program Counter (8-bit)
 *   - Memory Address Register (MAR, 8-bit)
 *   - Stack Pointer (SP, 8-bit, starts at 0xFF)
 *   - RAM (256 x 8-bit)
 *   - Instruction Register (IR, 8-bit opcode)
 *   - A Register (8-bit accumulator)
 *   - B Register (8-bit)
 *   - Input Register (8-bit, user-settable)
 *   - ALU (add, sub, and, or, xor, shl, shr)
 *   - Flags Register (CF, ZF)
 *   - Output Register (8-bit)
 *   - 2-byte instruction format: opcode byte + optional operand byte
 */

// ─────────────────────────────────────────────
//  CONTROL SIGNAL DEFINITIONS
// ─────────────────────────────────────────────

const CS = {
  HLT:  1 << 0,   // Halt clock
  MI:   1 << 1,   // Memory Address Register In
  RI:   1 << 2,   // RAM In (write to RAM)
  RO:   1 << 3,   // RAM Out (read from RAM to bus)
  II:   1 << 4,   // Instruction Register In
  AI:   1 << 5,   // A Register In
  AO:   1 << 6,   // A Register Out
  EO:   1 << 7,   // ALU/Sum Out (ALU result to bus)
  SU:   1 << 8,   // Subtract (ALU subtract mode)
  BI:   1 << 9,   // B Register In
  OI:   1 << 10,  // Output Register In
  CE:   1 << 11,  // Counter Enable (PC increment)
  CO:   1 << 12,  // Counter Out (PC to address bus)
  J:    1 << 13,  // Jump (load PC from bus)
  FI:   1 << 14,  // Flags Register In
  SPO:  1 << 15,  // Stack Pointer Out
  SPI:  1 << 16,  // Stack Pointer In
  SPD:  1 << 17,  // Stack Pointer Decrement
  SPUP: 1 << 18,  // Stack Pointer Increment (up)
  INO:  1 << 19,  // Input Register Out
  ANDI: 1 << 20,  // ALU AND mode
  ORI:  1 << 21,  // ALU OR mode
  XORI: 1 << 22,  // ALU XOR mode
  SHLI: 1 << 23,  // ALU Shift Left
  SHRI: 1 << 24,  // ALU Shift Right
  PCI:  1 << 25,  // PC In (for CALL/RET — load PC from RAM)
  BO:   1 << 26,  // B Register Out
};

const CS_NAMES = {};
for (const k of Object.keys(CS)) CS_NAMES[k] = k;

// ─────────────────────────────────────────────
//  FETCH CYCLE (shared T0, T1)
// ─────────────────────────────────────────────
// T0: CO|MI  — PC to address bus, MAR latches
// T1: RO|II|CE — RAM[MAR] → IR, PC++
const FETCH = [
  CS.CO | CS.MI,
  CS.RO | CS.II | CS.CE,
];

// ─────────────────────────────────────────────
//  INSTRUCTION SET  (opcodes 0x00–0x19)
// ─────────────────────────────────────────────
// bytes: 1 = single byte (no operand fetch), 2 = two bytes (fetch operand next)
// For 2-byte instructions, T2 fetches the operand byte from RAM into a temp
// register we'll handle in the execution engine.

const INSTRUCTIONS = {

  NOP: {
    opcode: 0x00, mnemonic: 'NOP', bytes: 1,
    description: 'No operation — CPU idles one instruction cycle.',
    microcode: [...FETCH, 0],
  },

  LDA: {
    opcode: 0x01, mnemonic: 'LDA', bytes: 2,
    description: 'Load A from memory: A ← RAM[addr]',
    // T2: CO|MI  fetch operand byte (address) from PC
    // T3: RO     operand lands in OPERAND register, CE
    // T4: MI     operand → MAR
    // T5: RO|AI  RAM[MAR] → A
    microcode: [
      ...FETCH,
      CS.CO | CS.MI,        // T2 fetch operand address
      CS.RO | CS.MI | CS.CE, // T3 operand→MAR, PC++   (reuse MI trick)
      CS.RO | CS.AI,        // T4 RAM[addr] → A
    ],
  },

  ADD: {
    opcode: 0x02, mnemonic: 'ADD', bytes: 2,
    description: 'Add: A ← A + RAM[addr], update CF/ZF',
    microcode: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.RO | CS.MI | CS.CE,
      CS.RO | CS.BI,
      CS.EO | CS.AI | CS.FI,
    ],
  },

  SUB: {
    opcode: 0x03, mnemonic: 'SUB', bytes: 2,
    description: 'Subtract: A ← A − RAM[addr], update CF/ZF',
    microcode: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.RO | CS.MI | CS.CE,
      CS.RO | CS.BI,
      CS.EO | CS.AI | CS.SU | CS.FI,
    ],
  },

  STA: {
    opcode: 0x04, mnemonic: 'STA', bytes: 2,
    description: 'Store A to memory: RAM[addr] ← A',
    microcode: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.RO | CS.MI | CS.CE,
      CS.AO | CS.RI,
    ],
  },

  LDI: {
    opcode: 0x05, mnemonic: 'LDI', bytes: 2,
    description: 'Load immediate: A ← imm (8-bit)',
    microcode: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.RO | CS.AI | CS.CE,  // immediate byte → A, PC++
    ],
  },

  JMP: {
    opcode: 0x06, mnemonic: 'JMP', bytes: 2,
    description: 'Unconditional jump: PC ← addr',
    microcode: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.RO | CS.J,           // addr byte → PC (no CE, we jump instead)
    ],
  },

  JC: {
    opcode: 0x07, mnemonic: 'JC', bytes: 2,
    description: 'Jump if carry: if CF=1 then PC ← addr',
    microcode: null,
    microcode_cf0: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.CE,                  // skip operand, just advance PC
    ],
    microcode_cf1: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.RO | CS.J,
    ],
  },

  JZ: {
    opcode: 0x08, mnemonic: 'JZ', bytes: 2,
    description: 'Jump if zero: if ZF=1 then PC ← addr',
    microcode: null,
    microcode_zf0: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.CE,
    ],
    microcode_zf1: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.RO | CS.J,
    ],
  },

  AND: {
    opcode: 0x09, mnemonic: 'AND', bytes: 2,
    description: 'Bitwise AND: A ← A & RAM[addr]',
    microcode: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.RO | CS.MI | CS.CE,
      CS.RO | CS.BI,
      CS.EO | CS.AI | CS.ANDI | CS.FI,
    ],
  },

  OR: {
    opcode: 0x0A, mnemonic: 'OR', bytes: 2,
    description: 'Bitwise OR: A ← A | RAM[addr]',
    microcode: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.RO | CS.MI | CS.CE,
      CS.RO | CS.BI,
      CS.EO | CS.AI | CS.ORI | CS.FI,
    ],
  },

  XOR: {
    opcode: 0x0B, mnemonic: 'XOR', bytes: 2,
    description: 'Bitwise XOR: A ← A ^ RAM[addr]',
    microcode: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.RO | CS.MI | CS.CE,
      CS.RO | CS.BI,
      CS.EO | CS.AI | CS.XORI | CS.FI,
    ],
  },

  SHL: {
    opcode: 0x0C, mnemonic: 'SHL', bytes: 1,
    description: 'Shift left: A ← A << 1, CF = shifted-out bit',
    microcode: [
      ...FETCH,
      CS.EO | CS.AI | CS.SHLI | CS.FI,
    ],
  },

  SHR: {
    opcode: 0x0D, mnemonic: 'SHR', bytes: 1,
    description: 'Shift right: A ← A >> 1, CF = shifted-out bit',
    microcode: [
      ...FETCH,
      CS.EO | CS.AI | CS.SHRI | CS.FI,
    ],
  },

  OUT: {
    opcode: 0x0E, mnemonic: 'OUT', bytes: 1,
    description: 'Output A to display: OUT ← A',
    microcode: [
      ...FETCH,
      CS.AO | CS.OI,
    ],
  },

  HLT: {
    opcode: 0x0F, mnemonic: 'HLT', bytes: 1,
    description: 'Halt the CPU clock.',
    microcode: [
      ...FETCH,
      CS.HLT,
    ],
  },

  PUSH: {
    opcode: 0x10, mnemonic: 'PUSH', bytes: 1,
    description: 'Push A onto stack: RAM[SP] ← A; SP--',
    // T2: SPO|MI   SP → MAR
    // T3: AO|RI    A → RAM[SP]
    // T4: SPD      SP--
    microcode: [
      ...FETCH,
      CS.SPO | CS.MI,
      CS.AO | CS.RI,
      CS.SPD,
    ],
  },

  POP: {
    opcode: 0x11, mnemonic: 'POP', bytes: 1,
    description: 'Pop from stack into A: SP++; A ← RAM[SP]',
    // T2: SPUP     SP++
    // T3: SPO|MI   SP → MAR
    // T4: RO|AI    RAM[SP] → A
    microcode: [
      ...FETCH,
      CS.SPUP,
      CS.SPO | CS.MI,
      CS.RO | CS.AI,
    ],
  },

  CALL: {
    opcode: 0x12, mnemonic: 'CALL', bytes: 2,
    description: 'Call subroutine: push PC return addr; PC ← addr',
    // Handled entirely in software in step() — CALL_EXEC flag
    // T2: fetch operand address byte into MAR, save target addr in B, PC advances past operand
    // T3: RAM[SP] = return PC; SP--; PC = target
    microcode: [
      ...FETCH,
      CS.CO | CS.MI,          // T2: point MAR at operand byte
      CS.RO | CS.BI | CS.CE, // T3: target addr → B, PC++ (return addr now in PC)
      CS.SPO | CS.MI,         // T4: SP → MAR (address stack top)
      CS.CO | CS.RI,          // T5: PC (return addr) → RAM[SP]  (CO=data bus=PC, RI=write)
      CS.SPD,                 // T6: SP--
      CS.BO | CS.J,           // T7: B (target) → PC
    ],
  },

  RET: {
    opcode: 0x13, mnemonic: 'RET', bytes: 1,
    description: 'Return from subroutine: pop PC',
    // T2: SPUP     SP++
    // T3: SPO|MI   SP → MAR
    // T4: RO|J     RAM[SP] → PC
    microcode: [
      ...FETCH,
      CS.SPUP,
      CS.SPO | CS.MI,
      CS.RO | CS.J,
    ],
  },

  IN: {
    opcode: 0x14, mnemonic: 'IN', bytes: 1,
    description: 'Load input register into A: A ← INPUT',
    microcode: [
      ...FETCH,
      CS.INO | CS.AI,
    ],
  },

  RTI: {
    opcode: 0x15, mnemonic: 'RTI', bytes: 1,
    description: 'Return from interrupt: pop flags then pop PC',
    microcode: [
      ...FETCH,
      CS.SPUP,
      CS.SPO | CS.MI,
      CS.RO | CS.AI,   // restore flags via A (simplified)
      CS.SPUP,
      CS.SPO | CS.MI,
      CS.RO | CS.J,
    ],
  },

  JNZ: {
    opcode: 0x16, mnemonic: 'JNZ', bytes: 2,
    description: 'Jump if not zero: if ZF=0 then PC ← addr',
    microcode: null,
    microcode_zf0: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.RO | CS.J,
    ],
    microcode_zf1: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.CE,
    ],
  },

  JNC: {
    opcode: 0x17, mnemonic: 'JNC', bytes: 2,
    description: 'Jump if no carry: if CF=0 then PC ← addr',
    microcode: null,
    microcode_cf0: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.RO | CS.J,
    ],
    microcode_cf1: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.CE,
    ],
  },

  LDB: {
    opcode: 0x18, mnemonic: 'LDB', bytes: 2,
    description: 'Load immediate into B: B ← imm',
    microcode: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.RO | CS.BI | CS.CE,
    ],
  },

  CMP: {
    opcode: 0x19, mnemonic: 'CMP', bytes: 2,
    description: 'Compare A with RAM[addr]: set flags, do not store result',
    microcode: [
      ...FETCH,
      CS.CO | CS.MI,
      CS.RO | CS.MI | CS.CE,
      CS.RO | CS.BI,
      CS.EO | CS.SU | CS.FI,  // ALU A-B, update flags only (no AI)
    ],
  },
};

// Build opcode → instruction lookup
const OPCODE_TABLE = {};
for (const [name, instr] of Object.entries(INSTRUCTIONS)) {
  OPCODE_TABLE[instr.opcode] = { name, ...instr };
}

// ─────────────────────────────────────────────
//  CPU STATE
// ─────────────────────────────────────────────

class CPU {
  constructor() {
    this.reset();
  }

  reset() {
    this.PC  = 0;
    this.MAR = 0;
    this.IR  = 0;
    this.A   = 0;
    this.B   = 0;
    this.SP  = 0xFF;   // Stack pointer — starts at top of RAM
    this.OUT = 0;
    this.ALU = 0;
    this.INPUT = 0;   // User-settable input register

    this.CF = 0;
    this.ZF = 0;

    this.addressBus = 0;
    this.dataBus    = 0;
    this.busDriver  = 'none';

    // 256-byte RAM
    this.RAM = new Uint8Array(256);

    this.halted       = false;
    this.tState       = 0;
    this.clockCycles  = 0;
    this.instrCount   = 0;
    this.currentOpcode     = 0;
    this.currentInstrName  = 'NOP';
    this.controlWord       = 0;
    this.busContention     = false;

    // Interrupt support
    this.interruptPending  = false;
    this.interruptVector   = 0xF0;
    this.inInterrupt       = false;

    // Breakpoints: Set<number>
    this.breakpoints = new Set();

    // Execution history
    this.history = [];
    this.maxHistory = 500;
  }

  loadProgram(bytes) {
    this.RAM = new Uint8Array(256);
    for (let i = 0; i < Math.min(bytes.length, 256); i++) {
      this.RAM[i] = bytes[i] & 0xFF;
    }
  }

  writeRAM(address, value) {
    this.RAM[address & 0xFF] = value & 0xFF;
  }

  setInput(value) {
    this.INPUT = value & 0xFF;
  }

  triggerInterrupt() {
    this.interruptPending = true;
  }

  toggleBreakpoint(addr) {
    if (this.breakpoints.has(addr)) {
      this.breakpoints.delete(addr);
    } else {
      this.breakpoints.add(addr);
    }
  }

  // ─────────────────────────────────
  //  MICROCODE LOOKUP
  // ─────────────────────────────────
  getMicrocode() {
    const instr = OPCODE_TABLE[this.IR];
    if (!instr) return [...FETCH, 0];

    const name = instr.name;
    if (name === 'JC')  return this.CF ? instr.microcode_cf1  : instr.microcode_cf0;
    if (name === 'JZ')  return this.ZF ? instr.microcode_zf1  : instr.microcode_zf0;
    if (name === 'JNZ') return this.ZF ? instr.microcode_zf1  : instr.microcode_zf0;
    if (name === 'JNC') return this.CF ? instr.microcode_cf1  : instr.microcode_cf0;

    return instr.microcode || [...FETCH, 0];
  }

  // ─────────────────────────────────
  //  SINGLE MICRO-STEP
  // ─────────────────────────────────
  step() {
    if (this.halted) {
      return this.captureState('HALTED — press Reset to continue');
    }

    // Handle interrupt between instructions (at T0)
    if (this.tState === 0 && this.interruptPending && !this.inInterrupt) {
      this.interruptPending = false;
      this.inInterrupt = true;
      // Push return address (PC) onto stack
      this.RAM[this.SP] = this.PC & 0xFF;
      this.SP = (this.SP - 1) & 0xFF;
      // Push flags
      const flagByte = (this.CF << 1) | this.ZF;
      this.RAM[this.SP] = flagByte;
      this.SP = (this.SP - 1) & 0xFF;
      // Jump to interrupt vector
      this.PC = this.interruptVector;
      this._syncBus();
      const st = this.captureState('INTERRUPT: saved PC + flags, jumped to vector 0x' + toHex2(this.interruptVector));
      this.history.push(st);
      if (this.history.length > this.maxHistory) this.history.shift();
      this.clockCycles++;
      return st;
    }

    // Check breakpoint at T0
    if (this.tState === 0 && this.breakpoints.has(this.PC) && !this._justHitBreak) {
      this._justHitBreak = true;
      return this.captureState(`BREAKPOINT at 0x${toHex2(this.PC)} — step to continue`);
    }
    this._justHitBreak = false;

    const microcode = this.getMicrocode();
    const t = this.tState;

    if (t >= microcode.length) {
      this.tState = 0;
      return this.step();
    }

    const cw = microcode[t];
    this.controlWord = cw;

    // Bus contention check
    const driverCount = [CS.CO, CS.RO, CS.AO, CS.EO, CS.INO, CS.SPO, CS.BO]
      .filter(m => cw & m).length;
    this.busContention = driverCount > 1;

    // ── PHASE 1: Address bus ──
    if (cw & CS.CO)  this.addressBus = this.PC & 0xFF;
    if (cw & CS.SPO) this.addressBus = this.SP & 0xFF;

    // ── PHASE 2: Data bus ──
    this.busDriver = 'none';
    if (cw & CS.CO) {
      this.dataBus   = this.PC & 0xFF;
      this.addressBus = this.PC & 0xFF;
      this.busDriver = 'PC';
    }
    if (cw & CS.RO) {
      this.dataBus   = this.RAM[this.MAR & 0xFF];
      this.busDriver = 'RAM';
    }
    if (cw & CS.AO) {
      this.dataBus   = this.A;
      this.busDriver = 'A';
    }
    if (cw & CS.BO) {
      this.dataBus   = this.B;
      this.busDriver = 'B';
    }
    if (cw & CS.INO) {
      this.dataBus   = this.INPUT;
      this.busDriver = 'INPUT';
    }
    if (cw & CS.SPO) {
      this.dataBus   = this.SP & 0xFF;
      this.addressBus = this.SP & 0xFF;
      this.busDriver = 'SP';
    }
    if (cw & CS.EO) {
      this._computeALU(cw);
      this.dataBus   = this.ALU;
      this.busDriver = 'ALU';
    }

    // ── PHASE 3: Load from bus ──
    if (cw & CS.MI)  this.MAR = this.dataBus & 0xFF;
    if (cw & CS.II) {
      this.IR = this.dataBus & 0xFF;
      const instrDef = OPCODE_TABLE[this.IR];
      this.currentOpcode    = this.IR;
      this.currentInstrName = instrDef ? instrDef.name : '???';
    }
    if (cw & CS.AI)  this.A  = this.dataBus & 0xFF;
    if (cw & CS.BI)  this.B  = this.dataBus & 0xFF;
    if (cw & CS.OI)  this.OUT = this.dataBus & 0xFF;
    if (cw & CS.RI)  this.RAM[this.MAR & 0xFF] = this.dataBus & 0xFF;
    if (cw & CS.J)   this.PC  = this.dataBus & 0xFF;
    if (cw & CS.CE)  this.PC  = (this.PC + 1) & 0xFF;
    if (cw & CS.SPD) this.SP  = (this.SP - 1) & 0xFF;
    if (cw & CS.SPUP)this.SP  = (this.SP + 1) & 0xFF;
    if (cw & CS.HLT) this.halted = true;

    // CALL instruction: override T4/T5 to push actual PC
    if (this.currentInstrName === 'CALL' && t === 4) {
      // Push the return PC (already incremented past operand at T3's CE)
      this.RAM[this.MAR & 0xFF] = this.PC & 0xFF;
      this.busDriver = 'PC';
      this.dataBus   = this.PC;
    }

    // Advance T-state
    this.tState++;
    const nextMicrocode = this.getMicrocode();
    if (this.tState >= nextMicrocode.length) {
      this.tState = 0;
      this.instrCount++;
      // Clear interrupt flag if we finished RTI
      if (this.currentInstrName === 'RTI') this.inInterrupt = false;
    }

    this.clockCycles++;

    const desc = this._describeStep(cw, t);
    const state = this.captureState(desc);
    this.history.push(state);
    if (this.history.length > this.maxHistory) this.history.shift();
    return state;
  }

  _computeALU(cw) {
    if (cw & CS.SHLI) {
      const shifted = (this.A << 1) & 0x1FF;
      this.ALU = shifted & 0xFF;
      if (cw & CS.FI) {
        this.CF = (this.A >> 7) & 1;
        this.ZF = this.ALU === 0 ? 1 : 0;
      }
    } else if (cw & CS.SHRI) {
      this.ALU = (this.A >> 1) & 0xFF;
      if (cw & CS.FI) {
        this.CF = this.A & 1;
        this.ZF = this.ALU === 0 ? 1 : 0;
      }
    } else if (cw & CS.ANDI) {
      this.ALU = (this.A & this.B) & 0xFF;
      if (cw & CS.FI) {
        this.CF = 0;
        this.ZF = this.ALU === 0 ? 1 : 0;
      }
    } else if (cw & CS.ORI) {
      this.ALU = (this.A | this.B) & 0xFF;
      if (cw & CS.FI) {
        this.CF = 0;
        this.ZF = this.ALU === 0 ? 1 : 0;
      }
    } else if (cw & CS.XORI) {
      this.ALU = (this.A ^ this.B) & 0xFF;
      if (cw & CS.FI) {
        this.CF = 0;
        this.ZF = this.ALU === 0 ? 1 : 0;
      }
    } else if (cw & CS.SU) {
      const result = (this.A - this.B) & 0x1FF;
      this.ALU = result & 0xFF;
      if (cw & CS.FI) {
        this.CF = this.A >= this.B ? 1 : 0;
        this.ZF = this.ALU === 0 ? 1 : 0;
      }
    } else {
      const result = (this.A + this.B) & 0x1FF;
      this.ALU = result & 0xFF;
      if (cw & CS.FI) {
        this.CF = result > 0xFF ? 1 : 0;
        this.ZF = this.ALU === 0 ? 1 : 0;
      }
    }
  }

  _syncBus() {
    this.addressBus = this.PC;
    this.dataBus    = 0;
    this.busDriver  = 'none';
  }

  stepInstruction() {
    if (this.halted) return [this.captureState('HALTED')];
    const states = [];
    do {
      states.push(this.step());
      if (this.halted) break;
    } while (this.tState !== 0);
    return states;
  }

  run(maxSteps = 100000) {
    const states = [];
    let steps = 0;
    while (!this.halted && steps < maxSteps) {
      // Stop at breakpoints in run mode
      if (this.tState === 0 && this.breakpoints.has(this.PC)) {
        states.push(this.captureState(`BREAKPOINT at 0x${toHex2(this.PC)}`));
        break;
      }
      states.push(this.step());
      steps++;
    }
    return states;
  }

  _describeStep(cw, t) {
    const parts = [];
    if (t === 0) parts.push('FETCH: PC → MAR');
    else if (t === 1) parts.push('FETCH: RAM→IR, PC++');
    else {
      const instr = OPCODE_TABLE[this.currentOpcode];
      if (instr) parts.push(`EXEC ${instr.name} T${t}`);
    }
    const active = getActiveSignals(cw);
    if (active.length) parts.push(`[${active.join('|')}]`);
    return parts.join(' ');
  }

  captureState(description = '') {
    return {
      PC:  this.PC, MAR: this.MAR, IR: this.IR,
      A:   this.A,  B:   this.B,   SP: this.SP,
      OUT: this.OUT, ALU: this.ALU, INPUT: this.INPUT,
      CF:  this.CF,  ZF:  this.ZF,
      addressBus:  this.addressBus,
      dataBus:     this.dataBus,
      busDriver:   this.busDriver,
      busContention: this.busContention,
      controlWord: this.controlWord,
      tState:      this.tState > 0 ? this.tState - 1 : (this.getMicrocode().length - 1),
      instrCount:  this.instrCount,
      clockCycles: this.clockCycles,
      halted:      this.halted,
      RAM:         Array.from(this.RAM),
      opcode:      this.currentOpcode,
      instrName:   this.currentInstrName,
      description: description,
      timestamp:   Date.now(),
      inInterrupt: this.inInterrupt,
      breakpoints: Array.from(this.breakpoints),
    };
  }

  decodeInstruction(byte) {
    const instr = OPCODE_TABLE[byte];
    if (instr) return instr.mnemonic;
    return `0x${toHex2(byte)}`;
  }
}

// ─────────────────────────────────────────────
//  UTILITY FUNCTIONS
// ─────────────────────────────────────────────

function toBin8(n)  { return (n & 0xFF).toString(2).padStart(8, '0'); }
function toBin4(n)  { return (n & 0xF).toString(2).padStart(4, '0'); }
function toHex2(n)  { return (n & 0xFF).toString(16).toUpperCase().padStart(2, '0'); }
function toHex1(n)  { return (n & 0xF).toString(16).toUpperCase(); }
function toDec(n)   { return (n & 0xFF).toString(); }

function getActiveSignals(cw) {
  return Object.entries(CS).filter(([,m]) => cw & m).map(([n]) => n);
}

function getAllSignals(cw) {
  return Object.entries(CS).map(([name, mask]) => ({ name, active: !!(cw & mask) }));
}

// Export
window.CPU          = CPU;
window.CS           = CS;
window.CS_NAMES     = CS_NAMES;
window.INSTRUCTIONS = INSTRUCTIONS;
window.OPCODE_TABLE = OPCODE_TABLE;
window.FETCH        = FETCH;
window.toBin8       = toBin8;
window.toBin4       = toBin4;
window.toHex2       = toHex2;
window.toHex1       = toHex1;
window.toDec        = toDec;
window.getActiveSignals = getActiveSignals;
window.getAllSignals     = getAllSignals;
