import { MODULE_ID } from '../config.mjs';
import {
  DEFAULT_ITEM_USAGE_FREQUENCY,
  ITEM_ACTIVATION_TYPE_LABEL_KEYS,
  normalizeUsageFrequency
} from './item-config.mjs';
import { formatDamageProfile } from './damage-profile.mjs';
import { normalizeStepEffects } from './step-effects.mjs';

// Pure JSON -> Item-system transform for the shipped gear catalog. This is the
// single source of truth used to compile the `gear-library` compendium pack
// (tools/build-pack.mjs). It never touches Foundry world items.

const GEAR_CATALOG_SYNC_ID_FLAG = 'sheetSyncId';
const GEAR_CATALOG_SYNC_SYSTEM_JSON_COLUMN = 'systemJson';
const GEAR_CATALOG_SYNC_ALLOWED_ACTIVATION_TYPES = new Set(
  Object.keys(ITEM_ACTIVATION_TYPE_LABEL_KEYS)
);

// The equipment catalog is split into weapons and general items the same way the
// public rulebook (Quartz) renders two tables: entries whose skill is a weapon skill
// (melee / ranged) become real `weapon` items, everything else stays a general
// `equipment` item shown under the "Предметы" / "Items" group.
const GEAR_WEAPON_SKILL_KEYS = new Set(['blizhniy_boy', 'strelba']);

const GEAR_ARMOR_CONFIG = {
  catalogKey: 'armor',
  sheetKey: 'armor',
  itemType: 'armor',
  folderName: 'Броня'
};

const GEAR_WEAPON_CONFIG = {
  catalogKey: 'equipment',
  sheetKey: 'weapons',
  itemType: 'weapon',
  folderName: 'Оружие'
};

const GEAR_ITEM_CONFIG = {
  catalogKey: 'equipment',
  sheetKey: 'equipment',
  itemType: 'equipment',
  folderName: 'Предметы'
};

const GEAR_ABILITY_CONFIG = {
  catalogKey: 'abilities',
  sheetKey: 'abilities',
  itemType: 'trait-source-ability',
  folderName: 'Способности'
};

function isWeaponCatalogEntry(entry) {
  return GEAR_WEAPON_SKILL_KEYS.has(getGearCatalogSkill(entry));
}

// Each catalog source maps every entry to its output config. The equipment catalog
// routes weapon-skilled entries to the weapon group and the rest to general items.
const GEAR_CATALOG_SOURCES = [
  { catalogKey: 'armor', resolveConfig: () => GEAR_ARMOR_CONFIG },
  {
    catalogKey: 'equipment',
    resolveConfig: (entry) => (isWeaponCatalogEntry(entry) ? GEAR_WEAPON_CONFIG : GEAR_ITEM_CONFIG)
  },
  { catalogKey: 'abilities', resolveConfig: () => GEAR_ABILITY_CONFIG }
];

const GEAR_CATALOG_SHEET_KEYS = ['armor', 'weapons', 'equipment', 'abilities'];

function deepClone(value) {
  if (typeof foundry !== 'undefined' && foundry.utils?.deepClone) {
    return foundry.utils.deepClone(value);
  }
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }

  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .reduce((accumulator, key) => {
        accumulator[key] = sortValue(value[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value ?? {}), null, 2);
}

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

function getOutcomeNumber(entry, keys) {
  const keySet = new Set(keys);
  return getGearCatalogOutcomes(entry).reduce((total, outcome) => {
    if (!keySet.has(String(outcome?.key ?? ''))) return total;
    const value = Number(outcome?.value ?? outcome?.amount ?? 0);
    return Number.isFinite(value) ? total + value : total;
  }, 0);
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

  if (config.itemType === 'armor') {
    return {
      ...systemData,
      itemPhys: getOutcomeNumber(entry, ['fortitudeBonus']),
      itemAzure: getOutcomeNumber(entry, ['controlBonus']),
      itemMental: getOutcomeNumber(entry, ['willBonus']),
      itemShield: getOutcomeNumber(entry, ['shieldBonus', 'grantTempStress']),
      itemSpeed: getOutcomeNumber(entry, ['speedBonus']),
      quantity: 1
    };
  }

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

  if (config.itemType === 'weapon') {
    const skill = getGearCatalogSkill(entry);
    return {
      ...systemData,
      quantity: 1,
      requiresRoll: getGearCatalogRequiresRoll(entry),
      skill,
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
    syncId: buildGearCatalogEntrySyncId(config.catalogKey, entry),
    type: config.itemType,
    name: normalizeString(entry?.name),
    ownerName: '',
    folderPath: getGearCatalogFolderPath(entry, config),
    [GEAR_CATALOG_SYNC_SYSTEM_JSON_COLUMN]: stableStringify(systemData),
    'system.rank': systemData.rank ?? '',
    'system.description': systemData.description ?? ''
  };

  if (config.itemType === 'armor') {
    row['system.itemPhys'] = systemData.itemPhys;
    row['system.itemAzure'] = systemData.itemAzure;
    row['system.itemMental'] = systemData.itemMental;
    row['system.itemShield'] = systemData.itemShield;
    row['system.itemSpeed'] = systemData.itemSpeed;
  }

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

  if (config.itemType !== 'armor') {
    row['system.skillBonus'] = systemData.skillBonus;
  }

  return row;
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
