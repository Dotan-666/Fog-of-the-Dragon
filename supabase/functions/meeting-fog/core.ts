/**
 * Meeting in the Fog — the pure parts of the Edge Function (no network, no database): request checks, the media
 * provider's configuration, and the exact permissions put into a join token.
 */

export const MAX_BODY_BYTES = 1_000;
export const TOKEN_TTL_SECONDS = 15 * 60; // short-lived; the app asks for a new one to reconnect
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Action = 'status' | 'join' | 'close';
export interface Grant { roomId: string; campaignId: string; providerRoom: string; provider: string; title: string; role: 'dm' | 'player'; name: string; userId: string }

export function validateRequest(body: unknown): { ok: true; action: Action; roomId: string | null } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Expected a JSON object.' };
  const b = body as Record<string, unknown>;
  if (b.action !== 'status' && b.action !== 'join' && b.action !== 'close') return { ok: false, error: 'Unknown action.' };
  if (b.action === 'status') return { ok: true, action: 'status', roomId: null };
  const id = String(b.roomId || '');
  if (!UUID.test(id)) return { ok: false, error: 'Invalid room id.' };
  return { ok: true, action: b.action, roomId: id };
}

/** The media provider's settings from the server secrets; null when anything is missing (the app then says "not set up"). */
export function providerConfig(env: Record<string, string | undefined>): { url: string; apiKey: string; apiSecret: string } | null {
  const url = (env.LIVEKIT_URL || '').trim();
  const apiKey = (env.LIVEKIT_API_KEY || '').trim();
  const apiSecret = (env.LIVEKIT_API_SECRET || '').trim();
  if (!/^wss:\/\/[a-z0-9.-]+(:\d+)?(\/.*)?$/i.test(url) || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}

/** The HTTPS address of the same LiveKit server (for the server API: closing rooms). */
export function apiHost(wsUrl: string): string {
  return wsUrl.replace(/^wss:/i, 'https:').replace(/\/+$/, '');
}

/**
 * What a join token allows. Everyone may publish their camera and microphone and receive the others; only the DM may
 * send data messages (music and soundboard commands). Never: recording, room administration, screen share, hidden mode.
 */
export function tokenGrant(g: Grant) {
  return {
    roomJoin: true,
    room: g.providerRoom,
    canPublish: true,
    canSubscribe: true,
    canPublishData: g.role === 'dm',
    canPublishSources: ['camera', 'microphone'],
    canUpdateOwnMetadata: false,
    hidden: false,
    recorder: false,
    roomAdmin: false,
    roomRecord: false,
  };
}

export function tokenIdentity(g: Grant) {
  return { identity: g.userId, name: g.name.slice(0, 60), ttl: TOKEN_TTL_SECONDS, metadata: JSON.stringify({ role: g.role, campaignId: g.campaignId }) };
}
