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
const docsRepoRoot = resolve(repoRoot, '..', 'Docs_Project_Andromeda');

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
      /\*\*Ценности:\*\* {2}\n[ \t]*"Никого не бросать" {2}\n[ \t]*"Истина важнее комфорта" {2}\n\*\*Характеристики:\*\*/u
    );
  }
);

test(
  'syncBook injects chapter 04 gear catalogs from JSON sources instead of authored markdown tables',
  { concurrency: false },
  async () => {
    const sourceChapter = await readFile(
      resolve(repoRoot, 'Книга правил v0.4', 'Глава 4. Способности и снаряжение.md'),
      'utf8'
    );

    assert.doesNotMatch(sourceChapter, /^\|.*(?:Название|Тип|Краткое описание).*\|$/m);

    const { generatedFiles } = await syncBook();
    const chapterPath = generatedFiles.find((filePath) =>
      filePath.endsWith('04-sposobnosti-i-snaryazhenie.md')
    );

    assert.ok(chapterPath, 'expected the abilities and equipment chapter to be generated');

    const generated = await readFile(resolve(chapterPath), 'utf8');

    assert.match(
      generated,
      /^\| Название \| Ранг \| Стойкость \| Контроль \| Воля \| Силовой щит \| Скорость \| Частота использования \| Цена в действиях \| Длительность \| Краткое описание \| Полное описание \| Цена \|$/m
    );
    assert.match(
      generated,
      /^\| Тип \| Название \| Ранг \| Навык \| Урон \| Частота использования \| Цена в действиях \| Дальность \| Цели \| Зона \| Защита \| Длительность \| Краткое описание \| Полное описание \| Цена \|$/m
    );
    assert.match(
      generated,
      /^\| Название \| Ранг \| Краткое описание \| Полное описание \| Частота использования \| Навык \| Цена в действиях \| Дальность \| Цели \| Зона \| Защита \| Длительность \| Цена в кредитах \|$/m
    );
    assert.match(generated, /^\|.*КД-2.*\|$/m);
    assert.match(generated, /^## Снаряжение$/m);
    assert.match(generated, /^## Способности$/m);
  }
);

test(
  'syncBook renders chapter 04 from the mechanics-based catalog schema',
  { concurrency: false },
  async () => {
    const catalogNames = ['armor', 'equipment', 'abilities'];
    const backups = [];
    const previousDocsRepoEnv = process.env.PROJECT_ANDROMEDA_DOCS_REPO;

    for (const catalogName of catalogNames) {
      const path = resolve(repoRoot, 'data', 'gear', 'catalog', `${catalogName}.json`);
      const backupPath = `${path}.codex-backup`;
      await rename(path, backupPath);
      backups.push({ path, backupPath });
    }

    const mechanicsCatalogs = {
      armor: [
        {
          id: 'test-armor',
          name: 'Тестовая броня',
          type: 'armor',
          rank: 2,
          skill: null,
          mechanics: {
            usage: {
              activation: 'passive',
              frequency: 'passive'
            },
            properties: {
              fortitudeBonus: 3,
              controlBonus: 1,
              shield: 6
            },
            effects: [
              {
                key: 'grantTempStress',
                trigger: 'battleStart',
                amount: 6
              }
            ]
          },
          description: 'Полное описание тестовой брони.',
          shortDescription: 'Краткое описание тестовой брони.',
          price: 410
        }
      ],
      equipment: [
        {
          id: 'test-rifle',
          name: 'Тестовая винтовка',
          type: 'equipment',
          rank: 2,
          skill: 'strelba',
          mechanics: {
            usage: {
              activation: 'active',
              frequency: 'unlimited',
              actionCost: 'action',
              range: {
                type: 'meters',
                value: 30
              },
              targets: {
                type: 'single',
                value: 1
              }
            },
            properties: {
              damage: 3,
              armorPiercing: 1
            },
            effects: []
          },
          description: 'Полное описание тестовой винтовки.',
          shortDescription: 'Краткое описание тестовой винтовки.',
          price: 360
        }
      ],
      abilities: [
        {
          id: 'test-ability',
          name: 'Тестовая способность',
          type: 'ability',
          rank: 1,
          skill: 'mistika',
          mechanics: {
            usage: {
              activation: 'active',
              frequency: 'oncePerScene',
              actionCost: 'freeAction',
              range: {
                type: 'touch'
              },
              targets: {
                type: 'single',
                value: 1
              },
              defense: 'fortitude'
            },
            properties: {},
            effects: [
              {
                key: 'applyStatus',
                trigger: 'onSuccess',
                status: 'poisoned',
                duration: {
                  type: 'untilEndOfScene'
                }
              }
            ]
          },
          description: 'Полное описание тестовой способности.',
          shortDescription: 'Краткое описание тестовой способности.',
          price: 120
        }
      ]
    };

    try {
      process.env.PROJECT_ANDROMEDA_DOCS_REPO = resolve(repoRoot, '__missing_docs_repo__');

      for (const [catalogName, items] of Object.entries(mechanicsCatalogs)) {
        const path = resolve(repoRoot, 'data', 'gear', 'catalog', `${catalogName}.json`);
        await writeFile(path, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
      }

      const { generatedFiles } = await syncBook();
      const chapterPath = generatedFiles.find((filePath) =>
        filePath.endsWith('04-sposobnosti-i-snaryazhenie.md')
      );

      assert.ok(chapterPath, 'expected the abilities and equipment chapter to be generated');

      const generated = await readFile(resolve(chapterPath), 'utf8');

      assert.match(generated, /Тестовая броня/u);
      assert.match(generated, /Тестовая винтовка/u);
      assert.match(generated, /Тестовая способность/u);
      assert.match(generated, /Стрельба/u);
      assert.match(generated, /Мистика/u);
      assert.match(generated, /\|.*410.*\|/u);
      assert.match(generated, /\|.*360.*\|/u);
      assert.match(generated, /\|.*120.*\|/u);
    } finally {
      if (previousDocsRepoEnv === undefined) {
        delete process.env.PROJECT_ANDROMEDA_DOCS_REPO;
      } else {
        process.env.PROJECT_ANDROMEDA_DOCS_REPO = previousDocsRepoEnv;
      }

      for (const { path, backupPath } of backups) {
        await rm(path, { force: true });
        await rename(backupPath, path);
      }
    }
  }
);

test(
  'syncBook renders chapter 04 usage columns from effect-scoped mechanics',
  { concurrency: false },
  async () => {
    const catalogNames = ['armor', 'equipment', 'abilities'];
    const backups = [];
    const previousDocsRepoEnv = process.env.PROJECT_ANDROMEDA_DOCS_REPO;

    for (const catalogName of catalogNames) {
      const path = resolve(repoRoot, 'data', 'gear', 'catalog', `${catalogName}.json`);
      const backupPath = `${path}.codex-backup`;
      await rename(path, backupPath);
      backups.push({ path, backupPath });
    }

    const effectScopedCatalogs = {
      armor: [
        {
          id: 'effect-test-armor',
          name: 'Броня эффектов',
          type: 'armor',
          rank: 1,
          skill: null,
          mechanics: {
            effects: [
              {
                activation: { type: 'passive' },
                conditions: { frequency: 'passive' },
                outcomes: [{ key: 'fortitudeBonus', value: 2 }]
              }
            ]
          },
          description: 'Полное описание брони эффектов.',
          shortDescription: 'Краткое описание брони эффектов.',
          price: 100
        }
      ],
      equipment: [
        {
          id: 'effect-test-equipment',
          name: 'Снаряжение эффектов',
          type: 'equipment',
          rank: 1,
          skill: 'strelba',
          mechanics: {
            effects: [
              {
                activation: { type: 'action' },
                conditions: {
                  frequency: 'unlimited',
                  range: { type: 'meters', value: 30 },
                  targets: 'single'
                },
                outcomes: [{ key: 'damage', value: 3 }]
              }
            ]
          },
          description: 'Полное описание снаряжения эффектов.',
          shortDescription: 'Краткое описание снаряжения эффектов.',
          price: 200
        }
      ],
      abilities: [
        {
          id: 'effect-test-ability',
          name: 'Способность эффектов',
          type: 'ability',
          rank: 2,
          skill: 'mistika',
          mechanics: {
            effects: [
              {
                activation: { type: 'action' },
                conditions: {
                  frequency: 'oncePerScene',
                  range: { type: 'meters', value: 30 },
                  targets: 'allInArea',
                  area: { type: 'circle', value: 15 },
                  defense: 'fortitude',
                  duration: 'untilEndOfScene'
                },
                outcomes: [{ key: 'damage', value: 2 }]
              },
              {
                activation: { type: 'action' },
                conditions: {
                  frequency: 'oncePerScene',
                  range: { type: 'meters', value: 30 },
                  targets: 'allInArea',
                  area: { type: 'circle', value: 15 },
                  defense: 'fortitude',
                  duration: 'untilEndOfScene'
                },
                outcomes: [{ key: 'applyStatus', status: 'immobilized' }]
              }
            ]
          },
          description: 'Полное описание способности эффектов.',
          shortDescription: 'Краткое описание способности эффектов.',
          price: 300
        }
      ]
    };

    try {
      process.env.PROJECT_ANDROMEDA_DOCS_REPO = resolve(repoRoot, '__missing_docs_repo__');

      for (const [catalogName, items] of Object.entries(effectScopedCatalogs)) {
        const path = resolve(repoRoot, 'data', 'gear', 'catalog', `${catalogName}.json`);
        await writeFile(path, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
      }

      const { generatedFiles } = await syncBook();
      const chapterPath = generatedFiles.find((filePath) =>
        filePath.endsWith('04-sposobnosti-i-snaryazhenie.md')
      );

      assert.ok(chapterPath, 'expected the abilities and equipment chapter to be generated');

      const generated = await readFile(resolve(chapterPath), 'utf8');
      const abilityRow = generated
        .split(/\r?\n/u)
        .find((line) => line.includes('| Способность эффектов |'));

      assert.match(
        abilityRow ?? '',
        /^\| Способность эффектов \| 2 \| Краткое описание способности эффектов\. \| Полное описание способности эффектов\. \| 1\/сцену \| Мистика \| Действие \| 30 м \| Все цели в зоне \| Круг 15 м \| Стойкость \| До конца сцены \| 300 \|$/u
      );
    } finally {
      if (previousDocsRepoEnv === undefined) {
        delete process.env.PROJECT_ANDROMEDA_DOCS_REPO;
      } else {
        process.env.PROJECT_ANDROMEDA_DOCS_REPO = previousDocsRepoEnv;
      }

      for (const { path, backupPath } of backups) {
        await rm(path, { force: true });
        await rename(backupPath, path);
      }
    }
  }
);

test('public gear catalogs do not keep legacy rule text inside mechanics effects', async () => {
  const catalogNames = ['armor', 'equipment', 'abilities', 'concept-abilities'];
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
  'syncBook keeps chapter 04 equipment and abilities sections populated when catalogs are draft-only',
  { concurrency: false },
  async () => {
    const { generatedFiles } = await syncBook();
    const chapterPath = generatedFiles.find((filePath) =>
      filePath.endsWith('04-sposobnosti-i-snaryazhenie.md')
    );

    assert.ok(chapterPath, 'expected the abilities and equipment chapter to be generated');

    const generated = await readFile(resolve(chapterPath), 'utf8');
    const equipmentCatalog = JSON.parse(
      await readFile(resolve(repoRoot, 'data', 'gear', 'catalog', 'equipment.json'), 'utf8')
    );
    const abilitiesCatalog = JSON.parse(
      await readFile(resolve(repoRoot, 'data', 'gear', 'catalog', 'abilities.json'), 'utf8')
    );
    const equipmentEntry = equipmentCatalog.find((item) => item.status !== 'deprecated');
    const abilityEntry = abilitiesCatalog.find((item) => item.status !== 'deprecated');

    assert.ok(equipmentEntry, 'expected at least one visible equipment entry');
    assert.ok(abilityEntry, 'expected at least one visible ability entry');

    const equipmentSection = getSectionBody(generated, 'Снаряжение');
    const abilitiesSection = getSectionBody(generated, 'Способности');

    assert.match(equipmentSection, new RegExp(escapeRegExp(equipmentEntry.name), 'u'));
    assert.match(abilitiesSection, new RegExp(escapeRegExp(abilityEntry.name), 'u'));
  }
);

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
      docsRepoRoot,
      'data',
      'gear',
      'catalog',
      'concept-abilities.json'
    );
    const docsConceptBackupPath = resolve(
      docsRepoRoot,
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
