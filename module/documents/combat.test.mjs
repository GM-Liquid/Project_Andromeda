import assert from 'node:assert/strict';
import test from 'node:test';

class FakeCombat {
  constructor(combatants) {
    this.flags = {};
    this.round = 0;
    this.turn = null;
    this.combatants = new Map(combatants.map((combatant) => [combatant.id, combatant]));
    Object.defineProperty(this.combatants, 'contents', {
      get: () => Array.from(this.combatants.values())
    });
    this.turns = [];
    this.current = null;
    this.previous = null;
  }

  get started() {
    return this.round > 0;
  }

  get combatant() {
    return this.turns[this.turn] ?? null;
  }

  getFlag(scope, key) {
    return this.flags[scope]?.[key];
  }

  async setFlag(scope, key, value) {
    this.flags[scope] ??= {};
    this.flags[scope][key] = value;
    this.setupTurns();
    return this;
  }

  async update(changes) {
    for (const [path, value] of Object.entries(changes)) {
      if (path.startsWith('flags.')) {
        const [, scope, key] = path.split('.');
        this.flags[scope] ??= {};
        this.flags[scope][key] = value;
      } else {
        this[path] = value;
      }
    }
    this.current = this._getCurrentState();
    return this;
  }

  async startCombat() {
    this.round = 1;
    this.turn = 0;
    this.setupTurns();
    return this;
  }

  async nextTurn() {
    this.turn += 1;
    return this;
  }

  async previousTurn() {
    this.turn = Math.max(0, this.turn - 1);
    return this;
  }

  async nextRound() {
    this.round += 1;
    this.turn = 0;
    return this;
  }

  async resetAll() {
    this.round = 0;
    this.turn = null;
    return this;
  }

  _getCurrentState(combatant = this.combatant) {
    return {
      round: this.round,
      turn: this.turn,
      combatantId: combatant?.id ?? null
    };
  }
}

globalThis.Combat = FakeCombat;
globalThis.game = {
  i18n: { localize: (key) => key }
};
globalThis.ui = { notifications: { info: () => {} } };
globalThis.Hooks = { callAll: () => {} };

const { ProjectAndromedaCombat } = await import('./combat.mjs');

function makeCombatant(id, name, actorType, disposition) {
  return {
    id,
    name,
    actor: { type: actorType },
    token: { disposition },
    defeated: false,
    flags: {},
    getFlag(scope, key) {
      return this.flags[scope]?.[key];
    },
    async setFlag(scope, key, value) {
      this.flags[scope] ??= {};
      this.flags[scope][key] = value;
      return this;
    }
  };
}

test('setupTurns fulfills the Foundry contract when its return value is ignored', () => {
  const combat = new ProjectAndromedaCombat([
    makeCombatant('h1', 'Hero', 'playerCharacter', 1),
    makeCombatant('o1', 'Opponent', 'elite', -1)
  ]);
  combat.round = 1;
  combat.turn = 0;

  combat.setupTurns();

  assert.deepEqual(
    combat.turns.map((combatant) => combatant.id),
    ['h1', 'o1']
  );
  assert.equal(combat.current.combatantId, 'h1');
  assert.equal(combat.previous.combatantId, 'h1');

  combat.combatants.set('h2', makeCombatant('h2', 'Second Hero', 'playerCharacter', 1));
  combat.setupTurns();
  assert.equal(combat.turns.length, 3);
});

test('Combat document follows the selected alternating order and starts each round on one side', async () => {
  const combat = new ProjectAndromedaCombat([
    makeCombatant('h1', 'Alpha', 'playerCharacter', 1),
    makeCombatant('h2', 'Beta', 'playerCharacter', 1),
    makeCombatant('o1', 'Drone', 'minion', -1),
    makeCombatant('o2', 'Elite', 'elite', -1)
  ]);

  await combat.startCombat();
  assert.equal(combat.combatant.id, 'h1');

  await combat.chooseAndromedaCombatant('h2');
  assert.equal(combat.combatant.id, 'h2');

  await combat.nextTurn();
  assert.equal(combat.combatant.id, 'o1');
  await combat.chooseAndromedaCombatant('o2');
  await combat.nextTurn();
  assert.equal(combat.combatant.id, 'h1');

  await combat.nextTurn();
  assert.equal(combat.combatant.id, 'o1');
  await combat.nextTurn();
  assert.equal(combat.round, 2);
  assert.equal(combat.combatant.id, 'h1');
});

test('next turn returns to the remaining hero after a single opponent acts', async () => {
  const combat = new ProjectAndromedaCombat([
    makeCombatant('h1', 'First Hero', 'playerCharacter', 1),
    makeCombatant('h2', 'Second Hero', 'playerCharacter', 1),
    makeCombatant('o1', 'Mech', 'elite', -1)
  ]);

  await combat.startCombat();
  assert.equal(combat.combatant.id, 'h1');

  await combat.nextTurn();
  assert.equal(combat.combatant.id, 'o1');
  assert.equal(combat.getAndromedaInitiativePlan().nextSide, 'opponents');

  await combat.nextTurn();
  assert.equal(combat.combatant.id, 'h2');
  assert.equal(combat.getAndromedaInitiativePlan().nextSide, 'heroes');
});

test('Combat document can keep opponents as the starting side', async () => {
  const combat = new ProjectAndromedaCombat([
    makeCombatant('h1', 'Hero', 'playerCharacter', 1),
    makeCombatant('o1', 'Opponent', 'elite', -1)
  ]);

  await combat.setAndromedaStartingSide('opponents');
  await combat.startCombat();
  assert.equal(combat.combatant.id, 'o1');
  await combat.nextTurn();
  await combat.nextTurn();
  assert.equal(combat.round, 2);
  assert.equal(combat.combatant.id, 'o1');
});
