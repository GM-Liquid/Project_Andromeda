import {
  MODULE_ID,
  debugLog
} from '../config.mjs';
import {
  DEFAULT_ITEM_USAGE_FREQUENCY,
  ITEM_ACTIVATION_TYPE_LABEL_KEYS,
  ITEM_TYPE_CONFIGS,
  ITEM_USAGE_FREQUENCY_LABEL_KEYS,
  normalizeUsageFrequency
} from './item-config.mjs';
import { getLibraryItemUuid } from './item-library-sync.mjs';

const GEAR_CATALOG_SYNC_ID_FLAG = 'sheetSyncId';
const GEAR_CATALOG_SYNC_SYSTEM_JSON_COLUMN = 'systemJson';
const GEAR_CATALOG_SYNC_SUPPORTED_ITEM_TYPES = new Set(
  ITEM_TYPE_CONFIGS.map((config) => config.type)
);
const GEAR_CATALOG_SYNC_ALLOWED_USAGE_FREQUENCIES = new Set(
  Object.keys(ITEM_USAGE_FREQUENCY_LABEL_KEYS)
);
const GEAR_CATALOG_SYNC_ALLOWED_ACTIVATION_TYPES = new Set(
  Object.keys(ITEM_ACTIVATION_TYPE_LABEL_KEYS)
);
const GEAR_CATALOG_SYNC_TYPE_LABEL_KEYS = {
  weapon: 'TYPES.Item.weapon',
  armor: 'TYPES.Item.armor',
  equipment: 'TYPES.Item.equipment',
  trait: 'TYPES.Item.trait',
  environment: 'MY_RPG.ItemTypeGroups.Environment'
};

const GEAR_CATALOG_SYNC_COLUMN_LABEL_KEYS = {
  type: 'MY_RPG.GearCatalogSync.Headers.Type',
  name: 'MY_RPG.GearCatalogSync.Headers.Name',
  ownerName: 'MY_RPG.GearCatalogSync.Headers.OwnerName',
  'system.rank': 'MY_RPG.GearCatalogSync.Headers.Rank',
  'system.skill': 'MY_RPG.GearCatalogSync.Headers.Skill',
  'system.skillBonus': 'MY_RPG.GearCatalogSync.Headers.SkillBonus',
  'system.description': 'MY_RPG.GearCatalogSync.Headers.Description',
  'system.itemPhys': 'MY_RPG.GearCatalogSync.Headers.ItemFortitude',
  'system.itemAzure': 'MY_RPG.GearCatalogSync.Headers.ItemControl',
  'system.itemMental': 'MY_RPG.GearCatalogSync.Headers.ItemWill',
  'system.itemShield': 'MY_RPG.GearCatalogSync.Headers.ItemShield',
  'system.itemSpeed': 'MY_RPG.GearCatalogSync.Headers.ItemSpeed',
  'system.usageFrequency': 'MY_RPG.GearCatalogSync.Headers.UsageFrequency',
  'system.activationCost': 'MY_RPG.GearCatalogSync.Headers.ActivationCost',
  'system.activationType': 'MY_RPG.GearCatalogSync.Headers.ActivationType',
  'system.range': 'MY_RPG.GearCatalogSync.Headers.Range',
  'system.duration': 'MY_RPG.GearCatalogSync.Headers.Duration',
  'system.area': 'MY_RPG.GearCatalogSync.Headers.Area',
  'system.defense': 'MY_RPG.GearCatalogSync.Headers.Defense',
  'system.targets': 'MY_RPG.GearCatalogSync.Headers.Targets',
  'system.quantity': 'MY_RPG.GearCatalogSync.Headers.Quantity'
};
const GEAR_CATALOG_SYNC_COMMON_COLUMNS = ['syncId', 'type', 'name', 'ownerName'];
const GEAR_CATALOG_SYNC_HIDDEN_COLUMNS = new Set(['syncId']);
const GEAR_CATALOG_SYNC_LEGACY_IMPORT_COLUMNS = new Set([
  'foundryId',
  'folderId',
  'folderName',
  'img',
  'sort',
  'status',
  'libraryActorId',
  'libraryActorItemId',
  'isActorLinked',
  'folderPath',
  GEAR_CATALOG_SYNC_SYSTEM_JSON_COLUMN,
  'system.requiresRoll'
]);

// Spreadsheet exports intentionally expose only the most editable columns.
// Hidden/legacy columns remain import-compatible so older sheets keep working.
// Advanced fields such as sort/rules/traits/details stay inside Foundry data for now;
// if they become routine content fields later, we can restore them as visible columns.

const GEAR_CATALOG_SYNC_ROW_STATUSES = new Set(['active', 'draft', 'delete']);

function createSystemField(column, path, kind = 'string') {
  return { column, path, kind };
}

