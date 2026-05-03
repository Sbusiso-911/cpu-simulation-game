/**
 * Series B — Episode 3: How a Register Is Built
 * -----------------------------------------------
 * A register is the flip-flop, multiplied. N flip-flops sharing a clock is
 * the starting point — but a usable CPU register needs load-enable (hold or
 * load on command) and output-enable (so many registers can share a bus).
 * Wire the flip-flops in a chain instead of in parallel and you get a shift
 * register, which does serial-to-parallel conversion and binary shifts for
 * free.
 *
 * Arc:
 *   0. Hook                       numbers live in registers
 *   1. Parallel register          N flip-flops, one clock
 *   2. Parallel load + problem    "capture on every edge" is too aggressive
 *   3. Load-enable via MUX        feedback from Q + MUX selects hold vs load
 *   4. Reading it out             tri-state buffers + shared bus
 *   5. Shift register             chain Q→D, shift on each edge
 *   6. Where registers live       PC, IR, accumulator, stack pointer…
 *   7. Recap                      the trust chain
 *
 * Walk-the-talk: every anim() must match its narration.
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
  const stepped = (transitions, start = 0) => (t) => {
    let v = start;
    for (const tr of transitions) {
      if (t < tr.t) return v;
      v = tr.v;
    }
    return v;
  };

  // ─────────────────────────────────────────
  //  Visual helpers
  // ─────────────────────────────────────────

  // Draw a row of FF cells, one per bit. `bits[0]` is the leftmost cell (MSB
  // by convention). Returns an array of cell objects with coordinates so an
  // animator can update the bit labels on subsequent frames.
  function _drawRegisterCells(b, x, y, bits, opts) {
    opts = opts || {};
    const cellW = opts.cellW || 70;
    const cellH = opts.cellH || 100;
    const gap   = opts.gap   || 8;
    const col   = C();
    const cells = [];
    bits.forEach((v, i) => {
      const cx = x + i * (cellW + gap);
      b.drawBox('ff' + (opts.prefix || '') + i, cx, y, cellW, cellH,
        'FF' + (bits.length - 1 - i), col.accent);
      b.drawNode('bit' + (opts.prefix || '') + i, cx + cellW / 2, y + cellH + 22,
        String(v), v ? col.edgeRise : col.label);
      cells.push({ x: cx, y, w: cellW, h: cellH, idx: i });
    });
    return cells;
  }

  // Draw a single bit-slice of a register-with-load-enable. One MUX in front
  // of one D flip-flop, with feedback from Q.
  //   state: { LOAD, DIN, Q } — all 0 or 1
  function _drawLoadEnableBitSlice(b, state) {
    const col = C();
    const { LOAD, DIN, Q } = state;
    // MUX on the left
    b.drawMux('mux', 240, 220, 110, 180, { inputs: 2, label: 'MUX 2:1' });
    // FF on the right (drawn as a labelled box)
    b.drawBox('ff', 470, 240, 200, 140, 'D FLIP-FLOP', col.edgeRise);

    const hi = (v) => v ? col.wireHi : col.wireLo;

    // External D in → MUX input 1 (load path)
    b.drawWire('w-din', [[80, 280],[180, 280],[180, 280],[240, 280]], hi(DIN));
    b.drawNode('din-l', 60, 280, 'D in = ' + DIN, hi(DIN));

    // Q feedback → MUX input 0 (hold path)
    b.drawWire('w-fb', [[670, 310],[720, 310],[720, 460],[200, 460],[200, 340],[240, 340]], hi(Q));
    b.drawNode('fb-l', 460, 480, 'feedback from Q', hi(Q));

    // LOAD → MUX select
    b.drawWire('w-load', [[295, 500],[295, 400]], hi(LOAD));
    b.drawNode('load-l', 220, 500, 'LOAD = ' + LOAD, hi(LOAD));

    // MUX output → FF D
    const muxOut = LOAD ? DIN : Q;
    b.drawWire('w-mux-ff', [[350, 310],[470, 310]], hi(muxOut));

    // FF Q out
    b.drawWire('w-q', [[670, 310],[820, 310]], hi(Q));
    b.drawNode('q-l', 830, 310, 'Q = ' + Q, hi(Q));

    // CLK rail
    b.drawWire('w-clk', [[380, 420],[570, 420],[570, 380]], col.accent);
    b.drawNode('clk-l', 330, 420, 'CLK', col.accent);

    // Highlight active path
    const activePath = LOAD ? 'w-din' : 'w-fb';
    b.setState('mux', 'glow');
    // (visual highlight via colouring above; setState also glows MUX border)
  }

  // ─────────────────────────────────────────
  //  SCENES
  // ─────────────────────────────────────────
  const BLOCKS_03_SCENES = [

    // ════════════════════════════════════════════════════
    // SCENE 0 — HOOK
    // ════════════════════════════════════════════════════
    {
      id: 0,
      title: 'Where A Number Lives',
      pages: [
        { sentences: [
          { text: `A CPU speaks in numbers. Eight bits. Sixteen. Thirty-two. Sixty-four. Every add, every address calculation, every branch test works on groups of bits pretending to be one number.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A CPU Speaks In Numbers', C().edgeRise);
              b.drawCustom('big-num', (g, NS, COL) => {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', 500); t.setAttribute('y', 260);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '54');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', COL.edgeRise);
                t.textContent = '0x2A';
                g.appendChild(t);
                const eq = document.createElementNS(NS, 'text');
                eq.setAttribute('x', 500); eq.setAttribute('y', 300);
                eq.setAttribute('text-anchor', 'middle');
                eq.setAttribute('font-family', 'monospace');
                eq.setAttribute('font-size', '18');
                eq.setAttribute('fill', COL.label);
                eq.textContent = '=  42  =  0 0 1 0 1 0 1 0'; g.appendChild(eq);
              });
              b.setLabel('One number = a group of bits, treated as one thing by every instruction.', C().label);
            } },

          { text: `Where does one of those numbers live, inside the chip? In a register. A register is a place in the CPU that holds one number, and lets the rest of the hardware read it and write it.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A Register Holds One Number', C().accent);
              b.drawBox('reg', 320, 240, 360, 160, 'REGISTER A', C().edgeRise);
              b.drawNode('val', 500, 325, '0 0 1 0 1 0 1 0', C().edgeRise);
              b.drawWire('w-in', [[160, 300],[320, 300]], C().wireHi);
              b.drawNode('in-l', 80, 300, 'WRITE →', C().wireHi);
              b.drawWire('w-out', [[680, 340],[840, 340]], C().wireHi);
              b.drawNode('out-l', 850, 340, '→ READ', C().wireHi);
              b.setLabel('One register = one number, held steady, readable any time by the rest of the chip.', C().accent);
            } },

          { text: `We already have the flip-flop. One flip-flop, one bit. A register is that — multiplied. Eight flip-flops shoulder to shoulder, all on the same clock. But there's more to a working register than just lining them up. Let's build one properly.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Flip-Flops, Multiplied', C().accent);
              _drawRegisterCells(b, 100, 260, [1, 0, 1, 1, 0, 0, 1, 0]);
              b.setLabel('Eight flip-flops = eight bits. Simple idea, surprisingly much wiring around it.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 1 — N FFs SIDE BY SIDE
    // ════════════════════════════════════════════════════
    {
      id: 1,
      title: 'Eight Flip-Flops, One Clock',
      pages: [
        { sentences: [
          { text: `Start with one D flip-flop. On every rising edge of the clock, it captures whatever is on D. That's one stored bit.`,
            dur: 8500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One Flip-Flop = One Bit', C().accent);
              b.drawBox('ff', 380, 240, 240, 160, 'D FLIP-FLOP', C().edgeRise);
              b.drawWire('w-d', [[240, 300],[380, 300]], C().wireHi);
              b.drawNode('d-l', 210, 300, 'D', C().wireHi);
              b.drawWire('w-q', [[620, 300],[760, 300]], C().wireHi);
              b.drawNode('q-l', 780, 300, 'Q', C().edgeRise);
              b.drawWire('w-clk', [[500, 460],[500, 400]], C().accent);
              b.drawNode('clk-l', 460, 470, 'CLK', C().accent);
              b.setLabel('This is what we built in the last episode. Our building block.', C().accent);
            } },

          { text: `Now duplicate it. Seven more, shoulder to shoulder. Each one identical. Each one storing one bit.`,
            dur: 7500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Duplicate It — Eight Cells', C().accent);
              _drawRegisterCells(b, 100, 260, [0, 0, 0, 0, 0, 0, 0, 0]);
              b.setLabel('Nothing clever yet. Just eight copies of the same circuit, side by side.', C().label);
            } },

          { text: `Each flip-flop has its own D input — we'll call them D7 down to D0 — and its own Q output, Q7 down to Q0. But every single one of them is wired to the same clock signal.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Independent Data, Shared Clock', C().accent);
              _drawRegisterCells(b, 100, 260, [0, 0, 0, 0, 0, 0, 0, 0]);
              // CLK rail at top
              b.drawWire('clk-rail', [[140, 200],[840, 200]], C().accent);
              b.drawNode('clk-rail-l', 60, 200, 'CLK', C().accent);
              // Stubs down to each FF
              for (let i = 0; i < 8; i++) {
                const cx = 100 + i * 78 + 35;
                b.drawWire('w-clk-' + i, [[cx, 200],[cx, 260]], C().accent);
              }
              // D input labels across the top
              for (let i = 0; i < 8; i++) {
                const cx = 100 + i * 78 + 35;
                b.drawNode('d-' + i, cx, 240, 'D' + (7 - i), C().wireHi);
                b.drawNode('q-' + i, cx, 392, 'Q' + (7 - i), C().wireHi);
              }
              b.setLabel('Eight Ds, eight Qs, one clock. The clock is the thing that synchronises everyone.', C().accent);
            } },

          { text: `That is an eight-bit register. Eight flip-flops, one shared clock, one number stored across them.`,
            dur: 7500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('An 8-Bit Register', C().edgeRise);
              _drawRegisterCells(b, 100, 260, [1, 0, 1, 1, 0, 0, 1, 0]);
              b.drawWire('clk-rail', [[140, 200],[840, 200]], C().accent);
              b.drawNode('clk-rail-l', 60, 200, 'CLK', C().accent);
              for (let i = 0; i < 8; i++) {
                const cx = 100 + i * 78 + 35;
                b.drawWire('w-clk-' + i, [[cx, 200],[cx, 260]], C().accent);
              }
              b.drawNode('val-l', 500, 440, 'holding  1 0 1 1 0 0 1 0  =  178  =  0xB2', C().edgeRise);
              b.setLabel('One edge of CLK captures all eight bits in parallel. One number, held.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 2 — PARALLEL LOAD + LOAD-ENABLE PROBLEM
    // ════════════════════════════════════════════════════
    {
      id: 2,
      title: 'Parallel Load — And A Problem',
      pages: [
        { sentences: [
          { text: `On every rising edge of the clock, all eight flip-flops capture their D inputs at the same instant. Not one after another. All at once.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('All Eight Bits — At One Instant', C().edgeRise);
              _drawRegisterCells(b, 100, 260, [1, 1, 0, 0, 1, 0, 1, 0]);
              b.drawWire('clk-rail', [[140, 200],[840, 200]], C().accent);
              for (let i = 0; i < 8; i++) {
                const cx = 100 + i * 78 + 35;
                b.drawWire('w-clk-' + i, [[cx, 200],[cx, 260]], C().accent);
              }
              b.drawWaveform('clk', 100, 440, 720, 70, square(700),
                { running: true, step: 4, timePerCol: 18 });
              b.drawNode('clk-l', 70, 475, 'CLK', C().accent);
              b.setLabel('One rising edge → eight flip-flops latch their inputs simultaneously.', C().edgeRise);
            } },

          { text: `This is called a parallel load. Eight bits of data arrive together, they're captured together, they're held together. One cycle later the whole number is in the register.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Parallel Load', C().accent);
              _drawRegisterCells(b, 100, 260, [0, 1, 1, 0, 1, 1, 0, 1]);
              // Arrows showing data converging on each FF
              for (let i = 0; i < 8; i++) {
                const cx = 100 + i * 78 + 35;
                b.drawWire('arr-' + i, [[cx, 130],[cx, 260]], C().wireHi);
              }
              b.drawNode('data-l', 500, 110, 'eight bits of input data', C().wireHi);
              b.setLabel('This is how an ALU\u2019s result gets into the accumulator in a single cycle.', C().accent);
            } },

          { text: `But here's the problem. If the register captures on every rising edge, it will grab whatever happens to be on its D inputs — whether we meant to write something or not. What if we wanted to hold its value for a few cycles while the CPU did other work?`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Capture-Every-Edge Problem', C().wireHot);
              _drawRegisterCells(b, 100, 260, [0, 0, 1, 0, 1, 0, 1, 0]);
              b.drawWaveform('clk', 100, 440, 720, 50, square(500),
                { running: true, step: 4, timePerCol: 16 });
              b.drawNode('clk-l', 70, 465, 'CLK', C().accent);
              b.drawNode('prob', 500, 540, 'every edge overwrites the register → the stored value is gone', C().wireHot);
              b.setLabel('We need a way to say HOLD — keep what you have — or LOAD — take new data — on command.', C().wireHot);
            } },

          { text: `We need an extra signal. Call it LOAD. When LOAD is 1, the register captures new data on the clock edge. When LOAD is 0, it ignores its inputs and just holds the current value.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Add A LOAD Signal', C().accent);
              b.drawBox('reg', 260, 240, 480, 160, 'REGISTER', C().edgeRise);
              b.drawNode('val', 500, 320, '0 0 1 0 1 0 1 0', C().edgeRise);
              b.drawWire('w-d',   [[120, 290],[260, 290]], C().wireHi);
              b.drawNode('d-l',   90, 290, 'D in', C().wireHi);
              b.drawWire('w-clk', [[500, 480],[500, 400]], C().accent);
              b.drawNode('clk-l', 460, 500, 'CLK', C().accent);
              b.drawWire('w-load', [[120, 360],[260, 360]], C().wireHi);
              b.drawNode('load-l',  80, 360, 'LOAD', C().edgeRise);
              b.drawWire('w-q',   [[740, 320],[880, 320]], C().wireHi);
              b.drawNode('q-l',   890, 320, 'Q out', C().wireHi);
              b.setLabel('LOAD = 1 → capture on edge. LOAD = 0 → ignore D, hold the current value.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 3 — LOAD-ENABLE VIA MUX FEEDBACK
    // ════════════════════════════════════════════════════
    {
      id: 3,
      title: 'Load-Enable — The MUX Trick',
      pages: [
        { sentences: [
          { text: `We add the LOAD control with a small, elegant trick. In front of each flip-flop we put a 2-to-1 multiplexer. A MUX is a switch. It has two data inputs, one select line, and one output. The select line chooses which input to pass to the output.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The 2:1 Multiplexer', C().accent);
              b.drawMux('mux', 380, 220, 140, 200, { inputs: 2, label: 'MUX 2:1' });
              b.drawWire('i0', [[240, 280],[380, 280]], C().wireHi);
              b.drawNode('i0-l', 220, 280, 'in 0', C().label);
              b.drawWire('i1', [[240, 360],[380, 360]], C().wireHi);
              b.drawNode('i1-l', 220, 360, 'in 1', C().label);
              b.drawWire('out',[[520, 320],[660, 320]], C().wireHi);
              b.drawNode('out-l', 670, 320, 'out', C().label);
              b.drawWire('sel',[[450, 500],[450, 420]], C().edgeRise);
              b.drawNode('sel-l', 440, 520, 'sel', C().edgeRise);
              b.drawNode('tbl', 500, 120, 'sel = 0 → out = in 0     ·     sel = 1 → out = in 1', C().accent);
              b.setLabel('Two inputs. One select line. Picks which data reaches the output.', C().accent);
            } },

          { text: `Here's the trick. Connect one MUX input to the external data. Connect the other MUX input to the flip-flop's own Q output — a feedback loop. Make LOAD the select line.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Wire The MUX As A Load-Select', C().accent);
              _drawLoadEnableBitSlice(b, { LOAD: 1, DIN: 1, Q: 1 });
              b.setLabel('External data feeds one MUX input. Q feeds the other. LOAD picks between them.', C().accent);
            } },

          { text: `When LOAD is 0, the MUX routes Q back into the flip-flop's own D input. On the next clock edge, the flip-flop captures its own current value. Nothing changes. The register holds.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('LOAD = 0  →  Q Feeds Back → Hold', C().accent);
              _drawLoadEnableBitSlice(b, { LOAD: 0, DIN: 0, Q: 1 });
              b.drawNode('note', 500, 580, 'each clock edge the FF re-captures its own value → perfectly stable', C().accent);
              b.setLabel('No data gets in. The feedback loop around the FF keeps it parked on its current bit.', C().accent);
            } },

          { text: `When LOAD is 1, the MUX routes the external data straight through. On the next clock edge, the flip-flop captures the new bit. The register loads.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('LOAD = 1  →  External Data → Load', C().edgeRise);
              _drawLoadEnableBitSlice(b, { LOAD: 1, DIN: 1, Q: 1 });
              b.drawNode('note', 500, 580, 'the new bit reaches the FF D input and is latched on the next edge', C().edgeRise);
              b.setLabel('With LOAD high, the MUX lets external data through. Normal parallel-load register.', C().edgeRise);
            } },

          { text: `One MUX per flip-flop. Eight MUXes for an eight-bit register, all driven by the same LOAD line. Now the register responds only when you want it to — and it still runs on a steady clock.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One MUX Per Bit — Eight Total', C().accent);
              // A compact block diagram of the whole register
              for (let i = 0; i < 8; i++) {
                const cx = 90 + i * 100;
                b.drawMux('m' + i, cx, 220, 60, 120, { inputs: 2, label: '' });
                b.drawBox('f' + i, cx, 380, 60, 90, 'FF', C().edgeRise);
                b.drawWire('wm' + i, [[cx + 30, 340],[cx + 30, 380]], C().wireHi);
              }
              // Shared LOAD rail
              b.drawWire('load-rail', [[90, 370],[890, 370]], C().edgeRise);
              b.drawNode('load-lbl', 60, 370, 'LOAD', C().edgeRise);
              // Shared CLK rail
              b.drawWire('clk-rail', [[90, 500],[890, 500]], C().accent);
              b.drawNode('clk-lbl', 60, 500, 'CLK', C().accent);
              for (let i = 0; i < 8; i++) {
                const cx = 90 + i * 100;
                b.drawWire('wc' + i, [[cx + 30, 500],[cx + 30, 470]], C().accent);
              }
              b.setLabel('Same structure in each bit. Shared LOAD. Shared CLK. Independent data.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 4 — READING IT OUT — TRI-STATE + SHARED BUS
    // ════════════════════════════════════════════════════
    {
      id: 4,
      title: 'Reading It Out — The Shared Bus',
      pages: [
        { sentences: [
          { text: `We can now write to the register on command. What about reading? A register's Q outputs are always driving — whatever value is stored, it's sitting on those wires. Most of the time we feed those straight to the ALU, or to a memory address. No problem.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Q Outputs Are Always Driving', C().accent);
              b.drawBox('reg', 260, 240, 260, 140, 'REGISTER', C().edgeRise);
              b.drawNode('val', 390, 320, '1 0 1 1', C().edgeRise);
              b.drawWire('q-wire', [[520, 310],[760, 310]], C().wireHi);
              b.drawBox('alu', 760, 240, 160, 140, 'ALU', C().edgeRise);
              b.setLabel('One register → one destination → fine. Wires just carry the value continuously.', C().label);
            } },

          { text: `But what if many registers want to share one wire? Three registers, one destination. Bit 0 of register A says 1. Bit 0 of register B says 0. They fight. Electrically it's a short circuit.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Many Drivers, One Wire — Collision', C().wireHot);
              b.drawBox('ra', 100, 160, 140, 90, 'REG A → 1', C().wireHot);
              b.drawBox('rb', 100, 280, 140, 90, 'REG B → 0', C().wireHot);
              b.drawBox('rc', 100, 400, 140, 90, 'REG C → 1', C().wireHot);
              b.drawWire('wa', [[240, 205],[500, 205],[500, 320]], C().wireHot);
              b.drawWire('wb', [[240, 325],[500, 325]], C().wireHot);
              b.drawWire('wc', [[240, 445],[500, 445],[500, 330]], C().wireHot);
              b.drawBox('bus', 500, 290, 300, 70, 'SHARED BUS', C().wireHot);
              b.drawNode('x',   650, 425, '✗ three drivers fighting — short circuit', C().wireHot);
              b.setLabel('Electrically this is lethal. Two gates driving opposite values into the same wire = dead chip.', C().wireHot);
            } },

          { text: `The fix is a new kind of gate called a tri-state buffer. It has three states: driving 1, driving 0, or disconnected. That third state — also called high-impedance, or "Z" — is electrically as if the wire weren't there.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Tri-State Buffer', C().accent);
              b.drawTriStateBuffer('tri', 430, 280, 120, 'right');
              b.drawNode('in-l', 400, 340, 'in', C().wireHi);
              b.drawNode('out-l', 580, 340, 'out', C().wireHi);
              b.drawNode('oe-l', 500, 260, 'OE', C().edgeRise);
              b.drawTruthTable('tt', 120, 260, ['OE','in','out'], [
                [0, '—', 'Z  (disconnected)'],
                [1, 0,   0],
                [1, 1,   1],
              ]);
              b.setLabel('Three states: 0, 1, and Z. That Z means the buffer has let go of the wire entirely.', C().accent);
            } },

          { text: `Put a tri-state buffer on each register's output. Each register gets its own output enable — OE — line. When OE is 1, that register drives the bus. When OE is 0, that register's outputs vanish from the bus, as if it weren't there.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One OE Per Register', C().accent);
              b.drawBox('ra', 100, 160, 140, 90, 'REG A', C().edgeRise);
              b.drawTriStateBuffer('ta', 260, 180, 80, 'right');
              b.drawBox('rb', 100, 280, 140, 90, 'REG B', C().edgeRise);
              b.drawTriStateBuffer('tb', 260, 300, 80, 'right');
              b.drawBox('rc', 100, 400, 140, 90, 'REG C', C().edgeRise);
              b.drawTriStateBuffer('tc', 260, 420, 80, 'right');
              b.drawWire('ba', [[240, 205],[260, 205]], C().wireHi);
              b.drawWire('bb', [[240, 325],[260, 325]], C().wireHi);
              b.drawWire('bc', [[240, 445],[260, 445]], C().wireHi);
              // Buses
              b.drawWire('bus-a', [[340, 205],[580, 205],[580, 320]], C().wireHi);
              b.drawWire('bus-b', [[340, 325],[580, 325]], C().wireHi);
              b.drawWire('bus-c', [[340, 445],[580, 445],[580, 340]], C().wireHi);
              b.drawBox('bus', 580, 290, 300, 70, 'SHARED BUS', C().edgeRise);
              b.drawNode('oea', 300, 170, 'OE_A', C().edgeRise);
              b.drawNode('oeb', 300, 290, 'OE_B', C().label);
              b.drawNode('oec', 300, 410, 'OE_C', C().label);
              b.setLabel('Exactly one OE is 1 at a time. That register\u2019s data is on the bus. The others are silent.', C().accent);
            } },

          { text: `This is how a CPU's internal data bus actually works. One physical wire per bit — sometimes shared by a dozen registers plus RAM plus the ALU. A controller decides, every cycle, exactly which one is allowed to drive. Perfect discipline. Never two drivers at once.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One Bus, Many Drivers, Strict Discipline', C().edgeRise);
              b.drawBox('pc',  80,  180, 110, 80, 'PC',  C().accent);
              b.drawBox('ir',  80,  290, 110, 80, 'IR',  C().accent);
              b.drawBox('ax',  80,  400, 110, 80, 'AX',  C().accent);
              b.drawBox('sp',  80,  510, 110, 80, 'SP',  C().accent);
              b.drawBox('ram', 710, 180, 110, 80, 'RAM', C().accent);
              b.drawBox('alu', 710, 400, 110, 80, 'ALU', C().accent);
              [220, 330, 440, 550].forEach((y, i) => {
                b.drawTriStateBuffer('ta' + i, 220, y - 20, 60, 'right');
                b.drawWire('wa' + i, [[190, y],[220, y]], C().wireHi);
                b.drawWire('wb' + i, [[280, y],[440, y]], C().wireHi);
              });
              b.drawBox('bus', 440, 220, 240, 340, 'DATA BUS', C().edgeRise);
              b.setLabel('This discipline is enforced by the control unit on every single cycle.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 5 — SHIFT REGISTER
    // ════════════════════════════════════════════════════
    {
      id: 5,
      title: 'The Shift Register',
      pages: [
        { sentences: [
          { text: `All the registers so far have been parallel — each flip-flop has its own independent D input. But there's another common style, wired very differently. It's called a shift register.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A Different Wiring — Shift Register', C().accent);
              _drawRegisterCells(b, 100, 260, [1, 0, 1, 1, 0, 1, 0, 0]);
              b.drawNode('note', 500, 420, 'same flip-flops — but the wiring between them is the key difference', C().accent);
              b.setLabel('Same building blocks. Completely different behaviour.', C().label);
            } },

          { text: `Instead of each flip-flop having its own independent D input, we chain them. The Q output of the first flip-flop becomes the D input of the second. The Q of the second becomes the D of the third. And so on down the line.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Chain Q → D → Q → D …', C().accent);
              _drawRegisterCells(b, 100, 260, [0, 1, 0, 1, 1, 0, 1, 1]);
              // Arrows Q_i → D_{i+1}
              for (let i = 0; i < 7; i++) {
                const cx = 100 + i * 78 + 70;
                b.drawWire('arr-' + i, [[cx, 310],[cx + 16, 310]], C().wireHi);
              }
              // Serial input on the left
              b.drawWire('serial-in', [[40, 310],[100, 310]], C().edgeRise);
              b.drawNode('sin-l', 20, 310, 'IN', C().edgeRise);
              // Serial output on the right
              b.drawWire('serial-out', [[720, 310],[820, 310]], C().wireHi);
              b.drawNode('sout-l', 840, 310, 'OUT', C().wireHi);
              b.setLabel('One new bit enters on the left. The old bits cascade rightward, one cell per clock.', C().accent);
            } },

          { text: `On every rising clock edge, each bit shifts one position to the right. What was in cell 7 moves to cell 6. What was in cell 6 moves to cell 5. And the input end accepts whatever new bit is on the serial-in line.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Every Edge → One Shift', C().accent);
              // Animate the bits shifting over time.
              const initialBits = [1, 0, 0, 1, 1, 1, 0, 1];
              const serialIn   = [1, 0, 1, 1, 0, 0, 1, 0];  // new bits coming in
              const stepMs = 900;
              const cells = [];
              // Draw the register cells that we will update each frame.
              const cellW = 70, cellH = 100, gap = 8, baseX = 100, baseY = 260;
              for (let i = 0; i < 8; i++) {
                const cx = baseX + i * (cellW + gap);
                b.drawBox('ff' + i, cx, baseY, cellW, cellH, 'FF' + (7 - i), C().edgeRise);
                cells.push({ x: cx + cellW / 2, y: baseY + cellH + 22 });
              }
              // Track bit label elements so the animator can rewrite them.
              const bitEls = [];
              b.drawCustom('bits', (g, NS, COL) => {
                for (let i = 0; i < 8; i++) {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', cells[i].x); t.setAttribute('y', cells[i].y);
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '14');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', COL.edgeRise);
                  t.textContent = initialBits[i];
                  g.appendChild(t);
                  bitEls.push(t);
                }
              });
              b.animate('bits', (tMs) => {
                if (!bitEls.length) return;
                const step = Math.floor(tMs / stepMs);
                // Compose the current state: initial bits shifted right by `step`,
                // with new bits from serialIn on the left.
                const state = [];
                for (let i = 0; i < 8; i++) {
                  const srcIdx = i - step;
                  if (srcIdx >= 0) state.push(initialBits[srcIdx]);
                  else state.push(serialIn[(-srcIdx - 1) % serialIn.length]);
                }
                state.forEach((v, i) => {
                  bitEls[i].textContent = String(v);
                  bitEls[i].setAttribute('fill', v ? C().edgeRise : C().label);
                });
              });
              // Serial input visualisation
              b.drawWire('serial-in', [[40, 310],[100, 310]], C().edgeRise);
              b.drawNode('sin-l', 20, 310, 'IN', C().edgeRise);
              b.drawWaveform('clk', 100, 440, 720, 50, square(stepMs * 2),
                { running: true, step: 4, timePerCol: stepMs / 18 });
              b.drawNode('clk-l', 70, 470, 'CLK', C().accent);
              b.setLabel('Watch the bits move one cell to the right every clock tick.', C().accent);
            } },

          { text: `Eight clock ticks later, the entire register has been refilled with whatever came in on that one serial-in wire. One wire plus a clock is enough to send a whole byte into the chip. This is serial-to-parallel conversion.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Serial → Parallel In Eight Ticks', C().edgeRise);
              _drawRegisterCells(b, 100, 260, [0, 1, 1, 0, 0, 1, 0, 1]);
              b.drawWire('serial-in', [[40, 310],[100, 310]], C().edgeRise);
              b.drawNode('sin-l', 20, 310, 'IN', C().edgeRise);
              b.drawNode('how', 500, 420, 'one wire + one clock = an entire byte arrives in 8 cycles', C().edgeRise);
              b.setLabel('This is how SPI, UART, and every serial protocol gets data into a chip.', C().accent);
            } },

          { text: `Shifting also does arithmetic for free. Shifting the bits one position to the right is the same operation as dividing by two in binary. Shifting left is multiplying by two. That is why nearly every CPU has shift-left and shift-right as single-cycle instructions.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Shift = Multiply Or Divide By 2', C().edgeRise);
              _drawRegisterCells(b, 70, 200, [0, 0, 0, 0, 1, 1, 0, 0], { prefix: 'a-' });
              b.drawNode('v1', 400, 340, '= 12', C().edgeRise);
              _drawRegisterCells(b, 70, 400, [0, 0, 0, 0, 0, 1, 1, 0], { prefix: 'b-' });
              b.drawNode('v2', 400, 540, '= 6  (shifted right → ÷ 2)', C().edgeRise);
              b.setLabel('Bit shifting is the cheapest arithmetic in hardware. Just rewiring.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 — WHERE REGISTERS LIVE IN THE CPU
    // ════════════════════════════════════════════════════
    {
      id: 6,
      title: 'Where Registers Live',
      pages: [
        { sentences: [
          { text: `A modern CPU is full of registers. And almost every one of them is built from the exact same ingredients: flip-flops, multiplexers for load-enable, and tri-state buffers for bus access.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The CPU — Registers Everywhere', C().accent);
              b.drawChipOutline('die', 150, 130, 700, 420, 'CPU');
              const regs = [
                { name: 'PC',  x: 210, y: 200 },
                { name: 'IR',  x: 340, y: 200 },
                { name: 'AX',  x: 470, y: 200 },
                { name: 'BX',  x: 600, y: 200 },
                { name: 'CX',  x: 210, y: 310 },
                { name: 'DX',  x: 340, y: 310 },
                { name: 'SP',  x: 470, y: 310 },
                { name: 'BP',  x: 600, y: 310 },
                { name: 'SI',  x: 210, y: 420 },
                { name: 'DI',  x: 340, y: 420 },
                { name: 'FLG', x: 470, y: 420 },
                { name: 'TMP', x: 600, y: 420 },
              ];
              regs.forEach(r => b.drawBox('r-' + r.name, r.x, r.y, 100, 60, r.name, C().accent));
              b.setLabel('A dozen or more named registers, all built from the same primitives.', C().accent);
            } },

          { text: `The program counter holds the address of the next instruction. The instruction register holds the current instruction. The accumulator holds intermediate arithmetic results. The stack pointer, the flag register, the general-purpose registers — every one of them is a row of flip-flops with load and output enables.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Each One Is A Row Of Flip-Flops', C().accent);
              const items = [
                { name: 'PC',   role: 'next instruction address' },
                { name: 'IR',   role: 'current instruction'      },
                { name: 'AX',   role: 'arithmetic accumulator'   },
                { name: 'SP',   role: 'top of stack'             },
                { name: 'FLAGS',role: 'zero · carry · overflow · sign' },
                { name: 'GP',   role: 'general-purpose data'     },
              ];
              items.forEach((r, i) => {
                const y = 180 + i * 60;
                b.drawBox('r-' + r.name, 100, y, 120, 44, r.name, C().accent);
                b.drawNode('role-' + r.name, 230, y + 26, r.role, C().label);
              });
              b.setLabel('Different jobs, identical construction. Flip-flops + MUX + tri-state + clock.', C().accent);
            } },

          { text: `Next time you hear "this CPU has sixteen sixty-four-bit registers" — that is literally sixteen times sixty-four flip-flops on the chip, all clocked together, plus the supporting MUXes and tri-state buffers to load and read them.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('16 × 64 = 1,024 Flip-Flops', C().edgeRise);
              // Grid of 16 rows × 64 cells
              b.drawCustom('grid', (g, NS, COL) => {
                const cols = 64, rows = 16;
                const cellSz = 9, spacing = 1;
                const totalW = cols * (cellSz + spacing);
                const totalH = rows * (cellSz + spacing);
                const startX = (1000 - totalW) / 2;
                const startY = 180;
                for (let r = 0; r < rows; r++) {
                  for (let c = 0; c < cols; c++) {
                    const rect = document.createElementNS(NS, 'rect');
                    rect.setAttribute('x', startX + c * (cellSz + spacing));
                    rect.setAttribute('y', startY + r * (cellSz + spacing));
                    rect.setAttribute('width', cellSz);
                    rect.setAttribute('height', cellSz);
                    rect.setAttribute('fill', COL.edgeRise);
                    rect.setAttribute('opacity', '0.75');
                    g.appendChild(rect);
                  }
                }
              });
              b.drawNode('count', 500, 500, '1,024 flip-flops — clocked, load-enabled, bus-connected', C().edgeRise);
              b.setLabel('Flip-flops are not rare. They are one of the most-manufactured objects in human history.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 7 — RECAP
    // ════════════════════════════════════════════════════
    {
      id: 7,
      title: 'Recap — The Register',
      pages: [
        { sentences: [
          { text: `Let's trace the build. Start with one D flip-flop — one stored bit. Multiply it by eight, with a shared clock, and you have an eight-bit register. One rising edge captures all eight bits at once.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 1 — N Flip-Flops, One Clock', C().accent);
              _drawRegisterCells(b, 100, 260, [1, 0, 1, 1, 0, 0, 1, 0]);
              b.drawWire('clk-rail', [[140, 200],[840, 200]], C().accent);
              for (let i = 0; i < 8; i++) {
                const cx = 100 + i * 78 + 35;
                b.drawWire('w-clk-' + i, [[cx, 200],[cx, 260]], C().accent);
              }
              b.setLabel('One clock edge captures the whole number in parallel.', C().accent);
            } },

          { text: `Add a 2-to-1 MUX in front of each flip-flop, with feedback from Q. The LOAD line is the select. LOAD = 0 feeds Q back and the register holds. LOAD = 1 lets new data through. Now the register responds only when you ask it to.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 2 — Load-Enable Via MUX Feedback', C().accent);
              _drawLoadEnableBitSlice(b, { LOAD: 1, DIN: 1, Q: 1 });
              b.setLabel('Hold or load on command. No more "every edge overwrites me" problem.', C().accent);
            } },

          { text: `Put a tri-state buffer on each output. Give each register its own output enable. Now many registers can share a single data bus, with a simple rule: only one OE can be high at a time. That is the internal data bus of every CPU.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 3 — Tri-State + Shared Bus', C().accent);
              b.drawBox('ra', 100, 180, 140, 80, 'REG A', C().accent);
              b.drawBox('rb', 100, 300, 140, 80, 'REG B', C().accent);
              b.drawBox('rc', 100, 420, 140, 80, 'REG C', C().accent);
              b.drawTriStateBuffer('ta', 260, 200, 60, 'right');
              b.drawTriStateBuffer('tb', 260, 320, 60, 'right');
              b.drawTriStateBuffer('tc', 260, 440, 60, 'right');
              b.drawBox('bus', 400, 300, 380, 80, 'DATA BUS', C().edgeRise);
              b.setLabel('Many drivers, one wire, strict one-at-a-time discipline.', C().accent);
            } },

          { text: `Wire the flip-flops in a chain instead of in parallel, and you get a shift register. Serial-to-parallel conversion in eight cycles. Multiplying or dividing by two for free, just by shifting left or right.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 4 — Shift Register', C().accent);
              _drawRegisterCells(b, 100, 260, [0, 1, 1, 0, 1, 1, 0, 1]);
              for (let i = 0; i < 7; i++) {
                const cx = 100 + i * 78 + 70;
                b.drawWire('arr-' + i, [[cx, 310],[cx + 16, 310]], C().wireHi);
              }
              b.drawWire('serial-in', [[40, 310],[100, 310]], C().edgeRise);
              b.drawNode('sin-l', 20, 310, 'IN', C().edgeRise);
              b.setLabel('Same flip-flops, a different wiring pattern, an entirely different useful device.', C().accent);
            } },

          { text: `That is the register. A flip-flop, multiplied, with load-enable, output-enable, and the option to chain. One building block — used for the program counter, the instruction register, the accumulator, the stack pointer, and the hundreds of general-purpose registers inside every modern CPU.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Register — The Workhorse Of The CPU', C().edgeRise);
              b.drawBox('ff',  50,  260, 140, 120, 'FLIP-FLOP', C().accent);
              b.drawWire('x1', [[190, 320],[240, 320]], C().wireHi);
              b.drawBox('many', 240, 260, 140, 120, '× 8', C().accent);
              b.drawWire('x2', [[380, 320],[430, 320]], C().wireHi);
              b.drawBox('mux', 430, 260, 140, 120, '+ MUX', C().accent);
              b.drawWire('x3', [[570, 320],[620, 320]], C().wireHi);
              b.drawBox('tri', 620, 260, 140, 120, '+ TRI-STATE', C().accent);
              b.drawWire('x4', [[760, 320],[810, 320]], C().wireHi);
              b.drawBox('reg', 810, 260, 140, 120, 'REGISTER', C().edgeRise);
              b.setLabel('Four stages of composition. The unit every instruction set treats as a named storage location.', C().edgeRise);
            } },

          { text: `Next episode, we take a register and wire it to increment itself by one on every clock edge. That is the counter — the circuit that makes the program counter actually count.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Next: The Counter', C().accent);
              b.drawBox('reg', 320, 260, 360, 160, 'REGISTER', C().edgeRise);
              b.drawWire('fb', [[680, 340],[780, 340],[780, 440],[220, 440],[220, 340],[320, 340]], C().wireHi);
              b.drawBox('plus', 190, 310, 60, 60, '+ 1', C().accent);
              b.drawNode('note', 500, 500, 'feed output + 1 back into input → counter', C().accent);
              b.setLabel('One clock edge → increment. That\u2019s how PC counts through your program.', C().accent);
            } },
        ] },
      ],
      showAll: true,
      isFinal: true,
    },
  ];

  if (typeof window !== 'undefined') {
    window.BLOCKS_03_SCENES = BLOCKS_03_SCENES;
  }
})();
