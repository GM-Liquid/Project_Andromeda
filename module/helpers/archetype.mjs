import { MODULE_ID } from '../config.mjs';
import { isPlayerCharacterActorType } from './actor-types.mjs';
import { deepClone } from './object-utils.mjs';
import { ARCHETYPE_RANK_BONUS, MIN_SKILL_RANK, normalizeCharacterRank } from './skill-check.mjs';

// The archetype is a single Item dropped onto a player character. While present it
// supplies the archetype skill (free rank-2 start, +1 rank cap) and the defense
// profile, which makes the three defenses derived (and locked) instead of bought.
export const ARCHETYPE_ITEM_TYPE = 'archetype';
export const DEFENSE_KEYS = ['fortitude', 'control', 'will'];

// Flag set on the ability and trait an archetype grants on drop, so replacing the
// archetype can clean up both linked items without relying on their mutable names.
export const ARCHETYPE_GRANT_FLAG = 'grantedByArchetype';
const LIBRARY_ITEM_UUID_FLAG = 'libraryItemUuid';

// Delete-option flag set when an archetype is removed as part of a drop-replace, so
// the deleteItem hook skips its own cleanup (the drop flow handles it inline).
export const ARCHETYPE_SWAP_OPTION = 'projectAndromedaArchetypeSwap';
export const ARCHETYPE_RANK_SYNC_OPTION = 'projectAndromedaArchetypeRankSync';

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

export function getArchetypeStressBonus(actor) {
  const archetype = getActorArchetypeItem(actor);
  const perRank = Math.max(0, Number(archetype?.system?.stressBonusPerRank) || 0);
  const rank = normalizeCharacterRank(actor?.system?.currentRank);
  return perRank * rank;
}

export function getArchetypeAbilityDisplayName(actor, archetype) {
  const archetypeId = String(archetype?.id ?? archetype?._id ?? '').trim();
  if (archetypeId) {
    const grantedAbility = (actor?.items ?? []).find(
      (item) =>
        item.getFlag?.(MODULE_ID, ARCHETYPE_GRANT_FLAG) === archetypeId &&
        Boolean(item.system?.details?.archetypeAbility)
    );
    const grantedName = String(grantedAbility?.name ?? '').trim();
    if (grantedName) return grantedName;
  }
  return String(archetype?.system?.abilityName ?? '').trim();
}

export function selectArchetypeAbilityVersion(versions, characterRank) {
  const normalizedVersions = (Array.isArray(versions) ? versions : [])
    .filter((version) => version && Number.isFinite(Number(version.rank)))
    .sort((left, right) => Number(left.rank) - Number(right.rank));
  if (!normalizedVersions.length) return null;
  const rank = normalizeCharacterRank(characterRank);
  return (
    [...normalizedVersions].reverse().find((version) => Number(version.rank) <= rank) ??
    normalizedVersions[0]
  );
}

function formatArchetypeAbilityRange(range) {
  if (!range || typeof range !== 'object') return '';
  const type = String(range.type ?? '').trim();
  if (type === 'melee' || type === 'self') return type;
  const value = Number(range.value);
  return type === 'meters' && Number.isFinite(value) ? `${value} m` : type;
}

export function buildArchetypeAbilityVersionSystemData(ability, characterRank) {
  const version = selectArchetypeAbilityVersion(ability?.versions, characterRank);
  if (!version) return null;
  const activation = String(ability?.activation ?? 'action').trim() || 'action';
  return {
    name: String(version.name ?? ability?.name ?? '').trim(),
    system: {
      description: String(version.description ?? '').trim(),
      rank: String(Math.max(1, Math.floor(Number(version.rank) || 1))),
      mode: String(ability?.mode ?? 'standard').trim() || 'standard',
      usageFrequency: 'passive',
      activationCost: activation,
      activationType: activation,
      range: formatArchetypeAbilityRange(version.range),
      duration: '',
      area: '',
      defense: String(ability?.defense ?? '').trim(),
      targets: 'single',
      requiresRoll: String(ability?.check ?? '').trim() === 'required',
      skill: String(ability?.skill ?? '').trim(),
      skillBonus: String(version.damage ?? '0/0/0/0').trim() || '0/0/0/0',
      stepEffects: []
    }
  };
}

