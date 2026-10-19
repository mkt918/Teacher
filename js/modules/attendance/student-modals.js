// ===== 出欠モジュール: 生徒ごとの出欠入力・欠席一覧 =====
// 生徒の出欠入力モーダル、欠席一覧と印刷、月ごとの出欠表。
// 本体(AttendanceModule)は index.js。このファイルは index.js より後に読み込むこと。

Object.assign(AttendanceModule, {

    /**
     * 生徒の出欠入力モーダルを開く
     */
    openStudentAttendanceModal(student) {
        const modal = document.createElement('div');
        modal.id = 'attendanceModal';
        modal.className = 'modal active';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');

        const today = new Date();
        let currentYear = today.getFullYear();
        let currentMonth = today.getMonth();

        modal.innerHTML = `
            <div class="modal-content modal-large modal-wide">
                <div class="modal-header">
                    <h3>${escapeHtml(student.number)} ${escapeHtml(student.nameKanji)} の出欠記録</h3>
                    <button class="modal-close" aria-label="閉じる" id="closeAttModal">✕</button>
                </div>
                <div class="modal-body">
                    <div class="calendar-controls">
                        <div class="calendar-nav-group">
                            <button class="btn btn-sm btn-secondary" id="jumpPrevBtn" title="6ヶ月前" aria-label="6ヶ月前">◀◀ 6ヶ月</button>
                            <button class="btn btn-sm" id="prevMonthBtn">◀ 前月</button>
                        </div>
                        <div class="calendar-nav-group">
                            <select id="monthJumpSelect" class="calendar-jump-select"></select>
                            <h4 id="calendarTitle" class="att-calendar-title"></h4>
                        </div>
                        <div class="calendar-nav-group">
                            <button class="btn btn-sm" id="nextMonthBtn">次月 ▶</button>
                            <button class="btn btn-sm btn-secondary" id="jumpNextBtn" title="6ヶ月後" aria-label="6ヶ月後">6ヶ月 ▶▶</button>
                        </div>
                        <label class="calendar-lock-toggle" id="lockMonthLabel">
                            <input type="checkbox" id="lockMonthCheck"> 月ロック
                        </label>
                        <button class="btn btn-sm btn-secondary push-right" id="openAbsenceListBtn">📋 欠席一覧をすべて見る</button>
                    </div>
                    <div id="attendanceCalendar" class="attendance-table-wrap">
                        <!-- 日付×時限の一覧表を描画 -->
                    </div>
                    <div class="att-table-hint">
                        ※欠席したコマをクリックすると連続して確定できます（ロック中は編集不可）
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const monthSelect = modal.querySelector('#monthJumpSelect');
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
            // modal.querySelector でスコープを絞り、グローバルID衝突を防ぐ
            const container = modal.querySelector('#attendanceCalendar');
            const title = modal.querySelector('#calendarTitle');
            const lockCheck = modal.querySelector('#lockMonthCheck');
            const lockLabel = modal.querySelector('#lockMonthLabel');
            if (!container || !title) return;

            const monthKey = `${currentYear}-${currentMonth}`;
            const isLocked = !!this.lockedMonths[monthKey];

            title.textContent = `${currentYear}年 ${currentMonth + 1}月`;
            lockCheck.checked = isLocked;
            lockLabel.classList.toggle('active', isLocked);

            container.innerHTML = this._renderAttendanceTableHtml(student, currentYear, currentMonth, isLocked);
            this._bindAttendanceTableEvents(container, student, currentYear, currentMonth, isLocked, renderCalendar);
            updateMonthSelect();
        };

        renderCalendar();

        // document.getElementById ではなく modal.querySelector でスコープを絞り、ID衝突を防ぐ
        modal.querySelector('#prevMonthBtn').addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 0) { currentMonth = 11; currentYear--; }
            renderCalendar();
        });
        modal.querySelector('#nextMonthBtn').addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 11) { currentMonth = 0; currentYear++; }
            renderCalendar();
        });
        modal.querySelector('#jumpPrevBtn').addEventListener('click', () => {
            currentMonth -= 6;
            while (currentMonth < 0) { currentMonth += 12; currentYear--; }
            renderCalendar();
        });
        modal.querySelector('#jumpNextBtn').addEventListener('click', () => {
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

        modal.querySelector('#lockMonthCheck').addEventListener('change', (e) => {
            const monthKey = `${currentYear}-${currentMonth}`;
            if (e.target.checked) {
                this.lockedMonths[monthKey] = true;
            } else {
                delete this.lockedMonths[monthKey];
            }
            this.saveData();
            renderCalendar();
        });

        modal.querySelector('#closeAttModal').addEventListener('click', () => {
            modal.remove();
            this.render();
        });

        modal.querySelector('#openAbsenceListBtn').addEventListener('click', () => {
            this.openAbsenceListModal(student);
        });
    },

    /**
     * 生徒の欠席記録（{dateStr, dow, period, subject}の配列）を、
     * 選択中の年度（設定済みの年度）に絞って収集する
     */
    _collectAbsenceRows(studentId) {
        const sm = window.ScheduleModule;
        const fiscalYear = getFiscalYear();
        const dayKeys = WEEKDAY_KEYS;
        const records = this.attendance[studentId] || {};
        const rows = [];

        Object.entries(records).forEach(([dateStr, record]) => {
            if (!this._isDateInFiscalYear(dateStr, fiscalYear)) return;

            const dateObj = new Date(dateStr);
            const dow = dateObj.getDay();
            const dayKey = dayKeys[dow];
            if (dayKey === 'sun' || dayKey === 'sat') return;

            const baseSchedule = sm ? (sm.classTimetable[dayKey] || []) : [];
            const changes = sm ? (sm.dailyChanges?.class?.[dateStr] || {}) : {};

            (record.periods || []).forEach(periodNum => {
                const idx = periodNum - 1;
                const subject = changes[idx] !== undefined ? changes[idx] : baseSchedule[idx];
                rows.push({ dateStr, dow, period: periodNum, subject: subject || '（授業不明）' });
            });
        });

        return rows;
    },

    /**
     * 生徒の欠席一覧（どの授業を何日に休んだか）をすべて表示するモーダル
     * 選択中の年度（設定済みの年度）の記録のみを対象とする。
     * 「日付順一覧」と「科目別クロス表」の2ビュー、日付順/科目順ソート、印刷に対応。
     */
    openAbsenceListModal(student) {
        const dayLabels = WEEKDAY_LABELS;
        const fiscalYear = getFiscalYear();
        const rows = this._collectAbsenceRows(student.id);

        const state = { view: 'list', sort: 'date' };

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `
            <div class="modal-content modal-scroll modal-medium">
                <div class="modal-header">
                    <h3>${escapeHtml(student.number)} ${escapeHtml(student.nameKanji)} の欠席一覧（${fiscalYear}年度・${rows.length}コマ）</h3>
                    <button class="modal-close" aria-label="閉じる" id="closeAbsenceListModal">✕</button>
                </div>
                <div class="modal-body modal-body-scroll">
                    <div class="att-abslist-controls">
                        <div class="att-abslist-btn-group" id="attAbslistViewGroup">
                            <button type="button" class="att-abslist-btn active" data-view="list">📋 日付順一覧</button>
                            <button type="button" class="att-abslist-btn" data-view="cross">📊 科目別クロス表</button>
                        </div>
                        <div class="att-abslist-btn-group" id="attAbslistSortGroup">
                            <button type="button" class="att-abslist-btn active" data-sort="date">日付順</button>
                            <button type="button" class="att-abslist-btn" data-sort="subject">科目順</button>
                        </div>
                        <button type="button" class="btn btn-sm btn-secondary push-right" id="printAbsenceListBtn">🖨️ 印刷</button>
                    </div>
                    <div id="absenceListContent"></div>
                </div>
            </div>`;

        document.body.appendChild(modal);

        const contentEl = modal.querySelector('#absenceListContent');
        const sortGroup = modal.querySelector('#attAbslistSortGroup');

        const buildListHtml = () => {
            const sorted = [...rows].sort((a, b) => {
                if (state.sort === 'subject') {
                    const bySubject = a.subject.localeCompare(b.subject, 'ja');
                    if (bySubject !== 0) return bySubject;
                }
                return a.dateStr === b.dateStr ? a.period - b.period : a.dateStr.localeCompare(b.dateStr);
            });

            const rowsHtml = sorted.map(r => {
                const [, m, d] = r.dateStr.split('-');
                return `<tr>
                    <td>${parseInt(m)}/${parseInt(d)}</td>
                    <td>${dayLabels[r.dow]}曜日</td>
                    <td class="text-center">${r.period}限</td>
                    <td>${escapeHtml(r.subject)}</td>
                </tr>`;
            }).join('');

            return `<table class="att-abslist-table">
                <thead><tr>
                    <th class="text-left">日付</th>
                    <th class="text-left">曜日</th>
                    <th class="text-center">時限</th>
                    <th class="text-left">科目</th>
                </tr></thead>
                <tbody>${rowsHtml || '<tr><td colspan="4" class="table-empty">欠席記録なし</td></tr>'}</tbody>
            </table>`;
        };

        const buildCrossTabHtml = () => {
            const bySubject = {};
            rows.forEach(r => {
                if (!bySubject[r.subject]) bySubject[r.subject] = [];
                bySubject[r.subject].push(r);
            });
            const subjects = Object.keys(bySubject).sort((a, b) => a.localeCompare(b, 'ja'));
            subjects.forEach(sub => {
                bySubject[sub].sort((a, b) => a.dateStr === b.dateStr ? a.period - b.period : a.dateStr.localeCompare(b.dateStr));
            });
            const maxCount = subjects.reduce((max, sub) => Math.max(max, bySubject[sub].length), 0);

            if (subjects.length === 0) {
                return '<p class="table-empty">欠席記録なし</p>';
            }

            let html = `<div class="att-crosstab-scroll"><table class="att-abslist-table att-crosstab-table">
                <thead><tr><th>回数</th>${subjects.map(s => `<th>${escapeHtml(s)}</th>`).join('')}</tr></thead>
                <tbody>`;
            for (let i = 0; i < maxCount; i++) {
                html += `<tr><td class="att-crosstab-count">${i + 1}回目</td>`;
                subjects.forEach(sub => {
                    const r = bySubject[sub][i];
                    if (r) {
                        const [, m, d] = r.dateStr.split('-');
                        html += `<td>${parseInt(m)}/${parseInt(d)}(${dayLabels[r.dow]})${r.period}限</td>`;
                    } else {
                        html += '<td class="att-crosstab-empty">—</td>';
                    }
                });
                html += '</tr>';
            }
            html += '</tbody></table></div>';
            return html;
        };

        const renderContent = () => {
            contentEl.innerHTML = state.view === 'list' ? buildListHtml() : buildCrossTabHtml();
            sortGroup.style.display = state.view === 'list' ? '' : 'none';
        };

        renderContent();

        modal.querySelector('#attAbslistViewGroup').addEventListener('click', (e) => {
            const btn = e.target.closest('.att-abslist-btn');
            if (!btn) return;
            modal.querySelectorAll('#attAbslistViewGroup .att-abslist-btn').forEach(b => b.classList.toggle('active', b === btn));
            state.view = btn.dataset.view;
            renderContent();
        });

        sortGroup.addEventListener('click', (e) => {
            const btn = e.target.closest('.att-abslist-btn');
            if (!btn) return;
            modal.querySelectorAll('#attAbslistSortGroup .att-abslist-btn').forEach(b => b.classList.toggle('active', b === btn));
            state.sort = btn.dataset.sort;
            renderContent();
        });

        modal.querySelector('#printAbsenceListBtn').addEventListener('click', () => {
            this._printAbsenceList(student, fiscalYear, contentEl.innerHTML, state.view);
        });

        modal.querySelector('#closeAbsenceListModal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    },

    // 欠席一覧（一覧 or クロス表）を印刷する
    _printAbsenceList(student, fiscalYear, tableHtml, viewType) {
        const viewLabel = viewType === 'cross' ? '科目別クロス表' : '日付順一覧';
        const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
            <title>${escapeHtml(student.nameKanji)}さん 欠席一覧</title>
            <style>
                @page { size: A4 portrait; margin: 15mm; }
                body { font-family: "Hiragino Kaku Gothic Pro", "メイリオ", sans-serif; color:#1e293b; }
                h1 { font-size: 16pt; margin-bottom: 4px; }
                .meta { font-size: 10pt; color:#475569; margin-bottom: 16px; }
                table { width:100%; border-collapse: collapse; font-size: 10.5pt; }
                th, td { border: 1px solid #94a3b8; padding: 5px 8px; }
                th { background: #f1f5f9; }
                .att-crosstab-count { background:#f8fafc; font-weight:bold; text-align:center; }
                .att-crosstab-empty { color:#cbd5e1; text-align:center; }
            </style>
            </head><body>
            <h1>${escapeHtml(student.number)} ${escapeHtml(student.nameKanji)} さんの欠席一覧</h1>
            <div class="meta">${fiscalYear}年度／${viewLabel}／印刷日: ${new Date().toLocaleDateString('ja-JP')}</div>
            ${tableHtml}
            </body></html>`;

        printHtmlInNewWindow(html, 'width=900,height=700');
    },

    /**
     * 出欠一覧表（日付×時限）のHTMLを生成
     * 縦: その月の日付、横: 1〜N限。セルには科目名も表示する。
     */
    _renderAttendanceTableHtml(student, year, month, isLocked) {
        const dayKeys = WEEKDAY_KEYS;
        const dayLabels = WEEKDAY_LABELS;

        const sm = window.ScheduleModule;
        const settingsData = window.StorageManager?.getCurrentData() || {};
        const periodsPerDay = settingsData.appSettings?.periodsPerDay || { mon: 6, tue: 6, wed: 6, thu: 6, fri: 6, sat: 0, sun: 0 };
        const periodTimes = settingsData.appSettings?.periodTimes || {};

        const lastDay = new Date(year, month + 1, 0).getDate();
        // 表の列数 = その月に登場する最大時限数
        let maxPeriods = 0;
        for (let d = 1; d <= lastDay; d++) {
            const dow = new Date(year, month, d).getDay();
            maxPeriods = Math.max(maxPeriods, periodsPerDay[dayKeys[dow]] || 0);
        }
        if (maxPeriods === 0) maxPeriods = 6;

        let html = `<table class="attendance-table-grid">
            <thead><tr>
                <th class="att-col-date">日付</th>
                <th class="att-col-all">全欠席</th>`;
        for (let p = 1; p <= maxPeriods; p++) {
            const t = periodTimes[p] || {};
            const timeStr = t.start ? `<div class="att-period-time">${t.start}${t.end ? '〜' + t.end : ''}</div>` : '';
            html += `<th class="att-col-period">${p}限${timeStr}</th>`;
        }
        html += '</tr></thead><tbody>';

        for (let d = 1; d <= lastDay; d++) {
            const dateObj = new Date(year, month, d);
            const dateStr = formatDate(dateObj);
            const dow = dateObj.getDay();
            const dayKey = dayKeys[dow];
            const dayPeriods = periodsPerDay[dayKey] || 0;
            const record = this.attendance[student.id]?.[dateStr];
            const absentPeriods = record?.periods || [];

            const baseSchedule = sm ? (sm.classTimetable[dayKey] || []) : [];
            const changes = sm ? (sm.dailyChanges?.class?.[dateStr] || {}) : {};

            const isWeekend = dow === 0 || dow === 6;
            const rowClasses = ['att-row'];
            if (isWeekend) rowClasses.push('att-row-weekend');
            if (dayPeriods === 0) rowClasses.push('att-row-noclass');

            const isAllAbsent = dayPeriods > 0 && absentPeriods.length >= dayPeriods;

            html += `<tr class="${rowClasses.join(' ')}" data-date="${dateStr}">
                <td class="att-col-date"><span class="att-date-num">${d}</span><span class="att-date-day ${dow === 0 ? 'sun' : dow === 6 ? 'sat' : ''}">(${dayLabels[dow]})</span></td>`;

            if (dayPeriods > 0) {
                html += `<td class="att-col-all">
                    <button class="att-all-toggle ${isAllAbsent ? 'active' : ''}" data-date="${dateStr}" ${isLocked ? 'disabled' : ''}
                        title="この日をすべて欠席/出席にする">${isAllAbsent ? '全欠席' : '－'}</button>
                </td>`;
            } else {
                html += `<td class="att-col-all att-cell-disabled">－</td>`;
            }

            for (let p = 1; p <= maxPeriods; p++) {
                if (p > dayPeriods) {
                    html += `<td class="att-cell-disabled">－</td>`;
                    continue;
                }
                const idx = p - 1;
                const subject = changes[idx] !== undefined ? changes[idx] : (baseSchedule[idx] || '');
                const isAbsent = absentPeriods.includes(p);
                html += `<td class="att-cell ${isAbsent ? 'absent' : ''} ${isLocked ? 'locked' : ''}" data-date="${dateStr}" data-period="${p}">
                    <div class="att-cell-subject">${escapeHtml(subject || '—')}</div>
                    <div class="att-cell-status">${isAbsent ? '欠席' : ''}</div>
                </td>`;
            }
            html += '</tr>';
        }

        html += '</tbody></table>';
        return html;
    },

    /**
     * 出欠一覧表のクリックイベントを設定
     * セルをクリックするたびに即座に保存し、連続してクリックして確定できるようにする。
     */
    _bindAttendanceTableEvents(container, student, year, month, isLocked, onChanged) {
        if (isLocked) return;

        container.querySelectorAll('.att-cell:not(.att-cell-disabled)').forEach(cell => {
            cell.addEventListener('click', () => {
                const dateStr = cell.dataset.date;
                const period = parseInt(cell.dataset.period);

                if (!this.attendance[student.id]) this.attendance[student.id] = {};
                const record = this.attendance[student.id][dateStr] || { type: 'mixed', periods: [], memo: '' };

                const idx = record.periods.indexOf(period);
                if (idx > -1) {
                    record.periods.splice(idx, 1);
                } else {
                    record.periods.push(period);
                }

                if (record.periods.length === 0) {
                    delete this.attendance[student.id][dateStr];
                } else {
                    this.attendance[student.id][dateStr] = record;
                }

                this.saveData();

                // セル単体の見た目だけ即時更新（表全体の再描画はしない＝連続クリックが速い）
                const isAbsent = record.periods && record.periods.includes(period);
                cell.classList.toggle('absent', !!isAbsent);
                cell.querySelector('.att-cell-status').textContent = isAbsent ? '欠席' : '';

                // 「全欠席」ボタンの見た目も同期
                const row = cell.closest('tr');
                const allBtn = row?.querySelector('.att-all-toggle');
                if (allBtn) {
                    const totalPeriodCells = row.querySelectorAll('.att-cell').length;
                    const absentCount = row.querySelectorAll('.att-cell.absent').length;
                    const isAllAbsent = totalPeriodCells > 0 && absentCount >= totalPeriodCells;
                    allBtn.classList.toggle('active', isAllAbsent);
                    allBtn.textContent = isAllAbsent ? '全欠席' : '－';
                }
            });
        });

        container.querySelectorAll('.att-all-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const dateStr = btn.dataset.date;
                const row = btn.closest('tr');
                const periodCells = Array.from(row.querySelectorAll('.att-cell'));
                const shouldMarkAbsent = !btn.classList.contains('active');

                if (!this.attendance[student.id]) this.attendance[student.id] = {};

                if (shouldMarkAbsent) {
                    const allPeriods = periodCells.map(c => parseInt(c.dataset.period));
                    this.attendance[student.id][dateStr] = { type: 'absent', periods: allPeriods, memo: '' };
                } else {
                    delete this.attendance[student.id][dateStr];
                }

                this.saveData();

                // 見た目を同期
                periodCells.forEach(c => {
                    c.classList.toggle('absent', shouldMarkAbsent);
                    c.querySelector('.att-cell-status').textContent = shouldMarkAbsent ? '欠席' : '';
                });
                btn.classList.toggle('active', shouldMarkAbsent);
                btn.textContent = shouldMarkAbsent ? '全欠席' : '－';
            });
        });
    }
});
