import { debugLog } from '../config.mjs';
import {
  isSupportedCharacterActorType,
  normalizeActorType,
  supportsAzureStress
} from '../helpers/actor-types.mjs';
import { getBaseStressByRank } from '../config/character-defaults.mjs';
import { getTotalAdvancementSpent } from '../helpers/advancement-points.mjs';
import { calcMovementSpeed } from '../helpers/movement-speed.mjs';
import { ARCHETYPE_RANK_BONUS, normalizeSkill } from '../helpers/skill-check.mjs';
import {
  computeArchetypeDefenses,
  getArchetypeDefenseProfile,
  getArchetypeSkillKey
} from '../helpers/archetype.mjs';

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
    const usesAzureStress = supportsAzureStress(this.type);

    /* 1. Skills ---------------------------------------------------------- */
    const archetypeSkillKey = getArchetypeSkillKey(this);
    for (const [key, sk] of Object.entries(s.skills ?? {})) {
      const rankBonus = key === archetypeSkillKey ? ARCHETYPE_RANK_BONUS : 0;
      const normalized = normalizeSkill(sk, s.currentRank, rankBonus);
      sk.rank = normalized.rank;
      sk.value = normalized.value;
      sk.mod = normalized.value;
    }

    /* 2. Derived values -------------------------------------------------- */
    s.speed ??= {};
    s.speed.value = this._calcSpeed(s, itemTotals);
    const baseDefenses = this._resolveBaseDefenses(s);
    s.defenses = { ...(s.defenses ?? {}), ...baseDefenses };
    s.defensesLocked = getArchetypeDefenseProfile(this) !== null;
    s.effectiveDefenses = this._calcEffectiveDefenses(s, baseDefenses);
    s.advancement ??= {};
    s.advancement.totalSpent = getTotalAdvancementSpent(s, { archetypeSkillKey });
    s.advancement.available = (Number(s.progressPoints) || 0) - s.advancement.totalSpent;

    const stress = s.stress ?? (s.stress = {});
    const forceShield = s.forceShield ?? (s.forceShield = {});
    stress.max = this._calcStressMax(s, itemTotals);
    forceShield.max = 0;
    const clamp = Math.clamp
      ? (value, min, max) => Math.clamp(value, min, max)
      : (value, min, max) => Math.min(Math.max(value, min), max);
    const legacyCombinedStress = Number(stress.value) || 0;
    const storedForceShield = Number(forceShield.value);
    const hasStoredForceShield = Number.isFinite(storedForceShield);
    const currentStress = legacyCombinedStress;
    const currentForceShield = hasStoredForceShield ? storedForceShield : 0;
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
  _calcStressMax(s, itemTotals = {}) {
    const actorType = normalizeActorType(this.type);
    const rank = Math.max(Number(s.currentRank) || 0, 0);
    const tempStress = Number(s?.temphealth) || 0;
    const shield = Math.max(Number(itemTotals?.armor?.shield) || 0, 0);
    return Math.max(0, getBaseStressByRank(actorType, rank) + tempStress + shield);
  }

  // Base defenses come from the archetype profile (rank-scaled, locked) for player
  // characters that have one; otherwise they are the manually edited stored values.
  _resolveBaseDefenses(s) {
    const profile = getArchetypeDefenseProfile(this);
    if (profile) {
      return computeArchetypeDefenses(s?.currentRank, profile);
    }
    const defenses = s?.defenses ?? {};
    return {
      fortitude: Number(defenses.fortitude) || 0,
      control: Number(defenses.control) || 0,
      will: Number(defenses.will) || 0
    };
  }

  _calcEffectiveDefenses(s, baseDefenses = this._resolveBaseDefenses(s)) {
    return {
      fortitude: Math.max(
        0,
        (Number(baseDefenses.fortitude) || 0) + (Number(s?.tempfortitude) || 0)
      ),
      control: Math.max(0, (Number(baseDefenses.control) || 0) + (Number(s?.tempcontrol) || 0)),
      will: Math.max(0, (Number(baseDefenses.will) || 0) + (Number(s?.tempwill) || 0))
    };
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
        fortitude: 0,
        control: 0,
        will: 0,
        shield: 0,
        speed: 0
      }
    };

    const armorItems = this.itemTypes?.armor ?? [];
    for (const armor of armorItems) {
      const system = armor.system ?? {};
      if (!system.equipped) continue;
      const quantity = Math.max(Number(system.quantity) || 1, 0);
      totals.armor.fortitude += (Number(system.itemFortitude) || 0) * quantity;
      totals.armor.control += (Number(system.itemControl) || 0) * quantity;
      totals.armor.will += (Number(system.itemWill) || 0) * quantity;
      totals.armor.shield += (Number(system.itemShield) || 0) * quantity;
      totals.armor.speed += (Number(system.itemSpeed) || 0) * quantity;
    }

    return totals;
  }
}
