import {
  applyGoogleSheetsImport,
  exportWorldItemsToGoogleSheets,
  getGoogleSheetsSyncSettings,
  getSheetDisplayConfigs,
  previewGoogleSheetsImport,
  saveGoogleSheetsSyncSettings
} from '../helpers/google-sheets-sync.mjs';

function localize(key) {
  return game.i18n.localize(key);
}

function formatSummaryLines(summary = {}) {
  return [
    game.i18n.format('MY_RPG.GoogleSheetsSync.Summary.Create', {
      count: Number(summary.create) || 0
    }),
    game.i18n.format('MY_RPG.GoogleSheetsSync.Summary.Update', {
      count: Number(summary.update) || 0
    }),
    game.i18n.format('MY_RPG.GoogleSheetsSync.Summary.Skip', {
      count: Number(summary.skip) || 0
    }),
    game.i18n.format('MY_RPG.GoogleSheetsSync.Summary.Error', {
      count: Number(summary.error) || 0
    }),
    game.i18n.format('MY_RPG.GoogleSheetsSync.Summary.FolderCreate', {
      count: Number(summary.folderCreate) || 0
    })
  ];
}

function formatMetaLines(meta = {}) {
  const lines = [];
  if (meta.worldTitle) {
    lines.push(
      game.i18n.format('MY_RPG.GoogleSheetsSync.Meta.WorldTitle', {
        value: String(meta.worldTitle)
      })
    );
  }
  if (meta.exportedAt) {
    lines.push(
      game.i18n.format('MY_RPG.GoogleSheetsSync.Meta.ExportedAt', {
        value: String(meta.exportedAt)
      })
    );
  }
  if (meta.moduleVersion) {
    lines.push(
      game.i18n.format('MY_RPG.GoogleSheetsSync.Meta.ModuleVersion', {
        value: String(meta.moduleVersion)
      })
    );
  }
  return lines;
}

export class GoogleSheetsSyncApp extends FormApplication {
  constructor(...args) {
    super(...args);
    this.syncState = this._createIdleState();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'project-andromeda-google-sheets-sync',
      classes: ['project-andromeda', 'google-sheets-sync-app'],
      template: 'systems/project-andromeda/templates/apps/google-sheets-sync.hbs',
      width: 860,
      height: 820,
      resizable: true,
      closeOnSubmit: false,
      submitOnChange: false
    });
  }

  get title() {
    return localize('MY_RPG.GoogleSheetsSync.Title');
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
      title: localize(`MY_RPG.GoogleSheetsSync.Actions.${actionKey}`),
      status: localize('MY_RPG.GoogleSheetsSync.Messages.Working'),
      summaryLines: [],
      sheetStats: [],
      metaLines: [],
      warnings: [],
      errors: [],
      details: ''
    };
  }

  _buildExportState(result) {
    return {
      busy: false,
      title: localize('MY_RPG.GoogleSheetsSync.Actions.Export'),
      status: localize('MY_RPG.GoogleSheetsSync.Messages.ExportComplete'),
      summaryLines: [
        game.i18n.format('MY_RPG.GoogleSheetsSync.Export.EnsuredSyncIds', {
          count: Number(result.ensuredSyncIds) || 0
        }),
        ...(result.summary ?? []).map((entry) =>
          game.i18n.format('MY_RPG.GoogleSheetsSync.Export.SheetCount', {
            sheet: entry.label,
            count: Number(entry.count) || 0
          })
        )
      ],
      sheetStats: [],
      metaLines: formatMetaLines(result.payload?.meta ?? {}),
      warnings: [],
      errors: [],
      details: String(result.response?.message ?? '')
    };
  }

  _buildPreviewState(result) {
    return {
      busy: false,
      title: localize('MY_RPG.GoogleSheetsSync.Actions.Preview'),
      status: localize('MY_RPG.GoogleSheetsSync.Messages.PreviewReady'),
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
      title: localize('MY_RPG.GoogleSheetsSync.Actions.Apply'),
      status: localize('MY_RPG.GoogleSheetsSync.Messages.ApplyComplete'),
      summaryLines: [
        ...formatSummaryLines(result.plan?.summary ?? {}),
        game.i18n.format('MY_RPG.GoogleSheetsSync.Apply.Created', {
          count: Number(result.applied?.createdCount) || 0
        }),
        game.i18n.format('MY_RPG.GoogleSheetsSync.Apply.Updated', {
          count: Number(result.applied?.updatedCount) || 0
        }),
        game.i18n.format('MY_RPG.GoogleSheetsSync.Apply.RefreshedActors', {
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
      title: localize('MY_RPG.GoogleSheetsSync.Messages.LastRun'),
      status: localize('MY_RPG.GoogleSheetsSync.Messages.Failed'),
      summaryLines: [],
      sheetStats: [],
      metaLines: [],
      warnings: [],
      errors: [String(error?.message ?? error)],
      details: ''
    };
  }

  async getData() {
    const settings = getGoogleSheetsSyncSettings();
    return {
      settings,
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
    await saveGoogleSheetsSyncSettings(formData);
    ui.notifications.info(localize('MY_RPG.GoogleSheetsSync.Messages.SettingsSaved'));
  }

  async _persistCurrentSettings() {
    const formData = this._getSubmitData();
    return saveGoogleSheetsSyncSettings(formData);
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
      const settings = await this._persistCurrentSettings();
      this.syncState = this._createBusyState(action);
      this.render();

      if (action === 'export') {
        const result = await exportWorldItemsToGoogleSheets(settings);
        this.syncState = this._buildExportState(result);
        ui.notifications.info(localize('MY_RPG.GoogleSheetsSync.Messages.ExportComplete'));
      }

      if (action === 'preview') {
        const result = await previewGoogleSheetsImport(settings);
        this.syncState = this._buildPreviewState(result);
        ui.notifications.info(localize('MY_RPG.GoogleSheetsSync.Messages.PreviewReady'));
      }

      if (action === 'apply') {
        const result = await applyGoogleSheetsImport(settings);
        this.syncState = this._buildApplyState(result);
        ui.notifications.info(localize('MY_RPG.GoogleSheetsSync.Messages.ApplyComplete'));
      }
    } catch (error) {
      this.syncState = this._buildErrorState(error);
      ui.notifications.error(String(error?.message ?? error));
    }

    this.render();
  }
}
