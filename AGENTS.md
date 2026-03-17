# Project Andromeda - AGENTS.md (AI Helper Guide)

> **Spec reference:** This document follows the [agentsmd.net specification](https://agentsmd.net/#what-is-agentsmd).  
> **Purpose:** Explain the structure, conventions, and extra rules an AI assistant (for example OpenAI Codex) must respect when working with this repository.

---

## 1. Project Snapshot

| Key fact | Value |
| --- | --- |
| **System name** | **Project Andromeda** |
| **Foundry VTT compatibility** | v12 (verified 12) |
| **Current version** | `0.3.0` |
| **Current release line** | `0.3.x` |
| **Languages** | English, Русский (full parity required) |
| **Main tech** | ES-module JavaScript (`*.mjs`), Handlebars (`*.hbs`), JSON, CSS |
| **Licence** | CC BY-NC-SA 4.0 |

## 2. Repository Map

```text
project-andromeda/
| README.md
| AGENTS.md <- you are here
| system.json <- Foundry manifest
| template.json <- data templates
| package.json
|
+- module/
|  project-andromeda.mjs
|  config.mjs
|  documents/
|  helpers/
|  sheets/
|
+- templates/
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
+- Gear balance/
|  weapons_sim.py
|  sim_driver.py
|  sim_accel.py
|  sim_rules.py
|  sheets_sync.py
|  property_values.json
|  property_combos.json
|  custom_simulations.json
|  Андромеда_ Контент - Свойства (1).csv
|
'- .github/
   workflows/
   release.yml
```

---

## 3. Data Model & Game Rules

### 3.1 Core Characteristics

Project Andromeda uses **three** primary abilities; no _Dexterity_ characteristic is present.

| Abbreviation | Name (EN / RU) | Range |
| --- | --- | --- |
| **CON** | Body / Тело | **d4 -> d20 (incl. 2d8)** |
| **INT** | Mind / Разум | **d4 -> d20 (incl. 2d8)** |
| **SPI** | Spirit / Дух | **d4 -> d20 (incl. 2d8)** |

Ability values are stored as die steps (`4, 6, 8, 10, 12, "2d8", 20`) and normalized via helper utilities; derived stats and in-game effects are computed in `module/documents/actor.mjs`.

### 3.2 Skills

- Skills are integer values with no hard upper cap.
- Each skill is tied to an ability key in `template.json` and uses that ability's die for rolls.
- Skill modifiers equal the skill's numeric value plus applicable item bonuses (cartridges, implants, weapons), and should not be capped in sheets, rolls, or UI.

### 3.3 Points of Heroism

- `system.momentOfGlory` stores **Points of Heroism** and remains the spendable heroism resource for backwards compatibility.
- Chat roll messages support a context-menu action to spend **1** point of heroism and add a bonus equal to **half the highest die maximum** in that roll.
- Spending a point of heroism must keep the original roll context (dice results, flavor/modifiers, speaker, and roll visibility mode) without rerolling the dice.
- Session tracking must count points of heroism spent per actor inside the active session window.
- A session starts automatically when at least one GM and all player users in the world are connected.
- An active session ends automatically after any required participant stays offline for more than **15 minutes**.

### 3.4 Stress Formulas

- Player characters use stress **3 x rank**.
- Bosses are a distinct actor type and use stress **9 x rank**.
- Supporting characters (`npc`) keep their existing stress progression unless explicitly changed elsewhere.
- `system.temphealth` is presented as **temporary stress** for backwards compatibility and extends the **power shield** track rather than the base stress track.

### 3.5 Extreme Roll Reward

- When a player character roll contains at least one die showing its minimum or maximum face, that actor gains **1** point of heroism.

---

## 4. Build, Deployment & Versioning

- **Version format:** Use SemVer `MAJOR.MINOR.PATCH` in `system.json`. The current public line is `0.3.x`, starting at `0.3.0`.
- **Patch bump (`0.3.0` -> `0.3.1`):** Use for normal Foundry releases that stay backwards compatible and do not need a migration note, such as bug fixes, balance tweaks, localisation updates, sheet/UI polish, small content additions, or internal refactors with the same user-facing behaviour.
- **Minor bump (`0.3.x` -> `0.4.0`):** Use for notable public updates, such as new mechanics, meaningful actor/item data changes, migrations, large content waves, or behaviour changes that deserve dedicated release notes.
- **Major bump (`0.x.y` -> `1.0.0` or higher):** Use for a stable milestone or intentionally breaking redesigns.
- **When to bump:** Only bump `system.json` when a change affects shipped Foundry system files (for example `module/`, `templates/`, `css/`, `lang/`, `assets/`, `system.json`, `template.json`).
- **When not to bump:** Changes that do **not** touch the shipped Foundry system (for example Python tools, balance sims, docs, or workflow-only changes in `/Gear balance`, `.github`, or root docs) do **not** require a `system.json` version bump.
- **Release packaging:** GitHub Actions builds a `dist/` folder from the shipped Foundry files and zips that folder for distribution. Local tooling folders such as `Gear balance/` are excluded from the release archive.
- **Release tags:** GitHub release tags should match the manifest version as `v<system.json version>` (for example `v0.3.0`).
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
- **Item library sync:** Character-sheet items that represent abilities, genomes, traits, or equipment must stay linked to a corresponding world-level Foundry item in the Items directory. These library items are organized into actor-specific item folders and should inherit the same ownership as their source actor. Changes to shared library data should propagate to linked actor items, while actor-local state such as `quantity` and `equipped` remains local unless explicitly redesigned.
- **Unified equipment type:** `equipment`, `equipment-consumable`, `implant`, and `cartridge` are treated as a unified equipment model. New content should use the `equipment` item type with `system.requiresRoll` and optional `system.skill`; legacy types are migration-only compatibility paths and are normalized during migration.

---

## 6.1 Gear Balance Workspace

The `Gear balance/` folder is **not** part of the Foundry build. It is a local tooling workspace for simulations and data prep.

- **Source of truth:** `Андромеда_ Контент - Свойства (1).csv` defines the list of weapon properties.
- **Sync rule:** `Gear balance/weapons_sim.py` must include **all** properties from that CSV and **no extra** ones. If you add, remove, or rename a property, update both files together.
- **Naming:** Preserve the exact property names, including `X`/`Х` suffixes.
- **Versioning:** Changes in `Gear balance/` do **not** require a `system.json` version bump.
- **Simulation rules mirror:** If you change the base simulation rules (rolls, actions, reactions, statuses, movement, damage), update the rules description in `Gear balance/sim_rules.py` in the same change.

Typical workflow:

1. Edit the CSV to change, add, or remove a property.
2. Update `PROPERTY_DEFS` and any related logic in `weapons_sim.py`.
3. Run quick validation, for example `python -m py_compile "Gear balance/weapons_sim.py"`.

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

---

_Last updated: 2026-03-17_
