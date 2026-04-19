/**
 * Breadboard Build Mode — Simulation Engine + Canvas UI
 * Depends on: bb-core.js, bb-components.js, bb-challenges.js
 *
 * Manages:
 *   - Canvas rendering loop
 *   - Camera (pan/zoom)
 *   - Component placement (drag from palette)
 *   - Wire drawing (click pin → click pin)
 *   - Simulation propagation (pulse / auto-run)
 *   - Sidebar (inspector, challenges, controls)
 *   - Context menu, tooltips, rename modal
 *   - localStorage persistence
 */

const BB = {
  _initialized: false,
  // DOM
  canvas:    null,
  ctx:       null,
  // Camera
  cam:       { ox: 100, oy: 60, scale: 1.0 },
  // State
  components: [],
  wires:      [],
  selected:   null,   // selected component
  // Wiring state
  wiringFrom: null,   // { comp, pin }
  wirePreviewEnd: null,
  // Drag state
  dragging:      null,  // { comp, startX, startY, mouseStartX, mouseStartY }
  paletteGhost:  null,  // { type, opts, x, y } — dragging from palette
  pendingPlace:  null,  // { type, opts, chipEl } — tap-to-place mode (mobile)
  _lastInputWasTouch: false,  // distinguishes touch from mouse
  _undoStack: [],              // undo history
  _wireFlash: null,           // { wire, time } — green flash on successful connection
  // Pan state
  panning:       false,
  panStart:      null,
  // Auto-run
  autoRunInterval: null,
  autoRunSpeed:    400,   // ms per pulse
  // Challenge state
  currentChallenge: null,
  challengeAttempts: 0,
  solvedChallenges:  new Set(),
  // Hint state
  hintShown:    false,
  // RAF
  _raf: null,
  // Log
  simLog: [],
  maxLog: 30,
  // Sandbox mode flag
  isSandbox: false,
};

// ─────────────────────────────────────────────────────────────────
//  GRID SNAP
// ─────────────────────────────────────────────────────────────────
const GRID = 20;
function snap(v) { return Math.round(v / GRID) * GRID; }

// ─────────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────────
function bbInit() {
  if (BB._initialized) { bbResizeCanvas(); return; }
  BB._initialized = true;
  BB.canvas = document.getElementById('bb-canvas');
  if (!BB.canvas) { console.error('bb-engine: #bb-canvas not found'); return; }
  BB.ctx    = BB.canvas.getContext('2d');

  bbResizeCanvas();
  window.addEventListener('resize', bbResizeCanvas);

  // Canvas events — mousedown and wheel only on canvas
  BB.canvas.addEventListener('mousedown',  bbOnMouseDown);
  BB.canvas.addEventListener('wheel',      bbOnWheel, { passive: false });
  BB.canvas.addEventListener('dblclick',   bbOnDblClick);
  BB.canvas.addEventListener('contextmenu',bbOnContextMenu);
  // mousemove and mouseup on document so palette drag works
  document.addEventListener('mousemove',   bbOnMouseMove);
  document.addEventListener('mouseup',     bbOnMouseUp);

  // Touch events for mobile
  BB.canvas.addEventListener('touchstart',  bbOnTouchStart, { passive: false });
  BB.canvas.addEventListener('touchmove',   bbOnTouchMove,  { passive: false });
  BB.canvas.addEventListener('touchend',    bbOnTouchEnd,   { passive: false });
  BB.canvas.addEventListener('touchcancel', bbOnTouchEnd,   { passive: false });
  // Touch state
  BB._touchState = { lastTap: 0, longPressTimer: null, pinchStartDist: 0, pinchStartScale: 1, isTwoFinger: false };

  // Keyboard
  document.addEventListener('keydown', bbOnKeyDown);

  // Build sidebar
  bbBuildPalette();
  bbBuildSidebar();

  // Load saved state or show welcome
  const saved = bbLoadState();
  if (!saved) {
    // Default: sandbox with nothing placed
    BB.isSandbox = true;
  }

  // Start render loop
  bbStartRenderLoop();

  // Sidebar tab default
  bbActivateSidebarTab('controls');

  bbLog('Build Mode ready. Drag components from the left panel.', 'ok');
}

// ─────────────────────────────────────────────────────────────────
//  CANVAS RESIZE
// ─────────────────────────────────────────────────────────────────
function bbResizeCanvas() {
  const wrap  = document.getElementById('bb-canvas-wrap');
  if (!wrap || !BB.canvas) return;
  BB.canvas.width  = wrap.clientWidth;
  BB.canvas.height = wrap.clientHeight;
}

// ─────────────────────────────────────────────────────────────────
//  RENDER LOOP
// ─────────────────────────────────────────────────────────────────
function bbStartRenderLoop() {
  if (BB._raf) cancelAnimationFrame(BB._raf);
  function loop() {
    bbRender();
    BB._raf = requestAnimationFrame(loop);
  }
  BB._raf = requestAnimationFrame(loop);
}

