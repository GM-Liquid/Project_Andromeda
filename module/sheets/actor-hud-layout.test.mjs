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
  assert.match(stylesheet, /\.project-andromeda \.andromeda-hud__main \{[\s\S]*grid-template-columns:/);
  assert.match(stylesheet, /\.project-andromeda \.andromeda-hud__main \{[\s\S]*align-self:\s*start;/);
  assert.match(stylesheet, /\.project-andromeda \.andromeda-hud__stats-row \{[\s\S]*display:\s*grid;/);
  assert.match(stylesheet, /\.project-andromeda \.andromeda-hud__rank-column \{[\s\S]*grid-area:\s*rank;/);
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
  assert.match(template, /andromeda-status-card--rank-progress/);
  assert.equal(english.MY_RPG.KeyInfo.ProgressPoints, 'Progression Points');
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-hud__stats-row > \.andromeda-status-card > span \{[\s\S]*white-space:\s*nowrap;/
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
    /\.project-andromeda \.andromeda-hud--gm \.andromeda-hud__stats-row \{[\s\S]*grid-template-columns:\s*3\.5rem 4\.75rem 14\.5rem;/
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

test('ability die badges are centered within the ability header block', () => {
  const stylesheet = readFile('css/project-andromeda.css');

  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-ability-summary \{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\);/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-ability-roll \{[\s\S]*display:\s*contents;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-ability-title \{[\s\S]*grid-column:\s*1;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-ability-die \{[\s\S]*grid-column:\s*2;[\s\S]*justify-self:\s*center;/
  );
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-defense-pill \{[\s\S]*grid-column:\s*3;[\s\S]*justify-content:\s*flex-end;/
  );
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
  assert.match(
    actorSheet,
    /dblclick\.projectAndromedaEditMode[\s\S]*event\.stopPropagation\(\);/
  );
  assert.match(template, /<div class='andromeda-sheet-chrome'>/);
  assert.match(template, /<div class='andromeda-sheet-viewport'>/);
  assert.match(template, /<div class='andromeda-sheet-pane-scroll sheet-scrollable'>/);
  assert.match(
    actorSheet,
    /static get defaultOptions\(\) \{[\s\S]*width:\s*860,[\s\S]*height:\s*780,[\s\S]*minWidth:\s*ACTOR_SHEET_MIN_WIDTH,/
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
