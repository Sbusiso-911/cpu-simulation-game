/**
 * 8-bit CPU Assembler — Enhanced for 2-byte instructions & 256-byte RAM
 *
 * Instruction format:
 *   1-byte instructions: just the opcode byte
 *   2-byte instructions: opcode byte, then operand byte (address or immediate)
 *
 * Supports:
 *   - Labels (e.g. "loop: LDA 0x20")
 *   - Comments: ; // #
 *   - Directives: .org <addr>, .byte <val>
 *   - Numeric literals: decimal (42), hex (0x2A or $2A), binary (0b101010)
 *   - All 26 opcodes in the new instruction set
 */

// toHex helpers (defined early, before cpu.js may have run)
function toHex1(n) { return (n & 0xF).toString(16).toUpperCase(); }
function toHex2(n) { return (n & 0xFF).toString(16).toUpperCase().padStart(2, '0'); }

class Assembler {
  constructor(instructionSet) {
    this.instrSet = {};
    for (const [name, def] of Object.entries(instructionSet)) {
      this.instrSet[name.toUpperCase()] = def;
    }
    this.errors   = [];
    this.warnings = [];
    this.listing  = [];
  }

  // ─────────────────────────────────────────
  //  PUBLIC: assemble source → byte array (256)
  // ─────────────────────────────────────────
  assemble(source) {
    this.errors   = [];
    this.warnings = [];
    this.listing  = [];

    const lines  = source.split('\n');
    const tokens = this._tokenize(lines);
    const { labels, pass1 } = this._firstPass(tokens);
    if (this.errors.length) return null;

    const bytes = this._secondPass(pass1, labels);
    if (this.errors.length) return null;
    return bytes;
  }

  // ─────────────────────────────────────────
  //  TOKENIZER
  // ─────────────────────────────────────────
  _tokenize(lines) {
    const result = [];
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      line = line.replace(/;.*$/, '');
      line = line.replace(/\/\/.*$/, '');
      line = line.replace(/#.*$/, '');
      line = line.trim();
      if (!line) continue;
      result.push({ raw: lines[i], line, lineNum: i + 1 });
    }
    return result;
  }

  // ─────────────────────────────────────────
  //  FIRST PASS: collect labels, sizes
  // ─────────────────────────────────────────
  _firstPass(tokens) {
    const labels = {};
    const pass1  = [];
    let   addr   = 0;

    for (const { raw, line, lineNum } of tokens) {
      let remaining = line;

      // Label
      const labelMatch = remaining.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*/);
      if (labelMatch) {
        const lname = labelMatch[1].toUpperCase();
        if (labels[lname] !== undefined) {
          this.errors.push(`Line ${lineNum}: Duplicate label '${labelMatch[1]}'`);
        }
        labels[lname] = addr;
        remaining = remaining.slice(labelMatch[0].length);
      }

      if (!remaining.trim()) continue;

      // Directive
      if (remaining.startsWith('.')) {
        const dirResult = this._handleDirective(remaining, addr, lineNum);
        if (dirResult) {
          pass1.push({ ...dirResult, lineNum, raw });
          addr = dirResult.nextAddr;
        }
        continue;
      }

      // Instruction
      const parts     = remaining.trim().split(/\s+/);
      const mnemonic  = parts[0].toUpperCase();
      const operandStr = parts[1] || null;

      const instrDef = this.instrSet[mnemonic];
      if (!instrDef) {
        this.errors.push(`Line ${lineNum}: Unknown mnemonic '${parts[0]}'`);
        continue;
      }

      const instrBytes = instrDef.bytes || 1;
      pass1.push({ type: 'instr', mnemonic, operandStr, instrDef, addr, lineNum, raw, instrBytes });
      addr += instrBytes;

      if (addr > 256) {
        this.errors.push(`Line ${lineNum}: Program exceeds 256 bytes of RAM`);
        break;
      }
    }

