/**
 * TestToolsQuestionMaker - 作問補助ツール (状態管理・メインロジック)
 */
const TestToolsQuestionMaker = {
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

    render() {
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
            el.innerHTML = window.TestToolsQMRenderer.renderCriteriaList(this.qm.criteria);
        }
    },

    refreshSectionList() {
        const el = document.getElementById('qmSectionList');
        if (el && window.TestToolsQMRenderer) {
            el.innerHTML = window.TestToolsQMRenderer.renderSectionList(this.qm);
            // 大問・設問リストが再描画されたらイベントを再バインド（イベント委任の場合は不要だが念のため）
            // TestToolsQMEvents.setupSectionEvents(this); 
            // ※ qm-events.jsで list自体にイベントが一度だけバインドされるようにしたため、ここでは呼ばなくてよい
        }
    },

    refreshSummary() {
        const el = document.getElementById('qmScoreSummary');
        if (el && window.TestToolsQMRenderer) {
            el.innerHTML = window.TestToolsQMRenderer.renderScoreSummary(this.qm);
            el.querySelector('#qmCopyAllAnswersBtn')?.addEventListener('click', () => {
                this.generateAllAnswersTable();
                window.TestToolsUtil.copyText('qmAllAnswersHidden', 'qmCopyAllAnswersBtn');
            });
        }
    },

    generateAllAnswersTable() {
        const hiddenArea = document.getElementById('qmAllAnswersHidden');
        if (!hiddenArea) return;
        
        const esc = window.TestToolsUtil.esc;
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
                    <td style="border:1px solid #000; padding:4px;">${esc(q.answer || '')}</td>
                </tr>`;
            });
        });
        html += '</tbody></table>';
        hiddenArea.innerHTML = html;
    },

    refreshPreview() {
        const el = document.getElementById('qmPreviewContent');
        if (el && window.TestToolsQMRenderer) {
            el.innerHTML = window.TestToolsQMRenderer.renderPreviewHTML(this.qm);
        }
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

        this.qm = JSON.parse(JSON.stringify(template.qm));
        
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
