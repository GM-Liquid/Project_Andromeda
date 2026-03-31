# Project Andromeda - AGENTS.md (AI Helper Guide)

> **Spec reference:** This document follows the [agentsmd.net specification](https://agentsmd.net/#what-is-agentsmd).  
> **Purpose:** Explain the structure, conventions, and extra rules an AI assistant (for example OpenAI Codex) must respect when working with this repository.

---

## 1. Project Snapshot

| Key fact                      | Value                                                           |
| ----------------------------- | --------------------------------------------------------------- |
| **System name**               | **Project Andromeda**                                           |
| **Foundry VTT compatibility** | v12 (verified 12)                                               |
| **Current version**           | `0.3.2.0`                                                       |
| **Current release line**      | `0.3.0.x`                                                       |
| **Languages**                 | English, Русский (full parity required)                         |
| **Main tech**                 | ES-module JavaScript (`*.mjs`), Handlebars (`*.hbs`), JSON, CSS |
| **Licence**                   | CC BY-NC-SA 4.0                                                 |

## 2. Repository Map

```text
project-andromeda/
| README.md
| AGENTS.md <- you are here
| system.json <- Foundry manifest
| template.json <- data templates
| package.json
| Книга правил v0.4/ <- public reader-facing rulebook mirror, refreshed from the private source repo
|
+- .quartz-site/
|  content/
|  | index.md <- hand-authored public landing page for the rulebook
|  | .generated-rulebook.json <- generated chapter file registry for Quartz sync
|  | assets/
|  |  '- rulebook/
|  |     '- art-core-1.webp
|  | '- rulebook/
|  |    | 01-osnovnye-pravila.md <- generated from the public mirror
|  |    | 02-sozdanie-personazha.md <- generated from the public mirror
|  |    | 03-sposobnosti-i-snaryazhenie.md <- generated from the public mirror
|  |    | 04-boy.md <- generated from the public mirror
|  |    | 05-peregovory.md <- generated from the public mirror
|  |    '- skills-reference.md <- hand-authored editorial reference page
|  quartz/
|  scripts/
|  | sync-book.mjs <- generates chapter pages from the public mirror
|  | rulebook.manifest.mjs <- single source of editorial rulebook structure
|  '- dev.mjs
|  quartz.config.ts
|  quartz.layout.ts
|
+- module/
|  project-andromeda.mjs
|  config.mjs
|  apps/
|  documents/
|  helpers/
|  sheets/
|
+- templates/
|  apps/
|  actor/
|  item/
|
+- lang/
|  en.json <- English strings
|  ru.json <- Russian strings (must mirror English keys)
|
+- assets/
+- css/
|  project-andromeda.css
|
+- docs/
|  google-sheets-sync.md
|  google-sheets-webapp.gs
|
'- .github/
   workflows/
   release.yml
```

### 2.1 Public Rulebook & Quartz

- `Книга правил v0.4/` in this repository is a **public mirror**, not the canonical rules source. Canonical mechanics still live in the private source repo `Docs_Project_Andromeda`.
- `.quartz-site/scripts/sync-book.mjs` auto-detects a sibling `../Docs_Project_Andromeda/Книга правил v0.4/` (or `PROJECT_ANDROMEDA_DOCS_REPO`) and mirrors it into this repository before generating Quartz chapter pages.
- If the private docs repo is unavailable, Quartz falls back to the mirrored `Книга правил v0.4/` inside this public repository so CI and GitHub Pages builds still work.
- `.quartz-site/scripts/rulebook.manifest.mjs` is the single source of truth for public rulebook structure, ordering, summaries, hero settings, and which pages are generated versus hand-authored.
- `.quartz-site/content/` is now **mixed authored/generated publication content**:
  - generated chapter pages under `.quartz-site/content/rulebook/01-...05-...`
  - hand-authored editorial pages such as `.quartz-site/content/index.md` and `.quartz-site/content/rulebook/skills-reference.md`
- `.quartz-site/content/.generated-rulebook.json` is generated state used by the sync pipeline. Do not hand-edit it unless you are explicitly changing sync internals.
- `.quartz-site/public/` is build output. Never edit it manually.

### 2.2 Current Quartz Publication Shape

- `/` is the main landing page for the public rulebook.
- `/rulebook/` is intentionally **not** used as a separate landing page to avoid duplicating the home page.
- Main generated book chapters are published as `/rulebook/<slug>/` and keep their stable chapter URLs.
- Curated editorial/support pages may also live under `/rulebook/` when they are intentionally hand-authored rather than mirrored 1:1 from the public book copy.
- Rulebook navigation order comes from `rulebook.manifest.mjs`, not from filename sorting.
- The landing page, editorial hero, left navigation, right-hand TOC, and previous/next pager are part of the Quartz presentation layer, not part of the game canon.

### 2.3 Where to Edit Quartz

- `.quartz-site/scripts/rulebook.manifest.mjs` when page order, hero metadata, summaries, page types, or generated/manual rulebook boundaries change.
- `.quartz-site/scripts/sync-book.mjs` and `.quartz-site/scripts/rulebook-source.mjs` when the mapping between `Книга правил v0.4/` and generated chapter pages changes, or when emitted chapter frontmatter / private-docs mirroring behaviour changes.
- `.quartz-site/content/index.md` and other hand-authored files in `.quartz-site/content/` when curated landing/reference content changes.
- `.quartz-site/quartz.layout.ts` when rulebook layout, sidebars, TOC placement, or conditional page composition change.
- `.quartz-site/quartz/components/` and `.quartz-site/quartz/styles/` when editorial hero/header/nav/pager behaviour, interaction logic, or styling change.
- `.quartz-site/quartz/plugins/transformers/rulebookBlocks.ts` when the custom `:::summary`, `:::cards`, or `:::accordion` authoring syntax changes.

### 2.4 Quartz Boundaries

- Do not treat the Quartz layout or the public rulebook mirror as canonical rules text.
- Do not bump `system.json` for Quartz-only, public-rulebook-only, or other non-shipped publication changes.
- Keep the public mirror in `Книга правил v0.4/` clean and reader-facing. Editorial-only structure, hero metadata, and navigation logic belong in Quartz manifest/layout/content files, not in the mirrored rule text unless the maintainer explicitly wants that coupling.
- When changing routes, slugs, or emitted pages, check for duplicate pages created by both generated chapter output and hand-authored Quartz pages.
- Do not let `sync-book.mjs` overwrite hand-authored editorial pages such as the landing page or curated reference pages.
- If a published page disappears or its slug changes, explicitly call out the old URL impact unless a redirect is added.

---

## 3. Data Model & Game Rules

### 3.1 Core Characteristics

Project Andromeda uses **three** primary abilities; no _Dexterity_ characteristic is present.

| Abbreviation | Name (EN / RU) | Range                     |
| ------------ | -------------- | ------------------------- |
| **CON**      | Body / Тело    | **d4 -> d20 (incl. 2d8)** |
| **INT**      | Mind / Разум   | **d4 -> d20 (incl. 2d8)** |
| **SPI**      | Spirit / Дух   | **d4 -> d20 (incl. 2d8)** |

Ability values are stored as die steps (`4, 6, 8, 10, 12, "2d8", 20`) and normalized via helper utilities; derived stats and in-game effects are computed in `module/documents/actor.mjs`.

### 3.2 Skills

- Skills are integer values with no hard upper cap.
- Each skill is tied to an ability key in `template.json` and uses that ability's die for rolls.
- Skill modifiers equal the skill's numeric value plus applicable item bonuses (cartridges, implants, weapons), and should not be capped in sheets, rolls, or UI.

### 3.3 Points of Heroism

- `system.momentOfGlory` stores **Points of Heroism** and remains the spendable heroism resource for backwards compatibility.
- Chat roll messages support a context-menu action to spend **1** point of heroism and add a bonus equal to **half the highest die maximum** in that roll.
- **Player characters** use their own personal Points of Heroism pool.
- **GM characters** (minion, rank-and-file, elite) do **not** gain hero points from player-only reward logic and instead spend from a **shared GM heroism pool** that is visible on all GM character sheets.
- Spending a point of heroism must keep the original roll context (dice results, flavor/modifiers, speaker, and roll visibility mode) without rerolling the dice.
- Session tracking must count points of heroism spent per actor inside the active session window.
- A session starts automatically when at least one GM and all player users in the world are connected.
- An active session ends automatically after any required participant stays offline for more than **15 minutes**.

### 3.4 Stress Formulas

- The system has **four** actor character types: `playerCharacter`, `minion`, `rankAndFile`, and `elite`.
- Player characters (`playerCharacter`, shown in UI as **Player Character** / **Персонаж игрока**) use stress **3 x rank** and support azure-stress marking on the stress track.
- Minions (`minion`, shown in UI as **Minion** / **Миньон**) use stress **3 x rank** and do **not** support azure-stress marking on the stress track.
- Rank-and-file characters (`rankAndFile`, shown in UI as **Rank-and-File** / **Рядовой**) use stress **3 x rank** and **do** support azure-stress marking on the stress track.
- Elite characters (`elite`, shown in UI as **Elite** / **Элита**) use stress **9 x rank** and do **not** support azure-stress marking on the stress track.
- `system.temphealth` is presented as **temporary stress** for backwards compatibility and extends the **power shield** track rather than the base stress track.

### 3.5 Movement Speed

- Base movement speed is **1**.
- Movement speed does **not** scale from abilities or rank.
- Armor speed modifiers and `system.tempspeed` remain additive on top of that base value.

### 3.6 Extreme Roll Reward

- When a player character roll contains at least one die showing its minimum or maximum face, that actor gains **1** point of heroism.

---

## 4. Build, Deployment & Versioning

- **Version format:** Treat `system.json` version as a four-part project version `MAJOR.LINE.RULES.FOUNDRY` (for example `0.3.0.0`).
- **Second number (`LINE`):** Change this number **only** on the maintainer's direct instruction. Do not bump it automatically.
- **Third number (`RULES`):** Change this number only for large game-rule changes or similarly important mechanical redesigns. This includes changes to core mechanics, balance frameworks, roll logic, stress/resource rules, progression rules, or other behaviour that meaningfully changes how the game is played.
- **Do not use the third number for:** sheet polish, UI cleanup, localisation-only work, visual improvements, ordinary Foundry UX changes, refactors, or non-mechanical content maintenance.
- **Fourth number (`FOUNDRY`):** Use this for normal shipped Foundry-system updates that do not significantly change the rules, such as sheet/UI work, localisation parity, bug fixes, quality-of-life improvements, small content plumbing, migrations that preserve the same rules, and internal refactors with the same gameplay behaviour.
- **First number (`MAJOR`):** Reserve for a stable milestone or an intentionally breaking overhaul.
- **When to bump:** Only bump `system.json` when a change affects shipped Foundry system files (for example `module/`, `templates/`, `css/`, `lang/`, `assets/`, `system.json`, `template.json`).
- **When not to bump:** Changes that do **not** touch the shipped Foundry system (for example Quartz publication files, public rulebook pages, docs, or changes in the private companion source repo such as balance sims) do **not** require a `system.json` version bump.
- **Examples:** `0.3.0.3 -> 0.3.0.4` for a normal Foundry-side fix; `0.3.0.4 -> 0.3.1.0` for a major rules update; `0.3.1.2 -> 0.4.0.0` only if the maintainer explicitly asks for that line bump.
- **Release packaging:** GitHub Actions builds a `dist/` folder from the shipped Foundry files and zips that folder for distribution. Quartz, public rulebook files, and other non-shipped publication folders are excluded from the release archive.
- **Release tags:** GitHub release tags should match the manifest version as `v<system.json version>` (for example `v0.3.0.0`).
- **Local development:** It is valid to point Foundry's local `Data/systems/project-andromeda` folder at this repository via a Windows junction or symlink. That local setup does not change what gets packaged for users.

---

## 5. Contribution Workflow

1. **Branch name:** `feature/<slug>` or `fix/<slug>`.
2. **Commit style:** Conventional commits (`feat:`, `fix:`, `chore:`).
3. **Pull Request template:** includes check-boxes for localisation parity, version bump, and ESLint pass.
4. **CI checks:**
   - ESLint + simple Jest tests (if present)
   - JSON schema validation for `system.json`, localisation files, and character templates

---

## 6. Code & Localisation Conventions

- **Copy-paste-ready code:** avoid line numbers or decorations that break direct copy.
- **Dual-language localisation:** any new string must be added **simultaneously** to `en.json` and `ru.json` with identical keys.

  ```json
  // en.json
  "MY_RPG.RollTitle": "Might Check"

  // ru.json
  "MY_RPG.RollTitle": "Проверка Силы"
  ```

- **Naming:** camelCase for JS variables, kebab-case for file names, UPPER_SNAKE for Handlebars helpers.
- **Sheets:** built with plain HTML + Handlebars; keep markup semantic for accessibility.
- **No full re-render on edits:** Any change made through the character sheet (PC or NPC) should update the UI and derived values without triggering a full sheet re-render, unless a structural reflow is required. Prefer in-place DOM updates tied to `actor.update(..., { render: false })`, and refresh only the affected inputs, labels, and computed fields (speed, defenses, health, and similar values).
- **Item library sync:** Character-sheet items that represent abilities, genomes, traits, or equipment must stay linked to a corresponding world-level Foundry item in the Items directory. A single library item may be linked to multiple actor items at once. Shared library data must propagate to every linked actor item, while actor-local state such as `quantity` and `equipped` remains local. The system must not auto-create new item folders or automatically move already-foldered library items between folders.
- **Unified equipment type:** `equipment`, `equipment-consumable`, `implant`, and `cartridge` are treated as a unified equipment model. New content should use the `equipment` item type with `system.requiresRoll` and optional `system.skill`; legacy types are migration-only compatibility paths and are normalized during migration.
- **Unified trait type:** all non-genome, non-source-ability traits use the `trait` item type. Legacy `trait-*` subtypes remain migration-only compatibility paths and should not be used for new content.

---

## 6.1 Private Balance Tooling

Balance simulations and data-prep tooling live in the **private companion source repo**, not in this public Foundry repository.

- **Tracking:** do not recreate or commit a local `Gear balance/` workspace here. Keep balance tooling in the private repo under `tools/gear-balance/`.
- **Versioning:** private balance-tooling changes do **not** require a `system.json` version bump unless they also modify shipped Foundry files in this repository.
- **Documentation:** if balance-tooling changes require Foundry-side workflow or documentation changes, update the tracked files in this repository separately.

---

## 6.2 Google Sheets Sync

The Google Sheets sync MVP is part of the shipped Foundry system.

- **Source of truth:** import/export works on world `Item` documents, not directly on embedded actor items.
- **Link safety:** imports must update existing world items in place whenever possible; do not delete and recreate linked library items during normal sync.
- **Stable identity:** spreadsheet round-trips use `flags.project-andromeda.sheetSyncId` as the stable external key.
- **Type safety:** changing an existing item's `type` during sheet import is blocked in the MVP and should be handled as a dedicated migration, not a silent update.
- **Round-trip coverage:** exports include typed columns for common editing plus a `systemJson` fallback so new or uncommon system fields survive round-trips.
- **Actor updates:** after importing into world items, linked actor items should refresh through the existing item library sync so sheet links remain intact.

---

## 7. AI Assistant-Specific Guidelines

> The maintainer is a **junior game-designer** and **beginner programmer**.

1. **Double-check** every technical suggestion before presenting it.
2. **Ask clarifying questions** whenever a requirement is ambiguous.
3. **Provide code** in a single contiguous block, ready for one-click copy.
4. **Ensure RU + EN localisation** for any code that introduces UI text.
5. **Bump `system.json` version according to the SemVer rules in Section 4** only when the change affects the shipped Foundry system.
6. If adding or renaming a field that affects characteristics or skills, confirm the ability die step rules and absence of DEX.
7. When implementing sheet interactions, prioritize incremental updates: submit data with `render: false`, then update only the impacted parts of the DOM to reflect changes immediately. This applies equally to PCs and NPCs.
8. **Adhere to code style:** All generated or modified code must strictly follow the formatting rules defined in `.prettierrc.json` and the linting rules in `eslint.config.mjs`.
9. **Keep this document in sync:** When important mechanics, release rules, or repository structure change, update `AGENTS.md` in the same change.
10. Before adding a migration script or migration hook, explicitly ask whether that migration must be one-time or repeatable. Default to a one-time migration only after the maintainer confirms it. If a migration is one-time, wire it so it does not keep rerunning after completion.

---

_Last updated: 2026-03-31_
