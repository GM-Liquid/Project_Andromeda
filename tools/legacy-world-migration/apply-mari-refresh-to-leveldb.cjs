const fs = require('fs');
const path = require('path');
const process = require('process');
const { ClassicLevel } = require('classic-level');

const ACTOR_ID = 'hDXTJgw3d3VIjktx';
const MODULE_ID = 'project-andromeda';
const REFRESH_VERSION = 1;
const LEGACY_NAME_ALIASES = Object.freeze({
  'Дальний взлом': ['Дальнний взлом']
});

function fail(message) {
  throw new Error(message);
}

function readUpdates(modulePath) {
  const source = fs.readFileSync(modulePath, 'utf8');
  const match = source.match(/const updates = (\[[\s\S]*?\n\]);/u);
  if (!match) fail(`Cannot find updates array in ${modulePath}`);
  return Function(`"use strict"; return (${match[1]});`)();
}

function setPath(target, dottedPath, value) {
  const parts = dottedPath.split('.');
  let current = target;
  for (const part of parts.slice(0, -1)) {
    current[part] ??= {};
    current = current[part];
  }
  current[parts.at(-1)] = value;
}

function applyUpdate(item, update) {
  item.name = update.name;
  for (const [key, value] of Object.entries(update)) {
    if (key === '_id' || key === 'name') continue;
    setPath(item, key, value);
  }
  item.system ??= {};
  item.system.details ??= {};
  item.system.details.mariAbilityRefresh = {
    version: REFRESH_VERSION,
    source: 'lorenzo-style-world-refresh'
  };
  item.flags ??= {};
  item.flags[MODULE_ID] ??= {};
  item.flags[MODULE_ID].mariAbilityRefreshVersion = REFRESH_VERSION;
}

function hasExpectedName(item, update) {
  const acceptedNames = [update.name, ...(LEGACY_NAME_ALIASES[update.name] ?? [])];
  return acceptedNames.includes(item.name);
}

function getWorldItemId(item) {
  const uuid = String(item?.flags?.[MODULE_ID]?.libraryItemUuid ?? '');
  const match = /^Item\.([A-Za-z0-9]+)$/u.exec(uuid);
  return match?.[1] ?? '';
}

async function getRequired(db, key) {
  try {
    return await db.get(key);
  } catch (error) {
    if (error?.code === 'LEVEL_NOT_FOUND') fail(`Missing document ${key}`);
    throw error;
  }
}

async function main() {
  const [dataRootArg, refreshModuleArg, mode = 'dry-run'] = process.argv.slice(2);
  if (!dataRootArg || !refreshModuleArg) {
    fail(
      'Usage: node apply-mari-refresh-to-leveldb.cjs <world-data-directory> <refresh-module.mjs> [dry-run|apply]'
    );
  }

  const apply = mode === 'apply';
  if (!apply && mode !== 'dry-run') fail(`Unknown mode: ${mode}`);

  const dataRoot = path.resolve(dataRootArg);
  const updates = readUpdates(path.resolve(refreshModuleArg));
  const actorsDb = new ClassicLevel(path.join(dataRoot, 'actors'), { valueEncoding: 'json' });
  const itemsDb = new ClassicLevel(path.join(dataRoot, 'items'), { valueEncoding: 'json' });
  const report = { mode, actorId: ACTOR_ID, abilities: [], sources: [] };

  await actorsDb.open();
  await itemsDb.open();
  try {
    for (const update of updates) {
      const actorKey = `!actors.items!${ACTOR_ID}.${update._id}`;
      const actorItem = await getRequired(actorsDb, actorKey);
      if (!hasExpectedName(actorItem, update)) {
        fail(`Item name mismatch for ${update._id}: ${actorItem.name} !== ${update.name}`);
      }

      const sourceId = getWorldItemId(actorItem);
      if (!sourceId) fail(`No world library link for ${update.name}`);
      const sourceKey = `!items!${sourceId}`;
      const sourceItem = await getRequired(itemsDb, sourceKey);
      if (!hasExpectedName(sourceItem, update)) {
        fail(`Source name mismatch for ${update.name}: ${sourceItem.name}`);
      }

      report.abilities.push({ id: update._id, name: update.name, key: actorKey });
      report.sources.push({ id: sourceId, name: update.name, key: sourceKey });
      if (!apply) continue;

      applyUpdate(actorItem, update);
      applyUpdate(sourceItem, update);
      await actorsDb.put(actorKey, actorItem);
      await itemsDb.put(sourceKey, sourceItem);
    }
  } finally {
    await actorsDb.close();
    await itemsDb.close();
  }

  console.log(
    JSON.stringify({ ...report, ready: report.abilities.length === updates.length }, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
