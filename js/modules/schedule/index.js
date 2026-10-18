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

    _renderTimetableEditWithDnD(containerId, timetable, type) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const days = [
            { key: 'mon', label: '月' }, { key: 'tue', label: '火' }, { key: 'wed', label: '水' },
            { key: 'thu', label: '木' }, { key: 'fri', label: '金' }
        ];
        const subjects = type === 'class' ? this.classSubjects : this.mySubjects;
        const typeLabel = type === 'class' ? 'クラス時間割' : '自分の時間割';

        let html = `<h4 class="tt-edit-title">${typeLabel}</h4>`;
        html += '<table class="timetable-edit-table"><thead><tr><th></th>';
        days.forEach(d => { html += `<th>${d.label}</th>`; });
        html += '</tr></thead><tbody>';

        for (let period = 1; period <= 6; period++) {
            html += `<tr><td class="tt-edit-period">${period}限</td>`;
            days.forEach(d => {
                const subject = timetable[d.key][period - 1] || '';
                html += `<td class="tt-cell ${subject ? 'filled' : ''}" data-type="${type}" data-day="${d.key}" data-period="${period}">${this._ttCellInnerHtml(subject)}</td>`;
            });
            html += '</tr>';
        }
        html += '</tbody></table>';

        html += `<div class="subjects-tally-area" id="${containerId}_tally">
            <strong>科目別集計 (週次):</strong>
            <div class="tally-content"></div>
        </div>`;

        html += `<div class="subject-master-area">
            <div class="subject-master-header">
                <span>↑ 科目を上のセルにドラッグ、または科目をクリックで選んでからセルをクリック</span>
                <button class="btn btn-sm add-subject-btn" data-type="${type}">＋ 科目追加</button>
            </div>
            <div class="subject-cards">`;
        subjects.forEach((subj, idx) => {
            const displayText = typeof subj === 'object' ? `${subj.class} ${subj.name}` : subj;
            html += `<div class="subject-card" draggable="true" data-type="${type}" data-index="${idx}" data-value="${escapeHtml(displayText)}">
                <span>${escapeHtml(displayText)}</span>
                <button class="edit-subject-btn" data-type="${type}" data-index="${idx}" title="名前変更" aria-label="名前変更">✏️</button>
                <button class="delete-subject-btn" data-type="${type}" data-index="${idx}" title="科目を削除" aria-label="科目を削除">×</button>
            </div>`;
        });
        html += '</div></div>';

        container.innerHTML = html;
        this._updateSubjectsTally(containerId, timetable);
        this._setupTimetableDnD(container, type, timetable);
        this._setupSubjectEvents(container, type);
    },

    // 時間割設定のセルの中身（科目名と、科目があるときの「×」ボタン）
    _ttCellInnerHtml(subject) {
        return subject
            ? `<span class="cell-content">${escapeHtml(subject)}</span><button class="cell-clear-btn" title="この時限を空にする" aria-label="この時限を空にする">×</button>`
            : '<span class="cell-content"><span class="tt-cell-empty">—</span></span>';
    },

    _updateSubjectsTally(containerId, timetable) {
        const tallyContainer = document.querySelector(`#${containerId} .tally-content`);
        if (!tallyContainer) return;
        const counts = {};
        Object.values(timetable).forEach(dayPeriods => {
            dayPeriods.forEach(subject => {
                if (subject && subject.trim()) counts[subject] = (counts[subject] || 0) + 1;
            });
        });
        const sortedSubjects = Object.keys(counts).sort();
        if (sortedSubjects.length === 0) {
            tallyContainer.innerHTML = '<span class="tally-empty">設定されている科目はありません</span>';
            return;
        }
        tallyContainer.innerHTML = sortedSubjects.map(sub => `
            <div class="tally-item"><strong>${escapeHtml(sub)}</strong>: ${counts[sub]}時間</div>
        `).join('');
    },

    _setupTimetableDnD(container, type, timetable) {
        let selectedMasterValue = null;
        container.querySelectorAll('.subject-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', card.dataset.value);
                e.dataTransfer.effectAllowed = 'copy';
                card.classList.add('dragging');
            });
            card.addEventListener('dragend', () => card.classList.remove('dragging'));
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                const wasSelected = card.classList.contains('selected');
                container.querySelectorAll('.subject-card').forEach(c => c.classList.remove('selected'));
                selectedMasterValue = wasSelected ? null : card.dataset.value;
                card.classList.toggle('selected', !wasSelected);
            });
        });

        // セルの中身を書き換える（「×」もこの中で作り直す）
        const setCell = (cell, value) => {
            const { day, period } = cell.dataset;
            if (type === 'class') this.setClassTimetable(day, parseInt(period), value);
            else this.setMyTimetable(day, parseInt(period), value);
            cell.innerHTML = this._ttCellInnerHtml(value);
            cell.classList.toggle('filled', !!value);
            this._updateSubjectsTally(container.id, timetable);
        };

        container.querySelectorAll('.tt-cell').forEach(cell => {
            cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drag-over'); });
            cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
            cell.addEventListener('drop', (e) => {
                e.preventDefault();
                cell.classList.remove('drag-over');
                setCell(cell, e.dataTransfer.getData('text/plain'));
            });
            cell.addEventListener('click', (e) => {
                if (e.target.closest('.cell-clear-btn')) {
                    setCell(cell, '');
                    return;
                }
                if (selectedMasterValue) setCell(cell, selectedMasterValue);
                else UI.toast('下の科目をクリックで選んでからセルをクリックするか、科目をセルへドラッグしてください', 'info');
            });
        });
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
    },

    /**
     * 時間割設定ページの描画
     */
    renderSettingsPage() {
        this.loadData();

        // 科目マスターのデフォルト値
        if (this.classSubjects.length === 0) {
            this.classSubjects = ['国語', '算数', '理科', '社会', '英語', '体育', '音楽', '図工', '道徳', '総合'];
        }
        if (this.mySubjects.length === 0) {
            this.mySubjects = [];
        }

        // 自分の時間割を上に表示
        this._renderTimetableEditWithDnD('myTimetableEdit', this.myTimetable, 'my');
        this._renderTimetableEditWithDnD('classTimetableEdit', this.classTimetable, 'class');

        const saveBtn = document.getElementById('saveTimetableBtn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                this.saveData();
                UI.toast('時間割を保存しました', 'success');
            };
        }
    },


    _setupSubjectEvents(container, type) {
        // 科目追加ボタン
        container.querySelectorAll('.add-subject-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const values = await UI.form({
                    title: '＋ 科目を追加',
                    fields: [{
                        name: 'subject',
                        label: type === 'class' ? '科目名' : '科目名とクラス',
                        required: true,
                        placeholder: type === 'class' ? '例: 国語' : '例: 1-1 国語'
                    }],
                    submitLabel: '追加'
                });
                if (!values) return;
                if (type === 'class') {
                    this.classSubjects.push(values.subject);
                } else {
                    this.mySubjects.push(values.subject);
                }
                this.saveData();
                this.renderSettingsPage();
            });
        });

        // 科目編集ボタン
        container.querySelectorAll('.edit-subject-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                const subjects = type === 'class' ? this.classSubjects : this.mySubjects;
                const current = typeof subjects[idx] === 'object'
                    ? `${subjects[idx].class} ${subjects[idx].name}`
                    : subjects[idx];
                const values = await UI.form({
                    title: '✏️ 科目名を変更',
                    description: '時間割と、これまでの時間割変更の中の同じ科目名も、まとめて新しい名前に変わります。',
                    fields: [{ name: 'subject', label: type === 'class' ? '科目名' : '科目名とクラス', required: true, value: current }],
                    submitLabel: '変更'
                });
                if (values && values.subject !== current) {
                    const newVal = values.subject;

                    // マスター更新
                    if (type === 'class') {
                        this.classSubjects[idx] = newVal;
                    } else {
                        this.mySubjects[idx] = newVal;
                    }

                    // 時間割セルを過去にさかのぼって一括置換
                    const timetables = type === 'class'
                        ? [this.classTimetable]
                        : [this.myTimetable];
                    timetables.forEach(tt => {
                        Object.keys(tt).forEach(day => {
                            tt[day] = tt[day].map(s => s === current ? newVal : s);
                        });
                    });

                    // dailyChanges も置換
                    const changesKey = type === 'class' ? 'class' : 'my';
                    const changes = this.dailyChanges[changesKey] || {};
                    Object.keys(changes).forEach(dateStr => {
                        const day = changes[dateStr];
                        Object.keys(day).forEach(periodIdx => {
                            if (day[periodIdx] === current) day[periodIdx] = newVal;
                        });
                    });

                    this.saveData();
                    this.renderSettingsPage();
                }
            });
        });

        // 科目削除ボタン
        container.querySelectorAll('.delete-subject-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                if (type === 'class') {
                    this.classSubjects.splice(idx, 1);
                } else {
                    this.mySubjects.splice(idx, 1);
                }
                this.saveData();
                this.renderSettingsPage();
            });
        });
    },

    /**
     * 時間割一覧モーダルを開く
     */
    openTimetableListModal() {
        document.getElementById('timetableListModal')?.remove();

        // 現在の週の開始日（月曜）を取得
        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset);

        // デフォルトで14日間（土日含む）表示
        const endDate = new Date(monday);
        endDate.setDate(monday.getDate() + 13);

        const startStr = formatDate(monday);
        const endStr = formatDate(endDate);

        const modal = document.createElement('div');
        modal.id = 'timetableListModal';
        modal.className = 'modal active';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `
            <div class="modal-content modal-scroll tt-list-modal">
                <div class="modal-header">
                    <h3>📅 時間割一覧/変更</h3>
                    <div class="tt-list-header-actions">
                        <button id="resetTimetableChangesBtn" class="btn btn-danger btn-sm" title="この期間の変更データを全て削除してベースに戻す" aria-label="この期間の変更データを全て削除してベースに戻す">🗑️ 変更リセット</button>
                        <span class="tt-list-autosave">✅ 変更はすぐに保存されます</span>
                        <button class="modal-close" aria-label="閉じる" id="closeTimetableListModal">✕</button>
                    </div>
                </div>
                <div class="modal-body modal-body-scroll">
                    <div class="timetable-list-notice">
                        ⚠️ <strong>この一覧が授業時数カウントのベースとなります。</strong>
                        参観日や行事で土日に授業がある場合もここで設定してください。
                    </div>
                    <div class="timetable-list-controls">
                        <div class="timetable-tabs">
                            <button class="tt-tab ${this.activeTimetable === 'my' ? 'active' : ''}" data-tt="my" id="ttListTabMy">自分の時間割</button>
                            <button class="tt-tab ${this.activeTimetable === 'class' ? 'active' : ''}" data-tt="class" id="ttListTabClass">クラス時間割</button>
                        </div>
                        <div class="tt-list-group">
                            <button class="btn btn-sm" id="ttListPrevWeekBtn">◀ 前の週</button>
                            <button class="btn btn-sm" id="ttListNextWeekBtn">次の週 ▶</button>
                        </div>
                        <div class="tt-list-group">
                            <input type="date" id="ttListStartDate" aria-label="表示する期間の開始日" value="${startStr}">
                            <span>〜</span>
                            <input type="date" id="ttListEndDate" value="${endStr}" aria-label="表示する期間の終了日">
                            <button class="btn btn-sm" id="ttListRefreshBtn">表示</button>
                        </div>
                    </div>
                    <div id="timetableListContent">
                        <!-- 一覧テーブルがここに描画される -->
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // イベント設定
        document.getElementById('closeTimetableListModal').addEventListener('click', () => {
            modal.remove();
        });

        document.getElementById('resetTimetableChangesBtn').addEventListener('click', async () => {
            if (!await UI.confirm('表示中の期間の変更データを全て削除して、ベースの時間割に戻します。\n（ベース時間割の設定は消えません）', { title: '変更をリセット', confirmLabel: 'ベースに戻す', danger: true })) return;
            const startStr = document.getElementById('ttListStartDate')?.value;
            const endStr = document.getElementById('ttListEndDate')?.value;
            if (!startStr || !endStr) return;
            const start = new Date(startStr);
            const end = new Date(endStr);
            const type = this.activeTimetable;
            if (!this.dailyChanges[type]) this.dailyChanges[type] = {};
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateKey = formatDate(new Date(d));
                delete this.dailyChanges[type][dateKey];
            }
            this.saveData();
            this._renderTimetableList();
        });

        document.getElementById('ttListTabMy').addEventListener('click', () => {
            this.activeTimetable = 'my';
            this._renderTimetableList();
        });

        document.getElementById('ttListTabClass').addEventListener('click', () => {
            this.activeTimetable = 'class';
            this._renderTimetableList();
        });

        document.getElementById('ttListRefreshBtn').addEventListener('click', () => {
            this._renderTimetableList();
        });

        // 前の週・次の週ボタン
        document.getElementById('ttListPrevWeekBtn').addEventListener('click', () => {
            this._moveTimetableListWeek(-1);
        });
        document.getElementById('ttListNextWeekBtn').addEventListener('click', () => {
            this._moveTimetableListWeek(1);
        });

        // 初回描画
        this._renderTimetableList();
    },

    /**
     * 時間割一覧の期間を週単位で移動
     */
    _moveTimetableListWeek(offset) {
        const startInput = document.getElementById('ttListStartDate');
        const endInput = document.getElementById('ttListEndDate');
        if (!startInput || !endInput) return;

        const start = new Date(startInput.value);
        const end = new Date(endInput.value);

        start.setDate(start.getDate() + (offset * 7));
        end.setDate(end.getDate() + (offset * 7));

        startInput.value = formatDate(start);
        endInput.value = formatDate(end);

        this._renderTimetableList();
    },

    /**
     * 時間割一覧テーブルを描画
     */
    _renderTimetableList() {
        const container = document.getElementById('timetableListContent');
        if (!container) return;

        const startStr = document.getElementById('ttListStartDate')?.value;
        const endStr = document.getElementById('ttListEndDate')?.value;
        if (!startStr || !endStr) return;

        const start = new Date(startStr);
        const end = new Date(endStr);

        // 設定から曜日ごとの時限数を取得
        const data = window.StorageManager?.getCurrentData() || {};
        const periodsPerDay = data.appSettings?.periodsPerDay || { mon: 6, tue: 6, wed: 6, thu: 6, fri: 6 };

        // 日付リストを生成（指定期間全て、土日含む）
        const dates = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(new Date(d));
        }

        if (dates.length === 0) {
            container.innerHTML = '<p>表示する日付がありません</p>';
            return;
        }

        // 行事データを取得
        const events = window.CalendarModule?.events || [];

        // タブ状態の更新
        document.getElementById('ttListTabMy').className = `tt-tab ${this.activeTimetable === 'my' ? 'active' : ''}`;
        document.getElementById('ttListTabClass').className = `tt-tab ${this.activeTimetable === 'class' ? 'active' : ''}`;

        // ベース時間割
        const baseTimetable = this.activeTimetable === 'class' ? this.classTimetable : this.myTimetable;
        const changes = this.dailyChanges[this.activeTimetable] || {};

        // 最大時限数 (6限まで + 7限目(放課後))
        const maxPeriods = 7;

        // テーブル生成
        let html = '<table class="timetable-list-table"><thead><tr><th>時限</th>';
        dates.forEach(d => {
            const dayNames = WEEKDAY_LABELS;
            const dayOfWeek = d.getDay();
            const dayClass = dayOfWeek === 0 ? 'sunday' : (dayOfWeek === 6 ? 'saturday' : '');
            const dateStr = `${d.getMonth() + 1}/${d.getDate()}(${dayNames[dayOfWeek]})`;
            html += `<th class="date-header ${dayClass}">${dateStr}</th>`;
        });
        html += '</tr></thead><tbody>';

        // 行事行
        html += '<tr class="event-row"><td>行事</td>';
        dates.forEach(d => {
            const dateKey = formatDate(d);
            const dayEvents = events.filter(e => {
                const eStart = new Date(e.start);
                const eEnd = e.end ? new Date(e.end) : eStart;
                return d >= new Date(eStart.getFullYear(), eStart.getMonth(), eStart.getDate()) &&
                    d <= new Date(eEnd.getFullYear(), eEnd.getMonth(), eEnd.getDate());
            });
            const eventText = dayEvents.map(e => e.title).join(', ');
            html += `<td class="event-cell">${eventText || ''}</td>`;
        });
        html += '</tr>';

        // 時限行
        for (let p = 0; p < maxPeriods; p++) {
            let periodLabel = (p === 6) ? '放課後' : `${p + 1}限`;
            html += `<tr><td class="period-cell ${p === 6 ? 'tt-after-school' : ''}">${periodLabel}</td>`;
            dates.forEach(d => {
                const dayOfWeek = d.getDay();
                const dayKey = WEEKDAY_KEYS[dayOfWeek];
                const dateKey = formatDate(d);
                const periods = periodsPerDay[dayKey] !== undefined ? periodsPerDay[dayKey] : 0;

                // 変更データがある場合はセルの存在を許可する（手動設定対応）
                // キーは0ベース（p）で管理、data-periodは1ベース（p+1）でダッシュボードと統一
                const hasChange = changes[dateKey] && changes[dateKey][p] !== undefined;

                // 土日でもセルは常にクリック可能（強制設定可能）
                const forceEnabled = true;

                if (p >= periods && !hasChange && !forceEnabled) {
                    html += '<td class="disabled-cell"></td>';
                    return;
                }

                // 変更があればそれを表示、なければベース
                let value = '';
                if (changes[dateKey] && changes[dateKey][p] !== undefined) {
                    value = changes[dateKey][p];
                } else {
                    value = baseTimetable[dayKey]?.[p] || '';
                }
                const isChanged = changes[dateKey] && changes[dateKey][p] !== undefined;
                const dayClass = dayOfWeek === 0 ? 'sunday-cell' : (dayOfWeek === 6 ? 'saturday-cell' : '');

                // data-periodは0ベース（pをそのまま使用）
                html += `<td class="tt-list-cell ${isChanged ? 'changed' : ''} ${dayClass}" data-date="${dateKey}" data-period="${p}">${escapeHtml(value)}</td>`;
            });
            html += '</tr>';
        }

        // 操作行
        html += '<tr class="action-row"><td>操作</td>';
        dates.forEach(d => {
            const dateKey = formatDate(d);
            html += `<td>
                <button class="btn-icon tt-clear-btn" data-date="${dateKey}" title="空にする" aria-label="空にする">🗑️</button>
                <button class="btn-icon tt-reset-btn" data-date="${dateKey}" title="ベースに戻す" aria-label="ベースに戻す">↩️</button>
            </td>`;
        });
        html += '</tr>';

        html += '</tbody></table>';
        container.innerHTML = html;

        // セルクリックイベント
        container.querySelectorAll('.tt-list-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                this._openSubjectPicker(cell.dataset.date, parseInt(cell.dataset.period), cell);
            });
        });

        // 一括削除ボタン
        container.querySelectorAll('.tt-clear-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._clearDaySchedule(btn.dataset.date);
            });
        });

        // ベースに戻すボタン
        container.querySelectorAll('.tt-reset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._resetDayToBase(btn.dataset.date);
            });
        });
    },

    /**
     * 科目選択ポップアップを開く
     */
    _openSubjectPicker(dateKey, period, cell) {
        document.querySelector('.subject-picker-popup')?.remove();

        const subjects = this.activeTimetable === 'class' ? this.classSubjects : this.mySubjects;

        const popup = document.createElement('div');
        popup.className = 'subject-picker-popup';
        popup.innerHTML = `
            <div class="subject-picker-header">科目を選択</div>
            <div class="subject-picker-list">
                <div class="subject-item" data-subject="">（空欄）</div>
                ${subjects.map(s => `<div class="subject-item" data-subject="${escapeHtml(s)}">${escapeHtml(s)}</div>`).join('')}
            </div>
        `;

        // 位置調整
        const rect = cell.getBoundingClientRect();
        popup.style.position = 'fixed';
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + 5}px`;

        document.body.appendChild(popup);

        // 科目選択
        popup.querySelectorAll('.subject-item').forEach(item => {
            item.addEventListener('click', () => {
                const subject = item.dataset.subject;
                this._setDayPeriodValue(dateKey, period, subject);
                popup.remove();
                // 保存後に一覧を再描画して反映確認
                this._renderTimetableList();
            });
        });

        // 外側クリックで閉じる
        setTimeout(() => {
            document.addEventListener('click', function closePopup(e) {
                if (!popup.contains(e.target) && e.target !== cell) {
                    popup.remove();
                    document.removeEventListener('click', closePopup);
                }
            });
        }, 0);
    },

    _setDayPeriodValue(dateKey, period, value) {
        if (!this.dailyChanges[this.activeTimetable]) {
            this.dailyChanges[this.activeTimetable] = {};
        }
        if (!this.dailyChanges[this.activeTimetable][dateKey]) {
            this.dailyChanges[this.activeTimetable][dateKey] = {};
        }
        // periodは0ベース（data-period属性のpをそのまま受け取る）
        this.dailyChanges[this.activeTimetable][dateKey][period] = value;
        this.saveData();
    },

    async _clearDaySchedule(dateKey) {
        if (!await UI.confirm(`${dateKey} の時間割を全て空にします。`, { title: '時間割を空にする', confirmLabel: '全て空にする', danger: true })) return;
        const data = window.StorageManager?.getCurrentData() || {};
        const periodsPerDay = data.appSettings?.periodsPerDay || { mon: 6, tue: 6, wed: 6, thu: 6, fri: 6 };
        const d = new Date(dateKey);
        const dayKey = WEEKDAY_KEYS[d.getDay()];
        const periods = periodsPerDay[dayKey] || 6;

        if (!this.dailyChanges[this.activeTimetable]) {
            this.dailyChanges[this.activeTimetable] = {};
        }
        this.dailyChanges[this.activeTimetable][dateKey] = {};
        for (let p = 0; p < periods; p++) {
            this.dailyChanges[this.activeTimetable][dateKey][p] = '';
        }
        this.saveData();
        this._renderTimetableList();
    },

    async _resetDayToBase(dateKey) {
        if (!await UI.confirm(`${dateKey} の時間割を、変更前のベースの時間割に戻します。`, { title: 'ベースに戻す', confirmLabel: 'ベースに戻す', danger: true })) return;
        if (this.dailyChanges[this.activeTimetable]) {
            delete this.dailyChanges[this.activeTimetable][dateKey];
        }
        this.saveData();
        this._renderTimetableList();
    },

    // 今週の時間割をA4横で印刷（メモ欄付き）
    printTimetableForWeek() {
        const weeks = this._generateWeeks(3);
        if (weeks.length === 0) return;

        const week = weeks[0];
        const appData = StorageManager.getCurrentData();
        // this.dailyChanges はロード済みの最新データ
        const dailyChanges = this.dailyChanges[this.activeTimetable] || {};
        const timetable = this.activeTimetable === 'my' ? this.myTimetable : this.classTimetable;

        // 用紙サイズ：A4横（210mm x 297mm）
        let html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>時間割印刷</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4 landscape; margin: 8mm; }
        body { font-family: 'Hiragino Sans', 'Arial', sans-serif; font-size: 11px; }

        /* 時間割テーブル */
        .tt-title { background: #4f46e5; color: white; padding: 4px 8px; font-weight: bold; font-size: 12px; border-radius: 4px 4px 0 0; }
        table.tt { width: 100%; border-collapse: collapse; border: 2px solid #333; border-top: none; table-layout: fixed; }
        table.tt td, table.tt th { border: 1px solid #bbb; padding: 3px 4px; vertical-align: middle; }
        table.tt th.day-head { text-align: center; font-size: 13px; background: #eef2ff; padding: 4px; }
        table.tt td.lbl { background: #f0f0f0; text-align: center; width: 58px; font-weight: bold; font-size: 11px; white-space: nowrap; }
        table.tt td.lbl .lbl-time { font-size: 8px; font-weight: normal; color: #666; display: block; }
        table.tt td.cell { background: #f8f9ff; font-size: 12px; font-weight: bold; }
        table.tt td.cell-empty { background: #f0f0f0; }
        table.tt td.cell-memo { background: #fff5f5; font-size: 11px; font-weight: bold; color: #dc2626; }
        table.tt td.cell-changed { background: #fffbeb; }
        table.tt td.cell-memo-overlay, .cell-memo-overlay { display: block; font-size: 11px; font-weight: bold; color: #dc2626; }
        table.tt tr.after td.lbl { background: #fef3c7; color: #92400e; border-top: 3px solid #333; }
        table.tt tr.after td { background: #fef9c3; border-top: 3px solid #333; font-size: 11px; color: #92400e; }
        table.tt tr.break-after td { border-bottom: 3px solid #333; }
        table.tt tr.before-class td { border-bottom: 3px solid #333; }

        /* メモ欄（時間割テーブルと列幅を揃えるためtable使用） */
        table.memo { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed; }
        table.memo td { border: 2px solid #333; padding: 4px 5px; vertical-align: top; height: 48mm; }
        table.memo td.memo-lbl { background: #f0f0f0; width: 58px; text-align: center; font-weight: bold; font-size: 11px; border-right: 2px solid #333; }
        table.memo th { border: 2px solid #333; background: #eef2ff; text-align: center; font-size: 13px; padding: 4px; }
        table.memo th.memo-lbl-head { width: 58px; background: #f0f0f0; border-right: 2px solid #333; }
        table.memo td.next-week { height: 10mm !important; vertical-align: top; padding: 3px 5px; font-size: 10px; color: #555; }

        /* ToDoリスト */
        .todo-section { margin-top: 6px; border: 1px solid #bbb; border-radius: 4px; padding: 5px 8px; }
        .todo-title { font-weight: bold; font-size: 11px; color: #444; margin-bottom: 4px; border-bottom: 1px solid #ddd; padding-bottom: 2px; }
        .todo-list { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 2px 8px; }
        .todo-item { font-size: 10px; display: flex; align-items: center; gap: 3px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .todo-item.important { color: #dc2626; font-weight: bold; }
        .todo-check { width: 10px; height: 10px; border: 1px solid #999; display: inline-block; border-radius: 2px; flex-shrink: 0; }
    </style>
</head>
<body>
`;

        // 月〜金を処理
        const dayKeys = SCHOOL_DAY_KEYS;
        const dayNames = ['月', '火', '水', '木', '金'];
        const weekKey = formatDate(week[0]);
        const typeMemos = (this.dashboardMemos[this.activeTimetable] || {})[weekKey] || {};
        const periodTimes = (appData.appSettings || {}).periodTimes || {};
        const maxPeriods = Math.max(...week.map(d => this._getPeriodCountForDay(d)));

        // 各曜日の日付・データを事前収集
        const dayData = week.slice(0, 5).map((date, dayIndex) => {
            const dayKey = dayKeys[dayIndex];
            const dateStr = formatDate(date);
            const periodCount = this._getPeriodCountForDay(date);
            const dayTimetable = timetable[dayKey] || [];
            const changedDay = dailyChanges[dateStr] || {};
            return { date, dayKey, dateStr, periodCount, dayTimetable, changedDay };
        });

        // 時間割テーブル
        html += `<div class="tt-title">時間割（${this.activeTimetable === 'my' ? '自分の時間割' : 'クラス時間割'}）</div>
        <table class="tt">
          <thead><tr>
            <th class="lbl" style="width:58px;"></th>`;

        dayData.forEach(({ date }, i) => {
            const m = date.getMonth() + 1, d = date.getDate();
            html += `<th class="day-head">${dayNames[i]} <span style="font-size:10px;font-weight:normal;">${m}/${d}</span></th>`;
        });
        html += `</tr></thead><tbody>`;

        // 登校前行（periodIndex=-1 で保存されている）
        html += `<tr class="after before-class"><td class="lbl">登校前</td>`;
        dayData.forEach(({ dateStr }) => {
            const beforeMemo = (typeMemos[dateStr] || {})[-1] || '';
            html += `<td>${escapeHtml(beforeMemo)}</td>`;
        });
        html += `</tr>`;

        // 時限行（優先: メモ > 時間割変更 > 基本時間割）
        for (let p = 1; p <= maxPeriods; p++) {
            const t = periodTimes[p] || {};
            const timeStr = t.start ? (t.end ? `${t.start}〜${t.end}` : t.start) : '';
            const breakClass = p === 4 ? ' break-after' : '';
            html += `<tr class="${breakClass}"><td class="lbl">${p}限${timeStr ? `<span class="lbl-time">${timeStr}</span>` : ''}</td>`;
            dayData.forEach(({ periodCount, dayTimetable, changedDay, dateStr }) => {
                if (p > periodCount) {
                    html += `<td class="cell-empty"></td>`;
                } else {
                    const base = dayTimetable[p - 1] || '';
                    const changed = changedDay[p - 1];
                    // 時間割変更があれば変更後、なければ基本
                    const subject = (changed !== undefined && changed !== null) ? changed : base;
                    const memo = (typeMemos[dateStr] || {})[p - 1];
                    const hasMemo = memo !== undefined && memo !== null && memo !== '';
                    const isChanged = (changed !== undefined && changed !== null && changed !== base);
                    if (hasMemo) {
                        // メモをオーバーレイ表示
                        html += `<td class="cell${isChanged ? ' cell-changed' : ''}" style="position:relative;">
                            <span style="color:#64748b;font-size:10px;">${escapeHtml(subject)}</span>
                            <span class="cell-memo-overlay">${escapeHtml(memo)}</span>
                        </td>`;
                    } else if (isChanged) {
                        html += `<td class="cell cell-changed">${escapeHtml(subject)}</td>`;
                    } else {
                        html += `<td class="cell">${escapeHtml(subject)}</td>`;
                    }
                }
            });
            html += `</tr>`;
        }

        // 放課後行（periodIndex=6 で保存されている）
        html += `<tr class="after"><td class="lbl">放課後</td>`;
        dayData.forEach(({ dateStr }) => {
            const afterMemo = (typeMemos[dateStr] || {})[6] || '';
            html += `<td>${escapeHtml(afterMemo)}</td>`;
        });
        html += `</tr></tbody></table>

        <!-- メモ欄（時間割と列幅を揃えたtable） -->
        <table class="memo">
          <thead><tr>
            <th class="memo-lbl-head"></th>`;

        dayData.forEach(({ date }, i) => {
            const m = date.getMonth() + 1, d = date.getDate();
            html += `<th>${dayNames[i]} ${m}/${d}</th>`;
        });
        html += `</tr></thead>
          <tbody><tr>
            <td class="memo-lbl">メモ</td>`;
        for (let i = 0; i < 5; i++) {
            html += `<td></td>`;
        }
        html += `</tr>`;

        // 次週の日付行
        const nextWeek = weeks[1] || [];
        const nextWeekKey = nextWeek[0] ? formatDate(nextWeek[0]) : null;
        const nextWeekMemos = nextWeekKey ? ((this.dashboardMemos[this.activeTimetable] || {})[nextWeekKey] || {}) : {};
        html += `<tr><td class="memo-lbl" style="font-size:10px;height:10mm;">来週</td>`;
        for (let i = 0; i < 5; i++) {
            if (nextWeek[i]) {
                const m = nextWeek[i].getMonth() + 1, d = nextWeek[i].getDate();
                const dateStr = formatDate(nextWeek[i]);
                const beforeMemo = (nextWeekMemos[dateStr] || {})[-1] || '';
                const memoHtml = beforeMemo ? `<br><span style="color:#dc2626;font-weight:bold;">${escapeHtml(beforeMemo)}</span>` : '';
                html += `<td style="border:2px solid #333;padding:3px 5px;vertical-align:top;height:10mm;font-size:10px;color:#555;">${dayNames[i]} ${m}/${d}${memoHtml}</td>`;
            } else {
                html += `<td style="border:2px solid #333;padding:3px 5px;vertical-align:top;height:10mm;font-size:10px;color:#555;"></td>`;
            }
        }
        html += `</tr>`;

        // 再来週の日付行
        const weekAfterNext = weeks[2] || [];
        const weekAfterNextKey = weekAfterNext[0] ? formatDate(weekAfterNext[0]) : null;
        const weekAfterNextMemos = weekAfterNextKey ? ((this.dashboardMemos[this.activeTimetable] || {})[weekAfterNextKey] || {}) : {};
        html += `<tr><td class="memo-lbl" style="font-size:10px;height:10mm;">再来週</td>`;
        for (let i = 0; i < 5; i++) {
            if (weekAfterNext[i]) {
                const m = weekAfterNext[i].getMonth() + 1, d = weekAfterNext[i].getDate();
                const dateStr = formatDate(weekAfterNext[i]);
                const beforeMemo = (weekAfterNextMemos[dateStr] || {})[-1] || '';
                const memoHtml = beforeMemo ? `<br><span style="color:#dc2626;font-weight:bold;">${escapeHtml(beforeMemo)}</span>` : '';
                html += `<td style="border:2px solid #333;padding:3px 5px;vertical-align:top;height:10mm;font-size:10px;color:#555;">${dayNames[i]} ${m}/${d}${memoHtml}</td>`;
            } else {
                html += `<td style="border:2px solid #333;padding:3px 5px;vertical-align:top;height:10mm;font-size:10px;color:#555;"></td>`;
            }
        }
        html += `</tr></tbody></table>`;

        const todos = (appData.todos || []).filter(t => t.type !== 'separator' && !t.completed);
        if (todos.length > 0) {
            html += `<div class="todo-section"><div class="todo-title">✅ ToDoリスト（未完了）</div><div class="todo-list">`;
            todos.forEach(todo => {
                const cls = todo.important ? 'todo-item important' : 'todo-item';
                const due = todo.dueDate ? ` (${escapeHtml(todo.dueDate)})` : '';
                html += `<div class="${cls}"><span class="todo-check"></span>${escapeHtml(todo.text)}${due}</div>`;
            });
            html += `</div></div>`;
        }

        html += `</body></html>`;

        printHtmlInNewWindow(html, 'width=1200,height=800');
    },

    // 指定日の時限数を取得（設定から）
    _getPeriodCountForDay(date) {
        const data = StorageManager.getCurrentData();
        const settings = data.appSettings || {};
        const periodsPerDay = settings.periodsPerDay || {};
        const dayOfWeek = date.getDay();
        const dayName = WEEKDAY_KEYS[dayOfWeek];
        return periodsPerDay[dayName] || 6;
    }
};

if (typeof window !== 'undefined') {
    window.ScheduleModule = ScheduleModule;
}
