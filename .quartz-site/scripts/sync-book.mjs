import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getGeneratedRulebookEntries,
  slugToContentPath,
  validateRulebookManifest
} from './rulebook.manifest.mjs';
import { prepareGearCatalogSource } from './gear-catalog-source.mjs';
import { prepareRulebookSource } from './rulebook-source.mjs';
import { extractSkillTitles, transformSkillsReferenceSource } from './skills-reference-source.mjs';

export { extractSkillTitles, transformSkillsReferenceSource } from './skills-reference-source.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, '..');
const repoRoot = resolve(siteRoot, '..');

const contentDir = resolve(siteRoot, 'content');
const rulebookDir = resolve(contentDir, 'rulebook');
const generatedStatePath = resolve(contentDir, '.generated-rulebook.json');
const gearCatalogFiles = {
  armor: 'armor.json',
  equipment: 'equipment.json',
  abilities: 'abilities.json',
  traits: 'traits.json',
  archetypes: 'archetypes.json'
};

const skillLabels = {
  analiz: 'Анализ',
  blizhniy_boy: 'Ближний бой',
  bionika: 'Бионика',
  dominirovanie: 'Доминирование',
  inzheneriya: 'Инженерия',
  khakerstvo: 'Хакерство',
  lovkost: 'Ловкость',
  mistika: 'Мистика',
  moshch: 'Мощь',
  nablyudatelnost: 'Наблюдательность',
  obayanie: 'Обаяние',
  programmirovanie: 'Программирование',
  rezonans: 'Резонанс',
  sokrytie: 'Сокрытие',
  strelba: 'Стрельба'
};

const skillKeysByLabel = Object.fromEntries(
  Object.entries(skillLabels).map(([key, label]) => [label, key])
);

const legacyUsageKeyMap = {
  actions: 'actionCost'
};

const usageValueLabels = {
  frequency: {
    atWill: 'По желанию',
    passive: 'Постоянно',
    unlimited: 'Неограниченно',
    oncePerScene: '1/сцену',
    oncePerSession: '1/сессию'
  },
  actionCost: {
    action: 'Действие',
    freeAction: 'Свободное действие',
    reaction: 'Реакция',
    maneuver: 'Маневр'
  },
  defense: {
    control: 'Контроль',
    fortitude: 'Стойкость',
    will: 'Воля'
  }
};

const legacyPropertyKeyMap = {
  'armor-piercing-x': 'armorPiercing',
  concealable: 'concealable',
  'control-bonus-x': 'controlBonus',
  damage: 'damage',
  escalation: 'escalation',
  'escalation-x': 'escalation',
  'fortitude-bonus-x': 'fortitudeBonus',
  reload: 'reload',
  'reload-x': 'reload',
  shield: 'shield',
  speed: 'speedBonus',
  stabilization: 'stabilization',
  'stabilization-x': 'stabilization',
  'will-bonus-x': 'willBonus'
};

function formatDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function serializeFrontmatterValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (value === null) {
    return 'null';
  }

  return String(value);
}

function withFrontmatter(frontmatter, body) {
  return [
    '---',
    ...Object.entries(frontmatter).map(
      ([key, value]) => `${key}: ${serializeFrontmatterValue(value)}`
    ),
    '---',
    '',
    body.trimEnd(),
    ''
  ].join('\n');
}

function buildRulebookInternalLinkMap(chapters) {
  return new Map(
    chapters
      .filter((chapter) => chapter.source)
      .map((chapter) => [chapter.source.replace(/\.md$/i, ''), basename(chapter.slug)])
  );
}

function rewriteRulebookLinkTarget(target, linkMap) {
  if (!target || target.startsWith('#')) {
    return target;
  }

  const trimmedTarget = target.trim();
  const anchorIndex = trimmedTarget.indexOf('#');
  const pathPart = anchorIndex === -1 ? trimmedTarget : trimmedTarget.slice(0, anchorIndex);
  const anchorPart = anchorIndex === -1 ? '' : trimmedTarget.slice(anchorIndex);

  let prefix = '';
  let normalizedPath = pathPart;
  if (normalizedPath.startsWith('./')) {
    prefix = './';
    normalizedPath = normalizedPath.slice(2);
  }

  normalizedPath = normalizedPath.replace(/\.md$/i, '');
  const rewrittenPath = linkMap.get(normalizedPath);

  if (!rewrittenPath) {
    return target;
  }

  return `${prefix}${rewrittenPath}${anchorPart}`;
}

