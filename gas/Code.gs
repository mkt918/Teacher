// ===== Teacher App クラウド同期 GAS =====
// スプレッドシートを自動生成してデータを保存・取得する

const SHEET_NAMES = {
  schedule: 'schedule',
  todos: 'todos',
  events: 'events',
  meta: 'meta'
};

// APIキー（デプロイ後に変更してください）
const API_KEY = 'teacher-app-sync-key-2026';

// ===== エントリーポイント =====

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    if (params.apiKey !== API_KEY) {
      return jsonResponse({ ok: false, error: 'Unauthorized' });
    }
    const action = params.action;
    if (action === 'save') {
      return handleSave(params);
    } else if (action === 'load') {
      return handleLoad(params);
    }
    return jsonResponse({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doGet(e) {
  try {
    const apiKey = e.parameter.apiKey;
    if (apiKey !== API_KEY) {
      return jsonResponse({ ok: false, error: 'Unauthorized' });
    }
    return handleLoad({});
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ===== 保存処理 =====

function handleSave(params) {
  const ss = getOrCreateSpreadsheet();
  const timestamp = new Date().toISOString();

  if (params.schedule !== undefined) {
    setSheetData(ss, SHEET_NAMES.schedule, JSON.stringify(params.schedule));
  }
  if (params.todos !== undefined) {
    setSheetData(ss, SHEET_NAMES.todos, JSON.stringify(params.todos));
  }
  if (params.events !== undefined) {
    setSheetData(ss, SHEET_NAMES.events, JSON.stringify(params.events));
  }

  // メタ情報（最終更新日時）を記録
  setSheetData(ss, SHEET_NAMES.meta, JSON.stringify({ updatedAt: timestamp }));

  return jsonResponse({ ok: true, updatedAt: timestamp });
}

// ===== 読み込み処理 =====

function handleLoad() {
  const ss = getOrCreateSpreadsheet();

  const schedule = parseSheetData(ss, SHEET_NAMES.schedule);
  const todos = parseSheetData(ss, SHEET_NAMES.todos);
  const events = parseSheetData(ss, SHEET_NAMES.events);
  const meta = parseSheetData(ss, SHEET_NAMES.meta);

  return jsonResponse({
    ok: true,
    schedule: schedule,
    todos: todos,
    events: events,
    updatedAt: meta ? meta.updatedAt : null
  });
}

// ===== スプレッドシート操作 =====

function getOrCreateSpreadsheet() {
  const key = 'SPREADSHEET_ID';
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty(key);

  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {
      // IDが無効な場合は再作成
    }
  }

  // 新規作成
  const ss = SpreadsheetApp.create('Teacher App データ同期');
  props.setProperty(key, ss.getId());

  // 初期シートを作成
  Object.values(SHEET_NAMES).forEach(name => {
    if (!ss.getSheetByName(name)) {
      ss.insertSheet(name);
    }
  });
  // デフォルトの「シート1」を削除
  const defaultSheet = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (defaultSheet) ss.deleteSheet(defaultSheet);

  return ss;
}

function setSheetData(ss, sheetName, jsonStr) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  sheet.clearContents();
  sheet.getRange('A1').setValue(jsonStr);
}

function parseSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return null;
  const val = sheet.getRange('A1').getValue();
  if (!val) return null;
  try {
    return JSON.parse(val);
  } catch (e) {
    return null;
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
