// ===== 出欠モジュール: 授業担当モード =====
// 授業担当モードの描画、期間ごとの集計、授業日CSVの書き出し。
// 本体(AttendanceModule)は index.js。このファイルは index.js より後に読み込むこと。

Object.assign(AttendanceModule, {

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
            const dayKeys = SCHOOL_DAY_KEYS;

            const settingsData = window.StorageManager?.getCurrentData() || {};
            // 最大時限数 (放課後を含めるため7固定とする)
            const maxPeriods = 7;

            let html = '<h4>自分の担当授業 (通常)</h4>';
            html += '<table class="timetable-table"><thead><tr><th></th>';
            days.forEach(d => html += `<th>${d}</th>`);
            html += '</tr></thead><tbody>';

            for (let p = 1; p <= maxPeriods; p++) {
                let periodLabel = (p === 7) ? '放課後' : `${p}限`;
                html += `<tr><th class="${p === 7 ? 'tt-after-school' : ''}">${periodLabel}</th>`;
                dayKeys.forEach(d => {
                    html += `<td>${escapeHtml(timetable[d]?.[p - 1] || '')}</td>`;
                });
                html += '</tr>';
            }
            html += '</tbody></table>';
            
            if (window.CoreDOM) {
                window.CoreDOM.updateDOMWithState(ttContainer, html);
            } else {
                ttContainer.innerHTML = html;
            }
        }

        // 2. 統計情報を表示 (期間指定付き)
        this.renderTeacherStatsHeader(summaryContainer);
        this.renderTeacherStatsResults();
    },

    /**
     * 授業担当統計のヘッダー（期間指定）を描画
     */
    renderTeacherStatsHeader(container) {
        // デフォルト期間: 設定された年度の4月1日～今日
        const now = new Date();
        const fiscalYear = getFiscalYear();
        const fiscalStart = new Date(fiscalYear, 3, 1); // 4月1日
        const startStr = formatDate(fiscalStart);
        const endStr = formatDate(now);

        let html = '<div class="teacher-stats-section">';
        html += '<h3>授業担当統計（期間指定）</h3>';
        html += `
            <div class="stats-controls">
                <label for="statsStartDate">集計期間:</label>
                <input type="date" id="statsStartDate" class="form-control" value="${startStr}">
                <span>〜</span>
                <input type="date" id="statsEndDate" class="form-control" value="${endStr}" aria-label="集計期間の終了日">
                <button class="btn btn-primary" id="calculateStatsBtn">集計実行</button>
                <button class="btn btn-secondary" id="exportLessonCsvBtn" title="基本の時間割（自分）から、期間内の授業日を科目ごとの表にしてCSV出力します">📥 授業日をCSV出力</button>
            </div>
        `;
        html += '<div id="statsResultsArea"></div>';
        html += '</div>';

        if (window.CoreDOM) {
            window.CoreDOM.updateDOMWithState(container, html);
        } else {
            container.innerHTML = html;
        }

        // イベントリスナー
        const btn = document.getElementById('calculateStatsBtn');
        if (btn && !btn.dataset.bound) {
            btn.addEventListener('click', () => {
                this.renderTeacherStatsResults();
            });
            btn.dataset.bound = 'true';
        }

        document.getElementById('exportLessonCsvBtn')?.addEventListener('click', () => {
            this.exportTeacherLessonCsv();
        });
    },

    /**
     * 画面で指定した期間について、自分の基本時間割の授業日をCSV出力する
     */
    exportTeacherLessonCsv() {
        const startVal = document.getElementById('statsStartDate')?.value;
        const endVal = document.getElementById('statsEndDate')?.value;
        if (!startVal || !endVal) {
            UI.toast('集計期間（開始日と終了日）を入力してください', 'error');
            return;
        }
        if (startVal > endVal) {
            UI.toast('開始日は終了日より前の日付にしてください', 'error');
            return;
        }

        const csv = this.buildTeacherLessonCsv(startVal, endVal);
        if (!csv) {
            UI.toast('自分の時間割に授業が登録されていません。「時間割設定」で登録してください', 'info');
            return;
        }
        downloadTextFile(csv, `授業日一覧_${startVal}_${endVal}.csv`, 'text/csv');
    },

    /**
     * 自分の基本時間割をもとに、期間内の授業日を科目ごとの表（CSV文字列）にする。
     * 列は「週の中の1コマ」ごと（例: 月3限・月4限・金1限）、行は期間内の該当曜日の日付。
     * 授業が1コマも無ければ空文字を返す。
     * @param {string} startStr - 'YYYY-MM-DD'
     * @param {string} endStr - 'YYYY-MM-DD'
     */
    buildTeacherLessonCsv(startStr, endStr) {
        const toLocalDate = (str) => {
            const [y, m, d] = str.split('-').map(Number);
            return new Date(y, m - 1, d);
        };
        const start = toLocalDate(startStr);
        const end = toLocalDate(endStr);

        // 科目ごとに、週の中のコマ（曜日→時限の順）を集める
        const myTimetable = window.ScheduleModule?.myTimetable || {};
        const slotsBySubject = {};
        SCHOOL_DAY_KEYS.forEach((dayKey, dayIndex) => {
            (myTimetable[dayKey] || []).forEach((subject, periodIndex) => {
                const name = (subject || '').trim();
                if (!name) return;
                if (!slotsBySubject[name]) slotsBySubject[name] = [];
                slotsBySubject[name].push({ weekday: dayIndex + 1, period: periodIndex + 1 });
            });
        });

        const subjects = Object.keys(slotsBySubject).sort((a, b) => a.localeCompare(b, 'ja'));
        if (subjects.length === 0) return '';

        // 曜日ごとの該当日付（期間内）。同じ曜日のコマが複数あっても1回だけ計算する
        const datesByWeekday = {};
        const datesOf = (weekday) => {
            if (!datesByWeekday[weekday]) {
                const list = [];
                const cur = new Date(start);
                while (cur <= end) {
                    if (cur.getDay() === weekday) list.push(formatDate(cur));
                    cur.setDate(cur.getDate() + 1);
                }
                datesByWeekday[weekday] = list;
            }
            return datesByWeekday[weekday];
        };

        // 先頭のBOMはExcelでの文字化け防止
        let csv = '﻿';
        csv += `期間,${startStr},${endStr}\n`;
        subjects.forEach(subject => {
            const slots = slotsBySubject[subject];
            const columns = slots.map(s => datesOf(s.weekday));
            const total = columns.reduce((sum, dates) => sum + dates.length, 0);
            const rowCount = Math.max(...columns.map(dates => dates.length));

            const periodLabel = (p) => (p === 7 ? '放課後' : `${p}限`);
            const header = ['回数', ...slots.map(s => `${WEEKDAY_LABELS[s.weekday]}${periodLabel(s.period)}`)];

            csv += `\n${csvEscape(subject)}（全${total}コマ）\n`;
            csv += header.map(csvEscape).join(',') + '\n';
            for (let i = 0; i < rowCount; i++) {
                const cells = [`${i + 1}回目`, ...columns.map(dates => dates[i] || '')];
                csv += cells.map(csvEscape).join(',') + '\n';
            }
        });
        return csv;
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
            resultsArea.innerHTML = '<p class="form-error">正しい日付を入力してください。</p>';
            return;
        }

        if (startDate > endDate) {
            resultsArea.innerHTML = '<p class="form-error">開始日は終了日より前の日付にしてください。</p>';
            return;
        }

        const stats = this.calculateTeacherTally(startDate, endDate);

        let html = '<div class="teacher-schedule-stats">';

        const sortedSubjects = Object.keys(stats.subjects).sort();
        sortedSubjects.forEach(sub => {
            html += `
                <div class="stat-card subject-stat-card" data-subject="${escapeHtml(sub)}"
                     title="${escapeHtml(sub)}の授業一覧を表示">
                    <div class="stat-label">${escapeHtml(sub)}</div>
                    <div class="stat-value">${stats.subjects[sub]}</div>
                    <div class="stat-label">コマ</div>
                </div>
            `;
        });

        if (sortedSubjects.length === 0) {
            html += '<p class="stats-empty">指定された期間内に担当授業はありませんでした。</p>';
        }

        html += `
            <div class="stat-card stat-card-total">
                <div class="stat-label">総授業数</div>
                <div class="stat-value">${stats.total}</div>
                <div class="stat-label">コマ</div>
            </div>
        `;

        html += '</div>';
        html += `<p class="stats-note">※集計基準: 「時間割一覧／変更（自分）」のデータを使用しています。</p>`;

        if (window.CoreDOM) {
            window.CoreDOM.updateDOMWithState(resultsArea, html);
        } else {
            resultsArea.innerHTML = html;
        }

        // カードクリックで授業一覧モーダルを開く
        const oldHandler = resultsArea._statClickHandler;
        if (oldHandler) resultsArea.removeEventListener('click', oldHandler);
        const statHandler = (e) => {
            const card = e.target.closest('.subject-stat-card');
            if (card) {
                const startVal = document.getElementById('statsStartDate')?.value;
                const endVal   = document.getElementById('statsEndDate')?.value;
                const startDate = startVal ? new Date(startVal) : null;
                const endDate   = endVal   ? new Date(endVal)   : null;
                this.openSubjectDetailModal(card.dataset.subject, 'my', startDate, endDate);
            }
        };
        resultsArea._statClickHandler = statHandler;
        resultsArea.addEventListener('click', statHandler);
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
            const dateStr = formatDate(curr);
            const dayKey = WEEKDAY_KEYS[curr.getDay()];
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
    }
});
