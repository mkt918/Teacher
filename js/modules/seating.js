// ===== 席替えツールモジュール =====

const SeatingModule = {
    currentLayout: null,
    rows: 6,
    cols: 7,
    history: [],
    draggedStudent: null,
    isLotteryMode: false,

    // トランプ定義
    suits: [
        { id: 'spade', symbol: '♠', color: 'black', label: 'スペード' },
        { id: 'club', symbol: '♣', color: 'black', label: 'クラブ' },
        { id: 'heart', symbol: '♥', color: 'red', label: 'ハート' },
        { id: 'diamond', symbol: '♦', color: 'red', label: 'ダイヤ' }
    ],

    // くじ引き設定（デフォルト）
    lotterySettings: {
        type: 'cards', // 'cards' or 'numbers'
        cardCounts: { spade: 13, club: 13, heart: 13, diamond: 13 },
        numberRange: { start: 1, end: 40 }
    },

    // 初期化
    init() {
        if (this.initialized) return;
        this.setupEventListeners();
        this.initialized = true;
        console.log('🪑 Seating Module initialized');
    },

    // くじ引きセットアップ（シャッフル・配置）
    setupLottery() {
        // 現在のデータ取得
        const data = StorageManager.getCurrentData();
        const lockedSeats = data.seating.lockedSeats || []; // {row, col, studentId}

        // くじプールの生成
        const deck = [];

        if (this.lotterySettings.type === 'numbers') {
            // 番号くじ
            const { start, end } = this.lotterySettings.numberRange;
            for (let i = start; i <= end; i++) {
                deck.push({ type: 'number', value: i });
            }
        } else {
            // トランプくじ (デフォルト)
            this.suits.forEach(suit => {
                const count = this.lotterySettings.cardCounts[suit.id] || 0;
                for (let i = 1; i <= count; i++) {
                    deck.push({ type: 'card', suit: suit.id, number: i });
                }
            });
        }

        // シャッフル
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        // 座席に割り当て
        const lotteryAssignments = {}; // cards -> lotteryAssignments に名称変更を推奨したいが、互換性のため cards を使うか検討。
        // ここでは data.seating.cards を汎用的な「割り当て情報」として扱う
        // 中身は { type: 'card'|'number', ... } となる

        let deckIndex = 0;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                // ロックされている座席はスキップ
                const isLocked = lockedSeats.some(s => s.row === r && s.col === c);
                if (isLocked) continue;

                if (deckIndex < deck.length) {
                    lotteryAssignments[`${r}-${c}`] = deck[deckIndex];
                    deckIndex++;
                }
            }
        }

        // 保存
        if (!data.seating) data.seating = {};
        data.seating.cards = lotteryAssignments; // 名前は cards のままにする（既存互換）
        // 設定も保存しておく
        data.seating.lotterySettings = JSON.parse(JSON.stringify(this.lotterySettings));

        StorageManager.updateCurrentData(data);
        this.render();
    },

    // 設定更新 helper
    updateLotterySettings(newSettings) {
        this.lotterySettings = { ...this.lotterySettings, ...newSettings };
        // 保存は setupLottery か render で行うが、設定値だけの保存も必要なら追記
    },

    // イベントリスナーのセットアップ
    setupEventListeners() {
        // 行・列の変更
        const rowsInput = document.getElementById('seatingRows');
        const colsInput = document.getElementById('seatingCols');

        if (rowsInput) {
            rowsInput.addEventListener('change', (e) => {
                this.rows = parseInt(e.target.value) || 6;
                this.render();
            });
        }

        if (colsInput) {
            colsInput.addEventListener('change', (e) => {
                this.cols = parseInt(e.target.value) || 6;
                this.render();
            });
        }

        // ランダム配置ボタン
        const randomBtn = document.getElementById('randomSeatingBtn');
        if (randomBtn) {
            randomBtn.addEventListener('click', () => {
                this.randomArrange();
            });
        }

        // クリアボタン
        const clearBtn = document.getElementById('clearSeatingBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearSeating();
            });
        }



        // 印刷ボタン
        const printBtn = document.getElementById('printSeatingBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                this.printSeating();
            });
        }

        // タブ切り替え
        const tabNormal = document.getElementById('tabNormalMode');
        const tabLottery = document.getElementById('tabLotteryMode');

        if (tabNormal) {
            tabNormal.addEventListener('click', () => {
                this.switchMode('normal');
            });
        }
        if (tabLottery) {
            tabLottery.addEventListener('click', () => {
                this.switchMode('lottery');
            });
        }

        // 席を保存／読取ボタン
        const openSaveHistoryModalBtn = document.getElementById('openSaveHistoryModalBtn');
        if (openSaveHistoryModalBtn) {
            openSaveHistoryModalBtn.addEventListener('click', () => {
                this.openSaveHistoryModal();
            });
        }

        // 未配置リストへのドロップ（配置解除）
        const unassignedContainer = document.getElementById('unassignedStudents');
        if (unassignedContainer) {
            unassignedContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                unassignedContainer.classList.add('drag-over');
            });
            unassignedContainer.addEventListener('dragleave', () => {
                unassignedContainer.classList.remove('drag-over');
            });
            unassignedContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                unassignedContainer.classList.remove('drag-over');
                this.onDropToUnassigned(e);
            });
        }

        // 以下、くじ引き関連のモーダルイベントなどは renderLotteryControls や openLotteryInputModal 内で動的にバインドするか、ここで一括バインドする
        // 今回は要素が動的生成される部分が多いので、生成時にバインドする方針を維持しつつ、
        // 静的なモーダル類はここでバインド

        // モーダルキャンセル（共通）
        const cancelLotteryInputBtn = document.getElementById('cancelLotteryInputBtn');
        if (cancelLotteryInputBtn) {
            cancelLotteryInputBtn.addEventListener('click', () => {
                document.getElementById('lotteryInputModal').classList.remove('active');
            });
        }

        const closeLotteryInputModal = document.getElementById('closeLotteryInputModal');
        if (closeLotteryInputModal) {
            closeLotteryInputModal.addEventListener('click', () => {
                document.getElementById('lotteryInputModal').classList.remove('active');
            });
        }

        // くじ引き反映ボタン
        const reflectBtn = document.getElementById('reflectLotteryResultBtn');
        if (reflectBtn) {
            reflectBtn.addEventListener('click', () => {
                this.reflectLotteryResults();
            });
        }

        // くじ引き入力クリアボタン
        const clearEntryBtn = document.getElementById('clearLotteryInputBtn'); // 変数名重複回避のため変更
        if (clearEntryBtn) {
            clearEntryBtn.addEventListener('click', () => {
                if (confirm('入力された内容を全てクリアしますか？')) {
                    // inputの値をクリア
                    const inputs = document.querySelectorAll('#lotteryInputGrid input');
                    inputs.forEach(input => input.value = '');
                    // 名前表示をクリア
                    const names = document.querySelectorAll('#lotteryInputGrid .name-display');
                    names.forEach(div => div.textContent = '');
                    // 一時データをクリア
                    this.tempLotteryInput = {};
                }
            });
        }
    },

    // 描画
    render() {
        const data = StorageManager.getCurrentData();

        // 現在のレイアウトを取得または初期化
        if (!this.currentLayout) {
            this.currentLayout = data.seating.current || this.createEmptyLayout();
        }

        // タブUIの更新
        const tabNormal = document.getElementById('tabNormalMode');
        const tabLottery = document.getElementById('tabLotteryMode');
        if (tabNormal && tabLottery) {
            if (this.isLotteryMode) {
                tabNormal.classList.remove('active');
                tabLottery.classList.add('active');
            } else {
                tabNormal.classList.add('active');
                tabLottery.classList.remove('active');
            }
        }

        // モードに応じた設定コントロールの制御
        const rowsInput = document.getElementById('seatingRows');
        const colsInput = document.getElementById('seatingCols');
        const seatingControls = document.querySelector('.seating-controls');
        const randomBtn = document.getElementById('randomSeatingBtn');
        const clearBtn = document.getElementById('clearSeatingBtn');

        if (this.isLotteryMode) {
            if (rowsInput) rowsInput.disabled = true;
            if (colsInput) colsInput.disabled = true;
            if (randomBtn) randomBtn.disabled = true;
            if (clearBtn) clearBtn.disabled = true;
            if (seatingControls) seatingControls.classList.add('lottery-active'); // CSSで調整可能に
        } else {
            if (rowsInput) rowsInput.disabled = false;
            if (colsInput) colsInput.disabled = false;
            if (randomBtn) randomBtn.disabled = false;
            if (clearBtn) clearBtn.disabled = false;
            if (seatingControls) seatingControls.classList.remove('lottery-active');
        }

        // 座席表を描画
        if (this.isLotteryMode) {
            this.renderLotteryGrid();
            // 旧コントロールパネル（HTMLに残っていれば）を非表示
            const oldControls = document.getElementById('lotteryControls');
            if (oldControls) oldControls.style.display = 'none';

            // 新しいコントロールパネルを描画
            this.renderLotteryControls();
        } else {
            this.renderSeatingGrid();
            // 旧コントロールパネルを非表示
            const oldControls = document.getElementById('lotteryControls');
            if (oldControls) oldControls.style.display = 'none';

            // 新しいコントロールパネルがあれば削除
            const newControls = document.getElementById('lotteryControlsPanel');
            if (newControls) newControls.remove();
        }

        // 未配置生徒リストを描画
        this.renderUnassignedStudents();

        // 設定値を反映
        if (rowsInput) rowsInput.value = this.rows;
        if (colsInput) colsInput.value = this.cols;
    },

    // 空のレイアウトを作成
    createEmptyLayout() {
        const layout = [];
        for (let r = 0; r < this.rows; r++) {
            const row = [];
            for (let c = 0; c < this.cols; c++) {
                row.push(null);
            }
            layout.push(row);
        }
        return layout;
    },

    // 座席表グリッドを描画
    renderSeatingGrid() {
        const container = document.getElementById('seatingGrid');
        if (!container) return;

        const data = StorageManager.getCurrentData();

        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const seat = document.createElement('div');
                seat.className = 'seat';
                seat.dataset.row = r;
                seat.dataset.col = c;

                const studentId = this.currentLayout[r] && this.currentLayout[r][c];
                const lockedSeats = data.seating.lockedSeats || [];
                const isLocked = lockedSeats.some(s => s.row === r && s.col === c);

                if (isLocked) seat.classList.add('locked');

                // ロックボタン（鍵アイコン）
                const lockBtn = document.createElement('button');
                lockBtn.className = `seat-lock-btn ${isLocked ? 'active' : ''}`;
                lockBtn.innerHTML = isLocked ? '🔒' : '🔓';
                lockBtn.title = isLocked ? 'ロック解除' : 'ロックする';
                lockBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.toggleLock(r, c);
                };
                seat.appendChild(lockBtn);

                if (studentId) {
                    const student = data.students.find(s => s.id === studentId);
                    if (student) {
                        seat.classList.add('occupied');

                        // 生徒情報をDOM要素として作成
                        const studentDiv = document.createElement('div');
                        studentDiv.className = 'seat-student';
                        studentDiv.draggable = !isLocked;
                        studentDiv.dataset.studentId = studentId;

                        const numberDiv = document.createElement('div');
                        numberDiv.className = 'seat-number';
                        numberDiv.textContent = student.number;

                        const nameDiv = document.createElement('div');
                        nameDiv.className = 'seat-name';
                        nameDiv.textContent = student.nameKanji;

                        studentDiv.appendChild(numberDiv);
                        studentDiv.appendChild(nameDiv);
                        seat.appendChild(studentDiv);

                        // ドラッグイベント (ロックされていない場合のみ)
                        if (!isLocked) {
                            studentDiv.addEventListener('dragstart', (e) => {
                                this.onDragStart(e, studentId, r, c);
                            });
                        }
                    }
                } else {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'seat-empty';
                    emptyDiv.innerText = '空席';
                    seat.appendChild(emptyDiv);
                }

                // ドロップイベント (ロックされていない場合のみ)
                if (!isLocked) {
                    seat.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        seat.classList.add('drag-over');
                    });

                    seat.addEventListener('dragleave', () => {
                        seat.classList.remove('drag-over');
                    });

                    seat.addEventListener('drop', (e) => {
                        e.preventDefault();
                        seat.classList.remove('drag-over');
                        this.onDrop(e, r, c);
                    });
                }

                container.appendChild(seat);
            }
        }

        // 教卓を表示
        this.renderTeacherDesk();
    }
    ,

    // 教卓をレンダリング
    renderTeacherDesk() {
        const container = document.getElementById('seatingGrid');
        if (!container) return;

        // 既存の教卓があれば削除
        const oldDesk = document.getElementById('teacherDesk');
        if (oldDesk) oldDesk.remove();

        const desk = document.createElement('div');
        desk.id = 'teacherDesk';
        desk.className = 'teacher-desk';
        desk.innerText = '教卓';

        // グリッドのスタイルを取得して教卓の位置を調整
        // 教卓はグリッドの下に配置するため、親要素に追加するか、グリッド内の特別な行として扱う
        // ここではグリッドの下に配置するために親要素の末尾に追加
        container.parentNode.appendChild(desk);
    },

    // ロックの切り替え
    toggleLock(row, col) {
        const data = StorageManager.getCurrentData();
        if (!data.seating.lockedSeats) data.seating.lockedSeats = [];

        const index = data.seating.lockedSeats.findIndex(s => s.row === row && s.col === col);
        if (index > -1) {
            data.seating.lockedSeats.splice(index, 1);
        } else {
            data.seating.lockedSeats.push({ row, col });
        }

        StorageManager.updateCurrentData(data);
        this.render();
    },

    // 未配置生徒リストを描画
    renderUnassignedStudents() {
        const container = document.getElementById('unassignedStudents');
        if (!container) return;

        const data = StorageManager.getCurrentData();

        // 配置済みの生徒IDを収集
        const assignedIds = new Set();
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const studentId = this.currentLayout[r] && this.currentLayout[r][c];
                if (studentId) {
                    assignedIds.add(studentId);
                }
            }
        }

        // 未配置の生徒を抽出
        const unassigned = data.students.filter(s => !assignedIds.has(s.id));

        if (unassigned.length === 0) {
            container.innerHTML = '<div class="empty-state-small"><p>全員配置済み</p></div>';
            return;
        }

        container.innerHTML = unassigned.map(student => `
            <div class="unassigned-student" draggable="true" data-student-id="${student.id}">
                <div class="student-number">${student.number}</div>
                <div class="student-name">
                    <div class="name-kanji">${student.nameKanji}</div>
                    <div class="name-kana">${student.nameKana}</div>
                </div>
            </div>
        `).join('');

        // ドラッグイベント
        container.querySelectorAll('.unassigned-student').forEach(el => {
            el.addEventListener('dragstart', (e) => {
                const studentId = el.dataset.studentId;
                this.onDragStart(e, studentId, null, null);
            });
        });
    },

    // ドラッグ開始
    onDragStart(e, studentId, row, col) {
        this.draggedStudent = {
            id: studentId,
            fromRow: row,
            fromCol: col
        };
        e.dataTransfer.effectAllowed = 'move';
        e.target.style.opacity = '0.5';
    },

    // ドロップ
    onDrop(e, toRow, toCol) {
        if (!this.draggedStudent) return;

        const { id, fromRow, fromCol } = this.draggedStudent;

        // 元の位置から削除（座席からの移動の場合）
        if (fromRow !== null && fromCol !== null) {
            this.currentLayout[fromRow][fromCol] = null;
        }

        // 新しい位置に配置（既存の生徒がいれば入れ替え）
        const existingStudent = this.currentLayout[toRow][toCol];
        this.currentLayout[toRow][toCol] = id;

        // 入れ替えの場合、元の位置に移動
        if (existingStudent && fromRow !== null && fromCol !== null) {
            this.currentLayout[fromRow][fromCol] = existingStudent;
        }

        // データを保存
        this.saveCurrentLayout();

        // 再描画
        this.render();

        this.draggedStudent = null;
    },

    // 未配置リストへドロップ（座席からの配置解除）
    onDropToUnassigned(e) {
        if (!this.draggedStudent) return;

        const { fromRow, fromCol } = this.draggedStudent;

        // 座席からの移動のみ処理
        if (fromRow !== null && fromCol !== null) {
            this.currentLayout[fromRow][fromCol] = null;
            this.saveCurrentLayout();
            this.render();
        }

        this.draggedStudent = null;
    },

    // ランダム配置
    randomArrange() {
        if (!confirm('ロックされていない座席をランダムに入れ替えますか？')) {
            return;
        }

        const data = StorageManager.getCurrentData();
        const lockedSeats = data.seating.lockedSeats || [];

        // ロックされていない座席の位置と、そこにいる生徒（または空席）を収集
        const availablePositions = [];
        const studentsToShuffle = [];

        // すべての生徒を取得
        const allStudents = [...data.students];
        const lockedStudentIds = new Set();

        // ロックされている座席の生徒を特定
        lockedSeats.forEach(ls => {
            const sid = this.currentLayout[ls.row] && this.currentLayout[ls.row][ls.col];
            if (sid) lockedStudentIds.add(sid);
        });

        // シャッフル対象の生徒（ロックされていない生徒）
        const unassignedStudentsWithIds = allStudents.filter(s => !lockedStudentIds.has(s.id));

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const isLocked = lockedSeats.some(ls => ls.row === r && ls.col === c);
                if (!isLocked) {
                    availablePositions.push({ r, c });
                }
            }
        }

        // 生徒をシャッフル
        for (let i = unassignedStudentsWithIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [unassignedStudentsWithIds[i], unassignedStudentsWithIds[j]] = [unassignedStudentsWithIds[j], unassignedStudentsWithIds[i]];
        }

        // 新しいレイアウトに反映（非ロック箇所のみ更新）
        let studentIndex = 0;
        availablePositions.forEach(pos => {
            if (studentIndex < unassignedStudentsWithIds.length) {
                this.currentLayout[pos.r][pos.c] = unassignedStudentsWithIds[studentIndex].id;
                studentIndex++;
            } else {
                this.currentLayout[pos.r][pos.c] = null; // 生徒が足りない場合は空席
            }
        });

        this.saveCurrentLayout();
        this.render();
    },

    // 番号順に並べる（右前から後ろへ）
    arrangeByNumber() {
        if (!confirm('番号順に並べ替えますか？\\n（教卓側（下）を前として、右前から配置されます）')) {
            return;
        }

        const data = StorageManager.getCurrentData();
        const lockedSeats = data.seating.lockedSeats || [];

        // ロックされている座席の生徒を特定
        const lockedStudentIds = new Set();
        lockedSeats.forEach(ls => {
            const sid = this.currentLayout[ls.row] && this.currentLayout[ls.row][ls.col];
            if (sid) lockedStudentIds.add(sid);
        });

        // ロックされていない生徒を番号順にソート
        const studentsToArrange = data.students
            .filter(s => !lockedStudentIds.has(s.id))
            .sort((a, b) => a.number.localeCompare(b.number, 'ja', { numeric: true }));

        // ロックされていない座席を教卓側（下）を前として右前から順に収集
        // 列順（右から左）、各列内で行順（下から上＝教卓側が前）
        const availablePositions = [];
        for (let c = this.cols - 1; c >= 0; c--) { // 右から左
            for (let r = this.rows - 1; r >= 0; r--) { // 下から上（教卓側が前）
                const isLocked = lockedSeats.some(ls => ls.row === r && ls.col === c);
                if (!isLocked) {
                    availablePositions.push({ r, c });
                }
            }
        }

        // 番号順に配置
        let studentIndex = 0;
        availablePositions.forEach(pos => {
            if (studentIndex < studentsToArrange.length) {
                this.currentLayout[pos.r][pos.c] = studentsToArrange[studentIndex].id;
                studentIndex++;
            } else {
                this.currentLayout[pos.r][pos.c] = null;
            }
        });

        this.saveCurrentLayout();
        this.render();
    },

    // 座席をクリア
    clearSeating() {
        if (!confirm('すべての座席をクリアしますか？')) {
            return;
        }

        this.currentLayout = this.createEmptyLayout();
        this.saveCurrentLayout();
        this.render();
    },

    // 現在のレイアウトを保存
    saveCurrentLayout() {
        const data = StorageManager.getCurrentData();
        data.seating.current = this.currentLayout;
        data.seating.rows = this.rows;
        data.seating.cols = this.cols;
        StorageManager.updateCurrentData(data);
    },

    // 履歴に保存
    saveToHistory() {
        const name = prompt('この配置に名前を付けてください（例: 2学期席替え）');
        if (!name) return;

        const data = StorageManager.getCurrentData();

        if (!data.seating.history) {
            data.seating.history = [];
        }

        data.seating.history.unshift({
            name: name,
            timestamp: new Date().toISOString(),
            layout: JSON.parse(JSON.stringify(this.currentLayout)),
            rows: this.rows,
            cols: this.cols
        });

        // 最大10件まで保持
        data.seating.history = data.seating.history.slice(0, 10);

        StorageManager.updateCurrentData(data);
        alert('履歴に保存しました');
    },

    // 履歴を表示
    showHistory() {
        const data = StorageManager.getCurrentData();
        const history = data.seating.history || [];

        if (history.length === 0) {
            alert('履歴がありません');
            return;
        }

        const modal = document.getElementById('seatingHistoryModal');
        const container = document.getElementById('seatingHistoryList');

        container.innerHTML = history.map((item, index) => `
            <div class="history-item">
                <div class="history-info">
                    <div class="history-name">${item.name}</div>
                    <div class="history-time">${new Date(item.timestamp).toLocaleString('ja-JP')}</div>
                    <div class="history-size">${item.rows}行 × ${item.cols}列</div>
                </div>
                <div class="history-actions">
                    <button class="btn btn-primary" onclick="SeatingModule.loadFromHistory(${index})">読み込み</button>
                    <button class="btn-icon delete" onclick="SeatingModule.deleteFromHistory(${index})">🗑️</button>
                </div>
            </div>
        `).join('');

        modal.classList.add('active');
    },

    // 履歴から読み込み
    loadFromHistory(index) {
        const data = StorageManager.getCurrentData();
        const history = data.seating.history || [];

        if (index >= history.length) return;

        const item = history[index];

        if (confirm(`「${item.name}」の配置を読み込みますか？\n現在の配置は上書きされます。`)) {
            this.currentLayout = JSON.parse(JSON.stringify(item.layout));
            this.rows = item.rows;
            this.cols = item.cols;
            this.saveCurrentLayout();
            this.closeHistoryModal();
            this.render();
        }
    },

    // 履歴から削除
    deleteFromHistory(index) {
        const data = StorageManager.getCurrentData();
        const history = data.seating.history || [];

        if (index >= history.length) return;

        if (confirm('この履歴を削除しますか？')) {
            history.splice(index, 1);
            data.seating.history = history;
            StorageManager.updateCurrentData(data);
            this.showHistory(); // 再表示
        }
    },

    // 履歴モーダルを閉じる
    closeHistoryModal() {
        const modal = document.getElementById('seatingHistoryModal');
        modal.classList.remove('active');
    },

    // 印刷
    printSeating() {
        const data = StorageManager.getCurrentData();

        // 印刷用HTMLを生成
        let html = `
            <!DOCTYPE html>
            <html lang="ja">
            <head>
                <meta charset="UTF-8">
                <title>座席表</title>
                <style>
                    @page {
                        size: A4 landscape;
                        margin: 10mm;
                    }
                    body { 
                        font-family: "Meiryo", "Hiragino Kaku Gothic ProN", "MS PGothic", sans-serif; 
                        margin: 0;
                        padding: 0;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    h1 { margin: 10px 0; font-size: 24px; }
                    .date { margin-bottom: 20px; font-size: 14px; color: #666; }
                    .seating-grid {
                        display: grid;
                        grid-template-columns: repeat(${this.cols}, 1fr);
                        gap: 8px;
                        width: 100%;
                        max-width: 270mm;
                        zoom: 0.9; /* 90%サイズで印刷 */
                    }
                    .seat {
                        border: 2px solid #333;
                        padding: 5px;
                        text-align: center;
                        aspect-ratio: 4 / 3;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        position: relative;
                        background: #fff;
                    }
                    .seat-number { font-size: 11px; color: #555; margin-bottom: 2px; position: absolute; top: 4px; left: 6px; }
                    .seat-kana { font-size: 10px; color: #444; margin-bottom: 0px; margin-top: 12px; }
                    .seat-name { font-weight: bold; font-size: 16px; margin-top: 2px; }
                    .seat-empty { color: #ccc; font-size: 14px; }
                    .teacher-desk {
                        margin-top: 30px;
                        width: 150px;
                        height: 50px;
                        border: 2px solid #333;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        background: #f0f0f0;
                        font-family: "Meiryo", sans-serif;
                    }
                    @media print {
                        body { -webkit-print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <h1>座席表</h1>
                <div class="date">${new Date().toLocaleDateString('ja-JP')}</div>
                <div class="seating-grid">
        `;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const studentId = this.currentLayout[r] && this.currentLayout[r][c];

                if (studentId) {
                    const student = data.students.find(s => s.id === studentId);
                    if (student) {
                        html += `
                            <div class="seat">
                                <div class="seat-number">${student.number}</div>
                                <div class="seat-kana">${student.nameKana || ''}</div>
                                <div class="seat-name">${student.nameKanji}</div>
                            </div>
                        `;
                    } else {
                        html += '<div class="seat"><div class="seat-empty">空席</div></div>';
                    }
                } else {
                    html += '<div class="seat"><div class="seat-empty">空席</div></div>';
                }
            }
        }

        html += `
                </div>
                <div class="teacher-desk">教卓</div>
            </body>
            </html>
        `;

        // 新しいウィンドウで開いて印刷
        const printWindow = window.open('', '', 'width=1100,height=800');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        // 少し待機してから印刷（レンダリング時間を確保）
        setTimeout(() => {
            printWindow.print();
        }, 500);
    },

    // くじ引き設定・操作パネル描画
    renderLotteryControls() {
        // くじ引きモード用コントロールエリア
        let controls = document.getElementById('lotteryControlsPanel');
        if (!controls) {
            const parent = document.getElementById('seatingGrid')?.parentNode;
            if (parent) {
                controls = document.createElement('div');
                controls.id = 'lotteryControlsPanel';
                controls.className = 'lottery-settings-panel';
                controls.style.marginBottom = '20px';
                controls.style.padding = '15px';
                controls.style.background = '#f7fafc';
                controls.style.border = '1px solid #e2e8f0';
                controls.style.borderRadius = '8px';
                parent.insertBefore(controls, document.getElementById('seatingGrid'));
            }
        }

        if (!controls) return;

        const settings = this.lotterySettings;
        const isCards = settings.type === 'cards';

        let settingsHtml = '';

        if (isCards) {
            settingsHtml = `
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    ${this.suits.map(suit => `
                        <div style="display: flex; align-items: center; gap: 5px; border: 1px solid #ddd; padding: 4px 8px; border-radius: 4px; background: white;">
                            <span class="${suit.color}" style="font-size: 1.2em; font-weight:bold;">${suit.symbol}</span>
                            <button class="btn-icon" data-action="dec" data-suit="${suit.id}" style="width:24px; height:24px; border-radius:50%; border:1px solid #ccc; background:#f0f0f0; cursor:pointer;">-</button>
                            <input type="number" class="lottery-card-count" data-suit="${suit.id}" 
                                   value="${settings.cardCounts[suit.id]}" min="0" max="13" 
                                   style="width: 40px; padding: 4px; text-align: center; border:none; font-weight:bold; font-size:1.1em;" readonly>
                            <button class="btn-icon" data-action="inc" data-suit="${suit.id}" style="width:24px; height:24px; border-radius:50%; border:1px solid #ccc; background:#f0f0f0; cursor:pointer;">+</button>
                            <span style="font-size: 0.8em;">枚</span>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            settingsHtml = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <label>範囲:</label>
                    <input type="number" id="lotteryNumStart" value="${settings.numberRange.start}" min="1" style="width: 60px; padding: 5px;">
                    <span>〜</span>
                    <input type="number" id="lotteryNumEnd" value="${settings.numberRange.end}" min="1" style="width: 60px; padding: 5px;">
                    <span style="font-size: 0.9em; color: #666;">(計 ${settings.numberRange.end - settings.numberRange.start + 1} 枚)</span>
                </div>
            `;
        }

        controls.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                <!-- モード選択 -->
                <div style="display: flex; gap: 20px; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                    <label style="font-weight: bold;">くじタイプ:</label>
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;">
                        <input type="radio" name="lotteryType" value="cards" ${isCards ? 'checked' : ''}>
                        <span>トランプ (♠♣♥♦)</span>
                    </label>
                    <label style="cursor: pointer; display: flex; align-items: center; gap: 5px;">
                        <input type="radio" name="lotteryType" value="numbers" ${!isCards ? 'checked' : ''}>
                        <span>番号くじ (1, 2, 3...)</span>
                    </label>
                </div>

                <!-- 詳細設定 -->
                <div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: center; justify-content: space-between;">
                    <div>${settingsHtml}</div>
                    
                    <div style="display: flex; gap: 10px;">
                        <button id="lotteryReshuffleBtn" class="btn btn-warning">設定を適用して再配置</button>
                        <button id="lotteryInputBtn" class="btn btn-primary">結果入力</button>
                        <button id="lotteryPrintBtn" class="btn btn-secondary">印刷</button>
                    </div>
                </div>
                
                <div style="font-size: 0.85em; color: #666;">
                    ※「再配置」を押すと、ロック（🔒）されていない座席がリセットされます。<br>
                    ※ 現在の座席数: ${this.rows * this.cols}席 ／ くじ枚数: ${this._calculateTotalLotteryCount()}枚
                </div>
            </div>
        `;

        // イベント設定

        // モード切替
        controls.querySelectorAll('input[name="lotteryType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateLotterySettings({ type: e.target.value });
                this.renderLotteryControls(); // UI更新のみ（再配置はボタン押下時）
            });
        });

        // カード枚数変更 (+/-ボタン)
        if (isCards) {
            controls.querySelectorAll('button[data-action]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const action = e.target.dataset.action;
                    const suitId = e.target.dataset.suit;
                    const currentCounts = { ...this.lotterySettings.cardCounts };
                    let val = currentCounts[suitId] || 0;

                    if (action === 'inc') {
                        if (val < 13) val++;
                    } else {
                        if (val > 0) val--;
                    }
                    currentCounts[suitId] = val;
                    this.updateLotterySettings({ cardCounts: currentCounts });
                    this.renderLotteryControls();
                });
            });
        }

        // 番号範囲変更
        const startInput = controls.querySelector('#lotteryNumStart');
        const endInput = controls.querySelector('#lotteryNumEnd');
        if (startInput && endInput) {
            const updateRange = () => {
                const s = parseInt(startInput.value) || 1;
                const e = parseInt(endInput.value) || 1;
                this.updateLotterySettings({ numberRange: { start: s, end: e } });
                this.renderLotteryControls();
            };
            startInput.addEventListener('change', updateRange);
            endInput.addEventListener('change', updateRange);
        }

        // ボタン類
        controls.querySelector('#lotteryReshuffleBtn').addEventListener('click', () => {
            if (confirm('現在の座席配置は保持されず、くじが再配置されます。ロックされた座席は変更されません。よろしいですか？')) {
                this.setupLottery();
            }
        });

        controls.querySelector('#lotteryInputBtn').addEventListener('click', () => {
            this.openLotteryInputModal();
        });

        controls.querySelector('#lotteryPrintBtn').addEventListener('click', () => {
            this.printSeating();
        });
    },

    _calculateTotalLotteryCount() {
        if (this.lotterySettings.type === 'numbers') {
            return this.lotterySettings.numberRange.end - this.lotterySettings.numberRange.start + 1;
        } else {
            return Object.values(this.lotterySettings.cardCounts).reduce((a, b) => a + b, 0);
        }
    },

    // モード切替
    switchMode(mode) {
        this.isLotteryMode = (mode === 'lottery');

        // 保存
        const data = StorageManager.getCurrentData();
        if (!data.seating) data.seating = {};

        // モード状態を保存しておくと、リロード時に復帰できるが、
        // 現状はアプリ仕様としてデフォルトは通常モードかもしれない。
        // ここでは都度切り替えを前提とする。

        this.render();
    },

    // 旧メソッド互換用（削除予定だが安全のためラップ）
    toggleLotteryMode() {
        this.switchMode(this.isLotteryMode ? 'normal' : 'lottery');
    },

    // 保存・履歴モーダルを開く
    openSaveHistoryModal() {
        const data = StorageManager.getCurrentData();
        const history = data.seating.history || [];

        let modal = document.getElementById('seatingHistoryModal');
        if (!modal) {
            // モーダルがなければ作成
            modal = document.createElement('div');
            modal.id = 'seatingHistoryModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>席配置の保存・読取</h3>
                        <button class="modal-close">✕</button>
                    </div>
                    <div class="modal-body" id="seatingHistoryModalBody"></div>
                </div>
            `;
            document.body.appendChild(modal);

            // 閉じるボタン
            modal.querySelector('.modal-close').addEventListener('click', () => {
                modal.classList.remove('active');
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        }

        const body = modal.querySelector('#seatingHistoryModalBody');

        // HTML生成
        let html = `
            <div style="background: #f0fff4; padding: 15px; border-radius: 8px; border: 1px solid #c6f6d5; margin-bottom: 20px;">
                <h4 style="margin-top:0; color: #2f855a;">現在の配置を保存</h4>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="newSaveTitle" class="form-control" placeholder="保存名（例: 1学期中間後）" style="flex:1;">
                    <button class="btn btn-success" id="execSaveBtn">保存</button>
                </div>
            </div>

            <h4 style="border-bottom: 2px solid #eee; padding-bottom: 5px;">保存済み履歴</h4>
            <div class="history-list" style="max-height: 400px; overflow-y: auto;">
        `;

        if (history.length === 0) {
            html += `<p style="color:#666; padding: 20px; text-align:center;">履歴はありません</p>`;
        } else {
            // 新しい順
            history.slice().reverse().forEach((item, index) => {
                const originalIndex = history.length - 1 - index;
                html += `
                    <div class="history-item">
                        <div class="history-info">
                            <div class="history-date">${item.date}</div>
                            <div class="history-title">${item.title || '(無題)'}</div>
                        </div>
                        <div class="history-actions">
                            <button class="btn btn-sm btn-primary load-history-btn" data-index="${originalIndex}">復元</button>
                            <button class="btn btn-sm btn-danger delete-history-btn" data-index="${originalIndex}">削除</button>
                        </div>
                    </div>
                `;
            });
        }
        html += `</div>`;

        body.innerHTML = html;

        // イベント設定: 保存
        const execSaveBtn = body.querySelector('#execSaveBtn');
        if (execSaveBtn) {
            execSaveBtn.addEventListener('click', () => {
                const titleInput = body.querySelector('#newSaveTitle');
                const title = titleInput.value.trim() || '無題';
                this.saveToHistory(title);
                modal.classList.remove('active');
                alert('保存しました');
            });
        }

        // イベント設定: 復元・削除
        body.querySelectorAll('.load-history-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (confirm('この履歴を復元しますか？\n現在の配置は上書きされます。')) {
                    const idx = parseInt(e.target.dataset.index);
                    const target = history[idx];
                    if (target) {
                        data.seating.current = JSON.parse(JSON.stringify(target.layout));
                        if (target.lotterySettings) this.lotterySettings = target.lotterySettings;

                        StorageManager.updateCurrentData(data);
                        this.currentLayout = data.seating.current;
                        this.render();
                        modal.classList.remove('active');
                    }
                }
            });
        });

        body.querySelectorAll('.delete-history-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (confirm('この履歴を削除しますか？')) {
                    const idx = parseInt(e.target.dataset.index);
                    history.splice(idx, 1);
                    data.seating.history = history;
                    StorageManager.updateCurrentData(data);
                    this.openSaveHistoryModal(); // 再描画
                }
            });
        });

        modal.classList.add('active');
    },

    // 既存の saveToHistory を改修
    saveToHistory(titleParam) {
        const data = StorageManager.getCurrentData();
        const history = data.seating.history || [];

        let title = titleParam;

        if (titleParam === undefined) {
            title = prompt('保存するタイトルを入力してください:',
                new Date().toLocaleDateString('ja-JP') + 'の座席');
            if (title === null) return;
        }

        const newEntry = {
            date: new Date().toLocaleString('ja-JP'),
            title: title || '無題',
            layout: JSON.parse(JSON.stringify(this.currentLayout)),
            lotterySettings: JSON.parse(JSON.stringify(this.lotterySettings))
        };

        history.push(newEntry);
        data.seating.history = history;
        StorageManager.updateCurrentData(data);
    },

    // カードシャッフル・配置
    shuffleCards() {
        if (this.currentLayout.flat().some(id => id) && !confirm('現在の座席配置は保持されず、カードが再配置されます。よろしいですか？')) {
            return;
        }

        const data = StorageManager.getCurrentData();
        const lockedSeats = data.seating.lockedSeats || [];

        const availablePositions = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const isLocked = lockedSeats.some(ls => ls.row === r && ls.col === c);
                if (!isLocked) {
                    availablePositions.push({ r, c });
                }
            }
        }

        if (availablePositions.length === 0) {
            alert('配置可能な座席がありません');
            return;
        }

        const deck = [];
        this.suits.forEach(suit => {
            for (let i = 1; i <= 10; i++) {
                deck.push({ suit: suit.id, number: i });
            }
        });

        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        const cardAssignments = {};

        availablePositions.forEach((pos, index) => {
            if (index < deck.length) {
                cardAssignments[`${pos.r}-${pos.c}`] = deck[index];
            }
        });

        data.seating.cards = cardAssignments;
        StorageManager.updateCurrentData(data);

        this.render();
    },

    // くじ引きグリッド描画（カードD&D対応）
    renderLotteryGrid() {
        const container = document.getElementById('seatingGrid');
        if (!container) return;

        const data = StorageManager.getCurrentData();
        const cards = data.seating.cards || {};
        const lockedSeats = data.seating.lockedSeats || [];
        const lockedCards = data.seating.lockedCards || []; // カードロック

        container.innerHTML = '';
        container.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const seat = document.createElement('div');
                seat.className = 'seat';
                seat.dataset.row = r;
                seat.dataset.col = c;

                const isLocked = lockedSeats.some(s => s.row === r && s.col === c);
                const isCardLocked = lockedCards.some(lc => lc.row === r && lc.col === c);
                if (isLocked) seat.classList.add('locked');
                if (isCardLocked) seat.classList.add('card-locked');

                // くじ引きモードでは座席ロックボタンは非表示（ノーマルモードで設定済み）

                const item = cards[`${r}-${c}`]; // item = card or ticket

                if (item) {
                    const cardDiv = document.createElement('div');
                    cardDiv.className = 'seat-card';
                    cardDiv.draggable = !isCardLocked;

                    // カードか番号くじかで表示を分岐
                    if (item.type === 'number') {
                        // 番号くじ
                        cardDiv.classList.add('ticket-style');
                        cardDiv.innerHTML = `
                            <div class="ticket-label">Ticket</div>
                            <div class="ticket-number">${item.value}</div>
                        `;
                    } else {
                        // トランプ（後方互換でtypeがない場合もトランプ扱い）
                        const suitInfo = this.suits.find(s => s.id === item.suit);
                        if (suitInfo) {
                            cardDiv.innerHTML = `
                                <div class="card-suit ${suitInfo.color}">${suitInfo.symbol}</div>
                                <div class="card-number ${suitInfo.color}">${item.number}</div>
                            `;
                        } else {
                            cardDiv.innerHTML = '<div>?</div>';
                        }
                    }

                    // カードロックボタン（鍵アイコンに統一）
                    const cardLockBtn = document.createElement('button');
                    cardLockBtn.className = `card-lock-btn ${isCardLocked ? 'active' : ''}`;
                    cardLockBtn.innerHTML = isCardLocked ? '🔒' : '🔓';
                    cardLockBtn.title = isCardLocked ? 'ロック解除' : 'ロック';
                    cardLockBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.toggleCardLock(r, c);
                    };
                    cardDiv.appendChild(cardLockBtn);

                    // カードドラッグイベント
                    if (!isCardLocked) {
                        cardDiv.addEventListener('dragstart', (e) => {
                            this.draggedCard = { row: r, col: c, item: item };
                            e.dataTransfer.effectAllowed = 'move';
                            seat.classList.add('dragging');
                        });
                        cardDiv.addEventListener('dragend', () => {
                            seat.classList.remove('dragging');
                            this.draggedCard = null;
                        });
                    }

                    seat.appendChild(cardDiv);
                } else {
                    // 空席の場合もロックボタンを表示
                    const emptyDiv = document.createElement('div');
                    emptyDiv.className = 'seat-empty-card';

                    if (isLocked) {
                        const studentId = this.currentLayout[r] && this.currentLayout[r][c];
                        if (studentId) {
                            const student = data.students.find(s => s.id === studentId);
                            emptyDiv.innerHTML = `<div>${student ? student.nameKanji : '空席'}</div><div style="font-size:0.7em">(固定)</div>`;
                        } else {
                            emptyDiv.innerHTML = '<div>空席</div>';
                        }
                    } else {
                        emptyDiv.innerHTML = '<div class="seat-empty">空席</div>';
                    }

                    // 空席用のロックボタン
                    const emptyLockBtn = document.createElement('button');
                    emptyLockBtn.className = `card-lock-btn ${isCardLocked ? 'active' : ''}`;
                    emptyLockBtn.innerHTML = isCardLocked ? '🔒' : '🔓';
                    emptyLockBtn.title = isCardLocked ? 'ロック解除' : 'ロック';
                    emptyLockBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.toggleCardLock(r, c);
                    };
                    emptyDiv.appendChild(emptyLockBtn);

                    seat.appendChild(emptyDiv);
                }

                // カードドロップイベント
                seat.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (this.draggedCard && !isCardLocked) {
                        seat.classList.add('drag-over');
                    }
                });
                seat.addEventListener('dragleave', () => {
                    seat.classList.remove('drag-over');
                });
                seat.addEventListener('drop', (e) => {
                    e.preventDefault();
                    seat.classList.remove('drag-over');
                    if (this.draggedCard && !isCardLocked) {
                        this.swapCards(this.draggedCard.row, this.draggedCard.col, r, c);
                    }
                });

                container.appendChild(seat);
            }
        }

        this.renderTeacherDesk();
    },

    // カードロックの切り替え
    toggleCardLock(row, col) {
        const data = StorageManager.getCurrentData();
        if (!data.seating.lockedCards) data.seating.lockedCards = [];

        const index = data.seating.lockedCards.findIndex(lc => lc.row === row && lc.col === col);
        if (index > -1) {
            data.seating.lockedCards.splice(index, 1);
        } else {
            data.seating.lockedCards.push({ row, col });
        }

        StorageManager.updateCurrentData(data);
        this.render();
    },

    // カードの入れ替え
    swapCards(fromRow, fromCol, toRow, toCol) {
        const data = StorageManager.getCurrentData();
        const cards = data.seating.cards || {};

        const fromKey = `${fromRow}-${fromCol}`;
        const toKey = `${toRow}-${toCol}`;

        const fromItem = cards[fromKey];
        const toItem = cards[toKey];

        // 入れ替え
        if (fromItem) {
            cards[toKey] = fromItem;
        } else {
            delete cards[toKey];
        }

        if (toItem) {
            cards[fromKey] = toItem;
        } else {
            delete cards[fromKey];
        }

        data.seating.cards = cards;
        StorageManager.updateCurrentData(data);
        this.render();
    },

    // 結果入力モーダルを開く
    openLotteryInputModal() {
        const grid = document.getElementById('lotteryInputGrid');
        grid.innerHTML = '';

        // モーダル全体のスタイル調整（幅を広く）
        const modalContent = grid.closest('.modal-content');
        if (modalContent) {
            modalContent.style.maxWidth = '1100px';
            modalContent.style.width = '90vw';
        }

        const isCards = this.lotterySettings.type === 'cards';

        if (isCards) {
            // -- トランプモードレイアウト --
            grid.style.display = 'flex';
            grid.style.flexWrap = 'nowrap';
            grid.style.gap = '15px';
            grid.style.justifyContent = 'space-between';

            // 一時保存用データを初期化
            this.tempLotteryInput = {};

            // Suitごとにカラム作成
            this.suits.forEach(suit => {
                const count = this.lotterySettings.cardCounts[suit.id] || 0;
                if (count === 0) return; // 0枚なら表示しない

                const col = document.createElement('div');
                col.style.flex = '1';
                col.style.border = '1px solid #ccc';
                col.style.background = '#f9f9f9';

                const header = document.createElement('div');
                header.innerHTML = `${suit.symbol} ${suit.label}`;
                header.className = suit.color;
                header.style.textAlign = 'center';
                header.style.fontWeight = 'bold';
                header.style.padding = '8px';
                header.style.borderBottom = '1px solid #ccc';
                header.style.background = '#eaeaea';
                col.appendChild(header);

                for (let i = 1; i <= count; i++) {
                    const row = this._createInputRow({ type: 'card', suit: suit.id, number: i }, `${suit.symbol} ${i}`);
                    col.appendChild(row);
                }
                grid.appendChild(col);
            });

        } else {
            // -- 番号くじモードレイアウト --
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
            grid.style.gap = '10px';

            this.tempLotteryInput = {};

            const { start, end } = this.lotterySettings.numberRange;
            for (let i = start; i <= end; i++) {
                const row = this._createInputRow({ type: 'number', value: i }, `No. ${i}`);
                row.style.border = '1px solid #ddd';
                row.style.background = '#fff';
                row.style.borderRadius = '4px';
                grid.appendChild(row);
            }
        }

        document.getElementById('lotteryInputModal').classList.add('active');
        // 最初のデータがある入力欄にフォーカス
        setTimeout(() => grid.querySelector('input')?.focus(), 100);
    },

    // 入力行生成ヘルパー
    _createInputRow(itemKeyObj, labelText) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.padding = '4px 8px';
        if (this.lotterySettings.type === 'cards') {
            row.style.borderBottom = '1px solid #eee';
        }

        const label = document.createElement('div');
        label.textContent = labelText;
        label.style.width = '50px';
        label.style.fontWeight = 'bold';
        label.style.fontSize = '0.9em';
        row.appendChild(label);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'student-input';

        // データ識別キー生成
        const key = itemKeyObj.type === 'card'
            ? `card-${itemKeyObj.suit}-${itemKeyObj.number}`
            : `number-${itemKeyObj.value}`;

        input.dataset.key = key;
        input.placeholder = '番号';
        input.maxLength = 4;
        input.style.width = '60px'; // 番号のみ入力なので狭く
        input.style.padding = '4px';
        input.style.textAlign = 'center';

        // 既存の入力値があればセット（現在の配置から逆引き）
        const currentStudentId = this.findStudentIdByLotteryItem(itemKeyObj);
        if (currentStudentId) {
            const student = this.getStudentById(currentStudentId);
            if (student) input.value = student.number;
        }

        // 名前表示用エリア
        const nameDisplay = document.createElement('div');
        nameDisplay.className = 'name-display';
        nameDisplay.style.marginLeft = '8px';
        nameDisplay.style.fontSize = '0.85em';
        nameDisplay.style.color = '#666';
        nameDisplay.style.whiteSpace = 'nowrap';
        nameDisplay.style.overflow = 'hidden';
        nameDisplay.style.textOverflow = 'ellipsis';
        nameDisplay.style.maxWidth = '120px';

        if (currentStudentId) {
            const student = this.getStudentById(currentStudentId);
            if (student) nameDisplay.textContent = student.nameKanji;
        }

        // 入力イベント（自動反映）
        input.addEventListener('input', (e) => {
            this.updateLotterySeat(key, e.target.value, nameDisplay);
        });

        // Enterで次の入力へ移動
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // DOM順で次のinputを探す
                const inputs = Array.from(document.getElementById('lotteryInputGrid').querySelectorAll('input'));
                const idx = inputs.indexOf(e.target);
                if (idx >= 0 && idx < inputs.length - 1) {
                    inputs[idx + 1].focus();
                }
            }
        });

        row.appendChild(input);
        row.appendChild(nameDisplay);
        return row;
    },

    // くじアイテムから生徒IDを逆引き
    findStudentIdByLotteryItem(item) {
        const data = StorageManager.getCurrentData();
        const cards = data.seating.cards || {};

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const card = cards[`${r}-${c}`];
                if (!card) continue;

                if (item.type === 'card') {
                    if ((card.type === 'card' || !card.type) && card.suit === item.suit && card.number == item.number) {
                        return this.currentLayout[r][c];
                    }
                } else if (item.type === 'number') {
                    if (card.type === 'number' && card.value == item.value) {
                        return this.currentLayout[r][c];
                    }
                }
            }
        }
        return null;
    },

    getStudentById(studentId) {
        const data = StorageManager.getCurrentData();
        return data.students.find(s => s.id === studentId);
    },

    // 個別のくじ結果を一時保存
    updateLotterySeat(key, studentNumber, nameDisplay) {
        if (!studentNumber) {
            nameDisplay.textContent = '';
            this.tempLotteryInput[key] = null;
            return;
        }

        const data = StorageManager.getCurrentData();
        const student = data.students.find(s => s.number === studentNumber);

        if (student) {
            nameDisplay.textContent = student.nameKanji;
            nameDisplay.style.color = '#333';
            this.tempLotteryInput[key] = student.id;
        } else {
            nameDisplay.textContent = '該当なし';
            nameDisplay.style.color = 'red';
            delete this.tempLotteryInput[key];
        }
    },

    // 指定したキーの座席に生徒を配置（内部処理用）
    _assignStudentToKey(key, studentId) {
        const data = StorageManager.getCurrentData();
        const cards = data.seating.cards || {};

        // key形式: "card-suit-num" または "number-val"
        const parts = key.split('-');
        const type = parts[0];

        let targetPos = null;

        Object.entries(cards).forEach(([posKey, item]) => {
            if (type === 'card') {
                const suit = parts[1];
                const num = parseInt(parts[2]);
                // 型不一致を防ぐため == を使用
                if ((item.type === 'card' || !item.type) && item.suit === suit && item.number == num) {
                    targetPos = posKey;
                }
            } else { // number
                const val = parseInt(parts[1]);
                if (item.type === 'number' && item.value == val) {
                    targetPos = posKey;
                }
            }
        });

        if (targetPos) {
            const [r, c] = targetPos.split('-').map(Number);
            this.currentLayout[r][c] = studentId;
            // 個別saveはせず一括で行うためここでは操作のみ
        }
    },

    // 結果反映ボタン押下時の処理
    reflectLotteryResults() {
        if (Object.keys(this.tempLotteryInput || {}).length === 0) {
            alert('変更内容がありません');
            return;
        }

        if (!confirm('入力した内容を座席表に反映させますか？\n入力された生徒が対応する座席に配置されます。')) {
            return;
        }

        // 一時保存した内容を反映
        Object.entries(this.tempLotteryInput).forEach(([key, studentId]) => {
            // nullなら削除したい場合はここで処理するが、今回は「入力されたもの」を上書きする
            if (studentId) {
                this._assignStudentToKey(key, studentId);
            }
        });

        this.saveCurrentLayout();
        document.getElementById('lotteryInputModal').classList.remove('active');

        // 要望No.6: 通常モードに自動切り替え
        // toggleLotteryMode は isLotteryMode を反転させるので、現在 true なら呼べば false (通常) になる
        if (this.isLotteryMode) {
            this.toggleLotteryMode();
        } else {
            this.render();
        }

        alert('座席表に反映しました。\n通常モードに切り替えます。');
    },

    // 印刷 (くじ引き対応)
    printSeating() {
        const data = StorageManager.getCurrentData();
        const isLottery = this.isLotteryMode;
        const settings = this.lotterySettings;

        if (isLottery) {
            document.body.classList.add('print-lottery');
        } else {
            document.body.classList.remove('print-lottery');
        }

        let title = '座席表';
        if (isLottery) {
            title = settings.type === 'numbers' ? '席・番号くじ配置図' : '席・トランプ配置図';
        }

        let html = `
            <!DOCTYPE html>
            <html lang="ja">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    @page {
                        size: A4 ${isLottery ? 'portrait' : 'landscape'};
                        margin: 10mm;
                    }
                    body { 
                        font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif;
                        margin: 0;
                        padding: 0;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        width: 100%;
                        height: 100%;
                    }
                    h1 { margin: 0 0 5px 0; font-size: 18px; text-align: center; }
                    .date { margin-bottom: 10px; font-size: 12px; color: #666; text-align: right; width: 95%; }
                    
                    /* 座席グリッド */
                    .seating-grid {
                        display: grid;
                        grid-template-columns: repeat(${this.cols}, 1fr);
                        gap: ${isLottery ? '4px' : '5px'}; /* 少し詰め */
                        width: ${isLottery ? '90%' : '80%'}; /* 幅を80%に */
                        margin: 0 auto;
                        padding-bottom: ${isLottery ? '10px' : '0'};
                        margin-bottom: ${isLottery ? '10px' : '15px'};
                    }
                    
                    .seat {
                        border: 1px solid #333;
                        padding: ${isLottery ? '2px' : '4px'}; /* パディング調整 */
                        text-align: center;
                        aspect-ratio: ${isLottery ? '4 / 2.5' : '4 / 3'};
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        position: relative;
                        background: #fff;
                    }
                    
                    /* くじ引き */
                    .card-suit { font-size: 24px; line-height: 1; display: block; }
                    .card-number { font-size: 20px; font-weight: bold; margin-top: 2px; display: block; }

                    .ticket-label { font-size: 10px; color: #666; }
                    .ticket-number { font-size: 24px; font-weight: bold; }

                    .red { color: #e53e3e; }
                    .black { color: #1a202c; }
                    
                    /* 通常 */
                    .seat-number { font-size: 14px; color: #666; margin-bottom: 2px; }
                    .seat-name { font-weight: bold; font-size: 16px; font-family: Meiryo, sans-serif; } 
                    .seat-kana { font-size: 10px; color: #555; margin-bottom: 2px; }
                    
                    .teacher-desk {
                        margin: 10px auto;
                        width: 150px;
                        height: 30px;
                        border: 1px solid #333;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        background: #f0f0f0;
                        font-size: 14px;
                    }

                    /* くじ引き用下部レイアウト */
                    .lottery-instruction {
                        width: 90%;
                        border: 1px solid #e53e3e;
                        background-color: #fff5f5;
                        color: #c53030;
                        padding: 5px;
                        margin-bottom: 10px;
                        font-weight: bold;
                        font-size: 11px;
                        text-align: center;
                        box-sizing: border-box;
                    }
                    
                    /* トランプ用レイアウト */
                    .lottery-area-cards {
                        display: flex;
                        justify-content: space-between;
                        width: 90%;
                        gap: 8px; 
                        margin-top: 5px;
                    }
                    .suit-col {
                        flex: 1;
                        border: 1px solid #000;
                        display: flex;
                        flex-direction: column;
                    }
                    .suit-header {
                        text-align: center;
                        font-weight: bold;
                        border-bottom: 1px solid #000;
                        background: #f0f0f0;
                        padding: 4px;
                        font-size: 14px;
                    }
                    .row {
                        display: flex;
                        border-bottom: 1px solid #ccc;
                        flex: 1; /* 均等に高さ確保 */
                        min-height: 25px; /* 最低保証 */
                    }
                    .row:last-child { border-bottom: none; }
                    .num {
                        width: 25px;
                        border-right: 1px solid #ccc;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 12px;
                        background: #fafafa;
                    }
                    .field {
                        flex: 1;
                        position: relative;
                    }
                    .field::after {
                        content: "(番号・名前)";
                        position: absolute;
                        bottom: 1px;
                        right: 2px;
                        font-size: 7px;
                        color: #ddd;
                    }

                    /* 番号くじ用レイアウト */
                     .lottery-area-numbers {
                        width: 90%;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 10px;
                        justify-content: flex-start;
                    }
                    .number-entry {
                        width: 130px;
                        border-bottom: 1px solid #333;
                        padding: 5px;
                        display: flex;
                        align-items: flex-end;
                        font-size: 12px;
                    }
                    .number-entry .no-label {
                        font-weight: bold;
                        margin-right: 5px;
                        font-size: 14px;
                        width: 30px;
                        text-align: right;
                    }
                    .number-entry .write-space {
                        flex: 1;
                        text-align: center;
                        color: #ccc;
                        font-size: 10px;
                    }

                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <div class="date">作成日: ${new Date().toLocaleDateString('ja-JP')}</div>
                
                ${!isLottery ? `` : ''}

                <div class="seating-grid">
        `;

        const cards = data.seating.cards || {};
        const lockedSeats = data.seating.lockedSeats || [];

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const studentId = this.currentLayout[r] && this.currentLayout[r][c];
                let content = '';

                if (isLottery) {
                    const isLocked = lockedSeats.some(s => s.row === r && s.col === c);
                    if (isLocked && studentId) {
                        const student = data.students.find(s => s.id === studentId);
                        content = `
                            <div class="seat" style="background:#f7fafc;">
                                <div style="font-size:9px;">${student ? student.number : ''}</div>
                                <div style="font-size:11px; font-weight:bold;">${student ? student.nameKanji : '固定'}</div>
                            </div>
                        `;
                    } else {
                        const item = cards[`${r}-${c}`];
                        if (item) {
                            if (item.type === 'number') {
                                // 番号くじ
                                content = `
                                    <div class="seat">
                                        <div class="ticket-label">No.</div>
                                        <div class="ticket-number">${item.value}</div>
                                    </div>
                                `;
                            } else {
                                // トランプ
                                const suitInfo = this.suits.find(s => s.id === item.suit);
                                if (suitInfo) {
                                    content = `
                                        <div class="seat">
                                            <span class="card-suit ${suitInfo.color}">${suitInfo.symbol}</span>
                                            <span class="card-number ${suitInfo.color}">${item.number}</span>
                                        </div>
                                    `;
                                } else {
                                    content = `<div class="seat">?</div>`;
                                }
                            }
                        } else {
                            content = `<div class="seat"></div>`;
                        }
                    }
                } else {
                    if (studentId) {
                        const student = data.students.find(s => s.id === studentId);
                        if (student) {
                            content = `
                                <div class="seat">
                                    <div class="seat-number">${student.number}</div>
                                    <div class="seat-kana">${student.nameKana || ''}</div>
                                    <div class="seat-name">${student.nameKanji}</div>
                                </div>
                            `;
                        } else {
                            content = `<div class="seat"></div>`;
                        }
                    } else {
                        content = `<div class="seat"></div>`;
                    }
                }
                html += content;
            }
        }

        html += `</div>`;

        // 教卓（通常モードは下、くじ引きモードは下で共通化、またはくじ引きは上で維持？）
        // 今回の要望は「通常モードの教卓を下に」だが、統一して下にするのが自然。
        html += `<div class="teacher-desk" style="margin-bottom: 20px;">教卓</div>`;

        if (isLottery) {
            html += `
                <div class="lottery-instruction">【注意】引いたくじと同じマーク・番号のマスに、あなたの「4桁の生徒番号」と「名前」を記入してください。</div>
            `;

            if (settings.type === 'numbers') {
                // 番号くじ用リスト
                const { start, end } = settings.numberRange;
                html += `<div class="lottery-area-numbers">`;
                for (let i = start; i <= end; i++) {
                    html += `
                        <div class="number-entry">
                            <span class="no-label">${i}</span>
                            <span class="write-space">(名前)</span>
                        </div>
                    `;
                }
                html += `</div>`;

            } else {
                // トランプ用リスト
                html += `<div class="lottery-area-cards">`;
                this.suits.forEach(suit => {
                    const count = settings.cardCounts[suit.id] || 0;
                    if (count === 0) return;

                    html += `
                        <div class="suit-col">
                            <div class="suit-header">${suit.symbol} ${suit.label}</div>
                            ${Array.from({ length: count }, (_, i) => i + 1).map(num => `
                                <div class="row">
                                    <div class="num">${num}</div>
                                    <div class="field"></div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                });
                html += `</div>`;
            }
        }

        html += `</body></html>`;

        const printWindow = window.open('', '', 'width=1100,height=800');
        printWindow.document.write(html);
        printWindow.document.close();

        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 500);
    }
};

// グローバルに公開
window.SeatingModule = SeatingModule;
