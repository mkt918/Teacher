// ===== 保護者会時間決定ツールモジュール (コア) =====

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

        // 日付ごとにグループ化
        const grouped = {};
        slots.forEach(slot => {
            if (!grouped[slot.date]) grouped[slot.date] = [];
            grouped[slot.date].push(slot);
        });

        // 列ヘッダー（日付）を抽出
        const dates = Object.keys(grouped).sort();
        if (dates.length === 0) return;

        // 時間リストを抽出
        const firstDaySlots = grouped[dates[0]];
        const times = firstDaySlots.map(s => s.time);

        let html = `
            <div class="meeting-matrix">
                <div class="matrix-header-row">
                    <div class="matrix-corner" style="z-index: 3;">時間 / 日付</div>
                    ${dates.map(date => {
            const dateObj = new Date(date);
            const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
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

        // イベント付与
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
        document.getElementById('skipWeekend').checked = settings.skipWeekend !== false;

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

        const slots = [];
        let currentDay = new Date(startDate);
        const endDay = new Date(endDate);

        while (currentDay <= endDay) {
            const dayOfWeek = currentDay.getDay();
            if (skipWeekend && (dayOfWeek === 0 || dayOfWeek === 6)) {
                currentDay.setDate(currentDay.getDate() + 1);
                continue;
            }

            const dateStr = currentDay.toISOString().split('T')[0];

            let [h, m] = startTime.split(':').map(Number);
            let currentTimeMin = h * 60 + m;
            let [endH, endM] = endTime.split(':').map(Number);
            let endTimeMin = endH * 60 + endM;

            while (currentTimeMin + slotDuration <= endTimeMin) {
                const timeH = Math.floor(currentTimeMin / 60);
                const timeM = currentTimeMin % 60;
                const timeStr = `${String(timeH).padStart(2, '0')}:${String(timeM).padStart(2, '0')}`;

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

        if (fromSlotId === slotId) return;

        const data = StorageManager.getCurrentData();
        const slots = data.meeting.slots;

        const targetSlot = slots.find(s => s.id === slotId);
        if (!targetSlot) return;

        const existingStudentId = targetSlot.studentId;

        if (fromSlotId) {
            const oldSlot = slots.find(s => s.id === fromSlotId);
            if (oldSlot) {
                oldSlot.studentId = existingStudentId;
            }
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
    }
};

// グローバルに公開
window.MeetingModule = MeetingModule;
