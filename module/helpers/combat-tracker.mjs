import { MODULE_ID } from '../config.mjs';
import {
  INITIATIVE_EXTRA_TURN_FLAG,
  INITIATIVE_STARTING_SIDE_FLAG,
  getCombatantSlot
} from '../documents/combat.mjs';
import {
  INITIATIVE_SIDE_HEROES,
  INITIATIVE_SIDE_OPPONENTS,
  getOppositeInitiativeSide,
  normalizeInitiativeSide
} from './initiative.mjs';

const STATUS_CLASS = 'andromeda-initiative-status';
const CONTROLS_CLASS = 'andromeda-initiative-controls';

export function renderAndromedaCombatTracker(application, html) {
  const root = getRootElement(html);
  if (!root || !isCombatTrackerApplication(application)) return;

  root.querySelectorAll(`.${STATUS_CLASS}, .${CONTROLS_CLASS}`).forEach((element) => {
    element.remove();
  });

  const combat = getViewedCombat(application);
  if (!combat?.getAndromedaInitiativePlan) return;
  hideCoreInitiativeControls(root);

  const plan = combat.getAndromedaInitiativePlan();
  const startingSide = normalizeInitiativeSide(
    combat.getFlag(MODULE_ID, INITIATIVE_STARTING_SIDE_FLAG),
    INITIATIVE_SIDE_HEROES
  );
  insertInitiativeStatus(root, combat, plan, startingSide);

  const rows = getCombatantRows(root);
  for (const row of rows) {
    const combatantId = String(row.dataset.combatantId ?? '').trim();
    const combatant = combat.combatants.get(combatantId);
    if (!combatant) continue;

    const slot = getCombatantSlot(combatant);
    row.classList.toggle('andromeda-initiative-hero', slot.side === INITIATIVE_SIDE_HEROES);
    row.classList.toggle('andromeda-initiative-opponent', slot.side === INITIATIVE_SIDE_OPPONENTS);
    row.classList.toggle('andromeda-initiative-eligible', plan.eligibleIds.includes(combatantId));
    row.classList.toggle('andromeda-initiative-selected', plan.currentId === combatantId);

    const controls = document.createElement('div');
    controls.className = CONTROLS_CLASS;
    controls.append(createSideBadge(slot.side));

    const extraTurnOf = combatant.getFlag(MODULE_ID, INITIATIVE_EXTRA_TURN_FLAG);
    if (extraTurnOf) controls.append(createExtraTurnBadge());

    if (game.user?.isGM) {
      if (combat.started && plan.eligibleIds.includes(combatantId)) {
        controls.append(
          createIconButton({
            icon: plan.currentId === combatantId ? 'fa-solid fa-play' : 'fa-solid fa-hand-pointer',
            label: game.i18n.localize('MY_RPG.InitiativeTracker.Choose'),
            disabled: plan.currentId === combatantId,
            onClick: () => combat.chooseAndromedaCombatant(combatantId)
          })
        );
      } else if (!combat.started) {
        controls.append(
          createIconButton({
            icon: 'fa-solid fa-people-arrows',
            label: game.i18n.localize('MY_RPG.InitiativeTracker.ChangeSide'),
            onClick: () =>
              combat.setAndromedaCombatantSide(combatantId, getOppositeInitiativeSide(slot.side))
          })
        );

        if (extraTurnOf) {
          controls.append(
            createIconButton({
              icon: 'fa-solid fa-minus',
              label: game.i18n.localize('MY_RPG.InitiativeTracker.RemoveExtraTurn'),
              onClick: () => combat.removeAndromedaExtraTurn(combatantId)
            })
          );
        } else if (slot.side === INITIATIVE_SIDE_OPPONENTS) {
          controls.append(
            createIconButton({
              icon: 'fa-solid fa-plus',
              label: game.i18n.localize('MY_RPG.InitiativeTracker.AddExtraTurn'),
              onClick: () => combat.addAndromedaExtraTurn(combatantId)
            })
          );
        }
      }
    }

    row.append(controls);
  }
}