    return { labels, pass1 };
  }

  _handleDirective(line, addr, lineNum) {
    const parts = line.trim().split(/\s+/);
    const dir   = parts[0].toLowerCase();

    if (dir === '.org') {
      const newAddr = this._parseNumber(parts[1], lineNum);
      if (newAddr === null) return null;
      if (newAddr < 0 || newAddr > 255) {
        this.errors.push(`Line ${lineNum}: .org address out of range (0–255)`);
        return null;
      }
      return { type: 'org', newAddr, nextAddr: newAddr, lineNum };
    }

    if (dir === '.byte') {
      const val = this._parseNumber(parts[1], lineNum);
      if (val === null) return null;
      return { type: 'byte', value: val & 0xFF, addr, nextAddr: addr + 1, lineNum };
    }

    // .string "hello" — emit ASCII bytes
    if (dir === '.string') {
      const match = line.match(/\.string\s+"([^"]*)"/i);
      if (!match) {
        this.errors.push(`Line ${lineNum}: .string syntax: .string "text"`);
        return null;
      }
      const chars = match[1].split('').map(c => c.charCodeAt(0) & 0xFF);
      chars.push(0); // null terminator
      return { type: 'bytes', values: chars, addr, nextAddr: addr + chars.length, lineNum };
    }

    this.warnings.push(`Line ${lineNum}: Unknown directive '${dir}' — ignored`);
    return null;
  }

  // ─────────────────────────────────────────
  //  SECOND PASS: resolve labels, emit bytes
  // ─────────────────────────────────────────
  _secondPass(pass1, labels) {
    const bytes = new Array(256).fill(0);
    this.listing = [];

    for (const item of pass1) {
      if (item.type === 'org') continue;

      if (item.type === 'byte') {
        bytes[item.addr] = item.value;
        this.listing.push({
          addr: item.addr, bytes: [item.value],
          source: item.raw.trim(), decoded: `0x${toHex2(item.value)}`,
        });
        continue;
      }

      if (item.type === 'bytes') {
        for (let i = 0; i < item.values.length; i++) {
          bytes[item.addr + i] = item.values[i];
        }
        this.listing.push({
          addr: item.addr, bytes: item.values,
          source: item.raw.trim(), decoded: `${item.values.length} bytes`,
        });
        continue;
      }

      // type === 'instr'
      const { mnemonic, operandStr, instrDef, addr, lineNum, instrBytes } = item;
      const opcode = instrDef.opcode;
      bytes[addr] = opcode & 0xFF;

      if (instrBytes === 1) {
        // No operand byte
        this.listing.push({
          addr, bytes: [opcode], source: item.raw.trim(),
          mnemonic, operand: null, decoded: mnemonic,
        });
        continue;
      }

      // 2-byte instruction: resolve operand
      if (!operandStr) {
        this.errors.push(`Line ${lineNum}: '${mnemonic}' requires an operand`);
        continue;
      }

      let operandVal;
      const labelKey = operandStr.toUpperCase();
      if (labels[labelKey] !== undefined) {
        operandVal = labels[labelKey];
      } else {
        const num = this._parseNumber(operandStr, lineNum);
        if (num === null) continue;
        operandVal = num;
      }

      if (operandVal < 0 || operandVal > 255) {
        this.warnings.push(`Line ${lineNum}: Operand ${operandVal} truncated to 8 bits`);
        operandVal = operandVal & 0xFF;
      }

      bytes[addr + 1] = operandVal & 0xFF;

      this.listing.push({
        addr,
        bytes: [opcode, operandVal],
        source: item.raw.trim(),
        mnemonic,
        operand: operandVal,
        decoded: `${mnemonic} 0x${toHex2(operandVal)}`,
      });
    }

    return bytes;
  }

  // ─────────────────────────────────────────
  //  NUMBER PARSER
  // ─────────────────────────────────────────
  _parseNumber(str, lineNum) {
    if (!str) return null;
    str = str.trim();
    if (/^0x[0-9a-fA-F]+$/.test(str)) return parseInt(str.slice(2), 16);
    if (/^\$[0-9a-fA-F]+$/.test(str)) return parseInt(str.slice(1), 16);
    if (/^0b[01]+$/.test(str))        return parseInt(str.slice(2), 2);
    if (/^[0-9]+$/.test(str))         return parseInt(str, 10);
    this.errors.push(`Line ${lineNum}: Cannot parse number '${str}'`);
    return null;
  }

  // ─────────────────────────────────────────
  //  DISASSEMBLER
  // ─────────────────────────────────────────
  disassemble(bytes) {
    const lines = [];
    let i = 0;
    while (i < bytes.length) {
      const opcode = bytes[i];
      const instr  = OPCODE_TABLE[opcode];
      if (!instr) {
        lines.push({ addr: i, bytes: [opcode], text: `DB 0x${toHex2(opcode)}`, mnemonic: 'DB', operand: null });
        i++;
        continue;
      }
      const instrBytes = instr.bytes || 1;
      if (instrBytes === 2 && i + 1 < bytes.length) {
        const operand = bytes[i + 1];
        lines.push({
          addr: i,
          bytes: [opcode, operand],
          text: `${instr.mnemonic} 0x${toHex2(operand)}`,
          mnemonic: instr.mnemonic,
          operand,
        });
        i += 2;
      } else {
        lines.push({
          addr: i,
          bytes: [opcode],
          text: instr.mnemonic,
          mnemonic: instr.mnemonic,
          operand: null,
        });
        i++;
      }
    }
    return lines;
  }
}

