/**
 * Meeting in the Fog: the Edge Function's pure rules (supabase/functions/meeting-fog/core.ts), the shared-audio model
 * (JS/Campaign/meeting/shared-audio.js), the call session (meeting-session.js) with a stand-in provider, and static checks
 * that no secret or permanent token reaches the browser. Run with: node --test "tests/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/sandbox.mjs';
import * as core from '../supabase/functions/meeting-fog/core.ts';

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const U = '3b241101-e2bb-4255-8caf-4136c566a962';
const J = (x) => JSON.parse(JSON.stringify(x)); // objects made inside the test sandbox
function load(files, extra = {}) {
  const window = Object.assign({ console, setInterval: () => 0, clearInterval: () => {}, setTimeout, Date, Math, JSON, Promise, crypto: globalThis.crypto }, extra);
  window.window = window;
  const ctx = vm.createContext(window);
  for (const f of files) vm.runInContext(read(f), ctx);
  return window;
}

test('requests: only status, join and close; join and close need a room id', () => {
  assert.deepEqual(core.validateRequest({ action: 'status' }), { ok: true, action: 'status', roomId: null });
  assert.equal(core.validateRequest({ action: 'join' }).ok, false);
  assert.equal(core.validateRequest({ action: 'record', roomId: U }).ok, false, 'there is no recording action');
  assert.deepEqual(core.validateRequest({ action: 'close', roomId: U }), { ok: true, action: 'close', roomId: U });
});

test('provider settings come only from the server secrets; anything missing means "not configured"', () => {
  assert.equal(core.providerConfig({}), null);
  assert.equal(core.providerConfig({ LIVEKIT_URL: 'wss://x.livekit.cloud', LIVEKIT_API_KEY: 'k' }), null);
  assert.equal(core.providerConfig({ LIVEKIT_URL: 'http://insecure', LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's' }), null, 'only wss');
  assert.deepEqual(core.providerConfig({ LIVEKIT_URL: ' wss://fod.livekit.cloud ', LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's' }), { url: 'wss://fod.livekit.cloud', apiKey: 'k', apiSecret: 's' });
  assert.equal(core.apiHost('wss://fod.livekit.cloud/'), 'https://fod.livekit.cloud');
});

test('join tokens: 15 minutes, this room only, camera and microphone only, data only for the DM, never recording or admin', () => {
  const g = { roomId: U, campaignId: U, providerRoom: 'fod-' + U, provider: 'livekit', title: 'Session', role: 'player', name: 'Pip the Bard with a very long name that goes on and on and on forever', userId: U };
  const p = core.tokenGrant(g);
  assert.deepEqual([p.roomJoin, p.room, p.canPublish, p.canSubscribe, p.canPublishData, p.recorder, p.roomAdmin, p.roomRecord, p.hidden], [true, 'fod-' + U, true, true, false, false, false, false, false]);
  assert.deepEqual(p.canPublishSources, ['camera', 'microphone'], 'no screen share');
  assert.equal(core.tokenGrant({ ...g, role: 'dm' }).canPublishData, true);
  const id = core.tokenIdentity(g);
  assert.equal(id.ttl, 900);
  assert.equal(id.identity, U);
  assert.ok(id.name.length <= 60);
  assert.deepEqual(JSON.parse(id.metadata), { role: 'player', campaignId: U });
});

test('the Edge Function: membership checked by the database first, secrets from the environment, nothing logged', () => {
  const idx = code('supabase/functions/meeting-fog/index.ts');
  assert.match(idx, /rpc\('meeting_join_grant'/, 'the database decides who may join');
  assert.ok(idx.indexOf("rpc('meeting_join_grant'") < idx.indexOf('new AccessToken'), 'checked before any token is made');
  assert.match(idx, /providerConfig\(Deno\.env\.toObject\(\)\)/);
  assert.ok(!/console\.(log|error)\([^)]*\b(jwt|cfg|apiSecret|apiKey|token\b(?!\s*error))/.test(idx.replace(/'meeting-fog: token error'/g, '')), 'tokens and secrets are never logged');
  assert.ok(!/Egress|startRoomCompositeEgress|recording/i.test(idx.replace(/Recording is never enabled/g, '')), 'no recording');
  assert.match(idx, /'Cache-Control': 'no-store'/);
});

test('the browser: no LiveKit secret, no token minting, the SDK pinned with Subresource Integrity', () => {
  for (const f of ['JS/Campaign/meeting/fog-media.js', 'JS/Campaign/meeting/meeting-session.js', 'JS/Campaign/meeting/meeting-ui.js', 'JS/Campaign/meeting/meeting-card.js', 'JS/Campaign/campaign-data.js']) {
    const c = code(f);
    assert.ok(!/LIVEKIT_API_SECRET|LIVEKIT_API_KEY|apiSecret|\bAccessToken\b|livekit-server-sdk/.test(c), f + ' holds no secret and mints no token');
    assert.ok(!/console\.(log|info|debug)\([^)]*token/i.test(c), f + ' never logs tokens');
  }
  const media = read('JS/Campaign/meeting/fog-media.js');
  assert.match(media, /livekit-client@2\.23\.0\/dist\/livekit-client\.umd\.js/);
  assert.match(media, /sha384-[A-Za-z0-9+/=]{64}/);
  assert.ok(!/meet\.google|google\.com\/calendar/i.test(code('JS/Campaign/pages/scheduler-ui.js')), 'no Google Meet links are made');
});

// ---- shared audio -------------------------------------------------------------------------------------------------
const A = load(['JS/Campaign/meeting/shared-audio.js']);
const SA = A.FogSharedAudio;

test('shared audio: commands are validated; only catalog recordings can be shared', () => {
  assert.equal(SA.validate({ action: 'play', ref: 'rec:tavern-1' }), null);
  assert.match(SA.validate({ action: 'play', ref: 'up:my-private-file' }), /catalog/);
  assert.match(SA.validate({ action: 'play' }), /Which track/);
  assert.match(SA.validate({ action: 'explode' }), /Unknown/);
  assert.match(SA.validate({ action: 'volume', volume: 3 }), /volume/);
  assert.equal(SA.validate({ action: 'stop' }), null);
});

test('shared audio: from the DM’s player — track changes, pause, stop; repeats are not sent; private uploads become “stop”', () => {
  const play = { current: { ref: 'rec:a', title: 'Tavern' }, playing: true, position: 12.34 };
  const c1 = SA.fromPlayer(play, null);
  assert.deepEqual([c1.action, c1.ref, c1.playing, c1.position], ['track', 'rec:a', true, 12.3]);
  const sent = { ...c1, action: 'play', serverAt: new Date().toISOString() };
  assert.equal(SA.fromPlayer({ ...play, position: 13 }, sent), null, 'the same track playing on: nothing to send');
  assert.equal(SA.fromPlayer({ ...play, position: 200 }, sent).action, 'play', 'a big jump (seek) is sent');
  assert.equal(SA.fromPlayer({ ...play, playing: false }, sent).action, 'pause');
  assert.equal(SA.fromPlayer({ current: null, playing: false }, sent).action, 'stop');
  assert.deepEqual(J(SA.fromPlayer({ current: { ref: 'up:secret', title: 'My file' }, playing: true }, sent)), { action: 'stop', ref: null, title: null, playing: false, position: 0 });
  assert.equal(SA.fromPlayer({ current: { ref: 'up:secret' }, playing: true }, { action: 'stop' }), null);
});

test('shared audio: players line up with the server clock (late joiners start at the right place), and re-seek only on real drift', () => {
  const t = Date.parse('2026-11-13T20:00:00Z');
  const st = { action: 'play', ref: 'rec:a', playing: true, position: 10, serverAt: '2026-11-13T19:59:30Z', seq: 4 };
  assert.deepEqual(J(SA.plan(st, null, 0, t)), { op: 'play', ref: 'rec:a', at: 40 }, 'joined 30 s later: starts at 40 s');
  assert.equal(SA.plan(st, null, 5000, t).at, 45, 'the device clock is 5 s behind the server');
  assert.deepEqual(J(SA.plan(st, { current: { ref: 'rec:a' }, playing: true, position: 39, duration: 300 }, 0, t)), { op: 'none' });
  assert.deepEqual(J(SA.plan(st, { current: { ref: 'rec:a' }, playing: true, position: 20, duration: 300 }, 0, t)), { op: 'seek', at: 40 });
  assert.equal(SA.plan(st, { current: { ref: 'rec:a' }, playing: true, position: 5, duration: 30 }, 0, t).op, 'seek', 'looping music wraps');
  assert.deepEqual(J(SA.plan({ ...st, playing: false, action: 'pause' }, { current: { ref: 'rec:a' }, playing: true }, 0, t)), { op: 'pause' });
  assert.deepEqual(J(SA.plan({ action: 'stop' }, { current: { ref: 'rec:a' }, playing: true }, 0, t)), { op: 'stop' });
  assert.deepEqual(J(SA.plan({ action: 'play', ref: 'javascript:x', playing: true }, null, 0, t)), { op: 'none' }, 'invalid commands do nothing');
});

test('shared audio: apply uses the existing player API; a track that can’t play is reported', async () => {
  const calls = [];
  const player = { state: () => ({ current: null, playing: false }), play: async (r) => { calls.push(['play', r]); return true; }, seek: (s) => calls.push(['seek', Math.round(s)]), pause: () => calls.push(['pause']), stop: () => calls.push(['stop']), resume: () => calls.push(['resume']) };
  const op = await SA.apply({ action: 'play', ref: 'rec:a', playing: true, position: 30, serverAt: new Date().toISOString() }, player, 0);
  assert.equal(op, 'play');
  assert.deepEqual(calls, [['play', 'rec:a'], ['seek', 30]]);
  assert.equal(await SA.apply({ action: 'play', ref: 'rec:b', playing: true, position: 0, serverAt: new Date().toISOString() }, { ...player, play: async () => false }, 0), 'failed');
  assert.ok(SA.nextSeq(5) > 5 && SA.nextSeq(Date.now() + 1e6) > Date.now() + 1e6, 'monotonic');
});

test('soundboard events (architecture only): catalog sounds, unique ids, dedupe', () => {
  const E = A.FogMeetingEvents;
  const e = E.make('rec:thunder', 0.8);
  assert.equal(E.SOUNDBOARD_TOPIC, 'fod.soundboard');
  assert.equal(E.validate(e), null);
  assert.match(E.validate({ ...e, ref: 'https://evil/x.mp3' }), /catalog/);
  assert.match(E.validate({ ...e, id: '' }), /id/);
  const seen = E.seenTracker();
  assert.equal(seen(e.id), false);
  assert.equal(seen(e.id), true, 'the same event twice plays once');
});

// ---- the session, with a stand-in provider -------------------------------------------------------------------------
function sessionWith({ token = { ok: true, token: 't1', url: 'wss://x', room: { id: 'r1', title: 'Session 3' } }, micError = null } = {}) {
  const log = [];
  let ev = null;
  const adapter = {
    connect: async (url, tok, e) => { log.push(['connect', url, tok]); ev = e; e.onState('connected'); },
    disconnect: async () => { log.push(['disconnect']); },
    publishMicrophone: async (on) => { log.push(['mic', on]); if (micError && on) throw micError; return on; },
    publishCamera: async (on) => { log.push(['cam', on]); return on; },
    getParticipants: () => [{ id: 'me', name: 'Me', isLocal: true }],
    listDevices: async () => [], switchDevice: async () => true, attachVideo: () => false,
  };
  const data = {
    joinRoom: async (id) => { log.push(['token', id]); return token; },
    leaveRoom: async (id) => { log.push(['leave', id]); return { ok: true }; },
    leaveRoomOnUnload: (id) => { log.push(['beacon', id]); return true; },
    heartbeat: async () => ({ ok: true, stillOpen: true }),
    serverClockOffset: async () => ({ ok: true, offset: 0 }),
    getRoom: async () => ({ ok: true, room: { id: 'r1', status: 'open', audioState: {} } }),
    rememberSession: () => {}, setRoomAudio: async () => ({ ok: true }),
  };
  const W = load(['JS/Campaign/meeting/fog-media.js', 'JS/Campaign/meeting/shared-audio.js', 'JS/Campaign/meeting/meeting-session.js']);
  W.FogMedia.register('stub', () => adapter);
  const s = W.FogMeetingSession.create({ isDm: false }, { data, media: W.FogMedia, provider: 'stub' });
  return { s, log, ev: () => ev };
}

test('session: join gets a token from the server, connects, asks for the microphone only then; leave cleans up and tells the database', async () => {
  const { s, log } = sessionWith();
  assert.equal(s.state().status, 'idle');
  assert.ok(!log.some((x) => x[0] === 'mic'), 'no permission prompt before joining');
  await s.join('r1');
  assert.deepEqual(log.slice(0, 3).map((x) => x[0]), ['token', 'connect', 'mic']);
  assert.equal(s.state().status, 'connected');
  assert.equal(s.state().mic, true);
  assert.equal(s.state().cam, false, 'camera off until asked');
  await s.join('r1');
  assert.equal(log.filter((x) => x[0] === 'connect').length, 1, 'joining the same room again does nothing');
  await s.leave();
  assert.deepEqual(log.slice(-2).map((x) => x[0]), ['disconnect', 'leave']);
  assert.equal(s.state().status, 'idle');
});

test('session: not configured on the server → a clear state, no connection, nothing fake', async () => {
  const { s, log } = sessionWith({ token: { ok: false, code: 'not_configured', message: 'Video meetings aren’t set up on the server yet.' } });
  await s.join('r1');
  assert.equal(s.state().status, 'unavailable');
  assert.match(s.state().error, /LiveKit/);
  assert.equal(s.state().participants.length, 0);
  assert.ok(!log.some((x) => x[0] === 'connect'));
});

test('session: a blocked microphone keeps you in the call and explains; the DM closing the room disconnects; page close records the leave', async () => {
  const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
  const { s, log } = sessionWith({ micError: err });
  await s.join('r1');
  assert.equal(s.state().status, 'connected');
  assert.match(s.state().notice, /blocked the microphone/);
  s.roomChanged({ id: 'r1', status: 'closed', audioState: {} });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(s.state().status, 'idle');
  assert.match(s.state().notice, /closed the room/);
  const two = sessionWith();
  await two.s.join('r1');
  two.s.destroy();
  assert.deepEqual(two.log.slice(-2).map((x) => x[0]), ['disconnect', 'beacon']);
});
