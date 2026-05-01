function cloneData(value) {
  if (globalThis.foundry?.utils?.deepClone) {
    return foundry.utils.deepClone(value);
  }
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function resolveRollClass(sourceRoll) {
  const RollClass = sourceRoll?.constructor;
  if (typeof RollClass === 'function' && RollClass !== Object) {
    return RollClass;
  }
  return Roll;
}

function hasFormulaData(data) {
  return data && typeof data === 'object' && Object.keys(data).length > 0;
}

function buildFormulaFromTerms(terms) {
  if (!Array.isArray(terms) || !terms.length) return '';
  return terms
    .map((term) => {
      const formula = String(term?.formula ?? '').trim();
      if (formula) return formula;
      const operator = String(term?.operator ?? '').trim();
      if (operator) return operator;
      const number = Number(term?.number);
      if (Number.isFinite(number)) return `${number}`;
      return '';
    })
    .filter(Boolean)
    .join(' ');
}

export function buildRollRerollSpec(sourceRoll) {
  const serialized = typeof sourceRoll?.toJSON === 'function' ? sourceRoll.toJSON() : {};
  const rawFormula = String(sourceRoll?.formula ?? serialized?.formula ?? '').trim();
  const data = cloneData(sourceRoll?.data ?? sourceRoll?._data ?? serialized?.data ?? {});
  const termFormula = buildFormulaFromTerms(sourceRoll?.terms ?? serialized?.terms);
  const formula =
    rawFormula.includes('@') && !hasFormulaData(data) && termFormula ? termFormula : rawFormula;
  if (!formula) return null;

  return {
    formula,
    data,
    options: cloneData(sourceRoll?.options ?? serialized?.options ?? {})
  };
}

export async function rerollRollPreservingContext(sourceRoll) {
  const spec = buildRollRerollSpec(sourceRoll);
  if (!spec) return null;

  const RollClass = resolveRollClass(sourceRoll);
  const rerolledRoll = new RollClass(spec.formula, spec.data, spec.options);
  return rerolledRoll.roll({ async: true });
}
