/**
 * Music store rules (playlists, favorites, history, preferences, uploads) and the cleanup of references to the
 * removed browser-generated tracks.
 * Run with: node --test "tests/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/sandbox.mjs';

function sandbox(initial) {
  const store = new Map(initial ? Object.entries(initial) : []);
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const window = { localStorage, console };
  const ctx = vm.createContext({ window, console, localStorage, Math, Date, JSON });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'JS/Dashboard/music/music-store.js'), 'utf8'), ctx, { filename: 'music-store.js' });
  return window.FogMusicStore;
}
const J = (x) => JSON.parse(JSON.stringify(x));

test('the browser-generated library is gone from the code', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'JS/Dashboard/music/sound-library.js')), false);
  const routes = fs.readFileSync(path.join(ROOT, 'JS/Dashboard/routes-config.js'), 'utf8');
  assert.ok(!/sound-library/.test(routes));
  for (const f of ['music-page.js', 'music-player.js', 'session-music.js']) {
    assert.ok(!/FogSoundLibrary/.test(fs.readFileSync(path.join(ROOT, 'JS/Dashboard/music', f), 'utf8')), f);
  }
});

test('saved references to removed generated tracks are dropped (no broken items)', () => {
  const old = { playlists: [{ id: 'pl_1', name: 'Old', items: ['lib:tavern-hearth', 'rec:the-old-tower-inn', 'lib:rainstorm'] }], favorites: ['lib:rainstorm', 'rec:wind'], history: [{ ref: 'lib:thunder', title: 'Thunder', at: '2026-11-01T00:00:00Z' }, { ref: 'rec:thunder', title: 'Thunder', at: '2026-11-02T00:00:00Z' }] };
  const S = sandbox({ fog_music_v1: JSON.stringify(old) });
  assert.deepEqual(J(S.getPlaylist('pl_1').items), ['rec:the-old-tower-inn']);
  assert.deepEqual(J(S.favorites()), ['rec:wind']);
  assert.deepEqual(J(S.history().map((h) => h.ref)), ['rec:thunder']);
  assert.equal(S.isRef('lib:tavern-hearth'), false);
  assert.equal(S.addToPlaylist('pl_1', 'lib:busy-tavern').ok, false);
});

test('playlists are created, filled, reordered, renamed and deleted', () => {
  const S = sandbox();
  assert.equal(S.createPlaylist('   ').ok, false);
  const p = S.createPlaylist('Tavern night').playlist;
  assert.ok(S.addToPlaylist(p.id, 'rec:the-old-tower-inn').ok);
  assert.ok(S.addToPlaylist(p.id, 'rec:crowd-shouting').ok);
  assert.equal(S.addToPlaylist(p.id, 'http://evil').ok, false, 'only valid refs');
  S.moveInPlaylist(p.id, 1, -1);
  assert.deepEqual(J(S.getPlaylist(p.id).items), ['rec:crowd-shouting', 'rec:the-old-tower-inn']);
  S.removeFromPlaylist(p.id, 0);
  assert.deepEqual(J(S.getPlaylist(p.id).items), ['rec:the-old-tower-inn']);
  assert.equal(S.renamePlaylist(p.id, 'Inn').playlist.name, 'Inn');
  S.deletePlaylist(p.id);
  assert.equal(S.getPlaylist(p.id), null);
});

test('favorites toggle, history is newest-first and capped, prefs are clamped', () => {
  const S = sandbox();
  assert.equal(S.toggleFavorite('rec:rain-loop'), true);
  assert.deepEqual(J(S.favorites()), ['rec:rain-loop']);
  assert.equal(S.toggleFavorite('rec:rain-loop'), false);
  for (let i = 0; i < 120; i++) S.addHistory({ ref: 'rec:thunder', title: 'T' + i, kind: 'sfx' });
  assert.equal(S.history().length, 100);
  assert.equal(S.history()[0].title, 'T119');
  S.clearHistory();
  assert.equal(S.history().length, 0);
  const p = S.setPrefs({ musicVolume: 400, sfxVolume: -3, generatedMinutes: -5, repeat: 'sometimes' });
  assert.deepEqual([p.musicVolume, p.sfxVolume, p.generatedMinutes, p.repeat], [100, 0, 1, 'all']);
});

test('only audio files are accepted for upload', () => {
  const S = sandbox();
  assert.equal(S.isAudioFile({ name: 'song.mp3', type: 'audio/mpeg' }), true);
  assert.equal(S.isAudioFile({ name: 'track.flac', type: '' }), true);
  assert.equal(S.isAudioFile({ name: 'evil.html', type: 'text/html' }), false);
  assert.equal(S.isAudioFile({ name: 'x.exe', type: '' }), false);
});
