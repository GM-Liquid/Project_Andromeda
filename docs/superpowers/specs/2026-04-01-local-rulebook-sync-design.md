# Local Rulebook Sync Design

Date: 2026-04-01
Status: Approved in chat and implemented locally

## Goal

Automate the local handoff from the private docs repository to the public
Foundry/Quartz repository so that:

1. The maintainer edits and commits rulebook content in
   `Docs_Project_Andromeda`.
2. That commit automatically updates the public mirror in
   `Project Andromeda`.
3. Quartz content and local site output are rebuilt automatically.
4. The resulting changes remain as ordinary uncommitted local changes in
   `Project Andromeda`.
5. The maintainer can then review, commit, and push `Project Andromeda` to
   trigger GitHub Pages deployment.

## Source of Truth

- Canonical source: `Docs_Project_Andromeda/Книга правил v0.4`
- Public mirror: `Project Andromeda/Книга правил v0.4`
- Generated content: `Project Andromeda/.quartz-site/content/rulebook`
- Local build output: `Project Andromeda/.quartz-site/public`

Rules:

- The private docs repo is the only source of truth.
- The public mirror in `Project Andromeda` may be overwritten by automation.
- Generated Quartz markdown in `.quartz-site/content/rulebook` may always be
  regenerated and overwritten.
- No automation should write back into `Docs_Project_Andromeda`.

## Trigger

Use a local `post-commit` git hook in `Docs_Project_Andromeda`.

The hook must run only after a successful commit in the private docs repo.
This intentionally avoids autosync on every file save while the maintainer is
still writing or revising a large text.

## Workflow

After a commit in `Docs_Project_Andromeda`, the hook will:

1. Resolve the sibling `Project Andromeda` repository from the parent
   directory.
2. Validate that both repositories and the canonical/public rulebook
   directories exist.
3. Copy `Docs_Project_Andromeda/Книга правил v0.4` into
   `Project Andromeda/Книга правил v0.4`, replacing the public mirror.
4. Run `node scripts/publish-public.mjs --build` from
   `Docs_Project_Andromeda`, which rebuilds the local Quartz site in
   `Project Andromeda`.
5. Exit with a clear success or failure message.

Expected result:

- `Project Andromeda/Книга правил v0.4` reflects the latest committed private
  docs state.
- `.quartz-site/content/rulebook` is regenerated from that mirror/source.
- `.quartz-site/public` is rebuilt for local preview.
- All resulting changes in `Project Andromeda` remain uncommitted.

## Repository Changes

Implementation should be split into:

1. Extend the tracked Node entry point
   `Docs_Project_Andromeda/scripts/publish-public.mjs` with a build mode that
   rebuilds the public Quartz site after refreshing the mirror.
2. A thin local `post-commit` hook in `Docs_Project_Andromeda/.git/hooks/`
   that invokes that tracked script. The hook file itself is local repository
   setup, not tracked project source.
3. Project documentation updates in `Project Andromeda/AGENTS.md` and
   `Docs_Project_Andromeda/AGENTS.md` so the local automation behavior is
   documented next to the existing publication/source-sync rules.

## Error Handling

The script should fail fast with readable messages when:

- `Project Andromeda` cannot be found as a sibling repository.
- The canonical rulebook directory is missing.
- The public mirror directory cannot be replaced.
- `node` is not available.
- The Quartz build fails.

Behavior on failure:

- The hook may leave partially updated files in `Project Andromeda`.
- It must not attempt rollback.
- It must not create commits or pushes in either repository.
- It must return a non-zero exit code so the failure is visible immediately.

## Safety Constraints

- No autosync on save.
- No autocommit in `Project Andromeda`.
- No autopush in either repository.
- No writes into private docs other than the user's own git commit flow.
- Generated `.quartz-site/content/rulebook` files are allowed to overwrite
  previous local state because they are derived output.

## Testing Strategy

Manual verification should confirm:

1. Edit a section in `Docs_Project_Andromeda/Книга правил v0.4`.
2. Commit the change in `Docs_Project_Andromeda`.
3. Observe hook output.
4. Confirm matching changes appear in
   `Project Andromeda/Книга правил v0.4`.
5. Confirm matching generated content appears in
   `Project Andromeda/.quartz-site/content/rulebook`.
6. Confirm rebuilt HTML appears in
   `Project Andromeda/.quartz-site/public`.
7. Confirm `git status` in `Project Andromeda` shows uncommitted local
   changes and no auto-created commit.

## Non-Goals

- Cross-repository GitHub Actions automation.
- Remote sync triggered directly by pushes to `Docs_Project_Andromeda`.
- Automatic commits in `Project Andromeda`.
- Automatic deployment without a later `Project Andromeda` push.
