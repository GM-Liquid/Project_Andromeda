// Utility functions for the Project Andromeda system

/**
 * Determine a simplified rank (1-4) used purely for coloring cells in the UI.
 * @param {number} [val=0] The value to rank.
 * @param {'ability' | 'skill'} [type='skill'] Determines which thresholds to use.
 * @returns {number} Rank between 1 and 4
 */
export function getColorRank(val = 0, type = 'skill') {
  const numeric = type === 'ability' ? getAbilityDieNumeric(val) : Number(val) || 0;

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

export const ABILITY_DIE_STEPS = [
  { value: 4, label: 'd4', roll: '1d4', numeric: 4 },
  { value: 6, label: 'd6', roll: '1d6', numeric: 6 },
  { value: 8, label: 'd8', roll: '1d8', numeric: 8 },
  { value: 10, label: 'd10', roll: '1d10', numeric: 10 },
  { value: 12, label: 'd12', roll: '1d12', numeric: 12 },
  { value: '2d8', label: '2d8', roll: '2d8', numeric: 16 },
  { value: 20, label: 'd20', roll: '1d20', numeric: 20 }
];

const ABILITY_DIE_VALUES = ABILITY_DIE_STEPS.map((step) => step.value);
const ABILITY_DIE_NUMERICS = ABILITY_DIE_STEPS.map((step) => step.numeric);

export function getAbilityDieStep(value) {
  if (value === undefined || value === null) return ABILITY_DIE_STEPS[0];
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value;
  const byValue = ABILITY_DIE_STEPS.find((step) => {
    if (typeof normalized === 'number') return step.value === normalized;
    if (typeof step.value === 'string' && typeof normalized === 'string') {
      return step.value.toLowerCase() === normalized;
    }
    if (typeof normalized === 'string' && normalized.startsWith('d')) {
      const numeric = Number(normalized.slice(1));
      return Number.isFinite(numeric) && step.value === numeric;
    }
    return false;
  });
  if (byValue) return byValue;
  if (typeof normalized === 'number') {
    const min = Math.min(...ABILITY_DIE_NUMERICS);
    const max = Math.max(...ABILITY_DIE_NUMERICS);
    const clamped = Math.max(Math.min(normalized, max), min);
    let closest = ABILITY_DIE_STEPS[0];
    for (const step of ABILITY_DIE_STEPS) {
      if (Math.abs(step.numeric - clamped) < Math.abs(closest.numeric - clamped)) {
        closest = step;
      }
    }
    return closest;
  }
  return ABILITY_DIE_STEPS[0];
}

export function normalizeAbilityDie(value) {
  return getAbilityDieStep(value).value;
}

export function getAbilityDieLabel(value) {
  return getAbilityDieStep(value).label;
}

export function getAbilityDieRoll(value) {
  return getAbilityDieStep(value).roll;
}

export function getAbilityDieNumeric(value) {
  return getAbilityDieStep(value).numeric;
}
