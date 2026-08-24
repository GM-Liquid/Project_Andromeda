const RANKS = Object.freeze([1, 2, 3, 4]);

const DAMAGE_LINES = Object.freeze({
  weak: Object.freeze(['0/1/1/2', '1/1/2/3', '1/2/3/5', '2/3/4/6']),
  medium: Object.freeze(['1/1/2/3', '2/3/4/6', '2/4/6/9', '3/6/8/12']),
  standard: Object.freeze(['1/2/3/5', '2/4/6/9', '4/6/9/14', '5/8/12/18']),
  heavy: Object.freeze(['2/3/4/6', '3/6/8/12', '5/8/12/18', '6/11/16/24'])
});

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function normalizeAbilityScalingRank(rank) {
  return Math.max(1, Math.min(4, Math.trunc(Number(rank) || 1)));
}

function parseDamageProfile(value) {
  const parts = String(value ?? '')
    .split('/')
    .map((part) => Number(part));
  return parts.length === 4 && parts.every(Number.isFinite) ? parts : null;
}

// Kept as a small public utility for callers that need an inferred damage line.
// Catalog abilities themselves never use inference: their explicit `scaling` rows
// below are authoritative, including deliberately irregular damage profiles.
export function scaleAbilityDamageProfile(value, sourceRank, targetRank) {
  const normalizedSourceRank = normalizeAbilityScalingRank(sourceRank);
  const normalizedTargetRank = normalizeAbilityScalingRank(targetRank);
  const sourceIndex = normalizedSourceRank - 1;
  const anchor = Object.values(DAMAGE_LINES).find((line) => line[sourceIndex] === value);
  if (anchor) return anchor[normalizedTargetRank - 1];

  const parts = parseDamageProfile(value);
  if (!parts) return value;
  return parts
    .map((part) => Math.round((part * normalizedTargetRank) / normalizedSourceRank))
    .join('/');
}

function getScaledHolderField(holder) {
  if (Object.hasOwn(holder, 'distance')) return 'distance';
  if (Object.hasOwn(holder, 'amount')) return 'amount';
  if (Object.hasOwn(holder, 'value')) return 'value';
  return '';
}

