/**
 * HistoryManager - 履歴管理共通ユーティリティ
 */

/**
 * 履歴に保存
 * @param {Object} config - 設定
 */
export function saveToHistory(config) {
    const {
        storageKey,    // 'seating', 'meeting', etc.
        historyKey,    // 'history', 'meetingHistory', etc.
        data,          // 保存するデータ
        maxItems = 10, // 最大保存件数
        promptMessage = 'この状態に名前を付けてください'
    } = config;

    const name = prompt(promptMessage);
    if (!name) return false;

    const storageData = window.StorageManager.getCurrentData();
    if (!storageData[storageKey]) storageData[storageKey] = {};
    if (!storageData[storageKey][historyKey]) storageData[storageKey][historyKey] = [];

    storageData[storageKey][historyKey].unshift({
        name,
        timestamp: new Date().toISOString(),
        data: JSON.parse(JSON.stringify(data))
    });

    // 最大件数を超えたら古いものを削除
    storageData[storageKey][historyKey] = storageData[storageKey][historyKey].slice(0, maxItems);

    window.StorageManager.updateCurrentData(storageData);
    alert('履歴に保存しました');
    return true;
}

/**
 * 履歴一覧を取得
 * @param {string} storageKey - ストレージキー
 * @param {string} historyKey - 履歴キー
 */
export function getHistoryList(storageKey, historyKey) {
    const storageData = window.StorageManager.getCurrentData();
    return storageData[storageKey]?.[historyKey] || [];
}

/**
 * 履歴から読み込み
 * @param {Object} config - 設定
 */
export function loadFromHistory(config) {
    const {
        storageKey,
        historyKey,
        index
    } = config;

    const history = getHistoryList(storageKey, historyKey);

    if (index < 0 || index >= history.length) return null;

    const item = history[index];
    if (confirm(`「${item.name}」を読み込みますか？\n現在の状態は上書きされます。`)) {
        return JSON.parse(JSON.stringify(item.data));
    }
    return null;
}

/**
 * 履歴から削除
 * @param {Object} config - 設定
 */
export function deleteFromHistory(config) {
    const {
        storageKey,
        historyKey,
        index
    } = config;

    const storageData = window.StorageManager.getCurrentData();
    const history = storageData[storageKey]?.[historyKey] || [];

    if (index < 0 || index >= history.length) return false;

    if (confirm('この履歴を削除しますか？')) {
        history.splice(index, 1);
        storageData[storageKey][historyKey] = history;
        window.StorageManager.updateCurrentData(storageData);
        return true;
    }
    return false;
}

/**
 * 履歴選択ダイアログを表示
 * @param {string} storageKey - ストレージキー
 * @param {string} historyKey - 履歴キー
 */
export function showHistoryDialog(storageKey, historyKey) {
    const history = getHistoryList(storageKey, historyKey);

    if (history.length === 0) {
        alert('履歴がありません');
        return -1;
    }

    let msg = '履歴一覧:\n';
    history.forEach((item, i) => {
        const date = new Date(item.timestamp).toLocaleString('ja-JP');
        msg += `${i + 1}. ${item.name} (${date})\n`;
    });
    msg += '\n読み込む番号を入力してください（キャンセルは空欄）:';

    const input = prompt(msg);
    if (!input) return -1;

    const idx = parseInt(input) - 1;
    if (idx >= 0 && idx < history.length) {
        return idx;
    } else {
        alert('無効な番号です');
        return -1;
    }
}

// グローバルに公開（移行期間中の互換性のため）
window.HistoryUtils = { saveToHistory, getHistoryList, loadFromHistory, deleteFromHistory, showHistoryDialog };
