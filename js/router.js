// ===== ルーティングシステム =====
// ページ遷移とナビゲーション管理。表示中のページは URL のハッシュ（#master など）で決まる

const Router = {
    currentPage: 'dashboard',

    // ページID → [担当モジュール名, 表示メソッド名]
    // 新しいページを足すときは、index.html に <div id="page-xxx" class="page"> を作り、ここに1行足す
    PAGES: {
        dashboard: ['DashboardModule', 'render'],
        master: ['MasterModule', 'render'],
        memo: ['MemoModule', 'render'],
        attendance: ['AttendanceModule', 'render'],
        'timetable-settings': ['ScheduleModule', 'renderSettingsPage'],
        seating: ['SeatingModule', 'render'],
        bus: ['BusModule', 'render'],
        meeting: ['MeetingModule', 'render'],
        duties: ['DutiesModule', 'render'],
        groups: ['GroupsModule', 'render'],
        calendar: ['CalendarModule', 'render'],
        report: ['ReportModule', 'render'],
        'test-tools': ['TestToolsModule', 'render'],
        settings: ['App', 'loadClassSettings']
    },

    init() {
        this.setupNavigation();
        window.addEventListener('hashchange', () => this.navigateFromHash());
        this.navigateFromHash();
        console.log('🧭 Router initialized');
    },

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            // onclick属性がある場合（設定メニューなど）はRouterで処理しない
            if (item.hasAttribute('onclick')) return;

            item.addEventListener('click', (e) => {
                const page = item.dataset.page;
                if (page) {
                    e.preventDefault();
                    this.navigateTo(page);
                }
            });
        });
    },

    navigateFromHash() {
        const hash = window.location.hash.slice(1);
        this.navigateTo(hash || 'dashboard', false);
    },

    /**
     * ページを切り替える
     * @param {string} page
     * @param {boolean} updateHash - URLのハッシュも書き換えるか。書き換えると hashchange で
     *        もう一度ここが呼ばれるため、その場合は描画をそちらに任せる（二重描画を防ぐ）
     */
    navigateTo(page, updateHash = true) {
        const pageElement = document.getElementById(`page-${page}`);
        if (!pageElement) {
            console.warn(`Page not found: ${page}`);
            return;
        }

        if (updateHash && window.location.hash !== `#${page}`) {
            window.location.hash = page;
            return;
        }

        document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p === pageElement));
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
        // 折りたたまれたメニューの中のページを開いたら、メニューも開いて現在地を見せる
        const submenu = document.querySelector(`.nav-item[data-page="${page}"]`)?.closest('.nav-submenu');
        if (submenu && submenu.style.display === 'none') {
            submenu.style.display = 'block';
            const arrow = submenu.previousElementSibling?.querySelector('.nav-arrow');
            if (arrow) arrow.style.transform = 'rotate(90deg)';
        }

        this.currentPage = page;
        this.onPageChange(page);
    },

    // 表示したページの担当モジュールを初期化して描画する
    onPageChange(page) {
        const entry = this.PAGES[page];
        if (!entry) return;
        const [moduleName, method] = entry;
        const module = window[moduleName];
        if (!module) return;
        if (moduleName !== 'App') module.init?.();
        module[method]();
    }
};

window.Router = Router;
