/**
 * Compile the shipped gear catalog JSON into the `gear-library` compendium pack.
 *
 * Source of truth stays in `data/gear/catalog/{armor,equipment,abilities}.json`
 * (mirrored from the private docs repo). This reuses the same JSON -> Item-system
 * transform the runtime uses (`buildGearCatalogRemoteDataFromCatalogs`) so the pack
 * never drifts from the catalog. The pack itself is a build artifact: it is rebuilt
 * here locally and in CI, and is not committed to git.
 *
 * Usage: node tools/build-pack.mjs
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ClassicLevel } from 'classic-level';
import {
  GEAR_CATALOG_SYNC_ID_FLAG,
  GEAR_CATALOG_SYNC_SYSTEM_JSON_COLUMN,
  buildGearCatalogRemoteDataFromCatalogs
} from '../module/helpers/gear-catalog.mjs';
import { MODULE_ID } from '../module/config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIR = path.join(ROOT, 'data', 'gear', 'catalog');
const PACK_PATH = path.join(ROOT, 'packs', 'gear-library');
const CATALOG_FILES = {
  armor: 'armor.json',
  equipment: 'equipment.json',
  abilities: 'abilities.json'
};

// Foundry document ids are 16-char [A-Za-z0-9]. Derive them deterministically from
// the stable catalog sync id so that rebuilding the pack keeps the same ids — and
// therefore the same compendium UUIDs that actor items link to.
function makeId(seed) {
  const hash = createHash('sha256')
    .update(String(seed))
    .digest('base64')
    .replace(/[^a-zA-Z0-9]/g, '');
  return hash.slice(0, 16).padEnd(16, '0');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function main() {
  const systemJson = await readJson(path.join(ROOT, 'system.json'));
  const systemVersion = String(systemJson.version ?? '');

  const catalogs = {};
  for (const [key, filename] of Object.entries(CATALOG_FILES)) {
    catalogs[key] = await readJson(path.join(CATALOG_DIR, filename));
  }

  const remote = buildGearCatalogRemoteDataFromCatalogs(catalogs);

  // Build the folder tree (e.g. "Броня/Ранг 1") from each row's folderPath.
  const folderDocs = new Map();
  const ensureFolderPath = (segments) => {
    let parentId = null;
    let accumulated = '';
    for (const segment of segments) {
      accumulated = accumulated ? `${accumulated}/${segment}` : segment;
      if (!folderDocs.has(accumulated)) {
        const id = makeId(`folder:${accumulated}`);
        folderDocs.set(accumulated, {
          _id: id,
          _key: `!folders!${id}`,
          name: segment,
          type: 'Item',
          folder: parentId,
          sorting: 'a',
          color: null,
          flags: {},
          _stats: { systemId: MODULE_ID, systemVersion }
        });
      }
      parentId = folderDocs.get(accumulated)._id;
    }
    return parentId;
  };

  const itemDocs = [];
  let sortCounter = 0;
  for (const sheetKey of Object.keys(remote.sheets)) {
    for (const row of remote.sheets[sheetKey]) {
      sortCounter += 1;
      const syncId = String(row.syncId ?? '');
      if (!syncId) continue;
      const id = makeId(syncId);
      const segments = String(row.folderPath ?? '')
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean);
      const folderId = segments.length ? ensureFolderPath(segments) : null;
      const system = JSON.parse(row[GEAR_CATALOG_SYNC_SYSTEM_JSON_COLUMN] ?? '{}');

      itemDocs.push({
        _id: id,
        _key: `!items!${id}`,
        name: String(row.name ?? ''),
        type: String(row.type ?? ''),
        img: 'icons/svg/item-bag.svg',
        system,
        folder: folderId,
        sort: sortCounter * 100000,
        ownership: { default: 0 },
        flags: { [MODULE_ID]: { [GEAR_CATALOG_SYNC_ID_FLAG]: syncId } },
        _stats: { systemId: MODULE_ID, systemVersion }
      });
    }
  }

  const db = new ClassicLevel(PACK_PATH, { keyEncoding: 'utf8', valueEncoding: 'json' });
  await db.open();
  await db.clear();
  const batch = db.batch();
  for (const folder of folderDocs.values()) batch.put(folder._key, folder);
  for (const item of itemDocs) batch.put(item._key, item);
  await batch.write();

  let itemCount = 0;
  let folderCount = 0;
  for await (const key of db.keys()) {
    if (key.startsWith('!items!')) itemCount += 1;
    else if (key.startsWith('!folders!')) folderCount += 1;
  }
  await db.close();

  console.log(`Built compendium pack at ${path.relative(ROOT, PACK_PATH)}`);
  console.log(`  items:   ${itemCount} (expected ${itemDocs.length})`);
  console.log(`  folders: ${folderCount} (expected ${folderDocs.size})`);

  if (itemCount !== itemDocs.length || folderCount !== folderDocs.size) {
    throw new Error('Pack verification failed: stored key count does not match built documents');
  }
}

main().catch((error) => {
  console.error('Pack build failed:', error);
  process.exit(1);
});
