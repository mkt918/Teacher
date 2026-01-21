/**
 * BaseModule - すべてのモジュールの基底クラス
 * 共通機能（履歴管理、印刷、ドラッグ＆ドロップなど）を提供
 */
export class BaseModule {
    constructor(name, options = {}) {
        this.name = name;
        this.options = options;
        this.initialized = false;
    }

    /**
     * 初期化（サブクラスでオーバーライド）
     */
    init() {
        if (this.initialized) return;
        this.setupEventListeners();
        this.initialized = true;
        console.log(`📦 ${this.name} initialized`);
    }

    /**
     * イベントリスナーのセットアップ（サブクラスでオーバーライド）
     */
    setupEventListeners() {
        // サブクラスで実装
    }

    /**
     * 描画（サブクラスでオーバーライド）
     */
    render() {
        // サブクラスで実装
    }

    // ===== 履歴管理 =====

    /**
     * 履歴に保存
     * @param {string} dataKey - データのキー（例: 'seating', 'meeting'）
     * @param {string} historyKey - 履歴のキー（例: 'history', 'meetingHistory'）
     * @param {*} data - 保存するデータ
     * @param {number} maxItems - 最大保存件数
     */
    saveToHistory(dataKey, historyKey, data, maxItems = 10) {
        const name = prompt('この状態に名前を付けてください');
        if (!name) return false;

        const storageData = window.StorageManager.getCurrentData();
        if (!storageData[dataKey]) storageData[dataKey] = {};
        if (!storageData[dataKey][historyKey]) storageData[dataKey][historyKey] = [];

        storageData[dataKey][historyKey].unshift({
            name,
            timestamp: new Date().toISOString(),
            data: JSON.parse(JSON.stringify(data))
        });

        // 最大件数を超えたら古いものを削除
        storageData[dataKey][historyKey] = storageData[dataKey][historyKey].slice(0, maxItems);

        window.StorageManager.updateCurrentData(storageData);
        alert('履歴に保存しました');
        return true;
    }

    /**
     * 履歴から読み込み
     * @param {string} dataKey - データのキー
     * @param {string} historyKey - 履歴のキー
     * @param {number} index - 読み込むインデックス
     */
    loadFromHistory(dataKey, historyKey, index) {
        const storageData = window.StorageManager.getCurrentData();
        const history = storageData[dataKey]?.[historyKey] || [];

        if (index < 0 || index >= history.length) return null;

        const item = history[index];
        if (confirm(`「${item.name}」を読み込みますか？\n現在の状態は上書きされます。`)) {
            return JSON.parse(JSON.stringify(item.data));
        }
        return null;
    }

    /**
     * 履歴一覧を取得
     * @param {string} dataKey - データのキー
     * @param {string} historyKey - 履歴のキー
     */
    getHistoryList(dataKey, historyKey) {
        const storageData = window.StorageManager.getCurrentData();
        return storageData[dataKey]?.[historyKey] || [];
    }

    /**
     * 履歴選択ダイアログを表示
     * @param {string} dataKey - データのキー
     * @param {string} historyKey - 履歴のキー
     */
    showHistoryDialog(dataKey, historyKey) {
        const history = this.getHistoryList(dataKey, historyKey);

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

    // ===== 印刷ユーティリティ =====

    /**
     * 印刷ウィンドウを開く
     * @param {string} html - 印刷するHTML
     * @param {Object} options - オプション
     */
    openPrintWindow(html, options = {}) {
        const { width = 900, height = 700, title = '印刷' } = options;
        const win = window.open('', '', `width=${width},height=${height}`);
        win.document.write(html);
        win.document.close();
        setTimeout(() => {
            win.focus();
            win.print();
        }, 500);
        return win;
    }

    /**
     * A4印刷用のベースHTMLを生成
     * @param {string} title - タイトル
     * @param {string} content - コンテンツHTML
     * @param {Object} options - オプション
     */
    generatePrintHtml(title, content, options = {}) {
        const {
            orientation = 'portrait',
            margin = '10mm',
            fontSize = '12px',
            additionalStyles = ''
        } = options;

        return `
            <!DOCTYPE html>
            <html lang="ja">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    @page {
                        size: A4 ${orientation};
                        margin: ${margin};
                    }
                    body {
                        font-family: sans-serif;
                        font-size: ${fontSize};
                        margin: 0;
                        padding: 0;
                    }
                    h1 { font-size: 1.5em; margin: 0 0 10px 0; }
                    .date { font-size: 0.9em; color: #666; margin-bottom: 15px; }
                    ${additionalStyles}
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <div class="date">${new Date().toLocaleDateString('ja-JP')}</div>
                ${content}
            </body>
            </html>
        `;
    }

    // ===== ドラッグ＆ドロップユーティリティ =====

    /**
     * ドラッグ開始ハンドラを設定
     * @param {HTMLElement} element - 対象要素
     * @param {Object} dragData - ドラッグデータ
     * @param {Function} onStart - 開始時コールバック
     */
    setupDragSource(element, getDragData, onStart = null) {
        element.draggable = true;
        element.addEventListener('dragstart', (e) => {
            const data = getDragData();
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/json', JSON.stringify(data));
            element.classList.add('dragging');
            if (onStart) onStart(e, data);
        });
        element.addEventListener('dragend', () => {
            element.classList.remove('dragging');
        });
    }

    /**
     * ドロップターゲットを設定
     * @param {HTMLElement} element - 対象要素
     * @param {Function} onDrop - ドロップ時コールバック
     * @param {Function} canDrop - ドロップ可否判定
     */
    setupDropTarget(element, onDrop, canDrop = () => true) {
        element.addEventListener('dragover', (e) => {
            if (canDrop(e)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                element.classList.add('drag-over');
            }
        });
        element.addEventListener('dragleave', () => {
            element.classList.remove('drag-over');
        });
        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                onDrop(e, data);
            } catch (error) {
                console.error('Drop data parse error:', error);
            }
        });
    }
}

// グローバルに公開（移行期間中の互換性のため）
window.BaseModule = BaseModule;
