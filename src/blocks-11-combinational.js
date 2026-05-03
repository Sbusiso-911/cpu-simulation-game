/**
 * Series B — Episode 11: Combinational Logic — The Hidden Split
 * --------------------------------------------------------------
 * Classroom-voice rewrite.  Every concept is unpacked deliberately,
 * anticipated beginner questions are voiced and answered, and each idea
 * is said a few different ways before the lesson moves on.  Longer than
 * a typical episode on purpose — we're teaching a foundational concept,
 * not lecturing it.
 */

(function () {
  'use strict';

  const B = () => window.Blocks;
  const C = () => window.Blocks && window.Blocks.COL;

  // Sampler factories
  const square = (periodMs) => (t) => {
    if (t < 0) return 0;
    return (Math.floor(t / (periodMs / 2)) % 2) ? 1 : 0;
  };
  const andOf = (aP, bP) => (t) => (square(aP)(t) && square(bP)(t)) ? 1 : 0;
  // D flip-flop Q — captures D only on clock rising edges (simulated).
  const ffQ = (dSampler, clkP) => {
    const stepMs = 30;
    return (t) => {
      if (t < 0) return 0;
      let q = 0;
      let prevClk = 0;
      for (let tt = 0; tt <= t; tt += stepMs) {
        const clk = square(clkP)(tt);
        if (clk === 1 && prevClk === 0) q = dSampler(tt);
        prevClk = clk;
      }
      return q;
    };
  };

  // Re-used stage for Scene 2 (AND gate live demo).
  function _stageAND(b, opts) {
    opts = opts || {};
    const aP = 420, bP = 720;
    b.drawGate('and', 'AND', 420, 260, 140, 100);
    b.drawWaveform('wA', 60, 200, 330, 60, square(aP),
      { running: true, step: 3, timePerCol: 18 });
    b.drawNode('lA', 30, 230, 'A', C().wireHi);
    b.drawWaveform('wB', 60, 390, 330, 60, square(bP),
      { running: true, step: 3, timePerCol: 18 });
    b.drawNode('lB', 30, 420, 'B', C().wireHi);
    b.drawWaveform('wY', 600, 290, 340, 60, andOf(aP, bP),
      { running: true, step: 3, timePerCol: 18 });
    b.drawNode('lY', 960, 320, 'Y', C().edgeRise);
    b.drawWire('wa-g', [[390, 230],[420, 285]], C().wireHi);
    b.drawWire('wb-g', [[390, 420],[420, 335]], C().wireHi);
    b.drawWire('wy-g', [[562, 310],[600, 310]], C().edgeRise);
  }

  // Re-used stage for Scene 3 (D flip-flop live demo).
  function _stageFF(b) {
    const dP = 500, clkP = 1400;
    b.drawBox('ff', 380, 260, 240, 140, 'D FLIP-FLOP', C().edgeRise);
    b.drawWaveform('wD', 60, 200, 240, 60, square(dP),
      { running: true, step: 3, timePerCol: 18 });
    b.drawNode('lD', 30, 230, 'D', C().wireHi);
    b.drawWaveform('wC', 60, 390, 240, 60, square(clkP),
      { running: true, step: 3, timePerCol: 18 });
    b.drawNode('lC', 30, 420, 'CLK', C().accent);
    b.drawWaveform('wQ', 680, 290, 240, 60,
      ffQ(square(dP), clkP),
      { running: true, step: 3, timePerCol: 18 });
    b.drawNode('lQ', 940, 320, 'Q', C().edgeRise);
    b.drawWire('wd-g', [[300, 230],[380, 300]], C().wireHi);
    b.drawWire('wc-g', [[300, 420],[380, 360]], C().accent);
    b.drawWire('wq-g', [[620, 330],[680, 320]], C().edgeRise);
  }

  const BLOCKS_11_SCENES = [

    // ════════════════════════════════════════════════════
    // SCENE 1 — WELCOME, AND THE HIDDEN DISTINCTION
    // ════════════════════════════════════════════════════
    {
      id: 1,
      title: 'Welcome — The Hidden Distinction',
      pages: [
        { sentences: [
          { text: `Alright, class. Welcome. Today's lesson is going to be short, but it's one of the most important ideas you'll learn in digital logic. Because once you understand it, you'll look at every CPU diagram differently.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Today\u2019s Lesson — A Split You Haven\u2019t Noticed Yet', C().edgeRise);
              b.setLabel('Take a breath. Settle in. This one\u2019s foundational.', C().label);
            } },

          { text: `Over the last ten episodes, we've built ten hardware blocks. Flip-flops. Adders. Counters. Multiplexers. Comparators. RAM. You've seen quite a lot. Good work so far.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Ten Blocks, Ten Episodes', C().accent);
              b.drawCustom('blocks-grid', (g, NS, COL) => {
                const names = ['Clock','Flip-Flop','Register','Counter','Decoder',
                               'MUX','Comparator','Adder','ALU','RAM'];
                names.forEach((name, i) => {
                  const col = i % 5;
                  const row = Math.floor(i / 5);
                  const x = 120 + col * 160;
                  const y = 240 + row * 80;
                  const r = document.createElementNS(NS, 'rect');
                  r.setAttribute('x', x); r.setAttribute('y', y);
                  r.setAttribute('width', 140); r.setAttribute('height', 60);
                  r.setAttribute('rx', 6);
                  r.setAttribute('fill', COL.panel);
                  r.setAttribute('stroke', COL.accent);
                  r.setAttribute('stroke-width', '1.5');
                  g.appendChild(r);
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', x + 70); t.setAttribute('y', y + 38);
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '14');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = name; g.appendChild(t);
                });
              });
              b.setLabel('You now know how all ten of these are built. That\u2019s a lot of ground covered.', C().accent);
            } },

          { text: `But here's something you probably haven't noticed. There's a hidden split across all ten of those blocks. Every single one of them belongs to one of two families. And once I show you the split, it becomes impossible to unsee.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A Split You Haven\u2019t Noticed', C().edgeRise);
              b.drawCustom('blocks-grid', (g, NS, COL) => {
                const names = ['Clock','Flip-Flop','Register','Counter','Decoder',
                               'MUX','Comparator','Adder','ALU','RAM'];
                names.forEach((name, i) => {
                  const col = i % 5;
                  const row = Math.floor(i / 5);
                  const x = 120 + col * 160;
                  const y = 240 + row * 80;
                  const r = document.createElementNS(NS, 'rect');
                  r.setAttribute('x', x); r.setAttribute('y', y);
                  r.setAttribute('width', 140); r.setAttribute('height', 60);
                  r.setAttribute('rx', 6);
                  r.setAttribute('fill', COL.panel);
                  r.setAttribute('stroke', COL.accent);
                  r.setAttribute('stroke-width', '1.5');
                  g.appendChild(r);
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', x + 70); t.setAttribute('y', y + 38);
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '14');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = name; g.appendChild(t);
                });
                const qm = document.createElementNS(NS, 'text');
                qm.setAttribute('x', 500); qm.setAttribute('y', 480);
                qm.setAttribute('text-anchor', 'middle');
                qm.setAttribute('font-family', 'monospace');
                qm.setAttribute('font-size', '30');
                qm.setAttribute('font-weight', '700');
                qm.setAttribute('fill', COL.wireHot);
                qm.textContent = 'hmm — what split?'; g.appendChild(qm);
              });
              b.setLabel('I bet if I asked you, right now, to divide these ten into two piles \u2014 you couldn\u2019t. Yet.', C().accent);
            } },

          { text: `Let me show you. Look at these two symbols. On the left — an AND gate. You know this one. On the right — a D flip-flop. You know this one too.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Two Familiar Symbols', C().accent);
              b.drawGate('and', 'AND', 180, 260, 160, 120);
              b.drawBox('ff', 620, 260, 220, 120, 'D FLIP-FLOP', C().edgeRise);
              b.drawNode('lhs', 260, 420, 'familiar?', C().accent);
              b.drawNode('rhs', 730, 420, 'also familiar?', C().accent);
              b.setLabel('Both of these you\u2019ve met before. But today we look at them side by side.', C().label);
            } },

          { text: `Now here's my question. At the most fundamental level — what makes these two different? And I don't mean "one has two inputs, the other has three," or "one is made of gates, the other has flip-flops inside." I mean: what KIND of circuit is each one? Are they the same kind of thing, or are they fundamentally different creatures?`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Question', C().edgeRise);
              b.drawGate('and', 'AND', 180, 240, 160, 120);
              b.drawBox('ff', 620, 240, 220, 120, 'D FLIP-FLOP', C().edgeRise);
              b.drawNode('vs', 500, 300, 'vs', C().wireHot);
              b.drawNode('q', 500, 460,
                'same kind of thing? or fundamentally different?',
                C().edgeRise);
              b.setLabel('Don\u2019t read ahead. Sit with the question for a moment. Then we\u2019ll go find the answer.', C().accent);
            } },

          { text: `Take a moment. Really look at them. What would be different if you changed each one's inputs right now? Would they respond differently? Would one wait? Would one react immediately? That's where our answer lives. And that's what the rest of this lesson is about.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Where The Answer Lives', C().accent);
              b.drawGate('and', 'AND', 180, 240, 160, 120);
              b.drawBox('ff', 620, 240, 220, 120, 'D FLIP-FLOP', C().edgeRise);
              b.drawNode('hint', 500, 440, 'what happens when we change their inputs?', C().accent);
              b.drawNode('next', 500, 480, 'let\u2019s do the experiment \u2192', C().edgeRise);
              b.setLabel('You\u2019ll figure it out the instant you see it. We\u2019ll run a little experiment on each one next.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 2 — THE AND GATE EXPERIMENT
    // ════════════════════════════════════════════════════
    {
      id: 2,
      title: 'Experiment 1 — The AND Gate',
      pages: [
        { sentences: [
          { text: `Let's start with the AND gate. I've set up a little experiment on screen. Two inputs, A and B, are going to keep toggling — on, off, on, off. You're going to watch the output, Y, and tell me what it does.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Experiment 1 — Toggle The Inputs, Watch The Output', C().edgeRise);
              _stageAND(b);
              b.setLabel('A (top left) and B (bottom left) are toggling. Y (right) is the AND gate\u2019s output.', C().accent);
            } },

          { text: `OK — watch the output. A is toggling fast. B is toggling a little slower. Look at Y. Take your time.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Watch Y', C().edgeRise);
              _stageAND(b);
              b.setLabel('No rush. Look at when Y goes up and when it goes down. What pattern do you see?', C().label);
            } },

          { text: `See the pattern? Y is 1 ONLY when both A is 1 AND B is 1. The moment either one drops, Y drops. That's the AND rule — we've known this. But here's what I really want you to notice: the RESPONSE is instant. A changes, Y changes. No waiting.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Y Tracks A·B — Live, No Waiting', C().edgeRise);
              _stageAND(b);
              b.drawNode('rule', 500, 510, 'Y = A AND B  \u2014  changes the instant A or B changes', C().edgeRise);
              b.setLabel('Input changes \u2192 output changes \u2014 within a nanosecond. This is the key behaviour.', C().accent);
            } },

          { text: `Now I want to ask you a question, and I want you to really think about it before I answer. Here's the question: does this AND gate have a CLOCK? Does it have MEMORY? Does it know what A was a second ago?`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Question — Does This Gate Have A Clock? Memory?', C().accent);
              _stageAND(b);
              b.drawNode('q', 500, 510, 'clock?  memory?  does it remember the past?', C().wireHot);
              b.setLabel('Pause for a second. Really think. Then we\u2019ll answer it together.', C().label);
            } },

          { text: `The answer — is no. To all three. This gate has no clock. It has no memory. It has no idea what A was a second ago. And honestly — it doesn't need any of those. Because all it has to know is: right NOW, what are A and B? Compute Y from those. Done.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Answer — No Clock, No Memory, No Past', C().edgeRise);
              _stageAND(b);
              b.drawNode('ans', 500, 510, 'no clock   \u2713     no memory   \u2713     no past   \u2713', C().edgeRise);
              b.setLabel('Everything this gate needs to know is present RIGHT NOW, on its input wires.', C().edgeRise);
            } },

          { text: `This kind of circuit — no clock, no memory, output depends only on the current inputs — has a name. We call it combinational logic. "Combinational" because the output is a pure combination of the current inputs. Nothing else is involved.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Name — Combinational Logic', C().edgeRise);
              b.drawCustom('defn', (g, NS, COL) => {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', 500); t.setAttribute('y', 260);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '38');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', COL.edgeRise);
                t.textContent = 'COMBINATIONAL LOGIC';
                g.appendChild(t);
                const sub = document.createElementNS(NS, 'text');
                sub.setAttribute('x', 500); sub.setAttribute('y', 320);
                sub.setAttribute('text-anchor', 'middle');
                sub.setAttribute('font-family', 'monospace');
                sub.setAttribute('font-size', '16');
                sub.setAttribute('fill', COL.accent);
                sub.textContent = 'output is a pure combination of the current inputs';
                g.appendChild(sub);
              });
              b.setLabel('Write this word down somewhere. You\u2019ll see it many more times.', C().accent);
            } },

          { text: `Now, I can already hear a question from the back of the class. Someone wants to say — hold on, isn't there SOME delay? Electrons don't move infinitely fast. The transistors have to switch. And yes — you're absolutely right. There is a delay. About a nanosecond for a typical gate. We call that propagation delay.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Good Question — "Isn\u2019t There Some Delay?"', C().accent);
              _stageAND(b);
              b.drawNode('d1', 500, 500, 'yes \u2014 propagation delay, ~1 nanosecond', C().accent);
              b.drawNode('d2', 500, 530, 'gate transistors take real time to switch', C().label);
              b.setLabel('Nothing in physics is truly instant. But 1 ns is practically zero from a program\u2019s point of view.', C().accent);
            } },

          { text: `But here's the thing. Propagation delay is not the same as waiting. It's not the gate "deciding." It's just the time it takes the electrons to rearrange themselves through the transistors. After that, the output is as fresh as the inputs. That's still "combinational." The gate isn't remembering anything; it's just taking a billionth of a second to respond.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Propagation Delay \u2260 Waiting', C().accent);
              _stageAND(b);
              b.drawNode('d1', 500, 510, 'the gate doesn\u2019t \u201cdecide\u201d \u2014 it just takes 1 ns for electrons to move', C().accent);
              b.setLabel('Think of it like dropping a stone in water. Ripples take a moment. That\u2019s not memory.', C().label);
            } },

          { text: `Let me give you the rule in one short sentence, because this is the piece to memorise. In a combinational circuit: output equals a function of the inputs. That's it. Y equals f of A and B. The equation has inputs on the right-hand side. Nothing else. No clock variable. No "previous state." Nothing.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Rule \u2014 Memorise This', C().edgeRise);
              b.drawCustom('rule', (g, NS, COL) => {
                const eq = document.createElementNS(NS, 'text');
                eq.setAttribute('x', 500); eq.setAttribute('y', 280);
                eq.setAttribute('text-anchor', 'middle');
                eq.setAttribute('font-family', 'monospace');
                eq.setAttribute('font-size', '46');
                eq.setAttribute('font-weight', '700');
                eq.setAttribute('fill', COL.edgeRise);
                eq.textContent = 'OUTPUT  =  f(INPUTS)';
                g.appendChild(eq);
                const sub = document.createElementNS(NS, 'text');
                sub.setAttribute('x', 500); sub.setAttribute('y', 340);
                sub.setAttribute('text-anchor', 'middle');
                sub.setAttribute('font-family', 'monospace');
                sub.setAttribute('font-size', '18');
                sub.setAttribute('fill', COL.accent);
                sub.textContent = 'inputs on the right-hand side. Nothing else.';
                g.appendChild(sub);
              });
              b.setLabel('If an equation has this shape \u2014 it\u2019s combinational. Period.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 3 — THE FLIP-FLOP EXPERIMENT (CONTRAST)
    // ════════════════════════════════════════════════════
    {
      id: 3,
      title: 'Experiment 2 — The D Flip-Flop',
      pages: [
        { sentences: [
          { text: `OK. Experiment one is done. We know what the AND gate does. Now let's do the same experiment with our other character — the D flip-flop. I'll toggle its D input, just like I did with A. You watch Q. Same deal — take your time.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Experiment 2 \u2014 Same Setup, Different Chip', C().edgeRise);
              _stageFF(b);
              b.setLabel('D (top left) is toggling fast. CLK (bottom left) ticks slowly. Watch what Q (right) does.', C().accent);
            } },

          { text: `Watch Q. I'm going to pause for a few seconds and just let you stare at it. Notice what's happening — or more importantly, what ISN'T happening.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Just \u2014 Watch Q', C().accent);
              _stageFF(b);
              b.setLabel('Don\u2019t read. Just look.', C().label);
            } },

          { text: `Did you see it? Or rather — did you see nothing? D was wiggling like crazy. And Q just sat there. Flat. Occasionally, once in a while, Q jumped to a new value — but mostly it ignored D entirely. Very different from the AND gate.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Q Ignores D \u2014 Most Of The Time', C().edgeRise);
              _stageFF(b);
              b.drawNode('obs', 500, 510, 'D toggles rapidly \u2022 Q ignores D \u2022 Q only changes occasionally', C().accent);
              b.setLabel('This is wildly different from the AND gate\u2019s behaviour. Q isn\u2019t tracking D at all.', C().accent);
            } },

          { text: `I hear the question forming already. Somebody wants to ask: "Wait. I thought a D flip-flop's output follows its D input. That's the whole point of the letter D. Why isn't Q changing?" Excellent question. Let's answer it.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Good Question \u2014 "Shouldn\u2019t Q Follow D?"', C().accent);
              _stageFF(b);
              b.drawNode('q', 500, 510, 'shouldn\u2019t D stand for \u201cthe output follows D\u201d?', C().wireHot);
              b.setLabel('This confusion is completely normal. It tripped me up too, the first time.', C().label);
            } },

          { text: `The answer is the clock. A D flip-flop does not continuously follow D. It looks at D for a single instant — the exact moment the clock goes from 0 to 1. At that instant it GRABS whatever value D happens to have, and locks it in. Between clock edges, the flip-flop doesn't care what D is doing.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Answer \u2014 It\u2019s The Clock', C().edgeRise);
              _stageFF(b);
              b.drawNode('ans', 500, 510, 'Q grabs D only on the rising edge of CLK \u2014 nothing else counts', C().edgeRise);
              b.setLabel('Between clock edges, Q holds the last value it captured. D is ignored.', C().edgeRise);
            } },

          { text: `Watch the waveforms again, with that in mind. Every time the clock goes up — bam — Q jumps to whatever D is at that instant. The rest of the time, D can wave and wiggle all it wants, Q won't budge. That's the rhythm of this chip.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Watch With New Eyes', C().accent);
              _stageFF(b);
              b.setLabel('Line up CLK\u2019s rising edges with Q\u2019s changes. Every Q change = one clock edge.', C().accent);
            } },

          { text: `So what does this mean? It means the flip-flop has MEMORY. It holds a value between clock edges. What it's outputting right now depends not only on the current D input — it depends on what was on D at the last clock edge. History matters. The past matters.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Key Word \u2014 MEMORY', C().edgeRise);
              _stageFF(b);
              b.drawNode('mem', 500, 510, 'Q remembers what was captured at the LAST clock edge', C().edgeRise);
              b.setLabel('This chip has a past. The AND gate didn\u2019t. That\u2019s the difference.', C().edgeRise);
            } },

          { text: `This kind of circuit — one that has memory, needs a clock, and whose output depends on history — has a name. We call it sequential logic. "Sequential" because the output is shaped by the SEQUENCE of events that came before. What you see now depends on what happened earlier.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Name \u2014 Sequential Logic', C().edgeRise);
              b.drawCustom('defn', (g, NS, COL) => {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', 500); t.setAttribute('y', 260);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '38');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', COL.edgeRise);
                t.textContent = 'SEQUENTIAL LOGIC';
                g.appendChild(t);
                const sub = document.createElementNS(NS, 'text');
                sub.setAttribute('x', 500); sub.setAttribute('y', 320);
                sub.setAttribute('text-anchor', 'middle');
                sub.setAttribute('font-family', 'monospace');
                sub.setAttribute('font-size', '16');
                sub.setAttribute('fill', COL.accent);
                sub.textContent = 'output shaped by the sequence of prior events \u2014 needs a clock';
                g.appendChild(sub);
              });
              b.setLabel('Write this one down too. Two names, two ideas \u2014 everything else builds on them.', C().accent);
            } },

          { text: `And here's the matching rule. For a sequential circuit: output equals a function of the inputs AND the state. Two things on the right-hand side now — not just inputs, but also state. State is shorthand for "whatever I remember from last time." That's the whole difference.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Sequential Rule', C().edgeRise);
              b.drawCustom('rule', (g, NS, COL) => {
                const eq = document.createElementNS(NS, 'text');
                eq.setAttribute('x', 500); eq.setAttribute('y', 280);
                eq.setAttribute('text-anchor', 'middle');
                eq.setAttribute('font-family', 'monospace');
                eq.setAttribute('font-size', '42');
                eq.setAttribute('font-weight', '700');
                eq.setAttribute('fill', COL.edgeRise);
                eq.textContent = 'OUTPUT  =  f(INPUTS, STATE)';
                g.appendChild(eq);
                const sub = document.createElementNS(NS, 'text');
                sub.setAttribute('x', 500); sub.setAttribute('y', 340);
                sub.setAttribute('text-anchor', 'middle');
                sub.setAttribute('font-family', 'monospace');
                sub.setAttribute('font-size', '18');
                sub.setAttribute('fill', COL.accent);
                sub.textContent = 'two things on the right-hand side now';
                g.appendChild(sub);
              });
              b.setLabel('Combinational had ONE argument: inputs. Sequential has TWO: inputs + state.', C().edgeRise);
            } },

          { text: `Another question I can hear. Someone's thinking: "Why do we even NEED sequential logic? Isn't instant response — like the AND gate — always better?" Also an excellent question.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Good Question \u2014 "Why Need Sequential At All?"', C().accent);
              b.drawNode('q', 500, 280, 'isn\u2019t \u201cinstant response\u201d always better?', C().wireHot);
              b.setLabel('Let\u2019s answer this carefully \u2014 it matters.', C().label);
            } },

          { text: `The answer is: sometimes you want to REMEMBER. Think about a program running on a CPU. It has to hold a value while the next instruction is being fetched. It has to keep track of which memory address it's reading. It has to remember the current value of a loop counter. Combinational circuits can't do any of that — they forget the instant their inputs change. Sequential logic is how a CPU has memory at all. Without it, no computing.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Answer \u2014 You Need Memory To Compute', C().edgeRise);
              b.drawCustom('examples', (g, NS, COL) => {
                const lines = [
                  '\u2022 hold a value between instructions',
                  '\u2022 remember which memory address you were using',
                  '\u2022 keep a loop counter',
                  '\u2022 track where in the program you are (PC)',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 180); t.setAttribute('y', 260 + i * 42);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '17');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Every one of these needs something to remember. That\u2019s why sequential logic exists.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 4 — SORT THE TEN BLOCKS (CLASS EXERCISE)
    // ════════════════════════════════════════════════════
    {
      id: 4,
      title: 'Class Exercise — Sort The Ten',
      pages: [
        { sentences: [
          { text: `OK. We now have two families. Combinational, with no memory. Sequential, with memory. Time for an exercise. I'm going to name each of the ten blocks we've built. You tell me — in your head — whether it's combinational or sequential. Then I'll give you the answer. Ready?`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Class Exercise \u2014 Sort The Ten', C().edgeRise);
              b.drawBox('cat1', 80,  240, 380, 120, 'COMBINATIONAL\n(no memory)', C().edgeRise);
              b.drawBox('cat2', 540, 240, 380, 120, 'SEQUENTIAL\n(has memory)', C().edgeRise);
              b.setLabel('Two empty piles. We\u2019ll fill them together, one block at a time.', C().accent);
            } },

          { text: `Block one — the AND gate. You already know. No memory, output follows inputs. Combinational. Easy. Put it on the left pile.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('AND Gate \u2014 Combinational', C().edgeRise);
              b.drawBox('cat1', 80,  240, 380, 120, 'COMBINATIONAL\n(no memory)', C().edgeRise);
              b.drawBox('cat2', 540, 240, 380, 120, 'SEQUENTIAL\n(has memory)', C().edgeRise);
              b.drawNode('item', 270, 390, '\u2190 AND gate', C().accent);
              b.setLabel('1 down, 9 to go.', C().label);
            } },

          { text: `The decoder. Goes in an input code, lights up exactly one of many output wires. Is there any memory in there? No — just a bunch of AND gates. Combinational. Left pile.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Decoder \u2014 Combinational', C().edgeRise);
              b.drawBox('cat1', 80,  240, 380, 120, 'COMBINATIONAL', C().edgeRise);
              b.drawBox('cat2', 540, 240, 380, 120, 'SEQUENTIAL', C().edgeRise);
              b.drawNode('item', 270, 390, '\u2190 Decoder', C().accent);
              b.setLabel('Pure gates, pure function of inputs. Nothing to remember.', C().label);
            } },

          { text: `The multiplexer. Many data inputs plus a select line, one output. Any state? No. Just gates. Combinational. Left pile.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Multiplexer \u2014 Combinational', C().edgeRise);
              b.drawBox('cat1', 80,  240, 380, 120, 'COMBINATIONAL', C().edgeRise);
              b.drawBox('cat2', 540, 240, 380, 120, 'SEQUENTIAL', C().edgeRise);
              b.drawNode('item', 270, 390, '\u2190 Multiplexer', C().accent);
              b.setLabel('Select picks. No clock. Simple routing logic.', C().label);
            } },

          { text: `The comparator. Two numbers in, three wires out telling you which is bigger. Memory? No. Just a network of XNORs and ANDs. Combinational.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Comparator \u2014 Combinational', C().edgeRise);
              b.drawBox('cat1', 80,  240, 380, 120, 'COMBINATIONAL', C().edgeRise);
              b.drawBox('cat2', 540, 240, 380, 120, 'SEQUENTIAL', C().edgeRise);
              b.drawNode('item', 270, 390, '\u2190 Comparator', C().accent);
              b.setLabel('Truth-table-to-gates. No state anywhere.', C().label);
            } },

          { text: `The adder. A plus B equals sum. We built it from XORs, ANDs, and ORs. Any memory inside? Absolutely not. Every adder is combinational.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Adder \u2014 Combinational', C().edgeRise);
              b.drawBox('cat1', 80,  240, 380, 120, 'COMBINATIONAL', C().edgeRise);
              b.drawBox('cat2', 540, 240, 380, 120, 'SEQUENTIAL', C().edgeRise);
              b.drawNode('item', 270, 390, '\u2190 Adder', C().accent);
              b.setLabel('Every carry ripples through. No state. Just gates.', C().label);
            } },

          { text: `The logic bank inside the ALU — bitwise AND, OR, XOR across all N bits. N gates side by side, no memory. Combinational. And the shifter? Literally just wires arranged in a pattern. Not even any gates! Still combinational.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Logic Bank + Shifter \u2014 Both Combinational', C().edgeRise);
              b.drawBox('cat1', 80,  240, 380, 120, 'COMBINATIONAL', C().edgeRise);
              b.drawBox('cat2', 540, 240, 380, 120, 'SEQUENTIAL', C().edgeRise);
              b.drawNode('item', 270, 390, '\u2190 Logic bank, Shifter', C().accent);
              b.setLabel('Shifters are the cheapest operation in hardware \u2014 just rewiring, no gates needed.', C().label);
            } },

          { text: `So that's six on the left. Decoder, MUX, comparator, adder, logic bank, shifter. All combinational. No memory in any of them. Now the other pile.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Six Combinational Down \u2014 Now Sequential', C().accent);
              b.drawBox('cat1', 80,  240, 380, 200, 'COMBINATIONAL\n\nDecoder · MUX\nComparator · Adder\nLogic · Shifter', C().edgeRise);
              b.drawBox('cat2', 540, 240, 380, 200, 'SEQUENTIAL\n(\u2026 coming up)', C().accent);
              b.setLabel('Left pile filled in. Let\u2019s fill the right.', C().accent);
            } },

          { text: `The flip-flop. We literally used it as our sequential example. Has memory — one bit. Needs a clock. Sequential. Put it on the right pile.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Flip-Flop \u2014 Sequential', C().edgeRise);
              b.drawBox('cat1', 80,  240, 380, 200, 'COMBINATIONAL\n\nDecoder · MUX\nComparator · Adder\nLogic · Shifter', C().edgeRise);
              b.drawBox('cat2', 540, 240, 380, 200, 'SEQUENTIAL\n\nFlip-Flop', C().edgeRise);
              b.setLabel('1 bit of memory. That\u2019s the smallest sequential unit.', C().label);
            } },

          { text: `The register. An array of flip-flops. So does a register have memory? Obviously — it's made of flip-flops. Needs a clock. Sequential.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Register \u2014 Sequential', C().edgeRise);
              b.drawBox('cat1', 80,  240, 380, 200, 'COMBINATIONAL\n\nDecoder · MUX\nComparator · Adder\nLogic · Shifter', C().edgeRise);
              b.drawBox('cat2', 540, 240, 380, 200, 'SEQUENTIAL\n\nFlip-Flop\nRegister', C().edgeRise);
              b.setLabel('A register is just flip-flops stacked. Same family, bigger storage.', C().label);
            } },

          { text: `The counter. A register that increments itself every clock edge. Still has flip-flops inside. Still has memory. Sequential.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Counter \u2014 Sequential', C().edgeRise);
              b.drawBox('cat1', 80,  240, 380, 200, 'COMBINATIONAL\n\nDecoder · MUX\nComparator · Adder\nLogic · Shifter', C().edgeRise);
              b.drawBox('cat2', 540, 240, 380, 200, 'SEQUENTIAL\n\nFlip-Flop · Register\nCounter', C().edgeRise);
              b.setLabel('Counter = register + an adder feeding itself. Still has memory.', C().label);
            } },

          { text: `And finally, RAM. An array of registers. Huge. 256 bytes in our version. All of it made of flip-flops. Needs a clock. Definitely has memory. Sequential.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('RAM \u2014 Sequential', C().edgeRise);
              b.drawBox('cat1', 80,  240, 380, 200, 'COMBINATIONAL\n\nDecoder · MUX\nComparator · Adder\nLogic · Shifter', C().edgeRise);
              b.drawBox('cat2', 540, 240, 380, 200, 'SEQUENTIAL\n\nFlip-Flop · Register\nCounter · RAM', C().edgeRise);
              b.setLabel('All four of the sequential blocks share one thing \u2014 flip-flops inside.', C().accent);
            } },

          { text: `So let's step back and look. Six combinational blocks. Four sequential blocks. Here's the insight, and it's the insight worth memorising: every sequential block has flip-flops inside. That's how you spot them. Where there are flip-flops, there's memory. Where there's memory, the circuit is sequential.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Insight \u2014 Flip-Flops Inside = Sequential', C().edgeRise);
              b.drawBox('cat1', 80,  240, 380, 220, 'COMBINATIONAL \u2022 6 blocks\n\nDecoder · MUX\nComparator · Adder\nLogic bank · Shifter\n\n\u2192 no flip-flops', C().edgeRise);
              b.drawBox('cat2', 540, 240, 380, 220, 'SEQUENTIAL \u2022 4 blocks\n\nFlip-Flop · Register\nCounter · RAM\n\n\u2192 flip-flops inside every one', C().edgeRise);
              b.setLabel('Want to know if a block is sequential? Open it up. Flip-flops anywhere? Yes \u2192 sequential.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 5 — WHY THE CPU NEEDS BOTH
    // ════════════════════════════════════════════════════
    {
      id: 5,
      title: 'Why A CPU Needs Both',
      pages: [
        { sentences: [
          { text: `Now, big-picture question. Why does a CPU have both families? Why not just use one kind? Could we make a CPU out of only combinational circuits? Or only sequential? Let's think this through properly.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Could A CPU Use Only ONE Family?', C().accent);
              b.drawNode('q1', 300, 350, 'only combinational?', C().accent);
              b.drawNode('q2', 700, 350, 'only sequential?', C().accent);
              b.setLabel('Let\u2019s try both thought experiments.', C().label);
            } },

          { text: `First — could we build a CPU with ONLY combinational logic? Let's try. Our AND gate plus a couple of friends could compute A + B. Fine. Now I ask: where does the answer live? You want to use it in the NEXT instruction. But combinational circuits have no memory. The instant you change the inputs, the old answer is gone. So by the time the next instruction's inputs are ready, our previous sum has vanished. Can't work.`,
            dur: 19000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Thought Experiment \u2014 Only Combinational', C().wireHot);
              b.drawGate('add', 'AND', 380, 260, 140, 100);
              b.drawNode('a1', 230, 290, 'compute A+B', C().wireHi);
              b.drawNode('a2', 580, 310, '\u2192 answer', C().edgeRise);
              b.drawNode('prob', 500, 470, 'change inputs \u2192 answer vanishes. nowhere to STORE it.', C().wireHot);
              b.setLabel('Combinational circuits can DO things. But they can\u2019t HOLD things.', C().wireHot);
            } },

          { text: `OK that failed. Second attempt — could we build a CPU with ONLY sequential logic? So, only registers and flip-flops. They can hold values. Great. But wait — what's actually inside them? Flip-flops hold bits, but they can't ADD those bits together. They can't compare them. They can't decode an instruction. Nothing computes. Nothing DOES anything. Just a pile of registers staring at each other.`,
            dur: 19000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Thought Experiment \u2014 Only Sequential', C().wireHot);
              b.drawBox('r1', 180, 260, 160, 80, 'Register', C().accent);
              b.drawBox('r2', 380, 260, 160, 80, 'Register', C().accent);
              b.drawBox('r3', 580, 260, 160, 80, 'Register', C().accent);
              b.drawNode('prob', 500, 470, 'no adder, no MUX, no decoder \u2014 nothing computes', C().wireHot);
              b.setLabel('Sequential circuits can HOLD things. But they can\u2019t DO anything to those things.', C().wireHot);
            } },

          { text: `So the conclusion is unavoidable — you need both. And each family has a different job, which I want to name clearly.`,
            dur: 9500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Conclusion \u2014 You Need BOTH', C().edgeRise);
              b.drawNode('c1', 500, 320, 'neither family alone can build a CPU', C().edgeRise);
              b.drawNode('c2', 500, 380, 'each has a specific, irreplaceable role', C().accent);
              b.setLabel('Let\u2019s name those roles.', C().label);
            } },

          { text: `Combinational circuits are the DOERS. They take inputs and produce an answer. They compute. They decode. They route. They decide. Every time you need to ACT on values, a combinational circuit is involved. The adder, the MUX, the decoder, the comparator — these are all doers.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Combinational = The Doers', C().edgeRise);
              b.drawBox('doers', 200, 240, 600, 180, 'COMBINATIONAL\n\n"The Doers"\n\ncompute · decode · route · decide', C().edgeRise);
              b.setLabel('Whenever something happens to a value, a combinational circuit did it.', C().edgeRise);
            } },

          { text: `Sequential circuits are the REMEMBERERS. They hold values between clock edges. They keep the program counter pointing at the right instruction. They keep operand values alive long enough for the ALU to use them. They preserve state so the next instruction can read it. Registers, RAM, the PC — these are all rememberers.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Sequential = The Rememberers', C().edgeRise);
              b.drawBox('rem', 200, 240, 600, 180, 'SEQUENTIAL\n\n"The Rememberers"\n\nhold values between clock edges', C().edgeRise);
              b.setLabel('Whenever a value persists longer than a nanosecond, a sequential circuit is holding it.', C().edgeRise);
            } },

          { text: `And here's the big picture — this is the picture every CPU designer keeps in their head. Every clock edge, sequential blocks hand their stored values to combinational blocks. The combinational blocks crunch — fast, in a single cycle — and produce new values. The sequential blocks capture those new values on the NEXT clock edge. Then repeat. Forever. That's the whole machine. A dance between holders and doers, one step per clock tick.`,
            dur: 21000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Dance \u2014 One Step Per Clock Tick', C().edgeRise);
              b.drawBox('seq', 60, 260, 240, 160, 'REGISTERS\n(sequential)\nholders', C().edgeRise);
              b.drawBox('comb', 700, 260, 240, 160, 'ALU / MUX / DEC\n(combinational)\ndoers', C().accent);
              b.drawWire('f1', [[300, 310],[700, 310]], C().wireHi);
              b.drawNode('f1-l', 500, 295, 'hand stored values over', C().wireHi);
              b.drawWire('f2', [[700, 370],[300, 370]], C().edgeRise);
              b.drawNode('f2-l', 500, 390, 'hand computed results back', C().edgeRise);
              b.drawNode('note', 500, 500, 'on each clock edge \u2014 sequential blocks capture the latest result', C().accent);
              b.setLabel('Every CPU ever built runs this dance. Millions or billions of times per second.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 — RECAP + TEASER
    // ════════════════════════════════════════════════════
    {
      id: 6,
      title: 'Recap \u2014 And What\u2019s Next',
      pages: [
        { sentences: [
          { text: `Alright, class. Let's recap. Today we learned there are two families of digital circuits — two and only two. Combinational, and sequential.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Recap \u2014 Two Families', C().edgeRise);
              b.drawBox('c', 100, 240, 380, 200, 'COMBINATIONAL', C().edgeRise);
              b.drawBox('s', 520, 240, 380, 200, 'SEQUENTIAL', C().edgeRise);
              b.setLabel('Every digital circuit is one of these. No exceptions.', C().accent);
            } },

          { text: `Combinational. No memory. No clock. Output equals a function of the current inputs. Instant response, within a gate delay.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Combinational', C().edgeRise);
              b.drawCustom('def', (g, NS, COL) => {
                const eq = document.createElementNS(NS, 'text');
                eq.setAttribute('x', 500); eq.setAttribute('y', 280);
                eq.setAttribute('text-anchor', 'middle');
                eq.setAttribute('font-family', 'monospace');
                eq.setAttribute('font-size', '38');
                eq.setAttribute('font-weight', '700');
                eq.setAttribute('fill', COL.edgeRise);
                eq.textContent = 'Y = f(inputs)';
                g.appendChild(eq);
                const sub = document.createElementNS(NS, 'text');
                sub.setAttribute('x', 500); sub.setAttribute('y', 330);
                sub.setAttribute('text-anchor', 'middle');
                sub.setAttribute('font-family', 'monospace');
                sub.setAttribute('font-size', '16');
                sub.setAttribute('fill', COL.accent);
                sub.textContent = 'no clock \u2022 no memory \u2022 no past';
                g.appendChild(sub);
              });
              b.setLabel('The DOERS of the CPU.', C().accent);
            } },

          { text: `Sequential. Has memory, needs a clock. Output equals a function of inputs AND state. What you see now depends on what happened before.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Sequential', C().edgeRise);
              b.drawCustom('def', (g, NS, COL) => {
                const eq = document.createElementNS(NS, 'text');
                eq.setAttribute('x', 500); eq.setAttribute('y', 280);
                eq.setAttribute('text-anchor', 'middle');
                eq.setAttribute('font-family', 'monospace');
                eq.setAttribute('font-size', '38');
                eq.setAttribute('font-weight', '700');
                eq.setAttribute('fill', COL.edgeRise);
                eq.textContent = 'Y = f(inputs, state)';
                g.appendChild(eq);
                const sub = document.createElementNS(NS, 'text');
                sub.setAttribute('x', 500); sub.setAttribute('y', 330);
                sub.setAttribute('text-anchor', 'middle');
                sub.setAttribute('font-family', 'monospace');
                sub.setAttribute('font-size', '16');
                sub.setAttribute('fill', COL.accent);
                sub.textContent = 'has clock \u2022 has memory \u2022 past matters';
                g.appendChild(sub);
              });
              b.setLabel('The REMEMBERERS of the CPU.', C().accent);
            } },

          { text: `We looked at all ten hardware blocks we'd built, and sorted them. Six combinational: decoder, multiplexer, comparator, adder, logic bank, shifter. Four sequential: flip-flop, register, counter, RAM. Every sequential block has flip-flops inside — that's how you spot them.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Ten Blocks, Sorted', C().edgeRise);
              b.drawBox('c', 100, 240, 380, 220, 'COMBINATIONAL \u2022 6\n\nDecoder · MUX\nComparator · Adder\nLogic bank · Shifter', C().edgeRise);
              b.drawBox('s', 520, 240, 380, 220, 'SEQUENTIAL \u2022 4\n\nFlip-Flop · Register\nCounter · RAM', C().edgeRise);
              b.setLabel('A CPU needs both. They do different jobs. They don\u2019t replace each other.', C().edgeRise);
            } },

          { text: `Before we close — one question I want to leave you with. Now that you know combinational circuits are just "inputs to outputs through gates," here's the question. If you want to implement some arbitrary truth table — say, one with four inputs — can you always just translate every 1-row into an AND gate and OR them all together? Yes, you can. But should you? That's where the next lesson comes in.`,
            dur: 18000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Question For Next Time', C().accent);
              b.drawCustom('q', (g, NS, COL) => {
                const lines = [
                  'a 4-input truth table might have 16 rows \u2014',
                  '   up to 16 AND gates plus an OR.',
                  '',
                  'but: many of those gates are REDUNDANT.',
                  'can we shrink the circuit?',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 500); t.setAttribute('y', 250 + i * 40);
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '16');
                  t.setAttribute('fill', i < 2 ? COL.accent : (i === 3 ? COL.edgeRise : COL.label));
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Sit with this question. Next lesson we answer it \u2014 with Boolean algebra, and Karnaugh maps.', C().accent);
            } },

          { text: `Next lesson: Boolean algebra and Karnaugh maps — the tools real chip designers use to make combinational circuits smaller. Fewer gates, same behaviour. That's what's coming. See you next time, class.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Next Lesson \u2014 Boolean Algebra & K-Maps', C().edgeRise);
              b.drawCustom('preview', (g, NS, COL) => {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', 500); t.setAttribute('y', 280);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '22');
                t.setAttribute('fill', COL.edgeRise);
                t.textContent = 'same truth table \u2014 half the gates';
                g.appendChild(t);
                const s = document.createElementNS(NS, 'text');
                s.setAttribute('x', 500); s.setAttribute('y', 340);
                s.setAttribute('text-anchor', 'middle');
                s.setAttribute('font-family', 'monospace');
                s.setAttribute('font-size', '14');
                s.setAttribute('fill', COL.accent);
                s.textContent = 'how every real chip gets designed';
                g.appendChild(s);
              });
              b.setLabel('End of Lesson 11. See you in 12.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
      isFinal: true,
    },
  ];

  if (typeof window !== 'undefined') {
    window.BLOCKS_11_SCENES = BLOCKS_11_SCENES;
  }
})();
