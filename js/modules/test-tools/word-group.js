/**
 * TestToolsWordGroup - 用語問題テンプレートツール
 */
const TestToolsWordGroup = {
    wordGroupRows: [],
    dummyAnswersText: '',

    render() {
        const columnOptions = [1,2,3,4,5,6,7,8,9,10].map(c => `<option value="${c}" ${c === 5 ? 'selected' : ''}>${c}列</option>`).join('');
        return `
            <div class="wg-layout">
                <div>
                    <div class="tool-card tool-card-roomy tool-card-gap">
                        <h3 class="wg-card-title">📝 問題・解答の入力</h3>
                        <p class="tool-help">No、問題文、解答を入力してください。</p>
                        <div class="wg-grid wg-rows-header">
                            <div class="wg-col-head wg-col-head-center">No</div>
                            <div class="wg-col-head">問題文</div>
                            <div class="wg-col-head">解答</div>
                            <div></div>
                        </div>
                        <div id="wgRowsContainer"></div>
                        <div class="tool-row wg-row-actions">
                            <button id="wgAddRowBtn" class="wg-add-row-btn">
                                ＋ 行を追加</button>
                            <button id="wgImportCsvBtn" class="wg-import-btn">
                                📋 CSVから一括入力</button>
                        </div>
                    </div>
                    <div class="tool-card tool-card-roomy">
                        <h3 class="wg-card-title wg-card-title-tight">🎭 ダミー解答</h3>
                        <p class="tool-help tool-help-tight">語群に加えるダミー解答をカンマ区切りで入力してください。</p>
                        <textarea id="wgDummyInput" class="wg-dummy-input" rows="3" placeholder="例: 徳川家光, 豊臣秀頼, 織田信長" aria-label="ダミー解答"></textarea>
                    </div>
                </div>
                <div class="wg-right-column">
                    <!-- テンプレート管理パネル -->
                    <div class="tool-card">
                        <h3 class="tool-card-title">
                            📁 テンプレート管理
                        </h3>
                        <div class="tool-row tool-row-spaced">
                            <select id="wgTemplateSelect" class="tool-select" aria-label="保存済みの語群テンプレート">
                                <option value="">─ 保存済みテンプレート ─</option>
                            </select>
                            <button id="wgLoadTemplateBtn" class="tool-btn">
                                読込</button>
                        </div>
                        <div class="tool-row">
                            <button id="wgSaveTemplateBtn" class="tool-btn tool-btn-grow">
                                💾 現在の内容を保存</button>
                            <button id="wgDeleteTemplateBtn" class="tool-btn-danger">
                                削除</button>
                        </div>
                    </div>

                    <div class="tool-card tool-card-roomy wg-grow">
                        <div class="tool-card-header">
                            <h3 class="wg-card-title">📝 問題一覧（No順）</h3>
                            <button id="wgCopyQuestionsBtn" class="wg-copy-btn">📋 コピー</button>
                        </div>
                        <div id="wgQuestionListOutput" class="wg-output">
                            ここに問題一覧が表示されます</div>

                        <div class="tool-card-header">
                            <h3 class="wg-card-title">📦 用語群（五十音順）</h3>
                            <div class="wg-options">
                                <div class="wg-option">
                                    <label for="wgColumns">列数:</label>
                                    <select id="wgColumns">
                                        ${columnOptions}
                                    </select>
                                </div>
                                <div class="wg-option">
                                    <label for="wgSeparator">形式:</label>
                                    <select id="wgSeparator">
                                        <option value="__kana__">ア, イ, ウ (カタカナ)</option>
                                        <option value="__num__">1, 2, 3 (数字)</option>
                                        <option value="__alpha__">a, b, c (英字)</option>
                                        <option value="__none__">特になし</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="tool-row tool-row-spaced">
                            <button id="wgGenerateBtn" class="wg-generate-btn">🔄 問題・用語群・解答を生成</button>
                            <button id="wgCopyWordGroupBtn" class="wg-copy-btn wg-copy-btn-large">📋 コピー</button>
                        </div>
                        <div id="wgWordGroupOutput" class="wg-output">
                            ここに語群が表示されます</div>
                    </div>
                    <div class="tool-card tool-card-roomy">
                        <div class="tool-card-header">
                            <h3 class="wg-card-title">✅ 解答一覧（No順）</h3>
                            <div class="wg-options">
                                <div class="wg-option">
                                    <label for="wgAnsColumns">列数:</label>
                                    <select id="wgAnsColumns">
                                        ${columnOptions}
                                    </select>
                                </div>
                                <button id="wgCopyAnswersBtn" class="wg-copy-btn">📋 コピー</button>
                            </div>
                        </div>
                        <div id="wgAnswerListOutput" class="wg-output">
                            ここに解答一覧が表示されます</div>
                    </div>
                </div>
            </div>`;
    },

    setupEvents() {
        // render()のたびにDOM（#wgRowsContainer）は作り直されるが、
        // this.wordGroupRows（入力データ）自体はモジュールに残ったままなので、
        // 空の時だけ初期3行を作る。既にデータがあれば消さずに再描画するだけにする
        // （これを空配列で毎回リセットすると、他画面に移動して戻るたびに
        // 入力済みの内容が全て消えてしまう）
        if (this.wordGroupRows.length === 0) {
            for (let i = 0; i < 3; i++) this.addRow();
        } else {
            this.renderRows();
        }
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

        // ダミー解答欄も、行と同様にDOMは作り直されるがthis.dummyAnswersTextで内容を保持する
        const dummyInput = document.getElementById('wgDummyInput');
        if (dummyInput) {
            dummyInput.value = this.dummyAnswersText;
            dummyInput.addEventListener('input', (e) => {
                this.dummyAnswersText = e.target.value;
            });
        }
    },

    updateTemplateSelect() {
        const select = document.getElementById('wgTemplateSelect');
        if (!select) return;
        const data = StorageManager.getCurrentData();
        const templates = data.testTemplates?.wordGroups || [];
        select.innerHTML = '<option value="">─ 保存済みテンプレート ─</option>' +
            templates.map(t => `<option value="${t.id}">${window.TestToolsUtil.esc(t.name)}</option>`).join('');
    },

    async saveTemplate() {
        const values = await UI.form({
            title: '💾 語群テンプレートとして保存',
            fields: [{ name: 'name', label: 'テンプレート名', required: true, placeholder: '例: 1学期期末 用語問題' }],
            submitLabel: '保存'
        });
        if (!values) return;
        const name = values.name;

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
        UI.toast('テンプレートを保存しました。', 'success');
    },

    loadTemplate() {
        const id = document.getElementById('wgTemplateSelect')?.value;
        if (!id) return;

        const data = StorageManager.getCurrentData();
        const template = (data.testTemplates?.wordGroups || []).find(t => t.id == id);
        if (!template) return;

        this.wordGroupRows = template.rows.map(r => ({ ...r, id: Date.now() + Math.random() }));
        this.renderRows();
        this.dummyAnswersText = template.dummyInput || '';
        const dummyInp = document.getElementById('wgDummyInput');
        if (dummyInp) dummyInp.value = this.dummyAnswersText;
        
        // 生成結果も即座に反映
        this.generateWordGroup();
    },

    async deleteTemplate() {
        const id = document.getElementById('wgTemplateSelect')?.value;
        if (!id) return;
        if (!await UI.confirm('このテンプレートを削除します。', { title: 'テンプレートを削除', confirmLabel: '削除する', danger: true })) return;

        const data = StorageManager.getCurrentData();
        if(data.testTemplates) {
            data.testTemplates.wordGroups = (data.testTemplates.wordGroups || []).filter(t => t.id != id);
            StorageManager.updateCurrentData({ testTemplates: data.testTemplates });
            this.updateTemplateSelect();
        }
    },

    async showCsvInputModal() {
        const values = await UI.form({
            title: '📋 CSVからの一括入力',
            description: 'Excel等からコピーした複数行のテキストをそのまま貼り付けてください。\n形式:「No, 問題文, 解答」または「問題文, 解答」（タブ区切りも可）',
            fields: [{ name: 'text', label: '貼り付ける内容', type: 'textarea', rows: 12, placeholder: 'ここにペースト...' }],
            submitLabel: '一括入力する',
            wide: true
        });
        if (values) this.importFromCSV(values.text);
    },

    importFromCSV(text) {
        if (!text || !text.trim()) return;

        // Excelからコピーした表はタブ区切り、それ以外はカンマ区切りとして読む
        const lines = text.trim().split(/\r?\n/);
        const newRows = [];
        lines.forEach(line => {
            const parts = line.split(line.includes('\t') ? '\t' : ',').map(s => s.trim());
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
            <div class="wg-grid wg-row" data-row-id="${row.id}">
                <input type="number" class="wg-no wg-input wg-input-center" value="${index + 1}" min="1" aria-label="${index + 1}行目のNo">
                <input type="text" class="wg-question wg-input" placeholder="問題文（任意）" value="${esc(row.question || '')}" aria-label="${index + 1}行目の問題文">
                <input type="text" class="wg-answer wg-input ${row.answer ? 'filled' : ''}" placeholder="解答" value="${esc(row.answer || '')}" aria-label="${index + 1}行目の解答">
                <button class="wg-remove-btn" title="この行を削除" aria-label="${index + 1}行目を削除">✕</button>
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
                answerInput.classList.toggle('filled', !!answerInput.value);
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
                tableOutput += `<td style="border:1px solid #000; padding:0 4px; vertical-align:top; text-align:left; white-space:nowrap; width:${100/cols}%;">
                    <span style="font-size:0.9em; color:#333;">${sym ? sym + '．' : ''}</span>
                    <span style="font-weight:normal;">${esc(s)}</span>
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
                    
                    ansTable += `<td style="border:1px solid #000; padding:0 4px; vertical-align:top; text-align:left; white-space:nowrap; width:${100/ansCols}%;">
                        <span style="font-size:0.9em; color:#333;">${r.no}　</span>
                        <span style="font-weight:bold;">${esc(String(displayAns))}</span>
                    </td>`;
                } else {
                    ansTable += `<td style="border:1px solid #000; padding:0 4px; width:${100/ansCols}%;">&nbsp;</td>`;
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
