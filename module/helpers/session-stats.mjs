import { MODULE_ID, debugLog } from '../config.mjs';

const SETTING_KEYS = Object.freeze({
  current: 'sessionTrackerCurrent',
  history: 'sessionTrackerHistory',
  autoCloseMinutes: 'sessionTrackerAutoCloseMinutes',
  maxHistory: 'sessionTrackerMaxHistory'
});

const SESSION_STATUS_ACTIVE = 'active';
const END_REASON_MANUAL = 'manual';
const END_REASON_AUTO_TIMEOUT = 'auto-last-gm-timeout';
const SESSION_HOOKS = Object.freeze({
  started: 'projectAndromeda.sessionStarted',
  ended: 'projectAndromeda.sessionEnded',
  updated: 'projectAndromeda.sessionStatsUpdated'
});
const UNKNOWN_ACTOR_KEY = 'unknown';
const UNKNOWN_FORMULA_KEY = 'unknown';
const MINUTES_TO_MS = 60_000;

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

function hasWritePermission() {
  return Boolean(game.user?.isGM);
}

export class SessionStatsService {
  constructor() {
    this._beforeUnloadHandler = null;
  }

  initialize() {
    if (!game.user?.isGM) return;
    if (this._beforeUnloadHandler) return;
    this._beforeUnloadHandler = () => {
      void this._markPendingAutoCloseOnBeforeUnload();
    };
    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('beforeunload', this._beforeUnloadHandler);
    }
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

  async startSession({ startedBy } = {}) {
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
      startedBy: startedBy ?? game.user?.id ?? null
    });
    await this._setCurrentSession(session);

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
    const active = this.getActiveSession();
    if (!active) return;

    const pendingAutoCloseAt = Number(active.pendingAutoCloseAt) || 0;
    if (pendingAutoCloseAt && Date.now() >= pendingAutoCloseAt) {
      await this.endSession({
        reason: END_REASON_AUTO_TIMEOUT,
        postSummary: true,
        silent: true
      });
      return;
    }

    await this.handleGMConnectivity();
  }

  async handleGMConnectivity() {
    const active = this.getActiveSession();
    if (!active) return;
    if (!hasWritePermission()) return;
    if (!this._isTrackingAuthority()) return;

    const pendingAutoCloseAt = Number(active.pendingAutoCloseAt) || 0;
    if (!pendingAutoCloseAt) return;

    if (Date.now() >= pendingAutoCloseAt) {
      await this.endSession({
        reason: END_REASON_AUTO_TIMEOUT,
        postSummary: true,
        silent: true
      });
      return;
    }

    active.pendingAutoCloseAt = null;
    await this._setCurrentSession(active);
    this._emitStatsUpdated(active, 'connectivity');
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

  _createSession({ startedBy }) {
    return {
      id: foundry.utils.randomID(16),
      status: SESSION_STATUS_ACTIVE,
      startedAt: Date.now(),
      endedAt: null,
      startedBy: startedBy ?? null,
      endedBy: null,
      endReason: null,
      pendingAutoCloseAt: null,
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
    return normalized;
  }

  _normalizeSession(session) {
    const normalized = duplicateData(session ?? {});
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

  _getAutoCloseMinutes() {
    return clampPositiveInteger(game.settings.get(MODULE_ID, SETTING_KEYS.autoCloseMinutes), 10);
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
    const activeGMs = (game.users?.filter((user) => user.isGM && user.active) ?? []).sort((a, b) =>
      String(a.id).localeCompare(String(b.id))
    );
    const authorityId = activeGMs[0]?.id ?? game.user.id;
    return authorityId === game.user.id;
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

  async _markPendingAutoCloseOnBeforeUnload() {
    if (!hasWritePermission()) return;
    const active = this.getActiveSession();
    if (!active) return;

    const activeGMs = game.users?.filter((user) => user.isGM && user.active) ?? [];
    if (activeGMs.length > 1) return;

    const timeoutMinutes = this._getAutoCloseMinutes();
    active.pendingAutoCloseAt = Date.now() + timeoutMinutes * MINUTES_TO_MS;
    try {
      await this._setCurrentSession(active);
      debugLog('Session tracker queued pending auto-close on unload', {
        sessionId: active.id,
        pendingAutoCloseAt: active.pendingAutoCloseAt
      });
    } catch (error) {
      debugLog('Session tracker failed to queue pending auto-close on unload', {
        sessionId: active.id,
        error
      });
    }
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
