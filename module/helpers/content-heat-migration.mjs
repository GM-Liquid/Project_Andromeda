import { MODULE_ID, debugLog } from '../config.mjs';
import {
  getGearLibraryPack,
  getLibraryItemUuid,
  getLibrarySyncOptionKey
} from './item-library-sync.mjs';

const GEAR_CATALOG_SYNC_ID_FLAG = 'sheetSyncId';
const LIBRARY_ITEM_UUID_FLAG = 'libraryItemUuid';
const LIBRARY_SYNC_OPTION_KEY = getLibrarySyncOptionKey();
const LOCAL_SYSTEM_FIELDS = ['quantity', 'equipped', 'cooldown'];

export const DELETED_CATALOG_ENTRY_IDS = new Set([
  'vykidnoe-oruzhie-dalnego-boya',
  'takticheskiy-pritsel',
  'vibroklinok'
]);

export const MOVED_CATALOG_ENTRIES = new Map([
  ['protokol-parirovaniya', { syncId: 'gear:traits:protokol-parirovaniya', type: 'trait' }],
  ['protokol-ubiytsa', { syncId: 'gear:traits:protokol-ubiytsa', type: 'trait' }],
  [
    'snayperskaya-vintovka-igla',
    { syncId: 'gear:abilities:snayperskaya-vintovka-igla', type: 'trait-source-ability' }
  ]
]);

export const REFRESHED_CATALOG_ENTRIES = new Map([
  ['ognemet-ifrit', { syncId: 'gear:equipment:ognemet-ifrit', type: 'artifact' }],
  ['amplifikator-shepot', { syncId: 'gear:equipment:amplifikator-shepot', type: 'artifact' }],
  ['bioinvertor-zimniy-son', { syncId: 'gear:equipment:bioinvertor-zimniy-son', type: 'artifact' }],
  [
    'vykidnoe-oruzhie-blizhnego-boya',
    { syncId: 'gear:equipment:vykidnoe-oruzhie-blizhnego-boya', type: 'artifact' }
  ],
  ['mikro-optika', { syncId: 'gear:equipment:mikro-optika', type: 'artifact' }],
  ['diplomat', { syncId: 'gear:archetypes:diplomat', type: 'archetype' }],
  ['dozhim', { syncId: 'gear:traits:dozhim', type: 'trait' }]
]);

function getDirectCatalogSyncId(item) {
  const flagValue =
    item?.getFlag?.(MODULE_ID, GEAR_CATALOG_SYNC_ID_FLAG) ??
    item?.flags?.[MODULE_ID]?.[GEAR_CATALOG_SYNC_ID_FLAG] ??
    '';
  if (String(flagValue ?? '').trim()) return String(flagValue).trim();
  const catalog = String(item?.system?.details?.gearCatalog?.catalog ?? '').trim();
  const id = String(item?.system?.details?.gearCatalog?.id ?? '').trim();
  return catalog && id ? `gear:${catalog}:${id}` : '';
}

function getCatalogEntryId(item) {
  const detailsId = String(item?.system?.details?.gearCatalog?.id ?? '').trim();
  if (detailsId) return detailsId;
  const syncId = getDirectCatalogSyncId(item);
  const match = /^gear:[^:]+:(.+)$/u.exec(syncId);
  return match?.[1] ?? '';
}

export function buildLegacyHeatCostUpdate(item) {
  const sourceSystem = item?._source?.system ?? item?.system ?? {};
  if (!Object.hasOwn(sourceSystem, 'mode')) return null;
  const mode = String(sourceSystem.mode ?? '').trim();
  const existingCost = Number(sourceSystem.heatCost);
  const heatCost =
    sourceSystem.heatCost !== '' && Number.isFinite(existingCost)
      ? Math.max(0, Math.floor(existingCost))
      : mode === 'forced'
        ? 2
        : 0;
  return {
    _id: item.id,
    'system.heatCost': heatCost,
    'system.-=mode': null
  };
}

