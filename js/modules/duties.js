// ===== クラス係掲示ツールモジュール =====

const DutiesModule = {
    draggedStudent: null,

    // 初期化
    init() {
        this.setupEventListeners();
        console.log('📋 Duties Module initialized');
    },

    // イベントリスナーのセットアップ
    setupEventListeners() {
        // 係追加ボタン
        const addDutyBtn = document.getElementById('addDutyBtn');
        if (addDutyBtn) {
            addDutyBtn.addEventListener('click', () => {
                this.openAddDutyModal();
            });
        }

        // モーダルキャンセル
        const cancelDutyBtn = document.getElementById('cancelDutyBtn');
        if (cancelDutyBtn) {
            cancelDutyBtn.addEventListener('click', () => {
                document.getElementById('dutyModal').classList.remove('active');
            });
        }

        const closeDutyModal = document.getElementById('closeDutyModal');
        if (closeDutyModal) {
            closeDutyModal.addEventListener('click', () => {
                document.getElementById('dutyModal').classList.remove('active');
            });
        }

        // 係保存
        const saveDutyBtn = document.getElementById('saveDutyBtn');
        if (saveDutyBtn) {
            saveDutyBtn.addEventListener('click', () => {
                this.saveDuty();
            });
        }

        // 印刷
        const printBtn = document.getElementById('printDutiesBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                this.printDuties();
            });
        }

        // 履歴保存
        const saveHistoryBtn = document.getElementById('saveDutyHistoryBtn');
        if (saveHistoryBtn) {
            saveHistoryBtn.addEventListener('click', () => {
                this.saveToHistory();
            });
        }

        // 履歴表示
        const viewHistoryBtn = document.getElementById('viewDutyHistoryBtn');
        if (viewHistoryBtn) {
            viewHistoryBtn.addEventListener('click', () => {
                this.showHistory();
            });
        }
        // 定員変更ボタン（ステッパー）
        const decreaseBtn = document.getElementById('decreaseStudentsBtn');
        const increaseBtn = document.getElementById('increaseStudentsBtn');
        const studentsInput = document.getElementById('studentsPerRotation');

        if (decreaseBtn && studentsInput) {
            decreaseBtn.addEventListener('click', () => {
                let val = parseInt(studentsInput.value) || 1;
                if (val > 1) studentsInput.value = val - 1;
            });
        }
        if (increaseBtn && studentsInput) {
            increaseBtn.addEventListener('click', () => {
                let val = parseInt(studentsInput.value) || 1;
                if (val < 99) studentsInput.value = val + 1;
            });
        }
    },

    // 描画
    render() {
        this.renderUnassignedStudents();
        this.renderDutyCards();
    },

    // 未配置生徒の描画
    renderUnassignedStudents() {
        const container = document.getElementById('dutyUnassignedStudents');
        if (!container) return;

        const data = StorageManager.getCurrentData();
        const students = data.students || [];
        const duties = data.duties || [];

        // 配置済みの生徒ID収集
        const assignedIds = new Set();
        duties.forEach(duty => {
            if (duty.assignedStudents) {
                duty.assignedStudents.forEach(id => assignedIds.add(id));
            }
        });

        const unassigned = students.filter(s => !assignedIds.has(s.id));

        if (unassigned.length === 0) {
            container.innerHTML = '<div class="empty-state-small"><p>全員配置済み</p></div>';
            return;
        }

        container.innerHTML = unassigned.map(student => `
            <div class="unassigned-student" draggable="true" data-student-id="${student.id}">
                <div class="student-number">${student.number}</div>
                <div class="student-name">
                    <div class="name-kanji">${student.nameKanji}</div>
                </div>
            </div>
        `).join('');

        // ドラッグイベント
        container.querySelectorAll('.unassigned-student').forEach(el => {
            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'copy'; // 複製ではなく移動だが、UI上は移動
                this.draggedStudent = { id: el.dataset.studentId, fromDutyId: null };
            });
        });

        // コンテナへのドロップ（係から戻す）
        container.addEventListener('dragover', (e) => e.preventDefault());
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            this.onDropToUnassigned(e);
        });
    },

    // 係カードの描画
    renderDutyCards() {
        const container = document.getElementById('dutyCardsContainer');
        if (!container) return;

        const data = StorageManager.getCurrentData();
        const duties = data.duties || [];

        if (duties.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>係が登録されていません。「係を追加」ボタンから登録してください。</p></div>';
            return;
        }

        container.innerHTML = '';
        container.className = 'duty-cards-grid'; // グリッドレイアウト用クラス

        duties.forEach(duty => {
            const card = document.createElement('div');
            card.className = 'duty-card-large';

            const max = parseInt(duty.maxStudents) || 1;
            const current = (duty.assignedStudents || []).length;

            card.innerHTML = `
                <div class="duty-header">
                    <div class="duty-title">
                        <h4>${duty.name}</h4>
                        <span class="duty-count ${current > max ? 'over' : ''}">${current}/${max}名</span>
                    </div>
                    <button class="btn-icon delete-duty" title="削除">🗑️</button>
                </div>
                <div class="duty-description">${duty.description || ''}</div>
                <div class="duty-slots" data-duty-id="${duty.id}">
                    <!-- スロット生成 -->
                </div>
            `;

            // スロット生成（定員分＋予備）
            const slotsContainer = card.querySelector('.duty-slots');
            const slotsCount = Math.max(max, current + 1); // 定員か現在人数+1まで表示

            for (let i = 0; i < slotsCount; i++) {
                const slot = document.createElement('div');
                slot.className = 'duty-slot';

                if (i < current) {
                    // 生徒がいる場合
                    const studentId = duty.assignedStudents[i];
                    const student = data.students.find(s => s.id === studentId);
                    if (student) {
                        slot.className = 'duty-slot occupied';
                        slot.innerHTML = `
                            <div class="slot-student" draggable="true" data-student-id="${student.id}" data-duty-id="${duty.id}">
                                <div class="slot-number">${student.number}</div>
                                <div class="slot-name">${student.nameKanji}</div>
                            </div>
                        `;
                    }
                } else if (i < max) {
                    // 空きスロット（定員内）
                    slot.className = 'duty-slot empty';
                    slot.innerHTML = '<div class="slot-placeholder">空き</div>';
                } else {
                    // 定員超過分のためのプレースホルダー（通常は表示しないが、DD用にあると便利）
                    slot.className = 'duty-slot extra';
                }

                // ドロップイベント
                slot.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    slot.classList.add('drag-over');
                });
                slot.addEventListener('dragleave', () => {
                    slot.classList.remove('drag-over');
                });
                slot.addEventListener('drop', (e) => {
                    e.preventDefault();
                    slot.classList.remove('drag-over');
                    this.onDropToDuty(e, duty.id);
                });

                slotsContainer.appendChild(slot);
            }

            // ドラッグ開始（スロット内の生徒）
            card.querySelectorAll('.slot-student').forEach(el => {
                el.addEventListener('dragstart', (e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    this.draggedStudent = {
                        id: el.dataset.studentId,
                        fromDutyId: el.dataset.dutyId
                    };
                });
            });

            // 削除ボタン
            card.querySelector('.delete-duty').addEventListener('click', () => {
                this.deleteDuty(duty.id);
            });

            container.appendChild(card);
        });
    },

    // 未配置エリアへのドロップ
    onDropToUnassigned(e) {
        if (!this.draggedStudent || !this.draggedStudent.fromDutyId) return;

        const data = StorageManager.getCurrentData();
        const duties = data.duties || [];
        const duty = duties.find(d => d.id === this.draggedStudent.fromDutyId);

        if (duty) {
            duty.assignedStudents = duty.assignedStudents.filter(id => id !== this.draggedStudent.id);
            StorageManager.updateCurrentData(data);
            this.render();
        }
        this.draggedStudent = null;
    },

    // 係へのドロップ
    onDropToDuty(e, dutyId) {
        if (!this.draggedStudent) return;

        const { id, fromDutyId } = this.draggedStudent;

        // 同じ係へのドロップは何もしない
        if (fromDutyId === dutyId) return;

        const data = StorageManager.getCurrentData();
        const duties = data.duties;

        // 元の係から削除
        if (fromDutyId) {
            const oldDuty = duties.find(d => d.id === fromDutyId);
            if (oldDuty) {
                oldDuty.assignedStudents = oldDuty.assignedStudents.filter(sid => sid !== id);
            }
        }

        // 新しい係に追加
        const newDuty = duties.find(d => d.id === dutyId);
        if (newDuty) {
            if (!newDuty.assignedStudents) newDuty.assignedStudents = [];
            // 重複チェック
            if (!newDuty.assignedStudents.includes(id)) {
                newDuty.assignedStudents.push(id);
            }
        }

        StorageManager.updateCurrentData(data);
        this.render();

        this.draggedStudent = null;
    },

    // 係追加モーダルを開く
    openAddDutyModal() {
        document.getElementById('dutyName').value = '';
        document.getElementById('dutyDescription').value = '';
        document.getElementById('studentsPerRotation').value = '1';
        document.getElementById('dutyModal').classList.add('active');
    },

    // 係を保存
    saveDuty() {
        const name = document.getElementById('dutyName').value.trim();
        const desc = document.getElementById('dutyDescription').value.trim();
        const max = parseInt(document.getElementById('studentsPerRotation').value);

        if (!name) {
            alert('係名を入力してください');
            return;
        }

        const data = StorageManager.getCurrentData();
        if (!data.duties) data.duties = [];

        data.duties.push({
            id: Date.now().toString(),
            name: name,
            description: desc,
            maxStudents: max,
            assignedStudents: []
        });

        StorageManager.updateCurrentData(data);
        document.getElementById('dutyModal').classList.remove('active');
        this.render();
    },

    // 係を削除
    deleteDuty(id) {
        if (!confirm('この係を削除しますか？\n配置されている生徒は未配置に戻ります。')) return;

        const data = StorageManager.getCurrentData();
        data.duties = data.duties.filter(d => d.id !== id);

        StorageManager.updateCurrentData(data);
        this.render();
    },

    // 印刷
    printDuties() {
        const data = StorageManager.getCurrentData();
        const duties = data.duties || [];

        // 全係の中で最大の定員を探す（列数決定のため）
        // assignedStudentsの数とmaxStudentsの大きい方を取る（溢れている場合も考慮）
        let maxCols = 1;
        duties.forEach(d => {
            const count = Math.max(
                (d.assignedStudents || []).length,
                parseInt(d.maxStudents) || 1
            );
            if (count > maxCols) maxCols = count;
        });

        // 列ヘッダー生成
        let headerCols = '';
        for (let i = 1; i <= maxCols; i++) {
            headerCols += `<th>担当${i}</th>`;
        }

        let html = `
            <!DOCTYPE html>
            <html lang="ja">
            <head>
                <meta charset="UTF-8">
                <title>係一覧表</title>
                <style>
                    @page { size: A4 portrait; margin: 10mm; }
                    body { font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif; font-size: 11pt; }
                    h1 { text-align: center; margin-bottom: 10px; font-size: 18pt; margin-top: 0; }
                    .date-info { text-align: right; margin-bottom: 5px; font-size: 0.9em; }
                    
                    /* テーブル設定 */
                    .duty-table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        table-layout: fixed; /* 固定レイアウト */
                    }
                    
                    .duty-table th, .duty-table td { 
                        border: 1px solid #000; 
                        padding: 6px 4px; 
                        text-align: center; 
                        vertical-align: middle;
                        height: 35px; /* 行の高さをある程度固定 */
                        overflow: hidden;
                    }
                    
                    /* 係名列 */
                    .duty-table th:first-child,
                    .duty-table td:first-child { 
                        width: 15%; /* 係名は狭く */
                        background: #f5f5f5;
                        font-weight: bold;
                        white-space: nowrap;
                    }
                    
                    /* 担当列 */
                    .duty-table th:not(:first-child) {
                        background: #fafafa;
                        font-size: 0.9em;
                        width: ${85 / maxCols}%; /* 残りを等分 */
                    }

                    .student-item { font-size: 11pt; }
                    .student-number { font-size: 0.8em; color: #333; margin-right: 2px; }
                    td div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                    /* 説明書きは係名の下に小さく表示したいが、スペース削減のためtitle属性か、あるいは省略 */
                    .duty-name-cell {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        line-height: 1.2;
                    }
                    .duty-desc {
                        font-size: 0.7em;
                        font-weight: normal;
                        color: #555;
                        margin-top: 2px;
                        white-space: normal; /* 折り返し許可 */
                        max-width: 100%;
                    }
                    
                    /* 印刷時の改ページ抑制 */
                    tr { page-break-inside: avoid; }
                </style>
            </head>
            <body>
                <h1>係一覧表</h1>
                <div class="date-info">${new Date().toLocaleDateString('ja-JP')} 現在</div>
                <table class="duty-table">
                    <thead>
                        <tr>
                            <th>係名</th>
                            ${headerCols}
                        </tr>
                    </thead>
                    <tbody>
        `;

        duties.forEach(duty => {
            // 生徒列の生成
            let studentCells = '';
            for (let i = 0; i < maxCols; i++) {
                const sid = (duty.assignedStudents || [])[i];
                let cellContent = '';

                if (sid) {
                    const s = data.students.find(st => st.id === sid);
                    if (s) {
                        cellContent = `<span class="student-number">${s.number}</span>${s.nameKanji}`;
                    }
                }

                // 該当なしで、定員内の場合は空欄（枠はある）、定員外の場合は斜線などを入れたいが、シンプルに空欄で統一
                studentCells += `<td>${cellContent}</td>`;
            }

            html += `
                <tr>
                    <td>
                        <div class="duty-name-cell">
                            <span>${duty.name}</span>
                            ${duty.description ? `<span class="duty-desc">${duty.description}</span>` : ''}
                        </div>
                    </td>
                    ${studentCells}
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </body></html>
        `;

        const win = window.open('', '', 'width=900,height=700');
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); }, 500);
    },

    // 履歴に保存
    saveToHistory() {
        const name = prompt('この係配置に名前を付けてください（例: 1学期係分担）');
        if (!name) return;

        const data = StorageManager.getCurrentData();
        if (!data.duties) data.duties = [];
        if (!data.dutiesHistory) data.dutiesHistory = [];

        data.dutiesHistory.unshift({
            name: name,
            timestamp: new Date().toISOString(),
            duties: JSON.parse(JSON.stringify(data.duties))
        });

        // 最大10件
        data.dutiesHistory = data.dutiesHistory.slice(0, 10);
        StorageManager.updateCurrentData(data);
        alert('履歴に保存しました');
    },

    // 履歴から読み込み
    loadFromHistory(index) {
        const data = StorageManager.getCurrentData();
        const history = data.dutiesHistory || [];

        if (index >= history.length) return;

        const item = history[index];
        if (confirm(`「${item.name}」を読み込みますか？\\n現在の係配置は上書きされます。`)) {
            data.duties = JSON.parse(JSON.stringify(item.duties));
            StorageManager.updateCurrentData(data);
            this.render();
        }
    },

    // 履歴を表示
    showHistory() {
        const data = StorageManager.getCurrentData();
        const history = data.dutiesHistory || [];

        if (history.length === 0) {
            alert('履歴がありません');
            return;
        }

        let msg = '履歴一覧:\\n';
        history.forEach((item, i) => {
            msg += `${i + 1}. ${item.name} (${new Date(item.timestamp).toLocaleString('ja-JP')})\\n`;
        });
        msg += '\\n読み込む番号を入力してください（キャンセルは空欄）:';

        const input = prompt(msg);
        if (!input) return;

        const idx = parseInt(input) - 1;
        if (idx >= 0 && idx < history.length) {
            this.loadFromHistory(idx);
        } else {
            alert('無効な番号です');
        }
    }
};

window.DutiesModule = DutiesModule;
