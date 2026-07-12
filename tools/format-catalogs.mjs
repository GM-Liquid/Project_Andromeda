import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const catalogNames = [
  'abilities',
  'archetypes',
  'armor',
  'catalog-manifest',
  'concept-abilities',
  'equipment',
  'traits'
];

const repoRoot = resolve(import.meta.dirname, '..');
const catalogRoot = resolve(repoRoot, 'data', 'gear', 'catalog');

for (const catalogName of catalogNames) {
  const catalogPath = resolve(catalogRoot, `${catalogName}.json`);
  const source = await readFile(catalogPath, 'utf8');
  const normalized = `${JSON.stringify(JSON.parse(source), null, 2)}\n`;

  if (source !== normalized) {
    await writeFile(catalogPath, normalized, 'utf8');
    console.log(`Formatted ${catalogName}.json`);
  }
}
