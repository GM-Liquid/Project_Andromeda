import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const templateJsonPath = new URL('../../template.json', import.meta.url);
const template = JSON.parse(readFileSync(templateJsonPath, 'utf8'));

test('new character actors default to rank 1 through the shared base template', () => {
  assert.equal(template.Actor.templates.base.currentRank, 1);

  for (const actorType of ['playerCharacter', 'minion', 'rankAndFile', 'elite']) {
    assert.deepEqual(template.Actor[actorType].templates, ['base']);
  }
});
