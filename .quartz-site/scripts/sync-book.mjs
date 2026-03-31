import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getGeneratedRulebookEntries,
  slugToContentPath,
  validateRulebookManifest,
} from "./rulebook.manifest.mjs";
import { prepareRulebookSource } from "./rulebook-source.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, "..");
const repoRoot = resolve(siteRoot, "..");

const contentDir = resolve(siteRoot, "content");
const rulebookDir = resolve(contentDir, "rulebook");
const generatedStatePath = resolve(contentDir, ".generated-rulebook.json");

function formatDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function serializeFrontmatterValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (value === null) {
    return "null";
  }

  return String(value);
}

function withFrontmatter(frontmatter, body) {
  return [
    "---",
    ...Object.entries(frontmatter).map(
      ([key, value]) => `${key}: ${serializeFrontmatterValue(value)}`,
    ),
    "---",
    "",
    body.trimEnd(),
    "",
  ].join("\n");
}

function normalizeBody(body, title) {
  const cleaned = body.replace(/^\uFEFF/, "").trim();

  if (!cleaned) {
    return "TODO: раздел пока в подготовке.";
  }

  if (title === "Бой") {
    return cleaned.replace(
      /\[Основные правила\]\(\)/g,
      "[Основные правила](01-osnovnye-pravila)",
    );
  }

  return cleaned;
}

async function readGeneratedState() {
  try {
    const raw = await readFile(generatedStatePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeGeneratedState(generatedFiles) {
  await writeFile(
    generatedStatePath,
    `${JSON.stringify(generatedFiles, null, 2)}\n`,
    "utf8",
  );
}

export async function syncBook() {
  const chapters = await validateRulebookManifest();
  const generatedEntries = getGeneratedRulebookEntries();
  const source = await prepareRulebookSource({ repoRoot });
  const sourceDir = source.canonicalSourceDir;

  await mkdir(contentDir, { recursive: true });
  await mkdir(rulebookDir, { recursive: true });

  const previouslyGenerated = await readGeneratedState();
  const nextGeneratedFiles = [];

  for (const chapter of generatedEntries) {
    const sourcePath = resolve(sourceDir, chapter.source);
    const targetRelativePath = slugToContentPath(chapter.slug);
    const targetPath = resolve(contentDir, targetRelativePath);
    const source = await readFile(sourcePath, "utf8");
    const sourceStats = await stat(sourcePath);
    const modified = formatDate(sourceStats.mtime);

    const generated = withFrontmatter(
      {
        title: chapter.title,
        navTitle: chapter.navTitle,
        order: chapter.order,
        pageType: chapter.pageType,
        summary: chapter.summary,
        heroImage: chapter.heroImage,
        heroAlt: chapter.heroAlt,
        showHero: chapter.showHero,
        showToc: chapter.showToc,
        parent: chapter.parent,
        created: modified,
        modified,
      },
      normalizeBody(source, chapter.title),
    );

    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, generated, "utf8");
    nextGeneratedFiles.push(targetRelativePath);
  }

  for (const previousFile of previouslyGenerated) {
    if (nextGeneratedFiles.includes(previousFile)) {
      continue;
    }

    await rm(resolve(contentDir, previousFile), { force: true });
  }

  await writeGeneratedState(nextGeneratedFiles);

  return {
    sourceDir,
    mirrorDir: source.publicMirrorDir,
    externalSourceDir: source.externalSourceDir,
    externalAvailable: source.externalAvailable,
    contentDir,
    manifest: chapters,
    generatedFiles: nextGeneratedFiles.map((file) => resolve(contentDir, file)),
  };
}

const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const {
    sourceDir: source,
    contentDir: target,
    generatedFiles,
  } = await syncBook();
  console.log(`Synced ${source} -> ${target}`);
  console.log(`Generated ${generatedFiles.length} files.`);
}
