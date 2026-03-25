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

function buildActorOwnership(actor) {
  return deepClone(actor?.ownership ?? {});
}

function buildMergedOwnership(actors = []) {
  const mergedOwnership = {};

  for (const actor of actors) {
    for (const [userId, level] of Object.entries(actor?.ownership ?? {})) {
      const numericLevel = Number(level) || 0;
      const existingLevel = Number(mergedOwnership[userId]) || 0;
      mergedOwnership[userId] = Math.max(existingLevel, numericLevel);
    }
  }

  return mergedOwnership;
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

function buildSharedPayloadKey(item) {
  return JSON.stringify(sortValue(buildSharedItemPayload(item)));
}

function getWorldItemFromUuid(uuid) {
  const normalized = String(uuid ?? '').trim();
  const match = /^Item\.([^.\s]+)$/.exec(normalized);
  if (!match) return null;
  return game.items?.get(match[1]) ?? null;
}

function getSourceWorldItem(item) {
  const sourceUuid = String(foundry.utils.getProperty(item, 'flags.core.sourceId') ?? '').trim();
  return getWorldItemFromUuid(sourceUuid);
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

function hasLibrarySyncMetadata(document) {
  return Boolean(
    getLibraryActorId(document) || getLibraryActorItemId(document) || getLibraryItemUuid(document)
  );
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

function getWorldItemFromInheritedLibraryMetadata(item) {
  const actorId = getLibraryActorId(item);
  const actorItemId = getLibraryActorItemId(item);
  if (!actorId || !actorItemId) return null;

  return (
    getWorldItems().find(
      (worldItem) =>
        worldItem.type === item?.type &&
        getLibraryActorId(worldItem) === actorId &&
        getLibraryActorItemId(worldItem) === actorItemId
    ) ?? null
  );
}

function getLinkedActorItems(libraryUuid) {
  const normalizedUuid = String(libraryUuid ?? '').trim();
  if (!normalizedUuid) return [];

  const linkedItems = [];
  for (const actor of getActors()) {
    for (const item of actor.items ?? []) {
      if (getLibraryItemUuid(item) !== normalizedUuid) continue;
      linkedItems.push(item);
    }
  }

  return linkedItems;
}

function getLinkedActors(libraryUuid) {
  const actorsById = new Map();
  for (const item of getLinkedActorItems(libraryUuid)) {
    const actor = item?.parent;
    if (!actor?.id || actorsById.has(actor.id)) continue;
    actorsById.set(actor.id, actor);
  }
  return Array.from(actorsById.values());
}

function chooseCanonicalLibraryItem(items) {
  return [...items].sort((left, right) => {
    const leftCount = getLinkedActorItems(left.uuid).length;
    const rightCount = getLinkedActorItems(right.uuid).length;
    if (leftCount !== rightCount) return rightCount - leftCount;

    const leftId = String(left?.id ?? '');
    const rightId = String(right?.id ?? '');
    return leftId.localeCompare(rightId);
  })[0];
}

function buildLibraryItemCreateData(actorItem) {
  const actor = actorItem.parent;
  const payload = buildSharedItemPayload(actorItem);

  return {
    name: payload.name,
    type: payload.type,
    img: payload.img,
    system: payload.system,
    ownership: buildActorOwnership(actor),
    flags: {
      [MODULE_ID]: {
        [LIBRARY_ACTOR_ID_FLAG]: actor.id,
        [LIBRARY_ACTOR_ITEM_ID_FLAG]: actorItem.id
      }
    }
  };
}

function buildWorldItemUpdateData(actorItem) {
  const payload = buildSharedItemPayload(actorItem);
  return {
    name: payload.name,
    img: payload.img,
    system: payload.system
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

function buildLibraryItemStructureUpdate(libraryItem, linkedActorItems) {
  const linkedActors = [];
  const actorsById = new Map();
  for (const item of linkedActorItems) {
    const actor = item?.parent;
    if (!actor?.id || actorsById.has(actor.id)) continue;
    actorsById.set(actor.id, actor);
    linkedActors.push(actor);
  }

  const isShared = linkedActorItems.length > 1;
  const primaryItem = linkedActorItems.length === 1 ? linkedActorItems[0] : null;
  const ownership = isShared
    ? buildMergedOwnership(linkedActors)
    : primaryItem?.parent
      ? buildActorOwnership(primaryItem.parent)
      : (libraryItem?.ownership ?? {});

  const update = {};
  if (!sameValue(libraryItem?.ownership ?? {}, ownership)) {
    update.ownership = ownership;
  }
  if (getLibraryItemUuid(libraryItem) !== libraryItem.uuid) {
    update[`flags.${MODULE_ID}.${LIBRARY_ITEM_UUID_FLAG}`] = libraryItem.uuid;
  }

  const desiredActorId = isShared ? null : (primaryItem?.parent?.id ?? null);
  const desiredActorItemId = isShared ? null : (primaryItem?.id ?? null);
  if (getLibraryActorId(libraryItem) !== String(desiredActorId ?? '').trim()) {
    update[`flags.${MODULE_ID}.${LIBRARY_ACTOR_ID_FLAG}`] = desiredActorId;
  }
  if (getLibraryActorItemId(libraryItem) !== String(desiredActorItemId ?? '').trim()) {
    update[`flags.${MODULE_ID}.${LIBRARY_ACTOR_ITEM_ID_FLAG}`] = desiredActorItemId;
  }

  return update;
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

async function syncLibraryItemStructure(libraryItem, options = {}) {
  const { renderDirectory = true } = options;
  if (!libraryItem) {
    return { updated: false };
  }

  const linkedActorItems = getLinkedActorItems(libraryItem.uuid);
  if (!linkedActorItems.length) {
    return { updated: false };
  }

  const update = buildLibraryItemStructureUpdate(libraryItem, linkedActorItems);
  let updated = false;
  if (Object.keys(update).length) {
    await libraryItem.update(update, {
      render: false,
      [LIBRARY_SYNC_OPTION_KEY]: {
        source: 'library-item-structure-sync'
      }
    });
    updated = true;
  }

  if (renderDirectory && updated) {
    renderItemDirectory();
  }

  return { updated };
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
    return { libraryItem: null, created: false, linked: false, libraryItemUpdated: false };
  }

  if (!isLibrarySyncManagedType(actorItem.type)) {
    return { libraryItem: null, created: false, linked: false, libraryItemUpdated: false };
  }

  let libraryItem = getLinkedWorldItem(actorItem);
  let created = false;
  let linked = false;

  if (!libraryItem) {
    const sourceWorldItem = getSourceWorldItem(actorItem);
    if (sourceWorldItem && isLibrarySyncManagedType(sourceWorldItem.type)) {
      libraryItem = sourceWorldItem;
    }
  }

  if (!libraryItem) {
    libraryItem = getWorldItemFromInheritedLibraryMetadata(actorItem);
  }

  if (!libraryItem) {
    libraryItem = getActorSpecificWorldItem(actorItem);
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
    return { libraryItem: null, created, linked, libraryItemUpdated: false };
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

  const structureResult = await syncLibraryItemStructure(libraryItem, { renderDirectory: false });

  if (renderDirectory && (created || linked || structureResult.updated)) {
    renderItemDirectory();
  }

  return {
    libraryItem,
    created,
    linked,
    libraryItemUpdated: Boolean(structureResult.updated)
  };
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

  await syncLibraryItemStructure(libraryItem, { renderDirectory: false });
  await syncLibraryItemToActors(libraryItem);

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

export async function syncLinkedLibraryItemStructure(item, options = {}) {
  const libraryItem = getLinkedWorldItem(item);
  if (!libraryItem) {
    return { updated: false };
  }

  return syncLibraryItemStructure(libraryItem, options);
}

export async function mergeDuplicateLibraryItems() {
  if (!game.user?.isGM) return null;

  const summary = {
    groupsChecked: 0,
    duplicateGroups: 0,
    actorLinksReassigned: 0,
    duplicateItemsDeleted: 0,
    orphanDuplicateItemsDeleted: 0
  };

  const groups = new Map();
  for (const item of getWorldItems()) {
    if (!isLibrarySyncManagedType(item.type)) continue;

    const linkedActorItems = getLinkedActorItems(item.uuid);
    if (!linkedActorItems.length && !hasLibrarySyncMetadata(item)) continue;

    const key = buildSharedPayloadKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  summary.groupsChecked = groups.size;

  for (const groupItems of groups.values()) {
    if (groupItems.length <= 1) continue;
    summary.duplicateGroups += 1;

    const canonicalItem = chooseCanonicalLibraryItem(groupItems);
    const duplicateItems = groupItems.filter((item) => item.id !== canonicalItem?.id);
    if (!canonicalItem || !duplicateItems.length) continue;

    for (const duplicateItem of duplicateItems) {
      const linkedActorItems = getLinkedActorItems(duplicateItem.uuid);
      const updatesByActor = collectActorUpdatesForLibraryUuid(duplicateItem.uuid, () => ({
        [`flags.${MODULE_ID}.${LIBRARY_ITEM_UUID_FLAG}`]: canonicalItem.uuid
      }));

      for (const [actor, updates] of updatesByActor.entries()) {
        await actor.updateEmbeddedDocuments('Item', updates, {
          render: false,
          [LIBRARY_SYNC_OPTION_KEY]: {
            source: 'library-duplicate-merge'
          }
        });
        summary.actorLinksReassigned += updates.length;
      }

      if (!linkedActorItems.length) {
        summary.orphanDuplicateItemsDeleted += 1;
      }
    }

    await Item.deleteDocuments(
      duplicateItems.map((item) => item.id),
      {
        render: false,
        [LIBRARY_SYNC_OPTION_KEY]: {
          source: 'library-duplicate-merge'
        }
      }
    );
    summary.duplicateItemsDeleted += duplicateItems.length;

    if (getLinkedActorItems(canonicalItem.uuid).length) {
      await syncLibraryItemStructure(canonicalItem, { renderDirectory: false });
    }
  }

  if (
    summary.actorLinksReassigned ||
    summary.duplicateItemsDeleted ||
    summary.orphanDuplicateItemsDeleted
  ) {
    renderItemDirectory();
  }

  debugLog('Duplicate library item merge completed', summary);
  return summary;
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
  if (!actor) return { itemsUpdated: 0 };

  let itemsUpdated = 0;

  const linkedWorldItems = getWorldItems().filter((item) =>
    getLinkedActors(item.uuid).some((linkedActor) => linkedActor.id === actor.id)
  );

  for (const item of linkedWorldItems) {
    const result = await syncLibraryItemStructure(item, { renderDirectory: false });
    if (result.updated) itemsUpdated += 1;
  }

  if (renderDirectory && itemsUpdated) {
    renderItemDirectory();
  }

  return { itemsUpdated };
}

export async function migrateActorItemsToLibrary() {
  const summary = {
    actorsChecked: 0,
    itemsChecked: 0,
    linksCreated: 0,
    libraryItemsCreated: 0,
    libraryItemsUpdated: 0
  };

  for (const actor of getActors()) {
    summary.actorsChecked += 1;

    for (const item of actor.items ?? []) {
      if (!isLibrarySyncManagedType(item.type)) continue;
      summary.itemsChecked += 1;

      const result = await ensureActorItemLibraryLink(item, { renderDirectory: false });
      if (result.created) summary.libraryItemsCreated += 1;
      if (result.linked) summary.linksCreated += 1;
      if (result.libraryItemUpdated) summary.libraryItemsUpdated += 1;
    }
  }

  if (summary.libraryItemsCreated > 0 || summary.linksCreated > 0 || summary.libraryItemsUpdated) {
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
