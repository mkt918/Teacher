// ===== 保存システム =====
// LocalStorageを使用したリアルタイムセーブとステートセーブの管理

const StorageManager = {
    // 定数
    STORAGE_KEY: 'teacherApp',
    STATE_SAVE_SLOTS: 3,
    AUTO_SAVE_DELAY: 1000, // 1秒

    // 内部状態
    autoSaveTimer: null,
    currentData: null,
    saveCounter: 0, // 保存回数カウンター

    // 初期化
    init() {
        this.currentData = this.getDefaultData();
        this.loadAutoSave();
        this.setupAutoSave();
        // 保存カウンターを復元
        const allData = this.getAllData();
        this.saveCounter = allData.saveCounter || 0;
        console.log('💾 Storage Manager initialized');
    },

    // デフォルトデータ構造
    getDefaultData() {
        return {
            students: [],
            seating: {},
            meetings: [],
            duties: [],
            memos: {},
            appSettings: {
                periodTimes: {
                    1: { start: '08:00', end: '08:50' },
                    2: { start: '09:00', end: '09:50' },
                    3: { start: '10:00', end: '10:50' },
                    4: { start: '11:00', end: '11:50' },
                    5: { start: '13:00', end: '13:50' },
                    6: { start: '14:00', end: '14:50' },
                    7: { start: '15:00', end: '15:50' },
                    8: { start: '16:00', end: '16:50' }
                },
                periodTimeDisplay: 'both',
                periodsPerDay: {
                    mon: 6, tue: 6, wed: 6, thu: 6, fri: 6, sat: 0, sun: 0
                }
            },
            testTemplates: {
                wordGroups: [],
                questions: []
            }
        };
    },

    // 全データ取得
    getAllData() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error('Failed to parse stored data:', e);
                return this.getDefaultStorageStructure();
            }
        }
        return this.getDefaultStorageStructure();
    },

    // デフォルトストレージ構造
    getDefaultStorageStructure() {
        return {
            autoSave: {
                latest: null,      // 最新
                tenBefore: null,   // 10個前
                twentyBefore: null // 20個前
            },
            stateSave: [],
            current: this.getDefaultData(),
            saveCounter: 0
        };
    },

    // 現在のデータを取得
    getCurrentData() {
        return this.currentData;
    },

    // 現在のデータを更新
    updateCurrentData(data) {
        this.currentData = { ...this.currentData, ...data };
        this.triggerAutoSave();
    },

    // リアルタイムセーブのセットアップ
    setupAutoSave() {
        // ページを離れる前に保存
        window.addEventListener('beforeunload', () => {
            this.saveAutoSave(true);
        });
    },

    // リアルタイムセーブのトリガー（デバウンス）
    triggerAutoSave() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        // 保存中表示
        this.updateSaveIndicator('saving');

        this.autoSaveTimer = setTimeout(() => {
            const saved = this.saveAutoSave();
            if (saved) {
                this.updateSaveIndicator('saved');
                // クラウド同期もトリガー
                if (window.CloudSync) window.CloudSync.triggerSync();
            }
            // 失敗時はsaveAutoSave内で既にindicatorをerror状態にしている
        }, this.AUTO_SAVE_DELAY);
    },

    // localStorageへの書き込みを安全に行う（容量超過等で失敗したらfalseを返す）
    _writeToLocalStorage(allData) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allData));
            return true;
        } catch (e) {
            console.error('💥 保存に失敗しました（容量超過の可能性）:', e);
            return false;
        }
    },

    // リアルタイムセーブ実行
    // スロット: 最新、10個前、20個前
    saveAutoSave(immediate = false) {
        const allData = this.getAllData();
        const timestamp = new Date().toISOString();

        // 保存カウンターをインクリメント
        this.saveCounter++;

        // 新しいセーブデータ
        const newSave = {
            timestamp: timestamp,
            data: { ...this.currentData }
        };

        // autoSaveが旧形式（配列）の場合は新形式に変換
        if (Array.isArray(allData.autoSave)) {
            const oldLatest = allData.autoSave[0] || null;
            allData.autoSave = {
                latest: oldLatest,
                tenBefore: null,
                twentyBefore: null
            };
        }

        // 10回ごとに10個前スロットを更新
        if (this.saveCounter % 10 === 0) {
            allData.autoSave.tenBefore = allData.autoSave.latest
                ? { ...allData.autoSave.latest }
                : null;
        }

        // 20回ごとに20個前スロットを更新
        if (this.saveCounter % 20 === 0) {
            allData.autoSave.twentyBefore = allData.autoSave.tenBefore
                ? { ...allData.autoSave.tenBefore }
                : null;
        }

        // 最新スロットを更新
        allData.autoSave.latest = newSave;

        // 現在のデータも更新
        allData.current = { ...this.currentData };
        allData.saveCounter = this.saveCounter;

        // LocalStorageに保存
        const saved = this._writeToLocalStorage(allData);

        if (!saved) {
            // 容量超過等で保存できなかった場合は、無警告のまま進めず画面に明示する
            this.updateSaveIndicator('error');
            return false;
        }

        if (!immediate) {
            console.log('💾 Auto-saved at', new Date(timestamp).toLocaleString('ja-JP'), `(#${this.saveCounter})`);
        }
        return true;
    },

    // リアルタイムセーブから読み込み
    loadAutoSave() {
        const allData = this.getAllData();

        // 新形式（オブジェクト）の場合
        if (allData.autoSave && allData.autoSave.latest && allData.autoSave.latest.data) {
            this.currentData = { ...allData.autoSave.latest.data };
            console.log('📂 Loaded from auto-save (latest)');
            // 旧形式（配列）の場合
        } else if (Array.isArray(allData.autoSave) && allData.autoSave.length > 0) {
            this.currentData = { ...allData.autoSave[0].data };
            console.log('📂 Loaded from auto-save (legacy format)');
        } else if (allData.current) {
            // currentデータがあればそれを使用
            this.currentData = { ...allData.current };
        }
    },

    // ステートセーブ実行
    saveStateSave(slotNumber, name = '') {
        const allData = this.getAllData();
        const timestamp = new Date().toISOString();

        const newSlot = {
            slot: slotNumber,
            name: name || `スロット ${slotNumber}`,
            timestamp: timestamp,
            data: { ...this.currentData }
        };

        // 既存のスロットを探して置き換え、なければ追加
        const existingIndex = allData.stateSave.findIndex(s => s.slot === slotNumber);
        if (existingIndex >= 0) {
            allData.stateSave[existingIndex] = newSlot;
        } else {
            allData.stateSave.push(newSlot);
        }

        // スロット番号順にソート
        allData.stateSave.sort((a, b) => a.slot - b.slot);

        const saved = this._writeToLocalStorage(allData);
        if (saved) {
            console.log('💾 State saved to slot', slotNumber);
        }
        return saved;
    },

    // ステートセーブから読み込み
    loadStateSave(slotNumber) {
        const allData = this.getAllData();
        const slot = allData.stateSave.find(s => s.slot === slotNumber);

        if (slot) {
            this.currentData = { ...slot.data };

            // 復元した内容を「今この端末で確定した最新の状態」として扱う。
            // これをしないと、復元直後のクラウド同期で「クラウドの方が新しい」と
            // 誤判定され、せっかく復元した内容が古いクラウドデータで
            // 即座に上書きされてしまう
            this.currentData.syncSettings = {
                ...(this.currentData.syncSettings || {}),
                lastSyncAt: new Date().toISOString()
            };

            console.log('📂 Loaded from state save slot', slotNumber);

            // 読み込み後、オートセーブもトリガー
            this.triggerAutoSave();

            return true;
        }

        return false;
    },

    // ステートセーブ削除
    deleteStateSave(slotNumber) {
        const allData = this.getAllData();
        allData.stateSave = allData.stateSave.filter(s => s.slot !== slotNumber);
        this._writeToLocalStorage(allData);
        console.log('🗑️ Deleted state save slot', slotNumber);
    },

    // 全ステートセーブ取得
    getAllStateSaves() {
        const allData = this.getAllData();
        return allData.stateSave || [];
    },

    // 全オートセーブ取得（新形式対応）
    getAllAutoSaves() {
        const allData = this.getAllData();
        // 新形式の場合、配列に変換して返す
        if (allData.autoSave && !Array.isArray(allData.autoSave)) {
            const result = [];
            if (allData.autoSave.latest) {
                result.push({ name: '最新', ...allData.autoSave.latest });
            }
            if (allData.autoSave.tenBefore) {
                result.push({ name: '10個前', ...allData.autoSave.tenBefore });
            }
            if (allData.autoSave.twentyBefore) {
                result.push({ name: '20個前', ...allData.autoSave.twentyBefore });
            }
            return result;
        }
        return allData.autoSave || [];
    },

    // 全データ削除
    clearAllData() {
        this.currentData = this.getDefaultData();
        // 削除した「今」を最新の同期時刻として記録して保存し直す。
        // これをしないと、次回起動時にクラウド同期が「クラウドの方が新しい」と
        // 判定して削除前のデータをまるごと復元してしまい、
        // 「全データ削除は取り消せません」という説明と矛盾してしまう
        this.currentData.syncSettings = { lastSyncAt: new Date().toISOString() };

        localStorage.removeItem(this.STORAGE_KEY);
        const allData = this.getDefaultStorageStructure();
        allData.current = { ...this.currentData };
        this._writeToLocalStorage(allData);

        // このセッション内でクラウドへ今の（空の）状態が誤って送信・取得されないよう、
        // 同期も一旦止めておく（端末側のGAS URL設定自体は appSettings と共に削除済み）
        if (window.CloudSync) {
            window.CloudSync.gasUrl = '';
            window.CloudSync.enabled = false;
        }

        console.log('🗑️ All data cleared');
    },

    // 保存インジケーター更新
    updateSaveIndicator(status) {
        const indicator = document.getElementById('saveIndicator');
        if (!indicator) return;

        indicator.className = 'save-indicator';

        if (status === 'saving') {
            indicator.classList.add('saving');
            indicator.querySelector('.save-text').textContent = '保存中...';
        } else if (status === 'saved') {
            indicator.classList.add('saved');
            indicator.querySelector('.save-text').textContent = '保存済み ✓';

            // 2秒後に通常状態に戻す
            setTimeout(() => {
                indicator.className = 'save-indicator';
                indicator.querySelector('.save-text').textContent = '保存済み';
            }, 2000);
        } else if (status === 'error') {
            indicator.classList.add('error');
            indicator.querySelector('.save-text').textContent = '⚠️ 保存失敗（容量超過の可能性）';
            // エラーは自動では消さない（ユーザーに気づいてもらう必要があるため）
        }
    },

    // データエクスポート（JSON）
    exportData() {
        downloadTextFile(JSON.stringify(this.currentData, null, 2), `teacher-app-backup-${formatDate(new Date())}.json`, 'application/json');
    },

    // データインポート（JSON）
    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.currentData = { ...this.getDefaultData(), ...data };
            this.triggerAutoSave();
            return true;
        } catch (e) {
            console.error('Failed to import data:', e);
            return false;
        }
    }
};

// グローバルに公開
window.StorageManager = StorageManager;
