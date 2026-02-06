/*
Google Apps Script for a "Run Duel" button in Google Sheets.

Setup:
1) Extensions -> Apps Script, paste this file.
2) Update CONFIG addresses and endpoint URL.
3) Add Drawing/Button and assign script: runCustomDuelSimulation
*/

const CONFIG = {
  endpointUrl: 'https://YOUR_PUBLIC_URL/simulate',
  apiKey: '',
  confidence: 0.99, // custom simulation accuracy target
  sheetName: 'Import_weapon',
  input: {
    rank: 'K3',
    weapon1Type: 'L3',
    weapon1Damage: 'L4',
    weapon1PropertiesRange: 'L5',
    weapon2Type: 'M3',
    weapon2Damage: 'M4',
    weapon2PropertiesRange: 'M5',
  },
  output: {
    status: 'K7',
    weapon1WinRate: 'L7',
    weapon2WinRate: 'M7',
    averageRounds: 'L8',
    usedSimulations: 'L9',
  },
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Andromeda Sim')
    .addItem('Run Custom Duel', 'runCustomDuelSimulation')
    .addToUi();
}

function runCustomDuelSimulation() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetName);
  if (!sheet) {
    throw new Error(`Sheet "${CONFIG.sheetName}" not found.`);
  }

  writeStatus_(sheet, 'Running simulation...');

  const payload = {
    rank: parseInt(sheet.getRange(CONFIG.input.rank).getDisplayValue().trim() || '1', 10),
    confidence: CONFIG.confidence,
    weapon1: {
      weapon_type: sheet.getRange(CONFIG.input.weapon1Type).getDisplayValue().trim(),
      damage: sheet.getRange(CONFIG.input.weapon1Damage).getDisplayValue().trim(),
      properties: readProperties_(sheet, CONFIG.input.weapon1PropertiesRange),
    },
    weapon2: {
      weapon_type: sheet.getRange(CONFIG.input.weapon2Type).getDisplayValue().trim(),
      damage: sheet.getRange(CONFIG.input.weapon2Damage).getDisplayValue().trim(),
      properties: readProperties_(sheet, CONFIG.input.weapon2PropertiesRange),
    },
  };

  const headers = { 'Content-Type': 'application/json' };
  if (CONFIG.apiKey && CONFIG.apiKey.trim() !== '') {
    headers['X-API-Key'] = CONFIG.apiKey.trim();
  }

  const response = UrlFetchApp.fetch(CONFIG.endpointUrl, {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const statusCode = response.getResponseCode();
  const bodyText = response.getContentText();
  const body = bodyText ? JSON.parse(bodyText) : {};

  if (statusCode >= 400) {
    const errorText = body.error || `HTTP ${statusCode}`;
    writeStatus_(sheet, `Error: ${errorText}`);
    throw new Error(errorText);
  }

  const result = body.result || {};
  sheet.getRange(CONFIG.output.weapon1WinRate).setValue(asPercent_(result.weapon1_win_rate));
  sheet.getRange(CONFIG.output.weapon2WinRate).setValue(asPercent_(result.weapon2_win_rate));
  sheet.getRange(CONFIG.output.averageRounds).setValue(result.avg_rounds || '');
  sheet.getRange(CONFIG.output.usedSimulations).setValue(body.simulations || '');
  writeStatus_(sheet, 'Done');
}

function readProperties_(sheet, a1Range) {
  const values = sheet.getRange(a1Range).getDisplayValues();
  const properties = [];
  for (let r = 0; r < values.length; r++) {
    for (let c = 0; c < values[r].length; c++) {
      const value = (values[r][c] || '').trim();
      if (value) {
        properties.push(value);
      }
    }
  }
  return properties;
}

function asPercent_(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '';
  }
  return Number(value);
}

function writeStatus_(sheet, text) {
  sheet.getRange(CONFIG.output.status).setValue(text);
}
