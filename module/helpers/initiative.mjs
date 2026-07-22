import { isPlayerCharacterActorType } from './actor-types.mjs';

export const INITIATIVE_SIDE_HEROES = 'heroes';
export const INITIATIVE_SIDE_OPPONENTS = 'opponents';
export const INITIATIVE_SIDES = [INITIATIVE_SIDE_HEROES, INITIATIVE_SIDE_OPPONENTS];

const FRIENDLY_TOKEN_DISPOSITION = 1;
const INITIATIVE_HISTORY_LIMIT = 20;

export function getOppositeInitiativeSide(side) {
  return side === INITIATIVE_SIDE_OPPONENTS ? INITIATIVE_SIDE_HEROES : INITIATIVE_SIDE_OPPONENTS;
}

export function normalizeInitiativeSide(side, fallback = INITIATIVE_SIDE_HEROES) {
  return INITIATIVE_SIDES.includes(side) ? side : fallback;
}

export function getCombatantInitiativeSide({ actorType, tokenDisposition, sideOverride } = {}) {
  if (INITIATIVE_SIDES.includes(sideOverride)) return sideOverride;
  if (isPlayerCharacterActorType(actorType)) return INITIATIVE_SIDE_HEROES;
  return Number(tokenDisposition) === FRIENDLY_TOKEN_DISPOSITION
    ? INITIATIVE_SIDE_HEROES
    : INITIATIVE_SIDE_OPPONENTS;
}

export function createInitiativeState({
  round = 1,
  startingSide = INITIATIVE_SIDE_HEROES,
  history = []
} = {}) {
  return {
    round: Math.max(1, Math.floor(Number(round) || 1)),
    startingSide: normalizeInitiativeSide(startingSide),
    actedIds: [],
    selectedId: null,
    history: normalizeHistory(history)
  };
}

export function normalizeInitiativeState(
  state,
  { round = 1, startingSide = INITIATIVE_SIDE_HEROES } = {}
) {
  const source = state && typeof state === 'object' ? state : {};
  return {
    round: Math.max(1, Math.floor(Number(source.round ?? round) || 1)),
    startingSide: normalizeInitiativeSide(source.startingSide, startingSide),
    actedIds: normalizeIdList(source.actedIds),
    selectedId: normalizeId(source.selectedId),
    history: normalizeHistory(source.history)
  };
}

export function buildInitiativeTurnPlan(slots, rawState) {
  const normalizedSlots = normalizeSlots(slots);
  const slotById = new Map(normalizedSlots.map((slot) => [slot.id, slot]));
  const state = normalizeInitiativeState(rawState);
  const actedIds = state.actedIds.filter((id) => slotById.has(id));
  const actedSet = new Set(actedIds);
  const readySlots = normalizedSlots.filter((slot) => !slot.defeated && !actedSet.has(slot.id));
  const defeatedSlots = normalizedSlots.filter((slot) => slot.defeated && !actedSet.has(slot.id));

  const nextSide = getNextInitiativeSide(readySlots, actedIds, slotById, state.startingSide);
  const eligibleSlots = nextSide ? readySlots.filter((slot) => slot.side === nextSide) : [];
  const eligibleIds = eligibleSlots.map((slot) => slot.id);
  const selectedId = eligibleIds.includes(state.selectedId)
    ? state.selectedId
    : (eligibleIds[0] ?? null);

  const currentSlots = selectedId
    ? [slotById.get(selectedId), ...eligibleSlots.filter((slot) => slot.id !== selectedId)]
    : [];
  const laterSlots = readySlots.filter((slot) => slot.side !== nextSide);
  const orderedIds = [
    ...actedIds,
    ...currentSlots.map((slot) => slot.id),
    ...laterSlots.map((slot) => slot.id),
    ...defeatedSlots.map((slot) => slot.id)
  ];

  return {
    state: { ...state, actedIds, selectedId },
    orderedIds,
    actedIds,
    eligibleIds,
    currentId: selectedId,
    currentIndex: selectedId ? orderedIds.indexOf(selectedId) : null,
    nextSide,
    roundComplete: readySlots.length === 0
  };
}