function bbRender() {
  const ctx = BB.ctx;
  const W   = BB.canvas.width;
  const H   = BB.canvas.height;
  if (!W || !H) return;

  // Background — breadboard color
  ctx.fillStyle = '#0e1c0f';
  ctx.fillRect(0, 0, W, H);

  // Grid dots
  bbDrawGrid(ctx, W, H);

  // Components
  for (const comp of BB.components) {
    comp.render(ctx, BB.cam);
  }

  // Wires
  for (const wire of BB.wires) {
    wire.render(ctx, BB.cam);
  }

  // Wire-in-progress preview with valid/invalid feedback
  if (BB.wiringFrom && BB.wirePreviewEnd) {
    const fp = BB.wiringFrom.comp.getPinScreenPos(BB.wiringFrom.pin, BB.cam);
    if (fp) {
      // Check what we're hovering over
      const hoverWp = screenToWorld(BB.wirePreviewEnd.x, BB.wirePreviewEnd.y);
      const hoverPin = getPinAt(hoverWp.x, hoverWp.y);
      let previewColor = '#ffaa00'; // default: yellow (neutral)
      let previewValid = null;      // null=neutral, true=valid, false=invalid
      if (hoverPin) {
        if (canConnect(BB.wiringFrom, hoverPin)) {
          previewColor = '#00e676'; // green — valid
          previewValid = true;
        } else {
          previewColor = '#ff1744'; // red — invalid
          previewValid = false;
        }
      }

      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = previewColor;
      ctx.lineWidth   = previewValid === true ? 2.5 : 1.5;
      ctx.globalAlpha = 0.8;
      if (previewValid !== null) {
        ctx.shadowColor = previewColor;
        ctx.shadowBlur  = previewValid ? 10 : 6;
      }
      ctx.beginPath();
      ctx.moveTo(fp.x, fp.y);
      ctx.lineTo(BB.wirePreviewEnd.x, BB.wirePreviewEnd.y);
      ctx.stroke();

      // Draw target pin highlight ring
      if (hoverPin) {
        const tp = hoverPin.comp.getPinScreenPos(hoverPin.pin, BB.cam);
        if (tp) {
          const r = Math.max(6, 8 * BB.cam.scale);
          ctx.setLineDash([]);
          ctx.lineWidth   = 2;
          ctx.strokeStyle = previewColor;
          ctx.shadowBlur  = 12;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, r, 0, Math.PI * 2);
          ctx.stroke();

          // X mark for invalid connections
          if (previewValid === false) {
            const xs = r * 0.6;
            ctx.lineWidth   = 2.5;
            ctx.strokeStyle = '#ff1744';
            ctx.shadowBlur  = 0;
            ctx.beginPath();
            ctx.moveTo(tp.x - xs, tp.y - xs);
            ctx.lineTo(tp.x + xs, tp.y + xs);
            ctx.moveTo(tp.x + xs, tp.y - xs);
            ctx.lineTo(tp.x - xs, tp.y + xs);
            ctx.stroke();
          }

          // Checkmark for valid connections
          if (previewValid === true) {
            const cs = r * 0.5;
            ctx.lineWidth   = 2.5;
            ctx.strokeStyle = '#00e676';
            ctx.shadowBlur  = 0;
            ctx.beginPath();
            ctx.moveTo(tp.x - cs, tp.y);
            ctx.lineTo(tp.x - cs * 0.2, tp.y + cs * 0.7);
            ctx.lineTo(tp.x + cs, tp.y - cs * 0.5);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
  }

  // Flash effect for recently added wires (green pulse)
  if (BB._wireFlash) {
    const wf = BB._wireFlash;
    const elapsed = Date.now() - wf.time;
    if (elapsed < 600) {
      const alpha = 1 - (elapsed / 600);
      const fp2 = wf.wire.from.comp.getPinScreenPos(wf.wire.from.pin, BB.cam);
      const tp2 = wf.wire.to.comp.getPinScreenPos(wf.wire.to.pin, BB.cam);
      if (fp2 && tp2) {
        ctx.save();
        ctx.strokeStyle = '#00e676';
        ctx.lineWidth   = 4;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = '#00e676';
        ctx.shadowBlur  = 15 * alpha;
        ctx.lineCap     = 'round';
        const cpOff = Math.min(Math.abs(tp2.x - fp2.x) * 0.5 + 30, 80);
        ctx.beginPath();
        ctx.moveTo(fp2.x, fp2.y);
        ctx.bezierCurveTo(fp2.x + cpOff, fp2.y, tp2.x - cpOff, tp2.y, tp2.x, tp2.y);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      BB._wireFlash = null;
    }
  }

  // Palette ghost (dragging from palette)
  if (BB.paletteGhost) {
    const g = BB.paletteGhost;
    const tmp = createComponent(g.type, g.x, g.y, g.opts);
    ctx.globalAlpha = 0.55;
    tmp.render(ctx, BB.cam);
    ctx.globalAlpha = 1;
  }
}

function bbDrawGrid(ctx, W, H) {
  const cam   = BB.cam;
  const gs    = GRID * cam.scale;
  const startX = (((-cam.ox / cam.scale) % GRID) * cam.scale + cam.ox) % gs;
  const startY = (((-cam.oy / cam.scale) % GRID) * cam.scale + cam.oy) % gs;

  ctx.fillStyle = 'rgba(0,80,20,0.3)';
  const dotR = Math.max(0.5, 1.2 * cam.scale);

  for (let x = startX; x < W; x += gs) {
    for (let y = startY; y < H; y += gs) {
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ─────────────────────────────────────────────────────────────────
//  COORD HELPERS
// ─────────────────────────────────────────────────────────────────
function screenToWorld(sx, sy) {
  return {
    x: (sx - BB.cam.ox) / BB.cam.scale,
    y: (sy - BB.cam.oy) / BB.cam.scale,
  };
}

function worldToScreen(wx, wy) {
  return {
    x: wx * BB.cam.scale + BB.cam.ox,
    y: wy * BB.cam.scale + BB.cam.oy,
  };
}

function getCanvasPos(e) {
  const r = BB.canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// ─────────────────────────────────────────────────────────────────
//  HIT TESTING
// ─────────────────────────────────────────────────────────────────
function getCompAt(wx, wy) {
  // Reverse order (top-most first)
  for (let i = BB.components.length - 1; i >= 0; i--) {
    if (BB.components[i].hitTest(wx, wy)) return BB.components[i];
  }
  return null;
}

function getPinAt(wx, wy) {
  // Larger hit radius on touch devices for easier tapping
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const pinRadius = (isTouchDevice ? 30 : 12) / BB.cam.scale;
  for (let i = BB.components.length - 1; i >= 0; i--) {
    const comp = BB.components[i];
    const pin  = comp.getPinAt(wx, wy, pinRadius);
    if (pin) return { comp, pin };
  }
  return null;
}

function getWireAt(sx, sy) {
  // Check multiple points along the wire, not just the midpoint
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const hitDist = isTouchDevice ? 500 : 200;
  for (const wire of BB.wires) {
    const fp = wire.from.comp.getPinScreenPos(wire.from.pin, BB.cam);
    const tp = wire.to.comp.getPinScreenPos(wire.to.pin, BB.cam);
    if (!fp || !tp) continue;
    // Sample 5 points along the wire (0.1, 0.3, 0.5, 0.7, 0.9)
    for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
      const px = fp.x + (tp.x - fp.x) * t;
      const py = fp.y + (tp.y - fp.y) * t;
      const dx = sx - px; const dy = sy - py;
      if (dx*dx + dy*dy < hitDist) return wire;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
//  MOUSE EVENTS
// ─────────────────────────────────────────────────────────────────
function bbOnMouseDown(e) {
  if (e.button !== 0) return;
  bbHideContextMenu();

  const sp = getCanvasPos(e);
  const wp = screenToWorld(sp.x, sp.y);

  // If we're in wiring mode — click to place second end
  if (BB.wiringFrom) {
    const pinHit = getPinAt(wp.x, wp.y);
    if (pinHit && canConnect(BB.wiringFrom, pinHit)) {
      bbAddWire(BB.wiringFrom.comp, BB.wiringFrom.pin, pinHit.comp, pinHit.pin);
      bbCancelWiring();
    } else if (pinHit) {
      bbLog('Cannot connect: ' + getConnectionError(BB.wiringFrom, pinHit), 'err');
      bbCancelWiring();
    } else {
      bbCancelWiring();
    }
    return;
  }

  // Check pin hit (start wiring)
  const pinHit = getPinAt(wp.x, wp.y);
  if (pinHit) {
    const pin = pinHit.comp.getPin(pinHit.pin);
    // Only start wire from output pins
    if (pin && pin.dir === 'out') {
      BB.wiringFrom      = pinHit;
      BB.wirePreviewEnd  = sp;
      BB.canvas.classList.add('wiring');
      const hint = document.getElementById('bb-wire-hint');
      if (hint) { hint.textContent = 'Click an INPUT pin to connect — Esc to cancel'; hint.classList.add('visible'); }
      return;
    } else if (pin && pin.dir === 'in') {
      bbLog('Start wiring from an OUTPUT pin (right side of components).', 'warn');
      return;
    }
  }

  // Check component body hit (select / drag)
  const comp = getCompAt(wp.x, wp.y);
  if (comp) {
    bbSelectComponent(comp);
    BB.dragging = {
      comp,
      startX:      comp.x,
      startY:      comp.y,
      mouseStartX: wp.x,
      mouseStartY: wp.y,
    };
    return;
  }

  // Check wire hit (click a wire to highlight it and show tooltip)
  const wireHit = bbGetWireNear ? bbGetWireNear(sp.x, sp.y, 300) : null;
  if (wireHit) {
    // Flash the wire
    wireHit.flash();
    // Show wire detail tooltip
    if (typeof bbShowWireTooltip === 'function') {
      bbShowWireTooltip(wireHit, e.clientX, e.clientY);
      // Auto-hide after 4 seconds
      clearTimeout(BB._wireTooltipTimer);
      BB._wireTooltipTimer = setTimeout(() => {
        if (typeof bbHideWireTooltip === 'function') bbHideWireTooltip();
      }, 4000);
    }
    // Show in inspector
    bbShowWireInInspector(wireHit);
    return;
  }

  // Tap-to-place: if a palette chip is selected, place it here
  if (BB.pendingPlace) {
    const pp = BB.pendingPlace;
    const comp = createComponent(pp.type, snap(wp.x), snap(wp.y), pp.opts);
    bbAddComponent(comp);
    bbSelectComponent(comp);
    bbSaveState();
    if (pp.chipEl) pp.chipEl.classList.remove('pending-place');
    BB.pendingPlace = null;
    const hint = document.getElementById('bb-wire-hint');
    if (hint) { hint.textContent = ''; hint.classList.remove('visible'); }
    return;
  }

  // Empty space — deselect and start pan
  bbSelectComponent(null);
  BB.panning  = true;
  BB.panStart = sp;
  BB.canvas.classList.add('panning');
}

function bbOnMouseMove(e) {
  if (!BB.canvas) return;
  const sp = getCanvasPos(e);
  const wp = screenToWorld(sp.x, sp.y);

  // Update wire preview
  if (BB.wiringFrom) {
    BB.wirePreviewEnd = sp;
    bbUpdateTooltipForPin(sp, wp);
    return;
  }

  // Drag component
  if (BB.dragging) {
    const dx = wp.x - BB.dragging.mouseStartX;
    const dy = wp.y - BB.dragging.mouseStartY;
    BB.dragging.comp.x = snap(BB.dragging.startX + dx);
    BB.dragging.comp.y = snap(BB.dragging.startY + dy);
    bbSaveState();
    return;
  }

  // Palette ghost drag
  if (BB.paletteGhost) {
    const snappedW = screenToWorld(sp.x, sp.y);
    BB.paletteGhost.x = snap(snappedW.x - (BB.paletteGhost._w || 60));
    BB.paletteGhost.y = snap(snappedW.y - (BB.paletteGhost._h || 40));
    return;
  }

  // Pan
  if (BB.panning && BB.panStart) {
    BB.cam.ox += sp.x - BB.panStart.x;
    BB.cam.oy += sp.y - BB.panStart.y;
    BB.panStart = sp;
    return;
  }

  // Hover tooltip
  const pinHit = getPinAt(wp.x, wp.y);
  if (pinHit) {
    bbShowPinTooltip(pinHit, e.clientX, e.clientY);
  } else {
    bbHideTooltip();
  }
}

function bbOnMouseUp(e) {
  if (BB.paletteGhost) {
    const pg = BB.paletteGhost;
    // Only place if ghost is at a valid (visible) position
    if (pg.x > -999) {
      const comp = createComponent(pg.type, pg.x, pg.y, pg.opts);
      bbAddComponent(comp);
      bbSelectComponent(comp);
      bbSaveState();
    }
    BB.paletteGhost = null;
    return;
  }

  if (BB.dragging) {
    BB.dragging = null;
    bbSaveState();
    return;
  }

  if (BB.panning) {
    BB.panning = false;
    BB.panStart = null;
    BB.canvas.classList.remove('panning');
  }
}

function bbOnWheel(e) {
  e.preventDefault();
  const sp    = getCanvasPos(e);
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newScale = Math.min(2.5, Math.max(0.25, BB.cam.scale * delta));

  // Zoom toward mouse
  BB.cam.ox = sp.x - (sp.x - BB.cam.ox) * (newScale / BB.cam.scale);
  BB.cam.oy = sp.y - (sp.y - BB.cam.oy) * (newScale / BB.cam.scale);
  BB.cam.scale = newScale;

  const lvl = document.getElementById('bb-zoom-level');
  if (lvl) lvl.textContent = Math.round(newScale * 100) + '%';
}

function bbOnDblClick(e) {
  const sp = getCanvasPos(e);
  const wp = screenToWorld(sp.x, sp.y);
  const comp = getCompAt(wp.x, wp.y);
  if (comp) {
    if (comp instanceof ControlSwitchComponent) {
      comp.toggle();
      bbLog(`Switch ${comp.label}: ${comp._state}`, 'ok');
      bbUpdateInspector();
    } else if (comp instanceof RAMComponent) {
      comp.openEditor();
    } else {
      bbOpenRenameModal(comp);
    }
  }
}

function bbOnContextMenu(e) {
  e.preventDefault();
  const sp  = getCanvasPos(e);
  const wp  = screenToWorld(sp.x, sp.y);

  // Check wire first
  const wire = getWireAt(sp.x, sp.y);
  if (wire) {
    bbShowContextMenu(e.clientX, e.clientY, [
      { label: 'Delete Wire', action: () => bbRemoveWire(wire), danger: true },
    ]);
    return;
  }

  const comp = getCompAt(wp.x, wp.y);
  if (comp) {
    bbSelectComponent(comp);
    const items = [
      { label: 'Rename', action: () => bbOpenRenameModal(comp) },
    ];
    if (comp instanceof ControlSwitchComponent) {
      items.push({ label: comp._state ? 'Set to 0' : 'Set to 1', action: () => { comp.toggle(); bbUpdateInspector(); } });
    }
    if (comp instanceof ConstantComponent) {
      items.push({ label: 'Set Value', action: () => bbSetConstantValue(comp) });
    }
    if (comp instanceof RAMComponent) {
      items.push({ label: 'Edit RAM Contents', action: () => comp.openEditor() });
    }
    items.push({ sep: true });
    items.push({ label: 'Delete Component', action: () => bbRemoveComponent(comp), danger: true });
    bbShowContextMenu(e.clientX, e.clientY, items);
  }
}

function bbOnKeyDown(e) {
  if (!document.body.classList.contains('build-mode')) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'Escape') { bbCancelWiring(); bbHideContextMenu(); }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (BB.selected) { bbRemoveComponent(BB.selected); }
  }
  if (e.key === ' ') { e.preventDefault(); bbPulse(); }
  if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); bbUndo(); }
}

// ─────────────────────────────────────────────────────────────────
//  TOUCH EVENTS (MOBILE)
// ─────────────────────────────────────────────────────────────────
function _getTouchCanvasPos(touch) {
  const r = BB.canvas.getBoundingClientRect();
  return { x: touch.clientX - r.left, y: touch.clientY - r.top };
}

function _getTouchDist(t1, t2) {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function _getTouchMidpoint(t1, t2) {
  const r = BB.canvas.getBoundingClientRect();
  return {
    x: (t1.clientX + t2.clientX) / 2 - r.left,
    y: (t1.clientY + t2.clientY) / 2 - r.top,
  };
}

function bbOnTouchStart(e) {
  e.preventDefault();
  const ts = BB._touchState;

  // Two-finger: start pinch-to-zoom
  if (e.touches.length === 2) {
    ts.isTwoFinger = true;
    ts.pinchStartDist  = _getTouchDist(e.touches[0], e.touches[1]);
    ts.pinchStartScale = BB.cam.scale;
    ts.pinchMid = _getTouchMidpoint(e.touches[0], e.touches[1]);
    // Cancel any long press or single-finger action
    if (ts.longPressTimer) { clearTimeout(ts.longPressTimer); ts.longPressTimer = null; }
    BB.dragging = null;
    return;
  }

  // Single finger
  if (e.touches.length !== 1) return;
  ts.isTwoFinger = false;
  const touch = e.touches[0];
  const sp = _getTouchCanvasPos(touch);
  const wp = screenToWorld(sp.x, sp.y);

  // Detect double-tap
  const now = Date.now();
  if (now - ts.lastTap < 300) {
    ts.lastTap = 0;
    // Double-tap = double-click
    const comp = getCompAt(wp.x, wp.y);
    if (comp) {
      if (comp instanceof ControlSwitchComponent) {
        comp.toggle();
        bbLog('Switch ' + comp.label + ': ' + comp._state, 'ok');
        bbUpdateInspector();
      } else {
        bbOpenRenameModal(comp);
      }
    }
    return;
  }
  ts.lastTap = now;

  // Long press for context menu (equivalent of right-click)
  ts.longPressTimer = setTimeout(() => {
    ts.longPressTimer = null;
    const wire = getWireAt(sp.x, sp.y);
    if (wire) {
      bbShowContextMenu(touch.clientX, touch.clientY, [
        { label: 'Delete Wire', action: () => bbRemoveWire(wire), danger: true },
      ]);
      BB.dragging = null;
      return;
    }
    const compLP = getCompAt(wp.x, wp.y);
    if (compLP) {
      bbSelectComponent(compLP);
      const items = [
        { label: 'Rename', action: () => bbOpenRenameModal(compLP) },
      ];
      if (compLP instanceof ControlSwitchComponent) {
        items.push({ label: compLP._state ? 'Set to 0' : 'Set to 1', action: () => { compLP.toggle(); bbUpdateInspector(); } });
      }
      if (compLP instanceof ConstantComponent) {
        items.push({ label: 'Set Value', action: () => bbSetConstantValue(compLP) });
      }
      items.push({ sep: true });
      items.push({ label: 'Delete Component', action: () => bbRemoveComponent(compLP), danger: true });
      bbShowContextMenu(touch.clientX, touch.clientY, items);
      BB.dragging = null;
    }
  }, 600);

  // Handle like mousedown logic
  bbHideContextMenu();

  if (BB.wiringFrom) {
    // First: try exact pin hit
    let pinHit = getPinAt(wp.x, wp.y);

    // If no pin hit on mobile, try to find the nearest input pin on any nearby component
    if (!pinHit) {
      const comp = getCompAt(wp.x, wp.y);
      if (comp && comp !== BB.wiringFrom.comp) {
        // Find the closest unconnected input pin on this component
        let bestPin = null;
        let bestDist = Infinity;
        for (const p of comp.pins) {
          if (p.dir !== 'in') continue;
          const lp = comp._pinLocalPos(p);
          const px = comp.x + lp.x;
          const py = comp.y + lp.y;
          const d  = (px - wp.x) * (px - wp.x) + (py - wp.y) * (py - wp.y);
          if (d < bestDist) { bestDist = d; bestPin = p.name; }
        }
        if (bestPin) {
          pinHit = { comp, pin: bestPin };
        }
      }
    }

    if (pinHit && canConnect(BB.wiringFrom, pinHit)) {
      bbAddWire(BB.wiringFrom.comp, BB.wiringFrom.pin, pinHit.comp, pinHit.pin);
      bbCancelWiring();
    } else if (pinHit) {
      bbLog('Cannot connect: ' + getConnectionError(BB.wiringFrom, pinHit), 'err');
      // Don't cancel wiring on mobile — let them try again
      const hint = document.getElementById('bb-wire-hint');
      if (hint) { hint.textContent = 'Invalid target — tap a valid INPUT pin'; hint.classList.add('visible'); }
    } else {
      // Tapped empty space — cancel wiring
      bbCancelWiring();
    }
    return;
  }

  const pinHit = getPinAt(wp.x, wp.y);
  if (pinHit) {
    const pin = pinHit.comp.getPin(pinHit.pin);
    if (pin && pin.dir === 'out') {
      BB.wiringFrom     = pinHit;
      BB.wirePreviewEnd = sp;
      BB.canvas.classList.add('wiring');
      const hint = document.getElementById('bb-wire-hint');
      if (hint) { hint.textContent = 'Tap an INPUT pin to connect'; hint.classList.add('visible'); }
      if (ts.longPressTimer) { clearTimeout(ts.longPressTimer); ts.longPressTimer = null; }
      return;
    } else if (pin && pin.dir === 'in') {
      // On mobile: allow starting a wire from an input pin too — find the component
      // and auto-wire if there's a pending wiring from an output
      bbLog('Tap an OUTPUT pin first (right side of component).', 'warn');
      return;
    }
  }

  // On mobile: tapping a component body can also start wiring from its first output pin
  const comp = getCompAt(wp.x, wp.y);
  if (comp) {
    bbSelectComponent(comp);
    BB.dragging = {
      comp,
      startX:      comp.x,
      startY:      comp.y,
      mouseStartX: wp.x,
      mouseStartY: wp.y,
    };
    return;
  }

  // Tap-to-place: if a palette chip is selected, place it here
  if (BB.pendingPlace) {
    const pp = BB.pendingPlace;
    const comp = createComponent(pp.type, snap(wp.x), snap(wp.y), pp.opts);
    bbAddComponent(comp);
    bbSelectComponent(comp);
    bbSaveState();
    // Clear pending state
    if (pp.chipEl) pp.chipEl.classList.remove('pending-place');
    BB.pendingPlace = null;
    const hint = document.getElementById('bb-wire-hint');
    if (hint) { hint.textContent = ''; hint.classList.remove('visible'); }
    return;
  }

  // Empty space: pan
  bbSelectComponent(null);
  BB.panning  = true;
  BB.panStart = sp;
  BB.canvas.classList.add('panning');
}

function bbOnTouchMove(e) {
  e.preventDefault();
  const ts = BB._touchState;

  // Pinch-to-zoom with two fingers
  if (e.touches.length === 2 && ts.isTwoFinger) {
    const dist = _getTouchDist(e.touches[0], e.touches[1]);
    const mid  = _getTouchMidpoint(e.touches[0], e.touches[1]);
    const scaleFactor = dist / ts.pinchStartDist;
    const newScale = Math.min(2.5, Math.max(0.25, ts.pinchStartScale * scaleFactor));

    // Zoom toward pinch midpoint
    BB.cam.ox = mid.x - (mid.x - BB.cam.ox) * (newScale / BB.cam.scale);
    BB.cam.oy = mid.y - (mid.y - BB.cam.oy) * (newScale / BB.cam.scale);
    BB.cam.scale = newScale;

    const lvl = document.getElementById('bb-zoom-level');
    if (lvl) lvl.textContent = Math.round(newScale * 100) + '%';
    return;
  }

  if (e.touches.length !== 1) return;
  const touch = e.touches[0];
  const sp = _getTouchCanvasPos(touch);
  const wp = screenToWorld(sp.x, sp.y);

  // Cancel long press if finger moved significantly
  if (ts.longPressTimer) {
    clearTimeout(ts.longPressTimer);
    ts.longPressTimer = null;
  }

  // Wire preview
  if (BB.wiringFrom) {
    BB.wirePreviewEnd = sp;
    return;
  }

  // Drag component
  if (BB.dragging) {
    const dx = wp.x - BB.dragging.mouseStartX;
    const dy = wp.y - BB.dragging.mouseStartY;
    BB.dragging.comp.x = snap(BB.dragging.startX + dx);
    BB.dragging.comp.y = snap(BB.dragging.startY + dy);
    bbSaveState();
    return;
  }

  // Palette ghost drag
  if (BB.paletteGhost) {
    const snappedW = screenToWorld(sp.x, sp.y);
    BB.paletteGhost.x = snap(snappedW.x - (BB.paletteGhost._w || 60));
    BB.paletteGhost.y = snap(snappedW.y - (BB.paletteGhost._h || 40));
    return;
  }

  // Pan
  if (BB.panning && BB.panStart) {
    BB.cam.ox += sp.x - BB.panStart.x;
    BB.cam.oy += sp.y - BB.panStart.y;
    BB.panStart = sp;
    return;
  }
}

function bbOnTouchEnd(e) {
  e.preventDefault();
  const ts = BB._touchState;

  // Cancel long press
  if (ts.longPressTimer) {
    clearTimeout(ts.longPressTimer);
    ts.longPressTimer = null;
  }

  // End pinch
  if (ts.isTwoFinger && e.touches.length < 2) {
    ts.isTwoFinger = false;
    return;
  }

  // Palette ghost drop
  if (BB.paletteGhost) {
    const pg = BB.paletteGhost;
    if (pg.x > -999) {
      const comp = createComponent(pg.type, pg.x, pg.y, pg.opts);
      bbAddComponent(comp);
      bbSelectComponent(comp);
      bbSaveState();
    }
    BB.paletteGhost = null;
    return;
  }

  // End drag
  if (BB.dragging) {
    BB.dragging = null;
    bbSaveState();
    return;
  }

  // End pan
  if (BB.panning) {
    BB.panning  = false;
    BB.panStart = null;
    BB.canvas.classList.remove('panning');
  }
}

// ─────────────────────────────────────────────────────────────────
//  WIRING
// ─────────────────────────────────────────────────────────────────
function canConnect(from, to) {
  if (from.comp === to.comp) return false;
  const fp = from.comp.getPin(from.pin);
  const tp = to.comp.getPin(to.pin);
  if (!fp || !tp) return false;
  if (fp.dir !== 'out') return false;
  if (tp.dir !== 'in')  return false;
  // Allow duplicate destination (fan-in: multiple outputs → same input = bus)
  // But block exact same wire
  if (BB.wires.some(w =>
    w.from.comp === from.comp && w.from.pin === from.pin &&
    w.to.comp   === to.comp   && w.to.pin   === to.pin)) return false;
  return true;
}

function getConnectionError(from, to) {
  if (from.comp === to.comp) return 'Cannot connect a component to itself.';
  if (BB.wires.some(w =>
    w.from.comp === from.comp && w.from.pin === from.pin &&
    w.to.comp   === to.comp   && w.to.pin   === to.pin)) return 'Wire already exists.';
  const fp = from.comp.getPin(from.pin);
  const tp = to.comp.getPin(to.pin);
  const isBus = (from.comp instanceof BusComponent) || (to.comp instanceof BusComponent)
             || (from.comp instanceof AddressBusComponent) || (to.comp instanceof AddressBusComponent);
  if (!isBus && tp && tp.dir === 'out') return 'Cannot connect two outputs together.';
  return 'Invalid connection.';
}

function bbAddWire(fromComp, fromPin, toComp, toPin) {
  const wire = new Wire(fromComp, fromPin, toComp, toPin);
  BB.wires.push(wire);
  // Mark pins as connected
  const fp = fromComp.getPin(fromPin);
  const tp = toComp.getPin(toPin);
  if (fp) fp._connected = true;
  if (tp) tp._connected = true;
  // Green flash animation on successful connection
  BB._wireFlash = { wire, time: Date.now() };
  // Push to undo stack
  BB._undoStack.push({ type: 'addWire', wire, fromComp, fromPin, toComp, toPin });
  if (BB._undoStack.length > 50) BB._undoStack.shift(); // limit stack size
  bbLog(`Wired ${fromComp.label}.${fromPin} → ${toComp.label}.${toPin}`, 'ok');
  bbSaveState();
  return wire;
}

function bbRemoveWire(wire) {
  const idx = BB.wires.indexOf(wire);
  if (idx < 0) return;
  BB.wires.splice(idx, 1);
  // Push to undo stack so it can be restored
  BB._undoStack.push({
    type: 'removeWire',
    fromComp: wire.from.comp, fromPin: wire.from.pin,
    toComp: wire.to.comp, toPin: wire.to.pin,
    color: wire.color,
  });
  if (BB._undoStack.length > 50) BB._undoStack.shift();
  // Recheck connection status for these pins
  bbRefreshPinConnected();
  bbLog(`Wire removed.`, 'warn');
  bbSaveState();
}

function bbUndo() {
  if (BB._undoStack.length === 0) { bbLog('Nothing to undo.', 'warn'); return; }
  const action = BB._undoStack.pop();
  if (action.type === 'addWire') {
    // Undo an add → remove the wire
    const idx = BB.wires.indexOf(action.wire);
    if (idx >= 0) BB.wires.splice(idx, 1);
    bbRefreshPinConnected();
    bbLog('Undo: wire removed.', 'info');
  } else if (action.type === 'removeWire') {
    // Undo a remove → re-add the wire
    const wire = new Wire(action.fromComp, action.fromPin, action.toComp, action.toPin);
    wire.color = action.color;
    BB.wires.push(wire);
    bbRefreshPinConnected();
    bbLog('Undo: wire restored.', 'info');
  }
  bbSaveState();
}

function bbRefreshPinConnected() {
  // Reset all
  for (const c of BB.components) {
    for (const p of c.pins) p._connected = false;
  }
  // Mark connected ones
  for (const w of BB.wires) {
    const fp = w.from.comp.getPin(w.from.pin);
    const tp = w.to.comp.getPin(w.to.pin);
    if (fp) fp._connected = true;
    if (tp) tp._connected = true;
  }
}

function bbCancelWiring() {
  BB.wiringFrom     = null;
  BB.wirePreviewEnd = null;
  BB.canvas.classList.remove('wiring');
  const hint = document.getElementById('bb-wire-hint');
  if (hint) hint.classList.remove('visible');
}

// ─────────────────────────────────────────────────────────────────
//  COMPONENT MANAGEMENT
// ─────────────────────────────────────────────────────────────────
function bbAddComponent(comp) {
  BB.components.push(comp);
  bbLog(`Added ${comp.type}: ${comp.label}`, 'ok');
}

function bbRemoveComponent(comp) {
  // Remove all wires connected to this component
  BB.wires = BB.wires.filter(w => w.from.comp !== comp && w.to.comp !== comp);
  BB.components = BB.components.filter(c => c !== comp);
  if (BB.selected === comp) { BB.selected = null; bbUpdateInspector(); }
  bbRefreshPinConnected();
  bbLog(`Removed ${comp.label}`, 'warn');
  bbSaveState();
}

function bbSelectComponent(comp) {
  if (BB.selected) BB.selected.selected = false;
  BB.selected = comp;
  if (comp) comp.selected = true;
  bbUpdateInspector();
  // Auto-show datasheet for selected component if Datasheet tab is active
  if (comp && typeof window.openDatasheetForComponent === 'function') {
    const dsPane = document.getElementById('bb-stab-datasheet');
    if (dsPane && dsPane.classList.contains('active')) {
      window.openDatasheetForComponent(comp.type);
    }
  }
}

// ─────────────────────────────────────────────────────────────────
//  SIMULATION
// ─────────────────────────────────────────────────────────────────
function bbPulse() {
  // 1. Rising edge: set CLK=1 on all clocks
  const clocks = BB.components.filter(c => c instanceof ClockComponent);
  clocks.forEach(c => c.pulse());

  // 2. Propagate wires
  bbPropagate(true);

  // 3. Falling edge: CLK back to 0
  clocks.forEach(c => c.latchLow());
  bbPropagate(false);

  bbUpdateInspector();
  bbLog('Clock pulse', 'ok');

  // Challenge setup hook
  if (BB.currentChallenge && BB.currentChallenge.setup) {
    // Only run once at start (already done), not every pulse
  }
}

function bbPropagate(risingEdge) {
  // Models Ben Eater's timing:
  //   Rising edge → registers latch (using current signals)
  //   Falling edge → CU advances T-state → new signals propagate
  //
  // One Space press = one full clock cycle:
  //   1. Settle current signals
  //   2. Rising edge: all components EXCEPT CU latch
  //   3. CU advances (falling edge equivalent)
  //   4. Settle: new CU signals propagate to all destinations

  function propagateWires() {
    // Collect all values going to each destination pin
    // If multiple sources, take the non-zero one (bus behavior)
    // If multiple non-zero sources, that's contention
    const pinValues = new Map();

    for (const wire of BB.wires) {
      const srcPin  = wire.from.comp.getPin(wire.from.pin);
      const destPin = wire.to.comp.getPin(wire.to.pin);
      if (!srcPin || !destPin) continue;

      const key = destPin;
      if (!pinValues.has(key)) pinValues.set(key, []);
      pinValues.get(key).push(srcPin.value);
    }

    for (const [pin, values] of pinValues) {
      // Take the non-zero value (only one component should drive at a time)
      let result = 0;
      for (const v of values) {
        if (v !== 0) result = v;
      }
      pin.value = result;
    }
  }

  // Step 1: Settle — make sure current CU signals reach all components
  for (let s = 0; s < 6; s++) {
    for (const comp of BB.components) {
      comp.simulate(false);
    }
    propagateWires();
  }

  if (risingEdge) {
    // Step 2: Rising edge — all components EXCEPT CU latch with current signals
    for (const comp of BB.components) {
      if (comp instanceof ControlUnitComponent) continue;
      comp.simulate(true);
    }
    propagateWires();

    // Step 3: CU advances T-state (falling edge equivalent)
    for (const comp of BB.components) {
      if (comp instanceof ControlUnitComponent) {
        comp.simulate(true);
      }
    }
    propagateWires();

    // Step 4: Settle — new CU signals propagate through buses to components
    for (let s = 0; s < 6; s++) {
      for (const comp of BB.components) {
        comp.simulate(false);
      }
      propagateWires();
    }
  }
}

function bbStartAutoRun() {
  bbStopAutoRun();
  BB.autoRunInterval = setInterval(() => bbPulse(), BB.autoRunSpeed);
  const btn = document.getElementById('bb-run-btn');
  if (btn) btn.classList.add('active');
}

function bbStopAutoRun() {
  if (BB.autoRunInterval) { clearInterval(BB.autoRunInterval); BB.autoRunInterval = null; }
  const btn = document.getElementById('bb-run-btn');
  if (btn) btn.classList.remove('active');
}

function bbReset() {
  bbStopAutoRun();
  for (const comp of BB.components) {
    if (comp instanceof RegisterComponent)   comp._stored = 0;
    if (comp instanceof ProgramCounterComponent) comp._count = 0;
    if (comp instanceof MARComponent)        comp._stored = 0;
    if (comp instanceof InstructionRegisterComponent) comp._stored = 0;
    if (comp instanceof FlagsComponent)      { comp._cf = 0; comp._zf = 0; }
    if (comp instanceof OutputDisplayComponent) { comp._displayed = 0; comp._history = []; }
    if (comp instanceof ALUComponent)        { comp._result = 0; }
    for (const p of comp.pins) { if (p.dir === 'out') p.value = 0; }
  }
  bbLog('Board reset.', 'warn');
  bbUpdateInspector();
}

// ─────────────────────────────────────────────────────────────────
//  PALETTE
// ─────────────────────────────────────────────────────────────────
function bbBuildPalette() {
  const list = document.getElementById('bb-palette-list');
  if (!list) return;
  list.innerHTML = '';

  for (const item of PALETTE_ITEMS) {
    if (item.section) {
      const lbl = document.createElement('div');
      lbl.className = 'palette-section-label';
      lbl.textContent = item.section;
      list.appendChild(lbl);
      continue;
    }
    const chip = document.createElement('div');
    chip.className = 'palette-chip';
    chip.draggable = !('ontouchstart' in window);
    chip.innerHTML = `
      <div class="palette-chip-name">${item.label}</div>
      <div class="palette-chip-desc">${item.desc}</div>
      <div class="palette-chip-pins">${item.pins}</div>`;
    chip.title = item.desc;

    // Desktop: drag from palette onto canvas
    chip.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      // Skip drag behavior on touch devices — they use tap-to-place
      if (BB._lastInputWasTouch) return;
      e.preventDefault();
      const tmp = createComponent(item.type, 0, 0, { label: item.label });
      BB.paletteGhost = {
        type: item.type,
        opts: { label: item.label },
        x: -9999,
        y: -9999,
        _w: tmp.w / 2,
        _h: tmp.h / 2,
      };
    });

    // Tap-to-place: works on both mobile and desktop.
    // Tap a chip to select it, then tap the canvas to place it.
    function selectChipForPlacement() {
      const prev = document.querySelector('.palette-chip.pending-place');
      if (prev) prev.classList.remove('pending-place');

      if (BB.pendingPlace && BB.pendingPlace.chipEl === chip) {
        BB.pendingPlace = null;
        const hint = document.getElementById('bb-wire-hint');
        if (hint) { hint.textContent = ''; hint.classList.remove('visible'); }
        return;
      }

      chip.classList.add('pending-place');
      BB.pendingPlace = {
        type: item.type,
        opts: { label: item.label },
        chipEl: chip,
      };
      const hint = document.getElementById('bb-wire-hint');
      if (hint) { hint.textContent = 'Tap on the breadboard to place ' + item.label; hint.classList.add('visible'); }
    }

    // Desktop click
    chip.addEventListener('click', (e) => {
      if (BB._lastInputWasTouch) return; // handled by touchend
      selectChipForPlacement();
    });

    // Mobile touch — use touchend directly so it doesn't get blocked
    let _chipTouchMoved = false;
    chip.addEventListener('touchstart', (e) => {
      _chipTouchMoved = false;
      BB._lastInputWasTouch = true;
    }, { passive: true });
    chip.addEventListener('touchmove', () => {
      _chipTouchMoved = true;
    }, { passive: true });
    chip.addEventListener('touchend', (e) => {
      e.preventDefault(); // prevent ghost click
      if (_chipTouchMoved) return; // was a scroll, not a tap
      selectChipForPlacement();
    }, { passive: false });

    list.appendChild(chip);
  }
}

// ─────────────────────────────────────────────────────────────────
//  SIDEBAR
// ─────────────────────────────────────────────────────────────────
function bbBuildSidebar() {
  // Tab switching
  document.querySelectorAll('.bb-stab').forEach(btn => {
    btn.addEventListener('click', () => bbActivateSidebarTab(btn.dataset.tab));
  });

  // Build challenges list
  bbBuildChallengesList();

  // Controls tab
  const pulseBtn   = document.getElementById('bb-pulse-btn');
  const runBtn     = document.getElementById('bb-run-btn');
  const resetBtn   = document.getElementById('bb-reset-btn');
  const speedSlider= document.getElementById('bb-speed-slider');
  const speedVal   = document.getElementById('bb-speed-val');

  if (pulseBtn)    pulseBtn.addEventListener('click',  bbPulse);
  if (resetBtn)    resetBtn.addEventListener('click',  bbReset);
  if (runBtn)      runBtn.addEventListener('click', () => {
    BB.autoRunInterval ? bbStopAutoRun() : bbStartAutoRun();
  });
  if (speedSlider) speedSlider.addEventListener('input', (e) => {
    BB.autoRunSpeed = parseInt(e.target.value);
    if (speedVal) speedVal.textContent = BB.autoRunSpeed + 'ms';
    if (BB.autoRunInterval) { bbStopAutoRun(); bbStartAutoRun(); }
  });

  // Zoom buttons
  document.getElementById('bb-zoom-in')?.addEventListener('click', () => {
    BB.cam.scale = Math.min(2.5, BB.cam.scale * 1.2);
    const lvl = document.getElementById('bb-zoom-level');
    if (lvl) lvl.textContent = Math.round(BB.cam.scale * 100) + '%';
  });
  document.getElementById('bb-zoom-out')?.addEventListener('click', () => {
    BB.cam.scale = Math.max(0.25, BB.cam.scale * 0.83);
    const lvl = document.getElementById('bb-zoom-level');
    if (lvl) lvl.textContent = Math.round(BB.cam.scale * 100) + '%';
  });
  document.getElementById('bb-zoom-reset')?.addEventListener('click', () => {
    BB.cam = { ox: 100, oy: 60, scale: 1.0 };
    const lvl = document.getElementById('bb-zoom-level');
    if (lvl) lvl.textContent = '100%';
  });

  // Sandbox button
  document.getElementById('bb-sandbox-btn')?.addEventListener('click', () => {
    bbEnterSandbox();
  });
  document.getElementById('bb-clear-board-btn')?.addEventListener('click', () => {
    if (confirm('Clear all components and wires from the board?')) {
      BB.components = [];
      BB.wires      = [];
      BB.selected   = null;
      bbRefreshPinConnected();
      bbUpdateInspector();
      bbSaveState();
      bbLog('Board cleared.', 'warn');
    }
  });

  // Template button
  document.getElementById('bb-load-template-btn')?.addEventListener('click', () => {
    const sel = document.getElementById('bb-template-prog-select');
    const key = sel ? sel.value : 'add-two-numbers';
    if (typeof bbLoadTemplate === 'function') {
      bbLoadTemplate(key);
    }
  });

  // Populate template program dropdown
  const templateSel = document.getElementById('bb-template-prog-select');
  if (templateSel && typeof CPU_TEMPLATE_PROGRAMS !== 'undefined') {
    templateSel.innerHTML = '';
    for (const [key, prog] of Object.entries(CPU_TEMPLATE_PROGRAMS)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = prog.name;
      templateSel.appendChild(opt);
    }
  }
}

function bbActivateSidebarTab(tab) {
  document.querySelectorAll('.bb-stab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.bb-stab-pane').forEach(p => p.classList.toggle('active', p.id === 'bb-stab-' + tab));
}

// ─────────────────────────────────────────────────────────────────
//  INSPECTOR
// ─────────────────────────────────────────────────────────────────
function bbShowWireInInspector(wire) {
  const pane = document.getElementById('bb-stab-inspector');
  if (!pane) return;
  bbActivateSidebarTab('inspector');

  const fromLabel = `${wire.from.comp.label} · ${wire.from.pin}`;
  const toLabel   = `${wire.to.comp.label} · ${wire.to.pin}`;
  const val       = wire.value;
  const pin       = wire.from.comp.getPin(wire.from.pin);
  const valStr    = pin && pin.bits === 8
    ? `0x${(val & 0xFF).toString(16).toUpperCase().padStart(2,'0')} (${val})`
    : `${val}`;
  const colorBox  = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${wire.color};vertical-align:middle;margin-right:4px"></span>`;

  // "What happens next" section
  const whNext = typeof bbWhatHappensNext === 'function' ? bbWhatHappensNext() : null;
  const nextHtml = (whNext && !BB.autoRunInterval) ? `
    <div class="bb-prop-section bb-next-section">
      <div class="bb-prop-label" style="color:#ffaa00">What Happens Next?</div>
      <div class="bb-next-tstate">T${whNext.tNext}</div>
      <div class="bb-next-signals">${whNext.active.join(' + ') || 'NOP'}</div>
      <div class="bb-next-explain">${whNext.explain}</div>
    </div>` : '';

  let html = `
    <div class="bb-prop-section">
      <div class="bb-prop-row" style="align-items:center">
        ${colorBox}<span class="bb-prop-name-tag" style="background:#1a1a00;color:#ffaa00">WIRE</span>
      </div>
    </div>
    <div class="bb-prop-section">
      <div class="bb-prop-label">From</div>
      <div class="bb-prop-value" style="color:#00ff88">${fromLabel}</div>
      <div class="bb-prop-label" style="margin-top:6px">To</div>
      <div class="bb-prop-value" style="color:#4488ff">${toLabel}</div>
      ${wire.label ? `
      <div class="bb-prop-label" style="margin-top:6px">Role</div>
      <div class="bb-prop-value" style="color:${wire.color}">${wire.label}</div>` : ''}
      <div class="bb-prop-label" style="margin-top:6px">Current Value</div>
      <div class="bb-prop-value" style="color:${val !== 0 ? wire.color : '#4a6278'};font-size:13px">${valStr}</div>
      <div class="bb-prop-value" style="color:#4a6278;font-size:10px;margin-top:3px">${val !== 0 ? 'ACTIVE — signal is flowing' : 'IDLE — no signal'}</div>
    </div>
    ${nextHtml}`;

  pane.innerHTML = html;
}

function bbUpdateInspector() {
  const pane  = document.getElementById('bb-stab-inspector');
  if (!pane) return;
  const comp  = BB.selected;

  if (!comp) {
    pane.innerHTML = `<div id="bb-inspector-empty">Select a component to inspect its pins and values.<br><br><span style="color:#2e3e52;font-size:10px">Tip: click a wire to inspect it.</span></div>`;
    return;
  }

  const data = comp.getInspectorData();
  let html   = `
    <div class="bb-prop-section">
      <div class="bb-prop-row">
        <span class="bb-prop-name-tag">${comp.label}</span>
        <button class="bb-rename-btn" onclick="bbOpenRenameModal(window.BB.selected)">Rename</button>
      </div>
      <div class="bb-prop-label">Type</div>
      <div class="bb-prop-value">${comp.type}</div>
    </div>`;

  // Component description (educational text)
  if (data.description) {
    html += `
    <div class="bb-prop-section bb-comp-description">
      <div class="bb-prop-label" style="color:#aa66ff">What is this?</div>
      <div class="bb-comp-desc-text">${data.description}</div>
    </div>`;
  }

  // Value display for value-holding components
  if (comp._stored !== undefined) {
    const v = comp._stored;
    html += `
      <div class="bb-prop-section">
        <div class="bb-prop-label">Stored Value</div>
        <div class="bb-prop-value val-hex">0x${v.toString(16).toUpperCase().padStart(2,'0')}</div>
        <div class="bb-prop-value val-dec">${v}</div>
        <div class="bb-prop-value val-bin">${v.toString(2).padStart(8,'0')}</div>
      </div>`;
  }
  if (comp._count !== undefined) {
    const v = comp._count;
    html += `
      <div class="bb-prop-section">
        <div class="bb-prop-label">Count</div>
        <div class="bb-prop-value val-hex">0x${v.toString(16).toUpperCase().padStart(2,'0')} = ${v}</div>
      </div>`;
  }
  if (comp._displayed !== undefined) {
    html += `
      <div class="bb-prop-section">
        <div class="bb-prop-label">Displayed Value</div>
        <div class="bb-prop-value val-dec">${comp._displayed}</div>
        ${comp._history && comp._history.length > 1 ?
          `<div class="bb-prop-value" style="font-size:10px;color:#4a6278">History: ${comp._history.join(', ')}</div>` : ''}
      </div>`;
  }
  if (comp._cf !== undefined) {
    html += `
      <div class="bb-prop-section">
        <div class="bb-prop-label">Flags</div>
        <div class="bb-prop-value">CF = <span style="color:${comp._cf?'#00ff88':'#4a6278'}">${comp._cf}</span>
          &nbsp; ZF = <span style="color:${comp._zf?'#ffaa00':'#4a6278'}">${comp._zf}</span></div>
      </div>`;
  }
  if (comp._state !== undefined) {
    html += `
      <div class="bb-prop-section">
        <div class="bb-prop-label">Switch State</div>
        <div class="bb-prop-value" style="color:${comp._state?'#00ff88':'#4a6278'}">${comp._state} (double-click to toggle)</div>
      </div>`;
  }
  if (comp._value !== undefined && comp instanceof ConstantComponent) {
    html += `
      <div class="bb-prop-section">
        <div class="bb-prop-label">Constant Value</div>
        <div class="bb-prop-value val-dec">${comp._value} = 0x${comp._value.toString(16).toUpperCase().padStart(2,'0')}</div>
      </div>`;
  }

  // Pins
  html += `<div class="bb-prop-section"><div class="bb-prop-label">Pins</div><div class="bb-pin-list">`;
  for (const pin of data.pins) {
    const dotClass = `bb-pin-dot ${pin.connected ? 'connected' : ''} ${pin.dir === 'in' ? 'inp' : ''}`;
    html += `
      <div class="bb-pin-row">
        <span class="${dotClass}"></span>
        <span class="bb-pin-name">${pin.name}</span>
        <span style="color:#4a6278;font-size:9px">${pin.dir === 'in' ? 'in' : 'out'}</span>
        <span class="bb-pin-value">${pin.value}</span>
      </div>`;
  }
  html += `</div></div>`;

  // Connected wires section
  const connWires = BB.wires.filter(w => w.from.comp === comp || w.to.comp === comp);
  if (connWires.length > 0) {
    html += `<div class="bb-prop-section"><div class="bb-prop-label">Connected Wires</div><div class="bb-wire-list">`;
    for (const w of connWires) {
      const isFrom = w.from.comp === comp;
      const otherComp = isFrom ? w.to.comp   : w.from.comp;
      const otherPin  = isFrom ? w.to.pin     : w.from.pin;
      const ownPin    = isFrom ? w.from.pin   : w.to.pin;
      const arrow     = isFrom ? '&rarr;' : '&larr;';
      const val       = w.value;
      const dotStyle  = `display:inline-block;width:7px;height:7px;border-radius:50%;background:${w.color};vertical-align:middle;margin-right:4px;flex-shrink:0`;
      const wireId    = w.id;
      html += `
      <div class="bb-wire-row" onclick="window.BB && (function(){ var w=BB.wires.find(function(x){return x.id===${wireId};}); if(w){w.flash(); bbShowWireInInspector(w);} })()">
        <span style="${dotStyle}"></span>
        <span class="bb-wire-pin">${ownPin}</span>
        <span class="bb-wire-arrow">${arrow}</span>
        <span class="bb-wire-dest">${otherComp.label}.${otherPin}</span>
        <span class="bb-wire-val" style="color:${val!==0?w.color:'#2e3e52'}">${val!==0?val:''}</span>
      </div>`;
    }
    html += `</div></div>`;
  }

  // "What happens next" section — only when CU is in the board and paused
  const whNext = typeof bbWhatHappensNext === 'function' ? bbWhatHappensNext() : null;
  if (whNext && !BB.autoRunInterval) {
    html += `
    <div class="bb-prop-section bb-next-section">
      <div class="bb-prop-label" style="color:#ffaa00">What Happens Next?</div>
      <div class="bb-next-tstate">T${whNext.tNext}</div>
      <div class="bb-next-signals">${whNext.active.join(' + ') || 'NOP'}</div>
      <div class="bb-next-explain">${whNext.explain}</div>
    </div>`;
  }

  // Delete button
  html += `<button class="bb-delete-btn" onclick="bbRemoveComponent(window.BB.selected)">Delete Component</button>`;

  pane.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────
//  CHALLENGES UI
// ─────────────────────────────────────────────────────────────────
function bbBuildChallengesList() {
  const listEl = document.getElementById('bb-challenge-list-inner');
  if (!listEl) return;
  listEl.innerHTML = '';

  for (const ch of BB_CHALLENGES) {
    const item = document.createElement('div');
    item.className = 'bb-challenge-item' + (BB.solvedChallenges.has(ch.id) ? ' solved' : '');
    item.dataset.id = ch.id;

    const stars = ch.stars || 0;
    const starStr = [1,2,3].map(n => `<span class="${n <= stars ? 'star-lit' : ''}">&#9733;</span>`).join('');

    item.innerHTML = `
      <div class="bb-challenge-num">Challenge ${ch.num}</div>
      <div class="bb-challenge-name">${ch.title}</div>
      <div class="bb-challenge-stars">${starStr}</div>
      ${BB.solvedChallenges.has(ch.id) ? '<div class="bb-challenge-badge">&#10003;</div>' : ''}`;

    item.addEventListener('click', () => bbOpenChallenge(ch.id));
    listEl.appendChild(item);
  }

  // Progress
  const prog = document.getElementById('bb-challenge-progress');
  if (prog) prog.textContent = `${BB.solvedChallenges.size} / ${BB_CHALLENGES.length} solved`;
}

function bbOpenChallenge(id) {
  const ch = BB_CHALLENGES.find(c => c.id === id);
  if (!ch) return;
  BB.currentChallenge = ch;
  BB.challengeAttempts = 0;
  BB.hintShown = false;

  const listEl   = document.getElementById('bb-challenge-list-wrap');
  const detailEl = document.getElementById('bb-challenge-detail');
  if (listEl)   listEl.style.display   = 'none';
  if (detailEl) { detailEl.classList.add('visible'); }

  const numEl   = document.getElementById('bb-ch-num');
  const titleEl = document.getElementById('bb-ch-title');
  const descEl  = document.getElementById('bb-ch-desc');
  const learnEl = document.getElementById('bb-ch-learn');
  const reqEl   = document.getElementById('bb-ch-required');
  const resultEl= document.getElementById('bb-ch-result');
  const hintEl  = document.getElementById('bb-ch-hint');

  if (numEl)   numEl.textContent   = 'Challenge ' + ch.num;
  if (titleEl) titleEl.textContent = ch.title;
  if (descEl)  descEl.innerHTML    = ch.description;
  if (learnEl) learnEl.textContent = ch.learnText;
  if (resultEl){ resultEl.className = 'bb-check-result'; resultEl.style.display = 'none'; }
  if (hintEl)  hintEl.classList.remove('visible');

  // Required components
  if (reqEl && ch.requiredTypes) {
    reqEl.innerHTML = ch.requiredTypes.map(t =>
      `<span class="bb-comp-tag">${t}</span>`
    ).join('');
  }

  // Run challenge setup if defined
  if (ch.setup) ch.setup({ components: BB.components, wires: BB.wires });

  // Switch to challenge tab
  bbActivateSidebarTab('challenge');

  // Mark active
  document.querySelectorAll('.bb-challenge-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });

  bbLog(`Challenge ${ch.num}: ${ch.title}`, 'ok');
}

function bbCheckChallenge() {
  if (!BB.currentChallenge) return;
  const ch     = BB.currentChallenge;
  const result = ch.check({ components: BB.components, wires: BB.wires });
  BB.challengeAttempts++;
  ch.attempts++;

  const resultEl = document.getElementById('bb-ch-result');
  if (resultEl) {
    resultEl.style.display = 'block';
    resultEl.className = 'bb-check-result visible ' + (result.pass ? 'pass' : 'fail');
    resultEl.textContent = result.msg;
  }

  if (result.pass) {
    // Calculate stars
    const stars = calcStars(ch, BB.challengeAttempts, BB.wires.length, 0);
    ch.stars = Math.max(ch.stars || 0, stars);
    ch.solved = true;
    BB.solvedChallenges.add(ch.id);

    const starStr = [1,2,3].map(n => n <= stars ? '&#9733;' : '&#9734;').join('');
    bbShowCompleteOverlay(ch, stars, starStr);
    bbBuildChallengesList();
    bbSaveState();
  }

  // Show hint after 2 fails
  if (!result.pass && ch.attempts >= 2) {
    const hintBtn = document.getElementById('bb-ch-hint-btn');
    if (hintBtn) hintBtn.style.display = '';
  }
}

function bbShowSolution() {
  const ch = BB.currentChallenge;
  if (!ch || !ch.solutionLayout) { bbLog('No solution available for this challenge.', 'warn'); return; }

  // Clear board
  BB.components = [];
  BB.wires      = [];
  BB.selected   = null;

  // Place components from solution layout
  const placed = {};
  for (const item of ch.solutionLayout) {
    const comp = createComponent(item.type, item.x, item.y, item.opts);
    BB.components.push(comp);
    if (!placed[item.type]) placed[item.type] = [];
    placed[item.type].push(comp);
  }

  // Wire from solution spec if present
  if (ch.solution) {
    for (const spec of ch.solution) {
      const fromComps = BB.components.filter(c => c.type === spec.from.type);
      const toComps   = BB.components.filter(c => c.type === spec.to.type);
      if (fromComps[0] && toComps[0]) {
        bbAddWire(fromComps[0], spec.from.pin, toComps[0], spec.to.pin);
      }
    }
  }

  bbRefreshPinConnected();
  bbLog('Solution applied. Study the connections!', 'ok');
}

function bbShowCompleteOverlay(ch, stars, starStr) {
  const overlay = document.getElementById('bb-complete-overlay');
  if (!overlay) return;
  overlay.classList.add('visible');
  overlay.innerHTML = `
    <div class="bb-complete-box">
      <div class="bb-complete-title">CHALLENGE ${ch.num} COMPLETE!</div>
      <div class="bb-complete-stars">${starStr}</div>
      <div class="bb-complete-subtitle">${ch.shortDesc}</div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:8px">
        ${ch.num < BB_CHALLENGES.length ?
          `<button class="bb-complete-next" onclick="bbNextChallenge()">Next Challenge</button>` : ''}
        <button class="bb-complete-dismiss" onclick="document.getElementById('bb-complete-overlay').classList.remove('visible')">Continue</button>
      </div>
    </div>`;
}

function bbNextChallenge() {
  document.getElementById('bb-complete-overlay')?.classList.remove('visible');
  const idx = BB_CHALLENGES.indexOf(BB.currentChallenge);
  if (idx >= 0 && idx + 1 < BB_CHALLENGES.length) {
    bbOpenChallenge(BB_CHALLENGES[idx + 1].id);
  }
}

function bbEnterSandbox() {
  BB.currentChallenge = null;
  BB.isSandbox = true;
  const listEl   = document.getElementById('bb-challenge-list-wrap');
  const detailEl = document.getElementById('bb-challenge-detail');
  if (listEl)   listEl.style.display = '';
  if (detailEl) detailEl.classList.remove('visible');
  bbActivateSidebarTab('controls');
  bbLog('Sandbox mode — build freely!', 'ok');
}

function bbBackToChallengeList() {
  BB.currentChallenge = null;
  const listEl   = document.getElementById('bb-challenge-list-wrap');
  const detailEl = document.getElementById('bb-challenge-detail');
  if (listEl)   listEl.style.display = '';
  if (detailEl) detailEl.classList.remove('visible');
  document.querySelectorAll('.bb-challenge-item').forEach(el => el.classList.remove('active'));
}

// ─────────────────────────────────────────────────────────────────
//  TOOLTIP
// ─────────────────────────────────────────────────────────────────
function bbShowPinTooltip(pinHit, clientX, clientY) {
  const tip  = document.getElementById('bb-tooltip');
  if (!tip) return;
  const pin  = pinHit.comp.getPin(pinHit.pin);
  if (!pin)  return;
  tip.innerHTML = `
    <span class="tt-pin">${pinHit.comp.label}.${pin.name}</span><br>
    <span class="tt-dir">${pin.dir === 'out' ? 'OUTPUT' : 'INPUT'} · ${pin.bits}-bit</span><br>
    Value: <span class="tt-val">${pin.value}${pin.bits === 8 ? ' (0x' + pin.value.toString(16).toUpperCase().padStart(2,'0') + ')' : ''}</span>`;
  tip.classList.add('visible');
  tip.style.left = (clientX + 14) + 'px';
  tip.style.top  = (clientY - 8)  + 'px';
}

function bbUpdateTooltipForPin(sp, wp) {
  const pinHit = getPinAt(wp.x, wp.y);
  if (pinHit) {
    const r = BB.canvas.getBoundingClientRect();
    bbShowPinTooltip(pinHit, r.left + sp.x, r.top + sp.y);
  } else {
    bbHideTooltip();
  }
}

function bbHideTooltip() {
  const tip = document.getElementById('bb-tooltip');
  if (tip) tip.classList.remove('visible');
}

// ─────────────────────────────────────────────────────────────────
//  CONTEXT MENU
// ─────────────────────────────────────────────────────────────────
function bbShowContextMenu(x, y, items) {
  const menu = document.getElementById('bb-context-menu');
  if (!menu) return;
  menu.innerHTML = '';
  for (const item of items) {
    if (item.sep) {
      const sep = document.createElement('div');
      sep.className = 'bb-ctx-sep';
      menu.appendChild(sep);
      continue;
    }
    const el = document.createElement('div');
    el.className = 'bb-ctx-item' + (item.danger ? ' danger' : '');
    el.textContent = item.label;
    el.addEventListener('click', () => { item.action(); bbHideContextMenu(); });
    menu.appendChild(el);
  }
  menu.style.left = x + 'px';
  menu.style.top  = y + 'px';
  menu.classList.add('visible');
}

function bbHideContextMenu() {
  const menu = document.getElementById('bb-context-menu');
  if (menu) menu.classList.remove('visible');
}

// Close context menu on outside click
document.addEventListener('click', (e) => {
  const menu = document.getElementById('bb-context-menu');
  if (menu && !menu.contains(e.target)) bbHideContextMenu();
});

// ─────────────────────────────────────────────────────────────────
//  RENAME MODAL
// ─────────────────────────────────────────────────────────────────
function bbOpenRenameModal(comp) {
  if (!comp) return;
  const modal = document.getElementById('bb-rename-modal');
  const input = document.getElementById('bb-rename-input');
  if (!modal || !input) return;
  input.value = comp.label;
  modal.classList.add('visible');
  input.focus();
  input.select();

  const confirm = document.getElementById('bb-rename-confirm');
  const cancel  = document.getElementById('bb-rename-cancel');

  const doConfirm = () => {
    const v = input.value.trim();
    if (v) { comp.label = v; bbUpdateInspector(); bbSaveState(); }
    modal.classList.remove('visible');
    cleanup();
  };
  const doCancel = () => { modal.classList.remove('visible'); cleanup(); };

  confirm.onclick = doConfirm;
  cancel.onclick  = doCancel;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') doConfirm();
    if (e.key === 'Escape') doCancel();
  };
  function cleanup() { confirm.onclick = null; cancel.onclick = null; input.onkeydown = null; }
}

function bbSetConstantValue(comp) {
  const v = prompt('Enter constant value (0–255):', comp._value);
  if (v !== null) {
    const n = parseInt(v);
    if (!isNaN(n)) { comp._value = Math.max(0, Math.min(255, n)); bbUpdateInspector(); bbSaveState(); }
  }
}

// ─────────────────────────────────────────────────────────────────
//  LOG
// ─────────────────────────────────────────────────────────────────
function bbLog(msg, type) {
  BB.simLog.push({ msg, type: type || 'log', t: Date.now() });
  if (BB.simLog.length > BB.maxLog) BB.simLog.shift();
  const logEl = document.getElementById('bb-sim-log');
  if (!logEl) return;
  const entry = document.createElement('div');
  entry.className = 'bb-log-entry log-' + (type || 'log');
  entry.textContent = msg;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
  if (logEl.children.length > BB.maxLog) logEl.removeChild(logEl.firstChild);
}

// ─────────────────────────────────────────────────────────────────
//  PERSISTENCE  (index-based wire save/restore)
// ─────────────────────────────────────────────────────────────────
function bbSaveState() {
  try {
    const compList = BB.components;
    const data = {
      components: compList.map(c => ({
        type:    c.type,
        x:       c.x,
        y:       c.y,
        label:   c.label,
        _stored: c._stored,
        _count:  c._count,
        _value:  c._value,
        _state:  c._state,
        _cf:     c._cf,
        _zf:     c._zf,
        _mem:    (c instanceof RAMComponent) ? Array.from(c._mem.slice(0, 64)) : undefined,
        // Electronics extras
        _q:      c._q,
        _bits:   c._bits,
        _latched:c._latched,
        _out:    c._out,
        _mode:   c._mode,
        _period: c._period,
        _color:  c._color,
        _ohms:   c._ohms,
        _uf:     c._uf,
        _mh:     c._mh,
        _voltage:c._voltage,
      })),
      // Store wires as pairs of [compIndex, pinName]
      wires: BB.wires.map(w => ({
        fi:  compList.indexOf(w.from.comp),
        fp:  w.from.pin,
        ti:  compList.indexOf(w.to.comp),
        tp:  w.to.pin,
        col: w.color,
        lbl: w.label || undefined,
      })).filter(w => w.fi >= 0 && w.ti >= 0),
      cam:    BB.cam,
      solved: Array.from(BB.solvedChallenges),
      stars:  BB_CHALLENGES.map(c => ({ id: c.id, stars: c.stars || 0 })),
    };
    localStorage.setItem('bb-board-state', JSON.stringify(data));
  } catch(e) { /* quota or parse errors — silently skip */ }
}

function bbLoadState() {
  try {
    const raw = localStorage.getItem('bb-board-state');
    if (!raw) return false;
    const data = JSON.parse(raw);

    // Restore components
    BB.components = [];
    for (const cd of (data.components || [])) {
      let comp;
      try { comp = createComponent(cd.type, cd.x, cd.y, { label: cd.label }); }
      catch(ce) { console.warn('Skipping component:', cd.type, ce); continue; }
      if (!comp) continue;
      comp.label = cd.label || comp.label;
      if (cd._stored !== undefined) comp._stored = cd._stored;
      if (cd._count  !== undefined) comp._count  = cd._count;
      if (cd._value  !== undefined) comp._value  = cd._value;
      if (cd._state  !== undefined) {
        comp._state = cd._state;
        const outPin = comp.getPin ? comp.getPin('OUT') : null;
        if (outPin) outPin.value = cd._state;
      }
      if (cd._cf !== undefined) comp._cf = cd._cf;
      if (cd._zf !== undefined) comp._zf = cd._zf;
      if (cd._mem && comp._mem) {
        const memArr = Array.isArray(cd._mem) ? cd._mem : [];
        memArr.forEach((v, i) => { if (i < comp._mem.length) comp._mem[i] = v; });
      }
      // Electronics extras
      if (cd._q       !== undefined) comp._q       = cd._q;
      if (cd._bits    !== undefined) comp._bits    = cd._bits;
      if (cd._latched !== undefined) comp._latched = cd._latched;
      if (cd._out     !== undefined) comp._out     = cd._out;
      if (cd._mode    !== undefined) comp._mode    = cd._mode;
      if (cd._period  !== undefined) comp._period  = cd._period;
      if (cd._color   !== undefined) comp._color   = cd._color;
      if (cd._ohms    !== undefined) comp._ohms    = cd._ohms;
      if (cd._uf      !== undefined) comp._uf      = cd._uf;
      if (cd._mh      !== undefined) comp._mh      = cd._mh;
      if (cd._voltage !== undefined) comp._voltage = cd._voltage;
      BB.components.push(comp);
    }

    // Restore wires using saved component indices
    BB.wires = [];
    for (const wd of (data.wires || [])) {
      const fromComp = BB.components[wd.fi];
      const toComp   = BB.components[wd.ti];
      if (!fromComp || !toComp) continue;
      if (!fromComp.getPin(wd.fp) || !toComp.getPin(wd.tp)) continue;
      const wire    = new Wire(fromComp, wd.fp, toComp, wd.tp);
      wire.color    = wd.col || wire.color;
      if (wd.lbl)   wire.label = wd.lbl;
      BB.wires.push(wire);
    }

    if (data.cam) BB.cam = data.cam;
    BB.solvedChallenges = new Set(data.solved || []);
    if (data.stars) {
      for (const cs of data.stars) {
        const ch = BB_CHALLENGES.find(c => c.id === cs.id);
        if (ch) ch.stars = cs.stars;
      }
    }

    bbRefreshPinConnected();
    bbBuildChallengesList();
    return BB.components.length > 0;
  } catch(e) {
    console.warn('bb-engine: could not load state', e);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────
//  MODE ENTER / EXIT
// ─────────────────────────────────────────────────────────────────
function enterBuildMode() {
  document.body.classList.add('build-mode');
  // Give CSS time to apply, then size the canvas
  setTimeout(() => {
    bbResizeCanvas();
  }, 60);
}

function exitBuildMode() {
  document.body.classList.remove('build-mode');
  bbStopAutoRun();
}

// ─────────────────────────────────────────────────────────────────
//  EXPORTS
// ─────────────────────────────────────────────────────────────────
window.BB                    = BB;
window.bbInit                = bbInit;
window.bbPulse               = bbPulse;
window.bbReset               = bbReset;
window.bbStartAutoRun        = bbStartAutoRun;
window.bbStopAutoRun         = bbStopAutoRun;
window.enterBuildMode        = enterBuildMode;
window.exitBuildMode         = exitBuildMode;
window.bbOpenRenameModal     = bbOpenRenameModal;
window.bbRemoveComponent     = bbRemoveComponent;
window.bbCheckChallenge      = bbCheckChallenge;
window.bbShowSolution        = bbShowSolution;
window.bbNextChallenge       = bbNextChallenge;
window.bbEnterSandbox        = bbEnterSandbox;
window.bbBackToChallengeList = bbBackToChallengeList;
window.bbOpenChallenge       = bbOpenChallenge;
window.bbShowWireInInspector = bbShowWireInInspector;

// ─────────────────────────────────────────────
// Describe Build — global function called by onclick
// ─────────────────────────────────────────────
function bbDescribeBuild() {
  let text = '=== BREADBOARD BUILD ===\n\n';

  text += 'COMPONENTS (' + BB.components.length + '):\n';
  BB.components.forEach((c, i) => {
    text += '  [' + i + '] ' + c.type + ' "' + c.label + '"';
    if (c._stored !== undefined) text += ' stored=' + c._stored;
    if (c._value !== undefined) text += ' value=' + c._value;
    if (c._displayed !== undefined) text += ' displayed=' + c._displayed;
    if (c._count !== undefined) text += ' count=' + c._count;
    if (c._state !== undefined) text += ' state=' + c._state;
    if (c._mem) text += ' RAM=[' + Array.from(c._mem).slice(0, 16).join(',') + ']';
    text += '\n';
    c.pins.forEach(p => {
      const connected = BB.wires.some(w =>
        (w.from.comp === c && w.from.pin === p.name) ||
        (w.to.comp === c && w.to.pin === p.name)
      );
      text += '    ' + (p.dir === 'in' ? '→' : '←') + ' ' + p.name + '=' + p.value + (connected ? ' [wired]' : ' [open]') + '\n';
    });
  });

  text += '\nWIRES (' + BB.wires.length + '):\n';
  BB.wires.forEach((w, i) => {
    const fromLabel = w.from.comp.label || w.from.comp.type;
    const toLabel = w.to.comp.label || w.to.comp.type;
    const val = w.value !== undefined ? w.value : '?';
    text += '  [' + i + '] ' + fromLabel + '.' + w.from.pin + ' -> ' + toLabel + '.' + w.to.pin + ' (value=' + val + ')\n';
  });

  text += '\nQUICK CHECK:\n';
  const types = {};
  BB.components.forEach(c => { types[c.type] = (types[c.type] || 0) + 1; });
  ['Clock', 'PC', 'MAR', 'RAM', 'IR', 'CU', 'Register', 'ALU', 'Bus'].forEach(t => {
    if (!types[t]) text += '  MISSING: ' + t + '\n';
  });
  const openInputs = [];
  BB.components.forEach(c => {
    c.pins.forEach(p => {
      if (p.dir === 'in') {
        const wired = BB.wires.some(w => w.to.comp === c && w.to.pin === p.name);
        if (!wired) openInputs.push(c.label + '.' + p.name);
      }
    });
  });
  if (openInputs.length > 0) {
    text += '  UNWIRED INPUTS (' + openInputs.length + '):\n';
    openInputs.forEach(s => { text += '    ' + s + '\n'; });
  } else {
    text += '  All inputs wired.\n';
  }

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      bbLog('Build description copied to clipboard!', 'info');
      alert('Copied! Paste it into chat to get help.');
    }).catch(() => {
      prompt('Copy this text:', text);
    });
  } else {
    prompt('Copy this text:', text);
  }
}
window.bbDescribeBuild = bbDescribeBuild;

// ─────────────────────────────────────────────
// Export/Import build as a JSON file
// ─────────────────────────────────────────────
function bbExportBuild() {
  bbSaveState(); // ensure latest state is captured
  const raw = localStorage.getItem('bb-board-state');
  if (!raw) { alert('Nothing to save — board is empty.'); return; }
  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = 'cpu-build-' + date + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  bbLog('Build saved to file!', 'info');
}

function bbImportBuild(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const raw = e.target.result;
      const data = JSON.parse(raw);
      // Validate basic structure
      if (!data.components || !Array.isArray(data.components)) {
        alert('Invalid file: missing components array');
        return;
      }
      localStorage.setItem('bb-board-state', raw);
      // Reload the board
      const loaded = bbLoadState();
      if (loaded) {
        bbRefreshPinConnected();
        bbUpdateInspector();
        bbLog('Build loaded from file! (' + BB.components.length + ' components, ' + BB.wires.length + ' wires)', 'info');
        alert('Loaded! ' + BB.components.length + ' components, ' + BB.wires.length + ' wires.');
      } else {
        alert('Load failed. Check browser console for details (F12).');
      }
    } catch(err) {
      alert('Error: ' + err.message);
      console.error('Import error:', err);
    }
    input.value = ''; // reset so same file can be loaded again
  };
  reader.readAsText(file);
}

window.bbExportBuild = bbExportBuild;
window.bbImportBuild = bbImportBuild;
