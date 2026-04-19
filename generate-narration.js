/**
 * CPU Simulator — Narration Audio Generator
 *
 * Reads the OpenAI API key from Firestore (same pattern as the AIChatTeacher app),
 * then generates MP3 narration files for each scene in the animated explainer.
 *
 * Usage:
 *   Option A (with Firestore):
 *     1. Run `gcloud auth application-default login`
 *     2. Run `npm install && node generate-narration.js`
 *
 *   Option B (with API key directly):
 *     OPENAI_KEY=sk-xxxxx node generate-narration.js
 *
 * Audio files are saved to ./audio/ and referenced by explainer.js at runtime.
 */

const fs = require('fs');
const path = require('path');

const NARRATION = [
  { id: 'scene1a', text: 'How does a CPU actually work?' },
  { id: 'scene1b', text: "Let's watch one instruction execute. Step by step." },
  { id: 'scene2_pc', text: 'The Program Counter keeps track of where we are in the program.' },
  { id: 'scene2_ram', text: 'RAM holds the program. Each address stores one instruction.' },
  { id: 'scene2_mar', text: 'The Memory Address Register tells RAM which address to read.' },
  { id: 'scene2_ir', text: 'The Instruction Register holds the instruction the CPU is currently executing.' },
  { id: 'scene2_a', text: "Register A is the CPU's working hand. It holds the data being processed." },
  { id: 'scene2_alu', text: 'The ALU does all the math. Addition, subtraction, logic operations.' },
  { id: 'scene2_bus', text: 'The Bus is a shared highway. Data travels between components on it.' },
  { id: 'scene2_done', text: 'These are the building blocks. Now let us see them work together.' },
  { id: 'scene3_intro', text: 'Here is our program stored in RAM. It adds two numbers.' },
  { id: 'scene3_lda', text: 'Load the value at address 14 into Register A.' },
  { id: 'scene3_add', text: 'Add the value at address 15 to Register A.' },
  { id: 'scene3_out', text: 'Output whatever is in Register A.' },
  { id: 'scene3_hlt', text: 'Stop the CPU.' },
  { id: 'scene3_data', text: 'Our first number is 28. Our second number is 14. The program will add them together.' },
  { id: 'scene4_intro', text: 'Step one. Fetch. The CPU needs to get the next instruction from memory.' },
  { id: 'scene4_pc', text: "The Program Counter says: I'm at address zero." },
  { id: 'scene4_t0', text: 'T zero. The Program Counter puts address zero on the bus. The Memory Address Register captures it.' },
  { id: 'scene4_t1', text: 'T one. RAM reads address zero and sends the instruction to the Instruction Register. The Program Counter increments to one, ready for next time.' },
  { id: 'scene4_summary', text: "That's fetch. Every single instruction starts this way. Always." },
  { id: 'scene5_decode', text: 'Now the CPU decodes the instruction.' },
  { id: 'scene5_opcode', text: 'The opcode L D A means Load into Register A.' },
  { id: 'scene5_operand', text: 'The operand 14 is the memory address to read from.' },
  { id: 'scene5_signals', text: 'The control logic reads the opcode and knows exactly which signals to fire next.' },
  { id: 'scene6_intro', text: 'Step three. Execute. Now the CPU carries out the instruction.' },
  { id: 'scene6_t2', text: 'T two. The operand, address 14, goes from the Instruction Register to the Memory Address Register.' },
  { id: 'scene6_t3', text: 'T three. RAM reads address 14. The value is 28. It flows through the bus into Register A.' },
  { id: 'scene6_done', text: 'Done! Register A now holds 28.' },
  { id: 'scene7_intro', text: "Now let's do it again with the ADD instruction." },
  { id: 'scene7_fetch', text: 'Fetch is always the same. The CPU grabs ADD 15 from address one.' },
  { id: 'scene7_t2', text: 'T two. Address 15 goes to the Memory Address Register.' },
  { id: 'scene7_t3', text: 'T three. RAM reads address 15. The value is 14. It goes into Register B.' },
  { id: 'scene7_t4', text: 'T four. The ALU adds Register A, which is 28, plus Register B, which is 14. The result is 42. It flows back into Register A.' },
  { id: 'scene8_out', text: 'The OUT instruction sends 42 from Register A to the output display.' },
  { id: 'scene8_hlt', text: 'Halt. The clock stops. Program complete.' },
  { id: 'scene9a', text: 'Every program you have ever used. Games, apps, even artificial intelligence. Is just this cycle repeating.' },
  { id: 'scene9b', text: 'Fetch. Decode. Execute. Billions of times per second.' },
  { id: 'scene9c', text: 'Now you know how a CPU works.' },
  { id: 'scene10', text: 'Try it yourself. Switch to Free mode and step through a real program.' },
];

async function main() {
  let apiKey = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY || '';

  if (!apiKey) {
    // Try reading from Firestore (same pattern as AIChatTeacher)
    try {
      const admin = require('firebase-admin');
      admin.initializeApp({ projectId: 'aiteacher-75856' });
      const db = admin.firestore();
      const snap = await db.collection('api_keys').doc('active_config').get();
      const data = snap.data() || {};
      // Log available keys to find the right field name
      console.log('Firestore fields:', Object.keys(data).join(', '));
      // Try common variations (some keys have trailing spaces in Firestore)
      for (const [k, v] of Object.entries(data)) {
        if (k.trim().toLowerCase() === 'openai' && v) {
          apiKey = v.toString().trim();
          break;
        }
      }
      console.log('Got API key from Firestore');
    } catch (e) {
      console.error('Could not read from Firestore. Use: OPENAI_KEY=sk-xxx node generate-narration.js');
      process.exit(1);
    }
  } else {
    console.log('Using API key from environment variable');
  }

  if (!apiKey) {
    console.error('No OpenAI API key found. Set OPENAI_KEY env var or configure Firestore.');
    process.exit(1);
  }

  // Create output directory
  const outDir = path.join(__dirname, 'audio');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const item of NARRATION) {
    const outPath = path.join(outDir, `${item.id}.mp3`);
    if (fs.existsSync(outPath)) {
      console.log(`Skipping ${item.id} (already exists)`);
      continue;
    }
    console.log(`Generating ${item.id}: "${item.text.substring(0, 50)}..."`);

    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: item.text,
        voice: 'onyx',   // deep, authoritative voice — good for technical narration
        response_format: 'mp3',
        speed: 0.95,      // slightly slower for clarity
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Error for ${item.id}: ${res.status} ${errText}`);
      continue;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved ${item.id}.mp3 (${buffer.length} bytes)`);

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\nDone! Audio files saved to ./audio/');
  console.log('Now copy them to the hosting directory and deploy.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
