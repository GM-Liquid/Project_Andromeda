import { MODULE_ID } from '../config.mjs';
import { ARCHETYPE_GRANT_FLAG } from './archetype.mjs';
import { formatDamageProfile } from './damage-profile.mjs';

export const ITEM_BASE_DEFAULTS = {
  description: '',
  rank: '',
  usageFrequency: 'passive',
  activationCost: 'passive',
  duration: '',
  area: '',
  defense: '',
  range: '',
  targets: '',
  equipped: false,
  rules: [],
  traits: [],
  details: {}
};

export const ITEM_SUPERTYPE_LABELS = {
  equipment: 'MY_RPG.ItemTypeGroups.Equipment',
  environment: 'MY_RPG.ItemTypeGroups.Environment',
  traits: 'MY_RPG.ItemTypeGroups.Traits',
  other: 'MY_RPG.ItemTypeGroups.Other'
};

export const ITEM_USAGE_FREQUENCY_LABEL_KEYS = {
  scene: 'MY_RPG.UsageFrequency.Scene',
  twoPerScene: 'MY_RPG.UsageFrequency.TwoPerScene',
  passive: 'MY_RPG.UsageFrequency.Passive'
};

export const DEFAULT_ITEM_USAGE_FREQUENCY = 'passive';
export const PERSONALITY_ITEM_ROLE_VALUE = 'value';

