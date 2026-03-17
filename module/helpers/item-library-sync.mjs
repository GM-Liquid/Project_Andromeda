import {
  ITEM_LIBRARY_SYNC_MIGRATION_SETTING,
  ITEM_LIBRARY_SYNC_MIGRATION_VERSION,
  MODULE_ID,
  debugLog
} from '../config.mjs';
import { getItemGroupConfigs } from './item-config.mjs';

const LIBRARY_SYNC_OPTION_KEY = 'projectAndromedaLibrarySync';
const LIBRARY_ITEM_UUID_FLAG = 'libraryItemUuid';
const LIBRARY_ACTOR_ID_FLAG = 'libraryActorId';
const LIBRARY_ACTOR_ITEM_ID_FLAG = 'libraryActorItemId';
const LOCAL_SYSTEM_FIELDS = new Set(['equipped', 'quantity']);
const SYNCED_ITEM_TYPES = new Set(getItemGroupConfigs().flatMap((config) => config.types));

function renderItemDirectory() {
  ui.items?.render?.(true);
  ui.sidebar?.tabs?.items?.render?.(true);
}

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

function sameValue(left, right) {
  return JSON.stringify(sortValue(left ?? {})) === JSON.stringify(sortValue(right ?? {}));
}

function getActors() {
  return game.actors?.contents ?? [];
}

function getWorldItems() {
  return game.items?.contents ?? [];
}

function getItemFolders() {
  return (game.folders?.contents ?? []).filter((folder) => folder.type === 'Item');
}

function getDocumentFolderId(document) {
  return String(document?.folder?.id ?? document?.folder ?? '').trim();
}

