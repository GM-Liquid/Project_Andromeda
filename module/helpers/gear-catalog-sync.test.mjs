import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyGearCatalogImport,
  buildGearCatalogRemoteDataFromCatalogs
} from './gear-catalog-sync.mjs';

function getSystemData(row) {
  return JSON.parse(row.systemJson);
}

test('gear catalog sync maps activation metadata for abilities, equipment, and armor', () => {
  const remoteData = buildGearCatalogRemoteDataFromCatalogs({
    abilities: [
      {
        id: 'gravity-snare',
        name: 'Gravity Snare',
        type: 'ability',
        rank: 2,
        skill: 'mistika',
        description: 'Locks a target in place.',
        mechanics: {
          effects: [
            {
              activation: { type: 'action' },
              conditions: {
                frequency: 'oncePerScene',
                range: { type: 'meters', value: 30 },
                targets: 'single',
                defense: 'fortitude',
                duration: 'untilEndOfScene',
                check: 'required'
              }
            }
          ]
        }
      }
    ],
    equipment: [
      {
        id: 'shock-mine',
        name: 'Shock Mine',
        type: 'equipment',
        rank: 2,
        skill: 'inzheneriya',
        description: 'Shocks every target in the blast.',
        mechanics: {
          effects: [
            {
              activation: { type: 'maneuver' },
              conditions: {
                frequency: 'oncePerSession',
                range: { type: 'meters', value: 20 },
                targets: 'allInArea',
                area: { type: 'circle', value: 10 },
                defense: 'control',
                duration: 'untilStartOfYourNextTurn'
              },
              outcomes: [{ key: 'damage', value: 4 }]
            }
          ]
        }
      }
    ],
    armor: [
      {
        id: 'reactive-shell',
        name: 'Reactive Shell',
        type: 'armor',
        rank: 3,
        skill: null,
        description: 'A reactive shell that shrugs off incoming fire.',
        mechanics: {
          effects: [
            {
              activation: { type: 'reaction' },
              conditions: {
                frequency: 'oncePerScene',
                targets: 'self',
                duration: 'untilEndOfTurn'
              },
              outcomes: [{ key: 'fortitudeBonus', value: 2 }]
            }
          ]
        }
      }
    ]
  });

  const abilityData = getSystemData(remoteData.sheets.abilities[0]);
  assert.equal(abilityData.activationCost, 'action');
  assert.equal(abilityData.activationType, 'action');
  assert.equal(abilityData.usageFrequency, 'scene');
  assert.equal(abilityData.range, '30 m');
  assert.equal(abilityData.targets, 'single');
  assert.equal(abilityData.defense, 'fortitude');
  assert.equal(abilityData.duration, 'untilEndOfScene');

  const equipmentData = getSystemData(remoteData.sheets.equipment[0]);
  assert.equal(equipmentData.activationCost, 'maneuver');
  assert.equal(equipmentData.activationType, 'maneuver');
  assert.equal(equipmentData.usageFrequency, 'twoPerScene');
  assert.equal(equipmentData.range, '20 m');
  assert.equal(equipmentData.targets, 'allInArea');
  assert.equal(equipmentData.area, 'circle 10 m');
  assert.equal(equipmentData.defense, 'control');
  assert.equal(equipmentData.duration, 'untilStartOfYourNextTurn');

  const armorData = getSystemData(remoteData.sheets.armor[0]);
  assert.equal(armorData.activationCost, 'reaction');
  assert.equal(armorData.activationType, 'reaction');
  assert.equal(armorData.usageFrequency, 'scene');
  assert.equal(armorData.targets, 'self');
  assert.equal(armorData.duration, 'untilEndOfTurn');
});

