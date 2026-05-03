/**
 * Blocks Core — gate-level SVG surface for Series B (Building Blocks).
 * ----------------------------------------------------------------
 * Lives in its own namespace (window.Blocks) so it cannot collide with the
 * Series A CPU-diagram helpers (_dimAll, _glowComp, CPU_COMPS, _diagSVG).
 *
 * Each Series B episode calls these primitives inside its scene anim()
 * callbacks. The tutorial engine in tutorial.js calls:
 *
 *   Blocks.build(container)   — mount the SVG surface
 *   Blocks.teardown()         — remove the surface
 *   Blocks.resetScene()       — clear per-scene transient state
 *
 * Primitives (all return the element they created, so episodes can tweak):
 *
 *   Blocks.clear()                    — wipe stage (keep surface)
 *   Blocks.setTitle(text, color?)
 *   Blocks.setLabel(text, color?)     — bottom caption (walk-the-talk)
 *   Blocks.drawGate(id, kind, x, y, w, h)    — kind: NAND|AND|OR|NOT|XOR|NOR|XNOR
 *   Blocks.drawBox(id, x, y, w, h, label, color)
 *   Blocks.drawWire(id, pts, color)   — pts = [[x,y],[x,y],...]
 *   Blocks.drawNode(id, x, y, label, color)  — labelled pin/dot
 *   Blocks.drawWaveform(id, x, y, w, h, sampler, opts) — animated square wave
 *   Blocks.markEdge(id, x, y, kind)   — kind: 'rising'|'falling'
 *   Blocks.drawTruthTable(id, x, y, header, rows)
 *   Blocks.setState(id, state)        — state: 'dim'|'normal'|'glow'|'hot'
 *   Blocks.setWireHigh(id, high)      — colour a wire according to logic level
 *   Blocks.pulseWire(id, color, ms)   — flash a wire
 *   Blocks.dimAll() / Blocks.normalAll()
 *
 * Walk-the-talk: every element has a stable id so an episode's anim() can
 * drive exactly the state the narration describes.
 */