// ─────────────────────────────────────────
//  EXAMPLE PROGRAMS  (updated for new ISA)
// ─────────────────────────────────────────

const EXAMPLE_PROGRAMS = {

  'Hello Output': {
    description: 'The simplest possible program: load an immediate value and output it. Demonstrates LDI and OUT. Outputs 42.',
    source: `; Hello Output
; Load the number 42 into A, then output it.
; LDI is a 2-byte instruction: opcode + immediate value byte.

        LDI 42      ; A = 42 (decimal)
        OUT         ; Output register = A = 42
        HLT         ; Stop

; Expected output: 42`,
  },

  'Add Two Numbers': {
    description: 'Loads two values from memory, adds them, outputs the sum. Watch the 2-byte fetch: each instruction is now opcode + address byte.',
    source: `; Add Two Numbers
; Data stored at addresses 0x20 and 0x21

        LDA 0x20    ; A = first number
        ADD 0x21    ; A = A + second number
        OUT         ; display the sum
        HLT

.org 0x20
.byte 28            ; first number (28)
.byte 14            ; second number (14)
; Expected output: 42`,
  },

  'Count Down': {
    description: 'Counts down from 10 to 0. Demonstrates SUB and JZ. After outputting, subtracts 1. When the result is zero, jumps to done (outputs the final 0).',
    source: `; Count Down from 10 to 0
; Uses SUB to decrement, JZ to detect when result = 0

        LDA 0x30    ; A = 10 (starting count)
loop:   OUT         ; display current value
        SUB 0x31    ; A = A - 1  (updates ZF)
        JZ  done    ; if A == 0, we just output 1 then will jump here after SUB makes it 0
        JMP loop    ; else keep counting
done:   OUT         ; display the final 0 (A is 0)
        HLT

.org 0x30
.byte 10            ; starting count = 10
.byte 1             ; constant 1 (subtrahend)
; Expected output: 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0`,
  },

  'Fibonacci': {
    description: 'Generates the Fibonacci sequence (1, 1, 2, 3, 5, 8, 13, 21...) until overflow. Uses ADD, STA, LDA, JC.',
    source: `; Fibonacci Sequence
; Addresses: 0x40 = F(n-1), 0x41 = F(n), 0x42 = temp
; Outputs: 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233

        LDA 0x41    ; A = current = 1
loop:   OUT         ; output current
        ADD 0x40    ; A = current + previous
        JC  done    ; overflow? stop
        STA 0x42    ; temp = next
        LDA 0x41    ; A = current (becomes new previous)
        STA 0x40    ; previous = old current
        LDA 0x42    ; A = next (becomes new current)
        STA 0x41    ; current = next
        JMP loop
done:   HLT

.org 0x40
.byte 1             ; F(n-1) = 1
.byte 1             ; F(n) = 1
.byte 0             ; temp`,
  },

  'Multiply 3 x 4': {
    description: 'Multiplies 3 x 4 = 12 using repeated addition. Shows how loops build complex operations from simple ADD instructions.',
    source: `; Multiply 3 x 4 = 12 using repeated addition
; Result in A, uses loop counter at 0x50

        LDI 0       ; A = 0 (result accumulator)
        STA 0x51    ; result = 0
        LDI 4       ; A = loop counter (4 iterations)
        STA 0x52    ; counter = 4

loop:   LDA 0x51    ; A = current result
        ADD 0x50    ; A = result + 3 (the multiplicand)
        STA 0x51    ; store updated result
        LDA 0x52    ; A = counter
        SUB 0x53    ; counter--
        STA 0x52    ; store updated counter
        JZ  done    ; if counter == 0, done
        JMP loop

done:   LDA 0x51    ; load final result
        OUT         ; display: should be 12
        HLT

.org 0x50
.byte 3             ; multiplicand (3)
.byte 0             ; result (init 0)
.byte 4             ; counter (init 4)
.byte 1             ; constant 1`,
  },

  'Subroutine CALL/RET': {
    description: 'Demonstrates CALL and RET: main code calls a "double" subroutine twice. Shows how the stack saves the return address.',
    source: `; Subroutine Demo: call "double" twice
; double(A): returns A*2 (A = A + A)
; Uses stack for return address

start:  LDI 5       ; A = 5
        CALL double ; call double(5) → A = 10
        OUT         ; output 10
        LDI 3       ; A = 3
        CALL double ; call double(3) → A = 6
        OUT         ; output 6
        HLT

double: STA 0x60    ; save A to temp
        ADD 0x60    ; A = A + A (double it)
        RET         ; return to caller

.org 0x60
.byte 0             ; temp storage`,
  },

  'Bitwise Operations': {
    description: 'Demonstrates AND, OR, XOR, SHL, SHR on register A. Shows how bitwise ops work at the binary level.',
    source: `; Bitwise Operations Demo
; Starting value: 0b10110011 = 0xB3 = 179

        LDI 0xB3    ; A = 10110011b

        SHL         ; A = 01100110b (shift left, CF=1)
        OUT         ; output 102

        LDA 0x70    ; A = 00001111b = 0x0F
        AND 0x71    ; A = A & 0b10110011 = 00000011b = 3
        OUT         ; output 3

        LDA 0x70    ; A = 00001111b
        OR  0x71    ; A = A | 0xB3 = 10111111b = 0xBF = 191
        OUT         ; output 191

        LDA 0x70    ; A = 00001111b
        XOR 0x71    ; A = A ^ 0xB3 = 10111100b = 0xBC = 188
        OUT         ; output 188

        HLT

.org 0x70
.byte 0x0F          ; 00001111b
.byte 0xB3          ; 10110011b`,
  },

  'Input Echo': {
    description: 'Reads from the Input Register (set the value in the Input field on the right) and echoes it to the Output. Demonstrates IN.',
    source: `; Input Echo
; Set a value in the Input field, then run this program.
; The CPU will read it via IN and echo it via OUT.

        IN          ; A = INPUT register
        OUT         ; OUTPUT = A
        HLT

; Try setting Input to different values and re-running!`,
  },

  'Count Up Loop': {
    description: 'Counts from 0 upward, demonstrating STA (write to RAM) and JMP (loop). Wraps at 255. Stop with Pause.',
    source: `; Count Up — infinite loop, add 1 each iteration

        LDI 0       ; A = 0 (start)
        STA 0x80    ; store in RAM[0x80]

loop:   LDA 0x80    ; load count
        OUT         ; display it
        ADD 0x81    ; count += 1
        JC  wrap    ; if overflow, wrap to 0
        STA 0x80    ; store new count
        JMP loop
wrap:   LDI 0
        STA 0x80
        JMP loop

.org 0x80
.byte 0             ; counter
.byte 1             ; constant 1`,
  },
};

// Export
window.Assembler        = Assembler;
window.EXAMPLE_PROGRAMS = EXAMPLE_PROGRAMS;
