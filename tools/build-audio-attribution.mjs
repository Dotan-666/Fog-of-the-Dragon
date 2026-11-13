#!/usr/bin/env node
/**
 * Writes Assets/Audio/ATTRIBUTION.md from Assets/Audio/catalog.json, so the attribution document always lists exactly
 * the audio files that ship. Run after changing the catalog:  node tools/build-audio-attribution.mjs
 * (tests/audio-catalog.test.mjs fails when the document is out of date.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'Assets/Audio');

export function buildAttribution(catalog) {
  const kinds = { music: 'Background music', ambience: 'Ambience', sfx: 'Sound effects' };
  const cats = {};
  (catalog.categories || []).forEach((c) => { cats[c.id] = c.label; });
  const used = [...new Set(catalog.tracks.map((t) => t.license))];
  const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  let md = `# Audio attribution and licenses

This file is generated from \`catalog.json\` by \`node tools/build-audio-attribution.mjs\`. It lists every audio file
that ships with Fog of the Dragon (${catalog.tracks.length} files).

## Sources and how they were checked

Approved sources: **OpenGameArt** (https://opengameart.org), **Kenney** (https://kenney.nl/assets) and **Pixabay**
(https://pixabay.com/music/). Each asset's license was checked on the asset's own page, not assumed from the website:

- **OpenGameArt:** the “License(s)” field of each asset page. Only assets with a single CC0 license that were uploaded by
  their author were used. Kenney's packs were taken from Kenney's own OpenGameArt uploads; their bundled License.txt also
  states CC0.
- **Kenney.nl:** downloads on kenney.nl go through a session check that automated tools are not allowed to pass, so the
  same packs were taken from Kenney's OpenGameArt uploads instead.
- **Pixabay:** pixabay.com refuses automated access (HTTP 403), so no Pixabay asset could be opened, checked or
  downloaded, and none are included. Note for later: the Pixabay Content License forbids distributing content “on a
  Standalone basis”; check with the license owner or a lawyer before streaming Pixabay tracks as selectable items.

## Licenses used

`;
  used.forEach((key) => {
    const l = catalog.licenses[key];
    md += `- **${l.name}** (${l.url}): commercial use ${l.commercialUse ? 'allowed' : 'NOT allowed'}, hosting/streaming/redistribution ${l.redistribution ? 'allowed' : 'NOT allowed'}, changes ${l.modification ? 'allowed' : 'NOT allowed'}, attribution ${l.attributionRequired ? '**required**' : 'not required'}.\n`;
  });
  md += `
No asset in this folder requires attribution. Credit is given below anyway, using the wording the authors asked for.
Files were renamed; their audio was not changed.
`;
  ['music', 'ambience', 'sfx'].forEach((k) => {
    const list = catalog.tracks.filter((t) => t.kind === k).sort((a, b) => (cats[a.category] || a.category).localeCompare(cats[b.category] || b.category) || a.name.localeCompare(b.name));
    if (!list.length) return;
    md += `\n## ${kinds[k]} (${list.length})\n\n| Name | Category | File | Length | Author | Source page | License | Attribution |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n`;
    list.forEach((t) => {
      md += `| ${cell(t.name)} | ${cell(cats[t.category] || t.category)} | \`${cell(t.file)}\` | ${t.duration != null ? t.duration.toFixed(1) + ' s' : '—'} | ${cell(t.author)} | ${cell(t.sourceUrl)} | ${cell(catalog.licenses[t.license].name)} | ${cell(t.attribution)} |\n`;
    });
  });
  md += `
## Removed in this revision

The 54 music tracks, ambiences and sound effects that were synthesized in the browser (\`JS/Dashboard/music/sound-library.js\`)
were removed from the preloaded library because they did not come from an approved source. Playlists, favorites and
history entries that pointed to them are dropped automatically.
`;
  return md;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = JSON.parse(fs.readFileSync(path.join(DIR, 'catalog.json'), 'utf8'));
  fs.writeFileSync(path.join(DIR, 'ATTRIBUTION.md'), buildAttribution(catalog));
  console.log('Wrote Assets/Audio/ATTRIBUTION.md (' + catalog.tracks.length + ' files)');
}
