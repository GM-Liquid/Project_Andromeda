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
const ACTOR_ITEM_FOLDER_FLAG = 'actorItemFolder';
const LOCAL_SYSTEM_FIELDS = new Set(['cooldown', 'equipped', 'quantity']);
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

// A compendium-sourced library link (the shipped gear catalog pack). This content
// is canonical and read-only: actor items link to it, but it is never created,
// mutated, or deleted by the world-item library-sync machinery.
function isCompendiumUuid(uuid) {
  return /^Compendium\./.test(String(uuid ?? '').trim());
}

async function resolveCompendiumItem(uuid) {
  if (!isCompendiumUuid(uuid)) return null;
  try {
    const document = await fromUuid(String(uuid).trim());
    return document?.documentName === 'Item' ? document : null;
  } catch {
    return null;
  }
}

export function isCompendiumLibraryUuid(uuid) {
  return isCompendiumUuid(uuid);
}

export function setLibraryItemLinkOnData(data, uuid) {
  foundry.utils.setProperty(
    data ?? {},
    `flags.${MODULE_ID}.${LIBRARY_ITEM_UUID_FLAG}`,
    String(uuid ?? '').trim()
  );
  return data;
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
  // Precompute link counts once: getLinkedActorItems walks every actor's items, so
  // calling it inside the sort comparator would rescan the world per comparison.
  const linkCounts = new Map(items.map((item) => [item, getLinkedActorItems(item.uuid).length]));
  return [...items].sort((left, right) => {
    const countDifference = linkCounts.get(right) - linkCounts.get(left);
    if (countDifference) return countDifference;
    return String(left?.id ?? '').localeCompare(String(right?.id ?? ''));
  })[0];
}

// Homebrew created on a character sheet is backed by a world Item. File that source
// under an Items folder named after the owning actor, creating the folder on demand.
// Only applied when the world Item is first created — already-foldered library items
// are never moved (a shared homebrew item keeps the folder of the actor it came from).
async function ensureActorItemFolderId(actor) {
  const folderName = String(actor?.name ?? '').trim();
  if (!folderName) return null;

  const existing = game.folders?.find(
    (folder) => folder.type === 'Item' && folder.name === folderName
  );
  if (existing) return existing.id;

  // Flag folders we create so the empty-folder cleanup only ever removes our own
  // per-character folders and never a folder the user authored by hand.
  const created = await Folder.create({
    name: folderName,
    type: 'Item',
    flags: { [MODULE_ID]: { [ACTOR_ITEM_FOLDER_FLAG]: true } }
  });
  return created?.id ?? null;
}

function getItemFolderId(document) {
  const folder = document?.folder;
  if (!folder) return null;
  return typeof folder === 'string' ? folder : (folder.id ?? null);
}

function isManagedActorItemFolder(folder) {
  if (!folder || folder.type !== 'Item') return false;
  const flagValue =
    folder.getFlag?.(MODULE_ID, ACTOR_ITEM_FOLDER_FLAG) ??
    folder.flags?.[MODULE_ID]?.[ACTOR_ITEM_FOLDER_FLAG];
  return Boolean(flagValue);
}

function isItemFolderEmpty(folderId) {
  if (getWorldItems().some((item) => getItemFolderId(item) === folderId)) return false;
  const childFolders = game.folders?.contents ?? [];
  return !childFolders.some(
    (folder) => folder.type === 'Item' && getItemFolderId(folder) === folderId
  );
}

