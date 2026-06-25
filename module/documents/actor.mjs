import { debugLog } from '../config.mjs';
import {
  isEliteActorType,
  isGmCharacterActorType,
  isSupportedCharacterActorType,
  supportsAzureStress
} from '../helpers/actor-types.mjs';
import { getTotalAdvancementSpent } from '../helpers/advancement-points.mjs';
import { calcMovementSpeed } from '../helpers/movement-speed.mjs';
import { normalizeSkill } from '../helpers/skill-check.mjs';

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class ProjectAndromedaActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();
    if (isSupportedCharacterActorType(this.type)) {
      this._prepareCharacterData();
    }
  }

  _prepareCharacterData() {
    const s = this.system ?? (this.system = {});
    const cache = (s.cache ??= {});
    cache.itemTotals = this._computeItemTotals();
    const itemTotals = cache.itemTotals;
    const isGmCharacter = isGmCharacterActorType(this.type);
    const usesAzureStress = supportsAzureStress(this.type);

    /* 1. Skills ---------------------------------------------------------- */
    for (const sk of Object.values(s.skills ?? {})) {
      const normalized = normalizeSkill(sk, s.currentRank);
      sk.rank = normalized.rank;
      sk.value = normalized.value;
      sk.mod = normalized.value;
    }

    /* 2. Derived values -------------------------------------------------- */
    s.speed ??= {};
    s.speed.value = this._calcSpeed(s, itemTotals);
    s.advancement ??= {};
    s.advancement.totalSpent = getTotalAdvancementSpent(s);
    s.advancement.available = (Number(s.progressPoints) || 0) - s.advancement.totalSpent;

    const stress = s.stress ?? (s.stress = {});
    const forceShield = s.forceShield ?? (s.forceShield = {});
    const calcStressMax = isEliteActorType(this.type)
      ? this._calcEliteStressMax
      : isGmCharacter
        ? this._calcGmStressMax
        : this._calcStressMax;
    const calcForceShieldMax = isGmCharacter
      ? this._calcGmForceShieldMax
      : this._calcForceShieldMax;
    stress.max = calcStressMax.call(this, s);
    forceShield.max = calcForceShieldMax.call(this, s, itemTotals);
    const clamp = Math.clamp
      ? (value, min, max) => Math.clamp(value, min, max)
      : (value, min, max) => Math.min(Math.max(value, min), max);
    const legacyCombinedStress = Number(stress.value) || 0;
    const storedForceShield = Number(forceShield.value);
    const hasStoredForceShield = Number.isFinite(storedForceShield);
    const inferredShieldFromOverflow = Math.max(legacyCombinedStress - stress.max, 0);
    const useInferredShield =
      inferredShieldFromOverflow > 0 && (!hasStoredForceShield || storedForceShield <= 0);
    const currentStress = useInferredShield ? stress.max : legacyCombinedStress;
    const currentForceShield = useInferredShield
      ? inferredShieldFromOverflow
      : hasStoredForceShield
        ? storedForceShield
        : 0;
    stress.value = clamp(currentStress, 0, stress.max);
    forceShield.value = clamp(currentForceShield, 0, forceShield.max);
    const marked = Array.isArray(stress.marked) ? stress.marked : [];
    stress.marked = usesAzureStress
      ? [...new Set(marked)]
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value >= 0 && value < stress.max)
      : [];

    s.flux ??= {};
    s.flux.value = this._calcFlux(s);
    // DEBUG-LOG
    debugLog('prepareDerivedData', {
      uuid: this.uuid,
      totals: foundry.utils.duplicate(itemTotals)
    });
  }

  /* ------------------------ Формулы ------------------------------ */
  _calcStressMax(s) {
    const rank = Math.max(Number(s.currentRank) || 0, 0);
    const tempStress = Math.max(Number(s?.temphealth) || 0, 0);
    return Math.max(0, rank * 6 + tempStress);
  }

  _calcGmStressMax(s) {
    const rank = Math.max(Number(s.currentRank) || 0, 0);
    const tempStress = Math.max(Number(s?.temphealth) || 0, 0);
    return Math.max(0, rank * 6 + tempStress);
  }

  _calcEliteStressMax(s) {
    const rank = Math.max(Number(s.currentRank) || 0, 0);
    const tempStress = Math.max(Number(s?.temphealth) || 0, 0);
    return Math.max(0, rank * 10 + tempStress);
  }

  _calcForceShieldMax(_s, itemTotals = {}) {
    const shield = Number(itemTotals?.armor?.shield) || 0;
    return Math.max(shield, 0);
  }

  _calcGmForceShieldMax(_s, itemTotals = {}) {
    const shield = Number(itemTotals?.armor?.shield) || 0;
    return Math.max(shield, 0);
  }

  _calcFlux(s) {
    return (Number(s.currentRank) || 0) * 5 + (Number(s.tempflux) || 0);
  }

  _calcSpeed(s, itemTotals = {}) {
    return calcMovementSpeed(s, itemTotals);
  }

  _computeItemTotals() {
    const totals = {
      armor: {
        physical: 0,
        azure: 0,
        mental: 0,
        shield: 0,
        speed: 0
      }
    };

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

    return totals;
  }
}
