/**
 * Shared Gemini call for the Edge Functions (foggy-generate, marketplace-review).
 * - The key comes from the server secret and goes in a header (never in the URL, never logged).
 * - Gemini 2.5 models "think" before answering and that counts against the output limit, which cut answers off
 *   mid-JSON. Thinking is switched off here (structured, short answers don't need it) and the limit is generous.
 * - Google's error is turned into a plain reason (bad key, no quota, unknown model…) so the app can say what is wrong.
 */

export interface GeminiResult { ok: true; json: unknown; finishReason: string }
export interface GeminiFailure { ok: false; status: number; code: string; message: string }

export function cleanKey(raw: string | undefined | null): string {
  return String(raw || '').trim().replace(/^["']|["']$/g, '');
}

/** Adds the settings every structured call needs (no thinking, enough room for the JSON). */
export function withDefaults(body: Record<string, unknown>, maxOutputTokens = 4096): Record<string, unknown> {
  const gc = (body.generationConfig || {}) as Record<string, unknown>;
  return { ...body, generationConfig: { ...gc, maxOutputTokens: Math.max(Number(gc.maxOutputTokens) || 0, maxOutputTokens), thinkingConfig: { thinkingBudget: 0 } } };
}

/** Explains a Gemini error response in words the site owner can act on. */
export function explainError(status: number, text: string): { code: string; message: string } {
  const t = String(text || '');
  if (/API_KEY_INVALID|API key not valid|API key expired/i.test(t)) return { code: 'bad_key', message: 'The Gemini API key on the server was rejected by Google. Check the GEMINI_API_KEY secret (it should start with "AIza").' };
  if (status === 403 || /PERMISSION_DENIED|SERVICE_DISABLED|has not been used in project|is disabled/i.test(t)) return { code: 'no_access', message: 'Google refused the request: the Generative Language API isn’t enabled for this key’s project, or the key is restricted.' };
  if (status === 404 || /is not found|not supported for generateContent/i.test(t)) return { code: 'bad_model', message: 'The Gemini model isn’t available for this key. Remove or change the GEMINI_MODEL secret.' };
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(t)) return { code: 'busy', message: 'The Gemini quota for this key is used up for now. Try again later (or check the plan in Google AI Studio).' };
  if (/location is not supported|User location/i.test(t)) return { code: 'region', message: 'Google doesn’t offer the Gemini API from the server’s region.' };
  if (status === 400) return { code: 'ai_error', message: 'Gemini refused the request (' + (t.match(/"message":\s*"([^"]{1,160})/)?.[1] || 'bad request') + ').' };
  return { code: 'ai_error', message: 'The AI service returned an error (' + status + ').' };
}

export async function callGemini(key: string, model: string, body: Record<string, unknown>, timeoutMs: number, maxOutputTokens = 4096): Promise<GeminiResult | GeminiFailure> {
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(withDefaults(body, maxOutputTokens)),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const timeout = e instanceof Error && /timeout|abort/i.test(e.name + e.message);
    return { ok: false, status: 504, code: 'ai_error', message: timeout ? 'The AI service took too long to answer. Try again.' : 'The AI service couldn’t be reached.' };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const e = explainError(res.status, text);
    console.error('gemini:', res.status, e.code); // status and our code only: never the key or the prompt
    return { ok: false, status: res.status, ...e };
  }
  const json = await res.json().catch(() => null);
  const c = (json as { candidates?: { finishReason?: string }[]; promptFeedback?: { blockReason?: string } } | null);
  if (!c?.candidates?.length) {
    return { ok: false, status: 422, code: 'blocked', message: c?.promptFeedback?.blockReason ? 'Gemini declined this request (' + c.promptFeedback.blockReason.toLowerCase() + '). Try rephrasing.' : 'Gemini gave no answer. Try again.' };
  }
  return { ok: true, json, finishReason: String(c.candidates[0].finishReason || '') };
}
