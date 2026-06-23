export const SKILL_CHECK_FORMULA = '2d6';
export const MIN_SKILL_RANK = 1;
export const MAX_SKILL_RANK = 4;
export const MAX_SKILL_VALUE = 3;

const VALUE_ADVANCEMENT_COSTS = [0, 1, 3, 6];
const COMPLETED_RANK_COST = VALUE_ADVANCEMENT_COSTS[MAX_SKILL_VALUE] + 2;

export function normalizeCharacterRank(rank) {
  return Math.max(MIN_SKILL_RANK, Math.min(Math.trunc(Number(rank) || 1), MAX_SKILL_RANK));
}

export function normalizeSkillRank(rank, characterRank = MAX_SKILL_RANK) {
  const maximum = normalizeCharacterRank(characterRank);
  return Math.max(MIN_SKILL_RANK, Math.min(Math.trunc(Number(rank) || 1), maximum));
}

export function normalizeSkillValue(value) {
  return Math.max(0, Math.min(Math.trunc(Number(value) || 0), MAX_SKILL_VALUE));
}

export function normalizeSkill(skill = {}, characterRank = MAX_SKILL_RANK) {
  return {
    rank: normalizeSkillRank(skill?.rank, characterRank),
    value: normalizeSkillValue(skill?.value)
  };
}

export function getSkillAdvancementCost(skill = {}) {
  const rank = Math.max(
    MIN_SKILL_RANK,
    Math.min(Math.trunc(Number(skill?.rank) || 1), MAX_SKILL_RANK)
  );
  const value = normalizeSkillValue(skill?.value);
  return (rank - MIN_SKILL_RANK) * COMPLETED_RANK_COST + VALUE_ADVANCEMENT_COSTS[value];
}

export function getNextSkillAdvancement(skill = {}, characterRank = MAX_SKILL_RANK) {
  const normalized = normalizeSkill(skill, characterRank);
  if (normalized.value < MAX_SKILL_VALUE) {
    return {
      rank: normalized.rank,
      value: normalized.value + 1,
      cost: normalized.value + 1
    };
  }
  if (normalized.rank >= normalizeCharacterRank(characterRank)) return null;
  return {
    rank: normalized.rank + 1,
    value: 0,
    cost: 2
  };
}

export function getSkillCheckOutcomeKey(total) {
  const numeric = Number(total) || 0;
  if (numeric >= 13) return 'CriticalSuccess';
  if (numeric >= 10) return 'Success';
  if (numeric >= 7) return 'SuccessWithCost';
  return 'Failure';
}