// Remove an auto-created per-character Items folder once it holds no item or subfolder,
// so emptied character folders don't linger. Only folders this system created (flagged)
// are removed; user-authored folders are left untouched.
export async function removeManagedItemFolderIfEmpty(folderId) {
  const normalizedId = String(folderId ?? '').trim();
  if (!normalizedId) return false;

  const folder = game.folders?.get(normalizedId);
  if (!isManagedActorItemFolder(folder)) return false;
  if (!isItemFolderEmpty(normalizedId)) return false;

  await folder.delete({
    [LIBRARY_SYNC_OPTION_KEY]: { source: 'actor-item-folder-cleanup' }
  });
  renderItemDirectory();
  return true;
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

  // Already linked to a compendium catalog item (the shipped gear pack). That is
  // canonical, read-only content: keep the link, never spawn a world duplicate.
  const existingUuid = getLibraryItemUuid(actorItem);
  if (existingUuid && isCompendiumUuid(existingUuid)) {
    const packItem = await resolveCompendiumItem(existingUuid);
    if (packItem) {
      return { libraryItem: packItem, created: false, linked: false, libraryItemUpdated: false };
    }
    // Dangling compendium link (pack renamed/removed): fall through to world handling.
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
    const createData = buildLibraryItemCreateData(actorItem);
    const folderId = await ensureActorItemFolderId(actorItem.parent);
    if (folderId) createData.folder = folderId;
    libraryItem = await Item.create(createData, {
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
  // Items linked to the compendium catalog are read-only canon. A local edit on a
  // character sheet stays local; it must never be written back to the shipped pack.
  if (isCompendiumUuid(getLibraryItemUuid(actorItem))) return null;

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

// Run on deletion of an actor item. While other actor items still link to the world
// source, just resync its shared structure. When the deleted item was the last link,
// delete the now-orphaned world source — and clean up its emptied per-character folder
// — so the Items directory never shows a library item that no character uses.
// Compendium-linked items resolve to no world source and are left untouched (read-only
// canon: we never delete from the shipped pack).
export async function cleanupLibraryLinkOnActorItemDelete(item) {
  const libraryItem = getLinkedWorldItem(item);
  if (!libraryItem) return { updated: false, deleted: false };

  if (getLinkedActorItems(libraryItem.uuid).length) {
    const result = await syncLibraryItemStructure(libraryItem, { renderDirectory: true });
    return { updated: Boolean(result.updated), deleted: false };
  }

  // Legacy gear-catalog world items (sheetSyncId `gear:*`) are deprecated canon cleaned
  // up by the opt-in removeOrphanCatalogWorldItems pass, not by this homebrew cascade.
  if (getGearCatalogSyncId(libraryItem).startsWith('gear:')) {
    return { updated: false, deleted: false };
  }

  const folderId = getItemFolderId(libraryItem);
  await libraryItem.delete({
    render: false,
    [LIBRARY_SYNC_OPTION_KEY]: { source: 'actor-delete-orphan-cleanup' }
  });
  await removeManagedItemFolderIfEmpty(folderId);
  renderItemDirectory();
  return { updated: false, deleted: true };
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

/* -------------------------------------------- */
/*  Compendium gear pack integration            */
/* -------------------------------------------- */

const GEAR_CATALOG_SYNC_ID_FLAG = 'sheetSyncId';
const GEAR_LIBRARY_PACK_ID = `${MODULE_ID}.gear-library`;

function getGearCatalogSyncId(item) {
  const flagValue =
    item?.getFlag?.(MODULE_ID, GEAR_CATALOG_SYNC_ID_FLAG) ??
    item?.flags?.[MODULE_ID]?.[GEAR_CATALOG_SYNC_ID_FLAG] ??
    '';
  const normalized = String(flagValue ?? '').trim();
  if (normalized) return normalized;

  // Fall back to the catalog key carried inside the item's own system data, so a
  // link can still be recovered even if the old world catalog item is already gone.
  const gearCatalog = item?.system?.details?.gearCatalog ?? {};
  const catalog = String(gearCatalog.catalog ?? '').trim();
  const entryId = String(gearCatalog.id ?? '').trim();
  if (catalog && entryId) return `gear:${catalog}:${entryId}`;
  return '';
}

export function getGearLibraryPack() {
  return game.packs?.get(GEAR_LIBRARY_PACK_ID) ?? null;
}

// Resolve the `Compendium.…` UUID of a gear-library pack item from its stable
// sheetSyncId (e.g. `gear:abilities:shag_v_ten`). Returns '' when the pack or the
// entry is unavailable. Used by the archetype drop flow to link the granted ability.
export async function findGearLibraryUuidBySyncId(syncId) {
  const target = String(syncId ?? '').trim();
  if (!target) return '';
  const pack = getGearLibraryPack();
  if (!pack) return '';
  const index = await pack.getIndex({
    fields: [`flags.${MODULE_ID}.${GEAR_CATALOG_SYNC_ID_FLAG}`]
  });
  for (const entry of index) {
    const entrySyncId = entry?.flags?.[MODULE_ID]?.[GEAR_CATALOG_SYNC_ID_FLAG];
    if (String(entrySyncId ?? '').trim() === target) {
      return `Compendium.${GEAR_LIBRARY_PACK_ID}.Item.${entry._id}`;
    }
  }
  return '';
}

async function buildPackSyncIdToUuidMap() {
  const pack = getGearLibraryPack();
  if (!pack) return new Map();

  const documents = await pack.getDocuments();
  const map = new Map();
  for (const document of documents) {
    const syncId = getGearCatalogSyncId(document);
    if (syncId) map.set(syncId, document.uuid);
  }
  return map;
}

/**
 * Phase 3 — refresh every actor item linked to a compendium catalog item from its
 * pack source. Shared content (name/img/system) is pulled down; local fields
 * (quantity/equipped/cooldown) are preserved. No-op when content already matches.
 */
export async function refreshCompendiumLinkedActorItems() {
  if (!game.user?.isGM) return { actorsUpdated: 0, itemsUpdated: 0 };

  const sourceCache = new Map();
  const resolveSource = async (uuid) => {
    if (sourceCache.has(uuid)) return sourceCache.get(uuid);
    const source = await resolveCompendiumItem(uuid);
    sourceCache.set(uuid, source);
    return source;
  };

  let actorsUpdated = 0;
  let itemsUpdated = 0;

  for (const actor of getActors()) {
    const updates = [];
    for (const item of actor.items ?? []) {
      if (!isLibrarySyncManagedType(item.type)) continue;
      const uuid = getLibraryItemUuid(item);
      if (!isCompendiumUuid(uuid)) continue;

      const source = await resolveSource(uuid);
      if (!source) continue;
      if (sameValue(buildSharedItemPayload(source), buildSharedItemPayload(item))) continue;

      updates.push({ _id: item.id, ...buildActorItemUpdateDataFromLibrary(source, item) });
    }

    if (updates.length) {
      await actor.updateEmbeddedDocuments('Item', updates, {
        render: false,
        [LIBRARY_SYNC_OPTION_KEY]: { source: 'compendium-pack-refresh' }
      });
      actorsUpdated += 1;
      itemsUpdated += updates.length;
    }
  }

  debugLog('Compendium-linked actor items refreshed from pack', { actorsUpdated, itemsUpdated });
  return { actorsUpdated, itemsUpdated };
}

/**
 * Phase 4 (one-time) — repoint actor items that still link to a world catalog item
 * (or carry a gear-catalog key) at the matching compendium pack item. Non-destructive:
 * only the libraryItemUuid flag changes. Orphaned world catalog items are cleaned up
 * separately by removeOrphanCatalogWorldItems so the irreversible delete stays opt-in.
 */
export async function migrateActorLinksToCompendium() {
  if (!game.user?.isGM) return null;

  const packMap = await buildPackSyncIdToUuidMap();
  if (!packMap.size) {
    debugLog('Pack link migration skipped: gear-library pack missing or empty');
    return { actorsUpdated: 0, itemsRelinked: 0 };
  }

  let actorsUpdated = 0;
  let itemsRelinked = 0;

  for (const actor of getActors()) {
    const updates = [];
    for (const item of actor.items ?? []) {
      if (!isLibrarySyncManagedType(item.type)) continue;
      const currentUuid = getLibraryItemUuid(item);
      if (currentUuid && isCompendiumUuid(currentUuid)) continue;

      const worldItem = currentUuid ? getWorldItemFromUuid(currentUuid) : null;
      const syncId = getGearCatalogSyncId(worldItem) || getGearCatalogSyncId(item);
      if (!syncId) continue;
      const packUuid = packMap.get(syncId);
      if (!packUuid) continue;

      updates.push({
        _id: item.id,
        [`flags.${MODULE_ID}.${LIBRARY_ITEM_UUID_FLAG}`]: packUuid
      });
    }

    if (updates.length) {
      await actor.updateEmbeddedDocuments('Item', updates, {
        render: false,
        [LIBRARY_SYNC_OPTION_KEY]: { source: 'pack-link-migration' }
      });
      actorsUpdated += 1;
      itemsRelinked += updates.length;
    }
  }

  debugLog('Actor item links migrated to compendium pack', { actorsUpdated, itemsRelinked });
  return { actorsUpdated, itemsRelinked };
}

/**
 * One-time migration — convert actor items that link to a compendium catalog entry
 * which is now a `weapon` (catalog weapons used to be imported as `equipment`). A
 * document's type is immutable, so each item is recreated as a `weapon` preserving
 * its data/flags (including the compendium link and local quantity/equipped/cooldown)
 * and the old `equipment` item is then deleted. Subsequent compendium refresh aligns
 * the shared content. Returns `packAvailable: false` when the pack is missing so the
 * caller can retry on a later load instead of marking the migration complete.
 */
export async function migrateCatalogWeaponsToWeaponType() {
  if (!game.user?.isGM) return { packAvailable: false, actorsUpdated: 0, itemsConverted: 0 };

  const pack = getGearLibraryPack();
  if (!pack) return { packAvailable: false, actorsUpdated: 0, itemsConverted: 0 };

  const weaponUuids = new Set();
  for (const document of await pack.getDocuments()) {
    if (document.type === 'weapon') weaponUuids.add(document.uuid);
  }
  if (!weaponUuids.size) return { packAvailable: true, actorsUpdated: 0, itemsConverted: 0 };

  const migrationOptions = {
    render: false,
    [LIBRARY_SYNC_OPTION_KEY]: { source: 'weapon-type-migration' }
  };

  let actorsUpdated = 0;
  let itemsConverted = 0;

  for (const actor of getActors()) {
    const legacyWeapons = (actor.items ?? []).filter((item) => {
      if (item.type !== 'equipment') return false;
      const uuid = getLibraryItemUuid(item);
      return isCompendiumUuid(uuid) && weaponUuids.has(uuid);
    });
    if (!legacyWeapons.length) continue;

    const createData = legacyWeapons.map((item) => {
      const data = item.toObject();
      delete data._id;
      data.type = 'weapon';
      return data;
    });

    await actor.createEmbeddedDocuments('Item', createData, migrationOptions);
    await actor.deleteEmbeddedDocuments(
      'Item',
      legacyWeapons.map((item) => item.id),
      migrationOptions
    );

    actorsUpdated += 1;
    itemsConverted += legacyWeapons.length;
  }

  debugLog('Catalog weapons migrated to weapon item type', { actorsUpdated, itemsConverted });
  return { packAvailable: true, actorsUpdated, itemsConverted };
}

/**
 * Opt-in cleanup of world catalog items (sheetSyncId `gear:*`) that no longer back
 * any actor item after the pack-link migration. Destructive, so it is GM-triggered
 * (game.projectAndromeda.removeOrphanCatalogWorldItems) and supports a dry run.
 */
export async function removeOrphanCatalogWorldItems({ dryRun = false } = {}) {
  if (!game.user?.isGM) return null;

  const orphans = [];
  for (const worldItem of getWorldItems()) {
    if (!isLibrarySyncManagedType(worldItem.type)) continue;
    const syncId = getGearCatalogSyncId(worldItem);
    if (!syncId.startsWith('gear:')) continue;
    if (getLinkedActorItems(worldItem.uuid).length) continue;
    orphans.push(worldItem);
  }

  const summary = { found: orphans.length, deleted: 0, dryRun };
  if (!dryRun && orphans.length) {
    await Item.deleteDocuments(
      orphans.map((item) => item.id),
      {
        render: false,
        [LIBRARY_SYNC_OPTION_KEY]: { source: 'pack-orphan-cleanup' }
      }
    );
    summary.deleted = orphans.length;
    renderItemDirectory();
  }

  debugLog('Orphan catalog world item cleanup', summary);
  return summary;
}
