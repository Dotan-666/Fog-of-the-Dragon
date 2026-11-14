/**
 * Foggy listening (advanced) — the pure parts. A short WAV chunk of the Dungeon Master's voice (recorded only after they
 * switched listening on) is sent with the campaign's music cue sheet; Gemini (audio input) transcribes it and says whether
 * the speech matches one of THOSE cues. Nothing else can be returned, and nothing is stored: not the audio, not the text.
 */
export const MAX_AUDIO_BASE64 = 1_400_000; // about 1 MB of WAV: ~30 s at 16 kHz mono
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '');

export interface Cue { id: string; moment: string; keywords: string[]; when: string }
export function validateRequest(b: unknown): { ok: true; campaignId: string; audio: string; cues: Cue[]; recent: string[] } | { ok: false; error: string } {
  if (!b || typeof b !== 'object') return { ok: false, error: 'Expected a JSON object.' };
  const o = b as Record<string, unknown>;
  const campaignId = String(o.campaignId || '');
  if (!UUID.test(campaignId)) return { ok: false, error: 'Missing campaign.' };
  const audio = typeof o.audio === 'string' ? o.audio : '';
  if (!/^[A-Za-z0-9+/=]{100,}$/.test(audio.slice(0, 200)) || audio.length > MAX_AUDIO_BASE64) return { ok: false, error: 'Audio chunk missing or too long.' };
  const cues = (Array.isArray(o.cues) ? o.cues : []).slice(0, 80).map((c) => {
    const x = (c || {}) as Record<string, unknown>;
    return { id: clean(x.id, 40), moment: clean(x.moment, 200), when: clean(x.when, 10), keywords: (Array.isArray(x.keywords) ? x.keywords : []).map((k) => clean(k, 40)).filter(Boolean).slice(0, 8) };
  }).filter((c) => /^[\w-]{1,40}$/.test(c.id) && c.moment);
  if (!cues.length) return { ok: false, error: 'There is no music plan to listen for.' };
  const recent = (Array.isArray(o.recent) ? o.recent : []).map((x) => clean(x, 40)).slice(0, 5);
  return { ok: true, campaignId, audio, cues, recent };
}

export function listenRequest(audio: string, cues: Cue[], recent: string[]) {
  const list = cues.map((c) => `${c.id} | ${c.when} | ${c.moment}${c.keywords.length ? ' | e.g. "' + c.keywords.join('", "') + '"' : ''}`).join('\n');
  return {
    systemInstruction: { parts: [{ text: 'You listen to a Dungeon Master narrating a tabletop game session. Transcribe the speech, then decide whether it clearly describes one of the listed music moments happening NOW (not mentioned in passing, not hypothetical, not a rules discussion or table chatter). Choose at most one cue id from the list, exactly as written, or an empty string. confidence is 0 to 1. Answer with JSON {"transcript","cueId","confidence"}.' }] },
    contents: [{ role: 'user', parts: [
      { text: '## Music moments (id | when | moment | typical words)\n' + list + (recent.length ? '\n## Just played (avoid repeating unless clearly a new moment)\n' + recent.join(', ') : '') + '\n## Audio follows.' },
      { inlineData: { mimeType: 'audio/wav', data: audio } },
    ] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { transcript: { type: 'STRING' }, cueId: { type: 'STRING' }, confidence: { type: 'NUMBER' } }, required: ['transcript', 'cueId', 'confidence'] } },
  };
}

export function parseListen(json: unknown, cues: Cue[]): { transcript: string; cueId: string; confidence: number } | null {
  const text = (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '') || '';
  let d: Record<string, unknown>;
  try { d = JSON.parse(text); } catch { return null; }
  const id = clean(d.cueId, 40);
  const conf = Math.max(0, Math.min(1, Number(d.confidence) || 0));
  return { transcript: clean(d.transcript, 1000), cueId: cues.some((c) => c.id === id) ? id : '', confidence: conf };
}
