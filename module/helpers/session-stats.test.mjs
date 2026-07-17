import assert from 'node:assert/strict';
import test from 'node:test';

import { SessionStatsService } from './session-stats.mjs';

const settings = {
  sessionTrackerCurrent: {},
  sessionTrackerHistory: [],
  sessionTrackerMaxHistory: 50
};
const users = [{ id: 'gm', isGM: true, active: true }];
users.get = (id) => users.find((user) => user.id === id);

globalThis.foundry = {
  utils: {
    deepClone: structuredClone,
    randomID: () => 'session-id',
    escapeHTML: (value) => String(value)
  }
};
globalThis.CONFIG = {
  ProjectAndromeda: {
    skills: {
      sokrytie: 'MY_RPG.Skill.Sokrytie'
    }
  }
};
globalThis.game = {
  user: users[0],
  users,
  actors: new Map(),
  settings: {
    get: (_moduleId, key) => settings[key],
    async set(_moduleId, key, value) {
      settings[key] = value;
    }
  },
  i18n: {
    localize: (key) => (key === 'MY_RPG.Skill.Sokrytie' ? 'Stealth' : key)
  }
};
globalThis.Hooks = { callAll: () => {} };
globalThis.ui = { notifications: { info: () => {}, warn: () => {} } };

test('skill-check session stats keep one final outcome after a shift', async () => {
  settings.sessionTrackerCurrent = {};
  const service = new SessionStatsService();
  const session = await service.startSession({ startedBy: 'gm', requiredPlayerIds: ['player'] });
  assert.equal(session.id, 'session-id');
  const message = {
    id: 'message-1',
    rolls: [{ formula: '2d8 + @mod', total: 10 }],
    speaker: { actor: 'actor-1' },
    getFlag: (_moduleId, key) =>
      key === 'skillCheck'
        ? {
            skill: 'sokrytie',
            skillLabel: 'Stealth',
            sourceName: 'Shadow Step',
            outcome: 'SuccessWithCost',
            shift: 0
          }
        : null
  };

  await service.recordRoll(message);
  let active = service.getActiveSession();
  assert.equal(active.stats.rolls.total, 1);
  assert.equal(active.stats.skillChecks.total, 1);
  assert.deepEqual(active.stats.skillChecks.byOutcome, { SuccessWithCost: 1 });
  assert.deepEqual(active.stats.skillChecks.byCheckOutcome, {
    'Shadow Step (Stealth)': { SuccessWithCost: 1 }
  });

  message.getFlag = (_moduleId, key) =>
    key === 'skillCheck'
      ? {
          skill: 'sokrytie',
          skillLabel: 'Stealth',
          sourceName: 'Shadow Step',
          outcome: 'SuccessWithCost',
          shift: 1
        }
      : key === 'momentOfGlory'
        ? { spent: 1, actorId: 'actor-1' }
        : null;
  await service.recordMessageUpdate(message, { skillCheck: true, momentOfGlory: true });

  active = service.getActiveSession();
  assert.equal(active.stats.rolls.total, 1);
  assert.equal(active.stats.skillChecks.total, 1);
  assert.deepEqual(active.stats.skillChecks.byOutcome, { Success: 1 });
  assert.deepEqual(active.stats.skillChecks.byCheckOutcome, {
    'Shadow Step (Stealth)': { Success: 1 }
  });
  assert.deepEqual(active.stats.skillChecks.bySource, { 'Shadow Step': 1 });
  assert.equal(active.stats.momentOfGlory.totalUses, 1);
});

test('concurrent session starts share one session and issue one start hook', async () => {
  settings.sessionTrackerCurrent = {};
  let starts = 0;
  const originalCallAll = Hooks.callAll;
  Hooks.callAll = (hook) => {
    if (hook === 'projectAndromeda.sessionStarted') starts += 1;
  };

  try {
    const service = new SessionStatsService();
    const [first, second] = await Promise.all([
      service.startSession({ startedBy: 'gm', requiredPlayerIds: ['player'] }),
      service.startSession({ startedBy: 'gm', requiredPlayerIds: ['player'] })
    ]);

    assert.equal(first.id, 'session-id');
    assert.equal(second.id, first.id);
    assert.equal(starts, 1);
  } finally {
    Hooks.callAll = originalCallAll;
  }
});

test('a session can claim its starting hero-point grant only once', async () => {
  settings.sessionTrackerCurrent = {};
  const service = new SessionStatsService();
  const session = await service.startSession({ startedBy: 'gm', requiredPlayerIds: ['player'] });

  const [firstClaim, secondClaim] = await Promise.all([
    service.claimSessionStartHeroPointGrant(session.id),
    service.claimSessionStartHeroPointGrant(session.id)
  ]);

  assert.deepEqual([firstClaim, secondClaim], [true, false]);
  assert.equal(service.getActiveSession().heroPointsGranted, true);
});
