/**
 * CPU Simulator — Tutorial / Learn Mode
 * Self-contained lesson system layered on top of the existing simulator.
 * Does NOT modify cpu.js or assembler.js.
 *
 * Interface contract with ui.js:
 *   - Tutorial reads window.App (cpu, assembler, etc.) after initApp() runs
 *   - Tutorial calls window.doStep / window.doReset / window.updateFullDisplay
 *   - Tutorial manipulates CSS classes on existing DOM elements for dimming
 *   - Tutorial is activated via body.classList.add('learn-mode')
 */

// ─────────────────────────────────────────
//  TUTORIAL STATE
// ─────────────────────────────────────────

const Tutorial = {
  currentLesson:   0,     // 0-indexed
  stepCount:       0,     // generic counter (resets per lesson)
  taskDone:        false,
  predictionsDone: 0,
  initialized:     false,

  // Overview state
  overviewActive:   false,
  currentScene:     0,    // 0-indexed into OVERVIEW_SCENES
  currentPage:      0,    // 0-indexed page within current scene
};

const TOTAL_LESSONS = 12;
const STORAGE_KEY   = 'cpu-tutorial-progress';
const OVERVIEW_SEEN_KEY = 'cpu-overview-seen';

// ─────────────────────────────────────────
//  OVERVIEW SCENES — 14 narrative scenes
// ─────────────────────────────────────────

// ─────────────────────────────────────────
//  SERIES + EPISODE REGISTRY
//  Series A = CPU Architecture (block-level). Series B = Building Blocks (gate-level).
//  Each episode declares which diagram surface it uses: 'cpu' or 'blocks'.
//  Episode scene arrays are resolved lazily via scenesRef() so they can live
//  in separate files loaded after tutorial.js.
// ─────────────────────────────────────────
const _SERIES = {
  A: {
    id: 'A',
    label: 'Series A — CPU Architecture',
    episodes: [
      { id: 1, label: 'Ep 1 — How a CPU Works', diagram: 'cpu',
        scenesRef: () => OVERVIEW_SCENES },
      { id: 2, label: 'Ep 2 — The Stack', diagram: 'cpu',
        scenesRef: () => (typeof window !== 'undefined' && window.V2_SCENES) ? window.V2_SCENES : [] },
    ],
  },
  B: {
    id: 'B',
    label: 'Series B — Building Blocks',
    episodes: [
      { id: 1, label: 'Ep 1 — The Clock', diagram: 'blocks',
        scenesRef: () => (typeof window !== 'undefined' && window.BLOCKS_01_SCENES) ? window.BLOCKS_01_SCENES : [] },
      { id: 2, label: 'Ep 2 — The Flip-Flop', diagram: 'blocks',
        scenesRef: () => (typeof window !== 'undefined' && window.BLOCKS_02_SCENES) ? window.BLOCKS_02_SCENES : [] },
      { id: 3, label: 'Ep 3 — The Register', diagram: 'blocks',
        scenesRef: () => (typeof window !== 'undefined' && window.BLOCKS_03_SCENES) ? window.BLOCKS_03_SCENES : [] },
      { id: 4, label: 'Ep 4 — The Counter', diagram: 'blocks',
        scenesRef: () => (typeof window !== 'undefined' && window.BLOCKS_04_SCENES) ? window.BLOCKS_04_SCENES : [] },
      { id: 5, label: 'Ep 5 — The Decoder', diagram: 'blocks',
        scenesRef: () => (typeof window !== 'undefined' && window.BLOCKS_05_SCENES) ? window.BLOCKS_05_SCENES : [] },
      { id: 6, label: 'Ep 6 — The Multiplexer', diagram: 'blocks',
        scenesRef: () => (typeof window !== 'undefined' && window.BLOCKS_06_SCENES) ? window.BLOCKS_06_SCENES : [] },
      { id: 7, label: 'Ep 7 — The Comparator', diagram: 'blocks',
        scenesRef: () => (typeof window !== 'undefined' && window.BLOCKS_07_SCENES) ? window.BLOCKS_07_SCENES : [] },
      { id: 8, label: 'Ep 8 — The Adder', diagram: 'blocks',
        scenesRef: () => (typeof window !== 'undefined' && window.BLOCKS_08_SCENES) ? window.BLOCKS_08_SCENES : [] },
      { id: 9, label: 'Ep 9 — The ALU', diagram: 'blocks',
        scenesRef: () => (typeof window !== 'undefined' && window.BLOCKS_09_SCENES) ? window.BLOCKS_09_SCENES : [] },
      { id: 10, label: 'Ep 10 — RAM', diagram: 'blocks',
        scenesRef: () => (typeof window !== 'undefined' && window.BLOCKS_10_SCENES) ? window.BLOCKS_10_SCENES : [] },
      { id: 11, label: 'Ep 11 — Combinational Logic', diagram: 'blocks',
        scenesRef: () => (typeof window !== 'undefined' && window.BLOCKS_11_SCENES) ? window.BLOCKS_11_SCENES : [] },
      { id: 12, label: 'Ep 12 — Boolean Algebra & K-maps', diagram: 'blocks',
        scenesRef: () => (typeof window !== 'undefined' && window.BLOCKS_12_SCENES) ? window.BLOCKS_12_SCENES : [] },
      { id: 13, label: 'Ep 13 — The Control Unit', diagram: 'blocks',
        scenesRef: () => (typeof window !== 'undefined' && window.BLOCKS_13_SCENES) ? window.BLOCKS_13_SCENES : [] },
    ],
  },
  C: {
    id: 'C',
    label: 'Series C — Down To The Atoms',
    episodes: [
      { id: 1, label: 'Ep 1 — The Transistor', diagram: 'blocks',
        scenesRef: () => (typeof window !== 'undefined' && window.ATOMS_01_SCENES) ? window.ATOMS_01_SCENES : [] },
      { id: 2, label: 'Ep 2 — The CMOS Inverter', diagram: 'blocks',
        scenesRef: () => (typeof window !== 'undefined' && window.ATOMS_02_SCENES) ? window.ATOMS_02_SCENES : [] },
    ],
  },
};

let _activeSeriesId   = 'A';
let _activeEpisodeIdx = 0;

function _activeEpisode() {
  const s = _SERIES[_activeSeriesId];
  if (!s) return null;
  return s.episodes[_activeEpisodeIdx] || null;
}
function _getScenes() {
  const ep = _activeEpisode();
  if (!ep) return [];
  try { return ep.scenesRef() || []; } catch (e) { return []; }
}
function _activeDiagramKind() {
  const ep = _activeEpisode();
  return ep ? ep.diagram : 'cpu';
}
function _switchEpisode(seriesId, episodeIdx) {
  if (!_SERIES[seriesId]) return;
  const eps = _SERIES[seriesId].episodes;
  if (episodeIdx < 0 || episodeIdx >= eps.length) return;
  _activeSeriesId   = seriesId;
  _activeEpisodeIdx = episodeIdx;
  Tutorial.currentScene = 0;
  Tutorial.currentPage = 0;
  // Tear down the previous scene's animation loop and surfaces.
  if (_currentSceneCleanup) { try { _currentSceneCleanup(); } catch(e) {} _currentSceneCleanup = null; }
  _diagBuilt = false;
  _diagContainer = null;
  if (typeof Blocks !== 'undefined' && Blocks.teardown) Blocks.teardown();
  const animArea = document.getElementById('ov-animation-area');
  if (animArea) animArea.innerHTML = '';
  if (typeof renderOverviewScene === 'function') renderOverviewScene(0, 0);
  if (typeof buildOverviewDots === 'function') buildOverviewDots();
}

const OVERVIEW_SCENES = [
  {
    id: 1,
    title: 'What Powers Everything',
    pages: [
      // Page 0
      { sentences: [
        { text: `That phone in your pocket.`, dur: 2500, anim: () => {
          _dimAll(); _showDevices(true);
          // Highlight just the phone icon
          const icons = _diagSVG ? _diagSVG.querySelectorAll('.dev-icon') : [];
          icons.forEach((ic, i) => ic.setAttribute('opacity', i === 0 ? '1' : '0.2'));
          _setLabel('', OV_COLORS.green);
        }},
        { text: `The laptop on your desk.`, dur: 2500, anim: () => {
          const icons = _diagSVG ? _diagSVG.querySelectorAll('.dev-icon') : [];
          icons.forEach((ic, i) => ic.setAttribute('opacity', i === 1 ? '1' : '0.2'));
        }},
        { text: `The console you play FIFA on.`, dur: 2500, anim: () => {
          const icons = _diagSVG ? _diagSVG.querySelectorAll('.dev-icon') : [];
          icons.forEach((ic, i) => ic.setAttribute('opacity', i === 2 ? '1' : '0.2'));
        }},
        { text: `They all have one thing in common — a tiny chip that runs everything.`, dur: 4500, anim: () => {
          const icons = _diagSVG ? _diagSVG.querySelectorAll('.dev-icon') : [];
          icons.forEach(ic => ic.setAttribute('opacity', '1'));
          _setLabel('They all have a CPU inside', OV_COLORS.green);
        }},
        { text: `It is called a CPU — the Central Processing Unit.`, dur: 3500, anim: () => {
          // Begin transitioning: fade devices, start revealing CPU components
          _showDevices(false);
          _dimAll();
          const keys = Object.keys(CPU_COMPS);
          keys.forEach((k, i) => _after(i * 150, () => { const e = _diagCompEls[k]; if(e) { e.rect.setAttribute('opacity','0.3'); e.lbl.setAttribute('opacity','0.3'); } }));
          _setLabel('CPU — Central Processing Unit', OV_COLORS.green);
        } },
      ]},
      // Page 1
      { sentences: [
        { text: `On the screen you can see the building blocks of one.`, anim: () => { _showDevices(false); _dimAll(); const keys = Object.keys(CPU_COMPS); keys.forEach((k, i) => _after(i * 200, () => { const e = _diagCompEls[k]; if(e) { e.rect.setAttribute('opacity','0.6'); e.lbl.setAttribute('opacity','0.6'); e.glow.setAttribute('opacity','0.3'); } })); _setLabel('11 building blocks — appearing one by one', OV_COLORS.green); } },
        { text: `Each box is a different part, and each line is a connection between them.`, anim: () => { Object.keys(CPU_COMPS).forEach(k => _glowComp(k)); _setBusActive('data', true); _setBusActive('addr', true); _setBusActive('clk', true); _setBusActive('ctrl', true); CPU_WIRES.forEach((w, i) => _lightWire(w.id, true)); _setLabel('Boxes = parts. Lines = connections between them.', OV_COLORS.green); } },
      ]},
      // Page 2
      { sentences: [
        { text: `Watch as each part lights up.`, dur: 5500, anim: () => { _dimAll(); const keys = Object.keys(CPU_COMPS); keys.forEach((k, i) => _after(i * 400, () => _glowComp(k))); _setLabel('Watch each part light up', OV_COLORS.green); } },
        { text: `There are 11 of them.`, dur: 2500, anim: () => { Object.keys(CPU_COMPS).forEach(k => _glowComp(k)); _setLabel('11 building blocks', OV_COLORS.green); } },
        { text: `They look complicated, but each one has a simple job.`, dur: 4500, anim: () => {
          _dimAll();
          // Pulse each component briefly to show it has a role
          const roles = [
            ['CLK','green'],['PC','teal'],['MAR','blue'],['RAM','amber'],
            ['IR','amber'],['CU','red'],['REGA','purple'],['REGB','purple'],
            ['ALU','orange'],['FLAGS','amber'],['OUT','green']
          ];
          roles.forEach(([k, c], i) => {
            _after(i * 350, () => { _fireComp(k, OV_COLORS[c]); });
            _after(i * 350 + 250, () => { _glowComp(k); });
          });
        } },
      ]},
      // Page 3 — Fetch, decode, execute — animated on the diagram
      { sentences: [
        { text: `Together, they only do three things: fetch a command —`, dur: 5500, anim: () => {
          _dimAll();
          // FETCH: Full system — every bus-connected component visible
          _glowComp('CLK'); _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('IR'); _glowComp('CU');
          _glowComp('REGA'); _glowComp('REGB'); _glowComp('OUT');
          // PC=0 → binary 00000000 shown in PC cells, address bus active
          _showCompVal('PC', '0');
          // T0: CO+MI → PC fires address 0 → MAR captures 0 → RAM row 0 lights
          _cuFiresSignals(['CO', 'MI']);
          _clockPulse(false);
          _fireComp('PC', OV_COLORS.teal); _setBusActive('addr', true);
          _after(300, () => { _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0); });
          _after(600, () => {
            _receiveComp('MAR', OV_COLORS.blue);
            _showCompVal('MAR', '0');  // auto: binary 00000000 in MAR cells + RAM row 0 lights
          });
          // T1: RO+II+CE → RAM[0] fires LDA opcode (0x01=1) → ALL doors → IR captures
          _after(1000, () => {
            _cuFiresSignals(['RO', 'II', 'CE']);
            _clockPulse(false);
            _busWrite('RAM', 'w-ram-db', 1, OV_COLORS.amber); // LDA opcode = 1
          });
          _after(1400, () => { _busWaitingAtDoors(1, 'IR'); });
          _after(1800, () => {
            _removeWaitingData();
            _receiveComp('IR', OV_COLORS.amber);
            _showCompVal('IR', 'LDA');
            // PC increments: 0→1. Binary cells change: 00000000 → 00000001
            _showCompVal('PC', '1');
            _flashCells('PC', OV_COLORS.teal);
          });
          _setLabel('FETCH — PC=0 → MAR=0 → RAM[0] → all doors → IR captures → PC→1', OV_COLORS.teal);
        }},
        { text: `figure out what it means —`, dur: 3500, anim: () => {
          // DECODE: IR holds opcode 0x01 (LDA). CU reads it.
          _dimAll();
          _glowComp('IR'); _glowComp('CU'); _glowComp('CLK');
          _glowComp('PC'); _showCompVal('PC', '1');
          _showCompVal('IR', 'LDA');
          _fireComp('IR', OV_COLORS.amber);
          _spawnPacket('w-ir-cu', OV_COLORS.red, true, 0);
          _after(400, () => { _receiveComp('CU', OV_COLORS.red); _showCompVal('CU', 'LDA'); });
          _after(800, () => { _cuFiresSignals(['IO', 'MI', 'RO', 'AI']); });
          _setLabel('DECODE — IR=00000001=LDA. CU reads opcode, fires signals.', OV_COLORS.red);
        }},
        { text: `and do it.`, dur: 5500, anim: () => {
          // EXECUTE LDA: T2 IO+MI (address to MAR), T3 RO+AI (RAM data to REGA)
          _dimAll();
          _glowComp('CU'); _glowComp('IR'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('CLK');
          _glowComp('REGA'); _glowComp('REGB'); _glowComp('OUT'); // bus-connected
          _showCompVal('IR', 'LDA'); _showCompVal('PC', '2');
          // T2: IO+MI → IR operand (address 5) goes to MAR via address bus
          _cuFiresSignals(['IO', 'MI']);
          _fireComp('IR', OV_COLORS.amber);
          _setBusActive('addr', true);
          _spawnPacket('w-ir-db', OV_COLORS.blue, false, 0);
          _after(400, () => { _receiveComp('MAR', OV_COLORS.blue); _showCompVal('MAR', '5'); });
          // T3: RO+AI → RAM[5] fires 42 onto data bus → ALL doors → REGA captures
          _after(800, () => {
            _cuFiresSignals(['RO', 'AI']);
            _clockPulse(false);
            _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          });
          _after(1200, () => { _busWaitingAtDoors(42, 'REGA'); });
          // Clock beats → only REGA latches
          _after(1600, () => { _clockPulse(false); });
          _after(1900, () => {
            _removeWaitingData();
            _receiveComp('REGA', OV_COLORS.green); _showCompVal('REGA', '42');
          });
          _setLabel('EXECUTE LDA — MAR=5 → RAM[5]=42 → all doors → A captures', OV_COLORS.orange);
        }},
        { text: `That is all a CPU does. Over and over. Billions of times per second.`, dur: 7000, anim: () => {
          // LOOPING fetch→decode→execute cycle that visibly REPEATS
          // PC counts up each cycle: 0, 1, 2, 3... MAR matches. RAM row lights up.
          _setLabel('FETCH → DECODE → EXECUTE — watch it repeat', OV_COLORS.teal);
          let _cyclePC = 0;
          function _runOneCycle() {
            _clearSentenceTimers();
            _clearPackets();
            const addr = _cyclePC & 7; // wrap at 8 for visible RAM rows
            // ── FETCH T0 (0–400ms): CO+MI → PC fires address → MAR captures ──
            _dimAll();
            _glowComp('CLK'); _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('IR'); _glowComp('CU');
            _glowComp('REGA'); _glowComp('REGB'); _glowComp('OUT');
            _showCompVal('PC', '' + _cyclePC);  // auto: binary cells + hardwired links
            _cuFiresSignals(['CO', 'MI']);
            _fireComp('PC', OV_COLORS.teal); _setBusActive('addr', true);
            _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0);
            _setLabel('FETCH  PC=' + _cyclePC, OV_COLORS.teal);
            _after(300, () => { _receiveComp('MAR', OV_COLORS.blue); _showCompVal('MAR', '' + _cyclePC); });
            // ── FETCH T1 (400–800ms): RO+II+CE → RAM fires to ALL doors → IR captures → PC++ ──
            _after(400, () => {
              _cuFiresSignals(['RO', 'II', 'CE']); _setBusActive('data', true);
              _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
            });
            _after(700, () => { _receiveComp('IR', OV_COLORS.amber); _cyclePC++; _showCompVal('PC', '' + _cyclePC); });
            // ── DECODE (800–1100ms): IR→CU ──
            _after(800, () => { _dimAll(); _glowComp('IR'); _glowComp('CU'); _glowComp('PC'); _showCompVal('PC', '' + _cyclePC); _fireComp('IR', OV_COLORS.amber); _spawnPacket('w-ir-cu', OV_COLORS.red, false, 0); _setLabel('DECODE  PC=' + _cyclePC, OV_COLORS.red); });
            _after(1000, () => { _receiveComp('CU', OV_COLORS.red); _cuFiresSignals(['EO', 'AI']); });
            // ── EXECUTE (1100–1900ms): ALU→bus→ALL doors→REGA captures ──
            _after(1100, () => {
              _dimAll();
              _glowComp('CU'); _glowComp('ALU'); _glowComp('REGA'); _glowComp('REGB'); _glowComp('IR'); _glowComp('RAM'); _glowComp('OUT'); _glowComp('PC');
              _showCompVal('PC', '' + _cyclePC);
              _cuFiresSignals(['EO', 'AI']);
              _busWrite('ALU', 'w-alu-bus', 8, OV_COLORS.orange);
              _setLabel('EXECUTE  PC=' + _cyclePC, OV_COLORS.orange);
            });
            _after(1500, () => { _busWaitingAtDoors(8, 'REGA'); });
            _after(1800, () => { _removeWaitingData(); _receiveComp('REGA', OV_COLORS.green); _showCompVal('REGA', '8'); });
            // ── RESTART ──
            _after(2200, () => _runOneCycle());
          }
          _runOneCycle();
        }},
      ]},
      // Page 4 — Intro to buses
      { sentences: [
        { text: `Three buses connect everything. Let us see each one.`, anim: () => {
          _dimAll(); Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          // Flash each bus type briefly
          _after(200, () => _setBusActive('data', true));
          _after(600, () => _setBusActive('addr', true));
          _after(1000, () => _setBusActive('clk', true));
          _setLabel('THREE BUSES', OV_COLORS.teal);
        }},
      ]},
      // Page 5 — Data bus — GLOW + BLINK
      { sentences: [
        { text: `The data bus — the amber lines. Watch them glow.`, dur: 5000, anim: () => {
          _dimAll();
          // Show what the data bus connects
          _glowComp('RAM'); _glowComp('REGA'); _glowComp('REGB'); _glowComp('IR'); _glowComp('ALU'); _glowComp('OUT');
          _setBusActive('data', true);
          // Blink the data bus
          let blinkOn = true;
          const blinkTimer = setInterval(() => {
            _setBusActive('data', blinkOn);
            blinkOn = !blinkOn;
          }, 500);
          _sceneTimers.push(blinkTimer);
          // Continuous pulses showing bus reaches every component (correct direction: bus → each)
          _spawnPacket('w-ram-db', OV_COLORS.amber, true, 0, true);     // reverse: bus→RAM
          _spawnPacket('w-bus-rega', OV_COLORS.amber, true, 0.3);       // bus→REGA: correct
          _spawnPacket('w-bus-regb', OV_COLORS.amber, true, 0.4);       // bus→REGB: correct
          _spawnPacket('w-ir-db', OV_COLORS.amber, true, 0.5, true);    // reverse: bus→IR
          _spawnPacket('w-out', OV_COLORS.amber, true, 0.6);            // bus→OUT: correct
          _spawnPacket('w-alu-bus', OV_COLORS.amber, true, 0.7, true);  // reverse: bus→ALU
          _setLabel('DATA BUS — pulses flow to ALL connected components', OV_COLORS.amber);
        }},
      ]},
      // Page 6 — Address bus — GLOW + BLINK
      { sentences: [
        { text: `The address bus — the blue lines. Watch them glow.`, dur: 5000, anim: () => {
          _dimAll();
          // Show what the address bus connects
          _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM');
          _setBusActive('data', true);  // keep data visible
          _setBusActive('addr', true);
          // Blink the address bus
          let blinkOn = true;
          const blinkTimer = setInterval(() => {
            _setBusActive('addr', blinkOn);
            blinkOn = !blinkOn;
          }, 500);
          _sceneTimers.push(blinkTimer);
          // Full address path: PC → MAR → RAM
          _spawnPacket('w-pc-mar', OV_COLORS.blue, true, 0);
          _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0.3);
          _setLabel('ADDRESS BUS — pulses flow PC → MAR → RAM', OV_COLORS.blue);
        }},
      ]},
      // Page 7 — Clock line — GLOW + BLINK
      { sentences: [
        { text: `The clock line — the green dashed line at the top. Watch it glow.`, dur: 5000, anim: () => {
          _dimAll();
          // Show clock source and receivers
          _glowComp('CLK'); _glowComp('PC'); _glowComp('CU'); _glowComp('RAM'); _glowComp('IR');
          _setBusActive('data', true);
          _setBusActive('addr', true);
          _setBusActive('clk', true);
          // Blink the clock line
          let blinkOn = true;
          const blinkTimer = setInterval(() => {
            _setBusActive('clk', blinkOn);
            blinkOn = !blinkOn;
          }, 500);
          _sceneTimers.push(blinkTimer);
          ['w-clk-h', 'w-clk-pc', 'w-clk-cu', 'w-clk-ram', 'w-clk-ir'].forEach((id, i) =>
            _spawnPacket(id, OV_COLORS.green, true, i * 0.15)
          );
          _setLabel('CLOCK — green dashed line. The heartbeat.', OV_COLORS.green);
        }},
      ]},
      // Page 8 — Control bus — GLOW + BLINK
      { sentences: [
        { text: `The control bus — the red lines from the Control Unit. Watch them glow. These carry the orders.`, dur: 6000, anim: () => {
          _dimAll();
          // Keep all three previous buses visible
          _setBusActive('data', true); _setBusActive('addr', true); _setBusActive('clk', true);
          _setBusActive('ctrl', true);
          _fireComp('CU', OV_COLORS.red);
          // Show ALL target components that receive control signals
          _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('IR'); _glowComp('REGA'); _glowComp('REGB'); _glowComp('ALU'); _glowComp('OUT');
          // Light up each signal line one by one, then blink the bus
          const sigs = ['CO','CE','J','MI','RO','RI','II','IO','AI','AO','BI','EO','SU','FI','OI','HLT'];
          sigs.forEach((s, i) => _after(i * 120, () => _lightCtrlSignal(s, true)));
          // After all signals shown, blink the bus
          _after(sigs.length * 120 + 200, () => {
            let blinkOn = true;
            const blinkTimer = setInterval(() => {
              _setBusActive('ctrl', blinkOn);
              blinkOn = !blinkOn;
            }, 500);
            _sceneTimers.push(blinkTimer);
          });
          _setLabel('CONTROL BUS — 16 signal lines. CU sends orders to every component.', OV_COLORS.red);
        }},
      ]},
    ],
    highlightComponents: [],
    showAll: true,
  },
  {
    id: 2,
    title: 'The Heartbeat',
    pages: [
      // Page 0
      { sentences: [
        { text: `Before anything can happen, the CPU needs a heartbeat — something that says go at regular intervals.`, anim: () => { _dimAll(); _glowComp('CLK'); _fireComp('CLK', OV_COLORS.green); _setBusActive('clk', true); _spawnPacket('w-clk-h', OV_COLORS.green, true, 0); } },
        { text: `That is the Clock.`, dur: 2500, anim: () => { _fireComp('CLK', OV_COLORS.green); _setBusActive('clk', true); _clockPulse(true); } },
        { text: `See it at the top left?`, dur: 2500, anim: () => { _fireComp('CLK', OV_COLORS.green); _setBusActive('clk', true); _clockPulse(true); _setLabel('← CLOCK', OV_COLORS.green); } },
      ]},
      // Page 1 — What is a register (beginner-friendly)
      { sentences: [
        { text: `Before we go further — most parts on this board are built from the same basic thing. It is called a register.`, dur: 4000, anim: () => {
          _dimAll();
          // Only fire the parts that ARE registers — not CLK, ALU, or CU
          _fireComp('PC', OV_COLORS.teal); _fireComp('MAR', OV_COLORS.blue); _fireComp('IR', OV_COLORS.amber);
          _fireComp('REGA', OV_COLORS.purple); _fireComp('REGB', OV_COLORS.purple); _fireComp('OUT', OV_COLORS.green);
          // Leave non-registers dim
          _dimComp('CLK'); _dimComp('ALU'); _dimComp('CU');
          _setLabel('These are all registers. What is a register?', OV_COLORS.green);
        }},
        { text: `A register is a tiny box that stores an electric charge — either a 0 or a 1. Once it stores a value, it keeps it forever, as long as there is electricity.`, dur: 5000, anim: () => {
          _dimAll();
          _fireComp('REGA', OV_COLORS.purple);
          _showCompVal('REGA', '5');
          _setLabel('Register = tiny box. Stores 0 or 1. Keeps it forever.', OV_COLORS.purple);
        }},
        { text: `But it is clever. It does not let data in unless you knock on its input side. And it does not let data out unless you knock on its output side.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('CU');
          _fireComp('REGA', OV_COLORS.purple);
          _showCompVal('REGA', '5');
          _setBusActive('data', true);
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _placeWaitingData('REGA', '42', '#332200');
          _setLabel('Data at the door — but no knock, no entry.', OV_COLORS.red);
        }},
        { text: `If you want to store data but forget to knock on the input side — it ignores you. If you want data out but forget to knock on the output side — it stays silent.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('CU');
          _fireComp('REGA', OV_COLORS.purple);
          _showCompVal('REGA', '5');
          _setBusActive('data', true);
          _placeWaitingData('REGA', '42', '#332200');
          _dimAllCtrlSignals();
          _setLabel('No knock = no action. Data ignored. Register silent.', OV_COLORS.red);
        }},
        { text: `Those knocks — that is exactly what the CU signals are. Each signal is a knock on a specific door of a specific register.`, dur: 4500, anim: () => {
          _dimAll();
          _fireComp('CU', OV_COLORS.red); _fireComp('REGA', OV_COLORS.purple);
          _glowComp('RAM'); _glowComp('MAR'); _showCompVal('MAR', '0');
          _cuFiresSignals(['RO', 'AI']);
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _placeWaitingData('REGA', '42', OV_COLORS.green);
          _after(800, () => { _clockPulse(false); });
          _after(1100, () => { _removeWaitingData(); _receiveComp('REGA', OV_COLORS.purple); _showCompVal('REGA', '42'); });
          _setLabel('CU knocks RO (RAM out) + AI (A in) → 42 flows in.', OV_COLORS.green);
        }},
        { text: `MAR, IR, Register A, Register B, the Output display — they are all registers. Tiny boxes with two doors. The CU decides which doors to knock on and when.`, anim: () => {
          _dimAll(); _fireComp('CU', OV_COLORS.red);
          _fireComp('MAR', OV_COLORS.blue);
          _fireComp('IR', OV_COLORS.amber); _fireComp('REGA', OV_COLORS.purple);
          _fireComp('REGB', OV_COLORS.purple); _fireComp('OUT', OV_COLORS.green);
          _setBusActive('ctrl', true);
          _cuFiresSignals(['MI','RO','II','AI','BI','OI']);
          _setLabel('MAR, IR, A, B, OUT = registers. Two doors. CU knocks.', OV_COLORS.red);
        }},
        { text: `PC is also a register — but unlike the others, it does not hold one number forever. Every time the clock pulses, it automatically adds one to its value. It keeps changing on its own.`, dur: 5500, anim: () => {
          _dimAll(); _fireComp('PC', OV_COLORS.teal); _fireComp('CLK', OV_COLORS.green);
          _setBusActive('clk', true);
          _showCompVal('PC', '0');
          // Each count synced with a visible clock pulse
          _after(600, () => { _fireComp('CLK', OV_COLORS.green); _spawnPacket('w-clk-pc', OV_COLORS.green, false, 0); _showCompVal('PC', '1'); _flashCells('PC', OV_COLORS.teal); });
          _after(1200, () => { _fireComp('CLK', OV_COLORS.green); _spawnPacket('w-clk-pc', OV_COLORS.green, false, 0); _showCompVal('PC', '2'); _flashCells('PC', OV_COLORS.teal); });
          _after(1800, () => { _fireComp('CLK', OV_COLORS.green); _spawnPacket('w-clk-pc', OV_COLORS.green, false, 0); _showCompVal('PC', '3'); _flashCells('PC', OV_COLORS.teal); });
          _after(2400, () => { _fireComp('CLK', OV_COLORS.green); _spawnPacket('w-clk-pc', OV_COLORS.green, false, 0); _showCompVal('PC', '4'); _flashCells('PC', OV_COLORS.teal); });
          _setLabel('Clock pulses → PC counts: 0, 1, 2, 3, 4...', OV_COLORS.teal);
        }},
        { text: `Not everything is a register. The Clock is an oscillator — a circuit that switches ON and OFF by itself, over and over. Nobody tells it to. It just runs.`, dur: 5000, anim: () => {
          _dimAll(); _fireComp('CLK', OV_COLORS.green);
          _setBusActive('clk', true);
          // Visibly blink ON/OFF to show oscillation
          let clkOn = true;
          const clkBlink = setInterval(() => {
            clkOn = !clkOn;
            if (clkOn) { _fireComp('CLK', OV_COLORS.green); _spawnPacket('w-clk-h', OV_COLORS.green, false, 0); }
            else { _dimComp('CLK'); }
          }, 400);
          _sceneTimers.push(clkBlink);
          _setLabel('Clock = ON, OFF, ON, OFF... by itself. Nonstop.', OV_COLORS.green);
        }},
        { text: `The ALU is not a register either. It is a math circuit — logic gates wired together. Two numbers go in one side, one result comes out the other. It does not store anything. It computes instantly.`, dur: 5500, anim: () => {
          _dimAll(); _fireComp('ALU', OV_COLORS.orange);
          _glowComp('REGA'); _glowComp('REGB');
          _showCompVal('REGA', '5'); _showCompVal('REGB', '3');
          _showCompVal('ALU', '5+3=8');
          // Two numbers flowing IN (direct wires), one result flowing OUT (bus)
          _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0);
          _spawnPacket('w-regb-alu', OV_COLORS.orange, true, 0.2);
          _spawnPacket('w-alu-bus', OV_COLORS.orange, true, 0.5);
          _setBusActive('data', true);
          _setLabel('5 and 3 flow IN → ALU computes → 8 flows OUT', OV_COLORS.orange);
        }},
        { text: `The CU is not a register either. It is a lookup table burned into a chip. The instruction number goes in, the matching signals come out. It does not think — it just reads from a fixed table.`, dur: 5500, anim: () => {
          _dimAll(); _fireComp('CU', OV_COLORS.red);
          _glowComp('IR'); _showCompVal('IR', '1');
          // Instruction going IN: pulse from IR → CU
          _spawnPacket('w-ir-cu', OV_COLORS.red, true, 0);
          // Signals coming OUT: CU fires them
          _after(500, () => _cuFiresSignals(['CO','MI','RO','AI']));
          _setLabel('Instruction pulses IN from IR → signals fire OUT to components', OV_COLORS.red);
        }},
        { text: `So the board has three types of parts: registers that store, an ALU that computes, and a CU that looks up which signals to fire. The clock keeps them all in sync.`, anim: () => {
          _dimAll(); _fireComp('CLK', OV_COLORS.green);
          _fireComp('CU', OV_COLORS.red); _fireComp('ALU', OV_COLORS.orange);
          _fireComp('PC', OV_COLORS.teal); _fireComp('MAR', OV_COLORS.blue);
          _fireComp('IR', OV_COLORS.amber); _fireComp('REGA', OV_COLORS.purple);
          _fireComp('REGB', OV_COLORS.purple); _fireComp('OUT', OV_COLORS.green);
          _setBusActive('data', true); _setBusActive('addr', true); _setBusActive('ctrl', true);
          _setLabel('Registers (store) + ALU (compute) + CU (lookup) + Clock (sync)', OV_COLORS.green);
        }},
      ]},
      // Page 2 — CU gives the RO order, RAM obeys
      { sentences: [
        { text: `But data does not move by itself. The Control Unit must give the order first.`, anim: () => {
          _dimAll();
          _glowComp('CU'); _glowComp('RAM'); _glowComp('REGA');
          _glowComp('PC'); _glowComp('MAR');
          // Show PC=0 and MAR=0 — default starting state
          _showCompVal('PC', '0'); _showCompVal('MAR', '0');

          _setLabel('PC=0, MAR=0 — pointing at RAM address 0', OV_COLORS.red);
        }},
        { text: `The CU sends the RO signal to RAM — that means RAM Out, put your value on the bus.`, anim: () => {
          _cuFiresSignals(['RO']);
          _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('CLK');
          _glowComp('REGA'); _glowComp('REGB'); _glowComp('IR'); _glowComp('OUT');
          _showCompVal('PC', '0'); _showCompVal('MAR', '0');
          _showBinaryInRAMRow(0, 42, OV_COLORS.amber);
          _setBusActive('addr', true);
          _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0);
          _after(400, () => {
            _fireComp('RAM', OV_COLORS.amber); _setBusActive('data', true); _showBinaryOnBus(42, 'data');
            _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          });
          _after(1000, () => {
            _placeWaitingData('REGA', '42', OV_COLORS.amber);
            _placeWaitingData('REGB', '42', OV_COLORS.amber);
            _placeWaitingData('IR',   '42', OV_COLORS.amber);
            _placeWaitingData('OUT',  '42', OV_COLORS.amber);
          });
          _setLabel('CU fires RO → RAM outputs 42 → pulses stream to every door', OV_COLORS.red);
        }},
        { text: `RAM obeys. It fires the value 42 from its cells onto the data bus. The value appears at the door of EVERY component connected to the bus — and it stays there as long as RO is active.`, anim: () => {
          _cuFiresSignals(['RO']);
          _glowComp('PC'); _glowComp('MAR'); _glowComp('CLK');
          _showCompVal('PC', '0'); _showCompVal('MAR', '0');
          _showBinaryInRAMRow(0, 42, OV_COLORS.amber);
          _setBusActive('addr', true);
          // THE BUS RULE: RAM fires → pulses stream to ALL doors
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _after(1000, () => _busWaitingAtDoors(42, null));
          _setLabel('42 streams from RAM → bus → every door. Continuous while RO active.', OV_COLORS.amber);
        }},
        { text: `But only the one with its control signal active will capture it. The data stays at every door — the others just do not have permission to latch.`, anim: () => {
          _cuFiresSignals(['RO', 'AI']);
          _glowComp('CLK'); _glowComp('MAR');
          _showCompVal('PC', '0'); _showCompVal('MAR', '0');
          _showBinaryInRAMRow(0, 42, OV_COLORS.amber);
          _setBusActive('addr', true);
          // Same bus rule — RAM still driving, all doors see it
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _busWaitingAtDoors(42, 'REGA');
          // Clock beats → only REGA latches
          _after(1200, () => { _clockPulse(false); });
          _after(1600, () => { _removeWaitingData(); _receiveComp('REGA', OV_COLORS.green); _showCompVal('REGA', '42'); });
          _setLabel('RO+AI active. Data at all doors. Clock beats → only A captures.', OV_COLORS.red);
        }},
      ]},
      // Page 3 — Why this control matters — concrete example
      { sentences: [
        { text: `This control is not optional. Let us see what happens without it. Say we are running the program: load 5 into A, add 3, show the result.`, anim: () => {
          _dimAll();
          Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          _showCompVal('REGA', '5'); _showCompVal('IR', 'ADD'); _showCompVal('PC', '2'); _showCompVal('MAR', '5');

          _showBinaryInRAMRow(0, 0x2E, OV_COLORS.blue);
          // Show the current state: A=5, IR=ADD, RAM has the program, direct wires feeding ALU
          _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0);
          _spawnPacket('w-regb-alu', OV_COLORS.orange, true, 0.2);
          _lightWire('w-ir-cu', true);
          _spawnPacket('w-ir-cu', OV_COLORS.red, true, 0);
          _setBusActive('addr', true); _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0);
          _setLabel('Mid-program: A=5, IR=ADD, MAR=5. ALU inputs streaming.', OV_COLORS.teal);
        }},
      ]},
      // Page 4 — What goes wrong: CU fires ALL signals (wrong!)
      { sentences: [
        { text: `Now RAM outputs the value 3 for the ADD instruction. But imagine the CU fires ALL signals at once — every signal ON.`, anim: () => {
          _dimAll();
          Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          _cuFiresSignals(['CO','CE','J','MI','RO','RI','II','IO','AI','AO','BI','EO','SU','FI','OI','HLT']);
          _showCompVal('REGA', '5'); _showCompVal('IR', 'ADD'); _showCompVal('MAR', '5');
          _showBinaryInRAMRow(0, 3, OV_COLORS.red);
          _fireComp('RAM', OV_COLORS.red);
          _setBusActive('data', true); _setBusActive('addr', true);
          _showBinaryOnBus(3, 'data');
          // RAM outputs — continuous red pulses streaming to ALL components
          _spawnPacket('w-ram-db', OV_COLORS.red, true, 0);
          _spawnPacket('w-bus-rega', OV_COLORS.red, true, 0.2);
          _spawnPacket('w-bus-regb', OV_COLORS.red, true, 0.25);
          _spawnPacket('w-ir-db', OV_COLORS.red, true, 0.3, true);   // reverse: bus→IR
          _spawnPacket('w-out', OV_COLORS.red, true, 0.35);
          _setLabel('ALL 16 signals ON — red pulses streaming to every component!', OV_COLORS.red);
        }},
        { text: `RAM puts 3 on the data bus. The value flows to every component — and because all signals are ON, every component captures it.`, anim: () => {
          _cuFiresSignals(['CO','CE','J','MI','RO','RI','II','IO','AI','AO','BI','EO','SU','FI','OI','HLT']);
          // BUS RULE: RAM fires → all doors see it (in red because ALL signals are ON)
          _busWrite('RAM', 'w-ram-db', 3, OV_COLORS.red);
          // ALL signals ON → ALL doors red (all have permission = chaos)
          ['REGA','REGB','IR','OUT'].forEach(k => _placeWaitingData(k, '3', OV_COLORS.red));
          _after(600, () => _clockPulse(false));
          _after(800, () => {
            _removeWaitingData();
            _receiveComp('REGA', OV_COLORS.red); _showCompVal('REGA', '3');
            _receiveComp('REGB', OV_COLORS.red); _showCompVal('REGB', '3');
            _receiveComp('IR', OV_COLORS.red); _showCompVal('IR', '3'); _flashCells('IR', OV_COLORS.red);
            _receiveComp('OUT', OV_COLORS.red); _showCompVal('OUT', '3');
          });
          _setLabel('Clock beats → ALL capture 3. Every register corrupted.', OV_COLORS.red);
        }},
      ]},
      // Page 5 — Show each corruption one by one
      { sentences: [
        { text: `Register A just lost the value 5. The 3 from RAM overwrote it. Watch the cells change from 00000101 to 00000011.`, anim: () => {
          _dimAll(); _glowComp('REGA');

          _showCompVal('REGA', '5');
          _after(600, () => {

            _showCompVal('REGA', '3');
            _fireComp('REGA', OV_COLORS.red);
          });
          _setLabel('A was 00000101 (5) → now 00000011 (3). The 5 is gone.', OV_COLORS.red);
        }},
        { text: `The IR lost the ADD command. It now holds 00000011 which the CU reads as SUB. The CPU will subtract instead of add.`, anim: () => {
          _dimAll(); _glowComp('IR'); _glowComp('CU');
          _showCompVal('IR', 'ADD');
          _after(600, () => {
            _showCompVal('IR', '0011=SUB');

            _fireComp('IR', OV_COLORS.red);
            // Show the corrupted opcode flowing to CU
            _lightWire('w-ir-cu', true);
            _spawnPacket('w-ir-cu', OV_COLORS.red, false, 0);
            _after(500, () => { _receiveComp('CU', OV_COLORS.red); _showCompVal('CU', 'SUB??'); });
          });
          _setLabel('IR: ADD → 0011 = SUB. Wrong opcode flows to CU.', OV_COLORS.red);
        }},
        { text: `The Output shows 3 before the computation even finished. It displayed a raw memory value, not a result.`, anim: () => {
          _dimAll(); _glowComp('OUT'); _glowComp('RAM');
          _fireComp('OUT', OV_COLORS.red);
          _showCompVal('OUT', '3');
          _setBusActive('data', true); _showBinaryOnBus(3, 'data');
          _spawnPacket('w-out', OV_COLORS.red, true, 0);
          _spawnPacket('w-ram-db', OV_COLORS.red, true, 0.2);
          _setLabel('Output captured raw RAM value 3 — not the computed result.', OV_COLORS.red);
        }},
      ]},
      // Page 6 — The cascade
      { sentences: [
        { text: `Now the CPU continues with corrupted data. The CU sees SUB in the IR, so it fires EO, AI, SU — subtract mode.`, anim: () => {
          _dimAll();
          _cuFiresSignals(['EO', 'AI', 'SU']);
          _glowComp('REGA'); _glowComp('REGB'); _glowComp('ALU'); _glowComp('IR'); _glowComp('CLK');
          _glowComp('OUT'); _glowComp('RAM'); // bus-connected: will see result at door
          _showCompVal('IR', 'SUB'); _showCompVal('REGA', '3'); _showCompVal('REGB', '3');

          // Direct wires feeding corrupted values into ALU
          _spawnPacket('w-rega-alu', OV_COLORS.red, true, 0);
          _spawnPacket('w-regb-alu', OV_COLORS.red, true, 0.2);
          _lightWire('w-ir-cu', true); _spawnPacket('w-ir-cu', OV_COLORS.red, true, 0);
          _setLabel('CU reads SUB → EO|AI|SU. Corrupted A=3, B=3 stream into ALU.', OV_COLORS.red);
        }},
        { text: `The ALU subtracts: 3 minus 3 equals 0. The result flows back to Register A.`, anim: () => {
          _cuFiresSignals(['EO', 'AI', 'SU']);
          _glowComp('REGA'); _glowComp('REGB'); _glowComp('ALU'); _glowComp('CLK');
          _glowComp('IR'); _glowComp('OUT'); _glowComp('RAM');
          _showCompVal('REGA', '3'); _showCompVal('REGB', '3');
          _spawnPacket('w-rega-alu', OV_COLORS.red, true, 0);
          _spawnPacket('w-regb-alu', OV_COLORS.red, true, 0.2);
          _fireComp('ALU', OV_COLORS.red);
          _showCompVal('ALU', '3-3=0');
          _setBusActive('data', true); _showBinaryOnBus(0, 'data');
          // Result 0 pulses to ALL bus doors
          // BUS RULE: ALU fires → all doors see 0
          _busWrite('ALU', 'w-alu-bus', 0, OV_COLORS.red);
          _after(400, () => _busWaitingAtDoors(0, 'REGA'));
          _after(800, () => { _clockPulse(false); });
          _after(1000, () => {
            _removeWaitingData();
            _receiveComp('REGA', OV_COLORS.red); _showCompVal('REGA', '0');
          });
          _setLabel('ALU: 3-3=0. Result at ALL doors. Clock → A latches 0. Wrong.', OV_COLORS.red);
        }},
        { text: `We wanted 5 plus 3 equals 8. We got 0. One wrong set of control signals and the entire program is destroyed.`, anim: () => {
          Object.keys(CPU_COMPS).forEach(k => _fireComp(k, OV_COLORS.red));
          _showCompVal('REGA', '0'); _showCompVal('OUT', '0');
          _setLabel('Expected: 8. Got: 0. Entire program corrupted.', OV_COLORS.red);
        }},
        { text: `In a calculator, you get 0 instead of 8. In a bank, $500 becomes $0 — the transfer vanishes. In a medical pump, the dosage is zero — the patient gets no medicine. In an aircraft, the altitude reads 0 — the autopilot thinks it is on the ground.`, anim: () => {
          _setLabel('$500→$0. Dosage→0. Altitude→0. One wrong signal.', OV_COLORS.red);
        }},
      ]},
      // Page 7 — With control restored — show the flow properly
      { sentences: [
        { text: `Now with proper control. The CU fires only RO and BI — two signals out of sixteen.`, anim: () => {
          _dimAll();
          Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          _cuFiresSignals(['RO', 'BI']);
          _showCompVal('REGA', '5'); _showCompVal('IR', 'ADD'); _showCompVal('MAR', '5');

          _fireComp('RAM', OV_COLORS.amber);
          _setBusActive('data', true); _setBusActive('addr', true);
          _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0);
          _spawnPacket('w-ram-db', OV_COLORS.amber, true, 0);
          _setLabel('CU fires RO+BI only. MAR=5, RAM outputs. 14 signals OFF.', OV_COLORS.green);
        }},
        { text: `RAM puts 3 on the bus. The value flows to every door — but only Register B has permission to capture.`, anim: () => {
          _cuFiresSignals(['RO', 'BI']);
          _glowComp('CLK'); _glowComp('MAR');
          _showCompVal('REGA', '5'); _showCompVal('IR', 'ADD'); _showCompVal('MAR', '5');
          _showBinaryInRAMRow(0, 3, OV_COLORS.amber);
          _setBusActive('addr', true);
          // BUS RULE: RAM fires → all doors see 3
          _busWrite('RAM', 'w-ram-db', 3, OV_COLORS.amber);
          _after(600, () => _busWaitingAtDoors(3, 'REGB'));
          _after(1200, () => { _clockPulse(false); });
          _after(1500, () => {
            _removeWaitingData();
            _receiveComp('REGB', OV_COLORS.green); _showCompVal('REGB', '3');
          });
          _setLabel('3 at every door. Clock beats → only B captures (BI). A keeps 5.', OV_COLORS.green);
        }},
        { text: `The ALU computes 5 plus 3 equals 8. The correct answer. CU fires EO and AI — the result flows to Register A.`, anim: () => {
          _dimAll();
          _cuFiresSignals(['EO', 'AI', 'FI']);
          _glowComp('FLAGS'); _glowComp('CLK');
          _showCompVal('REGA', '5'); _showCompVal('REGB', '3');

          // Direct wires feeding ALU
          _spawnPacket('w-rega-alu', OV_COLORS.green, true, 0);
          _spawnPacket('w-regb-alu', OV_COLORS.green, true, 0.15);
          _showCompVal('ALU', '5+3=8');
          // BUS RULE: ALU fires → all doors see 8
          _busWrite('ALU', 'w-alu-bus', 8, OV_COLORS.green);
          _after(400, () => { _busWaitingAtDoors(8, 'REGA'); _spawnPacket('w-alu-flags', OV_COLORS.amber, true, 0); });
          _after(800, () => { _clockPulse(false); });
          _after(1100, () => {
            _removeWaitingData();
            _receiveComp('REGA', OV_COLORS.green); _showCompVal('REGA', '8');
            _receiveComp('FLAGS', OV_COLORS.amber);
          });
          _setLabel('ALU: 8 at all doors. Clock → A captures. 5+3=8. ✓', OV_COLORS.green);
        }},
      ]},
      // Page 7 — The responsibility of the designer
      { sentences: [
        { text: `This is why designing the control program — the recipe table inside the CU — is the most critical part of building a CPU.`, anim: () => {
          _dimAll(); _glowComp('CU'); _fireComp('CU', OV_COLORS.red);
          _flashCells('CU', OV_COLORS.red);
          _setLabel('The CU recipe table = the most critical part of the CPU', OV_COLORS.red);
        }},
        { text: `If you write the wrong signal for one step — say you accidentally turn on AI when you meant BI — Register A gets overwritten when it should not. The program silently produces the wrong answer.`, anim: () => {
          _dimAll();
          _cuFiresSignals(['RO', 'AI']);
          _glowComp('RAM'); _glowComp('REGA'); _glowComp('REGB'); _glowComp('IR'); _glowComp('OUT'); _glowComp('MAR');
          _showCompVal('MAR', '5'); _showCompVal('REGA', '5');
          _fireComp('RAM', OV_COLORS.amber);
          _setBusActive('data', true); _showBinaryOnBus(3, 'data');
          // BUS RULE: RAM fires → all doors see 3 (REGA red = wrong target!)
          _busWrite('RAM', 'w-ram-db', 3, OV_COLORS.red);
          _busWaitingAtDoors(3, 'REGA');
          _after(800, () => { _clockPulse(false); });
          _after(1100, () => { _removeWaitingData(); _receiveComp('REGA', OV_COLORS.red); _showCompVal('REGA', '3'); });
          _setLabel('AI instead of BI → A overwritten with 3. The 5 is gone.', OV_COLORS.red);
        }},
        { text: `No error message. No crash. Just wrong data flowing through the system — and every computation after that is based on a lie.`, anim: () => {
          Object.keys(CPU_COMPS).forEach(k => _fireComp(k, OV_COLORS.red));
          _showCompVal('REGA', '3'); _showCompVal('REGB', '3'); _showCompVal('ALU', '3-3=0'); _showCompVal('OUT', '0');
          _setBusActive('data', true);
          // Wrong data pulsing through the entire system
          _spawnPacket('w-rega-alu', OV_COLORS.red, true, 0);
          _spawnPacket('w-regb-alu', OV_COLORS.red, true, 0.1);
          _spawnPacket('w-alu-bus', OV_COLORS.red, true, 0.3);
          _spawnPacket('w-bus-rega', OV_COLORS.red, true, 0.5);
          _spawnPacket('w-ir-cu', OV_COLORS.red, true, 0.2);
          _setLabel('Wrong data pulses through everything. No warning. No crash.', OV_COLORS.red);
        }},
        { text: `And the worst part — the CPU will not tell you something is wrong. It will just keep running with the wrong data as if everything is fine.`, anim: () => {
          _dimAll(); _glowComp('CU');
          _showCompVal('OUT', '0');
          _flashCells('CU', OV_COLORS.red);
          _setLabel('The CPU does not know it is wrong. It just follows the recipe it was given.', OV_COLORS.red);
        }},
        { text: `It gets worse. If the CU accidentally turns on two output signals on the same bus at the same time — say RO and AO together — both RAM and Register A try to push different values onto the same wires.`, anim: () => {
          _dimAll();
          _cuFiresSignals(['RO', 'AO']);
          _glowComp('RAM'); _glowComp('REGA'); _glowComp('REGB'); _glowComp('IR'); _glowComp('OUT');
          _fireComp('RAM', OV_COLORS.red);
          _fireComp('REGA', OV_COLORS.red);
          _showCompVal('RAM', '42'); _showCompVal('REGA', '5');
          _setBusActive('data', true);
          const dataBusEls = _diagBusEls['data'] || [];
          dataBusEls.forEach(el => { el.setAttribute('stroke', OV_COLORS.red); el.setAttribute('stroke-width', '6'); });
          // TWO sources pulsing into bus simultaneously — collision
          _spawnPacket('w-ram-db', OV_COLORS.red, true, 0);
          _spawnPacket('w-rega-out', OV_COLORS.red, true, 0.2);
          _setLabel('RO+AO → RAM pushes 42, REG A pushes 5 — both on same wires!', OV_COLORS.red);
        }},
        { text: `One pushes a 1, the other pushes a 0, on the same wire. That creates a fight — excessive current flows between the two components.`, anim: () => {
          _fireComp('RAM', OV_COLORS.red); _fireComp('REGA', OV_COLORS.red);
          _showBinaryOnBus(0xFF, 'data');
          // Both sources still pulsing — continuous collision
          _spawnPacket('w-ram-db', OV_COLORS.red, true, 0);
          _spawnPacket('w-rega-out', '#ff8800', true, 0.15);
          const dataBusEls = _diagBusEls['data'] || [];
          let flash = true;
          const flashTimer = setInterval(() => {
            dataBusEls.forEach(el => { el.setAttribute('stroke', flash ? OV_COLORS.red : '#ff8800'); });
            flash = !flash;
          }, 200);
          _sceneTimers.push(flashTimer);
          _setLabel('Two drivers fighting — pulses collide — excessive current', OV_COLORS.red);
        }},
        { text: `In real hardware, this is not just bad data — it is physical damage. The output transistors overheat. The chip can burn out. The CPU is destroyed.`, anim: () => {
          Object.keys(CPU_COMPS).forEach(k => _fireComp(k, OV_COLORS.red));
          _setBusActive('data', true); _setBusActive('addr', true);
          const allBusEls = [...(_diagBusEls['data'] || []), ...(_diagBusEls['addr'] || [])];
          allBusEls.forEach(el => { el.setAttribute('stroke', OV_COLORS.red); el.setAttribute('stroke-width', '6'); });
          // Both sources still fighting — frantic pulses showing destruction
          _spawnPacket('w-ram-db', OV_COLORS.red, true, 0);
          _spawnPacket('w-rega-out', '#ff8800', true, 0.1);
          _spawnPacket('w-alu-bus', OV_COLORS.red, true, 0.2);
          _spawnPacket('w-bus-rega', '#ff8800', true, 0.3);
          _setLabel('Physical damage — transistors overheat — chip burns out', OV_COLORS.red);
        }},
        { text: `So a wrong control signal does not just give you a wrong answer. It can destroy the hardware permanently.`, anim: () => {
          _dimAll(); _glowComp('CU'); _fireComp('CU', OV_COLORS.red);
          _setLabel('Wrong signal = wrong answer OR destroyed hardware. Both are permanent.', OV_COLORS.red);
        }},
        { text: `That is why designing the control program demands precision. Every signal, every step, every command must be exact. There is no room for error.`, anim: () => {
          _dimAll();
          _cuFiresSignals(['RO', 'BI']);
          _showBinaryOnBus(3, 'data');
          _receiveComp('REGB', OV_COLORS.green);
          _showCompVal('REGA', '5'); _showCompVal('REGB', '3');
          _setLabel('Every signal. Every step. Every command. Exact. No exceptions.', OV_COLORS.green);
        }},
      ]},
      // Page 4 — CU gives the AI order, but clock must beat
      { sentences: [
        { text: `Now the CU sends the AI signal to Register A — that means A In, capture the value from the bus.`, anim: () => {
          _dimAll();
          // Full system: CU fires RO+AI, RAM drives bus, data at all doors
          _cuFiresSignals(['RO', 'AI']);
          _glowComp('RAM'); _glowComp('MAR'); _glowComp('REGA'); _glowComp('REGB'); _glowComp('IR'); _glowComp('OUT'); _glowComp('CLK');
          _showCompVal('MAR', '0'); _showCompVal('REGA', '---');
          _fireComp('RAM', OV_COLORS.amber);
          _setBusActive('data', true); _setBusActive('addr', true);
          _showBinaryOnBus(42, 'data');
          // Continuous pulses streaming from RAM to all doors
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0);
          _after(600, () => {
            _placeWaitingData('REGA', '42', OV_COLORS.green);
            _placeWaitingData('REGB', '42', '#332200');
            _placeWaitingData('IR',   '42', '#332200');
            _placeWaitingData('OUT',  '42', '#332200');
          });
          _setLabel('RO+AI active. RAM drives bus. 42 streams to all doors.', OV_COLORS.red);
        }},
        { text: `The data is on the bus. The AI signal is active. But Register A has not captured yet. Why?`, anim: () => {
          // Full system visible — data streaming, signals active, but clock OFF
          _cuFiresSignals(['RO', 'AI']);
          _glowComp('RAM'); _glowComp('REGA'); _glowComp('REGB'); _glowComp('IR'); _glowComp('OUT'); _glowComp('MAR');
          _fireComp('RAM', OV_COLORS.amber);
          _showBinaryOnBus(42, 'data'); _setBusActive('data', true);
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _placeWaitingData('REGA', '42', OV_COLORS.green);
          _placeWaitingData('REGB', '42', '#332200');
          _placeWaitingData('IR',   '42', '#332200');
          _placeWaitingData('OUT',  '42', '#332200');
          // Clock visibly OFF — dark, no pulses
          _dimComp('CLK');
          const clkE = _diagCompEls['CLK']; if(clkE) { clkE.glow.setAttribute('opacity','0'); clkE.rect.setAttribute('opacity','0.15'); }
          _setBusActive('clk', false);
          _setLabel('Data ✓  AI signal ✓  Clock ✗ — data at door but cannot enter', OV_COLORS.red);
        }},
        { text: `Because the clock has not beaten yet. The door stays shut.`, anim: () => {
          // Show everything ready EXCEPT clock — data on bus, AI on, but CLK dark
          _glowComp('RAM'); _glowComp('REGA'); _glowComp('CU');
          _cuFiresSignals(['RO', 'AI']);
          _setBusActive('data', true); _showBinaryOnBus(42, 'data');
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _placeWaitingData('REGA', '42', OV_COLORS.amber);
          // Clock visibly OFF — dim and labeled LOW
          _dimComp('CLK'); _showCompVal('CLK', 'LOW');
          _setBusActive('clk', false);
          _setLabel('Data streaming ✓  AI signal ✓  Clock LOW ✗ — door shut', OV_COLORS.red);
        }},
      ]},
      // Page 4 — Clock beats, data enters
      { sentences: [
        { text: `Now the clock beats.`, anim: () => {
          // Full system visible — all three conditions met simultaneously
          _cuFiresSignals(['RO', 'AI']);
          _glowComp('RAM'); _glowComp('REGA'); _glowComp('REGB'); _glowComp('IR'); _glowComp('OUT'); _glowComp('MAR');
          _fireComp('RAM', OV_COLORS.amber);
          _showCompVal('MAR', '0');
          _setBusActive('data', true); _showBinaryOnBus(42, 'data');
          // Data still streaming from RAM to all doors
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _placeWaitingData('REGA', '42', OV_COLORS.green);
          _placeWaitingData('REGB', '42', '#332200');
          _placeWaitingData('IR',   '42', '#332200');
          _placeWaitingData('OUT',  '42', '#332200');
          // Clock fires!
          _clockPulse(false);
          _setLabel('CLK beats! Data ✓  RO+AI ✓  Clock ✓ — ALL THREE MET!', OV_COLORS.green);
        }},
        { text: `Register A captures the data. Watch the cells — the ones storing a 1 glow, the ones storing a 0 stay dim.`, anim: () => {
          _cuFiresSignals(['RO', 'AI']);
          _glowComp('RAM'); _glowComp('REGA'); _glowComp('MAR'); _glowComp('CLK');
          _fireComp('RAM', OV_COLORS.amber);
          _setBusActive('data', true); _showBinaryOnBus(42, 'data');
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.green);
          _removeWaitingData();
          _clockPulse(false);
          // A latches — cells show binary pattern
          _receiveComp('REGA', OV_COLORS.green);

          _showCompVal('REGA', '42');
          _setLabel('42 = 00101010 — bright cells = 1, dim cells = 0', OV_COLORS.green);
        }},
        { text: `That is the complete chain: CU gives the order, RAM puts data on the bus, the clock beats, and Register A captures.`, anim: () => {
          _cuFiresSignals(['RO', 'AI']);
          _glowComp('RAM'); _glowComp('REGA'); _glowComp('MAR');
          _fireComp('RAM', OV_COLORS.amber);
          _setBusActive('data', true); _showBinaryOnBus(42, 'data');
          // Full chain with continuous directional pulses
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _clockPulse(true);
          _showCompVal('REGA', '42');
          _setLabel('CU orders → RAM streams → bus carries → clock beats → A latches', OV_COLORS.teal);
        }},
      ]},
      // Page 5 — The three conditions summary
      { sentences: [
        { text: `This pattern repeats everywhere in the CPU. Nothing moves without three things happening at the same time.`, anim: () => {
          _dimAll();
          _glowComp('RAM'); _glowComp('REGA'); _glowComp('CLK'); _glowComp('CU'); _glowComp('MAR');
          _showCompVal('REGA', '---');
          // Quick flash of the full chain to preview
          _cuFiresSignals(['RO', 'AI']);
          _setBusActive('data', true); _setBusActive('clk', true);
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _clockPulse(true);
          _setLabel('THREE CONDITIONS — all must be met simultaneously', OV_COLORS.teal);
        }},
        { text: `One — data must be present on the bus.`, anim: () => {
          _dimAll(); _glowComp('RAM'); _glowComp('REGA');
          _fireComp('RAM', OV_COLORS.amber);
          _setBusActive('data', true); _showBinaryOnBus(42, 'data');
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _placeWaitingData('REGA', '42', OV_COLORS.amber);
          _setLabel('1. DATA on bus ✓ — pulses streaming from RAM', OV_COLORS.amber);
        }},
        { text: `Two — the CU must send the control signal.`, anim: () => {
          // Accumulate: keep data flowing + add CU signals
          _glowComp('RAM'); _glowComp('REGA'); _glowComp('CU');
          _fireComp('RAM', OV_COLORS.amber);
          _setBusActive('data', true); _showBinaryOnBus(42, 'data');
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _placeWaitingData('REGA', '42', OV_COLORS.amber);
          _cuFiresSignals(['RO', 'AI']);
          _setLabel('1. DATA ✓  2. CU fires RO+AI ✓ — signal lines glow', OV_COLORS.red);
        }},
        { text: `Three — the clock must beat.`, anim: () => {
          // Accumulate: keep data + signals + add clock
          _glowComp('RAM'); _glowComp('REGA'); _glowComp('CU');
          _fireComp('RAM', OV_COLORS.amber);
          _setBusActive('data', true); _showBinaryOnBus(42, 'data');
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _placeWaitingData('REGA', '42', OV_COLORS.green);
          _cuFiresSignals(['RO', 'AI']);
          _clockPulse(true);
          _setLabel('1. DATA ✓  2. SIGNAL ✓  3. CLOCK ✓ — all three met!', OV_COLORS.green);
        }},
        { text: `All three at once — and the data moves. Without any one of them, nothing happens.`, anim: () => {
          _removeWaitingData();

          _showCompVal('REGA', '42');
          _setLabel('ALL THREE → data moves. Missing one → nothing happens.', OV_COLORS.green);
        }},
      ]},
    ],
    highlightComponents: [],
  },
  {
    id: 3,
    title: 'The Boss',
    pages: [
      // Page 0
      { sentences: [
        { text: `Now meet the most important part — the one that tells everyone else what to do.`, anim: () => { _dimAll(); _glowComp('CU'); _setBusActive('ctrl', true); } },
        { text: `It is called the Control Unit.`, anim: () => { _fireComp('CU', OV_COLORS.red); _setBusActive('ctrl', true); const sigs = ['CO','MI','RO','AI']; sigs.forEach((s, i) => _after(i * 200, () => _lightCtrlSignal(s, true))); } },
        { text: `See the big box on the right?`, anim: () => { _fireComp('CU', OV_COLORS.red); _setBusActive('ctrl', true); _cuFiresSignals(['CO','MI','RO','II','AI','AO','BI','EO']); _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('IR'); _glowComp('REGA'); _glowComp('REGB'); _glowComp('ALU'); _glowComp('OUT'); _setLabel('CONTROL UNIT — sends orders to every component', OV_COLORS.red); } },
      ]},
      // Page 1
      { sentences: [
        { text: `The Control Unit does not store data.`, anim: () => { _dimAll(); _glowComp('CU'); _dimComp('RAM'); } },
        { text: `It does not do math.`, anim: () => { _dimComp('ALU'); _setLabel('CU does NOT compute — only sends orders', OV_COLORS.red); } },
        { text: `Its only job is to send signals — tiny ON/OFF commands — to all the other parts.`, anim: () => {
          _fireComp('CU', OV_COLORS.red);
          _setBusActive('ctrl', true);
          _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('IR'); _glowComp('REGA'); _glowComp('ALU'); _glowComp('OUT');
          const sigs = ['CO','MI','RO','II','AI','AO','BI','EO'];
          sigs.forEach((s, i) => _after(i * 180, () => { _lightCtrlSignal(s, true); }));
          // After all signals shown, show them as continuous pulsing control
          _after(sigs.length * 180 + 100, () => {
            _cuFiresSignals(sigs);
            ['PC','MAR','RAM','IR','REGA','REGB','ALU','OUT'].forEach((k, i) => _after(i * 100, () => _receiveComp(k, OV_COLORS.red)));
          });
          _setLabel('CU fires signals → each component receives its order', OV_COLORS.red);
        }},
      ]},
      // Page 2 — Show the control signal lines lighting up one by one
      { sentences: [
        { text: `Watch the right side of it. See those lines coming out?`, dur: 5000, anim: () => {
          _dimAll(); _glowComp('CU');
          // Light up signal lines one by one (16 × 200ms = 3200ms + viewing buffer)
          const sigs = ['CO','CE','J','MI','RO','RI','II','IO','AI','AO','BI','EO','SU','FI','OI','HLT'];
          sigs.forEach((s, i) => _after(i * 200, () => _lightCtrlSignal(s, true)));
          _setLabel('Watch the signal lines light up one by one', OV_COLORS.red);
        }},
        { text: `Each one goes to a different part of the CPU. Each line carries one command.`, anim: () => {
          _glowComp('CU'); _fireComp('CU', OV_COLORS.red);
          _cuFiresSignals(['CO','CE','J','MI','RO','RI','II','IO','AI','AO','BI','EO','SU','FI','OI','HLT']);
          _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('IR'); _glowComp('REGA'); _glowComp('REGB'); _glowComp('ALU'); _glowComp('OUT');
          _setLabel('16 signal lines — each one reaches a specific component', OV_COLORS.red);
        }},
      ]},
      // Page 3 — CU fires individual signals, LINES GLOW to specific components
      { sentences: [
        { text: `Watch: CU fires CO to PC — the CO line glows and PC lights up.`, dur: 3500, anim: () => {
          _dimAll(); _cuFiresSignals(['CO']);
          _after(400, () => { _receiveComp('PC', OV_COLORS.teal); _setBusActive('addr', true); _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0); });
          _setLabel('CO → PC outputs address onto the address bus', OV_COLORS.teal);
        }},
        { text: `CU fires MI to MAR — the MI line glows and MAR lights up.`, dur: 3500, anim: () => {
          _dimComp('PC'); _cuFiresSignals(['MI']); _glowComp('PC'); _setBusActive('addr', true);
          _spawnPacket('w-pc-mar', OV_COLORS.blue, true, 0);
          _after(400, () => { _receiveComp('MAR', OV_COLORS.blue); _showCompVal('MAR', '0'); });
          _setLabel('MI → MAR captures address from the address bus', OV_COLORS.blue);
        }},
        { text: `CU fires RO to RAM — the RO line glows and RAM lights up.`, dur: 3500, anim: () => {
          _dimComp('MAR'); _cuFiresSignals(['RO']); _glowComp('MAR');
          _after(400, () => { _receiveComp('RAM', OV_COLORS.amber); _setBusActive('data', true); _spawnPacket('w-ram-db', OV_COLORS.amber, false, 0); });
          _setLabel('RO → RAM outputs data onto the data bus', OV_COLORS.amber);
        }},
        { text: `CU fires AI to Register A — the AI line glows and Register A lights up.`, dur: 3500, anim: () => {
          _dimComp('RAM'); _cuFiresSignals(['AI']); _setBusActive('data', true);
          _after(400, () => { _receiveComp('REGA', OV_COLORS.purple); _spawnPacket('w-bus-rega', OV_COLORS.purple, false, 0); });
          _setLabel('AI → REG A captures data from the data bus', OV_COLORS.purple);
        }},
        { text: `Each signal line goes to exactly one component. One signal, one job.`, dur: 3000, anim: () => {
          _dimAll(); _fireComp('CU', OV_COLORS.red);
          _cuFiresSignals(['CO','MI','RO','AI']);
          _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('REGA');
          _setBusActive('addr', true); _setBusActive('data', true);
          _setLabel('ONE SIGNAL → ONE COMPONENT → ONE ACTION', OV_COLORS.red);
        }},
      ]},
      // Page 3b — CU tells each component: take in or put out
      { sentences: [
        { text: `The CU can only tell each component one of two things: put your data out onto the bus, or take data in from the bus.`, anim: () => {
          _dimAll(); _fireComp('CU', OV_COLORS.red); _setBusActive('ctrl', true); _setBusActive('data', true);
          Object.keys(CPU_COMPS).forEach(k => { if (k !== 'CU' && k !== 'CLK') _glowComp(k); });
          _setLabel('Every signal = either PUT OUT or TAKE IN. That is all.', OV_COLORS.red);
        }},
        { text: `Put out means: drive your value onto the bus. Take in means: capture the value from the bus.`, anim: () => {
          _dimAll(); _fireComp('CU', OV_COLORS.red);
          _glowComp('RAM'); _glowComp('REGA');
          _cuFiresSignals(['RO']);
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _after(1200, () => { _cuFiresSignals(['RO', 'AI']); _clockPulse(false); });
          _after(1500, () => { _receiveComp('REGA', OV_COLORS.purple); _showCompVal('REGA', '42'); });
          _setLabel('RAM puts out 42 → bus carries it → REG A takes in 42', OV_COLORS.amber);
        }},
        { text: `Only one component can put out at a time. But every component connected to the bus sees the data at their door.`, anim: () => {
          _dimAll(); _fireComp('CU', OV_COLORS.red);
          _cuFiresSignals(['RO']);
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _busWaitingAtDoors(42, null);
          _setLabel('One puts out. ALL see it. Only the one told to take in will capture.', OV_COLORS.red);
        }},
      ]},
      // Page 4 — Signal names explained with LINES GLOWING
      { sentences: [
        { text: `These signals have short names:`, anim: () => { _dimAll(); _dimAllCtrlSignals(); _glowComp('CU'); } },
        { text: `CO means Counter Out — tells PC to output its address.`, anim: () => {
          _dimAll(); _glowComp('CU'); _cuFiresSignals(['CO']);
          _glowComp('PC'); _glowComp('MAR');
          _after(300, () => { _fireComp('PC', OV_COLORS.teal); _setBusActive('addr', true); _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0); _showCompVal('PC', '0'); });
          _setLabel('CO → PC fires address onto address bus', OV_COLORS.teal);
        }},
        { text: `MI means MAR In — tells MAR to capture the address.`, anim: () => {
          _dimAll(); _glowComp('CU'); _cuFiresSignals(['CO', 'MI']);
          _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM');
          _fireComp('PC', OV_COLORS.teal); _setBusActive('addr', true);
          _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0);
          _after(300, () => { _receiveComp('MAR', OV_COLORS.blue); _showCompVal('MAR', '0'); _clockPulse(false); });
          _setLabel('MI → MAR latches address from bus on clock beat', OV_COLORS.blue);
        }},
        { text: `AI means A In — tells Register A to capture data from the bus.`, anim: () => {
          _dimAll(); _glowComp('CU'); _cuFiresSignals(['RO', 'AI']);
          _glowComp('RAM'); _glowComp('REGA'); _glowComp('MAR');
          _fireComp('RAM', OV_COLORS.amber); _setBusActive('data', true); _showBinaryOnBus(42, 'data');
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _after(300, () => { _clockPulse(false); _receiveComp('REGA', OV_COLORS.purple); _showCompVal('REGA', '42'); });
          _setLabel('AI → REG A latches data from bus on clock beat', OV_COLORS.purple);
        }},
        { text: `RO means RAM Out — tells RAM to put its value on the data bus.`, anim: () => {
          _dimAll(); _glowComp('CU'); _cuFiresSignals(['RO']);
          _glowComp('RAM'); _glowComp('MAR'); _glowComp('REGA'); _glowComp('REGB'); _glowComp('IR'); _glowComp('OUT');
          _showCompVal('MAR', '0');
          _after(300, () => {
            _fireComp('RAM', OV_COLORS.amber); _setBusActive('data', true); _showBinaryOnBus(42, 'data');
            _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          });
          _after(800, () => {
            _placeWaitingData('REGA', '42', OV_COLORS.amber);
            _placeWaitingData('REGB', '42', OV_COLORS.amber);
            _placeWaitingData('IR',   '42', OV_COLORS.amber);
            _placeWaitingData('OUT',  '42', OV_COLORS.amber);
          });
          _setLabel('RO → RAM fires 42 → pulses stream to every door', OV_COLORS.amber);
        }},
        { text: `Notice the pattern. Signals ending in O mean Out — send data onto the bus. CO is Counter Out. RO is RAM Out. AO is A Out. EO is ALU Out.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('CU');
          // Show output signals one by one — each one fires the source onto the bus
          _cuFiresSignals(['CO']); _fireComp('PC', OV_COLORS.teal); _setBusActive('addr', true);
          _after(700, () => { _cuFiresSignals(['RO']); _fireComp('RAM', OV_COLORS.amber); _setBusActive('data', true); _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber); });
          _after(1400, () => { _cuFiresSignals(['AO']); _fireComp('REGA', OV_COLORS.purple); _busWrite('REGA', 'w-rega-out', 5, OV_COLORS.purple); });
          _after(2100, () => { _cuFiresSignals(['EO']); _fireComp('ALU', OV_COLORS.orange); _busWrite('ALU', 'w-alu-bus', 8, OV_COLORS.orange); });
          _setLabel('O = Out = send data TO the bus. CO, RO, AO, EO, IO.', OV_COLORS.amber);
        }},
        { text: `Signals ending in I mean In — capture data from the bus. MI is MAR In. AI is A In. BI is B In. RI is RAM In. II is IR In.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('CU');
          _setBusActive('data', true);
          // Show input signals — each one captures from the bus
          _cuFiresSignals(['MI']); _receiveComp('MAR', OV_COLORS.blue);
          _after(700, () => { _cuFiresSignals(['AI']); _receiveComp('REGA', OV_COLORS.purple); });
          _after(1400, () => { _cuFiresSignals(['BI']); _receiveComp('REGB', OV_COLORS.purple); });
          _after(2100, () => { _cuFiresSignals(['RI']); _receiveComp('RAM', OV_COLORS.amber); });
          _after(2800, () => { _cuFiresSignals(['II']); _receiveComp('IR', OV_COLORS.amber); });
          _setLabel('I = In = capture data FROM the bus. MI, AI, BI, RI, II, OI.', OV_COLORS.blue);
        }},
        { text: `RAM has both. RO makes RAM send. RI makes RAM receive. That is how the CPU can both read from and write to memory using the same bus.`, dur: 5000, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('RAM'); _glowComp('MAR');
          _showCompVal('MAR', '5');
          // Show RO: RAM outputs
          _cuFiresSignals(['RO']);
          _fireComp('RAM', OV_COLORS.amber); _setBusActive('data', true);
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _after(1500, () => {
            _clearPackets(); _dimAll(); _glowComp('CU'); _glowComp('RAM'); _glowComp('MAR'); _glowComp('REGA');
            _showCompVal('MAR', '4');
            // Show RI: RAM receives
            _cuFiresSignals(['AO', 'RI']);
            _fireComp('REGA', OV_COLORS.purple); _setBusActive('data', true);
            _busWrite('REGA', 'w-rega-out', 8, OV_COLORS.purple);
            _after(500, () => { _receiveComp('RAM', OV_COLORS.amber); });
          });
          _setLabel('RO = RAM sends (read). RI = RAM receives (write). Same bus, two directions.', OV_COLORS.amber);
        }},
        { text: `We will learn each one as we go.`, anim: () => {
          _dimAllCtrlSignals();
          Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          _setBusActive('data', true); _setBusActive('addr', true);
          _setLabel('16 signals: some push data OUT, some pull data IN.', OV_COLORS.green);
        }},
      ]},
      // Page 5 — Lookup table: the restaurant analogy
      { sentences: [
        { text: `Think of a restaurant menu. You walk in and say "burger." The kitchen does not think about it — it follows the recipe for burger. Every time you say burger, you get the same thing.`, anim: () => {
          _dimAll(); _glowComp('CU');
          _setLabel('CU = restaurant menu. Command = your order. Signals = kitchen instructions.', OV_COLORS.red);
        }},
        { text: `The CU works the same way. It has a fixed list of recipes — one for each command. When it receives a command, it follows the matching recipe. No thinking. Just follow the list.`, anim: () => {
          _glowComp('IR'); _showCompVal('IR', 'LDA');
          _fireComp('CU', OV_COLORS.red);
          _flashCells('CU', OV_COLORS.red);
          _lightWire('w-ir-cu', true); _spawnPacket('w-ir-cu', OV_COLORS.red, true, 0);
          _after(500, () => _cuFiresSignals(['CO', 'MI', 'RO', 'AI']));
          _setLabel('IR sends command → CU reads recipe → fires matching signals', OV_COLORS.red);
        }},
      ]},
      // Page 6 — The CU has TWO inputs: opcode + step counter
      { sentences: [
        { text: `But how does the CU know which step of the recipe it is on? It uses a step counter — just like PC counts instructions, this counter counts steps within one instruction.`, dur: 5500, anim: () => {
          _dimAll(); _fireComp('CU', OV_COLORS.red); _glowComp('IR'); _glowComp('CLK');
          _showCompVal('IR', 'LDA');
          _showCompVal('CU', 'T0');
          _setLabel('CU has a step counter: T0, T1, T2, T3...', OV_COLORS.red);
        }},
        { text: `Every clock beat advances the step counter by one. T0, then T1, then T2, then T3. The clock is what moves it forward.`, dur: 5500, anim: () => {
          _dimAll(); _fireComp('CU', OV_COLORS.red); _fireComp('CLK', OV_COLORS.green);
          _glowComp('IR'); _showCompVal('IR', 'LDA');
          _showCompVal('CU', 'T0');
          _after(600, () => { _fireComp('CLK', OV_COLORS.green); _spawnPacket('w-clk-cu', OV_COLORS.green, false, 0); _showCompVal('CU', 'T1'); _flashCells('CU', OV_COLORS.red); });
          _after(1200, () => { _fireComp('CLK', OV_COLORS.green); _spawnPacket('w-clk-cu', OV_COLORS.green, false, 0); _showCompVal('CU', 'T2'); _flashCells('CU', OV_COLORS.red); });
          _after(1800, () => { _fireComp('CLK', OV_COLORS.green); _spawnPacket('w-clk-cu', OV_COLORS.green, false, 0); _showCompVal('CU', 'T3'); _flashCells('CU', OV_COLORS.red); });
          _setLabel('Clock beats → T0, T1, T2, T3. One step per beat.', OV_COLORS.green);
        }},
        { text: `So the CU reads two things: the instruction from the IR, and the current step from the counter. Together they tell the CU exactly which signals to fire right now.`, dur: 5000, anim: () => {
          _dimAll(); _fireComp('CU', OV_COLORS.red);
          _glowComp('IR'); _glowComp('CLK');
          _showCompVal('IR', 'LDA'); _showCompVal('CU', 'T2');
          _spawnPacket('w-ir-cu', OV_COLORS.red, true, 0);
          _after(500, () => _cuFiresSignals(['IO', 'MI']));
          _setLabel('IR=LDA + step=T2 → CU fires IO+MI. Exact match.', OV_COLORS.red);
        }},
        { text: `T0 and T1 are always the same — no matter what instruction. They always fetch the next command from memory. Every instruction starts with fetch.`, dur: 5000, anim: () => {
          _dimAll(); _fireComp('CU', OV_COLORS.red); _glowComp('CLK');
          _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('IR');
          _showCompVal('CU', 'T0');
          _cuFiresSignals(['CO', 'MI']);
          _after(1000, () => { _fireComp('CLK', OV_COLORS.green); _spawnPacket('w-clk-cu', OV_COLORS.green, false, 0); _showCompVal('CU', 'T1'); _cuFiresSignals(['RO', 'II', 'CE']); });
          _setLabel('T0=CO+MI, T1=RO+II+CE. Always. Every instruction.', OV_COLORS.teal);
        }},
        { text: `After the last step, the counter resets back to T0. The fetch cycle starts again for the next instruction. This loop never stops — unless HLT kills the clock.`, dur: 5500, anim: () => {
          _dimAll(); _fireComp('CU', OV_COLORS.red); _fireComp('CLK', OV_COLORS.green);
          _glowComp('IR'); _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM');
          _showCompVal('CU', 'T3');
          _cuFiresSignals(['RO', 'AI']);
          _after(600, () => { _fireComp('CLK', OV_COLORS.green); _spawnPacket('w-clk-cu', OV_COLORS.green, false, 0); });
          _after(900, () => { _showCompVal('CU', 'T0'); _flashCells('CU', OV_COLORS.teal); _cuFiresSignals(['CO', 'MI']); });
          _after(1500, () => { _fireComp('CLK', OV_COLORS.green); _spawnPacket('w-clk-cu', OV_COLORS.green, false, 0); });
          _after(1800, () => { _showCompVal('CU', 'T1'); _cuFiresSignals(['RO', 'II', 'CE']); });
          _setLabel('T3 → reset → T0 → T1 → ... round and round. Until HLT.', OV_COLORS.teal);
        }},
      ]},
      // Page 6b — Show the actual table with a real example
      { sentences: [
        { text: `So the lookup table inside the CU has two inputs: which instruction, and which step. The output is which signals to fire.`, anim: () => {
          _dimAll(); _fireComp('CU', OV_COLORS.red);
          _glowComp('IR'); _glowComp('CLK');
          _showCompVal('IR', 'LDA'); _showCompVal('CU', 'T0');
          _spawnPacket('w-ir-cu', OV_COLORS.red, true, 0);
          _cuFiresSignals(['CO', 'MI']);
          _setLabel('Table inputs: instruction + step. Output: signals.', OV_COLORS.red);
        }},
        { text: `Let us say the command is LDA — load a value from memory into Register A. The CU finds the LDA recipe and reads it step by step.`, anim: () => {
          _glowComp('IR'); _glowComp('CU'); _showCompVal('IR', 'LDA');
          _spawnPacket('w-ir-cu', OV_COLORS.red, true, 0);
          _after(400, () => { _receiveComp('CU', OV_COLORS.red); _showCompVal('CU', 'LDA'); });
          _setLabel('IR=LDA → CU finds the LDA row in the table', OV_COLORS.amber);
        }},
      ]},
      // Page 6b — Instruction encoding: how many commands can 8 bits represent?
      { sentences: [
        { text: `But how does the CU know which recipe to use? It reads a number — the opcode.`, anim: () => {
          _dimAll(); _glowComp('IR'); _glowComp('CU');

          _showCompVal('IR', '00000000');
          _setLabel('The IR holds 8 bits. Those 8 bits ARE the command number.', OV_COLORS.amber);
        }},
        { text: `The IR holds 8 bits. 8 bits can represent numbers from 0 to 255. That means our CPU could have up to 256 different commands.`, dur: 5000, anim: () => {
          _glowComp('IR'); _glowComp('CU');
          // Show IR cycling through some values to demonstrate the range
 _showCompVal('IR', '0');
          _after(500, () => { _showCompVal('IR', '1'); });
          _after(1000, () => { _showCompVal('IR', '2'); });
          _after(1500, () => { _showCompVal('IR', '15'); });
          _after(2000, () => { _showCompVal('IR', '128'); });
          _after(2500, () => { _showCompVal('IR', '255'); });
          _setLabel('8 bits = 256 possible opcodes (00000000 to 11111111)', OV_COLORS.amber);
        }},
        { text: `We do not use all 256. Our CPU has 26 commands. Each one has a fixed number.`, anim: () => {
          _glowComp('IR'); _glowComp('CU');
 _showCompVal('IR', '26 used');
          _setLabel('26 out of 256 slots used. The rest are empty.', OV_COLORS.amber);
        }},
        { text: `Command 0 is NOP — do nothing. Watch: 00000000 flows to the CU. The CU sees zero and fires no signals. Nothing happens.`, dur: 5000, anim: () => {
          _dimAll(); _glowComp('IR'); _glowComp('CU'); _glowComp('CLK');

          _showCompVal('IR', '0');
          _fireComp('IR', OV_COLORS.teal);
          _spawnPacket('w-ir-cu', OV_COLORS.red, true, 0);
          _after(500, () => { _receiveComp('CU', OV_COLORS.red); _showCompVal('CU', 'NOP'); });
          _after(1000, () => { _cuFiresSignals([]); }); // no signals!
          _setLabel('00000000 = NOP. CU sees 0 → fires nothing. CPU idles.', OV_COLORS.teal);
        }},
        { text: `Command 1 is LDA — load from memory. 00000001 flows to the CU. The CU fires the LDA recipe: address signals, then data signals.`, dur: 5000, anim: () => {
          _dimAll(); _glowComp('IR'); _glowComp('CU'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('REGA'); _glowComp('CLK');

          _showCompVal('IR', '1');
          _fireComp('IR', OV_COLORS.amber);
          _spawnPacket('w-ir-cu', OV_COLORS.red, true, 0);
          _after(500, () => { _receiveComp('CU', OV_COLORS.red); _showCompVal('CU', 'LDA'); });
          _after(1000, () => { _cuFiresSignals(['IO', 'MI']); _setBusActive('addr', true); });
          _after(1500, () => { _cuFiresSignals(['RO', 'AI']); _setBusActive('data', true); _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber); });
          _setLabel('00000001 = LDA. CU fires IO|MI then RO|AI.', OV_COLORS.amber);
        }},
        { text: `Command 2 is ADD. Command 6 is JMP. Command 14 is OUT. Command 15 is HLT — halt, stop the clock. Each number triggers a different recipe.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('IR'); _glowComp('CU');
          // Cycle through key instructions showing binary → CU → different signals
 _showCompVal('IR', '2');
          _spawnPacket('w-ir-cu', OV_COLORS.red, true, 0);
          _after(0, () => { _showCompVal('CU', 'ADD'); _cuFiresSignals(['IO','MI','RO','BI','EO','AI','FI']); });
          _after(1000, () => { _showCompVal('IR', '6'); _showCompVal('CU', 'JMP'); _cuFiresSignals(['IO','J']); _setBusActive('addr', true); });
          _after(2000, () => { _showCompVal('IR', '14'); _showCompVal('CU', 'OUT'); _cuFiresSignals(['AO','OI']); _setBusActive('data', true); });
          _after(3000, () => { _showCompVal('IR', '15'); _showCompVal('CU', 'HLT'); _cuFiresSignals(['HLT']); _dimComp('CLK'); });
          _setLabel('Each opcode number → different recipe → different signals', OV_COLORS.orange);
        }},
        { text: `Same number always produces the same recipe. 00000001 will always fire LDA signals. 00000010 will always fire ADD signals. The CU does not choose — it looks up.`, anim: () => {
          _dimAll(); _glowComp('IR'); _glowComp('CU');
 _showCompVal('IR', '1');
          _spawnPacket('w-ir-cu', OV_COLORS.red, true, 0);
          _receiveComp('CU', OV_COLORS.red); _showCompVal('CU', 'LDA');
          _cuFiresSignals(['IO','MI','RO','AI']);
          _flashCells('CU', OV_COLORS.red);
          _setLabel('Lookup, not logic. Same input → same output. Always.', OV_COLORS.red);
        }},
        { text: `This process — reading the opcode bits and looking up the matching signals — is called DECODE. It is the second step of every instruction: fetch the command, decode it, then execute it.`, dur: 6000, anim: () => {
          _dimAll(); _glowComp('IR'); _glowComp('CU'); _glowComp('CLK');
          // Show the decode process animated: bits flow from IR → CU → signals fire
 _showCompVal('IR', '2');
          _fireComp('IR', OV_COLORS.amber);
          _spawnPacket('w-ir-cu', OV_COLORS.red, true, 0);
          _after(500, () => { _receiveComp('CU', OV_COLORS.red); _showCompVal('CU', 'DECODE'); _flashCells('CU', OV_COLORS.red); });
          _after(1000, () => { _showCompVal('CU', 'ADD'); _cuFiresSignals(['IO','MI','RO','BI','EO','AI','FI']); });
          // Show all target components lighting up as signals reach them
          _after(1500, () => { _glowComp('MAR'); _glowComp('RAM'); _glowComp('REGB'); _glowComp('ALU'); _glowComp('REGA'); _glowComp('FLAGS'); _setBusActive('data', true); _setBusActive('addr', true); });
          _setLabel('DECODE = read opcode bits → look up recipe → fire signals', OV_COLORS.red);
        }},
      ]},
      // Page 7 — Step T0 of the recipe
      { sentences: [
        { text: `Step T0. The recipe says: turn ON two signals — CO and MI. All others stay OFF.`, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('IR'); _glowComp('PC'); _glowComp('MAR');
          _showCompVal('IR', 'LDA'); _showCompVal('CU', 'T0'); _showCompVal('PC', '0');
          _cuFiresSignals(['CO', 'MI']);
          _setLabel('T0 recipe: CO=ON, MI=ON. All 14 others = OFF.', OV_COLORS.teal);
        }},
        { text: `CO tells PC to output its address. MI tells MAR to capture it. That is all T0 does.`, anim: () => {
          _glowComp('CU'); _glowComp('IR'); _glowComp('RAM'); _glowComp('CLK');
          _showCompVal('IR', 'LDA'); _showCompVal('CU', 'T0'); _showCompVal('PC', '0');
          _cuFiresSignals(['CO', 'MI']);
          _fireComp('PC', OV_COLORS.teal);
          _setBusActive('addr', true);
          _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0);
          _clockPulse(false);
          _after(700, () => { _receiveComp('MAR', OV_COLORS.blue); _showCompVal('MAR', '0'); });
          _setLabel('T0: CO|MI → clock beats → PC pulses address → MAR captures', OV_COLORS.teal);
        }},
      ]},
      // Page 8 — Step T1 of the recipe
      { sentences: [
        { text: `Step T1. The recipe says: turn ON three signals — RO, II, and CE. Turn OFF CO and MI.`, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('IR'); _glowComp('RAM'); _glowComp('PC'); _glowComp('MAR');
          _showCompVal('IR', 'LDA'); _showCompVal('CU', 'T1'); _showCompVal('MAR', '0');
          _cuFiresSignals(['RO', 'II', 'CE']);
          _setLabel('T1 recipe: RO=ON, II=ON, CE=ON. CO and MI now OFF.', OV_COLORS.amber);
        }},
        { text: `RO tells RAM to output. II tells IR to capture. CE tells PC to count up. Three signals, three actions.`, anim: () => {
          _glowComp('CU'); _glowComp('MAR'); _glowComp('CLK');
          _glowComp('REGA'); _glowComp('REGB'); _glowComp('OUT'); // bus-connected: will see data
          _showCompVal('MAR', '0'); _showCompVal('CU', 'T1');
          _cuFiresSignals(['RO', 'II', 'CE']);
          _fireComp('RAM', OV_COLORS.amber);
          _setBusActive('data', true);
          _clockPulse(false);
          // RAM data pulses to ALL bus doors, IR captures
          _spawnPacket('w-ram-ir', OV_COLORS.amber, true, 0);
          _spawnPacket('w-bus-rega', OV_COLORS.amber, true, 0.2);
          _spawnPacket('w-bus-regb', OV_COLORS.amber, true, 0.25);
          _spawnPacket('w-out', OV_COLORS.amber, true, 0.3);
          _after(300, () => { _flashCells('PC', OV_COLORS.teal); _showCompVal('PC', '1'); });
          _after(700, () => { _receiveComp('IR', OV_COLORS.amber); _showCompVal('IR', 'LDA 5'); });
          _setLabel('T1: RO|II|CE → RAM pulses to all doors, IR captures. PC→1.', OV_COLORS.amber);
        }},
      ]},
      // Page 9 — Step T2 and T3
      { sentences: [
        { text: `Step T2. Recipe says: IO and MI. The IR sends the address to MAR.`, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('IR'); _glowComp('MAR'); _glowComp('RAM'); _showCompVal('CU', 'T2');
          _showCompVal('IR', 'LDA 5');
          _cuFiresSignals(['IO', 'MI']);
          _fireComp('IR', OV_COLORS.amber);
          _setBusActive('addr', true);
          _clockPulse(false);
          // Continuous directional pulse: IR operand → address bus → MAR
          _spawnPacket('w-ir-db', OV_COLORS.blue, true, 0);
          _after(700, () => { _receiveComp('MAR', OV_COLORS.blue); _showCompVal('MAR', '5'); });
          _setLabel('Clock beats → IR pulses address 5 → MAR captures.', OV_COLORS.blue);
        }},
        { text: `Step T3. Recipe says: RO and AI. RAM sends data to Register A. Done.`, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('RAM'); _glowComp('REGA'); _glowComp('MAR'); _glowComp('CLK');
          _showCompVal('CU', 'T3'); _showCompVal('MAR', '5');
          _cuFiresSignals(['RO', 'AI']);
          _fireComp('RAM', OV_COLORS.amber);
          _setBusActive('data', true);
          _clockPulse(false);
          // Continuous directional pulses: RAM → data bus → REG A
          _showBinaryOnBus(42, 'data');
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _after(800, () => { _receiveComp('REGA', OV_COLORS.purple); _showCompVal('REGA', '42'); });
          _setLabel('Clock beats → RAM pulses 42 → bus → REG A captures. LDA done.', OV_COLORS.purple);
        }},
      ]},
      // Page 10 — Different command, different recipe
      { sentences: [
        { text: `Now what if the command was ADD instead of LDA? The CU finds a different recipe — different signals at each step.`, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('IR');
          _showCompVal('IR', 'ADD');
          _setLabel('Different command → different recipe', OV_COLORS.orange);
        }},
        { text: `T0 and T1 are the same — every command starts with fetch. But T2, T3, T4 are different for ADD.`, anim: () => {
          _showCompVal('CU', 'T2');
          _cuFiresSignals(['IO', 'MI']);
          _setLabel('ADD T2: IO|MI — same as LDA T2. But T3 is different...', OV_COLORS.orange);
        }},
        { text: `ADD T3 sends data to Register B instead of A. And T4 tells the ALU to compute and send the result back.`, dur: 6000, anim: () => {
          // T3: RO|BI — RAM fires, data to all doors, only B captures
          _dimAll();
          _glowComp('CU'); _glowComp('RAM'); _glowComp('MAR'); _glowComp('REGB'); _glowComp('REGA'); _glowComp('IR'); _glowComp('OUT'); _glowComp('CLK');
          _showCompVal('CU', 'T3'); _showCompVal('IR', 'ADD'); _showCompVal('MAR', '5'); _showCompVal('REGA', '5');
          _cuFiresSignals(['RO', 'BI']);
          _fireComp('RAM', OV_COLORS.amber);
          _setBusActive('data', true); _showBinaryOnBus(3, 'data');
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _after(400, () => {
            _placeWaitingData('REGB', '3', OV_COLORS.green);
            _placeWaitingData('REGA', '3', '#332200');
            _placeWaitingData('IR',   '3', '#332200');
            _placeWaitingData('OUT',  '3', '#332200');
          });
          _after(800, () => { _clockPulse(false); _removeWaitingData(); _receiveComp('REGB', OV_COLORS.green); _showCompVal('REGB', '3'); });
          // T4: EO|AI|FI — ALU computes, result to all doors, A captures
          _after(1200, () => {
            _clearPackets(); _dimAll();
            _glowComp('CU'); _glowComp('REGA'); _glowComp('REGB'); _glowComp('ALU'); _glowComp('FLAGS'); _glowComp('CLK');
            _glowComp('RAM'); _glowComp('IR'); _glowComp('OUT');
            _showCompVal('CU', 'T4'); _showCompVal('REGA', '5'); _showCompVal('REGB', '3');
            _cuFiresSignals(['EO', 'AI', 'FI']);
            _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0);
            _spawnPacket('w-regb-alu', OV_COLORS.orange, true, 0.15);
            _fireComp('ALU', OV_COLORS.orange); _showCompVal('ALU', '5+3=8');
            _setBusActive('data', true); _showBinaryOnBus(8, 'data');
            _busWrite('ALU', 'w-alu-bus', 8, OV_COLORS.orange);
          });
          _after(1800, () => {
            _placeWaitingData('REGA', '8', OV_COLORS.green);
            _placeWaitingData('REGB', '8', '#332200');
            _placeWaitingData('OUT',  '8', '#332200');
          });
          _after(2400, () => { _clockPulse(false); _removeWaitingData(); _receiveComp('REGA', OV_COLORS.green); _showCompVal('REGA', '8'); });
          _setLabel('T3: RAM→all doors→B captures | T4: ALU→all doors→A captures', OV_COLORS.orange);
        }},
      ]},
      // Page 11 — The key insight
      { sentences: [
        { text: `That is all the CU does. Same command and same step will always produce the same signals. Every single time.`, anim: () => {
          _dimAll(); _glowComp('CU');
          _cuFiresSignals(['CO', 'MI']);
          _setLabel('Same input → same output. Every time. No exceptions.', OV_COLORS.red);
        }},
        { text: `It does not think. It does not decide. It just reads the recipe and follows it.`, anim: () => {
          _flashCells('CU', OV_COLORS.red);
          _setLabel('No thinking. No decisions. Just follow the recipe.', OV_COLORS.red);
        }},
        { text: `In Ben Eater's build, this recipe table is burned into a ROM chip — a chip where the data is permanent and can only be read.`, anim: () => {
          _glowComp('CU');
          _setLabel('ROM chip — the recipe is burned in permanently. Cannot be changed.', OV_COLORS.red);
        }},
      ]},
    ],
    highlightComponents: [],
  },
  {
    id: 4,
    title: 'The Storage Room',
    pages: [
      // Page 0
      { sentences: [
        { text: `The CPU needs somewhere to keep the commands it has to follow and the numbers it has to work with.`, anim: () => {
          _dimAll(); _glowComp('RAM');
          // Show RAM in context — connected to buses, MAR pointing at it
          _glowComp('MAR'); _glowComp('CU');
          _setBusActive('data', true); _setBusActive('addr', true);
          _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0);
          _showBinaryInRAMRow(0, 0x51, OV_COLORS.amber);
          _showBinaryInRAMRow(1, 0x2E, OV_COLORS.amber);
          _showBinaryInRAMRow(2, 0xE0, OV_COLORS.amber);
        } },
        { text: `That is the memory — labelled RAM on the screen.`, anim: () => {
          _fireComp('RAM', OV_COLORS.amber);
          _glowComp('MAR'); _glowComp('CU');
          _setBusActive('data', true); _setBusActive('addr', true);
          _spawnPacket('w-ram-db', OV_COLORS.amber, true, 0);
          _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0);
          _setLabel('RAM — Random Access Memory', OV_COLORS.amber);
        } },
      ]},
      // Page 1
      { sentences: [
        { text: `Think of it as a hallway of numbered rooms.`, anim: () => {
          _dimAll(); _fireComp('RAM', OV_COLORS.amber);
          _showBinaryInRAMRow(0, 0x51, OV_COLORS.blue);
          _showBinaryInRAMRow(1, 0x2E, OV_COLORS.blue);
          _showBinaryInRAMRow(2, 0xE0, OV_COLORS.blue);
          _showBinaryInRAMRow(3, 3, OV_COLORS.blue);
        } },
        { text: `Each room holds one value.`, anim: () => {
          _glowComp('RAM');
          const ramCells = _diagSVG ? Array.from(_diagSVG.querySelectorAll('.ram-cell')) : [];
          ramCells.forEach((c, i) => _after(i * 60, () => { c.setAttribute('fill', OV_COLORS.blue); c.setAttribute('opacity', '1'); }));
          _setLabel('Each numbered room holds one 8-bit value (0–255)', OV_COLORS.blue);
        } },
        { text: `In this CPU, there are 16 rooms.`, anim: () => {
          _glowComp('RAM'); _glowComp('MAR');
          _showCompVal('MAR', '0');
          _setBusActive('addr', true);
          // Show MAR counting through addresses to demonstrate 16 rooms
          const addrs = [0, 4, 8, 12, 15];
          addrs.forEach((a, i) => _after(i * 400, () => { _showCompVal('MAR', '' + a); _spawnPacket('w-mar-ram', OV_COLORS.blue, false, 0); }));
          _setLabel('16 rooms — MAR can address 0 to 15', OV_COLORS.blue);
        } },
        { text: `The screen shows 8 of them — the rest exist but are not drawn.`, anim: () => {
          _glowComp('RAM'); _glowComp('MAR');
          _showCompVal('MAR', '15');
          _setBusActive('addr', true);
          _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0);
          _setLabel('Rooms 0–7 visible. Rooms 8–15 exist in the chip.', OV_COLORS.blue);
        } },
      ]},
      // Page 2
      { sentences: [
        { text: `See the amber lines going up from RAM?`, anim: () => {
          _dimAll(); _fireComp('RAM', OV_COLORS.amber);
          _glowComp('REGA'); _glowComp('REGB'); _glowComp('IR'); _glowComp('OUT');
          _setBusActive('data', true); _lightWire('w-ram-db', true);
          _spawnPacket('w-ram-db', OV_COLORS.amber, true, 0);
          _setLabel('Amber lines going UP from RAM to the data bus', OV_COLORS.amber);
        } },
        { text: `Those are the data wires — 8 of them, one for each bit.`, anim: () => {
          _glowComp('RAM'); _glowComp('CU'); _glowComp('MAR');
          _cuFiresSignals(['RO']); _showCompVal('MAR', '0');
          _fireComp('RAM', OV_COLORS.amber);
          _setBusActive('data', true);
          _spawnPacket('w-ram-db', OV_COLORS.amber, true, 0);
          _showBinaryOnBus(42, 'data');
          _setLabel('8 data wires — CU fires RO → RAM drives 42 = 00101010', OV_COLORS.amber);
        } },
        { text: `When the CPU reads from memory, the value travels up these 8 wires.`, dur: 4000, anim: () => {
          _glowComp('CU'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('CLK');
          _glowComp('REGA'); _glowComp('REGB'); _glowComp('IR'); _glowComp('OUT');
          _showCompVal('MAR', '0');
          _cuFiresSignals(['RO']);
          _setBusActive('addr', true);
          _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0);
          _after(350, () => {
            _fireComp('RAM', OV_COLORS.amber);
            _setBusActive('data', true); _showBinaryOnBus(42, 'data');
            // Value pulses to ALL bus-connected components
            _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          });
          _after(900, () => {
            _placeWaitingData('REGA', '42', OV_COLORS.amber);
            _placeWaitingData('REGB', '42', OV_COLORS.amber);
            _placeWaitingData('IR',   '42', OV_COLORS.amber);
            _placeWaitingData('OUT',  '42', OV_COLORS.amber);
          });
          _setLabel('MAR=0 → CU fires RO → 42 pulses up to every door', OV_COLORS.amber);
        } },
      ]},
      // Page 3
      { sentences: [
        { text: `See the blue lines coming in from the left?`, anim: () => {
          _dimAll(); _glowComp('RAM'); _glowComp('MAR'); _glowComp('PC');
          _setBusActive('addr', true);
          _spawnPacket('w-pc-mar', OV_COLORS.blue, true, 0);
          _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0.3);
          _setLabel('Blue lines: PC → MAR → RAM', OV_COLORS.blue);
        } },
        { text: `Those are the address wires — 4 of them.`, anim: () => {
          _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM');
          _setBusActive('addr', true);
          _spawnPacket('w-pc-mar', OV_COLORS.blue, true, 0);
          _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0.3);
          _showCompVal('MAR', '3');
          _setLabel('4 blue address wires — carry room number to RAM', OV_COLORS.blue);
        } },
        { text: `They tell RAM which room to open.`, anim: () => {
          _glowComp('PC'); _glowComp('MAR'); _fireComp('RAM', OV_COLORS.amber);
          _glowComp('CU'); _cuFiresSignals(['CO', 'MI']);
          _setBusActive('addr', true);
          _showCompVal('MAR', '3');
          _spawnPacket('w-pc-mar', OV_COLORS.blue, true, 0);
          _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0.3);
          _after(400, () => _showBinaryInRAMRow(3, 7, OV_COLORS.amber));
          _setLabel('MAR=3 → address pulses → RAM opens room 3', OV_COLORS.blue);
        } },
        { text: `4 bits can count 0 to 15 — exactly the 16 rooms.`, dur: 4000, anim: () => {
          _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM');
          _setBusActive('addr', true);
          // Animate MAR counting through addresses
          _showBinaryOnBus(0, 'addr'); _showCompVal('MAR', '0');
          _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0);
          _after(600, () => { _showBinaryOnBus(7, 'addr'); _showCompVal('MAR', '7'); });
          _after(1200, () => { _showBinaryOnBus(15, 'addr'); _showCompVal('MAR', '15'); });
          _setLabel('4 bits = 0000 to 1111 = rooms 0 to 15', OV_COLORS.blue);
        } },
      ]},
    ],
    highlightComponents: [],
  },
  {
    id: 5,
    title: 'The Address Book',
    pages: [
      // Page 0
      { sentences: [
        { text: `How does the CPU know which room to look in?`, anim: () => { _dimAll(); _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _setBusActive('addr', true); _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0); _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0.3); } },
        { text: `Two parts handle this.`, anim: () => { _fireComp('PC', OV_COLORS.teal); _fireComp('MAR', OV_COLORS.blue); _glowComp('RAM'); _setBusActive('addr', true); _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0); _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0.3); _setLabel('PC + MAR — the address team', OV_COLORS.teal); } },
      ]},
      // Page 1
      { sentences: [
        { text: `First, the Program Counter — labelled PC.`, anim: () => { _dimAll(); _fireComp('PC', OV_COLORS.teal); _showCompVal('PC', '0'); _setLabel('PROGRAM COUNTER', OV_COLORS.teal); } },
        { text: `It is a simple counter that holds the room number of the next command.`, anim: () => { _glowComp('PC'); _showCompVal('PC', '0'); _glowComp('MAR'); _glowComp('RAM'); _setBusActive('addr', true); _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0); _setLabel('PC holds address 0 — next command is in room 0', OV_COLORS.teal); } },
        { text: `Watch it count: 0, 1, 2, 3...`, dur: 4500, anim: () => { _cuFiresSignals(['CE']); _glowComp('CLK'); _setBusActive('clk', true); const vals = ['0','1','2','3']; vals.forEach((v, i) => _after(i * 700, () => { _fireComp('CLK', OV_COLORS.green); _showCompVal('PC', v); _flashCells('PC', OV_COLORS.teal); _setLabel('Clock beats, CU fires CE → PC = ' + v, OV_COLORS.teal); })); } },
      ]},
      // Page 2
      { sentences: [
        { text: `Second, the MAR — the Memory Address Register.`, anim: () => { _dimAll(); _glowComp('PC'); _fireComp('MAR', OV_COLORS.blue); _glowComp('RAM'); _setBusActive('addr', true); _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0); _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0.3); _showCompVal('MAR', '2'); _setLabel('MAR — sits between PC and RAM on the address bus', OV_COLORS.blue); } },
        { text: `Whatever room number the PC sends out, the MAR catches it and passes it to the memory.`, anim: () => { _cuFiresSignals(['CO', 'MI']); _setBusActive('addr', true); _showCompVal('PC', '2'); _fireComp('PC', OV_COLORS.teal); _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0); _after(500, () => { _receiveComp('MAR', OV_COLORS.blue); _showCompVal('MAR', '2'); _spawnPacket('w-mar-ram', OV_COLORS.blue, false, 0); }); _setLabel('CU: CO → PC fires address 2 → MAR captures → passes to RAM', OV_COLORS.teal); } },
        { text: `The path: PC fires, address bus glows, MAR receives, MAR passes to RAM.`, anim: () => {
          _cuFiresSignals(['CO', 'MI']);
          _glowComp('CLK'); _glowComp('CU');
          _fireComp('PC', OV_COLORS.teal); _showCompVal('PC', '2');
          _setBusActive('addr', true);
          // Full path: continuous directional pulses PC → MAR → RAM
          _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0);
          _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0.3);
          _glowComp('MAR'); _showCompVal('MAR', '2');
          _glowComp('RAM'); _receiveComp('RAM', OV_COLORS.amber);
          _setLabel('PC → pulses on address bus → MAR → pulses to RAM', OV_COLORS.teal);
        } },
      ]},
      // Page 2b — MAR purpose: it just points. RAM acts on that pointed row.
      { sentences: [
        { text: `Watch MAR and RAM together. MAR just points at a row. It does not read or write anything itself. Look at what happens as MAR changes.`, dur: 5000, anim: () => {
          _dimAll(); _glowComp('MAR'); _glowComp('RAM');
          _showCompVal('MAR', '0');
          _setLabel('MAR = pointer. It just points. Watch RAM react.', OV_COLORS.blue);
        }},
        { text: `MAR equals 0. Row 0 is selected. MAR equals 1. Row 1 is selected. MAR equals 3. Row 3 is selected. Whatever MAR shows, RAM highlights that row.`, dur: 7000, anim: () => {
          _dimAll(); _fireComp('MAR', OV_COLORS.blue); _glowComp('RAM');
          _setBusActive('addr', true);
          _showCompVal('MAR', '0');
          _after(1500, () => { _showCompVal('MAR', '1'); });
          _after(3000, () => { _showCompVal('MAR', '3'); });
          _after(4500, () => { _showCompVal('MAR', '5'); });
          _setLabel('MAR changes → RAM row changes. Always in sync.', OV_COLORS.blue);
        }},
        { text: `But MAR pointing alone does nothing. RAM does not release or store data just because MAR points at it. MAR is passive — it only marks the spot.`, dur: 5500, anim: () => {
          _dimAll(); _fireComp('MAR', OV_COLORS.blue); _glowComp('RAM');
          _showCompVal('MAR', '3');
          _dimComp('CU');
          _dimAllCtrlSignals();
          _setLabel('MAR=3. Row 3 selected. But no read, no write. Nothing moves.', OV_COLORS.red);
        }},
        { text: `For data to move, the CU must knock on RAM. If the CU fires RO — the Read knock — RAM releases the contents of whatever row MAR is pointing at. Watch.`, dur: 6000, anim: () => {
          _dimAll(); _glowComp('MAR'); _glowComp('CU');
          _showCompVal('MAR', '3');
          _showBinaryInRAMRow(3, 42, OV_COLORS.amber);
          _cuFiresSignals(['RO']);
          _after(600, () => { _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber); });
          _setLabel('MAR=3 → CU knocks RO → RAM releases row 3 contents (42)', OV_COLORS.amber);
        }},
        { text: `Now change MAR to 6. A different row is selected. The CU knocks RO again. RAM releases row 6 contents — a different value.`, dur: 6000, anim: () => {
          _dimAll(); _glowComp('MAR'); _glowComp('CU');
          _showCompVal('MAR', '6');
          _showBinaryInRAMRow(6, 17, OV_COLORS.amber);
          _cuFiresSignals(['RO']);
          _after(600, () => { _busWrite('RAM', 'w-ram-db', 17, OV_COLORS.amber); });
          _setLabel('MAR=6 → CU knocks RO → RAM releases row 6 contents (17)', OV_COLORS.amber);
        }},
        { text: `Same RAM. Same RO knock. Different MAR. Different result. The address in MAR decides WHICH row acts.`, dur: 5000, anim: () => {
          _dimAll(); _glowComp('MAR'); _glowComp('CU'); _glowComp('RAM');
          // Rapid cycle: show 3 different addresses, each reading different data
          _showCompVal('MAR', '0'); _showBinaryInRAMRow(0, 5, OV_COLORS.amber);
          _cuFiresSignals(['RO']);
          _after(1200, () => { _showCompVal('MAR', '3'); _showBinaryInRAMRow(3, 42, OV_COLORS.amber); _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber); });
          _after(2400, () => { _showCompVal('MAR', '6'); _showBinaryInRAMRow(6, 17, OV_COLORS.amber); _busWrite('RAM', 'w-ram-db', 17, OV_COLORS.amber); });
          _setLabel('MAR changes → the selected row changes → RO releases different data', OV_COLORS.amber);
        }},
        { text: `The CU can also knock RI — the Write knock. That tells RAM to store whatever is on the bus INTO the row MAR is pointing at.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('MAR'); _glowComp('CU'); _glowComp('REGA');
          _showCompVal('MAR', '4'); _showCompVal('REGA', '99');
          _cuFiresSignals(['AO', 'RI']);
          _fireComp('REGA', OV_COLORS.purple);
          _setBusActive('data', true);
          _busWrite('REGA', 'w-rega-out', 99, OV_COLORS.purple);
          _after(700, () => { _clockPulse(false); _receiveComp('RAM', OV_COLORS.amber); _showBinaryInRAMRow(4, 99, OV_COLORS.purple); });
          _setLabel('MAR=4 → CU knocks AO+RI → RAM stores 99 into row 4', OV_COLORS.purple);
        }},
        { text: `So watch: the address in MAR is the question "which row?" — but the CU signal decides the action: read it, or write to it. MAR points, CU knocks, RAM acts.`, dur: 6000, anim: () => {
          _dimAll(); _glowComp('MAR'); _glowComp('CU'); _glowComp('RAM');
          _showCompVal('MAR', '3');
          _showBinaryInRAMRow(3, 42, OV_COLORS.amber);
          _cuFiresSignals(['RO']);
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _setLabel('MAR = which row. CU = read or write. RAM = does it.', OV_COLORS.blue);
        }},
      ]},
      // Page 3
      { sentences: [
        { text: `Watch what happens at the end: instead of counting to 5, the PC suddenly jumps back to 1.`, dur: 4500, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('PC'); _glowComp('IR'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('CLK');
          _showCompVal('PC', '4'); _showCompVal('IR', 'JMP 1');
          // JMP execute: IO + J. IR operand → ADDRESS bus → PC loads.
          // MAR does NOT update (MI is OFF). MAR still holds old address.
          _cuFiresSignals(['IO', 'J']);
          _setBusActive('addr', true);
          _showBinaryOnBus(1, 'addr');
          _fireComp('IR', OV_COLORS.orange);
          // Pulse: IR operand down to address bus, then address bus into PC (reverse on w-pc-mar)
          _spawnPacket('w-ir-db', OV_COLORS.orange, false, 0);
          _after(400, () => _spawnPacket('w-pc-mar', OV_COLORS.orange, false, 0, true));
          _after(800, () => { _clockPulse(false); _flashCells('PC', OV_COLORS.orange); _showCompVal('PC', '1'); });
          _setLabel('IO+J → IR operand 1 → address bus → PC loads 1. MAR unchanged.', OV_COLORS.orange);
        } },
        { text: `That orange flash is a JUMP.`, anim: () => {
          _glowComp('CU'); _glowComp('PC'); _glowComp('IR'); _glowComp('MAR');
          _cuFiresSignals(['IO', 'J']);
          _showCompVal('PC', '1'); _showCompVal('IR', 'JMP 1');
          _flashCells('PC', OV_COLORS.orange);
          _setBusActive('addr', true); _showBinaryOnBus(1, 'addr');
          // Continuous pulse: IR operand → address bus → PC
          _fireComp('IR', OV_COLORS.orange);
          _spawnPacket('w-ir-db', OV_COLORS.orange, true, 0);
          _spawnPacket('w-pc-mar', OV_COLORS.orange, true, 0.3, true);  // reverse: addr bus → PC
          _setLabel('IO+J — IR operand pulses on address bus into PC', OV_COLORS.orange);
        } },
        { text: `The CPU goes back to an earlier room.`, anim: () => {
          // Next T0 starts: CO+MI → PC fires new address → MAR NOW captures it
          _glowComp('CU'); _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('CLK');
          _cuFiresSignals(['CO', 'MI']);
          _showCompVal('PC', '1');
          _fireComp('PC', OV_COLORS.teal);
          _setBusActive('addr', true); _showBinaryOnBus(1, 'addr');
          _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0);
          _clockPulse(false);
          _after(500, () => { _receiveComp('MAR', OV_COLORS.blue); _showCompVal('MAR', '1'); });
          _setLabel('Next T0: CO+MI → PC fires 1 → MAR NOW gets the new address', OV_COLORS.teal);
        } },
        { text: `That is how loops work.`, anim: () => {
          // Show the loop visually: PC counting then jumping back
          _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('CU'); _glowComp('IR'); _glowComp('CLK');
          _setBusActive('addr', true); _setBusActive('clk', true);
          _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0);
          _clockPulse(true);
          _showCompVal('PC', '1');
          // Quick count-and-jump loop
          _after(0, () => { _showCompVal('PC', '1'); _flashCells('PC', OV_COLORS.teal); });
          _after(500, () => { _showCompVal('PC', '2'); _flashCells('PC', OV_COLORS.teal); });
          _after(1000, () => { _showCompVal('PC', '3'); _flashCells('PC', OV_COLORS.teal); });
          _after(1500, () => { _showCompVal('PC', '1'); _flashCells('PC', OV_COLORS.orange); }); // jump!
          _after(2000, () => { _showCompVal('PC', '2'); _flashCells('PC', OV_COLORS.teal); });
          _after(2500, () => { _showCompVal('PC', '3'); _flashCells('PC', OV_COLORS.teal); });
          _after(3000, () => { _showCompVal('PC', '1'); _flashCells('PC', OV_COLORS.orange); }); // jump again!
          _setLabel('LOOP: count 1→2→3→JUMP back to 1→2→3→JUMP...', OV_COLORS.orange);
        } },
      ]},
      // Page 4
      { sentences: [
        { text: `The PC has two modes: count up normally, or load a new value on a jump.`, dur: 5000, anim: () => {
          _dimAll(); _glowComp('PC'); _glowComp('MAR'); _glowComp('CU'); _glowComp('CLK'); _glowComp('IR'); _glowComp('RAM');
          _setBusActive('addr', true);
          // Mode 1: CE = count up — clock beats, PC increments
          _cuFiresSignals(['CE']);
          _showCompVal('PC', '3');
          _clockPulse(false);
          _after(600, () => { _showCompVal('PC', '4'); _flashCells('PC', OV_COLORS.teal); _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0); });
          // Mode 2: IO+J = jump — IR operand onto ADDRESS bus, PC loads
          _after(1200, () => { _cuFiresSignals(['IO', 'J']); _setBusActive('addr', true); _showBinaryOnBus(1, 'addr'); _fireComp('IR', OV_COLORS.orange); _spawnPacket('w-ir-db', OV_COLORS.orange, false, 0); _after(200, () => _spawnPacket('w-pc-mar', OV_COLORS.orange, false, 0, true)); });
          _after(1600, () => { _clockPulse(false); });
          _after(1800, () => { _showCompVal('PC', '1'); _flashCells('PC', OV_COLORS.orange); });
          _setLabel('CE+clock → count up (teal) | IO+J → jump via address bus (orange)', OV_COLORS.teal);
        } },
        { text: `That simple choice is the foundation of every loop in every program.`, anim: () => {
          _glowComp('PC'); _glowComp('CU'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('CLK');
          _setBusActive('addr', true); _setBusActive('clk', true);
          _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0);
          _clockPulse(true);
          // Quick looping demo
          _after(0, () => { _showCompVal('PC', '0'); _flashCells('PC', OV_COLORS.teal); });
          _after(500, () => { _showCompVal('PC', '1'); _flashCells('PC', OV_COLORS.teal); });
          _after(1000, () => { _showCompVal('PC', '2'); _flashCells('PC', OV_COLORS.teal); });
          _after(1500, () => { _showCompVal('PC', '0'); _flashCells('PC', OV_COLORS.orange); });
          _setLabel('Count + Jump = loops. Foundation of every program.', OV_COLORS.teal);
        } },
      ]},
    ],
    highlightComponents: [],
  },
  {
    id: 6,
    title: 'Getting a Command',
    pages: [
      // Page 0
      { sentences: [
        { text: `Now we can see the first real action — fetching a command from memory.`, anim: () => { _dimAll(); _fireComp('PC', OV_COLORS.teal); _glowComp('MAR'); _glowComp('RAM'); _glowComp('IR'); _glowComp('CU'); _glowComp('CLK'); _showCompVal('PC', '0'); _setBusActive('addr', true); _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0); _setLabel('FETCH — PC, MAR, RAM, IR all involved', OV_COLORS.teal); } },
        { text: `This happens in two steps.`, dur: 2500, anim: () => { _setLabel('FETCH — 2 steps', OV_COLORS.teal); } },
      ]},
      // Page 1
      { sentences: [
        { text: `Step 1: The PC fires — it glows bright.`, anim: () => { _dimAll(); _cuFiresSignals(['CO', 'MI']); _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('CLK'); _showCompVal('PC', '0'); _fireComp('PC', OV_COLORS.teal); } },
        { text: `Its address travels through the blue address bus.`, anim: () => { _cuFiresSignals(['CO', 'MI']); _fireComp('PC', OV_COLORS.teal); _setBusActive('addr', true); _showBinaryOnBus(0, 'addr'); _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0); _setLabel('Continuous pulse: address 0 streaming PC → bus → MAR', OV_COLORS.teal); } },
        { text: `Watch the bus glow.`, dur: 3500, anim: () => { _cuFiresSignals(['CO', 'MI']); _fireComp('PC', OV_COLORS.teal); _setBusActive('addr', true); _showBinaryOnBus(0, 'addr'); _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0); _clockPulse(true); _setLabel('Pulses flow PC → MAR. Clock beats. Watch the direction.', OV_COLORS.teal); } },
        { text: `The MAR receives the address — its cells flash.`, anim: () => { _cuFiresSignals(['CO', 'MI']); _setBusActive('addr', true); _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0); _receiveComp('MAR', OV_COLORS.blue); _showCompVal('MAR', '0'); _clockPulse(false); _setLabel('Clock beats → MAR latches address 0. PC still driving bus.', OV_COLORS.teal); } },
      ]},
      // Page 2
      { sentences: [
        { text: `Step 2: Now the RAM fires — it glows bright.`, anim: () => { _dimAll(); _cuFiresSignals(['RO', 'II']); _glowComp('RAM'); _glowComp('IR'); _glowComp('PC'); _glowComp('CLK'); _showCompVal('MAR', '0'); _showCompVal('PC', '0'); _fireComp('RAM', OV_COLORS.amber); _setBusActive('addr', true); _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0); } },
        { text: `The command travels through the amber data bus.`, anim: () => { _cuFiresSignals(['RO', 'II', 'CE']); _fireComp('RAM', OV_COLORS.amber); _setBusActive('data', true); _showBinaryOnBus(0x51, 'data'); _spawnPacket('w-ram-ir', OV_COLORS.amber, true, 0); _setLabel('Continuous pulse: instruction streaming RAM → bus → IR', OV_COLORS.amber); } },
        { text: `Watch the bus glow.`, dur: 3500, anim: () => { _cuFiresSignals(['RO', 'II', 'CE']); _fireComp('RAM', OV_COLORS.amber); _setBusActive('data', true); _showBinaryOnBus(0x51, 'data'); _spawnPacket('w-ram-ir', OV_COLORS.amber, true, 0); _clockPulse(true); _setLabel('Pulses flow RAM → IR. Clock beats. Watch the direction.', OV_COLORS.amber); } },
        { text: `The IR receives the command — its cells flash.`, anim: () => { _cuFiresSignals(['RO', 'II', 'CE']); _setBusActive('data', true); _spawnPacket('w-ram-ir', OV_COLORS.amber, true, 0); _receiveComp('IR', OV_COLORS.amber); _showCompVal('IR', 'LDI 5'); _clockPulse(false); _setLabel('Clock beats → IR latches LDI 5. RAM still driving bus.', OV_COLORS.amber); } },
      ]},
      // Page 3
      { sentences: [
        { text: `At the same time, the PC increments by 1.`, anim: () => { _dimAll(); _cuFiresSignals(['RO', 'II', 'CE']); _glowComp('PC'); _glowComp('RAM'); _glowComp('IR'); _showCompVal('PC', '0'); _showCompVal('MAR', '0'); _setBusActive('data', true); _after(500, () => { _flashCells('PC', OV_COLORS.teal); _showCompVal('PC', '1'); }); _setLabel('CE fires alongside RO+II in the same T-state (T1)', OV_COLORS.teal); } },
        { text: `It is already pointing to the next room, ready for the next fetch.`, anim: () => { _showCompVal('PC', '1'); _setLabel('PC=1 — already pointing at next command', OV_COLORS.teal); } },
      ]},
      // Page 4
      { sentences: [
        { text: `Look at the IR.`, dur: 2500, anim: () => { _dimAll(); _glowComp('IR'); _showCompVal('IR', 'LDI 5'); } },
        { text: `It has 8 cells split into two groups.`, anim: () => { const irC = _diagCompEls['IR'] && _diagCompEls['IR'].cells; if(irC) irC.forEach((c,i) => { if(c.rect) { c.rect.setAttribute('fill', i < 4 ? OV_COLORS.red : OV_COLORS.amber); c.rect.setAttribute('opacity','1'); }}); } },
        { text: `The left 4 cells in red are the opcode — WHAT to do.`, anim: () => { _setLabel('Left 4 (red) = OPCODE — what to do', OV_COLORS.red); } },
        { text: `The right 4 in amber are the operand — WHERE or WITH WHAT.`, anim: () => { _setLabel('Right 4 (amber) = OPERAND — with what', OV_COLORS.amber); } },
        { text: `One command = opcode plus operand.`, dur: 3000, anim: () => { _setLabel('OPCODE + OPERAND = one instruction', OV_COLORS.teal); } },
      ]},
    ],
    highlightComponents: [],
  },
  {
    id: 7,
    title: 'Reading the Command',
    pages: [
      // Page 0
      { sentences: [
        { text: `The command is now sitting in the IR.`, anim: () => { _dimAll(); _glowComp('IR'); _glowComp('CU'); _showCompVal('IR', 'LDA'); _lightWire('w-ir-cu', true); } },
        { text: `The CPU needs to figure out what it means.`, anim: () => { _setLabel('DECODE', OV_COLORS.red); } },
      ]},
      // Page 1
      { sentences: [
        { text: `The left 4 cells of the IR — the opcode — are connected directly to the Control Unit through 4 red wires.`, anim: () => { _dimAll(); _glowComp('IR'); _glowComp('CU'); _lightWire('w-ir-cu', true); _showCompVal('IR', 'LDA'); } },
        { text: `These wires are always active.`, anim: () => { _setLabel('4 red opcode wires — always active', OV_COLORS.red); } },
        { text: `The moment a command lands in the IR, the CU can already see it.`, anim: () => { _glowComp('IR'); _glowComp('CU'); _showCompVal('IR', 'LDA'); _lightWire('w-ir-cu', true); _spawnPacket('w-ir-cu', OV_COLORS.red, true, 0); _setLabel('Opcode wires always active — CU sees IR instantly', OV_COLORS.red); } },
      ]},
      // Page 2
      { sentences: [
        { text: `Watch: the red signal travels from the IR to the CU.`, anim: () => { _dimAll(); _glowComp('IR'); _glowComp('CU'); _showCompVal('IR', 'LDA'); _fireComp('IR', OV_COLORS.amber); _after(300, () => _spawnPacket('w-ir-cu', OV_COLORS.red, false, 0)); } },
        { text: `The CU reads those 4 bits and instantly knows what to do.`, anim: () => { _glowComp('CU'); _receiveComp('CU', OV_COLORS.red); _showCompVal('CU', 'DECODE'); _setLabel('CU sees LDA opcode (0001) — instantly decodes it', OV_COLORS.red); } },
        { text: `It turns on the right signals.`, anim: () => { _fireComp('CU', OV_COLORS.red); _dimAllCtrlSignals(); const ldaSigs = ['IO','MI']; ldaSigs.forEach((s, i) => _after(i * 300, () => _lightCtrlSignal(s, true))); _after(700, () => { _dimAllCtrlSignals(); ['RO','AI'].forEach((s, i) => _after(i * 300, () => _lightCtrlSignal(s, true))); }); _setLabel('CU turns on: IO|MI then RO|AI — the LDA microcode', OV_COLORS.red); } },
      ]},
      // Page 3
      { sentences: [
        { text: `Different commands produce different signal patterns.`, anim: () => { _dimAll(); _glowComp('CU'); } },
        { text: `LOAD lights up address and register signals.`, anim: () => { Object.keys(CPU_COMPS).forEach(k => { if(k !== 'CU') _dimComp(k); }); _cuFiresSignals(['IO', 'MI', 'RO', 'AI']); _showCompVal('CU', 'LOAD'); _showCompVal('IR', 'LDA'); _setBusActive('addr', true); _setBusActive('data', true); ['MAR','RAM','REGA','IR'].forEach(t => _receiveComp(t, OV_COLORS.blue)); _setLabel('LOAD → address bus (IO|MI) + data bus (RO|AI)', OV_COLORS.blue); } },
        { text: `ADD lights up ALU signals.`, anim: () => { Object.keys(CPU_COMPS).forEach(k => { if(k !== 'CU') _dimComp(k); }); _cuFiresSignals(['IO', 'MI', 'RO', 'BI', 'EO', 'AI', 'FI']); _showCompVal('CU', 'ADD'); _showCompVal('IR', 'ADD'); _setBusActive('data', true); ['REGB','ALU','REGA','FLAGS'].forEach(t => _receiveComp(t, OV_COLORS.orange)); _setLabel('ADD → data bus carries operand + result. Flags update.', OV_COLORS.orange); } },
        { text: `OUTPUT lights up display signals.`, anim: () => { Object.keys(CPU_COMPS).forEach(k => { if(k !== 'CU') _dimComp(k); }); _cuFiresSignals(['AO', 'OI']); _showCompVal('CU', 'OUT'); _showCompVal('IR', 'OUT'); _setBusActive('data', true); _fireComp('REGA', OV_COLORS.green); _receiveComp('OUT', OV_COLORS.green); _spawnPacket('w-rega-out', OV_COLORS.green, false, 0); _setLabel('OUT → REG A drives bus (AO), Output captures (OI)', OV_COLORS.green); } },
        { text: `Same command always produces the same signals.`, anim: () => { _setLabel('DETERMINISTIC — same input, same signals, always', OV_COLORS.teal); } },
      ]},
    ],
    highlightComponents: [],
  },
  {
    id: 8,
    title: 'The Hands',
    pages: [
      // Page 0
      { sentences: [
        { text: `The CPU needs somewhere to hold the numbers it is currently working with.`, anim: () => { _dimAll(); _glowComp('REGA'); _glowComp('REGB'); } },
        { text: `That is what registers are for.`, anim: () => { _setLabel('REGISTERS — fast on-chip storage', OV_COLORS.purple); } },
      ]},
      // Page 1
      { sentences: [
        { text: `See REG A and REG B?`, anim: () => { _dimAll(); _fireComp('REGA', OV_COLORS.purple); _fireComp('REGB', OV_COLORS.purple); _showCompVal('REGA', '—'); _showCompVal('REGB', '—'); _glowComp('ALU'); _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0); _spawnPacket('w-regb-alu', OV_COLORS.orange, true, 0.2); } },
        { text: `Each one has 8 cells — 8 bits — and can hold one number from 0 to 255.`, anim: () => { _setLabel('8 bits = values 0 to 255', OV_COLORS.purple); } },
        { text: `Think of them as the CPU's hands.`, anim: () => { _setLabel('Memory = shelf. Registers = your hands.', OV_COLORS.purple); } },
        { text: `Memory is the shelf. Registers are where you hold things while working.`, anim: () => { _glowComp('RAM'); _setLabel('RAM = shelf  |  REG A & B = working hands', OV_COLORS.purple); } },
      ]},
      // Page 2
      { sentences: [
        { text: `Watch: a value travels from the data bus into Register A.`, anim: () => { _dimAll(); _cuFiresSignals(['RO', 'AI']); _glowComp('RAM'); _glowComp('MAR'); _glowComp('REGA'); _glowComp('CLK'); _showCompVal('MAR', '0'); _busWrite('RAM', 'w-ram-db', 5, OV_COLORS.amber); _setLabel('CU fires RO+AI → 5 pulses RAM → bus → all doors', OV_COLORS.purple); } },
        { text: `See the 8 amber lines? Each one carries one bit.`, anim: () => { _cuFiresSignals(['RO', 'AI']); _glowComp('RAM'); _glowComp('REGA'); _glowComp('MAR'); _showCompVal('MAR', '0'); _busWrite('RAM', 'w-ram-db', 5, OV_COLORS.amber); _setLabel('8 lines carry 00000101 = 5. Same value everywhere.', OV_COLORS.amber); } },
        { text: `The cells flash as the value arrives.`, dur: 3500, anim: () => { _cuFiresSignals(['RO', 'AI']); _glowComp('RAM'); _glowComp('MAR'); _showCompVal('MAR', '0'); _busWrite('RAM', 'w-ram-db', 5, OV_COLORS.amber); _clockPulse(false); _after(400, () => { _receiveComp('REGA', OV_COLORS.purple); _showCompVal('REGA', '5'); }); _setLabel('Clock beats → REG A latches 00000101 = 5', OV_COLORS.purple); } },
      ]},
      // Page 3
      { sentences: [
        { text: `Register A is special — it connects to the math unit through 8 direct wires that bypass the bus.`, anim: () => { _dimAll(); _dimAllCtrlSignals(); _glowComp('REGA'); _glowComp('REGB'); _glowComp('ALU'); _showCompVal('REGA', '5'); _showCompVal('REGB', '3'); _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0); _spawnPacket('w-regb-alu', OV_COLORS.orange, true, 0.2); _setLabel('Continuous pulses — always flowing, no CU signal needed', OV_COLORS.orange); } },
        { text: `The math unit can always see what Register A holds.`, anim: () => { _fireComp('REGA', OV_COLORS.purple); _glowComp('ALU'); _glowComp('REGB'); _showCompVal('REGA', '5'); _showCompVal('REGB', '3'); _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0); _spawnPacket('w-regb-alu', OV_COLORS.orange, true, 0.3); _setLabel('REG A → continuous pulse → ALU always sees 5', OV_COLORS.orange); } },
        { text: `Same for Register B.`, anim: () => { _fireComp('REGB', OV_COLORS.purple); _glowComp('ALU'); _glowComp('REGA'); _showCompVal('REGA', '5'); _showCompVal('REGB', '3'); _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0); _spawnPacket('w-regb-alu', OV_COLORS.orange, true, 0.2); _setLabel('REG B → continuous pulse → ALU always sees 3', OV_COLORS.orange); } },
      ]},
      // Page 4
      { sentences: [
        { text: `These direct connections are important.`, anim: () => { _dimAll(); _glowComp('REGA'); _glowComp('REGB'); _glowComp('ALU'); _showCompVal('REGA', '5'); _showCompVal('REGB', '3'); _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0); _spawnPacket('w-regb-alu', OV_COLORS.orange, true, 0.2); _setBusActive('data', true); } },
        { text: `The math unit needs both inputs at the same time, but only one component can use the bus at a time.`, anim: () => { _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0); _spawnPacket('w-regb-alu', OV_COLORS.orange, true, 0.2); _setLabel('Bus = one sender only. ALU needs TWO inputs simultaneously.', OV_COLORS.red); } },
        { text: `The direct wires solve this.`, anim: () => { _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0); _spawnPacket('w-regb-alu', OV_COLORS.orange, true, 0.2); _setLabel('Direct wires bypass the bus — both inputs stream continuously', OV_COLORS.orange); } },
      ]},
    ],
    highlightComponents: [],
  },
  {
    id: 9,
    title: 'Doing the Math',
    pages: [
      // Page 0
      { sentences: [
        { text: `Now the part that actually computes — the ALU.`, anim: () => { _dimAll(); _glowComp('REGA'); _glowComp('REGB'); _glowComp('ALU'); _showCompVal('REGA', '5'); _showCompVal('REGB', '3'); _setLabel('REG A = 5 (00000101)  REG B = 3 (00000011)', OV_COLORS.purple); } },
        { text: `See the trapezoid shape? It takes two numbers in and produces one result out.`, anim: () => { _fireComp('ALU', OV_COLORS.orange); _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0); _spawnPacket('w-regb-alu', OV_COLORS.orange, true, 0.2); _spawnPacket('w-alu-bus', OV_COLORS.orange, true, 0.5); _setBusActive('data', true); _setLabel('ALU — two inputs stream in, one result streams out', OV_COLORS.orange); } },
      ]},
      // Page 1
      { sentences: [
        { text: `Watch step 1: Register A sends its value 5 into the ALU through the direct wire on the left.`, anim: () => { _dimAll(); _glowComp('REGA'); _glowComp('REGB'); _glowComp('ALU'); _showCompVal('REGA', '5'); _showCompVal('REGB', '3'); _fireComp('REGA', OV_COLORS.purple); _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0); _setLabel('Continuous pulse: A=5 streaming into ALU left input', OV_COLORS.purple); } },
        { text: `The ALU's A input is ready.`, anim: () => { _glowComp('REGA'); _glowComp('REGB'); _showCompVal('REGA', '5'); _showCompVal('REGB', '3'); _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0); _receiveComp('ALU', OV_COLORS.orange); _showCompVal('ALU', 'A=5'); _setLabel('REG A (5) → continuous pulse → ALU input A ready', OV_COLORS.orange); } },
      ]},
      // Page 2
      { sentences: [
        { text: `Step 2: Register B sends its value 3 through the right side.`, anim: () => { _dimAll(); _glowComp('REGA'); _glowComp('REGB'); _glowComp('ALU'); _showCompVal('REGA', '5'); _showCompVal('REGB', '3'); _fireComp('REGB', OV_COLORS.purple); _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0); _spawnPacket('w-regb-alu', OV_COLORS.orange, true, 0.2); _setLabel('Both inputs streaming: A=5 left, B=3 right', OV_COLORS.orange); } },
        { text: `Both inputs are ready.`, anim: () => { _glowComp('REGA'); _glowComp('REGB'); _glowComp('ALU'); _showCompVal('REGA', '5'); _showCompVal('REGB', '3'); _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0); _spawnPacket('w-regb-alu', OV_COLORS.orange, true, 0.2); _setLabel('Both direct wires streaming — A=5, B=3 → ALU', OV_COLORS.orange); } },
        { text: `The ALU pulses — it is computing.`, anim: () => { _cuFiresSignals(['EO', 'AI', 'FI']); _glowComp('REGA'); _glowComp('REGB'); _glowComp('FLAGS'); _showCompVal('REGA', '5'); _showCompVal('REGB', '3'); _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0); _spawnPacket('w-regb-alu', OV_COLORS.orange, true, 0.2); _fireComp('ALU', OV_COLORS.orange); _showCompVal('ALU', '5+3=8'); _setBusActive('data', true); _setLabel('CU fires EO|AI|FI — inputs stream in, result streams out', OV_COLORS.orange); } },
      ]},
      // Page 3
      { sentences: [
        { text: `Step 3: The result 8 travels from the ALU through the data bus back into Register A.`, anim: () => { _dimAll(); _cuFiresSignals(['EO', 'AI', 'FI']); _glowComp('ALU'); _glowComp('REGA'); _glowComp('REGB'); _glowComp('FLAGS'); _glowComp('CLK'); _showCompVal('REGA', '5'); _showCompVal('REGB', '3'); _showCompVal('ALU', '5+3=8'); _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0); _spawnPacket('w-regb-alu', OV_COLORS.orange, true, 0.15); _after(400, () => { _fireComp('ALU', OV_COLORS.orange); _setBusActive('data', true); _showBinaryOnBus(8, 'data'); }); _after(700, () => { _busWrite('ALU', 'w-alu-bus', 8, OV_COLORS.orange); _spawnPacket('w-alu-flags', OV_COLORS.amber, true, 0.3); }); } },
        { text: `Register A now holds 8 instead of 5.`, anim: () => { _cuFiresSignals(['EO', 'AI', 'FI']); _glowComp('ALU'); _glowComp('FLAGS'); _showBinaryOnBus(8, 'data'); _setBusActive('data', true); _busWrite('ALU', 'w-alu-bus', 8, OV_COLORS.orange); _clockPulse(false); _after(400, () => { _receiveComp('REGA', OV_COLORS.orange); _showCompVal('REGA', '8'); _receiveComp('FLAGS', OV_COLORS.amber); _showCompVal('FLAGS', 'CF=0 ZF=0'); }); _setLabel('Clock beats → A latches 8, Flags update. 00001000', OV_COLORS.green); } },
      ]},
      // Page 4
      { sentences: [
        { text: `Two small wires go down to the Flags register.`, anim: () => { _dimAll(); _cuFiresSignals(['FI']); _glowComp('ALU'); _glowComp('FLAGS'); _glowComp('REGA'); _showCompVal('ALU', '5+3=8'); _showCompVal('REGA', '8'); _spawnPacket('w-alu-flags', OV_COLORS.amber, true, 0); } },
        { text: `The Carry Flag turns on if the result overflows.`, anim: () => { _glowComp('ALU'); _glowComp('FLAGS'); _showCompVal('FLAGS', 'CF=0 ZF=0'); _spawnPacket('w-alu-flags', OV_COLORS.amber, true, 0); _flashCells('FLAGS', OV_COLORS.amber); _setLabel('CF = Carry Flag — ALU streams flag result to FLAGS register', OV_COLORS.amber); } },
        { text: `The Zero Flag turns on if the result is zero.`, anim: () => { _setLabel('ZF = Zero Flag (result is zero)', OV_COLORS.amber); } },
        { text: `These flags let the CPU make decisions — like if the result was zero, jump somewhere else.`, anim: () => {
          _glowComp('IR'); _glowComp('PC'); _glowComp('ALU');
          _flashCells('FLAGS', OV_COLORS.amber);
          _lightWire('w-flags-cu', true);
          _spawnPacket('w-flags-cu', OV_COLORS.amber, false, 0);
          _after(400, () => { _receiveComp('CU', OV_COLORS.red); });
          // CU fires IO+J: IR operand → address bus → PC loads
          _after(700, () => { _cuFiresSignals(['IO', 'J']); _setBusActive('addr', true); _fireComp('IR', OV_COLORS.orange); _spawnPacket('w-ir-db', OV_COLORS.orange, false, 0); _after(200, () => _spawnPacket('w-pc-mar', OV_COLORS.orange, false, 0, true)); });
          _after(1100, () => { _flashCells('PC', OV_COLORS.orange); _showCompVal('PC', '0'); });
          _setLabel('FLAGS → CU → IO+J → IR operand on address bus → PC jumps', OV_COLORS.amber);
        } },
      ]},
    ],
    highlightComponents: [],
  },
  {
    id: 10,
    title: 'The Roads',
    pages: [
      // Page 0 — Data bus: highlight each line one by one
      { sentences: [
        { text: `See the amber horizontal lines running across the middle?`, dur: 4500, anim: () => {
          _dimAll();
          // Light up data bus lines one at a time (8 × 300ms = 2400ms + viewing buffer)
          const dataBusEls = _diagBusEls['data'] || [];
          dataBusEls.forEach((el, i) => {
            _after(i * 300, () => {
              el.setAttribute('stroke', OV_COLORS.amber);
              el.setAttribute('stroke-width', '3');
              el.setAttribute('opacity', '1');
              el.setAttribute('filter', 'url(#bus-glow)');
            });
          });
        }},
        { text: `Count them — there are 8.`, dur: 2500, anim: () => {
          _setBusActive('data', true);
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _setLabel('D0, D1, D2, D3, D4, D5, D6, D7 — eight lines, one per bit', OV_COLORS.amber);
        }},
        { text: `That is the data bus. One line per bit. Every value moves on these lines.`, anim: () => {
          // Show data packets flowing on the data bus
          _spawnPacket('w-bus-rega', OV_COLORS.amber, false, 0);
          _spawnPacket('w-ram-db', OV_COLORS.amber, false, 0.2);
          _spawnPacket('w-alu-bus', OV_COLORS.amber, false, 0.4);
          _setLabel('DATA BUS — all values travel on these 8 lines', OV_COLORS.amber);
        }},
      ]},
      // Page 1 — Address bus and clock
      { sentences: [
        { text: `Below them, the blue lines — 4 of them — are the address bus. Room numbers travel here.`, anim: () => {
          _dimAll(); _setBusActive('data', true);
          // Light up address bus lines one at a time
          const addrBusEls = _diagBusEls['addr'] || [];
          addrBusEls.forEach((el, i) => {
            _after(i * 300, () => {
              el.setAttribute('stroke', OV_COLORS.blue);
              el.setAttribute('stroke-width', '3');
              el.setAttribute('opacity', '1');
              el.setAttribute('filter', 'url(#bus-glow)');
            });
          });
          _spawnPacket('w-pc-mar', OV_COLORS.blue, false, 0.5);
          _setLabel('ADDRESS BUS — 4 lines (A0–A3). Room numbers travel here.', OV_COLORS.blue);
        }},
        { text: `At the top, the green dashed line is the clock.`, anim: () => {
          _setBusActive('clk', true);
          _spawnPacket('w-clk-h', OV_COLORS.green, false, 0);
          _setLabel('3 buses: DATA (amber, 8) | ADDRESS (blue, 4) | CLOCK (green)', OV_COLORS.teal);
        }},
      ]},
      // Page 2 — One sender rule with tri-state demo
      { sentences: [
        { text: `The important rule: only ONE part can send on a bus at any time.`, anim: () => {
          _dimAll();
          _glowComp('RAM'); _glowComp('REGA');
          _setBusActive('data', true);
          _setLabel('RULE: only ONE sender at a time', OV_COLORS.red);
        }},
        { text: `See the small triangles between components and the bus? Those are switches.`, anim: () => {
          _glowComp('RAM'); _glowComp('REGA'); _glowComp('ALU'); _glowComp('IR');
          _setBusActive('data', true);
          _setLabel('▷ = tri-state buffer = switch. Controls who talks on the bus.', OV_COLORS.amber);
        }},
        { text: `When a component is allowed to send, its switch opens. Otherwise it is disconnected.`, anim: () => {
          // CU fires RO+AI to open RAM's output switch and REGA's input
          _cuFiresSignals(['RO', 'AI']);
          _glowComp('MAR'); _showCompVal('MAR', '0');
          _after(400, () => {
            _fireComp('RAM', OV_COLORS.amber);
            _setBusActive('data', true);
            _showBinaryOnBus(42, 'data');
            // Continuous directional pulses: RAM → bus → REGA
            _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          });
          _after(1400, () => {
            _clockPulse(false);
            _receiveComp('REGA', OV_COLORS.purple);
            _showCompVal('REGA', '42');
          });
          _setLabel('RO+AI → RAM switch opens, pulses stream → clock → REG A latches', OV_COLORS.amber);
        }},
      ]},
      // Page 3 — Contention demo
      { sentences: [
        { text: `The Control Unit makes sure only one switch is open at a time.`, anim: () => {
          _dimAll(); _glowComp('CU');
          _fireComp('CU', OV_COLORS.red);
          _setBusActive('data', true);
          _setLabel('CU controls every switch — only opens one at a time', OV_COLORS.red);
        }},
        { text: `That is why the timing matters.`, anim: () => {
          _glowComp('CU'); _glowComp('RAM'); _glowComp('MAR');
          _cuFiresSignals(['RO']);
          _clockPulse(true);
          _fireComp('RAM', OV_COLORS.amber);
          _setBusActive('data', true);
          _spawnPacket('w-ram-db', OV_COLORS.amber, true, 0);
          _setLabel('CU + clock in lockstep — only RAM may pulse onto bus', OV_COLORS.red);
        }},
        { text: `Two senders at once would produce garbage.`, anim: () => {
          _dimAll();
          _fireComp('RAM', OV_COLORS.red);
          _fireComp('ALU', OV_COLORS.red);
          _setBusActive('data', true);
          // Make the bus flash red to show contention
          const dataBusEls = _diagBusEls['data'] || [];
          dataBusEls.forEach(el => {
            el.setAttribute('stroke', OV_COLORS.red);
            el.setAttribute('stroke-width', '4');
          });
          // Both sources pulsing simultaneously — collision!
          _spawnPacket('w-ram-db', OV_COLORS.red, true, 0);
          _spawnPacket('w-alu-bus', OV_COLORS.red, true, 0);
          _setLabel('BUS CONTENTION! Two senders = garbage!', OV_COLORS.red);
        }},
      ]},
      // Page 4 — Components ignore bus data unless CU says so
      { sentences: [
        { text: `You might wonder — if all components are connected to the same bus, why don't they all read the data at the same time?`, anim: () => {
          _dimAll();
          _glowComp('RAM'); _glowComp('REGA'); _glowComp('REGB'); _glowComp('IR'); _glowComp('OUT'); _glowComp('ALU');
          _setBusActive('data', true);
          _showBinaryOnBus(42, 'data');
          _placeWaitingData('REGA', '42', OV_COLORS.amber);
          _placeWaitingData('REGB', '42', OV_COLORS.amber);
          _placeWaitingData('IR', '42', OV_COLORS.amber);
          _placeWaitingData('OUT', '42', OV_COLORS.amber);
          _placeWaitingData('ALU', '42', OV_COLORS.amber);
          _setLabel('42 is on the bus. Every component sees it. But...', OV_COLORS.amber);
        }},
        { text: `The answer is simple — a component will not capture data from the bus unless the Control Unit gives it permission.`, anim: () => {
          _cuFiresSignals(['RO', 'AI']);
          _removeWaitingDataFor('REGB');
          _removeWaitingDataFor('IR');
          _removeWaitingDataFor('OUT');
          _removeWaitingDataFor('ALU');
          _placeWaitingData('REGA', '42', OV_COLORS.green);
          _placeWaitingData('REGB', '42', '#332200');
          _placeWaitingData('IR', '42', '#332200');
          _placeWaitingData('OUT', '42', '#332200');
          _placeWaitingData('ALU', '42', '#332200');
          _setLabel('Only AI is ON → only REG A has permission. Others ignore.', OV_COLORS.red);
        }},
        { text: `Even if the data is right there at the door, without the CU signal and the clock beat, nothing gets captured.`, anim: () => {
          // Show data flowing but nothing latching — bus active, data at doors, but no signals, no clock
          _dimAllCtrlSignals();
          _glowComp('RAM'); _glowComp('REGA'); _glowComp('REGB'); _glowComp('IR');
          _setBusActive('data', true); _showBinaryOnBus(42, 'data');
          _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber);
          _placeWaitingData('REGA', '42', '#332200');
          _placeWaitingData('REGB', '42', '#332200');
          _dimComp('CLK'); _dimComp('CU');
          _setBusActive('clk', false);
          _setLabel('Data streams past — no signal, no clock = nothing captured', OV_COLORS.red);
        }},
      ]},
      // Page 5 — The exceptions
      { sentences: [
        { text: `There are two exceptions where connections are always active — no signal needed.`, anim: () => {
          _dimAll();
          _setLabel('EXCEPTIONS — always-on connections', OV_COLORS.teal);
        }},
        { text: `First — the MAR to RAM address connection. It is hardwired. Whatever address the MAR holds, RAM always sees it. No signal, no clock.`, anim: () => {
          _glowComp('MAR'); _glowComp('RAM');
          _showCompVal('MAR', '3');
          _setBusActive('addr', true);
          _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0);
          _setLabel('MAR → RAM: continuous pulse, always active, no CU needed', OV_COLORS.teal);
        }},
        { text: `Second — the Register A and Register B direct wires to the ALU. The ALU always sees both register values. No signal needed.`, anim: () => {
          _glowComp('REGA'); _glowComp('REGB'); _glowComp('ALU');
          _showCompVal('REGA', '5'); _showCompVal('REGB', '3');
          _spawnPacket('w-rega-alu', OV_COLORS.orange, false, 0);
          _spawnPacket('w-regb-alu', OV_COLORS.orange, false, 0.2);
          _setLabel('REG A/B → ALU: DIRECT wires. Always active. No CU needed.', OV_COLORS.orange);
        }},
        { text: `Third — the IR opcode wires to the CU. The CU always sees the opcode. That is how it knows which recipe to follow.`, anim: () => {
          _glowComp('IR'); _glowComp('CU');
          _lightWire('w-ir-cu', true);
          _spawnPacket('w-ir-cu', OV_COLORS.red, false, 0);
          _setLabel('IR opcode → CU: ALWAYS active. CU always sees the command.', OV_COLORS.red);
        }},
      ]},
      // Page 6 — Future series teaser
      { sentences: [
        { text: `How do these protections work at the circuit level? How does a tri-state buffer physically disconnect a wire? How does the CU recipe table get built?`, anim: () => {
          _dimAll();
          Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          _setBusActive('data', true); _setBusActive('addr', true); _setBusActive('ctrl', true);
          _setLabel('Deeper questions — how does the hardware actually do this?', OV_COLORS.teal);
        }},
        { text: `We will cover all of that in a future series where we go inside each component and build it from transistors and logic gates.`, anim: () => {
          _setLabel('Coming next: inside each component — transistors, gates, and circuits', OV_COLORS.green);
        }},
        { text: `For now, just remember: nothing moves on the bus without the CU giving permission and the clock beating.`, anim: () => {
          _cuFiresSignals(['RO', 'AI']);
          _fireComp('CLK', OV_COLORS.green);
          _setBusActive('clk', true);
          _setLabel('CU permission + clock beat = data moves. Otherwise, nothing.', OV_COLORS.green);
        }},
      ]},
    ],
    highlightComponents: [],
  },
  {
    id: 11,
    title: 'The Output',
    pages: [
      // Page 0
      { sentences: [
        { text: `After the CPU does its work, it needs to show the result.`, anim: () => { _dimAll(); _glowComp('REGA'); _glowComp('OUT'); _setBusActive('data', true); _showCompVal('REGA', '8'); } },
        { text: `That is the Output Display — see it at the top right?`, anim: () => { _fireComp('OUT', OV_COLORS.green); _setLabel('OUTPUT DISPLAY', OV_COLORS.green); } },
      ]},
      // Page 1
      { sentences: [
        { text: `Watch: Register A fires its value onto the data bus.`, anim: () => { _dimAll(); _cuFiresSignals(['AO', 'OI']); _glowComp('REGA'); _glowComp('OUT'); _glowComp('CLK'); _fireComp('REGA', OV_COLORS.purple); _setBusActive('data', true); _showCompVal('REGA', '8'); _showBinaryOnBus(8, 'data'); _busWrite('REGA', 'w-rega-out', 8, OV_COLORS.green); } },
        { text: `The bus glows.`, dur: 3500, anim: () => { _cuFiresSignals(['AO', 'OI']); _glowComp('REGA'); _glowComp('OUT'); _fireComp('REGA', OV_COLORS.purple); _setBusActive('data', true); _showBinaryOnBus(8, 'data'); _showCompVal('REGA', '8'); _spawnPacket('w-rega-out', OV_COLORS.green, false, 0); _spawnPacket('w-out', OV_COLORS.green, false, 0.45); _placeWaitingData('OUT', '8', OV_COLORS.green); _setLabel('AO|OI active — 8 = 00001000 on the bus, arriving at Output door', OV_COLORS.green); } },
        { text: `The Output receives it and displays the number.`, dur: 3500, anim: () => { _cuFiresSignals(['AO', 'OI']); _glowComp('REGA'); _glowComp('CLK'); _setBusActive('data', true); _showBinaryOnBus(8, 'data'); _showCompVal('REGA', '8'); _setBusActive('clk', true); _after(300, () => _fireComp('CLK', OV_COLORS.green)); _after(600, () => { _receiveComp('OUT', OV_COLORS.green); _showCompVal('OUT', '8'); const d = _diagCompEls['OUT'] && _diagCompEls['OUT'].dispLbl; if(d) { d.textContent = '8'; d.setAttribute('opacity','1'); } _setLabel('Clock beats → Output latches 8. Display shows: 8', OV_COLORS.green); }); } },
      ]},
    ],
    highlightComponents: [],
  },
  {
    id: 12,
    title: 'Putting It All Together',
    pages: [
      // Page 0
      { sentences: [
        { text: `Now watch the CPU run a real program from start to finish.`, anim: () => { Object.keys(CPU_COMPS).forEach(k => _glowComp(k)); _setBusActive('data', true); _setBusActive('addr', true); _setBusActive('clk', true); _clockPulse(true); _showCompVal('PC', '0'); _showBinaryInRAMRow(0, 0x51, OV_COLORS.amber); _showBinaryInRAMRow(1, 0x2E, OV_COLORS.amber); _showBinaryInRAMRow(2, 0xE0, OV_COLORS.green); } },
        { text: `The program: take 5, add 3, show the result.`, anim: () => { _setLabel('Program: LDI 5 | ADD mem[14]=3 | OUT', OV_COLORS.teal); } },
      ]},
      // Page 1 — Command 1: Load 5
      { sentences: [
        { text: `Command 1 — Load 5: The CPU fetches from room 0.`, anim: () => { _dimAll(); _cuFiresSignals(['CO', 'MI']); _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _setBusActive('addr', true); _showCompVal('PC', '0'); _after(400, () => { _fireComp('PC', OV_COLORS.teal); _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0); }); _after(900, () => { _receiveComp('MAR', OV_COLORS.blue); _showCompVal('MAR', '0'); }); _setLabel('T0: CO|MI — PC fires address 0, MAR captures', OV_COLORS.teal); } },
        { text: `The command says: put 5 into Register A.`, anim: () => { _dimAll(); _cuFiresSignals(['RO', 'II', 'CE']); _glowComp('RAM'); _glowComp('IR'); _glowComp('PC'); _glowComp('MAR'); _showCompVal('MAR', '0'); _setBusActive('data', true); _after(400, () => { _fireComp('RAM', OV_COLORS.amber); _showBinaryOnBus(0x51, 'data'); _spawnPacket('w-ram-ir', OV_COLORS.amber, false, 0); }); _after(800, () => { _flashCells('PC', OV_COLORS.teal); _showCompVal('PC', '1'); }); _after(1100, () => { _receiveComp('IR', OV_COLORS.amber); _showCompVal('IR', 'LDI 5'); }); _setLabel('T1: MAR=0 → RAM fires, IR captures, PC→1', OV_COLORS.amber); } },
        { text: `Watch: PC fires, MAR receives, RAM fires, IR receives.`, dur: 4500, anim: () => {
          // Complete fetch replay — every step visible (chain up to 1400ms)
          _dimAll(); _cuFiresSignals(['CO', 'MI']);
          _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('IR');
          _setBusActive('addr', true); _showCompVal('PC', '0');
          _after(200, () => { _fireComp('PC', OV_COLORS.teal); _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0); });
          _after(600, () => { _receiveComp('MAR', OV_COLORS.blue); _showCompVal('MAR', '0'); });
          _after(900, () => { _cuFiresSignals(['RO', 'II']); _setBusActive('addr', false); _setBusActive('data', true); _fireComp('RAM', OV_COLORS.amber); _spawnPacket('w-ram-ir', OV_COLORS.amber, false, 0); });
          _after(1400, () => { _receiveComp('IR', OV_COLORS.amber); _showCompVal('IR', 'LDI 5'); });
          _setLabel('FETCH: PC fires → MAR receives → RAM fires → IR receives', OV_COLORS.teal);
        } },
        { text: `IR sends 5 into Register A.`, dur: 3500, anim: () => { Object.keys(CPU_COMPS).forEach(k => _dimComp(k)); _cuFiresSignals(['IO', 'AI']); _glowComp('IR'); _glowComp('REGA'); _setBusActive('data', true); _showCompVal('IR', 'LDI 5'); _after(400, () => _spawnPacket('w-bus-rega', OV_COLORS.purple, false, 0)); _after(1100, () => { _receiveComp('REGA', OV_COLORS.purple); _showCompVal('REGA', '5'); }); _setLabel('T2: IO|AI — CU orders IR operand out, REG A in. A = 5.', OV_COLORS.purple); } },
        { text: `Register A now holds 5.`, dur: 2500, anim: () => { _showCompVal('REGA', '5'); _setLabel('A = 5', OV_COLORS.purple); } },
      ]},
      // Page 2 — Command 2: Add
      { sentences: [
        { text: `Command 2 — Add: The CPU fetches from room 1.`, anim: () => { _dimAll(); _cuFiresSignals(['CO', 'MI']); _glowComp('PC'); _glowComp('MAR'); _setBusActive('addr', true); _showCompVal('PC', '1'); _showCompVal('REGA', '5'); _after(400, () => _fireComp('PC', OV_COLORS.teal)); _after(400, () => _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0)); _setLabel('Command 2 — ADD: T0: CO|MI — CU orders PC out + MAR in', OV_COLORS.teal); } },
        { text: `The command says: add the value at room 14 to Register A.`, anim: () => { Object.keys(CPU_COMPS).forEach(k => _dimComp(k)); _cuFiresSignals(['RO', 'II', 'CE']); _glowComp('RAM'); _glowComp('IR'); _glowComp('PC'); _setBusActive('addr', false); _setBusActive('data', true); _showCompVal('PC', '2(+)'); _showCompVal('RAM', 'ADD 14'); _showCompVal('REGA', '5'); _after(400, () => _fireComp('RAM', OV_COLORS.amber)); _after(400, () => _spawnPacket('w-ram-ir', OV_COLORS.amber, false, 0)); _after(1100, () => { _receiveComp('IR', OV_COLORS.amber); _showCompVal('IR', 'ADD 14'); }); _setLabel('T1: RO|II|CE — CU orders RAM out, IR in, PC increment', OV_COLORS.amber); } },
      ]},
      // Page 3 — ADD execution
      { sentences: [
        { text: `First, the address 14 goes to the MAR.`, dur: 3500, anim: () => { _dimAll(); _cuFiresSignals(['IO', 'MI']); _glowComp('IR'); _glowComp('MAR'); _glowComp('RAM'); _setBusActive('addr', true); _showCompVal('IR', 'ADD 14'); _showCompVal('REGA', '5'); _fireComp('IR', OV_COLORS.amber); _after(400, () => _spawnPacket('w-ir-db', OV_COLORS.blue, false, 0)); _after(1100, () => { _receiveComp('MAR', OV_COLORS.blue); _showCompVal('MAR', '5'); }); _setLabel('T2: IO|MI — IR outputs operand 14, MAR captures address.', OV_COLORS.blue); } },
        { text: `Then RAM opens room 14 and sends the value 3 to Register B.`, anim: () => { _dimAll(); _cuFiresSignals(['RO', 'BI']); _glowComp('RAM'); _glowComp('REGB'); _glowComp('MAR'); _showCompVal('MAR', '5'); _setBusActive('data', true); _showCompVal('REGA', '5'); _after(400, () => { _fireComp('RAM', OV_COLORS.amber); _showBinaryOnBus(3, 'data'); }); _after(400, () => _spawnPacket('w-bus-regb', OV_COLORS.purple, false, 0)); _after(1100, () => { _receiveComp('REGB', OV_COLORS.purple); _showCompVal('REGB', '3'); }); _setLabel('T3: RO|BI — MAR=5, RAM outputs 3, REG B captures.', OV_COLORS.purple); } },
        { text: `Register B now holds 3.`, dur: 2500, anim: () => { _showCompVal('REGB', '3'); _setLabel('B = 3', OV_COLORS.purple); } },
      ]},
      // Page 4 — ALU compute
      { sentences: [
        { text: `The ALU computes: 5 + 3 = 8.`, dur: 4000, anim: () => { _dimAll(); _cuFiresSignals(['EO', 'AI', 'FI']); _glowComp('REGA'); _glowComp('REGB'); _glowComp('ALU'); _glowComp('FLAGS'); _showCompVal('REGA', '5'); _showCompVal('REGB', '3'); _spawnPacket('w-rega-alu', OV_COLORS.orange, false, 0); _spawnPacket('w-regb-alu', OV_COLORS.orange, false, 0.15); _after(400, () => { _fireComp('ALU', OV_COLORS.orange); _showCompVal('ALU', '5+3=8'); _setBusActive('data', true); }); _after(800, () => { _showBinaryOnBus(8, 'data'); _spawnPacket('w-alu-bus', OV_COLORS.orange, false, 0); _spawnPacket('w-alu-rega', OV_COLORS.orange, false, 0.25); _spawnPacket('w-alu-flags', OV_COLORS.amber, false, 0.45); }); _setLabel('A=5, B=3 feed ALU → EO|AI|FI → result 8 onto bus', OV_COLORS.orange); } },
        { text: `The result travels back to Register A.`, dur: 3000, anim: () => { _after(700, () => { _receiveComp('REGA', OV_COLORS.orange); _showCompVal('REGA', '8'); }); } },
        { text: `Register A now holds 8. The flags update.`, dur: 3000, anim: () => { _after(300, () => { _flashCells('FLAGS', OV_COLORS.amber); _showCompVal('FLAGS', 'CF=0 ZF=0'); _setLabel('A = 8  |  CF=0  |  ZF=0', OV_COLORS.orange); }); } },
      ]},
      // Page 5 — Command 3: Output
      { sentences: [
        { text: `Command 3 — Output: The CPU fetches from room 2.`, anim: () => { _dimAll(); _cuFiresSignals(['CO', 'MI']); _glowComp('PC'); _glowComp('MAR'); _setBusActive('addr', true); _showCompVal('PC', '2'); _showCompVal('REGA', '8'); _after(400, () => _fireComp('PC', OV_COLORS.teal)); _after(400, () => _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0)); _setLabel('Command 3 — OUT: T0: CO|MI — CU orders PC out + MAR in', OV_COLORS.teal); } },
        { text: `The command says: show Register A.`, dur: 4000, anim: () => { Object.keys(CPU_COMPS).forEach(k => _dimComp(k)); _cuFiresSignals(['AO', 'OI']); _glowComp('REGA'); _glowComp('OUT'); _setBusActive('data', true); _showCompVal('REGA', '8'); _after(400, () => _fireComp('REGA', OV_COLORS.purple)); _after(400, () => _spawnPacket('w-rega-out', OV_COLORS.green, false, 0)); _after(400, () => _spawnPacket('w-out', OV_COLORS.green, false, 0.45)); _after(1300, () => { _receiveComp('OUT', OV_COLORS.green); _showCompVal('OUT', '8'); const d = _diagCompEls['OUT'] && _diagCompEls['OUT'].dispLbl; if(d) { d.textContent = '8'; d.setAttribute('opacity','1'); } }); _setLabel('T2: AO|OI — CU orders REG A out, Output in', OV_COLORS.green); } },
        { text: `The value 8 travels to the display.`, dur: 2500, anim: () => { _glowComp('REGA'); _glowComp('OUT'); _fireComp('REGA', OV_COLORS.purple); _setBusActive('data', true); _showBinaryOnBus(8, 'data'); _busWrite('REGA', 'w-rega-out', 8, OV_COLORS.green); _showCompVal('OUT', '8'); _setLabel('8 streams from REG A → bus → Output display', OV_COLORS.green); } },
      ]},
      // Page 6 — Summary
      { sentences: [
        { text: `Three commands.`, dur: 2500, anim: () => { Object.keys(CPU_COMPS).forEach(k => _glowComp(k)); _setBusActive('data', true); _setBusActive('addr', true); _setLabel('3 commands', OV_COLORS.teal); } },
        { text: `Eleven clock beats.`, dur: 3000, anim: () => { _glowComp('CLK'); _fireComp('CLK', OV_COLORS.green); _setBusActive('clk', true); ['w-clk-h','w-clk-pc','w-clk-cu','w-clk-ram','w-clk-ir'].forEach((id, i) => _spawnPacket(id, OV_COLORS.green, false, i * 0.12)); _setLabel('11 clock beats — CLK fires 11 times total', OV_COLORS.green); } },
        { text: `One result: 8.`, dur: 2500, anim: () => { _showCompVal('OUT', '8'); const d = _diagCompEls['OUT'] && _diagCompEls['OUT'].dispLbl; if(d) { d.textContent = '8'; d.setAttribute('opacity','1'); } _setLabel('Result: 8', OV_COLORS.green); } },
        { text: `That is a complete program.`, dur: 3500, anim: () => { _setLabel('3 commands | 11 clock beats | Result: 8', OV_COLORS.green); } },
      ]},
    ],
    highlightComponents: [],
    showAll: true,
    showCycleAnimation: true,
  },
  {
    id: 13,
    title: 'Adding Two Numbers',
    pages: [
      // Page 0 — The program in RAM
      { sentences: [
        { text: `Let us run a real program. The goal: add 3 and 5, then show the result.`, dur: 4000, anim: () => {
          _dimAll(); Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          _showCompVal('PC', '0');
          _setLabel('Program: 3 + 5 = ? Four instructions in RAM.', OV_COLORS.teal);
        }},
        { text: `Here is the program. The first number 3 is at address 1 — it is the immediate value loaded by LDI. The second number 5 is at address 6 — it is the data that ADD will read.`, dur: 7000, anim: () => {
          _dimAll(); _fireComp('RAM', OV_COLORS.amber); _glowComp('PC'); _glowComp('MAR');
          _showCompVal('PC', '0'); _showCompVal('MAR', '0');
          _showBinaryInRAMRow(0, 0x05, OV_COLORS.amber);
          _showBinaryInRAMRow(1, 0x03, OV_COLORS.purple);
          _showBinaryInRAMRow(2, 0x02, OV_COLORS.amber);
          _showBinaryInRAMRow(3, 0x06, OV_COLORS.amber);
          _showBinaryInRAMRow(4, 0x0E, OV_COLORS.green);
          _showBinaryInRAMRow(5, 0x0F, OV_COLORS.red);
          _showBinaryInRAMRow(6, 0x05, OV_COLORS.purple);
          _setLabel('[0]LDI [1]3←first [2]ADD [3]addr6 [4]OUT [5]HLT [6]5←second', OV_COLORS.amber);
        }},
      ]},
      // Page 1 — Instruction 1: LDI 3
      { sentences: [
        { text: `Instruction 1: LDI 3 — load the number 3 directly into Register A. The 3 is right there in the next byte.`, dur: 4000, anim: () => {
          _dimAll(); Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          _showCompVal('PC', '0');
          _setLabel('LDI 3 — load immediate value 3 into A', OV_COLORS.teal);
        }},
        { text: `T0. Clock beats. CU fires CO and MI. PC=0 goes to MAR. RAM row 0 lights up.`, dur: 4500, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('CLK'); _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM');
          _showCompVal('CU', 'T0');
          _cuFiresSignals(['CO', 'MI']);
          _fireComp('PC', OV_COLORS.teal); _showCompVal('PC', '0');
          _setBusActive('addr', true);
          _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0);
          _after(600, () => { _receiveComp('MAR', OV_COLORS.blue); _showCompVal('MAR', '0'); });
          _setLabel('T0: CO+MI → PC=0 → address bus → MAR=0 → row 0', OV_COLORS.teal);
        }},
        { text: `T1. CU fires RO, II, CE. RAM row 0 holds 00000101 — the LDI opcode. It fires onto the data bus. Every door sees it. Only IR captures. PC counts to 1.`, dur: 6000, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('CLK'); _glowComp('RAM'); _glowComp('IR');
          _glowComp('REGA'); _glowComp('REGB'); _glowComp('OUT'); _glowComp('PC');
          _showCompVal('CU', 'T1'); _showCompVal('MAR', '0');
          _cuFiresSignals(['RO', 'II', 'CE']);
          _busWrite('RAM', 'w-ram-db', 5, OV_COLORS.amber);
          _after(600, () => { _busWaitingAtDoors(5, 'IR'); });
          _after(1200, () => { _removeWaitingData(); _receiveComp('IR', OV_COLORS.amber); _showCompVal('IR', '5'); _showCompVal('PC', '1'); });
          _setLabel('T1: RO+II+CE → opcode 5 (LDI) → all doors → IR captures → PC=1', OV_COLORS.amber);
        }},
        { text: `T2. CU fires CO and MI. PC=1 goes to MAR. RAM row 1 lights up. This row holds the immediate value — the number 3.`, dur: 4500, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('CLK'); _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('IR');
          _showCompVal('CU', 'T2'); _showCompVal('IR', 'LDI');
          _cuFiresSignals(['CO', 'MI']);
          _fireComp('PC', OV_COLORS.teal); _showCompVal('PC', '1');
          _setBusActive('addr', true);
          _spawnPacket('w-pc-mar', OV_COLORS.teal, true, 0);
          _after(600, () => { _receiveComp('MAR', OV_COLORS.blue); _showCompVal('MAR', '1'); });
          _setLabel('T2: CO+MI → PC=1 → MAR=1 → row 1 (holds the number 3)', OV_COLORS.teal);
        }},
        { text: `T3. CU fires RO, AI, CE. RAM row 1 fires 00000011 — the number 3. It goes to every door. Only Register A captures. A=3. PC=2.`, dur: 6000, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('CLK'); _glowComp('RAM'); _glowComp('IR');
          _glowComp('REGA'); _glowComp('REGB'); _glowComp('OUT'); _glowComp('PC');
          _showCompVal('CU', 'T3'); _showCompVal('MAR', '1'); _showCompVal('IR', 'LDI');
          _cuFiresSignals(['RO', 'AI', 'CE']);
          _busWrite('RAM', 'w-ram-db', 3, OV_COLORS.amber);
          _after(600, () => { _busWaitingAtDoors(3, 'REGA'); });
          _after(1200, () => { _removeWaitingData(); _receiveComp('REGA', OV_COLORS.purple); _showCompVal('REGA', '3'); _showCompVal('PC', '2'); });
          _setLabel('T3: RO+AI+CE → 00000011=3 → all doors → A captures → A=3', OV_COLORS.purple);
        }},
        { text: `Register A now holds 3 — the first number. Step counter resets. Next instruction.`, dur: 3000, anim: () => {
          _dimAll(); Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          _showCompVal('REGA', '3'); _showCompVal('PC', '2'); _showCompVal('CU', 'T0');
          _setLabel('A=3. Reset to T0. Fetch next.', OV_COLORS.green);
        }},
      ]},
      // Page 2 — Instruction 2: ADD 6
      { sentences: [
        { text: `Instruction 2: ADD 6 — add the value stored at RAM address 6 to Register A. Address 6 holds the second number: 5.`, dur: 4500, anim: () => {
          _dimAll(); Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          _showCompVal('REGA', '3'); _showCompVal('PC', '2');
          _showBinaryInRAMRow(6, 5, OV_COLORS.purple);
          _setLabel('ADD 6: A = A + RAM[6]. A=3, RAM[6]=5.', OV_COLORS.orange);
        }},
        { text: `T0 and T1: Fetch. PC=2 fires. MAR=2. RAM row 2 fires the ADD opcode 00000010. IR captures. PC becomes 3.`, dur: 5000, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('CLK'); _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('IR');
          _showCompVal('REGA', '3');
          _showCompVal('CU', 'T0');
          _cuFiresSignals(['CO', 'MI']);
          _fireComp('PC', OV_COLORS.teal); _showCompVal('PC', '2');
          _setBusActive('addr', true);
          _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0);
          _after(500, () => { _showCompVal('MAR', '2'); _showCompVal('CU', 'T1'); _cuFiresSignals(['RO', 'II', 'CE']); _busWrite('RAM', 'w-ram-db', 2, OV_COLORS.amber); });
          _after(1000, () => { _receiveComp('IR', OV_COLORS.amber); _showCompVal('IR', '2'); _showCompVal('PC', '3'); });
          _setLabel('T0+T1: Fetch opcode 00000010=ADD. IR=ADD. PC=3.', OV_COLORS.teal);
        }},
        { text: `T2 and T3: Fetch the operand. PC=3 fires. MAR=3. RAM row 3 holds the byte 00000110 which is the number 6. But this is not the data — it is the ADDRESS where the data lives. So 6 goes into MAR. MAR=6. RAM row 6 lights up.`, dur: 7000, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('CLK'); _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('IR');
          _showCompVal('REGA', '3'); _showCompVal('IR', 'ADD');
          _showCompVal('CU', 'T2');
          _cuFiresSignals(['CO', 'MI']);
          _fireComp('PC', OV_COLORS.teal); _showCompVal('PC', '3');
          _setBusActive('addr', true);
          _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0);
          _after(500, () => { _showCompVal('MAR', '3'); });
          _after(1000, () => { _showCompVal('CU', 'T3'); _cuFiresSignals(['RO', 'MI', 'CE']); _busWrite('RAM', 'w-ram-db', 6, OV_COLORS.amber); });
          _after(1600, () => { _receiveComp('MAR', OV_COLORS.blue); _showCompVal('MAR', '6'); _showCompVal('PC', '4'); });
          _setLabel('T2+T3: RAM[3]=6 → this is an ADDRESS → MAR=6 → row 6', OV_COLORS.blue);
        }},
        { text: `T4. CU fires RO and BI. RAM row 6 holds 00000101 — the number 5. It goes to every door. Only Register B captures. B=5.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('CLK'); _glowComp('RAM'); _glowComp('IR');
          _glowComp('REGA'); _glowComp('REGB'); _glowComp('OUT'); _glowComp('PC');
          _showCompVal('CU', 'T4'); _showCompVal('MAR', '6'); _showCompVal('REGA', '3'); _showCompVal('IR', 'ADD'); _showCompVal('PC', '4');
          _cuFiresSignals(['RO', 'BI']);
          _busWrite('RAM', 'w-ram-db', 5, OV_COLORS.amber);
          _after(600, () => { _busWaitingAtDoors(5, 'REGB'); });
          _after(1200, () => { _removeWaitingData(); _receiveComp('REGB', OV_COLORS.purple); _showCompVal('REGB', '5'); });
          _setLabel('T4: RO+BI → RAM[6]=00000101=5 → all doors → B captures → B=5', OV_COLORS.purple);
        }},
        { text: `T5. CU fires EO, AI, FI. The ALU sees A=3 and B=5 on its direct wires. It computes 3+5=8. The result 00001000 goes to every door. Only Register A captures. A=8.`, dur: 7000, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('CLK'); _glowComp('ALU'); _glowComp('FLAGS');
          _glowComp('REGA'); _glowComp('REGB');
          _glowComp('RAM'); _glowComp('IR'); _glowComp('OUT');
          _showCompVal('CU', 'T5'); _showCompVal('REGA', '3'); _showCompVal('REGB', '5'); _showCompVal('IR', 'ADD'); _showCompVal('PC', '4');
          _cuFiresSignals(['EO', 'AI', 'FI']);
          _showCompVal('ALU', '3+5=8');
          _busWrite('ALU', 'w-alu-bus', 8, OV_COLORS.orange);
          _spawnPacket('w-alu-flags', OV_COLORS.amber, false, 0.3);
          _after(600, () => { _busWaitingAtDoors(8, 'REGA'); });
          _after(1200, () => { _removeWaitingData(); _receiveComp('REGA', OV_COLORS.green); _showCompVal('REGA', '8'); _receiveComp('FLAGS', OV_COLORS.amber); _showCompVal('FLAGS', '0'); });
          _setLabel('T5: EO+AI+FI → ALU: 3+5=8=00001000 → all doors → A=8', OV_COLORS.orange);
        }},
        { text: `A=8. The addition is done. Both numbers came from the program — 3 was immediate in LDI, 5 was stored at address 6. Step counter resets.`, dur: 4000, anim: () => {
          _dimAll(); Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          _showCompVal('REGA', '8'); _showCompVal('REGB', '5'); _showCompVal('PC', '4'); _showCompVal('CU', 'T0');
          _setLabel('A=8. 3 (immediate) + 5 (from address 6) = 8. Done.', OV_COLORS.green);
        }},
      ]},
      // Page 3 — Instruction 3: OUT
      { sentences: [
        { text: `Instruction 3: OUT — display whatever Register A holds.`, dur: 3000, anim: () => {
          _dimAll(); Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          _showCompVal('REGA', '8'); _showCompVal('PC', '4');
          _setLabel('OUT: show the value in A. A=8.', OV_COLORS.green);
        }},
        { text: `T0 and T1: Fetch. PC=4 goes to MAR. RAM row 4 fires the OUT opcode. IR captures. PC becomes 5.`, dur: 4500, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('CLK'); _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('IR');
          _showCompVal('REGA', '8'); _showCompVal('REGB', '3');
          _showCompVal('CU', 'T0');
          _cuFiresSignals(['CO', 'MI']);
          _showCompVal('PC', '4');
          _after(500, () => { _showCompVal('MAR', '4'); _showCompVal('CU', 'T1'); _cuFiresSignals(['RO', 'II', 'CE']); _busWrite('RAM', 'w-ram-db', 14, OV_COLORS.amber); });
          _after(1000, () => { _receiveComp('IR', OV_COLORS.amber); _showCompVal('IR', '14'); _showCompVal('PC', '5'); });
          _setLabel('T0+T1: Fetch OUT from row 4. IR=OUT. PC=5.', OV_COLORS.teal);
        }},
        { text: `T2. Clock beats. CU fires AO and OI. Register A puts 8 onto the bus. It goes to every door. Only the Output display captures. The screen shows 8.`, dur: 6000, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('CLK'); _glowComp('IR');
          _glowComp('REGA'); _glowComp('REGB'); _glowComp('RAM'); _glowComp('OUT');
          _showCompVal('CU', 'T2'); _showCompVal('REGA', '8'); _showCompVal('REGB', '3'); _showCompVal('IR', 'OUT'); _showCompVal('PC', '5');
          _cuFiresSignals(['AO', 'OI']);
          _busWrite('REGA', 'w-rega-out', 8, OV_COLORS.green);
          _after(600, () => { _busWaitingAtDoors(8, 'OUT'); });
          _after(1200, () => { _removeWaitingData(); _receiveComp('OUT', OV_COLORS.green); _showCompVal('OUT', '8'); });
          _setLabel('T2: AO+OI → A fires 8 → all doors → Output captures → shows 8', OV_COLORS.green);
        }},
      ]},
      // Page 4 — Instruction 4: HLT
      { sentences: [
        { text: `Instruction 4: HLT — halt. Stop the clock.`, dur: 3000, anim: () => {
          _dimAll(); Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          _showCompVal('REGA', '8'); _showCompVal('OUT', '8'); _showCompVal('PC', '5');
          _setLabel('HLT: stop the clock. Program ends.', OV_COLORS.red);
        }},
        { text: `T0 and T1: Fetch. PC=5 goes to MAR. RAM row 5 fires the HLT opcode. IR captures. PC becomes 6.`, dur: 4500, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('CLK'); _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('IR');
          _showCompVal('REGA', '8'); _showCompVal('REGB', '3'); _showCompVal('OUT', '8');
          _showCompVal('CU', 'T0');
          _cuFiresSignals(['CO', 'MI']);
          _showCompVal('PC', '5');
          _after(500, () => { _showCompVal('MAR', '5'); _showCompVal('CU', 'T1'); _cuFiresSignals(['RO', 'II', 'CE']); _busWrite('RAM', 'w-ram-db', 15, OV_COLORS.amber); });
          _after(1000, () => { _receiveComp('IR', OV_COLORS.amber); _showCompVal('IR', '15'); _showCompVal('PC', '6'); });
          _setLabel('T0+T1: Fetch HLT from row 5. IR=HLT. PC=6.', OV_COLORS.teal);
        }},
        { text: `T2. CU fires HLT. The clock stops. No more beats. The CPU freezes. Everything holds its last value.`, dur: 5000, anim: () => {
          _dimAll();
          _glowComp('CU'); _glowComp('IR'); _glowComp('REGA'); _glowComp('REGB'); _glowComp('OUT');
          _showCompVal('CU', 'T2'); _showCompVal('IR', 'HLT');
          _showCompVal('REGA', '8'); _showCompVal('REGB', '3'); _showCompVal('OUT', '8'); _showCompVal('PC', '6');
          _cuFiresSignals(['HLT']);
          // Clock dies
          _dimComp('CLK'); _setBusActive('clk', false);
          _setLabel('HLT → clock stops. CPU frozen. A=8, Output=8. Done.', OV_COLORS.red);
        }},
        { text: `The program is finished. 5 plus 3 equals 8. Four instructions. Seventeen clock beats. One result on the display.`, dur: 5000, anim: () => {
          _dimAll();
          _glowComp('REGA'); _glowComp('REGB'); _glowComp('OUT'); _glowComp('RAM');
          _showCompVal('REGA', '8'); _showCompVal('REGB', '3'); _showCompVal('OUT', '8');
          _dimComp('CLK'); _setBusActive('clk', false);
          _setLabel('5 + 3 = 8. Four instructions. Seventeen beats. Done.', OV_COLORS.green);
        }},
      ]},
    ],
    highlightComponents: [],
    showAll: true,
  },
  {
    id: 14,
    title: 'Every Program Ever',
    pages: [
      // Page 0
      { sentences: [
        { text: `What you just watched is the same cycle that runs every program ever made.`, anim: () => { Object.keys(CPU_COMPS).forEach(k => _glowComp(k)); _setBusActive('data', true); _setBusActive('addr', true); _setBusActive('clk', true); CPU_WIRES.forEach((w, i) => _spawnPacket(w.id, OV_COLORS.amber, false, i * 0.12)); _setLabel('Fetch. Decode. Execute. Repeat.', OV_COLORS.green); } },
        { text: `A calculator? Fetch-decode-execute.`, dur: 2500, anim: () => { _setLabel('Calculator = fetch-decode-execute', OV_COLORS.green); } },
        { text: `A video game? The same, millions of times per frame.`, dur: 4000, anim: () => { const keys = Object.keys(CPU_COMPS); keys.forEach((k, i) => _after(i * 150, () => { _fireComp(k, OV_COLORS.green); _after(200, () => _glowComp(k)); })); _setLabel('Video game = same cycle, millions of times per frame', OV_COLORS.green); } },
      ]},
      // Page 1
      { sentences: [
        { text: `The CPU in your phone does this same cycle.`, anim: () => { Object.keys(CPU_COMPS).forEach(k => _glowComp(k)); _setBusActive('data', true); _setBusActive('addr', true); _setBusActive('clk', true); CPU_WIRES.forEach((w, i) => _spawnPacket(w.id, OV_COLORS.teal, false, i * 0.1)); } },
        { text: `With wider buses — 64 bits instead of 8.`, anim: () => { _setLabel('64-bit buses (vs 8-bit here)', OV_COLORS.teal); } },
        { text: `Faster clocks — 3 billion beats per second.`, anim: () => { _fireComp('CLK', OV_COLORS.green); _setBusActive('clk', true); ['w-clk-h','w-clk-pc','w-clk-cu','w-clk-ram','w-clk-ir'].forEach((id, i) => _spawnPacket(id, OV_COLORS.green, true, i * 0.05)); _setLabel('3 GHz = 3 billion clock beats per second — CLK fires fast', OV_COLORS.green); } },
        { text: `And hundreds more commands. But the foundation is identical.`, anim: () => { _setLabel('Your phone: 64-bit, 3 GHz, millions of wires — same cycle.', OV_COLORS.teal); } },
      ]},
    ],
    highlightComponents: [],
    showAll: true,
  },
  {
    id: 15,
    title: 'You Are Ready',
    pages: [
      // Page 0
      { sentences: [
        { text: `You now know how a CPU works.`, dur: 3500, anim: () => { Object.keys(CPU_COMPS).forEach(k => _glowComp(k)); _setBusActive('data', true); _setBusActive('addr', true); _setBusActive('clk', true); _setLabel('', OV_COLORS.green); } },
        { text: `Not the simplified version.`, dur: 2500, anim: () => { Object.keys(CPU_COMPS).forEach(k => _glowComp(k)); _setBusActive('data', true); _setBusActive('addr', true); _setBusActive('clk', true); _setLabel('Not a toy — the real architecture', OV_COLORS.teal); } },
        { text: `The real foundation.`, dur: 3500, anim: () => { Object.keys(CPU_COMPS).forEach((k, i) => _after(i * 80, () => _fireComp(k, OV_COLORS.green))); _setBusActive('data', true); _setBusActive('addr', true); _setBusActive('clk', true); CPU_WIRES.forEach((w, i) => _spawnPacket(w.id, OV_COLORS.green, false, i * 0.06)); _setLabel('THE REAL FOUNDATION', OV_COLORS.green); } },
      ]},
      // Page 1
      { sentences: [
        { text: `Switch to Build mode to wire the CPU yourself.`, anim: () => { Object.keys(CPU_COMPS).forEach(k => _glowComp(k)); _setBusActive('data', true); _setBusActive('addr', true); _setBusActive('clk', true); CPU_WIRES.forEach((w, i) => _spawnPacket(w.id, OV_COLORS.green, false, i * 0.08)); Object.keys(CPU_COMPS).forEach((k, i) => _after(i * 120, () => _flashCells(k, OV_COLORS.green))); let readyLabel = _diagSVG && _diagSVG.querySelector('#cpu-ready-label'); if(!readyLabel && _diagSVG) { readyLabel = mkSVG('text', { id: 'cpu-ready-label', x: CPU_W/2, y: CPU_H - 12, 'text-anchor': 'middle', fill: OV_COLORS.green, 'font-family': 'monospace', 'font-size': '14', 'font-weight': '700', 'letter-spacing': '4' }); _diagSVG.appendChild(readyLabel); } if(readyLabel) readyLabel.textContent = 'READY TO BUILD'; _setLabel('READY TO BUILD', OV_COLORS.green); } },
        { text: `Or switch to Free mode to write programs.`, anim: () => { _glowComp('RAM'); _fireComp('RAM', OV_COLORS.amber); _showBinaryInRAMRow(0, 0x51, OV_COLORS.amber); _showBinaryInRAMRow(1, 0x2E, OV_COLORS.amber); _showBinaryInRAMRow(2, 0xE0, OV_COLORS.green); _setLabel('Free mode: write programs — they live in RAM', OV_COLORS.amber); } },
        { text: `You are ready.`, dur: 4000, anim: () => { Object.keys(CPU_COMPS).forEach((k, i) => _after(i * 60, () => { _fireComp(k, OV_COLORS.green); _after(300, () => _glowComp(k)); })); _setBusActive('data', true); _setBusActive('addr', true); _setBusActive('clk', true); CPU_WIRES.forEach((w, i) => _spawnPacket(w.id, OV_COLORS.green, false, i * 0.06)); _setLabel('READY', OV_COLORS.green); } },
      ]},
    ],
    highlightComponents: [],
    showAll: true,
    isFinal: true,
  },
];

// ─────────────────────────────────────────
//  COMPONENT VISIBILITY MAP
//  Each lesson declares which top-level
//  CSS component IDs / selectors to keep
//  visible. Everything else gets .tut-dim
// ─────────────────────────────────────────

const DIMMABLE_SECTIONS = [
  'section-waveform',
  'section-signals',
  'section-registers',
  'section-flags',
  'section-buses',
  'section-output',
  'section-diagram',
];

const LESSON_VISIBLE = [
  // L1: Clock only
  ['section-waveform'],
  // L2: Clock + Registers
  ['section-waveform', 'section-registers'],
  // L3: Clock + Registers + Buses
  ['section-waveform', 'section-registers', 'section-buses'],
  // L4: Clock + Registers + Buses + Diagram
  ['section-waveform', 'section-registers', 'section-buses', 'section-diagram'],
  // L5: Add control signals
  ['section-waveform', 'section-registers', 'section-buses', 'section-diagram', 'section-signals'],
  // L6: Add flags
  ['section-waveform', 'section-registers', 'section-flags', 'section-buses', 'section-diagram', 'section-signals'],
  // L7: Everything
  DIMMABLE_SECTIONS,
  // L8: Everything
  DIMMABLE_SECTIONS,
  // L9: Everything
  DIMMABLE_SECTIONS,
  // L10: Everything
  DIMMABLE_SECTIONS,
  // L11: Everything
  DIMMABLE_SECTIONS,
  // L12: Everything
  DIMMABLE_SECTIONS,
];

// ─────────────────────────────────────────
//  LESSON DEFINITIONS
// ─────────────────────────────────────────

const LESSONS = [

  // ── LESSON 1 ──────────────────────────
  {
    id: 1,
    accent: '#00ff88',
    title: 'What is a Clock?',
    content: `
      <p>Let us start with the clock.</p>
      <p>The clock does not store commands. It does not add numbers. And it does not decide what the CPU should do. Its job is <strong>timing</strong>.</p>
      <p>Think of it like the starter's gun in a race. The runners do not start whenever they want. They wait for the signal. And when the gun goes off, they move.</p>
      <p>The clock plays the same role inside the CPU. It sends out a regular signal that tells the rest of the CPU when to move to the next small step. Without that signal, different parts of the CPU would act at the wrong time. With it, the whole machine stays coordinated.</p>
      <p>Look at the waveform display. Each square pulse is one clock cycle. The CPU is completely frozen between ticks. This is how we stay in control: the clock is the conductor, and every circuit waits for the baton.</p>
    `,
    whyText: `Without a clock, all the flip-flop circuits in the CPU would fire at random — results would be garbage. The clock is what makes everything happen in order, one step at a time. Real CPUs run at billions of ticks per second (GHz). We run at human speed so you can see what's happening.`,
    taskDescription: 'Click <strong>Step T+1</strong> five times. Watch the clock waveform grow with each tick.',
    taskCheck: (tut) => tut.stepCount >= 5,
    taskProgressText: (tut) => `${tut.stepCount} / 5 steps`,
    setup(cpu) {
      const bytes = new Array(256).fill(0);
      bytes[0]  = 0x00;
      bytes[2]  = 0x00;
      bytes[4]  = 0x00;
      bytes[6]  = 0x06;
      bytes[7]  = 0x00;
      cpu.loadProgram(bytes);
      cpu.reset();
      cpu.loadProgram(bytes);
    },
    onStep(tut) {
      tut.stepCount++;
    },
  },

  // ── LESSON 2 ──────────────────────────
  {
    id: 2,
    accent: '#4488ff',
    title: 'Storing a Value — Your First Register',
    content: `
      <p>Registers are small storage spaces inside the CPU. They hold information the CPU wants to work with right now.</p>
      <p>This is important because the CPU does not usually do arithmetic directly from memory. Instead, it first loads values from memory into registers. That means registers act like the CPU's <strong>working area</strong>. Memory is where information is kept. Registers are where information is placed when the CPU is about to use it.</p>
      <p><strong>Register A</strong> is the CPU's main workhorse. Almost every operation passes through it: loading data, doing arithmetic, sending results to output.</p>
      <p>When the clock ticks and the <em>AI (A In)</em> signal is active, the register captures whatever value is on the data bus at that exact moment. One tick. Done.</p>
      <p>Watch the Registers panel on the right. The binary digits will change and the card will flash when A is loaded.</p>
    `,
    whyText: `CPUs need somewhere to hold the number they're currently working with. RAM is too slow — it takes multiple steps to address and fetch from memory. Registers are right there on the chip, a single wire away from the ALU. Intel's 8086 (1978) had 14 registers. Modern AMD64 processors have 16 general-purpose registers, each 64 bits wide.`,
    taskDescription: 'The CPU is running a program that loads 42 into A, then loads 7. Click <strong>Step T+1</strong> until you see Register A change to <strong>42</strong>, then continue until it becomes <strong>7</strong>.',
    taskCheck: (tut) => tut.stepCount >= 2,
    taskProgressText: (tut) => tut.stepCount === 0
      ? 'A = ?, need to see A = 42 then A = 7'
      : tut.stepCount === 1
        ? 'A changed once — keep stepping to see it change again'
        : 'Both values loaded!',
    setup(cpu) {
      const bytes = new Array(256).fill(0);
      bytes[0] = 0x05; bytes[1] = 42;
      bytes[2] = 0x05; bytes[3] = 7;
      bytes[4] = 0x06; bytes[5] = 0x00;
      cpu.loadProgram(bytes);
      cpu.reset();
      cpu.loadProgram(bytes);
    },
    onStep(tut, state) {
      if (state.A === 42 && tut.stepCount === 0) tut.stepCount = 1;
      if (state.A === 7  && tut.stepCount === 1) tut.stepCount = 2;
    },
  },

  // ── LESSON 3 ──────────────────────────
  {
    id: 3,
    accent: '#ffaa00',
    title: 'The Bus — Connecting Everything',
    content: `
      <p>None of the CPU's parts can work in isolation. The CPU needs pathways that carry values, commands, and addresses from one part to another. Those pathways are called <strong>buses</strong>.</p>
      <p>The <strong>data bus</strong> is a set of 8 shared wires. Think of it as a hallway that all components share. At any moment, exactly <em>one</em> component may put a value onto it — and any other component may read from it.</p>
      <p>So when a value moves from memory into a register, it travels along a bus. When an address is sent out, it travels along a bus. When a result moves back into memory, it travels along a bus. The buses are the roads connecting the whole system together.</p>
      <p>The signals that control this are <code>AO</code> (A Out) and <code>BI</code> (B In). When <code>AO</code> is active, Register A drives its value onto the bus. When <code>BI</code> is also active, Register B reads that value from the bus.</p>
      <p>Watch the Data Bus display. The label <strong>Driver</strong> shows which component is currently speaking on the bus.</p>
      <p>There is also an <strong>address bus</strong> (the upper bus) — it carries memory addresses rather than data. The Program Counter drives this with <code>CO</code>.</p>
    `,
    whyText: `A bus costs far fewer wires than point-to-point connections. With 8 components fully connected to each other you'd need 28 separate links. A shared bus needs just 8 wires — one per bit — plus control lines to decide who speaks. The tradeoff: only one component can talk at a time, which limits parallelism. Modern CPUs use multiple separate buses to work around this.`,
    taskDescription: 'Step through until you see the data bus show <strong>Driver: A</strong> (Register A putting its value on the bus). Then keep stepping to see it land in <strong>Register B</strong>.',
    taskCheck: (tut) => tut.stepCount >= 2,
    taskProgressText: (tut) => tut.stepCount === 0
      ? 'Waiting to see A drive the bus...'
      : tut.stepCount === 1
        ? 'Bus saw A — now watch B capture it'
        : 'Bus transfer complete!',
    setup(cpu) {
      const bytes = new Array(256).fill(0);
      bytes[0] = 0x05; bytes[1] = 42;
      bytes[2] = 0x18; bytes[3] = 99;
      bytes[4] = 0x04; bytes[5] = 0x20;
      bytes[6] = 0x06; bytes[7] = 0x00;
      cpu.loadProgram(bytes);
      cpu.reset();
      cpu.loadProgram(bytes);
    },
    onStep(tut, state) {
      if (state.busDriver === 'A' && tut.stepCount === 0) tut.stepCount = 1;
      if (state.busDriver === 'A' && tut.stepCount === 1 && state.B !== undefined) {
        tut.stepCount = 2;
      }
    },
  },

  // ── LESSON 4 ──────────────────────────
  {
    id: 4,
    accent: '#ff8844',
    title: 'Memory — RAM and the MAR',
    content: `
      <p>Memory is where the computer keeps the commands it needs to follow and the information it needs to work on.</p>
      <p><strong>RAM</strong> (Random Access Memory) is like a row of 256 numbered mailboxes. Each one holds exactly one byte (0–255). The number on the mailbox is its <em>address</em>.</p>
      <p>A useful way to picture it is as a long hallway full of numbered rooms. Each room holds something — some rooms hold commands, some hold information — and each room has its own number. That number is the address. The CPU does not read all of memory at once. It reads one location at a time.</p>
      <p>But RAM needs to know which mailbox you want. That's the job of the <strong>MAR</strong> — Memory Address Register. You first put the address into the MAR, and then RAM reads or writes that specific location.</p>
      <p>The fetch cycle always starts this way: PC → address bus → MAR (<code>CO+MI</code>). Then RAM[MAR] → data bus → IR (<code>RO+II+CE</code>).</p>
      <p>You can see all 256 RAM cells in the <strong>Memory</strong> tab. The highlighted cell is the current MAR address.</p>
    `,
    whyText: `Registers are fast, but we only have a handful. RAM gives us 256 storage locations (in this CPU — real CPUs have gigabytes). The two-step "MAR then access" process maps directly to how physical SRAM chips work: you put the address on the address pins, wait one cycle for the chip to select the row and column, then read or write the data pins.`,
    taskDescription: 'Step through the <strong>fetch cycle</strong> of an instruction. Watch: (1) PC → MAR (address bus lights up), then (2) RAM → IR (data bus shows the instruction byte). You need to see both happen.',
    taskCheck: (tut) => tut.stepCount >= 2,
    taskProgressText: (tut) => ['Waiting for T0 (PC→MAR)...', 'T0 done, waiting for T1 (RAM→IR)...', 'Full fetch cycle observed!'][Math.min(tut.stepCount, 2)],
    setup(cpu) {
      const bytes = new Array(256).fill(0);
      bytes[0] = 0x01; bytes[1] = 0x20;
      bytes[2] = 0x00;
      bytes[4] = 0x06; bytes[5] = 0x00;
      bytes[0x20] = 77;
      cpu.loadProgram(bytes);
      cpu.reset();
      cpu.loadProgram(bytes);
    },
    onStep(tut, state) {
      const cw = state.controlWord;
      if ((cw & CS.CO) && (cw & CS.MI) && tut.stepCount === 0) tut.stepCount = 1;
      if ((cw & CS.RO) && (cw & CS.II) && tut.stepCount === 1) tut.stepCount = 2;
    },
  },

  // ── LESSON 5 ──────────────────────────
  {
    id: 5,
    accent: '#cc44ff',
    title: 'The Program Counter — Knowing What\'s Next',
    content: `
      <p>If the CPU wants to fetch a command from memory, something must always be ready to tell it where that command is stored. That is the job of the <strong>Program Counter</strong>.</p>
      <p>The program counter always carries the room number of the memory location where the next instruction is stored. So when the CPU asks, "Where is the next instruction?" — the program counter answers with the address of that location.</p>
      <p>But notice something important. The program counter does not hold the instruction itself. It only holds the <em>address</em> of the memory location where that instruction is kept.</p>
      <p>That also means if the program counter is not updated, the CPU will keep going back to the same location and fetching the same instruction again and again. So for the CPU to move forward through a program, the program counter must be updated with the address of the next instruction.</p>
      <p>In the Registers panel, watch the <strong>PC</strong> row. During the fetch cycle it drives the address bus (<code>CO</code>), the MAR captures it (<code>MI</code>), and then it increments (<code>CE</code> — Counter Enable). The magic of a <code>JMP</code> instruction is that instead of incrementing, we <em>replace</em> the PC with the jump target address.</p>
    `,
    whyText: `Without a program counter, someone — or something — would have to manually tell the CPU the address of each instruction. The PC automates this. It's why you can leave a program running and walk away: the CPU knows where to go next all by itself. The PC "pointing to an instruction" is exactly what "program execution" means.`,
    taskDescription: 'Watch the PC increment through at least <strong>4 different values</strong> (0 → 1 → 2 → 3...). Step through the program and watch the PC register row change each time.',
    taskCheck: (tut) => tut.stepCount >= 4,
    taskProgressText: (tut) => `PC has reached ${tut.stepCount} distinct values (need 4)`,
    setup(cpu) {
      const bytes = new Array(256).fill(0);
      bytes[0] = 0x00;
      bytes[1] = 0x00;
      bytes[2] = 0x00;
      bytes[3] = 0x00;
      bytes[4] = 0x06; bytes[5] = 0x00;
      cpu.loadProgram(bytes);
      cpu.reset();
      cpu.loadProgram(bytes);
    },
    onStep(tut, state) {
      if (state.PC > tut.stepCount && state.PC <= tut.stepCount + 1) {
        tut.stepCount = state.PC;
      } else if (state.PC >= 4 && tut.stepCount < 4) {
        tut.stepCount = 4;
      }
    },
  },

  // ── LESSON 6 ──────────────────────────
  {
    id: 6,
    accent: '#44ddff',
    title: 'The Instruction Register — Decoding Commands',
    content: `
      <p>Once the CPU has the address from the program counter, it can go and collect the instruction. That is the <strong>fetch step</strong>. Fetch means: go to the memory location given by the program counter, pick up the command stored there, and bring it into the CPU.</p>
      <p>But once the CPU has fetched the command, where does it keep it while it studies it? It needs a temporary holding place inside the CPU. That place is the <strong>Instruction Register (IR)</strong>.</p>
      <p>The instruction register holds the command the CPU is currently working on. Every instruction is just a number stored in RAM. The byte <code>0x05</code> means "LDI" (load immediate). The byte <code>0x0E</code> means "OUT". The CPU has no concept of English — just binary patterns.</p>
      <p>The <strong>control logic</strong> then looks up this opcode in its microcode table to figure out which control signals to fire for each T-state. In the Registers panel, the <strong>IR</strong> row shows both the binary value and the human-readable mnemonic. Look at it after T1 (when <code>RO+II</code> fires) — that's the moment the IR is loaded.</p>
    `,
    whyText: `The instruction register solves a timing problem: RAM needs the address bus to point at the right location, but by T2 we need to use the address bus to fetch operands. Without the IR, we'd lose the opcode the moment we moved on to the operand fetch. The IR holds the opcode safe for the entire duration of the instruction.`,
    taskDescription: 'Step through until the IR shows opcode <strong>LDI</strong>. The pre-loaded program starts with LDI 42. After T1 of the first instruction, the IR should display "LDI".',
    taskCheck: (tut) => tut.stepCount >= 1,
    taskProgressText: (tut) => tut.stepCount === 0 ? 'Waiting for IR to show LDI...' : 'IR captured the LDI opcode!',
    setup(cpu) {
      const bytes = new Array(256).fill(0);
      bytes[0] = 0x05; bytes[1] = 42;
      bytes[2] = 0x0E;
      bytes[3] = 0x06; bytes[4] = 0x00;
      cpu.loadProgram(bytes);
      cpu.reset();
      cpu.loadProgram(bytes);
    },
    onStep(tut, state) {
      if (state.instrName === 'LDI' && state.tState >= 2 && tut.stepCount === 0) {
        tut.stepCount = 1;
      }
    },
  },

  // ── LESSON 7 ──────────────────────────
  {
    id: 7,
    accent: '#ffdd44',
    title: 'Fetch-Decode-Execute — The Universal Cycle',
    content: `
      <p>At the most basic level, every CPU repeats the same three steps.</p>
      <p><strong>Fetch. Decode. Execute.</strong></p>
      <p>Every CPU ever built — from the Intel 4004 in 1971 to today's M-series chips — does exactly the same three things, over and over:</p>
      <p><strong>1. FETCH</strong> — Get the next instruction from RAM. (T0: PC→MAR. T1: RAM→IR, PC++.)</p>
      <p><strong>2. DECODE</strong> — Figure out what the opcode means. (The control unit reads the command from the instruction register and works out what action the CPU must perform.)</p>
      <p><strong>3. EXECUTE</strong> — Do what the instruction says. (T2, T3, T4... vary per instruction. This is where the CPU carries out the action the command described.)</p>
      <p>And once that step is complete, the program counter is updated with the address of the next instruction. Then the cycle begins again. Fetch. Decode. Execute. Again. And again. And again.</p>
      <p>The <strong>Current Instruction</strong> panel at the bottom of the screen shows you exactly which T-state is active and which phase you're in. T0 and T1 are always FETCH — every single instruction starts the same way.</p>
    `,
    whyText: `This three-phase cycle is so fundamental that it predates transistors — early relay computers like the Harvard Mark I used the same principle. What changes between CPU generations is the width (8-bit vs 64-bit), the speed, the number of instructions, and pipeline depth. But the fetch-decode-execute cycle? That's eternal.`,
    taskDescription: 'Step through the entire program: <strong>LDI 5 → OUT → HLT</strong>. Watch the phases in the bottom panel. You need to complete all three instructions (reach HLT).',
    taskCheck: (tut, state) => state && state.halted,
    taskProgressText: (tut, state) => {
      if (!state) return 'Step through the program...';
      if (state.halted) return 'Program complete — all three phases observed!';
      return `Executing: ${state.instrName} at T${state.tState}`;
    },
    setup(cpu) {
      const bytes = new Array(256).fill(0);
      bytes[0] = 0x05; bytes[1] = 5;
      bytes[2] = 0x0E;
      bytes[3] = 0x0F;
      cpu.loadProgram(bytes);
      cpu.reset();
      cpu.loadProgram(bytes);
    },
    onStep(tut, state) {},
  },

  // ── LESSON 8 ──────────────────────────
  {
    id: 8,
    accent: '#ff4488',
    title: 'Control Signals — The Brain Behind the Brain',
    content: `
      <p>So who decides that at T0 the PC drives the bus and the MAR reads it? The <strong>control unit</strong> does — and it's just a big lookup table.</p>
      <p>The control unit reads the command from the instruction register and decides how the rest of the CPU should respond. It does not do the calculation itself. It does not store the result itself. Its job is to look at the current command and send the right signals to the right parts at the right time. So the control unit is the part that turns a command into action.</p>
      <p>Given the current opcode (from IR) and T-state, the control unit asserts a specific set of signals. These signals are the puppet strings: they open and close connections between components for exactly one clock cycle.</p>
      <p>The Control Signals panel shows every signal and whether it's currently active. Let's decode what the LDA instruction does:</p>
      <div class="tut-ascii-diagram">T0: CO+MI   → PC drives addr bus, MAR latches
T1: RO+II+CE → RAM→IR, PC++   (FETCH done)
T2: CO+MI    → fetch operand addr byte
T3: RO+MI+CE → operand→MAR, PC++
T4: RO+AI    → RAM[addr] → A register</div>
      <p>That's five micro-steps just to load one byte from memory. Each step activates exactly the right signals. Nothing else fires.</p>
    `,
    whyText: `Ben Eater's physical computer stores this lookup table in two 28C256 EEPROM chips — one for the high byte of control signals, one for the low byte. Each memory address is (opcode × T-states + T-state), and the byte stored there is the control word. When you edit the Microcode tab in this simulator, you're doing exactly what he does when he burns a new EEPROM.`,
    taskDescription: 'Look at the Control Signals panel. Step through one complete LDA instruction. Correctly predict what signals fire at the <strong>EXECUTE step (T4)</strong>: does AI fire? Does RO fire?',
    taskCheck: (tut) => tut.predictionsDone >= 2,
    taskProgressText: (tut) => `${tut.predictionsDone} / 2 predictions made`,
    setup(cpu) {
      const bytes = new Array(256).fill(0);
      bytes[0] = 0x01; bytes[1] = 0x20;
      bytes[2] = 0x06; bytes[3] = 0x00;
      bytes[0x20] = 77;
      cpu.loadProgram(bytes);
      cpu.reset();
      cpu.loadProgram(bytes);
    },
    onStep(tut) {},
    extraHTML: `
      <div class="tut-prediction-list" id="tut-predictions">
        <p style="font-size:12px;color:#8aabb8;margin-bottom:8px">At T4 of LDA, predict which signals are active:</p>
        <div class="tut-prediction-item">
          <span class="tut-prediction-q">RO fires (RAM sends data)?</span>
          <div class="tut-prediction-btn">
            <button class="tut-pred-choice" data-q="0" data-ans="yes">YES</button>
            <button class="tut-pred-choice" data-q="0" data-ans="no">NO</button>
          </div>
        </div>
        <div class="tut-prediction-item">
          <span class="tut-prediction-q">AI fires (A receives data)?</span>
          <div class="tut-prediction-btn">
            <button class="tut-pred-choice" data-q="1" data-ans="yes">YES</button>
            <button class="tut-pred-choice" data-q="1" data-ans="no">NO</button>
          </div>
        </div>
        <div id="tut-pred-result" style="font-size:12px;color:#7abf9a;margin-top:6px;display:none"></div>
      </div>
    `,
  },

  // ── LESSON 9 ──────────────────────────
  {
    id: 9,
    accent: '#88ff44',
    title: 'The ALU — Math and Logic',
    content: `
      <p>ALU stands for <strong>Arithmetic Logic Unit</strong>. This is the part of the CPU that performs operations on values.</p>
      <p>If the CPU needs to add two numbers, compare two values, or perform simple logic, the ALU is the part that does that work. The ALU is the only part of the CPU that actually <em>computes</em>. Everything else is moving data around.</p>
      <p>It takes two inputs — from Register A and Register B — does the operation, and puts the result on the data bus via <code>EO</code> (ALU Out). The result then goes back into A via <code>AI</code>.</p>
      <p>So imagine one register holds the value 5, and another holds the value 3. If the command says ADD, the control unit understands what must happen. It sends signals so those two values move from the registers into the ALU. The ALU then adds them and produces the result 8. That result is placed into a register.</p>
      <p>Watch the program below: it loads 12 into A, stores it, loads 3, then ADDs the stored value. The ALU will compute <strong>3 + 12 = 15</strong>.</p>
      <div class="tut-ascii-diagram">  A reg →─────────┐
                   ┌──┴──┐
  B reg →─────────┤ ALU │──→ data bus (via EO)
                   └──┬──┘
            SU,ANDI,ORI,XOR... mode signals</div>
    `,
    whyText: `An 8-bit binary adder is built from 8 "full adder" circuits chained together. Each full adder takes three inputs: bit A, bit B, and carry-in. It produces a sum bit and carry-out. Chain 8 of them and you have an 8-bit adder. The subtractor is an adder with B inverted plus 1 (two's complement). AND/OR/XOR gates are literally just AND/OR/XOR logic gates.`,
    taskDescription: 'Step through until the ALU register shows the result <strong>15</strong> (3 + 12). Watch the ALU component in the diagram light up when EO fires.',
    taskCheck: (tut, state) => state && state.ALU === 15 && (state.controlWord & CS.EO),
    taskProgressText: (tut, state) => {
      if (!state) return 'Step to see ALU compute...';
      if (state.ALU === 15 && (state.controlWord & CS.EO)) return 'ALU computed 3 + 12 = 15!';
      return `ALU currently = ${state.ALU || 0}`;
    },
    setup(cpu) {
      const bytes = new Array(256).fill(0);
      bytes[0]  = 0x05; bytes[1]  = 12;
      bytes[2]  = 0x04; bytes[3]  = 0x20;
      bytes[4]  = 0x05; bytes[5]  = 3;
      bytes[6]  = 0x02; bytes[7]  = 0x20;
      bytes[8]  = 0x0E;
      bytes[9]  = 0x0F;
      cpu.loadProgram(bytes);
      cpu.reset();
      cpu.loadProgram(bytes);
    },
    onStep() {},
  },

  // ── LESSON 10 ─────────────────────────
  {
    id: 10,
    accent: '#ff6644',
    title: 'Flags and Decisions',
    content: `
      <p>After every ALU operation, two <strong>flags</strong> are updated:</p>
      <p><strong>CF (Carry Flag)</strong> — Did the result overflow 8 bits? Adding 200 + 100 = 300, which doesn't fit in a byte. CF=1 means there was a carry out.</p>
      <p><strong>ZF (Zero Flag)</strong> — Is the result exactly zero? ZF=1 means the ALU output was 0.</p>
      <p>These two tiny bits are how the CPU makes <em>decisions</em>. The <code>JZ</code> instruction jumps only if ZF=1. <code>JC</code> jumps only if CF=1. That's how IF statements work at the hardware level.</p>
      <p>Watch the countdown below: every subtract updates ZF. When the counter hits 0, ZF goes HIGH — and the next JZ takes the branch.</p>
    `,
    whyText: `This is one of the most profound moments in computer architecture: the realization that "thinking" and "deciding" reduce to checking one or two bits. Every if/else, every while loop, every switch statement in every programming language ever written eventually compiles down to: do arithmetic, check a flag, jump or don't. That's it. That's computation.`,
    taskDescription: 'Step through the countdown program until the <strong>Zero Flag (ZF) turns to 1</strong>. Then notice the next JZ takes the branch.',
    taskCheck: (tut, state) => state && state.ZF === 1,
    taskProgressText: (tut, state) => {
      if (!state) return 'Counting down...';
      return state.ZF === 1 ? 'ZF = 1! Zero detected — JZ will branch!' : `ZF = ${state.ZF}, A = ${state.A}`;
    },
    setup(cpu) {
      const bytes = new Array(256).fill(0);
      bytes[0]  = 0x01; bytes[1]  = 0x20;
      bytes[2]  = 0x0E;
      bytes[3]  = 0x03; bytes[4]  = 0x21;
      bytes[5]  = 0x08; bytes[6]  = 0x09;
      bytes[7]  = 0x06; bytes[8]  = 0x02;
      bytes[9]  = 0x0E;
      bytes[10] = 0x0F;
      bytes[0x20] = 3;
      bytes[0x21] = 1;
      cpu.loadProgram(bytes);
      cpu.reset();
      cpu.loadProgram(bytes);
    },
    onStep() {},
  },

  // ── LESSON 11 ─────────────────────────
  {
    id: 11,
    accent: '#44ffcc',
    title: 'Output — Seeing Results',
    content: `
      <p>A CPU that can't communicate its results to the outside world is useless. The <strong>OUT</strong> instruction takes whatever is in Register A and moves it to the Output Register.</p>
      <p>When <code>AO</code> (A Out) and <code>OI</code> (Output In) are both active in the same T-state, the value flows: A → data bus → Output register. In Ben Eater's physical computer, this connects to a 7-segment LED display.</p>
      <p>In this simulator, every OUT instruction adds an entry to the Output Display panel (center column). The value is shown in decimal, hex, and binary.</p>
      <p>Now it is your turn to write a program. Use the Assembler tab on the right.</p>
    `,
    whyText: `Output bridges the CPU to the world. In 1970s microcomputers, output was a blinking LED or a serial terminal. Today it's HDMI signals to a monitor, PCIe to a graphics card, USB to peripherals. But at the software level, the principle is identical: the CPU writes a value to an output register, and hardware takes care of the rest.`,
    taskDescription: 'Write a program that outputs the number <strong>42</strong>. Use the Assembler tab. Hint: <code>LDI 42</code>, <code>OUT</code>, <code>HLT</code>. Click Assemble + Run, then verify the output.',
    taskCheck: (tut) => {
      const hist = window.App && window.App.outputHistory;
      return hist && hist.length > 0 && hist[hist.length - 1].value === 42;
    },
    taskProgressText: (tut) => {
      const hist = window.App && window.App.outputHistory;
      if (!hist || hist.length === 0) return 'No output yet — write and run your program';
      const last = hist[hist.length - 1].value;
      return last === 42 ? 'Output = 42!' : `Last output = ${last}, need 42`;
    },
    setup(cpu) {
      const bytes = new Array(256).fill(0);
      bytes[0] = 0x0F;
      cpu.loadProgram(bytes);
      cpu.reset();
      cpu.loadProgram(bytes);
    },
    onStep() {},
  },

  // ── LESSON 12 ─────────────────────────
  {
    id: 12,
    accent: '#ffffff',
    title: 'You Built This',
    content: `
      <p>And once you understand that rhythm, the CPU stops looking like magic. It becomes a machine made of clear parts, each doing one specific job.</p>
      <p>Look at everything you now understand:</p>
      <p><strong>Clock</strong> — the timing signal that keeps everything synchronized.</p>
      <p><strong>Registers</strong> — the CPU's working area, right on the chip.</p>
      <p><strong>Bus</strong> — the shared roads connecting all components.</p>
      <p><strong>RAM and MAR</strong> — 256 addressable storage locations.</p>
      <p><strong>Program Counter</strong> — the pointer that keeps track of where the CPU must go next.</p>
      <p><strong>Instruction Register</strong> — holds the current command the CPU is working on.</p>
      <p><strong>Control Unit</strong> — the coordinator that turns a command into action.</p>
      <p><strong>ALU</strong> — the only part that actually computes.</p>
      <p><strong>Flags</strong> — how the CPU makes decisions.</p>
      <p><strong>Output</strong> — the bridge to the outside world.</p>
      <p>Real CPUs are 64-bit, run at 5GHz, and execute 4 instructions per cycle with 5-stage pipelines and caches. But the <em>principle</em> is <strong>identical</strong> to what you just learned. Every computer is just this, scaled up.</p>
    `,
    whyText: `Ben Eater's breadboard 8-bit computer uses about 130 chips and runs at roughly 1 MHz. Your brain can probably simulate it faster right now because you understand every piece. The next step: read about pipelining, cache hierarchies, out-of-order execution, and branch prediction — all extensions of these same ideas.`,
    taskDescription: 'Celebrate! Write a program that counts from 1 to 5 and outputs each number. When you\'re ready, switch to <strong>Free Mode</strong> to explore everything. Try the Challenges tab!',
    taskCheck: (tut) => {
      const hist = window.App && window.App.outputHistory;
      if (!hist || hist.length < 5) return false;
      const last5 = hist.slice(-5).map(h => h.value);
      return last5.join(',') === '1,2,3,4,5';
    },
    taskProgressText: (tut) => {
      const hist = window.App && window.App.outputHistory;
      if (!hist || hist.length === 0) return 'Output [1, 2, 3, 4, 5] to complete';
      const vals = hist.slice(-5).map(h => h.value);
      return `Last output values: [${vals.join(', ')}] — need [1,2,3,4,5]`;
    },
    setup(cpu) {
      const src = `; Count from 1 to 5
; Try running this — then explore Free Mode!

        LDI 1       ; start = 1
        STA 0x50    ; store counter

loop:   LDA 0x50    ; load counter
        OUT         ; output it
        ADD 0x51    ; counter += 1
        STA 0x50    ; save counter
        CMP 0x52    ; compare with 6
        JZ  done    ; if counter == 6, done
        JMP loop    ; else keep going

done:   HLT

.org 0x50
.byte 1             ; counter (starts at 1)
.byte 1             ; increment = 1
.byte 6             ; stop when counter reaches 6`;
      if (window.App && window.App.assembler) {
        const bytes = window.App.assembler.assemble(src);
        if (bytes) {
          cpu.loadProgram(bytes);
          cpu.reset();
          cpu.loadProgram(bytes);
          if (window.document) {
            const editor = document.getElementById('editor');
            if (editor) editor.value = src;
          }
        }
      }
    },
    onStep() {},
  },

];

// ─────────────────────────────────────────
//  DETAILED SAP-1 SCHEMATIC — persistent
//  Full schematic with bit cells, buses,
//  tri-state buffers, and individual wires.
//  applySceneEffect() highlights per scene.
// ─────────────────────────────────────────

// Shared color palette
const OV_COLORS = {
  blue:   '#4488ff',
  green:  '#00ff88',
  amber:  '#ffaa00',
  red:    '#ff4444',
  purple: '#bb66ff',
  orange: '#ff8844',
  teal:   '#44ddff',
  dim:    '#1a2a3a',
  bg:     '#020a14',
  text:   '#c8dff0',
};

// Helper: create SVG element
function mkSVG(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  return el;
}

// ─────────────────────────────────────────
//  DETAILED SAP-1 SCHEMATIC — layout
//
//  Canvas: 1400 x 820 (scrollable in container)
//
//  Layout (Y bands):
//    CLK:              y=20
//    CLK line (horiz): y=58
//    OUTPUT:           x=1250 y=20
//    DATA BUS lines:   y=200..248  (8 lines, 6px gap)
//    ADDRESS BUS lines:y=480..504  (4 lines, 6px gap)
//    REG A / REG B:    y=280
//    ALU:              y=370
//    FLAGS:            y=460
//    PC:               y=560
//    MAR:              y=560
//    RAM:              y=280 (right side)
//    IR:               y=280 (right of RAM)
//    CU:               y=390 (far right)
// ─────────────────────────────────────────

const CPU_W = 1550, CPU_H = 960;

// ── bus Y positions ──
const DB_Y0 = 195;          // Data bus top line Y (D0)
const DB_LINES = 8;         // 8 data lines
const DB_GAP = 7;           // gap between lines
const AB_Y0 = 580;          // Address bus top line Y (A0)
const AB_LINES = 4;
const AB_GAP = 7;
const CLK_Y = 55;           // horizontal clock rail Y

// ── component X centers / bounds ──
// Left column (x center ~120)
const CLK_X = 60;  const CLK_W = 90;  const CLK_H = 50;   const CLK_Y_BOX = 18;
// REG A — center x=200
const RA_X = 60;   const RA_W = 120;  const RA_H = 64;    const RA_Y = 320;
// REG B — center x=380
const RB_X = 420;  const RB_W = 120;  const RB_H = 64;    const RB_Y = 320;
// ALU — center x=290
const ALU_X = 210; const ALU_W = 180; const ALU_H = 70;   const ALU_Y = 430;
// FLAGS — x=240
const FL_X = 250;  const FL_W = 100;  const FL_H = 46;    const FL_Y = 530;
// PC — bottom left
const PC_X = 60;   const PC_W = 120;  const PC_H = 64;    const PC_Y = 650;
// MAR — bottom center-left
const MAR_X = 260; const MAR_W = 120; const MAR_H = 64;   const MAR_Y = 720;
// RAM — center-right
const RAM_X = 620; const RAM_W = 200; const RAM_H = 160;  const RAM_Y = 320;
// IR — right of RAM
const IR_X = 880;  const IR_W = 130;  const IR_H = 64;    const IR_Y = 320;
// CU — far right
const CU_X = 1060; const CU_W = 160;  const CU_H = 240;  const CU_Y = 310;
// OUTPUT — top right
const OUT_X = 1240; const OUT_W = 130; const OUT_H = 80;  const OUT_Y = 10;

// ── Bit cell size ──
const CELL_W = 12, CELL_H = 12, CELL_GAP = 2;

// ── Component descriptor (for highlight system) ──
// Each entry: id matches _diagCompEls keys, bounds for glow rect
const CPU_COMPS = {
  CLK:   { id: 'cpu-clk',   label: 'CLOCK',    x: CLK_X,  y: CLK_Y_BOX, w: CLK_W,  h: CLK_H,  color: OV_COLORS.green  },
  PC:    { id: 'cpu-pc',    label: 'PC',        x: PC_X,   y: PC_Y,      w: PC_W,   h: PC_H,   color: OV_COLORS.teal   },
  MAR:   { id: 'cpu-mar',   label: 'MAR',       x: MAR_X,  y: MAR_Y,     w: MAR_W,  h: MAR_H,  color: OV_COLORS.blue   },
  RAM:   { id: 'cpu-ram',   label: 'RAM',       x: RAM_X,  y: RAM_Y,     w: RAM_W,  h: RAM_H,  color: OV_COLORS.blue   },
  IR:    { id: 'cpu-ir',    label: 'IR',        x: IR_X,   y: IR_Y,      w: IR_W,   h: IR_H,   color: OV_COLORS.amber  },
  CU:    { id: 'cpu-cu',    label: 'CTRL UNIT', x: CU_X,   y: CU_Y,      w: CU_W,   h: CU_H,   color: OV_COLORS.red    },
  REGA:  { id: 'cpu-rega',  label: 'REG A',     x: RA_X,   y: RA_Y,      w: RA_W,   h: RA_H,   color: OV_COLORS.purple },
  REGB:  { id: 'cpu-regb',  label: 'REG B',     x: RB_X,   y: RB_Y,      w: RB_W,   h: RB_H,   color: OV_COLORS.purple },
  ALU:   { id: 'cpu-alu',   label: 'ALU',       x: ALU_X,  y: ALU_Y,     w: ALU_W,  h: ALU_H,  color: OV_COLORS.orange },
  FLAGS: { id: 'cpu-flags', label: 'FLAGS',     x: FL_X,   y: FL_Y,      w: FL_W,   h: FL_H,   color: OV_COLORS.amber  },
  OUT:   { id: 'cpu-out',   label: 'OUTPUT',    x: OUT_X,  y: OUT_Y,     w: OUT_W,  h: OUT_H,  color: OV_COLORS.green  },
};

// ── Wire definitions for the packet system ──
// These are logical routing paths used for animated packets.
// Coordinates are chosen to travel along the actual bus lines.
const CPU_WIRES = [
  // Clock rail → components
  { id: 'w-clk-h',    x1: CLK_X+CLK_W, y1: CLK_Y, x2: 1200, y2: CLK_Y,  type: 'clk'  },
  { id: 'w-clk-pc',   x1: PC_X+PC_W/2, y1: CLK_Y, x2: PC_X+PC_W/2, y2: PC_Y, bend: false, type: 'clk'  },
  { id: 'w-clk-cu',   x1: CU_X+CU_W/2, y1: CLK_Y, x2: CU_X+CU_W/2, y2: CU_Y, bend: false, type: 'clk'  },
  { id: 'w-clk-ram',  x1: RAM_X+RAM_W/2, y1: CLK_Y, x2: RAM_X+RAM_W/2, y2: RAM_Y, bend: false, type: 'clk'  },
  { id: 'w-clk-ir',   x1: IR_X+IR_W/2, y1: CLK_Y, x2: IR_X+IR_W/2, y2: IR_Y, bend: false, type: 'clk'  },

  // Address bus (A0 line used for packets)
  { id: 'w-pc-mar',   x1: PC_X+PC_W, y1: AB_Y0, x2: MAR_X, y2: AB_Y0,   type: 'addr', label: 'ADDR BUS' },
  // MAR→RAM direct connection: packet path follows one of the 4 hardwired routes (MAR right → RAM left).
  // hidden: true means _drawLogicalWires skips it (the 4 direct wires are drawn separately).
  { id: 'w-mar-ram',  x1: MAR_X+MAR_W, y1: MAR_Y+20+7, x2: (MAR_X+MAR_W+RAM_X)/2, y2: MAR_Y+20+7, x3: (MAR_X+MAR_W+RAM_X)/2, y3: RAM_Y+RAM_H/2, x4: RAM_X, y4: RAM_Y+RAM_H/2, bend2: true, type: 'addr', hidden: true },

  // Data bus (D0 line used for packets)
  { id: 'w-ram-db',   x1: RAM_X+RAM_W/2, y1: RAM_Y, x2: RAM_X+RAM_W/2, y2: DB_Y0, bend: false, type: 'data', label: 'DATA BUS' },
  { id: 'w-ir-db',    x1: IR_X+IR_W/2, y1: IR_Y, x2: IR_X+IR_W/2, y2: DB_Y0, bend: false, type: 'data' },
  { id: 'w-ram-ir',   x1: RAM_X+RAM_W, y1: DB_Y0+DB_GAP*2, x2: IR_X, y2: DB_Y0+DB_GAP*2, type: 'data' },
  { id: 'w-ir-cu',    x1: IR_X+IR_W, y1: IR_Y+14, x2: CU_X, y2: IR_Y+14, type: 'data' },

  // Data bus vertical drops to registers
  { id: 'w-bus-rega', x1: RA_X+RA_W/2, y1: DB_Y0+DB_LINES*DB_GAP, x2: RA_X+RA_W/2, y2: RA_Y, type: 'data' },
  { id: 'w-bus-regb', x1: RB_X+RB_W/2, y1: DB_Y0+DB_LINES*DB_GAP, x2: RB_X+RB_W/2, y2: RB_Y, type: 'data' },

  // ALU connections
  { id: 'w-rega-alu', x1: RA_X+RA_W/2, y1: RA_Y+RA_H, x2: RA_X+RA_W/2, y2: ALU_Y, type: 'data' },
  { id: 'w-regb-alu', x1: RB_X+RB_W/2, y1: RB_Y+RB_H, x2: RB_X+RB_W/2, y2: ALU_Y+ALU_H/2, x3: ALU_X+ALU_W, y3: ALU_Y+ALU_H/2, bend: true, type: 'data' },
  { id: 'w-alu-bus',  x1: ALU_X+ALU_W/2, y1: ALU_Y, x2: ALU_X+ALU_W/2, y2: DB_Y0+DB_LINES*DB_GAP, type: 'data' },
  { id: 'w-alu-rega', x1: ALU_X, y1: ALU_Y+ALU_H/2, x2: RA_X+RA_W/2-16, y2: ALU_Y+ALU_H/2, x3: RA_X+RA_W/2-16, y3: RA_Y+RA_H, bend: true, type: 'data' },

  // ALU → Flags
  { id: 'w-alu-flags', x1: ALU_X+ALU_W/2, y1: ALU_Y+ALU_H, x2: FL_X+FL_W/2, y2: FL_Y, type: 'data' },
  // Flags → CU
  { id: 'w-flags-cu', x1: FL_X+FL_W, y1: FL_Y+FL_H/2, x2: CU_X, y2: FL_Y+FL_H/2, type: 'ctrl' },

  // CU control signals are drawn by _drawBusConnections (right-side spine routing)

  // Output: data bus → out register
  { id: 'w-rega-out', x1: RA_X+RA_W/2, y1: DB_Y0, x2: OUT_X+OUT_W/2, y2: DB_Y0, type: 'data' },
  { id: 'w-out',      x1: OUT_X+OUT_W/2, y1: DB_Y0, x2: OUT_X+OUT_W/2, y2: OUT_Y+OUT_H, type: 'data' },
];

// ─────────────────────────────────────────
//  DIAGRAM STATE (module-level, single instance)
// ─────────────────────────────────────────

let _diagSVG        = null;
let _diagContainer  = null;
let _diagCompEls    = {};   // key -> { g, rect, glow, lbl, val, cells }
let _diagWireEls    = {};   // wireId -> SVG element
let _diagBusEls     = {};   // 'data'|'addr'|'clk' -> array of SVG line els
let _diagPackets    = [];
let _diagRaf        = null;
let _diagBuilt      = false;
let _diagPacketLayer = null;

// ─────────────────────────────────────────
//  BUILD THE DETAILED SCHEMATIC
// ─────────────────────────────────────────

function buildUnifiedCPUDiagram(container) {
  if (_diagBuilt && _diagContainer === container) return;
  _diagBuilt      = true;
  _diagContainer  = container;
  _diagCompEls    = {};
  _diagWireEls    = {};
  _diagBusEls     = { data: [], addr: [], clk: [], ctrl: [] };
  _diagCtrlSigEls = {};  // 'RO' -> [stub, route], 'AI' -> [stub, route], etc.
  _diagPackets    = [];

  // The container gets a scrollable wrapper
  container.innerHTML = '';
  container.style.overflow = 'auto';
  container.style.cursor   = 'grab';

  // SVG — intrinsic size, let container scroll
  const svg = mkSVG('svg', {
    id: 'cpu-unified-svg',
    viewBox: `0 0 ${CPU_W} ${CPU_H}`,
    width:  String(CPU_W),
    height: String(CPU_H),
    style: 'display:block;min-width:' + CPU_W + 'px;',
  });
  _diagSVG = svg;
  container.appendChild(svg);

  // ── Zoom controls ──
  let _zoomLevel = 1.0;
  function applyZoom() {
    svg.style.transformOrigin = '0 0';
    svg.style.transform = `scale(${_zoomLevel.toFixed(3)})`;
    svg.style.width  = String(CPU_W);
    svg.style.height = String(CPU_H);
    const zoomPct = document.getElementById('ov-zoom-pct');
    if (zoomPct) zoomPct.textContent = Math.round(_zoomLevel * 100) + '%';
  }

  // Zoom buttons
  const zoomBar = document.createElement('div');
  zoomBar.style.cssText = 'position:sticky;top:4px;left:4px;z-index:10;display:flex;gap:6px;align-items:center;padding:4px 8px;background:rgba(2,10,20,0.85);border-radius:6px;border:1px solid #1a2a3a;width:fit-content;margin-bottom:-32px;';
  zoomBar.innerHTML = `
    <button id="ov-zoom-out" style="background:#1a2a3a;color:#dde8f4;border:none;border-radius:4px;width:28px;height:28px;font-size:16px;cursor:pointer;font-family:monospace;">−</button>
    <span id="ov-zoom-pct" style="color:#8aa;font-family:monospace;font-size:11px;min-width:36px;text-align:center;">100%</span>
    <button id="ov-zoom-in" style="background:#1a2a3a;color:#dde8f4;border:none;border-radius:4px;width:28px;height:28px;font-size:16px;cursor:pointer;font-family:monospace;">+</button>
    <button id="ov-zoom-fit" style="background:#1a2a3a;color:#8aa;border:none;border-radius:4px;height:28px;padding:0 8px;font-size:10px;cursor:pointer;font-family:monospace;">FIT</button>
  `;
  container.insertBefore(zoomBar, svg);

  document.getElementById('ov-zoom-in').addEventListener('click', () => {
    _zoomLevel = Math.min(3.0, _zoomLevel + 0.15);
    applyZoom();
  });
  document.getElementById('ov-zoom-out').addEventListener('click', () => {
    _zoomLevel = Math.max(0.3, _zoomLevel - 0.15);
    applyZoom();
  });
  document.getElementById('ov-zoom-fit').addEventListener('click', () => {
    const cw = container.clientWidth || 900;
    _zoomLevel = Math.min(cw / CPU_W, 1.0);
    applyZoom();
  });

  // Scroll wheel zoom
  container.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return; // only zoom on Ctrl+scroll
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    _zoomLevel = Math.min(3.0, Math.max(0.3, _zoomLevel + delta));
    applyZoom();
  }, { passive: false });

  // Pinch zoom on mobile
  let _pinchDist = 0;
  let _pinchZoom = 1;
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      _pinchDist = Math.sqrt(dx*dx + dy*dy);
      _pinchZoom = _zoomLevel;
    }
  }, { passive: true });
  container.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      _zoomLevel = Math.min(3.0, Math.max(0.3, _pinchZoom * (dist / _pinchDist)));
      applyZoom();
    }
  }, { passive: false });

  // Initial fit
  setTimeout(() => {
    const cw = container.clientWidth || 900;
    _zoomLevel = Math.min(cw / CPU_W, 1.0);
    applyZoom();
  }, 50);

  // ── Defs: glow filter + tri-state buffer symbol ──
  _buildDefs(svg);

  // ── Background ──
  // Deep radial gradient base
  svg.appendChild(mkSVG('rect', {
    x: 0, y: 0, width: CPU_W, height: CPU_H, fill: 'url(#grad-bg)',
  }));
  // PCB dot grid overlay
  svg.appendChild(mkSVG('rect', {
    x: 0, y: 0, width: CPU_W, height: CPU_H, fill: 'url(#pcb-grid)', opacity: '0.6',
  }));
  // Vignette
  svg.appendChild(mkSVG('rect', {
    x: 0, y: 0, width: CPU_W, height: CPU_H, fill: 'url(#grad-vignette)',
  }));

  // ── Layer order: buses → components → packets ──
  const busLayer  = mkSVG('g', { id: 'cpu-bus-layer'  }); svg.appendChild(busLayer);
  const wireLayer = mkSVG('g', { id: 'cpu-wire-layer' }); svg.appendChild(wireLayer);
  const compLayer = mkSVG('g', { id: 'cpu-comp-layer' }); svg.appendChild(compLayer);
  const pktLayer  = mkSVG('g', { id: 'cpu-packet-layer' }); svg.appendChild(pktLayer);

  // Device icons overlay (for Scene 1 intro — phone, laptop, controller, car)
  const devLayer = mkSVG('g', { id: 'cpu-device-layer', opacity: '0' });
  svg.appendChild(devLayer);
  // Background with radial gradient (deeper black, blurs out the CPU behind)
  const devBg = mkSVG('rect', { x:0, y:0, width: CPU_W, height: CPU_H, fill:'#010408', opacity:'0.97' });
  devLayer.appendChild(devBg);

  // Helper to draw a device icon group
  function _mkDevice(cx, cy, label, color, drawFn) {
    const g = mkSVG('g', { transform: `translate(${cx},${cy})`, class: 'dev-icon' });

    // Card background with gradient and glow
    g.appendChild(mkSVG('rect', {
      x: -60, y: -80, width: 120, height: 140, rx: '12',
      fill: '#000', opacity: '0.5',
    }));
    g.appendChild(mkSVG('rect', {
      x: -60, y: -80, width: 120, height: 140, rx: '12',
      fill: color, opacity: '0.06',
      stroke: color, 'stroke-width': '1', 'stroke-opacity': '0.3',
    }));

    // Draw the actual icon
    drawFn(g);

    // Glowing CPU chip inside each device (warm amber glow)
    const chipG = mkSVG('g', { transform: 'translate(0,10)' });
    chipG.appendChild(mkSVG('rect', {
      x: -9, y: -9, width: 18, height: 18, rx: '3',
      fill: '#1a0e04', stroke: '#ffaa00', 'stroke-width': '1.2',
      filter: 'url(#cpu-glow)',
    }));
    // Pin stubs on chip
    [-6,-1,4].forEach(px => {
      chipG.appendChild(mkSVG('line', { x1: px, y1: -9, x2: px, y2: -12, stroke: '#ffaa00', 'stroke-width': '0.8', opacity: '0.7' }));
      chipG.appendChild(mkSVG('line', { x1: px, y1:  9, x2: px, y2:  12, stroke: '#ffaa00', 'stroke-width': '0.8', opacity: '0.7' }));
    });
    const cpuLbl = mkSVG('text', { x: 0, y: 4, 'text-anchor': 'middle', fill: '#ffaa00', 'font-size': '5', 'font-family': 'monospace', 'font-weight': '700', opacity: '0.9' });
    cpuLbl.textContent = 'CPU';
    chipG.appendChild(cpuLbl);
    g.appendChild(chipG);

    // Label below card
    // Pill background for label
    g.appendChild(mkSVG('rect', {
      x: -34, y: 64, width: 68, height: 16, rx: '8',
      fill: color, opacity: '0.15',
    }));
    const lbl = mkSVG('text', { x: 0, y: 76, 'text-anchor': 'middle', fill: color,
      'font-size': '11', 'font-family': 'monospace', 'font-weight': '700',
      'letter-spacing': '2', opacity: '0.95' });
    lbl.textContent = label;
    g.appendChild(lbl);

    devLayer.appendChild(g);
  }

  // PHONE
  _mkDevice(CPU_W*0.14, CPU_H*0.38, 'PHONE', '#4488ff', (g) => {
    // Phone body (rounded rect)
    g.appendChild(mkSVG('rect', { x: -18, y: -58, width: 36, height: 62, rx: '6',
      fill: '#0a1428', stroke: '#4488ff', 'stroke-width': '1.5', opacity: '0.9' }));
    // Screen
    g.appendChild(mkSVG('rect', { x: -14, y: -54, width: 28, height: 44, rx: '3',
      fill: '#061436', stroke: '#2266aa', 'stroke-width': '0.8', opacity: '0.9' }));
    // Screen shine
    g.appendChild(mkSVG('line', { x1: -10, y1: -50, x2: -4, y2: -42,
      stroke: '#ffffff', 'stroke-width': '1.5', opacity: '0.08', 'stroke-linecap': 'round' }));
    // Home button
    g.appendChild(mkSVG('circle', { cx: 0, cy: -2, r: '4',
      fill: 'none', stroke: '#4488ff', 'stroke-width': '1', opacity: '0.7' }));
    // Camera notch
    g.appendChild(mkSVG('rect', { x: -6, y: -57, width: 12, height: 3, rx: '1.5',
      fill: '#0e2040', opacity: '0.9' }));
    g.appendChild(mkSVG('circle', { cx: 3, cy: -55.5, r: '1.2',
      fill: '#224466', opacity: '0.8' }));
  });

  // LAPTOP
  _mkDevice(CPU_W*0.36, CPU_H*0.38, 'LAPTOP', '#44ddff', (g) => {
    // Screen
    g.appendChild(mkSVG('rect', { x: -30, y: -58, width: 60, height: 40, rx: '4',
      fill: '#040c18', stroke: '#44ddff', 'stroke-width': '1.5', opacity: '0.9' }));
    g.appendChild(mkSVG('rect', { x: -26, y: -54, width: 52, height: 32, rx: '2',
      fill: '#061828', stroke: '#1a6688', 'stroke-width': '0.7', opacity: '0.9' }));
    // Screen shine
    g.appendChild(mkSVG('line', { x1: -22, y1: -50, x2: -14, y2: -38,
      stroke: '#ffffff', 'stroke-width': '2', opacity: '0.07', 'stroke-linecap': 'round' }));
    // Hinge
    g.appendChild(mkSVG('rect', { x: -30, y: -18, width: 60, height: 3, rx: '1',
      fill: '#0a2030', stroke: '#44ddff', 'stroke-width': '0.6', opacity: '0.8' }));
    // Base (keyboard)
    g.appendChild(mkSVG('rect', { x: -34, y: -15, width: 68, height: 14, rx: '3',
      fill: '#0a1824', stroke: '#44ddff', 'stroke-width': '1.2', opacity: '0.9' }));
    // Keyboard keys (tiny rectangles)
    for (let ki = 0; ki < 8; ki++) {
      g.appendChild(mkSVG('rect', { x: -28+ki*8, y: -12, width: 6, height: 4, rx: '1',
        fill: '#1a3a50', opacity: '0.7' }));
    }
    // Touchpad
    g.appendChild(mkSVG('rect', { x: -12, y: -7, width: 24, height: 5, rx: '2',
      fill: 'none', stroke: '#2a5a70', 'stroke-width': '0.7', opacity: '0.7' }));
  });

  // CONSOLE CONTROLLER
  _mkDevice(CPU_W*0.62, CPU_H*0.38, 'CONSOLE', '#bb66ff', (g) => {
    // Main body (controller shape)
    g.appendChild(mkSVG('path', {
      d: 'M-28,-14 C-34,-14,-36,0,-32,10 L-20,16 C-16,20,-10,22,-4,22 L4,22 C10,22,16,20,20,16 L32,10 C36,0,34,-14,28,-14 Z',
      fill: '#0e0520', stroke: '#bb66ff', 'stroke-width': '1.5', opacity: '0.9' }));
    // D-pad (left)
    g.appendChild(mkSVG('rect', { x: -28, y: -8, width: 5, height: 12, rx: '1', fill: '#3a1a5a', opacity: '0.8' }));
    g.appendChild(mkSVG('rect', { x: -32, y: -4, width: 13, height: 5, rx: '1', fill: '#3a1a5a', opacity: '0.8' }));
    // Face buttons (right side)
    g.appendChild(mkSVG('circle', { cx: 20, cy: -8, r: '3', fill: '#ff4488', opacity: '0.8' }));
    g.appendChild(mkSVG('circle', { cx: 26, cy: -2, r: '3', fill: '#ffaa00', opacity: '0.8' }));
    g.appendChild(mkSVG('circle', { cx: 14, cy: -2, r: '3', fill: '#44ff88', opacity: '0.8' }));
    // Thumbstick circles
    g.appendChild(mkSVG('circle', { cx: -14, cy: 6, r: '6', fill: '#2a1040', stroke: '#bb66ff', 'stroke-width': '0.8', opacity: '0.7' }));
    g.appendChild(mkSVG('circle', { cx: 12, cy: 10, r: '6', fill: '#2a1040', stroke: '#bb66ff', 'stroke-width': '0.8', opacity: '0.7' }));
    // Center logo area
    g.appendChild(mkSVG('circle', { cx: 0, cy: -2, r: '5', fill: '#1a0a30', stroke: '#bb66ff', 'stroke-width': '0.8', opacity: '0.7' }));
  });

  // CAR
  _mkDevice(CPU_W*0.86, CPU_H*0.38, 'CAR', '#00ff88', (g) => {
    // Car body (side view)
    g.appendChild(mkSVG('path', {
      d: 'M-35,4 L-28,-12 L-8,-20 L18,-20 L30,-8 L35,4 Z',
      fill: '#041a10', stroke: '#00ff88', 'stroke-width': '1.5', opacity: '0.9' }));
    // Roof
    g.appendChild(mkSVG('path', {
      d: 'M-20,-12 L-12,-26 L14,-26 L22,-12 Z',
      fill: '#051e12', stroke: '#00ff88', 'stroke-width': '1', opacity: '0.9' }));
    // Windows
    g.appendChild(mkSVG('path', {
      d: 'M-16,-12 L-10,-24 L8,-24 L14,-12 Z',
      fill: '#061c28', opacity: '0.8' }));
    // Window shine
    g.appendChild(mkSVG('line', { x1: -12, y1: -22, x2: -6, y2: -14,
      stroke: '#ffffff', 'stroke-width': '1', opacity: '0.1', 'stroke-linecap': 'round' }));
    // Wheels
    g.appendChild(mkSVG('circle', { cx: -18, cy: 6, r: '8',
      fill: '#060e08', stroke: '#00ff88', 'stroke-width': '1.2', opacity: '0.9' }));
    g.appendChild(mkSVG('circle', { cx: -18, cy: 6, r: '4',
      fill: '#0a1e10', opacity: '0.8' }));
    g.appendChild(mkSVG('circle', { cx: 20, cy: 6, r: '8',
      fill: '#060e08', stroke: '#00ff88', 'stroke-width': '1.2', opacity: '0.9' }));
    g.appendChild(mkSVG('circle', { cx: 20, cy: 6, r: '4',
      fill: '#0a1e10', opacity: '0.8' }));
    // Headlight
    g.appendChild(mkSVG('ellipse', { cx: 33, cy: 0, rx: '3', ry: '2',
      fill: '#ffee88', opacity: '0.6', filter: 'url(#pin-glow)' }));
  });

  // "They all have a CPU inside" text — polished pill label
  const titleBg = mkSVG('rect', { x: CPU_W/2-160, y: CPU_H*0.72-18, width: 320, height: 28, rx: '14',
    fill: '#4488ff', opacity: '0.12', stroke: '#4488ff', 'stroke-width': '0.8', 'stroke-opacity': '0.4' });
  devLayer.appendChild(titleBg);
  const devTitle = mkSVG('text', { x: CPU_W/2, y: CPU_H*0.72, 'text-anchor': 'middle',
    fill: '#8ab4f8', 'font-size': '15', 'font-family': 'monospace', 'font-weight': '700',
    'letter-spacing': '1', opacity: '0.95' });
  devTitle.textContent = 'They all have a CPU inside';
  devLayer.appendChild(devTitle);

  // Arrow pointing down
  const arrow = mkSVG('text', { x: CPU_W/2, y: CPU_H*0.8, 'text-anchor': 'middle',
    fill: '#00ff88', 'font-size': '22', opacity: '0.75' });
  arrow.textContent = '\u25BC';
  devLayer.appendChild(arrow);

  // "Let's look inside" text
  const zoomBg = mkSVG('rect', { x: CPU_W/2-90, y: CPU_H*0.85-14, width: 180, height: 22, rx: '11',
    fill: '#00ff88', opacity: '0.08', stroke: '#00ff88', 'stroke-width': '0.6', 'stroke-opacity': '0.35' });
  devLayer.appendChild(zoomBg);
  const zoomText = mkSVG('text', { x: CPU_W/2, y: CPU_H*0.85, 'text-anchor': 'middle',
    fill: '#00ff88', 'font-size': '13', 'font-family': 'monospace', 'font-weight': '600',
    'letter-spacing': '0.5', opacity: '0.8' });
  zoomText.textContent = "Let's look inside...";
  devLayer.appendChild(zoomText);
  _diagPacketLayer = pktLayer;

  // ── Draw buses ──
  _drawBuses(busLayer);

  // ── Draw logical wires (used for packet routing only, mostly invisible) ──
  _drawLogicalWires(wireLayer);

  // ── Draw components ──
  _drawSchematicComponents(compLayer);

  // ── Labels ──
  _drawSchematicLabels(svg);

  // ── Ambient particle layer (floating dust motes) ──
  _buildParticleLayer(svg);

  _startDiagLoop();
}

// ── Ambient floating particle layer ──
function _buildParticleLayer(svg) {
  const layer = mkSVG('g', { id: 'cpu-particle-layer', 'pointer-events': 'none' });
  svg.appendChild(layer);

  const PARTICLE_COUNT = 28;
  const colors = ['#00ff88', '#4488ff', '#ffaa00', '#bb66ff', '#44ddff'];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const x = 40 + Math.random() * (CPU_W - 80);
    const y = 40 + Math.random() * (CPU_H - 80);
    const r = 0.6 + Math.random() * 1.2;
    const col = colors[Math.floor(Math.random() * colors.length)];
    const dur = 6 + Math.random() * 10;
    const delay = -(Math.random() * dur);

    const circle = mkSVG('circle', {
      cx: String(x), cy: String(y), r: String(r),
      fill: col, opacity: '0',
    });

    // CSS animation via inline style
    const dx = (Math.random() - 0.5) * 40;
    const dy = (Math.random() - 0.5) * 40;
    circle.style.cssText = `
      animation: particle-float-${i % 4} ${dur.toFixed(1)}s ${delay.toFixed(1)}s ease-in-out infinite;
      --dx: ${dx.toFixed(0)}px;
      --dy: ${dy.toFixed(0)}px;
    `;
    layer.appendChild(circle);
  }

  // Inject the particle keyframe animations into a style element in the SVG
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = `
    @keyframes particle-float-0 {
      0%,100% { opacity:0; transform:translate(0,0); }
      20%      { opacity:0.35; }
      50%      { opacity:0.18; transform:translate(var(--dx,15px),var(--dy,-12px)); }
      80%      { opacity:0.25; }
    }
    @keyframes particle-float-1 {
      0%,100% { opacity:0; transform:translate(0,0); }
      25%      { opacity:0.28; }
      55%      { opacity:0.14; transform:translate(var(--dx,-10px),var(--dy,18px)); }
      75%      { opacity:0.22; }
    }
    @keyframes particle-float-2 {
      0%,100% { opacity:0; transform:translate(0,0); }
      30%      { opacity:0.32; }
      60%      { opacity:0.12; transform:translate(var(--dx,20px),var(--dy,8px)); }
      85%      { opacity:0.2; }
    }
    @keyframes particle-float-3 {
      0%,100% { opacity:0; transform:translate(0,0); }
      15%      { opacity:0.22; }
      45%      { opacity:0.1;  transform:translate(var(--dx,-18px),var(--dy,-20px)); }
      70%      { opacity:0.18; }
    }
  `;
  svg.insertBefore(styleEl, svg.firstChild);
}

// ── Defs ──
function _buildDefs(svg) {
  const defs = mkSVG('defs', {});

  // ── FILTERS ──

  // Strong glow filter (packets, active components)
  const fGlow = mkSVG('filter', { id: 'cpu-glow', x: '-60%', y: '-60%', width: '220%', height: '220%' });
  fGlow.innerHTML = `
    <feGaussianBlur stdDeviation="4" result="blur1"/>
    <feGaussianBlur stdDeviation="8" result="blur2" in="SourceGraphic"/>
    <feMerge><feMergeNode in="blur2"/><feMergeNode in="blur1"/><feMergeNode in="SourceGraphic"/></feMerge>`;
  defs.appendChild(fGlow);

  // Softer glow for bus lines
  const fBus = mkSVG('filter', { id: 'bus-glow', x: '-15%', y: '-150%', width: '130%', height: '400%' });
  fBus.innerHTML = `
    <feGaussianBlur stdDeviation="3" result="b1"/>
    <feGaussianBlur stdDeviation="6" result="b2" in="SourceGraphic"/>
    <feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>`;
  defs.appendChild(fBus);

  // Drop shadow for component bodies
  const fShadow = mkSVG('filter', { id: 'comp-shadow', x: '-20%', y: '-20%', width: '140%', height: '140%' });
  fShadow.innerHTML = `
    <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.7"/>`;
  defs.appendChild(fShadow);

  // Inner glow filter for bit cells
  const fCell = mkSVG('filter', { id: 'cell-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
  fCell.innerHTML = `
    <feGaussianBlur stdDeviation="2" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>`;
  defs.appendChild(fCell);

  // Pin glow (small, sharp)
  const fPin = mkSVG('filter', { id: 'pin-glow', x: '-100%', y: '-100%', width: '300%', height: '300%' });
  fPin.innerHTML = `
    <feGaussianBlur stdDeviation="1.5" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>`;
  defs.appendChild(fPin);

  // ── PER-COMPONENT GRADIENTS ──
  const gradients = [
    { id: 'grad-clk',   c1: '#0d2e14', c2: '#050f08' },
    { id: 'grad-pc',    c1: '#0a1e2e', c2: '#04101a' },
    { id: 'grad-mar',   c1: '#06182e', c2: '#030c1a' },
    { id: 'grad-ram',   c1: '#061430', c2: '#020818' },
    { id: 'grad-ir',    c1: '#1a1006', c2: '#0c0803' },
    { id: 'grad-cu',    c1: '#1e0808', c2: '#0e0404' },
    { id: 'grad-rega',  c1: '#180a28', c2: '#0c0518' },
    { id: 'grad-regb',  c1: '#180a28', c2: '#0c0518' },
    { id: 'grad-alu',   c1: '#1a1008', c2: '#0e0804' },
    { id: 'grad-flags', c1: '#1a1400', c2: '#0e0c00' },
    { id: 'grad-out',   c1: '#061a10', c2: '#030e08' },
    { id: 'grad-header-green',  c1: '#00ff88', c2: '#00cc66' },
    { id: 'grad-header-teal',   c1: '#44ddff', c2: '#22aacc' },
    { id: 'grad-header-blue',   c1: '#4488ff', c2: '#2266cc' },
    { id: 'grad-header-amber',  c1: '#ffaa00', c2: '#cc8800' },
    { id: 'grad-header-red',    c1: '#ff4444', c2: '#cc2222' },
    { id: 'grad-header-purple', c1: '#bb66ff', c2: '#9944cc' },
    { id: 'grad-header-orange', c1: '#ff8844', c2: '#cc6622' },
  ];
  gradients.forEach(({ id, c1, c2 }) => {
    const g = mkSVG('linearGradient', { id, x1: '0', y1: '0', x2: '0', y2: '1' });
    const s1 = mkSVG('stop', { offset: '0%' }); s1.setAttribute('stop-color', c1);
    const s2 = mkSVG('stop', { offset: '100%' }); s2.setAttribute('stop-color', c2);
    g.appendChild(s1); g.appendChild(s2);
    defs.appendChild(g);
  });

  // ALU trapezoid gradient (lighter top → darker bottom, gives 3D feel)
  const gAlu = mkSVG('linearGradient', { id: 'grad-alu-body', x1: '0', y1: '0', x2: '0', y2: '1' });
  [['0%','#221608'],['50%','#130e06'],['100%','#080502']].forEach(([o,c]) => {
    const s = mkSVG('stop', { offset: o }); s.setAttribute('stop-color', c); gAlu.appendChild(s);
  });
  defs.appendChild(gAlu);

  // Background radial gradient
  const gBg = mkSVG('radialGradient', { id: 'grad-bg', cx: '50%', cy: '48%', r: '65%' });
  [['0%','#041020'],['100%','#010509']].forEach(([o,c]) => {
    const s = mkSVG('stop', { offset: o }); s.setAttribute('stop-color', c); gBg.appendChild(s);
  });
  defs.appendChild(gBg);

  // Vignette gradient
  const gVig = mkSVG('radialGradient', { id: 'grad-vignette', cx: '50%', cy: '50%', r: '70%' });
  const vs1 = mkSVG('stop', { offset: '0%' }); vs1.setAttribute('stop-color', '#000'); vs1.setAttribute('stop-opacity', '0');
  const vs2 = mkSVG('stop', { offset: '100%' }); vs2.setAttribute('stop-color', '#000'); vs2.setAttribute('stop-opacity', '0.5');
  gVig.appendChild(vs1); gVig.appendChild(vs2);
  defs.appendChild(gVig);

  // PCB dot grid pattern
  const pat = mkSVG('pattern', { id: 'pcb-grid', x: '0', y: '0', width: '20', height: '20', patternUnits: 'userSpaceOnUse' });
  const dot = mkSVG('circle', { cx: '10', cy: '10', r: '0.8', fill: '#1a4a2a', opacity: '0.35' });
  pat.appendChild(dot);
  defs.appendChild(pat);

  // Wire gradient (bright source → dim destination)
  const gWire = mkSVG('linearGradient', { id: 'grad-wire-data', x1: '0', y1: '0', x2: '1', y2: '0', gradientUnits: 'userSpaceOnUse' });
  [['0%','#ffcc44'],['100%','#7a5000']].forEach(([o,c]) => {
    const s = mkSVG('stop', { offset: o }); s.setAttribute('stop-color', c); gWire.appendChild(s);
  });
  defs.appendChild(gWire);

  // Bus label pill clip
  const pillMask = mkSVG('clipPath', { id: 'clip-pill' });
  pillMask.appendChild(mkSVG('rect', { x: '0', y: '0', width: '200', height: '16', rx: '8' }));
  defs.appendChild(pillMask);

  svg.insertBefore(defs, svg.firstChild);
}

// _fitDiagramToContainer removed — replaced by interactive zoom controls

// ── Helper: draw a pill-shaped label background + text ──
function _busLabel(layer, x, y, text, color, anchor) {
  const g = mkSVG('g', {});
  const txtEl = mkSVG('text', {
    x, y: y + 5,
    'text-anchor': anchor || 'middle',
    fill: color, 'font-family': 'monospace', 'font-size': '8', 'font-weight': '700',
    'letter-spacing': '0.8', opacity: '0.95',
  });
  txtEl.textContent = text;
  // Draw background pill first (approximate width: 5px per char + 8px padding)
  const tw = text.length * 5 + 8;
  const px = anchor === 'end' ? x - tw : anchor === 'start' ? x : x - tw / 2;
  g.appendChild(mkSVG('rect', {
    x: px - 1, y: y - 3, width: tw + 2, height: 11, rx: '5',
    fill: '#000', opacity: '0.55',
  }));
  g.appendChild(mkSVG('rect', {
    x: px - 1, y: y - 3, width: tw + 2, height: 11, rx: '5',
    fill: color, opacity: '0.08', stroke: color, 'stroke-width': '0.5', 'stroke-opacity': '0.4',
  }));
  g.appendChild(txtEl);
  layer.appendChild(g);
}

// ── Draw the parallel bus lines ──
function _drawBuses(layer) {
  // DATA BUS — 8 amber horizontal lines spanning the diagram
  // PCB trace style: slightly thicker, rounded caps, subtle aura
  const DB_X1 = 40, DB_X2 = CPU_W - 60;
  for (let i = 0; i < DB_LINES; i++) {
    const y = DB_Y0 + i * DB_GAP;

    // Faint aura line (wider, very transparent) — gives PCB trace depth
    layer.appendChild(mkSVG('line', {
      x1: DB_X1, y1: y, x2: DB_X2, y2: y,
      stroke: '#6a4200', 'stroke-width': '4',
      'stroke-linecap': 'round', opacity: '0.12',
    }));

    const el = mkSVG('line', {
      id: `db-line-${i}`,
      x1: DB_X1, y1: y, x2: DB_X2, y2: y,
      stroke: '#4a3200', 'stroke-width': '2',
      'stroke-linecap': 'round', opacity: '0.75',
    });
    layer.appendChild(el);
    _diagBusEls.data.push(el);

    // Bit label
    const t = mkSVG('text', {
      x: DB_X1 - 5, y: y + 3,
      'text-anchor': 'end',
      fill: '#4a3200', 'font-family': 'monospace', 'font-size': '7', opacity: '0.8',
    });
    t.textContent = `D${i}`;
    layer.appendChild(t);
  }

  // DATA BUS pill label
  _busLabel(layer, DB_X1 - 18, DB_Y0 + (DB_LINES * DB_GAP) / 2 - 5, 'DATA BUS', '#7a5a00', 'middle');

  // ADDRESS BUS — 4 blue horizontal lines
  const AB_X1 = 40, AB_X2 = IR_X + IR_W + 20;
  for (let i = 0; i < AB_LINES; i++) {
    const y = AB_Y0 + i * AB_GAP;

    // Aura
    layer.appendChild(mkSVG('line', {
      x1: AB_X1, y1: y, x2: AB_X2, y2: y,
      stroke: '#224488', 'stroke-width': '4',
      'stroke-linecap': 'round', opacity: '0.12',
    }));

    const el = mkSVG('line', {
      id: `ab-line-${i}`,
      x1: AB_X1, y1: y, x2: AB_X2, y2: y,
      stroke: '#0e2e66', 'stroke-width': '2',
      'stroke-linecap': 'round', opacity: '0.75',
    });
    layer.appendChild(el);
    _diagBusEls.addr.push(el);

    const t = mkSVG('text', {
      x: AB_X1 - 5, y: y + 3,
      'text-anchor': 'end',
      fill: '#0e2e66', 'font-family': 'monospace', 'font-size': '7', opacity: '0.8',
    });
    t.textContent = `A${i}`;
    layer.appendChild(t);
  }

  // ADDRESS BUS pill label
  _busLabel(layer, AB_X1 + 60, AB_Y0 - 8, 'ADDRESS BUS  A0\u2013A3', '#1a448a', 'start');

  // CLOCK rail — green dashed line at top, PCB trace style
  const CK_X1 = CLK_X + CLK_W, CK_X2 = CU_X + CU_W;

  // Aura
  layer.appendChild(mkSVG('line', {
    x1: CK_X1, y1: CLK_Y, x2: CK_X2, y2: CLK_Y,
    stroke: '#006633', 'stroke-width': '5',
    'stroke-dasharray': '8 4', 'stroke-linecap': 'round', opacity: '0.1',
  }));

  const clkEl = mkSVG('line', {
    id: 'clk-rail',
    x1: CK_X1, y1: CLK_Y, x2: CK_X2, y2: CLK_Y,
    stroke: '#005530', 'stroke-width': '2',
    'stroke-dasharray': '8 4', 'stroke-linecap': 'round', opacity: '0.85',
  });
  layer.appendChild(clkEl);
  _diagBusEls.clk.push(clkEl);

  // CLK pill label
  _busLabel(layer, CK_X2 + 22, CLK_Y - 3, 'CLK', '#006633', 'middle');
}

// ── Draw logical routing wires (for packet animation) ──
function _drawLogicalWires(layer) {
  // These lines define packet paths AND show signal flow when active.
  const wireColors = { data: '#4a3200', addr: '#0e2e66', clk: '#005530', ctrl: '#2a0a0a' };
  CPU_WIRES.forEach(w => {
    if (w.hidden) return; // packet-only path — visual wire drawn elsewhere
    const pts = _wirePoints(w);
    const baseColor = wireColors[w.type] || '#1a1a2a';
    let el;
    if (pts.length === 2) {
      el = mkSVG('line', {
        id: w.id,
        x1: pts[0][0], y1: pts[0][1], x2: pts[1][0], y2: pts[1][1],
        stroke: baseColor, 'stroke-width': '2',
        'stroke-linecap': 'round', fill: 'none',
        opacity: '0.5',
      });
    } else {
      const pstr = pts.map(p => p.join(',')).join(' ');
      el = mkSVG('polyline', {
        id: w.id,
        points: pstr,
        stroke: baseColor, 'stroke-width': '2',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none',
        opacity: '0.5',
      });
    }
    layer.appendChild(el);
    _diagWireEls[w.id] = el;
  });

  // Visible connection stubs: vertical lines from bus to component pin
  _drawBusConnections(layer);
}

// ── Helper: draw N parallel vertical wires from a component to a bus ──
// cellStartX: X of the first cell's left edge
// count: number of wires (8 for data bus, 4 for address bus)
// compEdgeY: Y of the component edge (top or bottom) — used for tri-state placement only
// busY0: Y of the first bus line (bus line 0)
// busGap: pixels between bus lines
// color: wire color
// withTriState: draw a tri-state buffer triangle on each wire
// dir: 'up' (component below bus, wires go up) or 'down' (component above bus, wires go down)
// triOffset: fraction along wire where tri-state triangle sits (0=compEdge, 1=bus)
// cellY: Y coordinate of the bit cell centers INSIDE the component — wires start/end here
//         (the wire passes through the component border to touch each bit cell)
function _drawParallelBusWires(layer, cellStartX, count, compEdgeY, busY0, busGap, color, withTriState, dir, triOffset, cellY) {
  const PITCH = CELL_W + CELL_GAP; // 14px per cell
  const triOff = (triOffset !== undefined) ? triOffset : 0.35;

  // If cellY not provided, fall back to compEdgeY (legacy behavior)
  const innerY = (cellY !== undefined) ? cellY : compEdgeY;

  // Draw wires left-to-right.
  // Wire i connects cell i center to bus line i.
  // For a data bus: cell 0 (leftmost) = bit (count-1), bus line 0 = D0 (top).
  // We map wire i -> bus line (count-1-i) so that the leftmost wire (MSB)
  // goes to the topmost bus line (D7) and rightmost (LSB) to D0 — no crossings.
  for (let i = 0; i < count; i++) {
    const cellCx = cellStartX + i * PITCH + CELL_W / 2;
    // Map: wire i (left=MSB) connects to bus line (count-1-i)
    const busLineIdx = count - 1 - i;
    const busLineY   = busY0 + busLineIdx * busGap;

    // Vertical wire from bit cell center (inside component) to bus line.
    // The wire passes through the component border, making the connection
    // from bus line all the way into the individual bit cell visible.
    const y1 = dir === 'up' ? busLineY : innerY;
    const y2 = dir === 'up' ? innerY   : busLineY;

    layer.appendChild(mkSVG('line', {
      x1: cellCx, y1, x2: cellCx, y2,
      stroke: color, 'stroke-width': '1',
      'stroke-linecap': 'round', opacity: '0.5',
    }));

    // Bus tap dot at the bus line — with glow ring
    layer.appendChild(mkSVG('circle', {
      cx: cellCx, cy: busLineY,
      r: '4', fill: color, opacity: '0.08',
    }));
    layer.appendChild(mkSVG('circle', {
      cx: cellCx, cy: busLineY,
      r: '2.2', fill: color, opacity: '0.9',
    }));

    // Connection dot at the bit cell endpoint (inside component)
    layer.appendChild(mkSVG('circle', {
      cx: cellCx, cy: innerY,
      r: '1.8', fill: color, opacity: '0.75',
    }));

    // Tri-state buffer triangle — polished filled triangle with inner highlight
    if (withTriState) {
      const edgeY = compEdgeY;
      const midY = dir === 'up'
        ? edgeY + (busLineY - edgeY) * (1 - triOff)
        : edgeY - (edgeY - busLineY) * (1 - triOff);
      const sz = 7;
      let pts, hlPts;
      if (dir === 'up') {
        pts   = `${cellCx-sz/2},${midY+sz/2} ${cellCx+sz/2},${midY+sz/2} ${cellCx},${midY-sz/2}`;
        hlPts = `${cellCx-sz/4},${midY+sz/4} ${cellCx+sz/4},${midY+sz/4} ${cellCx},${midY-sz/4}`;
      } else {
        pts   = `${cellCx-sz/2},${midY-sz/2} ${cellCx+sz/2},${midY-sz/2} ${cellCx},${midY+sz/2}`;
        hlPts = `${cellCx-sz/4},${midY-sz/4} ${cellCx+sz/4},${midY-sz/4} ${cellCx},${midY+sz/4}`;
      }
      // Shadow
      layer.appendChild(mkSVG('polygon', {
        points: pts.replace(/(\d+\.?\d*),(\d+\.?\d*)/g, (_, x, y) => `${+x+0.5},${+y+0.5}`),
        fill: '#000', opacity: '0.35',
      }));
      // Filled body
      layer.appendChild(mkSVG('polygon', {
        points: pts,
        fill: color, stroke: color, 'stroke-width': '0.5', opacity: '0.55',
      }));
      // Inner highlight
      layer.appendChild(mkSVG('polygon', {
        points: hlPts,
        fill: '#fff', opacity: '0.12',
      }));
    }
  }
}

// ── Helper: draw N parallel horizontal wires between two X bounds at a Y band ──
// Used for horizontal bus connections (e.g., MAR → RAM address input).
function _drawParallelHWires(layer, x1, x2, startY, count, gap, color) {
  for (let i = 0; i < count; i++) {
    const y = startY + i * gap;
    layer.appendChild(mkSVG('line', {
      x1, y1: y, x2, y2: y,
      stroke: color, 'stroke-width': '1',
      'stroke-linecap': 'round', opacity: '0.5',
    }));
  }
}

// ── Helper: draw N parallel wires with an L-bend (vertical then horizontal) ──
// Used for REG B → ALU (goes down then turns left)
function _drawParallelLWires(layer, cellStartX, count, fromY, toY, toX, color) {
  const PITCH = CELL_W + CELL_GAP;
  // Spread the horizontal segment over the ALU input width
  const aluSpan = ALU_W - 20; // total ALU input width
  for (let i = 0; i < count; i++) {
    const cellCx = cellStartX + i * PITCH + CELL_W / 2;
    // Horizontal target X spreads across ALU input range
    // Wire 0 (leftmost/MSB) -> left of ALU input, wire count-1 -> right
    const targetX = toX - (count - 1 - i) * (aluSpan / (count - 1));
    layer.appendChild(mkSVG('polyline', {
      points: `${cellCx},${fromY} ${cellCx},${toY} ${targetX},${toY}`,
      stroke: color, 'stroke-width': '1', fill: 'none',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '0.5',
    }));
  }
}

// Draw the parallel-wire connections between components and buses
function _drawBusConnections(layer) {
  // Helper: single vertical stub (used only for clock rails)
  function vstub(x, y1, y2, color, dash) {
    const el = mkSVG('line', {
      x1: x, y1: y1, x2: x, y2: y2,
      stroke: color, 'stroke-width': '1.5',
      'stroke-linecap': 'round', opacity: '0.55',
    });
    if (dash) el.setAttribute('stroke-dasharray', dash);
    layer.appendChild(el);
    return el;
  }
  function dot(x, y, color) {
    // Glow ring
    layer.appendChild(mkSVG('circle', { cx: x, cy: y, r: '5', fill: color, opacity: '0.12' }));
    layer.appendChild(mkSVG('circle', { cx: x, cy: y, r: '3', fill: color, opacity: '0.92' }));
  }
  function hstub(x1, x2, y, color) {
    layer.appendChild(mkSVG('line', {
      x1, y1: y, x2, y2: y,
      stroke: color, 'stroke-width': '1.5', 'stroke-linecap': 'round', opacity: '0.55',
    }));
  }

  const DC = '#9a7400'; // data bus connection color (richer amber)
  const AC = '#2244aa'; // address bus connection color (richer blue)
  const CC = '#8a4a00'; // ctrl connection color
  const CK = '#007744'; // clock color (brighter green)
  // tri-state buffer color (slightly brighter than wires so triangles are visible)
  const TR = '#bb9900';
  const TAR = '#2a60cc'; // tri-state for address bus

  // ─────────────────────────────────────────
  //  DATA BUS connections (8 parallel wires each)
  // ─────────────────────────────────────────

  // REG A (8 cells): cells start at RA_X+4, top of component at RA_Y.
  // Cells are drawn at RA_Y+20; cell center Y = RA_Y+20+CELL_H/2.
  // Wires go from the bit cell centers (inside REG A) UP through the component
  // border and all the way to data bus lines DB_Y0..DB_Y0+7*DB_GAP.
  // Tri-state buffers on each wire (AO signal = output enable) sit between
  // the component top edge and the bus.
  _drawParallelBusWires(
    layer,
    RA_X + 4,                  // cellStartX
    8,                         // count
    RA_Y,                      // compEdgeY (top of REG A — tri-state placed above here)
    DB_Y0,                     // busY0
    DB_GAP,                    // busGap
    DC,                        // color
    true,                      // withTriState (AO tri-state buffers)
    'up',                      // direction
    0.3,                       // tri-state position
    RA_Y + 20 + CELL_H / 2,   // cellY — wire reaches into box to bit cell centers
  );

  // REG A input from data bus (AI signal) — drawn as a second lighter bundle
  // on the same wires; visually the same wires carry both directions.
  // (No separate drawing needed — the wire bundle is bidirectional.)

  // REG B (8 cells): cells start at RB_X+4, top at RB_Y.
  // Cells are drawn at RB_Y+20; cell center Y = RB_Y+20+CELL_H/2.
  // Wires go from bit cell centers inside REG B, through the top border, up to data bus.
  // No tri-state on input path (BI signal directly loads).
  _drawParallelBusWires(
    layer,
    RB_X + 4,
    8,
    RB_Y,
    DB_Y0,
    DB_GAP,
    DC,
    false,             // no tri-state (B is input-only, BI signal is control)
    'up',
    0,
    RB_Y + 20 + CELL_H / 2,   // cellY — wire reaches into box to bit cell centers
  );

  // ALU output to data bus: 8 wires UP with tri-state (EO signal).
  // ALU top is at ALU_Y. The trapezoid body starts at ALU_Y+18.
  // Output taps conceptually exit at the top of the trapezoid body (ALU_Y+18).
  // Use ALU_Y+18+CELL_H/2 as the inner connection point inside the ALU.
  const aluCellStartX = ALU_X + (ALU_W - 8*(CELL_W+CELL_GAP) + CELL_GAP) / 2;
  _drawParallelBusWires(
    layer,
    aluCellStartX,
    8,
    ALU_Y,
    DB_Y0,
    DB_GAP,
    DC,
    true,              // tri-state (EO)
    'up',
    0.28,
    ALU_Y + 18 + CELL_H / 2,  // cellY — wire reaches into ALU trapezoid body
  );

  // RAM ↕ data bus — 8 wires going from the first row of RAM cells (RAM_Y+20),
  // through the RAM top border, up to data bus (DB_Y0=195).
  // RAM grid uses its own cell dimensions (cw=10, cgap=2, pitch=12, offset=RAM_X+16)
  // which differ from the standard CELL_W/CELL_GAP used by registers.
  // Draw each wire manually to match the actual RAM grid column centers.
  {
    const ramGridX = RAM_X + 8 + 8;  // gridX + 8 (address label offset)
    const ramCw = 10, ramCgap = 2;   // RAM cell dimensions (must match _drawRAM)
    const ramCellY = RAM_Y + 20 + 4; // first row cell center Y (ch=9, center≈4.5)

    for (let i = 0; i < 8; i++) {
      // RAM column center X (column i)
      const cellCx = ramGridX + i * (ramCw + ramCgap) + ramCw / 2;
      // Map to bus line: wire i (left=MSB) connects to bus line (7-i)
      const busIdx = 7 - i;
      const busLineY = DB_Y0 + busIdx * DB_GAP;

      // Wire from cell center (inside RAM) up to bus line
      layer.appendChild(mkSVG('line', {
        x1: cellCx, y1: ramCellY, x2: cellCx, y2: busLineY,
        stroke: DC, 'stroke-width': '1', 'stroke-linecap': 'round', opacity: '0.5',
      }));
      // Bus tap dot
      layer.appendChild(mkSVG('circle', {
        cx: cellCx, cy: busLineY, r: '2.2', fill: DC, opacity: '0.85',
      }));
      // Cell connection dot (inside RAM)
      layer.appendChild(mkSVG('circle', {
        cx: cellCx, cy: ramCellY, r: '1.5', fill: DC, opacity: '0.7',
      }));
    }
  }

  // IR ↕ data bus — 8 wires from IR bit cell centers (inside IR box at IR_Y+20+CELL_H/2)
  // through the IR top border and UP to data bus (DB_Y0=195).
  // IR has a nibble gap: high nibble cells start at IR_X+4, low nibble at IR_X+4+4*(CELL_W+CELL_GAP)+6.
  // Draw as two 4-wire bundles: high nibble→D4-D7, low nibble→D0-D3.
  {
    const irCellCenterY = IR_Y + 20 + CELL_H / 2; // Y center of all IR bit cells

    // High nibble (IR bits 4-7, opcode) — 4 wires to D4, D5, D6, D7
    const irHighStartX = IR_X + 4;
    for (let i = 0; i < 4; i++) {
      const cellCx   = irHighStartX + i * (CELL_W + CELL_GAP) + CELL_W / 2;
      // High nibble maps to upper bus lines D4..D7 (index 4..7)
      // Wire i (left=bit3 of opcode) → bus line (7-i), no crossings
      const busIdx   = 7 - i;
      const busLineY = DB_Y0 + busIdx * DB_GAP;
      // Wire from bus line all the way down to bit cell center inside IR
      layer.appendChild(mkSVG('line', {
        x1: cellCx, y1: busLineY, x2: cellCx, y2: irCellCenterY,
        stroke: DC, 'stroke-width': '1', 'stroke-linecap': 'round', opacity: '0.5',
      }));
      // Bus tap dot
      layer.appendChild(mkSVG('circle', { cx: cellCx, cy: busLineY, r: '2.2', fill: DC, opacity: '0.85' }));
      // Cell connection dot (inside IR box)
      layer.appendChild(mkSVG('circle', { cx: cellCx, cy: irCellCenterY, r: '2', fill: DC, opacity: '0.7' }));
    }
    // Low nibble (IR bits 0-3, operand) — 4 wires to D0, D1, D2, D3
    const irLowCellStart = IR_X + 4 + 4 * (CELL_W + CELL_GAP) + 6;
    for (let i = 0; i < 4; i++) {
      const cellCx   = irLowCellStart + i * (CELL_W + CELL_GAP) + CELL_W / 2;
      // Low nibble maps to lower bus lines D3..D0
      const busIdx   = 3 - i;
      const busLineY = DB_Y0 + busIdx * DB_GAP;
      // Wire from bus line all the way down to bit cell center inside IR
      layer.appendChild(mkSVG('line', {
        x1: cellCx, y1: busLineY, x2: cellCx, y2: irCellCenterY,
        stroke: DC, 'stroke-width': '1', 'stroke-linecap': 'round', opacity: '0.5',
      }));
      // Bus tap dot
      layer.appendChild(mkSVG('circle', { cx: cellCx, cy: busLineY, r: '2.2', fill: DC, opacity: '0.85' }));
      // Cell connection dot (inside IR box)
      layer.appendChild(mkSVG('circle', { cx: cellCx, cy: irCellCenterY, r: '2', fill: DC, opacity: '0.7' }));
    }
  }

  // OUTPUT register ↕ data bus — 8 wires connecting bus to output.
  // OUTPUT box: OUT_X=1240, OUT_W=120, spans x=1240..1360. Data bus ends at x=1320.
  // 8 wires at 10px pitch fit within both the output box and bus span.
  // Output is ABOVE the bus (OUT_Y+OUT_H=68 < DB_Y0=195), wires go downward.
  // Wires start INSIDE the output box at the center of the display area (OUT_Y+18+11)
  // and extend DOWN through the bottom border to reach the bus lines.
  {
    const wireSpacing = 10; // tighter pitch to fit within output box & bus width
    const totalSpan   = 7 * wireSpacing; // 70px
    const outWireX0   = OUT_X + (OUT_W - totalSpan) / 2; // centered in output box
    const outCellY    = OUT_Y + 18 + 11; // center of the display rect inside output box
    const compEdgeY   = OUT_Y + OUT_H;   // bottom border of output box
    for (let i = 0; i < 8; i++) {
      const wx       = outWireX0 + i * wireSpacing;
      const busIdx   = 7 - i;  // wire 0 (left) → D7 (bottom bus line), no crossings
      const busLineY = DB_Y0 + busIdx * DB_GAP;
      // Wire from inside output box (display center) down through border to bus line
      layer.appendChild(mkSVG('line', {
        x1: wx, y1: outCellY, x2: wx, y2: busLineY,
        stroke: DC, 'stroke-width': '1', 'stroke-linecap': 'round', opacity: '0.5',
      }));
      // Bus tap dot at bus line
      layer.appendChild(mkSVG('circle', { cx: wx, cy: busLineY, r: '2.2', fill: DC, opacity: '0.85' }));
      // Connection dot inside output box
      layer.appendChild(mkSVG('circle', { cx: wx, cy: outCellY, r: '2', fill: DC, opacity: '0.7' }));
      // Tri-state buffer (OI signal) — between component bottom border and bus line
      const midY = compEdgeY + (busLineY - compEdgeY) * 0.4;
      const sz   = 6;
      layer.appendChild(mkSVG('polygon', {
        points: `${wx-sz/2},${midY-sz/2} ${wx+sz/2},${midY-sz/2} ${wx},${midY+sz/2}`,
        fill: 'none', stroke: DC, 'stroke-width': '1', opacity: '0.75',
      }));
    }
  }

  // ─────────────────────────────────────────
  //  ADDRESS BUS connections (4 parallel wires each)
  // ─────────────────────────────────────────

  // PC → address bus: 4 wires with tri-state (CO signal).
  // PC cells start at PC_X+6, drawn at PC_Y+20; cell center Y = PC_Y+20+CELL_H/2.
  // Wires go from bit cell centers inside PC, through top border, up to address bus.
  _drawParallelBusWires(
    layer,
    PC_X + 6,
    4,
    PC_Y,
    AB_Y0,
    AB_GAP,
    AC,
    true,              // tri-state (CO)
    'up',
    0.35,
    PC_Y + 20 + CELL_H / 2,   // cellY — wire reaches into PC box to bit cell centers
  );

  // MAR ← address bus: 4 wires, no tri-state (MAR is input only, MI signal).
  // MAR cells start at MAR_X+6, drawn at MAR_Y+20; cell center Y = MAR_Y+20+CELL_H/2.
  // Wires go from bit cell centers inside MAR, through top border, up to address bus.
  _drawParallelBusWires(
    layer,
    MAR_X + 6,
    4,
    MAR_Y,
    AB_Y0,
    AB_GAP,
    AC,
    false,
    'up',
    0,
    MAR_Y + 20 + CELL_H / 2,  // cellY — wire reaches into MAR box to bit cell centers
  );

  // IR operand (lower 4 bits) → address bus: 4 STRAIGHT wires down with tri-state (IO signal).
  // Address bus now extends under the IR, so wires go straight down from each cell to its bus line.
  {
    const irLowStartX   = IR_X + 4 + 4 * (CELL_W + CELL_GAP) + 6;
    const irCellCenterY = IR_Y + 20 + CELL_H / 2; // cell center Y inside IR

    for (let i = 0; i < 4; i++) {
      const cellCx   = irLowStartX + i * (CELL_W + CELL_GAP) + CELL_W / 2;
      const busIdx   = 3 - i;  // left cell (MSB) → bottom bus line, no crossings
      const busLineY = AB_Y0 + busIdx * AB_GAP;
      // Tri-state midpoint between IR bottom border and bus
      const irBottom = IR_Y + IR_H;
      const triMidY  = irBottom + (busLineY - irBottom) * 0.35;

      // Straight vertical wire from cell center down to bus line
      layer.appendChild(mkSVG('line', {
        x1: cellCx, y1: irCellCenterY, x2: cellCx, y2: busLineY,
        stroke: AC, 'stroke-width': '1', 'stroke-linecap': 'round', opacity: '0.5',
      }));
      // Bus tap dot
      layer.appendChild(mkSVG('circle', { cx: cellCx, cy: busLineY, r: '2.2', fill: AC, opacity: '0.85' }));
      // Cell connection dot inside IR
      layer.appendChild(mkSVG('circle', { cx: cellCx, cy: irCellCenterY, r: '2', fill: AC, opacity: '0.7' }));
      // Tri-state triangle
      const sz = 6;
      layer.appendChild(mkSVG('polygon', {
        points: `${cellCx-sz/2},${triMidY-sz/2} ${cellCx+sz/2},${triMidY-sz/2} ${cellCx},${triMidY+sz/2}`,
        fill: 'none', stroke: AC, 'stroke-width': '1', opacity: '0.75',
      }));
    }
  }

  // MAR → RAM address input: 4 DIRECT wires — NOT through the address bus.
  // This is a hardwired connection. MAR always feeds RAM.
  // Route: MAR right side → horizontal right → into RAM left side (bypassing the address bus)
  {
    const marRightX = MAR_X + MAR_W;  // MAR right edge
    const ramLeftX = RAM_X;           // RAM left edge
    // MAR output pins on right side, RAM address pins on left side
    const marPinY0 = MAR_Y + 20 + CELL_H / 2;  // center of MAR cells
    const ramAddrPinY0 = RAM_Y + RAM_H / 2 - 1.5 * 8;
    const ramAddrPinGap = 8;
    // Use a distinct color — NOT blue (that's the address bus) — use a lighter cyan/teal
    const directColor = '#00aaaa';
    const directLabel = 'DIRECT — hardwired';

    // Draw a label for the direct connection
    layer.appendChild(mkSVG('text', {
      x: (marRightX + ramLeftX) / 2, y: MAR_Y - 10,
      'text-anchor': 'middle', fill: directColor,
      'font-family': 'monospace', 'font-size': '7', opacity: '0.7',
    })).textContent = 'HARDWIRED (no bus)';

    for (let i = 0; i < 4; i++) {
      const marPinY = marPinY0;  // all MAR cells at same Y
      const marCellCx = MAR_X + 6 + i * (CELL_W + CELL_GAP) + CELL_W / 2;
      const ramPinY = ramAddrPinY0 + (3 - i) * ramAddrPinGap;
      // Route: MAR right → horizontal right to midpoint → up/down to RAM pin Y → into RAM
      const midX = (marRightX + ramLeftX) / 2 + i * 5;  // stagger to avoid overlap

      layer.appendChild(mkSVG('polyline', {
        points: `${marRightX},${marPinY} ${midX},${marPinY} ${midX},${ramPinY} ${ramLeftX},${ramPinY}`,
        stroke: directColor, 'stroke-width': '1.2', fill: 'none',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '0.6',
        'stroke-dasharray': '4 2',  // dashed to distinguish from bus wires
      }));

      // Dot at MAR output
      layer.appendChild(mkSVG('circle', {
        cx: marRightX, cy: marPinY, r: '2', fill: directColor, opacity: '0.7',
      }));
      // Dot at RAM entry point
      layer.appendChild(mkSVG('circle', {
        cx: ramLeftX, cy: ramPinY, r: '2', fill: directColor, opacity: '0.7',
      }));

      // Small "A0"-"A3" label at RAM entry
      const addrLabel = mkSVG('text', {
        x: ramLeftX - 3, y: ramPinY + 2,
        'text-anchor': 'end', fill: AC,
        'font-family': 'monospace', 'font-size': '5', opacity: '0.7',
      });
      addrLabel.textContent = 'A' + (3 - i);
      layer.appendChild(addrLabel);
    }
  }

  // ─────────────────────────────────────────
  //  CLOCK stubs — keep as single dashed vertical drops
  // ─────────────────────────────────────────
  const clkDrops = [
    PC_X + PC_W / 2,
    MAR_X + MAR_W / 2,
    RAM_X + RAM_W / 2,
    IR_X + IR_W / 2,
    RA_X + RA_W / 2,
    CU_X + CU_W / 2,
  ];
  clkDrops.forEach(cx => {
    const compY = _compTopAt(cx);
    if (compY !== null && compY > CLK_Y) {
      vstub(cx, CLK_Y, compY, CK, '3 3');
      dot(cx, CLK_Y, CK);
    }
  });

  // ─────────────────────────────────────────
  //  REG A direct wires to ALU input A (8 parallel wires going down)
  // ─────────────────────────────────────────
  // Each wire starts at the center of a REG A bit cell (RA_Y+20+CELL_H/2, inside the box),
  // exits through the bottom border (RA_Y+RA_H), drops to the ALU trapezoid top (ALU_Y+18+4),
  // then fans out to the ALU A-input spread.
  // A student can trace: bit cell 5 of REG A → down through bottom border → into ALU input A.
  {
    const PITCH = CELL_W + CELL_GAP;
    const raCellCenterY  = RA_Y + 20 + CELL_H / 2; // Y center of REG A bit cells (inside box)
    const aluInputLeftX  = ALU_X + 10;
    const aluInputWidth  = (ALU_W - 20) / 2; // A input covers left half of ALU
    const aluInputY      = ALU_Y + 18 + 4;   // entry point on ALU trapezoid body top
    for (let i = 0; i < 8; i++) {
      const cellCx  = RA_X + 4 + i * PITCH + CELL_W / 2;
      const aluPinX = aluInputLeftX + (i / 7) * aluInputWidth;
      // Wire: from bit cell center inside REG A, down through bottom border, into ALU
      layer.appendChild(mkSVG('polyline', {
        points: `${cellCx},${raCellCenterY} ${cellCx},${aluInputY} ${aluPinX},${aluInputY}`,
        stroke: DC, 'stroke-width': '1', fill: 'none',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '0.5',
      }));
      // Connection dot at REG A bit cell center
      layer.appendChild(mkSVG('circle', { cx: cellCx, cy: raCellCenterY, r: '2', fill: DC, opacity: '0.7' }));
      // Connection dot at ALU input pin
      layer.appendChild(mkSVG('circle', { cx: aluPinX, cy: aluInputY, r: '2', fill: DC, opacity: '0.7' }));
    }
  }

  // ─────────────────────────────────────────
  //  REG B direct wires to ALU input B (8 parallel wires going down then left)
  // ─────────────────────────────────────────
  // Each wire starts at the center of a REG B bit cell (RB_Y+20+CELL_H/2, inside the box),
  // exits through the bottom border (RB_Y+RB_H), then fans left to the ALU right edge
  // at a staggered Y to avoid overlapping. The ALU right edge is at ALU_X+ALU_W.
  {
    const PITCH = CELL_W + CELL_GAP;
    const rbCellCenterY  = RB_Y + 20 + CELL_H / 2; // Y center of REG B bit cells (inside box)
    const aluInputRightX = ALU_X + ALU_W - 10;
    const aluInputWidth  = (ALU_W - 20) / 2;
    const turnY = ALU_Y + ALU_H / 2; // horizontal turn Y level (mid-ALU)
    for (let i = 0; i < 8; i++) {
      const cellCx = RB_X + 4 + i * PITCH + CELL_W / 2;
      // Wire: from bit cell center inside REG B, down through bottom border,
      // turns left at staggered Y to reach ALU right edge
      layer.appendChild(mkSVG('polyline', {
        points: `${cellCx},${rbCellCenterY} ${cellCx},${turnY + i * 2} ${ALU_X + ALU_W},${turnY + i * 2}`,
        stroke: DC, 'stroke-width': '1', fill: 'none',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '0.5',
      }));
      // Connection dot at REG B bit cell center
      layer.appendChild(mkSVG('circle', { cx: cellCx, cy: rbCellCenterY, r: '2', fill: DC, opacity: '0.7' }));
      // Connection dot at ALU right edge entry
      layer.appendChild(mkSVG('circle', { cx: ALU_X + ALU_W, cy: turnY + i * 2, r: '2', fill: DC, opacity: '0.7' }));
    }
  }

  // ─────────────────────────────────────────
  //  ALU → FLAGS (2 parallel wires for CF and ZF)
  // ─────────────────────────────────────────
  // ALU bottom center: ALU_X+ALU_W/2=290. FLAGS top: FL_Y=458. ALU bottom: ALU_Y+ALU_H=435.
  {
    const cfX = ALU_X + ALU_W / 2 - 6;
    const zfX = ALU_X + ALU_W / 2 + 6;
    [cfX, zfX].forEach((x, i) => {
      layer.appendChild(mkSVG('line', {
        x1: x, y1: ALU_Y + ALU_H, x2: x, y2: FL_Y,
        stroke: i === 0 ? OV_COLORS.amber : OV_COLORS.teal,
        'stroke-width': '1', 'stroke-linecap': 'round', opacity: '0.55',
      }));
      layer.appendChild(mkSVG('circle', { cx: x, cy: ALU_Y + ALU_H, r: '2', fill: i===0?OV_COLORS.amber:OV_COLORS.teal, opacity: '0.7' }));
    });
  }

  // ─────────────────────────────────────────
  //  FLAGS → CU (single wire, carry/zero flag status)
  // ─────────────────────────────────────────
  hstub(FL_X + FL_W, CU_X, FL_Y + FL_H / 2, CC);

  // ─────────────────────────────────────────
  //  IR upper nibble → CU: 4 opcode wires
  // ─────────────────────────────────────────
  // IR high nibble cells (IR_X+4 .. IR_X+60) sit at y=IR_Y+20..IR_Y+32.
  // CU left edge is at CU_X=1060, IR right edge at IR_X+IR_W=1010.
  // Route: wires originate at each opcode bit cell's RIGHT edge (inside the IR box),
  // exit through the IR right border, jog across the gap and into the CU left edge.
  // Connection dots are placed at both the cell origin and the CU pin.
  {
    const irHighRightX = IR_X + 4 + 4 * (CELL_W + CELL_GAP) - CELL_GAP; // right edge of high nibble cells
    const cuInputY0    = CU_Y + 20;
    for (let i = 0; i < 4; i++) {
      const cellCenterY = IR_Y + 20 + CELL_H / 2; // all cells at same Y (inside IR box)
      const cuPinY      = cuInputY0 + i * 8;
      // Each wire: from cell right edge inside IR box, across gap, into CU left pin
      const exitX = IR_X + IR_W;  // IR right border
      layer.appendChild(mkSVG('polyline', {
        points: `${irHighRightX},${cellCenterY + i * 3} ${exitX + 5},${cellCenterY + i * 3} ${exitX + 5},${cuPinY} ${CU_X},${cuPinY}`,
        stroke: OV_COLORS.red, 'stroke-width': '1', fill: 'none',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '0.5',
      }));
      // Connection dot at opcode bit cell inside IR box
      layer.appendChild(mkSVG('circle', { cx: irHighRightX, cy: cellCenterY + i * 3, r: '2', fill: OV_COLORS.red, opacity: '0.7' }));
      // Connection dot at CU input pin
      layer.appendChild(mkSVG('circle', { cx: CU_X, cy: cuPinY, r: '2', fill: OV_COLORS.red, opacity: '0.7' }));
    }
  }

  // ─────────────────────────────────────────
  //  CU control signals — exit RIGHT side, branch to components
  // ─────────────────────────────────────────
  // Signals exit from CU right edge, go right to a vertical spine,
  // then branch horizontally left to each destination component.
  const cuRightX = CU_X + CU_W;       // right edge of CU
  const spineX   = cuRightX + 25;     // vertical backbone X

  // Control signals split into two groups:
  // GROUP A: Signals to PC, MAR, OUTPUT, CLK — route directly from spine (right side)
  // GROUP B: Signals to REG A, REG B, RAM, IR, ALU, FLAGS — route through horizontal
  //          control rail UNDER the data bus, enter from LEFT side of each component

  const CTRL_RAIL_Y = DB_Y0 + 8 * DB_GAP + 18; // just below bottom data bus line

  const cuSigsRight = [
    { label: 'CO',  y: CU_Y + 20,  targetX: PC_X + PC_W,    targetY: PC_Y + 10,     color: CC },
    { label: 'CE',  y: CU_Y + 35,  targetX: PC_X + PC_W,    targetY: PC_Y + 24,     color: CC },
    { label: 'J',   y: CU_Y + 50,  targetX: PC_X + PC_W,    targetY: PC_Y + 38,     color: CC },
    { label: 'MI',  y: CU_Y + 65,  targetX: MAR_X + MAR_W,  targetY: MAR_Y + 15,    color: CC },
    { label: 'EO',  y: CU_Y + 176, targetX: ALU_X + ALU_W,  targetY: ALU_Y + 20,    color: CC },
    { label: 'SU',  y: CU_Y + 188, targetX: ALU_X + ALU_W,  targetY: ALU_Y + 35,    color: CC },
    { label: 'FI',  y: CU_Y + 200, targetX: FL_X + FL_W,    targetY: FL_Y + 15,     color: CC },
    { label: 'OI',  y: CU_Y + 212, targetX: OUT_X,           targetY: OUT_Y + 25,    color: CC },
    { label: 'HLT', y: CU_Y + 224, targetX: CLK_X + CLK_W,  targetY: CLK_Y_BOX + 20,color: '#882222' },
  ];

  // Group B targets: tap from control rail into LEFT side of each component
  // targetX = left edge of component, targetY = entry point on left side
  const cuSigsLeft = [
    { label: 'AI',  y: CU_Y + 140, targetX: RA_X,   targetY: RA_Y + 15,    railOff: 0,  color: CC },
    { label: 'AO',  y: CU_Y + 152, targetX: RA_X,   targetY: RA_Y + 30,    railOff: 1,  color: CC },
    { label: 'BI',  y: CU_Y + 164, targetX: RB_X,   targetY: RB_Y + 15,    railOff: 2,  color: CC },
    { label: 'RO',  y: CU_Y + 80,  targetX: RAM_X,  targetY: RAM_Y + 15,   railOff: 3,  color: CC },
    { label: 'RI',  y: CU_Y + 95,  targetX: RAM_X,  targetY: RAM_Y + 30,   railOff: 4,  color: CC },
    { label: 'II',  y: CU_Y + 110, targetX: IR_X,   targetY: IR_Y + 15,    railOff: 5,  color: CC },
    { label: 'IO',  y: CU_Y + 125, targetX: IR_X,   targetY: IR_Y + 30,    railOff: 6,  color: CC },
  ];

  // Draw GROUP A: spine → right side of component
  cuSigsRight.forEach(sig => {
    const stub = mkSVG('line', {
      x1: cuRightX, y1: sig.y, x2: spineX, y2: sig.y,
      stroke: sig.color, 'stroke-width': '1', 'stroke-linecap': 'round', opacity: '0.6',
    });
    layer.appendChild(stub);
    _diagBusEls.ctrl.push(stub);

    const t = mkSVG('text', { x: cuRightX + 3, y: sig.y - 3, 'text-anchor': 'start', fill: sig.color, 'font-family': 'monospace', 'font-size': '6', opacity: '0.85' });
    t.textContent = sig.label;
    layer.appendChild(t);

    layer.appendChild(mkSVG('circle', { cx: spineX, cy: sig.y, r: '1.8', fill: sig.color, opacity: '0.7' }));

    const route = mkSVG('polyline', {
      points: `${spineX},${sig.y} ${spineX},${sig.targetY} ${sig.targetX},${sig.targetY}`,
      stroke: sig.color, 'stroke-width': '0.8', fill: 'none',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '0.4',
    });
    layer.appendChild(route);
    _diagBusEls.ctrl.push(route);

    // Store by signal name for individual highlighting
    if (!_diagCtrlSigEls[sig.label]) _diagCtrlSigEls[sig.label] = [];
    _diagCtrlSigEls[sig.label].push(stub, route);

    layer.appendChild(mkSVG('circle', { cx: sig.targetX, cy: sig.targetY, r: '2', fill: sig.color, opacity: '0.7' }));
  });

  // Horizontal control rail under the data bus
  const railX1 = RA_X - 20;
  const railX2 = spineX;
  const railLine = mkSVG('line', {
    x1: railX1, y1: CTRL_RAIL_Y, x2: railX2, y2: CTRL_RAIL_Y,
    stroke: CC, 'stroke-width': '1', 'stroke-linecap': 'round', opacity: '0.3',
  });
  layer.appendChild(railLine);
  _diagBusEls.ctrl.push(railLine);

  // Draw GROUP B: spine → down to rail → along rail left → DROP DOWN into TOP of component
  cuSigsLeft.forEach(sig => {
    // Stub from CU right edge
    const stub = mkSVG('line', {
      x1: cuRightX, y1: sig.y, x2: spineX, y2: sig.y,
      stroke: sig.color, 'stroke-width': '1', 'stroke-linecap': 'round', opacity: '0.6',
    });
    layer.appendChild(stub);
    _diagBusEls.ctrl.push(stub);

    // Label at CU right edge
    const t = mkSVG('text', { x: cuRightX + 3, y: sig.y - 3, 'text-anchor': 'start', fill: sig.color, 'font-family': 'monospace', 'font-size': '6', opacity: '0.85' });
    t.textContent = sig.label;
    layer.appendChild(t);

    // Dot at spine
    layer.appendChild(mkSVG('circle', { cx: spineX, cy: sig.y, r: '1.8', fill: sig.color, opacity: '0.7' }));

    // Route: spine → down to rail → left along rail → down to component Y → right into left side
    const railY = CTRL_RAIL_Y + sig.railOff * 3;
    const dropX = sig.targetX - 15 - sig.railOff * 2; // stagger the vertical drops to avoid overlap
    const route = mkSVG('polyline', {
      points: `${spineX},${sig.y} ${spineX},${railY} ${dropX},${railY} ${dropX},${sig.targetY} ${sig.targetX},${sig.targetY}`,
      stroke: sig.color, 'stroke-width': '0.8', fill: 'none',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '0.4',
    });
    layer.appendChild(route);
    _diagBusEls.ctrl.push(route);

    // Store by signal name
    if (!_diagCtrlSigEls[sig.label]) _diagCtrlSigEls[sig.label] = [];
    _diagCtrlSigEls[sig.label].push(stub, route);

    // Dot at rail tap point
    layer.appendChild(mkSVG('circle', { cx: dropX, cy: railY, r: '1.5', fill: sig.color, opacity: '0.6' }));

    // Dot at component entry (left side)
    layer.appendChild(mkSVG('circle', { cx: sig.targetX, cy: sig.targetY, r: '2', fill: sig.color, opacity: '0.7' }));

    // Pin label at component left entry
    const pinLbl = mkSVG('text', { x: sig.targetX - 3, y: sig.targetY - 4, 'text-anchor': 'end', fill: sig.color, 'font-family': 'monospace', 'font-size': '5', opacity: '0.7' });
    pinLbl.textContent = sig.label;
    layer.appendChild(pinLbl);
  });

  // Vertical spine line connecting all junction dots — stored for ctrl bus glow
  const allSigs = [...cuSigsRight, ...cuSigsLeft];
  const spineTop = Math.min(...allSigs.map(s => s.y));
  const spineBot = Math.max(...allSigs.map(s => s.y));
  const spineLine = mkSVG('line', {
    x1: spineX, y1: spineTop, x2: spineX, y2: spineBot,
    stroke: CC, 'stroke-width': '0.8', 'stroke-linecap': 'round', opacity: '0.35',
  });
  layer.appendChild(spineLine);
  _diagBusEls.ctrl.push(spineLine);
}

// ── Return top Y of the component whose vertical bus connection is at cx ──
function _compTopAt(cx) {
  const comps = [
    { x: PC_X,  w: PC_W,  y: PC_Y  },
    { x: MAR_X, w: MAR_W, y: MAR_Y },
    { x: RAM_X, w: RAM_W, y: RAM_Y },
    { x: IR_X,  w: IR_W,  y: IR_Y  },
    { x: RA_X,  w: RA_W,  y: RA_Y  },
    { x: CU_X,  w: CU_W,  y: CU_Y  },
  ];
  for (const c of comps) {
    if (Math.abs((c.x + c.w / 2) - cx) < 2) return c.y;
  }
  return null;
}

// ── Draw a tri-state buffer triangle along a vertical wire ──
function _drawTriState(layer, x1, y1, x2, y2, color, dir) {
  const midY = (y1 + y2) / 2;
  const size = 8;
  let pts;
  if (dir === 'up') {
    // Triangle pointing up (signal flows upward toward bus)
    pts = `${x1-size/2},${midY+size/2} ${x1+size/2},${midY+size/2} ${x1},${midY-size/2}`;
  } else {
    // Triangle pointing down (signal flows downward from bus)
    pts = `${x1-size/2},${midY-size/2} ${x1+size/2},${midY-size/2} ${x1},${midY+size/2}`;
  }
  layer.appendChild(mkSVG('polygon', {
    points: pts,
    fill: 'none', stroke: color, 'stroke-width': '1.2', opacity: '0.8',
  }));
}

// ── Draw all components with internal structure ──
function _drawSchematicComponents(layer) {
  // Build each component as a group with header + bit cells
  _drawCLK(layer);
  _drawPC(layer);
  _drawMAR(layer);
  _drawRAM(layer);
  _drawIR(layer);
  _drawCU(layer);
  _drawREGA(layer);
  _drawREGB(layer);
  _drawALU(layer);
  _drawFLAGS(layer);
  _drawOUT(layer);
}

// ── Per-component gradient map ──
const _COMP_GRAD = {
  CLK:   { body: 'grad-clk',   header: 'grad-header-green'  },
  PC:    { body: 'grad-pc',    header: 'grad-header-teal'   },
  MAR:   { body: 'grad-mar',   header: 'grad-header-blue'   },
  RAM:   { body: 'grad-ram',   header: 'grad-header-blue'   },
  IR:    { body: 'grad-ir',    header: 'grad-header-amber'  },
  CU:    { body: 'grad-cu',    header: 'grad-header-red'    },
  REGA:  { body: 'grad-rega',  header: 'grad-header-purple' },
  REGB:  { body: 'grad-regb',  header: 'grad-header-purple' },
  ALU:   { body: 'grad-alu',   header: 'grad-header-orange' },
  FLAGS: { body: 'grad-flags', header: 'grad-header-amber'  },
  OUT:   { body: 'grad-out',   header: 'grad-header-green'  },
};

// ── Generic component box builder ──
// Returns { g, glow, rect, lbl, val }
function _makeCompGroup(layer, key, x, y, w, h, color, title) {
  const g = mkSVG('g', { id: CPU_COMPS[key].id, class: 'cpu-comp', 'data-comp': key });
  const grad = _COMP_GRAD[key] || { body: null, header: null };

  // Outer drop shadow rect (purely decorative)
  g.appendChild(mkSVG('rect', {
    x: x+2, y: y+4, width: w, height: h, rx: '7',
    fill: '#000', opacity: '0.55',
  }));

  // Wide glow halo (behind everything)
  const glow = mkSVG('rect', {
    x: x-6, y: y-6, width: w+12, height: h+12, rx: '10',
    fill: 'none', stroke: color, 'stroke-width': '3',
    opacity: '0', filter: 'url(#cpu-glow)',
  });
  glow.dataset.glowRect = '1';
  g.appendChild(glow);

  // Main body — gradient fill
  const rect = mkSVG('rect', {
    x, y, width: w, height: h, rx: '6',
    fill: grad.body ? `url(#${grad.body})` : '#030d1c',
    stroke: color, 'stroke-width': '1.5',
  });
  rect.dataset.mainRect = '1';
  g.appendChild(rect);

  // Inner highlight border (1px inset, lighter)
  g.appendChild(mkSVG('rect', {
    x: x+1.5, y: y+1.5, width: w-3, height: h-3, rx: '5',
    fill: 'none', stroke: color, 'stroke-width': '0.5', opacity: '0.2',
  }));

  // Header stripe with gradient
  const headerH = 17;
  g.appendChild(mkSVG('rect', {
    x, y, width: w, height: headerH, rx: '6',
    fill: color, opacity: '0.18',
  }));
  // Header bottom edge separator line
  g.appendChild(mkSVG('line', {
    x1: x+6, y1: y+headerH, x2: x+w-6, y2: y+headerH,
    stroke: color, 'stroke-width': '0.5', opacity: '0.3',
  }));

  // Pin-1 marker (triangle notch top-left, like a real DIP IC)
  g.appendChild(mkSVG('circle', {
    cx: x+8, cy: y+8, r: '2.5',
    fill: color, opacity: '0.5',
  }));

  // Title text with subtle glow
  const lbl = mkSVG('text', {
    x: x + w / 2, y: y + 12,
    'text-anchor': 'middle',
    fill: color, 'font-family': 'monospace', 'font-size': '9', 'font-weight': '700',
    'letter-spacing': '1.5',
  });
  lbl.textContent = title;
  g.appendChild(lbl);

  // Dynamic value text (center of box)
  const val = mkSVG('text', {
    x: x + w / 2, y: y + h - 5,
    'text-anchor': 'middle',
    fill: '#ffffff', 'font-family': 'monospace', 'font-size': '9',
    opacity: '0',
  });
  val.dataset.valText = '1';
  g.appendChild(val);

  layer.appendChild(g);
  _diagCompEls[key] = { g, glow, rect, lbl, val, cells: [] };
  return g;
}

// ── Draw N flip-flop bit cells in a row inside a component ──
function _drawBitCells(parentG, startX, startY, n, color, prefix) {
  const cells = [];
  for (let i = 0; i < n; i++) {
    const cx = startX + i * (CELL_W + CELL_GAP);
    const cellG = mkSVG('g', { id: `cell-${prefix}-${i}`, class: 'sch-cell' });

    // Cell shadow
    cellG.appendChild(mkSVG('rect', {
      x: cx+0.5, y: startY+1, width: CELL_W, height: CELL_H, rx: '2.5',
      fill: '#000', opacity: '0.5',
    }));

    // Cell body with gradient-like shading (dark center, lighter border area)
    const r = mkSVG('rect', {
      x: cx, y: startY, width: CELL_W, height: CELL_H, rx: '2.5',
      fill: '#040e1a', stroke: color, 'stroke-width': '1', opacity: '0.95',
    });
    cellG.appendChild(r);

    // Inner highlight (top-left bevel simulation)
    cellG.appendChild(mkSVG('rect', {
      x: cx+1, y: startY+1, width: CELL_W-2, height: CELL_H-2, rx: '1.5',
      fill: 'none', stroke: color, 'stroke-width': '0.4', opacity: '0.18',
    }));

    // Clock edge triangle — more prominent
    const tri = mkSVG('polygon', {
      points: `${cx+1},${startY+CELL_H-3} ${cx+5},${startY+CELL_H-3} ${cx+1},${startY+CELL_H-7}`,
      fill: color, opacity: '0.65',
    });
    cellG.appendChild(tri);

    // LED indicator dot (top-right corner) — dim red by default (= 0)
    const led = mkSVG('circle', {
      cx: cx+CELL_W-2.5, cy: startY+2.5, r: '1.5',
      fill: '#440000', opacity: '0.8',
    });
    led.dataset.led = '1';
    cellG.appendChild(led);

    // Bit label
    const bitLbl = mkSVG('text', {
      x: cx + CELL_W / 2 - 1, y: startY + CELL_H - 3,
      'text-anchor': 'middle',
      fill: color, 'font-family': 'monospace', 'font-size': '5', opacity: '0.55',
    });
    bitLbl.textContent = String(n - 1 - i);
    cellG.appendChild(bitLbl);

    parentG.appendChild(cellG);
    cells.push({ g: cellG, rect: r, led, bit: n - 1 - i });
  }
  return cells;
}

function _drawCLK(layer) {
  const g = _makeCompGroup(layer, 'CLK', CLK_X, CLK_Y_BOX, CLK_W, CLK_H, OV_COLORS.green, 'CLOCK');
  // Waveform background channel
  const midY = CLK_Y_BOX + CLK_H / 2 + 5;
  const waveAreaH = 18;
  g.appendChild(mkSVG('rect', {
    x: CLK_X + 5, y: midY - waveAreaH/2, width: CLK_W - 10, height: waveAreaH, rx: '2',
    fill: '#001a08', opacity: '0.7',
  }));
  // Waveform glow aura (thick blurred line behind)
  const wfPts = [
    CLK_X+8, midY+7,
    CLK_X+8, midY-7,
    CLK_X+19, midY-7,
    CLK_X+19, midY+7,
    CLK_X+30, midY+7,
    CLK_X+30, midY-7,
    CLK_X+41, midY-7,
    CLK_X+41, midY+7,
    CLK_X+52, midY+7,
  ].join(' ');
  g.appendChild(mkSVG('polyline', {
    points: wfPts,
    fill: 'none', stroke: OV_COLORS.green, 'stroke-width': '4',
    'stroke-linecap': 'square', 'stroke-linejoin': 'miter', opacity: '0.18',
  }));
  // Waveform main line (crisp)
  g.appendChild(mkSVG('polyline', {
    points: wfPts,
    fill: 'none', stroke: OV_COLORS.green, 'stroke-width': '1.8',
    'stroke-linecap': 'square', 'stroke-linejoin': 'miter', opacity: '0.9',
    class: 'clk-waveform',
  }));
  // Output pulse dot at right edge (glowing circle = clock output)
  const outX = CLK_X + CLK_W - 3;
  const outY = CLK_Y_BOX + CLK_H / 2;
  g.appendChild(mkSVG('circle', {
    cx: outX, cy: outY, r: '3.5',
    fill: OV_COLORS.green, opacity: '0.85', filter: 'url(#pin-glow)',
    class: 'clk-pulse-dot',
  }));
  // CLK output pin stub
  g.appendChild(mkSVG('line', {
    x1: CLK_X + CLK_W, y1: outY,
    x2: CLK_X + CLK_W + 8, y2: CLK_Y,
    stroke: OV_COLORS.green, 'stroke-width': '1.2', opacity: '0.65',
  }));
  // Frequency label
  g.appendChild(_smallText(CLK_X + CLK_W/2, CLK_Y_BOX + CLK_H - 3, '1 Hz\u2013MHz', OV_COLORS.green, 'middle'));
}

function _drawPC(layer) {
  const g = _makeCompGroup(layer, 'PC', PC_X, PC_Y, PC_W, PC_H, OV_COLORS.teal, 'PC  4-BIT');
  const cells = _drawBitCells(g, PC_X + 6, PC_Y + 20, 4, OV_COLORS.teal, 'PC');
  _diagCompEls['PC'].cells = cells;
  // Pin labels
  _pinLabel(g, PC_X + PC_W / 2, PC_Y + PC_H - 2, 'OUT\u25B3  INC  LOAD', OV_COLORS.teal);
}

function _drawMAR(layer) {
  const g = _makeCompGroup(layer, 'MAR', MAR_X, MAR_Y, MAR_W, MAR_H, OV_COLORS.blue, 'MAR  4-BIT');
  const cells = _drawBitCells(g, MAR_X + 6, MAR_Y + 20, 4, OV_COLORS.blue, 'MAR');
  _diagCompEls['MAR'].cells = cells;
  _pinLabel(g, MAR_X + MAR_W / 2, MAR_Y + MAR_H - 2, 'IN(MI)  HARDWIRED\u2192RAM', OV_COLORS.blue);
}

function _drawRAM(layer) {
  const g = _makeCompGroup(layer, 'RAM', RAM_X, RAM_Y, RAM_W, RAM_H, OV_COLORS.blue, 'RAM  16\u00D78');

  // Grid: 8 rows × 8 cols of cells (showing first 8 rows of 16)
  const gridX = RAM_X + 8;
  const gridY = RAM_Y + 20;
  const cw = 10, ch = 9, cgap = 2;
  const cols = 8, rows = 8;

  // Grid border (chip package look)
  g.appendChild(mkSVG('rect', {
    x: gridX + 6, y: gridY - 2,
    width: cols * (cw + cgap) + 2, height: rows * (ch + cgap) + 4, rx: '3',
    fill: 'none', stroke: OV_COLORS.blue, 'stroke-width': '0.8', opacity: '0.3',
  }));

  for (let r = 0; r < rows; r++) {
    // Alternating row background (subtle spreadsheet-style)
    if (r % 2 === 0) {
      g.appendChild(mkSVG('rect', {
        x: gridX + 6, y: gridY + r * (ch + cgap),
        width: cols * (cw + cgap), height: ch, rx: '0',
        fill: OV_COLORS.blue, opacity: '0.04',
      }));
    }

    // Row address label — brighter, more legible
    const addrLbl = mkSVG('text', {
      x: gridX + 5, y: gridY + r * (ch + cgap) + ch - 1,
      'text-anchor': 'end',
      fill: OV_COLORS.blue, 'font-family': 'monospace', 'font-size': '6', 'font-weight': '700',
      opacity: '0.8',
    });
    addrLbl.textContent = r.toString(16).toUpperCase();
    g.appendChild(addrLbl);

    for (let c = 0; c < cols; c++) {
      const rx = gridX + 8 + c * (cw + cgap);
      const ry = gridY + r * (ch + cgap);

      // Cell shadow
      g.appendChild(mkSVG('rect', {
        x: rx+0.5, y: ry+0.5, width: cw, height: ch, rx: '1',
        fill: '#000', opacity: '0.35',
      }));

      const cell = mkSVG('rect', {
        x: rx, y: ry, width: cw, height: ch, rx: '1.5',
        fill: '#030c1e', stroke: OV_COLORS.blue,
        'stroke-width': '0.7', opacity: '0.8',
        class: 'ram-cell',
      });
      g.appendChild(cell);
    }
  }

  // Ellipsis
  const ellip = mkSVG('text', {
    x: RAM_X + RAM_W / 2, y: gridY + rows * (ch + cgap) + 7,
    'text-anchor': 'middle',
    fill: OV_COLORS.blue, 'font-family': 'monospace', 'font-size': '7', opacity: '0.65',
  });
  ellip.textContent = '\u22EE  (16 rows total)';
  g.appendChild(ellip);

  // Control pins
  _pinLabel(g, RAM_X + 20, RAM_Y + RAM_H - 2, 'RD(RO)', OV_COLORS.green);
  _pinLabel(g, RAM_X + 75, RAM_Y + RAM_H - 2, 'WR(RI)', OV_COLORS.red);
}

function _drawIR(layer) {
  const g = _makeCompGroup(layer, 'IR', IR_X, IR_Y, IR_W, IR_H, OV_COLORS.amber, 'IR  8-BIT');
  // Show split: upper 4 = opcode, lower 4 = operand
  const cellsHigh = _drawBitCells(g, IR_X + 4, IR_Y + 20, 4, OV_COLORS.red, 'IR-H');
  const cellsLow  = _drawBitCells(g, IR_X + 4 + 4*(CELL_W+CELL_GAP) + 6, IR_Y + 20, 4, OV_COLORS.amber, 'IR-L');
  _diagCompEls['IR'].cells = [...cellsHigh, ...cellsLow];

  // Divider
  const divX = IR_X + 4 + 4*(CELL_W+CELL_GAP) + 3;
  g.appendChild(mkSVG('line', {
    x1: divX, y1: IR_Y + 18, x2: divX, y2: IR_Y + 18 + CELL_H + 4,
    stroke: '#888', 'stroke-width': '0.8', 'stroke-dasharray': '2 2', opacity: '0.7',
  }));
  // Labels under split
  const midHigh = IR_X + 4 + 2*(CELL_W+CELL_GAP);
  const midLow  = IR_X + 4 + 4*(CELL_W+CELL_GAP) + 6 + 2*(CELL_W+CELL_GAP);
  g.appendChild(_smallText(midHigh, IR_Y + 20 + CELL_H + 9, 'OPCODE\u2192CU', OV_COLORS.red,  'middle'));
  g.appendChild(_smallText(midLow,  IR_Y + 20 + CELL_H + 9, 'OPERAND\u2192AB', OV_COLORS.amber, 'middle'));
}

function _drawCU(layer) {
  const g = _makeCompGroup(layer, 'CU', CU_X, CU_Y, CU_W, CU_H, OV_COLORS.red, 'CONTROL UNIT');

  // T-state counter cells
  g.appendChild(_smallText(CU_X + 8, CU_Y + 28, 'T-STATE:', OV_COLORS.red, 'start'));
  const tCells = _drawBitCells(g, CU_X + 60, CU_Y + 18, 3, OV_COLORS.red, 'T');
  _diagCompEls['CU'].cells = tCells;

  // Microcode ROM grid (styled like a real ROM chip interior)
  const mcX = CU_X + 8, mcY = CU_Y + 38;
  const mCols = 8, mRows = 6, mcW = 10, mcH = 7, mcG = 2;

  // ROM border
  g.appendChild(mkSVG('rect', {
    x: mcX - 2, y: mcY - 2,
    width: mCols*(mcW+mcG) + 2, height: mRows*(mcH+mcG) + 2, rx: '3',
    fill: 'none', stroke: OV_COLORS.red, 'stroke-width': '0.7', opacity: '0.25',
  }));

  for (let r = 0; r < mRows; r++) {
    // Alternating row tint
    if (r % 2 === 0) {
      g.appendChild(mkSVG('rect', {
        x: mcX, y: mcY + r*(mcH+mcG),
        width: mCols*(mcW+mcG) - mcG, height: mcH, rx: '0',
        fill: OV_COLORS.red, opacity: '0.04',
      }));
    }
    for (let c = 0; c < mCols; c++) {
      // Cell shadow
      g.appendChild(mkSVG('rect', {
        x: mcX + c*(mcW+mcG)+0.5, y: mcY + r*(mcH+mcG)+0.5,
        width: mcW, height: mcH, rx: '1',
        fill: '#000', opacity: '0.3',
      }));
      // Cell body — randomize bits slightly (visual interest)
      const isHigh = Math.random() > 0.6;
      g.appendChild(mkSVG('rect', {
        x: mcX + c*(mcW+mcG), y: mcY + r*(mcH+mcG),
        width: mcW, height: mcH, rx: '1',
        fill: isHigh ? '#200a0a' : '#06101e',
        stroke: OV_COLORS.red, 'stroke-width': '0.5', opacity: '0.7',
      }));
    }
  }
  // ROM label with pill
  const romLabelY = mcY + mRows*(mcH+mcG) + 9;
  g.appendChild(mkSVG('rect', {
    x: CU_X + 8, y: romLabelY - 7, width: CU_W - 16, height: 11, rx: '5',
    fill: OV_COLORS.red, opacity: '0.07',
  }));
  g.appendChild(_smallText(CU_X + CU_W/2, romLabelY, 'MICROCODE ROM', OV_COLORS.red, 'middle'));

  // Output signal list — all 28 control signals the CU can assert (matches
  // the CS definitions in cpu.js).  Laid out in TWO columns on the right
  // edge of the CU so 28 labels fit without overlapping.
  const sigs = [
    // Column 1 (left) — bus I/O + flags + flow-control
    'CO','CE','MI','RO','RI','II','IO','AI','AO','BI','BO','EO','OI','FI',
    // Column 2 (right) — ALU modes + halt/jump + stack + input
    'SU','ANDI','ORI','XORI','SHLI','SHRI','HLT','J','PCI','SPO','SPI','SPD','SPUP','INO',
  ];
  const perCol = Math.ceil(sigs.length / 2);       // 14
  const colStartY = CU_Y + 24;
  const colEndY   = CU_Y + CU_H - 14;
  const rowSpacing = (colEndY - colStartY) / (perCol - 1);
  sigs.forEach((s, i) => {
    const col = Math.floor(i / perCol);            // 0 or 1
    const row = i % perCol;
    const sy  = colStartY + row * rowSpacing;
    // Two columns side by side — column 0 is the left one, column 1 the right
    const labelX = (col === 0) ? (CU_X + CU_W - 36) : (CU_X + CU_W - 10);
    const stubEndX = labelX + 8;
    const isActive = i % 3 === 0;
    // Label
    g.appendChild(mkSVG('text', {
      x: labelX, y: sy, 'text-anchor': 'end',
      fill: OV_COLORS.orange,
      'font-family': 'monospace', 'font-size': '6', 'font-weight': '700',
      opacity: '0.9',
    })).textContent = s;
    // Stub line from label to slightly right
    g.appendChild(mkSVG('line', {
      x1: labelX + 1, y1: sy - 2, x2: stubEndX, y2: sy - 2,
      stroke: OV_COLORS.orange, 'stroke-width': '0.6', opacity: isActive ? '0.7' : '0.35',
    }));
    // End dot
    g.appendChild(mkSVG('circle', {
      cx: stubEndX, cy: sy - 2, r: '0.9',
      fill: OV_COLORS.orange, opacity: isActive ? '0.8' : '0.35',
    }));
  });
}

function _drawREGA(layer) {
  const g = _makeCompGroup(layer, 'REGA', RA_X, RA_Y, RA_W, RA_H, OV_COLORS.purple, 'REG A  8-BIT');
  const cells = _drawBitCells(g, RA_X + 4, RA_Y + 20, 8, OV_COLORS.purple, 'A');
  _diagCompEls['REGA'].cells = cells;
  _pinLabel(g, RA_X + RA_W / 2, RA_Y + RA_H - 2, 'IN(AI)  OUT\u25B3(AO)', OV_COLORS.purple);
}

function _drawREGB(layer) {
  const g = _makeCompGroup(layer, 'REGB', RB_X, RB_Y, RB_W, RB_H, OV_COLORS.purple, 'REG B  8-BIT');
  const cells = _drawBitCells(g, RB_X + 4, RB_Y + 20, 8, OV_COLORS.purple, 'B');
  _diagCompEls['REGB'].cells = cells;
  _pinLabel(g, RB_X + RB_W / 2, RB_Y + RB_H - 2, 'IN(BI)  DIRECT\u2192ALU', OV_COLORS.purple);
}

function _drawALU(layer) {
  const g = _makeCompGroup(layer, 'ALU', ALU_X, ALU_Y, ALU_W, ALU_H, OV_COLORS.orange, 'ALU  \u03A3');

  // Trapezoid shadow
  const tx = ALU_X + 10, ty = ALU_Y + 19;
  const tw = ALU_W - 20, th = ALU_H - 23;
  g.appendChild(mkSVG('polygon', {
    points: `${tx+2},${ty+2} ${tx+tw+2},${ty+2} ${tx+tw-8},${ty+th+2} ${tx+12},${ty+th+2}`,
    fill: '#000', opacity: '0.5',
  }));

  // Trapezoid body — gradient fill (lighter top, darker bottom for 3D effect)
  g.appendChild(mkSVG('polygon', {
    points: `${tx},${ty} ${tx+tw},${ty} ${tx+tw-10},${ty+th} ${tx+10},${ty+th}`,
    fill: 'url(#grad-alu-body)', stroke: OV_COLORS.orange, 'stroke-width': '1.2', opacity: '0.95',
  }));

  // Inner highlight on trapezoid top edge
  g.appendChild(mkSVG('line', {
    x1: tx+4, y1: ty+1, x2: tx+tw-4, y2: ty+1,
    stroke: OV_COLORS.orange, 'stroke-width': '0.6', opacity: '0.25',
  }));

  // Input arrows (triangles pointing into trapezoid from top)
  // A input arrow (left)
  const arrowX = tx + 14, arrowY = ty;
  g.appendChild(mkSVG('polygon', {
    points: `${arrowX-4},${arrowY-5} ${arrowX+4},${arrowY-5} ${arrowX},${arrowY+2}`,
    fill: OV_COLORS.purple, opacity: '0.5',
  }));
  // B input arrow (right)
  const arrowX2 = tx + tw - 14;
  g.appendChild(mkSVG('polygon', {
    points: `${arrowX2-4},${arrowY-5} ${arrowX2+4},${arrowY-5} ${arrowX2},${arrowY+2}`,
    fill: OV_COLORS.purple, opacity: '0.5',
  }));

  // Sigma — larger, glowing
  const sigLbl = mkSVG('text', {
    x: ALU_X + ALU_W/2, y: ALU_Y + ALU_H/2 + 16,
    'text-anchor': 'middle',
    fill: OV_COLORS.orange, 'font-family': 'monospace', 'font-size': '20', 'font-weight': '700',
    opacity: '0.85', filter: 'url(#pin-glow)',
  });
  sigLbl.textContent = '\u03A3';
  g.appendChild(sigLbl);

  // A/B labels
  g.appendChild(_smallText(tx + 4, ty + 8, 'A', OV_COLORS.purple, 'start'));
  g.appendChild(_smallText(tx + tw - 4, ty + 8, 'B', OV_COLORS.purple, 'end'));

  // ALU mode-control pins — one per mode signal from the CU.  SU is the
  // subtract flag; the rest switch the ALU between AND / OR / XOR / SHL /
  // SHR.  All six sit ABOVE the component box (out of the header stripe),
  // each with a visible stub line pointing down into the trapezoid top.
  // No mode asserted = ADD.
  const modes = ['ANDI', 'ORI', 'XORI', 'SHLI', 'SHRI', 'SU'];
  const modeLeft  = ALU_X + 6;
  const modeRight = ALU_X + ALU_W - 6;
  const modeStep  = (modeRight - modeLeft) / (modes.length - 1);
  modes.forEach((mode, i) => {
    const mx = modeLeft + i * modeStep;
    // Label floats above the component box
    const modeLbl = mkSVG('text', {
      x: mx, y: ALU_Y - 8, 'text-anchor': 'middle',
      fill: OV_COLORS.red,
      'font-family': 'monospace', 'font-size': '6', 'font-weight': '700',
      opacity: '0.95',
    });
    modeLbl.textContent = mode;
    g.appendChild(modeLbl);
    // Stub line from label down through the header stripe into the trapezoid
    g.appendChild(mkSVG('line', {
      x1: mx, y1: ALU_Y - 5, x2: mx, y2: ty,
      stroke: OV_COLORS.red, 'stroke-width': '0.7', opacity: '0.7',
    }));
    // Pin dot at the trapezoid top edge
    g.appendChild(mkSVG('circle', {
      cx: mx, cy: ty, r: '1.3',
      fill: OV_COLORS.red, opacity: '0.9',
    }));
  });

  // CF/ZF outputs
  g.appendChild(_smallText(ALU_X + 4, ALU_Y + ALU_H - 2, 'CF', OV_COLORS.amber, 'start'));
  g.appendChild(_smallText(ALU_X + 32, ALU_Y + ALU_H - 2, 'ZF', OV_COLORS.teal, 'start'));
}

function _drawFLAGS(layer) {
  const g = _makeCompGroup(layer, 'FLAGS', FL_X, FL_Y, FL_W, FL_H, OV_COLORS.amber, 'FLAGS');

  // CF cell — styled like a real flip-flop register bit
  const cfG = mkSVG('g', {});
  cfG.appendChild(mkSVG('rect', { x: FL_X+7, y: FL_Y+20, width: 22, height: 18, rx: '4',
    fill: '#000', opacity: '0.4' }));
  cfG.appendChild(mkSVG('rect', { x: FL_X+7, y: FL_Y+20, width: 22, height: 18, rx: '4',
    fill: '#080d08', stroke: OV_COLORS.amber, 'stroke-width': '1.3', opacity: '0.95' }));
  // Inner bevel
  cfG.appendChild(mkSVG('rect', { x: FL_X+8, y: FL_Y+21, width: 20, height: 16, rx: '3',
    fill: 'none', stroke: OV_COLORS.amber, 'stroke-width': '0.4', opacity: '0.2' }));
  // LED dot
  cfG.appendChild(mkSVG('circle', { cx: FL_X+26, cy: FL_Y+24, r: '2',
    fill: '#440000', opacity: '0.85' }));
  cfG.appendChild(_smallText(FL_X + 18, FL_Y + 33, 'CF', OV_COLORS.amber, 'middle'));
  g.appendChild(cfG);

  // ZF cell
  const zfG = mkSVG('g', {});
  zfG.appendChild(mkSVG('rect', { x: FL_X+37, y: FL_Y+20, width: 22, height: 18, rx: '4',
    fill: '#000', opacity: '0.4' }));
  zfG.appendChild(mkSVG('rect', { x: FL_X+37, y: FL_Y+20, width: 22, height: 18, rx: '4',
    fill: '#080d0d', stroke: OV_COLORS.teal, 'stroke-width': '1.3', opacity: '0.95' }));
  cfG.appendChild(mkSVG('rect', { x: FL_X+38, y: FL_Y+21, width: 20, height: 16, rx: '3',
    fill: 'none', stroke: OV_COLORS.teal, 'stroke-width': '0.4', opacity: '0.2' }));
  // LED dot
  zfG.appendChild(mkSVG('circle', { cx: FL_X+56, cy: FL_Y+24, r: '2',
    fill: '#004440', opacity: '0.85' }));
  zfG.appendChild(_smallText(FL_X + 48, FL_Y + 33, 'ZF', OV_COLORS.teal, 'middle'));
  g.appendChild(zfG);

  g.appendChild(_smallText(FL_X + FL_W / 2, FL_Y + FL_H - 2, 'FI  \u2192CU(J/JZ/JC)', OV_COLORS.amber, 'middle'));
}

function _drawOUT(layer) {
  const g = _makeCompGroup(layer, 'OUT', OUT_X, OUT_Y, OUT_W, OUT_H, OV_COLORS.green, 'OUTPUT');

  // 8 bit cells (like registers)
  const cells = _drawBitCells(g, OUT_X + 4, OUT_Y + 20, 8, OV_COLORS.green, 'OUT');
  _diagCompEls['OUT'].cells = cells;

  // Display area below cells
  const dispY = OUT_Y + 42;
  g.appendChild(mkSVG('rect', {
    x: OUT_X + 10, y: dispY, width: OUT_W - 20, height: 22, rx: '4',
    fill: '#010c06', stroke: OV_COLORS.green, 'stroke-width': '1.2', opacity: '0.95',
  }));

  // Display text (glowing green digits)
  const dispLbl = mkSVG('text', {
    x: OUT_X + OUT_W / 2, y: dispY + 15,
    'text-anchor': 'middle',
    fill: OV_COLORS.green, 'font-family': 'monospace', 'font-size': '12', 'font-weight': '700',
    opacity: '0.9', 'letter-spacing': '3',
    filter: 'url(#pin-glow)',
  });
  dispLbl.textContent = '0';
  _diagCompEls['OUT'].dispLbl = dispLbl;
  g.appendChild(dispLbl);
  g.appendChild(_smallText(OUT_X + OUT_W/2, OUT_Y + OUT_H - 2, 'IN(OI)', OV_COLORS.green, 'middle'));
}

// ── Helper: small monospace text ──
function _smallText(x, y, text, color, anchor) {
  const t = mkSVG('text', {
    x, y, 'text-anchor': anchor || 'middle',
    fill: color, 'font-family': 'monospace', 'font-size': '7', opacity: '0.85',
  });
  t.textContent = text;
  return t;
}

// ── Helper: pin label at bottom of component ──
function _pinLabel(g, x, y, text, color) {
  g.appendChild(_smallText(x, y, text, color, 'middle'));
}

// ── Schematic labels (bus names, etc.) ──
function _drawSchematicLabels(svg) {
  // Watermark / title label — pill style, bottom right
  svg.appendChild(mkSVG('rect', {
    x: CPU_W - 196, y: CPU_H - 22, width: 188, height: 15, rx: '7',
    fill: '#000', opacity: '0.35',
  }));
  const info = mkSVG('text', {
    x: CPU_W - 12, y: CPU_H - 11,
    'text-anchor': 'end',
    fill: '#2a4a6a', 'font-family': 'monospace', 'font-size': '8', 'letter-spacing': '1',
  });
  info.textContent = 'SAP-1  8-BIT CPU  (schematic)';
  svg.appendChild(info);
}

// ─────────────────────────────────────────
//  ANIMATION LOOP
// ─────────────────────────────────────────

function _startDiagLoop() {
  if (_diagRaf) cancelAnimationFrame(_diagRaf);
  function loop(ts) {
    _tickPackets(ts);
    _diagRaf = requestAnimationFrame(loop);
  }
  _diagRaf = requestAnimationFrame(loop);
}

function _stopDiagLoop() {
  if (_diagRaf) { cancelAnimationFrame(_diagRaf); _diagRaf = null; }
}

// ─────────────────────────────────────────
//  PACKET SYSTEM
// ─────────────────────────────────────────

function _spawnPacket(wireId, color, repeat, delay, reverse) {
  const wire = CPU_WIRES.find(w => w.id === wireId);
  if (!wire || !_diagPacketLayer) return;
  const pts = _wirePoints(wire);
  if (pts.length < 2) return;
  // Reverse direction: packet travels end→start (e.g. bus→component instead of component→bus)
  if (reverse) pts.reverse();

  // Light up the wire path the packet is traveling on
  _lightWire(wireId, true);

  const pkt = {
    wireId,
    color: color || OV_COLORS.green,
    pts,
    t: -(delay || 0) / 1000,
    speed: 0.4,
    repeat: repeat !== false,
    el: null,
    done: false,
  };
  const el = mkSVG('circle', {
    r: '5', fill: pkt.color, opacity: '0', filter: 'url(#cpu-glow)',
  });
  _diagPacketLayer.appendChild(el);
  pkt.el = el;
  _diagPackets.push(pkt);
  return pkt;
}

function _wirePoints(wire) {
  if (wire.bend2) {
    return [[wire.x1,wire.y1],[wire.x2,wire.y2],[wire.x3,wire.y3],[wire.x4,wire.y4]];
  } else if (wire.bend) {
    return [[wire.x1,wire.y1],[wire.x2,wire.y2],[wire.x3,wire.y3]];
  } else {
    return [[wire.x1,wire.y1],[wire.x2,wire.y2]];
  }
}

function _lerpAlongPath(pts, t) {
  let totalLen = 0;
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0]-pts[i-1][0], dy = pts[i][1]-pts[i-1][1];
    const len = Math.sqrt(dx*dx+dy*dy);
    segs.push(len); totalLen += len;
  }
  const target = t * totalLen;
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= target) {
      const lt = (target - acc) / segs[i];
      return [
        pts[i][0] + (pts[i+1][0]-pts[i][0]) * lt,
        pts[i][1] + (pts[i+1][1]-pts[i][1]) * lt,
      ];
    }
    acc += segs[i];
  }
  return pts[pts.length-1];
}

let _lastTs = 0;
function _tickPackets(ts) {
  const dt = _lastTs ? (ts - _lastTs) / 1000 : 0;
  _lastTs = ts;

  _diagPackets = _diagPackets.filter(pkt => {
    if (pkt.done) { if (pkt.el) pkt.el.remove(); return false; }
    pkt.t += pkt.speed * dt;
    if (pkt.t < 0) { if (pkt.el) pkt.el.setAttribute('opacity', '0'); return true; }
    if (pkt.t > 1) {
      if (pkt.repeat) { pkt.t = 0; }
      else { pkt.done = true; return true; }
    }
    const pos = _lerpAlongPath(pkt.pts, Math.min(pkt.t, 1));
    if (pkt.el) {
      pkt.el.setAttribute('cx', pos[0]);
      pkt.el.setAttribute('cy', pos[1]);
      const fade = pkt.t < 0.1 ? pkt.t / 0.1 : pkt.t > 0.85 ? (1-pkt.t)/0.15 : 1;
      pkt.el.setAttribute('opacity', Math.max(0, Math.min(1, fade)).toFixed(2));
    }
    return true;
  });
}

// Track which hardwired pulses are active to avoid duplicate spawns.
// Reset when packets are cleared (sentence/page change).
let _hwPulseActive = {};

function _clearPackets() {
  _diagPackets.forEach(pkt => { if (pkt.el) pkt.el.remove(); });
  _diagPackets = [];
  _hwPulseActive = {};  // reset — next _showCompVal will re-spawn hardwired pulses
  // Dim all wire paths
  Object.keys(_diagWireEls).forEach(id => _lightWire(id, false));
  _setBusActive('data', false);
  _setBusActive('addr', false);
  _setBusActive('clk', false);
}

// ─────────────────────────────────────────
//  SCENE EFFECT ENGINE
// ─────────────────────────────────────────

let _sceneTimers = [];
function _clearSceneTimers() { _sceneTimers.forEach(id => { clearTimeout(id); clearInterval(id); }); _sceneTimers = []; _clearAutoPlayTimers(); }

// Auto-play timers tracked separately so TTS can cancel them without killing blink intervals
let _autoPlayTimers = [];
function _clearAutoPlayTimers() { _autoPlayTimers.forEach(id => clearTimeout(id)); _autoPlayTimers = []; }

// Light or dim a full set of bus lines
function _setBusActive(busType, on) {
  const els = _diagBusEls[busType] || [];
  const colors = {
    data: { on: '#ffaa00', off: '#3a2800' },
    addr: { on: '#4488ff', off: '#0a1e44' },
    clk:  { on: '#00ff88', off: '#004422' },
    ctrl: { on: '#ff4444', off: '#2a0a0a' },
  };
  const c = colors[busType] || colors.data;
  els.forEach(el => {
    if (on) {
      el.setAttribute('opacity', '1');
      el.setAttribute('stroke', c.on);
      el.setAttribute('stroke-width', '5');
      el.setAttribute('filter', 'url(#bus-glow)');
    } else {
      el.setAttribute('stroke', c.off);
      el.setAttribute('stroke-width', '2');
      el.setAttribute('opacity', '0.6');
      el.removeAttribute('filter');
    }
  });
}

// Highlight or dim a component
function _applyCompHighlights(highlights) {
  Object.keys(CPU_COMPS).forEach(key => {
    const els = _diagCompEls[key];
    if (!els) return;
    const active = !highlights || highlights.includes(key);
    const op = active ? '1' : '0.08';
    els.rect.setAttribute('opacity', op);
    els.lbl.setAttribute('opacity', op);
    if (els.val) els.val.setAttribute('opacity', '0');
    els.glow.setAttribute('opacity', active ? '0.65' : '0');
    // Clear stale cells when dimming; don't touch cells when active (they reflect real content)
    if (!active) _clearCells(key);
  });
}

// Legacy wire helper — thin logical wires are transparent, so we only pulse bus lines
function _lightWire(id, on) {
  // Light up the individual wire path
  const el = _diagWireEls[id];
  if (el) {
    const w = CPU_WIRES.find(x => x.id === id);
    const activeColors = { data: '#ffaa00', addr: '#4488ff', clk: '#00ff88', ctrl: '#ff4444' };
    const dimColors    = { data: '#4a3200', addr: '#0e2e66', clk: '#005530', ctrl: '#2a0a0a' };
    const type = w ? w.type : 'data';
    if (on) {
      el.setAttribute('stroke', activeColors[type] || '#ffaa00');
      el.setAttribute('stroke-width', '3');
      el.setAttribute('opacity', '0.9');
      el.setAttribute('filter', 'url(#cpu-glow)');
    } else {
      el.setAttribute('stroke', dimColors[type] || '#1a1a2a');
      el.setAttribute('stroke-width', '2');
      el.setAttribute('opacity', '0.5');
      el.removeAttribute('filter');
    }
  }
  // Also toggle the bus type
  const w = CPU_WIRES.find(x => x.id === id);
  if (!w) return;
  if (w.type === 'data') _setBusActive('data', on);
  if (w.type === 'addr') _setBusActive('addr', on);
  if (w.type === 'clk')  _setBusActive('clk',  on);
}

function _showCompVal(key, text) {
  const els = _diagCompEls[key];
  if (!els || !els.val) return;
  els.val.textContent = text;
  els.val.setAttribute('opacity', '1');

  // AUTO-FILL BINARY CELLS: if text is a pure number, show the bits in the cells.
  const num = parseInt(text, 10);
  const isNum = !isNaN(num) && String(num) === String(text).trim();
  if (isNum) {
    const compColors = { PC: OV_COLORS.teal, MAR: OV_COLORS.blue, RAM: OV_COLORS.amber,
      IR: OV_COLORS.amber, REGA: OV_COLORS.purple, REGB: OV_COLORS.purple,
      ALU: OV_COLORS.orange, FLAGS: OV_COLORS.amber, OUT: OV_COLORS.green, CU: OV_COLORS.red };
    _showBinaryInCells(key, num, compColors[key] || OV_COLORS.green);
  }

  // Hardwired links for value context (MAR address → RAM row highlight)
  if (key === 'MAR' && isNum) {
    _glowComp('RAM');
    _highlightRAMRow(Math.min(num, 7)); // visually select the addressed row
  }
  if (key === 'IR') {
    _glowComp('CU');
  }
  // Note: wire lighting + pulses are handled by _enforceHardwiredLinks()
  // which is called from _glowComp, _fireComp, and _receiveComp.
}

function _hideCompVal(key) {
  const els = _diagCompEls[key];
  if (!els || !els.val) return;
  els.val.setAttribute('opacity', '0');
  _clearCells(key); // also clear the bit cells — no stale dummy values
}

function _pulseComp(key) {
  const els = _diagCompEls[key];
  if (!els) return;
  els.glow.setAttribute('opacity', '1');
  setTimeout(() => { if (els.glow) els.glow.setAttribute('opacity', '0.65'); }, 500);
}

// Flash bit cells in a component (simulates data loading)
function _flashCells(key, color) {
  const els = _diagCompEls[key];
  if (!els || !els.cells) return;
  const fc = color || OV_COLORS.green;
  els.cells.forEach((c, i) => {
    setTimeout(() => {
      if (c.rect) {
        // Bright fill sweep
        c.rect.setAttribute('fill', fc);
        c.rect.setAttribute('opacity', '1');
        c.rect.setAttribute('filter', 'url(#cell-glow)');
        // LED turns green on flash
        if (c.led) {
          c.led.setAttribute('fill', '#00ff44');
          c.led.setAttribute('opacity', '1');
          c.led.setAttribute('r', '2');
        }
        setTimeout(() => {
          if (c.rect) {
            c.rect.setAttribute('fill', '#040e1a');
            c.rect.setAttribute('opacity', '0.95');
            c.rect.removeAttribute('filter');
          }
          if (c.led) {
            c.led.setAttribute('fill', '#440000');
            c.led.setAttribute('opacity', '0.8');
            c.led.setAttribute('r', '1.5');
          }
        }, 380);
      }
    }, i * 60);
  });
}

// ─────────────────────────────────────────
//  BINARY VALUE DISPLAY
// ─────────────────────────────────────────

// Show a binary value in a component's bit cells
// Cells where the bit is 1 glow bright, cells where bit is 0 stay dim
function _showBinaryInCells(key, value, colorOn, colorOff) {
  const els = _diagCompEls[key];
  if (!els || !els.cells) return;
  const v = value & 0xFF;
  const on  = colorOn  || OV_COLORS.green;
  const off = colorOff || '#040e1a';
  els.cells.forEach((c, i) => {
    // c.bit is the bit index (MSB first in cells array: cell 0 = bit 7)
    const bitIdx = c.bit !== undefined ? c.bit : (els.cells.length - 1 - i);
    const bitVal = (v >> bitIdx) & 1;
    if (c.rect) {
      c.rect.setAttribute('fill', bitVal ? on : off);
      c.rect.setAttribute('opacity', bitVal ? '1' : '0.5');
      if (bitVal) {
        c.rect.setAttribute('filter', 'url(#cell-glow)');
      } else {
        c.rect.removeAttribute('filter');
      }
    }
    if (c.led) {
      c.led.setAttribute('fill', bitVal ? '#00ff44' : '#440000');
      c.led.setAttribute('opacity', bitVal ? '1' : '0.5');
      c.led.setAttribute('r', bitVal ? '2' : '1.5');
    }
  });
}

// Show binary value on the data bus lines
// Lines where bit is 1 glow bright and thick, lines where bit is 0 stay dim
// Also shows binary digit labels (0/1) at the right end of each bus line
function _showBinaryOnBus(value, busType) {
  const type = busType || 'data';
  const busEls = _diagBusEls[type] || [];
  const v = value & (type === 'addr' ? 0x0F : 0xFF);
  const colors = {
    data: { on: OV_COLORS.amber, off: '#1a1200' },
    addr: { on: OV_COLORS.blue,  off: '#060e22' },
  };
  const c = colors[type] || colors.data;

  // Remove any previous binary labels
  if (_diagSVG) {
    _diagSVG.querySelectorAll('.bus-bit-label').forEach(el => el.remove());
  }

  busEls.forEach((el, i) => {
    const bitIdx = i;
    const bitVal = (v >> bitIdx) & 1;
    el.setAttribute('stroke', bitVal ? c.on : '#0a0500');
    el.setAttribute('stroke-width', bitVal ? '8' : '1');
    el.setAttribute('opacity', bitVal ? '1' : '0.15');
    if (bitVal) {
      el.setAttribute('filter', 'url(#bus-glow)');
    } else {
      el.removeAttribute('filter');
    }

    // Add a 0/1 label at the right end of each bus line
    if (_diagPacketLayer) {
      const lineY = parseFloat(el.getAttribute('y1') || el.getAttribute('cy') || 0);
      const lbl = mkSVG('text', {
        x: CPU_W - 30, y: lineY + 3,
        'text-anchor': 'start',
        fill: bitVal ? c.on : '#444',
        'font-family': 'monospace',
        'font-size': bitVal ? '10' : '7',
        'font-weight': bitVal ? '700' : '400',
        opacity: bitVal ? '1' : '0.5',
        class: 'bus-bit-label',
      });
      lbl.textContent = bitVal ? '1' : '0';
      if (bitVal) lbl.setAttribute('filter', 'url(#cpu-glow)');
      _diagPacketLayer.appendChild(lbl);
    }
  });
}

// Light up a specific control signal by name (e.g. 'RO', 'AI')
function _lightCtrlSignal(name, on) {
  const els = _diagCtrlSigEls[name];
  if (!els) return;
  els.forEach(el => {
    if (on) {
      el.setAttribute('stroke', '#ff4444');
      el.setAttribute('stroke-width', '3');
      el.setAttribute('opacity', '1');
      el.setAttribute('filter', 'url(#bus-glow)');
    } else {
      el.setAttribute('stroke', '#2a0a0a');
      el.setAttribute('stroke-width', '0.8');
      el.setAttribute('opacity', '0.4');
      el.removeAttribute('filter');
    }
  });
}

// Dim all control signals
function _dimAllCtrlSignals() {
  Object.keys(_diagCtrlSigEls).forEach(name => _lightCtrlSignal(name, false));
}

// Show CU firing a specific set of signals — ALL lines visible, active ones bright, rest dim
// This is how a real CU works: all 16 signals go out simultaneously, most are OFF (0), a few are ON (1)
function _cuFiresSignals(activeSignals) {
  _glowComp('CU');
  _fireComp('CU', OV_COLORS.red);
  // Show ALL signal lines as dim (OFF = 0)
  Object.keys(_diagCtrlSigEls).forEach(name => {
    const els = _diagCtrlSigEls[name];
    if (!els) return;
    els.forEach(el => {
      el.setAttribute('stroke', '#1a0808');
      el.setAttribute('stroke-width', '0.6');
      el.setAttribute('opacity', '0.2');
      el.removeAttribute('filter');
    });
  });
  // Light up ONLY the active ones (ON = 1)
  activeSignals.forEach(name => _lightCtrlSignal(name, true));
}

// Show a binary value in a specific RAM row (highlights individual cells)
function _showBinaryInRAMRow(row, value, color) {
  if (!_diagSVG) return;
  const ramCells = Array.from(_diagSVG.querySelectorAll('.ram-cell'));
  const v = value & 0xFF;
  const c = color || OV_COLORS.amber;
  // RAM grid: 8 rows × 8 cols. Row N starts at index N*8.
  const startIdx = row * 8;
  for (let col = 0; col < 8; col++) {
    const cellIdx = startIdx + col;
    const cell = ramCells[cellIdx];
    if (!cell) continue;
    // col 0 = MSB (bit 7), col 7 = LSB (bit 0)
    const bitIdx = 7 - col;
    const bitVal = (v >> bitIdx) & 1;
    cell.setAttribute('fill', bitVal ? c : '#030d1c');
    cell.setAttribute('opacity', bitVal ? '1' : '0.4');
    if (bitVal) {
      cell.setAttribute('stroke', c);
      cell.setAttribute('stroke-width', '1.5');
    } else {
      cell.setAttribute('stroke', OV_COLORS.blue);
      cell.setAttribute('stroke-width', '0.6');
    }
  }
}

// Highlight a RAM row as "selected by MAR" — all cells in the row glow
// to show this is the address being pointed at, regardless of stored value.
function _highlightRAMRow(row) {
  if (!_diagSVG) return;
  const ramCells = Array.from(_diagSVG.querySelectorAll('.ram-cell'));
  // Dim all rows first
  ramCells.forEach(c => { c.setAttribute('fill', '#0a1520'); c.setAttribute('opacity', '0.4'); });
  // Highlight the selected row — all 8 cells glow blue
  const startIdx = row * 8;
  for (let col = 0; col < 8; col++) {
    const cell = ramCells[startIdx + col];
    if (cell) {
      cell.setAttribute('fill', OV_COLORS.blue);
      cell.setAttribute('opacity', '1');
      cell.setAttribute('stroke', OV_COLORS.blue);
      cell.setAttribute('stroke-width', '1');
    }
  }
}

// Clear binary labels from bus
function _clearBusLabels() {
  if (_diagSVG) {
    _diagSVG.querySelectorAll('.bus-bit-label').forEach(el => el.remove());
  }
}

// ─────────────────────────────────────────
//  SIGNAL FLOW ANIMATION
//  source fires → wire glows → destination receives
// ─────────────────────────────────────────

// ── ALWAYS-ON CONNECTIONS: physical realities that never stop ──
// Called whenever a component becomes visible. These are NOT controlled
// by the CU — they run independently the moment the CPU is powered on.
function _enforceHardwiredLinks(key) {
  // CLOCK: always pulsing. It does not wait for anyone. It starts the moment
  // the CPU is switched on and never stops until HLT or power off.
  if (key === 'CLK') {
    _setBusActive('clk', true);
    if (!_hwPulseActive['clk']) {
      _hwPulseActive['clk'] = true;
      ['w-clk-h','w-clk-pc','w-clk-cu','w-clk-ram','w-clk-ir'].forEach((id, i) =>
        _spawnPacket(id, OV_COLORS.green, true, i * 0.08)
      );
    }
  }
  // MAR → RAM: 4 direct wires. Always carries MAR's address to RAM.
  if (key === 'MAR') {
    _lightWire('w-mar-ram', true);
    if (!_hwPulseActive['mar-ram']) { _hwPulseActive['mar-ram'] = true; _spawnPacket('w-mar-ram', OV_COLORS.blue, true, 0); }
  }
  // REG A → ALU: direct wire. ALU always sees A's value.
  if (key === 'REGA') {
    _lightWire('w-rega-alu', true);
    if (!_hwPulseActive['rega-alu']) { _hwPulseActive['rega-alu'] = true; _spawnPacket('w-rega-alu', OV_COLORS.orange, true, 0); }
  }
  // REG B → ALU: direct wire. ALU always sees B's value.
  if (key === 'REGB') {
    _lightWire('w-regb-alu', true);
    if (!_hwPulseActive['regb-alu']) { _hwPulseActive['regb-alu'] = true; _spawnPacket('w-regb-alu', OV_COLORS.orange, true, 0.2); }
  }
  // IR → CU: opcode wires. CU always sees the current instruction.
  if (key === 'IR') {
    _lightWire('w-ir-cu', true);
    if (!_hwPulseActive['ir-cu']) { _hwPulseActive['ir-cu'] = true; _spawnPacket('w-ir-cu', OV_COLORS.red, true, 0); }
  }
}

// Make a component glow bright (sending)
function _fireComp(key, color) {
  const els = _diagCompEls[key];
  if (!els) return;
  els.glow.setAttribute('opacity', '1');
  els.rect.setAttribute('opacity', '1');
  els.rect.setAttribute('stroke', color || OV_COLORS.green);
  els.rect.setAttribute('stroke-width', '2.5');
  _enforceHardwiredLinks(key);
}

// Make a component glow and flash cells (receiving)
function _receiveComp(key, color) {
  const els = _diagCompEls[key];
  if (!els) return;
  els.glow.setAttribute('opacity', '1');
  els.rect.setAttribute('opacity', '1');
  _flashCells(key, color || OV_COLORS.green);
  _enforceHardwiredLinks(key);
}

// Dim a component back to normal
function _dimComp(key) {
  const els = _diagCompEls[key];
  if (!els) return;
  els.glow.setAttribute('opacity', '0');
  els.rect.setAttribute('opacity', '0.6');
  els.rect.setAttribute('stroke-width', '1');
  const comp = CPU_COMPS[key];
  if (comp) els.rect.setAttribute('stroke', comp.color);
  _clearCells(key); // clear stale bits — no dummy values lingering
}

// Clear all bit cells in a component — every bit off (dim, no glow)
// Prevents stale bits from previous sentences from lingering.
function _clearCells(key) {
  const els = _diagCompEls[key];
  if (!els || !els.cells) return;
  els.cells.forEach(c => {
    if (c.rect) {
      c.rect.setAttribute('fill', '#040e1a');
      c.rect.setAttribute('opacity', '0.3');
      c.rect.removeAttribute('filter');
    }
    if (c.led) {
      c.led.setAttribute('fill', '#440000');
      c.led.setAttribute('opacity', '0.3');
      c.led.setAttribute('r', '1.5');
    }
  });
}

// Animate a signal flow: source fires → wire glows + packet → destination receives
// Returns an array of timeout IDs (push to _sceneTimers for cleanup)
function _signalFlow(fromKey, wireId, toKey, color, delayMs) {
  const timers = [];
  const d = delayMs || 0;
  const c = color || OV_COLORS.amber;

  // Phase 1: Source fires
  timers.push(setTimeout(() => {
    _fireComp(fromKey, c);
  }, d));

  // Phase 2: Wire lights up + packet starts (300ms after source fires)
  timers.push(setTimeout(() => {
    _lightWire(wireId, true);
    _spawnPacket(wireId, c, false, 0);
  }, d + 300));

  // Phase 3: Destination receives (800ms after source fires)
  timers.push(setTimeout(() => {
    _receiveComp(toKey, c);
  }, d + 800));

  // Phase 4: Dim source after signal sent (1200ms)
  timers.push(setTimeout(() => {
    _dimComp(fromKey);
  }, d + 1200));

  return timers;
}

// ─────────────────────────────────────────
//  SCENE EFFECT HELPERS
// ─────────────────────────────────────────

// Shared helper: get or create the phase label group (pill background + text)
function _getPhaseLabel(color) {
  let lbl = _diagSVG && _diagSVG.querySelector('#cpu-phase-label');
  if (!lbl && _diagSVG) {
    // Pill background rect
    const bg = mkSVG('rect', {
      id: 'cpu-phase-label-bg',
      x: CPU_W / 2 - 120, y: CPU_H - 28,
      width: 240, height: 20, rx: '10',
      fill: '#000', opacity: '0.5',
    });
    _diagSVG.appendChild(bg);
    const bg2 = mkSVG('rect', {
      id: 'cpu-phase-label-bg2',
      x: CPU_W / 2 - 120, y: CPU_H - 28,
      width: 240, height: 20, rx: '10',
      fill: color || OV_COLORS.green, opacity: '0.08',
      stroke: color || OV_COLORS.green, 'stroke-width': '0.6', 'stroke-opacity': '0.4',
    });
    _diagSVG.appendChild(bg2);
    lbl = mkSVG('text', { id: 'cpu-phase-label', x: CPU_W / 2, y: CPU_H - 13,
      'text-anchor': 'middle', fill: color || OV_COLORS.green,
      'font-family': 'monospace', 'font-size': '11', 'font-weight': '700', 'letter-spacing': '2' });
    _diagSVG.appendChild(lbl);
  }
  return lbl;
}

// Update phase label background color to match text color
function _updatePhaseLabelBg(color) {
  const bg2 = _diagSVG && _diagSVG.querySelector('#cpu-phase-label-bg2');
  if (bg2) { bg2.setAttribute('fill', color); bg2.setAttribute('stroke', color); }
}

// Place a static glowing data indicator at a component's input (data "waiting at the door")
// Supports multiple components simultaneously — each gets its own indicator
function _placeWaitingData(compKey, value, color) {
  if (!_diagPacketLayer) return;

  const comp = CPU_COMPS[compKey];
  if (!comp) return;

  // Remove existing indicator for THIS component only
  const existing = _diagSVG && _diagSVG.querySelector('#waiting-data-' + compKey);
  if (existing) existing.remove();

  // Position: just above the component (at the bus connection point)
  const cx = comp.x + comp.w / 2;
  const cy = comp.y - 14;
  const c = color || OV_COLORS.amber;

  const g = mkSVG('g', { id: 'waiting-data-' + compKey, class: 'waiting-data-indicator' });

  // Pulsing glow ring
  g.appendChild(mkSVG('circle', {
    cx, cy, r: '14', fill: 'none', stroke: c, 'stroke-width': '2',
    opacity: '0.4', filter: 'url(#cpu-glow)',
  }));

  // Solid dot
  g.appendChild(mkSVG('circle', {
    cx, cy, r: '8', fill: c, opacity: '0.8', filter: 'url(#cpu-glow)',
  }));

  // Value label
  const lbl = mkSVG('text', {
    x: cx, y: cy + 3, 'text-anchor': 'middle', fill: '#020a14',
    'font-family': 'monospace', 'font-size': '7', 'font-weight': '700',
  });
  lbl.textContent = value || '?';
  g.appendChild(lbl);

  _diagPacketLayer.appendChild(g);
}

// Remove waiting indicator for a specific component
function _removeWaitingDataFor(compKey) {
  const existing = _diagSVG && _diagSVG.querySelector('#waiting-data-' + compKey);
  if (existing) existing.remove();
}

// Remove ALL waiting data indicators
function _removeWaitingData() {
  if (_diagSVG) {
    _diagSVG.querySelectorAll('.waiting-data-indicator').forEach(el => el.remove());
  }
}

// Convenience: dim ALL components and hide overlays
function _dimAll() {
  Object.keys(CPU_COMPS).forEach(k => _dimComp(k));
  _setBusActive('data', false);
  _setBusActive('addr', false);
  _setBusActive('clk',  false);
  _setBusActive('ctrl', false);
  _dimAllCtrlSignals();
  _removeWaitingData();
  _clearBusLabels();
  // Hide device overlay (Scene 1 page 0 only)
  const devLayer = _diagSVG && _diagSVG.querySelector('#cpu-device-layer');
  if (devLayer) devLayer.setAttribute('opacity', '0');
}

// Convenience: make a component glow steadily (highlighted but not "firing")
function _glowComp(key) {
  const els = _diagCompEls[key];
  if (!els) return;
  els.rect.setAttribute('opacity', '1');
  els.lbl.setAttribute('opacity', '1');
  els.glow.setAttribute('opacity', '0.75');
  // Don't touch cell opacity — cells reflect their ACTUAL content, not component glow state
  // Cells are only brightened by _showBinaryInCells when a real value is set
  _enforceHardwiredLinks(key);
}

// Set phase label text + color
function _setLabel(text, color) {
  const c = color || OV_COLORS.green;
  const lbl = _getPhaseLabel(c);
  if (lbl) { lbl.textContent = text; lbl.setAttribute('fill', c); }
  _updatePhaseLabelBg(c);
}

// ─────────────────────────────────────────
//  ANIMATION HELPERS — full-system patterns
// ─────────────────────────────────────────

// Clock pulse: show CLK firing + green pulses radiating to all components
function _clockPulse(continuous) {
  _glowComp('CLK'); _fireComp('CLK', OV_COLORS.green); _setBusActive('clk', true);
  ['w-clk-h','w-clk-pc','w-clk-cu','w-clk-ram','w-clk-ir'].forEach((id, i) =>
    _spawnPacket(id, OV_COLORS.green, !!continuous, i * 0.08)
  );
}

// ── BUS RULE: when ANY component drives a bus, ALL connected components see it ──
// This is a physical law of buses — it never changes. One function enforces it.

// Data bus write: source fires value onto bus → continuous pulses to ALL doors.
// srcKey: component driving (e.g. 'RAM','ALU','IR','REGA')
// srcWire: wire from source to bus (e.g. 'w-ram-db','w-alu-bus','w-ir-db')
// value: number to show on bus (or null to skip binary display)
// color: pulse color
// captureKey: which component has permission to capture (shown green, others dim). null = no capture yet.
function _busWrite(srcKey, srcWire, value, color, captureKey) {
  const c = color || OV_COLORS.amber;

  // AUTO-RESOLVE VALUE: if null, read from the source component's current displayed value.
  // The bus always carries a real value — never "nothing."
  if (value === null || value === undefined) {
    if (srcKey) {
      const srcEls = _diagCompEls[srcKey];
      const srcText = srcEls && srcEls.val ? srcEls.val.textContent : '';
      const parsed = parseInt(srcText, 10);
      if (!isNaN(parsed)) value = parsed;
    }
  }

  // Source fires
  if (srcKey) _fireComp(srcKey, c);

  // PHYSICAL RULE: RAM cannot fire without MAR selecting an address.
  if (srcKey === 'RAM') {
    _glowComp('MAR');
    const marEls = _diagCompEls['MAR'];
    const marText = marEls && marEls.val ? marEls.val.textContent : '0';
    const marAddr = parseInt(marText, 10) || 0;
    if (value !== null && value !== undefined) _showBinaryInRAMRow(Math.min(marAddr, 7), value, c);
  }

  // Bus lights up with the actual value being transferred
  _setBusActive('data', true);
  if (value !== null && value !== undefined) _showBinaryOnBus(value, 'data');
  // Source → bus pulse (forward direction: component → bus)
  if (srcWire) _spawnPacket(srcWire, c, true, 0);
  // Pulses stream to ALL bus-connected component doors.
  // Wire direction matters: some wires are defined component→bus (output wires),
  // so when used as receiving doors we must REVERSE them (bus→component).
  // Wires defined bus→component (w-bus-rega, w-bus-regb, w-out) are already correct.
  // Wires defined component→bus (w-ir-db, w-ram-db) need reverse=true for receiving.
  const allDoors = [
    ['w-bus-rega', 'REGA', 0.20, false],  // bus→REGA: correct direction
    ['w-bus-regb', 'REGB', 0.28, false],  // bus→REGB: correct direction
    ['w-ir-db',    'IR',   0.36, true],    // IR→bus defined, REVERSE for bus→IR
    ['w-out',      'OUT',  0.44, false],   // bus→OUT: correct direction
    ['w-ram-db',   'RAM',  0.52, true],    // RAM→bus defined, REVERSE for bus→RAM
  ];
  allDoors.forEach(([wire, comp, delay, rev]) => {
    if (comp === srcKey) return; // don't pulse back to source
    _spawnPacket(wire, c, true, delay, rev);
  });
  // Show all bus-connected components (they all see the data)
  ['REGA','REGB','IR','OUT','RAM','ALU'].forEach(k => { if (k !== srcKey) _glowComp(k); });
}

// Show data waiting at every bus-connected component's door.
// captureKey gets green (has permission), others get dim.
function _busWaitingAtDoors(value, captureKey) {
  const v = '' + (value !== null && value !== undefined ? value : '?');
  ['REGA','REGB','IR','OUT'].forEach(k => {
    const isCapture = k === captureKey;
    _placeWaitingData(k, v, isCapture ? OV_COLORS.green : '#332200');
  });
}

// Legacy alias for backward compat
function _dataFlow(srcWire, destWire, color, extraWires) {
  if (srcWire) _spawnPacket(srcWire, color || OV_COLORS.amber, true, 0);
  if (destWire) _spawnPacket(destWire, color || OV_COLORS.amber, true, 0.4);
  if (extraWires) extraWires.forEach((w, i) => _spawnPacket(w, color || OV_COLORS.amber, true, 0.2 + i * 0.15));
}

// Push a setTimeout to _sceneTimers and return the id
let _sentenceTimers = [];
function _clearSentenceTimers() {
  _sentenceTimers.forEach(id => clearTimeout(id));
  _sentenceTimers = [];
}

function _after(ms, fn) {
  const id = setTimeout(fn, ms);
  _sentenceTimers.push(id);
  return id;
}

// ─────────────────────────────────────────
//  SENTENCE DURATION — sync engine
//  Each sentence can declare `dur` (ms) for explicit timing.
//  If omitted, auto-calculates from word count.
//  This drives both auto-play and TTS sync.
// ─────────────────────────────────────────
function _getSentenceDuration(sent) {
  if (typeof sent.dur === 'number') return sent.dur;
  // ~400ms per word ≈ 150 WPM comfortable viewing speed
  const words = sent.text.split(/\s+/).length;
  return Math.min(8000, Math.max(3000, words * 400));
}

// ─────────────────────────────────────────
//  PAGE EFFECT IMPLEMENTATIONS
//  One function per page, per scene.
//  Called on EVERY page change — no setInterval,
//  no independent loops. Each sets a static or
//  one-shot animation state.
// ─────────────────────────────────────────

// ── Helper used by Scene 12: apply a T-state step to the diagram ──
function _applyTStep(step) {
  Object.keys(CPU_COMPS).forEach(k => {
    const e = _diagCompEls[k]; if (!e) return;
    const act = step.comps.includes(k);
    e.rect.setAttribute('opacity', act ? '1' : '0.08');
    e.lbl.setAttribute('opacity',  act ? '1' : '0.08');
    e.glow.setAttribute('opacity', act ? '0.85' : '0');
    if (e.cells) e.cells.forEach(c => { if (c.rect) c.rect.setAttribute('opacity', act ? '0.9' : '0.08'); });
  });
  _setBusActive('addr', !!step.busAddr);
  _setBusActive('data', !!step.busData);
  Object.entries(step.vals || {}).forEach(([k,v]) => _showCompVal(k,v));
  if (step.flash) {
    const fc = {MAR:OV_COLORS.blue, IR:OV_COLORS.amber, REGA:OV_COLORS.orange,
                REGB:OV_COLORS.purple, FLAGS:OV_COLORS.amber, OUT:OV_COLORS.green}[step.flash] || OV_COLORS.green;
    _flashCells(step.flash, fc);
  }
  (step.pkts || []).forEach(p => _spawnPacket(p.id, p.color, false, p.delay || 0));
  _setLabel((step.tLabel || '') + (step.sigLabel ? ': ' + step.sigLabel : ''), step.labelColor);
}

// ─────────────────────────────────────────
//  SCENE 1 — "What Powers Everything" (5 pages)
// ─────────────────────────────────────────
function _showDevices(show) {
  const layer = _diagSVG && _diagSVG.querySelector('#cpu-device-layer');
  if (layer) layer.setAttribute('opacity', show ? '1' : '0');
}
function _pe1_0() {
  // "Phone, laptop, console" — show device icons, hide CPU
  _dimAll();
  _showDevices(true);
  _setLabel('', OV_COLORS.green);
}
function _pe1_1() {
  // "On the screen you can see the building blocks" — fade devices, reveal CPU
  _showDevices(false);
  _dimAll();
  Object.keys(CPU_COMPS).forEach(k => {
    const e = _diagCompEls[k]; if (!e) return;
    e.rect.setAttribute('opacity', '0.18');
    e.lbl.setAttribute('opacity', '0.18');
  });
  _setLabel('11 building blocks', OV_COLORS.green);
}
function _pe1_2() {
  _dimAll();
  const keys = Object.keys(CPU_COMPS);
  keys.forEach((k, i) => {
    _after(i * 600, () => _glowComp(k));
  });
  _setLabel('', OV_COLORS.green);
}
function _pe1_3() {
  Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
  _setBusActive('data', false);
  _setBusActive('addr', false);
  _setBusActive('clk',  false);
  const labels = ['FETCH', 'DECODE', 'EXECUTE'];
  const colors = [OV_COLORS.teal, OV_COLORS.amber, OV_COLORS.green];
  labels.forEach((lbl, i) => {
    _after(i * 900, () => _setLabel(lbl, colors[i]));
  });
}
function _pe1_4() {
  _dimAll();
  _setBusActive('data', true);
  _setBusActive('addr', true);
  _setBusActive('clk',  true);
  _setLabel('DATA BUS (amber)  |  ADDRESS BUS (blue)  |  CLOCK (green)', OV_COLORS.amber);
}

// ─────────────────────────────────────────
//  SCENE 2 — "The Heartbeat" (5 pages)
// ─────────────────────────────────────────
function _pe2_0() {
  _dimAll();
  _glowComp('CLK');
  _fireComp('CLK', OV_COLORS.green);
  _setLabel('', OV_COLORS.green);
}
function _pe2_1() {
  _dimAll();
  _glowComp('CLK');
  _setBusActive('clk', true);
  Object.keys(CPU_COMPS).forEach(k => {
    if (k !== 'CLK') {
      const e = _diagCompEls[k]; if (!e) return;
      e.rect.setAttribute('opacity', '0.4');
      e.lbl.setAttribute('opacity', '0.4');
    }
  });
  ['w-clk-h','w-clk-pc','w-clk-cu','w-clk-ram','w-clk-ir'].forEach((id, i) =>
    _spawnPacket(id, OV_COLORS.green, false, i * 0.12)
  );
  _setLabel('Clock pulse reaches every component simultaneously', OV_COLORS.green);
}
function _pe2_2() {
  _dimAll();
  _glowComp('CLK');
  _glowComp('REGA');
  _setBusActive('data', true);
  const clkE = _diagCompEls['CLK'];
  if (clkE) clkE.glow.setAttribute('opacity', '0.15');
  _showCompVal('REGA', '---');
  _setLabel('Waiting... data is at the door but the clock has not beaten', OV_COLORS.amber);
}
function _pe2_3() {
  _dimAll();
  _glowComp('CLK');
  _glowComp('REGA');
  _setBusActive('data', true);
  _setBusActive('clk',  true);
  _fireComp('CLK', OV_COLORS.green);
  _after(300, () => {
    _spawnPacket('w-bus-rega', OV_COLORS.amber, false, 0);
    _flashCells('REGA', OV_COLORS.green);
    _showCompVal('REGA', '42');
  });
  _setLabel('Clock beats — Register A captures the data!', OV_COLORS.green);
}
function _pe2_4() {
  _dimAll();
  _glowComp('CLK');
  _glowComp('CU');
  _setBusActive('data', true);
  _setBusActive('clk',  true);
  _setLabel('3 conditions: data present  +  control signal active  +  clock beats', OV_COLORS.teal);
}

// ─────────────────────────────────────────
//  SCENE 3 — "The Boss" (6 pages)
// ─────────────────────────────────────────
function _pe3_0() {
  _dimAll();
  _glowComp('CU');
  _fireComp('CU', OV_COLORS.red);
  _setLabel('', OV_COLORS.red);
}
function _pe3_1() {
  _dimAll();
  _glowComp('CU');
  _setLabel('The Control Unit sends signals \u2014 it does not store or compute', OV_COLORS.red);
}
function _pe3_2() {
  _dimAll();
  _glowComp('CU');
  const signals = ['CO','CE','MI','RO','RI','II','IO','AI','AO','BI','EO'];
  signals.forEach((s, i) => {
    _after(i * 200, () => _setLabel('Signal: ' + s, OV_COLORS.orange));
  });
}
function _pe3_3() {
  _dimAll();
  _glowComp('CU');
  const targets = [
    { key: 'PC',   color: OV_COLORS.teal   },
    { key: 'MAR',  color: OV_COLORS.blue   },
    { key: 'RAM',  color: OV_COLORS.amber  },
    { key: 'REGA', color: OV_COLORS.purple },
  ];
  targets.forEach(({ key, color }, i) => {
    _after(i * 700, () => {
      Object.keys(CPU_COMPS).forEach(k => { if (k !== 'CU') _dimComp(k); });
      _glowComp('CU');
      _fireComp('CU', OV_COLORS.red);
      _after(300, () => {
        _receiveComp(key, color);
        _setLabel('CU fires \u2192 ' + key + ' responds', color);
      });
    });
  });
}
function _pe3_4() {
  _dimAll();
  _glowComp('CU');
  const seq = [
    { key: 'PC',   sig: 'CO', color: OV_COLORS.teal   },
    { key: 'MAR',  sig: 'MI', color: OV_COLORS.blue   },
    { key: 'RAM',  sig: 'RO', color: OV_COLORS.amber  },
    { key: 'REGA', sig: 'AI', color: OV_COLORS.purple },
  ];
  seq.forEach(({ key, sig, color }, i) => {
    _after(i * 800, () => {
      Object.keys(CPU_COMPS).forEach(k => { if (k !== 'CU') _dimComp(k); });
      _glowComp('CU');
      _after(200, () => {
        _receiveComp(key, color);
        _setLabel(sig + ' signal \u2192 ' + key, color);
      });
    });
  });
}
function _pe3_5() {
  _dimAll();
  _glowComp('CU');
  _flashCells('CU', OV_COLORS.red);
  _setLabel('MICROCODE ROM \u2014 same input, same output, every time', OV_COLORS.red);
}

// ─────────────────────────────────────────
//  SCENE 4 — "The Storage Room" (4 pages)
// ─────────────────────────────────────────
function _pe4_0() {
  _dimAll();
  _glowComp('RAM');
  _setLabel('', OV_COLORS.blue);
}
function _pe4_1() {
  _dimAll();
  _glowComp('RAM');
  const ramCells = _diagSVG ? Array.from(_diagSVG.querySelectorAll('.ram-cell')) : [];
  const cols = 8;
  for (let row = 0; row < 8; row++) {
    _after(row * 200, () => {
      ramCells.forEach(c => { c.setAttribute('fill', '#030d1c'); c.setAttribute('opacity', '0.5'); });
      const rowCells = ramCells.slice(row * cols, (row + 1) * cols);
      rowCells.forEach(c => { c.setAttribute('fill', OV_COLORS.blue); c.setAttribute('opacity', '1'); });
    });
  }
  _after(8 * 200, () => {
    ramCells.forEach(c => { c.setAttribute('fill', '#030d1c'); c.setAttribute('opacity', '0.6'); });
  });
  _setLabel('16 numbered rooms \u2014 each holds one value', OV_COLORS.blue);
}
function _pe4_2() {
  _dimAll();
  _glowComp('RAM');
  _setBusActive('data', true);
  _spawnPacket('w-ram-db', OV_COLORS.amber, false, 0);
  _setLabel('8 amber wires carry the value out of RAM to the data bus', OV_COLORS.amber);
}
function _pe4_3() {
  _dimAll();
  _glowComp('RAM');
  _glowComp('MAR');
  _setBusActive('addr', true);
  _spawnPacket('w-mar-ram', OV_COLORS.blue, false, 0);
  _setLabel('4 blue address wires tell RAM which room to open (0\u201315)', OV_COLORS.blue);
}

// ─────────────────────────────────────────
//  SCENE 5 — "The Address Book" (5 pages)
// ─────────────────────────────────────────
function _pe5_0() {
  _dimAll();
  _glowComp('PC');
  _glowComp('MAR');
  _setLabel('', OV_COLORS.teal);
}
function _pe5_1() {
  _dimAll();
  _glowComp('PC');
  const vals = ['0', '1', '2', '3'];
  vals.forEach((v, i) => {
    _after(i * 700, () => {
      _showCompVal('PC', v);
      _flashCells('PC', OV_COLORS.teal);
      _setLabel('PC = ' + v, OV_COLORS.teal);
    });
  });
}
function _pe5_2() {
  _dimAll();
  _glowComp('PC');
  _glowComp('MAR');
  _glowComp('RAM');
  _setBusActive('addr', true);
  _showCompVal('PC', '2');
  _showCompVal('MAR', '2');
  _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0);
  _after(500, () => _spawnPacket('w-mar-ram', OV_COLORS.blue, false, 0));
  _setLabel('PC fires \u2192 address bus \u2192 MAR captures \u2192 RAM opens that room', OV_COLORS.teal);
}
function _pe5_3() {
  _dimAll();
  _glowComp('PC');
  _showCompVal('PC', '4');
  _setLabel('Normal count: 4...', OV_COLORS.teal);
  _after(500, () => {
    _flashCells('PC', OV_COLORS.orange);
    _showCompVal('PC', '1');
    _setLabel('JUMP! \u2014 PC leaps back to room 1. This is how loops work.', OV_COLORS.orange);
  });
}
function _pe5_4() {
  _dimAll();
  _glowComp('PC');
  _glowComp('MAR');
  _setBusActive('addr', true);
  _setLabel('Two modes: count up (normal) or load a new value (jump)', OV_COLORS.teal);
}

// ─────────────────────────────────────────
//  SCENE 6 — "Getting a Command" (5 pages)
// ─────────────────────────────────────────
function _pe6_0() {
  _dimAll();
  _glowComp('PC');
  _glowComp('MAR');
  _glowComp('RAM');
  _glowComp('IR');
  _setLabel('Fetch in 2 steps', OV_COLORS.teal);
}
function _pe6_1() {
  _dimAll();
  _glowComp('PC');
  _glowComp('MAR');
  _setBusActive('addr', true);
  _showCompVal('PC', '0');
  _fireComp('PC', OV_COLORS.teal);
  _after(300, () => {
    _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0);
  });
  _after(800, () => {
    _receiveComp('MAR', OV_COLORS.blue);
    _showCompVal('MAR', '0');
  });
  _setLabel('Step 1: PC fires address 0 \u2192 address bus glows \u2192 MAR captures it', OV_COLORS.teal);
}
function _pe6_2() {
  _dimAll();
  _glowComp('RAM');
  _glowComp('IR');
  _setBusActive('data', true);
  _showCompVal('MAR', '0');
  _fireComp('RAM', OV_COLORS.amber);
  _after(300, () => _spawnPacket('w-ram-ir', OV_COLORS.amber, false, 0));
  _after(800, () => {
    _receiveComp('IR', OV_COLORS.amber);
    _showCompVal('IR', 'LDI 5');
  });
  _setLabel('Step 2: RAM fires "LDI 5" \u2192 data bus glows \u2192 IR captures it', OV_COLORS.amber);
}
function _pe6_3() {
  _dimAll();
  _glowComp('PC');
  _showCompVal('PC', '0');
  _after(500, () => {
    _flashCells('PC', OV_COLORS.teal);
    _showCompVal('PC', '1');
  });
  _setLabel('At the same time: PC increments \u2192 already pointing to the next command', OV_COLORS.teal);
}
function _pe6_4() {
  _dimAll();
  _glowComp('IR');
  _showCompVal('IR', 'LDI 5');
  const irC = _diagCompEls['IR'] && _diagCompEls['IR'].cells;
  if (irC) {
    irC.slice(0, 4).forEach((c, i) => {
      _after(i * 80, () => {
        if (c.rect) { c.rect.setAttribute('fill', OV_COLORS.red); c.rect.setAttribute('opacity', '1'); }
      });
      _after(i * 80 + 400, () => {
        if (c.rect) c.rect.setAttribute('fill', '#040e1a');
      });
    });
    irC.slice(4, 8).forEach((c, i) => {
      _after(500 + i * 80, () => {
        if (c.rect) { c.rect.setAttribute('fill', OV_COLORS.amber); c.rect.setAttribute('opacity', '1'); }
      });
      _after(500 + i * 80 + 400, () => {
        if (c.rect) c.rect.setAttribute('fill', '#040e1a');
      });
    });
  }
  _setLabel('Left 4 cells (red) = OPCODE: what to do  |  Right 4 (amber) = OPERAND: with what', OV_COLORS.amber);
}

// ─────────────────────────────────────────
//  SCENE 7 — "Reading the Command" (4 pages)
// ─────────────────────────────────────────
function _pe7_0() {
  _dimAll();
  _glowComp('IR');
  _glowComp('CU');
  _setLabel('', OV_COLORS.red);
}
function _pe7_1() {
  _dimAll();
  _glowComp('IR');
  _glowComp('CU');
  _lightWire('w-ir-cu', true);
  _showCompVal('IR', 'LDA');
  _setLabel('4 red opcode wires \u2014 always active \u2014 CU can see the command the moment IR is loaded', OV_COLORS.red);
}
function _pe7_2() {
  _dimAll();
  _glowComp('IR');
  _glowComp('CU');
  _showCompVal('IR', 'LDA');
  _fireComp('IR', OV_COLORS.amber);
  _after(300, () => _spawnPacket('w-ir-cu', OV_COLORS.red, false, 0));
  _after(900, () => {
    _receiveComp('CU', OV_COLORS.red);
    _showCompVal('CU', 'DECODE');
  });
  _setLabel('Opcode pulses into CU \u2192 CU instantly knows what signals to activate', OV_COLORS.red);
}
function _pe7_3() {
  _dimAll();
  _glowComp('CU');
  const instrs = [
    { name: 'LOAD', targets: ['MAR','RAM','REGA'], color: OV_COLORS.blue   },
    { name: 'ADD',  targets: ['REGB','ALU','REGA'], color: OV_COLORS.orange },
    { name: 'OUT',  targets: ['REGA','OUT'],         color: OV_COLORS.green  },
  ];
  instrs.forEach(({ name, targets, color }, ii) => {
    _after(ii * 1000, () => {
      Object.keys(CPU_COMPS).forEach(k => { if (k !== 'CU') _dimComp(k); });
      _glowComp('CU');
      _showCompVal('CU', name);
      _setLabel(name + ' \u2192 ' + targets.join(', '), color);
      targets.forEach(t => _receiveComp(t, color));
    });
  });
}

// ─────────────────────────────────────────
//  SCENE 8 — "The Hands" (5 pages)
// ─────────────────────────────────────────
function _pe8_0() {
  _dimAll();
  _glowComp('REGA');
  _glowComp('REGB');
  _setLabel('', OV_COLORS.purple);
}
function _pe8_1() {
  _dimAll();
  _glowComp('REGA');
  _glowComp('REGB');
  _showCompVal('REGA', '\u2014');
  _showCompVal('REGB', '\u2014');
  _setLabel('Two registers: REG A (main workhorse) and REG B (second operand)', OV_COLORS.purple);
}
function _pe8_2() {
  _dimAll();
  _glowComp('REGA');
  _setBusActive('data', true);
  _spawnPacket('w-bus-rega', OV_COLORS.purple, false, 0);
  _after(800, () => {
    _receiveComp('REGA', OV_COLORS.purple);
    _showCompVal('REGA', '5');
  });
  _setLabel('Value 5 travels from data bus \u2192 Register A. Cells flash as it arrives.', OV_COLORS.purple);
}
function _pe8_3() {
  _dimAll();
  _glowComp('REGA');
  _glowComp('REGB');
  _glowComp('ALU');
  _showCompVal('REGA', '5');
  _showCompVal('REGB', '3');
  _spawnPacket('w-rega-alu', OV_COLORS.orange, false, 0);
  _spawnPacket('w-regb-alu', OV_COLORS.orange, false, 0.2);
  _setLabel('Direct wires from REG A and REG B go straight into the ALU \u2014 bypassing the bus', OV_COLORS.orange);
}
function _pe8_4() {
  _dimAll();
  _glowComp('REGA');
  _glowComp('REGB');
  _glowComp('ALU');
  _showCompVal('REGA', '5');
  _showCompVal('REGB', '3');
  _spawnPacket('w-rega-alu', OV_COLORS.orange, false, 0);
  _spawnPacket('w-regb-alu', OV_COLORS.orange, false, 0.2);
  _setLabel('Direct wires bypass the bus \u2014 both inputs available simultaneously', OV_COLORS.orange);
}

// ─────────────────────────────────────────
//  SCENE 9 — "Doing the Math" (5 pages)
// ─────────────────────────────────────────
function _pe9_0() {
  _dimAll();
  _glowComp('REGA');
  _glowComp('REGB');
  _glowComp('ALU');
  _showCompVal('REGA', '5');
  _showCompVal('REGB', '3');
  _setLabel('', OV_COLORS.orange);
}
function _pe9_1() {
  _dimAll();
  _glowComp('REGA');
  _glowComp('ALU');
  _showCompVal('REGA', '5');
  _fireComp('REGA', OV_COLORS.purple);
  _after(300, () => _spawnPacket('w-rega-alu', OV_COLORS.orange, false, 0));
  _setLabel('Step 1: REG A (5) sends its value directly into ALU input A', OV_COLORS.orange);
}
function _pe9_2() {
  _dimAll();
  _glowComp('REGA');
  _glowComp('REGB');
  _glowComp('ALU');
  _showCompVal('REGA', '5');
  _showCompVal('REGB', '3');
  _fireComp('REGB', OV_COLORS.purple);
  _after(300, () => _spawnPacket('w-regb-alu', OV_COLORS.orange, false, 0));
  _setLabel('Step 2: REG B (3) sends into ALU input B. Both inputs ready \u2014 ALU computing...', OV_COLORS.orange);
}
function _pe9_3() {
  _dimAll();
  _glowComp('ALU');
  _glowComp('REGA');
  _showCompVal('ALU', '5+3=8');
  _fireComp('ALU', OV_COLORS.orange);
  _setBusActive('data', true);
  _after(300, () => {
    _spawnPacket('w-alu-bus', OV_COLORS.orange, false, 0);
    _spawnPacket('w-alu-rega', OV_COLORS.orange, false, 0.3);
  });
  _after(900, () => {
    _receiveComp('REGA', OV_COLORS.orange);
    _showCompVal('REGA', '8');
  });
  _setLabel('Step 3: Result (8) travels back through data bus \u2192 Register A. A = 8.', OV_COLORS.green);
}
function _pe9_4() {
  _dimAll();
  _glowComp('ALU');
  _glowComp('FLAGS');
  _showCompVal('ALU', '5+3=8');
  _showCompVal('FLAGS', 'CF=0 ZF=0');
  _spawnPacket('w-alu-flags', OV_COLORS.amber, false, 0);
  _after(600, () => _flashCells('FLAGS', OV_COLORS.amber));
  _setLabel('CF=0 (no overflow)  |  ZF=0 (result not zero)  |  Flags let the CPU make decisions', OV_COLORS.amber);
}

// ─────────────────────────────────────────
//  SCENE 10 — "The Roads" (4 pages)
// ─────────────────────────────────────────
function _pe10_0() {
  _dimAll();
  _setBusActive('data', true);
  _setLabel('DATA BUS \u2014 8 lines, one per bit. Every value moves on these lines.', OV_COLORS.amber);
}
function _pe10_1() {
  _dimAll();
  _setBusActive('data', true);
  _setBusActive('addr', true);
  _setBusActive('clk',  true);
  _setLabel('DATA BUS (amber, 8 lines)  |  ADDRESS BUS (blue, 4 lines)  |  CLOCK (green, dashed)', OV_COLORS.teal);
}
function _pe10_2() {
  _dimAll();
  _glowComp('RAM');
  _glowComp('REGA');
  _setBusActive('data', true);
  _fireComp('RAM', OV_COLORS.amber);
  _after(300, () => _spawnPacket('w-ram-db', OV_COLORS.amber, false, 0));
  _after(800, () => {
    _receiveComp('REGA', OV_COLORS.purple);
    _showCompVal('REGA', '42');
  });
  _setLabel('Tri-state switch opens for ONE sender at a time \u2014 here RAM \u2192 REG A', OV_COLORS.amber);
}
function _pe10_3() {
  _dimAll();
  _setBusActive('data', true);
  _glowComp('RAM');
  _glowComp('REGA');
  const ramE  = _diagCompEls['RAM'];
  const regaE = _diagCompEls['REGA'];
  if (ramE)  { ramE.rect.setAttribute('stroke',  OV_COLORS.red); ramE.glow.setAttribute('opacity',  '1'); }
  if (regaE) { regaE.rect.setAttribute('stroke', OV_COLORS.red); regaE.glow.setAttribute('opacity', '1'); }
  _setLabel('Bus contention \u2014 only ONE sender allowed! Two at once = garbage', OV_COLORS.red);
  _after(1400, () => {
    if (regaE) { regaE.glow.setAttribute('opacity', '0'); regaE.rect.setAttribute('stroke', OV_COLORS.purple); }
    _fireComp('RAM', OV_COLORS.amber);
    _after(300, () => _spawnPacket('w-ram-db', OV_COLORS.amber, false, 0));
    _setLabel('CU ensures only one sender. Now RAM flows cleanly.', OV_COLORS.amber);
  });
}

// ─────────────────────────────────────────
//  SCENE 11 — "The Output" (2 pages)
// ─────────────────────────────────────────
function _pe11_0() {
  _dimAll();
  _glowComp('REGA');
  _glowComp('OUT');
  _setBusActive('data', true);
  _showCompVal('REGA', '8');
  _setLabel('', OV_COLORS.green);
}
function _pe11_1() {
  _dimAll();
  _glowComp('REGA');
  _glowComp('OUT');
  _setBusActive('data', true);
  _showCompVal('REGA', '8');
  _fireComp('REGA', OV_COLORS.purple);
  _after(300, () => {
    _spawnPacket('w-rega-out', OV_COLORS.green, false, 0);
    _spawnPacket('w-out',      OV_COLORS.green, false, 0.45);
  });
  _after(900, () => {
    _receiveComp('OUT', OV_COLORS.green);
    _showCompVal('OUT', '8');
    const dispLbl = _diagCompEls['OUT'] && _diagCompEls['OUT'].dispLbl;
    if (dispLbl) { dispLbl.textContent = '8'; dispLbl.setAttribute('opacity', '1'); }
  });
  _setLabel('Register A (8) \u2192 data bus \u2192 Output Display shows: 8', OV_COLORS.green);
}

// ─────────────────────────────────────────
//  SCENE 12 — "Putting It All Together" (7 pages)
// ─────────────────────────────────────────
function _pe12_0() {
  Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
  _setBusActive('data', false);
  _setBusActive('addr', false);
  _setLabel('Program: LDI 5  |  ADD mem[14]=3  |  OUT', OV_COLORS.teal);
}
function _pe12_1() {
  _dimAll();
  _setLabel('Command 1 \u2014 Load 5: fetching...', OV_COLORS.teal);
  _after(0, () => {
    Object.keys(CPU_COMPS).forEach(k => _dimComp(k));
    _glowComp('PC'); _glowComp('MAR');
    _setBusActive('addr', true);
    _showCompVal('PC', '0'); _showCompVal('MAR', '0');
    _fireComp('PC', OV_COLORS.teal);
    _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0);
    _setLabel('T0: CO|MI \u2014 PC drives address bus \u2192 MAR captures', OV_COLORS.teal);
  });
  _after(1200, () => {
    Object.keys(CPU_COMPS).forEach(k => _dimComp(k));
    _glowComp('RAM'); _glowComp('IR'); _glowComp('PC');
    _setBusActive('addr', false); _setBusActive('data', true);
    _showCompVal('RAM', 'LDI 5'); _showCompVal('PC', '1(+)');
    _fireComp('RAM', OV_COLORS.amber);
    _spawnPacket('w-ram-ir', OV_COLORS.amber, false, 0);
    _after(700, () => { _receiveComp('IR', OV_COLORS.amber); _showCompVal('IR', 'LDI 5'); });
    _setLabel('T1: RO|II|CE \u2014 RAM \u2192 IR. PC increments.', OV_COLORS.amber);
  });
  _after(2400, () => {
    Object.keys(CPU_COMPS).forEach(k => _dimComp(k));
    _glowComp('IR'); _glowComp('REGA');
    _setBusActive('data', true);
    _showCompVal('IR', 'LDI 5');
    _spawnPacket('w-bus-rega', OV_COLORS.purple, false, 0);
    _after(700, () => { _receiveComp('REGA', OV_COLORS.purple); _showCompVal('REGA', '5'); });
    _setLabel('T2: IO|AI \u2014 operand (5) goes directly into Register A. A = 5.', OV_COLORS.purple);
  });
}
function _pe12_2() {
  _dimAll();
  _after(0, () => {
    _glowComp('PC'); _glowComp('MAR');
    _setBusActive('addr', true);
    _showCompVal('PC', '1'); _showCompVal('REGA', '5');
    _fireComp('PC', OV_COLORS.teal);
    _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0);
    _setLabel('Command 2 \u2014 ADD: T0: PC \u2192 MAR', OV_COLORS.teal);
  });
  _after(1200, () => {
    Object.keys(CPU_COMPS).forEach(k => _dimComp(k));
    _glowComp('RAM'); _glowComp('IR'); _glowComp('PC');
    _setBusActive('addr', false); _setBusActive('data', true);
    _showCompVal('PC', '2(+)'); _showCompVal('RAM', 'ADD 14'); _showCompVal('REGA', '5');
    _fireComp('RAM', OV_COLORS.amber);
    _spawnPacket('w-ram-ir', OV_COLORS.amber, false, 0);
    _after(700, () => { _receiveComp('IR', OV_COLORS.amber); _showCompVal('IR', 'ADD 14'); });
    _setLabel('T1: RAM \u2192 IR = "ADD 14". ADD means: add value at room 14 to A.', OV_COLORS.amber);
  });
}
function _pe12_3() {
  _dimAll();
  _after(0, () => {
    _glowComp('IR'); _glowComp('MAR');
    _setBusActive('addr', true);
    _showCompVal('IR', 'ADD 14'); _showCompVal('REGA', '5');
    _spawnPacket('w-pc-mar', OV_COLORS.blue, false, 0);
    _after(700, () => { _receiveComp('MAR', OV_COLORS.blue); _showCompVal('MAR', '5'); });
    _setLabel('T2: IO|MI \u2014 operand (14) \u2192 MAR. Now MAR points to room 14.', OV_COLORS.blue);
  });
  _after(1400, () => {
    Object.keys(CPU_COMPS).forEach(k => _dimComp(k));
    _glowComp('RAM'); _glowComp('REGB');
    _setBusActive('addr', false); _setBusActive('data', true);
    _showCompVal('RAM', '[14]=3'); _showCompVal('REGA', '5');
    _fireComp('RAM', OV_COLORS.amber);
    _spawnPacket('w-bus-regb', OV_COLORS.purple, false, 0);
    _after(700, () => { _receiveComp('REGB', OV_COLORS.purple); _showCompVal('REGB', '3'); });
    _setLabel('T3: RO|BI \u2014 RAM room 14 (value 3) \u2192 Register B. B = 3.', OV_COLORS.purple);
  });
}
function _pe12_4() {
  _dimAll();
  _glowComp('REGA'); _glowComp('REGB'); _glowComp('ALU'); _glowComp('FLAGS');
  _showCompVal('REGA', '5'); _showCompVal('REGB', '3'); _showCompVal('ALU', '5+3=8');
  _fireComp('ALU', OV_COLORS.orange);
  _setBusActive('data', true);
  _after(400, () => {
    _spawnPacket('w-alu-bus',   OV_COLORS.orange, false, 0);
    _spawnPacket('w-alu-rega',  OV_COLORS.orange, false, 0.25);
    _spawnPacket('w-alu-flags', OV_COLORS.amber,  false, 0.45);
  });
  _after(1000, () => {
    _receiveComp('REGA', OV_COLORS.orange); _showCompVal('REGA', '8');
    _flashCells('FLAGS', OV_COLORS.amber); _showCompVal('FLAGS', 'CF=0 ZF=0');
  });
  _setLabel('T4: EO|AI|FI \u2014 ALU computes 5+3=8, result \u2192 A. Flags update. A = 8.', OV_COLORS.orange);
}
function _pe12_5() {
  _dimAll();
  _after(0, () => {
    _glowComp('PC'); _glowComp('MAR');
    _setBusActive('addr', true);
    _showCompVal('PC', '2'); _showCompVal('REGA', '8');
    _fireComp('PC', OV_COLORS.teal);
    _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0);
    _setLabel('Command 3 \u2014 Output: T0: PC \u2192 MAR', OV_COLORS.teal);
  });
  _after(1200, () => {
    Object.keys(CPU_COMPS).forEach(k => _dimComp(k));
    _glowComp('REGA'); _glowComp('OUT');
    _setBusActive('data', true);
    _showCompVal('REGA', '8');
    _fireComp('REGA', OV_COLORS.purple);
    _spawnPacket('w-rega-out', OV_COLORS.green, false, 0);
    _spawnPacket('w-out',      OV_COLORS.green, false, 0.45);
    _after(900, () => {
      _receiveComp('OUT', OV_COLORS.green);
      _showCompVal('OUT', '8');
      const d = _diagCompEls['OUT'] && _diagCompEls['OUT'].dispLbl;
      if (d) { d.textContent = '8'; d.setAttribute('opacity', '1'); }
    });
    _setLabel('AO|OI \u2014 Register A (8) \u2192 Output. Display shows: 8.', OV_COLORS.green);
  });
}
function _pe12_6() {
  Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
  _setBusActive('data', true);
  _setBusActive('addr', true);
  _setLabel('3 commands  |  11 clock beats  |  Result: 8', OV_COLORS.green);
}

// ─────────────────────────────────────────
//  SCENE 13 — "Every Program Ever" (2 pages)
// ─────────────────────────────────────────
function _pe13_0() {
  Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
  _setBusActive('data', true);
  _setBusActive('addr', true);
  _setBusActive('clk',  true);
  CPU_WIRES.forEach((w, i) => _spawnPacket(w.id, OV_COLORS.amber, false, i * 0.12));
  const keys = Object.keys(CPU_COMPS);
  keys.forEach((k, i) => {
    _after(i * 180, () => {
      _fireComp(k, OV_COLORS.green);
      _after(250, () => _glowComp(k));
    });
  });
  _setLabel('Fetch. Decode. Execute. Repeat.', OV_COLORS.green);
}
function _pe13_1() {
  Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
  _setBusActive('data', true);
  _setBusActive('addr', true);
  _setBusActive('clk',  true);
  CPU_WIRES.forEach((w, i) => _spawnPacket(w.id, OV_COLORS.teal, false, i * 0.1));
  _setLabel('Your phone: 64-bit, 3 GHz, millions of wires \u2014 same cycle.', OV_COLORS.teal);
}

// ─────────────────────────────────────────
//  SCENE 14 — "You Are Ready" (2 pages)
// ─────────────────────────────────────────
function _pe14_0() {
  Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
  _setBusActive('data', true);
  _setBusActive('addr', true);
  _setBusActive('clk',  true);
  _setLabel('', OV_COLORS.green);
}
function _pe14_1() {
  Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
  _setBusActive('data', true);
  _setBusActive('addr', true);
  _setBusActive('clk',  true);
  CPU_WIRES.forEach((w, i) => _spawnPacket(w.id, OV_COLORS.green, false, i * 0.08));
  Object.keys(CPU_COMPS).forEach((k, i) => {
    _after(i * 120, () => _flashCells(k, OV_COLORS.green));
  });
  let readyLabel = _diagSVG && _diagSVG.querySelector('#cpu-ready-label');
  if (!readyLabel && _diagSVG) {
    readyLabel = mkSVG('text', { id: 'cpu-ready-label', x: CPU_W/2, y: CPU_H - 12,
      'text-anchor': 'middle', fill: OV_COLORS.green,
      'font-family': 'monospace', 'font-size': '14', 'font-weight': '700', 'letter-spacing': '4' });
    _diagSVG.appendChild(readyLabel);
  }
  if (readyLabel) readyLabel.textContent = 'READY TO BUILD';
  _setLabel('READY TO BUILD', OV_COLORS.green);
}

// ─────────────────────────────────────────
//  PAGE EFFECT DISPATCH TABLE
//  Maps [sceneIndex][pageIndex] -> effect fn
// ─────────────────────────────────────────
const _PAGE_EFFECTS = [
  [_pe1_0, _pe1_1, _pe1_2, _pe1_3, _pe1_4],            // Scene 1 — 5 pages
  [_pe2_0, _pe2_1, _pe2_2, _pe2_3, _pe2_4],            // Scene 2 — 5 pages
  [_pe3_0, _pe3_1, _pe3_2, _pe3_3, _pe3_4, _pe3_5],   // Scene 3 — 6 pages
  [_pe4_0, _pe4_1, _pe4_2, _pe4_3],                    // Scene 4 — 4 pages
  [_pe5_0, _pe5_1, _pe5_2, _pe5_3, _pe5_4],            // Scene 5 — 5 pages
  [_pe6_0, _pe6_1, _pe6_2, _pe6_3, _pe6_4],            // Scene 6 — 5 pages
  [_pe7_0, _pe7_1, _pe7_2, _pe7_3],                    // Scene 7 — 4 pages
  [_pe8_0, _pe8_1, _pe8_2, _pe8_3, _pe8_4],            // Scene 8 — 5 pages
  [_pe9_0, _pe9_1, _pe9_2, _pe9_3, _pe9_4],            // Scene 9 — 5 pages
  [_pe10_0, _pe10_1, _pe10_2, _pe10_3],                // Scene 10 — 4 pages
  [_pe11_0, _pe11_1],                                   // Scene 11 — 2 pages
  [_pe12_0, _pe12_1, _pe12_2, _pe12_3, _pe12_4, _pe12_5, _pe12_6], // Scene 12 — 7 pages
  [_pe13_0, _pe13_1],                                   // Scene 13 — 2 pages
  [_pe14_0, _pe14_1],                                   // Scene 14 — 2 pages
];

// ─────────────────────────────────────────
//  PUBLIC: applyPageEffect(sceneIndex, pageIndex)
//  Clears all state, then runs the effect for
//  the specific scene+page combination.
// ─────────────────────────────────────────

function applyPageEffect(sceneIndex, pageIndex) {
  _clearSceneTimers();
  _clearPackets();

  // Reset buses to dim
  ['data','addr','clk'].forEach(b => _setBusActive(b, false));

  // Reset overlay labels
  ['#cpu-phase-label','#cpu-cycle-label','#cpu-ready-label'].forEach(sel => {
    const el = _diagSVG && _diagSVG.querySelector(sel);
    if (el) el.textContent = '';
  });

  // Hide all component values
  Object.keys(CPU_COMPS).forEach(k => _hideCompVal(k));

  const sceneEffects = _PAGE_EFFECTS[sceneIndex];
  if (sceneEffects) {
    const fn = sceneEffects[pageIndex] || sceneEffects[0];
    if (fn) {
      try { fn(); } catch(e) { console.warn('Page effect error S' + sceneIndex + ' P' + pageIndex + ':', e); }
    }
  }
}

// Legacy compat: applySceneEffect now applies page 0 of the scene
function applySceneEffect(sceneIndex) {
  applyPageEffect(sceneIndex, 0);
}

// ─────────────────────────────────────────
//  DIAGRAM LIFECYCLE
// ─────────────────────────────────────────

let _currentSceneCleanup = null;

function startSceneAnimation(sceneIndex, container, pageIndex) {
  if (!_diagBuilt || _diagContainer !== container) {
    buildUnifiedCPUDiagram(container);
  }
  applyPageEffect(sceneIndex, pageIndex || 0);
  _currentSceneCleanup = () => {
    _clearSceneTimers();
    _clearPackets();
    _stopDiagLoop();
    _diagBuilt = false;
    _diagContainer = null;
  };
}

// Legacy stub
function animateScene1(container) {}
// ─────────────────────────────────────────
//  OVERVIEW PANEL HTML BUILDER
// ─────────────────────────────────────────

function buildOverviewPanel() {
  const existing = document.getElementById('overview-panel');
  if (existing) return;

  const panel = document.createElement('div');
  panel.id = 'overview-panel';
  panel.className = 'overview-panel';
  panel.setAttribute('aria-hidden', 'true');

  panel.innerHTML = `
    <div class="ov-bg-overlay"></div>

    <div class="ov-content">
      <div class="ov-layout">

        <!-- Left: diagram -->
        <div class="ov-diagram-side">
          <div class="ov-animation-area" id="ov-animation-area"></div>
        </div>

        <!-- Right: text panel -->
        <div class="ov-text-side">
          <!-- Series + Episode selectors -->
          <div style="display:flex;gap:6px;align-items:center;padding:6px 10px;background:#0a1020;border-radius:6px;border:1px solid #1a2a3a;flex-shrink:0;margin-bottom:6px;flex-wrap:wrap;">
            <label style="color:#668;font-size:10px;font-family:monospace;">Series:</label>
            <select id="ov-series-select" style="background:#111;color:#8aa;border:1px solid #1a2a3a;border-radius:3px;font-size:11px;font-family:monospace;height:28px;flex:1;min-width:150px;"></select>
            <label style="color:#668;font-size:10px;font-family:monospace;">Episode:</label>
            <select id="ov-episode-select" style="background:#111;color:#8aa;border:1px solid #1a2a3a;border-radius:3px;font-size:11px;font-family:monospace;height:28px;flex:1;min-width:150px;"></select>
          </div>
          <div class="ov-scene-counter" id="ov-scene-counter">Scene 1 of 14</div>

          <div class="ov-scene-wrap" id="ov-scene-wrap">
            <div class="ov-scene-title" id="ov-scene-title"></div>
            <div class="ov-scene-text" id="ov-scene-text"></div>
          </div>

          <!-- Scene dots -->
          <div class="ov-dots" id="ov-dots"></div>

          <!-- Voice controls -->
          <div class="ov-voice-bar" id="ov-voice-bar" style="display:flex;gap:6px;align-items:center;padding:6px 10px;background:#0a1020;border-radius:6px;border:1px solid #1a2a3a;flex-shrink:0;">
            <button id="ov-voice-toggle" style="background:#1a3a2a;color:#00ff88;border:none;border-radius:4px;min-width:70px;height:32px;font-size:12px;cursor:pointer;font-family:monospace;">▶ Play</button>
            <button id="ov-voice-stop" style="background:#2a1a1a;color:#ff6666;border:none;border-radius:4px;width:32px;height:32px;font-size:12px;cursor:pointer;font-family:monospace;">■</button>
            <label style="color:#668;font-size:10px;font-family:monospace;margin-left:4px;">Speed</label>
            <input id="ov-voice-speed" type="range" min="0.5" max="2" step="0.1" value="1" style="width:60px;accent-color:#00ff88;">
            <span id="ov-voice-speed-val" style="color:#8aa;font-size:10px;font-family:monospace;min-width:28px;">1.0x</span>
            <label style="color:#668;font-size:10px;font-family:monospace;margin-left:4px;">Voice</label>
            <select id="ov-voice-select" style="background:#111;color:#8aa;border:1px solid #1a2a3a;border-radius:3px;font-size:10px;font-family:monospace;max-width:120px;height:28px;"></select>
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;color:#8aa;font-size:10px;font-family:monospace;margin-left:4px;">
              <input id="ov-voice-auto" type="checkbox" checked style="accent-color:#00ff88;"> Auto
            </label>
          </div>

          <!-- Navigation -->
          <div class="ov-nav">
            <button class="ov-btn ov-btn-skip" id="ov-btn-skip">Skip to Lessons</button>
            <div class="ov-nav-right">
              <button class="ov-btn ov-btn-prev" id="ov-btn-prev" disabled>Previous</button>
              <button class="ov-btn ov-btn-next" id="ov-btn-next">Next Scene</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Wire buttons
  document.getElementById('ov-btn-prev').addEventListener('click', () => navigateOverview(-1));
  document.getElementById('ov-btn-next').addEventListener('click', () => navigateOverview(+1));
  document.getElementById('ov-btn-skip').addEventListener('click', exitOverview);

  // Build scene dots
  buildOverviewDots();

  // Initialize TTS
  ttsInit();

  // Wire Series + Episode selectors
  _wireSeriesSelectors();
}

function _populateSeriesSelect() {
  const sel = document.getElementById('ov-series-select');
  if (!sel) return;
  sel.innerHTML = '';
  Object.keys(_SERIES).forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = _SERIES[id].label;
    sel.appendChild(opt);
  });
  sel.value = _activeSeriesId;
}

function _populateEpisodeSelect() {
  const sel = document.getElementById('ov-episode-select');
  if (!sel) return;
  sel.innerHTML = '';
  const series = _SERIES[_activeSeriesId];
  if (!series) return;
  series.episodes.forEach((ep, i) => {
    const opt = document.createElement('option');
    opt.value = '' + i;
    opt.textContent = ep.label;
    sel.appendChild(opt);
  });
  sel.value = '' + _activeEpisodeIdx;
}

function _wireSeriesSelectors() {
  _populateSeriesSelect();
  _populateEpisodeSelect();
  const seriesSel  = document.getElementById('ov-series-select');
  const episodeSel = document.getElementById('ov-episode-select');
  if (seriesSel) {
    seriesSel.addEventListener('change', (e) => {
      const newSeries = e.target.value;
      _switchEpisode(newSeries, 0);
      _populateEpisodeSelect();
    });
  }
  if (episodeSel) {
    episodeSel.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value, 10);
      _switchEpisode(_activeSeriesId, idx);
    });
  }
}

function buildOverviewDots() {
  const container = document.getElementById('ov-dots');
  if (!container) return;
  container.innerHTML = '';
  _getScenes().forEach((scene, i) => {
    const dot = document.createElement('button');
    dot.className = 'ov-dot';
    dot.title = `Scene ${scene.id}: ${scene.title}`;
    dot.setAttribute('aria-label', `Go to scene ${scene.id}`);
    dot.addEventListener('click', () => jumpToScene(i));
    container.appendChild(dot);
  });
}

// ─────────────────────────────────────────
//  TEXT-TO-SPEECH ENGINE
// ─────────────────────────────────────────

const TTS = {
  playing: false,
  autoAdvance: true,
  speed: 1.0,
  voice: null,
  utterance: null,
};

function ttsInit() {
  const synth = window.speechSynthesis;
  if (!synth) return;

  const toggleBtn = document.getElementById('ov-voice-toggle');
  const stopBtn   = document.getElementById('ov-voice-stop');
  const speedInput = document.getElementById('ov-voice-speed');
  const speedVal   = document.getElementById('ov-voice-speed-val');
  const voiceSelect = document.getElementById('ov-voice-select');
  const autoCheck  = document.getElementById('ov-voice-auto');

  // Populate voices
  function loadVoices() {
    const voices = synth.getVoices();
    if (!voiceSelect || voices.length === 0) return;
    voiceSelect.innerHTML = '';
    // Prefer English voices
    const enVoices = voices.filter(v => v.lang.startsWith('en'));
    const list = enVoices.length > 0 ? enVoices : voices;
    list.forEach((v, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = v.name.substring(0, 25) + (v.default ? ' *' : '');
      opt.dataset.fullIndex = voices.indexOf(v);
      voiceSelect.appendChild(opt);
    });
    // Default to first English voice
    TTS.voice = list[0] || voices[0];
  }
  loadVoices();
  synth.addEventListener('voiceschanged', loadVoices);

  // Voice select
  if (voiceSelect) {
    voiceSelect.addEventListener('change', () => {
      const voices = synth.getVoices();
      const opt = voiceSelect.selectedOptions[0];
      if (opt) TTS.voice = voices[parseInt(opt.dataset.fullIndex)] || voices[0];
    });
  }

  // Speed
  if (speedInput) {
    speedInput.addEventListener('input', () => {
      TTS.speed = parseFloat(speedInput.value);
      if (speedVal) speedVal.textContent = TTS.speed.toFixed(1) + 'x';
    });
  }

  // Auto advance
  if (autoCheck) {
    autoCheck.addEventListener('change', () => {
      TTS.autoAdvance = autoCheck.checked;
    });
  }

  // Play/Pause toggle
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (TTS.playing) {
        ttsPause();
      } else {
        ttsPlayCurrent();
      }
    });
  }

  // Stop
  if (stopBtn) {
    stopBtn.addEventListener('click', ttsStop);
  }
}

// ─────────────────────────────────────────
//  Helper: resolve current page's sentences array
//  Returns [] if the page uses the old string format (graceful degradation).
// ─────────────────────────────────────────
function _getPageSentences(scene, pageIndex) {
  if (!scene) return [];
  const pages = scene.pages || [];
  const page = pages[pageIndex];
  if (!page) return [];
  // New format: page is an object with a `sentences` array
  if (page.sentences) return page.sentences;
  // Legacy format: page is a plain string — treat as a single sentence with no anim
  const text = typeof page === 'string' ? page.trim() : '';
  return text ? [{ text, anim: () => {} }] : [];
}

// ─────────────────────────────────────────
//  Karaoke-style sentence highlight
// ─────────────────────────────────────────
function highlightSentence(index) {
  const textEl = document.getElementById('ov-scene-text');
  if (!textEl) return;
  const spans = textEl.querySelectorAll('.ov-sentence');
  spans.forEach((s, i) => {
    s.style.color      = i === index ? '#dde8f4' : '#334455';
    s.style.transition = 'color 0.3s';
    s.style.fontWeight = i === index ? '600' : '400';
  });
}

function ttsPlayCurrent() {
  const synth = window.speechSynthesis;
  if (!synth) return;

  const scene = _getScenes()[Tutorial.currentScene];
  if (!scene) return;
  const sentences = _getPageSentences(scene, Tutorial.currentPage);
  if (!sentences.length) return;

  // Cancel any ongoing speech
  synth.cancel();

  // Kill auto-play timers — TTS takes over sentence advancement
  _clearAutoPlayTimers();

  TTS.playing = true;
  let sentenceIndex = 0;

  const toggleBtn = document.getElementById('ov-voice-toggle');
  if (toggleBtn) { toggleBtn.textContent = '⏸ Pause'; toggleBtn.style.background = '#2a2a1a'; toggleBtn.style.color = '#ffaa00'; }

  function speakNext() {
    // Guard: if stopped externally, bail out
    if (!TTS.playing) return;

    if (sentenceIndex >= sentences.length) {
      // All sentences spoken — page done
      TTS.playing = false;
      TTS.utterance = null;
      if (toggleBtn) { toggleBtn.textContent = '▶ Play'; toggleBtn.style.background = '#1a3a2a'; toggleBtn.style.color = '#00ff88'; }

      if (TTS.autoAdvance) {
        setTimeout(() => {
          const sc = _getScenes()[Tutorial.currentScene];
          const pgs = sc ? (sc.pages || []) : [];
          const isLastPage = Tutorial.currentPage >= pgs.length - 1;
          const isLastScene = Tutorial.currentScene >= _getScenes().length - 1;
          if (isLastPage && isLastScene) return;
          navigateOverview(+1);
          setTimeout(() => ttsPlayCurrent(), 500);
        }, 600);
      }
      return;
    }

    const sent = sentences[sentenceIndex];

    // Clear previous sentence's delayed _after() timers and packets
    // This prevents old delayed animations from firing on top of new ones
    _clearSentenceTimers();
    _clearPackets();

    // Fire this sentence's animation immediately
    try { sent.anim(); } catch(e) { console.warn('Sentence anim error:', e); }

    // Karaoke highlight
    highlightSentence(sentenceIndex);

    // Speak the sentence
    const utterance = new SpeechSynthesisUtterance(sent.text);
    utterance.rate  = TTS.speed;
    utterance.pitch = 1.0;
    if (TTS.voice) utterance.voice = TTS.voice;

    TTS.utterance = utterance;

    // Track when this sentence started so we can ensure animation completes
    const sentStartTime = Date.now();
    const minDur = _getSentenceDuration(sent);

    // Advance to next sentence only after BOTH speech and animation are done
    function _advanceWhenSynced() {
      const elapsed = Date.now() - sentStartTime;
      const remaining = Math.max(0, minDur - elapsed);
      if (remaining > 50) {
        // Animation still needs time — wait before advancing
        const waitTimer = setTimeout(() => {
          sentenceIndex++;
          speakNext();
        }, remaining);
        _sentenceTimers.push(waitTimer);
      } else {
        sentenceIndex++;
        speakNext();
      }
    }

    utterance.onend = () => {
      _advanceWhenSynced();
    };

    utterance.onerror = () => {
      _advanceWhenSynced();
    };

    synth.speak(utterance);
  }

  speakNext();
}

function ttsPause() {
  const synth = window.speechSynthesis;
  if (!synth) return;

  if (synth.speaking && !synth.paused) {
    synth.pause();
    TTS.playing = false;
    const toggleBtn = document.getElementById('ov-voice-toggle');
    if (toggleBtn) { toggleBtn.textContent = '▶ Resume'; toggleBtn.style.background = '#1a3a2a'; toggleBtn.style.color = '#00ff88'; }
  } else if (synth.paused) {
    synth.resume();
    TTS.playing = true;
    const toggleBtn = document.getElementById('ov-voice-toggle');
    if (toggleBtn) { toggleBtn.textContent = '⏸ Pause'; toggleBtn.style.background = '#2a2a1a'; toggleBtn.style.color = '#ffaa00'; }
  }
}

function ttsStop() {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  TTS.playing = false;
  TTS.utterance = null;
  const toggleBtn = document.getElementById('ov-voice-toggle');
  if (toggleBtn) { toggleBtn.textContent = '▶ Play'; toggleBtn.style.background = '#1a3a2a'; toggleBtn.style.color = '#00ff88'; }
}

// ─────────────────────────────────────────
//  OVERVIEW SCENE RENDERING
// ─────────────────────────────────────────

function renderOverviewScene(index, page) {
  if (index < 0 || index >= _getScenes().length) return;
  Tutorial.currentScene = index;
  const scene = _getScenes()[index];
  const total = _getScenes().length;

  // Resolve pages array (support legacy `text` field as single-page fallback)
  const pages = scene.pages || (scene.text ? [scene.text] : ['']);
  const pageCount = pages.length;

  // Clamp page index
  if (page === undefined) page = Tutorial.currentPage;
  page = Math.max(0, Math.min(page, pageCount - 1));
  Tutorial.currentPage = page;

  // Counter — "Scene 2 — 3 / 5"
  const counter = document.getElementById('ov-scene-counter');
  if (counter) {
    if (pageCount > 1) {
      counter.textContent = `Scene ${scene.id} — ${page + 1} / ${pageCount}`;
    } else {
      counter.textContent = `Scene ${scene.id} of ${total}`;
    }
  }

  // Title
  const titleEl = document.getElementById('ov-scene-title');
  if (titleEl) titleEl.textContent = scene.title;

  // Text — render ALL sentences as dim spans (karaoke style)
  const textEl = document.getElementById('ov-scene-text');
  if (textEl) {
    const sentences = _getPageSentences(scene, page);
    if (sentences.length > 0) {
      textEl.innerHTML = sentences.map((s, i) =>
        `<span class="ov-sentence" data-idx="${i}" style="color:#334455;font-weight:400;transition:color 0.3s;">${s.text} </span>`
      ).join('');
    } else {
      // Legacy fallback: plain string page
      const pageData = pages[page];
      const pageText = typeof pageData === 'string' ? pageData : '';
      textEl.innerHTML = `<p>${pageText.trim().replace(/\n/g, ' ')}</p>`;
    }
  }

  // Build diagram if needed, then fire the FIRST sentence's animation to set initial state.
  // Subsequent sentences fire as TTS speaks each one.
  {
    const animArea = document.getElementById('ov-animation-area');
    const kind = _activeDiagramKind();
    if (kind === 'blocks') {
      // Series B — gate-level diagram. Owned by the Blocks namespace (blocks-core.js).
      if (typeof Blocks !== 'undefined' && Blocks.build) {
        Blocks.build(animArea);
      }
      // Ensure the CPU-diagram state doesn't try to reuse this container later.
      _diagBuilt = false;
      _diagContainer = null;
    } else {
      // Series A — CPU block diagram.
      if (typeof Blocks !== 'undefined' && Blocks.teardown) Blocks.teardown();
      if (!_diagBuilt || _diagContainer !== animArea) {
        buildUnifiedCPUDiagram(animArea);
      }
    }

    // Clear any running timers / packets from the previous page
    _clearSceneTimers();
    _clearSentenceTimers();
    _clearPackets();
    if (kind !== 'blocks') {
      ['data','addr','clk'].forEach(b => _setBusActive(b, false));
      ['#cpu-phase-label','#cpu-cycle-label','#cpu-ready-label'].forEach(sel => {
        const el = _diagSVG && _diagSVG.querySelector(sel);
        if (el) el.textContent = '';
      });
      Object.keys(CPU_COMPS).forEach(k => _hideCompVal(k));
    } else if (typeof Blocks !== 'undefined' && Blocks.resetScene) {
      Blocks.resetScene();
    }

    // Auto-play sentence animations with per-sentence durations (sync engine).
    // Each sentence stays on screen for its `dur` (or auto-calculated from word count).
    const sentences = _getPageSentences(scene, page);
    if (sentences.length > 0) {
      // Fire sentence 0 immediately
      try { sentences[0].anim(); } catch(e) { console.warn('S0 anim error:', e); }
      highlightSentence(0);

      // If TTS is NOT playing, auto-cycle using per-sentence durations.
      // Guard each tick: if TTS starts mid-page (e.g. auto-advance),
      // silently yield to TTS and stop the auto-play chain.
      if (!TTS.playing && sentences.length > 1) {
        let autoIdx = 1;
        _clearAutoPlayTimers();
        function _scheduleNextAutoSentence() {
          if (autoIdx >= sentences.length) return;
          const prevDur = _getSentenceDuration(sentences[autoIdx - 1]);
          const timer = setTimeout(() => {
            // If TTS took over while we were waiting, yield to it
            if (TTS.playing) return;
            _clearSentenceTimers();
            _clearPackets();
            try { sentences[autoIdx].anim(); } catch(e) {}
            highlightSentence(autoIdx);
            autoIdx++;
            _scheduleNextAutoSentence();
          }, prevDur);
          _autoPlayTimers.push(timer);
        }
        _scheduleNextAutoSentence();
      }
    } else {
      // Legacy: fall back to old applyPageEffect
      applyPageEffect(index, page);
    }

    _currentSceneCleanup = () => {
      _clearSceneTimers();
      _clearPackets();
      _stopDiagLoop();
      _diagBuilt = false;
      _diagContainer = null;
    };
  }

  // Dots
  document.querySelectorAll('.ov-dot').forEach((dot, i) => {
    dot.classList.remove('ov-dot-done', 'ov-dot-current');
    if (i < index)   dot.classList.add('ov-dot-done');
    if (i === index) dot.classList.add('ov-dot-current');
  });

  // Navigation buttons
  const prevBtn = document.getElementById('ov-btn-prev');
  const nextBtn = document.getElementById('ov-btn-next');

  // Prev: disabled only if on first page of first scene
  if (prevBtn) prevBtn.disabled = (index === 0 && page === 0);

  // Next label logic
  if (nextBtn) {
    const isLastPage = page >= pageCount - 1;
    const isLastScene = index >= total - 1;

    nextBtn.classList.remove('ov-btn-next-final');

    if (isLastPage && scene.isFinal) {
      nextBtn.textContent = 'Start Interactive Lessons';
      nextBtn.classList.add('ov-btn-next-final');
    } else if (isLastPage) {
      nextBtn.textContent = 'Next Scene \u2192';
    } else {
      nextBtn.textContent = 'Next';
    }
  }

  // Component highlighting on simulator (dim everything except relevant sections)
  applyOverviewHighlight(scene);

  // Trigger fade-in animation
  const wrap = document.getElementById('ov-scene-wrap');
  if (wrap) {
    wrap.classList.remove('ov-fade-in');
    void wrap.offsetWidth; // force reflow
    wrap.classList.add('ov-fade-in');
  }
}

let _cycleAnimTimer = null;

function animateCycleSteps() {
  if (_cycleAnimTimer) clearInterval(_cycleAnimTimer);

  const steps = ['ov-cs-fetch', 'ov-cs-decode', 'ov-cs-execute'];
  let current = 0;

  function highlight() {
    steps.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('ov-cycle-active');
    });
    const activeEl = document.getElementById(steps[current]);
    if (activeEl) activeEl.classList.add('ov-cycle-active');
    current = (current + 1) % steps.length;
  }

  highlight();
  _cycleAnimTimer = setInterval(highlight, 900);
}

function applyOverviewHighlight(scene) {
  if (!document.body.classList.contains('learn-mode')) return;

  if (scene.showAll) {
    clearComponentDimming();
    return;
  }

  if (!scene.highlightComponents || scene.highlightComponents.length === 0) {
    clearComponentDimming();
    return;
  }

  DIMMABLE_SECTIONS.forEach(sec => {
    const el = _sectionEls[sec];
    if (!el) return;
    if (scene.highlightComponents.includes(sec)) {
      el.classList.remove('tut-dim');
      el.classList.add('tut-active-comp');
    } else {
      el.classList.remove('tut-active-comp');
      el.classList.add('tut-dim');
    }
  });
}

function navigateOverview(delta) {
  // Stop any running TTS before navigating so the new page starts clean
  ttsStop();

  const scene = _getScenes()[Tutorial.currentScene];
  const pages = scene ? (scene.pages || (scene.text ? [scene.text] : [])) : [];
  const pageCount = pages.length || 1;
  const currentPage = Tutorial.currentPage;

  if (delta === +1) {
    if (currentPage < pageCount - 1) {
      // Advance to next page within this scene
      renderOverviewScene(Tutorial.currentScene, currentPage + 1);
    } else {
      // Last page — advance to next scene
      const nextScene = Tutorial.currentScene + 1;
      if (nextScene >= _getScenes().length) {
        // Past the last scene — exit to lessons
        exitOverview();
        return;
      }
      Tutorial.currentPage = 0;
      renderOverviewScene(nextScene, 0);
    }
  } else if (delta === -1) {
    if (currentPage > 0) {
      // Go back one page within this scene
      renderOverviewScene(Tutorial.currentScene, currentPage - 1);
    } else {
      // On first page — go to previous scene's last page
      const prevScene = Tutorial.currentScene - 1;
      if (prevScene < 0) return;
      const prevSceneData = _getScenes()[prevScene];
      const prevPages = prevSceneData
        ? (prevSceneData.pages || (prevSceneData.text ? [prevSceneData.text] : []))
        : [];
      const lastPage = Math.max(0, prevPages.length - 1);
      Tutorial.currentPage = lastPage;
      renderOverviewScene(prevScene, lastPage);
    }
  }
}

function jumpToScene(index) {
  Tutorial.currentPage = 0;
  renderOverviewScene(index, 0);
}

function showOverview() {
  // Stop any running simulation
  window.stopRunLoop && window.stopRunLoop();

  Tutorial.overviewActive = true;
  Tutorial.currentScene = 0;
  Tutorial.currentPage = 0;

  const panel = document.getElementById('overview-panel');
  if (panel) {
    panel.classList.add('ov-visible');
    panel.setAttribute('aria-hidden', 'false');
  }

  // Ensure learn-mode body class so dimming works
  if (!document.body.classList.contains('learn-mode')) {
    document.body.classList.add('learn-mode');
  }

  renderOverviewScene(0, 0);
}

function exitOverview() {
  // Stop TTS
  ttsStop();

  // Stop cycle animation timer (legacy)
  if (_cycleAnimTimer) {
    clearInterval(_cycleAnimTimer);
    _cycleAnimTimer = null;
  }

  // Stop current scene animation
  if (_currentSceneCleanup) {
    try { _currentSceneCleanup(); } catch(e) {}
    _currentSceneCleanup = null;
  }

  Tutorial.overviewActive = false;

  const panel = document.getElementById('overview-panel');
  if (panel) {
    panel.classList.remove('ov-visible');
    panel.setAttribute('aria-hidden', 'true');
  }

  // Mark overview as seen
  try {
    localStorage.setItem(OVERVIEW_SEEN_KEY, '1');
  } catch(e) {}

  // Switch to interactive lessons view
  // enterLearnMode handles rendering the lesson
  renderLesson(Tutorial.currentLesson);
}

function hasSeenOverview() {
  try {
    return localStorage.getItem(OVERVIEW_SEEN_KEY) === '1';
  } catch(e) { return false; }
}

// ─────────────────────────────────────────
//  PANEL HTML BUILDER (interactive lessons)
// ─────────────────────────────────────────

function buildTutorialPanel() {
  const panel = document.createElement('div');
  panel.id = 'tutorial-panel';

  panel.innerHTML = `
    <div class="tut-header">
      <div class="tut-header-top">
        <div class="tut-lesson-num" id="tut-lesson-num">LESSON 1 OF ${TOTAL_LESSONS}</div>
        <button class="tut-overview-btn" id="tut-overview-btn" title="Replay the overview">Overview</button>
      </div>
      <div class="tut-lesson-title" id="tut-lesson-title">Loading...</div>
      <div class="tut-progress-bar-wrap">
        <div class="tut-progress-bar-fill" id="tut-progress-bar" style="width:0%"></div>
      </div>
      <div class="tut-dots" id="tut-dots"></div>
    </div>

    <div class="tut-body" id="tut-body">
      <!-- Content injected per lesson -->
    </div>

    <div class="tut-footer">
      <button class="tut-nav-btn" id="tut-btn-prev">Previous</button>
      <button class="tut-skip-link" id="tut-btn-skip">skip</button>
      <button class="tut-nav-btn tut-nav-next" id="tut-btn-next" disabled>Next</button>
    </div>
  `;

  const main = document.querySelector('.app-main');
  if (main) {
    main.insertBefore(panel, main.firstChild);
  }

  document.getElementById('tut-btn-prev').addEventListener('click', () => navigateLesson(-1));
  document.getElementById('tut-btn-next').addEventListener('click', () => navigateLesson(+1));
  document.getElementById('tut-btn-skip').addEventListener('click', () => navigateLesson(+1, true));
  document.getElementById('tut-overview-btn').addEventListener('click', showOverview);

  buildProgressDots();
}

function buildProgressDots() {
  const container = document.getElementById('tut-dots');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < TOTAL_LESSONS; i++) {
    const dot = document.createElement('button');
    dot.className = 'tut-dot';
    dot.title = `Lesson ${i + 1}: ${LESSONS[i].title}`;
    dot.addEventListener('click', () => jumpToLesson(i));
    container.appendChild(dot);
  }
}

// ─────────────────────────────────────────
//  LESSON RENDERING
// ─────────────────────────────────────────

function renderLesson(index) {
  if (index < 0 || index >= LESSONS.length) return;
  Tutorial.currentLesson = index;
  Tutorial.stepCount     = 0;
  Tutorial.taskDone      = false;
  Tutorial.predictionsDone = 0;

  const lesson = LESSONS[index];

  const numEl = document.getElementById('tut-lesson-num');
  if (numEl) numEl.textContent = `LESSON ${lesson.id} OF ${TOTAL_LESSONS}`;

  const titleEl = document.getElementById('tut-lesson-title');
  if (titleEl) titleEl.textContent = lesson.title;

  const bar = document.getElementById('tut-progress-bar');
  if (bar) bar.style.width = `${((index + 1) / TOTAL_LESSONS) * 100}%`;

  document.querySelectorAll('.tut-dot').forEach((dot, i) => {
    dot.classList.remove('dot-done', 'dot-current');
    if (i < index)   dot.classList.add('dot-done');
    if (i === index) dot.classList.add('dot-current');
  });

  const body = document.getElementById('tut-body');
  if (!body) return;

  let cycleBoxHtml = '';
  if (index >= 6) {
    cycleBoxHtml = `
      <div class="tut-cycle-box">
        <span class="tut-phase-fetch">FETCH</span> T0: CO+MI &nbsp;|&nbsp; T1: RO+II+CE
        &nbsp;&nbsp;then&nbsp;&nbsp;
        <span class="tut-phase-exec">EXECUTE</span> T2+: instruction-specific
      </div>`;
  }

  const taskActive = lesson.taskCheck(Tutorial, window.App && window.App.lastState) ? '' : 'task-active';

  body.innerHTML = `
    <div class="tut-explanation">${lesson.content}</div>

    ${cycleBoxHtml}

    ${lesson.extraHTML || ''}

    <div class="tut-task ${taskActive}" id="tut-task-box">
      <div class="tut-task-label">
        <span class="tut-task-check" id="tut-task-check"></span>
        Task
      </div>
      <div class="tut-task-text">${lesson.taskDescription}</div>
      <div class="tut-task-progress" id="tut-task-progress">
        ${typeof lesson.taskProgressText === 'function'
          ? lesson.taskProgressText(Tutorial, window.App && window.App.lastState)
          : ''}
      </div>
    </div>

    <div class="tut-why-wrap">
      <button class="tut-why-toggle" id="tut-why-toggle">
        <span class="tut-why-arrow">▶</span>
        Why does this matter?
      </button>
      <div class="tut-why-content" id="tut-why-content">${lesson.whyText}</div>
    </div>
  `;

  const whyToggle = document.getElementById('tut-why-toggle');
  const whyContent = document.getElementById('tut-why-content');
  if (whyToggle && whyContent) {
    whyToggle.addEventListener('click', () => {
      const open = whyContent.classList.toggle('open');
      whyToggle.classList.toggle('open', open);
    });
  }

  document.querySelectorAll('.tut-pred-choice').forEach(btn => {
    btn.addEventListener('click', () => handlePrediction(btn));
  });

  setupLessonCPU(lesson);
  applyComponentVisibility(index);
  updateNextButton();
  saveProgress(index);
}

function setupLessonCPU(lesson) {
  if (!window.App || !window.App.cpu) return;
  const cpu = window.App.cpu;
  window.stopRunLoop && window.stopRunLoop();
  window.App.outputHistory = [];
  window.App.clockWaveform = [];
  window.App.execHistory   = [];
  lesson.setup(cpu);
  const state = cpu.captureState('Lesson loaded — ready to step.');
  window.App.lastState = state;
  window.updateFullDisplay && window.updateFullDisplay(state);
  if (window.renderOutputHistory) window.renderOutputHistory();
}

// ─────────────────────────────────────────
//  COMPONENT VISIBILITY (dimming)
// ─────────────────────────────────────────

function applyComponentVisibility(lessonIndex) {
  const visible = LESSON_VISIBLE[lessonIndex] || DIMMABLE_SECTIONS;

  DIMMABLE_SECTIONS.forEach(sec => {
    const el = _sectionEls[sec];
    if (!el) return;
    if (visible.includes(sec)) {
      el.classList.remove('tut-dim');
      el.classList.add('tut-active-comp');
    } else {
      el.classList.remove('tut-active-comp');
      el.classList.add('tut-dim');
    }
  });
}

function clearComponentDimming() {
  DIMMABLE_SECTIONS.forEach(sec => {
    const el = _sectionEls[sec];
    if (!el) return;
    el.classList.remove('tut-dim', 'tut-active-comp');
  });
}

// ─────────────────────────────────────────
//  TASK CHECKING
// ─────────────────────────────────────────

function checkCurrentTask() {
  const lesson = LESSONS[Tutorial.currentLesson];
  if (!lesson) return;
  const state = window.App && window.App.lastState;
  const done  = lesson.taskCheck(Tutorial, state);
  const taskBox    = document.getElementById('tut-task-box');
  const checkMark  = document.getElementById('tut-task-check');
  const progressEl = document.getElementById('tut-task-progress');

  if (progressEl && typeof lesson.taskProgressText === 'function') {
    progressEl.textContent = lesson.taskProgressText(Tutorial, state);
  }

  if (done && !Tutorial.taskDone) {
    Tutorial.taskDone = true;
    if (taskBox) {
      taskBox.classList.remove('task-active');
      taskBox.classList.add('task-done');
    }
    if (checkMark) checkMark.textContent = '\u2713';
    updateNextButton();
  }
}

function updateNextButton() {
  const btn = document.getElementById('tut-btn-next');
  if (!btn) return;
  const lesson = LESSONS[Tutorial.currentLesson];
  if (!lesson) return;
  const done = Tutorial.taskDone || lesson.taskCheck(Tutorial, window.App && window.App.lastState);
  Tutorial.taskDone = done;
  btn.disabled = false;
  btn.classList.toggle('enabled', done);
  if (Tutorial.currentLesson >= TOTAL_LESSONS - 1) {
    btn.textContent = 'Complete!';
  } else {
    btn.textContent = 'Next';
  }
  const prevBtn = document.getElementById('tut-btn-prev');
  if (prevBtn) prevBtn.disabled = Tutorial.currentLesson === 0;
}

// ─────────────────────────────────────────
//  PREDICTION HANDLER (Lesson 8)
// ─────────────────────────────────────────

function handlePrediction(btn) {
  const q = btn.dataset.q;
  const ans = btn.dataset.ans;
  const correct = { '0': 'yes', '1': 'yes' };

  const pair = document.querySelectorAll(`.tut-pred-choice[data-q="${q}"]`);
  pair.forEach(b => {
    b.disabled = true;
    if (b === btn) {
      b.classList.add(ans === correct[q] ? 'correct' : 'wrong');
    } else {
      if (b.dataset.ans === correct[q]) b.classList.add('correct');
    }
  });

  Tutorial.predictionsDone++;

  const resultEl = document.getElementById('tut-pred-result');
  if (resultEl && Tutorial.predictionsDone >= 2) {
    resultEl.style.display = 'block';
    resultEl.textContent = 'Exactly right: at T4 of LDA, both RO and AI fire together — RAM sends the byte onto the bus, A captures it, all in one clock tick.';
  }

  checkCurrentTask();
}

// ─────────────────────────────────────────
//  NAVIGATION
// ─────────────────────────────────────────

function navigateLesson(delta, skip = false) {
  const next = Tutorial.currentLesson + delta;
  if (next < 0 || next >= TOTAL_LESSONS) return;
  renderLesson(next);
}

function jumpToLesson(index) {
  renderLesson(index);
}

// ─────────────────────────────────────────
//  MODE TOGGLE
// ─────────────────────────────────────────

function enterLearnMode() {
  document.body.classList.add('learn-mode');
  const panel = document.getElementById('tutorial-panel');
  if (panel) panel.style.display = 'flex';

  const main = document.querySelector('.app-main');
  if (main) {
    main.style.gridTemplateColumns = '340px 500px 310px 1fr';
  }

  renderLesson(Tutorial.currentLesson);
}

function enterFreeMode() {
  document.body.classList.remove('learn-mode');
  clearComponentDimming();

  // Close overview if open
  if (Tutorial.overviewActive) {
    if (_cycleAnimTimer) { clearInterval(_cycleAnimTimer); _cycleAnimTimer = null; }
    if (_currentSceneCleanup) { try { _currentSceneCleanup(); } catch(e) {} _currentSceneCleanup = null; }
    Tutorial.overviewActive = false;
    const ovPanel = document.getElementById('overview-panel');
    if (ovPanel) { ovPanel.classList.remove('ov-visible'); ovPanel.setAttribute('aria-hidden', 'true'); }
  }

  window.stopRunLoop && window.stopRunLoop();

  const main = document.querySelector('.app-main');
  if (main) {
    main.style.gridTemplateColumns = '';
  }

  if (window.loadProgram) window.loadProgram('Hello Output');
}

function buildModeToggle() {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;

  const wrap = document.createElement('div');
  wrap.className = 'mode-toggle-wrap';
  wrap.innerHTML = `
    <span class="mode-toggle-label">Mode</span>
    <div class="mode-toggle" id="mode-toggle" title="Switch between Free / Learn / Build modes">
      <span class="mode-toggle-option active" id="toggle-free">Free</span>
      <span class="mode-toggle-option" id="toggle-learn">Learn</span>
      <span class="mode-toggle-option" id="toggle-build">Build</span>
    </div>
  `;
  headerRight.prepend(wrap);

  const freeOpt  = document.getElementById('toggle-free');
  const learnOpt = document.getElementById('toggle-learn');
  const buildOpt = document.getElementById('toggle-build');

  function setActive(opt) {
    freeOpt.classList.remove('active');
    learnOpt.classList.remove('active');
    buildOpt.classList.remove('active');
    opt.classList.add('active');
  }

  freeOpt.addEventListener('click', () => {
    if (document.body.classList.contains('build-mode')) {
      if (window.exitBuildMode) window.exitBuildMode();
    }
    setActive(freeOpt);
    enterFreeMode();
  });

  learnOpt.addEventListener('click', () => {
    if (document.body.classList.contains('build-mode')) {
      if (window.exitBuildMode) window.exitBuildMode();
    }
    setActive(learnOpt);

    // First time: show overview. Returning: go straight to lessons.
    if (!hasSeenOverview()) {
      document.body.classList.add('learn-mode');
      const main = document.querySelector('.app-main');
      if (main) main.style.gridTemplateColumns = '340px 500px 310px 1fr';
      showOverview();
    } else {
      enterLearnMode();
    }
  });

  buildOpt.addEventListener('click', () => {
    if (document.body.classList.contains('learn-mode')) {
      enterFreeMode();
    }
    setActive(buildOpt);
    if (!window._bbInitialized) {
      window._bbInitialized = true;
      if (window.enterBuildMode) window.enterBuildMode();
      setTimeout(() => { if (window.bbInit) window.bbInit(); }, 80);
    } else {
      if (window.enterBuildMode) window.enterBuildMode();
    }
  });
}

// ─────────────────────────────────────────
//  WRAPPING doStep
// ─────────────────────────────────────────

function wrapDoStep() {
  const originalDoStep = window.doStep;
  if (!originalDoStep || window._tutDoStepWrapped) return;
  window._tutDoStepWrapped = true;

  window.doStep = function() {
    originalDoStep.apply(this, arguments);

    if (document.body.classList.contains('learn-mode') && !Tutorial.overviewActive) {
      const lesson = LESSONS[Tutorial.currentLesson];
      const state  = window.App && window.App.lastState;
      if (lesson && lesson.onStep) lesson.onStep(Tutorial, state);
      checkCurrentTask();
    }
  };
}

function wrapRunMethods() {
  ['doStepInstruction', 'doAssembleAndRun', 'doAssemble'].forEach(methodName => {
    const orig = window[methodName];
    if (!orig || window[`_tut_${methodName}_wrapped`]) return;
    window[`_tut_${methodName}_wrapped`] = true;
    window[methodName] = function() {
      orig.apply(this, arguments);
      if (document.body.classList.contains('learn-mode') && !Tutorial.overviewActive) {
        setTimeout(() => checkCurrentTask(), 100);
      }
    };
  });

  const origStartRunLoop = window.startRunLoop;
  if (origStartRunLoop && !window._tut_startRunLoop_wrapped) {
    window._tut_startRunLoop_wrapped = true;
    window.startRunLoop = function() {
      origStartRunLoop.apply(this, arguments);
      if (document.body.classList.contains('learn-mode') && !Tutorial.overviewActive) {
        if (!window._tutRunPoll) {
          window._tutRunPoll = setInterval(() => {
            if (document.body.classList.contains('learn-mode') && !Tutorial.overviewActive) {
              const lesson = LESSONS[Tutorial.currentLesson];
              const state  = window.App && window.App.lastState;
              if (lesson && lesson.onStep) lesson.onStep(Tutorial, state);
              checkCurrentTask();
            }
            if (!window.App || !window.App.runInterval) {
              clearInterval(window._tutRunPoll);
              window._tutRunPoll = null;
            }
          }, 150);
        }
      }
    };
  }
}

// ─────────────────────────────────────────
//  DIMMABLE SECTION ELEMENT MAP
// ─────────────────────────────────────────

const SECTION_SELECTOR_MAP = {
  'section-waveform':  '#waveform-canvas',
  'section-signals':   '#control-signals',
  'section-registers': '#registers-grid',
  'section-flags':     '.flags-display',
  'section-buses':     '.buses-display',
  'section-output':    '#output-history',
  'section-diagram':   '#cpu-diagram',
};

const _sectionEls = {};

function addSectionIds() {
  for (const [key, selector] of Object.entries(SECTION_SELECTOR_MAP)) {
    const el = document.querySelector(selector);
    if (el) {
      _sectionEls[key] = el;
      el.dataset.tutSection = key;
    } else {
      console.warn(`Tutorial: could not find element for section "${key}" (${selector})`);
    }
  }
}

// ─────────────────────────────────────────
//  PERSISTENCE
// ─────────────────────────────────────────

function saveProgress(lessonIndex) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lesson: lessonIndex }));
  } catch(e) {}
}

function loadProgress() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return typeof data.lesson === 'number' ? data.lesson : 0;
  } catch(e) { return 0; }
}

// ─────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────

function initTutorial() {
  if (Tutorial.initialized) return;
  Tutorial.initialized = true;

  addSectionIds();
  buildTutorialPanel();
  buildOverviewPanel();
  buildModeToggle();
  wrapDoStep();
  wrapRunMethods();

  Tutorial.currentLesson = loadProgress();
}

// Boot after DOM and ui.js initApp() have both run
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(initTutorial, 0);
});
