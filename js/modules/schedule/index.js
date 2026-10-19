/**
 * ScheduleModule - 週間スケジュール・時間割管理
 * 
 * 機能:
 * - 4週間分のスケジュール表示
 * - クラス時間割と自分の時間割の管理
 * - 日ごとの予定変更
 * - 週次履歴の保存と見直し
 */

const ScheduleModule = {
    name: 'ScheduleModule',
    initialized: false,

    // クラスの時間割（月〜金、1〜6限）
    classTimetable: {
        mon: ['', '', '', '', '', ''],
        tue: ['', '', '', '', '', ''],
        wed: ['', '', '', '', '', ''],
        thu: ['', '', '', '', '', ''],
        fri: ['', '', '', '', '', '']
    },

    // 自分の時間割（教員用：担当授業がある時限）
    myTimetable: {
        mon: ['', '', '', '', '', ''],
        tue: ['', '', '', '', '', ''],
        wed: ['', '', '', '', '', ''],
        thu: ['', '', '', '', '', ''],
        fri: ['', '', '', '', '', '']
    },

    // アクティブな時間割（'class' or 'my'）
    activeTimetable: 'my',

    // 予定の上書き・変更 { class: {}, my: {} }
    dailyChanges: {
        class: {},
        my: {}
    },

    // ダッシュボードメモ（週単位の一時的なメモ）
    // { 'weekKey': { 'dateStr': { period: 'memo' } } }
    dashboardMemos: {},

    // 週オフセット
    weekOffset: 0,

    // クラス時間割用科目マスタ（科目名のみ）
    classSubjects: [],

    // 自分の時間割用科目マスタ（科目名＋クラス名）
    mySubjects: [],

    /**
     * 初期化
     */
    init() {
        if (this.initialized) return;
        this.loadData();
        this.initialized = true;
        console.log('📅 ScheduleModule initialized');
    },

    /**
     * 描画（自分の時間割をメイン表示、タブ切り替え）
     */
    render(containerId = 'dashboardSchedule') {
        const container = document.getElementById(containerId);
        if (!container) return;

        // デフォルトは自分の時間割
        if (!this.activeTimetable || (this.activeTimetable !== 'class' && this.activeTimetable !== 'my')) {
            this.activeTimetable = 'my';
        }

        const weeks = this._generateWeeks(4);

        let html = `
            <div class="schedule-controls">
                <div class="timetable-tabs">
                    <button class="tt-tab ${this.activeTimetable === 'my' ? 'active' : ''}" data-tt="my">自分の時間割</button>
                    <button class="tt-tab ${this.activeTimetable === 'class' ? 'active' : ''}" data-tt="class">クラス時間割</button>
                </div>
                <div class="schedule-actions">
                    <button class="btn btn-sm btn-info" id="printTimetableBtn">🖨️ 時間割印刷</button>
                    <button class="btn btn-sm btn-primary" id="openTimetableListBtn">📅 時間割一覧/変更</button>
                </div>
            </div>
            <div class="schedule-memo-notice">
                ※セルをクリックして予定メモを入力できます。時間割変更は「時間割一覧/変更」から行ってください。
            </div>
            <div class="schedule-wrapper">`;

        // アクティブな時間割のみ描画
        weeks.forEach((week, index) => {
            html += this._renderWeek(week, index === 0 ? '今週' : `${index}週後`);
        });

        html += '</div>';
        
        if (window.CoreDOM) {
            window.CoreDOM.updateDOMWithState(container, html);
        } else {
            container.innerHTML = html;
        }

        this._setupCellEvents(container);
        this._setupTabEvents(container);

        // 時間割一覧・印刷ボタン（コンテナへの委譲で多重バインド防止）
        if (!container.dataset.boundActions) {
            container.dataset.boundActions = 'true';
            container.addEventListener('click', (e) => {
                if (e.target.closest('#openTimetableListBtn')) this.openTimetableListModal();
                if (e.target.closest('#printTimetableBtn')) this.printTimetableForWeek();
            });
        }
    },

    _setupTabEvents(container) {
        if (!container.dataset.boundTabs) {
            container.addEventListener('click', (e) => {
                const tab = e.target.closest('.tt-tab');
                if (tab) {
                    this.activeTimetable = tab.dataset.tt;
                    this.render(container.id);
                }
            });
            container.dataset.boundTabs = 'true';
        }
    },

    _getCurrentTimetable() {
        return this.activeTimetable === 'class' ? this.classTimetable : this.myTimetable;
    },

    _renderWeek(weekDates, label) {
        const days = ['月', '火', '水', '木', '金'];
        const timetable = this._getCurrentTimetable();
        const currentChanges = this.activeTimetable === 'class' ? this.dailyChanges.class : this.dailyChanges.my;

        // 週キーを生成
        const weekKey = formatDate(weekDates[0]);
        // メモをタイプ（my/class）ごとに分離
        const typeMemos = (this.dashboardMemos[this.activeTimetable] || {})[weekKey] || {};

        // 時限時間設定を取得
        const appData = window.StorageManager?.getCurrentData() || {};
        const periodTimes = appData.appSettings?.periodTimes || {};
        const periodTimeDisplay = appData.appSettings?.periodTimeDisplay || 'none';
        // 区切り時限設定（デフォルト: 4限後・6限後）
        const periodDividers = appData.appSettings?.periodDividers ?? [4, 6];

        let html = `<div class="schedule-week">
            <div class="week-header">${label}</div>
            <div class="week-grid">
                <div class="grid-header-row">
                    <div class="grid-header-cell empty"></div>
                    ${weekDates.map((date, i) => `
                        <div class="grid-header-cell day-header ${this._isToday(date) ? 'today' : ''}">
                            <div class="date-label">${date.getMonth() + 1}/${date.getDate()} (${days[i]})</div>
                        </div>
                    `).join('')}
                </div>`;

        // 登校前行（periodIndex = -1 で保存）
        html += `<div class="grid-row after-row">
            <div class="grid-header-cell period-header">
                <div class="period-number period-number-small">登校前</div>
            </div>`;
        weekDates.forEach((date, dayIndex) => {
            const dateStr = formatDate(date);
            const dayKey = SCHOOL_DAY_KEYS[dayIndex];
            const beforeMemo = (typeMemos[dateStr] || {})[-1] || '';
            const hasMemo = beforeMemo !== '';
            html += `
                <div class="grid-cell ${hasMemo ? 'has-memo' : ''}"
                     data-date="${dateStr}"
                     data-period="0"
                     data-day="${dayKey}"
                     data-week-key="${weekKey}"
                     data-timetable="${this.activeTimetable}"
                     data-base-content="">
                    ${escapeHtml(beforeMemo)}
                </div>
            `;
        });
        html += `</div>`;

        for (let period = 1; period <= 7; period++) {
            // 時刻表示文字列を生成
            let timeHtml = '';
            if (periodTimeDisplay !== 'none' && periodTimes[period]) {
                const start = periodTimes[period].start || '';
                const end = periodTimes[period].end || '';
                if (periodTimeDisplay === 'start' && start) {
                    timeHtml = `<div class="period-time">${start}</div>`;
                } else if (periodTimeDisplay === 'both' && (start || end)) {
                    timeHtml = `<div class="period-time">${start}${start && end ? '〜' : ''}${end}</div>`;
                }
            }
            
            let periodLabel = period === 7 ? '放課後' : period;
            // 前の時限が区切り対象の場合、行に二重線クラスを付与
            const isDividerRow = period === 1 || periodDividers.includes(period - 1) || (period === 7 && periodDividers.includes(6));

            html += `<div class="grid-row${isDividerRow ? ' period-divider' : ''}">
                <div class="grid-header-cell period-header">
                    <div class="period-number ${period === 7 ? 'period-number-small' : ''}">${periodLabel}</div>
                    ${timeHtml}
                </div>`;

            weekDates.forEach((date, dayIndex) => {
                const dateStr = formatDate(date);
                const dayKey = SCHOOL_DAY_KEYS[dayIndex];

                // ベースの時間割を取得
                let baseContent = timetable[dayKey][period - 1];
                let isChanged = false;

                // 時間割変更を適用
                if (currentChanges[dateStr] && currentChanges[dateStr][period - 1] !== undefined) {
                    baseContent = currentChanges[dateStr][period - 1];
                    isChanged = true;
                }

                // ダッシュボードメモがあれば置換表示
                let displayContent = baseContent;
                let hasMemo = false;
                if (typeMemos[dateStr] && typeMemos[dateStr][period - 1] !== undefined && typeMemos[dateStr][period - 1] !== '') {
                    displayContent = typeMemos[dateStr][period - 1];
                    hasMemo = true;
                }

                html += `
                    <div class="grid-cell ${hasMemo ? 'has-memo' : ''} ${isChanged ? 'changed' : ''}" 
                         data-date="${dateStr}" 
                         data-period="${period}"
                         data-day="${dayKey}"
                         data-week-key="${weekKey}"
                         data-timetable="${this.activeTimetable}"
                         data-base-content="${escapeHtml(baseContent || '')}">
                        ${escapeHtml(displayContent || '')}
                    </div>
                `;
            });

            html += `</div>`;
        }

        html += `</div></div>`;
        return html;
    },

    _generateWeeks(numWeeks) {
        const weeks = [];
        const today = new Date();
        today.setDate(today.getDate() + (this.weekOffset || 0) * 7);
        const currentDay = today.getDay();
        const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
        let monday = new Date(today.setDate(diff));

        for (let w = 0; w < numWeeks; w++) {
            const week = [];
            for (let d = 0; d < 5; d++) {
                const date = new Date(monday);
                date.setDate(monday.getDate() + d);
                week.push(date);
            }
            weeks.push(week);
            monday.setDate(monday.getDate() + 7);
        }
        return weeks;
    },

    _isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    },

    _setupCellEvents(container) {
        if (!container.dataset.boundCells) {
            container.addEventListener('click', async (e) => {
                const cell = e.target.closest('.grid-cell');
                if (!cell) return;

                const date = cell.dataset.date;
                const period = parseInt(cell.dataset.period);
                const weekKey = cell.dataset.weekKey;
                const baseContent = cell.dataset.baseContent || '';
                const type = this.activeTimetable;

                // 現在のメモを取得
                const currentMemo = ((this.dashboardMemos[type] || {})[weekKey] || {})[date]?.[period - 1] || '';

                const [y, m, d] = date.split('-').map(Number);
                const periodLabel = period === 0 ? '登校前' : period === 7 ? '放課後' : `${period}限`;
                const values = await UI.form({
                    title: `📝 ${m}/${d}(${WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()]}) ${periodLabel} の予定メモ`,
                    description: `元の予定: ${baseContent || '（なし）'}\nここはメモです。時間割そのものの変更は「時間割一覧/変更」から行います。`,
                    fields: [{ name: 'memo', label: 'メモ（10文字以内・空欄で削除）', value: currentMemo, maxlength: 10 }],
                    submitLabel: '保存'
                });

                if (values) {
                    this._setDashboardMemo(type, weekKey, date, period - 1, values.memo.substring(0, 10));
                    this.render(container.id);
                }
            });
            container.dataset.boundCells = 'true';
        }
    },

    _setDashboardMemo(type, weekKey, dateStr, periodIndex, value) {
        if (!this.dashboardMemos[type]) this.dashboardMemos[type] = {};
        if (!this.dashboardMemos[type][weekKey]) this.dashboardMemos[type][weekKey] = {};
        if (!this.dashboardMemos[type][weekKey][dateStr]) this.dashboardMemos[type][weekKey][dateStr] = {};
        if (value === '') {
            delete this.dashboardMemos[type][weekKey][dateStr][periodIndex];
        } else {
            this.dashboardMemos[type][weekKey][dateStr][periodIndex] = value;
        }
        this.saveData();
    },

    _loadDashboardMemos() {
        const data = window.StorageManager?.getCurrentData() || {};
        const memos = data.schedule?.dashboardMemos || {};

        // 互換性対応と初期化
        if (memos.my || memos.class) {
            this.dashboardMemos = {
                my: memos.my || {},
                class: memos.class || {}
            };
        } else {
            // 古い形式または新規
            this.dashboardMemos = {
                my: memos, // 既存のメモは 'my' に移行
                class: {}
            };
        }
    },

    loadData() {
        const data = window.StorageManager?.getCurrentData() || {};
        if (data.schedule) {
            this.classTimetable = data.schedule.classTimetable || this.classTimetable;
            this.myTimetable = data.schedule.myTimetable || this.myTimetable;
            this._loadDashboardMemos();

            // dailyChangesのマイグレーション
            const loadedChanges = data.schedule.changes || {};
            if (loadedChanges.class && loadedChanges.my) {
                // 新形式
                this.dailyChanges = loadedChanges;
            } else {
                // 旧形式（すべてクラス用として扱う、またはクリア）
                // 既に保存されているデータ構造が日付キーのオブジェクトの場合
                this.dailyChanges = {
                    class: loadedChanges,
                    my: {} // 旧データは一旦クラス側に寄せる
                };
            }


            // 科目マスターの読み込み
            if (data.schedule.classSubjects) {
                this.classSubjects = data.schedule.classSubjects;
            }
            if (data.schedule.mySubjects) {
                this.mySubjects = data.schedule.mySubjects;
            }
        }
    },

    setClassTimetable(day, period, subject) {
        if (this.classTimetable[day]) {
            this.classTimetable[day][period - 1] = subject;
            this.saveData();
        }
    },

    setMyTimetable(day, period, subject) {
        if (this.myTimetable[day]) {
            this.myTimetable[day][period - 1] = subject;
            this.saveData();
        }
    },

    saveData() {
        const data = window.StorageManager?.getCurrentData() || {};
        if (!data.schedule) data.schedule = {};
        // 個別フィールドのみ上書きし、今後追加されるフィールドを消さないようにする
        Object.assign(data.schedule, {
            classTimetable: this.classTimetable,
            myTimetable: this.myTimetable,
            changes: this.dailyChanges,
            dashboardMemos: this.dashboardMemos,
            classSubjects: this.classSubjects,
            mySubjects: this.mySubjects
        });
        window.StorageManager?.updateCurrentData(data);
    }
};

if (typeof window !== 'undefined') {
    window.ScheduleModule = ScheduleModule;
}
