/**
 * MeetingSchedule - スケジュール表機能
 * meeting/index.js から利用される
 */

/**
 * スロットのHTMLを生成
 * @param {Object} config - 設定
 */
export function createSlotHtml(config) {
    const {
        slot,
        student,
        isSlotLocked,
        isStudentLocked
    } = config;

    let content = '';
    let lockBtns = '';

    if (slot.studentId && student) {
        content = `
            <div class="slot-student-chip ${isStudentLocked ? 'locked' : ''}" 
                 draggable="${!isStudentLocked}" 
                 data-student-id="${student.id}">
                <span class="chip-number">${student.number}</span>
                <span class="chip-name">${student.nameKanji}</span>
                <button class="remove-assignment" title="解除">×</button>
                <button class="student-lock-btn ${isStudentLocked ? 'active' : ''}" 
                        title="${isStudentLocked ? 'ロック解除' : 'ロック'}" 
                        data-slot-id="${slot.id}">
                    ${isStudentLocked ? '🔒' : '🔓'}
                </button>
            </div>
        `;
    }

    // 空枠の場合のみロックボタン表示
    if (!slot.studentId) {
        lockBtns = `
            <button class="slot-empty-lock-btn ${isSlotLocked ? 'active' : ''}" 
                    title="${isSlotLocked ? '空枠ロック解除' : '空枠としてロック'}" 
                    data-slot-id="${slot.id}">
                ${isSlotLocked ? '空枠解除' : '空枠'}
            </button>
        `;
    }

    return `
        <div class="matrix-slot ${slot.studentId ? 'occupied' : 'empty'} ${isSlotLocked ? 'slot-locked' : ''}" 
             data-slot-id="${slot.id}">
            ${lockBtns}
            ${content}
        </div>
    `;
}

/**
 * 日付でスロットをグループ化
 * @param {Array} slots - スロット配列
 */
export function groupSlotsByDate(slots) {
    const grouped = {};
    slots.forEach(slot => {
        if (!grouped[slot.date]) grouped[slot.date] = [];
        grouped[slot.date].push(slot);
    });
    return grouped;
}

/**
 * ユニークな日付リストを取得
 * @param {Array} slots - スロット配列
 */
export function getUniqueDates(slots) {
    return [...new Set(slots.map(s => s.date))].sort();
}

/**
 * ユニークな時間リストを取得
 * @param {Array} slots - スロット配列
 */
export function getUniqueTimes(slots) {
    return [...new Set(slots.map(s => s.time))].sort();
}

/**
 * 曜日を取得
 * @param {string} dateStr - 日付文字列 (YYYY-MM-DD)
 */
export function getDayOfWeek(dateStr) {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const date = new Date(dateStr);
    return days[date.getDay()];
}

/**
 * スケジュールのマトリクスHTMLを生成
 * @param {Object} config - 設定
 */
export function generateScheduleMatrixHtml(config) {
    const {
        slots,
        students,
        lockedSlots = [],
        lockedStudents = []
    } = config;

    const grouped = groupSlotsByDate(slots);
    const dates = getUniqueDates(slots);
    const times = getUniqueTimes(slots);

    let html = '<div class="meeting-matrix">';

    // ヘッダー行
    html += '<div class="matrix-header-row"><div class="matrix-corner"></div>';
    dates.forEach(date => {
        const dateStr = date.split('-').slice(1).join('/');
        const dayStr = getDayOfWeek(date);
        html += `
            <div class="matrix-header-date">
                <div>${dateStr}</div>
                <div style="font-size:0.8em">(${dayStr})</div>
            </div>
        `;
    });
    html += '</div>';

    // 時間行
    times.forEach(time => {
        html += `<div class="matrix-row"><div class="matrix-time-header">${time}</div>`;
        dates.forEach(date => {
            const dateSlots = grouped[date] || [];
            const slot = dateSlots.find(s => s.time === time);
            if (slot) {
                const student = students.find(s => s.id === slot.studentId);
                const isSlotLocked = !slot.studentId && lockedSlots.includes(slot.id);
                const isStudentLocked = lockedStudents.some(ls => ls.slotId === slot.id);
                html += createSlotHtml({ slot, student, isSlotLocked, isStudentLocked });
            } else {
                html += '<div class="matrix-slot disabled"></div>';
            }
        });
        html += '</div>';
    });

    html += '</div>';
    return html;
}

// グローバルに公開（移行期間中の互換性のため）
if (typeof window !== 'undefined') {
    window.MeetingSchedule = {
        createSlotHtml,
        groupSlotsByDate,
        getUniqueDates,
        getUniqueTimes,
        getDayOfWeek,
        generateScheduleMatrixHtml
    };
}
