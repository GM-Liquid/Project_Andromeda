import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAbilityCatalogHtml, buildRulebookCatalogHtml } from './rulebookCatalog';

const abilityHeaders = [
  'Название',
  'Ранг',
  'Краткое описание',
  'Полное описание',
  'Частота использования',
  'Навык',
  'Цена в действиях',
  'Дальность',
  'Цели',
  'Зона',
  'Защита',
  'Длительность',
  'Цена в кредитах'
];

const equipmentHeaders = [
  'Тип',
  'Название',
  'Ранг',
  'Навык',
  'Урон',
  'Частота использования',
  'Цена в действиях',
  'Дальность',
  'Цели',
  'Зона',
  'Защита',
  'Длительность',
  'Краткое описание',
  'Полное описание',
  'Цена'
];

const detailedArmorHeaders = [
  'Название',
  'Ранг',
  'Стойкость',
  'Контроль',
  'Воля',
  'Силовой щит',
  'Скорость',
  'Частота использования',
  'Цена в действиях',
  'Длительность',
  'Краткое описание',
  'Полное описание',
  'Цена'
];

const weaponHeaders = ['Тип', 'Название', 'Цена', 'Ранг', 'Навык', 'Урон', 'Описание'];

function getSummaryRow(html: string) {
  return (
    [...html.matchAll(/<tr[\s\S]*?<\/tr>/g)]
      .map((match) => match[0])
      .find((row) => row.includes('class="rulebook-ability-catalog__summary-row"')) ?? ''
  );
}

