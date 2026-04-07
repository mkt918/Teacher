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

        container.innerHTML = `
            <div style="max-width:1200px; margin:0 auto; padding:0 0 40px;">
                <!-- タブ -->
                <div style="display:flex; gap:0; margin-bottom:24px; border-bottom:2px solid #e2e8f0;">
                    <button class="tt-tab" data-tool="word-group"
                        style="${this._tabStyle(this.activeTool === 'word-group')}">
                        📋 用語問題テンプレート
                    </button>
                    <button class="tt-tab" data-tool="question-maker"
                        style="${this._tabStyle(this.activeTool === 'question-maker')}">
                        📝 作問補助
                    </button>
                </div>
                <!-- コンテンツ -->
                <div id="tt-word-group" style="display:${this.activeTool === 'word-group' ? 'block' : 'none'};">
                    ${wordGroupHtml}
                </div>
                <div id="tt-question-maker" style="display:${this.activeTool === 'question-maker' ? 'block' : 'none'};">
                    ${qmHtml}
                </div>
            </div>`;
        
        this._setupTabEvents();
        
        // 子モジュールのイベント初期化
        if (window.TestToolsWordGroup) window.TestToolsWordGroup.setupEvents();
        if (window.TestToolsQuestionMaker) window.TestToolsQuestionMaker.setupEvents();
    },

    _tabStyle(active) {
        return active
            ? 'padding:10px 22px; border:none; background:none; border-bottom:3px solid #3b82f6; color:#3b82f6; font-weight:bold; font-size:0.95em; cursor:pointer; margin-bottom:-2px;'
            : 'padding:10px 22px; border:none; background:none; border-bottom:3px solid transparent; color:#64748b; font-weight:bold; font-size:0.95em; cursor:pointer; margin-bottom:-2px;';
    },

    _setupTabEvents() {
        document.querySelectorAll('.tt-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this.activeTool = btn.dataset.tool;
                const wgEl = document.getElementById('tt-word-group');
                const qmEl = document.getElementById('tt-question-maker');
                if(wgEl) wgEl.style.display = this.activeTool === 'word-group' ? 'block' : 'none';
                if(qmEl) qmEl.style.display = this.activeTool === 'question-maker' ? 'block' : 'none';
                
                document.querySelectorAll('.tt-tab').forEach(b => {
                    b.style.borderBottomColor = b.dataset.tool === this.activeTool ? '#3b82f6' : 'transparent';
                    b.style.color = b.dataset.tool === this.activeTool ? '#3b82f6' : '#64748b';
                });
            });
        });
    }
};

if (typeof window !== 'undefined') {
    window.TestToolsModule = TestToolsModule;
}
