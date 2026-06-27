export const DAMAGE_PROFILE_OUTCOME_KEYS = Object.freeze([
  'Failure',
  'SuccessWithCost',
  'Success',
  'CriticalSuccess'
]);

const DEFAULT_DAMAGE_PROFILE = Object.freeze([0, 0, 0, 0]);
const DAMAGE_PROFILE_SEPARATOR = '/';

function normalizeDamageNumber(value) {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) ? Math.max(number, 0) : 0;
}

function parseDamageProfile(value) {
  if (Array.isArray(value)) {
    return value.slice(0, DAMAGE_PROFILE_OUTCOME_KEYS.length).map(normalizeDamageNumber);
  }

  const text = String(value ?? '').trim();
  if (!text) return [...DEFAULT_DAMAGE_PROFILE];

  if (!text.includes(DAMAGE_PROFILE_SEPARATOR)) {
    const legacyDamage = normalizeDamageNumber(text);
    return [0, legacyDamage, legacyDamage, legacyDamage];
  }

  return text
    .split(DAMAGE_PROFILE_SEPARATOR)
    .slice(0, DAMAGE_PROFILE_OUTCOME_KEYS.length)
    .map((part) => normalizeDamageNumber(part));
}

export function normalizeDamageProfile(value) {
  const values = parseDamageProfile(value);
  while (values.length < DAMAGE_PROFILE_OUTCOME_KEYS.length) {
    values.push(0);
  }
  return values;
}

export function formatDamageProfile(value) {
  return normalizeDamageProfile(value).join(DAMAGE_PROFILE_SEPARATOR);
}

export function getDamageForOutcome(value, outcomeKey) {
  const index = DAMAGE_PROFILE_OUTCOME_KEYS.indexOf(String(outcomeKey ?? '').trim());
  if (index === -1) return 0;
  return normalizeDamageProfile(value)[index] ?? 0;
}

export function hasDamageProfileValue(value) {
  return normalizeDamageProfile(value).some((damage) => damage > 0);
}