const GEAR_CATALOG_SYNC_SHEET_CONFIGS = [
  {
    key: 'armor',
    labelKey: 'MY_RPG.GearCatalogSync.Sheets.Armor',
    typeLabelKey: GEAR_CATALOG_SYNC_TYPE_LABEL_KEYS.armor,
    types: ['armor'],
    fields: [
      createSystemField('system.rank', 'rank', 'rank'),
      createSystemField('system.itemPhys', 'itemPhys', 'number'),
      createSystemField('system.itemAzure', 'itemAzure', 'number'),
      createSystemField('system.itemMental', 'itemMental', 'number'),
      createSystemField('system.itemShield', 'itemShield', 'number'),
      createSystemField('system.itemSpeed', 'itemSpeed', 'number'),
      createSystemField('system.usageFrequency', 'usageFrequency', 'usage-frequency'),
      createSystemField('system.activationCost', 'activationCost', 'activation-type'),
      createSystemField('system.range', 'range', 'string'),
      createSystemField('system.duration', 'duration', 'string'),
      createSystemField('system.area', 'area', 'string'),
      createSystemField('system.defense', 'defense', 'string'),
      createSystemField('system.targets', 'targets', 'string'),
      createSystemField('system.description', 'description', 'string')
    ]
  },
  {
    key: 'equipment',
    labelKey: 'MY_RPG.GearCatalogSync.Sheets.Equipment',
    typeLabelKey: GEAR_CATALOG_SYNC_TYPE_LABEL_KEYS.equipment,
    types: ['equipment', 'equipment-consumable', 'implant', 'cartridge'],
    fields: [
      createSystemField('system.rank', 'rank', 'rank'),
      createSystemField('system.usageFrequency', 'usageFrequency', 'usage-frequency'),
      createSystemField('system.activationCost', 'activationCost', 'activation-type'),
      createSystemField('system.range', 'range', 'string'),
      createSystemField('system.duration', 'duration', 'string'),
      createSystemField('system.area', 'area', 'string'),
      createSystemField('system.defense', 'defense', 'string'),
      createSystemField('system.targets', 'targets', 'string'),
      createSystemField('system.skill', 'skill', 'skill'),
      createSystemField('system.skillBonus', 'skillBonus', 'number'),
      createSystemField('system.description', 'description', 'string')
    ]
  },
  {
    key: 'abilities',
    labelKey: 'MY_RPG.GearCatalogSync.Sheets.Abilities',
    typeLabelKey: GEAR_CATALOG_SYNC_TYPE_LABEL_KEYS.trait,
    types: ['trait-source-ability'],
    fields: [
      createSystemField('system.rank', 'rank', 'rank'),
      createSystemField('system.usageFrequency', 'usageFrequency', 'usage-frequency'),
      createSystemField('system.activationCost', 'activationCost', 'activation-type'),
      createSystemField('system.range', 'range', 'string'),
      createSystemField('system.duration', 'duration', 'string'),
      createSystemField('system.area', 'area', 'string'),
      createSystemField('system.defense', 'defense', 'string'),
      createSystemField('system.targets', 'targets', 'string'),
      createSystemField('system.skill', 'skill', 'skill'),
      createSystemField('system.description', 'description', 'string')
    ]
  }
];

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

function hashString(value) {
  let hash = 2166136261;
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function getGearCatalogSourceHash(remoteSheets = {}) {
  return hashString(stableStringify(remoteSheets));
}

function sameValue(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function localize(key) {
  return game.i18n.localize(key);
}

function getAllWorldItems() {
  return game.items?.contents ?? [];
}

function getItemFolders() {
  return (game.folders?.contents ?? []).filter((folder) => folder.type === 'Item');
}

function getSkillKeys() {
  return Object.keys(CONFIG.ProjectAndromeda?.skills ?? {});
}

function getSkillLabel(skillKey) {
  const labelKey = CONFIG.ProjectAndromeda?.skills?.[skillKey];
  return labelKey ? localize(labelKey) : String(skillKey ?? '');
}

function getModuleFlagString(document, flagKey) {
  const value =
    document?.getFlag?.(MODULE_ID, flagKey) ?? document?.flags?.[MODULE_ID]?.[flagKey] ?? '';
  return String(value ?? '').trim();
}

function isPrimaryActiveGM() {
  if (!game.user?.isGM) return false;
  const activeGMs = (game.users?.filter((user) => user.isGM && user.active) ?? []).sort(
    (left, right) => String(left.id).localeCompare(String(right.id))
  );
  if (!activeGMs.length) return false;
  return activeGMs[0]?.id === game.user?.id;
}

function ensurePrimaryActiveGM() {
  if (!isPrimaryActiveGM()) {
    throw new Error(localize('MY_RPG.GearCatalogSync.Errors.RequirePrimaryGM'));
  }
}

function getGearCatalogSyncId(item) {
  return getModuleFlagString(item, GEAR_CATALOG_SYNC_ID_FLAG);
}

function createGearCatalogSyncId() {
  return `gsync-${foundry.utils.randomID(16)}`;
}

function getFolderId(document) {
  return String(document?.folder?.id ?? document?.folder ?? '').trim();
}

function getItemLabel(itemType) {
  return localize(`TYPES.Item.${itemType}`);
}

function getGearCatalogColumnLabel(columnKey) {
  const labelKey = GEAR_CATALOG_SYNC_COLUMN_LABEL_KEYS[columnKey];
  return labelKey ? localize(labelKey) : columnKey;
}


function normalizeLookupValue(value) {
  return normalizeOptionalString(value).toLowerCase();
}

function normalizeItemTypeValue(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return '';
  if (GEAR_CATALOG_SYNC_SUPPORTED_ITEM_TYPES.has(normalized)) return normalized;

  const normalizedLookup = normalizeLookupValue(normalized);
  return (
    Array.from(GEAR_CATALOG_SYNC_SUPPORTED_ITEM_TYPES).find(
      (itemType) => normalizeLookupValue(getItemLabel(itemType)) === normalizedLookup
    ) ?? ''
  );
}

function normalizeString(value) {
  return String(value ?? '');
}

function normalizeOptionalString(value) {
  return normalizeString(value).trim();
}

function parseInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeOptionalString(value).toLowerCase();
  if (!normalized) return false;
  return ['true', '1', 'yes', 'y', 'x', 'on', 'да'].includes(normalized);
}

function parseJsonValue(rawValue, fallback, label) {
  const normalized = normalizeString(rawValue).trim();
  if (!normalized) return deepClone(fallback);

  try {
    return JSON.parse(normalized);
  } catch (error) {
    throw new Error(
      game.i18n.format('MY_RPG.GearCatalogSync.Errors.InvalidJson', {
        field: label,
        error: error?.message ?? 'JSON parse error'
      })
    );
  }
}

function validateTypeForSheet(sheetConfig, itemType) {
  if (!GEAR_CATALOG_SYNC_SUPPORTED_ITEM_TYPES.has(itemType)) {
    throw new Error(
      game.i18n.format('MY_RPG.GearCatalogSync.Errors.UnsupportedItemType', { type: itemType })
    );
  }

  if (!sheetConfig.types.includes(itemType)) {
    throw new Error(
      game.i18n.format('MY_RPG.GearCatalogSync.Errors.TypeDoesNotMatchSheet', {
        type: itemType,
        sheet: localize(sheetConfig.labelKey)
      })
    );
  }
}

function validateRank(value, label) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return '';
  if (['1', '2', '3', '4'].includes(normalized)) return normalized;
  throw new Error(game.i18n.format('MY_RPG.GearCatalogSync.Errors.InvalidRank', { field: label }));
}

