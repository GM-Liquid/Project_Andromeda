import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

function readText(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const { buildRollRerollSpec, rerollRollPreservingContext } = await import(
  '../helpers/roll-reroll.mjs'
);

test('reroll spec preserves formula, data, and options without sharing mutable references', () => {
  const sourceRoll = {
    formula: '1d8 + @mod',
    data: { mod: 3, nested: { effect: 2 } },
    options: { maximize: false, flavor: 'source' }
  };

  const spec = buildRollRerollSpec(sourceRoll);

  assert.deepEqual(spec, {
    formula: '1d8 + @mod',
    data: { mod: 3, nested: { effect: 2 } },
    options: { maximize: false, flavor: 'source' }
  });

  spec.data.nested.effect = 9;
  spec.options.flavor = 'changed';

  assert.equal(sourceRoll.data.nested.effect, 2);
  assert.equal(sourceRoll.options.flavor, 'source');
});

test('reroll spec falls back to resolved roll terms when formula data is unavailable', () => {
  const sourceRoll = {
    formula: '1d8 + @mod',
    data: {},
    terms: [{ formula: '1d8' }, { operator: '+' }, { formula: '3' }]
  };

  const spec = buildRollRerollSpec(sourceRoll);

  assert.equal(spec.formula, '1d8 + 3');
  assert.deepEqual(spec.data, {});
});

test('reroll helper creates a fresh evaluated roll from the preserved roll context', async () => {
  class FakeRoll {
    constructor(formula, data, options) {
      this.formula = formula;
      this.data = data;
      this.options = options;
      this.evaluated = false;
    }

    async roll(options) {
      this.rollOptions = options;
      this.evaluated = true;
      return this;
    }
  }

  const sourceRoll = new FakeRoll('1d10 + @mod', { mod: 5 }, { reliableTalent: true });
  sourceRoll.evaluated = true;

  const reroll = await rerollRollPreservingContext(sourceRoll);

  assert.notEqual(reroll, sourceRoll);
  assert.equal(reroll.formula, '1d10 + @mod');
  assert.deepEqual(reroll.data, { mod: 5 });
  assert.deepEqual(reroll.options, { reliableTalent: true });
  assert.deepEqual(reroll.rollOptions, { async: true });
  assert.equal(reroll.evaluated, true);
});

test('chat context menu exposes both Highlight Point bonus and reroll actions', () => {
  const systemEntrypoint = readText('module/project-andromeda.mjs');

  assert.match(systemEntrypoint, /MomentOfGloryBonus\.ContextLabel/);
  assert.match(systemEntrypoint, /MomentOfGloryReroll\.ContextLabel/);
  assert.match(systemEntrypoint, /applyMomentOfGloryRerollToMessage/);
  assert.match(systemEntrypoint, /rerollRollPreservingContext/);
});
