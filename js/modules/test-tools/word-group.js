/**
 * TestToolsWordGroup - 用語問題テンプレートツール
 */
const TestToolsWordGroup = {
    wordGroupRows: [],

    render() {
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
                            <h3 style="margin:0; font-size:1em; color:#374151;">📝 問題一覧（No順）</h3>
                            <button id="wgCopyQuestionsBtn" style="padding:7px 14px; background:#10b981; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:0.9em;">📋 コピー</button>
                        </div>
                        <div id="wgQuestionListOutput" style="min-height:60px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-size:0.9em; line-height:1.9; white-space:pre-wrap; color:#374151; margin-bottom:16px;">
                            ここに問題一覧が表示されます</div>

                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <h3 style="margin:0; font-size:1em; color:#374151;">📦 用語群（五十音順）</h3>
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
                                        <option value="__kana__">ア, イ, ウ (カタカナ)</option>
                                        <option value="__num__">1, 2, 3 (数字)</option>
                                        <option value="__alpha__">a, b, c (英字)</option>
                                        <option value="__none__">特になし</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div style="display:flex; gap:8px; margin-bottom:10px;">
                            <button id="wgGenerateBtn" style="flex:1; padding:9px; background:#3b82f6; color:white; border:none;
                                   border-radius:8px; font-weight:bold; cursor:pointer; font-size:0.95em;">🔄 問題・用語群・解答を生成</button>
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
                            <div style="display:flex; gap:12px; align-items:center;">
                                <div style="display:flex; gap:4px; align-items:center;">
                                    <label style="font-size:0.8em; color:#64748b;">列数:</label>
                                    <select id="wgAnsColumns" style="padding:3px 6px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.85em;">
                                        ${[1,2,3,4,5,6,7,8,9,10].map(c => `<option value="${c}" ${c === 5 ? 'selected' : ''}>${c}列</option>`).join('')}
                                    </select>
                                </div>
                                <button id="wgCopyAnswersBtn" style="padding:7px 14px; background:#10b981; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:0.9em;">📋 コピー</button>
                            </div>
                        </div>
                        <div id="wgAnswerListOutput" style="min-height:80px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-size:0.9em; line-height:1.9; white-space:pre-wrap; color:#374151;">
                            ここに解答一覧が表示されます</div>
                    </div>
                </div>
            </div>`;
    },

    setupEvents() {
        this.wordGroupRows = [];
        for (let i = 0; i < 3; i++) this.addRow();
        document.getElementById('wgAddRowBtn')?.addEventListener('click', () => this.addRow());
        document.getElementById('wgImportCsvBtn')?.addEventListener('click', () => this.showCsvInputModal());
        document.getElementById('wgGenerateBtn')?.addEventListener('click', () => this.generateWordGroup());
        document.getElementById('wgCopyQuestionsBtn')?.addEventListener('click', () => window.TestToolsUtil.copyText('wgQuestionListOutput', 'wgCopyQuestionsBtn'));
        document.getElementById('wgCopyWordGroupBtn')?.addEventListener('click', () => window.TestToolsUtil.copyText('wgWordGroupOutput', 'wgCopyWordGroupBtn'));
        document.getElementById('wgCopyAnswersBtn')?.addEventListener('click', () => window.TestToolsUtil.copyText('wgAnswerListOutput', 'wgCopyAnswersBtn'));


        // テンプレート管理
        document.getElementById('wgSaveTemplateBtn')?.addEventListener('click', () => this.saveTemplate());
        document.getElementById('wgLoadTemplateBtn')?.addEventListener('click', () => this.loadTemplate());
        document.getElementById('wgDeleteTemplateBtn')?.addEventListener('click', () => this.deleteTemplate());
        this.updateTemplateSelect();

        // 設定変更時に即時反映
        ['wgSeparator', 'wgColumns', 'wgAnsColumns'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.generateWordGroup());
        });
    },

    updateTemplateSelect() {
        const select = document.getElementById('wgTemplateSelect');
        if (!select) return;
        const data = StorageManager.getCurrentData();
        const templates = data.testTemplates?.wordGroups || [];
        select.innerHTML = '<option value="">─ 保存済みテンプレート ─</option>' +
            templates.map(t => `<option value="${t.id}">${window.TestToolsUtil.esc(t.name)}</option>`).join('');
    },

    saveTemplate() {
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
        if (!data.testTemplates) data.testTemplates = { wordGroups: [], questions: [] };
        if (!data.testTemplates.wordGroups) data.testTemplates.wordGroups = [];
        data.testTemplates.wordGroups.push(newTemplate);
        StorageManager.updateCurrentData({ testTemplates: data.testTemplates });
        this.updateTemplateSelect();
        alert('テンプレートを保存しました。');
    },

    loadTemplate() {
        const id = document.getElementById('wgTemplateSelect')?.value;
        if (!id) return;

        const data = StorageManager.getCurrentData();
        const template = (data.testTemplates?.wordGroups || []).find(t => t.id == id);
        if (!template) return;

        this.wordGroupRows = template.rows.map(r => ({ ...r, id: Date.now() + Math.random() }));
        this.renderRows();
        const dummyInp = document.getElementById('wgDummyInput');
        if (dummyInp) dummyInp.value = template.dummyInput || '';
        
        // 生成結果も即座に反映
        this.generateWordGroup();
    },

    deleteTemplate() {
        const id = document.getElementById('wgTemplateSelect')?.value;
        if (!id) return;
        if (!confirm('このテンプレートを削除してもよろしいですか？')) return;

        const data = StorageManager.getCurrentData();
        if(data.testTemplates) {
            data.testTemplates.wordGroups = (data.testTemplates.wordGroups || []).filter(t => t.id != id);
            StorageManager.updateCurrentData({ testTemplates: data.testTemplates });
            this.updateTemplateSelect();
        }
    },

    showCsvInputModal() {
        const modal = document.createElement('div');
        modal.id = 'wgCsvModal';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1000;';
        
        const content = document.createElement('div');
        content.style.cssText = 'background:white; border-radius:12px; padding:24px; width:90%; max-width:600px; box-shadow:0 10px 25px rgba(0,0,0,0.2);';
        
        content.innerHTML = `
            <h3 style="margin:0 0 12px; font-size:1.1em; color:#374151;">📋 CSVからの一括入力</h3>
            <p style="font-size:0.9em; color:#64748b; margin:0 0 16px;">
                Excel等からコピーした複数行のテキストをそのまま貼り付けてください。<br>
                （形式: <b>No, 問題文, 解答</b> または <b>問題文, 解答</b> ※タブ区切りも対応）
            </p>
            <textarea id="wgCsvTextarea" rows="12" style="width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; font-size:0.95em; box-sizing:border-box; margin-bottom:16px; resize:vertical; font-family:monospace;" placeholder="ここにペースト..."></textarea>
            <div style="display:flex; justify-content:flex-end; gap:12px;">
                <button id="wgCsvCancelBtn" style="padding:8px 16px; border:1px solid #cbd5e1; background:white; color:#475569; border-radius:8px; cursor:pointer;">キャンセル</button>
                <button id="wgCsvApplyBtn" style="padding:8px 16px; border:none; background:#3b82f6; color:white; border-radius:8px; cursor:pointer; font-weight:bold;">一括入力する</button>
            </div>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        const close = () => modal.remove();
        document.getElementById('wgCsvCancelBtn').addEventListener('click', close);
        
        document.getElementById('wgCsvApplyBtn').addEventListener('click', () => {
            const text = document.getElementById('wgCsvTextarea').value;
            this.importFromCSV(text);
            close();
        });
        
        setTimeout(() => document.getElementById('wgCsvTextarea').focus(), 100);
    },

    importFromCSV(text) {
        if (!text || !text.trim()) return;

        const lines = text.trim().split('\n');
        const newRows = [];
        lines.forEach(line => {
            const parts = line.split(/[,\\t]/).map(s => s.trim());
            if (parts.length >= 3) {
                newRows.push({ id: Date.now() + Math.random(), no: parseInt(parts[0]) || (newRows.length+1), question: parts[1], answer: parts[2] });
            } else if (parts.length === 2 && (parts[0] || parts[1])) {
                newRows.push({ id: Date.now() + Math.random(), no: newRows.length + 1, question: parts[0], answer: parts[1] });
            } else if (parts.length === 1 && parts[0]) {
                newRows.push({ id: Date.now() + Math.random(), no: newRows.length + 1, question: '', answer: parts[0] });
            }
        });

        if (newRows.length > 0) {
            this.wordGroupRows = newRows;
            this.renderRows();
            this.generateWordGroup();
        }
    },

    addRow() {
        this.wordGroupRows.push({ id: Date.now() + Math.random() });
        this.renderRows();
    },

    removeRow(id) {
        this.wordGroupRows = this.wordGroupRows.filter(r => r.id !== id);
        this.renderRows();
    },

    renderRows() {
        const container = document.getElementById('wgRowsContainer');
        if (!container) return;
        
        const esc = window.TestToolsUtil.esc;
        const html = this.wordGroupRows.map((row, index) => `
            <div style="display:grid; grid-template-columns:48px 1fr 140px 36px; gap:6px; margin-bottom:6px; align-items:center;" data-row-id="${row.id}">
                <input type="number" class="wg-no" value="${index + 1}" min="1"
                    style="padding:6px 4px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.9em; text-align:center; width:100%;">
                <input type="text" class="wg-question" placeholder="問題文（任意）" value="${esc(row.question || '')}"
                    style="padding:6px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.9em; width:100%;">
                <input type="text" class="wg-answer" placeholder="解答" value="${esc(row.answer || '')}"
                    style="padding:6px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.9em; width:100%;
                           ${row.answer ? 'border-color:#86efac; background:#f0fdf4;' : ''}">
                <button class="wg-remove-btn" style="padding:4px; background:#fee2e2; border:none; border-radius:6px;
                    color:#ef4444; cursor:pointer; font-size:1em; line-height:1;">✕</button>
            </div>`).join('');
        
        window.CoreDOM.updateDOMWithState(container, html);
            
        container.querySelectorAll('.wg-remove-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => this.removeRow(this.wordGroupRows[index].id));
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

    generateWordGroup() {
        const container = document.getElementById('wgRowsContainer');
        if (!container) return;
        
        const esc = window.TestToolsUtil.esc;
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
        const sorted = [...all].sort((a, b) => a.localeCompare(b, 'ja', { sensitivity: 'base' }));

        let tableOutput = '';
        const cols = parseInt(document.getElementById('wgColumns')?.value) || 5;

        const getSymbol = (index, format) => {
            const kana = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'.split('');
            const alpha = 'abcdefghijklmnopqrstuvwxyz'.split('');
            
            if (format === '__kana__') return kana[index] || (index + 1);
            if (format === '__alpha__') return alpha[index] || (index + 1);
            if (format === '__num__') return index + 1;
            if (format === '__none__') return '';
            return index + 1;
        };

        // HTML表形式（語群）
        tableOutput = `<table border="1" cellspacing="0" cellpadding="2" style="border-collapse:collapse; width:100%; border:1px solid #000; font-family:sans-serif; text-align:center;"><tbody>`;
        for (let i = 0; i < sorted.length; i += cols) {
            tableOutput += '<tr>';
            for (let j = 0; j < cols; j++) {
                const s = sorted[i + j] || '';
                const sym = s ? getSymbol(i + j, sep) : '';
                tableOutput += `<td style="border:1px solid #000; padding:2px; vertical-align:top; width:${100/cols}%;">
                    <div style="text-align:left; font-size:0.7em; line-height:1; color:#333; height:0.9em; overflow:hidden;">${sym}</div>
                    <div style="text-align:center; padding-bottom:2px; line-height:1.2;">${esc(s)}</div>
                </td>`;
            }
            tableOutput += '</tr>';
        }
        tableOutput += '</tbody></table>';

        document.getElementById('wgWordGroupOutput').innerHTML = tableOutput;

        // 解答一覧の表形式（横並び）
        const ansCols = parseInt(document.getElementById('wgAnsColumns')?.value) || 5;
        const validAnswers = this.wordGroupRows.filter(r => (r.answer || '').trim())
            .sort((a, b) => (a.no || 0) - (b.no || 0));

        let ansTable = `<table border="1" cellspacing="0" cellpadding="2" style="border-collapse:collapse; width:100%; border:1px solid #000; font-family:sans-serif;"><tbody>`;
        for (let i = 0; i < validAnswers.length; i += ansCols) {
            ansTable += '<tr>';
            for (let j = 0; j < ansCols; j++) {
                const r = validAnswers[i + j];
                if (r) {
                    const ansTrimmed = (r.answer || '').trim();
                    let displayAns = ansTrimmed;
                    if (sep !== '__none__') {
                        const idx = sorted.indexOf(ansTrimmed);
                        if (idx !== -1) {
                            displayAns = getSymbol(idx, sep);
                        }
                    }
                    
                    ansTable += `<td style="border:1px solid #000; padding:2px; vertical-align:top; width:${100/ansCols}%;">
                        <div style="text-align:left; font-size:0.7em; line-height:1; color:#333; height:0.9em; overflow:hidden;">${r.no}</div>
                        <div style="text-align:center; padding-bottom:2px; line-height:1.2; font-weight:bold;">${esc(String(displayAns))}</div>
                    </td>`;
                } else {
                    ansTable += `<td style="border:1px solid #000; padding:2px; width:${100/ansCols}%;">&nbsp;</td>`;
                }
            }
            ansTable += '</tr>';
        }
        ansTable += '</tbody></table>';
        document.getElementById('wgAnswerListOutput').innerHTML = ansTable;

        // 問題一覧の表形式（2列）
        const validQuestions = this.wordGroupRows.filter(r => (r.question || '').trim() || (r.answer || '').trim())
            .sort((a, b) => (a.no || 0) - (b.no || 0));
            
        let questionTable = `<table border="1" cellspacing="0" cellpadding="2" style="border-collapse:collapse; width:100%; border:1px solid #000; font-family:sans-serif;">
            <thead><tr><th style="border:1px solid #000; padding:4px; background:#f1f5f9; width:50px;">No</th><th style="border:1px solid #000; padding:4px; background:#f1f5f9;">問題文</th></tr></thead>
            <tbody>`;
        validQuestions.forEach(r => {
            const qtext = r.question ? esc(r.question) : '';
            questionTable += `<tr><td style="border:1px solid #000; padding:4px; text-align:center;">${r.no}</td><td style="border:1px solid #000; padding:4px;">${qtext}</td></tr>`;
        });
        questionTable += '</tbody></table>';
        document.getElementById('wgQuestionListOutput').innerHTML = questionTable;
    }
};

if (typeof window !== 'undefined') {
    window.TestToolsWordGroup = TestToolsWordGroup;
}
