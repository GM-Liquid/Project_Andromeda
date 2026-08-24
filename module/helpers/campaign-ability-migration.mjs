import { MODULE_ID, debugLog } from '../config.mjs';
import { syncArchetypeAbilityToRank } from './archetype.mjs';
import { getGearLibraryPack, getLibrarySyncOptionKey } from './item-library-sync.mjs';

const ABILITY_ITEM_TYPE = 'trait-source-ability';
const TRAIT_ITEM_TYPE = 'trait';
const CATALOG_ITEM_TYPES = new Set([ABILITY_ITEM_TYPE, TRAIT_ITEM_TYPE]);
const CAMPAIGN_ITEM_TYPES = new Set([...CATALOG_ITEM_TYPES, 'trait-genome']);
const GEAR_CATALOG_SYNC_ID_FLAG = 'sheetSyncId';
const LIBRARY_ITEM_UUID_FLAG = 'libraryItemUuid';
const LIBRARY_ACTOR_ID_FLAG = 'libraryActorId';
const LIBRARY_ACTOR_ITEM_ID_FLAG = 'libraryActorItemId';
const LOCAL_SYSTEM_FIELDS = ['quantity', 'equipped', 'cooldown'];
const LIBRARY_SYNC_OPTION_KEY = getLibrarySyncOptionKey();

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function getFlag(document, scope, key) {
  return document?.getFlag?.(scope, key) ?? document?.flags?.[scope]?.[key];
}

function getCatalogSyncId(document) {
  const flagged = String(getFlag(document, MODULE_ID, GEAR_CATALOG_SYNC_ID_FLAG) ?? '').trim();
  if (flagged) return flagged;

  const details = document?.system?.details?.gearCatalog ?? {};
  const catalog = String(details.catalog ?? '').trim();
  const id = String(details.id ?? '').trim();
  return catalog && id ? `gear:${catalog}:${id}` : '';
}

function getCatalogStableId(document) {
  const detailsId = String(document?.system?.details?.gearCatalog?.id ?? '').trim();
  if (detailsId) return detailsId;
  return /^gear:[^:]+:(.+)$/u.exec(getCatalogSyncId(document))?.[1] ?? '';
}

function getCatalogSourceItemIds(document) {
  const values = document?.system?.details?.gearCatalog?.sourceItemIds;
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((id) => String(id ?? '').trim())
        .filter(Boolean)
    )
  ];
}

function getLinkedWorldItemId(document) {
  const libraryUuid = String(getFlag(document, MODULE_ID, LIBRARY_ITEM_UUID_FLAG) ?? '').trim();
  return /^Item\.([^.]+)$/u.exec(libraryUuid)?.[1] ?? '';
}

function getLegacyItemIdCandidates(document) {
  const candidates = [document?.id, document?._id, document?._source?._id];
  const sourceId = String(getFlag(document, 'core', 'sourceId') ?? '').trim();
  if (sourceId) candidates.push(sourceId.split('.').at(-1));
  return [...new Set(candidates.map((id) => String(id ?? '').trim()).filter(Boolean))];
}

export function normalizeCatalogItemName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е')
    .replace(/\s+/gu, ' ');
}

function addUniqueMatch(index, ambiguous, key, document) {
  if (!key || ambiguous.has(key)) return;
  const existing = index.get(key);
  if (!existing) {
    index.set(key, document);
    return;
  }
  if (existing === document) return;
  index.delete(key);
  ambiguous.add(key);
}

export function buildCampaignCatalogMatchIndex(documents = []) {
  const byCatalogKey = new Map();
  const byStableId = new Map();
  const bySourceItemId = new Map();
  const byName = new Map();
  const ambiguousCatalogKeys = new Set();
  const ambiguousStableIds = new Set();
  const ambiguousSourceItemIds = new Set();
  const ambiguousNames = new Set();

  for (const document of documents) {
    if (!CATALOG_ITEM_TYPES.has(document?.type)) continue;
    const status = String(document?.system?.details?.gearCatalog?.status ?? '').trim();
    if (status && status !== 'approved') continue;
    const syncId = getCatalogSyncId(document);
    if (!/^gear:(abilities|traits):/u.test(syncId)) continue;

    addUniqueMatch(byCatalogKey, ambiguousCatalogKeys, syncId, document);
    addUniqueMatch(byStableId, ambiguousStableIds, getCatalogStableId(document), document);
    for (const sourceItemId of getCatalogSourceItemIds(document)) {
      addUniqueMatch(bySourceItemId, ambiguousSourceItemIds, sourceItemId, document);
    }
    addUniqueMatch(byName, ambiguousNames, normalizeCatalogItemName(document.name), document);
  }

  return {
    byCatalogKey,
    byStableId,
    bySourceItemId,
    byName,
    ambiguousNames
  };
}