export function rewriteRulebookInternalLinks(body, chapters = getGeneratedRulebookEntries()) {
  const linkMap = buildRulebookInternalLinkMap(chapters);
  if (linkMap.size === 0) {
    return body;
  }

  return body
    .replace(
      /\[\[([^\]|#]+)?(#[^\]|]+)?(\|[^\]]*)?\]\]/g,
      (full, rawTarget = '', rawAnchor = '', rawAlias = '') => {
        if (!rawTarget) {
          return full;
        }

        const rewrittenTarget = rewriteRulebookLinkTarget(
          `${rawTarget}${rawAnchor ?? ''}`,
          linkMap
        );

        if (rewrittenTarget === `${rawTarget}${rawAnchor ?? ''}`) {
          return full;
        }

        return `[[${rewrittenTarget}${rawAlias ?? ''}]]`;
      }
    )
    .replace(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/g, (full, text, rawTarget) => {
      if (/^(?:[a-z]+:)?\/\//i.test(rawTarget) || rawTarget.startsWith('#')) {
        return full;
      }

      const rewrittenTarget = rewriteRulebookLinkTarget(rawTarget, linkMap);
      if (rewrittenTarget === rawTarget) {
        return full;
      }

      return `[${text}](${rewrittenTarget})`;
    });
}

function normalizeCharacterSheetExamples(body) {
  const lines = body.split('\n');
  const normalized = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line.startsWith('**Имя:**')) {
      normalized.push(line);
      continue;
    }

    const blockLines = [line.trimEnd()];
    let cursor = index + 1;

    while (cursor < lines.length && lines[cursor].trim() !== '') {
      blockLines.push(lines[cursor].trimEnd());
      cursor += 1;
    }

    normalized.push(blockLines.join('  \n'));
    index = cursor - 1;
  }

  return normalized.join('\n');
}

function escapeMarkdownTableCell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

function renderMarkdownTable(headers, rows) {
  return [
    `| ${headers.map((header) => escapeMarkdownTableCell(header)).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((cell) => escapeMarkdownTableCell(cell)).join(' | ')} |`)
  ].join('\n');
}

function normalizeDamageNumber(value) {
  const numeric = Math.trunc(Number(value));
  return Number.isFinite(numeric) ? Math.max(numeric, 0) : 0;
}

function formatDamageProfile(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';

  if (!text.includes('/')) {
    const legacyDamage = normalizeDamageNumber(text);
    return `0/${legacyDamage}/${legacyDamage}/${legacyDamage}`;
  }

  const values = text
    .split('/')
    .slice(0, 4)
    .map((part) => normalizeDamageNumber(part));
  while (values.length < 4) values.push(0);
  return values.join('/');
}

function getGearQuartzValue(item, key) {
  const value = item?.quartz?.[key];
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function getGearSkillKey(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return '';
  }

  return skillKeysByLabel[normalized] || normalized;
}

function getGearSkillLabel(value) {
  const skillKey = getGearSkillKey(value);
  if (!skillKey) {
    return '';
  }

  return skillLabels[skillKey] || skillKey;
}

function getMechanicsUsageValue(item, key) {
  const mechanicsKey = legacyUsageKeyMap[key] || key;
  const value = item?.mechanics?.usage?.[mechanicsKey];
  return value === null || value === undefined ? null : value;
}

function getEffectActivationType(effect) {
  const activation = effect?.activation;
  if (activation === null || activation === undefined) {
    return null;
  }

  if (typeof activation === 'string') {
    return activation.trim() || null;
  }

  return activation.type ?? null;
}

function getEffectUsageValue(effect, key) {
  switch (key) {
    case 'actionCost':
      return getEffectActivationType(effect);
    case 'frequency':
      return (
        effect?.conditions?.frequency ??
        (getEffectActivationType(effect) === 'passive' ? 'passive' : null)
      );
    case 'area':
    case 'defense':
    case 'duration':
    case 'range':
    case 'targets':
      return effect?.conditions?.[key] ?? null;
    default:
      return null;
  }
}

function formatRangeValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  switch (value.type) {
    case 'custom':
      return String(value.value ?? '').trim();
    case 'lineOfSight':
      return 'Зона видимости';
    case 'melee':
      return 'Ближний бой';
    case 'meters':
      return value.value ? `${value.value} м` : '';
    case 'self':
      return 'На себя';
    case 'touch':
      return 'Касание';
    default:
      return '';
  }
}

function formatTargetsValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    const upToMatch = normalized.match(/^upTo(\d+)$/u);
    if (upToMatch) {
      return `До ${upToMatch[1]} целей`;
    }

    switch (normalized) {
      case 'allInArea':
        return 'Все цели в зоне';
      case 'allInLine':
        return 'Все цели на линии';
      case 'area':
        return 'Зона';
      case 'self':
        return 'Вы';
      case 'single':
        return '1 цель';
      default:
        return normalized;
    }
  }

  switch (value.type) {
    case 'allInArea':
      return 'Все цели в зоне';
    case 'custom':
      return String(value.value ?? '').trim();
    case 'self':
      return 'Вы';
    case 'single':
      return `${value.value ?? 1} цель`;
    case 'upTo':
      return value.value ? `До ${value.value} целей` : '';
    default:
      return '';
  }
}

function formatAreaValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  switch (value.type) {
    case 'blast':
      return value.value ? `Взрыв ${value.value} м` : 'Взрыв';
    case 'circle':
      return value.value ? `Круг, диаметр ${value.value} м` : 'Круг';
    case 'custom':
      return String(value.value ?? '').trim();
    case 'line':
      return value.value ? `Линия ${value.value} м` : 'Линия';
    case 'ray':
      return value.value ? `Луч ${value.value} м` : 'Луч';
    case 'radius':
      return value.value ? `Радиус ${value.value} м` : 'Радиус';
    default:
      return '';
  }
}

function formatDurationValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    switch (value.trim()) {
      case 'untilEndOfScene':
        return 'До конца сцены';
      case 'untilEndOfTurn':
        return 'До конца хода';
      case 'untilCanceled':
        return 'Пока не отмените';
      case 'untilMove':
        return 'Пока вы не смените позицию';
      case 'untilStartOfYourNextTurn':
        return 'До начала вашего следующего хода';
      case 'whileMaintained':
        return 'Пока вы поддерживаете эффект';
      default:
        return value.trim();
    }
  }

  switch (value.type) {
    case 'custom':
      return String(value.value ?? '').trim();
    case 'minutes':
      return value.value ? `${value.value} минута` : '';
    case 'untilEndOfScene':
      return 'До конца сцены';
    case 'untilEndOfTurn':
      return 'До конца хода';
    case 'untilCanceled':
      return 'Пока не отмените';
    case 'untilMove':
      return 'Пока вы не смените позицию';
    case 'untilStartOfYourNextTurn':
      return 'До начала вашего следующего хода';
    case 'whileMaintained':
      return 'Пока вы поддерживаете эффект';
    default:
      return '';
  }
}

function formatUsageValue(key, value) {
  if (value === null || value === undefined) {
    return '';
  }

  switch (key) {
    case 'area':
      return formatAreaValue(value);
    case 'duration':
      return formatDurationValue(value);
    case 'range':
      return formatRangeValue(value);
    case 'targets':
      return formatTargetsValue(value);
    default:
      break;
  }

  if (typeof value === 'string') {
    const label = usageValueLabels[key]?.[value];
    return label || value.trim();
  }

  switch (key) {
    case 'defense':
      return usageValueLabels.defense?.[value] || '';
    default:
      return '';
  }
}

function formatEffectUsageValue(key, value) {
  if (key === 'actionCost' && value === 'passive') {
    return '';
  }

  return formatUsageValue(key, value);
}

function getMechanicsEffectUsageValue(item, key) {
  const effects = Array.isArray(item?.mechanics?.effects) ? item.mechanics.effects : [];
  const values = [];
  const seen = new Set();

  for (const effect of effects) {
    const formatted = formatEffectUsageValue(key, getEffectUsageValue(effect, key));
    if (!formatted || seen.has(formatted)) {
      continue;
    }

    seen.add(formatted);
    values.push(formatted);
  }

  return values.join('; ');
}