/**
 * ApplicationV2's generic render hook fires for every Foundry window. Limit
 * initiative decoration to the actual sidebar/pop-out CombatTracker.
 */
export function isCombatTrackerApplication(application) {
  return (
    application?.constructor?.name === 'CombatTracker' ||
    application?.constructor?.tabName === 'combat'
  );
}

/**
 * An explicit null viewed encounter means "No Encounter". Never fall back to
 * game.combat in that state, since it may belong to another scene or tracker.
 */
export function getViewedCombat(application) {
  if (!isCombatTrackerApplication(application)) return null;
  if ('viewed' in application) return application.viewed ?? null;
  return game.combats?.viewed ?? null;
}

function insertInitiativeStatus(root, combat, plan, startingSide) {
  const status = document.createElement('div');
  status.className = STATUS_CLASS;

  const side = combat.started ? plan.nextSide : startingSide;
  const labelKey = combat.started
    ? 'MY_RPG.InitiativeTracker.CurrentSide'
    : 'MY_RPG.InitiativeTracker.StartingSide';
  const sideLabel = getSideLabel(side);
  const text = document.createElement('span');
  text.textContent = game.i18n.format(labelKey, { side: sideLabel });
  status.append(text);

  if (!combat.started && game.user?.isGM) {
    status.append(
      createIconButton({
        icon: 'fa-solid fa-repeat',
        label: game.i18n.localize('MY_RPG.InitiativeTracker.ToggleStartingSide'),
        onClick: () => combat.setAndromedaStartingSide(getOppositeInitiativeSide(startingSide))
      })
    );
  }

  const list = root.matches?.('#combat-tracker')
    ? root
    : root.querySelector('#combat-tracker, .combat-tracker');
  if (list?.parentElement) list.parentElement.insertBefore(status, list);
  else root.prepend(status);
}

function createSideBadge(side) {
  const badge = document.createElement('span');
  badge.className = `andromeda-initiative-side andromeda-initiative-side-${side}`;
  badge.textContent = getSideLabel(side);
  return badge;
}

function createExtraTurnBadge() {
  const badge = document.createElement('span');
  badge.className = 'andromeda-initiative-extra-turn';
  badge.textContent = game.i18n.localize('MY_RPG.InitiativeTracker.ExtraTurn');
  return badge;
}

function createIconButton({ icon, label, onClick, disabled = false }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'andromeda-initiative-button';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.disabled = disabled;

  const iconElement = document.createElement('i');
  iconElement.className = icon;
  button.append(iconElement);
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    Promise.resolve(onClick()).catch((error) => {
      console.error('[Project Andromeda] Initiative tracker action failed', error);
    });
  });
  return button;
}

function getSideLabel(side) {
  const key =
    side === INITIATIVE_SIDE_OPPONENTS
      ? 'MY_RPG.InitiativeTracker.Opponents'
      : 'MY_RPG.InitiativeTracker.Heroes';
  return game.i18n.localize(key);
}

function getCombatantRows(root) {
  const directRows = Array.from(root.querySelectorAll('.combatant[data-combatant-id]'));
  if (directRows.length) return directRows;
  return Array.from(root.querySelectorAll('li[data-combatant-id]'));
}

function hideCoreInitiativeControls(root) {
  const selectors = [
    '[data-action="rollInitiative"]',
    '[data-action="rollAll"]',
    '[data-action="rollNPC"]',
    '[data-action="updateInitiative"]',
    '[data-control="rollInitiative"]',
    '[data-control="rollAll"]',
    '[data-control="rollNPC"]',
    '.combatant-control.roll',
    '.roll-initiative',
    '.token-initiative',
    'input[name="initiative"]'
  ];
  root.querySelectorAll(selectors.join(',')).forEach((element) => {
    element.hidden = true;
  });
}

function getRootElement(html) {
  if (html?.nodeType === 1) return html;
  if (html?.[0]?.nodeType === 1) return html[0];
  if (typeof html?.get === 'function') return html.get(0) ?? null;
  return null;
}
