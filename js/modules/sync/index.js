// ===== クラウド同期モジュール =====
// GASと通信してアプリの全データ（生徒名簿・出欠・メモ・座席・バス・
// グループ・係・保護者会・時間割・ToDo・年間行事・テスト問題・所見）を自動同期する。
//
// 複数の端末で使っても、他の端末の変更を黙って上書きしないための仕組み:
// - syncSettings.lastSyncAt : この端末が最後にクラウドと一致した時点の「クラウド側の更新時刻」
// - syncSettings.dirty      : クラウドに送っていない変更がこの端末にあるか
// 保存時は lastSyncAt を添えて送り、クラウドがそれより新しければ GAS が競合として知らせる。

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

    enabled: false,
    syncing: false,
    loading: false,
    pendingSync: false,
    conflictPending: false,
    lastSyncAt: null,
    lastPullAt: 0,
    syncTimer: null,
    retryTimer: null,
    SYNC_DEBOUNCE: 2000,
    RETRY_DELAY: 60 * 1000,
    PULL_INTERVAL: 2 * 60 * 1000,

    init() {
        const settings = StorageManager.getCurrentData().appSettings || {};
        this.gasUrl = settings.gasEndpointUrl || '';
        this.apiKey = settings.gasApiKey || '';
        this.enabled = !!(this.gasUrl && this.apiKey);

        this._setupTriggers();
        if (this.enabled) {
            this.loadFromCloud();
        }
        this._updateStatusUI();
    },

    // 通信が戻ったとき／タブに戻ってきたときに、未送信の変更を送る・他端末の更新を取り込む
    _setupTriggers() {
        if (this._triggersReady) return;
        this._triggersReady = true;

        window.addEventListener('online', () => this.triggerSync());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible' || !this.enabled) return;
            if (Date.now() - this.lastPullAt < this.PULL_INTERVAL) return;
            if (this._isUnsynced()) this.triggerSync();
            else this.loadFromCloud();
        });
    },

    // クラウドに送っていない変更があるか（記録が無い＝一度も同期していない場合も「ある」とみなす）
    _isUnsynced() {
        const sync = StorageManager.getCurrentData().syncSettings;
        return !sync || sync.dirty !== false;
    },

    // データ変更後に呼ばれる（debounce付き）
    triggerSync() {
        if (!this.enabled || !this.gasUrl || this.conflictPending) return;
        if (!this._isUnsynced()) return;
        if (this.syncTimer) clearTimeout(this.syncTimer);
        this.syncTimer = setTimeout(() => {
            this.saveToCloud();
        }, this.SYNC_DEBOUNCE);
    },

    // 通信に失敗したときは、しばらくしてからもう一度試す
    _scheduleRetry() {
        if (this.retryTimer) return;
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this.triggerSync();
        }, this.RETRY_DELAY);
    },

    // クラウドに保存
    // force: 他の端末の更新があっても、この端末の内容で上書きする
    async saveToCloud({ force = false } = {}) {
        if (!this.gasUrl) return;
        if (this.syncing) {
            // 保存中に発生した変更を取りこぼさないよう、完了後にもう一度保存する
            this.pendingSync = true;
            return;
        }
        if (!force && (this.conflictPending || !this._isUnsynced())) return;

        this.syncing = true;
        this.pendingSync = false;
        this._updateStatusUI('syncing');

        const seqAtSend = StorageManager.changeSeq;
        let conflict = null;

        try {
            const data = StorageManager.getCurrentData();

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
                calendar: data.calendar || null,
                // どの版のクラウドを見て編集したか。これより新しければGASが競合として返す
                baseUpdatedAt: data.syncSettings?.lastSyncAt ?? null,
                force: force
            };

            const res = await fetch(this.gasUrl, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const json = await res.json();

            if (json.ok) {
                this.lastSyncAt = json.updatedAt;
                // ローカルの「最終同期時刻」も更新しないと、次回起動時に
                // クラウドの方が新しいと誤判定される。
                // ※ StorageManager.updateCurrentData() は呼ばない
                //   （自動保存→CloudSync.triggerSync() を再度呼び、永遠に同期し続けるため）。
                const latest = StorageManager.getCurrentData();
                latest.syncSettings = latest.syncSettings || {};
                latest.syncSettings.lastSyncAt = json.updatedAt;
                // 通信中に編集があった場合は、その分がまだ未送信なのでdirtyを残す
                if (StorageManager.changeSeq === seqAtSend) latest.syncSettings.dirty = false;
                this._updateStatusUI('saved');
            } else if (json.conflict) {
                conflict = json;
            } else {
                throw new Error(json.error || '保存失敗');
            }
        } catch (e) {
            console.error('[CloudSync] 保存エラー:', e);
            this.lastError = this._describeError(e);
            this._updateStatusUI('error');
            this._scheduleRetry();
        } finally {
            this.syncing = false;
        }

        if (conflict) {
            await this._resolveConflict();
            return;
        }
        if (this.pendingSync) {
            this.pendingSync = false;
            this.saveToCloud();
        }
    },

    // 他の端末が先にクラウドを更新していたとき、どちらの内容を残すか本人に選んでもらう
    async _resolveConflict() {
        this.conflictPending = true;
        this._updateStatusUI('conflict');
        try {
            const choice = await this._askWhichToKeep('他の端末（または別のタブ）で、クラウドのデータが先に更新されています。');
            if (choice === 'cloud') {
                await this.loadFromCloudForce();
            } else if (choice === 'local') {
                this.conflictPending = false;
                await this.saveToCloud({ force: true });
            }
            // 選ばずに閉じたときは何も変えない。次にデータを変更したとき、もう一度尋ねる
        } finally {
            this.conflictPending = false;
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

    // クラウドのレスポンスからローカルデータへ反映する。
    // localSnapshotを渡すと、通信中にローカルで変更されたフィールドは
    // 上書きせずスキップする（読み込み待ち中に入力したデータが消えてしまうのを防ぐため）。
    // 戻り値: { changed: 1つでも反映したか, skipped: 上書きしなかったフィールド名 }
    _applyCloudData(data, json, localSnapshot) {
        let changed = false;
        const skipped = [];

        const apply = (field, value) => {
            if (value === undefined || value === null) return;
            if (localSnapshot && JSON.stringify(data[field]) !== localSnapshot[field]) {
                console.warn(`[CloudSync] "${field}" は読み込み中にこの端末で変更されたため、クラウドの内容で上書きしませんでした`);
                skipped.push(field);
                return;
            }
            data[field] = value;
            changed = true;
        };

        if (json.appData) {
            SYNC_FIELDS.forEach(field => apply(field, json.appData[field]));
        } else {
            // v1互換: GASが旧バージョンのまま（appData未対応）の場合
            console.warn('[CloudSync] GASが旧バージョンです。gas/Code.gs を再デプロイすると全データが同期されます');
            apply('schedule', json.schedule);
            apply('todos', json.todos);
            apply('calendar', json.calendar);
        }

        return { changed, skipped };
    },

    // 内容がある（空文字・空配列・空オブジェクトだけではない）か
    _hasContent(value) {
        if (typeof value === 'string') return value.trim() !== '';
        if (Array.isArray(value)) return value.some(v => this._hasContent(v));
        if (value && typeof value === 'object') return Object.values(value).some(v => this._hasContent(v));
        return false;
    },

    _localHasContent(data) {
        return SYNC_FIELDS.some(field => this._hasContent(data[field]));
    },

    _cloudHasData(json) {
        return this._hasContent(json.appData) ||
            this._hasContent(json.schedule) || this._hasContent(json.todos) || this._hasContent(json.calendar);
    },

    // クラウドの版を取り込んだことを記録する（この時点でクラウドと一致したことになる）
    _adoptCloudVersion(updatedAt, hasSkippedLocalEdits) {
        const data = StorageManager.getCurrentData();
        data.syncSettings = { ...(data.syncSettings || {}), lastSyncAt: updatedAt };
        StorageManager.updateCurrentData(data);
        // 反映をスキップしたローカルの編集が残っていれば、それは未送信のまま
        if (!hasSkippedLocalEdits) StorageManager.getCurrentData().syncSettings.dirty = false;
    },

    // クラウドの内容をローカルに反映して画面を更新する
    _applyCloudNow(json, localSnapshot) {
        const result = this._applyCloudData(StorageManager.getCurrentData(), json, localSnapshot);
        if (result.changed) {
            this._adoptCloudVersion(json.updatedAt, result.skipped.length > 0);
            this._refreshModules();
            console.log('[CloudSync] クラウドから最新データを読み込みました');
        }
        return result;
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
        if (window.DashboardModule) {
            // ToDoは起動時にメモリへ読み込んだ一覧を使っているため、読み直さないと古い一覧が表示され、
            // 次の保存でクラウドの内容を古い一覧で上書きしてしまう
            window.DashboardModule.loadTodos?.();
            window.DashboardModule.renderTodos?.();
        }
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

    // 起動時・タブに戻ったとき・設定変更時にクラウドを確認する。
    // この端末に未送信の変更があるのにクラウドの方が新しい場合は、黙って上書きせず選んでもらう
    async loadFromCloud() {
        if (!this.gasUrl || this.loading) return;
        this.loading = true;
        this._updateStatusUI('syncing');

        // 通信開始前のローカル状態をスナップショットしておく
        // （通信中にユーザーが入力した内容を上書きしないため）
        const localSnapshot = this._snapshotSyncFields(StorageManager.getCurrentData());

        try {
            const json = await this._fetchCloud();
            const outcome = await this._reconcile(json, localSnapshot);
            this.lastPullAt = Date.now();
            if (outcome === 'undecided') {
                // どちらも選ばなかったので「同期済み」とは表示しない
                this._updateStatusUI('conflict');
            } else {
                this.lastSyncAt = json.updatedAt;
                this._updateStatusUI('saved');
            }
        } catch (e) {
            console.error('[CloudSync] 読み込みエラー:', e);
            this.lastError = this._describeError(e);
            this._updateStatusUI('error');
            this._scheduleRetry();
        } finally {
            this.loading = false;
        }
    },

    // クラウドとこの端末の内容をそろえる。どちらを残すか尋ねて選ばれなかったときは 'undecided' を返す
    async _reconcile(json, localSnapshot) {
        const data = StorageManager.getCurrentData();
        const sync = data.syncSettings || {};
        const cloudAt = json.updatedAt || null;
        const localHasContent = this._localHasContent(data);

        if (!this._cloudHasData(json)) {
            // クラウドが空なら、この端末の内容を最初のデータとして送る
            if (localHasContent) this._markUnsyncedAndSend(cloudAt);
            return;
        }

        if (!sync.lastSyncAt) {
            // この端末は一度もクラウドと同期していない
            if (!localHasContent) {
                this._applyCloudNow(json, localSnapshot);
                return;
            }
            return this._applyChoice(await this._askWhichToKeep('この端末にも、クラウドにも、すでにデータがあります。'), json, cloudAt);
        }

        if (cloudAt && cloudAt > sync.lastSyncAt) {
            if (sync.dirty !== true) {
                this._applyCloudNow(json, localSnapshot);
                return;
            }
            return this._applyChoice(
                await this._askWhichToKeep('他の端末でクラウドが更新されています。この端末にも、まだ送っていない変更があります。'),
                json, cloudAt);
        }

        if (sync.dirty === true) this.triggerSync();
    },

    _applyChoice(choice, json, cloudAt) {
        if (choice === 'cloud') {
            this._replaceLocalWithCloud(json);
        } else if (choice === 'local') {
            this._markUnsyncedAndSend(cloudAt);
        } else {
            return 'undecided';
        }
    },

    // どちらの内容を残すかを選んでもらう。'cloud' / 'local'、選ばずに閉じたときは null
    // （閉じる操作がどちらかを選んだことにならないよう、UI.choose を使う）
    _askWhichToKeep(reason) {
        return UI.choose({
            title: '☁️ クラウドとこの端末の内容が違います',
            message: reason,
            cancelLabel: 'あとで決める',
            choices: [
                {
                    label: 'クラウドの内容を使う',
                    value: 'cloud',
                    description: 'この端末のデータは、自動バックアップに退避してから置き換えます'
                },
                {
                    label: 'この端末の内容をクラウドに保存する',
                    value: 'local',
                    danger: true,
                    description: 'クラウドの直前の内容は、GASのシート appDataPrev に1世代だけ残ります'
                }
            ]
        });
    },

    _replaceLocalWithCloud(json) {
        StorageManager.snapshotToBackup();
        this._applyCloudNow(json);
    },

    // この端末の内容を送る。baseUpdatedAtにクラウドの現在の版を採用して、競合扱いにならないようにする
    _markUnsyncedAndSend(cloudAt) {
        const data = StorageManager.getCurrentData();
        data.syncSettings = { ...(data.syncSettings || {}), dirty: true };
        if (cloudAt) data.syncSettings.lastSyncAt = cloudAt;
        this.triggerSync();
    },

    // クラウドの内容でこの端末を上書きする（手動ボタン・競合の解決）。上書き前に自動バックアップへ退避する
    async loadFromCloudForce() {
        if (!this.gasUrl) return;
        this._updateStatusUI('syncing');

        try {
            const json = await this._fetchCloud();
            if (this._cloudHasData(json)) {
                this._replaceLocalWithCloud(json);
            }
            this.lastSyncAt = json.updatedAt;
            this.lastPullAt = Date.now();
            this._updateStatusUI('saved');
        } catch (e) {
            console.error('[CloudSync] 強制読み込みエラー:', e);
            this.lastError = this._describeError(e);
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

    // 通信エラーを、何を確認すればよいかが分かる日本語にする
    _describeError(e) {
        const msg = (e && e.message) || '';
        if (/Unauthorized/i.test(msg)) return '合言葉が一致しません（GASのAPI_KEYとアプリの合言葉を確認）';
        if (e instanceof SyntaxError) return 'GASの応答が想定と違います（URLが /exec で終わるか、再デプロイしたかを確認）';
        if (e instanceof TypeError) return 'GASに接続できません（URLと、デプロイの「アクセスできるユーザー: 全員」を確認）';
        return msg || '原因不明';
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
        } else if (state === 'conflict') {
            el.textContent = '☁️ 他の端末で更新あり（確認待ち）';
            el.style.color = '#f59e0b';
        } else if (state === 'saved') {
            const t = this.lastSyncAt ? new Date(this.lastSyncAt).toLocaleTimeString('ja-JP') : '';
            el.textContent = `☁️ 同期済 ${t}`;
            el.style.color = '#10b981';
        } else if (state === 'error') {
            el.textContent = `☁️ 同期エラー: ${this.lastError || '原因不明'}（変更はこの端末に保存済み）`;
            el.style.color = '#dc2626';
        } else {
            el.textContent = '☁️ 同期: 有効';
            el.style.color = '#10b981';
        }
    }
};

window.CloudSync = CloudSync;
