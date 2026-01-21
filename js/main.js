/**
 * Main Entry Point - ES Modules版アプリケーションエントリーポイント
 * 
 * 注意: このファイルは移行期間中は使用されません。
 * 移行完了後、index.htmlで <script type="module" src="js/main.js"></script> として読み込みます。
 */

// Core
import { eventBus } from './core/event-bus.js';
import { BaseModule } from './core/base-module.js';

// Utils
import { openModal, closeModal, setupAllModals } from './utils/modal.js';
import { makeDraggable, makeDropTarget } from './utils/drag-drop.js';
import { openPrintWindow, generatePrintHtml, generateGridPrintHtml } from './utils/print.js';
import { saveToHistory, getHistoryList, loadFromHistory, showHistoryDialog } from './utils/history.js';

// Modules (移行完了後にインポート)
// import { SeatingModule } from './modules/seating/index.js';
// import { MeetingModule } from './modules/meeting/index.js';
// ...

/**
 * アプリケーション初期化
 */
async function initApp() {
    console.log('🚀 Teacher App (ES Modules) starting...');

    // 設定（モーダル等）をセットアップ
    setupAllModals();

    // 各モジュールを初期化
    // 移行完了後、ここで各モジュールのinit()を呼び出す

    console.log('✅ Teacher App initialized');
}

// DOMContentLoaded後に初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// グローバルに公開（移行期間中の互換性のため）
window.TeacherApp = {
    eventBus,
    BaseModule,
    utils: {
        modal: { openModal, closeModal, setupAllModals },
        dragDrop: { makeDraggable, makeDropTarget },
        print: { openPrintWindow, generatePrintHtml, generateGridPrintHtml },
        history: { saveToHistory, getHistoryList, loadFromHistory, showHistoryDialog }
    }
};
