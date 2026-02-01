// ===== 席替えツールモジュール (履歴管理) =====

Object.assign(SeatingModule, {

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

    // 履歴に保存
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
    }
});