export function findCampaignCatalogMatch(item, index) {
  if (!CAMPAIGN_ITEM_TYPES.has(item?.type)) return null;

  const linkedWorldItemId = getLinkedWorldItemId(item);
  if (linkedWorldItemId && index.bySourceItemId.has(linkedWorldItemId)) {
    return { source: index.bySourceItemId.get(linkedWorldItemId), matchedBy: 'sourceItemId' };
  }

  const catalogKey = getCatalogSyncId(item);
  if (catalogKey && index.byCatalogKey.has(catalogKey)) {
    return { source: index.byCatalogKey.get(catalogKey), matchedBy: 'catalogKey' };
  }

  const stableId = getCatalogStableId(item);
  if (stableId && index.byStableId.has(stableId)) {
    return { source: index.byStableId.get(stableId), matchedBy: 'stableId' };
  }

  for (const sourceItemId of getLegacyItemIdCandidates(item)) {
    if (index.bySourceItemId.has(sourceItemId)) {
      return { source: index.bySourceItemId.get(sourceItemId), matchedBy: 'sourceItemId' };
    }
  }

  const name = normalizeCatalogItemName(item?.name);
  if (name && index.byName.has(name)) {
    return { source: index.byName.get(name), matchedBy: 'name' };
  }

  return null;
}

function getActorItemMatchKey(actorId, actorItemId) {
  const normalizedActorId = String(actorId ?? '').trim();
  const normalizedActorItemId = String(actorItemId ?? '').trim();
  return normalizedActorId && normalizedActorItemId
    ? `${normalizedActorId}.${normalizedActorItemId}`
    : '';
}

export function buildCampaignWorldActorItemSourceMap(documents = [], index) {
  const sources = new Map();
  const ambiguousKeys = new Set();

  for (const document of documents) {
    const actorItemKey = getActorItemMatchKey(
      getFlag(document, MODULE_ID, LIBRARY_ACTOR_ID_FLAG),
      getFlag(document, MODULE_ID, LIBRARY_ACTOR_ITEM_ID_FLAG)
    );
    if (!actorItemKey) continue;

    let source = null;
    for (const sourceItemId of getLegacyItemIdCandidates(document)) {
      source = index.bySourceItemId.get(sourceItemId) ?? null;
      if (source) break;
    }
    if (!source) continue;

    addUniqueMatch(sources, ambiguousKeys, actorItemKey, source);
  }

  return sources;
}

function documentData(document) {
  return document?.toObject?.() ?? clone(document ?? {});
}

function buildMergedSystem(source, legacyItem) {
  const system = clone(source?.system ?? {});
  const legacySystem = legacyItem?.system ?? {};
  for (const field of LOCAL_SYSTEM_FIELDS) {
    if (Object.hasOwn(legacySystem, field)) system[field] = clone(legacySystem[field]);
  }
  return system;
}

function buildMergedFlags(source, legacyItem) {
  const sourceFlags = clone(source?.flags ?? {});
  const legacyFlags = clone(legacyItem?.flags ?? {});
  const syncId = getCatalogSyncId(source);
  return {
    ...sourceFlags,
    ...legacyFlags,
    [MODULE_ID]: {
      ...(sourceFlags[MODULE_ID] ?? {}),
      ...(legacyFlags[MODULE_ID] ?? {}),
      [GEAR_CATALOG_SYNC_ID_FLAG]: syncId,
      [LIBRARY_ITEM_UUID_FLAG]: source.uuid
    }
  };
}

export function buildCampaignCatalogUpdateData(source, legacyItem) {
  return {
    _id: legacyItem.id,
    name: String(source?.name ?? ''),
    img: String(source?.img ?? ''),
    system: buildMergedSystem(source, legacyItem),
    flags: buildMergedFlags(source, legacyItem)
  };
}

