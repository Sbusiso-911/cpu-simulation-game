/**
 * Video 2: The Stack
 * ===================
 * Builds on Video 1. Uses the same CPU diagram and animation helpers.
 * Topics: SP register (visualized in RAM), the stack region, PUSH, POP,
 * CALL, RET, and how functions work.
 *
 * Loaded after tutorial.js. Uses the same helper functions:
 *   _busWrite, _showCompVal, _enforceHardwiredLinks, _highlightRAMRow,
 *   _clockPulse, _cuFiresSignals, _busWaitingAtDoors, _spawnPacket, etc.
 *
 * V2 reuses the global _diagCompEls, OV_COLORS, CPU_WIRES set up by tutorial.js.
 */

const V2_SCENES = [

  // ─────────────────────────────────────────
  // SCENE 1 — What is a stack?
  // ─────────────────────────────────────────
  {
    id: 1,
    title: 'What is a Stack?',
    pages: [
      // Page 0 — the plate analogy
      { sentences: [
        { text: `Welcome back. In Video 1, we saw how the CPU executes one instruction after another. Now we will see how it remembers where to come back to — using something called a stack.`, dur: 6000, anim: () => {
          _dimAll(); Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          _setLabel('Video 2: The Stack', OV_COLORS.teal);
        }},
        { text: `A stack is the simplest possible storage system. Imagine a stack of plates. You can only put a plate on top, and you can only take the top one off.`, dur: 5500, anim: () => {
          _dimAll();
          _setLabel('Stack of plates: put on top, take from top.', OV_COLORS.teal);
        }},
        { text: `Last in, first out. The plate you put down most recently is the first one you take back. That is what a stack means.`, dur: 5000, anim: () => {
          _dimAll();
          _setLabel('LIFO — Last In, First Out.', OV_COLORS.teal);
        }},
        { text: `Inside a CPU, the stack is not made of plates. It is just a region of RAM used in this special way. We push values into it and pop them back out.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('RAM');
          _setLabel('CPU stack = a special region of RAM. Push in, pop out.', OV_COLORS.amber);
        }},
      ]},
    ],
    highlightComponents: [],
    showAll: true,
  },

  // ─────────────────────────────────────────
  // SCENE 2 — The Stack Pointer (SP)
  // ─────────────────────────────────────────
  {
    id: 2,
    title: 'The Stack Pointer',
    pages: [
      // Page 0 — what is SP
      { sentences: [
        { text: `To use the stack, the CPU needs a special pointer — the Stack Pointer, or SP. It is a register, just like the others. It holds one number: the address of the top of the stack.`, dur: 6500, anim: () => {
          _dimAll(); _glowComp('RAM'); _glowComp('CU');
          _setLabel('SP = Stack Pointer. A register that points at the top of the stack.', OV_COLORS.purple);
        }},
        { text: `Think of SP as a finger that points at where the next plate will go. Whenever we push, SP moves. Whenever we pop, SP moves back.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('RAM');
          _setLabel('SP = a finger that points at the top of the stack.', OV_COLORS.purple);
        }},
        { text: `In our CPU, SP starts at address 255 — the very last byte of RAM. The stack lives at the top of memory.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('RAM');
          // Highlight the top of RAM as the stack region (we use row 7 as visual proxy for "top")
          _highlightRAMRow(7);
          _setLabel('SP starts at 255 — the top of RAM. Stack lives there.', OV_COLORS.purple);
        }},
      ]},
      // Page 1 — why downward?
      { sentences: [
        { text: `Here is something strange. The stack grows DOWNWARD. When we push, SP gets smaller, not bigger. When we pop, SP gets bigger.`, dur: 6000, anim: () => {
          _dimAll(); _glowComp('RAM');
          _highlightRAMRow(7);
          _setLabel('Stack grows DOWN. Push → SP smaller. Pop → SP bigger.', OV_COLORS.red);
        }},
        { text: `Why? Because the program lives at the bottom of RAM and grows upward. The stack lives at the top and grows downward. They start far apart and grow toward each other. As long as they do not meet in the middle, all is well.`, dur: 8000, anim: () => {
          _dimAll(); _glowComp('RAM');
          // Show program at top rows, stack at bottom (visual proxy)
          _showBinaryInRAMRow(0, 0x05, OV_COLORS.amber);
          _showBinaryInRAMRow(1, 0x03, OV_COLORS.amber);
          _showBinaryInRAMRow(2, 0x02, OV_COLORS.amber);
          _highlightRAMRow(7);
          _setLabel('Program grows ↑ from 0. Stack grows ↓ from 255. They share RAM.', OV_COLORS.amber);
        }},
      ]},
    ],
    highlightComponents: [],
    showAll: true,
  },

  // ─────────────────────────────────────────
  // SCENE 3 — PUSH
  // ─────────────────────────────────────────
  {
    id: 3,
    title: 'PUSH — Storing on the Stack',
    pages: [
      // Page 0 — intro
      { sentences: [
        { text: `Let us see PUSH in action. Suppose Register A holds the value 42 and we want to save it on the stack for later.`, dur: 5000, anim: () => {
          _dimAll(); _glowComp('REGA'); _glowComp('RAM');
          _showCompVal('REGA', '42');
          _setLabel('A = 42. We will PUSH it onto the stack.', OV_COLORS.purple);
        }},
        { text: `The instruction is just one byte: PUSH. The CPU fetches it from RAM the same way as any other instruction. T0 and T1 — fetch as usual.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('PC'); _glowComp('MAR'); _glowComp('RAM'); _glowComp('IR'); _glowComp('CU'); _glowComp('CLK');
          _showCompVal('REGA', '42');
          _showCompVal('PC', '0'); _showCompVal('CU', 'T0');
          _cuFiresSignals(['CO', 'MI']);
          _setBusActive('addr', true);
          _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0);
          _after(500, () => { _showCompVal('MAR', '0'); _showCompVal('CU', 'T1'); _cuFiresSignals(['RO', 'II', 'CE']); _busWrite('RAM', 'w-ram-db', 16, OV_COLORS.amber); });
          _after(1100, () => { _receiveComp('IR', OV_COLORS.amber); _showCompVal('IR', 'PUSH'); _showCompVal('PC', '1'); });
          _setLabel('T0+T1: Fetch PUSH opcode (0x10) into IR.', OV_COLORS.teal);
        }},
      ]},
      // Page 1 — the actual push
      { sentences: [
        { text: `Now the execute step. The CU does two things: tell SP to put its address on the address bus, and tell A to put its value on the data bus. RAM stores A into the row SP is pointing at.`, dur: 7000, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('REGA'); _glowComp('RAM'); _glowComp('CLK');
          _showCompVal('REGA', '42'); _showCompVal('IR', 'PUSH'); _showCompVal('CU', 'T2');
          // SP would put 0xFF (255) on address bus. We use row 7 as visual proxy.
          _highlightRAMRow(7);
          _cuFiresSignals(['SPO', 'AO', 'RI']);
          _setBusActive('addr', true);
          _setBusActive('data', true);
          _busWrite('REGA', 'w-rega-out', 42, OV_COLORS.purple);
          _after(800, () => { _clockPulse(false); _receiveComp('RAM', OV_COLORS.amber); _showBinaryInRAMRow(7, 42, OV_COLORS.purple); });
          _setLabel('T2: SP→addr bus, A→data bus, RAM stores 42 at SP location.', OV_COLORS.purple);
        }},
        { text: `Then SP gets smaller by one. The pointer moves down. The next push will go into the row below.`, dur: 5000, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('RAM');
          _showCompVal('REGA', '42'); _showCompVal('CU', 'T3');
          _showBinaryInRAMRow(7, 42, OV_COLORS.purple);
          _cuFiresSignals(['SPD']);
          // Visually: SP was pointing at row 7, now points at row 6
          _highlightRAMRow(6);
          _setLabel('T3: SPD → SP decrements. Pointer moves DOWN one row.', OV_COLORS.red);
        }},
        { text: `Done. The value 42 is now safely stored on the stack. Register A still holds 42 too — PUSH copies, it does not erase.`, dur: 5000, anim: () => {
          _dimAll(); _glowComp('REGA'); _glowComp('RAM');
          _showCompVal('REGA', '42');
          _showBinaryInRAMRow(7, 42, OV_COLORS.purple);
          _highlightRAMRow(6);
          _setLabel('PUSH done. 42 in RAM. A still has 42. SP moved down.', OV_COLORS.green);
        }},
      ]},
      // Page 2 — push another value
      { sentences: [
        { text: `Let us push another value. Say A now holds 99. We push again. Watch where it lands.`, dur: 5000, anim: () => {
          _dimAll(); _glowComp('REGA'); _glowComp('RAM');
          _showCompVal('REGA', '99');
          _showBinaryInRAMRow(7, 42, OV_COLORS.purple);
          _highlightRAMRow(6);
          _setLabel('A = 99. PUSH again. Where does it go?', OV_COLORS.purple);
        }},
        { text: `SP is now pointing at the row below 42. PUSH stores 99 at that row. Then SP moves down again.`, dur: 6500, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('REGA'); _glowComp('RAM'); _glowComp('CLK');
          _showCompVal('REGA', '99'); _showCompVal('CU', 'T2');
          _cuFiresSignals(['SPO', 'AO', 'RI']);
          _setBusActive('data', true);
          _busWrite('REGA', 'w-rega-out', 99, OV_COLORS.purple);
          _showBinaryInRAMRow(7, 42, OV_COLORS.purple);
          _after(800, () => { _clockPulse(false); _receiveComp('RAM', OV_COLORS.amber); _showBinaryInRAMRow(6, 99, OV_COLORS.purple); });
          _after(1500, () => { _cuFiresSignals(['SPD']); _highlightRAMRow(5); });
          _setLabel('99 stored at row 6. SP moves down to row 5.', OV_COLORS.purple);
        }},
        { text: `The stack now has two values: 42 at the bottom of the stack, 99 on top. SP points at the next free spot.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('RAM');
          _showBinaryInRAMRow(7, 42, OV_COLORS.purple);
          _showBinaryInRAMRow(6, 99, OV_COLORS.purple);
          _highlightRAMRow(5);
          _setLabel('Stack: [42, 99]. 99 is on top. SP points at next slot.', OV_COLORS.green);
        }},
      ]},
    ],
    highlightComponents: [],
    showAll: true,
  },

  // ─────────────────────────────────────────
  // SCENE 4 — POP
  // ─────────────────────────────────────────
  {
    id: 4,
    title: 'POP — Taking from the Stack',
    pages: [
      // Page 0
      { sentences: [
        { text: `POP is the opposite of PUSH. It takes the top value off the stack and puts it into Register A.`, dur: 5000, anim: () => {
          _dimAll(); _glowComp('REGA'); _glowComp('RAM');
          _showBinaryInRAMRow(7, 42, OV_COLORS.purple);
          _showBinaryInRAMRow(6, 99, OV_COLORS.purple);
          _highlightRAMRow(5);
          _setLabel('POP: take the top value off the stack into A.', OV_COLORS.purple);
        }},
        { text: `First, SP moves UP by one. It goes back to where the top value lives.`, dur: 4500, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('RAM');
          _showBinaryInRAMRow(7, 42, OV_COLORS.purple);
          _showBinaryInRAMRow(6, 99, OV_COLORS.purple);
          _showCompVal('CU', 'T2');
          _cuFiresSignals(['SPUP']);
          _highlightRAMRow(6);
          _setLabel('T2: SPUP → SP moves UP. Now points at the top value (99).', OV_COLORS.red);
        }},
        { text: `Then the CU tells SP to put its address on the bus, RAM to release that row, and Register A to capture it.`, dur: 6500, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('REGA'); _glowComp('RAM'); _glowComp('CLK');
          _showCompVal('CU', 'T3');
          _showBinaryInRAMRow(7, 42, OV_COLORS.purple);
          _showBinaryInRAMRow(6, 99, OV_COLORS.purple);
          _highlightRAMRow(6);
          _cuFiresSignals(['SPO', 'RO', 'AI']);
          _setBusActive('addr', true);
          _busWrite('RAM', 'w-ram-db', 99, OV_COLORS.amber);
          _after(800, () => { _busWaitingAtDoors(99, 'REGA'); });
          _after(1400, () => { _removeWaitingData(); _clockPulse(false); _receiveComp('REGA', OV_COLORS.purple); _showCompVal('REGA', '99'); });
          _setLabel('T3: SPO+RO+AI → RAM[SP] → bus → A captures. A=99.', OV_COLORS.green);
        }},
        { text: `Done. A now holds 99 — the value we pushed last. The stack still has 42 below it. SP is back where it was before that push.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('REGA'); _glowComp('RAM');
          _showCompVal('REGA', '99');
          _showBinaryInRAMRow(7, 42, OV_COLORS.purple);
          _showBinaryInRAMRow(6, 99, OV_COLORS.purple);
          _highlightRAMRow(6);
          _setLabel('A=99. 42 still below. LIFO — last in, first out.', OV_COLORS.green);
        }},
      ]},
      // Page 1 — pop again
      { sentences: [
        { text: `Pop again. SP moves up. The next value comes off — 42, the one we pushed first.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('REGA'); _glowComp('RAM'); _glowComp('CLK');
          _showCompVal('CU', 'T2');
          _showBinaryInRAMRow(7, 42, OV_COLORS.purple);
          _showBinaryInRAMRow(6, 99, OV_COLORS.purple);
          _cuFiresSignals(['SPUP']);
          _highlightRAMRow(7);
          _after(800, () => { _showCompVal('CU', 'T3'); _cuFiresSignals(['SPO', 'RO', 'AI']); _busWrite('RAM', 'w-ram-db', 42, OV_COLORS.amber); });
          _after(1500, () => { _busWaitingAtDoors(42, 'REGA'); });
          _after(2100, () => { _removeWaitingData(); _clockPulse(false); _receiveComp('REGA', OV_COLORS.purple); _showCompVal('REGA', '42'); });
          _setLabel('SP up → row 7 → RAM releases 42 → A captures. A=42.', OV_COLORS.green);
        }},
        { text: `LIFO. The first value pushed — 42 — is the last one to come back. The order matters.`, dur: 4500, anim: () => {
          _dimAll(); _glowComp('REGA'); _glowComp('RAM');
          _showCompVal('REGA', '42');
          _showBinaryInRAMRow(7, 42, OV_COLORS.purple);
          _highlightRAMRow(7);
          _setLabel('Pushed [42, 99]. Popped [99, 42]. Reverse order.', OV_COLORS.teal);
        }},
      ]},
    ],
    highlightComponents: [],
    showAll: true,
  },

  // ─────────────────────────────────────────
  // SCENE 5 — CALL: how functions work
  // ─────────────────────────────────────────
  {
    id: 5,
    title: 'CALL — Functions',
    pages: [
      // Page 0 — the problem
      { sentences: [
        { text: `Now the real reason the stack exists. Imagine you write a piece of code that doubles a number. You want to use it from many places in your program.`, dur: 6000, anim: () => {
          _dimAll(); _glowComp('RAM');
          _setLabel('A function — a reusable piece of code we can call from anywhere.', OV_COLORS.teal);
        }},
        { text: `But there is a problem. When the function finishes, how does it know where to come back to? You called it from address 5, or 17, or 42 — it depends.`, dur: 6500, anim: () => {
          _dimAll(); _glowComp('PC'); _glowComp('RAM');
          _setLabel('The function needs to remember where it was called from.', OV_COLORS.red);
        }},
        { text: `That is where CALL comes in. CALL does two things: it pushes the current PC onto the stack, then jumps to the function. The current PC is the return address.`, dur: 6500, anim: () => {
          _dimAll(); _glowComp('PC'); _glowComp('RAM'); _glowComp('CU');
          _setLabel('CALL = PUSH PC, then JUMP to function.', OV_COLORS.purple);
        }},
      ]},
      // Page 1 — CALL in action
      { sentences: [
        { text: `Say PC is at 5 and we want to call a function at address 100. The CALL instruction first pushes 5 onto the stack — that is our return address.`, dur: 6500, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('PC'); _glowComp('RAM'); _glowComp('CLK');
          _showCompVal('PC', '5');
          _showCompVal('CU', 'T2');
          _cuFiresSignals(['SPO', 'CO', 'RI']);
          _setBusActive('addr', true); _setBusActive('data', true);
          _spawnPacket('w-pc-mar', OV_COLORS.teal, false, 0);
          _after(800, () => { _clockPulse(false); _receiveComp('RAM', OV_COLORS.amber); _showBinaryInRAMRow(7, 5, OV_COLORS.purple); _highlightRAMRow(7); });
          _after(1500, () => { _cuFiresSignals(['SPD']); _highlightRAMRow(6); });
          _setLabel('CALL step 1: PUSH PC (5) onto stack. Return address saved.', OV_COLORS.purple);
        }},
        { text: `Then CALL jumps to address 100. PC becomes 100. The function starts running.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('PC'); _glowComp('IR'); _glowComp('RAM');
          _cuFiresSignals(['IO', 'J']);
          _setBusActive('addr', true);
          _showCompVal('IR', 'CALL 100');
          _spawnPacket('w-ir-db', OV_COLORS.orange, false, 0);
          _after(500, () => _spawnPacket('w-pc-mar', OV_COLORS.orange, false, 0, true));
          _after(900, () => { _clockPulse(false); _showCompVal('PC', '100'); _flashCells('PC', OV_COLORS.orange); });
          _showBinaryInRAMRow(7, 5, OV_COLORS.purple);
          _highlightRAMRow(6);
          _setLabel('CALL step 2: PC ← 100. Function starts.', OV_COLORS.orange);
        }},
        { text: `The function runs. It does its work — maybe doubles a number, maybe prints something. PC counts through its instructions.`, dur: 5000, anim: () => {
          _dimAll(); _glowComp('PC'); _glowComp('CU'); _glowComp('RAM');
          _showCompVal('PC', '100');
          _showBinaryInRAMRow(7, 5, OV_COLORS.purple);
          _highlightRAMRow(6);
          _after(700, () => { _showCompVal('PC', '101'); _flashCells('PC', OV_COLORS.teal); });
          _after(1400, () => { _showCompVal('PC', '102'); _flashCells('PC', OV_COLORS.teal); });
          _after(2100, () => { _showCompVal('PC', '103'); _flashCells('PC', OV_COLORS.teal); });
          _setLabel('Function executing: 100, 101, 102, 103...', OV_COLORS.teal);
        }},
      ]},
    ],
    highlightComponents: [],
    showAll: true,
  },

  // ─────────────────────────────────────────
  // SCENE 6 — RET: returning
  // ─────────────────────────────────────────
  {
    id: 6,
    title: 'RET — Returning',
    pages: [
      // Page 0
      { sentences: [
        { text: `When the function is done, it ends with RET — the return instruction. RET pops the saved return address back into PC.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('PC'); _glowComp('RAM');
          _showCompVal('PC', '105'); _showCompVal('IR', 'RET');
          _showBinaryInRAMRow(7, 5, OV_COLORS.purple);
          _highlightRAMRow(6);
          _setLabel('RET: pop the return address back into PC.', OV_COLORS.purple);
        }},
        { text: `SP moves up. It now points at the saved return address — 5. Then RAM releases that address. PC captures it.`, dur: 6500, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('PC'); _glowComp('RAM'); _glowComp('CLK');
          _showCompVal('CU', 'T2');
          _cuFiresSignals(['SPUP']);
          _highlightRAMRow(7);
          _showBinaryInRAMRow(7, 5, OV_COLORS.purple);
          _after(800, () => { _showCompVal('CU', 'T3'); _cuFiresSignals(['SPO', 'RO', 'J']); _busWrite('RAM', 'w-ram-db', 5, OV_COLORS.amber); });
          _after(1500, () => { _spawnPacket('w-pc-mar', OV_COLORS.orange, false, 0, true); });
          _after(2000, () => { _clockPulse(false); _showCompVal('PC', '5'); _flashCells('PC', OV_COLORS.orange); });
          _setLabel('SP up → row 7 → RAM[7]=5 → bus → PC captures. PC=5.', OV_COLORS.orange);
        }},
        { text: `PC is now 5. The CPU continues from exactly where it was before the call. The function returned. Beautiful.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('PC'); _glowComp('RAM');
          _showCompVal('PC', '5');
          _highlightRAMRow(7);
          _setLabel('PC=5. Back where we were. Function returned.', OV_COLORS.green);
        }},
      ]},
    ],
    highlightComponents: [],
    showAll: true,
  },

  // ─────────────────────────────────────────
  // SCENE 7 — Nested calls
  // ─────────────────────────────────────────
  {
    id: 7,
    title: 'Nested Calls',
    pages: [
      // Page 0
      { sentences: [
        { text: `What if a function calls another function? That is called nesting. The stack handles it naturally.`, dur: 5000, anim: () => {
          _dimAll(); _glowComp('RAM');
          _setLabel('Function A calls Function B. Two return addresses to remember.', OV_COLORS.teal);
        }},
        { text: `Function A is at address 50. Main code at PC=10 calls A. PC=10 gets pushed. PC jumps to 50.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('PC'); _glowComp('RAM');
          _showCompVal('PC', '10');
          _cuFiresSignals(['SPO', 'CO', 'RI']);
          _after(800, () => { _showBinaryInRAMRow(7, 10, OV_COLORS.purple); _cuFiresSignals(['SPD']); _highlightRAMRow(6); });
          _after(1500, () => { _cuFiresSignals(['IO', 'J']); _showCompVal('PC', '50'); });
          _setLabel('CALL A: push 10, jump to 50. Stack: [10].', OV_COLORS.purple);
        }},
        { text: `Inside Function A, at PC=55, it calls Function B. PC=55 gets pushed too. Now the stack has both return addresses.`, dur: 6000, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('PC'); _glowComp('RAM');
          _showCompVal('PC', '55');
          _showBinaryInRAMRow(7, 10, OV_COLORS.purple);
          _highlightRAMRow(6);
          _cuFiresSignals(['SPO', 'CO', 'RI']);
          _after(800, () => { _showBinaryInRAMRow(6, 55, OV_COLORS.purple); _cuFiresSignals(['SPD']); _highlightRAMRow(5); });
          _after(1500, () => { _cuFiresSignals(['IO', 'J']); _showCompVal('PC', '80'); });
          _setLabel('CALL B from inside A: push 55, jump to 80. Stack: [10, 55].', OV_COLORS.purple);
        }},
        { text: `Function B finishes and runs RET. It pops 55 — the most recent return address. PC becomes 55. We are back inside Function A.`, dur: 6000, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('PC'); _glowComp('RAM'); _glowComp('CLK');
          _showCompVal('PC', '85'); _showCompVal('IR', 'RET');
          _showBinaryInRAMRow(7, 10, OV_COLORS.purple);
          _showBinaryInRAMRow(6, 55, OV_COLORS.purple);
          _cuFiresSignals(['SPUP']);
          _highlightRAMRow(6);
          _after(800, () => { _cuFiresSignals(['SPO', 'RO', 'J']); _busWrite('RAM', 'w-ram-db', 55, OV_COLORS.amber); });
          _after(1500, () => { _clockPulse(false); _showCompVal('PC', '55'); _flashCells('PC', OV_COLORS.orange); });
          _setLabel('B returns: pop 55 → PC=55. Back in Function A. Stack: [10].', OV_COLORS.green);
        }},
        { text: `Function A finishes too. RET pops 10 — the original return address. PC becomes 10. Back in main code.`, dur: 5500, anim: () => {
          _dimAll(); _glowComp('CU'); _glowComp('PC'); _glowComp('RAM'); _glowComp('CLK');
          _showCompVal('PC', '60'); _showCompVal('IR', 'RET');
          _showBinaryInRAMRow(7, 10, OV_COLORS.purple);
          _cuFiresSignals(['SPUP']);
          _highlightRAMRow(7);
          _after(800, () => { _cuFiresSignals(['SPO', 'RO', 'J']); _busWrite('RAM', 'w-ram-db', 10, OV_COLORS.amber); });
          _after(1500, () => { _clockPulse(false); _showCompVal('PC', '10'); _flashCells('PC', OV_COLORS.orange); });
          _setLabel('A returns: pop 10 → PC=10. Back in main. Stack: [].', OV_COLORS.green);
        }},
        { text: `Last in, first out. The most recent call returned first. The stack remembers everything in the right order.`, dur: 5000, anim: () => {
          _dimAll(); _glowComp('PC'); _glowComp('RAM');
          _showCompVal('PC', '10');
          _setLabel('LIFO. Calls nest, returns unwind. Stack handles it perfectly.', OV_COLORS.teal);
        }},
      ]},
    ],
    highlightComponents: [],
    showAll: true,
  },

  // ─────────────────────────────────────────
  // SCENE 8 — Why this matters
  // ─────────────────────────────────────────
  {
    id: 8,
    title: 'Why This Matters',
    pages: [
      { sentences: [
        { text: `Every program you have ever used relies on this. Every function call. Every method. Every recursive algorithm. All built on PUSH, POP, CALL, and RET.`, dur: 6000, anim: () => {
          _dimAll(); Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          _setLabel('PUSH, POP, CALL, RET — the foundation of all software.', OV_COLORS.teal);
        }},
        { text: `When a webpage loads, hundreds of function calls happen. Each one pushes a return address. Each one pops it back. The stack keeps track of where every call came from.`, dur: 6500, anim: () => {
          _dimAll(); _glowComp('RAM'); _glowComp('PC');
          _setLabel('Every click. Every keystroke. Hundreds of pushes and pops.', OV_COLORS.amber);
        }},
        { text: `And it is all built from the same five things we already understood: registers, the ALU, the CU, the clock, and RAM. The only new piece was SP — one more register that points at the top of the stack.`, dur: 7000, anim: () => {
          _dimAll(); Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          _setLabel('Same hardware. One more pointer. Functions for free.', OV_COLORS.green);
        }},
        { text: `That is the stack. Push, pop, call, return. See you in Video 3 — interrupts.`, dur: 5000, anim: () => {
          _dimAll(); Object.keys(CPU_COMPS).forEach(k => _glowComp(k));
          _setLabel('End of Video 2. Next: interrupts.', OV_COLORS.green);
        }},
      ]},
    ],
    highlightComponents: [],
    showAll: true,
    isFinal: true,
  },
];

// Expose to global so the tutorial engine can switch between V1 and V2 scenes.
if (typeof window !== 'undefined') {
  window.V2_SCENES = V2_SCENES;
}
