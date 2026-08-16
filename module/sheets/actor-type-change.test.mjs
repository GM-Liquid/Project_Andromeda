import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.ActorSheet ??= class {};

const { updateActorDocumentType } = await import('./actor-sheet.mjs');

test('actor type changes use the non-recursive Foundry document update required by v13', async () => {
  const updates = [];
  const actor = {
    type: 'playerCharacter',
    update: async (...args) => updates.push(args)
  };

  assert.equal(await updateActorDocumentType(actor, 'elite'), true);
  assert.deepEqual(updates, [[{ type: 'elite' }, { recursive: false }]]);
});

test('actor type changes ignore unsupported and unchanged types', async () => {
  const actor = {
    type: 'elite',
    update: async () => assert.fail('actor.update must not be called')
  };

  assert.equal(await updateActorDocumentType(actor, 'elite'), false);
  assert.equal(await updateActorDocumentType(actor, 'unsupported'), false);
});
