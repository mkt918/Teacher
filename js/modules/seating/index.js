/**
 * SeatingModule - 席替えツールのメインモジュール（リファクタリング版）
 * 
 * 機能を以下のサブモジュールに分割：
 * - grid.js: グリッド描画
 * - lottery.js: くじ引きモード
 * - print.js: 印刷機能
 */

// サブモジュールのインポート（ES Modules移行後に有効化）
// import { createSeatElement, createTeacherDesk, renderUnassignedStudentsHtml, getAssignedStudentIds, getUnassignedStudents } from './grid.js';
// import { SUITS, shuffleCards, swapCards, renderLotteryGridHtml, generateLotteryInputHtml } from './lottery.js';
// import { printSeating, generateSeatingPrintHtml, generateLotteryPrintHtml } from './print.js';

// ユーティリティのインポート（ES Modules移行後に有効化）
// import { createEmptyGrid, getOrderedPositions } from '../../utils/grid.js';
// import { saveToHistory, loadFromHistory, getHistoryList } from '../../utils/history.js';

/**
 * SeatingModule
 * 既存のSeatingModuleとの互換性を保ちながら、分割されたサブモジュールを統合
 */
const SeatingModuleNew = {
    name: 'SeatingModule',
    currentLayout: null,
    rows: 6,
    cols: 7,
    history: [],
    draggedStudent: null,
    isLotteryMode: false,
    initialized: false,

    // トランプ定義（互換性のため残す）
    suits: [
        { id: 'spade', symbol: '♠', color: 'black', label: 'スペード' },
        { id: 'club', symbol: '♣', color: 'black', label: 'クラブ' },
        { id: 'heart', symbol: '♥', color: 'red', label: 'ハート' },
        { id: 'diamond', symbol: '♦', color: 'red', label: 'ダイヤ' }
    ],

    /**
     * 初期化
     */
    init() {
        if (this.initialized) return;
        this.setupEventListeners();
        this.initialized = true;
        console.log('🪑 SeatingModule (Refactored) initialized');
    },

    /**
     * イベントリスナーのセットアップ
     * 注意: 既存コード(seating.js)のsetupEventListenersをそのまま使用
     */
    setupEventListeners() {
        // 行・列の変更
        this._setupInput('seatingRows', (val) => { this.rows = val; this.render(); });
        this._setupInput('seatingCols', (val) => { this.cols = val; this.render(); });

        // ボタンイベント
        this._setupButton('randomSeatingBtn', () => this.randomArrange());
        this._setupButton('clearSeatingBtn', () => this.clearSeating());
        this._setupButton('saveSeatingBtn', () => this.saveToHistory());
        this._setupButton('seatingHistoryBtn', () => this.showHistory());
        this._setupButton('printSeatingBtn', () => this.printSeating());
        this._setupButton('toggleLotteryBtn', () => this.toggleLotteryMode());
        this._setupButton('shuffleCardsBtn', () => this.shuffleCards());
        this._setupButton('arrangeByNumberBtn', () => this.arrangeByNumber());
        this._setupButton('inputLotteryResultBtn', () => this.openLotteryInputModal());
        this._setupButton('reflectLotteryResultBtn', () => this.reflectLotteryResults());

        // 未配置リストへのドロップ
        const unassignedContainer = document.getElementById('unassignedStudents');
        if (unassignedContainer) {
            unassignedContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                unassignedContainer.classList.add('drag-over');
            });
            unassignedContainer.addEventListener('dragleave', () => {
                unassignedContainer.classList.remove('drag-over');
            });
            unassignedContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                unassignedContainer.classList.remove('drag-over');
                this.onDropToUnassigned(e);
            });
        }

        // モーダルキャンセル
        this._setupButton('cancelLotteryInputBtn', () => {
            document.getElementById('lotteryInputModal')?.classList.remove('active');
        });
        this._setupButton('closeLotteryInputModal', () => {
            document.getElementById('lotteryInputModal')?.classList.remove('active');
        });
    },

    /**
     * ヘルパー: 入力フィールドのセットアップ
     */
    _setupInput(id, callback) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => callback(parseInt(e.target.value) || 6));
        }
    },

    /**
     * ヘルパー: ボタンのセットアップ
     */
    _setupButton(id, callback) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', callback);
        }
    },

    /**
     * 描画
     * 注意: 既存コードのrender()をそのまま使用可能
     */
    render() {
        const data = window.StorageManager.getCurrentData();

        if (!this.currentLayout) {
            this.currentLayout = data.seating?.current || this.createEmptyLayout();
        }

        if (this.isLotteryMode) {
            this.renderLotteryGrid();
            const lotteryControls = document.getElementById('lotteryControls');
            if (lotteryControls) lotteryControls.style.display = 'flex';
        } else {
            this.renderSeatingGrid();
            const lotteryControls = document.getElementById('lotteryControls');
            if (lotteryControls) lotteryControls.style.display = 'none';
        }

        this.renderUnassignedStudents();

        // 設定値を反映
        const rowsInput = document.getElementById('seatingRows');
        const colsInput = document.getElementById('seatingCols');
        if (rowsInput) rowsInput.value = this.rows;
        if (colsInput) colsInput.value = this.cols;
    },

    /**
     * 空のレイアウトを作成
     */
    createEmptyLayout() {
        const layout = [];
        for (let r = 0; r < this.rows; r++) {
            const row = [];
            for (let c = 0; c < this.cols; c++) {
                row.push(null);
            }
            layout.push(row);
        }
        return layout;
    },

    // ===== 以下、既存のSeatingModuleのメソッドをそのまま移植 =====
    // render, renderSeatingGrid, renderLotteryGrid, toggleLotteryMode,
    // shuffleCards, arrangeByNumber, clearSeating, saveCurrentLayout,
    // saveToHistory, showHistory, loadFromHistory, deleteFromHistory,
    // printSeating, onDragStart, onDrop, onDropToUnassigned, toggleLock,
    // toggleCardLock, swapCards, openLotteryInputModal, reflectLotteryResults
    // 
    // これらは既存のseating.jsから徐々に移行する

    // 既存のSeatingModuleとの互換性を保つため、
    // 現時点では新しいモジュールとしてエクスポートするのみ
};

// ES Modules用エクスポート
// export { SeatingModuleNew as SeatingModule };

// グローバルに公開（移行期間中）
if (typeof window !== 'undefined') {
    window.SeatingModuleNew = SeatingModuleNew;
}
