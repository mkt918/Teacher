// ===== 席替えツールモジュール (くじ引きモード) =====

Object.assign(SeatingModule, {

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
        const lotteryAssignments = {};

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
            if (studentId) {
                this._assignStudentToKey(key, studentId);
            }
        });

        this.saveCurrentLayout();
        document.getElementById('lotteryInputModal').classList.remove('active');

        // 通常モードに自動切り替え
        if (this.isLotteryMode) {
            this.toggleLotteryMode();
        } else {
            this.render();
        }

        alert('座席表に反映しました。\n通常モードに切り替えます。');
    }
});
