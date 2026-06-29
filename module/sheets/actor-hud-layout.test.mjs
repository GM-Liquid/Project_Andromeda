import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('actor sheet HUD uses the new two-row grid architecture', () => {
  const template = readFile('templates/actor/partials/actor-sheet-content.hbs');
  const stylesheet = readFile('css/project-andromeda.css');

  assert.match(template, /<div class='andromeda-hud__identity-row'>/);
  assert.match(template, /<div class='andromeda-hud__rank-column'>/);
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-hud__main \{[\s\S]*grid-template-columns:/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-hud__main \{[\s\S]*align-self:\s*start;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-hud__stats-row \{[\s\S]*display:\s*grid;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-hud__rank-column \{[\s\S]*grid-area:\s*rank;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-hud--player \.andromeda-hud__stats-row \{[\s\S]*grid-template-columns:/
  );
});

test('player-character HUD uses the updated progression label and no-wrap stat captions', () => {
  const template = readFile('templates/actor/partials/actor-sheet-content.hbs');
  const stylesheet = readFile('css/project-andromeda.css');
  const english = JSON.parse(readFile('lang/en.json'));

  assert.match(template, /MY_RPG\.KeyInfo\.ProgressPoints/);
  assert.match(template, /data-field='system\.advancement\.totalSpent'/);
  assert.match(template, /andromeda-status-card--rank-progress/);
  assert.equal(english.MY_RPG.KeyInfo.ProgressPoints, 'Progression Points');
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-hud__stats-row > \.andromeda-status-card > span \{[\s\S]*white-space:\s*nowrap;/
  );
});

test('progression points show for every actor type and the shared GM pool is boss-only', () => {
  const template = readFile('templates/actor/partials/actor-sheet-content.hbs');

  // The progression-points card lives in the rank column and is no longer gated to
  // player characters, so minions / standards / bosses display it too.
  const rankColumn = template.match(
    /<div class='andromeda-hud__rank-column'>[\s\S]*?<\/div>\s*<\/header>/
  )?.[0];
  assert.ok(rankColumn);
  assert.match(rankColumn, /andromeda-status-card--rank-progress/);
  assert.doesNotMatch(rankColumn, /\{\{#if isPlayerCharacter\}\}/);

  // The shared GM Highlight Points pool is rendered only for bosses (isElite),
  // not for every GM character.
  assert.match(template, /\{\{#if isElite\}\}[\s\S]*MY_RPG\.KeyInfo\.SharedMomentOfGlory/);
  assert.doesNotMatch(
    template,
    /\{\{#if isGmCharacter\}\}[\s\S]*MY_RPG\.KeyInfo\.SharedMomentOfGlory/
  );
});

test('rank control uses a visible tile label instead of a hover tooltip', () => {
  const template = readFile('templates/actor/partials/actor-sheet-content.hbs');
  const stylesheet = readFile('css/project-andromeda.css');

  assert.match(template, /class='andromeda-hud__rank-title'/);
  assert.doesNotMatch(template, /data-rank-tooltip=/);
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-hud__rank-title \{[\s\S]*text-transform:\s*uppercase;/
  );
  assert.doesNotMatch(stylesheet, /\.project-andromeda \.andromeda-hud__rank::after/);
  assert.doesNotMatch(stylesheet, /\.project-andromeda \.andromeda-hud__rank:hover::after/);
});

test('HUD stat grid keeps stress and progression columns compact', () => {
  const stylesheet = readFile('css/project-andromeda.css');

  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-hud--player \.andromeda-hud__stats-row \{[\s\S]*grid-template-areas:\s*'stress glory'\s*'speed archetype';[\s\S]*grid-template-columns:\s*4\.75rem 8rem;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-hud--gm \.andromeda-hud__stats-row \{[\s\S]*grid-template-areas:\s*'stress'\s*'speed';[\s\S]*grid-template-columns:\s*4\.75rem;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda\.elite \.andromeda-hud--gm \.andromeda-hud__stats-row \{[\s\S]*grid-template-areas:\s*'stress glory'\s*'speed glory';[\s\S]*grid-template-columns:\s*4\.75rem 8rem;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-hud--player \.andromeda-status-card--speed \{[\s\S]*grid-area:\s*speed;[\s\S]*justify-self:\s*start;[\s\S]*width:\s*4\.75rem;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-hud--player \.andromeda-status-card--stress \{[\s\S]*grid-area:\s*stress;[\s\S]*justify-self:\s*start;[\s\S]*width:\s*4\.75rem;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-hud--player \.andromeda-status-card--aside \{[\s\S]*grid-area:\s*glory;[\s\S]*justify-self:\s*start;[\s\S]*width:\s*8rem;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-hud__rank-column \.andromeda-status-card--rank-progress \{[\s\S]*width:\s*100%;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-hud--player \.andromeda-hud__stats-row \{[\s\S]*justify-content:\s*flex-start;[\s\S]*justify-items:\s*start;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-hud--player \.andromeda-status-card--speed,\s*\.project-andromeda \.andromeda-hud--player \.andromeda-status-card--stress \{[\s\S]*text-align:\s*center;/
  );
});

test('skill rail renders a flat skill list with no category headers or 2d8 formula', () => {
  const template = readFile('templates/actor/partials/actor-sheet-content.hbs');

  assert.match(template, /<section class='andromeda-skills-block'>/);
  assert.match(template, /\{\{#each skillList as \|skill\|\}\}/);
  // The Body / Mind / Spirit category headings and per-category roll formula are gone.
  assert.doesNotMatch(template, /andromeda-skill-formula/);
  assert.doesNotMatch(template, /\{\{#each skillColumns/);
});

test('defenses live in a dedicated rail block and lock when the archetype sets them', () => {
  const template = readFile('templates/actor/partials/actor-sheet-content.hbs');

  assert.match(template, /<section class='andromeda-defense-block'>/);
  assert.match(template, /<h2>\{\{localize 'MY_RPG\.SheetLabels\.Defenses'\}\}<\/h2>/);
  assert.match(template, /\{\{#each defenseRows as \|defense\|\}\}/);

  const defenseInput = template.match(
    /<input\s+class='andromeda-defense-row__input'[\s\S]*?\/>/
  )?.[0];
  assert.ok(defenseInput);
  assert.match(defenseInput, /name='\{\{defense\.path\}\}'/);
  // Defenses become read-only only when the archetype-derived profile is active.
  assert.match(defenseInput, /\{\{#if defense\.locked\}\}[\s\S]*readonly[\s\S]*\{\{\/if\}\}/);
  assert.doesNotMatch(template, /andromeda-defense-lock-hint/);
});

test('rank is shown as a Roman numeral in view mode and a number input in edit mode', () => {
  const template = readFile('templates/actor/partials/actor-sheet-content.hbs');
  const stylesheet = readFile('css/project-andromeda.css');

  assert.match(
    template,
    /<span class='skill-rank-roman \{\{skill\.rankClass\}\}'[\s\S]*?\{\{skill\.rankRoman\}\}/
  );
  assert.match(
    template,
    /<span class='andromeda-hud__rank-value'[\s\S]*?\{\{system\.currentRankRoman\}\}/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda\.andromeda-play-mode \.andromeda-skill-row \.skill-rank-input,[\s\S]*display:\s*none;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda\.andromeda-edit-mode \.andromeda-skill-row \.skill-rank-roman,[\s\S]*display:\s*none;/
  );
});

test('HUD exposes temporary defense fields', () => {
  const template = readFile('templates/actor/partials/actor-sheet-content.hbs');

  assert.match(template, /name='system\.tempfortitude'/);
  assert.match(template, /name='system\.tempcontrol'/);
  assert.match(template, /name='system\.tempwill'/);
  assert.match(template, /MY_RPG\.Temp\.BonusFortitudeLabel/);
  assert.match(template, /MY_RPG\.Temp\.BonusControlLabel/);
  assert.match(template, /MY_RPG\.Temp\.BonusWillLabel/);
});

test('personality tab presents motivation and feature before complications', () => {
  const template = readFile('templates/actor/partials/actor-sheet-content.hbs');
  const english = JSON.parse(readFile('lang/en.json'));
  const russian = JSON.parse(readFile('lang/ru.json'));
  const motivationIndex = template.indexOf("{{localize 'MY_RPG.Personality.Weakness'}}");
  const featureIndex = template.indexOf("{{localize 'MY_RPG.Personality.Feature'}}");
  const complicationsIndex = template.indexOf('{{#if personalityValueGroup}}');

  assert.ok(motivationIndex >= 0);
  assert.ok(featureIndex > motivationIndex);
  assert.ok(complicationsIndex > featureIndex);
  assert.match(template, /name='system\.biography\.weakness'/);
  assert.equal(english.MY_RPG.Personality.Weakness, 'Motivation');
  assert.equal(russian.MY_RPG.Personality.Weakness, 'Мотивация');
  assert.equal(english.MY_RPG.ItemGroups.Values, 'Complications');
  assert.equal(russian.MY_RPG.ItemGroups.Values, 'Осложнения');
});

test('actor sheet uses fixed chrome with a separate content viewport', () => {
  const template = readFile('templates/actor/partials/actor-sheet-content.hbs');
  const stylesheet = readFile('css/project-andromeda.css');
  const actorSheet = readFile('module/sheets/actor-sheet.mjs');

  assert.doesNotMatch(template, /andromeda-edit-mode-toggle/);
  assert.match(actorSheet, /_syncSheetEditModeHeaderButton/);
  assert.match(
    stylesheet,
    /\.window-app\.project-andromeda\.sheet\.actor \.window-header \{[\s\S]*position:\s*relative;/
  );
  assert.match(
    stylesheet,
    /\.window-app\.project-andromeda\.sheet\.actor \.window-header \.andromeda-edit-mode-toggle \{[\s\S]*position:\s*absolute;[\s\S]*left:\s*\d+px;/
  );
  assert.match(actorSheet, /dblclick\.projectAndromedaEditMode[\s\S]*event\.stopPropagation\(\);/);
  assert.match(template, /<div class='andromeda-sheet-chrome'>/);
  assert.match(template, /<div class='andromeda-sheet-viewport'>/);
  assert.match(template, /<div class='andromeda-sheet-pane-scroll sheet-scrollable'>/);
  assert.match(
    actorSheet,
    /static get defaultOptions\(\) \{[\s\S]*width:\s*860,[\s\S]*height:\s*800,[\s\S]*minWidth:\s*ACTOR_SHEET_MIN_WIDTH,/
  );
  assert.match(actorSheet, /const ACTOR_SHEET_MIN_WIDTH = 730;/);
  assert.match(
    actorSheet,
    /setPosition\(position = \{\}\) \{[\s\S]*Math\.max\(Number\(nextPosition\.width\), ACTOR_SHEET_MIN_WIDTH\);/
  );
  assert.match(
    stylesheet,
    /\.window-app\.project-andromeda\.sheet\.actor \{[\s\S]*min-width:\s*730px;/
  );
  assert.match(
    stylesheet,
    /\.window-app\.project-andromeda\.sheet\.actor \.window-content \{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*overflow:\s*hidden;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda\.sheet\.actor form \{[\s\S]*flex:\s*1 1 auto;[\s\S]*height:\s*100%;[\s\S]*overflow:\s*hidden;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-sheet-shell \{[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*1fr\);/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-sheet-chrome \{[\s\S]*display:\s*grid;[\s\S]*grid-template-rows:\s*auto auto;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-sheet-viewport \{[\s\S]*overflow:\s*hidden;[\s\S]*background:\s*var\(--andromeda-color-surface,\s*var\(--andromeda-fallback-surface\)\);/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-sheet-workspace \{[\s\S]*grid-template-columns:\s*276px minmax\(0,\s*1fr\);/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-sheet-workspace \{[\s\S]*height:\s*100%;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-sheet-rail \{[\s\S]*overflow:\s*hidden;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-sheet-pane-scroll\.sheet-scrollable \{[\s\S]*height:\s*100%;[\s\S]*background:\s*var\(--andromeda-color-surface,\s*var\(--andromeda-fallback-surface\)\);/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-sheet-pane-scroll\.sheet-scrollable::-webkit-scrollbar-track \{[\s\S]*background:\s*var\(--andromeda-color-surface,\s*var\(--andromeda-fallback-surface\)\);/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-list \{[\s\S]*list-style:\s*none;[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-row__header \{[\s\S]*display:\s*flex;[\s\S]*flex-wrap:\s*wrap;[\s\S]*align-items:\s*center;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-row__name img \{[\s\S]*width:\s*26px;[\s\S]*height:\s*26px;[\s\S]*object-fit:\s*cover;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-row__actions \{[\s\S]*display:\s*flex;[\s\S]*margin-left:\s*auto;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.item-row__summary \{[\s\S]*margin-top:\s*0\.5rem;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-rail-header \{[\s\S]*justify-content:\s*center;/
  );
});
