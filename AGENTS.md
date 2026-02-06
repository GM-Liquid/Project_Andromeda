# Project Andromeda — **Agents.md** (AI Helper Guide)

> **Spec reference:** This document follows the [agentsmd.net specification](https://agentsmd.net/#what-is-agentsmd).\
> **Purpose:** Explain the structure, conventions, and *extra* rules an AI assistant (e.g. OpenAI Codex) **must** respect when working with this repository.

---

## 1 · Project Snapshot

| Key fact                      | Value                                                           |
| ----------------------------- | --------------------------------------------------------------- |
| **System name**               | **Project Andromeda**                                           |
| **Foundry VTT compatibility** | v12 (verified 12)                                               |
| **Current version (**``**)**  | `2.358` -> **auto-bumped to** `2.359` on next Foundry change    |
| **Languages**                 | English, Русский (full parity required)                         |
| **Main tech**                 | ES‑module JavaScript (`*.mjs`), Handlebars (`*.hbs`), JSON, CSS |
| **Licence**                   | CC BY-NC-SA 4.0                                                 |


## 2 · Repository Map

project-andromeda/
│  README.md
│  AGENTS.md          ← you are here
│  system.json        ← manifest (version bumped for Foundry changes only)
│  template.json      ← data templates
│  package.json
│
├─ module/
│   project-andromeda.mjs
│   config.mjs
│   documents/
│   │   actor.mjs
│   │   item.mjs
│   helpers/
│   │   config.mjs
│   │   handlebars-helpers.mjs
│   │   item-config.mjs
│   │   migrations.mjs
│   │   templates.mjs
│   │   utils.mjs
│   sheets/
│       actor-sheet.mjs
│       item-sheet.mjs
│
├─ templates/
│   └─ actor/
│       ├─ actor-character-sheet.hbs
│       └─ actor-npc-sheet.hbs
│   └─ item/
│       ├─ armor-sheet.hbs
│       ├─ cartridge-sheet.hbs
│       ├─ gear-sheet.hbs
│       ├─ generic-sheet.hbs
│       ├─ implant-sheet.hbs
│       └─ weapon-sheet.hbs
│
├─ lang/
│   en.json   ← English strings
│   ru.json   ← Russian strings (must mirror English keys)
│
├─ Gear balance/
│   base_values.py
│   property_values.py
│   property_combos.py
│   sim_driver.py
│   weapons_sim.py
│   sim_accel.py
│   weapons_tournament_all.py
│   Андромеда_ Контент - Свойства (1).csv
│
└─ css/
    project-andromeda.css
```

---

## 3 · Data Model & Game Rules

### 3.1 Core Characteristics

Project Andromeda uses **three** primary abilities; no *Dexterity* characteristic is present.

| Abbreviation | Name (EN / RU)     | Range      |
| ------------ | ------------------ | ---------- |
| **CON**      | Body / Тело        | **d4 → d20 (incl. 2d8)** |
| **INT**      | Mind / Разум       | **d4 → d20 (incl. 2d8)** |
| **SPI**      | Spirit / Дух       | **d4 → d20 (incl. 2d8)** |

Ability values are stored as die steps (`4, 6, 8, 10, 12, "2d8", 20`) and normalized via helper utilities; derived stats and in‑game effects are computed in `module/documents/actor.mjs`.

### 3.2 Skills

- Skills are integer values with no hard upper cap.
- Each skill is tied to an ability key in `template.json` and uses that ability’s die for rolls.
- Skill modifiers equal the skill’s numeric value plus applicable item bonuses (cartridges/implants/weapons), and should not be capped in sheets, rolls, or UI.

---

## 4 · Build, Deployment & Versioning

- **Auto‑version bump:** Only when a change **affects the Foundry system** (e.g. `module/`, `templates/`, `css/`, `lang/`, `assets/`, `system.json`, `template.json`), increment `system.json` by **+0.001** (current baseline `2.358`, next `2.359`).  
  Changes that **do not** touch the Foundry system (e.g. Python tools, balance sims, docs in `/Gear balance`) **do not** require a version bump.
- The build pipeline (GitHub Actions) simply zips the repository for Foundry distribution.
- Releases follow Semantic‑ish numbering: `<major>.<minor><patch>` where *minor* and *patch* are three‑digit sequences (allows CI bumping).

---

## 5 · Contribution Workflow

1. **Branch name**: `feature/<slug>` or `fix/<slug>`.
2. **Commit style**: Conventional commits (`feat:`, `fix:`, `chore:`).
3. **Pull Request template**: includes check‑boxes for localisation parity, version bump, ESLint pass.
4. **CI checks**:
   - ESLint + simple Jest tests (if present)
   - JSON schema validation for `system.json`, localisation files, and character templates.

---

## 6 · Code & Localisation Conventions

- **Copy‑paste‑ready code** — avoid line numbers or decorations that break direct copy.

- **Dual‑language localisation**: **any** new string **must** be added **simultaneously** to `en.json` *and* `ru.json` with identical keys.

  ```json
  // en.json
  "MY_RPG.RollTitle": "Might Check"

  // ru.json
  "MY_RPG.RollTitle": "Проверка Силы"
  ```

- **Naming**: camelCase for JS variables, kebab‑case for file names, UPPER\_SNAKE for Handlebars helpers.

- **Sheets**: built with plain HTML+Handlebars; keep markup semantic for accessibility.

- **No full re-render on edits**: Any change made through the character sheet (PC or NPC) should update the UI and derived values without triggering a full sheet re-render, unless a structural reflow is required. Prefer in-place DOM updates tied to `actor.update(..., { render: false })`, and refresh only the affected inputs/labels and computed fields (speed, defenses, health, etc.).

---

## 6.1 · Gear Balance Workspace

The `Gear balance/` folder is **not** part of the Foundry build. It is a local tooling workspace for simulations and data prep.

- **Source of truth:** `Андромеда_ Контент - Свойства (1).csv` defines the list of weapon properties.
- **Sync rule:** `Gear balance/weapons_sim.py` must include **all** properties from that CSV and **no extra** ones. If you add/remove/rename a property, update both files together.
- **Naming:** Preserve the exact property names (including `X`/`Х` suffixes).
- **Versioning:** Changes in `Gear balance/` **do not** require a `system.json` version bump.
- **Simulation rules mirror:** If you change the base simulation rules (rolls, actions, reactions, statuses, movement, damage), update the rules description in `Gear balance/sim_rules.py` in the same change.

Typical workflow:
1. Edit the CSV to change/add/remove a property.
2. Update `PROPERTY_DEFS` and any related logic in `weapons_sim.py`.
3. Run quick validation (e.g. `python -m py_compile "Gear balance/weapons_sim.py"`).

---

## 7 · AI Assistant-Specific Guidelines

> The maintainer is a **junior game‑designer** and **beginner programmer**.

1. **Double‑check** every technical suggestion before presenting it.
2. **Ask clarifying questions** whenever a requirement is ambiguous.
3. **Provide code** in a single contiguous block, ready for one‑click copy.
4. **Ensure RU + EN localisation** for any code that introduces UI text.
5. **Automatically bump version** (`system.json → version +0.001`) **only** when the change affects the Foundry system (see §4).
6. If adding or renaming a field that affects characteristics or skills, confirm the ability die step rules and absence of DEX.

7. When implementing sheet interactions, prioritize incremental updates: submit data with `render: false`, then update only the impacted parts of the DOM to reflect changes immediately. This applies equally to PCs and NPCs.
8. **Adhere to code style**: All generated or modified code must strictly follow the formatting rules defined in `.prettierrc.json` and the linting rules in `eslint.config.mjs`.
9. **Keep this document in sync**: When important mechanics or repository structure change, update AGENTS.md in the same change.

---

*Last updated: 2026‑01‑29*
