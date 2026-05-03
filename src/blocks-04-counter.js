/**
 * Series B — Episode 4: How a Counter Is Built
 * ----------------------------------------------
 * A counter is a register that increments itself every clock edge. We build
 * it three ways: the clean synchronous design (register + adder + feedback),
 * the older ripple design (chained T-flops — elegant, but too slow for real
 * CPUs), and the loadable version that lets us jump to any value. That last
 * one is literally the program counter inside every CPU.
 *
 * Arc:
 *   0. Hook                        every for-loop, every PC, every timer
 *   1. Register + feedback         wire Q back through a +1 block
 *   2. The +1 is an adder          black box for now (adder episode later)
 *   3. Overflow / wrap-around      mod-2^N counts for free
 *   4. Ripple counter              chained T-flops / frequency division
 *   5. Why synchronous wins        ripple delay vs shared edge
 *   6. Loadable counter            MUX + LOAD → jump to any value
 *   7. The Program Counter         this IS the PC in every CPU
 *   8. Recap
 */

(function () {
  'use strict';

  const B = () => window.Blocks;
  const C = () => window.Blocks && window.Blocks.COL;

  // ─────────────────────────────────────────
  //  Sampler factories
  // ─────────────────────────────────────────
  const square = (periodMs) => (t) => {
    if (t < 0) return 0;
    return (Math.floor(t / (periodMs / 2)) % 2) ? 1 : 0;
  };

  // ─────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────

  // Render an N-bit value into an array of bits, MSB first.
  function _bitsOf(v, n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push((v >> i) & 1);
    return out;
  }

  // Draw a row of register cells showing the current value and auto-animate
  // the bits counting up at `stepMs` per tick.
  //   opts.bits:   total bit width (default 4)
  //   opts.start:  initial value (default 0)
  //   opts.stepMs: milliseconds per increment (default 650)
  //   opts.x, opts.y, opts.cellW, opts.cellH, opts.gap
  function _drawCountingRegister(b, opts) {
    opts = opts || {};
    const n       = opts.bits   || 4;
    const start   = opts.start  || 0;
    const stepMs  = opts.stepMs || 650;
    const cellW   = opts.cellW  || 80;
    const cellH   = opts.cellH  || 110;
    const gap     = opts.gap    || 10;
    const x0      = opts.x      || ((1000 - (n * cellW + (n - 1) * gap)) / 2);
    const y0      = opts.y      || 260;
    const col     = C();

    const bitEls = [];
    const decEl  = { el: null };

    // Draw static boxes
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * (cellW + gap);
      b.drawBox('cnt-ff' + i, cx, y0, cellW, cellH, 'FF' + (n - 1 - i), col.edgeRise);
    }
    // Bit-value labels + decimal readout
    b.drawCustom('cnt-labels', (g, NS, COL) => {
      for (let i = 0; i < n; i++) {
        const cx = x0 + i * (cellW + gap) + cellW / 2;
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', cx); t.setAttribute('y', y0 + cellH + 22);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '18');
        t.setAttribute('font-weight', '700');
        t.setAttribute('fill', COL.edgeRise);
        t.textContent = '0';
        g.appendChild(t);
        bitEls.push(t);
      }
      // Decimal readout below
      const dec = document.createElementNS(NS, 'text');
      dec.setAttribute('x', x0 + (n * cellW + (n - 1) * gap) / 2);
      dec.setAttribute('y', y0 + cellH + 60);
      dec.setAttribute('text-anchor', 'middle');
      dec.setAttribute('font-family', 'monospace');
      dec.setAttribute('font-size', '22');
      dec.setAttribute('font-weight', '700');
      dec.setAttribute('fill', COL.accent);
      dec.textContent = '= ' + start;
      g.appendChild(dec);
      decEl.el = dec;
    });

    b.animate('cnt-labels', (tMs) => {
      if (!bitEls.length) return;
      const value = (start + Math.floor(tMs / stepMs)) % (1 << n);
      const bits = _bitsOf(value, n);
      bits.forEach((v, i) => {
        bitEls[i].textContent = String(v);
        bitEls[i].setAttribute('fill', v ? C().edgeRise : C().label);
      });
      if (decEl.el) decEl.el.textContent = '= ' + value;
    });
  }

  // Draw the synchronous counter schematic: register + +1 adder + feedback.
  function _drawSyncCounterSchematic(b, opts) {
    opts = opts || {};
    const col = C();
    // Register (right-ish)
    b.drawBox('reg', 520, 240, 280, 160, 'REGISTER', col.edgeRise);
    // +1 block (left of register)
    b.drawBox('plus', 180, 240, 180, 160, '+ 1', col.accent);
    // Connecting wires
    //   plus.output → reg.input (top arrow)
    b.drawWire('w-plus-reg', [[360, 320],[520, 320]], col.wireHi);
    //   reg.output → plus.input (feedback loop underneath)
    b.drawWire('w-fb',       [[800, 340],[880, 340],[880, 470],[100, 470],[100, 320],[180, 320]], col.wireHi);
    // Clock feeding register
    b.drawWire('w-clk', [[660, 480],[660, 400]], col.accent);
    b.drawNode('clk-l', 620, 500, 'CLK', col.accent);
    // Output tap (current value)
    b.drawWire('w-out', [[800, 360],[880, 360],[880, 200],[660, 200]], col.edgeRise);
    b.drawNode('out-l', 660, 185, 'current count →', col.edgeRise);
  }

  // Ripple counter — N T-flip-flops, each bit's Q driving the next bit's clock.
  // We visualise it with waveforms at each bit to highlight the frequency
  // division and the staggered transitions.
  function _drawRippleCounter(b, n) {
    const col = C();
    const x0 = 80, y0 = 170, cellW = 110, gap = 14, cellH = 80;
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * (cellW + gap);
      b.drawBox('t-ff' + i, cx, y0, cellW, cellH, 'T-FF' + i, col.accent);
    }
    // Master clock stub into bit 0
    b.drawWire('w-clk', [[20, y0 + cellH / 2],[x0, y0 + cellH / 2]], col.accent);
    b.drawNode('clk-l', 8, y0 + cellH / 2 - 8, 'CLK', col.accent);
    // Q of bit i → CLK of bit i+1
    for (let i = 0; i < n - 1; i++) {
      const cx = x0 + i * (cellW + gap);
      const nx = x0 + (i + 1) * (cellW + gap);
      b.drawWire('w-chain' + i, [[cx + cellW, y0 + cellH / 2],[nx, y0 + cellH / 2]], col.wireHi);
    }
    // Waveforms below — each bit at half the frequency of the previous.
    const wfY = y0 + cellH + 30;
    const baseP = 500;
    for (let i = 0; i < n; i++) {
      const cx = x0 + i * (cellW + gap);
      const period = baseP * Math.pow(2, i);
      b.drawWaveform('wf' + i, cx, wfY, cellW, 50, square(period),
        { running: true, step: 3, timePerCol: 20 });
      b.drawNode('wf-l' + i, cx + cellW / 2, wfY + 70,
        'bit ' + i + '  (÷' + Math.pow(2, i + 1) + ')', col.label);
    }
  }

  // ─────────────────────────────────────────
  //  SCENES
  // ─────────────────────────────────────────
  const BLOCKS_04_SCENES = [

    // ════════════════════════════════════════════════════
    // SCENE 0 — HOOK
    // ════════════════════════════════════════════════════
    {
      id: 0,
      title: 'Every Program Runs On A Counter',
      pages: [
        { sentences: [
          { text: `Every CPU has a very special register called the program counter. It holds one number — the address of the next instruction to execute. And on every clock cycle, it has to become one larger, so that next cycle the CPU fetches the next instruction in memory.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Program Counter', C().edgeRise);
              b.drawBox('pc', 360, 260, 280, 140, 'PROGRAM COUNTER', C().edgeRise);
              b.drawNode('val', 500, 340, '0x1004', C().edgeRise);
              b.drawWire('w-inc', [[640, 340],[800, 340],[800, 450],[360, 450],[360, 340]], C().wireHi);
              b.drawBox('inc', 440, 430, 120, 60, '+ 1', C().accent);
              b.drawNode('tick', 500, 530, 'increments every clock cycle', C().accent);
              b.setLabel('This tiny register is what makes a program actually run, instruction by instruction.', C().accent);
            } },

          { text: `That job — take a number, add one, store the result, repeat forever — is what a counter does. Every for-loop you have ever written. Every timer. Every cycle count. Somewhere underneath is a circuit that counts.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Counters Are Everywhere', C().accent);
              b.drawBox('fl', 80,  230, 200, 80, 'for-loops', C().accent);
              b.drawBox('ti', 300, 230, 200, 80, 'timers',    C().accent);
              b.drawBox('pc', 520, 230, 200, 80, 'program counter', C().accent);
              b.drawBox('us', 740, 230, 200, 80, 'μs clocks',  C().accent);
              b.drawBox('fr', 80,  340, 200, 80, 'frame counters', C().accent);
              b.drawBox('fi', 300, 340, 200, 80, 'FIFO pointers', C().accent);
              b.drawBox('cr', 520, 340, 200, 80, 'cycle counts',  C().accent);
              b.drawBox('an', 740, 340, 200, 80, 'and more…',     C().accent);
              b.setLabel('All of them are the same circuit underneath. Let us build it.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 1 — REGISTER + +1 FEEDBACK
    // ════════════════════════════════════════════════════
    {
      id: 1,
      title: 'A Register That Increments Itself',
      pages: [
        { sentences: [
          { text: `We already have a register — N flip-flops capturing their inputs on every clock edge. What if we wire the register's output back into its own input, through a simple "plus one" block?`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Idea — Feedback Through +1', C().accent);
              _drawSyncCounterSchematic(b);
              b.setLabel('One register. One +1 block. One feedback wire. Whole counter.', C().accent);
            } },

          { text: `Follow the logic. On every rising clock edge, the register captures whatever is on its input. Its input is its own output, plus one. So each edge, the stored value becomes one larger than it was the cycle before.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Each Edge → Value Becomes Value + 1', C().edgeRise);
              _drawSyncCounterSchematic(b);
              b.drawNode('math', 500, 550, 'next value  =  current value  +  1', C().edgeRise);
              b.setLabel('A register plus a feedback loop plus a +1 = a counter.', C().edgeRise);
            } },

          { text: `Watch it run. Clock ticks. Zero. One. Two. Three. Four. Each clock cycle, one larger.`,
            dur: 8000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Counting', C().edgeRise);
              _drawCountingRegister(b, { bits: 4, start: 0, stepMs: 700, y: 240 });
              b.drawWaveform('clk', 300, 440, 400, 50, square(1400),
                { running: true, step: 4, timePerCol: 30 });
              b.drawNode('clk-l', 270, 470, 'CLK', C().accent);
              b.setLabel('Four flip-flops holding a 4-bit number. Each rising edge, it increments.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 2 — THE +1 IS AN ADDER
    // ════════════════════════════════════════════════════
    {
      id: 2,
      title: 'The +1 Block Is An Adder',
      pages: [
        { sentences: [
          { text: `That "plus one" block — what is actually inside it? It's a circuit called an adder, wired with a constant 1 on one of its inputs. An adder takes two N-bit numbers and produces their N-bit sum. Give it the current count on one side and a hardcoded 1 on the other, and its output is always the current count plus one.`,
            dur: 17000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The +1 Block, Unwrapped', C().accent);
              b.drawBox('adder', 380, 240, 240, 160, 'ADDER', C().edgeRise);
              b.drawWire('a-in', [[160, 280],[380, 280]], C().wireHi);
              b.drawNode('a-l', 130, 280, 'A  (current count)', C().wireHi);
              b.drawWire('b-in', [[160, 360],[380, 360]], C().wireHi);
              b.drawNode('b-l', 130, 360, 'B = 0…001', C().edgeRise);
              b.drawWire('s-out', [[620, 320],[800, 320]], C().wireHi);
              b.drawNode('s-l', 810, 320, 'A + B', C().edgeRise);
              b.setLabel('Two inputs (numbers to add), one output (the sum). Hardwire B = 1. That is our +1 block.', C().accent);
            } },

          { text: `Building an adder out of logic gates is a whole topic in its own right. For now, treat it as a trusted black box. N bits in, N bits out. The output is the sum.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Trust It For Now — We Build It In A Later Episode', C().accent);
              b.drawBox('adder', 380, 260, 240, 140, 'ADDER', C().edgeRise);
              b.drawNode('promise', 500, 440, 'will be built from XORs and ANDs in the adder episode', C().label);
              b.setLabel('For this episode, a rectangle with "+1" inside is enough. The counter works regardless.', C().label);
            } },

          { text: `A few examples of the +1 operation in binary. Zero plus one is one. Zero-one-one-one plus one is one-zero-zero-zero. Six plus one is seven. Plain binary addition — the kind you would do on paper.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Binary +1 Examples', C().accent);
              b.drawCustom('examples', (g, NS, COL) => {
                const items = [
                  ['0 0 0 0',  '0 0 0 1',  '0 + 1 = 1'],
                  ['0 0 1 1',  '0 1 0 0',  '3 + 1 = 4'],
                  ['0 1 1 1',  '1 0 0 0',  '7 + 1 = 8'],
                  ['0 1 1 0',  '0 1 1 1',  '6 + 1 = 7'],
                ];
                items.forEach((row, i) => {
                  const y = 220 + i * 60;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 260); a.setAttribute('y', y);
                  a.setAttribute('text-anchor', 'end');
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '20');
                  a.setAttribute('font-weight', '700');
                  a.setAttribute('fill', COL.wireHi);
                  a.textContent = row[0]; g.appendChild(a);
                  const ar = document.createElementNS(NS, 'text');
                  ar.setAttribute('x', 340); ar.setAttribute('y', y);
                  ar.setAttribute('text-anchor', 'middle');
                  ar.setAttribute('font-family', 'monospace');
                  ar.setAttribute('font-size', '20');
                  ar.setAttribute('fill', COL.accent);
                  ar.textContent = '+1  →'; g.appendChild(ar);
                  const r = document.createElementNS(NS, 'text');
                  r.setAttribute('x', 500); r.setAttribute('y', y);
                  r.setAttribute('text-anchor', 'end');
                  r.setAttribute('font-family', 'monospace');
                  r.setAttribute('font-size', '20');
                  r.setAttribute('font-weight', '700');
                  r.setAttribute('fill', COL.edgeRise);
                  r.textContent = row[1]; g.appendChild(r);
                  const d = document.createElementNS(NS, 'text');
                  d.setAttribute('x', 600); d.setAttribute('y', y);
                  d.setAttribute('font-family', 'monospace');
                  d.setAttribute('font-size', '16');
                  d.setAttribute('fill', COL.label);
                  d.textContent = row[2]; g.appendChild(d);
                });
              });
              b.setLabel('Just binary arithmetic. The same algorithm as column addition in base 10.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 3 — OVERFLOW / WRAP-AROUND
    // ════════════════════════════════════════════════════
    {
      id: 3,
      title: 'What Happens At The Top? — Wrap-Around',
      pages: [
        { sentences: [
          { text: `A 4-bit counter holds values 0 through 15. That is all it can hold. So what happens when it reaches 1111 — the value 15 — and the clock ticks one more time?`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Last Value — 4 Bits Of 1', C().accent);
              _drawCountingRegister(b, { bits: 4, start: 15, stepMs: 1200, y: 240 });
              b.drawNode('qm', 500, 490, 'what comes after 15?', C().wireHot);
              b.setLabel('Next clock tick. What does the adder produce? Watch carefully.', C().label);
            } },

          { text: `The adder computes 1111 + 1 = 10000. That is five bits. But the register only has four flip-flops. The top bit is simply discarded — there is nowhere for it to go. What remains is 0000. The counter wraps back to zero.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Overflow — The Top Bit Falls Off', C().wireHot);
              b.drawCustom('overflow', (g, NS, COL) => {
                const t1 = document.createElementNS(NS, 'text');
                t1.setAttribute('x', 500); t1.setAttribute('y', 240);
                t1.setAttribute('text-anchor', 'middle');
                t1.setAttribute('font-family', 'monospace');
                t1.setAttribute('font-size', '32');
                t1.setAttribute('font-weight', '700');
                t1.setAttribute('fill', COL.wireHi);
                t1.textContent = '  1 1 1 1'; g.appendChild(t1);
                const p = document.createElementNS(NS, 'text');
                p.setAttribute('x', 500); p.setAttribute('y', 290);
                p.setAttribute('text-anchor', 'middle');
                p.setAttribute('font-family', 'monospace');
                p.setAttribute('font-size', '28');
                p.setAttribute('fill', COL.accent);
                p.textContent = '+   1'; g.appendChild(p);
                const line = document.createElementNS(NS, 'line');
                line.setAttribute('x1', 380); line.setAttribute('x2', 620);
                line.setAttribute('y1', 310); line.setAttribute('y2', 310);
                line.setAttribute('stroke', COL.gateEdge); line.setAttribute('stroke-width', '1.5');
                g.appendChild(line);
                const sum = document.createElementNS(NS, 'text');
                sum.setAttribute('x', 500); sum.setAttribute('y', 360);
                sum.setAttribute('text-anchor', 'middle');
                sum.setAttribute('font-family', 'monospace');
                sum.setAttribute('font-size', '32');
                sum.setAttribute('font-weight', '700');
                sum.setAttribute('fill', COL.edgeRise);
                sum.textContent = '1 0 0 0 0'; g.appendChild(sum);
                // Strikethrough on the leftmost bit
                const strike = document.createElementNS(NS, 'line');
                strike.setAttribute('x1', 378); strike.setAttribute('x2', 418);
                strike.setAttribute('y1', 375); strike.setAttribute('y2', 340);
                strike.setAttribute('stroke', COL.wireHot); strike.setAttribute('stroke-width', '3');
                g.appendChild(strike);
                const label = document.createElementNS(NS, 'text');
                label.setAttribute('x', 370); label.setAttribute('y', 400);
                label.setAttribute('text-anchor', 'end');
                label.setAttribute('font-family', 'monospace');
                label.setAttribute('font-size', '12');
                label.setAttribute('fill', COL.wireHot);
                label.textContent = '← discarded';
                g.appendChild(label);
                const kept = document.createElementNS(NS, 'text');
                kept.setAttribute('x', 500); kept.setAttribute('y', 450);
                kept.setAttribute('text-anchor', 'middle');
                kept.setAttribute('font-family', 'monospace');
                kept.setAttribute('font-size', '20');
                kept.setAttribute('fill', C().edgeRise);
                kept.textContent = 'kept: 0 0 0 0  =  0';
                g.appendChild(kept);
              });
              b.setLabel('4 bits can hold 10000 minus one bit → 0000. The counter restarts at zero.', C().wireHot);
            } },

          { text: `This is not a bug. It is useful, free arithmetic. An N-bit counter naturally counts modulo two-to-the-N, forever cycling through its possible values. No extra logic required.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Modular Arithmetic, For Free', C().accent);
              b.drawNode('m4', 500, 220, '4-bit  →  counts mod 16',            C().accent);
              b.drawNode('m8', 500, 260, '8-bit  →  counts mod 256',           C().accent);
              b.drawNode('m16',500, 300, '16-bit →  counts mod 65,536',        C().accent);
              b.drawNode('m32',500, 340, '32-bit →  counts mod 4,294,967,296', C().accent);
              b.drawNode('m64',500, 380, '64-bit →  counts mod 18,446,744,073,709,551,616', C().edgeRise);
              b.drawNode('note',500, 440, 'at 1 GHz a 64-bit counter takes ~585 years to wrap', C().edgeRise);
              b.setLabel('Why binary wraps so cleanly: every bit-width IS a modular number system by construction.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 4 — RIPPLE COUNTER
    // ════════════════════════════════════════════════════
    {
      id: 4,
      title: 'The Ripple Counter — An Older Trick',
      pages: [
        { sentences: [
          { text: `The counter we just built needs an adder — a multi-bit combinational circuit. Before fast adders were cheap, engineers had an even simpler design. It's called a ripple counter, and it needs no adder at all.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A Counter Without An Adder', C().accent);
              _drawRippleCounter(b, 4);
              b.setLabel('Four flip-flops, no adder, no feedback loop. Just a chain. Watch what it does.', C().accent);
            } },

          { text: `The trick: chain the flip-flops. Each bit's Q output drives the next bit's clock input. Each flip-flop is configured to toggle — to flip its output — on every rising edge it receives.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Chain The Clocks', C().accent);
              _drawRippleCounter(b, 4);
              b.drawNode('note', 500, 450, 'bit 0\u2019s Q  →  bit 1\u2019s CLK  →  bit 1\u2019s Q  →  bit 2\u2019s CLK  →  …', C().accent);
              b.setLabel('Each bit\u2019s output becomes the clock signal for the bit above it.', C().accent);
            } },

          { text: `Bit 0 sees the master clock, so it toggles on every tick — it flips at the master rate. Bit 1 only sees bit 0's transitions, so it toggles at half the rate. Bit 2 at a quarter. Bit 3 at an eighth. A cascade of frequency dividers.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Each Bit Divides The Rate By Two', C().edgeRise);
              _drawRippleCounter(b, 4);
              b.setLabel('Bit 0 = 1/2 the master frequency. Bit 1 = 1/4. Bit 2 = 1/8. Bit 3 = 1/16.', C().edgeRise);
            } },

          { text: `Watch the bit patterns over time. Bit 0 toggles each tick: 0, 1, 0, 1, 0, 1... Bit 1 toggles half as often: 0, 0, 1, 1, 0, 0, 1, 1... Bit 2 half again: 0, 0, 0, 0, 1, 1, 1, 1... Put them together in binary and you get 0, 1, 2, 3, 4, 5, 6, 7. It is a counter.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Stacked Waveforms = Binary Count', C().edgeRise);
              const col = C();
              const y0 = 200, rowH = 60;
              const labels = ['bit 0', 'bit 1', 'bit 2', 'bit 3'];
              labels.forEach((l, i) => {
                b.drawWaveform('wf' + i, 160, y0 + i * rowH, 700, 40, square(400 * Math.pow(2, i)),
                  { running: true, step: 3, timePerCol: 10 });
                b.drawNode('l' + i, 100, y0 + i * rowH + 25, l, col.accent);
              });
              b.setLabel('Four square waves at halving frequencies. Read them vertically in binary. That IS counting.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 5 — WHY SYNCHRONOUS WINS
    // ════════════════════════════════════════════════════
    {
      id: 5,
      title: 'Why Ripple Counters Don\u2019t Scale',
      pages: [
        { sentences: [
          { text: `Ripple counters are beautiful. So why don't modern CPUs use them? Because the bits don't all update at the same time.`,
            dur: 8000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Catch — Staggered Updates', C().wireHot);
              _drawRippleCounter(b, 4);
              b.setLabel('Each bit only flips AFTER the one below it flips. A cascade. Look at the delay.', C().wireHot);
            } },

          { text: `When bit 0 toggles, there is a small propagation delay — maybe one nanosecond — before bit 1 sees the change and toggles. That update cascades. Bit 1 toggles one delay after bit 0. Bit 2 one delay after bit 1. For a 32-bit ripple counter, the top bit lags the bottom bit by 32 delays.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Update Ripples Up', C().wireHot);
              // Draw a "time" axis showing stagger
              b.drawCustom('stagger', (g, NS, COL) => {
                const items = ['bit 0', 'bit 1', 'bit 2', 'bit 3'];
                items.forEach((l, i) => {
                  const y = 220 + i * 48;
                  const x = 250 + i * 60;
                  const axis = document.createElementNS(NS, 'line');
                  axis.setAttribute('x1', 160); axis.setAttribute('x2', 760);
                  axis.setAttribute('y1', y); axis.setAttribute('y2', y);
                  axis.setAttribute('stroke', COL.axis); axis.setAttribute('stroke-width', '1');
                  g.appendChild(axis);
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 150); t.setAttribute('y', y + 4);
                  t.setAttribute('text-anchor', 'end');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '12');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                  const tick = document.createElementNS(NS, 'circle');
                  tick.setAttribute('cx', x); tick.setAttribute('cy', y);
                  tick.setAttribute('r', 6);
                  tick.setAttribute('fill', COL.wireHot);
                  g.appendChild(tick);
                  const tl = document.createElementNS(NS, 'text');
                  tl.setAttribute('x', x + 10); tl.setAttribute('y', y - 10);
                  tl.setAttribute('font-family', 'monospace');
                  tl.setAttribute('font-size', '10');
                  tl.setAttribute('fill', COL.wireHot);
                  tl.textContent = 't = ' + i + ' × delay';
                  g.appendChild(tl);
                });
              });
              b.setLabel('Bit 1 catches up after 1 delay. Bit 2 after 2. Bit N after N. The count is wrong in between.', C().wireHot);
            } },

          { text: `At slow speeds, no problem — everything settles long before the next clock edge. But at modern CPU speeds — hundreds of MHz and up — the next edge arrives before the top bits have finished updating. Other parts of the circuit reading the counter see a wrong, partially-updated value. Ripple counters do not work for fast synchronous systems.`,
            dur: 16500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('At GHz Speeds, The Update Never Finishes', C().wireHot);
              b.drawNode('slow', 500, 220, 'low frequency  →  lots of time between edges  →  ripple counter fine', C().accent);
              b.drawNode('fast', 500, 280, 'high frequency →  next edge arrives first  →  ripple counter broken', C().wireHot);
              b.drawWaveform('clk-fast', 80, 380, 840, 60, square(100),
                { running: true, step: 2, timePerCol: 5 });
              b.drawNode('clk-l', 50, 410, 'CLK', C().accent);
              b.setLabel('Modern synchronous design demands all bits update together, on one clock edge.', C().wireHot);
            } },

          { text: `The synchronous counter we started with — register plus adder plus feedback — doesn't have this problem. All the flip-flops share one clock line. They all capture their new values at the exact same instant. The adder has the whole clock-low phase to compute the next count in time for the edge.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Synchronous — One Edge, All Bits', C().edgeRise);
              _drawSyncCounterSchematic(b);
              b.drawNode('w', 500, 550, 'every bit updates on the SAME clock edge', C().edgeRise);
              b.setLabel('Pay the cost of an adder. Get all-bits-simultaneous as the reward.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 — LOADABLE COUNTER
    // ════════════════════════════════════════════════════
    {
      id: 6,
      title: 'The Loadable Counter',
      pages: [
        { sentences: [
          { text: `Counting from zero forever is a good start, but a useful counter needs more. We want to start at a specific value, reset on command, or jump to a totally different number mid-count.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A Counter You Can Steer', C().accent);
              b.drawCustom('wishlist', (g, NS, COL) => {
                const items = [
                  '• reset to 0',
                  '• start from a specific value',
                  '• jump to a new value mid-count',
                  '• hold (don\u2019t count for a while)',
                ];
                items.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 260); t.setAttribute('y', 240 + i * 42);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '18');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Free-running is not enough. We need control.', C().accent);
            } },

          { text: `The fix is the same MUX trick we used for the register's load-enable. Put a 2-to-1 multiplexer in front of the register's input. One MUX input is the adder's output — the normal "count" path. The other MUX input is a new data bus — the "load" path. A LOAD control line is the select.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('MUX + LOAD = Programmable', C().accent);
              // Register
              b.drawBox('reg', 580, 240, 240, 160, 'REGISTER', C().edgeRise);
              // Adder (+1)
              b.drawBox('plus', 180, 160, 160, 100, '+ 1', C().accent);
              // MUX in front of register
              b.drawMux('mux', 400, 220, 120, 200, { inputs: 2, label: 'MUX 2:1' });
              // Adder output → MUX input 0 (count path)
              b.drawWire('w-plus-mux', [[340, 210],[360, 210],[360, 270],[400, 270]], C().wireHi);
              b.drawNode('count-l', 360, 195, 'count path', C().label);
              // External data bus → MUX input 1 (load path)
              b.drawWire('w-load-mux', [[120, 370],[360, 370],[360, 360],[400, 360]], C().edgeRise);
              b.drawNode('data-l', 80, 370, 'DATA', C().edgeRise);
              // MUX out → register D
              b.drawWire('w-mux-reg', [[520, 320],[580, 320]], C().wireHi);
              // LOAD → MUX select
              b.drawWire('w-load', [[460, 500],[460, 420]], C().edgeRise);
              b.drawNode('load-l', 420, 520, 'LOAD', C().edgeRise);
              // Register feedback to adder
              b.drawWire('w-fb', [[820, 340],[880, 340],[880, 100],[120, 100],[120, 200],[180, 200]], C().wireHi);
              // Clock
              b.drawWire('w-clk', [[700, 500],[700, 400]], C().accent);
              b.drawNode('clk-l', 670, 520, 'CLK', C().accent);
              b.setLabel('Same load-enable trick as the register. One MUX between "count" and "load".', C().accent);
            } },

          { text: `When LOAD is 0, the MUX passes the adder output through. The counter counts normally — current value plus one, every edge.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('LOAD = 0  →  Count Mode', C().accent);
              b.drawNode('x', 500, 320, '(draw the same schematic but highlight the count path)', C().label);
              b.drawBox('plus', 180, 160, 160, 100, '+ 1', C().accent);
              b.drawBox('reg', 580, 240, 240, 160, 'REGISTER', C().edgeRise);
              b.drawMux('mux', 400, 220, 120, 200, { inputs: 2, label: 'MUX' });
              b.drawWire('w-plus-mux', [[340, 210],[360, 210],[360, 270],[400, 270]], C().edgeRise);
              b.drawWire('w-load-mux', [[120, 370],[360, 370],[360, 360],[400, 360]], C().dim);
              b.drawWire('w-mux-reg', [[520, 320],[580, 320]], C().wireHi);
              b.drawWire('w-fb', [[820, 340],[880, 340],[880, 100],[120, 100],[120, 200],[180, 200]], C().wireHi);
              b.drawWire('w-load', [[460, 500],[460, 420]], C().wireLo);
              b.drawNode('load-l', 420, 520, 'LOAD = 0', C().wireLo);
              b.drawWire('w-clk', [[700, 500],[700, 400]], C().accent);
              b.setLabel('Adder-path is active. External DATA input is ignored.', C().accent);
            } },

          { text: `When LOAD is 1, the MUX selects the DATA input instead. On the next clock edge, the register captures whatever value was on DATA, ignoring the current count entirely. The counter jumps.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('LOAD = 1  →  Jump Mode', C().edgeRise);
              b.drawBox('plus', 180, 160, 160, 100, '+ 1', C().accent);
              b.drawBox('reg', 580, 240, 240, 160, 'REGISTER', C().edgeRise);
              b.drawMux('mux', 400, 220, 120, 200, { inputs: 2, label: 'MUX' });
              b.drawWire('w-plus-mux', [[340, 210],[360, 210],[360, 270],[400, 270]], C().dim);
              b.drawWire('w-load-mux', [[120, 370],[360, 370],[360, 360],[400, 360]], C().edgeRise);
              b.drawWire('w-mux-reg', [[520, 320],[580, 320]], C().edgeRise);
              b.drawWire('w-fb', [[820, 340],[880, 340],[880, 100],[120, 100],[120, 200],[180, 200]], C().dim);
              b.drawWire('w-load', [[460, 500],[460, 420]], C().edgeRise);
              b.drawNode('load-l', 420, 520, 'LOAD = 1', C().edgeRise);
              b.drawNode('data', 80, 370, 'DATA = 0x1F4', C().edgeRise);
              b.drawWire('w-clk', [[700, 500],[700, 400]], C().accent);
              b.setLabel('Data-path is active. The counter forgets where it was and jumps to the DATA value.', C().edgeRise);
            } },

          { text: `That is a programmable counter. It counts when you want it to count, and jumps when you tell it to jump.`,
            dur: 7000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Programmable Counter', C().edgeRise);
              b.drawWaveform('clk',  80, 200, 840, 50, square(400),
                { running: true, step: 4, timePerCol: 14 });
              b.drawNode('clk-l', 50, 230, 'CLK', C().accent);
              b.drawWaveform('load', 80, 280, 840, 50,
                (t) => { if (t < 0) return 0; const c = t % 4000; return (c > 1600 && c < 2000) ? 1 : 0; },
                { running: true, step: 4, timePerCol: 14 });
              b.drawNode('load-l', 50, 310, 'LOAD', C().edgeRise);
              b.drawNode('note', 500, 450, 'count runs freely, except the brief pulse when LOAD jumps to 1', C().accent);
              b.setLabel('Two inputs — CLK and LOAD. The CPU controls both.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 7 — THE PROGRAM COUNTER
    // ════════════════════════════════════════════════════
    {
      id: 7,
      title: 'The Program Counter',
      pages: [
        { sentences: [
          { text: `This loadable counter is exactly what lives inside every CPU as its program counter. A register + adder + MUX + LOAD — the same four-component recipe.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('This IS The Program Counter', C().edgeRise);
              b.drawBox('plus', 180, 160, 160, 100, '+ 1', C().accent);
              b.drawBox('reg', 580, 240, 240, 160, 'PC REGISTER', C().edgeRise);
              b.drawMux('mux', 400, 220, 120, 200, { inputs: 2, label: 'MUX' });
              b.drawWire('w-plus-mux', [[340, 210],[360, 210],[360, 270],[400, 270]], C().wireHi);
              b.drawWire('w-load-mux', [[120, 370],[360, 370],[360, 360],[400, 360]], C().wireHi);
              b.drawWire('w-mux-reg', [[520, 320],[580, 320]], C().wireHi);
              b.drawWire('w-fb', [[820, 340],[880, 340],[880, 100],[120, 100],[120, 200],[180, 200]], C().wireHi);
              b.drawWire('w-load', [[460, 500],[460, 420]], C().edgeRise);
              b.drawNode('load-l', 440, 520, 'BRANCH', C().edgeRise);
              b.drawNode('data-l', 80,  370, 'jump target address', C().edgeRise);
              b.drawNode('out-l',  900, 320, '→ to fetch unit', C().wireHi);
              b.setLabel('Call it the PC. Same hardware. Different label.', C().edgeRise);
            } },

          { text: `When the CPU resets, a dedicated RESET line forces the PC to zero — the address of the first instruction. Then every clock cycle, the CPU fetches the instruction at the PC's value, and the PC increments to point at the next one.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Normal Fetch Cycle', C().accent);
              b.drawBox('pc', 100, 260, 180, 120, 'PC', C().edgeRise);
              b.drawNode('pcv', 190, 330, '0x0004', C().edgeRise);
              b.drawWire('w1', [[280, 320],[420, 320]], C().wireHi);
              b.drawBox('mem', 420, 260, 180, 120, 'RAM', C().accent);
              b.drawNode('insr', 510, 330, 'ADD R1, R2', C().wireHi);
              b.drawWire('w2', [[600, 320],[740, 320]], C().wireHi);
              b.drawBox('cpu', 740, 260, 180, 120, 'DECODE + EXEC', C().accent);
              b.drawWire('inc', [[190, 400],[190, 480],[440, 480],[440, 430],[220, 430],[220, 380]], C().wireHi);
              b.drawNode('inc-l', 500, 500, 'each cycle: PC ← PC + 1', C().accent);
              b.setLabel('PC points. Memory delivers. Decoder executes. PC increments. Repeat forever.', C().accent);
            } },

          { text: `When the CPU executes a JMP or CALL or branch instruction, the BRANCH line fires. The new target address gets driven onto the DATA bus. On the next edge, LOAD is asserted and the PC jumps to that address. The next fetch happens there instead.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A Branch — The PC Jumps', C().edgeRise);
              b.drawBox('pc', 100, 260, 180, 120, 'PC', C().edgeRise);
              b.drawNode('pcv', 190, 330, '0x2000', C().edgeRise);
              b.drawWire('dest', [[380, 240],[280, 240],[280, 280]], C().edgeRise);
              b.drawNode('data', 390, 240, 'DATA = 0x2000 (jump target)', C().edgeRise);
              b.drawWire('load', [[380, 380],[280, 380],[280, 360]], C().edgeRise);
              b.drawNode('ld', 390, 380, 'LOAD = 1 (one cycle)', C().edgeRise);
              b.drawNode('was', 500, 500, 'before:   PC = 0x0017', C().label);
              b.drawNode('now', 500, 530, 'after:    PC = 0x2000', C().edgeRise);
              b.setLabel('No special "jump hardware" — just the loadable counter we already have.', C().edgeRise);
            } },

          { text: `Every function call. Every return from a function. Every loop back to the top. Every if-else branch. All of them — at the hardware level — are exactly this: the PC being loaded with a new address instead of incrementing. The counter we just built is the thing that makes every program in existence actually run.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Every Branch, Every Loop, Every Call', C().edgeRise);
              b.drawCustom('progress', (g, NS, COL) => {
                const items = [
                  'call foo()        →  PC ← address of foo',
                  'return            →  PC ← saved return address',
                  'while (x < n)    →  PC ← top of loop (when true)',
                  'if (cond) …     →  PC ← branch target (when true)',
                  'goto label        →  PC ← label address',
                ];
                items.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 180); t.setAttribute('y', 220 + i * 42);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '17');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('One building block. Makes every flow-of-control primitive a programmer uses.', C().edgeRise);
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
      title: 'Recap — The Counter',
      pages: [
        { sentences: [
          { text: `Let's trace the build. Start with a register. Wire its output through a +1 block, and the +1 block's output back into the register's input. On every rising clock edge, the stored value becomes one larger. That is a synchronous counter.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 1 — Register + Adder + Feedback', C().accent);
              _drawSyncCounterSchematic(b);
              b.setLabel('Register + +1 + feedback loop = a counter.', C().accent);
            } },

          { text: `The +1 block is an adder with one input hard-wired to the constant 1. We'll build it from gates in a later episode; here, we treat it as a black box.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 2 — The +1 Block Is An Adder', C().accent);
              b.drawBox('adder', 380, 260, 240, 140, 'ADDER', C().edgeRise);
              b.drawNode('inl', 320, 300, 'N-bit A', C().wireHi);
              b.drawNode('inh', 320, 360, 'N-bit 1', C().edgeRise);
              b.drawNode('out', 680, 330, 'N-bit A + 1', C().edgeRise);
              b.setLabel('Construction deferred. Behaviour assumed. The counter doesn\u2019t care how the adder works.', C().label);
            } },

          { text: `N bits means the counter wraps at two-to-the-N. An N-bit counter counts modulo two-to-the-N by construction — no extra logic needed.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 3 — Wrap-Around', C().accent);
              _drawCountingRegister(b, { bits: 4, start: 13, stepMs: 1000, y: 240 });
              b.setLabel('At top of range the counter rolls over to 0. Free mod-2^N arithmetic.', C().accent);
            } },

          { text: `Chaining flip-flops — each bit's Q clocking the next — gives a ripple counter. Beautifully simple, but the update cascades from low bits to high bits. Too slow for high-speed synchronous systems.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 4 — Ripple Counter (Older)', C().accent);
              _drawRippleCounter(b, 4);
              b.setLabel('Elegant. But at GHz clocks, the staggered updates break the design.', C().accent);
            } },

          { text: `Add a 2-to-1 MUX in front of the register, with LOAD as the select. LOAD equals 0 picks the adder's output and the counter counts. LOAD equals 1 picks an external DATA bus and the counter jumps. That is the loadable counter.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 5 — Loadable Counter', C().accent);
              b.drawBox('plus', 180, 160, 160, 100, '+ 1', C().accent);
              b.drawBox('reg', 580, 240, 240, 160, 'REGISTER', C().edgeRise);
              b.drawMux('mux', 400, 220, 120, 200, { inputs: 2, label: 'MUX' });
              b.drawWire('w1', [[340, 210],[360, 210],[360, 270],[400, 270]], C().wireHi);
              b.drawWire('w2', [[120, 370],[360, 370],[360, 360],[400, 360]], C().wireHi);
              b.drawWire('w3', [[520, 320],[580, 320]], C().wireHi);
              b.drawWire('w4', [[820, 340],[880, 340],[880, 100],[120, 100],[120, 200],[180, 200]], C().wireHi);
              b.drawNode('l', 420, 520, 'LOAD', C().edgeRise);
              b.drawNode('d', 80, 370, 'DATA', C().edgeRise);
              b.setLabel('Now the counter can start anywhere and jump anywhere, on command.', C().accent);
            } },

          { text: `That loadable counter is the program counter inside every CPU. It increments every cycle to fetch the next instruction — and jumps whenever the code branches, returns, or calls. One building block makes every program run.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 6 — The Program Counter', C().edgeRise);
              b.drawBox('pc', 320, 260, 360, 160, 'PROGRAM COUNTER', C().edgeRise);
              b.drawNode('v', 500, 340, '0x0000 → 0x0001 → 0x0002 → 0x2000 (jump)', C().edgeRise);
              b.drawNode('note', 500, 470, 'counts during fetch · jumps on branch/call/return', C().accent);
              b.setLabel('Same hardware you just built. Different name. Absolutely critical job.', C().edgeRise);
            } },

          { text: `Next episode, the decoder. The circuit that takes an N-bit address and lights up exactly one of two-to-the-N output wires. Without it, RAM could not tell which cell you are asking for.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Next: The Decoder', C().accent);
              b.drawBox('dec', 360, 260, 280, 160, 'DECODER', C().edgeRise);
              b.drawNode('in-l', 200, 330, '3-bit  →', C().wireHi);
              b.drawNode('out-l', 760, 300, '→ one of 8 wires', C().edgeRise);
              b.drawWire('i1', [[260, 330],[360, 330]], C().wireHi);
              for (let i = 0; i < 8; i++) {
                const y = 260 + (i * 160) / 7;
                b.drawWire('o' + i, [[640, y],[720, y]], i === 3 ? C().edgeRise : C().dim);
              }
              b.setLabel('One input code → exactly one output wire active. See you next episode.', C().accent);
            } },
        ] },
      ],
      showAll: true,
      isFinal: true,
    },
  ];

  if (typeof window !== 'undefined') {
    window.BLOCKS_04_SCENES = BLOCKS_04_SCENES;
  }
})();