export function buildCampaignCatalogReplacementData(source, legacyItem) {
  const data = documentData(source);
  delete data._id;
  delete data.folder;
  delete data.ownership;
  delete data._stats;
  data.name = String(source?.name ?? data.name ?? '');
  data.type = String(source?.type ?? data.type ?? '');
  data.img = String(source?.img ?? data.img ?? '');
  data.system = buildMergedSystem(source, legacyItem);
  data.flags = buildMergedFlags(source, legacyItem);
  if (Number.isFinite(Number(legacyItem?.sort))) data.sort = Number(legacyItem.sort);
  return data;
}

export async function migrateCampaignAbilitiesToCatalog() {
  const emptySummary = {
    packAvailable: false,
    actorsUpdated: 0,
    itemsUpdated: 0,
    itemsReplaced: 0,
    archetypeAbilitiesResynced: 0,
    duplicateLegacyItemsRemoved: 0,
    nameMatchedDuplicatesKept: 0,
    matchedByWorldMetadata: 0,
    matchedByCatalogKey: 0,
    matchedByStableId: 0,
    matchedBySourceItemId: 0,
    matchedByName: 0
  };
  if (!game.user?.isGM) return emptySummary;

  const pack = getGearLibraryPack();
  if (!pack) return emptySummary;
  const packDocuments = await pack.getDocuments();
  const index = buildCampaignCatalogMatchIndex(packDocuments);
  if (!index.byCatalogKey.size) return emptySummary;
  const worldActorItemSources = buildCampaignWorldActorItemSourceMap(
    game.items?.contents ?? [],
    index
  );

  const summary = { ...emptySummary, packAvailable: true };
  const options = {
    render: false,
    [LIBRARY_SYNC_OPTION_KEY]: { source: 'campaign-ability-catalog-migration' }
  };

  for (const actor of game.actors?.contents ?? []) {
    const matchedItems = Array.from(actor.items ?? [])
      .map((item) => {
        const source = worldActorItemSources.get(getActorItemMatchKey(actor.id, item.id));
        const match = source
          ? { source, matchedBy: 'worldMetadata' }
          : findCampaignCatalogMatch(item, index);
        return { item, match };
      })
      .filter(({ match }) => match);
    if (!matchedItems.length) continue;

    const presentTargetUuids = new Set(
      matchedItems
        .filter(({ item, match }) => item.type === match.source.type)
        .map(({ match }) => match.source.uuid)
    );
    const updates = [];
    const createData = [];
    const deleteIds = [];

    for (const { item, match } of matchedItems) {
      const summaryKey =
        {
          worldMetadata: 'matchedByWorldMetadata',
          catalogKey: 'matchedByCatalogKey',
          stableId: 'matchedByStableId',
          sourceItemId: 'matchedBySourceItemId',
          name: 'matchedByName'
        }[match.matchedBy] ?? '';
      if (summaryKey) summary[summaryKey] += 1;

      if (item.type === match.source.type) {
        updates.push(buildCampaignCatalogUpdateData(match.source, item));
        summary.itemsUpdated += 1;
        continue;
      }

      if (presentTargetUuids.has(match.source.uuid)) {
        // The catalog entry is already on the sheet under its correct type, so this
        // legacy copy is a duplicate — but only when it was matched by a catalog id.
        // A name-only match may well be unrelated homebrew that merely shares a title,
        // and nothing is ever deleted on that evidence alone.
        if (match.matchedBy === 'name') {
          summary.nameMatchedDuplicatesKept += 1;
          continue;
        }
        deleteIds.push(item.id);
        summary.duplicateLegacyItemsRemoved += 1;
        continue;
      }

      createData.push(buildCampaignCatalogReplacementData(match.source, item));
      deleteIds.push(item.id);
      presentTargetUuids.add(match.source.uuid);
      summary.itemsReplaced += 1;
    }

    if (createData.length) await actor.createEmbeddedDocuments('Item', createData, options);
    if (updates.length) await actor.updateEmbeddedDocuments('Item', updates, options);
    if (deleteIds.length) await actor.deleteEmbeddedDocuments('Item', deleteIds, options);
    // Compatibility for old versioned signature records. Current signatures use one
    // mechanics record plus explicit scaling and therefore make this pass a no-op.
    const rankUpdates = await syncArchetypeAbilityToRank(actor, { render: false });
    summary.archetypeAbilitiesResynced += rankUpdates;
    if (createData.length || updates.length || deleteIds.length || rankUpdates) {
      summary.actorsUpdated += 1;
    }
  }

  debugLog('Campaign abilities refreshed from the catalog', summary);
  return summary;
}
