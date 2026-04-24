import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(__dirname, '..', 'css', 'project-andromeda.css');

test('inventory resources use the same spacing token as item groups', async () => {
  const css = await readFile(cssPath, 'utf8');

  assert.match(
    css,
    /\.project-andromeda\s+\.item-groups\s*\{[\s\S]*?gap:\s*var\(--inventory-section-gap\);/m
  );
  assert.match(
    css,
    /\.project-andromeda\s+\.tab\.inventory\s*>\s*\.sheet-box\s*\{[\s\S]*?margin-top:\s*var\(--inventory-section-gap\);/m
  );
});
