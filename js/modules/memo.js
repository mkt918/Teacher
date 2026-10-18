// ===== メモモジュール（個人メモ + 生徒メモ） =====

const MemoModule = {
    // 個人メモデータ
    personalMemos: [],

    // 現在選択中のメモ
    currentMemoType: null, // 'personal' or 'student'
    currentMemoId: null,
    currentStudentId: null,

    // 生徒メモアコーディオン状態
    studentAccordionOpen: false,

    initialized: false, // 初期化フラグ

    // 初期化
    init() {
        if (this.initialized) return; // 重複初期化防止

        this.setupEventListeners();
        this.loadPersonalMemos();
        this.initialized = true;
        console.log('📝 Memo Module initialized');
    },

    // イベントリスナーのセットアップ
    setupEventListeners() {
        // 新規メモ追加ボタン
        const addBtn = document.getElementById('addPersonalMemoBtn');
        if (addBtn) {
            // クローンして既存のイベントリスナーを削除するテクニックを使用する場合は注意が必要だが、
            // 今回はinitガードを入れたので単純なaddEventListenerでOK
            addBtn.addEventListener('click', () => this.addNewPersonalMemo());
        }

        // メモ出力
        const exportBtn = document.getElementById('exportMemosBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportAllMemos());
        }

        // 生徒メモアコーディオンヘッダー
        const accordionHeader = document.getElementById('studentMemoAccordionHeader');
        if (accordionHeader) {
            accordionHeader.addEventListener('click', () => this.toggleStudentAccordion());
        }
    },

    // 描画
    render() {
        this.renderPersonalMemoList();
        this.renderStudentList();
        this.updateAccordionState();

        // 選択中のメモがあればエディタを表示
        if (this.currentMemoType === 'personal' && this.currentMemoId) {
            this.renderPersonalMemoEditor(this.currentMemoId);
        } else if (this.currentMemoType === 'student' && this.currentStudentId) {
            this.renderStudentMemoEditor(this.currentStudentId);
        }
    },

    // ===========================================
    // 個人メモ機能
    // ===========================================
    loadPersonalMemos() {
        const data = StorageManager.getCurrentData();
        this.personalMemos = data.personalMemos || [];
        // データ構造のマイグレーション（必要なら）
        this.personalMemos.forEach(memo => {
            if (typeof memo.isPinned === 'undefined') {
                memo.isPinned = false;
            }
        });
    },

    savePersonalMemos() {
        const data = StorageManager.getCurrentData();
        data.personalMemos = this.personalMemos;
        StorageManager.updateCurrentData(data);
    },

    addNewPersonalMemo() {
        const newMemo = {
            id: Date.now().toString(),
            title: '新規メモ',
            text: '',
            isPinned: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.personalMemos.unshift(newMemo);
        this.savePersonalMemos();

        // 新しいメモを選択
        this.currentMemoType = 'personal';
        this.currentMemoId = newMemo.id;
        this.currentStudentId = null;

        this.render();
    },

    async deletePersonalMemo(id) {
        if (!await UI.confirm('このメモを削除します。', { title: 'メモを削除', confirmLabel: '削除する', danger: true })) return;
        this.personalMemos = this.personalMemos.filter(m => m.id !== id);
        this.savePersonalMemos();

        // 削除したメモが選択中だった場合、選択解除
        if (this.currentMemoId === id) {
            this.currentMemoType = null;
            this.currentMemoId = null;

            // エディタもクリア（または非表示）にするために必要ならDOM操作を追加
            // render()で再描画されるので、currentMemoId=nullにしておけば空の状態が描画されるはず
        }

        this.render();
    },

    // ピン留めの切り替え
    togglePinPersonalMemo(id, event) {
        if (event) {
            event.stopPropagation(); // 親要素のクリックイベント（選択）を停止
        }

        const memo = this.personalMemos.find(m => m.id === id);
        if (memo) {
            memo.isPinned = !memo.isPinned;
            this.savePersonalMemos();
            this.renderPersonalMemoList();
        }
    },

    selectPersonalMemo(id) {
        this.currentMemoType = 'personal';
        this.currentMemoId = id;
        this.currentStudentId = null;
        this.renderPersonalMemoList();
        this.renderStudentList();
        this.renderPersonalMemoEditor(id);
    },

    renderPersonalMemoList() {
        const container = document.getElementById('personalMemoList');
        if (!container) return;

        if (this.personalMemos.length === 0) {
            container.innerHTML = '';
            return;
        }

        // ピン留め順、更新日時順にソート
        const sortedMemos = [...this.personalMemos].sort((a, b) => {
            if (a.isPinned !== b.isPinned) {
                return a.isPinned ? -1 : 1; // ピン留めが先
            }
            // 更新日時降順
            return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
        });

        container.innerHTML = sortedMemos.map(memo => {
            const isActive = this.currentMemoType === 'personal' && this.currentMemoId === memo.id;
            const date = new Date(memo.updatedAt || memo.createdAt);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            const preview = memo.text ? memo.text.substring(0, 20) + (memo.text.length > 20 ? '...' : '') : '（空）';

            return `
                <div class="memo-list-item ${isActive ? 'active' : ''}" data-id="${escapeHtml(memo.id)}">
                    <div class="memo-list-item-row">
                        <span class="memo-list-item-title">${escapeHtml(memo.title)}</span>
                        <button class="pin-btn ${memo.isPinned ? 'pinned' : ''}" data-id="${escapeHtml(memo.id)}" title="${memo.isPinned ? 'ピン留め解除' : 'ピン留めする'}" aria-label="${memo.isPinned ? 'ピン留め解除' : 'ピン留めする'}">
                            ${memo.isPinned ? '📌' : '○'}
                        </button>
                    </div>
                    <div class="memo-list-item-row">
                        <span class="memo-list-item-date">${dateStr}</span>
                        <span class="memo-list-item-preview">${escapeHtml(preview)}</span>
                    </div>
                </div>
            `;
        }).join('');

        // クリックイベント
        container.querySelectorAll('.memo-list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // ピンボタンクリック時はここで止まらず親に伝播しないようにボタン側で処理しているが、
                // 万が一のために確認
                if (e.target.closest('.pin-btn')) return;
                this.selectPersonalMemo(item.dataset.id);
            });
        });

        // ピンボタンイベント
        container.querySelectorAll('.pin-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.togglePinPersonalMemo(btn.dataset.id, e);
            });
        });
    },

    renderPersonalMemoEditor(id) {
        const memo = this.personalMemos.find(m => m.id === id);
        if (!memo) return;

        const container = document.getElementById('memoEditorContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="memo-editor-header memo-editor-header-row">
                <input type="text" id="memoTitleInput" class="memo-title-input" value="${escapeHtml(memo.title)}" aria-label="メモのタイトル" />
                <button class="btn btn-secondary btn-sm memo-delete-btn" id="deleteMemoBtn">🗑️ 削除</button>
            </div>
            <textarea id="memoContentTextarea" class="memo-textarea" placeholder="メモを入力してください...">${escapeHtml(memo.text)}</textarea>
        `;

        // タイトル変更
        const titleInput = document.getElementById('memoTitleInput');
        titleInput.addEventListener('input', (e) => {
            memo.title = e.target.value;
            memo.updatedAt = new Date().toISOString();
            this.savePersonalMemos();
            this.renderPersonalMemoList();
        });

        // 内容変更
        const contentTextarea = document.getElementById('memoContentTextarea');
        contentTextarea.addEventListener('input', (e) => {
            memo.text = e.target.value;
            memo.updatedAt = new Date().toISOString();
            this.savePersonalMemos();
            this.renderPersonalMemoList();
        });

        // 削除ボタン
        document.getElementById('deleteMemoBtn').addEventListener('click', () => {
            this.deletePersonalMemo(id);
        });
    },

    // ===========================================
    // 生徒メモ機能
    // ===========================================
    toggleStudentAccordion() {
        this.studentAccordionOpen = !this.studentAccordionOpen;
        this.updateAccordionState();
    },

    updateAccordionState() {
        const studentList = document.getElementById('memoStudentList');
        const arrow = document.getElementById('studentAccordionArrow');

        if (studentList) {
            studentList.style.display = this.studentAccordionOpen ? 'block' : 'none';
        }
        if (arrow) {
            arrow.textContent = this.studentAccordionOpen ? '▲' : '▼';
        }
    },

    renderStudentList() {
        const container = document.getElementById('memoStudentList');
        if (!container) return;

        const data = StorageManager.getCurrentData();
        const students = data.students || [];
        const memos = data.memos || {};

        if (students.length === 0) {
            container.innerHTML = '<div class="memo-student-empty">生徒名簿から生徒を登録してください</div>';
            return;
        }

        // 番号順にソート
        const sortedStudents = sortStudentsByNumber(students);

        container.innerHTML = sortedStudents.map(student => {
            const hasMemo = memos[student.id] && (
                (typeof memos[student.id] === 'string' && memos[student.id].trim()) ||
                (Array.isArray(memos[student.id]) && memos[student.id].length > 0)
            );
            const isActive = this.currentMemoType === 'student' && this.currentStudentId === student.id;

            return `
                <div class="memo-student-item ${isActive ? 'active' : ''}" data-id="${escapeHtml(student.id)}">
                    <div>
                        <span class="memo-student-number">${escapeHtml(student.number)}</span>
                        <span class="memo-student-name">${escapeHtml(student.nameKanji)}</span>
                    </div>
                    ${hasMemo ? '<span class="memo-has-memo" title="メモあり">📝</span>' : ''}
                </div>
            `;
        }).join('');

        // クリックイベント
        container.querySelectorAll('.memo-student-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.selectStudent(e.currentTarget.dataset.id);
            });
        });
    },

    selectStudent(studentId) {
        this.currentMemoType = 'student';
        this.currentStudentId = studentId;
        this.currentMemoId = null;
        this.renderPersonalMemoList();
        this.renderStudentList();
        this.renderStudentMemoEditor(studentId);
    },

    renderStudentMemoEditor(studentId) {
        const data = StorageManager.getCurrentData();
        const student = data.students.find(s => s.id === studentId);
        if (!student) return;

        const container = document.getElementById('memoEditorContainer');
        if (!container) return;

        const memoData = data.memos ? data.memos[studentId] : '';
        const memoText = this._memoToText(memoData);

        container.innerHTML = `
            <div class="memo-editor-header memo-editor-header-row">
                <h3>${escapeHtml(student.number)} ${escapeHtml(student.nameKanji)}（${escapeHtml(student.nameKana)}）</h3>
                <button class="btn btn-secondary btn-sm" id="insertMemoDateBtn" title="カーソルの位置に今日の日付を入れます">📅 今日の日付</button>
            </div>
            <textarea
                id="studentMemoTextarea"
                class="memo-textarea"
                data-student-id="${escapeHtml(studentId)}"
                placeholder="メモを入力してください...

# や #面談 のようなMarkdown風の書式もそのまま
テキストとして記録できます（表示は装飾されないプレーンテキストです）"
            >${escapeHtml(memoText)}</textarea>
        `;

        // 内容変更
        const textarea = document.getElementById('studentMemoTextarea');
        textarea.addEventListener('input', (e) => {
            this.saveStudentMemo(studentId, e.target.value);
        });

        // 面談記録などを日付つきで書きやすいよう、カーソル位置に【2026/5/15(金)】を入れる
        document.getElementById('insertMemoDateBtn').addEventListener('click', () => {
            const now = new Date();
            const stamp = `【${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}(${WEEKDAY_LABELS[now.getDay()]})】\n`;
            const pos = textarea.selectionStart ?? textarea.value.length;
            textarea.value = textarea.value.slice(0, pos) + stamp + textarea.value.slice(pos);
            textarea.focus();
            textarea.setSelectionRange(pos + stamp.length, pos + stamp.length);
            this.saveStudentMemo(studentId, textarea.value);
        });
    },

    // data.memos[studentId] を表示・出力用のプレーンテキストに変換する
    // （文字列形式・配列形式(旧)のどちらでも安全に扱えるようにする）
    _memoToText(memoData) {
        if (typeof memoData === 'string') {
            return memoData;
        }
        if (Array.isArray(memoData)) {
            return memoData.map(m => {
                const date = new Date(m.date);
                const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
                return `【${dateStr}】\n${m.content || ''}`;
            }).join('\n\n');
        }
        return '';
    },

    saveStudentMemo(studentId, text) {
        const data = StorageManager.getCurrentData();
        if (!data.memos) data.memos = {};
        data.memos[studentId] = text;
        StorageManager.updateCurrentData(data);

        // リストのメモアイコンを更新
        this.renderStudentList();
    },

    // 全メモを出力
    exportAllMemos() {
        const data = StorageManager.getCurrentData();
        const students = sortStudentsByNumber(data.students || []);

        let output = '# メモ一括エクスポート\n';
        output += `エクスポート日時: ${new Date().toLocaleString('ja-JP')}\n\n`;

        // 個人メモ
        output += '## 📝 個人メモ\n\n';
        if (this.personalMemos.length === 0) {
            output += '（メモなし）\n\n';
        } else {
            this.personalMemos.forEach(memo => {
                const date = new Date(memo.updatedAt || memo.createdAt);
                const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
                const pinMark = memo.isPinned ? '【📌】 ' : '';
                output += `### ${pinMark}${memo.title}（${dateStr}）\n${memo.text || '（空）'}\n\n`;
            });
        }

        output += '---\n\n## 👥 生徒メモ\n\n';

        if (students.length === 0) {
            output += '（生徒データなし）\n\n';
        } else {
            students.forEach(student => {
                const memo = this._memoToText(data.memos ? data.memos[student.id] : '');
                output += `### ${student.number} ${student.nameKanji}（${student.nameKana}）\n\n`;
                output += (memo && memo.trim()) ? memo + '\n\n' : '（メモなし）\n\n';
            });
        }

        downloadTextFile(output, `memos-${formatDate(new Date())}.txt`);

        UI.toast('メモを出力しました', 'success');
    }
};

// グローバルに公開
window.MemoModule = MemoModule;
