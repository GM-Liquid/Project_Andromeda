import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.ActorSheet = class {};
globalThis.foundry = {
  utils: {
    mergeObject: (target, source) => ({ ...(target ?? {}), ...(source ?? {}) }),
    deepClone: (value) => JSON.parse(JSON.stringify(value ?? {})),
    duplicate: (value) => JSON.parse(JSON.stringify(value ?? {}))
  }
};
globalThis.game = {
  i18n: {
    localize: (key) => key,
    format: (key) => key
  },
  settings: {
    get: () => false
  },
  user: null
};
globalThis.CONFIG = {
  ProjectAndromeda: {
    abilities: {},
    abilityAbbreviations: {},
    skills: {}
  }
};
globalThis.$ = (target) => ({
  data: (key) => target?.data?.[key],
  closest: () => ({
    data: (key) => target?.closestData?.[key]
  })
});

const { ProjectAndromedaActorSheet } = await import('../sheets/actor-sheet.mjs');

function createSheetHarness() {
  const sheet = Object.create(ProjectAndromedaActorSheet.prototype);
  let created = null;

  sheet.actor = {
    uuid: 'Actor.test',
    async createEmbeddedDocuments(documentName, docs) {
      created = { documentName, docs };
    }
  };
  sheet._promptForItemType = async () => 'trait';

  return { sheet, getCreated: () => created };
}

test('value create button keeps using the value group even though abilities also create trait items', async () => {
  const { sheet, getCreated } = createSheetHarness();

  await sheet._onItemCreate({
    preventDefault() {},
    currentTarget: {
      data: {
        groupKey: 'personalityValues',
        type: 'trait'
      },
      closestData: {
        itemGroup: 'personalityValues'
      }
    }
  });

  assert.equal(getCreated()?.documentName, 'Item');
  assert.equal(getCreated()?.docs?.[0]?.type, 'trait');
  assert.equal(getCreated()?.docs?.[0]?.name, 'MY_RPG.ItemGroups.NewValue');
  assert.equal(getCreated()?.docs?.[0]?.system?.details?.personalityRole, 'value');
});

test('abilities create button uses the unified abilities label instead of the value label', async () => {
  const { sheet, getCreated } = createSheetHarness();

  await sheet._onItemCreate({
    preventDefault() {},
    currentTarget: {
      data: {
        groupKey: 'abilities',
        type: 'trait-source-ability'
      },
      closestData: {
        itemGroup: 'abilities'
      }
    }
  });

  assert.equal(getCreated()?.documentName, 'Item');
  assert.equal(getCreated()?.docs?.[0]?.type, 'trait');
  assert.equal(getCreated()?.docs?.[0]?.name, 'MY_RPG.ItemGroups.NewAbility');
  assert.equal(getCreated()?.docs?.[0]?.system?.details, undefined);
});
