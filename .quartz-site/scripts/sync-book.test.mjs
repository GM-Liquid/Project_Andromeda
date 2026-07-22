import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { syncBook } from './sync-book.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, '..');
const repoRoot = resolve(siteRoot, '..');
const catalogFixtureRepoRoot = repoRoot;

// Keep this test suite hermetic: syncBook must exercise the checked-in fallback
// mirrors rather than importing a maintainer's sibling private repository.
process.env.PROJECT_ANDROMEDA_DOCS_REPO = resolve(siteRoot, '.test-missing-docs-repo');

async function pathExists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSectionBody(document, heading) {
  const headingPattern = new RegExp(`^## ${escapeRegExp(heading)}$`, 'mu');
  const match = headingPattern.exec(document);

  if (!match) {
    return '';
  }

  const sectionStart = match.index + match[0].length + 1;
  const nextHeadingMatch = /^## /m.exec(document.slice(sectionStart));
  const sectionEnd = nextHeadingMatch ? sectionStart + nextHeadingMatch.index : document.length;

  return document.slice(sectionStart, sectionEnd);
}

test(
  'syncBook is idempotent when the fallback source is unchanged',
  { concurrency: false },
  async () => {
    const targetPath = resolve(siteRoot, 'content', 'rulebook', '02-sozdanie-personazha.md');
    const before = await readFile(targetPath, 'utf8');

    await syncBook();

    assert.equal(await readFile(targetPath, 'utf8'), before);
  }
);

test(
  'syncBook preserves line breaks in character sheet examples',
  { concurrency: false },
  async () => {
    const { generatedFiles } = await syncBook();
    const chapterPath = generatedFiles.find((filePath) =>
      filePath.endsWith('02-sozdanie-personazha.md')
    );

    assert.ok(chapterPath, 'expected the character creation chapter to be generated');

    const generated = await readFile(resolve(chapterPath), 'utf8');

    assert.match(
      generated,
      /\*\*Имя:\*\* \*Имя вашего персонажа\* {2}\n\*\*Ранг:\*\* 2 {2}\n\*\*Архетип:\*\* \*Стрелок\*/u
    );
    assert.match(
      generated,
      /\*\*Мотивация:\*\* {2}\n[ \t]*"Никого не бросать" {2}\n\*\*Осложнения:\*\* {2}\n[ \t]*"Хорошая тайна - это непреодолимый соблазн" {2}\n\*\*Навыки:\*\*/u
    );
  }
);

