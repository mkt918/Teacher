// ===== 保護者会時間決定ツールモジュール =====

const MeetingModule = {
    draggedStudent: null,

    initialized: false,

    init() {
        if (this.initialized) return;
        this.setupEventListeners();
        this.initialized = true;
        console.log('📅 Meeting Module initialized');
    },

    setupEventListeners() {
        // 設定モーダル
        const settingsBtn = document.getElementById('meetingSettingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.openSettingsModal();
            });
        }

        const closeSettings = document.getElementById('closeMeetingSettings');
        if (closeSettings) {
            closeSettings.addEventListener('click', () => {
                document.getElementById('meetingSettingsModal').classList.remove('active');
            });
        }

        const cancelSettings = document.getElementById('cancelMeetingSettings');
        if (cancelSettings) {
            cancelSettings.addEventListener('click', () => {
                document.getElementById('meetingSettingsModal').classList.remove('active');
            });
        }

        // スケジュール生成（保存）
        const saveSettings = document.getElementById('saveMeetingSettings');
        if (saveSettings) {
            saveSettings.addEventListener('click', () => {
                this.generateSchedule();
            });
        }

        // 全クリア
        const clearBtn = document.getElementById('clearMeetingBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearAll();
            });
        }

        // 印刷
        const printBtn = document.getElementById('printMeetingBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                this.printSchedule();
            });
        }

        // 自動配置
        const autoBtn = document.getElementById('autoScheduleMeetingBtn');
        if (autoBtn) {
            autoBtn.addEventListener('click', () => {
                this.autoAssignSlots();
            });
        }

        // 希望時間モーダル閉じ
        const closePref = document.getElementById('closePreferenceModal');
        if (closePref) {
            closePref.addEventListener('click', () => {
                document.getElementById('meetingPreferenceModal').classList.remove('active');
            });
        }
        const cancelPref = document.getElementById('cancelPreferenceBtn');
        if (cancelPref) {
            cancelPref.addEventListener('click', () => {
                document.getElementById('meetingPreferenceModal').classList.remove('active');
            });
        }

        // 希望保存
        const savePref = document.getElementById('savePreferenceBtn');
        if (savePref) {
            savePref.addEventListener('click', () => {
                this.savePreference();
            });
        }

        // 履歴管理モーダル
        const openHistoryBtn = document.getElementById('openMeetingHistoryModalBtn');
        if (openHistoryBtn) {
            openHistoryBtn.addEventListener('click', () => {
                this.openHistoryModal();
            });
        }
        const closeHistory = document.getElementById('closeMeetingHistoryModal');
        if (closeHistory) {
            closeHistory.addEventListener('click', () => {
                this.closeHistoryModal();
            });
        }
        const cancelHistory = document.getElementById('cancelMeetingHistoryBtn');
        if (cancelHistory) {
            cancelHistory.addEventListener('click', () => {
                this.closeHistoryModal();
            });
        }

        // 希望一括リセット
        const resetPrefsBtn = document.getElementById('resetAllPrefsBtn');
        if (resetPrefsBtn) {
            resetPrefsBtn.addEventListener('click', () => {
                this.resetAllPreferences();
            });
        }

        // 希望チェック
        const checkPrefsBtn = document.getElementById('checkPreferencesBtn');
        if (checkPrefsBtn) {
            checkPrefsBtn.addEventListener('click', () => {
                this.checkAssignmentsAgainstPreferences();
            });
        }
    },

    render() {
        this.renderUnassignedStudents();
        this.renderSchedule();
    },

    // 未配置生徒リスト
    renderUnassignedStudents() {
        const container = document.getElementById('meetingStudentList');
        if (!container) return;

        const data = StorageManager.getCurrentData();
        const students = data.students || [];
        const slots = (data.meeting && data.meeting.slots) ? data.meeting.slots : [];

        // 配置済み生徒ID
        const assignedIds = new Set(slots.map(s => s.studentId).filter(id => id));

        const unassigned = students.filter(s => !assignedIds.has(s.id));

        if (unassigned.length === 0) {
            container.innerHTML = '<div class="empty-state-small"><p>全員配置済み</p></div>';
            return;
        }

        container.innerHTML = unassigned.map(student => {
            const hasPref = (data.meeting && data.meeting.studentPreferences && data.meeting.studentPreferences[student.id] && data.meeting.studentPreferences[student.id].length > 0);
            return `
                <div class="meeting-student-item" draggable="true" data-student-id="${student.id}">
                    <div style="flex: 1;">
                        <div class="student-number" style="font-size:0.8em; color:#666;">${student.number}</div>
                        <div class="student-name">${student.nameKanji}</div>
                    </div>
                    <button class="btn btn-sm ${hasPref ? 'btn-info' : 'btn-outline-secondary'}" 
                            onclick="window.MeetingModule.openPreferenceModal('${student.id}')"
                            title="希望時間を設定" style="padding: 2px 5px; font-size: 0.8em;">
                        ${hasPref ? '★希望' : '⚙️希望'}
                    </button>
                </div>
            `;
        }).join('');

        // ドラッグ開始
        container.querySelectorAll('.meeting-student-item').forEach(el => {
            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                this.draggedStudent = { id: el.dataset.studentId, fromSlotId: null };
            });
        });

        // 戻す領域
        container.addEventListener('dragover', (e) => e.preventDefault());
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            this.onDropToUnassigned(e);
        });
    },

    // スケジュール表（マトリクス）
    renderSchedule() {
        const container = document.getElementById('meetingSchedule');
        const title = document.getElementById('scheduleTitle');
        if (!container) return;

        const data = StorageManager.getCurrentData();
        if (!data.meeting || !data.meeting.slots || data.meeting.slots.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>「日程設定」ボタンから期間と時間を設定してください。</p></div>';
            if (title) title.innerText = 'スケジュール表';
            return;
        }

        const slots = data.meeting.slots;
        const settings = data.meeting.settings;

        // 日付ごとにグループ化（データ構造は変えない）
        const grouped = {};
        slots.forEach(slot => {
            if (!grouped[slot.date]) grouped[slot.date] = [];
            grouped[slot.date].push(slot);
        });

        // 列ヘッダー（日付）を抽出
        const dates = Object.keys(grouped).sort();
        if (dates.length === 0) return;

        // 時間リストを抽出（最初の日のスロットから）
        const firstDaySlots = grouped[dates[0]];
        const times = firstDaySlots.map(s => s.time);

        // マトリクス構築（転置：横軸＝日付、縦軸＝時間）
        // ヘッダー行：日付
        // 各行：時間 + 各日付の該当時間のスロット

        let html = `
            <div class="meeting-matrix">
                <div class="matrix-header-row">
                    <div class="matrix-corner" style="z-index: 3;">時間 / 日付</div>
                    ${dates.map(date => {
            const dateObj = new Date(date);
            const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`; // 幅を考慮して短縮
            const dayStr = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
            return `
                            <div class="matrix-header-date">
                                <div>${dateStr}</div>
                                <div style="font-size:0.8em">(${dayStr})</div>
                            </div>
                        `;
        }).join('')}
                </div>
        `;

        times.forEach(time => {
            html += `
                <div class="matrix-row">
                    <div class="matrix-time-header">${time}</div>
                    ${dates.map(date => {
                const dateSlots = grouped[date];
                const slot = dateSlots.find(s => s.time === time);
                return slot ? this.createSlotHtml(slot, data.students) : '<div class="matrix-slot disabled"></div>';
            }).join('')}
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

        // イベント付与（ロジックは変更なし）
        container.querySelectorAll('.matrix-slot').forEach(el => {
            if (el.classList.contains('disabled')) return;

            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                el.classList.add('drag-over');
            });
            el.addEventListener('dragleave', () => {
                el.classList.remove('drag-over');
            });
            el.addEventListener('drop', (e) => {
                e.preventDefault();
                el.classList.remove('drag-over');
                if (el.dataset.slotId) {
                    this.onDropToSlot(e, el.dataset.slotId);
                }
            });

            // スロット内の生徒のドラッグ開始
            const studentEl = el.querySelector('.slot-student-chip');
            if (studentEl) {
                studentEl.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    e.dataTransfer.effectAllowed = 'move';
                    this.draggedStudent = { id: studentEl.dataset.studentId, fromSlotId: el.dataset.slotId };
                });
            }

            // 削除ボタン
            const removeBtn = el.querySelector('.remove-assignment');
            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.unassignStudent(el.dataset.slotId);
                });
            }

            // 時間枠ロックボタン
            const slotLockBtn = el.querySelector('.slot-lock-btn');
            if (slotLockBtn) {
                slotLockBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleSlotLock(slotLockBtn.dataset.slotId);
                });
            }

            // 空枠ロックボタン
            const emptyLockBtn = el.querySelector('.slot-empty-lock-btn');
            if (emptyLockBtn) {
                emptyLockBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleSlotLock(emptyLockBtn.dataset.slotId);
                });
            }

            // 生徒ロックボタン
            const studentLockBtn = el.querySelector('.student-lock-btn');
            if (studentLockBtn) {
                studentLockBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleStudentLock(studentLockBtn.dataset.slotId);
                });
            }
        });
    },

    createSlotHtml(slot, students) {
        const data = StorageManager.getCurrentData();
        const lockedSlots = (data.meeting && data.meeting.lockedSlots) || [];
        const lockedStudents = (data.meeting && data.meeting.lockedStudents) || [];

        const isStudentLocked = lockedStudents.some(ls => ls.slotId === slot.id);

        // 生徒がいる場合は時間枠ロック（左上）は無効・不要とする
        let isSlotLocked = false;
        if (!slot.studentId) {
            isSlotLocked = lockedSlots.includes(slot.id);
        }

        let content = '';
        let lockBtns = '';

        if (slot.studentId) {
            const student = students.find(s => s.id === slot.studentId);
            if (student) {
                content = `
                    <div class="slot-student-chip ${isStudentLocked ? 'locked' : ''}" draggable="${!isStudentLocked}" data-student-id="${student.id}">
                        <span class="chip-number">${student.number}</span>
                        <span class="chip-name">${student.nameKanji}</span>
                        <button class="remove-assignment" title="解除">×</button>
                        <button class="student-lock-btn ${isStudentLocked ? 'active' : ''}" title="${isStudentLocked ? 'ロック解除' : 'ロック'}" data-slot-id="${slot.id}">
                            ${isStudentLocked ? '🔒' : '🔓'}
                        </button>
                    </div>
                `;
            }
        }

        // 時間枠ロックボタン（空枠の場合のみ表示）
        if (!slot.studentId) {
            lockBtns = `
                <button class="slot-empty-lock-btn ${isSlotLocked ? 'active' : ''}" title="${isSlotLocked ? '空枠ロック解除' : '空枠としてロック'}" data-slot-id="${slot.id}">
                    ${isSlotLocked ? '空枠解除' : '空枠'}
                </button>
            `;
        }

        return `
            <div class="matrix-slot ${slot.studentId ? 'occupied' : 'empty'} ${isSlotLocked ? 'slot-locked' : ''}" data-slot-id="${slot.id}">
                ${lockBtns}
                ${content}
            </div>
        `;
    },

    // 設定モーダルを開く
    openSettingsModal() {
        const today = new Date().toISOString().split('T')[0];
        const startDateInp = document.getElementById('meetingStartDate');
        const endDateInp = document.getElementById('meetingEndDate');

        const data = StorageManager.getCurrentData();
        const settings = (data.meeting && data.meeting.settings) || {};

        startDateInp.value = settings.startDate || today;
        endDateInp.value = settings.endDate || today;
        document.getElementById('startTime').value = settings.startTime || '13:00';
        document.getElementById('endTime').value = settings.endTime || '17:00';
        document.getElementById('slotDuration').value = settings.slotDuration || 15;
        document.getElementById('breakDuration').value = settings.breakDuration || 0;
        document.getElementById('skipWeekend').checked = settings.skipWeekend !== false; // default true

        document.getElementById('meetingSettingsModal').classList.add('active');
    },

    // スケジュール生成
    generateSchedule() {
        if (!confirm('既存のスケジュールがある場合、再生成すると現在の配置はすべて失われます。\nよろしいですか？')) {
            return;
        }

        const startDate = document.getElementById('meetingStartDate').value;
        const endDate = document.getElementById('meetingEndDate').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const slotDuration = parseInt(document.getElementById('slotDuration').value);
        const breakDuration = parseInt(document.getElementById('breakDuration').value);
        const skipWeekend = document.getElementById('skipWeekend').checked;

        if (!startDate || !endDate || !startTime || !endTime) {
            alert('すべての日時項目を入力してください');
            return;
        }

        if (startDate > endDate) {
            alert('終了日は開始日より後に設定してください');
            return;
        }

        // スロット生成ロジック
        const slots = [];
        let currentDay = new Date(startDate);
        const endDay = new Date(endDate);

        while (currentDay <= endDay) {
            // 土日スキップ判定
            const dayOfWeek = currentDay.getDay();
            if (skipWeekend && (dayOfWeek === 0 || dayOfWeek === 6)) {
                currentDay.setDate(currentDay.getDate() + 1);
                continue;
            }

            const dateStr = currentDay.toISOString().split('T')[0];

            // 時間ループ
            let [h, m] = startTime.split(':').map(Number);
            let currentTimeMin = h * 60 + m;
            let [endH, endM] = endTime.split(':').map(Number);
            let endTimeMin = endH * 60 + endM;

            while (currentTimeMin + slotDuration <= endTimeMin) {
                // 時間文字列生成
                const timeH = Math.floor(currentTimeMin / 60);
                const timeM = currentTimeMin % 60;
                const timeStr = `${String(timeH).padStart(2, '0')}:${String(timeM).padStart(2, '0')}`;

                // 終了時間算出（表示用）
                const slotEndMin = currentTimeMin + slotDuration;
                const slotEndH = Math.floor(slotEndMin / 60);
                const slotEndM = slotEndMin % 60;
                // const slotEndStr = `${String(slotEndH).padStart(2, '0')}:${String(slotEndM).padStart(2, '0')}`;

                slots.push({
                    id: `${dateStr}_${timeStr}`,
                    date: dateStr,
                    time: timeStr,
                    studentId: null
                });

                currentTimeMin += slotDuration + breakDuration;
            }

            currentDay.setDate(currentDay.getDate() + 1);
        }

        if (slots.length === 0) {
            alert('条件に一致する時間枠がありませんでした');
            return;
        }

        const data = StorageManager.getCurrentData();
        if (!data.meeting) data.meeting = {};

        data.meeting.settings = { startDate, endDate, startTime, endTime, slotDuration, breakDuration, skipWeekend };
        data.meeting.slots = slots;

        StorageManager.updateCurrentData(data);

        document.getElementById('meetingSettingsModal').classList.remove('active');
        this.render();
    },

    // 未配置へドロップ
    onDropToUnassigned(e) {
        if (!this.draggedStudent || !this.draggedStudent.fromSlotId) return;
        this.unassignStudent(this.draggedStudent.fromSlotId);
        this.draggedStudent = null;
    },

    // スロットへドロップ
    onDropToSlot(e, slotId) {
        if (!this.draggedStudent) return;

        const { id, fromSlotId } = this.draggedStudent;

        // 同じ場所なら無視
        if (fromSlotId === slotId) return;

        const data = StorageManager.getCurrentData();
        const slots = data.meeting.slots;

        // 移動先スロット
        const targetSlot = slots.find(s => s.id === slotId);
        if (!targetSlot) return;

        // 移動先に既に人がいれば、入れ替えるか、元の場所に移動させるか
        // ここでは単純に入れ替え（スワップ）を実装
        const existingStudentId = targetSlot.studentId;

        // 元の場所から削除
        if (fromSlotId) {
            const oldSlot = slots.find(s => s.id === fromSlotId);
            if (oldSlot) {
                oldSlot.studentId = existingStudentId; // 入れ替え
            }
        } else if (existingStudentId) {
            // 未配置からの移動だが、移動先に人がいる -> その人は未配置に戻る
            // 何もしなくてOK（slotsからIDが消えればrenderUnassignedStudentsで表示されるため）
        }

        targetSlot.studentId = id;

        StorageManager.updateCurrentData(data);
        this.render();
        this.draggedStudent = null;
    },

    unassignStudent(slotId) {
        const data = StorageManager.getCurrentData();
        const slot = data.meeting.slots.find(s => s.id === slotId);
        if (slot) {
            slot.studentId = null;
            StorageManager.updateCurrentData(data);
            this.render();
        }
    },

    clearAll() {
        if (!confirm('すべての割り当てとスケジュール設定を削除しますか？')) return;

        const data = StorageManager.getCurrentData();
        data.meeting = { settings: {}, slots: [] };
        StorageManager.updateCurrentData(data);
        this.render();
    },

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

        // 時間ごとに行を作る（マトリクス転置：行が時間、列が日付）
        // ※印刷物は時間割り形式（縦：時間、横：日付）の方が見やすいことが多い

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
                    html += `<td style="background:#ddd;">-</td>`; // 枠なし
                }
            });
            html += `</tr>`;
        });

        html += `
                    </tbody>
                </table>
            </body></html>
        `;

        const win = window.open('', '', 'width=1100,height=800');
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); }, 500);
    },

    // 時間枠ロック切り替え
    toggleSlotLock(slotId) {
        const data = StorageManager.getCurrentData();
        if (!data.meeting.lockedSlots) data.meeting.lockedSlots = [];

        const index = data.meeting.lockedSlots.indexOf(slotId);
        if (index > -1) {
            data.meeting.lockedSlots.splice(index, 1);
        } else {
            data.meeting.lockedSlots.push(slotId);
        }

        StorageManager.updateCurrentData(data);
        this.render();
    },

    // 生徒ロック切り替え
    toggleStudentLock(slotId) {
        const data = StorageManager.getCurrentData();
        if (!data.meeting.lockedStudents) data.meeting.lockedStudents = [];

        const index = data.meeting.lockedStudents.findIndex(ls => ls.slotId === slotId);
        if (index > -1) {
            data.meeting.lockedStudents.splice(index, 1);
        } else {
            data.meeting.lockedStudents.push({ slotId });
        }

        StorageManager.updateCurrentData(data);
        this.render();
    },

    // 履歴に保存
    saveToHistory() {
        const name = prompt('このスケジュールに名前を付けてください（例: 1学期保護者会）');
        if (!name) return;

        const data = StorageManager.getCurrentData();
        if (!data.meeting) data.meeting = {};
        if (!data.meeting.history) data.meeting.history = [];

        data.meeting.history.unshift({
            name: name,
            timestamp: new Date().toISOString(),
            slots: JSON.parse(JSON.stringify(data.meeting.slots)),
            settings: JSON.parse(JSON.stringify(data.meeting.settings)),
            lockedSlots: data.meeting.lockedSlots ? [...data.meeting.lockedSlots] : [],
            lockedStudents: data.meeting.lockedStudents ? [...data.meeting.lockedStudents] : []
        });

        // 最大10件
        data.meeting.history = data.meeting.history.slice(0, 10);
        StorageManager.updateCurrentData(data);
        alert('履歴に保存しました');
    },

    // 履歴から読み込み
    loadFromHistory(index) {
        const data = StorageManager.getCurrentData();
        const history = (data.meeting && data.meeting.history) || [];

        if (index >= history.length) return;

        const item = history[index];
        if (confirm(`「${item.name}」を読み込みますか？\\n現在のスケジュールは上書きされます。`)) {
            data.meeting.slots = JSON.parse(JSON.stringify(item.slots));
            data.meeting.settings = JSON.parse(JSON.stringify(item.settings));
            data.meeting.lockedSlots = item.lockedSlots ? [...item.lockedSlots] : [];
            data.meeting.lockedStudents = item.lockedStudents ? [...item.lockedStudents] : [];
            StorageManager.updateCurrentData(data);
            this.render();
        }
    },

    // 履歴を表示（旧方式、現在は新モーダルを使用）
    showHistory() {
        this.openHistoryModal();
    },

    openHistoryModal() {
        this.renderHistoryList();
        document.getElementById('meetingHistoryModal').classList.add('active');
    },

    closeHistoryModal() {
        document.getElementById('meetingHistoryModal').classList.remove('active');
    },

    renderHistoryList() {
        const container = document.getElementById('meetingHistoryList');
        if (!container) return;

        const data = StorageManager.getCurrentData();
        const history = (data.meeting && data.meeting.history) || [];

        let html = `
            <div style="margin-bottom: 20px; padding: 15px; background: #f1f5f9; border-radius: 8px;">
                <h4 style="margin-top:0;">現在の状態を保存</h4>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="newMeetingHistoryName" placeholder="例: 1学期末面談" class="form-control" style="flex:1;">
                    <button class="btn btn-primary" onclick="window.MeetingModule.saveCurrentToHistory()">保存</button>
                </div>
            </div>
            <h4>保存済みスケジュール</h4>
        `;

        if (history.length === 0) {
            html += '<div class="empty-state-small"><p>保存された履歴はありません</p></div>';
        } else {
            history.forEach((item, i) => {
                html += `
                    <div class="history-item">
                        <div class="history-info">
                            <div class="history-name">${item.name}</div>
                            <div class="history-meta">${new Date(item.timestamp).toLocaleString('ja-JP')}</div>
                        </div>
                        <div class="history-actions">
                            <button class="btn btn-sm btn-outline-primary" onclick="window.MeetingModule.loadFromHistory(${i})">読取</button>
                            <button class="btn btn-sm btn-outline-danger" onclick="window.MeetingModule.deleteHistory(${i})">削除</button>
                        </div>
                    </div>
                `;
            });
        }

        container.innerHTML = html;
    },

    saveCurrentToHistory() {
        const nameInput = document.getElementById('newMeetingHistoryName');
        const name = nameInput.value.trim() || `無題のスケジュール (${new Date().toLocaleTimeString()})`;

        const data = StorageManager.getCurrentData();
        if (!data.meeting) data.meeting = {};
        if (!data.meeting.history) data.meeting.history = [];

        data.meeting.history.unshift({
            name: name,
            timestamp: new Date().toISOString(),
            slots: JSON.parse(JSON.stringify(data.meeting.slots)),
            settings: JSON.parse(JSON.stringify(data.meeting.settings)),
            lockedSlots: data.meeting.lockedSlots ? [...data.meeting.lockedSlots] : [],
            lockedStudents: data.meeting.lockedStudents ? [...data.meeting.lockedStudents] : []
        });

        // 最大10件
        data.meeting.history = data.meeting.history.slice(0, 10);
        StorageManager.updateCurrentData(data);
        this.renderHistoryList();
        nameInput.value = '';
        alert('保存しました');
    },

    deleteHistory(index) {
        if (!confirm('この履歴を削除しますか？')) return;
        const data = StorageManager.getCurrentData();
        data.meeting.history.splice(index, 1);
        StorageManager.updateCurrentData(data);
        this.renderHistoryList();
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

        const showName = type === 'full'; // 'full' = 番号+名前, 'number' = 番号のみ

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

        const win = window.open('', '', 'width=800,height=1100');
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); }, 500);
    },

    // 希望時間モーダルを開く
    currentEditingStudentId: null,
    openPreferenceModal(studentId) {
        this.currentEditingStudentId = studentId;
        const data = StorageManager.getCurrentData();
        const student = data.students.find(s => s.id === studentId);
        if (!student) return;

        const titleEl = document.getElementById('preferenceModalTitle');
        if (titleEl) titleEl.innerText = `${student.nameKanji}さんの希望時間`;

        const container = document.getElementById('preferenceSlotsGrid');
        if (!container) return;

        const slots = (data.meeting && data.meeting.slots) ? data.meeting.slots : [];
        if (slots.length === 0) {
            container.innerHTML = '<p class="text-danger">まず「日程設定」を行ってください</p>';
            return;
        }

        const prefs = (data.meeting && data.meeting.studentPreferences && data.meeting.studentPreferences[studentId]) || [];

        // グループ化して表示（renderScheduleに似た形式）
        const grouped = {};
        slots.forEach(slot => {
            if (!grouped[slot.date]) grouped[slot.date] = [];
            grouped[slot.date].push(slot);
        });

        const dates = Object.keys(grouped).sort();
        const times = grouped[dates[0]].map(s => s.time);

        let html = `
            <div class="meeting-matrix pref-matrix">
                <div class="matrix-header-row">
                    <div class="matrix-corner">時間 / 日付</div>
                    ${dates.map(date => {
            const d = new Date(date);
            return `
                            <div class="matrix-header-date">
                                <div>${d.getMonth() + 1}/${d.getDate()} (${['日', '月', '火', '水', '木', '金', '土'][d.getDay()]})</div>
                                <div style="display: flex; justify-content: center; gap: 2px;">
                                    <button class="col-select-btn" onclick="window.MeetingModule.toggleColumnPref('${date}', true)">全選択</button>
                                    <button class="col-select-btn" onclick="window.MeetingModule.toggleColumnPref('${date}', false)">解除</button>
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>
        `;

        times.forEach(time => {
            html += `
                <div class="matrix-row">
                    <div class="matrix-time-header">${time}</div>
                    ${dates.map(date => {
                const slot = grouped[date].find(s => s.time === time);
                const isSelected = prefs.includes(slot.id);
                return `<div class="matrix-slot pref-slot ${isSelected ? 'selected' : ''}" data-slot-id="${slot.id}" data-date="${date}">${isSelected ? '〇' : ''}</div>`;
            }).join('')}
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

        // クリックイベント
        container.querySelectorAll('.pref-slot').forEach(el => {
            el.addEventListener('click', () => {
                el.classList.toggle('selected');
                el.innerText = el.classList.contains('selected') ? '〇' : '';
            });
        });

        document.getElementById('meetingPreferenceModal').classList.add('active');
    },

    // 希望時間を保存
    savePreference() {
        if (!this.currentEditingStudentId) return;

        const selectedSlotIds = Array.from(document.querySelectorAll('.pref-slot.selected'))
            .map(el => el.dataset.slotId);

        const data = StorageManager.getCurrentData();
        if (!data.meeting) data.meeting = {};
        if (!data.meeting.studentPreferences) data.meeting.studentPreferences = {};

        data.meeting.studentPreferences[this.currentEditingStudentId] = selectedSlotIds;

        StorageManager.updateCurrentData(data);
        document.getElementById('meetingPreferenceModal').classList.remove('active');
        this.render();
    },

    // 自動配置ロジック
    autoAssignSlots() {
        const data = StorageManager.getCurrentData();
        if (!data.meeting || !data.meeting.slots || data.meeting.slots.length === 0) {
            alert('まず日程設定を行ってください');
            return;
        }

        if (!confirm('すでに配置されている生徒も、ロックされていない限り再配置されます。よろしいですか？')) {
            return;
        }

        const slots = data.meeting.slots;
        const students = data.students || [];
        const prefs = data.meeting.studentPreferences || {};
        const lockedSlots = data.meeting.lockedSlots || [];
        const lockedStudents = data.meeting.lockedStudents || [];

        // ロックされている情報を整理
        const lockedSlotIds = new Set(lockedSlots);
        const lockedStudentIds = new Set(lockedStudents.map(ls => {
            const slot = slots.find(s => s.id === ls.slotId);
            return slot ? slot.studentId : null;
        }).filter(id => id));

        // すでに埋まっているがロックされていないスロットをクリア
        slots.forEach(slot => {
            const isStudentLocked = lockedStudents.some(ls => ls.slotId === slot.id);
            if (!isStudentLocked && !lockedSlotIds.has(slot.id)) {
                slot.studentId = null;
            }
        });

        // 配置すべき生徒を抽出（ロックされていない生徒全員）
        const studentsToAssign = students.filter(s => !lockedStudentIds.has(s.id));

        // アルゴリズム: 制約が厳しい（希望枠が少ない）生徒から順に埋める
        // 希望がない生徒は「すべての空枠が希望」とみなす
        const assignableSlots = slots.filter(s => !s.studentId && !lockedSlotIds.has(s.id));

        const studentData = studentsToAssign.map(s => {
            let studentPrefs = prefs[s.id] || [];
            // 希望枠のうち、現在利用可能な（ロックされていない）ものだけを有効とする
            let validPrefs = studentPrefs.filter(id => {
                const slot = slots.find(sl => sl.id === id);
                return slot && !slot.studentId && !lockedSlotIds.has(id);
            });

            return {
                id: s.id,
                name: s.nameKanji,
                prefs: validPrefs,
                prefCount: validPrefs.length === 0 ? 999 : validPrefs.length // 希望なしは後回し
            };
        });

        // 希望枠が少ない順にソート。希望なしは最後。
        studentData.sort((a, b) => a.prefCount - b.prefCount);

        let successCount = 0;
        let failStudents = [];

        studentData.forEach(sData => {
            let assigned = false;

            // 希望がある場合
            if (sData.prefs.length > 0) {
                // 希望の中から空いているスロットを探す
                for (let slotId of sData.prefs) {
                    const slot = slots.find(sl => sl.id === slotId);
                    if (slot && !slot.studentId) {
                        slot.studentId = sData.id;
                        assigned = true;
                        successCount++;
                        break;
                    }
                }
            }

            // 希望がない、または希望がすべて埋まっていた場合、空いている適当な枠に入れる
            if (!assigned) {
                const remainingSlot = slots.find(sl => !sl.studentId && !lockedSlotIds.has(sl.id));
                if (remainingSlot) {
                    remainingSlot.studentId = sData.id;
                    assigned = true;
                    successCount++;
                } else {
                    failStudents.push(sData.name);
                }
            }
        });

        StorageManager.updateCurrentData(data);
        this.render();

        if (failStudents.length > 0) {
            alert(`${successCount}人を配置しました。\n枠が足りない、または希望が重なり配置できなかった生徒: ${failStudents.join(', ')}`);
        } else {
            alert(`${successCount}人の配置が完了しました！`);
        }
    },

    // 列（日付）ごとに一括選択/解除
    toggleColumnPref(date, select) {
        document.querySelectorAll(`.pref-slot[data-date="${date}"]`).forEach(el => {
            if (select) {
                el.classList.add('selected');
                el.innerText = '〇';
            } else {
                el.classList.remove('selected');
                el.innerText = '';
            }
        });
    },

    // 全ての生徒の希望時間をリセット
    resetAllPreferences() {
        if (!confirm('全ての生徒の希望時間をリセットしてもよろしいですか？\nこの操作は取り消せません。')) return;

        const data = StorageManager.getCurrentData();
        if (!data.meeting) data.meeting = {};

        // 個人に紐づく希望データをクリア
        data.meeting.studentPreferences = {};

        StorageManager.updateCurrentData(data);
        this.render();
        alert('全ての希望時間をリセットしました。');
    },

    // 現在の配置が希望（★マーク）通りかチェックする
    checkAssignmentsAgainstPreferences() {
        const data = StorageManager.getCurrentData();
        if (!data.meeting || !data.meeting.slots) {
            alert('スケジュールが設定されていません。');
            return;
        }

        const slots = data.meeting.slots;
        const students = data.students || [];
        const prefs = data.meeting.studentPreferences || {};

        let mismatches = [];
        let unassignedWithPrefs = [];

        // 配置されている生徒のチェック
        slots.forEach(slot => {
            if (slot.studentId) {
                const studentPrefs = prefs[slot.studentId];
                if (studentPrefs && studentPrefs.length > 0) {
                    if (!studentPrefs.includes(slot.id)) {
                        const student = students.find(s => s.id === slot.studentId);
                        mismatches.push(`${student ? student.number + ' ' + student.nameKanji : slot.studentId} (希望外の時間に配置)`);
                    }
                }
            }
        });

        // 配置されていないが希望がある生徒のチェック
        const assignedStudentIds = new Set(slots.map(s => s.studentId).filter(id => id));
        students.forEach(s => {
            if (!assignedStudentIds.has(s.id)) {
                const studentPrefs = prefs[s.id];
                if (studentPrefs && studentPrefs.length > 0) {
                    unassignedWithPrefs.push(`${s.number} ${s.nameKanji} (未配置)`);
                }
            }
        });

        if (mismatches.length === 0 && unassignedWithPrefs.length === 0) {
            alert('✅ 全ての生徒が希望通りの時間に配置されている、または希望が設定されていません。');
        } else {
            let message = '⚠️ 以下の項目を確認してください:\n\n';
            if (mismatches.length > 0) {
                message += '【希望と異なる配置】\n' + mismatches.join('\n') + '\n\n';
            }
            if (unassignedWithPrefs.length > 0) {
                message += '【希望があるのに未配置】\n' + unassignedWithPrefs.join('\n');
            }
            alert(message);
        }
    }
};

window.MeetingModule = MeetingModule;
