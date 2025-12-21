import { debugLog } from '../config.mjs';
import { normalizeAbilityDie } from '../helpers/utils.mjs';

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class ProjectAndromedaActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();
    if (this.type === 'character' || this.type === 'npc') this._prepareCharacterData();
  }

  _prepareCharacterData() {
    const s = this.system ?? (this.system = {});
    const cache = (s.cache ??= {});
    cache.itemTotals = this._computeItemTotals();
    const itemTotals = cache.itemTotals;
    const isCharacter = this.type === 'character';
    const isNpc = this.type === 'npc';

    /* 1. Способности ---------------------------------------------- */
    for (const a of Object.values(s.abilities ?? {})) {
      a.value = normalizeAbilityDie(a.value);
      a.mod = a.value; // «бонус» = само значение
    }

    /* 2. Навыки ---------------------------------------------------- */
    for (const sk of Object.values(s.skills ?? {})) {
      sk.mod = sk.value;
    }

    /* 3. Производные параметры ------------------------------------ */
    s.speed ??= {};
    s.speed.value = this._calcSpeed(s, itemTotals);

    const stress = s.stress ?? (s.stress = {});
    const calcStressMax = isNpc ? this._calcNpcStressMax : this._calcStressMax;
    stress.max = calcStressMax.call(this, s, itemTotals);
    const currentStress = Number(stress.value) || 0;
    stress.value = Math.clamp
      ? Math.clamp(currentStress, 0, stress.max)
      : Math.min(Math.max(currentStress, 0), stress.max);

    if (isCharacter) {
      const wounds = s.wounds ?? (s.wounds = {});
      wounds.minor = Boolean(wounds.minor);
      wounds.severe = Boolean(wounds.severe);
    } else if (isNpc && s.wounds !== undefined) {
      delete s.wounds;
    }

    s.flux ??= {};
    s.flux.value = this._calcFlux(s);
    s.defenses = {
      physical: this._calcDefPhys(s, itemTotals),
      azure: this._calcDefAzure(s, itemTotals),
      mental: this._calcDefMent(s, itemTotals)
    };

    // DEBUG-LOG
    debugLog('prepareDerivedData', {
      uuid: this.uuid,
      totals: foundry.utils.duplicate(itemTotals)
    });
  }

  /* ------------------------ Формулы ------------------------------ */
  _calcStressMax(s, itemTotals = {}) {
    const rank = Math.max(Number(s.currentRank) || 0, 0);
    const tempHealth = Math.max(Number(s.temphealth) || 0, 0);
    const shield = Number(itemTotals?.armor?.shield) || 0;
    const forceShield = Math.max(shield, 0);
    return Math.max(0, rank * 2 + 4 + tempHealth + forceShield);
  }

  _calcNpcStressMax(s, itemTotals = {}) {
    const rank = Math.max(Number(s.currentRank) || 0, 0);
    const tempHealth = Math.max(Number(s.temphealth) || 0, 0);
    const shield = Number(itemTotals?.armor?.shield) || 0;
    const forceShield = Math.max(shield, 0);
    return Math.max(0, rank * 2 + 4 + tempHealth + forceShield);
  }

  _calcFlux(s) {
    return (
      (Number(s.currentRank) || 0) * 5 +
      (Number(s.tempflux) || 0)
    );
  }

  _calcSpeed(s, itemTotals = {}) {
    const armorSpeed = Number(itemTotals?.armor?.speed) || 0;
    const rank = Math.max(Number(s.currentRank) || 0, 0);
    return (
      rank * 3 +
      3 +
      armorSpeed +
      (Number(s.tempspeed) || 0)
    );
  }

  _calcDefPhys(s, itemTotals = {}) {
    const phys = Number(itemTotals?.armor?.physical) || 0;
    return (
      this._getAbilityDefense(s.abilities?.con?.value) +
      phys +
      (Number(s.tempphys) || 0)
    );
  }
  _calcDefAzure(s, itemTotals = {}) {
    const azure = Number(itemTotals?.armor?.azure) || 0;
    return (
      this._getAbilityDefense(s.abilities?.spi?.value) +
      azure +
      (Number(s.tempazure) || 0)
    );
  }
  _calcDefMent(s, itemTotals = {}) {
    const mental = Number(itemTotals?.armor?.mental) || 0;
    return (
      this._getAbilityDefense(s.abilities?.int?.value) +
      mental +
      (Number(s.tempmental) || 0)
    );
  }

  _getAbilityDefense(abilityValue) {
    const defensesByDie = {
      4: 2,
      6: 3,
      8: 4,
      10: 6,
      12: 8
    };

    const dieValue = normalizeAbilityDie(abilityValue);
    return defensesByDie[dieValue] ?? 0;
  }

  _computeItemTotals() {
    const totals = {
      armor: {
        physical: 0,
        azure: 0,
        mental: 0,
        shield: 0,
        speed: 0
      },
      skillBonuses: {}
    };

    const ensureSkillBonusEntry = (skillKey) => {
      const existing = totals.skillBonuses[skillKey];
      if (existing && typeof existing === 'object') return existing;
      const entry = { total: 0, sources: [] };
      totals.skillBonuses[skillKey] = entry;
      return entry;
    };

    const addSkillBonus = (skill, bonus, source) => {
      const skillKey = String(skill || '');
      const numericBonus = Number(bonus) || 0;
      if (!skillKey || !numericBonus) return;
      const entry = ensureSkillBonusEntry(skillKey);
      entry.total += numericBonus;
      if (source) {
        entry.sources.push({
          type: source.type,
          name: source.name,
          quantity: source.quantity,
          bonus: numericBonus
        });
      }
    };

    const itemName = (item, type) => item?.name || game.i18n.localize(`TYPES.Item.${type}`);

    const armorItems = this.itemTypes?.armor ?? [];
    for (const armor of armorItems) {
      const system = armor.system ?? {};
      if (!system.equipped) continue;
      const quantity = Math.max(Number(system.quantity) || 1, 0);
      totals.armor.physical += (Number(system.itemPhys) || 0) * quantity;
      totals.armor.azure += (Number(system.itemAzure) || 0) * quantity;
      totals.armor.mental += (Number(system.itemMental) || 0) * quantity;
      totals.armor.shield += (Number(system.itemShield) || 0) * quantity;
      totals.armor.speed += (Number(system.itemSpeed) || 0) * quantity;
    }

    const weaponItems = this.itemTypes?.weapon ?? [];
    for (const weapon of weaponItems) {
      const system = weapon.system ?? {};
      if (!system.equipped) continue;
      const skill = String(system.skill || '');
      if (!skill) continue;
      const quantity = Math.max(Number(system.quantity) || 1, 0);
      const bonus = (Number(system.skillBonus) || 0) * quantity;
      if (!bonus) continue;
      addSkillBonus(skill, bonus, {
        type: 'weapon',
        name: itemName(weapon, 'weapon'),
        quantity
      });
    }

    const cartridgeItems = this.itemTypes?.cartridge ?? [];
    for (const cartridge of cartridgeItems) {
      const system = cartridge.system ?? {};
      if (system.equipped === false) continue;
      const skill = String(system.skill || '');
      if (!skill) continue;
      const bonus = Number(system.skillBonus) || 0;
      if (!bonus) continue;
      addSkillBonus(skill, bonus, {
        type: 'cartridge',
        name: itemName(cartridge, 'cartridge'),
        quantity: 1
      });
    }

    const implantItems = this.itemTypes?.implant ?? [];
    for (const implant of implantItems) {
      const system = implant.system ?? {};
      if (system.equipped === false) continue;
      const skill = String(system.skill || '');
      if (!skill) continue;
      const bonus = Number(system.skillBonus) || 0;
      if (!bonus) continue;
      addSkillBonus(skill, bonus, {
        type: 'implant',
        name: itemName(implant, 'implant'),
        quantity: 1
      });
    }

    return totals;
  }
}
