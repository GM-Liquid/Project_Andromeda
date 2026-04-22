import { access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(scriptDir, '..');
const repoRoot = resolve(siteRoot, '..');
const sourceDir = resolve(repoRoot, 'Книга правил v0.4');
const contentDir = resolve(siteRoot, 'content');
const staticDir = resolve(siteRoot, 'quartz', 'static');

export const rulebookManifest = [
  {
    id: 'rulebook-introduction',
    type: 'generated',
    slug: 'rulebook/01-vvedenie',
    source: 'Глава 1. Введение.md',
    title: 'Введение',
    navTitle: 'Введение',
    order: 20,
    pageType: 'chapter',
    summary:
      'О чем игра, как устроены сцены и чем Project Andromeda отличается от пошаговой симуляции каждого действия.',
    aliases: ['index'],
    heroImage: null,
    heroAlt: null,
    showHero: true,
    showToc: true,
    showInHeaderNav: true,
    parent: null
  },
  {
    id: 'rulebook-character-creation',
    type: 'generated',
    slug: 'rulebook/02-sozdanie-personazha',
    source: 'Глава 2. Создание персонажа.md',
    title: 'Создание персонажа',
    navTitle: 'Персонаж',
    order: 30,
    pageType: 'chapter',
    summary:
      'Пошаговая сборка героя: архетип, ценности, характеристики, навыки, снаряжение и итоговые параметры.',
    heroImage: 'assets/rulebook/art-core-1.webp',
    heroAlt: 'Абстрактный арт для раздела о создании персонажа.',
    showHero: true,
    showToc: true,
    showInHeaderNav: true,
    parent: null
  },
  {
    id: 'rulebook-skills',
    type: 'generated',
    slug: 'rulebook/03-navyki',
    source: 'Глава 3. Навыки.md',
    title: 'Навыки',
    navTitle: 'Навыки',
    order: 40,
    pageType: 'chapter',
    summary:
      'Справочная глава с расшифровкой уровней навыков и аккордеонами по ключевым навыкам тела, разума и духа.',
    aliases: ['skills-reference'],
    heroImage: 'assets/rulebook/art-core-1.webp',
    heroAlt: 'Абстрактный арт для главы о навыках.',
    showHero: true,
    showToc: true,
    parent: null
  },
  {
    id: 'rulebook-abilities-equipment',
    type: 'generated',
    slug: 'rulebook/04-sposobnosti-i-snaryazhenie',
    source: 'Глава 4. Способности и снаряжение.md',
    title: 'Способности и снаряжение',
    navTitle: 'Снаряжение',
    order: 50,
    pageType: 'chapter',
    summary:
      'Способности, экипировка и каталоги, которые расширяют возможности персонажа за пределами базовых навыков.',
    aliases: ['03-sposobnosti-i-snaryazhenie'],
    heroImage: null,
    heroAlt: null,
    showHero: true,
    showToc: true,
    parent: null
  },
  {
    id: 'rulebook-core-rules',
    type: 'generated',
    slug: 'rulebook/05-osnovnye-pravila',
    source: 'Глава 5. Основные правила.md',
    title: 'Основные правила',
    navTitle: 'Правила',
    order: 60,
    pageType: 'chapter',
    summary:
      'Базовая модель бросков, проверки, движение, стресс и другие фундаментальные правила игры.',
    aliases: ['01-osnovnye-pravila'],
    heroImage: null,
    heroAlt: null,
    showHero: true,
    showToc: true,
    showInHeaderNav: true,
    parent: null
  },
  {
    id: 'rulebook-combat',
    type: 'generated',
    slug: 'rulebook/06-boy',
    source: 'Глава 6. Бой.md',
    title: 'Бой',
    navTitle: 'Бой',
    order: 70,
    pageType: 'chapter',
    summary:
      'Структура боевой сцены, действия персонажей и все, что нужно для разрешения конфликта в тактах.',
    aliases: ['04-boy'],
    heroImage: null,
    heroAlt: null,
    showHero: true,
    showToc: true,
    showInHeaderNav: true,
    parent: null
  },
  {
    id: 'rulebook-negotiations',
    type: 'generated',
    slug: 'rulebook/07-peregovory',
    source: 'Глава 7. Переговоры.md',
    title: 'Переговоры',
    navTitle: 'Переговоры',
    order: 80,
    pageType: 'chapter',
    summary:
      'Социальные сцены, давление, убеждение и правила, которые поддерживают переговоры как полноценную механику.',
    aliases: ['05-peregovory'],
    heroImage: null,
    heroAlt: null,
    showHero: true,
    showToc: true,
    parent: null
  }
];

export function getRulebookManifest() {
  return [...rulebookManifest].sort((left, right) => left.order - right.order);
}

export function getGeneratedRulebookEntries() {
  return getRulebookManifest().filter((entry) => entry.type === 'generated');
}

export function slugToContentPath(slug) {
  return `${slug}.md`;
}

function resolveHeroImagePath(heroImage) {
  if (!heroImage) {
    return null;
  }

  if (heroImage.startsWith('static/')) {
    return resolve(staticDir, heroImage.replace(/^static\//, ''));
  }

  return resolve(contentDir, heroImage);
}

async function assertPathExists(pathToCheck, message) {
  try {
    await access(pathToCheck);
  } catch (error) {
    throw new Error(`${message}: ${pathToCheck}`, { cause: error });
  }
}

export async function validateRulebookManifest() {
  const manifest = getRulebookManifest();
  const seenIds = new Set();
  const seenSlugs = new Set();
  const seenOrders = new Set();

  for (const entry of manifest) {
    if (seenIds.has(entry.id)) {
      throw new Error(`Duplicate rulebook manifest id: ${entry.id}`);
    }
    seenIds.add(entry.id);

    if (seenSlugs.has(entry.slug)) {
      throw new Error(`Duplicate rulebook manifest slug: ${entry.slug}`);
    }
    seenSlugs.add(entry.slug);

    if (seenOrders.has(entry.order)) {
      throw new Error(`Duplicate rulebook manifest order: ${entry.order}`);
    }
    seenOrders.add(entry.order);

    if (!entry.title || !entry.navTitle || !entry.pageType) {
      throw new Error(`Rulebook manifest entry is missing required labels: ${entry.id}`);
    }

    if (entry.type === 'generated') {
      if (!entry.source) {
        throw new Error(`Generated rulebook entry is missing source: ${entry.id}`);
      }

      await assertPathExists(
        resolve(sourceDir, entry.source),
        `Missing generated source file for ${entry.id}`
      );
    } else if (entry.type === 'manual') {
      if (!entry.file) {
        throw new Error(`Manual rulebook entry is missing file: ${entry.id}`);
      }

      await assertPathExists(
        resolve(contentDir, entry.file),
        `Missing manual content file for ${entry.id}`
      );
    } else {
      throw new Error(`Unsupported rulebook entry type for ${entry.id}: ${entry.type}`);
    }

    const heroImagePath = resolveHeroImagePath(entry.heroImage);
    if (heroImagePath) {
      await assertPathExists(heroImagePath, `Missing hero image for ${entry.id}`);
    }
  }

  return manifest;
}
