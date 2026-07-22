import { MODULE_ID } from '../config.mjs';
import {
  INITIATIVE_SIDE_HEROES,
  INITIATIVE_SIDE_OPPONENTS,
  advanceInitiativeTurn,
  buildInitiativeTurnPlan,
  createInitiativeState,
  getCombatantInitiativeSide,
  normalizeInitiativeSide,
  normalizeInitiativeState,
  rewindInitiativeTurn,
  selectInitiativeCombatant
} from '../helpers/initiative.mjs';

export const INITIATIVE_STATE_FLAG = 'initiativeState';
export const INITIATIVE_STARTING_SIDE_FLAG = 'initiativeStartingSide';
export const INITIATIVE_SIDE_FLAG = 'initiativeSide';
export const INITIATIVE_EXTRA_TURN_FLAG = 'initiativeExtraTurnOf';

const INITIATIVE_STATE_PATH = `flags.${MODULE_ID}.${INITIATIVE_STATE_FLAG}`;

/**
 * Combat tracker for Andromeda's alternating, side-based initiative.
 * Each Combatant document is one turn slot; a boss with multiple turns uses
 * additional Combatant documents which reference the same token.
 */
export class ProjectAndromedaCombat extends Combat {
  setupTurns() {
    this.turns ||= [];
    const combatants = getCombatants(this);
    const turns = [...combatants].sort(compareCombatantsForTracker);

    // Preserve Foundry's setupTurns contract. Core callers deliberately ignore
    // the return value and expect this method to update the document state.
    if (this.turn !== null) {
      if (this.turn < 0) this.turn = 0;
      else if (this.turn >= turns.length) {
        this.turn = 0;
        this.round++;
      }
    }

    const combatant = turns[this.turn];
    this.current = this._getCurrentState(combatant);
    if (!this.previous) this.previous = this.current;
    return (this.turns = turns);
  }

  getAndromedaInitiativePlan(combatants = getCombatants(this)) {
    return buildInitiativeTurnPlan(
      combatants.map((combatant) => getCombatantSlot(combatant)),
      this.getAndromedaInitiativeState()
    );
  }

  getAndromedaInitiativeState() {
    const startingSide = normalizeInitiativeSide(
      this.getFlag(MODULE_ID, INITIATIVE_STARTING_SIDE_FLAG),
      INITIATIVE_SIDE_HEROES
    );
    return normalizeInitiativeState(this.getFlag(MODULE_ID, INITIATIVE_STATE_FLAG), {
      round: Math.max(1, Number(this.round) || 1),
      startingSide
    });
  }

  getAndromedaTurnIndex(combatantId) {
    const turns = this.turns?.length ? this.turns : this.setupTurns();
    const index = turns.findIndex((combatant) => combatant.id === combatantId);
    return index >= 0 ? index : 0;
  }

  async startCombat() {
    const startingSide = normalizeInitiativeSide(
      this.getFlag(MODULE_ID, INITIATIVE_STARTING_SIDE_FLAG),
      INITIATIVE_SIDE_HEROES
    );
    await this.setFlag(
      MODULE_ID,
      INITIATIVE_STATE_FLAG,
      createInitiativeState({ round: 1, startingSide })
    );

    const plan = this.getAndromedaInitiativePlan();
    const updateData = {
      round: 1,
      turn: this.getAndromedaTurnIndex(plan.currentId)
    };
    this._playCombatSound?.('startEncounter');
    Hooks.callAll('combatStart', this, updateData);
    await this.update(updateData);
    return this;
  }

  async nextTurn() {
    const combatants = getCombatants(this);
    if (!combatants.length) return super.nextTurn();

    const state = this.getAndromedaInitiativeState();
    const slots = combatants.map((combatant) => getCombatantSlot(combatant));
    const currentPlan = buildInitiativeTurnPlan(slots, state);
    const result = advanceInitiativeTurn(slots, state, currentPlan.currentId);
    if (!result.advanced) return this;

    const plan = buildInitiativeTurnPlan(slots, result.state);
    const changes = {
      turn: this.getAndromedaTurnIndex(plan.currentId),
      [INITIATIVE_STATE_PATH]: result.state
    };
    if (result.roundComplete) changes.round = result.state.round;
    return this.update(changes);
  }

  async previousTurn() {
    const combatants = getCombatants(this);
    if (!combatants.length) return super.previousTurn();

    const slots = combatants.map((combatant) => getCombatantSlot(combatant));
    const result = rewindInitiativeTurn(slots, this.getAndromedaInitiativeState());
    if (!result.rewound) return this;

    const plan = buildInitiativeTurnPlan(slots, result.state);
    return this.update({
      round: result.state.round,
      turn: this.getAndromedaTurnIndex(plan.currentId),
      [INITIATIVE_STATE_PATH]: result.state
    });
  }

  async nextRound() {
    const slots = getCombatants(this).map((combatant) => getCombatantSlot(combatant));
    if (!slots.length) return super.nextRound();

    let state = this.getAndromedaInitiativeState();
    const currentRound = state.round;
    let guard = slots.length + 1;
    while (state.round === currentRound && guard > 0) {
      const plan = buildInitiativeTurnPlan(slots, state);
      if (!plan.currentId) break;
      state = advanceInitiativeTurn(slots, state, plan.currentId).state;
      guard -= 1;
    }

    if (state.round === currentRound) {
      state = createInitiativeState({
        round: currentRound + 1,
        startingSide: state.startingSide,
        history: state.history
      });
    }
    const plan = buildInitiativeTurnPlan(slots, state);
    return this.update({
      round: state.round,
      turn: this.getAndromedaTurnIndex(plan.currentId),
      [INITIATIVE_STATE_PATH]: state
    });
  }

