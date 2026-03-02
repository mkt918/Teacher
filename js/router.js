// ===== ルーティングシステム =====
// ページ遷移とナビゲーション管理

const Router = {
    currentPage: 'dashboard',

    // 初期化
    init() {
        this.setupNavigation();
        this.setupHashChange();
        this.navigateFromHash();
        console.log('🧭 Router initialized');
    },

    // ナビゲーションのセットアップ
    setupNavigation() {
        // サイドバーのナビゲーション
        document.querySelectorAll('.nav-item').forEach(item => {
            // onclick属性がある場合（設定メニューなど）はRouterで処理しない
            if (item.hasAttribute('onclick')) {
                return;
            }

            item.addEventListener('click', (e) => {
                const page = item.dataset.page;
                if (page) {
                    e.preventDefault();
                    this.navigateTo(page);
                }
            });
        });

        // ダッシュボードカード
        document.querySelectorAll('.dashboard-card').forEach(card => {
            card.addEventListener('click', () => {
                const page = card.dataset.navigate;
                if (page) {
                    this.navigateTo(page);
                }
            });
        });
    },

    // ハッシュ変更の監視
    setupHashChange() {
        window.addEventListener('hashchange', () => {
            this.navigateFromHash();
        });
    },

    // ハッシュからページ遷移
    navigateFromHash() {
        const hash = window.location.hash.slice(1); // #を除去
        if (hash) {
            this.navigateTo(hash, false);
        } else {
            // ハッシュがない場合はダッシュボードへ
            this.navigateTo('dashboard');
        }
    },

    // ページ遷移
    navigateTo(page, updateHash = true) {
        // ページが存在するか確認
        const pageElement = document.getElementById(`page-${page}`);
        if (!pageElement) {
            console.warn(`Page not found: ${page}`);
            return;
        }

        // 現在のページを非アクティブに
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });

        // 新しいページをアクティブに
        pageElement.classList.add('active');

        // ナビゲーションアイテムの更新
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });

        // ハッシュ更新
        if (updateHash) {
            window.location.hash = page;
        }

        this.currentPage = page;

        // ページ遷移時のコールバック
        this.onPageChange(page);
    },

    // ページ変更時のコールバック
    onPageChange(page) {
        console.log(`📄 Navigated to: ${page}`);

        // ページごとの初期化処理
        switch (page) {
            case 'master':
                if (window.MasterModule) {
                    MasterModule.init?.();
                    MasterModule.render();
                }
                break;
            case 'memo':
                if (window.MemoModule) {
                    MemoModule.init?.();
                    MemoModule.render();
                }
                break;
            case 'seating':
                if (window.SeatingModule) {
                    SeatingModule.init?.();
                    SeatingModule.render();
                }
                break;
            case 'duties':
                if (window.DutiesModule) {
                    DutiesModule.init();
                    DutiesModule.render();
                }
                break;
            case 'meeting':
                if (window.MeetingModule) {
                    MeetingModule.init?.();
                    MeetingModule.render();
                }
                break;
            case 'bus':
                if (window.BusModule) {
                    BusModule.init?.();
                    BusModule.loadBuses();
                    BusModule.render();
                }
                break;
            case 'groups':
                if (window.GroupsModule) {
                    GroupsModule.init?.();
                    GroupsModule.loadGroupSets();
                    GroupsModule.render();
                }
                break;
            case 'attendance':
                if (window.AttendanceModule) {
                    AttendanceModule.init?.();
                    AttendanceModule.loadData();
                    AttendanceModule.render();
                }
                break;
            case 'files':
                if (window.FilesModule) {
                    FilesModule.init?.();
                    FilesModule.loadFiles();
                    FilesModule.render();
                }
                break;
            case 'manual':
                if (window.ManualModule) {
                    ManualModule.init?.();
                    ManualModule.render();
                }
                break;
            case 'calendar':
                if (window.CalendarModule) {
                    CalendarModule.init();
                    CalendarModule.render();
                }
                break;
            case 'timetable-settings':
                if (window.ScheduleModule) {
                    ScheduleModule.init();
                    ScheduleModule.renderSettingsPage();
                }
                break;
            case 'report':
                if (window.ReportModule) {
                    ReportModule.init?.();
                    ReportModule.render();
                }
                break;
            case 'dashboard':
                this.updateDashboard();
                break;
        }
    },

    // ダッシュボードの更新
    updateDashboard() {
        if (window.DashboardModule) {
            DashboardModule.init();
            DashboardModule.render();
        }
    }
};

// グローバルに公開
window.Router = Router;
