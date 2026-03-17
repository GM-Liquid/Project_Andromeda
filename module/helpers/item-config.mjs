export const ITEM_BASE_DEFAULTS = {
  description: '',
  rank: '',
  usageFrequency: 'atWill',
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
  atWill: 'MY_RPG.UsageFrequency.AtWill',
  scene: 'MY_RPG.UsageFrequency.Scene',
  passive: 'MY_RPG.UsageFrequency.Passive'
};

function buildUsageFrequencyField() {
  return {
    path: 'usageFrequency',
    labelKey: 'MY_RPG.ItemFields.UsageFrequency',
    type: 'usageFrequency'
  };
}

function buildQuantityField() {
  return {
    path: 'quantity',
    labelKey: 'MY_RPG.ItemFields.Quantity',
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

function buildSkillField() {
  return {
    path: 'skill',
    labelKey: 'MY_RPG.AbilityConfig.Skill',
    type: 'skill'
  };
}

function buildSkillBonusField() {
  return {
    path: 'skillBonus',
    labelKey: 'MY_RPG.AbilityConfig.SkillBonus',
    type: 'number'
  };
}

const EQUIPMENT_SUBTYPE_FALLBACK_BY_TYPE = {
  equipment: 'gear',
  'equipment-consumable': 'consumable',
  cartridge: 'cartridge',
  implant: 'implant'
};

export const EQUIPMENT_SUBTYPE_CONFIGS = {
  gear: {
    labelKey: 'MY_RPG.EquipmentSubtypes.Gear',
    badgeGroupKey: 'equipment',
    showQuantity: true,
    allowEquip: false,
    exclusive: false,
    canRoll: false,
    fields: [buildQuantityField(), buildRankField()]
  },
  consumable: {
    labelKey: 'MY_RPG.EquipmentSubtypes.Consumable',
    badgeGroupKey: 'equipmentConsumables',
    showQuantity: true,
    allowEquip: false,
    exclusive: false,
    canRoll: false,
    fields: [buildQuantityField(), buildRankField()]
  },
  cartridge: {
    labelKey: 'MY_RPG.EquipmentSubtypes.Cartridge',
    badgeGroupKey: 'cartridges',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: true,
    fields: [buildRankField(), buildSkillField(), buildSkillBonusField()]
  },
  implant: {
    labelKey: 'MY_RPG.EquipmentSubtypes.Implant',
    badgeGroupKey: 'implants',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: true,
    fields: [buildRankField(), buildSkillField(), buildSkillBonusField()]
  }
};

export const ITEM_TYPE_CONFIGS = [
  {
    type: 'cartridge',
    supertype: 'equipment',
    groupKey: 'equipment',
    sheet: 'generic',
    legacy: true,
    badgeGroupKey: 'cartridges',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: true,
    defaults: {
      equipmentSubtype: 'cartridge',
      skill: '',
      skillBonus: 0
    }
  },
  {
    type: 'implant',
    supertype: 'equipment',
    groupKey: 'equipment',
    sheet: 'generic',
    legacy: true,
    badgeGroupKey: 'implants',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: true,
    defaults: {
      equipmentSubtype: 'implant',
      skill: '',
      skillBonus: 0
    }
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
      quantity: 1,
      rank: '',
      equipmentSubtype: 'gear',
      skill: '',
      skillBonus: 0
    }
  },
  {
    type: 'equipment-consumable',
    supertype: 'equipment',
    groupKey: 'equipment',
    sheet: 'generic',
    legacy: true,
    defaults: {
      quantity: 1,
      rank: '',
      equipmentSubtype: 'consumable',
      skill: '',
      skillBonus: 0
    }
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
    type: 'trait-flaw',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
  },
  {
    type: 'trait-general',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
  },
  {
    type: 'trait-backstory',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
  },
  {
    type: 'trait-social',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
  },
  {
    type: 'trait-combat',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
  },
  {
    type: 'trait-magical',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
  },
  {
    type: 'trait-professional',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
  },
  {
    type: 'trait-technological',
    supertype: 'traits',
    groupKey: 'traits',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
  },
  {
    type: 'trait-genome',
    supertype: 'traits',
    groupKey: 'genomes',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
  },
  {
    type: 'trait-source-ability',
    supertype: 'traits',
    groupKey: 'sourceAbilities',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
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
    key: 'traits',
    types: [
      'trait-flaw',
      'trait-general',
      'trait-backstory',
      'trait-social',
      'trait-combat',
      'trait-magical',
      'trait-professional',
      'trait-technological'
    ],
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
  return Object.hasOwn(EQUIPMENT_SUBTYPE_FALLBACK_BY_TYPE, String(type ?? ''));
}

export function normalizeEquipmentSubtype(subtype, itemType = 'equipment') {
  const normalizedSubtype = String(subtype ?? '')
    .trim()
    .toLowerCase();
  if (Object.hasOwn(EQUIPMENT_SUBTYPE_CONFIGS, normalizedSubtype)) {
    return normalizedSubtype;
  }
  return EQUIPMENT_SUBTYPE_FALLBACK_BY_TYPE[String(itemType ?? '')] ?? 'gear';
}

export function getEquipmentSubtypeConfig(subtype, itemType = 'equipment') {
  const normalizedSubtype = normalizeEquipmentSubtype(subtype, itemType);
  return EQUIPMENT_SUBTYPE_CONFIGS[normalizedSubtype] ?? EQUIPMENT_SUBTYPE_CONFIGS.gear;
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
  const value = String(system.usageFrequency ?? '').trim();
  const labelKey = ITEM_USAGE_FREQUENCY_LABEL_KEYS[value];
  if (!labelKey) return [];
  const t = helpers.t;
  return [`${t.localize('MY_RPG.ItemFields.UsageFrequency')}: ${t.localize(labelKey)}`];
}

const USAGE_FREQUENCY_BADGE_GROUPS = ['genomes', 'sourceAbilities', 'traits'];

export const ITEM_BADGE_BUILDERS = {
  cartridges: (item, helpers) => {
    const system = item.system ?? {};
    const badges = [];
    const t = helpers.t;
    const rank = Number(system.rank) || 0;
    if (rank) {
      badges.push(`${t.localize('MY_RPG.AbilityConfig.Rank')}: ${helpers.getRankLabel(rank)}`);
    }
    badges.push(`${t.localize('MY_RPG.AbilityConfig.Skill')}: ${helpers.skillLabel(system.skill)}`);
    badges.push(
      `${t.localize('MY_RPG.AbilityConfig.SkillBonus')}: ${helpers.formatSkillBonus(system.skillBonus)}`
    );
    return badges;
  },
  implants: (item, helpers) => {
    const system = item.system ?? {};
    const badges = [];
    const t = helpers.t;
    const rank = Number(system.rank) || 0;
    if (rank) {
      badges.push(`${t.localize('MY_RPG.ModsTable.Rank')}: ${helpers.getRankLabel(rank)}`);
    }
    badges.push(`${t.localize('MY_RPG.ModsTable.Skill')}: ${helpers.skillLabel(system.skill)}`);
    badges.push(
      `${t.localize('MY_RPG.ModsTable.Bonus')}: ${helpers.formatSkillBonus(system.skillBonus)}`
    );
    return badges;
  },
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
    const rank = Number(item?.system?.rank) || 0;
    if (!rank) return [];
    return [`${helpers.t.localize('MY_RPG.ItemFields.Rank')}: ${helpers.getRankLabel(rank)}`];
  },
  equipmentConsumables: (item, helpers) => {
    const rank = Number(item?.system?.rank) || 0;
    if (!rank) return [];
    return [`${helpers.t.localize('MY_RPG.ItemFields.Rank')}: ${helpers.getRankLabel(rank)}`];
  },
  ...Object.fromEntries(
    USAGE_FREQUENCY_BADGE_GROUPS.map((groupKey) => [groupKey, buildUsageFrequencyBadge])
  )
};
