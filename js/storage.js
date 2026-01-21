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
            memos: {}
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
            this.saveAutoSave();
            this.updateSaveIndicator('saved');
        }, this.AUTO_SAVE_DELAY);
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
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allData));

        if (!immediate) {
            console.log('💾 Auto-saved at', new Date(timestamp).toLocaleString('ja-JP'), `(#${this.saveCounter})`);
        }
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

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allData));
        console.log('💾 State saved to slot', slotNumber);

        return true;
    },

    // ステートセーブから読み込み
    loadStateSave(slotNumber) {
        const allData = this.getAllData();
        const slot = allData.stateSave.find(s => s.slot === slotNumber);

        if (slot) {
            this.currentData = { ...slot.data };
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
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allData));
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
        localStorage.removeItem(this.STORAGE_KEY);
        this.currentData = this.getDefaultData();
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
        }
    },

    // データエクスポート（JSON）
    exportData() {
        const dataStr = JSON.stringify(this.currentData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `teacher-app-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
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
