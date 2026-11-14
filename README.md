# 🐉 Fog of the Dragon

**Make the table better.**

Fog of the Dragon is a web-based companion for tabletop RPG campaigns, designed to make playing and running long-term campaigns easier without trying to replace the physical table.

The goal isn't to build another Virtual Tabletop.

It's to build the tools that help a group **before, during, and between sessions**.

---

## 🎲 What is Fog of the Dragon?

Running a tabletop campaign means managing a lot of things at once:

* remembering what happened last session
* organizing the next session
* helping new players understand their characters
* keeping combat moving
* knowing what your character can actually do
* preparing and controlling music
* keeping the campaign's important information organized

Fog of the Dragon brings these pieces together in one place.

The physical table remains the center of the game.

**The website supports it.**

---

## ✨ Planned Features

### 🏰 Campaign Management

Create a campaign and invite your players.

Each campaign has its own workspace containing:

* Campaign overview
* Session history
* Upcoming sessions
* Scheduling
* Player characters
* Important campaign information

---

### 📅 Sessions

Keep track of every session in the campaign.

See:

* What happened
* Where the party ended
* Important discoveries
* Current objectives
* Previous sessions
* The next session's time and location

The goal is to make it easy to answer:

> **"Wait, what happened last time?"**

---

### 🧙 Character Builder

A step-by-step character builder designed to work for both beginners and experienced players.

Players can choose between:

**Guided Mode**

Understand what each choice does, why it matters, and what interesting combinations it can create.

**Quick Mode**

Move through character creation quickly without unnecessary explanations.

The final character can also receive a personalized character guide explaining:

* What the character is good at
* What their important abilities do
* Useful combinations
* Possible chains of actions
* Spells and abilities in understandable language

---

### ⚔️ Faster Combat

Fog of the Dragon is **not a VTT**.

The goal is to make tabletop combat faster while keeping the physical game intact.

The combat system can help with:

* Initiative
* Turn order
* Fast monster turns
* Player actions
* Available abilities
* Optional recommendations

The system can also allow players to define a default action for their character, allowing simple turns to be resolved quickly.

---

### 🎵 Dynamic Session Music

The music system is designed around the actual flow of a campaign.

Before a session, the system can analyze the written adventure and divide it into musical cues.

For example:

```text
Tavern
   ↓
Mystery
   ↓
Exploration
   ↓
The Door Explodes
   ↓
Combat
   ↓
The Dragon Awakens
   ↓
Boss Fight
```

During the session, the DM can move between cues with simple controls.

For example:

**TAB** → Next cue
**SPACE** → Play / Pause

The DM remains in control at all times.

A Music Log shows when important transitions should happen.

---

## 🧭 Design Philosophy

Fog of the Dragon follows one central idea:

> **Don't replace the table. Make the table better.**

This means avoiding the temptation to turn the product into another VTT.

The goal is not to put miniatures, dice, maps and every aspect of the game on a screen.

Instead, the product should handle the things that computers are good at:

* organization
* memory
* explanations
* automation
* recommendations
* scheduling
* music
* information management

While the things that are better around a table remain around the table.

---

## 🛠️ Technology

The project is currently being developed as a web application.

Planned technologies include:

* HTML
* CSS
* JavaScript
* Supabase
* AI APIs
* PDF generation
* Browser audio APIs

The project is intentionally being kept lightweight and modular during early development.

---

## 🚧 Development Status

**Early development / MVP**

The current priority is building and testing the core user experience before expanding into a large platform.

Planned development order:

1. Frontend structure and design
2. Campaign management
3. Session management
4. Character Builder
5. Character Guide
6. Music system
7. Combat assistance
8. Authentication and database
9. Payments and subscriptions
10. Advanced AI features

---

## 💻 Running the Dashboard Locally

