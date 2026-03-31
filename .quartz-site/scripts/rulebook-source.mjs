import { constants as fsConstants } from "node:fs";
import { access, cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const RULEBOOK_DIRNAME = "Книга правил v0.4";

const DOCS_REPO_DIRNAME = "Docs_Project_Andromeda";
const DOCS_REPO_ENV = "PROJECT_ANDROMEDA_DOCS_REPO";

async function pathExists(pathToCheck) {
  try {
    await access(pathToCheck, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function replaceDirectory(sourceDir, targetDir) {
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(dirname(targetDir), { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true, force: true });
}

export function resolveRulebookPaths({ repoRoot, docsRepoRoot } = {}) {
  const resolvedRepoRoot = resolve(repoRoot ?? process.cwd());
  const resolvedDocsRepoRoot = docsRepoRoot
    ? resolve(docsRepoRoot)
    : process.env[DOCS_REPO_ENV]
      ? resolve(process.env[DOCS_REPO_ENV])
      : resolve(resolvedRepoRoot, "..", DOCS_REPO_DIRNAME);

  return {
    repoRoot: resolvedRepoRoot,
    docsRepoRoot: resolvedDocsRepoRoot,
    externalSourceDir: resolve(resolvedDocsRepoRoot, RULEBOOK_DIRNAME),
    publicMirrorDir: resolve(resolvedRepoRoot, RULEBOOK_DIRNAME),
  };
}

export async function prepareRulebookSource(options = {}) {
  const paths = resolveRulebookPaths(options);
  const externalAvailable = await pathExists(paths.externalSourceDir);

  if (externalAvailable) {
    await replaceDirectory(paths.externalSourceDir, paths.publicMirrorDir);
  }

  return {
    ...paths,
    externalAvailable,
    canonicalSourceDir: externalAvailable
      ? paths.externalSourceDir
      : paths.publicMirrorDir,
  };
}

export async function getRulebookWatchPattern(options = {}) {
  const paths = resolveRulebookPaths(options);
  const externalAvailable = await pathExists(paths.externalSourceDir);
  const watchDir = externalAvailable
    ? paths.externalSourceDir
    : paths.publicMirrorDir;

  return resolve(watchDir, "*.md");
}