function getGearUsageValue(item, key) {
  const mechanicsKey = legacyUsageKeyMap[key] || key;
  const mechanicsValue = getMechanicsUsageValue(item, key);
  if (mechanicsValue !== null) {
    return formatUsageValue(mechanicsKey, mechanicsValue);
  }

  const effectValue = getMechanicsEffectUsageValue(item, mechanicsKey);
  if (effectValue) {
    return effectValue;
  }

  const value = item?.usage?.[key];
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function getGearUsageOrQuartzValue(item, key) {
  return getGearUsageValue(item, key) || getGearQuartzValue(item, key);
}

function getGearSkillValue(item) {
  const skill = item?.skill;
  if (skill !== null && skill !== undefined) {
    const normalized = getGearSkillLabel(skill);
    if (normalized) {
      return normalized;
    }
  }

  return getGearSkillLabel(getGearQuartzValue(item, 'skill'));
}

function buildDescriptionPreview(description, maxLength = 110) {
  const normalized = String(description ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return '';
  }

  const sentenceMatch = normalized.match(new RegExp(`^(.{1,${maxLength}}?[.!?](?=\\s|$))`, 'u'));
  if (sentenceMatch && sentenceMatch[1].length >= 40) {
    return sentenceMatch[1];
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  let preview = normalized.slice(0, maxLength - 1);
  const lastSpace = preview.lastIndexOf(' ');
  if (lastSpace >= Math.floor(maxLength * 0.6)) {
    preview = preview.slice(0, lastSpace);
  }

  return `${preview.trimEnd()}…`;
}

function getGearDescription(item) {
  if (item?.description) {
    return String(item.description).trim();
  }

  if (Object.hasOwn(item?.quartz ?? {}, 'fullDescription')) {
    return getGearQuartzValue(item, 'fullDescription');
  }

  return (item.description ?? '').trim();
}

function resolvePreviewDescription(previewDescription, fullDescription, fallbackDescription = '') {
  const preview = String(previewDescription ?? '').trim();
  const full = String(fullDescription ?? '').trim();
  const fallback = String(fallbackDescription ?? '').trim();

  if (preview) {
    return full && preview === full ? buildDescriptionPreview(full) : preview;
  }

  if (full) {
    return buildDescriptionPreview(full);
  }

  return fallback;
}

function buildStructuredGearPreview(item) {
  const skill = getGearSkillValue(item);
  const damage = getGearQuartzValue(item, 'damage') || getEquipmentDamageValue(item);

  if (skill || damage) {
    const parts = [];
    if (skill) {
      parts.push(`для навыка ${skill}`);
    }

    if (damage) {
      parts.push(`урон ${damage}`);
    }

    return `Оружие ${parts.join(', ')}.`;
  }

  const physicalDefense = getArmorDefenseValue(item, 'physicalDefense', 'fortitude-bonus-x');
  const magicalDefense = getArmorDefenseValue(item, 'magicalDefense', 'control-bonus-x');
  const psychicDefense = getArmorDefenseValue(item, 'psychicDefense', 'will-bonus-x');
  const shield = getGearPropertyValue(item, 'shield') || getGearQuartzValue(item, 'shield');

  if (physicalDefense || magicalDefense || psychicDefense || shield) {
    const parts = [];
    if (physicalDefense) {
      parts.push(`Стойкость ${physicalDefense}`);
    }

    if (magicalDefense) {
      parts.push(`Контроль ${magicalDefense}`);
    }

    if (psychicDefense) {
      parts.push(`Воля ${psychicDefense}`);
    }

    if (shield) {
      parts.push(`силовой щит ${shield}`);
    }

    return `Броня: ${parts.join(', ')}.`;
  }

  return '';
}

function getGearShortDescription(item) {
  const explicitPreview = item?.shortDescription
    ? String(item.shortDescription).trim()
    : Object.hasOwn(item?.quartz ?? {}, 'previewDescription')
      ? getGearQuartzValue(item, 'previewDescription')
      : '';

  return resolvePreviewDescription(
    explicitPreview,
    getGearDescription(item),
    buildStructuredGearPreview(item)
  );
}

function getGearCatalogPrice(item) {
  if (item?.price !== null && item?.price !== undefined) {
    return String(item.price);
  }

  if (item.finalCost === null || item.finalCost === undefined) {
    return '';
  }

  return String(item.finalCost);
}

function isPublishedGearCatalogItem(item) {
  return item?.status !== 'draft' && item?.status !== 'deprecated';
}

function getRenderableGearCatalogItems(catalog) {
  const items = Array.isArray(catalog?.items) ? catalog.items : [];
  if (!items.some((item) => item?.status !== undefined)) {
    return items.filter((item) => item?.id && item?.name);
  }

  const publishedItems = items.filter(isPublishedGearCatalogItem);

  if (publishedItems.length > 0) {
    return publishedItems;
  }

  // Keep public chapter sections usable while a whole catalog is still draft-only.
  return items.filter((item) => item?.status !== 'deprecated');
}

function getGearPropertyValue(item, propertyKey) {
  const normalizedPropertyKey = legacyPropertyKeyMap[propertyKey] || propertyKey;
  const mechanicsValue = item?.mechanics?.properties?.[normalizedPropertyKey];
  if (mechanicsValue !== null && mechanicsValue !== undefined) {
    return normalizedPropertyKey === 'damage'
      ? formatDamageProfile(mechanicsValue)
      : String(mechanicsValue);
  }

  for (const effect of item?.mechanics?.effects ?? []) {
    for (const outcome of effect?.outcomes ?? []) {
      if (String(outcome?.key ?? '') !== normalizedPropertyKey) continue;
      const value = outcome?.value ?? outcome?.amount;
      if (value === null || value === undefined) continue;
      return normalizedPropertyKey === 'damage' ? formatDamageProfile(value) : String(value);
    }
  }

  const property = item.properties?.find((candidate) => candidate.key === propertyKey);
  if (!property || property.value === null || property.value === undefined) {
    return '';
  }

  return normalizedPropertyKey === 'damage'
    ? formatDamageProfile(property.value)
    : String(property.value);
}

function getGearSpeedValue(item) {
  const mechanicsSpeedBonus = item?.mechanics?.properties?.speedBonus;
  if (
    mechanicsSpeedBonus !== null &&
    mechanicsSpeedBonus !== undefined &&
    mechanicsSpeedBonus !== ''
  ) {
    const numericValue = Number(mechanicsSpeedBonus);
    if (Number.isFinite(numericValue) && numericValue !== 0) {
      const sign = numericValue > 0 ? '+' : '';
      return `Скорость ${sign}${numericValue} м`;
    }
  }

  return getGearQuartzValue(item, 'speed');
}

function getArmorDefenseValue(item, quartzKey, propertyKey) {
  return getGearQuartzValue(item, quartzKey) || getGearPropertyValue(item, propertyKey);
}

function getEquipmentTypeLabel(item) {
  const skillKey = getGearSkillKey(item?.skill || getGearQuartzValue(item, 'skill'));
  if (skillKey === 'blizhniy_boy') {
    return 'Ближнее';
  }

  if (skillKey === 'strelba') {
    return 'Стрелковое';
  }

  const tags = new Set(item.tags ?? []);
  if (tags.has('blizhnee')) {
    return 'Ближнее';
  }

  if (tags.has('strelkovoe')) {
    return 'Стрелковое';
  }

  if (tags.has('metatelnoe')) {
    return 'Метательное';
  }

  return 'Снаряжение';
}

function isWeaponCatalogItem(item) {
  const skillKey = getGearSkillKey(item?.skill || getGearQuartzValue(item, 'skill'));
  if (skillKey === 'blizhniy_boy' || skillKey === 'strelba') {
    return true;
  }

  const tags = new Set(item.tags ?? []);
  return tags.has('blizhnee') || tags.has('strelkovoe') || tags.has('metatelnoe');
}

function getEquipmentDamageValue(item) {
  const propertyDamage = getGearPropertyValue(item, 'damage');
  if (propertyDamage) {
    return propertyDamage;
  }

  const description = getGearDescription(item);
  const damageMatch = description.match(/Урон:\s*([^.;]+)/u);
  return damageMatch ? formatDamageProfile(damageMatch[1].trim()) : '';
}

const STEP_EFFECT_THRESHOLD_LABELS_RU = {
  SuccessWithCost: 'Успех с ценой',
  Success: 'Успех',
  CriticalSuccess: 'Крит. успех'
};

// Optional step effects authored on the catalog entry, rendered as a readable
// "text (с «threshold»)" list. Absent field -> empty cell.
function getGearStepEffectsValue(item) {
  const effects = Array.isArray(item?.stepEffects) ? item.stepEffects : [];
  return effects
    .map((effect) => {
      const text = String(effect?.text ?? '').trim();
      if (!text) return '';
      const label =
        STEP_EFFECT_THRESHOLD_LABELS_RU[effect?.minOutcome] ??
        STEP_EFFECT_THRESHOLD_LABELS_RU.Success;
      return `${text} (с «${label}»)`;
    })
    .filter(Boolean)
    .join('; ');
}

function buildArmorCatalogTable(catalog) {
  const rows = getRenderableGearCatalogItems(catalog).map((item) => [
    item.name,
    item.rank,
    getArmorDefenseValue(item, 'physicalDefense', 'fortitude-bonus-x'),
    getArmorDefenseValue(item, 'magicalDefense', 'control-bonus-x'),
    getArmorDefenseValue(item, 'psychicDefense', 'will-bonus-x'),
    getGearPropertyValue(item, 'shield') || getGearQuartzValue(item, 'shield'),
    getGearSpeedValue(item),
    getGearUsageOrQuartzValue(item, 'frequency'),
    getGearUsageOrQuartzValue(item, 'actions'),
    getGearUsageOrQuartzValue(item, 'duration'),
    getGearShortDescription(item),
    getGearDescription(item),
    getGearCatalogPrice(item)
  ]);

  return renderMarkdownTable(
    [
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
    ],
    rows
  );
}

function buildTraitCatalogTable(catalog) {
  const rows = getRenderableGearCatalogItems(catalog).map((item) => [
    item.name,
    item.rank,
    getGearSkillValue(item),
    getGearShortDescription(item),
    getGearDescription(item),
    getGearCatalogPrice(item)
  ]);

  return renderMarkdownTable(
    ['Название', 'Ранг', 'Навык', 'Краткое описание', 'Полное описание', 'Цена в очках развития'],
    rows
  );
}

function buildEquipmentCatalogTable(catalog) {
  const rows = getRenderableGearCatalogItems(catalog)
    .filter((item) => !isWeaponCatalogItem(item))
    .map((item) => [
      getEquipmentTypeLabel(item),
      item.name,
      item.rank,
      getGearSkillValue(item),
      getGearQuartzValue(item, 'damage') || getEquipmentDamageValue(item),
      getGearStepEffectsValue(item),
      getGearUsageOrQuartzValue(item, 'frequency'),
      getGearUsageOrQuartzValue(item, 'actions'),
      getGearUsageOrQuartzValue(item, 'range'),
      getGearUsageOrQuartzValue(item, 'targets'),
      getGearUsageOrQuartzValue(item, 'area'),
      getGearUsageOrQuartzValue(item, 'defense'),
      getGearUsageOrQuartzValue(item, 'duration'),
      getGearShortDescription(item),
      getGearDescription(item),
      getGearCatalogPrice(item)
    ]);

  return renderMarkdownTable(
    [
      'Тип',
      'Название',
      'Ранг',
      'Навык',
      'Урон',
      'Эффекты',
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
    ],
    rows
  );
}

function buildWeaponCatalogTable(catalog) {
  const rows = getRenderableGearCatalogItems(catalog)
    .filter(isWeaponCatalogItem)
    .map((item) => [
      getEquipmentTypeLabel(item),
      item.name,
      item.rank,
      getGearSkillValue(item),
      getGearQuartzValue(item, 'damage') || getEquipmentDamageValue(item),
      getGearStepEffectsValue(item),
      getGearUsageOrQuartzValue(item, 'frequency'),
      getGearUsageOrQuartzValue(item, 'actions'),
      getGearUsageOrQuartzValue(item, 'range'),
      getGearUsageOrQuartzValue(item, 'targets'),
      getGearUsageOrQuartzValue(item, 'area'),
      getGearUsageOrQuartzValue(item, 'defense'),
      getGearUsageOrQuartzValue(item, 'duration'),
      getGearShortDescription(item),
      getGearDescription(item),
      getGearCatalogPrice(item)
    ]);

  return renderMarkdownTable(
    [
      'Тип',
      'Название',
      'Ранг',
      'Навык',
      'Урон',
      'Эффекты',
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
    ],
    rows
  );
}

function buildAbilityCatalogTable(catalog) {
  const rows = getRenderableGearCatalogItems(catalog).map((item) => [
    item.name,
    item.rank,
    getGearQuartzValue(item, 'damage') || getGearPropertyValue(item, 'damage'),
    getGearStepEffectsValue(item),
    getGearShortDescription(item),
    getGearDescription(item),
    getGearUsageOrQuartzValue(item, 'frequency'),
    getGearSkillValue(item),
    getGearUsageOrQuartzValue(item, 'actions'),
    getGearUsageOrQuartzValue(item, 'range'),
    getGearUsageOrQuartzValue(item, 'targets'),
    getGearUsageOrQuartzValue(item, 'area'),
    getGearUsageOrQuartzValue(item, 'defense'),
    getGearUsageOrQuartzValue(item, 'duration'),
    getGearCatalogPrice(item)
  ]);

  return renderMarkdownTable(
    [
      'Название',
      'Ранг',
      'Урон',
      'Эффекты',
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
    ],
    rows
  );
}

function getArchetypeDefenseLabel(defenseKey) {
  if (!defenseKey) {
    return '';
  }

  return usageValueLabels.defense[defenseKey] || String(defenseKey).trim();
}

function buildArchetypeVersionCell(version) {
  const damage = formatDamageProfile(version?.damage);
  const name = String(version?.name ?? '').trim();
  const description = String(version?.description ?? '').trim();
  return `**${name}** — урон \`${damage}\`. ${description}`.trim();
}

function buildArchetypeAbilityTable(ability) {
  const versions = Array.isArray(ability?.versions) ? [...ability.versions] : [];
  versions.sort((left, right) => Number(left?.rank ?? 0) - Number(right?.rank ?? 0));

  const rows = versions.map((version) => [
    `\`${version?.rank ?? ''}\``,
    buildArchetypeVersionCell(version)
  ]);

  return renderMarkdownTable(['Ранг', 'Версия'], rows);
}

function buildArchetypeDescriptionBlock(archetype, index) {
  const ability = archetype?.ability ?? {};
  const abilityName = String(ability?.name ?? '').trim();
  const skillLabel = skillLabels[archetype?.skill] || archetype?.skill || '';
  const defenseProfile = archetype?.defenseProfile ?? {};
  const strong = getArchetypeDefenseLabel(defenseProfile.strong);
  const medium = getArchetypeDefenseLabel(defenseProfile.medium);
  const weak = getArchetypeDefenseLabel(defenseProfile.weak);

  return [
    `#### ${index + 1}. ${archetype.name}`,
    '',
    `**Сигнатурная способность — ${abilityName}.**`,
    '',
    buildArchetypeAbilityTable(ability),
    '',
    `**Мастерство в навыке:** ${skillLabel}.  `,
    `**Защиты:** сильная — ${strong}, средняя — ${medium}, слабая — ${weak}.`
  ].join('\n');
}

function buildArchetypeDescriptionSection(archetypesCatalog) {
  const items = getRenderableGearCatalogItems(archetypesCatalog);
  return items
    .map((archetype, index) => buildArchetypeDescriptionBlock(archetype, index))
    .join('\n\n');
}

const ARCHETYPE_DESCRIPTIONS_HEADING = '### Полные описания архетипов';

// Chapter 2 no longer authors per-archetype entries by hand: the source keeps
// only the intro prose plus a callout pointing at archetypes.json. This splices
// the generated blocks (signature ability versions, mastery skill, defense
// profile) in place of that callout, the same way chapter 04 injects catalog
// tables in transformAbilitiesEquipmentSource.
function transformCharacterCreationSource(source, archetypesCatalog) {
  const lines = source.split('\n');
  const headingIndex = lines.findIndex((line) => line.trim() === ARCHETYPE_DESCRIPTIONS_HEADING);

  if (headingIndex === -1) {
    return source;
  }

  let calloutStart = -1;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim().startsWith('>')) {
      calloutStart = index;
      break;
    }
  }

  const introEnd = calloutStart === -1 ? lines.length : calloutStart;
  let calloutEnd = introEnd;
  while (calloutEnd < lines.length && lines[calloutEnd].trim().startsWith('>')) {
    calloutEnd += 1;
  }

  const before = trimSectionLines(lines.slice(0, introEnd));
  const after = trimSectionLines(lines.slice(calloutEnd));
  const archetypeSection = buildArchetypeDescriptionSection(archetypesCatalog);

  const combined = [...before, '', archetypeSection];
  if (after.length > 0) {
    combined.push('', ...after);
  }

  return combined.join('\n').trim();
}