export function selectInitiativeCombatant(slots, rawState, combatantId) {
  const plan = buildInitiativeTurnPlan(slots, rawState);
  const selectedId = normalizeId(combatantId);
  if (!selectedId || !plan.eligibleIds.includes(selectedId)) return plan.state;
  return { ...plan.state, selectedId };
}

export function advanceInitiativeTurn(slots, rawState, combatantId) {
  const plan = buildInitiativeTurnPlan(slots, rawState);
  const currentId = normalizeId(combatantId) ?? plan.currentId;
  if (!currentId || !plan.eligibleIds.includes(currentId)) {
    return { state: plan.state, advanced: false, roundComplete: plan.roundComplete };
  }

  const actedIds = [...plan.actedIds, currentId];
  const interimState = { ...plan.state, actedIds, selectedId: null };
  const afterTurn = buildInitiativeTurnPlan(slots, interimState);
  if (!afterTurn.roundComplete) {
    return { state: afterTurn.state, advanced: true, roundComplete: false };
  }

  const history = [...plan.state.history, { round: plan.state.round, order: actedIds }].slice(
    -INITIATIVE_HISTORY_LIMIT
  );
  return {
    state: createInitiativeState({
      round: plan.state.round + 1,
      startingSide: plan.state.startingSide,
      history
    }),
    advanced: true,
    roundComplete: true
  };
}

export function rewindInitiativeTurn(slots, rawState) {
  const plan = buildInitiativeTurnPlan(slots, rawState);
  if (plan.actedIds.length) {
    const actedIds = plan.actedIds.slice(0, -1);
    const selectedId = plan.actedIds.at(-1) ?? null;
    return {
      state: { ...plan.state, actedIds, selectedId },
      rewound: true,
      crossedRound: false
    };
  }

  const history = [...plan.state.history];
  const previousRound = history.pop();
  if (!previousRound?.order?.length) {
    return { state: plan.state, rewound: false, crossedRound: false };
  }

  return {
    state: {
      ...plan.state,
      round: previousRound.round,
      actedIds: previousRound.order.slice(0, -1),
      selectedId: previousRound.order.at(-1) ?? null,
      history
    },
    rewound: true,
    crossedRound: true
  };
}

function getNextInitiativeSide(readySlots, actedIds, slotById, startingSide) {
  if (!readySlots.length) return null;
  const availableSides = new Set(readySlots.map((slot) => slot.side));
  if (!actedIds.length) {
    return availableSides.has(startingSide)
      ? startingSide
      : getOppositeInitiativeSide(startingSide);
  }

  const lastActedSlot = slotById.get(actedIds.at(-1));
  const oppositeSide = getOppositeInitiativeSide(lastActedSlot?.side ?? startingSide);
  if (availableSides.has(oppositeSide)) return oppositeSide;
  return availableSides.values().next().value ?? null;
}

function normalizeSlots(slots) {
  const seen = new Set();
  return (Array.isArray(slots) ? slots : [])
    .map((slot) => ({
      id: normalizeId(slot?.id),
      name: String(slot?.name ?? ''),
      side: normalizeInitiativeSide(slot?.side, INITIATIVE_SIDE_OPPONENTS),
      defeated: Boolean(slot?.defeated)
    }))
    .filter((slot) => {
      if (!slot.id || seen.has(slot.id)) return false;
      seen.add(slot.id);
      return true;
    })
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }) ||
        left.id.localeCompare(right.id)
    );
}

function normalizeHistory(history) {
  return (Array.isArray(history) ? history : [])
    .map((entry) => ({
      round: Math.max(1, Math.floor(Number(entry?.round) || 1)),
      order: normalizeIdList(entry?.order)
    }))
    .filter((entry) => entry.order.length)
    .slice(-INITIATIVE_HISTORY_LIMIT);
}

function normalizeIdList(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).map(normalizeId).filter((id) => {
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function normalizeId(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}