function validateSkill(value, label) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return '';
  if (getSkillKeys().includes(normalized)) return normalized;
  const normalizedLookup = normalizeLookupValue(normalized);
  const matchedSkill =
    getSkillKeys().find((skillKey) => normalizeLookupValue(getSkillLabel(skillKey)) === normalizedLookup) ??
    '';
  if (matchedSkill) return matchedSkill;
  throw new Error(
    game.i18n.format('MY_RPG.GearCatalogSync.Errors.InvalidSkill', {
      field: label,
      value: normalized
    })
  );
}

function validateUsageFrequency(value, label) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return DEFAULT_ITEM_USAGE_FREQUENCY;
  if (normalized === 'atWill') return DEFAULT_ITEM_USAGE_FREQUENCY;
  if (GEAR_CATALOG_SYNC_ALLOWED_USAGE_FREQUENCIES.has(normalized)) return normalized;
  const normalizedLookup = normalizeLookupValue(normalized);
  const matchedFrequency =
    Array.from(GEAR_CATALOG_SYNC_ALLOWED_USAGE_FREQUENCIES).find(
      (entry) =>
        normalizeLookupValue(localize(ITEM_USAGE_FREQUENCY_LABEL_KEYS[entry])) === normalizedLookup
    ) ?? '';
  if (matchedFrequency) return matchedFrequency;
  throw new Error(
    game.i18n.format('MY_RPG.GearCatalogSync.Errors.InvalidEnumValue', {
      field: label,
      value: normalized
    })
  );
}

function validateActivationType(value, label) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return 'passive';
  if (GEAR_CATALOG_SYNC_ALLOWED_ACTIVATION_TYPES.has(normalized)) return normalized;
  const normalizedLookup = normalizeLookupValue(normalized);
  const matchedActivationType =
    Array.from(GEAR_CATALOG_SYNC_ALLOWED_ACTIVATION_TYPES).find(
      (entry) =>
        normalizeLookupValue(localize(ITEM_ACTIVATION_TYPE_LABEL_KEYS[entry])) ===
        normalizedLookup
    ) ?? '';
  if (matchedActivationType) return matchedActivationType;
  throw new Error(
    game.i18n.format('MY_RPG.GearCatalogSync.Errors.InvalidEnumValue', {
      field: label,
      value: normalized
    })
  );
}

function parseFieldValue(field, rawValue, itemType) {
  void itemType;
  const fieldLabel = getGearCatalogColumnLabel(field.column);
  if (field.kind === 'string') {
    return normalizeString(rawValue);
  }
  if (field.kind === 'number') {
    return parseNumber(rawValue, 0);
  }
  if (field.kind === 'boolean') {
    return parseBoolean(rawValue);
  }
  if (field.kind === 'rank') {
    return validateRank(rawValue, fieldLabel);
  }
  if (field.kind === 'skill') {
    return validateSkill(rawValue, fieldLabel);
  }
  if (field.kind === 'usage-frequency') {
    return validateUsageFrequency(rawValue, fieldLabel);
  }
  if (field.kind === 'activation-type') {
    return validateActivationType(rawValue, fieldLabel);
  }

  return rawValue;
}


function isBlankRow(row = {}) {
  return Object.values(row).every((value) => !normalizeOptionalString(value));
}

function getSheetColumnOrder(sheetConfig) {
  return [...GEAR_CATALOG_SYNC_COMMON_COLUMNS, ...sheetConfig.fields.map((field) => field.column)];
}

function getRecognizedImportColumns(sheetConfig) {
  return [...new Set([...getSheetColumnOrder(sheetConfig), ...GEAR_CATALOG_SYNC_LEGACY_IMPORT_COLUMNS])];
}

