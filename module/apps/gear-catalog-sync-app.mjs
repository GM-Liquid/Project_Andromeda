import {
  applyGearCatalogImport,
  getSheetDisplayConfigs,
  previewGearCatalogImport
} from '../helpers/gear-catalog-sync.mjs';

function localize(key) {
  return game.i18n.localize(key);
}

function formatSummaryLines(summary = {}) {
  return [
    game.i18n.format('MY_RPG.GearCatalogSync.Summary.Create', {
      count: Number(summary.create) || 0
    }),
    game.i18n.format('MY_RPG.GearCatalogSync.Summary.Update', {
      count: Number(summary.update) || 0
    }),
    game.i18n.format('MY_RPG.GearCatalogSync.Summary.Skip', {
      count: Number(summary.skip) || 0
    }),
    game.i18n.format('MY_RPG.GearCatalogSync.Summary.Error', {
      count: Number(summary.error) || 0
    }),
    game.i18n.format('MY_RPG.GearCatalogSync.Summary.FolderCreate', {
      count: Number(summary.folderCreate) || 0
    })
  ];
}

function formatMetaLines(meta = {}) {
  const lines = [];
  if (meta.worldTitle) {
    lines.push(
      game.i18n.format('MY_RPG.GearCatalogSync.Meta.WorldTitle', {
        value: String(meta.worldTitle)
      })
    );
  }
  if (meta.exportedAt) {
    lines.push(
      game.i18n.format('MY_RPG.GearCatalogSync.Meta.ExportedAt', {
        value: String(meta.exportedAt)
      })
    );
  }
  if (meta.moduleVersion) {
    lines.push(
      game.i18n.format('MY_RPG.GearCatalogSync.Meta.ModuleVersion', {
        value: String(meta.moduleVersion)
      })
    );
  }
  return lines;
}

export class GearCatalogSyncApp extends FormApplication {
  constructor(...args) {
    super(...args);
    this.syncState = this._createIdleState();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'project-andromeda-gear-catalog-sync',
      classes: ['project-andromeda', 'gear-catalog-sync-app'],
      template: 'systems/project-andromeda/templates/apps/gear-catalog-sync.hbs',
      width: 860,
      height: 820,
      resizable: true,
      closeOnSubmit: false,
      submitOnChange: false
    });
  }

  get title() {
    return localize('MY_RPG.GearCatalogSync.Title');
  }

  _createIdleState() {
    return {
      busy: false,
      title: '',
      status: '',
      summaryLines: [],
      sheetStats: [],
      metaLines: [],
      warnings: [],
      errors: [],
      details: ''
    };
  }

  _createBusyState(actionKey) {
    return {
      busy: true,
      title: localize(`MY_RPG.GearCatalogSync.Actions.${actionKey}`),
      status: localize('MY_RPG.GearCatalogSync.Messages.Working'),
      summaryLines: [],
      sheetStats: [],
      metaLines: [],
      warnings: [],
      errors: [],
      details: ''
    };
  }

  _buildPreviewState(result) {
    return {
      busy: false,
      title: localize('MY_RPG.GearCatalogSync.Actions.Preview'),
      status: localize('MY_RPG.GearCatalogSync.Messages.PreviewReady'),
      summaryLines: formatSummaryLines(result.plan?.summary ?? {}),
      sheetStats: result.plan?.perSheet ?? [],
      metaLines: formatMetaLines(result.remoteData?.meta ?? {}),
      warnings: result.plan?.warnings ?? [],
      errors: result.plan?.errors ?? [],
      details: ''
    };
  }

  _buildApplyState(result) {
    return {
      busy: false,
      title: localize('MY_RPG.GearCatalogSync.Actions.Apply'),
      status: localize('MY_RPG.GearCatalogSync.Messages.ApplyComplete'),
      summaryLines: [
        ...formatSummaryLines(result.plan?.summary ?? {}),
        game.i18n.format('MY_RPG.GearCatalogSync.Apply.Created', {
          count: Number(result.applied?.createdCount) || 0
        }),
        game.i18n.format('MY_RPG.GearCatalogSync.Apply.Updated', {
          count: Number(result.applied?.updatedCount) || 0
        }),
        game.i18n.format('MY_RPG.GearCatalogSync.Apply.RefreshedActors', {
          count: Number(result.applied?.refreshedActorCount) || 0
        })
      ],
      sheetStats: result.plan?.perSheet ?? [],
      metaLines: formatMetaLines(result.remoteData?.meta ?? {}),
      warnings: result.plan?.warnings ?? [],
      errors: result.plan?.errors ?? [],
      details: ''
    };
  }

  _buildErrorState(error) {
    return {
      busy: false,
      title: localize('MY_RPG.GearCatalogSync.Messages.LastRun'),
      status: localize('MY_RPG.GearCatalogSync.Messages.Failed'),
      summaryLines: [],
      sheetStats: [],
      metaLines: [],
      warnings: [],
      errors: [String(error?.message ?? error)],
      details: ''
    };
  }

  async getData() {
    return {
      sheetConfigs: getSheetDisplayConfigs(),
      state: {
        ...this.syncState,
        hasContent:
          Boolean(this.syncState.title) ||
          this.syncState.summaryLines.length > 0 ||
          this.syncState.sheetStats.length > 0 ||
          this.syncState.metaLines.length > 0 ||
          this.syncState.warnings.length > 0 ||
          this.syncState.errors.length > 0 ||
          Boolean(this.syncState.details)
      }
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find('[data-action]').on('click', this._onAction.bind(this));
  }

  async _updateObject(_event, formData) {
    void formData;
  }

  async _onAction(event) {
    event.preventDefault();
    const action = String(event.currentTarget?.dataset?.action ?? '').trim();
    if (!action) return;

    if (action === 'clear') {
      this.syncState = this._createIdleState();
      this.render();
      return;
    }

    try {
      this.syncState = this._createBusyState(action);
      this.render();

      if (action === 'preview') {
        const result = await previewGearCatalogImport();
        this.syncState = this._buildPreviewState(result);
        ui.notifications.info(localize('MY_RPG.GearCatalogSync.Messages.PreviewReady'));
      }

      if (action === 'apply') {
        const result = await applyGearCatalogImport();
        this.syncState = this._buildApplyState(result);
        ui.notifications.info(localize('MY_RPG.GearCatalogSync.Messages.ApplyComplete'));
      }
    } catch (error) {
      this.syncState = this._buildErrorState(error);
      ui.notifications.error(String(error?.message ?? error));
    }

    this.render();
  }
}
