export const ITEM_BASE_DEFAULTS = {
  description: '',
  rank: '',
  usageFrequency: 'passive',
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

export const ITEM_ACTIVATION_TYPE_LABEL_KEYS = {
  passive: 'MY_RPG.ActivationTypes.Passive',
  action: 'MY_RPG.ActivationTypes.Action',
  maneuver: 'MY_RPG.ActivationTypes.Maneuver',
  reaction: 'MY_RPG.ActivationTypes.Reaction'
};

export function normalizeUsageFrequency(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized === 'atWill') {
    return DEFAULT_ITEM_USAGE_FREQUENCY;
  }

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

function buildUsageFrequencyField() {
  return {
    path: 'usageFrequency',
    labelKey: 'MY_RPG.ItemFields.UsageFrequency',
    type: 'usageFrequency'
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
    path: 'activationType',
    labelKey: 'MY_RPG.ItemFields.ActivationType',
    type: 'activationType'
  };
}

function buildRangeField() {
  return {
    path: 'range',
    labelKey: 'MY_RPG.ItemFields.Range',
    type: 'text'
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

const EQUIPMENT_ITEM_FIELDS = [
  buildRankField(),
  buildRequiresRollField(),
  buildSkillField({ showWhenPath: 'requiresRoll' })
];
const TRAIT_ITEM_FIELDS = [
  buildUsageFrequencyField(),
  buildActivationTypeField(),
  buildRangeField(),
  buildRequiresRollField(),
  buildSkillField({ showWhenPath: 'requiresRoll' })
];

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
      skill: ''
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
      skill: ''
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
      skill: '',
      skillBonus: 0
    }
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
      itemPhys: 0,
      itemAzure: 0,
      itemMental: 0,
      itemShield: 0,
      itemSpeed: 0
    }
  },
  {
    type: 'equipment',
    supertype: 'equipment',
    groupKey: 'equipment',
    sheet: 'generic',
    defaults: {
      rank: '',
      requiresRoll: false,
      skill: ''
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
      skill: ''
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
    defaults: {
      activationType: 'passive',
      range: '',
      requiresRoll: false,
      skill: ''
    },
    fields: TRAIT_ITEM_FIELDS
  },
  {
    type: 'trait-flaw',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    legacy: true,
    defaults: {
      activationType: 'passive',
      range: '',
      requiresRoll: false,
      skill: ''
    },
    fields: TRAIT_ITEM_FIELDS
  },
  {
    type: 'trait-general',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    legacy: true,
    defaults: {
      activationType: 'passive',
      range: '',
      requiresRoll: false,
      skill: ''
    },
    fields: TRAIT_ITEM_FIELDS
  },
  {
    type: 'trait-backstory',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    legacy: true,
    defaults: {
      activationType: 'passive',
      range: '',
      requiresRoll: false,
      skill: ''
    },
    fields: TRAIT_ITEM_FIELDS
  },
  {
    type: 'trait-social',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    legacy: true,
    defaults: {
      activationType: 'passive',
      range: '',
      requiresRoll: false,
      skill: ''
    },
    fields: TRAIT_ITEM_FIELDS
  },
  {
    type: 'trait-combat',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    legacy: true,
    defaults: {
      activationType: 'passive',
      range: '',
      requiresRoll: false,
      skill: ''
    },
    fields: TRAIT_ITEM_FIELDS
  },
  {
    type: 'trait-magical',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    legacy: true,
    defaults: {
      activationType: 'passive',
      range: '',
      requiresRoll: false,
      skill: ''
    },
    fields: TRAIT_ITEM_FIELDS
  },
  {
    type: 'trait-professional',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    legacy: true,
    defaults: {
      activationType: 'passive',
      range: '',
      requiresRoll: false,
      skill: ''
    },
    fields: TRAIT_ITEM_FIELDS
  },
  {
    type: 'trait-technological',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    legacy: true,
    defaults: {
      activationType: 'passive',
      range: '',
      requiresRoll: false,
      skill: ''
    },
    fields: TRAIT_ITEM_FIELDS
  },
  {
    type: 'trait-genome',
    supertype: 'traits',
    groupKey: 'genomes',
    sheet: 'generic',
    defaults: {
      activationType: 'passive',
      range: '',
      requiresRoll: false,
      skill: ''
    },
    fields: TRAIT_ITEM_FIELDS
  },
  {
    type: 'trait-source-ability',
    supertype: 'traits',
    groupKey: 'sourceAbilities',
    sheet: 'generic',
    defaults: {
      activationType: 'passive',
      range: '',
      requiresRoll: false,
      skill: ''
    },
    fields: TRAIT_ITEM_FIELDS
  }
];