export function normalizeBaseHeatCost(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

export function getAbilityBaseHeatCost(source) {
  const system = source?.system ?? source ?? {};
  if (system.heatCost !== '' && system.heatCost != null) {
    return normalizeBaseHeatCost(system.heatCost);
  }
  // Compatibility fallback until the one-time migration rewrites legacy world items.
  return String(system.mode ?? '').trim() === 'forced' ? 2 : 0;
}

// Each rank by which the character outgrows the ability reduces its base Heat cost by 1.
// An ability above the character's rank never costs more than its stored base value.
export function getAbilityHeatCost(source, characterRank) {
  const system = source?.system ?? source ?? {};
  const baseHeatCost = getAbilityBaseHeatCost(system);
  const abilityRank = Math.max(1, Math.floor(Number(system.rank) || 1));
  const actorRank = Math.max(1, Math.floor(Number(characterRank) || 1));
  const rankDifference = Math.max(0, actorRank - abilityRank);
  return Math.max(0, baseHeatCost - rankDifference);
}

export const ITEM_ACTIVATION_TYPE_LABEL_KEYS = {
  passive: 'MY_RPG.ActivationTypes.Passive',
  action: 'MY_RPG.ActivationTypes.Action',
  maneuver: 'MY_RPG.ActivationTypes.Maneuver',
  freeAction: 'MY_RPG.ActivationTypes.FreeAction',
  reaction: 'MY_RPG.ActivationTypes.Reaction'
};

export const ITEM_DEFENSE_LABEL_KEYS = {
  fortitude: 'MY_RPG.Defenses.FortitudeLabel',
  control: 'MY_RPG.Defenses.ControlLabel',
  will: 'MY_RPG.Defenses.WillLabel'
};

export const ARCHETYPE_DEFENSE_LABEL_KEYS = {
  fortitude: 'MY_RPG.Defenses.FortitudeLabel',
  control: 'MY_RPG.Defenses.ControlLabel',
  will: 'MY_RPG.Defenses.WillLabel'
};

export const ITEM_DURATION_LABEL_KEYS = {
  untilCanceled: 'MY_RPG.ItemDurations.UntilCanceled',
  untilEndOfScene: 'MY_RPG.ItemDurations.UntilEndOfScene',
  untilEndOfTurn: 'MY_RPG.ItemDurations.UntilEndOfTurn',
  untilMove: 'MY_RPG.ItemDurations.UntilMove',
  untilStartOfYourNextTurn: 'MY_RPG.ItemDurations.UntilStartOfYourNextTurn'
};

export const ITEM_TARGET_LABEL_KEYS = {
  allInArea: 'MY_RPG.ItemTargets.AllInArea',
  allInLine: 'MY_RPG.ItemTargets.AllInLine',
  area: 'MY_RPG.ItemTargets.Area',
  self: 'MY_RPG.ItemTargets.Self',
  single: 'MY_RPG.ItemTargets.Single',
  upTo2: 'MY_RPG.ItemTargets.UpTo2',
  upTo3: 'MY_RPG.ItemTargets.UpTo3'
};

export function normalizeUsageFrequency(value) {
  const normalized = String(value ?? '').trim();
  const aliases = {
    atWill: DEFAULT_ITEM_USAGE_FREQUENCY,
    oncePerScene: 'scene',
    oncePerSession: 'twoPerScene'
  };
  if (!normalized) {
    return DEFAULT_ITEM_USAGE_FREQUENCY;
  }

  if (Object.hasOwn(aliases, normalized)) return aliases[normalized];

  if (Object.hasOwn(ITEM_USAGE_FREQUENCY_LABEL_KEYS, normalized)) {
    return normalized;
  }

  return DEFAULT_ITEM_USAGE_FREQUENCY;
}

export function getItemPersonalityRole(source) {
  return String(source?.system?.details?.personalityRole ?? source?.details?.personalityRole ?? '')
    .trim()
    .toLowerCase();
}

export function isPersonalityValueItem(source) {
  return getItemPersonalityRole(source) === PERSONALITY_ITEM_ROLE_VALUE;
}

function isStandardTraitItem(source) {
  return !isPersonalityValueItem(source);
}

// Черты и способности покупаются из того же пула очков развития, что и навыки
// (книга правил, глава 4): черта ранга X стоит `2 × X`, способность ранга X — `3 × X`.
export const TRAIT_ADVANCEMENT_MULTIPLIER = 2;
export const ABILITY_ADVANCEMENT_MULTIPLIER = 3;

function isArchetypeGrantedItem(source) {
  if (typeof source?.getFlag === 'function') {
    return Boolean(source.getFlag(MODULE_ID, ARCHETYPE_GRANT_FLAG));
  }
  return Boolean(source?.flags?.[MODULE_ID]?.[ARCHETYPE_GRANT_FLAG]);
}

// Cost in progression points for a single owned trait / ability item. Returns 0 for
// anything that is not a purchasable entry: personality complications, the free
// archetype signature ability, unranked entries, genomes and legacy migration types.
export function getItemAdvancementCost(source) {
  const type = String(source?.type ?? '').trim();
  const rank = Math.max(0, Math.floor(Number(source?.system?.rank) || 0));
  if (!rank) return 0;

  if (type === 'trait') {
    if (isPersonalityValueItem(source)) return 0;
    return TRAIT_ADVANCEMENT_MULTIPLIER * rank;
  }

  if (type === 'trait-source-ability') {
    if (isArchetypeGrantedItem(source)) return 0;
    return ABILITY_ADVANCEMENT_MULTIPLIER * rank;
  }

  return 0;
}

function buildUsageFrequencyField() {
  return {
    path: 'usageFrequency',
    labelKey: 'MY_RPG.ItemFields.UsageFrequency',
    type: 'usageFrequency'
  };
}

function buildAbilityHeatCostField() {
  return {
    path: 'heatCost',
    labelKey: 'MY_RPG.ItemFields.BaseHeatCost',
    type: 'number',
    min: 0
  };
}

function buildRankField() {
  return {
    path: 'rank',
    labelKey: 'MY_RPG.ItemFields.Rank',
    type: 'rank'
  };
}

function buildRequiresRollField() {
  return {
    path: 'requiresRoll',
    labelKey: 'MY_RPG.ItemFields.RequiresRoll',
    type: 'checkbox'
  };
}

function buildActivationTypeField() {
  return {
    path: 'activationCost',
    labelKey: 'MY_RPG.ItemFields.ActivationCost',
    type: 'activationCost'
  };
}

function buildRangeField() {
  return {
    path: 'range',
    labelKey: 'MY_RPG.ItemFields.Range',
    type: 'text'
  };
}

function buildDurationField() {
  return {
    path: 'duration',
    labelKey: 'MY_RPG.ItemFields.Duration',
    type: 'duration'
  };
}

function buildAreaField() {
  return {
    path: 'area',
    labelKey: 'MY_RPG.ItemFields.Area',
    type: 'text'
  };
}

function buildDefenseField() {
  return {
    path: 'defense',
    labelKey: 'MY_RPG.ItemFields.Defense',
    type: 'defense'
  };
}

function buildTargetsField() {
  return {
    path: 'targets',
    labelKey: 'MY_RPG.ItemFields.Targets',
    type: 'targets'
  };
}

function buildSkillField(options = {}) {
  return {
    path: 'skill',
    labelKey: 'MY_RPG.AbilityConfig.Skill',
    type: 'skill',
    ...options
  };
}

function buildDamageField() {
  return {
    path: 'skillBonus',
    labelKey: 'MY_RPG.WeaponsTable.DamageLabel',
    type: 'text'
  };
}

const EQUIPMENT_ITEM_FIELDS = [
  buildRankField(),
  buildUsageFrequencyField(),
  buildActivationTypeField(),
  buildRangeField(),
  buildDurationField(),
  buildAreaField(),
  buildDefenseField(),
  buildTargetsField(),
  buildRequiresRollField(),
  buildSkillField({ showWhenPath: 'requiresRoll' }),
  buildDamageField()
];
const TRAIT_EFFECT_FIELDS = [
  buildUsageFrequencyField(),
  buildActivationTypeField(),
  buildRangeField(),
  buildDurationField(),
  buildAreaField(),
  buildDefenseField(),
  buildTargetsField(),
  buildRequiresRollField(),
  buildSkillField({ showWhenPath: 'requiresRoll' }),
  buildDamageField()
];
const TRAIT_ITEM_FIELDS = [buildRankField(), ...TRAIT_EFFECT_FIELDS];
const ABILITY_ITEM_FIELDS = [buildRankField(), buildAbilityHeatCostField(), ...TRAIT_EFFECT_FIELDS];
const ARTIFACT_ITEM_FIELDS = [
  buildRankField(),
  buildAbilityHeatCostField(),
  ...TRAIT_EFFECT_FIELDS
];
const WEAPON_ITEM_FIELDS = [
  buildUsageFrequencyField(),
  buildActivationTypeField(),
  buildRangeField(),
  buildDurationField(),
  buildAreaField(),
  buildDefenseField(),
  buildTargetsField()
];
const ARCHETYPE_ITEM_FIELDS = [
  buildSkillField(),
  {
    path: 'abilityName',
    labelKey: 'MY_RPG.Archetype.SignatureAbility',
    type: 'text',
    readonly: true
  },
  {
    path: 'traitName',
    labelKey: 'MY_RPG.Archetype.SignatureTrait',
    type: 'text',
    readonly: true
  },
  {
    path: 'defenseProfile.strong',
    labelKey: 'MY_RPG.Archetype.StrongDefense',
    type: 'archetypeDefense'
  },
  {
    path: 'defenseProfile.medium',
    labelKey: 'MY_RPG.Archetype.MediumDefense',
    type: 'archetypeDefense'
  },
  {
    path: 'defenseProfile.weak',
    labelKey: 'MY_RPG.Archetype.WeakDefense',
    type: 'archetypeDefense'
  },
  {
    path: 'stressBonusPerRank',
    labelKey: 'MY_RPG.Archetype.TempStressPerRank',
    type: 'number',
    min: 0
  }
];
const ARMOR_ITEM_FIELDS = [
  buildUsageFrequencyField(),
  buildActivationTypeField(),
  buildRangeField(),
  buildDurationField(),
  buildAreaField(),
  buildDefenseField(),
  buildTargetsField(),
  buildRequiresRollField(),
  buildSkillField({ showWhenPath: 'requiresRoll' })
];

const TRAIT_ITEM_DEFAULTS = Object.freeze({
  activationCost: 'passive',
  activationType: 'passive',
  range: '',
  duration: '',
  area: '',
  defense: '',
  targets: '',
  requiresRoll: false,
  skill: '',
  skillBonus: '0/0/0/0'
});

// Migration-only compatibility subtypes of the unified `trait` type (see AGENTS.md
// §6). They share one config shape and must never be offered for new content.
export const LEGACY_TRAIT_TYPES = Object.freeze([
  'trait-flaw',
  'trait-general',
  'trait-backstory',
  'trait-social',
  'trait-combat',
  'trait-magical',
  'trait-professional',
  'trait-technological'
]);

const LEGACY_TRAIT_TYPE_CONFIGS = LEGACY_TRAIT_TYPES.map((type) => ({
  type,
  supertype: 'traits',
  groupKey: 'traits',
  sheet: 'generic',
  legacy: true,
  defaults: TRAIT_ITEM_DEFAULTS,
  fields: TRAIT_ITEM_FIELDS
}));

export const ITEM_TYPE_CONFIGS = [
  {
    type: 'cartridge',
    supertype: 'equipment',
    groupKey: 'equipment',
    sheet: 'generic',
    legacy: true,
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: true,
    defaults: {
      requiresRoll: true,
      skill: '',
      skillBonus: '0/0/0/0'
    },
    fields: EQUIPMENT_ITEM_FIELDS
  },
  {
    type: 'implant',
    supertype: 'equipment',
    groupKey: 'equipment',
    sheet: 'generic',
    legacy: true,
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: true,
    defaults: {
      requiresRoll: true,
      skill: '',
      skillBonus: '0/0/0/0'
    },
    fields: EQUIPMENT_ITEM_FIELDS
  },
  {
    type: 'weapon',
    supertype: 'equipment',
    groupKey: 'weapons',
    sheet: 'weapon',
    badgeGroupKey: 'weapons',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: true,
    defaults: {
      quantity: 1,
      requiresRoll: true,
      skill: '',
      skillBonus: '0/0/0/0'
    },
    fields: WEAPON_ITEM_FIELDS
  },
  {
    type: 'armor',
    supertype: 'equipment',
    groupKey: 'armor',
    sheet: 'armor',
    badgeGroupKey: 'armor',
    showQuantity: false,
    allowEquip: true,
    exclusive: true,
    canRoll: false,
    defaults: {
      quantity: 1,
      itemFortitude: 0,
      itemControl: 0,
      itemWill: 0,
      itemShield: 0,
      itemSpeed: 0,
      requiresRoll: false,
      skill: ''
    },
    fields: ARMOR_ITEM_FIELDS
  },
  {
    type: 'equipment',
    supertype: 'equipment',
    groupKey: 'equipment',
    sheet: 'generic',
    defaults: {
      rank: '',
      requiresRoll: false,
      skill: '',
      skillBonus: '0/0/0/0'
    },
    fields: EQUIPMENT_ITEM_FIELDS
  },
  {
    type: 'equipment-consumable',
    supertype: 'equipment',
    groupKey: 'equipment',
    sheet: 'generic',
    legacy: true,
    defaults: {
      rank: '',
      requiresRoll: false,
      skill: '',
      skillBonus: '0/0/0/0'
    },
    fields: EQUIPMENT_ITEM_FIELDS
  },
  {
    type: 'environment-consumable',
    supertype: 'environment',
    groupKey: 'environment',
    sheet: 'generic',
    defaults: {
      quantity: 1
    },
    fields: [
      {
        path: 'quantity',
        labelKey: 'MY_RPG.ItemFields.Quantity',
        type: 'number',
        min: 0
      }
    ]
  },
  {
    type: 'environment-interactive',
    supertype: 'environment',
    groupKey: 'environment',
    sheet: 'generic'
  },
  {
    type: 'environment-narrative',
    supertype: 'environment',
    groupKey: 'environment',
    sheet: 'generic'
  },
  {
    type: 'environment-resource',
    supertype: 'environment',
    groupKey: 'environment',
    sheet: 'generic',
    defaults: {
      quantity: 1
    },
    fields: [
      {
        path: 'quantity',
        labelKey: 'MY_RPG.ItemFields.Quantity',
        type: 'number',
        min: 0
      }
    ]
  },
  {
    type: 'environment-trigger',
    supertype: 'environment',
    groupKey: 'environment',
    sheet: 'generic'
  },
  {
    type: 'environment-danger',
    supertype: 'environment',
    groupKey: 'environment',
    sheet: 'generic'
  },
  {
    type: 'trait',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    defaults: TRAIT_ITEM_DEFAULTS,
    fields: TRAIT_ITEM_FIELDS
  },
  ...LEGACY_TRAIT_TYPE_CONFIGS,
  {
    type: 'trait-genome',
    supertype: 'traits',
    groupKey: 'genomes',
    sheet: 'generic',
    defaults: TRAIT_ITEM_DEFAULTS,
    fields: TRAIT_ITEM_FIELDS
  },
  {
    type: 'trait-source-ability',
    supertype: 'traits',
    groupKey: 'sourceAbilities',
    sheet: 'generic',
    defaults: {
      heatCost: 0,
      activationCost: 'passive',
      activationType: 'passive',
      range: '',
      duration: '',
      area: '',
      defense: '',
      targets: '',
      requiresRoll: false,
      skill: ''
    },
    fields: ABILITY_ITEM_FIELDS
  },
  {
    type: 'artifact',
    supertype: 'equipment',
    groupKey: 'artifacts',
    sheet: 'generic',
    badgeGroupKey: 'artifacts',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false,
    defaults: {
      rank: '',
      heatCost: 0,
      requiresRoll: false,
      skill: '',
      skillBonus: '0/0/0/0'
    },
    fields: ARTIFACT_ITEM_FIELDS
  },
  {
    type: 'archetype',
    supertype: 'other',
    groupKey: 'archetypes',
    sheet: 'generic',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false,
    defaults: {
      skill: '',
      defenseProfile: { strong: '', medium: '', weak: '' },
      stressBonusPerRank: 0,
      trait: {},
      traitSyncId: '',
      traitName: '',
      abilitySyncId: '',
      abilityName: ''
    },
    fields: ARCHETYPE_ITEM_FIELDS
  }
];

// `compendiumFolder` names the top-level folder inside the shipped `gear-library`
// pack that holds this group's catalog. It must match the folder names produced by
// the catalog transform (see `module/helpers/gear-catalog.mjs`) so the sheet's
// "Browse Compendium" action can open straight to the matching section. Groups
// without a catalog (e.g. personality complications) omit it and create directly.
export const ITEM_GROUP_CONFIGS = [
  {
    key: 'archetypes',
    compendiumFolder: 'Архетипы',
    types: ['archetype'],
    createTypes: ['archetype'],
    tab: 'abilities',
    icon: 'fas fa-user-astronaut',
    labelKey: 'MY_RPG.ItemGroups.Archetypes',
    emptyKey: 'MY_RPG.ItemGroups.EmptyArchetypes',
    createKey: 'MY_RPG.ItemGroups.CreateArchetype',
    newNameKey: 'MY_RPG.ItemGroups.NewArchetype',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false,
    showKindBadge: false
  },
  // Активные способности (тип `trait-source-ability`). Пассивные черты живут в
  // отдельной группе `traits` ниже. Legacy `trait-*` подтипы остаются здесь, чтобы
  // старые предметы продолжали отображаться без миграции.
  {
    key: 'abilities',
    compendiumFolder: 'Способности',
    types: [
      'trait-source-ability',
      'trait-genome',
      'trait-flaw',
      'trait-general',
      'trait-backstory',
      'trait-social',
      'trait-combat',
      'trait-magical',
      'trait-professional',
      'trait-technological'
    ],
    createTypes: ['trait-source-ability'],
    filter: isStandardTraitItem,
    tab: 'abilities',
    icon: 'fas fa-bolt',
    labelKey: 'MY_RPG.ItemGroups.Abilities',
    emptyKey: 'MY_RPG.ItemGroups.EmptyAbilities',
    createKey: 'MY_RPG.ItemGroups.CreateAbility',
    newNameKey: 'MY_RPG.ItemGroups.NewAbility',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false,
    showKindBadge: false
  },
  // Пассивные черты (тип `trait`, кроме осложнений личности). Собственная вкладка
  // и раздел компендиума «Черты». Badge-группа `traits` даёт стандартные бейджи.
  {
    key: 'traits',
    compendiumFolder: 'Черты',
    types: ['trait'],
    createTypes: ['trait'],
    filter: isStandardTraitItem,
    tab: 'traits',
    icon: 'fas fa-star',
    labelKey: 'MY_RPG.ItemGroups.Traits',
    emptyKey: 'MY_RPG.ItemGroups.EmptyTraits',
    createKey: 'MY_RPG.ItemGroups.CreateTrait',
    newNameKey: 'MY_RPG.ItemGroups.NewTrait',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false,
    showKindBadge: false
  },
  {
    key: 'artifacts',
    compendiumFolder: 'Артефакты',
    types: ['artifact'],
    createTypes: ['artifact'],
    tab: 'inventory',
    icon: 'fas fa-gem',
    labelKey: 'MY_RPG.ItemGroups.Artifacts',
    emptyKey: 'MY_RPG.ItemGroups.EmptyArtifacts',
    createKey: 'MY_RPG.ItemGroups.CreateArtifact',
    newNameKey: 'MY_RPG.ItemGroups.NewArtifact',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  // Keep the legacy group key, role, and localization keys so existing actor items
  // continue to render as complications without a migration.
  {
    key: 'personalityValues',
    types: ['trait'],
    createTypes: ['trait'],
    createData: {
      details: {
        personalityRole: PERSONALITY_ITEM_ROLE_VALUE
      }
    },
    filter: isPersonalityValueItem,
    tab: 'personality',
    icon: 'fas fa-heart',
    labelKey: 'MY_RPG.ItemGroups.Values',
    emptyKey: 'MY_RPG.ItemGroups.EmptyValues',
    createKey: 'MY_RPG.ItemGroups.CreateValue',
    newNameKey: 'MY_RPG.ItemGroups.NewValue',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  }
];

const ITEM_TYPE_CONFIG_BY_TYPE = ITEM_TYPE_CONFIGS.reduce((acc, config) => {
  acc[config.type] = config;
  return acc;
}, {});

const ITEM_GROUP_CONFIG_BY_KEY = ITEM_GROUP_CONFIGS.reduce((acc, config) => {
  acc[config.key] = config;
  return acc;
}, {});

export const ITEM_TABS = [
  {
    key: 'abilities',
    labelKey: 'MY_RPG.SheetLabels.AbilitiesAndMods'
  },
  {
    key: 'traits',
    labelKey: 'MY_RPG.SheetLabels.Traits'
  },
  {
    key: 'inventory',
    labelKey: 'MY_RPG.SheetLabels.Inventory'
  }
];

export function getItemTypeConfig(type) {
  if (!type) return null;
  return ITEM_TYPE_CONFIG_BY_TYPE[type] ?? null;
}

export function getItemTypeDefaults(type) {
  const config = getItemTypeConfig(type);
  return config?.defaults ?? null;
}

// Migration-only compatibility types of the unified `equipment` model (AGENTS.md §6).
export const LEGACY_EQUIPMENT_TYPES = Object.freeze([
  'cartridge',
  'implant',
  'equipment-consumable'
]);

export function isEquipmentLikeType(type) {
  const normalized = String(type ?? '').trim();
  return normalized === 'equipment' || LEGACY_EQUIPMENT_TYPES.includes(normalized);
}

export function getItemGroupConfigByKey(key) {
  if (!key) return null;
  return ITEM_GROUP_CONFIG_BY_KEY[key] ?? null;
}

export function getItemGroupConfigs() {
  return ITEM_GROUP_CONFIGS;
}

export function getItemTabLabel(tabKey) {
  const tab = ITEM_TABS.find((entry) => entry.key === tabKey);
  if (!tab) return tabKey;
  return tab.labelKey;
}

function buildUsageFrequencyBadge(item, helpers) {
  const system = item.system ?? {};
  if (item.type === 'trait-source-ability' || item.type === 'artifact') return [];
  const value = normalizeUsageFrequency(system.usageFrequency);
  const labelKey = ITEM_USAGE_FREQUENCY_LABEL_KEYS[value];
  if (!labelKey) return [];
  const t = helpers.t;
  return [`${t.localize('MY_RPG.ItemFields.UsageFrequency')}: ${t.localize(labelKey)}`];
}

function buildTraitBadges(item, helpers) {
  const system = item.system ?? {};
  const t = helpers.t;
  const badges = [];

  const rank = Number(system.rank) || 0;
  if (rank && typeof helpers.getRankLabel === 'function') {
    badges.push(`${t.localize('MY_RPG.ItemFields.Rank')}: ${helpers.getRankLabel(rank)}`);
  }

  const advancementCost = getItemAdvancementCost(item);
  if (advancementCost > 0) {
    badges.push(`${t.localize('MY_RPG.ItemFields.AdvancementCost')}: ${advancementCost}`);
  }

  const activationCost = String(system.activationCost ?? system.activationType ?? '').trim();
  const activationLabelKey = ITEM_ACTIVATION_TYPE_LABEL_KEYS[activationCost];
  if (activationLabelKey) {
    badges.push(
      `${t.localize('MY_RPG.ItemFields.ActivationCost')}: ${t.localize(activationLabelKey)}`
    );
  }

  const range = String(system.range ?? '').trim();
  if (range) {
    badges.push(`${t.localize('MY_RPG.ItemFields.Range')}: ${range}`);
  }

  const duration = String(system.duration ?? '').trim();
  const durationLabelKey = ITEM_DURATION_LABEL_KEYS[duration];
  if (durationLabelKey) {
    badges.push(`${t.localize('MY_RPG.ItemFields.Duration')}: ${t.localize(durationLabelKey)}`);
  }

  const area = String(system.area ?? '').trim();
  if (area) {
    badges.push(`${t.localize('MY_RPG.ItemFields.Area')}: ${area}`);
  }

  const defense = String(system.defense ?? '').trim();
  const defenseLabelKey = ITEM_DEFENSE_LABEL_KEYS[defense];
  if (defenseLabelKey) {
    badges.push(`${t.localize('MY_RPG.ItemFields.Defense')}: ${t.localize(defenseLabelKey)}`);
  }

  const targets = String(system.targets ?? '').trim();
  const targetLabelKey = ITEM_TARGET_LABEL_KEYS[targets];
  if (targetLabelKey) {
    badges.push(`${t.localize('MY_RPG.ItemFields.Targets')}: ${t.localize(targetLabelKey)}`);
  }

  badges.push(...buildUsageFrequencyBadge(item, helpers));

  if (system.requiresRoll) {
    badges.push(t.localize('MY_RPG.ItemFields.RequiresRoll'));
    if (system.skill) {
      badges.push(
        `${t.localize('MY_RPG.AbilityConfig.Skill')}: ${helpers.skillLabel(system.skill)}`
      );
    }
  }

  const damage = formatDamageProfile(system.skillBonus);
  if (damage !== '0/0/0/0') {
    badges.push(`${t.localize('MY_RPG.WeaponsTable.DamageLabel')}: ${damage}`);
  }

  return badges;
}

const TRAIT_BADGE_GROUPS = ['genomes', 'sourceAbilities', 'traits'];

export const ITEM_BADGE_BUILDERS = {
  weapons: (item, helpers) => {
    const system = item.system ?? {};
    const t = helpers.t;
    return [
      `${t.localize('MY_RPG.WeaponsTable.SkillLabel')}: ${helpers.skillLabel(system.skill)}`,
      `${t.localize('MY_RPG.WeaponsTable.DamageLabel')}: ${formatDamageProfile(system.skillBonus)}`
    ];
  },
  armor: (item, helpers) => {
    const system = item.system ?? {};
    const t = helpers.t;
    const badges = [];
    const fortitude = Number(system.itemFortitude) || 0;
    const control = Number(system.itemControl) || 0;
    const will = Number(system.itemWill) || 0;
    const shield = Number(system.itemShield) || 0;
    const speed = Number(system.itemSpeed) || 0;
    if (fortitude) {
      badges.push(`${t.localize('MY_RPG.ArmorItem.BonusFortitudeLabel')}: ${fortitude}`);
    }
    if (control) badges.push(`${t.localize('MY_RPG.ArmorItem.BonusControlLabel')}: ${control}`);
    if (will) badges.push(`${t.localize('MY_RPG.ArmorItem.BonusWillLabel')}: ${will}`);
    if (shield) badges.push(`${t.localize('MY_RPG.ArmorItem.ShieldLabel')}: ${shield}`);
    if (speed) badges.push(`${t.localize('MY_RPG.ArmorItem.BonusSpeedLabel')}: ${speed}`);
    return badges;
  },
  equipment: (item, helpers) => {
    const system = item?.system ?? {};
    const badges = [];
    const rank = Number(item?.system?.rank) || 0;
    if (rank) {
      badges.push(`${helpers.t.localize('MY_RPG.ItemFields.Rank')}: ${helpers.getRankLabel(rank)}`);
    }
    if (system.requiresRoll && system.skill) {
      badges.push(
        `${helpers.t.localize('MY_RPG.AbilityConfig.Skill')}: ${helpers.skillLabel(system.skill)}`
      );
    }
    return badges;
  },
  ...Object.fromEntries(
    [...TRAIT_BADGE_GROUPS, 'artifacts'].map((groupKey) => [groupKey, buildTraitBadges])
  )
};
