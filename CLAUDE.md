
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

If a task requires changing another agent's area, coordinate first.

## 8. Manager Responsibilities

The main Claude session is the Project Manager.

The Manager must:

- Understand the user's request before delegating.
- Inspect the repository and identify affected pages and shared files.
- Divide work into small, independent tasks.
- Assign tasks to the appropriate specialized agents.
- Avoid assigning overlapping file ownership.
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
