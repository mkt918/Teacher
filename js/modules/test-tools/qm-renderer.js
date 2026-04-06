/**
 * TestToolsQMRenderer - 作問補助ツールのレンダリング
 */
const TestToolsQMRenderer = {
    renderQMTool(qm) {
        const util = window.TestToolsUtil;
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
                            <label style="${util.labelStyle()}">テストタイトル</label>
                            <input id="qmTitle" type="text" value="${util.esc(qm.title)}" placeholder="例: 第1回定期テスト"
                                style="${util.inputStyle()}">
                        </div>
                        <div>
                            <label style="${util.labelStyle()}">学年・クラス</label>
                            <input id="qmGrade" type="text" value="${util.esc(qm.grade)}" placeholder="3年1組"
                                style="${util.inputStyle()}">
                        </div>
                        <div>
                            <label style="${util.labelStyle()}">実施日</label>
                            <input id="qmDate" type="date" value="${util.esc(qm.date)}"
                                style="${util.inputStyle()}">
                        </div>
                        <div>
                            <label style="${util.labelStyle()}">何限目</label>
                            <select id="qmPeriod" style="${util.inputStyle()}">
                                <option value="">─ 選択 ─</option>
                                ${[1,2,3,4,5,6,7,8,9,10].map(p => `
                                    <option value="${p}" ${qm.period == p ? 'selected' : ''}>${p}限目</option>
                                `).join('')}
                                <option value="放課後" ${qm.period === '放課後' ? 'selected' : ''}>放課後</option>
                            </select>
                        </div>
                        <div>
                            <label style="${util.labelStyle()}">備考</label>
                            <input id="qmNotes" type="text" value="${util.esc(qm.notes)}" placeholder="例: 教科書p.1〜p.50"
                                style="${util.inputStyle()}">
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
                    <div id="qmCriteriaList">${this.renderCriteriaList(qm.criteria)}</div>
                </div>

                <!-- 大問リスト -->
                <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:18px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                        <h3 style="margin:0; font-size:0.95em; color:#374151;">🗂️ 大問・設問</h3>
                        <button id="qmAddSectionBtn"
                            style="padding:6px 14px; background:#3b82f6; color:white; border:none; border-radius:8px;
                                   font-size:0.85em; font-weight:bold; cursor:pointer;">＋ 大問追加</button>
                    </div>
                    <div id="qmSectionList">${this.renderSectionList(qm)}</div>
                </div>

                <!-- 集計 -->
                <div id="qmScoreSummary" style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:18px;">
                    ${this.renderScoreSummary(qm)}
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
            <div style="display:grid; grid-template-columns:16px 1fr 60px 28px; gap:6px; align-items:center; margin-bottom:6px;"
                 data-cid="${c.id}">
                <div style="width:12px; height:12px; border-radius:50%; background:${c.color}; flex-shrink:0;"></div>
                <input class="qm-criteria-label" value="${util.esc(c.label)}"
                    style="${util.inputStyle()} padding:4px 8px;">
                <div style="display:flex; align-items:center; gap:2px;">
                    <input class="qm-criteria-color" type="color" value="${c.color}"
                        style="width:28px; height:28px; padding:0; border:none; border-radius:4px; cursor:pointer; background:none;">
                </div>
                <button class="qm-remove-criteria" style="background:#fee2e2; border:none; border-radius:4px;
                    color:#ef4444; cursor:pointer; font-size:0.85em; padding:4px;">✕</button>
            </div>`).join('');
    },

    renderSectionList(qm) {
        const util = window.TestToolsUtil;
        if (qm.sections.length === 0) {
            return `<p style="color:#94a3b8; font-size:0.85em; text-align:center; margin:16px 0;">
                大問がありません。「＋ 大問追加」で追加してください。</p>`;
        }
        return qm.sections.map((sec, si) => `
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
                            ${si === qm.sections.length - 1 ? 'disabled style="opacity:0.2; cursor:not-allowed;"' : 'style="cursor:pointer; background:none; border:none; padding:0; font-size:10px; color:#64748b;"'}>
                            ▼</button>
                    </div>
                    <span style="font-weight:bold; color:#374151; font-size:0.9em; white-space:nowrap;">大問${si + 1}</span>
                    <input class="qm-sec-title" value="${util.esc(sec.title)}" placeholder="タイトル（例: 歴史について答えよ）"
                        style="${util.inputStyle()} flex:1; padding:4px 8px; font-size:0.9em;">
                    <button class="qm-remove-section" data-sid="${sec.id}"
                        style="background:#fee2e2; border:none; border-radius:4px; color:#ef4444; cursor:pointer; padding:4px 8px; font-size:0.8em; white-space:nowrap;">
                        削除</button>
                </div>
                <!-- リード文 -->
                <div style="padding:8px 12px; border-bottom:1px solid #f1f5f9;">
                    <textarea class="qm-sec-intro" rows="2" placeholder="リード文（例: 次の文を読んで、各問いに答えなさい。）"
                        style="${util.inputStyle()} resize:vertical; font-size:0.85em;">${util.esc(sec.intro)}</textarea>
                </div>
                <!-- 設問リスト -->
                <div style="padding:8px 12px;" class="qm-questions-wrap">
                    ${this.renderQuestionList(qm, sec, si)}
                </div>
                <!-- 設問追加ボタン -->
                <div style="padding:4px 12px 10px;">
                    <button class="qm-add-question" data-sid="${sec.id}"
                        style="width:100%; padding:6px; border:1px dashed #cbd5e1; border-radius:6px; background:none;
                               color:#64748b; cursor:pointer; font-size:0.85em;">＋ 設問追加</button>
                </div>
            </div>`).join('');
    },

    renderQuestionList(qm, sec, si) {
        const util = window.TestToolsUtil;
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
                    <input class="qm-q-text" value="${util.esc(q.text)}" placeholder="問題文"
                        style="${util.inputStyle()} font-size:0.85em; padding:4px 6px;">
                    <input class="qm-q-answer" value="${util.esc(q.answer)}" placeholder="解答"
                        style="${util.inputStyle()} font-size:0.8em; padding:3px 6px; background:#f0fdf4; border-color:#86efac;">
                </div>
                <div>
                    <label style="font-size:0.75em; color:#94a3b8; display:block; margin-bottom:2px;">配点</label>
                    <div style="display:flex; align-items:center; gap:2px;">
                        <input class="qm-q-points" type="number" value="${q.points}" min="0" max="99"
                            style="${util.inputStyle()} padding:4px 4px; font-size:0.9em; text-align:center; width:44px;">
                        <span style="font-size:0.8em; color:#64748b;">点</span>
                    </div>
                </div>
                <div>
                    <label style="font-size:0.75em; color:#94a3b8; display:block; margin-bottom:2px;">評価観点</label>
                    <select class="qm-q-criteria"
                        style="${util.inputStyle()} padding:4px 4px; font-size:0.8em;">
                        <option value="">─</option>
                        ${qm.criteria.map(c =>
                            `<option value="${c.id}" ${q.criteriaId === c.id ? 'selected' : ''}>${c.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <button class="qm-remove-question" data-sid="${sec.id}" data-qid="${q.id}"
                    style="background:#fee2e2; border:none; border-radius:4px; color:#ef4444; cursor:pointer;
                           padding:4px; font-size:0.8em; margin-top:2px;">✕</button>
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
            <div style="display:flex; justify-content:space-between; align-items:center;
                        padding:6px 10px; border-radius:6px; background:#f8fafc; margin-bottom:4px;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <div style="width:10px; height:10px; border-radius:50%; background:${c.color};"></div>
                    <span style="font-size:0.85em; color:#475569;">${util.esc(c.label)}</span>
                </div>
                <span style="font-weight:bold; color:${c.color};">${byC[c.id] || 0} 点</span>
            </div>`).join('');
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

    renderPreviewHTML(qm) {
        const util = window.TestToolsUtil;
        const dateStr = qm.date ? new Date(qm.date).toLocaleDateString('ja-JP') : '';
        const periodStr = qm.period ? ` ${qm.period}${isNaN(qm.period) ? '' : '限目'}` : '';
        let sectionsHtml = '';
        qm.sections.forEach((sec, si) => {
            const secTotal = sec.questions.reduce((s, q) => s + (Number(q.points) || 0), 0);
            const questionsHtml = sec.questions.map((qs, qi) => `
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
