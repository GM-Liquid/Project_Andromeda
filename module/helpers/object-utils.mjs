/**
 * Clone plain Foundry data without tying build-time helpers to the Foundry runtime.
 */
export function deepClone(value) {
  if (globalThis.foundry?.utils?.deepClone) {
    return globalThis.foundry.utils.deepClone(value);
  }
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/**
 * Recursively sort plain-object keys while preserving array order.
 */
export function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortObjectKeys(entry));
  }

  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .reduce((result, key) => {
        result[key] = sortObjectKeys(value[key]);
        return result;
      }, {});
  }

  return value;
}

export function stableStringify(value, space = 0) {
  return JSON.stringify(sortObjectKeys(value ?? {}), null, space);
}

export function areJsonValuesEqual(left, right) {
  return stableStringify(left) === stableStringify(right);
}
