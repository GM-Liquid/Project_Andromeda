import { debugLog } from '../config.mjs';
import { ITEM_BASE_DEFAULTS, getItemTypeConfig, getItemTypeDefaults } from '../helpers/item-config.mjs';

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
    foundry.utils.mergeObject(systemData, cloneDefaults(ITEM_BASE_DEFAULTS), {
      insertKeys: true,
      overwrite: false,
      inplace: true
    });

    const typeDefaults = getItemTypeDefaults(this.type);
    if (!typeDefaults) return;
    foundry.utils.mergeObject(systemData, cloneDefaults(typeDefaults), {
      insertKeys: true,
      overwrite: false,
      inplace: true
    });

    if (this.type === 'weapon') {
      delete systemData.equipped;
    }
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

  get supertype() {
    return getItemTypeConfig(this.type)?.supertype ?? 'equipment';
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
