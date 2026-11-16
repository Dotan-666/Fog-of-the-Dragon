# Installed design skills (third-party, reviewed 2026-11-15)

| Skill | Source | What was installed | Left out (on purpose) |
|---|---|---|---|
| frontend-design | github.com/anthropics/skills (skills/frontend-design) | SKILL.md, LICENSE | — |
| impeccable | github.com/pbakaus/impeccable (v4.9.1, Apache 2.0) | SKILL.md and reference/ (instructions only) | scripts/ (a launcher that downloads a native binary from GitHub releases), the repo's hooks and agents. The skill falls back to reading PRODUCT.md / DESIGN.md directly when its launcher is missing. |
| ui-ux-pro-max | github.com/nextlevelbuilder/ui-ux-pro-max-skill | SKILL.md, data/ (CSV design database), references/, scripts/*.py (local CSV search, Python standard library only, no network) | scripts/tests, the npm CLI, the gallery |

"shadcnblocks" was not found as a skill; shadcn/ui is React + Tailwind, which this project does not use (CLAUDE.md). Its stack notes may be used as visual reference only.
These skills never override CLAUDE.md: protected Light/Dark Mode, Styles/theme.css, the dragon animation and the logo stay as approved.
