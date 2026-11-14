/**
 * Foggy images — the pure parts: request checks, the prompt for each kind of picture, and the image provider interface.
 *
 * Visual maps and illustrations are for atmosphere. A PLAYABLE battle map is asked for differently (strict top-down,
 * orthographic, square grid, readable terrain, no text, no perspective) and is stored with playable = true and its grid.
 * The model can still get it wrong, so the app shows it as "battle map (check the grid before play)".
 *
 * Provider interface (index.ts picks one from FOGGY_IMAGE_PROVIDER; only "gemini" is built):
 *   generate({ prompt, aspect }) → { ok, bytes, mime } | { ok:false, status, code, message }
 */

export const KINDS: Record<string, { label: string; aspect: string; playable?: boolean }> = {
  battle_map: { label: 'Battle map (playable)', aspect: '1:1', playable: true },
  dungeon_map: { label: 'Dungeon map (playable)', aspect: '1:1', playable: true },
  region_map: { label: 'Regional map', aspect: '4:3' },
  world_map: { label: 'World map', aspect: '16:9' },
  city_map: { label: 'City or settlement map', aspect: '4:3' },
  location: { label: 'Location illustration', aspect: '16:9' },
  portrait: { label: 'NPC portrait', aspect: '3:4' },
  villain: { label: 'Villain portrait', aspect: '3:4' },
  monster: { label: 'Monster illustration', aspect: '1:1' },
  item: { label: 'Magic item illustration', aspect: '1:1' },
  spell: { label: 'Spell effect illustration', aspect: '16:9' },
  cover: { label: 'Adventure cover', aspect: '3:4' },
  handout: { label: 'Handout illustration', aspect: '3:4' },
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '');

export interface ImageReq { kind: string; title: string; prompt: string; scope: 'dashboard' | 'campaign'; campaignId: string | null; grid: { cols: number; rows: number } | null; style: string }
export function validateRequest(b: unknown): { ok: true; req: ImageReq } | { ok: false; error: string } {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { ok: false, error: 'Expected a JSON object.' };
  const o = b as Record<string, unknown>;
  const kind = String(o.kind || '');
  if (!KINDS[kind]) return { ok: false, error: 'Choose what kind of picture to make.' };
  const prompt = clean(o.prompt, 1500);
  if (prompt.length < 5) return { ok: false, error: 'Describe the picture (a sentence or two).' };
  const scope = o.scope === 'campaign' ? 'campaign' : 'dashboard';
  const campaignId = o.campaignId == null ? null : String(o.campaignId);
  if (scope === 'campaign' && (!campaignId || !UUID.test(campaignId))) return { ok: false, error: 'Campaign images need the campaign id.' };
  let grid = null;
  if (KINDS[kind].playable) {
    const g = (o.grid || {}) as Record<string, unknown>;
    const cols = Math.round(Number(g.cols) || 20), rows = Math.round(Number(g.rows) || 20);
    grid = { cols: Math.min(40, Math.max(8, cols)), rows: Math.min(40, Math.max(8, rows)) };
  }
  return { ok: true, req: { kind, title: clean(o.title, 120) || KINDS[kind].label, prompt, scope, campaignId: scope === 'campaign' ? campaignId : null, grid, style: clean(o.style, 80) } };
}

export function buildPrompt(r: ImageReq): string {
  const style = r.style ? ` Style: ${r.style}.` : '';
  const safe = ' Original fantasy artwork for a tabletop role-playing game. No text, letters, logos, watermarks or signatures. Do not depict real people or copyrighted characters.';
  if (KINDS[r.kind].playable) {
    return `A playable tabletop battle map seen from directly above (strict top-down orthographic view, no perspective, no horizon). ` +
      `A clearly visible square grid of ${r.grid!.cols} by ${r.grid!.rows} equal squares covers the whole image, each square about 5 feet. ` +
      `Readable terrain and obstacles with clear edges (walls, doors, difficult terrain, cover, water, elevation marked by shading), ` +
      `open floor space for tactical movement, even lighting, no characters or tokens. ${r.kind === 'dungeon_map' ? 'A dungeon floor plan with rooms and corridors. ' : ''}Scene: ${r.prompt}.${style}${safe}`;
  }
  const what: Record<string, string> = {
    region_map: 'An illustrated fantasy regional map (decorative, for worldbuilding), parchment style, showing terrain, roads and settlements as symbols',
    world_map: 'An illustrated fantasy world map (decorative), continents, seas and mountain ranges',
    city_map: 'An illustrated fantasy city map (decorative), districts, walls, streets and landmarks seen from above',
    location: 'A fantasy location illustration, atmospheric, cinematic composition',
    portrait: 'A fantasy character portrait, head and shoulders, expressive face',
    villain: 'A menacing fantasy villain portrait, dramatic lighting',
    monster: 'A fantasy creature illustration, full body, clear silhouette',
    item: 'A fantasy magic item illustration, centered on a plain dark background',
    spell: 'A fantasy spell effect illustration, magical energy, dynamic',
    cover: 'A fantasy adventure book cover illustration (leave empty space at the top, no title text)',
    handout: 'An in-world fantasy handout illustration, aged paper look',
  };
  return `${what[r.kind]}. Subject: ${r.prompt}.${style}${safe}`;
}

export function geminiImageBody(prompt: string, aspect: string) {
  return { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } } };
}

/** The first image in a generateContent answer, or why there is none. */
export function pickImage(json: unknown): { ok: true; data: string; mime: string } | { ok: false; reason: string } {
  const j = json as { candidates?: { finishReason?: string; content?: { parts?: { inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string }; text?: string }[] } }[]; promptFeedback?: { blockReason?: string } };
  if (j?.promptFeedback?.blockReason) return { ok: false, reason: 'Gemini declined this picture (' + j.promptFeedback.blockReason.toLowerCase() + '). Try describing it differently.' };
  const parts = j?.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    const d = p.inlineData || (p.inline_data ? { mimeType: p.inline_data.mime_type, data: p.inline_data.data } : null);
    if (d && d.data && /^image\/(png|jpeg|webp)$/.test(d.mimeType || '')) return { ok: true, data: d.data, mime: d.mimeType! };
  }
  const why = j?.candidates?.[0]?.finishReason;
  return { ok: false, reason: why && why !== 'STOP' ? 'Gemini didn’t make the picture (' + why.toLowerCase() + '). Try describing it differently.' : 'Gemini answered without a picture. Check that the image model supports image output.' };
}
