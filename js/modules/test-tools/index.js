/**
 * TestToolsModule - テスト問題補助ツール
 *
 * 機能:
 * - 語群テンプレート作成
 * - 作問補助（大問・設問管理、評価観点・配点、問題用紙プレビュー・PDF出力）
 */

const TestToolsModule = {
    name: 'TestToolsModule',
    initialized: false,
    activeTool: 'word-group',   // 'word-group' | 'question-maker'

    // ── 語群ツール ──
    wordGroupRows: [],

    // ── 作問補助 ──
    qm: {
        title: '',
        subject: '',
        grade: '',
        date: '',
        period: '',
        notes: '',
        criteria: [
            { id: 'c1', label: '知識・技能',     color: '#3b82f6', total: 0 },
            { id: 'c2', label: '思考・判断・表現', color: '#10b981', total: 0 },
            { id: 'c3', label: '主体的',         color: '#f59e0b', total: 0 },
        ],
        sections: [],   // 大問
    },

    // =====================================================================
    // 初期化・レンダリング
    // =====================================================================
    init() {
        if (this.initialized) return;
        this.initialized = true;
        console.log('✏️ TestToolsModule initialized');
    },

    render() {
        const container = document.getElementById('testToolsContainer');
        if (!container) return;
        container.innerHTML = `
            <div style="max-width:1200px; margin:0 auto; padding:0 0 40px;">
                <!-- タブ -->
                <div style="display:flex; gap:0; margin-bottom:24px; border-bottom:2px solid #e2e8f0;">
                    <button class="tt-tab" data-tool="word-group"
                        style="${this._tabStyle(this.activeTool === 'word-group')}">
                        📋 語群テンプレート
                    </button>
                    <button class="tt-tab" data-tool="question-maker"
                        style="${this._tabStyle(this.activeTool === 'question-maker')}">
                        📝 作問補助
                    </button>
                </div>
                <!-- コンテンツ -->
                <div id="tt-word-group"    style="display:${this.activeTool === 'word-group'    ? 'block' : 'none'};">
                    ${this._renderWordGroupTool()}
                </div>
                <div id="tt-question-maker" style="display:${this.activeTool === 'question-maker' ? 'block' : 'none'};">
                    ${this._renderQMTool()}
                </div>
            </div>`;
        this._setupTabEvents();
        this._setupWordGroupEvents();
        this._setupQMEvents();
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
                document.getElementById('tt-word-group').style.display     = this.activeTool === 'word-group'     ? 'block' : 'none';
                document.getElementById('tt-question-maker').style.display = this.activeTool === 'question-maker' ? 'block' : 'none';
                document.querySelectorAll('.tt-tab').forEach(b => {
                    b.style.borderBottomColor = b.dataset.tool === this.activeTool ? '#3b82f6' : 'transparent';
                    b.style.color = b.dataset.tool === this.activeTool ? '#3b82f6' : '#64748b';
                });
            });
        });
    },

    // =====================================================================
    // 作問補助 ── レンダリング
    // =====================================================================
    _renderQMTool() {
        return `
        <div style="display:grid; grid-template-columns:420px 1fr; gap:20px; align-items:start;">

            <!-- ── 左パネル：編集 ── -->
            <div style="display:flex; flex-direction:column; gap:16px;">

                <!-- 作問テンプレート管理 -->
                <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:18px;">
                    <h3 style="margin:0 0 12px; font-size:0.95em; color:#374151; display:flex; align-items:center; gap:6px;">
                        📁 作問テンプレート管理
                    </h3>
                    <div style="display:flex; gap:8px; margin-bottom:10px;">
                        <select id="qmTemplateSelect" style="flex:1; padding:7px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:0.9em;">
                            <option value="">─ 保存済みテンプレート ─</option>
                        </select>
                        <button id="qmLoadTemplateBtn" style="padding:7px 14px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; font-size:0.85em; color:#475569; cursor:pointer;">
                            読込</button>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button id="qmSaveTemplateBtn" style="flex:1; padding:8px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; font-size:0.85em; color:#475569; cursor:pointer;">
                            💾 現在のテストを保存</button>
                        <button id="qmDeleteTemplateBtn" style="padding:8px 12px; background:#fee2e2; border:none; border-radius:8px; font-size:0.85em; color:#ef4444; cursor:pointer;">
                            削除</button>
                    </div>
                </div>

                <!-- テスト基本情報 -->
                <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:18px;">
                    <h3 style="margin:0 0 14px; font-size:0.95em; color:#374151; display:flex; align-items:center; gap:6px;">
                        📄 テスト基本情報
                    </h3>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <div style="grid-column:1/-1;">
                            <label style="${this._labelStyle()}">テストタイトル</label>
                            <input id="qmTitle" type="text" value="${this._esc(this.qm.title)}" placeholder="例: 第1回定期テスト"
                                style="${this._inputStyle()}">
                        </div>
                        <div>
                            <label style="${this._labelStyle()}">学年・クラス</label>
                            <input id="qmGrade" type="text" value="${this._esc(this.qm.grade)}" placeholder="3年1組"
                                style="${this._inputStyle()}">
                        </div>
                        <div>
                            <label style="${this._labelStyle()}">実施日</label>
                            <input id="qmDate" type="date" value="${this._esc(this.qm.date)}"
                                style="${this._inputStyle()}">
                        </div>
                        <div>
                            <label style="${this._labelStyle()}">何限目</label>
                            <select id="qmPeriod" style="${this._inputStyle()}">
                                <option value="">─ 選択 ─</option>
                                ${[1,2,3,4,5,6,7,8,9,10].map(p => `
                                    <option value="${p}" ${this.qm.period == p ? 'selected' : ''}>${p}限目</option>
                                `).join('')}
                                <option value="放課後" ${this.qm.period === '放課後' ? 'selected' : ''}>放課後</option>
                            </select>
                        </div>
                        <div>
                            <label style="${this._labelStyle()}">備考</label>
                            <input id="qmNotes" type="text" value="${this._esc(this.qm.notes)}" placeholder="例: 教科書p.1〜p.50"
                                style="${this._inputStyle()}">
                        </div>
                    </div>
                </div>

                <!-- 評価観点設定 -->
                <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h3 style="margin:0; font-size:0.95em; color:#374151;">📊 評価観点</h3>
                        <button id="qmAddCriteriaBtn"
                            style="padding:4px 10px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:6px;
                                   font-size:0.8em; color:#475569; cursor:pointer;">＋ 追加</button>
                    </div>
                    <div id="qmCriteriaList">${this._renderCriteriaList()}</div>
                </div>

                <!-- 大問リスト -->
                <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                        <h3 style="margin:0; font-size:0.95em; color:#374151;">🗂️ 大問・設問</h3>
                        <button id="qmAddSectionBtn"
                            style="padding:6px 14px; background:#3b82f6; color:white; border:none; border-radius:8px;
                                   font-size:0.85em; font-weight:bold; cursor:pointer;">＋ 大問追加</button>
                    </div>
                    <div id="qmSectionList">${this._renderSectionList()}</div>
                </div>

                <!-- 集計 -->
                <div id="qmScoreSummary" style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:18px;">
                    ${this._renderScoreSummary()}
                </div>
            </div>

            <!-- ── 右パネル：プレビュー ── -->
            <div style="position:sticky; top:16px;">
                <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                        <h3 style="margin:0; font-size:0.95em; color:#374151;">👁️ プレビュー</h3>
                        <div style="display:flex; gap:8px;">
                            <select id="qmPaperSize"
                                style="padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.85em;">
                                <option value="a4">A4</option>
                                <option value="b4">B4</option>
                            </select>
                            <button id="qmPrintBtn"
                                style="padding:6px 14px; background:#7c3aed; color:white; border:none; border-radius:8px;
                                       font-size:0.85em; font-weight:bold; cursor:pointer;">🖨️ PDF出力</button>
                        </div>
                    </div>
                    <!-- プレビュー本体（縮小表示） -->
                    <div id="qmPreviewWrapper"
                        style="border:1px solid #e2e8f0; border-radius:8px; overflow:auto; max-height:70vh;
                               background:#f8fafc; padding:12px;">
                        <div id="qmPreviewContent" style="transform-origin:top left;">
                            ${this._renderPreviewHTML()}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    },

    // ── 評価観点リスト ──
    _renderCriteriaList() {
        const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
        return this.qm.criteria.map((c, i) => `
            <div style="display:grid; grid-template-columns:16px 1fr 60px 28px; gap:6px; align-items:center; margin-bottom:6px;"
                 data-cid="${c.id}">
                <div style="width:12px; height:12px; border-radius:50%; background:${c.color}; flex-shrink:0;"></div>
                <input class="qm-criteria-label" value="${this._esc(c.label)}"
                    style="${this._inputStyle()} padding:4px 8px;">
                <div style="display:flex; align-items:center; gap:2px;">
                    <input class="qm-criteria-color" type="color" value="${c.color}"
                        style="width:28px; height:28px; padding:0; border:none; border-radius:4px; cursor:pointer; background:none;">
                </div>
                <button class="qm-remove-criteria" style="background:#fee2e2; border:none; border-radius:4px;
                    color:#ef4444; cursor:pointer; font-size:0.85em; padding:4px;">✕</button>
            </div>`).join('');
    },

    // ── 大問リスト ──
    _renderSectionList() {
        if (this.qm.sections.length === 0) {
            return `<p style="color:#94a3b8; font-size:0.85em; text-align:center; margin:16px 0;">
                大問がありません。「＋ 大問追加」で追加してください。</p>`;
        }
        return this.qm.sections.map((sec, si) => `
            <div style="border:1px solid #e2e8f0; border-radius:10px; margin-bottom:12px; overflow:hidden;"
                 data-sid="${sec.id}">
                <!-- 大問ヘッダー -->
                <div style="background:#f8fafc; padding:10px 12px; display:flex; align-items:center; gap:8px; border-bottom:1px solid #e2e8f0;">
                    <!-- 並び替えボタン -->
                    <div style="display:flex; flex-direction:column; gap:2px; margin-right:4px;">
                        <button class="qm-move-section" data-sid="${sec.id}" data-dir="up"
                            ${si === 0 ? 'disabled style="opacity:0.2; cursor:not-allowed;"' : 'style="cursor:pointer; background:none; border:none; padding:0; font-size:10px; color:#64748b;"'}>
                            ▲</button>
                        <button class="qm-move-section" data-sid="${sec.id}" data-dir="down"
                            ${si === this.qm.sections.length - 1 ? 'disabled style="opacity:0.2; cursor:not-allowed;"' : 'style="cursor:pointer; background:none; border:none; padding:0; font-size:10px; color:#64748b;"'}>
                            ▼</button>
                    </div>
                    <span style="font-weight:bold; color:#374151; font-size:0.9em; white-space:nowrap;">大問${si + 1}</span>
                    <input class="qm-sec-title" value="${this._esc(sec.title)}" placeholder="タイトル（例: 歴史について答えよ）"
                        style="${this._inputStyle()} flex:1; padding:4px 8px; font-size:0.9em;">
                    <button class="qm-remove-section" data-sid="${sec.id}"
                        style="background:#fee2e2; border:none; border-radius:4px; color:#ef4444; cursor:pointer; padding:4px 8px; font-size:0.8em; white-space:nowrap;">
                        削除</button>
                </div>
                <!-- リード文 -->
                <div style="padding:8px 12px; border-bottom:1px solid #f1f5f9;">
                    <textarea class="qm-sec-intro" rows="2" placeholder="リード文（例: 次の文を読んで、各問いに答えなさい。）"
                        style="${this._inputStyle()} resize:vertical; font-size:0.85em;">${this._esc(sec.intro)}</textarea>
                </div>
                <!-- 設問リスト -->
                <div style="padding:8px 12px;" class="qm-questions-wrap">
                    ${this._renderQuestionList(sec, si)}
                </div>
                <!-- 設問追加ボタン -->
                <div style="padding:4px 12px 10px;">
                    <button class="qm-add-question" data-sid="${sec.id}"
                        style="width:100%; padding:6px; border:1px dashed #cbd5e1; border-radius:6px; background:none;
                               color:#64748b; cursor:pointer; font-size:0.85em;">＋ 設問追加</button>
                </div>
            </div>`).join('');
    },

    // ── 設問リスト ──
    _renderQuestionList(sec, si) {
        if (sec.questions.length === 0) {
            return `<p style="color:#94a3b8; font-size:0.8em; text-align:center; margin:8px 0;">設問がありません</p>`;
        }
        return sec.questions.map((q, qi) => `
            <div style="display:grid; grid-template-columns:28px 1fr 70px 100px 28px; gap:6px;
                        align-items:start; margin-bottom:8px; padding:6px; background:#fafafa;
                        border-radius:6px; border:1px solid #f1f5f9;" data-qid="${q.id}">
                <span style="font-size:0.8em; color:#64748b; padding-top:6px; text-align:center;">
                    (${qi + 1})</span>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <input class="qm-q-text" value="${this._esc(q.text)}" placeholder="問題文"
                        style="${this._inputStyle()} font-size:0.85em; padding:4px 6px;">
                    <input class="qm-q-answer" value="${this._esc(q.answer)}" placeholder="解答"
                        style="${this._inputStyle()} font-size:0.8em; padding:3px 6px; background:#f0fdf4; border-color:#86efac;">
                </div>
                <div>
                    <label style="font-size:0.75em; color:#94a3b8; display:block; margin-bottom:2px;">配点</label>
                    <div style="display:flex; align-items:center; gap:2px;">
                        <input class="qm-q-points" type="number" value="${q.points}" min="0" max="99"
                            style="${this._inputStyle()} padding:4px 4px; font-size:0.9em; text-align:center; width:44px;">
                        <span style="font-size:0.8em; color:#64748b;">点</span>
                    </div>
                </div>
                <div>
                    <label style="font-size:0.75em; color:#94a3b8; display:block; margin-bottom:2px;">評価観点</label>
                    <select class="qm-q-criteria"
                        style="${this._inputStyle()} padding:4px 4px; font-size:0.8em;">
                        <option value="">─</option>
                        ${this.qm.criteria.map(c =>
                            `<option value="${c.id}" ${q.criteriaId === c.id ? 'selected' : ''}>${c.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <button class="qm-remove-question" data-sid="${sec.id}" data-qid="${q.id}"
                    style="background:#fee2e2; border:none; border-radius:4px; color:#ef4444; cursor:pointer;
                           padding:4px; font-size:0.8em; margin-top:2px;">✕</button>
            </div>`).join('');
    },

    // ── 集計 ──
    _renderScoreSummary() {
        let total = 0;
        const byC = {};
        this.qm.criteria.forEach(c => { byC[c.id] = 0; });
        this.qm.sections.forEach(sec => {
            sec.questions.forEach(q => {
                const pts = Number(q.points) || 0;
                total += pts;
                if (q.criteriaId && byC[q.criteriaId] !== undefined) {
                    byC[q.criteriaId] += pts;
                }
            });
        });
        const rows = this.qm.criteria.map(c => `
            <div style="display:flex; justify-content:space-between; align-items:center;
                        padding:6px 10px; border-radius:6px; background:#f8fafc; margin-bottom:4px;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <div style="width:10px; height:10px; border-radius:50%; background:${c.color};"></div>
                    <span style="font-size:0.85em; color:#475569;">${this._esc(c.label)}</span>
                </div>
                <span style="font-weight:bold; color:${c.color};">${byC[c.id] || 0} 点</span>
            </div>`).join('');
        return `
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="margin:0; font-size:0.95em; color:#374151;">🧮 配点集計</h3>
                <button id="qmCopyAllAnswersBtn" style="padding:4px 10px; background:#10b981; color:white; border:none; border-radius:6px; font-size:0.8em; font-weight:bold; cursor:pointer;">
                    📋 解答をコピー</button>
            </div>
            <div id="qmAllAnswersHidden" style="display:none;"></div>
            ${rows}
            <div style="display:flex; justify-content:space-between; align-items:center;
                        padding:8px 10px; border-radius:8px; background:#1e293b; margin-top:8px;">
                <span style="font-weight:bold; color:white; font-size:0.9em;">合計</span>
                <span style="font-weight:bold; color:#fbbf24; font-size:1.1em;">${total} 点</span>
            </div>`;
    },

    // ── プレビューHTML ──
    _renderPreviewHTML() {
        const q = this.qm;
        const dateStr = q.date ? new Date(q.date).toLocaleDateString('ja-JP') : '';
        const periodStr = q.period ? ` ${q.period}${isNaN(q.period) ? '' : '限目'}` : '';
        let sectionsHtml = '';
        q.sections.forEach((sec, si) => {
            const secTotal = sec.questions.reduce((s, q) => s + (Number(q.points) || 0), 0);
            const questionsHtml = sec.questions.map((qs, qi) => `
                <div style="margin-bottom:10px; padding-left:1em;">
                    <div style="display:flex; gap:8px;">
                        <span style="white-space:nowrap; font-weight:bold;">(${qi + 1})</span>
                        <span>${this._escapeHtml(qs.text) || '　'}</span>
                        <span style="margin-left:auto; white-space:nowrap; font-size:0.85em; color:#64748b;">
                            [${this.qm.criteria.find(c => c.id === qs.criteriaId)?.label || '─'}　${Number(qs.points) || 0}点]</span>
                    </div>
                    <div style="margin-top:6px; margin-left:1.5em; border-bottom:1px solid #cbd5e1;
                                min-height:24px;"></div>
                </div>`).join('');
            sectionsHtml += `
                <div style="margin-bottom:24px;">
                    <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:6px;
                                border-left:4px solid #3b82f6; padding-left:10px;">
                        <span style="font-weight:bold; font-size:1.05em;">第${si + 1}問</span>
                        <span>${this._escapeHtml(sec.title) || ''}</span>
                        <span style="margin-left:auto; font-size:0.85em; color:#64748b;">（${secTotal}点）</span>
                    </div>
                    ${sec.intro ? `<p style="margin:0 0 10px; padding:8px; background:#f8fafc;
                        border-radius:4px; font-size:0.9em;">${this._escapeHtml(sec.intro)}</p>` : ''}
                    ${questionsHtml}
                </div>`;
        });
        const totalPoints = q.sections.reduce((s, sec) =>
            s + sec.questions.reduce((ss, qq) => ss + (Number(qq.points) || 0), 0), 0);

        return `
            <div id="qmPrintTarget" style="font-family:'Hiragino Kaku Gothic Pro','メイリオ',sans-serif;
                font-size:12px; line-height:1.6; color:#1e293b; padding:20px;">
                <!-- ヘッダー -->
                <div style="display:flex; justify-content:space-between; align-items:flex-end;
                            border-bottom:2px solid #1e293b; padding-bottom:8px; margin-bottom:16px;">
                    <div>
                        <div style="font-size:1.4em; font-weight:bold;">
                            ${this._escapeHtml(q.title) || 'テストタイトル'}
                        </div>
                        <div style="font-size:0.9em; color:#475569; margin-top:2px;">
                            ${this._escapeHtml(q.grade)}${q.grade && dateStr ? '　' : ''}
                            ${dateStr}${periodStr}
                            ${q.notes ? '　' + this._escapeHtml(q.notes) : ''}
                        </div>
                    </div>
                    <div style="text-align:right; font-size:0.9em; color:#475569;">
                        <div>氏名：＿＿＿＿＿＿＿＿＿＿</div>
                        <div style="margin-top:4px;">得点：　　　／ ${totalPoints} 点</div>
                    </div>
                </div>
                <!-- 大問 -->
                ${sectionsHtml || '<p style="color:#94a3b8;">大問を追加してください</p>'}
            </div>`;
    },

    // =====================================================================
    // 作問補助 ── イベント設定
    // =====================================================================
    _setupQMEvents() {
        // 基本情報の変更を即時反映
        ['qmTitle','qmGrade','qmDate','qmPeriod','qmNotes'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', e => {
                const k = id.replace('qm','').toLowerCase();
                const map = { title:'title', grade:'grade', date:'date', period:'period', notes:'notes' };
                this.qm[map[k] || k] = e.target.value;
                this._refreshPreview();
            });
        });

        // 観点追加
        document.getElementById('qmAddCriteriaBtn')?.addEventListener('click', () => {
            const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];
            this.qm.criteria.push({
                id: 'c' + Date.now(),
                label: '観点' + (this.qm.criteria.length + 1),
                color: colors[this.qm.criteria.length % colors.length],
            });
            this._refreshCriteriaList();
            this._refreshSectionList();
            this._refreshSummary();
        });

        // 大問追加
        document.getElementById('qmAddSectionBtn')?.addEventListener('click', () => {
            this.qm.sections.push({
                id: 'sec' + Date.now(),
                title: '',
                intro: '',
                questions: [],
            });
            this._refreshSectionList();
            this._refreshSummary();
            this._refreshPreview();
        });

        // PDF出力
        document.getElementById('qmPrintBtn')?.addEventListener('click', () => this._printPDF());

        // テンプレート管理
        this._updateQMTemplateSelect();
        document.getElementById('qmSaveTemplateBtn')?.addEventListener('click', () => this._saveQMTemplate());
        document.getElementById('qmLoadTemplateBtn')?.addEventListener('click', () => this._loadQMTemplate());
        document.getElementById('qmDeleteTemplateBtn')?.addEventListener('click', () => this._deleteQMTemplate());

        // 観点リストのイベント委任
        this._setupCriteriaEvents();
        // 大問・設問のイベント委任
        this._setupSectionEvents();
    },

    _updateQMTemplateSelect() {
        const select = document.getElementById('qmTemplateSelect');
        if (!select) return;
        const data = StorageManager.getCurrentData();
        const templates = data.testTemplates?.questions || [];
        select.innerHTML = '<option value="">─ 保存済みテンプレート ─</option>' +
            templates.map(t => `<option value="${t.id}">${this._esc(t.name)}</option>`).join('');
    },

    _saveQMTemplate() {
        const name = prompt('テンプレート名を入力してください:', this.qm.title || '新しいテスト');
        if (!name) return;

        const newTemplate = {
            id: Date.now(),
            name: name,
            qm: JSON.parse(JSON.stringify(this.qm)), // 深いコピー
            timestamp: new Date().toISOString()
        };

        const data = StorageManager.getCurrentData();
        if (!data.testTemplates) data.testTemplates = { wordGroups: [], questions: [] };
        if (!data.testTemplates.questions) data.testTemplates.questions = [];
        data.testTemplates.questions.push(newTemplate);
        StorageManager.updateCurrentData({ testTemplates: data.testTemplates });
        this._updateQMTemplateSelect();
        alert('作問テンプレートを保存しました。');
    },

    _loadQMTemplate() {
        const id = document.getElementById('qmTemplateSelect')?.value;
        if (!id) return;

        const data = StorageManager.getCurrentData();
        const template = data.testTemplates.questions.find(t => t.id == id);
        if (!template) return;

        if (!confirm('現在の編集内容が破棄されます。よろしいですか？')) return;

        this.qm = JSON.parse(JSON.stringify(template.qm));
        
        // 再描画
        this._refreshCriteriaList();
        this._refreshSectionList();
        this._refreshSummary();
        this._refreshPreview();
        
        // 基本情報の入力欄（input/select）も手動で更新（refreshPreviewだけでは足りないため）
        document.getElementById('qmTitle').value = this.qm.title || '';
        document.getElementById('qmGrade').value = this.qm.grade || '';
        document.getElementById('qmDate').value = this.qm.date || '';
        document.getElementById('qmPeriod').value = this.qm.period || '';
        document.getElementById('qmNotes').value = this.qm.notes || '';
    },

    _deleteQMTemplate() {
        const id = document.getElementById('qmTemplateSelect')?.value;
        if (!id) return;
        if (!confirm('この作問テンプレートを削除してもよろしいですか？')) return;

        const data = StorageManager.getCurrentData();
        data.testTemplates.questions = data.testTemplates.questions.filter(t => t.id != id);
        StorageManager.updateCurrentData({ testTemplates: data.testTemplates });
        this._updateQMTemplateSelect();
    },

    _setupCriteriaEvents() {
        const list = document.getElementById('qmCriteriaList');
        if (!list) return;
        list.addEventListener('input', e => {
            const row = e.target.closest('[data-cid]');
            if (!row) return;
            const cid = row.dataset.cid;
            const c = this.qm.criteria.find(x => x.id === cid);
            if (!c) return;
            if (e.target.classList.contains('qm-criteria-label')) {
                c.label = e.target.value;
                this._refreshSectionList();
            }
            if (e.target.classList.contains('qm-criteria-color')) {
                c.color = e.target.value;
                // ドット色を即更新
                const dot = row.querySelector('div[style*="border-radius:50%"]');
                if (dot) dot.style.background = c.color;
            }
            this._refreshSummary();
            this._refreshPreview();
        });
        list.addEventListener('click', e => {
            if (!e.target.classList.contains('qm-remove-criteria')) return;
            const row = e.target.closest('[data-cid]');
            if (!row) return;
            this.qm.criteria = this.qm.criteria.filter(c => c.id !== row.dataset.cid);
            this._refreshCriteriaList();
            this._refreshSectionList();
            this._refreshSummary();
        });
    },

    _setupSectionEvents() {
        const list = document.getElementById('qmSectionList');
        if (!list) return;

        list.addEventListener('input', e => {
            const secEl = e.target.closest('[data-sid]');
            if (!secEl) return;
            const sid = secEl.dataset.sid;
            const sec = this.qm.sections.find(s => s.id === sid);
            if (!sec) return;

            if (e.target.classList.contains('qm-sec-title')) {
                sec.title = e.target.value;
            }
            if (e.target.classList.contains('qm-sec-intro')) {
                sec.intro = e.target.value;
            }
            // 設問フィールド
            const qEl = e.target.closest('[data-qid]');
            if (qEl) {
                const q = sec.questions.find(q => q.id === qEl.dataset.qid);
                if (!q) return;
                if (e.target.classList.contains('qm-q-text'))     q.text       = e.target.value;
                if (e.target.classList.contains('qm-q-answer'))   q.answer     = e.target.value;
                if (e.target.classList.contains('qm-q-points'))   q.points     = parseInt(e.target.value) || 0;
                if (e.target.classList.contains('qm-q-criteria')) q.criteriaId = e.target.value;
                this._refreshSummary();
            }
            this._refreshPreview();
        });

        list.addEventListener('click', e => {
            // 大問削除
            if (e.target.classList.contains('qm-remove-section')) {
                const sid = e.target.dataset.sid;
                this.qm.sections = this.qm.sections.filter(s => s.id !== sid);
                this._refreshSectionList();
                this._refreshSummary();
                this._refreshPreview();
                return;
            }
            // 設問追加
            if (e.target.classList.contains('qm-add-question')) {
                const sid = e.target.dataset.sid;
                const sec = this.qm.sections.find(s => s.id === sid);
                if (sec) {
                    sec.questions.push({ id: 'q' + Date.now(), text: '', answer: '', points: 0, criteriaId: '' });
                    this._refreshSectionList();
                    this._refreshSummary();
                    this._refreshPreview();
                }
                return;
            }
            // 設問削除
            if (e.target.classList.contains('qm-remove-question')) {
                const sid = e.target.dataset.sid;
                const qid = e.target.dataset.qid;
                const sec = this.qm.sections.find(s => s.id === sid);
                if (sec) {
                    sec.questions = sec.questions.filter(q => q.id !== qid);
                    this._refreshSectionList();
                    this._refreshSummary();
                    this._refreshPreview();
                }
                return;
            }
            // 大問移動
            if (e.target.closest('.qm-move-section')) {
                const btn = e.target.closest('.qm-move-section');
                const sid = btn.dataset.sid;
                const dir = btn.dataset.dir;
                const idx = this.qm.sections.findIndex(s => s.id === sid);
                if (idx === -1) return;

                if (dir === 'up' && idx > 0) {
                    [this.qm.sections[idx - 1], this.qm.sections[idx]] = [this.qm.sections[idx], this.qm.sections[idx - 1]];
                } else if (dir === 'down' && idx < this.qm.sections.length - 1) {
                    [this.qm.sections[idx], this.qm.sections[idx + 1]] = [this.qm.sections[idx + 1], this.qm.sections[idx]];
                }
                this._refreshSectionList();
                this._refreshPreview();
                return;
            }
        });
    },

    // ── 部分更新 ──
    _refreshCriteriaList() {
        const el = document.getElementById('qmCriteriaList');
        if (el) el.innerHTML = this._renderCriteriaList();
    },
    _refreshSectionList() {
        const el = document.getElementById('qmSectionList');
        if (el) el.innerHTML = this._renderSectionList();
        this._setupSectionEvents();   // 再バインド
    },
    _refreshSummary() {
        const el = document.getElementById('qmScoreSummary');
        if (el) {
            el.innerHTML = this._renderScoreSummary();
            // ボタンのイベントを再紐付け
            el.querySelector('#qmCopyAllAnswersBtn')?.addEventListener('click', () => {
                this._generateQMAllAnswersTable();
                this._copyText('qmAllAnswersHidden', 'qmCopyAllAnswersBtn');
            });
        }
    },
    _generateQMAllAnswersTable() {
        const hiddenArea = document.getElementById('qmAllAnswersHidden');
        if (!hiddenArea) return;
        
        // QMの全解答を表形式で生成
        let html = `<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
            <thead>
                <tr>
                    <th style="border:1px solid #000; padding:4px; background:#f1f5f9;">大問</th>
                    <th style="border:1px solid #000; padding:4px; background:#f1f5f9;">No</th>
                    <th style="border:1px solid #000; padding:4px; background:#f1f5f9;">解答</th>
                </tr>
            </thead>
            <tbody>`;
        
        this.qm.sections.forEach((sec, si) => {
            sec.questions.forEach((q, qi) => {
                html += `<tr>
                    <td style="border:1px solid #000; padding:4px; text-align:center;">${si + 1}</td>
                    <td style="border:1px solid #000; padding:4px; text-align:center;">(${qi + 1})</td>
                    <td style="border:1px solid #000; padding:4px;">${this._esc(q.answer || '')}</td>
                </tr>`;
            });
        });
        html += '</tbody></table>';
        hiddenArea.innerHTML = html;
    },
    _refreshPreview() {
        const el = document.getElementById('qmPreviewContent');
        if (el) el.innerHTML = this._renderPreviewHTML();
    },

    // ── PDF出力 ──
    _printPDF() {
        const size  = document.getElementById('qmPaperSize')?.value || 'a4';
        const inner = document.getElementById('qmPrintTarget')?.innerHTML || '';
        const css = `
            @page { size: ${size === 'b4' ? 'B4' : 'A4'} portrait; margin:15mm 15mm 15mm 20mm; }
            body { margin:0; font-family:'Hiragino Kaku Gothic Pro','メイリオ',sans-serif;
                   font-size:11pt; color:#000; }
            * { box-sizing:border-box; }`;
        const win = window.open('', '_blank');
        win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
            <title>${this._escapeHtml(this.qm.title) || 'テスト'}</title>
            <style>${css}</style></head><body>${inner}</body></html>`);
        win.document.close();
        win.onload = () => { win.print(); };
    },

    // =====================================================================
    // 語群テンプレート（既存機能）
    // =====================================================================
    _renderWordGroupTool() {
        return `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">
                <div>
                    <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px; margin-bottom:16px;">
                        <h3 style="margin:0 0 12px; font-size:1em; color:#374151;">📝 問題・解答の入力</h3>
                        <p style="font-size:0.85em; color:#64748b; margin:0 0 12px;">No、問題文、解答を入力してください。</p>
                        <div style="display:grid; grid-template-columns:48px 1fr 140px 36px; gap:6px; margin-bottom:6px; padding:0 2px;">
                            <div style="font-size:0.8em; font-weight:bold; color:#64748b; text-align:center;">No</div>
                            <div style="font-size:0.8em; font-weight:bold; color:#64748b;">問題文</div>
                            <div style="font-size:0.8em; font-weight:bold; color:#64748b;">解答</div>
                            <div></div>
                        </div>
                        <div id="wgRowsContainer"></div>
                        <div style="display:flex; gap:8px; margin-top:10px;">
                            <button id="wgAddRowBtn" style="flex:1; padding:8px; border:1px dashed #cbd5e1;
                                   border-radius:8px; background:none; color:#64748b; cursor:pointer; font-size:0.9em;">
                                ＋ 行を追加</button>
                            <button id="wgImportCsvBtn" style="padding:8px 12px; border:1px solid #e2e8f0;
                                   border-radius:8px; background:#f8fafc; color:#475569; cursor:pointer; font-size:0.85em;">
                                📋 CSVから一括入力</button>
                        </div>
                    </div>
                    <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px;">
                        <h3 style="margin:0 0 8px; font-size:1em; color:#374151;">🎭 ダミー解答</h3>
                        <p style="font-size:0.85em; color:#64748b; margin:0 0 10px;">語群に加えるダミー解答をカンマ区切りで入力してください。</p>
                        <textarea id="wgDummyInput" rows="3" placeholder="例: 徳川家光, 豊臣秀頼, 織田信長"
                            style="width:100%; padding:8px 10px; border:1px solid #e2e8f0; border-radius:8px;
                                   font-size:0.9em; resize:vertical; box-sizing:border-box;"></textarea>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:16px;">
                    <!-- テンプレート管理パネル -->
                    <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:18px;">
                        <h3 style="margin:0 0 12px; font-size:0.95em; color:#374151; display:flex; align-items:center; gap:6px;">
                            📁 テンプレート管理
                        </h3>
                        <div style="display:flex; gap:8px; margin-bottom:10px;">
                            <select id="wgTemplateSelect" style="flex:1; padding:7px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:0.9em;">
                                <option value="">─ 保存済みテンプレート ─</option>
                            </select>
                            <button id="wgLoadTemplateBtn" style="padding:7px 14px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; font-size:0.85em; color:#475569; cursor:pointer;">
                                読込</button>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button id="wgSaveTemplateBtn" style="flex:1; padding:8px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; font-size:0.85em; color:#475569; cursor:pointer;">
                                💾 現在の内容を保存</button>
                            <button id="wgDeleteTemplateBtn" style="padding:8px 12px; background:#fee2e2; border:none; border-radius:8px; font-size:0.85em; color:#ef4444; cursor:pointer;">
                                削除</button>
                        </div>
                    </div>

                    <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px; flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <h3 style="margin:0; font-size:1em; color:#374151;">📦 語群（五十音順）</h3>
                            <div style="display:flex; gap:12px; align-items:center;">
                                <div style="display:flex; gap:4px; align-items:center;">
                                    <label style="font-size:0.8em; color:#64748b;">列数:</label>
                                    <select id="wgColumns" style="padding:3px 6px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.85em;">
                                        ${[1,2,3,4,5,6,7,8,9,10].map(c => `<option value="${c}" ${c === 5 ? 'selected' : ''}>${c}列</option>`).join('')}
                                    </select>
                                </div>
                                <div style="display:flex; gap:4px; align-items:center;">
                                    <label style="font-size:0.8em; color:#64748b;">形式:</label>
                                    <select id="wgSeparator" style="padding:3px 6px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.85em;">
                                        <option value="　">全角スペース</option>
                                        <option value="・">・（中点）</option>
                                        <option value="、">、（読点）</option>
                                        <option value="  ">半角スペース2つ</option>
                                        <option value="__alpha__">a. b. c. (アルファベット)</option>
                                        <option value="__alpha_full__">Ａ．Ｂ．Ｃ． (全角)</option>
                                        <option value="__kana__">ア. イ. ウ. (カタカナ)</option>
                                        <option value="__kana_full__">ア．イ．ウ． (全角)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; margin-bottom:10px;">
                            <button id="wgGenerateBtn" style="flex:1; padding:9px; background:#3b82f6; color:white; border:none;
                                   border-radius:8px; font-weight:bold; cursor:pointer; font-size:0.95em;">🔄 語群を生成</button>
                            <button id="wgCopyWordGroupBtn" style="padding:9px 14px; background:#10b981; color:white; border:none;
                                   border-radius:8px; font-weight:bold; cursor:pointer; font-size:0.95em;">📋 コピー</button>
                        </div>
                        <div id="wgWordGroupOutput" style="min-height:80px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0;
                               border-radius:8px; font-size:0.95em; line-height:1.8; white-space:pre-wrap; color:#374151; word-break:break-all;">
                            ここに語群が表示されます</div>
                    </div>
                    <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:20px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <h3 style="margin:0; font-size:1em; color:#374151;">✅ 解答一覧（No順）</h3>
                            <button id="wgCopyAnswersBtn" style="padding:7px 14px; background:#10b981; color:white; border:none;
                                   border-radius:8px; font-weight:bold; cursor:pointer; font-size:0.9em;">📋 コピー</button>
                        </div>
                        <div id="wgAnswerListOutput" style="min-height:80px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0;
                               border-radius:8px; font-size:0.9em; line-height:1.9; white-space:pre-wrap; color:#374151;">
                            ここに解答一覧が表示されます</div>
                    </div>
                </div>
            </div>`;
    },

    _setupWordGroupEvents() {
        this.wordGroupRows = [];
        for (let i = 0; i < 3; i++) this._addRow();
        document.getElementById('wgAddRowBtn')?.addEventListener('click', () => this._addRow());
        document.getElementById('wgImportCsvBtn')?.addEventListener('click', () => this._importFromCSV());
        document.getElementById('wgGenerateBtn')?.addEventListener('click', () => this._generateWordGroup());
        document.getElementById('wgCopyWordGroupBtn')?.addEventListener('click', () => this._copyText('wgWordGroupOutput', 'wgCopyWordGroupBtn'));
        document.getElementById('wgCopyAnswersBtn')?.addEventListener('click', () => this._copyText('wgAnswerListOutput', 'wgCopyAnswersBtn'));

        // テンプレート管理
        document.getElementById('wgSaveTemplateBtn')?.addEventListener('click', () => this._saveWordGroupTemplate());
        document.getElementById('wgLoadTemplateBtn')?.addEventListener('click', () => this._loadWordGroupTemplate());
        document.getElementById('wgDeleteTemplateBtn')?.addEventListener('click', () => this._deleteWordGroupTemplate());
        this._updateTemplateSelect();

        // 設定変更時に即時反映
        ['wgSeparator', 'wgColumns'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this._generateWordGroup());
        });
    },

    _updateTemplateSelect() {
        const select = document.getElementById('wgTemplateSelect');
        if (!select) return;
        const data = StorageManager.getCurrentData();
        const templates = data.testTemplates?.wordGroups || [];
        select.innerHTML = '<option value="">─ 保存済みテンプレート ─</option>' +
            templates.map(t => `<option value="${t.id}">${this._esc(t.name)}</option>`).join('');
    },

    _saveWordGroupTemplate() {
        const name = prompt('テンプレート名を入力してください:', '');
        if (!name) return;

        const dummyInput = document.getElementById('wgDummyInput')?.value || '';
        const newTemplate = {
            id: Date.now(),
            name: name,
            rows: this.wordGroupRows.map((r, i) => {
                const rowEl = document.querySelector(`[data-row-id="${r.id}"]`);
                return {
                    no: parseInt(rowEl?.querySelector('.wg-no')?.value) || (i + 1),
                    question: rowEl?.querySelector('.wg-question')?.value || '',
                    answer: rowEl?.querySelector('.wg-answer')?.value || ''
                };
            }),
            dummyInput: dummyInput,
            timestamp: new Date().toISOString()
        };

        const data = StorageManager.getCurrentData();
        if (!data.testTemplates) data.testTemplates = { wordGroups: [] };
        data.testTemplates.wordGroups.push(newTemplate);
        StorageManager.updateCurrentData({ testTemplates: data.testTemplates });
        this._updateTemplateSelect();
        alert('テンプレートを保存しました。');
    },

    _loadWordGroupTemplate() {
        const id = document.getElementById('wgTemplateSelect')?.value;
        if (!id) return;

        const data = StorageManager.getCurrentData();
        const template = data.testTemplates.wordGroups.find(t => t.id == id);
        if (!template) return;

        this.wordGroupRows = template.rows.map(r => ({ ...r, id: Date.now() + Math.random() }));
        this._renderRows();
        const dummyInp = document.getElementById('wgDummyInput');
        if (dummyInp) dummyInp.value = template.dummyInput || '';
        
        // 生成結果も即座に反映
        this._generateWordGroup();
    },

    _deleteWordGroupTemplate() {
        const id = document.getElementById('wgTemplateSelect')?.value;
        if (!id) return;
        if (!confirm('このテンプレートを削除してもよろしいですか？')) return;

        const data = StorageManager.getCurrentData();
        data.testTemplates.wordGroups = data.testTemplates.wordGroups.filter(t => t.id != id);
        StorageManager.updateCurrentData({ testTemplates: data.testTemplates });
        this._updateTemplateSelect();
    },

    _importFromCSV() {
        const text = prompt('CSV形式の問題・解答をペーストしてください\n(形式: No,問題,解答 または 問題,解答)');
        if (!text) return;

        const lines = text.trim().split('\n');
        const newRows = [];
        lines.forEach(line => {
            const parts = line.split(/[,	]/).map(s => s.trim());
            if (parts.length >= 3) {
                newRows.push({ id: Date.now() + Math.random(), no: parseInt(parts[0]), question: parts[1], answer: parts[2] });
            } else if (parts.length === 2) {
                newRows.push({ id: Date.now() + Math.random(), no: newRows.length + 1, question: parts[0], answer: parts[1] });
            }
        });

        if (newRows.length > 0) {
            this.wordGroupRows = newRows;
            this._renderRows();
            this._generateWordGroup();
        }
    },

    _addRow() {
        this.wordGroupRows.push({ id: Date.now() + Math.random() });
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
            <div style="display:grid; grid-template-columns:48px 1fr 140px 36px; gap:6px; margin-bottom:6px; align-items:center;" data-row-id="${row.id}">
                <input type="number" class="wg-no" value="${index + 1}" min="1"
                    style="padding:6px 4px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.9em; text-align:center; width:100%;">
                <input type="text" class="wg-question" placeholder="問題文（任意）" value="${this._esc(row.question || '')}"
                    style="padding:6px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.9em; width:100%;">
                <input type="text" class="wg-answer" placeholder="解答" value="${this._esc(row.answer || '')}"
                    style="padding:6px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.9em; width:100%;
                           ${row.answer ? 'border-color:#86efac; background:#f0fdf4;' : ''}">
                <button class="wg-remove-btn" style="padding:4px; background:#fee2e2; border:none; border-radius:6px;
                    color:#ef4444; cursor:pointer; font-size:1em; line-height:1;">✕</button>
            </div>`).join('');
        container.querySelectorAll('.wg-remove-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => this._removeRow(this.wordGroupRows[index].id));
        });
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
                answerInput.style.borderColor = answerInput.value ? '#86efac' : '';
                answerInput.style.background  = answerInput.value ? '#f0fdf4' : '';
            };
            noInput.addEventListener('input', save);
            questionInput.addEventListener('input', save);
            answerInput.addEventListener('input', save);
        });
    },
    _generateWordGroup() {
        const container = document.getElementById('wgRowsContainer');
        if (!container) return;
        container.querySelectorAll('[data-row-id]').forEach((rowEl, index) => {
            const row = this.wordGroupRows[index];
            if (!row) return;
            row.no       = parseInt(rowEl.querySelector('.wg-no')?.value) || (index + 1);
            row.question = rowEl.querySelector('.wg-question')?.value || '';
            row.answer   = rowEl.querySelector('.wg-answer')?.value   || '';
        });
        const answers = this.wordGroupRows.map(r => (r.answer || '').trim()).filter(a => a);
        const dummies = (document.getElementById('wgDummyInput')?.value || '')
            .split(/[,、，]/).map(s => s.trim()).filter(s => s);
        const all = [...answers, ...dummies];
        if (!all.length) {
            document.getElementById('wgWordGroupOutput').textContent = '解答が入力されていません';
            document.getElementById('wgAnswerListOutput').textContent = '解答が入力されていません';
            return;
        }
        const sep = document.getElementById('wgSeparator')?.value || '　';
        
        let output = '';
        const sorted = [...all].sort((a, b) => a.localeCompare(b, 'ja', { sensitivity: 'base' }));

        let plainOutput = '';
        let tableOutput = '';
        const cols = parseInt(document.getElementById('wgColumns')?.value) || 5; // ユーザー選択またはデフォルト5列

        if (sep === '__alpha__') {
            plainOutput = sorted.map((s, i) => `${String.fromCharCode(97 + i)}. ${s}`).join('  ');
        } else if (sep === '__alpha_full__') {
            plainOutput = sorted.map((s, i) => `${String.fromCharCode(65313 + i)}．${s}`).join('　　');
        } else if (sep === '__kana__') {
            const kana = ['ア','イ','ウ','エ','オ','カ','キ','ク','ケ','コ','サ','シ','ス','セ','ソ','タ','チ','ツ','テ','ト'];
            plainOutput = sorted.map((s, i) => `${kana[i] || '?'}. ${s}`).join('  ');
        } else if (sep === '__kana_full__') {
            const symbols = ['ア．','イ．','ウ．','エ．','オ．','カ．','キ．','ク．','ケ．','コ．','サ．','シ．','ス．','セ．','ソ．','タ．','チ．','ツ．','テ．','ト．'];
            plainOutput = sorted.map((s, i) => `${symbols[i] || '?'}${s}`).join('　　');
        } else {
            plainOutput = sorted.join(sep);
        }

        // HTML表形式（語群）
        tableOutput = '<table style="border-collapse:collapse; width:100%; border:1px solid #000; font-family:sans-serif;"><tbody>';
        for (let i = 0; i < sorted.length; i += cols) {
            tableOutput += '<tr>';
            for (let j = 0; j < cols; j++) {
                const s = sorted[i + j] || '';
                tableOutput += `<td style="border:1px solid #000; padding:4px; width:${100/cols}%;">${this._esc(s)}</td>`;
            }
            tableOutput += '</tr>';
        }
        tableOutput += '</tbody></table>';

        document.getElementById('wgWordGroupOutput').innerHTML = tableOutput;

        // 解答一覧の表形式
        let ansTable = `<table style="border-collapse:collapse; width:100%; border:1px solid #000; font-family:sans-serif;">
            <thead><tr><th style="border:1px solid #000; padding:4px; background:#f1f5f9;">No</th><th style="border:1px solid #000; padding:4px; background:#f1f5f9;">解答</th></tr></thead>
            <tbody>`;
        this.wordGroupRows.filter(r => (r.answer || '').trim())
            .sort((a, b) => (a.no || 0) - (b.no || 0))
            .forEach(r => {
                ansTable += `<tr><td style="border:1px solid #000; padding:4px; text-align:center;">${r.no}</td><td style="border:1px solid #000; padding:4px;">${this._esc(r.answer)}</td></tr>`;
            });
        ansTable += '</tbody></table>';
        document.getElementById('wgAnswerListOutput').innerHTML = ansTable;
    },
    async _copyText(elementId, btnId) {
        const el = document.getElementById(elementId);
        const btn = document.getElementById(btnId);
        if (!el) return;

        const html = el.innerHTML;
        const text = el.innerText;

        try {
            // HTML形式とプレーンテキスト形式の両方をセット（Word対応）
            const blobHtml = new Blob([html], { type: 'text/html' });
            const blobText = new Blob([text], { type: 'text/plain' });
            const data = [new ClipboardItem({
                'text/html': blobHtml,
                'text/plain': blobText
            })];
            await navigator.clipboard.write(data);
            this._showCopyDone(btn);
        } catch (err) {
            console.warn('Clipboard write HTML failed', err);
            // フォールバック: プレーンテキストのみ
            navigator.clipboard.writeText(text).then(() => this._showCopyDone(btn));
        }
    },
    _showCopyDone(btn) {
        if (!btn) return;
        const orig = btn.textContent;
        const origBg = btn.style.background;
        btn.textContent = '✅ コピー済み';
        btn.style.background = '#6b7280';
        setTimeout(() => {
            btn.textContent = orig;
            btn.style.background = origBg;
        }, 1800);
    },

    // =====================================================================
    // ユーティリティ
    // =====================================================================
    _labelStyle() {
        return 'display:block; font-size:0.8em; color:#64748b; margin-bottom:3px;';
    },
    _inputStyle() {
        return 'width:100%; padding:6px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.9em; box-sizing:border-box; outline:none;';
    },
    _esc(str) {
        return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    _escapeHtml(str) {
        return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/\n/g,'<br>');
    },
};

if (typeof window !== 'undefined') {
    window.TestToolsModule = TestToolsModule;
}
t e s t   c h a n g e 
 
