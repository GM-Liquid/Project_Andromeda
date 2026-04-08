import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test from "node:test"

import {
  GEAR_CATALOG_DIRNAME,
  getGearCatalogWatchPattern,
  prepareGearCatalogSource,
} from "./gear-catalog-source.mjs"

async function createTempRepos() {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "andromeda-gear-catalog-"))
  const publicRepoRoot = resolve(workspaceRoot, "Project Andromeda")
  const docsRepoRoot = resolve(workspaceRoot, "Docs_Project_Andromeda")

  await mkdir(resolve(publicRepoRoot, GEAR_CATALOG_DIRNAME), { recursive: true })
  await mkdir(resolve(docsRepoRoot, GEAR_CATALOG_DIRNAME), { recursive: true })

  return { workspaceRoot, publicRepoRoot, docsRepoRoot }
}

test("prepareGearCatalogSource mirrors the sibling docs repo catalog into the public fallback", async () => {
  const { workspaceRoot, publicRepoRoot, docsRepoRoot } = await createTempRepos()

  try {
    const publicFile = resolve(publicRepoRoot, GEAR_CATALOG_DIRNAME, "armor.json")
    const docsFile = resolve(docsRepoRoot, GEAR_CATALOG_DIRNAME, "armor.json")

    await writeFile(publicFile, '{"items":[],"_meta":{"category":"armor"}}', "utf8")
    await writeFile(
      docsFile,
      '{"items":[{"id":"kd-2","name":"КД-2"}],"_meta":{"category":"armor"}}',
      "utf8",
    )

    const result = await prepareGearCatalogSource({
      repoRoot: publicRepoRoot,
      docsRepoRoot,
    })

    assert.equal(result.externalAvailable, true)
    assert.equal(result.canonicalSourceDir, resolve(docsRepoRoot, GEAR_CATALOG_DIRNAME))
    assert.equal(
      await readFile(publicFile, "utf8"),
      '{"items":[{"id":"kd-2","name":"КД-2"}],"_meta":{"category":"armor"}}',
    )
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true })
  }
})

test("prepareGearCatalogSource falls back to the public catalog mirror when the docs repo is missing", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "andromeda-gear-catalog-"))
  const publicRepoRoot = resolve(workspaceRoot, "Project Andromeda")
  const publicCatalogDir = resolve(publicRepoRoot, GEAR_CATALOG_DIRNAME)

  await mkdir(publicCatalogDir, { recursive: true })

  const publicFile = resolve(publicCatalogDir, "armor.json")
  await writeFile(publicFile, '{"items":[{"id":"ozk"}],"_meta":{"category":"armor"}}', "utf8")

  try {
    const result = await prepareGearCatalogSource({
      repoRoot: publicRepoRoot,
      docsRepoRoot: resolve(workspaceRoot, "Docs_Project_Andromeda"),
    })

    assert.equal(result.externalAvailable, false)
    assert.equal(result.canonicalSourceDir, publicCatalogDir)
    assert.equal(
      await readFile(publicFile, "utf8"),
      '{"items":[{"id":"ozk"}],"_meta":{"category":"armor"}}',
    )
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true })
  }
})

test("getGearCatalogWatchPattern points to the active canonical catalog source", async () => {
  const { workspaceRoot, publicRepoRoot, docsRepoRoot } = await createTempRepos()

  try {
    const docsPattern = await getGearCatalogWatchPattern({
      repoRoot: publicRepoRoot,
      docsRepoRoot,
    })

    assert.equal(docsPattern, resolve(docsRepoRoot, GEAR_CATALOG_DIRNAME, "*.json"))

    await rm(docsRepoRoot, { recursive: true, force: true })

    const publicPattern = await getGearCatalogWatchPattern({
      repoRoot: publicRepoRoot,
      docsRepoRoot,
    })

    assert.equal(publicPattern, resolve(publicRepoRoot, GEAR_CATALOG_DIRNAME, "*.json"))
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true })
  }
})
