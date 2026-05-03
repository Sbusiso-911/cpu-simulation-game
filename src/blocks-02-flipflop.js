/**
 * Series B — Episode 2: How a Flip-Flop Is Built
 * -----------------------------------------------
 * The D flip-flop is the atom of digital memory. Every register, every cache
 * line, every state machine in a CPU stores its bits in these little circuits.
 * This episode shows how one is actually built, gate by gate, from the
 * feedback-bistability insight up through setup/hold/metastability.
 *
 * Arc:
 *   0. Hook                            millions of them, how does a circuit remember?
 *   1. Bistability                     ball in a double-valley landscape
 *   2. The SR Latch                    cross-coupled NORs — the simplest memory
 *   3. Truth table + HOLD              the four states, including the magic one
 *   4. Gating with a clock             asynchronous → synchronous
 *   5. The D Latch                     collapse S and R into one data input
 *   6. Transparency → Master/Slave     why a single latch isn't enough
 *   7. Setup / Hold / Metastability    the real-world cost
 *   8. Recap                           the trust chain
 *
 * Walk-the-talk: every anim() must match its narration exactly.
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
  // Digital that follows a lookup table of (t_ms → 0|1) transitions.
  // transitions: sorted array [{ t, v }]. Returns v at most recent transition.
  const stepped = (transitions, start = 0) => (t) => {
    let v = start;
    for (const tr of transitions) {
      if (t < tr.t) return v;
      v = tr.v;
    }
    return v;
  };

  // ─────────────────────────────────────────
  //  SCENES
  // ─────────────────────────────────────────
  const BLOCKS_02_SCENES = [

    // ════════════════════════════════════════════════════
    // SCENE 0 — HOOK
    // ════════════════════════════════════════════════════
    {
      id: 0,
      title: 'The Hook',
      pages: [
        { sentences: [
          { text: `A modern CPU has hundreds of millions of tiny circuits that each store exactly one bit. They are called flip-flops, and they are the atoms of digital memory.`,
            dur: 9000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Atoms of Digital Memory', C().edgeRise);
              b.drawChipOutline('die', 150, 140, 700, 400, 'CPU DIE');
              b.drawCustom('ff-field', (g, NS) => {
                for (let i = 0; i < 260; i++) {
                  const c = document.createElementNS(NS, 'circle');
                  c.setAttribute('cx', 170 + Math.random() * 660);
                  c.setAttribute('cy', 160 + Math.random() * 360);
                  c.setAttribute('r', 1.5);
                  c.setAttribute('fill', C().edgeRise);
                  g.appendChild(c);
                }
              });
              b.setLabel('Every dot is a flip-flop. Each one holds exactly one bit.', C().label);
            } },

          { text: `Every register, every cache line, every pipeline stage — all of them, at the deepest level, are just rows and rows of these little cells, each holding a zero or a one.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Registers Are Rows Of Flip-Flops', C().accent);
              const vals = [1, 0, 1, 1, 0, 1, 0, 0];
              vals.forEach((v, i) => {
                b.drawBox('ff' + i, 100 + i * 100, 270, 80, 100, 'FF', C().accent);
                b.drawNode('v' + i, 140 + i * 100, 400, v.toString(), v ? C().edgeRise : C().label);
              });
              b.drawNode('label', 500, 440, '8-bit register = 8 flip-flops side by side', C().accent);
              b.setLabel('String them together and you have a register. Thousands of registers make a CPU.', C().accent);
            } },

          { text: `Which raises a deep question. A logic gate responds to its inputs. Change the inputs, the output changes instantly. No memory. So how can a circuit made purely of gates ever remember anything?`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Gates Have No Memory', C().wireHot);
              b.drawGate('and', 'AND', 380, 260, 140, 100);
              b.drawWire('in1', [[280, 285],[380, 285]], C().wireHi);
              b.drawWire('in2', [[280, 335],[380, 335]], C().wireLo);
              b.drawWire('out', [[532, 310],[650, 310]], C().wireLo);
              b.drawNode('in1-l', 270, 285, 'A', C().wireHi);
              b.drawNode('in2-l', 270, 335, 'B', C().label);
              b.drawNode('out-l', 660, 310, 'out', C().label);
              b.drawNode('qm', 500, 450, '?  where does the memory come from  ?', C().wireHot);
              b.setLabel('Stop the inputs, the output is instantly undefined. No memory. Yet CPUs remember things. How?', C().wireHot);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 1 — BISTABILITY
    // ════════════════════════════════════════════════════
    {
      id: 1,
      title: 'Bistability — Two Stable States',
      pages: [
        { sentences: [
          { text: `Imagine a ball resting in a landscape with two valleys and a hill between them. Put the ball in the left valley, it stays there. Put it in the right valley, it stays there. No outside force needed.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A Ball In A Double-Valley Landscape', C().accent);
              _drawDoubleValley(b, 'left');
              b.setLabel('Two places where the ball can rest and stay. Those are stable states.', C().accent);
            } },

          { text: `To move the ball, you have to give it a shove — enough energy to climb the hill in the middle. Below that threshold, the landscape holds it where it is.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A Shove Moves The Ball', C().accent);
              _drawDoubleValley(b, 'right', { shoveArrow: true });
              b.setLabel('Once it\u2019s over the hill, it falls into the other valley and stays there.', C().accent);
            } },

          { text: `This is called bistability. Two stable fixed points. The landscape itself remembers which state you're in — just by not letting the ball settle anywhere else.`,
            dur: 9000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Bistability', C().edgeRise);
              _drawDoubleValley(b, 'right');
              b.drawNode('note', 500, 510, 'the landscape IS the memory', C().edgeRise);
              b.setLabel('No battery. No tape. The SHAPE of the landscape stores the bit.', C().edgeRise);
            } },

          { text: `Now the question: can we build an electronic circuit with this same property? Two stable states, held in place by the circuit itself?`,
            dur: 7500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Can Circuits Do This?', C().accent);
              _drawDoubleValley(b, 'left');
              b.drawNode('qm', 500, 510, '?  electronic version  ?', C().accent);
              b.setLabel('We need the circuit equivalent of a valley. Something that settles and stays.', C().label);
            } },

          { text: `The answer is feedback. In the clock episode we saw feedback cause oscillation. With a different kind of feedback — and different gates — the same principle gives us two stable states, separated by an unstable peak. Exactly like the ball in the valleys.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Feedback — Again', C().accent);
              b.drawGate('g', 'NOT', 430, 250, 140, 100);
              b.drawWire('w-fb', [[572, 300],[650, 300],[650, 420],[310, 420],[310, 300],[430, 300]], C().wireHi);
              b.drawNode('lbl', 500, 490, 'output fed back to input — a loop', C().accent);
              b.setLabel('Same tool as the oscillator. Different wiring → a memory cell instead of a wave.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 2 — THE SR LATCH
    // ════════════════════════════════════════════════════
    {
      id: 2,
      title: 'The SR Latch — Cross-Coupled NORs',
      pages: [
        { sentences: [
          { text: `Here is the simplest circuit with two stable states. Two NOR gates — the NOT-OR gate — wired so that the output of each one is an input to the other.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Two NOR Gates, Cross-Coupled', C().accent);
              _drawSRLatch(b, { S: 0, R: 0, Q: null, Qbar: null, inputsVisible: false });
              b.setLabel('No external inputs yet. Just the cross-couple — the loop that makes it memory.', C().label);
            } },

          { text: `The output of the top gate feeds the bottom gate. The output of the bottom gate feeds the top gate. Each one watches the other. That feedback loop is the entire secret.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Each Gate Watches The Other', C().accent);
              _drawSRLatch(b, { S: 0, R: 0, Q: null, Qbar: null, inputsVisible: false, highlightCross: true });
              b.setLabel('This is the loop. The whole reason the circuit can remember.', C().accent);
            } },

          { text: `Quick reminder: a NOR gate outputs 1 only when all of its inputs are 0. Any single input at 1 forces its output to 0.`,
            dur: 8000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('NOR Refresher', C().accent);
              b.drawGate('nor', 'NOR', 380, 260, 160, 120);
              b.drawTruthTable('nor-tt', 620, 260, ['A','B','A NOR B'], [
                [0, 0, 1],
                [0, 1, 0],
                [1, 0, 0],
                [1, 1, 0],
              ]);
              b.setLabel('NOR = NOT-OR. Output 1 only when every input is 0.', C().accent);
            } },

          { text: `Now let's ask: is there a state where everything agrees? Suppose the top gate's output — call it Q — is 1. Then the bottom gate has a 1 on one of its inputs, so it outputs 0 — that's Q-bar. Back at the top gate, it sees Q-bar = 0 on its input, so if its other input is also 0, it outputs 1. Which is Q. Consistent!`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('State 1 — Q = 1, Q̄ = 0', C().edgeRise);
              _drawSRLatch(b, { S: 0, R: 0, Q: 1, Qbar: 0, inputsVisible: false });
              b.setLabel('Every wire agrees with every gate\u2019s truth. Nothing fights. Stable.', C().edgeRise);
            } },

          { text: `The mirror state also works. Q equals 0, Q-bar equals 1. Same reasoning. Everything agrees. Also stable.`,
            dur: 8000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('State 2 — Q = 0, Q̄ = 1', C().edgeRise);
              _drawSRLatch(b, { S: 0, R: 0, Q: 0, Qbar: 1, inputsVisible: false });
              b.setLabel('The other stable state. Mirror image of the first.', C().edgeRise);
            } },

          { text: `Two stable states. The ball in two valleys. But we have no way to choose which one the circuit lands in. To control it, we add two external inputs — S for SET, R for RESET. One wire into each NOR.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Add Control Inputs — S and R', C().accent);
              _drawSRLatch(b, { S: 0, R: 0, Q: null, Qbar: null, inputsVisible: true });
              b.setLabel('S shoves the state one way. R shoves it the other. Now we can control which valley the ball sits in.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 3 — TRUTH TABLE + HOLD + FORBIDDEN
    // ════════════════════════════════════════════════════
    {
      id: 3,
      title: 'SET · RESET · HOLD · FORBIDDEN',
      pages: [
        { sentences: [
          { text: `Four combinations of S and R. Let's walk through them.`,
            dur: 5000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Four Cases', C().accent);
              _drawSRLatch(b, { S: 0, R: 0, Q: null, Qbar: null, inputsVisible: true });
              b.drawTruthTable('sr-tt', 40, 100, ['S','R','Q','note'], [
                ['1','0','1','SET'],
                ['0','1','0','RESET'],
                ['0','0','—','HOLD'],
                ['1','1','✗','FORBIDDEN'],
              ]);
              b.setLabel('Track the table as we drive the latch through each row.', C().label);
            } },

          { text: `First: S equals 1, R equals 0. S goes into the bottom NOR. The bottom NOR sees a 1 on one input, so it outputs 0. That's Q-bar. Now the top NOR sees R = 0 and Q-bar = 0 — two zeros — so it outputs 1. That's Q. The latch is in state Q = 1. We SET it.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('SET — S=1, R=0  →  Q=1', C().edgeRise);
              _drawSRLatch(b, { S: 1, R: 0, Q: 1, Qbar: 0, inputsVisible: true });
              b.drawTruthTable('sr-tt', 40, 100, ['S','R','Q','note'], [
                ['1','0','1','SET'],
                ['0','1','0','RESET'],
                ['0','0','—','HOLD'],
                ['1','1','✗','FORBIDDEN'],
              ]);
              b.highlightTableRow('sr-tt', 0);
              b.setLabel('S = 1 → Q-bar drops → Q rises. The latch is now in the Q=1 valley.', C().edgeRise);
            } },

          { text: `Second: flip it around. R equals 1, S equals 0. Mirror image. R forces Q to 0. That drops Q, and with S=0 the bottom NOR settles at Q-bar = 1. The latch is in state Q = 0. We RESET it.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('RESET — R=1, S=0  →  Q=0', C().edgeFall);
              _drawSRLatch(b, { S: 0, R: 1, Q: 0, Qbar: 1, inputsVisible: true });
              b.drawTruthTable('sr-tt', 40, 100, ['S','R','Q','note'], [
                ['1','0','1','SET'],
                ['0','1','0','RESET'],
                ['0','0','—','HOLD'],
                ['1','1','✗','FORBIDDEN'],
              ]);
              b.highlightTableRow('sr-tt', 1);
              b.setLabel('R = 1 → Q drops → Q-bar rises. The latch is now in the Q=0 valley.', C().edgeFall);
            } },

          { text: `Third — this is the magic one. Drop both S and R back to 0. Nothing is being pushed in. But watch what happens.`,
            dur: 7500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('HOLD — S=0, R=0  →  Q stays', C().accent);
              _drawSRLatch(b, { S: 0, R: 0, Q: 0, Qbar: 1, inputsVisible: true });
              b.drawTruthTable('sr-tt', 40, 100, ['S','R','Q','note'], [
                ['1','0','1','SET'],
                ['0','1','0','RESET'],
                ['0','0','—','HOLD'],
                ['1','1','✗','FORBIDDEN'],
              ]);
              b.highlightTableRow('sr-tt', 2);
              b.setLabel('Inputs go quiet. Now what?', C().label);
            } },

          { text: `The feedback loop still holds. If Q was 1, the bottom NOR sees a 1 → outputs 0 → Q-bar is 0. The top NOR sees 0 and 0 → outputs 1 → Q stays 1. The circuit locks itself in the state it was in. It remembers.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Feedback Holds The State', C().edgeRise);
              _drawSRLatch(b, { S: 0, R: 0, Q: 1, Qbar: 0, inputsVisible: true, highlightCross: true });
              b.drawNode('lbl', 500, 550, 'with S=R=0, whichever state the latch is in, it stays', C().edgeRise);
              b.setLabel('This is the memory. Gates holding each other in place through feedback.', C().edgeRise);
            } },

          { text: `A momentary pulse on S sets the latch to 1, and it stays 1. A momentary pulse on R resets it to 0, and it stays 0. As long as the power is on, the last value written stays put.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Pulse In, Remembered Forever', C().edgeRise);
              b.drawWaveform('s-wave', 80, 160, 820, 80,
                stepped([{ t: 900, v: 1 }, { t: 1500, v: 0 }], 0),
                { running: true, step: 4, timePerCol: 30 });
              b.drawNode('s-l', 50, 200, 'S', C().accent);
              b.drawWaveform('q-wave', 80, 290, 820, 80,
                stepped([{ t: 950, v: 1 }], 0),
                { running: true, step: 4, timePerCol: 30 });
              b.drawNode('q-l', 50, 330, 'Q', C().edgeRise);
              b.setLabel('Brief input pulse → permanent output change. That is what memory looks like on a scope.', C().edgeRise);
            } },

          { text: `There is one combination to avoid. Set S and R both to 1 at the same time. Both NOR gates have a 1 on an input, so both output 0. Now Q = 0 AND Q-bar = 0. They aren\u2019t opposites any more — the circuit\u2019s invariant is broken. We call this the forbidden state.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('FORBIDDEN — S=1 AND R=1', C().wireHot);
              _drawSRLatch(b, { S: 1, R: 1, Q: 0, Qbar: 0, inputsVisible: true, warn: true });
              b.drawTruthTable('sr-tt', 40, 100, ['S','R','Q','note'], [
                ['1','0','1','SET'],
                ['0','1','0','RESET'],
                ['0','0','—','HOLD'],
                ['1','1','✗','FORBIDDEN'],
              ]);
              b.highlightTableRow('sr-tt', 3);
              b.setLabel('Both outputs forced to 0. Not a valid memory state.', C().wireHot);
            } },

          { text: `And when you release both back to 0, whichever NOR is a fraction of a nanosecond faster wins the race. The final state is unpredictable. So we design around it — by making sure S and R never both go high at the same time.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Release → Race → Unpredictable', C().wireHot);
              _drawSRLatch(b, { S: 0, R: 0, Q: null, Qbar: null, inputsVisible: true, warn: true });
              b.drawNode('race', 500, 550, 'whichever gate is a picosecond faster decides the final state', C().wireHot);
              b.setLabel('The circuit becomes a coin flip. Bad design. We will fix this in a moment.', C().wireHot);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 4 — GATING WITH A CLOCK
    // ════════════════════════════════════════════════════
    {
      id: 4,
      title: 'Gating It With A Clock',
      pages: [
        { sentences: [
          { text: `The SR latch as we\u2019ve drawn it responds the instant S or R changes. In a CPU we don\u2019t want that. We want every latch on the chip to only pay attention to its inputs at specific moments — on a clock edge.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('We Need Synchronous Memory', C().accent);
              _drawSRLatch(b, { S: 0, R: 0, Q: null, Qbar: null, inputsVisible: true });
              b.drawWaveform('clk', 80, 540, 840, 50, square(600),
                { running: true, step: 4, timePerCol: 15 });
              b.drawNode('clk-l', 50, 565, 'CLK', C().accent);
              b.setLabel('Right now the latch is asynchronous. We want it to obey the clock.', C().accent);
            } },

          { text: `The trick is to put an AND gate in front of each input. The other input of each AND gate is the clock signal itself.`,
            dur: 9000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Gate The Inputs With The Clock', C().accent);
              _drawGatedSRLatch(b, { S: 0, R: 0, CLK: 0, Q: 0, Qbar: 1 });
              b.setLabel('Two AND gates. Each one has CLK as a second input. Now the latch only listens when CLK permits.', C().accent);
            } },

          { text: `When the clock is LOW, both AND gates output 0 — no matter what S and R are doing. The latch sees S equals 0 and R equals 0. That\u2019s the HOLD state. It keeps its value.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('CLK = 0  →  Latch Frozen', C().accent);
              _drawGatedSRLatch(b, { S: 1, R: 0, CLK: 0, Q: 0, Qbar: 1 });
              b.setLabel('Even with S high, the AND gate blocks it. The latch hears nothing.', C().accent);
            } },

          { text: `When the clock is HIGH, the AND gates are transparent. S and R pass straight through to the latch just like before. The latch responds as a normal SR latch for as long as the clock stays high.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('CLK = 1  →  Latch Listens', C().edgeRise);
              _drawGatedSRLatch(b, { S: 1, R: 0, CLK: 1, Q: 1, Qbar: 0 });
              b.setLabel('Clock high, AND gates open, S reaches the NORs, Q goes to 1.', C().edgeRise);
            } },

          { text: `This is a gated SR latch — still simple, still has the forbidden-state problem. But we\u2019ve turned memory synchronous. Time now flows in ticks, not continuously.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Gated SR Latch', C().accent);
              _drawGatedSRLatch(b, { S: 0, R: 0, CLK: 0, Q: 1, Qbar: 0 });
              b.setLabel('One improvement down. One problem left: S and R can still collide.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 5 — THE D LATCH
    // ════════════════════════════════════════════════════
    {
      id: 5,
      title: 'The D Latch — One Input, No Forbidden State',
      pages: [
        { sentences: [
          { text: `The SR latch has two inputs and a forbidden combination. But most of the time you just want to store one bit. So why give the user a chance to set and reset at the same moment?`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Two Inputs Is One Too Many', C().accent);
              _drawGatedSRLatch(b, { S: 0, R: 0, CLK: 0, Q: 0, Qbar: 1 });
              b.drawNode('fix', 500, 560, 'collapse S and R into ONE input', C().accent);
              b.setLabel('We want one data line in, one bit stored. Period.', C().accent);
            } },

          { text: `The fix is elegant. Replace the two inputs with one, called D for data. Feed D directly to where S used to be. And feed NOT-D — D through an inverter — to where R used to be.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One Data Input + An Inverter', C().accent);
              _drawDLatch(b, { D: 1, CLK: 1, Q: 1, Qbar: 0 });
              b.setLabel('D goes to S. NOT-D goes to R. Two inputs, always opposite, always valid.', C().accent);
            } },

          { text: `Because D and NOT-D are always opposites, the S and R lines inside the latch can never both be 1 at the same time. The forbidden state is simply impossible by construction.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Forbidden State: Impossible', C().edgeRise);
              _drawDLatch(b, { D: 0, CLK: 1, Q: 0, Qbar: 1 });
              b.drawTruthTable('d-tt', 60, 120, ['D','CLK','Q'], [
                [0, 0, '—'],
                [1, 0, '—'],
                [0, 1, 0],
                [1, 1, 1],
              ]);
              b.setLabel('Truth table reduced from four rows to two meaningful ones.', C().edgeRise);
            } },

          { text: `While the clock is HIGH, whatever D is, Q follows. When the clock drops LOW, the latch freezes at whatever value D had at that moment. This is the D latch.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The D Latch', C().edgeRise);
              _drawDLatch(b, { D: 1, CLK: 1, Q: 1, Qbar: 0 });
              b.drawWaveform('clk', 80, 480, 840, 50, square(600),
                { running: true, step: 4, timePerCol: 15 });
              b.drawNode('clk-l', 50, 505, 'CLK', C().accent);
              b.setLabel('One input. One enable. One bit stored. This is a massive step forward.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 — TRANSPARENCY PROBLEM → MASTER/SLAVE
    // ════════════════════════════════════════════════════
    {
      id: 6,
      title: 'Transparency → Edge-Triggered',
      pages: [
        { sentences: [
          { text: `But there\u2019s still a problem with the D latch. While the clock is high, it\u2019s transparent. Whatever D does during that phase, Q echoes. If D wiggles ten times while the clock is high, Q wiggles ten times too.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Transparency Problem', C().wireHot);
              b.drawWaveform('clk', 80, 180, 840, 80, square(800),
                { running: true, step: 4, timePerCol: 16 });
              b.drawNode('clk-l', 50, 220, 'CLK', C().accent);
              b.drawWaveform('d-wave', 80, 300, 840, 80,
                stepped([
                  { t: 200, v: 1 }, { t: 350, v: 0 }, { t: 500, v: 1 }, { t: 650, v: 0 },
                  { t: 900, v: 1 }, { t: 1050, v: 0 }, { t: 1200, v: 1 },
                ], 0),
                { running: true, step: 4, timePerCol: 16 });
              b.drawNode('d-l', 50, 340, 'D', C().wireHi);
              b.drawWaveform('q-wave', 80, 420, 840, 80,
                stepped([
                  { t: 200, v: 1 }, { t: 350, v: 0 }, { t: 500, v: 1 }, { t: 650, v: 0 },
                  { t: 900, v: 1 }, { t: 1050, v: 0 }, { t: 1200, v: 1 },
                ], 0),
                { running: true, step: 4, timePerCol: 16 });
              b.drawNode('q-l', 50, 460, 'Q', C().wireHot);
              b.setLabel('While CLK is high, Q just tracks D. That\u2019s not a bit of memory — that\u2019s a wire.', C().wireHot);
            } },

          { text: `This breaks pipelines. In a CPU, one stage\u2019s output feeds the next stage\u2019s input. If every latch is transparent during the same clock phase, data ripples through multiple stages in one clock period. The pipeline collapses.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Ripple-Through — Pipeline Breaks', C().wireHot);
              b.drawBox('s1', 80,  280, 160, 110, 'D Latch 1', C().wireHot);
              b.drawBox('s2', 300, 280, 160, 110, 'D Latch 2', C().wireHot);
              b.drawBox('s3', 520, 280, 160, 110, 'D Latch 3', C().wireHot);
              b.drawBox('s4', 740, 280, 160, 110, 'D Latch 4', C().wireHot);
              b.drawWire('wa', [[240, 335],[300, 335]], C().wireHot);
              b.drawWire('wb', [[460, 335],[520, 335]], C().wireHot);
              b.drawWire('wc', [[680, 335],[740, 335]], C().wireHot);
              b.drawNode('rip', 500, 430, 'while CLK is high → data flows straight through all four', C().wireHot);
              b.setLabel('We wanted one bit per stage per cycle. Got four bits per cycle. Data corruption.', C().wireHot);
            } },

          { text: `The fix is called master-slave. Two D latches in series — but with their clocks inverted relative to each other. One listens when the clock is low, the other when the clock is high.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Master-Slave — Two Latches, Opposite Clocks', C().accent);
              _drawMasterSlaveFF(b, { D: 0, CLK: 0, master: 'transparent', slave: 'frozen' });
              b.setLabel('One inverter flips the clock between the two halves. Everything depends on this.', C().accent);
            } },

          { text: `While the clock is LOW, the master latch is transparent — it tracks D. The slave is frozen — it holds whatever it had before.`,
            dur: 9000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('CLK = 0  —  Master Listening, Slave Frozen', C().accent);
              _drawMasterSlaveFF(b, { D: 1, CLK: 0, master: 'transparent', slave: 'frozen' });
              b.setLabel('Master follows D. Slave ignores everything — its output is stuck at the old value.', C().accent);
            } },

          { text: `At the instant the clock goes HIGH — the rising edge — the master freezes, capturing exactly whatever D was at that moment. And the slave wakes up, passing the master\u2019s frozen value through to the output.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Rising Edge  —  Master Freezes · Slave Passes', C().edgeRise);
              _drawMasterSlaveFF(b, { D: 1, CLK: 1, master: 'frozen', slave: 'transparent' });
              b.drawNode('edge', 500, 560, '↑ the clock edge is the single moment of capture', C().edgeRise);
              b.setLabel('All the action happens in the instant the clock transitions. That is the \u201cedge-triggered\u201d part.', C().edgeRise);
            } },

          { text: `While the clock stays HIGH, the master is locked. Anything D does now is ignored — the master isn\u2019t listening. The slave is transparent, but it\u2019s only seeing the master\u2019s frozen value.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('CLK = 1  —  D Changes Don\u2019t Matter', C().accent);
              _drawMasterSlaveFF(b, { D: 0, CLK: 1, master: 'frozen', slave: 'transparent' });
              b.drawNode('note', 500, 560, 'D wiggling freely — Q stays at the latched value', C().accent);
              b.setLabel('Exactly one capture per clock cycle. The transparency problem is gone.', C().accent);
            } },

          { text: `When the clock drops back LOW, the slave freezes (holding the output), and the master starts listening again — preparing for the next rising edge.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('CLK Falls  —  Slave Freezes, Master Reopens', C().accent);
              _drawMasterSlaveFF(b, { D: 1, CLK: 0, master: 'transparent', slave: 'frozen' });
              b.setLabel('Back to the starting position — waiting for the next rising edge to capture again.', C().accent);
            } },

          { text: `The result. Q only updates at the rising edge of the clock, carrying whatever D was at that exact instant. Change D between edges — doesn\u2019t matter. This is the edge-triggered D flip-flop — the canonical memory cell of every synchronous digital system.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Edge-Triggered D Flip-Flop', C().edgeRise);
              b.drawWaveform('clk', 80, 180, 840, 80, square(900),
                { running: true, step: 4, timePerCol: 18 });
              b.drawNode('clk-l', 50, 220, 'CLK', C().accent);
              b.drawWaveform('d-wave', 80, 300, 840, 80,
                stepped([
                  { t: 150, v: 1 }, { t: 350, v: 0 }, { t: 550, v: 1 }, { t: 700, v: 0 },
                  { t: 1100, v: 1 }, { t: 1400, v: 0 }, { t: 1650, v: 1 },
                ], 0),
                { running: true, step: 4, timePerCol: 18 });
              b.drawNode('d-l', 50, 340, 'D', C().wireHi);
              b.drawWaveform('q-wave', 80, 420, 840, 80,
                stepped([
                  { t: 450, v: 1 },  // rising edge at ~450ms: D was 0 before, became 1 at 150ms, latched 1
                  { t: 1350, v: 0 },
                  { t: 2250, v: 1 },
                ], 0),
                { running: true, step: 4, timePerCol: 18 });
              b.drawNode('q-l', 50, 460, 'Q', C().edgeRise);
              b.setLabel('Q only changes at rising edges. Between edges, Q is locked. Exactly what we want.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 7 — SETUP / HOLD / METASTABILITY
    // ════════════════════════════════════════════════════
    {
      id: 7,
      title: 'Setup, Hold, Metastability',
      pages: [
        { sentences: [
          { text: `There is one last catch. The edge-triggered flip-flop needs a tiny window of stability around every clock edge, or the capture goes wrong.`,
            dur: 8500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Stability Window', C().accent);
              _drawSetupHoldDiagram(b, { setupMs: 140, holdMs: 80, edgeAt: 500, violation: null });
              b.setLabel('Two small time budgets on either side of each rising edge. Miss them and things break.', C().accent);
            } },

          { text: `Before the edge, D must be stable for a minimum time — called setup. If D is still changing when the edge arrives, the master latch may grab a half-value.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Setup Time', C().accent);
              _drawSetupHoldDiagram(b, { setupMs: 140, holdMs: 80, edgeAt: 500, violation: null });
              b.drawNode('su', 500, 550, 'D must be still BEFORE the edge, for at least the setup window', C().accent);
              b.setLabel('Typical setup: tens of picoseconds on a modern process.', C().label);
            } },

          { text: `After the edge, D must stay stable for another brief window — called hold. If it changes too quickly after the edge, the latch may not finish storing.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Hold Time', C().accent);
              _drawSetupHoldDiagram(b, { setupMs: 140, holdMs: 80, edgeAt: 500, violation: null });
              b.drawNode('hd', 500, 550, 'D must stay still AFTER the edge for the hold window', C().accent);
              b.setLabel('Hold windows are usually shorter than setup, but both must be respected.', C().label);
            } },

          { text: `Setup plus hold together form a \u201ctiming forbidden zone\u201d around every clock edge. This is the deepest constraint in digital design — it sets how fast you can clock any synchronous circuit.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Forbidden Zone', C().wireHot);
              _drawSetupHoldDiagram(b, { setupMs: 140, holdMs: 80, edgeAt: 500, violation: null, showForbidden: true });
              b.setLabel('Clock frequency is ultimately limited by this window. Faster clock → tighter budgets.', C().wireHot);
            } },

          { text: `Violate the window and you get metastability. Picture balancing a pencil on its tip. It will fall eventually — but exactly when, and which direction, is unpredictable.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Metastability — The Pencil On Its Tip', C().wireHot);
              _drawPencilOnTip(b);
              b.setLabel('Physics won\u2019t let you balance it forever. But exactly when it tips, you can\u2019t know.', C().wireHot);
            } },

          { text: `An actual metastable flip-flop ends up with its output hovering between 0 and 1 for a random length of time. It will eventually settle. But during that stretch, every gate downstream sees neither a clean 1 nor a clean 0.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Output Hovering Mid-Level', C().wireHot);
              b.drawWaveform('clk', 80, 180, 840, 60, square(700),
                { running: true, step: 4, timePerCol: 15 });
              b.drawNode('clk-l', 50, 210, 'CLK', C().accent);
              // Metastable Q — stuck at 0.5 for a bit, then resolves
              const meta = (t) => {
                if (t < 0) return 0;
                const cycle = t % 1400;
                if (cycle < 700) return 0;            // stable 0
                if (cycle < 1100) return 0.5;         // metastable window
                return 1;                             // finally resolves
              };
              b.drawWaveform('q-meta', 80, 270, 840, 120, meta,
                { running: true, mode: 'analog', step: 4, timePerCol: 15 });
              b.drawNode('q-l', 50, 330, 'Q', C().wireHot);
              b.drawNode('mid', 500, 450, 'output sits at ~½V — neither a valid 0 nor a valid 1', C().wireHot);
              b.setLabel('Downstream gates see an \u201cis it a 0 or a 1\u201d answer of \u201cyes\u201d. Chaos propagates.', C().wireHot);
            } },

          { text: `This is the chief failure mode whenever signals cross from one clock domain into another. Engineers tame it with synchronisers — extra flip-flops to let metastability resolve — and with generous timing margins. But it never fully goes away. It\u2019s a fundamental limit.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Synchronisers — Two Flip-Flops In Series', C().accent);
              b.drawBox('ff1', 200, 280, 180, 120, 'FF 1', C().accent);
              b.drawBox('ff2', 480, 280, 180, 120, 'FF 2', C().accent);
              b.drawWire('wa', [[100, 340],[200, 340]], C().wireHi);
              b.drawWire('wb', [[380, 340],[480, 340]], C().wireHi);
              b.drawWire('wc', [[660, 340],[780, 340]], C().wireHi);
              b.drawNode('din',  90, 340, 'async D', C().wireHot);
              b.drawNode('dout', 790, 340, 'stable Q', C().edgeRise);
              b.drawNode('expl', 440, 450, 'FF 1 may go metastable. FF 2 gives it a whole clock cycle to settle.', C().accent);
              b.setLabel('Simple, universal trick. Still probabilistic — you just push the failure rate way down.', C().accent);
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
      title: 'Recap — The Trust Chain',
      pages: [
        { sentences: [
          { text: `Let\u2019s trace what you just saw. We started with a paradox: gates have no memory. Then one idea solved it — feedback that settles into two stable states instead of oscillating.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 1 — Bistability', C().accent);
              _drawDoubleValley(b, 'right');
              b.setLabel('Two valleys. The landscape itself remembers which one you\u2019re in.', C().accent);
            } },

          { text: `Two NOR gates wired so each feeds the other gave us the SR latch. Two stable states held by the circuit itself. Two inputs, S and R, to push it from one to the other.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 2 — SR Latch', C().accent);
              _drawSRLatch(b, { S: 0, R: 0, Q: 1, Qbar: 0, inputsVisible: true });
              b.setLabel('Cross-coupled NORs. The first real memory cell.', C().accent);
            } },

          { text: `Gating the inputs with a clock made it synchronous. The latch only listens while the clock is high.`,
            dur: 8500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 3 — Gated (Clocked) Latch', C().accent);
              _drawGatedSRLatch(b, { S: 0, R: 0, CLK: 0, Q: 1, Qbar: 0 });
              b.setLabel('Now the chip\u2019s memories all obey the same beat.', C().accent);
            } },

          { text: `Collapsing S and R into one data input D through an inverter gave us the D latch — one input, no forbidden state, one enable.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 4 — D Latch', C().accent);
              _drawDLatch(b, { D: 1, CLK: 1, Q: 1, Qbar: 0 });
              b.setLabel('One bit in, one enable, one bit stored. Forbidden state impossible.', C().accent);
            } },

          { text: `Two D latches in series with opposite clocks gave us the edge-triggered D flip-flop. The output only updates at a single moment per clock cycle — the rising edge.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 5 — Edge-Triggered D Flip-Flop', C().edgeRise);
              _drawMasterSlaveFF(b, { D: 1, CLK: 1, master: 'frozen', slave: 'transparent' });
              b.setLabel('Master-slave. One capture per cycle. The real memory cell of every CPU.', C().edgeRise);
            } },

          { text: `And one real-world cost: every flip-flop demands a window of stability around each clock edge — setup and hold — or its output becomes unpredictable. That window is the hardest constraint in digital design.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 6 — Timing Budget', C().accent);
              _drawSetupHoldDiagram(b, { setupMs: 140, holdMs: 80, edgeAt: 500, violation: null, showForbidden: true });
              b.setLabel('Setup · hold · metastability. Physics has the last word, as always.', C().accent);
            } },

          { text: `One clock edge, one bit stored, held for as long as the power stays on. That is the flip-flop.`,
            dur: 8000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Flip-Flop', C().edgeRise);
              _drawMasterSlaveFF(b, { D: 1, CLK: 0, master: 'transparent', slave: 'frozen' });
              b.drawNode('summary', 500, 560, 'one edge  →  one stored bit', C().edgeRise);
              b.setLabel('Six ideas stacked on top of each other. The smallest unit of digital memory.', C().edgeRise);
            } },

          { text: `Next episode, we line up eight of these side-by-side, wire them to a shared clock, and get an eight-bit register — the thing that holds one number inside a CPU.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Next: The Register', C().accent);
              [0,1,2,3,4,5,6,7].forEach(i => {
                b.drawBox('ff' + i, 100 + i * 100, 260, 80, 160, 'FF', C().edgeRise);
                b.drawWire('w-clk-' + i, [[140 + i * 100, 200],[140 + i * 100, 260]], C().wireHi);
              });
              b.drawWire('clk-rail', [[140, 200],[840, 200]], C().wireHi);
              b.drawNode('clk-lbl', 60, 200, 'CLK', C().accent);
              b.drawNode('reg-l', 500, 470, '8 flip-flops + 1 clock = one register', C().accent);
              b.setLabel('Eight bits marching on the same beat. See you next episode.', C().accent);
            } },
        ] },
      ],
      showAll: true,
      isFinal: true,
    },
  ];

  // ─────────────────────────────────────────
  //  Schematic helpers
  // ─────────────────────────────────────────

  // Utility — colour a wire for its logic level.
  const _lvlColor = (v) => {
    const col = C();
    if (v === 1) return col.wireHi;
    if (v === 0) return col.wireLo;
    return col.dim;  // unknown
  };

  // Draw an SR latch (two NORs cross-coupled). state: { S, R, Q, Qbar,
  //   inputsVisible, highlightCross, warn }.
  function _drawSRLatch(b, state) {
    const S = state.S, R = state.R, Q = state.Q, Qbar = state.Qbar;
    const showInputs = state.inputsVisible !== false;
    const hlCross    = !!state.highlightCross;
    const warn       = !!state.warn;

    const col = C();
    // Top NOR — output = Q.  External input (top line) = R, cross input = Qbar.
    b.drawGate('nor-top', 'NOR', 450, 180, 140, 110);
    // Bottom NOR — output = Qbar. External input = S, cross input = Q.
    b.drawGate('nor-bot', 'NOR', 450, 380, 140, 110);

    if (warn) { b.setState('nor-top', 'hot'); b.setState('nor-bot', 'hot'); }

    // External input wires
    if (showInputs) {
      b.drawWire('w-R', [[250, 207],[450, 207]], _lvlColor(R));
      b.drawNode('R-l', 230, 207, 'R = ' + (R === null || R === undefined ? '?' : R), _lvlColor(R));
      b.drawWire('w-S', [[250, 463],[450, 463]], _lvlColor(S));
      b.drawNode('S-l', 230, 463, 'S = ' + (S === null || S === undefined ? '?' : S), _lvlColor(S));
    }

    // Output wires
    const qCol    = _lvlColor(Q);
    const qbarCol = _lvlColor(Qbar);
    b.drawWire('w-Q',    [[602, 235],[760, 235]], qCol);
    b.drawNode('Q-l',    770, 235, 'Q = ' + (Q === null || Q === undefined ? '?' : Q), qCol);
    b.drawWire('w-Qbar', [[602, 435],[760, 435]], qbarCol);
    b.drawNode('Qbar-l', 770, 435, 'Q̄ = ' + (Qbar === null || Qbar === undefined ? '?' : Qbar), qbarCol);

    // Cross-couple wires
    // Top output Q → bottom NOR's cross input (upper input line of bottom NOR).
    b.drawWire('w-xc1', [[602, 235],[680, 235],[680, 130],[400, 130],[400, 407],[450, 407]],
      hlCross ? col.edgeRise : qCol);
    // Bottom output Qbar → top NOR's cross input (lower input line of top NOR).
    b.drawWire('w-xc2', [[602, 435],[700, 435],[700, 540],[380, 540],[380, 263],[450, 263]],
      hlCross ? col.edgeRise : qbarCol);

    // Simple landmark label
    b.drawNode('lbl-top', 520, 170, 'top', col.label);
    b.drawNode('lbl-bot', 520, 500, 'bottom', col.label);
  }

  // Gated SR latch — adds AND gates in front of S and R, driven by CLK.
  function _drawGatedSRLatch(b, state) {
    const S = state.S, R = state.R, CLK = state.CLK, Q = state.Q, Qbar = state.Qbar;
    const col = C();

    // The latch itself — shift it to the right to leave room for gating.
    b.drawGate('nor-top', 'NOR', 560, 180, 140, 110);
    b.drawGate('nor-bot', 'NOR', 560, 380, 140, 110);

    // AND gates in front — one for R (top), one for S (bottom).
    b.drawGate('and-R', 'AND', 370, 180, 110, 80);
    b.drawGate('and-S', 'AND', 370, 400, 110, 80);

    // Effective input values after AND gating: only pass when CLK=1
    const rEff = (R && CLK) ? 1 : 0;
    const sEff = (S && CLK) ? 1 : 0;

    // External wires INTO the AND gates: R, S, CLK
    b.drawWire('w-R-in',   [[260, 200],[370, 200]], _lvlColor(R));
    b.drawNode('R-l',      240, 200, 'R = ' + R, _lvlColor(R));
    b.drawWire('w-S-in',   [[260, 420],[370, 420]], _lvlColor(S));
    b.drawNode('S-l',      240, 420, 'S = ' + S, _lvlColor(S));
    // CLK wire — single rail that fans out to both AND gates.
    b.drawWire('w-clk1',  [[160, 340],[330, 340],[330, 240],[370, 240]], _lvlColor(CLK));
    b.drawWire('w-clk2',  [[330, 340],[330, 460],[370, 460]], _lvlColor(CLK));
    b.drawNode('CLK-l',   110, 340, 'CLK = ' + CLK, _lvlColor(CLK));

    // AND-gate outputs → NOR inputs
    b.drawWire('w-and-R', [[492, 220],[540, 220],[540, 207],[560, 207]], _lvlColor(rEff));
    b.drawWire('w-and-S', [[492, 440],[540, 440],[540, 463],[560, 463]], _lvlColor(sEff));

    // Cross-couple
    b.drawWire('w-xc1', [[712, 235],[780, 235],[780, 130],[510, 130],[510, 407],[560, 407]], _lvlColor(Q));
    b.drawWire('w-xc2', [[712, 435],[800, 435],[800, 550],[490, 550],[490, 263],[560, 263]], _lvlColor(Qbar));

    // Outputs
    b.drawWire('w-Q',    [[712, 235],[870, 235]], _lvlColor(Q));
    b.drawNode('Q-l',    880, 235, 'Q = ' + Q, _lvlColor(Q));
    b.drawWire('w-Qbar', [[712, 435],[870, 435]], _lvlColor(Qbar));
    b.drawNode('Qbar-l', 880, 435, 'Q̄ = ' + Qbar, _lvlColor(Qbar));
  }

  // D latch — one data input + NOT gate, then gated-SR structure.
  function _drawDLatch(b, state) {
    const D = state.D, CLK = state.CLK, Q = state.Q, Qbar = state.Qbar;

    // NOT gate producing ~D
    b.drawGate('not-D', 'NOT', 230, 170, 70, 50);

    // AND gates (for S and R)
    b.drawGate('and-S', 'AND', 370, 180, 110, 80);   // S path from D
    b.drawGate('and-R', 'AND', 370, 400, 110, 80);   // R path from ~D

    // NOR latch
    b.drawGate('nor-top', 'NOR', 560, 160, 140, 110);
    b.drawGate('nor-bot', 'NOR', 560, 400, 140, 110);

    const dNot = D ? 0 : 1;
    const sEff = (D    && CLK) ? 1 : 0;
    const rEff = (dNot && CLK) ? 1 : 0;

    // D routes
    b.drawWire('w-D-in',  [[80, 195],[230, 195]],     _lvlColor(D));
    b.drawNode('D-l',     60, 195, 'D = ' + D,        _lvlColor(D));
    b.drawWire('w-D-S',   [[150, 195],[150, 220],[370, 220]], _lvlColor(D));
    // NOT out → R-path AND gate
    b.drawWire('w-D-not', [[312, 195],[340, 195],[340, 440],[370, 440]], _lvlColor(dNot));

    // CLK
    b.drawWire('w-clk1', [[160, 340],[355, 340],[355, 240],[370, 240]], _lvlColor(CLK));
    b.drawWire('w-clk2', [[355, 340],[355, 460],[370, 460]], _lvlColor(CLK));
    b.drawNode('CLK-l',  110, 340, 'CLK = ' + CLK,    _lvlColor(CLK));

    // AND → NOR
    b.drawWire('w-and-S', [[492, 220],[540, 220],[540, 187],[560, 187]], _lvlColor(sEff));
    b.drawWire('w-and-R', [[492, 440],[540, 440],[540, 483],[560, 483]], _lvlColor(rEff));

    // NOR truth: top NOR inputs = {S-path-AND (187), cross Qbar (215)}. The
    // SR-latch convention in _drawSRLatch treated top NOR external = R. Here
    // we keep the conventional D-latch wiring: S-side AND drives the gate
    // whose output is Q, R-side AND drives the gate whose output is Q-bar.
    // Cross-couple wires:
    b.drawWire('w-xc1', [[712, 215],[780, 215],[780, 120],[510, 120],[510, 440],[560, 440]], _lvlColor(Q));
    b.drawWire('w-xc2', [[712, 455],[800, 455],[800, 560],[490, 560],[490, 215],[560, 215]], _lvlColor(Qbar));

    // Outputs
    b.drawWire('w-Q',    [[712, 215],[870, 215]], _lvlColor(Q));
    b.drawNode('Q-l',    880, 215, 'Q = ' + Q,   _lvlColor(Q));
    b.drawWire('w-Qbar', [[712, 455],[870, 455]], _lvlColor(Qbar));
    b.drawNode('Qbar-l', 880, 455, 'Q̄ = ' + Qbar, _lvlColor(Qbar));
  }

  // Master/slave D flip-flop: two D-latches in series, CLK inverted between them.
  //   state.master / state.slave: 'transparent' | 'frozen' — used for visual
  //   highlight of which side is currently listening.
  function _drawMasterSlaveFF(b, state) {
    const D = state.D, CLK = state.CLK;
    const col = C();

    // Master latch (left)
    b.drawBox('master', 140, 220, 280, 200, 'MASTER D-LATCH', col.accent);
    if (state.master === 'transparent') b.setState('master', 'glow');
    else                                b.setState('master', 'dim');

    // Slave latch (right)
    b.drawBox('slave', 540, 220, 280, 200, 'SLAVE D-LATCH', col.accent);
    if (state.slave === 'transparent') b.setState('slave', 'glow');
    else                               b.setState('slave', 'dim');

    // Clock inverter between them (feeds slave)
    b.drawGate('clk-inv', 'NOT', 240, 480, 70, 50);

    // Signal routing
    b.drawWire('w-D',     [[60, 320],[140, 320]], _lvlColor(D));
    b.drawNode('D-l',     40, 320, 'D = ' + D,   _lvlColor(D));
    b.drawWire('w-mid',   [[420, 320],[540, 320]], col.wireHi);
    b.drawNode('mid-l',   480, 300, 'master Q', col.label);
    b.drawWire('w-Q',     [[820, 320],[920, 320]], col.edgeRise);
    b.drawNode('Q-l',     930, 320, 'Q', col.edgeRise);

    // CLK → master (direct). CLK → inverter → slave.
    b.drawWire('w-clk-master', [[200, 620],[200, 505],[240, 505]], _lvlColor(CLK));
    b.drawWire('w-clk-inv',    [[322, 505],[360, 505],[360, 420]], _lvlColor(CLK ? 0 : 1));
    b.drawWire('w-clk-slave',  [[200, 620],[600, 620],[600, 420]], _lvlColor(CLK));
    b.drawNode('CLK-l',  160, 620, 'CLK = ' + CLK, _lvlColor(CLK));
  }

  // Double-valley landscape with a ball in either the left or right minimum.
  function _drawDoubleValley(b, which, opts) {
    opts = opts || {};
    const col = C();
    b.drawCustom('valley', (g, NS, COL) => {
      // y curve: two cosine dips, centred at x = 330 and x = 670, plateau at y=380
      const path = document.createElementNS(NS, 'path');
      let d = '';
      for (let x = 120; x <= 880; x += 6) {
        const u = (x - 500) / 200;
        // Double-well: y = y0 + A*(u^4 - 2*u^2)
        const y = 300 + 90 * (u * u * u * u - 2 * u * u) + 90;
        d += (x === 120 ? 'M ' : 'L ') + x + ' ' + y + ' ';
      }
      path.setAttribute('d', d); path.setAttribute('fill', 'none');
      path.setAttribute('stroke', COL.accent); path.setAttribute('stroke-width', '3');
      g.appendChild(path);

      // Ball
      const ballX = which === 'right' ? 680 : 320;
      const ballY = 300 + 90 * (((ballX - 500) / 200) ** 4 - 2 * ((ballX - 500) / 200) ** 2) + 90 - 12;
      const ball = document.createElementNS(NS, 'circle');
      ball.setAttribute('cx', ballX); ball.setAttribute('cy', ballY);
      ball.setAttribute('r', 12);
      ball.setAttribute('fill', COL.edgeRise);
      ball.setAttribute('stroke', '#000'); ball.setAttribute('stroke-width', '1');
      g.appendChild(ball);

      // Labels
      const lv = document.createElementNS(NS, 'text');
      lv.setAttribute('x', 320); lv.setAttribute('y', 470);
      lv.setAttribute('text-anchor', 'middle'); lv.setAttribute('font-family', 'monospace');
      lv.setAttribute('font-size', '12'); lv.setAttribute('fill', COL.label);
      lv.textContent = 'left valley (stable)'; g.appendChild(lv);
      const rv = document.createElementNS(NS, 'text');
      rv.setAttribute('x', 680); rv.setAttribute('y', 470);
      rv.setAttribute('text-anchor', 'middle'); rv.setAttribute('font-family', 'monospace');
      rv.setAttribute('font-size', '12'); rv.setAttribute('fill', COL.label);
      rv.textContent = 'right valley (stable)'; g.appendChild(rv);
      const hl = document.createElementNS(NS, 'text');
      hl.setAttribute('x', 500); hl.setAttribute('y', 240);
      hl.setAttribute('text-anchor', 'middle'); hl.setAttribute('font-family', 'monospace');
      hl.setAttribute('font-size', '12'); hl.setAttribute('fill', COL.wireHot);
      hl.textContent = 'hill (unstable)'; g.appendChild(hl);

      // Optional shove arrow
      if (opts.shoveArrow) {
        const ar = document.createElementNS(NS, 'path');
        ar.setAttribute('d', 'M 250 330 Q 500 220 680 330');
        ar.setAttribute('stroke', COL.wireHot); ar.setAttribute('stroke-width', '3');
        ar.setAttribute('fill', 'none'); ar.setAttribute('stroke-dasharray', '6,4');
        g.appendChild(ar);
        const arL = document.createElementNS(NS, 'text');
        arL.setAttribute('x', 500); arL.setAttribute('y', 208);
        arL.setAttribute('text-anchor', 'middle'); arL.setAttribute('font-family', 'monospace');
        arL.setAttribute('font-size', '13'); arL.setAttribute('font-weight', '700');
        arL.setAttribute('fill', COL.wireHot);
        arL.textContent = 'shove →'; g.appendChild(arL);
      }
    });
  }

  // Setup / hold timing diagram.
  function _drawSetupHoldDiagram(b, opts) {
    const col = C();
    const W = 840, H = 200;
    const x0 = 80, y0 = 200;
    b.drawCustom('setup-hold', (g, NS) => {
      // Background frame
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', x0); rect.setAttribute('y', y0);
      rect.setAttribute('width', W); rect.setAttribute('height', H);
      rect.setAttribute('fill', col.panel); rect.setAttribute('stroke', col.axis);
      rect.setAttribute('rx', 4);
      g.appendChild(rect);

      // Two rows
      const clkY = y0 + 50, dY = y0 + 150;
      const txt = (t, x, y, fill, size) => {
        const tt = document.createElementNS(NS, 'text');
        tt.setAttribute('x', x); tt.setAttribute('y', y);
        tt.setAttribute('font-family', 'monospace');
        tt.setAttribute('font-size', size || 11);
        tt.setAttribute('fill', fill || col.label);
        tt.textContent = t; g.appendChild(tt);
        return tt;
      };
      txt('CLK', x0 - 40, clkY + 5, col.accent, 13);
      txt('D',   x0 - 30, dY + 5,   col.accent, 13);

      // Draw CLK as square wave: low → rising edge at middle → high
      const edgeX = x0 + W * 0.5;
      const clk = document.createElementNS(NS, 'path');
      clk.setAttribute('d',
        `M ${x0} ${clkY + 25} L ${edgeX} ${clkY + 25} L ${edgeX} ${clkY - 25} L ${x0 + W} ${clkY - 25}`);
      clk.setAttribute('stroke', col.wireHi); clk.setAttribute('stroke-width', '2.5');
      clk.setAttribute('fill', 'none');
      g.appendChild(clk);

      // Setup window rectangle
      const setupW = 120; const holdW = 60;
      const setupRect = document.createElementNS(NS, 'rect');
      setupRect.setAttribute('x', edgeX - setupW); setupRect.setAttribute('y', y0 + 10);
      setupRect.setAttribute('width', setupW); setupRect.setAttribute('height', H - 20);
      setupRect.setAttribute('fill', col.edgeRise); setupRect.setAttribute('opacity', '0.12');
      g.appendChild(setupRect);
      const holdRect = document.createElementNS(NS, 'rect');
      holdRect.setAttribute('x', edgeX); holdRect.setAttribute('y', y0 + 10);
      holdRect.setAttribute('width', holdW); holdRect.setAttribute('height', H - 20);
      holdRect.setAttribute('fill', col.edgeFall); holdRect.setAttribute('opacity', '0.12');
      g.appendChild(holdRect);

      // Setup/hold labels
      txt('setup', edgeX - setupW / 2 - 18, y0 + 8, col.edgeRise, 12);
      txt('hold',  edgeX + holdW / 2 - 12,  y0 + 8, col.edgeFall, 12);

      // Edge marker on CLK
      const edge = document.createElementNS(NS, 'path');
      edge.setAttribute('d', `M ${edgeX} ${y0 + 10} L ${edgeX} ${y0 + H - 10}`);
      edge.setAttribute('stroke', col.edgeRise); edge.setAttribute('stroke-width', '1.5');
      edge.setAttribute('stroke-dasharray', '3,3');
      g.appendChild(edge);

      // D line — stable 0 before window, stable 1 after
      const d = document.createElementNS(NS, 'path');
      d.setAttribute('d',
        `M ${x0} ${dY + 25}
         L ${edgeX - setupW - 40} ${dY + 25}
         L ${edgeX - setupW - 20} ${dY - 25}
         L ${x0 + W} ${dY - 25}`);
      d.setAttribute('stroke', col.wireHi); d.setAttribute('stroke-width', '2.5');
      d.setAttribute('fill', 'none');
      g.appendChild(d);

      if (opts.showForbidden) {
        txt('D must be stable across this whole zone', edgeX - 90, dY + 65, col.wireHot, 12);
      }
    });
  }

  // Pencil-on-tip animation — balances with small wobble, then slowly tips.
  function _drawPencilOnTip(b) {
    const pivotX = 500, pivotY = 440, len = 190;
    let pencilEl = null, tipEl = null;
    b.drawCustom('pencil', (g, NS, COL) => {
      // Ground line
      const ground = document.createElementNS(NS, 'line');
      ground.setAttribute('x1', 200); ground.setAttribute('x2', 800);
      ground.setAttribute('y1', pivotY); ground.setAttribute('y2', pivotY);
      ground.setAttribute('stroke', COL.axis); ground.setAttribute('stroke-width', '2');
      g.appendChild(ground);
      // Pencil body
      pencilEl = document.createElementNS(NS, 'line');
      pencilEl.setAttribute('x1', pivotX); pencilEl.setAttribute('y1', pivotY);
      pencilEl.setAttribute('x2', pivotX); pencilEl.setAttribute('y2', pivotY - len);
      pencilEl.setAttribute('stroke', COL.edgeRise); pencilEl.setAttribute('stroke-width', '5');
      pencilEl.setAttribute('stroke-linecap', 'round');
      g.appendChild(pencilEl);
      // Tip dot
      tipEl = document.createElementNS(NS, 'circle');
      tipEl.setAttribute('cx', pivotX); tipEl.setAttribute('cy', pivotY);
      tipEl.setAttribute('r', 4);
      tipEl.setAttribute('fill', COL.wireHot);
      g.appendChild(tipEl);
      // Label
      const lbl = document.createElementNS(NS, 'text');
      lbl.setAttribute('x', 500); lbl.setAttribute('y', 250);
      lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('font-family', 'monospace');
      lbl.setAttribute('font-size', '13'); lbl.setAttribute('fill', COL.wireHot);
      lbl.textContent = 'balancing — will fall, but when and which way?';
      g.appendChild(lbl);
    });
    b.animate('pencil', (tMs) => {
      if (!pencilEl) return;
      // Chaotic wobble that grows with time
      const wobbleAmp = 0.04 + 0.00015 * tMs;  // grows slowly
      const rand = (Math.sin(tMs * 0.017) + Math.sin(tMs * 0.023) * 0.7
                    + Math.sin(tMs * 0.013) * 0.6) * wobbleAmp;
      const angle = rand;
      const x2 = pivotX + len * Math.sin(angle);
      const y2 = pivotY - len * Math.cos(angle);
      pencilEl.setAttribute('x2', x2);
      pencilEl.setAttribute('y2', y2);
    });
  }

  if (typeof window !== 'undefined') {
    window.BLOCKS_02_SCENES = BLOCKS_02_SCENES;
  }
})();
