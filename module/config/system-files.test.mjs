import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), 'utf8'));
}

function collectLeafKeys(value, prefix = '', result = []) {
  for (const [key, entry] of Object.entries(value ?? {})) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      collectLeafKeys(entry, nextPrefix, result);
    } else {
      result.push(nextPrefix);
    }
  }
  return result.sort((left, right) => left.localeCompare(right));
}

test('shipped JSON files parse and English/Russian localization keys stay in parity', async () => {
  const [manifest, template, en, ru] = await Promise.all([
    readJson('system.json'),
    readJson('template.json'),
    readJson('lang/en.json'),
    readJson('lang/ru.json')
  ]);

  assert.equal(manifest.id, 'project-andromeda');
  assert.match(manifest.version, /^\d+\.\d+\.\d+\.\d+$/u);
  assert.ok(Array.isArray(template.Actor?.types));
  assert.ok(Array.isArray(template.Item?.types));
  assert.deepEqual(collectLeafKeys(ru), collectLeafKeys(en));

  for (const actorType of template.Actor.types) {
    assert.equal(typeof en.TYPES?.Actor?.[actorType], 'string', `missing EN Actor type ${actorType}`);
    assert.equal(typeof ru.TYPES?.Actor?.[actorType], 'string', `missing RU Actor type ${actorType}`);
  }
  for (const itemType of template.Item.types) {
    assert.equal(typeof en.TYPES?.Item?.[itemType], 'string', `missing EN Item type ${itemType}`);
    assert.equal(typeof ru.TYPES?.Item?.[itemType], 'string', `missing RU Item type ${itemType}`);
  }
});

test('manifest runtime entrypoints, styles, and localization files exist', async () => {
  const manifest = await readJson('system.json');
  const runtimePaths = [
    ...(manifest.esmodules ?? []),
    ...(manifest.styles ?? []),
    ...(manifest.languages ?? []).map((language) => language.path)
  ];

  await Promise.all(runtimePaths.map((relativePath) => access(path.join(repoRoot, relativePath))));
});
