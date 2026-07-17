import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const MIGRATION_VERSION = 2;
const MODULE_ID = 'project-andromeda';
const ACTOR_MIGRATION_FLAG = 'legacyWorld312MigrationVersion';
const HERO_POINT_MAX = 3;
const PLAYER_STRESS_PER_RANK = 5;
const SKILL_MAPPINGS = Object.freeze({
  programmirovanie: 'khakerstvo',
  bionika: 'mistika'
});

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function clampInteger(value, minimum, maximum) {
  return Math.max(minimum, Math.min(Math.trunc(Number(value) || 0), maximum));
}

function mapSkillKey(key) {
  return SKILL_MAPPINGS[key] ?? key;
}

function buildSkills(actor, currentSkillKeys) {
  const values = new Map(currentSkillKeys.map((key) => [key, 0]));
  const mappingsApplied = [];
  const unresolved = [];

  for (const [oldKey, oldSkill] of Object.entries(actor.system?.skills ?? {})) {
    const targetKey = mapSkillKey(oldKey);
    if (!values.has(targetKey)) {
      if (Number(oldSkill?.value) > 0) unresolved.push({ oldKey, value: oldSkill.value });
      continue;
    }
    const oldValue = Number(oldSkill?.value) || 0;
    const value = clampInteger(oldValue, 0, 4);
    values.set(targetKey, Math.max(values.get(targetKey) ?? 0, value));
    if (targetKey !== oldKey) {
      mappingsApplied.push({
        from: oldKey,
        to: targetKey,
        oldValue,
        migratedValue: value,
        clamped: oldValue !== value
      });
    }
  }

  return {
    skills: Object.fromEntries([...values].map(([key, value]) => [key, { rank: 1, value }])),
    mappingsApplied,
    unresolved
  };
}

function buildBiography(actor) {
  const biography = actor.system?.biography ?? {};
  return {
    feature: String(biography.feature ?? ''),
    weakness: String(biography.weakness ?? ''),
    temperament: String(biography.temperament ?? ''),
    archetype: '',
    appearance: String(biography.appearance ?? ''),
    backstory: String(biography.backstory ?? biography.story ?? '')
  };
}

function buildAbilityUpdates(row) {
  return (row.items ?? [])
    .filter((item) => item.type === 'trait-source-ability')
    .map((item) => {
      const oldSkill = String(item.system?.skill ?? '').trim();
      const skill = mapSkillKey(oldSkill);
      return {
        _id: item._id,
        name: item.name,
        update: {
          _id: item._id,
          'system.skill': skill,
          'system.requiresRoll': Boolean(skill),
          'system.rank': '',
          [`system.details.${ACTOR_MIGRATION_FLAG}`]: {
            version: MIGRATION_VERSION,
            originalType: item.type,
            keptUnrankedAndFree: true
          },
          [`flags.${MODULE_ID}.${ACTOR_MIGRATION_FLAG}`]: MIGRATION_VERSION
        }
      };
    });
}

function buildActorPlan(row, currentSkillKeys) {
  const actor = row.actor;
  const rank = clampInteger(actor.system?.currentRank, 1, 4);
  const skillPlan = buildSkills(actor, currentSkillKeys);
  const stressMaximum = PLAYER_STRESS_PER_RANK * rank;
  const stressValue = clampInteger(actor.system?.stress?.value, 0, stressMaximum);
  const heroPoints = clampInteger(actor.system?.momentOfGlory, 0, HERO_POINT_MAX);
  const abilityUpdates = buildAbilityUpdates(row);

  return {
    actorId: actor._id,
    actorName: actor.name,
    actorType: actor.type,
    migrationVersion: MIGRATION_VERSION,
    archetype: null,
    decisions: {
      archetype: 'left-empty-for-player-choice',
      defenses: 'reset-to-rank-until-archetype-choice',
      skillRank: 'all-skills-start-at-rank-1',
      skillValue: 'preserve-old-value-clamped-to-0-4',
      legacyAbilities: 'keep-unranked-and-free-until-curated'
    },
    changes: {
      heroPoints: { from: actor.system?.momentOfGlory ?? 0, to: heroPoints },
      defenses: {
        from: actor.system?.defenses ?? {},
        to: { fortitude: rank, control: rank, will: rank }
      },
      skills: skillPlan,
      abilities: abilityUpdates.map((entry) => entry.name)
    },
    actorUpdate: {
      'system.currentRank': rank,
      'system.momentOfGlory': heroPoints,
      'system.skills': skillPlan.skills,
      'system.skills.-=programmirovanie': null,
      'system.skills.-=bionika': null,
      'system.defenses': { fortitude: rank, control: rank, will: rank },
      'system.defenses.-=physical': null,
      'system.defenses.-=azure': null,
      'system.defenses.-=mental': null,
      'system.tempfortitude': 0,
      'system.tempcontrol': 0,
      'system.tempwill': 0,
      'system.stress.value': stressValue,
      'system.stress.marked': Array.isArray(actor.system?.stress?.marked)
        ? actor.system.stress.marked
        : [],
      'system.biography': buildBiography(actor),
      'system.-=abilities': null,
      'system.-=tempphys': null,
      'system.-=tempazure': null,
      'system.-=tempmental': null,
      [`flags.${MODULE_ID}.${ACTOR_MIGRATION_FLAG}`]: MIGRATION_VERSION
    },
    abilityUpdates
  };
}

