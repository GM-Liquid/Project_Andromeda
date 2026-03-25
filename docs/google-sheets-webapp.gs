const PROPERTIES = PropertiesService.getScriptProperties();
const SHEET_KEYS = ['weapons', 'armor', 'equipment', 'traits', 'environment'];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = String(body.action || '').trim();
    const token = String(body.token || '');
    const expectedToken = String(PROPERTIES.getProperty('SYNC_TOKEN') || '');

    if (!expectedToken || token !== expectedToken) {
      return jsonResponse({ ok: false, message: 'Invalid token.' });
    }

    if (action === 'export') {
      const payload = body.payload || {};
      writeSheetsPayload(payload);
      return jsonResponse({
        ok: true,
        message: 'Export payload written to Google Sheets.',
        payload: {
          meta: payload.meta || {},
          sheets: payload.sheets || {}
        }
      });
    }

    if (action === 'read') {
      const payload = readSheetsPayload();
      return jsonResponse({
        ok: true,
        payload
      });
    }

    return jsonResponse({ ok: false, message: `Unsupported action: ${action}` });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error && error.message ? error.message : String(error)
    });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getSpreadsheet() {
  const spreadsheetId = String(PROPERTIES.getProperty('SPREADSHEET_ID') || '').trim();
  if (!spreadsheetId) {
    throw new Error('Missing SPREADSHEET_ID script property.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getOrCreateSheet(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function collectHeaders(rows) {
  const headers = [];
  const seen = new Set();

  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      if (seen.has(key)) return;
      seen.add(key);
      headers.push(key);
    });
  });

  return headers;
}

function writeSheetsPayload(payload) {
  const spreadsheet = getSpreadsheet();
  const metaSheet = getOrCreateSheet(spreadsheet, 'meta');
  const sheets = payload.sheets || {};

  SHEET_KEYS.forEach((sheetKey) => {
    const sheet = getOrCreateSheet(spreadsheet, sheetKey);
    const rows = Array.isArray(sheets[sheetKey]) ? sheets[sheetKey] : [];
    const headers = collectHeaders(rows);

    sheet.clearContents();

    if (!headers.length) {
      sheet.getRange(1, 1).setValue('empty');
      return;
    }

    const values = [headers].concat(
      rows.map((row) => headers.map((header) => stringifyCell(row[header])))
    );

    sheet.getRange(1, 1, values.length, headers.length).setValues(values);
    sheet.setFrozenRows(1);
    hideTechnicalColumns(sheet, headers);
  });

  metaSheet.clearContents();
  const meta = payload.meta || {};
  const metaRows = Object.keys(meta).map((key) => [key, stringifyCell(meta[key])]);
  const values = [['key', 'value']].concat(metaRows.length ? metaRows : [['empty', '']]);
  metaSheet.getRange(1, 1, values.length, 2).setValues(values);
  metaSheet.setFrozenRows(1);
}

function readSheetsPayload() {
  const spreadsheet = getSpreadsheet();
  const sheets = {};

  SHEET_KEYS.forEach((sheetKey) => {
    const sheet = spreadsheet.getSheetByName(sheetKey);
    sheets[sheetKey] = sheet ? sheetToObjects(sheet) : [];
  });

  return {
    meta: readMetaSheet(spreadsheet.getSheetByName('meta')),
    sheets
  };
}

function sheetToObjects(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return [];

  const headers = values[0].map((header) => String(header || '').trim());
  if (!headers.some(Boolean)) return [];

  return values.slice(1).map((row) => {
    const result = {};
    headers.forEach((header, index) => {
      if (!header) return;
      result[header] = row[index];
    });
    return result;
  });
}

function readMetaSheet(sheet) {
  if (!sheet) return {};
  const rows = sheet.getDataRange().getDisplayValues().slice(1);
  return rows.reduce((accumulator, row) => {
    const key = String(row[0] || '').trim();
    if (!key) return accumulator;
    accumulator[key] = row[1];
    return accumulator;
  }, {});
}

function hideTechnicalColumns(sheet, headers) {
  const hiddenHeaders = new Set(['syncId']);
  headers.forEach((header, index) => {
    const column = index + 1;
    if (hiddenHeaders.has(String(header || '').trim())) {
      sheet.hideColumns(column);
      return;
    }
    sheet.showColumns(column);
  });
}

function stringifyCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return value;
}