function stripMarkdownTableBlocks(lines) {
  const output = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].trim().startsWith('|')) {
      output.push(lines[index]);
      continue;
    }

    while (index < lines.length && lines[index].trim().startsWith('|')) {
      index += 1;
    }

    while (index < lines.length && lines[index].trim() === '') {
      index += 1;
    }

    index -= 1;
  }

  return output;
}

function trimSectionLines(lines) {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim() === '') {
    start += 1;
  }

  while (end > start && lines[end - 1].trim() === '') {
    end -= 1;
  }

  return lines.slice(start, end);
}

function transformAbilitiesEquipmentSource(source, gearCatalogs) {
  const sectionTableMap = new Map([
    ['Броня', buildArmorCatalogTable(gearCatalogs.armor)],
    ['Снаряжение', buildEquipmentCatalogTable(gearCatalogs.equipment)],
    ['Способности', buildAbilityCatalogTable(gearCatalogs.abilities)]
  ]);
  const weaponCatalogTable = buildWeaponCatalogTable(gearCatalogs.equipment);
  const traitCatalogTable = buildTraitCatalogTable(gearCatalogs.traits);
  const lines = source.split('\n');
  const nextLines = [];
  let sectionHeading = null;
  let sectionBody = [];

  const flushSection = () => {
    if (!sectionHeading) {
      nextLines.push(...sectionBody);
      sectionBody = [];
      return;
    }

    const cleanedBody = trimSectionLines(stripMarkdownTableBlocks(sectionBody));
    const sectionTitle = sectionHeading.replace(/^##\s+/u, '').trim();
    if (sectionTitle === 'Снаряжение' && weaponCatalogTable) {
      nextLines.push('## Оружие', '', weaponCatalogTable, '');
    }
    if (sectionTitle === 'Снаряжение') {
      const armorCatalogTable = sectionTableMap.get('Броня');
      if (armorCatalogTable) {
        nextLines.push('## Броня', '', armorCatalogTable, '');
      }
    }

    nextLines.push(sectionHeading);

    if (cleanedBody.length > 0) {
      nextLines.push('', ...cleanedBody);
    }

    if (sectionTitle === 'Черты и способности' && traitCatalogTable) {
      nextLines.push('', '## Черты', '', traitCatalogTable, '');
    }

    const injectedTable = sectionTableMap.get(sectionTitle);
    if (injectedTable) {
      nextLines.push('', injectedTable, '');
    } else if (cleanedBody.length > 0) {
      nextLines.push('');
    }

    sectionHeading = null;
    sectionBody = [];
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flushSection();
      sectionHeading = line;
      continue;
    }

    sectionBody.push(line);
  }

  flushSection();

  return nextLines.join('\n').trim();
}

