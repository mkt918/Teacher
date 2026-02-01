// ===== 生徒名簿管理モジュール =====

const MasterModule = {
    currentEditingId: null,

    // 初期化
    init() {
        this.setupEventListeners();
        console.log('👥 Master Module initialized');
    },

    // イベントリスナーのセットアップ
    setupEventListeners() {
        // 生徒追加ボタン
        document.getElementById('addStudentBtn').addEventListener('click', () => {
            this.openStudentModal();
        });

        // モーダル閉じる
        document.getElementById('closeStudentModal').addEventListener('click', () => {
            this.closeStudentModal();
        });

        document.getElementById('cancelStudentBtn').addEventListener('click', () => {
            this.closeStudentModal();
        });

        // 生徒保存
        document.getElementById('saveStudentBtn').addEventListener('click', () => {
            this.saveStudent();
        });

        // 検索
        document.getElementById('studentSearch').addEventListener('input', (e) => {
            this.filterStudents(e.target.value);
        });

        // ソート
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.render();
        });

        // CSV入出力
        document.getElementById('importCsvBtn').addEventListener('click', () => {
            this.importCSV();
        });

        document.getElementById('exportCsvBtn').addEventListener('click', () => {
            this.exportCSV();
        });
    },

    // 生徒モーダルを開く
    openStudentModal(studentId = null) {
        const modal = document.getElementById('studentModal');
        const title = document.getElementById('studentModalTitle');

        if (studentId) {
            // 編集モード
            const data = StorageManager.getCurrentData();
            const student = data.students.find(s => s.id === studentId);

            if (student) {
                title.textContent = '生徒編集';
                document.getElementById('studentNumber').value = student.number;
                document.getElementById('studentNameKanji').value = student.nameKanji;
                document.getElementById('studentNameKana').value = student.nameKana;
                this.currentEditingId = studentId;
            }
        } else {
            // 新規追加モード
            title.textContent = '生徒追加';
            document.getElementById('studentNumber').value = '';
            document.getElementById('studentNameKanji').value = '';
            document.getElementById('studentNameKana').value = '';
            this.currentEditingId = null;
        }

        modal.classList.add('active');
    },

    // 生徒モーダルを閉じる
    closeStudentModal() {
        const modal = document.getElementById('studentModal');
        modal.classList.remove('active');
        this.currentEditingId = null;
    },

    // 生徒を保存
    saveStudent() {
        const number = document.getElementById('studentNumber').value.trim();
        const nameKanji = document.getElementById('studentNameKanji').value.trim();
        const nameKana = document.getElementById('studentNameKana').value.trim();

        // バリデーション
        if (!number || !nameKanji || !nameKana) {
            alert('すべての項目を入力してください');
            return;
        }

        if (!/^\d{4}$/.test(number)) {
            alert('番号は4桁の数字で入力してください');
            return;
        }

        const data = StorageManager.getCurrentData();

        // 番号の重複チェック（編集時は自分以外）
        const duplicate = data.students.find(s =>
            s.number === number && s.id !== this.currentEditingId
        );

        if (duplicate) {
            alert('この番号は既に使用されています');
            return;
        }

        if (this.currentEditingId) {
            // 編集
            const student = data.students.find(s => s.id === this.currentEditingId);
            if (student) {
                student.number = number;
                student.nameKanji = nameKanji;
                student.nameKana = nameKana;
            }
        } else {
            // 新規追加
            const newStudent = {
                id: this.generateId(),
                number: number,
                nameKanji: nameKanji,
                nameKana: nameKana
            };
            data.students.push(newStudent);
        }

        StorageManager.updateCurrentData(data);
        this.closeStudentModal();
        this.render();
    },

    // 生徒を削除
    deleteStudent(studentId) {
        if (!confirm('この生徒を削除してもよろしいですか？\n関連するメモも削除されます。')) {
            return;
        }

        const data = StorageManager.getCurrentData();
        data.students = data.students.filter(s => s.id !== studentId);

        // 関連するメモも削除
        if (data.memos[studentId]) {
            delete data.memos[studentId];
        }

        StorageManager.updateCurrentData(data);
        this.render();
    },

    // 生徒リストを描画
    render() {
        const data = StorageManager.getCurrentData();
        const listContainer = document.getElementById('studentList');
        const sortBy = document.getElementById('sortSelect').value;

        if (data.students.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <p>生徒が登録されていません</p>
                    <button class="btn btn-primary" onclick="MasterModule.openStudentModal()">最初の生徒を追加</button>
                </div>
            `;
            return;
        }

        // ソート
        let students = [...data.students];
        if (sortBy === 'number') {
            students.sort((a, b) => a.number.localeCompare(b.number));
        } else if (sortBy === 'kana') {
            students.sort((a, b) => a.nameKana.localeCompare(b.nameKana, 'ja'));
        }

        listContainer.innerHTML = students.map(student => `
            <div class="student-item" data-id="${escapeHtml(student.id)}">
                <div class="student-info">
                    <div class="student-number">${escapeHtml(student.number)}</div>
                    <div class="student-name">
                        <div class="name-kanji">${escapeHtml(student.nameKanji)}</div>
                        <div class="name-kana">${escapeHtml(student.nameKana)}</div>
                    </div>
                </div>
                <div class="student-actions">
                    <button class="btn-icon" onclick="MasterModule.openStudentModal('${escapeHtml(student.id)}')" title="編集">✏️</button>
                    <button class="btn-icon delete" onclick="MasterModule.deleteStudent('${escapeHtml(student.id)}')" title="削除">🗑️</button>
                </div>
            </div>
        `).join('');
    },

    // 生徒を検索
    filterStudents(query) {
        const items = document.querySelectorAll('.student-item');
        const lowerQuery = query.toLowerCase();

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(lowerQuery)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    },

    // CSV出力
    exportCSV() {
        const data = StorageManager.getCurrentData();

        if (data.students.length === 0) {
            alert('出力する生徒データがありません');
            return;
        }

        // CSVヘッダー
        let csv = '番号,名前（漢字）,名前（ふりがな）\n';

        // データ行
        data.students.forEach(student => {
            csv += `${student.number},${student.nameKanji},${student.nameKana}\n`;
        });

        // ダウンロード
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `students-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // CSV読込
    importCSV() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const csv = event.target.result;
                    const lines = csv.split('\n').filter(line => line.trim());

                    // ヘッダー行をスキップ
                    const dataLines = lines.slice(1);

                    const data = StorageManager.getCurrentData();
                    let importCount = 0;

                    dataLines.forEach(line => {
                        const [number, nameKanji, nameKana] = line.split(',').map(s => s.trim());

                        if (number && nameKanji && nameKana && /^\d{4}$/.test(number)) {
                            // 重複チェック
                            const exists = data.students.find(s => s.number === number);
                            if (!exists) {
                                data.students.push({
                                    id: this.generateId(),
                                    number,
                                    nameKanji,
                                    nameKana
                                });
                                importCount++;
                            }
                        }
                    });

                    StorageManager.updateCurrentData(data);
                    this.render();
                    alert(`${importCount}件の生徒データを読み込みました`);

                } catch (error) {
                    alert('CSVファイルの読み込みに失敗しました');
                    console.error(error);
                }
            };

            reader.readAsText(file, 'UTF-8');
        };

        input.click();
    },

    // ID生成
    generateId() {
        return 'student_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
};

// グローバルに公開
window.MasterModule = MasterModule;
