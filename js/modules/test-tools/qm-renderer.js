/**
 * TestToolsQMRenderer - 作問補助ツールのレンダリング
 * 編集画面の見た目は css/style.css の .tool-* / .qm-* クラス。
 * renderPreviewHTML() の出力は印刷用ウィンドウにもそのまま使うため、直書きスタイルのまま。
 */
const TestToolsQMRenderer = {
    renderQMTool(qm) {
        const util = window.TestToolsUtil;
        const randomMode = !!window.TestToolsQuestionMaker?.randomMode;
        return `
        <div class="qm-layout">

            <!-- ── 左パネル：編集 ── -->
            <div class="qm-edit-column">

                <!-- 作問テンプレート管理 -->
                <div class="tool-card">
                    <h3 class="tool-card-title">
                        📁 作問テンプレート管理
                    </h3>
                    <div class="tool-row tool-row-spaced">
                        <select id="qmTemplateSelect" class="tool-select" aria-label="保存済みの作問テンプレート">
                            <option value="">─ 保存済みテンプレート ─</option>
                        </select>
                        <button id="qmLoadTemplateBtn" class="tool-btn">
                            読込</button>
                    </div>
                    <div class="tool-row">
                        <button id="qmSaveTemplateBtn" class="tool-btn tool-btn-grow">
                            💾 現在のテストを保存</button>
                        <button id="qmDeleteTemplateBtn" class="tool-btn-danger">
                            削除</button>
                    </div>
                </div>

                <!-- テスト基本情報 -->
                <div class="tool-card">
                    <h3 class="tool-card-title tool-card-title-spaced">
                        📄 テスト基本情報
                    </h3>
                    <div class="qm-info-grid">
                        <div class="qm-info-wide">
                            <label class="tool-label" for="qmTitle">テストタイトル</label>
                            <input id="qmTitle" type="text" class="tool-input" value="${util.esc(qm.title)}" placeholder="例: 第1回定期テスト">
                        </div>
                        <div>
                            <label class="tool-label" for="qmGrade">学年・クラス</label>
                            <input id="qmGrade" type="text" class="tool-input" value="${util.esc(qm.grade)}" placeholder="3年1組">
                        </div>
                        <div>
                            <label class="tool-label" for="qmDate">実施日</label>
                            <input id="qmDate" type="date" class="tool-input" value="${util.esc(qm.date)}">
                        </div>
                        <div>
                            <label class="tool-label" for="qmPeriod">何限目</label>
                            <select id="qmPeriod" class="tool-input">
                                <option value="">─ 選択 ─</option>
                                ${[1,2,3,4,5,6,7,8,9,10].map(p => `
                                    <option value="${p}" ${qm.period == p ? 'selected' : ''}>${p}限目</option>
                                `).join('')}
                                <option value="放課後" ${qm.period === '放課後' ? 'selected' : ''}>放課後</option>
                            </select>
                        </div>
                        <div>
                            <label class="tool-label" for="qmNotes">備考</label>
                            <input id="qmNotes" type="text" class="tool-input" value="${util.esc(qm.notes)}" placeholder="例: 教科書p.1〜p.50">
                        </div>
                    </div>
                </div>

                <!-- 評価観点設定 -->
                <div class="tool-card">
                    <div class="tool-card-header">
                        <h3>📊 評価観点</h3>
                        <button id="qmAddCriteriaBtn" class="tool-btn tool-btn-small">＋ 追加</button>
                    </div>
                    <div id="qmCriteriaList">${this.renderCriteriaList(qm.criteria)}</div>
                </div>

                <!-- 大問リスト -->
                <div class="tool-card">
                    <div class="tool-card-header tool-card-header-spaced">
                        <h3>🗂️ 大問・設問</h3>
                        <button id="qmAddSectionBtn" class="tool-btn-primary">＋ 大問追加</button>
                    </div>
                    <div id="qmSectionList">${this.renderSectionList(qm)}</div>
                </div>

                <!-- 集計 -->
                <div id="qmScoreSummary" class="tool-card">
                    ${this.renderScoreSummary(qm)}
                </div>
            </div>

            <!-- ── 右パネル：プレビュー ── -->
            <div class="qm-preview-column">
                <div class="tool-card">
                    <div class="tool-card-header tool-card-header-spaced">
                        <h3>👁️ プレビュー</h3>
                        <div class="tool-row tool-row-center">
                            <button id="qmRandomBtn" class="qm-random-btn ${randomMode ? 'active' : ''}" aria-pressed="${randomMode}">${randomMode ? '🔀 ランダム順' : '🔀 No順'}</button>
                            <select id="qmPaperSize" class="tool-select-small" aria-label="用紙サイズ">
                                <option value="a4">A4</option>
                                <option value="b4">B4</option>
                            </select>
                            <button id="qmPrintBtn" class="tool-btn-primary tool-btn-purple">🖨️ PDF出力</button>
                        </div>
                    </div>
                    <!-- プレビュー本体（縮小表示） -->
                    <div id="qmPreviewWrapper">
                        <div id="qmPreviewContent">
                            ${this.renderPreviewHTML(qm)}
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    },

    renderCriteriaList(criteria) {
        const util = window.TestToolsUtil;
        return criteria.map((c, i) => `
            <div class="qm-criteria-row" data-cid="${c.id}">
                <div class="qm-color-dot" style="background:${c.color};"></div>
                <input class="qm-criteria-label tool-input tool-input-compact" value="${util.esc(c.label)}" aria-label="評価観点${i + 1}の名前">
                <div class="qm-color-picker">
                    <input class="qm-criteria-color" type="color" value="${c.color}" aria-label="評価観点${i + 1}の色">
                </div>
                <button class="qm-remove-criteria tool-icon-danger" title="この評価観点を削除" aria-label="評価観点${i + 1}を削除">✕</button>
            </div>`).join('');
    },

    renderSectionList(qm) {
        const util = window.TestToolsUtil;
        if (qm.sections.length === 0) {
            return `<p class="qm-empty">
                大問がありません。「＋ 大問追加」で追加してください。</p>`;
        }
        return qm.sections.map((sec, si) => `
            <div class="qm-section" data-sid="${sec.id}">
                <!-- 大問ヘッダー -->
                <div class="qm-section-header">
                    <!-- 並び替えボタン -->
                    <div class="qm-move-buttons">
                        <button class="qm-move-section" data-sid="${sec.id}" data-dir="up" title="上へ移動" aria-label="大問${si + 1}を上へ"
                            ${si === 0 ? 'disabled' : ''}>
                            ▲</button>
                        <button class="qm-move-section" data-sid="${sec.id}" data-dir="down" title="下へ移動" aria-label="大問${si + 1}を下へ"
                            ${si === qm.sections.length - 1 ? 'disabled' : ''}>
                            ▼</button>
                    </div>
                    <span class="qm-section-label">大問${si + 1}</span>
                    <input class="qm-sec-title tool-input qm-input-title" value="${util.esc(sec.title)}" placeholder="タイトル（例: 歴史について答えよ）" aria-label="大問${si + 1}のタイトル">
                    <button class="qm-remove-section tool-btn-danger-small" data-sid="${sec.id}">
                        削除</button>
                </div>
                <!-- リード文 -->
                <div class="qm-section-intro">
                    <textarea class="qm-sec-intro tool-input qm-input-intro" rows="2" placeholder="リード文（例: 次の文を読んで、各問いに答えなさい。）" aria-label="大問${si + 1}のリード文">${util.esc(sec.intro)}</textarea>
                </div>
                <!-- 設問リスト -->
                <div class="qm-questions-wrap">
                    ${this.renderQuestionList(qm, sec, si)}
                </div>
                <!-- 設問追加ボタン -->
                <div class="qm-add-question-wrap">
                    <button class="qm-add-question tool-btn-dashed" data-sid="${sec.id}">＋ 設問追加</button>
                </div>
            </div>`).join('');
    },

    renderQuestionList(qm, sec, si) {
        const util = window.TestToolsUtil;
        if (sec.questions.length === 0) {
            return `<p class="qm-empty qm-empty-small">設問がありません</p>`;
        }
        return sec.questions.map((q, qi) => `
            <div class="qm-question" data-qid="${q.id}">
                <span class="qm-question-no">
                    (${qi + 1})</span>
                <div class="qm-question-fields">
                    <input class="qm-q-text tool-input qm-input-text" value="${util.esc(q.text)}" placeholder="問題文" aria-label="(${qi + 1})の問題文">
                    <input class="qm-q-answer-symbol tool-input qm-input-answer qm-input-symbol" value="${util.esc(q.answerSymbol || '')}" placeholder="記号解答（ア・イ・ウ等）" aria-label="(${qi + 1})の記号解答">
                    <input class="qm-q-answer tool-input qm-input-answer qm-input-word" value="${util.esc(q.answer)}" placeholder="言葉で解答" aria-label="(${qi + 1})の言葉の解答">
                </div>
                <div>
                    <label class="qm-mini-label">配点</label>
                    <div class="qm-points">
                        <input class="qm-q-points tool-input qm-input-points" type="number" value="${q.points}" min="0" max="99" aria-label="(${qi + 1})の配点">
                        <span class="qm-unit">点</span>
                    </div>
                </div>
                <div>
                    <label class="qm-mini-label">評価観点</label>
                    <select class="qm-q-criteria tool-input qm-input-criteria" aria-label="(${qi + 1})の評価観点">
                        <option value="">─</option>
                        ${qm.criteria.map(c =>
                            `<option value="${c.id}" ${q.criteriaId === c.id ? 'selected' : ''}>${escapeHtml(c.label)}</option>`
                        ).join('')}
                    </select>
                </div>
                <button class="qm-remove-question tool-icon-danger" data-sid="${sec.id}" data-qid="${q.id}" title="この設問を削除" aria-label="(${qi + 1})を削除">✕</button>
            </div>`).join('');
    },

    renderScoreSummary(qm) {
        const util = window.TestToolsUtil;
        let total = 0;
        const byC = {};
        qm.criteria.forEach(c => { byC[c.id] = 0; });
        qm.sections.forEach(sec => {
            sec.questions.forEach(q => {
                const pts = Number(q.points) || 0;
                total += pts;
                if (q.criteriaId && byC[q.criteriaId] !== undefined) {
                    byC[q.criteriaId] += pts;
                }
            });
        });
        const rows = qm.criteria.map(c => `
            <div class="qm-score-row">
                <div class="qm-score-name">
                    <div class="qm-color-dot qm-color-dot-small" style="background:${c.color};"></div>
                    <span class="qm-score-label">${util.esc(c.label)}</span>
                </div>
                <span class="qm-score-points" style="color:${c.color};">${byC[c.id] || 0} 点</span>
            </div>`).join('');
        return `
            <div class="tool-card-header tool-card-header-tight">
                <h3>🧮 配点集計</h3>
            </div>
            <div class="qm-copy-buttons">
                <button id="qmCopySymbolBtn" class="qm-copy-btn qm-copy-blue">
                    📋 記号で解答</button>
                <button id="qmCopyWordBtn" class="qm-copy-btn qm-copy-green">
                    📋 言葉で解答</button>
                <button id="qmCopyBothBtn" class="qm-copy-btn qm-copy-purple">
                    📋 両方で解答</button>
            </div>
            <!-- コピー用に一時生成する解答表。display:noneだとinnerTextが常に空文字に
                 なる（ブラウザ仕様）ため、画面外へ配置する方式で非表示にする -->
            <div id="qmAllAnswersHidden" class="offscreen"></div>
            ${rows}
            <div class="qm-score-total">
                <span class="qm-score-total-label">合計</span>
                <span class="qm-score-total-value">${total} 点</span>
            </div>`;
    },

    renderPreviewHTML(qm, opts = {}) {
        const util = window.TestToolsUtil;
        const randomize = opts.randomize || false;
        const order = opts.order || {};
        const dateStr = qm.date ? new Date(qm.date).toLocaleDateString('ja-JP') : '';
        const periodStr = qm.period ? ` ${qm.period}${isNaN(qm.period) ? '' : '限目'}` : '';

        // ランダム順表示：呼び出し側（question-maker.jsのtoggleRandom）が
        // 一度だけ決めた並び順(order)をそのまま使う。ここで毎回シャッフルすると、
        // 編集のたびに表示順が変わってしまい「決めたランダム順」を確認できなくなる
        const applyOrder = (questions, sectionId) => {
            const savedIds = order[sectionId];
            if (!savedIds) return questions;
            const byId = new Map(questions.map(q => [q.id, q]));
            const ordered = savedIds.map(id => byId.get(id)).filter(Boolean);
            // 並び順の決定後に追加された設問は末尾に足す
            questions.forEach(q => { if (!savedIds.includes(q.id)) ordered.push(q); });
            return ordered;
        };

        let sectionsHtml = '';
        qm.sections.forEach((sec, si) => {
            const questions = randomize ? applyOrder(sec.questions, sec.id) : sec.questions;
            const secTotal = sec.questions.reduce((s, q) => s + (Number(q.points) || 0), 0);
            const questionsHtml = questions.map((qs, qi) => `
                <div style="margin-bottom:10px; padding-left:1em;">
                    <div style="display:flex; gap:8px;">
                        <span style="white-space:nowrap; font-weight:bold;">(${qi + 1})</span>
                        <span>${util.escapeHtml(qs.text) || '　'}</span>
                        <span style="margin-left:auto; white-space:nowrap; font-size:0.85em; color:#64748b;">
                            [${qm.criteria.find(c => c.id === qs.criteriaId)?.label || '─'}　${Number(qs.points) || 0}点]</span>
                    </div>
                    <div style="margin-top:6px; margin-left:1.5em; border-bottom:1px solid #cbd5e1;
                                min-height:24px;"></div>
                </div>`).join('');
            sectionsHtml += `
                <div style="margin-bottom:24px;">
                    <div style="display:flex; align-items:baseline; gap:10px; margin-bottom:6px;
                                border-left:4px solid #3b82f6; padding-left:10px;">
                        <span style="font-weight:bold; font-size:1.05em;">第${si + 1}問</span>
                        <span>${util.escapeHtml(sec.title) || ''}</span>
                        <span style="margin-left:auto; font-size:0.85em; color:#64748b;">（${secTotal}点）</span>
                    </div>
                    ${sec.intro ? `<p style="margin:0 0 10px; padding:8px; background:#f8fafc;
                        border-radius:4px; font-size:0.9em;">${util.escapeHtml(sec.intro)}</p>` : ''}
                    ${questionsHtml}
                </div>`;
        });
        const totalPoints = qm.sections.reduce((s, sec) =>
            s + sec.questions.reduce((ss, qq) => ss + (Number(qq.points) || 0), 0), 0);

        return `
            <div id="qmPrintTarget" style="-webkit-print-color-adjust: exact; color-adjust: exact; font-family:'Hiragino Kaku Gothic Pro','メイリオ',sans-serif;
                font-size:12px; line-height:1.6; color:#1e293b; padding:20px;">
                <!-- ヘッダー -->
                <div style="display:flex; justify-content:space-between; align-items:flex-end;
                            border-bottom:2px solid #1e293b; padding-bottom:8px; margin-bottom:16px;">
                    <div>
                        <div style="font-size:1.4em; font-weight:bold;">
                            ${util.escapeHtml(qm.title) || 'テストタイトル'}
                        </div>
                        <div style="font-size:0.9em; color:#475569; margin-top:2px;">
                            ${util.escapeHtml(qm.grade)}${qm.grade && dateStr ? '　' : ''}
                            ${dateStr}${periodStr}
                            ${qm.notes ? '　' + util.escapeHtml(qm.notes) : ''}
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
    }
};

if (typeof window !== 'undefined') {
    window.TestToolsQMRenderer = TestToolsQMRenderer;
}
