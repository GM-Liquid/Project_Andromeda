// Utility functions for the Project Andromeda system

/**
 * Determine a simplified rank (1-5) based on a value in steps of two.
 * Used purely for coloring cells in the UI.
 * @param {number} [val=0] The value to rank.
 * @returns {number} Rank between 1 and 5
 */
export function getColorRank(val = 0) {
  if (val <= 2) return 1;
  if (val <= 4) return 2;
  if (val <= 6) return 3;
  if (val <= 8) return 4;
  return 5;
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
