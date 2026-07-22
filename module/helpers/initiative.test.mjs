import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INITIATIVE_SIDE_HEROES,
  INITIATIVE_SIDE_OPPONENTS,
  advanceInitiativeTurn,
  buildInitiativeTurnPlan,
  createInitiativeState,
  getCombatantInitiativeSide,
  rewindInitiativeTurn,
  selectInitiativeCombatant
} from './initiative.mjs';

const hero = (id, name = id, defeated = false) => ({
  id,
  name,
  side: INITIATIVE_SIDE_HEROES,
  defeated
});
const opponent = (id, name = id, defeated = false) => ({
  id,
  name,
  side: INITIATIVE_SIDE_OPPONENTS,
  defeated
});

test('classifies player characters and friendly NPCs as heroes', () => {
  assert.equal(
    getCombatantInitiativeSide({ actorType: 'playerCharacter', tokenDisposition: -1 }),
    INITIATIVE_SIDE_HEROES
  );
  assert.equal(
    getCombatantInitiativeSide({ actorType: 'elite', tokenDisposition: 1 }),
    INITIATIVE_SIDE_HEROES
  );
  assert.equal(
    getCombatantInitiativeSide({ actorType: 'elite', tokenDisposition: -1 }),
    INITIATIVE_SIDE_OPPONENTS
  );
});

test('explicit side override takes priority over actor type and disposition', () => {
  assert.equal(
    getCombatantInitiativeSide({
      actorType: 'playerCharacter',
      tokenDisposition: 1,
      sideOverride: INITIATIVE_SIDE_OPPONENTS
    }),
    INITIATIVE_SIDE_OPPONENTS
  );
});

test('alternates sides while allowing a free choice within the eligible side', () => {
  const slots = [hero('h1', 'Alpha'), hero('h2', 'Beta'), opponent('o1'), opponent('o2')];
  let state = createInitiativeState();

  let plan = buildInitiativeTurnPlan(slots, state);
  assert.deepEqual(plan.eligibleIds, ['h1', 'h2']);

  state = selectInitiativeCombatant(slots, state, 'h2');
  plan = buildInitiativeTurnPlan(slots, state);
  assert.equal(plan.currentId, 'h2');

  state = advanceInitiativeTurn(slots, state, 'h2').state;
  plan = buildInitiativeTurnPlan(slots, state);
  assert.deepEqual(plan.eligibleIds, ['o1', 'o2']);

  state = advanceInitiativeTurn(slots, state, 'o1').state;
  assert.deepEqual(buildInitiativeTurnPlan(slots, state).eligibleIds, ['h1']);
});

test('the larger side takes its remaining tail turns in any order', () => {
  const slots = [hero('h1'), hero('h2'), hero('h3'), opponent('o1')];
  let state = createInitiativeState();

  state = advanceInitiativeTurn(slots, state, 'h1').state;
  state = advanceInitiativeTurn(slots, state, 'o1').state;
  assert.deepEqual(buildInitiativeTurnPlan(slots, state).eligibleIds, ['h2', 'h3']);

  state = advanceInitiativeTurn(slots, state, 'h3').state;
  assert.deepEqual(buildInitiativeTurnPlan(slots, state).eligibleIds, ['h2']);
});

test('the starting side remains the same after a completed round', () => {
  const slots = [hero('h1'), opponent('o1')];
  let state = createInitiativeState({ startingSide: INITIATIVE_SIDE_OPPONENTS });

  state = advanceInitiativeTurn(slots, state, 'o1').state;
  const result = advanceInitiativeTurn(slots, state, 'h1');
  assert.equal(result.roundComplete, true);
  assert.equal(result.state.round, 2);
  assert.deepEqual(buildInitiativeTurnPlan(slots, result.state).eligibleIds, ['o1']);
});

test('defeated combatants are displayed but skipped', () => {
  const slots = [hero('h1', 'Hero', true), opponent('o1')];
  const plan = buildInitiativeTurnPlan(slots, createInitiativeState());
  assert.deepEqual(plan.eligibleIds, ['o1']);
  assert.deepEqual(plan.orderedIds, ['o1', 'h1']);
});

test('duplicate token slots behave as separate boss turns', () => {
  const slots = [hero('h1'), opponent('boss-1'), opponent('boss-2')];
  let state = createInitiativeState();
  state = advanceInitiativeTurn(slots, state, 'h1').state;
  state = advanceInitiativeTurn(slots, state, 'boss-1').state;
  assert.deepEqual(buildInitiativeTurnPlan(slots, state).eligibleIds, ['boss-2']);
});

test('rewinding restores the previous participant and can cross a round boundary', () => {
  const slots = [hero('h1'), opponent('o1')];
  let state = createInitiativeState();
  state = advanceInitiativeTurn(slots, state, 'h1').state;
  state = advanceInitiativeTurn(slots, state, 'o1').state;

  const rewind = rewindInitiativeTurn(slots, state);
  assert.equal(rewind.crossedRound, true);
  assert.equal(rewind.state.round, 1);
  assert.equal(buildInitiativeTurnPlan(slots, rewind.state).currentId, 'o1');
});
