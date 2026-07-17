import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeName(value) {
  return String(value ?? '')
    .toLocaleLowerCase('ru')
    .replaceAll('ё', 'е')
    .replace(/[^a-zа-я0-9]+/giu, ' ')
    .trim();
}

function unique(values) {
  return [...new Set(values)];
}

function actorItems(snapshotRow) {
  return Array.isArray(snapshotRow?.items) ? snapshotRow.items : [];
}

function activeSkills(actor) {
  return Object.entries(actor?.system?.skills ?? {})
    .filter(([, skill]) => Number(skill?.value) > 0)
    .map(([key, skill]) => ({ key, value: Number(skill.value) }));
}

function buildCatalogIndex(catalogs) {
  const index = new Map();
  for (const [catalog, entries] of Object.entries(catalogs)) {
    for (const entry of entries) {
      const candidates = [entry, entry?.ability].filter(Boolean);
      for (const candidate of candidates) {
        const key = normalizeName(candidate.name);
        if (!key) continue;
        const matches = index.get(key) ?? [];
        matches.push({ catalog, id: candidate.id, name: candidate.name });
        index.set(key, matches);
      }
    }
  }
  return index;
}

function buildArchetypeSuggestions(actor, archetypes) {
  const skills = actor?.system?.skills ?? {};
  return archetypes
    .map((archetype) => ({
      id: archetype.id,
      name: archetype.name,
      skill: archetype.skill,
      oldValue: Number(skills?.[archetype.skill]?.value) || 0
    }))
    .sort(
      (left, right) => right.oldValue - left.oldValue || left.name.localeCompare(right.name, 'ru')
    )
    .slice(0, 3);
}

