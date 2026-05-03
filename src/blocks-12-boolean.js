/**
 * Series B — Episode 12: Boolean Algebra & Karnaugh Maps
 * -------------------------------------------------------
 * Classroom-voice lesson on how to shrink combinational circuits.  Starts
 * from Ep 11's open question ("can you always turn a truth table into
 * gates? yes — but should you?") and delivers two tools: the laws of
 * Boolean algebra and the visual trick of Karnaugh maps.
 *
 * Arc:
 *   1. Hook             bloated vs simplified — the question of "should you?"
 *   2. SOP method       turn any truth table into a circuit mechanically
 *   3. Boolean laws     the algebraic grammar for rewriting logic
 *   4. Apply algebra    simplify our example step-by-step
 *   5. K-maps           the visual version; 2-var + 3-var (majority voter)
 *   6. Recap + tease    limits of hand-tools + teaser for the Control Unit
 */

(function () {
  'use strict';

  const B = () => window.Blocks;
  const C = () => window.Blocks && window.Blocks.COL;

  // ─────────────────────────────────────────
  //  Helper — draw a simplified 2x2 K-map with a given fill
  // ─────────────────────────────────────────
  function _drawKMap2(b, opts) {
    // opts: { grid: 2x2 array of 0/1, highlightGroups: array of {cells, label, color} }
    opts = opts || {};
    const x0 = 360, y0 = 260;
    const cellW = 90, cellH = 70;
    const col = C();
    b.drawCustom('kmap2', (g, NS, COL) => {
      // Column headers (B)
      ['B=0', 'B=1'].forEach((lbl, c) => {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x0 + c * cellW + cellW / 2);
        t.setAttribute('y', y0 - 12);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '13');
        t.setAttribute('font-weight', '700');
        t.setAttribute('fill', COL.accent);
        t.textContent = lbl;
        g.appendChild(t);
      });
      // Row headers (A)
      ['A=0', 'A=1'].forEach((lbl, r) => {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x0 - 14);
        t.setAttribute('y', y0 + r * cellH + cellH / 2 + 4);
        t.setAttribute('text-anchor', 'end');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '13');
        t.setAttribute('font-weight', '700');
        t.setAttribute('fill', COL.accent);
        t.textContent = lbl;
        g.appendChild(t);
      });
      // Group highlights (drawn first, behind cells)
      if (opts.highlightGroups) {
        opts.highlightGroups.forEach(group => {
          const cells = group.cells;
          const minC = Math.min(...cells.map(c => c[1]));
          const maxC = Math.max(...cells.map(c => c[1]));
          const minR = Math.min(...cells.map(c => c[0]));
          const maxR = Math.max(...cells.map(c => c[0]));
          const rect = document.createElementNS(NS, 'rect');
          rect.setAttribute('x', x0 + minC * cellW - 4);
          rect.setAttribute('y', y0 + minR * cellH - 4);
          rect.setAttribute('width', (maxC - minC + 1) * cellW + 8);
          rect.setAttribute('height', (maxR - minR + 1) * cellH + 8);
          rect.setAttribute('rx', 8);
          rect.setAttribute('fill', 'none');
          rect.setAttribute('stroke', group.color || COL.edgeRise);
          rect.setAttribute('stroke-width', '3');
          g.appendChild(rect);
          if (group.label) {
            const lbl = document.createElementNS(NS, 'text');
            lbl.setAttribute('x', x0 + (minC + maxC + 1) * cellW / 2);
            lbl.setAttribute('y', y0 + maxR * cellH + cellH + 22);
            lbl.setAttribute('text-anchor', 'middle');
            lbl.setAttribute('font-family', 'monospace');
            lbl.setAttribute('font-size', '14');
            lbl.setAttribute('font-weight', '700');
            lbl.setAttribute('fill', group.color || COL.edgeRise);
            lbl.textContent = '→ ' + group.label;
            g.appendChild(lbl);
          }
        });
      }
      // Cells
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          const rect = document.createElementNS(NS, 'rect');
          rect.setAttribute('x', x0 + c * cellW);
          rect.setAttribute('y', y0 + r * cellH);
          rect.setAttribute('width', cellW);
          rect.setAttribute('height', cellH);
          rect.setAttribute('fill', COL.panel);
          rect.setAttribute('stroke', COL.gateEdge);
          rect.setAttribute('stroke-width', '1.5');
          g.appendChild(rect);
          const val = opts.grid[r][c];
          const t = document.createElementNS(NS, 'text');
          t.setAttribute('x', x0 + c * cellW + cellW / 2);
          t.setAttribute('y', y0 + r * cellH + cellH / 2 + 8);
          t.setAttribute('text-anchor', 'middle');
          t.setAttribute('font-family', 'monospace');
          t.setAttribute('font-size', '26');
          t.setAttribute('font-weight', '700');
          t.setAttribute('fill', val ? COL.edgeRise : COL.label);
          t.textContent = val;
          g.appendChild(t);
        }
      }
    });
  }

  // ─────────────────────────────────────────
  //  Helper — draw a 2x4 K-map (3 variables: A, B, C)
  //  Gray-coded BC columns: 00, 01, 11, 10
  //  grid[row][col] = value for (A=row, BC=[00,01,11,10][col])
  // ─────────────────────────────────────────
  function _drawKMap3(b, opts) {
    opts = opts || {};
    const x0 = 240, y0 = 260;
    const cellW = 90, cellH = 70;
    const headers = ['BC=00', 'BC=01', 'BC=11', 'BC=10'];
    b.drawCustom('kmap3', (g, NS, COL) => {
      // Column headers
      headers.forEach((lbl, c) => {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x0 + c * cellW + cellW / 2);
        t.setAttribute('y', y0 - 12);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '13');
        t.setAttribute('font-weight', '700');
        t.setAttribute('fill', COL.accent);
        t.textContent = lbl;
        g.appendChild(t);
      });
      // Row headers
      ['A=0', 'A=1'].forEach((lbl, r) => {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x0 - 14);
        t.setAttribute('y', y0 + r * cellH + cellH / 2 + 4);
        t.setAttribute('text-anchor', 'end');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '13');
        t.setAttribute('font-weight', '700');
        t.setAttribute('fill', COL.accent);
        t.textContent = lbl;
        g.appendChild(t);
      });
      // Group highlights
      if (opts.highlightGroups) {
        opts.highlightGroups.forEach(group => {
          const cells = group.cells;
          const minC = Math.min(...cells.map(c => c[1]));
          const maxC = Math.max(...cells.map(c => c[1]));
          const minR = Math.min(...cells.map(c => c[0]));
          const maxR = Math.max(...cells.map(c => c[0]));
          const rect = document.createElementNS(NS, 'rect');
          rect.setAttribute('x', x0 + minC * cellW - 4);
          rect.setAttribute('y', y0 + minR * cellH - 4);
          rect.setAttribute('width', (maxC - minC + 1) * cellW + 8);
          rect.setAttribute('height', (maxR - minR + 1) * cellH + 8);
          rect.setAttribute('rx', 8);
          rect.setAttribute('fill', 'none');
          rect.setAttribute('stroke', group.color || COL.edgeRise);
          rect.setAttribute('stroke-width', '3');
          g.appendChild(rect);
        });
      }
      // Cells
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 4; c++) {
          const rect = document.createElementNS(NS, 'rect');
          rect.setAttribute('x', x0 + c * cellW);
          rect.setAttribute('y', y0 + r * cellH);
          rect.setAttribute('width', cellW);
          rect.setAttribute('height', cellH);
          rect.setAttribute('fill', COL.panel);
          rect.setAttribute('stroke', COL.gateEdge);
          rect.setAttribute('stroke-width', '1.5');
          g.appendChild(rect);
          const val = opts.grid[r][c];
          const t = document.createElementNS(NS, 'text');
          t.setAttribute('x', x0 + c * cellW + cellW / 2);
          t.setAttribute('y', y0 + r * cellH + cellH / 2 + 8);
          t.setAttribute('text-anchor', 'middle');
          t.setAttribute('font-family', 'monospace');
          t.setAttribute('font-size', '26');
          t.setAttribute('font-weight', '700');
          t.setAttribute('fill', val ? COL.edgeRise : COL.label);
          t.textContent = val;
          g.appendChild(t);
        }
      }
      // Group labels listed separately (since multiple overlap)
      if (opts.groupLabels) {
        opts.groupLabels.forEach((lbl, i) => {
          const t = document.createElementNS(NS, 'text');
          t.setAttribute('x', x0 + 4 * cellW / 2);
          t.setAttribute('y', y0 + 2 * cellH + 30 + i * 22);
          t.setAttribute('text-anchor', 'middle');
          t.setAttribute('font-family', 'monospace');
          t.setAttribute('font-size', '14');
          t.setAttribute('font-weight', '700');
          t.setAttribute('fill', lbl.color || COL.edgeRise);
          t.textContent = lbl.text;
          g.appendChild(t);
        });
      }
    });
  }

  const BLOCKS_12_SCENES = [

    // ════════════════════════════════════════════════════
    // SCENE 1 — WELCOME + HOOK
    // ════════════════════════════════════════════════════
    {
      id: 1,
      title: 'Welcome — Should You Build It That Way?',
      pages: [
        { sentences: [
          { text: `Alright, class. Welcome back. Last lesson we ended with a promise. I said — if you want to implement some arbitrary truth table, can you always build it from AND gates and ORs? Yes, you can. But SHOULD you build it that way? Today we answer.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Today\u2019s Question \u2014 Can = Good?', C().edgeRise);
              b.drawCustom('q', (g, NS, COL) => {
                const lines = [
                  'can you turn any truth table into gates?    YES',
                  'but \u2014 is that always the BEST way?',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 500); t.setAttribute('y', 280 + i * 44);
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '18');
                  t.setAttribute('fill', i === 1 ? COL.edgeRise : COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Two tools you\u2019ll meet today \u2014 Boolean algebra, and Karnaugh maps.', C().accent);
            } },

          { text: `Let me set it up with a tiny example. Two inputs — A and B. One output — Y. Here's the truth table. Y is 1 whenever at least one of the inputs is 1. The only way to get Y equals 0 is if both A and B are 0.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A Tiny Example', C().accent);
              b.drawTruthTable('tt', 360, 220, ['A','B','Y'], [
                [0,0,0],
                [0,1,1],
                [1,0,1],
                [1,1,1],
              ]);
              b.setLabel('Four rows. Y = 1 on three of them. Description in plain English: \u201cY is 1 when at least one input is 1.\u201d', C().accent);
            } },

          { text: `Now — can we build a circuit that does this? Absolutely. In fact, many different circuits would work. Some use lots of gates. Some use very few. And here's the catch: all of them are equally "correct" — they all match the truth table perfectly. The question is which one you should build.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Many Correct Circuits. Which One?', C().accent);
              b.drawTruthTable('tt', 180, 220, ['A','B','Y'], [
                [0,0,0],
                [0,1,1],
                [1,0,1],
                [1,1,1],
              ]);
              b.drawNode('arrow', 500, 280, '\u2192 many correct circuits', C().accent);
              b.drawNode('ask',   500, 330, 'which one do we actually build?', C().wireHot);
              b.setLabel('Correctness is not enough. We care about cost. Let\u2019s see why.', C().label);
            } },

          { text: `Why does it matter? Because every gate in real hardware costs something. It costs silicon area. It costs a bit of power each time it switches. It adds a nanosecond of delay. So if you can do the same job with 2 gates instead of 10, you want the 2-gate version. Every time.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Why Fewer Gates Is Always Better', C().accent);
              b.drawCustom('why', (g, NS, COL) => {
                const items = [
                  '\u2022 silicon area      \u2190 cost money',
                  '\u2022 power            \u2190 drain battery, heat',
                  '\u2022 propagation delay \u2190 slower clock',
                  '\u2022 fabrication yield \u2190 more gates = more chances of defect',
                ];
                items.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 160); t.setAttribute('y', 250 + i * 44);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '16');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Fewer gates = cheaper + cooler + faster + more reliable. Every reason points the same way.', C().accent);
            } },

          { text: `Here's a sneak peek so you feel the stakes. The straight-from-the-truth-table way of building our 4-row circuit uses about 6 gates. The smart way uses... just 1. One single OR gate. Same behavior. One-sixth the hardware.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Gap \u2014 6 Gates Or 1?', C().edgeRise);
              b.drawCustom('gap', (g, NS, COL) => {
                const t1 = document.createElementNS(NS, 'text');
                t1.setAttribute('x', 300); t1.setAttribute('y', 300);
                t1.setAttribute('text-anchor', 'middle');
                t1.setAttribute('font-family', 'monospace');
                t1.setAttribute('font-size', '30');
                t1.setAttribute('font-weight', '700');
                t1.setAttribute('fill', COL.wireHot);
                t1.textContent = 'NAIVE:  6 gates';
                g.appendChild(t1);
                const t2 = document.createElementNS(NS, 'text');
                t2.setAttribute('x', 300); t2.setAttribute('y', 340);
                t2.setAttribute('text-anchor', 'middle');
                t2.setAttribute('font-family', 'monospace');
                t2.setAttribute('font-size', '13');
                t2.setAttribute('fill', COL.label);
                t2.textContent = '3 ANDs + 2 NOTs + 1 OR';
                g.appendChild(t2);
                const t3 = document.createElementNS(NS, 'text');
                t3.setAttribute('x', 700); t3.setAttribute('y', 300);
                t3.setAttribute('text-anchor', 'middle');
                t3.setAttribute('font-family', 'monospace');
                t3.setAttribute('font-size', '30');
                t3.setAttribute('font-weight', '700');
                t3.setAttribute('fill', COL.edgeRise);
                t3.textContent = 'SMART:  1 gate';
                g.appendChild(t3);
                const t4 = document.createElementNS(NS, 'text');
                t4.setAttribute('x', 700); t4.setAttribute('y', 340);
                t4.setAttribute('text-anchor', 'middle');
                t4.setAttribute('font-family', 'monospace');
                t4.setAttribute('font-size', '13');
                t4.setAttribute('fill', COL.label);
                t4.textContent = 'just an OR';
                g.appendChild(t4);
              });
              b.setLabel('Both implement the same truth table. One is cheap. One is wasteful. How do we get from the first to the second?', C().edgeRise);
            } },

          { text: `That's today's lesson. How to START with the naive version and SHRINK it into the smart version. Two tools for doing that. Boolean algebra — the rules for rewriting logic expressions. And Karnaugh maps — a visual trick that finds patterns for you. Let's begin.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Today\u2019s Two Tools', C().edgeRise);
              b.drawBox('t1', 120, 240, 360, 180, 'BOOLEAN ALGEBRA\n\nrewrite rules for logic', C().accent);
              b.drawBox('t2', 520, 240, 360, 180, 'KARNAUGH MAPS\n\na visual shortcut', C().accent);
              b.setLabel('Two tools. Same goal. Both worth knowing. Let\u2019s start with how to build gates from a truth table.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 2 — SUM OF PRODUCTS METHOD
    // ════════════════════════════════════════════════════
    {
      id: 2,
      title: 'Truth Table → Gates — The Mechanical Way',
      pages: [
        { sentences: [
          { text: `OK. First things first. If I hand you a truth table and say "build this," how do you do it? There's a mechanical recipe. It always works. It's called Sum Of Products — SOP for short. Three steps. Let me walk you through them on our example.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The SOP Recipe \u2014 Three Steps', C().edgeRise);
              b.drawTruthTable('tt', 360, 220, ['A','B','Y'], [
                [0,0,0],
                [0,1,1],
                [1,0,1],
                [1,1,1],
              ]);
              b.setLabel('\u201cSum Of Products\u201d \u2014 the recipe that mechanically turns any truth table into gates.', C().accent);
            } },

          { text: `Step one. Find every row where Y is 1. In our table that's rows 2, 3, and 4 — three rows where Y equals 1. Those are the rows we care about. Ignore the zero rows.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 1 \u2014 Mark The 1-Rows', C().accent);
              b.drawTruthTable('tt', 360, 220, ['A','B','Y'], [
                [0,0,0],
                [0,1,1],
                [1,0,1],
                [1,1,1],
              ]);
              b.highlightTableRow('tt', 1);
              b.drawNode('n', 500, 460, 'rows 2, 3, 4 \u2192 the ones we care about', C().edgeRise);
              b.setLabel('Only the 1-rows contribute to our expression. Zero rows get no term.', C().accent);
            } },

          { text: `Step two. For each 1-row, write a tiny equation — a "product term" — that is TRUE for exactly that row. How? For every input that's 0 in that row, include a NOT. For every input that's 1, include it straight.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 2 \u2014 Write A Product For Each 1-Row', C().accent);
              b.drawTruthTable('tt', 100, 220, ['A','B','Y'], [
                [0,0,0],
                [0,1,1],
                [1,0,1],
                [1,1,1],
              ]);
              b.drawCustom('terms', (g, NS, COL) => {
                const rows = [
                  ['row 2:  A=0, B=1  \u2192', '\u00AC A \u00B7 B'],
                  ['row 3:  A=1, B=0  \u2192', 'A \u00B7 \u00AC B'],
                  ['row 4:  A=1, B=1  \u2192', 'A \u00B7 B'],
                ];
                rows.forEach((r, i) => {
                  const y = 260 + i * 50;
                  const lbl = document.createElementNS(NS, 'text');
                  lbl.setAttribute('x', 440); lbl.setAttribute('y', y);
                  lbl.setAttribute('font-family', 'monospace');
                  lbl.setAttribute('font-size', '15');
                  lbl.setAttribute('fill', COL.label);
                  lbl.textContent = r[0]; g.appendChild(lbl);
                  const term = document.createElementNS(NS, 'text');
                  term.setAttribute('x', 720); term.setAttribute('y', y);
                  term.setAttribute('font-family', 'monospace');
                  term.setAttribute('font-size', '22');
                  term.setAttribute('font-weight', '700');
                  term.setAttribute('fill', COL.edgeRise);
                  term.textContent = r[1]; g.appendChild(term);
                });
              });
              b.setLabel('Each product term is true ONLY for its exact row. That\u2019s the trick.', C().accent);
            } },

          { text: `Step three. Sum them. That is — OR all three product terms together. Y equals NOT-A AND B, OR, A AND NOT-B, OR, A AND B. Three products, summed. Hence — Sum of Products. And this expression perfectly matches our truth table.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 3 \u2014 OR Them Together', C().edgeRise);
              b.drawCustom('eq', (g, NS, COL) => {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', 500); t.setAttribute('y', 300);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '30');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', COL.edgeRise);
                t.textContent = 'Y  =  \u00ACA\u00B7B  +  A\u00B7\u00ACB  +  A\u00B7B';
                g.appendChild(t);
                const sub = document.createElementNS(NS, 'text');
                sub.setAttribute('x', 500); sub.setAttribute('y', 360);
                sub.setAttribute('text-anchor', 'middle');
                sub.setAttribute('font-family', 'monospace');
                sub.setAttribute('font-size', '16');
                sub.setAttribute('fill', COL.accent);
                sub.textContent = 'three product terms, summed';
                g.appendChild(sub);
              });
              b.setLabel('That\u2019s the Sum-Of-Products form. The mechanical recipe is done.', C().edgeRise);
            } },

          { text: `As a circuit: two NOT gates — one to invert A, one to invert B. Three AND gates — one per product term. And one OR at the end to combine them. That's 6 gates total. It works. It matches the truth table exactly.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The 6-Gate Circuit', C().accent);
              b.drawGate('notA', 'NOT', 140, 190, 60, 40);
              b.drawGate('notB', 'NOT', 140, 410, 60, 40);
              b.drawGate('and1', 'AND', 300, 170, 100, 70);
              b.drawGate('and2', 'AND', 300, 260, 100, 70);
              b.drawGate('and3', 'AND', 300, 370, 100, 70);
              b.drawGate('or',   'OR',  520, 250, 130, 100);
              b.drawNode('a-in', 100, 210, 'A', C().wireHi);
              b.drawNode('b-in', 100, 430, 'B', C().wireHi);
              b.drawWire('w-a-not', [[120, 210],[140, 210]], C().wireHi);
              b.drawWire('w-b-not', [[120, 430],[140, 430]], C().wireHi);
              b.drawWire('w-and1', [[400, 205],[520, 280]], C().wireHi);
              b.drawWire('w-and2', [[400, 295],[520, 300]], C().wireHi);
              b.drawWire('w-and3', [[400, 405],[520, 320]], C().wireHi);
              b.drawWire('w-y',    [[652, 300],[800, 300]], C().edgeRise);
              b.drawNode('y', 820, 300, 'Y', C().edgeRise);
              b.setLabel('6 gates. Correct. But surely you\u2019re thinking \u2014 is there a smaller way?', C().accent);
            } },

          { text: `I can hear the question. "Is this really the smallest circuit that matches the truth table?" Great question. Almost certainly not. SOP always gives you ONE correct circuit — but often not the smallest. That's where Boolean algebra comes in. Let's learn the rules.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Is This The Smallest? \u2014 Almost Never.', C().accent);
              b.drawNode('msg', 500, 300, 'SOP always works \u2022 rarely the smallest', C().accent);
              b.drawNode('next', 500, 360, 'next: the rules for rewriting \u2192', C().edgeRise);
              b.setLabel('SOP is just the starting point. The real power is SHRINKING from here.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 3 — BOOLEAN ALGEBRA LAWS
    // ════════════════════════════════════════════════════
    {
      id: 3,
      title: 'Boolean Algebra — The Rewrite Rules',
      pages: [
        { sentences: [
          { text: `Boolean algebra is just like the algebra you did in school — with a twist. Variables have only two possible values: 0 or 1. Addition means OR. Multiplication means AND. Once you know those translations, most of what you learned in high school still works. Plus a few new rules unique to logic.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Boolean Algebra \u2014 Like School Algebra, But Logic', C().accent);
              b.drawCustom('translate', (g, NS, COL) => {
                const rows = [
                  ['+',  'OR'],
                  ['\u00B7 (multiply)', 'AND'],
                  ['0',  '\u201cfalse\u201d'],
                  ['1',  '\u201ctrue\u201d'],
                  ['\u00AC (overbar)', 'NOT'],
                ];
                rows.forEach((r, i) => {
                  const y = 240 + i * 40;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 440); a.setAttribute('y', y);
                  a.setAttribute('text-anchor', 'end');
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '18');
                  a.setAttribute('fill', COL.accent);
                  a.textContent = r[0]; g.appendChild(a);
                  const arrow = document.createElementNS(NS, 'text');
                  arrow.setAttribute('x', 480); arrow.setAttribute('y', y);
                  arrow.setAttribute('font-family', 'monospace');
                  arrow.setAttribute('font-size', '18');
                  arrow.setAttribute('fill', COL.edgeRise);
                  arrow.textContent = '\u2192'; g.appendChild(arrow);
                  const bTxt = document.createElementNS(NS, 'text');
                  bTxt.setAttribute('x', 520); bTxt.setAttribute('y', y);
                  bTxt.setAttribute('font-family', 'monospace');
                  bTxt.setAttribute('font-size', '18');
                  bTxt.setAttribute('font-weight', '700');
                  bTxt.setAttribute('fill', COL.edgeRise);
                  bTxt.textContent = r[1]; g.appendChild(bTxt);
                });
              });
              b.setLabel('Keep this translation table in your head. Everything else follows.', C().accent);
            } },

          { text: `Here are the rules you'll use most. First — the identity laws. X OR 0 equals X. X AND 1 equals X. Obvious. Combining with zero-for-OR or one-for-AND changes nothing.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Identity Laws', C().accent);
              b.drawCustom('laws', (g, NS, COL) => {
                const rows = [ 'X + 0 = X', 'X \u00B7 1 = X' ];
                rows.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 500); t.setAttribute('y', 280 + i * 60);
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '32');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', COL.edgeRise);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('The obvious ones. You\u2019ll use these constantly at the end of a simplification.', C().label);
            } },

          { text: `Next — the complement laws. X OR NOT-X equals 1. X AND NOT-X equals 0. This is the magic law. Whenever you see a variable alongside its own negation, they collapse. This is how most simplifications get their kick.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Complement Laws \u2014 The Magic Ones', C().edgeRise);
              b.drawCustom('laws', (g, NS, COL) => {
                const rows = [ 'X + \u00ACX = 1', 'X \u00B7 \u00ACX = 0' ];
                rows.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 500); t.setAttribute('y', 280 + i * 60);
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '32');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', COL.edgeRise);
                  t.textContent = l; g.appendChild(t);
                });
                const note = document.createElementNS(NS, 'text');
                note.setAttribute('x', 500); note.setAttribute('y', 420);
                note.setAttribute('text-anchor', 'middle');
                note.setAttribute('font-family', 'monospace');
                note.setAttribute('font-size', '15');
                note.setAttribute('fill', COL.accent);
                note.textContent = 'whenever X meets \u00ACX, the pair collapses';
                g.appendChild(note);
              });
              b.setLabel('If you remember ONE law today, make it this one. It\u2019s what makes simplification possible.', C().edgeRise);
            } },

          { text: `Then — distribution. A AND the quantity B OR C equals A-AND-B, OR, A-AND-C. Just like multiplying out in ordinary algebra. You can go the other way too: if you see shared factors, you can pull them out. That's called factoring.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Distribution (And Factoring In Reverse)', C().accent);
              b.drawCustom('law', (g, NS, COL) => {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', 500); t.setAttribute('y', 300);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '28');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', COL.edgeRise);
                t.textContent = 'A \u00B7 (B + C)  =  A\u00B7B  +  A\u00B7C';
                g.appendChild(t);
                const sub = document.createElementNS(NS, 'text');
                sub.setAttribute('x', 500); sub.setAttribute('y', 360);
                sub.setAttribute('text-anchor', 'middle');
                sub.setAttribute('font-family', 'monospace');
                sub.setAttribute('font-size', '14');
                sub.setAttribute('fill', COL.accent);
                sub.textContent = 'works both ways: expand OR factor';
                g.appendChild(sub);
              });
              b.setLabel('When you factor out a shared variable, you\u2019re applying distribution in reverse.', C().accent);
            } },

          { text: `De Morgan's Laws. NOT of A AND B equals NOT-A OR NOT-B. And NOT of A OR B equals NOT-A AND NOT-B. These let you convert ANDs into ORs and vice versa. Every real chip designer uses De Morgan's daily. Worth memorising.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('De Morgan\u2019s Laws', C().edgeRise);
              b.drawCustom('dm', (g, NS, COL) => {
                const rows = [ '\u00AC(A \u00B7 B)  =  \u00ACA  +  \u00ACB', '\u00AC(A + B)  =  \u00ACA \u00B7 \u00ACB' ];
                rows.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 500); t.setAttribute('y', 280 + i * 60);
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '26');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', COL.edgeRise);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('\u201cPush\u201d a NOT through an AND and it becomes an OR, and vice versa. Used all the time.', C().edgeRise);
            } },

          { text: `And finally — idempotent. X OR X equals X. X AND X equals X. Duplicates collapse. Boring but useful, because — and this is the trick — we can go the OTHER way too. We can WRITE IN a duplicate wherever it helps us factor something out. That's coming up in a moment.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Idempotent Law', C().accent);
              b.drawCustom('law', (g, NS, COL) => {
                const rows = [ 'X + X = X', 'X \u00B7 X = X' ];
                rows.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 500); t.setAttribute('y', 280 + i * 60);
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '32');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', COL.edgeRise);
                  t.textContent = l; g.appendChild(t);
                });
                const note = document.createElementNS(NS, 'text');
                note.setAttribute('x', 500); note.setAttribute('y', 430);
                note.setAttribute('text-anchor', 'middle');
                note.setAttribute('font-family', 'monospace');
                note.setAttribute('font-size', '14');
                note.setAttribute('fill', COL.accent);
                note.textContent = 'also means: we can DUPLICATE a term without changing the result';
                g.appendChild(note);
              });
              b.setLabel('Sneaky one. It lets us add duplicates, then factor across them. Watch for it.', C().accent);
            } },

          { text: `Learner question I can hear in the back row. "Do I have to memorise all of these?" No, actually. Memorise De Morgan's, memorise the complement law, and the rest are mostly common sense once you internalise that AND is like multiplying and OR is like adding. You'll just know.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('\u201cDo I Have To Memorise All Of These?\u201d', C().accent);
              b.drawNode('ans', 500, 280, 'memorise: De Morgan\u2019s + complement', C().edgeRise);
              b.drawNode('rest', 500, 330, 'the rest becomes intuitive with AND=\u00D7, OR=+', C().accent);
              b.setLabel('Two laws to really know cold. The rest you\u2019ll absorb by using them.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 4 — APPLY THE LAWS TO OUR EXAMPLE
    // ════════════════════════════════════════════════════
    {
      id: 4,
      title: 'Simplifying Our Circuit \u2014 Step By Step',
      pages: [
        { sentences: [
          { text: `Back to our expression. Y equals NOT-A-AND-B, plus A-AND-NOT-B, plus A-AND-B. Three product terms. Now let me show you how to shrink this. I'll do it slowly, one step at a time, naming each law I use.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Starting Expression', C().accent);
              b.drawCustom('eq', (g, NS, COL) => {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', 500); t.setAttribute('y', 320);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '30');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', COL.edgeRise);
                t.textContent = 'Y  =  \u00ACA\u00B7B  +  A\u00B7\u00ACB  +  A\u00B7B';
                g.appendChild(t);
              });
              b.setLabel('3 AND terms, 1 OR. Six gates total. Let\u2019s shrink it.', C().accent);
            } },

          { text: `First trick. Idempotent says X OR X equals X. Which means I'm allowed to write X twice without changing anything. So I'll duplicate the A-AND-B term. The expression now reads four terms — but the BEHAVIOR is identical.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 1 \u2014 Duplicate A\u00B7B (Idempotent)', C().accent);
              b.drawCustom('eq', (g, NS, COL) => {
                const lines = [
                  ['original:',   'Y  =  \u00ACA\u00B7B  +  A\u00B7\u00ACB  +  A\u00B7B'],
                  ['duplicate:',  'Y  =  \u00ACA\u00B7B  +  A\u00B7B  +  A\u00B7\u00ACB  +  A\u00B7B'],
                ];
                lines.forEach((l, i) => {
                  const y = 270 + i * 60;
                  const lbl = document.createElementNS(NS, 'text');
                  lbl.setAttribute('x', 140); lbl.setAttribute('y', y);
                  lbl.setAttribute('font-family', 'monospace');
                  lbl.setAttribute('font-size', '15');
                  lbl.setAttribute('fill', COL.label);
                  lbl.textContent = l[0]; g.appendChild(lbl);
                  const eq = document.createElementNS(NS, 'text');
                  eq.setAttribute('x', 260); eq.setAttribute('y', y);
                  eq.setAttribute('font-family', 'monospace');
                  eq.setAttribute('font-size', '22');
                  eq.setAttribute('font-weight', '700');
                  eq.setAttribute('fill', COL.edgeRise);
                  eq.textContent = l[1]; g.appendChild(eq);
                });
                const note = document.createElementNS(NS, 'text');
                note.setAttribute('x', 500); note.setAttribute('y', 410);
                note.setAttribute('text-anchor', 'middle');
                note.setAttribute('font-family', 'monospace');
                note.setAttribute('font-size', '14');
                note.setAttribute('fill', COL.accent);
                note.textContent = 'X + X = X  so duplicating doesn\u2019t change the answer';
                g.appendChild(note);
              });
              b.setLabel('Why did I do that? You\u2019ll see in the next step.', C().accent);
            } },

          { text: `Second step. Factoring. Look at the first two terms — NOT-A-AND-B, and, A-AND-B. They share the factor B. Pull it out. Look at the last two — A-AND-NOT-B, and, A-AND-B. They share A. Pull that out. So Y equals B times the quantity NOT-A plus A, plus, A times the quantity NOT-B plus B.`,
            dur: 18000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 2 \u2014 Factor Shared Variables', C().accent);
              b.drawCustom('eq', (g, NS, COL) => {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', 500); t.setAttribute('y', 290);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '22');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', COL.edgeRise);
                t.textContent = 'Y  =  B\u00B7(\u00ACA + A)  +  A\u00B7(\u00ACB + B)';
                g.appendChild(t);
                const note = document.createElementNS(NS, 'text');
                note.setAttribute('x', 500); note.setAttribute('y', 350);
                note.setAttribute('text-anchor', 'middle');
                note.setAttribute('font-family', 'monospace');
                note.setAttribute('font-size', '14');
                note.setAttribute('fill', COL.accent);
                note.textContent = 'distribution law, applied in reverse';
                g.appendChild(note);
              });
              b.setLabel('The two parentheses look familiar. And if you spot the pattern, the next step is a gift.', C().accent);
            } },

          { text: `Third step. Both parentheses have the complement pattern. NOT-A plus A equals 1. NOT-B plus B equals 1. Apply the complement law — and the equation collapses to Y equals B times 1, plus, A times 1.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 3 \u2014 Apply Complement Law', C().edgeRise);
              b.drawCustom('eq', (g, NS, COL) => {
                const t1 = document.createElementNS(NS, 'text');
                t1.setAttribute('x', 500); t1.setAttribute('y', 270);
                t1.setAttribute('text-anchor', 'middle');
                t1.setAttribute('font-family', 'monospace');
                t1.setAttribute('font-size', '22');
                t1.setAttribute('font-weight', '700');
                t1.setAttribute('fill', COL.edgeRise);
                t1.textContent = 'Y  =  B\u00B7(\u00ACA + A)  +  A\u00B7(\u00ACB + B)';
                g.appendChild(t1);
                const arrow = document.createElementNS(NS, 'text');
                arrow.setAttribute('x', 500); arrow.setAttribute('y', 320);
                arrow.setAttribute('text-anchor', 'middle');
                arrow.setAttribute('font-family', 'monospace');
                arrow.setAttribute('font-size', '18');
                arrow.setAttribute('fill', COL.accent);
                arrow.textContent = '\u2193  \u00ACX + X = 1';
                g.appendChild(arrow);
                const t2 = document.createElementNS(NS, 'text');
                t2.setAttribute('x', 500); t2.setAttribute('y', 370);
                t2.setAttribute('text-anchor', 'middle');
                t2.setAttribute('font-family', 'monospace');
                t2.setAttribute('font-size', '22');
                t2.setAttribute('font-weight', '700');
                t2.setAttribute('fill', COL.edgeRise);
                t2.textContent = 'Y  =  B\u00B71  +  A\u00B71';
                g.appendChild(t2);
              });
              b.setLabel('Both parentheses just vanished into plain 1s. Now the identity law closes it out.', C().edgeRise);
            } },

          { text: `Fourth and final step. Identity law. X AND 1 equals X. So B-AND-1 is just B. A-AND-1 is just A. And we end with Y equals A OR B. A single OR gate. From six gates to one. Same truth table. Same behavior.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 4 \u2014 Identity Closes It Out', C().edgeRise);
              b.drawCustom('final', (g, NS, COL) => {
                const t1 = document.createElementNS(NS, 'text');
                t1.setAttribute('x', 500); t1.setAttribute('y', 260);
                t1.setAttribute('text-anchor', 'middle');
                t1.setAttribute('font-family', 'monospace');
                t1.setAttribute('font-size', '22');
                t1.setAttribute('font-weight', '700');
                t1.setAttribute('fill', COL.accent);
                t1.textContent = 'Y  =  B\u00B71  +  A\u00B71';
                g.appendChild(t1);
                const arrow = document.createElementNS(NS, 'text');
                arrow.setAttribute('x', 500); arrow.setAttribute('y', 310);
                arrow.setAttribute('text-anchor', 'middle');
                arrow.setAttribute('font-family', 'monospace');
                arrow.setAttribute('font-size', '18');
                arrow.setAttribute('fill', COL.accent);
                arrow.textContent = '\u2193  X \u00B7 1 = X';
                g.appendChild(arrow);
                const t2 = document.createElementNS(NS, 'text');
                t2.setAttribute('x', 500); t2.setAttribute('y', 370);
                t2.setAttribute('text-anchor', 'middle');
                t2.setAttribute('font-family', 'monospace');
                t2.setAttribute('font-size', '34');
                t2.setAttribute('font-weight', '700');
                t2.setAttribute('fill', COL.edgeRise);
                t2.textContent = 'Y  =  A + B';
                g.appendChild(t2);
              });
              b.setLabel('From 6 gates to 1. Same behaviour. One OR. That\u2019s Boolean algebra in action.', C().edgeRise);
            } },

          { text: `And there it is. Same truth table. Six gates reduced to one OR. This is the whole point of Boolean algebra. Write the SOP expression from the truth table, then use the laws to SHRINK it down as small as you can. With practice, you do these steps almost unconsciously.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Before And After', C().edgeRise);
              b.drawGate('or', 'OR', 430, 270, 140, 100);
              b.drawNode('a', 400, 290, 'A', C().wireHi);
              b.drawNode('b', 400, 340, 'B', C().wireHi);
              b.drawWire('wa', [[410, 290],[430, 290]], C().wireHi);
              b.drawWire('wb', [[410, 340],[430, 340]], C().wireHi);
              b.drawWire('wy', [[570, 320],[730, 320]], C().edgeRise);
              b.drawNode('y', 740, 320, 'Y', C().edgeRise);
              b.drawNode('note', 500, 460, 'six gates \u2192 one OR. Same job. Way cheaper.', C().edgeRise);
              b.setLabel('Algebraic simplification works. But it\u2019s tedious. Let\u2019s see a faster tool next.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 5 — KARNAUGH MAPS
    // ════════════════════════════════════════════════════
    {
      id: 5,
      title: 'Karnaugh Maps \u2014 The Visual Shortcut',
      pages: [
        { sentences: [
          { text: `OK. Boolean algebra works. But let me be honest — picking the right law at each step takes practice. With more variables it gets messy fast. So in 1953, a guy named Maurice Karnaugh invented a visual shortcut. Draw the truth table on a grid in a clever way, look for patterns with your eyes, read off the simplification. It's called a Karnaugh map. K-map for short.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Maurice Karnaugh \u2014 1953 \u2014 The Visual Trick', C().edgeRise);
              b.drawNode('quote', 500, 300, '\u201cput the truth table on a grid, squint, spot patterns\u201d', C().accent);
              b.setLabel('Works by hand up to about 4 variables. Faster than algebra for most real problems.', C().accent);
            } },

          { text: `For our 2-variable truth table, we draw a 2-by-2 grid. Rows are A — top row A=0, bottom row A=1. Columns are B — left B=0, right B=1. Fill in each cell with the value of Y for that A-B combination. Your whole truth table becomes this little picture.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('K-Map For Our 2-Input Example', C().accent);
              _drawKMap2(b, { grid: [[0, 1], [1, 1]] });
              b.setLabel('Top-left 0 (both inputs 0). Everything else is 1. Same info as the truth table, rearranged.', C().accent);
            } },

          { text: `Now comes the trick. Look at the 1s and GROUP them into rectangles. Rectangles of size 2, 4, 8, 16 — power-of-2 sizes only. Bigger rectangles are better, they simplify more variables away. And here's the magic: each rectangle corresponds to one simplified product term.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Group The 1s Into Rectangles', C().edgeRise);
              _drawKMap2(b, {
                grid: [[0, 1], [1, 1]],
                highlightGroups: [
                  { cells: [[0, 1], [1, 1]], label: 'covers B-column (2 cells)', color: C().edgeRise },
                  { cells: [[1, 0], [1, 1]], label: 'covers A-row (2 cells)',    color: C().wireHi },
                ],
              });
              b.setLabel('Two rectangles cover the three 1s. They overlap at the corner. That\u2019s allowed \u2014 and encouraged.', C().edgeRise);
            } },

          { text: `What does each rectangle mean? Look at the B-column rectangle — all its cells have B equals 1, and A varies. So A is "don't care" in that group. Drop A. The rectangle becomes just B. Look at the A-row rectangle — all its cells have A equals 1, and B varies. Drop B. That rectangle becomes A. OR them together: Y equals A OR B. Same answer as the algebra, found in seconds by eye.`,
            dur: 19000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Read Off The Answer', C().edgeRise);
              _drawKMap2(b, {
                grid: [[0, 1], [1, 1]],
                highlightGroups: [
                  { cells: [[0, 1], [1, 1]], label: 'B', color: C().edgeRise },
                  { cells: [[1, 0], [1, 1]], label: 'A', color: C().wireHi },
                ],
              });
              b.drawNode('answer', 500, 500, 'Y  =  A + B', C().edgeRise);
              b.setLabel('Whichever input varies across a rectangle \u2014 drop it. Whichever stays constant \u2014 keep it.', C().edgeRise);
            } },

          { text: `Let me show you a bigger example — 3 inputs instead of 2. Classic circuit: the majority voter. Y is 1 when at least TWO of the three inputs are 1. Useful in real systems for fault-tolerance. Let's see the truth table.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Bigger Example \u2014 The Majority Voter', C().accent);
              b.drawTruthTable('tt', 340, 200, ['A','B','C','Y'], [
                [0,0,0,0],
                [0,0,1,0],
                [0,1,0,0],
                [0,1,1,1],
                [1,0,0,0],
                [1,0,1,1],
                [1,1,0,1],
                [1,1,1,1],
              ]);
              b.setLabel('Y = 1 whenever two or more of A, B, C are 1. Used in spacecraft for redundancy.', C().accent);
            } },

          { text: `The SOP form would be four product terms — A'BC, AB'C, ABC', ABC. Four AND gates of three inputs each, plus a big OR. That's the naive build. Now watch what the K-map does.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Naive SOP \u2014 4 Three-Input ANDs', C().accent);
              b.drawCustom('sop', (g, NS, COL) => {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', 500); t.setAttribute('y', 300);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '22');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', COL.accent);
                t.textContent = 'Y  =  \u00ACA\u00B7B\u00B7C  +  A\u00B7\u00ACB\u00B7C  +  A\u00B7B\u00B7\u00ACC  +  A\u00B7B\u00B7C';
                g.appendChild(t);
                const n = document.createElementNS(NS, 'text');
                n.setAttribute('x', 500); n.setAttribute('y', 360);
                n.setAttribute('text-anchor', 'middle');
                n.setAttribute('font-family', 'monospace');
                n.setAttribute('font-size', '14');
                n.setAttribute('fill', COL.label);
                n.textContent = '4 AND gates + 1 OR (5 gates, but big ones)';
                g.appendChild(n);
              });
              b.setLabel('Bulky. Let\u2019s see the K-map do it better.', C().accent);
            } },

          { text: `Here's the 3-variable K-map. Two rows for A. Four columns — and this is important — labelled in Gray code: 00, 01, 11, 10. Not the usual counting order. Why? Because adjacent cells must differ by just 1 bit — and Gray code is the sequence where consecutive numbers differ by exactly 1 bit. This is what makes rectangles of adjacent 1s give clean simplifications.`,
            dur: 17500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('3-Variable K-Map \u2014 Gray-Coded Columns', C().accent);
              _drawKMap3(b, { grid: [[0, 0, 1, 0], [0, 1, 1, 1]] });
              b.setLabel('Column order is 00 \u2192 01 \u2192 11 \u2192 10. One bit changes between adjacent columns.', C().accent);
            } },

          { text: `Now find the rectangles. Three pairs of adjacent 1s. Bottom row — the middle two cells, where A=1, B=1. That group is A-AND-B. Middle two columns — where B=1 and C=1 and A varies. That group is B-AND-C. And the right two cells of the bottom row, where A=1 and C=1. That's A-AND-C.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Three Overlapping Rectangles', C().edgeRise);
              _drawKMap3(b, {
                grid: [[0, 0, 1, 0], [0, 1, 1, 1]],
                highlightGroups: [
                  { cells: [[1, 1], [1, 2]], color: '#00ddff' },         // AB row pair
                  { cells: [[0, 2], [1, 2]], color: '#ff88cc' },         // BC column pair
                  { cells: [[1, 2], [1, 3]], color: '#ffcc33' },         // AC row pair
                ],
                groupLabels: [
                  { text: 'blue   \u2192 A\u00B7B    (bottom centre pair)',    color: '#00ddff' },
                  { text: 'pink   \u2192 B\u00B7C    (middle column pair)',    color: '#ff88cc' },
                  { text: 'yellow \u2192 A\u00B7C    (bottom right pair)',     color: '#ffcc33' },
                ],
              });
              b.setLabel('Three pairs. Three simplified terms. All four 1s covered. Overlaps are fine.', C().edgeRise);
            } },

          { text: `OR them together. Y equals A-AND-B, OR, B-AND-C, OR, A-AND-C. Three 2-input ANDs plus one OR. Same circuit as the ugly SOP — but half the gates, and each AND is 2-input instead of 3-input. Cheaper, faster, smaller. All by looking at a picture and drawing some rectangles.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Read Off The Answer', C().edgeRise);
              b.drawCustom('final', (g, NS, COL) => {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', 500); t.setAttribute('y', 300);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '32');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', COL.edgeRise);
                t.textContent = 'Y  =  A\u00B7B  +  B\u00B7C  +  A\u00B7C';
                g.appendChild(t);
                const n = document.createElementNS(NS, 'text');
                n.setAttribute('x', 500); n.setAttribute('y', 360);
                n.setAttribute('text-anchor', 'middle');
                n.setAttribute('font-family', 'monospace');
                n.setAttribute('font-size', '14');
                n.setAttribute('fill', COL.accent);
                n.textContent = '3 two-input ANDs + 1 OR \u2014 cheaper than 4 three-input ANDs + 1 OR';
                g.appendChild(n);
              });
              b.setLabel('By eye, in under a minute. Done. That\u2019s the power of K-maps.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 — RECAP + TEASER FOR THE CU
    // ════════════════════════════════════════════════════
    {
      id: 6,
      title: 'Recap \u2014 And Where This Takes Us',
      pages: [
        { sentences: [
          { text: `Alright. Let's wrap up. Two tools for shrinking combinational circuits. Boolean algebra — the algebraic laws — and Karnaugh maps — the visual shortcut. Both do the same job: take a Sum-Of-Products expression from a truth table, and find an equivalent expression with fewer gates.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Recap \u2014 Two Tools For The Same Job', C().edgeRise);
              b.drawBox('t1', 100, 240, 380, 180, 'BOOLEAN ALGEBRA\n\nrewrite via laws\nprecise, takes practice', C().edgeRise);
              b.drawBox('t2', 520, 240, 380, 180, 'KARNAUGH MAPS\n\nvisual rectangles\nfast, up to ~4 variables', C().edgeRise);
              b.setLabel('Different methods, same output. Both are standard tools.', C().accent);
            } },

          { text: `Important caveat. K-maps by hand are practical up to 4 variables. At 5, they get awkward. Beyond 5, forget it. Real chip designers use software — algorithms called ESPRESSO and Quine-McCluskey — that minimize arbitrarily large Boolean expressions for you. Every CPU ever produced went through some form of this step.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Limits Of Hand Tools', C().accent);
              b.drawCustom('limits', (g, NS, COL) => {
                const lines = [
                  '\u2022 2 vars   \u2192 K-map: easy',
                  '\u2022 3 vars   \u2192 K-map: still easy',
                  '\u2022 4 vars   \u2192 K-map: manageable (2D, gets busy)',
                  '\u2022 5 vars   \u2192 K-map: awkward (needs split maps)',
                  '\u2022 6+ vars  \u2192 use software (ESPRESSO, Quine-McCluskey)',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 180); t.setAttribute('y', 240 + i * 38);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '15');
                  t.setAttribute('fill', i < 3 ? COL.edgeRise : (i === 3 ? COL.accent : COL.wireHi));
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Hand tools give intuition. Software handles scale. Both exist because both are useful.', C().accent);
            } },

          { text: `Why does any of this matter to us? Because the next lesson is the Control Unit. The CU is a big combinational circuit — a huge lookup from opcode and T-state into control signals. Real CUs have many inputs and many outputs. And the designers who built them ABSOLUTELY used Boolean algebra and K-maps — or their software equivalents — to minimize it. Otherwise the gate count would be insane.`,
            dur: 17000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Where This Takes Us \u2014 The Control Unit', C().edgeRise);
              b.drawBox('cu', 320, 220, 360, 200, 'CONTROL UNIT\n\n(mostly combinational)\n\ntake opcode + T-state\nproduce control signals', C().edgeRise);
              b.setLabel('The CU is a giant combinational lookup. Simplification is how it fits on a real chip.', C().edgeRise);
            } },

          { text: `So next lesson, we finally build the CU. And when we do, you'll see Boolean algebra and K-maps working in the background — shrinking the microcode-decode logic into something a chip can actually fit. See you there, class.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Next Lesson \u2014 The Control Unit', C().edgeRise);
              b.drawNode('end', 500, 310, 'the conductor \u2014 the one who orchestrates everything', C().accent);
              b.drawNode('see', 500, 370, 'end of lesson 12. See you in lesson 13.', C().edgeRise);
              b.setLabel('Good work today. Take a break. Let Boolean algebra settle in your brain. See you next time.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
      isFinal: true,
    },
  ];

  if (typeof window !== 'undefined') {
    window.BLOCKS_12_SCENES = BLOCKS_12_SCENES;
  }
})();