export function getCatalogContentMigrationAction(item, catalogEntryId = '') {
  const id = String(catalogEntryId ?? '').trim() || getCatalogEntryId(item);
  if (DELETED_CATALOG_ENTRY_IDS.has(id)) return { action: 'delete', id };
  const target = MOVED_CATALOG_ENTRIES.get(id);
  if (target) {
    const syncId = getDirectCatalogSyncId(item);
    if (item?.type === target.type && syncId === target.syncId) {
      return { action: 'keep', id, target };
    }
    return { action: 'replace', id, target };
  }
  const refreshTarget = REFRESHED_CATALOG_ENTRIES.get(id);
  if (!refreshTarget) return { action: 'keep', id };
  return item?.type === refreshTarget.type
    ? { action: 'refresh', id, target: refreshTarget }
    : { action: 'replace', id, target: refreshTarget };
}

export function buildReplacementData(source, legacyItem, target) {
  const data = source.toObject();
  delete data._id;
  delete data.folder;
  const legacyData = legacyItem?.toObject?.() ?? legacyItem ?? {};
  if (String(legacyData.img ?? '').trim()) data.img = legacyData.img;
  for (const field of LOCAL_SYSTEM_FIELDS) {
    if (Object.hasOwn(legacyData.system ?? {}, field)) {
      data.system[field] = structuredClone(legacyData.system[field]);
    }
  }
  if (Number.isFinite(Number(legacyData.sort))) data.sort = Number(legacyData.sort);

  const sourceFlags = data.flags ?? {};
  const legacyFlags = legacyData.flags ?? {};
  data.flags = {
    ...sourceFlags,
    ...legacyFlags,
    [MODULE_ID]: {
      ...(sourceFlags[MODULE_ID] ?? {}),
      ...(legacyFlags[MODULE_ID] ?? {}),
      [GEAR_CATALOG_SYNC_ID_FLAG]: target.syncId,
      [LIBRARY_ITEM_UUID_FLAG]: source.uuid
    }
  };
  return data;
}

function buildRefreshUpdateData(source, legacyItem, target) {
  const data = buildReplacementData(source, legacyItem, target);
  const update = {
    _id: legacyItem.id,
    name: data.name,
    img: data.img,
    system: data.system,
    flags: data.flags
  };
  if (Number.isFinite(Number(data.sort))) update.sort = Number(data.sort);
  if (Object.hasOwn(legacyItem?._source?.system ?? legacyItem?.system ?? {}, 'mode')) {
    update['system.-=mode'] = null;
  }
  return update;
}

function buildPackSyncMap(documents) {
  return new Map(
    documents
      .map((document) => [getDirectCatalogSyncId(document), document])
      .filter(([syncId]) => syncId)
  );
}

function getLinkedCatalogEntryId(item, packUuidToId) {
  const directId = getCatalogEntryId(item);
  if (directId) return directId;
  const libraryUuid = String(getLibraryItemUuid(item) ?? '').trim();
  const packId = packUuidToId.get(libraryUuid);
  if (packId) return packId;
  const worldMatch = /^Item\.([^\s.]+)$/u.exec(libraryUuid);
  return worldMatch ? getCatalogEntryId(game.items?.get(worldMatch[1])) : '';
}

export function filterExistingDocumentIds(collection, ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!collection) return [];
  if (typeof collection.has === 'function') {
    return uniqueIds.filter((id) => collection.has(id));
  }
  if (typeof collection.get === 'function') {
    return uniqueIds.filter((id) => Boolean(collection.get(id)));
  }
  const existingIds = new Set(Array.from(collection, (document) => document?.id).filter(Boolean));
  return uniqueIds.filter((id) => existingIds.has(id));
}

export async function deleteExistingDocuments(collection, ids, deleteDocuments) {
  let pendingIds = filterExistingDocumentIds(collection, ids);
  while (pendingIds.length) {
    try {
      await deleteDocuments(pendingIds);
      return;
    } catch (error) {
      const remainingIds = filterExistingDocumentIds(collection, pendingIds);
      // Foundry hooks can remove a linked world item while this migration is awaiting
      // another document operation. Retry only when the failed batch actually shrank;
      // unrelated deletion failures must still abort the one-time migration.
      if (remainingIds.length >= pendingIds.length) throw error;
      pendingIds = remainingIds;
    }
  }
}

