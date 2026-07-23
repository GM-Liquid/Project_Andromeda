import { MODULE_ID } from '../config.mjs';
import {
  DEFAULT_ITEM_USAGE_FREQUENCY,
  ITEM_ACTIVATION_TYPE_LABEL_KEYS,
  normalizeUsageFrequency
} from './item-config.mjs';
import { formatDamageProfile } from './damage-profile.mjs';
import { deepClone, stableStringify } from './object-utils.mjs';
import { normalizeStepEffects } from './step-effects.mjs';
import { buildArchetypeAbilityVersionSystemData } from './archetype.mjs';

// Pure JSON -> Item-system transform for the shipped gear catalog. This is the
// single source of truth used to compile the `gear-library` compendium pack
// (tools/build-pack.mjs). It never touches Foundry world items.

const GEAR_CATALOG_SYNC_ID_FLAG = 'sheetSyncId';
const GEAR_CATALOG_SYNC_SYSTEM_JSON_COLUMN = 'systemJson';
const GEAR_CATALOG_SYNC_ALLOWED_ACTIVATION_TYPES = new Set(
  Object.keys(ITEM_ACTIVATION_TYPE_LABEL_KEYS)
);

// Seven ability-shaped entries and the former equipment catalog moved into the
// artifact catalog in 0.5. Their old sync-id namespaces stay stable so existing
// actor links can be migrated without guessing by name.
export const LEGACY_ABILITY_ARTIFACT_IDS = new Set([
  'blackout',
  'rychag',
  'ekstrennyy-teleport',
  'zashchita',
  'vrata',
  'spasitel',
  'tsss'
]);

const GEAR_ARTIFACT_CONFIG = {
  catalogKey: 'artifacts',
  sheetKey: 'artifacts',
  itemType: 'artifact',
  folderName: 'Артефакты'
};

const GEAR_ABILITY_CONFIG = {
  catalogKey: 'abilities',
  sheetKey: 'abilities',
  itemType: 'trait-source-ability',
  folderName: 'Способности'
};

const GEAR_TRAIT_CONFIG = {
  catalogKey: 'traits',
  sheetKey: 'traits',
  itemType: 'trait',
  folderName: 'Черты'
};

const GEAR_ARCHETYPE_CONFIG = {
  catalogKey: 'archetypes',
  sheetKey: 'archetypes',
  itemType: 'archetype',
  folderName: 'Архетипы'
};

const GEAR_DEFENSE_KEYS = new Set(['fortitude', 'control', 'will']);

const GEAR_CATALOG_SOURCES = [
  { catalogKey: 'artifacts', resolveConfig: () => GEAR_ARTIFACT_CONFIG },
  { catalogKey: 'abilities', resolveConfig: () => GEAR_ABILITY_CONFIG },
  { catalogKey: 'traits', resolveConfig: () => GEAR_TRAIT_CONFIG }
];

const GEAR_CATALOG_SHEET_KEYS = ['artifacts', 'abilities', 'traits', 'archetypes'];

function normalizeString(value) {
  return String(value ?? '');
}

function normalizeOptionalString(value) {
  return normalizeString(value).trim();
}

function normalizeCatalogEntries(entries) {
  return Array.isArray(entries)
    ? entries.filter((entry) => entry && typeof entry === 'object' && entry.id && entry.name)
    : [];
}

function buildGearCatalogEntrySyncId(catalogKey, entry) {
  return `gear:${catalogKey}:${normalizeOptionalString(entry?.id)}`;
}

function getGearCatalogSyncCatalogKey(entry, config) {
  if (config.catalogKey !== 'artifacts') return config.catalogKey;
  return LEGACY_ABILITY_ARTIFACT_IDS.has(normalizeOptionalString(entry?.id))
    ? 'abilities'
    : 'equipment';
}

function getGearCatalogRank(entry) {
  const rank = Number(entry?.rank);
  return Number.isFinite(rank) && rank > 0 ? String(rank) : '';
}

function getGearCatalogFolderPath(entry, config) {
  const rank = getGearCatalogRank(entry);
  const rankFolder = rank ? `Ранг ${rank}` : 'Без ранга';
  return `${config.folderName}/${rankFolder}`;
}

function getGearCatalogSkill(entry) {
  return normalizeOptionalString(entry?.skill);
}

