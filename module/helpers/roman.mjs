// systems/project-andromeda/helpers/roman.mjs
//
// Convert a small positive integer (skill rank or character rank, 1-10) into a
// Roman numeral for display. Ranks are shown as Roman numerals on the sheet so
// they never read as the same kind of value as the arabic skill bonus/value.

const ROMAN_BY_NUMBER = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Format a rank value as a Roman numeral.
 *
 * @param {number|string} value Rank value (expected 1-10; archetype skills reach 5).
 * @returns {string} Roman numeral, or the plain arabic string for out-of-range / invalid input.
 */
export function toRoman(value) {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  const rounded = Math.trunc(numeric);
  if (rounded < 1 || rounded >= ROMAN_BY_NUMBER.length) return String(rounded);
  return ROMAN_BY_NUMBER[rounded];
}
