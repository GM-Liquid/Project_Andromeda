# Desloppify Backlog

Review date: 2026-06-25

Scope: static scan of the Foundry system runtime, item/actor sheets, gear catalog build path, Quartz rulebook publication pipeline, workflows, localization, ignored build artifacts, and local generated data.

No product code was changed during this scan. The worktree already had modified gear catalog JSON and mirrored rulebook files before this file was created.

## Current Verification Snapshot

- `npm run lint` passes.
- `npm test` fails in `data/gear/tests/catalog-format.test.mjs` because the currently modified `abilities`, `catalog-manifest`, and `equipment` catalogs are not in canonical two-space JSON formatting.
- `npm --prefix .quartz-site run check` passes.
- `npm --prefix .quartz-site run test:rulebook-source` passes.
- `npm --prefix .quartz-site run test:rulebook-blocks` fails because the current skills chapter no longer contains the exact required heading `### Что означают значения навыков`.
- Broader `.quartz-site/scripts/*.test.mjs` also fails through the same heading/parser/build dependency.
- `lang/en.json` and `lang/ru.json` have matching key sets: 402 leaf keys each.
- `packs/gear-library` exists locally as generated LevelDB output, but `git ls-files` confirms `packs/` is not tracked.

## Critical Issues

### C1. Release workflow publishes without running lint or tests

- **Where:** `.github/workflows/release.yml`
- **Why it matters:** The project guide says CI should run ESLint, tests, and JSON validation, but the release job currently installs dependencies, builds the pack, then creates a GitHub release. A broken test suite or lint regression can still become a published Foundry release.
- **Recommended change:** Add `npm run lint` and `npm test` before `npm run build:pack`. If catalog JSON schema validation is separate later, put it in the same pre-release gate.
- **Safe to fix now?** Yes. This is process-only and should not change runtime behavior. It may block releases until existing test failures are resolved, which is the point.

### C2. Item/rule descriptions can flow into rendered HTML without a clear sanitizer boundary

- **Where:** `module/sheets/actor-sheet.mjs` `_formatItemDescription` and `_buildItemChatContent`; `templates/actor/partials/item-group-section.hbs`; `templates/item/*-sheet.hbs`
- **Why it matters:** Plain text is escaped, but any value that already looks like HTML is returned as raw HTML and rendered with triple-stash in sheet details/chat content. Item sheet descriptions are also inserted into `<textarea>` with triple-stash. User-authored or imported item text containing unexpected tags, event handlers, or a `</textarea>` sequence can break layout or become an XSS-style problem inside Foundry.
- **Recommended change:** Define one allowlisted rich-text pipeline for item descriptions. Permit only the formatting tags the UI supports, such as `p`, `br`, `strong`, `em`, `s`, maybe `ul/li`, and sanitize before sheet detail rendering and chat output. Avoid triple-stash unless the value is known sanitized.
- **Safe to fix now?** Safe but should be handled carefully with regression tests and a quick Foundry/manual smoke test, because existing catalog descriptions may rely on limited HTML formatting.

### C3. Quartz build depends on exact Russian headings in chapter 3

- **Where:** `.quartz-site/scripts/skills-reference-source.mjs`; `.quartz-site/scripts/sync-book.mjs`; `Книга правил v0.4/Глава 3. Навыки.md`
- **Why it matters:** The current Quartz tests/build fail if the skills chapter heading text changes even slightly. This turns normal editorial wording changes into publication outages. The failure currently blocks tests with `Missing required heading: ### Что означают значения навыков`.
- **Recommended change:** Make the parser less brittle by using stable markers, manifest metadata, heading aliases, or a tolerant section finder with clear diagnostics. Add a test for the accepted heading variants or marker format.
- **Safe to fix now?** Wait until the current chapter-3 content changes are understood. The implementation fix is safe, but it should align with the intended canonical source shape.

## Medium Cleanup Items

### M1. Startup migrations and refreshes run as one unguarded sequence

- **Where:** `module/project-andromeda.mjs` ready hook; migration helpers in `module/project-andromeda.mjs` and `module/helpers/item-library-sync.mjs`
- **Why it matters:** A thrown error in an early migration can prevent later migrations, pack refresh, and cleanup work from running. Secondary GMs also call `purgeObsoleteCartridgeData`, while the main migration sequence is restricted to the primary active GM. That is easy to reason about now only because the sequence is short and familiar.
- **Recommended change:** Add a small migration runner that executes named steps, logs failures with step names, notifies GMs when a step fails, and continues or stops based on explicit step policy. Keep one-time migration version writes only after the step actually succeeds.
- **Safe to fix now?** Safe, but do it before adding more migrations. It touches startup behavior and should be tested in a GM world.

### M2. `module/project-andromeda.mjs` is becoming a catch-all runtime module

