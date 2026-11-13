/**
 * Builds tests/ui/fixtures/party-snapshots.json: complete level 3 characters (made with the rules engine's own
 * options, like tests/helpers/sandbox.mjs autoBuild) in the shape a campaign seat stores (FogCampaignStore.snapshot).
 * The browser test harness for the Campaign workspace (campaign-harness.html) uses them as the party.
 * Run: node tests/ui/make-campaign-fixtures.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, load, autoBuild } from '../helpers/sandbox.mjs';

const { w } = load();
const out = {};
for (const [key, classId, name] of [['p1', 'fighter', 'Brienne Ashford'], ['p2', 'wizard', 'Tobias Vell']]) {
  const { doc, errors } = autoBuild(w, classId, 3);
  if (errors.length) throw new Error(`${classId}: ${errors.map((e) => e.message).join('; ')}`);
  doc.narrative.name = name;
  out[key] = JSON.parse(JSON.stringify({
    schemaVersion: doc.schemaVersion, rules: doc.rules || null, sourceCharacterId: doc.id, choices: doc.choices, narrative: doc.narrative,
  }));
}
fs.writeFileSync(path.join(ROOT, 'tests/ui/fixtures/party-snapshots.json'), JSON.stringify(out));
console.log('wrote tests/ui/fixtures/party-snapshots.json');