export const ITEM_GROUP_CONFIGS = [
  {
    key: 'genomes',
    types: ['trait-genome'],
    tab: 'abilities',
    icon: 'fas fa-dna',
    labelKey: 'MY_RPG.ItemGroups.Genomes',
    emptyKey: 'MY_RPG.ItemGroups.EmptyGenomes',
    createKey: 'MY_RPG.ItemGroups.CreateGenome',
    newNameKey: 'MY_RPG.ItemGroups.NewGenome',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  {
    key: 'sourceAbilities',
    types: ['trait-source-ability'],
    tab: 'abilities',
    icon: 'fas fa-bolt',
    labelKey: 'MY_RPG.ItemGroups.SourceAbilities',
    emptyKey: 'MY_RPG.ItemGroups.EmptySourceAbilities',
    createKey: 'MY_RPG.ItemGroups.CreateSourceAbility',
    newNameKey: 'MY_RPG.ItemGroups.NewSourceAbility',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  {
    key: 'weapons',
    types: ['weapon'],
    tab: 'inventory',
    icon: 'fas fa-crosshairs',
    labelKey: 'MY_RPG.ItemGroups.Weapons',
    emptyKey: 'MY_RPG.ItemGroups.EmptyWeapons',
    createKey: 'MY_RPG.ItemGroups.CreateWeapon',
    newNameKey: 'MY_RPG.ItemGroups.NewWeapon',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: true
  },
  {
    key: 'armor',
    types: ['armor'],
    tab: 'inventory',
    icon: 'fas fa-shield-alt',
    labelKey: 'MY_RPG.ItemGroups.Armor',
    emptyKey: 'MY_RPG.ItemGroups.EmptyArmor',
    createKey: 'MY_RPG.ItemGroups.CreateArmor',
    newNameKey: 'MY_RPG.ItemGroups.NewArmor',
    showQuantity: false,
    allowEquip: true,
    exclusive: true,
    canRoll: false
  },
  {
    key: 'equipment',
    types: ['equipment', 'equipment-consumable', 'implant', 'cartridge'],
    createTypes: ['equipment'],
    tab: 'inventory',
    icon: 'fas fa-toolbox',
    labelKey: 'MY_RPG.ItemGroups.Equipment',
    emptyKey: 'MY_RPG.ItemGroups.EmptyEquipment',
    createKey: 'MY_RPG.ItemGroups.CreateEquipment',
    newNameKey: 'MY_RPG.ItemGroups.NewEquipment',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
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
  },
  {
    key: 'traits',
    types: [
      'trait',
      'trait-flaw',
      'trait-general',
      'trait-backstory',
      'trait-social',
      'trait-combat',
      'trait-magical',
      'trait-professional',
      'trait-technological'
    ],
    createTypes: ['trait'],
    filter: isStandardTraitItem,
    tab: 'abilities',
    icon: 'fas fa-tags',
    labelKey: 'MY_RPG.ItemGroups.Traits',
    emptyKey: 'MY_RPG.ItemGroups.EmptyTraits',
    createKey: 'MY_RPG.ItemGroups.CreateTrait',
    newNameKey: 'MY_RPG.ItemGroups.NewTrait',
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

export function isEquipmentLikeType(type) {
  return ['equipment', 'equipment-consumable', 'cartridge', 'implant'].includes(
    String(type ?? '').trim()
  );
}

export function getItemGroupConfigByKey(key) {
  if (!key) return null;
  return ITEM_GROUP_CONFIG_BY_KEY[key] ?? null;
}

export function getItemGroupConfigs() {
  return ITEM_GROUP_CONFIGS;
}

export function getItemGroupConfigsByType(type) {
  return ITEM_GROUP_CONFIGS.filter((config) => config.types.includes(type));
}

export function getItemTabLabel(tabKey) {
  const tab = ITEM_TABS.find((entry) => entry.key === tabKey);
  if (!tab) return tabKey;
  return tab.labelKey;
}

function buildUsageFrequencyBadge(item, helpers) {
  const system = item.system ?? {};
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
  const activationType = String(system.activationType ?? '').trim();
  const activationLabelKey = ITEM_ACTIVATION_TYPE_LABEL_KEYS[activationType];
  if (activationLabelKey) {
    badges.push(
      `${t.localize('MY_RPG.ItemFields.ActivationType')}: ${t.localize(activationLabelKey)}`
    );
  }

  const range = String(system.range ?? '').trim();
  if (range) {
    badges.push(`${t.localize('MY_RPG.ItemFields.Range')}: ${range}`);
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

  return badges;
}

const TRAIT_BADGE_GROUPS = ['genomes', 'sourceAbilities', 'traits'];

export const ITEM_BADGE_BUILDERS = {
  weapons: (item, helpers) => {
    const system = item.system ?? {};
    const t = helpers.t;
    return [
      `${t.localize('MY_RPG.WeaponsTable.SkillLabel')}: ${helpers.skillLabel(system.skill)}`,
      `${t.localize('MY_RPG.WeaponsTable.DamageLabel')}: ${helpers.formatDamage(system.skillBonus)}`
    ];
  },
  armor: (item, helpers) => {
    const system = item.system ?? {};
    const t = helpers.t;
    const badges = [];
    const phys = Number(system.itemPhys) || 0;
    const azure = Number(system.itemAzure) || 0;
    const mental = Number(system.itemMental) || 0;
    const shield = Number(system.itemShield) || 0;
    const speed = Number(system.itemSpeed) || 0;
    if (phys) badges.push(`${t.localize('MY_RPG.ArmorItem.BonusPhysicalLabel')}: ${phys}`);
    if (azure) badges.push(`${t.localize('MY_RPG.ArmorItem.BonusMagicalLabel')}: ${azure}`);
    if (mental) badges.push(`${t.localize('MY_RPG.ArmorItem.BonusPsychicLabel')}: ${mental}`);
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
  ...Object.fromEntries(TRAIT_BADGE_GROUPS.map((groupKey) => [groupKey, buildTraitBadges]))
};
