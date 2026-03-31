import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, "..");
const repoRoot = resolve(siteRoot, "..");

const sourceDir = resolve(repoRoot, "Книга правил v0.4");
const contentDir = resolve(siteRoot, "content");
const rulebookDir = resolve(contentDir, "rulebook");

const chapters = [
  {
    source: "Основные правила.md",
    target: "01-osnovnye-pravila.md",
    title: "Основные правила",
  },
  {
    source: "Создание персонажа.md",
    target: "02-sozdanie-personazha.md",
    title: "Создание персонажа",
  },
  {
    source: "Способности и снаряжение.md",
    target: "03-sposobnosti-i-snaryazhenie.md",
    title: "Способности и снаряжение",
  },
  {
    source: "Бой.md",
    target: "04-boy.md",
    title: "Бой",
  },
  {
    source: "Переговоры.md",
    target: "05-peregovory.md",
    title: "Переговоры",
  },
];

function formatDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function withFrontmatter({ title, created, modified }, body) {
  return [
    "---",
    `title: ${title}`,
    `created: ${created}`,
    `modified: ${modified}`,
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

function renderHomePage(chaptersToRender, pageDate) {
  const chapterLinks = chaptersToRender
    .map(
      (chapter) =>
        `1. [${chapter.title}](rulebook/${chapter.target.replace(/\.md$/, "")})`,
    )
    .join("\n");

  const body = [
    "Книга правил публикуется как цепочка отдельных страниц. Основные разделы доступны в левой панели.",
    "",
    "Начать удобнее сразу с нужной главы.",
    "",
    "## Читать по порядку",
    "",
    chapterLinks,
  ].join("\n");

  return withFrontmatter(
    {
      title: "Проект Андромеда",
      created: pageDate,
      modified: pageDate,
    },
    body,
  );
}

export async function syncBook() {
  await mkdir(contentDir, { recursive: true });
  await rm(rulebookDir, { recursive: true, force: true });
  await mkdir(rulebookDir, { recursive: true });

  let latestTimestamp = 0;
  const renderedChapters = [];

  for (const chapter of chapters) {
    const sourcePath = resolve(sourceDir, chapter.source);
    const targetPath = resolve(rulebookDir, chapter.target);
    const source = await readFile(sourcePath, "utf8");
    const sourceStats = await stat(sourcePath);
    const modified = formatDate(sourceStats.mtime);

    latestTimestamp = Math.max(latestTimestamp, sourceStats.mtimeMs);

    const generated = withFrontmatter(
      {
        title: chapter.title,
        created: modified,
        modified,
      },
      normalizeBody(source, chapter.title),
    );

    await writeFile(targetPath, generated, "utf8");
    renderedChapters.push(chapter);
  }

  const pageDate = formatDate(new Date(latestTimestamp || Date.now()));

  await writeFile(
    resolve(contentDir, "index.md"),
    renderHomePage(renderedChapters, pageDate),
    "utf8",
  );

  return {
    sourceDir,
    contentDir,
    generatedFiles: [
      resolve(contentDir, "index.md"),
      ...renderedChapters.map((chapter) =>
        resolve(rulebookDir, chapter.target),
      ),
    ],
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
