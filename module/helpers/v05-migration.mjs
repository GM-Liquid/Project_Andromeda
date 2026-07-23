import { MODULE_ID, debugLog } from '../config.mjs';
import {
  ARCHETYPE_GRANT_FLAG,
  buildArchetypeTraitGrantData,
  syncArchetypeAbilityToRank
} from './archetype.mjs';
import { getGearLibraryPack, getLibraryItemUuid } from './item-library-sync.mjs';

const GEAR_CATALOG_SYNC_ID_FLAG = 'sheetSyncId';
const LIBRARY_ITEM_UUID_FLAG = 'libraryItemUuid';
const OBSOLETE_INVENTORY_TYPES = new Set([
  'armor',
  'weapon',
  'equipment',
  'equipment-consumable',
  'implant',
  'cartridge'
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

function getCatalogSyncId(item, packUuidToSyncId = new Map()) {
  const direct = getDirectCatalogSyncId(item);
  if (direct) return direct;
  const libraryUuid = getLibraryItemUuid(item);
  const packSyncId = packUuidToSyncId.get(String(libraryUuid ?? '').trim());
  if (packSyncId) return packSyncId;
  const worldMatch = /^Item\.([^\s.]+)$/u.exec(String(libraryUuid ?? '').trim());
  if (!worldMatch) return '';
  return getDirectCatalogSyncId(game.items?.get(worldMatch[1]));
}

export function getV05ItemMigrationAction({ itemType, syncId, artifactSyncIds }) {
  const normalizedSyncId = String(syncId ?? '').trim();
  if (normalizedSyncId && artifactSyncIds?.has(normalizedSyncId)) return 'convert-to-artifact';
  if (OBSOLETE_INVENTORY_TYPES.has(String(itemType ?? '').trim()) && normalizedSyncId) {
    return 'delete-obsolete-catalog-item';
  }
  return 'keep';
}

function buildArtifactCreateData(source, legacyItem) {
  const data = source.toObject();
  delete data._id;
  const sourceFlags = data.flags ?? {};
  const legacyFlags = legacyItem?.toObject?.().flags ?? legacyItem?.flags ?? {};
  data.flags = { ...sourceFlags, ...legacyFlags };
  data.flags[MODULE_ID] = {
    ...(sourceFlags[MODULE_ID] ?? {}),
    ...(legacyFlags[MODULE_ID] ?? {}),
    [LIBRARY_ITEM_UUID_FLAG]: source.uuid
  };
  return data;
}

function buildPackSyncMap(documents) {
  const map = new Map();
  for (const document of documents) {
    const syncId = getDirectCatalogSyncId(document);
    if (syncId) map.set(syncId, document);
  }
  return map;
}

export async function migrateWorldV04ToV05() {
  if (!game.user?.isGM) return { packAvailable: false };
  const pack = getGearLibraryPack();
  if (!pack) return { packAvailable: false };
  const packDocuments = await pack.getDocuments();
  const packBySyncId = buildPackSyncMap(packDocuments);
  const packUuidToSyncId = new Map(
    [...packBySyncId].map(([syncId, document]) => [document.uuid, syncId])
  );
  const artifactBySyncId = new Map(
    [...packBySyncId].filter(([, document]) => document.type === 'artifact')
  );
  if (!artifactBySyncId.size) return { packAvailable: false };
  const requiredArchetypeTraitSyncIds = packDocuments
    .filter((document) => document.type === 'archetype')
    .map((document) => {
      const explicit = String(document.system?.traitSyncId ?? '').trim();
      const embeddedId = String(document.system?.trait?.id ?? '').trim();
      return explicit || (embeddedId ? `gear:traits:${embeddedId}` : '');
    })
    .filter(Boolean);
  if (requiredArchetypeTraitSyncIds.some((syncId) => !packBySyncId.has(syncId))) {
    return { packAvailable: false };
  }

  const artifactSyncIds = new Set(artifactBySyncId.keys());
  const summary = {
    packAvailable: true,
    actorsUpdated: 0,
    artifactsConverted: 0,
    obsoleteCatalogItemsDeleted: 0,
    abilityCooldownsCleared: 0,
    archetypeAbilitiesUpdated: 0,
    archetypeTraitsCreated: 0,
    misplacedArchetypeTraitsDeleted: 0
  };

  for (const actor of game.actors?.contents ?? []) {
    let actorChanged = false;
    const actorUpdates = {};
    if (!Number.isFinite(Number(actor.system?.heat?.value))) actorUpdates['system.heat.value'] = 0;
    if (foundry.utils.hasProperty(actor._source?.system ?? actor.system ?? {}, 'flux')) {
      actorUpdates['system.-=flux'] = null;
    }
    if (Object.keys(actorUpdates).length) {
      await actor.update(actorUpdates, { render: false });
      actorChanged = true;
    }

    const existingArtifactSyncIds = new Set(
      (actor.items ?? [])
        .filter((item) => item.type === 'artifact')
        .map((item) => getCatalogSyncId(item, packUuidToSyncId))
        .filter(Boolean)
    );
    const createData = [];
    const deleteIds = [];
    const abilityUpdates = [];

    for (const item of actor.items ?? []) {
      const syncId = getCatalogSyncId(item, packUuidToSyncId);
      const action = getV05ItemMigrationAction({
        itemType: item.type,
        syncId,
        artifactSyncIds
      });
      if (action === 'convert-to-artifact' && item.type !== 'artifact') {
        if (!existingArtifactSyncIds.has(syncId)) {
          createData.push(buildArtifactCreateData(artifactBySyncId.get(syncId), item));
          existingArtifactSyncIds.add(syncId);
          summary.artifactsConverted += 1;
        }
        deleteIds.push(item.id);
        continue;
      }
      if (action === 'delete-obsolete-catalog-item') {
        deleteIds.push(item.id);
        summary.obsoleteCatalogItemsDeleted += 1;
        continue;
      }
      if (item.type === 'trait-source-ability' && String(item.system?.mode ?? '').trim()) {
        const update = { _id: item.id };
        if (String(item.system?.usageFrequency ?? '') !== 'passive') {
          update['system.usageFrequency'] = 'passive';
        }
        if (foundry.utils.hasProperty(item._source?.system ?? item.system ?? {}, 'cooldown')) {
          update['system.-=cooldown'] = null;
        }
        if (Object.keys(update).length > 1) {
          abilityUpdates.push(update);
          summary.abilityCooldownsCleared += 1;
        }
      }
    }

    for (const archetype of (actor.items ?? []).filter((item) => item.type === 'archetype')) {
      const embeddedTraitId = String(archetype.system?.trait?.id ?? '').trim();
      const traitSyncId =
        String(archetype.system?.traitSyncId ?? '').trim() ||
        (embeddedTraitId ? `gear:traits:${embeddedTraitId}` : '');
      if (!traitSyncId) continue;

      const grantedItems = (actor.items ?? []).filter(
        (item) => item.getFlag?.(MODULE_ID, ARCHETYPE_GRANT_FLAG) === archetype.id
      );
      const hasTrait = grantedItems.some((item) => item.type === 'trait');
      if (!hasTrait) {
        const source = packBySyncId.get(traitSyncId);
        const traitData = buildArchetypeTraitGrantData(source, archetype.id, source?.uuid);
        if (traitData) {
          createData.push(traitData);
          summary.archetypeTraitsCreated += 1;
        }
      }

      for (const item of grantedItems) {
        if (item.type === 'trait') continue;
        if (getCatalogSyncId(item, packUuidToSyncId) !== traitSyncId) continue;
        deleteIds.push(item.id);
        summary.misplacedArchetypeTraitsDeleted += 1;
      }
    }

    const options = { render: false, projectAndromedaV05Migration: true };
    if (createData.length) await actor.createEmbeddedDocuments('Item', createData, options);
    if (abilityUpdates.length) {
      await actor.updateEmbeddedDocuments('Item', abilityUpdates, options);
    }
    if (deleteIds.length) await actor.deleteEmbeddedDocuments('Item', deleteIds, options);
    const rankUpdates = await syncArchetypeAbilityToRank(actor, { render: false });
    summary.archetypeAbilitiesUpdated += rankUpdates;
    if (createData.length || abilityUpdates.length || deleteIds.length || rankUpdates) {
      actorChanged = true;
    }
    if (actorChanged) summary.actorsUpdated += 1;
  }

  debugLog('World migrated from 0.4 to 0.5', summary);
  return summary;
}
