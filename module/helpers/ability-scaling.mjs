const RANKS = Object.freeze([1, 2, 3, 4]);

const METRE_SCALES = Object.freeze({
  sixth: Object.freeze([2, 5, 15, 50]),
  quarter: Object.freeze([3, 8, 25, 75]),
  third: Object.freeze([3, 10, 35, 100]),
  half: Object.freeze([5, 15, 50, 150]),
  full: Object.freeze([10, 30, 100, 300])
});

const DAMAGE_LINES = Object.freeze({
  weak: Object.freeze(['0/1/1/2', '1/1/2/3', '1/2/3/5', '2/3/4/6']),
  medium: Object.freeze(['1/1/2/3', '2/3/4/6', '2/4/6/9', '3/6/8/12']),
  standard: Object.freeze(['1/2/3/5', '2/4/6/9', '4/6/9/14', '5/8/12/18']),
  heavy: Object.freeze(['2/3/4/6', '3/6/8/12', '5/8/12/18', '6/11/16/24'])
});

const MOVE_OUTCOME_KEYS = new Set(['moveSelf', 'moveTarget', 'teleport']);
const LINEAR_OUTCOME_KEYS = new Set(['damageBonus', 'damageReduction', 'restoreStress']);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function normalizeAbilityScalingRank(rank) {
  return Math.max(1, Math.min(4, Math.trunc(Number(rank) || 1)));
}

function getExplicitScalingValue(holder, targetRank) {
  const scaling = holder?.scaling;
  if (!scaling || typeof scaling !== 'object') return undefined;
  return scaling[String(targetRank)] ?? scaling.byRank?.[String(targetRank)];
}

function findMetreScale(value, sourceRank, names) {
  const sourceIndex = sourceRank - 1;
  return names.find((name) => METRE_SCALES[name][sourceIndex] === Number(value)) ?? null;
}

function scaleMetres(value, sourceRank, targetRank, names) {
  const scaleName = findMetreScale(value, sourceRank, names);
  if (!scaleName) return Number(value);
  return METRE_SCALES[scaleName][targetRank - 1];
}

function parseDamageProfile(value) {
  const parts = String(value ?? '')
    .split('/')
    .map((part) => Number(part));
  return parts.length === 4 && parts.every(Number.isFinite) ? parts : null;
}

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

function scaleLinearNumber(value, sourceRank, targetRank) {
  const coefficient = Number(value) / sourceRank;
  return Number.isInteger(coefficient) && coefficient >= 1 && coefficient <= 3
    ? coefficient * targetRank
    : Number(value);
}

function scaleConditionHolder(holder, sourceRank, targetRank, names) {
  if (!holder || holder.value === undefined) return;
  const explicit = getExplicitScalingValue(holder, targetRank);
  holder.value = explicit ?? scaleMetres(holder.value, sourceRank, targetRank, names);
}

function scaleOutcome(outcome, sourceRank, targetRank) {
  const explicit = getExplicitScalingValue(outcome, targetRank);
  if (outcome.key === 'damage') {
    outcome.value = explicit ?? scaleAbilityDamageProfile(outcome.value, sourceRank, targetRank);
    return;
  }

  if (MOVE_OUTCOME_KEYS.has(outcome.key) && outcome.distance !== undefined) {
    outcome.distance =
      explicit ??
      scaleMetres(outcome.distance, sourceRank, targetRank, [
        'third',
        'quarter',
        'sixth',
        'half',
        'full'
      ]);
    return;
  }

  if (!LINEAR_OUTCOME_KEYS.has(outcome.key)) return;
  if (typeof outcome.amount === 'number') {
    outcome.amount = explicit ?? scaleLinearNumber(outcome.amount, sourceRank, targetRank);
  } else if (typeof outcome.value === 'number') {
    outcome.value = explicit ?? scaleLinearNumber(outcome.value, sourceRank, targetRank);
  } else if (typeof outcome.value === 'string' && outcome.value.includes('/')) {
    outcome.value = explicit ?? scaleAbilityDamageProfile(outcome.value, sourceRank, targetRank);
  }
}

