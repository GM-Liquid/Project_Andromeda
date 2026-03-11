import { MODULE_ID, debugLog } from '../config.mjs';

const SETTING_KEYS = Object.freeze({
  current: 'sessionTrackerCurrent',
  history: 'sessionTrackerHistory',
  maxHistory: 'sessionTrackerMaxHistory'
});

const SESSION_STATUS_ACTIVE = 'active';
const END_REASON_MANUAL = 'manual';
const END_REASON_AUTO_PARTICIPANT_TIMEOUT = 'auto-participant-timeout';
const SESSION_HOOKS = Object.freeze({
  started: 'projectAndromeda.sessionStarted',
  ended: 'projectAndromeda.sessionEnded',
  updated: 'projectAndromeda.sessionStatsUpdated'
});
const UNKNOWN_ACTOR_KEY = 'unknown';
const UNKNOWN_FORMULA_KEY = 'unknown';
const MINUTES_TO_MS = 60_000;
const PARTICIPANT_TIMEOUT_MINUTES = 15;
const PARTICIPANT_TIMEOUT_MS = PARTICIPANT_TIMEOUT_MINUTES * MINUTES_TO_MS;
const PRESENCE_EVALUATION_DELAY_MS = 250;

function duplicateData(value) {
  return foundry.utils.deepClone(value);
}

function clampPositiveInteger(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(Math.floor(numeric), 1);
}

function normalizeCounterMap(value) {
  const source = value && typeof value === 'object' ? value : {};
  const normalized = {};
  for (const [key, amount] of Object.entries(source)) {
    const name = String(key || '').trim();
    if (!name) continue;
    const count = Number(amount);
    normalized[name] = Number.isFinite(count) ? Math.max(Math.floor(count), 0) : 0;
  }
  return normalized;
}

function normalizeIdArray(value) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.map((entry) => String(entry || '').trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
}

function normalizeTimestampMap(value) {
  const source = value && typeof value === 'object' ? value : {};
  const normalized = {};
  for (const [key, amount] of Object.entries(source)) {
    const name = String(key || '').trim();
    if (!name) continue;
    const timestamp = Number(amount);
    if (!Number.isFinite(timestamp) || timestamp <= 0) continue;
    normalized[name] = Math.floor(timestamp);
  }
  return normalized;
}