function applyExplicitScaling(value, scaling, rankIndex, replacements) {
  if (!value || typeof value !== 'object') return;

  if (!Array.isArray(value)) {
    const scaleKey = String(value.scale ?? '').trim();
    const row = scaleKey ? scaling?.[scaleKey] : null;
    const values = Array.isArray(row?.values) ? row.values : [];
    const field = getScaledHolderField(value);
    if (field && values.length === RANKS.length && values[rankIndex] !== undefined) {
      const source = clone(value[field]);
      const target = clone(values[rankIndex]);
      value[field] = target;
      replacements.push({
        parameter: String(row.parameter ?? '').trim(),
        source,
        target
      });
    }
  }

  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    applyExplicitScaling(child, scaling, rankIndex, replacements);
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceOutcomeLine(text, source, target) {
  if (typeof source !== 'string' || !source.includes('/')) return text;
  const pattern = source
    .split('/')
    .map((part) => escapeRegExp(part))
    .join('\\s*\\/\\s*');
  return text.replace(new RegExp(pattern, 'gu'), String(target));
}

function replaceMetres(text, source, target) {
  const pattern = new RegExp(
    `(?<!\\d)${escapeRegExp(source)}(?!\\d)(?=\\s*м(?!\\p{L}))`,
    'gu'
  );
  return text.replace(pattern, String(target));
}

function replaceStressValue(text, source, target) {
  const escaped = escapeRegExp(source);
  let result = text.replace(
    new RegExp(
      `(?<!\\d)${escaped}(?!\\d)(?=\\s+(?:(?:временн\\p{L}*\\s+)?ячейк|стресс))`,
      'giu'
    ),
    String(target)
  );
  result = result.replace(
    new RegExp(
      `((?:максимум\\p{L}*\\s+)?стресс\\p{L}*[^.!?]{0,60}?(?:(?:на|равен\\p{L}*|:)\\s*)?)${escaped}(?!\\d)`,
      'giu'
    ),
    (_match, prefix) => `${prefix}${target}`
  );
  return result;
}

function replaceDamageValue(text, source, target) {
  const escaped = escapeRegExp(source);
  let result = text.replace(
    new RegExp(
      `(?<!\\d)${escaped}(?!\\d)(?=\\s+урон(?:а|у|ом)?(?!\\p{L}))`,
      'giu'
    ),
    String(target)
  );
  result = result.replace(
    new RegExp(`(урон(?:а|у|ом)?[^.!?]{0,70}?на\\s+)${escaped}(?!\\d)`, 'giu'),
    (_match, prefix) => `${prefix}${target}`
  );
  result = result.replace(
    new RegExp(
      `((?:уменьш|сниж|увелич)\\p{L}*[^.!?]{0,90}?на\\s+)${escaped}(?!\\d)`,
      'giu'
    ),
    (_match, prefix) => `${prefix}${target}`
  );
  return result;
}

function scaleDescriptionFromRows(description, replacements) {
  let result = String(description ?? '');
  const unique = new Map();
  for (const replacement of replacements) {
    const key = JSON.stringify([
      replacement.parameter,
      replacement.source,
      replacement.target
    ]);
    unique.set(key, replacement);
  }

  const ordered = [...unique.values()].sort((left, right) => {
    const leftIsLine = typeof left.source === 'string' && left.source.includes('/');
    const rightIsLine = typeof right.source === 'string' && right.source.includes('/');
    return Number(rightIsLine) - Number(leftIsLine);
  });

  for (const { parameter, source, target } of ordered) {
    if (source === target || source == null || target == null) continue;
    if (typeof source === 'string' && source.includes('/')) {
      result = replaceOutcomeLine(result, source, target);
      continue;
    }
    if (/[,]\s*м(?:\s*\/|$)/u.test(parameter)) {
      result = replaceMetres(result, source, target);
      continue;
    }
    if (/стресс|ячейк/iu.test(parameter)) {
      result = replaceStressValue(result, source, target);
      continue;
    }
    if (/урон/iu.test(parameter)) {
      result = replaceDamageValue(result, source, target);
    }
  }
  return result;
}

export function scaleAbilityDescription(description, entry, targetRank) {
  const normalizedTargetRank = normalizeAbilityScalingRank(targetRank);
  const explicit = entry?.descriptionByRank?.[String(normalizedTargetRank)];
  if (typeof explicit === 'string' && explicit.trim()) return explicit;

  const mechanics = clone(entry?.mechanics ?? {});
  const replacements = [];
  applyExplicitScaling(
    mechanics,
    entry?.scaling ?? {},
    normalizedTargetRank - 1,
    replacements
  );
  return scaleDescriptionFromRows(description, replacements);
}

export function scaleAbilityCatalogEntry(entry, targetRank) {
  const scaled = clone(entry) ?? {};
  const normalizedTargetRank = normalizeAbilityScalingRank(targetRank);
  const replacements = [];
  applyExplicitScaling(
    scaled.mechanics,
    scaled.scaling ?? {},
    normalizedTargetRank - 1,
    replacements
  );

  const explicitDescription = entry?.descriptionByRank?.[String(normalizedTargetRank)];
  scaled.description =
    typeof explicitDescription === 'string' && explicitDescription.trim()
      ? explicitDescription
      : scaleDescriptionFromRows(entry?.description, replacements);
  scaled.ownerRank = normalizedTargetRank;
  return scaled;
}

export function buildAbilityRankScaling(entry) {
  return Object.fromEntries(
    RANKS.map((rank) => [String(rank), scaleAbilityCatalogEntry(entry, rank)])
  );
}
