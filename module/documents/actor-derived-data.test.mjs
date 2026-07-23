import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.Actor = class {
  constructor({ type = 'playerCharacter', system = {}, itemTypes = {} } = {}) {
    this.type = type;
    this.system = system;
    this.itemTypes = itemTypes;
    this.uuid = 'Actor.test';
  }

  prepareDerivedData() {}
};

globalThis.foundry = {
  utils: {
    duplicate(value) {
      return structuredClone(value);
    }
  }
};

const { ProjectAndromedaActor } = await import('./actor.mjs');

test('character base defenses remain independent from skill ranks and temporary defenses are derived', () => {
  const actor = new ProjectAndromedaActor({
    type: 'playerCharacter',
    system: {
      currentRank: 2,
      temphealth: 5,
      tempfortitude: 3,
      tempcontrol: 4,
      tempwill: 6,
      tempspeed: 9,
      progressPoints: 0,
      defenses: {
        fortitude: 4,
        control: 3,
        will: 2
      },
      skills: {
        moshch: { rank: 1, value: 2 },
        lovkost: { rank: 2, value: 0 },
        nablyudatelnost: { rank: 1, value: 3 },
        analiz: { rank: 2, value: 1 },
        dominirovanie: { rank: 1, value: 0 },
        rezonans: { rank: 1, value: 2 }
      },
      stress: { value: 0, max: 0 },
      forceShield: { value: 0, max: 0 }
    },
    itemTypes: {
      armor: [
        {
          system: {
            equipped: true,
            quantity: 1,
            itemFortitude: 2,
            itemControl: 1,
            itemWill: 5,
            itemShield: 4,
            itemSpeed: 7
          }
        }
      ]
    }
  });

  actor.prepareDerivedData();

  assert.equal(actor.system.defenses.fortitude, 4);
  assert.equal(actor.system.defenses.control, 3);
  assert.equal(actor.system.defenses.will, 2);
  assert.equal(actor.system.effectiveDefenses.fortitude, 7);
  assert.equal(actor.system.effectiveDefenses.control, 7);
  assert.equal(actor.system.effectiveDefenses.will, 8);
  assert.equal(actor.system.speed.value, 39);
  assert.equal(actor.system.stress.max, 15);
  assert.equal(actor.system.forceShield.max, 0);
});

test('character stress max follows actor type defaults', () => {
  const cases = [
    ['playerCharacter', 3, 15],
    ['minion', 3, 9],
    ['rankAndFile', 3, 21],
    ['elite', 1, 15],
    ['elite', 3, 50]
  ];

  for (const [type, currentRank, expectedStress] of cases) {
    const actor = new ProjectAndromedaActor({
      type,
      system: {
        currentRank,
        temphealth: 0,
        tempspeed: 0,
        progressPoints: 0,
        defenses: {},
        skills: {},
        stress: { value: 0, max: 0 },
        forceShield: { value: 0, max: 0 }
      },
      itemTypes: {}
    });

    actor.prepareDerivedData();

    assert.equal(actor.system.stress.max, expectedStress);
  }
});

test('advancement progress displays spent points from zero and keeps remaining budget separate', () => {
  const actor = new ProjectAndromedaActor({
    type: 'playerCharacter',
    system: {
      currentRank: 2,
      temphealth: 0,
      tempspeed: 0,
      progressPoints: 10,
      defenses: {},
      skills: {
        moshch: { rank: 1, value: 0 },
        lovkost: { rank: 1, value: 0 }
      },
      stress: { value: 0, max: 0 },
      forceShield: { value: 0, max: 0 }
    },
    itemTypes: {}
  });

  actor.prepareDerivedData();

  assert.equal(actor.system.advancement.totalSpent, 0);
  assert.equal(actor.system.advancement.remaining, 10);

  actor.system.skills.moshch.value = 3;
  actor.prepareDerivedData();

  assert.equal(actor.system.advancement.totalSpent, 3);
  assert.equal(actor.system.advancement.remaining, 7);
});

test('temporary stress and the archetype bonus add to stress max', () => {
  const actor = new ProjectAndromedaActor({
    type: 'playerCharacter',
    system: {
      currentRank: 2,
      temphealth: 5,
      tempspeed: 0,
      progressPoints: 0,
      defenses: {},
      skills: {},
      stress: { value: 0, max: 0 },
      forceShield: { value: 0, max: 0 }
    },
    itemTypes: {
      archetype: [
        {
          system: {
            stressBonusPerRank: 2
          }
        }
      ]
    }
  });

  actor.prepareDerivedData();

  assert.equal(actor.system.stress.max, 19);
});

test('temporary parameters accept penalties', () => {
  const actor = new ProjectAndromedaActor({
    type: 'playerCharacter',
    system: {
      currentRank: 2,
      temphealth: -10,
      tempfortitude: -2,
      tempcontrol: -10,
      tempwill: 3,
      tempspeed: -35,
      progressPoints: 0,
      defenses: {
        fortitude: 4,
        control: 3,
        will: 2
      },
      skills: {},
      speed: { value: 0 },
      stress: { value: 0, max: 0 },
      forceShield: { value: 0, max: 0 }
    },
    itemTypes: {}
  });

  actor.prepareDerivedData();

  assert.equal(actor.system.temphealth, -10);
  assert.equal(actor.system.tempfortitude, -2);
  assert.equal(actor.system.tempcontrol, -10);
  assert.equal(actor.system.tempwill, 3);
  assert.equal(actor.system.tempspeed, -35);
  assert.equal(actor.system.stress.max, 0);
  assert.equal(actor.system.speed.value, -5);
  assert.equal(actor.system.effectiveDefenses.fortitude, 2);
  assert.equal(actor.system.effectiveDefenses.control, 0);
  assert.equal(actor.system.effectiveDefenses.will, 5);
});

test('movement speed uses rank defaults with additive bonuses', () => {
  const cases = [
    [1, 10],
    [2, 30],
    [3, 100],
    [4, 300],
    [5, 1000]
  ];

  for (const [currentRank, expectedSpeed] of cases) {
    const actor = new ProjectAndromedaActor({
      type: 'playerCharacter',
      system: {
        currentRank,
        temphealth: 0,
        tempspeed: 0,
        progressPoints: 0,
        defenses: {},
        skills: {},
        speed: { value: 0 },
        stress: { value: 0, max: 0 },
        forceShield: { value: 0, max: 0 }
      },
      itemTypes: {}
    });

    actor.prepareDerivedData();

    assert.equal(actor.system.speed.value, expectedSpeed);
  }

  const actor = new ProjectAndromedaActor({
    type: 'playerCharacter',
    system: {
      currentRank: 2,
      temphealth: 0,
      tempspeed: 5,
      progressPoints: 0,
      defenses: {},
      skills: {},
      speed: { value: 0 },
      stress: { value: 0, max: 0 },
      forceShield: { value: 0, max: 0 }
    },
    itemTypes: {
      armor: [
        {
          system: {
            equipped: true,
            quantity: 1,
            itemSpeed: 7
          }
        }
      ]
    }
  });

  actor.prepareDerivedData();

  assert.equal(actor.system.speed.value, 35);
});
