import { promises as fsPromises, watch as fsWatch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const rulebookDir = path.resolve(repoRoot, '..', 'Docs_Project_Andromeda', 'Книга правил');
const targetReadme = path.join(repoRoot, 'README.md');
const isWatchMode = process.argv.includes('--watch');

function parseVersionParts(fileName) {
  const match = fileName.match(/v(\d+(?:\.\d+)*)/i);

  if (!match) {
    return null;
  }

  return match[1].split('.').map((part) => Number.parseInt(part, 10));
}

function compareVersions(left, right) {
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);

    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

async function resolveSourceRulebook() {
  const entries = await fsPromises.readdir(rulebookDir, { withFileTypes: true });
  const markdownFiles = entries.filter(
    (entry) =>
      entry.isFile() &&
      path.extname(entry.name).toLowerCase() === '.md' &&
      entry.name.toLowerCase() !== 'readme.md'
  );

  if (markdownFiles.length === 0) {
    throw new Error(`Не найден ни один Markdown-файл книги правил в "${rulebookDir}".`);
  }

  const versionedFiles = markdownFiles
    .map((entry) => ({ entry, version: parseVersionParts(entry.name) }))
    .filter((candidate) => candidate.version !== null)
    .sort((left, right) => {
      const versionDelta = compareVersions(right.version, left.version);

      if (versionDelta !== 0) {
        return versionDelta;
      }

      return left.entry.name.localeCompare(right.entry.name, 'ru');
    });

  if (versionedFiles.length > 0) {
    return path.join(rulebookDir, versionedFiles[0].entry.name);
  }

  if (markdownFiles.length > 1) {
    const fileList = markdownFiles.map((entry) => entry.name).join(', ');
    throw new Error(
      `Найдено несколько Markdown-файлов книги правил без версии в имени: ${fileList}.`
    );
  }

  return path.join(rulebookDir, markdownFiles[0].name);
}

async function syncReadme() {
  const sourceRulebook = await resolveSourceRulebook();
  const sourceContent = await fsPromises.readFile(sourceRulebook, 'utf8');

  let currentReadme = '';

  try {
    currentReadme = await fsPromises.readFile(targetReadme, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  if (currentReadme === sourceContent) {
    console.log(`README уже синхронизирован с "${path.basename(sourceRulebook)}".`);
    return;
  }

  await fsPromises.writeFile(targetReadme, sourceContent, 'utf8');
  console.log(`README синхронизирован из "${sourceRulebook}".`);
}

function watchRulebook() {
  let syncTimer = null;
  let syncQueue = Promise.resolve();

  const queueSync = () => {
    syncQueue = syncQueue
      .then(() => syncReadme())
      .catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
      });
  };

  const watcher = fsWatch(rulebookDir, { persistent: true }, (_eventType, fileName) => {
    if (fileName && path.extname(fileName).toLowerCase() !== '.md') {
      return;
    }

    clearTimeout(syncTimer);
    syncTimer = setTimeout(queueSync, 150);
  });

  const closeWatcher = () => {
    watcher.close();
    process.exit(0);
  };

  process.on('SIGINT', closeWatcher);
  process.on('SIGTERM', closeWatcher);

  console.log(`Слежение включено: "${rulebookDir}" -> "${targetReadme}".`);
}

try {
  await syncReadme();

  if (isWatchMode) {
    watchRulebook();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
