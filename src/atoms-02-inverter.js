/**
 * Series C — Episode 2: The CMOS Inverter
 * ---------------------------------------
 * Two transistors, one wire.  The first real LOGIC built from physics.
 *
 * We take the NMOS from Ep 1, add its mirror twin PMOS, wire them in series
 * from +V to GND with the output between them — and we get NOT.  The whole
 * story of digital logic starts right here.  Every gate you've ever drawn
 * lives on this move.
 *
 * Arc:
 *   1. Callback + preview      — last time ONE, today TWO.
 *   2. Meet the twins          — NMOS (on when gate high) / PMOS (on when gate low).
 *   3. Stack them              — PMOS on top to +V, NMOS on bottom to GND.
 *   4. Input LOW               — trace the current. Output pulled HIGH.
 *   5. Input HIGH              — trace the current. Output pulled LOW.
 *   6. That's NOT              — truth table. First logic from physics.
 *   7. Why CMOS is beautiful   — no static current. Battery lives.
 *   8. Recap + tease           — next: NAND, NOR, and the whole library.
 */

(function () {
  'use strict';

  const B = () => window.Blocks;
  const C = () => window.Blocks && window.Blocks.COL;

  // ═══════════════════════════════════════════════════════════════════
  //  Schematic stage — two transistors wired as an inverter.
  //  opts.input:  'low' | 'high' | 'toggle'   (toggle alternates every ~4s)
  //  Animates charge packets through the ON transistor.
  // ═══════════════════════════════════════════════════════════════════
  function _drawInverterStage(b, opts) {
    opts = opts || {};
    const COL = C();

    // Layout (1000 x 620)
    const vddY   = 90;              // +V rail y
    const gndY   = 540;             // GND rail y
    const railX1 = 260, railX2 = 740;
    const railMid = (railX1 + railX2) / 2;   // 500

    // Transistor boxes
    const pW = 170, pH = 100;
    const pX = railMid - pW / 2, pY = vddY + 60;       // PMOS
    const nX = railMid - pW / 2, nY = gndY - 60 - pH;  // NMOS

    // Output junction between them
    const outX = railMid + 120, outY = (pY + pH + nY) / 2;

    // Input (left side) feeds both gates
    const inX = railMid - 200, inY = (pY + pH + nY) / 2;

    const refs = {
      pBox: null, nBox: null,
      pGlow: null, nGlow: null,
      pState: null,     // text on the box: ON / OFF
      nState: null,
      inLabel: null, outLabel: null,
      pathUp: null,     // the +V → PMOS → out wire group
      pathDn: null,     // the out → NMOS → GND wire group
      packets: [],      // moving charge circles
      outVolts: null,
    };

    b.drawCustom('inv-stage', (g, NS, C2) => {
      // ─── +V rail ───
      const vdd = document.createElementNS(NS, 'line');
      vdd.setAttribute('x1', railX1); vdd.setAttribute('x2', railX2);
      vdd.setAttribute('y1', vddY); vdd.setAttribute('y2', vddY);
      vdd.setAttribute('stroke', '#ffaa33');
      vdd.setAttribute('stroke-width', '3');
      g.appendChild(vdd);
      const vddLbl = document.createElementNS(NS, 'text');
      vddLbl.setAttribute('x', railX1 - 10); vddLbl.setAttribute('y', vddY + 5);
      vddLbl.setAttribute('text-anchor', 'end');
      vddLbl.setAttribute('font-family', 'monospace');
      vddLbl.setAttribute('font-size', '15'); vddLbl.setAttribute('font-weight', '700');
      vddLbl.setAttribute('fill', '#ffaa33');
      vddLbl.textContent = '+V (supply)';
      g.appendChild(vddLbl);

      // ─── GND rail ───
      const gnd = document.createElementNS(NS, 'line');
      gnd.setAttribute('x1', railX1); gnd.setAttribute('x2', railX2);
      gnd.setAttribute('y1', gndY); gnd.setAttribute('y2', gndY);
      gnd.setAttribute('stroke', '#888');
      gnd.setAttribute('stroke-width', '3');
      g.appendChild(gnd);
      const gndLbl = document.createElementNS(NS, 'text');
      gndLbl.setAttribute('x', railX1 - 10); gndLbl.setAttribute('y', gndY + 5);
      gndLbl.setAttribute('text-anchor', 'end');
      gndLbl.setAttribute('font-family', 'monospace');
      gndLbl.setAttribute('font-size', '15'); gndLbl.setAttribute('font-weight', '700');
      gndLbl.setAttribute('fill', '#888');
      gndLbl.textContent = '0 V (GND)';
      g.appendChild(gndLbl);

      // ─── Wire +V down into PMOS source ───
      const wTop = document.createElementNS(NS, 'line');
      wTop.setAttribute('x1', railMid); wTop.setAttribute('x2', railMid);
      wTop.setAttribute('y1', vddY); wTop.setAttribute('y2', pY);
      wTop.setAttribute('stroke', '#ffaa33'); wTop.setAttribute('stroke-width', '3');
      g.appendChild(wTop);

      // ─── PMOS body ───
      const pGlow = document.createElementNS(NS, 'rect');
      pGlow.setAttribute('x', pX - 6); pGlow.setAttribute('y', pY - 6);
      pGlow.setAttribute('width', pW + 12); pGlow.setAttribute('height', pH + 12);
      pGlow.setAttribute('rx', '8');
      pGlow.setAttribute('fill', '#ffaa33'); pGlow.setAttribute('opacity', '0');
      g.appendChild(pGlow); refs.pGlow = pGlow;

      const p = document.createElementNS(NS, 'rect');
      p.setAttribute('x', pX); p.setAttribute('y', pY);
      p.setAttribute('width', pW); p.setAttribute('height', pH);
      p.setAttribute('rx', '5');
      p.setAttribute('fill', '#3a2030');     // P-type: red/maroon tint
      p.setAttribute('stroke', '#aa5566'); p.setAttribute('stroke-width', '2');
      g.appendChild(p); refs.pBox = p;

      const pLbl = document.createElementNS(NS, 'text');
      pLbl.setAttribute('x', pX + pW / 2); pLbl.setAttribute('y', pY + 28);
      pLbl.setAttribute('text-anchor', 'middle');
      pLbl.setAttribute('font-family', 'monospace');
      pLbl.setAttribute('font-size', '17'); pLbl.setAttribute('font-weight', '700');
      pLbl.setAttribute('fill', '#ffbbcc');
      pLbl.textContent = 'PMOS';
      g.appendChild(pLbl);
      const pSub = document.createElementNS(NS, 'text');
      pSub.setAttribute('x', pX + pW / 2); pSub.setAttribute('y', pY + 46);
      pSub.setAttribute('text-anchor', 'middle');
      pSub.setAttribute('font-family', 'monospace');
      pSub.setAttribute('font-size', '10'); pSub.setAttribute('font-style', 'italic');
      pSub.setAttribute('fill', '#aa7788');
      pSub.textContent = 'ON when gate is LOW';
      g.appendChild(pSub);

      const pState = document.createElementNS(NS, 'text');
      pState.setAttribute('x', pX + pW / 2); pState.setAttribute('y', pY + 80);
      pState.setAttribute('text-anchor', 'middle');
      pState.setAttribute('font-family', 'monospace');
      pState.setAttribute('font-size', '24'); pState.setAttribute('font-weight', '700');
      pState.setAttribute('fill', '#666');
      pState.textContent = 'OFF';
      g.appendChild(pState); refs.pState = pState;

      // ─── Wire PMOS drain → output junction (bottom of PMOS → outY) ───
      const wPtoOut = document.createElementNS(NS, 'line');
      wPtoOut.setAttribute('x1', railMid); wPtoOut.setAttribute('x2', railMid);
      wPtoOut.setAttribute('y1', pY + pH); wPtoOut.setAttribute('y2', outY);
      wPtoOut.setAttribute('stroke', '#666'); wPtoOut.setAttribute('stroke-width', '2');
      g.appendChild(wPtoOut);
      refs.pathUp = wPtoOut;

      // ─── NMOS body ───
      const nGlow = document.createElementNS(NS, 'rect');
      nGlow.setAttribute('x', nX - 6); nGlow.setAttribute('y', nY - 6);
      nGlow.setAttribute('width', pW + 12); nGlow.setAttribute('height', pH + 12);
      nGlow.setAttribute('rx', '8');
      nGlow.setAttribute('fill', '#33aaff'); nGlow.setAttribute('opacity', '0');
      g.appendChild(nGlow); refs.nGlow = nGlow;

      const n = document.createElementNS(NS, 'rect');
      n.setAttribute('x', nX); n.setAttribute('y', nY);
      n.setAttribute('width', pW); n.setAttribute('height', pH);
      n.setAttribute('rx', '5');
      n.setAttribute('fill', '#1a2a4a');      // N-type: blue tint
      n.setAttribute('stroke', '#5588aa'); n.setAttribute('stroke-width', '2');
      g.appendChild(n); refs.nBox = n;

      const nLbl = document.createElementNS(NS, 'text');
      nLbl.setAttribute('x', nX + pW / 2); nLbl.setAttribute('y', nY + 28);
      nLbl.setAttribute('text-anchor', 'middle');
      nLbl.setAttribute('font-family', 'monospace');
      nLbl.setAttribute('font-size', '17'); nLbl.setAttribute('font-weight', '700');
      nLbl.setAttribute('fill', '#88ccff');
      nLbl.textContent = 'NMOS';
      g.appendChild(nLbl);
      const nSub = document.createElementNS(NS, 'text');
      nSub.setAttribute('x', nX + pW / 2); nSub.setAttribute('y', nY + 46);
      nSub.setAttribute('text-anchor', 'middle');
      nSub.setAttribute('font-family', 'monospace');
      nSub.setAttribute('font-size', '10'); nSub.setAttribute('font-style', 'italic');
      nSub.setAttribute('fill', '#6688aa');
      nSub.textContent = 'ON when gate is HIGH';
      g.appendChild(nSub);

      const nState = document.createElementNS(NS, 'text');
      nState.setAttribute('x', nX + pW / 2); nState.setAttribute('y', nY + 80);
      nState.setAttribute('text-anchor', 'middle');
      nState.setAttribute('font-family', 'monospace');
      nState.setAttribute('font-size', '24'); nState.setAttribute('font-weight', '700');
      nState.setAttribute('fill', '#666');
      nState.textContent = 'OFF';
      g.appendChild(nState); refs.nState = nState;

      // ─── Wire output junction → NMOS drain (top of NMOS) ───
      const wOutToN = document.createElementNS(NS, 'line');
      wOutToN.setAttribute('x1', railMid); wOutToN.setAttribute('x2', railMid);
      wOutToN.setAttribute('y1', outY); wOutToN.setAttribute('y2', nY);
      wOutToN.setAttribute('stroke', '#666'); wOutToN.setAttribute('stroke-width', '2');
      g.appendChild(wOutToN);
      refs.pathDn = wOutToN;

      // ─── NMOS source → GND ───
      const wBot = document.createElementNS(NS, 'line');
      wBot.setAttribute('x1', railMid); wBot.setAttribute('x2', railMid);
      wBot.setAttribute('y1', nY + pH); wBot.setAttribute('y2', gndY);
      wBot.setAttribute('stroke', '#888'); wBot.setAttribute('stroke-width', '3');
      g.appendChild(wBot);

      // ─── Output junction node ───
      const outNode = document.createElementNS(NS, 'circle');
      outNode.setAttribute('cx', railMid); outNode.setAttribute('cy', outY);
      outNode.setAttribute('r', 6); outNode.setAttribute('fill', '#ddd');
      g.appendChild(outNode);

      // ─── Output wire going right ───
      const wOut = document.createElementNS(NS, 'line');
      wOut.setAttribute('x1', railMid); wOut.setAttribute('x2', outX);
      wOut.setAttribute('y1', outY); wOut.setAttribute('y2', outY);
      wOut.setAttribute('stroke', '#aaa'); wOut.setAttribute('stroke-width', '2.5');
      g.appendChild(wOut);
      const outTerm = document.createElementNS(NS, 'circle');
      outTerm.setAttribute('cx', outX); outTerm.setAttribute('cy', outY);
      outTerm.setAttribute('r', 10); outTerm.setAttribute('fill', '#222');
      outTerm.setAttribute('stroke', '#aaa'); outTerm.setAttribute('stroke-width', '2');
      g.appendChild(outTerm);
      const outLbl = document.createElementNS(NS, 'text');
      outLbl.setAttribute('x', outX + 18); outLbl.setAttribute('y', outY - 10);
      outLbl.setAttribute('font-family', 'monospace');
      outLbl.setAttribute('font-size', '15'); outLbl.setAttribute('font-weight', '700');
      outLbl.setAttribute('fill', '#aaa');
      outLbl.textContent = 'OUT';
      g.appendChild(outLbl);
      const outVolts = document.createElementNS(NS, 'text');
      outVolts.setAttribute('x', outX + 18); outVolts.setAttribute('y', outY + 14);
      outVolts.setAttribute('font-family', 'monospace');
      outVolts.setAttribute('font-size', '22'); outVolts.setAttribute('font-weight', '700');
      outVolts.setAttribute('fill', '#888');
      outVolts.textContent = '—';
      g.appendChild(outVolts); refs.outVolts = outVolts;

      // ─── Input wire: enters left, splits to both gates ───
      // Horizontal run to column where it branches
      const branchX = pX - 50;
      const wInH = document.createElementNS(NS, 'line');
      wInH.setAttribute('x1', inX - 80); wInH.setAttribute('x2', branchX);
      wInH.setAttribute('y1', inY); wInH.setAttribute('y2', inY);
      wInH.setAttribute('stroke', '#aaa'); wInH.setAttribute('stroke-width', '2.5');
      g.appendChild(wInH);
      // Vertical spine up and down to reach each gate
      const pGateY = pY + pH / 2;
      const nGateY = nY + pH / 2;
      const wInV = document.createElementNS(NS, 'line');
      wInV.setAttribute('x1', branchX); wInV.setAttribute('x2', branchX);
      wInV.setAttribute('y1', pGateY); wInV.setAttribute('y2', nGateY);
      wInV.setAttribute('stroke', '#aaa'); wInV.setAttribute('stroke-width', '2.5');
      g.appendChild(wInV);
      // Two stubs into the gate-side of each transistor
      const wInP = document.createElementNS(NS, 'line');
      wInP.setAttribute('x1', branchX); wInP.setAttribute('x2', pX);
      wInP.setAttribute('y1', pGateY); wInP.setAttribute('y2', pGateY);
      wInP.setAttribute('stroke', '#aaa'); wInP.setAttribute('stroke-width', '2.5');
      g.appendChild(wInP);
      const wInN = document.createElementNS(NS, 'line');
      wInN.setAttribute('x1', branchX); wInN.setAttribute('x2', nX);
      wInN.setAttribute('y1', nGateY); wInN.setAttribute('y2', nGateY);
      wInN.setAttribute('stroke', '#aaa'); wInN.setAttribute('stroke-width', '2.5');
      g.appendChild(wInN);
      // Input terminal
      const inTerm = document.createElementNS(NS, 'circle');
      inTerm.setAttribute('cx', inX - 80); inTerm.setAttribute('cy', inY);
      inTerm.setAttribute('r', 10); inTerm.setAttribute('fill', '#222');
      inTerm.setAttribute('stroke', '#aaa'); inTerm.setAttribute('stroke-width', '2');
      g.appendChild(inTerm);
      const inLbl = document.createElementNS(NS, 'text');
      inLbl.setAttribute('x', inX - 100); inLbl.setAttribute('y', inY - 10);
      inLbl.setAttribute('text-anchor', 'end');
      inLbl.setAttribute('font-family', 'monospace');
      inLbl.setAttribute('font-size', '15'); inLbl.setAttribute('font-weight', '700');
      inLbl.setAttribute('fill', '#aaa');
      inLbl.textContent = 'IN';
      g.appendChild(inLbl);
      const inVolts = document.createElementNS(NS, 'text');
      inVolts.setAttribute('x', inX - 100); inVolts.setAttribute('y', inY + 14);
      inVolts.setAttribute('text-anchor', 'end');
      inVolts.setAttribute('font-family', 'monospace');
      inVolts.setAttribute('font-size', '22'); inVolts.setAttribute('font-weight', '700');
      inVolts.setAttribute('fill', '#888');
      inVolts.textContent = '—';
      g.appendChild(inVolts); refs.inLabel = inVolts;
      refs.outLabel = outVolts;

      // Pre-create a small pool of charge packets (hidden until animate)
      for (let i = 0; i < 8; i++) {
        const d = document.createElementNS(NS, 'circle');
        d.setAttribute('r', 5);
        d.setAttribute('fill', '#ffaa33');
        d.setAttribute('opacity', '0');
        g.appendChild(d);
        refs.packets.push({ el: d, t: 0, active: false, path: null });
      }
    });

    // ═══ animator ═══
    b.animate('inv-stage', (tMs) => {
      // Determine input state for this frame
      let inputHigh;
      if (opts.input === 'toggle') {
        inputHigh = Math.floor(tMs / 4000) % 2 === 1;
      } else {
        inputHigh = opts.input === 'high';
      }

      // Gate colouring + state text
      if (inputHigh) {
        refs.inLabel.textContent = '+V';  refs.inLabel.setAttribute('fill', '#ffaa33');
        refs.pState.textContent = 'OFF';  refs.pState.setAttribute('fill', '#555');
        refs.nState.textContent = 'ON';   refs.nState.setAttribute('fill', '#88ccff');
        refs.pGlow.setAttribute('opacity', '0');
        refs.nGlow.setAttribute('opacity', '0.35');
        refs.outVolts.textContent = '0 V';
        refs.outVolts.setAttribute('fill', '#888');
        refs.pathUp.setAttribute('stroke', '#555');
        refs.pathUp.setAttribute('stroke-width', '2');
        refs.pathDn.setAttribute('stroke', '#88ccff');
        refs.pathDn.setAttribute('stroke-width', '4');
      } else {
        refs.inLabel.textContent = '0 V'; refs.inLabel.setAttribute('fill', '#888');
        refs.pState.textContent = 'ON';   refs.pState.setAttribute('fill', '#ffaa33');
        refs.nState.textContent = 'OFF';  refs.nState.setAttribute('fill', '#555');
        refs.pGlow.setAttribute('opacity', '0.35');
        refs.nGlow.setAttribute('opacity', '0');
        refs.outVolts.textContent = '+V';
        refs.outVolts.setAttribute('fill', '#ffaa33');
        refs.pathUp.setAttribute('stroke', '#ffaa33');
        refs.pathUp.setAttribute('stroke-width', '4');
        refs.pathDn.setAttribute('stroke', '#555');
        refs.pathDn.setAttribute('stroke-width', '2');
      }

      if (opts.hidePackets) {
        refs.packets.forEach(p => p.el.setAttribute('opacity', '0'));
        return;
      }

      // Animate packets along the conducting path
      // Upper path:  (railMid, vddY) → (railMid, outY) → (outX, outY)  when input=LOW
      // Lower path:  (outX, outY) → (railMid, outY) → (railMid, gndY)  when input=HIGH
      // Spawn a packet every ~500ms
      const spawnMs = 600;
      const packetIdx = Math.floor(tMs / spawnMs) % refs.packets.length;
      const slot = refs.packets[packetIdx];
      if (!slot.active) {
        slot.active = true;
        slot.born = tMs;
        slot.path = inputHigh ? 'down' : 'up';
      }

      refs.packets.forEach(p => {
        if (!p.active) { p.el.setAttribute('opacity', '0'); return; }
        const age = tMs - p.born;
        const travelMs = 2400;
        if (age > travelMs) { p.active = false; p.el.setAttribute('opacity', '0'); return; }
        const frac = age / travelMs;
        let px, py, color;
        if (p.path === 'up') {
          // +V → PMOS → output node → right to OUT
          if (frac < 0.35) {
            // from vdd down to pY (into PMOS)
            const f = frac / 0.35;
            px = railMid; py = vddY + f * (pY + pH / 2 - vddY);
          } else if (frac < 0.55) {
            // through PMOS to its bottom
            const f = (frac - 0.35) / 0.20;
            px = railMid; py = pY + pH / 2 + f * (pH / 2);
          } else if (frac < 0.75) {
            // PMOS bottom → output node
            const f = (frac - 0.55) / 0.20;
            px = railMid; py = pY + pH + f * (outY - (pY + pH));
          } else {
            // output node → right to OUT terminal
            const f = (frac - 0.75) / 0.25;
            px = railMid + f * (outX - railMid); py = outY;
          }
          color = '#ffaa33';
        } else {
          // OUT terminal → output node → NMOS → GND
          if (frac < 0.25) {
            const f = frac / 0.25;
            px = outX - f * (outX - railMid); py = outY;
          } else if (frac < 0.45) {
            const f = (frac - 0.25) / 0.20;
            px = railMid; py = outY + f * (nY - outY);
          } else if (frac < 0.65) {
            const f = (frac - 0.45) / 0.20;
            px = railMid; py = nY + f * (pH / 2);
          } else {
            const f = (frac - 0.65) / 0.35;
            px = railMid; py = nY + pH / 2 + f * (gndY - (nY + pH / 2));
          }
          color = '#88ccff';
        }
        p.el.setAttribute('cx', px);
        p.el.setAttribute('cy', py);
        p.el.setAttribute('fill', color);
        p.el.setAttribute('opacity', '0.95');
      });
    });
  }

  // Simple two-transistor-as-twin-boxes diagram (for scene 2)
  function _drawTwins(b) {
    b.drawCustom('twins', (g, NS, COL) => {
      const layouts = [
        { x: 170, title: 'NMOS', fill: '#1a2a4a', stroke: '#5588aa', accent: '#88ccff',
          rule: 'ON when gate is HIGH', sym: '\u2191 Vg' },
        { x: 550, title: 'PMOS', fill: '#3a2030', stroke: '#aa5566', accent: '#ffbbcc',
          rule: 'ON when gate is LOW', sym: '\u2193 Vg' },
      ];
      layouts.forEach(l => {
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', l.x); r.setAttribute('y', 160);
        r.setAttribute('width', 280); r.setAttribute('height', 300);
        r.setAttribute('rx', '8');
        r.setAttribute('fill', l.fill); r.setAttribute('stroke', l.stroke);
        r.setAttribute('stroke-width', '2');
        g.appendChild(r);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', l.x + 140); t.setAttribute('y', 210);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '36'); t.setAttribute('font-weight', '700');
        t.setAttribute('fill', l.accent);
        t.textContent = l.title;
        g.appendChild(t);
        const s = document.createElementNS(NS, 'text');
        s.setAttribute('x', l.x + 140); s.setAttribute('y', 290);
        s.setAttribute('text-anchor', 'middle');
        s.setAttribute('font-family', 'monospace');
        s.setAttribute('font-size', '18'); s.setAttribute('font-weight', '700');
        s.setAttribute('fill', l.accent);
        s.textContent = l.rule;
        g.appendChild(s);
        const sy = document.createElementNS(NS, 'text');
        sy.setAttribute('x', l.x + 140); sy.setAttribute('y', 370);
        sy.setAttribute('text-anchor', 'middle');
        sy.setAttribute('font-family', 'monospace');
        sy.setAttribute('font-size', '42');
        sy.setAttribute('fill', l.accent);
        sy.textContent = l.sym + ' = ON';
        g.appendChild(sy);
        const n = document.createElementNS(NS, 'text');
        n.setAttribute('x', l.x + 140); n.setAttribute('y', 430);
        n.setAttribute('text-anchor', 'middle');
        n.setAttribute('font-family', 'monospace');
        n.setAttribute('font-size', '14');
        n.setAttribute('fill', l.accent); n.setAttribute('opacity', '0.7');
        n.textContent = 'otherwise = OFF';
        g.appendChild(n);
      });
      // vs
      const v = document.createElementNS(NS, 'text');
      v.setAttribute('x', 500); v.setAttribute('y', 320);
      v.setAttribute('text-anchor', 'middle');
      v.setAttribute('font-family', 'monospace');
      v.setAttribute('font-size', '28'); v.setAttribute('font-weight', '700');
      v.setAttribute('fill', COL.edgeRise);
      v.textContent = 'vs';
      g.appendChild(v);
    });
  }

  // Truth table helper (for scene 6)
  function _drawTruthTable(b, highlightRow) {
    b.drawCustom('tt', (g, NS, COL) => {
      const x0 = 330, y0 = 200, cw = 160, rh = 60;
      // Title
      const h = document.createElementNS(NS, 'text');
      h.setAttribute('x', x0 + cw); h.setAttribute('y', y0 - 30);
      h.setAttribute('text-anchor', 'middle');
      h.setAttribute('font-family', 'monospace');
      h.setAttribute('font-size', '20'); h.setAttribute('font-weight', '700');
      h.setAttribute('fill', COL.edgeRise);
      h.textContent = 'The NOT gate';
      g.appendChild(h);
      // Header row
      const hdrs = ['IN', 'OUT'];
      hdrs.forEach((t, i) => {
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', x0 + i * cw); r.setAttribute('y', y0);
        r.setAttribute('width', cw); r.setAttribute('height', rh);
        r.setAttribute('fill', '#2a3040'); r.setAttribute('stroke', '#556');
        r.setAttribute('stroke-width', '1.5');
        g.appendChild(r);
        const tx = document.createElementNS(NS, 'text');
        tx.setAttribute('x', x0 + i * cw + cw / 2); tx.setAttribute('y', y0 + 38);
        tx.setAttribute('text-anchor', 'middle');
        tx.setAttribute('font-family', 'monospace');
        tx.setAttribute('font-size', '22'); tx.setAttribute('font-weight', '700');
        tx.setAttribute('fill', '#ddd');
        tx.textContent = t;
        g.appendChild(tx);
      });
      // Data rows
      const rows = [['0', '1'], ['1', '0']];
      rows.forEach((row, ri) => {
        row.forEach((val, ci) => {
          const isHi = (highlightRow === ri);
          const r = document.createElementNS(NS, 'rect');
          r.setAttribute('x', x0 + ci * cw); r.setAttribute('y', y0 + (ri + 1) * rh);
          r.setAttribute('width', cw); r.setAttribute('height', rh);
          r.setAttribute('fill', isHi ? '#334455' : '#1a1e28');
          r.setAttribute('stroke', '#445'); r.setAttribute('stroke-width', '1.5');
          g.appendChild(r);
          const tx = document.createElementNS(NS, 'text');
          tx.setAttribute('x', x0 + ci * cw + cw / 2);
          tx.setAttribute('y', y0 + (ri + 1) * rh + 38);
          tx.setAttribute('text-anchor', 'middle');
          tx.setAttribute('font-family', 'monospace');
          tx.setAttribute('font-size', '26'); tx.setAttribute('font-weight', '700');
          const col = val === '1' ? '#ffaa33' : '#88aabb';
          tx.setAttribute('fill', isHi ? col : col);
          tx.setAttribute('opacity', isHi ? '1' : '0.55');
          tx.textContent = val;
          g.appendChild(tx);
        });
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SCENES
  // ═══════════════════════════════════════════════════════════════════
  const ATOMS_02_SCENES = [

    // ════════════════════════════════════════════════════
    // SCENE 1 — CALLBACK + PREVIEW
    // ════════════════════════════════════════════════════
    {
      id: 1,
      title: 'Welcome Back \u2014 One Becomes Two',
      pages: [
        { sentences: [
          { text: `Welcome back, class. Last lesson, we went all the way down to ONE transistor. We watched electrons cross the channel. We saw that a transistor is a switch — nothing more, nothing less.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Lesson 1 Recap \u2014 One Transistor = One Switch', C().accent);
              b.drawBox('one', 380, 260, 240, 160, 'ONE TRANSISTOR\n\na switch\ngate controls flow', C().edgeRise);
              b.setLabel('We saw it physically. Source, drain, gate, channel. Electrons flowing.', C().accent);
            } },

          { text: `So here's the question on the table today. If ONE transistor is just a switch — how do you get LOGIC from that? How do you get AND, OR, NOT, anything useful? The answer is: you don't get it from one. You need at least TWO. And today, we wire two together.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Today \u2014 Two Transistors. One Wire. Real Logic.', C().edgeRise);
              b.drawBox('t1', 200, 260, 200, 160, 'transistor 1\n\nswitch', C().accent);
              b.drawBox('t2', 600, 260, 200, 160, 'transistor 2\n\nswitch', C().accent);
              b.drawWire('bridge', 400, 340, 600, 340, C().edgeRise);
              b.setLabel('Two switches + one wire = the first real logic gate.', C().edgeRise);
            } },

          { text: `The gate we're building today is the simplest one possible. It's called the INVERTER — also known as the NOT gate. If you give it a 0, it gives you a 1. If you give it a 1, it gives you a 0. That's it. And we will see EXACTLY how two transistors make that happen.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Today\u2019s Build \u2014 The NOT Gate', C().edgeRise);
              b.drawCustom('preview', (g, NS, COL) => {
                const arrow = document.createElementNS(NS, 'text');
                arrow.setAttribute('x', 500); arrow.setAttribute('y', 310);
                arrow.setAttribute('text-anchor', 'middle');
                arrow.setAttribute('font-family', 'monospace');
                arrow.setAttribute('font-size', '32'); arrow.setAttribute('font-weight', '700');
                arrow.setAttribute('fill', COL.edgeRise);
                arrow.textContent = '0 \u2192 1';
                g.appendChild(arrow);
                const arrow2 = document.createElementNS(NS, 'text');
                arrow2.setAttribute('x', 500); arrow2.setAttribute('y', 360);
                arrow2.setAttribute('text-anchor', 'middle');
                arrow2.setAttribute('font-family', 'monospace');
                arrow2.setAttribute('font-size', '32'); arrow2.setAttribute('font-weight', '700');
                arrow2.setAttribute('fill', COL.edgeRise);
                arrow2.textContent = '1 \u2192 0';
                g.appendChild(arrow2);
                const sub = document.createElementNS(NS, 'text');
                sub.setAttribute('x', 500); sub.setAttribute('y', 420);
                sub.setAttribute('text-anchor', 'middle');
                sub.setAttribute('font-family', 'monospace');
                sub.setAttribute('font-size', '16');
                sub.setAttribute('fill', COL.accent);
                sub.textContent = 'flip the input — done. that\u2019s our job today.';
                g.appendChild(sub);
              });
              b.setLabel('Simple job. But once we can do this \u2014 everything else becomes possible.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 2 — MEET THE TWINS
    // ════════════════════════════════════════════════════
    {
      id: 2,
      title: 'Meet The Twins \u2014 NMOS And PMOS',
      pages: [
        { sentences: [
          { text: `Before we wire anything, we need two flavours of transistor. Not one — two. They are twins. Same physics, mirror behaviour. One is called NMOS. The other is called PMOS. Let me show them to you side by side.`,
            dur: 14000,
            anim: () => { const b = B(); b.clear();
              b.setTitle('Two Flavours \u2014 NMOS And PMOS', C().edgeRise);
              _drawTwins(b);
              b.setLabel('Same physics. Mirror behaviour. Meet them side by side.', C().accent);
            } },

          { text: `The NMOS is the one we studied last lesson. When you put a HIGH voltage on its gate, it turns ON — electrons flow. When the gate is LOW, it turns OFF — no flow. Gate high, switch closed. Gate low, switch open. Remember that.`,
            dur: 14500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('NMOS \u2014 HIGH Gate Turns It ON', C().edgeRise);
              _drawTwins(b);
              b.setLabel('Gate HIGH \u2192 ON. Gate LOW \u2192 OFF. The one we already know.', C().edgeRise);
            } },

          { text: `The PMOS is its mirror image. Same kind of switch — but flipped. When you put a LOW voltage on its gate, IT turns ON. When the gate is HIGH, the PMOS turns OFF. Exactly the opposite of the NMOS. Don't let that worry you. Same kind of device, opposite rule.`,
            dur: 15000,
            anim: () => { const b = B(); b.clear();
              b.setTitle('PMOS \u2014 LOW Gate Turns It ON', C().accent);
              _drawTwins(b);
              b.setLabel('Gate LOW \u2192 ON. Gate HIGH \u2192 OFF. Exact mirror of the NMOS.', C().accent);
            } },

          { text: `Why does nature give us both? Because we need both. One pulls UP toward +V. The other pulls DOWN toward GND. Together, no matter what the input is, exactly ONE of them will be on — and the output gets driven firmly. That's the whole secret of today's lesson.`,
            dur: 15500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('We Need Both \u2014 One Pulls Up, One Pulls Down', C().edgeRise);
              _drawTwins(b);
              b.setLabel('PMOS \u2192 pulls output UP to +V.  NMOS \u2192 pulls output DOWN to GND.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 3 — STACK THEM
    // ════════════════════════════════════════════════════
    {
      id: 3,
      title: 'Stack Them \u2014 Wire The Circuit',
      pages: [
        { sentences: [
          { text: `Alright. Here's the circuit. Look carefully. At the top is +V — the power supply. At the bottom is GND — zero volts. Every CPU in the world has these two rails. Power flows from the top rail, through our transistors, down to the bottom rail.`,
            dur: 14500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('Power Rails \u2014 +V At Top, GND At Bottom', C().edgeRise);
              _drawInverterStage(b, { input: 'low', hidePackets: true });
              b.setLabel('The two rails that every digital circuit plugs into.', C().edgeRise);
            } },

          { text: `Between those rails, we stack our two transistors in series. PMOS goes ON TOP, connected to +V. NMOS goes on the BOTTOM, connected to GND. They are literally lined up — one above the other. A path from +V at the top, through both, down to GND.`,
            dur: 15500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('Stack PMOS On Top, NMOS On Bottom', C().edgeRise);
              _drawInverterStage(b, { input: 'low', hidePackets: true });
              b.setLabel('PMOS on top \u2192 +V.  NMOS on bottom \u2192 GND.  Stacked in series.', C().edgeRise);
            } },

          { text: `Now the key move. Right in the MIDDLE — between the two transistors — we tap off a wire. That tap is our OUTPUT. Whatever voltage shows up in the middle, that's what the gate is producing. The wire on the right going to the label OUT.`,
            dur: 14500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('Tap The Middle \u2014 That\u2019s Our OUTPUT', C().edgeRise);
              _drawInverterStage(b, { input: 'low', hidePackets: true });
              b.setLabel('Between the two transistors, we tap a wire. That\u2019s OUT.', C().edgeRise);
            } },

          { text: `And on the left side — the INPUT wire. It goes to BOTH gates at once. One input, feeding two transistor gates simultaneously. This is the one and only control we get. Whatever voltage we put on IN, we put on BOTH gates at the same time.`,
            dur: 15000,
            anim: () => { const b = B(); b.clear();
              b.setTitle('Wire The Input To BOTH Gates', C().accent);
              _drawInverterStage(b, { input: 'low', hidePackets: true });
              b.setLabel('One input. Feeds BOTH gates simultaneously. This is our only control.', C().accent);
            } },

          { text: `That's the whole construction. Power rail on top, ground on bottom, PMOS and NMOS stacked in between, one input wired to both gates, output tapped from the middle. Six wires. Two transistors. Now let's FEED IT voltages and see what happens.`,
            dur: 14500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('The Whole Circuit \u2014 Ready To Energise', C().edgeRise);
              _drawInverterStage(b, { input: 'low', hidePackets: true });
              b.setLabel('Two transistors. Six wires. Time to apply voltage.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 4 — INPUT LOW
    // ════════════════════════════════════════════════════
    {
      id: 4,
      title: 'Case One \u2014 Input LOW',
      pages: [
        { sentences: [
          { text: `First test. Let's put a LOW voltage — zero volts — on the input. That's what we call a logical 0. Zero volts on IN means zero volts on both gates. Now — remember the twin rules. What does each transistor do?`,
            dur: 14000,
            anim: () => { const b = B(); b.clear();
              b.setTitle('Apply IN = 0 V', C().edgeRise);
              _drawInverterStage(b, { input: 'low', hidePackets: true });
              b.setLabel('Zero volts on the input. Zero on both gates. Now \u2014 what turns on?', C().edgeRise);
            } },

          { text: `The PMOS. PMOS turns ON when its gate is LOW. The gate is at zero. So the PMOS is wide open — conducting. The top half of our circuit is now a conductor. A wire. Electricity can flow from +V, straight through the PMOS, to the middle of the circuit.`,
            dur: 15500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('PMOS Opens \u2014 Top Path Conducts', C().edgeRise);
              _drawInverterStage(b, { input: 'low', hidePackets: true });
              b.setLabel('Gate LOW \u2192 PMOS ON. Top path is open. +V can reach the middle.', C().edgeRise);
            } },

          { text: `What about the NMOS? NMOS turns ON when its gate is HIGH. But our gate is LOW. So the NMOS stays OFF. The bottom half of the circuit is BLOCKED. Broken. No path from the middle down to ground. It's like a closed valve on the bottom.`,
            dur: 15500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('NMOS Stays Shut \u2014 Bottom Path Blocked', C().accent);
              _drawInverterStage(b, { input: 'low', hidePackets: true });
              b.setLabel('Gate LOW \u2192 NMOS OFF. Bottom path blocked. No route to GND.', C().accent);
            } },

          { text: `Now watch the current. +V wants to reach GND. But the bottom is blocked. So the current goes +V, down through the PMOS, hits the middle — and just fills it up. The OUTPUT wire is tied to that middle. So the output gets pulled up to +V. A logical 1.`,
            dur: 16000,
            anim: () => { const b = B(); b.clear();
              b.setTitle('Output Pulled HIGH \u2014 OUT = +V = 1', C().edgeRise);
              _drawInverterStage(b, { input: 'low' });
              b.setLabel('Watch the packets: +V \u2192 through PMOS \u2192 into OUT. Output = HIGH.', C().edgeRise);
            } },

          { text: `So we fed in a 0 — and the output came out 1. Input zero, output one. The gate INVERTED the signal. Just by wiring two transistors the way we did. Physics did the inverting. Not a program. Not a rule. Just two transistors obeying their own nature.`,
            dur: 15500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('IN = 0 \u2192 OUT = 1  \u2014  Physics Inverted It', C().edgeRise);
              _drawInverterStage(b, { input: 'low' });
              b.setLabel('Zero in. One out. No software. Just two transistors doing their job.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 5 — INPUT HIGH
    // ════════════════════════════════════════════════════
    {
      id: 5,
      title: 'Case Two \u2014 Input HIGH',
      pages: [
        { sentences: [
          { text: `Now the other case. We put +V — a logical 1 — on the input. Full voltage on both gates. Let's run the same analysis. Which transistor turns on? Which turns off? You should be able to guess it now.`,
            dur: 13500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('Apply IN = +V', C().accent);
              _drawInverterStage(b, { input: 'high', hidePackets: true });
              b.setLabel('Full voltage on the input. Full voltage on both gates. Now what?', C().accent);
            } },

          { text: `The NMOS wakes up. NMOS turns ON when its gate is HIGH — and it is. So the bottom half is now a conductor. A straight pipe from the middle down to GND. The bottom is OPEN.`,
            dur: 13000,
            anim: () => { const b = B(); b.clear();
              b.setTitle('NMOS Opens \u2014 Bottom Path Conducts', C().accent);
              _drawInverterStage(b, { input: 'high', hidePackets: true });
              b.setLabel('Gate HIGH \u2192 NMOS ON. Middle can drain down to GND.', C().accent);
            } },

          { text: `And the PMOS — it turns OFF when the gate is HIGH. So the top is blocked. +V cannot reach the middle anymore. The top path is broken. Exact mirror of the last case.`,
            dur: 13500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('PMOS Shuts \u2014 Top Path Blocked', C().edgeFall);
              _drawInverterStage(b, { input: 'high', hidePackets: true });
              b.setLabel('Gate HIGH \u2192 PMOS OFF. +V cannot reach the middle anymore.', C().edgeFall);
            } },

          { text: `So what happens to the output? Whatever charge is sitting in the middle wire gets drained straight down through the NMOS to GND. The output is pulled LOW — zero volts. A logical 0.`,
            dur: 14500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('Output Pulled LOW \u2014 OUT = 0 V = 0', C().accent);
              _drawInverterStage(b, { input: 'high' });
              b.setLabel('Watch the packets: OUT \u2192 down through NMOS \u2192 into GND. Output = LOW.', C().accent);
            } },

          { text: `Input one — output zero. Again, the gate inverted it. Not by code. By the arrangement of silicon. The PMOS and NMOS take turns. Whatever you feed in, they flip it on the way out.`,
            dur: 14000,
            anim: () => { const b = B(); b.clear();
              b.setTitle('IN = 1 \u2192 OUT = 0  \u2014  Inverted Again', C().accent);
              _drawInverterStage(b, { input: 'high' });
              b.setLabel('One in. Zero out. Silicon inverts. Every time. Always.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 — THAT'S NOT
    // ════════════════════════════════════════════════════
    {
      id: 6,
      title: 'That\u2019s A NOT Gate',
      pages: [
        { sentences: [
          { text: `Let's collect what we've seen. Two cases. Two inputs. Two outputs. Write them down as a truth table. IN = 0 gives OUT = 1. IN = 1 gives OUT = 0. Two rows. That table IS the definition of the NOT gate.`,
            dur: 14500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('Truth Table \u2014 Two Rows, One Gate', C().edgeRise);
              _drawTruthTable(b, -1);
              b.setLabel('Every case we tested. Two rows. That is NOT.', C().edgeRise);
            } },

          { text: `First row. Input zero. Output one. We saw it physically — PMOS opened, NMOS closed, charge flowed from +V into the output. Zero flipped to one.`,
            dur: 12500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('Row 1 \u2014 IN=0, OUT=1', C().edgeRise);
              _drawTruthTable(b, 0);
              b.setLabel('The case we just walked through. Saw the packets. Knew the answer.', C().edgeRise);
            } },

          { text: `Second row. Input one. Output zero. We saw it physically — NMOS opened, PMOS closed, charge drained from the output down to GND. One flipped to zero.`,
            dur: 12500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('Row 2 \u2014 IN=1, OUT=0', C().accent);
              _drawTruthTable(b, 1);
              b.setLabel('The other case. Mirror of the first. Same rule, flipped.', C().accent);
            } },

          { text: `This is the moment I want you to pause on. Up above, we've been drawing NOT gates as little triangle symbols in Series B. Those symbols were ABSTRACTIONS. Now you know what's inside one. Two transistors. That's it. The abstraction is empty. Below it is just silicon and voltage.`,
            dur: 16500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('Below The Symbol \u2014 Two Transistors And A Wire', C().edgeRise);
              b.drawCustom('sym', (g, NS, COL) => {
                // NOT gate symbol
                const path = document.createElementNS(NS, 'path');
                path.setAttribute('d', 'M 350 280 L 350 400 L 500 340 Z');
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', COL.edgeRise);
                path.setAttribute('stroke-width', '3');
                g.appendChild(path);
                const bub = document.createElementNS(NS, 'circle');
                bub.setAttribute('cx', 512); bub.setAttribute('cy', 340);
                bub.setAttribute('r', 12);
                bub.setAttribute('fill', 'none');
                bub.setAttribute('stroke', COL.edgeRise);
                bub.setAttribute('stroke-width', '3');
                g.appendChild(bub);
                const a1 = document.createElementNS(NS, 'text');
                a1.setAttribute('x', 500); a1.setAttribute('y', 470);
                a1.setAttribute('text-anchor', 'middle');
                a1.setAttribute('font-family', 'monospace');
                a1.setAttribute('font-size', '14'); a1.setAttribute('font-style', 'italic');
                a1.setAttribute('fill', COL.accent);
                a1.textContent = 'the schematic symbol \u2014 which is just two transistors in a stack';
                g.appendChild(a1);
              });
              b.setLabel('Every NOT gate you\u2019ve ever drawn is THIS. Just two transistors.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 7 — WHY CMOS IS BEAUTIFUL
    // ════════════════════════════════════════════════════
    {
      id: 7,
      title: 'Why CMOS Is Beautiful',
      pages: [
        { sentences: [
          { text: `Now a point that is pure engineering poetry. Notice something. In both cases we just walked through — input LOW or input HIGH — exactly ONE of the two transistors is ON. Never both. Never neither. Always exactly one.`,
            dur: 14500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('Always Exactly ONE Transistor Is ON', C().edgeRise);
              _drawInverterStage(b, { input: 'toggle' });
              b.setLabel('Watch the inverter toggle. Count how many are ON at once. Always one.', C().edgeRise);
            } },

          { text: `Why does that matter? Because if one transistor is always OFF, there is NEVER a straight path from +V to GND. The current can get to the output — but it cannot keep flowing forever. The battery doesn't drain just sitting there.`,
            dur: 15000,
            anim: () => { const b = B(); b.clear();
              b.setTitle('No Straight Path \u2192 No Wasted Current', C().edgeRise);
              _drawInverterStage(b, { input: 'toggle' });
              b.setLabel('One of them always blocks the path from +V to GND. Nothing leaks.', C().edgeRise);
            } },

          { text: `This is why the technology is called CMOS — Complementary MOS. Complementary means "opposite pair". The PMOS and NMOS ARE the opposite pair. And this trick — always exactly one of them on — is what keeps your phone battery alive for a whole day. It is the reason modern computing exists.`,
            dur: 17000,
            anim: () => { const b = B(); b.clear();
              b.setTitle('CMOS \u2014 Complementary MOS', C().edgeRise);
              _drawInverterStage(b, { input: 'toggle' });
              b.setLabel('Complementary pair. The genius that lets billions of gates share one battery.', C().edgeRise);
            } },

          { text: `Before CMOS, chips used just NMOS transistors. They worked — but they leaked current constantly. They got hot. They drained batteries. CMOS was the breakthrough of the 1980s. Every CPU since uses this same two-transistor, pull-up pull-down trick. Every single one.`,
            dur: 15500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('CMOS \u2014 The 1980s Breakthrough', C().edgeRise);
              _drawInverterStage(b, { input: 'toggle' });
              b.setLabel('Before CMOS: hot, leaky chips. After CMOS: phones, laptops, everything.', C().edgeRise);
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
          { text: `Big moment today. Let's recap. We took two transistors — one NMOS, one PMOS. We stacked them between +V and GND. We tied their gates to a single input. We tapped the output from the middle. And — just from physics — we got the NOT gate.`,
            dur: 16000,
            anim: () => { const b = B(); b.clear();
              b.setTitle('Today We Built The First Gate', C().edgeRise);
              _drawInverterStage(b, { input: 'toggle' });
              b.setLabel('Two transistors, six wires, one truth table. That\u2019s logic from silicon.', C().edgeRise);
            } },

          { text: `And here's the beautiful part. Once you have a NOT gate, you are very close to having all the other gates. An AND becomes just a few more transistors. An OR is a few more. A NAND is four. Everything in Series B sits on top of this trick. Every gate, every flip-flop, every register, every CPU.`,
            dur: 17000,
            anim: () => { const b = B(); b.clear();
              b.setTitle('One Gate \u2192 All Gates', C().edgeRise);
              b.drawCustom('family', (g, NS, COL) => {
                const items = ['NOT', 'NAND', 'NOR', 'AND', 'OR', 'XOR'];
                items.forEach((t, i) => {
                  const x = 180 + (i % 3) * 220, y = 240 + Math.floor(i / 3) * 140;
                  const r = document.createElementNS(NS, 'rect');
                  r.setAttribute('x', x); r.setAttribute('y', y);
                  r.setAttribute('width', 180); r.setAttribute('height', 80);
                  r.setAttribute('rx', 8);
                  r.setAttribute('fill', i === 0 ? '#3a3510' : '#1a1e28');
                  r.setAttribute('stroke', i === 0 ? COL.edgeRise : '#556');
                  r.setAttribute('stroke-width', i === 0 ? '3' : '1.5');
                  g.appendChild(r);
                  const tx = document.createElementNS(NS, 'text');
                  tx.setAttribute('x', x + 90); tx.setAttribute('y', y + 35);
                  tx.setAttribute('text-anchor', 'middle');
                  tx.setAttribute('font-family', 'monospace');
                  tx.setAttribute('font-size', '22'); tx.setAttribute('font-weight', '700');
                  tx.setAttribute('fill', i === 0 ? COL.edgeRise : '#aaa');
                  tx.textContent = t;
                  g.appendChild(tx);
                  const sub = document.createElementNS(NS, 'text');
                  sub.setAttribute('x', x + 90); sub.setAttribute('y', y + 60);
                  sub.setAttribute('text-anchor', 'middle');
                  sub.setAttribute('font-family', 'monospace');
                  sub.setAttribute('font-size', '11');
                  sub.setAttribute('fill', i === 0 ? COL.edgeRise : '#778');
                  sub.textContent = i === 0 ? '2 transistors \u2014 built today' : '4\u20136 transistors';
                  g.appendChild(sub);
                });
              });
              b.setLabel('Today: NOT (2 transistors). The rest of the family is a short hop away.', C().edgeRise);
            } },

          { text: `Next lesson in Series C, we take that short hop. We build the NAND gate out of four transistors. NAND is special because you can make any other gate from NANDs alone. Once we have NAND from physics, we have ALL of digital logic from physics. That's where we're heading.`,
            dur: 16500,
            anim: () => { const b = B(); b.clear();
              b.setTitle('Next \u2014 NAND From Four Transistors', C().accent);
              b.drawCustom('tease', (g, NS, COL) => {
                const lines = [
                  '1 transistor  = a switch',
                  '2 transistors = a NOT gate',
                  '4 transistors = a NAND gate',
                  'NAND alone    = every gate in existence',
                ];
                lines.forEach((l, i) => {
                  const tx = document.createElementNS(NS, 'text');
                  tx.setAttribute('x', 500); tx.setAttribute('y', 260 + i * 45);
                  tx.setAttribute('text-anchor', 'middle');
                  tx.setAttribute('font-family', 'monospace');
                  tx.setAttribute('font-size', '20'); tx.setAttribute('font-weight', '700');
                  tx.setAttribute('fill', i === 3 ? COL.edgeRise : COL.accent);
                  tx.textContent = l;
                  g.appendChild(tx);
                });
              });
              b.setLabel('End of Lesson 2. Good work today. See you in Lesson 3 \u2014 we build NAND.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
      isFinal: true,
    },
  ];

  if (typeof window !== 'undefined') {
    window.ATOMS_02_SCENES = ATOMS_02_SCENES;
  }
})();
