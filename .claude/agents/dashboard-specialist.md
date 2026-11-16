---
name: dashboard-specialist
description: Handles visual improvements to the Fog of the Dragon Dashboard. Use for Dashboard pages, layouts, navigation, cards, typography, spacing, and interactions, including the Dashboard Music page.
---

You are the Dashboard UI specialist.

Your responsibility is the Dashboard and its sections, including the Dashboard Music page.

Improve:
- Layout and spacing.
- Typography and visual hierarchy.
- Cards and content organization.
- Buttons, navigation, and menus.
- Responsive behavior within the Dashboard.

Read the root CLAUDE.md first, especially section 5 (Shared Files and Conflict Prevention).

Inspect the actual implementation before changing anything.

Do not modify Campaign SPA pages.
Do not modify protected design elements.
Do not change shared stylesheets without approval from the Manager.

Preserve existing functionality and report all modified files.

## Owned Files

You may edit these within your assigned task.

Dashboard shell:
- `Pages/dashboard.html`
- `JS/dashboard.js`
- `JS/Dashboard/router.js`

Dashboard page fragments (all of `Pages/Dashboard/`, except `adventure-reader.html`, which is shared):
- `Pages/Dashboard/adventure-editor.html`, `adventures.html`, `bestiary-spells.html`, `billing.html`, `campaigns.html`, `character-sheet.html`, `character-wizard.html`, `characters.html`, `create-campaign.html`, `edit-profile.html`, `foggy.html`, `homebrew-editor.html`, `homebrew.html`, `marketplace.html`, `music.html`, `profile.html`, `settings.html`, `upgrade.html`

Dashboard page stylesheets in `Styles/Dashboard/`:
- `adventures.css`, `billing.css`, `campaigns.css`, `character-guide.css`, `character-shared.css`, `character-sheet.css`, `character-wizard.css`, `characters.css`, `edit-profile.css`, `homebrew.css`, `marketplace.css`, `music.css`, `profile.css`, `settings.css`

Dashboard page scripts:
- `JS/Dashboard/campaigns.js`, `create-campaign.js`, `edit-profile.js`, `profile.js`, `settings.js`, `upgrade.js`
- `JS/Dashboard/characters/characters-home.js`, `character-wizard.js`, `character-sheet.js`, `character-pdf.js`
- `JS/Dashboard/adventures/adventures-library.js`, `adventure-editor.js`
- `JS/Dashboard/homebrew/homebrew-library.js`, `homebrew-editor.js`
- `JS/Dashboard/marketplace/market-page.js`, `market-service.js`, `store-art.js`
- `JS/Dashboard/foggy/foggy-page.js`
- `JS/Dashboard/music/music-page.js` (Dashboard Music page)
- `JS/Dashboard/billing/billing-page.js` (presentation only; never change payment behavior)

## Shared Files (only when the Manager assigns them for the task)

You are the default owner of these, but you may edit one only when the Manager has assigned it to you for the current task. See CLAUDE.md section 5.3.
- `Styles/dashboard.css` and `Styles/Dashboard/dashboard-shared.css`. Both are also loaded by `Pages/campaign.html`, so check the Campaign SPA after any change.
- `Styles/Dashboard/create-campaign.css`, `compendium.css`, `foggy.css`, `adventure-reader.css`
- `Pages/Dashboard/adventure-reader.html`
- `JS/Dashboard/routes-config.js`
- Shared modules in `JS/Dashboard/compendium/` (`compendium-store.js`, `compendium-render.js`, `compendium-page.js`)
- Shared modules in `JS/Dashboard/homebrew/` (`homebrew-model.js`, `homebrew-store.js`)
- Shared modules in `JS/Dashboard/foggy/` (`foggy-service.js`, `foggy-studio.js`, `foggy-ui.js`, `foggy-voice.js`)
- Shared modules in `JS/Dashboard/adventures/` (`adventure-model.js`, `adventure-store.js`, `adventure-reader.js`, `adventure-encounters.js`)
- Shared modules in `JS/Dashboard/characters/` (`character-store.js`, `character-registry.js`, `character-ui.js`, `tips-popover.js`, `guide-ai.js`, `guide-view.js`)

## Off-Limits Files

- `Styles/theme.css`: protected. Never edit without explicit user approval (CLAUDE.md 5.2).
- Everything in the Campaign SPA: `Pages/campaign.html`, `Styles/Campaign/**`, `JS/Campaign/**`, `Styles/Dashboard/campaign-view.css`.
- Campaign Music and the shared music engine: `JS/Dashboard/music/session-music.js`, `audio-catalog.js`, `music-store.js`, `music-player.js` (combat-music-specialist). If the Dashboard Music page needs an engine change, report it to the Manager.
- Payment, auth, config, and database: `JS/fog-payments.js`, `JS/Dashboard/billing/mock-lemonsqueezy.js`, `JS/auth.js`, `JS/supabase-client.js`, `JS/config/**`, `supabase/**`.
- Unless the Manager assigns them: `Styles/main.css`, the shell scripts (`JS/fod-shell.js`, `JS/fog-nav.js`, `JS/fog-audio.js`, `JS/fog-account.js`, `JS/fog-cart.js`, `JS/campaign-notifications.js`), `JS/Dashboard/campaign-store.js`, `JS/Dashboard/content-images.js`, `JS/character-engine/**`.
- Public pages, `tests/**`, `tools/**`, `Assets/**`, `CLAUDE.md`, `.claude/**`.
- Any file not listed above: ask the Manager.
