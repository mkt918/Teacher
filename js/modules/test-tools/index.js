/**
 * TestToolsModule - テスト問題補助ツール
 *
 * 機能:
 * - 語群テンプレート作成（問題文・解答を入力 → 五十音順語群 + コピー）
 */

const TestToolsModule = {
    name: 'TestToolsModule',
    initialized: false,

    // 語群ツールの状態
    wordGroupRows: [],       // [{no, question, answer}]
    dummyAnswers: [],        // ダミー解答リスト

    init() {
        if (this.initialized) return;
        this.initialized = true;
        console.log('✏️ TestToolsModule initialized');
    },

    render() {
        const container = document.getElementById('testToolsContainer');
        if (!container) return;

        container.innerHTML = `
            <div style="max-width:1100px; margin:0 auto; padding:0 0 40px;">

                <!-- ツール切り替えタブ -->
                <div style="display:flex; gap:8px; margin-bottom:24px; border-bottom:2px solid #e2e8f0; padding-bottom:0;">
                    <button class="tt-tool-tab active" data-tool="word-group"
                        style="padding:10px 20px; border:none; background:none; border-bottom:3px solid #3b82f6;
                               color:#3b82f6; font-weight:bold; font-size:1em; cursor:pointer; margin-bottom:-2px;">
                        📋 語群テンプレート作成
                    </button>
                    <!-- 今後のツールはここに追加 -->
                </div>

                <!-- 語群テンプレート作成 -->
                <div id="tt-word-group">
                    ${this._renderWordGroupTool()}
                </div>
            </div>
        `;

        this._setupWordGroupEvents();
    },

    // ==================== 語群テンプレート作成 ====================

    _renderWordGroupTool() {
        return `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">

                <!-- 左カラム：入力 -->
                <div>
                    <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px; margin-bottom:16px;">
                        <h3 style="margin:0 0 12px; font-size:1em; color:#374151;">📝 問題・解答の入力</h3>
                        <p style="font-size:0.85em; color:#64748b; margin:0 0 12px;">
                            No、問題文、解答を入力してください。行を追加・削除できます。
                        </p>

                        <!-- テーブルヘッダー -->
                        <div style="display:grid; grid-template-columns:48px 1fr 140px 36px;
                                    gap:6px; margin-bottom:6px; padding:0 2px;">
                            <div style="font-size:0.8em; font-weight:bold; color:#64748b; text-align:center;">No</div>
                            <div style="font-size:0.8em; font-weight:bold; color:#64748b;">問題文</div>
                            <div style="font-size:0.8em; font-weight:bold; color:#64748b;">解答</div>
                            <div></div>
                        </div>

                        <!-- 入力行 -->
                        <div id="wgRowsContainer"></div>

                        <button id="wgAddRowBtn"
                            style="width:100%; margin-top:10px; padding:8px; border:1px dashed #cbd5e1;
                                   border-radius:8px; background:none; color:#64748b; cursor:pointer;
                                   font-size:0.9em; transition:all 0.15s;">
                            ＋ 行を追加
                        </button>
                    </div>

                    <!-- ダミー解答 -->
                    <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px;">
                        <h3 style="margin:0 0 8px; font-size:1em; color:#374151;">🎭 ダミー解答</h3>
                        <p style="font-size:0.85em; color:#64748b; margin:0 0 10px;">
                            語群に加えるダミー解答をカンマ区切りで入力してください。
                        </p>
                        <textarea id="wgDummyInput" rows="3" placeholder="例: 徳川家光, 豊臣秀頼, 織田信長"
                            style="width:100%; padding:8px 10px; border:1px solid #e2e8f0; border-radius:8px;
                                   font-size:0.9em; resize:vertical; box-sizing:border-box;"></textarea>
                    </div>
                </div>

                <!-- 右カラム：出力 -->
                <div style="display:flex; flex-direction:column; gap:16px;">

                    <!-- 語群出力 -->
                    <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px; flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <h3 style="margin:0; font-size:1em; color:#374151;">📦 語群（五十音順）</h3>
                            <div style="display:flex; gap:8px; align-items:center;">
                                <label style="font-size:0.8em; color:#64748b;">区切り:</label>
                                <select id="wgSeparator"
                                    style="padding:3px 6px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.85em;">
                                    <option value="　">全角スペース</option>
                                    <option value="・">・（中点）</option>
                                    <option value="、">、（読点）</option>
                                    <option value="  ">半角スペース2つ</option>
                                </select>
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; margin-bottom:10px;">
                            <button id="wgGenerateBtn"
                                style="flex:1; padding:9px; background:#3b82f6; color:white; border:none;
                                       border-radius:8px; font-weight:bold; cursor:pointer; font-size:0.95em;">
                                🔄 語群を生成
                            </button>
                            <button id="wgCopyWordGroupBtn"
                                style="padding:9px 14px; background:#10b981; color:white; border:none;
                                       border-radius:8px; font-weight:bold; cursor:pointer; font-size:0.95em;">
                                📋 コピー
                            </button>
                        </div>
                        <div id="wgWordGroupOutput"
                            style="min-height:80px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0;
                                   border-radius:8px; font-size:0.95em; line-height:1.8; white-space:pre-wrap;
                                   color:#374151; word-break:break-all;">
                            ここに語群が表示されます
                        </div>
                    </div>

                    <!-- 解答一覧出力 -->
                    <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <h3 style="margin:0; font-size:1em; color:#374151;">✅ 解答一覧（No順）</h3>
                            <button id="wgCopyAnswersBtn"
                                style="padding:7px 14px; background:#10b981; color:white; border:none;
                                       border-radius:8px; font-weight:bold; cursor:pointer; font-size:0.9em;">
                                📋 コピー
                            </button>
                        </div>
                        <div id="wgAnswerListOutput"
                            style="min-height:80px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0;
                                   border-radius:8px; font-size:0.9em; line-height:1.9; white-space:pre-wrap;
                                   color:#374151;">
                            ここに解答一覧が表示されます
                        </div>
                    </div>

                </div>
            </div>
        `;
    },

    _setupWordGroupEvents() {
        // 初期3行追加
        this.wordGroupRows = [];
        for (let i = 0; i < 3; i++) this._addRow();

        document.getElementById('wgAddRowBtn')?.addEventListener('click', () => {
            this._addRow();
        });

        document.getElementById('wgGenerateBtn')?.addEventListener('click', () => {
            this._generateWordGroup();
        });

        document.getElementById('wgCopyWordGroupBtn')?.addEventListener('click', () => {
            this._copyText('wgWordGroupOutput', 'wgCopyWordGroupBtn');
        });

        document.getElementById('wgCopyAnswersBtn')?.addEventListener('click', () => {
            this._copyText('wgAnswerListOutput', 'wgCopyAnswersBtn');
        });
    },

    _addRow() {
        const id = Date.now() + Math.random();
        this.wordGroupRows.push({ id });
        this._renderRows();
    },

    _removeRow(id) {
        this.wordGroupRows = this.wordGroupRows.filter(r => r.id !== id);
        this._renderRows();
    },

    _renderRows() {
        const container = document.getElementById('wgRowsContainer');
        if (!container) return;

        container.innerHTML = this.wordGroupRows.map((row, index) => `
            <div style="display:grid; grid-template-columns:48px 1fr 140px 36px;
                        gap:6px; margin-bottom:6px; align-items:center;" data-row-id="${row.id}">
                <input type="number" class="wg-no" value="${index + 1}" min="1"
                    style="padding:6px 4px; border:1px solid #e2e8f0; border-radius:6px;
                           font-size:0.9em; text-align:center; width:100%;">
                <input type="text" class="wg-question" placeholder="問題文（任意）" value="${this._escapeAttr(row.question || '')}"
                    style="padding:6px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.9em; width:100%;">
                <input type="text" class="wg-answer" placeholder="解答" value="${this._escapeAttr(row.answer || '')}"
                    style="padding:6px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.9em; width:100%;
                           ${row.answer ? 'border-color:#86efac; background:#f0fdf4;' : ''}">
                <button class="wg-remove-btn"
                    style="padding:4px; background:#fee2e2; border:none; border-radius:6px;
                           color:#ef4444; cursor:pointer; font-size:1em; line-height:1;">✕</button>
            </div>
        `).join('');

        // イベント再設定
        container.querySelectorAll('.wg-remove-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                this._removeRow(this.wordGroupRows[index].id);
            });
        });

        // 入力変更を監視して状態に保存
        container.querySelectorAll('[data-row-id]').forEach((rowEl, index) => {
            const noInput = rowEl.querySelector('.wg-no');
            const questionInput = rowEl.querySelector('.wg-question');
            const answerInput = rowEl.querySelector('.wg-answer');

            const save = () => {
                const row = this.wordGroupRows[index];
                if (!row) return;
                row.no = parseInt(noInput.value) || (index + 1);
                row.question = questionInput.value;
                row.answer = answerInput.value;
                // 解答入力時にスタイル更新
                answerInput.style.borderColor = answerInput.value ? '#86efac' : '';
                answerInput.style.background = answerInput.value ? '#f0fdf4' : '';
            };

            noInput.addEventListener('input', save);
            questionInput.addEventListener('input', save);
            answerInput.addEventListener('input', save);
        });
    },

    _generateWordGroup() {
        // 入力値を収集
        const container = document.getElementById('wgRowsContainer');
        if (!container) return;

        container.querySelectorAll('[data-row-id]').forEach((rowEl, index) => {
            const row = this.wordGroupRows[index];
            if (!row) return;
            row.no = parseInt(rowEl.querySelector('.wg-no')?.value) || (index + 1);
            row.question = rowEl.querySelector('.wg-question')?.value || '';
            row.answer = rowEl.querySelector('.wg-answer')?.value || '';
        });

        // 解答を収集（空白除外）
        const answers = this.wordGroupRows
            .map(r => (r.answer || '').trim())
            .filter(a => a !== '');

        // ダミー解答を追加
        const dummyRaw = document.getElementById('wgDummyInput')?.value || '';
        const dummies = dummyRaw.split(/[,、，]/)
            .map(s => s.trim())
            .filter(s => s !== '');

        const allAnswers = [...answers, ...dummies];

        if (allAnswers.length === 0) {
            document.getElementById('wgWordGroupOutput').textContent = '解答が入力されていません';
            document.getElementById('wgAnswerListOutput').textContent = '解答が入力されていません';
            return;
        }

        // 五十音順ソート
        const sorted = [...allAnswers].sort((a, b) =>
            a.localeCompare(b, 'ja', { sensitivity: 'base' })
        );

        // 区切り文字
        const sep = document.getElementById('wgSeparator')?.value || '　';

        // 語群出力（区切り文字でつなげる）
        const wordGroupEl = document.getElementById('wgWordGroupOutput');
        wordGroupEl.textContent = sorted.join(sep);

        // 解答一覧（No順）
        const answerListEl = document.getElementById('wgAnswerListOutput');
        const answerLines = this.wordGroupRows
            .filter(r => (r.answer || '').trim() !== '')
            .sort((a, b) => (a.no || 0) - (b.no || 0))
            .map(r => `(${r.no})　${r.answer}`);
        answerListEl.textContent = answerLines.join('\n');
    },

    _copyText(elementId, btnId) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const text = el.textContent || '';
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById(btnId);
            if (btn) {
                const original = btn.textContent;
                btn.textContent = '✅ コピー済み';
                btn.style.background = '#6b7280';
                setTimeout(() => {
                    btn.textContent = original;
                    btn.style.background = '#10b981';
                }, 1800);
            }
        }).catch(() => {
            // フォールバック
            const range = document.createRange();
            range.selectNode(el);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            document.execCommand('copy');
            window.getSelection().removeAllRanges();
        });
    },

    _escapeAttr(str) {
        return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
};

if (typeof window !== 'undefined') {
    window.TestToolsModule = TestToolsModule;
}
