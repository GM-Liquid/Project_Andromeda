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
import { transformSkillsReferenceSource } from './skills-reference-source.mjs';

export { transformSkillsReferenceSource } from './skills-reference-source.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, '..');
const repoRoot = resolve(siteRoot, '..');

const contentDir = resolve(siteRoot, 'content');
const rulebookDir = resolve(contentDir, 'rulebook');
const generatedStatePath = resolve(contentDir, '.generated-rulebook.json');
const gearCatalogFiles = {
  armor: 'armor.json',
  equipment: 'equipment.json',
  abilities: 'abilities.json'
};
const conceptAbilitiesCatalogFilename = 'concept-abilities.json';

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
      .map((chapter) => [
        chapter.source.replace(/\.md$/i, ''),
        basename(chapter.slug)
      ])
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
    .replace(/\[\[([^\]|#]+)?(#[^\]|]+)?(\|[^\]]*)?\]\]/g, (full, rawTarget = '', rawAnchor = '', rawAlias = '') => {
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
    })
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
    ...rows.map(
      (row) => `| ${row.map((cell) => escapeMarkdownTableCell(cell)).join(' | ')} |`
    )
  ].join('\n');
}

function getGearQuartzValue(item, key) {
  const value = item?.quartz?.[key];
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function getGearUsageValue(item, key) {
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
    const normalized = String(skill).trim();
    if (normalized) {
      return normalized;
    }
  }

  return getGearQuartzValue(item, 'skill');
}

function buildDescriptionPreview(description, maxLength = 110) {
  const normalized = String(description ?? '').replace(/\s+/g, ' ').trim();
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
  const shield = getGearQuartzValue(item, 'shield');

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
  const explicitPreview = Object.hasOwn(item?.quartz ?? {}, 'previewDescription')
    ? getGearQuartzValue(item, 'previewDescription')
    : (item.shortDescription ?? '').trim();

  return resolvePreviewDescription(explicitPreview, getGearDescription(item), buildStructuredGearPreview(item));
}

function getGearCatalogPrice(item) {
  if (item.finalCost === null || item.finalCost === undefined) {
    return '';
  }

  return String(item.finalCost);
}

function isPublishedGearCatalogItem(item) {
  return item?.status !== 'draft' && item?.status !== 'deprecated';
}

function getGearPropertyValue(item, propertyKey) {
  const property = item.properties?.find((candidate) => candidate.key === propertyKey);
  if (!property || property.value === null || property.value === undefined) {
    return '';
  }

  return String(property.value);
}

function getArmorDefenseValue(item, quartzKey, propertyKey) {
  return getGearQuartzValue(item, quartzKey) || getGearPropertyValue(item, propertyKey);
}

