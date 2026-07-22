import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises"
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

async function linkDirectory(sourceDir, targetDir) {
  await rm(targetDir, { recursive: true, force: true })
  await symlink(sourceDir, targetDir, process.platform === "win32" ? "junction" : "dir")
}

test("prepareGearCatalogSource mirrors the sibling docs repo catalog into the public fallback", async () => {
  const { workspaceRoot, publicRepoRoot, docsRepoRoot } = await createTempRepos()

  try {
    const publicFile = resolve(publicRepoRoot, GEAR_CATALOG_DIRNAME, "artifacts.json")
    const docsFile = resolve(docsRepoRoot, GEAR_CATALOG_DIRNAME, "artifacts.json")

    await writeFile(publicFile, '{"items":[],"_meta":{"category":"artifacts"}}', "utf8")
    await writeFile(
      docsFile,
      '{"items":[{"id":"blackout","name":"Контур Блэкаут"}],"_meta":{"category":"artifacts"}}',
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
      '{"items":[{"id":"blackout","name":"Контур Блэкаут"}],"_meta":{"category":"artifacts"}}',
    )
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true })
  }
})

test("prepareGearCatalogSource preserves a public catalog linked to the docs repo", async () => {
  const { workspaceRoot, publicRepoRoot, docsRepoRoot } = await createTempRepos()

  try {
    const publicCatalogDir = resolve(publicRepoRoot, GEAR_CATALOG_DIRNAME)
    const docsCatalogDir = resolve(docsRepoRoot, GEAR_CATALOG_DIRNAME)

    await writeFile(
      resolve(docsCatalogDir, "artifacts.json"),
      '{"items":[{"id":"linked"}],"_meta":{"category":"artifacts"}}',
      "utf8",
    )
    await linkDirectory(docsCatalogDir, publicCatalogDir)

    const result = await prepareGearCatalogSource({
      repoRoot: publicRepoRoot,
      docsRepoRoot,
    })

    assert.equal(result.externalAvailable, true)
    assert.equal(
      await readFile(resolve(publicCatalogDir, "artifacts.json"), "utf8"),
      '{"items":[{"id":"linked"}],"_meta":{"category":"artifacts"}}',
    )
    assert.equal(
      (await realpath(publicCatalogDir)).toLowerCase(),
      (await realpath(docsCatalogDir)).toLowerCase(),
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

  const publicFile = resolve(publicCatalogDir, "artifacts.json")
  await writeFile(publicFile, '{"items":[{"id":"blackout"}],"_meta":{"category":"artifacts"}}', "utf8")

  try {
    const result = await prepareGearCatalogSource({
      repoRoot: publicRepoRoot,
      docsRepoRoot: resolve(workspaceRoot, "Docs_Project_Andromeda"),
    })

    assert.equal(result.externalAvailable, false)
    assert.equal(result.canonicalSourceDir, publicCatalogDir)
    assert.equal(
      await readFile(publicFile, "utf8"),
      '{"items":[{"id":"blackout"}],"_meta":{"category":"artifacts"}}',
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
