import { debugLog } from '../config.mjs';
import { isPlayerCharacterActorType } from '../helpers/actor-types.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const GM_TOOLS_TEMPLATE = 'systems/project-andromeda/templates/apps/gm-tools.hbs';

/**
 * GM utility window. For now it exposes a single "Scene" refresh action that
 * frees used abilities and clears stress / temporary bonuses on every player
 * character. It is intentionally built as a small panel so additional refresh
 * scopes (session, long rest, short rest) can be wired up later.
 *
 * @extends {ApplicationV2}
 */
export class GmToolsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'andromeda-gm-tools',
    classes: ['project-andromeda', 'andromeda-gm-tools-app'],
    tag: 'div',
    window: {
      title: 'MY_RPG.GmTools.Title',
      icon: 'fa-solid fa-toolbox',
      resizable: false
    },
    position: {
      width: 320,
      height: 'auto'
    },
    actions: {
      refresh: GmToolsApp.#onRefresh
    }
  };

  /** @override */
  static PARTS = {
    main: {
      template: GM_TOOLS_TEMPLATE
    }
  };

  /** @type {GmToolsApp|null} */
  static #instance = null;

  /**
   * Open (or focus) the shared GM Tools window. GM only.
   * @returns {GmToolsApp|null}
   */
  static show() {
    if (!game.user?.isGM) {
      ui.notifications?.warn(game.i18n.localize('MY_RPG.GmTools.Errors.RequireGM'));
      return null;
    }
    if (!GmToolsApp.#instance) {
      GmToolsApp.#instance = new GmToolsApp();
    }
    GmToolsApp.#instance.render({ force: true });
    return GmToolsApp.#instance;
  }

  /** @override */
  async _prepareContext() {
    return {
      scopes: [
        {
          value: 'scene',
          label: game.i18n.localize('MY_RPG.GmTools.Scope.Scene'),
          checked: true
        }
      ]
    };
  }

  /**
   * Handle the Refresh button. Reads the selected scope and dispatches the
   * matching reset. Only "scene" is implemented for now.
   * @this {GmToolsApp}
   * @param {Event} event
   */
  static async #onRefresh(event) {
    event?.preventDefault?.();
    const selected = this.element?.querySelector('input[name="refreshScope"]:checked');
    const scope = selected?.value ?? 'scene';

    if (scope !== 'scene') {
      ui.notifications?.info(game.i18n.localize('MY_RPG.GmTools.Errors.NotImplemented'));
      return;
    }

    await GmToolsApp.refreshScene();
  }

  /**
   * Reset every player character to a fresh-scene state: free used abilities
   * (cooldown.used -> 0), clear stress (value plus azure marks), and zero out
   * the temporary bonuses (temp stress / defenses / speed). NPC characters are
   * left untouched.
   * @returns {Promise<{actorsReset: number, abilitiesFreed: number}|null>}
   */
  static async refreshScene() {
    if (!game.user?.isGM) {
      ui.notifications?.warn(game.i18n.localize('MY_RPG.GmTools.Errors.RequireGM'));
      return null;
    }

    const playerCharacters = (game.actors?.contents ?? []).filter((actor) =>
      isPlayerCharacterActorType(actor?.type)
    );

    let actorsReset = 0;
    let abilitiesFreed = 0;

    for (const actor of playerCharacters) {
      await actor.update({
        'system.stress.value': 0,
        'system.stress.marked': [],
        'system.temphealth': 0,
        'system.tempfortitude': 0,
        'system.tempcontrol': 0,
        'system.tempwill': 0,
        'system.tempspeed': 0
      });

      const cooldownResets = (actor.items ?? [])
        .filter((item) => Number(item?.system?.cooldown?.used) > 0)
        .map((item) => ({ _id: item.id, 'system.cooldown.used': 0 }));

      if (cooldownResets.length) {
        await actor.updateEmbeddedDocuments('Item', cooldownResets);
        abilitiesFreed += cooldownResets.length;
      }

      actorsReset += 1;
    }

    // DEBUG-LOG
    debugLog('GM Tools scene refresh', { actorsReset, abilitiesFreed });

    ui.notifications?.info(
      game.i18n.format('MY_RPG.GmTools.Notifications.SceneRefreshDone', {
        actors: actorsReset,
        abilities: abilitiesFreed
      })
    );

    return { actorsReset, abilitiesFreed };
  }
}