export function applyArchetypeAbilityVersionToItemData(itemData, characterRank) {
  const ability = itemData?.system?.details?.archetypeAbility;
  const versionData = buildArchetypeAbilityVersionSystemData(ability, characterRank);
  if (!versionData) return itemData;
  itemData.name = versionData.name;
  itemData.system = {
    ...(itemData.system ?? {}),
    ...versionData.system,
    details: itemData.system?.details ?? {}
  };
  return itemData;
}

export function buildArchetypeTraitGrantData(source, archetypeId, libraryUuid = '') {
  if (!source || !String(archetypeId ?? '').trim()) return null;
  const data = source.toObject ? source.toObject() : deepClone(source);
  delete data._id;
  data.type = 'trait';
  data.flags ??= {};
  data.flags[MODULE_ID] = {
    ...(data.flags[MODULE_ID] ?? {}),
    [ARCHETYPE_GRANT_FLAG]: String(archetypeId).trim()
  };
  const normalizedUuid = String(libraryUuid || source.uuid || '').trim();
  if (normalizedUuid) data.flags[MODULE_ID][LIBRARY_ITEM_UUID_FLAG] = normalizedUuid;
  return data;
}

export async function syncArchetypeTraitGrant(actor, archetype, { render = false } = {}) {
  if (!actor || !archetype) return 0;
  const trait = archetype.system?.trait ?? {};
  const name = String(archetype.system?.traitName ?? trait.name ?? '').trim();
  const description = String(trait.description ?? '').trim();
  const updates = (actor.items ?? [])
    .filter(
      (item) =>
        item.type === 'trait' && item.getFlag?.(MODULE_ID, ARCHETYPE_GRANT_FLAG) === archetype.id
    )
    .map((item) => ({
      _id: item.id,
      ...(name ? { name } : {}),
      'system.description': description
    }));
  if (!updates.length) return 0;
  await actor.updateEmbeddedDocuments('Item', updates, { render });
  return updates.length;
}

export async function syncArchetypeAbilityToRank(actor, { render = false } = {}) {
  if (!actor) return 0;
  const updates = [];
  for (const item of actor.items ?? []) {
    if (!item.getFlag?.(MODULE_ID, ARCHETYPE_GRANT_FLAG)) continue;
    if (!item.system?.details?.archetypeAbility) continue;
    const data = applyArchetypeAbilityVersionToItemData(item.toObject(), actor.system?.currentRank);
    updates.push({ _id: item.id, name: data.name, system: data.system });
  }
  if (!updates.length) return 0;
  await actor.updateEmbeddedDocuments('Item', updates, { render });
  return updates.length;
}

export function getSkillRankBonus(actor, skillKey) {
  const archetypeSkill = getArchetypeSkillKey(actor);
  return archetypeSkill && archetypeSkill === skillKey ? ARCHETYPE_RANK_BONUS : 0;
}

// Revert everything an archetype granted: remove its ability and trait, take back the
// +1 rank it gave its skill (preserving any rank the player bought on top), and reset
// the three defenses to the rank default (defense = rank). Used both when an archetype
// is deleted and when it is replaced.
export async function clearArchetypeEffects(actor, archetypeItem) {
  if (!actor || !archetypeItem) return;

  const grantIds = actor.items
    .filter((item) => item.getFlag?.(MODULE_ID, ARCHETYPE_GRANT_FLAG) === archetypeItem.id)
    .map((item) => item.id);
  if (grantIds.length) {
    await actor.deleteEmbeddedDocuments('Item', grantIds);
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
