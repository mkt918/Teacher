// ===== 共通ユーティリティ関数 =====

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

// グローバルに公開
window.escapeHtml = escapeHtml;
window.safeWindowOpen = safeWindowOpen;
