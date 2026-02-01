// ===== 保護者会時間決定ツールモジュール (印刷) =====

Object.assign(MeetingModule, {

    printSchedule() {
        const data = StorageManager.getCurrentData();
        if (!data.meeting || !data.meeting.slots || data.meeting.slots.length === 0) {
            alert('スケジュールがありません');
            return;
        }

        const slots = data.meeting.slots;

        // グループ化
        const grouped = {};
        const timesSet = new Set();
        slots.forEach(s => {
            if (!grouped[s.date]) grouped[s.date] = {};
            grouped[s.date][s.time] = s;
            timesSet.add(s.time);
        });

        const times = Array.from(timesSet).sort();
        const dates = Object.keys(grouped).sort();

        let html = `
            <!DOCTYPE html>
            <html lang="ja">
            <head>
                <meta charset="UTF-8">
                <title>保護者会スケジュール</title>
                <style>
                    @page { size: A4 landscape; margin: 10mm; }
                    body { font-family: sans-serif; font-size: 12px; }
                    h1 { text-align: center; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                    th, td { border: 1px solid #000; padding: 5px; text-align: center; height: 40px; }
                    th { background: #eee; }
                    .student-bg { font-weight: bold; }
                    .time-col { width: 80px; background: #f9f9f9; font-weight: bold; }
                </style>
            </head>
            <body>
                <h1>保護者会スケジュール</h1>
                <table>
                    <thead>
                        <tr>
                            <th class="time-col">時間</th>
                            ${dates.map(date => {
            const d = new Date(date);
            return `<th>${d.getMonth() + 1}/${d.getDate()} (${['日', '月', '火', '水', '木', '金', '土'][d.getDay()]})</th>`;
        }).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        times.forEach(time => {
            html += `<tr><td class="time-col">${time}</td>`;
            dates.forEach(date => {
                const slot = grouped[date][time];
                if (slot && slot.studentId) {
                    const student = data.students.find(s => s.id === slot.studentId);
                    html += `<td class="student-bg">${student ? student.nameKanji : ''}</td>`;
                } else if (slot) {
                    html += `<td></td>`;
                } else {
                    html += `<td style="background:#ddd;">-</td>`;
                }
            });
            html += `</tr>`;
        });

        html += `
                    </tbody>
                </table>
            </body></html>
        `;

        const win = safeWindowOpen('', '', 'width=1100,height=800');
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); }, 500);
    },

    // A4縦印刷（2種類：番号のみ / 番号+名前）
    printScheduleA4(type) {
        const data = StorageManager.getCurrentData();
        if (!data.meeting || !data.meeting.slots || data.meeting.slots.length === 0) {
            alert('スケジュールがありません');
            return;
        }

        const slots = data.meeting.slots;
        const grouped = {};
        const timesSet = new Set();
        slots.forEach(s => {
            if (!grouped[s.date]) grouped[s.date] = {};
            grouped[s.date][s.time] = s;
            timesSet.add(s.time);
        });

        const times = Array.from(timesSet).sort();
        const dates = Object.keys(grouped).sort();

        const showName = type === 'full';

        let html = `
            <!DOCTYPE html>
            <html lang="ja">
            <head>
                <meta charset="UTF-8">
                <title>保護者会スケジュール${showName ? '（番号＋名前）' : '（番号のみ）'}</title>
                <style>
                    @page { size: A4 portrait; margin: 10mm; }
                    body { font-family: sans-serif; font-size: 10px; }
                    h1 { text-align: center; margin-bottom: 10px; font-size: 16px; }
                    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                    th, td { border: 1px solid #000; padding: 3px; text-align: center; height: 25px; }
                    th { background: #eee; font-size: 9px; }
                    .student-bg { font-weight: bold; }
                    .time-col { width: 50px; background: #f9f9f9; font-weight: bold; }
                </style>
            </head>
            <body>
                <h1>保護者会スケジュール${showName ? '（番号＋名前）' : '（番号のみ）'}</h1>
                <table>
                    <thead>
                        <tr>
                            <th class="time-col">時間</th>
                            ${dates.map(date => {
            const d = new Date(date);
            return `<th>${d.getMonth() + 1}/${d.getDate()}</th>`;
        }).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        times.forEach(time => {
            html += `<tr><td class="time-col">${time}</td>`;
            dates.forEach(date => {
                const slot = grouped[date][time];
                if (slot && slot.studentId) {
                    const student = data.students.find(s => s.id === slot.studentId);
                    if (student) {
                        if (showName) {
                            html += `<td class="student-bg">${student.number} ${student.nameKanji}</td>`;
                        } else {
                            html += `<td class="student-bg">${student.number}</td>`;
                        }
                    } else {
                        html += `<td></td>`;
                    }
                } else if (slot) {
                    html += `<td></td>`;
                } else {
                    html += `<td style="background:#ddd;">-</td>`;
                }
            });
            html += `</tr>`;
        });

        html += `</tbody></table></body></html>`;

        const win = safeWindowOpen('', '', 'width=800,height=1100');
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); }, 500);
    }
});
