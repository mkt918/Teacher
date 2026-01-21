/**
 * SeatingGrid - 座席グリッド描画機能
 * seating/index.js から利用される
 */

/**
 * 座席グリッドのHTML要素を生成
 * @param {Object} config - 設定
 */
export function createSeatElement(config) {
    const {
        row,
        col,
        studentId,
        student,
        isLocked,
        onLockClick,
        onDragStart,
        onDrop
    } = config;

    const seat = document.createElement('div');
    seat.className = 'seat';
    seat.dataset.row = row;
    seat.dataset.col = col;

    if (isLocked) seat.classList.add('locked');
    if (studentId) seat.classList.add('occupied');

    // ロックボタン
    const lockBtn = document.createElement('button');
    lockBtn.className = `seat-lock-btn ${isLocked ? 'active' : ''}`;
    lockBtn.innerHTML = isLocked ? '🔒' : '🔓';
    lockBtn.title = isLocked ? 'ロック解除' : 'ロックする';
    lockBtn.onclick = (e) => {
        e.stopPropagation();
        if (onLockClick) onLockClick(row, col);
    };
    seat.appendChild(lockBtn);

    if (studentId && student) {
        // 生徒情報
        const studentDiv = document.createElement('div');
        studentDiv.className = 'seat-student';
        studentDiv.draggable = !isLocked;
        studentDiv.dataset.studentId = studentId;

        const numberDiv = document.createElement('div');
        numberDiv.className = 'seat-number';
        numberDiv.textContent = student.number;

        const nameDiv = document.createElement('div');
        nameDiv.className = 'seat-name';
        nameDiv.textContent = student.nameKanji;

        studentDiv.appendChild(numberDiv);
        studentDiv.appendChild(nameDiv);
        seat.appendChild(studentDiv);

        // ドラッグイベント
        if (!isLocked && onDragStart) {
            studentDiv.addEventListener('dragstart', (e) => {
                onDragStart(e, studentId, row, col);
            });
        }
    } else {
        // 空席
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'seat-empty';
        emptyDiv.innerText = '空席';
        seat.appendChild(emptyDiv);
    }

    // ドロップイベント
    if (!isLocked && onDrop) {
        seat.addEventListener('dragover', (e) => {
            e.preventDefault();
            seat.classList.add('drag-over');
        });
        seat.addEventListener('dragleave', () => {
            seat.classList.remove('drag-over');
        });
        seat.addEventListener('drop', (e) => {
            e.preventDefault();
            seat.classList.remove('drag-over');
            onDrop(e, row, col);
        });
    }

    return seat;
}

/**
 * 教卓要素を生成
 */
export function createTeacherDesk() {
    const desk = document.createElement('div');
    desk.id = 'teacherDesk';
    desk.className = 'teacher-desk';
    desk.innerText = '教卓';
    return desk;
}

/**
 * 未配置生徒リストのHTMLを生成
 * @param {Array} students - 未配置生徒の配列
 */
export function renderUnassignedStudentsHtml(students) {
    if (students.length === 0) {
        return '<div class="empty-state-small"><p>全員配置済み</p></div>';
    }

    return students.map(student => `
        <div class="unassigned-student" draggable="true" data-student-id="${student.id}">
            <div class="student-number">${student.number}</div>
            <div class="student-name">
                <div class="name-kanji">${student.nameKanji}</div>
                <div class="name-kana">${student.nameKana}</div>
            </div>
        </div>
    `).join('');
}

/**
 * 配置済み生徒IDを収集
 * @param {Array<Array>} layout - レイアウト配列
 */
export function getAssignedStudentIds(layout) {
    const assignedIds = new Set();
    layout.forEach(row => {
        row.forEach(studentId => {
            if (studentId) assignedIds.add(studentId);
        });
    });
    return assignedIds;
}

/**
 * 未配置生徒を抽出
 * @param {Array} allStudents - 全生徒配列
 * @param {Set} assignedIds - 配置済み生徒IDセット
 */
export function getUnassignedStudents(allStudents, assignedIds) {
    return allStudents.filter(s => !assignedIds.has(s.id));
}

// グローバルに公開（移行期間中の互換性のため）
if (typeof window !== 'undefined') {
    window.SeatingGrid = {
        createSeatElement,
        createTeacherDesk,
        renderUnassignedStudentsHtml,
        getAssignedStudentIds,
        getUnassignedStudents
    };
}