function getAbilityRows(snapshot, catalogIndex) {
  const byName = new Map();
  for (const row of snapshot) {
    for (const item of actorItems(row)) {
      if (item.type !== 'trait-source-ability') continue;
      const key = normalizeName(item.name);
      const existing = byName.get(key) ?? {
        name: item.name,
        owners: [],
        itemIds: [],
        variants: [],
        exactCatalogMatches: catalogIndex.get(key) ?? []
      };
      existing.owners.push(row.actor.name);
      existing.itemIds.push(item._id);
      existing.variants.push({
        owner: row.actor.name,
        description: String(item.system?.description ?? ''),
        rank: item.system?.rank ?? '',
        skill: item.system?.skill ?? '',
        frequency: item.system?.usageFrequency ?? item.system?.frequency ?? ''
      });
      byName.set(key, existing);
    }
  }

  return [...byName.values()]
    .map((ability) => ({
      ...ability,
      owners: unique(ability.owners),
      descriptionsDiffer: unique(ability.variants.map((variant) => variant.description)).length > 1
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
}

function buildAudit(snapshot, catalogs, currentSkills) {
  const catalogIndex = buildCatalogIndex(catalogs);
  const archetypes = catalogs.archetypes ?? [];
  const actors = snapshot.map((row) => {
    const actor = row.actor;
    const skills = activeSkills(actor);
    return {
      id: actor._id,
      name: actor.name,
      type: actor.type,
      currentRank: Number(actor.system?.currentRank) || 1,
      oldHeroPoints: Number(actor.system?.momentOfGlory) || 0,
      itemCount: actorItems(row).length,
      abilityCount: actorItems(row).filter((item) => item.type === 'trait-source-ability').length,
      skills,
      obsoleteSkills: skills.filter((skill) => !currentSkills.has(skill.key)),
      archetypeSuggestions: buildArchetypeSuggestions(actor, archetypes),
      legacyFields: {
        characteristics: Boolean(actor.system?.abilities),
        defenses: Object.keys(actor.system?.defenses ?? {}),
        biographyIsObject: actor.system?.biography?.constructor === Object
      }
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    actors,
    abilities: getAbilityRows(snapshot, catalogIndex),
    summary: {
      actors: actors.length,
      playerCharacters: actors.filter((actor) => actor.type === 'playerCharacter').length,
      abilityInstances: actors.reduce((total, actor) => total + actor.abilityCount, 0),
      uniqueAbilities: getAbilityRows(snapshot, catalogIndex).length,
      exactPublishedMatches: getAbilityRows(snapshot, catalogIndex).filter((ability) =>
        ability.exactCatalogMatches.some((match) => match.catalog === 'abilities')
      ).length,
      exactConceptMatches: getAbilityRows(snapshot, catalogIndex).filter((ability) =>
        ability.exactCatalogMatches.some((match) => match.catalog === 'conceptAbilities')
      ).length
    }
  };
}

function formatActor(actor) {
  const skills = actor.skills.length
    ? actor.skills.map((skill) => `\`${skill.key}\` ${skill.value}`).join(', ')
    : '—';
  const obsolete = actor.obsoleteSkills.length
    ? actor.obsoleteSkills.map((skill) => `\`${skill.key}\` ${skill.value}`).join(', ')
    : '—';
  const suggestions = actor.archetypeSuggestions
    .map((entry) => `${entry.name} (\`${entry.skill}\` ${entry.oldValue})`)
    .join('; ');
  return `| ${actor.name} | ${actor.currentRank} | ${actor.oldHeroPoints} | ${actor.itemCount} | ${actor.abilityCount} | ${skills} | ${obsolete} | ${suggestions} |`;
}

function formatAbility(ability) {
  const owners = ability.owners.join(', ');
  const matches = ability.exactCatalogMatches.length
    ? ability.exactCatalogMatches.map((match) => `${match.catalog}:\`${match.id}\``).join(', ')
    : '—';
  const variant = ability.variants[0];
  const description = variant.description.replaceAll('|', '\\|').replace(/\s+/gu, ' ').trim();
  return [
    `### ${ability.name}`,
    '',
    `- Владельцы: ${owners}`,
    `- Точные совпадения в каталогах: ${matches}`,
    `- Старые поля: ранг \`${variant.rank || '—'}\`, навык \`${variant.skill || '—'}\`, частота \`${variant.frequency || '—'}\``,
    `- Описания между копиями различаются: ${ability.descriptionsDiffer ? 'да' : 'нет'}`,
    `- Старое описание: ${description || '—'}`,
    '- Решение: `TODO: personal | campaign | canon | replace | remove`',
    '- Новые поля: `TODO: rank, skill, activation, frequency, requiresRoll, damage, wording`',
    ''
  ].join('\n');
}

function formatMarkdown(audit) {
  const lines = [
    '# Аудит миграции мира 312',
    '',
    `Создано: ${audit.generatedAt}`,
    '',
    '## Сводка',
    '',
    `- Актёров: ${audit.summary.actors}`,
    `- Экземпляров способностей: ${audit.summary.abilityInstances}`,
    `- Уникальных способностей: ${audit.summary.uniqueAbilities}`,
    `- Точных совпадений с опубликованными: ${audit.summary.exactPublishedMatches}`,
    `- Точных совпадений с concept-abilities: ${audit.summary.exactConceptMatches}`,
    '',
    '## Актёры',
    '',
    '| Актёр | Ранг | Старые ОС | Предметы | Способности | Ненулевые навыки | Устаревшие навыки | Кандидаты в архетипы |',
    '|---|---:|---:|---:|---:|---|---|---|',
    ...audit.actors.map(formatActor),
    '',
    '## Способности',
    '',
    ...audit.abilities.flatMap((ability) => formatAbility(ability).split('\n'))
  ];
  return `${lines.join('\n')}\n`;
}

const [snapshotArg, templateArg, catalogsArg, outputArg] = process.argv.slice(2);
if (!snapshotArg || !templateArg || !catalogsArg || !outputArg) {
  fail(
    'Usage: node audit-snapshot.mjs <pc-snapshot.json> <template.json> <catalog-directory> <output-directory>'
  );
} else {
  const snapshotPath = path.resolve(snapshotArg);
  const templatePath = path.resolve(templateArg);
  const catalogDirectory = path.resolve(catalogsArg);
  const outputDirectory = path.resolve(outputArg);
  const snapshot = readJson(snapshotPath);
  const template = readJson(templatePath);
  const catalogs = {
    abilities: readJson(path.join(catalogDirectory, 'abilities.json')),
    conceptAbilities: readJson(path.join(catalogDirectory, 'concept-abilities.json')),
    traits: readJson(path.join(catalogDirectory, 'traits.json')),
    archetypes: readJson(path.join(catalogDirectory, 'archetypes.json'))
  };
  const currentSkills = new Set(Object.keys(template?.Actor?.templates?.base?.skills ?? {}));
  const audit = buildAudit(snapshot, catalogs, currentSkills);

  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
  fs.writeFileSync(path.join(outputDirectory, 'audit.md'), formatMarkdown(audit));
  console.log(JSON.stringify({ outputDirectory, summary: audit.summary }, null, 2));
}
