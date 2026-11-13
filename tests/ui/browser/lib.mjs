/**
 * Helpers for the browser tests in this folder (puppeteer-core driving a real Chrome/Edge).
 *
 * One-time setup:   npm install --no-save puppeteer-core
 *   (or point PUPPETEER_MODULE at an installed puppeteer-core/lib/puppeteer/puppeteer-core.js)
 * Then serve the repository root over HTTP (python -m http.server 8123) and run, for example:
 *   node tests/ui/browser/workspace-basics.mjs
 * Environment: BASE_URL (default http://localhost:8123), CHROME_PATH (default: Chrome in its usual Windows place),
 * SCREENSHOT_DIR (default: the system temp folder).
 */
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const mod = process.env.PUPPETEER_MODULE ? pathToFileURL(process.env.PUPPETEER_MODULE).href : 'puppeteer-core';
let puppeteer;
try { puppeteer = (await import(mod)).default; } catch { console.error('These tests need puppeteer-core:  npm install --no-save puppeteer-core'); process.exit(1); }

export const BASE = process.env.BASE_URL || 'http://localhost:8123';
export const SHOTS = process.env.SCREENSHOT_DIR || process.argv[2] || os.tmpdir();
export const A = '11111111-1111-4111-8111-111111111111';
export const B = '22222222-2222-4222-8222-222222222222';

export async function open(opts = {}) {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: opts.w || 1280, height: opts.h || 900 });
  const errors = [];
  page.errors = errors;
  page.on('response', (r) => { if (r.status() === 404) errors.push('404: ' + r.url()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return { browser, page, errors };
}

/** Opens the workspace test harness (real workspace code, in-memory data) as a given person, campaign and section. */
export async function go(page, qs, hash) {
  const target = `${BASE}/tests/ui/campaign-harness.html?${qs}#${hash}`;
  if (page.url() === target) await page.reload({ waitUntil: 'load' });
  else await page.goto(target, { waitUntil: 'load' });
  try { await page.waitForSelector('#campaign-content .cw-page', { timeout: 8000 }); }
  catch (e) { console.log('TIMEOUT. body:', (await page.evaluate(() => document.body.innerText)).slice(0, 400)); throw e; }
  await new Promise((r) => setTimeout(r, 600));
}
export const text = (page, sel) => page.$eval(sel, (e) => e.innerText);