function getSheetTypeLabels(sheetConfig) {
  return sheetConfig.types.map((type) => getItemLabel(type)).join(', ');
}

function getVisibleSheetColumns(sheetConfig) {
  return getSheetColumnOrder(sheetConfig).filter(
    (column) => !GEAR_CATALOG_SYNC_HIDDEN_COLUMNS.has(column)
  );
}

function getVisibleSheetColumnLabels(sheetConfig) {
  return getVisibleSheetColumns(sheetConfig).map((column) => getGearCatalogColumnLabel(column));
}

function getImportColumnAliasMap(sheetConfig) {
  const aliasMap = new Map();
  for (const column of getRecognizedImportColumns(sheetConfig)) {
    const aliases = [column];
    const localizedLabel = getGearCatalogColumnLabel(column);
    if (localizedLabel && localizedLabel !== column) aliases.push(localizedLabel);

    for (const alias of aliases) {
      const normalizedAlias = normalizeLookupValue(alias);
      if (!normalizedAlias || aliasMap.has(normalizedAlias)) continue;
      aliasMap.set(normalizedAlias, column);
    }
  }
  return aliasMap;
}

function normalizeImportedRow(row, sheetConfig) {
  const aliasMap = getImportColumnAliasMap(sheetConfig);
  return Object.entries(row ?? {}).reduce((accumulator, [column, value]) => {
    const internalColumn = aliasMap.get(normalizeLookupValue(column));
    if (!internalColumn) return accumulator;
    accumulator[internalColumn] = value;
    return accumulator;
  }, {});
}

function getSheetDisplayConfigs() {
  return GEAR_CATALOG_SYNC_SHEET_CONFIGS.map((config) => ({
    key: config.key,
    label: localize(config.labelKey),
    typeLabels: getSheetTypeLabels(config),
    columns: getVisibleSheetColumnLabels(config)
  }));
}

const GEAR_CATALOG_IMPORT_CONFIGS = [
  {
    catalogKey: 'armor',
    sheetKey: 'armor',
    itemType: 'armor',
    folderName: 'Броня'
  },
  {
    catalogKey: 'equipment',
    sheetKey: 'equipment',
    itemType: 'equipment',
    folderName: 'Снаряжение'
  },
  {
    catalogKey: 'abilities',
    sheetKey: 'abilities',
    itemType: 'trait-source-ability',
    folderName: 'Способности'
  }
];

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

