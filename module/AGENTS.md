<!-- Managed by agent: Codex | Last updated: 2026-07-20 | Last verified: 2026-07-20 -->
# Foundry Runtime

## Overview

ES-module runtime for Foundry VTT v12+ (verified v13). Inherit global versioning, localization, and canon rules from `../AGENTS.md`.

## Environment

- Runtime code is plain `.mjs`; sheets use Handlebars templates and shared CSS/lang files outside this scope.
- Foundry globals are not available in ordinary Node tests. Keep pure logic in helpers so it can be tested without Foundry.

## Commands

| Command | Purpose |
|---|---|
| `npm run test:foundry` | All Foundry-side `node:test` suites |
| `node --test module/helpers/<name>.test.mjs` | One helper test |
| `npm run lint` | Runtime and test style |

## Patterns to Follow

| Need | Golden source |
|---|---|
| Bootstrap and hooks | `project-andromeda.mjs` |
| Derived actor values | `documents/actor.mjs` + `documents/actor-derived-data.test.mjs` |
| Sheet interactions | `sheets/actor-sheet.mjs` |
| Actor defaults | `helpers/actor-types.mjs` + `config/character-defaults.mjs` |
| Skills/advancement | `helpers/skill-check.mjs` + `helpers/advancement-points.mjs` |
| Archetype lifecycle | `helpers/archetype.mjs` + archetype paths in `sheets/actor-sheet.mjs` |
| Library sync/cleanup | `helpers/item-library-sync.mjs` + its test |
| Catalog → Item transform | `helpers/gear-catalog.mjs` + its test |

## Conventions

- Internal actor keys stay `playerCharacter`, `minion`, `rankAndFile`, and `elite` until an approved migration.
- Keep formulas in documents/helpers, not duplicated across sheets/templates. Read current private canon before changing gameplay.
- Compatibility fields may have newer UI labels; do not rename persisted fields casually.
- Use `actor.update(..., { render: false })` and refresh affected DOM. Full renders are for structural reflow only.
- Shared library data propagates to links; actor-local `quantity`, `equipped`, and `cooldown` remain local.
- Compendium-linked items are read-only canon. World homebrew follows the folder/orphan lifecycle in `item-library-sync.mjs`.
- Ask whether migrations are one-time or repeatable. Do not mark gated work complete when prerequisites are missing.

## Security

Treat world documents and user-authored folders as user data. Do not mass-delete, overwrite, or move them outside an explicit migration or the tested orphan-cleanup lifecycle.

## Checklist

- Add/update the nearest `*.test.mjs` for helpers, transforms, startup tasks, migrations, or layout contracts.
- Add identical localization keys to `lang/en.json` and `lang/ru.json` for UI text.
- Run `npm run test:foundry`; use `npm run check:all` for cross-layer changes.
- Apply the root manifest version policy to shipped changes.

## When stuck

- Resolve rules/framework ambiguity with `andromeda-game-design`; do not invent canon in runtime code.
- Search nearby helpers/tests before adding a new utility or lifecycle hook.
- Report any required destructive migration or full-render exception before implementation.
