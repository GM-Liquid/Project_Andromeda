import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises"
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

async function linkDirectory(sourceDir, targetDir) {
  await rm(targetDir, { recursive: true, force: true })
  await symlink(sourceDir, targetDir, process.platform === "win32" ? "junction" : "dir")
}

test("prepareRulebookSource mirrors the sibling docs repo into the public mirror", async () => {
  const { workspaceRoot, publicRepoRoot, docsRepoRoot } = await createTempRepos()

  try {
    const publicFile = resolve(
      publicRepoRoot,
      RULEBOOK_DIRNAME,
      "Глава 2. Создание персонажа.md",
    )
    const docsFile = resolve(
      docsRepoRoot,
      RULEBOOK_DIRNAME,
      "Глава 2. Создание персонажа.md",
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

test("prepareRulebookSource preserves a public mirror linked to the docs repo", async () => {
  const { workspaceRoot, publicRepoRoot, docsRepoRoot } = await createTempRepos()

  try {
    const publicBookDir = resolve(publicRepoRoot, RULEBOOK_DIRNAME)
    const docsBookDir = resolve(docsRepoRoot, RULEBOOK_DIRNAME)
    const chapterName = "Р“Р»Р°РІР° 2. РЎРѕР·РґР°РЅРёРµ РїРµСЂСЃРѕРЅР°Р¶Р°.md"

    await writeFile(resolve(docsBookDir, chapterName), "docs-linked", "utf8")
    await linkDirectory(docsBookDir, publicBookDir)

    const result = await prepareRulebookSource({
      repoRoot: publicRepoRoot,
      docsRepoRoot,
    })

    assert.equal(result.externalAvailable, true)
    assert.equal(await readFile(resolve(publicBookDir, chapterName), "utf8"), "docs-linked")
    assert.equal(
      (await realpath(publicBookDir)).toLowerCase(),
      (await realpath(docsBookDir)).toLowerCase(),
    )
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true })
  }
})

test("prepareRulebookSource falls back to the public mirror when the docs repo is missing", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "andromeda-rulebook-"))
  const publicRepoRoot = resolve(workspaceRoot, "Project Andromeda")
  const publicBookDir = resolve(publicRepoRoot, RULEBOOK_DIRNAME)

  await mkdir(publicBookDir, { recursive: true })

  const publicFile = resolve(publicBookDir, "Глава 2. Создание персонажа.md")
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