test('gear catalog sync preserves freeAction abilities as freeAction activation cost', () => {
  const remoteData = buildGearCatalogRemoteDataFromCatalogs({
    armor: [],
    equipment: [],
    abilities: [
      {
        id: 'desh',
        name: 'Дэш',
        type: 'ability',
        rank: 1,
        skill: 'lovkost',
        description: 'Dash forward.',
        mechanics: {
          effects: [
            {
              activation: { type: 'freeAction' },
              conditions: {
                frequency: 'oncePerScene',
                range: { type: 'meters', value: 15 }
              },
              outcomes: [{ key: 'specialRule' }]
            }
          ]
        }
      }
    ]
  });

  const abilityData = getSystemData(remoteData.sheets.abilities[0]);
  assert.equal(abilityData.activationCost, 'freeAction');
  assert.equal(abilityData.activationType, 'freeAction');
  assert.equal(abilityData.usageFrequency, 'scene');
  assert.equal(abilityData.range, '15 m');
  assert.equal(abilityData.requiresRoll, false);
});

test('gear catalog apply updates existing world abilities with full system replacement', async (t) => {
  const previousGlobals = {
    CONFIG: globalThis.CONFIG,
    Folder: globalThis.Folder,
    Item: globalThis.Item,
    fetch: globalThis.fetch,
    foundry: globalThis.foundry,
    game: globalThis.game,
    ui: globalThis.ui
  };

  t.after(() => {
    for (const [key, value] of Object.entries(previousGlobals)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });

  const itemUpdateCalls = [];
  const updateDocumentsCalls = [];
  const itemFolders = [];

  const existingItem = {
    id: 'VfRoDu6ki5XyhReS',
    type: 'trait-source-ability',
    name: 'Тень служит',
    img: 'icons/svg/item-bag.svg',
    sort: 0,
    folder: null,
    system: {
      activationCost: 'passive',
      activationType: 'passive',
      usageFrequency: 'passive',
      requiresRoll: true,
      skill: 'mistika',
      description: 'Old description.',
      details: {
        gearCatalog: {
          id: 'ten-sluzhit',
          catalog: 'abilities'
        }
      }
    },
    flags: {
      'project-andromeda': {
        sheetSyncId: 'gear:abilities:ten-sluzhit'
      }
    },
    uuid: 'Item.VfRoDu6ki5XyhReS',
    getFlag(moduleId, flagKey) {
      return this.flags?.[moduleId]?.[flagKey];
    },
    async update(data, options) {
      itemUpdateCalls.push({ data, options });
      this.name = data.name;
      this.img = data.img;
      this.folder = data.folder;
      this.sort = data.sort;
      this.system = structuredClone(data.system);
      this.flags['project-andromeda'].sheetSyncId =
        data['flags.project-andromeda.sheetSyncId'];
      return this;
    }
  };

  globalThis.CONFIG = {
    ProjectAndromeda: {
      skills: {
        mistika: 'MY_RPG.Skills.Mistika'
      }
    }
  };

  globalThis.foundry = {
    utils: {
      deepClone: (value) => structuredClone(value),
      diffObject: (left, right) => (JSON.stringify(left) === JSON.stringify(right) ? {} : { changed: true }),
      flattenObject: (value) => value,
      randomID: () => 'random-id',
      setProperty(target, path, value) {
        const segments = String(path).split('.');
        let cursor = target;
        while (segments.length > 1) {
          const segment = segments.shift();
          cursor[segment] ??= {};
          cursor = cursor[segment];
        }
        cursor[segments[0]] = value;
        return target;
      }
    }
  };

  globalThis.game = {
    actors: { contents: [] },
    folders: { contents: itemFolders },
    i18n: {
      localize: (key) => key,
      format: (key, data = {}) => `${key}:${JSON.stringify(data)}`
    },
    items: { contents: [existingItem] },
    system: { version: '0.3.5.1' },
    user: { id: '1', isGM: true },
    users: [{ id: '1', isGM: true, active: true }]
  };

  globalThis.ui = {
    items: { render() {} },
    sidebar: { tabs: { items: { render() {} } } }
  };

  globalThis.Folder = {
    async create(data) {
      const createdFolder = {
        id: `${String(data.name).toLowerCase()}-${itemFolders.length + 1}`,
        name: data.name,
        type: data.type,
        folder: data.folder ?? null
      };
      itemFolders.push(createdFolder);
      return createdFolder;
    }
  };

  globalThis.Item = {
    async createDocuments() {
      return [];
    },
    async updateDocuments(documents, options) {
      updateDocumentsCalls.push({ documents, options });
      return [];
    }
  };

  const catalogs = {
    armor: [],
    equipment: [],
    abilities: [
      {
        id: 'ten-sluzhit',
        name: 'Тень служит',
        type: 'ability',
        rank: 2,
        skill: 'mistika',
        description:
          'Оставьте свою тень в текущем местоположении. Один раз до конца сцены вы можете манёвром поменяться с ней местами, если вы и тень всё ещё находитесь в рамках одной сцены.',
        mechanics: {
          effects: [
            {
              activation: { type: 'freeAction' },
              conditions: {
                frequency: 'oncePerScene',
                targets: 'self',
                duration: 'untilEndOfScene'
              },
              outcomes: [{ key: 'createShadowAnchor' }]
            }
          ]
        }
      }
    ]
  };

  globalThis.fetch = async (url) => {
    const filename = String(url).split('/').pop();
    const key = filename.replace(/\.json$/i, '');
    return {
      ok: true,
      async json() {
        return catalogs[key];
      }
    };
  };

  const result = await applyGearCatalogImport();

  assert.equal(result.plan.summary.update, 1);
  assert.equal(updateDocumentsCalls.length, 0);
  assert.equal(itemUpdateCalls.length, 1);
  assert.equal(itemUpdateCalls[0].options.render, false);
  assert.equal(itemUpdateCalls[0].options.diff, false);
  assert.equal(itemUpdateCalls[0].data._id, existingItem.id);
  assert.equal(itemUpdateCalls[0].data.system.requiresRoll, false);
  assert.equal(itemUpdateCalls[0].data.system.usageFrequency, 'scene');
  assert.equal(itemUpdateCalls[0].data.system.activationCost, 'freeAction');
});

test('gear catalog apply prefers linked duplicate world items when sync ids collide', async (t) => {
  const previousGlobals = {
    CONFIG: globalThis.CONFIG,
    Folder: globalThis.Folder,
    Item: globalThis.Item,
    fetch: globalThis.fetch,
    foundry: globalThis.foundry,
    game: globalThis.game,
    ui: globalThis.ui
  };

  t.after(() => {
    for (const [key, value] of Object.entries(previousGlobals)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });

  const linkedItemUpdateCalls = [];
  const unlinkedItemUpdateCalls = [];
  const itemFolders = [];

  const linkedWorldItem = {
    id: 'linked-world-item',
    type: 'trait-source-ability',
    name: 'Dash',
    img: 'icons/svg/item-bag.svg',
    sort: 0,
    folder: null,
    system: {
      activationCost: 'passive',
      activationType: 'action',
      usageFrequency: 'passive',
      requiresRoll: true,
      skill: 'lovkost',
      description: 'Old linked description.',
      details: {
        gearCatalog: {
          id: 'desh',
          catalog: 'abilities'
        }
      }
    },
    flags: {
      'project-andromeda': {
        sheetSyncId: 'gear:abilities:desh'
      }
    },
    uuid: 'Item.linked-world-item',
    getFlag(moduleId, flagKey) {
      return this.flags?.[moduleId]?.[flagKey];
    },
    async update(data, options) {
      linkedItemUpdateCalls.push({ data, options });
      this.system = structuredClone(data.system);
      return this;
    }
  };

  const unlinkedWorldItem = {
    id: 'unlinked-world-item',
    type: 'trait-source-ability',
    name: 'Dash',
    img: 'icons/svg/item-bag.svg',
    sort: 1,
    folder: null,
    system: {
      activationCost: 'passive',
      activationType: 'action',
      usageFrequency: 'passive',
      requiresRoll: true,
      skill: 'lovkost',
      description: 'Old unlinked description.',
      details: {
        gearCatalog: {
          id: 'desh',
          catalog: 'abilities'
        }
      }
    },
    flags: {
      'project-andromeda': {
        sheetSyncId: 'gear:abilities:desh'
      }
    },
    uuid: 'Item.unlinked-world-item',
    getFlag(moduleId, flagKey) {
      return this.flags?.[moduleId]?.[flagKey];
    },
    async update(data, options) {
      unlinkedItemUpdateCalls.push({ data, options });
      this.system = structuredClone(data.system);
      return this;
    }
  };

  globalThis.CONFIG = {
    ProjectAndromeda: {
      skills: {
        lovkost: 'MY_RPG.Skills.Lovkost'
      }
    }
  };

  globalThis.foundry = {
    utils: {
      deepClone: (value) => structuredClone(value),
      diffObject: (left, right) =>
        JSON.stringify(left) === JSON.stringify(right) ? {} : { changed: true },
      flattenObject: (value) => value,
      randomID: () => 'random-id',
      setProperty(target, path, value) {
        const segments = String(path).split('.');
        let cursor = target;
        while (segments.length > 1) {
          const segment = segments.shift();
          cursor[segment] ??= {};
          cursor = cursor[segment];
        }
        cursor[segments[0]] = value;
        return target;
      }
    }
  };

  globalThis.game = {
    actors: {
      contents: [
        {
          name: 'Burkhard',
          items: [
            {
              flags: {
                'project-andromeda': {
                  libraryItemUuid: linkedWorldItem.uuid
                }
              },
              getFlag(moduleId, flagKey) {
                return this.flags?.[moduleId]?.[flagKey];
              }
            }
          ]
        }
      ]
    },
    folders: { contents: itemFolders },
    i18n: {
      localize: (key) => key,
      format: (key, data = {}) => `${key}:${JSON.stringify(data)}`
    },
    items: { contents: [linkedWorldItem, unlinkedWorldItem] },
    system: { version: '0.3.6.1' },
    user: { id: '1', isGM: true },
    users: [{ id: '1', isGM: true, active: true }]
  };

  globalThis.ui = {
    items: { render() {} },
    sidebar: { tabs: { items: { render() {} } } }
  };

  globalThis.Folder = {
    async create(data) {
      const createdFolder = {
        id: `${String(data.name).toLowerCase()}-${itemFolders.length + 1}`,
        name: data.name,
        type: data.type,
        folder: data.folder ?? null
      };
      itemFolders.push(createdFolder);
      return createdFolder;
    }
  };

  globalThis.Item = {
    async createDocuments() {
      return [];
    }
  };

  const catalogs = {
    armor: [],
    equipment: [],
    abilities: [
      {
        id: 'desh',
        name: 'Dash',
        type: 'ability',
        rank: 1,
        skill: 'lovkost',
        description: 'Dash forward.',
        mechanics: {
          effects: [
            {
              activation: { type: 'freeAction' },
              conditions: {
                frequency: 'oncePerScene',
                range: { type: 'meters', value: 15 }
              },
              outcomes: [{ key: 'specialRule' }]
            }
          ]
        }
      }
    ]
  };

  globalThis.fetch = async (url) => {
    const filename = String(url).split('/').pop();
    const key = filename.replace(/\.json$/i, '');
    return {
      ok: true,
      async json() {
        return catalogs[key];
      }
    };
  };

  const result = await applyGearCatalogImport();

  assert.equal(result.plan.summary.update, 1);
  assert.equal(result.applied.updatedCount, 1);
  assert.equal(result.applied.refreshedActorCount, 1);
  assert.equal(linkedItemUpdateCalls.length, 1);
  assert.equal(unlinkedItemUpdateCalls.length, 0);
  assert.equal(linkedItemUpdateCalls[0].data._id, linkedWorldItem.id);
  assert.equal(linkedItemUpdateCalls[0].data.system.activationCost, 'freeAction');
  assert.equal(linkedItemUpdateCalls[0].data.system.requiresRoll, false);
  assert.equal(linkedItemUpdateCalls[0].data.system.usageFrequency, 'scene');
});