function getEquipmentTypeLabel(item) {
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

function getEquipmentDamageValue(item) {
  const description = getGearDescription(item);
  const damageMatch = description.match(/\bУрон:\s*([^.;]+)/u);
  return damageMatch ? damageMatch[1].trim() : '';
}

function buildArmorCatalogTable(catalog) {
  const rows = catalog.items
    .filter(isPublishedGearCatalogItem)
    .map((item) => [
      item.name,
      item.rank,
      getArmorDefenseValue(item, 'physicalDefense', 'fortitude-bonus-x'),
      getArmorDefenseValue(item, 'magicalDefense', 'control-bonus-x'),
      getArmorDefenseValue(item, 'psychicDefense', 'will-bonus-x'),
      getGearQuartzValue(item, 'shield'),
      getGearQuartzValue(item, 'speed'),
      getGearUsageOrQuartzValue(item, 'frequency'),
      getGearUsageOrQuartzValue(item, 'actions'),
      getGearUsageOrQuartzValue(item, 'duration'),
      getGearShortDescription(item),
      getGearDescription(item),
      getGearCatalogPrice(item)
    ]);

  return renderMarkdownTable(
    ['Название', 'Ранг', 'Стойкость', 'Контроль', 'Воля', 'Силовой щит', 'Скорость', 'Частота использования', 'Цена в действиях', 'Длительность', 'Краткое описание', 'Полное описание', 'Цена'],
    rows
  );
}

function buildEquipmentCatalogTable(catalog) {
  const rows = catalog.items
    .filter(isPublishedGearCatalogItem)
    .map((item) => [
      getEquipmentTypeLabel(item),
      item.name,
      item.rank,
      getGearSkillValue(item),
      getGearQuartzValue(item, 'damage') || getEquipmentDamageValue(item),
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
    ['Тип', 'Название', 'Ранг', 'Навык', 'Урон', 'Частота использования', 'Цена в действиях', 'Дальность', 'Цели', 'Зона', 'Защита', 'Длительность', 'Краткое описание', 'Полное описание', 'Цена'],
    rows
  );
}

function buildAbilityCatalogTable(catalog) {
  const rows = catalog.items
    .filter(isPublishedGearCatalogItem)
    .map((item) => [
      item.name,
      item.rank,
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

function buildConceptAbilityCatalogTable(catalog) {
  // Temporary catalog sourced from data/gear/catalog/concept-abilities.json.
  const rows = catalog.items
    .filter(isPublishedGearCatalogItem)
    .map((item) => [
      item.name ?? '',
      item.rank ?? '',
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
      getGearQuartzValue(item, 'credits') || getGearCatalogPrice(item)
    ]);

  return renderMarkdownTable(
    [
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
    ],
    rows
  );
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
    nextLines.push(sectionHeading);

    if (cleanedBody.length > 0) {
      nextLines.push('', ...cleanedBody);
    }

    const sectionTitle = sectionHeading.replace(/^##\s+/u, '').trim();
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
    abilities: await readGearCatalog(catalogDir, gearCatalogFiles.abilities)
  };
}

async function readConceptAbilitiesCatalog(catalogDir) {
  try {
    return await readGearCatalog(catalogDir, conceptAbilitiesCatalogFilename);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

function injectConceptAbilitiesSection(source, catalog) {
  if (!catalog || catalog.items.length === 0) {
    return source;
  }

  const section = [
    '## Концепт-способности',
    '',
    'Временный каталог идей и устаревших версий способностей. Нужен только для Quartz-подбора и ручного переноса понравившихся записей в основной каталог.',
    '',
    buildConceptAbilityCatalogTable(catalog)
  ].join('\n');

  return `${source.trimEnd()}\n\n${section}\n`;
}

function normalizeBody(body, chapter, chapters, options = {}) {
  const cleaned = body.replace(/^\uFEFF/, '').trim();

  if (!cleaned) {
    return 'TODO: раздел пока в подготовке.';
  }

  if (chapter.id === 'rulebook-skills-reference') {
    return transformSkillsReferenceSource(cleaned);
  }

  let normalized = rewriteRulebookInternalLinks(cleaned, chapters);
  normalized = normalizeCharacterSheetExamples(normalized);

  if (chapter.id === 'rulebook-abilities-equipment') {
    normalized = transformAbilitiesEquipmentSource(normalized, options.gearCatalogs);
    normalized = injectConceptAbilitiesSection(normalized, options.conceptAbilitiesCatalog);
  }


  if (chapter.title === 'Бой') {
    normalized = normalized.replace(
      /\[Основные правила\]\(\)/g,
      '[Основные правила](01-osnovnye-pravila)'
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

export async function syncBook() {
  const source = await prepareRulebookSource({ repoRoot });
  const gearCatalogSource = await prepareGearCatalogSource({ repoRoot });
  const chapters = await validateRulebookManifest();
  const generatedEntries = getGeneratedRulebookEntries();
  const sourceDir = source.canonicalSourceDir;
  const gearCatalogs = await readGearCatalogs(gearCatalogSource.canonicalSourceDir);
  const conceptAbilitiesCatalog = await readConceptAbilitiesCatalog(
    gearCatalogSource.canonicalSourceDir
  );

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

    const generated = withFrontmatter(
      {
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
        parent: chapter.parent,
        created: modified,
        modified
      },
      normalizeBody(sourceBody, chapter, generatedEntries, {
        gearCatalogs,
        conceptAbilitiesCatalog
      })
    );

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
