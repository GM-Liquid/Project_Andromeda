# Local Rulebook Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically sync committed rulebook changes from `Docs_Project_Andromeda` into local `Project Andromeda`, rebuild Quartz output, and leave the result as uncommitted local changes in `Project Andromeda`.

**Architecture:** The tracked Node entry point `Docs_Project_Andromeda/scripts/publish-public.mjs` will own the sync/build logic. A thin local `post-commit` hook in `Docs_Project_Andromeda/.git/hooks/` will invoke that script with `--build` after every successful docs commit. `Project Andromeda` documentation will describe the local automation and the expectation that deployment still happens only after a later push from the public repo.

**Tech Stack:** Node.js, local Git hooks, existing Quartz npm scripts, existing sibling-repo rulebook sync flow

---

### Task 1: Extend the tracked publish script in private docs repo

**Files:**
- Modify: `D:/Моя_НРИ/Docs_Project_Andromeda/scripts/publish-public.mjs`
- Test: `D:/Моя_НРИ/Docs_Project_Andromeda/scripts/publish-public.test.mjs`

- [ ] **Step 1: Write a failing test for the new build mode**

```js
test("publishPublic builds the public repo when buildPublic is enabled", async () => {
  // create temp repos, call publishPublic({ buildPublic: true }),
  // assert the mirror was copied and the npm build command was requested
})
```

- [ ] **Step 2: Export CLI/helpers needed for test coverage**

```js
export const RULEBOOK_DIRNAME = "Книга правил v0.4"
export function parseArgs(argv) { /* add --build support */ }
export async function publishPublic(options) { /* add build mode */ }
```

- [ ] **Step 3: Add build mode without breaking the current default path**

```js
if (arg === "--build") {
  options.buildPublic = true
}
if (!options.syncBook && options.buildPublic) {
  throw new Error("--copy-only cannot be combined with --build.")
}
```

- [ ] **Step 4: Add a command runner for `npm --prefix .quartz-site run build`**

```js
async function runPublicBuild(publicRepoRoot, { commandRunner, npmCommand } = {}) {
  await commandRunner(
    npmCommand,
    ["--prefix", ".quartz-site", "run", "build"],
    { cwd: publicRepoRoot },
  )
}
```

- [ ] **Step 5: Re-run the test and confirm green**

```bash
node --test scripts/publish-public.test.mjs
```

### Task 2: Install local post-commit hook in private docs repo

**Files:**
- Create: `D:/Моя_НРИ/Docs_Project_Andromeda/.git/hooks/post-commit`

- [ ] **Step 1: Add a thin shell hook wrapper that calls the tracked script**

```sh
#!/bin/sh
repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root" || exit 1
node scripts/publish-public.mjs --build
```

- [ ] **Step 2: Fail clearly when the tracked script cannot be run**

```sh
if [ ! -f "$repo_root/scripts/publish-public.mjs" ]; then
  echo "publish-public.mjs not found in $repo_root/scripts" >&2
  exit 1
}
```

### Task 3: Document the local automation in the public repo

**Files:**
- Modify: `D:/Моя_НРИ/Project Andromeda/AGENTS.md`
- Modify: `D:/Моя_НРИ/Docs_Project_Andromeda/AGENTS.md`

- [ ] **Step 1: Update both AGENTS files to describe the local hook-backed flow**

```markdown
- `Docs_Project_Andromeda` may install a local `post-commit` hook that runs
  `node scripts/publish-public.mjs --build`.
- That local hook updates the public mirror and local Quartz build output in
  `Project Andromeda`.
- Deployment still requires a later commit/push from `Project Andromeda`.
```

### Task 4: Verify the end-to-end workflow

**Files:**
- Test: `D:/Моя_НРИ/Docs_Project_Andromeda/Книга правил v0.4/Создание персонажа.md`
- Test: `D:/Моя_НРИ/Project Andromeda/Книга правил v0.4/Создание персонажа.md`
- Test: `D:/Моя_НРИ/Project Andromeda/.quartz-site/content/rulebook/02-sozdanie-personazha.md`
- Test: `D:/Моя_НРИ/Project Andromeda/.quartz-site/public/rulebook/02-sozdanie-personazha.html`

- [ ] **Step 1: Trigger the tracked publish script manually once**

Run: `node scripts/publish-public.mjs --build`
Expected: mirror copy succeeds and Quartz build finishes successfully

- [ ] **Step 2: Confirm generated markdown contains the new skills section**

Run: `Select-String -Path '.quartz-site\content\rulebook\02-sozdanie-personazha.md' -Pattern 'Навык выбирается по тому|Мистика' -Encoding utf8`
Expected: matching lines are found

- [ ] **Step 3: Confirm built HTML contains the same section**

Run: `Select-String -Path '.quartz-site\public\rulebook\02-sozdanie-personazha.html' -Pattern 'Навык выбирается по тому|Мистика' -Encoding utf8`
Expected: matching lines are found

- [ ] **Step 4: Confirm the public repo remains dirty but uncommitted**

Run: `git status --short`
Expected: modified files in `Книга правил v0.4/`, `.quartz-site/content/rulebook/`, and `.quartz-site/public/` with no new commit created automatically
