/**
 * Series C — Episode 1: The Transistor
 * -------------------------------------
 * Down-to-the-atoms level.  Classroom-voice lesson with physical-intuition
 * animations.  Shows a MOSFET cross-section — source, drain, gate, oxide,
 * substrate — as physical coloured regions, with electrons drawn as moving
 * dots.  When the gate voltage rises, viewers SEE the channel form and
 * electrons start streaming from source to drain.  Silence test: the
 * animation alone should make the physics click.
 *
 * Arc:
 *   1. Welcome + hook      — every CPU is billions of these. what is ONE?
 *   2. The valve analogy   — source, drain, gate — water/electron valve
 *   3. Zoom into silicon   — physical layers named and shown
 *   4. The OFF state       — no voltage, no channel, no current
 *   5. The ON state        — apply voltage, channel forms, current flows
 *   6. The threshold       — not smooth; a switch, not a dial
 *   7. Scale               — one is 20nm. Billions on a die.
 *   8. Recap + tease       — next: two transistors build the inverter
 */

(function () {
  'use strict';

  const B = () => window.Blocks;
  const C = () => window.Blocks && window.Blocks.COL;

  // ═══════════════════════════════════════════════════════════════════
  //  Helper — draw the transistor cross-section stage.
  //  Paints the physical layers AND sets up an electron cloud that can
  //  be driven by an animator.  opts:
  //    gateOn:    boolean — whether gate voltage is high (channel forms)
  //    electrons: number  — how many electrons to spawn (default 60)
  //    thresholdDemo: if true, gateOn is computed from time (ramps)
  // ═══════════════════════════════════════════════════════════════════
  function _drawTransistorStage(b, opts) {
    opts = opts || {};
    const COL = C();

    // ──── Layout (stage 1000 x 620) ────
    const stageW = 1000;
    const subY = 380, subH = 160;       // silicon substrate rect
    const subX = 120, subW = 760;
    const srcX = subX + 20,  srcW = 150, srcY = subY - 4, srcH = 100;
    const drnX = subX + subW - 170, drnW = 150, drnY = subY - 4, drnH = 100;
    const gateX = srcX + srcW + 20, gateW = drnX - (srcX + srcW) - 40;
    const oxideY = subY - 8, oxideH = 6;
    const gateY  = oxideY - 40, gateH = 34;
    // Channel region (inside substrate, right below oxide)
    const channelX = gateX, channelW = gateW;
    const channelY = subY + 2, channelH = 12;
    // Terminal wire endpoints (for labels)
    const srcTermX = srcX + srcW / 2, srcTermY = srcY + srcH + 30;
    const drnTermX = drnX + drnW / 2, drnTermY = drnY + drnH + 30;
    const gateTermX = gateX + gateW / 2, gateTermY = gateY - 30;

    // Refs the animator will mutate
    const refs = {
      gateRect: null,
      gateGlow: null,
      channelRect: null,
      channelOn: false,       // set by animator each frame
      voltageIndicator: null,
      sourceElectrons: [],    // { el, x, y, vx, vy, state, bornMs, originY }
      flowElectrons: [],      // electrons flowing through channel
      drainElectrons: [],     // electrons accumulated in drain
      phaseLabel: null,
    };

    b.drawCustom('transistor-stage', (g, NS, C2) => {
      // ──────── SUBSTRATE (silicon base) ────────
      const sub = document.createElementNS(NS, 'rect');
      sub.setAttribute('x', subX); sub.setAttribute('y', subY);
      sub.setAttribute('width', subW); sub.setAttribute('height', subH);
      sub.setAttribute('fill', '#2a2530');       // silicon grey/purple
      sub.setAttribute('stroke', '#4a4050');
      sub.setAttribute('stroke-width', '1.2');
      g.appendChild(sub);
      // Faint label "SILICON SUBSTRATE" inside the substrate
      const sLbl = document.createElementNS(NS, 'text');
      sLbl.setAttribute('x', subX + subW / 2);
      sLbl.setAttribute('y', subY + subH - 14);
      sLbl.setAttribute('text-anchor', 'middle');
      sLbl.setAttribute('font-family', 'monospace');
      sLbl.setAttribute('font-size', '11');
      sLbl.setAttribute('font-style', 'italic');
      sLbl.setAttribute('fill', '#6a5a70');
      sLbl.textContent = 'silicon substrate';
      g.appendChild(sLbl);

      // ──────── SOURCE REGION (doped silicon on left) ────────
      const src = document.createElementNS(NS, 'rect');
      src.setAttribute('x', srcX); src.setAttribute('y', srcY);
      src.setAttribute('width', srcW); src.setAttribute('height', srcH);
      src.setAttribute('fill', '#1a2a4a');
      src.setAttribute('stroke', '#2a4a7a');
      src.setAttribute('stroke-width', '1.5');
      g.appendChild(src);
      const srcLbl = document.createElementNS(NS, 'text');
      srcLbl.setAttribute('x', srcX + srcW / 2);
      srcLbl.setAttribute('y', srcY - 8);
      srcLbl.setAttribute('text-anchor', 'middle');
      srcLbl.setAttribute('font-family', 'monospace');
      srcLbl.setAttribute('font-size', '12');
      srcLbl.setAttribute('font-weight', '700');
      srcLbl.setAttribute('fill', C2.accent);
      srcLbl.textContent = 'SOURCE';
      g.appendChild(srcLbl);

      // ──────── DRAIN REGION (doped silicon on right) ────────
      const drn = document.createElementNS(NS, 'rect');
      drn.setAttribute('x', drnX); drn.setAttribute('y', drnY);
      drn.setAttribute('width', drnW); drn.setAttribute('height', drnH);
      drn.setAttribute('fill', '#1a2a4a');
      drn.setAttribute('stroke', '#2a4a7a');
      drn.setAttribute('stroke-width', '1.5');
      g.appendChild(drn);
      const drnLbl = document.createElementNS(NS, 'text');
      drnLbl.setAttribute('x', drnX + drnW / 2);
      drnLbl.setAttribute('y', drnY - 8);
      drnLbl.setAttribute('text-anchor', 'middle');
      drnLbl.setAttribute('font-family', 'monospace');
      drnLbl.setAttribute('font-size', '12');
      drnLbl.setAttribute('font-weight', '700');
      drnLbl.setAttribute('fill', C2.accent);
      drnLbl.textContent = 'DRAIN';
      g.appendChild(drnLbl);

      // ──────── OXIDE LAYER (thin insulator between silicon and gate) ────────
      const ox = document.createElementNS(NS, 'rect');
      ox.setAttribute('x', gateX - 10); ox.setAttribute('y', oxideY);
      ox.setAttribute('width', gateW + 20); ox.setAttribute('height', oxideH);
      ox.setAttribute('fill', '#dd9922');   // oxide — orange/gold tint
      ox.setAttribute('stroke', '#aa7711');
      ox.setAttribute('stroke-width', '1');
      g.appendChild(ox);
      const oxLbl = document.createElementNS(NS, 'text');
      oxLbl.setAttribute('x', gateX + gateW + 30);
      oxLbl.setAttribute('y', oxideY + oxideH / 2 + 4);
      oxLbl.setAttribute('font-family', 'monospace');
      oxLbl.setAttribute('font-size', '10');
      oxLbl.setAttribute('font-style', 'italic');
      oxLbl.setAttribute('fill', '#aa7711');
      oxLbl.textContent = '\u2190 oxide (insulator)';
      g.appendChild(oxLbl);

      // ──────── CHANNEL (appears when gate is on) ────────
      const ch = document.createElementNS(NS, 'rect');
      ch.setAttribute('x', channelX); ch.setAttribute('y', channelY);
      ch.setAttribute('width', channelW); ch.setAttribute('height', channelH);
      ch.setAttribute('fill', '#33aaff');
      ch.setAttribute('opacity', '0');  // hidden initially
      g.appendChild(ch);
      refs.channelRect = ch;

      // ──────── GATE (metal strip on top) ────────
      const gateGlow = document.createElementNS(NS, 'rect');
      gateGlow.setAttribute('x', gateX - 4); gateGlow.setAttribute('y', gateY - 4);
      gateGlow.setAttribute('width', gateW + 8); gateGlow.setAttribute('height', gateH + 8);
      gateGlow.setAttribute('rx', '5');
      gateGlow.setAttribute('fill', '#ffcc00');
      gateGlow.setAttribute('opacity', '0');
      g.appendChild(gateGlow);
      refs.gateGlow = gateGlow;
      const gate = document.createElementNS(NS, 'rect');
      gate.setAttribute('x', gateX); gate.setAttribute('y', gateY);
      gate.setAttribute('width', gateW); gate.setAttribute('height', gateH);
      gate.setAttribute('rx', '3');
      gate.setAttribute('fill', '#777');   // metal grey
      gate.setAttribute('stroke', '#999');
      gate.setAttribute('stroke-width', '1.5');
      g.appendChild(gate);
      refs.gateRect = gate;
      const gLbl = document.createElementNS(NS, 'text');
      gLbl.setAttribute('x', gateX + gateW / 2);
      gLbl.setAttribute('y', gateY + gateH / 2 + 4);
      gLbl.setAttribute('text-anchor', 'middle');
      gLbl.setAttribute('font-family', 'monospace');
      gLbl.setAttribute('font-size', '13');
      gLbl.setAttribute('font-weight', '700');
      gLbl.setAttribute('fill', '#fff');
      gLbl.textContent = 'GATE';
      g.appendChild(gLbl);

      // ──────── TERMINAL WIRES (showing voltage sources) ────────
      // Source to GND
      const wSrc = document.createElementNS(NS, 'line');
      wSrc.setAttribute('x1', srcTermX); wSrc.setAttribute('x2', srcTermX);
      wSrc.setAttribute('y1', srcY + srcH); wSrc.setAttribute('y2', srcTermY + 20);
      wSrc.setAttribute('stroke', '#888'); wSrc.setAttribute('stroke-width', '2');
      g.appendChild(wSrc);
      const srcGndLbl = document.createElementNS(NS, 'text');
      srcGndLbl.setAttribute('x', srcTermX);
      srcGndLbl.setAttribute('y', srcTermY + 35);
      srcGndLbl.setAttribute('text-anchor', 'middle');
      srcGndLbl.setAttribute('font-family', 'monospace');
      srcGndLbl.setAttribute('font-size', '11');
      srcGndLbl.setAttribute('fill', '#888');
      srcGndLbl.textContent = '0 V (GND)';
      g.appendChild(srcGndLbl);

      // Drain to VDD
      const wDrn = document.createElementNS(NS, 'line');
      wDrn.setAttribute('x1', drnTermX); wDrn.setAttribute('x2', drnTermX);
      wDrn.setAttribute('y1', drnY + drnH); wDrn.setAttribute('y2', drnTermY + 20);
      wDrn.setAttribute('stroke', '#888'); wDrn.setAttribute('stroke-width', '2');
      g.appendChild(wDrn);
      const drnVddLbl = document.createElementNS(NS, 'text');
      drnVddLbl.setAttribute('x', drnTermX);
      drnVddLbl.setAttribute('y', drnTermY + 35);
      drnVddLbl.setAttribute('text-anchor', 'middle');
      drnVddLbl.setAttribute('font-family', 'monospace');
      drnVddLbl.setAttribute('font-size', '11');
      drnVddLbl.setAttribute('fill', '#888');
      drnVddLbl.textContent = '+V (supply)';
      g.appendChild(drnVddLbl);

      // Gate terminal
      const wGate = document.createElementNS(NS, 'line');
      wGate.setAttribute('x1', gateTermX); wGate.setAttribute('x2', gateTermX);
      wGate.setAttribute('y1', gateY); wGate.setAttribute('y2', gateTermY);
      wGate.setAttribute('stroke', '#888'); wGate.setAttribute('stroke-width', '2');
      g.appendChild(wGate);
      const vInd = document.createElementNS(NS, 'text');
      vInd.setAttribute('x', gateTermX);
      vInd.setAttribute('y', gateTermY - 8);
      vInd.setAttribute('text-anchor', 'middle');
      vInd.setAttribute('font-family', 'monospace');
      vInd.setAttribute('font-size', '14');
      vInd.setAttribute('font-weight', '700');
      vInd.setAttribute('fill', '#888');
      vInd.textContent = 'Vg = 0 V';
      g.appendChild(vInd);
      refs.voltageIndicator = vInd;

      // ──────── ELECTRONS (many blue dots) ────────
      // Populate source region with electrons.  Each electron keeps its own
      // element reference so the animator can update positions each frame.
      const nElectrons = opts.electrons || 45;
      for (let i = 0; i < nElectrons; i++) {
        const ex = srcX + 6 + Math.random() * (srcW - 12);
        const ey = srcY + 6 + Math.random() * (srcH - 12);
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', ex); c.setAttribute('cy', ey);
        c.setAttribute('r', 3);
        c.setAttribute('fill', '#33aaff');
        c.setAttribute('opacity', '0.9');
        g.appendChild(c);
        refs.sourceElectrons.push({
          el: c, x: ex, y: ey,
          vx: 0, vy: 0,
          state: 'source',
          originY: ey,
        });
      }

      // Small tag for current flow indicator
      const flowTag = document.createElementNS(NS, 'text');
      flowTag.setAttribute('x', stageW / 2);
      flowTag.setAttribute('y', subY + subH + 70);
      flowTag.setAttribute('text-anchor', 'middle');
      flowTag.setAttribute('font-family', 'monospace');
      flowTag.setAttribute('font-size', '16');
      flowTag.setAttribute('font-weight', '700');
      flowTag.setAttribute('fill', C2.edgeRise);
      flowTag.setAttribute('opacity', '0');
      flowTag.textContent = 'current flowing  source \u2192 drain';
      g.appendChild(flowTag);
      refs.flowTag = flowTag;

      // Phase label at bottom
      const pLbl = document.createElementNS(NS, 'text');
      pLbl.setAttribute('x', stageW / 2);
      pLbl.setAttribute('y', 580);
      pLbl.setAttribute('text-anchor', 'middle');
      pLbl.setAttribute('font-family', 'monospace');
      pLbl.setAttribute('font-size', '14');
      pLbl.setAttribute('font-weight', '700');
      pLbl.setAttribute('fill', C2.edgeRise);
      pLbl.setAttribute('opacity', '0.9');
      pLbl.textContent = opts.caption || '';
      g.appendChild(pLbl);
      refs.phaseLabel = pLbl;
    });

    // ══════════════════════════════════════════════════════════════
    //  ANIMATOR
    // ══════════════════════════════════════════════════════════════
    b.animate('transistor-stage', (tMs) => {
      // Determine gate state for this frame.
      let gateVolts = 0;
      if (opts.thresholdDemo) {
        // Ramp gate voltage from 0V to 1V over ~8 seconds, cycling.
        const cycleMs = 10000;
        const phase = (tMs % cycleMs) / cycleMs;
        gateVolts = phase * 1.0;
      } else {
        gateVolts = opts.gateOn ? 1.0 : 0.0;
      }
      const threshold = 0.4;
      const channelActive = gateVolts >= threshold;

      // Update gate visuals
      if (gateVolts > 0) {
        const intensity = Math.min(1, gateVolts);
        refs.gateRect.setAttribute('fill', '#ffcc00');
        refs.gateGlow.setAttribute('opacity', (0.3 * intensity).toFixed(2));
        refs.voltageIndicator.textContent = 'Vg = ' + gateVolts.toFixed(2) + ' V';
        refs.voltageIndicator.setAttribute('fill',
          channelActive ? '#ffcc00' : '#888');
      } else {
        refs.gateRect.setAttribute('fill', '#777');
        refs.gateGlow.setAttribute('opacity', '0');
        refs.voltageIndicator.textContent = 'Vg = 0 V';
        refs.voltageIndicator.setAttribute('fill', '#888');
      }

      // Update channel visibility
      const chOpacity = channelActive ? Math.min(1, (gateVolts - threshold) / 0.3) : 0;
      refs.channelRect.setAttribute('opacity', (chOpacity * 0.75).toFixed(2));

      // Update flow tag
      refs.flowTag.setAttribute('opacity', channelActive ? '0.9' : '0');

      // Update electrons
      refs.sourceElectrons.forEach(e => {
        // Thermal jitter — small random motion for all electrons
        const jitter = 0.5;
        e.x += (Math.random() - 0.5) * jitter * 2;
        e.y += (Math.random() - 0.5) * jitter * 2;

        if (e.state === 'source') {
          // Keep within source region
          if (e.x < srcX + 4) e.x = srcX + 4;
          if (e.x > srcX + srcW - 4) e.x = srcX + srcW - 4;
          if (e.y < srcY + 4) e.y = srcY + 4;
          if (e.y > srcY + srcH - 4) e.y = srcY + srcH - 4;

          // If channel is active and electron is near the top of source,
          // promote it to 'channel' state (with some probability per frame).
          if (channelActive && e.y < srcY + 18 && e.x > srcX + srcW * 0.7) {
            if (Math.random() < 0.05) {
              e.state = 'channel';
              e.x = srcX + srcW - 2;
              e.y = channelY + 5 + Math.random() * 4;
              e.vx = 1.0 + Math.random() * 0.8;
              e.vy = 0;
            }
          }
        }
        else if (e.state === 'channel') {
          // Drift right through the channel
          e.x += e.vx;
          e.y += (Math.random() - 0.5) * 1.5; // thermal wobble
          // Constrain to channel y-range
          if (e.y < channelY) e.y = channelY;
          if (e.y > channelY + channelH) e.y = channelY + channelH;
          // Reached drain — enter drain state
          if (e.x > drnX) {
            e.state = 'drain';
            e.vx = 0;
          }
          // If channel suddenly turns off, electron freezes/fades.
          if (!channelActive) {
            if (Math.random() < 0.1) {
              e.state = 'source';
              e.x = srcX + 20 + Math.random() * (srcW - 40);
              e.y = srcY + 20 + Math.random() * (srcH - 40);
            }
          }
        }
        else if (e.state === 'drain') {
          // Settle into drain region
          if (e.x < drnX + 4) e.x = drnX + 4;
          if (e.x > drnX + drnW - 4) e.x = drnX + drnW - 4;
          if (e.y < drnY + 4) e.y = drnY + 4;
          if (e.y > drnY + drnH - 4) e.y = drnY + drnH - 4;
        }

        e.el.setAttribute('cx', e.x);
        e.el.setAttribute('cy', e.y);
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SCENES
  // ═══════════════════════════════════════════════════════════════════
  const ATOMS_01_SCENES = [

    // ════════════════════════════════════════════════════
    // SCENE 1 — WELCOME + HOOK
    // ════════════════════════════════════════════════════
    {
      id: 1,
      title: 'Welcome To Series C \u2014 Down To The Atoms',
      pages: [
        { sentences: [
          { text: `Alright, class. Welcome to Series C. We've been building top-down all this time — starting from CPUs, working down to gates. Today we go ONE STEP DEEPER. Below the gates. Into the physical silicon.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Series C \u2014 Down To The Atoms', C().edgeRise);
              b.setLabel('Below the gates. Below the schematics. Into physical silicon.', C().accent);
            } },

          { text: `Here's something you might not have fully appreciated yet. Every one of those AND gates, OR gates, flip-flops, and registers we've drawn — they are not made of logic. Logic is just an abstraction. What they're really made of is this one thing: a transistor.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Below Logic \u2014 There Is Only The Transistor', C().edgeRise);
              b.drawBox('t', 380, 260, 240, 180, 'TRANSISTOR\n\nthe thing underneath\nall logic', C().edgeRise);
              b.setLabel('Every gate, every register, every chip \u2014 billions of these, underneath.', C().accent);
            } },

          { text: `A modern CPU contains about 20 billion transistors. Some of the biggest AI chips have over 100 billion. Each one microscopic. Each one doing one simple job — being a switch. Today, let's zoom in to just one of them and see what it physically is.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('~20,000,000,000 Transistors In Your Phone', C().edgeRise);
              b.drawCustom('scale', (g, NS, COL) => {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', 500); t.setAttribute('y', 320);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '36');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', COL.edgeRise);
                t.textContent = '20,000,000,000';
                g.appendChild(t);
                const s = document.createElementNS(NS, 'text');
                s.setAttribute('x', 500); s.setAttribute('y', 370);
                s.setAttribute('text-anchor', 'middle');
                s.setAttribute('font-family', 'monospace');
                s.setAttribute('font-size', '14');
                s.setAttribute('fill', COL.accent);
                s.textContent = 'tiny switches, each doing one job, on a chip smaller than your thumbnail';
                g.appendChild(s);
              });
              b.setLabel('Today, we zoom in until we can see just ONE of them. And we watch it work.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 2 — VALVE ANALOGY
    // ════════════════════════════════════════════════════
    {
      id: 2,
      title: 'The Valve Analogy',
      pages: [
        { sentences: [
          { text: `Before we look at the physics, let me give you an analogy. A transistor is a valve. Just like a water valve. I want you to hold that picture in your head as we go.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A Transistor Is A Valve', C().accent);
              b.drawCustom('valve', (g, NS, COL) => {
                // Simple water valve drawing
                const xLeft = 200, xRight = 800, yMid = 340;
                // Left pipe
                const p1 = document.createElementNS(NS, 'rect');
                p1.setAttribute('x', xLeft); p1.setAttribute('y', yMid - 16);
                p1.setAttribute('width', 240); p1.setAttribute('height', 32);
                p1.setAttribute('fill', '#334'); p1.setAttribute('stroke', '#556');
                g.appendChild(p1);
                // Valve body
                const v = document.createElementNS(NS, 'rect');
                v.setAttribute('x', 440); v.setAttribute('y', yMid - 26);
                v.setAttribute('width', 120); v.setAttribute('height', 52);
                v.setAttribute('fill', '#445'); v.setAttribute('stroke', '#667');
                v.setAttribute('stroke-width', '2');
                g.appendChild(v);
                // Handle
                const h = document.createElementNS(NS, 'rect');
                h.setAttribute('x', 490); h.setAttribute('y', yMid - 80);
                h.setAttribute('width', 20); h.setAttribute('height', 54);
                h.setAttribute('fill', '#a88'); g.appendChild(h);
                const hk = document.createElementNS(NS, 'rect');
                hk.setAttribute('x', 470); hk.setAttribute('y', yMid - 90);
                hk.setAttribute('width', 60); hk.setAttribute('height', 16);
                hk.setAttribute('fill', '#c99'); g.appendChild(hk);
                // Right pipe
                const p2 = document.createElementNS(NS, 'rect');
                p2.setAttribute('x', 560); p2.setAttribute('y', yMid - 16);
                p2.setAttribute('width', 240); p2.setAttribute('height', 32);
                p2.setAttribute('fill', '#334'); p2.setAttribute('stroke', '#556');
                g.appendChild(p2);
                // Labels
                const ll = document.createElementNS(NS, 'text');
                ll.setAttribute('x', 320); ll.setAttribute('y', yMid + 60);
                ll.setAttribute('text-anchor', 'middle');
                ll.setAttribute('font-family', 'monospace');
                ll.setAttribute('font-size', '14');
                ll.setAttribute('fill', COL.accent);
                ll.textContent = 'water from source';
                g.appendChild(ll);
                const lr = document.createElementNS(NS, 'text');
                lr.setAttribute('x', 680); lr.setAttribute('y', yMid + 60);
                lr.setAttribute('text-anchor', 'middle');
                lr.setAttribute('font-family', 'monospace');
                lr.setAttribute('font-size', '14');
                lr.setAttribute('fill', COL.accent);
                lr.textContent = '\u2192 to drain';
                g.appendChild(lr);
                const lh = document.createElementNS(NS, 'text');
                lh.setAttribute('x', 500); lh.setAttribute('y', yMid - 100);
                lh.setAttribute('text-anchor', 'middle');
                lh.setAttribute('font-family', 'monospace');
                lh.setAttribute('font-size', '14');
                lh.setAttribute('fill', COL.edgeRise);
                lh.textContent = 'handle controls flow';
                g.appendChild(lh);
              });
              b.setLabel('Familiar picture. Water in. Valve. Water out. Turn the handle \u2014 control the flow.', C().accent);
            } },

          { text: `Picture the pipe. Water wants to flow from the source on the left to the drain on the right. A valve sits in the middle. Turn the handle, and the valve opens — water flows through. Release the handle, it closes — water stops. The handle CONTROLS the flow. You and I have all used a valve.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Handle Controls The Flow', C().accent);
              b.drawCustom('v2', (g, NS, COL) => {
                const yMid = 340;
                // Same valve picture. Maybe with flow arrows when open.
                const p1 = document.createElementNS(NS, 'rect');
                p1.setAttribute('x', 200); p1.setAttribute('y', yMid - 16);
                p1.setAttribute('width', 240); p1.setAttribute('height', 32);
                p1.setAttribute('fill', '#334'); p1.setAttribute('stroke', '#556');
                g.appendChild(p1);
                const v = document.createElementNS(NS, 'rect');
                v.setAttribute('x', 440); v.setAttribute('y', yMid - 26);
                v.setAttribute('width', 120); v.setAttribute('height', 52);
                v.setAttribute('fill', '#445'); g.appendChild(v);
                const p2 = document.createElementNS(NS, 'rect');
                p2.setAttribute('x', 560); p2.setAttribute('y', yMid - 16);
                p2.setAttribute('width', 240); p2.setAttribute('height', 32);
                p2.setAttribute('fill', '#334'); g.appendChild(p2);
                // Arrow for flow
                const a = document.createElementNS(NS, 'text');
                a.setAttribute('x', 500); a.setAttribute('y', yMid + 7);
                a.setAttribute('text-anchor', 'middle');
                a.setAttribute('font-family', 'monospace');
                a.setAttribute('font-size', '24');
                a.setAttribute('fill', '#55aaff');
                a.textContent = '\u2192 \u2192 \u2192';
                g.appendChild(a);
              });
              b.setLabel('Handle up = open. Water flows through. That\u2019s all there is to a valve.', C().accent);
            } },

          { text: `A transistor is THE SAME THING — but for electrons instead of water. There's a source where electrons come from. A drain where they go to. And a valve — the gate — in the middle. Apply a voltage to the gate, electrons can flow. Remove the voltage, flow stops.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Transistor \u2014 Same Idea, But For Electrons', C().edgeRise);
              b.drawCustom('t2', (g, NS, COL) => {
                const yMid = 340;
                // Source box
                const s = document.createElementNS(NS, 'rect');
                s.setAttribute('x', 200); s.setAttribute('y', yMid - 40);
                s.setAttribute('width', 180); s.setAttribute('height', 80);
                s.setAttribute('fill', '#1a2a4a');
                s.setAttribute('stroke', '#2a4a7a'); s.setAttribute('stroke-width', '2');
                g.appendChild(s);
                const sl = document.createElementNS(NS, 'text');
                sl.setAttribute('x', 290); sl.setAttribute('y', yMid + 4);
                sl.setAttribute('text-anchor', 'middle');
                sl.setAttribute('font-family', 'monospace');
                sl.setAttribute('font-size', '14');
                sl.setAttribute('font-weight', '700');
                sl.setAttribute('fill', '#55aaff');
                sl.textContent = 'SOURCE (electrons)';
                g.appendChild(sl);
                // Drain box
                const d = document.createElementNS(NS, 'rect');
                d.setAttribute('x', 620); d.setAttribute('y', yMid - 40);
                d.setAttribute('width', 180); d.setAttribute('height', 80);
                d.setAttribute('fill', '#1a2a4a');
                d.setAttribute('stroke', '#2a4a7a'); d.setAttribute('stroke-width', '2');
                g.appendChild(d);
                const dl = document.createElementNS(NS, 'text');
                dl.setAttribute('x', 710); dl.setAttribute('y', yMid + 4);
                dl.setAttribute('text-anchor', 'middle');
                dl.setAttribute('font-family', 'monospace');
                dl.setAttribute('font-size', '14');
                dl.setAttribute('font-weight', '700');
                dl.setAttribute('fill', '#55aaff');
                dl.textContent = 'DRAIN';
                g.appendChild(dl);
                // Gate on top (the valve)
                const gate = document.createElementNS(NS, 'rect');
                gate.setAttribute('x', 440); gate.setAttribute('y', yMid - 70);
                gate.setAttribute('width', 120); gate.setAttribute('height', 36);
                gate.setAttribute('rx', '3');
                gate.setAttribute('fill', '#ffcc00');
                gate.setAttribute('stroke', '#aa9500'); gate.setAttribute('stroke-width', '2');
                g.appendChild(gate);
                const gl = document.createElementNS(NS, 'text');
                gl.setAttribute('x', 500); gl.setAttribute('y', yMid - 46);
                gl.setAttribute('text-anchor', 'middle');
                gl.setAttribute('font-family', 'monospace');
                gl.setAttribute('font-size', '14');
                gl.setAttribute('font-weight', '700');
                gl.setAttribute('fill', '#000');
                gl.textContent = 'GATE';
                g.appendChild(gl);
                // Gap between source and drain (visual metaphor: no connection yet)
                // Arrow indicating flow when gate is on
                const arr = document.createElementNS(NS, 'text');
                arr.setAttribute('x', 500); arr.setAttribute('y', yMid + 4);
                arr.setAttribute('text-anchor', 'middle');
                arr.setAttribute('font-family', 'monospace');
                arr.setAttribute('font-size', '20');
                arr.setAttribute('fill', '#55aaff');
                arr.textContent = '\u2192 \u2192 \u2192';
                g.appendChild(arr);
              });
              b.setLabel('Source, Gate, Drain \u2014 same three parts as the valve. Just for electrons instead of water.', C().edgeRise);
            } },

          { text: `Three terminals, three names. Source — where electrons come from. Drain — where they go to. Gate — the valve in the middle. These three names matter, so let me say them again. Source. Drain. Gate. Now let's zoom in and actually SEE this happening.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Three Names To Remember', C().edgeRise);
              b.drawCustom('names', (g, NS, COL) => {
                const items = [
                  ['SOURCE', 'where electrons come from'],
                  ['DRAIN',  'where electrons go to'],
                  ['GATE',   'the valve that controls flow'],
                ];
                items.forEach((row, i) => {
                  const y = 260 + i * 70;
                  const n = document.createElementNS(NS, 'text');
                  n.setAttribute('x', 360); n.setAttribute('y', y);
                  n.setAttribute('text-anchor', 'end');
                  n.setAttribute('font-family', 'monospace');
                  n.setAttribute('font-size', '24');
                  n.setAttribute('font-weight', '700');
                  n.setAttribute('fill', COL.edgeRise);
                  n.textContent = row[0]; g.appendChild(n);
                  const d = document.createElementNS(NS, 'text');
                  d.setAttribute('x', 390); d.setAttribute('y', y);
                  d.setAttribute('font-family', 'monospace');
                  d.setAttribute('font-size', '16');
                  d.setAttribute('fill', COL.accent);
                  d.textContent = row[1]; g.appendChild(d);
                });
              });
              b.setLabel('Source \u2022 Drain \u2022 Gate. Say them out loud. We\u2019re about to watch them in action.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 3 — ZOOM INTO SILICON
    // ════════════════════════════════════════════════════
    {
      id: 3,
      title: 'Zoom Into The Silicon',
      pages: [
        { sentences: [
          { text: `Here's what a transistor actually looks like — a side-on slice through one. I've stripped away most of the complexity so we can see the essentials. Five parts. Let me name each one as I point to it.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A Transistor \u2014 Cross-Section View', C().edgeRise);
              _drawTransistorStage(b, { gateOn: false, caption: 'five physical parts, five names, take a moment to look' });
              b.setLabel('This is not a schematic. This is what the actual silicon looks like from the side.', C().accent);
            } },

          { text: `At the bottom — the substrate. Pure silicon. The same crystal material as sand and glass. On its own, silicon barely conducts electricity. It's a very weak conductor — essentially a barrier. Keep that in mind — it matters in a moment.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Substrate \u2014 Plain Silicon', C().accent);
              _drawTransistorStage(b, { gateOn: false, caption: 'plain silicon \u2014 a barrier by default' });
              b.setLabel('Silicon blocks electron flow unless we do something special to it.', C().accent);
            } },

          { text: `On the left — the source. And on the right — the drain. These are both the same thing: regions of silicon that have been specially treated — called doping — to hold lots of free electrons. Those blue dots you see inside them? Electrons. Ready to move.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Source And Drain \u2014 Full Of Electrons', C().accent);
              _drawTransistorStage(b, { gateOn: false, caption: 'blue dots = free electrons, ready to move' });
              b.setLabel('Two \u201creservoirs\u201d \u2014 each holding lots of electrons. The electrons can\u2019t reach each other yet.', C().accent);
            } },

          { text: `On top, sitting above the silicon — the gate. A piece of metal. And between the gate and the silicon, there's a very thin layer of an insulator called the oxide. You can see it as that thin orange strip. Pay attention to this part: the gate cannot directly touch the silicon. The oxide keeps them apart.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Gate + Oxide \u2014 The Valve Structure', C().accent);
              _drawTransistorStage(b, { gateOn: false, caption: 'gate sits above the oxide \u2014 which blocks direct contact' });
              b.setLabel('Gate and silicon never touch. The gate works through an ELECTRIC FIELD, not direct contact.', C().accent);
            } },

          { text: `Now here's a question a careful student might ask. "If the gate is insulated from the silicon, how does it DO anything? It can't pass current through. So what does it even do?" That's exactly the question we're about to answer. Let's see.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('"If The Gate Doesn\u2019t Touch \u2014 How Does It Work?"', C().accent);
              _drawTransistorStage(b, { gateOn: false, caption: 'let\u2019s find out' });
              b.setLabel('The answer is one of the most elegant things in physics. We\u2019re about to see it.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 4 — THE OFF STATE
    // ════════════════════════════════════════════════════
    {
      id: 4,
      title: 'The OFF State',
      pages: [
        { sentences: [
          { text: `Let's look at the transistor with no voltage on the gate. This is its resting state. I want you to just watch the dots for a moment.`,
            dur: 8500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('OFF State \u2014 No Voltage On Gate', C().accent);
              _drawTransistorStage(b, { gateOn: false, caption: 'gate = 0V  \u2022  watch the electrons' });
              b.setLabel('Watch the dots in the source. What are they doing? Also \u2014 are any reaching the drain?', C().accent);
            } },

          { text: `Here's what you're seeing. The source is full of electrons. They're jiggling around — that's just thermal motion, heat. They wiggle, but they don't GO anywhere. They stay in the source. And over on the drain? Almost empty. No electrons are arriving. Why?`,
            dur: 16500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Source Jiggles \u2022 Drain Empty \u2022 No Flow', C().accent);
              _drawTransistorStage(b, { gateOn: false, caption: 'electrons can\u2019t cross the silicon barrier' });
              b.setLabel('Nothing is flowing. The electrons sit there. Why? What\u2019s stopping them?', C().accent);
            } },

          { text: `Because between source and drain, there's just plain silicon. And remember what we said — pure silicon doesn't have free electrons. It's essentially a wall. The source's electrons cannot cross that wall to reach the drain. The gate is there, sitting on top, but it's not doing anything — there's no voltage on it.`,
            dur: 16500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Pure Silicon = A Wall', C().accent);
              _drawTransistorStage(b, { gateOn: false, caption: 'plain silicon below the gate \u2014 no path for electrons' });
              b.setLabel('Source reservoir. Drain reservoir. Silicon wall in between. No bridge \u2014 no current.', C().accent);
            } },

          { text: `This is the OFF state. Gate voltage is zero. Current between source and drain is zero. In digital terms, we call this a logical zero. A '0'. Now let's turn it on.`,
            dur: 10000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('OFF State = Logical 0', C().accent);
              _drawTransistorStage(b, { gateOn: false, caption: 'OFF  \u2022  current = 0  \u2022  logical 0' });
              b.setLabel('Memorise this image. Next we\u2019ll apply voltage and watch the transistor wake up.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 5 — THE ON STATE
    // ════════════════════════════════════════════════════
    {
      id: 5,
      title: 'Apply Voltage \u2014 Watch The Channel Form',
      pages: [
        { sentences: [
          { text: `Now I'm going to apply a positive voltage to the gate. Watch what happens. I want you to focus on the silicon just below the gate's oxide layer. Something is about to happen there.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Apply Gate Voltage \u2014 Watch Below The Oxide', C().edgeRise);
              _drawTransistorStage(b, { gateOn: true, caption: 'gate = +V  \u2022  watch below the oxide' });
              b.setLabel('Gate turns yellow \u2014 voltage applied. Electrons start moving. Keep watching.', C().edgeRise);
            } },

          { text: `Look at the silicon just under the oxide. A thin blue layer has appeared — a CHANNEL. The positive charge on the gate is reaching down through the insulator and pulling negative electrons upward, gathering them just below the interface. A conducting path where there wasn't one before.`,
            dur: 17000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Channel Forms', C().edgeRise);
              _drawTransistorStage(b, { gateOn: true, caption: 'channel = electrons pulled up by gate\u2019s electric field' });
              b.setLabel('A bridge of electrons appears \u2014 where silicon used to block. This is the core trick.', C().edgeRise);
            } },

          { text: `Now watch the source. Electrons are streaming into the channel, flowing rightward through it, and arriving at the drain. The drain is filling up. This is current flowing — source to drain, electron by electron, across a path that didn't exist a moment ago.`,
            dur: 15500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Current Flows \u2014 Source To Drain', C().edgeRise);
              _drawTransistorStage(b, { gateOn: true, caption: 'current in motion \u2014 electrons crossing the channel' });
              b.setLabel('This is what the whole transistor does. Source \u2192 channel \u2192 drain. One electron at a time.', C().edgeRise);
            } },

          { text: `And here's the magic — the gate never touched the silicon. It didn't pass any current through the oxide. It just SAT THERE, positively charged, and its electric field reached down and assembled a channel of electrons below. That electric field is everything. That's how a valve made of metal, separated from silicon by an insulator, controls the flow of electrons through that silicon.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Elegance \u2014 Control Without Touching', C().edgeRise);
              _drawTransistorStage(b, { gateOn: true, caption: 'no current through oxide \u2014 gate controls via FIELD alone' });
              b.setLabel('The gate is never electrically connected. It influences. That\u2019s why it\u2019s one of the great ideas in electronics.', C().edgeRise);
            } },

          { text: `This is the ON state. Gate is positive, channel exists, current flows. In digital terms, a logical one. A '1'. To turn the transistor off again, we just remove the gate voltage — the field disappears, the electrons drift back into the substrate, the channel collapses, and we're back to no current. On and off. A switch.`,
            dur: 17000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('ON State = Logical 1 \u2014 A Switch', C().edgeRise);
              _drawTransistorStage(b, { gateOn: true, caption: 'ON  \u2022  current flowing  \u2022  logical 1' });
              b.setLabel('Remove gate voltage \u2192 channel collapses \u2192 back to OFF. Controlled. Repeatable.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 — THRESHOLD
    // ════════════════════════════════════════════════════
    {
      id: 6,
      title: 'The Threshold \u2014 A Switch, Not A Dial',
      pages: [
        { sentences: [
          { text: `One more important thing. The transition from off to on isn't smooth. I'm going to slowly ramp the gate voltage up from zero. Watch — the channel doesn't gradually appear. It suddenly SNAPS into existence at a specific voltage.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Slowly Ramp The Gate \u2014 See What Happens', C().edgeRise);
              _drawTransistorStage(b, { thresholdDemo: true, caption: 'gate ramping 0V \u2192 +V \u2014 watch the channel' });
              b.setLabel('The channel doesn\u2019t fade in. It snaps on at a specific voltage \u2014 the threshold.', C().accent);
            } },

          { text: `The voltage at which the channel appears is called the threshold voltage. Below it — no channel, no current. Above it — channel, current. That sharp transition is what makes a transistor a digital switch, not an analog dial. You either have current or you don't. 0 or 1. Off or on. Black or white.`,
            dur: 18000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Threshold \u2014 0 Or 1, Nothing In Between', C().edgeRise);
              _drawTransistorStage(b, { thresholdDemo: true, caption: 'below threshold: OFF  \u2022  above threshold: ON' });
              b.setLabel('This is why digital circuits work. Clean sharp levels. No gray zone in normal operation.', C().edgeRise);
            } },

          { text: `In modern chips, the threshold is around half a volt. The power supply voltage — what the drain gets — is maybe one volt. So we design the CPU so that signals are either well above half a volt, or well below. Never ambiguous. Never stuck in the middle. That's how you get reliable digital behavior from analog physics.`,
            dur: 18500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Real Numbers From A Real Chip', C().accent);
              b.drawCustom('nums', (g, NS, COL) => {
                const rows = [
                  ['threshold voltage:',     '~0.5 V'],
                  ['supply voltage:',        '~1.0 V'],
                  ['logical 0 range:',       '0 V \u2013 0.3 V'],
                  ['logical 1 range:',       '0.7 V \u2013 1.0 V'],
                  ['forbidden middle zone:', '0.3 V \u2013 0.7 V'],
                ];
                rows.forEach((row, i) => {
                  const y = 240 + i * 40;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 400); a.setAttribute('y', y);
                  a.setAttribute('text-anchor', 'end');
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '14');
                  a.setAttribute('fill', COL.accent);
                  a.textContent = row[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 420); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '14');
                  b_.setAttribute('font-weight', '700');
                  b_.setAttribute('fill', i === 4 ? COL.wireHot : COL.edgeRise);
                  b_.textContent = row[1]; g.appendChild(b_);
                });
              });
              b.setLabel('CPUs avoid the middle zone. Signals must be clearly 0 or clearly 1. No middle ground in operation.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 7 — SCALE
    // ════════════════════════════════════════════════════
    {
      id: 7,
      title: 'Scale \u2014 One Transistor, Then Billions',
      pages: [
        { sentences: [
          { text: `One transistor. That's what we've been looking at. Let me give you a feel for how small it actually is in a modern chip. A transistor today is about 20 nanometers wide. Let me put that in human terms.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('How Small Is One Transistor?', C().accent);
              b.drawCustom('size', (g, NS, COL) => {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', 500); t.setAttribute('y', 320);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '40');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', COL.edgeRise);
                t.textContent = '~20 nanometers';
                g.appendChild(t);
              });
              b.setLabel('What does 20 nanometers actually look like?', C().accent);
            } },

          { text: `A human hair is about 80 thousand nanometers thick. So one transistor is about one-four-thousandth the thickness of a single hair. You can fit 4,000 transistors across the width of one of your hairs. We're working at atomic scales — a transistor's gate is only a few dozen atoms across.`,
            dur: 17000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('4,000 Transistors Across One Hair', C().edgeRise);
              b.drawCustom('compare', (g, NS, COL) => {
                const items = [
                  ['1 human hair:',      '80,000 nm thick'],
                  ['1 transistor:',      '~20 nm wide'],
                  ['transistors per hair:','~4,000 across one strand'],
                  ['gate thickness:',    'a few dozen atoms'],
                ];
                items.forEach((row, i) => {
                  const y = 240 + i * 50;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 400); a.setAttribute('y', y);
                  a.setAttribute('text-anchor', 'end');
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '16');
                  a.setAttribute('fill', COL.accent);
                  a.textContent = row[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 420); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '16');
                  b_.setAttribute('font-weight', '700');
                  b_.setAttribute('fill', COL.edgeRise);
                  b_.textContent = row[1]; g.appendChild(b_);
                });
              });
              b.setLabel('These numbers are hard to intuit. Almost incomprehensibly small. But very real.', C().edgeRise);
            } },

          { text: `A modern CPU packs about 20 billion of these onto a silicon die smaller than your thumbnail. 20,000,000,000. Stacked, laid out, connected to each other by metal wires. Every single one doing the same simple job — switching based on its gate voltage.`,
            dur: 15500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('20 Billion On One Die \u2014 Thumb-Sized', C().edgeRise);
              b.drawCustom('chip', (g, NS, COL) => {
                // Chip outline
                const rect = document.createElementNS(NS, 'rect');
                rect.setAttribute('x', 320); rect.setAttribute('y', 220);
                rect.setAttribute('width', 360); rect.setAttribute('height', 220);
                rect.setAttribute('rx', 10);
                rect.setAttribute('fill', COL.panel);
                rect.setAttribute('stroke', COL.edgeRise); rect.setAttribute('stroke-width', '2');
                g.appendChild(rect);
                // Dense dot pattern to suggest billions
                for (let i = 0; i < 400; i++) {
                  const c = document.createElementNS(NS, 'circle');
                  c.setAttribute('cx', 330 + Math.random() * 340);
                  c.setAttribute('cy', 230 + Math.random() * 200);
                  c.setAttribute('r', 0.8);
                  c.setAttribute('fill', '#55aaff');
                  c.setAttribute('opacity', '0.6');
                  g.appendChild(c);
                }
                const lbl = document.createElementNS(NS, 'text');
                lbl.setAttribute('x', 500); lbl.setAttribute('y', 345);
                lbl.setAttribute('text-anchor', 'middle');
                lbl.setAttribute('font-family', 'monospace');
                lbl.setAttribute('font-size', '22');
                lbl.setAttribute('font-weight', '700');
                lbl.setAttribute('fill', COL.edgeRise);
                lbl.textContent = '20 billion';
                g.appendChild(lbl);
                const sub = document.createElementNS(NS, 'text');
                sub.setAttribute('x', 500); sub.setAttribute('y', 375);
                sub.setAttribute('text-anchor', 'middle');
                sub.setAttribute('font-family', 'monospace');
                sub.setAttribute('font-size', '12');
                sub.setAttribute('fill', COL.accent);
                sub.textContent = 'transistors on one thumb-sized die';
                g.appendChild(sub);
              });
              b.setLabel('Each dot in this picture represents a few million transistors. Still doesn\u2019t show them all.', C().edgeRise);
            } },

          { text: `And that is how you get from "a transistor is a valve" to "a computer runs your program." The switches combine to make logic gates — AND, OR, NOT. The gates combine to make flip-flops and adders. Those combine to make registers, ALUs, RAM. Those combine to make the CPU. Layer upon layer. All resting on billions of these simple, switch-at-a-time atomic valves we just met.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('From This \u2192 To The Whole Computer', C().edgeRise);
              b.drawCustom('stack', (g, NS, COL) => {
                const layers = [
                  'CPU',
                  'ALU \u2022 RAM \u2022 REGISTERS',
                  'FLIP-FLOPS \u2022 ADDERS',
                  'LOGIC GATES (AND \u2022 OR \u2022 NOT)',
                  'TRANSISTORS  \u2014  ONE BILLION AT A TIME',
                ];
                layers.forEach((l, i) => {
                  const y = 220 + i * 55;
                  const w = 160 + i * 80;
                  const r = document.createElementNS(NS, 'rect');
                  r.setAttribute('x', 500 - w / 2); r.setAttribute('y', y);
                  r.setAttribute('width', w); r.setAttribute('height', 40);
                  r.setAttribute('rx', 4);
                  r.setAttribute('fill', COL.panel);
                  r.setAttribute('stroke', i === 4 ? COL.edgeRise : COL.accent);
                  r.setAttribute('stroke-width', i === 4 ? '3' : '1.5');
                  g.appendChild(r);
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 500); t.setAttribute('y', y + 26);
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '13');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', i === 4 ? COL.edgeRise : COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Every layer in the stack rests on the one below. At the bottom \u2014 transistors.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 8 — RECAP + TEASE
    // ════════════════════════════════════════════════════
    {
      id: 8,
      title: 'Recap \u2014 And What\u2019s Next',
      pages: [
        { sentences: [
          { text: `Alright, class. Quick recap. A transistor has three terminals — source, drain, gate. Electrons sit in the source, want to reach the drain. The gate controls whether they can.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Recap \u2014 Three Terminals', C().edgeRise);
              _drawTransistorStage(b, { gateOn: false, caption: 'source \u2022 drain \u2022 gate' });
              b.setLabel('The three names are the backbone. Everything else builds on them.', C().edgeRise);
            } },

          { text: `Apply enough voltage to the gate and a channel of electrons forms just below the oxide. Current flows from source to drain. Below the threshold, no channel. Above it, current. That's a switch.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Recap \u2014 Channel And Threshold', C().edgeRise);
              _drawTransistorStage(b, { gateOn: true, caption: 'gate on \u2192 channel \u2192 current' });
              b.setLabel('Below threshold: off. Above threshold: on. A physical digital switch.', C().edgeRise);
            } },

          { text: `And every gate, register, ALU, RAM cell, and CPU you've ever used — all built from billions of these. You've now seen, at the physics level, the single piece that the entire digital world is made of.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Foundation \u2014 You\u2019ve Seen It', C().edgeRise);
              _drawTransistorStage(b, { gateOn: true, caption: 'one transistor \u2014 the atom of digital electronics' });
              b.setLabel('Everything you\u2019ve learned in Series B sits on top of this one object. Now you\u2019ve met it.', C().edgeRise);
            } },

          { text: `Next lesson, we take TWO of these transistors — a regular one and its opposite — and combine them to make the simplest logic gate in existence: the CMOS inverter. That's where digital logic physically begins. See you there.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Next \u2014 Two Transistors Make A NOT Gate', C().accent);
              b.drawCustom('tease', (g, NS, COL) => {
                const t = document.createElementNS(NS, 'text');
                t.setAttribute('x', 500); t.setAttribute('y', 310);
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('font-family', 'monospace');
                t.setAttribute('font-size', '22');
                t.setAttribute('font-weight', '700');
                t.setAttribute('fill', COL.edgeRise);
                t.textContent = '1 transistor = a switch';
                g.appendChild(t);
                const t2 = document.createElementNS(NS, 'text');
                t2.setAttribute('x', 500); t2.setAttribute('y', 350);
                t2.setAttribute('text-anchor', 'middle');
                t2.setAttribute('font-family', 'monospace');
                t2.setAttribute('font-size', '22');
                t2.setAttribute('font-weight', '700');
                t2.setAttribute('fill', COL.edgeRise);
                t2.textContent = '2 transistors = a NOT gate';
                g.appendChild(t2);
                const t3 = document.createElementNS(NS, 'text');
                t3.setAttribute('x', 500); t3.setAttribute('y', 405);
                t3.setAttribute('text-anchor', 'middle');
                t3.setAttribute('font-family', 'monospace');
                t3.setAttribute('font-size', '14');
                t3.setAttribute('fill', COL.accent);
                t3.textContent = 'this is where physics becomes logic';
                g.appendChild(t3);
              });
              b.setLabel('End of Lesson 1 of Series C. Good work today, class. See you in Lesson 2.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
      isFinal: true,
    },
  ];

  if (typeof window !== 'undefined') {
    window.ATOMS_01_SCENES = ATOMS_01_SCENES;
  }
})();