function getGearCatalogDescription(entry) {
  return normalizeString(entry?.description);
}

function getGearCatalogShortDescription(entry) {
  return normalizeString(entry?.shortDescription);
}

function getGearCatalogEffects(entry) {
  return Array.isArray(entry?.mechanics?.effects) ? entry.mechanics.effects : [];
}

function getGearCatalogOutcomes(entry) {
  return getGearCatalogEffects(entry).flatMap((effect) =>
    Array.isArray(effect?.outcomes) ? effect.outcomes : []
  );
}

// Optional, hand-authored step effects carried straight through from the catalog
// entry. Absent field -> empty list (backward compatible with older catalogs).
function getGearCatalogStepEffects(entry) {
  return normalizeStepEffects(entry?.stepEffects);
}

function getFirstOutcomeDamageProfile(entry) {
  for (const outcome of getGearCatalogOutcomes(entry)) {
    if (String(outcome?.key ?? '') !== 'damage') continue;
    const value = outcome?.value ?? outcome?.amount ?? 0;
    return formatDamageProfile(value);
  }
  return formatDamageProfile(0);
}

function getGearCatalogActivationType(entry) {
  const activationType = normalizeOptionalString(
    getGearCatalogEffects(entry).find((effect) => effect?.activation?.type)?.activation?.type
  );
  if (GEAR_CATALOG_SYNC_ALLOWED_ACTIVATION_TYPES.has(activationType)) return activationType;
  return 'passive';
}