async function readGearCatalog(catalogDir, filename) {
  const raw = await readFile(resolve(catalogDir, filename), 'utf8');
  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    return { items: parsed };
  }

  throw new Error(`Gear catalog must be a root array: ${filename}`);
}

async function readGearCatalogs(catalogDir) {
  return {
    armor: await readGearCatalog(catalogDir, gearCatalogFiles.armor),
    equipment: await readGearCatalog(catalogDir, gearCatalogFiles.equipment),
    abilities: await readGearCatalog(catalogDir, gearCatalogFiles.abilities),
    traits: await readGearCatalog(catalogDir, gearCatalogFiles.traits),
    archetypes: await readGearCatalog(catalogDir, gearCatalogFiles.archetypes)
  };
}

function normalizeBody(body, chapter, chapters, options = {}) {
  const cleaned = body.replace(/^\uFEFF/, '').trim();

  if (!cleaned) {
    return 'TODO: раздел пока в подготовке.';
  }

  if (chapter.id === 'rulebook-skills') {
    return transformSkillsReferenceSource(cleaned);
  }

  let normalized = rewriteRulebookInternalLinks(cleaned, chapters);
  normalized = normalizeCharacterSheetExamples(normalized);

  if (chapter.id === 'rulebook-abilities-equipment') {
    normalized = transformAbilitiesEquipmentSource(normalized, options.gearCatalogs);
  }

  if (chapter.id === 'rulebook-character-creation') {
    normalized = transformCharacterCreationSource(normalized, options.gearCatalogs?.archetypes);
  }

  if (chapter.title === 'Бой') {
    normalized = normalized.replace(
      /\[Основные правила\]\(\)/g,
      '[Основные правила](05-osnovnye-pravila)'
    );
  }

  return normalized;
}