(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const STAGE_W = 1000;
  const STAGE_H = 620;

  // Palette — distinct from CPU diagram so visual style reads as "different series".
  const COL = {
    bg:       '#06090f',
    panel:    '#0a0f1a',
    grid:     '#111a2a',
    axis:     '#233345',
    wireLo:   '#3a4a60',   // logic low (dim grey-blue)
    wireHi:   '#ffcc33',   // logic high (amber)
    wireHot:  '#ff4444',   // active / pulsing
    gateFill: '#0e1624',
    gateEdge: '#4a8cc0',
    gateText: '#cde',
    boxFill:  '#0e1624',
    boxEdge:  '#7aa8d0',
    node:     '#88c0f0',
    label:    '#9ab',
    title:    '#e8f0f8',
    edgeRise: '#00ff88',
    edgeFall: '#ff88cc',
    dim:      '#1a2430',
    dimText:  '#334',
    accent:   '#00ddff',
  };

  // ─────────────────────────────────────────
  //  State
  // ─────────────────────────────────────────
  let _container = null;
  let _svg       = null;
  let _layer     = null;      // main <g> holding all drawn elements
  let _titleEl   = null;
  let _labelEl   = null;
  const _elements = new Map();  // id -> { el, kind, meta }
  let _rafId = 0;
  const _wavers = new Map();    // id -> { x, y, w, h, sampler, path, t0, opts }
  const _animators = new Map(); // id -> { fn, t0 } — arbitrary per-frame updater
  const _timers = [];           // setTimeout ids to clear on teardown / scene reset

  // ─────────────────────────────────────────
  //  Build / teardown / reset
  // ─────────────────────────────────────────
  function build(container) {
    if (!container) return;
    if (_svg && _container === container) {
      // Already mounted here — just clear stage for a fresh scene.
      clear();
      return;
    }
    teardown();
    _container = container;
    container.innerHTML = '';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${STAGE_W} ${STAGE_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.background = COL.bg;
    svg.style.display = 'block';
    svg.style.borderRadius = '6px';
    container.appendChild(svg);
    _svg = svg;

    // Background grid for visual context (subtle).
    const grid = document.createElementNS(SVG_NS, 'g');
    grid.setAttribute('class', 'blocks-grid');
    for (let x = 0; x < STAGE_W; x += 40) {
      const l = document.createElementNS(SVG_NS, 'line');
      l.setAttribute('x1', x); l.setAttribute('x2', x);
      l.setAttribute('y1', 0); l.setAttribute('y2', STAGE_H);
      l.setAttribute('stroke', COL.grid);
      l.setAttribute('stroke-width', '0.5');
      grid.appendChild(l);
    }
    for (let y = 0; y < STAGE_H; y += 40) {
      const l = document.createElementNS(SVG_NS, 'line');
      l.setAttribute('y1', y); l.setAttribute('y2', y);
      l.setAttribute('x1', 0); l.setAttribute('x2', STAGE_W);
      l.setAttribute('stroke', COL.grid);
      l.setAttribute('stroke-width', '0.5');
      grid.appendChild(l);
    }
    svg.appendChild(grid);

    // Layer that episodes draw into.
    _layer = document.createElementNS(SVG_NS, 'g');
    _layer.setAttribute('class', 'blocks-layer');
    svg.appendChild(_layer);

    // Title (top) and label (bottom) overlays — drawn OUTSIDE the layer so
    // clear() doesn't wipe them.
    _titleEl = document.createElementNS(SVG_NS, 'text');
    _titleEl.setAttribute('x', STAGE_W / 2);
    _titleEl.setAttribute('y', 36);
    _titleEl.setAttribute('text-anchor', 'middle');
    _titleEl.setAttribute('font-family', 'monospace');
    _titleEl.setAttribute('font-size', '20');
    _titleEl.setAttribute('font-weight', '700');
    _titleEl.setAttribute('fill', COL.title);
    svg.appendChild(_titleEl);

    _labelEl = document.createElementNS(SVG_NS, 'text');
    _labelEl.setAttribute('x', STAGE_W / 2);
    _labelEl.setAttribute('y', STAGE_H - 24);
    _labelEl.setAttribute('text-anchor', 'middle');
    _labelEl.setAttribute('font-family', 'monospace');
    _labelEl.setAttribute('font-size', '15');
    _labelEl.setAttribute('fill', COL.label);
    svg.appendChild(_labelEl);

    _startRaf();
  }

  function teardown() {
    _stopRaf();
    _clearTimers();
    if (_container) _container.innerHTML = '';
    _container = null;
    _svg = null;
    _layer = null;
    _titleEl = null;
    _labelEl = null;
    _elements.clear();
    _wavers.clear();
    _animators.clear();
  }

  function resetScene() {
    _clearTimers();
    clear();
  }

  function clear() {
    if (_layer) while (_layer.firstChild) _layer.removeChild(_layer.firstChild);
    _elements.clear();
    _wavers.clear();
    _animators.clear();
    if (_titleEl) _titleEl.textContent = '';
    if (_labelEl) _labelEl.textContent = '';
  }

  // Register a per-frame updater. fn receives (elapsedMs, elementRecord).
  // Automatically cleared on scene reset / clear / teardown.
  function animate(id, fn) {
    if (typeof fn !== 'function') return;
    _animators.set(id, { fn, t0: performance.now() });
  }
  function stopAnimate(id) { _animators.delete(id); }

  // ─────────────────────────────────────────
  //  Title / Label
  // ─────────────────────────────────────────
  function setTitle(text, color) {
    if (!_titleEl) return;
    _titleEl.textContent = text || '';
    _titleEl.setAttribute('fill', color || COL.title);
  }
  function setLabel(text, color) {
    if (!_labelEl) return;
    _labelEl.textContent = text || '';
    _labelEl.setAttribute('fill', color || COL.label);
  }

  // ─────────────────────────────────────────
  //  Gate symbols (ANSI/IEEE 91 simplified)
  // ─────────────────────────────────────────
  function drawGate(id, kind, x, y, w, h) {
    if (!_layer) return null;
    kind = (kind || 'AND').toUpperCase();
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'blk-gate');
    g.setAttribute('data-id', id);
    g.setAttribute('data-kind', kind);
    g.setAttribute('transform', `translate(${x},${y})`);

    const shape = document.createElementNS(SVG_NS, 'path');
    shape.setAttribute('fill', COL.gateFill);
    shape.setAttribute('stroke', COL.gateEdge);
    shape.setAttribute('stroke-width', '2');
    shape.setAttribute('d', _gatePath(kind, w, h));
    g.appendChild(shape);

    // Optional inversion bubble (NAND/NOR/XNOR/NOT).
    if (kind === 'NAND' || kind === 'NOR' || kind === 'XNOR' || kind === 'NOT') {
      const bub = document.createElementNS(SVG_NS, 'circle');
      bub.setAttribute('cx', w + 6);
      bub.setAttribute('cy', h / 2);
      bub.setAttribute('r', 5);
      bub.setAttribute('fill', COL.gateFill);
      bub.setAttribute('stroke', COL.gateEdge);
      bub.setAttribute('stroke-width', '2');
      g.appendChild(bub);
    }

    // Label inside
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', w * 0.45);
    t.setAttribute('y', h / 2 + 4);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-family', 'monospace');
    t.setAttribute('font-size', '13');
    t.setAttribute('font-weight', '700');
    t.setAttribute('fill', COL.gateText);
    t.textContent = kind;
    g.appendChild(t);

    _layer.appendChild(g);
    _elements.set(id, { el: g, kind: 'gate', meta: { x, y, w, h, kind } });
    return g;
  }

  function _gatePath(kind, w, h) {
    // All shapes sit in rect 0,0,w,h. Output point is (w, h/2).
    if (kind === 'NOT') {
      // triangle
      return `M 0 0 L 0 ${h} L ${w} ${h/2} Z`;
    }
    if (kind === 'OR' || kind === 'NOR' || kind === 'XOR' || kind === 'XNOR') {
      // OR shape: curved back, pointed tip.
      const back  = `M 0 0 Q ${w*0.3} ${h/2} 0 ${h}`;
      const body  = `L ${w*0.5} ${h} Q ${w*0.95} ${h*0.8} ${w} ${h/2} Q ${w*0.95} ${h*0.2} ${w*0.5} 0 Z`;
      return back + ' ' + body;
    }
    // AND / NAND: flat back, semicircle front.
    return `M 0 0 L ${w*0.5} 0 A ${w*0.5} ${h/2} 0 0 1 ${w*0.5} ${h} L 0 ${h} Z`;
  }

  // ─────────────────────────────────────────
  //  Box (generic labelled rectangle — oscillator, FF, register, RAM, etc.)
  // ─────────────────────────────────────────
  function drawBox(id, x, y, w, h, label, color) {
    if (!_layer) return null;
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'blk-box');
    g.setAttribute('data-id', id);
    g.setAttribute('transform', `translate(${x},${y})`);

    const r = document.createElementNS(SVG_NS, 'rect');
    r.setAttribute('x', 0); r.setAttribute('y', 0);
    r.setAttribute('width', w); r.setAttribute('height', h);
    r.setAttribute('rx', 6); r.setAttribute('ry', 6);
    r.setAttribute('fill', COL.boxFill);
    r.setAttribute('stroke', color || COL.boxEdge);
    r.setAttribute('stroke-width', '2');
    g.appendChild(r);

    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', w / 2);
    t.setAttribute('y', h / 2 + 5);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-family', 'monospace');
    t.setAttribute('font-size', '14');
    t.setAttribute('font-weight', '700');
    t.setAttribute('fill', color || COL.boxEdge);
    t.textContent = label || id;
    g.appendChild(t);

    _layer.appendChild(g);
    _elements.set(id, { el: g, kind: 'box', meta: { x, y, w, h } });
    return g;
  }

  // ─────────────────────────────────────────
  //  Escape hatch — custom SVG for bespoke diagrams.
  //   builderFn(g, NS) receives an empty <g> already in the layer and the
  //   SVG namespace URI. Add whatever children you like.
  // ─────────────────────────────────────────
  function drawCustom(id, builderFn) {
    if (!_layer || typeof builderFn !== 'function') return null;
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'blk-custom');
    g.setAttribute('data-id', id);
    _layer.appendChild(g);
    try { builderFn(g, SVG_NS, COL); } catch (e) { console.warn('drawCustom error:', e); }
    _elements.set(id, { el: g, kind: 'custom', meta: {} });
    return g;
  }

  // ─────────────────────────────────────────
  //  Crystal schematic symbol
  //  IEEE symbol: two vertical plates with a rectangle (the quartz) between them.
  // ─────────────────────────────────────────
  function drawCrystalSymbol(id, x, y, w, h, label) {
    if (!_layer) return null;
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'blk-xtal');
    g.setAttribute('data-id', id);
    g.setAttribute('transform', `translate(${x},${y})`);

    const plateGap = w * 0.18;
    const plateX1  = w * 0.25;
    const plateX2  = w - plateX1;

    // Left plate
    const p1 = document.createElementNS(SVG_NS, 'line');
    p1.setAttribute('x1', plateX1); p1.setAttribute('x2', plateX1);
    p1.setAttribute('y1', h * 0.15); p1.setAttribute('y2', h * 0.85);
    p1.setAttribute('stroke', COL.gateEdge);
    p1.setAttribute('stroke-width', '3');
    g.appendChild(p1);

    // Right plate
    const p2 = document.createElementNS(SVG_NS, 'line');
    p2.setAttribute('x1', plateX2); p2.setAttribute('x2', plateX2);
    p2.setAttribute('y1', h * 0.15); p2.setAttribute('y2', h * 0.85);
    p2.setAttribute('stroke', COL.gateEdge);
    p2.setAttribute('stroke-width', '3');
    g.appendChild(p2);

    // Quartz rectangle (in the middle)
    const quartzX = plateX1 + plateGap / 2;
    const quartzW = plateX2 - plateX1 - plateGap;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', quartzX);
    rect.setAttribute('y', h * 0.25);
    rect.setAttribute('width', quartzW);
    rect.setAttribute('height', h * 0.50);
    rect.setAttribute('fill', COL.boxFill);
    rect.setAttribute('stroke', COL.accent);
    rect.setAttribute('stroke-width', '2');
    g.appendChild(rect);

    // Pigtail wires (stubs to allow outside wiring)
    const stubL = document.createElementNS(SVG_NS, 'line');
    stubL.setAttribute('x1', 0); stubL.setAttribute('x2', plateX1);
    stubL.setAttribute('y1', h / 2); stubL.setAttribute('y2', h / 2);
    stubL.setAttribute('stroke', COL.wireLo); stubL.setAttribute('stroke-width', '2');
    g.appendChild(stubL);
    const stubR = document.createElementNS(SVG_NS, 'line');
    stubR.setAttribute('x1', plateX2); stubR.setAttribute('x2', w);
    stubR.setAttribute('y1', h / 2); stubR.setAttribute('y2', h / 2);
    stubR.setAttribute('stroke', COL.wireLo); stubR.setAttribute('stroke-width', '2');
    g.appendChild(stubR);

    if (label) {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', w / 2); t.setAttribute('y', h + 16);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-family', 'monospace');
      t.setAttribute('font-size', '12');
      t.setAttribute('font-weight', '700');
      t.setAttribute('fill', COL.accent);
      t.textContent = label;
      g.appendChild(t);
    }

    _layer.appendChild(g);
    _elements.set(id, { el: g, kind: 'xtal', meta: { x, y, w, h } });
    return g;
  }

  // ─────────────────────────────────────────
  //  Capacitor symbol — two parallel plates
  //  orientation: 'v' (default, plates horizontal, leads up/down)
  //               'h' (plates vertical, leads left/right)
  // ─────────────────────────────────────────
  function drawCapacitor(id, x, y, w, h, orientation, label) {
    if (!_layer) return null;
    orientation = orientation || 'v';
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'blk-cap');
    g.setAttribute('data-id', id);
    g.setAttribute('transform', `translate(${x},${y})`);

    if (orientation === 'v') {
      // Top plate + bottom plate horizontal
      const p1 = document.createElementNS(SVG_NS, 'line');
      p1.setAttribute('x1', 0); p1.setAttribute('x2', w);
      p1.setAttribute('y1', h * 0.45); p1.setAttribute('y2', h * 0.45);
      p1.setAttribute('stroke', COL.gateEdge); p1.setAttribute('stroke-width', '3');
      g.appendChild(p1);
      const p2 = document.createElementNS(SVG_NS, 'line');
      p2.setAttribute('x1', 0); p2.setAttribute('x2', w);
      p2.setAttribute('y1', h * 0.55); p2.setAttribute('y2', h * 0.55);
      p2.setAttribute('stroke', COL.gateEdge); p2.setAttribute('stroke-width', '3');
      g.appendChild(p2);
      const sTop = document.createElementNS(SVG_NS, 'line');
      sTop.setAttribute('x1', w / 2); sTop.setAttribute('x2', w / 2);
      sTop.setAttribute('y1', 0); sTop.setAttribute('y2', h * 0.45);
      sTop.setAttribute('stroke', COL.wireLo); sTop.setAttribute('stroke-width', '2');
      g.appendChild(sTop);
      const sBot = document.createElementNS(SVG_NS, 'line');
      sBot.setAttribute('x1', w / 2); sBot.setAttribute('x2', w / 2);
      sBot.setAttribute('y1', h * 0.55); sBot.setAttribute('y2', h);
      sBot.setAttribute('stroke', COL.wireLo); sBot.setAttribute('stroke-width', '2');
      g.appendChild(sBot);
    } else {
      // Plates vertical, leads left/right
      const p1 = document.createElementNS(SVG_NS, 'line');
      p1.setAttribute('y1', 0); p1.setAttribute('y2', h);
      p1.setAttribute('x1', w * 0.45); p1.setAttribute('x2', w * 0.45);
      p1.setAttribute('stroke', COL.gateEdge); p1.setAttribute('stroke-width', '3');
      g.appendChild(p1);
      const p2 = document.createElementNS(SVG_NS, 'line');
      p2.setAttribute('y1', 0); p2.setAttribute('y2', h);
      p2.setAttribute('x1', w * 0.55); p2.setAttribute('x2', w * 0.55);
      p2.setAttribute('stroke', COL.gateEdge); p2.setAttribute('stroke-width', '3');
      g.appendChild(p2);
    }

    if (label) {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', w + 6); t.setAttribute('y', h / 2 + 4);
      t.setAttribute('font-family', 'monospace');
      t.setAttribute('font-size', '11');
      t.setAttribute('fill', COL.label);
      t.textContent = label;
      g.appendChild(t);
    }

    _layer.appendChild(g);
    _elements.set(id, { el: g, kind: 'cap', meta: { x, y, w, h } });
    return g;
  }

  // ─────────────────────────────────────────
  //  Ground symbol
  // ─────────────────────────────────────────
  function drawGround(id, x, y) {
    if (!_layer) return null;
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'blk-gnd');
    g.setAttribute('data-id', id);
    g.setAttribute('transform', `translate(${x},${y})`);
    // Three decreasing horizontal lines
    [[0,-14,14,1,3], [3,-8,11,1,2], [5,-2,9,1,1]].forEach(([x1,yy,x2,_,n]) => {
      const l = document.createElementNS(SVG_NS, 'line');
      l.setAttribute('x1', x1 - 7); l.setAttribute('x2', x2 - 7);
      l.setAttribute('y1', yy); l.setAttribute('y2', yy);
      l.setAttribute('stroke', COL.wireLo); l.setAttribute('stroke-width', '2');
      g.appendChild(l);
    });
    _layer.appendChild(g);
    _elements.set(id, { el: g, kind: 'gnd', meta: { x, y } });
    return g;
  }

  // ─────────────────────────────────────────
  //  Chip outline — a rounded rectangle representing a die / IC
  // ─────────────────────────────────────────
  function drawChipOutline(id, x, y, w, h, label) {
    if (!_layer) return null;
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'blk-chip');
    g.setAttribute('data-id', id);
    g.setAttribute('transform', `translate(${x},${y})`);
    const r = document.createElementNS(SVG_NS, 'rect');
    r.setAttribute('x', 0); r.setAttribute('y', 0);
    r.setAttribute('width', w); r.setAttribute('height', h);
    r.setAttribute('rx', 10); r.setAttribute('ry', 10);
    r.setAttribute('fill', COL.panel);
    r.setAttribute('stroke', COL.gateEdge);
    r.setAttribute('stroke-width', '2');
    r.setAttribute('stroke-dasharray', '6,4');
    g.appendChild(r);
    if (label) {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', w / 2); t.setAttribute('y', 18);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-family', 'monospace');
      t.setAttribute('font-size', '11');
      t.setAttribute('font-weight', '700');
      t.setAttribute('fill', COL.label);
      t.textContent = label;
      g.appendChild(t);
    }
    _layer.appendChild(g);
    _elements.set(id, { el: g, kind: 'chip', meta: { x, y, w, h } });
    return g;
  }

  // ─────────────────────────────────────────
  //  H-Tree — recursive balanced clock distribution
  //  depth=0 → single point. depth=1 → one H.  depth=n → 4 sub-H-trees at the
  //  four corners of a central H. All branch lengths equal at each level, so
  //  every leaf sees the same path length from the root.
  // ─────────────────────────────────────────
  function drawHTree(id, cx, cy, size, depth, color) {
    if (!_layer) return null;
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'blk-htree');
    g.setAttribute('data-id', id);
    const leafPts = [];
    _recurseH(g, cx, cy, size, depth, color || COL.wireHi, leafPts);
    // Drop a node at every leaf
    leafPts.forEach(([lx, ly]) => {
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', lx); c.setAttribute('cy', ly);
      c.setAttribute('r', 2.5);
      c.setAttribute('fill', color || COL.wireHi);
      g.appendChild(c);
    });
    _layer.appendChild(g);
    _elements.set(id, { el: g, kind: 'htree', meta: { cx, cy, size, depth, leaves: leafPts } });
    return g;
  }

  function _recurseH(parent, cx, cy, size, depth, color, leafPts) {
    const half = size / 2;
    // Draw the "H": a horizontal bar with two vertical bars at its ends.
    const bar = document.createElementNS(SVG_NS, 'line');
    bar.setAttribute('x1', cx - half); bar.setAttribute('x2', cx + half);
    bar.setAttribute('y1', cy); bar.setAttribute('y2', cy);
    bar.setAttribute('stroke', color); bar.setAttribute('stroke-width', '1.5');
    parent.appendChild(bar);
    // Left vertical
    const lv = document.createElementNS(SVG_NS, 'line');
    lv.setAttribute('x1', cx - half); lv.setAttribute('x2', cx - half);
    lv.setAttribute('y1', cy - half); lv.setAttribute('y2', cy + half);
    lv.setAttribute('stroke', color); lv.setAttribute('stroke-width', '1.5');
    parent.appendChild(lv);
    // Right vertical
    const rv = document.createElementNS(SVG_NS, 'line');
    rv.setAttribute('x1', cx + half); rv.setAttribute('x2', cx + half);
    rv.setAttribute('y1', cy - half); rv.setAttribute('y2', cy + half);
    rv.setAttribute('stroke', color); rv.setAttribute('stroke-width', '1.5');
    parent.appendChild(rv);

    const corners = [
      [cx - half, cy - half],
      [cx + half, cy - half],
      [cx - half, cy + half],
      [cx + half, cy + half],
    ];
    if (depth <= 1) {
      corners.forEach(p => leafPts.push(p));
      return;
    }
    corners.forEach(([ccx, ccy]) => _recurseH(parent, ccx, ccy, size / 2, depth - 1, color, leafPts));
  }

  // ─────────────────────────────────────────
  //  Multiplexer — trapezoid, wide side = inputs, narrow side = output.
  //    opts.inputs: number of data inputs (default 2)
  //    opts.label:  centre label (default 'MUX')
  //  Input n is at:  (x, y + h*(n+1)/(inputs+1))
  //  Select stub:    (x + w*0.5, y + h) (bottom)
  //  Output:         (x + w, y + h/2)
  // ─────────────────────────────────────────
  function drawMux(id, x, y, w, h, opts) {
    if (!_layer) return null;
    opts = opts || {};
    const n = opts.inputs || 2;
    const label = opts.label || 'MUX';
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'blk-mux');
    g.setAttribute('data-id', id);
    g.setAttribute('transform', `translate(${x},${y})`);
    const taper = h * 0.18;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', `M 0 0 L ${w} ${taper} L ${w} ${h - taper} L 0 ${h} Z`);
    path.setAttribute('fill', COL.gateFill);
    path.setAttribute('stroke', COL.gateEdge);
    path.setAttribute('stroke-width', '2');
    g.appendChild(path);
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', w * 0.45); t.setAttribute('y', h / 2 + 4);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-family', 'monospace');
    t.setAttribute('font-size', '12');
    t.setAttribute('font-weight', '700');
    t.setAttribute('fill', COL.gateText);
    t.textContent = label;
    g.appendChild(t);
    // Small index number next to each input
    for (let i = 0; i < n; i++) {
      const yy = (h / (n + 1)) * (i + 1);
      const idx = document.createElementNS(SVG_NS, 'text');
      idx.setAttribute('x', 5); idx.setAttribute('y', yy + 3);
      idx.setAttribute('font-family', 'monospace');
      idx.setAttribute('font-size', '10');
      idx.setAttribute('fill', COL.label);
      idx.textContent = String(i);
      g.appendChild(idx);
    }
    // Select stub label
    const sel = document.createElementNS(SVG_NS, 'text');
    sel.setAttribute('x', w * 0.5); sel.setAttribute('y', h - 4);
    sel.setAttribute('text-anchor', 'middle');
    sel.setAttribute('font-family', 'monospace');
    sel.setAttribute('font-size', '9');
    sel.setAttribute('fill', COL.label);
    sel.textContent = 'sel'; g.appendChild(sel);
    _layer.appendChild(g);
    _elements.set(id, { el: g, kind: 'mux', meta: { x, y, w, h, inputs: n } });
    return g;
  }

  // ─────────────────────────────────────────
  //  Tri-state buffer — triangle with an enable stub on top.
  //    dir: 'right' (default) or 'left'
  //    Input:  (x, y + size/2)       (wide side)
  //    Output: (x + size, y + size/2) (point)
  //    Enable stub: (x + size/2, y)
  // ─────────────────────────────────────────
  function drawTriStateBuffer(id, x, y, size, dir) {
    if (!_layer) return null;
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'blk-tri');
    g.setAttribute('data-id', id);
    g.setAttribute('transform', `translate(${x},${y})`);
    const path = document.createElementNS(SVG_NS, 'path');
    if (dir === 'left') {
      path.setAttribute('d', `M ${size} 0 L ${size} ${size} L 0 ${size / 2} Z`);
    } else {
      path.setAttribute('d', `M 0 0 L 0 ${size} L ${size} ${size / 2} Z`);
    }
    path.setAttribute('fill', COL.gateFill);
    path.setAttribute('stroke', COL.gateEdge);
    path.setAttribute('stroke-width', '2');
    g.appendChild(path);
    // Enable stub on top
    const stub = document.createElementNS(SVG_NS, 'line');
    stub.setAttribute('x1', size / 2); stub.setAttribute('x2', size / 2);
    stub.setAttribute('y1', 0); stub.setAttribute('y2', -14);
    stub.setAttribute('stroke', COL.wireLo); stub.setAttribute('stroke-width', '2');
    g.appendChild(stub);
    const en = document.createElementNS(SVG_NS, 'text');
    en.setAttribute('x', size / 2 + 4); en.setAttribute('y', -4);
    en.setAttribute('font-family', 'monospace');
    en.setAttribute('font-size', '10');
    en.setAttribute('fill', COL.label);
    en.textContent = 'OE'; g.appendChild(en);
    _layer.appendChild(g);
    _elements.set(id, { el: g, kind: 'tri', meta: { x, y, size, dir } });
    return g;
  }

  // ─────────────────────────────────────────
  //  Wire (polyline) + logic-level colouring
  // ─────────────────────────────────────────
  function drawWire(id, pts, color) {
    if (!_layer || !pts || pts.length < 2) return null;
    const p = document.createElementNS(SVG_NS, 'polyline');
    p.setAttribute('points', pts.map(pt => pt.join(',')).join(' '));
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', color || COL.wireLo);
    p.setAttribute('stroke-width', '2.5');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    p.setAttribute('data-id', id);
    p.setAttribute('class', 'blk-wire');
    _layer.appendChild(p);
    _elements.set(id, { el: p, kind: 'wire', meta: { pts } });
    return p;
  }

  function setWireHigh(id, high) {
    const rec = _elements.get(id);
    if (!rec || rec.kind !== 'wire') return;
    rec.el.setAttribute('stroke', high ? COL.wireHi : COL.wireLo);
  }

  function pulseWire(id, color, ms) {
    const rec = _elements.get(id);
    if (!rec || rec.kind !== 'wire') return;
    const prev = rec.el.getAttribute('stroke');
    rec.el.setAttribute('stroke', color || COL.wireHot);
    rec.el.setAttribute('stroke-width', '4');
    const t = setTimeout(() => {
      rec.el.setAttribute('stroke', prev);
      rec.el.setAttribute('stroke-width', '2.5');
    }, ms || 400);
    _timers.push(t);
  }

  // ─────────────────────────────────────────
  //  Node (labelled pin/dot)
  // ─────────────────────────────────────────
  function drawNode(id, x, y, label, color) {
    if (!_layer) return null;
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'blk-node');
    g.setAttribute('data-id', id);
    g.setAttribute('transform', `translate(${x},${y})`);

    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('r', 4);
    c.setAttribute('fill', color || COL.node);
    c.setAttribute('stroke', '#000');
    c.setAttribute('stroke-width', '1');
    g.appendChild(c);

    if (label) {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', 10);
      t.setAttribute('y', 4);
      t.setAttribute('font-family', 'monospace');
      t.setAttribute('font-size', '12');
      t.setAttribute('fill', color || COL.label);
      t.textContent = label;
      g.appendChild(t);
    }
    _layer.appendChild(g);
    _elements.set(id, { el: g, kind: 'node', meta: { x, y } });
    return g;
  }

  // ─────────────────────────────────────────
  //  Waveform — animated square-wave OR analog (sine) renderer
  //   sampler(t): digital mode → 0|1. analog mode → value in [0,1].
  //   opts: { running, showAxis, color, bgColor, mode: 'digital'|'analog', step, timePerCol }
  // ─────────────────────────────────────────
  function drawWaveform(id, x, y, w, h, sampler, opts) {
    if (!_layer) return null;
    opts = opts || {};
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'blk-wave');
    g.setAttribute('data-id', id);
    g.setAttribute('transform', `translate(${x},${y})`);

    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', 0); bg.setAttribute('y', 0);
    bg.setAttribute('width', w); bg.setAttribute('height', h);
    bg.setAttribute('fill', opts.bgColor || COL.panel);
    bg.setAttribute('stroke', COL.axis);
    bg.setAttribute('stroke-width', '1');
    bg.setAttribute('rx', 4);
    g.appendChild(bg);

    if (opts.showAxis !== false) {
      const yHi = h * 0.20;
      const yLo = h * 0.80;
      // HIGH line
      const hi = document.createElementNS(SVG_NS, 'line');
      hi.setAttribute('x1', 0); hi.setAttribute('x2', w);
      hi.setAttribute('y1', yHi); hi.setAttribute('y2', yHi);
      hi.setAttribute('stroke', COL.axis);
      hi.setAttribute('stroke-dasharray', '3,3');
      hi.setAttribute('stroke-width', '0.7');
      g.appendChild(hi);
      // LOW line
      const lo = document.createElementNS(SVG_NS, 'line');
      lo.setAttribute('x1', 0); lo.setAttribute('x2', w);
      lo.setAttribute('y1', yLo); lo.setAttribute('y2', yLo);
      lo.setAttribute('stroke', COL.axis);
      lo.setAttribute('stroke-dasharray', '3,3');
      lo.setAttribute('stroke-width', '0.7');
      g.appendChild(lo);
      // Labels — 'V' / '0V' for analog, '1' / '0' for digital
      const isAnalog = opts.mode === 'analog';
      const hiT = document.createElementNS(SVG_NS, 'text');
      hiT.setAttribute('x', -4); hiT.setAttribute('y', yHi + 4);
      hiT.setAttribute('text-anchor', 'end');
      hiT.setAttribute('font-family', 'monospace');
      hiT.setAttribute('font-size', '10');
      hiT.setAttribute('fill', COL.label);
      hiT.textContent = isAnalog ? '+V' : '1';
      g.appendChild(hiT);
      const loT = document.createElementNS(SVG_NS, 'text');
      loT.setAttribute('x', -4); loT.setAttribute('y', yLo + 4);
      loT.setAttribute('text-anchor', 'end');
      loT.setAttribute('font-family', 'monospace');
      loT.setAttribute('font-size', '10');
      loT.setAttribute('fill', COL.label);
      loT.textContent = isAnalog ? '0V' : '0';
      g.appendChild(loT);
    }

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', opts.color || COL.wireHi);
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('stroke-linejoin', 'miter');
    path.setAttribute('stroke-linecap', 'square');
    g.appendChild(path);

    _layer.appendChild(g);
    _elements.set(id, { el: g, kind: 'wave', meta: { x, y, w, h } });

    _wavers.set(id, {
      x, y, w, h,
      sampler: sampler || ((t) => Math.floor(t / 400) % 2),
      path,
      t0: performance.now(),
      running: opts.running !== false,
      step: opts.step || 4,  // x-pixels per sample
      mode: opts.mode === 'analog' ? 'analog' : 'digital',
      timePerCol: opts.timePerCol || 50,
    });
    _renderWave(id);
    return g;
  }

  function setWaveformRunning(id, running) {
    const w = _wavers.get(id);
    if (!w) return;
    if (running && !w.running) {
      w.t0 = performance.now() - (w.lastT || 0);
    }
    w.running = running;
  }

  function setWaveformSampler(id, sampler) {
    const w = _wavers.get(id);
    if (!w) return;
    w.sampler = sampler;
    w.t0 = performance.now();
    _renderWave(id);
  }

  function _renderWave(id) {
    const w = _wavers.get(id);
    if (!w) return;
    const now = performance.now();
    const t   = w.running ? (now - w.t0) : (w.lastT || 0);
    w.lastT = t;

    const yHi = w.h * 0.20;
    const yLo = w.h * 0.80;
    const step = w.step;
    const cols = Math.floor(w.w / step);
    const timePerCol = w.timePerCol;
    const d = [];

    if (w.mode === 'analog') {
      // Smooth curve — sampler returns value in [0,1]. 0→bottom, 1→top.
      for (let i = 0; i < cols; i++) {
        const tt = t - (cols - i) * timePerCol;
        const v  = Math.max(0, Math.min(1, w.sampler(tt)));
        const xPix = i * step;
        const yPix = yLo - v * (yLo - yHi);
        d.push((i === 0 ? 'M ' : 'L ') + xPix + ' ' + yPix);
      }
    } else {
      // Square wave (digital) — sampler returns 0|1.
      let prev = null;
      for (let i = 0; i < cols; i++) {
        const tt = t - (cols - i) * timePerCol;
        const s  = w.sampler(tt) ? 1 : 0;
        const xPix = i * step;
        const yPix = s ? yHi : yLo;
        if (prev === null) {
          d.push(`M ${xPix} ${yPix}`);
        } else {
          if (prev !== s) d.push(`L ${xPix} ${prev ? yHi : yLo}`);
          d.push(`L ${xPix} ${yPix}`);
        }
        prev = s;
      }
    }
    w.path.setAttribute('d', d.join(' '));
  }

  // ─────────────────────────────────────────
  //  Edge marker (rising / falling arrow)
  // ─────────────────────────────────────────
  function markEdge(id, x, y, kind) {
    if (!_layer) return null;
    const up = kind !== 'falling';
    const color = up ? COL.edgeRise : COL.edgeFall;
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'blk-edge');
    g.setAttribute('data-id', id);
    g.setAttribute('transform', `translate(${x},${y})`);

    const arrow = document.createElementNS(SVG_NS, 'path');
    // Upward ↑ or downward ↓
    arrow.setAttribute('d', up
      ? 'M 0 12 L 0 -12 M -6 -6 L 0 -12 L 6 -6'
      : 'M 0 -12 L 0 12 M -6 6 L 0 12 L 6 6');
    arrow.setAttribute('stroke', color);
    arrow.setAttribute('stroke-width', '2.5');
    arrow.setAttribute('fill', 'none');
    arrow.setAttribute('stroke-linecap', 'round');
    arrow.setAttribute('stroke-linejoin', 'round');
    g.appendChild(arrow);

    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', 10);
    t.setAttribute('y', up ? -8 : 16);
    t.setAttribute('font-family', 'monospace');
    t.setAttribute('font-size', '11');
    t.setAttribute('font-weight', '700');
    t.setAttribute('fill', color);
    t.textContent = up ? 'rising edge' : 'falling edge';
    g.appendChild(t);

    _layer.appendChild(g);
    _elements.set(id, { el: g, kind: 'edge', meta: { x, y } });
    return g;
  }

  // ─────────────────────────────────────────
  //  Truth table
  // ─────────────────────────────────────────
  function drawTruthTable(id, x, y, header, rows) {
    if (!_layer) return null;
    const cellW = 34, cellH = 22;
    const cols = header.length;
    const totalW = cols * cellW;
    const totalH = (rows.length + 1) * cellH;

    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'blk-tt');
    g.setAttribute('data-id', id);
    g.setAttribute('transform', `translate(${x},${y})`);

    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', 0); bg.setAttribute('y', 0);
    bg.setAttribute('width', totalW); bg.setAttribute('height', totalH);
    bg.setAttribute('fill', COL.panel);
    bg.setAttribute('stroke', COL.gateEdge);
    bg.setAttribute('stroke-width', '1');
    bg.setAttribute('rx', 3);
    g.appendChild(bg);

    // Header row
    header.forEach((hdr, ci) => {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', ci * cellW + cellW / 2);
      t.setAttribute('y', cellH * 0.7);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('font-family', 'monospace');
      t.setAttribute('font-size', '12');
      t.setAttribute('font-weight', '700');
      t.setAttribute('fill', COL.accent);
      t.textContent = hdr;
      g.appendChild(t);
    });
    // Separator
    const sep = document.createElementNS(SVG_NS, 'line');
    sep.setAttribute('x1', 0); sep.setAttribute('x2', totalW);
    sep.setAttribute('y1', cellH); sep.setAttribute('y2', cellH);
    sep.setAttribute('stroke', COL.gateEdge);
    sep.setAttribute('stroke-width', '1');
    g.appendChild(sep);

    // Data rows
    rows.forEach((row, ri) => {
      row.forEach((val, ci) => {
        const t = document.createElementNS(SVG_NS, 'text');
        t.setAttribute('x', ci * cellW + cellW / 2);
        t.setAttribute('y', cellH + ri * cellH + cellH * 0.7);
        t.setAttribute('text-anchor', 'middle');
        t.setAttribute('font-family', 'monospace');
        t.setAttribute('font-size', '12');
        t.setAttribute('fill', COL.gateText);
        t.textContent = String(val);
        t.setAttribute('data-row', ri);
        t.setAttribute('data-col', ci);
        g.appendChild(t);
      });
    });

    _layer.appendChild(g);
    _elements.set(id, { el: g, kind: 'tt', meta: { x, y, cellW, cellH, cols, rowCount: rows.length } });
    return g;
  }

  function highlightTableRow(id, rowIdx) {
    const rec = _elements.get(id);
    if (!rec || rec.kind !== 'tt') return;
    const { cellW, cellH, cols, rowCount } = rec.meta;
    // Remove any existing highlight
    const old = rec.el.querySelector('rect[data-hl]');
    if (old) old.remove();
    if (rowIdx < 0 || rowIdx >= rowCount) return;
    const hl = document.createElementNS(SVG_NS, 'rect');
    hl.setAttribute('x', 0);
    hl.setAttribute('y', cellH + rowIdx * cellH);
    hl.setAttribute('width', cols * cellW);
    hl.setAttribute('height', cellH);
    hl.setAttribute('fill', COL.accent);
    hl.setAttribute('opacity', '0.18');
    hl.setAttribute('data-hl', '1');
    // Insert before text so text renders on top
    rec.el.insertBefore(hl, rec.el.firstChild.nextSibling);
  }

  // ─────────────────────────────────────────
  //  Visual state (dim / normal / glow / hot)
  // ─────────────────────────────────────────
  function setState(id, state) {
    const rec = _elements.get(id);
    if (!rec) return;
    const op = state === 'dim' ? 0.25
             : state === 'glow' ? 1
             : state === 'hot' ? 1
             : 1;
    rec.el.setAttribute('opacity', op);
    // For gates/boxes, optionally change stroke when glowing/hot
    if (rec.kind === 'gate' || rec.kind === 'box') {
      const shape = rec.el.querySelector('path, rect');
      if (shape) {
        if (state === 'glow')       shape.setAttribute('stroke', COL.accent);
        else if (state === 'hot')   shape.setAttribute('stroke', COL.wireHot);
        else if (state === 'dim')   shape.setAttribute('stroke', COL.dim);
        else                        shape.setAttribute('stroke', rec.kind === 'gate' ? COL.gateEdge : COL.boxEdge);
      }
    }
  }

  function dimAll() {
    _elements.forEach((_, id) => setState(id, 'dim'));
    // Wires also dim to low-level colour
    _elements.forEach((rec, id) => {
      if (rec.kind === 'wire') rec.el.setAttribute('stroke', COL.dim);
    });
  }

  function normalAll() {
    _elements.forEach((_, id) => setState(id, 'normal'));
    _elements.forEach((rec, id) => {
      if (rec.kind === 'wire') rec.el.setAttribute('stroke', COL.wireLo);
    });
  }

  // ─────────────────────────────────────────
  //  RAF loop for waveforms
  // ─────────────────────────────────────────
  function _startRaf() {
    if (_rafId) return;
    const tick = () => {
      _wavers.forEach((_, id) => _renderWave(id));
      const now = performance.now();
      _animators.forEach((a, id) => {
        const rec = _elements.get(id);
        if (!rec) { _animators.delete(id); return; }
        try { a.fn(now - a.t0, rec); } catch (e) { /* swallow per-frame errors */ }
      });
      _rafId = requestAnimationFrame(tick);
    };
    _rafId = requestAnimationFrame(tick);
  }
  function _stopRaf() {
    if (_rafId) cancelAnimationFrame(_rafId);
    _rafId = 0;
  }
  function _clearTimers() {
    _timers.forEach(id => clearTimeout(id));
    _timers.length = 0;
  }

  // ─────────────────────────────────────────
  //  Exports
  // ─────────────────────────────────────────
  const API = {
    // lifecycle
    build, teardown, resetScene, clear,
    // overlays
    setTitle, setLabel,
    // primitives
    drawGate, drawBox, drawWire, drawNode, drawCustom,
    drawCrystalSymbol, drawCapacitor, drawGround,
    drawChipOutline, drawHTree,
    drawMux, drawTriStateBuffer,
    drawWaveform, setWaveformRunning, setWaveformSampler,
    animate, stopAnimate,
    markEdge, drawTruthTable, highlightTableRow,
    // state
    setState, dimAll, normalAll, setWireHigh, pulseWire,
    // constants (useful for episodes)
    COL, STAGE_W, STAGE_H,
  };

  if (typeof window !== 'undefined') window.Blocks = API;
})();