function countMetaChips(summaryRow: string) {
  return [...summaryRow.matchAll(/rulebook-ability-catalog__meta-chip"/g)].length;
}

function extractSerializedEntries(html: string) {
  const dataMatch = html.match(
    /<script type="application\/json" class="rulebook-ability-catalog__data">([^<]+)<\/script>/
  );

  assert.ok(dataMatch, 'expected serialized catalog data');

  return JSON.parse(decodeURIComponent(dataMatch[1])) as Array<{
    filters: Record<string, string | string[]>;
  }>;
}

test('buildAbilityCatalogHtml renders a defense filter instead of sort controls', () => {
  const html = buildAbilityCatalogHtml(abilityHeaders, [
    [
      'Альфа',
      '2',
      'Краткое описание.',
      'Полное описание.',
      '1/сцену',
      'Кинетика',
      '1',
      '30 м',
      '1 цель',
      '',
      'Стойкость',
      '1 мин',
      '100'
    ]
  ]);

  const [entry] = extractSerializedEntries(html);

  assert.match(html, /Против Защиты/u);
  assert.match(html, /value="Стойкость"/u);
  assert.match(html, /value="Контроль"/u);
  assert.match(html, /value="Воля"/u);
  assert.doesNotMatch(html, /Сортировка/u);
  assert.doesNotMatch(html, /data-sort-option/u);
  assert.equal(entry.filters.defense, 'Стойкость');
});

test('buildAbilityCatalogHtml keeps an empty preview when the split description columns are present', () => {
  const html = buildAbilityCatalogHtml(abilityHeaders, [
    [
      'Блэкаут',
      '1',
      '',
      'Полное описание для проверки.',
      '1/сцену',
      '',
      '1',
      '',
      '',
      '',
      '',
      '',
      '100'
    ]
  ]);

  const summaryRow = getSummaryRow(html);
  assert.notEqual(summaryRow, '');
  assert.ok(summaryRow.includes('>—<'));
  assert.ok(!summaryRow.includes('Полное описание для проверки.'));
});

test('catalog summaries keep only the requested meta chips in collapsed rows', () => {
  const abilityHtml = buildAbilityCatalogHtml(abilityHeaders, [
    [
      'Структурный голод',
      '2',
      'Ближайшие твёрдые поверхности хватают цель.',
      'Ближайшие твёрдые поверхности хватают цель. При успехе цель получает урон и её скорость = 0 на 1 мин.',
      '1/сцену',
      'Кинетика',
      'Основное',
      '30 м',
      '1 цель',
      '',
      'Стойкость',
      '1 мин',
      '320'
    ]
  ]);
  const equipmentHtml = buildRulebookCatalogHtml('equipment', equipmentHeaders, [
    [
      'Оружие',
      'Проекционный модуль «Искра-30»',
      '2',
      'Стихийность',
      '6',
      'Неограниченно',
      'Основное',
      '30 м',
      '1 цель',
      '',
      'Воля',
      '',
      'Выпускаешь струю пламени в цель.',
      'Выпускаешь струю пламени в цель. Атака Стихийности +6 против Воли.',
      '900'
    ]
  ]);
  const armorHtml = buildRulebookCatalogHtml('armor', detailedArmorHeaders, [
    [
      'КД-2',
      '1',
      '2',
      '1',
      '',
      '3',
      '',
      '',
      '',
      '',
      'Базовая общевойсковая броня.',
      'Базовая общевойсковая броня для прямого боя и первого размена под огнем.',
      '600'
    ]
  ]);

  const abilitySummaryRow = getSummaryRow(abilityHtml);
  const equipmentSummaryRow = getSummaryRow(equipmentHtml);
  const armorSummaryRow = getSummaryRow(armorHtml);

  assert.equal(countMetaChips(abilitySummaryRow), 2);
  assert.match(abilitySummaryRow, /1\/сцену/u);
  assert.match(abilitySummaryRow, /Кинетика/u);
  assert.doesNotMatch(abilitySummaryRow, /Основное/u);
  assert.match(
    abilityHtml,
    /rulebook-ability-catalog__detail-fact-label">Цена в действиях<\/strong>/u
  );

  assert.equal(countMetaChips(equipmentSummaryRow), 1);
  assert.match(equipmentSummaryRow, /Стихийность/u);
  assert.doesNotMatch(equipmentSummaryRow, />6</u);
  assert.match(equipmentHtml, /rulebook-ability-catalog__detail-fact-label">Урон<\/strong>/u);
  assert.match(equipmentHtml, /rulebook-ability-catalog__detail-fact-value">6<\/span>/u);

  assert.equal(countMetaChips(armorSummaryRow), 2);
  assert.match(armorSummaryRow, /Стойкость 2/u);
  assert.match(armorSummaryRow, /Контроль 1/u);
  assert.doesNotMatch(armorSummaryRow, /Силовой щит/u);
  assert.match(armorHtml, /rulebook-ability-catalog__detail-fact-label">Силовой щит<\/strong>/u);
  assert.match(armorHtml, /rulebook-ability-catalog__detail-fact-value">3<\/span>/u);
});

test('buildAbilityCatalogHtml renders grouped detail facts before the full description without a description label', () => {
  const html = buildAbilityCatalogHtml(abilityHeaders, [
    [
      'Структурный голод',
      '2',
      'Ближайшие твёрдые поверхности хватают цель.',
      'Ближайшие твёрдые поверхности хватают цель. При успехе цель получает урон и её скорость = 0 на 1 мин.',
      '1/сцену',
      'Кинетика',
      'Основное',
      '30 м',
      '1 цель',
      '',
      'Стойкость',
      '1 мин',
      '320'
    ]
  ]);

  assert.match(html, /rulebook-ability-catalog__detail-facts/u);
  assert.match(
    html,
    /rulebook-ability-catalog__detail-fact-line[\s\S]*Дальность<\/strong>[\s\S]*30 м[\s\S]*Цели<\/strong>[\s\S]*1 цель[\s\S]*Защита<\/strong>[\s\S]*Стойкость/u
  );
  assert.match(
    html,
    /rulebook-ability-catalog__detail-fact-line[\s\S]*Длительность<\/strong>[\s\S]*1 мин[\s\S]*Цена в действиях<\/strong>[\s\S]*Основное[\s\S]*Частота<\/strong>[\s\S]*1\/сцену[\s\S]*Навык<\/strong>[\s\S]*Кинетика/u
  );
  assert.doesNotMatch(html, /rulebook-ability-catalog__detail-fact-label">Зона<\/strong>/u);
  assert.doesNotMatch(html, /rulebook-ability-catalog__detail-tag-label/u);
  assert.doesNotMatch(html, /rulebook-ability-catalog__detail-label">Описание<\/span>/u);
  assert.match(
    html,
    /rulebook-ability-catalog__detail-facts[\s\S]*rulebook-ability-catalog__detail-copy[\s\S]*Ближайшие твёрдые поверхности/u
  );
});

test('buildRulebookCatalogHtml uses the requested defense filter labels per catalog family', () => {
  const weaponHtml = buildRulebookCatalogHtml('weapons', weaponHeaders, [
    ['Стрелковое', 'Игла', '780', '2', 'Стрельба', '+4', 'Точная винтовка.']
  ]);
  const armorHtml = buildRulebookCatalogHtml('armor', detailedArmorHeaders, [
    [
      'ОЗК',
      '1',
      '3',
      '4',
      '2',
      '',
      '',
      '',
      '',
      '',
      'Облегченная броня.',
      'Облегченная броня для работы в опасной среде.',
      '100'
    ]
  ]);
  const equipmentHtml = buildRulebookCatalogHtml('equipment', equipmentHeaders, [
    [
      'Снаряжение',
      'Керезников',
      '1',
      '',
      '',
      'Постоянно',
      '',
      '',
      'На себя',
      '',
      'Контроль',
      '',
      'Ускоритель реакции для пользователя.',
      'Ускоритель реакции для пользователя.',
      '160'
    ]
  ]);
  const [armorEntry] = extractSerializedEntries(armorHtml);
  const [equipmentEntry] = extractSerializedEntries(equipmentHtml);

  assert.doesNotMatch(weaponHtml, /Сортировка/u);
  assert.doesNotMatch(armorHtml, /Сортировка/u);
  assert.doesNotMatch(equipmentHtml, /Сортировка/u);

  assert.match(armorHtml, /Бонус к Защите/u);
  assert.match(armorHtml, /value="Стойкость"/u);
  assert.match(armorHtml, /value="Контроль"/u);
  assert.match(armorHtml, /value="Воля"/u);
  assert.deepEqual(armorEntry.filters.defense, ['Стойкость', 'Контроль', 'Воля']);

  assert.match(equipmentHtml, /Против Защиты/u);
  assert.match(equipmentHtml, /value="Стойкость"/u);
  assert.match(equipmentHtml, /value="Контроль"/u);
  assert.match(equipmentHtml, /value="Воля"/u);
  assert.equal(equipmentEntry.filters.defense, 'Контроль');
});
