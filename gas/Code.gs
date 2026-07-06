// ===== Teacher App クラウド同期 GAS (v2) =====
// スプレッドシートを自動生成してデータを保存・取得する
//
// v2の変更点:
// - 同期対象をアプリの全データ（生徒名簿・出欠・メモ・座席・バス・
//   グループ・係・保護者会・テスト問題・所見など）に拡大。
//   全データを1つのJSONとして appData シートに保存する
// - Google Sheetsのセル上限（50,000文字）対策として、長いJSONは
//   複数セルに分割して保存する（チャンク保存）
// - 旧バージョン(v1)のシート（schedule/todos/events）からの移行に対応

const SHEET_NAMES = {
  appData: 'appData',
  meta: 'meta',
  // 旧v1シート（読み込みフォールバック用に残す）
  schedule: 'schedule',
  todos: 'todos',
  calendar: 'calendar'
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

  // v2: アプリの全データをまとめて保存
  if (params.appData !== undefined) {
    setSheetData(ss, SHEET_NAMES.appData, JSON.stringify(params.appData));
  }

  // v1互換: 旧クライアントからの個別フィールドも受け付ける
  if (params.schedule !== undefined) {
    setSheetData(ss, SHEET_NAMES.schedule, JSON.stringify(params.schedule));
  }
  if (params.todos !== undefined) {
    setSheetData(ss, SHEET_NAMES.todos, JSON.stringify(params.todos));
  }
  if (params.calendar !== undefined) {
    setSheetData(ss, SHEET_NAMES.calendar, JSON.stringify(params.calendar));
  }

  // メタ情報（最終更新日時）を記録
  setSheetData(ss, SHEET_NAMES.meta, JSON.stringify({ updatedAt: timestamp, version: 2 }));

  return jsonResponse({ ok: true, updatedAt: timestamp, version: 2 });
}

// ===== 読み込み処理 =====

function handleLoad() {
  const ss = getOrCreateSpreadsheet();

  const appData = parseSheetData(ss, SHEET_NAMES.appData);
  const meta = parseSheetData(ss, SHEET_NAMES.meta);

  // 旧v1シートも返す（appDataがまだない移行直後でもデータが読めるように）
  const schedule = parseSheetData(ss, SHEET_NAMES.schedule);
  const todos = parseSheetData(ss, SHEET_NAMES.todos);
  const calendar = parseSheetData(ss, SHEET_NAMES.calendar);

  return jsonResponse({
    ok: true,
    version: 2,
    appData: appData,
    schedule: schedule,
    todos: todos,
    calendar: calendar,
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

// 長いJSONをセル上限(50,000文字)以下のチャンクに分割してA列に保存する
function setSheetData(ss, sheetName, jsonStr) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  sheet.clearContents();

  const CHUNK_SIZE = 45000;
  const rows = [];
  for (let i = 0; i < jsonStr.length; i += CHUNK_SIZE) {
    rows.push([jsonStr.substring(i, i + CHUNK_SIZE)]);
  }
  if (rows.length === 0) rows.push(['']);

  sheet.getRange(1, 1, rows.length, 1).setValues(rows);
}

// A列の全セルを連結してJSONとして読み込む（1セルだけの旧形式もそのまま読める）
function parseSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return null;
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) return null;

  const values = sheet.getRange(1, 1, lastRow, 1).getValues();
  const str = values.map(row => String(row[0])).join('');
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
