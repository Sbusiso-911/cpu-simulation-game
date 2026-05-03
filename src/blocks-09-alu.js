/**
 * Series B — Episode 9: How an ALU Is Built
 * ------------------------------------------
 * The ALU (Arithmetic Logic Unit) is where every arithmetic and logical
 * operation happens. This episode is the big integration — it pulls
 * together the adder (Ep 8), comparator (Ep 7), MUX (Ep 6), decoder (Ep 5),
 * and individual gates into one unit that does ADD, SUB, AND, OR, XOR,
 * shifts, and comparisons — all under a single opcode-driven control.
 *
 * Arc:
 *   0. Hook                        every arithmetic instruction ends up here
 *   1. The ALU at block level      A, B, opcode in; result + flags out
 *   2. The key design trick        all operations run in parallel, MUX picks
 *   3. The arithmetic unit         adder/subtractor — callback to Ep 8
 *   4. The logic bank              AND, OR, XOR, NOT — bitwise arrays
 *   5. The shifter                 hardwired rewiring for ×2 / ÷2
 *   6. The selection MUX           opcode → decoder → MUX select
 *   7. The flags                   Z, N, C, V generated alongside
 *   8. Full ALU assembled          every piece wired up
 *   9. Recap + RAM teaser
 *
 * Walk-the-talk: every anim() matches its narration.
 */

