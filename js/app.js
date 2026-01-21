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

        // UI初期化
        this.updateHeaderDate();
        this.setupModals();
        this.setupSettings();
        this.setupStateSave();
        this.setupInactivityTimer();
        this.setupDateWeekdayDecorator(); // Date入力の曜日表示デコレーター

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

            const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
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
        const y = now.getFullYear();
        const m = ('0' + (now.getMonth() + 1)).slice(-2);
        const d = ('0' + now.getDate()).slice(-2);
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const day = dayNames[now.getDay()];

        headerDate.textContent = `${y}-${m}-${d}(${day})`;
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
                    console.log('⏰ Inactivity timeout - returning to dashboard');
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
        // 設定ボタン（デリゲーション・Router除外対応）
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#settingsMenuBtn') || e.target.closest('.settings-nav-item');
            if (btn) {
                e.preventDefault();
                console.log('⚙️ Settings button clicked');
                this.openSettings();
            }
        });

        // 設定モーダルを閉じる
        document.getElementById('closeSettingsModal').addEventListener('click', () => {
            this.closeSettings();
        });

        // 全データ削除
        document.getElementById('clearAllDataBtn').addEventListener('click', () => {
            if (confirm('本当に全データを削除しますか？\nこの操作は取り消せません。')) {
                if (confirm('最終確認：全データを削除してもよろしいですか？')) {
                    StorageManager.clearAllData();
                    location.reload();
                }
            }
        });
    },

    // 設定を開く
    openSettings() {
        const modal = document.getElementById('settingsModal');

        // ステートセーブリストを更新
        this.renderStateSaveList();

        // オートセーブリストを更新
        this.renderAutoSaveList();

        // 年度・クラス設定を読み込み
        this.loadClassSettings();

        // 保存ボタンのイベント設定（1回だけ）
        const saveBtn = document.getElementById('saveClassSettingsBtn');
        if (saveBtn && !saveBtn.hasAttribute('data-bound')) {
            saveBtn.setAttribute('data-bound', 'true');
            saveBtn.addEventListener('click', () => this.saveClassSettings());
        }

        // セレクト変更時にプレビュー更新
        ['gradeSelect', 'classSelect'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !el.hasAttribute('data-bound')) {
                el.setAttribute('data-bound', 'true');
                el.addEventListener('change', () => this.updateClassDisplayText());
            }
        });

        modal.classList.add('active');
    },

    // 年度・クラス設定を読み込み
    loadClassSettings() {
        const data = StorageManager.getCurrentData();
        const settings = data.appSettings || {};

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
                // 保存された値があればそれを使う、なければデフォルト（土日は0、平日は6）
                if (periodsPerDay[day] !== undefined) {
                    el.value = periodsPerDay[day];
                }
            }
        });

        this.updateClassDisplayText();
    },

    // クラス表示テキストを更新
    updateClassDisplayText() {
        const grade = document.getElementById('gradeSelect')?.value;
        const classNum = document.getElementById('classSelect')?.value;
        const displayText = document.getElementById('classDisplayText');

        if (!displayText) return;

        if (grade && classNum) {
            displayText.textContent = `現在の設定: ${grade}年${classNum}組`;
        } else if (grade) {
            displayText.textContent = `現在の設定: ${grade}年（組なし）`;
        } else {
            displayText.textContent = '現在の設定: クラスなし';
        }
    },

    // 年度・クラス設定を保存
    saveClassSettings() {
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

        const data = StorageManager.getCurrentData();
        data.appSettings = data.appSettings || {};
        data.appSettings.grade = grade;
        data.appSettings.classNum = classNum;
        data.appSettings.periodsPerDay = periodsPerDay;

        StorageManager.updateCurrentData(data);
        alert('設定を保存しました');
    },

    // 設定を閉じる
    closeSettings() {
        const modal = document.getElementById('settingsModal');
        modal.classList.remove('active');
    },

    // ステートセーブリストを描画
    renderStateSaveList() {
        const container = document.getElementById('stateSaveList');
        if (!container) return; // 要素が存在しない場合は何もしない

        const saves = StorageManager.getAllStateSaves();

        if (saves.length === 0) {
            container.innerHTML = '<p class="help-text">保存されたステートはありません</p>';
            return;
        }

        container.innerHTML = saves.map(save => `
            <div class="save-slot-item">
                <div class="save-slot-info">
                    <div class="save-slot-name">スロット ${save.slot}: ${save.name}</div>
                    <div class="save-slot-time">${new Date(save.timestamp).toLocaleString('ja-JP')}</div>
                </div>
                <div class="save-slot-actions">
                    <button class="btn-icon" onclick="App.loadStateSaveFromSettings(${save.slot})" title="読み込み">📂</button>
                    <button class="btn-icon delete" onclick="App.deleteStateSaveFromSettings(${save.slot})" title="削除">🗑️</button>
                </div>
            </div>
        `).join('');
    },

    // オートセーブリストを描画
    renderAutoSaveList() {
        const container = document.getElementById('autoSaveList');
        if (!container) return; // 要素が存在しない場合は何もしない

        const saves = StorageManager.getAllAutoSaves();

        if (saves.length === 0) {
            container.innerHTML = '<p class="help-text">オートセーブ履歴はありません</p>';
            return;
        }

        container.innerHTML = saves.map((save, index) => `
            <div class="save-slot-item">
                <div class="save-slot-info">
                    <div class="save-slot-name">${index === 0 ? '最新' : `${index + 1}つ前`}</div>
                    <div class="save-slot-time">${new Date(save.timestamp).toLocaleString('ja-JP')}</div>
                </div>
            </div>
        `).join('');
    },

    // 設定からステートセーブを読み込み
    loadStateSaveFromSettings(slot) {
        if (confirm('現在のデータを破棄して、このステートを読み込みますか？')) {
            StorageManager.loadStateSave(slot);
            this.closeSettings();
            location.reload();
        }
    },

    // 設定からステートセーブを削除
    deleteStateSaveFromSettings(slot) {
        if (confirm('このステートセーブを削除しますか？')) {
            StorageManager.deleteStateSave(slot);
            this.renderStateSaveList();
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
                        <div class="save-slot-name">スロット ${save.slot}: ${save.name || '(名前なし)'}</div>
                        <div class="save-slot-time">${new Date(save.timestamp).toLocaleString('ja-JP')}</div>
                    </div>
                    <div class="save-slot-actions">
                        <button class="btn btn-sm btn-primary" onclick="App.loadState(${save.slot})">読み込み</button>
                        <button class="btn btn-sm btn-danger" onclick="App.deleteState(${save.slot})">削除</button>
                    </div>
                </div>
            `).join('');
        }
    },

    // ステートを保存
    saveState() {
        const name = document.getElementById('stateSaveName').value.trim();
        const slot = parseInt(document.getElementById('stateSaveSlot').value);

        StorageManager.saveStateSave(slot, name);

        // リストを更新
        this.renderStateLoadList();

        // 成功通知
        alert(`スロット ${slot} に保存しました`);

        // 入力をクリア
        document.getElementById('stateSaveName').value = '';
    },

    // ステートを削除
    deleteState(slot) {
        if (confirm(`スロット ${slot} のデータを削除しますか？`)) {
            StorageManager.deleteStateSave(slot);
            this.renderStateLoadList();
        }
    },

    // ステートを読み込み
    loadState(slot) {
        if (confirm('現在のデータを破棄して、このステートを読み込みますか？')) {
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