async function readGeneratedState() {
  try {
    const raw = await readFile(generatedStatePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeGeneratedState(generatedFiles) {
  await writeFile(generatedStatePath, `${JSON.stringify(generatedFiles, null, 2)}\n`, 'utf8');
}

function readFrontmatterDate(document, key) {
  const match = new RegExp(`^${key}: ["']?(\\d{4}-\\d{2}-\\d{2})["']?$`, 'mu').exec(document);
  return match?.[1] ?? '';
}

function withoutGeneratedDates(document) {
  return String(document ?? '')
    .replace(/^created:.*$/mu, 'created:')
    .replace(/^modified:.*$/mu, 'modified:')
    .replace(/\r\n?/g, '\n');
}

async function resolveGeneratedDates(targetPath, candidate, sourceModified) {
  try {
    const existing = await readFile(targetPath, 'utf8');
    const existingCreated = readFrontmatterDate(existing, 'created') || sourceModified;
    if (withoutGeneratedDates(existing) === withoutGeneratedDates(candidate)) {
      return {
        created: existingCreated,
        modified: readFrontmatterDate(existing, 'modified') || sourceModified
      };
    }
    return { created: existingCreated, modified: sourceModified };
  } catch {
    return { created: sourceModified, modified: sourceModified };
  }
}

export async function syncBook() {
  const source = await prepareRulebookSource({ repoRoot });
  const gearCatalogSource = await prepareGearCatalogSource({ repoRoot });
  const chapters = await validateRulebookManifest();
  const generatedEntries = getGeneratedRulebookEntries();
  const sourceDir = source.canonicalSourceDir;
  const gearCatalogs = await readGearCatalogs(gearCatalogSource.canonicalSourceDir);

  await mkdir(contentDir, { recursive: true });
  await mkdir(rulebookDir, { recursive: true });

  const previouslyGenerated = await readGeneratedState();
  const nextGeneratedFiles = [];

  for (const chapter of generatedEntries) {
    const sourcePath = resolve(sourceDir, chapter.source);
    const targetRelativePath = slugToContentPath(chapter.slug);
    const targetPath = resolve(contentDir, targetRelativePath);
    const sourceBody = await readFile(sourcePath, 'utf8');
    const sourceStats = await stat(sourcePath);
    const modified = formatDate(sourceStats.mtime);

    const frontmatter = {
      title: chapter.title,
      navTitle: chapter.navTitle,
      order: chapter.order,
      pageType: chapter.pageType,
      summary: chapter.summary,
      ...(chapter.aliases?.length ? { aliases: chapter.aliases } : {}),
      heroImage: chapter.heroImage,
      heroAlt: chapter.heroAlt,
      showHero: chapter.showHero,
      showToc: chapter.showToc,
      ...(chapter.temporaryNotice ? { temporaryNotice: chapter.temporaryNotice } : {}),
      parent: chapter.parent
    };
    const body = normalizeBody(sourceBody, chapter, generatedEntries, {
      gearCatalogs
    });
    const candidate = withFrontmatter({ ...frontmatter, created: modified, modified }, body);
    const dates = await resolveGeneratedDates(targetPath, candidate, modified);
    const generated = withFrontmatter({ ...frontmatter, ...dates }, body);

    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, generated, 'utf8');
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
    generatedFiles: nextGeneratedFiles.map((file) => resolve(contentDir, file))
  };
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const { sourceDir: source, contentDir: target, generatedFiles } = await syncBook();
  console.log(`Synced ${source} -> ${target}`);
  console.log(`Generated ${generatedFiles.length} files.`);
}
