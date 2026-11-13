/**
 * Builds the Homebrew type illustrations in Assets/Pictures/homebrew/*.svg.
 *
 * Each illustration is an original medallion (background, rays, gold ring, gilded emblem) drawn around a silhouette
 * from game-icons.net (CC BY 3.0 — https://game-icons.net, https://github.com/game-icons/icons). Only the path data of
 * each icon is used: it is checked to contain nothing but SVG path commands and numbers, so no markup from the
 * download ends up in the project.
 *
 *   node tools/build-homebrew-art.mjs <folder with the downloaded icon .svg files>
 *
 * Expected files (game-icons repo paths with "/" replaced by "_"):
 *   lorc_dragon-head.svg, delapouite_wizard-face.svg, delapouite_spell-book.svg, lorc_gem-pendant.svg,
 *   lorc_laurel-crown.svg, lorc_scroll-unfurled.svg
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2];
if (!SRC) { console.error('Usage: node tools/build-homebrew-art.mjs <icon folder>'); process.exit(1); }
const OUT = path.join(ROOT, 'Assets/Pictures/homebrew');

export const ART = [
  { kind: 'monster', file: 'lorc_dragon-head.svg', icon: 'Dragon head', author: 'Lorc', a: '#8e1b1b', b: '#2a0707', glow: '#ff7a3d' },
  { kind: 'npc', file: 'delapouite_wizard-face.svg', icon: 'Wizard face', author: 'Delapouite', a: '#1f5566', b: '#061419', glow: '#7fd3e6' },
  { kind: 'spell', file: 'delapouite_spell-book.svg', icon: 'Spell book', author: 'Delapouite', a: '#43307a', b: '#0d0822', glow: '#b99cff' },
  { kind: 'magic-item', file: 'lorc_gem-pendant.svg', icon: 'Gem pendant', author: 'Lorc', a: '#1f6a4e', b: '#04160f', glow: '#7af0bb' },
  { kind: 'feat', file: 'lorc_laurel-crown.svg', icon: 'Laurel crown', author: 'Lorc', a: '#7d5d16', b: '#1c1304', glow: '#ffd76a' },
  { kind: 'other', file: 'lorc_scroll-unfurled.svg', icon: 'Scroll unfurled', author: 'Lorc', a: '#6a4526', b: '#170d05', glow: '#f2c48a' },
];

const SAFE_D = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s-]+$/;

function emblemPaths(svgText) {
  const ds = [...svgText.matchAll(/<path\b[^>]*\sd="([^"]+)"[^>]*>/g)].map((m) => m[1]).filter((d) => d !== 'M0 0h512v512H0z');
  if (!ds.length) throw new Error('no path found');
  ds.forEach((d) => { if (!SAFE_D.test(d)) throw new Error('unexpected characters in path data'); });
  return ds;
}

function medallion(art, ds) {
  const id = art.kind;
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 15 * Math.PI) / 180;
    const x = (256 + Math.cos(a) * 250).toFixed(1);
    const y = (256 + Math.sin(a) * 250).toFixed(1);
    return `M256 256L${x} ${y}`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="${art.icon}">
  <!-- Fog of the Dragon homebrew art: ${art.kind}. Emblem: "${art.icon}" by ${art.author}, game-icons.net, CC BY 3.0. -->
  <defs>
    <radialGradient id="bg-${id}" cx="50%" cy="42%" r="70%">
      <stop offset="0" stop-color="${art.a}"/>
      <stop offset="1" stop-color="${art.b}"/>
    </radialGradient>
    <radialGradient id="glow-${id}" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${art.glow}" stop-opacity=".55"/>
      <stop offset=".6" stop-color="${art.glow}" stop-opacity=".08"/>
      <stop offset="1" stop-color="${art.glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gold-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff3c4"/>
      <stop offset=".35" stop-color="#f0c85a"/>
      <stop offset=".7" stop-color="#b9862a"/>
      <stop offset="1" stop-color="#7a4f12"/>
    </linearGradient>
    <linearGradient id="ring-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7dd8c"/>
      <stop offset=".5" stop-color="#9c6b1c"/>
      <stop offset="1" stop-color="#f0c85a"/>
    </linearGradient>
    <filter id="shadow-${id}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#000" flood-opacity=".6"/>
    </filter>
    <clipPath id="clip-${id}"><circle cx="256" cy="256" r="214"/></clipPath>
  </defs>
  <rect width="512" height="512" fill="url(#bg-${id})"/>
  <g clip-path="url(#clip-${id})">
    <path d="${rays}" stroke="${art.glow}" stroke-opacity=".12" stroke-width="10"/>
    <circle cx="256" cy="256" r="214" fill="url(#glow-${id})"/>
  </g>
  <circle cx="256" cy="256" r="222" fill="none" stroke="url(#ring-${id})" stroke-width="7"/>
  <circle cx="256" cy="256" r="208" fill="none" stroke="#f0c85a" stroke-opacity=".45" stroke-width="2"/>
  <circle cx="256" cy="256" r="234" fill="none" stroke="#f0c85a" stroke-opacity=".25" stroke-width="2" stroke-dasharray="3 9"/>
  <g filter="url(#shadow-${id})" transform="translate(256 262) scale(.6) translate(-256 -256)">
    ${ds.map((d) => `<path d="${d}" fill="url(#gold-${id})" stroke="#5a3608" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/>`).join('\n    ')}
  </g>
</svg>
`;
}

fs.mkdirSync(OUT, { recursive: true });
for (const art of ART) {
  const ds = emblemPaths(fs.readFileSync(path.join(SRC, art.file), 'utf8'));
  fs.writeFileSync(path.join(OUT, art.kind + '.svg'), medallion(art, ds));
  console.log(art.kind + '.svg', ds.length, 'path(s)');
}
fs.writeFileSync(path.join(OUT, 'ATTRIBUTION.md'), `# Homebrew type illustrations

The six medallions in this folder (\`monster.svg\`, \`npc.svg\`, \`spell.svg\`, \`magic-item.svg\`, \`feat.svg\`, \`other.svg\`)
are made for Fog of the Dragon by \`tools/build-homebrew-art.mjs\`. The background, rays, rings and gilding are original;
the emblem silhouettes come from **game-icons.net** under the **Creative Commons Attribution 3.0** license
(https://creativecommons.org/licenses/by/3.0/). They were recolored and composed into medallions.

| File | Emblem | Author | Source |
|---|---|---|---|
${ART.map((a) => `| ${a.kind}.svg | ${a.icon} | ${a.author} | https://game-icons.net (game-icons/icons: ${a.file.replace('_', '/')}) |`).join('\n')}

Icons made by Lorc (https://lorcblog.blogspot.com) and Delapouite (https://delapouite.com), from https://game-icons.net, CC BY 3.0.
`);
console.log('wrote', OUT);
