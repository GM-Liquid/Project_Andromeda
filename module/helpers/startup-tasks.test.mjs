import assert from 'node:assert/strict';
import test from 'node:test';

import { runStartupTasks } from './startup-tasks.mjs';

test('startup tasks run sequentially', async () => {
  const calls = [];
  const results = await runStartupTasks([
    {
      name: 'first',
      run: async () => {
        calls.push('first');
        return 1;
      }
    },
    {
      name: 'second',
      run: async () => {
        calls.push('second');
        return 2;
      }
    }
  ]);

  assert.deepEqual(calls, ['first', 'second']);
  assert.deepEqual(
    results.map(({ name, status, value }) => ({ name, status, value })),
    [
      { name: 'first', status: 'fulfilled', value: 1 },
      { name: 'second', status: 'fulfilled', value: 2 }
    ]
  );
});

test('independent startup failures are reported and do not block later tasks', async () => {
  const failure = new Error('failed');
  const errors = [];
  const calls = [];

  const results = await runStartupTasks(
    [
      {
        name: 'optional',
        continueOnError: true,
        run: async () => {
          throw failure;
        }
      },
      {
        name: 'required',
        run: async () => calls.push('required')
      }
    ],
    { onError: (entry) => errors.push(entry) }
  );

  assert.deepEqual(calls, ['required']);
  assert.deepEqual(errors, [{ name: 'optional', error: failure }]);
  assert.equal(results[0].status, 'rejected');
  assert.equal(results[1].status, 'fulfilled');
});

test('required startup failures stop the remaining chain', async () => {
  const failure = new Error('migration failed');
  let laterTaskRan = false;

  await assert.rejects(
    runStartupTasks([
      { name: 'migration', run: async () => Promise.reject(failure) },
      {
        name: 'later migration',
        run: async () => {
          laterTaskRan = true;
        }
      }
    ]),
    failure
  );
  assert.equal(laterTaskRan, false);
});
