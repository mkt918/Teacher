// ===== メインアプリケーション =====

const App = {
    inactivityTimer: null,
    INACTIVITY_TIMEOUT: 30 * 60 * 1000, // 30分（ミリ秒）

    // 初期化
    init() {
        console.log('🚀 Teacher App starting...');

        // 各モジュールを初期化 (順番が重要: ScheduleModuleを先に)
        StorageManager.init();
        if (window.ScheduleModule) window.ScheduleModule.init();

        Router.init();
        MasterModule.init();
        MemoModule.init();
        SeatingModule.init();
        DutiesModule.init();
        MeetingModule.init();

        // クラウド同期初期化
        if (window.CloudSync) window.CloudSync.init();

        // UI初期化
        const versionEl = document.getElementById('appVersionText');
        if (versionEl && typeof APP_VERSION !== 'undefined') versionEl.textContent = `v${APP_VERSION}`;
        this.updateHeaderDate();
        this.setupModals();
        UI.setupModalKeyboard();
        this.setupSettings();
        this.setupStateSave();
        this.setupInactivityTimer();
        this.setupDateWeekdayDecorator(); // Date入力の曜日表示デコレーター
        this.setupHamburgerMenu(); // モバイル用ハンバーガーメニュー

        console.log('✅ Teacher App initialized');
    },

    // Date入力の曜日を自動更新するデコレーター
    setupDateWeekdayDecorator() {
        const updateWeekday = (el) => {
            if (!el || el.type !== 'date') return;
            const dateVal = el.value;
            if (!dateVal) {
                el.setAttribute('data-weekday', '');
                return;
            }

            const date = new Date(dateVal);
            if (isNaN(date.getTime())) {
                el.setAttribute('data-weekday', '');
                return;
            }

            const dayNames = WEEKDAY_LABELS;
            const day = dayNames[date.getDay()];
            el.setAttribute('data-weekday', day);
        };

        // 初期表示時の全Date入力を処理
        document.querySelectorAll('input[type="date"]').forEach(updateWeekday);

        // 変更時のイベントリスナー
        document.addEventListener('change', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'date') {
                updateWeekday(e.target);
            }
        }, true);

        // 動的に追加される要素に対応するため、定期的にチェックするか、
        // ページ遷移（Router）に合わせるのが望ましいが、一旦変更イベントでカバー
        // Router.initの中で各モジュールのrenderが呼ばれるため、
        // 各モジュールのrender後にも更新が必要になる可能性がある
        window.addEventListener('hashchange', () => {
            // 少し遅延させてレンダリング完了を待つ
            setTimeout(() => {
                document.querySelectorAll('input[type="date"]').forEach(updateWeekday);
            }, 100);
        });
    },

    // ヘッダーの日付表示を更新
    updateHeaderDate() {
        const headerDate = document.getElementById('headerDate');
        if (!headerDate) return;

        const now = new Date();
        headerDate.textContent = `${formatDate(now)}(${WEEKDAY_LABELS[now.getDay()]})`;

        const headerFiscalYear = document.getElementById('headerFiscalYear');
        if (headerFiscalYear && typeof getFiscalYear === 'function') {
            headerFiscalYear.textContent = `${getFiscalYear()}年度`;
        }
    },

    // 全データ削除モーダルを開く
    openClearAllDataModal() {
        const modal = document.getElementById('clearAllDataModal');
        const input = document.getElementById('clearAllDataConfirmInput');
        const execBtn = document.getElementById('execClearAllDataBtn');
        if (!modal) return;
        input.value = '';
        execBtn.disabled = true;
        modal.classList.add('active');
        setTimeout(() => input.focus(), 50);
    },

    // 無操作タイマーのセットアップ
    setupInactivityTimer() {
        const resetTimer = () => {
            if (this.inactivityTimer) {
                clearTimeout(this.inactivityTimer);
            }
            this.inactivityTimer = setTimeout(() => {
                // ダッシュボードに戻る
                if (window.location.hash !== '#dashboard' && window.location.hash !== '') {
                    window.location.hash = '#dashboard';
                }
            }, this.INACTIVITY_TIMEOUT);
        };

        // ユーザー操作を検知してタイマーをリセット
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        events.forEach(event => {
            document.addEventListener(event, resetTimer, true);
        });

        // 初回タイマー開始
        resetTimer();
    },

    // モバイル用ハンバーガーメニューのセットアップ
    setupHamburgerMenu() {
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const sidebar = document.querySelector('.sidebar');

        if (!hamburgerBtn || !sidebar) return;

        hamburgerBtn.addEventListener('click', () => {
            hamburgerBtn.classList.toggle('active');
            sidebar.classList.toggle('mobile-open');
        });

        // メニュー項目クリックで自動的にメニューを閉じる
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                hamburgerBtn.classList.remove('active');
                sidebar.classList.remove('mobile-open');
            });
        });

        // サイドバー外クリックでメニューを閉じる
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target) && !hamburgerBtn.contains(e.target)) {
                hamburgerBtn.classList.remove('active');
                sidebar.classList.remove('mobile-open');
            }
        });
    },

    // モーダルのセットアップ
    setupModals() {
        // モーダル外クリックで閉じる
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    },

    // 設定画面のセットアップ
    setupSettings() {
        document.getElementById('syncUploadBtn')?.addEventListener('click', () => this.manualSyncUpload());
        document.getElementById('syncDownloadBtn')?.addEventListener('click', () => this.manualSyncDownload());

        // 担任業務グループの折りたたみトグル
        const homeroomToggle = document.getElementById('homeroomToggle');
        const homeroomSubmenu = document.getElementById('homeroomSubmenu');
        const homeroomArrow = document.getElementById('homeroomArrow');
        if (homeroomToggle && homeroomSubmenu) {
            homeroomToggle.addEventListener('click', () => {
                const isOpen = homeroomSubmenu.style.display !== 'none';
                homeroomSubmenu.style.display = isOpen ? 'none' : 'block';
                if (homeroomArrow) {
                    homeroomArrow.style.transform = isOpen ? '' : 'rotate(90deg)';
                }
            });
        }

    },

    // 年度・クラス設定を読み込み（設定ページに遷移したときに呼ばれる）
    loadClassSettings() {
        // 設定ページのボタンイベントを1回だけバインド
        const saveBtn = document.getElementById('saveClassSettingsBtn');
        if (saveBtn && !saveBtn.hasAttribute('data-bound')) {
            saveBtn.setAttribute('data-bound', 'true');
            saveBtn.addEventListener('click', () => this.saveClassSettings());
        }

        const clearBtn = document.getElementById('clearAllDataBtn');
        if (clearBtn && !clearBtn.hasAttribute('data-bound')) {
            clearBtn.setAttribute('data-bound', 'true');
            clearBtn.addEventListener('click', () => {
                this.openClearAllDataModal();
            });
        }

        // 全データ削除モーダルの各種ボタン（1回だけバインド）
        const clearModal = document.getElementById('clearAllDataModal');
        if (clearModal && !clearModal.hasAttribute('data-bound')) {
            clearModal.setAttribute('data-bound', 'true');

            const closeBtn = document.getElementById('closeClearAllDataModal');
            const cancelBtn = document.getElementById('cancelClearAllDataBtn');
            const execBtn = document.getElementById('execClearAllDataBtn');
            const input = document.getElementById('clearAllDataConfirmInput');

            const close = () => {
                clearModal.classList.remove('active');
                input.value = '';
                execBtn.disabled = true;
            };
            closeBtn.addEventListener('click', close);
            cancelBtn.addEventListener('click', close);
            clearModal.addEventListener('click', (e) => { if (e.target === clearModal) close(); });

            input.addEventListener('input', () => {
                execBtn.disabled = input.value.trim() !== '削除';
            });

            execBtn.addEventListener('click', () => {
                if (input.value.trim() !== '削除') return;
                StorageManager.clearAllData();
                location.reload();
            });
        }

        ['gradeSelect', 'classSelect'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.hasAttribute('data-bound')) {
                el.setAttribute('data-bound', 'true');
                el.addEventListener('change', () => this.updateClassDisplayText());
            }
        });

        const data = StorageManager.getCurrentData();
        const settings = data.appSettings || {};

        // 年度選択（前後5年分の選択肢を生成）
        const fiscalYearSelect = document.getElementById('fiscalYearSelect');
        if (fiscalYearSelect && !fiscalYearSelect.hasAttribute('data-bound')) {
            fiscalYearSelect.setAttribute('data-bound', 'true');
            const today = new Date();
            const currentFiscalYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
            fiscalYearSelect.innerHTML = '';
            for (let y = currentFiscalYear - 5; y <= currentFiscalYear + 5; y++) {
                const opt = document.createElement('option');
                opt.value = y;
                opt.textContent = `${y}年度（${y}/4〜${y + 1}/3）`;
                fiscalYearSelect.appendChild(opt);
            }
            fiscalYearSelect.addEventListener('change', () => this.updateClassDisplayText());
        }
        if (fiscalYearSelect) {
            const today = new Date();
            const currentFiscalYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
            fiscalYearSelect.value = settings.fiscalYear ?? currentFiscalYear;
        }

        const grade = document.getElementById('gradeSelect');
        const classNum = document.getElementById('classSelect');

        if (grade) {
            grade.value = settings.grade || '';
        }
        if (classNum) {
            classNum.value = settings.classNum || '';
        }

        // 曜日ごとの時限数
        const periodsPerDay = settings.periodsPerDay || {};
        ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].forEach(day => {
            const el = document.getElementById('periods' + day.charAt(0).toUpperCase() + day.slice(1));
            if (el) {
                if (periodsPerDay[day] !== undefined) {
                    el.value = periodsPerDay[day];
                }
            }
        });

        // 時限ごとの時間設定
        const periodTimeDisplay = document.getElementById('periodTimeDisplay');
        if (periodTimeDisplay) {
            periodTimeDisplay.value = settings.periodTimeDisplay || 'none';
        }
        this.renderPeriodTimesGrid(settings.periodTimes || {});
        // 区切り時限チェックボックスの初期化（デフォルト: 4限後・6限後）
        const dividers = settings.periodDividers ?? [4, 6];
        for (let p = 1; p <= 7; p++) {
            // 同一IDが複数存在する場合にすべて更新
            document.querySelectorAll(`[id="periodDivider${p}"]`).forEach(cb => {
                cb.checked = dividers.includes(p);
            });
        }
        // クラウド同期
        const gasEndpointUrlEl = document.getElementById('gasEndpointUrl');
        if (gasEndpointUrlEl) gasEndpointUrlEl.value = settings.gasEndpointUrl || '';
        const gasApiKeyEl = document.getElementById('gasApiKey');
        if (gasApiKeyEl) gasApiKeyEl.value = settings.gasApiKey || '';

        this.updateClassDisplayText();
    },

    // 5分刻みの時刻選択肢を生成
    _buildTimeOptions(selected) {
        let opts = '<option value="">─</option>';
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 5) {
                const hh = String(h).padStart(2, '0');
                const mm = String(m).padStart(2, '0');
                const val = `${hh}:${mm}`;
                opts += `<option value="${val}" ${selected === val ? 'selected' : ''}>${val}</option>`;
            }
        }
        return opts;
    },

    // 時限時間入力グリッドを描画（5分刻みselect）
    renderPeriodTimesGrid(periodTimes) {
        const grid = document.getElementById('periodTimesGrid');
        if (!grid) return;
        const maxPeriods = 8;
        let html = '';
        for (let p = 1; p <= maxPeriods; p++) {
            const start = periodTimes[p]?.start || '';
            const end   = periodTimes[p]?.end   || '';
            html += `
                <div class="period-time-card">
                    <div class="period-time-label">${p}限</div>
                    <div class="period-time-inputs">
                        <select id="periodStart${p}" aria-label="${p}限の開始時刻">${this._buildTimeOptions(start)}</select>
                        <span>〜</span>
                        <select id="periodEnd${p}" aria-label="${p}限の終了時刻">${this._buildTimeOptions(end)}</select>
                    </div>
                </div>`;
        }
        grid.innerHTML = html;

        // 開始時間変更時に終了時間を自動設定（50分後）
        for (let p = 1; p <= maxPeriods; p++) {
            const startSelect = document.getElementById(`periodStart${p}`);
            const endSelect = document.getElementById(`periodEnd${p}`);
            if (startSelect) {
                startSelect.addEventListener('change', () => {
                    const startVal = startSelect.value;
                    if (startVal && !endSelect.value) {
                        // 開始時間をパース（HH:MM形式）
                        const [h, m] = startVal.split(':').map(Number);
                        // 50分後を計算
                        let endMin = m + 50;
                        let endHour = h;
                        if (endMin >= 60) {
                            endHour += Math.floor(endMin / 60);
                            endMin = endMin % 60;
                        }
                        if (endHour < 24) {
                            const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
                            endSelect.value = endTime;
                        }
                    }
                });
            }
        }
    },

    // クラス表示テキストを更新
    updateClassDisplayText() {
        const fiscalYear = document.getElementById('fiscalYearSelect')?.value;
        const grade = document.getElementById('gradeSelect')?.value;
        const classNum = document.getElementById('classSelect')?.value;
        const displayText = document.getElementById('classDisplayText');

        if (!displayText) return;

        const yearPrefix = fiscalYear ? `${fiscalYear}年度 ` : '';

        if (grade && classNum) {
            displayText.textContent = `現在の設定: ${yearPrefix}${grade}年${classNum}組`;
        } else if (grade) {
            displayText.textContent = `現在の設定: ${yearPrefix}${grade}年（組なし）`;
        } else {
            displayText.textContent = `現在の設定: ${yearPrefix}クラスなし`;
        }
    },

    // 年度・クラス設定を保存
    saveClassSettings() {
        const fiscalYear = parseInt(document.getElementById('fiscalYearSelect')?.value, 10);
        const grade = document.getElementById('gradeSelect')?.value;
        const classNum = document.getElementById('classSelect')?.value;

        // 曜日ごとの時限数
        const periodsPerDay = {
            mon: parseInt(document.getElementById('periodsMon')?.value || '6'),
            tue: parseInt(document.getElementById('periodsTue')?.value || '6'),
            wed: parseInt(document.getElementById('periodsWed')?.value || '6'),
            thu: parseInt(document.getElementById('periodsThu')?.value || '6'),
            fri: parseInt(document.getElementById('periodsFri')?.value || '6'),
            sat: parseInt(document.getElementById('periodsSat')?.value || '0'),
            sun: parseInt(document.getElementById('periodsSun')?.value || '0')
        };

        // 時限ごとの時間設定
        const periodTimeDisplay = document.getElementById('periodTimeDisplay')?.value || 'none';
        const periodTimes = {};
        for (let p = 1; p <= 8; p++) {
            const start = document.getElementById(`periodStart${p}`)?.value || '';
            const end = document.getElementById(`periodEnd${p}`)?.value || '';
            if (start || end) {
                periodTimes[p] = { start, end };
            }
        }

        const gasEndpointUrl = (document.getElementById('gasEndpointUrl')?.value || '').trim();
        const gasApiKey = (document.getElementById('gasApiKey')?.value || '').trim();

        const periodDividers = [];
        for (let p = 1; p <= 7; p++) {
            const allCbs = document.querySelectorAll(`[id="periodDivider${p}"]`);
            if ([...allCbs].some(el => el.checked)) periodDividers.push(p);
        }

        const data = StorageManager.getCurrentData();
        data.appSettings = data.appSettings || {};
        if (!isNaN(fiscalYear)) data.appSettings.fiscalYear = fiscalYear;
        data.appSettings.grade = grade;
        data.appSettings.classNum = classNum;
        data.appSettings.periodsPerDay = periodsPerDay;
        data.appSettings.periodTimes = periodTimes;
        data.appSettings.periodTimeDisplay = periodTimeDisplay;
        data.appSettings.periodDividers = periodDividers;
        data.appSettings.gasEndpointUrl = gasEndpointUrl;
        data.appSettings.gasApiKey = gasApiKey;

        StorageManager.updateCurrentData(data);

        if (window.CloudSync) {
            window.CloudSync.setConnection(gasEndpointUrl, gasApiKey);
        }

        // ヘッダーの年度表示を即時更新
        this.updateHeaderDate();

        UI.toast('設定を保存しました', 'success');
    },

    // 手動クラウド保存
    async manualSyncUpload() {
        if (!window.CloudSync?.enabled) {
            UI.toast('先にGASエンドポイントURLと合言葉を入力して「設定を保存する」してください', 'error');
            return;
        }
        const ok = await UI.confirm(
            'この端末のデータをクラウドに上書き保存します。\n' +
            '他の端末で更新されていた場合も、この端末の内容で上書きします。\n' +
            '（クラウドの直前の内容は、GAS側のシート appDataPrev に1世代だけ残ります）',
            { title: '☁️ クラウドに保存', confirmLabel: 'クラウドを上書きする', danger: true }
        );
        if (!ok) return;
        const statusEl = document.getElementById('manualSyncStatus');
        if (statusEl) statusEl.textContent = '保存中...';
        await window.CloudSync.saveToCloud({ force: true });
        if (statusEl) statusEl.textContent = '✅ クラウドに保存しました';
        setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
    },

    // 手動クラウド読み込み
    async manualSyncDownload() {
        if (!window.CloudSync?.enabled) {
            UI.toast('先にGASエンドポイントURLと合言葉を入力して「設定を保存する」してください', 'error');
            return;
        }
        const ok = await UI.confirm(
            'クラウドのデータでこの端末のデータを上書きします。\n' +
            'この端末のデータは、自動バックアップに退避してから上書きします。',
            { title: '☁️ クラウドから読み込む', confirmLabel: 'この端末を置き換える', danger: true }
        );
        if (!ok) return;
        const statusEl = document.getElementById('manualSyncStatus');
        if (statusEl) statusEl.textContent = '読み込み中...';
        await window.CloudSync.loadFromCloudForce();
        if (statusEl) statusEl.textContent = '✅ クラウドから読み込みました';
        setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
    },

    // 自動バックアップ（変更前の状態）の一覧を描画
    renderAutoSaveList() {
        const container = document.getElementById('autoSaveList');
        if (!container) return;

        const saves = StorageManager.getAllAutoSaves();
        const { used, limit } = StorageManager.getStorageUsage();
        const usageHtml = `<p class="help-text">保存容量の目安: ${(used / 1000000).toFixed(1)}MB / 約${limit / 1000000}MB</p>`;

        if (saves.length === 0) {
            container.innerHTML = usageHtml + '<p class="help-text">自動バックアップはまだありません（編集すると、10分以上あけて変更前の状態が自動で残ります）</p>';
            return;
        }

        container.innerHTML = usageHtml + saves.map((save, index) => `
            <div class="save-slot-item">
                <div class="save-slot-info">
                    <div class="save-slot-name">${escapeHtml(save.name)}</div>
                    <div class="save-slot-time">${new Date(save.timestamp).toLocaleString('ja-JP')} の状態</div>
                </div>
                <div class="save-slot-actions">
                    <button class="btn btn-sm btn-primary" data-backup-index="${index}">この状態に戻す</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('[data-backup-index]').forEach(btn => {
            btn.addEventListener('click', () => this.restoreBackup(parseInt(btn.dataset.backupIndex, 10)));
        });
    },

    // バックアップファイル（JSON）から全データを読み込む
    importBackupFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!await UI.confirm('現在のデータを、このファイルの内容で置き換えます。\n（置き換える前の状態は、自動バックアップに残します）', { title: 'バックアップファイルから復元', confirmLabel: '置き換える', danger: true })) return;
            if (StorageManager.importData(await file.text())) {
                this.closeStateManageModal();
                location.reload();
            } else {
                UI.toast('バックアップファイルとして読み込めませんでした。このアプリで書き出したJSONファイルを選んでください', 'error');
            }
        };
        input.click();
    },

    // 自動バックアップから復元（復元前の状態も新しいバックアップとして残る）
    async restoreBackup(index) {
        if (!await UI.confirm('現在のデータを、このバックアップの状態に戻します。\n（戻す前の状態も、自動バックアップに残します）', { title: 'バックアップから元に戻す', confirmLabel: '元に戻す', danger: true })) return;
        if (StorageManager.restoreBackup(index)) {
            this.closeStateManageModal();
            location.reload();
        }
    },

    // ステートセーブのセットアップ
    setupStateSave() {
        // ステート管理ボタン
        const stateManageBtn = document.getElementById('stateManageBtn');
        if (stateManageBtn) {
            stateManageBtn.addEventListener('click', () => {
                this.openStateManageModal();
            });
        }

        // ステート管理モーダルを閉じる
        const closeStateManageModal = document.getElementById('closeStateManageModal');
        if (closeStateManageModal) {
            closeStateManageModal.addEventListener('click', () => {
                this.closeStateManageModal();
            });
        }

        const closeStateManageBtn = document.getElementById('closeStateManageBtn');
        if (closeStateManageBtn) {
            closeStateManageBtn.addEventListener('click', () => {
                this.closeStateManageModal();
            });
        }

        document.getElementById('exportBackupFileBtn')?.addEventListener('click', () => StorageManager.exportData());
        document.getElementById('importBackupFileBtn')?.addEventListener('click', () => this.importBackupFile());

        // ステート保存ボタン
        const confirmStateSaveBtn = document.getElementById('confirmStateSaveBtn');
        if (confirmStateSaveBtn) {
            confirmStateSaveBtn.addEventListener('click', () => {
                this.saveState();
            });
        }
    },

    // ステート管理モーダルを開く（統合版）
    openStateManageModal() {
        const modal = document.getElementById('stateManageModal');
        if (!modal) return;

        // 保存名をクリア
        const saveName = document.getElementById('stateSaveName');
        if (saveName) saveName.value = '';

        // 保存済みデータを表示
        this.renderStateLoadList();

        // オートセーブ履歴を表示
        this.renderAutoSaveList();

        modal.classList.add('active');
    },

    // ステート管理モーダルを閉じる
    closeStateManageModal() {
        const modal = document.getElementById('stateManageModal');
        if (modal) modal.classList.remove('active');
    },

    // 保存済みステート一覧を描画
    renderStateLoadList() {
        const container = document.getElementById('stateLoadList');
        if (!container) return;

        const saves = StorageManager.getAllStateSaves();

        if (saves.length === 0) {
            container.innerHTML = '<p class="help-text">保存されたステートはありません</p>';
        } else {
            container.innerHTML = saves.map(save => `
                <div class="save-slot-item">
                    <div class="save-slot-info">
                        <div class="save-slot-name">スロット ${save.slot}: ${escapeHtml(save.name || '(名前なし)')}</div>
                        <div class="save-slot-time">${new Date(save.timestamp).toLocaleString('ja-JP')}</div>
                    </div>
                    <div class="save-slot-actions">
                        <button class="btn btn-sm btn-primary" data-action="load-state" data-slot="${save.slot}">読み込み</button>
                        <button class="btn btn-sm btn-danger" data-action="delete-state" data-slot="${save.slot}">削除</button>
                    </div>
                </div>
            `).join('');
            // イベントデリゲーションでボタンのクリックを処理
            container.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const slot = parseInt(btn.dataset.slot);
                    if (btn.dataset.action === 'load-state') {
                        App.loadState(slot);
                    } else if (btn.dataset.action === 'delete-state') {
                        App.deleteState(slot);
                    }
                });
            });
        }
    },

    // ステートを保存
    saveState() {
        const name = document.getElementById('stateSaveName').value.trim();
        const slot = parseInt(document.getElementById('stateSaveSlot').value);

        if (!StorageManager.saveStateSave(slot, name)) {
            UI.toast('保存容量が足りず、保存できませんでした。不要なステートを削除してからもう一度お試しください', 'error');
            return;
        }

        this.renderStateLoadList();
        this.renderAutoSaveList();
        UI.toast(`スロット ${slot} に保存しました`, 'success');
        document.getElementById('stateSaveName').value = '';
    },

    // ステートを削除
    async deleteState(slot) {
        if (await UI.confirm(`スロット ${slot} に保存したデータを削除します。`, { title: 'ステートを削除', confirmLabel: '削除する', danger: true })) {
            StorageManager.deleteStateSave(slot);
            this.renderStateLoadList();
            this.renderAutoSaveList();
        }
    },

    // ステートを読み込み
    async loadState(slot) {
        if (await UI.confirm('現在のデータをこのステートに置き換えます。\n（置き換える前の状態は、自動バックアップに残します）', { title: 'ステートを読み込む', confirmLabel: '置き換える', danger: true })) {
            StorageManager.loadStateSave(slot);
            this.closeStateManageModal();
            location.reload();
        }
    }
};

// グローバルに公開
window.App = App;

// DOMContentLoaded後に初期化
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