- **Where:** `module/project-andromeda.mjs` is about 1,600 lines and mixes init registration, chat actions, heroism, actor type context menus, migrations, environment-token drops, item library hooks, and session startup.
- **Why it matters:** The file is still navigable, but unrelated features now share the same import surface and ready hook. Future changes become harder to review because small features require scanning a large global hook file.
- **Recommended change:** Split by responsibility: `heroism-chat.mjs`, `actor-context-actions.mjs`, `environment-tokens.mjs`, `startup-migrations.mjs`, and `hook-registration.mjs` would be natural seams. Keep `project-andromeda.mjs` as orchestration only.
- **Safe to fix now?** Safe after current behavior is covered by tests or manual smoke checks. Best done incrementally, not as one giant refactor.

### M3. Actor sheet logic is too broad for one class

- **Where:** `module/sheets/actor-sheet.mjs` is about 1,900 lines.
- **Why it matters:** It handles rendering data, edit/play mode, skill advancement, stress/force-shield DOM mutation, rolling, item CRUD, item chat rendering, compendium browsing, and actor type changes. This increases the chance that a sheet UX change breaks item behavior or roll behavior.
- **Recommended change:** Extract pure builders first: item display model, skill/advancement view model, track DOM updater, and item chat content formatter. Keep the class as event wiring plus calls to helpers.
- **Safe to fix now?** Safe if done in small pieces with existing layout tests kept green. Do not mix with visual redesign work.

### M4. Item sheet templates and data builders repeat the same structure

- **Where:** `templates/item/generic-sheet.hbs`, `armor-sheet.hbs`, `weapon-sheet.hbs`, `cartridge-sheet.hbs`, `implant-sheet.hbs`; repeated `getData` setup in `module/sheets/item-sheet.mjs`
- **Why it matters:** Header markup, metadata grid, description textarea, and option-building logic are duplicated. A small accessibility, styling, or rich-text fix needs to be applied repeatedly.
- **Recommended change:** Create item-sheet partials for header, metadata fields, and description. In JS, add a shared function that attaches rank, skill, activation, defense, duration, target, and metadata field data.
- **Safe to fix now?** Yes. This is a good early cleanup task because behavior can remain identical and tests/lint should catch most mistakes.

### M5. Item type configuration carries legacy and current models in one large table

- **Where:** `module/helpers/item-config.mjs`; `template.json`
- **Why it matters:** Legacy item types are intentionally retained for migration compatibility, but they are interleaved with current authoring types. This makes it easy to accidentally expose or use migration-only types as normal content.
- **Recommended change:** Separate current authoring configs from legacy compatibility configs, or add an explicit `authorable: false` flag and derive creation choices only from authorable configs. Add a test that the sheet creation flow never offers legacy types.
- **Safe to fix now?** Safe, but coordinate with migration expectations. Do not remove legacy types from `template.json` until old-world compatibility is explicitly no longer needed.

### M6. Quartz sync script mixes parsing, rendering, catalog transforms, and filesystem writes

- **Where:** `.quartz-site/scripts/sync-book.mjs`
- **Why it matters:** The script is close to 1,000 lines and owns frontmatter generation, link rewriting, skills transformation, catalog rendering, table rendering, generated-state cleanup, and disk writes. The current heading failure shows how one parser assumption can block the entire publication pipeline.
- **Recommended change:** Extract catalog table rendering, source normalization, generated-state management, and filesystem sync into separate modules with focused tests. Keep `syncBook()` as the orchestrator.
- **Safe to fix now?** Safe after the current Quartz build failure is resolved or isolated. Refactor only one responsibility at a time.

### M7. Root project scripts do not expose the full validation matrix

- **Where:** `package.json`; `.quartz-site/package.json`
- **Why it matters:** `npm test` covers Foundry/runtime tests only. Quartz has its own checks and many additional tests, some of which are not under a single advertised command. It is easy to think the project is green when only one side was checked.
- **Recommended change:** Add root scripts such as `test:foundry`, `test:quartz`, and `check:all`. In `.quartz-site`, add a single `test` script that runs the rulebook script tests and TypeScript/tsx tests from the correct working directory.
- **Safe to fix now?** Yes, but expect it to reveal the existing Quartz failures until C3 is addressed.

### M8. Gear/catalog formatting checks are reactive rather than auto-fixable

- **Where:** `data/gear/tests/catalog-format.test.mjs`; `data/gear/catalog/*.json`
- **Why it matters:** The test catches non-canonical JSON formatting, but the current worktree already fails on formatting. Contributors need either a clearer command or a pre-commit/pre-build normalization step.
- **Recommended change:** Add a script like `npm run format:catalogs` that rewrites only gear catalog JSON with canonical two-space formatting and trailing newline. Document it in `docs/gear-catalog-sync.md`.
- **Safe to fix now?** Safe after confirming whether the current catalog edits should be preserved exactly. Do not run broad `npm run format` over the repo during unrelated work.

### M9. CSS is partly tokenized but still has a large monolithic override layer