function areArraysEqual(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function areTimestampMapsEqual(left, right) {
  const leftKeys = Object.keys(left ?? {}).sort((a, b) => a.localeCompare(b));
  const rightKeys = Object.keys(right ?? {}).sort((a, b) => a.localeCompare(b));
  if (!areArraysEqual(leftKeys, rightKeys)) return false;
  return leftKeys.every((key) => Number(left[key]) === Number(right[key]));
}

function getActiveGMIds() {
  return (game.users?.filter((user) => user.isGM && user.active) ?? [])
    .map((user) => String(user.id || '').trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function getTrackedPlayerUsers() {
  const minimumRole = CONST.USER_ROLES?.PLAYER ?? 1;
  return (game.users?.filter(
    (user) => !user.isGM && Number(user.role ?? 0) >= minimumRole
  ) ?? [])
    .slice()
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
}

function hasWritePermission() {
  return Boolean(game.user?.isGM);
}

export class SessionStatsService {
  constructor() {
    this._presenceEvaluationTimer = null;
  }

  initialize() {
    if (!game.user?.isGM) return;
    this._clearPresenceEvaluationTimer();
  }

  getActiveSession() {
    const current = this._getCurrentSessionSetting();
    if (!current?.id) return null;
    if (current.status !== SESSION_STATUS_ACTIVE) return null;
    return this._normalizeSession(current);
  }

  getLastSession() {
    const history = this._getHistorySetting();
    if (!history.length) return null;
    return this._normalizeSession(history[0]);
  }

  schedulePresenceEvaluation(delayMs = PRESENCE_EVALUATION_DELAY_MS) {
    if (!game.user?.isGM) return;
    this._clearPresenceEvaluationTimer();

    const delay = Math.max(Math.floor(Number(delayMs) || 0), 0);
    if (typeof globalThis.setTimeout !== 'function') {
      void this.evaluatePresence();
      return;
    }

    this._presenceEvaluationTimer = globalThis.setTimeout(() => {
      this._presenceEvaluationTimer = null;
      void this.evaluatePresence();
    }, delay);
  }

  async startSession({ startedBy, requiredPlayerIds = null } = {}) {
    if (!hasWritePermission()) {
      ui.notifications.warn(game.i18n.localize('MY_RPG.SessionTracker.Notifications.RequireGM'));
      return null;
    }

    const active = this.getActiveSession();
    if (active) {
      ui.notifications.warn(game.i18n.localize('MY_RPG.SessionTracker.Notifications.AlreadyActive'));
      return active;
    }

    const session = this._createSession({
      startedBy: startedBy ?? game.user?.id ?? null,
      requiredPlayerIds: requiredPlayerIds ?? this._getDefaultRequiredPlayerIds()
    });
    await this._setCurrentSession(session);
    this._clearPresenceEvaluationTimer();

    ui.notifications.info(game.i18n.localize('MY_RPG.SessionTracker.Notifications.Started'));
    Hooks.callAll(SESSION_HOOKS.started, duplicateData(session));
    debugLog('Session tracker started session', {
      sessionId: session.id,
      startedBy: session.startedBy
    });
    return session;
  }

  async endSession({
    reason = END_REASON_MANUAL,
    endedBy = null,
    postSummary = true,
    silent = false
  } = {}) {
    if (!hasWritePermission()) {
      if (!silent) {
        ui.notifications.warn(game.i18n.localize('MY_RPG.SessionTracker.Notifications.RequireGM'));
      }
      return null;
    }

    const active = this.getActiveSession();
    if (!active) {
      if (!silent) {
        ui.notifications.warn(game.i18n.localize('MY_RPG.SessionTracker.Notifications.NoActiveSession'));
      }
      return null;
    }

    const finalized = this._finalizeSession(active, {
      reason,
      endedBy: endedBy ?? game.user?.id ?? null
    });

    const history = this._getHistorySetting();
    history.unshift(finalized);
    const maxHistory = this._getMaxHistory();
    const trimmedHistory = history.slice(0, maxHistory);

    await this._setCurrentSession({});
    await this._setHistory(trimmedHistory);
    this._clearPresenceEvaluationTimer();

    if (postSummary) {
      await this._postSessionSummary(finalized);
    }

    if (!silent) {
      ui.notifications.info(game.i18n.localize('MY_RPG.SessionTracker.Notifications.Ended'));
    }

    Hooks.callAll(SESSION_HOOKS.ended, duplicateData(finalized));
    debugLog('Session tracker ended session', {
      sessionId: finalized.id,
      endedBy: finalized.endedBy,
      reason: finalized.endReason
    });
    return finalized;
  }

  async recoverStateOnReady() {
    if (!game.user?.isGM) return;
    await this.evaluatePresence();
  }

  async evaluatePresence() {
    if (!hasWritePermission()) return;
    if (!this._isTrackingAuthority()) {
      this._clearPresenceEvaluationTimer();
      return null;
    }

    const active = this.getActiveSession();
    const presence = this._getPresenceState(active);

    if (!active) {
      this._clearPresenceEvaluationTimer();
      if (!presence.canStart) return null;
      return this.startSession({
        startedBy: game.user?.id ?? null,
        requiredPlayerIds: presence.requiredPlayerIds
      });
    }

    const nextState = this._applyPresenceState(active, presence);
    if (nextState.shouldEnd) {
      this._clearPresenceEvaluationTimer();
      await this.endSession({
        reason: END_REASON_AUTO_PARTICIPANT_TIMEOUT,
        postSummary: true,
        silent: true
      });
      return null;
    }

    if (nextState.changed) {
      await this._setCurrentSession(nextState.session);
      this._emitStatsUpdated(nextState.session, 'presence');
    }

    this._schedulePresenceEvaluationAt(nextState.session.pendingAutoCloseAt);
    return nextState.session;
  }

  async recordRoll(message) {
    if (!this._isTrackingAuthority()) return;
    if (!this._isRollMessage(message)) return;

    const active = this.getActiveSession();
    if (!active) return;

    const formulas = this._extractRollFormulas(message);
    const rollCount = Math.max(formulas.length, 1);
    const actorKey = this._extractActorKey(message);
    const rolls = active.stats.rolls;

    rolls.total += rollCount;
    rolls.byActor[actorKey] = (Number(rolls.byActor[actorKey]) || 0) + rollCount;

    for (const formula of formulas) {
      rolls.byFormula[formula] = (Number(rolls.byFormula[formula]) || 0) + 1;
    }

    this._recordMomentOfGloryUsageFromMessage(active, message);

    await this._setCurrentSession(active);
    this._emitStatsUpdated(active, 'roll');
  }

  async recordCombatEvent(eventName) {
    if (!this._isTrackingAuthority()) return;
    const active = this.getActiveSession();
    if (!active) return;

    const combat = active.stats.combat;
    switch (eventName) {
      case 'encounter-start':
        combat.encountersStarted += 1;
        break;
      case 'encounter-end':
        combat.encountersEnded += 1;
        break;
      case 'round-advance':
        combat.roundAdvances += 1;
        break;
      case 'turn-advance':
        combat.turnAdvances += 1;
        break;
      default:
        return;
    }

    await this._setCurrentSession(active);
    this._emitStatsUpdated(active, 'combat');
  }

  _createSession({ startedBy, requiredPlayerIds }) {
    return {
      id: foundry.utils.randomID(16),
      status: SESSION_STATUS_ACTIVE,
      startedAt: Date.now(),
      endedAt: null,
      startedBy: startedBy ?? null,
      endedBy: null,
      endReason: null,
      pendingAutoCloseAt: null,
      presence: this._createPresenceState(requiredPlayerIds),
      stats: this._createEmptyStats()
    };
  }

  _finalizeSession(session, { reason, endedBy }) {
    const normalized = this._normalizeSession(session);
    normalized.status = 'ended';
    normalized.endedAt = Date.now();
    normalized.endedBy = endedBy ?? null;
    normalized.endReason = reason ?? END_REASON_MANUAL;
    normalized.pendingAutoCloseAt = null;
    normalized.presence.offlineSinceByParticipant = {};
    return normalized;
  }

  _normalizeSession(session) {
    const normalized = duplicateData(session ?? {});
    normalized.presence ??= this._createPresenceState();
    normalized.presence.requiredPlayerIds = normalizeIdArray(normalized.presence.requiredPlayerIds);
    normalized.presence.offlineSinceByParticipant = normalizeTimestampMap(
      normalized.presence.offlineSinceByParticipant
    );
    normalized.stats ??= this._createEmptyStats();
    normalized.stats.rolls ??= this._createEmptyStats().rolls;
    normalized.stats.combat ??= this._createEmptyStats().combat;
    normalized.stats.momentOfGlory ??= this._createEmptyStats().momentOfGlory;
    normalized.stats.rolls.total = Math.max(Number(normalized.stats.rolls.total) || 0, 0);
    normalized.stats.rolls.byActor = normalizeCounterMap(normalized.stats.rolls.byActor);
    normalized.stats.rolls.byFormula = normalizeCounterMap(normalized.stats.rolls.byFormula);
    normalized.stats.combat.encountersStarted = Math.max(
      Number(normalized.stats.combat.encountersStarted) || 0,
      0
    );
    normalized.stats.combat.encountersEnded = Math.max(
      Number(normalized.stats.combat.encountersEnded) || 0,
      0
    );
    normalized.stats.combat.roundAdvances = Math.max(
      Number(normalized.stats.combat.roundAdvances) || 0,
      0
    );
    normalized.stats.combat.turnAdvances = Math.max(
      Number(normalized.stats.combat.turnAdvances) || 0,
      0
    );
    normalized.stats.momentOfGlory.totalUses = Math.max(
      Number(normalized.stats.momentOfGlory.totalUses) || 0,
      0
    );
    normalized.stats.momentOfGlory.byActor = normalizeCounterMap(
      normalized.stats.momentOfGlory.byActor
    );
    normalized.pendingAutoCloseAt = normalized.pendingAutoCloseAt
      ? Number(normalized.pendingAutoCloseAt)
      : null;
    return normalized;
  }

  _createPresenceState(requiredPlayerIds = []) {
    return {
      requiredPlayerIds: normalizeIdArray(requiredPlayerIds),
      offlineSinceByParticipant: {}
    };
  }

  _createEmptyStats() {
    return {
      rolls: {
        total: 0,
        byActor: {},
        byFormula: {}
      },
      combat: {
        encountersStarted: 0,
        encountersEnded: 0,
        roundAdvances: 0,
        turnAdvances: 0
      },
      momentOfGlory: {
        totalUses: 0,
        byActor: {}
      }
    };
  }

  _getCurrentSessionSetting() {
    const value = game.settings.get(MODULE_ID, SETTING_KEYS.current);
    if (!value || typeof value !== 'object') return {};
    return duplicateData(value);
  }

  _getHistorySetting() {
    const value = game.settings.get(MODULE_ID, SETTING_KEYS.history);
    if (!Array.isArray(value)) return [];
    return duplicateData(value);
  }

  _getMaxHistory() {
    return clampPositiveInteger(game.settings.get(MODULE_ID, SETTING_KEYS.maxHistory), 50);
  }

  async _setCurrentSession(session) {
    await game.settings.set(MODULE_ID, SETTING_KEYS.current, duplicateData(session ?? {}));
  }

  async _setHistory(history) {
    await game.settings.set(MODULE_ID, SETTING_KEYS.history, duplicateData(history ?? []));
  }

  _isTrackingAuthority() {
    if (!game.user?.isGM) return false;
    const activeGMs = getActiveGMIds();
    const authorityId = activeGMs[0] ?? game.user.id;
    return authorityId === game.user.id;
  }

  _getDefaultRequiredPlayerIds() {
    return getTrackedPlayerUsers().map((user) => String(user.id));
  }

  _getRequiredPlayerIds(session) {
    const current = normalizeIdArray(session?.presence?.requiredPlayerIds);
    if (current.length) return current;
    return this._getDefaultRequiredPlayerIds();
  }

  _getPresenceState(session = null) {
    const requiredPlayerIds = this._getRequiredPlayerIds(session);
    const activeGMIds = getActiveGMIds();
    const offlineParticipantIds = [];

    for (const userId of requiredPlayerIds) {
      if (game.users?.get(userId)?.active) continue;
      offlineParticipantIds.push(userId);
    }

    return {
      requiredPlayerIds,
      offlineParticipantIds,
      canStart: Boolean(activeGMIds.length) && Boolean(requiredPlayerIds.length) && !offlineParticipantIds.length
    };
  }

  _applyPresenceState(session, presence) {
    const normalized = this._normalizeSession(session);
    const previousRequiredPlayerIds = normalized.presence.requiredPlayerIds;
    const previousOfflineSince = normalized.presence.offlineSinceByParticipant;
    const previousPendingAutoCloseAt = Number(normalized.pendingAutoCloseAt) || 0;
    const nextOfflineSince = {};
    const now = Date.now();

    for (const participantId of presence.offlineParticipantIds) {
      nextOfflineSince[participantId] = Number(previousOfflineSince[participantId]) || now;
    }

    const deadlines = Object.values(nextOfflineSince)
      .map((startedAt) => startedAt + PARTICIPANT_TIMEOUT_MS)
      .sort((left, right) => left - right);
    const pendingAutoCloseAt = deadlines[0] ?? null;

    normalized.presence.requiredPlayerIds = presence.requiredPlayerIds;
    normalized.presence.offlineSinceByParticipant = nextOfflineSince;
    normalized.pendingAutoCloseAt = pendingAutoCloseAt;

    return {
      session: normalized,
      changed:
        !areArraysEqual(previousRequiredPlayerIds, presence.requiredPlayerIds) ||
        !areTimestampMapsEqual(previousOfflineSince, nextOfflineSince) ||
        previousPendingAutoCloseAt !== Number(pendingAutoCloseAt || 0),
      shouldEnd: Boolean(pendingAutoCloseAt && now >= pendingAutoCloseAt)
    };
  }

  _extractActorKey(message) {
    const actorId = String(message?.speaker?.actor ?? '').trim();
    if (actorId) return actorId;
    return UNKNOWN_ACTOR_KEY;
  }

  _extractRollFormulas(message) {
    const rolls = Array.isArray(message?.rolls)
      ? message.rolls
      : message?.roll
        ? [message.roll]
        : [];
    if (!rolls.length) return [UNKNOWN_FORMULA_KEY];

    const formulas = [];
    for (const roll of rolls) {
      const formula = String(roll?.formula ?? '').trim();
      formulas.push(formula || UNKNOWN_FORMULA_KEY);
    }
    return formulas;
  }

  _isRollMessage(message) {
    if (!message) return false;
    if (Array.isArray(message.rolls) && message.rolls.length) return true;
    if (message.roll) return true;
    return Boolean(message.isRoll);
  }

  _recordMomentOfGloryUsageFromMessage(session, message) {
    const flag =
      message?.getFlag?.(MODULE_ID, 'momentOfGlory') ?? message?.flags?.[MODULE_ID]?.momentOfGlory;
    if (!flag || typeof flag !== 'object') return;
    const spent = Math.max(Math.floor(Number(flag.spent) || 0), 0);
    if (!spent) return;

    const actorKey = String(flag.actorId || '').trim() || UNKNOWN_ACTOR_KEY;
    const stats = session.stats.momentOfGlory;
    stats.totalUses += spent;
    stats.byActor[actorKey] = (Number(stats.byActor[actorKey]) || 0) + spent;
  }

  _emitStatsUpdated(session, source) {
    Hooks.callAll(SESSION_HOOKS.updated, {
      source,
      sessionId: session.id,
      stats: duplicateData(session.stats)
    });
  }

  _schedulePresenceEvaluationAt(timestamp) {
    if (!timestamp) {
      this._clearPresenceEvaluationTimer();
      return;
    }
    this.schedulePresenceEvaluation(Math.max(Number(timestamp) - Date.now(), 0));
  }

  _clearPresenceEvaluationTimer() {
    if (!this._presenceEvaluationTimer) return;
    if (typeof globalThis.clearTimeout === 'function') {
      globalThis.clearTimeout(this._presenceEvaluationTimer);
    }
    this._presenceEvaluationTimer = null;
  }

  async _postSessionSummary(session) {
    const rolls = session?.stats?.rolls ?? this._createEmptyStats().rolls;
    const combat = session?.stats?.combat ?? this._createEmptyStats().combat;
    const momentOfGlory = session?.stats?.momentOfGlory ?? this._createEmptyStats().momentOfGlory;
    const startedAt = this._formatDateTime(session.startedAt);
    const endedAt = this._formatDateTime(session.endedAt);
    const duration = this._formatDuration(session.startedAt, session.endedAt);
    const reasonKey = `MY_RPG.SessionTracker.EndReasons.${session.endReason ?? END_REASON_MANUAL}`;
    const reason = game.i18n.localize(reasonKey);

    const actorRows = this._buildCounterListItems(rolls.byActor, (key) => this._resolveActorLabel(key));
    const formulaRows = this._buildCounterListItems(rolls.byFormula, (key) => key);
    const momentRows = this._buildCounterListItems(momentOfGlory.byActor, (key) =>
      this._resolveActorLabel(key)
    );

    const content = `
      <section class="project-andromeda-session-summary">
        <h2>${this._escape(game.i18n.localize('MY_RPG.SessionTracker.Summary.Title'))}</h2>
        <p><strong>${this._escape(game.i18n.localize('MY_RPG.SessionTracker.Summary.StartedAt'))}:</strong> ${this._escape(startedAt)}</p>
        <p><strong>${this._escape(game.i18n.localize('MY_RPG.SessionTracker.Summary.EndedAt'))}:</strong> ${this._escape(endedAt)}</p>
        <p><strong>${this._escape(game.i18n.localize('MY_RPG.SessionTracker.Summary.Duration'))}:</strong> ${this._escape(duration)}</p>
        <p><strong>${this._escape(game.i18n.localize('MY_RPG.SessionTracker.Summary.EndReason'))}:</strong> ${this._escape(reason)}</p>
        <hr>
        <p><strong>${this._escape(game.i18n.localize('MY_RPG.SessionTracker.Summary.RollsTotal'))}:</strong> ${rolls.total}</p>
        <p><strong>${this._escape(game.i18n.localize('MY_RPG.SessionTracker.Summary.EncountersStarted'))}:</strong> ${combat.encountersStarted}</p>
        <p><strong>${this._escape(game.i18n.localize('MY_RPG.SessionTracker.Summary.EncountersEnded'))}:</strong> ${combat.encountersEnded}</p>
        <p><strong>${this._escape(game.i18n.localize('MY_RPG.SessionTracker.Summary.RoundAdvances'))}:</strong> ${combat.roundAdvances}</p>
        <p><strong>${this._escape(game.i18n.localize('MY_RPG.SessionTracker.Summary.TurnAdvances'))}:</strong> ${combat.turnAdvances}</p>
        <p><strong>${this._escape(game.i18n.localize('MY_RPG.SessionTracker.Summary.MomentOfGloryUsesTotal'))}:</strong> ${momentOfGlory.totalUses}</p>
        <h3>${this._escape(game.i18n.localize('MY_RPG.SessionTracker.Summary.RollsByActor'))}</h3>
        <ul>${actorRows}</ul>
        <h3>${this._escape(game.i18n.localize('MY_RPG.SessionTracker.Summary.RollsByFormula'))}</h3>
        <ul>${formulaRows}</ul>
        <h3>${this._escape(game.i18n.localize('MY_RPG.SessionTracker.Summary.MomentOfGloryByActor'))}</h3>
        <ul>${momentRows}</ul>
      </section>
    `;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({
        alias: game.i18n.localize('MY_RPG.SessionTracker.Summary.Speaker')
      }),
      content: content.trim()
    });
  }

  _buildCounterListItems(map, formatKey) {
    const entries = Object.entries(map ?? {}).sort((a, b) => Number(b[1]) - Number(a[1]));
    if (!entries.length) {
      return `<li>${this._escape(game.i18n.localize('MY_RPG.SessionTracker.Summary.None'))}</li>`;
    }

    return entries
      .map(([key, count]) => {
        const label = formatKey ? formatKey(key) : key;
        return `<li>${this._escape(label)}: ${Number(count) || 0}</li>`;
      })
      .join('');
  }

  _resolveActorLabel(actorKey) {
    if (!actorKey || actorKey === UNKNOWN_ACTOR_KEY) {
      return game.i18n.localize('MY_RPG.SessionTracker.Summary.UnknownActor');
    }
    return game.actors?.get(actorKey)?.name ?? actorKey;
  }

  _formatDateTime(timestamp) {
    const value = Number(timestamp) || 0;
    if (!value) return game.i18n.localize('MY_RPG.SessionTracker.Summary.NotAvailable');
    const locale = game.i18n?.lang || 'en';
    return new Date(value).toLocaleString(locale);
  }

  _formatDuration(startedAt, endedAt) {
    const start = Number(startedAt) || 0;
    const end = Number(endedAt) || 0;
    if (!start || !end || end < start) {
      return game.i18n.localize('MY_RPG.SessionTracker.Summary.NotAvailable');
    }

    const totalMinutes = Math.max(Math.floor((end - start) / MINUTES_TO_MS), 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return game.i18n.format('MY_RPG.SessionTracker.Summary.DurationHoursMinutes', {
        hours,
        minutes
      });
    }
    return game.i18n.format('MY_RPG.SessionTracker.Summary.DurationMinutes', { minutes });
  }

  _escape(value) {
    return foundry.utils.escapeHTML(String(value ?? ''));
  }
}
