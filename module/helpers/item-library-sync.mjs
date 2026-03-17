import {
  ITEM_LIBRARY_SYNC_MIGRATION_SETTING,
  ITEM_LIBRARY_SYNC_MIGRATION_VERSION,
  MODULE_ID,
  debugLog
} from '../config.mjs';
import { getItemGroupConfigs } from './item-config.mjs';

const LIBRARY_SYNC_OPTION_KEY = 'projectAndromedaLibrarySync';
const LIBRARY_ITEM_UUID_FLAG = 'libraryItemUuid';
const LOCAL_SYSTEM_FIELDS = new Set(['equipped', 'quantity']);
const SYNCED_ITEM_TYPES = new Set(getItemGroupConfigs().flatMap((config) => config.types));

function deepClone(value) {
  return foundry.utils.deepClone(value);
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortValue(entry));
  }

  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .reduce((accumulator, key) => {
        accumulator[key] = sortValue(value[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function stripLocalSystemFields(systemData = {}) {
  const cloned = deepClone(systemData);
  for (const field of LOCAL_SYSTEM_FIELDS) {
    delete cloned[field];
  }
  return cloned;
}

function preserveLocalSystemFields(systemData = {}) {
  const preserved = {};
  for (const field of LOCAL_SYSTEM_FIELDS) {
    if (!foundry.utils.hasProperty(systemData, field)) continue;
    preserved[field] = deepClone(systemData[field]);
  }
  return preserved;
}

function buildSharedItemPayload(item) {
  return {
    name: String(item?.name ?? ''),
    type: String(item?.type ?? ''),
    img: String(item?.img ?? ''),
    system: stripLocalSystemFields(item?.system ?? {})
  };
}

function buildItemFingerprint(item) {
  return JSON.stringify(sortValue(buildSharedItemPayload(item)));
}

function getWorldItemFromUuid(uuid) {
  const normalized = String(uuid ?? '').trim();
  const match = /^Item\.([^.\s]+)$/.exec(normalized);
  if (!match) return null;
  return game.items?.get(match[1]) ?? null;
}

function collectActorUpdatesForLibraryUuid(libraryUuid, buildUpdate) {
  const normalizedUuid = String(libraryUuid ?? '').trim();
  const updatesByActor = new Map();
  if (!normalizedUuid) return updatesByActor;

  for (const actor of game.actors ?? []) {
    const updates = [];
    for (const item of actor.items ?? []) {
      if (getLibraryItemUuid(item) !== normalizedUuid) continue;
      const update = buildUpdate(item);
      if (!update) continue;
      updates.push({ _id: item.id, ...update });
    }
    if (updates.length) {
      updatesByActor.set(actor, updates);
    }
  }

  return updatesByActor;
}

export function getLibrarySyncOptionKey() {
  return LIBRARY_SYNC_OPTION_KEY;
}

export function getLibraryItemUuid(item) {
  const value =
    item?.getFlag?.(MODULE_ID, LIBRARY_ITEM_UUID_FLAG) ??
    item?.flags?.[MODULE_ID]?.[LIBRARY_ITEM_UUID_FLAG] ??
    '';
  return String(value ?? '').trim();
}

export function isLibrarySyncManagedType(type) {
  return SYNCED_ITEM_TYPES.has(type);
}

export function hasOnlyLocalItemChanges(changed = {}) {
  const flatChanges = foundry.utils.flattenObject(changed ?? {});
  const paths = Object.keys(flatChanges).filter((path) => path && !path.startsWith('_id'));
  if (!paths.length) return false;

  return paths.every((path) => {
    if (path === `flags.${MODULE_ID}.${LIBRARY_ITEM_UUID_FLAG}`) return true;
    if (path.startsWith('system.quantity')) return true;
    if (path.startsWith('system.equipped')) return true;
    return false;
  });
}

export function buildLibraryItemCreateData(actorItem) {
  const payload = buildSharedItemPayload(actorItem);
  return {
    name: payload.name,
    type: payload.type,
    img: payload.img,
    system: payload.system
  };
}

export function buildWorldItemUpdateData(actorItem) {
  const payload = buildSharedItemPayload(actorItem);
  return {
    name: payload.name,
    img: payload.img,
    system: payload.system
  };
}

export function buildActorItemUpdateDataFromLibrary(libraryItem, actorItem) {
  const payload = buildSharedItemPayload(libraryItem);
  foundry.utils.mergeObject(payload.system, preserveLocalSystemFields(actorItem?.system ?? {}), {
    insertKeys: true,
    overwrite: true,
    inplace: true
  });

  return {
    name: payload.name,
    img: payload.img,
    system: payload.system,
    [`flags.${MODULE_ID}.${LIBRARY_ITEM_UUID_FLAG}`]: libraryItem.uuid
  };
}

export function findMatchingWorldItem(sourceItem) {
  const fingerprint = buildItemFingerprint(sourceItem);
  for (const item of game.items ?? []) {
    if (item.type !== sourceItem.type) continue;
    if (buildItemFingerprint(item) === fingerprint) return item;
  }
  return null;
}

export function getLinkedWorldItem(item) {
  return getWorldItemFromUuid(getLibraryItemUuid(item));
}

export async function ensureActorItemLibraryLink(actorItem) {
  if (!actorItem?.parent || actorItem.parent.documentName !== 'Actor') {
    return { libraryItem: null, created: false, linked: false };
  }

  if (!isLibrarySyncManagedType(actorItem.type)) {
    return { libraryItem: null, created: false, linked: false };
  }

  let libraryItem = getLinkedWorldItem(actorItem);
  let created = false;
  let linked = false;

  if (!libraryItem) {
    libraryItem = findMatchingWorldItem(actorItem);
  }

  if (!libraryItem) {
    libraryItem = await Item.create(buildLibraryItemCreateData(actorItem), {
      render: false,
      [LIBRARY_SYNC_OPTION_KEY]: {
        source: 'actor-create-library'
      }
    });
    created = Boolean(libraryItem);
  }

  if (!libraryItem) {
    return { libraryItem: null, created, linked };
  }

  if (getLibraryItemUuid(actorItem) !== libraryItem.uuid) {
    await actorItem.update(
      {
        [`flags.${MODULE_ID}.${LIBRARY_ITEM_UUID_FLAG}`]: libraryItem.uuid
      },
      {
        render: false,
        [LIBRARY_SYNC_OPTION_KEY]: {
          source: 'actor-link-library'
        }
      }
    );
    linked = true;
  }

  return { libraryItem, created, linked };
}

export async function syncActorItemToLibrary(actorItem) {
  const { libraryItem } = await ensureActorItemLibraryLink(actorItem);
  if (!libraryItem) return null;

  await libraryItem.update(buildWorldItemUpdateData(actorItem), {
    render: false,
    [LIBRARY_SYNC_OPTION_KEY]: {
      source: 'actor-to-library'
    }
  });

  return libraryItem;
}

export async function syncLibraryItemToActors(libraryItem) {
  if (!libraryItem || !isLibrarySyncManagedType(libraryItem.type)) return 0;

  const updatesByActor = collectActorUpdatesForLibraryUuid(libraryItem.uuid, (actorItem) =>
    buildActorItemUpdateDataFromLibrary(libraryItem, actorItem)
  );

  let updatedCount = 0;
  for (const [actor, updates] of updatesByActor.entries()) {
    await actor.updateEmbeddedDocuments('Item', updates, {
      render: false,
      [LIBRARY_SYNC_OPTION_KEY]: {
        source: 'library-to-actor'
      }
    });
    updatedCount += updates.length;
  }

  return updatedCount;
}

export async function unlinkLibraryItemFromActors(libraryItem) {
  if (!libraryItem) return 0;

  const updatesByActor = collectActorUpdatesForLibraryUuid(libraryItem.uuid, () => ({
    [`flags.${MODULE_ID}.${LIBRARY_ITEM_UUID_FLAG}`]: null
  }));

  let updatedCount = 0;
  for (const [actor, updates] of updatesByActor.entries()) {
    await actor.updateEmbeddedDocuments('Item', updates, {
      render: false,
      [LIBRARY_SYNC_OPTION_KEY]: {
        source: 'library-delete-unlink'
      }
    });
    updatedCount += updates.length;
  }

  return updatedCount;
}

export async function migrateActorItemsToLibrary() {
  const summary = {
    actorsChecked: 0,
    itemsChecked: 0,
    linksCreated: 0,
    libraryItemsCreated: 0
  };

  for (const actor of game.actors ?? []) {
    summary.actorsChecked += 1;

    for (const item of actor.items ?? []) {
      if (!isLibrarySyncManagedType(item.type)) continue;
      summary.itemsChecked += 1;

      const result = await ensureActorItemLibraryLink(item);
      if (result.created) summary.libraryItemsCreated += 1;
      if (result.linked) summary.linksCreated += 1;
    }
  }

  debugLog('Actor item library migration completed', summary);
  return summary;
}

export async function runItemLibraryMigrationIfNeeded() {
  const currentVersion =
    Number(game.settings.get(MODULE_ID, ITEM_LIBRARY_SYNC_MIGRATION_SETTING)) || 0;
  if (currentVersion >= ITEM_LIBRARY_SYNC_MIGRATION_VERSION) return null;

  const summary = await migrateActorItemsToLibrary();
  await game.settings.set(
    MODULE_ID,
    ITEM_LIBRARY_SYNC_MIGRATION_SETTING,
    ITEM_LIBRARY_SYNC_MIGRATION_VERSION
  );
  return summary;
}