(function () {
  'use strict';

  const B = () => window.Blocks;
  const C = () => window.Blocks && window.Blocks.COL;

  // ─────────────────────────────────────────
  //  Shared helpers
  // ─────────────────────────────────────────

  // Draw the ALU as a single trapezoid — the canonical EE symbol.
  //   x, y, w, h — bounding box
  //   highlights: optional { activeOp: name } to label the current operation
  function _drawALUSymbol(b, id, x, y, w, h, highlights) {
    highlights = highlights || {};
    const col = C();
    b.drawCustom(id, (g, NS, COL) => {
      // Classic ALU shape — hexagonal-ish, narrowing on the right
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d',
        `M 0 0
         L ${w * 0.40} 0
         L ${w * 0.50} ${h * 0.10}
         L ${w * 0.60} 0
         L ${w} 0
         L ${w * 0.80} ${h}
         L ${w * 0.20} ${h}
         Z`);
      path.setAttribute('transform', `translate(${x},${y})`);
      path.setAttribute('fill', COL.panel);
      path.setAttribute('stroke', COL.edgeRise);
      path.setAttribute('stroke-width', '3');
      g.appendChild(path);
      const label = document.createElementNS(NS, 'text');
      label.setAttribute('x', x + w / 2); label.setAttribute('y', y + h / 2 + 6);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-family', 'monospace');
      label.setAttribute('font-size', '28');
      label.setAttribute('font-weight', '700');
      label.setAttribute('fill', COL.edgeRise);
      label.textContent = 'ALU';
      g.appendChild(label);
      if (highlights.activeOp) {
        const op = document.createElementNS(NS, 'text');
        op.setAttribute('x', x + w / 2); op.setAttribute('y', y + h / 2 + 34);
        op.setAttribute('text-anchor', 'middle');
        op.setAttribute('font-family', 'monospace');
        op.setAttribute('font-size', '14');
        op.setAttribute('fill', COL.accent);
        op.textContent = 'op = ' + highlights.activeOp;
        g.appendChild(op);
      }
    });
    return { x, y, w, h };
  }

  // Draw the "parallel units + result MUX" architecture.
  // `active`: the unit currently selected (index 0..3 for add, logic, shift, cmp).
  function _drawParallelArchitecture(b, active) {
    const col = C();
    const units = [
      { name: 'ADDER/SUB',   sub: '+ / −',          y: 180 },
      { name: 'LOGIC BANK',  sub: 'AND / OR / XOR', y: 260 },
      { name: 'SHIFTER',     sub: '<< / >>',        y: 340 },
      { name: 'COMPARATOR',  sub: 'A ? B',          y: 420 },
    ];
    units.forEach((u, i) => {
      b.drawBox('u' + i, 120, u.y, 200, 60, u.name, (i === active) ? col.edgeRise : col.accent);
      b.drawNode('us' + i, 220, u.y + 52, u.sub, (i === active) ? col.edgeRise : col.label);
      // Shared A/B inputs into every unit
      b.drawWire('wa' + i, [[40, 170 - 5],[60, 170],[60, u.y + 20],[120, u.y + 20]],
        (i === active) ? col.wireHi : col.dim);
      b.drawWire('wb' + i, [[40, 540 + 5],[80, 540],[80, u.y + 40],[120, u.y + 40]],
        (i === active) ? col.wireHi : col.dim);
      // Unit output into MUX
      b.drawWire('wo' + i, [[320, u.y + 30],[460, u.y + 30]],
        (i === active) ? col.edgeRise : col.dim);
    });
    // Shared A, B labels
    b.drawNode('a-l', 40, 160, 'A', col.wireHi);
    b.drawNode('b-l', 40, 560, 'B', col.wireHi);

    // Result MUX
    b.drawMux('mux', 460, 180, 140, 280, { inputs: 4, label: 'MUX 4:1' });

    // Output
    b.drawWire('out', [[600, 320],[820, 320]], col.edgeRise);
    b.drawNode('out-l', 830, 320, 'RESULT', col.edgeRise);

    // Opcode → MUX select
    b.drawWire('op', [[530, 540],[530, 460]], col.edgeRise);
    b.drawNode('op-l', 470, 560, 'OPCODE', col.edgeRise);
  }

  // Draw N-bit bitwise logic unit (just shows a column of N gates).
  function _drawBitwiseLogicUnit(b, gateKind, n, x0, y0, label) {
    const col = C();
    for (let i = 0; i < n; i++) {
      const y = y0 + i * 40;
      b.drawGate('g-' + label + i, gateKind, x0, y, 80, 30);
      b.drawWire('wA-' + label + i, [[x0 - 40, y + 10],[x0, y + 10]], col.wireHi);
      b.drawWire('wB-' + label + i, [[x0 - 40, y + 20],[x0, y + 20]], col.wireHi);
      b.drawWire('wO-' + label + i, [[x0 + 80, y + 15],[x0 + 120, y + 15]], col.edgeRise);
    }
    b.drawNode(label + '-title', x0 + 40, y0 - 12,
      gateKind + ' (N bitwise)', col.accent);
  }

  // Draw a shifter as rewiring — shows 4-bit input on top, 4-bit output below,
  // with lines showing how bits connect for the given direction.
  function _drawShifter(b, direction, amount) {
    const col = C();
    const x0 = 200, y0 = 200, cellW = 100, cellH = 60, gap = 10;
    const n = 4;
    // Input row
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * (cellW + gap);
      b.drawBox('in' + i, cx, y0, cellW, cellH, 'bit ' + (n - 1 - i), col.accent);
    }
    // Output row
    const outY = y0 + 200;
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * (cellW + gap);
      b.drawBox('out' + i, cx, outY, cellW, cellH, 'bit ' + (n - 1 - i), col.edgeRise);
    }
    // Wires
    for (let i = 0; i < n; i++) {
      const ix = x0 + i * (cellW + gap) + cellW / 2;
      let outIdx;
      if (direction === 'left') {
        outIdx = i - amount;    // shift left = outIdx smaller (toward MSB)
      } else {
        outIdx = i + amount;    // shift right = outIdx larger (toward LSB)
      }
      if (outIdx < 0 || outIdx >= n) continue;
      const ox = x0 + outIdx * (cellW + gap) + cellW / 2;
      b.drawWire('w' + i, [[ix, y0 + cellH],[ix, y0 + 100],[ox, y0 + 100],[ox, outY]], col.wireHi);
    }
    // Fill line for the empty side
    if (direction === 'left') {
      const ox = x0 + (n - 1) * (cellW + gap) + cellW / 2;
      b.drawWire('zero', [[ox, y0 + 160],[ox, outY]], col.dim);
      b.drawNode('zero-l', ox - 20, y0 + 150, '0 →', col.dim);
    } else {
      const ox = x0 + 0 * (cellW + gap) + cellW / 2;
      b.drawWire('zero', [[ox, y0 + 160],[ox, outY]], col.dim);
      b.drawNode('zero-l', ox + 20, y0 + 150, '← 0', col.dim);
    }
  }

  // ─────────────────────────────────────────
  //  SCENES
  // ─────────────────────────────────────────
  const BLOCKS_09_SCENES = [

    // ════════════════════════════════════════════════════
    // SCENE 0 — HOOK
    // ════════════════════════════════════════════════════
    {
      id: 0,
      title: 'The Arithmetic Logic Unit',
      pages: [
        { sentences: [
          { text: `Every ADD, every SUB, every AND, every OR, every XOR, every shift left, every shift right, every compare — every single arithmetic or logical instruction in a CPU\u2019s entire instruction set — ends up at the same block of silicon. The Arithmetic Logic Unit. The ALU.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Single Destination Of Every Arithmetic Op', C().edgeRise);
              b.drawCustom('ops', (g, NS, COL) => {
                const lines = [
                  'ADD  R1, R2',
                  'SUB  R3, R4',
                  'AND  R5, R6',
                  'OR   R7, R8',
                  'XOR  R9, R10',
                  'SHL  R11, #2',
                  'SHR  R12, #1',
                  'CMP  R13, R14',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 180); t.setAttribute('y', 190 + i * 40);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '16');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.drawNode('arrow', 580, 370, '→   one unit', C().edgeRise);
              b.setLabel('Different instructions. Different meanings. Exactly one block of hardware executes them all.', C().accent);
            } },

          { text: `This is the episode where everything we\u2019ve built comes together. The adder from last time. The logic gates from the very first episodes. The MUX and the decoder and the comparator. All wired into one circuit, steered by one opcode. This is the ALU.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Everything Together', C().edgeRise);
              b.drawBox('add', 60,  200, 140, 60, 'adder',      C().accent);
              b.drawBox('log', 60,  280, 140, 60, 'logic',      C().accent);
              b.drawBox('shf', 60,  360, 140, 60, 'shifter',    C().accent);
              b.drawBox('cmp', 60,  440, 140, 60, 'comparator', C().accent);
              b.drawMux('mux', 280, 220, 120, 280, { inputs: 4, label: 'MUX' });
              for (let i = 0; i < 4; i++) {
                const y = 230 + i * 70;
                b.drawWire('w' + i, [[200, y],[280, y]], C().wireHi);
              }
              b.drawWire('o', [[400, 360],[620, 360]], C().edgeRise);
              b.drawBox('flags', 620, 300, 160, 120, 'FLAGS\nZ N C V', C().edgeRise);
              b.drawBox('res',   620, 440, 160, 60, 'RESULT', C().edgeRise);
              b.setLabel('All the parts you\u2019ve built. One diagram. One opcode. One output.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 1 — BLOCK LEVEL VIEW
    // ════════════════════════════════════════════════════
    {
      id: 1,
      title: 'The ALU At Block Level',
      pages: [
        { sentences: [
          { text: `At the highest level, the ALU is just a black box with a few wires. Two data inputs — call them A and B. A control input — the opcode — that says which operation to perform. And two output channels: the result, and a small set of status flags.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The ALU — From Outside', C().edgeRise);
              _drawALUSymbol(b, 'alu', 340, 220, 320, 200);
              b.drawNode('a-l', 280, 270, 'A →', C().wireHi);
              b.drawNode('b-l', 280, 370, 'B →', C().wireHi);
              b.drawWire('wa', [[310, 270],[380, 270]], C().wireHi);
              b.drawWire('wb', [[310, 370],[380, 370]], C().wireHi);
              b.drawWire('wop', [[500, 480],[500, 420]], C().edgeRise);
              b.drawNode('op-l', 450, 500, 'OPCODE', C().edgeRise);
              b.drawWire('wres', [[660, 300],[780, 300]], C().edgeRise);
              b.drawNode('res-l', 790, 300, 'RESULT', C().edgeRise);
              b.drawWire('wflags', [[660, 360],[780, 360]], C().edgeRise);
              b.drawNode('flags-l', 790, 360, 'FLAGS', C().edgeRise);
              b.setLabel('Two data inputs. One control input. One data output. One flags output. That\u2019s it.', C().accent);
            } },

          { text: `The opcode is what makes the ALU general-purpose. Change the opcode bits, and the ALU performs a different operation on the same inputs. Without having to rewire anything. That versatility is what makes it the heart of a programmable CPU.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One Machine, Many Operations', C().accent);
              _drawALUSymbol(b, 'alu', 340, 220, 320, 200, { activeOp: 'ADD' });
              b.drawCustom('ops', (g, NS, COL) => {
                const ops = [
                  ['opcode 000', 'ADD    A + B'],
                  ['opcode 001', 'SUB    A − B'],
                  ['opcode 010', 'AND    A & B'],
                  ['opcode 011', 'OR     A | B'],
                  ['opcode 100', 'XOR    A ^ B'],
                  ['opcode 101', 'SHL    A << 1'],
                  ['opcode 110', 'SHR    A >> 1'],
                  ['opcode 111', 'CMP    A − B (flags only)'],
                ];
                ops.forEach((o, i) => {
                  const y = 180 + i * 30;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 100); a.setAttribute('y', y);
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '12');
                  a.setAttribute('font-weight', '700');
                  a.setAttribute('fill', COL.edgeRise);
                  a.textContent = o[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 210); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '12');
                  b_.setAttribute('fill', COL.accent);
                  b_.textContent = o[1]; g.appendChild(b_);
                });
              });
              b.setLabel('A tiny opcode field — typically 3 to 6 bits — picks from a full menu of operations.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 2 — THE KEY DESIGN TRICK
    // ════════════════════════════════════════════════════
    {
      id: 2,
      title: 'The Key Design Trick',
      pages: [
        { sentences: [
          { text: `Here\u2019s the insight that makes the ALU simple to build. Instead of trying to "run only the selected operation" at each cycle, we just build every operation as its own unit, and run all of them in parallel — every single cycle.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Run All Operations, Always, In Parallel', C().edgeRise);
              _drawParallelArchitecture(b, 0);
              b.setLabel('Every unit gets A and B every cycle. Every unit produces a result every cycle.', C().edgeRise);
            } },

          { text: `Then at the very end, a multiplexer — driven by the opcode — picks which unit\u2019s result actually leaves the ALU as the final answer. The other three results are computed, unused, and discarded. Cheap transistors, enormously simpler control.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('MUX At The End Selects The Winner', C().edgeRise);
              _drawParallelArchitecture(b, 0);
              b.drawNode('note', 500, 560, 'discarded results are computed but never seen — cheaper than control logic', C().accent);
              b.setLabel('Opcode drives the MUX. One output wins. Everything else was computed for nothing, and that\u2019s fine.', C().edgeRise);
            } },

          { text: `Why does this work? Because transistors are abundant, and control logic is expensive. Computing every operation simultaneously costs a few thousand extra transistors. Designing complex "enable only the right unit" logic would cost design time, verification time, and timing headaches. The parallel-with-MUX pattern wins easily.`,
            dur: 15500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Transistors Are Cheap, Control Is Expensive', C().accent);
              b.drawCustom('tradeoff', (g, NS, COL) => {
                const lines = [
                  'what we burn:   ~a few thousand extra transistors',
                  'what we save:   design time, verification time, timing margin',
                  '',
                  'result:          a simple, fast, easy-to-verify ALU',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 180); t.setAttribute('y', 260 + i * 45);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '16');
                  t.setAttribute('fill', i === 3 ? COL.edgeRise : COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('The trade-off that has defined almost every ALU since the 1960s.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 3 — THE ARITHMETIC UNIT
    // ════════════════════════════════════════════════════
    {
      id: 3,
      title: 'The Arithmetic Unit',
      pages: [
        { sentences: [
          { text: `The arithmetic unit is the adder we built last episode — with the subtraction trick wired in. One XOR gate per B bit conditionally inverts B, and a single SUB control bit flips between addition and subtraction.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Adder / Subtractor', C().edgeRise);
              b.drawBox('adder', 360, 240, 280, 180, 'N-BIT ADDER', C().edgeRise);
              b.drawNode('a-l', 240, 280, 'A →', C().wireHi);
              b.drawWire('wa', [[280, 280],[360, 280]], C().wireHi);
              b.drawNode('b-l', 240, 360, 'B →', C().wireHi);
              b.drawGate('xor', 'XOR', 280, 340, 70, 50);
              b.drawWire('wb', [[270, 360],[280, 360]], C().wireHi);
              b.drawWire('wxor', [[350, 360],[360, 360]], C().wireHi);
              b.drawWire('sub', [[320, 480],[320, 390]], C().edgeRise);
              b.drawNode('sub-l', 340, 500, 'SUB', C().edgeRise);
              b.drawWire('cin', [[500, 480],[500, 420]], C().edgeRise);
              b.drawNode('cin-l', 520, 500, 'Cin = SUB', C().edgeRise);
              b.drawWire('out', [[640, 330],[800, 330]], C().edgeRise);
              b.drawNode('out-l', 810, 330, 'A + B  or  A − B', C().edgeRise);
              b.setLabel('One SUB bit controls both the B-invert XOR and the carry-in. Same adder, both ops.', C().accent);
            } },

          { text: `Inside, this is a carry-lookahead adder running in O(log N) time. Its carry-out of the MSB is the unsigned-overflow flag C. The XOR of its two top carries gives the signed-overflow flag V. All for free from the adder\u2019s existing carry network.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Same Unit, Generates Flags For Free', C().accent);
              b.drawBox('adder', 320, 240, 320, 180, 'N-BIT ADDER', C().edgeRise);
              b.drawWire('c', [[320, 310],[200, 310]], C().wireHi);
              b.drawNode('c-l', 120, 310, 'C flag', C().edgeRise);
              b.drawWire('v', [[320, 370],[200, 370]], C().wireHi);
              b.drawNode('v-l', 120, 370, 'V flag', C().edgeRise);
              b.drawWire('out', [[640, 330],[800, 330]], C().edgeRise);
              b.drawNode('out-l', 810, 330, 'A + B  or  A − B', C().edgeRise);
              b.setLabel('Carry-out → C. Carry-in/out XOR at MSB → V. Zero logic of our own.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 4 — THE LOGIC BANK
    // ════════════════════════════════════════════════════
    {
      id: 4,
      title: 'The Logic Bank',
      pages: [
        { sentences: [
          { text: `Next, the logic operations. AND, OR, and XOR on two N-bit numbers is so simple it barely deserves to be called an engineering problem. Just run N copies of the gate in parallel, one per bit. No carries, no propagation. Everything is bit-for-bit independent.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('N-Bit AND = N AND Gates In Parallel', C().accent);
              _drawBitwiseLogicUnit(b, 'AND', 6, 360, 150, 'and');
              b.drawNode('a-l', 310, 140, 'A[i]', C().wireHi);
              b.drawNode('b-l', 310, 155, 'B[i]', C().wireHi);
              b.drawNode('o-l', 500, 130, '→  (A AND B)[i]', C().edgeRise);
              b.setLabel('Each output bit depends only on the same bit position in the inputs. Maximal parallelism.', C().accent);
            } },

          { text: `Three of these banks live inside the ALU: N AND gates, N OR gates, N XOR gates. Each one takes A and B in full and produces a full N-bit result. All three run every cycle, all three feed the output MUX, and one gets selected.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Three Banks, Running In Parallel', C().edgeRise);
              b.drawBox('andb', 150, 200, 200, 80, 'AND bank (N gates)', C().accent);
              b.drawBox('orb',  150, 300, 200, 80, 'OR bank (N gates)',  C().accent);
              b.drawBox('xorb', 150, 400, 200, 80, 'XOR bank (N gates)', C().accent);
              b.drawWire('wa', [[50, 150],[80, 150],[80, 240],[150, 240]], C().wireHi);
              b.drawWire('wb', [[50, 530],[100, 530],[100, 340],[150, 340]], C().wireHi);
              b.drawNode('a-l', 30, 150, 'A', C().wireHi);
              b.drawNode('b-l', 30, 530, 'B', C().wireHi);
              b.drawMux('mux', 500, 200, 140, 280, { inputs: 3, label: 'to main MUX' });
              for (let i = 0; i < 3; i++) {
                const y = 240 + i * 100;
                b.drawWire('wo' + i, [[350, y],[500, 240 + i * 90]], C().wireHi);
              }
              b.setLabel('Three bitwise banks. Each one\u2019s output is one of the choices for the final result MUX.', C().accent);
            } },

          { text: `And NOT is practically free — it\u2019s either one of the outputs of XOR with all ones, or a dedicated bank of N inverters. Either way, a trivial addition.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('NOT — The Free Extra', C().accent);
              b.drawNode('e1', 500, 280, 'A NOT = A XOR 1…1', C().accent);
              b.drawNode('e2', 500, 320, '= one-wire trick on the XOR bank', C().edgeRise);
              b.drawNode('e3', 500, 400, 'or just a dedicated N-inverter bank', C().accent);
              b.setLabel('Either technique works. Bitwise NOT is the cheapest logic primitive there is.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 5 — THE SHIFTER
    // ════════════════════════════════════════════════════
    {
      id: 5,
      title: 'The Shifter',
      pages: [
        { sentences: [
          { text: `Shifts are startlingly simple. To shift a number left by one bit — which is the same as multiplying it by two — you just connect each input bit to the output position one to its left. And push a zero into the lowest bit. That\u2019s it. No gates at all. Just wires.`,
            dur: 15500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Shift Left By 1  =  Rewiring', C().edgeRise);
              _drawShifter(b, 'left', 1);
              b.setLabel('No transistors. No carry. Just connect each wire to the next slot over.', C().edgeRise);
            } },

          { text: `Shift right by one is the mirror image. Connect each input bit to the output one position to its right, and push a zero into the highest bit. That\u2019s division by two, rounded down toward zero.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Shift Right By 1  =  The Mirror', C().edgeRise);
              _drawShifter(b, 'right', 1);
              b.setLabel('Symmetrically cheap. A multiplication-by-two and a division-by-two for no silicon.', C().edgeRise);
            } },

          { text: `For variable shift amounts — say, "shift by five" — a more elaborate circuit called a barrel shifter uses MUXes to pick which wire each output comes from. A modern CPU can shift any amount in a single cycle. But the core idea is always the same: shifts are rewiring, not arithmetic.`,
            dur: 15500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Variable Shifts = Barrel Shifter = MUXes', C().accent);
              b.drawBox('bs', 300, 260, 400, 160, 'BARREL SHIFTER', C().accent);
              b.drawNode('inr', 250, 320, 'input', C().wireHi);
              b.drawWire('wi',  [[280, 320],[300, 320]], C().wireHi);
              b.drawWire('wo',  [[700, 320],[760, 320]], C().edgeRise);
              b.drawNode('outr', 770, 320, 'output', C().edgeRise);
              b.drawWire('sh',  [[500, 500],[500, 420]], C().edgeRise);
              b.drawNode('sh-l', 440, 520, 'shift amount', C().edgeRise);
              b.setLabel('A grid of MUXes picks the right wire for every output, for every possible shift amount.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 — THE SELECTION MUX + OPCODE
    // ════════════════════════════════════════════════════
    {
      id: 6,
      title: 'Selection — Opcode → Decoder → MUX',
      pages: [
        { sentences: [
          { text: `At the output, every unit\u2019s result feeds a big MUX. The MUX\u2019s select lines come directly from the opcode — the N-bit operation code that was part of the instruction the CPU fetched.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Opcode Drives The Result MUX', C().edgeRise);
              _drawParallelArchitecture(b, 2);
              b.setLabel('The select lines come from the instruction itself. Software decides which answer you get.', C().edgeRise);
            } },

          { text: `If the opcode is "000", add. If "001", subtract. If "010", AND. And so on. The MUX\u2019s behavior maps opcodes to operations one-for-one. Every instruction\u2019s effect on the ALU is already baked in at chip design time.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Opcode-to-Operation Mapping', C().accent);
              b.drawTruthTable('map', 260, 180, ['opcode', 'ALU picks'], [
                ['000', 'ADD'],
                ['001', 'SUB'],
                ['010', 'AND'],
                ['011', 'OR'],
                ['100', 'XOR'],
                ['101', 'SHL'],
                ['110', 'SHR'],
                ['111', 'CMP'],
              ]);
              b.setLabel('Eight operations, three opcode bits. This is the ALU\u2019s public interface.', C().accent);
            } },

          { text: `You might recognise this from the decoder episode — because that MUX\u2019s internal select logic is literally a decoder. The opcode goes into a 3-to-8 decoder that lights exactly one of the MUX\u2019s one-hot "pass" inputs. The MUX we\u2019ve been drawing as one block is a decoder plus an array of AND-OR gates. Everything composes.`,
            dur: 16500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Decoder Inside The MUX', C().edgeRise);
              b.drawBox('op', 80, 280, 140, 80, 'OPCODE\n(3 bits)', C().wireHi);
              b.drawWire('wop-dec', [[220, 320],[300, 320]], C().wireHi);
              b.drawBox('dec', 300, 270, 180, 100, '3-to-8 decoder', C().accent);
              for (let i = 0; i < 8; i++) {
                const y = 280 + i * 12;
                b.drawWire('od' + i, [[480, y + 2],[540, y + 2]], (i === 3) ? C().edgeRise : C().dim);
              }
              b.drawBox('mux', 540, 260, 200, 120, 'MUX (8-input bank)', C().edgeRise);
              b.drawWire('out', [[740, 320],[860, 320]], C().edgeRise);
              b.drawNode('out-l', 870, 320, 'RESULT', C().edgeRise);
              b.setLabel('Same building blocks we covered separately. Now wired together inside the ALU.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 7 — THE FLAGS
    // ════════════════════════════════════════════════════
    {
      id: 7,
      title: 'The Flags — Free Side-Effects',
      pages: [
        { sentences: [
          { text: `Alongside the N-bit result, the ALU produces four status flags — single bits that describe properties of the result. These feed into a flags register that every conditional branch instruction reads.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Four Flags', C().edgeRise);
              b.drawCustom('flags', (g, NS, COL) => {
                const flags = [
                  ['Z', 'Zero',     'result is exactly 0'],
                  ['N', 'Negative', 'result\u2019s sign bit is 1 (signed)'],
                  ['C', 'Carry',    'unsigned overflow from arithmetic'],
                  ['V', 'Overflow', 'signed overflow from arithmetic'],
                ];
                flags.forEach((f, i) => {
                  const y = 230 + i * 60;
                  const box = document.createElementNS(NS, 'rect');
                  box.setAttribute('x', 170); box.setAttribute('y', y - 22);
                  box.setAttribute('width', 50); box.setAttribute('height', 44);
                  box.setAttribute('rx', 4);
                  box.setAttribute('fill', COL.panel); box.setAttribute('stroke', COL.edgeRise);
                  box.setAttribute('stroke-width', '2');
                  g.appendChild(box);
                  const label = document.createElementNS(NS, 'text');
                  label.setAttribute('x', 195); label.setAttribute('y', y + 8);
                  label.setAttribute('text-anchor', 'middle');
                  label.setAttribute('font-family', 'monospace');
                  label.setAttribute('font-size', '20');
                  label.setAttribute('font-weight', '700');
                  label.setAttribute('fill', COL.edgeRise);
                  label.textContent = f[0]; g.appendChild(label);
                  const name = document.createElementNS(NS, 'text');
                  name.setAttribute('x', 250); name.setAttribute('y', y);
                  name.setAttribute('font-family', 'monospace');
                  name.setAttribute('font-size', '15');
                  name.setAttribute('font-weight', '700');
                  name.setAttribute('fill', COL.accent);
                  name.textContent = f[1]; g.appendChild(name);
                  const desc = document.createElementNS(NS, 'text');
                  desc.setAttribute('x', 400); desc.setAttribute('y', y);
                  desc.setAttribute('font-family', 'monospace');
                  desc.setAttribute('font-size', '14');
                  desc.setAttribute('fill', COL.label);
                  desc.textContent = f[2]; g.appendChild(desc);
                });
              });
              b.setLabel('Every arithmetic operation updates these. Conditional branches read them.', C().accent);
            } },

          { text: `Each flag is computed by a small side-circuit of its own. Z — zero flag — is the NOR of all the output bits: every bit is 0 if and only if any single bit at 1 would drop the NOR\u2019s output. N — negative — is literally just the top bit of the result, because two\u2019s complement puts the sign there.`,
            dur: 16500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Z and N — Trivial Derivations', C().accent);
              b.drawBox('res', 320, 200, 360, 90, 'N-BIT RESULT', C().edgeRise);
              b.drawGate('nor', 'NOR', 380, 340, 140, 100);
              b.drawWire('w-res-nor', [[500, 290],[450, 290],[450, 340]], C().wireHi);
              b.drawWire('w-z', [[522, 390],[640, 390]], C().edgeRise);
              b.drawNode('z-l', 650, 390, 'Z flag', C().edgeRise);
              b.drawWire('w-n', [[660, 220],[720, 220],[720, 290],[820, 290]], C().edgeRise);
              b.drawNode('n-l', 830, 290, 'N flag  (= MSB)', C().edgeRise);
              b.setLabel('Zero = "no bit is set" = NOR. Negative = top bit. Both come for almost no silicon.', C().accent);
            } },

          { text: `The carry flag C is the adder\u2019s existing carry-out of the top bit — we already have it. The overflow flag V is the XOR of the MSB\u2019s carry-in and carry-out — also already in the adder. No new logic required. The ALU, at no added cost, produces every flag a CPU will ever need for conditional branching.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('C and V — Already In The Adder', C().edgeRise);
              b.drawBox('adder', 280, 240, 440, 160, 'ADDER / SUBTRACTOR', C().edgeRise);
              b.drawWire('c-out', [[280, 280],[160, 280]], C().wireHi);
              b.drawNode('c-l', 100, 280, 'C flag', C().edgeRise);
              b.drawWire('v-out', [[280, 360],[160, 360]], C().wireHi);
              b.drawNode('v-l', 100, 360, 'V flag', C().edgeRise);
              b.drawWire('res', [[720, 320],[860, 320]], C().edgeRise);
              b.drawNode('res-l', 870, 320, 'sum / diff', C().edgeRise);
              b.setLabel('Every flag pops out of circuitry we already needed. Free of charge.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 8 — FULL ALU ASSEMBLED
    // ════════════════════════════════════════════════════
    {
      id: 8,
      title: 'The Full ALU',
      pages: [
        { sentences: [
          { text: `Here is the complete picture. Two N-bit data inputs — A and B — fan out into every unit in parallel. The arithmetic unit, with its SUB control. The AND, OR, and XOR banks. The shifter. Every one computes a candidate result. A big MUX, driven by the opcode, picks the final output. And the flags register snapshots the four status bits.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Everything Wired Together', C().edgeRise);
              // Inputs
              b.drawNode('a-l', 40, 160, 'A', C().wireHi);
              b.drawNode('b-l', 40, 540, 'B', C().wireHi);
              // Four stacked units
              b.drawBox('add',  120, 170, 180, 70, 'ADDER/SUB',   C().accent);
              b.drawBox('and',  120, 250, 180, 60, 'AND bank',    C().accent);
              b.drawBox('or',   120, 320, 180, 60, 'OR bank',     C().accent);
              b.drawBox('xor',  120, 390, 180, 60, 'XOR bank',    C().accent);
              b.drawBox('shf',  120, 460, 180, 70, 'SHIFTER',     C().accent);
              // Fan-outs from A and B
              for (const y of [200, 275, 345, 415, 490]) {
                b.drawWire('wa-' + y, [[60, 170],[60, y],[120, y]], C().wireHi);
                b.drawWire('wb-' + y, [[80, 540],[80, y + 15],[120, y + 15]], C().wireHi);
              }
              // MUX collecting all outputs
              b.drawMux('mux', 340, 170, 120, 360, { inputs: 5, label: 'MUX 5:1' });
              for (let i = 0; i < 5; i++) {
                const y = 200 + i * 75;
                b.drawWire('wmux' + i, [[300, y],[340, y]], C().wireHi);
              }
              // Opcode → decoder → MUX select
              b.drawBox('dec', 200, 560, 220, 40, '3→8 decoder', C().accent);
              b.drawNode('op', 160, 580, 'OPCODE', C().edgeRise);
              b.drawWire('op-dec', [[180, 580],[200, 580]], C().wireHi);
              b.drawWire('dec-mux', [[420, 580],[400, 580],[400, 530]], C().wireHi);
              // Output
              b.drawWire('out', [[460, 350],[640, 350]], C().edgeRise);
              b.drawBox('res', 640, 300, 160, 80, 'RESULT', C().edgeRise);
              // Flags
              b.drawBox('flags', 830, 220, 140, 160, 'FLAGS\nZ N C V', C().edgeRise);
              b.drawWire('f1', [[640, 340],[830, 250]], C().wireHi);
              b.drawWire('f2', [[640, 360],[830, 280]], C().wireHi);
              b.setLabel('Every building block from Series B — connected. This is the ALU.', C().edgeRise);
            } },

          { text: `Inside a real CPU, this whole circuit computes in well under a nanosecond. A and B arrive from the register file at the start of the clock cycle. The opcode arrives from the instruction decoder. Before the next rising edge, the result is waiting to be written back. Every cycle. Every instruction. Every program.`,
            dur: 15500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One Cycle — Every Instruction', C().accent);
              b.drawBox('reg', 80, 280, 180, 120, 'REGISTER FILE', C().accent);
              b.drawWire('wa', [[260, 310],[340, 310]], C().wireHi);
              b.drawWire('wb', [[260, 370],[340, 370]], C().wireHi);
              _drawALUSymbol(b, 'alu', 340, 260, 280, 160);
              b.drawWire('wres', [[620, 340],[720, 340]], C().edgeRise);
              b.drawWire('wback', [[720, 340],[720, 440],[170, 440],[170, 400]], C().wireHi);
              b.drawNode('arrow', 450, 470, '→ writeback into register', C().accent);
              b.drawWire('wop', [[480, 540],[480, 420]], C().edgeRise);
              b.drawNode('wop-l', 450, 560, 'OPCODE from decoder', C().edgeRise);
              b.setLabel('Register file → ALU → write back. The core of every single fetch-decode-execute cycle.', C().accent);
            } },

          { text: `And that\u2019s really it. The ALU is not conceptually deep. It\u2019s just every arithmetic and logical unit we know how to build, wired in parallel, routed through a MUX, with flags falling out as side effects. But this one unit is what turns a clock, a register file, and a program counter into a computer.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Simple. And Yet Everything.', C().edgeRise);
              _drawALUSymbol(b, 'alu', 340, 220, 320, 220);
              b.drawNode('big', 500, 490, 'combined with registers, a PC, and memory — this is a computer', C().edgeRise);
              b.setLabel('A few thousand transistors. The complete arithmetic capability of the machine.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 9 — RECAP
    // ════════════════════════════════════════════════════
    {
      id: 9,
      title: 'Recap — The ALU',
      pages: [
        { sentences: [
          { text: `Trace the build. The ALU\u2019s job is to take two data inputs and an opcode, and produce a result plus a set of flags.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 1 — The Contract', C().accent);
              _drawALUSymbol(b, 'alu', 340, 220, 320, 200);
              b.setLabel('Two numbers, one opcode, one result, four flags. That\u2019s the interface.', C().accent);
            } },

          { text: `Internally, every operation runs as its own unit, in parallel, every cycle. An adder/subtractor. An AND bank. An OR bank. An XOR bank. A shifter. All computing simultaneously.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 2 — Parallel Units', C().accent);
              _drawParallelArchitecture(b, 1);
              b.setLabel('All units always on. Transistors are cheap, control is expensive.', C().accent);
            } },

          { text: `A MUX at the output, driven by the opcode, picks which unit\u2019s result actually leaves. Inside that MUX is a decoder turning the opcode into a one-hot "pass this one" signal.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 3 — Opcode → Decoder → MUX', C().accent);
              _drawParallelArchitecture(b, 3);
              b.setLabel('Every episode\u2019s building block shows up somewhere inside this machine.', C().accent);
            } },

          { text: `The flags come along for almost no extra silicon. Z is a NOR of all result bits. N is the top bit. C and V come from the adder\u2019s carry network. Four bits that let every conditional branch in software work.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 4 — Flags, Free', C().edgeRise);
              b.drawBox('z', 180, 260, 160, 80, 'Z\nzero',     C().accent);
              b.drawBox('n', 360, 260, 160, 80, 'N\nnegative', C().accent);
              b.drawBox('c', 180, 360, 160, 80, 'C\ncarry',    C().accent);
              b.drawBox('v', 360, 360, 160, 80, 'V\noverflow', C().accent);
              b.setLabel('Four bits, produced as side effects. Foundation for every conditional branch.', C().edgeRise);
            } },

          { text: `That\u2019s the ALU. The arithmetic and logical heart of every CPU. Built entirely from the units of the previous eight episodes. The capstone of Series B.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The ALU — The Capstone', C().edgeRise);
              _drawALUSymbol(b, 'alu', 340, 220, 320, 220);
              b.setLabel('From Clock → Flip-Flop → Register → Counter → Decoder → MUX → Comparator → Adder → ALU.', C().edgeRise);
            } },

          { text: `One piece left in Series B: RAM. The place where instructions and data live before they ever reach the ALU or a register. Every cell of RAM is a flip-flop cousin, every row is a decoder output, every read is a MUX. See you next episode.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Next — and Final — Episode: RAM', C().accent);
              b.drawChipOutline('die', 250, 180, 500, 300, 'RAM');
              b.drawCustom('cells', (g, NS, COL) => {
                for (let r = 0; r < 12; r++) {
                  for (let c = 0; c < 20; c++) {
                    const rect = document.createElementNS(NS, 'rect');
                    rect.setAttribute('x', 270 + c * 22);
                    rect.setAttribute('y', 200 + r * 22);
                    rect.setAttribute('width', 18);
                    rect.setAttribute('height', 18);
                    rect.setAttribute('fill', COL.edgeRise); rect.setAttribute('opacity', '0.25');
                    g.appendChild(rect);
                  }
                }
              });
              b.setLabel('The last building block. Memory at scale. See you next episode.', C().accent);
            } },
        ] },
      ],
      showAll: true,
      isFinal: true,
    },
  ];

  if (typeof window !== 'undefined') {
    window.BLOCKS_09_SCENES = BLOCKS_09_SCENES;
  }
})();
