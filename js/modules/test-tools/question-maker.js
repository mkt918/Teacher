/**
 * TestToolsQuestionMaker - 作問補助ツール (状態管理・メインロジック)
 */
const TestToolsQuestionMaker = {
    randomMode: false,   // true のときプレビューをランダム順表示
    // ランダム順に切り替えた時点で一度だけ決めた並び順（大問id → 設問idの配列）。
    // 編集のたびに再シャッフルしてしまうと、印刷直前にたまたま表示されていた順が
    // 印刷されてしまい「決めたランダム順」を確認できなくなるため、
    // トグルした瞬間にだけ生成し、以降の再描画では使い回す
    randomOrder: {},

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

    init() {
        if (!this.qmIsReactive) {
            // 他の機能（名簿・出欠等）と異なり、作問補助はここまで自動保存の
            // 対象外だったため、テンプレート化する前にリロードすると入力が
            // 全て消えていた。保存済みの下書きがあれば先に復元する
            const savedDraft = window.StorageManager?.getCurrentData()?.testToolsDraft;
            if (savedDraft && typeof savedDraft === 'object') {
                this.qm = savedDraft;
            }

            // リアクティブ状態の生成
            this.qm = window.CoreReactivity.createReactiveState(this.qm, () => {
                // 自動再描画のハンドラ
                this.refreshCriteriaList();
                this.refreshSectionList();
                this.refreshSummary();
                this.refreshPreview();
                this._saveDraft();
            });
            this.qmIsReactive = true;
        }
    },

    // 編集中の内容を下書きとして自動保存する（テンプレート保存とは別に、
    // リロードでの消失を防ぐためのもの）
    _saveDraft() {
        const data = window.StorageManager?.getCurrentData();
        if (!data) return;
        data.testToolsDraft = JSON.parse(JSON.stringify(this.qm));
        window.StorageManager.updateCurrentData(data);
    },

    render() {
        this.init();
        return window.TestToolsQMRenderer.renderQMTool(this.qm);
    },

    setupEvents() {
        if (window.TestToolsQMEvents) {
            window.TestToolsQMEvents.setup(this);
        }
    },

    // ── グローバルな更新メソッド ──
    refreshCriteriaList() {
        const el = document.getElementById('qmCriteriaList');
        if (el && window.TestToolsQMRenderer) {
            const html = window.TestToolsQMRenderer.renderCriteriaList(this.qm.criteria);
            window.CoreDOM.updateDOMWithState(el, html);
        }
    },

    refreshSectionList() {
        const el = document.getElementById('qmSectionList');
        if (el && window.TestToolsQMRenderer) {
            const html = window.TestToolsQMRenderer.renderSectionList(this.qm);
            window.CoreDOM.updateDOMWithState(el, html);
        }
    },

    refreshSummary() {
        const el = document.getElementById('qmScoreSummary');
        if (el && window.TestToolsQMRenderer) {
            const html = window.TestToolsQMRenderer.renderScoreSummary(this.qm);
            window.CoreDOM.updateDOMWithState(el, html);
            [['qmCopySymbolBtn','symbol'],['qmCopyWordBtn','word'],['qmCopyBothBtn','both']].forEach(([id, mode]) => {
                el.querySelector(`#${id}`)?.addEventListener('click', () => {
                    this.generateAllAnswersTable(mode);
                    window.TestToolsUtil.copyText('qmAllAnswersHidden', id);
                });
            });
        }
    },

    // mode: 'symbol' | 'word' | 'both'
    generateAllAnswersTable(mode = 'both') {
        const hiddenArea = document.getElementById('qmAllAnswersHidden');
        if (!hiddenArea) return;

        const esc = window.TestToolsUtil.esc;

        const answerCols = mode === 'symbol' ? ['記号解答'] :
                           mode === 'word'   ? ['言葉解答'] :
                                              ['記号解答', '言葉解答'];

        let html = `<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
            <thead><tr>
                <th style="border:1px solid #000; padding:4px; background:#f1f5f9;">大問</th>
                <th style="border:1px solid #000; padding:4px; background:#f1f5f9;">No</th>
                ${answerCols.map(c => `<th style="border:1px solid #000; padding:4px; background:#f1f5f9;">${c}</th>`).join('')}
            </tr></thead><tbody>`;

        this.qm.sections.forEach((sec, si) => {
            sec.questions.forEach((q, qi) => {
                const cells = mode === 'symbol' ? `<td style="border:1px solid #000; padding:4px;">${esc(q.answerSymbol || '')}</td>` :
                              mode === 'word'   ? `<td style="border:1px solid #000; padding:4px;">${esc(q.answer || '')}</td>` :
                                                 `<td style="border:1px solid #000; padding:4px;">${esc(q.answerSymbol || '')}</td>
                                                  <td style="border:1px solid #000; padding:4px;">${esc(q.answer || '')}</td>`;
                html += `<tr>
                    <td style="border:1px solid #000; padding:4px; text-align:center;">${si + 1}</td>
                    <td style="border:1px solid #000; padding:4px; text-align:center;">(${qi + 1})</td>
                    ${cells}
                </tr>`;
            });
        });
        html += '</tbody></table>';
        hiddenArea.innerHTML = html;
    },

    refreshPreview() {
        const el = document.getElementById('qmPreviewContent');
        if (el && window.TestToolsQMRenderer) {
            el.innerHTML = window.TestToolsQMRenderer.renderPreviewHTML(this.qm, {
                randomize: this.randomMode,
                order: this.randomOrder
            });
        }
    },

    // 現在の設問構成をもとに、大問ごとのランダム順序を新規に決める
    _generateRandomOrder() {
        const order = {};
        this.qm.sections.forEach(sec => {
            const ids = sec.questions.map(q => q.id);
            for (let i = ids.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [ids[i], ids[j]] = [ids[j], ids[i]];
            }
            order[sec.id] = ids;
        });
        this.randomOrder = order;
    },

    toggleRandom() {
        this.randomMode = !this.randomMode;
        if (this.randomMode) {
            // ONにした瞬間にだけ新しい並び順を決める
            this._generateRandomOrder();
        }
        const btn = document.getElementById('qmRandomBtn');
        if (btn) {
            btn.textContent = this.randomMode ? '🔀 ランダム順' : '🔀 No順';
            btn.style.background = this.randomMode ? '#dbeafe' : '#f1f5f9';
            btn.style.color = this.randomMode ? '#1d4ed8' : '#475569';
            btn.style.border = this.randomMode ? '1px solid #93c5fd' : '1px solid #e2e8f0';
        }
        this.refreshPreview();
    },

    // ── PDF出力 ──
    printPDF() {
        const size  = document.getElementById('qmPaperSize')?.value || 'a4';
        const inner = document.getElementById('qmPrintTarget')?.innerHTML || '';
        const escHtml = window.TestToolsUtil.escapeHtml;
        const css = `
            @page { size: ${size === 'b4' ? 'B4' : 'A4'} portrait; margin:15mm 15mm 15mm 20mm; }
            body { margin:0; font-family:'Hiragino Kaku Gothic Pro','メイリオ',sans-serif;
                   font-size:11pt; color:#000; }
            * { box-sizing:border-box; }`;
        const win = window.open('', '_blank');
        win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
            <title>${escHtml(this.qm.title) || 'テスト'}</title>
            <style>${css}</style></head><body>${inner}</body></html>`);
        win.document.close();
        win.onload = () => { win.print(); };
    },

    // ── テンプレート管理 ──
    updateQMTemplateSelect() {
        const select = document.getElementById('qmTemplateSelect');
        if (!select) return;
        const data = StorageManager.getCurrentData();
        const templates = data.testTemplates?.questions || [];
        const esc = window.TestToolsUtil.esc;
        select.innerHTML = '<option value="">─ 保存済みテンプレート ─</option>' +
            templates.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
    },

    saveTemplate() {
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
        this.updateQMTemplateSelect();
        alert('作問テンプレートを保存しました。');
    },

    loadTemplate() {
        const id = document.getElementById('qmTemplateSelect')?.value;
        if (!id) return;

        const data = StorageManager.getCurrentData();
        const template = data.testTemplates.questions.find(t => t.id == id);
        if (!template) return;

        if (!confirm('現在の編集内容が破棄されます。よろしいですか？')) return;

        // 生のオブジェクトで置き換えるとリアクティブ監視(Proxy)が外れ、
        // 以後の編集で自動再描画・下書き自動保存(_saveDraft)が効かなくなるため、
        // 再度Proxyで包み直す
        this.qm = window.CoreReactivity.createReactiveState(JSON.parse(JSON.stringify(template.qm)), () => {
            this.refreshCriteriaList();
            this.refreshSectionList();
            this.refreshSummary();
            this.refreshPreview();
            this._saveDraft();
        });

        // 再描画
        this.refreshCriteriaList();
        this.refreshSectionList();
        this.refreshSummary();
        this.refreshPreview();
        
        // 基本情報の入力欄（input/select）も手動で更新
        if(document.getElementById('qmTitle')) document.getElementById('qmTitle').value = this.qm.title || '';
        if(document.getElementById('qmGrade')) document.getElementById('qmGrade').value = this.qm.grade || '';
        if(document.getElementById('qmDate')) document.getElementById('qmDate').value = this.qm.date || '';
        if(document.getElementById('qmPeriod')) document.getElementById('qmPeriod').value = this.qm.period || '';
        if(document.getElementById('qmNotes')) document.getElementById('qmNotes').value = this.qm.notes || '';
    },

    deleteTemplate() {
        const id = document.getElementById('qmTemplateSelect')?.value;
        if (!id) return;
        if (!confirm('この作問テンプレートを削除してもよろしいですか？')) return;

        const data = StorageManager.getCurrentData();
        data.testTemplates.questions = data.testTemplates.questions.filter(t => t.id != id);
        StorageManager.updateCurrentData({ testTemplates: data.testTemplates });
        this.updateQMTemplateSelect();
    }
};

if (typeof window !== 'undefined') {
    window.TestToolsQuestionMaker = TestToolsQuestionMaker;
}
