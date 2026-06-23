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

test('character defenses remain independent from skill ranks', () => {
  const actor = new ProjectAndromedaActor({
    type: 'playerCharacter',
    system: {
      currentRank: 2,
      temphealth: 5,
      tempphys: 3,
      tempazure: 4,
      tempmental: 6,
      tempspeed: 9,
      progressPoints: 0,
      defenses: {
        physical: 4,
        azure: 3,
        mental: 2
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
            itemPhys: 2,
            itemAzure: 1,
            itemMental: 5,
            itemShield: 4,
            itemSpeed: 7
          }
        }
      ]
    }
  });

  actor.prepareDerivedData();

  assert.equal(actor.system.defenses.physical, 4);
  assert.equal(actor.system.defenses.azure, 3);
  assert.equal(actor.system.defenses.mental, 2);
  assert.equal(actor.system.speed.value, 66);
  assert.equal(actor.system.stress.max, 17);
  assert.equal(actor.system.forceShield.max, 4);
});
