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
            classroomBtn.addEventListener('click', () => {
                this.viewMode = 'classroom';
                classroomBtn.classList.add('active');
                teacherBtn.classList.remove('active');
                classroomBtn.style.background = 'white';
                teacherBtn.style.background = 'transparent';
                this.render();
            });

            teacherBtn.addEventListener('click', () => {
                this.viewMode = 'teacher';
                teacherBtn.classList.add('active');
                classroomBtn.classList.remove('active');
                teacherBtn.style.background = 'white';
                classroomBtn.style.background = 'transparent';
                this.render();
            });
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
     * 授業担当モードの描画
     */
    renderTeacherMode() {
        const ttContainer = document.getElementById('timetableGrid');
        const summaryContainer = document.getElementById('attendanceSummary');
        if (!ttContainer || !summaryContainer) return;

        // 1. 自分の時間割を表示
        const sm = window.ScheduleModule;
        if (sm) {
            sm.loadData?.(); // 最新データをロード
            const timetable = sm.myTimetable || {};
            const days = ['月', '火', '水', '木', '金'];
            const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri'];

            let html = '<h4>自分の担当授業 (通常)</h4>';
            html += '<table class="timetable-table"><thead><tr><th></th>';
            days.forEach(d => html += `<th>${d}</th>`);
            html += '</tr></thead><tbody>';

            for (let p = 1; p <= 6; p++) {
                html += `<tr><th>${p}限</th>`;
                dayKeys.forEach(d => {
                    html += `<td>${timetable[d]?.[p - 1] || ''}</td>`;
                });
                html += '</tr>';
            }
            html += '</tbody></table>';
            ttContainer.innerHTML = html;
        }

        // 2. 統計情報を表示 (期間指定付き)
        this.renderTeacherStatsHeader(summaryContainer);
        this.renderTeacherStatsResults();
    },

    /**
     * 授業担当統計のヘッダー（期間指定）を描画
     */
    renderTeacherStatsHeader(container) {
        // デフォルト期間: 今月の初めから今日まで
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startStr = this._formatDateForInput(startOfMonth);
        const endStr = this._formatDateForInput(now);

        let html = '<div class="teacher-stats-section">';
        html += '<h3>授業担当統計（期間指定）</h3>';
        html += `
            <div class="stats-controls" style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <label style="font-size: 0.9em; font-weight: bold;">集計期間:</label>
                <input type="date" id="statsStartDate" class="form-control" value="${startStr}" style="padding: 5px 10px; border-radius: 4px; border: 1px solid #cbd5e1;">
                <span>〜</span>
                <input type="date" id="statsEndDate" class="form-control" value="${endStr}" style="padding: 5px 10px; border-radius: 4px; border: 1px solid #cbd5e1;">
                <button class="btn btn-primary" id="calculateStatsBtn" style="padding: 5px 15px;">集計実行</button>
            </div>
        `;
        html += '<div id="statsResultsArea"></div>';
        html += '</div>';

        container.innerHTML = html;

        // イベントリスナー
        document.getElementById('calculateStatsBtn')?.addEventListener('click', () => {
            this.renderTeacherStatsResults();
        });
    },

    /**
     * 指定された期間の授業時数を集計して表示
     */
    renderTeacherStatsResults() {
        const startInput = document.getElementById('statsStartDate');
        const endInput = document.getElementById('statsEndDate');
        const resultsArea = document.getElementById('statsResultsArea');
        if (!startInput || !endInput || !resultsArea) return;

        const startDate = new Date(startInput.value);
        const endDate = new Date(endInput.value);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            resultsArea.innerHTML = '<p style="color: red;">正しい日付を入力してください。</p>';
            return;
        }

        if (startDate > endDate) {
            resultsArea.innerHTML = '<p style="color: red;">開始日は終了日より前の日付にしてください。</p>';
            return;
        }

        const stats = this.calculateTeacherTally(startDate, endDate);

        let html = '<div class="teacher-schedule-stats">';

        const sortedSubjects = Object.keys(stats.subjects).sort();
        sortedSubjects.forEach(sub => {
            html += `
                <div class="stat-card">
                    <div class="stat-label">${escapeHtml(sub)}</div>
                    <div class="stat-value">${stats.subjects[sub]}</div>
                    <div class="stat-label">コマ</div>
                </div>
            `;
        });

        if (sortedSubjects.length === 0) {
            html += '<p style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 20px;">指定された期間内に担当授業はありませんでした。</p>';
        }

        html += `
            <div class="stat-card" style="background: #f1f5f9; border-color: #3b82f6;">
                <div class="stat-label" style="color: #3b82f6; font-weight: bold;">総授業数</div>
                <div class="stat-value" style="color: #1e293b;">${stats.total}</div>
                <div class="stat-label">コマ</div>
            </div>
        `;

        html += '</div>';
        html += `<p style="font-size: 0.8em; color: #64748b; margin-top: 15px;">※集計基準: 「時間割一覧／変更（自分）」のデータを使用しています。</p>`;

        resultsArea.innerHTML = html;
    },

    /**
     * 期間内の授業コマ数を計算
     */
    calculateTeacherTally(startDate, endDate) {
        const sm = window.ScheduleModule;
        if (!sm) return { subjects: {}, total: 0 };

        const stats = { subjects: {}, total: 0 };
        const myTimetable = sm.myTimetable || {};
        const dailyChanges = sm.dailyChanges?.my || {};

        // 曜日ごとの時限数設定を取得
        const data = window.StorageManager?.getCurrentData() || {};
        const periodsPerDay = data.appSettings?.periodsPerDay || { mon: 6, tue: 6, wed: 6, thu: 6, fri: 6, sat: 0, sun: 0 };

        let curr = new Date(startDate);
        while (curr <= endDate) {
            const dateStr = this._formatDateForInput(curr);
            const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][curr.getDay()];
            const periods = periodsPerDay[dayKey] || 0;

            if (periods > 0) {
                for (let p = 1; p <= periods; p++) {
                    let subject = '';

                    // 1. 個別の変更があるか確認 (0-based)
                    if (dailyChanges[dateStr] && dailyChanges[dateStr][p - 1] !== undefined) {
                        subject = dailyChanges[dateStr][p - 1];
                    } else {
                        // 2. 通常の時間割を確認
                        if (dayKey !== 'sun' && dayKey !== 'sat') {
                            subject = myTimetable[dayKey]?.[p - 1] || '';
                        }
                    }

                    if (subject && subject.trim()) {
                        const s = subject.trim();
                        stats.subjects[s] = (stats.subjects[s] || 0) + 1;
                        stats.total++;
                    }
                }
            }

            curr.setDate(curr.getDate() + 1);
        }

        return stats;
    },

    _formatDateForInput(date) {
        const y = date.getFullYear();
        const m = ('0' + (date.getMonth() + 1)).slice(-2);
        const d = ('0' + date.getDate()).slice(-2);
        return `${y}-${m}-${d}`;
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
            const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri'];
            let html = '<table class="timetable-table"><thead><tr><th></th>';
            days.forEach(d => html += `<th>${d}</th>`);
            html += '</tr></thead><tbody>';

            for (let p = 1; p <= 6; p++) {
                html += `<tr><th>${p}限</th>`;
                dayKeys.forEach(d => {
                    html += `<td>${timetable[d]?.[p - 1] || ''}</td>`;
                });
                html += '</tr>';
            }
            html += '</tbody></table>';
            container.innerHTML = html;
        }
    },

    /**
     * 出欠サマリー描画
     */
    renderAttendanceSummary() {
        const container = document.getElementById('attendanceSummary');
        if (!container) return;

        const data = window.StorageManager?.getCurrentData() || {};
        const students = data.students || [];

        const credits = this.calculateSubjectCredits();
        const subjectNames = Object.keys(credits).sort();

        let html = '<div class="attendance-summary-wrapper" style="overflow-x: auto;">';
        html += '<div style="margin-bottom: 15px; font-weight: bold;">生徒をクリックして出欠を入力してください</div>';

        html += '<table class="attendance-table"><thead><tr>';
        html += '<th style="width: 80px;">番号</th><th style="width: 120px;">氏名</th>';

        subjectNames.forEach(sub => {
            html += `<th title="${sub} (単位: ${credits[sub]})">${sub}<br><span style="font-size:0.8em">(${credits[sub]})</span></th>`;
        });
        html += '</tr></thead><tbody>';

        students.forEach(student => {
            const absenceCounts = this.calculateAbsenceCounts(student.id);

            let rowHtml = `<tr class="student-row" data-id="${student.id}" style="cursor: pointer;">`;
            rowHtml += `<td>${escapeHtml(student.number)}</td>`;
            rowHtml += `<td>${escapeHtml(student.nameKanji)}</td>`;

            subjectNames.forEach(sub => {
                const count = absenceCounts[sub] || 0;
                const credit = credits[sub];
                const limitWarn = credit * 7;
                const limitStrong = credit * 9;
                const limitRetain = credit * 11;

                let cellClass = '';
                let cellStyle = '';

                if (count > limitRetain) {
                    cellClass = 'cell-retention tr-retention';
                    cellStyle = 'text-align: center; font-weight: bold;';
                } else if (count > limitStrong) {
                    cellClass = 'cell-strong-warning tr-strong-warning';
                    cellStyle = 'text-align: center; font-weight: bold; color: #b91c1c;';
                } else if (count > limitWarn) {
                    cellClass = 'cell-warning tr-warning';
                    cellStyle = 'text-align: center; font-weight: bold; color: #854d0e;';
                } else {
                    cellStyle = 'text-align: center;';
                }

                const remaining = limitRetain - count;
                const remainingText = remaining >= 0 ? `あと${remaining}` : '留年';

                rowHtml += `<td class="${cellClass}" style="${cellStyle}">
                    <div style="font-size: 1.1em;">${count}</div>
                    <div style="font-size: 0.7em; opacity: 0.8;">${remainingText}</div>
                </td>`;
            });
            rowHtml += '</tr>';
            html += rowHtml;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        container.querySelectorAll('.student-row').forEach(row => {
            row.addEventListener('click', () => {
                const student = students.find(s => s.id === row.dataset.id);
                if (student) this.openStudentAttendanceModal(student);
            });
        });
    },

    calculateSubjectCredits() {
        const sm = window.ScheduleModule;
        const timetable = sm ? sm.classTimetable : { mon: [], tue: [], wed: [], thu: [], fri: [] };
        const credits = {};

        Object.values(timetable).forEach(periods => {
            periods.forEach(sub => {
                if (sub) {
                    credits[sub] = (credits[sub] || 0) + 1;
                }
            });
        });
        return credits;
    },

    calculateAbsenceCounts(studentId) {
        const counts = {};
        const records = this.attendance[studentId] || {};
        const sm = window.ScheduleModule;

        if (!sm) return counts;

        Object.entries(records).forEach(([dateStr, record]) => {
            const date = new Date(dateStr);
            const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];
            if (dayKey === 'sun' || dayKey === 'sat') return;

            const baseSchedule = sm.classTimetable[dayKey] || [];
            const changes = sm.dailyChanges?.class?.[dateStr] || {};

            record.periods.forEach(periodNum => {
                const periodIndex = periodNum - 1;
                let subject = changes[periodIndex] !== undefined ? changes[periodIndex] : baseSchedule[periodIndex];
                if (!subject && baseSchedule[periodIndex]) subject = baseSchedule[periodIndex];

                if (subject) {
                    counts[subject] = (counts[subject] || 0) + 1;
                }
            });
        });

        return counts;
    },

    /**
     * 生徒の出欠入力モーダルを開く
     */
    openStudentAttendanceModal(student) {
        const modal = document.createElement('div');
        modal.id = 'attendanceModal';
        modal.className = 'modal active';

        const today = new Date();
        let currentYear = today.getFullYear();
        let currentMonth = today.getMonth();

        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3>${escapeHtml(student.number)} ${escapeHtml(student.nameKanji)} の出欠記録</h3>
                    <button class="modal-close" id="closeAttModal">✕</button>
                </div>
                <div class="modal-body">
                    <div class="calendar-controls">
                        <div class="calendar-nav-group">
                            <button class="btn btn-sm btn-secondary" id="jumpPrevBtn" title="6ヶ月前">◀◀ 6ヶ月</button>
                            <button class="btn btn-sm" id="prevMonthBtn">◀ 前月</button>
                        </div>
                        <div class="calendar-nav-group">
                            <select id="monthJumpSelect" class="calendar-jump-select"></select>
                            <h4 id="calendarTitle" style="margin: 0; min-width: 120px; text-align: center;"></h4>
                        </div>
                        <div class="calendar-nav-group">
                            <button class="btn btn-sm" id="nextMonthBtn">次月 ▶</button>
                            <button class="btn btn-sm btn-secondary" id="jumpNextBtn" title="6ヶ月後">6ヶ月 ▶▶</button>
                        </div>
                        <label class="calendar-lock-toggle" id="lockMonthLabel">
                            <input type="checkbox" id="lockMonthCheck"> 月ロック
                        </label>
                    </div>
                    <div id="attendanceCalendar" class="attendance-calendar-grid">
                        <!-- カレンダー描画 -->
                    </div>
                    <div style="font-size: 0.9em; color: #666; text-align: right;">
                        ※日付をクリックして詳細を入力（ロック中は編集不可）
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const monthSelect = document.getElementById('monthJumpSelect');
        const updateMonthSelect = () => {
            monthSelect.innerHTML = '';
            // 直近2年分くらいを表示
            for (let i = -12; i <= 12; i++) {
                const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
                const opt = document.createElement('option');
                opt.value = `${d.getFullYear()}-${d.getMonth()}`;
                opt.textContent = `${d.getFullYear()}年${d.getMonth() + 1}月`;
                if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
                    opt.selected = true;
                }
                monthSelect.appendChild(opt);
            }
        };

        const renderCalendar = () => {
            const container = document.getElementById('attendanceCalendar');
            const title = document.getElementById('calendarTitle');
            const lockCheck = document.getElementById('lockMonthCheck');
            const lockLabel = document.getElementById('lockMonthLabel');
            if (!container || !title) return;

            const monthKey = `${currentYear}-${currentMonth}`;
            const isLocked = !!this.lockedMonths[monthKey];

            title.textContent = `${currentYear}年 ${currentMonth + 1}月`;
            lockCheck.checked = isLocked;
            lockLabel.classList.toggle('active', isLocked);

            container.innerHTML = '';
            updateMonthSelect();

            ['日', '月', '火', '水', '木', '金', '土'].forEach(day => {
                const div = document.createElement('div');
                div.className = 'calendar-header-cell';
                div.textContent = day;
                if (day === '日') div.style.color = '#ef4444';
                if (day === '土') div.style.color = '#3b82f6';
                container.appendChild(div);
            });

            const firstDay = new Date(currentYear, currentMonth, 1);
            const lastDay = new Date(currentYear, currentMonth + 1, 0);

            for (let i = 0; i < firstDay.getDay(); i++) {
                const empty = document.createElement('div');
                empty.className = 'calendar-day-cell empty';
                container.appendChild(empty);
            }

            for (let d = 1; d <= lastDay.getDate(); d++) {
                const dateObj = new Date(currentYear, currentMonth, d);
                const dateStr = this._formatDate(dateObj);
                const dayOfWeek = dateObj.getDay();

                const cell = document.createElement('div');
                cell.className = 'calendar-day-cell';
                if (dayOfWeek === 0) cell.classList.add('weekend-sun');
                if (dayOfWeek === 6) cell.classList.add('weekend-sat');
                if (isLocked) cell.classList.add('locked');

                const label = document.createElement('div');
                label.className = 'calendar-date-label';
                label.textContent = d;
                cell.appendChild(label);

                const record = this.attendance[student.id]?.[dateStr];
                if (record) {
                    const badges = document.createElement('div');
                    badges.className = 'attendance-badges';

                    if (record.periods.length === 6) {
                        badges.innerHTML = `<span class="att-badge absent">全日欠席</span>`;
                    } else if (record.periods.length > 0) {
                        badges.innerHTML = `<span class="att-badge late">${record.periods.length}コマ欠</span>`;
                    }
                    cell.appendChild(badges);
                }

                if (!isLocked) {
                    cell.addEventListener('click', () => {
                        this.openDayDetailModal(student, dateObj, () => {
                            renderCalendar();
                        });
                    });
                }

                container.appendChild(cell);
            }
        };

        renderCalendar();

        document.getElementById('prevMonthBtn').addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 0) { currentMonth = 11; currentYear--; }
            renderCalendar();
        });
        document.getElementById('nextMonthBtn').addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 11) { currentMonth = 0; currentYear++; }
            renderCalendar();
        });
        document.getElementById('jumpPrevBtn').addEventListener('click', () => {
            currentMonth -= 6;
            while (currentMonth < 0) { currentMonth += 12; currentYear--; }
            renderCalendar();
        });
        document.getElementById('jumpNextBtn').addEventListener('click', () => {
            currentMonth += 6;
            while (currentMonth > 11) { currentMonth -= 12; currentYear++; }
            renderCalendar();
        });

        monthSelect.addEventListener('change', (e) => {
            const [y, m] = e.target.value.split('-').map(Number);
            currentYear = y;
            currentMonth = m;
            renderCalendar();
        });

        document.getElementById('lockMonthCheck').addEventListener('change', (e) => {
            const monthKey = `${currentYear}-${currentMonth}`;
            if (e.target.checked) {
                this.lockedMonths[monthKey] = true;
            } else {
                delete this.lockedMonths[monthKey];
            }
            this.saveData();
            renderCalendar();
        });

        document.getElementById('closeAttModal').addEventListener('click', () => {
            modal.remove();
            this.render();
        });
    },

    openDayDetailModal(student, date, onClose) {
        const dateStr = this._formatDate(date);
        const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()];

        const sm = window.ScheduleModule;
        const baseSchedule = sm.classTimetable[dayKey] || [];
        const changes = sm.dailyChanges?.class?.[dateStr] || {};

        const subjects = [];
        for (let i = 0; i < 6; i++) {
            subjects[i] = changes[i] !== undefined ? changes[i] : (baseSchedule[i] || '—');
        }

        const currentRecord = this.attendance[student.id]?.[dateStr] || { periods: [] };

        const modal = document.createElement('div');
        modal.id = 'dayDetailModal';
        modal.className = 'modal active';
        modal.style.zIndex = '1001';

        let periodsHtml = '';
        for (let i = 1; i <= 6; i++) {
            const isAbsent = currentRecord.periods.includes(i);
            const sub = subjects[i - 1];
            periodsHtml += `
                <div class="period-toggle-btn ${isAbsent ? 'active' : ''}" data-period="${i}" onclick="this.classList.toggle('active')">
                    <div class="period-num">${i}限</div>
                    <div class="period-subject">${escapeHtml(sub)}</div>
                    <div style="font-size:0.8em; margin-top:5px;">${isAbsent ? '欠席' : '出席'}</div>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${date.getMonth() + 1}/${date.getDate()} の詳細入力</h3>
                    <button class="modal-close" id="closeDayDetail">✕</button>
                </div>
                <div class="modal-body">
                    <div style="display: flex; justify-content: center; margin-bottom: 20px;">
                        <button class="btn btn-danger" id="markAllAbsentBtn" style="min-width: 200px;">本日は全日欠席</button>
                        <button class="btn btn-secondary" id="markAllPresentBtn" style="margin-left: 10px;">出席扱いに戻す</button>
                    </div>
                    <p style="text-align: center; margin-bottom: 10px;">欠席・遅刻・早退した授業をクリックして赤くしてください</p>
                    <div class="period-detail-grid">
                        ${periodsHtml}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="saveDayDetailBtn">保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const toggleAll = (absent) => {
            const btns = modal.querySelectorAll('.period-toggle-btn');
            btns.forEach(btn => {
                if (absent) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        };

        document.getElementById('markAllAbsentBtn').addEventListener('click', () => toggleAll(true));
        document.getElementById('markAllPresentBtn').addEventListener('click', () => toggleAll(false));
        document.getElementById('closeDayDetail').addEventListener('click', () => modal.remove());

        document.getElementById('saveDayDetailBtn').addEventListener('click', () => {
            const activePeriods = [];
            modal.querySelectorAll('.period-toggle-btn.active').forEach(btn => {
                activePeriods.push(parseInt(btn.dataset.period));
            });

            if (!this.attendance[student.id]) this.attendance[student.id] = {};

            if (activePeriods.length === 0) {
                if (this.attendance[student.id][dateStr]) {
                    delete this.attendance[student.id][dateStr];
                }
            } else {
                this.attendance[student.id][dateStr] = {
                    type: 'mixed',
                    periods: activePeriods,
                    memo: ''
                };
            }

            this.saveData();
            modal.remove();
            if (onClose) onClose();
        });
    },

    _formatDate(date) {
        const y = date.getFullYear();
        const m = ('0' + (date.getMonth() + 1)).slice(-2);
        const d = ('0' + date.getDate()).slice(-2);
        return `${y}-${m}-${d}`;
    },

    saveData() {
        const data = window.StorageManager?.getCurrentData() || {};
        if (!data.attendance) data.attendance = {};
        data.attendance.records = this.attendance;
        data.attendance.lockedMonths = this.lockedMonths;
        window.StorageManager?.updateCurrentData(data);
    },

    loadData() {
        const data = window.StorageManager?.getCurrentData() || {};
        this.attendance = data.attendance?.records || {};
        this.lockedMonths = data.attendance?.lockedMonths || {};
    }
};

if (typeof window !== 'undefined') {
    window.AttendanceModule = AttendanceModule;
}
