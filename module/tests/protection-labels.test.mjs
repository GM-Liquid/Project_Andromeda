import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

function readText(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

test('core localizations define the new protection labels and remove the legacy label keys', () => {
  const en = readJson('lang/en.json').MY_RPG;
  const ru = readJson('lang/ru.json').MY_RPG;

  assert.deepEqual(en.Defenses, {
    FortitudeLabel: 'Fortitude',
    ControlLabel: 'Control',
    WillLabel: 'Will'
  });
  assert.deepEqual(ru.Defenses, {
    FortitudeLabel: 'Стойкость',
    ControlLabel: 'Контроль',
    WillLabel: 'Воля'
  });

  assert.equal(en.ArmorItem.BonusFortitudeLabel, 'Bonus to Fortitude');
  assert.equal(en.ArmorItem.BonusControlLabel, 'Bonus to Control');
  assert.equal(en.ArmorItem.BonusWillLabel, 'Bonus to Will');
  assert.equal(ru.ArmorItem.BonusFortitudeLabel, 'Бонус к Стойкости');
  assert.equal(ru.ArmorItem.BonusControlLabel, 'Бонус к Контролю');
  assert.equal(ru.ArmorItem.BonusWillLabel, 'Бонус к Воле');

  assert.equal(en.Temp.BonusFortitudeLabel, 'Temp. Fortitude');
  assert.equal(en.Temp.BonusControlLabel, 'Temp. Control');
  assert.equal(en.Temp.BonusWillLabel, 'Temp. Will');
  assert.equal(ru.Temp.BonusFortitudeLabel, 'Врем. Стойкость');
  assert.equal(ru.Temp.BonusControlLabel, 'Врем. Контроль');
  assert.equal(ru.Temp.BonusWillLabel, 'Врем. Воля');

  assert.equal(en.GoogleSheetsSync.Headers.ItemFortitude, 'Fortitude');
  assert.equal(en.GoogleSheetsSync.Headers.ItemControl, 'Control');
  assert.equal(en.GoogleSheetsSync.Headers.ItemWill, 'Will');
  assert.equal(ru.GoogleSheetsSync.Headers.ItemFortitude, 'Стойкость');
  assert.equal(ru.GoogleSheetsSync.Headers.ItemControl, 'Контроль');
  assert.equal(ru.GoogleSheetsSync.Headers.ItemWill, 'Воля');

  assert.equal('PhysicalLabel' in en.Defenses, false);
  assert.equal('MagicalLabel' in en.Defenses, false);
  assert.equal('PsychicLabel' in en.Defenses, false);
  assert.equal('BonusPhysicalLabel' in en.ArmorItem, false);
  assert.equal('BonusMagicalLabel' in en.ArmorItem, false);
  assert.equal('BonusPsychicLabel' in en.ArmorItem, false);
  assert.equal('BonusPhysicalLabel' in en.Temp, false);
  assert.equal('BonusMagicalLabel' in en.Temp, false);
  assert.equal('BonusPsychicLabel' in en.Temp, false);
  assert.equal('ItemPhys' in en.GoogleSheetsSync.Headers, false);
  assert.equal('ItemAzure' in en.GoogleSheetsSync.Headers, false);
  assert.equal('ItemMental' in en.GoogleSheetsSync.Headers, false);
});

test('templates and helpers reference only the new protection label keys', () => {
  const actorSheet = readText('templates/actor/partials/actor-sheet-content.hbs');
  const armorSheet = readText('templates/item/armor-sheet.hbs');
  const itemConfig = readText('module/helpers/item-config.mjs');
  const actorSheetClass = readText('module/sheets/actor-sheet.mjs');
  const googleSheetsSync = readText('module/helpers/google-sheets-sync.mjs');

  assert.match(actorSheet, /MY_RPG\.Defenses\.FortitudeLabel/);
  assert.match(actorSheet, /MY_RPG\.Defenses\.ControlLabel/);
  assert.match(actorSheet, /MY_RPG\.Defenses\.WillLabel/);
  assert.doesNotMatch(actorSheet, /MY_RPG\.Defenses\.(Physical|Magical|Psychic)Label/);

  assert.match(actorSheet, /MY_RPG\.Temp\.BonusFortitudeLabel/);
  assert.match(actorSheet, /MY_RPG\.Temp\.BonusControlLabel/);
  assert.match(actorSheet, /MY_RPG\.Temp\.BonusWillLabel/);
  assert.doesNotMatch(actorSheet, /MY_RPG\.Temp\.Bonus(Physical|Magical|Psychic)Label/);

  assert.match(armorSheet, /MY_RPG\.ArmorItem\.BonusFortitudeLabel/);
  assert.match(armorSheet, /MY_RPG\.ArmorItem\.BonusControlLabel/);
  assert.match(armorSheet, /MY_RPG\.ArmorItem\.BonusWillLabel/);
  assert.doesNotMatch(armorSheet, /MY_RPG\.ArmorItem\.Bonus(Physical|Magical|Psychic)Label/);

  assert.match(itemConfig, /MY_RPG\.ArmorItem\.BonusFortitudeLabel/);
  assert.match(itemConfig, /MY_RPG\.ArmorItem\.BonusControlLabel/);
  assert.match(itemConfig, /MY_RPG\.ArmorItem\.BonusWillLabel/);
  assert.doesNotMatch(itemConfig, /MY_RPG\.ArmorItem\.Bonus(Physical|Magical|Psychic)Label/);

  assert.match(actorSheetClass, /MY_RPG\.ArmorItem\.BonusFortitudeLabel/);
  assert.match(actorSheetClass, /MY_RPG\.ArmorItem\.BonusControlLabel/);
  assert.match(actorSheetClass, /MY_RPG\.ArmorItem\.BonusWillLabel/);
  assert.doesNotMatch(actorSheetClass, /MY_RPG\.ArmorItem\.Bonus(Physical|Magical|Psychic)Label/);

  assert.match(googleSheetsSync, /MY_RPG\.GoogleSheetsSync\.Headers\.ItemFortitude/);
  assert.match(googleSheetsSync, /MY_RPG\.GoogleSheetsSync\.Headers\.ItemControl/);
  assert.match(googleSheetsSync, /MY_RPG\.GoogleSheetsSync\.Headers\.ItemWill/);
  assert.doesNotMatch(googleSheetsSync, /MY_RPG\.GoogleSheetsSync\.Headers\.Item(Phys|Azure|Mental)/);
});

test('the main system no longer imports or ships the temporary protection-label override file', () => {
  const systemEntrypoint = readText('module/project-andromeda.mjs');

  assert.doesNotMatch(systemEntrypoint, /defense-formulas-test\.mjs/);
  assert.equal(existsSync(path.join(rootDir, 'module/tests/defense-formulas-test.mjs')), false);
});
