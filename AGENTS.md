<!-- Managed by agent: Codex | Last updated: 2026-07-20 | Last verified: 2026-07-20 -->
# Project Andromeda — Agent Guide

**Precedence:** direct user instructions win; among project files, the closest `AGENTS.md` wins; otherwise use this root file.

Work in Russian. Read the nearest scoped instructions before editing. Preserve unrelated user changes.

## Verified Commands

| Command | Purpose | Typical time |
|---|---|---:|
| `npm run check:all` | ESLint + Foundry tests + Quartz typecheck/tests | ~55 s |
| `npm run lint` | ESLint for the whole repository | ~5 s |
| `npm run test:foundry` | `node:test` for `module/` and `data/gear/` | ~2 s |
| `npm run check:quartz` | Quartz TypeScript check | ~10 s |
| `npm run test:quartz` | Quartz and rulebook tests | ~35 s |
| `npm run build:pack` | Build `packs/gear-library` | ~2 s; pack must be unlocked |

## Source Of Truth

| Area | Primary source |
|---|---|
| Mechanics, terminology, active design | `../Docs_Project_Andromeda/Документация/` |
| Reader-facing canonical rulebook | `../Docs_Project_Andromeda/Книга правил v0.4/` |
| Canonical content catalogs | `../Docs_Project_Andromeda/data/gear/catalog/` |
| Foundry runtime and UI | `module/`, `templates/`, `css/`, `lang/`, `assets/` |
| Current version and compatibility | `system.json` |
| Public rulebook and fallback catalogs | this repository; derived mirrors, not canon |

## Index of scoped AGENTS.md

- [`.quartz-site/AGENTS.md`](./.quartz-site/AGENTS.md) — Quartz sync, generated pages, routes, layout, and tests.
- [`module/AGENTS.md`](./module/AGENTS.md) — Foundry runtime, data invariants, sheets, helpers, and migrations.
- [`data/gear/AGENTS.md`](./data/gear/AGENTS.md) — public catalog mirror and compendium build.
- [`.github/workflows/AGENTS.md`](./.github/workflows/AGENTS.md) — release and Pages workflow safety.

## Skills And References

- `D:\Моя_НРИ\References` is mandatory, read-only reference material for creative and design decisions.
- Use `editing-andromeda-content` only for individual abilities, traits, archetypes, artifacts, and consumables inside accepted rules.
- Use `andromeda-game-design` for rules, subsystems, balance, progression, or content frameworks. If both apply, settle the model first, then write entities.

## Global Heuristics

| When | Do |
|---|---|
| Adding UI text | Add the same key to `lang/en.json` and `lang/ru.json` |
| Editing a sheet interaction | Prefer `actor.update(..., { render: false })` and refresh only affected DOM |
| Changing normal shipped Foundry files | Increment the fourth `system.json` version component |
| Making a major mechanical redesign | Increment the third component and reset the fourth; never change the release-line component without direct instruction |
| Editing only Quartz, docs, public mirrors, or private design tooling | Do not bump `system.json` |
| Changing canon or catalog content | Canon lives in the sibling private repo; rulebook mirrors sync via scripts, while `data/gear/catalog/` is a junction (same files — commit in both repos) |
| Adding a migration | Ask whether it must be one-time or repeatable before implementation |
| Creating a Codex branch | Use `codex/<slug>`; use Conventional Commits for commits |

## Boundaries

### Always

- Follow `.prettierrc.json`, `eslint.config.mjs`, and nearby tests; run checks proportional to the change.
- Keep stable identifiers, actor type keys, and persisted data compatible unless an approved migration changes them.
- Report conflicts between canon, structured data, and public mirrors before editing.

### Ask First

- A choice materially changes canon, migration semantics, public URLs, or the release line.
- The requested change belongs in another repository or needs destructive cleanup.

### Never

- Hand-edit `.quartz-site/public/` or generated rulebook pages.
- Treat public Quartz, the public rulebook mirror, or fallback catalogs as canonical while the private repo is available.
- Rewrite broad files for a narrow task, delete user-authored folders, or discard unrelated working-tree changes.
