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

### Character System

- **Rules:** D&D 5E 2024 rules from the System Reference Document 5.2.1. Supported: Fighter, Rogue, Cleric and Wizard (levels 1–20) with their SRD subclasses, all 9 SRD species, all 4 SRD backgrounds, all SRD feats, and the complete SRD spell lists. The other 8 SRD classes and multiclassing aren't supported yet.
- **Data:** `JS/character-engine/data/` is generated. Don't edit it by hand. Rebuild it with `node tools/build-srd-data.mjs --md <srd-markdown-folder> --json <5e-database src/2024/en folder>`; the script lists its pinned sources and prints every place where the two sources disagree.
- **Storage:** characters are saved in the browser's `localStorage` (`fog_characters_v1`). There is no account sync yet.
- **Tests:** `node --test tests/engine.test.mjs`

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

---

## 🎯 Long-Term Vision

Fog of the Dragon is intended to become a companion layer for tabletop campaigns rather than another virtual tabletop.

The long-term goal is to make running and playing a campaign feel:

**faster, clearer, more organized, and more immersive — without taking the table away from the players.**

---

## 📜 License

License information will be added as the project develops.