function scaleDescriptionMetres(text, sourceRank, targetRank) {
  return text.replace(/(\d+)\s*м/gu, (match, rawValue, offset) => {
    const value = Number(rawValue);
    const context = text.slice(Math.max(0, offset - 35), offset).toLowerCase();
    const areaContext = /(радиус|ширин)/u.test(context);
    const names = areaContext
      ? ['sixth', 'quarter', 'half', 'third', 'full']
      : ['third', 'quarter', 'sixth', 'half', 'full'];
    const scaled = scaleMetres(value, sourceRank, targetRank, names);
    return `${scaled} м`;
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scaleDescriptionDamageProfiles(text, entry, sourceRank, targetRank) {
  let result = text;
  const sourceProfiles = new Set(
    (entry.mechanics?.effects ?? [])
      .flatMap((effect) => effect.outcomes ?? [])
      .filter((outcome) => outcome.key === 'damage')
      .map((outcome) => String(outcome.value ?? outcome.amount ?? ''))
      .filter((value) => parseDamageProfile(value))
  );

  for (const sourceProfile of sourceProfiles) {
    const targetProfile = scaleAbilityDamageProfile(sourceProfile, sourceRank, targetRank);
    const pattern = sourceProfile
      .split('/')
      .map((part) => escapeRegExp(part))
      .join('\\s*\\/\\s*');
    result = result.replace(new RegExp(pattern, 'gu'), targetProfile);
  }

  return result;
}

function scaleDescriptionLinearValues(text, sourceRank, targetRank) {
  let result = text.replace(/\b(\d+)(?=\s+(?:временн\p{L}*\s+)?ячейк)/gu, (value) =>
    String(scaleLinearNumber(value, sourceRank, targetRank))
  );
  result = result.replace(/\b(\d+)(?=\s+урона(?:\s|[.,:;!?]|$))/gu, (value) =>
    String(scaleLinearNumber(value, sourceRank, targetRank))
  );
  result = result.replace(
    /((?:уменьш|сниж)\p{L}*[^.!?]{0,120}?на\s+)(\d+)(?!\d)/giu,
    (_match, prefix, value) => `${prefix}${scaleLinearNumber(value, sourceRank, targetRank)}`
  );
  return result;
}

function scaleDescriptionBareStressSteps(text, entry, sourceRank, targetRank) {
  let result = text;
  for (const effect of entry.mechanics?.effects ?? []) {
    for (const outcome of effect.outcomes ?? []) {
      if (outcome.key !== 'restoreStress' || typeof outcome.amount !== 'number') continue;
      const source = outcome.amount;
      const target = scaleLinearNumber(source, sourceRank, targetRank);
      result = result.replace(
        new RegExp(
          `((?:при|на)[^.!?]{0,50}?успех\\p{L}*[^.!?]{0,20}?[—-]\\s*)${source}(?!\\d)`,
          'giu'
        ),
        (_match, prefix) => `${prefix}${target}`
      );
    }
  }
  return result;
}

export function scaleAbilityDescription(description, entry, targetRank) {
  const sourceRank = normalizeAbilityScalingRank(entry?.rank);
  const normalizedTargetRank = normalizeAbilityScalingRank(targetRank);
  const explicit = entry?.descriptionByRank?.[String(normalizedTargetRank)];
  if (typeof explicit === 'string' && explicit.trim()) return explicit;

  let result = String(description ?? '');
  result = scaleDescriptionDamageProfiles(result, entry, sourceRank, normalizedTargetRank);
  result = scaleDescriptionMetres(result, sourceRank, normalizedTargetRank);
  result = scaleDescriptionLinearValues(result, sourceRank, normalizedTargetRank);
  return scaleDescriptionBareStressSteps(result, entry, sourceRank, normalizedTargetRank);
}

export function scaleAbilityCatalogEntry(entry, targetRank) {
  const scaled = clone(entry) ?? {};
  const sourceRank = normalizeAbilityScalingRank(entry?.rank);
  const normalizedTargetRank = normalizeAbilityScalingRank(targetRank);

  for (const effect of scaled.mechanics?.effects ?? []) {
    const conditions = effect.conditions ?? {};
    if (conditions.range?.type === 'meters') {
      scaleConditionHolder(conditions.range, sourceRank, normalizedTargetRank, [
        'third',
        'half',
        'full'
      ]);
    }
    if (conditions.area?.value !== undefined) {
      scaleConditionHolder(
        conditions.area,
        sourceRank,
        normalizedTargetRank,
        conditions.area.type === 'cone' ? ['third', 'half', 'full'] : ['sixth', 'quarter', 'half']
      );
    }
    for (const outcome of effect.outcomes ?? []) {
      scaleOutcome(outcome, sourceRank, normalizedTargetRank);
    }
  }

  scaled.description = scaleAbilityDescription(entry?.description, entry, normalizedTargetRank);
  scaled.ownerRank = normalizedTargetRank;
  return scaled;
}

export function buildAbilityRankScaling(entry) {
  return Object.fromEntries(
    RANKS.map((rank) => [String(rank), scaleAbilityCatalogEntry(entry, rank)])
  );
}