test(
  'syncBook publishes only the 0.5 chapter 04 catalogs',
  { concurrency: false },
  async () => {
    const { generatedFiles } = await syncBook();
    const chapterPath = generatedFiles.find((filePath) =>
      filePath.endsWith('04-sposobnosti-i-snaryazhenie.md')
    );

    assert.ok(chapterPath, 'expected the abilities and equipment chapter to be generated');

    const generated = await readFile(resolve(chapterPath), 'utf8');
    const abilitiesCatalog = JSON.parse(
      await readFile(resolve(repoRoot, 'data', 'gear', 'catalog', 'abilities.json'), 'utf8')
    );
    const artifactsCatalog = JSON.parse(
      await readFile(resolve(repoRoot, 'data', 'gear', 'catalog', 'artifacts.json'), 'utf8')
    );
    const traitsCatalog = JSON.parse(
      await readFile(resolve(repoRoot, 'data', 'gear', 'catalog', 'traits.json'), 'utf8')
    );
    const firstVisible = (items) =>
      items.find((item) => item.status !== 'draft' && item.status !== 'deprecated') ??
      items.find((item) => item.status !== 'deprecated');
    const ability = firstVisible(abilitiesCatalog);
    const artifact = firstVisible(artifactsCatalog);
    const trait = firstVisible(traitsCatalog);

    assert.ok(ability, 'expected a visible ability');
    assert.ok(artifact, 'expected a visible artifact');
    assert.ok(trait, 'expected a visible trait');

    assert.match(generated, /^## Черты$/m);
    assert.match(generated, /^## Способности$/m);
    assert.match(generated, /^## Артефакты$/m);
    assert.doesNotMatch(generated, /^## (?:Оружие|Броня|Снаряжение)$/m);
    assert.doesNotMatch(generated, /Цена в кредитах/u);
    assert.doesNotMatch(generated, /КД-2/u);

    assert.match(generated, /^\| Покупка \| Цена в очках развития \|$/m);
    assert.match(
      generated,
      /^\| Название \| Ранг \| Урон \| Эффекты \| Краткое описание \| Полное описание \| Частота использования \| Навык \| Цена в действиях \| Дальность \| Цели \| Зона \| Защита \| Длительность \| Цена в очках развития \|$/m
    );
    assert.match(
      generated,
      /^\| Название \| Ранг \| Урон \| Эффекты \| Краткое описание \| Полное описание \| Частота использования \| Цена в действиях \| Дальность \| Цели \| Зона \| Защита \| Длительность \|$/m
    );
    assert.match(
      generated,
      /^\| Название \| Ранг \| Навык \| Краткое описание \| Полное описание \| Цена в очках развития \|$/m
    );

    assert.match(getSectionBody(generated, 'Способности'), new RegExp(escapeRegExp(ability.name), 'u'));
    assert.match(getSectionBody(generated, 'Артефакты'), new RegExp(escapeRegExp(artifact.name), 'u'));
    assert.match(getSectionBody(generated, 'Черты'), new RegExp(escapeRegExp(trait.name), 'u'));
  }
);

test(
  'syncBook renders artifact usage from effect-scoped mechanics',
  { concurrency: false },
  async () => {
    const { generatedFiles } = await syncBook();
    const chapterPath = generatedFiles.find((filePath) =>
      filePath.endsWith('04-sposobnosti-i-snaryazhenie.md')
    );

    assert.ok(chapterPath, 'expected the abilities and equipment chapter to be generated');

    const generated = await readFile(resolve(chapterPath), 'utf8');
    const artifactRow = generated
      .split(/\r?\n/u)
      .find((line) => line.includes('| Контур «Блэкаут» |'));

    assert.match(
      artifactRow ?? '',
      /^\| Контур «Блэкаут» \| 1 \|  \|  \| .* \| .* \|  \| Действие \| 30 м \|  \| Круг, диаметр 15 м \|  \| До конца сцены \|$/u
    );
  }
);

test('public 0.5 catalogs do not keep legacy rule text inside mechanics effects', async () => {
  const catalogNames = ['abilities', 'artifacts', 'traits', 'concept-abilities'];
  const offenders = [];

  for (const catalogName of catalogNames) {
    const items = JSON.parse(
      await readFile(resolve(repoRoot, 'data', 'gear', 'catalog', `${catalogName}.json`), 'utf8')
    );

    for (const item of items) {
      for (const effect of item.mechanics?.effects ?? []) {
        if (effect?.key === 'legacyRuleText') {
          offenders.push(`${catalogName}:${item.id}`);
        }
      }
    }
  }

  assert.deepEqual(offenders, []);
});
test(
  'syncBook leaves concept abilities unpublished even when the shared gear catalog source provides them',
  { concurrency: false },
  async () => {
    const quartzConceptPath = resolve(siteRoot, 'data', 'temporary', 'concept-abilities.json');
    const quartzConceptBackupPath = resolve(
      siteRoot,
      'data',
      'temporary',
      'concept-abilities.json.codex-backup'
    );
    const docsConceptPath = resolve(
      catalogFixtureRepoRoot,
      'data',
      'gear',
      'catalog',
      'concept-abilities.json'
    );
    const docsConceptBackupPath = resolve(
      catalogFixtureRepoRoot,
      'data',
      'gear',
      'catalog',
      'concept-abilities.json.codex-backup'
    );
    const quartzConceptExists = await pathExists(quartzConceptPath);
    const docsConceptExists = await pathExists(docsConceptPath);

    const conceptCatalog = [
      {
        id: 'testovyi-kontsept',
        name: 'Тестовый концепт',
        type: 'ability',
        rank: 1,
        skill: 'Мистика',
        properties: [],
        description: 'Полное описание тестовой концепт-способности.',
        shortDescription: 'Краткое описание тестовой концепт-способности.',
        tags: [],
        finalCost: 777,
        status: 'legacy',
        usage: {
          frequency: '1/сцену',
          actions: 'Основное',
          range: '15 м',
          targets: '2 цели',
          area: '',
          defense: 'Стойкость',
          duration: '2 раунда'
        },
        quartz: {
          previewDescription: 'Краткое описание тестовой концепт-способности.',
          fullDescription: 'Полное описание тестовой концепт-способности.',
          skill: 'Старый навык',
          frequency: '1/сессию',
          actions: 'Реакция',
          range: '30 м',
          targets: '1 цель',
          area: '',
          defense: 'Воля',
          duration: '1 мин',
          credits: ''
        }
      }
    ];

    if (quartzConceptExists) {
      await rename(quartzConceptPath, quartzConceptBackupPath);
    }

    if (docsConceptExists) {
      await rename(docsConceptPath, docsConceptBackupPath);
    }

    await writeFile(docsConceptPath, `${JSON.stringify(conceptCatalog, null, 2)}\n`, 'utf8');

    try {
      const { generatedFiles } = await syncBook();
      const chapter04Path = generatedFiles.find((filePath) =>
        filePath.endsWith('04-sposobnosti-i-snaryazhenie.md')
      );

      assert.ok(chapter04Path, 'expected the abilities and equipment chapter to be generated');

      const chapter04 = await readFile(resolve(chapter04Path), 'utf8');

      assert.match(chapter04, /^## Способности$/m);
      assert.doesNotMatch(chapter04, /^## Концепт-способности$/m);
      assert.doesNotMatch(chapter04, /Тестовый концепт/u);
      assert.doesNotMatch(chapter04, /Временный каталог идей и устаревших версий способностей/u);
    } finally {
      await rm(docsConceptPath, { force: true });

      if (docsConceptExists) {
        await rename(docsConceptBackupPath, docsConceptPath);
      }

      if (quartzConceptExists) {
        await rename(quartzConceptBackupPath, quartzConceptPath);
      } else {
        await rm(quartzConceptBackupPath, { force: true });
      }
    }
  }
);

test(
  'syncBook keeps concept abilities out of both chapter 04 and chapter 06',
  { concurrency: false },
  async () => {
    const sourceChapter = await readFile(
      resolve(repoRoot, 'Книга правил v0.4', 'Глава 4. Способности и снаряжение.md'),
      'utf8'
    );

    assert.doesNotMatch(sourceChapter, /^## Концепт-способности$/m);

    const { generatedFiles } = await syncBook();
    const chapter04Path = generatedFiles.find((filePath) =>
      filePath.endsWith('04-sposobnosti-i-snaryazhenie.md')
    );
    const chapter06Path = generatedFiles.find((filePath) => filePath.endsWith('06-boy.md'));

    assert.ok(chapter04Path, 'expected the abilities and equipment chapter to be generated');
    assert.ok(chapter06Path, 'expected the combat chapter to be generated');

    const chapter04 = await readFile(resolve(chapter04Path), 'utf8');
    const chapter06 = await readFile(resolve(chapter06Path), 'utf8');

    assert.doesNotMatch(chapter04, /^## Концепт-способности$/m);
    assert.doesNotMatch(chapter04, /Временный каталог идей и устаревших версий способностей/u);
    assert.doesNotMatch(chapter04, /^\|.*Болевой шок.*\|$/m);
    assert.doesNotMatch(chapter06, /^## Концепт-способности$/m);
  }
);
