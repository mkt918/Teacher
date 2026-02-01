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
