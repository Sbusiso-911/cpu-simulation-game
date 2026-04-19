/**
 * Breadboard Datasheet System
 * Provides detailed reference datasheets for every breadboard component.
 * Depends on: nothing (self-contained UI that populates #ds-list and #ds-detail)
 */

(function () {
  'use strict';

  // ════════════════════════════════════════════════════════════════════
  //  DATASHEET DATABASE
  // ════════════════════════════════════════════════════════════════════

  const DS = {};

  // Helper to define truth table rows with styled 0/1/X values
  function tv(v) {
    if (v === 0 || v === '0') return '<span class="ds-truth-val-0">0</span>';
    if (v === 1 || v === '1') return '<span class="ds-truth-val-1">1</span>';
    return '<span class="ds-truth-val-x">' + v + '</span>';
  }
  function ttRow(cells) { return '<tr>' + cells.map(c => '<td>' + tv(c) + '</td>').join('') + '</tr>'; }
  function ttHead(cells) { return '<tr>' + cells.map(c => '<th>' + c + '</th>').join('') + '</tr>'; }

  // ─── POWER ──────────────────────────────────────────────────────

  DS['VCC'] = {
    name: 'VCC (+5V)', category: 'power', badge: 'Power Supply',
    summary: 'Constant logic HIGH (1) power source. Provides +5V to the circuit.',
    what: 'VCC is the positive supply rail. In TTL logic, VCC is +5V and represents logic HIGH. Every digital circuit needs a stable power source, and VCC is it.',
    analogy: 'Think of VCC like the positive terminal of a battery. It is the source of energy that all your logic chips drink from.',
    pins: [
      { name: 'V+', dir: 'out', desc: 'Constant HIGH (1) output' }
    ],
    truth: null,
    how: [
      'Outputs a constant value of <strong>1</strong> at all times.',
      'Connect to chip power pins, pull-up resistors, or inputs that must be held HIGH.',
      'In this simulator, VCC represents ideal +5V with no current limit.'
    ],
    example: 'Connect VCC to the Enable pin of a register to keep it always enabled.',
    realworld: 'On a real breadboard, VCC comes from a bench power supply or voltage regulator (like a 7805). The red rail on a breadboard is conventionally VCC.'
  };

  DS['GND'] = {
    name: 'GND (Ground)', category: 'power', badge: 'Power Supply',
    summary: 'Logic LOW (0) reference. 0V ground plane.',
    what: 'GND is the ground reference, representing 0V or logic LOW. It completes the circuit and provides the return path for current.',
    analogy: 'GND is like the river into which all water flows. Without it, electricity has nowhere to go and the circuit is incomplete.',
    pins: [
      { name: 'GND', dir: 'out', desc: 'Constant LOW (0) output' }
    ],
    truth: null,
    how: [
      'Outputs a constant value of <strong>0</strong> at all times.',
      'Connect to chip ground pins, pull-down resistors, or inputs that must be held LOW.',
      'Every circuit must have a GND connection. Floating inputs cause unpredictable behavior.'
    ],
    example: 'Connect GND to the RESET pin of a counter to keep it out of reset (active-LOW reset).',
    realworld: 'On a breadboard, the blue (or black) rail is ground. On PCBs, GND is often a large copper pour for minimal resistance.'
  };

  DS['Battery'] = {
    name: 'Battery', category: 'power', badge: 'Power Supply',
    summary: 'Configurable voltage source with positive and negative terminals.',
    what: 'A battery provides a voltage difference between its two terminals. In this simulator, it outputs a configurable analog voltage value and a digital logic level.',
    analogy: 'A battery is the heart of a circuit, pumping electrical "pressure" (voltage) just like a heart pumps blood. The bigger the battery, the more pressure.',
    pins: [
      { name: 'V+', dir: 'out', desc: 'Positive terminal output' },
      { name: 'V-', dir: 'out', desc: 'Negative terminal (reference)' }
    ],
    truth: null,
    how: [
      'Provides a constant voltage difference between V+ and V-.',
      'The default voltage is 5V (logic HIGH = 1).',
      'Can be reconfigured for different voltage levels in the inspector.'
    ],
    example: 'Use a battery to power a standalone subcircuit that needs its own supply.',
    realworld: 'Common batteries: 1.5V AA, 3.7V Li-Po, 9V alkaline. Voltage regulators step these down to the 5V or 3.3V that logic chips need.'
  };

  // ─── PASSIVE ────────────────────────────────────────────────────

  DS['Resistor'] = {
    name: 'Resistor', category: 'passive', badge: 'Passive',
    summary: 'Limits current flow. In this digital sim, acts as a pass-through with optional signal attenuation.',
    what: 'A resistor opposes the flow of electric current. Its value is measured in Ohms. In digital circuits, resistors are used for pull-ups, pull-downs, current limiting (e.g., for LEDs), and voltage dividers.',
    analogy: 'A resistor is like a narrow pipe in a water system. Water (current) can still flow, but the narrower the pipe (higher resistance), the less water gets through.',
    pins: [
      { name: 'A', dir: 'in', desc: 'Input terminal' },
      { name: 'B', dir: 'out', desc: 'Output terminal (passes signal through)' }
    ],
    truth: { heads: ['A', 'B'], rows: [[0,0],[1,1]] },
    how: [
      'In this simulator, the resistor <strong>passes the digital signal through</strong> unchanged (1 in = 1 out).',
      'In real circuits, V = I x R (Ohm\'s law) determines the voltage drop.',
      '<strong>Pull-up resistor:</strong> Connect between VCC and a signal line to default it HIGH.',
      '<strong>Pull-down resistor:</strong> Connect between GND and a signal line to default it LOW.',
      '<strong>Current-limiting:</strong> Place before an LED to prevent burnout (typically 220-330 ohms for 5V TTL).'
    ],
    example: 'Place a resistor between VCC and the input of a gate to create a pull-up, preventing the input from floating.',
    realworld: 'Resistor color bands encode the value: Brown-Black-Red = 1,000 ohms (1k). The 10k pull-up resistor is the most common component in digital design.'
  };

  DS['Capacitor'] = {
    name: 'Capacitor', category: 'passive', badge: 'Passive',
    summary: 'Stores charge. In this sim, introduces a 1-clock-cycle delay on signal changes.',
    what: 'A capacitor stores electrical energy in an electric field. It blocks DC but passes AC. In digital circuits, capacitors are essential for power supply decoupling (filtering noise), timing circuits, and debouncing switches.',
    analogy: 'A capacitor is like a small water tank. It fills up when pressure (voltage) is applied and slowly releases when the pressure is removed. This smoothing effect filters out spikes.',
    pins: [
      { name: 'A', dir: 'in', desc: 'Input terminal' },
      { name: 'B', dir: 'out', desc: 'Output (delayed by 1 cycle)' }
    ],
    truth: null,
    how: [
      'In this simulator, the capacitor <strong>delays the signal by one clock cycle</strong>.',
      'When A changes from 0 to 1, B becomes 1 on the next clock pulse.',
      'This models the charge/discharge time constant (tau = R * C).',
      '<strong>Decoupling:</strong> Place a 0.1uF cap between VCC and GND near each IC to filter power supply noise.',
      '<strong>Timing:</strong> Combined with a resistor, forms an RC time constant used in 555 timer circuits.'
    ],
    example: 'Place a capacitor on a noisy input line to smooth out glitches (1-cycle debounce).',
    realworld: 'Every IC datasheet recommends 0.1uF ceramic bypass caps on each VCC pin. Without them, high-speed switching creates power supply noise that causes errors.'
  };

  DS['Inductor'] = {
    name: 'Inductor', category: 'passive', badge: 'Passive',
    summary: 'Opposes changes in current. In this sim, holds the previous value for 1 cycle during transitions.',
    what: 'An inductor stores energy in a magnetic field when current flows through it. It resists changes in current, which means it tries to keep current flowing at the same level. This "inertia" property is the magnetic analog of a capacitor.',
    analogy: 'An inductor is like a heavy flywheel. Once spinning (current flowing), it resists stopping. When you try to start it, it resists moving. This momentum smooths out current changes.',
    pins: [
      { name: 'A', dir: 'in', desc: 'Input terminal' },
      { name: 'B', dir: 'out', desc: 'Output (holds previous value briefly)' }
    ],
    truth: null,
    how: [
      'In this simulator, the inductor <strong>holds its previous output value for one cycle</strong> when the input changes.',
      'This models the inductor\'s opposition to rapid current changes (V = L * di/dt).',
      'Inductors are less common in pure digital logic but essential in power supplies (buck/boost converters) and RF circuits.',
      'Combined with capacitors, inductors form LC filters and oscillators.'
    ],
    example: 'Use an inductor to model signal delay or inertia in a power supply filter.',
    realworld: 'Switch-mode power supplies (like the one in your computer) use inductors to efficiently convert voltages. The coil stores energy during one phase and releases it during another.'
  };

  // ─── LOGIC GATES ────────────────────────────────────────────────

  DS['AND'] = {
    name: 'AND Gate', category: 'gate', badge: 'Logic Gate',
    summary: 'Output is HIGH only when ALL inputs are HIGH.',
    what: 'The AND gate is a fundamental building block of digital logic. It implements logical conjunction: the output is 1 only when both (or all) inputs are 1. If any input is 0, the output is 0.',
    analogy: 'An AND gate is like two switches in series. Both switches must be ON for current to flow through. If either switch is off, the light stays off.',
    pins: [
      { name: 'A', dir: 'in', desc: 'First input' },
      { name: 'B', dir: 'in', desc: 'Second input' },
      { name: 'Y', dir: 'out', desc: 'Output: A AND B' }
    ],
    truth: { heads: ['A','B','Y'], rows: [[0,0,0],[0,1,0],[1,0,0],[1,1,1]] },
    how: [
      'Output Y = A AND B. Boolean expression: Y = A * B or Y = A & B.',
      'Can be extended to more inputs: a 3-input AND requires ALL three inputs HIGH.',
      'In CMOS, built from 2 NMOS in series (pull-down) and 2 PMOS in parallel (pull-up), followed by an inverter.',
      'The AND gate is equivalent to a NAND followed by a NOT.'
    ],
    example: 'Use AND to enable a signal only when two conditions are met: e.g., WRITE = DataReady AND ChipSelect.',
    realworld: 'The 74LS08 IC contains four 2-input AND gates. AND gates are used in address decoding, enable logic, and masking bits.'
  };

  DS['OR'] = {
    name: 'OR Gate', category: 'gate', badge: 'Logic Gate',
    summary: 'Output is HIGH when ANY input is HIGH.',
    what: 'The OR gate implements logical disjunction. The output is 1 when at least one input is 1. The output is 0 only when all inputs are 0.',
    analogy: 'An OR gate is like two switches in parallel. If either switch is ON, current flows and the light turns on. Both must be off to keep it dark.',
    pins: [
      { name: 'A', dir: 'in', desc: 'First input' },
      { name: 'B', dir: 'in', desc: 'Second input' },
      { name: 'Y', dir: 'out', desc: 'Output: A OR B' }
    ],
    truth: { heads: ['A','B','Y'], rows: [[0,0,0],[0,1,1],[1,0,1],[1,1,1]] },
    how: [
      'Output Y = A OR B. Boolean expression: Y = A + B or Y = A | B.',
      'In CMOS, built from 2 PMOS in series (pull-up) and 2 NMOS in parallel (pull-down), followed by an inverter.',
      'The OR gate is equivalent to a NOR followed by a NOT.',
      'Used to combine multiple interrupt sources, error flags, or request signals.'
    ],
    example: 'Use OR to trigger an interrupt when ANY of several error flags are set: INT = ErrorA OR ErrorB OR ErrorC.',
    realworld: 'The 74LS32 IC contains four 2-input OR gates. OR gates are fundamental to priority logic and flag aggregation.'
  };

  DS['NOT'] = {
    name: 'NOT Gate (Inverter)', category: 'gate', badge: 'Logic Gate',
    summary: 'Output is the complement of the input. Flips 0 to 1 and 1 to 0.',
    what: 'The NOT gate (also called an inverter) flips the logic level. If the input is HIGH, the output is LOW, and vice versa. It implements logical negation.',
    analogy: 'A NOT gate is like a light switch that works backwards: when you push it UP, the light goes OFF. Push it DOWN, light goes ON.',
    pins: [
      { name: 'A', dir: 'in', desc: 'Input' },
      { name: 'Y', dir: 'out', desc: 'Output: NOT A' }
    ],
    truth: { heads: ['A','Y'], rows: [[0,1],[1,0]] },
    how: [
      'Output Y = NOT A. Boolean expression: Y = A\' or Y = ~A.',
      'In CMOS, the simplest possible gate: one PMOS and one NMOS transistor.',
      'The inverter is the building block for all other CMOS gates (NAND, NOR, etc.).',
      'Two inverters in series = a buffer (restores signal strength).'
    ],
    example: 'Use NOT to create active-LOW enable signals: if your chip needs /CE (active-LOW chip enable), connect NOT to the active-HIGH signal.',
    realworld: 'The 74LS04 IC contains six independent inverters. Inverters are used for signal inversion, clock inversion, and creating complementary signals.'
  };

  DS['NAND'] = {
    name: 'NAND Gate', category: 'gate', badge: 'Logic Gate',
    summary: 'Output is LOW only when ALL inputs are HIGH. Universal gate.',
    what: 'The NAND gate is an AND followed by NOT. It outputs LOW only when all inputs are HIGH. NAND is called a "universal gate" because you can build ANY other logic function using only NAND gates.',
    analogy: 'A NAND gate is like a safety interlock: the alarm (output HIGH) is always on UNLESS all conditions are met (all inputs HIGH), in which case the alarm turns off.',
    pins: [
      { name: 'A', dir: 'in', desc: 'First input' },
      { name: 'B', dir: 'in', desc: 'Second input' },
      { name: 'Y', dir: 'out', desc: 'Output: NOT(A AND B)' }
    ],
    truth: { heads: ['A','B','Y'], rows: [[0,0,1],[0,1,1],[1,0,1],[1,1,0]] },
    how: [
      'Output Y = NOT(A AND B). Boolean: Y = (A*B)\'.',
      '<strong>Universal gate:</strong> NOT = NAND with tied inputs. AND = NAND + NAND(tied). OR = NAND each input + NAND results.',
      'In CMOS, requires only 4 transistors (2 PMOS parallel, 2 NMOS series) -- simpler than AND!',
      'This is why NAND is the most commonly manufactured gate in integrated circuits.'
    ],
    example: 'Build an SR latch from two cross-coupled NAND gates. Connect Q output of each NAND to one input of the other.',
    realworld: 'The 74LS00 IC contains four 2-input NAND gates. Ben Eater\'s CPU uses 74LS00 extensively for control logic. NAND flash memory is named after this gate.'
  };

  DS['NOR'] = {
    name: 'NOR Gate', category: 'gate', badge: 'Logic Gate',
    summary: 'Output is HIGH only when ALL inputs are LOW. Universal gate.',
    what: 'The NOR gate is an OR followed by NOT. It outputs HIGH only when all inputs are LOW. Like NAND, NOR is also a universal gate -- you can build any logic function using only NOR gates.',
    analogy: 'A NOR gate is like a "quiet room" sensor: the green light (output) is on only when nobody is making noise (all inputs LOW). Any noise turns it off.',
    pins: [
      { name: 'A', dir: 'in', desc: 'First input' },
      { name: 'B', dir: 'in', desc: 'Second input' },
      { name: 'Y', dir: 'out', desc: 'Output: NOT(A OR B)' }
    ],
    truth: { heads: ['A','B','Y'], rows: [[0,0,1],[0,1,0],[1,0,0],[1,1,0]] },
    how: [
      'Output Y = NOT(A OR B). Boolean: Y = (A+B)\'.',
      '<strong>Universal gate:</strong> Like NAND, NOR can implement any Boolean function.',
      'In CMOS, 4 transistors: 2 PMOS in series, 2 NMOS in parallel.',
      'The Apollo Guidance Computer was built entirely from 3-input NOR gates (about 5,600 of them)!'
    ],
    example: 'Use NOR as a zero detector: if all bits are 0, the NOR output is 1, indicating the value is zero.',
    realworld: 'The 74LS02 IC contains four 2-input NOR gates. NOR flash memory (used in BIOS chips) is named after this gate.'
  };

  DS['XOR'] = {
    name: 'XOR Gate', category: 'gate', badge: 'Logic Gate',
    summary: 'Output is HIGH when inputs are DIFFERENT.',
    what: 'The XOR (exclusive OR) gate outputs HIGH when its inputs differ. If both inputs are the same (both 0 or both 1), the output is LOW. XOR is the heart of binary addition.',
    analogy: 'XOR is like a "toggle switch" with two controllers. If both people agree (both up or both down), the light is off. If they disagree, the light is on.',
    pins: [
      { name: 'A', dir: 'in', desc: 'First input' },
      { name: 'B', dir: 'in', desc: 'Second input' },
      { name: 'Y', dir: 'out', desc: 'Output: A XOR B' }
    ],
    truth: { heads: ['A','B','Y'], rows: [[0,0,0],[0,1,1],[1,0,1],[1,1,0]] },
    how: [
      'Output Y = A XOR B. Boolean: Y = A xor B = A\'B + AB\'.',
      'XOR is the <strong>sum bit</strong> in binary addition: 0+0=0, 0+1=1, 1+0=1, 1+1=0 (with carry).',
      'XOR with a constant 1 inverts the input (acts like NOT). XOR with 0 passes through (acts like buffer).',
      '<strong>Parity:</strong> XOR all bits together to get the parity bit (even/odd count of 1s).'
    ],
    example: 'Build a half adder: Sum = A XOR B, Carry = A AND B. This is the simplest addition circuit.',
    realworld: 'The 74LS86 IC contains four 2-input XOR gates. XOR is used in parity generators, checksums, CRC calculations, comparators, and the ALU\'s add/subtract logic.'
  };

  DS['XNOR'] = {
    name: 'XNOR Gate', category: 'gate', badge: 'Logic Gate',
    summary: 'Output is HIGH when inputs are the SAME (equivalence gate).',
    what: 'The XNOR gate is the complement of XOR. It outputs HIGH when both inputs are the same. Also known as the equivalence gate because it detects when two signals are equal.',
    analogy: 'XNOR is like a "matching detector." Two friends wearing matching outfits? Light on. Different outfits? Light off.',
    pins: [
      { name: 'A', dir: 'in', desc: 'First input' },
      { name: 'B', dir: 'in', desc: 'Second input' },
      { name: 'Y', dir: 'out', desc: 'Output: A XNOR B' }
    ],
    truth: { heads: ['A','B','Y'], rows: [[0,0,1],[0,1,0],[1,0,0],[1,1,1]] },
    how: [
      'Output Y = NOT(A XOR B). Boolean: Y = AB + A\'B\' (equivalence).',
      'XNOR is a 1-bit <strong>comparator</strong>: output is 1 when A equals B.',
      'Chain multiple XNOR gates + AND to build a multi-bit equality comparator.',
      'XNOR of a bit with itself is always 1; XNOR with the complement is always 0.'
    ],
    example: 'Compare two 4-bit numbers: XNOR each bit pair, then AND all four results. Output = 1 means the numbers are equal.',
    realworld: 'Used in magnitude comparators (74LS85), error detection circuits, and digital lock circuits.'
  };

  DS['Buffer'] = {
    name: 'Tri-State Buffer', category: 'gate', badge: 'Logic Gate',
    summary: 'Passes or blocks a signal based on an enable pin. Essential for bus architectures.',
    what: 'A tri-state buffer has three output states: HIGH, LOW, and high-impedance (Hi-Z, disconnected). When enabled, it passes the input to the output. When disabled, the output is effectively disconnected from the wire, allowing multiple devices to share a bus.',
    analogy: 'A tri-state buffer is like a drawbridge. When the bridge is down (enabled), traffic flows across. When the bridge is up (disabled), the road is completely disconnected -- not blocked, but gone.',
    pins: [
      { name: 'A', dir: 'in', desc: 'Data input' },
      { name: 'EN', dir: 'in', desc: 'Enable (1 = pass through, 0 = Hi-Z)' },
      { name: 'Y', dir: 'out', desc: 'Output (A when enabled, 0/Hi-Z when disabled)' }
    ],
    truth: { heads: ['EN','A','Y'], rows: [[0,'X','Hi-Z'],[1,0,0],[1,1,1]] },
    how: [
      'When EN=1: Y = A (buffer passes the signal through).',
      'When EN=0: Y = Hi-Z (output is disconnected, as if the wire doesn\'t exist).',
      '<strong>Critical for buses:</strong> Multiple devices connect to the same data bus, but only ONE enables its buffer at a time.',
      'If two buffers drive the bus simultaneously, you get <strong>bus contention</strong> (short circuit in real hardware).'
    ],
    example: 'In the SAP-1 CPU, each register uses a tri-state buffer to put its value onto the data bus. Only the register whose output-enable signal is active drives the bus.',
    realworld: 'The 74LS245 is an octal tri-state bus transceiver. Ben Eater uses it to connect registers to the shared data bus. Without tri-state buffers, buses would be impossible.'
  };

  // ─── COMBINATIONAL LOGIC ────────────────────────────────────────

  DS['HalfAdder'] = {
    name: 'Half Adder', category: 'comb', badge: 'Combinational',
    summary: 'Adds two 1-bit inputs. Produces Sum and Carry outputs.',
    what: 'A half adder adds two single-bit numbers together, producing a sum bit and a carry bit. It\'s called "half" because it cannot handle a carry input from a previous stage.',
    analogy: 'A half adder is like a cashier who can add two coins but can\'t handle change from a previous transaction. For a full transaction, you need a "full adder."',
    pins: [
      { name: 'A', dir: 'in', desc: 'First 1-bit input' },
      { name: 'B', dir: 'in', desc: 'Second 1-bit input' },
      { name: 'S', dir: 'out', desc: 'Sum = A XOR B' },
      { name: 'C', dir: 'out', desc: 'Carry = A AND B' }
    ],
    truth: { heads: ['A','B','S','C'], rows: [[0,0,0,0],[0,1,1,0],[1,0,1,0],[1,1,0,1]] },
    how: [
      'Sum (S) = A XOR B. This is the binary sum without carry.',
      'Carry (C) = A AND B. This indicates overflow into the next bit position.',
      'Internally: just one XOR gate and one AND gate.',
      'To add multi-bit numbers, chain full adders (which have a carry input).'
    ],
    example: 'Connect two switches to A and B. The Sum output shows the 1s digit and Carry shows the 2s digit of binary addition.',
    realworld: 'Half adders are a teaching tool. Real ALUs use full adders chained together (ripple carry) or faster architectures (carry lookahead).'
  };

  DS['FullAdder'] = {
    name: 'Full Adder', category: 'comb', badge: 'Combinational',
    summary: 'Adds two 1-bit inputs plus a carry-in. The building block of multi-bit adders.',
    what: 'A full adder adds three bits: two data bits (A, B) and a carry-in (Cin) from the previous stage. It produces a sum bit and a carry-out. By chaining full adders, you can add numbers of any width.',
    analogy: 'A full adder is like a cashier who can add two coins AND handle change from the previous customer. Chain four cashiers together and you can add any numbers 0-15.',
    pins: [
      { name: 'A', dir: 'in', desc: 'First 1-bit input' },
      { name: 'B', dir: 'in', desc: 'Second 1-bit input' },
      { name: 'Cin', dir: 'in', desc: 'Carry input from previous stage' },
      { name: 'S', dir: 'out', desc: 'Sum output' },
      { name: 'Cout', dir: 'out', desc: 'Carry output to next stage' }
    ],
    truth: { heads: ['A','B','Cin','S','Cout'], rows: [
      [0,0,0,0,0],[0,0,1,1,0],[0,1,0,1,0],[0,1,1,0,1],
      [1,0,0,1,0],[1,0,1,0,1],[1,1,0,0,1],[1,1,1,1,1]
    ]},
    how: [
      'Sum = A XOR B XOR Cin.',
      'Cout = (A AND B) OR (Cin AND (A XOR B)).',
      'Internally: two half adders + one OR gate.',
      '<strong>Ripple carry adder:</strong> Chain N full adders, connecting each Cout to the next Cin, to add N-bit numbers.'
    ],
    example: 'Build a 4-bit adder by chaining 4 full adders. Connect Cout of bit 0 to Cin of bit 1, and so on.',
    realworld: 'The 74LS283 is a 4-bit full adder IC. The ALU in this SAP-1 CPU uses full adders internally for ADD and SUB instructions.'
  };

  DS['Adder4'] = {
    name: '4-Bit Adder', category: 'comb', badge: 'Combinational',
    summary: 'Adds two 4-bit numbers with carry. Equivalent to 74LS283.',
    what: 'A 4-bit adder takes two 4-bit binary numbers (A3..A0 and B3..B0) plus a carry-in, and produces a 4-bit sum (S3..S0) plus a carry-out. It\'s four full adders chained internally.',
    analogy: 'A 4-bit adder is a complete addition department: four cashiers sitting in a row, each passing their overflow to the next person. Together, they can add any two numbers from 0 to 15.',
    pins: [
      { name: 'A0-A3', dir: 'in', desc: '4-bit input A' },
      { name: 'B0-B3', dir: 'in', desc: '4-bit input B' },
      { name: 'Cin', dir: 'in', desc: 'Carry input' },
      { name: 'S0-S3', dir: 'out', desc: '4-bit sum output' },
      { name: 'Cout', dir: 'out', desc: 'Carry output (overflow)' }
    ],
    truth: null,
    how: [
      'Computes S = A + B + Cin as a 4-bit result plus carry.',
      'Internally, four full adders in a ripple-carry configuration.',
      'The carry "ripples" from bit 0 to bit 3, introducing a small delay (4 gate delays for carry propagation).',
      '<strong>8-bit addition:</strong> Cascade two 4-bit adders by connecting Cout of the low nibble to Cin of the high nibble.',
      '<strong>Subtraction:</strong> Invert all B inputs with NOT gates and set Cin=1 to compute A - B (two\'s complement).'
    ],
    example: 'Connect two 4-bit values and observe the sum. Set Cin=0 for simple addition. To subtract, XOR each B input with a "subtract" signal and connect that signal to Cin.',
    realworld: 'The 74LS283 is the real-world equivalent. Ben Eater\'s SAP-1 ALU uses this chip. Two 74LS283s cascaded give 8-bit addition.'
  };

  DS['Dec2to4'] = {
    name: 'Decoder 2:4', category: 'comb', badge: 'Combinational',
    summary: 'Converts a 2-bit binary input into one of four active outputs.',
    what: 'A 2-to-4 decoder takes a 2-bit binary address (S0, S1) and activates exactly one of four output lines (Y0-Y3). The selected output goes HIGH; all others stay LOW. With an enable pin, all outputs can be forced LOW.',
    analogy: 'A decoder is like a mail sorter. You give it a 2-digit address (00, 01, 10, or 11), and it puts the mail into exactly one of four mailboxes.',
    pins: [
      { name: 'S0', dir: 'in', desc: 'Select bit 0 (LSB)' },
      { name: 'S1', dir: 'in', desc: 'Select bit 1 (MSB)' },
      { name: 'EN', dir: 'in', desc: 'Enable (1 = active)' },
      { name: 'Y0', dir: 'out', desc: 'Output 0 (active when S=00)' },
      { name: 'Y1', dir: 'out', desc: 'Output 1 (active when S=01)' },
      { name: 'Y2', dir: 'out', desc: 'Output 2 (active when S=10)' },
      { name: 'Y3', dir: 'out', desc: 'Output 3 (active when S=11)' }
    ],
    truth: { heads: ['EN','S1','S0','Y0','Y1','Y2','Y3'], rows: [
      [0,'X','X',0,0,0,0],
      [1,0,0,1,0,0,0],
      [1,0,1,0,1,0,0],
      [1,1,0,0,0,1,0],
      [1,1,1,0,0,0,1]
    ]},
    how: [
      'The select inputs form a binary number that chooses which output goes HIGH.',
      'Y0 = EN AND (NOT S1) AND (NOT S0).',
      'Y1 = EN AND (NOT S1) AND S0. And so on.',
      '<strong>Address decoding:</strong> Use decoders to select which chip responds to a given address.',
      'The 2:4 decoder is the simplest decoder; the 3:8 (74LS138) is more common in CPUs.'
    ],
    example: 'Use a 2:4 decoder to select one of four RAM chips based on the two highest address bits.',
    realworld: 'Address decoding is the primary use. The upper address bits select which memory chip or I/O device is active.'
  };

  DS['Dec3to8'] = {
    name: 'Decoder 3:8', category: 'comb', badge: 'Combinational',
    summary: 'Converts a 3-bit binary input into one of eight active outputs. Equivalent to 74LS138.',
    what: 'A 3-to-8 decoder takes a 3-bit binary address and activates exactly one of eight output lines. This is the key chip for address decoding in CPU designs, including Ben Eater\'s SAP-1.',
    analogy: 'Like a train switchyard with 8 tracks. The 3-bit address is the switch controller that routes the train to exactly one of 8 tracks.',
    pins: [
      { name: 'S0', dir: 'in', desc: 'Select bit 0 (LSB)' },
      { name: 'S1', dir: 'in', desc: 'Select bit 1' },
      { name: 'S2', dir: 'in', desc: 'Select bit 2 (MSB)' },
      { name: 'EN', dir: 'in', desc: 'Enable (1 = active)' },
      { name: 'Y0-Y7', dir: 'out', desc: 'Eight output lines (one-hot)' }
    ],
    truth: { heads: ['EN','S2','S1','S0','Active Output'], rows: [
      [0,'X','X','X','None'],
      [1,0,0,0,'Y0'],
      [1,0,0,1,'Y1'],
      [1,0,1,0,'Y2'],
      [1,0,1,1,'Y3'],
      [1,1,0,0,'Y4'],
      [1,1,0,1,'Y5'],
      [1,1,1,0,'Y6'],
      [1,1,1,1,'Y7']
    ]},
    how: [
      'The 3-bit select input chooses which of the 8 outputs goes HIGH.',
      'Only one output is HIGH at a time (one-hot encoding).',
      'The 74LS138 has active-LOW outputs and three enable pins (G1, /G2A, /G2B).',
      '<strong>Instruction decoding:</strong> In the SAP-1, the IR\'s opcode bits feed into a decoder to generate instruction-specific control signals.',
      'Cascade two 3:8 decoders to make a 4:16 decoder.'
    ],
    example: 'Connect the opcode bits of the IR to a 3:8 decoder. Each output line activates the control logic for one instruction.',
    realworld: 'The 74LS138 is one of the most important chips in CPU design. Ben Eater uses it to decode instructions and generate timing signals.'
  };

  DS['Enc8to3'] = {
    name: 'Encoder 8:3', category: 'comb', badge: 'Combinational',
    summary: 'Encodes eight input lines into a 3-bit binary code. Inverse of a decoder.',
    what: 'An 8-to-3 encoder converts one-hot input (only one of eight lines active) into a 3-bit binary number. It\'s the reverse of a decoder. A valid output flag (V) indicates whether any input is active.',
    analogy: 'An encoder is like a receptionist who assigns room numbers. Eight guests (inputs) walk up, and the receptionist writes down which guest number arrived as a 3-bit code.',
    pins: [
      { name: 'I0-I7', dir: 'in', desc: 'Eight input lines (one-hot)' },
      { name: 'A0', dir: 'out', desc: 'Encoded output bit 0 (LSB)' },
      { name: 'A1', dir: 'out', desc: 'Encoded output bit 1' },
      { name: 'A2', dir: 'out', desc: 'Encoded output bit 2 (MSB)' },
      { name: 'V', dir: 'out', desc: 'Valid flag (1 = at least one input active)' }
    ],
    truth: { heads: ['Active In','A2','A1','A0','V'], rows: [
      ['None',0,0,0,0],
      ['I0',0,0,0,1],
      ['I1',0,0,1,1],
      ['I2',0,1,0,1],
      ['I3',0,1,1,1],
      ['I4',1,0,0,1],
      ['I5',1,0,1,1],
      ['I6',1,1,0,1],
      ['I7',1,1,1,1]
    ]},
    how: [
      'Expects exactly one input to be HIGH (one-hot input).',
      'Outputs the binary index of the active input.',
      'If no input is active, V=0 and the output code is undefined.',
      'If multiple inputs are active, behavior is undefined (use a priority encoder instead).',
      'A0 = I1 OR I3 OR I5 OR I7. A1 = I2 OR I3 OR I6 OR I7. A2 = I4 OR I5 OR I6 OR I7.'
    ],
    example: 'Connect 8 buttons to the inputs. The 3-bit output tells you which button was pressed.',
    realworld: 'Used in keyboard encoders, interrupt controllers, and any situation where you need to convert a one-hot signal to binary.'
  };

  DS['PriEnc'] = {
    name: 'Priority Encoder', category: 'comb', badge: 'Combinational',
    summary: 'Encodes the highest-priority active input into binary. Handles multiple simultaneous inputs.',
    what: 'A priority encoder is like a regular encoder but handles the case when multiple inputs are active simultaneously. It outputs the binary code for the highest-numbered (highest-priority) active input.',
    analogy: 'A priority encoder is like a VIP bouncer at a club. If multiple people want in, the highest-priority guest (highest number) gets served first, and the bouncer reports that guest\'s number.',
    pins: [
      { name: 'I0-I7', dir: 'in', desc: 'Eight input lines (priority: I7 highest)' },
      { name: 'A0-A2', dir: 'out', desc: '3-bit encoded output' },
      { name: 'V', dir: 'out', desc: 'Valid (1 = at least one input active)' }
    ],
    truth: { heads: ['Inputs (highest active)','A2','A1','A0','V'], rows: [
      ['None',0,0,0,0],
      ['I0 (only)',0,0,0,1],
      ['I3 (highest)',0,1,1,1],
      ['I5 + others below',1,0,1,1],
      ['I7 (always wins)',1,1,1,1]
    ]},
    how: [
      'Scans inputs from I7 (highest priority) down to I0 (lowest).',
      'Outputs the binary code of the highest active input.',
      'If I7 and I3 are both active, output = 111 (7), because I7 has higher priority.',
      'The valid flag V is 1 when any input is active.',
      'Essential for interrupt priority resolution in CPUs.'
    ],
    example: 'Connect multiple interrupt request lines to a priority encoder. The output tells the CPU which interrupt to service first.',
    realworld: 'The 74LS148 is an 8-to-3 priority encoder. Used in interrupt controllers (like the 8259A PIC in x86 PCs) to determine which interrupt has the highest priority.'
  };

  DS['Mux2to1'] = {
    name: 'Multiplexer 2:1', category: 'comb', badge: 'Combinational',
    summary: 'Selects one of two inputs and routes it to the output. A digital switch.',
    what: 'A 2-to-1 multiplexer (MUX) selects between two data inputs (D0, D1) based on a select signal (S). When S=0, output = D0. When S=1, output = D1. It\'s the digital equivalent of a single-pole double-throw switch.',
    analogy: 'A MUX is like a TV remote with two channels. Press the channel button (select) to switch between channel 0 and channel 1. Only one channel appears on screen at a time.',
    pins: [
      { name: 'D0', dir: 'in', desc: 'Data input 0 (selected when S=0)' },
      { name: 'D1', dir: 'in', desc: 'Data input 1 (selected when S=1)' },
      { name: 'S', dir: 'in', desc: 'Select (0 or 1)' },
      { name: 'Y', dir: 'out', desc: 'Output (D0 when S=0, D1 when S=1)' }
    ],
    truth: { heads: ['S','D0','D1','Y'], rows: [
      [0,0,'X',0],[0,1,'X',1],[1,'X',0,0],[1,'X',1,1]
    ]},
    how: [
      'Y = (NOT S AND D0) OR (S AND D1).',
      'The select pin acts as a switch between two data sources.',
      'Can be used to implement any Boolean function of the select inputs.',
      'Chain MUXes to build larger selectors: two 2:1 MUXes + one 2:1 MUX = 4:1 MUX.'
    ],
    example: 'Use a MUX to choose between ALU output and immediate data when loading a register.',
    realworld: 'MUXes are everywhere in CPU design. The register file, ALU input selection, and branch target selection all use multiplexers.'
  };

  DS['Mux4to1'] = {
    name: 'Multiplexer 4:1', category: 'comb', badge: 'Combinational',
    summary: 'Selects one of four inputs using a 2-bit select code.',
    what: 'A 4-to-1 MUX selects one of four data inputs based on a 2-bit select value. It\'s built from three 2:1 MUXes or directly from gates.',
    analogy: 'Like a 4-channel TV selector. Two select bits give you 4 possible channels (00, 01, 10, 11).',
    pins: [
      { name: 'D0-D3', dir: 'in', desc: 'Four data inputs' },
      { name: 'S0', dir: 'in', desc: 'Select bit 0 (LSB)' },
      { name: 'S1', dir: 'in', desc: 'Select bit 1 (MSB)' },
      { name: 'Y', dir: 'out', desc: 'Output (selected input)' }
    ],
    truth: { heads: ['S1','S0','Y'], rows: [
      [0,0,'D0'],[0,1,'D1'],[1,0,'D2'],[1,1,'D3']
    ]},
    how: [
      'The 2-bit select code (S1,S0) picks one of four inputs.',
      'Y = D0 when S=00, D1 when S=01, D2 when S=10, D3 when S=11.',
      'A 4:1 MUX can implement ANY 2-variable Boolean function by hardwiring D0-D3 to constants.',
      'Useful for ALU operation selection: S selects ADD, SUB, AND, OR.'
    ],
    example: 'Connect ALU operations to D0-D3 and the opcode bits to S0-S1. The MUX output is the selected operation result.',
    realworld: 'Used in ALU function select, register file read ports, and data path switching.'
  };

  DS['Mux8to1'] = {
    name: 'Multiplexer 8:1', category: 'comb', badge: 'Combinational',
    summary: 'Selects one of eight inputs using a 3-bit select code.',
    what: 'An 8-to-1 MUX routes one of eight data inputs to a single output, controlled by a 3-bit select code. This is the multiplexer equivalent of the 74LS138 decoder.',
    analogy: 'Like an 8-channel audio mixer where the select knob (3-bit) determines which input channel reaches the speakers.',
    pins: [
      { name: 'D0-D7', dir: 'in', desc: 'Eight data inputs' },
      { name: 'S0-S2', dir: 'in', desc: '3-bit select code' },
      { name: 'Y', dir: 'out', desc: 'Output (selected input)' }
    ],
    truth: { heads: ['S2','S1','S0','Y'], rows: [
      [0,0,0,'D0'],[0,0,1,'D1'],[0,1,0,'D2'],[0,1,1,'D3'],
      [1,0,0,'D4'],[1,0,1,'D5'],[1,1,0,'D6'],[1,1,1,'D7']
    ]},
    how: [
      'Three select bits choose one of 8 inputs to pass to the output.',
      'An 8:1 MUX can implement ANY 3-variable Boolean function by wiring inputs to 0 or 1.',
      'Cascading: use the select of a 2:1 MUX to choose between two 8:1 MUXes for a 16:1 MUX.'
    ],
    example: 'Route 8 different data sources to a single bus using a 3-bit address.',
    realworld: 'The 74LS151 is an 8:1 MUX IC. Used in data routing, function generators, and lookup tables.'
  };

  DS['Demux1to2'] = {
    name: 'Demultiplexer 1:2', category: 'comb', badge: 'Combinational',
    summary: 'Routes a single input to one of two outputs based on a select signal.',
    what: 'A 1-to-2 demultiplexer (DEMUX) takes a single data input and routes it to one of two outputs, controlled by a select signal. The non-selected output stays LOW. It\'s the reverse of a MUX.',
    analogy: 'A DEMUX is like a railway switch. One track splits into two, and the switch operator (select) decides which track the train goes to.',
    pins: [
      { name: 'D', dir: 'in', desc: 'Data input' },
      { name: 'S', dir: 'in', desc: 'Select (0 = Y0, 1 = Y1)' },
      { name: 'Y0', dir: 'out', desc: 'Output 0 (D when S=0)' },
      { name: 'Y1', dir: 'out', desc: 'Output 1 (D when S=1)' }
    ],
    truth: { heads: ['S','D','Y0','Y1'], rows: [
      [0,0,0,0],[0,1,1,0],[1,0,0,0],[1,1,0,1]
    ]},
    how: [
      'Y0 = D AND (NOT S). Y1 = D AND S.',
      'Only the selected output can be HIGH; the other is always LOW.',
      'A DEMUX is functionally identical to a decoder with the enable pin used as data input.',
      'Combine with a MUX for time-division multiplexing (TDM).'
    ],
    example: 'Route a serial data stream to one of two processing units based on a control signal.',
    realworld: 'Used in serial-to-parallel data distribution, memory bank selection, and communication systems.'
  };

  DS['Demux1to4'] = {
    name: 'Demultiplexer 1:4', category: 'comb', badge: 'Combinational',
    summary: 'Routes a single input to one of four outputs based on a 2-bit select.',
    what: 'A 1-to-4 DEMUX routes a single data input to one of four output lines, controlled by a 2-bit select code. Non-selected outputs stay LOW.',
    analogy: 'Like a mail carrier with one package and four mailboxes. The 2-bit address tells them which mailbox gets the package.',
    pins: [
      { name: 'D', dir: 'in', desc: 'Data input' },
      { name: 'S0', dir: 'in', desc: 'Select bit 0' },
      { name: 'S1', dir: 'in', desc: 'Select bit 1' },
      { name: 'Y0-Y3', dir: 'out', desc: 'Four outputs (one active)' }
    ],
    truth: { heads: ['S1','S0','D','Y0','Y1','Y2','Y3'], rows: [
      [0,0,1,1,0,0,0],
      [0,1,1,0,1,0,0],
      [1,0,1,0,0,1,0],
      [1,1,1,0,0,0,1],
      ['X','X',0,0,0,0,0]
    ]},
    how: [
      'The 2-bit select code (S1,S0) determines which output receives the data input.',
      'Y0 = D AND ~S1 AND ~S0. Y1 = D AND ~S1 AND S0. Etc.',
      'A 1:4 DEMUX is the same as a 2:4 decoder where the data input is the enable.',
      'Used for distributing a signal to one of several destinations.'
    ],
    example: 'Distribute a clock signal to one of four subsystems based on the current operating mode.',
    realworld: 'Used in memory address decoding, serial data distribution, and LED matrix driving.'
  };

  // ─── SEQUENTIAL LOGIC ──────────────────────────────────────────

  DS['SRLatch'] = {
    name: 'SR Latch', category: 'seq', badge: 'Sequential',
    summary: 'Set-Reset memory element. The simplest form of 1-bit storage.',
    what: 'An SR (Set-Reset) latch is the most basic memory element. Setting S=1 stores a 1 (Q=1). Setting R=1 clears it (Q=0). When both S and R are 0, the latch holds its previous value. Setting both S=R=1 is an invalid state.',
    analogy: 'An SR latch is like a light switch with two buttons: SET turns the light on and it stays on. RESET turns it off and it stays off. Both at once? The light gets confused (invalid).',
    pins: [
      { name: 'S', dir: 'in', desc: 'Set input (1 = set Q to 1)' },
      { name: 'R', dir: 'in', desc: 'Reset input (1 = reset Q to 0)' },
      { name: 'Q', dir: 'out', desc: 'Stored value' },
      { name: 'Qb', dir: 'out', desc: 'Complement of Q' }
    ],
    truth: { heads: ['S','R','Q','Qb'], rows: [
      [0,0,'Q(prev)','Qb(prev)'],
      [1,0,1,0],
      [0,1,0,1],
      [1,1,'X','X']
    ]},
    how: [
      'S=1, R=0: Q becomes 1 (SET). The latch remembers this.',
      'S=0, R=1: Q becomes 0 (RESET). The latch remembers this.',
      'S=0, R=0: Q holds its previous value. This is the <strong>memory</strong> state.',
      'S=1, R=1: <strong>Invalid!</strong> Both Q and Qb would try to be 0, creating a race condition.',
      'Built from two cross-coupled NAND or NOR gates.',
      'The SR latch is <strong>level-sensitive</strong> (not edge-triggered).'
    ],
    example: 'Build an SR latch from two NAND gates. Connect the output of each NAND to one input of the other. The remaining inputs are S and R.',
    realworld: 'SR latches are used for switch debouncing, simple memory bits, and as building blocks for flip-flops. The D flip-flop eliminates the invalid S=R=1 problem.'
  };

  DS['DFF'] = {
    name: 'D Flip-Flop', category: 'seq', badge: 'Sequential',
    summary: 'Edge-triggered 1-bit storage. Captures input D on the rising clock edge.',
    what: 'The D flip-flop captures the value of D at the instant the clock rises from 0 to 1. Between clock edges, the output Q holds steady regardless of what D does. This is the fundamental building block of all registers in a CPU.',
    analogy: 'A D flip-flop is like a camera that takes exactly one snapshot when you press the shutter (clock edge). Between presses, the photo (Q) doesn\'t change, even if the subject (D) moves.',
    pins: [
      { name: 'D', dir: 'in', desc: 'Data input' },
      { name: 'CLK', dir: 'in', desc: 'Clock (captures on rising edge)' },
      { name: 'Q', dir: 'out', desc: 'Stored output' },
      { name: 'Qb', dir: 'out', desc: 'Complement of Q' }
    ],
    truth: { heads: ['CLK','D','Q','Qb'], rows: [
      ['Rising',0,0,1],
      ['Rising',1,1,0],
      ['No edge','X','Q(prev)','Qb(prev)']
    ]},
    how: [
      'On the <strong>rising edge</strong> of CLK: Q = D. The input is "sampled."',
      'At all other times: Q holds its previous value.',
      'Eliminates the invalid state of the SR latch: only one input (D), so S=R=1 can never happen.',
      'An 8-bit register is simply 8 D flip-flops sharing the same CLK and LOAD signals.',
      '<strong>Setup time:</strong> D must be stable slightly before the clock edge.',
      '<strong>Hold time:</strong> D must remain stable slightly after the clock edge.'
    ],
    example: 'Connect a switch to D and a clock to CLK. Press the clock button and Q captures whatever the switch was set to at that moment.',
    realworld: 'The 74LS74 contains two D flip-flops. Every register in the SAP-1 CPU (A, B, IR, MAR, etc.) is built from D flip-flops. Flip-flops are the atoms of sequential logic.'
  };

  DS['JKFF'] = {
    name: 'JK Flip-Flop', category: 'seq', badge: 'Sequential',
    summary: 'Universal flip-flop. Can set, reset, toggle, or hold.',
    what: 'The JK flip-flop solves the SR latch\'s invalid state problem. When J=K=1, instead of being undefined, the output toggles (flips). This makes it the most versatile flip-flop type.',
    analogy: 'A JK flip-flop is like a Swiss Army knife of memory: it can hold (J=K=0), set (J=1,K=0), reset (J=0,K=1), or toggle (J=K=1). It does everything.',
    pins: [
      { name: 'J', dir: 'in', desc: 'J input (like Set)' },
      { name: 'K', dir: 'in', desc: 'K input (like Reset)' },
      { name: 'CLK', dir: 'in', desc: 'Clock (acts on rising edge)' },
      { name: 'Q', dir: 'out', desc: 'Stored output' },
      { name: 'Qb', dir: 'out', desc: 'Complement of Q' }
    ],
    truth: { heads: ['CLK','J','K','Q (next)'], rows: [
      ['Rising',0,0,'Q (hold)'],
      ['Rising',1,0,'1 (set)'],
      ['Rising',0,1,'0 (reset)'],
      ['Rising',1,1,'~Q (toggle)']
    ]},
    how: [
      'J=0, K=0: <strong>Hold</strong> -- Q keeps its current value.',
      'J=1, K=0: <strong>Set</strong> -- Q becomes 1.',
      'J=0, K=1: <strong>Reset</strong> -- Q becomes 0.',
      'J=1, K=1: <strong>Toggle</strong> -- Q flips to its complement.',
      'All changes happen on the rising edge of CLK only.',
      'A JK flip-flop with J=K=T becomes a T flip-flop. With K=~J and J=D, it becomes a D flip-flop.'
    ],
    example: 'Wire J=K=1 and connect a clock. The Q output will toggle on every clock pulse, creating a frequency divider (output = CLK/2).',
    realworld: 'JK flip-flops are used in counters, frequency dividers, and state machines. The 74LS76 contains two JK flip-flops.'
  };

  DS['TFF'] = {
    name: 'T Flip-Flop', category: 'seq', badge: 'Sequential',
    summary: 'Toggle flip-flop. Flips output on each clock edge when T=1.',
    what: 'The T (Toggle) flip-flop toggles its output on each clock edge when the T input is HIGH. When T=0, it holds its value. It\'s the simplest way to build binary counters.',
    analogy: 'A T flip-flop is like a light switch that flips every time someone presses the button (when T=1). If T=0, pressing the button does nothing.',
    pins: [
      { name: 'T', dir: 'in', desc: 'Toggle enable (1 = flip on clock)' },
      { name: 'CLK', dir: 'in', desc: 'Clock (toggles on rising edge)' },
      { name: 'Q', dir: 'out', desc: 'Stored output' },
      { name: 'Qb', dir: 'out', desc: 'Complement of Q' }
    ],
    truth: { heads: ['CLK','T','Q (next)'], rows: [
      ['Rising',0,'Q (hold)'],
      ['Rising',1,'~Q (toggle)'],
      ['No edge','X','Q (hold)']
    ]},
    how: [
      'T=1 + rising clock edge: Q flips (0 becomes 1, 1 becomes 0).',
      'T=0: Q holds regardless of clock.',
      'A T flip-flop is a JK flip-flop with J=K=T.',
      '<strong>Counter building:</strong> Chain T flip-flops (all T=1) and connect each Q to the next CLK. You get a binary ripple counter: each stage divides frequency by 2.'
    ],
    example: 'Connect T=1 (VCC) and pulse the clock. Q toggles on every pulse: 0,1,0,1,0,1... This is a divide-by-2 circuit.',
    realworld: 'T flip-flops are the basis of all binary counters. Chain 4 together to build a 4-bit counter (0-15). The 74LS93 is a 4-bit ripple counter made from T flip-flops.'
  };

  DS['Counter4'] = {
    name: '4-Bit Counter', category: 'seq', badge: 'Sequential',
    summary: 'Counts from 0 to 15 on each clock pulse. Synchronous up-counter with reset and enable.',
    what: 'A 4-bit binary counter increments by 1 on each rising clock edge (when enabled). It counts 0, 1, 2, ... 14, 15, then wraps back to 0. This is the heart of the Program Counter in a CPU.',
    analogy: 'A 4-bit counter is like a 4-digit odometer that only uses 0 and 1 instead of 0-9. It counts up with each mile (clock pulse) and rolls over at 16 (back to 0000).',
    pins: [
      { name: 'CLK', dir: 'in', desc: 'Clock (increments on rising edge)' },
      { name: 'RST', dir: 'in', desc: 'Reset (1 = reset count to 0)' },
      { name: 'EN', dir: 'in', desc: 'Enable (1 = count, 0 = hold)' },
      { name: 'Q0', dir: 'out', desc: 'Bit 0 (LSB)' },
      { name: 'Q1', dir: 'out', desc: 'Bit 1' },
      { name: 'Q2', dir: 'out', desc: 'Bit 2' },
      { name: 'Q3', dir: 'out', desc: 'Bit 3 (MSB)' }
    ],
    truth: null,
    how: [
      'On each rising CLK edge (when EN=1): count = count + 1.',
      'When RST=1: count resets to 0 immediately.',
      'When EN=0: count holds its current value.',
      'After 15 (1111), wraps to 0 (0000) and could set a carry/overflow flag.',
      'Internally: four T flip-flops chained together (synchronous design).',
      '<strong>Program Counter:</strong> The PC in a CPU is a counter that steps through memory addresses. JMP instructions load a new value instead of incrementing.'
    ],
    example: 'Connect the counter CLK to a clock, EN to VCC, and RST to GND. Watch Q0-Q3 count up in binary on each clock pulse.',
    realworld: 'The 74LS161 is a synchronous 4-bit counter with parallel load (for JMP). Ben Eater uses it as the program counter and micro-step counter in the SAP-1.'
  };

  DS['ShiftReg'] = {
    name: 'Shift Register (8-bit)', category: 'seq', badge: 'Sequential',
    summary: 'Serial-in, parallel-out 8-bit shift register. Shifts data one position on each clock.',
    what: 'A shift register stores 8 bits and shifts them one position on each clock pulse. New data enters at the serial input (SI), and existing data shifts toward the output end. After 8 clock pulses, 8 serial bits appear in parallel on Q0-Q7.',
    analogy: 'A shift register is like a conveyor belt with 8 slots. Each clock pulse moves everything one slot to the right. You put items on at one end and they come out the other end in order.',
    pins: [
      { name: 'SI', dir: 'in', desc: 'Serial data input' },
      { name: 'CLK', dir: 'in', desc: 'Clock (shifts on rising edge)' },
      { name: 'RST', dir: 'in', desc: 'Reset (clears all bits to 0)' },
      { name: 'Q0-Q7', dir: 'out', desc: '8-bit parallel output' }
    ],
    truth: null,
    how: [
      'On each rising CLK edge: all bits shift one position.',
      'Q7 = Q6(prev), Q6 = Q5(prev), ... Q1 = Q0(prev), Q0 = SI.',
      'After N clock pulses, the last N serial input bits are stored.',
      '<strong>Serial-to-parallel conversion:</strong> Send 8 bits one-at-a-time, then read all 8 in parallel.',
      '<strong>Parallel-to-serial:</strong> Some shift registers can load in parallel and shift out serially.',
      'Shift registers are also used for delay lines, FIFO buffers, and pseudo-random number generation (LFSR).'
    ],
    example: 'Feed a pattern of 1s and 0s into SI while pulsing CLK. After 8 pulses, read the full byte on Q0-Q7.',
    realworld: 'The 74LS164 is a serial-in parallel-out shift register. SPI and UART communication protocols use shift registers to convert between serial and parallel data.'
  };

  // ─── SEMICONDUCTORS ─────────────────────────────────────────────

  DS['Diode'] = {
    name: 'Diode', category: 'semi', badge: 'Semiconductor',
    summary: 'One-way valve for signals. Passes current in one direction only.',
    what: 'A diode allows current to flow in one direction only: from Anode (A) to Cathode (K). In digital logic, it passes a HIGH signal forward but blocks LOW signals from propagating backward.',
    analogy: 'A diode is a one-way door. People (current) can walk through from one side but cannot push back from the other side.',
    pins: [
      { name: 'A', dir: 'in', desc: 'Anode (input, positive side)' },
      { name: 'K', dir: 'out', desc: 'Cathode (output, negative side, marked with band)' }
    ],
    truth: { heads: ['A','K (out)'], rows: [[0,0],[1,1]] },
    how: [
      'When A=1 (forward biased): signal passes through. K=1.',
      'When A=0: no conduction. K=0.',
      'In real diodes, there\'s a ~0.7V forward voltage drop (silicon) or ~0.3V (Schottky).',
      '<strong>Diode logic:</strong> OR gate = diodes with anodes as inputs, cathodes tied together. AND gate = diodes with cathodes as inputs, anodes tied together with pull-up.',
      '<strong>Protection:</strong> Diodes protect against reverse polarity and voltage spikes (flyback diodes on inductors).'
    ],
    example: 'Build a simple OR gate using two diodes: connect both anodes to different inputs, tie the cathodes together for the output.',
    realworld: 'The 1N4148 is the most common small-signal diode. The 1N4001 handles power. Schottky diodes (e.g., BAT85) are used in TTL logic circuits for speed.'
  };

  DS['LED'] = {
    name: 'LED (Light Emitting Diode)', category: 'semi', badge: 'Semiconductor',
    summary: 'Lights up when forward biased. Visual indicator for digital signals.',
    what: 'An LED is a diode that emits light when current flows through it (forward biased). In digital circuits, LEDs are the most common way to visualize signal states: ON = HIGH, OFF = LOW.',
    analogy: 'An LED is like a tiny window into your circuit. When electricity flows through, it glows. No flow, no glow. It\'s the simplest way to "see" what your circuit is doing.',
    pins: [
      { name: 'A', dir: 'in', desc: 'Anode (positive, longer leg)' },
      { name: 'K', dir: 'out', desc: 'Cathode (negative, shorter leg, flat side)' }
    ],
    truth: { heads: ['A','LED'], rows: [[0,'OFF'],[1,'ON']] },
    how: [
      'When A=1: LED turns on (emits light).',
      'When A=0: LED is off.',
      '<strong>Always use a current-limiting resistor!</strong> Without one, the LED draws too much current and burns out.',
      'Typical: 220-330 ohm resistor in series with a 5V supply for standard red/green LEDs.',
      'Forward voltage drop: Red ~1.8V, Green ~2.2V, Blue ~3.0V, White ~3.2V.'
    ],
    example: 'Connect an LED (with a 220 ohm resistor) to the output of a gate. The LED lights up when the output is HIGH.',
    realworld: 'Ben Eater\'s breadboard computer uses LEDs on every register, the bus, and control signals so you can see the CPU\'s internal state in real time. This is the #1 debugging tool.'
  };

  DS['NPN'] = {
    name: 'NPN Transistor (BJT)', category: 'semi', badge: 'Semiconductor',
    summary: 'Current-controlled switch. Base current allows collector-to-emitter current flow.',
    what: 'An NPN bipolar junction transistor acts as a current-controlled switch. When a small current flows into the Base (B), a much larger current can flow from Collector (C) to Emitter (E). In digital mode, it acts as an inverting switch: Base HIGH turns on the CE path.',
    analogy: 'An NPN transistor is like a water valve. A small stream of water (base current) opens the valve, allowing a large river (collector current) to flow. The small stream controls the big flow.',
    pins: [
      { name: 'B', dir: 'in', desc: 'Base (control input)' },
      { name: 'C', dir: 'in', desc: 'Collector (from VCC through load)' },
      { name: 'E', dir: 'out', desc: 'Emitter (to GND)' }
    ],
    truth: { heads: ['B','C-E path'], rows: [[0,'OFF (open)'],[1,'ON (conducting)']] },
    how: [
      'B=1 (HIGH): Transistor turns ON. Current flows from C to E. Acts like a closed switch.',
      'B=0 (LOW): Transistor turns OFF. No current flows. Acts like an open switch.',
      'In saturation (digital mode): V_CE drops to ~0.2V (nearly a short).',
      '<strong>NOT gate:</strong> Connect collector to VCC through a resistor, emitter to GND. Output at collector: when B=HIGH, output=LOW (inverted).',
      'Beta (gain): IC = beta * IB. Typical beta = 100-300. A tiny base current controls a large collector current.'
    ],
    example: 'Build a NOT gate: VCC -> 1k resistor -> Collector -> output. Emitter -> GND. When base is HIGH, transistor pulls output LOW.',
    realworld: 'The 2N2222 is the most common NPN transistor. TTL logic gates (like the 74LS series) are built from NPN transistors internally.'
  };

  DS['PNP'] = {
    name: 'PNP Transistor (BJT)', category: 'semi', badge: 'Semiconductor',
    summary: 'Complement of NPN. Active when base is LOW. Current flows emitter to collector.',
    what: 'A PNP transistor is the complement of NPN. Current flows from Emitter to Collector when the Base is pulled LOW. It\'s like an NPN with all polarities reversed.',
    analogy: 'If NPN is a normally-closed valve that opens when you push the button, PNP is a normally-open valve that closes when you release the button. It works "upside down" compared to NPN.',
    pins: [
      { name: 'B', dir: 'in', desc: 'Base (control, active LOW)' },
      { name: 'E', dir: 'in', desc: 'Emitter (connects to VCC)' },
      { name: 'C', dir: 'out', desc: 'Collector (output to load)' }
    ],
    truth: { heads: ['B','E-C path'], rows: [[0,'ON (conducting)'],[1,'OFF (open)']] },
    how: [
      'B=0 (LOW): Transistor turns ON. Current flows from E to C.',
      'B=1 (HIGH): Transistor turns OFF. No current flows.',
      'PNP is used as a "high-side switch" -- it connects VCC to the load when active.',
      '<strong>Complementary pair:</strong> NPN + PNP together form a push-pull output stage (used in CMOS and audio amplifiers).',
      'In CMOS logic, the P-channel MOSFETs play the same role as PNP transistors.'
    ],
    example: 'Use a PNP transistor to switch power to a high-current load. When the control signal goes LOW, VCC flows through the PNP to the load.',
    realworld: 'The 2N2907 is the PNP complement to the 2N2222. PNP transistors are used in power switching, level shifting, and complementary output stages.'
  };

  DS['NMOS'] = {
    name: 'N-Channel MOSFET', category: 'semi', badge: 'Semiconductor',
    summary: 'Voltage-controlled switch. Gate HIGH turns on drain-to-source path. No gate current needed.',
    what: 'An N-MOSFET is a voltage-controlled switch (unlike BJTs which are current-controlled). When Gate voltage exceeds the threshold (~2V), the Drain-to-Source channel opens. The key advantage: the gate draws virtually zero current.',
    analogy: 'An N-MOSFET is like a touch-sensitive door. You don\'t need to push (current) -- just touch (voltage) the sensor pad (gate) and the door opens. This makes it incredibly efficient.',
    pins: [
      { name: 'G', dir: 'in', desc: 'Gate (voltage control, draws no current)' },
      { name: 'D', dir: 'in', desc: 'Drain (from VCC through load)' },
      { name: 'S', dir: 'out', desc: 'Source (to GND)' }
    ],
    truth: { heads: ['G','D-S path'], rows: [[0,'OFF (open)'],[1,'ON (conducting)']] },
    how: [
      'G=1 (V_GS > threshold): Channel conducts. Low resistance from D to S.',
      'G=0 (V_GS < threshold): Channel is off. Very high resistance (megaohms).',
      '<strong>Zero gate current:</strong> Unlike BJTs, MOSFETs are controlled purely by voltage. This means near-zero power consumption in steady state.',
      'CMOS logic: pair N-MOSFET (pull-down) with P-MOSFET (pull-up) for each logic function.',
      'Modern CPUs contain billions of MOSFETs, all CMOS (N + P channel pairs).'
    ],
    example: 'Build a CMOS inverter: P-MOSFET from VCC to output, N-MOSFET from output to GND. Connect both gates together as input.',
    realworld: 'The 2N7000 is a common small N-MOSFET. Every modern CPU, GPU, and SoC is built entirely from MOSFETs. A modern CPU has 50+ billion of them.'
  };

  DS['PMOS'] = {
    name: 'P-Channel MOSFET', category: 'semi', badge: 'Semiconductor',
    summary: 'Complement of N-MOSFET. Gate LOW turns on source-to-drain path.',
    what: 'A P-MOSFET is the complement of an N-MOSFET. It conducts when the gate is LOW (relative to source). In CMOS logic, P-MOSFETs form the pull-up network while N-MOSFETs form the pull-down network.',
    analogy: 'If N-MOSFET opens when you raise your hand (gate HIGH), P-MOSFET opens when you lower your hand (gate LOW). They work as a complementary pair.',
    pins: [
      { name: 'G', dir: 'in', desc: 'Gate (active LOW control)' },
      { name: 'S', dir: 'in', desc: 'Source (connects to VCC)' },
      { name: 'D', dir: 'out', desc: 'Drain (output)' }
    ],
    truth: { heads: ['G','S-D path'], rows: [[0,'ON (conducting)'],[1,'OFF (open)']] },
    how: [
      'G=0 (LOW): P-MOSFET turns ON. Current flows from S to D (connects output to VCC).',
      'G=1 (HIGH): P-MOSFET turns OFF.',
      '<strong>CMOS pair:</strong> In a CMOS inverter, P-MOSFET connects output to VCC and N-MOSFET connects output to GND. Input HIGH: NMOS on, PMOS off, output LOW. Input LOW: PMOS on, NMOS off, output HIGH.',
      'P-MOSFETs are typically slower than N-MOSFETs (hole mobility < electron mobility), so they are made wider to compensate.'
    ],
    example: 'Combine with an N-MOSFET to build a CMOS inverter: the simplest and most power-efficient logic gate.',
    realworld: 'P-MOSFETs are in every CMOS chip ever made. They form the pull-up half of every gate. Without P-MOSFETs, CMOS logic would not exist.'
  };

  DS['NJFET'] = {
    name: 'N-Channel JFET', category: 'semi', badge: 'Semiconductor',
    summary: 'Normally-ON transistor. Gate voltage pinches off the channel to turn it off.',
    what: 'An N-JFET (Junction Field-Effect Transistor) is normally ON when the gate is at 0V. Applying a negative voltage (or in digital terms, logic LOW) to the gate pinches off the channel and turns it OFF. This is the opposite behavior of a MOSFET.',
    analogy: 'An N-JFET is like a garden hose that is normally flowing. You squeeze (apply gate voltage) to reduce or stop the flow. No squeeze = full flow.',
    pins: [
      { name: 'G', dir: 'in', desc: 'Gate (0 = ON, 1 = OFF in sim)' },
      { name: 'D', dir: 'in', desc: 'Drain' },
      { name: 'S', dir: 'out', desc: 'Source' }
    ],
    truth: { heads: ['G','D-S path'], rows: [[0,'ON (conducting)'],[1,'OFF (pinched off)']] },
    how: [
      'G=0: Channel is ON (normally conducting). D-S path has low resistance.',
      'G=1: Channel pinches off. D-S path has high resistance (OFF).',
      'JFETs are depletion-mode devices (ON by default), unlike MOSFETs which are enhancement-mode (OFF by default).',
      'JFETs have very high input impedance (like MOSFETs) but are simpler to manufacture.',
      'Rarely used in digital logic; more common in analog amplifiers and RF circuits.'
    ],
    example: 'Use as a normally-closed switch: the signal path is open by default, and applying a gate signal closes it.',
    realworld: 'JFETs are used in high-impedance amplifier inputs, current sources, and analog switches. The 2N5457 is a common N-JFET.'
  };

  DS['PJFET'] = {
    name: 'P-Channel JFET', category: 'semi', badge: 'Semiconductor',
    summary: 'Complement of N-JFET. Normally ON, gate HIGH turns it off.',
    what: 'A P-JFET is the complement of an N-JFET. It is normally ON and turns OFF when the gate goes HIGH (positive voltage relative to source). All polarities are reversed compared to N-JFET.',
    analogy: 'Same as N-JFET but with reversed polarity. Think of it as a normally-open valve that shuts when you apply pressure from the other direction.',
    pins: [
      { name: 'G', dir: 'in', desc: 'Gate (1 = OFF, 0 = ON in sim)' },
      { name: 'S', dir: 'in', desc: 'Source' },
      { name: 'D', dir: 'out', desc: 'Drain' }
    ],
    truth: { heads: ['G','S-D path'], rows: [[0,'ON (conducting)'],[1,'OFF (pinched off)']] },
    how: [
      'G=0: Channel is ON (normally conducting).',
      'G=1: Channel pinches off (turns OFF).',
      'Complementary to N-JFET, just as PNP is complementary to NPN.',
      'Less common than N-JFET in practice.'
    ],
    example: 'Use as part of a complementary JFET pair in an analog switch or a current mirror.',
    realworld: 'P-JFETs are used in complementary analog circuits and JFET-input op-amps. Less common in digital design.'
  };

  DS['SCR'] = {
    name: 'SCR (Silicon Controlled Rectifier)', category: 'semi', badge: 'Semiconductor',
    summary: 'Latching switch. Once triggered by gate pulse, stays ON until current drops to zero.',
    what: 'An SCR is a thyristor that acts as a latching switch. A brief pulse on the Gate (G) turns it ON, and it stays ON even after the gate signal is removed. It only turns OFF when the anode current drops to zero (or the circuit is reset).',
    analogy: 'An SCR is like a mousetrap: a small trigger (gate pulse) sets it off, and once triggered, it stays sprung. You have to manually reset it (remove power) to re-arm it.',
    pins: [
      { name: 'A', dir: 'in', desc: 'Anode (positive input)' },
      { name: 'G', dir: 'in', desc: 'Gate (trigger, pulse to latch ON)' },
      { name: 'K', dir: 'out', desc: 'Cathode (output)' }
    ],
    truth: { heads: ['A','G','K','State'], rows: [
      [0,'X',0,'OFF'],
      [1,0,0,'OFF (not yet triggered)'],
      [1,1,1,'ON (latched)'],
      [1,0,1,'ON (stays latched)']
    ]},
    how: [
      'Initially OFF: no current flows from A to K.',
      'Gate pulse (G=1 while A=1): SCR latches ON. A-K path conducts.',
      'Gate can return to 0: SCR stays ON (latched).',
      'Only turns OFF when A drops to 0 (or circuit is reset).',
      'Used in power control, crowbar protection circuits, and motor drives.',
      'Think of it as a "one-shot" switch that requires a power cycle to reset.'
    ],
    example: 'Build an alarm circuit: once a sensor triggers the gate, the SCR latches ON and keeps the alarm buzzing until power is cycled.',
    realworld: 'SCRs are used in light dimmers, motor speed controllers, and overvoltage protection circuits. The C106 is a common SCR.'
  };

  // ─── DISPLAY ────────────────────────────────────────────────────

  DS['LEDBar'] = {
    name: 'LED Bar (8-bit)', category: 'display', badge: 'Display',
    summary: 'Eight LEDs in a row. Visualizes an 8-bit value as individual lit/unlit LEDs.',
    what: 'An LED bar graph is a row of 8 LEDs, each controlled by one bit of an 8-bit input. It\'s the simplest way to visualize a binary number: each LED represents one bit, and its on/off state shows 1 or 0.',
    analogy: 'An LED bar is like 8 light bulbs on a control panel. Each bulb shows one bit of data: ON = 1, OFF = 0. Together they spell out a binary number you can see at a glance.',
    pins: [
      { name: 'D0-D7', dir: 'in', desc: '8 individual bit inputs' },
      { name: 'GND', dir: 'in', desc: 'Common ground' }
    ],
    truth: null,
    how: [
      'Each input D0-D7 controls one LED in the bar.',
      'D0 is the rightmost (LSB), D7 is the leftmost (MSB).',
      'A HIGH input lights the corresponding LED; LOW turns it off.',
      'No current-limiting resistors needed in this simulator (but required in real circuits!).',
      'Useful for watching register values, bus states, and counter outputs in real time.'
    ],
    example: 'Connect an 8-bit counter output to the LED bar. Watch the binary count sequence light up as LEDs.',
    realworld: 'Ben Eater uses LED bars on every register and the bus so you can see the CPU\'s internal state. Common part numbers: HDSP-4836 (10-segment bar).'
  };

  DS['7Seg'] = {
    name: '7-Segment Display', category: 'display', badge: 'Display',
    summary: 'Displays digits 0-9 using seven individually-controlled LED segments.',
    what: 'A 7-segment display has seven LED segments (a-g) arranged in a figure-8 pattern, plus a decimal point (dp). By lighting specific combinations of segments, you can display digits 0-9 and some letters.',
    analogy: 'Like a digital alarm clock display. Each digit is made of 7 bar-shaped LEDs. Light the right combination and you see a number.',
    pins: [
      { name: 'a-g', dir: 'in', desc: 'Seven segment inputs' },
      { name: 'dp', dir: 'in', desc: 'Decimal point' },
      { name: 'COM', dir: 'in', desc: 'Common (anode or cathode)' }
    ],
    truth: { heads: ['Digit','a','b','c','d','e','f','g'], rows: [
      ['0',1,1,1,1,1,1,0],
      ['1',0,1,1,0,0,0,0],
      ['2',1,1,0,1,1,0,1],
      ['3',1,1,1,1,0,0,1],
      ['4',0,1,1,0,0,1,1],
      ['5',1,0,1,1,0,1,1],
      ['6',1,0,1,1,1,1,1],
      ['7',1,1,1,0,0,0,0],
      ['8',1,1,1,1,1,1,1],
      ['9',1,1,1,1,0,1,1]
    ]},
    how: [
      'Segments are labeled a-g in a standard pattern: a=top, b=upper-right, c=lower-right, d=bottom, e=lower-left, f=upper-left, g=middle.',
      'To display "0": light a,b,c,d,e,f (all except g).',
      'To display "1": light b,c only.',
      '<strong>Common anode:</strong> All anodes tied to VCC; drive segment cathodes LOW to light.',
      '<strong>Common cathode:</strong> All cathodes tied to GND; drive segment anodes HIGH to light.',
      'The SAP-1 OUTPUT display uses these to show the computed result.'
    ],
    example: 'Connect switches to segments a-g and manually light up different digits. Then replace the switches with a BCD decoder for automatic conversion.',
    realworld: 'The HDSP-5503 is a common 7-segment display. Ben Eater builds a custom decimal decoder using EEPROMs to drive 4 digits for the output display.'
  };

  DS['7SegDec'] = {
    name: '7-Segment + Decoder', category: 'display', badge: 'Display',
    summary: 'Combined BCD-to-7-segment decoder and display. Input a 4-bit number, see a digit.',
    what: 'This component combines a BCD (Binary-Coded Decimal) to 7-segment decoder with the display itself. You input a 4-bit binary number (0-15) and it automatically lights the correct segments to show the corresponding digit.',
    analogy: 'Instead of manually wiring 7 segments, this is a "smart display" that you just tell the number and it figures out which segments to light.',
    pins: [
      { name: 'B0-B3', dir: 'in', desc: '4-bit BCD input' }
    ],
    truth: { heads: ['B3','B2','B1','B0','Display'], rows: [
      [0,0,0,0,'0'],[0,0,0,1,'1'],[0,0,1,0,'2'],[0,0,1,1,'3'],
      [0,1,0,0,'4'],[0,1,0,1,'5'],[0,1,1,0,'6'],[0,1,1,1,'7'],
      [1,0,0,0,'8'],[1,0,0,1,'9'],[1,0,1,0,'A'],[1,0,1,1,'b'],
      [1,1,0,0,'C'],[1,1,0,1,'d'],[1,1,1,0,'E'],[1,1,1,1,'F']
    ]},
    how: [
      'The 4-bit input is treated as a binary number (0-15).',
      'An internal decoder converts this to the 7-segment pattern.',
      'Values 0-9 show decimal digits; 10-15 show hex letters (A-F).',
      'Equivalent to a 74LS47 (BCD to 7-seg decoder) connected to a display.',
      'Ben Eater uses a programmed EEPROM as his BCD decoder for the output display.'
    ],
    example: 'Connect a 4-bit counter output to the input. Watch the display count 0, 1, 2, ... 9, A, B, C, D, E, F.',
    realworld: 'The 74LS47 and CD4511 are common BCD-to-7-segment decoder ICs. Ben Eater programs a 28C16 EEPROM to handle unsigned, signed, and hex display modes.'
  };

  // ─── 74LS ICs ───────────────────────────────────────────────────

  DS['74LS00'] = {
    name: '74LS00 — Quad NAND Gate', category: 'ic', badge: '74LS IC',
    summary: 'Four independent 2-input NAND gates in a 14-pin DIP package.',
    what: 'The 74LS00 contains four 2-input NAND gates. Each gate is independent. NAND is a universal gate, so this single chip can implement any Boolean function.',
    analogy: 'Like having four "universal logic workers" in one office (chip). Each can do any job because NAND is the universal gate.',
    pins: [
      { name: '1A,1B', dir: 'in', desc: 'Gate 1 inputs' },
      { name: '1Y', dir: 'out', desc: 'Gate 1 output: NOT(1A AND 1B)' },
      { name: '2A,2B', dir: 'in', desc: 'Gate 2 inputs' },
      { name: '2Y', dir: 'out', desc: 'Gate 2 output' },
      { name: '3A,3B', dir: 'in', desc: 'Gate 3 inputs' },
      { name: '3Y', dir: 'out', desc: 'Gate 3 output' },
      { name: '4A,4B', dir: 'in', desc: 'Gate 4 inputs' },
      { name: '4Y', dir: 'out', desc: 'Gate 4 output' },
      { name: 'VCC', dir: 'pwr', desc: 'Pin 14: +5V power' },
      { name: 'GND', dir: 'pwr', desc: 'Pin 7: Ground' }
    ],
    truth: { heads: ['A','B','Y'], rows: [[0,0,1],[0,1,1],[1,0,1],[1,1,0]] },
    how: [
      'Each gate: Y = NOT(A AND B).',
      'Pin 14 = VCC (+5V), Pin 7 = GND. Always connect power!',
      'Gates are independent; unused gates should have inputs tied to VCC or GND.',
      '<strong>Build an SR latch:</strong> Cross-couple two of the four NAND gates.',
      '<strong>Build any gate:</strong> NOT = NAND(A,A). AND = NAND + NAND(Y,Y).'
    ],
    example: 'Use two NAND gates from this chip to build an SR latch for switch debouncing.',
    realworld: 'The 74LS00 is possibly the most important TTL chip. Ben Eater uses it extensively in the SAP-1 control logic. First manufactured in the 1960s and still in production.'
  };

  DS['74LS04'] = {
    name: '74LS04 — Hex Inverter', category: 'ic', badge: '74LS IC',
    summary: 'Six independent NOT gates in a 14-pin DIP package.',
    what: 'The 74LS04 contains six independent inverters (NOT gates). Each inverter flips its input: HIGH becomes LOW, LOW becomes HIGH.',
    analogy: 'Six "mirror workers" in one office. Each takes a signal and produces its opposite.',
    pins: [
      { name: '1A-6A', dir: 'in', desc: 'Six independent inputs' },
      { name: '1Y-6Y', dir: 'out', desc: 'Six inverted outputs' },
      { name: 'VCC', dir: 'pwr', desc: 'Pin 14: +5V' },
      { name: 'GND', dir: 'pwr', desc: 'Pin 7: Ground' }
    ],
    truth: { heads: ['A','Y'], rows: [[0,1],[1,0]] },
    how: [
      'Each gate: Y = NOT A.',
      'Six inverters means you can invert up to 6 independent signals.',
      'Used to create active-LOW signals from active-HIGH, or vice versa.',
      'Two inverters in series = buffer (signal restoration).',
      'An odd number of inverters in a ring = oscillator (ring oscillator).'
    ],
    example: 'Invert the active-HIGH output enable signal to create the active-LOW /OE needed by many bus transceivers.',
    realworld: 'The 74LS04 is used in Ben Eater\'s SAP-1 for signal inversion in the control logic. Also used to build a simple ring oscillator for the clock module.'
  };

  DS['74LS08'] = {
    name: '74LS08 — Quad AND Gate', category: 'ic', badge: '74LS IC',
    summary: 'Four independent 2-input AND gates in a 14-pin DIP package.',
    what: 'The 74LS08 contains four 2-input AND gates. Each gate outputs HIGH only when both inputs are HIGH.',
    analogy: 'Four "both-must-agree" checkers in one chip. Each only gives a thumbs up when both inputs agree to be HIGH.',
    pins: [
      { name: '1A,1B', dir: 'in', desc: 'Gate 1 inputs' },
      { name: '1Y', dir: 'out', desc: 'Gate 1 output: 1A AND 1B' },
      { name: '2A,2B', dir: 'in', desc: 'Gate 2 inputs' },
      { name: '2Y', dir: 'out', desc: 'Gate 2 output' },
      { name: '3A,3B', dir: 'in', desc: 'Gate 3 inputs' },
      { name: '3Y', dir: 'out', desc: 'Gate 3 output' },
      { name: '4A,4B', dir: 'in', desc: 'Gate 4 inputs' },
      { name: '4Y', dir: 'out', desc: 'Gate 4 output' },
      { name: 'VCC', dir: 'pwr', desc: 'Pin 14: +5V' },
      { name: 'GND', dir: 'pwr', desc: 'Pin 7: Ground' }
    ],
    truth: { heads: ['A','B','Y'], rows: [[0,0,0],[0,1,0],[1,0,0],[1,1,1]] },
    how: [
      'Each gate: Y = A AND B.',
      'Commonly used for "gating" signals: Y = DATA AND ENABLE.',
      'When ENABLE=1, DATA passes through. When ENABLE=0, output is forced LOW.',
      'This is how control signals in the SAP-1 are selectively applied: the control ROM output ANDed with the clock.'
    ],
    example: 'AND the clock signal with an enable signal to create a gated clock that only pulses when the enable is HIGH.',
    realworld: 'The 74LS08 is used in the SAP-1 for gating control signals with the clock. E.g., the LOAD signal is ANDed with CLK to create the actual register load pulse.'
  };

  DS['74LS32'] = {
    name: '74LS32 — Quad OR Gate', category: 'ic', badge: '74LS IC',
    summary: 'Four independent 2-input OR gates in a 14-pin DIP package.',
    what: 'The 74LS32 contains four 2-input OR gates. Each gate outputs HIGH when at least one input is HIGH.',
    analogy: 'Four "any-will-do" workers. Each gives a thumbs up if either (or both) inputs are HIGH.',
    pins: [
      { name: '1A,1B', dir: 'in', desc: 'Gate 1 inputs' },
      { name: '1Y', dir: 'out', desc: 'Gate 1 output: 1A OR 1B' },
      { name: '2A,2B', dir: 'in', desc: 'Gate 2 inputs' },
      { name: '2Y', dir: 'out', desc: 'Gate 2 output' },
      { name: '3A,3B', dir: 'in', desc: 'Gate 3 inputs' },
      { name: '3Y', dir: 'out', desc: 'Gate 3 output' },
      { name: '4A,4B', dir: 'in', desc: 'Gate 4 inputs' },
      { name: '4Y', dir: 'out', desc: 'Gate 4 output' },
      { name: 'VCC', dir: 'pwr', desc: 'Pin 14: +5V' },
      { name: 'GND', dir: 'pwr', desc: 'Pin 7: Ground' }
    ],
    truth: { heads: ['A','B','Y'], rows: [[0,0,0],[0,1,1],[1,0,1],[1,1,1]] },
    how: [
      'Each gate: Y = A OR B.',
      'Used to merge multiple request/interrupt lines into a single signal.',
      'OR combines conditions: HALT = UserHalt OR ErrorHalt.',
      'Wired-OR is also possible with open-collector gates + pull-up resistor.'
    ],
    example: 'Combine multiple error flags with OR: any error sets the master error signal.',
    realworld: 'The 74LS32 is used in the SAP-1 for combining control signals and building conditional logic.'
  };

  DS['74LS86'] = {
    name: '74LS86 — Quad XOR Gate', category: 'ic', badge: '74LS IC',
    summary: 'Four independent 2-input XOR gates in a 14-pin DIP package.',
    what: 'The 74LS86 contains four 2-input XOR gates. Each outputs HIGH when its inputs differ.',
    analogy: 'Four "difference detectors." Each lights up when the two inputs disagree.',
    pins: [
      { name: '1A,1B', dir: 'in', desc: 'Gate 1 inputs' },
      { name: '1Y', dir: 'out', desc: 'Gate 1 output: 1A XOR 1B' },
      { name: '2A,2B', dir: 'in', desc: 'Gate 2 inputs' },
      { name: '2Y', dir: 'out', desc: 'Gate 2 output' },
      { name: '3A,3B', dir: 'in', desc: 'Gate 3 inputs' },
      { name: '3Y', dir: 'out', desc: 'Gate 3 output' },
      { name: '4A,4B', dir: 'in', desc: 'Gate 4 inputs' },
      { name: '4Y', dir: 'out', desc: 'Gate 4 output' },
      { name: 'VCC', dir: 'pwr', desc: 'Pin 14: +5V' },
      { name: 'GND', dir: 'pwr', desc: 'Pin 7: Ground' }
    ],
    truth: { heads: ['A','B','Y'], rows: [[0,0,0],[0,1,1],[1,0,1],[1,1,0]] },
    how: [
      'Each gate: Y = A XOR B.',
      '<strong>Controllable inverter:</strong> XOR(A, 0) = A (pass). XOR(A, 1) = NOT A (invert).',
      'This trick is used in the ALU for subtraction: XOR each B bit with the SUB signal, then add with Cin=SUB.',
      'Parity generation: XOR all 8 bits to get even parity.'
    ],
    example: 'Build a 4-bit adder/subtractor: XOR each B input with a SUB control signal, feed into a 74LS283 adder, connect SUB to Cin.',
    realworld: 'The 74LS86 is critical in ALU design. Ben Eater uses it to implement subtraction via two\'s complement: invert B bits with XOR and set Cin=1.'
  };

  DS['74LS138'] = {
    name: '74LS138 — 3-to-8 Decoder', category: 'ic', badge: '74LS IC',
    summary: 'Decodes a 3-bit address into one of eight active-LOW outputs. The instruction decoder of the SAP-1.',
    what: 'The 74LS138 is a 3-to-8 line decoder with three enable inputs (G1 active-HIGH, /G2A and /G2B active-LOW). It decodes a 3-bit binary input (A, B, C) into eight active-LOW outputs (Y0-Y7). Only one output is LOW at a time.',
    analogy: 'Like an office building elevator: press floor number 0-7 (3-bit binary) and the elevator goes to exactly that floor. The enable pins are like the "door close" button.',
    pins: [
      { name: 'A,B,C', dir: 'in', desc: '3-bit address input' },
      { name: 'G1', dir: 'in', desc: 'Enable (active HIGH)' },
      { name: '/G2A,/G2B', dir: 'in', desc: 'Enables (active LOW)' },
      { name: 'Y0-Y7', dir: 'out', desc: '8 outputs (active LOW, one-hot)' },
      { name: 'VCC', dir: 'pwr', desc: 'Pin 16: +5V' },
      { name: 'GND', dir: 'pwr', desc: 'Pin 8: Ground' }
    ],
    truth: { heads: ['G1','/G2','C','B','A','Active Output'], rows: [
      [0,'X','X','X','X','None (all HIGH)'],
      ['X',1,'X','X','X','None (all HIGH)'],
      [1,0,0,0,0,'/Y0 goes LOW'],
      [1,0,0,0,1,'/Y1 goes LOW'],
      [1,0,0,1,0,'/Y2 goes LOW'],
      [1,0,1,0,0,'/Y4 goes LOW'],
      [1,0,1,1,1,'/Y7 goes LOW']
    ]},
    how: [
      'Enable conditions: G1=1 AND /G2A=0 AND /G2B=0.',
      'When enabled, the 3-bit input selects which output goes LOW.',
      'All other outputs remain HIGH (active-LOW logic).',
      '<strong>Instruction decoding:</strong> Feed the opcode bits from the IR into A,B,C. Each Y output corresponds to one instruction.',
      'Cascade two 74LS138s to decode 4 bits (16 outputs): use a 4th address bit to enable one chip and disable the other.'
    ],
    example: 'Connect the 3 MSBs of the opcode to A,B,C. Y0 activates for opcode 000 (NOP), Y1 for 001 (LDA), etc.',
    realworld: 'Ben Eater uses the 74LS138 to decode instructions in the SAP-1 control logic. It\'s one of the most important chips in CPU design.'
  };

  DS['74LS173'] = {
    name: '74LS173 — 4-Bit D Register', category: 'ic', badge: '74LS IC',
    summary: 'Four-bit D-type register with tri-state outputs. Edge-triggered with clear.',
    what: 'The 74LS173 is a 4-bit D register with tri-state outputs. On the rising clock edge (when data enable inputs are LOW), it captures the 4 data inputs. The outputs can be enabled or put in high-impedance state.',
    analogy: 'Like a 4-bit camera with a privacy shutter. It takes a snapshot (captures data) on the clock edge, and the shutter (output enable) controls whether others can see the photo.',
    pins: [
      { name: 'D1-D4', dir: 'in', desc: '4-bit data input' },
      { name: 'CLK', dir: 'in', desc: 'Clock (captures on rising edge)' },
      { name: '/G1,/G2', dir: 'in', desc: 'Data enable (active LOW, both must be LOW)' },
      { name: '/OE1,/OE2', dir: 'in', desc: 'Output enable (active LOW)' },
      { name: 'CLR', dir: 'in', desc: 'Clear (active HIGH, resets all to 0)' },
      { name: 'Q1-Q4', dir: 'out', desc: '4-bit output (tri-state)' },
      { name: 'VCC', dir: 'pwr', desc: 'Pin 16: +5V' },
      { name: 'GND', dir: 'pwr', desc: 'Pin 8: Ground' }
    ],
    truth: null,
    how: [
      'Rising CLK edge + /G1=/G2=0: D1-D4 captured into the register.',
      '/OE1=/OE2=0: Outputs Q1-Q4 drive the bus with stored values.',
      '/OE1 or /OE2=1: Outputs go to high-impedance (disconnected from bus).',
      'CLR=1: All outputs reset to 0 regardless of clock.',
      'Two 74LS173s side by side = an 8-bit register (share CLK, /G, /OE, CLR signals).'
    ],
    example: 'Build an 8-bit register using two 74LS173s. Connect them to the data bus with output enable controlled by the control logic.',
    realworld: 'Ben Eater uses two 74LS173s to build each 8-bit register (A, B) in the SAP-1. The /OE pins connect to the output-enable control signal; /G pins connect to the load control signal.'
  };

  DS['74LS245'] = {
    name: '74LS245 — Octal Bus Transceiver', category: 'ic', badge: '74LS IC',
    summary: 'Bidirectional 8-bit bus driver with direction control and output enable.',
    what: 'The 74LS245 is an 8-bit bidirectional bus transceiver. It can drive data in either direction (A-to-B or B-to-A) controlled by a direction pin (DIR). An output enable (/OE) pin puts all outputs in high-impedance. Essential for connecting devices to a shared bus.',
    analogy: 'Like a two-way toll bridge with a traffic cop. The cop (DIR) decides which direction cars flow. The gate (/OE) can close the bridge entirely. 8 lanes (bits) of traffic.',
    pins: [
      { name: 'A1-A8', dir: 'in', desc: 'Side A (8 bits)' },
      { name: 'B1-B8', dir: 'out', desc: 'Side B (8 bits)' },
      { name: 'DIR', dir: 'in', desc: 'Direction: 1=A-to-B, 0=B-to-A' },
      { name: '/OE', dir: 'in', desc: 'Output enable (active LOW)' },
      { name: 'VCC', dir: 'pwr', desc: 'Pin 20: +5V' },
      { name: 'GND', dir: 'pwr', desc: 'Pin 10: Ground' }
    ],
    truth: { heads: ['/OE','DIR','Data Flow'], rows: [
      [1,'X','All Hi-Z (disabled)'],
      [0,1,'A -> B'],
      [0,0,'B -> A']
    ]},
    how: [
      '/OE=0, DIR=1: Data flows from A side to B side. A inputs, B outputs.',
      '/OE=0, DIR=0: Data flows from B side to A side. B inputs, A outputs.',
      '/OE=1: All outputs on both sides go to high-impedance. The transceiver is invisible on the bus.',
      'This is how registers connect to the shared data bus: each register has a 74LS245 as its bus interface.',
      'Only ONE device should be driving the bus at a time to avoid contention.'
    ],
    example: 'Connect register A\'s output through a 74LS245 to the data bus. Set DIR=1 (A-to-bus) and enable /OE only when the AO (A Out) control signal is active.',
    realworld: 'The 74LS245 is essential in Ben Eater\'s SAP-1 for bus interfacing. Every register that outputs to the data bus uses one. It\'s also used in vintage computer bus systems (ISA, etc.).'
  };

  DS['74LS283'] = {
    name: '74LS283 — 4-Bit Binary Adder', category: 'ic', badge: '74LS IC',
    summary: 'Adds two 4-bit numbers with carry in/out. The ALU\'s adder chip.',
    what: 'The 74LS283 is a 4-bit binary full adder. It takes two 4-bit inputs (A1-A4, B1-B4) and a carry input (C0), and produces a 4-bit sum (S1-S4) and a carry output (C4). Two chips cascaded give 8-bit addition.',
    analogy: 'Like four accountants sitting in a row, each adding one digit and passing the carry to the next person. Together they can add numbers up to 15+15.',
    pins: [
      { name: 'A1-A4', dir: 'in', desc: '4-bit input A' },
      { name: 'B1-B4', dir: 'in', desc: '4-bit input B' },
      { name: 'C0', dir: 'in', desc: 'Carry input' },
      { name: 'S1-S4', dir: 'out', desc: '4-bit sum output' },
      { name: 'C4', dir: 'out', desc: 'Carry output' },
      { name: 'VCC', dir: 'pwr', desc: 'Pin 16: +5V' },
      { name: 'GND', dir: 'pwr', desc: 'Pin 8: Ground' }
    ],
    truth: null,
    how: [
      'S = A + B + C0 (binary addition).',
      'C4 = 1 when the sum overflows 4 bits (result > 15).',
      '<strong>Subtraction:</strong> XOR each B input with a SUB signal (using 74LS86), set C0=SUB. This computes A + (~B) + 1 = A - B (two\'s complement).',
      '<strong>8-bit addition:</strong> Cascade two 74LS283s. Connect C4 of the low adder to C0 of the high adder.',
      'The propagation delay increases with bit width (ripple carry). For speed-critical designs, carry-lookahead adders are used.'
    ],
    example: 'Build the SAP-1 ALU: connect register A to A1-A4 and register B (XORed with SUB) to B1-B4. The sum output goes to the data bus through a tri-state buffer.',
    realworld: 'Ben Eater uses two 74LS283s for the 8-bit ALU in the SAP-1. Combined with 74LS86 XOR gates for subtraction. This is the chip that actually computes ADD and SUB.'
  };

  DS['74LS161'] = {
    name: '74LS161 — Synchronous 4-Bit Counter', category: 'ic', badge: '74LS IC',
    summary: 'Synchronous 4-bit binary counter with parallel load, enable, and clear.',
    what: 'The 74LS161 is a synchronous 4-bit binary counter. It can count up, parallel-load a value (for JMP), and be cleared. All operations are synchronized to the clock edge, unlike ripple counters which have cascading delays.',
    analogy: 'Like a digital odometer that can: count up one step, be set to any number (parallel load for JMP), or be reset to zero (clear). All changes happen in sync with a master beat (clock).',
    pins: [
      { name: 'CLK', dir: 'in', desc: 'Clock (all operations on rising edge)' },
      { name: '/CLR', dir: 'in', desc: 'Clear (active LOW, async reset to 0)' },
      { name: '/LOAD', dir: 'in', desc: 'Parallel load (active LOW)' },
      { name: 'ENP', dir: 'in', desc: 'Count enable P' },
      { name: 'ENT', dir: 'in', desc: 'Count enable T' },
      { name: 'A-D', dir: 'in', desc: 'Parallel data inputs (for load)' },
      { name: 'QA-QD', dir: 'out', desc: '4-bit counter output' },
      { name: 'RCO', dir: 'out', desc: 'Ripple carry out (for cascading)' },
      { name: 'VCC', dir: 'pwr', desc: 'Pin 16: +5V' },
      { name: 'GND', dir: 'pwr', desc: 'Pin 8: Ground' }
    ],
    truth: null,
    how: [
      '/CLR=0: Counter resets to 0 (asynchronous, immediate).',
      '/LOAD=0 on CLK edge: Counter loads A-D inputs (parallel load).',
      'ENP=1 AND ENT=1 on CLK edge: Counter increments by 1.',
      'RCO goes HIGH when count = 15 AND ENT=1 (used for cascading).',
      '<strong>Program Counter:</strong> Normally counts up (CE signal). JMP instruction activates /LOAD to set a new address.',
      'Two 74LS161s cascaded = 8-bit counter (connect RCO to ENT of the next chip).'
    ],
    example: 'Build the SAP-1 program counter: connect CLK, use CE (counter enable) for ENP/ENT, and the jump control signal for /LOAD. Data bus connects to A-D for JMP.',
    realworld: 'Ben Eater uses two 74LS161s for the 8-bit program counter and also for the micro-step counter (T-state counter) in the SAP-1 control logic.'
  };

  DS['555'] = {
    name: '555 Timer', category: 'ic', badge: 'IC',
    summary: 'Versatile timer IC. Generates clock pulses, one-shots, and PWM signals.',
    what: 'The 555 timer is one of the most popular ICs ever made. It can operate in three modes: astable (free-running clock), monostable (one-shot pulse), and bistable (flip-flop). In the SAP-1, it generates the master clock signal.',
    analogy: 'The 555 is like a metronome. In astable mode, it ticks at a steady beat. In monostable mode, it plays one tick when triggered. The timing is set by external resistors and capacitors.',
    pins: [
      { name: 'VCC', dir: 'pwr', desc: 'Pin 8: +5V supply' },
      { name: 'GND', dir: 'pwr', desc: 'Pin 1: Ground' },
      { name: 'TRIG', dir: 'in', desc: 'Pin 2: Trigger (starts cycle when < 1/3 VCC)' },
      { name: 'THR', dir: 'in', desc: 'Pin 6: Threshold (resets when > 2/3 VCC)' },
      { name: 'RST', dir: 'in', desc: 'Pin 4: Reset (active LOW)' },
      { name: 'CTRL', dir: 'in', desc: 'Pin 5: Control voltage (modulates threshold)' },
      { name: 'DISCH', dir: 'out', desc: 'Pin 7: Discharge (open collector, for RC timing)' },
      { name: 'OUT', dir: 'out', desc: 'Pin 3: Output (square wave or pulse)' }
    ],
    truth: null,
    how: [
      '<strong>Astable mode:</strong> Free-running oscillator. Frequency = 1.44 / ((R1 + 2*R2) * C). Generates the clock signal.',
      '<strong>Monostable mode:</strong> One-shot. A trigger pulse produces a single output pulse of width T = 1.1 * R * C.',
      '<strong>Bistable mode:</strong> Trigger sets output HIGH, reset pulls it LOW. Simple flip-flop.',
      'Internally: two comparators, an SR flip-flop, and a discharge transistor.',
      'The 555 compares the capacitor voltage against 1/3 VCC and 2/3 VCC thresholds.'
    ],
    example: 'Build the SAP-1 clock module: 555 in astable mode with a potentiometer to adjust speed, plus a manual pulse button and auto/manual selector.',
    realworld: 'Ben Eater\'s clock module uses the 555 timer. Over 1 billion 555s are sold per year. Designed by Hans Camenzind in 1971 for Signetics. Still in production after 50+ years.'
  };

  // ─── SIGNAL REFERENCE TABLE ──────────────────────────────────────

  DS['SignalRef'] = {
    name: 'Control Signal Reference', category: 'cpu', badge: 'REFERENCE',
    summary: 'Complete table of all control signals, which component they connect to, and what they do.',
    what: 'Each control signal is a dedicated wire from the Control Unit to one specific component. When the signal goes HIGH, the component performs its action. "IN" signals make a component READ from the bus. "OUT" signals make a component WRITE to the bus. "Internal" signals trigger actions inside a component without using the bus.',
    analogy: 'Think of each signal as a named switch. The Control Unit has 15 switches on its dashboard. At each T-state, it flips the right combination of switches. Only ONE "OUT" switch can be on at a time (one talker), but multiple "IN" switches can be on (many listeners).',
    pins: [
      { name: 'CO',  dir: 'OUT',      desc: 'Counter Out — PC puts its address value onto the ADDRESS BUS' },
      { name: 'CE',  dir: 'Internal', desc: 'Counter Enable — PC increments by 1 (does not use the bus)' },
      { name: 'MI',  dir: 'IN',       desc: 'MAR In — MAR reads an address from the ADDRESS BUS' },
      { name: 'RO',  dir: 'OUT',      desc: 'RAM Out — RAM puts the byte at the current address onto the DATA BUS' },
      { name: 'RI',  dir: 'IN',       desc: 'RAM In — RAM writes the value from the DATA BUS into the current address' },
      { name: 'II',  dir: 'IN',       desc: 'IR In — Instruction Register reads a byte from the DATA BUS' },
      { name: 'IO',  dir: 'OUT',      desc: 'IR Out — IR puts its operand (lower 4 bits) onto the ADDRESS BUS' },
      { name: 'AI',  dir: 'IN',       desc: 'A In — Register A reads a value from the DATA BUS' },
      { name: 'AO',  dir: 'OUT',      desc: 'A Out — Register A puts its value onto the DATA BUS' },
      { name: 'BI',  dir: 'IN',       desc: 'B In — Register B reads a value from the DATA BUS' },
      { name: 'EO',  dir: 'OUT',      desc: 'ALU Out — ALU puts its computed result onto the DATA BUS' },
      { name: 'SU',  dir: 'Internal', desc: 'Subtract — ALU performs subtraction instead of addition' },
      { name: 'OI',  dir: 'IN',       desc: 'Output In — Output display reads a value from the DATA BUS' },
      { name: 'FI',  dir: 'Internal', desc: 'Flags In — Flags register captures Carry and Zero from ALU' },
      { name: 'HLT', dir: 'Internal', desc: 'Halt — Stops the clock, ending program execution' },
    ],
    how: '<strong>Signal-to-Component Map:</strong><br><br>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px;font-family:monospace">' +
      '<tr style="border-bottom:1px solid #333"><th style="text-align:left;padding:4px">Component</th><th style="text-align:left;padding:4px">IN (read)</th><th style="text-align:left;padding:4px">OUT (write)</th><th style="text-align:left;padding:4px">Internal</th><th style="text-align:left;padding:4px">Direct Wires</th></tr>' +
      '<tr style="border-bottom:1px solid #222"><td style="padding:4px;color:#00ddff">PC</td><td style="padding:4px">—</td><td style="padding:4px;color:#ffcc44">CO</td><td style="padding:4px">CE</td><td style="padding:4px">—</td></tr>' +
      '<tr style="border-bottom:1px solid #222"><td style="padding:4px;color:#00cc88">MAR</td><td style="padding:4px;color:#44ddff">MI</td><td style="padding:4px">—</td><td style="padding:4px">—</td><td style="padding:4px;color:#00cc88">→ RAM addr (4 lines)</td></tr>' +
      '<tr style="border-bottom:1px solid #222"><td style="padding:4px;color:#44bb66">RAM</td><td style="padding:4px;color:#44ddff">RI</td><td style="padding:4px;color:#ffcc44">RO</td><td style="padding:4px">—</td><td style="padding:4px;color:#00cc88">← MAR addr (4 lines)</td></tr>' +
      '<tr style="border-bottom:1px solid #222"><td style="padding:4px;color:#bb66ff">IR</td><td style="padding:4px;color:#44ddff">II</td><td style="padding:4px;color:#ffcc44">IO</td><td style="padding:4px">—</td><td style="padding:4px">—</td></tr>' +
      '<tr style="border-bottom:1px solid #222"><td style="padding:4px;color:#4488ff">Reg A</td><td style="padding:4px;color:#44ddff">AI</td><td style="padding:4px;color:#ffcc44">AO</td><td style="padding:4px">—</td><td style="padding:4px;color:#4488ff">→ ALU input A (8 lines)</td></tr>' +
      '<tr style="border-bottom:1px solid #222"><td style="padding:4px;color:#2266cc">Reg B</td><td style="padding:4px;color:#44ddff">BI</td><td style="padding:4px">—</td><td style="padding:4px">—</td><td style="padding:4px;color:#2266cc">→ ALU input B (8 lines)</td></tr>' +
      '<tr style="border-bottom:1px solid #222"><td style="padding:4px;color:#ff8844">ALU</td><td style="padding:4px">—</td><td style="padding:4px;color:#ffcc44">EO</td><td style="padding:4px">SU, FI</td><td style="padding:4px;color:#ff8844">← A(8) + B(8) inputs</td></tr>' +
      '<tr><td style="padding:4px;color:#ffcc00">Output</td><td style="padding:4px;color:#44ddff">OI</td><td style="padding:4px">—</td><td style="padding:4px">—</td><td style="padding:4px">—</td></tr>' +
      '</table>' +
      '<br><strong>Microcode (what fires when):</strong><br><br>' +
      '<table style="width:100%;border-collapse:collapse;font-size:11px;font-family:monospace">' +
      '<tr style="border-bottom:1px solid #333"><th style="text-align:left;padding:3px">Step</th><th style="text-align:left;padding:3px">T0</th><th style="text-align:left;padding:3px">T1</th><th style="text-align:left;padding:3px">T2</th><th style="text-align:left;padding:3px">T3</th><th style="text-align:left;padding:3px">T4</th></tr>' +
      '<tr style="border-bottom:1px solid #222"><td style="padding:3px">FETCH</td><td style="padding:3px;color:#ff4444">CO MI</td><td style="padding:3px;color:#ff4444">RO II CE</td><td style="padding:3px">—</td><td style="padding:3px">—</td><td style="padding:3px">—</td></tr>' +
      '<tr style="border-bottom:1px solid #222"><td style="padding:3px">LDA</td><td style="padding:3px">"</td><td style="padding:3px">"</td><td style="padding:3px;color:#ff4444">IO MI</td><td style="padding:3px;color:#ff4444">RO AI</td><td style="padding:3px">—</td></tr>' +
      '<tr style="border-bottom:1px solid #222"><td style="padding:3px">ADD</td><td style="padding:3px">"</td><td style="padding:3px">"</td><td style="padding:3px;color:#ff4444">IO MI</td><td style="padding:3px;color:#ff4444">RO BI</td><td style="padding:3px;color:#ff4444">EO AI FI</td></tr>' +
      '<tr style="border-bottom:1px solid #222"><td style="padding:3px">SUB</td><td style="padding:3px">"</td><td style="padding:3px">"</td><td style="padding:3px;color:#ff4444">IO MI</td><td style="padding:3px;color:#ff4444">RO BI</td><td style="padding:3px;color:#ff4444">EO AI SU FI</td></tr>' +
      '<tr style="border-bottom:1px solid #222"><td style="padding:3px">OUT</td><td style="padding:3px">"</td><td style="padding:3px">"</td><td style="padding:3px;color:#ff4444">AO OI</td><td style="padding:3px">—</td><td style="padding:3px">—</td></tr>' +
      '<tr><td style="padding:3px">HLT</td><td style="padding:3px">"</td><td style="padding:3px">"</td><td style="padding:3px;color:#ff4444">HLT</td><td style="padding:3px">—</td><td style="padding:3px">—</td></tr>' +
      '</table>' +
      '<br><strong>Rules:</strong><br>' +
      '• Only ONE "OUT" signal active at a time (one component talks)<br>' +
      '• Multiple "IN" signals can be active (many components listen)<br>' +
      '• T0 + T1 are always FETCH (same for every instruction)<br>' +
      '• T2+ are EXECUTE (different per opcode)',
    tryIt: 'In Watch mode, observe which signals light up red at each T-state. In Build mode, use this table to wire your Control Unit correctly.',
    realWorld: 'Ben Eater implements this table as two 28C16 EEPROMs. Each EEPROM stores the control word for every combination of opcode + T-state + flags. This table IS the Control Unit.',
  };

  // ─── CPU COMPONENTS ─────────────────────────────────────────────

  DS['Clock'] = {
    name: 'Clock Generator', category: 'cpu', badge: 'CPU Module',
    summary: 'Generates the master CLK signal that synchronizes all CPU operations.',
    what: 'The clock generator produces a periodic square wave that drives the entire CPU. Every micro-step of every instruction happens on a clock edge. The clock is the heartbeat of the processor.',
    analogy: 'The clock is like a conductor\'s baton in an orchestra. Every musician (component) waits for the beat (clock edge) before playing their note (transferring data). Without the conductor, chaos.',
    pins: [
      { name: 'CLK', dir: 'out', desc: 'Clock output (square wave)' }
    ],
    truth: null,
    how: [
      'Outputs alternating HIGH and LOW signals at a configurable frequency.',
      'In this simulator, "Pulse CLK" sends one rising edge followed by a falling edge.',
      '"Auto-Run" continuously pulses the clock at the speed set by the slider.',
      'All edge-triggered components (registers, counters, flip-flops) respond to the <strong>rising edge</strong> of CLK.',
      'The clock determines the CPU\'s speed. Faster clock = more instructions per second (up to the propagation delay limit).'
    ],
    example: 'Connect the CLK output to every register, the PC, and the control logic. Pulse the clock and watch data move through the CPU.',
    realworld: 'Ben Eater\'s clock module uses a 555 timer in astable mode. Real CPUs use crystal oscillators for precise timing. A modern CPU clocks at 3-5 GHz (billions of cycles per second).'
  };

  DS['Register'] = {
    name: '8-Bit Register', category: 'cpu', badge: 'CPU Module',
    summary: 'Stores an 8-bit value. Loads from the bus on clock edge when LOAD is active. Drives the bus when ENABLE is active.',
    what: 'An 8-bit register is the fundamental storage unit in a CPU. It captures 8 bits from the data bus when the LOAD signal is active during a clock edge, and outputs its stored value to the bus when ENABLE is active. The A and B registers in the SAP-1 are both 8-bit registers.',
    analogy: 'A register is like a clipboard. You can write a value on it (LOAD), read what\'s written (ENABLE), and it holds the value until you write something new. Each register is an actor in the CPU play, holding their cue card.',
    pins: [
      { name: 'D', dir: 'in', desc: '8-bit data input (from bus)' },
      { name: 'CLK', dir: 'in', desc: 'Clock (captures on rising edge)' },
      { name: 'LOAD', dir: 'in', desc: 'Load enable (1 = capture D on clock)' },
      { name: 'ENABLE', dir: 'in', desc: 'Output enable (1 = drive Q onto bus)' },
      { name: 'Q', dir: 'out', desc: '8-bit stored value output' }
    ],
    truth: null,
    how: [
      'Rising CLK edge + LOAD=1: Register captures the value on D.',
      'ENABLE=1: Q outputs the stored value (drives the bus).',
      'ENABLE=0: Q is 0 (simulating Hi-Z / disconnected from bus).',
      'The register holds its value indefinitely until the next LOAD+CLK edge.',
      '<strong>Built from:</strong> Two 74LS173 (4-bit D register) ICs for the latch, plus a 74LS245 for tri-state bus output.'
    ],
    example: 'Wire D to the data bus, CLK to the system clock, LOAD to the AI control signal, and ENABLE to the AO control signal. Now you have register A.',
    realworld: 'Ben Eater builds each register from two 74LS173 ICs (for storage) and one 74LS245 (for bus output). The SAP-1 has registers: A (accumulator), B (operand), IR (instruction), and OUT (display).'
  };

  DS['Bus'] = {
    name: '8-Bit Data Bus', category: 'cpu', badge: 'CPU Module',
    summary: 'Shared 8-bit communication highway connecting all CPU components.',
    what: 'The data bus is a set of 8 shared wires that connect all major components (registers, ALU, RAM, etc.). Only one device may drive (output to) the bus at a time; all others listen. This shared architecture is what makes the CPU work with minimal wiring.',
    analogy: 'The bus is like a single-lane highway that all buildings (components) are connected to. Only one car (data value) can be on the road at a time. Traffic signals (control logic) determine who gets to drive.',
    pins: [
      { name: 'IN0-IN3', dir: 'in', desc: 'Up to 4 input sources' },
      { name: 'OUT0-OUT3', dir: 'out', desc: 'Up to 4 output destinations' }
    ],
    truth: null,
    how: [
      'The bus carries whatever value is currently being driven onto it.',
      'Only ONE input should be active at a time. If multiple inputs drive different values, <strong>bus contention</strong> occurs (dangerous in real hardware).',
      'All outputs reflect the current bus value simultaneously.',
      'Tri-state buffers (74LS245) control who drives the bus. The control logic ensures only one driver at a time.',
      'The bus value changes within a single clock cycle -- data is loaded from the bus by the destination on the clock edge.'
    ],
    example: 'Connect the ALU output, register A output, register B output, and RAM output to bus inputs. Connect register A input, register B input, and RAM input to bus outputs.',
    realworld: 'Ben Eater\'s SAP-1 uses a single shared 8-bit bus with LEDs so you can see the current value. Real CPUs may have separate instruction and data buses (Harvard architecture) or unified (Von Neumann).'
  };

  DS['ALU'] = {
    name: 'ALU (Arithmetic Logic Unit)', category: 'cpu', badge: 'CPU Module',
    summary: 'Performs addition and subtraction on 8-bit values. Sets carry and zero flags.',
    what: 'The ALU is the computational engine of the CPU. It takes two 8-bit inputs (A and B) and performs arithmetic (add or subtract). The result goes to the bus, and status flags (Carry, Zero) indicate overflow and zero results.',
    analogy: 'The ALU is the calculator of the CPU. It\'s a single-purpose worker who can only add or subtract, but does it incredibly fast and reliably. The flags are like warning lights on the calculator.',
    pins: [
      { name: 'A', dir: 'in', desc: '8-bit input from register A' },
      { name: 'B', dir: 'in', desc: '8-bit input from register B' },
      { name: 'SUB', dir: 'in', desc: 'Subtract mode (0=add, 1=subtract)' },
      { name: 'CLK', dir: 'in', desc: 'Clock' },
      { name: 'OUT', dir: 'out', desc: '8-bit result' },
      { name: 'CF', dir: 'out', desc: 'Carry flag (overflow in add, borrow in sub)' },
      { name: 'ZF', dir: 'out', desc: 'Zero flag (1 if result is 0)' }
    ],
    truth: null,
    how: [
      'SUB=0: OUT = A + B. CF=1 if result > 255.',
      'SUB=1: OUT = A - B. CF=1 if A >= B (no borrow).',
      'ZF=1 when the result is exactly 0.',
      '<strong>Internally:</strong> Two 74LS283 adders (8-bit) + 74LS86 XOR gates for two\'s complement subtraction.',
      'The flags register (74LS173) captures CF and ZF on the FI control signal, used by conditional jumps (JC, JZ).',
      'The extended SAP-1 adds AND, OR, XOR, SHL, SHR operations.'
    ],
    example: 'Load A=7, B=3. With SUB=0, OUT=10, CF=0, ZF=0. With SUB=1, OUT=4, CF=1, ZF=0.',
    realworld: 'The SAP-1 ALU is built from 74LS283 adders + 74LS86 XOR gates. Modern ALUs support dozens of operations and use carry-lookahead for speed.'
  };

  DS['RAM'] = {
    name: 'RAM (256 x 8-bit)', category: 'cpu', badge: 'CPU Module',
    summary: '256-byte random access memory. Stores both program code and data.',
    what: 'RAM (Random Access Memory) stores 256 bytes, each 8 bits wide. Any address (0x00-0xFF) can be read or written in one clock cycle. In the SAP-1, RAM holds both the program (instructions) and data in a Von Neumann architecture.',
    analogy: 'RAM is like a wall of 256 numbered mailboxes. You specify a box number (address), and you can either read the mail inside or put new mail in. Access time is the same for any box.',
    pins: [
      { name: 'ADDR', dir: 'in', desc: '8-bit address input (selects which byte)' },
      { name: 'DIN', dir: 'in', desc: '8-bit data input (for writing)' },
      { name: 'WR', dir: 'in', desc: 'Write enable (1 = write DIN to ADDR)' },
      { name: 'RD', dir: 'in', desc: 'Read enable (1 = output RAM[ADDR])' },
      { name: 'CLK', dir: 'in', desc: 'Clock (writes on rising edge)' },
      { name: 'DOUT', dir: 'out', desc: '8-bit data output' }
    ],
    truth: null,
    how: [
      'RD=1: DOUT = RAM[ADDR] (read operation, combinational).',
      'WR=1 + rising CLK: RAM[ADDR] = DIN (write operation, clocked).',
      'The MAR holds the current address; the bus carries data in/out.',
      '<strong>Von Neumann:</strong> Instructions and data share the same memory space.',
      'Address 0x00-0xEF: general use. 0xF0: interrupt vector. Stack grows down from 0xFF.',
      'In this simulator, RAM is initialized to 0. Use the assembler to load programs.'
    ],
    example: 'Load a program at 0x00, data at 0x80, and stack at 0xFF. The PC reads instructions from the low addresses while data is stored in the upper range.',
    realworld: 'Ben Eater uses two 74LS189 (16x4 RAM) chips for 16 bytes in the original SAP-1. This extended version uses 256 bytes. Modern RAM is measured in gigabytes.'
  };

  DS['PC'] = {
    name: 'Program Counter (PC)', category: 'cpu', badge: 'CPU Module',
    summary: '8-bit counter that holds the address of the next instruction to execute.',
    what: 'The Program Counter keeps track of where the CPU is in the program. It normally increments by 1 after each instruction fetch (moving to the next instruction). Jump instructions (JMP, JC, JZ) load a new address directly into the PC.',
    analogy: 'The PC is like a bookmark in a recipe book. After each step, you move the bookmark forward. A "JMP" instruction is like flipping to a completely different page.',
    pins: [
      { name: 'CLK', dir: 'in', desc: 'Clock' },
      { name: 'INC', dir: 'in', desc: 'Increment (CE signal: PC++)' },
      { name: 'LOAD', dir: 'in', desc: 'Load (J signal: PC = DIN, for jumps)' },
      { name: 'DIN', dir: 'in', desc: '8-bit jump target address' },
      { name: 'ENABLE', dir: 'in', desc: 'Output enable (CO signal)' },
      { name: 'RESET', dir: 'in', desc: 'Reset to 0' },
      { name: 'DOUT', dir: 'out', desc: '8-bit current address output' }
    ],
    truth: null,
    how: [
      'Each clock cycle with INC=1: PC = PC + 1 (advance to next byte).',
      'LOAD=1 on clock edge: PC = DIN (jump to target address).',
      'ENABLE=1: DOUT drives the address bus with the current PC value.',
      'RESET=1: PC resets to 0x00.',
      '<strong>Fetch cycle:</strong> T0: CO+MI (PC outputs to address bus, MAR captures). T1: RO+II+CE (RAM outputs instruction, IR captures, PC increments).',
      'Built from two 74LS161 synchronous counters cascaded for 8 bits.'
    ],
    example: 'Watch the PC count 0,1,2,3... during normal execution. Then execute a JMP 0x10 and see the PC jump to 16.',
    realworld: 'Ben Eater uses two 74LS161 4-bit counters for the 8-bit PC. The /LOAD pin is activated by the J control signal during jump instructions.'
  };

  DS['MAR'] = {
    name: 'MAR (Memory Address Register)', category: 'cpu', badge: 'CPU Module',
    summary: 'Holds the memory address currently being accessed. Feeds the address bus.',
    what: 'The Memory Address Register captures an address from the data bus and holds it steady on the address input of RAM. This allows the CPU to specify which memory location to read or write, independent of other bus traffic.',
    analogy: 'The MAR is like a GPS navigator that locks onto a destination. Once you tell it the address (load from bus), it keeps pointing there until you give it a new address. The RAM always reads from wherever MAR is pointing.',
    pins: [
      { name: 'DIN', dir: 'in', desc: '8-bit address from data bus' },
      { name: 'CLK', dir: 'in', desc: 'Clock' },
      { name: 'LOAD', dir: 'in', desc: 'Load enable (MI signal)' },
      { name: 'ADDR', dir: 'out', desc: '8-bit address output to RAM' }
    ],
    truth: null,
    how: [
      'Rising CLK + LOAD=1: MAR captures the value on DIN.',
      'ADDR continuously outputs the stored address to RAM.',
      '<strong>Fetch cycle T0:</strong> PC drives address bus, MI (MAR In) loads it into MAR.',
      'MAR then holds that address so RAM can output the byte at that location.',
      'For 2-byte instructions, MAR is loaded again at T2 with the operand address.',
      'Built from a 74LS173 (4-bit register) or similar latch.'
    ],
    example: 'During LDA 42: PC outputs the address of the operand (42), MAR captures it. RAM then outputs the byte at address 42.',
    realworld: 'In Ben Eater\'s SAP-1, the MAR is a 4-bit register (only 16 addresses). In this extended design, it is 8 bits (256 addresses).'
  };

  DS['IR'] = {
    name: 'IR (Instruction Register)', category: 'cpu', badge: 'CPU Module',
    summary: 'Holds the current instruction opcode. Feeds the control logic decoder.',
    what: 'The Instruction Register captures the opcode byte fetched from RAM. The control logic reads the IR to determine which instruction is being executed and generates the appropriate control signals for each micro-step.',
    analogy: 'The IR is like a task clipboard for the CPU boss. When a new instruction is fetched, it\'s clipped to the board. The boss (control logic) reads the clipboard to decide what everyone should do.',
    pins: [
      { name: 'DIN', dir: 'in', desc: '8-bit opcode from data bus' },
      { name: 'CLK', dir: 'in', desc: 'Clock' },
      { name: 'LOAD', dir: 'in', desc: 'Load enable (II signal)' },
      { name: 'ENABLE', dir: 'in', desc: 'Output enable' },
      { name: 'OPCODE', dir: 'out', desc: '8-bit opcode output to control logic' }
    ],
    truth: null,
    how: [
      'Fetch cycle T1: RAM outputs the instruction byte, II (IR In) loads it into the IR.',
      'The IR holds the opcode steady while the control logic generates micro-steps T2, T3, etc.',
      'OPCODE output feeds into a decoder (74LS138) that activates instruction-specific control lines.',
      'ENABLE controls whether the opcode drives the bus (rarely needed, mostly for internal use).',
      'In the original SAP-1, only the upper 4 bits are the opcode (16 instructions). In this extended design, the full byte is used (up to 256 instructions).'
    ],
    example: 'Execute LDA 42: At T1, the byte 0x01 (LDA opcode) is loaded into IR. The control logic sees 0x01 and generates the micro-steps for LDA.',
    realworld: 'Ben Eater builds the IR from two 74LS173 ICs. The upper nibble feeds a 74LS138 decoder for instruction decode.'
  };

  DS['Flags'] = {
    name: 'Flags Register', category: 'cpu', badge: 'CPU Module',
    summary: 'Stores the Carry Flag (CF) and Zero Flag (ZF) from the ALU for conditional jumps.',
    what: 'The flags register captures the status flags from the ALU result. CF (Carry Flag) indicates arithmetic overflow/borrow. ZF (Zero Flag) indicates a zero result. These flags are used by conditional jump instructions (JC, JZ) to make decisions.',
    analogy: 'The flags register is like a pair of warning lights on the ALU dashboard. CF lights up when the math overflows. ZF lights up when the answer is zero. The jump instructions check these lights before deciding whether to jump.',
    pins: [
      { name: 'CF_IN', dir: 'in', desc: 'Carry flag from ALU' },
      { name: 'ZF_IN', dir: 'in', desc: 'Zero flag from ALU' },
      { name: 'CLK', dir: 'in', desc: 'Clock' },
      { name: 'LOAD', dir: 'in', desc: 'Load enable (FI signal)' },
      { name: 'CF', dir: 'out', desc: 'Stored carry flag' },
      { name: 'ZF', dir: 'out', desc: 'Stored zero flag' }
    ],
    truth: null,
    how: [
      'Rising CLK + LOAD(FI)=1: CF_IN and ZF_IN are captured.',
      'CF and ZF are held until the next FI signal.',
      '<strong>JC (Jump if Carry):</strong> If CF=1, the PC loads the jump target.',
      '<strong>JZ (Jump if Zero):</strong> If ZF=1, the PC loads the jump target.',
      'The control logic ANDs the flag values with the instruction decode to conditionally enable the jump.',
      'Built from a 74LS173 or similar D-type register. Only 2 bits are used.'
    ],
    example: 'ADD two numbers that overflow 255. CF becomes 1. A subsequent JC instruction will take the jump. If the result is 0, ZF becomes 1 and JZ will jump.',
    realworld: 'Ben Eater uses a 74LS173 for the flags register. Real CPUs have many more flags: Sign, Overflow, Parity, Auxiliary Carry, etc. x86 has the EFLAGS register with 32+ flags.'
  };

  DS['Output'] = {
    name: 'Output Display', category: 'cpu', badge: 'CPU Module',
    summary: 'Captures a value from the bus and displays it. The CPU\'s visible output.',
    what: 'The output register captures a byte from the data bus (via the OUT instruction) and displays it in decimal. This is how the CPU communicates its results to the outside world.',
    analogy: 'The output display is like the CPU\'s scoreboard. After computing a result, the OUT instruction posts it to the scoreboard for everyone to see.',
    pins: [
      { name: 'DIN', dir: 'in', desc: '8-bit data from bus' },
      { name: 'CLK', dir: 'in', desc: 'Clock' },
      { name: 'LOAD', dir: 'in', desc: 'Load enable (OI signal)' }
    ],
    truth: null,
    how: [
      'Rising CLK + LOAD(OI)=1: The value on DIN is captured and displayed.',
      'The display shows the decimal value (0-255) and hex equivalent.',
      'The OUT instruction triggers OI (Output In) to load the display.',
      'In a real build, this drives 7-segment displays (typically 4 digits for unsigned decimal).',
      'The output register only takes input; it does not drive the bus.'
    ],
    example: 'Execute "LDI 42; OUT" -- the display shows 42. Execute a counting loop with OUT in the body to see the count.',
    realworld: 'Ben Eater builds the output display from a register + EEPROM decoder + four 7-segment displays. It can show unsigned, signed, or hex values depending on a mode switch.'
  };

  DS['Switch'] = {
    name: 'Control Switch', category: 'cpu', badge: 'CPU Module',
    summary: 'Manual 1-bit toggle switch. Double-click to flip between 0 and 1.',
    what: 'A simple single-pole single-throw (SPST) switch that outputs either 0 or 1. Double-click to toggle. Used as control signal inputs, test inputs, or manual data entry.',
    analogy: 'A plain old light switch. Flip it up (1) or down (0). That\'s it. Simple, reliable, essential.',
    pins: [
      { name: 'OUT', dir: 'out', desc: '1-bit output (0 or 1)' }
    ],
    truth: { heads: ['Switch','OUT'], rows: [['OFF',0],['ON',1]] },
    how: [
      'Double-click the switch component on the breadboard to toggle between 0 and 1.',
      'The output immediately changes (no clock needed).',
      'Use as a control signal: connect to LOAD, ENABLE, SUB, or any 1-bit control input.',
      'Use as a data input: connect to one bit of a register or gate input.'
    ],
    example: 'Connect a switch to the SUB input of the ALU. Toggle it to switch between addition and subtraction.',
    realworld: 'DIP switches on a breadboard provide manual input. Ben Eater uses toggle switches for manual data entry and for the clock auto/manual selector.'
  };

  DS['Const'] = {
    name: 'Constant Value Source', category: 'cpu', badge: 'CPU Module',
    summary: 'Outputs a fixed 8-bit value. Useful for testing and hardwired connections.',
    what: 'A constant source outputs a fixed 8-bit value (0-255) that never changes. Use it to provide fixed inputs like immediate values, addresses, or bit masks for testing circuits.',
    analogy: 'Like a label maker that always prints the same number. No matter when you read it, it says the same thing. Useful for "hardwiring" a value into your circuit.',
    pins: [
      { name: 'OUT', dir: 'out', desc: '8-bit constant output' }
    ],
    truth: null,
    how: [
      'Outputs a constant value at all times (default: 42).',
      'The value can be changed in the inspector panel.',
      'Connect to data inputs where a fixed value is needed.',
      'Useful for testing: provide known inputs and verify outputs.'
    ],
    example: 'Set the constant to 255 (0xFF) and connect to the B input of the ALU. Now the ALU always adds/subtracts 255.',
    realworld: 'In real circuits, constant values come from pull-up/pull-down resistors (0 or 1), DIP switches, or hardwired connections to VCC/GND.'
  };

  DS['CU'] = {
    name: 'Control Unit (CU)', category: 'cpu', badge: 'CPU Module',
    summary: 'Microcode EEPROM — decodes opcode and T-state into 15+ control signals.',
    what: 'The Control Unit is the brain of the CPU. It reads two things: the current opcode (from the Instruction Register) and the current T-state (micro-step counter). It then looks up a table and activates the exact set of control signals needed for that step. This table is called microcode — it is literally burned into an EEPROM chip in real hardware.',
    analogy: 'Imagine a player piano roll: the paper has holes punched at specific positions. As it advances, each hole lifts a different key. The Control Unit is that roll — each T-state position, each opcode row has different holes that "lift" different control signals.',
    pins: [
      { name: 'CLK',    dir: 'in',  desc: 'Clock input — advances the T-state counter' },
      { name: 'OPCODE', dir: 'in',  desc: '8-bit opcode from Instruction Register (upper 4 bits used)' },
      { name: 'CF',     dir: 'in',  desc: 'Carry Flag — used by JC conditional jump' },
      { name: 'ZF',     dir: 'in',  desc: 'Zero Flag — used by JZ conditional jump' },
      { name: 'RST',    dir: 'in',  desc: 'Reset — returns T-state to T0' },
      { name: 'CO',     dir: 'out', desc: 'Counter Out — tells PC to drive address bus' },
      { name: 'CE',     dir: 'out', desc: 'Counter Enable — tells PC to increment' },
      { name: 'MI',     dir: 'out', desc: 'MAR In — tells MAR to latch address bus' },
      { name: 'RO',     dir: 'out', desc: 'RAM Out — tells RAM to drive data bus' },
      { name: 'RI',     dir: 'out', desc: 'RAM In — tells RAM to write from data bus' },
      { name: 'II',     dir: 'out', desc: 'IR In — tells IR to latch from data bus' },
      { name: 'IO',     dir: 'out', desc: 'IR Out — tells IR to drive operand onto address bus' },
      { name: 'AI',     dir: 'out', desc: 'A In — tells Register A to latch from data bus' },
      { name: 'AO',     dir: 'out', desc: 'A Out — tells Register A to drive data bus' },
      { name: 'BI',     dir: 'out', desc: 'B In — tells Register B to latch from data bus' },
      { name: 'EO',     dir: 'out', desc: 'ALU Out — tells ALU to drive result onto data bus' },
      { name: 'SU',     dir: 'out', desc: 'Subtract — sets ALU to subtraction mode' },
      { name: 'OI',     dir: 'out', desc: 'Output In — tells Output Display to latch from data bus' },
      { name: 'FI',     dir: 'out', desc: 'Flags In — tells Flags Register to capture ALU flags' },
      { name: 'HLT',    dir: 'out', desc: 'Halt — stops the clock' },
      { name: 'J',      dir: 'out', desc: 'Jump — tells PC to load a new address from the bus' },
    ],
    truth: null,
    how: [
      '<strong>T-state cycle:</strong> On each rising clock edge, the CU advances to the next T-state (T0→T1→T2→T3→T4→T0...).',
      '<strong>Fetch is fixed:</strong> T0 is always CO+MI (PC drives address bus, MAR captures it). T1 is always RO+II+CE (RAM puts instruction on data bus, IR captures it, PC increments). These are the same for every instruction.',
      '<strong>Execute varies by opcode:</strong> T2, T3, T4 depend on which opcode IR holds. The CU looks up microcode[opcode][T-state] to get the control word.',
      '<strong>Conditional jumps:</strong> For JC (opcode 0x07) and JZ (opcode 0x08), the CU checks CF or ZF — if the flag is not set, the J signal is suppressed, so the PC does not change.',
      '<strong>HALT:</strong> When HLT fires, the CU stops advancing T-states. The only way out is a reset.',
      'In real hardware (Ben Eater\'s design), two 28C16A EEPROM chips store the microcode. The address fed to the EEPROM is: [opcode 4 bits | T-state 3 bits | CF 1 bit | ZF 1 bit].'
    ],
    example: 'To execute ADD: T0 CO+MI, T1 RO+II+CE, T2 IO+MI (operand address to MAR), T3 RO+BI (fetch B value), T4 EO+AI+FI (result into A, update flags).',
    realworld: '<strong>Real IC:</strong> Two 28C16A EEPROMs (2KB each). Each bit position in the stored byte corresponds to one control signal. The address pins are connected to the opcode, T-state counter, and flag bits.'
  };

  DS['AddrBus'] = {
    name: 'Address Bus', category: 'cpu', badge: 'CPU Module',
    summary: '4-bit shared highway for memory addresses — carries which location to access.',
    what: 'The Address Bus is a 4-bit (16 address) shared highway. It carries the memory address being accessed. Unlike the data bus (which carries values), the address bus always carries a location. It connects the Program Counter and Instruction Register (sources) to the MAR (destination). Only one thing should drive the address bus at a time.',
    analogy: 'Think of the address bus as the street address system in a city. When the CPU wants to access memory, it puts the house number (address) on the bus. The MAR is like a mailman who reads that address and walks to the right house (RAM location). The data bus then carries the letter (data) between the CPU and that house.',
    pins: [
      { name: 'P0_IN',  dir: 'in',  desc: 'Port 0 input — typically from PC (via CO signal)' },
      { name: 'P0_OUT', dir: 'out', desc: 'Port 0 output — broadcasts address to all connected components' },
      { name: 'P1_IN',  dir: 'in',  desc: 'Port 1 input — typically from IR operand (via IO signal)' },
      { name: 'P1_OUT', dir: 'out', desc: 'Port 1 output — broadcasts address to all connected components' },
      { name: 'P2_IN',  dir: 'in',  desc: 'Port 2 input — spare port for additional sources' },
      { name: 'P2_OUT', dir: 'out', desc: 'Port 2 output — broadcasts address to all connected components' },
    ],
    truth: null,
    how: [
      '<strong>One-to-many:</strong> Whichever port has a non-zero input drives all output ports simultaneously. Every connected component sees the same address.',
      '<strong>Only one driver at a time:</strong> Control signals ensure only CO (from PC) or IO (from IR) is active at any moment — never both.',
      '<strong>Contention alert:</strong> If two inputs are non-zero simultaneously, the bus shows CONTENTION in red. This is a wiring error — only one component should drive at a time.',
      '<strong>4-bit = 16 addresses:</strong> The 4-bit bus can carry addresses 0x0 through 0xF (0 to 15), matching the 16-byte RAM in the basic build mode CPU.',
      'During T0 (CO+MI): PC drives this bus. MAR reads it. Then T1, CO drops, II fires, and data flows on the separate data bus.'
    ],
    example: 'Wire the PC\'s DOUT to P0_IN, and the IR\'s OPERAND to P1_IN. Wire P0_OUT and P1_OUT to the MAR\'s DIN. Now both sources share the address bus correctly — the control unit ensures only one is active at a time.',
    realworld: 'In Ben Eater\'s computer, the address bus is literally 4 physical wires on the breadboard, one per bit. The MAR latches these 4 wires. No chip is needed — just traces or wires.'
  };

  // ════════════════════════════════════════════════════════════════════
  //  CATEGORIES & RENDERING
  // ════════════════════════════════════════════════════════════════════

  const CATEGORIES = [
    { id: 'power',   label: 'Power',              keys: ['VCC','GND','Battery'] },
    { id: 'passive', label: 'Passive Components',  keys: ['Resistor','Capacitor','Inductor'] },
    { id: 'gate',    label: 'Logic Gates',         keys: ['AND','OR','NOT','NAND','NOR','XOR','XNOR','Buffer'] },
    { id: 'comb',    label: 'Combinational Logic', keys: ['HalfAdder','FullAdder','Adder4','Dec2to4','Dec3to8','Enc8to3','PriEnc','Mux2to1','Mux4to1','Mux8to1','Demux1to2','Demux1to4'] },
    { id: 'seq',     label: 'Sequential Logic',    keys: ['SRLatch','DFF','JKFF','TFF','Counter4','ShiftReg'] },
    { id: 'semi',    label: 'Semiconductors',      keys: ['Diode','LED','NPN','PNP','NMOS','PMOS','NJFET','PJFET','SCR'] },
    { id: 'display', label: 'Displays',            keys: ['LEDBar','7Seg','7SegDec'] },
    { id: 'ic',      label: '74LS Series ICs',     keys: ['74LS00','74LS04','74LS08','74LS32','74LS86','74LS138','74LS173','74LS245','74LS283','74LS161','555'] },
    { id: 'cpu',     label: 'CPU Modules',         keys: ['SignalRef','Clock','CU','Register','Bus','AddrBus','ALU','RAM','PC','MAR','IR','Flags','Output','Switch','Const'] }
  ];

  const BADGE_CLASS = {
    power: 'ds-badge-power', passive: 'ds-badge-passive', gate: 'ds-badge-gate',
    comb: 'ds-badge-comb', seq: 'ds-badge-seq', semi: 'ds-badge-semi',
    display: 'ds-badge-display', ic: 'ds-badge-ic', cpu: 'ds-badge-cpu'
  };

  // ────────────────────────────────────────────────────────────────
  //  Build the sidebar list
  // ────────────────────────────────────────────────────────────────

  function buildList() {
    const list = document.getElementById('ds-list');
    if (!list) return;
    list.innerHTML = '';

    CATEGORIES.forEach(cat => {
      // Category header
      const hdr = document.createElement('div');
      hdr.className = 'ds-cat-header';
      hdr.textContent = cat.label;
      list.appendChild(hdr);

      cat.keys.forEach(key => {
        const ds = DS[key];
        if (!ds) return;
        const item = document.createElement('div');
        item.className = 'ds-item';
        item.dataset.key = key;
        item.innerHTML =
          '<div class="ds-item-name">' + ds.name + '</div>' +
          '<div class="ds-item-desc">' + ds.summary.substring(0, 60) + '...</div>';
        item.addEventListener('click', () => selectDatasheet(key));
        list.appendChild(item);
      });
    });
  }

  // ────────────────────────────────────────────────────────────────
  //  Render detail view
  // ────────────────────────────────────────────────────────────────

  let activeKey = null;

  function selectDatasheet(key) {
    const ds = DS[key];
    if (!ds) return;
    activeKey = key;

    // Highlight active item
    document.querySelectorAll('#ds-list .ds-item').forEach(el => {
      el.classList.toggle('active', el.dataset.key === key);
    });

    const detail = document.getElementById('ds-detail');
    if (!detail) return;

    let html = '';

    // Header
    html += '<div class="ds-comp-header">';
    html += '  <div class="ds-comp-name">' + ds.name + '</div>';
    html += '  <span class="ds-badge ' + (BADGE_CLASS[ds.category] || '') + '">' + ds.badge + '</span>';
    html += '</div>';
    html += '<div class="ds-comp-summary">' + ds.summary + '</div>';

    // What is it
    html += '<div class="ds-section-title">What Is It?</div>';
    html += '<div class="ds-what">' + ds.what + '</div>';

    // Analogy
    if (ds.analogy) {
      html += '<div class="ds-section-title">Real-World Analogy</div>';
      html += '<div class="ds-analogy">' + ds.analogy + '</div>';
    }

    // Pin table
    if (ds.pins && ds.pins.length > 0) {
      html += '<div class="ds-section-title">Pin Description</div>';
      html += '<table class="ds-pin-table"><thead><tr><th>Pin</th><th>Dir</th><th>Description</th></tr></thead><tbody>';
      ds.pins.forEach(p => {
        const dirClass = p.dir === 'in' ? 'ds-pin-dir-in' :
                         p.dir === 'out' ? 'ds-pin-dir-out' : 'ds-pin-dir-pwr';
        const dirLabel = p.dir === 'in' ? 'INPUT' : p.dir === 'out' ? 'OUTPUT' : 'POWER';
        html += '<tr>';
        html += '  <td><span class="ds-pin-name">' + p.name + '</span></td>';
        html += '  <td><span class="' + dirClass + '">' + dirLabel + '</span></td>';
        html += '  <td><span class="ds-pin-desc">' + p.desc + '</span></td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    }

    // Truth table
    if (ds.truth) {
      html += '<div class="ds-section-title">Truth Table</div>';
      html += '<table class="ds-truth-table">';
      html += '<thead>' + ttHead(ds.truth.heads) + '</thead><tbody>';
      ds.truth.rows.forEach(r => { html += ttRow(r); });
      html += '</tbody></table>';
    }

    // How it works
    if (ds.how && ds.how.length > 0) {
      html += '<div class="ds-section-title">How It Works</div>';
      if (Array.isArray(ds.how)) {
        html += '<ul class="ds-how-list">';
        ds.how.forEach(h => { html += '<li>' + h + '</li>'; });
        html += '</ul>';
      } else {
        // raw HTML string
        html += '<div class="ds-what" style="border-left-color:#4488ff">' + ds.how + '</div>';
      }
    }

    // Example / tryIt
    const exampleText = ds.example || ds.tryIt;
    if (exampleText) {
      html += '<div class="ds-section-title">Try This</div>';
      html += '<div class="ds-example">' + exampleText + '</div>';
    }

    // Real world (accepts 'realworld' or 'realWorld')
    const rwText = ds.realworld || ds.realWorld;
    if (rwText) {
      html += '<div class="ds-section-title">Real-World Notes</div>';
      html += '<div class="ds-realworld">' + rwText + '</div>';
    }

    detail.innerHTML = html;
    detail.scrollTop = 0;
  }

  // ────────────────────────────────────────────────────────────────
  //  Search filter
  // ────────────────────────────────────────────────────────────────

  function initSearch() {
    const input = document.getElementById('ds-search');
    if (!input) return;
    input.addEventListener('input', function () {
      const q = this.value.trim().toLowerCase();
      document.querySelectorAll('#ds-list .ds-item').forEach(el => {
        const key = el.dataset.key;
        const ds = DS[key];
        if (!ds) { el.classList.add('hidden-item'); return; }
        const text = (ds.name + ' ' + ds.summary + ' ' + ds.badge + ' ' + (ds.what || '')).toLowerCase();
        el.classList.toggle('hidden-item', q.length > 0 && !text.includes(q));
      });
      // Hide empty category headers
      document.querySelectorAll('#ds-list .ds-cat-header').forEach(hdr => {
        let next = hdr.nextElementSibling;
        let anyVisible = false;
        while (next && !next.classList.contains('ds-cat-header')) {
          if (!next.classList.contains('hidden-item')) anyVisible = true;
          next = next.nextElementSibling;
        }
        hdr.style.display = anyVisible ? '' : 'none';
      });
    });
  }

  // ────────────────────────────────────────────────────────────────
  //  Auto-open datasheet when a component is selected on canvas
  // ────────────────────────────────────────────────────────────────

  function openDatasheetForComponent(compType) {
    // Map component type names to DS keys
    const typeMap = {
      'Clock': 'Clock', 'CU': 'CU', 'Register': 'Register', 'Bus': 'Bus', 'AddrBus': 'AddrBus', 'ALU': 'ALU',
      'RAM': 'RAM', 'PC': 'PC', 'MAR': 'MAR', 'IR': 'IR', 'Flags': 'Flags',
      'Output': 'Output', 'Switch': 'Switch', 'Const': 'Const',
      'VCC': 'VCC', 'GND': 'GND', 'Battery': 'Battery',
      'Resistor': 'Resistor', 'Capacitor': 'Capacitor', 'Inductor': 'Inductor',
      'AND': 'AND', 'OR': 'OR', 'NOT': 'NOT', 'NAND': 'NAND', 'NOR': 'NOR',
      'XOR': 'XOR', 'XNOR': 'XNOR', 'Buffer': 'Buffer',
      'HalfAdder': 'HalfAdder', 'FullAdder': 'FullAdder', 'Adder4': 'Adder4',
      'Dec2to4': 'Dec2to4', 'Dec3to8': 'Dec3to8', 'Enc8to3': 'Enc8to3',
      'PriEnc': 'PriEnc', 'Mux2to1': 'Mux2to1', 'Mux4to1': 'Mux4to1',
      'Mux8to1': 'Mux8to1', 'Demux1to2': 'Demux1to2', 'Demux1to4': 'Demux1to4',
      'SRLatch': 'SRLatch', 'DFF': 'DFF', 'JKFF': 'JKFF', 'TFF': 'TFF',
      'Counter4': 'Counter4', 'ShiftReg': 'ShiftReg',
      'Diode': 'Diode', 'LED': 'LED', 'NPN': 'NPN', 'PNP': 'PNP',
      'NMOS': 'NMOS', 'PMOS': 'PMOS', 'NJFET': 'NJFET', 'PJFET': 'PJFET', 'SCR': 'SCR',
      'LEDBar': 'LEDBar', '7Seg': '7Seg', '7SegDec': '7SegDec',
      '74LS00': '74LS00', '74LS04': '74LS04', '74LS08': '74LS08',
      '74LS32': '74LS32', '74LS86': '74LS86', '74LS138': '74LS138',
      '74LS173': '74LS173', '74LS245': '74LS245', '74LS283': '74LS283',
      '74LS161': '74LS161', '555': '555'
    };
    const key = typeMap[compType];
    if (key && DS[key]) {
      selectDatasheet(key);
    }
  }

  // ────────────────────────────────────────────────────────────────
  //  Init
  // ────────────────────────────────────────────────────────────────

  function initDatasheets() {
    buildList();
    initSearch();
  }

  // Run on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDatasheets);
  } else {
    initDatasheets();
  }

  // Export for use by other modules
  window.bbDatasheets = DS;
  window.openDatasheetForComponent = openDatasheetForComponent;

})();