function getFirstOutcomeNumber(entry, keys) {
  const keySet = new Set(keys);
  for (const outcome of getGearCatalogOutcomes(entry)) {
    if (!keySet.has(String(outcome?.key ?? ''))) continue;
    const value = Number(outcome?.value ?? outcome?.amount ?? 0);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function getGearCatalogActivationType(entry) {
  const activationType = normalizeOptionalString(
    getGearCatalogEffects(entry).find((effect) => effect?.activation?.type)?.activation?.type
  );
  if (GEAR_CATALOG_SYNC_ALLOWED_ACTIVATION_TYPES.has(activationType)) return activationType;
  if (activationType === 'freeAction') return 'action';
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
  return getGearCatalogConditionValue(entry, (conditions) => formatGearCatalogRange(conditions.range));
}

function formatGearCatalogArea(area) {
  if (!area || typeof area !== 'object') return '';
  const type = normalizeOptionalString(area.type);
  const value = Number(area.value);
  if (type && Number.isFinite(value)) return `${type} ${value} m`;
  return type;
}

function getGearCatalogArea(entry) {
  return getGearCatalogConditionValue(entry, (conditions) => formatGearCatalogArea(conditions.area));
}

function getGearCatalogUsageFrequency(entry) {
  return normalizeUsageFrequency(
    getGearCatalogConditionValue(entry, (conditions) => normalizeOptionalString(conditions.frequency)) ||
      DEFAULT_ITEM_USAGE_FREQUENCY
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
      skill
    };
  }

  const skill = getGearCatalogSkill(entry);
  return {
    ...systemData,
    requiresRoll: getGearCatalogRequiresRoll(entry),
    skill,
    skillBonus: getFirstOutcomeNumber(entry, ['damage'])
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

  if (config.itemType !== 'trait-source-ability' && config.itemType !== 'armor') {
    row['system.skillBonus'] = systemData.skillBonus;
  }

  return row;
}

function buildGearCatalogRemoteDataFromCatalogs(catalogs = {}) {
  const sheets = {};
  for (const config of GEAR_CATALOG_IMPORT_CONFIGS) {
    sheets[config.sheetKey] = normalizeCatalogEntries(catalogs[config.catalogKey]).map((entry) =>
      buildGearCatalogImportRow(entry, config)
    );
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

async function fetchGearCatalog(filename) {
  const response = await fetch(`systems/${MODULE_ID}/data/gear/catalog/${filename}`, {
    cache: 'no-cache'
  });
  if (!response.ok) {
    throw new Error(
      game.i18n.format('MY_RPG.GearCatalogSync.Errors.CatalogFetchFailed', {
        file: filename,
        status: response.status
      })
    );
  }
  return response.json();
}

function getItemMaps() {
  const bySyncId = new Map();
  const byId = new Map();
  const byNameAndType = new Map();

  for (const item of getAllWorldItems()) {
    byId.set(String(item.id ?? ''), item);
    const syncId = getGearCatalogSyncId(item);
    if (syncId) bySyncId.set(syncId, item);
    const nameTypeKey = `${String(item.type ?? '')}\u0000${normalizeLookupValue(item.name)}`;
    if (!byNameAndType.has(nameTypeKey)) byNameAndType.set(nameTypeKey, item);
  }

  return { bySyncId, byId, byNameAndType };
}

function resolveFolderSpec(row, item) {
  const isActorLinkedItem = Boolean(
    getModuleFlagString(item, 'libraryActorId') && getModuleFlagString(item, 'libraryActorItemId')
  );
  if (isActorLinkedItem) {
    return {
      folderId: getFolderId(item),
      createFolderName: '',
      folderPath: []
    };
  }

  const hasFolderId = Object.hasOwn(row, 'folderId');
  const hasFolderName = Object.hasOwn(row, 'folderName');
  const hasFolderPath = Object.hasOwn(row, 'folderPath');
  if (!hasFolderId && !hasFolderName && !hasFolderPath) {
    return {
      folderId: getFolderId(item),
      createFolderName: '',
      folderPath: []
    };
  }

  const folderId = normalizeOptionalString(row.folderId);
  const folderName = normalizeOptionalString(row.folderName);
  const folderPath = normalizeOptionalString(row.folderPath)
    .split('/')
    .map((segment) => normalizeOptionalString(segment))
    .filter(Boolean);
  const folders = getItemFolders();

  if (folderId) {
    const existingById = folders.find((folder) => folder.id === folderId);
    if (!existingById) {
      throw new Error(
        game.i18n.format('MY_RPG.GearCatalogSync.Errors.UnknownFolderId', { id: folderId })
      );
    }
    return { folderId: existingById.id, createFolderName: '', folderPath: [] };
  }

  if (folderPath.length) {
    return {
      folderId: '',
      createFolderName: '',
      folderPath
    };
  }

  if (folderName) {
    const existingByName =
      folders.find(
        (folder) =>
          String(folder.name ?? '')
            .trim()
            .localeCompare(folderName) === 0
      ) ?? null;
    if (existingByName) {
      return { folderId: existingByName.id, createFolderName: '', folderPath: [] };
    }

    return { folderId: '', createFolderName: folderName, folderPath: [] };
  }

  return { folderId: '', createFolderName: '', folderPath: [] };
}

function buildComparableSnapshot(data) {
  return {
    type: String(data?.type ?? ''),
    name: String(data?.name ?? ''),
    img: String(data?.img ?? ''),
    folder: String(data?.folder ?? ''),
    sort: Number(data?.sort) || 0,
    system: deepClone(data?.system ?? {})
  };
}

function buildComparableSnapshotFromItem(item) {
  return buildComparableSnapshot({
    type: item?.type,
    name: item?.name,
    img: item?.img,
    folder: getFolderId(item),
    sort: Number(item?.sort) || 0,
    system: deepClone(item?.system ?? {})
  });
}

function getExistingFolderPathId(folderPath = []) {
  let parentId = '';
  for (const segment of folderPath) {
    const normalized = normalizeOptionalString(segment);
    const folder =
      getItemFolders().find(
        (candidate) =>
          String(candidate.name ?? '')
            .trim()
            .localeCompare(normalized) === 0 && getFolderParentId(candidate) === parentId
      ) ?? null;
    if (!folder) return '';
    parentId = String(folder.id ?? '').trim();
  }
  return parentId;
}

function resolveCandidateFolderId(folderSpec = {}) {
  if (folderSpec.folderId) return folderSpec.folderId;
  if (folderSpec.folderPath?.length) return getExistingFolderPathId(folderSpec.folderPath);
  return '';
}

function ensureSyncIdForRow(row, item) {
  const rowSyncId = normalizeOptionalString(row.syncId);
  if (rowSyncId) return rowSyncId;
  const itemSyncId = getGearCatalogSyncId(item);
  if (itemSyncId) return itemSyncId;
  return createGearCatalogSyncId();
}

function buildImportDataForRow(row, sheetConfig, item) {
  const type = normalizeItemTypeValue(row.type) || item?.type || sheetConfig.types[0];
  validateTypeForSheet(sheetConfig, type);

  const systemData = (() => {
    const hasSystemJson = Object.hasOwn(row, GEAR_CATALOG_SYNC_SYSTEM_JSON_COLUMN);
    if (!hasSystemJson) {
      return deepClone(item?.system ?? {});
    }

    const parsed = parseJsonValue(
      row[GEAR_CATALOG_SYNC_SYSTEM_JSON_COLUMN],
      item?.system ?? {},
      GEAR_CATALOG_SYNC_SYSTEM_JSON_COLUMN
    );
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(
        game.i18n.format('MY_RPG.GearCatalogSync.Errors.ExpectedObject', {
          field: GEAR_CATALOG_SYNC_SYSTEM_JSON_COLUMN
        })
      );
    }
    return parsed;
  })();

  for (const field of sheetConfig.fields) {
    if (!Object.hasOwn(row, field.column)) continue;
    const parsedValue = parseFieldValue(field, row[field.column], type);
    foundry.utils.setProperty(systemData, field.path, parsedValue);
  }

  const hasLegacyRequiresRoll = Object.hasOwn(row, 'system.requiresRoll');
  if (hasLegacyRequiresRoll) {
    systemData.requiresRoll = parseBoolean(row['system.requiresRoll']);
  } else if (type === 'cartridge' || type === 'implant') {
    systemData.requiresRoll = true;
  } else if (!item && (sheetConfig.key === 'equipment' || sheetConfig.key === 'abilities')) {
    systemData.requiresRoll = Boolean(String(systemData.skill ?? '').trim());
  }

  const folderSpec = resolveFolderSpec(row, item);

  return {
    type,
    name: Object.hasOwn(row, 'name')
      ? normalizeString(row.name)
      : String(item?.name ?? getItemLabel(type)),
    img: Object.hasOwn(row, 'img') ? normalizeString(row.img) : String(item?.img ?? ''),
    sort: Object.hasOwn(row, 'sort') ? parseInteger(row.sort, 0) : Number(item?.sort) || 0,
    folderSpec,
    system: systemData,
    syncId: ensureSyncIdForRow(row, item)
  };
}

function buildCreateDocumentData(importData, resolvedFolderId) {
  return {
    name: importData.name,
    type: importData.type,
    img: importData.img,
    folder: resolvedFolderId || null,
    sort: importData.sort,
    system: importData.system,
    flags: {
      [MODULE_ID]: {
        [GEAR_CATALOG_SYNC_ID_FLAG]: importData.syncId
      }
    }
  };
}

function buildUpdateDocumentData(item, importData, resolvedFolderId) {
  return {
    _id: item.id,
    name: importData.name,
    img: importData.img,
    folder: resolvedFolderId || null,
    sort: importData.sort,
    system: importData.system,
    [`flags.${MODULE_ID}.${GEAR_CATALOG_SYNC_ID_FLAG}`]: importData.syncId
  };
}

const GEAR_CATALOG_WORLD_ITEM_CREATE_OPTIONS = Object.freeze({
  render: false
});

const GEAR_CATALOG_WORLD_ITEM_UPDATE_OPTIONS = Object.freeze({
  render: false,
  diff: false
});

async function applyCatalogWorldItemCreates(createDocuments = []) {
  if (!createDocuments.length) return [];
  return Item.createDocuments(createDocuments, GEAR_CATALOG_WORLD_ITEM_CREATE_OPTIONS);
}

async function applyCatalogWorldItemUpdates(updateDocuments = []) {
  if (!updateDocuments.length) return [];
  return Item.updateDocuments(updateDocuments, GEAR_CATALOG_WORLD_ITEM_UPDATE_OPTIONS);
}

function buildOperationRowLabel(sheetConfig, rowNumber, row) {
  const name = normalizeOptionalString(row.name);
  if (name) {
    return `${localize(sheetConfig.labelKey)} #${rowNumber}: ${name}`;
  }
  return `${localize(sheetConfig.labelKey)} #${rowNumber}`;
}

function createPlanSummary() {
  return {
    create: 0,
    update: 0,
    skip: 0,
    error: 0,
    folderCreate: 0
  };
}

function addPlanCounter(target, mode) {
  target[mode] = (target[mode] ?? 0) + 1;
}

function hasActorLinkMetadata(row) {
  return Boolean(
    normalizeOptionalString(row.libraryActorId) ||
      normalizeOptionalString(row.libraryActorItemId) ||
      parseBoolean(row.isActorLinked)
  );
}

async function buildImportPlan(remoteSheets = {}) {
  const summary = createPlanSummary();
  const perSheet = GEAR_CATALOG_SYNC_SHEET_CONFIGS.map((config) => ({
    key: config.key,
    label: localize(config.labelKey),
    ...createPlanSummary()
  }));
  const perSheetMap = new Map(perSheet.map((entry) => [entry.key, entry]));
  const operations = [];
  const errors = [];
  const warnings = [];
  const duplicateSyncIds = new Set();
  const seenSyncIds = new Set();
  const { bySyncId, byId, byNameAndType } = getItemMaps();

  for (const sheetConfig of GEAR_CATALOG_SYNC_SHEET_CONFIGS) {
    const rows = Array.isArray(remoteSheets?.[sheetConfig.key])
      ? remoteSheets[sheetConfig.key]
      : [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] ?? {};
      const rowNumber = index + 2;
      const rowLabel = buildOperationRowLabel(sheetConfig, rowNumber, row);
      const sheetSummary = perSheetMap.get(sheetConfig.key);

      if (isBlankRow(row)) {
        addPlanCounter(summary, 'skip');
        addPlanCounter(sheetSummary, 'skip');
        operations.push({
          sheetKey: sheetConfig.key,
          rowNumber,
          mode: 'skip',
          rowLabel,
          message: localize('MY_RPG.GearCatalogSync.Messages.BlankRowSkipped')
        });
        continue;
      }

      const status = normalizeOptionalString(row.status).toLowerCase() || 'active';
      if (!GEAR_CATALOG_SYNC_ROW_STATUSES.has(status)) {
        const errorMessage = game.i18n.format('MY_RPG.GearCatalogSync.Errors.InvalidStatus', {
          status: normalizeOptionalString(row.status)
        });
        errors.push(`${rowLabel}: ${errorMessage}`);
        addPlanCounter(summary, 'error');
        addPlanCounter(sheetSummary, 'error');
        continue;
      }

      if (status === 'delete') {
        warnings.push(`${rowLabel}: ${localize('MY_RPG.GearCatalogSync.Messages.DeleteSkipped')}`);
        addPlanCounter(summary, 'skip');
        addPlanCounter(sheetSummary, 'skip');
        operations.push({
          sheetKey: sheetConfig.key,
          rowNumber,
          mode: 'skip',
          rowLabel,
          message: localize('MY_RPG.GearCatalogSync.Messages.DeleteSkipped')
        });
        continue;
      }

      const rowSyncId = normalizeOptionalString(row.syncId);
      if (rowSyncId) {
        if (seenSyncIds.has(rowSyncId)) duplicateSyncIds.add(rowSyncId);
        seenSyncIds.add(rowSyncId);
      }

      const item =
        (rowSyncId ? bySyncId.get(rowSyncId) : null) ??
        (normalizeOptionalString(row.foundryId)
          ? byId.get(normalizeOptionalString(row.foundryId))
          : null) ??
        byNameAndType.get(
          `${normalizeItemTypeValue(row.type) || sheetConfig.types[0]}\u0000${normalizeLookupValue(row.name)}`
        ) ??
        null;

      if (!item && hasActorLinkMetadata(row)) {
        const errorMessage = localize('MY_RPG.GearCatalogSync.Errors.ActorLinkedCreateBlocked');
        errors.push(`${rowLabel}: ${errorMessage}`);
        addPlanCounter(summary, 'error');
        addPlanCounter(sheetSummary, 'error');
        continue;
      }

      if (item) {
        const requestedType = normalizeItemTypeValue(row.type) || item.type;
        if (requestedType !== item.type) {
          const errorMessage = game.i18n.format(
            'MY_RPG.GearCatalogSync.Errors.TypeChangeBlocked',
            {
              currentType: getItemLabel(item.type),
              requestedType: getItemLabel(requestedType)
            }
          );
          errors.push(`${rowLabel}: ${errorMessage}`);
          addPlanCounter(summary, 'error');
          addPlanCounter(sheetSummary, 'error');
          continue;
        }
      }

      try {
        const importData = buildImportDataForRow(row, sheetConfig, item);
        const candidateFolderId = resolveCandidateFolderId(importData.folderSpec);
        const candidateSnapshot = buildComparableSnapshot({
          type: importData.type,
          name: importData.name,
          img: importData.img,
          folder: candidateFolderId,
          sort: importData.sort,
          system: importData.system
        });

        if (
          importData.folderSpec.createFolderName ||
          (importData.folderSpec.folderPath?.length && !candidateFolderId)
        ) {
          addPlanCounter(summary, 'folderCreate');
          addPlanCounter(sheetSummary, 'folderCreate');
        }

        if (!item) {
          addPlanCounter(summary, 'create');
          addPlanCounter(sheetSummary, 'create');
          operations.push({
            sheetKey: sheetConfig.key,
            rowNumber,
            mode: 'create',
            rowLabel,
            item: null,
            importData,
            changedKeys: ['create']
          });
          continue;
        }

        const currentSnapshot = buildComparableSnapshotFromItem(item);
        if (sameValue(currentSnapshot, candidateSnapshot)) {
          addPlanCounter(summary, 'skip');
          addPlanCounter(sheetSummary, 'skip');
          operations.push({
            sheetKey: sheetConfig.key,
            rowNumber,
            mode: 'skip',
            rowLabel,
            item,
            importData,
            message: localize('MY_RPG.GearCatalogSync.Messages.NoChanges')
          });
          continue;
        }

        const diff = foundry.utils.flattenObject(
          foundry.utils.diffObject(currentSnapshot, candidateSnapshot)
        );
        addPlanCounter(summary, 'update');
        addPlanCounter(sheetSummary, 'update');
        operations.push({
          sheetKey: sheetConfig.key,
          rowNumber,
          mode: 'update',
          rowLabel,
          item,
          importData,
          changedKeys: Object.keys(diff)
        });
      } catch (error) {
        errors.push(`${rowLabel}: ${error?.message ?? error}`);
        addPlanCounter(summary, 'error');
        addPlanCounter(sheetSummary, 'error');
      }
    }
  }

  if (duplicateSyncIds.size) {
    summary.error += duplicateSyncIds.size;
    errors.push(
      game.i18n.format('MY_RPG.GearCatalogSync.Errors.DuplicateSyncIds', {
        ids: [...duplicateSyncIds].join(', ')
      })
    );
  }

  return {
    operations,
    summary,
    perSheet,
    errors,
    warnings
  };
}

function getFolderParentId(folder) {
  return String(folder?.folder?.id ?? folder?.folder ?? '').trim();
}

function getFolderCacheKey(name, parentId = '') {
  return `${String(parentId ?? '').trim()}\u0000${normalizeOptionalString(name)}`;
}

async function ensureFolderExistsByName(name, cache, parentId = '') {
  const normalized = normalizeOptionalString(name);
  if (!normalized) return '';
  const normalizedParentId = String(parentId ?? '').trim();
  const cacheKey = getFolderCacheKey(normalized, normalizedParentId);
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const existing =
    getItemFolders().find(
      (folder) =>
        String(folder.name ?? '')
          .trim()
          .localeCompare(normalized) === 0 && getFolderParentId(folder) === normalizedParentId
    ) ?? null;
  if (existing) {
    cache.set(cacheKey, existing.id);
    return existing.id;
  }

  const created = await Folder.create(
    {
      name: normalized,
      type: 'Item',
      folder: normalizedParentId || null
    },
    { render: false }
  );
  const folderId = String(created?.id ?? '');
  cache.set(cacheKey, folderId);
  return folderId;
}

async function ensureFolderPathExists(folderPath, cache) {
  let parentId = '';
  for (const segment of folderPath ?? []) {
    parentId = await ensureFolderExistsByName(segment, cache, parentId);
  }
  return parentId;
}

function collectLinkedActorsForLibraryItems(items = []) {
  const targetUuids = new Set(items.map((item) => String(item?.uuid ?? '').trim()).filter(Boolean));
  if (!targetUuids.size) return [];

  const actors = [];
  for (const actor of game.actors?.contents ?? []) {
    const hasLinkedItem = (actor.items ?? []).some((item) =>
      targetUuids.has(getLibraryItemUuid(item))
    );
    if (hasLinkedItem) actors.push(actor);
  }

  return actors;
}

function rerenderActorApps(actors = []) {
  for (const actor of actors) {
    for (const app of Object.values(actor?.apps ?? {})) {
      app?.render?.(true);
    }
  }
}

async function applyImportPlan(plan) {
  const folderCache = new Map(
    getItemFolders().map((folder) => [
      getFolderCacheKey(folder.name, getFolderParentId(folder)),
      String(folder.id ?? '')
    ])
  );
  const createDocuments = [];
  const updateDocuments = [];

  for (const operation of plan.operations) {
    if (operation.mode !== 'create' && operation.mode !== 'update') continue;

    const resolvedFolderId =
      operation.importData.folderSpec.folderId ||
      (operation.importData.folderSpec.folderPath?.length
        ? await ensureFolderPathExists(operation.importData.folderSpec.folderPath, folderCache)
        : '') ||
      (operation.importData.folderSpec.createFolderName
        ? await ensureFolderExistsByName(
            operation.importData.folderSpec.createFolderName,
            folderCache
          )
        : '');

    if (operation.mode === 'create') {
      createDocuments.push(buildCreateDocumentData(operation.importData, resolvedFolderId));
      continue;
    }

    updateDocuments.push(
      buildUpdateDocumentData(operation.item, operation.importData, resolvedFolderId)
    );
  }

  const createdItems = await applyCatalogWorldItemCreates(createDocuments);
  const updatedItems = await applyCatalogWorldItemUpdates(updateDocuments);

  await new Promise((resolve) => setTimeout(resolve, 0));

  const linkedActors = collectLinkedActorsForLibraryItems(updatedItems);
  rerenderActorApps(linkedActors);
  ui.items?.render?.(true);
  ui.sidebar?.tabs?.items?.render?.(true);

  return {
    createdCount: createdItems.length,
    updatedCount: updatedItems.length,
    refreshedActorCount: linkedActors.length
  };
}

async function readGearCatalogRows(settings = null) {
  void settings;
  const catalogs = Object.fromEntries(
    await Promise.all(
      GEAR_CATALOG_IMPORT_CONFIGS.map(async (config) => [
        config.catalogKey,
        await fetchGearCatalog(`${config.catalogKey}.json`)
      ])
    )
  );
  const remoteData = buildGearCatalogRemoteDataFromCatalogs(catalogs);
  const sourceHash = getGearCatalogSourceHash(remoteData.sheets);
  return {
    sourceHash,
    meta: remoteData.meta,
    sheets: Object.fromEntries(
      GEAR_CATALOG_SYNC_SHEET_CONFIGS.map((config) => [
        config.key,
        Array.isArray(remoteData.sheets?.[config.key])
          ? remoteData.sheets[config.key].map((row) => normalizeImportedRow(row, config))
          : []
      ])
    )
  };
}

async function previewGearCatalogImport(settings = null) {
  ensurePrimaryActiveGM();
  const remoteData = await readGearCatalogRows(settings);
  const plan = await buildImportPlan(remoteData.sheets);
  return {
    remoteData,
    sourceHash: remoteData.sourceHash,
    plan
  };
}

async function applyGearCatalogImport(settings = null) {
  ensurePrimaryActiveGM();
  const remoteData = await readGearCatalogRows(settings);
  const plan = await buildImportPlan(remoteData.sheets);

  if (
    !plan.operations.some((operation) => operation.mode === 'create' || operation.mode === 'update')
  ) {
    return {
      remoteData,
      sourceHash: remoteData.sourceHash,
      plan,
      applied: {
        createdCount: 0,
        updatedCount: 0,
        refreshedActorCount: 0
      }
    };
  }

  const applied = await applyImportPlan(plan);

  debugLog('Imported world items from gear catalog', {
    applied,
    summary: plan.summary
  });

  return {
    remoteData,
    sourceHash: remoteData.sourceHash,
    plan,
    applied
  };
}

export {
  GEAR_CATALOG_SYNC_COMMON_COLUMNS,
  GEAR_CATALOG_SYNC_ID_FLAG,
  GEAR_CATALOG_SYNC_SHEET_CONFIGS,
  GEAR_CATALOG_SYNC_SYSTEM_JSON_COLUMN,
  applyGearCatalogImport,
  buildGearCatalogRemoteDataFromCatalogs,
  getGearCatalogSourceHash,
  getGearCatalogSyncId,
  getSheetDisplayConfigs,
  previewGearCatalogImport
};
