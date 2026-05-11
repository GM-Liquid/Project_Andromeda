import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('system manifest no longer ships the temporary palette lab stylesheet', () => {
  const manifest = JSON.parse(readFile('system.json'));

  assert.equal(manifest.styles.includes('css/palette-lab.css'), false);
});

test('runtime code no longer references the temporary palette lab app', () => {
  const actorSheet = readFile('module/sheets/actor-sheet.mjs');
  const systemEntry = readFile('module/project-andromeda.mjs');

  assert.equal(actorSheet.includes('openPaletteLabApp'), false);
  assert.equal(actorSheet.includes('PaletteLab'), false);
  assert.equal(systemEntry.includes('openPaletteLabApp'), false);
  assert.equal(systemEntry.includes('initializePaletteLabPreview'), false);
});

test('atlantic ember is baked into the shipped theme tokens', () => {
  const uiColors = readFile('css/ui-colors.css');

  assert.match(uiColors, /--andromeda-raw-chrome:\s*#094067;/);
  assert.match(uiColors, /--andromeda-raw-bg:\s*#f6f0e5;/);
  assert.match(uiColors, /--andromeda-raw-panel:\s*#f0ece5;/);
  assert.match(uiColors, /--andromeda-raw-accent-600:\s*#a64632;/);
  assert.match(uiColors, /--andromeda-raw-charcoal-900:\s*#182430;/);
});
