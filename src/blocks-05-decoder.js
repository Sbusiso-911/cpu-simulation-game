/**
 * Series B — Episode 5: How a Decoder Is Built
 * ----------------------------------------------
 * A decoder takes an N-bit binary code and activates exactly one of 2^N
 * output wires. It is the circuit that turns an address into "select this
 * one RAM row" or an opcode into "do this one operation." Without it,
 * memory and instruction decoding would not work.
 *
 * Arc:
 *   0. Hook                       RAM has millions of cells — wake exactly one
 *   1. One-hot output             the truth table for a 3→8 decoder
 *   2. Build 2→4 from gates       NOTs + 4 ANDs, one per combination
 *   3. Scaling & patterns         2→4, 3→8, 4→16 — pattern clear
 *   4. RAM row addressing         the canonical killer use case
 *   5. Hierarchical (row×col)     how real memory decodes large addresses
 *   6. Enable / chip-select       EN=0 turns everything off
 *   7. The encoder                inverse operation (keyboard, priority)
 *   8. Decoders everywhere        instruction decode, demux, 7-seg, chip-select
 *   9. Recap                      trust chain + MUX teaser
 *
 * Walk-the-talk: every anim() exactly matches its narration.
 */

(function () {
  'use strict';

  const B = () => window.Blocks;
  const C = () => window.Blocks && window.Blocks.COL;

  // ─────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────

  // Draw a decoder as a labelled trapezoid with N input stubs on the left and
  // 2^N output stubs on the right. `active` (0..2^N-1) is the lit output.
  // Returns an object with the coordinates of input/output pins so callers
  // can draw wires into / out of them.
  function _drawDecoderBox(b, id, x, y, n, active, opts) {
    opts = opts || {};
    const col = C();
    const outCount = 1 << n;
    const w = opts.w || 160;
    const h = Math.max(120, outCount * 18 + 40);
    b.drawBox(id, x, y, w, h, opts.label || (n + '→' + outCount), col.accent);

    // Input pins (left side)
    const inputs = [];
    for (let i = 0; i < n; i++) {
      const py = y + (h / (n + 1)) * (i + 1);
      inputs.push({ x: x, y: py, name: 'A' + (n - 1 - i) });
      b.drawNode(id + '-i' + i, x - 40, py, 'A' + (n - 1 - i), col.label);
    }

    // Output pins (right side)
    const outputs = [];
    for (let i = 0; i < outCount; i++) {
      const py = y + (h / (outCount + 1)) * (i + 1);
      outputs.push({ x: x + w, y: py, name: 'Y' + i });
      const isActive = i === active;
      b.drawNode(id + '-o' + i, x + w + 46, py,
        'Y' + i, isActive ? col.edgeRise : col.dim);
      b.drawWire(id + '-ow' + i, [[x + w, py], [x + w + 30, py]],
        isActive ? col.wireHi : col.dim);
    }

    return { inputs, outputs, x, y, w, h };
  }

  // Explicit gate-level 2-to-4 decoder. highlightActive = 0..3 or -1.
  function _drawGateLevel2to4(b, highlightActive) {
    const col = C();
    const ha = highlightActive;
    // Two inputs: A1 (top), A0 (bottom). Each goes to a NOT gate too.
    b.drawNode('A1', 60, 140, 'A1', col.accent);
    b.drawNode('A0', 60, 460, 'A0', col.accent);

    // NOT gates
    b.drawGate('not-A1', 'NOT', 120, 180, 60, 40);
    b.drawGate('not-A0', 'NOT', 120, 420, 60, 40);

    // AND gates — 4 of them
    //   Y0 = ¬A1 · ¬A0
    //   Y1 = ¬A1 ·  A0
    //   Y2 =  A1 · ¬A0
    //   Y3 =  A1 ·  A0
    b.drawGate('and-0', 'AND', 360,  80, 130, 80);
    b.drawGate('and-1', 'AND', 360, 200, 130, 80);
    b.drawGate('and-2', 'AND', 360, 320, 130, 80);
    b.drawGate('and-3', 'AND', 360, 440, 130, 80);

    if (ha !== undefined && ha >= 0 && ha < 4) {
      b.setState('and-' + ha, 'glow');
    }

    const hi  = col.wireHi;
    const dim = col.dim;

    // Wiring — we'll route through a vertical "rail" to keep it tidy.
    // A1 rail (used by AND-2, AND-3)
    b.drawWire('w-A1',     [[80, 140],[220, 140],[220, 220]], hi);
    b.drawWire('w-A1-and2',[[220, 220],[220, 340],[360, 340]], hi);
    b.drawWire('w-A1-and3',[[220, 340],[220, 460],[360, 460]], hi);
    // NOT A1 rail (used by AND-0, AND-1)
    b.drawWire('w-A1-to-not',[[80, 140],[120, 140],[120, 200]], hi);
    b.drawWire('w-notA1',  [[180, 200],[260, 200],[260, 100]], hi);
    b.drawWire('w-notA1-and0',[[260, 100],[360, 100]], hi);
    b.drawWire('w-notA1-and1',[[260, 100],[260, 220],[360, 220]], hi);
    // A0 rail (used by AND-1, AND-3)
    b.drawWire('w-A0',     [[80, 460],[200, 460],[200, 260]], hi);
    b.drawWire('w-A0-and1',[[200, 260],[360, 260]], hi);
    b.drawWire('w-A0-and3',[[200, 260],[200, 480],[360, 480]], hi);
    // NOT A0 rail (used by AND-0, AND-2)
    b.drawWire('w-A0-to-not',[[80, 460],[120, 460],[120, 440]], hi);
    b.drawWire('w-notA0',  [[180, 440],[240, 440],[240, 140]], hi);
    b.drawWire('w-notA0-and0',[[240, 140],[360, 140]], hi);
    b.drawWire('w-notA0-and2',[[240, 340],[240, 360],[360, 360]], hi);

    // Output labels
    b.drawWire('w-y0', [[490, 120],[580, 120]], ha === 0 ? col.edgeRise : dim);
    b.drawWire('w-y1', [[490, 240],[580, 240]], ha === 1 ? col.edgeRise : dim);
    b.drawWire('w-y2', [[490, 360],[580, 360]], ha === 2 ? col.edgeRise : dim);
    b.drawWire('w-y3', [[490, 480],[580, 480]], ha === 3 ? col.edgeRise : dim);
    b.drawNode('y0-l', 590, 120, 'Y0 = ¬A1 · ¬A0', ha === 0 ? col.edgeRise : col.dim);
    b.drawNode('y1-l', 590, 240, 'Y1 = ¬A1 ·  A0', ha === 1 ? col.edgeRise : col.dim);
    b.drawNode('y2-l', 590, 360, 'Y2 =  A1 · ¬A0', ha === 2 ? col.edgeRise : col.dim);
    b.drawNode('y3-l', 590, 480, 'Y3 =  A1 ·  A0', ha === 3 ? col.edgeRise : col.dim);
  }

  // Draw a simplified RAM grid — rows × cols of cells, one row highlighted.
  function _drawRamGrid(b, x, y, rows, cols, activeRow) {
    const col = C();
    const cellW = 28, cellH = 18, gap = 2;
    b.drawCustom('ram-grid', (g, NS, COL) => {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const rect = document.createElementNS(NS, 'rect');
          rect.setAttribute('x', x + c * (cellW + gap));
          rect.setAttribute('y', y + r * (cellH + gap));
          rect.setAttribute('width', cellW);
          rect.setAttribute('height', cellH);
          rect.setAttribute('fill', r === activeRow ? COL.edgeRise : COL.panel);
          rect.setAttribute('stroke', COL.gateEdge);
          rect.setAttribute('stroke-width', '1');
          g.appendChild(rect);
        }
      }
      // Row-enable labels
      for (let r = 0; r < rows; r++) {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x - 10);
        t.setAttribute('y', y + r * (cellH + gap) + cellH - 4);
        t.setAttribute('text-anchor', 'end');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '10');
        t.setAttribute('fill', r === activeRow ? COL.edgeRise : COL.dim);
        t.textContent = 'row ' + r; g.appendChild(t);
      }
    });
  }

  // ─────────────────────────────────────────
  //  SCENES
  // ─────────────────────────────────────────
  const BLOCKS_05_SCENES = [

    // ════════════════════════════════════════════════════
    // SCENE 0 — HOOK
    // ════════════════════════════════════════════════════
    {
      id: 0,
      title: 'Wake Exactly One Cell',
      pages: [
        { sentences: [
          { text: `A modern RAM chip holds millions — sometimes billions — of storage cells. When the CPU asks for the byte at address forty-two million, one hundred seventy-six thousand, nine hundred twenty-one — exactly one cell has to wake up and respond. Not zero. Not two. One.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One Address → One Cell', C().edgeRise);
              _drawRamGrid(b, 260, 180, 16, 16, 10);
              b.drawNode('addr', 500, 480, 'address 42,176,921  →  exactly one cell responds', C().edgeRise);
              b.setLabel('How does the chip pick the right cell, from millions, in one clock cycle?', C().accent);
            } },

          { text: `Same problem in a different place. A CPU has sixteen registers. An instruction says "write the result to register 5." Exactly one register has to accept the new value, while the other fifteen ignore the bus entirely.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Same Problem — Pick One Register', C().accent);
              for (let i = 0; i < 16; i++) {
                const cx = 80 + (i % 8) * 110;
                const cy = 200 + Math.floor(i / 8) * 140;
                const hl = i === 5;
                b.drawBox('r' + i, cx, cy, 90, 80, 'R' + i, hl ? C().edgeRise : C().label);
              }
              b.drawNode('inst', 500, 500, 'instruction says "write R5" → exactly R5 captures the value', C().edgeRise);
              b.setLabel('Same structural problem. Many candidates. One coded selector. Wake exactly one.', C().accent);
            } },

          { text: `The circuit that does this job is called a decoder. It takes a binary number and lights up exactly one of many output wires. Let's see how.`,
            dur: 9000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Decoder', C().edgeRise);
              _drawDecoderBox(b, 'dec', 360, 200, 3, 5);
              b.drawNode('in',  280, 280, 'binary in', C().wireHi);
              b.drawNode('out', 680, 280, 'one-hot out', C().edgeRise);
              b.setLabel('N-bit code in. Exactly one of 2^N output wires activated.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 1 — ONE-HOT OUTPUT
    // ════════════════════════════════════════════════════
    {
      id: 1,
      title: 'One-Hot Output',
      pages: [
        { sentences: [
          { text: `Here is exactly what a decoder does. Three input bits — A2, A1, A0 — can take eight different combinations, from 000 through 111. We give the decoder eight output wires, Y0 through Y7.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('3 Inputs, 8 Outputs', C().accent);
              _drawDecoderBox(b, 'dec', 400, 160, 3, 0);
              b.setLabel('3 input bits carry a number 0 to 7. 8 output wires, one per possible value.', C().accent);
            } },

          { text: `The rule: whichever binary number is on the inputs, the output wire with that number is lit. All other output wires are off.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Input Number = Active Output Number', C().edgeRise);
              _drawDecoderBox(b, 'dec', 400, 160, 3, 3);
              b.drawNode('eq', 500, 520, 'input  011  (= 3)   →   Y3 active, all others off', C().edgeRise);
              b.setLabel('Change the input by one, and exactly one new wire becomes active — a different one.', C().edgeRise);
            } },

          { text: `This is called one-hot output. At any instant, exactly one of the 2^N output wires is at logic 1, and all the rest are at logic 0. Useful for selecting exactly one destination, exactly one row, exactly one register.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One-Hot — Exactly One Wire At a Time', C().accent);
              b.drawTruthTable('tt', 300, 160, ['A2','A1','A0','  active output  '], [
                [0,0,0,'Y0'],
                [0,0,1,'Y1'],
                [0,1,0,'Y2'],
                [0,1,1,'Y3'],
                [1,0,0,'Y4'],
                [1,0,1,'Y5'],
                [1,1,0,'Y6'],
                [1,1,1,'Y7'],
              ]);
              b.setLabel('An invariant: exactly one output is 1, always, no matter the input.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 2 — BUILD 2-TO-4 FROM GATES
    // ════════════════════════════════════════════════════
    {
      id: 2,
      title: 'Build It From Gates — 2-to-4',
      pages: [
        { sentences: [
          { text: `Let's build the smallest useful decoder from logic gates. Two input bits, four output wires — a 2-to-4 decoder. The principle: each output wire watches for its specific combination of inputs.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The 2-to-4 Decoder', C().accent);
              _drawDecoderBox(b, 'dec', 400, 200, 2, 0);
              b.drawTruthTable('tt', 80, 200, ['A1','A0','active'], [
                [0,0,'Y0'],
                [0,1,'Y1'],
                [1,0,'Y2'],
                [1,1,'Y3'],
              ]);
              b.setLabel('Four combinations → four output wires. Watch how each output computes its own row.', C().accent);
            } },

          { text: `Each output wire is an AND gate. AND outputs 1 only when all its inputs are 1. So we wire each AND to detect exactly one input combination — using NOT gates to invert any input that should be 0 for that row.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Each Row = One AND Gate', C().accent);
              _drawGateLevel2to4(b, -1);
              b.setLabel('Four AND gates. Two NOT gates. Each AND watches for one specific input combination.', C().accent);
            } },

          { text: `For example, Y0 should be 1 only when A1=0 and A0=0. So we AND together NOT-A1 and NOT-A0. When both are 1 — meaning both inputs are 0 — the AND fires. Any other combination has at least one input at 0 to that AND, so its output stays low.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Y0 = ¬A1 · ¬A0', C().accent);
              _drawGateLevel2to4(b, 0);
              b.drawNode('note', 500, 560, 'inputs A1=0, A0=0  →  both NOT gates output 1  →  AND-0 fires', C().edgeRise);
              b.setLabel('The AND gate IS the row-selector. It only outputs 1 when its exact input pattern is on.', C().edgeRise);
            } },

          { text: `Same logic for the other three outputs. Y1 fires when A1 is 0 and A0 is 1. Y2 when A1 is 1 and A0 is 0. Y3 when both A1 and A0 are 1. Four ANDs, two inverters, and we have a decoder.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('All Four Outputs — Each Row Has Its Own AND', C().accent);
              _drawGateLevel2to4(b, 2);
              b.setLabel('Example shown: A1=1, A0=0 → Y2 fires. Other ANDs each have at least one input at 0.', C().accent);
            } },

          { text: `Check the invariant. For any input combination, exactly one AND gate has all its inputs at 1. The other three always have at least one input at 0. So exactly one output is lit. Always. Guaranteed by construction.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One-Hot — Guaranteed By Construction', C().edgeRise);
              _drawGateLevel2to4(b, 3);
              b.drawNode('inv', 500, 560, 'every input combination matches exactly one AND gate\u2019s row pattern', C().edgeRise);
              b.setLabel('No other possibility. Two outputs can never be lit at once. The math guarantees it.', C().edgeRise);
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
      title: 'Scaling — More Inputs, Exponentially More Outputs',
      pages: [
        { sentences: [
          { text: `The pattern is easy to extend. Three inputs means eight possible combinations, so a 3-to-8 decoder needs eight AND gates. Four inputs give sixteen combinations — a 4-to-16 decoder needs sixteen AND gates. The number of gates doubles for every input bit added.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Input Bits Grow Linearly — Outputs Grow Exponentially', C().accent);
              _drawDecoderBox(b, 'd24', 80,  140, 2, -1, { label: '2→4' });
              _drawDecoderBox(b, 'd38', 380, 140, 3, -1, { label: '3→8' });
              _drawDecoderBox(b, 'd4', 720,  140, 4, -1, { label: '4→16' });
              b.setLabel('Each new input bit doubles the number of outputs — and the number of gates.', C().accent);
            } },

          { text: `This is the double-edged sword of decoders. Every extra bit of address doubles the hardware. Decoding an 8-bit address flat requires two hundred and fifty-six AND gates. A 20-bit address would need over a million. A 32-bit address: over four billion. Flat decoders simply don't scale.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Scaling Wall', C().wireHot);
              b.drawCustom('scale', (g, NS, COL) => {
                const rows = [
                  ['2-to-4',   '4 ANDs'],
                  ['3-to-8',   '8 ANDs'],
                  ['4-to-16',  '16 ANDs'],
                  ['8-to-256', '256 ANDs'],
                  ['16-to-65K', '65,536 ANDs'],
                  ['20-to-1M',  '1,048,576 ANDs'],
                  ['32-to-4G',  '4,294,967,296 ANDs  (no)'],
                ];
                rows.forEach((row, i) => {
                  const y = 200 + i * 38;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 300); a.setAttribute('y', y);
                  a.setAttribute('text-anchor', 'end');
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '15');
                  a.setAttribute('font-weight', '700');
                  a.setAttribute('fill', i >= 5 ? COL.wireHot : COL.accent);
                  a.textContent = row[0]; g.appendChild(a);
                  const arr = document.createElementNS(NS, 'text');
                  arr.setAttribute('x', 320); arr.setAttribute('y', y);
                  arr.setAttribute('font-family', 'monospace');
                  arr.setAttribute('font-size', '15');
                  arr.setAttribute('fill', COL.label);
                  arr.textContent = '→  ' + row[1]; g.appendChild(arr);
                });
              });
              b.setLabel('A flat decoder for a real address space is physically impossible. We need a smarter approach.', C().wireHot);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 4 — RAM ROW ADDRESSING
    // ════════════════════════════════════════════════════
    {
      id: 4,
      title: 'The Canonical Use — Addressing RAM',
      pages: [
        { sentences: [
          { text: `Here's where decoders really live. Inside a RAM chip, each storage cell sits at a grid location. The chip receives an address from the CPU, runs it through a decoder, and the decoder lights up exactly one row-enable wire.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('RAM = Grid of Cells + A Decoder', C().accent);
              _drawRamGrid(b, 360, 180, 16, 16, 7);
              _drawDecoderBox(b, 'dec', 80, 200, 4, 7, { w: 160, label: '4→16' });
              b.drawWire('enable', [[240, 330],[360, 330]], C().edgeRise);
              b.drawNode('addr-l', 40, 300, 'address in', C().wireHi);
              b.drawNode('row-hi', 540, 160, '← row 7 enabled', C().edgeRise);
              b.setLabel('The address bits enter the decoder. Exactly one row-enable wire is driven high.', C().accent);
            } },

          { text: `That row-enable wire runs across the cells of one row. The cells on that row connect their stored values to a shared data bus. Every other row stays disconnected. The CPU sees only the selected row's data.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Row Enable → Cells Drive The Data Bus', C().edgeRise);
              _drawRamGrid(b, 360, 180, 16, 16, 7);
              b.drawWire('bus', [[360, 510],[820, 510]], C().wireHi);
              b.drawNode('bus-l', 500, 530, 'shared data bus', C().wireHi);
              b.drawWire('tap', [[500, 310],[500, 510]], C().edgeRise);
              b.setLabel('The enabled row\u2019s cells open their tri-state outputs. All other rows remain silent.', C().edgeRise);
            } },

          { text: `One decoder inside a RAM chip does the whole job of selecting. An N-bit address means 2^N possible rows, and the decoder picks the right one. That is why addressing a memory location takes just one clock cycle — the decoder does it all combinationally.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One Cycle, One Cell Selected', C().accent);
              _drawRamGrid(b, 360, 180, 16, 16, 11);
              _drawDecoderBox(b, 'dec', 80, 200, 4, 11, { w: 160, label: '4→16' });
              b.drawWire('enable', [[240, 385],[360, 385]], C().edgeRise);
              b.drawNode('cycle', 500, 550, 'no clock edges needed — the decoder is pure combinational logic', C().accent);
              b.setLabel('Address arrives. Gates propagate. Row is selected. Data is read. One cycle.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 5 — HIERARCHICAL DECODING
    // ════════════════════════════════════════════════════
    {
      id: 5,
      title: 'Hierarchical Decoding — How Big Memories Do It',
      pages: [
        { sentences: [
          { text: `We just said a flat decoder for a 20-bit address would need over a million AND gates. So how does a real RAM chip — which has far more than a million cells — actually work? The trick is a hierarchical split.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Split The Address Into Halves', C().accent);
              b.drawNode('addr', 500, 200, '20-bit address  =  10 high bits  ·  10 low bits', C().accent);
              b.drawBox('hi',  200, 280, 240, 110, '10 high bits → row', C().accent);
              b.drawBox('lo',  560, 280, 240, 110, '10 low bits → column', C().accent);
              b.setLabel('Physically arrange memory as a 2D grid, and decode each dimension separately.', C().accent);
            } },

          { text: `Arrange the cells as a square grid — say, 1024 rows by 1024 columns. The high half of the address selects one row, using a small 10-to-1024 decoder. The low half selects one column, using another 10-to-1024 decoder. The single cell at their intersection is the one we want.`,
            dur: 15500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('2D Grid — Row × Column', C().edgeRise);
              _drawRamGrid(b, 280, 160, 16, 16, 9);
              // Highlight one column too
              b.drawCustom('col-highlight', (g, NS, COL) => {
                const rect = document.createElementNS(NS, 'rect');
                rect.setAttribute('x', 280 + 11 * 30);
                rect.setAttribute('y', 160);
                rect.setAttribute('width', 28);
                rect.setAttribute('height', 16 * 20);
                rect.setAttribute('fill', COL.accent);
                rect.setAttribute('opacity', '0.15');
                g.appendChild(rect);
              });
              b.drawNode('row', 820, 340, '← row 9',    C().edgeRise);
              b.drawNode('col', 610, 140, 'column 11', C().accent);
              b.drawNode('one', 500, 540, 'exactly one cell at the intersection', C().edgeRise);
              b.setLabel('Two decoders, each small. Their outputs AND together to pick one cell.', C().edgeRise);
            } },

          { text: `Count the gates. Two 10-to-1024 decoders is 1024 plus 1024, about two thousand AND gates — total. Compare to the flat design's one million. A 500-fold reduction, for the same addressing power. And it scales: splitting further gives even more savings.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Huge Savings From The Split', C().edgeRise);
              b.drawCustom('compare', (g, NS, COL) => {
                const items = [
                  ['flat 20-to-1M decoder:',        '1,048,576 AND gates', COL.wireHot],
                  ['two 10-to-1024 decoders:',     '2,048 AND gates',     COL.edgeRise],
                  ['savings factor:',               '~500×',                COL.accent],
                ];
                items.forEach((row, i) => {
                  const y = 240 + i * 50;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 540); a.setAttribute('y', y);
                  a.setAttribute('text-anchor', 'end');
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '16');
                  a.setAttribute('fill', COL.label);
                  a.textContent = row[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 560); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '17');
                  b_.setAttribute('font-weight', '700');
                  b_.setAttribute('fill', row[2]);
                  b_.textContent = row[1]; g.appendChild(b_);
                });
              });
              b.setLabel('Hierarchy is everywhere in hardware. The same trick appears in networks, caches, and more.', C().edgeRise);
            } },

          { text: `Every real RAM chip is physically organized this way — the row decoder is along one edge of the silicon die, the column decoder along another. Open a DRAM and you can literally see the two decoder strips. It isn't an abstraction. It is the layout.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Physical Layout Of A DRAM', C().accent);
              b.drawCustom('dram-layout', (g, NS, COL) => {
                // Die outline
                const die = document.createElementNS(NS, 'rect');
                die.setAttribute('x', 260); die.setAttribute('y', 160);
                die.setAttribute('width', 500); die.setAttribute('height', 350);
                die.setAttribute('rx', 8);
                die.setAttribute('fill', COL.panel); die.setAttribute('stroke', COL.gateEdge);
                die.setAttribute('stroke-width', '2'); die.setAttribute('stroke-dasharray', '6,4');
                g.appendChild(die);
                // Main array
                const arr = document.createElementNS(NS, 'rect');
                arr.setAttribute('x', 340); arr.setAttribute('y', 240);
                arr.setAttribute('width', 380); arr.setAttribute('height', 230);
                arr.setAttribute('fill', COL.edgeRise); arr.setAttribute('opacity', '0.15');
                arr.setAttribute('stroke', COL.accent); arr.setAttribute('stroke-width', '1');
                g.appendChild(arr);
                const arrL = document.createElementNS(NS, 'text');
                arrL.setAttribute('x', 530); arrL.setAttribute('y', 360);
                arrL.setAttribute('text-anchor', 'middle'); arrL.setAttribute('font-family', 'monospace');
                arrL.setAttribute('font-size', '14'); arrL.setAttribute('fill', COL.edgeRise);
                arrL.textContent = 'memory array'; g.appendChild(arrL);
                // Row decoder strip on the left
                const row = document.createElementNS(NS, 'rect');
                row.setAttribute('x', 280); row.setAttribute('y', 240);
                row.setAttribute('width', 50); row.setAttribute('height', 230);
                row.setAttribute('fill', COL.accent); row.setAttribute('opacity', '0.4');
                g.appendChild(row);
                const rowL = document.createElementNS(NS, 'text');
                rowL.setAttribute('x', 305); rowL.setAttribute('y', 360);
                rowL.setAttribute('text-anchor', 'middle'); rowL.setAttribute('font-family', 'monospace');
                rowL.setAttribute('font-size', '10'); rowL.setAttribute('font-weight', '700');
                rowL.setAttribute('fill', COL.textPrimary || '#e8f0f8');
                rowL.setAttribute('transform', 'rotate(-90 305 360)');
                rowL.textContent = 'row decoder'; g.appendChild(rowL);
                // Column decoder strip on the top
                const col = document.createElementNS(NS, 'rect');
                col.setAttribute('x', 340); col.setAttribute('y', 180);
                col.setAttribute('width', 380); col.setAttribute('height', 50);
                col.setAttribute('fill', COL.accent); col.setAttribute('opacity', '0.4');
                g.appendChild(col);
                const colL = document.createElementNS(NS, 'text');
                colL.setAttribute('x', 530); colL.setAttribute('y', 212);
                colL.setAttribute('text-anchor', 'middle'); colL.setAttribute('font-family', 'monospace');
                colL.setAttribute('font-size', '10'); colL.setAttribute('font-weight', '700');
                colL.setAttribute('fill', COL.textPrimary || '#e8f0f8');
                colL.textContent = 'column decoder'; g.appendChild(colL);
              });
              b.setLabel('Row decoder along one edge. Column decoder along another. Array fills the middle.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 — ENABLE / CHIP-SELECT
    // ════════════════════════════════════════════════════
    {
      id: 6,
      title: 'The Enable Input — Chip-Select',
      pages: [
        { sentences: [
          { text: `One more refinement. Real decoders have an extra input called Enable. When Enable is 1, the decoder works normally. When Enable is 0, every single output goes low — regardless of the address inputs. All off.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Add An Enable Input', C().accent);
              _drawDecoderBox(b, 'dec', 400, 180, 3, -1);
              b.drawWire('en', [[450, 460],[450, 420]], C().edgeRise);
              b.drawNode('en-l', 400, 480, 'EN', C().edgeRise);
              b.drawNode('note', 500, 550, 'EN = 1 → decode normally.    EN = 0 → all outputs off.', C().accent);
              b.setLabel('Internally: AND the Enable input into every output AND gate. Trivial to add.', C().accent);
            } },

          { text: `Why? Because one decoder often shares a bus with other decoders. A computer with two RAM chips, each holding half the address space, uses a higher-level decoder to decide which chip gets enabled for each address. Only the selected chip's internal decoder is allowed to drive its outputs.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Chip-Select Across Multiple Memories', C().accent);
              b.drawBox('cs', 360, 140, 280, 80, 'top-level decoder (chip-select)', C().accent);
              b.drawBox('ram1', 180, 280, 240, 160, 'RAM chip 1\n(address 0x0000–0x7FFF)', C().accent);
              b.drawBox('ram2', 580, 280, 240, 160, 'RAM chip 2\n(address 0x8000–0xFFFF)', C().accent);
              b.drawWire('cs-1', [[440, 220],[440, 240],[300, 240],[300, 280]], C().edgeRise);
              b.drawWire('cs-2', [[560, 220],[560, 240],[700, 240],[700, 280]], C().dim);
              b.drawNode('cs-l', 300, 260, 'EN = 1', C().edgeRise);
              b.drawNode('cs-l2', 700, 260, 'EN = 0', C().dim);
              b.setLabel('The top bit of the address picks the chip. The remaining bits address within.', C().accent);
            } },

          { text: `This is called hierarchical decoding at the system level. Big addresses are decoded in layers: top bits pick the chip, middle bits pick the row within, low bits pick the column. Each layer is a decoder. Each layer is tiny. Together they address billions of cells.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Layered Decoding — Each Small, Together Huge', C().edgeRise);
              b.drawCustom('layers', (g, NS, COL) => {
                const layers = [
                  { label: 'top 4 bits  → which chip (1 of 16)',    y: 220 },
                  { label: 'next 10 bits → which row within chip',  y: 280 },
                  { label: 'next 10 bits → which column within row',y: 340 },
                  { label: '= 24-bit address, 16 million cells',    y: 400 },
                ];
                layers.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 180); t.setAttribute('y', l.y);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '16');
                  t.setAttribute('fill', i === 3 ? COL.edgeRise : COL.accent);
                  t.textContent = l.label; g.appendChild(t);
                });
              });
              b.setLabel('Each layer is a modest decoder. Stacked, they address practically anything.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 7 — THE ENCODER (inverse)
    // ════════════════════════════════════════════════════
    {
      id: 7,
      title: 'The Encoder — Running Backwards',
      pages: [
        { sentences: [
          { text: `A decoder takes a binary number and turns it into a one-hot pattern. The encoder does exactly the opposite — given which one of 2^N input wires is active, it produces the N-bit binary number that identifies it.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Encoder — The Inverse', C().accent);
              b.drawBox('enc', 400, 180, 200, 240, 'ENCODER\n8 → 3', C().accent);
              for (let i = 0; i < 8; i++) {
                const y = 200 + i * 30;
                b.drawWire('e-in' + i, [[300, y],[400, y]], i === 5 ? C().edgeRise : C().dim);
                b.drawNode('e-lab' + i, 270, y, 'in' + i, i === 5 ? C().edgeRise : C().dim);
              }
              b.drawWire('e-o0', [[600, 260],[720, 260]], C().wireHi);
              b.drawWire('e-o1', [[600, 300],[720, 300]], C().dim);
              b.drawWire('e-o2', [[600, 340],[720, 340]], C().wireHi);
              b.drawNode('e-out', 740, 300, 'out = 101  (= 5)', C().edgeRise);
              b.setLabel('One-hot in → binary code out. Shows which input is lit.', C().accent);
            } },

          { text: `Where do we need this? A keyboard is a classic example. Many key switches, only one pressed at a time. The encoder converts "which key is down" into a small binary code — the scan code — that software can read.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Keyboard Scan Codes', C().accent);
              b.drawCustom('keyboard', (g, NS, COL) => {
                // A very stylised row of key switches
                for (let i = 0; i < 10; i++) {
                  const cx = 100 + i * 70;
                  const r = document.createElementNS(NS, 'rect');
                  r.setAttribute('x', cx); r.setAttribute('y', 240);
                  r.setAttribute('width', 56); r.setAttribute('height', 56);
                  r.setAttribute('rx', 4);
                  r.setAttribute('fill', i === 4 ? COL.edgeRise : COL.panel);
                  r.setAttribute('stroke', COL.gateEdge); r.setAttribute('stroke-width', '2');
                  g.appendChild(r);
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', cx + 28); t.setAttribute('y', 275);
                  t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '14');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', i === 4 ? '#000' : COL.label);
                  t.textContent = String.fromCharCode(65 + i); g.appendChild(t);
                }
              });
              b.drawBox('enc', 380, 400, 240, 80, 'ENCODER', C().accent);
              b.drawWire('out', [[620, 440],[780, 440]], C().edgeRise);
              b.drawNode('code', 790, 440, 'scan code = 0x04 ("E")', C().edgeRise);
              b.setLabel('One pressed → encoder produces its identifier. Far cheaper than wiring every key individually.', C().accent);
            } },

          { text: `Another common use: priority encoders, which handle the case where multiple inputs might be active at once. They produce the code of the highest-priority active input. That's how interrupt controllers decide which device to service first when several interrupt the CPU at once.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Priority Encoder — Multiple Inputs, Pick Highest', C().accent);
              b.drawBox('penc', 360, 200, 280, 240, 'PRIORITY\nENCODER', C().accent);
              const irqs = ['IRQ0', 'IRQ1', 'IRQ2', 'IRQ3'];
              irqs.forEach((name, i) => {
                const y = 240 + i * 50;
                const active = i === 0 || i === 2;
                b.drawWire('p-in' + i, [[220, y],[360, y]], active ? C().edgeRise : C().dim);
                b.drawNode('p-l' + i, 180, y, name, active ? C().edgeRise : C().dim);
              });
              b.drawWire('p-out', [[640, 320],[800, 320]], C().edgeRise);
              b.drawNode('pick', 810, 320, 'winner = IRQ2 (higher)', C().edgeRise);
              b.setLabel('Tie-break by rank. The CPU services the highest-priority device first.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 8 — DECODERS EVERYWHERE
    // ════════════════════════════════════════════════════
    {
      id: 8,
      title: 'Decoders Are Everywhere',
      pages: [
        { sentences: [
          { text: `Once you start looking, decoders are everywhere in a digital system. They are one of the most-used building blocks.`,
            dur: 7500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Where Decoders Hide In A Chip', C().accent);
              b.drawChipOutline('die', 200, 180, 600, 300, 'CPU');
              b.setLabel('Count them as we go.', C().label);
            } },

          { text: `Instruction decoding: an opcode goes into a decoder that lights up one of many operation-specific control wires. That wire tells the ALU, registers, and memory exactly what to do for this instruction.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Instruction Decoding', C().accent);
              b.drawBox('op',  80, 260, 140, 100, 'OPCODE', C().wireHi);
              _drawDecoderBox(b, 'dec', 260, 200, 3, 2, { w: 180, label: 'INSTRUCTION\nDECODER' });
              b.drawNode('ops', 720, 220, 'ADD',  C().dim);
              b.drawNode('ops1',720, 260, 'SUB',  C().dim);
              b.drawNode('ops2',720, 300, 'MOV',  C().edgeRise);
              b.drawNode('ops3',720, 340, 'JMP',  C().dim);
              b.drawNode('ops4',720, 380, 'LD',   C().dim);
              b.setLabel('Opcode in → exactly one operation wire activated. The CPU\u2019s own decoder.', C().accent);
            } },

          { text: `Memory and I/O addressing: CPU puts an address on the bus. A decoder inside every chip decides whether that address falls in its range. If yes, its chip-select activates and the chip responds. Otherwise it stays silent.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Memory-Mapped I/O', C().accent);
              b.drawBox('cpu',  80, 300, 160, 80, 'CPU',       C().accent);
              b.drawWire('bus', [[240, 340],[840, 340]], C().wireHi);
              b.drawNode('bl', 500, 320, 'address bus', C().wireHi);
              b.drawBox('ram',  260, 420, 130, 80, 'RAM',      C().accent);
              b.drawBox('rom',  410, 420, 130, 80, 'ROM',      C().accent);
              b.drawBox('uart', 560, 420, 130, 80, 'UART',     C().accent);
              b.drawBox('gpio', 710, 420, 130, 80, 'GPIO',     C().accent);
              b.drawNode('rule', 500, 530, 'each device contains a small decoder watching the top address bits', C().accent);
              b.setLabel('No single "big decoder." Every peripheral decides for itself whether an address belongs to it.', C().accent);
            } },

          { text: `Demultiplexer: a decoder with a data input. It routes one data line to exactly one of many destination lines. Same structure as a decoder, just with data attached. Useful for sending one signal down one of many wires.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Demultiplexer — Data + Decoder', C().accent);
              b.drawBox('demux', 360, 200, 220, 220, 'DEMUX', C().accent);
              b.drawWire('d-in', [[240, 310],[360, 310]], C().wireHi);
              b.drawNode('d-il', 200, 310, 'DATA in', C().wireHi);
              b.drawWire('d-sel', [[470, 460],[470, 420]], C().edgeRise);
              b.drawNode('d-sl', 440, 480, 'SELECT', C().edgeRise);
              for (let i = 0; i < 4; i++) {
                const y = 240 + i * 50;
                b.drawWire('d-o' + i, [[580, y],[720, y]], i === 1 ? C().wireHi : C().dim);
                b.drawNode('d-ol' + i, 740, y, 'OUT' + i, i === 1 ? C().wireHi : C().dim);
              }
              b.setLabel('The decoder picks the destination. The DATA line flows only through the chosen output.', C().accent);
            } },

          { text: `Seven-segment displays: four bits of binary in, seven output wires drive the segments of the displayed digit. A special-purpose decoder converts the number 0 through 9 into the right pattern of lit segments.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Seven-Segment Decoder', C().accent);
              b.drawBox('dec', 140, 260, 200, 120, '7-SEG\nDECODER', C().accent);
              b.drawWire('in', [[40, 320],[140, 320]], C().wireHi);
              b.drawNode('i-l', 30, 320, '0101 (5)', C().wireHi);
              // 7 output wires
              for (let i = 0; i < 7; i++) {
                const y = 270 + i * 18;
                b.drawWire('o' + i, [[340, y],[480, y]], [1,0,1,1,0,1,1][i] ? C().edgeRise : C().dim);
              }
              // Stylised "5" digit
              b.drawCustom('seg5', (g, NS, COL) => {
                // Crude 7-seg rendering as 7 rectangles forming a 5
                const on = C().edgeRise, off = C().dim;
                const segs = [1,0,1,1,0,1,1]; // a, b, c, d, e, f, g for digit 5
                const x0 = 560, y0 = 260, w = 60, h = 100, th = 8;
                const coords = [
                  // a — top
                  [x0, y0, w, th],
                  // b — top-right
                  [x0 + w - th, y0, th, h/2],
                  // c — bottom-right
                  [x0 + w - th, y0 + h/2, th, h/2],
                  // d — bottom
                  [x0, y0 + h - th, w, th],
                  // e — bottom-left
                  [x0, y0 + h/2, th, h/2],
                  // f — top-left
                  [x0, y0, th, h/2],
                  // g — middle
                  [x0, y0 + h/2 - th/2, w, th],
                ];
                coords.forEach((c, i) => {
                  const r = document.createElementNS(NS, 'rect');
                  r.setAttribute('x', c[0]); r.setAttribute('y', c[1]);
                  r.setAttribute('width', c[2]); r.setAttribute('height', c[3]);
                  r.setAttribute('fill', segs[i] ? on : off);
                  g.appendChild(r);
                });
              });
              b.setLabel('Each digit = a specific 7-bit pattern. The decoder is a lookup — BCD in, segments out.', C().accent);
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
      title: 'Recap — The Decoder',
      pages: [
        { sentences: [
          { text: `Let's trace the build. A decoder takes an N-bit binary code and lights exactly one of 2^N output wires. The rule: each output is an AND gate watching for its specific input combination.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 1 — One-Hot Output', C().accent);
              _drawDecoderBox(b, 'dec', 400, 180, 3, 3);
              b.setLabel('N bits in, 2^N wires out, exactly one lit at any time.', C().accent);
            } },

          { text: `Build it from gates: one AND gate per output, inputs inverted as needed so each AND fires on its own row of the truth table. Four outputs = four ANDs = a 2-to-4 decoder.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 2 — Gate-Level Build', C().accent);
              _drawGateLevel2to4(b, 2);
              b.setLabel('Truth table translated directly into gates. Each AND is one row.', C().accent);
            } },

          { text: `Flat decoders double their gate count for every input bit. A flat 20-bit decoder needs over a million gates. So real systems split addresses into halves and decode each separately in a 2D grid — row decoder plus column decoder — which is how every DRAM chip is physically laid out.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 3 — Hierarchical Decoding', C().accent);
              _drawRamGrid(b, 340, 160, 16, 16, 9);
              b.setLabel('Two small decoders beat one giant one. Massive savings, same functionality.', C().accent);
            } },

          { text: `An Enable input lets multiple decoders share a bus. With Enable at 0, all outputs go off. That's how a CPU with multiple memory or I/O chips keeps only the addressed one responding.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 4 — Enable / Chip-Select', C().accent);
              _drawDecoderBox(b, 'dec', 400, 200, 3, -1);
              b.drawWire('en', [[450, 460],[450, 420]], C().edgeRise);
              b.drawNode('en-l', 400, 480, 'EN', C().edgeRise);
              b.setLabel('EN=0 silences the decoder. EN=1 enables normal decoding. Critical for shared buses.', C().accent);
            } },

          { text: `Encoders are the inverse: given which one of 2^N wires is active, produce the N-bit code. Keyboards, priority interrupt controllers, and any "which one is on" question uses them.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 5 — The Encoder (Inverse)', C().accent);
              b.drawBox('enc', 400, 200, 200, 200, 'ENCODER\n8 → 3', C().accent);
              b.setLabel('One-hot in → binary out. Same idea, running backward.', C().accent);
            } },

          { text: `That's the decoder. The circuit that says "pick exactly one." It makes RAM possible, makes instruction decoding possible, and — multiplied thousands of times — is wired into every corner of every digital system.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Decoder — Pick Exactly One', C().edgeRise);
              _drawDecoderBox(b, 'dec', 400, 200, 4, 11, { w: 180 });
              b.setLabel('Without decoders, addresses are just numbers. With them, numbers become selectors.', C().edgeRise);
            } },

          { text: `Next episode: the multiplexer. Where a decoder picks one of many DESTINATIONS, a MUX picks one of many SOURCES. They are perfect duals, and together they move data wherever it needs to go inside a CPU.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Next: The Multiplexer', C().accent);
              b.drawMux('mux', 400, 220, 180, 200, { inputs: 4, label: 'MUX 4:1' });
              for (let i = 0; i < 4; i++) {
                const y = 260 + i * 35;
                b.drawWire('i' + i, [[240, y],[400, y]], i === 2 ? C().edgeRise : C().dim);
              }
              b.drawWire('o', [[580, 320],[720, 320]], C().edgeRise);
              b.drawNode('o-l', 730, 320, 'picked', C().edgeRise);
              b.setLabel('One of many wires routes through. Next episode.', C().accent);
            } },
        ] },
      ],
      showAll: true,
      isFinal: true,
    },
  ];

  if (typeof window !== 'undefined') {
    window.BLOCKS_05_SCENES = BLOCKS_05_SCENES;
  }
})();
