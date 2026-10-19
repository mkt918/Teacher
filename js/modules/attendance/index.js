/**
 * AttendanceModule - 時間割・出欠管理ツール (Extended Advanced Version)
 * 
 * 機能:
 * - 単位数ベースの欠席管理（単位数 × 7/9/11警告）
 * - 授業（コマ）ごとの精密な欠席登録
 * - 週間時間割＋日々の変更を反映した正確な出欠確認
 * - 月別ロック機能＆高度なナビゲーション（前後6ヶ月ジャンプ、月直接指定）
 */

const AttendanceModule = {
    name: 'AttendanceModule',
    initialized: false,
    viewMode: 'classroom', // 'classroom' or 'teacher'


    // 出欠データ構造
    // { studentId: { "YYYY-MM-DD": { type: 'absent/late/early', periods: [1, 2], memo: '' } } }
    attendance: {},

    // ロックされた月 { "YYYY-MM": true }
    lockedMonths: {},

    // 手動で「要注意」フラグを付けた生徒 { studentId: true }
    flaggedStudents: {},

    /**
     * 初期化
     */
    init() {
        if (this.initialized) return;
        this.setupEventListeners();
        this.loadData();
        this.initialized = true;
        console.log('📊 AttendanceModule initialized (Extended)');
    },

    setupEventListeners() {
        // 既存のイベントリスナー
        const printBtn = document.getElementById('printAttendanceBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => this.printAttendance());
        }

        // モード切替
        const classroomBtn = document.getElementById('classroomModeBtn');
        const teacherBtn = document.getElementById('teacherModeBtn');

        if (classroomBtn && teacherBtn) {
            const switchMode = (mode) => {
                this.viewMode = mode;
                classroomBtn.classList.toggle('active', mode === 'classroom');
                teacherBtn.classList.toggle('active', mode === 'teacher');
                classroomBtn.setAttribute('aria-pressed', String(mode === 'classroom'));
                teacherBtn.setAttribute('aria-pressed', String(mode === 'teacher'));
                this.render();
            };
            classroomBtn.addEventListener('click', () => switchMode('classroom'));
            teacherBtn.addEventListener('click', () => switchMode('teacher'));
        }
    },

    /**
     * 描画
     */
    render() {
        this.loadData();

        // 担任モードか授業担当モードかで表示を切り替え
        if (this.viewMode === 'teacher') {
            this.renderTeacherMode();
        } else {
            this.renderTimetable();
            this.renderAttendanceSummary();
        }
    },

    /**
     * 時間割を参照用に表示
     */
    renderTimetable() {
        const container = document.getElementById('timetableGrid');
        if (!container) return;

        const sm = window.ScheduleModule;
        if (sm) {
            sm.loadData?.(); // 確実に最新を読み込む
            const timetable = sm.classTimetable || {};
            const days = ['月', '火', '水', '木', '金'];
            const dayKeys = SCHOOL_DAY_KEYS;

            const settingsData = window.StorageManager?.getCurrentData() || {};
            const periodsPerDay = settingsData.appSettings?.periodsPerDay || { mon: 6, tue: 6, wed: 6, thu: 6, fri: 6, sat: 0, sun: 0 };
            const maxPeriods = Math.max(...dayKeys.map(d => periodsPerDay[d] || 0), 1);

            let html = '<table class="timetable-table"><thead><tr><th></th>';
            days.forEach(d => html += `<th>${d}</th>`);
            html += '</tr></thead><tbody>';

            for (let p = 1; p <= maxPeriods; p++) {
                html += `<tr><th>${p}限</th>`;
                dayKeys.forEach(d => {
                    html += `<td>${escapeHtml(timetable[d]?.[p - 1] || '')}</td>`;
                });
                html += '</tr>';
            }
            html += '</tbody></table>';
            
            if (window.CoreDOM) {
                window.CoreDOM.updateDOMWithState(container, html);
            } else {
                container.innerHTML = html;
            }
        }
    },

    saveData() {
        const data = window.StorageManager?.getCurrentData() || {};
        if (!data.attendance) data.attendance = {};
        data.attendance.records = this.attendance;
        data.attendance.lockedMonths = this.lockedMonths;
        data.attendance.flaggedStudents = this.flaggedStudents;
        window.StorageManager?.updateCurrentData(data);
    },

    loadData() {
        const data = window.StorageManager?.getCurrentData() || {};
        this.attendance = data.attendance?.records || {};
        this.lockedMonths = data.attendance?.lockedMonths || {};
        this.flaggedStudents = data.attendance?.flaggedStudents || {};
    },

    // 手動で「要注意」フラグを切り替える
    toggleFlaggedStudent(studentId) {
        if (!this.flaggedStudents) this.flaggedStudents = {};
        if (this.flaggedStudents[studentId]) {
            delete this.flaggedStudents[studentId];
        } else {
            this.flaggedStudents[studentId] = true;
        }
        this.saveData();
    }
};

if (typeof window !== 'undefined') {
    window.AttendanceModule = AttendanceModule;
}
