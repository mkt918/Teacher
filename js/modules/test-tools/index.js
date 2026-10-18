/**
 * TestToolsModule - テスト問題補助ツール (Entry Point)
 *
 * 各種機能は機能単位のファイルに分割されています:
 * - util.js : 共通ユーティリティ (TestToolsUtil)
 * - word-group.js : 用語問題ツール (TestToolsWordGroup)
 * - qm-renderer.js : 作問補助ツールのレンダラ (TestToolsQMRenderer)
 * - qm-events.js : 作問補助ツールのイベントリスナー (TestToolsQMEvents)
 * - question-maker.js : 作問補助ツールのメインロジック・状態 (TestToolsQuestionMaker)
 */

const TestToolsModule = {
    name: 'TestToolsModule',
    initialized: false,
    activeTool: 'word-group',   // 'word-group' | 'question-maker'

    init() {
        if (this.initialized) return;
        this.initialized = true;
        console.log('✏️ TestToolsModule initialized');
    },

    render() {
        const container = document.getElementById('testToolsContainer');
        if (!container) return;

        // 子モジュールからのHTML生成
        const wordGroupHtml = window.TestToolsWordGroup ? window.TestToolsWordGroup.render() : '<p>語群ツール読み込みエラー</p>';
        const qmHtml = window.TestToolsQuestionMaker ? window.TestToolsQuestionMaker.render() : '<p>作問補助ツール読み込みエラー</p>';

        const isWordGroup = this.activeTool === 'word-group';
        container.innerHTML = `
            <div class="tool-container">
                <!-- タブ（ダッシュボードの時間割タブ .tt-tab とは別のクラスにする） -->
                <div class="tool-tabs" role="tablist">
                    <button class="tool-tab ${isWordGroup ? 'active' : ''}" data-tool="word-group" role="tab" aria-selected="${isWordGroup}">
                        📋 用語問題テンプレート
                    </button>
                    <button class="tool-tab ${!isWordGroup ? 'active' : ''}" data-tool="question-maker" role="tab" aria-selected="${!isWordGroup}">
                        📝 作問補助
                    </button>
                </div>
                <!-- コンテンツ -->
                <div id="tt-word-group" ${isWordGroup ? '' : 'hidden'}>
                    ${wordGroupHtml}
                </div>
                <div id="tt-question-maker" ${!isWordGroup ? '' : 'hidden'}>
                    ${qmHtml}
                </div>
            </div>`;

        this._setupTabEvents(container);

        // 子モジュールのイベント初期化
        if (window.TestToolsWordGroup) window.TestToolsWordGroup.setupEvents();
        if (window.TestToolsQuestionMaker) window.TestToolsQuestionMaker.setupEvents();
    },

    // このページ内のタブだけに登録する（document 全体から探すと、ダッシュボードの
    // 時間割タブなど他のページのタブにも反応してしまうため）
    _setupTabEvents(container) {
        container.querySelectorAll('.tool-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeTool = btn.dataset.tool;
                container.querySelector('#tt-word-group').hidden = this.activeTool !== 'word-group';
                container.querySelector('#tt-question-maker').hidden = this.activeTool !== 'question-maker';
                container.querySelectorAll('.tool-tab').forEach(b => {
                    const active = b.dataset.tool === this.activeTool;
                    b.classList.toggle('active', active);
                    b.setAttribute('aria-selected', String(active));
                });
            });
        });
    }
};

if (typeof window !== 'undefined') {
    window.TestToolsModule = TestToolsModule;
}
