
# Fog of the Dragon — Project Instructions

## 1. Your Role

You are working on Fog of the Dragon (FOD), a tabletop RPG and D&D campaign companion.

The project is built primarily with HTML, CSS, and vanilla JavaScript.
Do not introduce React, Vue, Angular, or another frontend framework.

The existing application architecture must be preserved.

Your job is to improve the existing product, not rebuild it.

## 2. Core Architecture

The application contains two main experiences:

### Dashboard
- A persistent dashboard layout with navigation.
- Dashboard sections are loaded into the main content area.
- Shared styling is maintained through the existing stylesheet architecture.
- Dashboard sections include campaigns, characters, content, bestiary, music, Foggy, marketplace, and account settings.

### Campaign SPA
- A separate campaign workspace with its own persistent shell.
- Campaign pages share campaign context and navigation.
- Campaign features include Overview, Feed, Meetings, Members, Characters, Combat, Music, Content, Bestiary, Settings, and Foggy.

Before modifying any code, inspect the actual repository and identify the current architecture.
Do not assume that this description overrides the implementation.

## 3. Non-Negotiable Design Rules

- Preserve the existing visual identity: black, dark red, burgundy, and subtle fantasy styling.
- Keep the interface professional, readable, and organized.
- Avoid excessive rounded cards, generic dashboard templates, and unnecessary visual clutter.
- Do not make the entire interface look like a collection of identical boxes.
- Maintain consistent spacing, typography, buttons, navigation, and visual hierarchy.
- Prefer improving existing components over replacing them.

### Protected Design Elements

DO NOT modify these without explicit approval:

- Light Mode. It is already approved.
- Dark Mode. It is already approved.
- The dragon animation.
- The existing FOD branding and logo.
- Any previously approved design that is not directly part of your assigned task.

Do not redesign protected elements just because you personally prefer another style.

## 4. Code Rules

- Preserve the existing HTML/CSS/JavaScript architecture.
- Do not introduce unnecessary dependencies.
- Do not rewrite entire files when a smaller change is sufficient.
- Do not delete existing features or functionality.
- Do not replace working code with placeholders.
- Never invent mock data to make a feature appear functional.
- Do not silently change database schemas, Supabase policies, authentication, or business logic during a visual task.
- Do not change unrelated files.
- Do not duplicate existing CSS rules unnecessarily.
- Follow the naming and formatting conventions already used in the repository.

## 5. Shared Files and Conflict Prevention

Some files may be used by multiple sections.

Before editing a shared stylesheet or shared JavaScript module:

1. Identify which other pages depend on it.
2. Check whether another agent is modifying it.
3. Coordinate with the Manager before making overlapping changes.
4. Avoid broad changes that could affect unrelated pages.

Only one agent should own a shared file during a given task.

The Manager must serialize work when agents need to edit the same shared file.

### 5.1 Ownership Model

Every agent definition in `.claude/agents/` lists its **Owned Files** and **Off-Limits Files**.

- **Owned files**: the agent may edit these within its assigned task.
- **Shared files** (listed below): no agent edits these by default. The Manager assigns a shared file to exactly one agent for a specific task. The assignment ends when that task ends.
- **Off-limits files**: the agent must not edit these. If a task seems to require it, stop and report to the Manager.
- **Unlisted files**: treat as off-limits and ask the Manager.

The Manager records which agent holds each shared file before delegating, and never gives the same shared file to two agents at once, including agents running in parallel.

Shared JavaScript modules contain data, persistence, or business logic used by several pages. A visual task must not change their behavior.

### 5.2 Protected: `Styles/theme.css`

`Styles/theme.css` holds the approved Light Mode and Dark Mode theme and is loaded by every page (landing, auth, public pages, Dashboard, and Campaign SPA).

- No agent may edit `Styles/theme.css` without explicit approval from the user for that specific change.
- Manager approval alone is not enough.
- If a task appears to require a theme change, the agent stops and reports the proposed change; the Manager asks the user.

### 5.3 Shared Files Registry

The "default owner" is the agent the Manager normally assigns. It is not permission to edit without an assignment.

**Global stylesheets (both shells and/or public pages)**

| File | Loaded by | Default owner |
|---|---|---|
| `Styles/theme.css` | Every page | **Protected: user approval only** (5.2) |
| `Styles/main.css` | Landing, public pages, Dashboard, Campaign SPA | None: Manager assigns |
| `Styles/dashboard.css` | `Pages/dashboard.html` and `Pages/campaign.html` | dashboard-specialist |
| `Styles/Dashboard/dashboard-shared.css` | `Pages/dashboard.html` and `Pages/campaign.html` | dashboard-specialist |

A change to `Styles/dashboard.css` or `Styles/Dashboard/dashboard-shared.css` also changes the Campaign SPA. Both shells must be checked afterwards.

**Stylesheets shared between Dashboard and Campaign routes**

| File | Used by | Default owner |
|---|---|---|
| `Styles/Campaign/campaign.css` | All Campaign SPA pages, including Combat and Music | campaign-specialist |
| `Styles/Dashboard/campaign-view.css` | Campaign Meetings, Members, Characters, Music, Logbook, Settings | campaign-specialist |
| `Styles/Dashboard/create-campaign.css` | Dashboard Create Campaign; Campaign Members, Characters, Settings | dashboard-specialist |
| `Styles/Dashboard/compendium.css` | Dashboard Bestiary & Spells, Homebrew; Campaign Bestiary | dashboard-specialist |
| `Styles/Dashboard/foggy.css` | Dashboard Foggy; Campaign Foggy | dashboard-specialist |
| `Styles/Dashboard/adventure-reader.css` | Dashboard Adventure Reader; Campaign Adventures (content) | dashboard-specialist |

