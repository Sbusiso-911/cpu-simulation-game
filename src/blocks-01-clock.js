/**
 * Series B — Episode 1: How the Clock Is Built
 * ----------------------------------------------
 * Branch-Education-style teardown of the clock. We are not explaining what
 * the clock DOES inside the CPU (Series A covers that). We are showing how
 * a precise rectangular HIGH-LOW signal is actually generated, from the
 * physics of resonance all the way through a PLL and the clock tree that
 * distributes the signal across a modern die.
 *
 * Arc:
 *   0. Hook                            3 GHz. ppm precision. How?
 *   1. Resonance                       swing → guitar string → crystal lattice
 *   2. The Piezoelectric Crystal       Curies 1880 → quartz lattice → shape
 *   3. Feedback Oscillation            microphone howl → Barkhausen (gain + 360°)
 *   4. The Pierce Oscillator           built in stages, each stage fixes the phase
 *   5. Sine → Square                   naive threshold fails with noise → thermostat → Schmitt
 *   6. The PLL                         runner analogy → phase ⇒ frequency → divider-in-feedback
 *   7. The Clock Tree                  skew failure → H-tree → light-speed bound
 *   8. Recap                           the trust chain
 *
 * Walk-the-talk: every anim() must exactly match what its narration describes.
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
  const sine = (periodMs, amp = 0.45) => (t) => {
    if (t < 0) return 0.5;
    return 0.5 + amp * Math.sin(2 * Math.PI * t / periodMs);
  };
  const noisySine = (periodMs, amp = 0.38, noiseAmp = 0.10) => (t) => {
    if (t < 0) return 0.5;
    return 0.5 + amp * Math.sin(2 * Math.PI * t / periodMs)
                + noiseAmp * (Math.random() - 0.5);
  };
  const startingSine = (periodMs, growMs) => (t) => {
    if (t < 0) return 0.5;
    const k = Math.min(1, t / growMs);
    const noise = (1 - k) * 0.12 * (Math.random() - 0.5);
    return 0.5 + k * 0.45 * Math.sin(2 * Math.PI * t / periodMs) + noise;
  };
  const squareFromNoisy = (periodMs, amp = 0.38, noiseAmp = 0.10) => (t) => {
    // Same content as the noisy sine, thresholded at 0.5 — used to visualise
    // the "phantom edges" failure of a naive threshold.
    if (t < 0) return 0;
    const v = 0.5 + amp * Math.sin(2 * Math.PI * t / periodMs)
              + noiseAmp * (Math.random() - 0.5);
    return v > 0.5 ? 1 : 0;
  };
  const squareFast = square(120);

  // ─────────────────────────────────────────
  //  SCENES
  // ─────────────────────────────────────────
  const BLOCKS_01_SCENES = [

    // ════════════════════════════════════════════════════
    // SCENE 0 — THE HOOK
    // ════════════════════════════════════════════════════
    {
      id: 0,
      title: 'The Hook',
      pages: [
        { sentences: [
          { text: `Your phone's processor ticks three billion times every second. That is more heartbeats than have happened in the entire history of all life on Earth — packed into one second of silicon.`,
            dur: 9000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('3,000,000,000 ticks · per second', C().edgeRise);
              b.drawWaveform('fast', 60, 260, 880, 140, squareFast, { running: true, step: 2, timePerCol: 6 });
              b.setLabel('Each vertical edge you see is one tick. Now imagine three billion of them every second.', C().label);
            } },

          { text: `And it stays on time. If you let it run for a whole year, it will only drift by about a minute. Part per million precision.`,
            dur: 7500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Drift: ~ 1 minute / year', C().accent);
              b.drawCustom('calendar', (g, NS) => {
                const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
                months.forEach((m, i) => {
                  const bx = 80 + (i % 6) * 140;
                  const by = 220 + Math.floor(i / 6) * 70;
                  const r = document.createElementNS(NS, 'rect');
                  r.setAttribute('x', bx); r.setAttribute('y', by);
                  r.setAttribute('width', 120); r.setAttribute('height', 50);
                  r.setAttribute('rx', 4);
                  r.setAttribute('fill', C().panel);
                  r.setAttribute('stroke', C().gateEdge);
                  g.appendChild(r);
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', bx + 60); t.setAttribute('y', by + 32);
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '16');
                  t.setAttribute('fill', C().label);
                  t.textContent = m;
                  g.appendChild(t);
                });
              });
              b.drawNode('ppm', 500, 400, '1 part per million = 0.0001 %', C().accent);
              b.setLabel('Over twelve months of three-billion-ticks-per-second — a minute off. That is astonishing.', C().accent);
            } },

          { text: `How does a sliver of silicon keep time better than almost any clock humanity could build before 1950? That is what this episode is about.`,
            dur: 8000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('How Is That Even Possible?', C().accent);
              b.drawCrystalSymbol('xtal', 380, 240, 240, 140, 'the answer starts here');
              b.setLabel('Not a computer trick. A physics trick. Let us see it.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 1 — RESONANCE (before we ever mention a crystal)
    // ════════════════════════════════════════════════════
    {
      id: 1,
      title: 'Resonance — the Big Idea',
      pages: [
        { sentences: [
          { text: `Start with something everyone has done. Push a child on a swing. If you push at random moments, you do a lot of work and the swing barely moves.`,
            dur: 8000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Swing', C().accent);
              _drawSwing(b, { amplitude: 0.12, periodMs: 2200, chaos: 0.6,
                label: 'random pushes → no motion' });
              b.setLabel('Push at random times. All your effort is wasted.', C().label);
            } },

          { text: `But push at exactly the right moment — every time the swing comes back toward you — and a small push builds up into huge, swinging motion.`,
            dur: 8000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Push On The Beat', C().edgeRise);
              _drawSwing(b, { amplitude: 0.95, periodMs: 2000,
                label: 'timed pushes → big motion' });
              b.setLabel('Same effort. Correct timing. The amplitude explodes.', C().edgeRise);
            } },

          { text: `That right moment is a property of the swing itself. It is called its resonant frequency — and it depends only on the swing's length and gravity. Nothing else.`,
            dur: 8500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Resonant Frequency', C().accent);
              _drawSwing(b, { amplitude: 0.95, periodMs: 2000 });
              b.drawNode('fml', 500, 560, 'f ∝ √(g / L)    — depends only on length', C().accent);
              b.setLabel('Every physical object has one. It is fixed by the object\u2019s shape and physics.', C().accent);
            } },

          { text: `A guitar string. A wine glass. A tuning fork. A suspension bridge. All of them have one — sometimes several — preferred frequencies at which tiny inputs build up into massive vibrations.`,
            dur: 9000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Resonance Is Everywhere', C().accent);
              b.drawBox('guitar', 100, 240, 180, 90, 'guitar string', C().accent);
              b.drawBox('glass',  320, 240, 180, 90, 'wine glass',    C().accent);
              b.drawBox('fork',   540, 240, 180, 90, 'tuning fork',   C().accent);
              b.drawBox('bridge', 760, 240, 180, 90, 'bridge',        C().accent);
              b.drawNode('f1', 190, 360, '~440 Hz',   C().label);
              b.drawNode('f2', 410, 360, '~800 Hz',   C().label);
              b.drawNode('f3', 630, 360, '440 Hz',    C().label);
              b.drawNode('f4', 850, 360, '~1 Hz',     C().label);
              b.setLabel('Each one\u2019s frequency set by its shape. Each one resonates when driven at that frequency.', C().label);
            } },

          { text: `A quartz crystal is the same idea — but the thing that is vibrating is the crystal's atomic lattice, and the frequency is millions of cycles per second.`,
            dur: 8000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Same Idea — At The Atomic Scale', C().edgeRise);
              _drawLattice(b, 340, 220, 12, 6, 22, true);
              b.drawNode('scale', 500, 440, 'a few mm of quartz vibrates at tens of MHz', C().edgeRise);
              b.setLabel('Replace "swing" with "lattice of atoms". Same physics. Just much, much faster.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 2 — THE CRYSTAL (history + physics + why 32,768)
    // ════════════════════════════════════════════════════
    {
      id: 2,
      title: 'The Piezoelectric Crystal',
      pages: [
        { sentences: [
          { text: `In 1880, two French brothers — Pierre and Jacques Curie — noticed that when you squeeze certain crystals, they produce a voltage. And the reverse is true too: apply a voltage, and the crystal physically flexes. They called this piezoelectricity.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('1880 — The Curie Brothers', C().accent);
              b.drawCustom('timeline', (g, NS) => {
                const line = document.createElementNS(NS, 'line');
                line.setAttribute('x1', 80); line.setAttribute('x2', 920);
                line.setAttribute('y1', 260); line.setAttribute('y2', 260);
                line.setAttribute('stroke', C().gateEdge); line.setAttribute('stroke-width', '2');
                g.appendChild(line);
                const tick = document.createElementNS(NS, 'line');
                tick.setAttribute('x1', 200); tick.setAttribute('x2', 200);
                tick.setAttribute('y1', 245); tick.setAttribute('y2', 275);
                tick.setAttribute('stroke', C().edgeRise); tick.setAttribute('stroke-width', '3');
                g.appendChild(tick);
                const year = document.createElementNS(NS, 'text');
                year.setAttribute('x', 200); year.setAttribute('y', 230);
                year.setAttribute('text-anchor', 'middle');
                year.setAttribute('font-family', 'monospace'); year.setAttribute('font-size', '14');
                year.setAttribute('font-weight', '700'); year.setAttribute('fill', C().edgeRise);
                year.textContent = '1880'; g.appendChild(year);
              });
              b.drawCrystalSymbol('xtal', 380, 330, 240, 120, 'piezoelectric effect');
              b.setLabel('A physics discovery sitting useless for decades — until electronics needed it.', C().label);
            } },

          { text: `Quartz — silicon dioxide — is one of those crystals. Its atomic lattice is just slightly asymmetric. So when you squeeze it, positive and negative charges separate across its surfaces, and a voltage appears.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Quartz Lattice — Asymmetric', C().accent);
              _drawLattice(b, 340, 220, 12, 6, 22, 'squeeze');
              // Charges: + on top, − on bottom after a squeeze
              b.drawCustom('charges', (g, NS) => {
                for (let i = 0; i < 6; i++) {
                  const plus = document.createElementNS(NS, 'text');
                  plus.setAttribute('x', 370 + i * 44); plus.setAttribute('y', 210);
                  plus.setAttribute('text-anchor', 'middle'); plus.setAttribute('font-family', 'monospace');
                  plus.setAttribute('font-size', '16'); plus.setAttribute('font-weight', '700');
                  plus.setAttribute('fill', C().edgeRise); plus.textContent = '+'; g.appendChild(plus);
                  const minus = document.createElementNS(NS, 'text');
                  minus.setAttribute('x', 370 + i * 44); minus.setAttribute('y', 380);
                  minus.setAttribute('text-anchor', 'middle'); minus.setAttribute('font-family', 'monospace');
                  minus.setAttribute('font-size', '16'); minus.setAttribute('font-weight', '700');
                  minus.setAttribute('fill', C().edgeFall); minus.textContent = '−'; g.appendChild(minus);
                }
              });
              b.drawNode('squeezeL', 260, 300, '→ squeeze',  C().wireHot);
              b.drawNode('squeezeR', 690, 300, 'squeeze ←',  C().wireHot);
              b.setLabel('Squeeze → lattice shifts → + on top, − on bottom → voltage across the crystal.', C().accent);
            } },

          { text: `Now run it in reverse. Apply a voltage across the crystal and the atomic lattice physically deforms in the opposite direction. Electricity in, squeeze out. It works both ways.`,
            dur: 9000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Reverse Piezoelectric Effect', C().accent);
              b.drawCrystalSymbol('xtal', 340, 240, 320, 140, 'crystal flexes');
              b.drawNode('vin', 170, 310, 'voltage in', C().wireHi);
              b.drawWire('win', [[240, 310],[340, 310]], C().wireHi);
              b.drawNode('fout', 500, 420, 'physical deformation out', C().wireHot);
              b.setLabel('It is a transducer. Converts energy between electrical and mechanical — in either direction.', C().accent);
            } },

          { text: `So connect the crystal to an alternating voltage. It flexes in and out, tracking the drive. But here is the swing-analogy kicking in — it flexes hugely only when you drive it at its resonant frequency. Any other frequency, the stiff lattice barely moves.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Drive It → Only Resonance Replies', C().accent);
              b.drawCrystalSymbol('xtal1', 120, 220, 180, 110, 'off-resonance');
              _animateCrystalFlex(b, 'xtal1', 0.01, 200);   // barely moves
              b.drawWaveform('drive1', 320, 220, 220, 110, sine(200, 0.4),
                { running: true, mode: 'analog', step: 3, timePerCol: 12 });
              b.drawNode('res1', 430, 350, 'tiny response', C().wireLo);

              b.drawCrystalSymbol('xtal2', 600, 220, 180, 110, 'ON-resonance');
              _animateCrystalFlex(b, 'xtal2', 0.10, 500);   // big visible flex
              b.drawWaveform('drive2', 800, 220, 140, 110, sine(500, 0.45),
                { running: true, mode: 'analog', step: 3, timePerCol: 22 });
              b.drawNode('res2', 690, 350, 'huge response', C().edgeRise);
              b.setLabel('Exactly like the swing. Only the right frequency gets the lattice moving.', C().accent);
            } },

          { text: `The resonant frequency is set by how the crystal is cut. Its thickness, its shape, its size. Cut a thin slice of quartz three millimetres long and it resonates at 32,768 Hertz. Cut it smaller and it resonates faster. The cut is everything.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Shape → Frequency', C().accent);
              b.drawCrystalSymbol('x1', 120, 260, 300, 120, '3 mm — 32,768 Hz');
              b.drawCrystalSymbol('x2', 580, 270, 180, 100,  'thinner — 25 MHz');
              b.setLabel('Shape the crystal → set the frequency. Same physics, different geometry.', C().accent);
            } },

          { text: `And because the frequency depends only on shape and material, it is extraordinarily stable. Temperature drifts it a tiny bit. Age barely matters. Seal it in a metal can and it will tick at the same frequency for decades.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Stable For Decades', C().accent);
              b.drawCrystalSymbol('xtal', 380, 250, 240, 130, '');
              b.drawBox('can', 350, 230, 300, 170, 'sealed package', C().gateEdge);
              b.drawNode('years', 500, 450, 'temperature · age · shock → drift < 1 ppm / year', C().accent);
              b.setLabel('That is how a 3 mm sliver of rock ends up keeping your clock accurate.', C().accent);
            } },

          { text: `Why did we pick 32,768 Hertz for watches? Because it is two to the fifteenth. Chain fifteen flip-flops — each halving the frequency — and you get exactly one tick per second. That is the clock in every quartz wristwatch on Earth.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Why 32,768? Because 2¹⁵', C().edgeRise);
              b.drawCustom('div-chain', (g, NS) => {
                const freqs = [32768, 16384, 8192, 4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1];
                const y0 = 280;
                freqs.forEach((f, i) => {
                  const x = 60 + i * 56;
                  const r = document.createElementNS(NS, 'rect');
                  r.setAttribute('x', x); r.setAttribute('y', y0);
                  r.setAttribute('width', 48); r.setAttribute('height', 44);
                  r.setAttribute('rx', 3);
                  r.setAttribute('fill', C().panel);
                  r.setAttribute('stroke', i === freqs.length - 1 ? C().edgeRise : C().gateEdge);
                  r.setAttribute('stroke-width', '2');
                  g.appendChild(r);
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', x + 24); t.setAttribute('y', y0 + 28);
                  t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '10');
                  t.setAttribute('fill', i === freqs.length - 1 ? C().edgeRise : C().label);
                  t.textContent = f + (i === 0 ? ' Hz' : '');
                  g.appendChild(t);
                  if (i < freqs.length - 1) {
                    const ar = document.createElementNS(NS, 'line');
                    ar.setAttribute('x1', x + 48); ar.setAttribute('x2', x + 56);
                    ar.setAttribute('y1', y0 + 22); ar.setAttribute('y2', y0 + 22);
                    ar.setAttribute('stroke', C().wireHi);
                    ar.setAttribute('stroke-width', '1.5');
                    g.appendChild(ar);
                  }
                });
                const lab = document.createElementNS(NS, 'text');
                lab.setAttribute('x', 500); lab.setAttribute('y', 360);
                lab.setAttribute('text-anchor', 'middle'); lab.setAttribute('font-family', 'monospace');
                lab.setAttribute('font-size', '12'); lab.setAttribute('fill', C().label);
                lab.textContent = '÷2 · ÷2 · ÷2 …  fifteen times …  = 1 Hz';
                g.appendChild(lab);
              });
              b.setLabel('A physics choice made for a binary-counter convenience.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 3 — FEEDBACK OSCILLATION (microphone howl)
    // ════════════════════════════════════════════════════
    {
      id: 3,
      title: 'Feedback and Oscillation',
      pages: [
        { sentences: [
          { text: `So we have a crystal that vibrates when driven. But to use it in an electronic clock we need it to drive itself — oscillate on its own, forever, with no external signal to kick it. How do we do that?`,
            dur: 9000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('How Does It Drive Itself?', C().accent);
              b.drawCrystalSymbol('xtal', 380, 260, 240, 130, 'sits still');
              b.drawNode('qm', 500, 430, '?', C().wireHot);
              b.setLabel('A crystal alone is like a swing no one is pushing. We need an automatic pusher.', C().label);
            } },

          { text: `Here is an analogy you have probably lived through. A microphone gets too close to a speaker. A tiny sound hits the mic. It is amplified. Comes out the speaker louder. Back into the mic. Amplified again. In seconds the whole room is shrieking.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Howl — A Feedback Loop', C().accent);
              _drawMicFeedback(b);
              b.drawWaveform('howl', 140, 440, 720, 130,
                startingSine(70, 2500), { running: true, mode: 'analog', step: 2, timePerCol: 8 });
              b.setLabel('Mic → amp → speaker → back to mic. Small input turns into deafening output.', C().wireHot);
            } },

          { text: `That is oscillation. An amplifier with a path connecting its output back to its input. Given any small input, the loop reinforces itself until something limits it. Noise becomes a steady tone.`,
            dur: 8500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Feedback Loop = Oscillator', C().accent);
              b.drawGate('amp', 'NOT', 350, 260, 160, 100);
              b.drawWire('w-back', [[510, 310],[600, 310],[600, 420],[300, 420],[300, 310],[350, 310]], C().wireHi);
              b.drawNode('amp-lbl', 430, 230, 'amplifier', C().accent);
              b.drawNode('loop-lbl', 500, 460, 'feedback path', C().wireHi);
              b.setLabel('Amplifier + feedback path = self-sustaining signal. Same principle as the howl.', C().accent);
            } },

          { text: `But a howl is a mess — it picks up whatever frequencies happen to resonate in the room. For a clock we want one clean, precise frequency. That needs two conditions to hold, together, at exactly that frequency.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Two Conditions To Control The Frequency', C().accent);
              b.drawBox('cond1', 120, 240, 340, 110, 'CONDITION 1 — GAIN', C().edgeRise);
              b.drawBox('cond2', 540, 240, 340, 110, 'CONDITION 2 — PHASE', C().edgeRise);
              b.drawNode('c1a', 290, 320, 'loop gain ≥ 1', C().label);
              b.drawNode('c2a', 710, 320, 'total phase = 360°', C().label);
              b.setLabel('Called the Barkhausen criteria. Both must be satisfied, at one frequency only.', C().accent);
            } },

          { text: `Condition one — gain. The signal that comes back around the loop must be at least as strong as when it left. If the loop loses energy each trip, the signal dies.`,
            dur: 8500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Condition 1 — Loop Gain ≥ 1', C().edgeRise);
              b.drawGate('amp', 'NOT', 380, 260, 140, 90);
              b.drawWaveform('small', 80, 280, 260, 70,
                sine(400, 0.15), { running: true, mode: 'analog', step: 2, timePerCol: 12 });
              b.drawWaveform('big', 560, 260, 340, 110,
                sine(400, 0.45), { running: true, mode: 'analog', step: 2, timePerCol: 12 });
              b.drawNode('in-l', 210, 380, 'small input', C().label);
              b.drawNode('out-l', 730, 390, 'bigger output', C().edgeRise);
              b.setLabel('Input goes around the loop and comes back at least as big. Otherwise it fades.', C().edgeRise);
            } },

          { text: `Condition two — phase. When the signal returns to the input, it has to be in step with what is already there. A rising crest must arrive as a rising crest. If it comes back upside-down it fights itself and dies.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Condition 2 — Total Phase = 360° (or 0°)', C().edgeRise);
              // Aligned — good
              b.drawWaveform('wa', 80, 210, 360, 100,
                sine(500, 0.4), { running: true, mode: 'analog', step: 3, timePerCol: 18 });
              b.drawWaveform('wb', 80, 320, 360, 100,
                sine(500, 0.4), { running: true, mode: 'analog', step: 3, timePerCol: 18 });
              b.drawNode('ok', 260, 440, 'in phase → reinforces ✓', C().edgeRise);
              // Opposite — bad
              b.drawWaveform('wc', 540, 210, 360, 100,
                sine(500, 0.4), { running: true, mode: 'analog', step: 3, timePerCol: 18 });
              b.drawWaveform('wd', 540, 320, 360, 100,
                (t) => 0.5 - 0.4 * Math.sin(2 * Math.PI * t / 500),
                { running: true, mode: 'analog', step: 3, timePerCol: 18 });
              b.drawNode('bad', 720, 440, 'out of phase → cancels ✗', C().wireHot);
              b.setLabel('Think of pushing the swing. Push when it comes back = amplify. Push when it goes away = cancel.', C().accent);
            } },

          { text: `So how do we force the loop to oscillate at the crystal's resonant frequency? We use the crystal itself as the phase-deciding element. Build the circuit so only at the resonant frequency do both conditions work. Every other frequency: dies.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Crystal Picks The Frequency', C().accent);
              b.drawCustom('freq-filter', (g, NS) => {
                const freqs = [
                  { x: 130, label: '10 MHz',  pass: false },
                  { x: 290, label: '18 MHz',  pass: false },
                  { x: 450, label: '25 MHz ★', pass: true  },
                  { x: 610, label: '32 MHz',  pass: false },
                  { x: 770, label: '40 MHz',  pass: false },
                ];
                freqs.forEach(f => {
                  const r = document.createElementNS(NS, 'rect');
                  r.setAttribute('x', f.x); r.setAttribute('y', 260);
                  r.setAttribute('width', 140); r.setAttribute('height', 100);
                  r.setAttribute('rx', 5);
                  r.setAttribute('fill', C().panel);
                  r.setAttribute('stroke', f.pass ? C().edgeRise : C().dim);
                  r.setAttribute('stroke-width', '2');
                  g.appendChild(r);
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', f.x + 70); t.setAttribute('y', 300);
                  t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '14'); t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', f.pass ? C().edgeRise : C().dimText);
                  t.textContent = f.label; g.appendChild(t);
                  const status = document.createElementNS(NS, 'text');
                  status.setAttribute('x', f.x + 70); status.setAttribute('y', 335);
                  status.setAttribute('text-anchor', 'middle'); status.setAttribute('font-family', 'monospace');
                  status.setAttribute('font-size', '11');
                  status.setAttribute('fill', f.pass ? C().edgeRise : C().dimText);
                  status.textContent = f.pass ? 'gain ✓  phase ✓' : 'fails';
                  g.appendChild(status);
                });
              });
              b.setLabel('Exactly one frequency survives both conditions. That is what the crystal enforces.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 4 — THE PIERCE OSCILLATOR (built in stages, phase-first)
    // ════════════════════════════════════════════════════
    {
      id: 4,
      title: 'The Pierce Oscillator',
      pages: [
        { sentences: [
          { text: `The simplest circuit that applies all this is called the Pierce oscillator. It has three ingredients. Let us build it one ingredient at a time, and watch the phase budget.`,
            dur: 8500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Pierce Oscillator — Build It Piece By Piece', C().accent);
              _drawPhaseBudget(b, { inv: 0, xtal: 0, caps: 0 });
              b.setLabel('We need 360° of phase shift around the loop. Track it as we add each part.', C().accent);
            } },

          { text: `Start with a single inverter. When its input goes up, its output goes down. That sign-flip is equivalent to a 180 degree phase shift. Halfway to what we need.`,
            dur: 8500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Ingredient 1 — The Inverter', C().accent);
              b.drawGate('inv', 'NOT', 430, 250, 140, 100);
              b.setState('inv', 'glow');
              b.drawWaveform('in',  150, 250, 260, 100, sine(500, 0.35),
                { running: true, mode: 'analog', step: 3, timePerCol: 18 });
              b.drawWaveform('out', 600, 250, 260, 100,
                (t) => 0.5 - 0.35 * Math.sin(2 * Math.PI * t / 500),
                { running: true, mode: 'analog', step: 3, timePerCol: 18 });
              b.drawWire('win',  [[410, 300],[430, 300]], C().wireHi);
              b.drawWire('wout', [[582, 300],[600, 300]], C().wireHi);
              _drawPhaseBudget(b, { inv: 180, xtal: 0, caps: 0 });
              b.setLabel('Rising in → falling out. 180° phase shift, by construction.', C().accent);
            } },

          { text: `Ingredient two — the crystal, connected directly from output back to input. At its resonant frequency the crystal passes the signal through almost unimpeded. But it adds essentially no phase shift — zero degrees. So far we only have 180 total. Not enough.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Ingredient 2 — The Crystal (short at resonance)', C().accent);
              b.drawGate('inv', 'NOT', 430, 250, 140, 100);
              b.drawCrystalSymbol('xtal', 370, 130, 260, 90, 'X1');
              b.setState('xtal', 'glow');
              b.drawWire('w-in',  [[370, 175],[300, 175],[300, 300],[430, 300]], C().wireHi);
              b.drawWire('w-out', [[582, 300],[700, 300],[700, 175],[630, 175]], C().wireHi);
              _drawPhaseBudget(b, { inv: 180, xtal: 0, caps: 0 });
              b.setLabel('Crystal conducts at resonance, blocks everything else. But the phase so far is only 180°.', C().wireHot);
            } },

          { text: `This is the problem. A loop with 180 degrees of total phase shift oscillates into cancellation — it fights itself and dies. We need another 180 degrees of shift from somewhere.`,
            dur: 8500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Problem — Phase Budget Is Wrong', C().wireHot);
              _drawPhaseBudget(b, { inv: 180, xtal: 0, caps: 0 }, true);
              b.setLabel('180° total ≠ 360°. The loop will not sustain. We need 180° more.', C().wireHot);
            } },

          { text: `Ingredient three — two small capacitors, one from each side of the crystal down to ground. Together with the crystal they form a network that adds exactly 180 degrees of phase shift — but only at the crystal's resonant frequency. Add it up: 180 from the inverter, 180 from the crystal-plus-caps. Total: 360 degrees. The loop closes.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Ingredient 3 — The Load Capacitors', C().edgeRise);
              _drawPierceSchematic(b, { highlight: 'caps' });
              _drawPhaseBudget(b, { inv: 180, xtal: 0, caps: 180 });
              b.setLabel('Caps + crystal → exactly 180° more shift, ONLY at resonance. Total: 360°. Loop closed.', C().edgeRise);
            } },

          { text: `Now power it up. The inverter's input starts as thermal noise — tiny random voltage fluctuations present in any real circuit. That noise contains every frequency, including our resonance.`,
            dur: 9000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Startup — Thermal Noise Everywhere', C().accent);
              _drawPierceSchematic(b);
              b.drawWaveform('noise', 140, 440, 720, 130,
                (t) => 0.5 + 0.05 * (Math.random() - 0.5),
                { running: true, mode: 'analog', step: 2, timePerCol: 10 });
              b.setLabel('Every real circuit has thermal noise at every frequency. That is our seed.', C().label);
            } },

          { text: `The loop amplifies. Frequencies that fail gain or phase conditions die. The one frequency that satisfies both — the crystal's resonance — reinforces on every pass. Within milliseconds it dominates.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Resonance Wins', C().accent);
              _drawPierceSchematic(b);
              b.drawWaveform('grow', 140, 440, 720, 130,
                startingSine(500, 2500), { running: true, mode: 'analog', step: 2, timePerCol: 10 });
              b.setLabel('Survival of the fittest frequency. All others lose gain each loop pass.', C().accent);
            } },

          { text: `The circuit settles into a clean, steady sine wave at exactly the crystal's natural frequency. No clock input. No battery-driven timer. A piece of rock, an inverter, two capacitors, and the laws of physics.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Self-Sustaining Oscillation', C().edgeRise);
              _drawPierceSchematic(b);
              b.drawWaveform('stable', 140, 440, 720, 130,
                sine(500), { running: true, mode: 'analog', step: 2, timePerCol: 10 });
              b.drawNode('fout', 500, 590, 'steady sine wave — crystal\u2019s resonant frequency', C().edgeRise);
              b.setLabel('Feedback, gain, phase, and one sliver of quartz. That is the whole trick.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 5 — SINE → SQUARE (failure shown first)
    // ════════════════════════════════════════════════════
    {
      id: 5,
      title: 'Sine → Square (and Noise)',
      pages: [
        { sentences: [
          { text: `The oscillator produces a smooth sine wave. But digital logic does not deal in smooth. A transistor wants a hard switch: LOW, then suddenly HIGH, with almost no time in between. So we need to convert the sine into a square.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Digital Wants Rectangular', C().accent);
              b.drawWaveform('sine', 80, 230, 380, 150,
                sine(600), { running: true, mode: 'analog', step: 3, timePerCol: 20 });
              b.drawWaveform('sq',   540, 230, 380, 150,
                square(600), { running: true, step: 3, timePerCol: 20 });
              b.drawNode('sl', 270, 400, 'what the oscillator gives us', C().label);
              b.drawNode('sr', 730, 400, 'what every logic gate needs',  C().label);
              b.setLabel('A slow slope makes transistors spend too long in their linear region. They burn power and can latch wrong.', C().label);
            } },

          { text: `The obvious approach: pick a threshold, say right in the middle. When the sine crosses above it, output 1. When it crosses below, output 0.`,
            dur: 8500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Naive Threshold — Looks Fine On A Perfect Sine', C().accent);
              b.drawWaveform('sine', 80, 230, 840, 150,
                sine(700), { running: false, mode: 'analog', step: 4, timePerCol: 14 });
              b.drawWire('thr', [[80, 305],[920, 305]], C().accent);
              b.drawNode('thr-l', 930, 305, 'threshold', C().accent);
              b.setLabel('Cross above → output 1. Cross below → output 0. Seems clean enough.', C().label);
            } },

          { text: `But real sine waves are never perfectly smooth. Thermal noise, electrical interference, other circuits switching nearby — they all add a little wobble. Near the threshold, that wobble crosses back and forth many times in a single half-cycle.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('But Real Signals Are Noisy', C().wireHot);
              b.drawWaveform('noisy', 80, 230, 840, 150,
                noisySine(700, 0.38, 0.16), { running: true, mode: 'analog', step: 3, timePerCol: 14 });
              b.drawWire('thr', [[80, 305],[920, 305]], C().accent);
              b.setLabel('Every real sine wobbles. Watch what happens when the wobble is near the threshold.', C().wireHot);
            } },

          { text: `The result is disaster. The downstream gate sees not two edges per cycle, but ten, twenty, sometimes hundreds — phantom edges, rapid-fire. Every flip-flop on the chip latches multiple times per clock period. The CPU stores garbage.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Phantom Edges → Corrupt Data', C().wireHot);
              b.drawWaveform('noisy', 80, 180, 840, 130,
                noisySine(700, 0.38, 0.16), { running: true, mode: 'analog', step: 3, timePerCol: 14 });
              b.drawWire('thr', [[80, 245],[920, 245]], C().accent);
              b.drawWaveform('bad', 80, 340, 840, 130,
                squareFromNoisy(700, 0.38, 0.16), { running: true, step: 3, timePerCol: 14 });
              b.drawNode('l1', 500, 480, 'every tiny wobble crossing the threshold becomes an edge', C().wireHot);
              b.setLabel('One naive threshold + noise = dozens of false edges. The chip cannot function.', C().wireHot);
            } },

          { text: `Here is the fix, and it is the same trick your home thermostat uses. If the AC turned on when the room hit 72 degrees and off at exactly 72, it would flicker on and off every time someone walked past. Instead, it turns ON at 75 and OFF at 70. The 5-degree gap absorbs the wobble. That gap has a name: hysteresis.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Thermostat Trick — Hysteresis', C().accent);
              b.drawBox('hot',  80,  240, 220, 90, 'turns ON at 75°F',  C().edgeRise);
              b.drawBox('cold', 700, 240, 220, 90, 'turns OFF at 70°F', C().edgeFall);
              b.drawCustom('room', (g, NS) => {
                // A squiggly room temp line that wobbles between 72 and 73
                const path = document.createElementNS(NS, 'path');
                let d = 'M 340 370';
                for (let x = 340; x <= 660; x += 8) {
                  const y = 370 + 8 * Math.sin(x * 0.2) + 6 * (Math.random() - 0.5);
                  d += ` L ${x} ${y}`;
                }
                path.setAttribute('d', d); path.setAttribute('fill', 'none');
                path.setAttribute('stroke', C().wireHi); path.setAttribute('stroke-width', '2');
                g.appendChild(path);
              });
              b.drawNode('rt', 500, 340, 'room temp wobbling around 72°F', C().wireHi);
              b.drawNode('gap', 500, 460, 'hysteresis gap = 5°F — AC never flickers', C().accent);
              b.setLabel('Two thresholds, not one. The gap swallows the noise.', C().accent);
            } },

          { text: `Apply the same trick to our gate. A Schmitt trigger is an inverter whose threshold depends on which direction the input is moving. Rising signal? Use the upper threshold. Falling signal? Use the lower threshold. Any wobble in between is ignored.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Schmitt Trigger', C().accent);
              b.drawGate('st', 'NOT', 420, 240, 120, 90);
              b.drawCustom('hyst-glyph', (g, NS) => {
                const p = document.createElementNS(NS, 'path');
                p.setAttribute('d', 'M 440 305 L 455 305 L 455 295 L 475 295 L 475 305 L 490 305');
                p.setAttribute('stroke', C().accent);
                p.setAttribute('stroke-width', '2');
                p.setAttribute('fill', 'none');
                g.appendChild(p);
              });
              b.drawWaveform('in', 80, 380, 360, 120,
                noisySine(700, 0.38, 0.14), { running: true, mode: 'analog', step: 3, timePerCol: 14 });
              b.drawWaveform('out', 560, 380, 360, 120,
                square(700), { running: true, step: 3, timePerCol: 14 });
              b.drawWire('to-st',   [[440, 440],[420, 285]], C().wireHi);
              b.drawWire('from-st', [[546, 285],[560, 440]], C().wireHi);
              b.setLabel('Two thresholds baked into one gate. The noise wobble stops producing edges.', C().accent);
            } },

          { text: `Same noisy sine, now fed through a Schmitt trigger. The phantom edges are gone. One clean rising edge per cycle. One clean falling edge per cycle. This is the square wave the digital world wants.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Same Noisy Sine — Clean Output', C().edgeRise);
              b.drawWaveform('in', 80, 210, 840, 130,
                noisySine(700, 0.38, 0.14), { running: true, mode: 'analog', step: 3, timePerCol: 14 });
              b.drawWaveform('out', 80, 380, 840, 130,
                square(700), { running: true, step: 3, timePerCol: 14 });
              b.drawNode('comp', 500, 540, 'noise still there — but only ONE edge per cycle survives', C().edgeRise);
              b.setLabel('Problem solved. We now have a crisp digital clock — ready for the next stage.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 — THE PLL (runner analogy, phase ⇒ frequency)
    // ════════════════════════════════════════════════════
    {
      id: 6,
      title: 'The Phase-Locked Loop',
      pages: [
        { sentences: [
          { text: `We have a clean digital clock. But there is one more problem. Quartz crystals only go so fast — the cheap, accurate ones top out around a few tens of megahertz. A modern CPU needs three gigahertz. We need to multiply the frequency by a hundred or more.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('25 MHz Crystal → 3 GHz CPU', C().accent);
              b.drawCrystalSymbol('xtal', 80, 230, 180, 110, '25 MHz  (all we can cheaply make)');
              b.drawBox('gap', 380, 230, 240, 110, '×120', C().edgeRise);
              b.drawNode('out', 770, 285, '3 GHz', C().edgeRise);
              b.drawWire('wa', [[270, 285],[380, 285]], C().wireHi);
              b.drawWire('wb', [[620, 285],[770, 285]], C().wireHi);
              b.setLabel('We need a circuit that multiplies a 25 MHz reference into a 3 GHz signal — and keeps the crystal\u2019s precision.', C().accent);
            } },

          { text: `The circuit that does this is called a phase-locked loop — PLL. But before the schematic, an analogy. Imagine a runner going around a track, and a coach standing at the start line with a stopwatch.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A Runner And A Coach', C().accent);
              _drawTrackAndRunner(b, { phase: 0, label: 'runner + coach with stopwatch' });
              b.setLabel('We will use this picture to explain exactly what a PLL does.', C().label);
            } },

          { text: `Every time the runner crosses the start line, the coach checks the stopwatch. If the runner arrives a little early, he is running too fast — the coach tells him to slow down. Too late? Too slow — speed up.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Compare Arrivals — Correct', C().accent);
              _drawTrackAndRunner(b, { phase: 0.25, label: 'arrived early → slow down' });
              b.setLabel('The coach does not measure speed directly. He measures ARRIVAL TIMING. That is phase.', C().accent);
            } },

          { text: `Here is the magic. The coach is not checking how fast the runner is going at any instant. He is checking when the runner crosses the line. But if the runner crosses the line at the right moment, lap after lap, then his average speed must be right. Match the arrivals and you have matched the speed — for free.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Matching Phase ⇒ Matching Frequency', C().edgeRise);
              _drawTrackAndRunner(b, { phase: 0, label: 'arrives on time every lap' });
              b.drawNode('math', 500, 560, 'identical arrivals every lap  ⇒  identical lap times  ⇒  identical speed', C().edgeRise);
              b.setLabel('This is the whole trick of a PLL. Lock the phase. Frequency comes along for the ride.', C().edgeRise);
            } },

          { text: `Now build it in electronics. A PLL has four blocks. A voltage-controlled oscillator — the VCO — that is our runner. A frequency divider that counts laps. A phase detector — the coach. And a loop filter that smooths the correction signal.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Four Blocks', C().accent);
              _drawPLLSchematic(b);
              b.drawNode('m1', 255, 240, '↑ coach',  C().label);
              b.drawNode('m2', 440, 240, '↑ smoother', C().label);
              b.drawNode('m3', 625, 240, '↑ runner', C().label);
              b.drawNode('m4', 440, 455, '↑ lap counter', C().label);
              b.setLabel('Phase detector · Loop filter · VCO · Divider. Electronic version of coach and runner.', C().accent);
            } },

          { text: `The VCO is a free-running oscillator whose frequency depends on its input voltage. Higher voltage in, faster oscillation out. This is our runner — a runner whose pace responds to instructions from the coach.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The VCO — Our Electronic Runner', C().accent);
              _drawPLLSchematic(b, { highlight: 'vco' });
              b.setLabel('A knob. Turn the voltage → turn the frequency. This one block is what gets us to GHz.', C().accent);
            } },

          { text: `The divider sits in the feedback path and counts VCO cycles. Every N cycles it outputs one pulse. So if N equals 120 and the VCO is running at three gigahertz, the divider's output is 25 megahertz — the runner's "lap signal."`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Divider — Counting Laps', C().accent);
              _drawPLLSchematic(b, { highlight: 'div' });
              b.drawNode('math', 500, 490, '3 000 000 000  ÷  120  =  25 000 000', C().accent);
              b.setLabel('One "lap" every 120 cycles. That is what the phase detector will actually compare against the crystal.', C().accent);
            } },

          { text: `The phase detector compares the divider's output — the lap pulses — against the crystal reference. If they cross the line in perfect step, the detector outputs zero. If one leads the other, the detector outputs a voltage proportional to the timing error.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Phase Detector — The Coach', C().accent);
              _drawPLLSchematic(b, { highlight: 'pd' });
              b.drawNode('dp1', 250, 470, 'two pulse streams in', C().label);
              b.drawNode('dp2', 250, 495, 'error voltage out',    C().label);
              b.setLabel('Aligned pulses → 0 V. One early → positive. One late → negative. Simple and elegant.', C().accent);
            } },

          { text: `The loop filter smooths that error voltage — averages out the noise — and feeds it to the VCO's control input. Runner arriving too early? VCO voltage drops, runner slows. Too late? Voltage rises, runner speeds up.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Loop Filter — Smooth, Then Correct', C().accent);
              _drawPLLSchematic(b, { highlight: 'all' });
              b.setLabel('Negative feedback. Error pushes the VCO the right way, self-correcting toward lock.', C().accent);
            } },

          { text: `Within a few milliseconds the whole loop locks. The divided VCO output is now phase-aligned with the crystal reference. And because divide-by-120 sat in the feedback path, the VCO itself must now be running at exactly 120 times the crystal's frequency. Crystal precision, CPU speed.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Locked — Crystal Precision × 120', C().edgeRise);
              _drawPLLSchematic(b);
              b.drawWaveform('cpu-clk', 140, 500, 720, 100,
                squareFast, { running: true, step: 2, timePerCol: 6 });
              b.drawNode('lbl', 500, 610, '3 GHz to the CPU — as precise as the original crystal', C().edgeRise);
              b.setLabel('One 25 MHz crystal. One PLL. A stable 3 GHz clock for the whole chip.', C().edgeRise);
            } },

          { text: `And because the divider is programmable, the PLL can be retuned on the fly. Change the divide ratio and the CPU's clock frequency changes. That is how your phone dials its speed up and down in milliseconds to save battery.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Programmable Divider = Adjustable Clock', C().accent);
              _drawPLLSchematic(b, { highlight: 'div' });
              b.drawNode('low',  260, 500, '÷ 40  → 1 GHz  (battery saver)', C().label);
              b.drawNode('mid',  500, 500, '÷ 80  → 2 GHz  (normal)',        C().accent);
              b.drawNode('high', 740, 500, '÷ 120 → 3 GHz  (turbo)',         C().edgeRise);
              b.setLabel('Same crystal, same PLL, different N. A whole menu of CPU speeds.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 7 — THE CLOCK TREE (with light-speed bound)
    // ════════════════════════════════════════════════════
    {
      id: 7,
      title: 'The Clock Tree',
      pages: [
        { sentences: [
          { text: `We have a clean, fast, precise clock signal. But it exists on one wire. A modern CPU has hundreds of millions of flip-flops, spread across a piece of silicon the size of a thumbnail. Every single one of them must receive this clock edge at almost exactly the same instant.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Millions of Destinations, One Edge', C().accent);
              b.drawChipOutline('die', 150, 130, 700, 420, 'CPU DIE — ~ 2 cm across');
              b.drawCustom('ffs', (g, NS) => {
                for (let i = 0; i < 200; i++) {
                  const c = document.createElementNS(NS, 'circle');
                  const cx = 170 + Math.random() * 660;
                  const cy = 160 + Math.random() * 370;
                  c.setAttribute('cx', cx); c.setAttribute('cy', cy);
                  c.setAttribute('r', 1.5);
                  c.setAttribute('fill', C().label);
                  g.appendChild(c);
                }
              });
              b.setLabel('Every dot is a flip-flop. All must see the same rising edge, at effectively the same moment.', C().label);
            } },

          { text: `If one flip-flop latches even a nanosecond late, its neighbour's output has already updated, and the late flip-flop grabs the wrong value. Data in motion gets corrupted. The pipeline fails. The chip crashes.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Skew → Corruption', C().wireHot);
              b.drawBox('ffA', 180, 280, 160, 90, 'FF A (on time)',  C().edgeRise);
              b.drawBox('ffB', 560, 280, 160, 90, 'FF B (late)',     C().wireHot);
              b.drawWire('ab', [[340, 325],[560, 325]], C().wireHi);
              b.drawNode('dat', 450, 300, 'data already changed', C().wireHot);
              b.drawNode('bug', 500, 470, 'FF B latches stale or wrong value → entire computation corrupted', C().wireHot);
              b.setLabel('A single nanosecond of skew can sink a 3 GHz CPU — each cycle is only 333 ps long.', C().wireHot);
            } },

          { text: `We cannot just run a wire from the PLL to every flip-flop. The wire lengths would all be different. Every flip-flop would see a slightly different arrival time. Total chaos.`,
            dur: 9000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Naive Distribution — Different Path Lengths', C().wireHot);
              b.drawChipOutline('die', 150, 130, 700, 420, 'CPU DIE');
              b.drawNode('src', 160, 540, 'PLL', C().accent);
              b.drawWire('s1', [[160, 540],[260, 400],[330, 250]], C().wireHot);
              b.drawWire('s2', [[160, 540],[400, 540],[460, 500],[580, 340]], C().wireHot);
              b.drawWire('s3', [[160, 540],[500, 540],[700, 540],[760, 420],[790, 200]], C().wireHot);
              b.setLabel('Short wire, medium wire, long wire → short delay, medium delay, long delay. Skew.', C().wireHot);
            } },

          { text: `Instead, the signal is distributed through a balanced network called the clock tree. At the top, one H shape. In each leg of that H, another smaller H. And another. The pattern repeats, recursively, until every flip-flop has its own leaf.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The H-Tree', C().accent);
              b.drawChipOutline('die', 150, 130, 700, 420, 'CPU DIE');
              b.drawHTree('htree', 500, 340, 320, 3, C().wireHi);
              b.setLabel('H inside H inside H. Symmetric by construction.', C().accent);
            } },

          { text: `The magic of the H-tree is that every path from root to leaf traverses the same number of segments, of the same length. So no matter which flip-flop you care about, the clock edge takes exactly the same amount of time to arrive.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Equal Paths → Equal Arrivals', C().edgeRise);
              b.drawChipOutline('die', 150, 130, 700, 420, 'CPU DIE');
              b.drawHTree('htree', 500, 340, 320, 3, C().wireHi);
              b.drawNode('root', 500, 340, 'PLL', C().accent);
              b.setLabel('Geometry, not software. The skew problem is solved by drawing the right shape.', C().edgeRise);
            } },

          { text: `In practice there are buffers at every branch point — tiny amplifiers that re-sharpen the edge as it propagates. Wires add capacitance. They slow the edge. Without hundreds of buffers, by the time the clock reached the far corners of the die it would be a rounded mush.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Buffered At Every Branch', C().accent);
              b.drawChipOutline('die', 150, 130, 700, 420, 'CPU DIE');
              b.drawHTree('htree', 500, 340, 320, 3, C().wireHi);
              b.setLabel('Buffers re-sharpen the edge. Without them the signal rounds off as it travels.', C().accent);
            } },

          { text: `How good can distribution get? Think about this. Light travels just 0.3 millimetres in one picosecond. A modern CPU die is about 20 millimetres across. So even if the clock moved at the speed of light, getting it across the chip would take around seventy picoseconds. You literally cannot do better than that. Clock-tree designers spend their careers fighting this bound.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Speed-Of-Light Bound', C().wireHot);
              b.drawChipOutline('die', 150, 200, 700, 200, 'CPU DIE — 20 mm');
              b.drawCustom('ruler', (g, NS) => {
                const line = document.createElementNS(NS, 'line');
                line.setAttribute('x1', 150); line.setAttribute('x2', 850);
                line.setAttribute('y1', 430); line.setAttribute('y2', 430);
                line.setAttribute('stroke', C().accent); line.setAttribute('stroke-width', '2');
                g.appendChild(line);
                [0, 5, 10, 15, 20].forEach(mm => {
                  const x = 150 + (mm / 20) * 700;
                  const tick = document.createElementNS(NS, 'line');
                  tick.setAttribute('x1', x); tick.setAttribute('x2', x);
                  tick.setAttribute('y1', 425); tick.setAttribute('y2', 440);
                  tick.setAttribute('stroke', C().accent); tick.setAttribute('stroke-width', '2');
                  g.appendChild(tick);
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', x); t.setAttribute('y', 458);
                  t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '11'); t.setAttribute('fill', C().label);
                  t.textContent = mm + ' mm'; g.appendChild(t);
                });
              });
              b.drawNode('c',    500, 500, '1 picosecond = light travels 0.3 mm', C().edgeRise);
              b.drawNode('best', 500, 525, 'so 20 mm → at best 67 ps, ever', C().wireHot);
              b.setLabel('A physical wall. You cannot engineer around the speed of light.', C().wireHot);
            } },

          { text: `Today the best clock trees achieve skew — the difference in arrival time between any two flip-flops on the chip — of just a few tens of picoseconds. That is how three billion edges per second reliably reach hundreds of millions of destinations, and your CPU actually works.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Real Numbers', C().edgeRise);
              b.drawChipOutline('die', 150, 130, 700, 420, 'modern CPU die');
              b.drawHTree('htree', 500, 340, 320, 3, C().wireHi);
              b.drawNode('numb', 500, 570, 'skew across the entire die: ~ 20–50 ps', C().edgeRise);
              b.setLabel('A billion flip-flops. Edges aligned to within 30 trillionths of a second. Every single clock cycle.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 8 — RECAP: the trust chain
    // ════════════════════════════════════════════════════
    {
      id: 8,
      title: 'Recap — The Trust Chain',
      pages: [
        { sentences: [
          { text: `Let us trace what you just saw. A sliver of quartz, cut to a precise shape. Its atomic lattice has a resonant frequency fixed by physics — not by any circuit, not by any software.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 1 — Physics', C().accent);
              b.drawCrystalSymbol('xtal', 380, 260, 240, 140, 'quartz — resonance');
              b.drawNode('src', 500, 440, 'frequency comes from the crystal\u2019s shape', C().accent);
              b.setLabel('Everything that follows inherits this precision.', C().accent);
            } },

          { text: `An inverter and two capacitors wrap that crystal in a feedback loop. At the one frequency where gain and phase both line up, a self-sustaining oscillation appears. A smooth sine wave — no external input, no battery, just physics closing a loop.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 2 — Feedback Oscillator', C().accent);
              _drawPierceSchematic(b);
              b.drawWaveform('osc', 140, 440, 720, 130,
                sine(500), { running: true, mode: 'analog', step: 2, timePerCol: 10 });
              b.setLabel('Crystal + inverter + 2 caps = self-sustaining sine at the resonant frequency.', C().accent);
            } },

          { text: `A Schmitt trigger squares off the sine wave. Its two thresholds — hysteresis, the thermostat trick — reject the noise that would otherwise produce phantom edges. The signal is now digital, crisp, ready to be used.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 3 — Sine To Clean Square', C().accent);
              b.drawWaveform('sine', 80, 230, 360, 140,
                sine(600), { running: true, mode: 'analog', step: 3, timePerCol: 20 });
              b.drawGate('st', 'NOT', 460, 280, 80, 50);
              b.drawWaveform('sq', 570, 230, 360, 140,
                square(600), { running: true, step: 3, timePerCol: 20 });
              b.drawWire('a', [[440, 300],[460, 300]], C().wireHi);
              b.drawWire('c', [[546, 300],[570, 300]], C().wireHi);
              b.setLabel('Two thresholds reject noise. One edge per rising cycle. One edge per falling cycle.', C().accent);
            } },

          { text: `A phase-locked loop multiplies the frequency. A fast VCO, divided in the feedback path, compared phase-wise to the crystal reference. By locking phase, the loop forces the VCO to run at exactly N times the crystal frequency — inheriting the crystal's precision at GHz speeds.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 4 — Phase-Locked Loop', C().accent);
              _drawPLLSchematic(b);
              b.drawWaveform('ghz', 140, 500, 720, 100, squareFast, { running: true, step: 2, timePerCol: 6 });
              b.setLabel('Phase locked = frequency locked. Crystal precision × N.', C().accent);
            } },

          { text: `A balanced H-tree of buffers distributes that signal to every flip-flop on the chip. Equal path lengths. Equal arrival times. Skew of a few tens of picoseconds across a whole die, governed in the end by the speed of light itself.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 5 — Clock Tree', C().accent);
              b.drawChipOutline('die', 150, 130, 700, 420, 'CPU DIE');
              b.drawHTree('htree', 500, 340, 320, 3, C().wireHi);
              b.setLabel('Physics again — the speed of light is the final limit on how tight this can get.', C().accent);
            } },

          { text: `That is how the clock is built. Crystal. Oscillator. Schmitt. PLL. Tree. Five ideas — each solving one physical problem — stacked together to produce a heartbeat that keeps time better than any clock humanity had before 1950, and yet sits on a piece of silicon smaller than your thumbnail.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Five Ideas. One Heartbeat.', C().edgeRise);
              b.drawCrystalSymbol('xtal', 60, 260, 140, 90, 'crystal');
              b.drawGate('inv', 'NOT', 230, 270, 100, 70);
              b.drawGate('sch', 'NOT', 390, 270, 100, 70);
              b.drawBox('pll',  550, 260, 140, 90, 'PLL', C().edgeRise);
              b.drawHTree('tree', 820, 305, 80, 2, C().wireHi);
              b.drawWire('a', [[200, 305],[230, 305]], C().wireHi);
              b.drawWire('b', [[336, 305],[390, 305]], C().wireHi);
              b.drawWire('c', [[496, 305],[550, 305]], C().wireHi);
              b.drawWire('d', [[690, 305],[760, 305]], C().wireHi);
              b.drawNode('n1', 130, 370, 'resonate',    C().label);
              b.drawNode('n2', 280, 360, 'amplify',     C().label);
              b.drawNode('n3', 440, 360, 'square',      C().label);
              b.drawNode('n4', 620, 370, 'multiply',    C().label);
              b.drawNode('n5', 820, 380, 'distribute',  C().label);
              b.setLabel('Crystal → Oscillator → Schmitt → PLL → Tree. That is the clock.', C().edgeRise);
            } },

          { text: `Next episode, we take one of those three billion edges per second — just one — and use it to store a single bit. The simplest memory in the CPU. The flip-flop.`,
            dur: 9000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Next: The Flip-Flop', C().accent);
              b.drawWaveform('clk', 80, 220, 340, 110, square(700), { running: true, step: 4, timePerCol: 40 });
              b.drawWire('arrow', [[420, 275],[500, 275]], C().wireHi);
              b.drawBox('ff', 500, 220, 340, 170, 'FLIP-FLOP', C().edgeRise);
              b.setLabel('One edge → one stored bit. We will build it from scratch.', C().accent);
            } },
        ] },
      ],
      showAll: true,
      isFinal: true,
    },
  ];

  // ─────────────────────────────────────────
  //  Shared schematic helpers
  // ─────────────────────────────────────────

  function _drawPierceSchematic(b, opts) {
    opts = opts || {};
    const hl = opts.highlight;
    const colCaps = hl === 'caps' ? C().edgeRise : C().wireLo;

    b.drawGate('inv', 'NOT', 430, 220, 140, 100);
    if (hl === 'inv') b.setState('inv', 'glow');

    b.drawCrystalSymbol('xtal', 370, 100, 260, 90, 'X1');
    if (hl === 'fb' || hl === 'xtal') b.setState('xtal', 'glow');

    b.drawWire('w-in',  [[370, 145],[300, 145],[300, 270],[430, 270]],
      hl === 'fb' ? C().edgeRise : C().wireLo);
    b.drawWire('w-out', [[582, 270],[700, 270],[700, 145],[630, 145]],
      hl === 'fb' ? C().edgeRise : C().wireLo);

    b.drawCapacitor('c1', 280, 320, 40, 56, 'v', 'C1');
    b.drawWire('w-c1',  [[300, 270],[300, 320]], colCaps);
    b.drawWire('w-c1g', [[300, 376],[300, 410]], colCaps);
    b.drawGround('gnd1', 300, 420);
    if (hl === 'caps') b.setState('c1', 'glow');

    b.drawCapacitor('c2', 680, 320, 40, 56, 'v', 'C2');
    b.drawWire('w-c2',  [[700, 270],[700, 320]], colCaps);
    b.drawWire('w-c2g', [[700, 376],[700, 410]], colCaps);
    b.drawGround('gnd2', 700, 420);
    if (hl === 'caps') b.setState('c2', 'glow');

    b.drawNode('lbl-in',  265, 255, 'input',  C().label);
    b.drawNode('lbl-out', 715, 255, 'output', C().label);
  }

  function _drawPLLSchematic(b, opts) {
    opts = opts || {};
    const hl = opts.highlight;

    b.drawNode('ref', 60,  290, 'crystal 25 MHz', C().accent);

    const colPd = (hl === 'pd' || hl === 'all') ? C().edgeRise : C().gateEdge;
    b.drawBox('pd', 180, 260, 150, 80, 'Phase Detector', colPd);
    if (hl === 'pd' || hl === 'all') b.setState('pd', 'glow');

    const colLf = (hl === 'lf' || hl === 'all') ? C().edgeRise : C().gateEdge;
    b.drawBox('lf', 380, 260, 130, 80, 'Loop Filter', colLf);
    if (hl === 'lf' || hl === 'all') b.setState('lf', 'glow');

    const colVco = (hl === 'vco' || hl === 'all') ? C().edgeRise : C().gateEdge;
    b.drawBox('vco', 560, 260, 130, 80, 'VCO', colVco);
    if (hl === 'vco' || hl === 'all') b.setState('vco', 'glow');

    b.drawNode('out', 820, 300, '→ 3 GHz to CPU', C().edgeRise);

    const colDiv = (hl === 'div' || hl === 'all') ? C().edgeRise : C().gateEdge;
    b.drawBox('div', 395, 390, 110, 60, '÷ 120', colDiv);
    if (hl === 'div' || hl === 'all') b.setState('div', 'glow');

    b.drawWire('w1', [[80,  300],[180, 300]], C().wireHi);
    b.drawWire('w2', [[330, 300],[380, 300]], C().wireHi);
    b.drawWire('w3', [[510, 300],[560, 300]], C().wireHi);
    b.drawWire('w4', [[690, 300],[820, 300]], C().wireHi);
    b.drawWire('wfb1', [[750, 300],[750, 420],[505, 420]], C().wireLo);
    b.drawWire('wfb2', [[395, 420],[260, 420],[260, 340]], C().wireLo);
  }

  // Phase budget meter — shows how much phase shift each part contributes.
  function _drawPhaseBudget(b, parts, failed) {
    const total = (parts.inv || 0) + (parts.xtal || 0) + (parts.caps || 0);
    const segments = [
      { w: parts.inv  || 0, label: 'inverter',        color: total >= 360 ? C().edgeRise : C().accent },
      { w: parts.xtal || 0, label: 'crystal',         color: total >= 360 ? C().edgeRise : C().accent },
      { w: parts.caps || 0, label: 'crystal + caps',  color: total >= 360 ? C().edgeRise : C().accent },
    ];
    b.drawCustom('budget', (g, NS, COL) => {
      const x0 = 120, y0 = 450, barW = 760, barH = 32;
      // Backing
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', x0); bg.setAttribute('y', y0);
      bg.setAttribute('width', barW); bg.setAttribute('height', barH);
      bg.setAttribute('rx', 3);
      bg.setAttribute('fill', COL.panel);
      bg.setAttribute('stroke', failed ? COL.wireHot : COL.gateEdge);
      bg.setAttribute('stroke-width', '1.5');
      g.appendChild(bg);
      let cursor = x0;
      segments.forEach((s) => {
        if (s.w <= 0) return;
        const pxw = (s.w / 360) * barW;
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', cursor); r.setAttribute('y', y0);
        r.setAttribute('width', pxw); r.setAttribute('height', barH);
        r.setAttribute('fill', s.color); r.setAttribute('opacity', '0.35');
        g.appendChild(r);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', cursor + pxw / 2); t.setAttribute('y', y0 + 21);
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '11'); t.setAttribute('font-weight', '700');
        t.setAttribute('fill', COL.textPrimary || '#e8f0f8');
        t.textContent = `${s.label}  ${s.w}°`; g.appendChild(t);
        cursor += pxw;
      });
      // Labels
      const totalT = document.createElementNS(NS, 'text');
      totalT.setAttribute('x', x0 + barW / 2); totalT.setAttribute('y', y0 - 10);
      totalT.setAttribute('text-anchor', 'middle'); totalT.setAttribute('font-family', 'monospace');
      totalT.setAttribute('font-size', '13'); totalT.setAttribute('font-weight', '700');
      totalT.setAttribute('fill', total === 360 ? COL.edgeRise : (failed ? COL.wireHot : COL.accent));
      totalT.textContent = `phase budget: ${total}° / 360°${total === 360 ? '  ✓' : ''}`;
      g.appendChild(totalT);
      // Goal tick at 360
      const goal = document.createElementNS(NS, 'text');
      goal.setAttribute('x', x0 + barW + 6); goal.setAttribute('y', y0 + 21);
      goal.setAttribute('font-family', 'monospace'); goal.setAttribute('font-size', '12');
      goal.setAttribute('fill', COL.edgeRise);
      goal.textContent = '360°';
      g.appendChild(goal);
    });
  }

  // Stick-figure swing — actually swings. opts:
  //   amplitude: peak angle in radians (0..~1.0)
  //   periodMs:  full period of the swing motion
  //   chaos:     random jitter added to the angle (fraction of amplitude)
  function _drawSwing(b, opts) {
    const maxAmp   = Math.max(0, Math.min(1.1, (opts && opts.amplitude) || 0.7));
    const periodMs = (opts && opts.periodMs) || 2200;
    const chaos    = (opts && opts.chaos)    || 0;
    const label    = opts && opts.label;
    let ropeEl, seatEl, pivotX, pivotY, len;
    b.drawCustom('swing', (g, NS, COL) => {
      const top = 180;
      pivotX = 500; pivotY = top + 40; len = 220;
      // Crossbar
      const bar = document.createElementNS(NS, 'line');
      bar.setAttribute('x1', 300); bar.setAttribute('x2', 700);
      bar.setAttribute('y1', top); bar.setAttribute('y2', top);
      bar.setAttribute('stroke', COL.gateEdge); bar.setAttribute('stroke-width', '4');
      g.appendChild(bar);
      // Legs
      const legL = document.createElementNS(NS, 'line');
      legL.setAttribute('x1', 300); legL.setAttribute('x2', 250);
      legL.setAttribute('y1', top); legL.setAttribute('y2', top + 260);
      legL.setAttribute('stroke', COL.gateEdge); legL.setAttribute('stroke-width', '3');
      g.appendChild(legL);
      const legR = document.createElementNS(NS, 'line');
      legR.setAttribute('x1', 700); legR.setAttribute('x2', 750);
      legR.setAttribute('y1', top); legR.setAttribute('y2', top + 260);
      legR.setAttribute('stroke', COL.gateEdge); legR.setAttribute('stroke-width', '3');
      g.appendChild(legR);
      // Arc (path of motion)
      const leftX  = pivotX + len * Math.sin(-maxAmp);
      const leftY  = pivotY + len * Math.cos(-maxAmp);
      const rightX = pivotX + len * Math.sin( maxAmp);
      const rightY = pivotY + len * Math.cos( maxAmp);
      const arc = document.createElementNS(NS, 'path');
      arc.setAttribute('d', `M ${leftX} ${leftY} A ${len} ${len} 0 0 1 ${rightX} ${rightY}`);
      arc.setAttribute('stroke', COL.gateEdge); arc.setAttribute('stroke-width', '1');
      arc.setAttribute('stroke-dasharray', '4,4'); arc.setAttribute('fill', 'none');
      g.appendChild(arc);
      // Rope (animated)
      ropeEl = document.createElementNS(NS, 'line');
      ropeEl.setAttribute('x1', pivotX); ropeEl.setAttribute('y1', pivotY);
      ropeEl.setAttribute('x2', pivotX); ropeEl.setAttribute('y2', pivotY + len);
      ropeEl.setAttribute('stroke', COL.wireHi); ropeEl.setAttribute('stroke-width', '2');
      g.appendChild(ropeEl);
      // Seat (animated)
      seatEl = document.createElementNS(NS, 'rect');
      seatEl.setAttribute('x', pivotX - 28); seatEl.setAttribute('y', pivotY + len);
      seatEl.setAttribute('width', 56); seatEl.setAttribute('height', 8);
      seatEl.setAttribute('fill', COL.edgeRise);
      g.appendChild(seatEl);
      if (label) {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', 500); t.setAttribute('y', 510);
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '13'); t.setAttribute('fill', COL.accent);
        t.textContent = label; g.appendChild(t);
      }
    });
    // Real swinging motion on every RAF tick.
    b.animate('swing', (tMs) => {
      if (!ropeEl || !seatEl) return;
      const base  = maxAmp * Math.sin(2 * Math.PI * tMs / periodMs);
      const jitter = chaos ? chaos * (Math.random() - 0.5) * maxAmp : 0;
      const angle = base + jitter;
      const sx = pivotX + len * Math.sin(angle);
      const sy = pivotY + len * Math.cos(angle);
      ropeEl.setAttribute('x2', sx);
      ropeEl.setAttribute('y2', sy);
      seatEl.setAttribute('x', sx - 28);
      seatEl.setAttribute('y', sy);
    });
  }

  // Atomic lattice — animated grid of dots that actually vibrate.
  //   vibrating: true | false | 'squeeze'  (squeeze = periodic horizontal compression)
  function _drawLattice(b, x, y, cols, rows, spacing, vibrating) {
    const dots = [];
    b.drawCustom('lattice', (g, NS, COL) => {
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const even = (i + j) % 2 === 0;
          const bx = x + i * spacing;
          const by = y + j * spacing;
          const c = document.createElementNS(NS, 'circle');
          c.setAttribute('cx', bx); c.setAttribute('cy', by);
          c.setAttribute('r', even ? 6 : 4);
          c.setAttribute('fill', even ? COL.accent : COL.edgeRise);
          c.setAttribute('stroke', '#000'); c.setAttribute('stroke-width', '0.5');
          g.appendChild(c);
          dots.push({ el: c, bx, by, phase: Math.random() * Math.PI * 2, col: i, row: j });
        }
      }
      // Legend
      const lab = document.createElementNS(NS, 'text');
      lab.setAttribute('x', x + cols * spacing + 10); lab.setAttribute('y', y + 8);
      lab.setAttribute('font-family', 'monospace'); lab.setAttribute('font-size', '12');
      lab.setAttribute('fill', COL.accent); lab.textContent = '● Si';
      g.appendChild(lab);
      const lab2 = document.createElementNS(NS, 'text');
      lab2.setAttribute('x', x + cols * spacing + 10); lab2.setAttribute('y', y + 28);
      lab2.setAttribute('font-family', 'monospace'); lab2.setAttribute('font-size', '12');
      lab2.setAttribute('fill', COL.edgeRise); lab2.textContent = '● O';
      g.appendChild(lab2);
    });

    if (!vibrating) return;

    if (vibrating === 'squeeze') {
      // Periodic horizontal compression — atoms move toward the centre, then relax.
      const cx = x + (cols - 1) * spacing / 2;
      const cy = y + (rows - 1) * spacing / 2;
      b.animate('lattice', (tMs) => {
        const squeeze = 0.22 * Math.sin(2 * Math.PI * tMs / 1800);
        dots.forEach(d => {
          const dx = (d.bx - cx) * squeeze;
          const dy = (d.by - cy) * squeeze * 0.3;
          d.el.setAttribute('cx', d.bx - dx);
          d.el.setAttribute('cy', d.by - dy);
        });
      });
      return;
    }

    // Free vibration — each atom jitters around its base position at a fast,
    // slightly-phase-varied oscillation. This reads as a humming lattice.
    const amp  = 2.5;                 // pixels
    const freq = 3.5;                 // Hz (visible — real quartz is ~10^7)
    const w = 2 * Math.PI * freq / 1000;
    b.animate('lattice', (tMs) => {
      dots.forEach(d => {
        const dx = amp * Math.sin(w * tMs + d.phase);
        const dy = amp * Math.cos(w * tMs * 1.1 + d.phase * 1.3);
        d.el.setAttribute('cx', d.bx + dx);
        d.el.setAttribute('cy', d.by + dy);
      });
    });
  }

  // Animate a crystal symbol so it visibly flexes horizontally.
  //   amp:      fractional horizontal scale (e.g. 0.03 = ±3%)
  //   periodMs: full flex period
  function _animateCrystalFlex(b, id, amp, periodMs) {
    b.animate(id, (tMs, rec) => {
      const meta = rec.meta || {};
      const { x = 0, y = 0, w = 0 } = meta;
      const s = 1 + amp * Math.sin(2 * Math.PI * tMs / periodMs);
      // Scale around the crystal's horizontal centre.
      rec.el.setAttribute('transform',
        `translate(${x + w/2},${y}) scale(${s},1) translate(${-w/2},0)`);
    });
  }

  // Microphone feedback — stick-figure-y mic + speaker + amp.
  function _drawMicFeedback(b) {
    b.drawCustom('mic', (g, NS, COL) => {
      // Mic (circle + stand)
      const micC = document.createElementNS(NS, 'circle');
      micC.setAttribute('cx', 180); micC.setAttribute('cy', 260);
      micC.setAttribute('r', 24);
      micC.setAttribute('fill', COL.panel); micC.setAttribute('stroke', COL.gateEdge);
      micC.setAttribute('stroke-width', '2');
      g.appendChild(micC);
      const micL = document.createElementNS(NS, 'text');
      micL.setAttribute('x', 180); micL.setAttribute('y', 265);
      micL.setAttribute('text-anchor', 'middle'); micL.setAttribute('font-family', 'monospace');
      micL.setAttribute('font-size', '11'); micL.setAttribute('fill', COL.accent);
      micL.textContent = 'MIC'; g.appendChild(micL);
      const micLabel = document.createElementNS(NS, 'text');
      micLabel.setAttribute('x', 180); micLabel.setAttribute('y', 310);
      micLabel.setAttribute('text-anchor', 'middle'); micLabel.setAttribute('font-family', 'monospace');
      micLabel.setAttribute('font-size', '11'); micLabel.setAttribute('fill', COL.label);
      micLabel.textContent = 'input'; g.appendChild(micLabel);
    });

    b.drawGate('amp', 'NOT', 370, 230, 140, 70);
    b.drawNode('amp-l', 440, 220, 'amplifier', C().accent);

    b.drawCustom('spk', (g, NS, COL) => {
      // Speaker (trapezoid-ish)
      const spk = document.createElementNS(NS, 'path');
      spk.setAttribute('d', 'M 680 230 L 720 220 L 740 200 L 740 320 L 720 300 L 680 290 Z');
      spk.setAttribute('fill', COL.panel); spk.setAttribute('stroke', COL.gateEdge);
      spk.setAttribute('stroke-width', '2');
      g.appendChild(spk);
      const spkL = document.createElementNS(NS, 'text');
      spkL.setAttribute('x', 770); spkL.setAttribute('y', 265);
      spkL.setAttribute('font-family', 'monospace'); spkL.setAttribute('font-size', '11');
      spkL.setAttribute('fill', COL.accent);
      spkL.textContent = 'SPEAKER'; g.appendChild(spkL);
    });

    // Wires
    b.drawWire('w-mic-amp', [[210, 260],[370, 260]], C().wireHi);
    b.drawWire('w-amp-spk', [[512, 260],[680, 260]], C().wireHi);
    // Feedback air-path loop (from speaker back to mic)
    b.drawWire('w-air', [[700, 310],[700, 390],[180, 390],[180, 285]], C().wireHot);
    b.drawNode('air-l', 500, 410, 'sound travels back through the air to the mic', C().wireHot);
  }

  // Runner on a circular track (top-down).
  function _drawTrackAndRunner(b, opts) {
    const phase = (opts && opts.phase) || 0;  // 0..1 around the loop
    const label = opts && opts.label;
    b.drawCustom('track', (g, NS, COL) => {
      // Outer and inner ovals
      const outer = document.createElementNS(NS, 'ellipse');
      outer.setAttribute('cx', 500); outer.setAttribute('cy', 320);
      outer.setAttribute('rx', 220); outer.setAttribute('ry', 140);
      outer.setAttribute('fill', 'none'); outer.setAttribute('stroke', COL.gateEdge);
      outer.setAttribute('stroke-width', '2');
      g.appendChild(outer);
      const inner = document.createElementNS(NS, 'ellipse');
      inner.setAttribute('cx', 500); inner.setAttribute('cy', 320);
      inner.setAttribute('rx', 180); inner.setAttribute('ry', 100);
      inner.setAttribute('fill', 'none'); inner.setAttribute('stroke', COL.gateEdge);
      inner.setAttribute('stroke-width', '2');
      g.appendChild(inner);
      // Start line
      const sl = document.createElementNS(NS, 'line');
      sl.setAttribute('x1', 500); sl.setAttribute('x2', 500);
      sl.setAttribute('y1', 180); sl.setAttribute('y2', 220);
      sl.setAttribute('stroke', COL.edgeRise); sl.setAttribute('stroke-width', '3');
      g.appendChild(sl);
      // Coach with stopwatch at the start line
      const coach = document.createElementNS(NS, 'circle');
      coach.setAttribute('cx', 460); coach.setAttribute('cy', 170);
      coach.setAttribute('r', 12);
      coach.setAttribute('fill', COL.accent);
      g.appendChild(coach);
      const coachL = document.createElementNS(NS, 'text');
      coachL.setAttribute('x', 430); coachL.setAttribute('y', 150);
      coachL.setAttribute('text-anchor', 'end'); coachL.setAttribute('font-family', 'monospace');
      coachL.setAttribute('font-size', '12'); coachL.setAttribute('fill', COL.accent);
      coachL.textContent = 'coach + stopwatch'; g.appendChild(coachL);
      // Runner position — phase in [0,1]
      const theta = -Math.PI / 2 + phase * 2 * Math.PI;
      const rx = 200, ry = 120;
      const runX = 500 + rx * Math.cos(theta);
      const runY = 320 + ry * Math.sin(theta);
      const run = document.createElementNS(NS, 'circle');
      run.setAttribute('cx', runX); run.setAttribute('cy', runY);
      run.setAttribute('r', 10);
      run.setAttribute('fill', COL.edgeRise);
      g.appendChild(run);
      const runL = document.createElementNS(NS, 'text');
      runL.setAttribute('x', runX + 14); runL.setAttribute('y', runY + 4);
      runL.setAttribute('font-family', 'monospace'); runL.setAttribute('font-size', '11');
      runL.setAttribute('fill', COL.edgeRise); runL.textContent = 'runner (VCO)';
      g.appendChild(runL);
      if (label) {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', 500); t.setAttribute('y', 500);
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '13'); t.setAttribute('fill', COL.accent);
        t.textContent = label; g.appendChild(t);
      }
    });
  }

  if (typeof window !== 'undefined') {
    window.BLOCKS_01_SCENES = BLOCKS_01_SCENES;
  }
})();
