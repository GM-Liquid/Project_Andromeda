import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.Combat = class {};
globalThis.game = { combats: { viewed: { id: 'legacy-viewed' } } };

const { getViewedCombat, isCombatTrackerApplication, renderAndromedaCombatTracker } =
  await import('./combat-tracker.mjs');

class CombatTracker {
  static tabName = 'combat';

  constructor(viewed) {
    this.viewed = viewed;
  }
}

class ActorSheet {
  constructor(viewed) {
    this.viewed = viewed;
  }
}

function makeRoot() {
  return {
    nodeType: 1,
    queryCount: 0,
    querySelectorAll() {
      this.queryCount += 1;
      return [];
    }
  };
}

test('tracker helpers reject unrelated ApplicationV2 windows', () => {
  const combat = { id: 'active' };
  const sheet = new ActorSheet(combat);
  const root = makeRoot();

  assert.equal(isCombatTrackerApplication(sheet), false);
  assert.equal(getViewedCombat(sheet), null);
  renderAndromedaCombatTracker(sheet, root);
  assert.equal(root.queryCount, 0);
});

test('No Encounter remains empty instead of falling back to game.combat', () => {
  const tracker = new CombatTracker(null);
  const root = makeRoot();

  assert.equal(isCombatTrackerApplication(tracker), true);
  assert.equal(getViewedCombat(tracker), null);
  renderAndromedaCombatTracker(tracker, root);
  assert.equal(root.queryCount, 1);
});

test('tracker helpers use the explicitly viewed encounter', () => {
  const combat = { id: 'viewed' };
  const tracker = new CombatTracker(combat);
  assert.equal(getViewedCombat(tracker), combat);
});