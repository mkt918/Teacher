/**
 * MeetingPrint - 保護者会の印刷機能
 * meeting/index.js から利用される
 */

import { generatePrintHtml, openPrintWindow } from '../../utils/print.js';

/**
 * スケジュール表の印刷HTMLを生成
 * @param {Object} config - 設定
 */
export function generateSchedulePrintHtml(config) {
    const {
        slots,
        students,
        title = '保護者会スケジュール',
        settings = {}
    } = config;

    // 日付と時間の取得
    const dates = [...new Set(slots.map(s => s.date))].sort();
    const times = [...new Set(slots.map(s => s.time))].sort();
    const grouped = {};
    slots.forEach(s => {
        if (!grouped[s.date]) grouped[s.date] = [];
        grouped[s.date].push(s);
    });

    // テーブル生成
    let tableHtml = '<table class="schedule-table">';

    // ヘッダー
    tableHtml += '<thead><tr><th>時間</th>';
    dates.forEach(date => {
        const parts = date.split('-');
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const d = new Date(date);
        tableHtml += `<th>${parts[1]}/${parts[2]}<br>(${days[d.getDay()]})</th>`;
    });
    tableHtml += '</tr></thead>';

    // ボディ
    tableHtml += '<tbody>';
    times.forEach(time => {
        tableHtml += `<tr><td class="time-cell">${time}</td>`;
        dates.forEach(date => {
            const dateSlots = grouped[date] || [];
            const slot = dateSlots.find(s => s.time === time);
            if (slot && slot.studentId) {
                const student = students.find(s => s.id === slot.studentId);
                if (student) {
                    tableHtml += `<td class="occupied">${student.number} ${student.nameKanji}</td>`;
                } else {
                    tableHtml += '<td>-</td>';
                }
            } else {
                tableHtml += '<td></td>';
            }
        });
        tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';

    const additionalStyles = `
        .schedule-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
        }
        .schedule-table th, .schedule-table td {
            border: 1px solid #333;
            padding: 5px;
            text-align: center;
        }
        .schedule-table th {
            background: #f0f0f0;
        }
        .time-cell {
            font-weight: bold;
            white-space: nowrap;
        }
        .occupied {
            background: #e0f7fa;
        }
    `;

    return generatePrintHtml({
        title,
        content: tableHtml,
        orientation: 'landscape',
        fontSize: '11px',
        additionalStyles
    });
}

/**
 * A4縦印刷用HTMLを生成（番号のみ / 番号+名前）
 * @param {Object} config - 設定
 */
export function generateA4PrintHtml(config) {
    const {
        slots,
        students,
        type = 'number', // 'number' or 'full'
        title = '保護者会スケジュール'
    } = config;

    // 日付と時間の取得
    const dates = [...new Set(slots.map(s => s.date))].sort();
    const times = [...new Set(slots.map(s => s.time))].sort();
    const grouped = {};
    slots.forEach(s => {
        if (!grouped[s.date]) grouped[s.date] = [];
        grouped[s.date].push(s);
    });

    // テーブル生成
    let tableHtml = '<table class="a4-schedule">';

    // ヘッダー
    tableHtml += '<thead><tr><th>時間</th>';
    dates.forEach(date => {
        const parts = date.split('-');
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const d = new Date(date);
        tableHtml += `<th>${parts[1]}/${parts[2]}(${days[d.getDay()]})</th>`;
    });
    tableHtml += '</tr></thead>';

    // ボディ
    tableHtml += '<tbody>';
    times.forEach(time => {
        tableHtml += `<tr><td class="time-cell">${time}</td>`;
        dates.forEach(date => {
            const dateSlots = grouped[date] || [];
            const slot = dateSlots.find(s => s.time === time);
            if (slot && slot.studentId) {
                const student = students.find(s => s.id === slot.studentId);
                if (student) {
                    const content = type === 'full'
                        ? `${student.number} ${student.nameKanji}`
                        : student.number;
                    tableHtml += `<td class="occupied">${content}</td>`;
                } else {
                    tableHtml += '<td>-</td>';
                }
            } else {
                tableHtml += '<td></td>';
            }
        });
        tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';

    const additionalStyles = `
        .a4-schedule {
            width: 100%;
            border-collapse: collapse;
            font-size: ${type === 'full' ? '9px' : '10px'};
        }
        .a4-schedule th, .a4-schedule td {
            border: 1px solid #333;
            padding: 4px 6px;
            text-align: center;
        }
        .a4-schedule th {
            background: #f0f0f0;
            font-size: 0.9em;
        }
        .time-cell {
            font-weight: bold;
            white-space: nowrap;
            font-size: 0.85em;
        }
        .occupied {
            background: #e8f5e9;
        }
    `;

    return generatePrintHtml({
        title: `${title}（${type === 'full' ? '番号+名前' : '番号のみ'}）`,
        content: tableHtml,
        orientation: 'portrait',
        fontSize: '10px',
        additionalStyles
    });
}

/**
 * スケジュール表を印刷
 * @param {Object} config - 設定
 */
export function printSchedule(config) {
    const html = generateSchedulePrintHtml(config);
    openPrintWindow(html);
}

/**
 * A4縦印刷
 * @param {Object} config - 設定
 */
export function printScheduleA4(config) {
    const html = generateA4PrintHtml(config);
    openPrintWindow(html);
}

// グローバルに公開（移行期間中の互換性のため）
if (typeof window !== 'undefined') {
    window.MeetingPrint = {
        generateSchedulePrintHtml,
        generateA4PrintHtml,
        printSchedule,
        printScheduleA4
    };
}
