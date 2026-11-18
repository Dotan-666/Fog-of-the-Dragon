#!/usr/bin/env node
// Generates dark-fantasy portrait artwork for every SRD monster using Pollinations.ai.
// Usage:  node tools/generate-monster-art.js [--resume] [--delay=2000] [--retries=3]
// Images are saved to Assets/Images/monsters/<slug>.webp and a manifest.json is produced.

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const REPO = path.resolve(__dirname, '..');
const MONSTERS_JSON = path.join(REPO, 'Assets', 'Data', 'srd-5.2.1-monsters.json');
const OUT_DIR = path.join(REPO, 'Assets', 'Images', 'monsters');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

const args = process.argv.slice(2);
const RESUME = args.includes('--resume');
const DELAY = parseInt((args.find(a => a.startsWith('--delay=')) || '--delay=2000').split('=')[1], 10);
const MAX_RETRIES = parseInt((args.find(a => a.startsWith('--retries=')) || '--retries=3').split('=')[1], 10);
const MIN_SIZE = 5 * 1024; // 5 KB minimum

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildPrompt(name, type) {
  return `dark fantasy oil painting portrait of a ${name}, ${type} creature, dramatic cinematic lighting, tabletop RPG monster art, detailed, no text, no watermark`;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fetchImage(url, timeout) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { timeout: timeout || 60000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchImage(res.headers.location, timeout).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function generateOne(name, type, filename) {
  const prompt = buildPrompt(name, type);
  const encoded = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&nologo=true`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      process.stdout.write(`  attempt ${attempt}/${MAX_RETRIES}... `);
      const buf = await fetchImage(url, 120000);
      if (buf.length < MIN_SIZE) {
        console.log(`too small (${buf.length} bytes), retrying`);
        await sleep(8000);
        continue;
      }
      const dest = path.join(OUT_DIR, filename);
      fs.writeFileSync(dest, buf);
      console.log(`OK (${(buf.length / 1024).toFixed(0)} KB)`);
      return true;
    } catch (err) {
      console.log(`failed: ${err.message}`);
      if (attempt < MAX_RETRIES) await sleep(5000 * attempt);
    }
  }
  return false;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const data = JSON.parse(fs.readFileSync(MONSTERS_JSON, 'utf-8'));
  const monsters = data.monsters;
  console.log(`Found ${monsters.length} monsters`);

  let manifest = {};
  if (RESUME && fs.existsSync(MANIFEST)) {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
    console.log(`Resuming: ${Object.keys(manifest).length} already done`);
  }

  let done = 0, failed = 0, skipped = 0;

  for (let i = 0; i < monsters.length; i++) {
    const m = monsters[i];
    const filename = slug(m.name) + '.webp';

    if (RESUME && manifest[m.name] && fs.existsSync(path.join(OUT_DIR, manifest[m.name]))) {
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/${monsters.length}] ${m.name} (${m.type})`);
    const ok = await generateOne(m.name, m.type || 'creature', filename);

    if (ok) {
      manifest[m.name] = filename;
      done++;
      fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
    } else {
      failed++;
      console.log(`  FAILED: ${m.name}`);
    }

    if (i < monsters.length - 1) await sleep(DELAY);
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\nDone. Generated: ${done}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Manifest: ${MANIFEST}`);

  if (failed > 0) {
    console.log('\nFailed monsters:');
    for (const m of monsters) {
      if (!manifest[m.name]) console.log('  - ' + m.name);
    }
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
