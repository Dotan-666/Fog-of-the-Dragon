/**
 * Pure logic for the optional AI Character Guide (no Deno/Node APIs here, so it is unit-testable).
 *
 * The browser sends only facts the rules engine already verified. The model may only rephrase them
 * into friendlier prose; it is told not to add rules, numbers, spells or features. Its output is
 * shape-checked here and checked again in the browser against the SRD dataset before display.
 */

export const MAX_BODY_BYTES = 24_000;
export const SECTION_IDS = ['who', 'howToPlay', 'combos', 'strengths'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface GuideFacts {
  rulesVersion: string;
  hash: string;
  headline: string;
  identity: string[];
  roles: string[];
  numbers: Record<string, string>;
  abilities: { name: string; actionType: string; what: string }[];
  combat: string[];
  outside: string[];
  mistakes: string[];
  combos: { title: string; why: string; status: string }[];
  strengths: string[];
  weaknesses: string[];
}

export interface AiSection {
  id: SectionId;
  paragraphs: string[];
}

const isStr = (x: unknown, max = 600): x is string => typeof x === 'string' && x.length > 0 && x.length <= max;
const strList = (x: unknown, maxItems: number, maxLen = 600): x is string[] =>
  Array.isArray(x) && x.length <= maxItems && x.every((s) => isStr(s, maxLen));

/** Validate the request body; returns an error message or null. */
export function validateFacts(body: unknown): string | null {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object.';
  const f = (body as { facts?: unknown }).facts as Partial<GuideFacts> | undefined;
  if (!f || typeof f !== 'object') return 'Missing facts.';
  if (!isStr(f.rulesVersion, 40) || !/^srd-5\.2\.1$/.test(f.rulesVersion)) return 'Unsupported rules version.';
  if (!isStr(f.hash, 16) || !/^[0-9a-f]{8}$/.test(f.hash)) return 'Invalid hash.';
  if (!isStr(f.headline, 200)) return 'Invalid headline.';
  if (!strList(f.identity, 8) || !strList(f.roles, 8, 60)) return 'Invalid identity.';
  if (!f.numbers || typeof f.numbers !== 'object' || Object.keys(f.numbers).length > 20 || !Object.values(f.numbers).every((v) => isStr(v, 60))) return 'Invalid numbers.';
  if (!Array.isArray(f.abilities) || f.abilities.length > 60 || !f.abilities.every((a) => a && isStr(a.name, 80) && isStr(a.actionType, 40) && isStr(a.what, 700))) return 'Invalid abilities.';
  for (const k of ['combat', 'outside', 'mistakes', 'strengths', 'weaknesses'] as const) if (!strList(f[k], 20)) return 'Invalid ' + k + '.';
  if (!Array.isArray(f.combos) || f.combos.length > 40 || !f.combos.every((c) => c && isStr(c.title, 120) && isStr(c.why, 600) && isStr(c.status, 20))) return 'Invalid combos.';
  return null;
}

export function buildPrompt(f: GuideFacts): { system: string; user: string } {
  const system = [
    'You help new Dungeons & Dragons players understand their character.',
    'You are given VERIFIED FACTS produced by a rules engine for the 2024 rules (SRD 5.2.1).',
    'Rewrite them as short, friendly, encouraging paragraphs for a beginner.',
    'STRICT RULES:',
    '- Use only the facts given. Do not add any rule, number, dice, spell, feature, feat, item or ability that is not in the facts.',
    '- Do not decide whether anything is legal and do not calculate any statistic. Copy numbers exactly as given.',
    '- Do not invent backstory beyond the given identity lines.',
    '- If you are unsure, leave it out.',
    'Return JSON only: {"sections":[{"id":"who"|"howToPlay"|"combos"|"strengths","paragraphs":["..."]}]} with at most 3 paragraphs per section and at most 90 words per paragraph.',
  ].join('\n');
  const user = 'VERIFIED FACTS (JSON):\n' + JSON.stringify(f);
  return { system, user };
}

/** Gemini generateContent request body. */
export function geminiRequest(f: GuideFacts) {
  const p = buildPrompt(f);
  return {
    systemInstruction: { parts: [{ text: p.system }] },
    contents: [{ role: 'user', parts: [{ text: p.user }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1400, responseMimeType: 'application/json' },
  };
}

/** Extract and shape-check the sections from a Gemini response. Throws on anything unexpected. */
export function parseGeminiResponse(json: unknown): AiSection[] {
  const text = (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) throw new Error('Empty model response');
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    throw new Error('Model response was not JSON');
  }
  const sections = (data as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) throw new Error('Model response has no sections');
  const out: AiSection[] = [];
  for (const s of sections) {
    const id = (s as { id?: unknown }).id;
    const paragraphs = (s as { paragraphs?: unknown }).paragraphs;
    if (!SECTION_IDS.includes(id as SectionId) || !Array.isArray(paragraphs)) continue;
    const clean = paragraphs.filter((p): p is string => typeof p === 'string').map((p) => p.replace(/\s+/g, ' ').trim()).filter((p) => p.length > 0 && p.length <= 900).slice(0, 3);
    if (clean.length && !out.some((o) => o.id === id)) out.push({ id: id as SectionId, paragraphs: clean });
  }
  if (!out.length) throw new Error('Model response had no usable sections');
  return out;
}

/** Very small fixed-window rate limiter (per function instance). */
export function makeRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()): boolean => {
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= limit) {
      hits.set(key, list);
      return false;
    }
    list.push(now);
    hits.set(key, list);
    return true;
  };
}