- **Where:** `css/project-andromeda.css`; `css/ui-colors.css`; `css/ui-theme.css`
- **Why it matters:** Tokens exist, but `project-andromeda.css` still contains many raw fallbacks, absolute positioning, `!important` overrides, and feature-specific sections in one large file. Visual changes become harder to make without regressions.
- **Recommended change:** Split the stylesheet into focused files or clearly marked layers: Foundry reset/overrides, item sheets, actor HUD, item rows, tracks, dialogs. Gradually move raw colors/fallbacks into token files.
- **Safe to fix now?** Wait unless doing UI work. CSS refactors need browser/Foundry screenshots across actor types.

### M10. Rulebook and gear source mirroring duplicate nearly identical filesystem code

- **Where:** `.quartz-site/scripts/rulebook-source.mjs`; `.quartz-site/scripts/gear-catalog-source.mjs`
- **Why it matters:** Both modules resolve a sibling/private repo, compare real paths, replace public mirrors, and build watch patterns. Any bug fix in symlink handling or path safety must be made twice.
- **Recommended change:** Extract a shared mirror-source helper that accepts the dirname and file glob. Keep rulebook-specific and catalog-specific wrappers small.
- **Safe to fix now?** Yes, as long as both existing test files stay green.

### M11. Manual DOM refresh logic is detailed and easy to desync

- **Where:** `module/sheets/actor-sheet.mjs` `_onDerivedInputChange`, `_refreshDerived`, `_updateStressTrack`, `_updateForceShieldTrack`, `_refreshSkillRows`
- **Why it matters:** The project intentionally avoids full sheet re-renders, which is good for UX, but the DOM update contract is now hand-maintained. Adding a new derived value means updating prepareData, template fields, refresh methods, and tests in sync.
- **Recommended change:** Document a small "derived field refresh map" or helper that binds actor data paths to selectors/updaters. Add tests for the update helper where possible.
- **Safe to fix now?** Safe but lower urgency. Best paired with the next derived-stat change.

## Nice-To-Have Polish

### N1. `package.json` metadata is generic and partially misleading

- **Where:** `package.json`
- **Why it matters:** It says version `1.0.0`, license `ISC`, empty description, and `main: index.js`, while the Foundry system version/license live in `system.json` as `0.3.9.0` and CC BY-NC-SA 4.0. This can confuse contributors and tooling.
- **Recommended change:** Make package metadata intentionally non-published: set a real description, `private: true`, remove or correct `main`, and align the license field with the project license.
- **Safe to fix now?** Yes.

### N2. Quartz package metadata still shows upstream Quartz branding

- **Where:** `.quartz-site/package.json`
- **Why it matters:** It is not runtime-breaking, but contributors may not know whether this is a vendored Quartz app, a fork, or a project-specific publication package.
- **Recommended change:** Add project-specific scripts/README notes rather than changing upstream identity wholesale. At minimum, document that `.quartz-site` is a vendored/customized Quartz workspace.
- **Safe to fix now?** Safe, but low value unless onboarding confusion is common.

### N3. Existing tests include very presentation-specific assertions

- **Where:** `module/sheets/*layout.test.mjs`; `.quartz-site/scripts/*presentation*.test.mjs`
- **Why it matters:** These tests are useful guardrails, but some assert exact CSS/layout details. They can become noisy during intentional redesigns.
- **Recommended change:** Keep them, but label them as visual regression guardrails and group them under a named script. For larger redesigns, update them deliberately after screenshot verification.
- **Safe to fix now?** Wait until test script cleanup in M7.

### N4. Local ignored files can distract scans

- **Where:** local `.env`, `.npm-cache/`, `pip/`, `packs/`, `node_modules/`
- **Why it matters:** They are correctly ignored, but broad filesystem scans include them unless excluded. That slows reviews and can surface irrelevant noise.
- **Recommended change:** Keep ignoring them. For future audit scripts, default to `git ls-files` or `rg --files -g '!node_modules' -g '!packs' -g '!.npm-cache' -g '!pip'`.
- **Safe to fix now?** No code change needed.

### N5. Some UI behavior has no browser/Foundry smoke checklist

- **Where:** actor sheet stress/force-shield tracks, item creation mode dialog, compendium folder opening, shared GM heroism pool
- **Why it matters:** Unit/layout tests cover pieces, but several user-facing interactions depend on Foundry UI, compendium rendering, and multiple actor types.
- **Recommended change:** Add a short manual QA checklist in docs for shipped sheet changes: PC, minion, rank-and-file, elite, item creation, compendium browse, roll, heroism spend, and session summary.
- **Safe to fix now?** Yes. Documentation-only.

## Suggested Cleanup Order

1. **C1:** Add release lint/test gates.
2. **C3:** Decide whether chapter-3 source changed intentionally, then make the skills parser resilient.
3. **M7:** Add clear root and Quartz validation scripts.
4. **C2:** Sanitize rich item descriptions consistently.
5. **M4:** Extract item sheet partials/shared data builders.
6. **M1:** Add a guarded startup migration runner.
7. **M10:** Deduplicate mirror-source helpers.
8. **M8:** Add a focused catalog formatting command.
9. **M2/M3:** Start incremental runtime/sheet module extraction.
10. **M9:** Split CSS only when already touching UI.

