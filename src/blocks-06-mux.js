/**
 * Series B — Episode 6: How a Multiplexer Is Built
 * --------------------------------------------------
 * The MUX is the decoder's dual. Where a decoder turns a code into a
 * one-hot destination selector, a MUX uses a code to pick one of many
 * sources and route it to a single output. Every "if-else" in hardware,
 * every ALU operand selector, every "take the branch target or PC+1" in
 * a CPU — all MUXes.
 *
 * Arc:
 *   0. Hook                       many sources, one output — pick which
 *   1. Dual of the decoder        side-by-side; the yin and yang of selection
 *   2. The 2-to-1 MUX             gate-level build with Y = ¬S·A + S·B
 *   3. Scaling                    4:1, 8:1, 2^N:1 — same doubling pattern
 *   4. 4-to-1 from gates          4 ANDs + 1 OR — MUX contains a decoder
 *   5. Cascading (tree)           three 2:1 → one 4:1. Scales cleanly.
 *   6. MUX vs tri-state bus       two ways to share a wire
 *   7. MUXes in the CPU           ALU operand, PC source, every if-else
 *   8. Recap + comparator teaser
 *
 * Walk-the-talk: every anim() must match its narration.
 */

(function () {
  'use strict';

  const B = () => window.Blocks;
  const C = () => window.Blocks && window.Blocks.COL;

  // ─────────────────────────────────────────
  //  Sampler factories for input waveforms
  // ─────────────────────────────────────────
  const square = (periodMs) => (t) => {
    if (t < 0) return 0;
    return (Math.floor(t / (periodMs / 2)) % 2) ? 1 : 0;
  };
  const pulses = (onMs, offMs, phase = 0) => (t) => {
    if (t < 0) return 0;
    const period = onMs + offMs;
    return (((t + phase) % period) < onMs) ? 1 : 0;
  };
  const flat = (v) => () => v;

  // ─────────────────────────────────────────
  //  Gate-level 2-to-1 MUX. Y = (¬S · A) + (S · B).
  //  Shows which of the two ANDs is firing for the given select value.
  // ─────────────────────────────────────────
  function _drawGate2to1(b, state) {
    state = state || {};
    const S = state.S, A = state.A, B = state.B;
    const col = C();
    const hi = (v) => (v === 1) ? col.wireHi : (v === 0) ? col.wireLo : col.dim;

    // NOT gate for S
    b.drawGate('not-S', 'NOT', 200, 340, 60, 40);

    // Two ANDs
    b.drawGate('and-A', 'AND', 400, 180, 140, 80);
    b.drawGate('and-B', 'AND', 400, 360, 140, 80);

    // OR
    b.drawGate('or-Y',  'OR',  620, 260, 140, 90);

    // Which AND is firing?
    const andAout = (S === 0) ? (A ? 1 : 0) : 0;
    const andBout = (S === 1) ? (B ? 1 : 0) : 0;
    if (andAout) b.setState('and-A', 'glow');
    if (andBout) b.setState('and-B', 'glow');
    const Y = andAout || andBout;

    // Wires
    b.drawWire('w-A',     [[80, 200],[400, 200]], hi(A));
    b.drawNode('A-l',     60, 200, 'A = ' + (A ?? '?'), hi(A));
    b.drawWire('w-B',     [[80, 420],[400, 420]], hi(B));
    b.drawNode('B-l',     60, 420, 'B = ' + (B ?? '?'), hi(B));

    b.drawWire('w-S',     [[80, 360],[200, 360]], hi(S));
    b.drawNode('S-l',     60, 360, 'S = ' + (S ?? '?'), hi(S));

    // S → AND-B upper input
    b.drawWire('w-S-andB', [[120, 360],[120, 380],[400, 380]], hi(S));
    // NOT(S) → AND-A upper input
    b.drawWire('w-notS',   [[260, 360],[340, 360],[340, 220],[400, 220]], hi(S === 0 ? 1 : 0));

    // ANDs → OR
    b.drawWire('w-andA-or', [[540, 220],[580, 220],[580, 280],[620, 280]], hi(andAout));
    b.drawWire('w-andB-or', [[540, 400],[580, 400],[580, 330],[620, 330]], hi(andBout));

    // OR → Y
    b.drawWire('w-Y', [[760, 305],[880, 305]], hi(Y));
    b.drawNode('Y-l', 890, 305, 'Y = ' + Y, hi(Y));

    b.drawNode('eqn', 500, 510, 'Y  =  (¬S · A)  +  (S · B)', col.accent);
  }

  // ─────────────────────────────────────────
  //  Gate-level 4-to-1 MUX — four 3-input ANDs + one 4-input OR.
  //  (Drawn with 2-input ANDs for visual clarity; the logic is the same.)
  // ─────────────────────────────────────────
  function _drawGate4to1(b, selectCode) {
    // selectCode: 0..3
    const col = C();
    const active = selectCode & 3;

    // Inputs I0..I3 (left)
    for (let i = 0; i < 4; i++) {
      const y = 180 + i * 60;
      b.drawWire('w-I' + i, [[60, y],[280, y]], (i === active) ? col.edgeRise : col.dim);
      b.drawNode('I-l' + i, 40, y, 'I' + i, (i === active) ? col.edgeRise : col.dim);
    }

    // 4 AND gates
    for (let i = 0; i < 4; i++) {
      const y = 160 + i * 60;
      b.drawGate('and' + i, 'AND', 280, y, 110, 40);
      if (i === active) b.setState('and' + i, 'glow');
    }

    // 4-input OR — we represent it as a wider OR gate
    b.drawGate('or', 'OR', 470, 230, 140, 130);

    // Wires AND → OR
    for (let i = 0; i < 4; i++) {
      const y = 180 + i * 60;
      const toY = 250 + i * 20;
      b.drawWire('w-a' + i + '-or', [[390, y],[420, y],[420, toY],[470, toY]],
        (i === active) ? col.wireHi : col.dim);
    }

    // Output
    b.drawWire('w-Y', [[610, 295],[760, 295]], col.edgeRise);
    b.drawNode('Y-l', 770, 295, 'Y = I' + active, col.edgeRise);

    // Select decoder (symbolic) — shown as a small box
    b.drawBox('dec', 280, 450, 200, 60, '2→4 select decoder', col.accent);
    b.drawWire('sel-in', [[80, 480],[280, 480]], col.wireHi);
    b.drawNode('sel-l',  40, 480, 'S1 S0 = ' +
      (((active >> 1) & 1)) + ((active & 1)),
      col.wireHi);
    // Decoder outputs → AND gate "select" input
    for (let i = 0; i < 4; i++) {
      const fromX = 480;
      const toY   = 195 + i * 60;
      b.drawWire('dec-a' + i,
        [[fromX, 480],[620 - i * 30, 480],[620 - i * 30, toY],[390, toY]],
        (i === active) ? col.edgeRise : col.dim);
    }
    b.drawNode('dec-note', 500, 540, 'the decoder lights exactly one AND-gate\u2019s "pass" line', col.accent);
  }

  // ─────────────────────────────────────────
  //  Cascading tree — three 2:1 MUXes wired as one 4:1.
  //  S0 controls the two first-level MUXes; S1 controls the final MUX.
  // ─────────────────────────────────────────
  function _drawTree4to1(b, selectCode) {
    const col = C();
    const S1 = (selectCode >> 1) & 1;
    const S0 = selectCode & 1;
    const active = selectCode & 3;

    // Input stubs
    for (let i = 0; i < 4; i++) {
      const y = 180 + i * 55;
      b.drawWire('wI' + i, [[60, y],[260, y]], (i === active) ? col.wireHi : col.dim);
      b.drawNode('I' + i, 40, y, 'I' + i, (i === active) ? col.edgeRise : col.dim);
    }

    // First-level MUXes (two of them)
    b.drawMux('m1', 260, 160, 90, 140, { inputs: 2, label: '2:1' });
    b.drawMux('m2', 260, 300, 90, 140, { inputs: 2, label: '2:1' });

    // Final MUX
    b.drawMux('m3', 500, 240, 100, 160, { inputs: 2, label: '2:1' });

    // First-level outputs → final MUX inputs
    const m1Out = (S0 === 0) ? 0 : 1;  // picks I0 or I1
    const m2Out = (S0 === 0) ? 2 : 3;  // picks I2 or I3
    const m1Active = m1Out === active;
    const m2Active = m2Out === active;

    b.drawWire('m1-f', [[350, 230],[500, 290]], m1Active ? col.wireHi : col.dim);
    b.drawWire('m2-f', [[350, 370],[500, 350]], m2Active ? col.wireHi : col.dim);

    // Select wiring
    b.drawWire('w-S0-m1', [[180, 520],[305, 520],[305, 300]], S0 ? col.edgeRise : col.wireLo);
    b.drawWire('w-S0-m2', [[305, 520],[305, 440]], S0 ? col.edgeRise : col.wireLo);
    b.drawNode('S0-l',  80, 520, 'S0 = ' + S0, col.edgeRise);

    b.drawWire('w-S1', [[500, 560],[550, 560],[550, 400]], S1 ? col.edgeRise : col.wireLo);
    b.drawNode('S1-l', 400, 560, 'S1 = ' + S1, col.edgeRise);

    // Final output
    b.drawWire('w-Y', [[600, 320],[760, 320]], col.edgeRise);
    b.drawNode('Y-l', 770, 320, 'Y = I' + active, col.edgeRise);
  }

  // ─────────────────────────────────────────
  //  A 4:1 MUX with live animated inputs and a cycling select.
  //  Each input is a distinct waveform; Y tracks the selected input.
  // ─────────────────────────────────────────
  function _drawAnimated4to1(b) {
    const col = C();
    const cycleMs = 2000; // how long we stay on each select code
    const samplers = [
      square(400),                    // I0 — medium square
      pulses(80, 320),                // I1 — short pulses
      square(1000),                   // I2 — slow square
      pulses(200, 200, 100),          // I3 — another pulse pattern
    ];

    // Draw MUX
    b.drawMux('mux4', 400, 180, 180, 280, { inputs: 4, label: 'MUX 4:1' });

    // Draw input waveforms
    for (let i = 0; i < 4; i++) {
      const y = 220 + i * 70;
      b.drawWaveform('wi' + i, 120, y - 22, 260, 44, samplers[i],
        { running: true, step: 3, timePerCol: 15 });
      b.drawNode('il' + i, 90, y, 'I' + i, col.label);
    }

    // Output waveform — sampler that follows the currently-selected input
    const outSampler = (t) => {
      if (t < 0) return 0;
      const code = Math.floor(t / cycleMs) % 4;
      return samplers[code](t);
    };
    b.drawWaveform('wo', 620, 260, 280, 110, outSampler,
      { running: true, step: 3, timePerCol: 15 });
    b.drawNode('ol', 900, 320, 'Y', col.edgeRise);

    // Select value — updated each frame with a text node
    b.drawCustom('sel', (g, NS, COL) => {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', 490); t.setAttribute('y', 510);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-family', 'monospace');
      t.setAttribute('font-size', '16');
      t.setAttribute('font-weight', '700');
      t.setAttribute('fill', COL.edgeRise);
      t.textContent = 'select = 00';
      g.appendChild(t);
    });
    b.animate('sel', (tMs, rec) => {
      const txt = rec.el.querySelector('text');
      if (!txt) return;
      const code = Math.floor(tMs / cycleMs) % 4;
      const bin = ((code >> 1) & 1) + '' + (code & 1);
      txt.textContent = 'select = ' + bin + '   →   Y tracks I' + code;
    });
  }

  // ─────────────────────────────────────────
  //  SCENES
  // ─────────────────────────────────────────
  const BLOCKS_06_SCENES = [

    // ════════════════════════════════════════════════════
    // SCENE 0 — HOOK
    // ════════════════════════════════════════════════════
    {
      id: 0,
      title: 'Pick One Of Many Sources',
      pages: [
        { sentences: [
          { text: `Last episode we asked "given a code, which of many destinations should wake up?" The decoder handles that. This episode is the opposite question. Given many possible sources, and one output, which source should reach it?`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Opposite Problem — One Output, Many Sources', C().accent);
              // Four registers feeding "something"
              for (let i = 0; i < 4; i++) {
                const y = 180 + i * 80;
                b.drawBox('src' + i, 120, y, 160, 60, 'source ' + i, C().accent);
                b.drawWire('w' + i, [[280, y + 30],[480, y + 30]], C().wireHi);
              }
              b.drawBox('dst', 680, 280, 200, 120, 'one output', C().edgeRise);
              b.drawWire('w-out', [[880, 340],[940, 340]], C().edgeRise);
              b.drawNode('qm', 580, 300, '?', C().wireHot);
              b.setLabel('Four wires trying to reach one place. Which one actually delivers its signal?', C().accent);
            } },

          { text: `The circuit that answers it is called a multiplexer. Its job is to watch several input wires, take a small code on its select lines, and connect exactly one of those inputs through to its single output.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Multiplexer — Or MUX', C().edgeRise);
              b.drawMux('mux', 380, 200, 200, 240, { inputs: 4, label: 'MUX 4:1' });
              for (let i = 0; i < 4; i++) {
                const y = 260 + i * 35;
                b.drawWire('i' + i, [[240, y],[380, y]], i === 2 ? C().edgeRise : C().dim);
                b.drawNode('in-l' + i, 210, y, 'I' + i, i === 2 ? C().edgeRise : C().dim);
              }
              b.drawWire('sel', [[470, 480],[470, 440]], C().edgeRise);
              b.drawNode('sel-l', 430, 500, 'select', C().edgeRise);
              b.drawWire('out', [[580, 320],[760, 320]], C().edgeRise);
              b.drawNode('y', 780, 320, 'Y', C().edgeRise);
              b.setLabel('N data inputs. A select code. One output. The code picks which input passes through.', C().edgeRise);
            } },

          { text: `A CPU is full of these moments. Which register feeds the ALU on this cycle? Where does the program counter get its next value from — the incrementer, or a jump target? Every one of those questions is answered by a MUX.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('CPU Data Paths Are Full Of MUXes', C().accent);
              b.drawCustom('usecases', (g, NS, COL) => {
                const items = [
                  '• ALU input — which register\u2019s value gets added?',
                  '• Program counter — PC+1, or a jump target?',
                  '• Register file — which read port delivers which reg?',
                  '• Shift amount — shift by 1, by 4, or a variable?',
                  '• Memory address — from PC, or from an index register?',
                ];
                items.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 180); t.setAttribute('y', 230 + i * 42);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '15');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Every "which wire wins" decision in a CPU data path is a multiplexer.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 1 — DUAL OF THE DECODER
    // ════════════════════════════════════════════════════
    {
      id: 1,
      title: 'The Dual Of The Decoder',
      pages: [
        { sentences: [
          { text: `A decoder takes a code and produces a one-hot output — one wire activated out of many. A multiplexer takes a code and produces one output — reflecting one input out of many. They are structural duals. Same information flow, mirrored.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Decoder and MUX — The Pair', C().accent);
              // Decoder on the left
              b.drawBox('dec', 100, 200, 160, 240, 'DECODER\n3 → 8', C().accent);
              b.drawWire('d-in', [[40, 320],[100, 320]], C().wireHi);
              b.drawNode('d-in-l', 20, 320, 'code', C().wireHi);
              for (let i = 0; i < 8; i++) {
                const y = 220 + i * 28;
                b.drawWire('d-o' + i, [[260, y],[340, y]], (i === 3) ? C().edgeRise : C().dim);
              }
              b.drawNode('d-out-l', 360, 320, 'one-hot out', C().edgeRise);
              // MUX on the right
              b.drawMux('mux', 660, 200, 160, 240, { inputs: 8, label: 'MUX 8:1' });
              for (let i = 0; i < 8; i++) {
                const y = 220 + i * 28;
                b.drawWire('m-i' + i, [[560, y],[660, y]], (i === 3) ? C().edgeRise : C().dim);
              }
              b.drawNode('m-in-l', 540, 320, 'many in', C().wireHi);
              b.drawWire('m-sel', [[740, 500],[740, 440]], C().edgeRise);
              b.drawNode('m-sel-l', 700, 520, 'code', C().edgeRise);
              b.drawWire('m-o', [[820, 320],[900, 320]], C().edgeRise);
              b.drawNode('m-o-l', 910, 320, 'Y', C().edgeRise);
              b.setLabel('Decoder: code in, one-hot out. MUX: many in + code → one out. Duals.', C().accent);
            } },

          { text: `A decoder selects one destination. A MUX selects one source. That is literally all the difference. And it is no accident that both are built from the same basic pattern — "match this input code with an AND gate."`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One Code, Two Roles', C().accent);
              b.drawNode('a', 260, 280, '"where does this go?"',   C().accent);
              b.drawNode('b', 260, 340, '"which one gets through?"', C().accent);
              b.drawNode('al', 580, 280, 'decoder', C().edgeRise);
              b.drawNode('bl', 580, 340, 'multiplexer', C().edgeRise);
              b.drawNode('note', 500, 460, 'inside a MUX, an entire decoder is doing work', C().accent);
              b.setLabel('We will see that literally in a few slides.', C().label);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 2 — 2-TO-1 MUX FROM GATES
    // ════════════════════════════════════════════════════
    {
      id: 2,
      title: 'The 2-to-1 MUX From Gates',
      pages: [
        { sentences: [
          { text: `Start with the simplest case. Two data inputs, A and B. One select line, S. One output, Y. When S is 0, we want Y to equal A. When S is 1, we want Y to equal B.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('2-to-1 MUX — Truth Table', C().accent);
              b.drawMux('mux', 430, 240, 120, 160, { inputs: 2, label: 'MUX 2:1' });
              b.drawNode('A-l', 370, 300, 'A', C().wireHi);
              b.drawNode('B-l', 370, 340, 'B', C().wireHi);
              b.drawNode('S-l', 485, 440, 'S', C().edgeRise);
              b.drawNode('Y-l', 570, 320, 'Y', C().edgeRise);
              b.drawTruthTable('tt', 80, 260, ['S','  Y  '], [
                [0, 'A'],
                [1, 'B'],
              ]);
              b.setLabel('Two-state selection. S picks either A or B to appear on Y.', C().accent);
            } },

          { text: `In boolean algebra that rule is: Y equals NOT-S AND A, OR-ed with S AND B. When S is 0, the left term passes A through and the right term is zero. When S is 1, the left term is zero and the right term passes B through. An OR combines them into one output.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Y = (¬S · A) + (S · B)', C().accent);
              _drawGate2to1(b, { S: 0, A: 1, B: 0 });
              b.setLabel('Two AND gates, one NOT, one OR. That is the entire 2-to-1 MUX.', C().accent);
            } },

          { text: `Watch what happens when S equals 0. The NOT gate outputs 1, so the top AND gate has NOT-S at 1 on one input. That AND now passes whatever A is straight through to its output. The bottom AND has S at 0 on one input, so its output is stuck at 0. The OR sees the A-value on one input and 0 on the other — so its output is A. Y equals A.`,
            dur: 17000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('S = 0  →  Y = A', C().edgeRise);
              _drawGate2to1(b, { S: 0, A: 1, B: 1 });
              b.drawNode('trace', 500, 560, 'top AND passes A. Bottom AND is silenced. Y = A.', C().edgeRise);
              b.setLabel('One AND is alive, the other is off. The OR just relays the live one.', C().edgeRise);
            } },

          { text: `Flip S to 1 and the roles swap. The NOT output goes to 0, silencing the top AND. S at 1 unlocks the bottom AND, which passes B through. The OR now delivers B. Y equals B.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('S = 1  →  Y = B', C().edgeRise);
              _drawGate2to1(b, { S: 1, A: 1, B: 1 });
              b.drawNode('trace', 500, 560, 'top AND is silenced. Bottom AND passes B. Y = B.', C().edgeRise);
              b.setLabel('Perfectly symmetric. Two possible "passes," S decides which AND is live.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 3 — SCALING
    // ════════════════════════════════════════════════════
    {
      id: 3,
      title: 'Scaling — 2^N Inputs, N Select Bits',
      pages: [
        { sentences: [
          { text: `Like a decoder, a MUX scales by doubling. Two inputs need one select bit. Four inputs need two. Eight inputs need three. In general, 2-to-the-N data inputs need N select bits.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('More Inputs → More Select Bits', C().accent);
              b.drawMux('m2',  80, 220, 120, 200, { inputs: 2, label: 'MUX 2:1' });
              b.drawMux('m4',  280, 180, 140, 240, { inputs: 4, label: 'MUX 4:1' });
              b.drawMux('m8',  500, 140, 160, 320, { inputs: 8, label: 'MUX 8:1' });
              b.drawMux('m16', 740, 100, 180, 400, { inputs: 16, label: 'MUX 16:1' });
              b.drawCustom('caption', (g, NS, COL) => {
                const rows = [
                  ['2:1',  '1 select bit'],
                  ['4:1',  '2 select bits'],
                  ['8:1',  '3 select bits'],
                  ['16:1', '4 select bits'],
                ];
                rows.forEach((r, i) => {
                  const y = 540 + i * 22;
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 100); t.setAttribute('y', y);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '12');
                  t.setAttribute('fill', COL.label);
                  t.textContent = r[0] + '   →   ' + r[1]; g.appendChild(t);
                });
              });
              b.setLabel('Same doubling rule as the decoder. Select code width grows logarithmically.', C().accent);
            } },

          { text: `Notice the inverse relationship with the decoder. An N-bit code addresses 2-to-the-N wires, whichever direction the data flows. Decoder = code in, many out. MUX = many in + code in, one out. Same information, different role.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Same Math, Mirrored Flow', C().accent);
              b.drawCustom('parity', (g, NS, COL) => {
                const lines = [
                  'decoder(N bits):  1 signal   →   2^N wires',
                  'MUX   (N bits):  2^N wires  →   1 signal',
                  '',
                  'both use the same N-bit code to identify the one that matters.',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 220); t.setAttribute('y', 240 + i * 42);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '16');
                  t.setAttribute('fill', i >= 3 ? COL.edgeRise : COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Every chip uses both. They are paired circuits.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 4 — 4-TO-1 FROM GATES
    // ════════════════════════════════════════════════════
    {
      id: 4,
      title: '4-to-1 From Gates — The Decoder Hidden Inside',
      pages: [
        { sentences: [
          { text: `Here is a 4-to-1 MUX, built from gates. Four data inputs I0 through I3. Two select bits S1 and S0. One output Y. Under the hood it's four AND gates, each attached to one data input, all feeding into a single OR gate.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('4-to-1 MUX — 4 ANDs + 1 OR', C().accent);
              _drawGate4to1(b, 0);
              b.setLabel('Each AND is a "gate" in the literal sense — it lets its input through only when told.', C().accent);
            } },

          { text: `Each AND gate's job is to let exactly one data input pass when its particular select code is present — otherwise stay silent. So each AND needs two things on its inputs: the actual data bit, AND a "this is my select code" signal. That second signal comes from a tiny decoder inside — a 2-to-4 decoder in this case.`,
            dur: 16500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A MUX Literally Contains A Decoder', C().edgeRise);
              _drawGate4to1(b, 2);
              b.setLabel('The box at the bottom IS a 2-to-4 decoder. It lights one AND at a time.', C().edgeRise);
            } },

          { text: `So when the select bits are "1 0", the decoder lights up its output line 2. That wire tells AND gate 2 "yes, pass your data through." The other three ANDs each have their "pass" input at 0 and stay silent. The OR gate sees one live input — I2 — and delivers it to Y.`,
            dur: 15500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Walk-Through — Select Code "10" Picks I2', C().edgeRise);
              _drawGate4to1(b, 2);
              b.drawNode('trace1', 500, 590,
                'decoder lights AND-2. AND-2 passes I2. The other ANDs output 0. OR sees I2. Y = I2.',
                C().edgeRise);
              b.setLabel('Same pattern every combination. The decoder picks the AND. The AND picks the data.', C().edgeRise);
            } },

          { text: `Here is a MUX running with four actual waveforms on its inputs, and a cycling select that visits every code in turn. Watch the output track whichever input the select is pointing at.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Live — Select Cycles, Output Follows', C().edgeRise);
              _drawAnimated4to1(b);
              b.setLabel('Four different waveforms on the inputs. Output mirrors whichever the select picks.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 5 — CASCADING / TREE
    // ════════════════════════════════════════════════════
    {
      id: 5,
      title: 'Cascading — Big MUXes From Small MUXes',
      pages: [
        { sentences: [
          { text: `There's another way to build a 4-to-1 MUX. Use three 2-to-1 MUXes arranged in a tree. The first two, each at the top, each pick between two inputs. The third, at the bottom, picks between those two intermediate results.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('4:1 From Three 2:1 MUXes', C().accent);
              _drawTree4to1(b, 2);
              b.setLabel('Three smaller MUXes, one tree. Still a 4:1. Just differently assembled.', C().accent);
            } },

          { text: `The two select bits get split across the levels. Select bit S0 controls the two upper MUXes — picking within each pair. Select bit S1 controls the final MUX, picking between the two intermediate winners.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Select Bits Split By Level', C().accent);
              _drawTree4to1(b, 3);
              b.drawNode('n', 500, 600, 'S0 → first level;   S1 → final level', C().accent);
              b.setLabel('Each level consumes one select bit. Simple recursive pattern.', C().accent);
            } },

          { text: `Why build it this way? It scales beautifully. A 16-to-1 MUX as a flat design needs sixteen large AND gates with 5-input ANDs. The tree version needs fifteen 2-input MUXes — easier to lay out, easier to route, and each stage is uniformly small.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Tree Scales Beautifully', C().edgeRise);
              b.drawCustom('scale', (g, NS, COL) => {
                const rows = [
                  ['flat N:1:',    'N ANDs with log₂N+1 inputs each'],
                  ['tree of 2:1s:','N−1 small uniform MUXes'],
                ];
                rows.forEach((r, i) => {
                  const y = 260 + i * 48;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 440); a.setAttribute('y', y);
                  a.setAttribute('text-anchor', 'end');
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '14');
                  a.setAttribute('fill', COL.label);
                  a.textContent = r[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 460); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '14');
                  b_.setAttribute('font-weight', '700');
                  b_.setAttribute('fill', COL.accent);
                  b_.textContent = r[1]; g.appendChild(b_);
                });
              });
              b.setLabel('Uniform stages are easier for chip designers. And easier on the transistors.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 — MUX VS TRI-STATE BUS
    // ════════════════════════════════════════════════════
    {
      id: 6,
      title: 'MUX vs. Tri-State Bus',
      pages: [
        { sentences: [
          { text: `We've now seen two separate circuits that let many signals share a single destination. One is the tri-state bus from the register episode — where each driver turns its output "off" unless it's selected. The other is the MUX we just built — where gates decide which input gets through.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Two Ways To Share A Wire', C().accent);
              // Tri-state version on the left
              b.drawBox('r1a', 80, 180, 120, 60, 'src A', C().accent);
              b.drawBox('r1b', 80, 260, 120, 60, 'src B', C().accent);
              b.drawBox('r1c', 80, 340, 120, 60, 'src C', C().accent);
              b.drawTriStateBuffer('ta', 220, 200, 40, 'right');
              b.drawTriStateBuffer('tb', 220, 280, 40, 'right');
              b.drawTriStateBuffer('tc', 220, 360, 40, 'right');
              b.drawWire('bus-t', [[260, 220],[380, 220],[380, 380],[260, 380]], C().wireHi);
              b.drawNode('label-t', 200, 150, 'tri-state bus', C().accent);
              // MUX version on the right
              b.drawMux('mux', 600, 200, 140, 200, { inputs: 3, label: 'MUX 3:1' });
              b.drawWire('i0', [[500, 250],[600, 250]], C().wireHi);
              b.drawWire('i1', [[500, 300],[600, 300]], C().wireHi);
              b.drawWire('i2', [[500, 350],[600, 350]], C().wireHi);
              b.drawWire('out', [[740, 300],[860, 300]], C().wireHi);
              b.drawNode('label-m', 670, 150, 'multiplexer', C().accent);
              b.setLabel('Same function — exactly one source reaches the output.', C().accent);
            } },

          { text: `The difference is mechanical. Tri-state buffers temporarily let go of the wire — they "float," electrically absent from the shared line, until their enable line tells them to drive. MUXes never let go; they just structurally route inputs through gates instead of actually sharing a wire.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Mechanical Difference', C().accent);
              b.drawCustom('diff', (g, NS, COL) => {
                const lines = [
                  ['tri-state:', 'all drivers connected to one physical wire · only one drives at a time · rest go high-impedance'],
                  ['MUX:',       'inputs structurally separate · gates choose which routes through · no one ever "lets go" of a wire'],
                ];
                lines.forEach((r, i) => {
                  const y = 280 + i * 70;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 140); a.setAttribute('y', y);
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '14');
                  a.setAttribute('font-weight', '700');
                  a.setAttribute('fill', COL.accent);
                  a.textContent = r[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 300); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '13');
                  b_.setAttribute('fill', COL.label);
                  b_.textContent = r[1]; g.appendChild(b_);
                });
              });
              b.setLabel('One shares a physical wire. The other routes through dedicated gates.', C().accent);
            } },

          { text: `When does each win? Tri-state is better for buses that span large distances on a chip — a long shared wire is cheaper than dragging every signal through a giant MUX. MUXes are better for tightly-clustered data paths inside a CPU, where the logic is structured and the wires are short.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('When Each Wins', C().accent);
              b.drawCustom('rules', (g, NS, COL) => {
                const items = [
                  ['tri-state:', 'long buses, many drivers, memory / I/O, off-chip'],
                  ['MUX:',       'short structured data paths, inside ALU, pipeline stages, register file'],
                ];
                items.forEach((r, i) => {
                  const y = 280 + i * 70;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 160); a.setAttribute('y', y);
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '16');
                  a.setAttribute('font-weight', '700');
                  a.setAttribute('fill', COL.edgeRise);
                  a.textContent = r[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 320); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '15');
                  b_.setAttribute('fill', COL.accent);
                  b_.textContent = r[1]; g.appendChild(b_);
                });
              });
              b.setLabel('Real chips use both. Different jobs, different tools.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 7 — WHERE MUXES HIDE IN A CPU
    // ════════════════════════════════════════════════════
    {
      id: 7,
      title: 'Where MUXes Hide In A CPU',
      pages: [
        { sentences: [
          { text: `Inside the ALU. Addition, subtraction, AND, OR, XOR — each of these is computed by its own circuit, simultaneously. But only one result reaches the output. A MUX, driven by the instruction's opcode, picks which operation's result counts.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Inside The ALU', C().accent);
              b.drawBox('add', 100, 180, 160, 60, 'adder',     C().accent);
              b.drawBox('sub', 100, 260, 160, 60, 'subtractor', C().accent);
              b.drawBox('and', 100, 340, 160, 60, 'AND unit',  C().accent);
              b.drawBox('or',  100, 420, 160, 60, 'OR unit',   C().accent);
              b.drawMux('mux', 340, 200, 140, 280, { inputs: 4, label: 'MUX 4:1' });
              for (let i = 0; i < 4; i++) {
                const y = 210 + i * 80;
                b.drawWire('w' + i, [[260, y],[340, y]], (i === 0) ? C().edgeRise : C().dim);
              }
              b.drawWire('out', [[480, 340],[700, 340]], C().edgeRise);
              b.drawNode('o-l', 720, 340, 'ALU result', C().edgeRise);
              b.drawWire('sel', [[410, 540],[410, 480]], C().edgeRise);
              b.drawNode('sel-l', 440, 560, 'opcode → select', C().edgeRise);
              b.setLabel('All units compute in parallel. The opcode tells the MUX which result to deliver.', C().accent);
            } },

          { text: `In the program counter. The PC's new value is either the incrementer's output — for a normal instruction — or a branch target from the instruction itself. A MUX, driven by the BRANCH signal, picks between them. We saw this in the counter episode.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Inside The Program Counter', C().accent);
              b.drawBox('inc', 120, 220, 140, 70, '+ 1', C().accent);
              b.drawBox('tgt', 120, 340, 140, 70, 'jump target', C().accent);
              b.drawMux('mux', 340, 220, 130, 200, { inputs: 2, label: 'MUX 2:1' });
              b.drawWire('ia', [[260, 260],[340, 260]], C().wireHi);
              b.drawWire('ib', [[260, 380],[340, 380]], C().wireHi);
              b.drawWire('sel', [[405, 500],[405, 420]], C().edgeRise);
              b.drawNode('sel-l', 370, 520, 'BRANCH', C().edgeRise);
              b.drawBox('pc', 540, 260, 180, 120, 'PC REGISTER', C().edgeRise);
              b.drawWire('o', [[470, 320],[540, 320]], C().wireHi);
              b.setLabel('Every branch taken is the MUX selecting the jump-target path instead of PC+1.', C().accent);
            } },

          { text: `In the register file. Every instruction reads operands from registers. "Give me the value of register 7" is a MUX — sixteen or thirty-two registers feed their outputs into a giant MUX, and a 4- or 5-bit field from the instruction picks which one.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Inside The Register File', C().accent);
              for (let i = 0; i < 8; i++) {
                const y = 160 + i * 40;
                b.drawBox('r' + i, 120, y, 80, 28, 'R' + i, C().accent);
                b.drawWire('w' + i, [[200, y + 14],[340, y + 14]], (i === 5) ? C().edgeRise : C().dim);
              }
              b.drawMux('mux', 340, 140, 140, 340, { inputs: 8, label: 'MUX 8:1' });
              b.drawWire('o', [[480, 310],[640, 310]], C().edgeRise);
              b.drawNode('o-l', 660, 310, 'read port A', C().edgeRise);
              b.drawWire('sel', [[410, 560],[410, 480]], C().edgeRise);
              b.drawNode('sel-l', 360, 580, 'reg select (3 bits)', C().edgeRise);
              b.setLabel('Each "register read" in an instruction is literally a MUX picking that register\u2019s output.', C().accent);
            } },

          { text: `Every if-else in hardware. Conditional assignment — "if this signal is 1, the output is A, otherwise it's B" — is exactly a 2-to-1 MUX. So every single conditional piece of logic in a CPU's data path is another MUX, somewhere.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Every "If-Else" In Hardware Is A MUX', C().edgeRise);
              b.drawCustom('ifelse', (g, NS, COL) => {
                const code = [
                  '// software',
                  'if (cond)',
                  '    y = A;',
                  'else',
                  '    y = B;',
                ];
                code.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 120); t.setAttribute('y', 240 + i * 32);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '16');
                  t.setAttribute('fill', i === 0 ? COL.label : COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.drawMux('m', 580, 220, 160, 200, { inputs: 2, label: 'MUX 2:1' });
              b.drawWire('ia', [[480, 270],[580, 270]], C().wireHi);
              b.drawNode('A', 460, 270, 'A', C().wireHi);
              b.drawWire('ib', [[480, 360],[580, 360]], C().wireHi);
              b.drawNode('B', 460, 360, 'B', C().wireHi);
              b.drawWire('s', [[660, 460],[660, 420]], C().edgeRise);
              b.drawNode('s-l', 630, 480, 'cond', C().edgeRise);
              b.drawWire('y', [[740, 320],[880, 320]], C().edgeRise);
              b.drawNode('y-l', 890, 320, 'y', C().edgeRise);
              b.setLabel('Every hardware conditional is a MUX. Without MUXes, there is no branching logic.', C().edgeRise);
            } },

          { text: `Once you see them, you cannot stop. A modern CPU data path — pipeline bypassing, register forwarding, result writeback, address generation — is a dense tangle of MUXes everywhere. They are the glue of the machine.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A CPU Data Path — A Network Of MUXes', C().edgeRise);
              b.drawChipOutline('die', 150, 140, 700, 400, 'DATA PATH');
              // Sprinkle MUX trapezoids
              for (let i = 0; i < 12; i++) {
                const x = 200 + (i % 4) * 160;
                const y = 200 + Math.floor(i / 4) * 100;
                b.drawMux('m' + i, x, y, 80, 70, { inputs: 2, label: '' });
              }
              b.setLabel('MUXes are the most common combinational block in every CPU. Thousands of them.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 8 — RECAP
    // ════════════════════════════════════════════════════
    {
      id: 8,
      title: 'Recap — The Multiplexer',
      pages: [
        { sentences: [
          { text: `Let's trace the build. A multiplexer takes 2-to-the-N data inputs plus an N-bit select code, and routes exactly one of those inputs to its single output. It's the dual of the decoder: the decoder picks a destination, the MUX picks a source.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 1 — The Idea', C().accent);
              b.drawMux('mux', 400, 180, 200, 280, { inputs: 4, label: 'MUX 4:1' });
              for (let i = 0; i < 4; i++) {
                const y = 260 + i * 40;
                b.drawWire('in' + i, [[240, y],[400, y]], i === 2 ? C().edgeRise : C().dim);
              }
              b.drawWire('out', [[600, 320],[760, 320]], C().edgeRise);
              b.setLabel('Many in → code picks → one out.', C().accent);
            } },

          { text: `The simplest — a 2-to-1 — is four gates. Two ANDs watching the data inputs, one NOT inverting the select, and one OR combining them. Y = NOT-S AND A, OR S AND B. Only one AND is ever "alive" at a time.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 2 — 2-to-1 From Gates', C().accent);
              _drawGate2to1(b, { S: 1, A: 1, B: 0 });
              b.setLabel('Four gates total. The smallest possible MUX.', C().accent);
            } },

          { text: `For bigger MUXes, use 2^N ANDs plus one large OR — and note that the select logic inside is literally a decoder. Every MUX contains a decoder.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 3 — Bigger MUXes Contain Decoders', C().accent);
              _drawGate4to1(b, 1);
              b.setLabel('The MUX and the decoder are not just duals in name. They live inside each other.', C().accent);
            } },

          { text: `Or cascade small 2-to-1 MUXes into a tree. Uniform stages, easier to lay out. That's how big MUXes are usually built inside a real chip.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 4 — Cascaded Tree', C().accent);
              _drawTree4to1(b, 1);
              b.setLabel('Same 4:1 behaviour. Three uniform 2:1 MUXes. Cleaner silicon layout.', C().accent);
            } },

          { text: `MUXes and tri-state buffers both let many sources share one wire. Tri-state is better for long buses, MUX for short structured data paths inside a CPU.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 5 — MUX vs. Tri-State', C().accent);
              b.drawBox('t', 100, 260, 340, 120, 'tri-state: shared wire', C().accent);
              b.drawBox('m', 560, 260, 340, 120, 'MUX: structured gates', C().accent);
              b.setLabel('Two tools, different jobs. Every chip uses both.', C().accent);
            } },

          { text: `That is the multiplexer. The "pick one source" circuit. ALU result selection, register file reads, next-PC logic, every conditional in hardware — all MUXes. Together with the decoder, they are the steering mechanism that moves data through a CPU.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The MUX — Steering The Data Path', C().edgeRise);
              _drawAnimated4to1(b);
              b.setLabel('Decoder chooses destinations. MUX chooses sources. Together, the data path steers itself.', C().edgeRise);
            } },

          { text: `Next episode, the comparator. A circuit that looks at two numbers and answers one question: are they equal? Is one bigger? That simple question turns out to be what every if-statement in every program ultimately runs on.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Next: The Comparator', C().accent);
              b.drawBox('cmp', 360, 220, 280, 180, 'COMPARATOR', C().edgeRise);
              b.drawNode('a', 280, 280, 'A →', C().wireHi);
              b.drawNode('b', 280, 340, 'B →', C().wireHi);
              b.drawWire('wa', [[320, 280],[360, 280]], C().wireHi);
              b.drawWire('wb', [[320, 340],[360, 340]], C().wireHi);
              for (let i = 0; i < 3; i++) {
                const y = 260 + i * 40;
                b.drawWire('o' + i, [[640, y],[720, y]], C().wireHi);
              }
              b.drawNode('o1', 740, 260, 'A = B', C().edgeRise);
              b.drawNode('o2', 740, 300, 'A < B', C().edgeRise);
              b.drawNode('o3', 740, 340, 'A > B', C().edgeRise);
              b.setLabel('Three simple questions. Answered in a single clock cycle.', C().accent);
            } },
        ] },
      ],
      showAll: true,
      isFinal: true,
    },
  ];

  if (typeof window !== 'undefined') {
    window.BLOCKS_06_SCENES = BLOCKS_06_SCENES;
  }
})();