export async function migrateContentAndHeatModel() {
  if (!game.user?.isGM) return { packAvailable: false };
  const pack = getGearLibraryPack();
  if (!pack) return { packAvailable: false };
  const packDocuments = await pack.getDocuments();
  const packBySyncId = buildPackSyncMap(packDocuments);
  const requiredTargets = [
    ...MOVED_CATALOG_ENTRIES.values(),
    ...REFRESHED_CATALOG_ENTRIES.values()
  ];
  if (requiredTargets.some(({ syncId }) => !packBySyncId.has(syncId))) {
    return { packAvailable: false };
  }

  const packUuidToId = new Map(
    packDocuments.map((document) => [document.uuid, getCatalogEntryId(document)])
  );
  const summary = {
    packAvailable: true,
    actorsUpdated: 0,
    itemsReplaced: 0,
    itemsRefreshed: 0,
    itemsDeleted: 0,
    heatFieldsMigrated: 0,
    worldItemsDeleted: 0,
    worldItemsRefreshed: 0,
    worldHeatFieldsMigrated: 0
  };
  const options = {
    render: false,
    [LIBRARY_SYNC_OPTION_KEY]: { source: 'content-heat-migration' }
  };

  for (const actor of game.actors?.contents ?? []) {
    const createData = [];
    const deleteIds = [];
    const updates = [];
    const existingTargets = new Set(
      (actor.items ?? [])
        .filter((item) => {
          const syncId = getDirectCatalogSyncId(item);
          const target = [...MOVED_CATALOG_ENTRIES.values()].find(
            (entry) => entry.syncId === syncId
          );
          return target && item.type === target.type;
        })
        .map((item) => getDirectCatalogSyncId(item))
    );

    for (const item of actor.items ?? []) {
      const linkedId = getLinkedCatalogEntryId(item, packUuidToId);
      const action = getCatalogContentMigrationAction(item, linkedId);
      if (action.action === 'delete') {
        deleteIds.push(item.id);
        summary.itemsDeleted += 1;
        continue;
      }
      if (action.action === 'replace') {
        if (!existingTargets.has(action.target.syncId)) {
          createData.push(
            buildReplacementData(packBySyncId.get(action.target.syncId), item, action.target)
          );
          existingTargets.add(action.target.syncId);
          summary.itemsReplaced += 1;
        }
        deleteIds.push(item.id);
        continue;
      }
      if (action.action === 'refresh') {
        updates.push(
          buildRefreshUpdateData(packBySyncId.get(action.target.syncId), item, action.target)
        );
        summary.itemsRefreshed += 1;
        continue;
      }
      const heatUpdate = buildLegacyHeatCostUpdate(item);
      if (heatUpdate) {
        updates.push(heatUpdate);
        summary.heatFieldsMigrated += 1;
      }
    }

    if (createData.length) await actor.createEmbeddedDocuments('Item', createData, options);
    if (updates.length) await actor.updateEmbeddedDocuments('Item', updates, options);
    await deleteExistingDocuments(actor.items, deleteIds, (existingIds) =>
      actor.deleteEmbeddedDocuments('Item', existingIds, options)
    );
    if (createData.length || updates.length || deleteIds.length) summary.actorsUpdated += 1;
  }

  const worldUpdates = [];
  const worldDeleteIds = [];
  for (const item of game.items?.contents ?? []) {
    const action = getCatalogContentMigrationAction(item);
    if (action.action === 'delete' || action.action === 'replace') {
      worldDeleteIds.push(item.id);
      summary.worldItemsDeleted += 1;
      continue;
    }
    if (action.action === 'refresh') {
      worldUpdates.push(
        buildRefreshUpdateData(packBySyncId.get(action.target.syncId), item, action.target)
      );
      summary.worldItemsRefreshed += 1;
      summary.worldHeatFieldsMigrated += Object.hasOwn(
        item?._source?.system ?? item?.system ?? {},
        'mode'
      )
        ? 1
        : 0;
      continue;
    }
    const heatUpdate = buildLegacyHeatCostUpdate(item);
    if (heatUpdate) {
      worldUpdates.push(heatUpdate);
      summary.worldHeatFieldsMigrated += 1;
    }
  }
  if (worldUpdates.length) await Item.updateDocuments(worldUpdates, options);
  await deleteExistingDocuments(game.items, worldDeleteIds, (existingIds) =>
    Item.deleteDocuments(existingIds, options)
  );

  debugLog('Content entities and Heat model migrated', summary);
  return summary;
}
