// ===== クラウド同期モジュール =====
// GASと通信してアプリの全データ（生徒名簿・出欠・メモ・座席・バス・
// グループ・係・保護者会・時間割・ToDo・年間行事・テスト問題・所見）を自動同期する

// 同期対象のトップレベルフィールド
// ※appSettings（GAS URL等の端末ローカル設定）とsyncSettingsは同期しない
const SYNC_FIELDS = [
    'students', 'attendance', 'memos', 'personalMemos',
    'seating', 'bus', 'groups', 'duties', 'dutiesHistory',
    'meeting', 'schedule', 'todos', 'calendar',
    'testTemplates', 'reports'
];

const CloudSync = {
    // 接続先と合言葉は公開リポジトリに置かず、端末ごとに「基本設定」で入力する
    gasUrl: '',
    apiKey: '',

    // 同期状態
    enabled: false,
    syncing: false,
    lastSyncAt: null,
    syncTimer: null,
    SYNC_DEBOUNCE: 2000, // データ変更後2秒で同期

    // 初期化
    init() {
        const settings = StorageManager.getCurrentData().appSettings || {};
        this.gasUrl = settings.gasEndpointUrl || '';
        this.apiKey = settings.gasApiKey || '';
        this.enabled = !!(this.gasUrl && this.apiKey);

        if (this.enabled) {
            // 起動時にクラウドから読み込む
            this.loadFromCloud();
        }

        this._updateStatusUI();
    },

    // データ変更後に呼ばれる（debounce付き）
    triggerSync() {
        if (!this.enabled || !this.gasUrl) return;
        if (this.syncTimer) clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => {
            this.saveToCloud();
        }, this.SYNC_DEBOUNCE);
    },

    // クラウドに保存
    async saveToCloud() {
        if (!this.gasUrl) return;
        if (this.syncing) {
            // 保存中に発生した変更を取りこぼさないよう、完了後にもう一度保存する
            this.pendingSync = true;
            return;
        }
        this.syncing = true;
        this.pendingSync = false;
        this._updateStatusUI('syncing');

        try {
            const data = StorageManager.getCurrentData();

            // v2: 同期対象フィールドをまとめて送る
            const appData = {};
            SYNC_FIELDS.forEach(field => {
                if (data[field] !== undefined) appData[field] = data[field];
            });

            const payload = {
                action: 'save',
                apiKey: this.apiKey,
                appData: appData,
                // v1互換: GASが旧バージョンのままでも従来分は保存されるようにする
                schedule: data.schedule || null,
                todos: data.todos || [],
                calendar: data.calendar || null
            };

            const res = await fetch(this.gasUrl, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const json = await res.json();

            if (json.ok) {
                this.lastSyncAt = json.updatedAt;
                // ローカルの「最終同期時刻」も更新しないと、次回起動時に
                // クラウドの方が新しいと誤判定され今回保存した内容が
                // 巻き戻ってしまう。
                // ※ StorageManager.updateCurrentData() は呼ばない
                //   （自動保存→CloudSync.triggerSync() を再度呼び、
                //   永遠に同期し続けるループになってしまうため）。
                //   getCurrentData() は内部状態への参照そのものを返すので、
                //   直接書き換えれば次回の自動保存やページ離脱時に
                //   まとめて反映される。
                const latest = StorageManager.getCurrentData();
                latest.syncSettings = latest.syncSettings || {};
                latest.syncSettings.lastSyncAt = json.updatedAt;
                this._updateStatusUI('saved');
            } else {
                throw new Error(json.error || '保存失敗');
            }
        } catch (e) {
            console.error('[CloudSync] 保存エラー:', e);
            this._updateStatusUI('error');
        } finally {
            this.syncing = false;
            if (this.pendingSync) {
                this.pendingSync = false;
                this.saveToCloud();
            }
        }
    },

    // 通信開始時点のSYNC_FIELDSの内容をスナップショットする。
    // 通信完了後、このスナップショットと現在値を比べることで
    // 「通信中にユーザーがローカルで編集したフィールド」を検出できる
    _snapshotSyncFields(data) {
        const snapshot = {};
        SYNC_FIELDS.forEach(field => {
            snapshot[field] = JSON.stringify(data[field]);
        });
        return snapshot;
    },

    // クラウドのレスポンスからローカルデータへ反映する（適用したらtrue）
    // localSnapshotを渡すと、通信中にローカルで変更されたフィールドは
    // 上書きせずスキップする（初回同期の読み込み待ち中に入力したデータが
    // クラウドの内容で消えてしまうのを防ぐため）
    _applyCloudData(data, json, localSnapshot) {
        let changed = false;

        if (json.appData) {
            // v2: 全データをまとめて反映
            SYNC_FIELDS.forEach(field => {
                if (json.appData[field] === undefined || json.appData[field] === null) return;
                if (localSnapshot && JSON.stringify(data[field]) !== localSnapshot[field]) {
                    console.warn(`[CloudSync] "${field}" は読み込み中にこの端末で変更されたため、クラウドの内容で上書きしませんでした`);
                    return;
                }
                data[field] = json.appData[field];
                changed = true;
            });
        } else {
            // v1互換: GASが旧バージョンのまま（appData未対応）の場合
            console.warn('[CloudSync] GASが旧バージョンです。gas/Code.gs を再デプロイすると全データが同期されます');
            const legacyFields = { schedule: json.schedule, todos: json.todos, calendar: json.calendar };
            Object.entries(legacyFields).forEach(([field, value]) => {
                if (!value) return;
                if (localSnapshot && JSON.stringify(data[field]) !== localSnapshot[field]) {
                    console.warn(`[CloudSync] "${field}" は読み込み中にこの端末で変更されたため、クラウドの内容で上書きしませんでした`);
                    return;
                }
                data[field] = value;
                changed = true;
            });
        }

        return changed;
    },

    // クラウド反映後に各モジュールのキャッシュと表示を更新する
    _refreshModules() {
        // 内部キャッシュを持つモジュールを再読込
        if (window.ScheduleModule)   window.ScheduleModule.loadData?.();
        if (window.AttendanceModule) window.AttendanceModule.loadData?.();
        if (window.MemoModule)       window.MemoModule.loadPersonalMemos?.();
        if (window.BusModule)        window.BusModule.loadBuses?.();
        if (window.GroupsModule)     window.GroupsModule.loadGroupSets?.();
        // SeatingModuleはrender()内で「currentLayoutが無い時だけ」ストレージを
        // 読み直す作りのため、nullに戻して強制的に再読込させる
        if (window.SeatingModule)    window.SeatingModule.currentLayout = null;

        // ダッシュボード表示を更新
        if (window.ScheduleModule)  window.ScheduleModule.render?.('dashboardSchedule');
        if (window.DashboardModule) window.DashboardModule.renderTodos?.();
        if (window.CalendarModule)  window.CalendarModule.render?.();

        // 表示中のページを再描画
        if (window.Router?.currentPage) {
            window.Router.navigateTo(window.Router.currentPage, false);
        }
    },

    // 合言葉がURLやアクセスログに残らないよう、読み込みもPOSTで送る
    async _fetchCloud() {
        const res = await fetch(this.gasUrl, {
            method: 'POST',
            body: JSON.stringify({ action: 'load', apiKey: this.apiKey })
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || '読み込み失敗');
        return json;
    },

    // クラウドから読み込む
    async loadFromCloud() {
        if (!this.gasUrl) return;
        this._updateStatusUI('syncing');

        // 通信開始前のローカル状態をスナップショットしておく
        // （通信中にユーザーが入力した内容を上書きしないため）
        const localSnapshot = this._snapshotSyncFields(StorageManager.getCurrentData());

        try {
            const json = await this._fetchCloud();
            const data = StorageManager.getCurrentData();

            // タイムスタンプ比較（クラウドの方が新しければ上書き）
            const localUpdatedAt = data.syncSettings?.lastSyncAt || null;
            const cloudUpdatedAt = json.updatedAt;

            if (!localUpdatedAt || (cloudUpdatedAt && cloudUpdatedAt > localUpdatedAt)) {
                // クラウドが新しい → 上書き（通信中に編集されたフィールドは除く）
                const changed = this._applyCloudData(data, json, localSnapshot);

                if (changed) {
                    data.syncSettings = data.syncSettings || {};
                    data.syncSettings.lastSyncAt = cloudUpdatedAt;
                    StorageManager.updateCurrentData(data);
                    this._refreshModules();
                    console.log('[CloudSync] クラウドから最新データを読み込みました');
                }
            }

            this.lastSyncAt = cloudUpdatedAt;
            this._updateStatusUI('saved');
        } catch (e) {
            console.error('[CloudSync] 読み込みエラー:', e);
            this._updateStatusUI('error');
        }
    },

    // クラウドから強制上書き読み込み（タイムスタンプ比較なし）
    async loadFromCloudForce() {
        if (!this.gasUrl) return;
        this._updateStatusUI('syncing');

        // 「クラウドから読み込む」ボタンは意図的な全体上書きなので
        // スナップショットによるフィールド保護はかけない（そのまま全上書き）
        try {
            const json = await this._fetchCloud();
            const data = StorageManager.getCurrentData();
            const changed = this._applyCloudData(data, json);

            if (changed) {
                data.syncSettings = data.syncSettings || {};
                data.syncSettings.lastSyncAt = json.updatedAt;
                StorageManager.updateCurrentData(data);
                this._refreshModules();
            }

            this.lastSyncAt = json.updatedAt;
            this._updateStatusUI('saved');
        } catch (e) {
            console.error('[CloudSync] 強制読み込みエラー:', e);
            this._updateStatusUI('error');
        }
    },

    // 接続先を設定（保存先は data.appSettings.gasEndpointUrl / gasApiKey）
    setConnection(url, apiKey) {
        this.gasUrl = url.trim();
        this.apiKey = apiKey.trim();
        this.enabled = !!(this.gasUrl && this.apiKey);

        this._updateStatusUI();

        if (this.enabled) {
            this.loadFromCloud();
        }
    },

    // ステータスUI更新
    _updateStatusUI(state) {
        const el = document.getElementById('cloudSyncStatus');
        if (!el) return;
        if (!this.enabled) {
            el.textContent = '☁️ 同期: 未設定';
            el.style.color = '#94a3b8';
        } else if (state === 'syncing') {
            el.textContent = '☁️ 同期中...';
            el.style.color = '#f59e0b';
        } else if (state === 'saved') {
            const t = this.lastSyncAt ? new Date(this.lastSyncAt).toLocaleTimeString('ja-JP') : '';
            el.textContent = `☁️ 同期済 ${t}`;
            el.style.color = '#10b981';
        } else if (state === 'error') {
            el.textContent = '☁️ 同期エラー';
            el.style.color = '#dc2626';
        } else {
            el.textContent = '☁️ 同期: 有効';
            el.style.color = '#10b981';
        }
    }
};

window.CloudSync = CloudSync;
