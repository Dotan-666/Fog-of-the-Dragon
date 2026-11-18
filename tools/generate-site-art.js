#!/usr/bin/env node
// Generates atmospheric dark-fantasy decorative illustrations for the site using Pollinations.ai.
// Usage:  node tools/generate-site-art.js [--resume]

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const OUT_DIR = path.resolve(__dirname, '..', 'Assets', 'Images', 'decorative');

const IMAGES = [
  { file: 'adventurers-map.webp', prompt: 'diverse fantasy adventurers gathered around a glowing magical map on a wooden table, warm torchlight, dark fantasy oil painting, atmospheric, cinematic, detailed, no text, no watermark' },
  { file: 'dragon-mist.webp', prompt: 'massive dragon silhouette emerging from thick fog and mist, glowing red eyes, dark fantasy oil painting, dramatic cinematic lighting, atmospheric, detailed, no text, no watermark' },
  { file: 'tavern-cozy.webp', prompt: 'cozy fantasy tavern interior with roaring fireplace, adventurers resting at tables, warm golden light, dark fantasy oil painting, atmospheric, cinematic, detailed, no text, no watermark' },
  { file: 'dungeon-entrance.webp', prompt: 'dark dungeon entrance with flickering torchlight, carved stone archway, ominous shadows, dark fantasy oil painting, dramatic cinematic lighting, detailed, no text, no watermark' },
  { file: 'forest-clearing.webp', prompt: 'mystical forest clearing at night with bioluminescent mushrooms and fireflies, ancient trees, dark fantasy oil painting, atmospheric, ethereal, detailed, no text, no watermark' },
  { file: 'ancient-library.webp', prompt: 'ancient magical library with floating glowing books, towering bookshelves, arcane symbols, dark fantasy oil painting, dramatic cinematic lighting, detailed, no text, no watermark' },
  { file: 'battlefield-dusk.webp', prompt: 'fantasy battlefield at dusk with scattered banners and weapons, dramatic orange sky, dark fantasy oil painting, atmospheric, cinematic, detailed, no text, no watermark' },
  { file: 'tavern-party.webp', prompt: 'diverse adventuring party celebrating in a fantasy tavern, different races and classes, mugs raised in toast, warm candlelight, dark fantasy oil painting, atmospheric, detailed, no text, no watermark' },
  { file: 'castle-fog.webp', prompt: 'dark gothic castle on a cliff surrounded by swirling fog, full moon, bats flying, dark fantasy oil painting, dramatic cinematic lighting, detailed, no text, no watermark' },
  { file: 'campfire-night.webp', prompt: 'adventurers sitting around a campfire in the wilderness at night, stars overhead, dark fantasy oil painting, warm and atmospheric, cinematic, detailed, no text, no watermark' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchImage(url, timeout) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { timeout: timeout || 90000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchImage(res.headers.location, timeout).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const resume = process.argv.includes('--resume');
  let done = 0, failed = 0;

  for (let i = 0; i < IMAGES.length; i++) {
    const img = IMAGES[i];
    const dest = path.join(OUT_DIR, img.file);
    if (resume && fs.existsSync(dest) && fs.statSync(dest).size > 5120) {
      console.log(`[${i + 1}/${IMAGES.length}] ${img.file} — already exists, skipping`);
      continue;
    }
    console.log(`[${i + 1}/${IMAGES.length}] ${img.file}`);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(img.prompt)}?width=1024&height=768&nologo=true`;
    let ok = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        process.stdout.write(`  attempt ${attempt}/5... `);
        const buf = await fetchImage(url, 120000);
        if (buf.length < 5120) { console.log(`too small (${buf.length})`); await sleep(8000); continue; }
        fs.writeFileSync(dest, buf);
        console.log(`OK (${(buf.length / 1024).toFixed(0)} KB)`);
        ok = true;
        break;
      } catch (err) {
        console.log(`failed: ${err.message}`);
        if (attempt < 5) await sleep(5000 * attempt);
      }
    }
    if (ok) done++; else { failed++; console.log(`  FAILED: ${img.file}`); }
    if (i < IMAGES.length - 1) await sleep(10000);
  }
  console.log(`\nDone. Generated: ${done}, Failed: ${failed}`);
  if (failed) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
