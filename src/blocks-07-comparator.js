/**
 * Series B — Episode 7: How a Comparator Is Built
 * -------------------------------------------------
 * A comparator takes two N-bit numbers and answers three simple questions:
 * are they equal, is A less than B, is A greater than B? That tiny question
 * underlies every conditional in every program: if-statements, loop tests,
 * branches, cache hits, range checks. This episode builds a comparator from
 * XNOR/AND gates, shows how CPUs actually take a shortcut through the ALU's
 * subtractor, and explains the signed-vs-unsigned wrinkle.
 *
 * Arc:
 *   0. Hook                      every conditional runs on this
 *   1. 1-bit equality            XNOR says "these bits match"
 *   2. N-bit equality            AND of all the XNORs
 *   3. 1-bit magnitude           A>B and A<B from two ANDs
 *   4. Multi-bit magnitude       dictionary ordering — MSB-first cascade
 *   5. Three-way output          A<B, A=B, A>B wires, one lit
 *   6. Subtraction shortcut      real CPUs compare by subtracting
 *   7. Signed comparison         two's-complement twist
 *   8. Where comparators live    branches, loops, cache tags, range checks
 *   9. Recap                     trust chain + adder teaser
 *
 * Walk-the-talk: every anim() matches its narration.
 */

(function () {
  'use strict';

  const B = () => window.Blocks;
  const C = () => window.Blocks && window.Blocks.COL;

  // ─────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────

  // Decompose value v to N bits, MSB first.
  const bitsOf = (v, n) => {
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push((v >> i) & 1);
    return out;
  };
  const fmt = (bits) => bits.join(' ');

  // Draw two N-bit numbers as stacked bit rows (A on top, B below) with values
  // coloured. Returns { axis: y of the midline, cellX: array of cell x centres }
  function _drawTwoBinaryRows(b, aBits, bBits, opts) {
    opts = opts || {};
    const col = C();
    const cellW = opts.cellW || 56;
    const gap = opts.gap || 10;
    const n = aBits.length;
    const totalW = n * cellW + (n - 1) * gap;
    const x0 = opts.x || ((1000 - totalW) / 2);
    const y = opts.y || 220;
    const cellX = [];
    b.drawCustom('two-rows-' + (opts.prefix || ''), (g, NS, COL) => {
      // A row
      const aLbl = document.createElementNS(NS, 'text');
      aLbl.setAttribute('x', x0 - 16); aLbl.setAttribute('y', y + 26);
      aLbl.setAttribute('text-anchor', 'end'); aLbl.setAttribute('font-family', 'monospace');
      aLbl.setAttribute('font-size', '18'); aLbl.setAttribute('font-weight', '700');
      aLbl.setAttribute('fill', COL.accent); aLbl.textContent = 'A'; g.appendChild(aLbl);
      aBits.forEach((v, i) => {
        const cx = x0 + i * (cellW + gap);
        cellX[i] = cx + cellW / 2;
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', cx); r.setAttribute('y', y);
        r.setAttribute('width', cellW); r.setAttribute('height', 40);
        r.setAttribute('rx', 4);
        r.setAttribute('fill', COL.panel);
        r.setAttribute('stroke', COL.accent); r.setAttribute('stroke-width', '1.5');
        g.appendChild(r);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', cx + cellW / 2); t.setAttribute('y', y + 28);
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '22'); t.setAttribute('font-weight', '700');
        t.setAttribute('fill', v ? COL.edgeRise : COL.label);
        t.textContent = v; g.appendChild(t);
      });
      // B row
      const by = y + 80;
      const bLbl = document.createElementNS(NS, 'text');
      bLbl.setAttribute('x', x0 - 16); bLbl.setAttribute('y', by + 26);
      bLbl.setAttribute('text-anchor', 'end'); bLbl.setAttribute('font-family', 'monospace');
      bLbl.setAttribute('font-size', '18'); bLbl.setAttribute('font-weight', '700');
      bLbl.setAttribute('fill', COL.accent); bLbl.textContent = 'B'; g.appendChild(bLbl);
      bBits.forEach((v, i) => {
        const cx = x0 + i * (cellW + gap);
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', cx); r.setAttribute('y', by);
        r.setAttribute('width', cellW); r.setAttribute('height', 40);
        r.setAttribute('rx', 4);
        r.setAttribute('fill', COL.panel);
        r.setAttribute('stroke', COL.accent); r.setAttribute('stroke-width', '1.5');
        g.appendChild(r);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', cx + cellW / 2); t.setAttribute('y', by + 28);
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '22'); t.setAttribute('font-weight', '700');
        t.setAttribute('fill', v ? COL.edgeRise : COL.label);
        t.textContent = v; g.appendChild(t);
      });
      // Bit-by-bit equality indicators
      aBits.forEach((v, i) => {
        const cx = x0 + i * (cellW + gap) + cellW / 2;
        const equal = aBits[i] === bBits[i];
        const ind = document.createElementNS(NS, 'text');
        ind.setAttribute('x', cx); ind.setAttribute('y', by + 70);
        ind.setAttribute('text-anchor', 'middle'); ind.setAttribute('font-family', 'monospace');
        ind.setAttribute('font-size', '16'); ind.setAttribute('font-weight', '700');
        ind.setAttribute('fill', equal ? COL.edgeRise : COL.wireHot);
        ind.textContent = equal ? '=' : '≠'; g.appendChild(ind);
      });
    });
    return { y, cellX };
  }

  // 1-bit equality: two inputs into an XNOR gate, output labelled equal.
  function _drawBitEqualityCircuit(b, A, B) {
    const col = C();
    const hi = (v) => v ? col.wireHi : col.wireLo;
    b.drawGate('xnor', 'XNOR', 430, 260, 130, 100);
    const Y = (A === B) ? 1 : 0;
    if (Y) b.setState('xnor', 'glow');
    b.drawWire('w-A', [[260, 290],[430, 290]], hi(A));
    b.drawNode('A-l', 240, 290, 'A = ' + A, hi(A));
    b.drawWire('w-B', [[260, 330],[430, 330]], hi(B));
    b.drawNode('B-l', 240, 330, 'B = ' + B, hi(B));
    b.drawWire('w-Y', [[572, 310],[730, 310]], hi(Y));
    b.drawNode('Y-l', 740, 310, 'match = ' + Y, Y ? col.edgeRise : col.wireLo);
    b.drawNode('eqn', 500, 440, 'match = A XNOR B   =   ¬(A XOR B)', col.accent);
  }

  // N-bit equality: N XNORs feeding one big AND. Show which XNORs fire.
  function _drawNBitEquality(b, aBits, bBits) {
    const n = aBits.length;
    const col = C();
    const startY = 180;
    const rowH = 60;
    const allEqual = aBits.every((v, i) => v === bBits[i]);
    // One XNOR per bit pair
    for (let i = 0; i < n; i++) {
      const y = startY + i * rowH;
      const eq = aBits[i] === bBits[i];
      b.drawGate('xn' + i, 'XNOR', 280, y, 80, 40);
      if (eq) b.setState('xn' + i, 'glow');
      b.drawWire('wA' + i, [[160, y + 14],[280, y + 14]], aBits[i] ? col.wireHi : col.wireLo);
      b.drawWire('wB' + i, [[160, y + 28],[280, y + 28]], bBits[i] ? col.wireHi : col.wireLo);
      b.drawNode('laA' + i, 140, y + 14, 'A' + (n - 1 - i), col.label);
      b.drawNode('laB' + i, 140, y + 28, 'B' + (n - 1 - i), col.label);
      // XNOR → AND input
      b.drawWire('wOut' + i, [[372, y + 20],[430, y + 20]], eq ? col.wireHi : col.wireLo);
    }
    // Big N-input AND shown as a wide AND
    b.drawGate('andAll', 'AND', 430, startY + (n - 1) * rowH / 2 + 10, 140, n * rowH - 20);
    if (allEqual) b.setState('andAll', 'glow');
    // Output
    b.drawWire('wEq',
      [[572, startY + (n - 1) * rowH / 2 + 10 + (n * rowH - 20) / 2],
       [700, startY + (n - 1) * rowH / 2 + 10 + (n * rowH - 20) / 2]],
      allEqual ? col.edgeRise : col.wireLo);
    b.drawNode('eqL', 710, startY + (n - 1) * rowH / 2 + 10 + (n * rowH - 20) / 2,
      'A = B:  ' + (allEqual ? 1 : 0),
      allEqual ? col.edgeRise : col.wireLo);
  }

  // 1-bit magnitude. A>B = A·¬B. A<B = ¬A·B.
  function _drawBitMagnitude(b, A, B) {
    const col = C();
    const hi = (v) => v ? col.wireHi : col.wireLo;
    // A, B inputs
    b.drawNode('A-l', 80, 240, 'A = ' + A, hi(A));
    b.drawNode('B-l', 80, 440, 'B = ' + B, hi(B));
    // NOT gates
    b.drawGate('not-A', 'NOT', 180, 300, 60, 40);
    b.drawGate('not-B', 'NOT', 180, 400, 60, 40);
    // AND for A>B: A · ¬B
    b.drawGate('and-gt', 'AND', 400, 220, 120, 80);
    // AND for A<B: ¬A · B
    b.drawGate('and-lt', 'AND', 400, 420, 120, 80);

    const gt = (A === 1 && B === 0) ? 1 : 0;
    const lt = (A === 0 && B === 1) ? 1 : 0;
    if (gt) b.setState('and-gt', 'glow');
    if (lt) b.setState('and-lt', 'glow');

    // Wiring A
    b.drawWire('wA', [[130, 240],[300, 240],[300, 240],[400, 240]], hi(A));
    b.drawWire('wA-to-not', [[130, 240],[130, 320],[180, 320]], hi(A));
    b.drawWire('wNotA', [[240, 320],[340, 320],[340, 460],[400, 460]], hi(A ? 0 : 1));
    // Wiring B
    b.drawWire('wB', [[130, 440],[320, 440],[320, 480],[400, 480]], hi(B));
    b.drawWire('wB-to-not', [[130, 440],[130, 420],[180, 420]], hi(B));
    b.drawWire('wNotB', [[240, 420],[360, 420],[360, 280],[400, 280]], hi(B ? 0 : 1));

    // Outputs
    b.drawWire('w-gt', [[520, 260],[700, 260]], hi(gt));
    b.drawNode('gt-l', 710, 260, 'A > B = ' + gt, gt ? col.edgeRise : col.wireLo);
    b.drawWire('w-lt', [[520, 460],[700, 460]], hi(lt));
    b.drawNode('lt-l', 710, 460, 'A < B = ' + lt, lt ? col.edgeRise : col.wireLo);
  }

  // ─────────────────────────────────────────
  //  Animated 4-bit comparator showcase: A and B sweep, three lights below.
  // ─────────────────────────────────────────
  function _drawLiveComparator(b) {
    const col = C();
    const n = 4;
    const x0 = 220, cellW = 64, gap = 8;
    const y = 200;

    // Rectangles for A and B rows
    const aCells = [];
    const bCells = [];
    b.drawCustom('bits', (g, NS, COL) => {
      const aLab = document.createElementNS(NS, 'text');
      aLab.setAttribute('x', x0 - 16); aLab.setAttribute('y', y + 28);
      aLab.setAttribute('text-anchor', 'end'); aLab.setAttribute('font-family', 'monospace');
      aLab.setAttribute('font-size', '20'); aLab.setAttribute('font-weight', '700');
      aLab.setAttribute('fill', COL.accent); aLab.textContent = 'A'; g.appendChild(aLab);
      for (let i = 0; i < n; i++) {
        const cx = x0 + i * (cellW + gap);
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', cx); r.setAttribute('y', y);
        r.setAttribute('width', cellW); r.setAttribute('height', 40);
        r.setAttribute('rx', 4);
        r.setAttribute('fill', COL.panel); r.setAttribute('stroke', COL.accent);
        r.setAttribute('stroke-width', '1.5');
        g.appendChild(r);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', cx + cellW / 2); t.setAttribute('y', y + 28);
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '22'); t.setAttribute('font-weight', '700');
        t.setAttribute('fill', COL.label);
        t.textContent = '0'; g.appendChild(t);
        aCells.push(t);
      }
      const by = y + 80;
      const bLab = document.createElementNS(NS, 'text');
      bLab.setAttribute('x', x0 - 16); bLab.setAttribute('y', by + 28);
      bLab.setAttribute('text-anchor', 'end'); bLab.setAttribute('font-family', 'monospace');
      bLab.setAttribute('font-size', '20'); bLab.setAttribute('font-weight', '700');
      bLab.setAttribute('fill', COL.accent); bLab.textContent = 'B'; g.appendChild(bLab);
      for (let i = 0; i < n; i++) {
        const cx = x0 + i * (cellW + gap);
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', cx); r.setAttribute('y', by);
        r.setAttribute('width', cellW); r.setAttribute('height', 40);
        r.setAttribute('rx', 4);
        r.setAttribute('fill', COL.panel); r.setAttribute('stroke', COL.accent);
        r.setAttribute('stroke-width', '1.5');
        g.appendChild(r);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', cx + cellW / 2); t.setAttribute('y', by + 28);
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '22'); t.setAttribute('font-weight', '700');
        t.setAttribute('fill', COL.label);
        t.textContent = '0'; g.appendChild(t);
        bCells.push(t);
      }
    });

    // Three output indicators
    const lightY = y + 200;
    const lights = {};
    b.drawCustom('lights', (g, NS, COL) => {
      const labels = [
        { key: 'lt', text: 'A < B', x: 320 },
        { key: 'eq', text: 'A = B', x: 500 },
        { key: 'gt', text: 'A > B', x: 680 },
      ];
      labels.forEach(l => {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', l.x); c.setAttribute('cy', lightY);
        c.setAttribute('r', 14);
        c.setAttribute('fill', COL.dim); c.setAttribute('stroke', COL.gateEdge);
        c.setAttribute('stroke-width', '2');
        g.appendChild(c);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', l.x); t.setAttribute('y', lightY + 40);
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '14'); t.setAttribute('font-weight', '700');
        t.setAttribute('fill', COL.label); t.textContent = l.text;
        g.appendChild(t);
        lights[l.key] = c;
      });
    });

    // Decimal readouts
    b.drawCustom('decimals', (g, NS, COL) => {
      const ad = document.createElementNS(NS, 'text');
      ad.setAttribute('x', x0 + n * (cellW + gap) + 30); ad.setAttribute('y', y + 28);
      ad.setAttribute('font-family', 'monospace'); ad.setAttribute('font-size', '18');
      ad.setAttribute('fill', COL.accent); ad.textContent = '= 0';
      g.appendChild(ad); lights.aDec = ad;
      const bd = document.createElementNS(NS, 'text');
      bd.setAttribute('x', x0 + n * (cellW + gap) + 30); bd.setAttribute('y', y + 108);
      bd.setAttribute('font-family', 'monospace'); bd.setAttribute('font-size', '18');
      bd.setAttribute('fill', COL.accent); bd.textContent = '= 0';
      g.appendChild(bd); lights.bDec = bd;
    });

    // Animate A sweeping up, B sweeping down slowly — three lights activate
    // in turn depending on the comparison.
    b.animate('bits', (tMs) => {
      if (!aCells.length) return;
      const aVal = Math.floor(tMs / 180) % 16;
      const bVal = 8;   // fixed midpoint
      const aB = bitsOf(aVal, n);
      const bB = bitsOf(bVal, n);
      aB.forEach((v, i) => {
        aCells[i].textContent = v;
        aCells[i].setAttribute('fill', v ? C().edgeRise : C().label);
      });
      bB.forEach((v, i) => {
        bCells[i].textContent = v;
        bCells[i].setAttribute('fill', v ? C().edgeRise : C().label);
      });
      if (lights.aDec) lights.aDec.textContent = '= ' + aVal;
      if (lights.bDec) lights.bDec.textContent = '= ' + bVal;
      // Update lights
      const lt = aVal < bVal, eq = aVal === bVal, gt = aVal > bVal;
      if (lights.lt) lights.lt.setAttribute('fill', lt ? C().edgeRise : C().dim);
      if (lights.eq) lights.eq.setAttribute('fill', eq ? C().edgeRise : C().dim);
      if (lights.gt) lights.gt.setAttribute('fill', gt ? C().edgeRise : C().dim);
    });
  }

  // ─────────────────────────────────────────
  //  SCENES
  // ─────────────────────────────────────────
  const BLOCKS_07_SCENES = [

    // ════════════════════════════════════════════════════
    // SCENE 0 — HOOK
    // ════════════════════════════════════════════════════
    {
      id: 0,
      title: 'Every Conditional Runs On This',
      pages: [
        { sentences: [
          { text: `Every if-statement you have ever written. Every while-loop. Every ternary expression. Every branch in every program. All of them ultimately reach the same small hardware circuit that answers one question: how do these two numbers relate?`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Every Branch, Every Loop, Every Test', C().edgeRise);
              b.drawCustom('codes', (g, NS, COL) => {
                const code = [
                  'if (x == 0)           // equality',
                  'while (i < n)         // less-than',
                  'if (age >= 18)        // greater-or-equal',
                  'for (i = 0; i < 10) // loop test',
                ];
                code.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 140); t.setAttribute('y', 230 + i * 50);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '17');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.drawNode('arrow', 640, 380, '→   one hardware question', C().edgeRise);
              b.setLabel('All of these compile down to "compare two numbers, then branch if the result says so."', C().accent);
            } },

          { text: `The circuit that answers that question is called a comparator. Its job is to take two numbers and produce three output wires: one for A equals B, one for A less than B, one for A greater than B. Exactly one of those wires is on at a time.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Comparator', C().edgeRise);
              b.drawBox('cmp', 380, 200, 240, 220, 'COMPARATOR', C().edgeRise);
              b.drawNode('a', 290, 260, 'A  →', C().wireHi);
              b.drawNode('b', 290, 340, 'B  →', C().wireHi);
              b.drawWire('wa', [[340, 260],[380, 260]], C().wireHi);
              b.drawWire('wb', [[340, 340],[380, 340]], C().wireHi);
              b.drawWire('o1', [[620, 240],[750, 240]], C().wireHi);
              b.drawWire('o2', [[620, 310],[750, 310]], C().wireHi);
              b.drawWire('o3', [[620, 380],[750, 380]], C().wireHi);
              b.drawNode('o1l', 760, 240, 'A = B', C().edgeRise);
              b.drawNode('o2l', 760, 310, 'A < B', C().edgeRise);
              b.drawNode('o3l', 760, 380, 'A > B', C().edgeRise);
              b.setLabel('Two numbers in. Three output wires. Exactly one lit. Always.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 1 — 1-BIT EQUALITY
    // ════════════════════════════════════════════════════
    {
      id: 1,
      title: 'When Do Two Bits Match?',
      pages: [
        { sentences: [
          { text: `Start with the smallest possible comparison: one bit versus one bit. When are two single bits equal? When both are zero, or both are one. When do they differ? When one is zero and the other is one — in either order.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One Bit Equality', C().accent);
              b.drawTruthTable('tt', 320, 220, ['A','B','equal?'], [
                [0, 0, 1],
                [0, 1, 0],
                [1, 0, 0],
                [1, 1, 1],
              ]);
              b.setLabel('Two "match" cases (both 0, both 1). Two "mismatch" cases.', C().accent);
            } },

          { text: `That truth table matches a gate we already know — the XNOR gate. XNOR outputs 1 when its inputs are the same, and 0 when they differ. So a single XNOR gate is a 1-bit equality comparator.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('XNOR = "Same" Detector', C().edgeRise);
              _drawBitEqualityCircuit(b, 1, 1);
              b.setLabel('One gate, two inputs, one output. "Match" is a single rock-cheap primitive.', C().edgeRise);
            } },

          { text: `Change one input and the output goes low. Change both back to the same value and it goes high again. One gate, 1-bit equality done.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Different Inputs → Output Low', C().accent);
              _drawBitEqualityCircuit(b, 1, 0);
              b.setLabel('Any mismatch kills the output. That\u2019s exactly what equality testing needs.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 2 — N-BIT EQUALITY
    // ════════════════════════════════════════════════════
    {
      id: 2,
      title: 'Multi-Bit Equality',
      pages: [
        { sentences: [
          { text: `To compare two multi-bit numbers, we need them to be equal in every single bit position. Bit 0 matches AND bit 1 matches AND bit 2 matches, and so on. If any one bit pair disagrees, the whole numbers disagree.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Match Every Bit, No Exceptions', C().accent);
              _drawTwoBinaryRows(b, [1, 0, 1, 1], [1, 0, 1, 1], { y: 200 });
              b.setLabel('Every pair must match for the numbers to be equal. Single differ → not equal.', C().accent);
            } },

          { text: `So the circuit is: one XNOR per bit pair, then AND all those XNOR outputs together. The final AND lights up if and only if every single bit position matched.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('N XNORs + 1 AND = N-Bit Equality', C().edgeRise);
              _drawNBitEquality(b, [1, 0, 1, 1], [1, 0, 1, 1]);
              b.setLabel('Each XNOR is one "match" signal. The AND demands unanimous agreement.', C().edgeRise);
            } },

          { text: `Change one bit on either side and watch what happens. The XNOR for that bit drops to 0. The big AND no longer has all-ones on its inputs, so its output also drops. One disagreement is all it takes.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One Mismatch Breaks The AND', C().wireHot);
              _drawNBitEquality(b, [1, 0, 1, 1], [1, 0, 0, 1]);
              b.setLabel('Single mismatched bit → that XNOR outputs 0 → AND output falls. Equality broken.', C().wireHot);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 3 — 1-BIT MAGNITUDE
    // ════════════════════════════════════════════════════
    {
      id: 3,
      title: 'Which One Is Bigger? — 1 Bit',
      pages: [
        { sentences: [
          { text: `Equality is the easy part. The harder question is magnitude — which number is larger? Let's start with single bits. When is A greater than B? Exactly when A is 1 and B is 0. When is A less than B? Exactly when A is 0 and B is 1.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('1-Bit Magnitude Truth Table', C().accent);
              b.drawTruthTable('tt', 320, 220, ['A','B','A>B','A<B'], [
                [0, 0, 0, 0],
                [0, 1, 0, 1],
                [1, 0, 1, 0],
                [1, 1, 0, 0],
              ]);
              b.setLabel('Two simple AND patterns. "1 beats 0" in either direction.', C().accent);
            } },

          { text: `That turns into two AND gates. A greater-than B equals A AND NOT-B. A less-than B equals NOT-A AND B. Add in the XNOR for equality and you have a complete 1-bit comparator.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Two ANDs Decide The Magnitude', C().edgeRise);
              _drawBitMagnitude(b, 1, 0);
              b.setLabel('A=1, B=0 → A greater-than fires. One gate, one answer.', C().edgeRise);
            } },

          { text: `Swap the inputs. A equals 0, B equals 1. Now the less-than gate fires — the other one goes dark. Exactly one output is ever high at a time, by construction.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Swap Roles — Other AND Fires', C().accent);
              _drawBitMagnitude(b, 0, 1);
              b.setLabel('Symmetric. "1 over 0" matters no matter which side wears the crown.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 4 — MULTI-BIT MAGNITUDE
    // ════════════════════════════════════════════════════
    {
      id: 4,
      title: 'Multi-Bit Magnitude — Dictionary Ordering',
      pages: [
        { sentences: [
          { text: `Multi-bit magnitude is trickier than multi-bit equality. You can\u2019t just AND everything. You have to compare bit-by-bit from the top down, exactly like you compare two decimal numbers in your head.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Think About It Like A Human', C().accent);
              b.drawCustom('demo', (g, NS, COL) => {
                const lines = [
                  '1 2 3 4    vs    1 2 8 9',
                  '',
                  'digit 1 — both 1 → tied, keep going',
                  'digit 2 — both 2 → tied, keep going',
                  'digit 3 — 3 vs 8 → different!    3 < 8',
                  'digit 4 — we don\u2019t even look',
                  '',
                  '1234 < 1289',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 300); t.setAttribute('y', 190 + i * 38);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '16');
                  t.setAttribute('fill', i === 7 ? COL.edgeRise : (i >= 4 ? COL.accent : COL.label));
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Dictionary ordering: start at the most-significant position, stop at the first difference.', C().accent);
            } },

          { text: `Same logic in binary. Compare from the most-significant bit downward. At the first bit where A and B differ, the higher bit wins. Everything below that point is irrelevant — don\u2019t even look at it.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Binary — MSB-First', C().edgeRise);
              _drawTwoBinaryRows(b, [1, 0, 1, 1], [1, 0, 0, 1], { y: 200, prefix: 'mag' });
              b.drawNode('note', 500, 400,
                'bits 3, 2 match (both "10"). Bit 1 differs: A = 1, B = 0 → A wins → A > B',
                C().edgeRise);
              b.setLabel('First differing bit decides. The low bits can\u2019t override a higher-bit difference.', C().edgeRise);
            } },

          { text: `In hardware, that means each bit stage produces two outputs — "decided so far" and "who won so far" — and hands them up to the next stage. The next stage either passes a prior decision through, or overrides with its own verdict.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Cascade — Each Bit Reports Up', C().accent);
              b.drawCustom('cascade', (g, NS, COL) => {
                // A column of "bit stages" with arrows going up
                for (let i = 0; i < 4; i++) {
                  const y = 470 - i * 70;
                  const box = document.createElementNS(NS, 'rect');
                  box.setAttribute('x', 340); box.setAttribute('y', y);
                  box.setAttribute('width', 260); box.setAttribute('height', 50);
                  box.setAttribute('rx', 6);
                  box.setAttribute('fill', COL.panel); box.setAttribute('stroke', COL.accent);
                  box.setAttribute('stroke-width', '2');
                  g.appendChild(box);
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 470); t.setAttribute('y', y + 30);
                  t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '14'); t.setAttribute('fill', COL.accent);
                  t.textContent = 'bit ' + i + ' stage'; g.appendChild(t);
                  if (i < 3) {
                    const ar = document.createElementNS(NS, 'path');
                    ar.setAttribute('d', 'M 470 ' + y + ' L 470 ' + (y - 20) + ' M 464 ' + (y - 14) + ' L 470 ' + (y - 20) + ' L 476 ' + (y - 14));
                    ar.setAttribute('stroke', COL.wireHi); ar.setAttribute('stroke-width', '2');
                    ar.setAttribute('fill', 'none');
                    g.appendChild(ar);
                  }
                }
              });
              b.drawNode('final', 740, 250, '→ A > B / A < B / A = B', C().edgeRise);
              b.setLabel('Like a pipeline: higher stages can overrule lower stages, because high bits dominate.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 5 — THREE-WAY OUTPUT (LIVE)
    // ════════════════════════════════════════════════════
    {
      id: 5,
      title: 'Three Output Wires, One Lit At A Time',
      pages: [
        { sentences: [
          { text: `Put it all together. A proper N-bit comparator has three output wires — A less-than B, A equals B, A greater-than B. Whatever two numbers you feed it, exactly one of those three wires is high.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Three Wires, One Answer', C().edgeRise);
              b.drawBox('cmp', 320, 180, 360, 280, 'N-bit COMPARATOR', C().edgeRise);
              for (let i = 0; i < 3; i++) {
                const y = 230 + i * 70;
                b.drawWire('o' + i, [[680, y],[820, y]], C().edgeRise);
              }
              b.drawNode('o1l', 830, 230, 'A < B', C().edgeRise);
              b.drawNode('o2l', 830, 300, 'A = B', C().edgeRise);
              b.drawNode('o3l', 830, 370, 'A > B', C().edgeRise);
              b.drawNode('inv', 500, 500, 'exactly one lit, always — by construction', C().accent);
              b.setLabel('Trichotomy in wires. One-hot output, like a decoder — but keyed on the comparison.', C().accent);
            } },

          { text: `Watch it live. Here\u2019s a 4-bit A sweeping through every value from 0 to 15. B is held fixed at 8. The three indicator lights track which case holds, moment by moment.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Live 4-Bit Comparator — A Sweeps, B Fixed At 8', C().edgeRise);
              _drawLiveComparator(b);
              b.setLabel('"A < B" lights when A is below 8. "A = B" flashes briefly at 8. "A > B" lights beyond.', C().edgeRise);
            } },

          { text: `The three wires are mutually exclusive and exhaustive. One is always lit. Software just picks whichever one matches the comparison it wants — equals, less-than, greater-than, or combinations like less-or-equal by checking the first two together.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('All Six Relational Tests Come From These Three', C().accent);
              b.drawCustom('tests', (g, NS, COL) => {
                const items = [
                  '==        →   A = B',
                  '!=         →   NOT (A = B)',
                  '<           →   A < B',
                  '<=         →   (A < B) OR (A = B)',
                  '>           →   A > B',
                  '>=         →   (A > B) OR (A = B)',
                ];
                items.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 240); t.setAttribute('y', 220 + i * 42);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '16');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Three output wires + one OR/NOT = every comparison your source code ever needed.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 — SUBTRACTION SHORTCUT
    // ════════════════════════════════════════════════════
    {
      id: 6,
      title: 'The Subtraction Shortcut',
      pages: [
        { sentences: [
          { text: `Here\u2019s a twist. Real CPUs usually don\u2019t have a dedicated comparator circuit at all. They already have a subtractor — part of the ALU. It turns out subtracting B from A tells you almost everything you need to know.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A Shortcut Hidden In The ALU', C().accent);
              b.drawBox('sub', 340, 220, 320, 180, 'SUBTRACTOR\n(part of the ALU)', C().edgeRise);
              b.drawNode('a', 280, 280, 'A →', C().wireHi);
              b.drawNode('bi', 280, 360, 'B →', C().wireHi);
              b.drawWire('wa', [[320, 280],[340, 280]], C().wireHi);
              b.drawWire('wbi', [[320, 360],[340, 360]], C().wireHi);
              b.drawNode('out', 740, 310, '→ A − B', C().edgeRise);
              b.setLabel('Instead of a separate "compare" unit, reuse the subtractor. Free upgrade.', C().accent);
            } },

          { text: `Compute A minus B. If the result is zero, A equals B. If the result is negative — indicated by the sign bit — A was smaller than B. If the result is positive and non-zero, A was bigger than B. Three flags: Zero, Negative, and their combinations give you all six comparisons.`,
            dur: 16500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A − B → Three Flags', C().edgeRise);
              b.drawCustom('flags', (g, NS, COL) => {
                const items = [
                  ['Z (Zero)',     'A − B = 0',                  'A = B',     COL.edgeRise],
                  ['N (Negative)', 'A − B has sign bit = 1',     'A < B',     COL.edgeRise],
                  ['neither',      'A − B ≠ 0, sign bit = 0',     'A > B',     COL.edgeRise],
                ];
                items.forEach((r, i) => {
                  const y = 240 + i * 55;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 120); a.setAttribute('y', y);
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '14');
                  a.setAttribute('font-weight', '700');
                  a.setAttribute('fill', COL.accent);
                  a.textContent = r[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 300); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '14');
                  b_.setAttribute('fill', COL.label);
                  b_.textContent = r[1]; g.appendChild(b_);
                  const c = document.createElementNS(NS, 'text');
                  c.setAttribute('x', 620); c.setAttribute('y', y);
                  c.setAttribute('font-family', 'monospace');
                  c.setAttribute('font-size', '14');
                  c.setAttribute('font-weight', '700');
                  c.setAttribute('fill', r[3]);
                  c.textContent = '→  ' + r[2]; g.appendChild(c);
                });
              });
              b.setLabel('Flags register + subtractor = comparator. Real CPUs exploit this relentlessly.', C().edgeRise);
            } },

          { text: `That\u2019s why nearly every CPU has a CMP instruction that is "just like SUB, but throws away the result." All it does is set the flags. The next instruction — a conditional branch — reads those flags to decide whether to jump.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('CMP = SUB Without Saving The Result', C().accent);
              b.drawCustom('instrs', (g, NS, COL) => {
                const code = [
                  'CMP  A, B    ;  compute A - B, update Z N C flags, discard result',
                  'BLT  label    ;  branch if N = 1            (A < B)',
                  'BEQ  label    ;  branch if Z = 1            (A = B)',
                  'BGT  label    ;  branch if Z = 0 AND N = 0  (A > B)',
                ];
                code.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 100); t.setAttribute('y', 240 + i * 48);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '15');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Every CPU you\u2019ve ever used. CMP + conditional branch. Every if-statement.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 7 — SIGNED COMPARISON
    // ════════════════════════════════════════════════════
    {
      id: 7,
      title: 'Signed vs. Unsigned',
      pages: [
        { sentences: [
          { text: `One subtlety. The same bits can represent very different numbers, depending on whether you treat them as unsigned — ordinary positive integers — or signed, using two\u2019s complement. And a magnitude comparison depends on which interpretation you choose.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Same Bits, Two Meanings', C().accent);
              b.drawCustom('bits', (g, NS, COL) => {
                const rows = [
                  ['1 1 1 1 1 1 1 1', '= 255 (unsigned)',  '= −1 (signed)'],
                  ['0 0 0 0 0 0 0 1', '= 1 (unsigned)',    '= 1 (signed)'],
                  ['1 0 0 0 0 0 0 0', '= 128 (unsigned)',  '= −128 (signed)'],
                  ['0 1 1 1 1 1 1 1', '= 127 (unsigned)',  '= 127 (signed)'],
                ];
                rows.forEach((r, i) => {
                  const y = 230 + i * 50;
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 160); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '16');
                  b_.setAttribute('font-weight', '700');
                  b_.setAttribute('fill', COL.wireHi);
                  b_.textContent = r[0]; g.appendChild(b_);
                  const u = document.createElementNS(NS, 'text');
                  u.setAttribute('x', 400); u.setAttribute('y', y);
                  u.setAttribute('font-family', 'monospace');
                  u.setAttribute('font-size', '14');
                  u.setAttribute('fill', COL.accent);
                  u.textContent = r[1]; g.appendChild(u);
                  const s = document.createElementNS(NS, 'text');
                  s.setAttribute('x', 620); s.setAttribute('y', y);
                  s.setAttribute('font-family', 'monospace');
                  s.setAttribute('font-size', '14');
                  s.setAttribute('fill', COL.edgeRise);
                  s.textContent = r[2]; g.appendChild(s);
                });
              });
              b.setLabel('Two\u2019s complement reinterprets the top bit as a sign. Same bits, different numbers.', C().accent);
            } },

          { text: `So "is 11111111 greater than 00000001?" As unsigned numbers, 255 is obviously greater than 1 — yes. As signed numbers, −1 is less than 1 — no. Same bits. Different answer. The comparator needs to know which interpretation the software wants.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Same Bits, Different Answer', C().wireHot);
              b.drawCustom('contrast', (g, NS, COL) => {
                const lines = [
                  ['A = 1 1 1 1 1 1 1 1',  ''],
                  ['B = 0 0 0 0 0 0 0 1',  ''],
                  ['',                      ''],
                  ['unsigned:',             'A = 255 > B = 1   →   A > B ✓'],
                  ['signed:',               'A = −1 < B = 1    →   A < B ✗'],
                ];
                lines.forEach((r, i) => {
                  const y = 210 + i * 45;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 200); a.setAttribute('y', y);
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '16');
                  a.setAttribute('font-weight', '700');
                  a.setAttribute('fill', i < 2 ? COL.wireHi : COL.accent);
                  a.textContent = r[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 400); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '15');
                  b_.setAttribute('fill', i === 3 ? COL.edgeRise : (i === 4 ? COL.wireHot : COL.label));
                  b_.textContent = r[1]; g.appendChild(b_);
                });
              });
              b.setLabel('Crucial reason CPUs have two sets of conditional branches — signed and unsigned.', C().wireHot);
            } },

          { text: `That's why every CPU has two flavours of conditional branch. Instructions like BLT and BGT are signed — they consult the negative flag. Instructions like BLO and BHI are unsigned — they consult the carry flag instead. Same hardware subtractor, different flag interpretation.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Two Families Of Conditional Branches', C().accent);
              b.drawCustom('branches', (g, NS, COL) => {
                const items = [
                  ['signed', 'BLT (less than)', 'BGT (greater than)', 'uses N (sign) flag',     COL.edgeRise],
                  ['unsigned', 'BLO (below)',    'BHI (above)',         'uses C (carry) flag',    COL.edgeRise],
                ];
                items.forEach((r, i) => {
                  const y = 240 + i * 70;
                  r.slice(0, 4).forEach((s, j) => {
                    const t = document.createElementNS(NS, 'text');
                    const xs = [140, 310, 490, 680];
                    t.setAttribute('x', xs[j]); t.setAttribute('y', y);
                    t.setAttribute('font-family', 'monospace');
                    t.setAttribute('font-size', '14');
                    t.setAttribute('font-weight', j === 0 ? '700' : '400');
                    t.setAttribute('fill', j === 0 ? r[4] : COL.accent);
                    t.textContent = s; g.appendChild(t);
                  });
                });
              });
              b.setLabel('Same subtractor, same flags, two reading rules. The programmer picks.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 8 — WHERE COMPARATORS LIVE
    // ════════════════════════════════════════════════════
    {
      id: 8,
      title: 'Where Comparators Hide',
      pages: [
        { sentences: [
          { text: `Branches and loops are the obvious ones. Every if-statement, every while and for loop, every early-exit, every ternary — at the hardware level, a comparator produces the bit that decides whether to branch.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Branches & Loops', C().accent);
              b.drawCustom('code', (g, NS, COL) => {
                const code = [
                  'for (int i = 0; i < n; i++) { … }',
                  'if (error_code != 0) goto fail;',
                  'while (head != NULL) head = head->next;',
                  'if (x >= threshold) alert();',
                ];
                code.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 140); t.setAttribute('y', 240 + i * 50);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '15');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Every comparison operator in every program ultimately calls the hardware comparator.', C().accent);
            } },

          { text: `Cache tag matching. When the CPU asks for a memory address, the cache has to check "do I already have a copy?" It compares the top bits of the request against the top bits of every cache line tag. Parallel comparators, running in parallel, answer in one cycle.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Cache Tag Matching', C().accent);
              b.drawNode('req', 120, 200, 'address =  0xABCD12', C().wireHi);
              for (let i = 0; i < 6; i++) {
                const y = 260 + i * 42;
                b.drawBox('line' + i, 80, y, 240, 32, 'cache line ' + i + '  tag: 0x' + (0xABC0 + i * 16).toString(16).toUpperCase(), C().label);
                b.drawBox('cmp' + i, 360, y, 120, 32, 'COMPARATOR', i === 2 ? C().edgeRise : C().accent);
                b.drawNode('res' + i, 510, y + 20, i === 2 ? 'MATCH ✓' : '—',
                  i === 2 ? C().edgeRise : C().dim);
              }
              b.setLabel('All tags compared at once. Exactly one match lights up → that cache line is a hit.', C().accent);
            } },

          { text: `Address range checking. Memory-mapped I/O devices check whether an incoming address falls within their range. That\u2019s a pair of comparators: greater-than-or-equal to my start address, AND less-than my end address.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Address Range Decoders', C().accent);
              b.drawBox('dev', 360, 240, 280, 160, 'I/O device', C().accent);
              b.drawNode('addr', 120, 320, 'addr →', C().wireHi);
              b.drawBox('c1', 200, 260, 120, 50, 'addr ≥ START', C().accent);
              b.drawBox('c2', 200, 340, 120, 50, 'addr <  END',  C().accent);
              b.drawWire('w1', [[320, 285],[360, 285]], C().wireHi);
              b.drawWire('w2', [[320, 365],[360, 365]], C().wireHi);
              b.drawWire('out', [[640, 320],[760, 320]], C().edgeRise);
              b.drawNode('out-l', 770, 320, 'respond', C().edgeRise);
              b.setLabel('Every peripheral does this. Thousands of range-compare circuits in a real system-on-chip.', C().accent);
            } },

          { text: `And of course: sort algorithms, search, priority queues, bounds-checking in safe languages, assertion failures, age checks, rate limits. Every place in software where one value is compared to another, there is a comparator in the silicon underneath.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Comparators Are Unbelievably Common', C().edgeRise);
              b.drawCustom('uses', (g, NS, COL) => {
                const items = [
                  '• every sort:  "is a[i] < a[j]?"',
                  '• every search: "is this the one?"',
                  '• every hash lookup: "do the keys match?"',
                  '• every heap priority: "is this higher than the root?"',
                  '• every bounds-check: "is this index < array length?"',
                  '• every assert: "is the condition true?"',
                ];
                items.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 140); t.setAttribute('y', 220 + i * 42);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '15');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('One of the most heavily-used hardware primitives in any computer.', C().edgeRise);
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
      title: 'Recap — The Comparator',
      pages: [
        { sentences: [
          { text: `Trace the build. A single XNOR gate is a 1-bit equality check — output 1 when the inputs match. AND together N XNOR outputs and you get N-bit equality for free.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 1 — Equality', C().accent);
              _drawNBitEquality(b, [1, 0, 1, 1], [1, 0, 1, 1]);
              b.setLabel('N XNORs + one AND = full multi-bit equality.', C().accent);
            } },

          { text: `For magnitude, one bit at a time isn\u2019t enough — you have to compare from the MSB downward and stop at the first differing bit. That gives A greater-than and A less-than signals that cascade up through the bits.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 2 — Magnitude (MSB-First)', C().accent);
              _drawTwoBinaryRows(b, [1, 0, 1, 1], [1, 0, 0, 1], { y: 200, prefix: 'rec' });
              b.setLabel('First differing bit wins. Dictionary ordering, translated to gates.', C().accent);
            } },

          { text: `Wrap it up with three output wires: A less-than B, A equals B, A greater-than B. Exactly one is lit. Every software comparison — including the derived ones like ≤ and ≠ — can be built from just those three signals.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 3 — Three Wires, One Lit', C().edgeRise);
              _drawLiveComparator(b);
              b.setLabel('Trichotomy in hardware. Exactly one output active, always.', C().edgeRise);
            } },

          { text: `Most real CPUs avoid a dedicated comparator by reusing the ALU\u2019s subtractor. A − B, read the zero and sign flags, and you have your comparison — including the ability to handle signed and unsigned interpretations with the same hardware, just by consulting different flags.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 4 — The ALU Already Does It', C().accent);
              b.drawBox('sub', 340, 220, 320, 180, 'SUBTRACTOR', C().edgeRise);
              b.drawNode('f1', 700, 260, 'Z flag → A = B', C().edgeRise);
              b.drawNode('f2', 700, 320, 'N flag → A < B (signed)', C().accent);
              b.drawNode('f3', 700, 380, 'C flag → A < B (unsigned)', C().accent);
              b.setLabel('Same silicon, many comparisons. A triumph of reuse.', C().accent);
            } },

          { text: `That\u2019s the comparator. The circuit that answers "how do these two numbers relate?" and makes every if, every loop, every branch possible. A handful of gates, or the side-effects of a subtractor — either way, the bedrock of program control flow.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Comparator — Bedrock Of Control Flow', C().edgeRise);
              _drawLiveComparator(b);
              b.setLabel('Without this, programs would be straight lines. With it, they have shape.', C().edgeRise);
            } },

          { text: `Next episode, the big one — the adder. And once we have an adder, we can combine it with the logic and comparator circuits to build the full ALU, the arithmetic heart of every CPU.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Next: The Adder', C().accent);
              b.drawBox('add', 360, 240, 280, 160, 'N-BIT ADDER', C().edgeRise);
              b.drawNode('a', 280, 290, 'A →', C().wireHi);
              b.drawNode('b', 280, 340, 'B →', C().wireHi);
              b.drawWire('wa', [[320, 290],[360, 290]], C().wireHi);
              b.drawWire('wb', [[320, 340],[360, 340]], C().wireHi);
              b.drawWire('o',  [[640, 320],[760, 320]], C().edgeRise);
              b.drawNode('ol', 770, 320, 'A + B', C().edgeRise);
              b.setLabel('The last purely combinational building block. Then we can assemble the ALU.', C().accent);
            } },
        ] },
      ],
      showAll: true,
      isFinal: true,
    },
  ];

  if (typeof window !== 'undefined') {
    window.BLOCKS_07_SCENES = BLOCKS_07_SCENES;
  }
})();
