<!-- Managed by agent: Codex | Last updated: 2026-07-20 | Last verified: 2026-07-20 -->
# GitHub Workflows

## Overview

CI/CD for Foundry releases and the public Quartz site. These files can publish externally; keep triggers, permissions, and release boundaries explicit.

## Workflow files

| File | Trigger | Responsibility |
|---|---|---|
| `release.yml` | `main` pushes touching shipped/catalog/build paths | Test, build pack, package, create `v<system.version>` release |
| `deploy-rulebook.yml` | `main`/`master` pushes touching Quartz/rulebook paths; manual dispatch | Build and deploy GitHub Pages |

## Commands

| Command | Purpose |
|---|---|
| `npm run check:all` | Local superset of lint/tests/typecheck |
| `npm run build:pack` | Verify the compendium build used by release CI |
| `npm --prefix .quartz-site run build` | Reproduce the Pages build locally |

## Patterns to Follow

- Use Node 22 and clean `npm ci` installs.
- Foundry release order: lint → test → build pack → read version → reject existing tag → package → release.
- Pages order: checkout → configure → setup/cache → install → build → upload → deploy.
- Release tags equal `v<system.json version>` and must be new.

## Conventions

- Release output includes runtime/UI assets, built packs, manifests, README, and license—not Quartz/docs/private tooling/source catalogs.
- Catalog JSON is a build input; the release ships compiled `packs/gear-library`.
- Update release trigger filters and packaging lists together when shipped paths change.
- Keep the Pages working directory in `.quartz-site` and upload only `.quartz-site/public`.
- Keep action upgrades intentional and follow the repository's existing pinning style.

## Security

- Preserve least-privilege permissions and the Pages build → deploy dependency.
- Do not print secrets, broaden write permissions without need, or run untrusted fork code with release credentials.
- Review third-party action ownership and permissions before upgrades.

## Checklist

- Run relevant local commands before editing CI around a failing check.
- Confirm version/tag behavior for release changes and route/path behavior for Pages changes.
- Ensure packaged files and trigger filters match the intended shipped/public boundary.
- Workflow-only changes do not bump `system.json`; shipped behavior or packaging changes may.

## When stuck

- Do not weaken lint/test/tag guards to force a release through.
- Do not reuse or overwrite an existing release tag.
- Prefer reproducing the failing command locally; then fix the source or workflow with the smallest permission scope.
