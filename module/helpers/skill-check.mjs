export const SKILL_CHECK_FORMULA = '2d8';
export const MIN_SKILL_RANK = 1;
export const MAX_SKILL_RANK = 4;
export const MAX_SKILL_VALUE = 4;

// An archetype skill starts one rank above the base (rank 2) and its rank cap is
// one higher than the character rank, so it can reach rank 5. Both the free rank-2
// baseline and the +1 cap are keyed off the actor's archetype (see archetype.mjs).
export const ARCHETYPE_RANK_BONUS = 1;
export const ARCHETYPE_BASELINE_RANK = 2;

// Absolute ceiling a skill rank can ever reach (character rank 4 + archetype +1).
const ABSOLUTE_MAX_SKILL_RANK = MAX_SKILL_RANK + ARCHETYPE_RANK_BONUS;

export function normalizeCharacterRank(rank) {
  return Math.max(MIN_SKILL_RANK, Math.min(Math.trunc(Number(rank) || 1), MAX_SKILL_RANK));
}

export function getSkillRankCap(characterRank = MAX_SKILL_RANK, rankBonus = 0) {
  const bonus = Math.max(0, Math.trunc(Number(rankBonus) || 0));
  return normalizeCharacterRank(characterRank) + bonus;
}

export function normalizeSkillRank(rank, characterRank = MAX_SKILL_RANK, rankBonus = 0) {
  const maximum = getSkillRankCap(characterRank, rankBonus);
  return Math.max(MIN_SKILL_RANK, Math.min(Math.trunc(Number(rank) || 1), maximum));
}

export function normalizeSkillValue(value) {
  return Math.max(0, Math.min(Math.trunc(Number(value) || 0), MAX_SKILL_VALUE));
}

export function normalizeSkill(skill = {}, characterRank = MAX_SKILL_RANK, rankBonus = 0) {
  return {
    rank: normalizeSkillRank(skill?.rank, characterRank, rankBonus),
    value: normalizeSkillValue(skill?.value)
  };
}

// Raising a skill value by one step costs as many progression points as the
// skill's current rank, so a full rank (value 0 -> 4) costs MAX_SKILL_VALUE * rank.
// Rolling a completed rank into the next one (value 4 -> next rank value 0) is free.
// `baselineRank` is the rank the skill is considered to start from for free: 1 for
// ordinary skills, 2 for the archetype skill (its starting rank 2 is granted).
export function getSkillAdvancementCost(skill = {}, { baselineRank = MIN_SKILL_RANK } = {}) {
  const rank = Math.max(
    MIN_SKILL_RANK,
    Math.min(Math.trunc(Number(skill?.rank) || 1), ABSOLUTE_MAX_SKILL_RANK)
  );
  const value = normalizeSkillValue(skill?.value);
  const base = Math.max(MIN_SKILL_RANK, Math.trunc(Number(baselineRank) || MIN_SKILL_RANK));
  let cost = 0;
  for (let r = base; r < rank; r += 1) {
    cost += MAX_SKILL_VALUE * r;
  }
  cost += value * rank;
  return cost;
}

export function getNextSkillAdvancement(skill = {}, characterRank = MAX_SKILL_RANK, options = {}) {
  const rankBonus = options?.rankBonus ?? 0;
  const normalized = normalizeSkill(skill, characterRank, rankBonus);
  if (normalized.value < MAX_SKILL_VALUE) {
    return {
      rank: normalized.rank,
      value: normalized.value + 1,
      cost: normalized.rank
    };
  }
  if (normalized.rank >= getSkillRankCap(characterRank, rankBonus)) return null;
  return {
    rank: normalized.rank + 1,
    value: 0,
    cost: 0
  };
}

export function getSkillCheckOutcomeKey(total) {
  const numeric = Number(total) || 0;
  if (numeric >= 16) return 'CriticalSuccess';
  if (numeric >= 12) return 'Success';
  if (numeric >= 8) return 'SuccessWithCost';
  return 'Failure';
}

// Outcome ladder, lowest to highest. Index order matches the damage profile values.
export const OUTCOME_KEYS = Object.freeze([
  'Failure',
  'SuccessWithCost',
  'Success',
  'CriticalSuccess'
]);

export function getOutcomeIndex(outcomeKey) {
  const index = OUTCOME_KEYS.indexOf(String(outcomeKey ?? '').trim());
  return index === -1 ? 0 : index;
}

export function clampOutcomeIndex(index) {
  return Math.max(0, Math.min(OUTCOME_KEYS.length - 1, Math.trunc(Number(index) || 0)));
}

export function getOutcomeKeyByIndex(index) {
  return OUTCOME_KEYS[clampOutcomeIndex(index)];
}

// Returns the outcome key after applying a signed step shift, clamped to the ladder.
export function shiftOutcomeKey(outcomeKey, shift = 0) {
  return getOutcomeKeyByIndex(getOutcomeIndex(outcomeKey) + (Number(shift) || 0));
}

// Normalizes a stored shift so the shifted outcome stays inside the ladder.
export function normalizeOutcomeShift(outcomeKey, shift = 0) {
  const rolledIndex = getOutcomeIndex(outcomeKey);
  return clampOutcomeIndex(rolledIndex + (Number(shift) || 0)) - rolledIndex;
}
