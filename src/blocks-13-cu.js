/**
 * Series B — Episode 13: The Control Unit
 * ----------------------------------------
 * The capstone of Series B.  Classroom-voice walkthrough of the conductor
 * of the CPU — the one block that ties every prior building block into a
 * running machine.  Inside the CU: a microcode ROM (combinational decode),
 * a T-state counter (sequential), and a bit of flag-masking logic for
 * conditional branches.  Every prior lesson shows up inside this one.
 *
 * Arc:
 *   1. Welcome + conductor analogy
 *   2. What the CU takes in and puts out
 *   3. The microcode ROM — the big lookup table
 *   4. Walk through ADD, beat by beat
 *   5. The T-state counter (the one sequential piece)
 *   6. Conditional branches — flag-masking
 *   7. Microcoded vs hardwired — two philosophies
 *   8. Recap + end of Series B
 */

(function () {
  'use strict';

  const B = () => window.Blocks;
  const C = () => window.Blocks && window.Blocks.COL;

  // Helper — draw a simplified microcode table: rows = opcode, cols = T-state.
  // cells: optional 2D array of strings to show in each cell; otherwise dots.
  function _drawMicrocodeTable(b, opts) {
    opts = opts || {};
    const rows = opts.rows || [
      ['LDA', ['CO|MI', 'RO|II|CE', 'CO|MI', 'RO|MI|CE', 'RO|AI', '', '', '']],
      ['ADD', ['CO|MI', 'RO|II|CE', 'CO|MI', 'RO|MI|CE', 'RO|BI', 'EO|AI|FI', '', '']],
      ['SUB', ['CO|MI', 'RO|II|CE', 'CO|MI', 'RO|MI|CE', 'RO|BI', 'EO|AI|SU|FI','',  '']],
      ['JMP', ['CO|MI', 'RO|II|CE', 'CO|MI', 'RO|J',      '',      '',           '', '']],
      ['OUT', ['CO|MI', 'RO|II|CE', 'AO|OI', '',          '',      '',           '', '']],
      ['HLT', ['CO|MI', 'RO|II|CE', 'HLT',   '',          '',      '',           '', '']],
    ];
    const highlight = opts.highlight; // [rowName, colIdx] or null
    const col = C();
    b.drawCustom('mc-table', (g, NS, COL) => {
      const x0 = 60, y0 = 180;
      const rowH = 40;
      const colW = 115;
      const labelW = 90;
      // Column headers
      for (let c = 0; c < 8; c++) {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x0 + labelW + c * colW + colW / 2);
        t.setAttribute('y', y0 - 8);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '11');
        t.setAttribute('font-weight', '700');
        t.setAttribute('fill', COL.accent);
        t.textContent = 'T' + c;
        g.appendChild(t);
      }
      // Rows
      rows.forEach((row, r) => {
        const yr = y0 + r * rowH;
        // Row label (opcode name)
        const lbl = document.createElementNS(NS, 'text');
        lbl.setAttribute('x', x0 + labelW - 8); lbl.setAttribute('y', yr + 24);
        lbl.setAttribute('text-anchor', 'end');
        lbl.setAttribute('font-family', 'monospace');
        lbl.setAttribute('font-size', '13');
        lbl.setAttribute('font-weight', '700');
        lbl.setAttribute('fill', COL.edgeRise);
        lbl.textContent = row[0];
        g.appendChild(lbl);
        for (let c = 0; c < 8; c++) {
          const val = row[1][c];
          const isHl = highlight && highlight[0] === row[0] && highlight[1] === c;
          const rect = document.createElementNS(NS, 'rect');
          rect.setAttribute('x', x0 + labelW + c * colW);
          rect.setAttribute('y', yr + 4);
          rect.setAttribute('width', colW - 2);
          rect.setAttribute('height', rowH - 8);
          rect.setAttribute('rx', 2);
          rect.setAttribute('fill', isHl ? COL.edgeRise : COL.panel);
          rect.setAttribute('opacity', isHl ? '0.5' : '1');
          rect.setAttribute('stroke', val ? COL.gateEdge : COL.dim);
          rect.setAttribute('stroke-width', '1');
          g.appendChild(rect);
          if (val) {
            const t = document.createElementNS(NS, 'text');
            t.setAttribute('x', x0 + labelW + c * colW + (colW - 2) / 2);
            t.setAttribute('y', yr + 25);
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('font-family', 'monospace');
            t.setAttribute('font-size', '10');
            t.setAttribute('font-weight', isHl ? '700' : '400');
            t.setAttribute('fill', isHl ? COL.textPrimary || '#fff' : COL.accent);
            t.textContent = val;
            g.appendChild(t);
          }
        }
      });
    });
  }

  const BLOCKS_13_SCENES = [

    // ════════════════════════════════════════════════════
    // SCENE 1 — WELCOME + CONDUCTOR ANALOGY
    // ════════════════════════════════════════════════════
    {
      id: 1,
      title: 'Welcome — Meet The Conductor',
      pages: [
        { sentences: [
          { text: `Welcome back, class. This is lesson 13. The last lesson in Series B. And today we're going to build the most important block of the whole CPU — the Control Unit. The CU. The brain. The conductor. The block that ties every other piece we've built into a machine that actually EXECUTES instructions.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Lesson 13 \u2014 The Control Unit', C().edgeRise);
              b.drawBox('cu', 340, 240, 320, 180, 'CONTROL UNIT\n\n"the conductor"', C().edgeRise);
              b.setLabel('The final piece of the Series B puzzle. Everything we\u2019ve learned comes together here.', C().accent);
            } },

          { text: `Quick analogy to open with. Picture an orchestra. Dozens of musicians. Violins. Horns. Drums. Each player is TECHNICALLY capable of making sound — they know their instrument, they can read music. But imagine them all in the same room with no conductor. No one knows who plays when. Total chaos.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('An Orchestra Without A Conductor', C().accent);
              b.drawCustom('orch', (g, NS, COL) => {
                const players = ['\u266A violins','\u266A cellos','\u266A horns','\u266A timpani','\u266A flutes','\u266A trumpets'];
                players.forEach((p, i) => {
                  const x = 140 + (i % 3) * 250;
                  const y = 260 + Math.floor(i / 3) * 90;
                  const rect = document.createElementNS(NS, 'rect');
                  rect.setAttribute('x', x); rect.setAttribute('y', y);
                  rect.setAttribute('width', 180); rect.setAttribute('height', 60);
                  rect.setAttribute('rx', 5);
                  rect.setAttribute('fill', COL.panel);
                  rect.setAttribute('stroke', COL.accent);
                  rect.setAttribute('stroke-width', '1.5');
                  g.appendChild(rect);
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', x + 90); t.setAttribute('y', y + 38);
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '14');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = p; g.appendChild(t);
                });
              });
              b.setLabel('Each player is capable. But without coordination, it\u2019s noise.', C().label);
            } },

          { text: `Add the conductor. Now the violins play HERE, the horns come in THERE, the timpani holds silence for sixteen bars and then crashes at the right moment. Same musicians. Same instruments. Completely different result — because somebody is orchestrating.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('\u2026 Now Add A Conductor', C().edgeRise);
              b.drawCustom('conductor', (g, NS, COL) => {
                const cx = 500, cy = 260;
                const circle = document.createElementNS(NS, 'circle');
                circle.setAttribute('cx', cx); circle.setAttribute('cy', cy);
                circle.setAttribute('r', 28);
                circle.setAttribute('fill', COL.edgeRise);
                circle.setAttribute('stroke', '#000'); circle.setAttribute('stroke-width', '1');
                g.appendChild(circle);
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', cx); t.setAttribute('y', cy + 6);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '20');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', '#000');
                t.textContent = 'CU';
                g.appendChild(t);
                // Arrows to "musicians"
                const dests = [ [200, 400], [400, 450], [600, 450], [800, 400] ];
                dests.forEach((d, i) => {
                  const w = document.createElementNS(NS, 'line');
                  w.setAttribute('x1', cx); w.setAttribute('y1', cy + 28);
                  w.setAttribute('x2', d[0]); w.setAttribute('y2', d[1]);
                  w.setAttribute('stroke', COL.edgeRise);
                  w.setAttribute('stroke-width', '1.5');
                  w.setAttribute('opacity', '0.7');
                  g.appendChild(w);
                });
                ['REG','ALU','RAM','OUT'].forEach((name, i) => {
                  const [dx, dy] = dests[i];
                  const rect = document.createElementNS(NS, 'rect');
                  rect.setAttribute('x', dx - 40); rect.setAttribute('y', dy);
                  rect.setAttribute('width', 80); rect.setAttribute('height', 44);
                  rect.setAttribute('rx', 4);
                  rect.setAttribute('fill', COL.panel);
                  rect.setAttribute('stroke', COL.accent);
                  g.appendChild(rect);
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', dx); t.setAttribute('y', dy + 28);
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '13');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = name; g.appendChild(t);
                });
              });
              b.setLabel('The conductor is the CU. The musicians are the CPU\u2019s other blocks. Same hardware \u2014 now actually playing music.', C().edgeRise);
            } },

          { text: `In a CPU, it's the exact same idea. The registers, the ALU, the RAM, the PC, the flags — they're all capable of doing things. But none of them knows on their own who should be active THIS INSTANT. Somebody has to tell them. That somebody is the Control Unit.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The CU Tells Everyone Who Plays When', C().edgeRise);
              b.drawBox('cu', 340, 200, 320, 100, 'CONTROL UNIT', C().edgeRise);
              b.drawCustom('out-arrows', (g, NS, COL) => {
                const targets = ['REG A','REG B','ALU','RAM','PC','IR','FLAGS','OUT'];
                targets.forEach((name, i) => {
                  const col = i % 4;
                  const row = Math.floor(i / 4);
                  const x = 140 + col * 200;
                  const y = 360 + row * 80;
                  const rect = document.createElementNS(NS, 'rect');
                  rect.setAttribute('x', x); rect.setAttribute('y', y);
                  rect.setAttribute('width', 140); rect.setAttribute('height', 50);
                  rect.setAttribute('rx', 4);
                  rect.setAttribute('fill', COL.panel);
                  rect.setAttribute('stroke', COL.accent);
                  g.appendChild(rect);
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', x + 70); t.setAttribute('y', y + 30);
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '13');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = name; g.appendChild(t);
                  // Arrow from CU down
                  const line = document.createElementNS(NS, 'line');
                  line.setAttribute('x1', 500); line.setAttribute('y1', 300);
                  line.setAttribute('x2', x + 70); line.setAttribute('y2', y);
                  line.setAttribute('stroke', COL.edgeRise);
                  line.setAttribute('stroke-width', '1');
                  line.setAttribute('opacity', '0.5');
                  g.appendChild(line);
                });
              });
              b.setLabel('Every block takes orders from the CU. Every cycle. That\u2019s how the CPU runs.', C().accent);
            } },

          { text: `Every single thing that happens in a CPU — a register loaded, a number added, a jump taken, a byte written — happens because the CU told someone to do it this cycle. And it happens billions of times a second, without getting confused. So the question is: how? How does the CU stay organized? That's what today is about. Let's go.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Question We\u2019ll Answer Today', C().edgeRise);
              b.drawNode('q1', 500, 280, 'how does the CU stay organised?', C().accent);
              b.drawNode('q2', 500, 330, 'how does it fire the right signals at the right time?', C().accent);
              b.drawNode('q3', 500, 380, 'billions of times per second, no mistakes?', C().accent);
              b.setLabel('By the end of this lesson, you\u2019ll know. And it\u2019s simpler than you\u2019d think.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 2 — INPUTS AND OUTPUTS
    // ════════════════════════════════════════════════════
    {
      id: 2,
      title: 'What Goes In, What Comes Out',
      pages: [
        { sentences: [
          { text: `Let's start with the basics. What does the CU take in, and what does it produce? I want you to picture a black box. Inputs on the left. Outputs on the right. Figure out its contract first, before we look inside.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The CU As A Black Box', C().accent);
              b.drawBox('cu', 320, 240, 360, 220, 'CONTROL UNIT\n\n\u2753 what\u2019s inside?', C().edgeRise);
              b.drawNode('in',  260, 340, 'inputs \u2192', C().accent);
              b.drawNode('out', 740, 340, '\u2192 outputs', C().accent);
              b.setLabel('Black box first. Guts later.', C().label);
            } },

          { text: `Three inputs. First: the opcode — 8 bits, from the Instruction Register. This tells the CU "what instruction are we running right now?" ADD, JMP, LDA, whatever. This is the WHAT.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Input 1 \u2014 Opcode (8 bits)', C().accent);
              b.drawBox('cu', 380, 240, 300, 220, 'CONTROL UNIT', C().edgeRise);
              b.drawNode('op-l', 180, 280, 'OPCODE (8 bits)', C().wireHi);
              b.drawWire('w-op', [[260, 280],[380, 280]], C().wireHi);
              b.drawNode('from', 180, 310, 'from the IR', C().label);
              b.drawNode('ans', 500, 500, '\u201cWhat instruction are we running right now?\u201d', C().accent);
              b.setLabel('The CU needs to know: ADD? JMP? LDA? It finds out via the opcode wire.', C().accent);
            } },

          { text: `Second input: the T-state. 3 bits, counting from 0 to 7. Every instruction is made of several clock steps. The CU needs to know which STEP of the current instruction we're on. This is the WHEN.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Input 2 \u2014 T-State (3 bits)', C().accent);
              b.drawBox('cu', 380, 240, 300, 220, 'CONTROL UNIT', C().edgeRise);
              b.drawNode('ts-l', 180, 340, 'T-STATE (3 bits)', C().wireHi);
              b.drawWire('w-ts', [[260, 340],[380, 340]], C().wireHi);
              b.drawNode('from', 180, 370, 'from a counter inside', C().label);
              b.drawNode('ans', 500, 500, '\u201cWhich step of the current instruction are we on?\u201d', C().accent);
              b.setLabel('Every instruction happens over several T-states. The CU has to know which one.', C().accent);
            } },

          { text: `Third input: the flags. Usually the carry and zero flags, one bit each. These come BACK from the ALU. The CU uses them for conditional decisions — jumps that only happen if a certain flag is set. This is the MAYBE.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Input 3 \u2014 Flags (from the ALU)', C().accent);
              b.drawBox('cu', 380, 240, 300, 220, 'CONTROL UNIT', C().edgeRise);
              b.drawNode('f-l', 180, 400, 'FLAGS (CF, ZF)', C().wireHi);
              b.drawWire('w-f', [[260, 400],[380, 400]], C().wireHi);
              b.drawNode('from', 180, 430, 'from the flags register', C().label);
              b.drawNode('ans', 500, 500, '\u201cShould we take this conditional branch?\u201d', C().accent);
              b.setLabel('Without flags, the CU can\u2019t do conditional jumps. These are its \u201cmaybe\u201d inputs.', C().accent);
            } },

          { text: `Now the outputs. Many. In our Extended SAP-1, there are 28 control signals. CO, MI, RO, II, AI, AO, BI, BO, EO, SU — you know all of these by now. Each one is a single wire that either fires or doesn't. Together they tell every other component what to do right now.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Outputs \u2014 28 Control Signals', C().accent);
              b.drawBox('cu', 240, 240, 300, 220, 'CONTROL UNIT', C().edgeRise);
              b.drawCustom('sigs', (g, NS, COL) => {
                const signals = ['CO','CE','MI','RO','RI','II','IO','AI','AO','BI','BO','EO','SU','OI','FI','HLT','J','ANDI','ORI','XORI','SHLI','SHRI','PCI','SPO','SPI','SPD','SPUP','INO'];
                signals.forEach((s, i) => {
                  const col = i % 4;
                  const row = Math.floor(i / 4);
                  const x = 600 + col * 80;
                  const y = 260 + row * 26;
                  const rect = document.createElementNS(NS, 'rect');
                  rect.setAttribute('x', x); rect.setAttribute('y', y);
                  rect.setAttribute('width', 72); rect.setAttribute('height', 20);
                  rect.setAttribute('rx', 2);
                  rect.setAttribute('fill', COL.panel);
                  rect.setAttribute('stroke', COL.edgeRise);
                  rect.setAttribute('stroke-width', '0.8');
                  g.appendChild(rect);
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', x + 36); t.setAttribute('y', y + 15);
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '10');
                  t.setAttribute('fill', COL.edgeRise);
                  t.textContent = s; g.appendChild(t);
                });
              });
              b.setLabel('Each signal is a single wire. Fires = 1, idle = 0. Together they run the whole show.', C().accent);
            } },

          { text: `So the CU's job, stated precisely: given the opcode, the T-state, and the flags — figure out which of those 28 signals should be on right now. Produce the right 28-bit output. Correct answer. Every cycle. Every combination. That's the problem. Now let's see how it's solved.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Job, Stated Precisely', C().edgeRise);
              b.drawCustom('job', (g, NS, COL) => {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', 500); t.setAttribute('y', 300);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '20');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', COL.edgeRise);
                t.textContent = '(opcode, T-state, flags)  \u2192  28-bit control word';
                g.appendChild(t);
                const s = document.createElementNS(NS, 'text');
                s.setAttribute('x', 500); s.setAttribute('y', 350);
                s.setAttribute('text-anchor', 'middle');
                s.setAttribute('font-family', 'monospace');
                s.setAttribute('font-size', '15');
                s.setAttribute('fill', COL.accent);
                s.textContent = 'this is a LOOKUP problem. inputs in, outputs out.';
                g.appendChild(s);
              });
              b.setLabel('Sound familiar? This is exactly what combinational logic is for.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 3 — THE MICROCODE ROM
    // ════════════════════════════════════════════════════
    {
      id: 3,
      title: 'The Microcode ROM \u2014 A Big Lookup Table',
      pages: [
        { sentences: [
          { text: `Here's the brilliant idea. Since the CU's job is just "given inputs, produce outputs," and the inputs come from a finite set — we could just STORE the answer. For every possible combination of opcode and T-state, pre-compute the right output, and write it down in a big table. Then at runtime, just look it up.`,
            dur: 17000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Idea \u2014 Just Store The Answer', C().edgeRise);
              b.drawNode('idea', 500, 300, 'pre-compute every (opcode, T-state) \u2192 control word', C().edgeRise);
              b.drawNode('store', 500, 350, 'put it all in a table', C().accent);
              b.drawNode('use', 500, 400, 'at runtime: just look it up', C().accent);
              b.setLabel('A classic engineering trade \u2014 trade memory for simplicity.', C().accent);
            } },

          { text: `That table has a name. We call it the microcode ROM. "ROM" because it's read-only memory — we burn the values in at design time and they don't change. "Microcode" because each row is a tiny program — a sequence of micro-operations that implement one machine instruction. Elegant name. Elegant idea.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Microcode ROM \u2014 The Name Explained', C().accent);
              b.drawCustom('etym', (g, NS, COL) => {
                const rows = [
                  ['ROM',       'read-only memory',          '\u2190 burned in at design time'],
                  ['Microcode', 'a tiny program',            '\u2190 each row is a micro-op sequence'],
                ];
                rows.forEach((r, i) => {
                  const y = 270 + i * 80;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 220); a.setAttribute('y', y);
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '22');
                  a.setAttribute('font-weight', '700');
                  a.setAttribute('fill', COL.edgeRise);
                  a.textContent = r[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 420); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '15');
                  b_.setAttribute('fill', COL.accent);
                  b_.textContent = r[1]; g.appendChild(b_);
                  const c = document.createElementNS(NS, 'text');
                  c.setAttribute('x', 440); c.setAttribute('y', y + 22);
                  c.setAttribute('font-family', 'monospace');
                  c.setAttribute('font-size', '12');
                  c.setAttribute('fill', COL.label);
                  c.textContent = r[2]; g.appendChild(c);
                });
              });
              b.setLabel('Each instruction\u2019s microcode row is literally its \u201cprogram\u201d, one layer deeper than assembly.', C().accent);
            } },

          { text: `Let me show you what the table actually looks like. Here are six of our instructions. Each row is an opcode — LDA, ADD, SUB, JMP, OUT, HLT. Each column is a T-state from 0 to 7. Each cell is the control word — the signals that fire at that instruction-and-step combination.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Microcode Table (Sample)', C().accent);
              _drawMicrocodeTable(b);
              b.setLabel('Rows = opcodes. Columns = T-states. Cells = signals to fire. All pre-computed.', C().accent);
            } },

          { text: `Look at the first two columns. T0 and T1. Notice something? They're IDENTICAL across every row. T0 fires CO and MI. T1 fires RO, II, and CE. Every single instruction starts the same way. Why? Because every instruction needs to first FETCH its opcode byte from RAM. The fetch is the same ritual regardless of what you're fetching.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('T0 and T1 \u2014 The Fetch, Same For All', C().edgeRise);
              _drawMicrocodeTable(b);
              b.setLabel('T0: CO|MI  (PC \u2192 MAR).  T1: RO|II|CE  (RAM \u2192 IR, PC++).  Every single instruction.', C().edgeRise);
            } },

          { text: `And burn this in deep. T0 and T1 fire FOREVER. Every cycle. Every trip around the counter. No exceptions, no off-switch except HLT. The CPU has no concept of "valid program" or "garbage" \u2014 it just blindly fetches whatever byte PC currently points at, treats it as an opcode, and runs it. That eternal fetch loop IS what "CPU running" means. Nothing more, nothing less.`,
            dur: 17000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('T0 / T1 Fire Forever \u2014 The Heartbeat', C().edgeRise);
              b.drawNode('a', 500, 240, 'T0: CO|MI   \u2014 PC drives addr, MAR captures', C().edgeRise);
              b.drawNode('b', 500, 280, 'T1: RO|II|CE \u2014 RAM \u2192 IR, then PC++', C().edgeRise);
              b.drawNode('c', 500, 325, 'T2..T5: execute whatever opcode landed in IR', C().accent);
              b.drawNode('d', 500, 370, 'wrap to T0 \u2192 do it all again \u2192 forever', C().wireHi);
              b.drawNode('e', 500, 415, 'CPU never asks \u201cis this a valid program?\u201d \u2014 it just fetches', C().wireHot);
              b.drawNode('f', 500, 455, 'only HLT can stop the loop \u2014 by gating the clock itself', C().wireHot);
              b.setLabel('This unconditional, unending loop is the entire definition of \u201cCPU running.\u201d', C().edgeRise);
            } },

          { text: `Now look at T2 and beyond. THIS is where instructions diverge. ADD does one thing. SUB does another. JMP does a third. Each opcode's microcode tells the CPU how to implement that specific instruction — its unique sequence of micro-operations after the fetch.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('T2 Onward \u2014 Execute Phase, Where Instructions Differ', C().accent);
              _drawMicrocodeTable(b);
              b.setLabel('Same fetch for all. Unique execute per instruction. That\u2019s the pattern.', C().accent);
            } },

          { text: `And the CU in hardware? It really IS a ROM chip. You feed the opcode and T-state into the ROM's address pins. The ROM outputs a 28-bit word — the control signals for this exact moment. No fancy logic. Just a lookup. That's why it's called microcoded.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The ROM Is Literally The CU', C().edgeRise);
              b.drawBox('rom', 340, 240, 320, 200, 'MICROCODE ROM\n\n256 rows \u00D7 8 cols\n= 2048 control words', C().edgeRise);
              b.drawNode('in', 260, 300, 'opcode + T-state \u2192', C().wireHi);
              b.drawNode('out', 740, 340, '\u2192 28-bit control word', C().edgeRise);
              b.setLabel('Address pins = (opcode, T-state). Output pins = the control signals. Just a ROM.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 4 — WALK THROUGH ADD
    // ════════════════════════════════════════════════════
    {
      id: 4,
      title: 'Walking Through ADD \u2014 Beat By Beat',
      pages: [
        { sentences: [
          { text: `Let's make this concrete. Pick one instruction and walk through it. Beat by beat. Every T-state, every signal, every component change. We'll use ADD — it's a good middle-complexity example. The instruction ADD addr means: take the value at that address in RAM, add it to register A, put the result back in A.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Example \u2014 ADD addr', C().accent);
              b.drawCustom('instr', (g, NS, COL) => {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', 500); t.setAttribute('y', 300);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '32');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', COL.edgeRise);
                t.textContent = 'A \u2190 A + RAM[addr]';
                g.appendChild(t);
                const sub = document.createElementNS(NS, 'text');
                sub.setAttribute('x', 500); sub.setAttribute('y', 360);
                sub.setAttribute('text-anchor', 'middle');
                sub.setAttribute('font-family', 'monospace');
                sub.setAttribute('font-size', '15');
                sub.setAttribute('fill', COL.accent);
                sub.textContent = 'a 2-byte instruction: opcode byte, then address byte';
                g.appendChild(sub);
              });
              b.setLabel('We\u2019ll follow it through all six T-states it uses.', C().accent);
            } },

          { text: `T0. The CU fires CO and MI. CO tells the Program Counter to drive its current value onto the address bus. MI tells the MAR to capture whatever's on that bus. Result — the MAR now holds the PC's value. We've queued up a read from the instruction's first byte.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('T0 \u2014 CO | MI  (PC \u2192 MAR)', C().edgeRise);
              _drawMicrocodeTable(b, { highlight: ['ADD', 0] });
              b.setLabel('Two signals fire. PC drives address bus. MAR captures. Ready to read RAM.', C().edgeRise);
            } },

          { text: `T1. CU fires RO, II, and CE. RO — RAM drives the byte at the MAR-addressed location onto the data bus. II — the IR captures the opcode byte. CE — the PC increments, now pointing at the next byte. Result — the ADD opcode is now in the IR. PC has advanced.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('T1 \u2014 RO | II | CE  (RAM \u2192 IR, PC++)', C().edgeRise);
              _drawMicrocodeTable(b, { highlight: ['ADD', 1] });
              b.setLabel('Opcode arrives in IR. PC moves on. Fetch complete. Now the execute phase begins.', C().edgeRise);
            } },

          { text: `T2. CU fires CO and MI again. Same pattern as T0 — PC drives the address bus, MAR captures. But this time, we're fetching the OPERAND byte — the address that ADD needs to work with. MAR now points at the operand byte in RAM.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('T2 \u2014 CO | MI  (PC \u2192 MAR, for operand fetch)', C().accent);
              _drawMicrocodeTable(b, { highlight: ['ADD', 2] });
              b.setLabel('Same CO|MI combo as T0, different purpose. We\u2019re fetching the operand now.', C().accent);
            } },

          { text: `T3. RO, MI, and CE. RAM drives the operand byte onto the data bus. Then — here's the clever part — MI fires again, so the MAR captures THAT value. The operand byte was an ADDRESS, and now that address is in the MAR. CE also fires to advance PC past the operand. MAR is now pointing at the actual data we want.`,
            dur: 17500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('T3 \u2014 RO | MI | CE  (operand \u2192 MAR, PC++)', C().accent);
              _drawMicrocodeTable(b, { highlight: ['ADD', 3] });
              b.setLabel('A subtle move \u2014 the operand byte goes THROUGH the data bus into MAR. Now MAR = real addr.', C().accent);
            } },

          { text: `T4. RO and BI. RAM drives the byte at MAR's new address onto the data bus — that's the value we want to add. BI tells the B register to capture it. Now B holds the operand's value.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('T4 \u2014 RO | BI  (RAM[addr] \u2192 B)', C().accent);
              _drawMicrocodeTable(b, { highlight: ['ADD', 4] });
              b.setLabel('The value we want to add is now parked in register B. A holds the other operand. ALU is ready.', C().accent);
            } },

          { text: `T5. EO, AI, and FI. EO tells the ALU to drive its result — A plus B — onto the data bus. AI tells register A to capture. FI tells the flags register to capture the zero and carry flags. And just like that — A now holds A+B, and the flags reflect whether it overflowed or produced zero. Done.`,
            dur: 15500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('T5 \u2014 EO | AI | FI  (ALU \u2192 A, flags updated)', C().edgeRise);
              _drawMicrocodeTable(b, { highlight: ['ADD', 5] });
              b.setLabel('The arithmetic happens in one cycle. 3 signals fire together. A gets the sum. Flags update. Done.', C().edgeRise);
            } },

          { text: `Six T-states. Six control words. All pre-computed, sitting in the microcode ROM. And every single one of them was just the CU reading the row for (opcode equals ADD, T-state equals whatever) and firing the bits that were 1. That's the whole CU. Just look up, fire, repeat.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Six Steps, All Pre-Computed', C().edgeRise);
              _drawMicrocodeTable(b);
              b.setLabel('No magic. Just a ROM read, once per clock. The whole ADD instruction is in one row of the table.', C().edgeRise);
            } },

          { text: `And what happens AFTER T5? The counter wraps to T0 of the next cycle. T0 does MAR \u2190 PC again \u2014 but PC isn't what it was. It was incremented during T1 and T3 of THIS instruction. So the next fetch lands on the NEXT instruction in RAM. That's how programs march forward: PC gets bumped during the fetch, and T0 of the next cycle blindly reads from wherever PC now points. T0 never "knows" what instruction came before.`,
            dur: 17000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('T5 Done \u2192 Counter Wraps \u2192 Next Instruction Fetched', C().edgeRise);
              b.drawNode('s1', 500, 245, 'T5 completes \u2014 counter advances \u2014 back to T0', C().edgeRise);
              b.drawNode('s2', 500, 290, 'T0: MAR \u2190 PC  (PC was bumped by CE earlier)', C().accent);
              b.drawNode('s3', 500, 335, 'so next fetch reads the NEXT byte in RAM', C().accent);
              b.drawNode('s4', 500, 390, 'PC is the ONLY state carried between cycles', C().wireHi);
              b.drawNode('s5', 500, 430, 'linear march through RAM = what programs \u201cflowing\u201d really is', C().wireHi);
              b.setLabel('No magic between instructions. PC++ + wrap to T0 = \u201cnext instruction.\u201d', C().edgeRise);
            } },

          { text: `And JMP? Same mechanism, zero special handling. A JMP instruction's microcode overwrites PC during its execute phase \u2014 loading the jump target into PC instead of just incrementing it. Then the counter wraps, T0 fires, MAR \u2190 PC \u2014 and the CPU fetches from the new address. T0 doesn't know a jump happened. It just trusts PC. Control flow is nothing more than "control what's in PC."`,
            dur: 16500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('JMP = Overwrite PC, Then Let T0 Do Its Usual Thing', C().edgeRise);
              b.drawNode('a', 500, 250, 'normal instruction: PC++ during fetch', C().accent);
              b.drawNode('b', 500, 290, 'JMP instruction: PC \u2190 target during execute', C().edgeRise);
              b.drawNode('c', 500, 340, 'either way, next cycle\u2019s T0 does MAR \u2190 PC', C().edgeRise);
              b.drawNode('d', 500, 390, 'T0 is unconditional \u2014 it obeys whatever PC holds', C().wireHi);
              b.drawNode('e', 500, 430, 'all control flow (JMP, CALL, RET, interrupts) = writing PC', C().wireHot);
              b.setLabel('\u201cWhere does the CPU go next?\u201d = \u201cwhat\u2019s in PC right now?\u201d  Always. No exceptions.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 5 — THE T-STATE COUNTER
    // ════════════════════════════════════════════════════
    {
      id: 5,
      title: 'The T-State Counter \u2014 The Only Sequential Part',
      pages: [
        { sentences: [
          { text: `OK. Question for you. How does the CU actually KNOW what T-state it's on? The microcode ROM wants the T-state as an input. Something inside the CU has to be keeping track. So what's keeping track?`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('\u201cHow Does The CU Know Which T-State?\u201d', C().accent);
              b.drawBox('cu', 320, 240, 360, 180, 'CONTROL UNIT', C().edgeRise);
              b.drawNode('q', 500, 450, 'something inside has to remember...', C().wireHot);
              b.setLabel('The T-state is one of the CU\u2019s inputs. So the CU must be generating it itself.', C().label);
            } },

          { text: `Here's the thing. T-state isn't combinational. What T-state you're on RIGHT NOW depends on what T-state you were on LAST CYCLE. That's state. That's memory. That's sequential logic.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('T-State Needs Memory \u2014 It\u2019s Sequential', C().accent);
              b.drawNode('now', 500, 280, 'T-state NOW depends on T-state LAST cycle', C().accent);
              b.drawNode('clue', 500, 330, 'state \u2192 memory \u2192 sequential logic', C().edgeRise);
              b.setLabel('Combinational circuits forget their past. For T-state, we need something that REMEMBERS.', C().accent);
            } },

          { text: `And sequential logic, from episode 11 — it needs flip-flops. So there's a little counter sitting inside the CU. Three flip-flops, counting from 0 to 7. Every rising clock edge, it advances by 1. When it hits 7, it wraps back to 0. This is the T-state counter.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The T-State Counter \u2014 3 Flip-Flops', C().edgeRise);
              b.drawBox('cu', 260, 220, 480, 240, 'CONTROL UNIT', C().edgeRise);
              b.drawBox('cnt', 340, 280, 200, 100, 'T-STATE COUNTER\n(3 flip-flops)', C().accent);
              b.drawBox('rom', 560, 280, 140, 100, 'MICROCODE\nROM', C().accent);
              b.drawWire('cnt-rom', [[540, 330],[560, 330]], C().wireHi);
              b.drawNode('clk', 400, 410, 'CLK', C().accent);
              b.setLabel('Three flip-flops. Counts 0, 1, 2, 3, 4, 5, 6, 7, back to 0. That\u2019s it.', C().accent);
            } },

          { text: `And that — one tiny counter — is the ONLY sequential piece of the CU. Everything else is pure combinational: the microcode ROM is just a giant lookup table, which is combinational. The flag-masking logic we'll see next is combinational. Just this one counter needs memory.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One Counter, One Sequential Piece', C().edgeRise);
              b.drawBox('cu', 200, 220, 600, 280, 'CONTROL UNIT', C().edgeRise);
              b.drawBox('cnt', 260, 280, 200, 80, 'T-STATE COUNTER\nsequential', C().edgeRise);
              b.drawBox('rom', 480, 280, 280, 120, 'MICROCODE ROM\n+ flag logic\ncombinational', C().accent);
              b.setLabel('Mostly combinational. One small counter for state. That\u2019s the architecture.', C().edgeRise);
            } },

          { text: `I can hear a question. "What makes the counter wrap back to 0 at the end of an instruction? How does it know when an instruction is over?" Good question.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Good Question \u2014 \u201cWhen Does It Wrap?\u201d', C().accent);
              b.drawNode('q', 500, 300, 'how does the counter know an instruction is done?', C().wireHot);
              b.setLabel('Different CPUs handle this differently. Let me tell you the simple way.', C().label);
            } },

          { text: `Simple answer — it doesn't really. In our SAP-1, the counter just cycles 0 through 7 mechanically. For instructions that only use, say, four T-states, the last four are padded with all-zero microcode — nothing fires, nothing happens. By T7 we're always back at T0, ready for the next instruction. It's wasteful of cycles, but simple.`,
            dur: 16500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Simple Answer \u2014 The Counter Always Cycles 0 \u2192 7', C().accent);
              b.drawCustom('pad', (g, NS, COL) => {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', 500); t.setAttribute('y', 260);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '20');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', COL.accent);
                t.textContent = 'OUT instruction \u2014 uses T0, T1, T2';
                g.appendChild(t);
                const t2 = document.createElementNS(NS, 'text');
                t2.setAttribute('x', 500); t2.setAttribute('y', 310);
                t2.setAttribute('text-anchor', 'middle');
                t2.setAttribute('font-family', 'monospace');
                t2.setAttribute('font-size', '18');
                t2.setAttribute('fill', COL.label);
                t2.textContent = 'T3, T4, T5, T6, T7 \u2014 all zeros, no signals fire';
                g.appendChild(t2);
                const t3 = document.createElementNS(NS, 'text');
                t3.setAttribute('x', 500); t3.setAttribute('y', 360);
                t3.setAttribute('text-anchor', 'middle');
                t3.setAttribute('font-family', 'monospace');
                t3.setAttribute('font-size', '14');
                t3.setAttribute('fill', COL.edgeRise);
                t3.textContent = 'counter reaches T7, wraps to T0, next instruction starts';
                g.appendChild(t3);
              });
              b.setLabel('Simple. A little wasteful. Real CPUs have end-of-instruction logic. SAP-1 doesn\u2019t bother.', C().accent);
            } },

          { text: `Two footnotes about real-world CPUs, worth remembering. FIRST \u2014 most real CPUs add a T_RESET signal. Each opcode's microcode asserts T_RESET on its last real step, telling the counter "we're done, snap back to T0 now." So a 4-step instruction takes 4 cycles, not 8. Ben Eater's breadboard CPU works exactly like this. SAP-1 is the simplified, always-pad version for teaching.`,
            dur: 17500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Real CPUs \u2014 T_RESET Lets Instructions End Early', C().edgeRise);
              b.drawNode('a', 500, 245, 'each opcode\u2019s LAST real step asserts T_RESET', C().edgeRise);
              b.drawNode('b', 500, 285, 'next clock edge \u2192 counter snaps back to T0', C().edgeRise);
              b.drawNode('c', 500, 330, 'short OUT: 3 cycles, not 8 \u2014 no padding', C().accent);
              b.drawNode('d', 500, 370, 'long ADD: 6 cycles, asserts T_RESET at T5', C().accent);
              b.drawNode('e', 500, 420, 'SAP-1: no T_RESET (always runs full counter). Real CPUs: variable.', C().wireHi);
              b.setLabel('T_RESET turns a fixed-length cycle into a variable-length one \u2014 big efficiency win.', C().edgeRise);
            } },

          { text: `SECOND \u2014 some CPUs have counters that run to T15, T31, even T100-plus. That does NOT mean every instruction takes that many steps. The counter's WIDTH is the maximum supported \u2014 the ceiling. Each instruction uses only as many T-states as it actually needs; T_RESET fires when it's done. Like an elevator that CAN reach floor 50 but stops at 3 if you press 3. Wide counters exist so complex instructions \u2014 multiply, divide, x86 string ops \u2014 have room to run their longer microcode.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Wider Counters = A Ceiling, Not A Requirement', C().edgeRise);
              b.drawNode('a', 500, 240, 'counter width = LONGEST instruction supported', C().edgeRise);
              b.drawNode('b', 500, 280, 'each instruction uses only the steps IT needs', C().accent);
              b.drawNode('c', 500, 320, 'ADD: ~4 steps    MUL: ~12 steps    DIV: 20\u201340 steps', C().accent);
              b.drawNode('d', 500, 365, 'x86 REP MOVSB (memcpy): thousands of internal steps', C().wireHi);
              b.drawNode('e', 500, 410, 'elevator analogy \u2014 can reach floor 50, stops at 3 on request', C().wireHi);
              b.drawNode('f', 500, 450, 'modern x86/ARM: no single counter \u2014 instructions become \u03BCops in a pipeline', C().wireHot);
              b.setLabel('Counter width bounds the worst case. T_RESET ends each instruction at the right step.', C().edgeRise);
            } },

          { text: `One more thing that matters for your goal. The six-step constraint is a CHIP DESIGNER's problem, not an assembly programmer's problem. The person writing microcode has to fit each opcode into the counter's steps. You, writing assembly, just write a sequence of instructions and trust that T0/T1 will fetch each one in turn. You never plan around T-states. You never think "after T5 I must do X" \u2014 the fetch handles that automatically. Your mental model is just: instructions in RAM, PC walks through them.`,
            dur: 19000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Who Cares About T-States? Not The Programmer.', C().edgeRise);
              b.drawBox('hw', 90, 260, 400, 170, 'CHIP DESIGNER\nwrites microcode\nmust fit opcode in T-state budget\ncares about counter width, T_RESET', C().edgeRise);
              b.drawBox('sw', 510, 260, 400, 170, 'ASSEMBLY PROGRAMMER\nwrites sequence of instructions\nnever sees T-states\ncares about registers, memory, PC', C().accent);
              b.setLabel('Two layers, two concerns. The fetch loop is invisible to the code you write.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 — CONDITIONAL BRANCHES
    // ════════════════════════════════════════════════════
    {
      id: 6,
      title: 'Conditional Branches \u2014 Flag-Masked Signals',
      pages: [
        { sentences: [
          { text: `Let me show you one more piece. Conditional branches. Instructions like JC — jump if carry — or JZ — jump if zero. These should only actually JUMP when the right flag is set. Otherwise the CPU should just move on to the next instruction. How does the CU handle that?`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Conditional Jumps \u2014 Jump Only Sometimes', C().accent);
              b.drawCustom('ex', (g, NS, COL) => {
                const lines = [
                  ['JC  0x20', 'jump to 0x20 if CF = 1, else skip'],
                  ['JZ  0x30', 'jump to 0x30 if ZF = 1, else skip'],
                  ['JNZ 0x40', 'jump if ZF = 0'],
                  ['JNC 0x50', 'jump if CF = 0'],
                ];
                lines.forEach((row, i) => {
                  const y = 240 + i * 44;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 340); a.setAttribute('y', y);
                  a.setAttribute('text-anchor', 'end');
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '18');
                  a.setAttribute('font-weight', '700');
                  a.setAttribute('fill', COL.edgeRise);
                  a.textContent = row[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 360); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '14');
                  b_.setAttribute('fill', COL.accent);
                  b_.textContent = row[1]; g.appendChild(b_);
                });
              });
              b.setLabel('The CU has to decide \u201csometimes jump, sometimes don\u2019t.\u201d Let\u2019s see how.', C().accent);
            } },

          { text: `You might guess: maybe the ROM has TWO rows for JC. One for when carry is 1, one for when carry is 0. Possible — but clunky. We'd double the ROM size. Every conditional instruction would need duplicate entries. Not elegant.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Option A \u2014 Duplicate ROM Rows?', C().accent);
              b.drawNode('idea', 500, 290, 'one row for \u201cJC when CF=1\u201d', C().accent);
              b.drawNode('idea2', 500, 320, 'another row for \u201cJC when CF=0\u201d', C().accent);
              b.drawNode('prob', 500, 400, 'doubles the ROM, feels wrong', C().wireHot);
              b.setLabel('Possible, but we can do better.', C().label);
            } },

          { text: `Here's the elegant solution. ONE microcode row for JC. It always fires the J signal at T3. But there's a small AND gate between the ROM output and the actual J wire. That AND gate lets J through ONLY when the carry flag is 1. If carry is 0, the gate blocks it. J never reaches the PC. No jump happens.`,
            dur: 18000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Option B \u2014 Mask With An AND Gate', C().edgeRise);
              b.drawBox('rom', 120, 260, 200, 160, 'MICROCODE ROM', C().accent);
              b.drawGate('and', 'AND', 420, 290, 120, 70);
              b.drawNode('j-rom', 340, 310, 'J bit', C().wireHi);
              b.drawNode('cf', 380, 400, 'CF flag', C().edgeRise);
              b.drawWire('wj-rom', [[320, 310],[420, 310]], C().wireHi);
              b.drawWire('wcf',    [[380, 390],[460, 390],[460, 360]], C().edgeRise);
              b.drawWire('wjout',  [[552, 325],[700, 325]], C().edgeRise);
              b.drawNode('out', 740, 325, '\u2192 actual J wire', C().edgeRise);
              b.setLabel('J from ROM enters the AND. CF also enters. Output is (J AND CF). Jump only happens if CF=1.', C().edgeRise);
            } },

          { text: `So for JC — when the instruction runs and CF is 1 — J passes through, PC loads the jump target, jump happens. When CF is 0 — the AND gate blocks J, J never reaches PC, CPU just continues to the next instruction. One AND gate per flag-conditional signal. Clean and cheap.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Two Cases \u2014 CF=1 Jumps, CF=0 Doesn\u2019t', C().edgeRise);
              b.drawCustom('cases', (g, NS, COL) => {
                const rows = [
                  ['CF = 1:', 'J\u00B71 = 1  \u2192  PC loads target  \u2192  JUMP',  COL.edgeRise],
                  ['CF = 0:', 'J\u00B70 = 0  \u2192  gate blocks J       \u2192  no jump', COL.accent],
                ];
                rows.forEach((row, i) => {
                  const y = 280 + i * 60;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 260); a.setAttribute('y', y);
                  a.setAttribute('text-anchor', 'end');
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '20');
                  a.setAttribute('font-weight', '700');
                  a.setAttribute('fill', row[2]);
                  a.textContent = row[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 280); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '16');
                  b_.setAttribute('fill', row[2]);
                  b_.textContent = row[1]; g.appendChild(b_);
                });
              });
              b.setLabel('One AND gate per conditional signal. A tiny bit of combinational logic outside the ROM. Done.', C().edgeRise);
            } },

          { text: `And this is where Boolean algebra earns its keep in the real world. That AND gate wasn't arbitrary — it's a two-input logic function. And some chips have more complex conditions — jump if two flags are in certain states, for example. Those become multi-input Boolean expressions, optimized with K-maps, implemented as tiny combinational circuits hanging off the microcode ROM. Every single line of Boolean algebra in a real CPU, that's where it lives.`,
            dur: 18500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Boolean Algebra Earning Its Keep', C().edgeRise);
              b.drawNode('k1', 500, 270, 'real CPUs have many conditional branches', C().accent);
              b.drawNode('k2', 500, 310, 'each one is a little combinational expression', C().accent);
              b.drawNode('k3', 500, 350, 'simplified via the K-maps you learned last lesson', C().edgeRise);
              b.drawNode('k4', 500, 400, 'this is where Ep 12 pays off in real hardware', C().edgeRise);
              b.setLabel('Not a demo \u2014 this IS how real CPU conditional logic gets designed. Every time.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 7 — MICROCODED VS HARDWIRED
    // ════════════════════════════════════════════════════
    {
      id: 7,
      title: 'Two Philosophies \u2014 Microcoded vs Hardwired',
      pages: [
        { sentences: [
          { text: `One last thing worth knowing. There are actually TWO ways to build a Control Unit. We've been describing one of them — microcoded. But there's another — hardwired. And which one a CPU uses says a lot about what kind of CPU it is.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Two Ways To Build A CU', C().edgeRise);
              b.drawBox('mc', 100, 260, 380, 160, 'MICROCODED\n\nthe CU is a ROM\nfeed (opcode, T-state)\nread out control word', C().edgeRise);
              b.drawBox('hw', 520, 260, 380, 160, 'HARDWIRED\n\nthe CU is gates\ncombinational logic computes\ncontrol signals directly', C().accent);
              b.setLabel('Two philosophies. Different trade-offs. Both in use today.', C().accent);
            } },

          { text: `Microcoded — what we've built. The CU is literally a ROM. Each row has a pre-computed control word. Very flexible — if you want to add a new instruction, you just write a new row. No re-wiring.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Microcoded \u2014 Flexible', C().edgeRise);
              b.drawBox('mc', 280, 240, 440, 180, 'MICROCODED CU\n\nROM lookup\nadd instructions by adding ROM rows\nno hardware changes needed', C().edgeRise);
              b.drawNode('tradeoff', 500, 460, 'flexibility: excellent   \u2022   speed: good, not great', C().accent);
              b.setLabel('Ideal when your instruction set is large, irregular, or might change.', C().accent);
            } },

          { text: `Hardwired — the other way. The CU is built directly from logic gates. Instead of a ROM, it's a giant combinational circuit that takes opcode and T-state as inputs and COMPUTES the control signals via Boolean expressions. No lookup, just gates.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Hardwired \u2014 Fast', C().accent);
              b.drawBox('hw', 280, 240, 440, 180, 'HARDWIRED CU\n\ncombinational logic\ngates compute signals from (op, T)\nno lookup \u2014 just gates', C().accent);
              b.drawNode('tradeoff', 500, 460, 'speed: excellent   \u2022   adding instructions: hard', C().accent);
              b.setLabel('Ideal when your instruction set is small and regular. Faster in silicon.', C().accent);
            } },

          { text: `The trade-off. Microcoded: flexible, easy to change, a bit slower because every signal passes through the ROM. Hardwired: faster because it's just gates, but adding a new instruction means redesigning the logic. There's no free lunch.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Trade-Offs, Side By Side', C().accent);
              b.drawCustom('compare', (g, NS, COL) => {
                const rows = [
                  ['FLEXIBILITY:', 'microcoded wins', 'hardwired needs redesign'],
                  ['SPEED:',       'hardwired wins', 'microcoded has ROM delay'],
                  ['COMPLEXITY:',  'microcoded is simpler to design', 'hardwired needs careful K-map work'],
                ];
                rows.forEach((row, i) => {
                  const y = 260 + i * 50;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 220); a.setAttribute('y', y);
                  a.setAttribute('text-anchor', 'end');
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '14');
                  a.setAttribute('font-weight', '700');
                  a.setAttribute('fill', COL.edgeRise);
                  a.textContent = row[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 240); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '13');
                  b_.setAttribute('fill', COL.accent);
                  b_.textContent = row[1] + '  \u2022  ' + row[2]; g.appendChild(b_);
                });
              });
              b.setLabel('Design choices \u2014 not \u201cone is better,\u201d but \u201cright tool for the job.\u201d', C().accent);
            } },

          { text: `Historically: CISC CPUs — the Intel 8086, the Motorola 68000, x86 — are heavily microcoded. When you have hundreds of instruction variants, microcode is a lifesaver. RISC CPUs — ARM, MIPS, RISC-V — are mostly hardwired. Simpler instruction sets, fewer variants, and they prioritize raw speed.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Historical Picks', C().accent);
              b.drawBox('cisc', 100, 260, 380, 180, 'CISC \u2014 MICROCODED\n\nIntel 8086\nMotorola 68000\nx86 (still uses microcode)', C().edgeRise);
              b.drawBox('risc', 520, 260, 380, 180, 'RISC \u2014 HARDWIRED\n\nARM\nMIPS\nRISC-V', C().accent);
              b.setLabel('x86 chips STILL use microcode internally \u2014 even in 2024. Intel pushes updates over CPU microcode.', C().accent);
            } },

          { text: `And here's a fun fact for you. Your SAP-1 simulator is microcoded. Open the Microcode tab in the app sometime. You can literally EDIT the control-word table and watch instructions behave differently. That's the POWER of microcode, right there in your browser.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Your SAP-1 Is Microcoded \u2014 Try It', C().edgeRise);
              b.drawNode('tip', 500, 290, 'open the Microcode tab in the simulator', C().edgeRise);
              b.drawNode('tip2', 500, 330, 'edit a row \u2014 see the instruction change behaviour', C().accent);
              b.drawNode('tip3', 500, 380, 'this is why microcode is so powerful', C().accent);
              b.setLabel('Reprogrammable CPU \u2014 without rewiring anything. That\u2019s microcode.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 8 — RECAP + END OF SERIES B
    // ════════════════════════════════════════════════════
    {
      id: 8,
      title: 'Recap \u2014 And End Of Series B',
      pages: [
        { sentences: [
          { text: `Alright, class. Let's wrap up. The Control Unit. Three inputs — opcode, T-state, flags. 28 control-signal outputs. Its core is a microcode ROM — a big lookup from (opcode, T-state) to control word. Plus a tiny T-state counter for memory. Plus some AND-gate flag masking for conditional branches. That's the whole CU.`,
            dur: 17000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The CU \u2014 Everything Inside', C().edgeRise);
              b.drawBox('cu', 200, 220, 600, 280, 'CONTROL UNIT', C().edgeRise);
              b.drawBox('cnt', 260, 260, 200, 80, 'T-state counter', C().accent);
              b.drawBox('rom', 480, 260, 280, 120, 'microcode ROM', C().accent);
              b.drawBox('mask',260, 380, 500, 80, 'flag-masking AND gates', C().accent);
              b.setLabel('One counter. One ROM. Some ANDs. That\u2019s the conductor.', C().accent);
            } },

          { text: `Now — I want you to notice something. The CU contains EVERY concept we've covered in this series.`,
            dur: 8000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Every Series B Concept, Inside The CU', C().edgeRise);
              b.drawBox('cu', 260, 220, 480, 280, 'CONTROL UNIT', C().edgeRise);
              b.setLabel('Look at what\u2019s inside \u2014 all twelve previous lessons.', C().label);
            } },

          { text: `The microcode ROM is built from a decoder — episode 5 — and a bunch of ANDs and ORs — combinational logic — episode 11. Those gates were simplified using Boolean algebra and K-maps — episode 12. The T-state counter is a counter — episode 4 — built from flip-flops — episode 2. The opcode comes from the Instruction Register — a register — episode 3. The control signals drive registers, the ALU, RAM — everything from episodes 2 through 10. Every lesson lives here.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Every Series B Lesson \u2014 Shows Up In The CU', C().edgeRise);
              b.drawCustom('callbacks', (g, NS, COL) => {
                const items = [
                  'Episode 1  \u2014 Clock           \u2192 drives everything',
                  'Episode 2  \u2014 Flip-Flop       \u2192 inside the counter',
                  'Episode 3  \u2014 Register        \u2192 IR feeds the opcode',
                  'Episode 4  \u2014 Counter         \u2192 the T-state counter',
                  'Episode 5  \u2014 Decoder         \u2192 inside the ROM',
                  'Episode 6  \u2014 MUX             \u2192 used by conditionals',
                  'Episode 7  \u2014 Comparator      \u2192 flag-gen logic',
                  'Episode 8  \u2014 Adder           \u2192 PC increment',
                  'Episode 9  \u2014 ALU             \u2192 the thing CU drives',
                  'Episode 10 \u2014 RAM             \u2192 the thing CU addresses',
                  'Episode 11 \u2014 Combinational   \u2192 the ROM and flag logic',
                  'Episode 12 \u2014 Boolean/K-maps  \u2192 minimised the logic',
                ];
                items.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 160); t.setAttribute('y', 215 + i * 24);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '12');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('All 12 prior lessons. Inside one block. That\u2019s why the CU is the capstone of Series B.', C().edgeRise);
            } },

          { text: `And with that — class — you've finished Series B. Thirteen lessons. From the clock, to the flip-flop, to the register, to the counter, to the decoder, to the multiplexer, to the comparator, to the adder, to the ALU, to RAM, to combinational logic, to Boolean algebra, and to the Control Unit. You've seen how every building block in a CPU works — from first principles.`,
            dur: 18000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Series B \u2014 Complete', C().edgeRise);
              b.drawCustom('journey', (g, NS, COL) => {
                const steps = [
                  '\u2713 Clock',
                  '\u2713 Flip-Flop',
                  '\u2713 Register',
                  '\u2713 Counter',
                  '\u2713 Decoder',
                  '\u2713 Multiplexer',
                  '\u2713 Comparator',
                  '\u2713 Adder',
                  '\u2713 ALU',
                  '\u2713 RAM',
                  '\u2713 Combinational Logic',
                  '\u2713 Boolean Algebra & K-maps',
                  '\u2713 Control Unit',
                ];
                steps.forEach((s, i) => {
                  const col = i % 3;
                  const row = Math.floor(i / 3);
                  const x = 200 + col * 230;
                  const y = 240 + row * 44;
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', x); t.setAttribute('y', y);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '15');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', COL.edgeRise);
                  t.textContent = s; g.appendChild(t);
                });
              });
              b.setLabel('All thirteen. Well done.', C().edgeRise);
            } },

          { text: `If you've followed along all the way through — you now know, in real, hardware-level detail, how a CPU is built. Not a metaphor. Not an analogy. The actual circuits. From first principles. That's a genuinely valuable thing to have in your head, class. Well done.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('You Now Know How A CPU Is Built', C().edgeRise);
              b.drawNode('m', 500, 290, 'not a metaphor \u2022 not an analogy \u2022 the actual circuits', C().edgeRise);
              b.drawNode('m2', 500, 340, 'from first principles \u2014 bottom up', C().accent);
              b.setLabel('Most people, even most programmers, don\u2019t know this. You do now.', C().edgeRise);
            } },

          { text: `Where do you go from here? Series A — the CPU in operation. How programs actually RUN on the hardware you now understand. Fetch. Decode. Execute. Stacks. Interrupts. Pipelining. Same machine, seen from the software side. Up to you whether you want to keep going. Thanks for being in class. See you somewhere down the road.`,
            dur: 16500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Next \u2014 Series A, If You Want It', C().edgeRise);
              b.drawBox('a', 100, 240, 380, 180, 'SERIES A\n\nCPU architecture\nin operation\n\nfetch \u2022 decode \u2022 execute', C().accent);
              b.drawBox('b', 520, 240, 380, 180, 'SERIES B \u2713 DONE\n\nCPU building blocks\nfrom physics up\n\nyou are here', C().edgeRise);
              b.drawNode('bye', 500, 480, 'end of Series B. See you somewhere down the road.', C().edgeRise);
              b.setLabel('Thanks for being in class.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
      isFinal: true,
    },
  ];

  if (typeof window !== 'undefined') {
    window.BLOCKS_13_SCENES = BLOCKS_13_SCENES;
  }
})();
