import { constants as fsConstants } from "node:fs"
import { access, cp, mkdir, rm } from "node:fs/promises"
import { dirname, resolve } from "node:path"

export const GEAR_CATALOG_DIRNAME = "data/gear/catalog"

const DOCS_REPO_DIRNAME = "Docs_Project_Andromeda"
const DOCS_REPO_ENV = "PROJECT_ANDROMEDA_DOCS_REPO"

async function pathExists(pathToCheck) {
  try {
    await access(pathToCheck, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function replaceDirectory(sourceDir, targetDir) {
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(dirname(targetDir), { recursive: true })
  await cp(sourceDir, targetDir, { recursive: true, force: true })
}

export function resolveGearCatalogPaths({ repoRoot, docsRepoRoot } = {}) {
  const resolvedRepoRoot = resolve(repoRoot ?? process.cwd())
  const resolvedDocsRepoRoot = docsRepoRoot
    ? resolve(docsRepoRoot)
    : process.env[DOCS_REPO_ENV]
      ? resolve(process.env[DOCS_REPO_ENV])
      : resolve(resolvedRepoRoot, "..", DOCS_REPO_DIRNAME)

  return {
    repoRoot: resolvedRepoRoot,
    docsRepoRoot: resolvedDocsRepoRoot,
    externalSourceDir: resolve(resolvedDocsRepoRoot, GEAR_CATALOG_DIRNAME),
    publicMirrorDir: resolve(resolvedRepoRoot, GEAR_CATALOG_DIRNAME),
  }
}

export async function prepareGearCatalogSource(options = {}) {
  const paths = resolveGearCatalogPaths(options)
  const externalAvailable = await pathExists(paths.externalSourceDir)

  if (externalAvailable) {
    await replaceDirectory(paths.externalSourceDir, paths.publicMirrorDir)
  }

  return {
    ...paths,
    externalAvailable,
    canonicalSourceDir: externalAvailable
      ? paths.externalSourceDir
      : paths.publicMirrorDir,
  }
}

export async function getGearCatalogWatchPattern(options = {}) {
  const paths = resolveGearCatalogPaths(options)
  const externalAvailable = await pathExists(paths.externalSourceDir)
  const watchDir = externalAvailable ? paths.externalSourceDir : paths.publicMirrorDir

  return resolve(watchDir, "*.json")
}
