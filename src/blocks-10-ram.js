/**
 * Series B — Episode 10: How RAM Is Built
 * -----------------------------------------
 * The final Series B episode. RAM is where every program, every variable,
 * every piece of data ultimately lives. This episode breaks it open: a
 * single cell (SRAM vs DRAM), the 2D grid layout, the row and column
 * decoders, and the read and write cycles that move bytes between memory
 * and the CPU. It also places RAM in its larger context — the memory
 * hierarchy from registers down to disk.
 *
 * Arc:
 *   0. Hook                     billions of cells, accessed in a nanosecond
 *   1. Memory interface          address + data + R/W, at the pins
 *   2. The SRAM cell             6 transistors, cross-coupled inverters
 *   3. The DRAM cell             1T + 1C — dense, leaky, needs refresh
 *   4. Memory as a 2D grid       rows × columns — hierarchical addressing
 *   5. Row + column decoders     callback to Ep 5 — small decoders, big reach
 *   6. Read cycle walkthrough    address → row → sense amp → col MUX → bus
 *   7. Write cycle walkthrough   data drives into selected cells
 *   8. Memory hierarchy          registers → cache → RAM → storage
 *   9. Recap + Series B finale
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

  // Generic RAM block symbol — labelled box with address, data, R/W pins.
  function _drawRamBlock(b, opts) {
    opts = opts || {};
    const col = C();
    const x = opts.x || 320, y = opts.y || 220;
    const w = opts.w || 320, h = opts.h || 220;
    b.drawBox('ram', x, y, w, h, opts.label || 'RAM', col.edgeRise);
    // Address pins
    b.drawNode('addr-l', x - 130, y + 50, 'ADDRESS →', col.wireHi);
    b.drawWire('waddr', [[x - 50, y + 50],[x, y + 50]], col.wireHi);
    // R/W control
    b.drawNode('rw-l', x - 130, y + 110, 'READ/WRITE →', col.edgeRise);
    b.drawWire('wrw', [[x - 50, y + 110],[x, y + 110]], col.edgeRise);
    // Data — bidirectional bus
    b.drawNode('data-l', x + w + 60, y + h - 40, 'DATA', col.wireHi);
    b.drawWire('wdata', [[x + w, y + h - 40],[x + w + 40, y + h - 40]], col.wireHi);
    return { x, y, w, h };
  }

  // A 6-transistor SRAM cell schematic: two cross-coupled inverters + two
  // access transistors gated by the word line.
  function _drawSRAMCell(b, opts) {
    opts = opts || {};
    const col = C();
    const cx = opts.x || 500, cy = opts.y || 320;
    // Two inverters facing each other
    b.drawGate('inv-L', 'NOT', cx - 90, cy - 20, 70, 50);
    b.drawGate('inv-R', 'NOT', cx + 30, cy - 20, 70, 50);
    // Cross-couple wires — output of each feeds input of the other
    b.drawWire('xc1', [[cx - 10, cy + 5],[cx + 10, cy + 5],[cx + 30, cy + 5]], col.wireHi);
    b.drawWire('xc2', [[cx + 112, cy + 5],[cx + 140, cy + 5],[cx + 140, cy - 60],[cx - 130, cy - 60],[cx - 130, cy + 5],[cx - 90, cy + 5]], col.wireHi);
    // Bit-storage nodes labelled
    b.drawNode('q',  cx + 20,  cy + 35, 'Q',     col.edgeRise);
    b.drawNode('qb', cx + 140, cy - 70, 'Q̄',    col.edgeRise);
    // Access transistors shown as simple boxes (real ones would be MOSFETs)
    b.drawBox('tL', cx - 210, cy - 10, 60, 40, 'T',  col.accent);
    b.drawBox('tR', cx + 150, cy - 10, 60, 40, 'T',  col.accent);
    // Word line — horizontal, controls both access transistors
    b.drawWire('wl', [[cx - 270, cy + 10],[cx - 210, cy + 10]], col.edgeRise);
    b.drawWire('wl2', [[cx - 150, cy + 10],[cx + 150, cy + 10]], col.edgeRise);
    b.drawWire('wl3', [[cx + 210, cy + 10],[cx + 260, cy + 10]], col.edgeRise);
    b.drawNode('wl-l', cx - 290, cy + 10, 'WORD LINE', col.edgeRise);
    // Bit lines — vertical, feed the access transistors
    b.drawWire('bl',  [[cx - 180, cy - 90],[cx - 180, cy - 10]], col.wireHi);
    b.drawWire('bl2', [[cx - 180, cy + 30],[cx - 180, cy + 120]], col.wireHi);
    b.drawNode('bl-l', cx - 180, cy - 100, 'BIT', col.wireHi);
    b.drawWire('blb',  [[cx + 180, cy - 90],[cx + 180, cy - 10]], col.wireHi);
    b.drawWire('blb2', [[cx + 180, cy + 30],[cx + 180, cy + 120]], col.wireHi);
    b.drawNode('blb-l', cx + 180, cy - 100, 'BIT̄', col.wireHi);
    // Count label
    b.drawNode('count', cx, cy + 130, '6 transistors per cell', col.accent);
  }

  // A 1T + 1C DRAM cell: single transistor + a capacitor to ground.
  function _drawDRAMCell(b, opts) {
    opts = opts || {};
    const col = C();
    const cx = opts.x || 500, cy = opts.y || 320;
    // Word line on top
    b.drawWire('wl', [[cx - 200, cy],[cx + 100, cy]], col.edgeRise);
    b.drawNode('wl-l', cx - 240, cy, 'WORD LINE', col.edgeRise);
    // Transistor (access)
    b.drawBox('t', cx - 30, cy - 25, 60, 50, 'T', col.accent);
    // Bit line on the right
    b.drawWire('bl', [[cx + 30, cy],[cx + 180, cy]], col.wireHi);
    b.drawNode('bl-l', cx + 190, cy, 'BIT LINE', col.wireHi);
    // Capacitor to ground below
    b.drawCapacitor('cap', cx - 30, cy + 30, 60, 50, 'v', 'charge = bit');
    b.drawWire('cap-in', [[cx, cy + 25],[cx, cy + 30]], col.wireHi);
    b.drawWire('cap-out', [[cx, cy + 86],[cx, cy + 110]], col.wireLo);
    b.drawGround('gnd', cx, cy + 120);
    // Count label
    b.drawNode('count', cx, cy + 170, '1 transistor + 1 capacitor per cell', col.accent);
  }

  // Grid of cells with row decoder on the left, column decoder on the bottom.
  function _drawMemoryGrid(b, opts) {
    opts = opts || {};
    const col = C();
    const rows = opts.rows || 12;
    const cols = opts.cols || 16;
    const cellSz = opts.cellSz || 20;
    const gap = opts.gap || 1;
    const x0 = opts.x || 320;
    const y0 = opts.y || 160;
    const activeRow = opts.activeRow;
    const activeCol = opts.activeCol;

    b.drawCustom('grid', (g, NS, COL) => {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const rect = document.createElementNS(NS, 'rect');
          rect.setAttribute('x', x0 + c * (cellSz + gap));
          rect.setAttribute('y', y0 + r * (cellSz + gap));
          rect.setAttribute('width', cellSz);
          rect.setAttribute('height', cellSz);
          const selected = (r === activeRow && c === activeCol);
          const inRow = (r === activeRow);
          const inCol = (c === activeCol);
          if (selected) {
            rect.setAttribute('fill', COL.edgeRise);
          } else if (inRow || inCol) {
            rect.setAttribute('fill', COL.edgeRise);
            rect.setAttribute('opacity', '0.25');
          } else {
            rect.setAttribute('fill', COL.panel);
          }
          rect.setAttribute('stroke', COL.gateEdge);
          rect.setAttribute('stroke-width', '0.8');
          g.appendChild(rect);
        }
      }
    });

    // Row decoder strip on the left
    const decW = 100;
    b.drawBox('rowdec', x0 - decW - 20, y0, decW, rows * (cellSz + gap),
      'row\ndecoder', col.accent);
    // Column decoder strip on the bottom
    b.drawBox('coldec', x0, y0 + rows * (cellSz + gap) + 20,
      cols * (cellSz + gap), 60, 'column decoder / MUX', col.accent);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Silent-film RAM read animation.
  //  Viewer on mute should follow the whole read cycle visually.  Every
  //  beat is a distinct on-screen event with a clear moment.  Narration
  //  is incidental — the animation carries the story.
  //
  //  Storyboard (elapsed ms since animation start):
  //     0 –  1500    initial dark state
  //  1500 –  3500    address bits arrive one by one on the input pins
  //  3500 –  5000    address splits — upper bits → row decoder side,
  //                                    lower bits → column decoder side
  //  5000 –  7000    row decoder fires — exactly one output lights up
  //  7000 –  9500    word line spreads rightward across the cell grid,
  //                  lighting each cell in the selected row as it passes
  //  9500 – 12000    every cell on the active row dumps its bit — a small
  //                  pulse drops down each column onto its bit line
  // 12000 – 13500    sense amplifiers at the bottom light up
  // 13500 – 15500    column decoder fires, one column output lights up
  // 15500 – 17500    MUX narrows — all sense-amp signals dim except the
  //                  one from the selected column
  // 17500 – 20000    data pulse travels along a wire from the MUX to DOUT
  // 20000 – 25000    DOUT displays the read value (hold + glow)
  // 25000 +          full scene holds so viewer can examine final state
  //
  //  opts.freezeAtMs — if set, animation is frozen at that time mark
  //  (used by the freeze-frame follow-up scenes).
  // ═══════════════════════════════════════════════════════════════════
  function _drawRAMReadSilentFilm(b, opts) {
    opts = opts || {};
    const COL = C();

    // ──── Layout constants (stage is 1000 x 620) ────
    const rows = 4, cols = 8;
    const cellW = 70, cellH = 38, cellGap = 6;
    const gridX = 220;
    const gridY = 230;
    const gridW = cols * (cellW + cellGap) - cellGap;
    const gridRightEdge = gridX + gridW;

    // Row decoder sits left of the grid.  Exactly `rows` outputs.
    const rowDecW = 80;
    const rowDecX = gridX - rowDecW - 20;

    // Sense-amp row sits just below the grid.
    const senseAmpY = gridY + rows * (cellH + cellGap) + 8;

    // Column-decoder strip below sense amps.
    const colDecY = senseAmpY + 40;

    // DOUT on the right of the stage.
    const doutX = 880;
    const doutY = 430;

    // Target address — row 2, col 5 (binary 10 101 = 0x15).
    const targetRow = 2, targetCol = 5;

    // Pseudo-random cell contents (seeded so the picture is stable).
    const cellValues = [];
    let seed = 42;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed; };
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) row.push(rnd() % 2);
      cellValues.push(row);
    }
    // Force the target cell to a specific value so the story has a conclusion.
    cellValues[targetRow][targetCol] = 1;
    const targetValue = cellValues[targetRow][targetCol];

    // 5-bit target address, MSB first.
    const targetAddr = (targetRow << 3) | targetCol;
    const addrBitValues = [];
    for (let i = 4; i >= 0; i--) addrBitValues.push((targetAddr >> i) & 1);

    // ──── References — populated during build, mutated by the animator ────
    const refs = {
      addrBits:      [],   // { rect, text, value }
      rowDecBoxes:   [],
      rowDecTexts:   [],
      cells:         [],   // 2D arrays of rects
      cellValueTexts:[],
      wordLine:      null,
      bitDrops:      [],   // per column — { circle, x, value, startY, endY }
      senseAmps:     [],
      colDecBoxes:   [],
      dataPulse:     null,
      doutValBox:    null,
      doutValText:   null,
      colLine:       null, // single highlight wire from sense-amp to DOUT
      rowSplitHint:  null, // "upper 2 → row" arrow
      colSplitHint:  null, // "lower 3 → col" arrow
      phaseLabel:    null,
    };

    b.drawCustom('ram-read-film', (g, NS, C2) => {
      // ────────── ADDRESS PINS (top) ──────────
      const addrGroupLbl = document.createElementNS(NS, 'text');
      addrGroupLbl.setAttribute('x', 120); addrGroupLbl.setAttribute('y', 135);
      addrGroupLbl.setAttribute('text-anchor', 'middle');
      addrGroupLbl.setAttribute('font-family', 'monospace');
      addrGroupLbl.setAttribute('font-size', '11');
      addrGroupLbl.setAttribute('font-weight', '700');
      addrGroupLbl.setAttribute('fill', C2.accent);
      addrGroupLbl.textContent = 'ADDRESS IN';
      g.appendChild(addrGroupLbl);
      const addrStartX = 40, addrY = 155, addrBitW = 32, addrBitGap = 4;
      addrBitValues.forEach((v, i) => {
        const x = addrStartX + i * (addrBitW + addrBitGap);
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', x); rect.setAttribute('y', addrY);
        rect.setAttribute('width', addrBitW); rect.setAttribute('height', 32);
        rect.setAttribute('rx', 3);
        rect.setAttribute('fill', C2.panel);
        rect.setAttribute('stroke', C2.dim);
        rect.setAttribute('stroke-width', '1.2');
        g.appendChild(rect);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x + addrBitW / 2); t.setAttribute('y', addrY + 22);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '18');
        t.setAttribute('font-weight', '700');
        t.setAttribute('fill', C2.dim);
        t.setAttribute('opacity', '0.35');
        t.textContent = v;
        g.appendChild(t);
        refs.addrBits.push({ rect, text: t, value: v, x: x + addrBitW / 2 });
      });

      // ────────── SPLIT HINTS (arrows) — hidden initially ──────────
      const rowHint = document.createElementNS(NS, 'text');
      rowHint.setAttribute('x', 60); rowHint.setAttribute('y', 220);
      rowHint.setAttribute('font-family', 'monospace');
      rowHint.setAttribute('font-size', '10');
      rowHint.setAttribute('fill', C2.edgeRise);
      rowHint.setAttribute('opacity', '0');
      rowHint.textContent = 'upper 2 bits → row';
      g.appendChild(rowHint);
      refs.rowSplitHint = rowHint;

      const colHint = document.createElementNS(NS, 'text');
      colHint.setAttribute('x', 140); colHint.setAttribute('y', 220);
      colHint.setAttribute('font-family', 'monospace');
      colHint.setAttribute('font-size', '10');
      colHint.setAttribute('fill', C2.edgeRise);
      colHint.setAttribute('opacity', '0');
      colHint.textContent = 'lower 3 bits → column';
      g.appendChild(colHint);
      refs.colSplitHint = colHint;

      // ────────── ROW DECODER ──────────
      const rowDecLabel = document.createElementNS(NS, 'text');
      rowDecLabel.setAttribute('x', rowDecX + rowDecW / 2);
      rowDecLabel.setAttribute('y', gridY - 14);
      rowDecLabel.setAttribute('text-anchor', 'middle');
      rowDecLabel.setAttribute('font-family', 'monospace');
      rowDecLabel.setAttribute('font-size', '11');
      rowDecLabel.setAttribute('font-weight', '700');
      rowDecLabel.setAttribute('fill', C2.accent);
      rowDecLabel.textContent = 'ROW DECODER';
      g.appendChild(rowDecLabel);
      for (let r = 0; r < rows; r++) {
        const y = gridY + r * (cellH + cellGap);
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', rowDecX); rect.setAttribute('y', y);
        rect.setAttribute('width', rowDecW); rect.setAttribute('height', cellH);
        rect.setAttribute('rx', 3);
        rect.setAttribute('fill', C2.panel);
        rect.setAttribute('stroke', C2.dim);
        g.appendChild(rect);
        refs.rowDecBoxes.push(rect);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', rowDecX + rowDecW / 2);
        t.setAttribute('y', y + cellH / 2 + 4);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '11');
        t.setAttribute('fill', C2.label);
        t.textContent = 'row ' + r;
        g.appendChild(t);
        refs.rowDecTexts.push(t);
      }

      // ────────── CELL GRID ──────────
      for (let r = 0; r < rows; r++) {
        refs.cells.push([]);
        refs.cellValueTexts.push([]);
        for (let c = 0; c < cols; c++) {
          const x = gridX + c * (cellW + cellGap);
          const y = gridY + r * (cellH + cellGap);
          const rect = document.createElementNS(NS, 'rect');
          rect.setAttribute('x', x); rect.setAttribute('y', y);
          rect.setAttribute('width', cellW); rect.setAttribute('height', cellH);
          rect.setAttribute('rx', 2);
          rect.setAttribute('fill', C2.panel);
          rect.setAttribute('stroke', C2.gateEdge);
          rect.setAttribute('stroke-width', '0.8');
          g.appendChild(rect);
          refs.cells[r].push(rect);
          const t = document.createElementNS(NS, 'text');
          t.setAttribute('x', x + cellW / 2); t.setAttribute('y', y + cellH / 2 + 5);
          t.setAttribute('text-anchor', 'middle');
          t.setAttribute('font-family', 'monospace');
          t.setAttribute('font-size', '15');
          t.setAttribute('font-weight', '700');
          t.setAttribute('fill', C2.dim);
          t.setAttribute('opacity', '0.25');
          t.textContent = cellValues[r][c];
          g.appendChild(t);
          refs.cellValueTexts[r].push(t);
        }
      }

      // ────────── WORD LINE (starts zero-length, grows during animation) ──────────
      const wlY = gridY + targetRow * (cellH + cellGap) + cellH / 2;
      const wl = document.createElementNS(NS, 'line');
      wl.setAttribute('x1', rowDecX + rowDecW);
      wl.setAttribute('y1', wlY);
      wl.setAttribute('x2', rowDecX + rowDecW);
      wl.setAttribute('y2', wlY);
      wl.setAttribute('stroke', C2.edgeRise);
      wl.setAttribute('stroke-width', '4');
      wl.setAttribute('opacity', '0');
      g.appendChild(wl);
      refs.wordLine = wl;

      // ────────── BIT-DROP PULSES (one per column, hidden initially) ──────────
      for (let c = 0; c < cols; c++) {
        const cx = gridX + c * (cellW + cellGap) + cellW / 2;
        const circle = document.createElementNS(NS, 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', wlY);
        circle.setAttribute('r', 5);
        circle.setAttribute('fill', C2.edgeRise);
        circle.setAttribute('opacity', '0');
        g.appendChild(circle);
        refs.bitDrops.push({
          circle, x: cx,
          startY: wlY,
          endY:   senseAmpY + 18,
          value:  cellValues[targetRow][c],
        });
      }

      // ────────── SENSE AMP ROW ──────────
      const saLabel = document.createElementNS(NS, 'text');
      saLabel.setAttribute('x', gridX - 6);
      saLabel.setAttribute('y', senseAmpY + 15);
      saLabel.setAttribute('text-anchor', 'end');
      saLabel.setAttribute('font-family', 'monospace');
      saLabel.setAttribute('font-size', '10');
      saLabel.setAttribute('fill', C2.accent);
      saLabel.textContent = 'SENSE AMPS';
      g.appendChild(saLabel);
      for (let c = 0; c < cols; c++) {
        const cx = gridX + c * (cellW + cellGap) + cellW / 2;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d',
          `M ${cx - 14} ${senseAmpY} L ${cx + 14} ${senseAmpY} L ${cx} ${senseAmpY + 22} Z`);
        path.setAttribute('fill', C2.panel);
        path.setAttribute('stroke', C2.dim);
        path.setAttribute('stroke-width', '1.3');
        g.appendChild(path);
        refs.senseAmps.push(path);
      }

      // ────────── COLUMN DECODER ROW ──────────
      const cdLabel = document.createElementNS(NS, 'text');
      cdLabel.setAttribute('x', gridX - 6);
      cdLabel.setAttribute('y', colDecY + 22);
      cdLabel.setAttribute('text-anchor', 'end');
      cdLabel.setAttribute('font-family', 'monospace');
      cdLabel.setAttribute('font-size', '10');
      cdLabel.setAttribute('fill', C2.accent);
      cdLabel.textContent = 'COL DECODER';
      g.appendChild(cdLabel);
      for (let c = 0; c < cols; c++) {
        const x = gridX + c * (cellW + cellGap);
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', x); rect.setAttribute('y', colDecY);
        rect.setAttribute('width', cellW); rect.setAttribute('height', 30);
        rect.setAttribute('rx', 3);
        rect.setAttribute('fill', C2.panel);
        rect.setAttribute('stroke', C2.dim);
        g.appendChild(rect);
        refs.colDecBoxes.push(rect);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x + cellW / 2); t.setAttribute('y', colDecY + 20);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '10');
        t.setAttribute('fill', C2.label);
        t.textContent = 'col ' + c;
        g.appendChild(t);
      }

      // ────────── COL → DOUT WIRE (appears later) ──────────
      const colLine = document.createElementNS(NS, 'line');
      // Starts at the selected sense-amp's output, arcs rightward to DOUT.
      const fromX = gridX + targetCol * (cellW + cellGap) + cellW / 2;
      colLine.setAttribute('x1', fromX);
      colLine.setAttribute('y1', senseAmpY + 22);
      colLine.setAttribute('x2', fromX);
      colLine.setAttribute('y2', senseAmpY + 22);
      colLine.setAttribute('stroke', C2.edgeRise);
      colLine.setAttribute('stroke-width', '2.5');
      colLine.setAttribute('opacity', '0');
      g.appendChild(colLine);
      refs.colLine = colLine;

      // ────────── DATA PULSE (travels from MUX to DOUT) ──────────
      const dataPulse = document.createElementNS(NS, 'circle');
      dataPulse.setAttribute('cx', fromX);
      dataPulse.setAttribute('cy', senseAmpY + 22);
      dataPulse.setAttribute('r', 7);
      dataPulse.setAttribute('fill', C2.edgeRise);
      dataPulse.setAttribute('opacity', '0');
      g.appendChild(dataPulse);
      refs.dataPulse = dataPulse;

      // ────────── DOUT BOX ──────────
      const doutBox = document.createElementNS(NS, 'rect');
      doutBox.setAttribute('x', doutX); doutBox.setAttribute('y', doutY);
      doutBox.setAttribute('width', 80); doutBox.setAttribute('height', 60);
      doutBox.setAttribute('rx', 6);
      doutBox.setAttribute('fill', C2.panel);
      doutBox.setAttribute('stroke', C2.accent);
      doutBox.setAttribute('stroke-width', '1.5');
      g.appendChild(doutBox);
      refs.doutValBox = doutBox;
      const doutLbl = document.createElementNS(NS, 'text');
      doutLbl.setAttribute('x', doutX + 40); doutLbl.setAttribute('y', doutY + 16);
      doutLbl.setAttribute('text-anchor', 'middle');
      doutLbl.setAttribute('font-family', 'monospace');
      doutLbl.setAttribute('font-size', '10');
      doutLbl.setAttribute('fill', C2.accent);
      doutLbl.textContent = 'DOUT';
      g.appendChild(doutLbl);
      const doutVal = document.createElementNS(NS, 'text');
      doutVal.setAttribute('x', doutX + 40); doutVal.setAttribute('y', doutY + 48);
      doutVal.setAttribute('text-anchor', 'middle');
      doutVal.setAttribute('font-family', 'monospace');
      doutVal.setAttribute('font-size', '28');
      doutVal.setAttribute('font-weight', '700');
      doutVal.setAttribute('fill', C2.dim);
      doutVal.setAttribute('opacity', '0.3');
      doutVal.textContent = '?';
      g.appendChild(doutVal);
      refs.doutValText = doutVal;

      // ────────── PHASE LABEL (subtle caption at bottom of stage) ──────────
      const phaseLbl = document.createElementNS(NS, 'text');
      phaseLbl.setAttribute('x', 500); phaseLbl.setAttribute('y', 580);
      phaseLbl.setAttribute('text-anchor', 'middle');
      phaseLbl.setAttribute('font-family', 'monospace');
      phaseLbl.setAttribute('font-size', '14');
      phaseLbl.setAttribute('font-weight', '700');
      phaseLbl.setAttribute('fill', C2.edgeRise);
      phaseLbl.setAttribute('opacity', '0');
      phaseLbl.textContent = '';
      g.appendChild(phaseLbl);
      refs.phaseLabel = phaseLbl;
    });

    // ────────── THE ORCHESTRATION ──────────
    b.animate('ram-read-film', (tMs) => {
      const T = (opts.freezeAtMs !== undefined) ? opts.freezeAtMs : tMs;

      // Helper to smoothly ramp a value from 0→1 across a time window.
      const ramp = (t0, t1) => {
        if (T < t0) return 0;
        if (T > t1) return 1;
        return (T - t0) / (t1 - t0);
      };
      const setPhase = (label) => {
        refs.phaseLabel.textContent = label;
        refs.phaseLabel.setAttribute('opacity', label ? '0.9' : '0');
      };

      // Phase 0: all dark (t < 1500).
      if (T < 1500) {
        setPhase('');
      }

      // Phase 1: address bits light up (1500–3500) — progressive.
      else if (T < 3500) {
        setPhase('address arrives');
        const p = (T - 1500) / 2000;
        refs.addrBits.forEach((ab, i) => {
          const localP = Math.max(0, p * 5 - i);
          const alive = localP > 0.3;
          ab.rect.setAttribute('stroke', alive ? COL.edgeRise : COL.dim);
          ab.text.setAttribute('fill',   alive ? (ab.value ? COL.edgeRise : COL.accent) : COL.dim);
          ab.text.setAttribute('opacity', alive ? '1' : '0.35');
        });
      }

      // Phase 2: address splits (3500–5000).
      else if (T < 5000) {
        setPhase('address splits → row bits up, column bits down');
        // Upper 2 bits (indices 0,1) highlighted cyan, lower 3 bits (2,3,4) highlighted orange
        refs.addrBits.forEach((ab, i) => {
          const col = i < 2 ? '#00ddff' : '#ffaa33';
          ab.rect.setAttribute('stroke', col);
          ab.text.setAttribute('fill',   col);
          ab.text.setAttribute('opacity', '1');
        });
        refs.rowSplitHint.setAttribute('opacity', ramp(3500, 4500).toFixed(2));
        refs.colSplitHint.setAttribute('opacity', ramp(4000, 5000).toFixed(2));
      }

      // Phase 3: row decoder fires (5000–7000).
      else if (T < 7000) {
        setPhase('row decoder activates the selected row');
        refs.rowDecBoxes.forEach((box, r) => {
          if (r === targetRow) {
            box.setAttribute('fill', COL.edgeRise);
            box.setAttribute('opacity', '0.9');
            box.setAttribute('stroke', COL.edgeRise);
            refs.rowDecTexts[r].setAttribute('fill', '#000');
            refs.rowDecTexts[r].setAttribute('font-weight', '700');
          } else {
            box.setAttribute('fill', COL.panel);
            box.setAttribute('opacity', '1');
            box.setAttribute('stroke', COL.dim);
          }
        });
        refs.rowSplitHint.setAttribute('opacity', '1');
        refs.colSplitHint.setAttribute('opacity', '1');
      }

      // Phase 4: word line spreads right across the grid (7000–9500).
      else if (T < 9500) {
        setPhase('word line spreads across the row');
        const p = (T - 7000) / 2500;
        const startX = rowDecX + rowDecW;
        const endX   = gridX + gridW;
        const nowX = startX + (endX - startX) * p;
        refs.wordLine.setAttribute('x2', nowX);
        refs.wordLine.setAttribute('opacity', '1');
        // Light up cells on the target row as the word line passes each.
        for (let c = 0; c < cols; c++) {
          const cellCx = gridX + c * (cellW + cellGap);
          const reached = nowX >= cellCx;
          if (reached) {
            refs.cells[targetRow][c].setAttribute('fill', COL.edgeRise);
            refs.cells[targetRow][c].setAttribute('opacity', '0.3');
            refs.cellValueTexts[targetRow][c].setAttribute('opacity', '1');
            refs.cellValueTexts[targetRow][c].setAttribute('fill',
              cellValues[targetRow][c] ? COL.edgeRise : COL.accent);
          }
        }
      }

      // Phase 5: cells dump (9500–12000) — one pulse drops per column.
      else if (T < 12000) {
        setPhase('every cell dumps its bit — parallel read down the bit lines');
        refs.wordLine.setAttribute('x2', gridX + gridW);
        refs.wordLine.setAttribute('opacity', '1');
        const p = (T - 9500) / 2500;
        refs.bitDrops.forEach((drop, c) => {
          const cellCx = gridX + c * (cellW + cellGap) + cellW / 2;
          const y = drop.startY + (drop.endY - drop.startY) * p;
          drop.circle.setAttribute('cx', cellCx);
          drop.circle.setAttribute('cy', y);
          drop.circle.setAttribute('opacity', p < 1 ? '1' : '0.8');
          drop.circle.setAttribute('fill', drop.value ? COL.edgeRise : COL.accent);
        });
      }

      // Phase 6: sense amps light up (12000–13500).
      else if (T < 13500) {
        setPhase('sense amplifiers boost the faint signals');
        // Cell row stays lit
        for (let c = 0; c < cols; c++) {
          refs.cells[targetRow][c].setAttribute('fill', COL.edgeRise);
          refs.cells[targetRow][c].setAttribute('opacity', '0.3');
        }
        // Sense amps fill with bright colour
        refs.senseAmps.forEach((amp, c) => {
          amp.setAttribute('fill', cellValues[targetRow][c] ? COL.edgeRise : COL.accent);
          amp.setAttribute('opacity', '0.8');
          amp.setAttribute('stroke', COL.edgeRise);
        });
        // Bit drops vanish (they've been absorbed)
        refs.bitDrops.forEach(d => d.circle.setAttribute('opacity', '0'));
      }

      // Phase 7: column decoder fires (13500–15500).
      else if (T < 15500) {
        setPhase('column decoder picks ONE column');
        refs.senseAmps.forEach((amp, c) => {
          amp.setAttribute('fill', cellValues[targetRow][c] ? COL.edgeRise : COL.accent);
          amp.setAttribute('opacity', '0.8');
        });
        refs.colDecBoxes.forEach((box, c) => {
          if (c === targetCol) {
            box.setAttribute('fill', COL.edgeRise);
            box.setAttribute('opacity', '0.9');
            box.setAttribute('stroke', COL.edgeRise);
          } else {
            box.setAttribute('fill', COL.panel);
            box.setAttribute('opacity', '1');
            box.setAttribute('stroke', COL.dim);
          }
        });
      }

      // Phase 8: MUX narrows — non-selected sense amps dim (15500–17500).
      else if (T < 17500) {
        setPhase('only the selected column\u2019s bit makes it through');
        const p = (T - 15500) / 2000;
        refs.senseAmps.forEach((amp, c) => {
          if (c === targetCol) {
            amp.setAttribute('opacity', '1');
            amp.setAttribute('fill', targetValue ? COL.edgeRise : COL.accent);
          } else {
            amp.setAttribute('opacity', (0.8 * (1 - p)).toFixed(2));
          }
        });
        // Col decoder selected box stays lit
        refs.colDecBoxes.forEach((box, c) => {
          if (c !== targetCol) {
            box.setAttribute('fill', COL.panel);
            box.setAttribute('stroke', COL.dim);
          }
        });
      }

      // Phase 9: data pulse travels to DOUT (17500–20000).
      else if (T < 20000) {
        setPhase('data reaches the output pin');
        refs.senseAmps.forEach((amp, c) => {
          amp.setAttribute('opacity', c === targetCol ? '1' : '0');
        });
        const p = (T - 17500) / 2500;
        const fromX = gridX + targetCol * (cellW + cellGap) + cellW / 2;
        const fromY = senseAmpY + 22;
        const toX = doutX;
        const toY = doutY + 30;
        // Route: go down a bit, then right to DOUT. Two-segment path.
        const midY = 500;
        let px, py;
        if (p < 0.35) {
          // Down segment
          const q = p / 0.35;
          px = fromX;
          py = fromY + (midY - fromY) * q;
        } else {
          // Right segment
          const q = (p - 0.35) / 0.65;
          px = fromX + (toX - fromX) * q;
          py = midY + (toY - midY) * q;
        }
        refs.dataPulse.setAttribute('cx', px);
        refs.dataPulse.setAttribute('cy', py);
        refs.dataPulse.setAttribute('opacity', '1');
        refs.dataPulse.setAttribute('fill', targetValue ? COL.edgeRise : COL.accent);
        // Also extend the connecting wire to follow the pulse
        refs.colLine.setAttribute('x1', fromX);
        refs.colLine.setAttribute('y1', fromY);
        refs.colLine.setAttribute('x2', px);
        refs.colLine.setAttribute('y2', py);
        refs.colLine.setAttribute('opacity', '0.7');
      }

      // Phase 10: DOUT displays the value (20000+).
      else {
        setPhase('read complete — DOUT = ' + targetValue);
        // Keep the wire drawn
        const fromX = gridX + targetCol * (cellW + cellGap) + cellW / 2;
        const fromY = senseAmpY + 22;
        refs.colLine.setAttribute('x1', fromX);
        refs.colLine.setAttribute('y1', fromY);
        refs.colLine.setAttribute('x2', doutX);
        refs.colLine.setAttribute('y2', doutY + 30);
        refs.colLine.setAttribute('opacity', '0.7');
        refs.dataPulse.setAttribute('opacity', '0');
        refs.doutValText.textContent = String(targetValue);
        refs.doutValText.setAttribute('fill', COL.edgeRise);
        refs.doutValText.setAttribute('opacity', '1');
        refs.doutValBox.setAttribute('stroke', COL.edgeRise);
        refs.doutValBox.setAttribute('stroke-width', '3');
        // Non-selected sense amps stay dark
        refs.senseAmps.forEach((amp, c) => {
          amp.setAttribute('opacity', c === targetCol ? '1' : '0');
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Schematic primitives \u2014 proper electronic symbols.
  //  Each helper returns { drain, source, gate } wire-endpoint coords so
  //  the caller can route real wires between transistors.
  // ═══════════════════════════════════════════════════════════════════
  function _drawNMOS(g, NS, x, y, label, col) {
    // (x,y) = center of transistor.  Channel vertical, gate on LEFT.
    col = col || '#bbc';
    const chX = x, chTopY = y - 26, chBotY = y + 26;
    const gateX = x - 18, gateBarTop = y - 18, gateBarBot = y + 18;
    // Drain stub up
    const dStub = document.createElementNS(NS, 'line');
    dStub.setAttribute('x1', chX); dStub.setAttribute('y1', chTopY - 10);
    dStub.setAttribute('x2', chX); dStub.setAttribute('y2', chTopY);
    dStub.setAttribute('stroke', col); dStub.setAttribute('stroke-width', '1.5');
    g.appendChild(dStub);
    // Channel top segment
    const chTop = document.createElementNS(NS, 'line');
    chTop.setAttribute('x1', chX); chTop.setAttribute('y1', chTopY);
    chTop.setAttribute('x2', chX); chTop.setAttribute('y2', y - 4);
    chTop.setAttribute('stroke', col); chTop.setAttribute('stroke-width', '2');
    g.appendChild(chTop);
    // Channel bottom segment (small gap in middle)
    const chBot = document.createElementNS(NS, 'line');
    chBot.setAttribute('x1', chX); chBot.setAttribute('y1', y + 4);
    chBot.setAttribute('x2', chX); chBot.setAttribute('y2', chBotY);
    chBot.setAttribute('stroke', col); chBot.setAttribute('stroke-width', '2');
    g.appendChild(chBot);
    // Source stub down
    const sStub = document.createElementNS(NS, 'line');
    sStub.setAttribute('x1', chX); sStub.setAttribute('y1', chBotY);
    sStub.setAttribute('x2', chX); sStub.setAttribute('y2', chBotY + 10);
    sStub.setAttribute('stroke', col); sStub.setAttribute('stroke-width', '1.5');
    g.appendChild(sStub);
    // Gate bar (vertical, not touching channel)
    const gBar = document.createElementNS(NS, 'line');
    gBar.setAttribute('x1', gateX + 4); gBar.setAttribute('y1', gateBarTop);
    gBar.setAttribute('x2', gateX + 4); gBar.setAttribute('y2', gateBarBot);
    gBar.setAttribute('stroke', col); gBar.setAttribute('stroke-width', '2');
    g.appendChild(gBar);
    // Gate wire to the left
    const gW = document.createElementNS(NS, 'line');
    gW.setAttribute('x1', gateX - 8); gW.setAttribute('y1', y);
    gW.setAttribute('x2', gateX + 4); gW.setAttribute('y2', y);
    gW.setAttribute('stroke', col); gW.setAttribute('stroke-width', '1.5');
    g.appendChild(gW);
    // Arrow on source (NMOS: points TOWARD channel/right-in)
    const arr = document.createElementNS(NS, 'path');
    arr.setAttribute('d',
      `M ${chX - 7} ${y + 12} L ${chX} ${y + 9} L ${chX - 7} ${y + 6} Z`);
    arr.setAttribute('fill', col);
    g.appendChild(arr);
    // Label (e.g. "N5")
    if (label) {
      const lbl = document.createElementNS(NS, 'text');
      lbl.setAttribute('x', chX + 12); lbl.setAttribute('y', y + 4);
      lbl.setAttribute('font-family', 'monospace');
      lbl.setAttribute('font-size', '11'); lbl.setAttribute('font-style', 'italic');
      lbl.setAttribute('fill', col);
      lbl.textContent = label;
      g.appendChild(lbl);
    }
    return {
      drain:  { x: chX, y: chTopY - 10 },
      source: { x: chX, y: chBotY + 10 },
      gate:   { x: gateX - 8, y: y },
      channelEls: [chTop, chBot],
    };
  }

  function _drawPMOS(g, NS, x, y, label, col) {
    // Same geometry as NMOS but with a BUBBLE on the gate side and arrow OUT.
    col = col || '#fdb';
    const chX = x, chTopY = y - 26, chBotY = y + 26;
    const gateX = x - 18, gateBarTop = y - 18, gateBarBot = y + 18;
    // Drain stub up
    const dStub = document.createElementNS(NS, 'line');
    dStub.setAttribute('x1', chX); dStub.setAttribute('y1', chTopY - 10);
    dStub.setAttribute('x2', chX); dStub.setAttribute('y2', chTopY);
    dStub.setAttribute('stroke', col); dStub.setAttribute('stroke-width', '1.5');
    g.appendChild(dStub);
    // Channel top
    const chTop = document.createElementNS(NS, 'line');
    chTop.setAttribute('x1', chX); chTop.setAttribute('y1', chTopY);
    chTop.setAttribute('x2', chX); chTop.setAttribute('y2', y - 4);
    chTop.setAttribute('stroke', col); chTop.setAttribute('stroke-width', '2');
    g.appendChild(chTop);
    // Channel bottom
    const chBot = document.createElementNS(NS, 'line');
    chBot.setAttribute('x1', chX); chBot.setAttribute('y1', y + 4);
    chBot.setAttribute('x2', chX); chBot.setAttribute('y2', chBotY);
    chBot.setAttribute('stroke', col); chBot.setAttribute('stroke-width', '2');
    g.appendChild(chBot);
    // Source stub down
    const sStub = document.createElementNS(NS, 'line');
    sStub.setAttribute('x1', chX); sStub.setAttribute('y1', chBotY);
    sStub.setAttribute('x2', chX); sStub.setAttribute('y2', chBotY + 10);
    sStub.setAttribute('stroke', col); sStub.setAttribute('stroke-width', '1.5');
    g.appendChild(sStub);
    // Gate bar
    const gBar = document.createElementNS(NS, 'line');
    gBar.setAttribute('x1', gateX + 4); gBar.setAttribute('y1', gateBarTop);
    gBar.setAttribute('x2', gateX + 4); gBar.setAttribute('y2', gateBarBot);
    gBar.setAttribute('stroke', col); gBar.setAttribute('stroke-width', '2');
    g.appendChild(gBar);
    // Bubble on gate (indicates PMOS)
    const bub = document.createElementNS(NS, 'circle');
    bub.setAttribute('cx', gateX - 4); bub.setAttribute('cy', y);
    bub.setAttribute('r', 4);
    bub.setAttribute('fill', 'none'); bub.setAttribute('stroke', col);
    bub.setAttribute('stroke-width', '1.5');
    g.appendChild(bub);
    // Gate wire
    const gW = document.createElementNS(NS, 'line');
    gW.setAttribute('x1', gateX - 14); gW.setAttribute('y1', y);
    gW.setAttribute('x2', gateX - 8); gW.setAttribute('y2', y);
    gW.setAttribute('stroke', col); gW.setAttribute('stroke-width', '1.5');
    g.appendChild(gW);
    // Arrow on source (PMOS: points OUTWARD, source to channel)
    const arr = document.createElementNS(NS, 'path');
    arr.setAttribute('d',
      `M ${chX} ${y + 12} L ${chX - 7} ${y + 9} L ${chX} ${y + 6} Z`);
    arr.setAttribute('fill', col);
    g.appendChild(arr);
    // Label
    if (label) {
      const lbl = document.createElementNS(NS, 'text');
      lbl.setAttribute('x', chX + 12); lbl.setAttribute('y', y + 4);
      lbl.setAttribute('font-family', 'monospace');
      lbl.setAttribute('font-size', '11'); lbl.setAttribute('font-style', 'italic');
      lbl.setAttribute('fill', col);
      lbl.textContent = label;
      g.appendChild(lbl);
    }
    return {
      drain:  { x: chX, y: chTopY - 10 },
      source: { x: chX, y: chBotY + 10 },
      gate:   { x: gateX - 14, y: y },
      channelEls: [chTop, chBot],
    };
  }

  // Solid node dot (wire connection).
  function _drawNodeDot(g, NS, x, y, col) {
    const d = document.createElementNS(NS, 'circle');
    d.setAttribute('cx', x); d.setAttribute('cy', y);
    d.setAttribute('r', 3.5);
    d.setAttribute('fill', col || '#bbc');
    g.appendChild(d);
    return d;
  }

  // Standard capacitor symbol (two parallel plates).
  function _drawCapSymbol(g, NS, x, y, col) {
    col = col || '#bbc';
    const top = document.createElementNS(NS, 'line');
    top.setAttribute('x1', x - 14); top.setAttribute('y1', y);
    top.setAttribute('x2', x + 14); top.setAttribute('y2', y);
    top.setAttribute('stroke', col); top.setAttribute('stroke-width', '2.5');
    g.appendChild(top);
    const bot = document.createElementNS(NS, 'line');
    bot.setAttribute('x1', x - 14); bot.setAttribute('y1', y + 7);
    bot.setAttribute('x2', x + 14); bot.setAttribute('y2', y + 7);
    bot.setAttribute('stroke', col); bot.setAttribute('stroke-width', '2.5');
    g.appendChild(bot);
    return { topPlate: top, botPlate: bot,
             top: { x, y }, bot: { x, y: y + 7 } };
  }

  // Ground symbol.
  function _drawGndSymbol(g, NS, x, y, col) {
    col = col || '#bbc';
    const stub = document.createElementNS(NS, 'line');
    stub.setAttribute('x1', x); stub.setAttribute('y1', y);
    stub.setAttribute('x2', x); stub.setAttribute('y2', y + 6);
    stub.setAttribute('stroke', col); stub.setAttribute('stroke-width', '1.5');
    g.appendChild(stub);
    const l1 = document.createElementNS(NS, 'line');
    l1.setAttribute('x1', x - 12); l1.setAttribute('y1', y + 6);
    l1.setAttribute('x2', x + 12); l1.setAttribute('y2', y + 6);
    l1.setAttribute('stroke', col); l1.setAttribute('stroke-width', '2');
    g.appendChild(l1);
    const l2 = document.createElementNS(NS, 'line');
    l2.setAttribute('x1', x - 8); l2.setAttribute('y1', y + 10);
    l2.setAttribute('x2', x + 8); l2.setAttribute('y2', y + 10);
    l2.setAttribute('stroke', col); l2.setAttribute('stroke-width', '1.5');
    g.appendChild(l2);
    const l3 = document.createElementNS(NS, 'line');
    l3.setAttribute('x1', x - 4); l3.setAttribute('y1', y + 14);
    l3.setAttribute('x2', x + 4); l3.setAttribute('y2', y + 14);
    l3.setAttribute('stroke', col); l3.setAttribute('stroke-width', '1.5');
    g.appendChild(l3);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PROPER SCHEMATIC: 6T SRAM cell.
  //  M1,M2 = PMOS pull-ups.  M3,M4 = NMOS pull-downs.
  //  M1+M3 and M2+M4 form cross-coupled inverters.
  //  M5,M6 = NMOS access transistors gated by WL.
  //  Nodes Q and Q\u0304 are the two storage nodes, tied via cross-couple.
  // ═══════════════════════════════════════════════════════════════════
  function _drawSRAMSchematic(b) {
    const COL = C();
    const vddY = 170, gndY = 470;
    const cxL = 380, cxR = 620;     // inverter column x-coords
    const qY  = 290, qbY = 290;     // the shared Q / Q\u0304 horizontal rail
    const p1Y = 215, p2Y = 215;     // PMOS center y
    const n3Y = 365, n4Y = 365;     // NMOS pull-down center y
    const wlY = 410;                 // word line horizontal
    const accessY = 340;             // access transistor center y
    const blX = 180, blbX = 820;    // bit line x positions

    const refs = {
      p1: null, p2: null, n3: null, n4: null, n5: null, n6: null,
      qText: null, qbText: null, qDot: null, qbDot: null,
      wlLine: null, wlVolt: null,
      blLine: null, blbLine: null,
      blVolt: null, blbVolt: null,
      phase: null,
    };

    b.drawCustom('sram-6t-schem', (g, NS, C2) => {
      // Background
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', 60); bg.setAttribute('y', 130);
      bg.setAttribute('width', 880); bg.setAttribute('height', 420);
      bg.setAttribute('rx', 8); bg.setAttribute('fill', '#0a0f18');
      bg.setAttribute('stroke', '#1a2230'); bg.setAttribute('stroke-width', '1.2');
      g.appendChild(bg);

      // ─── VDD rail ───
      const vdd = document.createElementNS(NS, 'line');
      vdd.setAttribute('x1', 260); vdd.setAttribute('y1', vddY);
      vdd.setAttribute('x2', 740); vdd.setAttribute('y2', vddY);
      vdd.setAttribute('stroke', '#ffbb33'); vdd.setAttribute('stroke-width', '2.5');
      g.appendChild(vdd);
      const vddLbl = document.createElementNS(NS, 'text');
      vddLbl.setAttribute('x', 250); vddLbl.setAttribute('y', vddY + 5);
      vddLbl.setAttribute('text-anchor', 'end');
      vddLbl.setAttribute('font-family', 'monospace');
      vddLbl.setAttribute('font-size', '13'); vddLbl.setAttribute('font-weight', '700');
      vddLbl.setAttribute('fill', '#ffbb33');
      vddLbl.textContent = 'VDD';
      g.appendChild(vddLbl);

      // ─── GND rail ───
      const gnd = document.createElementNS(NS, 'line');
      gnd.setAttribute('x1', 260); gnd.setAttribute('y1', gndY);
      gnd.setAttribute('x2', 740); gnd.setAttribute('y2', gndY);
      gnd.setAttribute('stroke', '#889'); gnd.setAttribute('stroke-width', '2.5');
      g.appendChild(gnd);
      const gndLbl = document.createElementNS(NS, 'text');
      gndLbl.setAttribute('x', 250); gndLbl.setAttribute('y', gndY + 5);
      gndLbl.setAttribute('text-anchor', 'end');
      gndLbl.setAttribute('font-family', 'monospace');
      gndLbl.setAttribute('font-size', '13'); gndLbl.setAttribute('font-weight', '700');
      gndLbl.setAttribute('fill', '#889');
      gndLbl.textContent = 'GND (VSS)';
      g.appendChild(gndLbl);

      // ─── Transistors ───
      refs.p1 = _drawPMOS(g, NS, cxL, p1Y, 'M1 (P)');
      refs.p2 = _drawPMOS(g, NS, cxR, p2Y, 'M2 (P)');
      refs.n3 = _drawNMOS(g, NS, cxL, n3Y, 'M3 (N)');
      refs.n4 = _drawNMOS(g, NS, cxR, n4Y, 'M4 (N)');

      // Access transistors — drawn SIDEWAYS (gate on BOTTOM from WL, channel horizontal)
      // Rather than rotating, I'll draw them vertically and route WL up from the word line.
      refs.n5 = _drawNMOS(g, NS, 260, accessY, 'M5 (N)');
      refs.n6 = _drawNMOS(g, NS, 740, accessY, 'M6 (N)');

      // ─── Connect P1 drain to VDD ───
      const p1v = document.createElementNS(NS, 'line');
      p1v.setAttribute('x1', cxL); p1v.setAttribute('y1', vddY);
      p1v.setAttribute('x2', cxL); p1v.setAttribute('y2', refs.p1.drain.y);
      p1v.setAttribute('stroke', '#ffbb33'); p1v.setAttribute('stroke-width', '1.5');
      g.appendChild(p1v);
      _drawNodeDot(g, NS, cxL, vddY, '#ffbb33');
      const p2v = document.createElementNS(NS, 'line');
      p2v.setAttribute('x1', cxR); p2v.setAttribute('y1', vddY);
      p2v.setAttribute('x2', cxR); p2v.setAttribute('y2', refs.p2.drain.y);
      p2v.setAttribute('stroke', '#ffbb33'); p2v.setAttribute('stroke-width', '1.5');
      g.appendChild(p2v);
      _drawNodeDot(g, NS, cxR, vddY, '#ffbb33');

      // ─── N3/N4 source to GND ───
      const n3g = document.createElementNS(NS, 'line');
      n3g.setAttribute('x1', cxL); n3g.setAttribute('y1', refs.n3.source.y);
      n3g.setAttribute('x2', cxL); n3g.setAttribute('y2', gndY);
      n3g.setAttribute('stroke', '#889'); n3g.setAttribute('stroke-width', '1.5');
      g.appendChild(n3g);
      _drawNodeDot(g, NS, cxL, gndY, '#889');
      const n4g = document.createElementNS(NS, 'line');
      n4g.setAttribute('x1', cxR); n4g.setAttribute('y1', refs.n4.source.y);
      n4g.setAttribute('x2', cxR); n4g.setAttribute('y2', gndY);
      n4g.setAttribute('stroke', '#889'); n4g.setAttribute('stroke-width', '1.5');
      g.appendChild(n4g);
      _drawNodeDot(g, NS, cxR, gndY, '#889');

      // ─── P1 source (bottom) and N3 drain (top) joined at Q node ───
      // P1 source is below P1 (bottom stub). N3 drain is above N3.
      const qNodeY = (refs.p1.source.y + refs.n3.drain.y) / 2;
      const qJoin = document.createElementNS(NS, 'line');
      qJoin.setAttribute('x1', cxL); qJoin.setAttribute('y1', refs.p1.source.y);
      qJoin.setAttribute('x2', cxL); qJoin.setAttribute('y2', refs.n3.drain.y);
      qJoin.setAttribute('stroke', '#ddd'); qJoin.setAttribute('stroke-width', '2');
      g.appendChild(qJoin);
      refs.qDot = _drawNodeDot(g, NS, cxL, qNodeY, '#fff');
      const qLbl = document.createElementNS(NS, 'text');
      qLbl.setAttribute('x', cxL + 14); qLbl.setAttribute('y', qNodeY + 4);
      qLbl.setAttribute('font-family', 'monospace');
      qLbl.setAttribute('font-size', '16'); qLbl.setAttribute('font-weight', '700');
      qLbl.setAttribute('fill', '#ddd');
      qLbl.textContent = 'Q';
      g.appendChild(qLbl);
      const qVal = document.createElementNS(NS, 'text');
      qVal.setAttribute('x', cxL - 14); qVal.setAttribute('y', qNodeY + 4);
      qVal.setAttribute('text-anchor', 'end');
      qVal.setAttribute('font-family', 'monospace');
      qVal.setAttribute('font-size', '15'); qVal.setAttribute('font-weight', '700');
      qVal.setAttribute('fill', '#889');
      qVal.textContent = '0 V';
      g.appendChild(qVal); refs.qText = qVal;

      // P2 source and N4 drain at Q\u0304 node
      const qbJoin = document.createElementNS(NS, 'line');
      qbJoin.setAttribute('x1', cxR); qbJoin.setAttribute('y1', refs.p2.source.y);
      qbJoin.setAttribute('x2', cxR); qbJoin.setAttribute('y2', refs.n4.drain.y);
      qbJoin.setAttribute('stroke', '#ddd'); qbJoin.setAttribute('stroke-width', '2');
      g.appendChild(qbJoin);
      refs.qbDot = _drawNodeDot(g, NS, cxR, qNodeY, '#fff');
      const qbLbl = document.createElementNS(NS, 'text');
      qbLbl.setAttribute('x', cxR - 14); qbLbl.setAttribute('y', qNodeY + 4);
      qbLbl.setAttribute('text-anchor', 'end');
      qbLbl.setAttribute('font-family', 'monospace');
      qbLbl.setAttribute('font-size', '16'); qbLbl.setAttribute('font-weight', '700');
      qbLbl.setAttribute('fill', '#ddd');
      qbLbl.textContent = 'Q\u0304';
      g.appendChild(qbLbl);
      const qbVal = document.createElementNS(NS, 'text');
      qbVal.setAttribute('x', cxR + 14); qbVal.setAttribute('y', qNodeY + 4);
      qbVal.setAttribute('font-family', 'monospace');
      qbVal.setAttribute('font-size', '15'); qbVal.setAttribute('font-weight', '700');
      qbVal.setAttribute('fill', '#889');
      qbVal.textContent = 'VDD';
      g.appendChild(qbVal); refs.qbText = qbVal;

      // ─── Cross-couple: Q node (cxL) → gates of P2, N4 ───
      // Q goes right, then routes down to gate of P2 (gateX = cxR-26) and N4 (gateX = cxR-26).
      // Similarly Q̄ → gates of P1, N3.
      const qToRightGate = document.createElementNS(NS, 'path');
      // From (cxL, qNodeY) up over the top (above VDD at y=vddY-18) then down on the right side
      // to reach P2's gate (at cxR - 32, p2Y) and continue down to N4's gate (at cxR - 32, n4Y)
      qToRightGate.setAttribute('d',
        `M ${cxL} ${qNodeY}
         L ${cxL - 40} ${qNodeY}
         L ${cxL - 40} ${vddY - 30}
         L ${cxR + 50} ${vddY - 30}
         L ${cxR + 50} ${p2Y}
         L ${refs.p2.gate.x} ${p2Y}
         M ${cxR + 50} ${p2Y}
         L ${cxR + 50} ${n4Y}
         L ${refs.n4.gate.x} ${n4Y}`);
      qToRightGate.setAttribute('fill', 'none');
      qToRightGate.setAttribute('stroke', '#66ccff');
      qToRightGate.setAttribute('stroke-width', '1.5');
      g.appendChild(qToRightGate);

      const qbToLeftGate = document.createElementNS(NS, 'path');
      qbToLeftGate.setAttribute('d',
        `M ${cxR} ${qNodeY}
         L ${cxR + 40} ${qNodeY}
         L ${cxR + 40} ${gndY + 30}
         L ${cxL - 50} ${gndY + 30}
         L ${cxL - 50} ${n3Y}
         L ${refs.n3.gate.x} ${n3Y}
         M ${cxL - 50} ${n3Y}
         L ${cxL - 50} ${p1Y}
         L ${refs.p1.gate.x} ${p1Y}`);
      qbToLeftGate.setAttribute('fill', 'none');
      qbToLeftGate.setAttribute('stroke', '#ff88bb');
      qbToLeftGate.setAttribute('stroke-width', '1.5');
      g.appendChild(qbToLeftGate);

      // ─── Access transistor M5: bit line (BL) \u2192 Q ───
      // M5 drain (top) connects to BL coming up, source (bottom) connects to Q
      // Actually N5 is drawn vertically at (260, accessY=340). Drain up, source down.
      // Route: BL horizontal line, drops vertically through N5, connects horizontally to Q
      const blL = document.createElementNS(NS, 'line');
      blL.setAttribute('x1', blX); blL.setAttribute('y1', 170);
      blL.setAttribute('x2', blX); blL.setAttribute('y2', 500);
      blL.setAttribute('stroke', '#aac'); blL.setAttribute('stroke-width', '2');
      g.appendChild(blL); refs.blLine = blL;
      // Drain of N5 to BL
      const n5dr = document.createElementNS(NS, 'path');
      n5dr.setAttribute('d',
        `M ${refs.n5.drain.x} ${refs.n5.drain.y}
         L ${refs.n5.drain.x} ${refs.n5.drain.y - 20}
         L ${blX} ${refs.n5.drain.y - 20}`);
      n5dr.setAttribute('fill', 'none');
      n5dr.setAttribute('stroke', '#aac'); n5dr.setAttribute('stroke-width', '1.5');
      g.appendChild(n5dr);
      _drawNodeDot(g, NS, blX, refs.n5.drain.y - 20, '#aac');
      // Source of N5 to Q node
      const n5s = document.createElementNS(NS, 'path');
      n5s.setAttribute('d',
        `M ${refs.n5.source.x} ${refs.n5.source.y}
         L ${refs.n5.source.x} ${refs.n5.source.y + 10}
         L ${cxL} ${refs.n5.source.y + 10}
         L ${cxL} ${qNodeY}`);
      n5s.setAttribute('fill', 'none');
      n5s.setAttribute('stroke', '#ddd'); n5s.setAttribute('stroke-width', '1.5');
      g.appendChild(n5s);
      // Mirror: N6 drain to BLB, source to Q\u0304
      const blbL = document.createElementNS(NS, 'line');
      blbL.setAttribute('x1', blbX); blbL.setAttribute('y1', 170);
      blbL.setAttribute('x2', blbX); blbL.setAttribute('y2', 500);
      blbL.setAttribute('stroke', '#aac'); blbL.setAttribute('stroke-width', '2');
      g.appendChild(blbL); refs.blbLine = blbL;
      const n6dr = document.createElementNS(NS, 'path');
      n6dr.setAttribute('d',
        `M ${refs.n6.drain.x} ${refs.n6.drain.y}
         L ${refs.n6.drain.x} ${refs.n6.drain.y - 20}
         L ${blbX} ${refs.n6.drain.y - 20}`);
      n6dr.setAttribute('fill', 'none');
      n6dr.setAttribute('stroke', '#aac'); n6dr.setAttribute('stroke-width', '1.5');
      g.appendChild(n6dr);
      _drawNodeDot(g, NS, blbX, refs.n6.drain.y - 20, '#aac');
      const n6s = document.createElementNS(NS, 'path');
      n6s.setAttribute('d',
        `M ${refs.n6.source.x} ${refs.n6.source.y}
         L ${refs.n6.source.x} ${refs.n6.source.y + 10}
         L ${cxR} ${refs.n6.source.y + 10}
         L ${cxR} ${qNodeY}`);
      n6s.setAttribute('fill', 'none');
      n6s.setAttribute('stroke', '#ddd'); n6s.setAttribute('stroke-width', '1.5');
      g.appendChild(n6s);

      // ─── WL horizontal line, connects to gates of N5 and N6 ───
      const wl = document.createElementNS(NS, 'line');
      wl.setAttribute('x1', 100); wl.setAttribute('y1', wlY);
      wl.setAttribute('x2', 900); wl.setAttribute('y2', wlY);
      wl.setAttribute('stroke', '#66ccff'); wl.setAttribute('stroke-width', '2.5');
      g.appendChild(wl); refs.wlLine = wl;
      // Branch up to N5 gate
      const wln5 = document.createElementNS(NS, 'path');
      wln5.setAttribute('d',
        `M ${refs.n5.gate.x} ${refs.n5.gate.y}
         L ${refs.n5.gate.x - 20} ${refs.n5.gate.y}
         L ${refs.n5.gate.x - 20} ${wlY}`);
      wln5.setAttribute('fill', 'none');
      wln5.setAttribute('stroke', '#66ccff'); wln5.setAttribute('stroke-width', '1.5');
      g.appendChild(wln5);
      _drawNodeDot(g, NS, refs.n5.gate.x - 20, wlY, '#66ccff');
      const wln6 = document.createElementNS(NS, 'path');
      wln6.setAttribute('d',
        `M ${refs.n6.gate.x} ${refs.n6.gate.y}
         L ${refs.n6.gate.x - 20} ${refs.n6.gate.y}
         L ${refs.n6.gate.x - 20} ${wlY}`);
      wln6.setAttribute('fill', 'none');
      wln6.setAttribute('stroke', '#66ccff'); wln6.setAttribute('stroke-width', '1.5');
      g.appendChild(wln6);
      _drawNodeDot(g, NS, refs.n6.gate.x - 20, wlY, '#66ccff');

      // WL label
      const wlLblT = document.createElementNS(NS, 'text');
      wlLblT.setAttribute('x', 95); wlLblT.setAttribute('y', wlY + 5);
      wlLblT.setAttribute('text-anchor', 'end');
      wlLblT.setAttribute('font-family', 'monospace');
      wlLblT.setAttribute('font-size', '13'); wlLblT.setAttribute('font-weight', '700');
      wlLblT.setAttribute('fill', '#66ccff');
      wlLblT.textContent = 'WL';
      g.appendChild(wlLblT);
      const wlV = document.createElementNS(NS, 'text');
      wlV.setAttribute('x', 95); wlV.setAttribute('y', wlY + 22);
      wlV.setAttribute('text-anchor', 'end');
      wlV.setAttribute('font-family', 'monospace');
      wlV.setAttribute('font-size', '12'); wlV.setAttribute('font-weight', '700');
      wlV.setAttribute('fill', '#889');
      wlV.textContent = '0 V';
      g.appendChild(wlV); refs.wlVolt = wlV;

      // BL / BLB labels
      const blLbl = document.createElementNS(NS, 'text');
      blLbl.setAttribute('x', blX); blLbl.setAttribute('y', 160);
      blLbl.setAttribute('text-anchor', 'middle');
      blLbl.setAttribute('font-family', 'monospace');
      blLbl.setAttribute('font-size', '13'); blLbl.setAttribute('font-weight', '700');
      blLbl.setAttribute('fill', '#aac');
      blLbl.textContent = 'BL';
      g.appendChild(blLbl);
      const blVt = document.createElementNS(NS, 'text');
      blVt.setAttribute('x', blX - 22); blVt.setAttribute('y', 180);
      blVt.setAttribute('text-anchor', 'end');
      blVt.setAttribute('font-family', 'monospace');
      blVt.setAttribute('font-size', '11'); blVt.setAttribute('font-weight', '700');
      blVt.setAttribute('fill', '#889');
      blVt.textContent = '';
      g.appendChild(blVt); refs.blVolt = blVt;
      const blbLbl = document.createElementNS(NS, 'text');
      blbLbl.setAttribute('x', blbX); blbLbl.setAttribute('y', 160);
      blbLbl.setAttribute('text-anchor', 'middle');
      blbLbl.setAttribute('font-family', 'monospace');
      blbLbl.setAttribute('font-size', '13'); blbLbl.setAttribute('font-weight', '700');
      blbLbl.setAttribute('fill', '#aac');
      blbLbl.textContent = 'BL\u0304';
      g.appendChild(blbLbl);
      const blbVt = document.createElementNS(NS, 'text');
      blbVt.setAttribute('x', blbX + 22); blbVt.setAttribute('y', 180);
      blbVt.setAttribute('font-family', 'monospace');
      blbVt.setAttribute('font-size', '11'); blbVt.setAttribute('font-weight', '700');
      blbVt.setAttribute('fill', '#889');
      blbVt.textContent = '';
      g.appendChild(blbVt); refs.blbVolt = blbVt;

      // Phase caption
      const phase = document.createElementNS(NS, 'text');
      phase.setAttribute('x', 500); phase.setAttribute('y', 580);
      phase.setAttribute('text-anchor', 'middle');
      phase.setAttribute('font-family', 'monospace');
      phase.setAttribute('font-size', '13'); phase.setAttribute('font-weight', '700');
      phase.setAttribute('fill', C2.edgeRise);
      g.appendChild(phase); refs.phase = phase;

      const title = document.createElementNS(NS, 'text');
      title.setAttribute('x', 500); title.setAttribute('y', 150);
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('font-family', 'monospace');
      title.setAttribute('font-size', '13'); title.setAttribute('font-style', 'italic');
      title.setAttribute('fill', C2.accent);
      title.textContent = '6T SRAM cell  \u2014  M1,M2: PMOS pull-ups  |  M3,M4: NMOS pull-downs  |  M5,M6: NMOS access';
      g.appendChild(title);
    });

    b.animate('sram-6t-schem', (tMs) => {
      const cycleMs = 12000;
      const T = tMs % cycleMs;
      // Q=0 means Q node at 0V, Qbar=VDD; Q=1 means Q at VDD, Qbar at 0V.
      let q, wlHigh, blDrv, blbDrv, phase;
      if (T < 2000)       { q = 0; wlHigh = false; blDrv = null; blbDrv = null; phase = 'hold Q=0  \u2014  M2+M3 conducting, cell latched'; }
      else if (T < 3000)  { q = 0; wlHigh = true;  blDrv = 1;    blbDrv = 0;    phase = 'WRITE: BL=VDD, BL\u0304=0V, WL rises \u2192 M5/M6 open'; }
      else if (T < 4500)  { q = 1; wlHigh = true;  blDrv = 1;    blbDrv = 0;    phase = 'latch flips  \u2192  Q=VDD, Q\u0304=0V'; }
      else if (T < 5500)  { q = 1; wlHigh = false; blDrv = null; blbDrv = null; phase = 'WL drops  \u2192  M5/M6 off, cell latched at Q=1'; }
      else if (T < 7500)  { q = 1; wlHigh = false; blDrv = null; blbDrv = null; phase = 'hold Q=1  \u2014  M1+M4 conducting'; }
      else if (T < 8500)  { q = 1; wlHigh = true;  blDrv = 0;    blbDrv = 1;    phase = 'WRITE: BL=0V, BL\u0304=VDD'; }
      else if (T < 10000) { q = 0; wlHigh = true;  blDrv = 0;    blbDrv = 1;    phase = 'latch flips back  \u2192  Q=0V'; }
      else                { q = 0; wlHigh = false; blDrv = null; blbDrv = null; phase = 'hold Q=0 (loop)'; }

      refs.phase.textContent = phase;

      // Q / Qbar voltages
      refs.qText.textContent  = q ? 'VDD' : '0 V';
      refs.qText.setAttribute('fill',  q ? '#ffbb33' : '#66ccff');
      refs.qbText.textContent = q ? '0 V' : 'VDD';
      refs.qbText.setAttribute('fill', q ? '#66ccff' : '#ffbb33');
      refs.qDot.setAttribute('fill',  q ? '#ffbb33' : '#66ccff');
      refs.qbDot.setAttribute('fill', q ? '#66ccff' : '#ffbb33');

      // WL
      refs.wlLine.setAttribute('stroke', wlHigh ? '#ffbb33' : '#66ccff');
      refs.wlLine.setAttribute('stroke-width', wlHigh ? '3.5' : '2');
      refs.wlVolt.textContent = wlHigh ? 'VDD (\u22481 V)' : '0 V';
      refs.wlVolt.setAttribute('fill', wlHigh ? '#ffbb33' : '#889');

      // Bit line drives
      const setBL = (line, txt, drv) => {
        if (drv === null) { line.setAttribute('stroke', '#aac'); txt.textContent = 'precharged'; txt.setAttribute('fill', '#889'); }
        else if (drv === 1) { line.setAttribute('stroke', '#ffbb33'); line.setAttribute('stroke-width', '3'); txt.textContent = 'VDD'; txt.setAttribute('fill', '#ffbb33'); }
        else { line.setAttribute('stroke', '#66ccff'); line.setAttribute('stroke-width', '3'); txt.textContent = '0 V'; txt.setAttribute('fill', '#66ccff'); }
      };
      setBL(refs.blLine,  refs.blVolt,  blDrv);
      setBL(refs.blbLine, refs.blbVolt, blbDrv);

      // Show conducting transistors by colouring their channels brighter
      // Q=0: M2 (PMOS right) pulls Qbar HIGH, M3 (NMOS left) pulls Q LOW.
      // Q=1: M1 (PMOS left) pulls Q HIGH, M4 (NMOS right) pulls Qbar LOW.
      const onCol = '#ffdd77', offCol = '#556';
      const p1On = (q === 1), p2On = (q === 0);
      const n3On = (q === 0), n4On = (q === 1);
      refs.p1.channelEls.forEach(e => { e.setAttribute('stroke', p1On ? onCol : '#fdb'); e.setAttribute('stroke-width', p1On ? '3' : '2'); });
      refs.p2.channelEls.forEach(e => { e.setAttribute('stroke', p2On ? onCol : '#fdb'); e.setAttribute('stroke-width', p2On ? '3' : '2'); });
      refs.n3.channelEls.forEach(e => { e.setAttribute('stroke', n3On ? onCol : '#bbc'); e.setAttribute('stroke-width', n3On ? '3' : '2'); });
      refs.n4.channelEls.forEach(e => { e.setAttribute('stroke', n4On ? onCol : '#bbc'); e.setAttribute('stroke-width', n4On ? '3' : '2'); });
      refs.n5.channelEls.forEach(e => { e.setAttribute('stroke', wlHigh ? onCol : '#bbc'); e.setAttribute('stroke-width', wlHigh ? '3' : '2'); });
      refs.n6.channelEls.forEach(e => { e.setAttribute('stroke', wlHigh ? onCol : '#bbc'); e.setAttribute('stroke-width', wlHigh ? '3' : '2'); });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PROPER SCHEMATIC: 1T1C DRAM cell with bit-line precharge.
  //  M1 = NMOS access transistor.  Cs = storage capacitor to VSS (or Vbb).
  //  Mpre = PMOS precharge transistor pulling BL to VDD/2 between reads.
  // ═══════════════════════════════════════════════════════════════════
  function _drawDRAMSchematic(b) {
    const COL = C();
    const blX = 500, tY = 290;
    const capY = 400;
    const vddPreY = 175, wlY = 450;
    const preX = 500;

    const refs = {
      m1: null, mpre: null,
      capFill: null, capVolt: null,
      blLine: null, blVolt: null,
      wlLine: null, wlVolt: null,
      preLine: null, preState: null,
      phase: null,
    };

    b.drawCustom('dram-1t1c-schem', (g, NS, C2) => {
      // Background
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', 60); bg.setAttribute('y', 130);
      bg.setAttribute('width', 880); bg.setAttribute('height', 420);
      bg.setAttribute('rx', 8); bg.setAttribute('fill', '#0a0f18');
      bg.setAttribute('stroke', '#1a2230'); bg.setAttribute('stroke-width', '1.2');
      g.appendChild(bg);

      // Title
      const title = document.createElementNS(NS, 'text');
      title.setAttribute('x', 500); title.setAttribute('y', 150);
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('font-family', 'monospace');
      title.setAttribute('font-size', '13'); title.setAttribute('font-style', 'italic');
      title.setAttribute('fill', C2.accent);
      title.textContent = '1T1C DRAM  \u2014  M1: NMOS access  |  Cs: storage capacitor  |  Mpre: PMOS precharge';
      g.appendChild(title);

      // VDD rail at top-left (for precharge)
      const vdd = document.createElementNS(NS, 'line');
      vdd.setAttribute('x1', 280); vdd.setAttribute('y1', vddPreY);
      vdd.setAttribute('x2', 520); vdd.setAttribute('y2', vddPreY);
      vdd.setAttribute('stroke', '#ffbb33'); vdd.setAttribute('stroke-width', '2.5');
      g.appendChild(vdd);
      const vddLbl = document.createElementNS(NS, 'text');
      vddLbl.setAttribute('x', 275); vddLbl.setAttribute('y', vddPreY + 5);
      vddLbl.setAttribute('text-anchor', 'end');
      vddLbl.setAttribute('font-family', 'monospace');
      vddLbl.setAttribute('font-size', '13'); vddLbl.setAttribute('font-weight', '700');
      vddLbl.setAttribute('fill', '#ffbb33');
      vddLbl.textContent = 'VDD';
      g.appendChild(vddLbl);

      // Precharge PMOS
      refs.mpre = _drawPMOS(g, NS, preX, 215, 'Mpre', '#fdb');
      // Connect Mpre drain (top) to VDD
      const mpv = document.createElementNS(NS, 'line');
      mpv.setAttribute('x1', preX); mpv.setAttribute('y1', vddPreY);
      mpv.setAttribute('x2', preX); mpv.setAttribute('y2', refs.mpre.drain.y);
      mpv.setAttribute('stroke', '#ffbb33'); mpv.setAttribute('stroke-width', '1.5');
      g.appendChild(mpv);
      _drawNodeDot(g, NS, preX, vddPreY, '#ffbb33');
      // Mpre gate (PRECHARGE signal)
      const preL = document.createElementNS(NS, 'line');
      preL.setAttribute('x1', 80); preL.setAttribute('y1', 215);
      preL.setAttribute('x2', refs.mpre.gate.x); preL.setAttribute('y2', 215);
      preL.setAttribute('stroke', '#aa88ff'); preL.setAttribute('stroke-width', '2');
      g.appendChild(preL); refs.preLine = preL;
      const preLbl = document.createElementNS(NS, 'text');
      preLbl.setAttribute('x', 95); preLbl.setAttribute('y', 210);
      preLbl.setAttribute('font-family', 'monospace');
      preLbl.setAttribute('font-size', '13'); preLbl.setAttribute('font-weight', '700');
      preLbl.setAttribute('fill', '#aa88ff');
      preLbl.textContent = 'PRE\u0304 (precharge)';
      g.appendChild(preLbl);
      const preS = document.createElementNS(NS, 'text');
      preS.setAttribute('x', 95); preS.setAttribute('y', 228);
      preS.setAttribute('font-family', 'monospace');
      preS.setAttribute('font-size', '11');
      preS.setAttribute('fill', '#889');
      preS.textContent = '0 V (active) \u2192 Mpre ON';
      g.appendChild(preS); refs.preState = preS;

      // BL (vertical wire): from Mpre source down through M1 drain on down
      const blL = document.createElementNS(NS, 'line');
      blL.setAttribute('x1', blX); blL.setAttribute('y1', refs.mpre.source.y);
      blL.setAttribute('x2', blX); blL.setAttribute('y2', tY - 10);
      blL.setAttribute('stroke', '#aac'); blL.setAttribute('stroke-width', '2');
      g.appendChild(blL); refs.blLine = blL;
      const blLbl = document.createElementNS(NS, 'text');
      blLbl.setAttribute('x', blX + 16); blLbl.setAttribute('y', 260);
      blLbl.setAttribute('font-family', 'monospace');
      blLbl.setAttribute('font-size', '13'); blLbl.setAttribute('font-weight', '700');
      blLbl.setAttribute('fill', '#aac');
      blLbl.textContent = 'BL';
      g.appendChild(blLbl);
      const blV = document.createElementNS(NS, 'text');
      blV.setAttribute('x', blX + 16); blV.setAttribute('y', 278);
      blV.setAttribute('font-family', 'monospace');
      blV.setAttribute('font-size', '11');
      blV.setAttribute('fill', '#889');
      blV.textContent = 'VDD/2';
      g.appendChild(blV); refs.blVolt = blV;

      // Access transistor M1 (NMOS) at center
      refs.m1 = _drawNMOS(g, NS, blX, tY, 'M1', '#bbc');
      // WL connects to M1 gate
      const wl = document.createElementNS(NS, 'line');
      wl.setAttribute('x1', 80); wl.setAttribute('y1', wlY);
      wl.setAttribute('x2', 920); wl.setAttribute('y2', wlY);
      wl.setAttribute('stroke', '#66ccff'); wl.setAttribute('stroke-width', '2.5');
      g.appendChild(wl); refs.wlLine = wl;
      const wlBranch = document.createElementNS(NS, 'path');
      wlBranch.setAttribute('d',
        `M ${refs.m1.gate.x} ${refs.m1.gate.y}
         L ${refs.m1.gate.x - 30} ${refs.m1.gate.y}
         L ${refs.m1.gate.x - 30} ${wlY}`);
      wlBranch.setAttribute('fill', 'none');
      wlBranch.setAttribute('stroke', '#66ccff'); wlBranch.setAttribute('stroke-width', '1.5');
      g.appendChild(wlBranch);
      _drawNodeDot(g, NS, refs.m1.gate.x - 30, wlY, '#66ccff');
      const wlLbl = document.createElementNS(NS, 'text');
      wlLbl.setAttribute('x', 95); wlLbl.setAttribute('y', wlY - 8);
      wlLbl.setAttribute('font-family', 'monospace');
      wlLbl.setAttribute('font-size', '13'); wlLbl.setAttribute('font-weight', '700');
      wlLbl.setAttribute('fill', '#66ccff');
      wlLbl.textContent = 'WL';
      g.appendChild(wlLbl);
      const wlV = document.createElementNS(NS, 'text');
      wlV.setAttribute('x', 95); wlV.setAttribute('y', wlY + 16);
      wlV.setAttribute('font-family', 'monospace');
      wlV.setAttribute('font-size', '12'); wlV.setAttribute('font-weight', '700');
      wlV.setAttribute('fill', '#889');
      wlV.textContent = '0 V';
      g.appendChild(wlV); refs.wlVolt = wlV;

      // Storage node — between M1 source and Cs top plate
      const sN = document.createElementNS(NS, 'line');
      sN.setAttribute('x1', blX); sN.setAttribute('y1', refs.m1.source.y);
      sN.setAttribute('x2', blX); sN.setAttribute('y2', capY - 6);
      sN.setAttribute('stroke', '#ddd'); sN.setAttribute('stroke-width', '2');
      g.appendChild(sN);
      const storNode = _drawNodeDot(g, NS, blX, (refs.m1.source.y + capY) / 2, '#fff');
      const snLbl = document.createElementNS(NS, 'text');
      snLbl.setAttribute('x', blX + 12); snLbl.setAttribute('y', (refs.m1.source.y + capY) / 2 + 4);
      snLbl.setAttribute('font-family', 'monospace');
      snLbl.setAttribute('font-size', '11'); snLbl.setAttribute('font-style', 'italic');
      snLbl.setAttribute('fill', '#ddd');
      snLbl.textContent = 'Vstore (storage node)';
      g.appendChild(snLbl);
      const snV = document.createElementNS(NS, 'text');
      snV.setAttribute('x', blX - 12); snV.setAttribute('y', (refs.m1.source.y + capY) / 2 + 4);
      snV.setAttribute('text-anchor', 'end');
      snV.setAttribute('font-family', 'monospace');
      snV.setAttribute('font-size', '12'); snV.setAttribute('font-weight', '700');
      snV.setAttribute('fill', '#889');
      snV.textContent = '0 V';
      g.appendChild(snV); refs.capVolt = snV;

      // Capacitor Cs (two plates)
      const cap = _drawCapSymbol(g, NS, blX, capY, '#bbc');
      // Fill indicator between plates shows charge level
      const fill = document.createElementNS(NS, 'rect');
      fill.setAttribute('x', blX - 13); fill.setAttribute('y', capY + 1);
      fill.setAttribute('width', 26); fill.setAttribute('height', 5);
      fill.setAttribute('fill', '#ffbb33');
      fill.setAttribute('opacity', '0');
      g.appendChild(fill); refs.capFill = fill;
      // Label
      const capLbl = document.createElementNS(NS, 'text');
      capLbl.setAttribute('x', blX + 22); capLbl.setAttribute('y', capY + 6);
      capLbl.setAttribute('font-family', 'monospace');
      capLbl.setAttribute('font-size', '12'); capLbl.setAttribute('font-weight', '700');
      capLbl.setAttribute('fill', '#bbc');
      capLbl.textContent = 'Cs';
      g.appendChild(capLbl);
      // Bottom plate to GND
      const cgnd = document.createElementNS(NS, 'line');
      cgnd.setAttribute('x1', blX); cgnd.setAttribute('y1', capY + 7);
      cgnd.setAttribute('x2', blX); cgnd.setAttribute('y2', capY + 28);
      cgnd.setAttribute('stroke', '#889'); cgnd.setAttribute('stroke-width', '1.5');
      g.appendChild(cgnd);
      _drawGndSymbol(g, NS, blX, capY + 28, '#889');

      // Phase caption
      const phase = document.createElementNS(NS, 'text');
      phase.setAttribute('x', 500); phase.setAttribute('y', 580);
      phase.setAttribute('text-anchor', 'middle');
      phase.setAttribute('font-family', 'monospace');
      phase.setAttribute('font-size', '13'); phase.setAttribute('font-weight', '700');
      phase.setAttribute('fill', C2.edgeRise);
      g.appendChild(phase); refs.phase = phase;
    });

    b.animate('dram-1t1c-schem', (tMs) => {
      const cycleMs = 16000;
      const T = tMs % cycleMs;
      let wlOn, preOn, capCharge, blV, snV, phase;

      if (T < 2000)       { preOn = true;  wlOn = false; capCharge = 0;    blV = 'VDD/2'; snV = '0 V';   phase = 'precharge: Mpre ON, BL held at VDD/2'; }
      else if (T < 3000)  { preOn = false; wlOn = false; capCharge = 0;    blV = 'VDD';   snV = '0 V';   phase = 'precharge OFF, BL driven to VDD (write \u201c1\u201d incoming)'; }
      else if (T < 4500)  { preOn = false; wlOn = true;  capCharge = (T-3000)/1500; blV = 'VDD'; snV = 'rising'; phase = 'WL rises: M1 ON, Cs charges from BL'; }
      else if (T < 5500)  { preOn = false; wlOn = false; capCharge = 1;    blV = '--';    snV = 'VDD';   phase = 'WL drops: M1 OFF, Cs holds \u201c1\u201d'; }
      else if (T < 10000) { preOn = false; wlOn = false; capCharge = 1 - (T-5500)*0.4/4500; blV = '--'; snV = 'leaking'; phase = 'leak: Cs slowly loses charge through junction'; }
      else if (T < 11000) { preOn = true;  wlOn = false; capCharge = 0.6;  blV = 'VDD/2'; snV = '~0.6V'; phase = 'refresh start: precharge BL to VDD/2'; }
      else if (T < 12500) { preOn = false; wlOn = true;  capCharge = 0.6;  blV = 'slight + tilt'; snV = '~0.6V'; phase = 'WL rises \u2192 Cs dumps onto BL (charge sharing)'; }
      else if (T < 14000) { preOn = false; wlOn = true;  capCharge = 1;    blV = 'VDD';   snV = 'VDD';   phase = 'sense amp latches \u201c1\u201d, drives BL=VDD \u2192 Cs refilled'; }
      else                { preOn = false; wlOn = false; capCharge = 1;    blV = '--';    snV = 'VDD';   phase = 'refresh done, cell holds \u201c1\u201d (loop)'; }

      refs.phase.textContent = phase;

      // WL visual
      refs.wlLine.setAttribute('stroke', wlOn ? '#ffbb33' : '#66ccff');
      refs.wlLine.setAttribute('stroke-width', wlOn ? '3.5' : '2.5');
      refs.wlVolt.textContent = wlOn ? 'VDD' : '0 V';
      refs.wlVolt.setAttribute('fill', wlOn ? '#ffbb33' : '#889');
      refs.m1.channelEls.forEach(e => {
        e.setAttribute('stroke', wlOn ? '#ffdd77' : '#bbc');
        e.setAttribute('stroke-width', wlOn ? '3' : '2');
      });

      // Precharge visual (PMOS: active LOW)
      refs.preLine.setAttribute('stroke', preOn ? '#66ccff' : '#aa88ff');
      refs.preState.textContent = preOn ? '0 V (active) \u2192 Mpre ON' : 'VDD (inactive) \u2192 Mpre OFF';
      refs.preState.setAttribute('fill', preOn ? '#66ccff' : '#889');
      refs.mpre.channelEls.forEach(e => {
        e.setAttribute('stroke', preOn ? '#ffdd77' : '#fdb');
        e.setAttribute('stroke-width', preOn ? '3' : '2');
      });

      // BL visual
      refs.blVolt.textContent = blV;
      refs.blVolt.setAttribute('fill', blV === '--' ? '#889' : (blV.startsWith('V') ? '#ffbb33' : '#66ccff'));

      // Cap charge fill
      refs.capFill.setAttribute('opacity', Math.max(0, Math.min(1, capCharge)).toFixed(2));
      refs.capFill.setAttribute('fill',
        capCharge > 0.7 ? '#ffbb33' : (capCharge > 0.35 ? '#ff9944' : '#ff5533'));
      refs.capVolt.textContent = snV;
      refs.capVolt.setAttribute('fill',
        snV === '0 V' || snV === '--' ? '#889'
        : snV.startsWith('VDD') ? '#ffbb33'
        : '#ff9944');
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PROPER SCHEMATIC: SRAM cell in its column context.
  //  Shows WL from ROW DECODER, BL/BL\u0304 with PRECHARGE PMOS pair at
  //  top, SENSE AMP below, column MUX (NMOS pass-gate) with CSEL from
  //  COLUMN DECODER, data bus at the bottom.  Every element an EE
  //  student would draw.
  // ═══════════════════════════════════════════════════════════════════
  function _drawSRAMColumn(b) {
    const COL = C();
    const vddY = 175, wlY = 330;
    const blX = 460, blbX = 620;
    const saTopY = 425, saBotY = 485;
    const muxY = 510;

    const refs = {
      wlLine: null, wlVolt: null,
      preLine: null, prePmosL: null, prePmosR: null,
      blLine: null, blbLine: null,
      saBox: null,
      muxN: null, cselLine: null,
      dbusLine: null,
      cellQ: null, cellQtext: null, cellQb: null, cellQbtext: null,
      phase: null,
    };

    b.drawCustom('sram-column', (g, NS, C2) => {
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', 60); bg.setAttribute('y', 130);
      bg.setAttribute('width', 880); bg.setAttribute('height', 420);
      bg.setAttribute('rx', 8); bg.setAttribute('fill', '#0a0f18');
      bg.setAttribute('stroke', '#1a2230'); bg.setAttribute('stroke-width', '1.2');
      g.appendChild(bg);

      const title = document.createElementNS(NS, 'text');
      title.setAttribute('x', 500); title.setAttribute('y', 150);
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('font-family', 'monospace');
      title.setAttribute('font-size', '12'); title.setAttribute('font-style', 'italic');
      title.setAttribute('fill', C2.accent);
      title.textContent = 'SRAM column  \u2014  PRECHARGE | CELL | SENSE AMP | COLUMN MUX | DATA BUS';
      g.appendChild(title);

      // ROW DECODER box on the left
      const rdX = 80, rdW = 110, rdH = 50, rdY = wlY - rdH / 2;
      const rdBox = document.createElementNS(NS, 'rect');
      rdBox.setAttribute('x', rdX); rdBox.setAttribute('y', rdY);
      rdBox.setAttribute('width', rdW); rdBox.setAttribute('height', rdH);
      rdBox.setAttribute('rx', 4);
      rdBox.setAttribute('fill', '#15192a'); rdBox.setAttribute('stroke', '#66ccff');
      rdBox.setAttribute('stroke-width', '2');
      g.appendChild(rdBox);
      const rdL1 = document.createElementNS(NS, 'text');
      rdL1.setAttribute('x', rdX + rdW / 2); rdL1.setAttribute('y', rdY + 20);
      rdL1.setAttribute('text-anchor', 'middle');
      rdL1.setAttribute('font-family', 'monospace');
      rdL1.setAttribute('font-size', '11'); rdL1.setAttribute('font-weight', '700');
      rdL1.setAttribute('fill', '#66ccff');
      rdL1.textContent = 'ROW DECODER';
      g.appendChild(rdL1);
      const rdL2 = document.createElementNS(NS, 'text');
      rdL2.setAttribute('x', rdX + rdW / 2); rdL2.setAttribute('y', rdY + 38);
      rdL2.setAttribute('text-anchor', 'middle');
      rdL2.setAttribute('font-family', 'monospace');
      rdL2.setAttribute('font-size', '10');
      rdL2.setAttribute('fill', '#889');
      rdL2.textContent = 'output row N';
      g.appendChild(rdL2);

      // WL
      const wl = document.createElementNS(NS, 'line');
      wl.setAttribute('x1', rdX + rdW); wl.setAttribute('y1', wlY);
      wl.setAttribute('x2', 700);       wl.setAttribute('y2', wlY);
      wl.setAttribute('stroke', '#66ccff'); wl.setAttribute('stroke-width', '2.5');
      g.appendChild(wl); refs.wlLine = wl;
      const wlLbl = document.createElementNS(NS, 'text');
      wlLbl.setAttribute('x', rdX + rdW + 14); wlLbl.setAttribute('y', wlY - 8);
      wlLbl.setAttribute('font-family', 'monospace');
      wlLbl.setAttribute('font-size', '12'); wlLbl.setAttribute('font-weight', '700');
      wlLbl.setAttribute('fill', '#66ccff');
      wlLbl.textContent = 'WL';
      g.appendChild(wlLbl);
      const wlV = document.createElementNS(NS, 'text');
      wlV.setAttribute('x', 300); wlV.setAttribute('y', wlY - 8);
      wlV.setAttribute('font-family', 'monospace');
      wlV.setAttribute('font-size', '11'); wlV.setAttribute('font-weight', '700');
      wlV.setAttribute('fill', '#889');
      wlV.textContent = '0 V';
      g.appendChild(wlV); refs.wlVolt = wlV;

      // VDD rail
      const vdd = document.createElementNS(NS, 'line');
      vdd.setAttribute('x1', 380); vdd.setAttribute('y1', vddY);
      vdd.setAttribute('x2', 700); vdd.setAttribute('y2', vddY);
      vdd.setAttribute('stroke', '#ffbb33'); vdd.setAttribute('stroke-width', '2.5');
      g.appendChild(vdd);
      const vddLbl = document.createElementNS(NS, 'text');
      vddLbl.setAttribute('x', 375); vddLbl.setAttribute('y', vddY + 5);
      vddLbl.setAttribute('text-anchor', 'end');
      vddLbl.setAttribute('font-family', 'monospace');
      vddLbl.setAttribute('font-size', '12'); vddLbl.setAttribute('font-weight', '700');
      vddLbl.setAttribute('fill', '#ffbb33');
      vddLbl.textContent = 'VDD';
      g.appendChild(vddLbl);

      // Precharge PMOS pair
      refs.prePmosL = _drawPMOS(g, NS, blX, 220, 'Ppr', '#fdb');
      refs.prePmosR = _drawPMOS(g, NS, blbX, 220, 'Pprb', '#fdb');
      [blX, blbX].forEach(x => {
        const ln = document.createElementNS(NS, 'line');
        ln.setAttribute('x1', x); ln.setAttribute('y1', vddY);
        ln.setAttribute('x2', x); ln.setAttribute('y2', 194);
        ln.setAttribute('stroke', '#ffbb33'); ln.setAttribute('stroke-width', '1.5');
        g.appendChild(ln);
        _drawNodeDot(g, NS, x, vddY, '#ffbb33');
      });
      const pre = document.createElementNS(NS, 'path');
      pre.setAttribute('d',
        `M 130 220
         L ${refs.prePmosL.gate.x} 220
         M ${refs.prePmosL.gate.x} 220
         L ${refs.prePmosL.gate.x - 20} 220
         L ${refs.prePmosL.gate.x - 20} 260
         L ${refs.prePmosR.gate.x - 20} 260
         L ${refs.prePmosR.gate.x - 20} 220
         L ${refs.prePmosR.gate.x} 220`);
      pre.setAttribute('fill', 'none');
      pre.setAttribute('stroke', '#aa88ff'); pre.setAttribute('stroke-width', '2');
      g.appendChild(pre); refs.preLine = pre;
      const preLbl = document.createElementNS(NS, 'text');
      preLbl.setAttribute('x', 140); preLbl.setAttribute('y', 213);
      preLbl.setAttribute('font-family', 'monospace');
      preLbl.setAttribute('font-size', '12'); preLbl.setAttribute('font-weight', '700');
      preLbl.setAttribute('fill', '#aa88ff');
      preLbl.textContent = 'PRE\u0304 (precharge)';
      g.appendChild(preLbl);

      // BL / BLB lines
      const bl = document.createElementNS(NS, 'line');
      bl.setAttribute('x1', blX); bl.setAttribute('y1', 254);
      bl.setAttribute('x2', blX); bl.setAttribute('y2', saTopY);
      bl.setAttribute('stroke', '#aac'); bl.setAttribute('stroke-width', '2');
      g.appendChild(bl); refs.blLine = bl;
      const blb = document.createElementNS(NS, 'line');
      blb.setAttribute('x1', blbX); blb.setAttribute('y1', 254);
      blb.setAttribute('x2', blbX); blb.setAttribute('y2', saTopY);
      blb.setAttribute('stroke', '#aac'); blb.setAttribute('stroke-width', '2');
      g.appendChild(blb); refs.blbLine = blb;
      const blLbl = document.createElementNS(NS, 'text');
      blLbl.setAttribute('x', blX - 16); blLbl.setAttribute('y', 275);
      blLbl.setAttribute('text-anchor', 'end');
      blLbl.setAttribute('font-family', 'monospace');
      blLbl.setAttribute('font-size', '12'); blLbl.setAttribute('font-weight', '700');
      blLbl.setAttribute('fill', '#aac');
      blLbl.textContent = 'BL';
      g.appendChild(blLbl);
      const blbLbl = document.createElementNS(NS, 'text');
      blbLbl.setAttribute('x', blbX + 16); blbLbl.setAttribute('y', 275);
      blbLbl.setAttribute('font-family', 'monospace');
      blbLbl.setAttribute('font-size', '12'); blbLbl.setAttribute('font-weight', '700');
      blbLbl.setAttribute('fill', '#aac');
      blbLbl.textContent = 'BL\u0304';
      g.appendChild(blbLbl);

      // Compact 6T cell box
      const cellX = 425, cellY = 290, cellW = 230, cellH = 75;
      const cellBox = document.createElementNS(NS, 'rect');
      cellBox.setAttribute('x', cellX); cellBox.setAttribute('y', cellY);
      cellBox.setAttribute('width', cellW); cellBox.setAttribute('height', cellH);
      cellBox.setAttribute('rx', 5);
      cellBox.setAttribute('fill', '#1a2230');
      cellBox.setAttribute('stroke', C2.accent); cellBox.setAttribute('stroke-width', '2');
      g.appendChild(cellBox);
      const cellLbl = document.createElementNS(NS, 'text');
      cellLbl.setAttribute('x', cellX + cellW / 2); cellLbl.setAttribute('y', cellY + 18);
      cellLbl.setAttribute('text-anchor', 'middle');
      cellLbl.setAttribute('font-family', 'monospace');
      cellLbl.setAttribute('font-size', '12'); cellLbl.setAttribute('font-weight', '700');
      cellLbl.setAttribute('fill', C2.accent);
      cellLbl.textContent = '6T SRAM CELL (M1..M6)';
      g.appendChild(cellLbl);
      const qN = document.createElementNS(NS, 'circle');
      qN.setAttribute('cx', cellX + 60); qN.setAttribute('cy', cellY + 45);
      qN.setAttribute('r', 12); qN.setAttribute('fill', '#15192a');
      qN.setAttribute('stroke', '#fff'); qN.setAttribute('stroke-width', '1.5');
      g.appendChild(qN); refs.cellQ = qN;
      const qNt = document.createElementNS(NS, 'text');
      qNt.setAttribute('x', cellX + 60); qNt.setAttribute('y', cellY + 50);
      qNt.setAttribute('text-anchor', 'middle');
      qNt.setAttribute('font-family', 'monospace');
      qNt.setAttribute('font-size', '13'); qNt.setAttribute('font-weight', '700');
      qNt.setAttribute('fill', '#889');
      qNt.textContent = 'Q';
      g.appendChild(qNt); refs.cellQtext = qNt;
      const qbN = document.createElementNS(NS, 'circle');
      qbN.setAttribute('cx', cellX + cellW - 60); qbN.setAttribute('cy', cellY + 45);
      qbN.setAttribute('r', 12); qbN.setAttribute('fill', '#15192a');
      qbN.setAttribute('stroke', '#fff'); qbN.setAttribute('stroke-width', '1.5');
      g.appendChild(qbN); refs.cellQb = qbN;
      const qbNt = document.createElementNS(NS, 'text');
      qbNt.setAttribute('x', cellX + cellW - 60); qbNt.setAttribute('y', cellY + 50);
      qbNt.setAttribute('text-anchor', 'middle');
      qbNt.setAttribute('font-family', 'monospace');
      qbNt.setAttribute('font-size', '13'); qbNt.setAttribute('font-weight', '700');
      qbNt.setAttribute('fill', '#889');
      qbNt.textContent = 'Q\u0304';
      g.appendChild(qbNt); refs.cellQbtext = qbNt;
      const m5t = document.createElementNS(NS, 'text');
      m5t.setAttribute('x', cellX + 20); m5t.setAttribute('y', cellY + cellH - 6);
      m5t.setAttribute('font-family', 'monospace');
      m5t.setAttribute('font-size', '10'); m5t.setAttribute('font-style', 'italic');
      m5t.setAttribute('fill', '#889');
      m5t.textContent = 'M5(N)';
      g.appendChild(m5t);
      const m6t = document.createElementNS(NS, 'text');
      m6t.setAttribute('x', cellX + cellW - 20); m6t.setAttribute('y', cellY + cellH - 6);
      m6t.setAttribute('text-anchor', 'end');
      m6t.setAttribute('font-family', 'monospace');
      m6t.setAttribute('font-size', '10'); m6t.setAttribute('font-style', 'italic');
      m6t.setAttribute('fill', '#889');
      m6t.textContent = 'M6(N)';
      g.appendChild(m6t);
      _drawNodeDot(g, NS, blX, cellY, '#aac');
      _drawNodeDot(g, NS, blbX, cellY, '#aac');
      _drawNodeDot(g, NS, cellX, wlY, '#66ccff');
      _drawNodeDot(g, NS, cellX + cellW, wlY, '#66ccff');

      // Sense amp
      const saX1 = 420, saX2 = 660;
      const sa = document.createElementNS(NS, 'path');
      sa.setAttribute('d',
        `M ${saX1} ${saTopY}
         L ${saX2} ${saTopY}
         L ${(saX1 + saX2) / 2} ${saBotY} Z`);
      sa.setAttribute('fill', '#1a2230');
      sa.setAttribute('stroke', C2.edgeRise); sa.setAttribute('stroke-width', '2');
      g.appendChild(sa); refs.saBox = sa;
      const saLbl = document.createElementNS(NS, 'text');
      saLbl.setAttribute('x', (saX1 + saX2) / 2); saLbl.setAttribute('y', saTopY + 24);
      saLbl.setAttribute('text-anchor', 'middle');
      saLbl.setAttribute('font-family', 'monospace');
      saLbl.setAttribute('font-size', '11'); saLbl.setAttribute('font-weight', '700');
      saLbl.setAttribute('fill', C2.edgeRise);
      saLbl.textContent = 'SENSE AMP';
      g.appendChild(saLbl);
      const plus = document.createElementNS(NS, 'text');
      plus.setAttribute('x', saX1 + 20); plus.setAttribute('y', saTopY + 16);
      plus.setAttribute('font-family', 'monospace');
      plus.setAttribute('font-size', '16'); plus.setAttribute('font-weight', '700');
      plus.setAttribute('fill', '#ffbb33');
      plus.textContent = '+';
      g.appendChild(plus);
      const minus = document.createElementNS(NS, 'text');
      minus.setAttribute('x', saX2 - 20); minus.setAttribute('y', saTopY + 16);
      minus.setAttribute('text-anchor', 'end');
      minus.setAttribute('font-family', 'monospace');
      minus.setAttribute('font-size', '18'); minus.setAttribute('font-weight', '700');
      minus.setAttribute('fill', '#66ccff');
      minus.textContent = '\u2212';
      g.appendChild(minus);
      const blToSa = document.createElementNS(NS, 'line');
      blToSa.setAttribute('x1', blX); blToSa.setAttribute('y1', saTopY);
      blToSa.setAttribute('x2', saX1 + 20); blToSa.setAttribute('y2', saTopY);
      blToSa.setAttribute('stroke', '#aac'); blToSa.setAttribute('stroke-width', '1.5');
      g.appendChild(blToSa);
      const blbToSa = document.createElementNS(NS, 'line');
      blbToSa.setAttribute('x1', blbX); blbToSa.setAttribute('y1', saTopY);
      blbToSa.setAttribute('x2', saX2 - 20); blbToSa.setAttribute('y2', saTopY);
      blbToSa.setAttribute('stroke', '#aac'); blbToSa.setAttribute('stroke-width', '1.5');
      g.appendChild(blbToSa);
      const saOut = document.createElementNS(NS, 'line');
      saOut.setAttribute('x1', (saX1 + saX2) / 2); saOut.setAttribute('y1', saBotY);
      saOut.setAttribute('x2', (saX1 + saX2) / 2); saOut.setAttribute('y2', muxY - 30);
      saOut.setAttribute('stroke', '#aac'); saOut.setAttribute('stroke-width', '2');
      g.appendChild(saOut);

      // Column mux NMOS
      refs.muxN = _drawNMOS(g, NS, (saX1 + saX2) / 2, muxY, 'N_mux', '#bbc');
      const csel = document.createElementNS(NS, 'line');
      csel.setAttribute('x1', refs.muxN.gate.x); csel.setAttribute('y1', refs.muxN.gate.y);
      csel.setAttribute('x2', 830); csel.setAttribute('y2', refs.muxN.gate.y);
      csel.setAttribute('stroke', '#ffaa55'); csel.setAttribute('stroke-width', '2');
      g.appendChild(csel); refs.cselLine = csel;

      // Column decoder box (right)
      const cdW = 110, cdH = 50;
      const cdX = 830, cdY = refs.muxN.gate.y - cdH / 2;
      const cdBox = document.createElementNS(NS, 'rect');
      cdBox.setAttribute('x', cdX); cdBox.setAttribute('y', cdY);
      cdBox.setAttribute('width', cdW); cdBox.setAttribute('height', cdH);
      cdBox.setAttribute('rx', 4);
      cdBox.setAttribute('fill', '#15192a'); cdBox.setAttribute('stroke', '#ffaa55');
      cdBox.setAttribute('stroke-width', '2');
      g.appendChild(cdBox);
      const cdL1 = document.createElementNS(NS, 'text');
      cdL1.setAttribute('x', cdX + cdW / 2); cdL1.setAttribute('y', cdY + 20);
      cdL1.setAttribute('text-anchor', 'middle');
      cdL1.setAttribute('font-family', 'monospace');
      cdL1.setAttribute('font-size', '11'); cdL1.setAttribute('font-weight', '700');
      cdL1.setAttribute('fill', '#ffaa55');
      cdL1.textContent = 'COL DECODER';
      g.appendChild(cdL1);
      const cdL2 = document.createElementNS(NS, 'text');
      cdL2.setAttribute('x', cdX + cdW / 2); cdL2.setAttribute('y', cdY + 38);
      cdL2.setAttribute('text-anchor', 'middle');
      cdL2.setAttribute('font-family', 'monospace');
      cdL2.setAttribute('font-size', '10');
      cdL2.setAttribute('fill', '#889');
      cdL2.textContent = 'CSEL output';
      g.appendChild(cdL2);
      const cselLbl = document.createElementNS(NS, 'text');
      cselLbl.setAttribute('x', 820); cselLbl.setAttribute('y', refs.muxN.gate.y - 6);
      cselLbl.setAttribute('text-anchor', 'end');
      cselLbl.setAttribute('font-family', 'monospace');
      cselLbl.setAttribute('font-size', '11'); cselLbl.setAttribute('font-weight', '700');
      cselLbl.setAttribute('fill', '#ffaa55');
      cselLbl.textContent = 'CSEL';
      g.appendChild(cselLbl);

      const dbus = document.createElementNS(NS, 'line');
      dbus.setAttribute('x1', refs.muxN.source.x); dbus.setAttribute('y1', refs.muxN.source.y);
      dbus.setAttribute('x2', refs.muxN.source.x); dbus.setAttribute('y2', 550);
      dbus.setAttribute('stroke', '#aac'); dbus.setAttribute('stroke-width', '2');
      g.appendChild(dbus); refs.dbusLine = dbus;
      const dbusLbl = document.createElementNS(NS, 'text');
      dbusLbl.setAttribute('x', refs.muxN.source.x + 14); dbusLbl.setAttribute('y', 545);
      dbusLbl.setAttribute('font-family', 'monospace');
      dbusLbl.setAttribute('font-size', '12'); dbusLbl.setAttribute('font-weight', '700');
      dbusLbl.setAttribute('fill', '#aac');
      dbusLbl.textContent = 'DATA BUS \u2192';
      g.appendChild(dbusLbl);

      const phase = document.createElementNS(NS, 'text');
      phase.setAttribute('x', 500); phase.setAttribute('y', 600);
      phase.setAttribute('text-anchor', 'middle');
      phase.setAttribute('font-family', 'monospace');
      phase.setAttribute('font-size', '13'); phase.setAttribute('font-weight', '700');
      phase.setAttribute('fill', C2.edgeRise);
      g.appendChild(phase); refs.phase = phase;
    });

    b.animate('sram-column', (tMs) => {
      const cycleMs = 12000;
      const T = tMs % cycleMs;
      let preOn, wlOn, cselOn, qVal, blv, blbv, phase;
      if (T < 2000)       { preOn = true;  wlOn = false; cselOn = false; qVal = 0; blv = 'VDD/2'; blbv = 'VDD/2'; phase = 'PRECHARGE: Ppr + Pprb ON, BL and BL\u0304 equalized at VDD/2'; }
      else if (T < 3500)  { preOn = false; wlOn = true;  cselOn = false; qVal = 0; blv = 'drop';  blbv = 'rise';  phase = 'WL rises: M5/M6 ON \u2192 Q=0 pulls BL low, Q\u0304=VDD pushes BL\u0304 high'; }
      else if (T < 5500)  { preOn = false; wlOn = true;  cselOn = false; qVal = 0; blv = '0 V';   blbv = 'VDD';   phase = 'SENSE AMP detects (+ < \u2212) \u2192 latches \u201c0\u201d on BL side'; }
      else if (T < 7500)  { preOn = false; wlOn = true;  cselOn = true;  qVal = 0; blv = '0 V';   blbv = 'VDD';   phase = 'CSEL HIGH \u2192 N_mux ON \u2192 amplified bit drives data bus'; }
      else if (T < 9500)  { preOn = false; wlOn = false; cselOn = true;  qVal = 0; blv = '0 V';   blbv = 'VDD';   phase = 'WL drops: M5/M6 OFF. Bit held on bus by mux briefly'; }
      else                { preOn = true;  wlOn = false; cselOn = false; qVal = 0; blv = 'VDD/2'; blbv = 'VDD/2'; phase = 'back to PRECHARGE, ready for next access (loop)'; }

      refs.phase.textContent = phase;
      refs.preLine.setAttribute('stroke', preOn ? '#66ccff' : '#aa88ff');
      refs.prePmosL.channelEls.forEach(e => { e.setAttribute('stroke', preOn ? '#ffdd77' : '#fdb'); e.setAttribute('stroke-width', preOn ? '3' : '2'); });
      refs.prePmosR.channelEls.forEach(e => { e.setAttribute('stroke', preOn ? '#ffdd77' : '#fdb'); e.setAttribute('stroke-width', preOn ? '3' : '2'); });
      refs.wlLine.setAttribute('stroke', wlOn ? '#ffbb33' : '#66ccff');
      refs.wlLine.setAttribute('stroke-width', wlOn ? '3.5' : '2.5');
      refs.wlVolt.textContent = wlOn ? 'VDD' : '0 V';
      refs.wlVolt.setAttribute('fill', wlOn ? '#ffbb33' : '#889');

      refs.cellQ.setAttribute('stroke', qVal ? '#ffbb33' : '#66ccff');
      refs.cellQtext.setAttribute('fill', qVal ? '#ffbb33' : '#66ccff');
      refs.cellQtext.textContent = qVal ? '1' : '0';
      refs.cellQb.setAttribute('stroke', qVal ? '#66ccff' : '#ffbb33');
      refs.cellQbtext.setAttribute('fill', qVal ? '#66ccff' : '#ffbb33');
      refs.cellQbtext.textContent = qVal ? '0' : '1';

      const blColor = (v) => v === '0 V' ? '#66ccff' : v === 'VDD' ? '#ffbb33' : v === 'VDD/2' ? '#8899aa' : '#bbc';
      refs.blLine.setAttribute('stroke', blColor(blv));
      refs.blbLine.setAttribute('stroke', blColor(blbv));
      refs.saBox.setAttribute('stroke', (wlOn && T > 3500) ? '#ffbb33' : '#778');
      refs.saBox.setAttribute('stroke-width', (wlOn && T > 3500) ? '3' : '2');
      refs.cselLine.setAttribute('stroke', cselOn ? '#ffbb33' : '#ffaa55');
      refs.cselLine.setAttribute('stroke-width', cselOn ? '3' : '2');
      refs.muxN.channelEls.forEach(e => { e.setAttribute('stroke', cselOn ? '#ffdd77' : '#bbc'); e.setAttribute('stroke-width', cselOn ? '3' : '2'); });
      refs.dbusLine.setAttribute('stroke', cselOn ? '#ffbb33' : '#aac');
      refs.dbusLine.setAttribute('stroke-width', cselOn ? '3' : '2');
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PROPER SCHEMATIC: 8 x 8 SRAM byte-memory array.
  //  8 rows (8 addresses) x 8 columns (8 bits = 1 byte per address).
  //  3-bit row address feeds a 3-to-8 ROW DECODER, raising exactly one
  //  WL.  All 8 bit line pairs are tapped in parallel by 8 sense amps
  //  \u2192 8-bit DATA BUS (D7..D0) carries one byte out.
  //  This is the real wiring an EE designer lays out for small RAM.
  // ═══════════════════════════════════════════════════════════════════
  function _drawSRAMByteArray(b) {
    const COL = C();
    const nRows = 8, nCols = 8;
    const gX = 280, gY = 180;       // grid top-left
    const cellW = 58, cellH = 28;
    const gW = nCols * cellW, gH = nRows * cellH;
    const vddY = 148, preY = 165;
    const saY = gY + gH + 14;       // sense-amp baseline
    const dbusY = saY + 52;

    // Pre-assigned byte per address, for a varied pattern.
    const memBytes = [0x5A, 0xA5, 0xFF, 0x00, 0x3C, 0xC3, 0x0F, 0xF0];

    const refs = {
      addrBits: [],    // 3 input tiles (A2, A1, A0)
      wlLines: [],     // 8 WL wires
      wlLabels: [],
      cells: [],       // 2D array of rects
      cellTexts: [],
      blLines: [],     // nCols * 2  (BL + BL\u0304)
      preLines: [],    // nCols precharge PMOS stroke refs
      senseAmps: [],
      dataBits: [],    // 8 output value cells
      dataByteText: null,
      rowDecBox: null,
      currentAddrText: null,
      phase: null,
    };

    b.drawCustom('sram-byte-array', (g, NS, C2) => {
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', 60); bg.setAttribute('y', 130);
      bg.setAttribute('width', 880); bg.setAttribute('height', 420);
      bg.setAttribute('rx', 8); bg.setAttribute('fill', '#0a0f18');
      bg.setAttribute('stroke', '#1a2230'); bg.setAttribute('stroke-width', '1.2');
      g.appendChild(bg);

      const title = document.createElementNS(NS, 'text');
      title.setAttribute('x', 500); title.setAttribute('y', 150);
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('font-family', 'monospace');
      title.setAttribute('font-size', '12'); title.setAttribute('font-style', 'italic');
      title.setAttribute('fill', C2.accent);
      title.textContent = '8-address x 8-bit SRAM array  \u2014  3-to-8 ROW DECODER | 64 cells | 8 sense amps | D7..D0';
      g.appendChild(title);

      // ─── 3-to-8 ROW DECODER (left) ───
      const rdX = 90, rdW = 160, rdH = gH, rdY = gY;
      const rdBox = document.createElementNS(NS, 'rect');
      rdBox.setAttribute('x', rdX); rdBox.setAttribute('y', rdY);
      rdBox.setAttribute('width', rdW); rdBox.setAttribute('height', rdH);
      rdBox.setAttribute('rx', 6);
      rdBox.setAttribute('fill', '#15192a'); rdBox.setAttribute('stroke', '#66ccff');
      rdBox.setAttribute('stroke-width', '2');
      g.appendChild(rdBox); refs.rowDecBox = rdBox;
      const rdL1 = document.createElementNS(NS, 'text');
      rdL1.setAttribute('x', rdX + rdW / 2); rdL1.setAttribute('y', rdY + 20);
      rdL1.setAttribute('text-anchor', 'middle');
      rdL1.setAttribute('font-family', 'monospace');
      rdL1.setAttribute('font-size', '12'); rdL1.setAttribute('font-weight', '700');
      rdL1.setAttribute('fill', '#66ccff');
      rdL1.textContent = 'ROW DECODER';
      g.appendChild(rdL1);
      const rdL2 = document.createElementNS(NS, 'text');
      rdL2.setAttribute('x', rdX + rdW / 2); rdL2.setAttribute('y', rdY + 36);
      rdL2.setAttribute('text-anchor', 'middle');
      rdL2.setAttribute('font-family', 'monospace');
      rdL2.setAttribute('font-size', '11'); rdL2.setAttribute('font-style', 'italic');
      rdL2.setAttribute('fill', '#889');
      rdL2.textContent = '(3-to-8)';
      g.appendChild(rdL2);

      // 3 address input tiles on the left of the row decoder
      const abStart = rdX - 50, abY = rdY + rdH / 2 - 30;
      ['A2','A1','A0'].forEach((nm, i) => {
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', abStart); r.setAttribute('y', abY + i * 22);
        r.setAttribute('width', 42); r.setAttribute('height', 18);
        r.setAttribute('rx', 3);
        r.setAttribute('fill', '#15192a');
        r.setAttribute('stroke', '#66ccff');
        r.setAttribute('stroke-width', '1.2');
        g.appendChild(r);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', abStart - 4); t.setAttribute('y', abY + i * 22 + 13);
        t.setAttribute('text-anchor', 'end');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '10'); t.setAttribute('font-weight', '700');
        t.setAttribute('fill', '#66ccff');
        t.textContent = nm;
        g.appendChild(t);
        const v = document.createElementNS(NS, 'text');
        v.setAttribute('x', abStart + 21); v.setAttribute('y', abY + i * 22 + 13);
        v.setAttribute('text-anchor', 'middle');
        v.setAttribute('font-family', 'monospace');
        v.setAttribute('font-size', '11'); v.setAttribute('font-weight', '700');
        v.setAttribute('fill', '#66ccff');
        v.textContent = '0';
        g.appendChild(v);
        refs.addrBits.push({ rect: r, val: v });
        // Stub into decoder
        const ln = document.createElementNS(NS, 'line');
        ln.setAttribute('x1', abStart + 42); ln.setAttribute('y1', abY + i * 22 + 9);
        ln.setAttribute('x2', rdX); ln.setAttribute('y2', abY + i * 22 + 9);
        ln.setAttribute('stroke', '#66ccff'); ln.setAttribute('stroke-width', '1.5');
        g.appendChild(ln);
      });

      // Current address displayed
      const caLbl = document.createElementNS(NS, 'text');
      caLbl.setAttribute('x', rdX + rdW / 2); caLbl.setAttribute('y', rdY + rdH - 14);
      caLbl.setAttribute('text-anchor', 'middle');
      caLbl.setAttribute('font-family', 'monospace');
      caLbl.setAttribute('font-size', '11'); caLbl.setAttribute('font-weight', '700');
      caLbl.setAttribute('fill', '#ffbb33');
      caLbl.textContent = 'addr = 000';
      g.appendChild(caLbl); refs.currentAddrText = caLbl;

      // ─── VDD rail on top (for precharge) ───
      const vdd = document.createElementNS(NS, 'line');
      vdd.setAttribute('x1', gX - 4); vdd.setAttribute('y1', vddY);
      vdd.setAttribute('x2', gX + gW + 4); vdd.setAttribute('y2', vddY);
      vdd.setAttribute('stroke', '#ffbb33'); vdd.setAttribute('stroke-width', '2');
      g.appendChild(vdd);
      const vddLbl = document.createElementNS(NS, 'text');
      vddLbl.setAttribute('x', gX - 8); vddLbl.setAttribute('y', vddY + 4);
      vddLbl.setAttribute('text-anchor', 'end');
      vddLbl.setAttribute('font-family', 'monospace');
      vddLbl.setAttribute('font-size', '11'); vddLbl.setAttribute('font-weight', '700');
      vddLbl.setAttribute('fill', '#ffbb33');
      vddLbl.textContent = 'VDD';
      g.appendChild(vddLbl);

      // ─── Precharge PMOS pair + BL/BL\u0304 per column ───
      for (let c = 0; c < nCols; c++) {
        const colCx = gX + c * cellW + cellW / 2;
        const blX  = colCx - 8;
        const blbX = colCx + 8;
        // BL down the column
        const bl = document.createElementNS(NS, 'line');
        bl.setAttribute('x1', blX); bl.setAttribute('y1', preY);
        bl.setAttribute('x2', blX); bl.setAttribute('y2', saY - 6);
        bl.setAttribute('stroke', '#aac'); bl.setAttribute('stroke-width', '1.5');
        g.appendChild(bl);
        const blb = document.createElementNS(NS, 'line');
        blb.setAttribute('x1', blbX); blb.setAttribute('y1', preY);
        blb.setAttribute('x2', blbX); blb.setAttribute('y2', saY - 6);
        blb.setAttribute('stroke', '#aac'); blb.setAttribute('stroke-width', '1.5');
        g.appendChild(blb);
        refs.blLines.push(bl, blb);
        // Precharge PMOS pair (drawn as small P symbols just below VDD)
        const pp1 = document.createElementNS(NS, 'rect');
        pp1.setAttribute('x', blX - 5); pp1.setAttribute('y', preY - 10);
        pp1.setAttribute('width', 10); pp1.setAttribute('height', 8);
        pp1.setAttribute('fill', '#fdb'); pp1.setAttribute('stroke', '#fdb');
        g.appendChild(pp1);
        const pp2 = document.createElementNS(NS, 'rect');
        pp2.setAttribute('x', blbX - 5); pp2.setAttribute('y', preY - 10);
        pp2.setAttribute('width', 10); pp2.setAttribute('height', 8);
        pp2.setAttribute('fill', '#fdb'); pp2.setAttribute('stroke', '#fdb');
        g.appendChild(pp2);
        // Wires to VDD
        [blX, blbX].forEach(xx => {
          const v = document.createElementNS(NS, 'line');
          v.setAttribute('x1', xx); v.setAttribute('y1', vddY);
          v.setAttribute('x2', xx); v.setAttribute('y2', preY - 10);
          v.setAttribute('stroke', '#ffbb33'); v.setAttribute('stroke-width', '1');
          g.appendChild(v);
        });
        refs.preLines.push({ pp1, pp2 });
      }
      // PRE line across all precharge PMOS gates
      const preLine = document.createElementNS(NS, 'line');
      preLine.setAttribute('x1', rdX); preLine.setAttribute('y1', preY - 6);
      preLine.setAttribute('x2', gX + gW + 4); preLine.setAttribute('y2', preY - 6);
      preLine.setAttribute('stroke', '#aa88ff'); preLine.setAttribute('stroke-width', '1');
      preLine.setAttribute('opacity', '0.5');
      g.appendChild(preLine);
      const preLbl = document.createElementNS(NS, 'text');
      preLbl.setAttribute('x', gX + gW + 8); preLbl.setAttribute('y', preY - 2);
      preLbl.setAttribute('font-family', 'monospace');
      preLbl.setAttribute('font-size', '9'); preLbl.setAttribute('font-weight', '700');
      preLbl.setAttribute('fill', '#aa88ff');
      preLbl.textContent = 'PRE\u0304';
      g.appendChild(preLbl);

      // ─── WLs (8 rows) from decoder into grid ───
      for (let r = 0; r < nRows; r++) {
        const wlY = gY + r * cellH + cellH / 2;
        const wl = document.createElementNS(NS, 'line');
        wl.setAttribute('x1', rdX + rdW); wl.setAttribute('y1', wlY);
        wl.setAttribute('x2', gX + gW);    wl.setAttribute('y2', wlY);
        wl.setAttribute('stroke', '#556'); wl.setAttribute('stroke-width', '1.5');
        g.appendChild(wl);
        refs.wlLines.push(wl);
        // WL label
        const wlL = document.createElementNS(NS, 'text');
        wlL.setAttribute('x', gX + gW + 6); wlL.setAttribute('y', wlY + 3);
        wlL.setAttribute('font-family', 'monospace');
        wlL.setAttribute('font-size', '10'); wlL.setAttribute('font-weight', '700');
        wlL.setAttribute('fill', '#889');
        wlL.textContent = 'WL' + r;
        g.appendChild(wlL);
        refs.wlLabels.push(wlL);
      }

      // ─── The 8x8 cells (compact, just labeled with stored bit) ───
      for (let r = 0; r < nRows; r++) {
        refs.cells.push([]);
        refs.cellTexts.push([]);
        for (let c = 0; c < nCols; c++) {
          const x = gX + c * cellW + 6;
          const y = gY + r * cellH + 3;
          const w = cellW - 12, h = cellH - 6;
          const rct = document.createElementNS(NS, 'rect');
          rct.setAttribute('x', x); rct.setAttribute('y', y);
          rct.setAttribute('width', w); rct.setAttribute('height', h);
          rct.setAttribute('rx', 2);
          rct.setAttribute('fill', '#15192a');
          rct.setAttribute('stroke', '#334');
          rct.setAttribute('stroke-width', '0.8');
          g.appendChild(rct);
          refs.cells[r].push(rct);
          // Bit value label
          const bit = (memBytes[r] >> (nCols - 1 - c)) & 1;
          const t = document.createElementNS(NS, 'text');
          t.setAttribute('x', x + w / 2); t.setAttribute('y', y + h - 5);
          t.setAttribute('text-anchor', 'middle');
          t.setAttribute('font-family', 'monospace');
          t.setAttribute('font-size', '10'); t.setAttribute('font-weight', '700');
          t.setAttribute('fill', '#556');
          t.textContent = String(bit);
          g.appendChild(t);
          refs.cellTexts[r].push(t);
        }
      }

      // ─── Sense amps (one per column) ───
      for (let c = 0; c < nCols; c++) {
        const colCx = gX + c * cellW + cellW / 2;
        const sa = document.createElementNS(NS, 'path');
        sa.setAttribute('d',
          `M ${colCx - 12} ${saY}
           L ${colCx + 12} ${saY}
           L ${colCx} ${saY + 22} Z`);
        sa.setAttribute('fill', '#1a2230');
        sa.setAttribute('stroke', '#778'); sa.setAttribute('stroke-width', '1');
        g.appendChild(sa);
        refs.senseAmps.push(sa);
      }
      const saLbl = document.createElementNS(NS, 'text');
      saLbl.setAttribute('x', gX + gW + 6); saLbl.setAttribute('y', saY + 12);
      saLbl.setAttribute('font-family', 'monospace');
      saLbl.setAttribute('font-size', '9'); saLbl.setAttribute('font-style', 'italic');
      saLbl.setAttribute('fill', '#778');
      saLbl.textContent = '\u2190 8 sense amps (one / column)';
      g.appendChild(saLbl);

      // ─── Data bus D7..D0 at the bottom ───
      for (let c = 0; c < nCols; c++) {
        const colCx = gX + c * cellW + cellW / 2;
        const box = document.createElementNS(NS, 'rect');
        box.setAttribute('x', colCx - 16); box.setAttribute('y', dbusY);
        box.setAttribute('width', 32); box.setAttribute('height', 26);
        box.setAttribute('rx', 3);
        box.setAttribute('fill', '#15192a');
        box.setAttribute('stroke', '#445'); box.setAttribute('stroke-width', '1');
        g.appendChild(box);
        const vt = document.createElementNS(NS, 'text');
        vt.setAttribute('x', colCx); vt.setAttribute('y', dbusY + 18);
        vt.setAttribute('text-anchor', 'middle');
        vt.setAttribute('font-family', 'monospace');
        vt.setAttribute('font-size', '14'); vt.setAttribute('font-weight', '700');
        vt.setAttribute('fill', '#445');
        vt.textContent = '-';
        g.appendChild(vt);
        const dl = document.createElementNS(NS, 'text');
        dl.setAttribute('x', colCx); dl.setAttribute('y', dbusY + 42);
        dl.setAttribute('text-anchor', 'middle');
        dl.setAttribute('font-family', 'monospace');
        dl.setAttribute('font-size', '9');
        dl.setAttribute('fill', '#778');
        dl.textContent = 'D' + (nCols - 1 - c);
        g.appendChild(dl);
        refs.dataBits.push({ box, val: vt });
      }

      // Byte display on the right
      const byteTxt = document.createElementNS(NS, 'text');
      byteTxt.setAttribute('x', gX + gW + 8); byteTxt.setAttribute('y', dbusY + 20);
      byteTxt.setAttribute('font-family', 'monospace');
      byteTxt.setAttribute('font-size', '14'); byteTxt.setAttribute('font-weight', '700');
      byteTxt.setAttribute('fill', '#ffbb33');
      byteTxt.textContent = 'byte = --';
      g.appendChild(byteTxt); refs.dataByteText = byteTxt;

      // Phase caption
      const phase = document.createElementNS(NS, 'text');
      phase.setAttribute('x', 500); phase.setAttribute('y', 600);
      phase.setAttribute('text-anchor', 'middle');
      phase.setAttribute('font-family', 'monospace');
      phase.setAttribute('font-size', '13'); phase.setAttribute('font-weight', '700');
      phase.setAttribute('fill', C2.edgeRise);
      g.appendChild(phase); refs.phase = phase;
    });

    b.animate('sram-byte-array', (tMs) => {
      const perAddrMs = 2500;
      const addr = Math.floor(tMs / perAddrMs) % nRows;
      const tInAddr = tMs % perAddrMs;
      const bits = [(addr >> 2) & 1, (addr >> 1) & 1, addr & 1];

      // Update 3 address input tiles
      refs.addrBits.forEach((ab, i) => {
        ab.val.textContent = String(bits[i]);
        ab.val.setAttribute('fill', '#66ccff');
      });
      refs.currentAddrText.textContent =
        'addr = ' + bits.join('') + ' (row ' + addr + ')';

      // Phase within this address
      let phase, showWL, showSA, showBus;
      if (tInAddr < 400) {
        phase = 'addr = ' + bits.join('') + '  \u2192  row decoder fires'; showWL = false; showSA = false; showBus = false;
      } else if (tInAddr < 1000) {
        phase = 'WL' + addr + ' rises  \u2192  all 8 cells on row ' + addr + ' dump bits onto BLs'; showWL = true; showSA = false; showBus = false;
      } else if (tInAddr < 1600) {
        phase = 'sense amps latch the 8 bits in parallel'; showWL = true; showSA = true; showBus = false;
      } else {
        phase = 'byte on data bus: 0x' + memBytes[addr].toString(16).toUpperCase().padStart(2, '0') + ' = ' + memBytes[addr]; showWL = true; showSA = true; showBus = true;
      }

      refs.phase.textContent = phase;

      // WL visual: active row bright, others dim
      refs.wlLines.forEach((wl, r) => {
        if (r === addr && showWL) {
          wl.setAttribute('stroke', '#ffbb33');
          wl.setAttribute('stroke-width', '2.5');
          refs.wlLabels[r].setAttribute('fill', '#ffbb33');
        } else {
          wl.setAttribute('stroke', '#556');
          wl.setAttribute('stroke-width', '1.5');
          refs.wlLabels[r].setAttribute('fill', '#889');
        }
      });

      // Cells: row highlighted + show their bit values
      for (let r = 0; r < nRows; r++) {
        for (let c = 0; c < nCols; c++) {
          const bit = (memBytes[r] >> (nCols - 1 - c)) & 1;
          if (r === addr && showWL) {
            refs.cells[r][c].setAttribute('fill', bit ? '#3a3010' : '#102030');
            refs.cells[r][c].setAttribute('stroke', bit ? '#ffbb33' : '#66ccff');
            refs.cellTexts[r][c].setAttribute('fill', bit ? '#ffbb33' : '#66ccff');
          } else {
            refs.cells[r][c].setAttribute('fill', '#15192a');
            refs.cells[r][c].setAttribute('stroke', '#334');
            refs.cellTexts[r][c].setAttribute('fill', '#556');
          }
        }
      }

      // Bit lines: active row shown by col bit
      for (let c = 0; c < nCols; c++) {
        const bit = (memBytes[addr] >> (nCols - 1 - c)) & 1;
        const bl  = refs.blLines[c * 2];
        const blb = refs.blLines[c * 2 + 1];
        if (showWL) {
          bl.setAttribute('stroke',  bit ? '#ffbb33' : '#66ccff');
          bl.setAttribute('stroke-width', '2');
          blb.setAttribute('stroke', bit ? '#66ccff' : '#ffbb33');
          blb.setAttribute('stroke-width', '2');
        } else {
          bl.setAttribute('stroke', '#aac'); bl.setAttribute('stroke-width', '1.5');
          blb.setAttribute('stroke', '#aac'); blb.setAttribute('stroke-width', '1.5');
        }
      }

      // Sense amps
      refs.senseAmps.forEach((sa, c) => {
        const bit = (memBytes[addr] >> (nCols - 1 - c)) & 1;
        if (showSA) {
          sa.setAttribute('fill', bit ? '#3a3010' : '#102030');
          sa.setAttribute('stroke', bit ? '#ffbb33' : '#66ccff');
          sa.setAttribute('stroke-width', '1.5');
        } else {
          sa.setAttribute('fill', '#1a2230');
          sa.setAttribute('stroke', '#778');
          sa.setAttribute('stroke-width', '1');
        }
      });

      // Data bus bits
      refs.dataBits.forEach((db, c) => {
        const bit = (memBytes[addr] >> (nCols - 1 - c)) & 1;
        if (showBus) {
          db.val.textContent = String(bit);
          db.val.setAttribute('fill', bit ? '#ffbb33' : '#66ccff');
          db.box.setAttribute('stroke', bit ? '#ffbb33' : '#66ccff');
          db.box.setAttribute('stroke-width', '1.5');
        } else {
          db.val.textContent = '-';
          db.val.setAttribute('fill', '#445');
          db.box.setAttribute('stroke', '#445');
          db.box.setAttribute('stroke-width', '1');
        }
      });

      // Byte summary on right
      if (showBus) {
        const b = memBytes[addr];
        refs.dataByteText.textContent =
          'byte = 0x' + b.toString(16).toUpperCase().padStart(2, '0') +
          ' = ' + b.toString(2).padStart(8, '0');
        refs.dataByteText.setAttribute('fill', '#ffbb33');
      } else {
        refs.dataByteText.textContent = 'byte = --';
        refs.dataByteText.setAttribute('fill', '#778');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  LDA step-by-step: T-state counter + microcode ROM + control
  //  signals + register values, all synchronized.  Viewer sees one
  //  LDA instruction walk through 4 T-states, understanding exactly
  //  which signals fire at each clock edge and what data moves where.
  // ═══════════════════════════════════════════════════════════════════
  function _drawLDAStepByStep(b) {
    const COL = C();

    // Memory contents (simplified SAP-1 style: 4-bit opcode + 4-bit operand)
    // addr 0 = 0x1E (LDA 14)  \u2192  opcode 1 (LDA) + operand 0xE (=14)
    // addr 14 (0xE) = 0x42    \u2192  the data that will get loaded into A
    //
    // Microcode ROM for LDA opcode (4 T-states):
    //   T0: CO + MI         PC \u2192 MAR   (fetch-address-to-MAR)
    //   T1: RO + II + CE    RAM[MAR] \u2192 IR,  PC++
    //   T2: IO + MI         IR.operand \u2192 MAR
    //   T3: RO + AI         RAM[MAR] \u2192 A

    // Signal IDs shown on the control bus (active ones for LDA highlighted)
    const allSignals = ['HLT','MI','RI','RO','IO','II','AI','AO','EO','SU','BI','OI','CE','CO','J'];
    // Per-Tstate microcode for LDA
    const uCode = [
      ['CO','MI'],           // T0
      ['RO','II','CE'],      // T1
      ['IO','MI'],           // T2
      ['RO','AI'],           // T3
    ];
    const phases = [
      { title: 'T0  \u2014  CO + MI',
        desc: 'CO drives PC onto address bus. MI latches MAR from addr bus.',
        detail: 'PC (= 0) \u2192 ADDR BUS \u2192 MAR.  Now MAR holds the address of the next instruction.' },
      { title: 'T1  \u2014  RO + II + CE',
        desc: 'RO drives RAM[MAR] onto data bus. II latches IR. CE increments PC.',
        detail: 'RAM[0] (= 0x1E = LDA 14) \u2192 DATA BUS \u2192 IR.  Also: PC \u2192 1 on next clock.' },
      { title: 'T2  \u2014  IO + MI',
        desc: 'IO drives IR\u2019s operand (low 4 bits) onto addr bus. MI latches MAR.',
        detail: 'IR.operand (= 0xE = 14) \u2192 ADDR BUS \u2192 MAR.  MAR now points at the data.' },
      { title: 'T3  \u2014  RO + AI',
        desc: 'RO drives RAM[MAR] onto data bus. AI latches the A register.',
        detail: 'RAM[14] (= 0x42) \u2192 DATA BUS \u2192 A.  The LDA is complete.' },
    ];

    const refs = {
      regBoxes: {}, regVals: {},
      addrBusWire: null, dataBusWire: null,
      addrBusVal: null, dataBusVal: null,
      tStateNum: null,
      uCodeRows: [],
      sigTiles: {},
      phaseTitle: null, phaseDesc: null, phaseDetail: null,
      clockPulse: null,
    };

    b.drawCustom('lda-steps', (g, NS, C2) => {
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', 60); bg.setAttribute('y', 130);
      bg.setAttribute('width', 880); bg.setAttribute('height', 420);
      bg.setAttribute('rx', 8); bg.setAttribute('fill', '#0a0f18');
      bg.setAttribute('stroke', '#1a2230'); bg.setAttribute('stroke-width', '1.2');
      g.appendChild(bg);

      const title = document.createElementNS(NS, 'text');
      title.setAttribute('x', 500); title.setAttribute('y', 150);
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('font-family', 'monospace');
      title.setAttribute('font-size', '13'); title.setAttribute('font-weight', '700');
      title.setAttribute('fill', C2.edgeRise);
      title.textContent = 'Anatomy of ONE instruction: LDA 14  \u2014  follow the T-states';
      g.appendChild(title);

      // ─── CPU block diagram (top half) ───
      // Address bus (upper horizontal rail)
      const addrY = 220;
      const addrBus = document.createElementNS(NS, 'line');
      addrBus.setAttribute('x1', 110); addrBus.setAttribute('y1', addrY);
      addrBus.setAttribute('x2', 890); addrBus.setAttribute('y2', addrY);
      addrBus.setAttribute('stroke', '#888'); addrBus.setAttribute('stroke-width', '2');
      g.appendChild(addrBus); refs.addrBusWire = addrBus;
      const addrLbl = document.createElementNS(NS, 'text');
      addrLbl.setAttribute('x', 900); addrLbl.setAttribute('y', addrY + 5);
      addrLbl.setAttribute('font-family', 'monospace');
      addrLbl.setAttribute('font-size', '11'); addrLbl.setAttribute('font-weight', '700');
      addrLbl.setAttribute('fill', '#66ccff');
      addrLbl.textContent = 'ADDR BUS';
      g.appendChild(addrLbl);
      const addrV = document.createElementNS(NS, 'text');
      addrV.setAttribute('x', 900); addrV.setAttribute('y', addrY + 20);
      addrV.setAttribute('font-family', 'monospace');
      addrV.setAttribute('font-size', '11'); addrV.setAttribute('font-weight', '700');
      addrV.setAttribute('fill', '#778');
      addrV.textContent = '----';
      g.appendChild(addrV); refs.addrBusVal = addrV;

      // Data bus (lower horizontal rail)
      const dataY = 340;
      const dataBus = document.createElementNS(NS, 'line');
      dataBus.setAttribute('x1', 110); dataBus.setAttribute('y1', dataY);
      dataBus.setAttribute('x2', 890); dataBus.setAttribute('y2', dataY);
      dataBus.setAttribute('stroke', '#888'); dataBus.setAttribute('stroke-width', '2');
      g.appendChild(dataBus); refs.dataBusWire = dataBus;
      const dataLbl = document.createElementNS(NS, 'text');
      dataLbl.setAttribute('x', 900); dataLbl.setAttribute('y', dataY + 5);
      dataLbl.setAttribute('font-family', 'monospace');
      dataLbl.setAttribute('font-size', '11'); dataLbl.setAttribute('font-weight', '700');
      dataLbl.setAttribute('fill', '#ffbb33');
      dataLbl.textContent = 'DATA BUS';
      g.appendChild(dataLbl);
      const dataV = document.createElementNS(NS, 'text');
      dataV.setAttribute('x', 900); dataV.setAttribute('y', dataY + 20);
      dataV.setAttribute('font-family', 'monospace');
      dataV.setAttribute('font-size', '11'); dataV.setAttribute('font-weight', '700');
      dataV.setAttribute('fill', '#778');
      dataV.textContent = '----';
      g.appendChild(dataV); refs.dataBusVal = dataV;

      // Register boxes along the bus
      const drawReg = (name, x, busSide, initVal) => {
        const y = (busSide === 'addr') ? addrY - 50 : dataY + 10;
        const w = 80, h = 42;
        const box = document.createElementNS(NS, 'rect');
        box.setAttribute('x', x); box.setAttribute('y', y);
        box.setAttribute('width', w); box.setAttribute('height', h);
        box.setAttribute('rx', 4);
        box.setAttribute('fill', '#15192a');
        box.setAttribute('stroke', C2.accent);
        box.setAttribute('stroke-width', '1.5');
        g.appendChild(box);
        const nm = document.createElementNS(NS, 'text');
        nm.setAttribute('x', x + w / 2); nm.setAttribute('y', y + 16);
        nm.setAttribute('text-anchor', 'middle');
        nm.setAttribute('font-family', 'monospace');
        nm.setAttribute('font-size', '11'); nm.setAttribute('font-weight', '700');
        nm.setAttribute('fill', C2.accent);
        nm.textContent = name;
        g.appendChild(nm);
        const vt = document.createElementNS(NS, 'text');
        vt.setAttribute('x', x + w / 2); vt.setAttribute('y', y + 34);
        vt.setAttribute('text-anchor', 'middle');
        vt.setAttribute('font-family', 'monospace');
        vt.setAttribute('font-size', '13'); vt.setAttribute('font-weight', '700');
        vt.setAttribute('fill', '#99a');
        vt.textContent = String(initVal);
        g.appendChild(vt);
        // Connecting stub to bus
        const stubY = (busSide === 'addr') ? [y + h, addrY] : [dataY, y];
        const stub = document.createElementNS(NS, 'line');
        stub.setAttribute('x1', x + w / 2); stub.setAttribute('y1', stubY[0]);
        stub.setAttribute('x2', x + w / 2); stub.setAttribute('y2', stubY[1]);
        stub.setAttribute('stroke', '#556'); stub.setAttribute('stroke-width', '1.5');
        g.appendChild(stub);
        refs.regBoxes[name] = box;
        refs.regVals[name] = vt;
      };
      // Address-bus-connected (top row)
      drawReg('PC',  130, 'addr', 0);
      drawReg('MAR', 340, 'addr', 0);
      drawReg('IR',  550, 'addr', 0);    // IR.operand on addr bus
      // Data-bus-connected (bottom row)
      drawReg('RAM', 180, 'data', '...');
      drawReg('IR',  340, 'data', 0);    // IR also reads data bus via II
      drawReg('A',   540, 'data', 0);
      drawReg('B',   660, 'data', 0);
      drawReg('ALU', 780, 'data', 0);

      // Seed memory display
      refs.regVals['PC'].textContent = '0x00';
      refs.regVals['MAR'].textContent = '0x00';
      refs.regVals['IR'].textContent = '0x00';
      refs.regVals['A'].textContent = '0x00';
      refs.regVals['B'].textContent = '0x00';
      refs.regVals['ALU'].textContent = '0';
      refs.regVals['RAM'].textContent = 'addr 0 = 0x1E\naddr 14 = 0x42';
      // RAM needs smaller font / multi-line
      refs.regVals['RAM'].setAttribute('font-size', '9');
      refs.regVals['RAM'].textContent = '[0]=0x1E [14]=0x42';

      // ─── Clock + T-state counter (middle) ───
      const tX = 100, tY = 395;
      const clk = document.createElementNS(NS, 'text');
      clk.setAttribute('x', tX); clk.setAttribute('y', tY);
      clk.setAttribute('font-family', 'monospace');
      clk.setAttribute('font-size', '12'); clk.setAttribute('font-weight', '700');
      clk.setAttribute('fill', '#99a');
      clk.textContent = 'CLK \u2191';
      g.appendChild(clk);
      const tStateLbl = document.createElementNS(NS, 'text');
      tStateLbl.setAttribute('x', tX + 60); tStateLbl.setAttribute('y', tY);
      tStateLbl.setAttribute('font-family', 'monospace');
      tStateLbl.setAttribute('font-size', '13'); tStateLbl.setAttribute('font-weight', '700');
      tStateLbl.setAttribute('fill', '#66ccff');
      tStateLbl.textContent = 'T-STATE:';
      g.appendChild(tStateLbl);
      const tNum = document.createElementNS(NS, 'text');
      tNum.setAttribute('x', tX + 160); tNum.setAttribute('y', tY + 2);
      tNum.setAttribute('font-family', 'monospace');
      tNum.setAttribute('font-size', '24'); tNum.setAttribute('font-weight', '700');
      tNum.setAttribute('fill', '#ffbb33');
      tNum.textContent = '0';
      g.appendChild(tNum); refs.tStateNum = tNum;

      // Pulse indicator
      const puls = document.createElementNS(NS, 'circle');
      puls.setAttribute('cx', tX + 220); puls.setAttribute('cy', tY - 6);
      puls.setAttribute('r', 6);
      puls.setAttribute('fill', '#556');
      g.appendChild(puls); refs.clockPulse = puls;

      // ─── Microcode ROM table ───
      const uY0 = 378, uH = 18;
      const uTitle = document.createElementNS(NS, 'text');
      uTitle.setAttribute('x', 340); uTitle.setAttribute('y', 395);
      uTitle.setAttribute('font-family', 'monospace');
      uTitle.setAttribute('font-size', '12'); uTitle.setAttribute('font-weight', '700');
      uTitle.setAttribute('fill', '#aa88ff');
      uTitle.textContent = 'MICROCODE ROM (LDA):';
      g.appendChild(uTitle);
      for (let i = 0; i < 4; i++) {
        const y = uY0 + (i + 1) * uH;
        const row = document.createElementNS(NS, 'rect');
        row.setAttribute('x', 340); row.setAttribute('y', y);
        row.setAttribute('width', 320); row.setAttribute('height', uH - 2);
        row.setAttribute('rx', 2);
        row.setAttribute('fill', '#15192a');
        row.setAttribute('stroke', '#334'); row.setAttribute('stroke-width', '0.6');
        g.appendChild(row);
        const lbl = document.createElementNS(NS, 'text');
        lbl.setAttribute('x', 350); lbl.setAttribute('y', y + 13);
        lbl.setAttribute('font-family', 'monospace');
        lbl.setAttribute('font-size', '11');
        lbl.setAttribute('fill', '#99a');
        lbl.textContent = 'T' + i + ':  ' + uCode[i].join(' | ');
        g.appendChild(lbl);
        refs.uCodeRows.push(row);
      }

      // ─── Control signal pins ───
      const sigY0 = 470, sigW = 42, sigH = 20;
      const sigStartX = 90;
      allSignals.forEach((s, i) => {
        const x = sigStartX + i * (sigW + 4);
        const tile = document.createElementNS(NS, 'rect');
        tile.setAttribute('x', x); tile.setAttribute('y', sigY0);
        tile.setAttribute('width', sigW); tile.setAttribute('height', sigH);
        tile.setAttribute('rx', 2);
        tile.setAttribute('fill', '#15192a');
        tile.setAttribute('stroke', '#445'); tile.setAttribute('stroke-width', '1');
        g.appendChild(tile);
        const tx = document.createElementNS(NS, 'text');
        tx.setAttribute('x', x + sigW / 2); tx.setAttribute('y', sigY0 + 14);
        tx.setAttribute('text-anchor', 'middle');
        tx.setAttribute('font-family', 'monospace');
        tx.setAttribute('font-size', '10'); tx.setAttribute('font-weight', '700');
        tx.setAttribute('fill', '#778');
        tx.textContent = s;
        g.appendChild(tx);
        refs.sigTiles[s] = { rect: tile, text: tx };
      });
      const sigLbl = document.createElementNS(NS, 'text');
      sigLbl.setAttribute('x', sigStartX); sigLbl.setAttribute('y', sigY0 - 5);
      sigLbl.setAttribute('font-family', 'monospace');
      sigLbl.setAttribute('font-size', '11'); sigLbl.setAttribute('font-weight', '700');
      sigLbl.setAttribute('fill', '#aa88ff');
      sigLbl.textContent = 'CONTROL SIGNAL BUS (lit = asserted this T-state):';
      g.appendChild(sigLbl);

      // ─── Phase description (bottom) ───
      const phTitle = document.createElementNS(NS, 'text');
      phTitle.setAttribute('x', 500); phTitle.setAttribute('y', 530);
      phTitle.setAttribute('text-anchor', 'middle');
      phTitle.setAttribute('font-family', 'monospace');
      phTitle.setAttribute('font-size', '14'); phTitle.setAttribute('font-weight', '700');
      phTitle.setAttribute('fill', '#ffbb33');
      phTitle.textContent = '';
      g.appendChild(phTitle); refs.phaseTitle = phTitle;

      const phDesc = document.createElementNS(NS, 'text');
      phDesc.setAttribute('x', 500); phDesc.setAttribute('y', 553);
      phDesc.setAttribute('text-anchor', 'middle');
      phDesc.setAttribute('font-family', 'monospace');
      phDesc.setAttribute('font-size', '11');
      phDesc.setAttribute('fill', '#bbc');
      phDesc.textContent = '';
      g.appendChild(phDesc); refs.phaseDesc = phDesc;

      const phDetail = document.createElementNS(NS, 'text');
      phDetail.setAttribute('x', 500); phDetail.setAttribute('y', 575);
      phDetail.setAttribute('text-anchor', 'middle');
      phDetail.setAttribute('font-family', 'monospace');
      phDetail.setAttribute('font-size', '11'); phDetail.setAttribute('font-style', 'italic');
      phDetail.setAttribute('fill', '#99a');
      phDetail.textContent = '';
      g.appendChild(phDetail); refs.phaseDetail = phDetail;
    });

    b.animate('lda-steps', (tMs) => {
      const perT = 2200;               // ms per T-state
      const cycleMs = perT * 4;
      const T = Math.floor((tMs % cycleMs) / perT);  // 0..3
      const tInside = (tMs % cycleMs) % perT;
      const activeSet = new Set(uCode[T]);

      // Clock pulse animation (flashes at start of each T-state)
      refs.clockPulse.setAttribute('fill', tInside < 200 ? '#fff' : '#556');

      // T-state number
      refs.tStateNum.textContent = 'T' + T;

      // Microcode ROM row highlight
      refs.uCodeRows.forEach((row, i) => {
        if (i === T) {
          row.setAttribute('fill', '#3a3010');
          row.setAttribute('stroke', '#ffbb33');
          row.setAttribute('stroke-width', '1.5');
        } else {
          row.setAttribute('fill', '#15192a');
          row.setAttribute('stroke', '#334');
          row.setAttribute('stroke-width', '0.6');
        }
      });

      // Control signal pins
      Object.entries(refs.sigTiles).forEach(([s, r]) => {
        if (activeSet.has(s)) {
          r.rect.setAttribute('fill', '#3a3010');
          r.rect.setAttribute('stroke', '#ffbb33');
          r.rect.setAttribute('stroke-width', '2');
          r.text.setAttribute('fill', '#ffbb33');
        } else {
          r.rect.setAttribute('fill', '#15192a');
          r.rect.setAttribute('stroke', '#445');
          r.rect.setAttribute('stroke-width', '1');
          r.text.setAttribute('fill', '#778');
        }
      });

      // Register + bus state driven by the T-state
      // Initial state each cycle
      let pcV = 0, marV = 0, irV = 0, aV = 0;
      let addrBusV = null, dataBusV = null;
      let addrBusActive = false, dataBusActive = false;
      let highlightReg = [];

      if (T >= 1) { pcV = 1; irV = 0x1E; marV = 0; aV = 0; }
      if (T >= 2) { marV = 0x0E; }
      if (T >= 3) { aV = 0x42; }

      if (T === 0) {
        addrBusV = pcV; dataBusV = null;
        addrBusActive = true; dataBusActive = false;
        highlightReg = ['PC', 'MAR'];
      } else if (T === 1) {
        addrBusV = 0; dataBusV = 0x1E;
        addrBusActive = true; dataBusActive = true;
        highlightReg = ['RAM', 'IR', 'PC'];
      } else if (T === 2) {
        addrBusV = 0x0E; dataBusV = null;
        addrBusActive = true; dataBusActive = false;
        highlightReg = ['IR', 'MAR'];
      } else {
        addrBusV = 0x0E; dataBusV = 0x42;
        addrBusActive = true; dataBusActive = true;
        highlightReg = ['RAM', 'A'];
      }

      // Register values
      refs.regVals['PC'].textContent  = '0x' + pcV.toString(16).toUpperCase().padStart(2, '0');
      refs.regVals['MAR'].textContent = '0x' + marV.toString(16).toUpperCase().padStart(2, '0');
      ['IR'].forEach(k => {
        refs.regVals[k].textContent = 'IR=0x' + irV.toString(16).toUpperCase().padStart(2, '0');
      });
      refs.regVals['A'].textContent = '0x' + aV.toString(16).toUpperCase().padStart(2, '0');

      // Highlight relevant registers
      Object.entries(refs.regBoxes).forEach(([name, box]) => {
        if (highlightReg.includes(name)) {
          box.setAttribute('stroke', '#ffbb33');
          box.setAttribute('stroke-width', '2.5');
          box.setAttribute('fill', '#2a2010');
        } else {
          box.setAttribute('stroke', COL.accent);
          box.setAttribute('stroke-width', '1.5');
          box.setAttribute('fill', '#15192a');
        }
      });

      // Bus colors + values
      refs.addrBusWire.setAttribute('stroke', addrBusActive ? '#66ccff' : '#888');
      refs.addrBusWire.setAttribute('stroke-width', addrBusActive ? '3' : '2');
      refs.dataBusWire.setAttribute('stroke', dataBusActive ? '#ffbb33' : '#888');
      refs.dataBusWire.setAttribute('stroke-width', dataBusActive ? '3' : '2');
      refs.addrBusVal.textContent = addrBusActive
        ? '0x' + addrBusV.toString(16).toUpperCase().padStart(2, '0')
        : '----';
      refs.addrBusVal.setAttribute('fill', addrBusActive ? '#66ccff' : '#778');
      refs.dataBusVal.textContent = dataBusActive
        ? '0x' + dataBusV.toString(16).toUpperCase().padStart(2, '0')
        : '----';
      refs.dataBusVal.setAttribute('fill', dataBusActive ? '#ffbb33' : '#778');

      // Phase text
      refs.phaseTitle.textContent  = phases[T].title;
      refs.phaseDesc.textContent   = phases[T].desc;
      refs.phaseDetail.textContent = phases[T].detail;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CONTROL SIGNALS: read and write timing.
  //  Shows the actual signals that orchestrate a cell: CLK, OE, WE,
  //  PRE\u0304, WL, SAE, CSEL, R/W, BL state, DATA bus.  Block diagram on
  //  top showing signal sources, waveforms below showing WHEN each
  //  signal fires during a READ and a WRITE cycle.
  // ═══════════════════════════════════════════════════════════════════
  function _drawReadWriteTiming(b) {
    const COL = C();

    // Signals to draw waveforms for, with their HIGH periods (in ns)
    // over a 120 ns double cycle: 0-60 ns = READ, 60-120 ns = WRITE.
    const signals = [
      { name: 'CLK',    col: '#ffffff', activeLow: false,
        highs: [[0,5],[10,15],[20,25],[30,35],[40,45],[50,55],
                [60,65],[70,75],[80,85],[90,95],[100,105],[110,115]] },
      { name: 'R/W',    col: '#ffcc55', activeLow: false,
        highs: [[0,60]] },  // HIGH = read, LOW = write
      { name: 'OE',     col: '#66ff99', activeLow: false,
        highs: [[5,55]] },   // output enable during read
      { name: 'WE',     col: '#ff6688', activeLow: false,
        highs: [[65,115]] }, // write enable during write
      { name: 'PRE\u0304', col: '#aa88ff', activeLow: true,
        // active LOW: shown as LOW when active
        highs: [[0,2],[10,60],[60,62],[70,120]] },
      { name: 'WL',     col: '#66ccff', activeLow: false,
        highs: [[15,55],[75,115]] },
      { name: 'SAE',    col: '#ffbb33', activeLow: false,
        highs: [[30,55]] }, // only during read (sense), not write
      { name: 'CSEL',   col: '#ff9966', activeLow: false,
        highs: [[40,55],[80,115]] },
      { name: 'BL',     col: '#aac', activeLow: false,
        // BL as 3-state: precharge high (VDD/2), drops on read, driven by WE on write
        highs: [[0,10],[55,65]] }, // approximation
      { name: 'DATA',   col: '#ffbb33', activeLow: false,
        highs: [[45,55],[70,110]] }, // valid windows
    ];

    const refs = { cursor: null, stateIndicators: [], modeLbl: null, phaseLbl: null };

    b.drawCustom('rw-timing', (g, NS, C2) => {
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', 60); bg.setAttribute('y', 130);
      bg.setAttribute('width', 880); bg.setAttribute('height', 420);
      bg.setAttribute('rx', 8); bg.setAttribute('fill', '#0a0f18');
      bg.setAttribute('stroke', '#1a2230'); bg.setAttribute('stroke-width', '1.2');
      g.appendChild(bg);

      // Title + mode indicator
      const title = document.createElementNS(NS, 'text');
      title.setAttribute('x', 500); title.setAttribute('y', 150);
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('font-family', 'monospace');
      title.setAttribute('font-size', '13'); title.setAttribute('font-weight', '700');
      title.setAttribute('fill', C2.edgeRise);
      title.textContent = 'Control signals for READ and WRITE \u2014 what fires WHEN';
      g.appendChild(title);

      const modeLbl = document.createElementNS(NS, 'text');
      modeLbl.setAttribute('x', 500); modeLbl.setAttribute('y', 170);
      modeLbl.setAttribute('text-anchor', 'middle');
      modeLbl.setAttribute('font-family', 'monospace');
      modeLbl.setAttribute('font-size', '14'); modeLbl.setAttribute('font-weight', '700');
      modeLbl.setAttribute('fill', '#66ff99');
      modeLbl.textContent = 'READ MODE';
      g.appendChild(modeLbl); refs.modeLbl = modeLbl;

      // ─── Block diagram on top half (compact) ───
      // CPU inputs at left
      const cpuX = 80, cpuY = 200, cpuW = 100, cpuH = 130;
      const cpuBox = document.createElementNS(NS, 'rect');
      cpuBox.setAttribute('x', cpuX); cpuBox.setAttribute('y', cpuY);
      cpuBox.setAttribute('width', cpuW); cpuBox.setAttribute('height', cpuH);
      cpuBox.setAttribute('rx', 4);
      cpuBox.setAttribute('fill', '#15192a');
      cpuBox.setAttribute('stroke', '#66ccff'); cpuBox.setAttribute('stroke-width', '1.5');
      g.appendChild(cpuBox);
      const cpuLbl = document.createElementNS(NS, 'text');
      cpuLbl.setAttribute('x', cpuX + cpuW / 2); cpuLbl.setAttribute('y', cpuY + 20);
      cpuLbl.setAttribute('text-anchor', 'middle');
      cpuLbl.setAttribute('font-family', 'monospace');
      cpuLbl.setAttribute('font-size', '12'); cpuLbl.setAttribute('font-weight', '700');
      cpuLbl.setAttribute('fill', '#66ccff');
      cpuLbl.textContent = 'CPU /';
      g.appendChild(cpuLbl);
      const cpuL2 = document.createElementNS(NS, 'text');
      cpuL2.setAttribute('x', cpuX + cpuW / 2); cpuL2.setAttribute('y', cpuY + 35);
      cpuL2.setAttribute('text-anchor', 'middle');
      cpuL2.setAttribute('font-family', 'monospace');
      cpuL2.setAttribute('font-size', '12'); cpuL2.setAttribute('font-weight', '700');
      cpuL2.setAttribute('fill', '#66ccff');
      cpuL2.textContent = 'CONTROLLER';
      g.appendChild(cpuL2);
      // list what it drives
      ['ADDR', 'R/W', 'OE', 'WE', 'CLK'].forEach((s, i) => {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', cpuX + cpuW / 2); t.setAttribute('y', cpuY + 55 + i * 14);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '10');
        t.setAttribute('fill', '#99a');
        t.textContent = s;
        g.appendChild(t);
      });

      // Timing/sequencer block
      const tsX = 260, tsY = 200, tsW = 150, tsH = 130;
      const tsBox = document.createElementNS(NS, 'rect');
      tsBox.setAttribute('x', tsX); tsBox.setAttribute('y', tsY);
      tsBox.setAttribute('width', tsW); tsBox.setAttribute('height', tsH);
      tsBox.setAttribute('rx', 4);
      tsBox.setAttribute('fill', '#15192a');
      tsBox.setAttribute('stroke', '#aa88ff'); tsBox.setAttribute('stroke-width', '1.5');
      g.appendChild(tsBox);
      const tsLbl = document.createElementNS(NS, 'text');
      tsLbl.setAttribute('x', tsX + tsW / 2); tsLbl.setAttribute('y', tsY + 20);
      tsLbl.setAttribute('text-anchor', 'middle');
      tsLbl.setAttribute('font-family', 'monospace');
      tsLbl.setAttribute('font-size', '12'); tsLbl.setAttribute('font-weight', '700');
      tsLbl.setAttribute('fill', '#aa88ff');
      tsLbl.textContent = 'TIMING';
      g.appendChild(tsLbl);
      const tsLbl2 = document.createElementNS(NS, 'text');
      tsLbl2.setAttribute('x', tsX + tsW / 2); tsLbl2.setAttribute('y', tsY + 35);
      tsLbl2.setAttribute('text-anchor', 'middle');
      tsLbl2.setAttribute('font-family', 'monospace');
      tsLbl2.setAttribute('font-size', '12'); tsLbl2.setAttribute('font-weight', '700');
      tsLbl2.setAttribute('fill', '#aa88ff');
      tsLbl2.textContent = 'SEQUENCER';
      g.appendChild(tsLbl2);
      const tsSub = document.createElementNS(NS, 'text');
      tsSub.setAttribute('x', tsX + tsW / 2); tsSub.setAttribute('y', tsY + 55);
      tsSub.setAttribute('text-anchor', 'middle');
      tsSub.setAttribute('font-family', 'monospace');
      tsSub.setAttribute('font-size', '10'); tsSub.setAttribute('font-style', 'italic');
      tsSub.setAttribute('fill', '#99a');
      tsSub.textContent = '(generates PRE\u0304, SAE)';
      g.appendChild(tsSub);
      // signal outputs from sequencer
      ['PRE\u0304', 'SAE'].forEach((s, i) => {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', tsX + tsW / 2); t.setAttribute('y', tsY + 80 + i * 14);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '10'); t.setAttribute('font-weight', '700');
        t.setAttribute('fill', '#aa88ff');
        t.textContent = s;
        g.appendChild(t);
      });

      // Decoders block (row + col)
      const dcX = 460, dcY = 200, dcW = 120, dcH = 130;
      const dcBox = document.createElementNS(NS, 'rect');
      dcBox.setAttribute('x', dcX); dcBox.setAttribute('y', dcY);
      dcBox.setAttribute('width', dcW); dcBox.setAttribute('height', dcH);
      dcBox.setAttribute('rx', 4);
      dcBox.setAttribute('fill', '#15192a');
      dcBox.setAttribute('stroke', '#ff9966'); dcBox.setAttribute('stroke-width', '1.5');
      g.appendChild(dcBox);
      const dcLbl = document.createElementNS(NS, 'text');
      dcLbl.setAttribute('x', dcX + dcW / 2); dcLbl.setAttribute('y', dcY + 22);
      dcLbl.setAttribute('text-anchor', 'middle');
      dcLbl.setAttribute('font-family', 'monospace');
      dcLbl.setAttribute('font-size', '12'); dcLbl.setAttribute('font-weight', '700');
      dcLbl.setAttribute('fill', '#ff9966');
      dcLbl.textContent = 'DECODERS';
      g.appendChild(dcLbl);
      const dcSub = document.createElementNS(NS, 'text');
      dcSub.setAttribute('x', dcX + dcW / 2); dcSub.setAttribute('y', dcY + 38);
      dcSub.setAttribute('text-anchor', 'middle');
      dcSub.setAttribute('font-family', 'monospace');
      dcSub.setAttribute('font-size', '10'); dcSub.setAttribute('font-style', 'italic');
      dcSub.setAttribute('fill', '#99a');
      dcSub.textContent = '(addr \u2192 WL + CSEL)';
      g.appendChild(dcSub);
      ['WL', 'CSEL'].forEach((s, i) => {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', dcX + dcW / 2); t.setAttribute('y', dcY + 80 + i * 14);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '11'); t.setAttribute('font-weight', '700');
        t.setAttribute('fill', s === 'WL' ? '#66ccff' : '#ff9966');
        t.textContent = s;
        g.appendChild(t);
      });

      // Memory array block
      const maX = 620, maY = 200, maW = 160, maH = 130;
      const maBox = document.createElementNS(NS, 'rect');
      maBox.setAttribute('x', maX); maBox.setAttribute('y', maY);
      maBox.setAttribute('width', maW); maBox.setAttribute('height', maH);
      maBox.setAttribute('rx', 4);
      maBox.setAttribute('fill', '#15192a');
      maBox.setAttribute('stroke', C2.accent); maBox.setAttribute('stroke-width', '1.5');
      g.appendChild(maBox);
      const maLbl = document.createElementNS(NS, 'text');
      maLbl.setAttribute('x', maX + maW / 2); maLbl.setAttribute('y', maY + 22);
      maLbl.setAttribute('text-anchor', 'middle');
      maLbl.setAttribute('font-family', 'monospace');
      maLbl.setAttribute('font-size', '12'); maLbl.setAttribute('font-weight', '700');
      maLbl.setAttribute('fill', C2.accent);
      maLbl.textContent = '8-BYTE ARRAY';
      g.appendChild(maLbl);
      // Tiny 4x4 cell grid visual inside
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 8; c++) {
          const cRect = document.createElementNS(NS, 'rect');
          cRect.setAttribute('x', maX + 12 + c * 17);
          cRect.setAttribute('y', maY + 40 + r * 18);
          cRect.setAttribute('width', 15); cRect.setAttribute('height', 16);
          cRect.setAttribute('rx', 1);
          cRect.setAttribute('fill', '#1a2230');
          cRect.setAttribute('stroke', '#334'); cRect.setAttribute('stroke-width', '0.5');
          g.appendChild(cRect);
        }
      }
      const maSub = document.createElementNS(NS, 'text');
      maSub.setAttribute('x', maX + maW / 2); maSub.setAttribute('y', maY + maH - 8);
      maSub.setAttribute('text-anchor', 'middle');
      maSub.setAttribute('font-family', 'monospace');
      maSub.setAttribute('font-size', '9'); maSub.setAttribute('font-style', 'italic');
      maSub.setAttribute('fill', '#778');
      maSub.textContent = 'cells + precharge + sense amps';
      g.appendChild(maSub);

      // Data bus output block
      const dbX = 820, dbY = 200, dbW = 100, dbH = 130;
      const dbBox = document.createElementNS(NS, 'rect');
      dbBox.setAttribute('x', dbX); dbBox.setAttribute('y', dbY);
      dbBox.setAttribute('width', dbW); dbBox.setAttribute('height', dbH);
      dbBox.setAttribute('rx', 4);
      dbBox.setAttribute('fill', '#15192a');
      dbBox.setAttribute('stroke', '#ffbb33'); dbBox.setAttribute('stroke-width', '1.5');
      g.appendChild(dbBox);
      const dbLbl = document.createElementNS(NS, 'text');
      dbLbl.setAttribute('x', dbX + dbW / 2); dbLbl.setAttribute('y', dbY + 22);
      dbLbl.setAttribute('text-anchor', 'middle');
      dbLbl.setAttribute('font-family', 'monospace');
      dbLbl.setAttribute('font-size', '12'); dbLbl.setAttribute('font-weight', '700');
      dbLbl.setAttribute('fill', '#ffbb33');
      dbLbl.textContent = 'DATA BUS';
      g.appendChild(dbLbl);
      const dbSub = document.createElementNS(NS, 'text');
      dbSub.setAttribute('x', dbX + dbW / 2); dbSub.setAttribute('y', dbY + 38);
      dbSub.setAttribute('text-anchor', 'middle');
      dbSub.setAttribute('font-family', 'monospace');
      dbSub.setAttribute('font-size', '10'); dbSub.setAttribute('font-style', 'italic');
      dbSub.setAttribute('fill', '#99a');
      dbSub.textContent = 'D7..D0';
      g.appendChild(dbSub);
      const dbArrL = document.createElementNS(NS, 'text');
      dbArrL.setAttribute('x', dbX + dbW / 2); dbArrL.setAttribute('y', dbY + 65);
      dbArrL.setAttribute('text-anchor', 'middle');
      dbArrL.setAttribute('font-family', 'monospace');
      dbArrL.setAttribute('font-size', '14'); dbArrL.setAttribute('font-weight', '700');
      dbArrL.setAttribute('fill', '#778');
      dbArrL.textContent = '\u2190 READ \u2192 WRITE';
      g.appendChild(dbArrL);

      // Signal wires between blocks (schematic-style connectors)
      const wire = (x1, y1, x2, y2, col) => {
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1);
        l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('stroke', col); l.setAttribute('stroke-width', '1.2');
        g.appendChild(l);
      };
      // CPU \u2192 TIMING + DECODERS
      wire(cpuX + cpuW, cpuY + 40, tsX, cpuY + 40, '#99a');
      wire(cpuX + cpuW, cpuY + 60, dcX, cpuY + 60, '#99a');
      // TIMING \u2192 ARRAY
      wire(tsX + tsW, tsY + 85, maX, tsY + 85, '#aa88ff');
      // DECODERS \u2192 ARRAY
      wire(dcX + dcW, dcY + 85, maX, dcY + 85, '#ff9966');
      wire(dcX + dcW, dcY + 100, maX, dcY + 100, '#ff9966');
      // ARRAY \u2192 DATA BUS (bidirectional)
      wire(maX + maW, maY + 70, dbX, maY + 70, '#ffbb33');

      // ─── TIMING WAVEFORM AREA (y = 350-580) ───
      const wvY0 = 360;
      const wvH = 18;
      const wvX0 = 180, wvX1 = 900;
      const tMax = 120;  // ns

      // Time axis ticks + labels
      for (let t = 0; t <= tMax; t += 10) {
        const x = wvX0 + (t / tMax) * (wvX1 - wvX0);
        const tk = document.createElementNS(NS, 'line');
        tk.setAttribute('x1', x); tk.setAttribute('y1', wvY0 - 8);
        tk.setAttribute('x2', x); tk.setAttribute('y2', wvY0 - 2);
        tk.setAttribute('stroke', '#445'); tk.setAttribute('stroke-width', '1');
        g.appendChild(tk);
        if (t % 20 === 0) {
          const lb = document.createElementNS(NS, 'text');
          lb.setAttribute('x', x); lb.setAttribute('y', wvY0 - 12);
          lb.setAttribute('text-anchor', 'middle');
          lb.setAttribute('font-family', 'monospace');
          lb.setAttribute('font-size', '9');
          lb.setAttribute('fill', '#778');
          lb.textContent = t + 'ns';
          g.appendChild(lb);
        }
      }
      // Read / Write zone labels
      const rMark = document.createElementNS(NS, 'text');
      rMark.setAttribute('x', wvX0 + (wvX1 - wvX0) * 0.25); rMark.setAttribute('y', wvY0 - 22);
      rMark.setAttribute('text-anchor', 'middle');
      rMark.setAttribute('font-family', 'monospace');
      rMark.setAttribute('font-size', '11'); rMark.setAttribute('font-weight', '700');
      rMark.setAttribute('fill', '#66ff99');
      rMark.textContent = '\u2190 READ CYCLE \u2192';
      g.appendChild(rMark);
      const wMark = document.createElementNS(NS, 'text');
      wMark.setAttribute('x', wvX0 + (wvX1 - wvX0) * 0.75); wMark.setAttribute('y', wvY0 - 22);
      wMark.setAttribute('text-anchor', 'middle');
      wMark.setAttribute('font-family', 'monospace');
      wMark.setAttribute('font-size', '11'); wMark.setAttribute('font-weight', '700');
      wMark.setAttribute('fill', '#ff6688');
      wMark.textContent = '\u2190 WRITE CYCLE \u2192';
      g.appendChild(wMark);

      // Vertical separator between read/write
      const sep = document.createElementNS(NS, 'line');
      const sepX = wvX0 + (wvX1 - wvX0) * 0.5;
      sep.setAttribute('x1', sepX); sep.setAttribute('y1', wvY0 - 16);
      sep.setAttribute('x2', sepX); sep.setAttribute('y2', wvY0 + signals.length * (wvH + 4) + 6);
      sep.setAttribute('stroke', '#445'); sep.setAttribute('stroke-width', '1');
      sep.setAttribute('stroke-dasharray', '2 3');
      g.appendChild(sep);

      // Draw each signal waveform
      signals.forEach((s, i) => {
        const y = wvY0 + i * (wvH + 4);
        const hiY = y + 2;
        const loY = y + wvH - 2;

        // Signal name label on left
        const nm = document.createElementNS(NS, 'text');
        nm.setAttribute('x', wvX0 - 6); nm.setAttribute('y', y + wvH - 4);
        nm.setAttribute('text-anchor', 'end');
        nm.setAttribute('font-family', 'monospace');
        nm.setAttribute('font-size', '11'); nm.setAttribute('font-weight', '700');
        nm.setAttribute('fill', s.col);
        nm.textContent = s.name + (s.activeLow ? ' (act-lo)' : '');
        g.appendChild(nm);

        // Build the waveform polyline.
        // Each "high" is a [start,end] ns range where the signal is active.
        // For active-low signals, HIGH visually means LOW value (line at hiY during inactive periods, loY during active).
        const pts = [];
        const yAt = (isActive) => {
          if (s.activeLow) return isActive ? loY : hiY;
          else              return isActive ? hiY : loY;
        };
        let curActive = false;
        let curY = yAt(false);
        pts.push([wvX0, curY]);
        const events = s.highs.slice().sort((a,b) => a[0] - b[0]);
        events.forEach(([ts, te]) => {
          const xs = wvX0 + (ts / tMax) * (wvX1 - wvX0);
          const xe = wvX0 + (te / tMax) * (wvX1 - wvX0);
          // transition up (or down for active-low)
          pts.push([xs, curY]);
          pts.push([xs, yAt(true)]);
          pts.push([xe, yAt(true)]);
          pts.push([xe, yAt(false)]);
          curY = yAt(false);
        });
        pts.push([wvX1, curY]);
        const wave = document.createElementNS(NS, 'polyline');
        wave.setAttribute('points', pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '));
        wave.setAttribute('fill', 'none');
        wave.setAttribute('stroke', s.col); wave.setAttribute('stroke-width', '2');
        g.appendChild(wave);

        // Active-state indicator (dot that turns on when signal asserted)
        const ind = document.createElementNS(NS, 'circle');
        ind.setAttribute('cx', wvX1 + 12); ind.setAttribute('cy', y + wvH / 2);
        ind.setAttribute('r', 4);
        ind.setAttribute('fill', '#1a2230');
        ind.setAttribute('stroke', s.col); ind.setAttribute('stroke-width', '1');
        g.appendChild(ind);
        refs.stateIndicators.push({ ind, sig: s });
      });

      // Time cursor (vertical line that scrubs across)
      const cur = document.createElementNS(NS, 'line');
      cur.setAttribute('x1', wvX0); cur.setAttribute('y1', wvY0 - 18);
      cur.setAttribute('x2', wvX0); cur.setAttribute('y2', wvY0 + signals.length * (wvH + 4) + 6);
      cur.setAttribute('stroke', '#fff'); cur.setAttribute('stroke-width', '1.5');
      cur.setAttribute('opacity', '0.9');
      g.appendChild(cur); refs.cursor = cur;

      // Phase caption at bottom
      const phase = document.createElementNS(NS, 'text');
      phase.setAttribute('x', 500); phase.setAttribute('y', 600);
      phase.setAttribute('text-anchor', 'middle');
      phase.setAttribute('font-family', 'monospace');
      phase.setAttribute('font-size', '12'); phase.setAttribute('font-weight', '700');
      phase.setAttribute('fill', C2.edgeRise);
      g.appendChild(phase); refs.phaseLbl = phase;
    });

    b.animate('rw-timing', (tMs) => {
      // Map real time to simulated ns (one cycle = 120 ns = 6 seconds = 6000 ms)
      const cycleMs = 6000;
      const T = tMs % cycleMs;
      const simNs = (T / cycleMs) * 120;

      // Move cursor
      const wvX0 = 180, wvX1 = 900;
      const cx = wvX0 + (simNs / 120) * (wvX1 - wvX0);
      refs.cursor.setAttribute('x1', cx);
      refs.cursor.setAttribute('x2', cx);

      // Update active-state indicators
      refs.stateIndicators.forEach(r => {
        const active = r.sig.highs.some(([a, b]) => simNs >= a && simNs <= b);
        if (active) {
          r.ind.setAttribute('fill', r.sig.col);
        } else {
          r.ind.setAttribute('fill', '#1a2230');
        }
      });

      // Mode label
      if (simNs < 60) {
        refs.modeLbl.textContent = 'READ MODE  (R/W = HIGH)';
        refs.modeLbl.setAttribute('fill', '#66ff99');
      } else {
        refs.modeLbl.textContent = 'WRITE MODE  (R/W = LOW)';
        refs.modeLbl.setAttribute('fill', '#ff6688');
      }

      // Phase caption: describe what's happening now
      let ph;
      if      (simNs <  5) ph = 'READ setup: controller asserts ADDR + OE, PRE\u0304 ends precharge';
      else if (simNs < 15) ph = 'PRECHARGE window: BL and BL\u0304 equalized to VDD/2';
      else if (simNs < 30) ph = 'WL rises (row decoder output) \u2192 cells dump tiny differential onto BLs';
      else if (simNs < 40) ph = 'SAE fires \u2192 sense amps latch differential to full rail';
      else if (simNs < 55) ph = 'CSEL rises (col decoder) \u2192 mux opens \u2192 data appears on BUS';
      else if (simNs < 60) ph = 'WL falls \u2192 cycle ends, data latched by CPU';
      else if (simNs < 65) ph = 'WRITE setup: CPU puts data on BUS, asserts ADDR + WE';
      else if (simNs < 75) ph = 'precharge (not strictly needed on write)';
      else if (simNs < 80) ph = 'WL rises, CSEL rises \u2192 write driver forces BL/BL\u0304 with new value';
      else if (simNs <115) ph = 'WE held high, data driven into cell (M5/M6 carry new value into latch)';
      else                 ph = 'WL falls \u2192 cell now stores new value \u2192 cycle ends';
      refs.phaseLbl.textContent = ph;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  HIERARCHY: 64 GB address-decode tree.
  //  Shows how a 36-bit physical address is sliced into 7 fields and
  //  routed through 7 small decoders (Channel, DIMM, Rank, Bank, Row,
  //  Column, Byte-in-burst).  The largest decoder is only 16-to-65 536
  //  \u2014 never one giant 36-to-68B decoder.
  // ═══════════════════════════════════════════════════════════════════
  function _drawAddressHierarchy(b) {
    const COL = C();

    // 7 stages with widths (input bits) and 2^width outputs.
    const stages = [
      { name: 'CHANNEL',    bits: 1,  size: 2,     color: '#ff9966' },
      { name: 'DIMM',       bits: 1,  size: 2,     color: '#ffbb33' },
      { name: 'RANK',       bits: 1,  size: 2,     color: '#ffdd55' },
      { name: 'BANK',       bits: 4,  size: 16,    color: '#aaff66' },
      { name: 'ROW',        bits: 16, size: 65536, color: '#66ccff' },
      { name: 'COLUMN',     bits: 10, size: 1024,  color: '#aa88ff' },
      { name: 'BYTE',       bits: 3,  size: 8,     color: '#ff88bb' },
    ];
    // Example address: 0x0ABCDE1234  (36 bits, split per stages above)
    // Compute slices from high bits to low
    const addr = 0x0ABCDE1234;
    const values = [];
    let shift = 36;
    for (const s of stages) {
      shift -= s.bits;
      const v = (addr >> shift) & ((1 << s.bits) - 1);
      values.push(v);
    }

    const refs = { stageRefs: [], pathPackets: [] };

    b.drawCustom('addr-hier', (g, NS, C2) => {
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', 60); bg.setAttribute('y', 130);
      bg.setAttribute('width', 880); bg.setAttribute('height', 420);
      bg.setAttribute('rx', 8); bg.setAttribute('fill', '#0a0f18');
      bg.setAttribute('stroke', '#1a2230'); bg.setAttribute('stroke-width', '1.2');
      g.appendChild(bg);

      const title = document.createElementNS(NS, 'text');
      title.setAttribute('x', 500); title.setAttribute('y', 150);
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('font-family', 'monospace');
      title.setAttribute('font-size', '13'); title.setAttribute('font-weight', '700');
      title.setAttribute('fill', C2.edgeRise);
      title.textContent = '36-bit address \u2192 7 cascading decoders \u2192 one byte in 64 GB';
      g.appendChild(title);

      // ─── 36-bit ADDRESS at top, colour-coded by field ───
      const addrY = 172, tileW = 17, tileH = 22;
      const addrStartX = 500 - (36 * tileW) / 2;
      let bitIdx = 0;
      stages.forEach((s, i) => {
        for (let b2 = 0; b2 < s.bits; b2++, bitIdx++) {
          const x = addrStartX + bitIdx * tileW;
          const tile = document.createElementNS(NS, 'rect');
          tile.setAttribute('x', x); tile.setAttribute('y', addrY);
          tile.setAttribute('width', tileW - 1); tile.setAttribute('height', tileH);
          tile.setAttribute('rx', 2);
          tile.setAttribute('fill', '#15192a');
          tile.setAttribute('stroke', s.color); tile.setAttribute('stroke-width', '1.2');
          g.appendChild(tile);
          const v = values[i];
          const bit = (v >> (s.bits - 1 - b2)) & 1;
          const tx = document.createElementNS(NS, 'text');
          tx.setAttribute('x', x + tileW / 2); tx.setAttribute('y', addrY + 16);
          tx.setAttribute('text-anchor', 'middle');
          tx.setAttribute('font-family', 'monospace');
          tx.setAttribute('font-size', '11'); tx.setAttribute('font-weight', '700');
          tx.setAttribute('fill', s.color);
          tx.textContent = String(bit);
          g.appendChild(tx);
        }
      });
      const addrHex = document.createElementNS(NS, 'text');
      addrHex.setAttribute('x', addrStartX - 8); addrHex.setAttribute('y', addrY + 16);
      addrHex.setAttribute('text-anchor', 'end');
      addrHex.setAttribute('font-family', 'monospace');
      addrHex.setAttribute('font-size', '11'); addrHex.setAttribute('font-weight', '700');
      addrHex.setAttribute('fill', '#889');
      addrHex.textContent = '0x' + addr.toString(16).toUpperCase().padStart(9, '0');
      g.appendChild(addrHex);
      // Field labels above the tiles
      let bitCursor = 0;
      stages.forEach((s, i) => {
        const fx = addrStartX + (bitCursor + s.bits / 2) * tileW;
        const lbl = document.createElementNS(NS, 'text');
        lbl.setAttribute('x', fx); lbl.setAttribute('y', addrY - 4);
        lbl.setAttribute('text-anchor', 'middle');
        lbl.setAttribute('font-family', 'monospace');
        lbl.setAttribute('font-size', '9'); lbl.setAttribute('font-weight', '700');
        lbl.setAttribute('fill', s.color);
        lbl.textContent = s.name + '(' + s.bits + ')';
        g.appendChild(lbl);
        bitCursor += s.bits;
      });

      // ─── Seven stacked decoder stages ───
      const stageY0 = 210;
      const stageH = 43;
      const decX = 280, decW = 200;
      const outX = 520;

      stages.forEach((s, i) => {
        const y = stageY0 + i * stageH;

        // Input bits tile block (shows the value in decimal)
        const inBox = document.createElementNS(NS, 'rect');
        inBox.setAttribute('x', 100); inBox.setAttribute('y', y + 4);
        inBox.setAttribute('width', 160); inBox.setAttribute('height', stageH - 8);
        inBox.setAttribute('rx', 3);
        inBox.setAttribute('fill', '#15192a');
        inBox.setAttribute('stroke', s.color); inBox.setAttribute('stroke-width', '1.5');
        g.appendChild(inBox);
        const inLbl = document.createElementNS(NS, 'text');
        inLbl.setAttribute('x', 110); inLbl.setAttribute('y', y + 18);
        inLbl.setAttribute('font-family', 'monospace');
        inLbl.setAttribute('font-size', '10'); inLbl.setAttribute('font-weight', '700');
        inLbl.setAttribute('fill', s.color);
        inLbl.textContent = s.name + '  (' + s.bits + ' bit' + (s.bits > 1 ? 's' : '') + ')';
        g.appendChild(inLbl);
        const vStr = values[i].toString(2).padStart(s.bits, '0');
        const inVal = document.createElementNS(NS, 'text');
        inVal.setAttribute('x', 110); inVal.setAttribute('y', y + 33);
        inVal.setAttribute('font-family', 'monospace');
        inVal.setAttribute('font-size', '12'); inVal.setAttribute('font-weight', '700');
        inVal.setAttribute('fill', s.color);
        inVal.textContent = vStr + ' (= ' + values[i] + ')';
        g.appendChild(inVal);

        // Decoder box
        const decBox = document.createElementNS(NS, 'rect');
        decBox.setAttribute('x', decX); decBox.setAttribute('y', y + 4);
        decBox.setAttribute('width', decW); decBox.setAttribute('height', stageH - 8);
        decBox.setAttribute('rx', 4);
        decBox.setAttribute('fill', '#1a2230');
        decBox.setAttribute('stroke', s.color); decBox.setAttribute('stroke-width', '1.8');
        g.appendChild(decBox);
        const decL1 = document.createElementNS(NS, 'text');
        decL1.setAttribute('x', decX + decW / 2); decL1.setAttribute('y', y + 20);
        decL1.setAttribute('text-anchor', 'middle');
        decL1.setAttribute('font-family', 'monospace');
        decL1.setAttribute('font-size', '12'); decL1.setAttribute('font-weight', '700');
        decL1.setAttribute('fill', s.color);
        decL1.textContent = s.bits + '-to-' + s.size + ' DECODER';
        g.appendChild(decL1);
        const gateCount = s.size <= 16 ? s.size
                        : s.size.toLocaleString();
        const decL2 = document.createElementNS(NS, 'text');
        decL2.setAttribute('x', decX + decW / 2); decL2.setAttribute('y', y + 34);
        decL2.setAttribute('text-anchor', 'middle');
        decL2.setAttribute('font-family', 'monospace');
        decL2.setAttribute('font-size', '10'); decL2.setAttribute('font-style', 'italic');
        decL2.setAttribute('fill', '#889');
        decL2.textContent = '~' + gateCount + ' outputs';
        g.appendChild(decL2);

        // Wire: input block to decoder
        const wIn = document.createElementNS(NS, 'line');
        wIn.setAttribute('x1', 260); wIn.setAttribute('y1', y + stageH / 2);
        wIn.setAttribute('x2', decX); wIn.setAttribute('y2', y + stageH / 2);
        wIn.setAttribute('stroke', s.color); wIn.setAttribute('stroke-width', '2');
        g.appendChild(wIn);
        // Slash mark for bus width
        const slash = document.createElementNS(NS, 'line');
        slash.setAttribute('x1', 268); slash.setAttribute('y1', y + stageH / 2 - 5);
        slash.setAttribute('x2', 278); slash.setAttribute('y2', y + stageH / 2 + 5);
        slash.setAttribute('stroke', s.color); slash.setAttribute('stroke-width', '1.5');
        g.appendChild(slash);
        const slashL = document.createElementNS(NS, 'text');
        slashL.setAttribute('x', 273); slashL.setAttribute('y', y + stageH / 2 - 8);
        slashL.setAttribute('text-anchor', 'middle');
        slashL.setAttribute('font-family', 'monospace');
        slashL.setAttribute('font-size', '9');
        slashL.setAttribute('fill', s.color);
        slashL.textContent = '/' + s.bits;
        g.appendChild(slashL);

        // Wire: decoder to output selection box
        const wOut = document.createElementNS(NS, 'line');
        wOut.setAttribute('x1', decX + decW); wOut.setAttribute('y1', y + stageH / 2);
        wOut.setAttribute('x2', outX);        wOut.setAttribute('y2', y + stageH / 2);
        wOut.setAttribute('stroke', s.color); wOut.setAttribute('stroke-width', '2');
        g.appendChild(wOut);

        // Output selection display
        const outBox = document.createElementNS(NS, 'rect');
        outBox.setAttribute('x', outX); outBox.setAttribute('y', y + 4);
        outBox.setAttribute('width', 300); outBox.setAttribute('height', stageH - 8);
        outBox.setAttribute('rx', 3);
        outBox.setAttribute('fill', '#15192a');
        outBox.setAttribute('stroke', s.color); outBox.setAttribute('stroke-width', '1.5');
        g.appendChild(outBox);
        const outL1 = document.createElementNS(NS, 'text');
        outL1.setAttribute('x', outX + 10); outL1.setAttribute('y', y + 20);
        outL1.setAttribute('font-family', 'monospace');
        outL1.setAttribute('font-size', '10');
        outL1.setAttribute('fill', '#889');
        outL1.textContent = 'selects 1 of ' + s.size.toLocaleString() + ':';
        g.appendChild(outL1);
        const outL2 = document.createElementNS(NS, 'text');
        outL2.setAttribute('x', outX + 10); outL2.setAttribute('y', y + 34);
        outL2.setAttribute('font-family', 'monospace');
        outL2.setAttribute('font-size', '12'); outL2.setAttribute('font-weight', '700');
        outL2.setAttribute('fill', s.color);
        let outTxt;
        if (s.name === 'CHANNEL') outTxt = '\u2192 channel ' + values[i];
        else if (s.name === 'DIMM') outTxt = '\u2192 DIMM slot ' + values[i];
        else if (s.name === 'RANK') outTxt = '\u2192 rank ' + values[i] + ' (front/back of DIMM)';
        else if (s.name === 'BANK') outTxt = '\u2192 bank ' + values[i] + ' of 16 inside chip';
        else if (s.name === 'ROW')  outTxt = '\u2192 word line #' + values[i].toLocaleString() + ' (RAS)';
        else if (s.name === 'COLUMN') outTxt = '\u2192 column #' + values[i].toLocaleString() + ' (CAS)';
        else outTxt = '\u2192 byte ' + values[i] + ' of 8-byte burst';
        outL2.textContent = outTxt;
        g.appendChild(outL2);

        // Arrow down to next stage
        if (i < stages.length - 1) {
          const arr = document.createElementNS(NS, 'path');
          arr.setAttribute('d',
            `M ${outX + 150} ${y + stageH - 4}
             L ${outX + 150} ${y + stageH + 3}
             M ${outX + 145} ${y + stageH - 2}
             L ${outX + 150} ${y + stageH + 3}
             L ${outX + 155} ${y + stageH - 2}`);
          arr.setAttribute('fill', 'none');
          arr.setAttribute('stroke', '#556'); arr.setAttribute('stroke-width', '1.5');
          g.appendChild(arr);
        }

        refs.stageRefs.push({ inBox, decBox, outBox, color: s.color });
      });

      // Footer — final result
      const sumY = stageY0 + 7 * stageH + 14;
      const sumBox = document.createElementNS(NS, 'rect');
      sumBox.setAttribute('x', 100); sumBox.setAttribute('y', sumY);
      sumBox.setAttribute('width', 800); sumBox.setAttribute('height', 30);
      sumBox.setAttribute('rx', 4);
      sumBox.setAttribute('fill', '#3a3010');
      sumBox.setAttribute('stroke', '#ffbb33'); sumBox.setAttribute('stroke-width', '1.5');
      g.appendChild(sumBox);
      const sum = document.createElementNS(NS, 'text');
      sum.setAttribute('x', 500); sum.setAttribute('y', sumY + 20);
      sum.setAttribute('text-anchor', 'middle');
      sum.setAttribute('font-family', 'monospace');
      sum.setAttribute('font-size', '12'); sum.setAttribute('font-weight', '700');
      sum.setAttribute('fill', '#ffbb33');
      sum.textContent = '2\u00B9 \u00D7 2\u00B9 \u00D7 2\u00B9 \u00D7 2\u2074 \u00D7 2\u00B9\u2076 \u00D7 2\u00B9\u2070 \u00D7 2\u00B3 = 2\u00B3\u2076 = 68,719,476,736 bytes = 64 GB';
      g.appendChild(sum);
    });

    // Animate highlights traveling down the tree
    b.animate('addr-hier', (tMs) => {
      const cycleMs = 7000;
      const T = tMs % cycleMs;
      const step = Math.floor(T / (cycleMs / stages.length));
      refs.stageRefs.forEach((sr, i) => {
        if (i <= step) {
          sr.inBox.setAttribute('fill',  '#2a3010');
          sr.decBox.setAttribute('fill', '#2a3010');
          sr.decBox.setAttribute('stroke-width', '2.5');
          sr.outBox.setAttribute('fill', '#2a3010');
        } else {
          sr.inBox.setAttribute('fill',  '#15192a');
          sr.decBox.setAttribute('fill', '#1a2230');
          sr.decBox.setAttribute('stroke-width', '1.8');
          sr.outBox.setAttribute('fill', '#15192a');
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PROPER SCHEMATIC: DRAM cell in column context (folded bit-line).
  //  BL + BL\u0304 both precharged to VDD/2 via Ppr/Pprb/Neq equalizer.
  //  Cell on BL side.  Dummy reference on BL\u0304.  Sense amp resolves.
  //  Column mux and data bus at the bottom.
  // ═══════════════════════════════════════════════════════════════════
  function _drawDRAMColumn(b) {
    const COL = C();
    const cxBL = 430, cxBLB = 600;
    const vddY = 180, wlY = 340;
    const capY = 375;
    const saTopY = 420, saBotY = 480;
    const muxY = 510;

    const refs = {
      prePmosL: null, prePmosR: null, eqN: null,
      m1: null, muxN: null,
      preLine: null, wlLine: null, wlVolt: null,
      blLine: null, blbLine: null,
      capFill: null,
      saBox: null, cselLine: null, dbusLine: null,
      phase: null,
    };

    b.drawCustom('dram-column', (g, NS, C2) => {
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', 60); bg.setAttribute('y', 130);
      bg.setAttribute('width', 880); bg.setAttribute('height', 420);
      bg.setAttribute('rx', 8); bg.setAttribute('fill', '#0a0f18');
      bg.setAttribute('stroke', '#1a2230'); bg.setAttribute('stroke-width', '1.2');
      g.appendChild(bg);

      const title = document.createElementNS(NS, 'text');
      title.setAttribute('x', 500); title.setAttribute('y', 150);
      title.setAttribute('text-anchor', 'middle');
      title.setAttribute('font-family', 'monospace');
      title.setAttribute('font-size', '12'); title.setAttribute('font-style', 'italic');
      title.setAttribute('fill', C2.accent);
      title.textContent = 'DRAM column  \u2014  PRECHARGE+EQ | CELL(1T1C)+dummy | SENSE AMP | MUX | DATA BUS';
      g.appendChild(title);

      // Row decoder
      const rdX = 80, rdW = 110, rdH = 50, rdY = wlY - rdH / 2;
      const rdBox = document.createElementNS(NS, 'rect');
      rdBox.setAttribute('x', rdX); rdBox.setAttribute('y', rdY);
      rdBox.setAttribute('width', rdW); rdBox.setAttribute('height', rdH);
      rdBox.setAttribute('rx', 4);
      rdBox.setAttribute('fill', '#15192a'); rdBox.setAttribute('stroke', '#66ccff');
      rdBox.setAttribute('stroke-width', '2');
      g.appendChild(rdBox);
      const rdL1 = document.createElementNS(NS, 'text');
      rdL1.setAttribute('x', rdX + rdW / 2); rdL1.setAttribute('y', rdY + 20);
      rdL1.setAttribute('text-anchor', 'middle');
      rdL1.setAttribute('font-family', 'monospace');
      rdL1.setAttribute('font-size', '11'); rdL1.setAttribute('font-weight', '700');
      rdL1.setAttribute('fill', '#66ccff');
      rdL1.textContent = 'ROW DECODER';
      g.appendChild(rdL1);
      const rdL2 = document.createElementNS(NS, 'text');
      rdL2.setAttribute('x', rdX + rdW / 2); rdL2.setAttribute('y', rdY + 38);
      rdL2.setAttribute('text-anchor', 'middle');
      rdL2.setAttribute('font-family', 'monospace');
      rdL2.setAttribute('font-size', '10');
      rdL2.setAttribute('fill', '#889');
      rdL2.textContent = 'output row N';
      g.appendChild(rdL2);

      const wl = document.createElementNS(NS, 'line');
      wl.setAttribute('x1', rdX + rdW); wl.setAttribute('y1', wlY);
      wl.setAttribute('x2', 420);       wl.setAttribute('y2', wlY);
      wl.setAttribute('stroke', '#66ccff'); wl.setAttribute('stroke-width', '2.5');
      g.appendChild(wl); refs.wlLine = wl;
      const wlLbl = document.createElementNS(NS, 'text');
      wlLbl.setAttribute('x', rdX + rdW + 14); wlLbl.setAttribute('y', wlY - 8);
      wlLbl.setAttribute('font-family', 'monospace');
      wlLbl.setAttribute('font-size', '12'); wlLbl.setAttribute('font-weight', '700');
      wlLbl.setAttribute('fill', '#66ccff');
      wlLbl.textContent = 'WL';
      g.appendChild(wlLbl);
      const wlV = document.createElementNS(NS, 'text');
      wlV.setAttribute('x', 260); wlV.setAttribute('y', wlY - 8);
      wlV.setAttribute('font-family', 'monospace');
      wlV.setAttribute('font-size', '11'); wlV.setAttribute('font-weight', '700');
      wlV.setAttribute('fill', '#889');
      wlV.textContent = '0 V';
      g.appendChild(wlV); refs.wlVolt = wlV;

      // VDD rail
      const vdd = document.createElementNS(NS, 'line');
      vdd.setAttribute('x1', 350); vdd.setAttribute('y1', vddY);
      vdd.setAttribute('x2', 680); vdd.setAttribute('y2', vddY);
      vdd.setAttribute('stroke', '#ffbb33'); vdd.setAttribute('stroke-width', '2.5');
      g.appendChild(vdd);
      const vddLbl = document.createElementNS(NS, 'text');
      vddLbl.setAttribute('x', 345); vddLbl.setAttribute('y', vddY + 5);
      vddLbl.setAttribute('text-anchor', 'end');
      vddLbl.setAttribute('font-family', 'monospace');
      vddLbl.setAttribute('font-size', '12'); vddLbl.setAttribute('font-weight', '700');
      vddLbl.setAttribute('fill', '#ffbb33');
      vddLbl.textContent = 'VDD';
      g.appendChild(vddLbl);

      // Precharge pair
      refs.prePmosL = _drawPMOS(g, NS, cxBL,  225, 'Ppr',  '#fdb');
      refs.prePmosR = _drawPMOS(g, NS, cxBLB, 225, 'Pprb', '#fdb');
      [cxBL, cxBLB].forEach(x => {
        const ln = document.createElementNS(NS, 'line');
        ln.setAttribute('x1', x); ln.setAttribute('y1', vddY);
        ln.setAttribute('x2', x); ln.setAttribute('y2', 199);
        ln.setAttribute('stroke', '#ffbb33'); ln.setAttribute('stroke-width', '1.5');
        g.appendChild(ln);
        _drawNodeDot(g, NS, x, vddY, '#ffbb33');
      });
      const pre = document.createElementNS(NS, 'path');
      pre.setAttribute('d',
        `M 130 225
         L ${refs.prePmosL.gate.x} 225
         M ${refs.prePmosL.gate.x} 225
         L ${refs.prePmosL.gate.x - 10} 225
         L ${refs.prePmosL.gate.x - 10} 265
         L ${refs.prePmosR.gate.x - 10} 265
         L ${refs.prePmosR.gate.x - 10} 225
         L ${refs.prePmosR.gate.x} 225`);
      pre.setAttribute('fill', 'none');
      pre.setAttribute('stroke', '#aa88ff'); pre.setAttribute('stroke-width', '2');
      g.appendChild(pre); refs.preLine = pre;
      const preLbl = document.createElementNS(NS, 'text');
      preLbl.setAttribute('x', 140); preLbl.setAttribute('y', 218);
      preLbl.setAttribute('font-family', 'monospace');
      preLbl.setAttribute('font-size', '12'); preLbl.setAttribute('font-weight', '700');
      preLbl.setAttribute('fill', '#aa88ff');
      preLbl.textContent = 'PRE\u0304';
      g.appendChild(preLbl);

      // Equalizer NMOS
      refs.eqN = _drawNMOS(g, NS, (cxBL + cxBLB) / 2, 285, 'Neq', '#bbc');
      const eqL = document.createElementNS(NS, 'path');
      eqL.setAttribute('d',
        `M ${refs.eqN.drain.x} ${refs.eqN.drain.y}
         L ${refs.eqN.drain.x} ${refs.eqN.drain.y - 10}
         L ${cxBL} ${refs.eqN.drain.y - 10}`);
      eqL.setAttribute('fill', 'none');
      eqL.setAttribute('stroke', '#aac'); eqL.setAttribute('stroke-width', '1.5');
      g.appendChild(eqL);
      _drawNodeDot(g, NS, cxBL, refs.eqN.drain.y - 10, '#aac');
      const eqR = document.createElementNS(NS, 'path');
      eqR.setAttribute('d',
        `M ${refs.eqN.source.x} ${refs.eqN.source.y}
         L ${refs.eqN.source.x} ${refs.eqN.source.y + 10}
         L ${cxBLB} ${refs.eqN.source.y + 10}`);
      eqR.setAttribute('fill', 'none');
      eqR.setAttribute('stroke', '#aac'); eqR.setAttribute('stroke-width', '1.5');
      g.appendChild(eqR);
      _drawNodeDot(g, NS, cxBLB, refs.eqN.source.y + 10, '#aac');
      const eqGate = document.createElementNS(NS, 'line');
      eqGate.setAttribute('x1', refs.eqN.gate.x); eqGate.setAttribute('y1', refs.eqN.gate.y);
      eqGate.setAttribute('x2', 210); eqGate.setAttribute('y2', refs.eqN.gate.y);
      eqGate.setAttribute('stroke', '#aa88ff'); eqGate.setAttribute('stroke-width', '1.5');
      g.appendChild(eqGate);
      const eqLbl = document.createElementNS(NS, 'text');
      eqLbl.setAttribute('x', 220); eqLbl.setAttribute('y', refs.eqN.gate.y + 4);
      eqLbl.setAttribute('font-family', 'monospace');
      eqLbl.setAttribute('font-size', '10'); eqLbl.setAttribute('font-style', 'italic');
      eqLbl.setAttribute('fill', '#aa88ff');
      eqLbl.textContent = 'EQ';
      g.appendChild(eqLbl);

      // BL, BLB
      const bl = document.createElementNS(NS, 'line');
      bl.setAttribute('x1', cxBL); bl.setAttribute('y1', 260);
      bl.setAttribute('x2', cxBL); bl.setAttribute('y2', saTopY);
      bl.setAttribute('stroke', '#aac'); bl.setAttribute('stroke-width', '2');
      g.appendChild(bl); refs.blLine = bl;
      const blb = document.createElementNS(NS, 'line');
      blb.setAttribute('x1', cxBLB); blb.setAttribute('y1', 260);
      blb.setAttribute('x2', cxBLB); blb.setAttribute('y2', saTopY);
      blb.setAttribute('stroke', '#aac'); blb.setAttribute('stroke-width', '2');
      g.appendChild(blb); refs.blbLine = blb;
      const blLbl = document.createElementNS(NS, 'text');
      blLbl.setAttribute('x', cxBL - 14); blLbl.setAttribute('y', 310);
      blLbl.setAttribute('text-anchor', 'end');
      blLbl.setAttribute('font-family', 'monospace');
      blLbl.setAttribute('font-size', '11'); blLbl.setAttribute('font-weight', '700');
      blLbl.setAttribute('fill', '#aac');
      blLbl.textContent = 'BL';
      g.appendChild(blLbl);
      const blbLbl = document.createElementNS(NS, 'text');
      blbLbl.setAttribute('x', cxBLB + 14); blbLbl.setAttribute('y', 310);
      blbLbl.setAttribute('font-family', 'monospace');
      blbLbl.setAttribute('font-size', '11'); blbLbl.setAttribute('font-weight', '700');
      blbLbl.setAttribute('fill', '#aac');
      blbLbl.textContent = 'BL\u0304 (dummy)';
      g.appendChild(blbLbl);

      // Cell on BL
      refs.m1 = _drawNMOS(g, NS, cxBL, wlY, 'M1', '#bbc');
      const m1d = document.createElementNS(NS, 'line');
      m1d.setAttribute('x1', refs.m1.drain.x); m1d.setAttribute('y1', refs.m1.drain.y);
      m1d.setAttribute('x2', cxBL); m1d.setAttribute('y2', refs.m1.drain.y - 10);
      m1d.setAttribute('stroke', '#aac'); m1d.setAttribute('stroke-width', '1.5');
      g.appendChild(m1d);
      _drawNodeDot(g, NS, cxBL, refs.m1.drain.y - 10, '#aac');
      const m1g = document.createElementNS(NS, 'line');
      m1g.setAttribute('x1', refs.m1.gate.x); m1g.setAttribute('y1', refs.m1.gate.y);
      m1g.setAttribute('x2', refs.m1.gate.x - 10); m1g.setAttribute('y2', refs.m1.gate.y);
      m1g.setAttribute('stroke', '#66ccff'); m1g.setAttribute('stroke-width', '1.5');
      g.appendChild(m1g);
      const m1s = document.createElementNS(NS, 'line');
      m1s.setAttribute('x1', refs.m1.source.x); m1s.setAttribute('y1', refs.m1.source.y);
      m1s.setAttribute('x2', refs.m1.source.x); m1s.setAttribute('y2', capY - 6);
      m1s.setAttribute('stroke', '#ddd'); m1s.setAttribute('stroke-width', '1.5');
      g.appendChild(m1s);
      const cap = _drawCapSymbol(g, NS, cxBL, capY, '#bbc');
      const fill = document.createElementNS(NS, 'rect');
      fill.setAttribute('x', cxBL - 13); fill.setAttribute('y', capY + 1);
      fill.setAttribute('width', 26); fill.setAttribute('height', 5);
      fill.setAttribute('fill', '#ffbb33');
      fill.setAttribute('opacity', '0');
      g.appendChild(fill); refs.capFill = fill;
      const csLbl = document.createElementNS(NS, 'text');
      csLbl.setAttribute('x', cxBL + 22); csLbl.setAttribute('y', capY + 6);
      csLbl.setAttribute('font-family', 'monospace');
      csLbl.setAttribute('font-size', '11'); csLbl.setAttribute('font-weight', '700');
      csLbl.setAttribute('fill', '#bbc');
      csLbl.textContent = 'Cs';
      g.appendChild(csLbl);
      const gnd = document.createElementNS(NS, 'line');
      gnd.setAttribute('x1', cxBL); gnd.setAttribute('y1', capY + 7);
      gnd.setAttribute('x2', cxBL); gnd.setAttribute('y2', capY + 28);
      gnd.setAttribute('stroke', '#889'); gnd.setAttribute('stroke-width', '1.5');
      g.appendChild(gnd);
      _drawGndSymbol(g, NS, cxBL, capY + 28, '#889');

      // Dummy label
      const dummyLbl = document.createElementNS(NS, 'text');
      dummyLbl.setAttribute('x', cxBLB); dummyLbl.setAttribute('y', capY + 4);
      dummyLbl.setAttribute('text-anchor', 'middle');
      dummyLbl.setAttribute('font-family', 'monospace');
      dummyLbl.setAttribute('font-size', '10'); dummyLbl.setAttribute('font-style', 'italic');
      dummyLbl.setAttribute('fill', '#889');
      dummyLbl.textContent = 'dummy reference';
      g.appendChild(dummyLbl);
      const dummyLbl2 = document.createElementNS(NS, 'text');
      dummyLbl2.setAttribute('x', cxBLB); dummyLbl2.setAttribute('y', capY + 20);
      dummyLbl2.setAttribute('text-anchor', 'middle');
      dummyLbl2.setAttribute('font-family', 'monospace');
      dummyLbl2.setAttribute('font-size', '10'); dummyLbl2.setAttribute('font-style', 'italic');
      dummyLbl2.setAttribute('fill', '#889');
      dummyLbl2.textContent = '(held at VDD/2)';
      g.appendChild(dummyLbl2);

      // Sense amp
      const saX1 = 380, saX2 = 650;
      const sa = document.createElementNS(NS, 'path');
      sa.setAttribute('d',
        `M ${saX1} ${saTopY}
         L ${saX2} ${saTopY}
         L ${(saX1 + saX2) / 2} ${saBotY} Z`);
      sa.setAttribute('fill', '#1a2230');
      sa.setAttribute('stroke', C2.edgeRise); sa.setAttribute('stroke-width', '2');
      g.appendChild(sa); refs.saBox = sa;
      const saLbl = document.createElementNS(NS, 'text');
      saLbl.setAttribute('x', (saX1 + saX2) / 2); saLbl.setAttribute('y', saTopY + 24);
      saLbl.setAttribute('text-anchor', 'middle');
      saLbl.setAttribute('font-family', 'monospace');
      saLbl.setAttribute('font-size', '11'); saLbl.setAttribute('font-weight', '700');
      saLbl.setAttribute('fill', C2.edgeRise);
      saLbl.textContent = 'SENSE AMP';
      g.appendChild(saLbl);
      const plus = document.createElementNS(NS, 'text');
      plus.setAttribute('x', saX1 + 20); plus.setAttribute('y', saTopY + 16);
      plus.setAttribute('font-family', 'monospace');
      plus.setAttribute('font-size', '16'); plus.setAttribute('font-weight', '700');
      plus.setAttribute('fill', '#ffbb33');
      plus.textContent = '+';
      g.appendChild(plus);
      const minus = document.createElementNS(NS, 'text');
      minus.setAttribute('x', saX2 - 20); minus.setAttribute('y', saTopY + 16);
      minus.setAttribute('text-anchor', 'end');
      minus.setAttribute('font-family', 'monospace');
      minus.setAttribute('font-size', '18'); minus.setAttribute('font-weight', '700');
      minus.setAttribute('fill', '#66ccff');
      minus.textContent = '\u2212';
      g.appendChild(minus);
      const blToSa = document.createElementNS(NS, 'line');
      blToSa.setAttribute('x1', cxBL); blToSa.setAttribute('y1', saTopY);
      blToSa.setAttribute('x2', saX1 + 20); blToSa.setAttribute('y2', saTopY);
      blToSa.setAttribute('stroke', '#aac'); blToSa.setAttribute('stroke-width', '1.5');
      g.appendChild(blToSa);
      const blbToSa = document.createElementNS(NS, 'line');
      blbToSa.setAttribute('x1', cxBLB); blbToSa.setAttribute('y1', saTopY);
      blbToSa.setAttribute('x2', saX2 - 20); blbToSa.setAttribute('y2', saTopY);
      blbToSa.setAttribute('stroke', '#aac'); blbToSa.setAttribute('stroke-width', '1.5');
      g.appendChild(blbToSa);
      const saOut = document.createElementNS(NS, 'line');
      saOut.setAttribute('x1', (saX1 + saX2) / 2); saOut.setAttribute('y1', saBotY);
      saOut.setAttribute('x2', (saX1 + saX2) / 2); saOut.setAttribute('y2', muxY - 30);
      saOut.setAttribute('stroke', '#aac'); saOut.setAttribute('stroke-width', '2');
      g.appendChild(saOut);

      // Column mux
      refs.muxN = _drawNMOS(g, NS, (saX1 + saX2) / 2, muxY, 'N_mux', '#bbc');
      const csel = document.createElementNS(NS, 'line');
      csel.setAttribute('x1', refs.muxN.gate.x); csel.setAttribute('y1', refs.muxN.gate.y);
      csel.setAttribute('x2', 830); csel.setAttribute('y2', refs.muxN.gate.y);
      csel.setAttribute('stroke', '#ffaa55'); csel.setAttribute('stroke-width', '2');
      g.appendChild(csel); refs.cselLine = csel;
      const cdW = 110, cdH = 50;
      const cdX = 830, cdY = refs.muxN.gate.y - cdH / 2;
      const cdBox = document.createElementNS(NS, 'rect');
      cdBox.setAttribute('x', cdX); cdBox.setAttribute('y', cdY);
      cdBox.setAttribute('width', cdW); cdBox.setAttribute('height', cdH);
      cdBox.setAttribute('rx', 4);
      cdBox.setAttribute('fill', '#15192a'); cdBox.setAttribute('stroke', '#ffaa55');
      cdBox.setAttribute('stroke-width', '2');
      g.appendChild(cdBox);
      const cdL1 = document.createElementNS(NS, 'text');
      cdL1.setAttribute('x', cdX + cdW / 2); cdL1.setAttribute('y', cdY + 20);
      cdL1.setAttribute('text-anchor', 'middle');
      cdL1.setAttribute('font-family', 'monospace');
      cdL1.setAttribute('font-size', '11'); cdL1.setAttribute('font-weight', '700');
      cdL1.setAttribute('fill', '#ffaa55');
      cdL1.textContent = 'COL DECODER';
      g.appendChild(cdL1);
      const cdL2 = document.createElementNS(NS, 'text');
      cdL2.setAttribute('x', cdX + cdW / 2); cdL2.setAttribute('y', cdY + 38);
      cdL2.setAttribute('text-anchor', 'middle');
      cdL2.setAttribute('font-family', 'monospace');
      cdL2.setAttribute('font-size', '10');
      cdL2.setAttribute('fill', '#889');
      cdL2.textContent = 'CSEL output';
      g.appendChild(cdL2);
      const cselLbl = document.createElementNS(NS, 'text');
      cselLbl.setAttribute('x', 820); cselLbl.setAttribute('y', refs.muxN.gate.y - 6);
      cselLbl.setAttribute('text-anchor', 'end');
      cselLbl.setAttribute('font-family', 'monospace');
      cselLbl.setAttribute('font-size', '11'); cselLbl.setAttribute('font-weight', '700');
      cselLbl.setAttribute('fill', '#ffaa55');
      cselLbl.textContent = 'CSEL';
      g.appendChild(cselLbl);
      const dbus = document.createElementNS(NS, 'line');
      dbus.setAttribute('x1', refs.muxN.source.x); dbus.setAttribute('y1', refs.muxN.source.y);
      dbus.setAttribute('x2', refs.muxN.source.x); dbus.setAttribute('y2', 550);
      dbus.setAttribute('stroke', '#aac'); dbus.setAttribute('stroke-width', '2');
      g.appendChild(dbus); refs.dbusLine = dbus;
      const dbusLbl = document.createElementNS(NS, 'text');
      dbusLbl.setAttribute('x', refs.muxN.source.x + 14); dbusLbl.setAttribute('y', 545);
      dbusLbl.setAttribute('font-family', 'monospace');
      dbusLbl.setAttribute('font-size', '12'); dbusLbl.setAttribute('font-weight', '700');
      dbusLbl.setAttribute('fill', '#aac');
      dbusLbl.textContent = 'DATA BUS \u2192';
      g.appendChild(dbusLbl);

      const phase = document.createElementNS(NS, 'text');
      phase.setAttribute('x', 500); phase.setAttribute('y', 600);
      phase.setAttribute('text-anchor', 'middle');
      phase.setAttribute('font-family', 'monospace');
      phase.setAttribute('font-size', '13'); phase.setAttribute('font-weight', '700');
      phase.setAttribute('fill', C2.edgeRise);
      g.appendChild(phase); refs.phase = phase;
    });

    b.animate('dram-column', (tMs) => {
      const cycleMs = 14000;
      const T = tMs % cycleMs;
      let preOn, wlOn, cselOn, capCharge, phase;
      if (T < 2000)        { preOn = true;  wlOn = false; cselOn = false; capCharge = 1;   phase = 'PRECHARGE + EQUALIZE: BL and BL\u0304 held at VDD/2 by Ppr/Pprb/Neq'; }
      else if (T < 4000)   { preOn = false; wlOn = true;  cselOn = false; capCharge = 0.85; phase = 'WL rises: M1 ON \u2192 Cs shares charge with BL (tiny \u2191 tilt, BL slightly > BL\u0304)'; }
      else if (T < 6000)   { preOn = false; wlOn = true;  cselOn = false; capCharge = 1;    phase = 'SENSE AMP latches: + > \u2212 \u2192 drives BL=VDD, BL\u0304=0V (refreshes Cs)'; }
      else if (T < 8000)   { preOn = false; wlOn = true;  cselOn = true;  capCharge = 1;    phase = 'CSEL HIGH \u2192 mux N_mux ON \u2192 bit drives data bus'; }
      else if (T < 9500)   { preOn = false; wlOn = false; cselOn = false; capCharge = 1;    phase = 'WL drops: M1 OFF, Cs holds \u201c1\u201d (refresh complete)'; }
      else                 { preOn = true;  wlOn = false; cselOn = false; capCharge = 1;    phase = 'back to PRECHARGE/EQ (loop)'; }

      refs.phase.textContent = phase;
      refs.preLine.setAttribute('stroke', preOn ? '#66ccff' : '#aa88ff');
      refs.prePmosL.channelEls.forEach(e => { e.setAttribute('stroke', preOn ? '#ffdd77' : '#fdb'); e.setAttribute('stroke-width', preOn ? '3' : '2'); });
      refs.prePmosR.channelEls.forEach(e => { e.setAttribute('stroke', preOn ? '#ffdd77' : '#fdb'); e.setAttribute('stroke-width', preOn ? '3' : '2'); });
      refs.eqN.channelEls.forEach(e => { e.setAttribute('stroke', preOn ? '#ffdd77' : '#bbc'); e.setAttribute('stroke-width', preOn ? '3' : '2'); });
      refs.wlLine.setAttribute('stroke', wlOn ? '#ffbb33' : '#66ccff');
      refs.wlLine.setAttribute('stroke-width', wlOn ? '3.5' : '2.5');
      refs.wlVolt.textContent = wlOn ? 'VDD' : '0 V';
      refs.wlVolt.setAttribute('fill', wlOn ? '#ffbb33' : '#889');
      refs.m1.channelEls.forEach(e => { e.setAttribute('stroke', wlOn ? '#ffdd77' : '#bbc'); e.setAttribute('stroke-width', wlOn ? '3' : '2'); });
      refs.capFill.setAttribute('opacity', capCharge.toFixed(2));
      refs.capFill.setAttribute('fill', capCharge > 0.9 ? '#ffbb33' : '#ff9944');
      const saActive = (T >= 4000 && T < 9500);
      refs.saBox.setAttribute('stroke', saActive ? '#ffbb33' : '#778');
      refs.saBox.setAttribute('stroke-width', saActive ? '3' : '2');
      refs.cselLine.setAttribute('stroke', cselOn ? '#ffbb33' : '#ffaa55');
      refs.cselLine.setAttribute('stroke-width', cselOn ? '3' : '2');
      refs.muxN.channelEls.forEach(e => { e.setAttribute('stroke', cselOn ? '#ffdd77' : '#bbc'); e.setAttribute('stroke-width', cselOn ? '3' : '2'); });
      refs.dbusLine.setAttribute('stroke', cselOn ? '#ffbb33' : '#aac');
      refs.dbusLine.setAttribute('stroke-width', cselOn ? '3' : '2');
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Silent-film — SRAM cell holding, being written, flipping state.
  //  The two cross-coupled inverters actually TOGGLE on screen.  Viewer
  //  sees the bit stored, then written, then flipped, in a loop.
  //
  //  Cycle (ms, loops every 16000):
  //      0 – 2000   idle holding 0 (Q=0, Q̄=1, doors shut)
  //   2000 – 3000   BIT drives 1, word line rises → doors open
  //   3000 – 5000   new value enters cell, cross-coupled wires flash
  //                 Q flips to 1, Q̄ flips to 0
  //   5000 – 6000   word line drops → doors shut → latched
  //   6000 – 8500   idle holding 1 (no power needed to remember)
  //   8500 – 9500   BIT drives 0, word line rises
  //   9500 – 11500  cell flips back to 0
  //  11500 – 12500  word line drops → latched
  //  12500 – 16000  idle holding 0 again → loop
  // ═══════════════════════════════════════════════════════════════════
  function _drawSRAMFilm_LEGACY_UNUSED(b) {
    const COL = C();

    // Cleaner 3-terminal layout.  Each access transistor has three VISIBLY
    // SEPARATE terminals on three different sides of its box:
    //    TOP     = source  (bit line enters from above, stops here)
    //    BOTTOM  = drain   (short vertical wire to cell node Q\u0304 / Q)
    //    SIDE    = gate    (word line passes horizontally through \u2014 gate row)
    // Bit line never visually passes "through" the transistor.  Word line
    // is clearly a separate perpendicular wire, labelled GATE.
    const cx = 500, cy = 320;
    const invAx = cx - 140, invBx = cx + 40, invW = 100, invH = 60;
    const invY = cy - 30;
    const qNodeX  = invBx + invW + 20, qNodeY  = invY + invH / 2;
    const qbNodeX = invAx - 20,        qbNodeY = invY + invH / 2;
    // Access transistors ABOVE the cell, stacked so bit line enters TOP,
    // drain exits BOTTOM, word line crosses through horizontally as gate.
    const tW = 70, tH = 70;
    const tY = 160;
    const tLx = qbNodeX - tW / 2;   // centered over Q\u0304 node x
    const tRx = qNodeX  - tW / 2;
    const wlY = tY + tH / 2;         // word line at mid-transistor (gate row)
    const blLx = tLx + tW / 2;
    const blRx = tRx + tW / 2;

    const refs = {
      qText: null, qbText: null,
      qNode: null, qbNode: null,
      invA: null, invB: null,
      crossA: null, crossB: null,
      tLbox: null, tRbox: null,
      tLglow: null, tRglow: null,
      wordLine: null, wordText: null, wordVolt: null,
      blValText: null, blbValText: null,
      blWire: null, blbWire: null,
      blVolt: null, blbVolt: null,
      gateWireL: null, gateWireR: null,
      packetsL: [], packetsR: [],
      phase: null, state: null,
    };

    b.drawCustom('sram-film', (g, NS, C2) => {
      // Background panel
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', 60); bg.setAttribute('y', 130);
      bg.setAttribute('width', 880); bg.setAttribute('height', 420);
      bg.setAttribute('rx', 8); bg.setAttribute('fill', '#0a0f18');
      bg.setAttribute('stroke', '#1a2230'); bg.setAttribute('stroke-width', '1.2');
      g.appendChild(bg);

      // ─── Inverters (drawn as triangles) ───
      const drawInv = (x, flip) => {
        const tri = document.createElementNS(NS, 'path');
        const left = x, right = x + invW, top = invY, bot = invY + invH;
        const mid = invY + invH / 2;
        const d = flip
          ? `M ${right} ${top} L ${right} ${bot} L ${left + 10} ${mid} Z`
          : `M ${left} ${top} L ${left} ${bot} L ${right - 10} ${mid} Z`;
        tri.setAttribute('d', d);
        tri.setAttribute('fill', '#1a2230');
        tri.setAttribute('stroke', C2.accent);
        tri.setAttribute('stroke-width', '2');
        g.appendChild(tri);
        const bub = document.createElementNS(NS, 'circle');
        bub.setAttribute('cx', flip ? (left + 6) : (right - 6));
        bub.setAttribute('cy', mid);
        bub.setAttribute('r', 5);
        bub.setAttribute('fill', 'none');
        bub.setAttribute('stroke', C2.accent);
        bub.setAttribute('stroke-width', '2');
        g.appendChild(bub);
        return tri;
      };
      refs.invA = drawInv(invAx, false);
      refs.invB = drawInv(invBx, true);

      // ─── Cross-couple wires ───
      // A's output (right side) → B's input (right side, looping over the top)
      const crossA = document.createElementNS(NS, 'path');
      crossA.setAttribute('d',
        `M ${invAx + invW} ${invY + invH / 2}
         L ${invBx + invW + 10} ${invY + invH / 2}
         L ${invBx + invW + 10} ${invY - 30}
         L ${invBx + invW / 2} ${invY - 30}
         L ${invBx + invW / 2} ${invY}`);
      crossA.setAttribute('fill', 'none');
      crossA.setAttribute('stroke', '#556');
      crossA.setAttribute('stroke-width', '2');
      g.appendChild(crossA); refs.crossA = crossA;

      const crossB = document.createElementNS(NS, 'path');
      crossB.setAttribute('d',
        `M ${invBx} ${invY + invH / 2}
         L ${invAx - 10} ${invY + invH / 2}
         L ${invAx - 10} ${invY + invH + 30}
         L ${invAx + invW / 2} ${invY + invH + 30}
         L ${invAx + invW / 2} ${invY + invH}`);
      crossB.setAttribute('fill', 'none');
      crossB.setAttribute('stroke', '#556');
      crossB.setAttribute('stroke-width', '2');
      g.appendChild(crossB); refs.crossB = crossB;

      // ─── Q and Q̄ value nodes (big visible circles) — labels to the SIDE
      // so they do not collide with the drain wire coming down from above.
      const drawStateNode = (x, y, label, sideDx) => {
        const glow = document.createElementNS(NS, 'circle');
        glow.setAttribute('cx', x); glow.setAttribute('cy', y);
        glow.setAttribute('r', 22);
        glow.setAttribute('fill', '#1a2230');
        glow.setAttribute('stroke', C2.accent);
        glow.setAttribute('stroke-width', '2');
        g.appendChild(glow);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x); t.setAttribute('y', y + 8);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '22'); t.setAttribute('font-weight', '700');
        t.setAttribute('fill', C2.dim);
        t.textContent = '0';
        g.appendChild(t);
        const lbl = document.createElementNS(NS, 'text');
        lbl.setAttribute('x', x + sideDx); lbl.setAttribute('y', y + 6);
        lbl.setAttribute('text-anchor', sideDx < 0 ? 'end' : 'start');
        lbl.setAttribute('font-family', 'monospace');
        lbl.setAttribute('font-size', '14'); lbl.setAttribute('font-weight', '700');
        lbl.setAttribute('fill', C2.accent);
        lbl.textContent = label;
        g.appendChild(lbl);
        return { node: glow, text: t };
      };
      const qbS = drawStateNode(qbNodeX, qbNodeY, 'Q\u0304', -32);
      refs.qbNode = qbS.node; refs.qbText = qbS.text;
      const qS  = drawStateNode(qNodeX,  qNodeY,  'Q',       32);
      refs.qNode = qS.node; refs.qText = qS.text;

      // ─── Word line (horizontal wire that PASSES THROUGH each transistor as
      // the gate terminal).  Drawn as one long line from left edge to right
      // edge \u2014 visually clear that it's ONE wire, separate from the bit
      // lines.  The transistor boxes will be drawn on top of it.
      const wl = document.createElementNS(NS, 'line');
      wl.setAttribute('x1', 100); wl.setAttribute('y1', wlY);
      wl.setAttribute('x2', 900); wl.setAttribute('y2', wlY);
      wl.setAttribute('stroke', '#555'); wl.setAttribute('stroke-width', '4');
      g.appendChild(wl); refs.wordLine = wl;
      const wlLbl = document.createElementNS(NS, 'text');
      wlLbl.setAttribute('x', 95); wlLbl.setAttribute('y', wlY - 8);
      wlLbl.setAttribute('text-anchor', 'end');
      wlLbl.setAttribute('font-family', 'monospace');
      wlLbl.setAttribute('font-size', '13'); wlLbl.setAttribute('font-weight', '700');
      wlLbl.setAttribute('fill', C2.accent);
      wlLbl.textContent = 'WORD LINE';
      g.appendChild(wlLbl);
      const wlState = document.createElementNS(NS, 'text');
      wlState.setAttribute('x', 95); wlState.setAttribute('y', wlY + 10);
      wlState.setAttribute('text-anchor', 'end');
      wlState.setAttribute('font-family', 'monospace');
      wlState.setAttribute('font-size', '13'); wlState.setAttribute('font-weight', '700');
      wlState.setAttribute('fill', '#666');
      wlState.textContent = 'LOW';
      g.appendChild(wlState); refs.wordText = wlState;
      const wlVolt = document.createElementNS(NS, 'text');
      wlVolt.setAttribute('x', 95); wlVolt.setAttribute('y', wlY + 28);
      wlVolt.setAttribute('text-anchor', 'end');
      wlVolt.setAttribute('font-family', 'monospace');
      wlVolt.setAttribute('font-size', '14'); wlVolt.setAttribute('font-weight', '700');
      wlVolt.setAttribute('fill', '#888');
      wlVolt.textContent = '0 V';
      g.appendChild(wlVolt); refs.wordVolt = wlVolt;

      // ─── Bit lines (ABOVE transistors, vertical, stop at transistor TOP) ───
      const drawBitLine = (x, label) => {
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', x); line.setAttribute('y1', 100);
        line.setAttribute('x2', x); line.setAttribute('y2', tY);
        line.setAttribute('stroke', '#555'); line.setAttribute('stroke-width', '3');
        g.appendChild(line);
        const lbl = document.createElementNS(NS, 'text');
        lbl.setAttribute('x', x); lbl.setAttribute('y', 92);
        lbl.setAttribute('text-anchor', 'middle');
        lbl.setAttribute('font-family', 'monospace');
        lbl.setAttribute('font-size', '13'); lbl.setAttribute('font-weight', '700');
        lbl.setAttribute('fill', C2.accent);
        lbl.textContent = label;
        g.appendChild(lbl);
        // Value + voltage readouts ABOVE the bit line
        const val = document.createElementNS(NS, 'text');
        val.setAttribute('x', x + 30); val.setAttribute('y', 110);
        val.setAttribute('font-family', 'monospace');
        val.setAttribute('font-size', '13'); val.setAttribute('font-weight', '700');
        val.setAttribute('fill', '#666');
        val.textContent = '— (floating)';
        g.appendChild(val);
        const volt = document.createElementNS(NS, 'text');
        volt.setAttribute('x', x + 30); volt.setAttribute('y', 128);
        volt.setAttribute('font-family', 'monospace');
        volt.setAttribute('font-size', '14'); volt.setAttribute('font-weight', '700');
        volt.setAttribute('fill', '#888');
        volt.textContent = '0 V';
        g.appendChild(volt);
        return { wire: line, val, volt };
      };
      const bl  = drawBitLine(blLx, 'BIT');
      const blb = drawBitLine(blRx, 'BIT\u0304');
      refs.blWire = bl.wire;  refs.blValText = bl.val;  refs.blVolt = bl.volt;
      refs.blbWire = blb.wire; refs.blbValText = blb.val; refs.blbVolt = blb.volt;

      // ─── Access transistors (3-terminal boxes with CLEAR labeled terminals) ───
      const drawTbox = (x, sideLabelOn) => {
        const glow = document.createElementNS(NS, 'rect');
        glow.setAttribute('x', x - 4); glow.setAttribute('y', tY - 4);
        glow.setAttribute('width', tW + 8); glow.setAttribute('height', tH + 8);
        glow.setAttribute('rx', 6);
        glow.setAttribute('fill', C2.edgeRise); glow.setAttribute('opacity', '0');
        g.appendChild(glow);
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', x); r.setAttribute('y', tY);
        r.setAttribute('width', tW); r.setAttribute('height', tH);
        r.setAttribute('rx', 4);
        r.setAttribute('fill', '#2a3040'); r.setAttribute('stroke', C2.accent);
        r.setAttribute('stroke-width', '2');
        g.appendChild(r);
        // Terminal dot on TOP (source) — where bit line enters
        const srcDot = document.createElementNS(NS, 'circle');
        srcDot.setAttribute('cx', x + tW / 2); srcDot.setAttribute('cy', tY);
        srcDot.setAttribute('r', 3);
        srcDot.setAttribute('fill', C2.accent);
        g.appendChild(srcDot);
        // Terminal dot on BOTTOM (drain) — where cell wire exits
        const drnDot = document.createElementNS(NS, 'circle');
        drnDot.setAttribute('cx', x + tW / 2); drnDot.setAttribute('cy', tY + tH);
        drnDot.setAttribute('r', 3);
        drnDot.setAttribute('fill', C2.accent);
        g.appendChild(drnDot);
        // Terminal labels — clearly 3 separate sides
        const sLbl = document.createElementNS(NS, 'text');
        sLbl.setAttribute('x', x - 4); sLbl.setAttribute('y', tY + 4);
        sLbl.setAttribute('text-anchor', 'end');
        sLbl.setAttribute('font-family', 'monospace');
        sLbl.setAttribute('font-size', '10');
        sLbl.setAttribute('fill', C2.accent); sLbl.setAttribute('opacity', '0.85');
        sLbl.textContent = 'S \u2190 bit';
        g.appendChild(sLbl);
        const dLbl = document.createElementNS(NS, 'text');
        dLbl.setAttribute('x', x - 4); dLbl.setAttribute('y', tY + tH);
        dLbl.setAttribute('text-anchor', 'end');
        dLbl.setAttribute('font-family', 'monospace');
        dLbl.setAttribute('font-size', '10');
        dLbl.setAttribute('fill', C2.accent); dLbl.setAttribute('opacity', '0.85');
        dLbl.textContent = 'D \u2192 cell';
        g.appendChild(dLbl);
        if (sideLabelOn) {
          const gLbl = document.createElementNS(NS, 'text');
          gLbl.setAttribute('x', x + tW / 2);
          gLbl.setAttribute('y', tY + tH / 2 - 14);
          gLbl.setAttribute('text-anchor', 'middle');
          gLbl.setAttribute('font-family', 'monospace');
          gLbl.setAttribute('font-size', '10'); gLbl.setAttribute('font-weight', '700');
          gLbl.setAttribute('fill', C2.edgeRise);
          gLbl.textContent = 'GATE';
          g.appendChild(gLbl);
        }
        // Name letter in the middle
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x + tW / 2); t.setAttribute('y', tY + tH / 2 + 10);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '18'); t.setAttribute('font-weight', '700');
        t.setAttribute('fill', C2.accent);
        t.textContent = 'T';
        g.appendChild(t);
        return { box: r, glow: glow };
      };
      const tL = drawTbox(tLx, true);  refs.tLbox = tL.box; refs.tLglow = tL.glow;
      const tR = drawTbox(tRx, true);  refs.tRbox = tR.box; refs.tRglow = tR.glow;

      // Drain wires — from transistor BOTTOM down to the cell node.
      // This is the ONLY connection between the transistor and the cell.
      const wDrainL = document.createElementNS(NS, 'line');
      wDrainL.setAttribute('x1', blLx); wDrainL.setAttribute('y1', tY + tH);
      wDrainL.setAttribute('x2', qbNodeX); wDrainL.setAttribute('y2', qbNodeY - 22);
      wDrainL.setAttribute('stroke', '#556'); wDrainL.setAttribute('stroke-width', '2.5');
      g.appendChild(wDrainL);
      const wDrainR = document.createElementNS(NS, 'line');
      wDrainR.setAttribute('x1', blRx); wDrainR.setAttribute('y1', tY + tH);
      wDrainR.setAttribute('x2', qNodeX); wDrainR.setAttribute('y2', qNodeY - 22);
      wDrainR.setAttribute('stroke', '#556'); wDrainR.setAttribute('stroke-width', '2.5');
      g.appendChild(wDrainR);
      refs.gateWireL = wl; refs.gateWireR = wl;  // word line itself IS the gate

      // Pre-create pools of charge packets for each bit line (hidden until active)
      for (let i = 0; i < 4; i++) {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('r', 5); c.setAttribute('opacity', '0');
        g.appendChild(c);
        refs.packetsL.push({ el: c, born: -1 });
        const c2 = document.createElementNS(NS, 'circle');
        c2.setAttribute('r', 5); c2.setAttribute('opacity', '0');
        g.appendChild(c2);
        refs.packetsR.push({ el: c2, born: -1 });
      }

      // ─── Phase + state captions ───
      const phase = document.createElementNS(NS, 'text');
      phase.setAttribute('x', 500); phase.setAttribute('y', 580);
      phase.setAttribute('text-anchor', 'middle');
      phase.setAttribute('font-family', 'monospace');
      phase.setAttribute('font-size', '14'); phase.setAttribute('font-weight', '700');
      phase.setAttribute('fill', C2.edgeRise);
      phase.textContent = '';
      g.appendChild(phase); refs.phase = phase;

      const stateCap = document.createElementNS(NS, 'text');
      stateCap.setAttribute('x', 500); stateCap.setAttribute('y', 150);
      stateCap.setAttribute('text-anchor', 'middle');
      stateCap.setAttribute('font-family', 'monospace');
      stateCap.setAttribute('font-size', '13'); stateCap.setAttribute('font-style', 'italic');
      stateCap.setAttribute('fill', C2.accent);
      stateCap.textContent = 'cross-coupled inverters \u2014 two stable states, nothing in between';
      g.appendChild(stateCap); refs.state = stateCap;
    });

    b.animate('sram-film', (tMs) => {
      const cycleMs = 16000;
      const T = tMs % cycleMs;

      // Determine state + bus drives
      let q, qb, wordHigh, blDrive, blbDrive, phase;
      if (T < 2000) {
        q = 0; qb = 1; wordHigh = false; blDrive = null; blbDrive = null;
        phase = 'idle \u2014 cell holds 0, word line low, doors shut';
      } else if (T < 3000) {
        q = 0; qb = 1; wordHigh = true; blDrive = 1; blbDrive = 0;
        phase = 'write: bit lines drive new value, word line rises';
      } else if (T < 5000) {
        // Flipping — interpolate
        const p = (T - 3000) / 2000;
        q = p > 0.5 ? 1 : 0; qb = 1 - q;
        wordHigh = true; blDrive = 1; blbDrive = 0;
        phase = 'cross-coupled feedback flips the latch \u2192 new state locks in';
      } else if (T < 6000) {
        q = 1; qb = 0; wordHigh = false; blDrive = null; blbDrive = null;
        phase = 'word line drops \u2014 doors shut, cell latched at 1';
      } else if (T < 8500) {
        q = 1; qb = 0; wordHigh = false;
        phase = 'idle \u2014 cell holds 1, no refresh needed, no power drained';
      } else if (T < 9500) {
        q = 1; qb = 0; wordHigh = true; blDrive = 0; blbDrive = 1;
        phase = 'write: bit lines drive opposite, word line rises';
      } else if (T < 11500) {
        const p = (T - 9500) / 2000;
        q = p > 0.5 ? 0 : 1; qb = 1 - q;
        wordHigh = true; blDrive = 0; blbDrive = 1;
        phase = 'latch flips back \u2192 cell now stores 0';
      } else if (T < 12500) {
        q = 0; qb = 1; wordHigh = false;
        phase = 'word line drops \u2014 latched at 0';
      } else {
        q = 0; qb = 1; wordHigh = false;
        phase = 'idle \u2014 cell holds 0 (loop)';
      }

      refs.phase.textContent = phase;

      // Word line colour + label + voltage
      if (wordHigh) {
        refs.wordLine.setAttribute('stroke', COL.edgeRise);
        refs.gateWireL.setAttribute('stroke', COL.edgeRise);
        refs.gateWireR.setAttribute('stroke', COL.edgeRise);
        refs.wordText.textContent = 'HIGH';
        refs.wordText.setAttribute('fill', COL.edgeRise);
        refs.wordVolt.textContent = '+1 V';
        refs.wordVolt.setAttribute('fill', COL.edgeRise);
        refs.tLglow.setAttribute('opacity', '0.4');
        refs.tRglow.setAttribute('opacity', '0.4');
        refs.tLbox.setAttribute('stroke', COL.edgeRise);
        refs.tRbox.setAttribute('stroke', COL.edgeRise);
        refs.tLbox.setAttribute('fill', '#3a3010');   // tint indicating conducting
        refs.tRbox.setAttribute('fill', '#3a3010');
      } else {
        refs.wordLine.setAttribute('stroke', '#555');
        refs.gateWireL.setAttribute('stroke', '#555');
        refs.gateWireR.setAttribute('stroke', '#555');
        refs.wordText.textContent = 'LOW';
        refs.wordText.setAttribute('fill', '#666');
        refs.wordVolt.textContent = '0 V';
        refs.wordVolt.setAttribute('fill', '#888');
        refs.tLglow.setAttribute('opacity', '0');
        refs.tRglow.setAttribute('opacity', '0');
        refs.tLbox.setAttribute('stroke', COL.accent);
        refs.tRbox.setAttribute('stroke', COL.accent);
        refs.tLbox.setAttribute('fill', '#2a3040');   // normal "closed" fill
        refs.tRbox.setAttribute('fill', '#2a3040');
      }

      // Bit line drives — value, colour, and explicit voltage
      const setBL = (wire, valText, voltText, drive) => {
        if (drive === null || drive === undefined) {
          wire.setAttribute('stroke', '#555');
          valText.textContent = '—';
          valText.setAttribute('fill', '#666');
          voltText.textContent = '0 V';
          voltText.setAttribute('fill', '#888');
        } else {
          const col = drive ? COL.edgeRise : '#66ccff';
          wire.setAttribute('stroke', col);
          valText.textContent = String(drive);
          valText.setAttribute('fill', col);
          voltText.textContent = drive ? '+1 V' : '0 V';
          voltText.setAttribute('fill', col);
        }
      };
      setBL(refs.blWire, refs.blValText, refs.blVolt, blDrive);
      setBL(refs.blbWire, refs.blbValText, refs.blbVolt, blbDrive);

      // Charge packets flowing DOWN the bit line, THROUGH the transistor
      // (only when word line is HIGH), into the cell interior.  Stops AT
      // the transistor top when word line is LOW \u2014 the visual answer to
      // "what does HIGH let through?"
      const animatePackets = (pool, bitX, drive) => {
        pool.forEach((p, i) => {
          if (drive === null || drive === undefined) {
            p.el.setAttribute('opacity', '0');
            p.born = -1;
            return;
          }
          if (p.born < 0) { p.born = T - i * 350; }
          const age = (T - p.born + 2000) % 2000;   // 2s loop per packet
          const fracAll = age / 2000;
          // Map fraction to Y: 170 (bit line top) \u2192 tY (transistor top)
          // If word line HIGH: continue to tY+tH (transistor bottom) \u2192 fade
          // If word line LOW: stop at tY (hit the closed gate) \u2192 fade
          const yTop = 110;          // just below bit line label
          const yTransTop = tY;       // source terminal
          const yTransBot = tY + tH;  // drain terminal
          let py;
          if (wordHigh) {
            if (fracAll < 0.70) {
              // travel from bit line top down to transistor top
              const f = fracAll / 0.70;
              py = yTop + (yTransTop - yTop) * f;
              p.el.setAttribute('opacity', '0.95');
            } else if (fracAll < 0.90) {
              // pass through the transistor channel
              const f = (fracAll - 0.70) / 0.20;
              py = yTransTop + (yTransBot - yTransTop) * f;
              p.el.setAttribute('opacity', '0.95');
            } else {
              // exit into cell, fade
              const f = (fracAll - 0.90) / 0.10;
              py = yTransBot + f * 20;
              p.el.setAttribute('opacity', (0.95 * (1 - f)).toFixed(2));
            }
          } else {
            // Word line LOW \u2014 packet stops at transistor top.
            if (fracAll < 0.70) {
              const f = fracAll / 0.70;
              py = yTop + (yTransTop - yTop) * f;
              p.el.setAttribute('opacity', '0.85');
            } else if (fracAll < 0.85) {
              // bump/pause at the closed gate
              py = yTransTop - 2;
              p.el.setAttribute('opacity', '0.85');
            } else {
              // fade out (blocked)
              const f = (fracAll - 0.85) / 0.15;
              py = yTransTop - 2;
              p.el.setAttribute('opacity', (0.85 * (1 - f)).toFixed(2));
            }
          }
          p.el.setAttribute('cx', bitX);
          p.el.setAttribute('cy', py);
          const col = drive ? COL.edgeRise : '#66ccff';
          p.el.setAttribute('fill', col);
        });
      };
      animatePackets(refs.packetsL, blLx, blDrive);
      animatePackets(refs.packetsR, blRx, blbDrive);

      // Q / Q̄ values
      refs.qText.textContent = String(q);
      refs.qText.setAttribute('fill', q ? COL.edgeRise : '#66ccff');
      refs.qNode.setAttribute('stroke', q ? COL.edgeRise : '#66ccff');
      refs.qbText.textContent = String(qb);
      refs.qbText.setAttribute('fill', qb ? COL.edgeRise : '#66ccff');
      refs.qbNode.setAttribute('stroke', qb ? COL.edgeRise : '#66ccff');

      // Cross wires flash during flip
      const flipping = (T >= 3000 && T < 5000) || (T >= 9500 && T < 11500);
      refs.crossA.setAttribute('stroke', flipping ? COL.edgeRise : '#556');
      refs.crossB.setAttribute('stroke', flipping ? COL.edgeRise : '#556');
      refs.crossA.setAttribute('stroke-width', flipping ? '3' : '2');
      refs.crossB.setAttribute('stroke-width', flipping ? '3' : '2');
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Silent-film — DRAM cell filling, leaking, refreshing.
  //  Capacitor fill level is drawn as a rising/falling liquid.  The
  //  whole story (write → hold → leak → refresh) plays in a loop.
  //
  //  Cycle (ms, loops every 20000):
  //      0 – 2000   empty cell, word line low
  //   2000 – 3500   WRITE 1: bit line HIGH, word line rises, door opens
  //   3500 – 6000   charge packets flow through into capacitor (level rises)
  //   6000 – 7000   word line drops, door shuts, cap holds full charge
  //   7000 – 14000  leak — cap level slowly bleeds down (warning glow)
  //  14000 – 15500  refresh pulse: word line rises, sense amp reads faint 1
  //  15500 – 17500  bit line driven HIGH, cap refilled
  //  17500 – 19000  word line drops, cap full again
  //  19000 – 20000  hold before next cycle → loop
  // ═══════════════════════════════════════════════════════════════════
  function _drawDRAMFilm_LEGACY_UNUSED(b) {
    const COL = C();

    // 3-terminal layout matching SRAM: BIT enters TOP, CAP wire exits
    // BOTTOM, WORD LINE enters LEFT side (the gate).  Three different
    // sides for three different signals — no shared-axis confusion.
    const cx = 500, tY = 200;
    const tW = 80, tH = 80;
    const tX = cx - tW / 2;
    const capX = cx - 50, capY = tY + tH + 60, capW = 100, capH = 130;
    const blY = tY + tH / 2;   // kept for packet reference, not for routing
    const wlX = tX - 160;      // word line starts from far left

    const refs = {
      transGlow: null, transBox: null,
      wordLine: null, wordText: null, wordVolt: null,
      blWire: null, blValText: null, blVolt: null,
      capFill: null, capLevel: null,
      topPlateVolt: null,
      packets: [],
      leakWarn: null,
      senseAmpBox: null, senseAmpText: null,
      refreshArrow: null,
      phase: null,
    };

    b.drawCustom('dram-film', (g, NS, C2) => {
      // Background
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', 60); bg.setAttribute('y', 130);
      bg.setAttribute('width', 880); bg.setAttribute('height', 420);
      bg.setAttribute('rx', 8); bg.setAttribute('fill', '#0a0f18');
      bg.setAttribute('stroke', '#1a2230'); bg.setAttribute('stroke-width', '1.2');
      g.appendChild(bg);

      // ─── Bit line (VERTICAL, enters TOP of transistor) ───
      const blL = document.createElementNS(NS, 'line');
      blL.setAttribute('x1', cx); blL.setAttribute('y1', 100);
      blL.setAttribute('x2', cx); blL.setAttribute('y2', tY);
      blL.setAttribute('stroke', '#555'); blL.setAttribute('stroke-width', '3');
      g.appendChild(blL); refs.blWire = blL;
      const blLbl = document.createElementNS(NS, 'text');
      blLbl.setAttribute('x', cx); blLbl.setAttribute('y', 92);
      blLbl.setAttribute('text-anchor', 'middle');
      blLbl.setAttribute('font-family', 'monospace');
      blLbl.setAttribute('font-size', '13'); blLbl.setAttribute('font-weight', '700');
      blLbl.setAttribute('fill', C2.accent);
      blLbl.textContent = 'BIT LINE';
      g.appendChild(blLbl);
      const blVal = document.createElementNS(NS, 'text');
      blVal.setAttribute('x', cx + 30); blVal.setAttribute('y', 120);
      blVal.setAttribute('font-family', 'monospace');
      blVal.setAttribute('font-size', '13'); blVal.setAttribute('font-weight', '700');
      blVal.setAttribute('fill', '#666');
      blVal.textContent = '— (floating)';
      g.appendChild(blVal); refs.blValText = blVal;
      const blVolt = document.createElementNS(NS, 'text');
      blVolt.setAttribute('x', cx + 30); blVolt.setAttribute('y', 138);
      blVolt.setAttribute('font-family', 'monospace');
      blVolt.setAttribute('font-size', '14'); blVolt.setAttribute('font-weight', '700');
      blVolt.setAttribute('fill', '#888');
      blVolt.textContent = '0 V';
      g.appendChild(blVolt); refs.blVolt = blVolt;

      // ─── Word line (HORIZONTAL, enters LEFT side of transistor as GATE) ───
      const wl = document.createElementNS(NS, 'line');
      wl.setAttribute('x1', wlX); wl.setAttribute('y1', tY + tH / 2);
      wl.setAttribute('x2', tX);  wl.setAttribute('y2', tY + tH / 2);
      wl.setAttribute('stroke', '#555'); wl.setAttribute('stroke-width', '4');
      g.appendChild(wl); refs.wordLine = wl;
      const wlLbl = document.createElementNS(NS, 'text');
      wlLbl.setAttribute('x', wlX - 6); wlLbl.setAttribute('y', tY + tH / 2 - 8);
      wlLbl.setAttribute('text-anchor', 'end');
      wlLbl.setAttribute('font-family', 'monospace');
      wlLbl.setAttribute('font-size', '13'); wlLbl.setAttribute('font-weight', '700');
      wlLbl.setAttribute('fill', C2.accent);
      wlLbl.textContent = 'WORD LINE';
      g.appendChild(wlLbl);
      const wlState = document.createElementNS(NS, 'text');
      wlState.setAttribute('x', wlX - 6); wlState.setAttribute('y', tY + tH / 2 + 10);
      wlState.setAttribute('text-anchor', 'end');
      wlState.setAttribute('font-family', 'monospace');
      wlState.setAttribute('font-size', '13'); wlState.setAttribute('font-weight', '700');
      wlState.setAttribute('fill', '#666');
      wlState.textContent = 'LOW';
      g.appendChild(wlState); refs.wordText = wlState;
      const wlVolt = document.createElementNS(NS, 'text');
      wlVolt.setAttribute('x', wlX - 6); wlVolt.setAttribute('y', tY + tH / 2 + 28);
      wlVolt.setAttribute('text-anchor', 'end');
      wlVolt.setAttribute('font-family', 'monospace');
      wlVolt.setAttribute('font-size', '14'); wlVolt.setAttribute('font-weight', '700');
      wlVolt.setAttribute('fill', '#888');
      wlVolt.textContent = '0 V';
      g.appendChild(wlVolt); refs.wordVolt = wlVolt;

      // ─── Transistor (3 clearly-labeled terminals: source top, drain bottom, gate left) ───
      const tGlow = document.createElementNS(NS, 'rect');
      tGlow.setAttribute('x', tX - 4); tGlow.setAttribute('y', tY - 4);
      tGlow.setAttribute('width', tW + 8); tGlow.setAttribute('height', tH + 8);
      tGlow.setAttribute('rx', 8);
      tGlow.setAttribute('fill', C2.edgeRise);
      tGlow.setAttribute('opacity', '0');
      g.appendChild(tGlow); refs.transGlow = tGlow;
      const tBox = document.createElementNS(NS, 'rect');
      tBox.setAttribute('x', tX); tBox.setAttribute('y', tY);
      tBox.setAttribute('width', tW); tBox.setAttribute('height', tH);
      tBox.setAttribute('rx', 6);
      tBox.setAttribute('fill', '#2a3040'); tBox.setAttribute('stroke', C2.accent);
      tBox.setAttribute('stroke-width', '2');
      g.appendChild(tBox); refs.transBox = tBox;
      // Terminal dots (source top, drain bottom)
      const srcDot = document.createElementNS(NS, 'circle');
      srcDot.setAttribute('cx', cx); srcDot.setAttribute('cy', tY);
      srcDot.setAttribute('r', 4); srcDot.setAttribute('fill', C2.accent);
      g.appendChild(srcDot);
      const drnDot = document.createElementNS(NS, 'circle');
      drnDot.setAttribute('cx', cx); drnDot.setAttribute('cy', tY + tH);
      drnDot.setAttribute('r', 4); drnDot.setAttribute('fill', C2.accent);
      g.appendChild(drnDot);
      // Terminal side labels
      const sLbl = document.createElementNS(NS, 'text');
      sLbl.setAttribute('x', cx + 8); sLbl.setAttribute('y', tY + 6);
      sLbl.setAttribute('font-family', 'monospace');
      sLbl.setAttribute('font-size', '10');
      sLbl.setAttribute('fill', C2.accent); sLbl.setAttribute('opacity', '0.85');
      sLbl.textContent = 'S \u2190 bit';
      g.appendChild(sLbl);
      const dLbl = document.createElementNS(NS, 'text');
      dLbl.setAttribute('x', cx + 8); dLbl.setAttribute('y', tY + tH - 2);
      dLbl.setAttribute('font-family', 'monospace');
      dLbl.setAttribute('font-size', '10');
      dLbl.setAttribute('fill', C2.accent); dLbl.setAttribute('opacity', '0.85');
      dLbl.textContent = 'D \u2192 cap';
      g.appendChild(dLbl);
      const gLbl = document.createElementNS(NS, 'text');
      gLbl.setAttribute('x', tX + 6); gLbl.setAttribute('y', tY + tH / 2 + 4);
      gLbl.setAttribute('font-family', 'monospace');
      gLbl.setAttribute('font-size', '10'); gLbl.setAttribute('font-weight', '700');
      gLbl.setAttribute('fill', C2.edgeRise);
      gLbl.textContent = 'GATE';
      g.appendChild(gLbl);
      const tLbl = document.createElementNS(NS, 'text');
      tLbl.setAttribute('x', tX + tW - 10); tLbl.setAttribute('y', tY + tH / 2 + 7);
      tLbl.setAttribute('text-anchor', 'end');
      tLbl.setAttribute('font-family', 'monospace');
      tLbl.setAttribute('font-size', '20'); tLbl.setAttribute('font-weight', '700');
      tLbl.setAttribute('fill', C2.accent);
      tLbl.textContent = 'T';
      g.appendChild(tLbl);

      // ─── Capacitor (drawn as a tank) ───
      // Wire from transistor bottom down to cap top
      const wDown = document.createElementNS(NS, 'line');
      wDown.setAttribute('x1', cx); wDown.setAttribute('y1', tY + tH);
      wDown.setAttribute('x2', cx); wDown.setAttribute('y2', capY);
      wDown.setAttribute('stroke', '#556'); wDown.setAttribute('stroke-width', '2');
      g.appendChild(wDown);

      // Cap body (outline)
      const capBody = document.createElementNS(NS, 'rect');
      capBody.setAttribute('x', capX); capBody.setAttribute('y', capY);
      capBody.setAttribute('width', capW); capBody.setAttribute('height', capH);
      capBody.setAttribute('rx', 8);
      capBody.setAttribute('fill', '#15192a');
      capBody.setAttribute('stroke', C2.accent); capBody.setAttribute('stroke-width', '2');
      g.appendChild(capBody);

      // Cap fill (charge level — height animated)
      const capFill = document.createElementNS(NS, 'rect');
      capFill.setAttribute('x', capX + 4); capFill.setAttribute('y', capY + capH - 4);
      capFill.setAttribute('width', capW - 8); capFill.setAttribute('height', 0);
      capFill.setAttribute('fill', C2.edgeRise);
      capFill.setAttribute('opacity', '0.75');
      g.appendChild(capFill); refs.capFill = capFill;

      // Cap label
      const capLbl = document.createElementNS(NS, 'text');
      capLbl.setAttribute('x', cx); capLbl.setAttribute('y', capY - 32);
      capLbl.setAttribute('text-anchor', 'middle');
      capLbl.setAttribute('font-family', 'monospace');
      capLbl.setAttribute('font-size', '13'); capLbl.setAttribute('font-weight', '700');
      capLbl.setAttribute('fill', C2.accent);
      capLbl.textContent = 'CAPACITOR (the bit)';
      g.appendChild(capLbl);

      // Explicit plate labels — this is what the narration talks about.
      const topPlateLbl = document.createElementNS(NS, 'text');
      topPlateLbl.setAttribute('x', capX - 8); topPlateLbl.setAttribute('y', capY + 14);
      topPlateLbl.setAttribute('text-anchor', 'end');
      topPlateLbl.setAttribute('font-family', 'monospace');
      topPlateLbl.setAttribute('font-size', '11'); topPlateLbl.setAttribute('font-style', 'italic');
      topPlateLbl.setAttribute('fill', C2.accent);
      topPlateLbl.textContent = 'top plate \u2192 transistor';
      g.appendChild(topPlateLbl);
      const botPlateLbl = document.createElementNS(NS, 'text');
      botPlateLbl.setAttribute('x', capX - 8); botPlateLbl.setAttribute('y', capY + capH - 4);
      botPlateLbl.setAttribute('text-anchor', 'end');
      botPlateLbl.setAttribute('font-family', 'monospace');
      botPlateLbl.setAttribute('font-size', '11'); botPlateLbl.setAttribute('font-style', 'italic');
      botPlateLbl.setAttribute('fill', '#888');
      botPlateLbl.textContent = 'bottom plate \u2192 GND';
      g.appendChild(botPlateLbl);

      // Voltage readout on the top plate (tracks charge level)
      const topPlateV = document.createElementNS(NS, 'text');
      topPlateV.setAttribute('x', cx + capW / 2 + 20); topPlateV.setAttribute('y', capY + 14);
      topPlateV.setAttribute('font-family', 'monospace');
      topPlateV.setAttribute('font-size', '14'); topPlateV.setAttribute('font-weight', '700');
      topPlateV.setAttribute('fill', '#888');
      topPlateV.textContent = 'V = 0.00 V';
      g.appendChild(topPlateV); refs.topPlateVolt = topPlateV;

      const capLvl = document.createElementNS(NS, 'text');
      capLvl.setAttribute('x', cx + capW / 2 + 20); capLvl.setAttribute('y', capY + capH / 2 + 5);
      capLvl.setAttribute('font-family', 'monospace');
      capLvl.setAttribute('font-size', '18'); capLvl.setAttribute('font-weight', '700');
      capLvl.setAttribute('fill', '#666');
      capLvl.textContent = '0%';
      g.appendChild(capLvl); refs.capLevel = capLvl;

      // Ground below cap
      const gndW = document.createElementNS(NS, 'line');
      gndW.setAttribute('x1', cx); gndW.setAttribute('y1', capY + capH);
      gndW.setAttribute('x2', cx); gndW.setAttribute('y2', capY + capH + 20);
      gndW.setAttribute('stroke', '#556'); gndW.setAttribute('stroke-width', '2');
      g.appendChild(gndW);
      const gndH = document.createElementNS(NS, 'line');
      gndH.setAttribute('x1', cx - 24); gndH.setAttribute('y1', capY + capH + 20);
      gndH.setAttribute('x2', cx + 24); gndH.setAttribute('y2', capY + capH + 20);
      gndH.setAttribute('stroke', '#888'); gndH.setAttribute('stroke-width', '3');
      g.appendChild(gndH);
      const gndLbl = document.createElementNS(NS, 'text');
      gndLbl.setAttribute('x', cx + 30); gndLbl.setAttribute('y', capY + capH + 26);
      gndLbl.setAttribute('font-family', 'monospace');
      gndLbl.setAttribute('font-size', '11'); gndLbl.setAttribute('font-weight', '700');
      gndLbl.setAttribute('fill', '#888');
      gndLbl.textContent = 'GND (0 V)';
      g.appendChild(gndLbl);

      // ─── Pre-create charge packets (hidden until active) ───
      for (let i = 0; i < 10; i++) {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('r', 5); c.setAttribute('fill', C2.edgeRise);
        c.setAttribute('opacity', '0');
        g.appendChild(c);
        refs.packets.push({ el: c, born: -1, dir: 'in' });
      }

      // ─── Leak warning ───
      const warn = document.createElementNS(NS, 'text');
      warn.setAttribute('x', cx); warn.setAttribute('y', capY + capH + 50);
      warn.setAttribute('text-anchor', 'middle');
      warn.setAttribute('font-family', 'monospace');
      warn.setAttribute('font-size', '14'); warn.setAttribute('font-weight', '700');
      warn.setAttribute('fill', '#ff5533');
      warn.setAttribute('opacity', '0');
      warn.textContent = 'charge leaking \u2014 if not refreshed, the 1 becomes 0';
      g.appendChild(warn); refs.leakWarn = warn;

      // ─── Sense amp / refresh controller (appears during refresh) ───
      const saBox = document.createElementNS(NS, 'rect');
      saBox.setAttribute('x', 760); saBox.setAttribute('y', blY - 30);
      saBox.setAttribute('width', 110); saBox.setAttribute('height', 60);
      saBox.setAttribute('rx', 6);
      saBox.setAttribute('fill', '#1a2230');
      saBox.setAttribute('stroke', '#556'); saBox.setAttribute('stroke-width', '1.5');
      saBox.setAttribute('opacity', '0');
      g.appendChild(saBox); refs.senseAmpBox = saBox;
      const saLbl = document.createElementNS(NS, 'text');
      saLbl.setAttribute('x', 815); saLbl.setAttribute('y', blY - 8);
      saLbl.setAttribute('text-anchor', 'middle');
      saLbl.setAttribute('font-family', 'monospace');
      saLbl.setAttribute('font-size', '12'); saLbl.setAttribute('font-weight', '700');
      saLbl.setAttribute('fill', C2.edgeRise);
      saLbl.setAttribute('opacity', '0');
      saLbl.textContent = 'SENSE / REWRITE';
      g.appendChild(saLbl); refs.senseAmpText = saLbl;

      // ─── Phase caption ───
      const phase = document.createElementNS(NS, 'text');
      phase.setAttribute('x', 500); phase.setAttribute('y', 580);
      phase.setAttribute('text-anchor', 'middle');
      phase.setAttribute('font-family', 'monospace');
      phase.setAttribute('font-size', '14'); phase.setAttribute('font-weight', '700');
      phase.setAttribute('fill', C2.edgeRise);
      g.appendChild(phase); refs.phase = phase;
    });

    b.animate('dram-film', (tMs) => {
      const cycleMs = 20000;
      const T = tMs % cycleMs;

      let wordHigh, blDrive, charge, phase, tOpen;

      if (T < 2000) {
        wordHigh = false; blDrive = null; charge = 0;
        phase = 'empty cell \u2014 about to write a 1'; tOpen = false;
      } else if (T < 3500) {
        wordHigh = true; blDrive = 1; charge = 0;
        phase = 'write: bit line HIGH, word line rises \u2192 door opens';
        tOpen = true;
      } else if (T < 6000) {
        const p = (T - 3500) / 2500;
        wordHigh = true; blDrive = 1; charge = p;
        phase = 'charge flows through transistor \u2192 capacitor fills up';
        tOpen = true;
      } else if (T < 7000) {
        wordHigh = false; blDrive = null; charge = 1;
        phase = 'door shuts \u2014 capacitor holds a full 1';
        tOpen = false;
      } else if (T < 14000) {
        const p = (T - 7000) / 7000;
        wordHigh = false; blDrive = null; charge = 1 - p * 0.65;
        phase = 'leak \u2014 charge slowly bleeds out through the transistor';
        tOpen = false;
      } else if (T < 15500) {
        wordHigh = true; blDrive = null; charge = 0.35;
        phase = 'refresh pulse \u2014 word line rises, sense amp reads faint 1';
        tOpen = true;
      } else if (T < 17500) {
        const p = (T - 15500) / 2000;
        wordHigh = true; blDrive = 1; charge = 0.35 + p * 0.65;
        phase = 'rewrite: bit line HIGH again \u2192 capacitor refilled';
        tOpen = true;
      } else if (T < 19000) {
        wordHigh = false; blDrive = null; charge = 1;
        phase = 'refreshed \u2014 cell holds 1 again. cycle repeats forever.';
        tOpen = false;
      } else {
        wordHigh = false; blDrive = null; charge = 1;
        phase = 'next leak-refresh cycle \u2014 every ~64 ms, every cell, always';
        tOpen = false;
      }

      refs.phase.textContent = phase;

      // Word line visual + voltage
      if (wordHigh) {
        refs.wordLine.setAttribute('stroke', COL.edgeRise);
        refs.wordText.textContent = 'HIGH';
        refs.wordText.setAttribute('fill', COL.edgeRise);
        refs.wordVolt.textContent = '+1 V';
        refs.wordVolt.setAttribute('fill', COL.edgeRise);
        refs.transGlow.setAttribute('opacity', '0.35');
        refs.transBox.setAttribute('stroke', COL.edgeRise);
        refs.transBox.setAttribute('fill', '#3a3010');  // conducting tint
      } else {
        refs.wordLine.setAttribute('stroke', '#555');
        refs.wordText.textContent = 'LOW';
        refs.wordText.setAttribute('fill', '#666');
        refs.wordVolt.textContent = '0 V';
        refs.wordVolt.setAttribute('fill', '#888');
        refs.transGlow.setAttribute('opacity', '0');
        refs.transBox.setAttribute('stroke', COL.accent);
        refs.transBox.setAttribute('fill', '#2a3040');
      }

      // Bit line visual + voltage
      if (blDrive === 1) {
        refs.blWire.setAttribute('stroke', COL.edgeRise);
        refs.blValText.textContent = 'drive 1';
        refs.blValText.setAttribute('fill', COL.edgeRise);
        refs.blVolt.textContent = '+1 V';
        refs.blVolt.setAttribute('fill', COL.edgeRise);
      } else if (blDrive === 0) {
        refs.blWire.setAttribute('stroke', '#66ccff');
        refs.blValText.textContent = 'drive 0';
        refs.blValText.setAttribute('fill', '#66ccff');
        refs.blVolt.textContent = '0 V';
        refs.blVolt.setAttribute('fill', '#66ccff');
      } else {
        refs.blWire.setAttribute('stroke', '#555');
        refs.blValText.textContent = '— (floating)';
        refs.blValText.setAttribute('fill', '#666');
        refs.blVolt.textContent = '—';
        refs.blVolt.setAttribute('fill', '#888');
      }

      // Capacitor fill + top plate voltage (top plate voltage tracks charge)
      const fillH = (capH - 8) * charge;
      refs.capFill.setAttribute('y', capY + capH - 4 - fillH);
      refs.capFill.setAttribute('height', fillH);
      const fillColor = charge > 0.7 ? COL.edgeRise
                       : (charge > 0.35 ? '#ff9944' : '#ff5533');
      refs.capFill.setAttribute('fill', fillColor);
      refs.capLevel.textContent = Math.round(charge * 100) + '%';
      refs.capLevel.setAttribute('fill', fillColor);
      refs.topPlateVolt.textContent = 'V = ' + charge.toFixed(2) + ' V';
      refs.topPlateVolt.setAttribute('fill', fillColor);

      // Leak warning during the leak phase
      const leaking = (T >= 8000 && T < 14000);
      refs.leakWarn.setAttribute('opacity', leaking ? '0.85' : '0');

      // Sense amp visible during refresh phase
      const refreshing = (T >= 14000 && T < 17500);
      refs.senseAmpBox.setAttribute('opacity', refreshing ? '0.9' : '0');
      refs.senseAmpText.setAttribute('opacity', refreshing ? '1' : '0');

      // Charge packets flowing DOWN the bit line, THROUGH the transistor,
      // into the capacitor.  With the new layout: bit line enters TOP of
      // transistor, cap wire exits BOTTOM — pure vertical flow at x = cx.
      const packetsActive = tOpen && blDrive === 1;
      refs.packets.forEach((p, i) => {
        if (packetsActive) {
          if (p.born < 0) { p.born = T + i * 250; p.dir = 'in'; }
          const age = T - p.born;
          const travel = 1500;
          if (age < 0 || age > travel) {
            p.el.setAttribute('opacity', '0');
            if (age > travel) p.born = T + i * 250;
          } else {
            const f = age / travel;
            // vertical path: bit-line-top \u2192 through transistor \u2192 cap top
            const yStart = 110;
            const yEnd   = capY + capH - fillH;
            p.el.setAttribute('cx', cx);
            p.el.setAttribute('cy', yStart + f * (yEnd - yStart));
            p.el.setAttribute('fill', COL.edgeRise);
            p.el.setAttribute('opacity', '1');
          }
        } else if (leaking && i < 3) {
          // Leak packets drift UP out of the cap through the transistor.
          const age = (T + i * 1200) % 3500;
          const f = age / 3500;
          const yStart = capY + capH - fillH;
          const yEnd   = tY - 10;  // fade above transistor
          p.el.setAttribute('cx', cx);
          p.el.setAttribute('cy', yStart - f * (yStart - yEnd));
          p.el.setAttribute('fill', '#ff9944');
          p.el.setAttribute('opacity', (0.6 * (1 - f)).toFixed(2));
        } else {
          p.el.setAttribute('opacity', '0');
          p.born = -1;
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Silent-film — address split into row + column, decoders fire,
  //  one cell lights up at the intersection.  Loops through several
  //  different addresses so viewer sees the pattern.
  //
  //  Cycle (ms, loops every 6000, new address each cycle):
  //      0 – 1500   address bits appear on the top pins
  //   1500 – 2500   upper half flies up to row decoder, lower half flies
  //                 down to column decoder (two coloured streams)
  //   2500 – 3500   row decoder lights up ONE row horizontally
  //   3500 – 4500   column decoder lights up ONE column vertically
  //   4500 – 6000   intersection cell glows bright → hold → fade for next
  // ═══════════════════════════════════════════════════════════════════
  function _drawAddressingFilm(b) {
    const COL = C();

    const rows = 8, cols = 8;
    const cellSz = 36, gap = 3;
    const gridX = 360, gridY = 240;
    const gridW = cols * (cellSz + gap);
    const gridH = rows * (cellSz + gap);

    // Cycle through these addresses (row, col)
    const addresses = [
      [3, 5], [6, 2], [1, 7], [5, 1], [2, 4], [7, 6],
    ];

    const refs = {
      addrBits: [],        // 6 bit tiles at top
      upperStream: [],     // pool of moving dots for upper bits
      lowerStream: [],     // pool of moving dots for lower bits
      rowDec: [], colDec: [],
      cells: [],           // 2D array of rects
      cellGlow: null,      // overlay ring for the target cell
      phase: null,
      addrValueText: null,
    };

    b.drawCustom('addr-film', (g, NS, C2) => {
      // Background
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', 60); bg.setAttribute('y', 130);
      bg.setAttribute('width', 880); bg.setAttribute('height', 420);
      bg.setAttribute('rx', 8); bg.setAttribute('fill', '#0a0f18');
      bg.setAttribute('stroke', '#1a2230'); bg.setAttribute('stroke-width', '1.2');
      g.appendChild(bg);

      // ─── Address bits at top (6 tiles) ───
      const abX0 = 300, abY = 155, abW = 40, abGap = 6;
      for (let i = 0; i < 6; i++) {
        const x = abX0 + i * (abW + abGap);
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', x); r.setAttribute('y', abY);
        r.setAttribute('width', abW); r.setAttribute('height', 36);
        r.setAttribute('rx', 4);
        r.setAttribute('fill', '#15192a');
        r.setAttribute('stroke', i < 3 ? '#66ccff' : C2.edgeRise);
        r.setAttribute('stroke-width', '1.8');
        g.appendChild(r);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x + abW / 2); t.setAttribute('y', abY + 26);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '22'); t.setAttribute('font-weight', '700');
        t.setAttribute('fill', i < 3 ? '#66ccff' : C2.edgeRise);
        t.textContent = '0';
        g.appendChild(t);
        refs.addrBits.push({ rect: r, text: t, x: x + abW / 2, isRow: i < 3 });
      }
      // Group labels
      const rowGrp = document.createElementNS(NS, 'text');
      rowGrp.setAttribute('x', abX0 + 3 * (abW + abGap) / 2 - abGap / 2);
      rowGrp.setAttribute('y', abY - 12);
      rowGrp.setAttribute('text-anchor', 'middle');
      rowGrp.setAttribute('font-family', 'monospace');
      rowGrp.setAttribute('font-size', '12'); rowGrp.setAttribute('font-weight', '700');
      rowGrp.setAttribute('fill', '#66ccff');
      rowGrp.textContent = 'upper 3 bits  \u2192  ROW';
      g.appendChild(rowGrp);
      const colGrp = document.createElementNS(NS, 'text');
      colGrp.setAttribute('x', abX0 + 3 * (abW + abGap) + 3 * (abW + abGap) / 2 - abGap / 2);
      colGrp.setAttribute('y', abY - 12);
      colGrp.setAttribute('text-anchor', 'middle');
      colGrp.setAttribute('font-family', 'monospace');
      colGrp.setAttribute('font-size', '12'); colGrp.setAttribute('font-weight', '700');
      colGrp.setAttribute('fill', C2.edgeRise);
      colGrp.textContent = 'lower 3 bits  \u2192  COLUMN';
      g.appendChild(colGrp);

      // Address as decimal (for readability)
      const addrTxt = document.createElementNS(NS, 'text');
      addrTxt.setAttribute('x', 700); addrTxt.setAttribute('y', abY + 26);
      addrTxt.setAttribute('font-family', 'monospace');
      addrTxt.setAttribute('font-size', '18'); addrTxt.setAttribute('font-weight', '700');
      addrTxt.setAttribute('fill', C2.accent);
      addrTxt.textContent = 'addr = (row, col)';
      g.appendChild(addrTxt); refs.addrValueText = addrTxt;

      // ─── Row decoder strip (left of grid) ───
      for (let r = 0; r < rows; r++) {
        const rct = document.createElementNS(NS, 'rect');
        rct.setAttribute('x', gridX - 90); rct.setAttribute('y', gridY + r * (cellSz + gap));
        rct.setAttribute('width', 80); rct.setAttribute('height', cellSz);
        rct.setAttribute('rx', 3);
        rct.setAttribute('fill', '#15192a');
        rct.setAttribute('stroke', '#66ccff'); rct.setAttribute('stroke-width', '1');
        rct.setAttribute('opacity', '0.35');
        g.appendChild(rct); refs.rowDec.push(rct);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', gridX - 50); t.setAttribute('y', gridY + r * (cellSz + gap) + 22);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '11');
        t.setAttribute('fill', '#66ccff');
        t.textContent = 'row ' + r;
        g.appendChild(t);
      }
      const rdLbl = document.createElementNS(NS, 'text');
      rdLbl.setAttribute('x', gridX - 50); rdLbl.setAttribute('y', gridY - 12);
      rdLbl.setAttribute('text-anchor', 'middle');
      rdLbl.setAttribute('font-family', 'monospace');
      rdLbl.setAttribute('font-size', '11'); rdLbl.setAttribute('font-weight', '700');
      rdLbl.setAttribute('fill', '#66ccff');
      rdLbl.textContent = 'ROW DECODER';
      g.appendChild(rdLbl);

      // ─── Column decoder strip (below grid) ───
      for (let c = 0; c < cols; c++) {
        const rct = document.createElementNS(NS, 'rect');
        rct.setAttribute('x', gridX + c * (cellSz + gap)); rct.setAttribute('y', gridY + gridH + 4);
        rct.setAttribute('width', cellSz); rct.setAttribute('height', 30);
        rct.setAttribute('rx', 3);
        rct.setAttribute('fill', '#15192a');
        rct.setAttribute('stroke', C2.edgeRise); rct.setAttribute('stroke-width', '1');
        rct.setAttribute('opacity', '0.35');
        g.appendChild(rct); refs.colDec.push(rct);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', gridX + c * (cellSz + gap) + cellSz / 2);
        t.setAttribute('y', gridY + gridH + 24);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '10');
        t.setAttribute('fill', C2.edgeRise);
        t.textContent = 'c' + c;
        g.appendChild(t);
      }
      const cdLbl = document.createElementNS(NS, 'text');
      cdLbl.setAttribute('x', gridX + gridW / 2); cdLbl.setAttribute('y', gridY + gridH + 52);
      cdLbl.setAttribute('text-anchor', 'middle');
      cdLbl.setAttribute('font-family', 'monospace');
      cdLbl.setAttribute('font-size', '11'); cdLbl.setAttribute('font-weight', '700');
      cdLbl.setAttribute('fill', C2.edgeRise);
      cdLbl.textContent = 'COLUMN DECODER';
      g.appendChild(cdLbl);

      // ─── Cell grid ───
      for (let r = 0; r < rows; r++) {
        refs.cells.push([]);
        for (let c = 0; c < cols; c++) {
          const rct = document.createElementNS(NS, 'rect');
          rct.setAttribute('x', gridX + c * (cellSz + gap));
          rct.setAttribute('y', gridY + r * (cellSz + gap));
          rct.setAttribute('width', cellSz); rct.setAttribute('height', cellSz);
          rct.setAttribute('rx', 2);
          rct.setAttribute('fill', C2.panel);
          rct.setAttribute('stroke', C2.gateEdge); rct.setAttribute('stroke-width', '0.8');
          g.appendChild(rct); refs.cells[r].push(rct);
        }
      }

      // ─── Pool of moving dots for upper/lower streams ───
      for (let i = 0; i < 3; i++) {
        const d = document.createElementNS(NS, 'circle');
        d.setAttribute('r', 5);
        d.setAttribute('fill', '#66ccff');
        d.setAttribute('opacity', '0');
        g.appendChild(d);
        refs.upperStream.push(d);
        const d2 = document.createElementNS(NS, 'circle');
        d2.setAttribute('r', 5);
        d2.setAttribute('fill', C2.edgeRise);
        d2.setAttribute('opacity', '0');
        g.appendChild(d2);
        refs.lowerStream.push(d2);
      }

      // Target cell glow ring (draws on top)
      const ring = document.createElementNS(NS, 'rect');
      ring.setAttribute('width', cellSz + 10); ring.setAttribute('height', cellSz + 10);
      ring.setAttribute('rx', 5);
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', '#fff');
      ring.setAttribute('stroke-width', '3');
      ring.setAttribute('opacity', '0');
      g.appendChild(ring); refs.cellGlow = ring;

      // Phase caption
      const phase = document.createElementNS(NS, 'text');
      phase.setAttribute('x', 500); phase.setAttribute('y', 580);
      phase.setAttribute('text-anchor', 'middle');
      phase.setAttribute('font-family', 'monospace');
      phase.setAttribute('font-size', '14'); phase.setAttribute('font-weight', '700');
      phase.setAttribute('fill', C2.edgeRise);
      g.appendChild(phase); refs.phase = phase;
    });

    b.animate('addr-film', (tMs) => {
      const cycleMs = 6000;
      const cycleIdx = Math.floor(tMs / cycleMs) % addresses.length;
      const T = tMs % cycleMs;
      const [tRow, tCol] = addresses[cycleIdx];
      // Build 6-bit target: upper 3 = tRow, lower 3 = tCol
      const bits = [
        (tRow >> 2) & 1, (tRow >> 1) & 1, tRow & 1,
        (tCol >> 2) & 1, (tCol >> 1) & 1, tCol & 1,
      ];

      // Update address tile values + address label
      refs.addrBits.forEach((ab, i) => {
        ab.text.textContent = String(bits[i]);
      });
      refs.addrValueText.textContent = 'addr = (row ' + tRow + ', col ' + tCol + ')';

      let phase;
      // Reset visuals each cycle
      refs.rowDec.forEach((r, i) => {
        r.setAttribute('opacity', '0.35');
        r.setAttribute('fill', '#15192a');
      });
      refs.colDec.forEach((r, i) => {
        r.setAttribute('opacity', '0.35');
        r.setAttribute('fill', '#15192a');
      });
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          refs.cells[r][c].setAttribute('fill', COL.panel);
          refs.cells[r][c].setAttribute('opacity', '1');
        }
      }
      refs.cellGlow.setAttribute('opacity', '0');
      refs.upperStream.forEach(d => d.setAttribute('opacity', '0'));
      refs.lowerStream.forEach(d => d.setAttribute('opacity', '0'));

      if (T < 1500) {
        phase = 'address bits appear on the pins';
      } else if (T < 2500) {
        phase = 'address splits: upper 3 bits head up, lower 3 head down';
        const p = (T - 1500) / 1000;
        // Upper stream dots travel from addr bits (0..2) left and up toward row decoder
        for (let i = 0; i < 3; i++) {
          const src = refs.addrBits[i];
          const dst = { x: gridX - 50, y: gridY + tRow * (cellSz + gap) + cellSz / 2 };
          const f = Math.min(1, p + i * 0.08);
          refs.upperStream[i].setAttribute('cx', src.x + (dst.x - src.x) * f);
          refs.upperStream[i].setAttribute('cy', 173 + (dst.y - 173) * f);
          refs.upperStream[i].setAttribute('opacity', '1');
        }
        // Lower stream dots travel from addr bits (3..5) down toward column decoder
        for (let i = 0; i < 3; i++) {
          const src = refs.addrBits[i + 3];
          const dst = { x: gridX + tCol * (cellSz + gap) + cellSz / 2, y: gridY + gridH + 20 };
          const f = Math.min(1, p + i * 0.08);
          refs.lowerStream[i].setAttribute('cx', src.x + (dst.x - src.x) * f);
          refs.lowerStream[i].setAttribute('cy', 173 + (dst.y - 173) * f);
          refs.lowerStream[i].setAttribute('opacity', '1');
        }
      } else if (T < 3500) {
        phase = 'row decoder fires: row ' + tRow + ' selected';
        // Row strip lights, row cells dim-glow
        refs.rowDec[tRow].setAttribute('fill', '#66ccff');
        refs.rowDec[tRow].setAttribute('opacity', '0.85');
        for (let c = 0; c < cols; c++) {
          refs.cells[tRow][c].setAttribute('fill', '#66ccff');
          refs.cells[tRow][c].setAttribute('opacity', '0.35');
        }
      } else if (T < 4500) {
        phase = 'column decoder fires: col ' + tCol + ' selected';
        refs.rowDec[tRow].setAttribute('fill', '#66ccff');
        refs.rowDec[tRow].setAttribute('opacity', '0.85');
        for (let c = 0; c < cols; c++) {
          refs.cells[tRow][c].setAttribute('fill', '#66ccff');
          refs.cells[tRow][c].setAttribute('opacity', '0.35');
        }
        refs.colDec[tCol].setAttribute('fill', COL.edgeRise);
        refs.colDec[tCol].setAttribute('opacity', '0.85');
        for (let r = 0; r < rows; r++) {
          refs.cells[r][tCol].setAttribute('fill', COL.edgeRise);
          refs.cells[r][tCol].setAttribute('opacity', (r === tRow) ? '1' : '0.35');
        }
      } else {
        phase = 'intersection: ONE cell selected  \u2014  addr (' + tRow + ',' + tCol + ')';
        refs.rowDec[tRow].setAttribute('fill', '#66ccff');
        refs.rowDec[tRow].setAttribute('opacity', '0.85');
        refs.colDec[tCol].setAttribute('fill', COL.edgeRise);
        refs.colDec[tCol].setAttribute('opacity', '0.85');
        // Light the whole row faintly + whole col faintly
        for (let c = 0; c < cols; c++) {
          refs.cells[tRow][c].setAttribute('fill', '#66ccff');
          refs.cells[tRow][c].setAttribute('opacity', '0.25');
        }
        for (let r = 0; r < rows; r++) {
          refs.cells[r][tCol].setAttribute('fill', COL.edgeRise);
          refs.cells[r][tCol].setAttribute('opacity', '0.25');
        }
        // Intersection cell bright
        refs.cells[tRow][tCol].setAttribute('fill', '#ffffff');
        refs.cells[tRow][tCol].setAttribute('opacity', '1');
        // Ring
        refs.cellGlow.setAttribute('x', gridX + tCol * (cellSz + gap) - 5);
        refs.cellGlow.setAttribute('y', gridY + tRow * (cellSz + gap) - 5);
        refs.cellGlow.setAttribute('opacity', '0.95');
      }

      refs.phase.textContent = phase;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Silent-film — RAS / CAS strobe.  Same pins carry row address then
  //  column address in two phases, each captured by its own strobe.
  //
  //  Cycle (ms, loops every 8000):
  //      0 – 1000   idle — pins empty, both strobes low
  //   1000 – 2500   row bits appear on shared pins, RAS pulses high
  //                 → row latch captures bits
  //   2500 – 4000   pins update with COLUMN bits, CAS pulses high
  //                 → column latch captures bits
  //   4000 – 6000   both decoders fire → row and column light up
  //   6000 – 8000   intersection cell holds → fade to next cycle
  // ═══════════════════════════════════════════════════════════════════
  function _drawDecoderFilm(b) {
    const COL = C();

    const rows = 8, cols = 8;
    const cellSz = 30, gap = 3;
    const gridX = 430, gridY = 240;
    const gridW = cols * (cellSz + gap), gridH = rows * (cellSz + gap);

    const refs = {
      pinTiles: [],
      rasCursor: null, rasVolt: null, rasWave: null,
      casCursor: null, casVolt: null, casWave: null,
      rowLatch: null, rowLatchVal: null,
      colLatch: null, colLatchVal: null,
      rowDec: [], colDec: [],
      cells: [],
      cellGlow: null,
      phase: null,
    };

    const addresses = [[3, 5], [6, 2], [1, 7], [5, 1]];

    b.drawCustom('dec-film', (g, NS, C2) => {
      // Background
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', 60); bg.setAttribute('y', 130);
      bg.setAttribute('width', 880); bg.setAttribute('height', 420);
      bg.setAttribute('rx', 8); bg.setAttribute('fill', '#0a0f18');
      bg.setAttribute('stroke', '#1a2230'); bg.setAttribute('stroke-width', '1.2');
      g.appendChild(bg);

      // ─── Shared ADDRESS pins at top-left ───
      const pinX = 100, pinY = 180, pinW = 50, pinGap = 6;
      for (let i = 0; i < 3; i++) {
        const x = pinX + i * (pinW + pinGap);
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', x); r.setAttribute('y', pinY);
        r.setAttribute('width', pinW); r.setAttribute('height', 40);
        r.setAttribute('rx', 4);
        r.setAttribute('fill', '#15192a');
        r.setAttribute('stroke', '#888');
        r.setAttribute('stroke-width', '1.8');
        g.appendChild(r);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x + pinW / 2); t.setAttribute('y', pinY + 28);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '22'); t.setAttribute('font-weight', '700');
        t.setAttribute('fill', '#666');
        t.textContent = '—';
        g.appendChild(t);
        refs.pinTiles.push({ rect: r, text: t });
      }
      const pinLbl = document.createElementNS(NS, 'text');
      pinLbl.setAttribute('x', pinX); pinLbl.setAttribute('y', pinY - 10);
      pinLbl.setAttribute('font-family', 'monospace');
      pinLbl.setAttribute('font-size', '12'); pinLbl.setAttribute('font-weight', '700');
      pinLbl.setAttribute('fill', C2.accent);
      pinLbl.textContent = 'SHARED ADDRESS PINS';
      g.appendChild(pinLbl);
      const pinNote = document.createElementNS(NS, 'text');
      pinNote.setAttribute('x', pinX); pinNote.setAttribute('y', pinY + 60);
      pinNote.setAttribute('font-family', 'monospace');
      pinNote.setAttribute('font-size', '10'); pinNote.setAttribute('font-style', 'italic');
      pinNote.setAttribute('fill', '#778');
      pinNote.textContent = 'same 3 pins \u2014 two phases, carry row then col';
      g.appendChild(pinNote);

      // ─── RAS / CAS oscilloscope waveforms ───
      // Each strobe gets a proper scope view: baseline at 0 V, top at +1 V,
      // a pre-drawn square-pulse polyline showing the whole 8 s cycle, and a
      // moving cursor line that tracks the current time.  This physically
      // shows what a "pulse" IS — the narration's "0 V \u2192 +V \u2192 0 V" shape
      // is visible on screen.
      const scopeW = 210, scopeH = 44;
      const drawScope = (x, y, nm, col, highStart, highEnd) => {
        // Label
        const lbl = document.createElementNS(NS, 'text');
        lbl.setAttribute('x', x - 8); lbl.setAttribute('y', y + scopeH / 2 + 4);
        lbl.setAttribute('text-anchor', 'end');
        lbl.setAttribute('font-family', 'monospace');
        lbl.setAttribute('font-size', '14'); lbl.setAttribute('font-weight', '700');
        lbl.setAttribute('fill', col);
        lbl.textContent = nm;
        g.appendChild(lbl);
        // Scope background
        const bgR = document.createElementNS(NS, 'rect');
        bgR.setAttribute('x', x); bgR.setAttribute('y', y);
        bgR.setAttribute('width', scopeW); bgR.setAttribute('height', scopeH);
        bgR.setAttribute('rx', 4);
        bgR.setAttribute('fill', '#0f1420');
        bgR.setAttribute('stroke', '#223');
        bgR.setAttribute('stroke-width', '1');
        g.appendChild(bgR);
        // +V / 0 V axis ticks on scope
        const tTop = document.createElementNS(NS, 'text');
        tTop.setAttribute('x', x + scopeW + 4); tTop.setAttribute('y', y + 10);
        tTop.setAttribute('font-family', 'monospace');
        tTop.setAttribute('font-size', '10'); tTop.setAttribute('fill', '#778');
        tTop.textContent = '+1 V';
        g.appendChild(tTop);
        const tBot = document.createElementNS(NS, 'text');
        tBot.setAttribute('x', x + scopeW + 4); tBot.setAttribute('y', y + scopeH - 2);
        tBot.setAttribute('font-family', 'monospace');
        tBot.setAttribute('font-size', '10'); tBot.setAttribute('fill', '#556');
        tBot.textContent = '0 V';
        g.appendChild(tBot);
        // Pre-drawn pulse polyline for the whole cycle.
        //  timeline 0..8000 ms \u2192 x = x .. x + scopeW
        const scaleX = (tms) => x + (tms / 8000) * scopeW;
        const yHi = y + 6;
        const yLo = y + scopeH - 6;
        const pts = [
          [scaleX(0),          yLo],
          [scaleX(highStart),  yLo],
          [scaleX(highStart),  yHi],
          [scaleX(highEnd),    yHi],
          [scaleX(highEnd),    yLo],
          [scaleX(8000),       yLo],
        ].map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
        const wave = document.createElementNS(NS, 'polyline');
        wave.setAttribute('points', pts);
        wave.setAttribute('fill', 'none');
        wave.setAttribute('stroke', col);
        wave.setAttribute('stroke-width', '2.5');
        g.appendChild(wave);
        // Time cursor (moves each frame)
        const cur = document.createElementNS(NS, 'line');
        cur.setAttribute('x1', x); cur.setAttribute('x2', x);
        cur.setAttribute('y1', y + 2); cur.setAttribute('y2', y + scopeH - 2);
        cur.setAttribute('stroke', '#fff');
        cur.setAttribute('stroke-width', '1.5');
        cur.setAttribute('opacity', '0.8');
        g.appendChild(cur);
        // Current voltage text
        const vText = document.createElementNS(NS, 'text');
        vText.setAttribute('x', x + scopeW + 40); vText.setAttribute('y', y + scopeH / 2 + 5);
        vText.setAttribute('font-family', 'monospace');
        vText.setAttribute('font-size', '14'); vText.setAttribute('font-weight', '700');
        vText.setAttribute('fill', '#888');
        vText.textContent = '0 V';
        g.appendChild(vText);
        return { cursor: cur, voltText: vText, wave, scopeX: x };
      };
      // RAS HIGH window: 1000 \u2013 2500 ms.  CAS HIGH window: 2500 \u2013 4000 ms.
      const rasScope = drawScope(pinX + 50, 270, 'RAS', '#66ccff', 1000, 2500);
      const casScope = drawScope(pinX + 50, 325, 'CAS', C2.edgeRise, 2500, 4000);
      refs.rasCursor = rasScope.cursor; refs.rasVolt = rasScope.voltText; refs.rasWave = rasScope.wave;
      refs.rasScopeX = rasScope.scopeX;
      refs.casCursor = casScope.cursor; refs.casVolt = casScope.voltText; refs.casWave = casScope.wave;
      refs.casScopeX = casScope.scopeX;

      // ─── Row latch + Col latch ───
      const drawLatch = (x, y, lblTxt, col) => {
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', x); r.setAttribute('y', y);
        r.setAttribute('width', 110); r.setAttribute('height', 55);
        r.setAttribute('rx', 5);
        r.setAttribute('fill', '#15192a');
        r.setAttribute('stroke', col); r.setAttribute('stroke-width', '1.8');
        g.appendChild(r);
        const lbl = document.createElementNS(NS, 'text');
        lbl.setAttribute('x', x + 55); lbl.setAttribute('y', y + 18);
        lbl.setAttribute('text-anchor', 'middle');
        lbl.setAttribute('font-family', 'monospace');
        lbl.setAttribute('font-size', '11'); lbl.setAttribute('font-weight', '700');
        lbl.setAttribute('fill', col);
        lbl.textContent = lblTxt;
        g.appendChild(lbl);
        const v = document.createElementNS(NS, 'text');
        v.setAttribute('x', x + 55); v.setAttribute('y', y + 45);
        v.setAttribute('text-anchor', 'middle');
        v.setAttribute('font-family', 'monospace');
        v.setAttribute('font-size', '22'); v.setAttribute('font-weight', '700');
        v.setAttribute('fill', '#666');
        v.textContent = '—';
        g.appendChild(v);
        return { box: r, val: v };
      };
      const rowL = drawLatch(pinX + 40, 400, 'ROW LATCH', '#66ccff');
      const colL = drawLatch(pinX + 190, 400, 'COL LATCH', C2.edgeRise);
      refs.rowLatch = rowL.box; refs.rowLatchVal = rowL.val;
      refs.colLatch = colL.box; refs.colLatchVal = colL.val;

      // ─── Row decoder strip (left of grid) ───
      for (let r = 0; r < rows; r++) {
        const rct = document.createElementNS(NS, 'rect');
        rct.setAttribute('x', gridX - 70); rct.setAttribute('y', gridY + r * (cellSz + gap));
        rct.setAttribute('width', 60); rct.setAttribute('height', cellSz);
        rct.setAttribute('rx', 2);
        rct.setAttribute('fill', '#15192a');
        rct.setAttribute('stroke', '#66ccff'); rct.setAttribute('stroke-width', '1');
        rct.setAttribute('opacity', '0.35');
        g.appendChild(rct); refs.rowDec.push(rct);
      }
      // ─── Col decoder strip (below grid) ───
      for (let c = 0; c < cols; c++) {
        const rct = document.createElementNS(NS, 'rect');
        rct.setAttribute('x', gridX + c * (cellSz + gap)); rct.setAttribute('y', gridY + gridH + 4);
        rct.setAttribute('width', cellSz); rct.setAttribute('height', 25);
        rct.setAttribute('rx', 2);
        rct.setAttribute('fill', '#15192a');
        rct.setAttribute('stroke', C2.edgeRise); rct.setAttribute('stroke-width', '1');
        rct.setAttribute('opacity', '0.35');
        g.appendChild(rct); refs.colDec.push(rct);
      }
      // ─── Grid ───
      for (let r = 0; r < rows; r++) {
        refs.cells.push([]);
        for (let c = 0; c < cols; c++) {
          const rct = document.createElementNS(NS, 'rect');
          rct.setAttribute('x', gridX + c * (cellSz + gap));
          rct.setAttribute('y', gridY + r * (cellSz + gap));
          rct.setAttribute('width', cellSz); rct.setAttribute('height', cellSz);
          rct.setAttribute('rx', 2);
          rct.setAttribute('fill', C2.panel);
          rct.setAttribute('stroke', C2.gateEdge); rct.setAttribute('stroke-width', '0.8');
          g.appendChild(rct); refs.cells[r].push(rct);
        }
      }

      const ring = document.createElementNS(NS, 'rect');
      ring.setAttribute('width', cellSz + 8); ring.setAttribute('height', cellSz + 8);
      ring.setAttribute('rx', 4);
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', '#fff');
      ring.setAttribute('stroke-width', '2.5');
      ring.setAttribute('opacity', '0');
      g.appendChild(ring); refs.cellGlow = ring;

      // Phase caption
      const phase = document.createElementNS(NS, 'text');
      phase.setAttribute('x', 500); phase.setAttribute('y', 580);
      phase.setAttribute('text-anchor', 'middle');
      phase.setAttribute('font-family', 'monospace');
      phase.setAttribute('font-size', '14'); phase.setAttribute('font-weight', '700');
      phase.setAttribute('fill', C2.edgeRise);
      g.appendChild(phase); refs.phase = phase;
    });

    b.animate('dec-film', (tMs) => {
      const cycleMs = 8000;
      const cycleIdx = Math.floor(tMs / cycleMs) % addresses.length;
      const T = tMs % cycleMs;
      const [tRow, tCol] = addresses[cycleIdx];
      const rowBits = [(tRow >> 2) & 1, (tRow >> 1) & 1, tRow & 1];
      const colBits = [(tCol >> 2) & 1, (tCol >> 1) & 1, tCol & 1];

      // Reset each frame
      const resetPin = (which) => {
        refs.pinTiles.forEach(p => {
          p.text.textContent = '—';
          p.text.setAttribute('fill', '#666');
          p.rect.setAttribute('stroke', '#888');
        });
      };
      const drivePins = (bits, color) => {
        refs.pinTiles.forEach((p, i) => {
          p.text.textContent = String(bits[i]);
          p.text.setAttribute('fill', color);
          p.rect.setAttribute('stroke', color);
        });
      };
      refs.rowDec.forEach(r => { r.setAttribute('opacity', '0.35'); r.setAttribute('fill', '#15192a'); });
      refs.colDec.forEach(r => { r.setAttribute('opacity', '0.35'); r.setAttribute('fill', '#15192a'); });
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          refs.cells[r][c].setAttribute('fill', COL.panel);
          refs.cells[r][c].setAttribute('opacity', '1');
        }
      refs.cellGlow.setAttribute('opacity', '0');

      // Persist latch contents after capture
      let rowCap = null, colCap = null;
      if (T >= 2000) rowCap = rowBits;
      if (T >= 3500) colCap = colBits;
      refs.rowLatchVal.textContent = rowCap ? rowCap.join('') + ' = ' + tRow : '—';
      refs.rowLatchVal.setAttribute('fill', rowCap ? '#66ccff' : '#666');
      refs.colLatchVal.textContent = colCap ? colCap.join('') + ' = ' + tCol : '—';
      refs.colLatchVal.setAttribute('fill', colCap ? COL.edgeRise : '#666');

      // Move scope cursors to current time position (timeline = full 8s cycle)
      const scopeW = 210;
      const cursorX_ras = refs.rasScopeX + (T / 8000) * scopeW;
      const cursorX_cas = refs.casScopeX + (T / 8000) * scopeW;
      refs.rasCursor.setAttribute('x1', cursorX_ras);
      refs.rasCursor.setAttribute('x2', cursorX_ras);
      refs.casCursor.setAttribute('x1', cursorX_cas);
      refs.casCursor.setAttribute('x2', cursorX_cas);
      // Voltage readouts follow the waveform pattern
      const rasHigh = (T >= 1000 && T < 2500);
      const casHigh = (T >= 2500 && T < 4000);
      refs.rasVolt.textContent = rasHigh ? '+1 V' : '0 V';
      refs.rasVolt.setAttribute('fill', rasHigh ? '#66ccff' : '#888');
      refs.casVolt.textContent = casHigh ? '+1 V' : '0 V';
      refs.casVolt.setAttribute('fill', casHigh ? COL.edgeRise : '#888');

      let phase;
      if (T < 1000) {
        phase = 'idle \u2014 pins empty, both strobes at 0 V';
        resetPin();
      } else if (T < 2500) {
        phase = 'ROW bits on pins  +  RAS pulses to +1 V  \u2192  row latch captures';
        drivePins(rowBits, '#66ccff');
      } else if (T < 4000) {
        phase = 'pins NOW carry COL bits  +  CAS pulses to +1 V  \u2192  col latch captures';
        drivePins(colBits, COL.edgeRise);
      } else {
        phase = 'latches feed decoders \u2192 cell (' + tRow + ',' + tCol + ') selected';
        resetPin();
        refs.rowDec[tRow].setAttribute('fill', '#66ccff');
        refs.rowDec[tRow].setAttribute('opacity', '0.85');
        refs.colDec[tCol].setAttribute('fill', COL.edgeRise);
        refs.colDec[tCol].setAttribute('opacity', '0.85');
        for (let c = 0; c < cols; c++) {
          refs.cells[tRow][c].setAttribute('fill', '#66ccff');
          refs.cells[tRow][c].setAttribute('opacity', '0.25');
        }
        for (let r = 0; r < rows; r++) {
          refs.cells[r][tCol].setAttribute('fill', COL.edgeRise);
          refs.cells[r][tCol].setAttribute('opacity', '0.25');
        }
        refs.cells[tRow][tCol].setAttribute('fill', '#ffffff');
        refs.cells[tRow][tCol].setAttribute('opacity', '1');
        refs.cellGlow.setAttribute('x', gridX + tCol * (cellSz + gap) - 4);
        refs.cellGlow.setAttribute('y', gridY + tRow * (cellSz + gap) - 4);
        refs.cellGlow.setAttribute('opacity', '0.95');
      }
      refs.phase.textContent = phase;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Animated full-chain diagram:
  //
  //    MAR \u2192 controller \u2192 address bus \u2192 DRAM pins
  //        \u2192 row decoder + col decoder \u2192 selected cell
  //        \u2192 sense amp \u2192 data bus \u2192 back to MAR side
  //
  //  Every connection is a visible physical wire.  A packet continuously
  //  travels along the whole chain so viewers can see the flow.  The
  //  `highlight` parameter spotlights one stage for the current narration
  //  beat, but the physical layout is always the same.
  //
  //  highlight: 'none' | 'mar' | 'internal' | 'mc' | 'addr' | 'decoders'
  //           | 'cell' | 'data' | 'ram' | 'all'
  // ═══════════════════════════════════════════════════════════════════
  function _drawMemorySystem(b, highlight) {
    const COL = C();
    // Unique id per highlight so we can rebuild DOM when beat changes.
    const id = 'memsys-' + (highlight || 'none');
    const refs = { packet: null };

    b.drawCustom(id, (g, NS, C2) => {
      const hi = (k) => highlight === k || highlight === 'all';

      // Background
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', 60); bg.setAttribute('y', 130);
      bg.setAttribute('width', 880); bg.setAttribute('height', 420);
      bg.setAttribute('rx', 8); bg.setAttribute('fill', '#0a0f18');
      bg.setAttribute('stroke', '#1a2230'); bg.setAttribute('stroke-width', '1.2');
      g.appendChild(bg);

      // ════════════ CPU DIE (left side) ════════════
      const cpuX = 80, cpuY = 160, cpuW = 390, cpuH = 360;
      const cpuBox = document.createElementNS(NS, 'rect');
      cpuBox.setAttribute('x', cpuX); cpuBox.setAttribute('y', cpuY);
      cpuBox.setAttribute('width', cpuW); cpuBox.setAttribute('height', cpuH);
      cpuBox.setAttribute('rx', 12);
      cpuBox.setAttribute('fill', '#0f1424');
      cpuBox.setAttribute('stroke', hi('cpu') ? C2.edgeRise : '#445');
      cpuBox.setAttribute('stroke-width', hi('cpu') ? '3' : '2');
      g.appendChild(cpuBox);
      const cpuLbl = document.createElementNS(NS, 'text');
      cpuLbl.setAttribute('x', cpuX + 10); cpuLbl.setAttribute('y', cpuY + 22);
      cpuLbl.setAttribute('font-family', 'monospace');
      cpuLbl.setAttribute('font-size', '14'); cpuLbl.setAttribute('font-weight', '700');
      cpuLbl.setAttribute('fill', C2.accent);
      cpuLbl.textContent = 'CPU DIE';
      g.appendChild(cpuLbl);

      // ─── MAR register (top of CPU area) ───
      const marX = 110, marY = 210, marW = 140, marH = 58;
      const marBox = document.createElementNS(NS, 'rect');
      marBox.setAttribute('x', marX); marBox.setAttribute('y', marY);
      marBox.setAttribute('width', marW); marBox.setAttribute('height', marH);
      marBox.setAttribute('rx', 5);
      marBox.setAttribute('fill', hi('mar') ? '#3a3010' : '#1a2230');
      marBox.setAttribute('stroke', hi('mar') ? C2.edgeRise : C2.accent);
      marBox.setAttribute('stroke-width', hi('mar') ? '2.8' : '1.8');
      g.appendChild(marBox);
      const mLbl = document.createElementNS(NS, 'text');
      mLbl.setAttribute('x', marX + marW / 2); mLbl.setAttribute('y', marY + 22);
      mLbl.setAttribute('text-anchor', 'middle');
      mLbl.setAttribute('font-family', 'monospace');
      mLbl.setAttribute('font-size', '14'); mLbl.setAttribute('font-weight', '700');
      mLbl.setAttribute('fill', hi('mar') ? C2.edgeRise : C2.accent);
      mLbl.textContent = 'MAR';
      g.appendChild(mLbl);
      const mVal = document.createElementNS(NS, 'text');
      mVal.setAttribute('x', marX + marW / 2); mVal.setAttribute('y', marY + 44);
      mVal.setAttribute('text-anchor', 'middle');
      mVal.setAttribute('font-family', 'monospace');
      mVal.setAttribute('font-size', '14');
      mVal.setAttribute('fill', hi('mar') ? C2.edgeRise : '#99a');
      mVal.textContent = '0x1234';
      g.appendChild(mVal);

      // ─── Internal addr bus: MAR bottom \u2192 MC top (visible vertical wire) ───
      const mcX = 280, mcY = 300, mcW = 170, mcH = 200;
      const mcInX = mcX + mcW / 2;
      // vertical drop from MAR
      const intW1 = document.createElementNS(NS, 'line');
      intW1.setAttribute('x1', marX + marW / 2); intW1.setAttribute('y1', marY + marH);
      intW1.setAttribute('x2', marX + marW / 2); intW1.setAttribute('y2', 288);
      intW1.setAttribute('stroke', hi('internal') || hi('mar') ? C2.edgeRise : '#667');
      intW1.setAttribute('stroke-width', hi('internal') || hi('mar') ? '3' : '2');
      g.appendChild(intW1);
      // horizontal run to MC input
      const intW2 = document.createElementNS(NS, 'line');
      intW2.setAttribute('x1', marX + marW / 2); intW2.setAttribute('y1', 288);
      intW2.setAttribute('x2', mcInX);          intW2.setAttribute('y2', 288);
      intW2.setAttribute('stroke', hi('internal') || hi('mar') ? C2.edgeRise : '#667');
      intW2.setAttribute('stroke-width', hi('internal') || hi('mar') ? '3' : '2');
      g.appendChild(intW2);
      // vertical stub into MC top
      const intW3 = document.createElementNS(NS, 'line');
      intW3.setAttribute('x1', mcInX); intW3.setAttribute('y1', 288);
      intW3.setAttribute('x2', mcInX); intW3.setAttribute('y2', mcY);
      intW3.setAttribute('stroke', hi('internal') || hi('mar') ? C2.edgeRise : '#667');
      intW3.setAttribute('stroke-width', hi('internal') || hi('mar') ? '3' : '2');
      g.appendChild(intW3);
      // Label "addr (internal bus)" along horizontal
      const intLbl = document.createElementNS(NS, 'text');
      intLbl.setAttribute('x', marX + marW / 2 + 10); intLbl.setAttribute('y', 282);
      intLbl.setAttribute('font-family', 'monospace');
      intLbl.setAttribute('font-size', '10');
      intLbl.setAttribute('fill', hi('internal') || hi('mar') ? C2.edgeRise : '#99a');
      intLbl.textContent = 'addr (internal wires)';
      g.appendChild(intLbl);

      // ─── Memory Controller ───
      const mcBox = document.createElementNS(NS, 'rect');
      mcBox.setAttribute('x', mcX); mcBox.setAttribute('y', mcY);
      mcBox.setAttribute('width', mcW); mcBox.setAttribute('height', mcH);
      mcBox.setAttribute('rx', 7);
      mcBox.setAttribute('fill', hi('mc') ? '#3a3010' : '#1a2230');
      mcBox.setAttribute('stroke', hi('mc') ? C2.edgeRise : C2.accent);
      mcBox.setAttribute('stroke-width', hi('mc') ? '3' : '2');
      g.appendChild(mcBox);
      const mcL1 = document.createElementNS(NS, 'text');
      mcL1.setAttribute('x', mcX + mcW / 2); mcL1.setAttribute('y', mcY + 20);
      mcL1.setAttribute('text-anchor', 'middle');
      mcL1.setAttribute('font-family', 'monospace');
      mcL1.setAttribute('font-size', '12'); mcL1.setAttribute('font-weight', '700');
      mcL1.setAttribute('fill', hi('mc') ? C2.edgeRise : C2.accent);
      mcL1.textContent = 'MEMORY CONTROLLER';
      g.appendChild(mcL1);
      const tasks = [
        'split addr into row+col',
        'pulse RAS then CAS',
        'drive data on writes',
        'latch data on reads',
        'manage refresh',
      ];
      tasks.forEach((t, i) => {
        const tx = document.createElementNS(NS, 'text');
        tx.setAttribute('x', mcX + mcW / 2); tx.setAttribute('y', mcY + 48 + i * 22);
        tx.setAttribute('text-anchor', 'middle');
        tx.setAttribute('font-family', 'monospace');
        tx.setAttribute('font-size', '10');
        tx.setAttribute('fill', hi('mc') ? '#ffcc55' : '#889');
        tx.textContent = '\u2022 ' + t;
        g.appendChild(tx);
      });

      // ════════════ Address bus (MULTI-WIRE visible bus between CPU and RAM) ════════════
      // Drawn as 4 parallel lines with tick marks + "/N" label — clearly a bus.
      const busStartX = cpuX + cpuW;   // = 470
      const busEndX   = 640;            // RAM pin start
      const addrY     = 340;
      const addrBusCol = hi('addr') ? '#66ccff' : '#667';
      const addrBusW = hi('addr') ? 2.8 : 1.8;
      for (let i = 0; i < 4; i++) {
        const ln = document.createElementNS(NS, 'line');
        ln.setAttribute('x1', busStartX); ln.setAttribute('y1', addrY + i * 6);
        ln.setAttribute('x2', busEndX);   ln.setAttribute('y2', addrY + i * 6);
        ln.setAttribute('stroke', addrBusCol);
        ln.setAttribute('stroke-width', addrBusW);
        g.appendChild(ln);
      }
      // Slash + N ticks to indicate multi-wire
      const slashA = document.createElementNS(NS, 'line');
      slashA.setAttribute('x1', 548); slashA.setAttribute('y1', addrY - 4);
      slashA.setAttribute('x2', 562); slashA.setAttribute('y2', addrY + 22);
      slashA.setAttribute('stroke', addrBusCol); slashA.setAttribute('stroke-width', '2');
      g.appendChild(slashA);
      const nA = document.createElementNS(NS, 'text');
      nA.setAttribute('x', 555); nA.setAttribute('y', addrY - 8);
      nA.setAttribute('text-anchor', 'middle');
      nA.setAttribute('font-family', 'monospace');
      nA.setAttribute('font-size', '11'); nA.setAttribute('font-weight', '700');
      nA.setAttribute('fill', addrBusCol);
      nA.textContent = 'N wires';
      g.appendChild(nA);
      const abLbl = document.createElementNS(NS, 'text');
      abLbl.setAttribute('x', 555); abLbl.setAttribute('y', addrY + 48);
      abLbl.setAttribute('text-anchor', 'middle');
      abLbl.setAttribute('font-family', 'monospace');
      abLbl.setAttribute('font-size', '11'); abLbl.setAttribute('font-weight', '700');
      abLbl.setAttribute('fill', addrBusCol);
      abLbl.textContent = 'ADDRESS BUS + RAS/CAS';
      g.appendChild(abLbl);

      // ════════════ Data bus (parallel lines, bidirectional) ════════════
      const dataY = 480;
      const dataBusCol = hi('data') ? COL.edgeRise : '#667';
      const dataBusW = hi('data') ? 2.8 : 1.8;
      for (let i = 0; i < 3; i++) {
        const ln = document.createElementNS(NS, 'line');
        ln.setAttribute('x1', busStartX); ln.setAttribute('y1', dataY + i * 6);
        ln.setAttribute('x2', busEndX);   ln.setAttribute('y2', dataY + i * 6);
        ln.setAttribute('stroke', dataBusCol);
        ln.setAttribute('stroke-width', dataBusW);
        g.appendChild(ln);
      }
      const dbLbl = document.createElementNS(NS, 'text');
      dbLbl.setAttribute('x', 555); dbLbl.setAttribute('y', dataY - 8);
      dbLbl.setAttribute('text-anchor', 'middle');
      dbLbl.setAttribute('font-family', 'monospace');
      dbLbl.setAttribute('font-size', '11'); dbLbl.setAttribute('font-weight', '700');
      dbLbl.setAttribute('fill', dataBusCol);
      dbLbl.textContent = 'DATA BUS  \u2192 write   \u2190 read';
      g.appendChild(dbLbl);

      // ════════════ DRAM CHIP (right side) with visible internals ════════════
      const ramX = 640, ramY = 160, ramW = 280, ramH = 360;
      const ramBox = document.createElementNS(NS, 'rect');
      ramBox.setAttribute('x', ramX); ramBox.setAttribute('y', ramY);
      ramBox.setAttribute('width', ramW); ramBox.setAttribute('height', ramH);
      ramBox.setAttribute('rx', 10);
      ramBox.setAttribute('fill', '#0f1424');
      ramBox.setAttribute('stroke', hi('ram') ? C2.edgeRise : '#445');
      ramBox.setAttribute('stroke-width', hi('ram') ? '3' : '2');
      g.appendChild(ramBox);
      const rLbl = document.createElementNS(NS, 'text');
      rLbl.setAttribute('x', ramX + ramW - 10); rLbl.setAttribute('y', ramY + 22);
      rLbl.setAttribute('text-anchor', 'end');
      rLbl.setAttribute('font-family', 'monospace');
      rLbl.setAttribute('font-size', '14'); rLbl.setAttribute('font-weight', '700');
      rLbl.setAttribute('fill', C2.accent);
      rLbl.textContent = 'DRAM CHIP';
      g.appendChild(rLbl);

      // RAM chip entry: small pin dots on left edge
      const pinsY = [addrY + 9, dataY + 6];
      pinsY.forEach(py => {
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('cx', ramX); dot.setAttribute('cy', py);
        dot.setAttribute('r', 4); dot.setAttribute('fill', '#889');
        g.appendChild(dot);
      });

      // ─── Row decoder strip (top of RAM internals) ───
      const rdX = ramX + 20, rdY = ramY + 50;
      const rdW = 60, rdH = 180;
      const rdCol = hi('decoders') ? '#66ccff' : C2.accent;
      const rdBox = document.createElementNS(NS, 'rect');
      rdBox.setAttribute('x', rdX); rdBox.setAttribute('y', rdY);
      rdBox.setAttribute('width', rdW); rdBox.setAttribute('height', rdH);
      rdBox.setAttribute('rx', 4);
      rdBox.setAttribute('fill', hi('decoders') ? '#1a2838' : '#1a2230');
      rdBox.setAttribute('stroke', rdCol);
      rdBox.setAttribute('stroke-width', hi('decoders') ? '2.5' : '1.5');
      g.appendChild(rdBox);
      const rdLbl = document.createElementNS(NS, 'text');
      rdLbl.setAttribute('x', rdX + rdW / 2); rdLbl.setAttribute('y', rdY + rdH / 2 - 6);
      rdLbl.setAttribute('text-anchor', 'middle');
      rdLbl.setAttribute('font-family', 'monospace');
      rdLbl.setAttribute('font-size', '10'); rdLbl.setAttribute('font-weight', '700');
      rdLbl.setAttribute('fill', rdCol);
      rdLbl.textContent = 'ROW';
      g.appendChild(rdLbl);
      const rdLbl2 = document.createElementNS(NS, 'text');
      rdLbl2.setAttribute('x', rdX + rdW / 2); rdLbl2.setAttribute('y', rdY + rdH / 2 + 10);
      rdLbl2.setAttribute('text-anchor', 'middle');
      rdLbl2.setAttribute('font-family', 'monospace');
      rdLbl2.setAttribute('font-size', '10'); rdLbl2.setAttribute('font-weight', '700');
      rdLbl2.setAttribute('fill', rdCol);
      rdLbl2.textContent = 'DECODER';
      g.appendChild(rdLbl2);

      // ─── Cell grid (6x6) ───
      const gX = rdX + rdW + 10, gY = rdY + 10;
      const cSz = 22, cGap = 2;
      const gridCols = 6, gridRows = 6;
      // Target cell (3, 5) glows
      const targetR = 3, targetC = 5;
      for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
          const isTarget = (r === targetR && c === targetC);
          const onRow    = (r === targetR);
          const onCol    = (c === targetC);
          const rct = document.createElementNS(NS, 'rect');
          rct.setAttribute('x', gX + c * (cSz + cGap));
          rct.setAttribute('y', gY + r * (cSz + cGap));
          rct.setAttribute('width', cSz); rct.setAttribute('height', cSz);
          rct.setAttribute('rx', 2);
          if (hi('cell') && isTarget) {
            rct.setAttribute('fill', '#ffffff');
            rct.setAttribute('stroke', C2.edgeRise);
            rct.setAttribute('stroke-width', '2');
          } else if (hi('decoders') && (onRow || onCol)) {
            rct.setAttribute('fill', onRow ? '#2a4a7a' : '#3a3010');
            rct.setAttribute('stroke', '#556');
          } else {
            rct.setAttribute('fill', C2.panel);
            rct.setAttribute('stroke', C2.gateEdge);
            rct.setAttribute('stroke-width', '0.6');
          }
          g.appendChild(rct);
        }
      }
      const gridLbl = document.createElementNS(NS, 'text');
      gridLbl.setAttribute('x', gX + (gridCols * (cSz + cGap)) / 2);
      gridLbl.setAttribute('y', gY + gridRows * (cSz + cGap) + 14);
      gridLbl.setAttribute('text-anchor', 'middle');
      gridLbl.setAttribute('font-family', 'monospace');
      gridLbl.setAttribute('font-size', '9'); gridLbl.setAttribute('font-style', 'italic');
      gridLbl.setAttribute('fill', '#778');
      gridLbl.textContent = 'cell grid';
      g.appendChild(gridLbl);

      // ─── Col decoder strip (bottom of RAM internals) ───
      const cdX = gX, cdY = gY + gridRows * (cSz + cGap) + 24;
      const cdW = gridCols * (cSz + cGap), cdH = 40;
      const cdCol = hi('decoders') ? '#ffcc55' : C2.accent;
      const cdBox = document.createElementNS(NS, 'rect');
      cdBox.setAttribute('x', cdX); cdBox.setAttribute('y', cdY);
      cdBox.setAttribute('width', cdW); cdBox.setAttribute('height', cdH);
      cdBox.setAttribute('rx', 4);
      cdBox.setAttribute('fill', hi('decoders') ? '#282010' : '#1a2230');
      cdBox.setAttribute('stroke', cdCol);
      cdBox.setAttribute('stroke-width', hi('decoders') ? '2.5' : '1.5');
      g.appendChild(cdBox);
      const cdLbl = document.createElementNS(NS, 'text');
      cdLbl.setAttribute('x', cdX + cdW / 2); cdLbl.setAttribute('y', cdY + 24);
      cdLbl.setAttribute('text-anchor', 'middle');
      cdLbl.setAttribute('font-family', 'monospace');
      cdLbl.setAttribute('font-size', '10'); cdLbl.setAttribute('font-weight', '700');
      cdLbl.setAttribute('fill', cdCol);
      cdLbl.textContent = 'COLUMN DECODER';
      g.appendChild(cdLbl);

      // ─── Wires from RAM pin (left edge of chip) INTO the decoders ───
      // Row bits routed UP to row decoder
      const wToRD = document.createElementNS(NS, 'path');
      wToRD.setAttribute('d',
        `M ${ramX} ${addrY + 9}
         L ${rdX - 4} ${addrY + 9}
         L ${rdX - 4} ${rdY + rdH / 2}
         L ${rdX} ${rdY + rdH / 2}`);
      wToRD.setAttribute('fill', 'none');
      wToRD.setAttribute('stroke', hi('decoders') || hi('addr') ? '#66ccff' : '#667');
      wToRD.setAttribute('stroke-width', hi('decoders') || hi('addr') ? '2.5' : '1.5');
      g.appendChild(wToRD);
      // Col bits routed DOWN to col decoder
      const wToCD = document.createElementNS(NS, 'path');
      wToCD.setAttribute('d',
        `M ${ramX} ${addrY + 9}
         L ${cdX + cdW / 2 - 30} ${addrY + 9}
         L ${cdX + cdW / 2 - 30} ${cdY - 4}
         L ${cdX + cdW / 2 - 20} ${cdY - 4}
         L ${cdX + cdW / 2 - 20} ${cdY}`);
      wToCD.setAttribute('fill', 'none');
      wToCD.setAttribute('stroke', hi('decoders') || hi('addr') ? '#ffcc55' : '#667');
      wToCD.setAttribute('stroke-width', hi('decoders') || hi('addr') ? '2.5' : '1.5');
      g.appendChild(wToCD);

      // ─── Word-line output from row decoder to the target row ───
      const wlOut = document.createElementNS(NS, 'line');
      wlOut.setAttribute('x1', rdX + rdW);
      wlOut.setAttribute('y1', gY + targetR * (cSz + cGap) + cSz / 2);
      wlOut.setAttribute('x2', gX);
      wlOut.setAttribute('y2', gY + targetR * (cSz + cGap) + cSz / 2);
      wlOut.setAttribute('stroke', hi('decoders') || hi('cell') ? '#66ccff' : '#556');
      wlOut.setAttribute('stroke-width', hi('decoders') || hi('cell') ? '2.5' : '1.3');
      g.appendChild(wlOut);

      // ─── Bit-line output from col decoder up to the target column ───
      const blOut = document.createElementNS(NS, 'line');
      blOut.setAttribute('x1', gX + targetC * (cSz + cGap) + cSz / 2);
      blOut.setAttribute('y1', cdY);
      blOut.setAttribute('x2', gX + targetC * (cSz + cGap) + cSz / 2);
      blOut.setAttribute('y2', gY + gridRows * (cSz + cGap));
      blOut.setAttribute('stroke', hi('decoders') || hi('cell') ? '#ffcc55' : '#556');
      blOut.setAttribute('stroke-width', hi('decoders') || hi('cell') ? '2.5' : '1.3');
      g.appendChild(blOut);

      // ─── Data bus exit from col decoder back to CPU ───
      const wDataOut = document.createElementNS(NS, 'path');
      wDataOut.setAttribute('d',
        `M ${cdX + cdW / 2 + 20} ${cdY + cdH}
         L ${cdX + cdW / 2 + 20} ${dataY + 6}
         L ${ramX} ${dataY + 6}`);
      wDataOut.setAttribute('fill', 'none');
      wDataOut.setAttribute('stroke', hi('data') ? COL.edgeRise : '#667');
      wDataOut.setAttribute('stroke-width', hi('data') ? '2.5' : '1.5');
      g.appendChild(wDataOut);

      // ═══ Flow packet (always visible, travels through the full chain) ═══
      const pkt = document.createElementNS(NS, 'circle');
      pkt.setAttribute('r', 5);
      pkt.setAttribute('fill', C2.edgeRise);
      pkt.setAttribute('opacity', '0');
      g.appendChild(pkt);
      refs.packet = pkt;
    });

    // Animated packet traces the whole MAR \u2192 MC \u2192 bus \u2192 decoder \u2192 cell path.
    b.animate(id, (tMs) => {
      if (!refs.packet) return;
      const cycleMs = 6000;
      const T = tMs % cycleMs;
      const frac = T / cycleMs;

      // Waypoints along the physical chain:
      //   A: MAR bottom (180, 268)
      //   B: corner at (180, 288)
      //   C: MC input top (365, 288 \u2192 down to 300)
      //   D: MC bottom-right exit (~450, ~480)
      //   E: onto address bus (~470, 349)
      //   F: RAM pin (~640, 349)
      //   G: into row decoder (~100, 340)
      //   H: word line lights, target cell
      //   I: back up data bus to CPU
      const waypoints = [
        { x: 180, y: 268 },                                  // 0 MAR bottom
        { x: 180, y: 288 },                                  // 1 corner
        { x: 365, y: 288 },                                  // 2 MC input
        { x: 365, y: 320 },                                  // 3 inside MC
        { x: 470, y: 349 },                                  // 4 MC output onto addr bus
        { x: 640, y: 349 },                                  // 5 RAM pin
        { x: 672, y: 243 },                                  // 6 into row decoder
        { x: 780, y: 243 },                                  // 7 row decoder output along word line
        { x: 830, y: 243 },                                  // 8 target cell
        { x: 830, y: 440 },                                  // 9 col decoder
        { x: 672, y: 486 },                                  // 10 onto data bus
        { x: 470, y: 486 },                                  // 11 across data bus to CPU
      ];

      const segLen = 1 / (waypoints.length - 1);
      const segIdx = Math.floor(frac / segLen);
      const segFrac = (frac - segIdx * segLen) / segLen;
      const a = waypoints[Math.min(segIdx, waypoints.length - 2)];
      const bp = waypoints[Math.min(segIdx + 1, waypoints.length - 1)];
      const px = a.x + (bp.x - a.x) * segFrac;
      const py = a.y + (bp.y - a.y) * segFrac;
      refs.packet.setAttribute('cx', px);
      refs.packet.setAttribute('cy', py);
      // Colour changes as packet moves through different phases
      let color;
      if (segIdx < 4) color = COL.edgeRise;          // inside CPU (address)
      else if (segIdx < 6) color = '#66ccff';        // on address bus
      else if (segIdx < 9) color = '#ffcc55';        // inside RAM (decoder path)
      else color = COL.edgeRise;                     // back on data bus
      refs.packet.setAttribute('fill', color);
      refs.packet.setAttribute('opacity', '1');
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Byte-width access film: shows ALL bit lines, ALL cells in a row
  //  firing in parallel, cell internals (tiny 1T+1C icon), and the width
  //  indicator (1 bit / 4-bit nibble / 8-bit byte / 16-bit word).
  //
  //  Cycles through widths so viewer sees how "1 byte" means 8 cells
  //  get read simultaneously from the SAME word line, not one after
  //  another.
  //
  //  Cycle (ms, loops every 18000):
  //     0 - 1500    idle, whole grid dim
  //  1500 - 3000    word line rises (selected row activates)
  //  3000 - 5000    SINGLE BIT mode \u2014 1 bit line taps 1 cell
  //  5000 - 6500    expand to NIBBLE (4 bit lines)
  //  6500 - 9000    NIBBLE mode \u2014 4 cells in parallel
  //  9000 - 10500   expand to BYTE (8 bit lines)
  // 10500 - 14000   BYTE mode \u2014 8 cells in parallel
  // 14000 - 18000   hold byte result \u2192 loop
  // ═══════════════════════════════════════════════════════════════════
  function _drawByteReadFilm(b) {
    const COL = C();

    // Grid: 4 rows x 8 cols (8 cols = one byte)
    const rows = 4, cols = 8;
    const cellW = 58, cellH = 52;
    const gX = 210, gY = 200;
    const selectedRow = 1;   // the active word line

    // Pre-generated bit values for cells in the selected row.  Stable
    // byte so the final result reads nicely.  0xB5 = 10110101.
    const rowBits = [1, 0, 1, 1, 0, 1, 0, 1];

    const refs = {
      cells: [],          // 2D array of cell rects
      capFills: [],       // 2D array of tiny capacitor fills inside each cell
      bitLines: [],       // 8 vertical lines
      wordLines: [],      // 4 horizontal lines
      senseAmps: [],      // 8 sense amp triangles
      bitValues: [],      // 8 output bit value texts
      widthLabel: null,
      widthTitle: null,
      resultLabel: null,
      packets: [],        // travel down bit lines
      phase: null,
    };

    b.drawCustom('byte-read-film', (g, NS, C2) => {
      // Background
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('x', 60); bg.setAttribute('y', 130);
      bg.setAttribute('width', 880); bg.setAttribute('height', 420);
      bg.setAttribute('rx', 8); bg.setAttribute('fill', '#0a0f18');
      bg.setAttribute('stroke', '#1a2230'); bg.setAttribute('stroke-width', '1.2');
      g.appendChild(bg);

      // ─── Top label: WIDTH banner ───
      const wTitle = document.createElementNS(NS, 'text');
      wTitle.setAttribute('x', 500); wTitle.setAttribute('y', 160);
      wTitle.setAttribute('text-anchor', 'middle');
      wTitle.setAttribute('font-family', 'monospace');
      wTitle.setAttribute('font-size', '22'); wTitle.setAttribute('font-weight', '700');
      wTitle.setAttribute('fill', C2.edgeRise);
      wTitle.textContent = 'READING...';
      g.appendChild(wTitle); refs.widthTitle = wTitle;

      const wSub = document.createElementNS(NS, 'text');
      wSub.setAttribute('x', 500); wSub.setAttribute('y', 183);
      wSub.setAttribute('text-anchor', 'middle');
      wSub.setAttribute('font-family', 'monospace');
      wSub.setAttribute('font-size', '13'); wSub.setAttribute('font-style', 'italic');
      wSub.setAttribute('fill', C2.accent);
      wSub.textContent = '';
      g.appendChild(wSub); refs.widthLabel = wSub;

      // ─── Column headers (bit line labels BL7..BL0) ───
      for (let c = 0; c < cols; c++) {
        const x = gX + c * cellW + cellW / 2;
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', x); t.setAttribute('y', gY - 8);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '10'); t.setAttribute('font-weight', '700');
        t.setAttribute('fill', C2.accent);
        t.textContent = 'BL' + (cols - 1 - c);
        g.appendChild(t);
      }

      // ─── Row decoder strip (left) + word line labels ───
      const rdX = gX - 80, rdW = 60;
      for (let r = 0; r < rows; r++) {
        const y = gY + r * cellH;
        const rdBox = document.createElementNS(NS, 'rect');
        rdBox.setAttribute('x', rdX); rdBox.setAttribute('y', y + 4);
        rdBox.setAttribute('width', rdW); rdBox.setAttribute('height', cellH - 8);
        rdBox.setAttribute('rx', 3);
        rdBox.setAttribute('fill', r === selectedRow ? '#3a3010' : '#15192a');
        rdBox.setAttribute('stroke', r === selectedRow ? C2.edgeRise : '#556');
        rdBox.setAttribute('stroke-width', r === selectedRow ? '2' : '1');
        g.appendChild(rdBox);
        const rdLbl = document.createElementNS(NS, 'text');
        rdLbl.setAttribute('x', rdX + rdW / 2); rdLbl.setAttribute('y', y + cellH / 2 + 4);
        rdLbl.setAttribute('text-anchor', 'middle');
        rdLbl.setAttribute('font-family', 'monospace');
        rdLbl.setAttribute('font-size', '10'); rdLbl.setAttribute('font-weight', '700');
        rdLbl.setAttribute('fill', r === selectedRow ? C2.edgeRise : '#778');
        rdLbl.textContent = 'WL' + r;
        g.appendChild(rdLbl);
      }
      const rdTitle = document.createElementNS(NS, 'text');
      rdTitle.setAttribute('x', rdX + rdW / 2); rdTitle.setAttribute('y', gY - 22);
      rdTitle.setAttribute('text-anchor', 'middle');
      rdTitle.setAttribute('font-family', 'monospace');
      rdTitle.setAttribute('font-size', '9'); rdTitle.setAttribute('font-weight', '700');
      rdTitle.setAttribute('fill', C2.accent);
      rdTitle.textContent = 'ROW DEC';
      g.appendChild(rdTitle);

      // ─── Bit lines (8 vertical wires, span from top header to sense amps) ───
      const blTopY = gY + 4;
      const blBotY = gY + rows * cellH + 40;
      for (let c = 0; c < cols; c++) {
        const x = gX + c * cellW + cellW / 2;
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', x); line.setAttribute('y1', blTopY);
        line.setAttribute('x2', x); line.setAttribute('y2', blBotY);
        line.setAttribute('stroke', '#556'); line.setAttribute('stroke-width', '2');
        g.appendChild(line);
        refs.bitLines.push(line);
      }

      // ─── Word lines (4 horizontal wires, span through all columns) ───
      for (let r = 0; r < rows; r++) {
        const y = gY + r * cellH + cellH / 2;
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', rdX + rdW); line.setAttribute('y1', y);
        line.setAttribute('x2', gX + cols * cellW); line.setAttribute('y2', y);
        line.setAttribute('stroke', '#556'); line.setAttribute('stroke-width', '2');
        g.appendChild(line);
        refs.wordLines.push(line);
      }

      // ─── Cells (each with a small 1T+1C icon inside) ───
      for (let r = 0; r < rows; r++) {
        refs.cells.push([]);
        refs.capFills.push([]);
        for (let c = 0; c < cols; c++) {
          const x = gX + c * cellW + 6;
          const y = gY + r * cellH + 4;
          const w = cellW - 12, h = cellH - 8;
          // Cell outline
          const cRect = document.createElementNS(NS, 'rect');
          cRect.setAttribute('x', x); cRect.setAttribute('y', y);
          cRect.setAttribute('width', w); cRect.setAttribute('height', h);
          cRect.setAttribute('rx', 3);
          cRect.setAttribute('fill', '#1a2230');
          cRect.setAttribute('stroke', '#334');
          cRect.setAttribute('stroke-width', '0.8');
          g.appendChild(cRect);
          refs.cells[r].push(cRect);

          // Tiny 1T+1C icon inside each cell:
          //   small "T" box on top, small capacitor below, both labeled.
          const tBox = document.createElementNS(NS, 'rect');
          tBox.setAttribute('x', x + w / 2 - 7); tBox.setAttribute('y', y + 6);
          tBox.setAttribute('width', 14); tBox.setAttribute('height', 10);
          tBox.setAttribute('rx', 1.5);
          tBox.setAttribute('fill', '#2a3040'); tBox.setAttribute('stroke', C2.accent);
          tBox.setAttribute('stroke-width', '0.8');
          g.appendChild(tBox);
          // Capacitor as two little horizontal lines with fill
          const capTop = document.createElementNS(NS, 'line');
          capTop.setAttribute('x1', x + w / 2 - 8); capTop.setAttribute('y1', y + 22);
          capTop.setAttribute('x2', x + w / 2 + 8); capTop.setAttribute('y2', y + 22);
          capTop.setAttribute('stroke', C2.accent); capTop.setAttribute('stroke-width', '1.2');
          g.appendChild(capTop);
          const capBot = document.createElementNS(NS, 'line');
          capBot.setAttribute('x1', x + w / 2 - 8); capBot.setAttribute('y1', y + 28);
          capBot.setAttribute('x2', x + w / 2 + 8); capBot.setAttribute('y2', y + 28);
          capBot.setAttribute('stroke', '#888'); capBot.setAttribute('stroke-width', '1.2');
          g.appendChild(capBot);
          // Charge indicator between plates (fills when cell stores 1)
          const capFill = document.createElementNS(NS, 'rect');
          capFill.setAttribute('x', x + w / 2 - 7); capFill.setAttribute('y', y + 23);
          capFill.setAttribute('width', 14); capFill.setAttribute('height', 5);
          capFill.setAttribute('fill', C2.edgeRise);
          capFill.setAttribute('opacity', (r === selectedRow && rowBits[c]) ? '0' : '0');
          g.appendChild(capFill);
          refs.capFills[r].push(capFill);

          // Value label (the stored bit, shown when row lights up)
          const vLbl = document.createElementNS(NS, 'text');
          vLbl.setAttribute('x', x + w / 2); vLbl.setAttribute('y', y + h - 3);
          vLbl.setAttribute('text-anchor', 'middle');
          vLbl.setAttribute('font-family', 'monospace');
          vLbl.setAttribute('font-size', '10'); vLbl.setAttribute('font-weight', '700');
          vLbl.setAttribute('fill', '#556');
          if (r === selectedRow) {
            vLbl.textContent = rowBits[c];
          } else {
            vLbl.textContent = '?';
          }
          g.appendChild(vLbl);
        }
      }

      // ─── Sense amps below the grid (8 triangles) ───
      const saY = gY + rows * cellH + 14;
      for (let c = 0; c < cols; c++) {
        const cx = gX + c * cellW + cellW / 2;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d',
          `M ${cx - 10} ${saY} L ${cx + 10} ${saY} L ${cx} ${saY + 20} Z`);
        path.setAttribute('fill', '#1a2230');
        path.setAttribute('stroke', '#556'); path.setAttribute('stroke-width', '1');
        g.appendChild(path);
        refs.senseAmps.push(path);
      }

      // ─── Output bit value labels (D7..D0) at very bottom ───
      const outY = saY + 50;
      for (let c = 0; c < cols; c++) {
        const cx = gX + c * cellW + cellW / 2;
        // Box around the output value
        const box = document.createElementNS(NS, 'rect');
        box.setAttribute('x', cx - 16); box.setAttribute('y', outY);
        box.setAttribute('width', 32); box.setAttribute('height', 26);
        box.setAttribute('rx', 3);
        box.setAttribute('fill', '#15192a'); box.setAttribute('stroke', '#445');
        box.setAttribute('stroke-width', '1');
        g.appendChild(box);
        const dLbl = document.createElementNS(NS, 'text');
        dLbl.setAttribute('x', cx); dLbl.setAttribute('y', outY + 42);
        dLbl.setAttribute('text-anchor', 'middle');
        dLbl.setAttribute('font-family', 'monospace');
        dLbl.setAttribute('font-size', '9');
        dLbl.setAttribute('fill', '#778');
        dLbl.textContent = 'D' + (cols - 1 - c);
        g.appendChild(dLbl);
        const val = document.createElementNS(NS, 'text');
        val.setAttribute('x', cx); val.setAttribute('y', outY + 19);
        val.setAttribute('text-anchor', 'middle');
        val.setAttribute('font-family', 'monospace');
        val.setAttribute('font-size', '16'); val.setAttribute('font-weight', '700');
        val.setAttribute('fill', '#445');
        val.textContent = '-';
        g.appendChild(val);
        refs.bitValues.push({ box, val });
      }

      // ─── Result summary at bottom ───
      const resLbl = document.createElementNS(NS, 'text');
      resLbl.setAttribute('x', 500); resLbl.setAttribute('y', 540);
      resLbl.setAttribute('text-anchor', 'middle');
      resLbl.setAttribute('font-family', 'monospace');
      resLbl.setAttribute('font-size', '14'); resLbl.setAttribute('font-weight', '700');
      resLbl.setAttribute('fill', C2.edgeRise);
      resLbl.textContent = '';
      g.appendChild(resLbl); refs.resultLabel = resLbl;

      // ─── Phase caption at very bottom ───
      const phase = document.createElementNS(NS, 'text');
      phase.setAttribute('x', 500); phase.setAttribute('y', 580);
      phase.setAttribute('text-anchor', 'middle');
      phase.setAttribute('font-family', 'monospace');
      phase.setAttribute('font-size', '13'); phase.setAttribute('font-weight', '700');
      phase.setAttribute('fill', C2.accent);
      g.appendChild(phase); refs.phase = phase;

      // Pre-create packet pool (one per bit line for simultaneous drops)
      for (let c = 0; c < cols; c++) {
        const p = document.createElementNS(NS, 'circle');
        p.setAttribute('r', 4);
        p.setAttribute('opacity', '0');
        g.appendChild(p);
        refs.packets.push({ el: p, col: c });
      }
    });

    b.animate('byte-read-film', (tMs) => {
      const cycleMs = 18000;
      const T = tMs % cycleMs;

      // Determine mode (how many columns are "active")
      let mode, activeCols, title, sub, phaseTxt, showPackets;
      if (T < 1500) {
        mode = 'idle'; activeCols = 0;
        title = 'READING...';
        sub = 'watch as we vary how many cells are tapped at once';
        phaseTxt = 'idle \u2014 grid dim, no row active';
        showPackets = false;
      } else if (T < 3000) {
        mode = 'idle'; activeCols = 0;
        title = 'WORD LINE RISES \u2014 row 1 activates';
        sub = 'all cells on row 1 are now readable';
        phaseTxt = 'row 1 selected by row decoder';
        showPackets = false;
      } else if (T < 5000) {
        mode = 'bit'; activeCols = 1;
        title = 'READING 1 BIT  (width = 1)';
        sub = 'only ONE bit line is tapped \u2014 one cell out';
        phaseTxt = 'single-bit read: 1 bit line active';
        showPackets = true;
      } else if (T < 6500) {
        mode = 'nibble-expand'; activeCols = 4;
        title = 'WIDENING TO NIBBLE  (width = 4)';
        sub = '3 more bit lines join \u2014 4 cells read together';
        phaseTxt = 'widening: +3 more bit lines tapped';
        showPackets = false;
      } else if (T < 9000) {
        mode = 'nibble'; activeCols = 4;
        title = 'READING 1 NIBBLE  (width = 4 bits)';
        sub = 'FOUR cells from the same row, read in parallel';
        phaseTxt = 'nibble read: 4 bit lines active in parallel';
        showPackets = true;
      } else if (T < 10500) {
        mode = 'byte-expand'; activeCols = 8;
        title = 'WIDENING TO BYTE  (width = 8)';
        sub = '4 more bit lines join \u2014 8 cells read together';
        phaseTxt = 'widening: all 8 bit lines tapped';
        showPackets = false;
      } else if (T < 14000) {
        mode = 'byte'; activeCols = 8;
        title = 'READING 1 BYTE  (width = 8 bits)';
        sub = 'EIGHT cells from the same row, all read at once';
        phaseTxt = 'byte read: 8 bit lines in parallel';
        showPackets = true;
      } else {
        mode = 'byte'; activeCols = 8;
        title = 'ONE BYTE DELIVERED  (loop)';
        sub = '10110101 = 0xB5 = 181 \u2014 1 byte of data';
        phaseTxt = 'byte complete \u2192 cycle restarts';
        showPackets = false;
      }

      refs.widthTitle.textContent = title;
      refs.widthLabel.textContent = sub;
      refs.phase.textContent = phaseTxt;

      const wordLineActive = (T >= 1500);
      // Word line visual
      refs.wordLines.forEach((wl, r) => {
        if (r === selectedRow && wordLineActive) {
          wl.setAttribute('stroke', C2.edgeRise);
          wl.setAttribute('stroke-width', '3');
        } else {
          wl.setAttribute('stroke', '#556');
          wl.setAttribute('stroke-width', '2');
        }
      });

      // Cell visual: when word line active, all row cells light up (cap fill visible)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (r === selectedRow && wordLineActive) {
            refs.cells[r][c].setAttribute('fill', '#1a2540');
            refs.cells[r][c].setAttribute('stroke', C2.accent);
            refs.capFills[r][c].setAttribute('opacity', rowBits[c] ? '0.95' : '0.1');
          } else {
            refs.cells[r][c].setAttribute('fill', '#1a2230');
            refs.cells[r][c].setAttribute('stroke', '#334');
            refs.capFills[r][c].setAttribute('opacity', '0');
          }
        }
      }

      // Bit lines active based on mode
      // Column selection order: center-out for nibble, full 0-7 for byte
      //   bit    \u2192 just column 3
      //   nibble \u2192 columns 2,3,4,5
      //   byte   \u2192 all columns 0..7
      const activeSet = new Set();
      if (mode === 'bit') activeSet.add(3);
      else if (mode === 'nibble' || mode === 'nibble-expand') [2, 3, 4, 5].forEach(i => activeSet.add(i));
      else if (mode === 'byte' || mode === 'byte-expand') [0,1,2,3,4,5,6,7].forEach(i => activeSet.add(i));

      refs.bitLines.forEach((bl, c) => {
        if (activeSet.has(c)) {
          bl.setAttribute('stroke', rowBits[c] ? C2.edgeRise : '#66ccff');
          bl.setAttribute('stroke-width', '3');
        } else {
          bl.setAttribute('stroke', '#556');
          bl.setAttribute('stroke-width', '2');
        }
      });

      refs.senseAmps.forEach((sa, c) => {
        if (activeSet.has(c)) {
          sa.setAttribute('fill', rowBits[c] ? C2.edgeRise : '#66ccff');
          sa.setAttribute('opacity', '0.9');
          sa.setAttribute('stroke', C2.edgeRise);
        } else {
          sa.setAttribute('fill', '#1a2230');
          sa.setAttribute('opacity', '1');
          sa.setAttribute('stroke', '#556');
        }
      });

      // Output bit values D0..D7
      refs.bitValues.forEach((bv, c) => {
        if (activeSet.has(c)) {
          bv.val.textContent = String(rowBits[c]);
          bv.val.setAttribute('fill', rowBits[c] ? C2.edgeRise : '#66ccff');
          bv.box.setAttribute('stroke', C2.edgeRise);
          bv.box.setAttribute('stroke-width', '1.5');
        } else {
          bv.val.textContent = '-';
          bv.val.setAttribute('fill', '#445');
          bv.box.setAttribute('stroke', '#445');
          bv.box.setAttribute('stroke-width', '1');
        }
      });

      // Result display
      if (mode === 'bit') {
        refs.resultLabel.textContent = 'output = 1 bit: ' + rowBits[3];
      } else if (mode === 'nibble') {
        const nbits = [3,2,1,0].map(i => rowBits[i + 2]).reverse();
        const nStr = nbits.join('');
        refs.resultLabel.textContent = 'output = 1 nibble (4 bits): ' + nStr + ' = 0x' + parseInt(nStr, 2).toString(16).toUpperCase();
      } else if (mode === 'byte') {
        const bStr = rowBits.join('');
        refs.resultLabel.textContent = 'output = 1 byte (8 bits): ' + bStr + ' = 0x' + parseInt(bStr, 2).toString(16).toUpperCase() + ' = ' + parseInt(bStr, 2);
      } else {
        refs.resultLabel.textContent = '';
      }

      // Animated packets down the active bit lines
      refs.packets.forEach((p, i) => {
        if (!showPackets || !activeSet.has(p.col)) {
          p.el.setAttribute('opacity', '0');
          return;
        }
        const age = (T + i * 120) % 1400;
        const frac = age / 1400;
        const cx = gX + p.col * cellW + cellW / 2;
        const startY = gY + selectedRow * cellH + cellH / 2;
        const endY   = gY + rows * cellH + 30;
        p.el.setAttribute('cx', cx);
        p.el.setAttribute('cy', startY + (endY - startY) * frac);
        p.el.setAttribute('fill', rowBits[p.col] ? C2.edgeRise : '#66ccff');
        p.el.setAttribute('opacity', (1 - frac * 0.3).toFixed(2));
      });
    });
  }

  // ─────────────────────────────────────────
  //  SCENES
  // ─────────────────────────────────────────
  const BLOCKS_10_SCENES = [

    // ════════════════════════════════════════════════════
    // SCENE 1 \u2014 ANATOMY OF ONE INSTRUCTION: LDA
    //
    // For assembly mastery: walks LDA step-by-step through 4 T-states.
    // T-state counter ticks 0\u21921\u21922\u21923. Microcode ROM is visible.
    // Control signals light up each T-state.  Registers and buses
    // show exact data values at each cycle.  This is THE scene for
    // "how does a single instruction actually execute".
    // ════════════════════════════════════════════════════
    {
      id: 1,
      title: 'Anatomy Of ONE Instruction \u2014 LDA, T-State By T-State',
      pages: [
        { sentences: [
          { text: `Class, if you're learning assembly, this is THE scene. Let's take ONE instruction \u2014 LDA 14 \u2014 and watch exactly what happens inside the CPU when it runs. Four T-states. Four clock edges. A specific set of control signals firing on each. Data moving register to register across the bus. Every assembly instruction is a recipe like this. Learn to read this, you learn to read them all.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('LDA 14 \u2014 The Whole Instruction, T-State By T-State', C().edgeRise);
              _drawLDAStepByStep(b);
              b.setLabel('Watch the T-state number, the microcode row, the control signals, and the registers.', C().edgeRise);
            } },

          { text: `T0. The T-state counter reads 0. The microcode ROM looks up "LDA opcode, T-state 0" and outputs two control signals: CO and MI. CO = "counter out" \u2014 tells PC to drive its value onto the address bus. MI = "MAR in" \u2014 tells MAR to latch whatever is on the address bus. Result: PC (= 0) goes through CO onto the addr bus, MI captures it into MAR. Now MAR holds the address we want to fetch from.`,
            dur: 26000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('T0: CO + MI  \u2192  PC goes to MAR', C().edgeRise);
              _drawLDAStepByStep(b);
              b.setLabel('Two signals fire. PC drives addr bus. MAR latches. MAR = 0.', C().edgeRise);
            } },

          { text: `T1. The counter ticks to 1. The microcode looks up "LDA, T1" and asserts THREE signals: RO, II, CE. RO = "RAM out" \u2014 RAM[MAR=0] drives the data bus. II = "instruction register in" \u2014 IR latches the value. CE = "counter enable" \u2014 PC increments on the next clock edge. So we grab the byte at address 0 (which is 0x1E, meaning LDA 14), store it in IR, and bump PC to 1.`,
            dur: 26000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('T1: RO + II + CE  \u2192  fetch opcode into IR, bump PC', C().edgeRise);
              _drawLDAStepByStep(b);
              b.setLabel('Three signals. RAM drives data. IR latches. PC increments.', C().edgeRise);
            } },

          { text: `T2. Counter = 2. Microcode: IO + MI. Now the operand part of the instruction needs to go to MAR so we can fetch the actual data. IO = "IR out" \u2014 the operand field of IR (the low nibble, 0xE = 14) drives the address bus. MI latches MAR. MAR is now 14 \u2014 pointing at the cell that holds the data we want to load.`,
            dur: 24000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('T2: IO + MI  \u2192  operand to MAR', C().edgeRise);
              _drawLDAStepByStep(b);
              b.setLabel('IR operand drives addr bus. MAR latches. MAR now points at the data.', C().edgeRise);
            } },

          { text: `T3. Counter = 3. Microcode: RO + AI. RO drives RAM[MAR=14] onto the data bus \u2014 that's 0x42, the value we wanted to load. AI = "A in" \u2014 the A register latches the data bus. A is now 0x42. The LDA is complete. Four T-states, nine distinct signal assertions, and the value at address 14 is now in the accumulator.`,
            dur: 26000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('T3: RO + AI  \u2192  data into A  \u2192  LDA complete', C().edgeRise);
              _drawLDAStepByStep(b);
              b.setLabel('RAM drives data bus. A latches. A = 0x42. Done.', C().edgeRise);
            } },

          { text: `Now notice the pattern. EVERY instruction is exactly this shape: a small sequence of T-states, each T-state a specific subset of the 15 control signals, each signal either tells a register to DRIVE the bus (an "out" signal) or to LATCH from the bus (an "in" signal). ADD, SUB, JMP, STA, OUT \u2014 they are all just different microcode recipes on the same physical machinery. Master the recipe format, and you've mastered the CPU.`,
            dur: 26000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Universal Pattern \u2014 Every Opcode Is A Recipe Like This', C().edgeRise);
              _drawLDAStepByStep(b);
              b.setLabel('Every instruction: T-states + signal subset per T-state. LDA, ADD, JMP \u2014 same shape.', C().edgeRise);
            } },

          { text: `One more insight. T-states aren't a CPU feature you wrote \u2014 they come FROM the microcode ROM. A small counter ticks clock by clock, and its value plus the current opcode index into the ROM to produce the control signals. When the instruction finishes (at T3 for LDA), the counter resets to T0 and the next instruction begins. That's the whole heartbeat of the CPU.`,
            dur: 24000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The CPU\u2019s Heartbeat \u2014 T-state Counter + Microcode ROM', C().edgeRise);
              _drawLDAStepByStep(b);
              b.setLabel('T-counter + opcode \u2192 ROM lookup \u2192 control signals. Loop forever.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 2 — HOOK (original Scene 1 pushed forward)
    // ════════════════════════════════════════════════════
    {
      id: 2,
      title: 'Billions Of Cells, One Nanosecond',
      pages: [
        { sentences: [
          { text: `Your phone has somewhere around eight gigabytes of RAM. That\u2019s sixty-four billion individual bits, each sitting in its own tiny storage cell. Every one of them has to be addressable by the CPU, in any order, in about a nanosecond. How?`,
            dur: 15500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Memory At Scale', C().edgeRise);
              b.drawChipOutline('die', 200, 180, 600, 320, 'RAM');
              b.drawCustom('cells', (g, NS, COL) => {
                for (let r = 0; r < 12; r++) {
                  for (let c = 0; c < 20; c++) {
                    const rect = document.createElementNS(NS, 'rect');
                    rect.setAttribute('x', 220 + c * 28);
                    rect.setAttribute('y', 200 + r * 22);
                    rect.setAttribute('width', 24);
                    rect.setAttribute('height', 18);
                    rect.setAttribute('fill', COL.edgeRise); rect.setAttribute('opacity', '0.25');
                    g.appendChild(rect);
                  }
                }
              });
              b.drawNode('stats', 500, 550,
                '~ 64,000,000,000 cells  ·  random access in ~1 ns', C().edgeRise);
              b.setLabel('Billions of addresses. Any one reachable in a nanosecond. That is the design problem.', C().accent);
            } },

          { text: `RAM gets its name from the answer: Random Access Memory. Not "random" as in unpredictable, but "random" meaning any cell can be accessed as fast as any other. No scanning, no rewinding — give it an address, get or set a byte, any address, any time.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Random Access — Any Address, Any Time', C().accent);
              _drawMemoryGrid(b, { rows: 10, cols: 14, cellSz: 24, x: 260, y: 180, activeRow: 4, activeCol: 8 });
              b.drawNode('ar', 740, 440, '← address 0x48 — read in one cycle', C().edgeRise);
              b.setLabel('Contrast: a magnetic tape. RAM is named for its lack of positional penalty.', C().accent);
            } },

          { text: `Everything we have built in this series shows up inside RAM. Every storage cell is a flip-flop cousin. Every row selection is a decoder. Every column selection is a MUX. Every bus connection is a tri-state buffer. This episode is where it all comes together — and where Series B ends.`,
            dur: 14000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Every Building Block, Woven Together', C().accent);
              b.drawCustom('callbacks', (g, NS, COL) => {
                const items = [
                  '• flip-flop → storage cell (Ep 2)',
                  '• decoder → row address selector (Ep 5)',
                  '• MUX → column selector (Ep 6)',
                  '• tri-state → data bus driver (Ep 3)',
                  '• ALU → the customer receiving data (Ep 9)',
                ];
                items.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 140); t.setAttribute('y', 230 + i * 42);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '16');
                  t.setAttribute('fill', COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Every earlier episode shows up in this one. RAM is the integration payoff.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 1 — MEMORY INTERFACE
    // ════════════════════════════════════════════════════
    {
      id: 3,
      title: 'The Memory Interface',
      pages: [
        { sentences: [
          { text: `From the outside, a RAM chip is strikingly simple. It has an address input — a number saying which cell to touch. It has a data bus — which carries a bit (or byte, or word) in or out. And it has a read/write control line telling the chip which direction data is flowing.`,
            dur: 15500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Pins Of A RAM Chip', C().edgeRise);
              _drawRamBlock(b, { x: 320, y: 220, w: 320, h: 220, label: 'RAM' });
              b.setLabel('Three signal groups: address, data, R/W. That\u2019s the whole public interface.', C().accent);
            } },

          { text: `Write: put an address on the address pins, put data on the data pins, set R/W to write, pulse the clock. The cell at that address now stores that data. Read: put an address on the address pins, set R/W to read, pulse the clock. The cell\u2019s contents appear on the data pins.`,
            dur: 15000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Two Operations — Read And Write', C().accent);
              b.drawBox('wr', 100, 260, 360, 120, 'WRITE', C().accent);
              b.drawNode('wr1', 280, 300, '1. put address on ADDR pins',   C().accent);
              b.drawNode('wr2', 280, 325, '2. put data on DATA pins',      C().accent);
              b.drawNode('wr3', 280, 350, '3. set R/W = write',            C().accent);
              b.drawBox('rd', 540, 260, 360, 120, 'READ', C().accent);
              b.drawNode('rd1', 720, 300, '1. put address on ADDR pins',   C().accent);
              b.drawNode('rd2', 720, 325, '2. set R/W = read',             C().accent);
              b.drawNode('rd3', 720, 350, '3. read data from DATA pins',   C().accent);
              b.setLabel('Same wires, both directions. R/W tells the chip which way the data bus is going.', C().accent);
            } },

          { text: `Inside, of course, this simple interface hides a lot of machinery. We have to store the bits. We have to turn an N-bit address into a specific cell. We have to get the bits on and off the data bus. Let\u2019s break it open.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Inside The Chip', C().accent);
              b.drawChipOutline('die', 200, 200, 600, 300, 'RAM INTERNALS');
              b.drawNode('qm', 500, 380, '?', C().wireHot);
              b.setLabel('Three things to explain: the cell, the grid, and the decode/MUX path. Next.', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 2 — THE SRAM CELL  (silent-film rewrite)
    //
    // The cross-coupled latch actually flips on screen.  Viewer watches
    // the bit get written, held, flipped back, held — in a loop.
    // ════════════════════════════════════════════════════
    {
      id: 4,
      title: 'The SRAM Cell \u2014 Watch It Hold A Bit',
      pages: [
        { sentences: [
          { text: `Class, this is one cell of Static RAM. Before the animation even plays, let me raise the questions you're probably already asking. Why TWO inverters — wouldn't one be enough? Why do the wires cross? Why do we see both Q and Q-bar? Why TWO bit lines instead of one? Let's walk through each of these, then you'll see the machine work.`,
            dur: 19000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('SRAM Cell \u2014 Let\u2019s Raise The Questions First', C().edgeRise);
              _drawSRAMSchematic(b);
              b.setLabel('Before we explain \u2014 what questions would YOU ask about this picture?', C().edgeRise);
            } },

          { text: `First question. Why two inverters, not one? Because one inverter can't remember anything — you put in a 1, you get a 0 out, and as soon as you stop driving the input, it forgets. But if you take the output of inverter A and feed it INTO inverter B, and feed B's output back INTO A, they trap each other. Whatever one holds, the other holds the opposite, and they lock. That's what "cross-coupled" means physically.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Why TWO Inverters \u2014 They Trap Each Other', C().edgeRise);
              _drawSRAMSchematic(b);
              b.setLabel('Output of A feeds input of B. Output of B feeds input of A. They lock each other.', C().edgeRise);
            } },

          { text: `Second question. Why do we see both Q and Q-bar? Because the cross-coupling GIVES us both for free. Q is the bit. Q-bar is whatever's on the other side — always the opposite. We don't compute it, it just exists as a consequence of the wiring. And having both turns out to be useful, because reading Q and Q-bar together is faster and more reliable than reading just one.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Why Q AND Q-bar \u2014 The Wiring Gives Us Both', C().edgeRise);
              _drawSRAMSchematic(b);
              b.setLabel('Q-bar is not computed \u2014 it\u2019s the natural opposite on the other inverter.', C().edgeRise);
            } },

          { text: `Third question. What voltages? HIGH means roughly one volt — the supply rail, +V. LOW means zero volts — ground. That's it. Digital "1" is not a symbol, it's a wire sitting at about one volt. "0" is a wire at zero volts. Every picture you see where something "lights up" is that wire transitioning from zero to one volt in under a nanosecond.`,
            dur: 21000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('What Voltages? \u2014 HIGH \u2248 1 V.  LOW = 0 V.', C().accent);
              _drawSRAMSchematic(b);
              b.setLabel('\u201c1\u201d means the wire is at ~1 V. \u201c0\u201d means the wire is at 0 V. Nothing more.', C().accent);
            } },

          { text: `Fourth question \u2014 and this one trips up almost everyone. The cell stores ONE bit. So why are there TWO bit lines? Doesn't one bit need one wire? No. Look at the picture. Inside the cell there are actually TWO wires \u2014 Q and Q-bar. The inverters force them to always be opposite. If Q is at +1 V, Q-bar is at 0 V. Always. The "bit" is just which one is HIGH.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Inside The Cell \u2014 TWO Wires, Always Opposite', C().edgeRise);
              _drawSRAMSchematic(b);
              b.setLabel('Q and Q-bar \u2014 two internal wires, always opposite. The \u201cbit\u201d is which one is HIGH.', C().edgeRise);
            } },

          { text: `Think of a balance scale with two pans. One side goes UP, the other goes DOWN. Which side is higher tells you one piece of information. That's the bit. But the scale HAS two pans \u2014 that's just how it's built. The SRAM cell is the same. One bit of information. Two internal wires to physically hold it.`,
            dur: 18000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Balance Scale \u2014 1 Bit Of Info, 2 Pans To Hold It', C().accent);
              _drawSRAMSchematic(b);
              b.setLabel('Scale has 2 pans. Cell has 2 wires. One yes/no piece of info. Which pan is up = the bit.', C().accent);
            } },

          { text: `Why build the cell with TWO wires instead of one? Stability. Two wires, each forcing the other to be opposite, HOLD each other in place. No drift, no refresh ever needed. One wire alone would slowly leak to zero \u2014 that's actually what DRAM does, and we'll see it next scene. Two cross-coupled wires = permanent lock.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Why 2 Internal Wires \u2014 They Hold Each Other Stable', C().edgeRise);
              _drawSRAMSchematic(b);
              b.setLabel('2 wires forcing each other opposite = stable forever. 1 wire alone would leak.', C().edgeRise);
            } },

          { text: `So now the 2 bit lines make sense. There are 2 internal wires to reach, so we need 2 access transistors, so we need 2 bit lines. One door per wire. BIT connects to Q. BIT-bar connects to Q-bar. Two bit lines isn't about storing two bits. It's just how many doors you need to reach a 2-wire cell.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('2 Wires \u2192 2 Access Transistors \u2192 2 Bit Lines', C().edgeRise);
              _drawSRAMSchematic(b);
              b.setLabel('One door per internal wire. BIT \u2192 Q. BIT-bar \u2192 Q-bar. Not two bits \u2014 two doors.', C().edgeRise);
            } },

          { text: `And now you can see WHY we drive both during a write. The two wires are holding each other. To flip them, you push one pan DOWN and pull the other UP at the same time. Drive BIT high AND BIT-bar low simultaneously. Two hands, one clean flip. If you only had one bit line, you could never win the tug-of-war against the wires holding each other.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Write \u2014 Push One Pan Down, Pull The Other Up', C().edgeRise);
              _drawSRAMSchematic(b);
              b.setLabel('Drive both bit lines opposite at once. Two hands flip the scale. Clean. Decisive.', C().edgeRise);
            } },

          { text: `Fifth question. What are those "access transistors" connected to? The WORD LINE is connected to their GATES — remember Series C, the gate is what opens or closes a transistor. When word line is HIGH, both transistors open, so the bit lines reach the cell. When word line is LOW, both close, and the cell is electrically isolated from the outside world — it just holds its own state.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Access Transistors \u2014 Word Line Drives Their Gates', C().edgeRise);
              _drawSRAMSchematic(b);
              b.setLabel('WORD LINE \u2192 gates of the access transistors. HIGH = open. LOW = isolate.', C().edgeRise);
            } },

          { text: `Sixth question. Does the cell forget if power goes off? YES. This whole trick needs the inverters to keep working. Inverters need +V to do their job. Cut power, and the cell forgets immediately. That's why SRAM — and DRAM — are called VOLATILE memory. Your laptop holds programs in RAM while it's on. Pull the plug, and the RAM is blank when you turn it back on. Hard drives and SSDs are a different story.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('No Power = No Memory. RAM Is VOLATILE.', C().accent);
              _drawSRAMSchematic(b);
              b.setLabel('Power off \u2192 inverters die \u2192 cell forgets. That\u2019s why we save files to disk.', C().accent);
            } },

          { text: `Last question. How many transistors total? Count them. Two inverters — and from Series C we know one inverter is two transistors — so four in the latch. Plus two access transistors at the doors. Four plus two equals six. That's why this is called a "6T SRAM cell". Six transistors for every single bit. Fast — holds state with no refresh. But bulky. That's why CPU caches (fast but small) are SRAM, and main memory (slow but huge) is not.`,
            dur: 24000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Count \u2014 6 Transistors Per Single Bit', C().edgeRise);
              _drawSRAMSchematic(b);
              b.setLabel('4 in the latch + 2 at the doors = 6T. Fast, reliable. But 6\u00d7 silicon per bit.', C().edgeRise);
            } },

          { text: `Now zoom out. The cell doesn't live alone. Above it sit two PRECHARGE PMOS transistors (Ppr, Pprb) tying BL and BL\u0304 to VDD through a PRE\u0304 control line \u2014 these equalize the bit lines to VDD/2 before every read. Below the cell sits a differential SENSE AMPLIFIER. Below that, a column-select NMOS pass-gate (N_mux) driven by CSEL from the column decoder. That's the full column schematic \u2014 every element a designer would draw.`,
            dur: 26000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('SRAM In Column Context \u2014 Full Schematic', C().edgeRise);
              _drawSRAMColumn(b);
              b.setLabel('Row decoder \u2192 WL. Precharge above. Sense amp + mux below. CSEL \u2190 col decoder.', C().edgeRise);
            } },

          { text: `The read cycle in full detail. Phase one \u2014 PRE\u0304 is LOW, so Ppr and Pprb both conduct, pulling BL and BL\u0304 up to VDD/2. Phase two \u2014 PRE\u0304 goes HIGH (precharge off), WL rises, M5 and M6 open, and the cell's stored Q=0 pulls BL slightly toward 0V while Q\u0304=VDD pushes BL\u0304 up. Phase three \u2014 the sense amp detects the tiny differential and latches to full-rail voltages.`,
            dur: 26000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Read Timing \u2014 PRECHARGE \u2192 WL ACTIVE \u2192 SENSE', C().edgeRise);
              _drawSRAMColumn(b);
              b.setLabel('Three-phase timing: precharge, activate, sense. Same order for every read.', C().edgeRise);
            } },

          { text: `Final step. CSEL rises from the column decoder. N_mux opens and the amplified bit drives the DATA BUS leaving the chip. That's every wire a designer routes to get one SRAM cell's contents to the outside world. Row decoder picks the row via WL. Column decoder picks the column via CSEL. Precharge prepares. Sense amp amplifies. Mux gates out. Data bus delivers.`,
            dur: 24000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Cell \u2192 Data Bus  \u2014  Every Wire A Designer Routes', C().edgeRise);
              _drawSRAMColumn(b);
              b.setLabel('Full path: row dec \u2192 WL \u2192 cell \u2192 BL \u2192 SA \u2192 mux \u2192 CSEL \u2190 col dec \u2192 data bus.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 3 — THE DRAM CELL  (silent-film rewrite)
    //
    // Capacitor actually fills, holds, leaks, and gets refreshed on
    // screen.  The word "dynamic" becomes visible.
    // ════════════════════════════════════════════════════
    {
      id: 5,
      title: 'The DRAM Cell \u2014 Fill, Hold, Leak, Refresh',
      pages: [
        { sentences: [
          { text: `Class, now the DRAM cell. Before we watch it work, the questions. What IS a capacitor, physically? How is it connected — to what? What voltage fills it? Why does it leak if the transistor is off? And how does the "sense amp" decide a faint signal was a 1? Let's answer each one in order.`,
            dur: 19000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('DRAM \u2014 Questions First, Then The Machine', C().edgeRise);
              _drawDRAMSchematic(b);
              b.setLabel('Raise the questions before we turn the machine on. That\u2019s how you really learn.', C().edgeRise);
            } },

          { text: `First question. What IS a capacitor? Physically, two metal plates facing each other with an insulator between them. You can PUSH electrons onto one plate — they build up because they can't jump the insulator. That trapped charge IS the stored information. Full plate = we call it a 1. Empty plate = we call it a 0. That's it.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('A Capacitor \u2014 Two Plates Holding Trapped Electrons', C().edgeRise);
              _drawDRAMSchematic(b);
              b.setLabel('Plate + insulator + plate. Push electrons onto one plate, they get trapped. Done.', C().edgeRise);
            } },

          { text: `Second question. How is this capacitor connected? Top plate goes up to the transistor — so whether the bit line reaches it is controlled by the transistor door. Bottom plate goes DOWN to ground. That's crucial. The capacitor sits between the transistor and ground, measuring the voltage difference. Full = top plate at +V, bottom at 0 V. Empty = both at 0 V.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('How It\u2019s Connected \u2014 Transistor On Top, GND On Bottom', C().edgeRise);
              _drawDRAMSchematic(b);
              b.setLabel('Top plate \u2192 transistor \u2192 bit line. Bottom plate \u2192 ground. Voltage \u201cacross\u201d = the bit.', C().edgeRise);
            } },

          { text: `Third question. What voltage fills it? The same +V we saw in Series C — roughly one volt. The bit line carries that voltage, the transistor opens, and electrons flow until the capacitor's top plate is at +V. "Full" means the plate has reached supply voltage. "Empty" means zero. No intermediate — in theory.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('What Voltage \u2014 Same +V As Every Digital Signal', C().edgeRise);
              _drawDRAMSchematic(b);
              b.setLabel('Bit line holds +V \u2192 transistor opens \u2192 capacitor top plate climbs to +V. Filled.', C().edgeRise);
            } },

          { text: `Fourth question — and this is the one that trips people up. Why does it LEAK through a transistor that's supposed to be OFF? Answer: no real transistor is perfectly off. There's always a tiny leakage current sneaking through. Also the insulator between the capacitor plates isn't perfect. Charge sneaks out both routes. In real chips, half the charge is gone in about sixty-four milliseconds.`,
            dur: 24000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Why It Leaks \u2014 No Transistor Is PERFECTLY Off', C().accent);
              _drawDRAMSchematic(b);
              b.setLabel('Tiny leakage current always exists. Plus insulator isn\u2019t perfect. Charge escapes.', '#ff9944');
            } },

          { text: `Fifth question. What does the sense amp DO? It's a highly sensitive voltage comparator. It looks at the bit line — which has been smeared by a leaky cell's faint charge — and decides: is this closer to +V or closer to 0 V? If closer to +V, it says "this was a 1", and drives the bit line fully back to +V. The cell is refilled. That's why we need amplifiers — because we're reading signals that are tiny and getting tinier.`,
            dur: 26000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Why Amplifiers \u2014 The Signal Is TINY And Fading', C().edgeRise);
              _drawDRAMSchematic(b);
              b.setLabel('Sense amp = comparator. Decides faint signal was a 1, then drives bit line full \u2018HIGH\u2019.', C().edgeRise);
            } },

          { text: `Sixth question you might be having. If we refresh thousands of times per second, when does real memory work happen? Answer: refresh only touches one row at a time, and takes nanoseconds. There's plenty of time between refreshes for real reads and writes. The memory controller juggles both. You never notice.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('When Does Real Work Happen? \u2014 Between Refreshes', C().edgeRise);
              _drawDRAMSchematic(b);
              b.setLabel('Refresh = one row, nanoseconds. Real accesses slot between refreshes. Invisible.', C().edgeRise);
            } },

          { text: `Last question. Why is SRAM faster if both are made of the same transistors? Because SRAM DRIVES its output actively — the inverters push the bit line to +V or 0 V with real current. DRAM just lets a tiny capacitor's charge leak onto the bit line and hopes the sense amp can tell what it was. Driving is faster than sensing. That's the entire reason caches are SRAM.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Why SRAM Is Faster \u2014 Driving Beats Sensing', C().edgeRise);
              _drawDRAMSchematic(b);
              b.setLabel('SRAM actively drives the line. DRAM leaks a whisper and asks the amp to guess. Slower.', C().edgeRise);
            } },

          { text: `Count the parts. One transistor, one capacitor — 1T+1C. Compare to SRAM's 6T. That's why your phone has gigabytes of DRAM but only megabytes of SRAM cache. Six times fewer parts per cell = six times more bits per chip = far cheaper per gigabyte. Density is the entire reason DRAM exists despite being slower and leaky.`,
            dur: 21000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('1T + 1C \u2014 Six Times Denser Than SRAM', C().edgeRise);
              _drawDRAMSchematic(b);
              b.setLabel('Fewer parts \u2192 more bits per chip \u2192 cheaper per GB. That\u2019s the whole reason DRAM wins.', C().edgeRise);
            } },

          { text: `Now zoom out to the full column. A DRAM column uses a folded bit-line scheme: BL carries the cell, BL\u0304 carries a dummy reference at VDD/2. Above them: precharge PMOS pair (Ppr, Pprb) plus an equalizer NMOS (Neq) between BL and BL\u0304 \u2014 all driven by PRE\u0304 and EQ controls. Below: differential sense amp. Then column mux N_mux driven by CSEL. Then the data bus.`,
            dur: 26000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('DRAM Column \u2014 Folded Bit-Line Schematic', C().edgeRise);
              _drawDRAMColumn(b);
              b.setLabel('BL + dummy BL\u0304. Precharge + equalizer on top. Sense amp + mux below.', C().edgeRise);
            } },

          { text: `Read sequence. Phase one \u2014 precharge on: Ppr, Pprb, Neq all conduct. BL and BL\u0304 sit at VDD/2. Phase two \u2014 WL rises. M1 conducts. The tiny capacitor dumps its charge onto BL. If Cs was at VDD, BL tilts slightly up from VDD/2. If Cs was at 0V, BL tilts slightly down. BL\u0304 stays exactly at VDD/2 (dummy reference). The difference is only tens of millivolts.`,
            dur: 26000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Read Phase \u2014 Charge Sharing Creates A Tiny Differential', C().edgeRise);
              _drawDRAMColumn(b);
              b.setLabel('Cs dumps charge onto BL. BL vs BL\u0304 differs by only tens of millivolts.', C().edgeRise);
            } },

          { text: `Phase three \u2014 the sense amp's cross-coupled CMOS latch activates. It takes that tiny differential and snaps it to full VDD vs 0V in nanoseconds. Critically, this also rewrites the cell back to full charge \u2014 that's why a DRAM read is ALWAYS a refresh. Phase four \u2014 CSEL rises, N_mux opens, the bit drives the data bus. WL drops, Cs holds its refreshed value, and we precharge again. Full cycle.`,
            dur: 26000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Sense + Refresh + Mux \u2014 Every Read Rewrites The Cell', C().edgeRise);
              _drawDRAMColumn(b);
              b.setLabel('DRAM read is DESTRUCTIVE but the sense amp IMMEDIATELY rewrites full VDD back into Cs.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 5 \u2014 8 CELLS MAKE A BYTE, 8 BYTES MAKE AN ARRAY
    //
    // Wires 8 SRAM cells across a row (1 byte), 8 such rows (8
    // addresses), connects all 8 word lines to a 3-to-8 row decoder,
    // all 8 bit line pairs to precharge + sense amps + data bus.
    // This is the smallest actual memory chip a designer would lay out.
    // ════════════════════════════════════════════════════
    {
      id: 6,
      title: 'Wire 8 Cells Into A Byte \u2014 8 Bytes Into An Array',
      pages: [
        { sentences: [
          { text: `Class, we've got a proper SRAM cell with its column circuitry. Now let's wire eight of them side by side to make one BYTE of memory. Eight cells, all sharing the same word line. When that WL rises, all eight doors open at once \u2014 eight bits appear on eight bit line pairs in parallel. That's what "reading a byte" physically means.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('8 Cells Share One Word Line \u2014 That\u2019s 1 Byte', C().edgeRise);
              _drawSRAMByteArray(b);
              b.setLabel('Watch the active row: 8 cells selected at once, 8 bits appear on 8 bit line pairs.', C().edgeRise);
            } },

          { text: `Now stack 8 such rows on top of each other. Eight word lines, each with its own address. Eight bytes of memory total. Sixty-four cells. Every column has its own bit line pair running from the top of the array all the way to the bottom \u2014 and every bit line pair is shared by all 8 cells in that column. Columns carry bits; rows carry addresses.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Stack 8 Rows \u2014 8 Bytes Of Memory, 64 Cells', C().edgeRise);
              _drawSRAMByteArray(b);
              b.setLabel('8 rows \u00d7 8 cols = 64 cells. Columns = bit lines. Rows = word lines.', C().edgeRise);
            } },

          { text: `To pick an address, we need a ROW DECODER. Eight addresses means three address bits \u2014 A2 A1 A0. Those three bits feed into a 3-to-8 decoder, which outputs exactly ONE active word line out of eight. Watch the box on the left: A2 A1 A0 go in, one of WL0 to WL7 rises, the rest stay low. That's how the address selects a row.`,
            dur: 23000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('3-to-8 Row Decoder \u2014 3 Address Bits \u2192 1 Active WL', C().edgeRise);
              _drawSRAMByteArray(b);
              b.setLabel('A2 A1 A0 \u2192 ROW DECODER \u2192 exactly one of WL0..WL7 goes HIGH.', C().edgeRise);
            } },

          { text: `Above the array: eight precharge PMOS PAIRS across the top \u2014 one pair per column, all sharing a single PRE\u0304 control. Before every read, PRE\u0304 goes low, all sixteen PMOS conduct, and every bit line pair sits at VDD/2. Then PRE\u0304 goes high, the selected WL fires, and the cells dump their bits.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Precharge Bar \u2014 8 PMOS Pairs, One PRE\u0304 Control', C().edgeRise);
              _drawSRAMByteArray(b);
              b.setLabel('All 16 precharge PMOS share ONE PRE\u0304 line. They run in parallel, every read.', C().edgeRise);
            } },

          { text: `Below the array: eight SENSE AMPS \u2014 one per column. They all fire together, each one comparing its column's BL vs BL\u0304 differential. Their eight outputs become the eight bits of the byte. D7 D6 D5 D4 D3 D2 D1 D0. One clean byte on the data bus.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('8 Sense Amps Fire In Parallel \u2192 D7..D0', C().edgeRise);
              _drawSRAMByteArray(b);
              b.setLabel('One sense amp per column. 8 amps \u2192 8 output bits \u2192 one data byte on the bus.', C().edgeRise);
            } },

          { text: `Watch the full animation. The address increments every few seconds. Each address selects its row. The cells in that row light up with their stored bits. The bit line pairs split — the 1s go to VDD, the 0s go to GND. Sense amps latch. The byte appears on the data bus in binary and hex. That is exactly the wiring a designer draws for a small SRAM chip.`,
            dur: 24000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Full Read Cycle \u2014 Address In, Byte Out', C().edgeRise);
              _drawSRAMByteArray(b);
              b.setLabel('Watch addr 0\u21927 cycle. Every address outputs its 8-bit byte. Pure SRAM array operation.', C().edgeRise);
            } },

          { text: `Class, the real question now. What signals actually cause the cells to output or absorb 8 bits? The structure alone does nothing \u2014 every cell needs specific signals fired in the right order. Let's see ALL of them on one screen: CLK, R/W, OE, WE, PRE\u0304, WL, SAE, CSEL, BL, DATA. Every single one is a real wire with a real timing.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('What Signals Make Reading And Writing Happen?', C().edgeRise);
              _drawReadWriteTiming(b);
              b.setLabel('Top: block diagram showing where each signal comes from. Bottom: timing waveforms.', C().edgeRise);
            } },

          { text: `READ cycle. Step 1: CPU asserts OE (output enable) \u2014 tells the RAM "I want to read". Step 2: PRE\u0304 goes LOW briefly \u2014 precharge PMOS turn on, BL and BL\u0304 equalized to VDD/2. Step 3: PRE\u0304 goes HIGH again (precharge ends). Step 4: row decoder fires WL high \u2014 all 8 cells dump bits onto their bit line pairs. Step 5: SAE rises \u2014 sense amps latch. Step 6: CSEL rises \u2014 column mux opens and bits travel to the data bus. Step 7: CPU latches data on the clock edge. That's the READ.`,
            dur: 28000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('READ \u2014 7 Sequenced Signals: OE, PRE\u0304, WL, SAE, CSEL, \u2026', C().edgeRise);
              _drawReadWriteTiming(b);
              b.setLabel('Follow the white cursor. Each signal rises in order. Missing any ONE breaks the read.', C().edgeRise);
            } },

          { text: `WRITE cycle is different. Step 1: CPU puts data on the bus (CPU drives it, not the chip). Step 2: CPU asserts WE (write enable) \u2014 tells the RAM "I'm writing". Step 3: WL rises. Step 4: CSEL rises \u2014 but now N_mux flows the OTHER direction: the bus's data goes INTO the column, backward through the column circuitry, forcing BL and BL\u0304 to the values the CPU wants. Step 5: cells absorb that value. Step 6: WL falls, cell is now latched with new bit. Notice: SAE stays LOW during a write \u2014 we're not sensing, we're forcing.`,
            dur: 28000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('WRITE \u2014 Data Forced INTO The Cells Through The Mux', C().edgeRise);
              _drawReadWriteTiming(b);
              b.setLabel('WE HIGH. CSEL HIGH. Bus drives BLs. Cells absorb. SAE stays LOW (no sensing).', C().edgeRise);
            } },

          { text: `Where do these signals physically come from? Look at the block diagram on top. The CPU/memory controller originates CLK, R/W, OE, WE, and ADDR \u2014 these come from outside the chip. The TIMING SEQUENCER inside the chip takes CLK and R/W and generates PRE\u0304 and SAE at the right moments. The DECODERS take ADDR and generate WL and CSEL. All seven signals converge on the cell array. Drop any one, and nothing works.`,
            dur: 24000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Where Signals Come From \u2014 Each Has A Source', C().edgeRise);
              _drawReadWriteTiming(b);
              b.setLabel('CPU generates CLK/R\u002FW/OE/WE/ADDR. Sequencer \u2192 PRE\u0304, SAE. Decoders \u2192 WL, CSEL.', C().edgeRise);
            } },

          { text: `Final insight. The active-state indicators on the right of each waveform are NOW lamps \u2014 they glow when that signal is currently asserted. Follow them as the cursor scrubs. You can see at any moment exactly which subset of signals is high, and why the chip is doing what it's doing at that moment. This is the real answer to "how does a cell know to output or store a bit?" \u2014 a specific combination of these signals, in a specific order.`,
            dur: 26000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Which Signals Are Active RIGHT NOW?', C().edgeRise);
              _drawReadWriteTiming(b);
              b.setLabel('Right-side lamps light when each signal is asserted. Combination = command to the cell.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 \u2014 HOW DOES A DECODER DECODE 64 GB?
    //
    // The scaling question: you cannot build one 36-to-2^36 decoder.
    // Real DDR systems hierarchically slice the address into 7 fields
    // (Channel, DIMM, Rank, Bank, Row, Column, Byte-in-burst), each
    // feeding its own small decoder.  The biggest single decoder in
    // the whole tree is only 16-to-65 536.
    // ════════════════════════════════════════════════════
    {
      id: 7,
      title: 'How A Decoder Reaches 64 GB \u2014 Hierarchy, Not A Giant Box',
      pages: [
        { sentences: [
          { text: `Class, the question you should be asking. Our little array has 8 addresses. A real stick of DDR RAM has 64 billion. How does a decoder possibly handle that? Surely not one giant decoder with 64 billion AND gates? Correct \u2014 it does NOT. The answer is HIERARCHY. Let me show you the tree.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('64 GB Is NOT Decoded By One Giant Box', C().edgeRise);
              _drawAddressHierarchy(b);
              b.setLabel('A flat 36-to-2\u00B3\u2076 decoder = 68 billion gates. Impossible. Use HIERARCHY instead.', C().edgeRise);
            } },

          { text: `The physical address is 36 bits wide. 2 to the 36 equals about 68 billion. That's exactly 64 gigabytes of byte addresses. The memory controller SLICES those 36 bits into 7 fields. Each field has its own small decoder. Channel 1 bit. DIMM 1 bit. Rank 1 bit. Bank 4 bits. Row 16 bits. Column 10 bits. Byte-in-burst 3 bits. Total 1+1+1+4+16+10+3 = 36. Nothing fancy \u2014 just slicing.`,
            dur: 24000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 1 \u2014 Slice The 36-Bit Address Into 7 Fields', C().edgeRise);
              _drawAddressHierarchy(b);
              b.setLabel('1 + 1 + 1 + 4 + 16 + 10 + 3 = 36 bits. Each field goes to its own decoder.', C().edgeRise);
            } },

          { text: `Top field: CHANNEL. One bit selects one of two memory channels on the CPU \u2014 that's it. A 1-to-2 decoder is really just a wire. Next: DIMM slot. One bit picks which physical stick. Then RANK \u2014 one bit picks front or back of the stick. These first three decoders are tiny \u2014 basically muxes.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Tiny Top-Level Selectors \u2014 1-to-2 Muxes', C().edgeRise);
              _drawAddressHierarchy(b);
              b.setLabel('CHANNEL, DIMM, RANK: each just 1 bit in. Tiny 1-to-2 muxes.', C().edgeRise);
            } },

          { text: `Now BANK. Four bits select one of sixteen banks inside the chip. A 4-to-16 decoder is still small \u2014 sixteen AND gates. Modern DDR5 chips have 16 banks exactly for this reason: four address bits can pick any bank in constant time. Banks can also operate in parallel, which hides latency \u2014 but that's a different story.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('BANK \u2014 4-to-16 Decoder (16 AND Gates)', C().edgeRise);
              _drawAddressHierarchy(b);
              b.setLabel('4 bits \u2192 16 outputs = small decoder. Modern DDR5 has exactly 16 banks.', C().edgeRise);
            } },

          { text: `The BIG one. ROW decoder: sixteen bits in, sixty-five thousand five hundred thirty-six outputs. 2 to the 16. This is the biggest single decoder anywhere in the system \u2014 and it's still very buildable. It's the row decoder INSIDE one bank of one chip. It's driven by the RAS strobe. This is what fires the word line we've been drawing in every previous scene.`,
            dur: 24000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('ROW \u2014 16-to-65,536: The Biggest Decoder In The System', C().edgeRise);
              _drawAddressHierarchy(b);
              b.setLabel('This is the RAS-driven decoder inside a bank. 65,536 word lines. Doable.', C().edgeRise);
            } },

          { text: `Then COLUMN. Ten bits in, 1,024 outputs. This is the CAS-driven decoder that picks which 64-byte burst in the selected row goes to the data bus. Last: BYTE-IN-BURST. Three bits pick which of the 8 bytes within the 64-byte cache line the CPU actually wanted. Three bits. Eight outputs. Tiny.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('COLUMN and BYTE \u2014 CAS Decoder + Burst Mux', C().edgeRise);
              _drawAddressHierarchy(b);
              b.setLabel('Column decoder picks 1 of 1024 bursts. Byte mux picks 1 of 8 in the burst.', C().edgeRise);
            } },

          { text: `Multiply them all together. 2 channels times 2 DIMMs times 2 ranks times 16 banks times 65,536 rows times 1,024 columns times 8 bytes equals two to the 36 equals 68,719,476,736 bytes equals 64 gigabytes exactly. Every address reaches exactly one byte through this cascading tree \u2014 and no single decoder in the tree is bigger than 16-to-65k.`,
            dur: 24000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Math Works Out \u2014 Seven Decoders = 64 GB', C().edgeRise);
              _drawAddressHierarchy(b);
              b.setLabel('Each decoder tiny. Cascaded product = 64 GB. Biggest single unit = 16-to-65k.', C().edgeRise);
            } },

          { text: `And this is how every memory access on your computer works. The CPU puts an address in the MAR. The memory controller slices it into 7 fields. Seven decoders fire in sequence, each one narrowing the search. Total latency: roughly 60 to 90 nanoseconds from address to data. That's why caches exist \u2014 to skip the walk through this tree most of the time.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Every Memory Access Walks This Tree', C().edgeRise);
              _drawAddressHierarchy(b);
              b.setLabel('MAR \u2192 7 decoders \u2192 one byte. 60\u201390 ns. Caches exist to skip this tree walk.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 4 — MEMORY AS A 2D GRID  (silent-film rewrite)
    //
    // The address physically splits on screen — upper half streams up
    // to the row decoder, lower half streams down to the column decoder,
    // row and column light up, ONE cell glows at the intersection.
    // Loops through several different addresses.
    // ════════════════════════════════════════════════════
    {
      id: 8,
      title: 'The 2D Grid \u2014 Watch One Cell Get Picked',
      pages: [
        { sentences: [
          { text: `Class, questions first. Why TWO decoders, not one? What's a "decoder" doing physically? Why split the address — can't we just feed all the bits into one big decoder? Why is the layout actually a grid on silicon? Let's answer each one. These are the questions that matter.`,
            dur: 19000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('2D Grid \u2014 Raise The Questions First', C().edgeRise);
              _drawAddressingFilm(b);
              b.setLabel('Four questions to answer before the animation makes full sense.', C().edgeRise);
            } },

          { text: `First question. What does a "decoder" physically DO? From Episode 5 — a decoder takes N input bits and turns on exactly ONE output out of two-to-the-N. Give it binary 011, output 3 goes HIGH, the others stay LOW. Three bits in, one of eight lines out. That's a decoder's whole job. Here we use two of them.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('What A Decoder Does \u2014 N Bits In, ONE Line Out', C().edgeRise);
              _drawAddressingFilm(b);
              b.setLabel('Input 011 \u2192 output line 3 goes HIGH. Only one line out of 2\u207f. That\u2019s a decoder.', C().edgeRise);
            } },

          { text: `Second question — and this is the big one. Why TWO decoders, not just one huge decoder? Math. A 20-bit address into one flat decoder needs about a MILLION logic gates — one output line per address, all of them. Split it 10 bits + 10 bits, you need two tiny decoders of about one thousand gates each. Two thousand total, versus one million. Five hundred times less hardware. That is the only reason RAM can exist at scale.`,
            dur: 26000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Why TWO Decoders \u2014 The Math Forces It', C().edgeRise);
              _drawAddressingFilm(b);
              b.setLabel('1 flat decoder = ~1,000,000 gates. 2 split decoders = ~2,000 gates. 500\u00d7 less.', C().edgeRise);
            } },

          { text: `Third question. How does the split actually work? Upper half of the address bits physically go UP, on their own wires, to the row decoder. Lower half go DOWN, on their own wires, to the column decoder. They are separate circuits firing at the same time. Not sequential — parallel. Watch the blue and orange streams. Two jobs, in parallel, each small.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('How The Split Works \u2014 Two Parallel Circuits', C().edgeRise);
              _drawAddressingFilm(b);
              b.setLabel('Upper bits \u2192 row decoder wires. Lower bits \u2192 column decoder wires. Parallel.', C().edgeRise);
            } },

          { text: `Fourth question. What voltage is on the "word line" that gets lit? Same +V we've seen everywhere. The row decoder's one active output drives that row's word line to +V, which opens every access transistor along that row at the same time. Same for the column. It's not magic — it's a decoder output wire hitting one volt.`,
            dur: 21000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('What Voltage Lights The Word Line? \u2014 +V', C().edgeRise);
              _drawAddressingFilm(b);
              b.setLabel('Active decoder output = +V on that row\u2019s word line. Opens every cell in that row.', C().edgeRise);
            } },

          { text: `Fifth question. Is the silicon LAYOUT actually a grid? YES — physically, on the die, the cells really are in rows and columns. Word lines run horizontally as actual metal wires. Bit lines run vertically as other metal wires. Cells sit at intersections. This is why the row/column model works — it matches the physics of the silicon.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Is The Layout Really A Grid? \u2014 Yes, On The Silicon', C().edgeRise);
              _drawAddressingFilm(b);
              b.setLabel('Real word lines = horizontal metal. Real bit lines = vertical metal. Cells at intersections.', C().edgeRise);
            } },

          { text: `Last question. What if I want a WHOLE byte, not one bit? Then the column decoder picks EIGHT columns at once, and eight cells dump their bits in parallel. That's how one read gives you eight bits of data. Memory in the real world never reads one bit at a time — it reads whole bytes or whole words. The grid lets you do that for free.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Reading A Whole Byte \u2014 Pick 8 Columns At Once', C().edgeRise);
              _drawAddressingFilm(b);
              b.setLabel('Real reads are byte-at-a-time. Column decoder picks 8 columns, 8 cells dump in parallel.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 5 — ROW + COLUMN DECODERS  (silent-film rewrite)
    //
    // RAS / CAS strobes — the shared address pins physically carry row
    // bits in one phase, then column bits in the next.  Each strobe
    // latches its half into its own register.  Then the two decoders
    // fire and the cell is selected.  Loops.
    // ════════════════════════════════════════════════════
    {
      id: 9,
      title: 'Row + Column Decoders \u2014 RAS / CAS',
      pages: [
        { sentences: [
          { text: `Class, questions first, same as always. Why would a chip save pins — aren't pins basically free? What's a "latch" — we saw that in Episode 2? What IS a strobe physically? And what happens if the two strobes fire at the same time? Let's walk through each one.`,
            dur: 19000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('RAS / CAS \u2014 Questions First', C().edgeRise);
              _drawDecoderFilm(b);
              b.setLabel('Four real beginner questions to answer before the trick makes sense.', C().edgeRise);
            } },

          { text: `First question. Why save pins? Because every pin on a chip is REAL money. Each pin is a physical wire that has to be soldered, tested, and routed. A billion-cell chip with a flat 30-bit address would need thirty pins just for addressing — each one adding cost, size, and failure risk. Halving that to fifteen is huge. For decades, pin count was the single biggest constraint on chip design.`,
            dur: 24000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Why Save Pins \u2014 Every Pin Costs Real Money', C().edgeRise);
              _drawDecoderFilm(b);
              b.setLabel('Each pin = solder + test + failure risk. Halving pins \u2248 halves chip cost. Huge.', C().edgeRise);
            } },

          { text: `Second question. What is a LATCH physically? Remember Episode 2 — a latch is a tiny storage element, a flip-flop, that captures whatever is on its input at the moment a clock edge fires. Once captured, it HOLDS that value until told to capture again. So the row latch and col latch are just small registers, built from the flip-flops we already studied.`,
            dur: 23000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('What A Latch Is \u2014 The Flip-Flops From Episode 2', C().edgeRise);
              _drawDecoderFilm(b);
              b.setLabel('Latch = flip-flop register. Captures on clock edge, holds until next capture. Same circuit.', C().edgeRise);
            } },

          { text: `Third question. What IS a "strobe" physically? It's just a wire that goes HIGH for a brief moment — a pulse. The rising edge of that pulse is the clock edge the latch is waiting for. So "RAS pulses HIGH" means a wire at zero volts jumps up to +V and comes back down, in a few nanoseconds, and on the way up, the latch captures the address pins.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('What A Strobe Is \u2014 A Short Pulse, +V Then Back', C().edgeRise);
              _drawDecoderFilm(b);
              b.setLabel('Strobe = a wire that goes 0 V \u2192 +V \u2192 0 V fast. Rising edge = latch captures.', C().edgeRise);
            } },

          { text: `Fourth question. What if BOTH strobes fire at the same time? Then both latches try to capture the same pin values, which is useless — you'd write the row bits into the column latch and vice versa. That's why the controller strictly sequences them: first RAS, pins settle, THEN CAS. Never simultaneous. This ordering is the CPU's job — the memory controller generates the two pulses in the right order.`,
            dur: 26000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('What If Both Fire Together? \u2014 Breaks. So The Controller Sequences.', C().edgeRise);
              _drawDecoderFilm(b);
              b.setLabel('Controller guarantees: RAS first, then pins change, then CAS. Never overlap.', C().edgeRise);
            } },

          { text: `Fifth question. Who actually GENERATES RAS and CAS? The memory controller on the CPU — a small dedicated circuit that knows the timing rules of the RAM chip. CPU says "I want address X", the memory controller splits it, generates RAS, waits a few nanoseconds, generates CAS, waits, reads the data. The CPU doesn't manage this itself — it hands off to the controller.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Who Fires RAS/CAS? \u2014 The Memory Controller', C().edgeRise);
              _drawDecoderFilm(b);
              b.setLabel('CPU asks. Memory controller splits, times, pulses. CPU just waits for the data.', C().edgeRise);
            } },

          { text: `Last question. Do modern DDR memory chips still do this? YES. DDR4 and DDR5 sticks in your laptop right now still use multiplexed row/column addresses with RAS and CAS strobes. The speeds are faster — gigahertz instead of megahertz — but the fundamental trick is unchanged. Every byte your CPU reads rides on these two pulses.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Do DDR4 And DDR5 Still Do This? \u2014 Yes, Every Time', C().edgeRise);
              _drawDecoderFilm(b);
              b.setLabel('Same trick at gigahertz speeds. Every byte in every modern RAM rides on RAS + CAS.', C().edgeRise);
            } },

        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 \u2014 THE FULL CHAIN  (CPU \u2192 controller \u2192 RAM)
    //
    // Shows the end-to-end physical chain: MAR \u2192 memory controller
    // \u2192 address bus \u2192 DRAM chip pins \u2192 row/col decoders \u2192
    // selected cell \u2192 sense amp \u2192 data bus \u2192 back to CPU.
    // Every connection is a visible metal wire, not a magic box.
    // ════════════════════════════════════════════════════
    {
      id: 10,
      title: 'The Full Chain \u2014 CPU To RAM Cell',
      pages: [
        { sentences: [
          { text: `Now the bigger question. Where do all these bits actually come from? Row bits, column bits, bit line values \u2014 someone has to GENERATE them. Let's zoom out and see the whole physical picture. CPU on the left. DRAM chip on the right. And every single connection between them is a real metal wire on silicon. Nothing is wireless.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Whole Picture \u2014 CPU To RAM', C().edgeRise);
              _drawMemorySystem(b, 'all');
              b.setLabel('Watch the packet trace the full chain. Every arrow is a real wire.', C().edgeRise);
            } },

          { text: `Inside the CPU, there's a register called the MAR \u2014 Memory Address Register. Its one job: hold the address the CPU wants to access right now. When the CPU runs LDA 0x1234, that number 0x1234 lands in the MAR. Same register we used in our SAP-1 build. It's the start of the whole chain.`,
            dur: 21000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 1: The MAR Holds The Address', C().edgeRise);
              _drawMemorySystem(b, 'mar');
              b.setLabel('MAR = Memory Address Register. Same one we built in SAP-1.', C().edgeRise);
            } },

          { text: `But the MAR just holds ONE number. DRAM chips need row bits, column bits, RAS, CAS, timing, refresh... who does all THAT? The MEMORY CONTROLLER. It's a dedicated circuit that sits inside the CPU die, right next to the cores. Think of it as a waiter: the CPU orders "pasta" and the waiter translates that into every step the kitchen needs.`,
            dur: 23000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 2: The Memory Controller Translates', C().edgeRise);
              _drawMemorySystem(b, 'mc');
              b.setLabel('Waiter between CPU and RAM. Splits addr, pulses RAS/CAS, manages refresh.', C().edgeRise);
            } },

          { text: `Two buses leave the CPU and reach the DRAM chip. The ADDRESS BUS carries row bits, column bits, and the RAS and CAS strobes. Look at the diagram \u2014 it's drawn as multiple parallel wires with a slash mark, because it IS a bus of many wires, not one. The controller generates all those bits from the MAR's value.`,
            dur: 21000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 3: Address Bus Carries The Bits', C().edgeRise);
              _drawMemorySystem(b, 'addr');
              b.setLabel('Address bus: N parallel wires from controller to DRAM chip pins.', C().edgeRise);
            } },

          { text: `Now what happens when those bits hit the RAM chip. Inside the chip \u2014 look on the right side of the diagram \u2014 row bits route UP to the ROW DECODER, column bits route DOWN to the COLUMN DECODER. Each decoder picks its one winner. These are the same decoders from Episode 5, built from AND gates, built from transistors. Not magic. Just more circuits.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 4: Row + Column Decoders Inside The Chip', C().edgeRise);
              _drawMemorySystem(b, 'decoders');
              b.setLabel('Row bits \u2192 row decoder. Col bits \u2192 col decoder. Each picks one winner.', C().edgeRise);
            } },

          { text: `And the final link. The active row line (word line) crosses the cell grid horizontally. The active column line (bit line) crosses it vertically. Exactly ONE cell sits at that intersection. That cell is selected. Its stored bit is now the one being read or written. The whole chain \u2014 MAR to one tiny storage cell \u2014 takes less than a nanosecond.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 5: Intersection Picks ONE Cell', C().edgeRise);
              _drawMemorySystem(b, 'cell');
              b.setLabel('Row line + column line = one cell. End of the address chain.', C().edgeRise);
            } },

          { text: `The DATA BUS is separate, and it goes BOTH ways. On a WRITE, the controller drives the value the CPU wants to store onto the data bus \u2014 that's where bit line values come from during a write. On a READ, the DRAM cells dump their charge onto the bit lines, the sense amps decide what was there, and the value comes BACK up the data bus to the CPU.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 6: Data Bus Carries The Value (Both Ways)', C().edgeRise);
              _drawMemorySystem(b, 'data');
              b.setLabel('Write: CPU \u2192 bus \u2192 bit lines. Read: cells \u2192 sense amps \u2192 bus \u2192 CPU.', C().edgeRise);
            } },

          { text: `So the full answer. Row and column bits come from the CPU's MAR, split by the memory controller, sent on the address bus. Bit line values during a write come from the CPU via the data bus. Bit line values during a read come from the cells themselves, amplified and sent back via the data bus. Every RAM access rides this exact path, every time.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Full Chain \u2014 End To End', C().edgeRise);
              _drawMemorySystem(b, 'all');
              b.setLabel('Watch the packet loop. Every byte your CPU reads or writes flows through THIS.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 8 \u2014 HOW MANY BITS AT ONCE (bit / nibble / byte)
    //
    // Shows the full cell grid with visible bit lines running through
    // every column, every cell's internal 1T+1C structure, and how
    // "reading a byte" physically means 8 cells are tapped in parallel
    // on the SAME word line.  Loops through 1-bit, 4-bit nibble,
    // 8-bit byte widths to make the word-width idea concrete.
    // ════════════════════════════════════════════════════
    {
      id: 11,
      title: 'Bit, Nibble, Byte \u2014 How Many Cells At Once',
      pages: [
        { sentences: [
          { text: `Class. When we say "read one BYTE" from memory, what physically happens? The answer is that EIGHT cells on the same row get read at the same time. Not one after another \u2014 all eight in parallel. Let me show you the full cell grid with all its bit lines visible. Every column has its own bit line. Every row has its own word line.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Cell Grid \u2014 All Bit Lines Visible', C().edgeRise);
              _drawByteReadFilm(b);
              b.setLabel('4 rows x 8 columns = 32 cells. Each cell = 1 bit. Every column has its own bit line.', C().edgeRise);
            } },

          { text: `Zoom in on one cell. Each tiny square is a DRAM cell: one transistor on top, one capacitor below, just like we saw two scenes ago. The capacitor holds one bit. The transistor is the door. The word line opens or closes every door on its row at the same time. Look at the mini icons inside each cell \u2014 that's what's inside.`,
            dur: 21000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Every Cell Is 1T + 1C \u2014 Look Inside', C().edgeRise);
              _drawByteReadFilm(b);
              b.setLabel('Each tiny cell box = 1 transistor (top) + 1 capacitor (bottom). The atom of DRAM.', C().edgeRise);
            } },

          { text: `Now watch. First we read ONE bit. The word line rises, every cell on row 1 has its door open, but we only tap ONE bit line \u2014 so only one cell's charge reaches the output. One bit in, one bit out. Width = 1.`,
            dur: 18000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Width = 1 \u2014 Reading Just ONE Bit', C().edgeRise);
              _drawByteReadFilm(b);
              b.setLabel('Word line opens all 8 doors, but only 1 bit line is tapped. Output = 1 bit.', C().edgeRise);
            } },

          { text: `Now 4 bits. We tap FOUR bit lines at the same time. All four cells dump their charge in parallel. The output is 4 bits wide, which we call a NIBBLE \u2014 half a byte. No extra time needed. Same word line pulse, just more columns tapped.`,
            dur: 20000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Width = 4 \u2014 Reading A NIBBLE', C().edgeRise);
              _drawByteReadFilm(b);
              b.setLabel('4 bit lines active in parallel. 4 cells read at once. Nibble = half a byte.', C().edgeRise);
            } },

          { text: `Now 8 bits \u2014 one full BYTE. All eight bit lines tapped. All eight cells on the row dump their charge at once. Eight sense amps fire in parallel. Eight bits appear on the data bus as ONE byte. This is what your CPU actually gets when it does a byte read. Not one bit at a time. All eight, at the same moment.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Width = 8 \u2014 Reading ONE BYTE', C().edgeRise);
              _drawByteReadFilm(b);
              b.setLabel('All 8 bit lines in parallel. 8 cells read simultaneously. That\u2019s 1 byte.', C().edgeRise);
            } },

          { text: `Key point. The word line selects the ROW \u2014 that is the address. The number of bit lines tapped is the WORD WIDTH \u2014 that is decided by the chip's design. A DRAM chip physically designed for 8-bit bytes has 8 bit lines per byte. A modern chip might have 64 bit lines, so every read returns 8 bytes in parallel. Same picture, wider.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Row = Address. Number Of Bit Lines = Width.', C().edgeRise);
              _drawByteReadFilm(b);
              b.setLabel('Row decoder picks ROW (address). Columns tapped in parallel = WORD WIDTH.', C().edgeRise);
            } },

          { text: `So when the CPU asks for "the byte at address 0x1234", the memory controller activates word line row 0x1234 (row decode), and all 8 bit lines fire at once to deliver one byte to the data bus. 0x1234 is a BYTE address. Reading a different byte means activating a different row. But 8 cells always read together.`,
            dur: 22000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Byte Address = One Row. 8 Bit Lines Deliver 1 Byte.', C().edgeRise);
              _drawByteReadFilm(b);
              b.setLabel('Every byte read = one row activated + all 8 bit lines tapped. Always parallel.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 6 — READ CYCLE  (SILENCE-TEST REWRITE)
    //
    // The whole read happens as one continuous 45-second silent film.
    // A viewer on mute should be able to follow the entire story by
    // watching the animation.  Narration is a single short caption.
    // Every beat is a visible on-screen event — nothing is implied.
    // ════════════════════════════════════════════════════
    {
      id: 12,
      title: 'Watch A Read Happen',
      pages: [
        { sentences: [
          { text: `Watch a RAM read happen. Mute the audio if you like — the animation alone tells the whole story. Address arrives. Row decoded. Word line fires. Cells dump. Sense amps boost. Column picked. Data emerges. Take your time.`,
            dur: 46000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('One Read \u2014 Start To Finish', C().edgeRise);
              _drawRAMReadSilentFilm(b);
              b.setLabel('Every stage is a distinct on-screen event. Watch the signal flow with your eyes, not your ears.', C().accent);
            } },

          { text: `Same read, frozen at the key moment — the word line has just finished spreading, and every cell in the selected row has dumped its bit onto its bit line. This is the instant that makes RAM fast. Thousands of cells, all reading in parallel.`,
            dur: 12000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Freeze-Frame \u2014 The Parallel Moment', C().edgeRise);
              _drawRAMReadSilentFilm(b, { freezeAtMs: 11000 });
              b.setLabel('Whole row fired at once. This is the physical reality behind \u201crandom access.\u201d', C().edgeRise);
            } },

          { text: `Freeze-frame later — sense amplifiers lit, column decoder has picked one column. Only one of those bits will make it to the outside world. This is the selection step — narrow the many down to the one.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Freeze-Frame \u2014 The Selection', C().edgeRise);
              _drawRAMReadSilentFilm(b, { freezeAtMs: 16000 });
              b.setLabel('Many cells read the whole row in parallel \u2014 then one bit is chosen. Read is wide then narrow.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 7 — WRITE CYCLE
    // ════════════════════════════════════════════════════
    {
      id: 13,
      title: 'The Write Cycle',
      pages: [
        { sentences: [
          { text: `Writing works the same way, in reverse. The CPU puts an address on the address bus, puts the data on the data bus, and sets R/W to "write". The decoders fire as before — row and column decoded independently.`,
            dur: 13000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Write — Same Addressing, Different Direction', C().accent);
              _drawMemoryGrid(b, { rows: 10, cols: 14, cellSz: 26, x: 300, y: 180, activeRow: 3, activeCol: 5 });
              b.drawNode('din', 900, 480, '← data in', C().edgeRise);
              b.setLabel('Row + column again picks exactly one cell. But now data flows toward it.', C().accent);
            } },

          { text: `The write-enable circuitry forces the selected cell\u2019s storage node to the value on the data bus — overwriting whatever was there. In an SRAM cell, that means the bit lines drive the cross-coupled latch into the new state. In a DRAM cell, it means charging or discharging the capacitor.`,
            dur: 16500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Cell Is Forced Into The New State', C().accent);
              b.drawBox('sram-title', 130, 180, 300, 30, 'SRAM write:', C().accent);
              b.drawNode('sr1', 280, 240, 'bit lines drive latch into new state', C().accent);
              b.drawBox('dram-title', 570, 180, 300, 30, 'DRAM write:', C().accent);
              b.drawNode('dr1', 720, 240, 'bit line charges / drains the cap',    C().accent);
              b.drawNode('common', 500, 400, 'either way — one cycle, new bit stored', C().edgeRise);
              b.setLabel('Different mechanics per cell type. Same logical effect: the cell now holds the new value.', C().accent);
            } },

          { text: `After the write, the cell holds the new value as long as the power stays on — or, in DRAM, until the charge leaks away and the refresh controller reads it back and rewrites it. That\u2019s the entire read/write protocol, at the level of one RAM chip.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('After The Write — The Bit Persists', C().edgeRise);
              _drawMemoryGrid(b, { rows: 10, cols: 14, cellSz: 26, x: 300, y: 180, activeRow: 3, activeCol: 5 });
              b.drawNode('held', 500, 520, 'bit is now stored — for as long as power (and refresh) hold it', C().edgeRise);
              b.setLabel('Every variable in every running program ends up as a few of these cells, somewhere.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 8 — MEMORY HIERARCHY
    // ════════════════════════════════════════════════════
    {
      id: 14,
      title: 'The Memory Hierarchy',
      pages: [
        { sentences: [
          { text: `A real computer doesn\u2019t have just one flat pool of memory. It has a hierarchy — a pyramid with fast, small, expensive storage on top, and slow, big, cheap storage on the bottom. The CPU talks directly to the top layer; every layer below exists to back up the one above.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Pyramid', C().accent);
              b.drawCustom('pyramid', (g, NS, COL) => {
                const levels = [
                  { label: 'registers',        size: '~1 KB',    speed: '1 clock',   width: 140, fill: COL.edgeRise },
                  { label: 'L1 cache (SRAM)',  size: '~64 KB',   speed: '~3 clocks', width: 240, fill: COL.edgeRise },
                  { label: 'L2 cache (SRAM)',  size: '~1 MB',    speed: '~10 clocks', width: 340, fill: COL.accent },
                  { label: 'L3 cache (SRAM)',  size: '~32 MB',   speed: '~30 clocks', width: 440, fill: COL.accent },
                  { label: 'main memory (DRAM)', size: '~16 GB', speed: '~200 clocks', width: 540, fill: COL.accent },
                  { label: 'SSD',              size: '~1 TB',    speed: '~100,000 clocks', width: 640, fill: COL.label },
                  { label: 'spinning disk',    size: '~10 TB',   speed: '~10 million',     width: 740, fill: COL.dim },
                ];
                levels.forEach((l, i) => {
                  const y = 180 + i * 45;
                  const cx = 500;
                  const rect = document.createElementNS(NS, 'rect');
                  rect.setAttribute('x', cx - l.width / 2); rect.setAttribute('y', y);
                  rect.setAttribute('width', l.width); rect.setAttribute('height', 36);
                  rect.setAttribute('rx', 4);
                  rect.setAttribute('fill', l.fill); rect.setAttribute('opacity', '0.3');
                  rect.setAttribute('stroke', l.fill); rect.setAttribute('stroke-width', '1.5');
                  g.appendChild(rect);
                  const nm = document.createElementNS(NS, 'text');
                  nm.setAttribute('x', cx); nm.setAttribute('y', y + 22);
                  nm.setAttribute('text-anchor', 'middle');
                  nm.setAttribute('font-family', 'monospace');
                  nm.setAttribute('font-size', '13');
                  nm.setAttribute('font-weight', '700');
                  nm.setAttribute('fill', l.fill);
                  nm.textContent = l.label + '  ·  ' + l.size + '  ·  ' + l.speed; g.appendChild(nm);
                });
              });
              b.setLabel('Small and fast at the top. Big and slow at the bottom. Each layer caches the next.', C().accent);
            } },

          { text: `Why can\u2019t we just make RAM as fast as registers? Physics. Speed costs transistors and silicon area. A 16-GB register file would be the size of a refrigerator. A 16-GB L1 cache would still be too expensive. DRAM hits the sweet spot: huge and cheap, at the cost of a 100× speed penalty.`,
            dur: 15500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Physics Forces The Trade-Off', C().accent);
              b.drawCustom('tradeoff', (g, NS, COL) => {
                const lines = [
                  'fast memory → big transistors → lots of area → expensive',
                  'dense memory → small transistors → slow → cheap',
                  '',
                  'hierarchy is the architectural way out:',
                  'keep hot data in fast layers, cold data in slow layers',
                ];
                lines.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 140); t.setAttribute('y', 240 + i * 45);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '15');
                  t.setAttribute('fill', i >= 3 ? COL.edgeRise : COL.accent);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('The memory hierarchy exists because there is no single "right" memory technology.', C().accent);
            } },

          { text: `Every time the CPU asks for data, the cache controller checks the top of the pyramid first. Hit? Return in three clocks. Miss? Try the next level. Miss again? Next level. All the way down to disk if necessary. Each miss costs orders of magnitude more time — which is why good programmers care deeply about data layout and cache friendliness.`,
            dur: 16500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('The Walk Down The Pyramid', C().accent);
              b.drawCustom('walk', (g, NS, COL) => {
                const steps = [
                  ['L1 hit:',  '~3 clocks    (common case)'],
                  ['L1 miss → L2 hit:',  '~10 clocks'],
                  ['L2 miss → L3 hit:',  '~30 clocks'],
                  ['L3 miss → DRAM:',    '~200 clocks'],
                  ['page fault → SSD:',  '~100,000 clocks'],
                ];
                steps.forEach((s, i) => {
                  const y = 230 + i * 50;
                  const a = document.createElementNS(NS, 'text');
                  a.setAttribute('x', 360); a.setAttribute('y', y);
                  a.setAttribute('text-anchor', 'end');
                  a.setAttribute('font-family', 'monospace');
                  a.setAttribute('font-size', '15');
                  a.setAttribute('font-weight', '700');
                  a.setAttribute('fill', COL.accent);
                  a.textContent = s[0]; g.appendChild(a);
                  const b_ = document.createElementNS(NS, 'text');
                  b_.setAttribute('x', 380); b_.setAttribute('y', y);
                  b_.setAttribute('font-family', 'monospace');
                  b_.setAttribute('font-size', '15');
                  b_.setAttribute('fill', i === 4 ? COL.wireHot : COL.label);
                  b_.textContent = s[1]; g.appendChild(b_);
                });
              });
              b.setLabel('The gap between L1 and a page fault is 5 orders of magnitude. Hence "cache-friendly code."', C().accent);
            } },
        ] },
      ],
      showAll: true,
    },

    // ════════════════════════════════════════════════════
    // SCENE 9 — RECAP + SERIES B FINALE
    // ════════════════════════════════════════════════════
    {
      id: 15,
      title: 'Recap — And The End Of Series B',
      pages: [
        { sentences: [
          { text: `Trace the build of RAM. One storage cell — either six transistors of SRAM\u2019s cross-coupled latch, or one transistor plus one capacitor of DRAM. Each holds one bit.`,
            dur: 11000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 1 — The Storage Cell', C().accent);
              _drawSRAMCell(b, { x: 250, y: 320 });
              _drawDRAMCell(b, { x: 800, y: 280 });
              b.setLabel('SRAM: fast, big cells. DRAM: slow, tiny cells. Both hold one bit.', C().accent);
            } },

          { text: `Tile those cells into a square grid. Run word lines horizontally, bit lines vertically. Every cell sits at an intersection, addressable by row and column.`,
            dur: 10500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 2 — The 2D Grid', C().accent);
              _drawMemoryGrid(b, { rows: 12, cols: 16, cellSz: 22, x: 340, y: 180 });
              b.setLabel('Physical tiling. Millions of cells, very short wires between neighbours.', C().accent);
            } },

          { text: `Two decoders on the edges — one for rows, one for columns — turn an address into a specific cell. They are literally the decoders from Episode 5, operating in a 2D layout.`,
            dur: 11500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 3 — Row + Column Decoders', C().accent);
              _drawMemoryGrid(b, { rows: 12, cols: 16, cellSz: 22, x: 340, y: 180, activeRow: 5, activeCol: 9 });
              b.setLabel('Every RAM chip is two decoders around a rectangular cell array. That\u2019s it.', C().accent);
            } },

          { text: `A read: row decoder activates one word line, cells drive bit lines, sense amps boost, column MUX selects the wanted bit, data goes out. A write: same path, reversed — data on the bus drives the selected cell into a new state.`,
            dur: 13500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 4 — Read And Write', C().edgeRise);
              _drawMemoryGrid(b, { rows: 12, cols: 16, cellSz: 22, x: 340, y: 180, activeRow: 5, activeCol: 9 });
              b.setLabel('One protocol. Two directions. Row decode → column select → cell access.', C().edgeRise);
            } },

          { text: `And RAM is only one layer in a larger pyramid — registers at the top, L1 and L2 caches below, main DRAM below that, disk at the bottom. Each layer is a cache for the slower layer below. Every byte a running program uses lives somewhere on that pyramid, at any given moment.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Step 5 — The Memory Hierarchy', C().accent);
              b.drawCustom('pyr', (g, NS, COL) => {
                const levels = [
                  { label: 'registers',    width: 120 },
                  { label: 'L1 SRAM',      width: 220 },
                  { label: 'L2 SRAM',      width: 320 },
                  { label: 'L3 SRAM',      width: 420 },
                  { label: 'DRAM',         width: 520 },
                  { label: 'SSD',          width: 620 },
                ];
                levels.forEach((l, i) => {
                  const y = 200 + i * 50;
                  const cx = 500;
                  const rect = document.createElementNS(NS, 'rect');
                  rect.setAttribute('x', cx - l.width / 2); rect.setAttribute('y', y);
                  rect.setAttribute('width', l.width); rect.setAttribute('height', 40);
                  rect.setAttribute('rx', 4);
                  rect.setAttribute('fill', COL.edgeRise); rect.setAttribute('opacity', '0.2');
                  rect.setAttribute('stroke', COL.edgeRise); rect.setAttribute('stroke-width', '1.5');
                  g.appendChild(rect);
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', cx); t.setAttribute('y', y + 25);
                  t.setAttribute('text-anchor', 'middle');
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '14');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', COL.edgeRise);
                  t.textContent = l.label; g.appendChild(t);
                });
              });
              b.setLabel('RAM is the middle of this pyramid. Critical. But not alone.', C().accent);
            } },

          { text: `And with that, Series B is complete. Ten episodes. Clock. Flip-flop. Register. Counter. Decoder. Multiplexer. Comparator. Adder. ALU. And now RAM. From a single vibrating crystal up through the full arithmetic and memory capability of a CPU.`,
            dur: 14500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Series B — Complete', C().edgeRise);
              b.drawCustom('list', (g, NS, COL) => {
                const eps = [
                  '1.  The Clock',
                  '2.  The Flip-Flop',
                  '3.  The Register',
                  '4.  The Counter',
                  '5.  The Decoder',
                  '6.  The Multiplexer',
                  '7.  The Comparator',
                  '8.  The Adder',
                  '9.  The ALU',
                  '10. RAM',
                ];
                eps.forEach((l, i) => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', 380); t.setAttribute('y', 190 + i * 35);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '18');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', COL.edgeRise);
                  t.textContent = l; g.appendChild(t);
                });
              });
              b.setLabel('Each episode solving one physical problem. Together: a CPU.', C().edgeRise);
            } },

          { text: `Every piece of a modern CPU — from a smart watch to a server rack — is built from the handful of blocks in this series, multiplied and arranged. You now know how they are made. The rest is just more of the same.`,
            dur: 12500,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('You Know How They\u2019re Built', C().edgeRise);
              b.drawChipOutline('die', 200, 180, 600, 320, 'a CPU');
              b.drawCustom('sprinkle', (g, NS, COL) => {
                const labels = [
                  { t: 'FF',    x: 280, y: 240 },
                  { t: 'MUX',   x: 360, y: 220 },
                  { t: 'ALU',   x: 480, y: 240 },
                  { t: 'DEC',   x: 600, y: 220 },
                  { t: 'REG',   x: 340, y: 300 },
                  { t: 'CMP',   x: 460, y: 300 },
                  { t: 'ADDER', x: 580, y: 300 },
                  { t: 'COUNT', x: 700, y: 240 },
                  { t: 'RAM',   x: 720, y: 360 },
                  { t: 'CLK',   x: 300, y: 400 },
                  { t: 'FF',    x: 420, y: 400 },
                  { t: 'MUX',   x: 540, y: 400 },
                  { t: 'DEC',   x: 660, y: 400 },
                  { t: 'FF',    x: 380, y: 460 },
                  { t: 'ALU',   x: 540, y: 460 },
                ];
                labels.forEach(l => {
                  const t = document.createElementNS(NS, 'text');
                  t.setAttribute('x', l.x); t.setAttribute('y', l.y);
                  t.setAttribute('font-family', 'monospace');
                  t.setAttribute('font-size', '13');
                  t.setAttribute('font-weight', '700');
                  t.setAttribute('fill', COL.edgeRise);
                  t.textContent = l.t; g.appendChild(t);
                });
              });
              b.setLabel('Thousands of copies. Billions of transistors. All the same ten ideas.', C().edgeRise);
            } },

          { text: `Series A — the CPU architecture series — showed you how these blocks cooperate to execute instructions. Series B, which ends here, showed you how each block is actually constructed. Together, they\u2019re a complete mental model from the bedrock of physics up to the running program. Thanks for watching.`,
            dur: 16000,
            anim: () => {
              const b = B(); b.clear();
              b.setTitle('Two Series, One Complete Picture', C().edgeRise);
              b.drawBox('a', 140, 240, 320, 160, 'SERIES A\n\nCPU architecture\nin operation', C().accent);
              b.drawBox('b', 540, 240, 320, 160, 'SERIES B\n\nbuilding blocks\nfrom physics up', C().edgeRise);
              b.drawNode('meet', 500, 440, 'top-down + bottom-up = a whole understanding', C().edgeRise);
              b.setLabel('End of Series B. The CPU is no longer a black box. Congratulations.', C().edgeRise);
            } },
        ] },
      ],
      showAll: true,
      isFinal: true,
    },
  ];

  if (typeof window !== 'undefined') {
    window.BLOCKS_10_SCENES = BLOCKS_10_SCENES;
  }
})();
