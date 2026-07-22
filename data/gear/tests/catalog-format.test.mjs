import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..', '..', '..');
const catalogRoot = resolve(repoRoot, 'data', 'gear', 'catalog');
const canonicalCatalogs = {
  abilities: 'ability',
  archetypes: 'archetype',
  artifacts: 'artifact',
  traits: 'trait'
};
const catalogNames = [...Object.keys(canonicalCatalogs), 'catalog-manifest', 'concept-abilities'];

test('gear catalogs use canonical two-space JSON formatting', async () => {
  const offenders = [];

  for (const catalogName of catalogNames) {
    const path = resolve(catalogRoot, `${catalogName}.json`);
    const source = await readFile(path, 'utf8');
    const normalized = `${JSON.stringify(JSON.parse(source), null, 2)}\n`;

    if (source !== normalized) {
      offenders.push(catalogName);
    }
  }

  assert.deepEqual(offenders, []);
});

test('canonical gear catalogs use the 0.5 types and stable unique ids', async () => {
  const ids = new Set();

  for (const [catalogName, expectedType] of Object.entries(canonicalCatalogs)) {
    const path = resolve(catalogRoot, `${catalogName}.json`);
    const entries = JSON.parse(await readFile(path, 'utf8'));

    assert.ok(Array.isArray(entries), `${catalogName}.json must contain an array`);
    for (const entry of entries) {
      assert.equal(entry.type, expectedType, `${catalogName}:${entry.id} has an unexpected type`);
      assert.equal(typeof entry.id, 'string', catalogName + ' has a non-string id');
      assert.ok(entry.id.length > 0, catalogName + ' has an empty id');
      assert.ok(!ids.has(entry.id), `duplicate stable catalog id: ${entry.id}`);
      ids.add(entry.id);
    }
  }
});
