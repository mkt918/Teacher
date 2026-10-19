// ===== スケジュールモジュール: 印刷 =====
// 今週からの時間割をA4横で印刷する。
// 本体(ScheduleModule)は index.js。このファイルは index.js より後に読み込むこと。

Object.assign(ScheduleModule, {

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
    }
});