The dashboard loads its pages with `fetch`, so it must be served over HTTP (opening the file directly with `file://` won't work):

```
python -m http.server 8000
```

Then open `http://localhost:8000/Pages/dashboard.html`.

### Backend (Supabase)

Accounts, sign-in and user profiles use [Supabase](https://supabase.com). Campaigns are stored online in Supabase. Characters, settings and notifications are still stored in the browser (kept separately per signed-in user); a character is shared with a campaign as a snapshot when a player picks it.

**Setup**

1. Copy `.env.example` to `.env` and fill in `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (Supabase → Project Settings → API). Use only the **publishable / anon** key. Never put the secret / `service_role` key in this project.
2. Run `node tools/write-supabase-config.mjs`. It writes `JS/config/supabase-config.js`, which the pages load. Both `.env` and that file are git-ignored. On a host without Node, create that file in your deployment step (see `JS/config/supabase-config.example.js`).
3. Apply the migrations in `supabase/migrations/`, in filename order (the newest are `20261109120000_adventures.sql`, `20261110120000_campaign_requires_adventure.sql`, `20261110120100_homebrew.sql`, `20261111120000_google_sign_in_profiles.sql`, `20261111120100_content_images.sql` and `20261112120000_campaign_workspace.sql`, `20261113120000_campaign_refinements.sql`, `20261114120000_payments.sql`, `20261115120000_character_limit.sql`, `20261115120100_schedule_automation.sql`, `20261116120000_foggy.sql`, `20261117120000_marketplace.sql`, `20261117120100_scheduler_background.sql`, `20261118120000_store_photos.sql`, `20261118120100_foggy_on.sql`, `20261118120200_marketplace_ai_review.sql`, `20261118120300_meeting_in_the_fog.sql`, `20261119120000_foggy_assistant.sql` and `20261120120000_session_experience.sql`): either paste each file into Supabase → SQL Editor, or use the Supabase CLI (`supabase link`, then `supabase db push`).
   - **Running a file again is safe** from `20261112120000_campaign_workspace.sql` on: tables and indexes are created only if missing, policies and triggers are dropped and recreated, columns are added only once, and the Realtime publication skips tables it already has. This fixes the `relation "…" already exists` / `policy "…" already exists` error you got when a file was pasted into the SQL Editor a second time (or applied by `supabase db push` after being run by hand); the cause was plain `create table` / `create policy` / `create trigger` statements that fail when the object exists. Data is kept.
   - **Order still matters:** later files replace some functions of earlier ones (for example the scheduler). If you re-run an older file on its own, re-run every newer file after it, in filename order, so the newest function versions win.
4. In Supabase → Authentication → URL Configuration, set the **Site URL** to where the site is hosted, and add every address you open the site from to **Redirect URLs** (for example `http://127.0.0.1:5500/**` and `http://localhost:5500/**` for VS Code Live Server). Email confirmation and password-reset links only work for these addresses.
5. **Google sign-in (optional).** The “Continue with Google” buttons use Supabase Auth; nothing about Google is stored in this project. While Google is off, the buttons say so instead of opening an error page. To switch it on:
   - In Google Cloud Console → APIs & Services: configure the **OAuth consent screen** (app name, support email, your domain), then **Credentials → Create credentials → OAuth client ID → Web application**.
   - Under **Authorized redirect URIs** add `https://<your-project-ref>.supabase.co/auth/v1/callback` (shown in Supabase → Authentication → Providers → Google as “Callback URL”). Under **Authorized JavaScript origins** add the addresses you open the site from.
   - In Supabase → Authentication → Providers → **Google**: enable it and paste the **Client ID** and **Client Secret**. The secret is entered only there, never in this project.
   - Keep the Site URL / Redirect URLs from step 4: after Google, people return to `Pages/Auth/login.html`, which opens the dashboard. New Google accounts get their Google name as display name (migration `20261111120000_google_sign_in_profiles.sql`); they can pick a username in Edit Profile.

**Database security:** every table has Row Level Security. Users can only read and change their own profile; only a campaign's owner can change it or invite players; players can only accept their own invitation or leave. Policies are tested with `node --test tests/db/rls.test.mjs`, which runs the real migrations on an in-memory Postgres (needs `npm install --no-save @electric-sql/pglite` first).

### Campaigns and parties

- The DM creates a campaign and shares its invite code (FOD-1234-AB). Players join under Campaigns → Join Campaign while the campaign is gathering its party and has an open seat.
- Each player chooses one of their finished characters or builds a new one at the campaign's starting level; the DM can build a character for any player. Characters are checked with the rules engine on the campaign page.
- The DM can start the campaign only when every seat is filled (`people needed` includes the DM) and every player has a character. After that nobody can join, leave or change characters. These rules are enforced in the database (`join_campaign`, `set_member_character`, `start_campaign` in migration 005) and covered by `tests/db/rls.test.mjs`.
- **Every campaign runs an adventure.** Create Campaign requires choosing one of your adventures (or creating a new, empty one right there). The DM can switch to another adventure on the campaign page but cannot remove it. If the adventure is deleted, the campaign keeps running but cannot be started until the DM chooses another one. Enforced in the database (`campaigns_check_adventure` trigger and `start_campaign`, migration `20261110120000_campaign_requires_adventure.sql`); campaigns created before that migration need an adventure only to be started.
- A player can be in at most **3 active campaigns** at once (campaigns you run as the DM don't count; archived ones and ones you left free the slot). Enforced by `join_campaign` in migration `20261107120000_player_campaign_limit.sql`.
- Campaigns from the old browser-only version are not migrated.

### Campaign workspace (Dashboard → Campaigns → Open Campaign)

A campaign opens in its **own page**, `Pages/campaign.html?c=<campaign id>#<section>`, separate from the Dashboard (the Dashboard's own header and sidebar markup and styles with the campaign's sections, its own router; code in `JS/Campaign/`, styles in `Styles/Campaign/campaign.css`). **Open Campaign** goes to the campaign's **Overview**; the campaign card's menu has a **Campaign Settings** shortcut, and the workspace header has a permanent **Campaign Settings** button. Old `#campaigns/<id>` links and notifications redirect to the Overview.

- **Campaign and navigation state:** the campaign id is in the address (`?c=`), the section in the hash, so refresh, bookmarks and Back/Forward keep you in the same campaign and section. Every page receives one `ctx` object for that campaign; nothing reads another campaign's data. Before anything loads, the shell asks the database for the campaign; Row Level Security answers only for the DM and active members, so typing another campaign's id gives “Campaign not found”.
- **Sections:** Overview (about, next meeting with countdown, recent activity from real data, party, quick actions) · Feed (messages with Supabase Realtime, earlier messages, unread badge) · Meetings (upcoming/history, RSVPs, DM schedules/edits/cancels/deletes with confirmation and writes a summary when completing; completed meetings are kept) · Members (roster, invite code with “Replace code”, remove players before the start, start the campaign) · Characters (the shared character of each seat, details from the rules engine, choose/build until the start) · Combat · Music (DM) · Adventures · Bestiary · Logbook. Campaign Settings opens from the button in the campaign bar (it is not in the sidebar).
- **Roles:** Dungeon Master and Player (the only roles that exist). Players can't use Music, Settings management, meeting/combat/progress writes or the adventure itself; this is enforced by Row Level Security (`tests/db/rls.test.mjs`), the buttons are only a convenience.
- **Combat** (redesigned): status stage (encounter, round, who acts now and next) · DM controls toolbar (Previous / Next turn / Pause / End, plus waiting player attacks) · initiative rail · **combatants beside the selected combatant’s actions** · combat log. Each creature’s **real actions** come from its stat block (SRD 5.2.1 or homebrew: attack rolls, saving throws, damage dice, recharge; `JS/Campaign/combat-actions.js`) or a character’s sheet (weapon attacks and spells from the rules engine). An attack is a workflow, not a damage box: action → target(s) → roll or type the d20 (advantage/disadvantage) → hit or miss against the AC (natural 20 = critical, dice doubled; natural 1 = miss) → roll or type damage → Apply; saves take each target’s save total and apply half damage on a success when the stat block says so. **Play manually** (always available) logs any action with targets, an optional roll, damage, a condition and a note, and can end the turn. **Players** run the same workflow for their own character on their turn and **send** it: the DM sees it pre-checked against the AC and applies or rejects it (`campaign_combat_requests`; one request per client key, at most three waiting; applying twice does nothing). **Ask Foggy** suggests an action for the selected creature using only its real actions and real targets; “Prepare this action” pre-fills the workflow and nothing happens until someone applies it. HP changes outside attacks are a labelled **DM override** (Heal / Reduce HP / temp HP). **Basic** (actions, HP, conditions, last log lines) and **Advanced** (temp HP, hiding, order numbers, the full log) share one encounter. The full state stays DM-only; players read a public copy without monster HP/AC/notes; saves use the version check.
- **Music** controls the same player, playlists and sound effects as Dashboard → Music (no second library); see the refinements below for the playlist builder, cues and shortcuts.
- **Campaign Content** references the DM's adventure (nothing copied), records progress (`campaign_progress`) and lets the DM **share** a section's player-facing text with the players (`campaign_reveals`). DM notes never leave the adventure. Adventure images aren't shown in the workspace (open the Reader).
- **Subscriptions:** the account's plan is read from `account_plans` (written only by the payment webhook; free Warlord when there is no active row), so plan limits (active campaigns, people per campaign), the header and the Logbook gate all use the real plan. The Logbook and the campaign book are the only features gated server-side; other Basic/Advanced tiers aren't enforced.
- **Not available:** e-mail invitations (people join with the invite code; the database allows invited members but nothing creates them), changing roles, character HP written back to sheets, adventure images in the workspace, automatic Google Meet links, a live payment account (the code is ready), printing, AI recap drafting, AI generation in Foggy (only its infrastructure exists, see Foggy).
- **Tests:** `node --test "tests/*.test.mjs"` (includes the combat model); `node --test tests/db/rls.test.mjs` for the database policies (needs PGlite). Browser harness for the whole workspace without a server: `node tests/ui/make-campaign-fixtures.mjs`, serve the repository root and open `/tests/ui/campaign-harness.html?as=dm&c=11111111-1111-4111-8111-111111111111#overview` (`as` = dm, p1, p2 or out; `theme=light`; `reset=1`).

#### Campaign workspace: refinements (migration `20261113120000_campaign_refinements.sql`)

- **Sidebar:** the Campaign page uses the Dashboard's header and sidebar (same markup, CSS, dragon hover animation and notification bell, now shared in `JS/fod-shell.js`; the Dashboard itself is unchanged). Groups: **Campaign** (Overview, Campaign Feed, Meetings, Members) · **Play** (Characters, Combat, Music) · **Content** (Adventures, Bestiary, Logbook). Campaign Settings has its own button in the campaign bar. Every link keeps `?c=<campaign id>`. `tests` compare its computed styles with the real Dashboard shell.
- **Reading Mode:** Adventures opens in Reading Mode, which is **the Dashboard's own adventure reader** (Adventures → Read: the same code, parchment book, contents, DM view / Player view, text size, full screen, print), mounted in the campaign. For the DM it shows the campaign's adventure; for players it is the same reader built only from what the DM shared (Player view only; no DM notes exist in it). The DM switches to **Editing mode** for progress, sharing and the editor links. It is a presentation mode only; permissions are the database's.
- **Bestiary** (monsters and spells, in the Content group): filter by **Official SRD**, **Campaign homebrew** or **My homebrew** (or all), with a source badge on every entry. The DM can share their own homebrew monsters/NPCs/spells with the campaign (`campaign_homebrew`, a copy; sharing again replaces it) and stop sharing. An entry already shared is listed once. Players see campaign spells, never monsters or other people's homebrew.
- **Availability scheduler** (Meetings → Availability polls): the DM offers dates × time ranges (format in person / online / either, optional length and deadline). Members get an in-app notification (`campaign_notifications`, shown in the bell) and answer per slot: available, prefer, possibly, unavailable; they say whether they can host (the address is private to the host until they agree to share it **and** the DM proposes them), and may suggest another format or time. **Unanimous = everyone available or preferring the slot; “possibly” is not a yes and nobody is left out.** If nothing works, the closest options are listed and the DM starts another round. The DM then proposes ONE final option; **nothing is scheduled until every required person confirms that exact proposal** (version + slot are checked by the database; changing it clears the confirmations; anyone can say “I can’t make it”). Only then is the real meeting created, with RSVPs, and everyone is notified. States: draft, waiting, finding consensus, awaiting confirmation, confirmed, cancelled, expired. **Google Meet:** creating links needs a Google Calendar integration (OAuth, Calendar API `conferenceData`), which the project doesn't have, so no link is ever generated: the DM pastes an `https://` link and the meeting records that it was entered by hand.
- **What the scheduler does by itself** (migration `20261117120100_scheduler_background.sql`): members are notified and reminded a day before the deadline; when everyone has answered — **or the deadline passes with some answers** — the database ranks the times by how many can come (then “prefer”, “possibly”, earliest), checks each slot is long enough for the meeting, lists who can host there and suggests in person or online from what members asked for, and tells the DM once with the best option. If no time works for everyone it says so and shows the closest options. The DM picks a suggestion (one click); for a time not everyone can make, the DM can explicitly **propose it without** the named people, who are told and aren’t asked to confirm (proposing counts as the DM’s own yes). Everyone else confirms; the meeting is created once, after the last confirmation. The deadline closes answers only, so confirmations can come later. Pending confirmations get one reminder after a day; a proposal whose time passes, a request nobody answered and one with no decision for 14 days expire (the DM is told). Quick choices in the request form (evenings, afternoons, whole day, weekends or weekdays only) build the slots; the meeting length defaults to 3 hours.
- **Background processing:** this no longer depends on anyone opening Meetings. `private.process_all_schedule_requests()` handles every campaign; every step is idempotent (timestamps guard each notification, rows are locked, the meeting is created under the request’s lock). The migration **checks** whether the `pg_cron` extension is available and, if so, schedules it every 10 minutes (job `fod-schedule-processing`; the SQL Editor shows a notice saying which happened). Without pg_cron, deploy the Edge Function `scheduler-tick` (`supabase functions deploy scheduler-tick --no-verify-jwt`, `supabase secrets set SCHEDULER_TICK_SECRET=<long random string>`) and call it every 10 minutes from any scheduler with `Authorization: Bearer <secret>`; it calls `run_schedule_processing()`, which only the service role may run. Browsers still call the per-campaign version when Meetings opens (harmless).
- **Automatic scheduling** (migration `20261115120100_schedule_automation.sql`, on by default for new requests, the DM can switch it off or change it per request): when the last person answers, the database **proposes the best time by itself** (unanimous slots only; most “prefer”, then the earliest) — in person only when exactly one person offered to host and agreed to share the location, online only when the DM gave a meeting link in advance; otherwise it waits for the DM. If someone can’t make the proposed time, that slot is skipped and the next best one is proposed; a new round forgets the declined slots. **Everyone still confirms**, and the meeting is only created after the last confirmation, as before. People who haven’t answered get **one reminder** when the deadline is less than a day away; overdue requests expire (`process_schedule_requests`, run whenever a member opens Meetings). Each card shows the steps (asked → answers → proposed → confirmed → meeting) and what happens next.
- **Dice roller** (Combat → Dice, for everyone; rolls are private to the roller): d4–d100 buttons and notation like `2d6+3`; numbers come from the browser's crypto generator with rejection sampling (fair). When **Dashboard → Settings → 3D Animated Dice** is on, each roll (and each initiative roll) plays a short CSS 3D tumble that lands on the real result; off, or with “reduce motion”, the result simply appears. It is a stylised tumble, not a physics simulation, and it never blocks clicks.
- **Combat:** see above (actions from stat blocks, attack workflow, Play manually, player requests, Ask Foggy, Basic/Advanced).
- **Music:** shortcuts at the top, music log at the bottom. **Playlist builder** (create, rename, duplicate, delete with confirmation, add from the library, preview, reorder, remove): the same `FogMusicStore` as the Music Studio, saved as you go in this browser. **Scenes & cues:** an ordered list tying a scene (Tavern, Boss Fight…) to a playlist or a single track, saved per campaign in this browser. **Tab / Shift+Tab play the next / previous cue only while “Cue mode” is switched on** (Esc leaves it), so Tab keeps moving keyboard focus otherwise; Space/N/P/S ignore text fields, buttons and dialogs.
- **Logbook** (formerly Memories & Recaps; `#memories` links still work): an archive of memories (recap, event, character moment, NPC, quote, location, discovery, decision, battle, milestone, map, image, DM note) with date, meeting, subject, image and visibility (**players** or **DM only**); meeting recaps with sections (what happened, decisions, changes, character moments, discoveries, unresolved threads) written by the DM, optionally starting from the meeting's own summary, saved as a draft and published only by the DM. There is **no AI drafting**; nothing is generated or published automatically. Players read only published, player-visible memories (Row Level Security); images live in the private bucket `campaign-memories` (`<campaign>/players/…` for members, `<campaign>/dm/…` for the DM only).
- **Plans and the book:** per the pricing page's tiers (Warlord / Dungeon Master / Fogger of the Dragons; there is no “DM Pro”), **the Logbook is available when the campaign DM's plan is Dungeon Master or Fogger of the Dragons**. The **digital campaign book** is included free when the DM's plan is **Fogger of the Dragons**; otherwise a **paid, campaign-wide purchase** by any one member unlocks it for everyone (`campaign_entitlements`: campaign, product, purchaser, status, provider reference). Plans live in `account_plans`, purchases in `campaign_entitlements` and physical orders in `campaign_book_orders`; **clients cannot write any of the three**, only the payment webhook (service role; see Payments below) can, so a button click can never create an entitlement. The book is read through `campaign_book()`, which refuses non-members and locked campaigns and returns only published, player-visible memories, completed meetings and public history; `FogBookRender` lays it out as a chronicle (title page, party, timeline, one chapter per session, remembered people/places/quotes); Print saves it as a PDF. A purchaser gains no edit rights. **Built but not yet connected to a live account:** the Lemon Squeezy checkout and webhook (see Payments). **Not built:** the printed book (provider, shipping, production cost). Until `FOG_PAYMENTS` is on and the webhook is configured every account is on the free plan, so the Logbook shows as locked; to try it without paying, as the project owner run `insert into public.account_plans (user_id, plan_id) values ('<user id>', 'dungeon-master');` in the SQL Editor.
- **Locking after the start:** the DM starts the campaign explicitly (`start_campaign`; it needs an adventure, every seat filled and every character set). From then on the database refuses client changes to the **adventure, starting level, people needed, content source and the party's characters** (a trigger on `campaigns`, the existing party rules, and no direct write access to characters). Allowed: meetings, recaps, combat, name/description/cover/visibility, and **level-ups**: `level_up_member_character()` accepts only the player's own character, the same character (id, class, species, background) and exactly **one level higher**, then records it in `campaign_history`; the rules engine in the browser checks the legality of the new level's choices, the database cannot. The DM's **correction path** is `override_campaign_lock()` (switch adventure, change starting level, replace a character, remove a player): DM only, started campaigns only, a written reason of 10+ characters and an explicit acknowledgement, and every use is saved in `campaign_history` (visible to all members, under Memories & Recaps → History) without copying character data.
- **Tests:** `node --test "tests/*.test.mjs"` (combat, scheduler analysis, book rendering, dice, payments logic) and `node --test tests/db/rls.test.mjs` (67 database tests, including every rule above, the character limit, automatic scheduling, Foggy access and re-running the migrations). `tests/ui/campaign-harness.html` runs the real workspace code against in-memory stand-ins (`mock-campaign-workspace.js` and `mock-campaign-refinements.js`, which follow the same rules; `?dmplan=warlord|dungeon-master|fogger-of-the-dragons`, `__mock.markBookPaid()` to simulate a payment webhook).

#### Meeting in the Fog (Campaign Feed → Meeting in the Fog)

Voice and video for a campaign’s members (migration `20261118120300_meeting_in_the_fog.sql`, Edge Function `meeting-fog`, `JS/Campaign/meeting/`).

- **Architecture:** WebRTC through **LiveKit (an SFU)**. Supabase keeps only the room metadata, lifecycle, permissions and events (`meeting_rooms`, `meeting_room_participants`); **audio and video never pass through Supabase**. The browser talks to a provider interface (`fog-media.js`), with a LiveKit adapter loading the official SDK on demand (pinned, Subresource Integrity).
- **Rooms:** the DM opens a room from the Feed (at most one open room per campaign; a double click returns the same room). A meeting held “in the Fog” (Meetings → Where, or a confirmed availability poll) gets one waiting room that the DM opens at meeting time; cancelling the meeting closes it; editing or re-confirming never duplicates it. The DM closes the room for everyone.
- **Who may join:** only the DM and active members of an active campaign, checked by `public.meeting_join_grant()` (Row Level Security; another campaign’s room id answers “not found”). Then `meeting-fog` mints a **15-minute token** for that room only (camera and microphone; data messages only for the DM; never recording, admin or screen share). One participant row per person and room; a heartbeat drops closed browsers from “connected” within minutes.
- **The call** lives in the campaign shell, so it **keeps going while you move between sections**; it minimises to a small dock. Tiles show names, microphone/camera/speaking/connection state and a placeholder without a camera; mute, camera, device choice, participant list, Leave; DM: Close room, Share my music. The microphone is asked for only when joining, the camera only when turned on; blocked or missing devices are explained and you stay in the call. Reconnecting and disconnects are shown, with Reconnect (a fresh token).
- **Scheduler:** the formats are In person · **Meeting in the Fog** · Either. No link is created, needed or generated (no Google Meet); a Fog meeting says “join from the Campaign Feed”. A link a DM typed before still works.
- **Shared music:** the DM’s existing music player is the only player. When the DM joins a call, what it plays is shared by default (“Share my music”; turning it off is remembered on that device). Only small commands (catalog track, play/pause/stop, position) are stored on the room, ordered and de-duplicated, with the server clock; each participant plays the same licensed catalog recording locally with the same player. Late joiners and reconnects pick up the current track and position; players re-check the position every 20 seconds to correct drift. When the browser blocks autoplay, a “▶ Start the music” button appears (one click allows it); a missing track is reported, never faked. Every participant has their own music volume slider; music keeps playing while moving between sections. Uploaded files are never shared and nothing is streamed from the DM’s desktop. The soundboard’s event format is ready (`FogMeetingEvents`, LiveKit data channel), with no interface yet.
- **Setup (owner):** create a LiveKit project (LiveKit Cloud or your own server), then add three **Supabase secrets** — Supabase Dashboard → Edge Functions → Secrets (or `supabase secrets set ...`): `LIVEKIT_URL` (`wss://<project>.livekit.cloud`), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`; deploy with `supabase functions deploy meeting-fog`. Never put them in `.env`, Git or the frontend. Until then the Feed says video meetings aren’t set up, Start/Join are disabled and nothing pretends to be connected. Nothing is ever recorded.

#### Session experience (migration `20261120120000_session_experience.sql`)

- **Contextual Back, everywhere (`JS/fog-nav.js`, shared by the Dashboard router and the Campaign workspace):** links to referenced content (a monster in an encounter, a character’s spell, a music track…) stay in the same tab and carry where they came from in the address (`#bestiary/monster/<key>?from=content/<section>&label=…`), so the page shows “← Back to <where you were>”, and browser Back/Forward, reloads and bookmarks keep it. Back uses the tab’s own history when it can (no A→B→A loops) and restores the scroll position; pages opened without an origin fall back to their parent section (a monster → Monsters & Spells, a character → Characters, a track → Music), and top-level sections have no Back bar. On Dashboard pages that already have their own Back button, that button follows the origin instead of adding a second one. Filters, searches, the open encounter and the open playlist are kept for the browser tab. A small ↗ next to referenced monsters opens them in a new tab for the DM who wants reference material open beside the session (campaign access is checked again there); nothing else forces new tabs.
- **Sessions (Overview → Next session, DM):** “Start session N” records a session (number, date, meeting, adventure position) — nothing is created by just opening the page, and there is at most one active session per campaign (starting again resumes it). “Continue the session” opens the adventure where it stands; Meeting in the Fog is one click away; “End session” closes it. Choosing the current section in Adventures, or starting an encounter, updates the session’s position.
- **Encounters (Adventures → Encounters, in the Dashboard editor and in the campaign):** name, introduction, description, monsters with quantities (references to Monsters & Spells, never copies), NPCs, difficulty, map (an adventure map asset), music (a licensed track), rewards, story triggers, DM-only notes and monster-turn mode; reorder, duplicate, remove. **Start encounter** (DM) prepares Combat with the party and the monsters, remembers where it came from, shares the encounter’s map (if it has a picture) and offers its music, and opens Combat with “← Back to the adventure”. A monster that isn’t in Monsters & Spells is reported, not invented. Players never receive DM notes.
- **Combat automation:** attacks are checked against AC (natural 1 misses, natural 20 is a critical hit with doubled dice), with advantage/disadvantage suggested from SRD 5.2.1 conditions; saving throws use the DC (half damage where the ability says so); monster damage immunities, resistances and vulnerabilities are applied from the stat block (character resistances aren’t on the shared sheet, so the DM adjusts those); conditions an ability imposes (“has the Grappled condition”) are offered with a checkbox, skipping condition immunities. **⚡ Roll & resolve** rolls whatever is missing in one click; every number stays editable and nothing is applied before **Apply**. **Monster turns: Manual · Foggy Assist · Full Auto** per encounter. Full Auto plays a monster’s or NPC’s turn from its real actions (Foggy’s choice when Foggy+ is available, checked against the stat block; otherwise its strongest action against the most wounded character), with Multiattack and Recharge, rolls, resolves, applies, logs and moves to the next turn; each turn is claimed once (no duplicate attacks after a reload or a second tab), the DM can **Stop** at any moment, an incapacitated creature or one with no resolvable action is explained and handed back, and player characters are never played. Positions and movement are not simulated (the log says so).
- **Results:** ending a fight adds its result (rounds, who was defeated, who is still standing — only what players saw) to the active session; the end of the combat log and any hidden creatures go to the DM’s private session notes.
- **Shared map (sidebar → Map):** the DM shares an adventure map or an image file with a grid (the picture is copied into the campaign’s own `maps` folder because adventure pictures are private), chooses which map everyone sees, adds the combatants as tokens (or markers), hides and reveals tokens, lines them up again, and decides whether players may move their own token. Everyone sees the shown map live; tokens snap to the grid; zoom is personal. Hidden tokens are stored apart (`campaign_map_dm`) and never reach players; `public.move_map_token` lets a player move only their own visible token, only when allowed.
- **Logbook → Sessions:** every session in order with search, filters (in progress / finished, with or without a published recap) and chronology; the encounters it recorded; the published player recap (a Logbook memory linked to the session). The DM also edits private notes — notes, key events, locations, NPCs, encounters, decisions, rewards, developments, mysteries, hooks and a DM summary — which players never receive (`campaign_session_notes`, DM-only by Row Level Security). **Draft with Foggy+** writes a player recap, a DM summary, threads and hooks from those notes only; the DM reviews and edits them, then the recap is saved as a **draft** to publish when ready.
- **Foggy+ session preparation (Overview → Prepare with Foggy+, or Foggy → Prepare the next session):** the app lists what really exists for the next session — the next sections, their encounters, monsters (checked in Monsters & Spells), maps, music, the party’s characters and handouts — and what is missing (an encounter without a map picture, a monster that isn’t in the bestiary, a player without a character…). “Ask Foggy+” adds a summary and suggestions; the server only accepts resources from that list (anything else is dropped, and the page says so) and checks the sections against the adventure. The DM ticks what to open and presses **Open N tabs** — one click, each page once (browsers only allow several tabs from a click; blocked ones are listed to open by hand). Nothing is started and nothing is changed.

#### Payments (Lemon Squeezy)

**What exists:** server-side plan and purchase handling, the Buy buttons and the checkout, written for Lemon Squeezy and **not yet connected to a live account** (that needs your Lemon Squeezy details, below). Nothing is bought or unlocked by the page: it asks the Edge Function `payments-checkout` for a checkout address and sends you to Lemon Squeezy; the plan or the book unlocks only when Lemon Squeezy's **signed webhook** reaches `payments-webhook`, which is the only writer of `account_plans` and `campaign_entitlements` (through functions only the service role can call, migration `20261114120000_payments.sql`).

- **Plans:** Dungeon Master and Fogger of the Dragons, monthly and yearly, from the Upgrade page. `account_plans` holds the user's plan; `fog-account.js` reads it (so the header, limits and the Logbook gate use the real plan). A cancelled or past-due subscription keeps its plan until the end of the paid period. “Manage Subscription” opens Lemon Squeezy's customer portal.
- **Campaign book:** Logbook → Campaign book → “Buy the digital book for the campaign”. One member's paid order unlocks it for every member (`apply_provider_book`; a refund locks it again; two simultaneous purchases are recorded and flagged for a refund; the unlock is written to the campaign history and every member is notified). The DM's plan must include the Logbook, and a book already unlocked can't be bought again. Printed books are not available (no printing provider).
- **Safety:** the webhook checks the `X-Signature` (HMAC-SHA256 of the raw body); events are idempotent and ordered (an older event never overwrites a newer one); test-mode events are ignored unless `LS_TEST_MODE=true`; the browser only ever follows an `https://…lemonsqueezy.com/` address; the return address comes from `SITE_URL`, never from the request; secrets are refused by `tools/write-supabase-config.mjs` if they appear in `.env`.

**What I need from you to switch it on** (Lemon Squeezy → your store):
1. Create the products and note each **variant id**: Dungeon Master (monthly and yearly subscription variants), Fogger of the Dragons (monthly and yearly) and “Campaign Book (digital)” (a one-time variant; you choose its price).
2. Your **store id** and an **API key** (Settings → API).
3. A webhook to `https://<project-ref>.supabase.co/functions/v1/payments-webhook` with a **signing secret** you choose, subscribed to: `order_created`, `order_refunded`, `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`, `subscription_unpaused`.
4. Then, on your machine (secrets are Supabase secrets, never `.env`):
```
supabase functions deploy payments-checkout
supabase functions deploy payments-webhook --no-verify-jwt
supabase secrets set LS_API_KEY=... LS_STORE_ID=... LS_WEBHOOK_SECRET=... SITE_URL=https://your-site LS_TEST_MODE=true
supabase secrets set LS_VARIANTS='{"plan_dm_monthly":"111","plan_dm_yearly":"112","plan_fogger_monthly":"113","plan_fogger_yearly":"114","campaign_book_digital":"115"}'
```
   and set `FOG_PAYMENTS=true` in `.env`, then `node tools/write-supabase-config.mjs`. Test everything with Lemon Squeezy **test mode** first (`LS_TEST_MODE=true`, test card 4242 4242 4242 4242), then remove `LS_TEST_MODE` and use live-mode products and webhook. Passes (One-Shot, Full/Max Campaign) have no product mapping yet; the Upgrade page says so.

**Lemon Squeezy or Paddle (what the research found; check current terms before committing):**

| | Lemon Squeezy | Paddle (Billing) |
|---|---|---|
| Model | Merchant of record: sells on your behalf and handles sales tax/VAT | Merchant of record, same idea |
| Checkout | API `POST /v1/checkouts` returns a hosted URL (`data.attributes.url`); our ids go in `checkout_data.custom` and come back in the webhook's `meta.custom_data` | `POST /transactions` with `custom_data` (checkout URL or Paddle.js overlay) |
| Webhook signature | `X-Signature`: hex HMAC-SHA256 of the raw body with your signing secret | `Paddle-Signature: ts=…;h1=…`: HMAC-SHA256 of `ts:rawBody` |
| One-time + subscriptions | both (orders, subscriptions) | both (transactions, subscriptions) |
| Fees (as reported by third-party comparisons, which disagree) | about 5% + 50¢ per sale | about 5% + 50¢ per sale |
| Caveat | **Acquired by Stripe in 2024**; in January 2026 its CEO said the team is building **Stripe Managed Payments**, with slower support and fewer updates meanwhile. Still operating and onboarding, no shutdown announced, but its long-term direction is Stripe's | Needs account/website approval before live payments; more suited to established SaaS; heavier onboarding |

Decision: **Lemon Squeezy** (your preference) is implemented; its small, simple API and webhook made it the faster path for a hobby-scale project. Because everything provider-specific lives in `supabase/functions/_shared/lemonsqueezy.ts` and the two functions, and the database side (`apply_provider_plan` / `apply_provider_book`) is provider-neutral, moving to Paddle (or Stripe) later means writing a new checkout call and a new event interpreter, not touching the pages or the rules. Sources: Lemon Squeezy docs (Create a Checkout, Signing Requests, Passing Custom Data), Paddle developer docs (signature verification), and third-party articles on the Stripe acquisition.

#### Marketplace (header icon next to the notification bell) — store, community content, cart and checkout

Migration `20261117120000_marketplace.sql`. The Marketplace is not a sidebar tab: the store icon in the header (Dashboard and Campaign page) opens `#marketplace`; the cart icon next to it shows the item count.

- **Official Store (demo):** dice, dice bags and towers, trays, DM screen, notebooks, clothing, mugs, posters, stickers and more, with original FOD jokes (Nat 1 club, mimics, dragons, Dungeon Master jokes). Each product shows a **real photo of the product type** (freely licensed from Wikimedia Commons, credited on the product page and in `Assets/Pictures/store/ATTRIBUTION.md`; migration `20261118120000_store_photos.sql`) with the **FOD print design** drawn by the app (`store-art.js`) as an inset; no official D&D art or logos; prices are demonstration prices stored server-side (`marketplace_store_products`). **No print-on-demand provider is connected and nothing is shipped**: such orders are recorded with fulfilment `not_fulfilled_demo`.
- **Community Marketplace:** players and DMs publish adventures (complete, chapters, one-shots, modules, encounters, hooks) and game assets (monsters, NPCs, characters, maps, locations, magic items, spells, equipment, puzzles, traps, handouts, illustrations, tokens). A listing has a title, summary, description, type, price or free, edition, levels, genre/theme, tags, **source** (original or SRD 5.2.1-based, which requires the CC-BY attribution) and the **license** given to buyers, a cover and up to 6 previews, and what buyers get: a **copy of one of your adventures or homebrew entries** (pictures not included) and/or up to 10 files (PDF, images, JSON, text, Markdown; 25 MB each; programs and archives are refused by the browser, the bucket’s allowed types and the storage policy). Filters: type, free/paid, price range, party level, edition, genre/theme, creator, search, sort by newest/downloads/price. Buyers can download files and add bought adventures or homebrew to their own libraries (`#marketplace/library`).
- **Reviewer (Gemini first, a person decides):** migration `20261118120200_marketplace_ai_review.sql` and Edge Function `marketplace-review`. When a listing is submitted, Gemini reviews its text, its included adventure/homebrew, its text files, images and PDFs (copyright and official product identity, SRD attribution, safety, honesty) and stores a verdict (suggest publish / ask for changes / unsure, a risk level, reasons and a suggested note) that **only moderators** see next to the listing, with “Ask Gemini again” and “Use this note”. Moderators are notified of every listing entering the queue. `marketplace_settings.review_mode`: `ai_assist` (default — a moderator always decides), `ai_auto` (a **low-risk approval of a fully checked listing with no open reports is published automatically**; everything else waits for a moderator), or `manual` (Gemini is never asked). Change it in the SQL Editor: `update public.marketplace_settings set review_mode = 'ai_auto';`. The same `GEMINI_API_KEY` secret as Foggy; deploy with `supabase functions deploy marketplace-review`. Without the key, listings simply wait for a moderator.
- **Moderation:** Draft → Pending review → Published / Rejected (with the moderator’s reason) / Removed. Changing a published listing sends it back to review. Three open reports send a listing back to review. Moderators are listed in `marketplace_moderators` — add yourself in the SQL Editor: `insert into public.marketplace_moderators (user_id) values ('<your user id>');` — and get a Moderation tab. Ownership, states, prices and access are enforced by Row Level Security and functions (`tests/db/rls.test.mjs`); a creator can only change their own listings; buyers keep what they bought if a listing is removed. FOD doesn’t endorse community listings, and every listing says so.
- **Fees:** FOD keeps **10%** of each paid community sale (`marketplace_settings.fee_bps`, allowed 5–10%), recorded on every order item. **Creator payouts are not built.** The creator dashboard shows listings by state, downloads, sales and the creator’s share, labelling sales made with demo payments.
- **Cart and checkout:** add/remove, quantities (merchandise), totals, Continue shopping, Buy now (straight to checkout without the cart), saved per user on this device. The server prices every order again (`create_order`); card fields never leave the page. **Payment is simulated (“DEMO — NO REAL PAYMENT”)** while `app_flags.demo_payments` is on (owner: `update public.app_flags set enabled = true where key = 'demo_payments';`): only the test cards 4242 4242 4242 4242 (succeeds) and 4000 0000 0000 0002 (declined) are accepted, and only the outcome reaches the server (`pay_order_demo`). Success shows a confirmation with an order reference and fills the library; a decline keeps the cart and allows a retry. **This is the real purchase system with the payment step simulated**: orders, the library, plans and campaign books are the same records a payment provider will produce later (it replaces only `pay_order_demo`, calling the same `private.fulfil_order`). The Logbook’s campaign book and (for test owners) plans also go through this checkout. Turn `demo_payments` off before real payments go live.
- **Testing the tiers:** configured **test owners** (`insert into public.dev_test_owners (user_id) values ('<your user id>');`, plus `demo_payments` on) get a “Test tiers” section on Billing to switch between Warlord, Dungeon Master and Fogger of the Dragons, with a table of what each includes. It writes the real `account_plans` row, labelled provider `demo`, so every server-enforced limit (characters, Logbook, Foggy, campaign limits) behaves as for a subscriber; it never overwrites a real paid plan, and ordinary users can neither see it nor call it (`demo_set_plan` checks on the server).

#### Billing (user menu → Billing) and the demo Lemon Squeezy dashboard

- **Your account (real):** the plan as the database records it, whether payments are switched on, and Lemon Squeezy’s customer portal when it has sent one. Nothing invented.
- **Demo mode (`FOG_DEMO_BILLING=true` in `.env`, then `node tools/write-supabase-config.mjs`):** sample data from a **mock Lemon Squeezy store** (`JS/Dashboard/billing/mock-lemonsqueezy.js`): active, past-due, cancelled and expired subscriptions, one-time purchases, campaign upgrades, payment history with successful and failed payments and refunds, customers and campaigns. Every block is labelled **Demo**, customers are fictional `example.com` people, and “try it” buttons (buy, fail, refund, cancel) change only that page’s sample data. The mock never touches the network, Supabase or `FogPayments`, so **it can’t charge anyone or unlock anything** (tests check this). The records use Lemon Squeezy’s own JSON:API shapes, so a real adapter (server side, using the API key as a Supabase secret) can feed the same screens later.
- **Revenue (`#billing/revenue`):** summary (net revenue, last 30 days, monthly recurring, active subscriptions, failed payments, one-time purchases), subscriptions by plan, transactions with filters, customers and campaign purchases — demo data only, visible only when `FOG_DEMO_BILLING_OWNER` is your user id. There is no admin role in the database yet, so real revenue will need a server-side owner check.

### Music & Sound (sidebar → Music)

- **Library:** 109 recordings in `Assets/Audio/` (about 48 MB): 19 background music tracks, 9 ambiences and 81 short sound effects (combat, magic, creatures, undead, doors and gates, locks, chains, breaking objects, bells, fire, water, thunder, dice and more). All come from the approved sources and are **CC0 1.0**: OpenGameArt assets uploaded by their authors, and Kenney's packs from Kenney's own OpenGameArt uploads. Pixabay refuses automated access, so nothing from Pixabay could be checked or included.
- **Licensing records:** `Assets/Audio/catalog.json` lists name, type, category, author, source page, license, attribution note, file and duration for every file. `Assets/Audio/ATTRIBUTION.md` is generated from it (`node tools/build-audio-attribution.mjs`); a test fails when the document is out of date or a file is not listed. The Music page shows the same list under **Credits & Licenses**.
- **Moods, scenes and intensity:** every music track and ambience has moods (calm, cheerful, festive, mysterious, eerie, tense, dark, sad, heroic, epic), an intensity (low / medium / high) and scene types (battle, boss fight, before a battle, town, tavern, market, travel, forest, desert, snow, river/sea/swamp, cave, dungeon, temple, investigation, horror, undead, villain’s lair, rest, loss & farewell, storm, crowd). Music categories now include **Atmosphere & Mystery**, **Story Moments** and **Creatures & Factions**. The 11 tracks added in this round (battle, before-battle, new town, desert caravan, snowfall, dark forest, shrine, zombie march, lament, eye of the storm, lullaby) are CC0 on OpenGameArt, uploaded by their authors, each license checked on its own page; credits are in `ATTRIBUTION.md`.
- **Library page:** search by name, tag, author, mood or scene; filter by type (music, ambience, sound effect), category, **mood, scene and intensity**; favorites. The Campaign playlist builder has the same mood and scene filters. **Sound Board:** effect pads; several effects can play at once over the music, and **Stop all effects** stops them.
- **Playlists & Scenes:** a playlist is a scene. Music plays to its end, ambience loops for a chosen number of minutes, effects play once. Missing or unplayable files are reported and skipped.
- **My Uploads:** MP3, OGG, WAV, M4A, WEBM or FLAC, up to 50 MB each and 500 MB in total, stored only in this browser (IndexedDB, per signed-in user). Upload only music you have the right to use.
- **One player:** the Music page, the corner mini player and the Campaign workspace's **Music** section all control the same player (`music-player.js`).
- The browser-generated tracks of earlier versions were removed; saved playlists, favorites and history that pointed to them are cleaned automatically. (The optional Settings background music in `JS/fog-audio.js` is a separate settings feature and still generated in the browser.)

### Adventures (sidebar → Adventures)

- **What it is:** the DM's written adventure content — kept separate from Campaigns (actual games with players). An adventure is **Adventure → Chapters → Sections**. Sections are typed (scene, location, NPC, encounter, important object, story hook, secret/clue, reward/treasure, DM note); each has player-facing text (“For the players”), private DM notes, and a few fields of its own (for example an NPC's motivation or an encounter's creatures).
- **Library** (`#adventures`): cover or placeholder, genre, theme, level range, playtime, chapter/section counts, last edited, Draft/Ready/Archived; search, status and genre filters, sorting; create, edit, duplicate, archive/restore, delete (with confirmation).
- **Editor** (`#adventures/<id>`): outline on the left, writing panel on the right; add, rename, reorder and delete chapters and sections. Changes autosave about a second after typing stops (or Ctrl/Cmd+S / Save now). The status says “All changes saved” only after the database confirmed the write; failed saves say “Not saved” with Retry. Every unsaved change is also kept as a local backup, offered for restore the next time the adventure opens.
- **Images:** every chapter and section can hold up to 12 images (maps, portraits, scenes, handouts): drop them on the image area, paste them, or choose files. They are resized in the browser (JPEG, longest side 1600 px) and stored in the **private** Storage bucket `content-images` (migration `20261111120100_content_images.sql`) under `<your user id>/adventures/<adventure id>/`; only you can read them (signed links that expire after an hour). Each image has a caption and a **Player handout** switch. Removed images are deleted after the save that removes them is confirmed; duplicating an adventure copies its images, deleting it deletes them.
- **Reader** (`#adventures/<id>/read`, **Read** in the editor or on a card): the adventure as an illuminated book on parchment, with red headings, ornaments, roman-numbered chapters, drop caps, two columns on wide screens, read-aloud boxes, DM notes under a wax seal and illustrations as tipped-in plates. Title page with contents; one chapter per page with a page-turn animation; arrow keys, contents or “Go to” menu; text size A−/A+; full screen; **Print** (or save as PDF) lays out every page. **Player view** shows only “For the players” text and images marked as handouts (for a second screen at the table); **DM view** shows everything. The parchment looks the same in both themes; the toolbar follows the theme. Drawn entirely with CSS (no image files); fonts from Google Fonts (Cinzel, Cinzel Decorative, EB Garamond).
- **Storage:** Supabase table `public.adventures` (migration `20261109120000_adventures.sql`): one row per adventure, private to its author by Row Level Security; chapters and sections are validated structured JSON (not HTML), at most 100 chapters × 200 sections. The database bumps a `version` on every save and the editor saves “where version = the version I loaded”, so another tab or device can't silently overwrite newer work (you get a conflict message and can reload).
- **Assets in the Reader:** every asset appears where it is placed — maps and locations as wide plates (maps open larger on click), portraits, NPCs, monsters, magic items and spells with their picture beside the text, handouts as a separate sheet; DM notes, fields and rules references only in DM view. **Player view shows only assets marked “Players may see it”**, never DM notes, secret fields or unrevealed maps. Assets not placed anywhere go to an Appendix page. A missing picture shows “Image unavailable”. **Print** (and save as PDF) includes the assets in place, leaves out those not marked “In the book” and limits picture sizes; tested by producing a PDF in Chrome. The Campaign page’s player reading view (built only from what the DM shared) doesn’t include assets.
- **Assets** (outline → Assets & book): NPCs, portraits, maps, locations, monsters & encounters, magic items, spells and handouts kept with the adventure (`content.assets`), each with its own fields, a description players may see, DM-only notes, up to 4 images, a place in a chapter or section (“Assets used here” on each chapter and section), an optional reference to a stat block or spell in Monsters & Spells, and two switches: **In the book** and **Players may see it**. Assets saved from Foggy are marked “from Foggy”. **Printable book:** page size and appendix/handout choices are stored for a future printable book; **exporting or printing an adventure book is not available yet** (the Reader’s Print is unchanged).
- **Campaigns:** every campaign runs one of its DM's adventures, chosen on Create Campaign and switchable on the campaign page (Adventure card). Only a reference is stored (`campaigns.adventure_id`); nothing is copied, and players cannot read the adventure. Creating an adventure never creates a campaign.

### Foggy (sidebar → Foggy; Campaign workspace → Foggy for the DM)

Foggy is the AI assistant, with **Gemini on the server only** (Edge Functions; the browser never holds a key). Tabs:

- **Chat** — ordinary conversation that continues (saved conversations, `foggy_threads` / `foggy_messages`). Foggy tells apart a question (rules: it says whether something is SRD 5.2.1 or a homebrew suggestion), a request to make something (kept in your drafts; add it to an adventure as an asset) and a request to **change** existing content: with an adventure chosen for context, it proposes edits to specific sections that are applied only after you confirm.
- **Write an adventure** — progressive: idea → Foggy’s questions → an outline (chapters, planned sections, twists, side quests, endings; editable, revisable) → write one chapter at a time (read-aloud text and private DM notes) → rewrite / expand / regenerate a single section (Foggy’s version appears beside yours) → save as a **new adventure** or as **new chapters added** to an existing one (nothing is replaced). The draft is kept with the project.
- **Make** — quick drafts; monsters, NPCs, spells and magic items come back in the **homebrew data shape** (2024 stat blocks with attacks and saves) and **Save to Homebrew** creates a real, usable entry (normalized by the homebrew model; usable in Combat).
- **Pictures & maps** — battle and dungeon maps (**playable**: top-down, square grid of your size) are asked for differently from illustrations (regional, world and city maps, locations, portraits, villains, monsters, items, spells, covers, handouts) and labelled so. Pictures are stored privately (`foggy_images`, bucket `foggy-images`); **Save to adventure** copies one into the adventure as an asset.
- **Music plan** — Foggy reads an adventure and builds a cue sheet (moment, start / change / stop / sound effect, track, trigger words) using **only tracks from the licensed music catalog** (anything else is dropped, on the server and again in the browser); review, play, edit and **save it into the adventure** (`content.musicCues`).
- **Listen** (Campaign Foggy, **Foggie+**) — Foggy listens to the DM narrate and plays the matching cue with the existing music player. Off until the DM presses Start; a red **“Foggy is listening”** bar with **Stop** stays on every campaign page; a few seconds of speech at a time are sent to be understood and dropped — **nothing is recorded or stored**; silence is not sent; the same cue is not repeated within 2 minutes and changes are at least 20 seconds apart; the DM can pause automatic music or play cues by hand. Microphone refusal or absence is explained.

**Setup (owner):**
1. Gemini API key as a **Supabase secret**: Dashboard → Edge Functions → Secrets → `GEMINI_API_KEY` (or `supabase secrets set GEMINI_API_KEY=...`). Never in `.env`, Git or the browser.
2. Run migrations `20261118120100_foggy_on.sql` (the `foggy` switch) and `20261119120000_foggy_assistant.sql`.
3. Deploy: `supabase functions deploy foggy-assistant --no-verify-jwt` (it also answers session preparation and Logbook recaps), `supabase functions deploy foggy-image --no-verify-jwt`, `supabase functions deploy foggy-listen --no-verify-jwt` (and `foggy-generate` for the quick drafts). The functions check the signed-in user themselves.
4. Optional secrets: `GEMINI_MODEL` (default `gemini-2.5-flash-lite`), `FOGGY_IMAGE_MODEL` (default `gemini-2.5-flash-image`; for example `gemini-3.1-flash-image`), `FOGGY_AUDIO_MODEL` (default: `GEMINI_MODEL`), daily fair-use caps `FOGGY_DAILY_TEXT_FOGGIE` / `_FOGGIE_PLUS` (150 / 500), `FOGGY_DAILY_IMAGES_FOGGIE` / `_FOGGIE_PLUS` (10 / 40), `FOGGY_DAILY_AUDIO_CHUNKS` (1500). **Image generation usually needs a paid Gemini API plan**; without it the Pictures tab shows Google’s quota answer instead of a picture.

**Who gets it** (pricing page, no new tiers; `public.foggy_access()`): Warlord (Free) none · Dungeon Master **Foggie** · Fogger of the Dragons **Foggie+**, plus **Campaign Foggy** (the DM of their own active campaigns; it reads the campaign, its party, its logbook and its adventure — what the DM may read) and **Listen**. Combat help works for anyone with a Foggy plan, with what they may see (players: the public view and their own character). Everything Foggy makes is saved only when the user approves it.

### Settings

- **Interface Theme:** Dark, Bright or Match my device. All theme values are in `Styles/theme.css`: the Light palette (`--l-*`), semantic tokens for new CSS (`--fod-bg`, `--fod-surface`, `--fod-text`, `--fod-accent`, …), Light values of the existing variables, and role tokens (`--fx-*`) that replaced the literal colors in the stylesheets (their Dark value is the old color, so Dark Mode did not change). The sidebar and header bar stay dark in both themes because their dragon videos and artwork have black backgrounds; their menus follow the theme. Use variables, not literal colors, in new CSS.
- **Background music and sound effects** are generated in the browser (`JS/fog-audio.js`, Web Audio); no audio files are downloaded.

### Monsters & Spells (sidebar → Monsters&Spells)

- **Data:** all 330 monster stat blocks and all 339 spells of the **SRD 5.2.1** (2024 rules, CC BY 4.0). Monsters are in `Assets/Data/srd-5.2.1-monsters.json`, generated by `node tools/build-compendium.mjs --md <dnd-5e-srd-markdown folder> --json <5e-database src/2024/en/5e-SRD-Monsters.json>`: the SRD Markdown (same pinned commit as the character data) is the source, the 5e-database JSON is only a cross-check (AC, HP, CR and ability scores agree for all 323 monsters both contain). Two typos in the Markdown tables were filled from the JSON and are noted on those entries. Spells come from the character engine data, so they exist once in the project.
- **Page:** search and filters for monsters (name/type/ability, creature type, size, CR range) and spells (name/text, level, school, class, Concentration, Ritual); the full stat block or spell text; the source, edition and license on every entry and a sources section. Environment is not part of the SRD 5.2.1 stat blocks, so it is not offered. Entries missing a required field are marked “Incomplete data” (none are).
- **Your homebrew:** when you are signed in, your homebrew monsters, NPCs with a stat block and spells are listed too, marked “Homebrew”, with an “Edit in Homebrew” link; the **Source** filter shows only the official SRD or only your homebrew. Entries are drawn by `compendium-render.js`, which the Homebrew editor's preview uses as well.
- **More content later:** `FogCompendium.register({ meta, entries })` (`compendium-store.js`) adds licensed packs, Fog of the Dragon originals or homebrew; each dataset must state its origin (`official-srd`, `fod-original`, `homebrew`), edition, and (unless homebrew) license and attribution. Only SRD content is included; Monster Manual and other sourcebooks are not.

### Homebrew (sidebar → Homebrew)

- **What you can make:** monsters, NPCs (personality, wants, voice, background, secrets only you see, and an optional stat block), spells, magic items, feats, and other rules (house rules, conditions, traps, hazards, poisons, curses, lore).
- **Library** (`#grimoire`): type tabs with counts, search (all of your text), sort by last modified, name, or CR / spell level / rarity; create (choose the type and a name), duplicate, delete with confirmation.
- **Editor** (`#grimoire/<id>`): the form for the type on the left and a live preview on the right, drawn exactly like Monsters & Spells. Stat blocks use the 2024 rules (SRD 5.2.1) format and the rules math is done for you: ability modifiers, saving throws (tick the proficient ones), skills (proficient or expertise), initiative, hit points from the number of Hit Dice (die by size + Constitution), Passive Perception, proficiency bonus and XP from the Challenge Rating. Actions, bonus actions, reactions and legendary actions can be plain text or built from parts: an attack (melee/ranged, ability, reach/range, damage dice and type, extra damage, magic bonus) or a saving throw (ability, DC ability, who saves, damage, failure and success effects); the stat block text is written for you. Text supports `**bold**` and `_italic_`. A rebuilt SRD Goblin Warrior produces the official stat block word for word (tested).
- **Saving:** autosave about a second after typing stops (or Ctrl/Cmd+S / Save now), with the same honest status and conflict protection as Adventures.
- **Storage:** Supabase table `public.homebrew` (migration `20261110120100_homebrew.sql`): one row per entry, private to its author by Row Level Security; the fields are validated structured JSON (`data`, schema 1, at most 100 KB), never HTML; the type can't change after creation; up to 2000 entries per user.
- **Pictures:** each type has its own illustration (medallions in `Assets/Pictures/homebrew/`, built by `node tools/build-homebrew-art.mjs` around silhouettes by Lorc and Delapouite from game-icons.net, **CC BY 3.0**, credited in `Assets/Pictures/homebrew/ATTRIBUTION.md`). Any entry can also get a picture of your own (choose, drop or paste in the editor): it replaces the medallion on the card and appears in the preview, stored privately like adventure images (`<your user id>/homebrew/<entry id>/`).
- The sidebar entry shows a PRO tag, but payments don't exist yet, so Homebrew is available to every account.

### Character System

- **Rules:** D&D 5E 2024 rules from the System Reference Document 5.2.1 only (no 2014 content). Supported: all 12 SRD classes (levels 1–20) with their one SRD subclass each, all 9 SRD species, all 4 SRD backgrounds plus a custom background builder (same structure as the official ones), all 17 SRD feats, all 339 SRD spells on all 8 class spell lists, Metamagic, Eldritch Invocations, SRD weapons, armor and adventuring gear, and the Rules Glossary. Multiclassing isn't supported.
- **Rules engine** (`JS/character-engine/`, no UI code): `character-options.js` decides what every choice may contain, `validate-character.js` checks steps and removes choices that stop being legal after an edit (with a notice), `derive-character.js` computes every number. The UI only displays these.
- **Level up:** a finished character's sheet has “Level up to N” (SRD “Gaining a Level”): one more Hit Die, rolled or the fixed value (rolls are kept in `choices.hpRolls`), a summary of new features and improved numbers, then only the steps with new choices (subclass, feats, spells, Weapon Mastery…). Nothing changes until “Save level N”.
- **PDF export:** the sheet's “Export PDF” downloads a printable, text-based sheet (stats, skills, attacks, features, spells with their SRD text, equipment, story, SRD attribution), followed by the **Character Guide** on its own pages (identity and roles, abilities, how to play, combos and synergies, strengths and weaknesses, level progression). Both are built from the saved character (`character-pdf.js`, `character-guide.js`); the guide in the PDF is always the rules-based one and never depends on the optional AI wording. It uses jsPDF 2.5.2 (MIT), loaded from jsDelivr with Subresource Integrity only when you click the button. `node --test tests/pdf.test.mjs` needs `npm install --no-save jspdf@2.5.2` (skipped otherwise).
- **Guided Tips:** every choice and number has a “?” button; the creator's “Guided mode” switch hides them all (`guided-tips.js` content, `tips-popover.js` UI). Each tip has a beginner summary, an example, and the official SRD text.
- **Character Guide:** the creator's last step and the sheet's “Character Guide” tab (`character-guide.js`, `synergies.js`). It is built from the character's data every time, so it never goes stale after an edit.
- **Optional AI wording (off by default):** `supabase/functions/character-guide-ai` (Gemini) can rephrase the guide. Deploy it with `supabase functions deploy character-guide-ai`, store the key as a Supabase secret (`supabase secrets set GEMINI_API_KEY=...`, never in `.env` or the frontend), then set `FOG_AI_GUIDE=true` in `.env` and rerun `node tools/write-supabase-config.mjs`. The AI never decides legality or numbers; its text is checked against the rules data before it is shown, and the rules-based guide always works without it.
- **Content packs:** `FogContentPacks.register(pack)` (`content-packs.js`) adds licensed or your own 2024-edition content (spells, feats, backgrounds, species, subclasses). Packs need a license and attribution and are validated before use; nothing is registered by default.
- **Data:** `JS/character-engine/data/` is generated. Don't edit it by hand. Rebuild it with `node tools/build-srd-data.mjs --md <srd-markdown-folder> --json <5e-database src/2024/en folder>`; the script lists its pinned sources, checks its rules overlay against the SRD text, and prints every place where the two sources disagree.
- **Storage:** characters are saved in the browser's `localStorage` (`fog_characters_v1`), separately for each signed-in user. They aren't synced to Supabase yet.
- **Character limit** (migration `20261115120000_character_limit.sql`): the Free plan allows **3 characters**; Dungeon Master and Fogger of the Dragons are unlimited. The Characters page shows “N / 3 Characters”, and at the limit it explains the limit and offers the plans; viewing, editing, levelling up and deleting always work. The limit is decided by the database: a small server **registry** (character id, owner, deleted flag) hands out a slot for every new character (`register_character`, refused at the limit), deleting frees it, and the browser’s character store refuses to save a new character without a slot, so calling it directly doesn’t get around it. Existing characters are registered on the first visit after the migration (nobody loses a character). Characters made in another browser use slots too; the page shows them and can free them.
- **Tests:** `node --test "tests/*.test.mjs"` (engine, all 12 classes, tips, guide, AI client and Edge Function logic). `tests/ui/characters-harness.html` loads the creator and sheet without signing in, for browser testing.

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

---

## 🎯 Long-Term Vision

Fog of the Dragon is intended to become a companion layer for tabletop campaigns rather than another virtual tabletop.

The long-term goal is to make running and playing a campaign feel:

**faster, clearer, more organized, and more immersive — without taking the table away from the players.**

---

## 📜 License

License information will be added as the project develops.

