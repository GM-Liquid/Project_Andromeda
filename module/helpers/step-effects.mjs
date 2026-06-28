import { getOutcomeIndex } from './skill-check.mjs';

// Outcome thresholds an effect may require. Failure is intentionally excluded:
// a failed check never activates a step effect.
export const STEP_EFFECT_THRESHOLDS = Object.freeze([
  'SuccessWithCost',
  'Success',
  'CriticalSuccess'
]);

const DEFAULT_THRESHOLD = 'Success';

function normalizeThreshold(value) {
  const text = String(value ?? '').trim();
  return STEP_EFFECT_THRESHOLDS.includes(text) ? text : DEFAULT_THRESHOLD;
}

export function normalizeStepEffects(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((effect) => ({
      text: String(effect?.text ?? '').trim(),
      minOutcome: normalizeThreshold(effect?.minOutcome)
    }))
    .filter((effect) => effect.text.length > 0);
}

export function hasStepEffects(value) {
  return normalizeStepEffects(value).length > 0;
}

// An effect is active when the current outcome reaches or exceeds its threshold.
export function isStepEffectActive(effect, outcomeKey) {
  return getOutcomeIndex(outcomeKey) >= getOutcomeIndex(effect?.minOutcome);
}