function buildMacro(plan) {
  const serializedPlan = JSON.stringify(plan, null, 2);
  return `// Generated one-time migration for Project Andromeda world 312.
// Run once with APPLY=false for validation. To apply intentionally, first run:
// globalThis.PROJECT_ANDROMEDA_APPLY_LEGACY_312 = true
await (async () => {
  const APPLY = globalThis.PROJECT_ANDROMEDA_APPLY_LEGACY_312 === true;
  const MODULE_ID = ${JSON.stringify(MODULE_ID)};
  const FLAG = ${JSON.stringify(ACTOR_MIGRATION_FLAG)};
  const VERSION = ${MIGRATION_VERSION};
  const plan = ${serializedPlan};
  const report = { apply: APPLY, ready: true, actors: [], errors: [] };

  if (!game.user?.isGM) throw new Error('Миграцию может запустить только GM.');
  if (String(game.world?.id ?? '') !== '312' && String(game.world?.id ?? '') !== '312-migration') {
    throw new Error('Неверный мир: ' + (game.world?.id ?? '—'));
  }

  for (const entry of plan.actors) {
    const actor = game.actors.get(entry.actorId);
    const actorReport = { actorId: entry.actorId, actorName: entry.actorName, status: 'ready', missingItems: [] };
    report.actors.push(actorReport);
    if (!actor) {
      actorReport.status = 'missing-actor';
      report.errors.push('Не найден актёр ' + entry.actorName + ' (' + entry.actorId + ')');
      continue;
    }
    if (actor.name !== entry.actorName) {
      actorReport.status = 'name-mismatch';
      report.errors.push('Имя актёра ' + entry.actorId + ': ожидалось «' + entry.actorName + '», найдено «' + actor.name + '»');
      continue;
    }
    const completedVersion = Number(actor.getFlag(MODULE_ID, FLAG)) || 0;
    if (completedVersion >= VERSION) {
      actorReport.status = 'already-completed';
      continue;
    }
    for (const itemEntry of entry.abilityUpdates) {
      if (!actor.items.get(itemEntry._id)) actorReport.missingItems.push(itemEntry._id);
    }
    if (actorReport.missingItems.length) {
      actorReport.status = 'missing-items';
      report.errors.push('У ' + entry.actorName + ' не найдены предметы: ' + actorReport.missingItems.join(', '));
    }
  }

  report.ready = report.errors.length === 0;
  if (!APPLY || !report.ready) {
    console.table(report.actors);
    console.log('Project Andromeda migration dry-run', report, plan);
    ui.notifications[report.ready ? 'info' : 'error'](
      report.ready
        ? 'Проверка миграции прошла: изменения не применены.'
        : 'Проверка миграции нашла ошибки. См. консоль.'
    );
    return report;
  }

  for (const entry of plan.actors) {
    const actor = game.actors.get(entry.actorId);
    if (!actor || Number(actor.getFlag(MODULE_ID, FLAG)) >= VERSION) continue;
    const updates = entry.abilityUpdates
      .filter((itemEntry) => actor.items.get(itemEntry._id))
      .map((itemEntry) => itemEntry.update);
    if (updates.length) await actor.updateEmbeddedDocuments('Item', updates, { render: false });
    await actor.update(entry.actorUpdate, { render: false });
    actor.prepareData();
  }

  console.log('Project Andromeda migration applied', report, plan);
  ui.notifications.info('Миграция персонажей мира 312 завершена.');
  return report;
})();
`;
}

const [snapshotArg, templateArg, outputArg] = process.argv.slice(2);
if (!snapshotArg || !templateArg || !outputArg) {
  fail(
    'Usage: node build-migration-plan.mjs <pc-snapshot.json> <template.json> <output-directory>'
  );
} else {
  const snapshot = readJson(path.resolve(snapshotArg));
  const template = readJson(path.resolve(templateArg));
  const outputDirectory = path.resolve(outputArg);
  const currentSkillKeys = Object.keys(template?.Actor?.templates?.base?.skills ?? {});
  const plan = {
    migration: 'legacy-world-312-player-characters',
    version: MIGRATION_VERSION,
    generatedAt: new Date().toISOString(),
    actors: snapshot.map((row) => buildActorPlan(row, currentSkillKeys))
  };

  const unresolved = plan.actors.flatMap((actor) => actor.changes.skills.unresolved);
  if (unresolved.length) {
    fail(`Unresolved skill mappings: ${JSON.stringify(unresolved)}`);
  } else {
    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(outputDirectory, 'migration-plan.json'),
      `${JSON.stringify(plan, null, 2)}\n`
    );
    fs.writeFileSync(path.join(outputDirectory, 'foundry-migration.js'), buildMacro(plan));
    console.log(
      JSON.stringify(
        {
          outputDirectory,
          actors: plan.actors.length,
          abilities: plan.actors.reduce((total, actor) => total + actor.abilityUpdates.length, 0),
          archetypesAssigned: 0
        },
        null,
        2
      )
    );
  }
}
