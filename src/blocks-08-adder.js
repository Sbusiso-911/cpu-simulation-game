/**
 * Series B — Episode 8: How an Adder Is Built
 * ---------------------------------------------
 * This is the big one. Every counter, every ALU, every address calculation
 * needs binary addition. The path from "one gate" to "a 64-bit adder running
 * at a clock edge" is one of the most beautiful constructions in digital
 * logic: XOR + AND → half adder → full adder → ripple carry → lookahead.
 * And as a bonus, the same circuit does subtraction when you interpret its
 * inputs as two's complement.
 *
 * Arc:
 *   0. Hook                        addition is everywhere — and sneakily subtle
 *   1. Addition, remembered        decimal → binary, column by column
 *   2. The half adder              1-bit + 1-bit: sum = XOR, carry = AND
 *   3. The full adder              add Cin: two half adders + one OR
 *   4. Ripple carry                chain N full adders, carry flows LSB→MSB
 *   5. The speed problem           O(N) carry delay = unacceptable at GHz
 *   6. Carry lookahead             propagate / generate → O(log N) delay
 *   7. Subtraction from addition   two's complement: invert + Cin=1
 *   8. Overflow detection          unsigned (C) vs signed (V) flags
 *   9. Recap                       trust chain + ALU teaser
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
  const bitsOf = (v, n) => {
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push((v >> i) & 1);
    return out;
  };

  // ─────────────────────────────────────────
  //  Half adder: A, B → Sum, Cout.  Sum = A XOR B.  Cout = A AND B.
  // ─────────────────────────────────────────
  function _drawHalfAdder(b, A, Bv) {
    const col = C();
    const hi = (v) => v ? col.wireHi : col.wireLo;
    const S = A ^ Bv;
    const Cout = A & Bv;

    // Inputs
    b.drawNode('A-l', 80, 240, 'A = ' + A, hi(A));
    b.drawNode('B-l', 80, 400, 'B = ' + Bv, hi(Bv));

    // XOR for sum
    b.drawGate('xor', 'XOR', 320, 210, 140, 90);
    if (S) b.setState('xor', 'glow');
    // AND for carry
    b.drawGate('and', 'AND', 320, 360, 140, 80);
    if (Cout) b.setState('and', 'glow');

    // Wiring
    b.drawWire('wA-xor', [[130, 240],[250, 240],[250, 235],[320, 235]], hi(A));
    b.drawWire('wA-and', [[250, 240],[250, 380],[320, 380]], hi(A));
    b.drawWire('wB-xor', [[130, 400],[290, 400],[290, 275],[320, 275]], hi(Bv));
    b.drawWire('wB-and', [[290, 400],[290, 420],[320, 420]], hi(Bv));

    // Outputs
    b.drawWire('wS', [[462, 255],[680, 255]], hi(S));
    b.drawNode('S-l', 690, 255, 'Sum = ' + S, hi(S));
    b.drawWire('wC', [[462, 400],[680, 400]], hi(Cout));
    b.drawNode('C-l', 690, 400, 'Carry = ' + Cout, hi(Cout));

    b.drawNode('eq1', 500, 510, 'Sum   = A XOR B', col.accent);
    b.drawNode('eq2', 500, 540, 'Carry = A AND B', col.accent);
  }

  // ─────────────────────────────────────────
  //  Full adder: A, B, Cin → Sum, Cout.
  //  Sum  = A XOR B XOR Cin
  //  Cout = (A AND B) OR (Cin AND (A XOR B))
  // ─────────────────────────────────────────
  function _drawFullAdder(b, A, Bv, Cin) {
    const col = C();
    const hi = (v) => v ? col.wireHi : col.wireLo;
    const ab = A ^ Bv;
    const S = ab ^ Cin;
    const Cout = (A & Bv) | (Cin & ab);

    // First half adder (XOR + AND on A, B)
    b.drawGate('xor1', 'XOR', 220, 190, 110, 70);
    b.drawGate('and1', 'AND', 220, 380, 110, 70);

    // Second half adder (XOR + AND on A⊕B, Cin)
    b.drawGate('xor2', 'XOR', 420, 200, 110, 70);
    b.drawGate('and2', 'AND', 420, 320, 110, 70);

    // Final OR for carry-out
    b.drawGate('or',   'OR',  600, 340, 120, 90);

    if (S) b.setState('xor2', 'glow');
    if (A & Bv) b.setState('and1', 'glow');
    if (Cin & ab) b.setState('and2', 'glow');
    if (Cout) b.setState('or', 'glow');

    // Inputs
    b.drawNode('A-l', 80, 200, 'A = ' + A, hi(A));
    b.drawNode('B-l', 80, 240, 'B = ' + Bv, hi(Bv));
    b.drawNode('Cin-l', 80, 420, 'Cin = ' + Cin, hi(Cin));

    // Wires A, B → xor1, and1
    b.drawWire('wA-xor', [[130, 200],[180, 200],[180, 215],[220, 215]], hi(A));
    b.drawWire('wB-xor', [[130, 240],[170, 240],[170, 240],[220, 240]], hi(Bv));
    b.drawWire('wA-and', [[180, 215],[180, 400],[220, 400]], hi(A));
    b.drawWire('wB-and', [[170, 240],[170, 425],[220, 425]], hi(Bv));

    // xor1 output → xor2, and2
    b.drawWire('wAxB', [[332, 225],[400, 225],[400, 220],[420, 220]], hi(ab));
    b.drawWire('wAxB-and2', [[400, 225],[400, 340],[420, 340]], hi(ab));
    // Cin → xor2, and2
    b.drawWire('wCin-xor2', [[130, 420],[380, 420],[380, 255],[420, 255]], hi(Cin));
    b.drawWire('wCin-and2', [[380, 420],[380, 365],[420, 365]], hi(Cin));

    // Sum out
    b.drawWire('wS', [[532, 235],[760, 235]], hi(S));
    b.drawNode('S-l', 770, 235, 'Sum = ' + S, hi(S));

    // and1, and2 → OR
    b.drawWire('w-and1-or', [[332, 405],[570, 405],[570, 370],[600, 370]], hi(A & Bv));
    b.drawWire('w-and2-or', [[532, 355],[580, 355],[580, 400],[600, 400]], hi(Cin & ab));

    // OR → Cout
    b.drawWire('w-Cout', [[722, 385],[880, 385]], hi(Cout));
    b.drawNode('Cout-l', 890, 385, 'Cout = ' + Cout, hi(Cout));
  }

  // ─────────────────────────────────────────
  //  Ripple-carry adder visualised as N FullAdder blocks in a row.
  //  Each stage shows A_i, B_i, Cin, Sum, Cout. Carries flow right→left.
  // ─────────────────────────────────────────
  function _drawRippleAdder(b, aBits, bBits, Cin, opts) {
    opts = opts || {};
    const col = C();
    const hi = (v) => v ? col.wireHi : col.wireLo;
    const n = aBits.length;
    const cellW = 130, gap = 20;
    const totalW = n * cellW + (n - 1) * gap;
    const x0 = (1000 - totalW) / 2;
    const y = opts.y || 230;

    // Compute the bitwise addition from LSB (right, index n-1) up to MSB.
    const sums = new Array(n);
    const cos  = new Array(n);
    let c = Cin;
    for (let i = n - 1; i >= 0; i--) {
      const a = aBits[i], bi = bBits[i];
      sums[i] = a ^ bi ^ c;
      cos[i]  = ((a & bi) | (c & (a ^ bi))) & 1;
      c = cos[i];
    }
    const finalCout = c;

    // Draw each full adder block. Bit index 0 (MSB) on the left.
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * (cellW + gap);
      b.drawBox('fa' + i, cx, y, cellW, 120, 'FA', col.accent);
      // Bit-index label above
      b.drawNode('lab' + i, cx + cellW / 2, y - 16,
        'bit ' + (n - 1 - i), col.label);
      // A and B inputs — from above
      b.drawWire('wA' + i, [[cx + cellW * 0.35, y - 60],[cx + cellW * 0.35, y]], hi(aBits[i]));
      b.drawWire('wB' + i, [[cx + cellW * 0.65, y - 60],[cx + cellW * 0.65, y]], hi(bBits[i]));
      b.drawNode('aV' + i, cx + cellW * 0.35, y - 70, 'A=' + aBits[i], hi(aBits[i]));
      b.drawNode('bV' + i, cx + cellW * 0.65, y - 70, 'B=' + bBits[i], hi(bBits[i]));
      // Sum output — down
      b.drawWire('wS' + i, [[cx + cellW / 2, y + 120],[cx + cellW / 2, y + 160]], hi(sums[i]));
      b.drawNode('sV' + i, cx + cellW / 2, y + 180, 'S=' + sums[i],
        sums[i] ? col.edgeRise : col.label);
    }

    // Carry chain — right to left. cos[n-1] is the carry OUT of the LSB, which
    // becomes the carry IN to the next bit to its left.
    // Carry-in of the LSB: shown on the right. Carry-out of the MSB: on the left.
    // Draw the initial Cin coming into the rightmost stage.
    const rightX = x0 + (n - 1) * (cellW + gap) + cellW;
    b.drawWire('w-Cin', [[rightX + 60, y + 60],[rightX, y + 60]], hi(Cin));
    b.drawNode('Cin-l', rightX + 70, y + 60, 'Cin = ' + Cin, hi(Cin));

    // Between-stage carries.
    for (let i = n - 1; i >= 1; i--) {
      // Carry out of stage i → carry in of stage i-1 (to its left)
      const fromX = x0 + i * (cellW + gap);
      const toX   = x0 + (i - 1) * (cellW + gap) + cellW;
      b.drawWire('wc' + i, [[fromX, y + 60],[toX, y + 60]], hi(cos[i]));
      b.drawNode('cV' + i, (fromX + toX) / 2, y + 50, 'c=' + cos[i], hi(cos[i]));
    }

    // Final carry-out on the left
    const leftX = x0;
    b.drawWire('w-Cout', [[leftX, y + 60],[leftX - 60, y + 60]], hi(finalCout));
    b.drawNode('Cout-l', leftX - 70, y + 60, 'Cout = ' + finalCout, hi(finalCout));

    return { sums, finalCout };
  }

  // ─────────────────────────────────────────
  //  Polyline helpers — for carries that visibly travel along wires.
  // ─────────────────────────────────────────
  function _polyLen(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0];
      const dy = pts[i][1] - pts[i - 1][1];
      L += Math.sqrt(dx * dx + dy * dy);
    }
    return L;
  }
  function _polyPointAt(pts, u) {
    const total = _polyLen(pts);
    const target = total * u;
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0];
      const dy = pts[i][1] - pts[i - 1][1];
      const seg = Math.sqrt(dx * dx + dy * dy);
      if (acc + seg >= target) {
        const t = (target - acc) / (seg || 1);
        return [pts[i - 1][0] + dx * t, pts[i - 1][1] + dy * t];
      }
      acc += seg;
    }
    return pts[pts.length - 1].slice();
  }

  // Animate a glowing pulse travelling along a polyline path.
  //   id:           unique id
  //   pts:          polyline [[x,y],…]
  //   startMs:      when, inside the current sentence, the pulse begins (ms)
  //   travelMs:     how long the pulse takes to traverse the path
  //   color:        fill colour
  //   label:        optional text drawn next to the pulse while it travels
  // Once the pulse arrives, it fades out quickly.
  function _animateCarryPulse(b, id, pts, opts) {
    opts = opts || {};
    const color = opts.color || '#00ff88';
    const radius = opts.radius || 10;
    const startMs = opts.startMs || 0;
    const travelMs = opts.travelMs || 1500;
    const fadeMs = 300;
    let circleEl = null, glowEl = null, labelEl = null;

    b.drawCustom(id, (g, NS) => {
      // Outer glow
      glowEl = document.createElementNS(NS, 'circle');
      glowEl.setAttribute('r', radius * 2);
      glowEl.setAttribute('fill', color);
      glowEl.setAttribute('opacity', '0');
      g.appendChild(glowEl);
      // Inner bright dot
      circleEl = document.createElementNS(NS, 'circle');
      circleEl.setAttribute('r', radius);
      circleEl.setAttribute('fill', color);
      circleEl.setAttribute('stroke', '#fff');
      circleEl.setAttribute('stroke-width', '1.5');
      circleEl.setAttribute('opacity', '0');
      g.appendChild(circleEl);
      if (opts.label) {
        labelEl = document.createElementNS(NS, 'text');
        labelEl.setAttribute('font-family', 'monospace');
        labelEl.setAttribute('font-size', '13');
        labelEl.setAttribute('font-weight', '700');
        labelEl.setAttribute('fill', color);
        labelEl.setAttribute('opacity', '0');
        labelEl.textContent = opts.label;
        g.appendChild(labelEl);
      }
    });
    b.animate(id, (tMs) => {
      const local = tMs - startMs;
      if (local < 0) {
        if (circleEl) circleEl.setAttribute('opacity', '0');
        if (glowEl)   glowEl.setAttribute('opacity', '0');
        if (labelEl)  labelEl.setAttribute('opacity', '0');
        return;
      }
      const u = Math.min(1, local / travelMs);
      const [x, y] = _polyPointAt(pts, u);
      if (circleEl) {
        circleEl.setAttribute('cx', x);
        circleEl.setAttribute('cy', y);
      }
      if (glowEl) {
        glowEl.setAttribute('cx', x);
        glowEl.setAttribute('cy', y);
      }
      if (labelEl) {
        labelEl.setAttribute('x', x + 12);
        labelEl.setAttribute('y', y - 12);
      }
      // Fade-in for first 200ms, fade-out in last fadeMs before u=1 completes,
      // then full fade after arrival.
      const postArrive = local - travelMs;
      let op = 1;
      if (u < 0.15) op = u / 0.15;
      else if (postArrive >= 0) {
        op = Math.max(0, 1 - postArrive / fadeMs);
      }
      if (circleEl) circleEl.setAttribute('opacity', op);
      if (glowEl)   glowEl.setAttribute('opacity', op * 0.35);
      if (labelEl)  labelEl.setAttribute('opacity', op);
    });
  }

  // ─────────────────────────────────────────
  //  A single adder, shown as a clean labelled block — for the "one-atom"
  //  preamble beats.  Big, centred, and uncluttered.  We deliberately use
  //  a labelled block (not the gate-level schematic from Scene 3) because
  //  this beat is about the BEHAVIOUR of one adder, not its construction.
  //    opts.A, opts.Bv:        input bit values (0|1)
  //    opts.showBigEquation:   write "1 + 1 = 10" big at the bottom
  //    opts.crossOutTwo:       draw a red "2" struck out, next to the "10"
  //    opts.small:             half-size rendering (used in the transition beat)
  // ─────────────────────────────────────────
  function _drawSingleAdderAtom(b, opts) {
    opts = opts || {};
    const col = C();
    const A = opts.A, Bv = opts.Bv;
    const small = !!opts.small;
    const cw = small ? 220 : 340;
    const ch = small ? 150 : 220;
    const cx = 500 - cw / 2;
    const cy = small ? 200 : 200;

    // The adder box itself
    b.drawBox('atom', cx, cy, cw, ch, 'ADDER', col.edgeRise);
    b.setState('atom', 'glow');

    // A and B inputs — labels above, wires down
    const aIn = cx - 40;
    const bIn = cx - 40;
    b.drawWire('w-A', [[aIn, cy + ch * 0.3],[cx, cy + ch * 0.3]], A ? col.wireHi : col.wireLo);
    b.drawNode('A-l', aIn - 16, cy + ch * 0.3, 'A = ' + A, A ? col.wireHi : col.wireLo);
    b.drawWire('w-B', [[bIn, cy + ch * 0.7],[cx, cy + ch * 0.7]], Bv ? col.wireHi : col.wireLo);
    b.drawNode('B-l', bIn - 16, cy + ch * 0.7, 'B = ' + Bv, Bv ? col.wireHi : col.wireLo);

    // Sum output — wire down and to the right
    const S = A ^ Bv;
    const Co = A & Bv;
    const outR = cx + cw;
    b.drawWire('w-S', [[outR, cy + ch * 0.7],[outR + 60, cy + ch * 0.7]], S ? col.wireHi : col.wireLo);
    b.drawNode('S-l', outR + 72, cy + ch * 0.7, 'Sum = ' + S, S ? col.edgeRise : col.label);

    // Carry output — wire out of the top-right
    b.drawWire('w-Co', [[outR, cy + ch * 0.3],[outR + 60, cy + ch * 0.3]], Co ? col.wireHi : col.wireLo);
    b.drawNode('Co-l', outR + 72, cy + ch * 0.3, 'Carry = ' + Co, Co ? col.edgeRise : col.label);

    if (opts.showBigEquation && !small) {
      // Big headline equation at the bottom — the thing we want them to remember
      b.drawCustom('big-eq', (g, NS, COL) => {
        const eq = document.createElementNS(NS, 'text');
        eq.setAttribute('x', 500); eq.setAttribute('y', cy + ch + 80);
        eq.setAttribute('text-anchor', 'middle');
        eq.setAttribute('font-family', 'monospace');
        eq.setAttribute('font-size', '48');
        eq.setAttribute('font-weight', '700');
        eq.setAttribute('fill', COL.edgeRise);
        eq.textContent = A + ' + ' + Bv + ' = ' + (A + Bv === 2 ? '10' : String(A + Bv));
        g.appendChild(eq);
        if (opts.crossOutTwo) {
          // Red "2" crossed out, and a note about "one-zero"
          const two = document.createElementNS(NS, 'text');
          two.setAttribute('x', 720); two.setAttribute('y', cy + ch + 80);
          two.setAttribute('font-family', 'monospace');
          two.setAttribute('font-size', '36');
          two.setAttribute('font-weight', '700');
          two.setAttribute('fill', COL.wireHot);
          two.textContent = 'not 2'; g.appendChild(two);
          const strike = document.createElementNS(NS, 'line');
          strike.setAttribute('x1', 710); strike.setAttribute('x2', 830);
          strike.setAttribute('y1', cy + ch + 90);
          strike.setAttribute('y2', cy + ch + 60);
          strike.setAttribute('stroke', COL.wireHot); strike.setAttribute('stroke-width', '4');
          g.appendChild(strike);
          const oz = document.createElementNS(NS, 'text');
          oz.setAttribute('x', 500); oz.setAttribute('y', cy + ch + 120);
          oz.setAttribute('text-anchor', 'middle');
          oz.setAttribute('font-family', 'monospace');
          oz.setAttribute('font-size', '16');
          oz.setAttribute('fill', COL.accent);
          oz.textContent = '"one group of two, plus zero ones"';
          g.appendChild(oz);
        }
      });
    }
  }

  // ─────────────────────────────────────────
  //  Memory-trick visual — decimal 9+1 and binary 1+1 side by side, so
  //  the learner sees the "10" shape is identical in both bases.
  // ─────────────────────────────────────────
  function _drawMemoryTrickSideBySide(b) {
    const col = C();
    b.drawCustom('mem-trick', (g, NS, COL) => {
      // Left panel — decimal
      const lBg = document.createElementNS(NS, 'rect');
      lBg.setAttribute('x', 80); lBg.setAttribute('y', 200);
      lBg.setAttribute('width', 380); lBg.setAttribute('height', 260);
      lBg.setAttribute('rx', 10);
      lBg.setAttribute('fill', COL.panel);
      lBg.setAttribute('stroke', COL.accent); lBg.setAttribute('stroke-width', '2');
      g.appendChild(lBg);
      const lLab = document.createElementNS(NS, 'text');
      lLab.setAttribute('x', 270); lLab.setAttribute('y', 240);
      lLab.setAttribute('text-anchor', 'middle');
      lLab.setAttribute('font-family', 'monospace');
      lLab.setAttribute('font-size', '14'); lLab.setAttribute('font-weight', '700');
      lLab.setAttribute('fill', COL.accent);
      lLab.textContent = 'DECIMAL  (base 10)'; g.appendChild(lLab);
      const lEq = document.createElementNS(NS, 'text');
      lEq.setAttribute('x', 270); lEq.setAttribute('y', 340);
      lEq.setAttribute('text-anchor', 'middle');
      lEq.setAttribute('font-family', 'monospace');
      lEq.setAttribute('font-size', '54'); lEq.setAttribute('font-weight', '700');
      lEq.setAttribute('fill', COL.edgeRise);
      lEq.textContent = '9 + 1 = 10'; g.appendChild(lEq);
      const lSub = document.createElementNS(NS, 'text');
      lSub.setAttribute('x', 270); lSub.setAttribute('y', 400);
      lSub.setAttribute('text-anchor', 'middle');
      lSub.setAttribute('font-family', 'monospace');
      lSub.setAttribute('font-size', '14');
      lSub.setAttribute('fill', COL.label);
      lSub.textContent = 'column fills up → roll over → carry 1'; g.appendChild(lSub);

      // Right panel — binary
      const rBg = document.createElementNS(NS, 'rect');
      rBg.setAttribute('x', 540); rBg.setAttribute('y', 200);
      rBg.setAttribute('width', 380); rBg.setAttribute('height', 260);
      rBg.setAttribute('rx', 10);
      rBg.setAttribute('fill', COL.panel);
      rBg.setAttribute('stroke', COL.edgeRise); rBg.setAttribute('stroke-width', '2');
      g.appendChild(rBg);
      const rLab = document.createElementNS(NS, 'text');
      rLab.setAttribute('x', 730); rLab.setAttribute('y', 240);
      rLab.setAttribute('text-anchor', 'middle');
      rLab.setAttribute('font-family', 'monospace');
      rLab.setAttribute('font-size', '14'); rLab.setAttribute('font-weight', '700');
      rLab.setAttribute('fill', COL.edgeRise);
      rLab.textContent = 'BINARY  (base 2)'; g.appendChild(rLab);
      const rEq = document.createElementNS(NS, 'text');
      rEq.setAttribute('x', 730); rEq.setAttribute('y', 340);
      rEq.setAttribute('text-anchor', 'middle');
      rEq.setAttribute('font-family', 'monospace');
      rEq.setAttribute('font-size', '54'); rEq.setAttribute('font-weight', '700');
      rEq.setAttribute('fill', COL.edgeRise);
      rEq.textContent = '1 + 1 = 10'; g.appendChild(rEq);
      const rSub = document.createElementNS(NS, 'text');
      rSub.setAttribute('x', 730); rSub.setAttribute('y', 400);
      rSub.setAttribute('text-anchor', 'middle');
      rSub.setAttribute('font-family', 'monospace');
      rSub.setAttribute('font-size', '14');
      rSub.setAttribute('fill', COL.label);
      rSub.textContent = 'column fills up → roll over → carry 1'; g.appendChild(rSub);

      // Arrow between them — emphasising SAME rule
      const arrow = document.createElementNS(NS, 'text');
      arrow.setAttribute('x', 500); arrow.setAttribute('y', 345);
      arrow.setAttribute('text-anchor', 'middle');
      arrow.setAttribute('font-family', 'monospace');
      arrow.setAttribute('font-size', '26');
      arrow.setAttribute('font-weight', '700');
      arrow.setAttribute('fill', COL.accent);
      arrow.textContent = '↔'; g.appendChild(arrow);

      // Tagline under both
      const tag = document.createElementNS(NS, 'text');
      tag.setAttribute('x', 500); tag.setAttribute('y', 500);
      tag.setAttribute('text-anchor', 'middle');
      tag.setAttribute('font-family', 'monospace');
      tag.setAttribute('font-size', '18'); tag.setAttribute('font-weight', '700');
      tag.setAttribute('fill', COL.edgeRise);
      tag.textContent = 'same rule — just a different base'; g.appendChild(tag);
    });
  }

  // ─────────────────────────────────────────
  //  Walkthrough-mode ripple adder.
  //  Designed for one worked example, shown patiently, beat by beat.
  //    step: how many bit positions have been COMPUTED so far (0..4).
  //          0 = nothing computed yet (setup). 4 = all bits done.
  //    active: which column is currently being explained (0=LSB..3=MSB, or -1 to dim)
  //    inputsRevealed: for the active column — how many inputs are visible
  //                    ('none'|'A'|'AB'|'ABC')
  //    showSum: boolean — reveal the sum bit of the active column
  //  All prior computed columns are fully shown (faded but legible).
  //  Returns a layout object with coordinates so the caller can wire pulses.
  // ─────────────────────────────────────────
  function _drawRippleWalkthrough(b, opts) {
    const col = C();
    const aBits = opts.aBits;        // [msb, ..., lsb] i.e. bits in MSB-first array order
    const bBits = opts.bBits;
    const Cin   = opts.Cin || 0;
    const step  = opts.step || 0;     // 0..4
    const active = (opts.active === undefined) ? -1 : opts.active;
    const inputsRevealed = opts.inputsRevealed || 'ABC';
    const showSum = !!opts.showSum;

    // Pre-compute the arithmetic so we always draw correct values.
    const n = 4;
    // aBits[0] is MSB = bit index 3.  We want accessors by bit-index (0=LSB).
    const A = (bitIdx) => aBits[n - 1 - bitIdx];
    const Bf = (bitIdx) => bBits[n - 1 - bitIdx];
    const sums = new Array(n), cos = new Array(n);
    {
      let c = Cin;
      for (let i = 0; i < n; i++) {
        const a = A(i), bi = Bf(i);
        sums[i] = a ^ bi ^ c;
        cos[i]  = ((a & bi) | (c & (a ^ bi))) & 1;
        c = cos[i];
      }
    }

    // Geometry — FA boxes arranged MSB-left to LSB-right.
    const faW = 130, faH = 140, gap = 25;
    const totalW = n * faW + (n - 1) * gap;
    const x0 = (1000 - totalW) / 2;
    const y = 220;
    // bit-index → center x of its FA (bit 0 = rightmost)
    const bitCx = (bi) => x0 + (n - 1 - bi) * (faW + gap) + faW / 2;
    const bitLeft  = (bi) => bitCx(bi) - faW / 2;
    const bitRight = (bi) => bitCx(bi) + faW / 2;
    const carryY = y + faH / 2 + 10;                // y of the carry wire
    const inputTop = y - 50;                         // where A/B values appear above
    const sumY = y + faH + 10;                       // sum value just under the FA

    // Returns the colour for a wire based on logic level + whether that
    // column is already "computed" or part of the active column's current
    // inputs-revealed step.
    const lvl = (bi, kind, value) => {
      // If bi < step: fully settled, bright colour
      if (bi < step) return value ? col.wireHi : col.wireLo;
      // If bi === active: reveal progressively
      if (bi === active) {
        if (kind === 'A' || kind === 'B') {
          if (inputsRevealed === 'none') return col.dim;
          if (inputsRevealed === 'A' && kind !== 'A') return col.dim;
          return value ? col.wireHi : col.wireLo;
        }
        if (kind === 'Cin') {
          if (inputsRevealed === 'ABC') return value ? col.wireHi : col.wireLo;
          return col.dim;
        }
        if (kind === 'sum' || kind === 'cout') {
          return showSum ? (value ? col.wireHi : col.wireLo) : col.dim;
        }
      }
      // Otherwise — future columns — stay dim.
      return col.dim;
    };

    // Draw each FA
    for (let bi = 0; bi < n; bi++) {
      const cx = bitCx(bi);
      const isActive = bi === active;
      const isDone = bi < step;
      b.drawBox('fa' + bi, cx - faW / 2, y, faW, faH, 'FULL ADDER',
        isActive ? col.edgeRise : (isDone ? col.accent : col.label));
      if (isActive && (inputsRevealed === 'ABC' || showSum)) {
        b.setState('fa' + bi, 'glow');
      }
      // Column label above
      b.drawNode('lab' + bi, cx, y - 80, 'bit ' + bi,
        isActive ? col.edgeRise : (isDone ? col.accent : col.label));
    }

    // A and B input wires from above, with values shown at top
    for (let bi = 0; bi < n; bi++) {
      const cx = bitCx(bi);
      const aVal = A(bi), bVal = Bf(bi);
      b.drawWire('wA' + bi, [[cx - 25, inputTop],[cx - 25, y]], lvl(bi, 'A', aVal));
      b.drawNode('vA' + bi, cx - 25, inputTop - 6, 'A=' + aVal, lvl(bi, 'A', aVal));
      b.drawWire('wB' + bi, [[cx + 25, inputTop],[cx + 25, y]], lvl(bi, 'B', bVal));
      b.drawNode('vB' + bi, cx + 25, inputTop - 6, 'B=' + bVal, lvl(bi, 'B', bVal));
    }

    // Sum wires + values below
    for (let bi = 0; bi < n; bi++) {
      const cx = bitCx(bi);
      b.drawWire('wS' + bi, [[cx, y + faH],[cx, sumY + 20]], lvl(bi, 'sum', sums[bi]));
      b.drawNode('vS' + bi, cx, sumY + 40, 'sum=' + sums[bi], lvl(bi, 'sum', sums[bi]));
    }

    // Initial Cin coming into the rightmost FA (bit 0) from the right
    const rightEdge = bitRight(0);
    b.drawWire('w-Cin-in', [[rightEdge + 80, carryY],[rightEdge, carryY]],
      lvl(0, 'Cin', Cin));
    b.drawNode('Cin-l', rightEdge + 92, carryY, 'Cin=' + Cin, lvl(0, 'Cin', Cin));

    // Inter-stage carry wires (bit i Cout → bit i+1 Cin, flowing right-to-left).
    // These wires only light up if the source bit has computed.
    for (let bi = 0; bi < n - 1; bi++) {
      const fromX = bitLeft(bi);
      const toX   = bitRight(bi + 1);
      const carryVal = cos[bi];
      const visible = bi < step;         // wire lights once bit i is done
      b.drawWire('wC' + bi, [[fromX, carryY],[toX, carryY]],
        visible ? (carryVal ? col.wireHi : col.wireLo) : col.dim);
      b.drawNode('cLab' + bi, (fromX + toX) / 2, carryY - 12,
        visible ? ('carry=' + carryVal) : '',
        carryVal && visible ? col.edgeRise : col.label);
    }

    // Final carry-out on the left
    const leftEdge = bitLeft(3);
    const finalVisible = step >= 4;
    b.drawWire('w-Cout', [[leftEdge, carryY],[leftEdge - 80, carryY]],
      finalVisible ? (cos[3] ? col.wireHi : col.wireLo) : col.dim);
    b.drawNode('Cout-l', leftEdge - 92, carryY, finalVisible ? ('Cout=' + cos[3]) : 'Cout=?',
      finalVisible ? (cos[3] ? col.edgeRise : col.label) : col.label);

    // Layout info returned so sentences can target pulse animations precisely.
    return {
      bitCx, bitLeft, bitRight, carryY, sumY, inputTop, faY: y, faH,
      carryPath: (bi) => [[bitLeft(bi), carryY], [bitRight(bi + 1), carryY]],
      cinPath: () => [[rightEdge + 80, carryY], [rightEdge, carryY]],
      coutPath: () => [[leftEdge, carryY], [leftEdge - 80, carryY]],
      sums, cos,
    };
  }

  // ─────────────────────────────────────────
  //  SCENES
  // ─────────────────────────────────────────
  const BLOCKS_08_SCENES = [

    // ════════════════════════════════════════════════════
    // SCENE 0 — HOOK
    // ════════════════════════════════════════════════════
    {
      id: 0,
      title: 'The Heart Of The ALU',
      pages: [
        { sentences: [
          { text: `Every plus sign in your source code. Every address offset. Every loop counter. Every array index. All of them end up at the same place in silicon — the adder. It\u2019s the most-used arithmetic circuit on a CPU, and arguably the most important.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Addition Is Everywhere', C().edgeRise);
              b.drawCustom('uses', (g, NS, COL) => {
                const lines = [
                  'x = a + b;            // plain arithmetic',
                  'ptr = base + offset;  // address calculation',
                  'i++;                  // loop counter',
                  'arr[i + 1]            // index arithmetic',
                  'pc = pc + 1;          // next instruction',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 160); t.setAttribute('y', 230 + i * 45);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '16');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('All of these, at the hardware level, are the same circuit running.', C().accent);
            } },

          { text: `But addition is also subtle. Adding two sixty-four-bit numbers at three gigahertz means that entire calculation — every bit, every carry, every overflow check — must finish in about a third of a nanosecond. Getting that right took decades of hardware-design work.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Every Add, In Less Than A Nanosecond', C().wireHot);
              b.drawNode('h1', 500, 240, '64-bit add  @  3 GHz  →  ~330 picoseconds per addition',  C().wireHot);
              b.drawNode('h2', 500, 290, 'billions of additions per second, every second',          C().accent);
              b.drawNode('h3', 500, 360, 'how do you make binary addition that fast?', C().edgeRise);
              b.setLabel('Naive designs simply cannot keep up. There\u2019s a whole engineering story here.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 1 — ADDITION REMEMBERED
    // ════════════════════════════════════════════════════
    {
      id: 1,
      title: 'Addition, Remembered',
      pages: [
        { sentences: [
          { text: `Start where everyone learned addition — with pencil and paper, in base 10. Line up the columns, add right to left, and when the column sum is ten or more, write down the last digit and carry one into the next column.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Decimal — Column By Column', C().accent);
              b.drawCustom('dec', (g, NS, COL) => {
                const lines = [
                  '    2 7 8',
                  '  + 1 4 5',
                  '  ───────',
                  '    4 2 3',
                  '',
                  'column 1: 8 + 5 = 13  → write 3, carry 1',
                  'column 2: 7 + 4 + 1 = 12  → write 2, carry 1',
                  'column 3: 2 + 1 + 1 = 4   → write 4',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 200); t.setAttribute('y', 190 + i * 42);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', i < 4 ? 26 : 15);
                  t.setAttribute('font-weight', i < 4 ? '700' : '400');
                  t.setAttribute('fill', i < 4 ? COL.edgeRise : COL.label);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('You already know this. The only trick is the carry between columns.', C().accent);
            } },

          { text: `Binary addition works exactly the same way — only simpler, because each column sum can be at most three: bit plus bit plus carry. And any sum of two or more produces a carry. No memorising a 10×10 table — just a 2×2 one.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Binary — Same Algorithm, Tinier Table', C().edgeRise);
              b.drawCustom('bin', (g, NS, COL) => {
                const lines = [
                  '    1 0 1 1',
                  '  + 0 1 1 0',
                  '  ─────────',
                  '  1 0 0 0 1',
                  '',
                  'bit 1: 1 + 0 = 1        → write 1',
                  'bit 2: 1 + 1 = 10      → write 0, carry 1',
                  'bit 3: 0 + 1 + 1 = 10 → write 0, carry 1',
                  'bit 4: 1 + 0 + 1 = 10 → write 0, carry 1',
                  'bit 5: 0 + 0 + 1 = 1   → write 1',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 180); t.setAttribute('y', 170 + i * 35);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', i < 4 ? 22 : 14);
                  t.setAttribute('font-weight', i < 4 ? '700' : '400');
                  t.setAttribute('fill', i < 4 ? COL.edgeRise : COL.label);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Same algorithm as decimal. With only two digits the column logic is tiny.', C().edgeRise);
            } },

          { text: `So to build a binary adder, all we really need is a circuit that does one column — add a bit, a bit, and a carry — and outputs a sum bit and a new carry. Then we chain N of those together to make an N-bit adder. That\u2019s the whole plan.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Plan', C().accent);
              b.drawCustom('plan', (g, NS, COL) => {
                const lines = [
                  '1. build a 1-column adder — 3 bits in, 2 bits out',
                  '2. chain N of them together, carry connecting one to the next',
                  '3. done',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 200); t.setAttribute('y', 260 + i * 50);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '17');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Two ingredients, one recipe. The rest is optimisation.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 2 — HALF ADDER
    // ════════════════════════════════════════════════════
    {
      id: 2,
      title: 'The Half Adder',
      pages: [
        { sentences: [
          { text: `First, the simplest case. Add two single bits — no carry-in yet. There are exactly four possibilities. Zero plus zero is zero. Zero plus one is one. One plus zero is one. And one plus one is two — which in binary is "1 0", sum zero with a carry of one.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('1-Bit + 1-Bit — The Four Cases', C().accent);
              b.drawTruthTable('tt', 340, 220, ['A','B','Sum','Carry'], [
                [0, 0, 0, 0],
                [0, 1, 1, 0],
                [1, 0, 1, 0],
                [1, 1, 0, 1],
              ]);
              b.setLabel('Four rows. Two outputs. That\u2019s the whole table we need to implement.', C().accent);
            } },

          { text: `Look at the sum column. It\u2019s 1 when exactly one of the inputs is 1 — zero otherwise. That\u2019s exactly the XOR gate\u2019s behaviour. Look at the carry column. It\u2019s 1 only when both inputs are 1 — that\u2019s the AND gate. So the whole half adder is one XOR for the sum, one AND for the carry. Two gates.`,
            dur: 16500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Sum = XOR, Carry = AND', C().edgeRise);
              _drawHalfAdder(b, 1, 1);
              b.setLabel('Two gates. Two inputs. Two outputs. That is the half adder.', C().edgeRise);
            } },

          { text: `Try each combination. Zero plus zero: both gates see zeros, both outputs go dark. Zero plus one, or one plus zero: the XOR fires, sum is 1, carry stays 0. One plus one: XOR sees two ones and outputs 0, AND sees two ones and outputs 1 — sum 0, carry 1.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Walk Through — 1 + 0', C().accent);
              _drawHalfAdder(b, 1, 0);
              b.setLabel('XOR lights on disagreement. AND lights on unanimous high. Between them, the table is covered.', C().accent);
            } },

          { text: `Why is it called a "half" adder? Because it doesn\u2019t handle a carry coming in from the column to its right. It only adds two bits, not three. For the leftmost column in an addition, that\u2019s fine — but every other column needs a proper full adder.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Only Half The Job', C().accent);
              _drawHalfAdder(b, 1, 1);
              b.drawNode('missing', 500, 480, 'no Cin input — can\u2019t chain with others', C().wireHot);
              b.setLabel('Usable alone for the LSB. Useless in the middle. We need the full version next.', C().wireHot);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 3 — FULL ADDER
    // ════════════════════════════════════════════════════
    {
      id: 3,
      title: 'The Full Adder',
      pages: [
        { sentences: [
          { text: `A full adder takes three inputs: two data bits A and B, plus a carry-in from the previous column. It produces two outputs: the sum of the three inputs, and a carry-out to the next column.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Three Inputs, Two Outputs', C().accent);
              b.drawBox('fa', 340, 220, 320, 180, 'FULL ADDER', C().edgeRise);
              b.drawNode('a-l',  280, 260, 'A →',   C().wireHi);
              b.drawNode('b-l',  280, 320, 'B →',   C().wireHi);
              b.drawNode('ci-l', 280, 380, 'Cin →', C().wireHi);
              b.drawWire('wa', [[310, 260],[340, 260]], C().wireHi);
              b.drawWire('wb', [[310, 320],[340, 320]], C().wireHi);
              b.drawWire('wci', [[310, 380],[340, 380]], C().wireHi);
              b.drawWire('ws',  [[660, 280],[760, 280]], C().edgeRise);
              b.drawWire('wco', [[660, 360],[760, 360]], C().edgeRise);
              b.drawNode('s-l',  770, 280, '→ Sum',  C().edgeRise);
              b.drawNode('co-l', 770, 360, '→ Cout', C().edgeRise);
              b.setLabel('Three in, two out. This is the block we chain to build an N-bit adder.', C().accent);
            } },

          { text: `There are eight input combinations. Trace them through. When the three inputs add to zero, sum and carry are both zero. When they add to one, sum is 1, carry is 0. When they add to two, sum is 0, carry is 1. When they add to three, sum and carry are both 1.`,
            dur: 15500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Full Adder Truth Table', C().accent);
              b.drawTruthTable('tt', 280, 180, ['A','B','Cin','Sum','Cout'], [
                [0, 0, 0, 0, 0],
                [0, 0, 1, 1, 0],
                [0, 1, 0, 1, 0],
                [0, 1, 1, 0, 1],
                [1, 0, 0, 1, 0],
                [1, 0, 1, 0, 1],
                [1, 1, 0, 0, 1],
                [1, 1, 1, 1, 1],
              ]);
              b.setLabel('Sum = count of 1s is odd. Cout = at least two of the inputs are 1.', C().accent);
            } },

          { text: `The cleanest way to build a full adder is to chain two half adders with one OR gate. The first half adder adds A and B. The second adds their sum with Cin to produce the final sum. And the final carry-out is 1 whenever either half adder produced a carry — so we OR the two carries.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Two Half Adders + One OR', C().edgeRise);
              _drawFullAdder(b, 1, 1, 1);
              b.setLabel('Six gates total. Re-uses the half-adder pattern twice. Elegant.', C().edgeRise);
            } },

          { text: `Try A equals 1, B equals 1, Cin equals 1. First XOR: 1 XOR 1 equals 0 — that goes to the second XOR along with Cin equals 1, giving sum equals 1. First AND: 1 AND 1 equals 1 — one carry. Second AND: 0 AND 1 equals 0 — no carry. OR them together: carry-out equals 1. Check against the table: row 8, sum 1, carry 1. Match.`,
            dur: 16500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('1 + 1 + 1 = 11 (binary)  →  Sum = 1, Cout = 1', C().edgeRise);
              _drawFullAdder(b, 1, 1, 1);
              b.drawNode('note', 500, 580, 'traces the truth table, row by row', C().accent);
              b.setLabel('Every combination handled by the same six gates. That\u2019s a full adder.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 4 — RIPPLE CARRY  (PATIENT WALKTHROUGH)
    //
    // Pedagogical rewrite under the new rules:
    //   • animation-first — every beat driven by a visible event on screen
    //   • signals visibly travel — the carry is a glowing pulse moving along a wire
    //   • ONE atom first — the whole scene is built around 1+1=10 in a single
    //     adder.  Four beats are spent just on that, with a memory trick and
    //     beginner-voice questions, BEFORE any chaining happens.
    //   • concretion before abstraction — values appear first, names follow
    //   • beginner vocabulary — no jargon before it has been grounded
    // ════════════════════════════════════════════════════
    {
      id: 4,
      title: 'Ripple-Carry — One Adder, Then Four',
      pages: [
        { sentences: [
          // ─────────────────────────────────────────
          //  ATOMIC BEAT 1 — ONE ADDER, ONE FACT.
          //  Everything that follows depends on the viewer truly internalising
          //  "1 + 1 = 10 in binary."  So we spend 20 seconds sitting with it.
          // ─────────────────────────────────────────
          { text: `Before we chain anything together — before we talk about four bits, or eight bits, or sixty-four — stop. There\u2019s one single fact that makes every adder on Earth work. One fact. If you remember nothing else from this whole episode, remember this: 1 plus 1 in binary equals 10. Not two. Ten. Written one-zero. Say it out loud.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The One Fact That Runs Every Adder', C().edgeRise);
              _drawSingleAdderAtom(b, { A: 1, Bv: 1, showBigEquation: true });
              b.setLabel('1 + 1 = 10.  Not \u201ctwo.\u201d  \u201cOne-zero.\u201d  This is THE fact.', C().edgeRise);
            } },

          // ─────────────────────────────────────────
          //  ATOMIC BEAT 2 — WHY THIS FEELS WRONG AT FIRST.
          //  Voice the beginner's confusion out loud.  "But that's two!"
          // ─────────────────────────────────────────
          { text: `I know — your brain is shouting at the screen right now: \u201cbut 1 plus 1 is TWO!\u201d And you\u2019re right, in decimal. But binary doesn\u2019t have a symbol for two. It only has 0 and 1. So the moment our column needs to hold a value bigger than 1, we\u2019re out of symbols. The answer has to spill over into a second column. That spill is called the carry. The result is written one-zero — meaning \u201cone group of two, plus zero ones left over.\u201d`,
            dur: 25000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Why Binary Runs Out Of Symbols So Fast', C().accent);
              _drawSingleAdderAtom(b, { A: 1, Bv: 1, showBigEquation: true, crossOutTwo: true });
              b.setLabel('No symbol for "2" in binary. So "two" gets written \u201c10\u201d \u2014 one group of two, zero extras.', C().accent);
            } },

          // ─────────────────────────────────────────
          //  ATOMIC BEAT 3 — THE MEMORY TRICK.
          //  "How do I remember this?" — the beginner's real question.
          // ─────────────────────────────────────────
          { text: `Here\u2019s the trick to never forget this. In regular decimal, when\u2019s the first time a single digit can\u2019t hold your answer? 9 plus 1. You get 10. The column rolls over. You carry a 1 to the left. In binary, exactly the same thing happens — you just run out of room a lot sooner. 1 plus 1 — roll over — carry a 1 to the left. The written answer looks identical. 9+1=10. 1+1=10. Same rule. Same shape. Different base. If you can remember the decimal version, you already know the binary one.`,
            dur: 26000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Memory Trick — It\u2019s The Same Rule', C().edgeRise);
              _drawMemoryTrickSideBySide(b);
              b.setLabel('Same shape. Same rule. Different base. Binary just rolls over sooner.', C().edgeRise);
            } },

          // ─────────────────────────────────────────
          //  ATOMIC BEAT 4 — THIS IS THE SECRET.
          //  Name the thing clearly: one adder, one trick, repeated.
          // ─────────────────────────────────────────
          { text: `Now here\u2019s the whole secret of the adder. Every adder — 4-bit, 64-bit, the one inside a space probe, the one inside your phone — does nothing more than this one trick, over and over. Take two bits in. If they overflow, spill the extra to the left. That\u2019s it. Now watch what happens when we line four of them up and let that spill travel.`,
            dur: 18000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One Trick. Repeated. That\u2019s The Whole Thing.', C().edgeRise);
              _drawSingleAdderAtom(b, { A: 1, Bv: 1, showBigEquation: false, small: true });
              // Hint at the chain below
              b.drawCustom('chain-hint', (g, NS, COL) => {
                const line = document.createElementNS(NS, 'text');
                line.setAttribute('x', 500); line.setAttribute('y', 490);
                line.setAttribute('text-anchor', 'middle');
                line.setAttribute('font-family', 'monospace');
                line.setAttribute('font-size', '16');
                line.setAttribute('fill', COL.accent);
                line.textContent = '↓  now put four of these in a row  ↓';
                g.appendChild(line);
              });
              b.setLabel('The scale doesn\u2019t matter. Chain more adders, add bigger numbers, same atomic trick.', C().accent);
            } },

          // ─────────────────────────────────────────
          //  BEAT 5 — SETUP THE 4-BIT EXAMPLE (shortened; the atom is done)
          // ─────────────────────────────────────────
          { text: `Four adders, side by side. We\u2019ll add eleven plus six. You already know the answer is seventeen — that\u2019s the easy part. The real question is: how do four of our little one-trick adders work together to get there? Let\u2019s walk every single one of them, one at a time.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Four Adders. One Carry. Eleven Plus Six.', C().accent);
              _drawRippleWalkthrough(b, {
                aBits: [1, 0, 1, 1],
                bBits: [0, 1, 1, 0],
                Cin: 0,
                step: 0,
                active: -1,
              });
              b.setLabel('Nothing computed yet. Four one-trick adders, two numbers loaded, waiting.', C().label);
            } },

          // ─────────────────────────────────────────
          //  BEAT 1 — BIT 0.  Invite prediction. Short sentences. A promise
          //  that the next column won't be this easy.
          // ─────────────────────────────────────────
          { text: `Rightmost column first — the ones place in binary. A is one. B is zero. Nothing to our right, so no carry coming in. Predict before I tell you: one plus zero plus zero — what\u2019s the sum? ... Right. One. No overflow. No carry leaves. This one was the warm-up. Don\u2019t get used to it.`,
            dur: 18000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Bit 0 — The Rightmost Column', C().accent);
              const layout = _drawRippleWalkthrough(b, {
                aBits: [1, 0, 1, 1],
                bBits: [0, 1, 1, 0],
                Cin: 0,
                step: 1,
                active: 0,
                inputsRevealed: 'ABC',
                showSum: true,
              });
              // Small, dim pulse showing the carry-out of 0 travelling to bit 1.
              _animateCarryPulse(b, 'pulse0-1', layout.carryPath(0), {
                color: C().wireLo,
                radius: 7,
                startMs: 12000,
                travelMs: 2200,
                label: 'carry = 0',
              });
              b.setLabel('1 + 0 + 0 = 1.  Sum goes below. Carry-out is zero (the dim pulse). Easy one.', C().edgeRise);
            } },

          // ─────────────────────────────────────────
          //  BEAT 2 — BIT 1.  Question mid-beat to create tension. Introduce
          //  the "binary has no 2" insight. Pause before the visual pulse.
          // ─────────────────────────────────────────
          { text: `Bit one. Now it gets interesting. A is one. B is also one. So — quick: what\u2019s one plus one in binary? ... It\u2019s not two. Binary doesn\u2019t have a two. The answer is one-zero. Two bits of answer — for one bit of column. Something has to give. The column keeps the zero. The leftover one — the carry — has to go somewhere else. Watch where it goes.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Bit 1 — The First Carry Is Born', C().edgeRise);
              const layout = _drawRippleWalkthrough(b, {
                aBits: [1, 0, 1, 1],
                bBits: [0, 1, 1, 0],
                Cin: 0,
                step: 2,
                active: 1,
                inputsRevealed: 'ABC',
                showSum: true,
              });
              // Bright, prominent carry pulse travelling from bit 1 Cout → bit 2 Cin.
              _animateCarryPulse(b, 'pulse1-2', layout.carryPath(1), {
                color: C().edgeRise,
                radius: 11,
                startMs: 16000,
                travelMs: 3500,
                label: 'carry = 1',
              });
              b.setLabel('1 + 1 = 2 → binary one-zero. Sum = 0, and a real carry travels left. This IS the ripple.', C().edgeRise);
            } },

          // ─────────────────────────────────────────
          //  BEAT 3 — BIT 2.  Remind the learner of continuity (the carry
          //  they just saw); name "ripple" now that they've felt it.
          // ─────────────────────────────────────────
          { text: `Bit two. Remember that glowing pulse you just watched arrive? It\u2019s sitting on this column\u2019s carry-in wire, waiting. A is zero. B is one. Plus the carry of one. Zero plus one plus one — two again. So — zero again. And the carry keeps going. Left. Always left. This is the \u201cripple\u201d in ripple-carry adder. One column kicks off the next. And the next.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Bit 2 — The Carry Keeps Moving', C().edgeRise);
              const layout = _drawRippleWalkthrough(b, {
                aBits: [1, 0, 1, 1],
                bBits: [0, 1, 1, 0],
                Cin: 0,
                step: 3,
                active: 2,
                inputsRevealed: 'ABC',
                showSum: true,
              });
              _animateCarryPulse(b, 'pulse2-3', layout.carryPath(2), {
                color: C().edgeRise,
                radius: 11,
                startMs: 14000,
                travelMs: 3200,
                label: 'carry = 1',
              });
              b.setLabel('0 + 1 + 1 = 2. Sum stays 0. Another carry rides out. This is why it\u2019s called \u201cripple.\u201d', C().edgeRise);
            } },

          // ─────────────────────────────────────────
          //  BEAT 4 — BIT 3.  Real-world hook: the odometer tick from
          //  999 → 1000. Same physics, different base.
          // ─────────────────────────────────────────
          { text: `Last column. A is one. B is zero. Carry coming in is one. You already know what happens — one plus one is two, sum is zero, carry is one. But wait. There\u2019s no more column to send the carry to. So it rolls right out the top of the adder. That pin has a name — carry-out. If you\u2019ve ever watched a car\u2019s odometer tick from 999 to 1,000 and felt that extra digit appear — that\u2019s exactly this, in base 10. We just watched silicon do the same thing in base 2.`,
            dur: 24000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Bit 3 — The Carry Rolls Off The Top', C().edgeRise);
              const layout = _drawRippleWalkthrough(b, {
                aBits: [1, 0, 1, 1],
                bBits: [0, 1, 1, 0],
                Cin: 0,
                step: 4,
                active: 3,
                inputsRevealed: 'ABC',
                showSum: true,
              });
              _animateCarryPulse(b, 'pulse3-out', layout.coutPath(), {
                color: C().edgeRise,
                radius: 11,
                startMs: 14000,
                travelMs: 3200,
                label: 'carry = 1',
              });
              b.setLabel('Final column. Final carry. It exits the adder entirely — that\u2019s the \u201ccarry-out\u201d pin.', C().edgeRise);
            } },

          // ─────────────────────────────────────────
          //  BEAT 5 — REVEAL.  Verify the answer. End with concrete real-
          //  world applications so the learner leaves with "that's THIS?"
          // ─────────────────────────────────────────
          { text: `Now read the answer. Sum bits, left to right: zero, zero, zero, one. The carry that flew off the top: one. Put them together — one, zero, zero, zero, one. Convert: sixteen plus one — seventeen. And eleven plus six is? Seventeen. The chip just did it. Not by magic. Four tiny adders, one carry at a time, rippling left. Every calculator button you\u2019ve pressed. Every \u201c i equals i plus one\u201d in every loop of every program ever written. Every address your phone computes to find a byte in memory. This is what happens. Right here. In about a nanosecond.`,
            dur: 26000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Result — 10001 = 17  ✓', C().edgeRise);
              _drawRippleWalkthrough(b, {
                aBits: [1, 0, 1, 1],
                bBits: [0, 1, 1, 0],
                Cin: 0,
                step: 4,
                active: -1,
                showSum: true,
              });
              b.drawCustom('reveal', (g, NS, COL) => {
                const line = document.createElementNS(NS, 'text');
                line.setAttribute('x', 500); line.setAttribute('y', 540);
                line.setAttribute('text-anchor', 'middle');
                line.setAttribute('font-family', 'monospace');
                line.setAttribute('font-size', '20');
                line.setAttribute('font-weight', '700');
                line.setAttribute('fill', COL.edgeRise);
                line.textContent = '1 0 1 1   +   0 1 1 0   =   1 0 0 0 1';
                g.appendChild(line);
                const dec = document.createElementNS(NS, 'text');
                dec.setAttribute('x', 500); dec.setAttribute('y', 570);
                dec.setAttribute('text-anchor', 'middle');
                dec.setAttribute('font-family', 'monospace');
                dec.setAttribute('font-size', '16');
                dec.setAttribute('fill', COL.accent);
                dec.textContent = '11   +   6   =   17';
                g.appendChild(dec);
              });
              b.setLabel('Every column, every carry, every bit — accounted for. That is the whole ripple-carry adder.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 5 — THE SPEED PROBLEM
    // ════════════════════════════════════════════════════
    {
      id: 5,
      title: 'The Ripple Carry\u2019s Fatal Flaw',
      pages: [
        { sentences: [
          { text: `Ripple carry is elegant and simple. But it has a problem. Each full adder has to wait for its carry-in before it can compute its own carry-out. That means the carry has to march, one stage at a time, from the least-significant bit all the way up to the most-significant bit.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Carry Has To Travel', C().wireHot);
              _drawRippleAdder(b, [1, 1, 1, 1], [0, 0, 0, 1], 0);
              b.drawNode('note', 500, 430, 'stage 1 waits for stage 0. Stage 2 waits for stage 1. And so on.', C().wireHot);
              b.setLabel('The whole addition can\u2019t finish until the carry has walked the full length of the adder.', C().wireHot);
            } },

          { text: `For a 4-bit adder, not a big deal — the carry walks through four stages. For a 64-bit adder, the carry has to travel through sixty-four stages, each one adding maybe fifty picoseconds of delay. That\u2019s over three nanoseconds just for addition. At 3 gigahertz, one clock cycle is only a third of a nanosecond. Way too slow.`,
            dur: 17000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Math — 64-Bit Ripple Is Too Slow', C().wireHot);
              b.drawCustom('math', (g, NS, COL) => {
                const lines = [
                  ['per stage:',            '~50 ps gate delay'],
                  ['4-bit adder:',          '4 × 50 ps = 200 ps    (ok)'],
                  ['16-bit adder:',         '16 × 50 ps = 800 ps   (hmm)'],
                  ['64-bit adder:',         '64 × 50 ps = 3,200 ps  (no way)'],
                  ['one 3 GHz clock cycle:','~333 ps'],
                ];
                lines.forEach((r, i) => {
                  const y = 230 + i * 45;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 350); a.setAttribute('y', y);
                  a.setAttribute('text-anchor', 'end');
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '16');
                  a.setAttribute('fill', COL.label);
                  a.textContent = r[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 370); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '16');
                  b_.setAttribute('font-weight', '700');
                  b_.setAttribute('fill', i === 3 ? COL.wireHot : (i === 4 ? COL.edgeRise : COL.accent));
                  b_.textContent = r[1]; g.appendChild(b_);
                });
              });
              b.setLabel('Ripple carry scales linearly with N. Clock cycles don\u2019t scale at all. Problem.', C().wireHot);
            } },

          { text: `So we need to figure out carries faster. Ideally, not one stage at a time — but all of them simultaneously, in parallel. That\u2019s exactly what the next idea does.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('We Need To Compute All Carries In Parallel', C().accent);
              b.drawNode('arrow', 500, 320, 'the fix is called carry lookahead', C().edgeRise);
              b.setLabel('Instead of waiting, predict. That\u2019s the whole trick.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 — CARRY LOOKAHEAD
    // ════════════════════════════════════════════════════
    {
      id: 6,
      title: 'Carry Lookahead',
      pages: [
        { sentences: [
          { text: `The insight: we don\u2019t actually have to wait for each stage\u2019s carry. Look at any one column\u2019s inputs. If both bits are 1, the column will definitely produce a carry — regardless of what Cin is. If exactly one bit is 1, the column will produce a carry only if Cin is 1. If both bits are 0, no carry, ever.`,
            dur: 16500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Each Column Has A Known Personality', C().accent);
              b.drawCustom('roles', (g, NS, COL) => {
                const rows = [
                  ['A=1, B=1:',  'generates a carry  (no matter what Cin is)',        COL.edgeRise],
                  ['A=1, B=0 or A=0, B=1:',  'propagates carry  (only if Cin = 1)',   COL.accent],
                  ['A=0, B=0:',  'kills carry       (no carry, ever)',                COL.wireLo],
                ];
                rows.forEach((r, i) => {
                  const y = 240 + i * 65;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 140); a.setAttribute('y', y);
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '15');
                  a.setAttribute('font-weight', '700');
                  a.setAttribute('fill', r[2]);
                  a.textContent = r[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 460); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '15');
                  b_.setAttribute('fill', COL.label);
                  b_.textContent = r[1]; g.appendChild(b_);
                });
              });
              b.setLabel('Each column is "generate," "propagate," or "kill." A fixed label we can compute upfront.', C().accent);
            } },

          { text: `Define two signals for each bit position. G — "generate" — is A AND B. That\u2019s 1 when this column generates a carry on its own. P — "propagate" — is A XOR B. That\u2019s 1 when this column will pass along whatever carry it receives.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Define G and P For Every Bit', C().edgeRise);
              b.drawCustom('defs', (g, NS, COL) => {
                const lines = [
                  'G_i  =  A_i  AND  B_i',
                  'P_i  =  A_i  XOR  B_i',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 260); t.setAttribute('y', 260 + i * 60);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '22');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', COL.edgeRise);
                  t.textContent = l; g.appendChild(t);
                });
                const note = document.createElementNS(NS, 'text');
                note.setAttribute('x', 260); note.setAttribute('y', 430);
                note.setAttribute('font-family', 'monospace');
                note.setAttribute('font-size', '14');
                note.setAttribute('fill', COL.accent);
                note.textContent = 'computed from inputs alone — no carry waiting needed'; g.appendChild(note);
              });
              b.setLabel('Every bit computes its G and P instantly, in parallel with every other bit.', C().edgeRise);
            } },

          { text: `Now the carry into bit i+1 is just: G of bit i, OR, P of bit i AND the carry into bit i. But we can expand that recurrence. Carry 1 is G0 OR P0 AND C0. Carry 2 is G1 OR P1 AND carry 1 — which expands to G1 OR P1·G0 OR P1·P0·C0. And so on. Each carry becomes a wide OR of ANDs of G\u2019s and P\u2019s and the original Cin.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Expand The Recurrence', C().accent);
              b.drawCustom('eqs', (g, NS, COL) => {
                const lines = [
                  'C1 = G0 + P0·C0',
                  'C2 = G1 + P1·G0 + P1·P0·C0',
                  'C3 = G2 + P2·G1 + P2·P1·G0 + P2·P1·P0·C0',
                  'C4 = G3 + P3·G2 + P3·P2·G1 + P3·P2·P1·G0 + P3·P2·P1·P0·C0',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 120); t.setAttribute('y', 240 + i * 50);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '17');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('All carries depend only on G, P, and C0 — which are all available immediately.', C().accent);
            } },

          { text: `All those G and P values are computable in parallel from the inputs. That means every carry is computable in parallel too — no waiting for any other stage. The delay is no longer proportional to the number of bits. It\u2019s just the depth of the AND-OR tree: two gates, essentially constant. For a 64-bit adder, hierarchical lookahead pushes the delay down to order log N.`,
            dur: 19000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('All Carries At Once', C().edgeRise);
              b.drawCustom('compare', (g, NS, COL) => {
                const rows = [
                  ['ripple carry:',     'O(N) — linear delay'],
                  ['carry lookahead:',  'O(log N) — logarithmic delay'],
                  ['',                  ''],
                  ['64-bit ripple:',    '~3,200 ps'],
                  ['64-bit lookahead:', '~300 ps'],
                ];
                rows.forEach((r, i) => {
                  const y = 230 + i * 45;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 430); a.setAttribute('y', y);
                  a.setAttribute('text-anchor', 'end');
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '16');
                  a.setAttribute('fill', COL.label);
                  a.textContent = r[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 450); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '16');
                  b_.setAttribute('font-weight', '700');
                  b_.setAttribute('fill', i === 4 ? COL.edgeRise : (i === 3 ? COL.wireHot : COL.accent));
                  b_.textContent = r[1]; g.appendChild(b_);
                });
              });
              b.setLabel('Ten times faster. Every modern CPU uses some form of lookahead adder.', C().edgeRise);
            } },

          { text: `That\u2019s the engineering trick. Trade silicon — you need lots of AND and OR gates for the lookahead logic — for speed. Modern CPUs use hierarchical lookahead: small lookahead groups combined with lookahead-between-groups. The result is a 64-bit adder that finishes in well under a nanosecond.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Silicon For Speed', C().accent);
              b.drawNode('n1', 500, 280, 'more gates → more transistors → more die area', C().accent);
              b.drawNode('n2', 500, 320, 'but carries computed in parallel → fewer picoseconds', C().accent);
              b.drawNode('n3', 500, 400, 'the trade-off CPUs have gladly made for 40+ years', C().edgeRise);
              b.setLabel('Time is scarce on modern silicon. Area is cheap. Lookahead spends area to save time.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 7 — SUBTRACTION FROM ADDITION
    // ════════════════════════════════════════════════════
    {
      id: 7,
      title: 'Subtraction From Addition',
      pages: [
        { sentences: [
          { text: `Now a gift from two\u2019s complement arithmetic. Subtracting B from A is the same as adding the negative of B. And in two\u2019s complement, negating a number means: flip every bit, then add 1. That\u2019s the entire formula. Minus B equals NOT-B plus 1.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Two\u2019s Complement — Negate = Invert + 1', C().accent);
              b.drawCustom('demo', (g, NS, COL) => {
                const lines = [
                  ' 0 0 0 0 0 1 0 1      =  +5',
                  '',
                  'invert all bits:',
                  ' 1 1 1 1 1 0 1 0      =  –6   (not yet)',
                  '',
                  'add 1:',
                  ' 1 1 1 1 1 0 1 1      =  –5   ✓',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 240); t.setAttribute('y', 200 + i * 38);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '16');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', i === 6 ? COL.edgeRise : COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('The standard representation of negative numbers in every modern CPU.', C().accent);
            } },

          { text: `So if we already have an adder and we want A minus B, we only need two extra things: a NOT gate on every bit of B, and to set the carry-in to 1. The adder then computes A plus NOT-B plus 1, which equals A plus minus B, which equals A minus B.`,
            dur: 15500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Reuse The Adder — Invert B, Set Cin = 1', C().edgeRise);
              b.drawBox('adder', 380, 240, 240, 160, 'ADDER', C().edgeRise);
              b.drawNode('a-l',   300, 280, 'A →',   C().wireHi);
              b.drawWire('wa',   [[330, 280],[380, 280]], C().wireHi);
              b.drawGate('inv', 'NOT', 240, 320, 80, 50);
              b.drawWire('wb-inv', [[180, 345],[240, 345]], C().wireHi);
              b.drawNode('b-l',    170, 345, 'B →', C().wireHi);
              b.drawWire('winv-ad', [[322, 345],[380, 345]], C().wireHi);
              b.drawWire('cin',  [[500, 460],[500, 400]], C().edgeRise);
              b.drawNode('cin-l', 520, 480, 'Cin = 1', C().edgeRise);
              b.drawWire('out', [[620, 320],[760, 320]], C().edgeRise);
              b.drawNode('out-l', 780, 320, 'A − B', C().edgeRise);
              b.setLabel('No separate subtractor needed. Same adder, plus N inverters.', C().edgeRise);
            } },

          { text: `Put a MUX in front of the inverters. A mode-select line picks "pass B through" for addition, or "invert B and set Cin to 1" for subtraction. Now the same hardware does both, and the instruction set just toggles one control bit. That\u2019s how every ALU handles ADD and SUB with shared silicon.`,
            dur: 15500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Add Or Subtract — One Control Bit', C().accent);
              b.drawBox('adder', 480, 240, 220, 160, 'ADDER', C().edgeRise);
              b.drawNode('a',    300, 280, 'A →', C().wireHi);
              b.drawNode('b',    300, 360, 'B →', C().wireHi);
              b.drawWire('wa',  [[340, 280],[480, 280]], C().wireHi);
              b.drawGate('xor', 'XOR', 360, 340, 80, 50);
              b.drawWire('wb-xor', [[340, 360],[360, 360]], C().wireHi);
              b.drawWire('wmode', [[400, 460],[400, 390]], C().edgeRise);
              b.drawNode('mode', 440, 480, 'SUB = 1  (0 = add, 1 = sub)', C().edgeRise);
              b.drawWire('wxor-ad', [[442, 360],[480, 360]], C().wireHi);
              b.drawWire('wcin', [[600, 460],[600, 400]], C().edgeRise);
              b.drawNode('cin-l', 620, 480, 'Cin = SUB', C().edgeRise);
              b.drawWire('out', [[700, 320],[840, 320]], C().edgeRise);
              b.drawNode('out-l', 850, 320, 'A ± B', C().edgeRise);
              b.setLabel('XOR gates double as conditional inverters. SUB bit controls everything in one step.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 8 — OVERFLOW DETECTION
    // ════════════════════════════════════════════════════
    {
      id: 8,
      title: 'Overflow — When The Answer Doesn\u2019t Fit',
      pages: [
        { sentences: [
          { text: `One more wrinkle. An N-bit adder can only hold N-bit results. Add two numbers whose true sum needs more than N bits, and the answer "overflows" — the result stored in the register is wrong.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Answer Doesn\u2019t Fit', C().wireHot);
              b.drawCustom('ex', (g, NS, COL) => {
                const lines = [
                  '  1 1 1 1 1 1 1 1    =  255',
                  '+ 0 0 0 0 0 0 0 1    =    1',
                  '─────────────────',
                  '1 0 0 0 0 0 0 0 0    =  256  (9 bits!)',
                  '',
                  'stored in 8 bits:      0 0 0 0 0 0 0 0    =  0   ✗',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 200); t.setAttribute('y', 200 + i * 40);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '17');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', i < 4 ? COL.accent : (i === 5 ? COL.wireHot : COL.label));
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Ninth bit falls off. What\u2019s left in the register is meaningless — unless you catch the overflow.', C().wireHot);
            } },

          { text: `For unsigned arithmetic, the overflow is trivial to detect. It\u2019s exactly the final carry-out of the adder. If the carry rolls off the top of the MSB, the sum was too big — and the CPU sets the Carry flag, C.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Unsigned Overflow = Carry Out', C().edgeRise);
              b.drawBox('adder', 300, 240, 400, 140, 'N-BIT ADDER', C().edgeRise);
              b.drawWire('cout', [[300, 310],[200, 310]], C().wireHot);
              b.drawNode('cout-l', 100, 310, 'Cout → C flag', C().wireHot);
              b.drawNode('rule', 500, 450, 'C = 1  ⇔  unsigned result doesn\u2019t fit', C().edgeRise);
              b.setLabel('The adder already produces this signal. Just latch it into the flags register.', C().edgeRise);
            } },

          { text: `Signed overflow is trickier. Two\u2019s-complement numbers use the top bit for sign. If you add two positive numbers and the MSB of the result comes out 1 — meaning the answer "went negative" — that\u2019s overflow. Same if two negatives sum to a positive. The signed overflow flag, V, watches for exactly that case.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Signed Overflow = Sign Of Result Is Wrong', C().edgeRise);
              b.drawCustom('ex', (g, NS, COL) => {
                const lines = [
                  '  0 1 1 1 1 1 1 1    =   +127',
                  '+ 0 0 0 0 0 0 0 1    =     +1',
                  '─────────────────',
                  '  1 0 0 0 0 0 0 0    =   −128   (signed!)',
                  '',
                  'positive + positive → negative   →   V = 1',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 220); t.setAttribute('y', 200 + i * 42);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '17');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', i < 3 ? COL.accent : (i === 5 ? COL.wireHot : COL.label));
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('+127 + 1 is supposed to be +128 — but that\u2019s outside signed range. Sign bit flips.', C().accent);
            } },

          { text: `The signed overflow flag V is computed as: carry-in to the MSB XOR carry-out of the MSB. When those two carries disagree, the sign of the result came out wrong. Two inputs with the same sign can only produce a wrong-signed result if overflow actually happened.`,
            dur: 15500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Formula — V = Cin(MSB) XOR Cout(MSB)', C().edgeRise);
              b.drawBox('adder', 320, 240, 360, 160, 'MSB adder stage', C().edgeRise);
              b.drawNode('cin',   260, 320, 'Cin(MSB)', C().accent);
              b.drawNode('cout',  680, 320, 'Cout(MSB)', C().accent);
              b.drawGate('xor', 'XOR', 500, 450, 100, 60);
              b.drawWire('w1', [[320, 320],[410, 320],[410, 460],[500, 460]], C().wireHi);
              b.drawWire('w2', [[680, 320],[690, 320],[690, 480],[500, 480]], C().wireHi);
              b.drawWire('v', [[600, 480],[780, 480]], C().edgeRise);
              b.drawNode('v-l', 790, 480, 'V flag', C().edgeRise);
              b.setLabel('Two carries out of the top bit. If they differ, overflow. One XOR, done.', C().edgeRise);
            } },

          { text: `Two overflow flags for two arithmetic worlds. C for unsigned. V for signed. Both computed directly from the adder\u2019s carry network, adding no new hardware of significance. Every CPU you\u2019ve ever used has this pair.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Two Flags, Two Worlds', C().accent);
              b.drawBox('c', 180, 280, 280, 100, 'C flag (carry)',    C().accent);
              b.drawNode('c-l', 320, 330, 'unsigned overflow', C().edgeRise);
              b.drawBox('v', 540, 280, 280, 100, 'V flag (overflow)', C().accent);
              b.drawNode('v-l', 680, 330, 'signed overflow',   C().edgeRise);
              b.setLabel('Two tiny circuits. Two massive safety nets for code that could silently go wrong.', C().accent);
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
      title: 'Recap — The Adder',
      pages: [
        { sentences: [
          { text: `Trace the build. Start with a half adder: one XOR for the sum, one AND for the carry. Two gates, two inputs, two outputs.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 1 — Half Adder', C().accent);
              _drawHalfAdder(b, 1, 1);
              b.setLabel('The smallest building block. 1-bit + 1-bit.', C().accent);
            } },

          { text: `Chain two half adders with an OR gate to get a full adder — three inputs including the carry-in, two outputs, handles any column in a multi-bit addition.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 2 — Full Adder', C().accent);
              _drawFullAdder(b, 1, 1, 1);
              b.setLabel('Six gates. One column. The stackable unit.', C().accent);
            } },

          { text: `Chain N full adders and you have a ripple-carry adder. Simple, correct — but the carry has to crawl from bit 0 up to bit N-1, one stage at a time. Linear delay.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 3 — Ripple Carry', C().accent);
              _drawRippleAdder(b, [1, 0, 1, 1], [0, 1, 1, 0], 0);
              b.setLabel('Works. But too slow for modern clocks at 64 bits.', C().accent);
            } },

          { text: `Fix the speed with carry lookahead. Compute "generate" and "propagate" signals for every column in parallel, then algebraically derive every carry in a single wide combinational tree. Logarithmic delay. Every modern CPU uses some form of lookahead.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 4 — Carry Lookahead', C().edgeRise);
              b.drawCustom('eqs', (g, NS, COL) => {
                const lines = [
                  'G_i = A_i · B_i       (generate)',
                  'P_i = A_i ⊕ B_i      (propagate)',
                  '',
                  'C_i+1 = G_i + P_i · C_i',
                  '→ expand, unroll → all carries in parallel',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 220); t.setAttribute('y', 240 + i * 40);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '16');
                  t.setAttribute('fill', i === 4 ? COL.edgeRise : COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Trade silicon for time. Very much worth it.', C().edgeRise);
            } },

          { text: `Invert B, set the carry-in to 1, and the same adder computes A minus B. One control bit flips between addition and subtraction. Every CPU\u2019s ADD and SUB share the adder hardware.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 5 — Subtraction, Free', C().accent);
              b.drawBox('a', 380, 260, 240, 160, 'ADDER', C().edgeRise);
              b.drawNode('t', 500, 450, 'SUB bit toggles invert-B + Cin', C().accent);
              b.setLabel('Same hardware. Two operations.', C().accent);
            } },

          { text: `Finally, the overflow flags. C catches unsigned overflow — the final carry out of the MSB. V catches signed overflow — XOR of the MSB\u2019s carry-in and carry-out. Both come free from the adder\u2019s existing carry network.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 6 — Overflow Flags', C().accent);
              b.drawBox('c', 180, 280, 260, 100, 'C — unsigned overflow', C().accent);
              b.drawBox('v', 560, 280, 260, 100, 'V — signed overflow',    C().accent);
              b.setLabel('Adder\u2019s output tells you if the answer is valid. Every ALU does this.', C().accent);
            } },

          { text: `That\u2019s the adder. The beating heart of the ALU. The circuit that every plus sign, every memory offset, every program counter increment ultimately reaches. Built from nothing but XORs and ANDs and ORs.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Adder — Arithmetic From Gates', C().edgeRise);
              _drawRippleAdder(b, [1, 1, 0, 1], [0, 1, 1, 1], 0);
              b.setLabel('From XOR and AND to 64-bit arithmetic at gigahertz speed. All one family.', C().edgeRise);
            } },

          { text: `Next episode, we finally assemble the Arithmetic Logic Unit. Adder for + and −. Logic gates for AND and OR and XOR. Shifter for left and right shifts. Comparator outputs for equality and magnitude. All steered by a single MUX and an opcode. The ALU.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Next: The ALU', C().accent);
              b.drawBox('add', 120, 200, 140, 50, 'adder',     C().accent);
              b.drawBox('log', 120, 270, 140, 50, 'logic',     C().accent);
              b.drawBox('shf', 120, 340, 140, 50, 'shifter',   C().accent);
              b.drawBox('cmp', 120, 410, 140, 50, 'comparator',C().accent);
              b.drawMux('mux', 340, 200, 140, 260, { inputs: 4, label: 'MUX' });
              for (let i = 0; i < 4; i++) {
                const y = 225 + i * 70;
                b.drawWire('w' + i, [[260, y],[340, y]], C().wireHi);
              }
              b.drawWire('out', [[480, 330],[700, 330]], C().edgeRise);
              b.drawBox('flags', 700, 280, 140, 100, 'flags\n(C, V, Z, N)', C().edgeRise);
              b.setLabel('All the arithmetic circuits you\u2019ve built. Unified. Addressable by opcode. See you next episode.', C().accent);
            } },
        ] },
      ],
      showAll: true,
      isFinal: true,
    },
  ];

  if (typeof window !== 'undefined') {
    window.BLOCKS_08_SCENES = BLOCKS_08_SCENES;
  }
})();
