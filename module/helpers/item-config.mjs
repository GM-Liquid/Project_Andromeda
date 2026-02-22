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

export const ITEM_TYPE_CONFIGS = [
  {
    type: 'cartridge',
    supertype: 'equipment',
    groupKey: 'cartridges',
    sheet: 'cartridge',
    defaults: {
      runeType: 'Spell',
      skill: '',
      skillBonus: 0
    }
  },
  {
    type: 'implant',
    supertype: 'equipment',
    groupKey: 'implants',
    sheet: 'implant',
    defaults: {
      skill: '',
      skillBonus: 0
    }
  },
  {
    type: 'weapon',
    supertype: 'equipment',
    groupKey: 'weapons',
    sheet: 'weapon',
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
      quantity: 1
    },
    fields: [
      {
        path: 'quantity',
        labelKey: 'MY_RPG.ItemFields.Quantity',
        type: 'number',
        min: 0
      },
      {
        path: 'rank',
        labelKey: 'MY_RPG.ItemFields.Rank',
        type: 'rank'
      }
    ]
  },
  {
    type: 'equipment-consumable',
    supertype: 'equipment',
    groupKey: 'equipmentConsumables',
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
      },
      {
        path: 'rank',
        labelKey: 'MY_RPG.ItemFields.Rank',
        type: 'rank'
      }
    ]
  },
  {
    type: 'environment-consumable',
    supertype: 'environment',
    groupKey: 'environmentConsumables',
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
    groupKey: 'environmentInteractive',
    sheet: 'generic'
  },
  {
    type: 'environment-narrative',
    supertype: 'environment',
    groupKey: 'environmentNarrative',
    sheet: 'generic'
  },
  {
    type: 'environment-resource',
    supertype: 'environment',
    groupKey: 'environmentResources',
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
    groupKey: 'environmentTriggers',
    sheet: 'generic'
  },
  {
    type: 'environment-danger',
    supertype: 'environment',
    groupKey: 'environmentDanger',
    sheet: 'generic'
  },
  {
    type: 'trait-flaw',
    supertype: 'traits',
    groupKey: 'traitFlaws',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
  },
  {
    type: 'trait-general',
    supertype: 'traits',
    groupKey: 'traitGeneral',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
  },
  {
    type: 'trait-backstory',
    supertype: 'traits',
    groupKey: 'traitBackstory',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
  },
  {
    type: 'trait-social',
    supertype: 'traits',
    groupKey: 'traitSocial',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
  },
  {
    type: 'trait-combat',
    supertype: 'traits',
    groupKey: 'traitCombat',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
  },
  {
    type: 'trait-magical',
    supertype: 'traits',
    groupKey: 'traitMagical',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
  },
  {
    type: 'trait-professional',
    supertype: 'traits',
    groupKey: 'traitProfessional',
    sheet: 'generic',
    fields: [buildUsageFrequencyField()]
  },
  {
    type: 'trait-technological',
    supertype: 'traits',
    groupKey: 'traitTechnological',
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
    key: 'implants',
    types: ['implant'],
    tab: 'inventory',
    icon: 'fas fa-cogs',
    labelKey: 'MY_RPG.ItemGroups.Implants',
    emptyKey: 'MY_RPG.ItemGroups.EmptyImplants',
    createKey: 'MY_RPG.ItemGroups.CreateImplant',
    newNameKey: 'MY_RPG.ItemGroups.NewImplant',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: true
  },
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
    key: 'equipmentConsumables',
    types: ['equipment-consumable'],
    tab: 'inventory',
    icon: 'fas fa-flask',
    labelKey: 'MY_RPG.ItemGroups.EquipmentConsumables',
    emptyKey: 'MY_RPG.ItemGroups.EmptyEquipmentConsumables',
    createKey: 'MY_RPG.ItemGroups.CreateEquipmentConsumable',
    newNameKey: 'MY_RPG.ItemGroups.NewEquipmentConsumable',
    showQuantity: true,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  {
    key: 'equipment',
    types: ['equipment'],
    tab: 'inventory',
    icon: 'fas fa-toolbox',
    labelKey: 'MY_RPG.ItemGroups.Equipment',
    emptyKey: 'MY_RPG.ItemGroups.EmptyEquipment',
    createKey: 'MY_RPG.ItemGroups.CreateEquipment',
    newNameKey: 'MY_RPG.ItemGroups.NewEquipment',
    showQuantity: true,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  {
    key: 'environmentConsumables',
    types: ['environment-consumable'],
    tab: 'environment',
    icon: 'fas fa-flask',
    labelKey: 'MY_RPG.ItemGroups.EnvironmentConsumables',
    emptyKey: 'MY_RPG.ItemGroups.EmptyEnvironmentConsumables',
    createKey: 'MY_RPG.ItemGroups.CreateEnvironmentConsumable',
    newNameKey: 'MY_RPG.ItemGroups.NewEnvironmentConsumable',
    showQuantity: true,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  {
    key: 'environmentInteractive',
    types: ['environment-interactive'],
    tab: 'environment',
    icon: 'fas fa-hand-pointer',
    labelKey: 'MY_RPG.ItemGroups.EnvironmentInteractive',
    emptyKey: 'MY_RPG.ItemGroups.EmptyEnvironmentInteractive',
    createKey: 'MY_RPG.ItemGroups.CreateEnvironmentInteractive',
    newNameKey: 'MY_RPG.ItemGroups.NewEnvironmentInteractive',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  {
    key: 'environmentNarrative',
    types: ['environment-narrative'],
    tab: 'environment',
    icon: 'fas fa-book',
    labelKey: 'MY_RPG.ItemGroups.EnvironmentNarrative',
    emptyKey: 'MY_RPG.ItemGroups.EmptyEnvironmentNarrative',
    createKey: 'MY_RPG.ItemGroups.CreateEnvironmentNarrative',
    newNameKey: 'MY_RPG.ItemGroups.NewEnvironmentNarrative',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  {
    key: 'environmentResources',
    types: ['environment-resource'],
    tab: 'environment',
    icon: 'fas fa-leaf',
    labelKey: 'MY_RPG.ItemGroups.EnvironmentResources',
    emptyKey: 'MY_RPG.ItemGroups.EmptyEnvironmentResources',
    createKey: 'MY_RPG.ItemGroups.CreateEnvironmentResource',
    newNameKey: 'MY_RPG.ItemGroups.NewEnvironmentResource',
    showQuantity: true,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  {
    key: 'environmentTriggers',
    types: ['environment-trigger'],
    tab: 'environment',
    icon: 'fas fa-bell',
    labelKey: 'MY_RPG.ItemGroups.EnvironmentTriggers',
    emptyKey: 'MY_RPG.ItemGroups.EmptyEnvironmentTriggers',
    createKey: 'MY_RPG.ItemGroups.CreateEnvironmentTrigger',
    newNameKey: 'MY_RPG.ItemGroups.NewEnvironmentTrigger',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  {
    key: 'environmentDanger',
    types: ['environment-danger'],
    tab: 'environment',
    icon: 'fas fa-skull',
    labelKey: 'MY_RPG.ItemGroups.EnvironmentDanger',
    emptyKey: 'MY_RPG.ItemGroups.EmptyEnvironmentDanger',
    createKey: 'MY_RPG.ItemGroups.CreateEnvironmentDanger',
    newNameKey: 'MY_RPG.ItemGroups.NewEnvironmentDanger',
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
  },
  {
    key: 'traitFlaws',
    types: ['trait-flaw'],
    tab: 'traits',
    icon: 'fas fa-exclamation-triangle',
    labelKey: 'MY_RPG.ItemGroups.TraitFlaws',
    emptyKey: 'MY_RPG.ItemGroups.EmptyTraitFlaws',
    createKey: 'MY_RPG.ItemGroups.CreateTraitFlaw',
    newNameKey: 'MY_RPG.ItemGroups.NewTraitFlaw',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  {
    key: 'traitGeneral',
    types: ['trait-general'],
    tab: 'traits',
    icon: 'fas fa-feather',
    labelKey: 'MY_RPG.ItemGroups.TraitGeneral',
    emptyKey: 'MY_RPG.ItemGroups.EmptyTraitGeneral',
    createKey: 'MY_RPG.ItemGroups.CreateTraitGeneral',
    newNameKey: 'MY_RPG.ItemGroups.NewTraitGeneral',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  {
    key: 'traitBackstory',
    types: ['trait-backstory'],
    tab: 'traits',
    icon: 'fas fa-scroll',
    labelKey: 'MY_RPG.ItemGroups.TraitBackstory',
    emptyKey: 'MY_RPG.ItemGroups.EmptyTraitBackstory',
    createKey: 'MY_RPG.ItemGroups.CreateTraitBackstory',
    newNameKey: 'MY_RPG.ItemGroups.NewTraitBackstory',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  {
    key: 'traitSocial',
    types: ['trait-social'],
    tab: 'traits',
    icon: 'fas fa-users',
    labelKey: 'MY_RPG.ItemGroups.TraitSocial',
    emptyKey: 'MY_RPG.ItemGroups.EmptyTraitSocial',
    createKey: 'MY_RPG.ItemGroups.CreateTraitSocial',
    newNameKey: 'MY_RPG.ItemGroups.NewTraitSocial',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  {
    key: 'traitCombat',
    types: ['trait-combat'],
    tab: 'traits',
    icon: 'fas fa-fist-raised',
    labelKey: 'MY_RPG.ItemGroups.TraitCombat',
    emptyKey: 'MY_RPG.ItemGroups.EmptyTraitCombat',
    createKey: 'MY_RPG.ItemGroups.CreateTraitCombat',
    newNameKey: 'MY_RPG.ItemGroups.NewTraitCombat',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  {
    key: 'traitMagical',
    types: ['trait-magical'],
    tab: 'traits',
    icon: 'fas fa-hat-wizard',
    labelKey: 'MY_RPG.ItemGroups.TraitMagical',
    emptyKey: 'MY_RPG.ItemGroups.EmptyTraitMagical',
    createKey: 'MY_RPG.ItemGroups.CreateTraitMagical',
    newNameKey: 'MY_RPG.ItemGroups.NewTraitMagical',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  {
    key: 'traitProfessional',
    types: ['trait-professional'],
    tab: 'traits',
    icon: 'fas fa-briefcase',
    labelKey: 'MY_RPG.ItemGroups.TraitProfessional',
    emptyKey: 'MY_RPG.ItemGroups.EmptyTraitProfessional',
    createKey: 'MY_RPG.ItemGroups.CreateTraitProfessional',
    newNameKey: 'MY_RPG.ItemGroups.NewTraitProfessional',
    showQuantity: false,
    allowEquip: false,
    exclusive: false,
    canRoll: false
  },
  {
    key: 'traitTechnological',
    types: ['trait-technological'],
    tab: 'traits',
    icon: 'fas fa-microchip',
    labelKey: 'MY_RPG.ItemGroups.TraitTechnological',
    emptyKey: 'MY_RPG.ItemGroups.EmptyTraitTechnological',
    createKey: 'MY_RPG.ItemGroups.CreateTraitTechnological',
    newNameKey: 'MY_RPG.ItemGroups.NewTraitTechnological',
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

const USAGE_FREQUENCY_BADGE_GROUPS = [
  'genomes',
  'sourceAbilities',
  'traits',
  'traitFlaws',
  'traitGeneral',
  'traitBackstory',
  'traitSocial',
  'traitCombat',
  'traitMagical',
  'traitProfessional',
  'traitTechnological'
];

export const ITEM_BADGE_BUILDERS = {
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
  ...Object.fromEntries(
    USAGE_FREQUENCY_BADGE_GROUPS.map((groupKey) => [groupKey, buildUsageFrequencyBadge])
  )
};
