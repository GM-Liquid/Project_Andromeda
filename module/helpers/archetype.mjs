import { MODULE_ID } from '../config.mjs';
import { isPlayerCharacterActorType } from './actor-types.mjs';
import { ARCHETYPE_RANK_BONUS, MIN_SKILL_RANK, normalizeCharacterRank } from './skill-check.mjs';

// The archetype is a single Item dropped onto a player character. While present it
// supplies the archetype skill (free rank-2 start, +1 rank cap) and the defense
// profile, which makes the three defenses derived (and locked) instead of bought.
export const ARCHETYPE_ITEM_TYPE = 'archetype';
export const DEFENSE_KEYS = ['fortitude', 'control', 'will'];

// Flag set on the ability item an archetype grants on drop, so replacing the
// archetype can clean up the previously granted ability.
export const ARCHETYPE_GRANT_FLAG = 'grantedByArchetype';

// Delete-option flag set when an archetype is removed as part of a drop-replace, so
// the deleteItem hook skips its own cleanup (the drop flow handles it inline).
export const ARCHETYPE_SWAP_OPTION = 'projectAndromedaArchetypeSwap';

export function normalizeDefenseKey(value) {
  const key = String(value ?? '').trim();
  return DEFENSE_KEYS.includes(key) ? key : '';
}

export function normalizeDefenseProfile(profile = {}) {
  return {
    strong: normalizeDefenseKey(profile?.strong),
    medium: normalizeDefenseKey(profile?.medium),
    weak: normalizeDefenseKey(profile?.weak)
  };
}

// A defense profile is usable only when it assigns each of the three defenses
// exactly once (strong / medium / weak).
export function isCompleteDefenseProfile(profile = {}) {
  const normalized = normalizeDefenseProfile(profile);
  const assigned = [normalized.strong, normalized.medium, normalized.weak].filter(Boolean);
  return new Set(assigned).size === DEFENSE_KEYS.length;
}

// Strong = rank + 1, medium = rank, weak = rank - 1 (never below 0).
export function computeArchetypeDefenses(characterRank, profile = {}) {
  const rank = normalizeCharacterRank(characterRank);
  const normalized = normalizeDefenseProfile(profile);
  const defenses = { fortitude: rank, control: rank, will: rank };
  if (normalized.strong) defenses[normalized.strong] = rank + 1;
  if (normalized.medium) defenses[normalized.medium] = rank;
  if (normalized.weak) defenses[normalized.weak] = Math.max(0, rank - 1);
  return defenses;
}

export function getActorArchetypeItem(actor) {
  if (!actor || !isPlayerCharacterActorType(actor.type)) return null;
  const items = actor.itemTypes?.[ARCHETYPE_ITEM_TYPE] ?? [];
  return items[0] ?? null;
}

export function getArchetypeSkillKey(actor) {
  const archetype = getActorArchetypeItem(actor);
  return String(archetype?.system?.skill ?? '').trim();
}

export function getArchetypeDefenseProfile(actor) {
  const archetype = getActorArchetypeItem(actor);
  if (!archetype) return null;
  const profile = normalizeDefenseProfile(archetype.system?.defenseProfile);
  return isCompleteDefenseProfile(profile) ? profile : null;
}

// Defenses are locked (derived from rank + archetype) only when a player character
// has an archetype with a complete defense profile.
export function actorHasLockedDefenses(actor) {
  return getArchetypeDefenseProfile(actor) !== null;
}

export function getSkillRankBonus(actor, skillKey) {
  const archetypeSkill = getArchetypeSkillKey(actor);
  return archetypeSkill && archetypeSkill === skillKey ? ARCHETYPE_RANK_BONUS : 0;
}

// Revert everything an archetype granted: remove the ability it added, take back the
// +1 rank it gave its skill (preserving any rank the player bought on top), and reset
// the three defenses to the rank default (defense = rank). Used both when an archetype
// is deleted and when it is replaced.
export async function clearArchetypeEffects(actor, archetypeItem) {
  if (!actor || !archetypeItem) return;

  const abilityIds = actor.items
    .filter((item) => item.getFlag?.(MODULE_ID, ARCHETYPE_GRANT_FLAG) === archetypeItem.id)
    .map((item) => item.id);
  if (abilityIds.length) {
    await actor.deleteEmbeddedDocuments('Item', abilityIds);
  }

  const updates = {};
  const skillKey = String(archetypeItem.system?.skill ?? '').trim();
  if (skillKey && actor.system?.skills?.[skillKey]) {
    // Read the stored (source) rank so a skill sitting at the archetype-only cap
    // (rank 5) is not first clamped to the base cap before the bonus is removed.
    const storedRank = Number(actor._source?.system?.skills?.[skillKey]?.rank);
    const baseRank = Number.isFinite(storedRank)
      ? storedRank
      : Number(actor.system.skills[skillKey].rank) || MIN_SKILL_RANK;
    updates[`system.skills.${skillKey}.rank`] = Math.max(
      MIN_SKILL_RANK,
      baseRank - ARCHETYPE_RANK_BONUS
    );
  }
  const rank = normalizeCharacterRank(actor.system?.currentRank);
  updates['system.defenses.fortitude'] = rank;
  updates['system.defenses.control'] = rank;
  updates['system.defenses.will'] = rank;
  await actor.update(updates, { render: false });
}

export { ARCHETYPE_RANK_BONUS, MIN_SKILL_RANK };
