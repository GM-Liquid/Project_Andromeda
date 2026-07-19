<!-- Managed by agent: Codex | Last updated: 2026-07-20 | Last verified: 2026-07-20 -->
# Quartz Rulebook Site

## Overview

Public rulebook sync, transformation, layout, and Pages build. Quartz presentation is derived from private canon and public fallbacks.

## Environment

- Node/npm requirements come from `.node-version` and `package.json#engines`.
- Commands may mirror sibling private sources and update generated/fallback files; inspect the working tree afterward.

## Commands

| Command | Working directory | Purpose |
|---|---|---|
| `npm run check:quartz` | repository root | TypeScript check |
| `npm run test:quartz` | repository root | Quartz/rulebook tests |
| `npm run sync-book` | `.quartz-site/` | Mirror sources and regenerate chapter content |
| `npm run build` | `.quartz-site/` | Sync and build `public/` |

## Patterns to Follow

| File | Responsibility |
|---|---|
| `scripts/rulebook.manifest.mjs` | Chapter order, slugs, heroes, page types, aliases |
| `scripts/rulebook-source.mjs` | Private source resolution and fallback |
| `scripts/gear-catalog-source.mjs` | Catalog source resolution and fallback |
| `scripts/sync-book.mjs` | Generated chapters/frontmatter/catalog output |
| `quartz.layout.ts` | Conditional page composition |
| `quartz/components/` | Navigation, hero, pager, TOC, interactions |
| `quartz/plugins/transformers/rulebookBlocks.ts` | Summary/cards/accordion syntax |
| `quartz/plugins/transformers/rulebookCatalog.ts` | JSON-backed catalog rendering |

## Conventions

- Prefer sibling `../Docs_Project_Andromeda`; use this repo's mirrors only when it is unavailable.
- `rulebook.manifest.mjs` owns public structure and ordering. Do not infer order from filenames.
- Generated `content/rulebook/` pages and `.generated-rulebook.json` may be replaced on sync.
- The public ../Книга правил v0.4/ mirror is replaced wholesale from the sibling source; keep persistent agent instructions here, not inside that mirror.
- Chapter 3 transforms canonical skills into accordions; chapter 4 combines canonical prose with JSON tables.
- Keep `concept-abilities.json` unpublished unless an explicit design decision changes the policy.
- Preserve old public slugs through aliases/redirects and report URL impact.

## Security

Publish only approved reader-facing rulebook/catalog data. Do not copy private design notes, unpublished catalogs, secrets, or unrelated sibling-repo files into Quartz output.

## Checklist

- Update nearest tests for source resolution, manifest output, frontmatter, catalogs, redirects, or custom blocks.
- Run targeted tests, then `npm run check:quartz` and `npm run test:quartz`.
- Run `npm run check:all` for public-catalog or Foundry-transform interactions.
- Inspect sync/build diffs for mirrored side effects.

## When stuck

- Treat the sibling private repo as canon and the public mirror as fallback.
- Do not hand-edit `public/`, generated chapter files, or catalog rows to bypass the pipeline.
- Keep editorial metadata in manifest/layout files, not mirrored rule text.
- Quartz-only changes never bump `system.json`.
