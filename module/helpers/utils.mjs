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
