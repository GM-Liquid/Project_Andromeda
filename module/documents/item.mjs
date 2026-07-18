import { debugLog } from '../config.mjs';
import { ITEM_BASE_DEFAULTS, getItemTypeDefaults } from '../helpers/item-config.mjs';

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
