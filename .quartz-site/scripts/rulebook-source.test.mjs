import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test from "node:test"

import { prepareRulebookSource, RULEBOOK_DIRNAME } from "./rulebook-source.mjs"

async function createTempRepos() {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "andromeda-rulebook-"))
  const publicRepoRoot = resolve(workspaceRoot, "Project Andromeda")
  const docsRepoRoot = resolve(workspaceRoot, "Docs_Project_Andromeda")

  await mkdir(resolve(publicRepoRoot, RULEBOOK_DIRNAME), { recursive: true })
  await mkdir(resolve(docsRepoRoot, RULEBOOK_DIRNAME), { recursive: true })

  return { workspaceRoot, publicRepoRoot, docsRepoRoot }
}

test("prepareRulebookSource mirrors the sibling docs repo into the public mirror", async () => {
  const { workspaceRoot, publicRepoRoot, docsRepoRoot } = await createTempRepos()

  try {
    const publicFile = resolve(
      publicRepoRoot,
      RULEBOOK_DIRNAME,
      "Создание персонажа.md",
    )
    const docsFile = resolve(
      docsRepoRoot,
      RULEBOOK_DIRNAME,
      "Создание персонажа.md",
    )

    await writeFile(publicFile, "public-old", "utf8")
    await writeFile(docsFile, "docs-new", "utf8")

    const result = await prepareRulebookSource({
      repoRoot: publicRepoRoot,
      docsRepoRoot,
    })

    assert.equal(result.externalAvailable, true)
    assert.equal(
      result.canonicalSourceDir,
      resolve(docsRepoRoot, RULEBOOK_DIRNAME),
    )
    assert.equal(await readFile(publicFile, "utf8"), "docs-new")
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true })
  }
})

test("prepareRulebookSource falls back to the public mirror when the docs repo is missing", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "andromeda-rulebook-"))
  const publicRepoRoot = resolve(workspaceRoot, "Project Andromeda")
  const publicBookDir = resolve(publicRepoRoot, RULEBOOK_DIRNAME)

  await mkdir(publicBookDir, { recursive: true })

  const publicFile = resolve(publicBookDir, "Создание персонажа.md")
  await writeFile(publicFile, "public-current", "utf8")

  try {
    const result = await prepareRulebookSource({
      repoRoot: publicRepoRoot,
      docsRepoRoot: resolve(workspaceRoot, "Docs_Project_Andromeda"),
    })

    assert.equal(result.externalAvailable, false)
    assert.equal(result.canonicalSourceDir, publicBookDir)
    assert.equal(await readFile(publicFile, "utf8"), "public-current")
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true })
  }
})