function buildActorOwnership(actor) {
  return deepClone(actor?.ownership ?? {});
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

function getWorldItemFromUuid(uuid) {
  const normalized = String(uuid ?? '').trim();
  const match = /^Item\.([^.\s]+)$/.exec(normalized);
  if (!match) return null;
  return game.items?.get(match[1]) ?? null;
}

function getLibraryActorId(document) {
  const value =
    document?.getFlag?.(MODULE_ID, LIBRARY_ACTOR_ID_FLAG) ??
    document?.flags?.[MODULE_ID]?.[LIBRARY_ACTOR_ID_FLAG] ??
    '';
  return String(value ?? '').trim();
}

function getLibraryActorItemId(document) {
  const value =
    document?.getFlag?.(MODULE_ID, LIBRARY_ACTOR_ITEM_ID_FLAG) ??
    document?.flags?.[MODULE_ID]?.[LIBRARY_ACTOR_ITEM_ID_FLAG] ??
    '';
  return String(value ?? '').trim();
}

function getActorLibraryFolder(actor) {
  const actorId = String(actor?.id ?? '').trim();
  if (!actorId) return null;
  return getItemFolders().find((folder) => getLibraryActorId(folder) === actorId) ?? null;
}

function getActorSpecificWorldItem(actorItem) {
  const actorId = String(actorItem?.parent?.id ?? '').trim();
  const actorItemId = String(actorItem?.id ?? '').trim();
  if (!actorId || !actorItemId) return null;

  return (
    getWorldItems().find(
      (item) =>
        item.type === actorItem.type &&
        getLibraryActorId(item) === actorId &&
        getLibraryActorItemId(item) === actorItemId
    ) ?? null
  );
}

function isLibraryItemOwnedByActorItem(libraryItem, actorItem) {
  return (
    getLibraryActorId(libraryItem) === String(actorItem?.parent?.id ?? '').trim() &&
    getLibraryActorItemId(libraryItem) === String(actorItem?.id ?? '').trim()
  );
}

function countLinkedActorItems(libraryUuid) {
  const normalizedUuid = String(libraryUuid ?? '').trim();
  if (!normalizedUuid) return 0;

  let count = 0;
  for (const actor of getActors()) {
    for (const item of actor.items ?? []) {
      if (getLibraryItemUuid(item) === normalizedUuid) count += 1;
    }
  }

  return count;
}

function buildFolderCreateData(actor) {
  return {
    name: String(actor?.name ?? '').trim() || String(actor?.id ?? ''),
    type: 'Item',
    ownership: buildActorOwnership(actor),
    flags: {
      [MODULE_ID]: {
        [LIBRARY_ACTOR_ID_FLAG]: actor.id
      }
    }
  };
}

function buildFolderUpdateData(actor, folder) {
  const update = {};
  const desiredName = String(actor?.name ?? '').trim() || String(actor?.id ?? '');
  const desiredOwnership = buildActorOwnership(actor);

  if (folder?.name !== desiredName) update.name = desiredName;
  if (!sameValue(folder?.ownership ?? {}, desiredOwnership)) update.ownership = desiredOwnership;
  if (getLibraryActorId(folder) !== String(actor?.id ?? '').trim()) {
    update[`flags.${MODULE_ID}.${LIBRARY_ACTOR_ID_FLAG}`] = actor.id;
  }

  return update;
}

async function ensureActorLibraryFolder(actor, options = {}) {
  const { renderDirectory = true } = options;
  if (!actor) return { folder: null, created: false, updated: false };

  let folder = getActorLibraryFolder(actor);
  if (!folder) {
    folder = await Folder.create(buildFolderCreateData(actor), {
      render: false,
      [LIBRARY_SYNC_OPTION_KEY]: {
        source: 'actor-folder-create'
      }
    });

    if (folder && renderDirectory) {
      renderItemDirectory();
    }

    return { folder, created: Boolean(folder), updated: false };
  }

  const update = buildFolderUpdateData(actor, folder);
  if (!Object.keys(update).length) {
    return { folder, created: false, updated: false };
  }

  await folder.update(update, {
    render: false,
    [LIBRARY_SYNC_OPTION_KEY]: {
      source: 'actor-folder-sync'
    }
  });

  if (renderDirectory) {
    renderItemDirectory();
  }

  return { folder, created: false, updated: true };
}

function buildLibraryItemCreateData(actorItem, folder) {
  const actor = actorItem.parent;
  const payload = buildSharedItemPayload(actorItem);

  return {
    name: payload.name,
    type: payload.type,
    img: payload.img,
    system: payload.system,
    folder: folder?.id ?? null,
    ownership: buildActorOwnership(actor),
    flags: {
      [MODULE_ID]: {
        [LIBRARY_ACTOR_ID_FLAG]: actor.id,
        [LIBRARY_ACTOR_ITEM_ID_FLAG]: actorItem.id
      }
    }
  };
}

function buildLibraryItemMetadataUpdate(actorItem, folder) {
  const actor = actorItem.parent;
  return {
    folder: folder?.id ?? null,
    ownership: buildActorOwnership(actor),
    [`flags.${MODULE_ID}.${LIBRARY_ACTOR_ID_FLAG}`]: actor.id,
    [`flags.${MODULE_ID}.${LIBRARY_ACTOR_ITEM_ID_FLAG}`]: actorItem.id
  };
}

function buildWorldItemUpdateData(actorItem, folder) {
  const payload = buildSharedItemPayload(actorItem);
  return {
    name: payload.name,
    img: payload.img,
    system: payload.system,
    ...buildLibraryItemMetadataUpdate(actorItem, folder)
  };
}

function buildActorItemUpdateDataFromLibrary(libraryItem, actorItem) {
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

function needsLibraryItemMetadataSync(libraryItem, actorItem, folder) {
  if (!libraryItem || !actorItem) return false;
  if (getDocumentFolderId(libraryItem) !== String(folder?.id ?? '').trim()) return true;
  if (!sameValue(libraryItem.ownership ?? {}, buildActorOwnership(actorItem.parent))) return true;
  if (!isLibraryItemOwnedByActorItem(libraryItem, actorItem)) return true;
  return false;
}

function collectActorUpdatesForLibraryUuid(libraryUuid, buildUpdate) {
  const normalizedUuid = String(libraryUuid ?? '').trim();
  const updatesByActor = new Map();
  if (!normalizedUuid) return updatesByActor;

  for (const actor of getActors()) {
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

export function getLinkedWorldItem(item) {
  return getWorldItemFromUuid(getLibraryItemUuid(item));
}

export async function ensureActorItemLibraryLink(actorItem, options = {}) {
  const { renderDirectory = true } = options;

  if (!actorItem?.parent || actorItem.parent.documentName !== 'Actor') {
    return { libraryItem: null, folder: null, created: false, linked: false };
  }

  if (!isLibrarySyncManagedType(actorItem.type)) {
    return { libraryItem: null, folder: null, created: false, linked: false };
  }

  const {
    folder,
    created: folderCreated,
    updated: folderUpdated
  } = await ensureActorLibraryFolder(actorItem.parent, { renderDirectory: false });

  let libraryItem = getLinkedWorldItem(actorItem);
  let created = false;
  let linked = false;
  let libraryItemUpdated = false;

  if (libraryItem && !isLibraryItemOwnedByActorItem(libraryItem, actorItem)) {
    if (countLinkedActorItems(libraryItem.uuid) <= 1) {
      await libraryItem.update(buildLibraryItemMetadataUpdate(actorItem, folder), {
        render: false,
        [LIBRARY_SYNC_OPTION_KEY]: {
          source: 'library-item-adopt'
        }
      });
      libraryItemUpdated = true;
    } else {
      libraryItem = null;
    }
  }

  if (!libraryItem) {
    libraryItem = getActorSpecificWorldItem(actorItem);
  }

  if (!libraryItem) {
    libraryItem = await Item.create(buildLibraryItemCreateData(actorItem, folder), {
      render: false,
      [LIBRARY_SYNC_OPTION_KEY]: {
        source: 'actor-create-library'
      }
    });
    created = Boolean(libraryItem);
  } else if (needsLibraryItemMetadataSync(libraryItem, actorItem, folder)) {
    await libraryItem.update(buildLibraryItemMetadataUpdate(actorItem, folder), {
      render: false,
      [LIBRARY_SYNC_OPTION_KEY]: {
        source: 'library-item-metadata-sync'
      }
    });
    libraryItemUpdated = true;
  }

  if (!libraryItem) {
    return { libraryItem: null, folder, created, linked };
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

  if (renderDirectory && (folderCreated || folderUpdated || created || libraryItemUpdated)) {
    renderItemDirectory();
  }

  return {
    libraryItem,
    folder,
    created,
    linked,
    folderCreated,
    folderUpdated,
    libraryItemUpdated
  };
}

export async function syncActorItemToLibrary(actorItem) {
  const { libraryItem, folder } = await ensureActorItemLibraryLink(actorItem);
  if (!libraryItem) return null;

  await libraryItem.update(buildWorldItemUpdateData(actorItem, folder), {
    render: false,
    [LIBRARY_SYNC_OPTION_KEY]: {
      source: 'actor-to-library'
    }
  });

  renderItemDirectory();

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

export async function syncActorLibraryStructure(actor, options = {}) {
  const { renderDirectory = true } = options;
  if (!actor) return { folder: null, foldersCreated: 0, foldersUpdated: 0, itemsUpdated: 0 };

  const linkedItems = getWorldItems().filter((item) => getLibraryActorId(item) === actor.id);
  if (!linkedItems.length && !getActorLibraryFolder(actor)) {
    return { folder: null, foldersCreated: 0, foldersUpdated: 0, itemsUpdated: 0 };
  }

  const { folder, created, updated } = await ensureActorLibraryFolder(actor, {
    renderDirectory: false
  });
  const updates = linkedItems
    .filter(
      (item) =>
        getDocumentFolderId(item) !== String(folder?.id ?? '').trim() ||
        !sameValue(item.ownership ?? {}, buildActorOwnership(actor))
    )
    .map((item) => ({
      _id: item.id,
      folder: folder?.id ?? null,
      ownership: buildActorOwnership(actor),
      [`flags.${MODULE_ID}.${LIBRARY_ACTOR_ID_FLAG}`]: actor.id
    }));

  if (updates.length) {
    await Item.updateDocuments(updates, {
      render: false,
      [LIBRARY_SYNC_OPTION_KEY]: {
        source: 'actor-library-structure-sync'
      }
    });
  }

  if (renderDirectory && (created || updated || updates.length)) {
    renderItemDirectory();
  }

  return {
    folder,
    foldersCreated: created ? 1 : 0,
    foldersUpdated: updated ? 1 : 0,
    itemsUpdated: updates.length
  };
}

export async function migrateActorItemsToLibrary() {
  const summary = {
    actorsChecked: 0,
    itemsChecked: 0,
    linksCreated: 0,
    libraryItemsCreated: 0,
    foldersCreated: 0,
    foldersUpdated: 0
  };

  for (const actor of getActors()) {
    summary.actorsChecked += 1;

    for (const item of actor.items ?? []) {
      if (!isLibrarySyncManagedType(item.type)) continue;
      summary.itemsChecked += 1;

      const result = await ensureActorItemLibraryLink(item, { renderDirectory: false });
      if (result.created) summary.libraryItemsCreated += 1;
      if (result.linked) summary.linksCreated += 1;
      if (result.folderCreated) summary.foldersCreated += 1;
      if (result.folderUpdated) summary.foldersUpdated += 1;
    }
  }

  if (summary.libraryItemsCreated > 0 || summary.linksCreated > 0 || summary.foldersCreated > 0) {
    renderItemDirectory();
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
