# Project Andromeda - AGENTS.md (AI Helper Guide)

> **Spec reference:** This document follows the [agentsmd.net specification](https://agentsmd.net/#what-is-agentsmd).  
> **Purpose:** Explain the structure, conventions, and extra rules an AI assistant (for example OpenAI Codex) must respect when working with this repository.

---

## 1. Project Snapshot

| Key fact                      | Value                                                           |
| ----------------------------- | --------------------------------------------------------------- |
| **System name**               | **Project Andromeda**                                           |
| **Foundry VTT compatibility** | v12 (minimum 12, verified 13)                                   |
| **Current version**           | `0.4.00.1`                                                      |
| **Current release line**      | `0.4.00.x`                                                      |
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
| data/
| '- gear/
|    '- catalog/ <- public fallback mirror of the canonical armor / equipment / abilities JSON catalogs plus the temporary concept-abilities source catalog kept available when the private repo is unavailable
| tools/
| '- build-pack.mjs <- compiles data/gear/catalog/*.json into the gear-library compendium pack
| packs/ <- built compendium packs (build artifact, gitignored); gear-library ships the gear catalog
| Книга правил v0.4/ <- public reader-facing rulebook mirror, refreshed from the private source repo
|
+- .quartz-site/
|  content/
|  | .generated-rulebook.json <- generated chapter file registry for Quartz sync
|  | assets/
|  |  '- rulebook/
|  |     '- art-core-1.webp
|  | '- rulebook/
|  |    | 01-vvedenie.md <- generated from the public mirror and also owns the root `/` redirect
|  |    | 02-sozdanie-personazha.md <- generated from the public mirror
|  |    | 03-navyki.md <- generated from the canonical `Глава 3. Навыки.md` source with Quartz accordion formatting and keeps the legacy `/rulebook/skills-reference/` alias
|  |    | 04-sposobnosti-i-snaryazhenie.md <- generated from the public mirror plus the canonical JSON gear catalogs
|  |    | 05-osnovnye-pravila.md <- generated from the public mirror and keeps the legacy `/rulebook/01-osnovnye-pravila/` alias
|  |    | 06-boy.md <- generated from the public mirror and keeps the legacy `/rulebook/04-boy/` alias
|  |    '- 07-peregovory.md <- generated from the public mirror and keeps the legacy `/rulebook/05-peregovory/` alias
|  quartz/
|  scripts/
|  | sync-book.mjs <- generates chapter pages from the public mirror
|  | rulebook-source.mjs <- resolves canonical rulebook source and mirrors sibling Docs_Project_Andromeda when available
|  | rulebook-source.test.mjs <- regression tests for source resolution / mirroring fallback
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
|  ui-fonts.css <- central Google Fonts imports and font-family tokens for the Foundry UI
|  ui-colors.css <- central raw palette and alpha color tokens for the Foundry UI
|  ui-theme.css <- semantic UI theme tokens that map fonts/colors onto shared component variables
|  project-andromeda.css
|
+- docs/
|  gear-catalog-sync.md <- notes about the gear-library compendium pack workflow
|
'- .github/
   workflows/
   release.yml
```

### 2.1 Public Rulebook & Quartz

- `Книга правил v0.4/` in this repository is a **public mirror**, not the canonical rules source. Canonical mechanics still live in the private source repo `Docs_Project_Andromeda`.
- `.quartz-site/scripts/sync-book.mjs` auto-detects a sibling `../Docs_Project_Andromeda/Книга правил v0.4/` (or `PROJECT_ANDROMEDA_DOCS_REPO`) and mirrors it into this repository before generating Quartz chapter pages.
- `.quartz-site/scripts/dev.mjs`, `.quartz-site/scripts/sync-book.mjs`, and `.quartz-site/package.json` build scripts all rely on the same source-resolution helper so local Quartz work reads from the canonical private-docs repo when it is available.
- `.quartz-site/scripts/gear-catalog-source.mjs` auto-detects a sibling `../Docs_Project_Andromeda/data/gear/catalog/` (or `PROJECT_ANDROMEDA_DOCS_REPO`) and mirrors the canonical armor, equipment, abilities, and temporary `concept-abilities` JSON catalogs into this repository before chapter generation.
- The sibling private repo may also install a local `post-commit` hook that runs `node scripts/publish-public.mjs --build` after commits in `Docs_Project_Andromeda`, updating this public mirror plus `.quartz-site/content/rulebook` and `.quartz-site/public` automatically on the local machine.
- `data/gear/catalog/` in this repository is a **public fallback mirror** for those canonical JSON catalogs so CI and GitHub Pages builds can still generate the chapter 04 catalogs without the private repo.
- If the private docs repo is unavailable, Quartz falls back to the mirrored `Книга правил v0.4/` inside this public repository so CI and GitHub Pages builds still work.
- If the private docs repo is unavailable, chapter 04 catalog generation also falls back to `data/gear/catalog/*.json` inside this public repository.
- That local hook is a convenience for the maintainer only. GitHub Pages still deploys only after the resulting changes are committed and pushed from this `Project Andromeda` repository.
- `.quartz-site/scripts/rulebook.manifest.mjs` is the single source of truth for public rulebook structure, ordering, summaries, hero settings, and which pages are generated versus hand-authored.
- `.quartz-site/content/` contains generated public rulebook pages under `.quartz-site/content/rulebook/`, including seven chapter pages where `03-navyki.md` is transformed from `Глава 3. Навыки.md` into Quartz accordions and keeps the legacy `/rulebook/skills-reference/` URL as an alias redirect.
- `.quartz-site/content/rulebook/04-sposobnosti-i-snaryazhenie.md` keeps the surrounding prose from the mirrored chapter, but its armor / equipment / abilities tables are generated from the canonical JSON catalogs during sync rather than hand-maintained in Markdown.
- `Docs_Project_Andromeda/data/gear/catalog/concept-abilities.json` is a removable canonical source catalog kept for curation / future reuse, but it is not appended to the public chapter 04 output during sync.
- `.quartz-site/content/.generated-rulebook.json` is generated state used by the sync pipeline. Do not hand-edit it unless you are explicitly changing sync internals.
- `.quartz-site/public/` is build output. Never edit it manually.

### 2.2 Current Quartz Publication Shape

- `/` is a redirect entry point that immediately forwards readers to `/rulebook/01-vvedenie/`.
- `/rulebook/` is intentionally **not** used as a separate landing page to avoid duplicating the home page.
- Main generated book chapters are published as `/rulebook/01-vvedenie/` through `/rulebook/07-peregovory/`.
- Legacy public URLs from the previous 5-chapter publication are preserved through Quartz aliases / redirect pages, including `/rulebook/skills-reference/`, `/rulebook/01-osnovnye-pravila/`, `/rulebook/03-sposobnosti-i-snaryazhenie/`, `/rulebook/04-boy/`, and `/rulebook/05-peregovory/`.
- The dedicated skills page is now the canonical chapter `/rulebook/03-navyki/`, not a standalone reference page outside the main chapter order.
- Rulebook navigation order comes from `rulebook.manifest.mjs`, not from filename sorting.
- The root redirect, editorial hero, left navigation, right-hand TOC, and previous/next pager are part of the Quartz presentation layer, not part of the game canon.

### 2.3 Where to Edit Quartz

- `.quartz-site/scripts/rulebook.manifest.mjs` when page order, hero metadata, summaries, page types, or generated/transformed rulebook boundaries change.
- `.quartz-site/scripts/sync-book.mjs`, `.quartz-site/scripts/skills-reference-source.mjs`, and `.quartz-site/scripts/rulebook-source.mjs` when the mapping between `Книга правил v0.4/Глава *.md` and generated Quartz pages changes, or when emitted frontmatter / private-docs mirroring / `03-navyki` accordion formatting changes.
- `.quartz-site/scripts/gear-catalog-source.mjs` when the canonical gear JSON source resolution or public fallback mirroring changes.
- `.quartz-site/scripts/rulebook-source.test.mjs` when the private-docs auto-mirror or fallback behaviour changes and needs regression coverage.
- `.quartz-site/scripts/gear-catalog-source.test.mjs` when the gear-catalog mirror or fallback behaviour changes and needs regression coverage.
- `.quartz-site/scripts/sync-book.test.mjs` when generated chapter output for JSON-backed rulebook catalogs changes and needs regression coverage.
- `Docs_Project_Andromeda/Книга правил v0.4/Глава 3. Навыки.md` when the published skills chapter text changes.
- `Docs_Project_Andromeda/data/gear/catalog/armor.json`, `Docs_Project_Andromeda/data/gear/catalog/equipment.json`, and `Docs_Project_Andromeda/data/gear/catalog/abilities.json` when the published chapter 04 catalog data changes.
- `Docs_Project_Andromeda/data/gear/catalog/concept-abilities.json` when the temporary source catalog itself changes, even though it is not currently published on the public Quartz site.
- `Docs_Project_Andromeda/Книга правил v0.4/Глава 4. Способности и снаряжение.md` when the surrounding prose, section framing, or explanatory text changes around those generated catalogs.
- `.quartz-site/quartz.layout.ts` when rulebook layout, sidebars, TOC placement, or conditional page composition change.
- `.quartz-site/quartz/components/` and `.quartz-site/quartz/styles/` when editorial hero/header/nav/pager behaviour, interaction logic, or styling change.
- `.quartz-site/quartz/plugins/transformers/rulebookBlocks.ts` when the custom `:::summary`, `:::cards`, or `:::accordion` authoring syntax changes.

### 2.4 Quartz Boundaries

- Do not treat the Quartz layout or the public rulebook mirror as canonical rules text.
- Do not bump `system.json` for Quartz-only, public-rulebook-only, or other non-shipped publication changes.
- Keep the public mirror in `Книга правил v0.4/` clean and reader-facing. Editorial-only structure, hero metadata, and navigation logic belong in Quartz manifest/layout/content files, not in the mirrored rule text unless the maintainer explicitly wants that coupling.
- Do not hand-maintain armor, equipment, or abilities table rows inside `Книга правил v0.4/Глава 4. Способности и снаряжение.md`; the canonical data belongs in `data/gear/catalog/*.json`, and Quartz regenerates those tables during sync.
- Treat the temporary `concept-abilities` catalog as Quartz-side curation material only. It is not canonical rules text, it is not currently rendered into the public chapter 04 output, and it may be deleted wholesale together with `data/gear/catalog/concept-abilities.json` when no longer needed.
- When changing routes, slugs, or emitted pages, check for duplicate pages created by both generated chapter output and hand-authored Quartz pages.
- Do not let `sync-book.mjs` overwrite hand-authored editorial pages if such pages are added later; generated/transformed pages such as `03-navyki.md` are allowed to be replaced on each sync.
- If a published page disappears or its slug changes, explicitly call out the old URL impact unless a redirect is added.

---

## 3. Data Model & Game Rules

### 3.1 Character and Skill Ranks

- Characters have ranks **1-4** and do not have characteristics.
- Skills remain grouped into the Body / Mind / Spirit categories used by the sheet, but those categories are not characteristics and have no independent values.
- Every skill stores `rank` (**1-4**) and `value` (**0-4**). A skill's rank cannot exceed `system.currentRank`, except the **archetype skill**, whose cap is `system.currentRank + 1` (so it can reach rank **5**).
- Raising a skill value by one step costs as many progression points as the skill's **current rank** (rank 1 → 1 point per step, rank 2 → 2, etc.). A full rank (value `0` → `4`) therefore costs `4 × rank`. Rolling a completed rank into the next one (`value 4` → `rank+1, value 0`) is **free**.
- The base set (all skills at rank 1, value 0) costs nothing. The archetype skill starts at rank **2**, value 0 for free — its progression cost is measured from that rank-2 baseline. Cost logic lives in `module/helpers/skill-check.mjs`; the spent total is summed in `module/helpers/advancement-points.mjs`.
- Defenses are **not** bought with progression points; see §3.5.
- No migration from the removed characteristic / legacy skill model is shipped; the new model targets new worlds on the experimental branch.

### 3.1a Archetypes

- An **archetype** is a single `archetype` Item type (`template.json`, `module/helpers/item-config.mjs`) dropped onto a player character from the shipped `gear-library` pack (folder **«Архетипы»**). It stays on the sheet and is the source of three things while present: the **archetype skill** (`system.skill`), the **defense profile** (`system.defenseProfile` = `{strong, medium, weak}` defense keys), and the **signature ability** (`system.abilitySyncId`, referencing a pack ability).
- The archetype's own `system.description` contains only the archetype concept text. Its signature ability is emitted as a separate linked ability item and is granted on drop.
- Dropping an archetype (`_onDropArchetype` in `module/sheets/actor-sheet.mjs`) replaces any existing archetype and the ability it previously granted, creates the compendium-linked archetype, grants the linked signature ability (flagged `flags.project-andromeda.grantedByArchetype`), and starts the archetype skill at rank 2. Archetypes only apply to `playerCharacter`.
- Removing an archetype reverts what it granted: `clearArchetypeEffects` deletes the granted ability, resets the archetype skill rank to the base (rank 1), and resets the three defenses to the rank default (defense = rank). This runs from the `deleteItem` hook on manual deletion (only for the acting user) and inline during a drop-replace (the replace delete passes `ARCHETYPE_SWAP_OPTION` so the hook does not double-run).
- Archetype helpers (resolve the actor's archetype, skill key, defense profile, rank bonus, derived defenses) live in `module/helpers/archetype.mjs`.
- Archetype content is authored in `data/gear/catalog/archetypes.json`; the build (`module/helpers/gear-catalog.mjs` + `tools/build-pack.mjs`) emits the archetype item into «Архетипы» and its embedded ability into «Способности».

### 3.2 Motivation & Complications

- Player-character identity uses **Motivation**, **Feature**, and one or more **Complications** instead of the former Values + Weakness presentation.
- For backwards compatibility, Motivation remains stored in `system.biography.weakness`, while Complications remain `trait` items with `system.details.personalityRole: "value"` and use the internal `personalityValues` item-group key.
- The personality tab presents Motivation and Feature first, followed by Complications, Temperament, and Appearance.

### 3.3 Skills

- Skill checks roll **2d8 + skill value**. Item-triggered checks use the same formula.
- The unshifted outcome table is: **8 or less = failure; 9-12 = success with a cost; 13-16 = success; 17+ = critical success**.
- **Failure with consequence** is the step below failure and is available only by shifting an outcome.
- Chat output immediately shows the unshifted outcome and the used skill rank. Players and GMs apply rank-versus-task shifts manually after the roll.
- Damage from weapons, abilities, and other damaging effects is stored and shown as four slash-separated values: **failure / success with a cost / success / critical success**. For example, `0/1/2/4` means 0 damage on failure, 1 on success with a cost, 2 on success, and 4 on critical success.

### 3.4 Points of Heroism (Highlight Points / Очки Свершений)

- `system.momentOfGlory` stores **Points of Heroism** (rulebook **Очки Свершений**, shown in EN UI as **Highlight Points**) and is the spendable heroism resource.
- **Economy:** a player character holds at most **3** points (`HERO_POINT_MAX`). Each player character gains **+1** point at the **start of a session** (capped at 3) via the `projectAndromeda.sessionStarted` hook, and loses any unspent points when the session **ends** (`projectAndromeda.sessionEnded`) because unused points do not carry over. The clamp to `[0, 3]` is enforced on every player-character update through a `preUpdateActor` hook plus `updateActorHeroPoints`, so the sheet input cannot exceed 3. Both session grants/clears run only on the **primary active GM**.
- **Spending — Improve outcome:** the only mechanical spend is a chat context-menu action **"Improve outcome"** on a skill-check message. It spends **1** point and raises the rolled outcome by **one step** (failure → success with a cost → success → critical success) by bumping the stored `skillCheck.shift`. It updates the original message in place (no reroll, no new card), cannot raise the outcome above critical success, and can be used at most **once per check** (guarded by the `flags.project-andromeda.momentOfGlory` spent flag). The other two book uses — **add a scene detail** and **remove a condition** — are narrative and handled by the GM manually decrementing the sheet value.
- **Earning:** points are awarded narratively by the GM (when a motivation/complication actually worsens the situation), via the manual sheet field. There is **no** automatic grant — the previous extreme-roll (min/max die face) auto-grant has been removed.
- **Player characters** use their own personal Points of Heroism pool.
- **GM characters** (minion, Standard, Boss) spend from a **shared GM heroism pool** (`GM_HERO_POOL_SETTING`) visible on all GM character sheets; it is uncapped and not governed by the player session economy. Internal actor type keys remain `minion`, `rankAndFile`, and `elite` unless an explicit migration is added later.
- Session tracking counts points of heroism spent per actor inside the active session window. Because "Improve outcome" updates the message in place, the spend is recorded via the `updateChatMessage` hook (`SessionStatsService.recordMomentOfGloryUsage`) rather than `createChatMessage`.
- A session starts automatically when at least one GM and all player users in the world are connected.
- An active session ends automatically after any required participant stays offline for more than **15 minutes**.

### 3.5 Stress Formulas

- The system has **four** actor character types: `playerCharacter`, `minion`, `rankAndFile`, and `elite`. The internal keys remain stable until the maintainer explicitly approves a migration.
- Player characters (`playerCharacter`, shown in UI as **Player Character** / **Персонаж игрока**) use stress **5 x rank** and support azure-stress marking on the stress track.
- Minions (`minion`, shown in UI as **Minion** / **Миньон**) use stress **3 x rank** and do **not** support azure-stress marking on the stress track.
- Standard characters (`rankAndFile`, shown in UI as **Standard** / **Стандартный**) use stress **7 x rank** and **do** support azure-stress marking on the stress track.
- Boss characters (`elite`, shown in UI as **Boss** / **Босс**) use stress **15** at rank 1 and **25 x (rank - 1)** at ranks 2-4, and do **not** support azure-stress marking on the stress track.
- Shipped Foundry actor defaults for stress, speed, and similar per-type parameters live in `module/config/character-defaults.mjs`.
- `system.temphealth` is presented as **temporary stress** for backwards compatibility and directly extends the base stress track. It may be positive or negative, but the resolved stress maximum never drops below 0.
- Armor force shield (`itemShield`) directly extends the total stress track like temporary stress.
- Maximum stress is formula-derived. For manual scene adjustments, GMs should use temporary stress (`system.temphealth`) rather than editing the derived maximum.
- Shipped defense labels use **Fortitude / Control / Will** in English and **Стойкость / Контроль / Воля** in Russian. The system keys are `fortitude`, `control`, and `will`.
- For a player character **with an archetype**, the three base defenses are **derived from rank + the archetype's defense profile** (strong = rank + 1, medium = rank, weak = rank − 1, never below 0) and the `system.defenses` inputs are locked (read-only) on the sheet. The derivation lives in `module/documents/actor.mjs` (`_resolveBaseDefenses`); the locked flag is `system.defensesLocked`.
- For GM actors (minion / Standard / Boss) and player characters **without** an archetype, `system.defenses` stays manually editable as before (no automatic formula).
- Temporary defense modifiers live in `system.tempfortitude`, `system.tempcontrol`, and `system.tempwill`. They may be positive or negative and produce derived effective defenses without overwriting the base `system.defenses` values. Armor bonuses still apply on top.

### 3.6 Movement Speed

- Base movement speed depends on `system.currentRank`: **10** at rank 1, **30** at rank 2, **100** at rank 3, **300** at rank 4, and **1000** at rank 5.
- Movement speed does **not** scale from abilities.
- Armor speed modifiers and `system.tempspeed` remain additive on top of that rank-based base value. `system.tempspeed` may be positive or negative.
- Movement speed is formula-derived. For manual scene adjustments, GMs should use temporary speed (`system.tempspeed`) rather than editing the derived speed.

### 3.7 Extreme Roll Reward (removed)

- Points of Heroism are no longer auto-granted for extreme rolls. The earlier rule that gave **1** point when a player-character roll showed a die at its minimum or maximum face has been removed; earning is now narrative/GM-driven (see §3.4).

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
- **Item library sync:** Character-sheet items that represent abilities, genomes, traits, or equipment stay linked to a corresponding library source via `flags.project-andromeda.libraryItemUuid`. The source is the shipped **`gear-library` compendium pack** for catalog content (read-only canon — see §6.2) or a **world-level Foundry item** for homebrew created on a sheet. A single library item may be linked to multiple actor items at once. Shared library data propagates to every linked actor item, while actor-local state such as `quantity` and `equipped` remains local. When the library-sync first creates the world item that backs a sheet-authored homebrew, it is filed into an **Items folder named after the owning actor** (flagged `flags.project-andromeda.actorItemFolder`), creating that folder on demand. Beyond that on-create filing, the system must not move already-foldered library items between folders, and must not create a duplicate world item when an actor item already links to a valid source. Deleting an actor item resyncs the world source's structure while other actor items still link to it; deleting the **last** linked actor item deletes the now-orphaned world source so no unused library item lingers. When that delete (or a manual delete from the Items directory) leaves one of those flagged per-character folders empty, the folder is removed too. Only system-created (flagged) folders are auto-removed — user-authored folders are never deleted. Compendium-linked actor items resolve to no world source, so none of this delete/cleanup logic touches the shipped pack.
- **Sheet item creation flow:** for item groups backed by the shipped catalog (weapons, armor, equipment/items, abilities), the sheet's `+` button first offers two choices — **Browse Compendium** (opens the `gear-library` pack expanded to that group's catalog folder, e.g. `Оружие` / `Броня` / `Предметы` / `Способности`) or **Create Item** (authors a new homebrew item). Groups without a catalog section (e.g. personality complications) skip the prompt and author directly. The group → catalog-folder mapping lives on `compendiumFolder` in `module/helpers/item-config.mjs` and must match the folder names emitted by `module/helpers/gear-catalog.mjs`.
- **Unified equipment type:** `equipment`, `equipment-consumable`, `implant`, and `cartridge` are treated as a unified equipment model. New content should use the `equipment` item type with `system.requiresRoll` and optional `system.skill`; legacy types are migration-only compatibility paths and are normalized during migration.
- **Unified trait type:** all non-genome, non-source-ability traits use the `trait` item type. Legacy `trait-*` subtypes remain migration-only compatibility paths and should not be used for new content.

---

## 6.1 Private Balance Tooling

Balance simulations and data-prep tooling live in the **private companion source repo**, not in this public Foundry repository.

- **Tracking:** do not recreate or commit a local `Gear balance/` workspace here. Keep balance tooling in the private repo under `tools/gear-balance/`.
- **Gear catalogs:** structured armor / equipment / abilities data for the public rulebook, plus the removable temporary `concept-abilities` catalog when it exists, live separately in the private repo under `data/gear/catalog/`; do not mix those canonical publication catalogs into `tools/gear-balance/`.
- **Versioning:** private balance-tooling changes do **not** require a `system.json` version bump unless they also modify shipped Foundry files in this repository.
- **Documentation:** if balance-tooling changes require Foundry-side workflow or documentation changes, update the tracked files in this repository separately.

---

## 6.2 Gear Catalog Foundry Sync (compendium model)

The shipped gear catalog lives in the **`gear-library` compendium pack**, built from JSON. Canon is edited in JSON between releases; the pack is regenerated at release and applied to campaigns only on a system update.

- **Source of truth:** `data/gear/catalog/armor.json`, `equipment.json`, `abilities.json`, and `archetypes.json` (mirrored from `Docs_Project_Andromeda/data/gear/catalog/` when the private repo is available). `concept-abilities.json` is never shipped. Each `archetypes.json` entry embeds its signature `ability`, which the build also emits into the «Способности» folder so the archetype's drop flow can link it as a compendium item.
- **Build step:** `tools/build-pack.mjs` (`npm run build:pack`, uses `classic-level`) compiles those JSON files into `packs/gear-library`, reusing the runtime `buildGearCatalogRemoteDataFromCatalogs` transform so the pack never drifts from the catalog. The pack is a **build artifact**: gitignored, built locally and in CI (`release.yml`), and copied into the release zip. The pack is registered in `system.json` `packs[]`.
- **Stable identity:** each pack item carries `flags.project-andromeda.sheetSyncId` (`gear:<catalog>:<id>`) and a `_id` derived deterministically from that sync id, so rebuilds keep the same compendium UUIDs and existing actor links survive.
- **Folder layout:** pack folders group items by type and rank (`Броня/Ранг N`, `Оружие/Ранг N`, `Предметы/Ранг N`, `Способности/Ранг N`; no valid rank → `Без ранга`). Archetypes live flat under `Архетипы` (no rank subfolder). The `equipment.json` catalog is split exactly like the public rulebook's two tables: weapon-skilled entries (`blizhniy_boy`/`strelba`) build real `weapon` items under `Оружие`, everything else stays `equipment` items (shown as **Предметы / Items**) under `Предметы`.
- **Actor links:** a character-sheet item links to its pack source via `flags.project-andromeda.libraryItemUuid` set to the `Compendium.…` UUID. Dropping a pack (or world) item onto an actor stamps this link in the sheet's `_onDropItem`, so it reuses the source instead of creating a folderless world duplicate.
- **Read-only canon:** compendium-linked items are canonical and read-only. A local edit on a character sheet stays local (it is never written back to the pack). On a system **version change**, `refreshCompendiumLinkedActorItems` pulls shared fields (name/img/system) down to every linked actor item while preserving local `quantity`/`equipped`/`cooldown`. Re-entering the world on an unchanged version touches nothing.
- **One-time migration:** `migrateActorLinksToCompendium` (gated by `packLinkMigrationVersion`) repoints actor items that still link to a legacy world catalog item — or carry a gear-catalog key — at the matching pack item. It is non-destructive. The opt-in `game.projectAndromeda.removeOrphanCatalogWorldItems({ dryRun })` cleans up leftover `gear:*` world items afterwards.
- **One-time weapon-type migration:** `migrateCatalogWeaponsToWeaponType` (gated by `weaponTypeMigrationVersion`) converts pre-existing actor items linked to a catalog entry that is now a `weapon` (catalog weapons used to import as `equipment`) into real `weapon` items, preserving the compendium link and local `quantity`/`equipped`/`cooldown`. A document's type is immutable, so it recreates the item and deletes the old one. It defers (without marking complete) when the pack is unavailable.
- **No world-item importer:** the old JSON→world-items importer and the Gear Catalog Sync app have been removed. `module/helpers/gear-catalog.mjs` now holds only the pure JSON→Item-system transform (consumed by `tools/build-pack.mjs`); there is no in-world import path. The pack is the only distribution path. Catalog content is edited in JSON and shipped via `npm run build:pack`.

---

## 7. AI Assistant-Specific Guidelines

> The maintainer is a **junior game-designer** and **beginner programmer**.

1. **Double-check** every technical suggestion before presenting it.
2. **Ask clarifying questions** whenever a requirement is ambiguous.
3. **Provide code** in a single contiguous block, ready for one-click copy.
4. **Ensure RU + EN localisation** for any code that introduces UI text.
5. **Bump `system.json` version according to the SemVer rules in Section 4** only when the change affects the shipped Foundry system.
6. If adding or renaming a skill field, preserve the rank **1-4**, value **0-4**, and skill-rank-to-character-rank cap rules.
7. When implementing sheet interactions, prioritize incremental updates: submit data with `render: false`, then update only the impacted parts of the DOM to reflect changes immediately. This applies equally to PCs and NPCs.
8. **Adhere to code style:** All generated or modified code must strictly follow the formatting rules defined in `.prettierrc.json` and the linting rules in `eslint.config.mjs`.
9. **Keep this document in sync:** When important mechanics, release rules, or repository structure change, update `AGENTS.md` in the same change.
10. Before adding a migration script or migration hook, explicitly ask whether that migration must be one-time or repeatable. Default to a one-time migration only after the maintainer confirms it. If a migration is one-time, wire it so it does not keep rerunning after completion.

---

_Last updated: 2026-06-28_
