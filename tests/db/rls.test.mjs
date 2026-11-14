/**
 * Database security tests for supabase/migrations — run with:
 *
 *   npm install --no-save @electric-sql/pglite      (one-time; Postgres compiled to WebAssembly)
 *   node --test tests/db/rls.test.mjs
 *
 * Applies the real migration files to an in-memory Postgres that mimics Supabase (tests/db/supabase-shim.sql),
 * then acts as different signed-in users (role "authenticated" + JWT "sub") and as anonymous visitors to check
 * that Row Level Security and column privileges block everything they should.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// PGLITE_MODULE can point at a PGlite install elsewhere (path to its dist/index.js).
let PGlite;
try {
  ({ PGlite } = await import(process.env.PGLITE_MODULE ? pathToFileURL(process.env.PGLITE_MODULE).href : '@electric-sql/pglite'));
} catch {
  console.error('These tests need PGlite. Install it with:  npm install --no-save @electric-sql/pglite');
  process.exit(1);
}

const db = new PGlite();
const users = {};

/** Runs SQL as a signed-in user (or anon when uid is null). Returns { rows, affected } or { error }. */
async function as(uid, sql, params = []) {
  try {
    await db.exec('begin');
    await db.exec(uid ? 'set local role authenticated' : 'set local role anon');
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [uid ? JSON.stringify({ sub: uid, role: 'authenticated' }) : '']);
    const res = await db.query(sql, params);
    await db.exec('commit');
    return { rows: res.rows, affected: res.affectedRows ?? 0 };
  } catch (e) {
    await db.exec('rollback');
    return { error: e.message };
  }
}

/** Creates an auth user the way Supabase sign-up does (fires the profile trigger). */
async function signUp(email, meta = {}) {
  const res = await db.query('insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id', [email, meta]);
  const id = res.rows[0].id;
  // Every campaign needs one of its DM's adventures, so each test user starts with one.
  await db.query(`insert into public.adventures (owner_id, title) values ($1, 'Default adventure')`, [id]);
  return id;
}

before(async () => {
  await db.exec(fs.readFileSync(path.join(ROOT, 'tests/db/supabase-shim.sql'), 'utf8'));
  const dir = process.env.MIGRATIONS_DIR || path.join(ROOT, 'supabase/migrations');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  }
  users.a = await signUp('alice@example.com', { username: 'Alice_DM', display_name: 'Alice' });
  users.b = await signUp('bob@example.com', { username: 'bob' });
  users.c = await signUp('carol@example.com');
  users.d = await signUp('dave@example.com', { username: 'alice_dm' }); // username already taken
  users.e = await signUp('eve@example.com', { username: 'x!' }); // invalid username
});

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------
test('sign-up creates a profile for every user without blocking on bad or taken usernames', async () => {
  const rows = (await db.query('select id, username, display_name from public.profiles order by display_name')).rows;
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(rows.length, 5);
  assert.deepEqual([byId[users.a].username, byId[users.a].display_name], ['alice_dm', 'Alice']);
  assert.equal(byId[users.b].display_name, 'bob');
  assert.deepEqual([byId[users.c].username, byId[users.c].display_name], [null, 'carol']);
  assert.match(byId[users.d].username, /^alice_dm_[0-9a-f]{4}$/);
  assert.equal(byId[users.e].username, null);
});

test('a user reads only their own profile', async () => {
  const all = await as(users.a, 'select id from public.profiles');
  assert.deepEqual(all.rows.map((r) => r.id), [users.a]);
  const other = await as(users.a, 'select * from public.profiles where id = $1', [users.b]);
  assert.equal(other.rows.length, 0);
});

test('a user updates their own profile but never someone else\'s', async () => {
  const own = await as(users.a, `update public.profiles set display_name = 'Alice the Bold', bio = 'DM' where id = $1`, [users.a]);
  assert.equal(own.affected, 1);
  const other = await as(users.a, `update public.profiles set display_name = 'hacked' where id = $1`, [users.b]);
  assert.equal(other.affected, 0);
  const b = (await db.query('select display_name from public.profiles where id = $1', [users.b])).rows[0];
  assert.equal(b.display_name, 'bob');
});

// Without a WHERE clause Postgres checks only the UPDATE/DELETE policy (not the SELECT one),
// so these catch a too-permissive write policy that the SELECT policy would otherwise mask.
test('blanket updates and deletes touch only rows the user may change', async () => {
  assert.equal((await as(users.c, `update public.profiles set bio = 'blanket'`)).affected, 1);
  assert.equal((await db.query(`select count(*)::int as n from public.profiles where bio = 'blanket'`)).rows[0].n, 1);
  await as(users.c, `update public.profiles set bio = null`);
});

test('protected profile columns cannot be changed', async () => {
  assert.match((await as(users.a, `update public.profiles set id = $1 where id = $2`, [users.b, users.a])).error, /permission denied/);
  assert.match((await as(users.a, `update public.profiles set created_at = now() - interval '1 year' where id = $1`, [users.a])).error, /permission denied/);
  assert.match((await as(users.a, `update public.profiles set updated_at = now() where id = $1`, [users.a])).error, /permission denied/);
});

test('updated_at is maintained by the database', async () => {
  const before = (await db.query('select updated_at from public.profiles where id = $1', [users.b])).rows[0].updated_at;
  await new Promise((r) => setTimeout(r, 10));
  await as(users.b, `update public.profiles set bio = 'hello' where id = $1`, [users.b]);
  const after = (await db.query('select updated_at from public.profiles where id = $1', [users.b])).rows[0].updated_at;
  assert.ok(after > before);
});

test('a user cannot create or delete profiles for others, or delete their own', async () => {
  assert.ok((await as(users.a, `insert into public.profiles (id, display_name) values ($1, 'fake')`, [users.c])).error);
  assert.match((await as(users.a, 'delete from public.profiles where id = $1', [users.a])).error, /permission denied/);
});

test('profile values are validated by the database', async () => {
  assert.match((await as(users.a, `update public.profiles set username = 'Has Spaces' where id = $1`, [users.a])).error, /check constraint/);
  assert.match((await as(users.a, `update public.profiles set alignment = 'chaotic' where id = $1`, [users.a])).error, /check constraint/);
  assert.match((await as(users.b, `update public.profiles set username = 'alice_dm' where id = $1`, [users.b])).error, /duplicate key/);
});

test('anonymous visitors cannot read or write profiles', async () => {
  assert.match((await as(null, 'select * from public.profiles')).error, /permission denied/);
  assert.match((await as(null, `update public.profiles set bio = 'x'`)).error, /permission denied/);
});

// ---------------------------------------------------------------------------
// Campaigns and members
// ---------------------------------------------------------------------------
let campaign;

test('creating a campaign makes the creator its single active owner', async () => {
  const res = await as(users.a, `insert into public.campaigns (name, description, adventure_id) values ('The Ashen Crown', 'Ash everywhere', (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure')) returning id, owner_id, status`);
  assert.ok(!res.error, res.error);
  campaign = res.rows[0].id;
  assert.equal(res.rows[0].owner_id, users.a);
  const members = await as(users.a, 'select user_id, role, status, joined_at from public.campaign_members where campaign_id = $1', [campaign]);
  assert.equal(members.rows.length, 1);
  assert.deepEqual([members.rows[0].user_id, members.rows[0].role, members.rows[0].status], [users.a, 'owner', 'active']);
  assert.ok(members.rows[0].joined_at);
});

test('nobody can create a campaign owned by someone else, or pre-archived', async () => {
  assert.match((await as(users.b, `insert into public.campaigns (owner_id, name, adventure_id) values ($1, 'Stolen', (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure'))`, [users.a])).error, /row-level security|your own adventures/);
  assert.match((await as(users.b, `insert into public.campaigns (name, status, adventure_id) values ('X', 'archived', (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure'))`)).error, /permission denied/);
  assert.match((await as(null, `insert into public.campaigns (name, adventure_id) values ('anon', (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure'))`)).error, /permission denied/);
});

test('non-members cannot see, change or delete a campaign', async () => {
  assert.equal((await as(users.b, `update public.campaigns set description = 'blanket'`)).affected, 0, 'blanket update');
  assert.equal((await as(users.b, 'update public.campaign_members set status = status')).affected, 0, 'blanket member update');
  assert.equal((await as(users.b, 'delete from public.campaign_members')).affected, 0, 'blanket member delete');
  assert.equal((await as(users.b, 'delete from public.campaigns')).affected, 0, 'blanket delete');
  assert.equal((await as(users.b, 'select * from public.campaigns where id = $1', [campaign])).rows.length, 0);
  assert.equal((await as(users.b, 'select * from public.campaign_members where campaign_id = $1', [campaign])).rows.length, 0);
  assert.equal((await as(users.b, `update public.campaigns set name = 'pwned' where id = $1`, [campaign])).affected, 0);
  assert.equal((await as(users.b, 'delete from public.campaigns where id = $1', [campaign])).affected, 0);
  assert.match((await as(null, 'select * from public.campaigns')).error, /permission denied/);
});

test('users cannot add themselves to a campaign or claim the owner role', async () => {
  assert.match((await as(users.b, 'insert into public.campaign_members (campaign_id, user_id) values ($1, $2)', [campaign, users.b])).error, /row-level security/);
  assert.match((await as(users.b, `insert into public.campaign_members (campaign_id, user_id, role, status) values ($1, $2, 'owner', 'active')`, [campaign, users.b])).error, /permission denied/);
  // even the owner can't insert a second owner or an already-active member directly
  assert.match((await as(users.a, `insert into public.campaign_members (campaign_id, user_id, role) values ($1, $2, 'owner')`, [campaign, users.b])).error, /permission denied/);
  assert.match((await as(users.a, 'insert into public.campaign_members (campaign_id, user_id) values ($1, $2)', [campaign, users.a])).error, /row-level security|duplicate key/);
});

test('the owner invites a player; only that player sees the invitation', async () => {
  const inv = await as(users.a, 'insert into public.campaign_members (campaign_id, user_id) values ($1, $2) returning role, status, joined_at', [campaign, users.b]);
  assert.ok(!inv.error, inv.error);
  assert.deepEqual([inv.rows[0].role, inv.rows[0].status, inv.rows[0].joined_at], ['player', 'invited', null]);
  assert.equal((await as(users.b, 'select name from public.campaigns where id = $1', [campaign])).rows.length, 1, 'invitee can see the campaign');
  assert.deepEqual((await as(users.b, 'select user_id from public.campaign_members where campaign_id = $1', [campaign])).rows.map((r) => r.user_id), [users.b], 'invitee sees only their own row, not the roster');
  assert.equal((await as(users.c, 'select * from public.campaigns where id = $1', [campaign])).rows.length, 0, 'others still see nothing');
});

test('a non-owner cannot invite people', async () => {
  assert.match((await as(users.b, 'insert into public.campaign_members (campaign_id, user_id) values ($1, $2)', [campaign, users.c])).error, /row-level security/);
});

test('only the invitee can accept, and only by becoming an active player', async () => {
  assert.equal((await as(users.a, `update public.campaign_members set status = 'active' where campaign_id = $1 and user_id = $2`, [campaign, users.b])).affected, 0, 'owner cannot force-accept');
  assert.match((await as(users.b, `update public.campaign_members set role = 'owner' where campaign_id = $1 and user_id = $2`, [campaign, users.b])).error, /permission denied/);
  const ok = await as(users.b, `update public.campaign_members set status = 'active' where campaign_id = $1 and user_id = $2 returning joined_at`, [campaign, users.b]);
  assert.equal(ok.affected, 1);
  assert.ok(ok.rows[0].joined_at, 'joined_at set on accept');
  const roster = await as(users.b, 'select user_id, role from public.campaign_members where campaign_id = $1 order by role', [campaign]);
  assert.equal(roster.rows.length, 2, 'active members see the roster');
});

test('members cannot edit the campaign, change ownership, or tamper with others', async () => {
  assert.equal((await as(users.b, `update public.campaigns set name = 'mine now' where id = $1`, [campaign])).affected, 0);
  assert.match((await as(users.a, 'update public.campaigns set owner_id = $1 where id = $2', [users.b, campaign])).error, /permission denied/);
  assert.equal((await as(users.b, `update public.campaign_members set status = 'invited' where campaign_id = $1 and user_id = $2`, [campaign, users.a])).affected, 0);
  assert.equal((await as(users.b, 'delete from public.campaign_members where campaign_id = $1 and user_id = $2', [campaign, users.a])).affected, 0, 'member cannot remove the owner');
});

test('the owner cannot remove their own owner row; archive and restore keep archived_at in sync', async () => {
  assert.equal((await as(users.a, 'delete from public.campaign_members where campaign_id = $1 and user_id = $2', [campaign, users.a])).affected, 0);
  const arch = await as(users.a, `update public.campaigns set status = 'archived' where id = $1 returning archived_at`, [campaign]);
  assert.ok(arch.rows[0].archived_at);
  assert.match((await as(users.a, `update public.campaigns set archived_at = null where id = $1`, [campaign])).error, /permission denied/);
  const back = await as(users.a, `update public.campaigns set status = 'active' where id = $1 returning archived_at`, [campaign]);
  assert.equal(back.rows[0].archived_at, null);
});

test('players can leave; owners can remove players', async () => {
  assert.equal((await as(users.b, 'delete from public.campaign_members where campaign_id = $1 and user_id = $2', [campaign, users.b])).affected, 1, 'player leaves');
  assert.equal((await as(users.b, 'select * from public.campaigns where id = $1', [campaign])).rows.length, 0, 'after leaving the campaign is hidden');
  await as(users.a, 'insert into public.campaign_members (campaign_id, user_id) values ($1, $2)', [campaign, users.c]);
  assert.equal((await as(users.a, 'delete from public.campaign_members where campaign_id = $1 and user_id = $2', [campaign, users.c])).affected, 1, 'owner removes player');
});

test('deleting a campaign removes its memberships; deleting a user removes their data', async () => {
  const tmp = (await as(users.c, `insert into public.campaigns (name, adventure_id) values ('Temp', (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure')) returning id`)).rows[0].id;
  assert.equal((await as(users.c, 'delete from public.campaigns where id = $1', [tmp])).affected, 1);
  assert.equal((await db.query('select count(*)::int as n from public.campaign_members where campaign_id = $1', [tmp])).rows[0].n, 0);
  await db.query('delete from auth.users where id = $1', [users.e]);
  assert.equal((await db.query('select count(*)::int as n from public.profiles where id = $1', [users.e])).rows[0].n, 0);
});

test('policy helper functions are not callable by anonymous visitors', async () => {
  assert.match((await as(null, 'select private.is_campaign_owner($1)', [campaign])).error, /permission denied/);
});

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------
test('delete_own_account deletes only the caller, and anonymous visitors cannot call it', async () => {
  const victim = await signUp('victim@example.com', { username: 'victim' });
  const temp = await signUp('temp@example.com', { username: 'temp_user' });
  const tc = (await as(temp, `insert into public.campaigns (name, adventure_id) values ('Temp campaign', (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure')) returning id`)).rows[0].id;
  assert.match((await as(null, 'select public.delete_own_account()')).error, /permission denied/);
  const res = await as(temp, 'select public.delete_own_account()');
  assert.ok(!res.error, res.error);
  const left = (await db.query('select id from auth.users where id = any($1::uuid[])', [[temp, victim]])).rows.map((r) => r.id);
  assert.deepEqual(left, [victim], 'only the caller was deleted');
  assert.equal((await db.query('select count(*)::int as n from public.profiles where id = $1', [temp])).rows[0].n, 0, 'profile removed');
  assert.equal((await db.query('select count(*)::int as n from public.campaigns where id = $1', [tc])).rows[0].n, 0, 'owned campaign removed');
});

