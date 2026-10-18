// ===== 共通ユーティリティ関数 =====

// アプリのバージョン（PATCHNOTES.md・README.mdと合わせて更新する）
const APP_VERSION = '1.6.0';

/**
 * HTML特殊文字をエスケープしてXSS攻撃を防ぐ
 * @param {string} str - エスケープする文字列
 * @returns {string} エスケープされた文字列
 */
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[m]));
}

/**
 * 現在の年度（4月始まり）を取得する
 * 「各種設定」で年度が指定されていればそれを優先し、
 * 未指定の場合は今日の日付から自動算出する（4月以降は当年、1〜3月は前年）
 * @returns {number} 年度（例: 2026年4月なら2026）
 */
function getFiscalYear() {
    const data = window.StorageManager?.getCurrentData?.();
    const configured = data?.appSettings?.fiscalYear;
    if (configured !== undefined && configured !== null && configured !== '') {
        return parseInt(configured, 10);
    }
    const today = new Date();
    return today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
}

/**
 * window.open()を安全に実行する
 * ポップアップブロック等のエラーをハンドリングする
 * @param {string} url - 開くURL
 * @param {string} target - ターゲット（'_blank'など）
 * @param {string} features - ウィンドウの特性
 * @returns {Window|null} 開いたウィンドウ、またはnull
 */
function safeWindowOpen(url = '', target = '_blank', features = '') {
    try {
        const win = window.open(url, target, features);
        if (!win || win.closed || typeof win.closed === 'undefined') {
            alert('ポップアップがブロックされました。\nブラウザの設定でポップアップを許可してください。');
            return null;
        }
        return win;
    } catch (error) {
        console.error('window.open() エラー:', error);
        alert('ウィンドウを開けませんでした。\nブラウザの設定を確認してください。');
        return null;
    }
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const SCHOOL_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

/**
 * ローカル日付を YYYY-MM-DD にする（toISOStringはUTC換算で日付がずれるため使わない）
 */
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * 配列をその場でシャッフルする（Fisher-Yates）
 */
function shuffleInPlace(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * 生徒を出席番号順に並べた新しい配列を返す
 */
function sortStudentsByNumber(students) {
    return [...students].sort((a, b) => a.number.localeCompare(b.number, 'ja', { numeric: true }));
}

/**
 * CSVの1セル分の文字列を、カンマ・引用符・改行を含んでも壊れないようにエスケープする
 */
function csvEscape(value) {
    const s = value == null ? '' : String(value);
    const needsQuote = s.includes(',') || s.includes('"') || s.includes('\n');
    return needsQuote ? `"${s.split('"').join('""')}"` : s;
}

/**
 * テキストをファイルとしてダウンロードする
 * @param {string} content
 * @param {string} filename
 * @param {string} mimeType - 例: 'text/csv'
 */
function downloadTextFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * HTML文字列を新しいウィンドウに書き出して印刷ダイアログを開く
 * @param {string} html - 完全なHTML文書
 * @param {string} features - window.openの第3引数（例: 'width=800,height=600'）
 */
function printHtmlInNewWindow(html, features = 'width=900,height=700') {
    const win = safeWindowOpen('', '', features);
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 500);
}

/**
 * 指定要素の先頭に、数秒で消える成功メッセージを出す
 */
function showInlineSuccess(container, message = '✅ 保存しました') {
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'inline-success';
    el.textContent = message;
    container.insertBefore(el, container.firstChild);
    setTimeout(() => el.remove(), 2500);
}

// グローバルに公開
window.escapeHtml = escapeHtml;
window.safeWindowOpen = safeWindowOpen;
