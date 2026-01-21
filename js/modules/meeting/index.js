/**
 * MeetingModule - 保護者会ツールのメインモジュール（リファクタリング版）
 * 
 * 機能を以下のサブモジュールに分割：
 * - schedule.js: スケジュール表（マトリクス）
 * - print.js: 印刷機能
 */

// サブモジュールのインポート（ES Modules移行後に有効化）
// import { createSlotHtml, generateScheduleMatrixHtml, groupSlotsByDate, getUniqueDates, getUniqueTimes, getDayOfWeek } from './schedule.js';
// import { printSchedule, printScheduleA4, generateSchedulePrintHtml, generateA4PrintHtml } from './print.js';

// ユーティリティのインポート（ES Modules移行後に有効化）
// import { saveToHistory, loadFromHistory, getHistoryList } from '../../utils/history.js';

/**
 * MeetingModuleNew
 * 既存のMeetingModuleとの互換性を保ちながら、分割されたサブモジュールを統合
 */
const MeetingModuleNew = {
    name: 'MeetingModule',
    draggedStudent: null,
    initialized: false,

    /**
     * 初期化
     */
    init() {
        if (this.initialized) return;
        this.setupEventListeners();
        this.initialized = true;
        console.log('📅 MeetingModule (Refactored) initialized');
    },

    /**
     * イベントリスナーのセットアップ
     */
    setupEventListeners() {
        // ボタンイベント
        this._setupButton('openMeetingSettings', () => this.openSettingsModal());
        this._setupButton('generateScheduleBtn', () => this.generateSchedule());
        this._setupButton('clearMeetingBtn', () => this.clearAll());
        this._setupButton('printMeetingBtn', () => this.printSchedule());
        this._setupButton('meetingHistoryBtn', () => this.showHistory());
        this._setupButton('saveMeetingHistoryBtn', () => this.saveToHistory());
        this._setupButton('printMeetingNumberBtn', () => this.printScheduleA4('number'));
        this._setupButton('printMeetingFullBtn', () => this.printScheduleA4('full'));

        // モーダル関連
        this._setupButton('generateScheduleConfirm', () => this.generateSchedule());
        this._setupButton('closeMeetingSettings', () => {
            document.getElementById('meetingSettingsModal')?.classList.remove('active');
        });

        // 未配置エリアへのドロップ
        const unassignedArea = document.getElementById('meetingUnassigned');
        if (unassignedArea) {
            unassignedArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                unassignedArea.classList.add('drag-over');
            });
            unassignedArea.addEventListener('dragleave', () => {
                unassignedArea.classList.remove('drag-over');
            });
            unassignedArea.addEventListener('drop', (e) => {
                e.preventDefault();
                unassignedArea.classList.remove('drag-over');
                this.onDropToUnassigned(e);
            });
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
     */
    render() {
        this.renderUnassignedStudents();
        this.renderSchedule();
    },

    /**
     * 未配置生徒リストを描画
     */
    renderUnassignedStudents() {
        // 既存のMeetingModule.renderUnassignedStudents()を呼び出し
        // または新しい実装を使用
    },

    /**
     * スケジュール表を描画
     */
    renderSchedule() {
        // 既存のMeetingModule.renderSchedule()を呼び出し
        // または新しい実装を使用
        // window.MeetingSchedule.generateScheduleMatrixHtml() を利用可能
    },

    // ===== 以下、既存のMeetingModuleのメソッドを参照 =====
    // openSettingsModal, generateSchedule, onDropToUnassigned, onDropToSlot,
    // unassignStudent, clearAll, printSchedule, printScheduleA4,
    // toggleSlotLock, toggleStudentLock, saveToHistory, loadFromHistory, showHistory
    //
    // これらは既存のmeeting.jsから徐々に移行する
};

// ES Modules用エクスポート
// export { MeetingModuleNew as MeetingModule };

// グローバルに公開（移行期間中）
if (typeof window !== 'undefined') {
    window.MeetingModuleNew = MeetingModuleNew;
}