// ---------------------------------------------------------------------------
// Avatar storage
// ---------------------------------------------------------------------------
test('avatar bucket exists with size and type limits', async () => {
  const b = (await db.query(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avatars'`)).rows[0];
  assert.deepEqual([b.public, Number(b.file_size_limit)], [true, 524288]);
  assert.deepEqual(b.allowed_mime_types, ['image/jpeg', 'image/png', 'image/webp']);
});

test('users write avatars only inside their own folder', async () => {
  assert.ok(!(await as(users.a, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${users.a}/avatar.jpg`])).error);
  assert.match((await as(users.a, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${users.b}/avatar.jpg`])).error, /row-level security/);
  assert.match((await as(users.a, `insert into storage.objects (bucket_id, name) values ('avatars', 'avatar.jpg')`)).error, /row-level security/);
  assert.ok(!(await as(users.b, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${users.b}/avatar.jpg`])).error);
  assert.equal((await as(users.a, `select name from storage.objects where bucket_id = 'avatars'`)).rows.length, 1, 'listing shows only own files');
  assert.equal((await as(users.a, `update storage.objects set name = $1 where name = $2`, [`${users.a}/x.jpg`, `${users.b}/avatar.jpg`])).affected, 0);
  assert.equal((await as(users.a, 'delete from storage.objects where name = $1', [`${users.b}/avatar.jpg`])).affected, 0);
  assert.equal((await as(users.a, 'delete from storage.objects where name = $1', [`${users.a}/avatar.jpg`])).affected, 1);
  assert.match((await as(null, `insert into storage.objects (bucket_id, name) values ('avatars', 'x/a.jpg')`)).error, /row-level security/);
});

// ---------------------------------------------------------------------------
// Joining campaigns, party characters, starting (migration 005)
// ---------------------------------------------------------------------------
async function newUser(email) {
  return signUp(email, { display_name: email.split('@')[0] });
}

test('campaigns get a unique server-made invite code; clients cannot set code or phase', async () => {
  const dm = await newUser('dm1@example.com');
  const r = await as(dm, `insert into public.campaigns (name, adventure_id) values ('Code test', (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure')) returning invite_code, phase`);
  assert.match(r.rows[0].invite_code, /^FOD-\d{4}-[A-Z]{2}$/);
  assert.equal(r.rows[0].phase, 'recruiting');
  assert.match((await as(dm, `insert into public.campaigns (name, invite_code, adventure_id) values ('X', 'FOD-1111-AA', (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure'))`)).error, /permission denied/);
  assert.match((await as(dm, `update public.campaigns set phase = 'started'`)).error, /permission denied/);
  assert.match((await as(dm, `update public.campaigns set invite_code = 'FOD-1111-AA'`)).error, /permission denied/);
});

test('join by code: seats are limited, DM and archived campaigns are refused, anonymous cannot join', async () => {
  const dm = await newUser('dm2@example.com');
  const p1 = await newUser('p21@example.com');
  const p2 = await newUser('p22@example.com');
  const c = (await as(dm, `insert into public.campaigns (name, required_players, adventure_id) values ('Two seats', 2, (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure')) returning id, invite_code`)).rows[0];
  assert.match((await as(p1, `select public.join_campaign('FOD-0000-ZZ')`)).error, /No campaign/);
  assert.match((await as(dm, 'select public.join_campaign($1)', [c.invite_code])).error, /Dungeon Master/);
  assert.match((await as(null, 'select public.join_campaign($1)', [c.invite_code])).error, /permission denied/);
  assert.equal((await as(p1, 'select public.join_campaign($1) as id', [c.invite_code.toLowerCase()])).rows[0].id, c.id, 'code is case-insensitive');
  assert.equal((await as(p1, 'select public.join_campaign($1) as id', [c.invite_code])).rows[0].id, c.id, 'joining twice is harmless');
  assert.match((await as(p2, 'select public.join_campaign($1)', [c.invite_code])).error, /full/, 'DM + 1 player fills 2 seats');
  assert.equal((await as(p1, 'select name from public.campaigns where id = $1', [c.id])).rows.length, 1, 'a member can read the campaign');
  assert.ok(!(await as(dm, `update public.campaigns set status = 'archived' where id = $1`, [c.id])).error);
  await as(p1, 'delete from public.campaign_members where campaign_id = $1 and user_id = $2', [c.id, p1]);
  assert.match((await as(p2, 'select public.join_campaign($1)', [c.invite_code])).error, /archived/);
});

test('characters: player sets own, DM sets for a player, others cannot; DM has no character', async () => {
  const dm = await newUser('dm3@example.com');
  const p1 = await newUser('p31@example.com');
  const p2 = await newUser('p32@example.com');
  const outsider = await newUser('o3@example.com');
  const c = (await as(dm, `insert into public.campaigns (name, required_players, adventure_id) values ('Party', 3, (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure')) returning id, invite_code`)).rows[0];
  await as(p1, 'select public.join_campaign($1)', [c.invite_code]);
  await as(p2, 'select public.join_campaign($1)', [c.invite_code]);
  const ch = JSON.stringify({ choices: { classId: 'fighter', level: 1 }, narrative: { name: 'Brakk' } });
  const set = 'select public.set_member_character($1, $2, $3::jsonb, $4)';
  assert.ok(!(await as(p1, set, [c.id, p1, ch, 'Brakk'])).error);
  assert.match((await as(p1, set, [c.id, p2, ch, 'Nope'])).error, /Only the player or the Dungeon Master/);
  assert.match((await as(outsider, set, [c.id, outsider, ch, 'Nope'])).error, /Only the player or the Dungeon Master/);
  assert.ok(!(await as(dm, set, [c.id, p2, ch, 'Built by DM'])).error);
  assert.match((await as(dm, set, [c.id, dm, ch, 'DM char'])).error, /in this campaign/);
  assert.match((await as(p1, 'update public.campaign_members set character_name = $1 where user_id = $2', ['Hack', p2])).error, /permission denied/, 'no direct writes');
  const roster = (await as(p1, 'select role, display_name, character_name, character_built_by from public.campaign_roster($1)', [c.id])).rows;
  assert.deepEqual(roster.map((r) => [r.role, r.display_name, r.character_name, r.character_built_by]), [
    ['owner', 'dm3', null, null], ['player', 'p31', 'Brakk', 'player'], ['player', 'p32', 'Built by DM', 'dm'],
  ]);
  assert.equal((await as(outsider, 'select * from public.campaign_roster($1)', [c.id])).rows.length, 0, 'outsiders see no roster');
  assert.match((await as(p1, set, [c.id, p1, JSON.stringify({ big: 'x'.repeat(410000) }), 'Big'])).error, /check constraint/);
});

test('start: only the DM, only when every seat is filled and every player has a character; then the party is locked', async () => {
  const dm = await newUser('dm4@example.com');
  const p1 = await newUser('p41@example.com');
  const p2 = await newUser('p42@example.com');
  const late = await newUser('l4@example.com');
  const c = (await as(dm, `insert into public.campaigns (name, required_players, adventure_id) values ('Start me', 3, (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure')) returning id, invite_code`)).rows[0];
  const ch = JSON.stringify({ narrative: { name: 'A' } });
  const set = 'select public.set_member_character($1, $2, $3::jsonb, $4)';
  await as(p1, 'select public.join_campaign($1)', [c.invite_code]);
  assert.match((await as(dm, 'select public.start_campaign($1)', [c.id])).error, /2 of 3 people/);
  await as(p2, 'select public.join_campaign($1)', [c.invite_code]);
  assert.match((await as(dm, 'select public.start_campaign($1)', [c.id])).error, /2 player\(s\) still need a character/);
  await as(p1, set, [c.id, p1, ch, 'A']);
  await as(dm, set, [c.id, p2, ch, 'B']);
  assert.match((await as(p1, 'select public.start_campaign($1)', [c.id])).error, /Only the Dungeon Master/);
  assert.ok(!(await as(dm, 'select public.start_campaign($1)', [c.id])).error);
  const row = (await as(p1, 'select phase, started_at from public.campaigns where id = $1', [c.id])).rows[0];
  assert.equal(row.phase, 'started');
  assert.ok(row.started_at);
  assert.match((await as(late, 'select public.join_campaign($1)', [c.invite_code])).error, /already started/);
  assert.match((await as(p1, set, [c.id, p1, ch, 'C'])).error, /before the campaign starts/);
  assert.equal((await as(p1, 'delete from public.campaign_members where campaign_id = $1 and user_id = $2', [c.id, p1])).affected, 0, 'cannot leave a started campaign');
  assert.equal((await as(dm, 'delete from public.campaign_members where campaign_id = $1 and user_id = $2', [c.id, p2])).affected, 0, 'DM cannot drop a player after start');
});

test('cover bucket: public read, users write only their own folder', async () => {
  const b = (await db.query(`select public, file_size_limit from storage.buckets where id = 'campaign-covers'`)).rows[0];
  assert.deepEqual([b.public, Number(b.file_size_limit)], [true, 1048576]);
  assert.ok(!(await as(users.a, `insert into storage.objects (bucket_id, name) values ('campaign-covers', $1)`, [`${users.a}/c1.jpg`])).error);
  assert.match((await as(users.a, `insert into storage.objects (bucket_id, name) values ('campaign-covers', $1)`, [`${users.b}/c1.jpg`])).error, /row-level security/);
});

test('a player can be in at most 3 active campaigns; archived ones and campaigns you run do not count', async () => {
  const p = await newUser('quota-player@example.com');
  const codes = [];
  for (let i = 0; i < 5; i++) {
    const dm = await newUser(`quota-dm${i}@example.com`);
    const c = (await as(dm, `insert into public.campaigns (name, required_players, adventure_id) values ($1, 5, (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure')) returning id, invite_code`, ['Quota ' + i])).rows[0];
    codes.push({ dm, ...c });
  }
  for (let i = 0; i < 3; i++) assert.ok(!(await as(p, 'select public.join_campaign($1)', [codes[i].invite_code])).error, 'join ' + i);
  assert.match((await as(p, 'select public.join_campaign($1)', [codes[3].invite_code])).error, /already a player in 3 active campaigns/);
  assert.equal((await as(p, 'select public.join_campaign($1) as id', [codes[0].invite_code])).rows[0].id, codes[0].id, 'rejoining one you are in still works');
  // Running your own campaign doesn't use a player slot
  assert.ok(!(await as(p, `insert into public.campaigns (name, adventure_id) values ('My own', (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure'))`)).error);
  assert.match((await as(p, 'select public.join_campaign($1)', [codes[3].invite_code])).error, /3 active campaigns/);
  // An archived campaign frees the slot
  assert.ok(!(await as(codes[0].dm, `update public.campaigns set status = 'archived' where id = $1`, [codes[0].id])).error);
  assert.ok(!(await as(p, 'select public.join_campaign($1)', [codes[3].invite_code])).error, 'slot freed by archiving');
  // Leaving frees a slot too
  assert.match((await as(p, 'select public.join_campaign($1)', [codes[4].invite_code])).error, /3 active campaigns/);
  await as(p, 'delete from public.campaign_members where campaign_id = $1 and user_id = $2', [codes[1].id, p]);
  assert.ok(!(await as(p, 'select public.join_campaign($1)', [codes[4].invite_code])).error, 'slot freed by leaving');
});

// -----------------------------------------------------------------------------
// Adventures
// -----------------------------------------------------------------------------
const advContent = (chapters) => JSON.stringify({ schema: 1, chapters });

test('adventures are private to their author (read, update, delete), anonymous visitors get nothing', async () => {
  const a = await newUser('adv-a@example.com');
  const b = await newUser('adv-b@example.com');
  const row = (await as(a, `insert into public.adventures (title) values ('The Sunken Bell') returning id, owner_id, status, version`)).rows[0];
  assert.equal(row.owner_id, a);
  assert.equal(row.status, 'draft');
  assert.equal(row.version, 1);
  assert.equal((await as(b, 'select id from public.adventures where id = $1', [row.id])).rows.length, 0, 'another user cannot read it');
  assert.equal((await as(b, `update public.adventures set title = 'Mine now' where id = $1`, [row.id])).affected, 0);
  assert.equal((await as(b, 'delete from public.adventures where id = $1', [row.id])).affected, 0);
  assert.match((await as(null, 'select id from public.adventures')).error, /permission denied/);
  assert.match((await as(b, `insert into public.adventures (owner_id, title) values ($1, 'Forged')`, [a])).error, /row-level security/);
  assert.equal((await as(a, 'select title from public.adventures where id = $1', [row.id])).rows[0].title, 'The Sunken Bell');
  assert.equal((await as(a, 'delete from public.adventures where id = $1', [row.id])).affected, 1);
});

test('adventures: owner, counts, version and timestamps are server-controlled; saves use the version', async () => {
  const a = await newUser('adv-c@example.com');
  const id = (await as(a, `insert into public.adventures (title, content) values ('Outline', $1::jsonb) returning id`, [advContent([
    { id: 'c1', title: 'Act I', sections: [{ id: 's1', kind: 'scene', title: 'Arrival' }, { id: 's2', kind: 'npc', title: 'Mayor' }] },
    { id: 'c2', title: 'Act II', sections: [] },
  ])])).rows[0].id;
  const r1 = (await as(a, 'select chapter_count, section_count, version from public.adventures where id = $1', [id])).rows[0];
  assert.deepEqual([r1.chapter_count, r1.section_count, r1.version], [2, 2, 1]);
  assert.match((await as(a, 'update public.adventures set version = 99 where id = $1', [id])).error, /permission denied/);
  assert.match((await as(a, 'update public.adventures set chapter_count = 9 where id = $1', [id])).error, /permission denied/);
  assert.match((await as(a, `update public.adventures set owner_id = $2 where id = $1`, [id, users.b])).error, /permission denied/);
  // Save with the loaded version: succeeds once, then the old version no longer matches (a stale tab can't overwrite)
  assert.equal((await as(a, `update public.adventures set title = 'Outline v2' where id = $1 and version = 1`, [id])).affected, 1);
  assert.equal((await as(a, `update public.adventures set title = 'Stale tab' where id = $1 and version = 1`, [id])).affected, 0);
  const r2 = (await as(a, 'select title, version from public.adventures where id = $1', [id])).rows[0];
  assert.deepEqual([r2.title, r2.version], ['Outline v2', 2]);
});

test('adventures: content must be a structured outline within the limits', async () => {
  const a = await newUser('adv-d@example.com');
  assert.match((await as(a, `insert into public.adventures (title, content) values ('Bad', '"<h1>html</h1>"'::jsonb)`)).error, /adventures_content_shape/);
  assert.match((await as(a, `insert into public.adventures (title, content) values ('Bad', '{"schema":1,"chapters":[{"title":"x"}]}'::jsonb)`)).error, /sections list/);
  const many = Array.from({ length: 101 }, (_, i) => ({ id: 'c' + i, title: 'C' + i, sections: [] }));
  assert.match((await as(a, `insert into public.adventures (title, content) values ('Big', $1::jsonb)`, [advContent(many)])).error, /at most 100 chapters/);
  assert.match((await as(a, `insert into public.adventures (title, level_min, level_max) values ('Levels', 9, 3)`)).error, /adventures_level_range/);
  assert.match((await as(a, `insert into public.adventures (title, cover_image) values ('Cover', 'https://evil.example/x.png')`)).error, /cover_image/);
  assert.match((await as(a, `insert into public.adventures (title) values ('   ')`)).error, /title/);
  assert.match((await as(a, `insert into public.adventures (title, content) values ('No schema', '{"chapters":[]}'::jsonb)`)).error, /adventures_content_shape/, 'a missing schema is rejected');
});

test('campaigns can switch only to their DM’s own adventure; deleting the adventure unlinks it; players cannot read it', async () => {
  const dm = await newUser('adv-dm@example.com');
  const other = await newUser('adv-other@example.com');
  const player = await newUser('adv-player@example.com');
  const mine = (await as(dm, `insert into public.adventures (title) values ('Mine') returning id`)).rows[0].id;
  const theirs = (await as(other, `insert into public.adventures (title) values ('Theirs') returning id`)).rows[0].id;
  const c = (await as(dm, `insert into public.campaigns (name, required_players, adventure_id) values ('Linked', 3, (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure')) returning id, invite_code`)).rows[0];
  assert.match((await as(dm, 'update public.campaigns set adventure_id = $2 where id = $1', [c.id, theirs])).error, /your own adventures/);
  assert.equal((await as(dm, 'update public.campaigns set adventure_id = $2 where id = $1', [c.id, mine])).affected, 1);
  await as(player, 'select public.join_campaign($1)', [c.invite_code]);
  assert.equal((await as(player, 'select adventure_id from public.campaigns where id = $1', [c.id])).rows[0].adventure_id, mine, 'players see only the id');
  assert.equal((await as(player, 'select id from public.adventures where id = $1', [mine])).rows.length, 0, 'players cannot read the adventure');
  assert.equal((await as(dm, 'delete from public.adventures where id = $1', [mine])).affected, 1);
  assert.equal((await as(dm, 'select adventure_id from public.campaigns where id = $1', [c.id])).rows[0].adventure_id, null);
});

// -----------------------------------------------------------------------------
// Every campaign runs an adventure (20261110120000_campaign_requires_adventure.sql)
// -----------------------------------------------------------------------------
test('a campaign cannot be created without an adventure, or with someone else’s', async () => {
  const dm = await newUser('req-dm@example.com');
  const other = await newUser('req-other@example.com');
  assert.match((await as(dm, `insert into public.campaigns (name) values ('No adventure')`)).error, /Choose the adventure/);
  assert.match((await as(dm, `insert into public.campaigns (name, adventure_id) values ('Null adventure', null)`)).error, /Choose the adventure/);
  const theirs = (await as(other, `insert into public.adventures (title) values ('Theirs') returning id`)).rows[0].id;
  assert.match((await as(dm, `insert into public.campaigns (name, adventure_id) values ('Borrowed', $1)`, [theirs])).error, /your own adventures/);
  const r = await as(dm, `insert into public.campaigns (name, adventure_id) values ('Fine', (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure')) returning id, adventure_id`);
  assert.ok(!r.error, r.error);
  assert.ok(r.rows[0].adventure_id);
});

test('the DM can switch adventures but not clear the link; deleting the adventure empties it and blocks starting', async () => {
  const dm = await newUser('req-dm2@example.com');
  const p1 = await newUser('req-p1@example.com');
  const second = (await as(dm, `insert into public.adventures (title) values ('Second') returning id`)).rows[0].id;
  const c = (await as(dm, `insert into public.campaigns (name, required_players, adventure_id) values ('Switch', 2, (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure')) returning id, invite_code`)).rows[0];
  assert.match((await as(dm, 'update public.campaigns set adventure_id = null where id = $1', [c.id])).error, /needs an adventure/);
  assert.equal((await as(dm, 'update public.campaigns set adventure_id = $2 where id = $1', [c.id, second])).affected, 1, 'switching is allowed');
  assert.equal((await as(dm, `update public.campaigns set description = 'still fine' where id = $1`, [c.id])).affected, 1, 'other edits are unaffected');
  await as(p1, 'select public.join_campaign($1)', [c.invite_code]);
  await as(p1, 'select public.set_member_character($1, $2, $3::jsonb, $4)', [c.id, p1, JSON.stringify({ narrative: { name: 'P' } }), 'P']);
  assert.equal((await as(dm, 'delete from public.adventures where id = $1', [second])).affected, 1, 'deleting a linked adventure is not blocked');
  assert.equal((await as(dm, 'select adventure_id from public.campaigns where id = $1', [c.id])).rows[0].adventure_id, null);
  assert.match((await as(dm, 'select public.start_campaign($1)', [c.id])).error, /Choose the adventure this campaign runs before starting/);
  const third = (await as(dm, `insert into public.adventures (title) values ('Third') returning id`)).rows[0].id;
  assert.equal((await as(dm, 'update public.campaigns set adventure_id = $2 where id = $1', [c.id, third])).affected, 1);
  assert.ok(!(await as(dm, 'select public.start_campaign($1)', [c.id])).error, 'starts once an adventure is chosen');
});

// -----------------------------------------------------------------------------
// Homebrew (20261110120100_homebrew.sql)
// -----------------------------------------------------------------------------
test('homebrew entries are private to their author; anonymous visitors get nothing', async () => {
  const a = await newUser('hb-a@example.com');
  const b = await newUser('hb-b@example.com');
  const row = (await as(a, `insert into public.homebrew (kind, name, data) values ('monster', 'Ash Wraith', '{"schema":1,"cr":"3"}') returning id, owner_id, version`)).rows[0];
  assert.equal(row.owner_id, a);
  assert.equal(row.version, 1);
  assert.equal((await as(b, 'select id from public.homebrew where id = $1', [row.id])).rows.length, 0, 'another user cannot read it');
  assert.equal((await as(b, `update public.homebrew set name = 'Mine' where id = $1`, [row.id])).affected, 0);
  assert.equal((await as(b, 'delete from public.homebrew where id = $1', [row.id])).affected, 0);
  assert.match((await as(b, `insert into public.homebrew (owner_id, kind, name) values ($1, 'spell', 'Forged')`, [a])).error, /row-level security/);
  assert.match((await as(null, 'select id from public.homebrew')).error, /permission denied/);
  assert.match((await as(null, `insert into public.homebrew (kind, name) values ('spell', 'anon')`)).error, /permission denied/);
  assert.equal((await as(a, 'delete from public.homebrew where id = $1', [row.id])).affected, 1);
});

test('homebrew: kind, owner, version and timestamps are server-controlled; saves use the version; data is validated', async () => {
  const a = await newUser('hb-c@example.com');
  const id = (await as(a, `insert into public.homebrew (kind, name) values ('spell', 'Ember Lash') returning id`)).rows[0].id;
  assert.match((await as(a, `update public.homebrew set kind = 'monster' where id = $1`, [id])).error, /permission denied/);
  assert.match((await as(a, 'update public.homebrew set version = 50 where id = $1', [id])).error, /permission denied/);
  assert.match((await as(a, 'update public.homebrew set owner_id = $2 where id = $1', [id, users.b])).error, /permission denied/);
  assert.equal((await as(a, `update public.homebrew set name = 'Ember Lash II' where id = $1 and version = 1`, [id])).affected, 1);
  assert.equal((await as(a, `update public.homebrew set name = 'Stale tab' where id = $1 and version = 1`, [id])).affected, 0, 'a stale version cannot overwrite');
  const r = (await as(a, 'select name, version, updated_at > created_at as touched from public.homebrew where id = $1', [id])).rows[0];
  assert.deepEqual([r.name, r.version], ['Ember Lash II', 2]);
  assert.match((await as(a, `insert into public.homebrew (kind, name) values ('vehicle', 'Cart')`)).error, /homebrew_kind_check/);
  assert.match((await as(a, `insert into public.homebrew (kind, name) values ('feat', '  ')`)).error, /homebrew_name_check/);
  assert.match((await as(a, `insert into public.homebrew (kind, name, data) values ('feat', 'Html', '"<b>x</b>"')`)).error, /homebrew_data_shape/);
  assert.match((await as(a, `insert into public.homebrew (kind, name, data) values ('feat', 'No schema', '{"x":1}')`)).error, /homebrew_data_shape/);
  assert.match((await as(a, 'insert into public.homebrew (kind, name, data) values ($1, $2, $3::jsonb)', ['other', 'Huge', JSON.stringify({ schema: 1, text: 'x'.repeat(100001) })])).error, /homebrew_data_size/);
});

// -----------------------------------------------------------------------------
// Google sign-in profiles (20261111120000) and content images (20261111120100)
// -----------------------------------------------------------------------------
test('a Google account gets its Google name as display name and no username', async () => {
  const g = await signUp('ada@gmail.example', { full_name: 'Ada Lovelace', name: 'Ada L', avatar_url: 'https://lh3.example/a.jpg', provider_id: '123', iss: 'https://accounts.google.com' });
  const p = (await db.query('select username, display_name from public.profiles where id = $1', [g])).rows[0];
  assert.deepEqual([p.username, p.display_name], [null, 'Ada Lovelace']);
  const n = await signUp('nameonly@gmail.example', { name: 'Grace\u0007 Hopper' });
  assert.equal((await db.query('select display_name from public.profiles where id = $1', [n])).rows[0].display_name, 'Grace Hopper', 'control characters are dropped');
  const e = await signUp('plain.user@example.com', {});
  assert.equal((await db.query('select display_name from public.profiles where id = $1', [e])).rows[0].display_name, 'plain.user', 'email sign-ups still fall back to the email name');
});

test('content images: private bucket, users read and write only their own folder', async () => {
  const b = (await db.query(`select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'content-images'`)).rows[0];
  assert.deepEqual([b.public, Number(b.file_size_limit)], [false, 2097152]);
  assert.deepEqual([...b.allowed_mime_types].sort(), ['image/jpeg', 'image/png', 'image/webp']);
  const a = await newUser('img-a@example.com');
  const o = await newUser('img-b@example.com');
  const mine = `${a}/adventures/adv1/map.jpg`;
  assert.ok(!(await as(a, `insert into storage.objects (bucket_id, name) values ('content-images', $1)`, [mine])).error);
  assert.ok(!(await as(a, `insert into storage.objects (bucket_id, name) values ('content-images', $1)`, [`${a}/homebrew/hb1/wraith.jpg`])).error);
  assert.match((await as(a, `insert into storage.objects (bucket_id, name) values ('content-images', $1)`, [`${a}/elsewhere/x.jpg`])).error, /row-level security/, 'only the adventures and homebrew folders');
  assert.match((await as(a, `insert into storage.objects (bucket_id, name) values ('content-images', $1)`, [`${o}/adventures/adv1/x.jpg`])).error, /row-level security/, 'not into another user’s folder');
  assert.equal((await as(o, `select name from storage.objects where bucket_id = 'content-images'`)).rows.length, 0, 'another user cannot see them');
  assert.equal((await as(o, `delete from storage.objects where name = $1`, [mine])).affected, 0, 'or delete them');
  assert.equal((await as(a, `select name from storage.objects where bucket_id = 'content-images'`)).rows.length, 2);
  const anon = await as(null, `select name from storage.objects where bucket_id = 'content-images'`);
  assert.ok(anon.error || anon.rows.length === 0, 'anonymous visitors see nothing');
  assert.equal((await as(a, `delete from storage.objects where name = $1`, [mine])).affected, 1);
});

// ---------------------------------------------------------------------------
// Campaign workspace (migration 20261112120000_campaign_workspace.sql)
// ---------------------------------------------------------------------------
async function workspace(tag) {
  const dm = await newUser(`ws-dm-${tag}@example.com`);
  const p = await newUser(`ws-p-${tag}@example.com`);
  const outsider = await newUser(`ws-out-${tag}@example.com`);
  const c = (await as(dm, `insert into public.campaigns (name, required_players, adventure_id) values ('Workspace', 2, (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure')) returning id, invite_code`)).rows[0];
  await as(p, 'select public.join_campaign($1)', [c.invite_code]);
  return { dm, p, outsider, id: c.id, code: c.invite_code };
}

test('messages: members read and write as themselves; outsiders see and write nothing; only authors or the DM delete', async () => {
  const w = await workspace('msg');
  const send = (uid, body, cid = w.id) => as(uid, 'insert into public.campaign_messages (campaign_id, body) values ($1, $2) returning id, author_id', [cid, body]);
  const mine = await send(w.p, 'Hello table');
  assert.equal(mine.rows[0].author_id, w.p, 'author is the signed-in user');
  assert.ok(!(await send(w.dm, 'Welcome')).error);
  assert.match((await send(w.outsider, 'let me in')).error, /row-level security/);
  assert.match((await send(w.p, '   ')).error, /check/, 'empty messages are refused');
  assert.match((await as(w.p, `insert into public.campaign_messages (campaign_id, body, author_id) values ($1, 'spoof', $2)`, [w.id, w.dm])).error, /permission denied/, 'author cannot be supplied');
  assert.equal((await as(w.p, 'select id from public.campaign_messages where campaign_id = $1', [w.id])).rows.length, 2);
  assert.equal((await as(w.outsider, 'select id from public.campaign_messages')).rows.length, 0);
  assert.ok((await as(null, 'select id from public.campaign_messages')).error, 'anonymous visitors are refused');
  assert.match((await as(w.p, `update public.campaign_messages set body = 'edited'`)).error, /permission denied/, 'messages are not editable');
  const dmMsg = (await as(w.dm, `select id from public.campaign_messages where author_id = $1`, [w.dm])).rows[0].id;
  assert.equal((await as(w.p, 'delete from public.campaign_messages where id = $1', [dmMsg])).affected, 0, 'a player cannot delete the DM’s message');
  assert.equal((await as(w.dm, 'delete from public.campaign_messages where id = $1', [mine.rows[0].id])).affected, 1, 'the DM moderates');
  assert.equal((await as(w.dm, 'delete from public.campaign_messages where id = $1', [dmMsg])).affected, 1, 'authors delete their own');
  await as(w.dm, `update public.campaigns set status = 'archived' where id = $1`, [w.id]);
  assert.match((await send(w.p, 'after archive')).error, /row-level security/, 'archived campaigns are read-only');
});

test('meetings: members read, only the DM writes; completed meetings stay; RSVPs are personal', async () => {
  const w = await workspace('meet');
  const add = (uid, title) => as(uid, `insert into public.campaign_meetings (campaign_id, title, starts_at, location) values ($1, $2, now() + interval '2 days', 'The Rusty Flagon') returning id`, [w.id, title]);
  assert.match((await add(w.p, 'Player plan')).error, /row-level security/, 'players cannot schedule');
  assert.match((await add(w.outsider, 'Outsider plan')).error, /row-level security/);
  const m = (await add(w.dm, 'Session 1')).rows[0].id;
  assert.equal((await as(w.p, 'select id from public.campaign_meetings')).rows.length, 1);
  assert.equal((await as(w.outsider, 'select id from public.campaign_meetings')).rows.length, 0);
  assert.equal((await as(w.p, `update public.campaign_meetings set title = 'x' where id = $1`, [m])).affected, 0, 'players cannot edit');
  assert.match((await as(w.dm, `update public.campaign_meetings set starts_at = now(), ends_at = now() - interval '1 hour' where id = $1`, [m])).error, /check/, 'ends after it starts');
  assert.match((await as(w.dm, `update public.campaign_meetings set completed_at = now() where id = $1`, [m])).error, /permission denied/, 'completed_at is server-controlled');
  const rsvp = (uid, r) => as(uid, `insert into public.campaign_meeting_rsvps (meeting_id, response) values ($1, $2) on conflict (meeting_id, user_id) do update set response = excluded.response`, [m, r]);
  assert.ok(!(await rsvp(w.p, 'yes')).error);
  assert.ok(!(await rsvp(w.p, 'maybe')).error, 'a player can change their answer');
  assert.match((await rsvp(w.outsider, 'yes')).error, /row-level security/, 'outsiders cannot answer');
  assert.match((await as(w.p, `insert into public.campaign_meeting_rsvps (meeting_id, response, user_id) values ($1, 'yes', $2)`, [m, w.dm])).error, /permission denied/, 'cannot answer for someone else');
  assert.equal((await as(w.dm, 'select response from public.campaign_meeting_rsvps where meeting_id = $1', [m])).rows[0].response, 'maybe');
  assert.equal((await as(w.outsider, 'select 1 from public.campaign_meeting_rsvps')).rows.length, 0);
  const done = await as(w.dm, `update public.campaign_meetings set status = 'completed', summary = 'The party met the dragon.' where id = $1 returning completed_at`, [m]);
  assert.ok(done.rows[0].completed_at);
  assert.match((await as(w.dm, `update public.campaign_meetings set status = 'scheduled' where id = $1`, [m])).error, /history/);
  assert.equal((await as(w.dm, 'delete from public.campaign_meetings where id = $1', [m])).affected, 0, 'a completed meeting cannot be deleted');
  assert.match((await rsvp(w.p, 'no')).error, /row-level security/, 'no RSVP for a meeting that already happened');
  const c2 = (await add(w.dm, 'Session 2')).rows[0].id;
  await as(w.dm, `update public.campaign_meetings set status = 'cancelled' where id = $1`, [c2]);
  assert.equal((await as(w.p, 'delete from public.campaign_meetings where id = $1', [c2])).affected, 0);
  assert.equal((await as(w.dm, 'delete from public.campaign_meetings where id = $1', [c2])).affected, 1);
});

test('combat: the full encounter is DM-only, players read the public one, only the DM saves, versions guard against overwrites', async () => {
  const w = await workspace('cmb');
  const save = (uid, v) => as(uid, 'select public.save_campaign_combat($1, $2::jsonb, $3::jsonb, $4) as v', [w.id, JSON.stringify({ secret: 'goblin hp 7' }), JSON.stringify({ round: 1 }), v]);
  assert.match((await save(w.p, null)).error, /Only the Dungeon Master/);
  assert.match((await save(w.outsider, null)).error, /Only the Dungeon Master/);
  assert.equal((await save(w.dm, null)).rows[0].v, 1);
  assert.equal((await save(w.dm, 1)).rows[0].v, 2);
  assert.match((await save(w.dm, 1)).error, /changed somewhere else/, 'stale version refused');
  assert.equal((await as(w.dm, 'select state from public.campaign_combats')).rows[0].state.secret, 'goblin hp 7');
  assert.equal((await as(w.p, 'select state from public.campaign_combats')).rows.length, 0, 'players cannot read the full state');
  assert.equal((await as(w.p, 'select state from public.campaign_combat_public')).rows[0].state.round, 1);
  assert.equal((await as(w.outsider, 'select state from public.campaign_combat_public')).rows.length, 0);
  assert.match((await as(w.dm, `insert into public.campaign_combats (campaign_id, state) values ($1, '{}')`, [w.id])).error, /permission denied/, 'no direct writes');
  assert.match((await as(w.p, `update public.campaign_combat_public set state = '{}'::jsonb`)).error, /permission denied/);
  assert.match((await as(w.p, 'select public.clear_campaign_combat($1)', [w.id])).error, /Only the Dungeon Master/);
  assert.ok(!(await as(w.dm, 'select public.clear_campaign_combat($1)', [w.id])).error);
  assert.equal((await as(w.p, 'select 1 from public.campaign_combat_public')).rows.length, 0);
  await as(w.dm, `update public.campaigns set status = 'archived' where id = $1`, [w.id]);
  assert.match((await save(w.dm, null)).error, /Restore the campaign/);
});

test('progress is DM-only; revealed content is shared with members only, by the DM only', async () => {
  const w = await workspace('adv');
  assert.ok(!(await as(w.dm, `insert into public.campaign_progress (campaign_id, current_section, completed_sections) values ($1, 's1', array['s0'])`, [w.id])).error);
  assert.match((await as(w.p, `insert into public.campaign_progress (campaign_id) values ($1)`, [w.id])).error, /row-level security/);
  assert.equal((await as(w.p, 'select 1 from public.campaign_progress')).rows.length, 0, 'players cannot read progress');
  assert.equal((await as(w.dm, `update public.campaign_progress set current_section = 's2' where campaign_id = $1`, [w.id])).affected, 1);
  assert.equal((await as(w.p, `update public.campaign_progress set current_section = 'x' where campaign_id = $1`, [w.id])).affected, 0);
  const reveal = (uid) => as(uid, `insert into public.campaign_reveals (campaign_id, section_id, kind, title, body) values ($1, 's1', 'scene', 'The Tavern', 'Smoke fills the air.') returning id`, [w.id]);
  assert.match((await reveal(w.p)).error, /row-level security/, 'players cannot reveal');
  const r = (await reveal(w.dm)).rows[0].id;
  assert.match((await reveal(w.dm)).error, /duplicate key/, 'one reveal per section');
  assert.equal((await as(w.p, 'select body from public.campaign_reveals')).rows[0].body, 'Smoke fills the air.');
  assert.equal((await as(w.outsider, 'select body from public.campaign_reveals')).rows.length, 0);
  assert.equal((await as(w.p, 'delete from public.campaign_reveals where id = $1', [r])).affected, 0);
  assert.equal((await as(w.dm, 'delete from public.campaign_reveals where id = $1', [r])).affected, 1);
});

test('invite codes: only the DM replaces them, only while the party is gathering; the old code stops working', async () => {
  const w = await workspace('inv');
  assert.match((await as(w.p, 'select public.regenerate_invite_code($1)', [w.id])).error, /Only the Dungeon Master/);
  assert.match((await as(w.outsider, 'select public.regenerate_invite_code($1)', [w.id])).error, /Only the Dungeon Master/);
  const fresh = (await as(w.dm, 'select public.regenerate_invite_code($1) as code', [w.id])).rows[0].code;
  assert.match(fresh, /^FOD-\d{4}-[A-Z]{2}$/);
  assert.notEqual(fresh, w.code);
  assert.match((await as(w.outsider, 'select public.join_campaign($1)', [w.code])).error, /No campaign has that invite code/);
  assert.equal((await as(w.dm, 'select invite_code from public.campaigns where id = $1', [w.id])).rows[0].invite_code, fresh);
});

// ---------------------------------------------------------------------------
// Campaign refinements (migration 20261113120000_campaign_refinements.sql)
// ---------------------------------------------------------------------------
const CHAR = (level = 3, extra = {}) => JSON.stringify({ sourceCharacterId: 'src1', choices: Object.assign({ level, classId: 'fighter', speciesId: 'human', backgroundId: 'soldier' }, extra), narrative: { name: 'Brienne' } });

async function started(tag, players = 1) {
  const dm = await newUser(`r-dm-${tag}@example.com`);
  const ps = [];
  for (let i = 0; i < players; i++) ps.push(await newUser(`r-p${i}-${tag}@example.com`));
  const outsider = await newUser(`r-out-${tag}@example.com`);
  const c = (await as(dm, `insert into public.campaigns (name, required_players, starting_level, adventure_id) values ('Locked', $1, 3, (select id from public.adventures where owner_id = auth.uid() and title = 'Default adventure')) returning id, invite_code, adventure_id`, [players + 1])).rows[0];
  for (const p of ps) {
    await as(p, 'select public.join_campaign($1)', [c.invite_code]);
    await as(p, 'select public.set_member_character($1, $2, $3::jsonb, $4)', [c.id, p, CHAR(3), 'Brienne']);
  }
  return { dm, p: ps[0], ps, outsider, id: c.id, adv: c.adventure_id };
}
const startIt = (w) => as(w.dm, 'select public.start_campaign($1)', [w.id]);

test('locking: before the start everything can change; after it the adventure, starting setup and party are locked, for clients and by direct request', async () => {
  const w = await started('lock');
  const adv2 = (await as(w.dm, `insert into public.adventures (title) values ('Second') returning id`)).rows[0].id;
  assert.equal((await as(w.dm, 'update public.campaigns set adventure_id = $2, starting_level = 4 where id = $1', [w.id, adv2])).affected, 1, 'setup phase is editable');
  await as(w.dm, 'update public.campaigns set adventure_id = $2, starting_level = 3 where id = $1', [w.id, w.adv]);
  assert.ok(!(await startIt(w)).error);
  const h = (await as(w.p, `select kind from public.campaign_history where campaign_id = $1`, [w.id])).rows;
  assert.deepEqual(h.map((r) => r.kind), ['started']);
  assert.match((await as(w.dm, 'update public.campaigns set adventure_id = $2 where id = $1', [w.id, adv2])).error, /adventure is locked/);
  assert.match((await as(w.dm, 'update public.campaigns set starting_level = 9 where id = $1', [w.id])).error, /starting setup is locked/);
  assert.match((await as(w.dm, 'update public.campaigns set required_players = 9 where id = $1', [w.id])).error, /starting setup is locked/);
  assert.match((await as(w.dm, `update public.campaigns set content_source = 'existing' where id = $1`, [w.id])).error, /starting setup is locked/);
  assert.equal((await as(w.dm, `update public.campaigns set name = 'Renamed', description = 'ok' where id = $1`, [w.id])).affected, 1, 'name and description stay editable');
  assert.match((await as(w.p, 'select public.set_member_character($1, $2, $3::jsonb, $4)', [w.id, w.p, CHAR(3), 'Other'])).error, /before the campaign starts/);
  assert.match((await as(w.dm, 'select public.set_member_character($1, $2, $3::jsonb, $4)', [w.id, w.p, CHAR(3), 'Other'])).error, /before the campaign starts/);
  assert.match((await as(w.p, 'select public.clear_member_character($1, $2)', [w.id, w.p])).error, /before the campaign starts/);
  assert.match((await as(w.p, `update public.campaign_members set character_data = '{}'::jsonb where campaign_id = $1`, [w.id])).error, /permission denied/, 'no direct character writes');
  assert.equal((await as(w.dm, 'delete from public.campaign_members where campaign_id = $1 and user_id = $2', [w.id, w.p])).affected, 0);
  assert.equal((await as(w.outsider, 'select 1 from public.campaign_history')).rows.length, 0);
  assert.match((await as(w.dm, `insert into public.campaign_history (campaign_id, kind, summary) values ($1, 'override', 'forged')`, [w.id])).error, /permission denied/);
});

test('level-ups: exactly one level, same character, player only, logged; arbitrary levels and replacements are refused', async () => {
  const w = await started('lvl');
  const up = (uid, json) => as(uid, 'select public.level_up_member_character($1, $2::jsonb) as lvl', [w.id, json]);
  assert.match((await up(w.p, CHAR(4))).error, /once the campaign has started/);
  await startIt(w);
  assert.equal((await up(w.p, CHAR(4))).rows[0].lvl, 4);
  assert.match((await up(w.p, CHAR(9))).error, /one level at a time/, 'no jumps');
  assert.match((await up(w.p, CHAR(4))).error, /one level at a time/, 'no repeats of the same level');
  assert.match((await up(w.p, CHAR(3))).error, /one level at a time/, 'no downgrades');
  assert.match((await up(w.p, CHAR(5, { classId: 'wizard' }))).error, /same character/);
  assert.match((await up(w.p, JSON.stringify({ sourceCharacterId: 'other', choices: { level: 5, classId: 'fighter', speciesId: 'human', backgroundId: 'soldier' } }))).error, /same character/);
  assert.match((await up(w.dm, CHAR(5))).error, /don't have a character/, 'the DM cannot level a player');
  assert.match((await up(w.outsider, CHAR(5))).error, /don't have a character/);
  assert.equal((await up(w.p, CHAR(5))).rows[0].lvl, 5);
  const row = (await as(w.dm, `select character_data -> 'choices' ->> 'level' as l, character_name from public.campaign_members where user_id = $1`, [w.p])).rows[0];
  assert.deepEqual([row.l, row.character_name], ['5', 'Brienne']);
  const log = (await as(w.p, `select kind, summary from public.campaign_history where campaign_id = $1 and kind = 'level_up' order by created_at`, [w.id])).rows;
  assert.equal(log.length, 2);
  assert.match(log[1].summary, /reached level 5/);
});

test('overrides: DM only, after the start only, with a reason, limited actions, always logged', async () => {
  const w = await started('ovr');
  const adv2 = (await as(w.dm, `insert into public.adventures (title) values ('Fixed') returning id`)).rows[0].id;
  const ov = (uid, action, payload, reason = 'Setup was wrong, we all agreed.') => as(uid, 'select public.override_campaign_lock($1, $2, $3::jsonb, $4)', [w.id, action, JSON.stringify(payload), reason]);
  assert.match((await ov(w.dm, 'set_adventure', { adventure_id: adv2 })).error, /Nothing is locked yet/);
  await startIt(w);
  assert.match((await ov(w.p, 'set_adventure', { adventure_id: adv2 })).error, /Only the Dungeon Master/);
  assert.match((await ov(w.dm, 'set_adventure', { adventure_id: adv2 }, 'short')).error, /reason/);
  assert.match((await ov(w.dm, 'set_adventure', { adventure_id: adv2 }, '          ')).error, /reason/);
  assert.match((await ov(w.dm, 'delete_everything', {})).error, /Unknown override/);
  const someone = (await as(w.outsider, `insert into public.adventures (title) values ('Theirs') returning id`)).rows[0].id;
  assert.match((await ov(w.dm, 'set_adventure', { adventure_id: someone })).error, /your own adventures/, 'only the DM’s own adventures');
  assert.ok(!(await ov(w.dm, 'set_adventure', { adventure_id: adv2 })).error);
  assert.equal((await as(w.dm, 'select adventure_id from public.campaigns where id = $1', [w.id])).rows[0].adventure_id, adv2);
  assert.ok(!(await ov(w.dm, 'replace_character', { user_id: w.p, name: 'Tobias', character: JSON.parse(CHAR(3, { classId: 'wizard' })) }, 'Player picked the wrong sheet.')).error);
  assert.equal((await as(w.dm, 'select character_name, character_built_by from public.campaign_members where user_id = $1', [w.p])).rows[0].character_name, 'Tobias');
  assert.ok(!(await ov(w.dm, 'set_starting_level', { level: 4 })).error);
  assert.ok(!(await ov(w.dm, 'remove_member', { user_id: w.p }, 'Player left the group for good.')).error);
  assert.equal((await as(w.dm, 'select count(*)::int as n from public.campaign_members where user_id = $1', [w.p])).rows[0].n, 0);
  const log = (await as(w.dm, `select summary, details from public.campaign_history where campaign_id = $1 and kind = 'override' order by created_at`, [w.id])).rows;
  assert.equal(log.length, 4, 'every override is in the history');
  assert.ok(log.every((r) => r.details.reason && /Reason:/.test(r.summary)));
  assert.ok(!JSON.stringify(log).includes('"choices"'), 'character data is not copied into the log');
});

async function slotsFor(days = 2) {
  const base = Date.now() + 5 * 86400000;
  const day = (n) => new Date(base + n * 86400000).toISOString();
  return [
    { id: 's1', start: day(0), end: new Date(base + 4 * 3600000).toISOString() },
    { id: 's2', start: day(1), end: new Date(base + 86400000 + 4 * 3600000).toISOString() },
  ];
}

test('scheduler: draft is private; publishing notifies; only required people answer; answers are validated', async () => {
  const w = await started('sch1', 2);
  const [p1, p2] = w.ps;
  const slots = await slotsFor();
  const mk = (uid, publish = false, s = slots) => as(uid, 'select public.create_schedule_request($1, $2, $3, $4, $5, $6::jsonb, $7, $8) as id', [w.id, 'Session 5', 'Bring dice', 'either', 180, JSON.stringify(s), null, publish]);
  assert.match((await mk(p1)).error, /Only the Dungeon Master/);
  assert.match((await mk(w.dm, false, [])).error, /between 1 and 60/);
  assert.match((await mk(w.dm, false, [{ id: 'a', start: slots[0].end, end: slots[0].start }])).error, /end after it starts/);
  assert.match((await mk(w.dm, false, [slots[0], slots[0]])).error, /own short id/);
  const rid = (await mk(w.dm)).rows[0].id;
  assert.equal((await as(p1, 'select 1 from public.campaign_schedule_requests')).rows.length, 0, 'players cannot see a draft');
  assert.match((await as(p1, 'select public.submit_schedule_response($1, $2::jsonb, false, null, false, null, null, null)', [rid, '{"s1":"available"}'])).error, /isn't waiting for your answer/);
  assert.ok(!(await as(w.dm, 'select public.publish_schedule_request($1)', [rid])).error);
  assert.match((await as(w.dm, 'select public.publish_schedule_request($1)', [rid])).error, /already sent/);
  assert.equal((await as(p1, 'select status, cardinality(required_users)::int as n from public.campaign_schedule_requests')).rows[0].n, 3);
  const notes = (await as(p1, `select title from public.campaign_notifications where kind = 'schedule'`)).rows;
  assert.equal(notes.length, 1);
  assert.match(notes[0].title, /Availability needed: Session 5/);
  assert.equal((await as(w.dm, 'select count(*)::int as n from public.campaign_notifications')).rows[0].n, 0, 'the DM who asked is not notified');
  assert.equal((await as(p2, 'select count(*)::int as n from public.campaign_notifications')).rows[0].n, 1, 'each member only sees their own');
  const ans = (uid, av, extra = [false, null, false, null, null, null]) => as(uid, 'select public.submit_schedule_response($1, $2::jsonb, $3, $4, $5, $6, $7, $8) as st', [rid, JSON.stringify(av), ...extra]);
  assert.match((await ans(w.outsider, { s1: 'available' })).error, /isn't waiting/);
  assert.match((await ans(p1, { s9: 'available' })).error, /doesn't match/);
  assert.match((await ans(p1, { s1: 'definitely' })).error, /doesn't match/);
  assert.equal((await ans(p1, { s1: 'available' })).rows[0].st, 'waiting');
  assert.equal((await ans(p1, { s1: 'preferred', s2: 'unavailable' })).rows[0].st, 'waiting', 'answers can be changed');
  assert.equal((await as(w.dm, 'select count(*)::int as n from public.campaign_notifications')).rows[0].n, 0);
  assert.equal((await ans(w.dm, { s1: 'available', s2: 'available' })).rows[0].st, 'waiting');
  assert.equal((await ans(p2, { s1: 'available', s2: 'maybe' })).rows[0].st, 'consensus');
  assert.match((await as(w.dm, `select title from public.campaign_notifications where kind = 'schedule'`)).rows[0].title, /Everyone answered/);
  assert.equal((await as(w.outsider, 'select 1 from public.campaign_schedule_responses')).rows.length, 0);
  assert.match((await as(p1, `update public.campaign_schedule_requests set status = 'confirmed'`)).error, /permission denied/, 'no direct writes');
  assert.match((await as(p1, `insert into public.campaign_schedule_responses (request_id, round, user_id) values ($1, 1, $2)`, [rid, p2])).error, /permission denied/);
});

test('scheduler: no meeting without a unanimous slot, host consent and everyone confirming the same proposal', async () => {
  const w = await started('sch2', 2);
  const [p1, p2] = w.ps;
  const slots = await slotsFor();
  const rid = (await as(w.dm, 'select public.create_schedule_request($1, $2, $3, $4, $5, $6::jsonb, $7, true) as id', [w.id, 'Session 6', '', 'either', 120, JSON.stringify(slots), null])).rows[0].id;
  const ans = (uid, av, host = [false, null, false]) => as(uid, 'select public.submit_schedule_response($1, $2::jsonb, $3, $4, $5, $6, $7, $8)', [rid, JSON.stringify(av), host[0], host[1], host[2], 'No pets please', null, null]);
  await ans(w.dm, { s1: 'available', s2: 'available' });
  await ans(p1, { s1: 'available', s2: 'unavailable' }, [true, '12 Elm Street, Springfield', false]);
  const propose = (slot, format, host, link, kind) => as(w.dm, 'select public.propose_schedule($1, $2, $3, $4, $5, $6) as v', [rid, slot, format, host, link, kind]);
  assert.match((await propose('s1', 'online', null, 'https://meet.example.com/abc', 'manual')).error, /Wait until everyone has answered/);
  await ans(p2, { s1: 'maybe', s2: 'available' });
  assert.match((await propose('s1', 'online', null, 'https://meet.example.com/abc', 'manual')).error, /Not everyone is available/, 'maybe is not yes');
  assert.match((await propose('s2', 'online', null, 'https://meet.example.com/abc', 'manual')).error, /Not everyone is available/, 'one unavailable member blocks it');
  await ans(p2, { s1: 'preferred', s2: 'available' });
  assert.match((await propose('s9', 'online', null, 'https://x.example.com/abc', 'manual')).error, /isn't part of this request/);
  assert.match((await as(p1, 'select public.propose_schedule($1, $2, $3, null, $4, $5)', [rid, 's1', 'online', 'https://meet.example.com/abc', 'manual'])).error, /Only the Dungeon Master/);
  // in person: needs a host who can host AND agreed to share the location
  assert.match((await propose('s1', 'in_person', p1, null, null)).error, /agreed to share the location/);
  assert.match((await propose('s1', 'in_person', p2, null, null)).error, /agreed to share the location/, 'someone who cannot host');
  assert.match((await propose('s1', 'online', null, 'http://insecure.example.com/abc', 'manual')).error, /https/);
  // the address is private until shared AND proposed
  assert.equal((await as(w.dm, 'select 1 from public.campaign_schedule_hosts')).rows.length, 0, 'not even the DM sees a private address');
  assert.equal((await as(p1, 'select location from public.campaign_schedule_hosts')).rows[0].location, '12 Elm Street, Springfield');
  await ans(p1, { s1: 'available', s2: 'unavailable' }, [true, '12 Elm Street, Springfield', true]);
  assert.equal((await as(w.dm, 'select 1 from public.campaign_schedule_hosts')).rows.length, 0, 'sharing is allowed but the host is not proposed yet');
  const v1 = (await propose('s1', 'in_person', p1, null, null)).rows[0].v;
  assert.equal(v1, 1);
  assert.equal((await as(w.dm, 'select location from public.campaign_schedule_hosts')).rows[0].location, '12 Elm Street, Springfield', 'visible once proposed');
  assert.equal((await as(p2, 'select location from public.campaign_schedule_hosts')).rows.length, 1);
  assert.equal((await as(w.outsider, 'select location from public.campaign_schedule_hosts')).rows.length, 0);
  assert.equal((await as(w.dm, 'select count(*)::int as n from public.campaign_meetings')).rows[0].n, 0, 'nothing is scheduled yet');
  const confirm = (uid, v = 1, slot = 's1') => as(uid, 'select public.confirm_schedule($1, $2, $3) as m', [rid, v, slot]);
  assert.match((await confirm(w.outsider)).error, /isn't waiting for your confirmation/);
  assert.match((await confirm(p1, 2)).error, /proposal changed/, 'wrong version');
  assert.match((await confirm(p1, 1, 's2')).error, /proposal changed/, 'a different slot than the proposal');
  assert.equal((await confirm(w.dm)).rows[0].m, null);
  assert.equal((await confirm(p1)).rows[0].m, null);
  assert.equal((await as(w.dm, 'select count(*)::int as n from public.campaign_meetings')).rows[0].n, 0, 'two of three is not enough');
  // a new proposal wipes the confirmations: nobody can have confirmed something else
  const v2 = (await propose('s1', 'online', null, 'https://meet.example.com/abc', 'manual')).rows[0].v;
  assert.equal(v2, 2);
  assert.match((await confirm(p2, 1)).error, /proposal changed/);
  assert.equal((await as(w.dm, 'select count(*)::int as n from public.campaign_schedule_confirmations')).rows[0].n, 0);
  assert.equal((await as(p2, 'select location from public.campaign_schedule_hosts')).rows.length, 0, 'online now: the address is private again');
  assert.equal((await confirm(w.dm, 2)).rows[0].m, null);
  assert.equal((await confirm(p1, 2)).rows[0].m, null);
  const meeting = (await confirm(p2, 2)).rows[0].m;
  assert.ok(meeting, 'the third confirmation creates the meeting');
  const m = (await as(p2, 'select title, location, description, status, extract(epoch from ends_at - starts_at)::int / 3600 as hrs from public.campaign_meetings where id = $1', [meeting])).rows[0];
  assert.deepEqual([m.title, m.location, m.status], ['Session 6', 'https://meet.example.com/abc', 'scheduled']);
  assert.match(m.description, /link the DM entered by hand/);
  assert.equal(m.hrs, 2, 'duration comes from the request');
  assert.equal((await as(p1, 'select status from public.campaign_schedule_requests')).rows[0].status, 'confirmed');
  assert.equal((await as(p1, `select count(*)::int as n from public.campaign_meeting_rsvps where meeting_id = $1 and response = 'yes'`, [meeting])).rows[0].n, 3);
  assert.equal((await as(p1, `select count(*)::int as n from public.campaign_notifications where title like 'Meeting confirmed%'`)).rows[0].n, 1);
  assert.match((await confirm(p1, 2)).error, /nothing to confirm/);
  assert.match((await as(w.dm, 'select public.cancel_schedule($1)', [rid])).error, /can't be cancelled/);
});

test('scheduler: declining clears the proposal; reopening starts a new round; cancel and deadlines work', async () => {
  const w = await started('sch3', 1);
  const slots = await slotsFor();
  const mk = (due = null) => as(w.dm, 'select public.create_schedule_request($1, $2, $3, $4, $5, $6::jsonb, $7, true) as id', [w.id, 'Session 7', '', 'online', null, JSON.stringify(slots), due]).then((r) => r.rows[0].id);
  const rid2 = await mk();
  const ans2 = (uid, av) => as(uid, 'select public.submit_schedule_response($1, $2::jsonb, false, null, false, null, null, null)', [rid2, JSON.stringify(av)]);
  await ans2(w.dm, { s1: 'available' }); await ans2(w.p, { s1: 'available' });
  await as(w.dm, 'select public.propose_schedule($1, $2, $3, null, $4, $5)', [rid2, 's1', 'online', 'https://meet.example.com/y', 'manual']);
  assert.match((await as(w.outsider, 'select public.decline_schedule($1)', [rid2])).error, /nothing for you to decline/);
  await as(w.p, 'select public.decline_schedule($1)', [rid2]);
  const afterDecline = (await as(w.dm, 'select status, proposal from public.campaign_schedule_requests where id = $1', [rid2])).rows[0];
  assert.deepEqual([afterDecline.status, afterDecline.proposal], ['consensus', null]);
  assert.match((await as(w.dm, 'select title from public.campaign_notifications where title like $1', ['A time was declined%'])).rows[0].title, /declined/);
  assert.match((await as(w.p, 'select public.confirm_schedule($1, 1, $2)', [rid2, 's1'])).error, /nothing to confirm/);
  // new round
  await as(w.dm, 'select public.reopen_schedule($1)', [rid2]);
  const r2 = (await as(w.dm, 'select status, round from public.campaign_schedule_requests where id = $1', [rid2])).rows[0];
  assert.deepEqual([r2.status, r2.round], ['waiting', 2]);
  assert.equal((await as(w.dm, 'select count(*)::int as n from public.campaign_schedule_responses where request_id = $1 and round = 2', [rid2])).rows[0].n, 0, 'answers start over');
  assert.match((await as(w.dm, 'select public.reopen_schedule($1)', [rid2])).error, /can't be reopened/, 'cannot reopen one that is waiting');
  // cancel
  assert.ok(!(await as(w.dm, 'select public.cancel_schedule($1)', [rid2])).error);
  assert.match((await as(w.p, 'select public.cancel_schedule($1)', [rid2])).error, /Only the Dungeon Master/);
  assert.match((await ans2(w.p, { s1: 'available' })).error, /no longer collecting/);
  assert.ok(!(await as(w.dm, 'select public.reopen_schedule($1)', [rid2])).error, 'a cancelled request can be reopened');
  // deadline
  const rid3 = await mk(new Date(Date.now() + 3600000).toISOString());
  await db.query(`update public.campaign_schedule_requests set responses_due = now() - interval '1 minute' where id = $1`, [rid3]);
  assert.match((await as(w.p, 'select public.submit_schedule_response($1, $2::jsonb, false, null, false, null, null, null)', [rid3, '{"s1":"available"}'])).error, /deadline/);
  assert.equal((await as(w.p, 'select public.expire_schedule_requests($1) as n', [w.id])).rows[0].n, 1);
  assert.equal((await as(w.p, 'select status from public.campaign_schedule_requests where id = $1', [rid3])).rows[0].status, 'expired');
  assert.equal((await as(w.outsider, 'select public.expire_schedule_requests($1) as n', [w.id])).rows[0].n, 0);
  assert.match((await as(w.dm, 'select public.create_schedule_request($1, $2, $3, $4, $5, $6::jsonb, $7, true)', [w.id, 'Late', '', 'online', null, JSON.stringify(slots), new Date(Date.now() - 1000).toISOString()])).error, /in the future/);
});

test('campaign homebrew: only the DM shares their own entries; members read; one copy per entry', async () => {
  const w = await started('hb');
  const mine = (await as(w.dm, `insert into public.homebrew (kind, name, data) values ('monster', 'Ash Wraith', '{"schema":1}') returning id`)).rows[0].id;
  const theirs = (await as(w.p, `insert into public.homebrew (kind, name, data) values ('spell', 'Frost Bolt', '{"schema":1}') returning id`)).rows[0].id;
  const share = (uid, src, kind = 'monster') => as(uid, `insert into public.campaign_homebrew (campaign_id, source_id, kind, name, data) values ($1, $2, $3, 'Ash Wraith', '{"schema":1}')`, [w.id, src, kind]);
  assert.match((await share(w.p, theirs, 'spell')).error, /row-level security/, 'players cannot share into the campaign');
  assert.match((await share(w.dm, theirs, 'spell')).error, /row-level security/, 'not someone else’s entry');
  assert.match((await share(w.dm, mine, 'spell')).error, /row-level security/, 'kind must match');
  assert.ok(!(await share(w.dm, mine)).error);
  assert.match((await share(w.dm, mine)).error, /duplicate key/, 'no duplicate copies');
  assert.equal((await as(w.p, 'select name from public.campaign_homebrew')).rows.length, 1);
  assert.equal((await as(w.outsider, 'select name from public.campaign_homebrew')).rows.length, 0);
  assert.equal((await as(w.p, 'delete from public.campaign_homebrew')).affected, 0);
  assert.equal((await as(w.dm, 'delete from public.campaign_homebrew')).affected, 1);
});

test('memories: gated by the DM’s plan; players only read published player-visible ones; images follow the same split', async () => {
  const w = await started('mem');
  const add = (uid, o = {}) => as(uid, `insert into public.campaign_memories (campaign_id, title, content, visibility, status, kind) values ($1, $2, 'x', $3, $4, 'event') returning id`, [w.id, o.title || 'The fall of the gate', o.vis || 'players', o.status || 'published']);
  assert.match((await add(w.dm)).error, /row-level security/, 'free plan: locked');
  assert.equal((await as(w.dm, `select (public.campaign_feature_access($1)) ->> 'memories' as m`, [w.id])).rows[0].m, 'false');
  await db.query(`insert into public.account_plans (user_id, plan_id) values ($1, 'dungeon-master')`, [w.dm]);
  assert.equal((await as(w.dm, `select (public.campaign_feature_access($1)) ->> 'memories' as m`, [w.id])).rows[0].m, 'true');
  assert.match((await add(w.p)).error, /row-level security/, 'players cannot write');
  assert.match((await add(w.outsider)).error, /row-level security/);
  assert.ok(!(await add(w.dm, { title: 'Public memory' })).error);
  assert.ok(!(await add(w.dm, { title: 'Private DM note', vis: 'dm' })).error);
  assert.ok(!(await add(w.dm, { title: 'Draft recap', status: 'draft' })).error);
  assert.deepEqual((await as(w.p, 'select title from public.campaign_memories order by title')).rows.map((r) => r.title), ['Public memory']);
  assert.equal((await as(w.dm, 'select title from public.campaign_memories')).rows.length, 3);
  assert.equal((await as(w.outsider, 'select title from public.campaign_memories')).rows.length, 0);
  const pub = (await as(w.dm, `select published_at from public.campaign_memories where title = 'Public memory'`)).rows[0];
  assert.ok(pub.published_at, 'published_at is set by the database');
  assert.match((await as(w.dm, `update public.campaign_memories set published_at = null where title = 'Public memory'`)).error, /permission denied/);
  assert.equal((await as(w.p, `update public.campaign_memories set title = 'hacked'`)).affected, 0);
  assert.equal((await as(w.p, 'delete from public.campaign_memories')).affected, 0);
  // downgrade: the archive stays readable, but nothing new can be written
  await db.query(`update public.account_plans set status = 'canceled' where user_id = $1`, [w.dm]);
  assert.equal((await as(w.p, 'select title from public.campaign_memories')).rows.length, 1);
  assert.match((await add(w.dm, { title: 'Too late' })).error, /row-level security/);
  await db.query(`update public.account_plans set status = 'active' where user_id = $1`, [w.dm]);
  // images
  const img = (folder) => `${w.id}/${folder}/pic1.jpg`;
  assert.ok(!(await as(w.dm, `insert into storage.objects (bucket_id, name) values ('campaign-memories', $1)`, [img('players')])).error);
  assert.ok(!(await as(w.dm, `insert into storage.objects (bucket_id, name) values ('campaign-memories', $1)`, [`${w.id}/dm/secret.jpg`])).error);
  assert.match((await as(w.p, `insert into storage.objects (bucket_id, name) values ('campaign-memories', $1)`, [`${w.id}/players/mine.jpg`])).error, /row-level security/);
  assert.match((await as(w.dm, `insert into storage.objects (bucket_id, name) values ('campaign-memories', $1)`, [`${w.id}/elsewhere/x.jpg`])).error, /row-level security/);
  assert.deepEqual((await as(w.p, `select name from storage.objects where bucket_id = 'campaign-memories'`)).rows.map((r) => r.name.split('/')[1]), ['players']);
  assert.equal((await as(w.dm, `select name from storage.objects where bucket_id = 'campaign-memories'`)).rows.length, 2);
  assert.equal((await as(w.outsider, `select name from storage.objects where bucket_id = 'campaign-memories'`)).rows.length, 0);
});

test('entitlements: plans and purchases cannot be written by clients; one paid purchase unlocks the book for the whole campaign', async () => {
  const w = await started('book', 2);
  const [p1, p2] = w.ps;
  await db.query(`insert into public.account_plans (user_id, plan_id) values ($1, 'dungeon-master')`, [w.dm]);
  assert.match((await as(w.dm, `insert into public.account_plans (user_id, plan_id) values ($1, 'fogger-of-the-dragons')`, [w.dm])).error, /permission denied/, 'nobody grants themselves a plan');
  assert.match((await as(w.dm, `update public.account_plans set plan_id = 'fogger-of-the-dragons'`)).error, /permission denied/);
  assert.equal((await as(p1, 'select 1 from public.account_plans')).rows.length, 0, 'plans are private');
  for (const uid of [p1, w.dm]) {
    assert.match((await as(uid, `insert into public.campaign_entitlements (campaign_id, product, purchased_by, status) values ($1, 'campaign_book_digital', $2, 'paid')`, [w.id, uid])).error, /permission denied/, 'a button click cannot create a purchase');
  }
  const access = async (uid) => (await as(uid, 'select public.campaign_feature_access($1) as a', [w.id])).rows[0].a;
  assert.deepEqual(['dungeon-master', true, false], [(await access(p1)).owner_plan, (await access(p1)).memories, (await access(p1)).book_unlocked]);
  assert.match((await as(p1, 'select public.campaign_book($1)', [w.id])).error, /isn't unlocked/);
  assert.match((await as(w.outsider, 'select public.campaign_feature_access($1)', [w.id])).error, /Campaign not found/);
  assert.match((await as(w.outsider, 'select public.campaign_book($1)', [w.id])).error, /Campaign not found/);
  // a pending purchase does not unlock; a paid one (recorded by the payment integration) unlocks it for everyone
  const ent = (await db.query(`insert into public.campaign_entitlements (campaign_id, product, purchased_by, status, provider, provider_ref, amount_cents, currency) values ($1, 'campaign_book_digital', $2, 'pending', 'test', 'pi_1', 999, 'usd') returning id`, [w.id, p2])).rows[0].id;
  assert.equal((await access(p1)).book_unlocked, false);
  await db.query(`update public.campaign_entitlements set status = 'paid' where id = $1`, [ent]);
  for (const uid of [w.dm, p1, p2]) assert.equal((await access(uid)).book_unlocked, true, 'every member has the book');
  const a = await access(p1);
  assert.equal(a.book_purchased, true);
  assert.match(a.book_purchased_by, /r-p1-book/);
  assert.equal((await as(p1, 'select purchased_by from public.campaign_entitlements')).rows.length, 1, 'members can see who bought it');
  assert.equal((await as(w.outsider, 'select 1 from public.campaign_entitlements')).rows.length, 0);
  // buying does not grant editing
  assert.match((await as(p2, `insert into public.campaign_memories (campaign_id, title, visibility, status) values ($1, 'Purchaser note', 'players', 'published')`, [w.id])).error, /row-level security/);
  assert.equal((await as(p2, `update public.campaigns set name = 'Mine now' where id = $1`, [w.id])).affected, 0, 'the purchaser cannot edit the campaign');
  // the book contains only published, player-visible material
  await as(w.dm, `insert into public.campaign_memories (campaign_id, title, content, visibility, status) values ($1, 'Public', 'for all', 'players', 'published'), ($1, 'Secret', 'dm only', 'dm', 'published'), ($1, 'Draft', 'wip', 'players', 'draft')`, [w.id]);
  const book = (await as(p1, 'select public.campaign_book($1) as b', [w.id])).rows[0].b;
  assert.deepEqual(book.memories.map((m) => m.title), ['Public']);
  assert.ok(!JSON.stringify(book).includes('dm only'));
  assert.equal(book.party.length, 2);
  assert.equal(book.campaign.name, 'Locked');
  // a second paid copy for the same campaign is refused by the database
  assert.match((await db.query(`insert into public.campaign_entitlements (campaign_id, product, status) values ($1, 'campaign_book_digital', 'paid')`, [w.id]).catch((e) => ({ error: e.message }))).error, /duplicate key/);
  // the top tier includes the digital book without a purchase
  const w2 = await started('book2');
  await db.query(`insert into public.account_plans (user_id, plan_id) values ($1, 'fogger-of-the-dragons')`, [w2.dm]);
  assert.equal((await as(w2.p, 'select public.campaign_feature_access($1) as a', [w2.id])).rows[0].a.book_included_by_plan, true);
  assert.ok(!(await as(w2.p, 'select public.campaign_book($1)', [w2.id])).error);
  // physical orders are private to the purchaser
  await db.query(`insert into public.campaign_book_orders (campaign_id, purchased_by, shipping) values ($1, $2, '{"name":"Sam"}')`, [w.id, p2]);
  assert.equal((await as(p2, 'select 1 from public.campaign_book_orders')).rows.length, 1);
  assert.equal((await as(p1, 'select 1 from public.campaign_book_orders')).rows.length, 0);
  assert.equal((await as(w.dm, 'select 1 from public.campaign_book_orders')).rows.length, 0, 'not even the DM sees shipping details');
  assert.match((await as(p2, `insert into public.campaign_book_orders (campaign_id, purchased_by) values ($1, $2)`, [w.id, p2])).error, /permission denied/);
});

// ---------------------------------------------------------------------------
// Payments (migration 20261114120000_payments.sql) and migration hygiene
// ---------------------------------------------------------------------------
const PAY_FNS = ['public.apply_provider_plan(uuid, text, text, timestamptz, text, text, text, timestamptz)', 'public.apply_provider_book(uuid, uuid, text, text, integer, text)'];

test('payments: only the service role can record plans and purchases; no client can call them', async () => {
  for (const fn of PAY_FNS) {
    const r = (await db.query(`select has_function_privilege('service_role', '${fn}', 'execute') as svc, has_function_privilege('authenticated', '${fn}', 'execute') as auth, has_function_privilege('anon', '${fn}', 'execute') as anon`)).rows[0];
    assert.deepEqual([r.svc, r.auth, r.anon], [true, false, false], fn);
  }
  const u = await newUser('pay-direct@example.com');
  assert.match((await as(u, `select public.apply_provider_plan($1, 'fogger-of-the-dragons', 'active', null, 'x', null, null, now())`, [u])).error, /permission denied/);
  assert.match((await as(u, `select public.apply_provider_book($1, $2, 'paid', 'o1', 100, 'usd')`, [u, u])).error, /permission denied/);
  assert.ok((await as(null, `select public.apply_provider_plan($1, 'dungeon-master', 'active', null, 'x', null, null, now())`, [u])).error, 'anonymous visitors neither');
});

test('payments: a subscription gives its plan; late or repeated events never undo newer ones; a cancelled plan lasts to the end of the paid period', async () => {
  const u = await newUser('pay-plan@example.com');
  const plan = (id, status, end, at) => db.query(`select public.apply_provider_plan($1, $2, $3, $4, 'sub_1', 'cus_1', 'https://store.lemonsqueezy.com/billing?x', $5) as r`, [u, id, status, end, at]).then((r) => r.rows[0].r);
  const visible = async () => (await as(u, `select plan_id, status, portal_url from public.account_plans`)).rows[0];
  const owns = async () => (await db.query('select private.user_plan($1) as p', [u])).rows[0].p;
  assert.equal(await owns(), 'warlord', 'no row = free plan');
  const future = new Date(Date.now() + 20 * 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  assert.equal(await plan('dungeon-master', 'active', future, '2026-11-01T10:00:00Z'), 'applied');
  assert.equal(await owns(), 'dungeon-master');
  assert.equal((await visible()).portal_url, 'https://store.lemonsqueezy.com/billing?x', 'the user can read their own portal link');
  assert.equal(await plan('fogger-of-the-dragons', 'active', future, '2026-11-02T10:00:00Z'), 'applied', 'an upgrade replaces the plan');
  assert.equal(await owns(), 'fogger-of-the-dragons');
  assert.equal(await plan('dungeon-master', 'active', future, '2026-11-01T12:00:00Z'), 'stale', 'an older event arriving late is ignored');
  assert.equal(await owns(), 'fogger-of-the-dragons');
  assert.equal(await plan('fogger-of-the-dragons', 'active', future, '2026-11-02T10:00:00Z'), 'applied', 'the same event twice is harmless');
  assert.equal(await plan('fogger-of-the-dragons', 'canceled', future, '2026-11-03T10:00:00Z'), 'applied');
  assert.equal(await owns(), 'fogger-of-the-dragons', 'cancelled, but paid until the end of the period');
  assert.equal(await plan('fogger-of-the-dragons', 'canceled', past, '2026-11-04T10:00:00Z'), 'applied');
  assert.equal(await owns(), 'warlord', 'after the paid period the free plan is back');
  assert.equal(await plan('dungeon-master', 'past_due', future, '2026-11-05T10:00:00Z'), 'applied');
  assert.equal(await owns(), 'dungeon-master', 'a payment being retried keeps the plan during the paid period');
  assert.equal(await plan('dungeon-master', 'past_due', past, '2026-11-06T10:00:00Z'), 'applied');
  assert.equal(await owns(), 'warlord');
  assert.match((await db.query(`select public.apply_provider_plan($1, 'platinum', 'active', null, 'x', null, null, now())`, [u]).catch((e) => ({ error: e.message }))).error, /Unknown plan/);
  assert.match((await db.query(`select public.apply_provider_plan($1, 'dungeon-master', 'weird', null, 'x', null, null, now())`, [u]).catch((e) => ({ error: e.message }))).error, /Unknown plan or status/);
  assert.equal((await db.query(`select public.apply_provider_plan('00000000-0000-4000-8000-000000000000', 'dungeon-master', 'active', null, 'x', null, null, now()) as r`)).rows[0].r, 'unknown_user');
  assert.ok(!(await as(u, `update public.account_plans set plan_id = 'dungeon-master'`)).affected, 'a user still can’t edit their own plan');
});

test('payments: one paid purchase unlocks the book for the whole campaign, once; refunds relock; every member is told', async () => {
  const w = await started('paybook', 2);
  const [p1, p2] = w.ps;
  const book = (st, ref = 'ord_1', c = w.id, u = p2) => db.query(`select public.apply_provider_book($1, $2, $3, $4, 1500, 'USD') as r`, [c, u, st, ref]).then((r) => r.rows[0].r);
  const access = async (uid) => (await as(uid, 'select public.campaign_feature_access($1) as a', [w.id])).rows[0].a;
  assert.equal(await book('paid', 'ord_x', '00000000-0000-4000-8000-000000000000'), 'unknown_campaign');
  assert.match((await db.query(`select public.apply_provider_book($1, $2, 'bogus', 'o', 1, 'usd')`, [w.id, p2]).catch((e) => ({ error: e.message }))).error, /Unknown status/);
  assert.equal(await book('pending'), 'applied');
  assert.equal((await access(p1)).book_unlocked, false, 'a pending order unlocks nothing');
  assert.equal(await book('paid'), 'updated', 'the same order turning paid');
  for (const uid of [w.dm, p1, p2]) assert.equal((await access(uid)).book_unlocked, true, 'every member has the book');
  assert.equal(await book('paid'), 'unchanged', 'the webhook delivered twice');
  const row = (await as(p1, 'select purchased_by, provider, provider_ref, amount_cents, currency, status from public.campaign_entitlements')).rows[0];
  assert.deepEqual([row.provider, row.provider_ref, row.amount_cents, row.currency, row.status], ['lemonsqueezy', 'ord_1', 1500, 'usd', 'paid']);
  assert.equal(row.purchased_by, p2, 'who bought it is recorded');
  assert.equal((await as(w.outsider, 'select 1 from public.campaign_entitlements')).rows.length, 0);
  // a second member paying at the same moment: recorded, flagged, not a second unlock
  assert.equal(await book('paid', 'ord_2', w.id, p1), 'duplicate_needs_refund');
  assert.equal((await db.query(`select count(*)::int as n from public.campaign_entitlements where campaign_id = $1 and status = 'paid'`, [w.id])).rows[0].n, 1);
  assert.equal(await book('refunded'), 'updated');
  assert.equal((await access(p1)).book_unlocked, false, 'a refund locks it again');
  // history and notifications of the unlock (a fresh campaign, so only one unlock exists)
  const w2 = await started('paybook2', 1);
  await db.query(`select public.apply_provider_book($1, $2, 'paid', 'ord_9', 900, 'eur')`, [w2.id, w2.p]);
  assert.match((await as(w2.dm, `select summary from public.campaign_history where kind = 'book_unlocked'`)).rows[0].summary, /bought the campaign book for everyone/);
  for (const uid of [w2.dm, w2.p]) assert.match((await as(uid, `select title from public.campaign_notifications where kind = 'book'`)).rows[0].title, /book is unlocked/);
  assert.equal((await as(w2.outsider, `select 1 from public.campaign_history`)).rows.length, 0);
  assert.equal((await db.query(`select currency from public.campaign_entitlements where provider_ref = 'ord_9'`)).rows[0].currency, 'eur');
  // buying does not grant any edit right
  assert.equal((await as(p2, `update public.campaigns set name = 'Bought it' where id = $1`, [w.id])).affected, 0);
});

test('migrations: files are ordered, uniquely numbered and every one applies in order on an empty database', () => {
  const dir = process.env.MIGRATIONS_DIR || path.join(ROOT, 'supabase/migrations');
  const files = fs.readdirSync(dir).filter((x) => x.endsWith('.sql'));
  const sorted = [...files].sort();
  assert.deepEqual(files.sort(), sorted);
  const stamps = files.map((f) => f.split('_')[0]);
  assert.ok(stamps.every((s) => /^\d{14}$/.test(s)), 'every file starts with a 14-digit timestamp');
  assert.equal(new Set(stamps).size, stamps.length, 'no two migrations share a timestamp');
  assert.ok(files.length >= 14 && files.includes('20261114120000_payments.sql'), 'all migrations are present');
});

test('migrations from 20261112 on can be run again on a database that already has them, without losing data', async () => {
  const w = await workspace('rerun');
  await as(w.p, 'insert into public.campaign_messages (campaign_id, body) values ($1, $2)', [w.id, 'Still here after a re-run']);
  const before = (await db.query(`select count(*)::int as n from pg_policies where schemaname in ('public', 'storage')`)).rows[0].n;
  // Realtime: a publication like Supabase's, so the "add table" step is exercised too (run twice: added once).
  await db.exec('create publication supabase_realtime');
  const dir = process.env.MIGRATIONS_DIR || path.join(ROOT, 'supabase/migrations');
  for (let pass = 0; pass < 2; pass++) {
    // Everything from 20261112 on, in order (re-running an older file alone would put back older function versions).
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql') && x >= '20261112').sort()) {
      await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
    }
  }
  assert.equal((await as(w.p, 'select body from public.campaign_messages where campaign_id = $1', [w.id])).rows[0].body, 'Still here after a re-run');
  assert.equal((await db.query(`select count(*)::int as n from pg_policies where schemaname in ('public', 'storage')`)).rows[0].n, before, 'same policies, none duplicated or lost');
  const pub = (await db.query(`select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1`)).rows.map((r) => r.tablename);
  assert.ok(pub.includes('campaign_messages') && pub.includes('campaign_memories'));
  assert.equal(new Set(pub).size, pub.length, 'each table published once');
  // the policies still protect the data after the re-run
  assert.equal((await as(w.outsider, 'select 1 from public.campaign_messages')).rows.length, 0);
  assert.match((await as(w.outsider, 'insert into public.campaign_messages (campaign_id, body) values ($1, $2)', [w.id, 'x'])).error, /row-level security/);
  await db.exec('drop publication supabase_realtime');
});

// ---------------------------------------------------------------------------
// Character limit (migration 20261115120000_character_limit.sql)
// ---------------------------------------------------------------------------
test('character limit: Free gets 3 slots, deleted characters free a slot, nothing else can add one', async () => {
  const u = await newUser('chars-free@example.com');
  const reg = (id) => as(u, 'select public.register_character($1) as r', [id]);
  const usage = async () => (await as(u, 'select public.character_usage() as u')).rows[0].u;
  // first check-in adopts what the browser already has
  const first = (await as(u, 'select public.sync_character_registry($1) as u', [['c_old1']])).rows[0].u;
  assert.deepEqual([first.plan, first.limit, first.count], ['warlord', 3, 1]);
  assert.ok(!(await reg('c_new1')).error);
  assert.ok(!(await reg('c_new2')).error);
  assert.equal((await usage()).count, 3);
  const over = await reg('c_new3');
  assert.match(over.error, /allows up to 3 characters/, 'the 4th is refused by the database');
  assert.equal((await reg('c_new1')).error, undefined, 'registering an existing one again is harmless');
  assert.equal((await usage()).count, 3);
  // a second sync can't adopt more (only the very first check-in adopts)
  await as(u, 'select public.sync_character_registry($1)', [['c_x1', 'c_x2', 'c_x3']]);
  assert.equal((await usage()).count, 3, 'later syncs add nothing');
  // deleting frees the slot; deleted characters don't count
  await as(u, 'select public.unregister_character($1)', ['c_new2']);
  assert.equal((await usage()).count, 2);
  assert.ok(!(await reg('c_new3')).error, 'a freed slot can be used');
  assert.equal((await db.query(`select count(*)::int as n from public.character_registry where user_id = $1`, [u])).rows[0].n, 4, 'the deleted one is kept, marked deleted');
  // no direct writes, no reading others
  assert.match((await as(u, `insert into public.character_registry (user_id, character_id) values ($1, 'sneaky')`, [u])).error, /permission denied/);
  assert.match((await as(u, `update public.character_registry set deleted_at = now()`)).error, /permission denied/);
  assert.match((await as(u, `delete from public.character_registry`)).error, /permission denied/);
  assert.match((await as(u, `insert into public.character_registry_state (user_id) values ($1)`, [u])).error, /permission denied/);
  const other = await newUser('chars-other@example.com');
  assert.equal((await as(other, 'select 1 from public.character_registry')).rows.length, 0);
  assert.match((await as(u, 'select public.register_character($1)', ['bad id with spaces'])).error, /not a valid character id/);
  assert.ok((await as(null, 'select public.register_character($1)', ['anon1'])).error, 'anonymous visitors cannot register');
});

test('character limit: paid plans are unlimited; dropping back to Free keeps characters but blocks new ones', async () => {
  const u = await newUser('chars-paid@example.com');
  await db.query(`insert into public.account_plans (user_id, plan_id) values ($1, 'dungeon-master')`, [u]);
  await as(u, 'select public.sync_character_registry($1)', [[]]);
  for (let i = 0; i < 6; i++) assert.ok(!(await as(u, 'select public.register_character($1)', ['p' + i])).error);
  const paid = (await as(u, 'select public.character_usage() as u')).rows[0].u;
  assert.deepEqual([paid.plan, paid.limit, paid.count], ['dungeon-master', null, 6]);
  await db.query(`update public.account_plans set plan_id = 'fogger-of-the-dragons' where user_id = $1`, [u]);
  assert.equal((await as(u, 'select public.character_usage() as u')).rows[0].u.limit, null);
  await db.query(`update public.account_plans set status = 'canceled', current_period_end = now() - interval '1 day' where user_id = $1`, [u]);
  const lapsed = (await as(u, 'select public.character_usage() as u')).rows[0].u;
  assert.deepEqual([lapsed.plan, lapsed.limit, lapsed.count], ['warlord', 3, 6], 'all 6 are kept');
  assert.match((await as(u, 'select public.register_character($1)', ['p9'])).error, /allows up to 3/);
});

test('character limit: two tabs racing for the last Free slot get one slot, not two', async () => {
  const u = await newUser('chars-race@example.com');
  await as(u, 'select public.sync_character_registry($1)', [['a', 'b']]);
  const results = [await as(u, 'select public.register_character($1)', ['tab1']), await as(u, 'select public.register_character($1)', ['tab2'])];
  assert.equal(results.filter((r) => !r.error).length, 1);
  assert.equal((await as(u, 'select public.character_usage() as u')).rows[0].u.count, 3);
});

// ---------------------------------------------------------------------------
// Automatic scheduler (migration 20261115120100_schedule_automation.sql)
// ---------------------------------------------------------------------------
async function autoRequest(w, format, opts = {}) {
  const base = Date.now() + 6 * 86400000;
  const slots = [0, 1, 2].map((n) => ({ id: 's' + (n + 1), start: new Date(base + n * 86400000).toISOString(), end: new Date(base + n * 86400000 + 4 * 3600000).toISOString() }));
  const rid = (await as(w.dm, 'select public.create_schedule_request($1, $2, $3, $4, $5, $6::jsonb, $7, false) as id', [w.id, 'Auto ' + format, '', format, null, JSON.stringify(slots), opts.due || null])).rows[0].id;
  if (opts.auto !== false) await as(w.dm, 'select public.set_schedule_automation($1, true, $2)', [rid, opts.link || null]);
  await as(w.dm, 'select public.publish_schedule_request($1)', [rid]);
  return rid;
}
const answerAuto = (uid, rid, av, host = null) => as(uid, 'select public.submit_schedule_response($1, $2::jsonb, $3, $4, $5, null, null, null) as st', [rid, JSON.stringify(av), !!host, host, !!host]);
const reqRow = (w, rid) => as(w.dm, 'select status, proposal, declined_slots from public.campaign_schedule_requests where id = $1', [rid]).then((r) => r.rows[0]);

test('auto scheduler: once everyone answers, the best common time is proposed by itself (prefer first, then earliest) — still only a proposal', async () => {
  const w = await started('auto1', 2);
  const [p1, p2] = w.ps;
  const rid = await autoRequest(w, 'online', { link: 'https://meet.example.com/fod-auto' });
  await answerAuto(w.dm, rid, { s1: 'available', s2: 'available', s3: 'available' });
  await answerAuto(p1, rid, { s1: 'available', s2: 'preferred', s3: 'available' });
  assert.equal((await reqRow(w, rid)).status, 'waiting', 'nothing happens before everyone answers');
  const last = await answerAuto(p2, rid, { s1: 'unavailable', s2: 'available', s3: 'preferred' });
  assert.equal(last.rows[0].st, 'awaiting_confirmation');
  const r = await reqRow(w, rid);
  assert.equal(r.proposal.slot_id, 's2', 's1 fails for one person; s2 and s3 tie on "prefer", s2 is earlier');
  assert.deepEqual([r.proposal.format, r.proposal.link, r.proposal.link_kind, r.proposal.auto], ['online', 'https://meet.example.com/fod-auto', 'manual', true]);
  assert.equal((await as(w.dm, 'select count(*)::int as n from public.campaign_meetings')).rows[0].n, 0, 'no meeting is created by automation');
  assert.match((await as(p1, `select title from public.campaign_notifications where title like 'Everyone agrees%'`)).rows[0].title, /please confirm/);
  await as(p2, 'select public.decline_schedule($1)', [rid]);
  const r2 = await reqRow(w, rid);
  assert.deepEqual([r2.status, r2.proposal.slot_id, r2.declined_slots], ['awaiting_confirmation', 's3', ['s2']], 'the declined time is skipped');
  await as(p1, 'select public.decline_schedule($1)', [rid]);
  const r3 = await reqRow(w, rid);
  assert.deepEqual([r3.status, r3.proposal], ['consensus', null], 'no unanimous time left: it stops and waits for the DM');
  await as(w.dm, 'select public.reopen_schedule($1)', [rid]);
  assert.deepEqual((await reqRow(w, rid)).declined_slots, [], 'a new round forgets the declined times');
});

test('auto scheduler: in person only when exactly one host agreed to share; otherwise the DM chooses', async () => {
  const w = await started('auto2', 2);
  const [p1, p2] = w.ps;
  const one = await autoRequest(w, 'in_person');
  await answerAuto(w.dm, one, { s1: 'available' });
  await answerAuto(p1, one, { s1: 'available' }, '1 Oak Lane');
  await answerAuto(p2, one, { s1: 'available' });
  const a = await reqRow(w, one);
  assert.deepEqual([a.status, a.proposal.format, a.proposal.host_id], ['awaiting_confirmation', 'in_person', p1]);
  const two = await autoRequest(w, 'in_person');
  await answerAuto(w.dm, two, { s1: 'available' }, 'DM house');
  await answerAuto(p1, two, { s1: 'available' }, '1 Oak Lane');
  await answerAuto(p2, two, { s1: 'available' });
  const b = await reqRow(w, two);
  assert.deepEqual([b.status, b.proposal], ['consensus', null], 'two possible hosts: no guessing');
  const none = await autoRequest(w, 'online');
  for (const u of [w.dm, p1, p2]) await answerAuto(u, none, { s1: 'available' });
  const fog = await reqRow(w, none);
  assert.deepEqual([fog.status, fog.proposal.format, fog.proposal.link || null, fog.proposal.link_kind], ['awaiting_confirmation', 'online', null, 'fog'], 'online with no preset link: proposed as Meeting in the Fog');
  const off = await autoRequest(w, 'online', { auto: false });
  for (const u of [w.dm, p1, p2]) await answerAuto(u, off, { s1: 'available' });
  assert.equal((await reqRow(w, off)).status, 'consensus', 'automation off: unchanged behaviour');
  await as(w.dm, 'select public.set_schedule_automation($1, true, $2)', [off, 'https://meet.example.com/later']);
  assert.equal((await reqRow(w, off)).status, 'awaiting_confirmation', 'switching it on later proposes at once when possible');
});

test('auto scheduler: only the DM sets automation; links are checked; reminders go once to those who have not answered', async () => {
  const w = await started('auto3', 2);
  const [p1, p2] = w.ps;
  const rid = await autoRequest(w, 'online', { due: new Date(Date.now() + 12 * 3600000).toISOString(), link: 'https://meet.example.com/x' });
  assert.match((await as(p1, 'select public.set_schedule_automation($1, true, null)', [rid])).error, /Only the Dungeon Master/);
  assert.match((await as(w.dm, 'select public.set_schedule_automation($1, true, $2)', [rid, 'http://insecure'])).error, /https/);
  assert.match((await as(w.dm, `update public.campaign_schedule_requests set default_link = 'https://x.example.com/aaaa'`)).error, /permission denied/, 'no direct writes');
  await answerAuto(p1, rid, { s1: 'available' });
  const run1 = (await as(p2, 'select public.process_schedule_requests($1) as r', [w.id])).rows[0].r;
  assert.deepEqual([run1.reminded, run1.expired], [1, 0]);
  const rem = (u) => as(u, `select count(*)::int as n from public.campaign_notifications where title like 'Reminder:%'`).then((r) => r.rows[0].n);
  assert.deepEqual([await rem(w.dm), await rem(p2), await rem(p1)], [1, 1, 0], 'only people who have not answered');
  await as(w.dm, 'select public.process_schedule_requests($1)', [w.id]);
  assert.equal(await rem(p2), 1, 'once only');
  assert.deepEqual((await as(w.outsider, 'select public.process_schedule_requests($1) as r', [w.id])).rows[0].r, { closed: 0, expired: 0, reminded: 0, confirmReminded: 0 });
  await db.query(`update public.campaign_schedule_requests set responses_due = now() - interval '1 minute' where id = $1`, [rid]);
  const late = (await as(p1, 'select public.process_schedule_requests($1) as r', [w.id])).rows[0].r;
  assert.deepEqual([late.closed, late.expired], [1, 0], 'deadline with some answers: answers close and suggestions are made (no longer simply expired)');
});

// ---------------------------------------------------------------------------
// Foggy (migrations 20261116120000_foggy.sql, 20261118120100_foggy_on.sql): access follows the plans; the owner's switch
// ---------------------------------------------------------------------------
test('foggy access: Free none, Dungeon Master Foggie, Fogger Foggie+ and Campaign Foggy (own active campaigns only); off until switched on', async () => {
  const w = await workspace('foggy1');
  const acc = (uid, c = null) => as(uid, 'select public.foggy_access($1) as a', [c]).then((r) => r.rows[0].a);
  assert.equal((await db.query(`select enabled from public.app_flags where key = 'foggy'`)).rows[0].enabled, true, 'switched on by 20261118120100_foggy_on.sql');
  await db.query(`update public.app_flags set enabled = false where key = 'foggy'`);
  let a = await acc(w.dm);
  assert.deepEqual([a.plan, a.tier, a.dashboard, a.campaign, a.enabled, a.canGenerate], ['warlord', null, false, false, false, false], 'Free plan: no Foggy');
  await db.query(`insert into public.account_plans (user_id, plan_id) values ($1, 'dungeon-master')`, [w.dm]);
  a = await acc(w.dm, w.id);
  assert.deepEqual([a.tier, a.dashboard, a.campaign, a.canGenerate], ['foggie', true, false, false], 'Dungeon Master: Dashboard Foggie, no Campaign Foggy, nothing generates while off');
  await db.query(`update public.account_plans set plan_id = 'fogger-of-the-dragons' where user_id = $1`, [w.dm]);
  a = await acc(w.dm, w.id);
  assert.deepEqual([a.tier, a.dashboard, a.campaign, a.enabled, a.canGenerate], ['foggie_plus', true, true, false, false], 'Fogger: Foggie+ and Campaign Foggy, still off');
  assert.equal((await acc(w.p, w.id)).campaign, false, 'a player of that campaign gets no Campaign Foggy');
  await db.query(`insert into public.account_plans (user_id, plan_id) values ($1, 'fogger-of-the-dragons')`, [w.p]);
  assert.equal((await acc(w.p, w.id)).campaign, false, 'even a Fogger player: Campaign Foggy is for the campaign’s own DM');
  await db.query(`update public.app_flags set enabled = true where key = 'foggy'`);
  try {
    assert.equal((await acc(w.dm, w.id)).canGenerate, true, 'switched on by the owner (service role): the Fogger DM may generate for their campaign');
    assert.equal((await acc(w.p, w.id)).canGenerate, false, 'not for someone else’s campaign');
    await db.query(`update public.campaigns set status = 'archived' where id = $1`, [w.id]);
    assert.equal((await acc(w.dm, w.id)).campaign, false, 'not for an archived campaign');
  } finally {
    await db.query(`update public.app_flags set enabled = false where key = 'foggy'`);
  }
  assert.match((await as(w.dm, `update public.app_flags set enabled = true where key = 'foggy'`)).error, /permission denied/, 'no one switches it on (or off) from the browser');
  assert.match((await as(w.dm, 'select private.foggy_access($1, null)', [w.dm])).error, /permission denied/);
  assert.equal((await as(w.outsider, `select enabled from public.app_flags where key = 'foggy'`)).rows[0].enabled, false, 'anyone can read the switch');
  await db.query(`update public.app_flags set enabled = true where key = 'foggy'`);
});

test('foggy content: only the server inserts; owners read, mark saved and delete their own; campaign drafts need a campaign', async () => {
  const w = await workspace('foggy2');
  assert.match((await as(w.dm, `insert into public.foggy_content (scope, kind, title) values ('dashboard', 'npc', 'Fake')`)).error, /permission denied/, 'a browser cannot create "generated" content');
  const row = (await db.query(`insert into public.foggy_content (owner_id, scope, kind, title, body) values ($1, 'dashboard', 'npc', 'Mayor Odile', '{"summary":"x"}') returning id`, [w.dm])).rows[0];
  assert.match((await db.query(`insert into public.foggy_content (owner_id, scope, kind, title) values ($1, 'campaign', 'npc', 'No campaign')`, [w.dm]).catch((e) => ({ error: e.message }))).error || '', /foggy_content_scope/);
  assert.match((await db.query(`insert into public.foggy_content (owner_id, scope, campaign_id, kind, title) values ($1, 'dashboard', $2, 'npc', 'Mixed')`, [w.dm, w.id]).catch((e) => ({ error: e.message }))).error || '', /foggy_content_scope/);
  await db.query(`insert into public.foggy_content (owner_id, scope, campaign_id, kind, title) values ($1, 'campaign', $2, 'location', 'Bell tower')`, [w.dm, w.id]);
  assert.equal((await as(w.dm, 'select count(*)::int as n from public.foggy_content')).rows[0].n, 2);
  assert.equal((await as(w.p, 'select count(*)::int as n from public.foggy_content')).rows[0].n, 0, 'players of the campaign don’t see the DM’s drafts');
  assert.equal((await as(w.dm, `update public.foggy_content set status = 'saved', saved_to = '{"adventureId":"a1","assetId":"x"}' where id = $1`, [row.id])).affected, 1);
  assert.match((await as(w.dm, `update public.foggy_content set body = '{"evil":true}' where id = $1`, [row.id])).error, /permission denied/, 'the generated text itself is not editable in place');
  assert.ok(!(await as(w.p, `delete from public.foggy_content where id = $1`, [row.id])).affected, 'not someone else’s');
  assert.equal((await as(w.dm, `delete from public.foggy_content where id = $1`, [row.id])).affected, 1);
});

// ---------------------------------------------------------------------------
// Marketplace (migration 20261117120000_marketplace.sql)
// ---------------------------------------------------------------------------
async function mktUsers(tag) {
  const creator = await newUser(`mk-c-${tag}@example.com`);
  const buyer = await newUser(`mk-b-${tag}@example.com`);
  const mod = await newUser(`mk-m-${tag}@example.com`);
  await db.query('insert into public.marketplace_moderators (user_id) values ($1)', [mod]);
  return { creator, buyer, mod };
}
const newListing = async (uid, extra = {}) => {
  const f = Object.assign({ kind: 'monster', title: 'Ash Wraith', description: 'A wraith of ash and ember for levels 3 to 5.', price_cents: 0, rights_confirmed: true, content: JSON.stringify({ name: 'Ash Wraith' }), content_kind: 'homebrew' }, extra);
  const r = await as(uid, `insert into public.marketplace_listings (kind, title, description, price_cents, rights_confirmed, content, content_kind) values ($1, $2, $3, $4, $5, $6::jsonb, $7) returning id`, [f.kind, f.title, f.description, f.price_cents, f.rights_confirmed, f.content, f.content_kind]);
  if (r.error) throw new Error(r.error);
  return r.rows[0].id;
};
const listingRow = (id) => db.query('select * from public.marketplace_listings where id = $1', [id]).then((r) => r.rows[0]);

test('marketplace: drafts are private; review before publishing; only moderators decide; creators edit only their own', async () => {
  const u = await mktUsers('flow');
  const id = await newListing(u.creator);
  assert.equal((await as(u.buyer, 'select count(*)::int as n from public.marketplace_listings where id = $1', [id])).rows[0].n, 0, 'a draft is invisible to others');
  assert.match((await as(u.creator, `update public.marketplace_listings set status = 'published' where id = $1`, [id])).error, /permission denied/, 'status is not writable directly');
  assert.ok(!(await as(u.buyer, `update public.marketplace_listings set title = 'Stolen' where id = $1`, [id])).affected, 'someone else cannot edit it');
  assert.ok(!(await as(u.buyer, 'delete from public.marketplace_listings where id = $1', [id])).affected, 'or delete it');
  assert.match((await as(u.creator, 'select public.moderate_listing($1, $2, $3)', [id, 'approve', ''])).error, /Only marketplace moderators/);
  await as(u.creator, 'select public.submit_listing($1)', [id]);
  assert.equal((await listingRow(id)).status, 'pending_review');
  assert.equal((await as(u.buyer, 'select count(*)::int as n from public.marketplace_listings where id = $1', [id])).rows[0].n, 0, 'pending is not public');
  assert.match((await as(u.mod, 'select public.moderate_listing($1, $2, $3)', [id, 'reject', ''])).error, /why/);
  await as(u.mod, 'select public.moderate_listing($1, $2, $3)', [id, 'reject', 'Please add the levels.']);
  assert.equal((await listingRow(id)).status, 'rejected');
  assert.match((await as(u.creator, `select title from public.campaign_notifications where title like 'Changes needed%'`)).rows[0].title, /Ash Wraith/, 'the creator is told why');
  await as(u.creator, 'select public.submit_listing($1)', [id]);
  await as(u.mod, 'select public.moderate_listing($1, $2, $3)', [id, 'approve', '']);
  assert.equal((await as(u.buyer, 'select status from public.marketplace_listings where id = $1', [id])).rows[0].status, 'published');
  await as(u.creator, `update public.marketplace_listings set description = 'Now with a different description entirely.' where id = $1`, [id]);
  assert.equal((await listingRow(id)).status, 'pending_review', 'changing a published listing sends it back to review');
});

test('marketplace: submit checks rights, content and SRD attribution; uploads must be in the listing folder; no executables', async () => {
  const u = await mktUsers('rules');
  const noRights = await newListing(u.creator, { rights_confirmed: false });
  assert.match((await as(u.creator, 'select public.submit_listing($1)', [noRights])).error, /right to share/);
  const empty = await newListing(u.creator, { content: null, content_kind: null });
  assert.match((await as(u.creator, 'select public.submit_listing($1)', [empty])).error, /Add something to download/);
  await as(u.creator, `update public.marketplace_listings set origin = 'srd-based' where id = $1`, [noRights]);
  await as(u.creator, `update public.marketplace_listings set rights_confirmed = true where id = $1`, [noRights]);
  assert.match((await as(u.creator, 'select public.submit_listing($1)', [noRights])).error, /attribution/);
  const okPath = `${u.creator}/${empty}/files/rules.pdf`;
  assert.equal((await as(u.creator, `update public.marketplace_listings set files = $2::jsonb where id = $1`, [empty, JSON.stringify([{ path: okPath, name: 'rules.pdf', size: 1000 }])])).affected, 1);
  assert.match((await as(u.creator, `update public.marketplace_listings set files = $2::jsonb where id = $1`, [empty, JSON.stringify([{ path: `${u.creator}/${empty}/files/run.exe`, name: 'run.exe' }])])).error, /PDF, image/);
  assert.match((await as(u.creator, `update public.marketplace_listings set cover_path = $2 where id = $1`, [empty, `${u.buyer}/${empty}/media/x.png`])).error, /uploaded for this listing/);
  assert.match((await as(u.creator, `insert into storage.objects (bucket_id, name) values ('marketplace', $1)`, [`${u.creator}/${empty}/files/evil.exe`])).error, /row-level security/, 'storage refuses executable names');
  assert.equal((await as(u.creator, `insert into storage.objects (bucket_id, name) values ('marketplace', $1)`, [okPath])).affected, 1);
  assert.match((await as(u.buyer, `insert into storage.objects (bucket_id, name) values ('marketplace', $1)`, [`${u.creator}/${empty}/files/b.pdf`])).error, /row-level security/, 'nobody uploads into another creator’s folder');
  assert.equal((await as(u.buyer, `select count(*)::int as n from storage.objects where name = $1`, [okPath])).rows[0].n, 0, 'files of an unpublished listing are private');
});

test('marketplace: free listings go to the library; paid ones only through a paid order with server prices and FOD’s fee', async () => {
  const u = await mktUsers('buy');
  const free = await newListing(u.creator, { title: 'Free Goblin Camp' });
  const paid = await newListing(u.creator, { title: 'The Sunken Bell', kind: 'adventure', price_cents: 1000, content: JSON.stringify({ title: 'Bell' }), content_kind: 'adventure' });
  for (const id of [free, paid]) { await as(u.creator, 'select public.submit_listing($1)', [id]); await as(u.mod, 'select public.moderate_listing($1, $2, $3)', [id, 'approve', '']); }
  await as(u.buyer, 'select public.claim_free_listing($1)', [free]);
  assert.equal((await as(u.buyer, 'select public.listing_content($1) as c', [free])).rows[0].c.content.name, 'Ash Wraith');
  assert.match((await as(u.buyer, 'select public.claim_free_listing($1)', [paid])).error, /isn’t free/);
  assert.match((await as(u.buyer, 'select public.listing_content($1)', [paid])).error, /Get this listing first/);
  assert.match((await as(u.buyer, `insert into public.marketplace_library (user_id, listing_id, source) values ($1, $2, 'purchase')`, [u.buyer, paid])).error, /permission denied/, 'nobody writes the library directly');
  const order = (await as(u.buyer, `select public.create_order($1::jsonb, $2::jsonb) as o`, [JSON.stringify([{ type: 'listing', ref: paid, price: 1 }, { type: 'store', ref: 'mug-tavern', quantity: 2 }]), JSON.stringify({ name: 'Bo', email: 'bo@example.com', cardNumber: '4242424242424242' })])).rows[0].o;
  assert.equal(order.total, 1000 + 2 * 1699, 'prices come from the server, not the cart');
  const o = (await db.query('select * from public.marketplace_orders where id = $1', [order.id])).rows[0];
  assert.equal(o.customer.cardNumber, undefined, 'card data is never stored');
  const item = (await db.query(`select * from public.marketplace_order_items where order_id = $1 and item_type = 'listing'`, [order.id])).rows[0];
  assert.deepEqual([item.fee_cents, item.creator_cents], [100, 900], 'FOD takes 10% (marketplace_settings)');
  assert.match((await as(u.buyer, 'select public.pay_order_demo($1, $2)', [order.id, 'success'])).error, /switched off/, 'no demo payments unless the owner switched them on');
  await db.query(`update public.app_flags set enabled = true where key = 'demo_payments'`);
  try {
    assert.equal((await as(u.buyer, 'select public.pay_order_demo($1, $2) as r', [order.id, 'decline'])).rows[0].r.status, 'declined');
    assert.equal((await as(u.buyer, 'select count(*)::int as n from public.marketplace_library where listing_id = $1', [paid])).rows[0].n, 0, 'declined: nothing granted');
    assert.match((await as(u.creator, 'select public.pay_order_demo($1, $2)', [order.id, 'success'])).error, /Order not found/, 'only the buyer pays their order');
    assert.equal((await as(u.buyer, 'select public.pay_order_demo($1, $2) as r', [order.id, 'success'])).rows[0].r.status, 'paid');
    assert.equal((await as(u.buyer, 'select public.pay_order_demo($1, $2) as r', [order.id, 'success'])).rows[0].r.status, 'paid', 'paying twice changes nothing');
    assert.equal((await as(u.buyer, 'select count(*)::int as n from public.marketplace_library where listing_id = $1', [paid])).rows[0].n, 1, 'bought: in the library once');
    assert.equal((await as(u.buyer, 'select public.listing_content($1) as c', [paid])).rows[0].c.content.title, 'Bell');
    assert.equal((await db.query('select fulfilment from public.marketplace_orders where id = $1', [order.id])).rows[0].fulfilment, 'not_fulfilled_demo', 'merchandise is never shipped');
    assert.match((await as(u.buyer, `select public.create_order($1::jsonb)`, [JSON.stringify([{ type: 'listing', ref: paid }])])).error, /already have/);
    assert.match((await as(u.creator, `select public.create_order($1::jsonb)`, [JSON.stringify([{ type: 'listing', ref: free }])])).error, /free/);
    const stats = (await as(u.creator, 'select public.creator_stats() as s')).rows[0].s.find((x) => x.listing === paid);
    assert.deepEqual([stats.sales, stats.demoSales, stats.gross, stats.net], [1, 1, 1000, 900], 'creators see sales, labelled as demo');
    assert.match((await as(u.buyer, `select public.create_order($1::jsonb)`, [JSON.stringify([{ type: 'plan', ref: 'plan_dm_monthly' }])])).error, /can’t be bought here/, 'ordinary users can’t give themselves a plan');
    assert.match((await as(u.buyer, `select public.demo_set_plan('fogger-of-the-dragons')`)).error, /test owners/);
    await db.query('insert into public.dev_test_owners (user_id) values ($1)', [u.buyer]);
    assert.equal((await as(u.buyer, `select public.demo_set_plan('fogger-of-the-dragons') as p`)).rows[0].p, 'fogger-of-the-dragons', 'a test owner switches tiers (the real plan table, labelled demo)');
    assert.equal((await as(u.buyer, `select public.foggy_access(null) as a`)).rows[0].a.tier, 'foggie_plus', 'server-enforced features follow the test tier');
    assert.equal((await as(u.buyer, `select public.demo_set_plan('warlord') as p`)).rows[0].p, 'warlord');
    await db.query(`insert into public.account_plans (user_id, plan_id, provider) values ($1, 'dungeon-master', 'lemonsqueezy')`, [u.mod]);
    await db.query('insert into public.dev_test_owners (user_id) values ($1)', [u.mod]);
    assert.match((await as(u.mod, `select public.demo_set_plan('warlord')`)).error, /real plan/, 'a real paid plan is never overwritten');
  } finally {
    await db.query(`update public.app_flags set enabled = false where key = 'demo_payments'`);
  }
});

test('marketplace: reports; three open reports send a listing back to review; owners can’t report their own; removal keeps buyers’ access', async () => {
  const u = await mktUsers('rep');
  const id = await newListing(u.creator, { title: 'Reported Thing' });
  await as(u.creator, 'select public.submit_listing($1)', [id]);
  await as(u.mod, 'select public.moderate_listing($1, $2, $3)', [id, 'approve', '']);
  await as(u.buyer, 'select public.claim_free_listing($1)', [id]);
  assert.match((await as(u.creator, 'select public.report_listing($1, $2, $3)', [id, 'spam', ''])).error, /your own/);
  const others = [u.buyer, u.mod, await newUser('mk-x-rep@example.com')];
  for (const r of others.slice(0, 2)) await as(r, 'select public.report_listing($1, $2, $3)', [id, 'copyright', 'Looks copied']);
  assert.equal((await listingRow(id)).status, 'published');
  await as(others[2], 'select public.report_listing($1, $2, $3)', [id, 'copyright', 'Copied']);
  assert.equal((await listingRow(id)).status, 'pending_review', 'back to review after 3 reports');
  assert.equal((await as(u.buyer, 'select count(*)::int as n from public.marketplace_reports')).rows[0].n, 1, 'reporters see only their own reports');
  assert.equal((await as(u.mod, 'select count(*)::int as n from public.marketplace_reports where listing_id = $1', [id])).rows[0].n, 3);
  await as(u.mod, 'select public.moderate_listing($1, $2, $3)', [id, 'remove', 'Copyright claim upheld.']);
  assert.equal((await listingRow(id)).status, 'removed');
  assert.match((await as(u.creator, `update public.marketplace_listings set title = 'Back again' where id = $1`, [id])).error, /removed/);
  assert.equal((await as(u.buyer, 'select public.listing_content($1) as c', [id])).rows[0].c.kind, 'homebrew', 'people who already had it keep it');
  assert.equal((await as(u.buyer, 'select status from public.marketplace_listings where id = $1', [id])).rows[0].status, 'removed', 'and still see it in their library');
  assert.equal((await as(others[2], 'select count(*)::int as n from public.marketplace_listings where id = $1', [id])).rows[0].n, 0, 'others no longer see it');
  assert.ok(!(await as(u.creator, 'delete from public.marketplace_listings where id = $1', [id])).affected, 'a listing others own can’t be deleted');
});

test('marketplace: demo checkout of a campaign book unlocks it through the same code as the payment webhook', async () => {
  const w = await workspace('mkbook');
  await db.query(`insert into public.account_plans (user_id, plan_id) values ($1, 'dungeon-master')`, [w.dm]);
  await db.query(`update public.app_flags set enabled = true where key = 'demo_payments'`);
  try {
    const o = (await as(w.p, `select public.create_order($1::jsonb) as o`, [JSON.stringify([{ type: 'campaign_book', ref: w.id }])])).rows[0].o;
    assert.equal(o.total, 499);
    await as(w.p, 'select public.pay_order_demo($1, $2)', [o.id, 'success']);
    const e = (await db.query(`select status, provider from public.campaign_entitlements where campaign_id = $1`, [w.id])).rows[0];
    assert.deepEqual([e.status, e.provider], ['paid', 'demo']);
    assert.match((await as(w.dm, `select public.create_order($1::jsonb)`, [JSON.stringify([{ type: 'campaign_book', ref: w.id }])])).error, /already unlocked/);
    assert.match((await as(w.outsider, `select public.create_order($1::jsonb)`, [JSON.stringify([{ type: 'campaign_book', ref: w.id }])])).error, /Only members/);
  } finally {
    await db.query(`update public.app_flags set enabled = false where key = 'demo_payments'`);
  }
});

test('combat: an out-of-date save is refused (version check); players can’t save', async () => {
  const w = await started('combatv', 1);
  const enc = JSON.stringify({ schema: 1, name: 'E', status: 'active', round: 1, combatants: [] });
  const pub = JSON.stringify({ schema: 1, name: 'E', status: 'active', round: 1, combatants: [] });
  const v1 = (await as(w.dm, 'select public.save_campaign_combat($1, $2::jsonb, $3::jsonb, null) as v', [w.id, enc, pub])).rows[0].v;
  const v2 = (await as(w.dm, 'select public.save_campaign_combat($1, $2::jsonb, $3::jsonb, $4) as v', [w.id, enc, pub, v1])).rows[0].v;
  assert.equal(v2, v1 + 1);
  assert.match((await as(w.dm, 'select public.save_campaign_combat($1, $2::jsonb, $3::jsonb, $4)', [w.id, enc, pub, v1])).error, /changed somewhere else/);
  assert.match((await as(w.ps[0], 'select public.save_campaign_combat($1, $2::jsonb, $3::jsonb, null)', [w.id, enc, pub])).error, /Only the Dungeon Master/);
});

// ---------------------------------------------------------------------------
// Scheduler: suggestions, deadlines and background processing (migration 20261117120100_scheduler_background.sql)
// ---------------------------------------------------------------------------
async function bgRequest(w, format, opts = {}) {
  const base = Date.now() + 6 * 86400000;
  const slots = (opts.slots || [[0, 4], [1, 4], [2, 1]]).map(([d, h], n) => ({ id: 's' + (n + 1), start: new Date(base + d * 86400000).toISOString(), end: new Date(base + d * 86400000 + h * 3600000).toISOString() }));
  const rid = (await as(w.dm, 'select public.create_schedule_request($1, $2, $3, $4, $5, $6::jsonb, $7, true) as id', [w.id, opts.title || 'Session', '', format, opts.duration || null, JSON.stringify(slots), opts.due || null])).rows[0].id;
  return rid;
}
const bgRow = (rid) => db.query('select * from public.campaign_schedule_requests where id = $1', [rid]).then((r) => r.rows[0]);
const notes = (uid, like) => as(uid, `select title, body from public.campaign_notifications where title like $1`, [like]).then((r) => r.rows);
const answerFull = (uid, rid, av, opts = {}) => as(uid, 'select public.submit_schedule_response($1, $2::jsonb, $3, $4, $5, null, $6, null) as st', [rid, JSON.stringify(av), !!opts.host, opts.host || null, !!opts.host, opts.format || null]);

test('scheduler: when everyone answers, times are ranked by attendance and length, a host and format are suggested, and the DM is told once', async () => {
  const w = await started('bg1', 2);
  const [p1, p2] = w.ps;
  const rid = await bgRequest(w, 'either', { duration: 180 });
  await answerFull(w.dm, rid, { s1: 'available', s2: 'available', s3: 'preferred' });
  await answerFull(p1, rid, { s1: 'unavailable', s2: 'preferred', s3: 'available' }, { host: '1 Oak Lane', format: 'in_person' });
  assert.equal((await bgRow(rid)).suggestions, null, 'nothing is computed before everyone has answered');
  await answerFull(p2, rid, { s1: 'available', s2: 'available', s3: 'available' }, { format: 'in_person' });
  const r = await bgRow(rid);
  assert.equal(r.status, 'consensus');
  const [best, second, third] = r.suggestions;
  assert.deepEqual([best.slot_id, best.everyone, best.yes, best.total, best.fits], ['s2', true, 3, 3, true], 'everyone can come and the slot is long enough');
  assert.deepEqual([best.format, best.hosts], ['in_person', [p1]], 'in person, hosted by the one person who offered and is free then');
  assert.equal(second.slot_id, 's1', 'the 1-hour slot is too short for a 3-hour meeting, so it ranks after one that fits');
  assert.deepEqual([second.yes, second.everyone, third.slot_id, third.fits], [2, false, 's3', false]);
  assert.deepEqual(second.missing, [p1], 'and who can’t come is named, not hidden');
  const dmNotes = await notes(w.dm, 'Everyone answered%');
  assert.equal(dmNotes.length, 1);
  assert.match(dmNotes[0].body, /Everyone can come \(in person possible\)/);
  await answerFull(p2, rid, { s1: 'available', s2: 'available', s3: 'unavailable' });
  assert.equal((await notes(w.dm, 'Everyone answered%')).length, 1, 'changing an answer refreshes the suggestions without a second notification');
  assert.equal((await bgRow(rid)).suggestions.find((x) => x.slot_id === 's3').yes, 2);
});

test('scheduler: the deadline is handled by the background job, with no browser open; it closes answers, suggests, and is idempotent', async () => {
  const w = await started('bg2', 2);
  const [p1] = w.ps;
  const due = new Date(Date.now() + 3600000).toISOString();
  const rid = await bgRequest(w, 'online', { due });
  const silent = await bgRequest(w, 'online', { due, title: 'Nobody answers' });
  await answerFull(p1, rid, { s1: 'available', s2: 'preferred' });
  await db.query(`update public.campaign_schedule_requests set responses_due = now() - interval '1 minute' where id in ($1, $2)`, [rid, silent]);
  const run = (await db.query('select private.process_all_schedule_requests() as r')).rows[0].r; // what pg_cron (or the Edge Function) runs
  assert.ok(run.campaigns >= 1 && run.closed >= 1 && run.expired >= 1, JSON.stringify(run));
  const r = await bgRow(rid);
  assert.deepEqual([r.status, r.answers_closed], ['consensus', true], 'some answers: answers close and the DM decides');
  assert.equal(r.suggestions[0].slot_id, 's2');
  assert.match((await notes(w.dm, 'Answers closed%'))[0].body, /Closest option: .* 1 of 3 can come/);
  assert.equal((await bgRow(silent)).status, 'expired', 'no answers at all: expired');
  assert.equal((await notes(w.dm, 'No answers%')).length, 1);
  await db.query('select private.process_all_schedule_requests()');
  assert.equal((await notes(w.dm, 'Answers closed%')).length + (await notes(w.dm, 'No answers%')).length, 2, 'running again sends nothing new');
  assert.match((await answerFull(w.ps[1], rid, { s1: 'available' })).error, /no longer collecting|deadline/, 'late answers are refused');
  assert.match((await as(p1, 'select private.process_all_schedule_requests()')).error, /permission denied/, 'members can’t run the background job');
  assert.match((await as(p1, 'select public.run_schedule_processing()')).error, /permission denied/, 'nor its service entry point');
  // the DM never answered the poll: proposing counts as the DM's yes, so a time p1 can make works without p2
  const v = (await as(w.dm, 'select public.propose_schedule_option($1, $2, $3, null, $4, $5, $6::uuid[]) as v', [rid, 's2', 'online', 'https://meet.example.com/late', 'manual', [w.ps[1]]])).rows[0].v;
  assert.equal(v, 1, 'proposed after the deadline although the DM had not answered');
  assert.equal((await bgRow(rid)).status, 'awaiting_confirmation');
});

test('scheduler: the DM can propose a time without someone (who is told); everyone else confirms; one meeting, even if confirmed twice; works after the deadline', async () => {
  const w = await started('bg3', 2);
  const [p1, p2] = w.ps;
  const rid = await bgRequest(w, 'online', { due: new Date(Date.now() + 3600000).toISOString() });
  await answerFull(w.dm, rid, { s1: 'available' });
  await answerFull(p1, rid, { s1: 'available' });
  await answerFull(p2, rid, { s1: 'unavailable' });
  assert.match((await as(w.dm, 'select public.propose_schedule($1, $2, $3, null, $4, $5)', [rid, 's1', 'online', 'https://meet.example.com/x', 'manual'])).error, /leave someone out/);
  assert.match((await as(p1, 'select public.propose_schedule_option($1, $2, $3, null, $4, $5, $6::uuid[])', [rid, 's1', 'online', 'https://meet.example.com/x', 'manual', [p2]])).error, /Only the Dungeon Master/);
  assert.match((await as(w.dm, 'select public.propose_schedule_option($1, $2, $3, null, $4, $5, $6::uuid[])', [rid, 's1', 'online', 'https://meet.example.com/x', 'manual', [w.dm]])).error, /can’t be left out/);
  const v = (await as(w.dm, 'select public.propose_schedule_option($1, $2, $3, null, $4, $5, $6::uuid[]) as v', [rid, 's1', 'online', 'https://meet.example.com/x', 'manual', [p2]])).rows[0].v;
  let r = await bgRow(rid);
  assert.deepEqual([r.status, r.required_users.includes(p2), r.excluded_users], ['awaiting_confirmation', false, [p2]]);
  assert.match((await notes(p2, 'Not this time%'))[0].body, /aren't needed to confirm/);
  assert.match((await as(p2, 'select public.confirm_schedule($1, $2, $3)', [rid, v, 's1'])).error, /isn't waiting/, 'the person left out is not asked to confirm');
  await db.query(`update public.campaign_schedule_requests set responses_due = now() - interval '1 minute' where id = $1`, [rid]);
  await as(w.dm, 'select public.confirm_schedule($1, $2, $3)', [rid, v, 's1']);
  const mid = (await as(p1, 'select public.confirm_schedule($1, $2, $3) as m', [rid, v, 's1'])).rows[0].m;
  assert.ok(mid, 'confirmations still count after the answer deadline; the last one creates the meeting');
  assert.match((await as(p1, 'select public.confirm_schedule($1, $2, $3)', [rid, v, 's1'])).error, /nothing to confirm/);
  assert.equal((await db.query('select count(*)::int as n from public.campaign_meetings where campaign_id = $1', [w.id])).rows[0].n, 1, 'exactly one meeting');
  await db.query('select private.process_all_schedule_requests()');
  assert.equal((await bgRow(rid)).status, 'confirmed', 'the background job leaves confirmed requests alone');
});

test('scheduler background: confirmation reminders once a day has passed; a proposal whose time passed expires; stale requests expire', async () => {
  const w = await started('bg4', 2);
  const [p1, p2] = w.ps;
  const rid = await bgRequest(w, 'online');
  for (const u of [w.dm, p1, p2]) await answerFull(u, rid, { s1: 'available', s2: 'available' });
  const v = (await as(w.dm, 'select public.propose_schedule($1, $2, $3, null, $4, $5) as v', [rid, 's1', 'online', 'https://meet.example.com/y', 'manual'])).rows[0].v;
  await as(p1, 'select public.confirm_schedule($1, $2, $3)', [rid, v, 's1']);
  await db.query(`update public.campaign_schedule_requests set proposed_at = now() - interval '25 hours' where id = $1`, [rid]);
  await db.query('select private.process_all_schedule_requests()');
  await db.query('select private.process_all_schedule_requests()');
  assert.deepEqual([(await notes(p2, 'Please confirm%')).length, (await notes(w.dm, 'Please confirm%')).length], [2, 1], 'p2: the proposal and one reminder; the DM (who proposed) only the reminder; p1 already confirmed');
  assert.equal((await notes(p1, 'Please confirm%')).length, 1, 'p1 got the proposal only');
  await db.query(`update public.campaign_schedule_requests set slots = jsonb_set(slots, '{0,start}', to_jsonb((now() - interval '1 hour')::text)) where id = $1`, [rid]);
  await db.query('select private.process_all_schedule_requests()');
  assert.equal((await bgRow(rid)).status, 'expired', 'the proposed time passed before everyone confirmed');
  assert.equal((await notes(w.dm, 'Not confirmed in time%')).length, 1);
  assert.equal((await db.query('select count(*)::int as n from public.campaign_meetings where campaign_id = $1', [w.id])).rows[0].n, 0, 'no meeting was created');
  const stale = await bgRequest(w, 'online', { title: 'Stale' });
  for (const u of [w.dm, p1, p2]) await answerFull(u, stale, { s1: 'available' });
  await db.query(`update public.campaign_schedule_requests set suggested_at = now() - interval '15 days' where id = $1`, [stale]);
  await db.query('select private.process_all_schedule_requests()');
  assert.equal((await bgRow(stale)).status, 'expired', 'two weeks with no decision: expired');
});

test('scheduler background: the migration schedules pg_cron only when the extension exists (never assumed)', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261117120100_scheduler_background.sql'), 'utf8');
  assert.match(sql, /if exists \(select 1 from pg_available_extensions where name = 'pg_cron'\)/);
  assert.match(sql, /cron\.schedule\('fod-schedule-processing', '\*\/10 \* \* \* \*'/);
  assert.ok(fs.existsSync(path.join(ROOT, 'supabase/functions/scheduler-tick/index.ts')), 'the Edge Function fallback exists');
});

test('marketplace: a test owner buys Fogger through the demo checkout (real plan row, labelled demo); a real paid plan is never replaced', async () => {
  const u = await newUser('mk-fog-owner@example.com');
  const real = await newUser('mk-fog-real@example.com');
  await db.query('insert into public.dev_test_owners (user_id) values ($1), ($2)', [u, real]);
  await db.query(`update public.app_flags set enabled = true where key = 'demo_payments'`);
  try {
    const o = (await as(u, `select public.create_order($1::jsonb) as o`, [JSON.stringify([{ type: 'plan', ref: 'plan_fogger_monthly' }])])).rows[0].o;
    assert.equal(o.total, 599, 'the pricing page price');
    assert.equal((await as(u, 'select public.pay_order_demo($1, $2) as r', [o.id, 'success'])).rows[0].r.status, 'paid');
    const plan = (await db.query('select plan_id, provider, status from public.account_plans where user_id = $1', [u])).rows[0];
    assert.deepEqual([plan.plan_id, plan.provider, plan.status], ['fogger-of-the-dragons', 'demo', 'active']);
    assert.equal((await as(u, 'select public.marketplace_access() as a')).rows[0].a.plan, 'fogger-of-the-dragons');
    await db.query(`insert into public.account_plans (user_id, plan_id, provider) values ($1, 'dungeon-master', 'lemonsqueezy')`, [real]);
    assert.match((await as(real, `select public.create_order($1::jsonb)`, [JSON.stringify([{ type: 'plan', ref: 'plan_fogger_monthly' }])])).error, /real plan/);
  } finally {
    await db.query(`update public.app_flags set enabled = false where key = 'demo_payments'`);
  }
});

test('store photos: every official product has a photo path under Assets/Pictures/store with a credit and a Commons source', async () => {
  const u = await newUser('mk-photos@example.com');
  const rows = (await as(u, 'select sku, name, photo, photo_credit, photo_source from public.marketplace_store_products order by sort')).rows;
  assert.ok(rows.length >= 20);
  for (const r of rows) {
    assert.equal(r.photo, 'Assets/Pictures/store/' + r.sku + '.jpg', r.sku);
    assert.match(r.photo_credit, /^Photo: .+, (CC|Public domain).*via Wikimedia Commons$/, r.sku);
    assert.match(r.photo_source, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, r.sku);
    assert.ok(fs.existsSync(path.join(ROOT, r.photo)), 'the file exists: ' + r.photo);
  }
  assert.ok(!rows.some((r) => /Prancing/.test(r.name)));
  assert.match((await db.query(`update public.marketplace_store_products set photo = 'https://evil.example/x.jpg' where sku = 'cap-crit'`).catch((e) => ({ error: e.message }))).error || '', /check/);
});

test('marketplace AI review: moderators are notified; only they read verdicts; only the server publishes, and only an unchanged, low-risk, fully checked, unreported listing in ai_auto mode', async () => {
  const u = await mktUsers('aireview');
  const id = await newListing(u.creator);
  await as(u.creator, 'select public.submit_listing($1)', [id]);
  assert.equal((await as(u.mod, `select count(*)::int as n from public.campaign_notifications where title like 'To review:%' and link like '%' || $1`, [id])).rows[0].n, 1, 'the moderator is told');
  assert.equal((await as(u.creator, `select count(*)::int as n from public.campaign_notifications where title like 'To review:%'`)).rows[0].n, 0, 'the creator is not');
  assert.equal((await as(u.creator, 'select public.marketplace_access() as a')).rows[0].a.reviewMode, 'ai_assist', 'default mode');
  const version = (await listingRow(id)).updated_at;
  const put = (o = {}) => db.query(`insert into public.marketplace_ai_reviews (listing_id, listing_version, decision, risk, summary, inspected) values ($1, $2, $3, $4, 'ok', $5::jsonb)
    on conflict (listing_id) do update set listing_version = excluded.listing_version, decision = excluded.decision, risk = excluded.risk, inspected = excluded.inspected`,
    [id, o.version || version, o.decision || 'approve', o.risk || 'low', JSON.stringify({ complete: o.complete !== false })]);
  await put();
  assert.equal((await as(u.mod, 'select count(*)::int as n from public.marketplace_ai_reviews where listing_id = $1', [id])).rows[0].n, 1, 'moderators read it');
  assert.equal((await as(u.creator, 'select count(*)::int as n from public.marketplace_ai_reviews')).rows[0].n, 0, 'creators do not');
  assert.match((await as(u.mod, `insert into public.marketplace_ai_reviews (listing_id, listing_version, decision, risk) values ($1, now(), 'approve', 'low')`, [id])).error, /permission denied/, 'no browser writes verdicts');
  const fn = 'public.ai_publish_listing(uuid, timestamptz)';
  const priv = (await db.query(`select has_function_privilege('service_role', '${fn}', 'execute') as s, has_function_privilege('authenticated', '${fn}', 'execute') as a`)).rows[0];
  assert.deepEqual([priv.s, priv.a], [true, false], 'only the service role may call it');
  const publish = async () => (await db.query('select public.ai_publish_listing($1, $2) as ok', [id, version])).rows[0].ok;
  assert.equal(await publish(), false, 'not in ai_assist mode');
  await db.query(`update public.marketplace_settings set review_mode = 'ai_auto'`);
  try {
    await put({ risk: 'medium' }); assert.equal(await publish(), false, 'not medium risk');
    await put({ complete: false }); assert.equal(await publish(), false, 'not when something was not checked');
    await put({ decision: 'needs_human' }); assert.equal(await publish(), false, 'not when Gemini is unsure');
    await put();
    assert.equal((await db.query('select public.ai_publish_listing($1, $2::timestamptz - interval \'1 second\') as ok', [id, version])).rows[0].ok, false, 'not when the listing changed since the review');
    assert.equal(await publish(), true);
    const row = await listingRow(id);
    assert.deepEqual([row.status, row.reviewed_by, row.moderation_note], ['published', null, 'Approved by the automatic review.']);
    assert.equal((await as(u.creator, `select count(*)::int as n from public.campaign_notifications where title like 'Published:%'`)).rows[0].n, 1, 'the creator is told');
    assert.equal(await publish(), false, 'only once');
  } finally {
    await db.query(`update public.marketplace_settings set review_mode = 'ai_assist'`);
  }
  assert.match((await db.query(`update public.marketplace_settings set review_mode = 'yolo'`).catch((e) => ({ error: e.message }))).error || '', /review_mode/);
});


// ---------------------------------------------------------------------------
// Meeting in the Fog (migration 20261118120300_meeting_in_the_fog.sql)
// ---------------------------------------------------------------------------
test('Meeting in the Fog: rooms — only the DM opens/closes; one open room per campaign (opening twice returns it); members join; others can’t even find it', async () => {
  const w = await workspace('fog1');
  const other = await workspace('fog1b');
  const open = (uid, c = w.id, m = null, t = null) => as(uid, 'select public.open_meeting_room($1, $2, $3) as id', [c, m, t]);
  assert.match((await open(w.p)).error, /Only the Dungeon Master/);
  assert.match((await open(w.outsider)).error, /Only the Dungeon Master/);
  assert.match((await open(w.dm, other.id)).error, /Only the Dungeon Master/, 'not another campaign');
  const rid = (await open(w.dm, w.id, null, 'Session zero')).rows[0].id;
  assert.equal((await open(w.dm)).rows[0].id, rid, 'a second open (double click, other tab) returns the same room');
  assert.equal((await db.query(`select count(*)::int as n from public.meeting_rooms where campaign_id = $1 and status = 'open'`, [w.id])).rows[0].n, 1);
  const room = (await as(w.p, 'select title, status, provider, provider_room from public.meeting_rooms where id = $1', [rid])).rows[0];
  assert.deepEqual([room.title, room.status, room.provider, room.provider_room], ['Session zero', 'open', 'livekit', 'fod-' + rid]);
  assert.equal((await as(w.outsider, 'select count(*)::int as n from public.meeting_rooms')).rows[0].n, 0, 'outsiders see no rooms');
  assert.equal((await as(other.dm, 'select count(*)::int as n from public.meeting_rooms where id = $1', [rid])).rows[0].n, 0, 'nor other campaigns');
  assert.match((await as(w.p, `select count(*)::int as n from public.campaign_notifications where title = 'Meeting in the Fog is open'`)).rows[0].n === 1 ? 'ok' : 'missing', /ok/, 'players are told');
  // join grant: members yes; outsiders and other campaigns get the same "not found"
  const g = (await as(w.p, 'select public.meeting_join_grant($1) as g', [rid])).rows[0].g;
  assert.deepEqual([g.role, g.providerRoom, g.campaignId, typeof g.name], ['player', 'fod-' + rid, w.id, 'string']);
  assert.equal((await as(w.dm, 'select public.meeting_join_grant($1) as g', [rid])).rows[0].g.role, 'dm');
  assert.match((await as(w.outsider, 'select public.meeting_join_grant($1)', [rid])).error, /Room not found/);
  assert.match((await as(other.dm, 'select public.meeting_join_grant($1)', [rid])).error, /Room not found/);
  assert.match((await as(w.p, 'select public.meeting_join_grant($1)', ['00000000-0000-4000-8000-000000000000'])).error, /Room not found/, 'a made-up id says the same');
  await as(w.p, 'select public.meeting_join_grant($1)', [rid]);
  assert.equal((await db.query('select count(*)::int as n, max(joins) as j from public.meeting_room_participants where room_id = $1 and user_id = $2', [rid, w.p])).rows[0].n, 1, 'joining twice keeps one participant row');
  await as(w.p, 'select public.leave_meeting_room($1)', [rid]);
  assert.equal((await db.query('select status from public.meeting_room_participants where room_id = $1 and user_id = $2', [rid, w.p])).rows[0].status, 'left');
  await as(w.p, 'select public.meeting_join_grant($1)', [rid]);
  const back = (await db.query('select status, joins from public.meeting_room_participants where room_id = $1 and user_id = $2', [rid, w.p])).rows[0];
  assert.deepEqual([back.status, back.joins], ['joined', 2], 'rejoining after leaving counts, still one row');
  assert.equal((await as(w.p, 'select public.meeting_heartbeat($1) as ok', [rid])).rows[0].ok, true);
  assert.equal((await as(w.outsider, 'select count(*)::int as n from public.meeting_room_participants')).rows[0].n, 0);
  // nobody writes the tables directly
  assert.match((await as(w.dm, `insert into public.meeting_rooms (campaign_id, title, created_by, provider_room) values ($1, 'x', $2, 'fod-00000000-0000-4000-8000-000000000001')`, [w.id, w.dm])).error, /permission denied/);
  assert.match((await as(w.dm, `update public.meeting_rooms set status = 'closed' where id = $1`, [rid])).error, /permission denied/);
  assert.match((await as(w.p, `update public.meeting_room_participants set role = 'dm'`)).error, /permission denied/);
  // closing
  assert.match((await as(w.p, 'select public.close_meeting_room($1)', [rid])).error, /Only the Dungeon Master/);
  assert.equal((await as(w.dm, 'select public.close_meeting_room($1) as s', [rid])).rows[0].s, 'closed');
  assert.equal((await as(w.dm, 'select public.close_meeting_room($1) as s', [rid])).rows[0].s, 'closed', 'closing twice is fine');
  assert.equal((await db.query(`select count(*)::int as n from public.meeting_room_participants where room_id = $1 and status = 'joined'`, [rid])).rows[0].n, 0, 'everyone is marked as left');
  assert.match((await as(w.p, 'select public.meeting_join_grant($1)', [rid])).error, /isn't open/);
  assert.equal((await as(w.p, 'select public.meeting_heartbeat($1) as ok', [rid])).rows[0].ok, false);
  const rid2 = (await open(w.dm)).rows[0].id;
  assert.notEqual(rid2, rid, 'a new room after closing');
  // archived campaigns: no opening, no joining
  await db.query(`update public.campaigns set status = 'archived' where id = $1`, [w.id]);
  assert.match((await as(w.p, 'select public.meeting_join_grant($1)', [rid2])).error, /archived/);
  await as(w.dm, 'select public.close_meeting_room($1)', [rid2]);
  assert.match((await open(w.dm)).error, /archived/);
});

test('Meeting in the Fog: a Fog meeting gets one waiting room (never two, also when edited); opening it at meeting time; cancelling closes it', async () => {
  const w = await workspace('fog2');
  const at = new Date(Date.now() + 86400000).toISOString();
  const mid = (await as(w.dm, `insert into public.campaign_meetings (campaign_id, title, starts_at, venue) values ($1, 'Session 3', $2, 'fog') returning id`, [w.id, at])).rows[0].id;
  const rooms = () => db.query('select id, status, title from public.meeting_rooms where meeting_id = $1', [mid]).then((r) => r.rows);
  assert.deepEqual((await rooms()).map((r) => [r.status, r.title]), [['scheduled', 'Session 3']]);
  await as(w.dm, `update public.campaign_meetings set title = 'Session 3: the Bell' where id = $1`, [mid]);
  await as(w.dm, `update public.campaign_meetings set venue = 'fog', description = 'x' where id = $1`, [mid]);
  assert.deepEqual((await rooms()).map((r) => [r.status, r.title]), [['scheduled', 'Session 3: the Bell']], 'edits never duplicate the room');
  const rid = (await as(w.dm, 'select public.open_meeting_room($1, $2) as id', [w.id, mid])).rows[0].id;
  assert.equal(rid, (await rooms())[0].id, 'the waiting room is the one that opens');
  assert.equal((await rooms())[0].status, 'open');
  await as(w.dm, 'select public.close_meeting_room($1)', [rid]);
  assert.equal((await as(w.dm, 'select public.open_meeting_room($1, $2) as id', [w.id, mid])).rows[0].id, rid, 'reopening the meeting reuses its room');
  await as(w.dm, 'select public.close_meeting_room($1)', [rid]);
  const other = await workspace('fog2b');
  assert.match((await as(w.dm, 'select public.open_meeting_room($1, $2)', [w.id, (await as(other.dm, `insert into public.campaign_meetings (campaign_id, title, starts_at) values ($1, 'Theirs', $2) returning id`, [other.id, at])).rows[0].id])).error, /isn't part of this campaign/);
  const mid2 = (await as(w.dm, `insert into public.campaign_meetings (campaign_id, title, starts_at, venue) values ($1, 'Session 4', $2, 'fog') returning id`, [w.id, at])).rows[0].id;
  await as(w.dm, `update public.campaign_meetings set status = 'cancelled' where id = $1`, [mid2]);
  assert.equal((await db.query('select status from public.meeting_rooms where meeting_id = $1', [mid2])).rows[0].status, 'closed', 'a cancelled meeting closes its waiting room');
  assert.match((await as(w.dm, 'select public.open_meeting_room($1, $2)', [w.id, mid2])).error, /over or cancelled/);
  const mid3 = (await as(w.dm, `insert into public.campaign_meetings (campaign_id, title, starts_at, venue) values ($1, 'At Ana''s', $2, 'in_person') returning id`, [w.id, at])).rows[0].id;
  assert.equal((await db.query('select count(*)::int as n from public.meeting_rooms where meeting_id = $1', [mid3])).rows[0].n, 0, 'in-person meetings get no room');
  assert.match((await as(w.dm, `insert into public.campaign_meetings (campaign_id, title, starts_at, venue) values ($1, 'x', $2, 'zoom')`, [w.id, at])).error, /venue/);
});

test('Meeting in the Fog: shared music commands — DM only, ordered by seq (repeats and stale ones ignored), validated, no audio data', async () => {
  const w = await workspace('fog3');
  const rid = (await as(w.dm, 'select public.open_meeting_room($1) as id', [w.id])).rows[0].id;
  const set = (uid, seq, st) => as(uid, 'select public.set_room_audio_state($1, $2, $3::jsonb) as s', [rid, seq, JSON.stringify(st)]);
  assert.match((await set(w.p, 1, { action: 'play', ref: 'builtin:tavern' })).error, /Only the Dungeon Master/);
  assert.equal((await set(w.dm, 1, { action: 'play', ref: 'builtin:tavern', title: 'Tavern', volume: 0.6, position: 12 })).rows[0].s, 1);
  assert.equal((await set(w.dm, 1, { action: 'stop' })).rows[0].s, 1, 'a repeated seq is ignored');
  assert.equal((await set(w.dm, 0, { action: 'stop' })).rows[0].s, 1, 'a stale seq is ignored');
  const st = (await as(w.p, 'select audio_state as a, audio_seq as q from public.meeting_rooms where id = $1', [rid])).rows[0];
  assert.deepEqual([st.a.action, st.a.ref, st.a.playing, Number(st.a.volume), Number(st.a.position), Number(st.q)], ['play', 'builtin:tavern', true, 0.6, 12, 1]);
  assert.ok(st.a.serverAt, 'stamped with the server clock');
  assert.equal((await set(w.dm, 2, { action: 'pause', ref: 'builtin:tavern' })).rows[0].s, 2);
  assert.equal((await as(w.p, 'select audio_state as a from public.meeting_rooms where id = $1', [rid])).rows[0].a.playing, false);
  assert.match((await set(w.dm, 3, { action: 'rickroll' })).error, /Unknown music command/);
  assert.match((await set(w.dm, 3, { action: 'play', ref: 'javascript:alert(1)' })).error, /Invalid track/);
  assert.match((await set(w.dm, 3, { action: 'volume', volume: 7 })).error, /Invalid volume/);
  assert.match((await set(w.dm, 3, { action: 'play', ref: 'x'.repeat(5000) })).error, /Invalid track/, 'no large payloads');
  assert.ok((await as(w.p, 'select public.meeting_now() as t')).rows[0].t, 'server clock for late joiners');
});

test('Meeting in the Fog: the scheduler — an online (Fog) proposal needs no link; confirming makes one Fog meeting with one waiting room; auto-propose works without a link', async () => {
  const w = await started('fog4', 1);
  const [p1] = w.ps;
  const slots = await slotsFor();
  const rid = (await as(w.dm, 'select public.create_schedule_request($1, $2, $3, $4, $5, $6::jsonb, $7, true) as id', [w.id, 'Fog night', '', 'online', 180, JSON.stringify(slots), null])).rows[0].id;
  for (const u of [w.dm, p1]) await as(u, 'select public.submit_schedule_response($1, $2::jsonb, false, null, false, null, null, null)', [rid, JSON.stringify({ s1: 'available', s2: 'available' })]);
  const v = (await as(w.dm, 'select public.propose_schedule($1, $2, $3, null, null, null) as v', [rid, 's1', 'online'])).rows[0].v;
  const prop = (await as(p1, 'select proposal from public.campaign_schedule_requests where id = $1', [rid])).rows[0].proposal;
  assert.deepEqual([prop.format, prop.link || null, prop.link_kind], ['online', null, 'fog'], 'no link generated or needed');
  await as(w.dm, 'select public.confirm_schedule($1, $2, $3)', [rid, v, 's1']);
  const mid = (await as(p1, 'select public.confirm_schedule($1, $2, $3) as m', [rid, v, 's1'])).rows[0].m;
  const m = (await as(p1, 'select venue, location, description from public.campaign_meetings where id = $1', [mid])).rows[0];
  assert.deepEqual([m.venue, m.location], ['fog', 'Meeting in the Fog']);
  assert.match(m.description, /join from the Campaign Feed/);
  assert.ok(!/meet\.google|https?:/.test(m.location + m.description), 'never a Google Meet link');
  assert.equal((await as(p1, `select count(*)::int as n from public.meeting_rooms where meeting_id = $1 and status = 'scheduled'`, [mid])).rows[0].n, 1, 'one room waits for the DM');
  assert.match((await as(p1, 'select public.confirm_schedule($1, $2, $3)', [rid, v, 's1'])).error, /nothing to confirm/, 'confirming again changes nothing');
  assert.equal((await db.query('select count(*)::int as n from public.meeting_rooms where campaign_id = $1', [w.id])).rows[0].n, 1, 'no duplicate room');
  assert.equal((await db.query('select count(*)::int as n from public.meeting_rooms r join public.campaign_schedule_requests q on q.campaign_id = r.campaign_id where q.status <> $1', ['confirmed'])).rows[0].n, 0, 'availability requests never create rooms');
});

// ---------------------------------------------------------------------------
// Foggy assistant and combat requests (migration 20261119120000_foggy_assistant.sql)
// ---------------------------------------------------------------------------
test('Foggy assistant: conversations, images and usage are private to their owner; only the server writes AI rows; new draft kinds', async () => {
  const w = await workspace('fasst');
  const t = (await db.query(`insert into public.foggy_threads (owner_id, scope, title) values ($1, 'dashboard', 'Villains') returning id`, [w.dm])).rows[0].id;
  await db.query(`insert into public.foggy_messages (thread_id, owner_id, role, content) values ($1, $2, 'user', 'Make a villain'), ($1, $2, 'assistant', 'Here is Mother Brine.')`, [t, w.dm]);
  assert.equal((await as(w.dm, 'select count(*)::int as n from public.foggy_messages where thread_id = $1', [t])).rows[0].n, 2);
  assert.equal((await as(w.p, 'select count(*)::int as n from public.foggy_messages')).rows[0].n, 0, 'nobody else reads a conversation');
  assert.equal((await as(w.p, 'select count(*)::int as n from public.foggy_threads')).rows[0].n, 0);
  assert.match((await as(w.dm, `insert into public.foggy_messages (thread_id, owner_id, role, content) values ($1, $2, 'assistant', 'fake answer')`, [t, w.dm])).error, /permission denied/, 'a browser cannot write Foggy answers');
  assert.match((await as(w.dm, `insert into public.foggy_threads (scope, title) values ('dashboard', 'x')`)).error, /permission denied/);
  assert.equal((await as(w.dm, `update public.foggy_threads set workspace = '{"outline":{"title":"Bell"}}'::jsonb where id = $1`, [t])).affected, 1, 'the owner saves the working draft');
  assert.equal((await as(w.p, `update public.foggy_threads set title = 'stolen' where id = $1`, [t])).affected || 0, 0);
  assert.match((await as(w.dm, `update public.foggy_threads set owner_id = $2 where id = $1`, [t, w.p])).error, /permission denied/);
  assert.equal((await as(w.dm, 'delete from public.foggy_threads where id = $1', [t])).affected, 1);
  assert.equal((await db.query('select count(*)::int as n from public.foggy_messages where thread_id = $1', [t])).rows[0].n, 0, 'deleting a conversation deletes its messages');
  const imgId = '11111111-2222-4333-8444-555555555555';
  await db.query(`insert into public.foggy_images (id, owner_id, scope, kind, playable, grid, title, prompt, path, mime) values ($1, $2, 'dashboard', 'battle_map', true, '{"cols":20,"rows":20}', 'Crypt', 'a crypt', $3, 'image/png')`, [imgId, w.dm, w.dm + '/' + imgId + '.png']);
  assert.equal((await as(w.dm, 'select playable from public.foggy_images where id = $1', [imgId])).rows[0].playable, true);
  assert.equal((await as(w.outsider, 'select count(*)::int as n from public.foggy_images')).rows[0].n, 0);
  assert.match((await as(w.dm, `insert into public.foggy_images (owner_id, scope, kind, title, prompt, path, mime) values ($1, 'dashboard', 'portrait', 'x', 'y', 'a/b.png', 'image/png')`, [w.dm])).error, /permission denied/, 'only the server stores generated images');
  assert.match((await as(w.dm, `update public.foggy_images set path = 'other/evil.png' where id = $1`, [imgId])).error, /permission denied/);
  await db.query(`insert into public.foggy_usage (owner_id, kind) values ($1, 'text'), ($1, 'image')`, [w.dm]);
  assert.equal((await as(w.dm, 'select count(*)::int as n from public.foggy_usage')).rows[0].n, 2);
  assert.match((await as(w.dm, 'delete from public.foggy_usage')).error, /permission denied/, 'nobody resets their own usage');
  await db.query(`insert into public.foggy_content (owner_id, scope, kind, title) values ($1, 'dashboard', 'faction', 'The Salt Guild'), ($1, 'dashboard', 'music_plan', 'Cues')`, [w.dm]);
  assert.match((await db.query(`insert into public.foggy_content (owner_id, scope, kind, title) values ($1, 'dashboard', 'malware', 'x')`, [w.dm]).catch((e) => ({ error: e.message }))).error || '', /kind/);
});

test('Combat requests: a player attacks only with their own character, on their turn, in a running combat; the DM applies once', async () => {
  const w = await workspace('creq');
  const pc = 'pc_' + w.p.slice(0, 6), gob = 'mon_goblin', other = 'pc_someone';
  const pub = (turn, extra = {}) => JSON.stringify(Object.assign({ status: 'active', paused: false, turnId: turn, combatants: [{ id: pc, kind: 'pc', userId: w.p }, { id: gob, kind: 'monster', userId: null, defeated: false }, { id: other, kind: 'pc', userId: w.dm }] }, extra));
  await as(w.dm, 'select public.save_campaign_combat($1, $2::jsonb, $3::jsonb, null)', [w.id, JSON.stringify({ schema: 1 }), pub(gob)]);
  const send = (uid, key, attacker, targets, action = { name: 'Greatsword', attackTotal: 17, damage: 9 }) => as(uid, 'select public.submit_combat_request($1, $2, $3, $4, $5::jsonb) as id', [w.id, key, attacker, targets, JSON.stringify(action)]);
  assert.match((await send(w.p, 'key-aaaaaaaa1', pc, [gob])).error, /Wait for your turn/);
  await as(w.dm, 'select public.save_campaign_combat($1, $2::jsonb, $3::jsonb, null)', [w.id, JSON.stringify({ schema: 1 }), pub(pc)]);
  assert.match((await send(w.p, 'key-aaaaaaaa2', other, [gob])).error, /your own character/);
  assert.match((await send(w.p, 'key-aaaaaaaa3', pc, ['nobody'])).error, /target/);
  assert.match((await send(w.outsider, 'key-aaaaaaaa4', pc, [gob])).error, /Only players/);
  assert.match((await send(w.dm, 'key-aaaaaaaa5', pc, [gob])).error, /Only players/, 'the DM applies attacks directly');
  const id1 = (await send(w.p, 'key-aaaaaaaa6', pc, [gob])).rows[0].id;
  assert.equal((await send(w.p, 'key-aaaaaaaa6', pc, [gob])).rows[0].id, id1, 'the same client key twice is one request');
  assert.equal((await db.query('select count(*)::int as n from public.campaign_combat_requests where campaign_id = $1', [w.id])).rows[0].n, 1);
  assert.match((await as(w.p, `update public.campaign_combat_requests set status = 'applied'`)).error, /permission denied/);
  assert.match((await as(w.p, 'select public.decide_combat_request($1, $2)', [id1, 'applied'])).error, /Only the Dungeon Master/);
  assert.equal((await as(w.outsider, 'select count(*)::int as n from public.campaign_combat_requests')).rows[0].n, 0);
  assert.equal((await as(w.dm, 'select public.decide_combat_request($1, $2) as s', [id1, 'applied'])).rows[0].s, 'applied');
  assert.equal((await as(w.dm, 'select public.decide_combat_request($1, $2) as s', [id1, 'rejected'])).rows[0].s, 'applied', 'already decided: a second tab changes nothing');
  const id2 = (await send(w.p, 'key-aaaaaaaa7', pc, [gob])).rows[0].id;
  assert.equal((await as(w.p, 'select public.decide_combat_request($1, $2) as s', [id2, 'cancelled'])).rows[0].s, 'cancelled', 'the player may cancel their own pending request');
  for (const k of ['key-bbbbbbbb1', 'key-bbbbbbbb2', 'key-bbbbbbbb3']) await send(w.p, k, pc, [gob]);
  assert.match((await send(w.p, 'key-bbbbbbbb4', pc, [gob])).error, /earlier requests/, 'at most three waiting at once');
  await as(w.dm, 'select public.save_campaign_combat($1, $2::jsonb, $3::jsonb, null)', [w.id, JSON.stringify({ schema: 1 }), pub(pc, { paused: true })]);
  assert.match((await send(w.p, 'key-cccccccc1', pc, [gob])).error, /paused|earlier requests/);
});

test('Sessions: only the DM starts one; one active per campaign (starting again resumes it); members read; results keep one entry per combat', async () => {
  const w = await workspace('sess');
  assert.match((await as(w.p, 'select public.start_session($1, null, null)', [w.id])).error, /Dungeon Master/);
  const s1 = (await as(w.dm, 'select public.start_session($1, null, $2) as id', [w.id, 'The ford'])).rows[0].id;
  const again = (await as(w.dm, 'select public.start_session($1, null, null) as id', [w.id])).rows[0].id;
  assert.equal(again, s1, 'a second Start resumes the active session');
  assert.equal((await as(w.dm, 'select count(*)::int as n from public.campaign_sessions where campaign_id = $1', [w.id])).rows[0].n, 1);
  const seen = (await as(w.p, 'select number, title, status from public.campaign_sessions where campaign_id = $1', [w.id])).rows;
  assert.deepEqual(seen.map((r) => [r.number, r.title, r.status]), [[1, 'The ford', 'active']], 'players read the session');
  assert.equal((await as(w.outsider, 'select count(*)::int as n from public.campaign_sessions')).rows[0].n, 0);
  assert.match((await as(w.p, 'select public.update_session($1, $2, null, null)', [s1, 'hijack'])).error, /Dungeon Master/);
  const res = (k, r) => JSON.stringify({ combatKey: k, title: 'Ambush', rounds: r, defeated: ['Goblin'], survivors: [] });
  await as(w.dm, 'select public.update_session($1, null, $2::jsonb, $3::jsonb)', [s1, JSON.stringify({ sectionId: 's3' }), res('cb1', 2)]);
  await as(w.dm, 'select public.update_session($1, null, null, $2::jsonb)', [s1, res('cb1', 4)]);
  const row = (await as(w.dm, 'select results, position from public.campaign_sessions where id = $1', [s1])).rows[0];
  assert.equal(row.results.length, 1, 'the same combat recorded twice stays one entry');
  assert.equal(row.results[0].rounds, 4);
  assert.equal(row.position.sectionId, 's3');
  const direct = await as(w.p, 'update public.campaign_sessions set title = $2 where id = $1', [s1, 'x']);
  assert.ok(direct.error || direct.affected === 0, 'players can’t change sessions directly');
  await as(w.dm, 'select public.end_session($1)', [s1]);
  const s2 = (await as(w.dm, 'select public.start_session($1, null, null) as id', [w.id])).rows[0].id;
  assert.notEqual(s2, s1);
  assert.equal((await as(w.dm, 'select number from public.campaign_sessions where id = $1', [s2])).rows[0].number, 2, 'numbered in order');
});

test('Session notes: the DM’s private notes are never readable by players', async () => {
  const w = await workspace('snote');
  const s = (await as(w.dm, 'select public.start_session($1, null, null) as id', [w.id])).rows[0].id;
  const up = await as(w.dm, `update public.campaign_session_notes set notes = 'Vance is the traitor', details = '{"hooks":"The bridge"}'::jsonb where session_id = $1`, [s]);
  assert.ok(!up.error && up.affected === 1, up.error);
  assert.equal((await as(w.p, 'select count(*)::int as n from public.campaign_session_notes')).rows[0].n, 0, 'players get nothing');
  assert.equal((await as(w.outsider, 'select count(*)::int as n from public.campaign_session_notes')).rows[0].n, 0);
  const upd = await as(w.p, `update public.campaign_session_notes set notes = 'x' where session_id = $1`, [s]);
  assert.ok(upd.error || upd.affected === 0, 'players can’t write them');
  assert.equal((await as(w.dm, 'select notes from public.campaign_session_notes where session_id = $1', [s])).rows[0].notes, 'Vance is the traitor');
});

test('Shared maps: DM saves/shows; players read visible tokens only; hidden tokens are DM-only; players move only their own token, only when allowed', async () => {
  const w = await workspace('maps');
  const img = `${w.id}/maps/ford.jpg`;
  const tokens = JSON.stringify([{ id: 't_pc', kind: 'pc', label: 'Bree', userId: w.p, x: 1, y: 1 }, { id: 't_gob', kind: 'monster', label: 'Goblin', x: 8, y: 1 }]);
  const hidden = JSON.stringify([{ id: 't_boss', kind: 'monster', label: 'Hidden boss', x: 9, y: 5 }]);
  const save = (uid, extra = {}) => as(uid, 'select public.save_map($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9) as r', [w.id, 'ford', 'The ford', img, JSON.stringify({ cols: 10, rows: 6 }), tokens, hidden, !!extra.move, extra.v ?? null]);
  assert.match((await save(w.p)).error, /Dungeon Master/);
  assert.ok((await as(w.dm, 'select public.save_map($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, false, null)', [w.id, 'bad', 'Bad', 'elsewhere/x.jpg', '{"cols":10,"rows":6}', '[]', '[]'])).error, 'the picture must be in this campaign’s maps folder');
  const r1 = (await save(w.dm)).rows[0].r;
  assert.ok((await save(w.dm, { v: 0 })).error, 'an out-of-date save is refused');
  await as(w.dm, 'select public.show_map($1, $2)', [w.id, r1.id]);
  assert.match((await as(w.p, 'select public.show_map($1, null)', [w.id])).error, /Dungeon Master/);
  const pv = (await as(w.p, 'select tokens from public.campaign_maps where id = $1', [r1.id])).rows[0].tokens;
  assert.deepEqual(pv.map((t) => t.id).sort(), ['t_gob', 't_pc'], 'players get the visible tokens');
  assert.equal((await as(w.p, 'select count(*)::int as n from public.campaign_map_dm')).rows[0].n, 0, 'hidden tokens never reach players');
  assert.equal((await as(w.dm, 'select count(*)::int as n from public.campaign_map_dm')).rows[0].n, 1);
  assert.equal((await as(w.p, 'select map_id from public.campaign_map_view where campaign_id = $1', [w.id])).rows[0].map_id, r1.id);
  assert.equal((await as(w.outsider, 'select count(*)::int as n from public.campaign_maps')).rows[0].n, 0);
  const move = (uid, tok, x, y) => as(uid, 'select public.move_map_token($1, $2, $3, $4) as v', [r1.id, tok, x, y]);
  assert.ok((await move(w.p, 't_pc', 3, 3)).error, 'not allowed yet');
  await save(w.dm, { move: true, v: (await as(w.dm, 'select version from public.campaign_maps where id = $1', [r1.id])).rows[0].version });
  const ok = await move(w.p, 't_pc', 3.3, 99);
  assert.ok(!ok.error, ok.error);
  const t = (await as(w.dm, 'select tokens from public.campaign_maps where id = $1', [r1.id])).rows[0].tokens.find((x) => x.id === 't_pc');
  assert.deepEqual([Number(t.x), Number(t.y)], [3.5, 5], 'snapped to half squares and kept on the grid');
  assert.ok((await move(w.p, 't_gob', 2, 2)).error, 'never someone else’s token');
  assert.ok((await move(w.p, 't_boss', 2, 2)).error, 'never a hidden token');
  const dmMove = await move(w.dm, 't_boss', 2, 2);
  assert.ok(!dmMove.error, dmMove.error);
});

test('Map images: members read the campaign’s maps folder, only the DM uploads; nobody else sees them', async () => {
  const w = await workspace('mapimg');
  const name = `${w.id}/maps/ford.jpg`;
  assert.match((await as(w.p, `insert into storage.objects (bucket_id, name) values ('campaign-memories', $1)`, [name])).error, /row-level security/);
  const up = await as(w.dm, `insert into storage.objects (bucket_id, name) values ('campaign-memories', $1)`, [name]);
  assert.ok(!up.error, up.error);
  assert.equal((await as(w.p, `select count(*)::int as n from storage.objects where name = $1`, [name])).rows[0].n, 1);
  assert.equal((await as(w.outsider, `select count(*)::int as n from storage.objects where name = $1`, [name])).rows[0].n, 0);
  assert.match((await as(w.dm, `insert into storage.objects (bucket_id, name) values ('campaign-memories', $1)`, [`${w.id}/maps/../x.jpg`])).error, /row-level security/);
});
