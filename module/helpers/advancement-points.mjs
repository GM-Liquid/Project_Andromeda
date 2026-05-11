import { getAbilityDieNumeric } from './utils.mjs';
import { PROJECT_ANDROMEDA } from './config.mjs';

const MAX_CREATION_ABILITY_NUMERIC = 12;

const ABILITY_ADVANCEMENT_COSTS = new Map([
  [4, 0],
  [6, 4],
  [8, 12],
  [10, 24],
  [12, 40]
]);

export function getSkillAdvancementCost(value) {
  let remainingSteps = Math.max(Math.trunc(Number(value) || 0), 0);
  let tierSize = 1;
  let tierCost = 1;
  let totalCost = 0;

  while (remainingSteps > 0) {
    const stepsInTier = Math.min(remainingSteps, tierSize);
    totalCost += stepsInTier * tierCost;
    remainingSteps -= stepsInTier;
    tierSize += 1;
    tierCost += 1;
  }

  return totalCost;
}

export function getAbilityAdvancementCost(value) {
  const numericValue = Math.min(getAbilityDieNumeric(value), MAX_CREATION_ABILITY_NUMERIC);
  return ABILITY_ADVANCEMENT_COSTS.get(numericValue) ?? 0;
}

export function getTotalAdvancementSpent(system = {}) {
  const abilityCost = Object.keys(PROJECT_ANDROMEDA.abilities ?? {}).reduce(
    (sum, abilityKey) => sum + getAbilityAdvancementCost(system?.abilities?.[abilityKey]?.value),
    0
  );
  const skillCost = Object.keys(PROJECT_ANDROMEDA.skills ?? {}).reduce(
    (sum, skillKey) => sum + getSkillAdvancementCost(system?.skills?.[skillKey]?.value),
    0
  );

  return abilityCost + skillCost;
}
