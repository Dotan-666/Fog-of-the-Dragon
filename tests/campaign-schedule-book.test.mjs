/**
 * Scheduler analysis (JS/Campaign/schedule-model.js) and campaign book rendering (JS/Campaign/book-render.js).
 * Run with: node --test "tests/*.test.mjs"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './helpers/sandbox.mjs';

function load(file, global) {
  const window = {};
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), vm.createContext({ window, console, Date, Math, JSON }), { filename: file });
  return window[global];
}
const S = load('JS/Campaign/schedule-model.js', 'FogScheduleModel');
const B = load('JS/Campaign/book-render.js', 'FogBookRender');
// Values created inside the vm sandbox have another Array prototype; compare them as JSON.
const same = (a, b, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), b, msg);

const slots = [{ id: 's1', start: '2026-12-01T18:00:00Z', end: '2026-12-01T22:00:00Z' }, { id: 's2', start: '2026-12-02T18:00:00Z', end: '2026-12-02T22:00:00Z' }, { id: 's3', start: '2026-12-03T18:00:00Z', end: '2026-12-03T22:00:00Z' }];
const resp = (userId, availability, extra = {}) => ({ userId, availability, canHost: false, ...extra });
const req = (required) => ({ required, slots });

test('slots: dates × time ranges, ids unique, invalid ranges skipped', () => {
  const out = S.buildSlots(['2026-12-02', '2026-12-01'], [{ from: '18:00', to: '22:00' }, { from: '14:00', to: '18:00' }, { from: '20:00', to: '19:00' }]);
  assert.equal(out.length, 4);
  same(out.map((s) => s.id), ['s1', 's2', 's3', 's4']);
  assert.ok(new Date(out[0].start) < new Date(out[2].start), 'sorted by date');
  same(S.datesBetween('2026-12-01', '2026-12-04'), ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04']);
  assert.equal(S.datesBetween('2026-01-01', '2027-12-31').length, 60, 'at most 60 dates');
  same(S.datesBetween('nope', '2026-12-04'), []);
});

test('consensus: only slots where EVERY required person is available or prefers it; "maybe" is not a yes', () => {
  const r = req(['a', 'b', 'c']);
  const a = S.analyze(r, [
    resp('a', { s1: 'available', s2: 'preferred', s3: 'available' }),
    resp('b', { s1: 'available', s2: 'maybe', s3: 'unavailable' }),
    resp('c', { s1: 'preferred', s2: 'available', s3: 'available' }),
  ]);
  same(a.unanimous.map((s) => s.slot.id), ['s1']);
  assert.equal(a.slots.find((s) => s.slot.id === 's2').unanimous, false, 'one "maybe" blocks it');
  same(a.slots.find((s) => s.slot.id === 's3').by.unavailable, ['b']);
  assert.equal(a.closest.length, 2);
  assert.equal(a.closest[0].slot.id, 's2', 'the closest alternative has the most yes answers');
  same(a.waiting, []);
});

test('nobody is silently excluded: people who have not answered count against every slot', () => {
  const r = req(['a', 'b', 'c']);
  const a = S.analyze(r, [resp('a', { s1: 'available', s2: 'available', s3: 'available' }), resp('b', { s1: 'available', s2: 'available', s3: 'available' })]);
  assert.equal(a.unanimous.length, 0, 'c has not answered, so nothing is unanimous');
  same(a.waiting, ['c']);
  same(a.slots[0].by.none, ['c']);
  const unanswered = S.analyze(r, [resp('a', { s1: 'available' }), resp('b', {}), resp('c', {})]);
  same(unanswered.slots[1].by.unavailable, ['a', 'b', 'c'], 'a slot left blank means not available');
  const nobody = S.analyze({ required: [], slots }, []);
  assert.equal(nobody.unanimous.length, 0, 'an empty party never produces a "unanimous" time');
});

test('hosts: only people who can host and have an address they can share are offered', () => {
  const responses = [resp('a', {}, { canHost: true }), resp('b', {}, { canHost: false }), resp('c', {}, { canHost: true })];
  same(S.eligibleHosts(responses, [{ userId: 'a' }, { userId: 'b' }]), ['a']);
});

test('states: open for answers only while waiting and before the deadline; a past deadline reads as expired', () => {
  const now = new Date('2026-12-01T12:00:00Z');
  assert.equal(S.isOpenForAnswers({ status: 'waiting', due: null }, now), true);
  assert.equal(S.isOpenForAnswers({ status: 'consensus', due: '2026-12-02T00:00:00Z' }, now), true);
  assert.equal(S.isOpenForAnswers({ status: 'waiting', due: '2026-11-30T00:00:00Z' }, now), false);
  assert.equal(S.isOpenForAnswers({ status: 'awaiting_confirmation', due: null }, now), false);
  assert.equal(S.isOpenForAnswers({ status: 'confirmed', due: null }, now), false);
  assert.equal(S.effectiveStatus({ status: 'waiting', due: '2026-11-30T00:00:00Z' }, now), 'waiting', 'the deadline only closes answers; the server moves the request on');
  assert.equal(S.isOpenForAnswers({ status: 'consensus', due: null, answersClosed: true }, now), false, 'answers closed by the deadline');
  assert.equal(S.effectiveStatus({ status: 'confirmed', due: '2026-11-30T00:00:00Z' }, now), 'confirmed', 'a confirmed meeting never expires');
  assert.equal(S.effectiveStatus({ status: 'cancelled', due: null }, now), 'cancelled');
  same(Object.keys(S.STATE_LABEL), ['draft', 'waiting', 'consensus', 'awaiting_confirmation', 'confirmed', 'cancelled', 'expired']);
});

const book = {
  campaign: { name: 'The <b>Ashen</b> Crown', description: 'A drowned keep.\n\nAnd a crown.', cover_url: null },
  dm: 'Morgan', party: [{ player: 'Riley', character: 'Brienne' }],
  meetings: [{ id: 'm1', title: 'The Ford', starts_at: '2026-10-11T18:00:00Z', summary: 'They crossed.' }, { id: 'm2', title: 'The Gate', starts_at: '2026-10-18T18:00:00Z', summary: '' }],
  memories: [
    { id: 'r1', kind: 'recap', title: 'Recap: The Ford', content: '', occurred_on: '2026-10-11', meeting_id: 'm1', subject: '', image_path: null, recap: { happened: 'Crossed <script>x</script> the ford.', threads: 'Who is Vance?' } },
    { id: 'q1', kind: 'quote', title: 'Warning', content: 'Never trust ink.', occurred_on: null, meeting_id: null, subject: 'Old Marta', image_path: 'c/players/a.jpg', recap: null },
    { id: 'n1', kind: 'npc', title: 'Lord Vance', content: 'Thin, inky.', occurred_on: null, meeting_id: null, subject: '', image_path: null, recap: null },
  ],
  history: [{ kind: 'started', summary: 'The campaign started.', at: '2026-10-01T10:00:00Z' }],
};

test('book: title page, party, timeline, chapters in order, recap sections, quotes with attribution', () => {
  const html = B.render(book, { 'c/players/a.jpg': 'https://img.example/a.jpg' });
  assert.match(html, /<h1>The &lt;b&gt;Ashen&lt;\/b&gt; Crown<\/h1>/, 'the title is escaped');
  assert.match(html, /Told at the table of Morgan/);
  assert.match(html, /<strong>Brienne<\/strong><span>played by Riley/);
  assert.ok(html.indexOf('Chapter I') < html.indexOf('Chapter II'));
  assert.match(html, /Chapter I<\/p><h3>The Ford/);
  assert.match(html, /What happened<\/h5><p>Crossed &lt;script&gt;x&lt;\/script&gt; the ford\./, 'recap text is escaped');
  assert.match(html, /Unresolved threads/);
  assert.match(html, /<blockquote class="bk-quote"><p>Never trust ink\.<\/p><cite>Old Marta<\/cite><\/blockquote>/);
  assert.match(html, /src="https:\/\/img\.example\/a\.jpg"/);
  assert.match(html, /No recap was written for this session\./, 'a meeting without a recap says so instead of inventing one');
  assert.match(html, /Important people/);
  assert.match(html, /The campaign started\./);
  assert.ok(!/<script>/.test(html), 'no raw HTML from user text');
});

test('book: only draws what it is given and leaves out images it has no URL for', () => {
  const html = B.render({ ...book, memories: [{ ...book.memories[1] }] }, {});
  assert.ok(!/<img class="bk-figure|<figure/.test(html), 'a memory image with no signed URL is omitted, not guessed');
  assert.ok(!/Lord Vance/.test(html));
  const empty = B.render({ campaign: { name: 'Empty' }, party: [], meetings: [], memories: [], history: [] }, {});
  assert.match(empty, /Chapters appear as sessions are completed/);
  assert.match(empty, /No party yet/);
});