  async previousRound() {
    const slots = getCombatants(this).map((combatant) => getCombatantSlot(combatant));
    const state = this.getAndromedaInitiativeState();
    const previousRound = state.history.at(-1);
    if (!slots.length || !previousRound) return this;

    const previousState = createInitiativeState({
      round: previousRound.round,
      startingSide: state.startingSide,
      history: state.history.slice(0, -1)
    });
    const plan = buildInitiativeTurnPlan(slots, previousState);
    return this.update({
      round: previousState.round,
      turn: this.getAndromedaTurnIndex(plan.currentId),
      [INITIATIVE_STATE_PATH]: previousState
    });
  }

  async resetAll() {
    const result = await super.resetAll();
    const startingSide = normalizeInitiativeSide(
      this.getFlag(MODULE_ID, INITIATIVE_STARTING_SIDE_FLAG),
      INITIATIVE_SIDE_HEROES
    );
    await this.setFlag(
      MODULE_ID,
      INITIATIVE_STATE_FLAG,
      createInitiativeState({ round: 1, startingSide })
    );
    return result;
  }

  async rollInitiative() {
    ui.notifications?.info?.(game.i18n.localize('MY_RPG.InitiativeTracker.NoRolls'));
    return this;
  }

  async chooseAndromedaCombatant(combatantId) {
    if (!this.started) return this;
    const combatants = getCombatants(this);
    const slots = combatants.map((combatant) => getCombatantSlot(combatant));
    const state = selectInitiativeCombatant(slots, this.getAndromedaInitiativeState(), combatantId);
    const plan = buildInitiativeTurnPlan(slots, state);
    if (plan.currentId !== combatantId) return this;
    return this.update({ turn: this.getAndromedaTurnIndex(plan.currentId), [INITIATIVE_STATE_PATH]: state });
  }

  async setAndromedaStartingSide(side) {
    if (this.started) return this;
    const startingSide = normalizeInitiativeSide(side, INITIATIVE_SIDE_HEROES);
    await this.setFlag(MODULE_ID, INITIATIVE_STARTING_SIDE_FLAG, startingSide);
    await this.setFlag(
      MODULE_ID,
      INITIATIVE_STATE_FLAG,
      createInitiativeState({ round: 1, startingSide })
    );
    return this;
  }

  async setAndromedaCombatantSide(combatantId, side) {
    if (this.started) return this;
    const combatant = this.combatants.get(combatantId);
    if (!combatant) return this;
    const rootId = combatant.getFlag(MODULE_ID, INITIATIVE_EXTRA_TURN_FLAG) || combatant.id;
    const updates = getCombatants(this)
      .filter(
        (candidate) =>
          (candidate.getFlag(MODULE_ID, INITIATIVE_EXTRA_TURN_FLAG) || candidate.id) === rootId
      )
      .map((candidate) => ({
        _id: candidate.id,
        ['flags.' + MODULE_ID + '.' + INITIATIVE_SIDE_FLAG]: normalizeInitiativeSide(
          side,
          INITIATIVE_SIDE_OPPONENTS
        )
      }));
    await this.updateEmbeddedDocuments('Combatant', updates);
    return this;
  }

  async addAndromedaExtraTurn(combatantId) {
    if (this.started) return this;
    const combatant = this.combatants.get(combatantId);
    if (!combatant) return this;

    const data = cloneDocumentData(combatant.toObject());
    delete data._id;
    data.initiative = null;
    data.defeated = false;
    data.flags ??= {};
    data.flags[MODULE_ID] ??= {};
    data.flags[MODULE_ID][INITIATIVE_EXTRA_TURN_FLAG] =
      combatant.getFlag(MODULE_ID, INITIATIVE_EXTRA_TURN_FLAG) || combatant.id;
    await this.createEmbeddedDocuments('Combatant', [data]);
    return this;
  }

  async removeAndromedaExtraTurn(combatantId) {
    if (this.started) return this;
    const combatant = this.combatants.get(combatantId);
    if (!combatant?.getFlag(MODULE_ID, INITIATIVE_EXTRA_TURN_FLAG)) return this;
    await this.deleteEmbeddedDocuments('Combatant', [combatantId]);
    return this;
  }
}

export function getCombatantSlot(combatant) {
  return {
    id: combatant.id,
    name: combatant.name,
    defeated: combatant.defeated,
    side: getCombatantInitiativeSide({
      actorType: combatant.actor?.type,
      tokenDisposition: combatant.token?.disposition,
      sideOverride: combatant.getFlag(MODULE_ID, INITIATIVE_SIDE_FLAG)
    })
  };
}

function getCombatants(combat) {
  return combat.combatants?.contents ?? Array.from(combat.combatants ?? []);
}

function compareCombatantsForTracker(left, right) {
  const leftSlot = getCombatantSlot(left);
  const rightSlot = getCombatantSlot(right);
  const sideOrder =
    Number(leftSlot.side === INITIATIVE_SIDE_OPPONENTS) -
    Number(rightSlot.side === INITIATIVE_SIDE_OPPONENTS);
  return (
    sideOrder ||
    leftSlot.name.localeCompare(rightSlot.name, undefined, { sensitivity: 'base' }) ||
    leftSlot.id.localeCompare(rightSlot.id)
  );
}

function cloneDocumentData(data) {
  if (typeof structuredClone === 'function') return structuredClone(data);
  return JSON.parse(JSON.stringify(data));
}
