import { debugLog } from '../config.mjs';

const BASE_DEFAULTS = {
  description: '',
  rank: '',
  equipped: false
};

const TYPE_DEFAULTS = {
  cartridge: {
    rank: '',
    runeType: 'Spell',
    skill: '',
    skillBonus: 0
  },
  implant: {
    rank: '',
    skill: '',
    skillBonus: 0
  },
  armor: {
    quantity: 1,
    rank: '',
    itemPhys: 0,
    itemAzure: 0,
    itemMental: 0,
    itemShield: 0,
    itemSpeed: 0
  },
  weapon: {
    quantity: 1,
    rank: '',
    skill: '',
    skillBonus: 0
  },
  gear: {
    quantity: 1,
    rank: ''
  }
};

function cloneDefaults(data) {
  return foundry.utils.deepClone(data);
}

export class ProjectAndromedaItem extends Item {
  prepareBaseData() {
    super.prepareBaseData();
    this._applyTypeDefaults();
  }

  _applyTypeDefaults() {
    const systemData = this.system ?? (this.system = {});
    foundry.utils.mergeObject(systemData, cloneDefaults(BASE_DEFAULTS), {
      insertKeys: true,
      overwrite: false,
      inplace: true
    });

    const typeDefaults = TYPE_DEFAULTS[this.type];
    if (!typeDefaults) return;
    foundry.utils.mergeObject(systemData, cloneDefaults(typeDefaults), {
      insertKeys: true,
      overwrite: false,
      inplace: true
    });
  }

  get isCartridge() {
    return this.type === 'cartridge';
  }

  get isImplant() {
    return this.type === 'implant';
  }

  get isArmor() {
    return this.type === 'armor';
  }

  get isWeapon() {
    return this.type === 'weapon';
  }

  get isGear() {
    return this.type === 'gear';
  }

  get description() {
    return String(this.system.description ?? '');
  }

  get quantity() {
    return Number(this.system.quantity ?? 1);
  }

  get cartridgeData() {
    if (!this.isCartridge) return undefined;
    const { rank = '', runeType = 'Spell', skill = '', skillBonus = 0 } = this.system;
    return {
      rank: String(rank ?? ''),
      runeType: String(runeType ?? 'Spell'),
      skill: String(skill ?? ''),
      skillBonus: Number(skillBonus ?? 0) || 0
    };
  }

  get implantData() {
    if (!this.isImplant) return undefined;
    const { rank = '', skill = '', skillBonus = 0 } = this.system;
    return {
      rank: String(rank ?? ''),
      skill: String(skill ?? ''),
      skillBonus: Number(skillBonus ?? 0) || 0
    };
  }

  logDebugState(context = 'ProjectAndromedaItem state') {
    // DEBUG-LOG
    debugLog(context, {
      id: this.id,
      name: this.name,
      type: this.type,
      system: foundry.utils.duplicate(this.system ?? {})
    });
  }
}