When combat-music-specialist needs Combat or Music styling in `Styles/Campaign/campaign.css` or `Styles/Dashboard/campaign-view.css`, the Manager reassigns that file for the task and campaign-specialist must not edit it in the meantime.

**Shell, routing, and infrastructure scripts**

| File | Default owner |
|---|---|
| `JS/fod-shell.js`, `JS/fog-nav.js`, `JS/fog-audio.js`, `JS/fog-account.js`, `JS/fog-cart.js`, `JS/campaign-notifications.js` | None: Manager assigns |
| `JS/Dashboard/routes-config.js` (also defines script sets the Campaign SPA reuses) | dashboard-specialist |
| `JS/Campaign/campaign-routes.js` | campaign-specialist |

**Shared feature modules (loaded by both Dashboard and Campaign routes)**

| Files | Default owner |
|---|---|
| `JS/Dashboard/music/audio-catalog.js`, `JS/Dashboard/music/music-store.js`, `JS/Dashboard/music/music-player.js` | combat-music-specialist |
| `JS/Dashboard/campaign-store.js`, `JS/Dashboard/content-images.js` | None: Manager assigns |
| `JS/Dashboard/compendium/compendium-store.js`, `compendium-render.js`, `compendium-page.js` | dashboard-specialist |
| `JS/Dashboard/homebrew/homebrew-model.js`, `homebrew-store.js` | dashboard-specialist |
| `JS/Dashboard/foggy/foggy-service.js`, `foggy-studio.js`, `foggy-ui.js`, `foggy-voice.js` | dashboard-specialist |
| `JS/Dashboard/adventures/adventure-model.js`, `adventure-store.js`, `adventure-reader.js`, `adventure-encounters.js` | dashboard-specialist |
| `Pages/Dashboard/adventure-reader.html` (fetched by Campaign Adventures) | dashboard-specialist |
| `JS/Campaign/encounter-launcher.js` (used by Campaign Adventures and adventure-model) | combat-music-specialist |
| `JS/Dashboard/characters/character-store.js`, `character-registry.js`, `character-ui.js`, `tips-popover.js`, `guide-ai.js`, `guide-view.js` | dashboard-specialist |
| `JS/character-engine/**` | None: Manager assigns |

### 5.4 Files No Agent Edits Without Explicit User Approval

- `Styles/theme.css` (see 5.2).
- `supabase/**` (database schema, policies, Edge Functions).
- `JS/config/**`, `JS/supabase-client.js`, `JS/auth.js` (configuration and authentication).
- `JS/fog-payments.js`, `JS/Dashboard/billing/mock-lemonsqueezy.js` (payment behavior).

### 5.5 Files Owned by the Manager Only

- `CLAUDE.md` and `.claude/**`.
- `tests/**` and `tools/**`. Agents may run tests but must not edit them without Manager approval.
- `Assets/**`.
- Public pages with no specialist: `index.html`, `JS/landing.js`, `Pages/about.html`, `Pages/contact.html`, `JS/contact.js`, `Pages/404.html`, `Pages/Auth/**`, `Pages/Terms&Privacy/**`, and their stylesheets (`Styles/auth.css`, `Styles/about.css`, `Styles/contact.css`, `Styles/404.css`).

### 5.6 QA Is Read-Only by Default

responsive-qa-specialist does not edit repository files. It reports issues and proposes fixes. It may implement a fix only when the user has explicitly authorized that specific fix, and only in the files named in that authorization. Any shared-file and `theme.css` rules above still apply.

## 6. Visual Testing Is Required

Do not rely only on reading HTML and CSS.

Whenever possible:

- Run the application.
- Open the relevant page in a real browser using Playwright or an available browser tool.
- Inspect the page at desktop and mobile sizes.
- Take screenshots before and after changes.
- Check for overflow, clipping, alignment problems, broken navigation, and inconsistent spacing.
- Check the browser console for errors.
- Verify that existing interactions still work.

If browser access or required credentials are unavailable, clearly report that visual testing could not be completed.
Never claim that a page was visually tested if it was not.

## 7. Task Boundaries

Every agent must:

- Work only within its assigned area.
- Read relevant existing files before editing.
- Avoid unrelated improvements.
- Report files changed and why.
- Report tests performed and results.
- Identify any unresolved issues.
- Ask the Manager before expanding the task.
- Edit only its Owned Files, plus any shared file the Manager has assigned to it for the current task (see section 5).

If a task requires changing another agent's area, coordinate first.

## 8. Manager Responsibilities

The main Claude session is the Project Manager.

The Manager must:

- Understand the user's request before delegating.
- Inspect the repository and identify affected pages and shared files.
- Divide work into small, independent tasks.
- Assign tasks to the appropriate specialized agents.
- Avoid assigning overlapping file ownership.
- State in every delegation which shared files (section 5.3) the agent may edit, and track who holds each one.
- Track dependencies between tasks.
- Review every agent's proposed changes.
- Run integration and regression checks.
- Reject changes that violate these instructions.
- Present a clear summary to the user before considering work complete.

The Manager must not blindly merge or accept every agent suggestion.

## 9. User Approval

Do not:
- Merge into main automatically.
- Deploy to production.
- Modify production data.
- Change real payment behavior.
- Introduce new external services.
- Remove existing features.

Ask the user before making major architectural, security, database, payment, or product decisions.

For ordinary, clearly scoped UI improvements, the Manager may authorize agents to implement changes on the working branch.

## 10. Final Report

At the end of every task, provide:

1. What was changed.
2. Which agents worked on it.
3. Which files were modified.
4. What visual tests were performed.
5. What functional tests were performed.
6. Any known regressions or unresolved issues.
7. Whether the changes are ready for review.

Quality and consistency are more important than the number of changes.