function getGearCatalogConditionValue(entry, selector) {
  for (const effect of getGearCatalogEffects(entry)) {
    const value = selector(effect?.conditions ?? {}, effect);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

function formatGearCatalogRange(range) {
  if (!range || typeof range !== 'object') return '';
  const type = normalizeOptionalString(range.type);
  if (type === 'melee') return 'melee';
  if (type === 'self') return 'self';
  const value = Number(range.value);
  if (type === 'meters' && Number.isFinite(value)) return `${value} m`;
  return type;
}

function getGearCatalogRange(entry) {
  return getGearCatalogConditionValue(entry, (conditions) =>
    formatGearCatalogRange(conditions.range)
  );
}

function formatGearCatalogArea(area) {
  if (!area || typeof area !== 'object') return '';
  const type = normalizeOptionalString(area.type);
  const value = Number(area.value);
  if (type && Number.isFinite(value)) return `${type} ${value} m`;
  return type;
}

function getGearCatalogArea(entry) {
  return getGearCatalogConditionValue(entry, (conditions) =>
    formatGearCatalogArea(conditions.area)
  );
}

function getGearCatalogUsageFrequency(entry) {
  return normalizeUsageFrequency(
    getGearCatalogConditionValue(entry, (conditions) =>
      normalizeOptionalString(conditions.frequency)
    ) || DEFAULT_ITEM_USAGE_FREQUENCY
  );
}

function getGearCatalogTargets(entry) {
  return getGearCatalogConditionValue(entry, (conditions) =>
    normalizeOptionalString(conditions.targets)
  );
}

function getGearCatalogDefense(entry) {
  return getGearCatalogConditionValue(entry, (conditions) =>
    normalizeOptionalString(conditions.defense)
  );
}

function getGearCatalogDuration(entry) {
  return getGearCatalogConditionValue(entry, (conditions) =>
    normalizeOptionalString(conditions.duration)
  );
}

function getGearCatalogRequiresRoll(entry, { fallbackToSkill = true } = {}) {
  const rollChecks = new Set(['required', 'successBonus', 'failureRisk']);
  for (const effect of getGearCatalogEffects(entry)) {
    const check = normalizeOptionalString(effect?.conditions?.check);
    if (rollChecks.has(check)) return true;
  }
  return fallbackToSkill ? Boolean(getGearCatalogSkill(entry)) : false;
}

function buildGearCatalogDetails(catalogKey, entry) {
  return {
    gearCatalog: {
      id: normalizeOptionalString(entry?.id),
      catalog: catalogKey,
      sourceType: normalizeOptionalString(entry?.type),
      price: entry?.price ?? null,
      shortDescription: getGearCatalogShortDescription(entry),
      mechanics: deepClone(entry?.mechanics ?? {})
    }
  };
}

function buildGearCatalogSystemData(entry, config) {
  const systemData = {
    description: getGearCatalogDescription(entry),
    rank: getGearCatalogRank(entry),
    mode: normalizeOptionalString(entry?.mode),
    usageFrequency: getGearCatalogUsageFrequency(entry),
    activationCost: getGearCatalogActivationType(entry),
    activationType: getGearCatalogActivationType(entry),
    range: getGearCatalogRange(entry),
    duration: getGearCatalogDuration(entry),
    area: getGearCatalogArea(entry),
    defense: getGearCatalogDefense(entry),
    targets: getGearCatalogTargets(entry),
    details: buildGearCatalogDetails(config.catalogKey, entry)
  };

  if (config.itemType === 'trait-source-ability') {
    const skill = getGearCatalogSkill(entry);
    return {
      ...systemData,
      requiresRoll: getGearCatalogRequiresRoll(entry, { fallbackToSkill: false }),
      skill,
      skillBonus: getFirstOutcomeDamageProfile(entry),
      stepEffects: getGearCatalogStepEffects(entry)
    };
  }

  // Черты — пассивные улучшения: держим ссылку на профильный навык, но никогда не
  // помечаем их как требующие броска (в отличие от активных способностей).
  if (config.itemType === 'trait') {
    return {
      ...systemData,
      requiresRoll: false,
      skill: getGearCatalogSkill(entry),
      skillBonus: getFirstOutcomeDamageProfile(entry),
      stepEffects: getGearCatalogStepEffects(entry)
    };
  }

  const skill = getGearCatalogSkill(entry);
  return {
    ...systemData,
    requiresRoll: getGearCatalogRequiresRoll(entry),
    skill,
    skillBonus: getFirstOutcomeDamageProfile(entry),
    stepEffects: getGearCatalogStepEffects(entry)
  };
}

function buildGearCatalogImportRow(entry, config) {
  const systemData = buildGearCatalogSystemData(entry, config);
  const row = {
    syncId: buildGearCatalogEntrySyncId(getGearCatalogSyncCatalogKey(entry, config), entry),
    type: config.itemType,
    name: normalizeString(entry?.name),
    ownerName: '',
    folderPath: getGearCatalogFolderPath(entry, config),
    [GEAR_CATALOG_SYNC_SYSTEM_JSON_COLUMN]: stableStringify(systemData, 2),
    'system.rank': systemData.rank ?? '',
    'system.description': systemData.description ?? ''
  };

  row['system.usageFrequency'] = systemData.usageFrequency ?? DEFAULT_ITEM_USAGE_FREQUENCY;
  row['system.activationCost'] = systemData.activationCost ?? '';
  row['system.activationType'] = systemData.activationType ?? '';
  row['system.range'] = systemData.range ?? '';
  row['system.duration'] = systemData.duration ?? '';
  row['system.area'] = systemData.area ?? '';
  row['system.defense'] = systemData.defense ?? '';
  row['system.targets'] = systemData.targets ?? '';
  row['system.skill'] = systemData.skill ?? '';
  row['system.requiresRoll'] = Boolean(systemData.requiresRoll);

  row['system.skillBonus'] = systemData.skillBonus;

  return row;
}

function normalizeArchetypeDefenseKey(value) {
  const key = normalizeOptionalString(value);
  return GEAR_DEFENSE_KEYS.has(key) ? key : '';
}

function buildArchetypeAbilitySyncId(entry) {
  const abilityId = normalizeOptionalString(entry?.ability?.id);
  return abilityId ? buildGearCatalogEntrySyncId('abilities', entry.ability) : '';
}

function buildArchetypeTraitSyncId(entry) {
  const traitId = normalizeOptionalString(entry?.trait?.id);
  return traitId ? buildGearCatalogEntrySyncId('traits', entry.trait) : '';
}

function buildArchetypeDescription(entry) {
  return getGearCatalogDescription(entry);
}

function buildArchetypeImportRow(entry, config) {
  const profile = entry?.defenseProfile ?? {};
  const abilitySyncId = buildArchetypeAbilitySyncId(entry);
  const traitSyncId = buildArchetypeTraitSyncId(entry);
  const systemData = {
    description: buildArchetypeDescription(entry),
    skill: getGearCatalogSkill(entry),
    defenseProfile: {
      strong: normalizeArchetypeDefenseKey(profile.strong),
      medium: normalizeArchetypeDefenseKey(profile.medium),
      weak: normalizeArchetypeDefenseKey(profile.weak)
    },
    stressBonusPerRank: Math.max(0, Number(entry?.stressBonusPerRank) || 0),
    trait: deepClone(entry?.trait ?? {}),
    traitSyncId,
    traitName: normalizeString(entry?.trait?.name),
    abilitySyncId,
    abilityName: normalizeString(entry?.ability?.name),
    details: buildGearCatalogDetails(config.catalogKey, entry)
  };

  return {
    syncId: buildGearCatalogEntrySyncId(config.catalogKey, entry),
    type: config.itemType,
    name: normalizeString(entry?.name),
    ownerName: '',
    folderPath: config.folderName,
    [GEAR_CATALOG_SYNC_SYSTEM_JSON_COLUMN]: stableStringify(systemData, 2),
    'system.description': systemData.description ?? '',
    'system.skill': systemData.skill ?? '',
    'system.abilitySyncId': abilitySyncId,
    'system.traitSyncId': traitSyncId
  };
}

function buildArchetypeAbilityImportRow(entry) {
  const ability = entry?.ability;
  const versionData = buildArchetypeAbilityVersionSystemData(ability, 1);
  if (!versionData) return null;
  const systemData = {
    ...versionData.system,
    details: {
      ...buildGearCatalogDetails('abilities', ability),
      archetypeAbility: deepClone(ability)
    }
  };
  return {
    syncId: buildGearCatalogEntrySyncId('abilities', ability),
    type: GEAR_ABILITY_CONFIG.itemType,
    name: versionData.name,
    ownerName: '',
    folderPath: getGearCatalogFolderPath(ability, GEAR_ABILITY_CONFIG),
    [GEAR_CATALOG_SYNC_SYSTEM_JSON_COLUMN]: stableStringify(systemData, 2),
    'system.rank': systemData.rank,
    'system.description': systemData.description,
    'system.skill': systemData.skill,
    'system.requiresRoll': systemData.requiresRoll,
    'system.skillBonus': systemData.skillBonus
  };
}

export function buildGearCatalogRemoteDataFromCatalogs(catalogs = {}) {
  const sheets = {};
  for (const sheetKey of GEAR_CATALOG_SHEET_KEYS) {
    sheets[sheetKey] = [];
  }

  for (const source of GEAR_CATALOG_SOURCES) {
    for (const entry of normalizeCatalogEntries(catalogs[source.catalogKey])) {
      const config = source.resolveConfig(entry);
      sheets[config.sheetKey].push(buildGearCatalogImportRow(entry, config));
    }
  }

  // Archetypes build their own item plus the ability and trait they grant. Both
  // grants are emitted into their regular shared folders, so actor sheets classify
  // them exactly like ordinary abilities and traits while retaining stable links.
  for (const entry of normalizeCatalogEntries(catalogs[GEAR_ARCHETYPE_CONFIG.catalogKey])) {
    sheets[GEAR_ARCHETYPE_CONFIG.sheetKey].push(
      buildArchetypeImportRow(entry, GEAR_ARCHETYPE_CONFIG)
    );
    const ability = entry?.ability;
    if (ability && ability.id && ability.name) {
      const abilityRow = buildArchetypeAbilityImportRow(entry);
      if (abilityRow) sheets[GEAR_ABILITY_CONFIG.sheetKey].push(abilityRow);
    }
    const trait = entry?.trait;
    if (trait && trait.id && trait.name) {
      sheets[GEAR_TRAIT_CONFIG.sheetKey].push(buildGearCatalogImportRow(trait, GEAR_TRAIT_CONFIG));
    }
  }

  return {
    meta: {
      moduleId: MODULE_ID,
      moduleVersion: typeof game === 'undefined' ? '' : String(game.system?.version ?? ''),
      source: 'gear-catalog',
      importedAt: new Date().toISOString()
    },
    sheets
  };
}

export { GEAR_CATALOG_SYNC_ID_FLAG, GEAR_CATALOG_SYNC_SYSTEM_JSON_COLUMN };
