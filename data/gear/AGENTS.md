<!-- Managed by agent: Codex | Last updated: 2026-07-20 | Last verified: 2026-07-20 -->
# Public Gear Catalog

## Overview

Public catalog used by CI, releases, Quartz, and `gear-library` pack builds. Canon lives in the sibling private repository; `data/gear/catalog/` is a **directory junction** onto it — both paths point to the same physical files, there is no file-copy sync step.

## Environment

- `data/gear/catalog/` is a junction to `../Docs_Project_Andromeda/data/gear/catalog/` — editing either path edits the same files, and both repositories' git see the change. Never write to both paths from a script: a per-entry transform would apply twice.
- Canonical schema: repository-root-relative `../Docs_Project_Andromeda/data/gear/schemas/gear-catalog.schema.json`.
- `packs/gear-library` is generated and gitignored. Close Foundry or any process holding its `LOCK` before building.

## Commands

| Command | Purpose |
|---|---|
| `npm run test:foundry` | Catalog format plus Foundry transform tests |
| `node --test data/gear/tests/catalog-format.test.mjs` | Catalog-only format check |
| `npm run build:pack` | Compile catalogs into `packs/gear-library` |

## Patterns to Follow

- Permanent catalogs: `abilities.json`, `archetypes.json`, `armor.json`, `equipment.json`, `traits.json`, and `catalog-manifest.json`.
- `concept-abilities.json` is temporary curation material; it is not packed or published.
- Use `mechanics.effects[]` for activation, conditions, and outcomes; keep descriptions consistent with structured mechanics.
- `module/helpers/gear-catalog.mjs` and its test are the shared JSON → Item transform and golden implementation.

## Conventions

- Catalog edits land in both repositories at once (junction); commit them in both, private first.
- Keep catalog roots as arrays except the manifest; follow the current schema and approved neighbors.
- Archetypes use `defenseProfile` plus an embedded versioned signature ability and are outside the generic gear schema.
- Preserve stable entry IDs. The build derives deterministic pack IDs and `flags.project-andromeda.sheetSyncId`.
- Do not add obsolete mirror fields or duplicate canonical mechanics into `quartz` overrides without a presentation need.
- Discover artifact/consumable models from current private docs; do not assume legacy equipment structure is approved.

## Security

Expose only catalogs explicitly intended for public shipping. Do not copy or junction private design notes, unpublished data, credentials, or unrelated files from the sibling repository.

## Checklist

- Use `editing-andromeda-content` for approved entities and `andromeda-game-design` for frameworks/systemic balance.
- Run private validation; inspect and commit the resulting diff in both repositories.
- Run catalog/transform tests and build the pack when it is unlocked.
- Apply the root manifest version policy when changed catalogs are intended for a shipped pack refresh.

## When stuck

- Remember the catalog is shared with the private repo via junction — a "public-only" catalog patch does not exist.
- Do not edit generated `packs/gear-library` directly or recreate a world-item importer.
- Do not rename IDs/types/catalogs without an approved migration.
- Keep persistent balance tooling in the private repo, never here.
