/**
 * ReportModule - 要録所見ツール
 *
 * 生徒ごとの所見テキストを入力・保存するツール。
 * - 左：生徒一覧（入力済み/未入力の進捗表示つき）
 * - 右：所見エディタ（文字数カウント・目安文字数の超過表示つき）
 * - 全所見のテキスト一括出力（コピー／.txtダウンロード）
 * データは data.reports = { [studentId]: { text, updatedAt } } に保存する。
 */

const ReportModule = {
    name: 'ReportModule',
    initialized: false,
    currentStudentId: null,
    // 所見の目安文字数（指導要録の所見欄を想定した初期値）
    DEFAULT_CHAR_LIMIT: 300,

    init() {
        if (this.initialized) return;
        this.setupEventListeners();
        this.initialized = true;
        console.log('📄 Report Module initialized');
    },

    setupEventListeners() {
        const exportBtn = document.getElementById('exportReportsBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportAllReports());
        }
    },

    _getReports() {
        const data = window.StorageManager?.getCurrentData() || {};
        return data.reports || {};
    },

    _getCharLimit() {
        const data = window.StorageManager?.getCurrentData() || {};
        return data.reports?._charLimit || this.DEFAULT_CHAR_LIMIT;
    },

    saveReport(studentId, text) {
        const data = window.StorageManager?.getCurrentData() || {};
        if (!data.reports) data.reports = {};
        if (text.trim() === '') {
            delete data.reports[studentId];
        } else {
            data.reports[studentId] = { text, updatedAt: new Date().toISOString() };
        }
        window.StorageManager?.updateCurrentData(data);
    },

    saveCharLimit(limit) {
        const data = window.StorageManager?.getCurrentData() || {};
        if (!data.reports) data.reports = {};
        data.reports._charLimit = limit;
        window.StorageManager?.updateCurrentData(data);
    },

    render() {
        const container = document.getElementById('reportContent');
        if (!container) return;

        const data = window.StorageManager?.getCurrentData() || {};
        const students = sortStudentsByNumber(data.students || []);

        if (students.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 60px 20px; text-align: center; color: #64748b;">
                    <div style="font-size: 3em; margin-bottom: 16px;">📄</div>
                    <p style="font-size: 1.1em; margin-bottom: 8px;">生徒が登録されていません</p>
                    <p style="font-size: 0.9em;">先に「生徒名簿」から生徒を登録してください</p>
                </div>
            `;
            return;
        }

        const reports = this._getReports();
        const doneCount = students.filter(s => reports[s.id]?.text).length;

        if (!this.currentStudentId || !students.some(s => s.id === this.currentStudentId)) {
            this.currentStudentId = students[0].id;
        }

        container.innerHTML = `
            <div class="report-layout">
                <div class="report-student-list">
                    <div class="report-progress">入力済み：${doneCount}/${students.length}人</div>
                    ${students.map(s => {
                        const done = !!reports[s.id]?.text;
                        const active = s.id === this.currentStudentId;
                        return `
                            <button type="button" class="report-student-btn ${active ? 'active' : ''}" data-id="${escapeHtml(s.id)}">
                                <span class="report-student-status">${done ? '✅' : '⬜'}</span>
                                <span class="report-student-number">${escapeHtml(s.number)}</span>
                                <span class="report-student-name">${escapeHtml(s.nameKanji || '（名前未入力）')}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
                <div class="report-editor" id="reportEditor"></div>
            </div>
        `;

        container.querySelectorAll('.report-student-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentStudentId = btn.dataset.id;
                this.render();
            });
        });

        this.renderEditor();
    },

    renderEditor() {
        const editor = document.getElementById('reportEditor');
        if (!editor) return;

        const data = window.StorageManager?.getCurrentData() || {};
        const student = (data.students || []).find(s => s.id === this.currentStudentId);
        if (!student) return;

        const reports = this._getReports();
        const text = reports[student.id]?.text || '';
        const charLimit = this._getCharLimit();
        const updatedAt = reports[student.id]?.updatedAt;

        editor.innerHTML = `
            <div class="report-editor-header">
                <h3>${escapeHtml(student.number)} ${escapeHtml(student.nameKanji || '（名前未入力）')}</h3>
                <div class="report-char-limit-row">
                    <label for="reportCharLimit">目安文字数</label>
                    <input type="number" id="reportCharLimit" min="50" max="2000" step="50" value="${charLimit}">
                    <span>文字</span>
                </div>
            </div>
            <textarea id="reportTextarea" class="report-textarea"
                placeholder="この生徒の所見を入力してください（入力すると自動保存されます）">${escapeHtml(text)}</textarea>
            <div class="report-editor-footer">
                <span id="reportCharCount" class="report-char-count"></span>
                <span class="report-updated-at">${updatedAt ? '最終更新: ' + new Date(updatedAt).toLocaleString('ja-JP') : ''}</span>
            </div>
        `;

        const textarea = editor.querySelector('#reportTextarea');
        const countEl = editor.querySelector('#reportCharCount');
        const limitInput = editor.querySelector('#reportCharLimit');

        const updateCount = () => {
            const len = textarea.value.length;
            const limit = parseInt(limitInput.value) || this.DEFAULT_CHAR_LIMIT;
            countEl.textContent = `${len} / ${limit}文字`;
            countEl.classList.toggle('over-limit', len > limit);
        };
        updateCount();

        textarea.addEventListener('input', () => {
            this.saveReport(student.id, textarea.value);
            updateCount();
        });
        // 一覧の✅表示・進捗を入力後に反映する。
        // ※ここでcontainer全体を再描画(render())すると、blurの直後に
        //   別の生徒ボタンをクリックした際そのボタンがDOMごと差し替えられ、
        //   1回目のクリックが効かなくなる（clickイベントの発火前にボタンが
        //   消える）ため、一覧側は部分更新のみに留める。
        textarea.addEventListener('blur', () => this._updateSidebarStatus());

        limitInput.addEventListener('change', () => {
            const limit = Math.max(50, Math.min(2000, parseInt(limitInput.value) || this.DEFAULT_CHAR_LIMIT));
            limitInput.value = limit;
            this.saveCharLimit(limit);
            updateCount();
        });
    },

    // 生徒一覧側の✅/⬜表示と進捗カウントだけを更新する（一覧DOMは差し替えない）
    _updateSidebarStatus() {
        const data = window.StorageManager?.getCurrentData() || {};
        const students = data.students || [];
        const reports = this._getReports();

        const btn = document.querySelector(`.report-student-btn[data-id="${this.currentStudentId}"]`);
        if (btn) {
            const statusEl = btn.querySelector('.report-student-status');
            const done = !!reports[this.currentStudentId]?.text;
            if (statusEl) statusEl.textContent = done ? '✅' : '⬜';
        }

        const progressEl = document.querySelector('.report-progress');
        if (progressEl) {
            const doneCount = students.filter(s => reports[s.id]?.text).length;
            progressEl.textContent = `入力済み：${doneCount}/${students.length}人`;
        }
    },

    // 全所見をテキストで出力（.txtダウンロード）
    exportAllReports() {
        const data = window.StorageManager?.getCurrentData() || {};
        const students = sortStudentsByNumber(data.students || []);
        const reports = this._getReports();

        if (students.length === 0) {
            alert('生徒が登録されていません');
            return;
        }

        const lines = students.map(s => {
            const text = reports[s.id]?.text || '（未入力）';
            return `【${s.number} ${s.nameKanji || '（名前未入力）'}】\n${text}\n`;
        });
        const content = `要録所見一覧（出力日: ${new Date().toLocaleDateString('ja-JP')}）\n\n${lines.join('\n')}`;

        downloadTextFile(content, `要録所見_${formatDate(new Date())}.txt`);
    }
};

window.ReportModule = ReportModule;
