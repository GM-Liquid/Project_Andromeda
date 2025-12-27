// Utility functions for the Project Andromeda system

/**
 * Determine a simplified rank (1-4) used purely for coloring cells in the UI.
 * @param {number} [val=0] The value to rank.
 * @param {'ability' | 'skill'} [type='skill'] Determines which thresholds to use.
 * @returns {number} Rank between 1 and 4
 */
export function getColorRank(val = 0, type = 'skill') {
  const numeric = Number(val) || 0;

  if (type === 'ability') {
    if (numeric <= 6) return 1;
    if (numeric <= 8) return 2;
    if (numeric <= 10) return 3;
    return 4;
  }

  if (numeric <= 1) return 1;
  if (numeric <= 3) return 2;
  if (numeric <= 6) return 3;
  return 4;
}

export const ABILITY_DIE_STEPS = [4, 6, 8, 10, 12];

export function normalizeAbilityDie(value) {
  const numeric = Number(value);
  if (ABILITY_DIE_STEPS.includes(numeric)) return numeric;
  const clamped = Math.max(Math.min(numeric || 0, Math.max(...ABILITY_DIE_STEPS)), Math.min(...ABILITY_DIE_STEPS));
  let closest = ABILITY_DIE_STEPS[0];
  for (const die of ABILITY_DIE_STEPS) {
    if (Math.abs(die - clamped) < Math.abs(closest - clamped)) {
      closest = die;
    }
  }
  return closest;
}
