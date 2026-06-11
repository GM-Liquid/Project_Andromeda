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

test('character derived data includes temporary bonuses in defenses, speed, and stress', () => {
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
      abilities: {
        con: { value: 8 },
        int: { value: 10 },
        spi: { value: '2d8' }
      },
      skills: {},
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

  assert.equal(actor.system.defenses.physical, 11);
  assert.equal(actor.system.defenses.azure, 12);
  assert.equal(actor.system.defenses.mental, 21);
  assert.equal(actor.system.speed.value, 66);
  assert.equal(actor.system.stress.max, 17);
  assert.equal(actor.system.forceShield.max, 4);
});
