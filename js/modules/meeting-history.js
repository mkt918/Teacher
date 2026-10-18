// ===== 保護者会時間決定ツールモジュール (履歴管理) =====

Object.assign(MeetingModule, {

    openHistoryModal() {
        window.HistoryModal.open({
            modalId: 'meetingHistoryModal',
            title: '保護者会スケジュール保存／読取',
            getHistory: () => this._getNormalizedHistory(),
            setHistory: (history) => {
                const data = StorageManager.getCurrentData();
                if (!data.meeting) data.meeting = {};
                data.meeting.history = history;
                StorageManager.updateCurrentData(data);
            },
            // 生徒ごとの希望時間も一緒に保存する
            getSnapshot: () => {
                const meeting = StorageManager.getCurrentData().meeting || {};
                return {
                    slots: meeting.slots || [],
                    settings: meeting.settings || {},
                    lockedSlots: meeting.lockedSlots || [],
                    lockedStudents: meeting.lockedStudents || [],
                    studentPreferences: meeting.studentPreferences || {}
                };
            },
            applySnapshot: (snapshot) => {
                const data = StorageManager.getCurrentData();
                if (!data.meeting) data.meeting = {};
                data.meeting.slots = snapshot.slots || [];
                data.meeting.settings = snapshot.settings || {};
                data.meeting.lockedSlots = snapshot.lockedSlots || [];
                data.meeting.lockedStudents = snapshot.lockedStudents || [];
                data.meeting.studentPreferences = snapshot.studentPreferences || {};
                StorageManager.updateCurrentData(data);
                this.render();
            }
        });
    },

    // 旧形式（{name, timestamp, slots, settings, ...} が直接並ぶ）の履歴を、
    // 共通のHistoryModal形式（{name, timestamp, data}）へ変換して返す
    _getNormalizedHistory() {
        const data = StorageManager.getCurrentData();
        let history = (data.meeting && data.meeting.history) || [];
        const isLegacy = (item) => item.data === undefined && item.slots !== undefined;

        if (history.some(isLegacy)) {
            history = history.map(item => isLegacy(item) ? {
                name: item.name,
                timestamp: item.timestamp,
                data: {
                    slots: item.slots,
                    settings: item.settings,
                    lockedSlots: item.lockedSlots,
                    lockedStudents: item.lockedStudents,
                    studentPreferences: item.studentPreferences
                }
            } : item);
            data.meeting.history = history;
        }
        return history;
    }
});
