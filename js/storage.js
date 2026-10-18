// ===== 保存システム =====
// LocalStorageへの自動保存（リアルタイムセーブ）と、手動のステートセーブを管理する。
//
// 保存形式 (version 2):
//   { version, savedAt, lastBackupAt, current, backups: [...新しい順], stateSave: [...] }
// - current    : 現在のデータ（全データのコピーはこれ1つだけ）
// - backups    : 変更前の状態の自動バックアップ。10分以上あけて最大3件
// - stateSave  : ユーザーが名前を付けて残した手動保存（スロット1〜3）

const StorageManager = {
    STORAGE_KEY: 'teacherApp',
    STORAGE_VERSION: 2,
    STATE_SAVE_SLOTS: 3,
    AUTO_SAVE_DELAY: 1000,
    BACKUP_INTERVAL_MS: 10 * 60 * 1000,
    MAX_BACKUPS: 3,
    APPROX_QUOTA_CHARS: 5 * 1000 * 1000,

    autoSaveTimer: null,
    currentData: null,
    backups: [],
    stateSaves: [],
    lastBackupAt: 0,
    // データが変わるたびに増える番号。クラウド同期が「通信中に編集されたか」を判定するのに使う
    changeSeq: 0,

    _lastSerialized: null,
    _lastPersistedAt: null,
    _backupsJson: null,
    _stateSavesJson: null,

    init() {
        this.currentData = this.getDefaultData();
        this._load();
        this.setupAutoSave();
        console.log('💾 Storage Manager initialized');
    },

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

    getCurrentData() {
        return this.currentData;
    },

    updateCurrentData(data) {
        this.currentData = { ...this.currentData, ...data };
        this.currentData.syncSettings = { ...(this.currentData.syncSettings || {}), dirty: true };
        this.changeSeq++;
        this.triggerAutoSave();
    },

    // ===== 読み込み =====

    _load() {
        this.backups = [];
        this.stateSaves = [];
        this.lastBackupAt = 0;
        this._backupsJson = null;
        this._stateSavesJson = null;
        this._lastPersistedAt = null;

        const raw = this._readRaw();
        if (raw) {
            const loaded = this._migrate(raw);
            this.currentData = { ...this.getDefaultData(), ...loaded.current };
            this.backups = loaded.backups;
            this.stateSaves = loaded.stateSaves;
            this.lastBackupAt = loaded.lastBackupAt;
            this._lastPersistedAt = raw.savedAt || null;
        }
        this._lastSerialized = JSON.stringify(this.currentData);
    },

    // 壊れた保存データを無言で上書きしてしまわないよう、別のキーに退避しておく
    _readRaw() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) return null;
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('保存データを読み込めませんでした。別のキーに退避します:', e);
            try {
                localStorage.setItem(`${this.STORAGE_KEY}_corrupt_${Date.now()}`, stored);
            } catch (e2) { /* 容量が無ければ退避できないだけ */ }
            return null;
        }
    },

    // 旧形式(version 1: autoSave.latest / tenBefore / twentyBefore)を現在の形式にそろえる
    _migrate(raw) {
        if (raw.version === this.STORAGE_VERSION) {
            return {
                current: raw.current || {},
                backups: raw.backups || [],
                stateSaves: raw.stateSave || [],
                lastBackupAt: raw.lastBackupAt || 0
            };
        }

        let current = raw.current || {};
        const backups = [];
        const auto = raw.autoSave;
        const toBackup = (item) => ({ timestamp: item.timestamp, data: item.data });
        if (Array.isArray(auto)) {
            if (auto[0] && auto[0].data) current = auto[0].data;
            auto.slice(1).filter(item => item && item.data).forEach(item => backups.push(toBackup(item)));
        } else if (auto) {
            if (auto.latest && auto.latest.data) current = auto.latest.data;
            [auto.tenBefore, auto.twentyBefore].filter(item => item && item.data).forEach(item => backups.push(toBackup(item)));
        }
        return { current, backups, stateSaves: raw.stateSave || [], lastBackupAt: 0 };
    },

    // ===== 書き込み =====

    setupAutoSave() {
        // タブを閉じる／別アプリに切り替わる（スマホではこちらしか呼ばれないことがある）前に、
        // 1秒の待ち時間の途中にある変更を書き出す
        window.addEventListener('beforeunload', () => this.flushPending());
        window.addEventListener('pagehide', () => this.flushPending());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') this.flushPending();
        });
    },

    flushPending() {
        if (!this.autoSaveTimer) return;
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = null;
        this._persist();
    },

    // 変更のたびに呼ばれる。短時間の連続変更は1回にまとめて保存する
    triggerAutoSave() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        this.updateSaveIndicator('saving');

        this.autoSaveTimer = setTimeout(() => {
            this.autoSaveTimer = null;
            if (this._persist()) {
                this.updateSaveIndicator('saved');
                if (window.CloudSync) window.CloudSync.triggerSync();
            }
        }, this.AUTO_SAVE_DELAY);
    },

    _writeRaw(text) {
        try {
            localStorage.setItem(this.STORAGE_KEY, text);
            return true;
        } catch (e) {
            console.error('💥 保存に失敗しました（容量超過の可能性）:', e);
            return false;
        }
    },

    _buildPayload(currentJson, savedAt, withBackups) {
        if (this._backupsJson === null) this._backupsJson = JSON.stringify(this.backups);
        if (this._stateSavesJson === null) this._stateSavesJson = JSON.stringify(this.stateSaves);
        return `{"version":${this.STORAGE_VERSION},"savedAt":"${savedAt}","lastBackupAt":${this.lastBackupAt},` +
            `"current":${currentJson},"backups":${withBackups ? this._backupsJson : '[]'},"stateSave":${this._stateSavesJson}}`;
    },

    _pushBackup(data, timestamp) {
        this.backups.unshift({ timestamp: timestamp || new Date().toISOString(), data });
        this.backups = this.backups.slice(0, this.MAX_BACKUPS);
        this.lastBackupAt = Date.now();
        this._backupsJson = null;
    },

    // 現在データを書き込む。容量が足りなければ自動バックアップを省いて書き直す
    // （手動で残したステートセーブは、勝手に消さない）
    _persist() {
        const currentJson = JSON.stringify(this.currentData);
        const now = Date.now();

        // 前回保存した状態から変わっていて、前回のバックアップから十分時間が空いていれば、
        // 「今回の変更の前の状態」をバックアップとして残す
        if (this._lastSerialized !== null && this._lastSerialized !== currentJson &&
            now - this.lastBackupAt >= this.BACKUP_INTERVAL_MS) {
            this._pushBackup(JSON.parse(this._lastSerialized), this._lastPersistedAt);
        }

        const savedAt = new Date(now).toISOString();
        let saved = this._writeRaw(this._buildPayload(currentJson, savedAt, true));
        let skippedBackups = false;
        if (!saved) {
            saved = this._writeRaw(this._buildPayload(currentJson, savedAt, false));
            skippedBackups = saved;
        }

        if (!saved) {
            this.updateSaveIndicator('error');
            return false;
        }
        if (skippedBackups) {
            this.updateSaveIndicator('warn', '保存済み（容量不足のため自動バックアップは省略）');
        }
        this._lastSerialized = currentJson;
        this._lastPersistedAt = savedAt;
        return true;
    },

    // ===== 自動バックアップ =====

    // 復元・クラウドからの上書きの前に、今のデータを退避する（間隔に関係なく残す）
    snapshotToBackup() {
        this._pushBackup(this._clone(this.currentData), new Date().toISOString());
        return this._persist();
    },

    getAllAutoSaves() {
        return this.backups.map((b, i) => ({ name: `${i + 1}つ前のバックアップ`, ...b }));
    },

    restoreBackup(index) {
        const backup = this.backups[index];
        if (!backup) return false;
        this.snapshotToBackup();
        this._replaceCurrentData(this._clone(backup.data));
        return true;
    },

    // ===== ステートセーブ（手動保存） =====

    saveStateSave(slotNumber, name = '') {
        const previous = this.stateSaves;
        const newSlot = {
            slot: slotNumber,
            name: name || `スロット ${slotNumber}`,
            timestamp: new Date().toISOString(),
            data: this._clone(this.currentData)
        };
        this.stateSaves = previous.filter(s => s.slot !== slotNumber).concat(newSlot).sort((a, b) => a.slot - b.slot);
        this._stateSavesJson = null;

        if (!this._persist()) {
            this.stateSaves = previous;
            this._stateSavesJson = null;
            return false;
        }
        console.log('💾 State saved to slot', slotNumber);
        return true;
    },

    loadStateSave(slotNumber) {
        const slot = this.stateSaves.find(s => s.slot === slotNumber);
        if (!slot) return false;
        this.snapshotToBackup();
        this._replaceCurrentData(this._clone(slot.data));
        return true;
    },

    deleteStateSave(slotNumber) {
        const previous = this.stateSaves;
        this.stateSaves = previous.filter(s => s.slot !== slotNumber);
        this._stateSavesJson = null;
        if (!this._persist()) {
            this.stateSaves = previous;
            this._stateSavesJson = null;
            return false;
        }
        return true;
    },

    getAllStateSaves() {
        return this.stateSaves;
    },

    // 復元データで現在データを置き換える。クラウド接続情報と同期の状態は端末ごとのものなので引き継ぐ
    _replaceCurrentData(data) {
        const merged = { ...this.getDefaultData(), ...data };
        const current = (this.currentData && this.currentData.appSettings) || {};
        merged.appSettings = { ...merged.appSettings };
        ['gasEndpointUrl', 'gasApiKey'].forEach(key => {
            if (current[key] !== undefined) merged.appSettings[key] = current[key];
        });
        merged.syncSettings = { ...(this.currentData.syncSettings || {}) };
        this.currentData = merged;
        this.updateCurrentData({});
    },

    _clone(value) {
        return JSON.parse(JSON.stringify(value));
    },

    // ===== 全データ削除 =====

    _resetInMemory() {
        this.currentData = this.getDefaultData();
        this.backups = [];
        this.stateSaves = [];
        this.lastBackupAt = 0;
        this._backupsJson = null;
        this._stateSavesJson = null;
        this._lastSerialized = null;
        this._lastPersistedAt = null;
    },

    clearAllData() {
        this._resetInMemory();
        localStorage.removeItem(this.STORAGE_KEY);
        this._persist();

        // このセッション中は、空になった状態がクラウドへ送られないよう同期を止めておく
        // （GAS URLなどの設定は appSettings ごと削除済み）
        if (window.CloudSync) {
            window.CloudSync.gasUrl = '';
            window.CloudSync.apiKey = '';
            window.CloudSync.enabled = false;
        }
        console.log('🗑️ All data cleared');
    },

    // ===== 表示 =====

    // 保存容量の目安（LocalStorageは約5MB）
    getStorageUsage() {
        const stored = localStorage.getItem(this.STORAGE_KEY) || '';
        return { used: stored.length, limit: this.APPROX_QUOTA_CHARS };
    },

    updateSaveIndicator(status, message) {
        const indicator = document.getElementById('saveIndicator');
        if (!indicator) return;

        indicator.className = 'save-indicator';
        const text = indicator.querySelector('.save-text');

        if (status === 'saving') {
            indicator.classList.add('saving');
            text.textContent = '保存中...';
        } else if (status === 'saved') {
            indicator.classList.add('saved');
            text.textContent = '保存済み ✓';
            setTimeout(() => {
                indicator.className = 'save-indicator';
                text.textContent = '保存済み';
            }, 2000);
        } else if (status === 'warn') {
            indicator.classList.add('saved');
            text.textContent = message;
        } else if (status === 'error') {
            indicator.classList.add('error');
            text.textContent = '⚠️ 保存失敗（容量超過の可能性）';
            // エラーは自動では消さない（ユーザーに気づいてもらう必要があるため）
        }
    },

    // ===== バックアップファイル（JSON） =====

    exportData() {
        const data = this._clone(this.currentData);
        // 接続の合言葉をファイルに残さない
        if (data.appSettings) delete data.appSettings.gasApiKey;
        downloadTextFile(JSON.stringify(data, null, 2), `teacher-app-backup-${formatDate(new Date())}.json`, 'application/json');
    },

    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error('バックアップファイルの形式ではありません');
            }
            this.snapshotToBackup();
            this._replaceCurrentData(data);
            return true;
        } catch (e) {
            console.error('Failed to import data:', e);
            return false;
        }
    }
};

window.StorageManager = StorageManager;
