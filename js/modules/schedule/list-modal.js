// ===== スケジュールモジュール: 時間割一覧 =====
// 日ごとの予定を週単位で一覧・変更するモーダル。
// 本体(ScheduleModule)は index.js。このファイルは index.js より後に読み込むこと。

Object.assign(ScheduleModule, {

    /**
     * 時間割一覧モーダルを開く
     */
    openTimetableListModal() {
        document.getElementById('timetableListModal')?.remove();

        // 現在の週の開始日（月曜）を取得
        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset);

        // デフォルトで14日間（土日含む）表示
        const endDate = new Date(monday);
        endDate.setDate(monday.getDate() + 13);

        const startStr = formatDate(monday);
        const endStr = formatDate(endDate);

        const modal = document.createElement('div');
        modal.id = 'timetableListModal';
        modal.className = 'modal active';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `
            <div class="modal-content modal-scroll tt-list-modal">
                <div class="modal-header">
                    <h3>📅 時間割一覧/変更</h3>
                    <div class="tt-list-header-actions">
                        <button id="resetTimetableChangesBtn" class="btn btn-danger btn-sm" title="この期間の変更データを全て削除してベースに戻す" aria-label="この期間の変更データを全て削除してベースに戻す">🗑️ 変更リセット</button>
                        <span class="tt-list-autosave">✅ 変更はすぐに保存されます</span>
                        <button class="modal-close" aria-label="閉じる" id="closeTimetableListModal">✕</button>
                    </div>
                </div>
                <div class="modal-body modal-body-scroll">
                    <div class="timetable-list-notice">
                        ⚠️ <strong>この一覧が授業時数カウントのベースとなります。</strong>
                        参観日や行事で土日に授業がある場合もここで設定してください。
                    </div>
                    <div class="timetable-list-controls">
                        <div class="timetable-tabs">
                            <button class="tt-tab ${this.activeTimetable === 'my' ? 'active' : ''}" data-tt="my" id="ttListTabMy">自分の時間割</button>
                            <button class="tt-tab ${this.activeTimetable === 'class' ? 'active' : ''}" data-tt="class" id="ttListTabClass">クラス時間割</button>
                        </div>
                        <div class="tt-list-group">
                            <button class="btn btn-sm" id="ttListPrevWeekBtn">◀ 前の週</button>
                            <button class="btn btn-sm" id="ttListNextWeekBtn">次の週 ▶</button>
                        </div>
                        <div class="tt-list-group">
                            <input type="date" id="ttListStartDate" aria-label="表示する期間の開始日" value="${startStr}">
                            <span>〜</span>
                            <input type="date" id="ttListEndDate" value="${endStr}" aria-label="表示する期間の終了日">
                            <button class="btn btn-sm" id="ttListRefreshBtn">表示</button>
                        </div>
                    </div>
                    <div id="timetableListContent">
                        <!-- 一覧テーブルがここに描画される -->
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // イベント設定
        document.getElementById('closeTimetableListModal').addEventListener('click', () => {
            modal.remove();
        });

        document.getElementById('resetTimetableChangesBtn').addEventListener('click', async () => {
            if (!await UI.confirm('表示中の期間の変更データを全て削除して、ベースの時間割に戻します。\n（ベース時間割の設定は消えません）', { title: '変更をリセット', confirmLabel: 'ベースに戻す', danger: true })) return;
            const startStr = document.getElementById('ttListStartDate')?.value;
            const endStr = document.getElementById('ttListEndDate')?.value;
            if (!startStr || !endStr) return;
            const start = new Date(startStr);
            const end = new Date(endStr);
            const type = this.activeTimetable;
            if (!this.dailyChanges[type]) this.dailyChanges[type] = {};
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateKey = formatDate(new Date(d));
                delete this.dailyChanges[type][dateKey];
            }
            this.saveData();
            this._renderTimetableList();
        });

        document.getElementById('ttListTabMy').addEventListener('click', () => {
            this.activeTimetable = 'my';
            this._renderTimetableList();
        });

        document.getElementById('ttListTabClass').addEventListener('click', () => {
            this.activeTimetable = 'class';
            this._renderTimetableList();
        });

        document.getElementById('ttListRefreshBtn').addEventListener('click', () => {
            this._renderTimetableList();
        });

        // 前の週・次の週ボタン
        document.getElementById('ttListPrevWeekBtn').addEventListener('click', () => {
            this._moveTimetableListWeek(-1);
        });
        document.getElementById('ttListNextWeekBtn').addEventListener('click', () => {
            this._moveTimetableListWeek(1);
        });

        // 初回描画
        this._renderTimetableList();
    },

    /**
     * 時間割一覧の期間を週単位で移動
     */
    _moveTimetableListWeek(offset) {
        const startInput = document.getElementById('ttListStartDate');
        const endInput = document.getElementById('ttListEndDate');
        if (!startInput || !endInput) return;

        const start = new Date(startInput.value);
        const end = new Date(endInput.value);

        start.setDate(start.getDate() + (offset * 7));
        end.setDate(end.getDate() + (offset * 7));

        startInput.value = formatDate(start);
        endInput.value = formatDate(end);

        this._renderTimetableList();
    },

    /**
     * 時間割一覧テーブルを描画
     */
    _renderTimetableList() {
        const container = document.getElementById('timetableListContent');
        if (!container) return;

        const startStr = document.getElementById('ttListStartDate')?.value;
        const endStr = document.getElementById('ttListEndDate')?.value;
        if (!startStr || !endStr) return;

        const start = new Date(startStr);
        const end = new Date(endStr);

        // 設定から曜日ごとの時限数を取得
        const data = window.StorageManager?.getCurrentData() || {};
        const periodsPerDay = data.appSettings?.periodsPerDay || { mon: 6, tue: 6, wed: 6, thu: 6, fri: 6 };

        // 日付リストを生成（指定期間全て、土日含む）
        const dates = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(new Date(d));
        }

        if (dates.length === 0) {
            container.innerHTML = '<p>表示する日付がありません</p>';
            return;
        }

        // 行事データを取得
        const events = window.CalendarModule?.events || [];

        // タブ状態の更新
        document.getElementById('ttListTabMy').className = `tt-tab ${this.activeTimetable === 'my' ? 'active' : ''}`;
        document.getElementById('ttListTabClass').className = `tt-tab ${this.activeTimetable === 'class' ? 'active' : ''}`;

        // ベース時間割
        const baseTimetable = this.activeTimetable === 'class' ? this.classTimetable : this.myTimetable;
        const changes = this.dailyChanges[this.activeTimetable] || {};

        // 最大時限数 (6限まで + 7限目(放課後))
        const maxPeriods = 7;

        // テーブル生成
        let html = '<table class="timetable-list-table"><thead><tr><th>時限</th>';
        dates.forEach(d => {
            const dayNames = WEEKDAY_LABELS;
            const dayOfWeek = d.getDay();
            const dayClass = dayOfWeek === 0 ? 'sunday' : (dayOfWeek === 6 ? 'saturday' : '');
            const dateStr = `${d.getMonth() + 1}/${d.getDate()}(${dayNames[dayOfWeek]})`;
            html += `<th class="date-header ${dayClass}">${dateStr}</th>`;
        });
        html += '</tr></thead><tbody>';

        // 行事行
        html += '<tr class="event-row"><td>行事</td>';
        dates.forEach(d => {
            const dateKey = formatDate(d);
            const dayEvents = events.filter(e => {
                const eStart = new Date(e.start);
                const eEnd = e.end ? new Date(e.end) : eStart;
                return d >= new Date(eStart.getFullYear(), eStart.getMonth(), eStart.getDate()) &&
                    d <= new Date(eEnd.getFullYear(), eEnd.getMonth(), eEnd.getDate());
            });
            const eventText = dayEvents.map(e => e.title).join(', ');
            html += `<td class="event-cell">${eventText || ''}</td>`;
        });
        html += '</tr>';

        // 時限行
        for (let p = 0; p < maxPeriods; p++) {
            let periodLabel = (p === 6) ? '放課後' : `${p + 1}限`;
            html += `<tr><td class="period-cell ${p === 6 ? 'tt-after-school' : ''}">${periodLabel}</td>`;
            dates.forEach(d => {
                const dayOfWeek = d.getDay();
                const dayKey = WEEKDAY_KEYS[dayOfWeek];
                const dateKey = formatDate(d);
                const periods = periodsPerDay[dayKey] !== undefined ? periodsPerDay[dayKey] : 0;

                // 変更データがある場合はセルの存在を許可する（手動設定対応）
                // キーは0ベース（p）で管理、data-periodは1ベース（p+1）でダッシュボードと統一
                const hasChange = changes[dateKey] && changes[dateKey][p] !== undefined;

                // 土日でもセルは常にクリック可能（強制設定可能）
                const forceEnabled = true;

                if (p >= periods && !hasChange && !forceEnabled) {
                    html += '<td class="disabled-cell"></td>';
                    return;
                }

                // 変更があればそれを表示、なければベース
                let value = '';
                if (changes[dateKey] && changes[dateKey][p] !== undefined) {
                    value = changes[dateKey][p];
                } else {
                    value = baseTimetable[dayKey]?.[p] || '';
                }
                const isChanged = changes[dateKey] && changes[dateKey][p] !== undefined;
                const dayClass = dayOfWeek === 0 ? 'sunday-cell' : (dayOfWeek === 6 ? 'saturday-cell' : '');

                // data-periodは0ベース（pをそのまま使用）
                html += `<td class="tt-list-cell ${isChanged ? 'changed' : ''} ${dayClass}" data-date="${dateKey}" data-period="${p}">${escapeHtml(value)}</td>`;
            });
            html += '</tr>';
        }

        // 操作行
        html += '<tr class="action-row"><td>操作</td>';
        dates.forEach(d => {
            const dateKey = formatDate(d);
            html += `<td>
                <button class="btn-icon tt-clear-btn" data-date="${dateKey}" title="空にする" aria-label="空にする">🗑️</button>
                <button class="btn-icon tt-reset-btn" data-date="${dateKey}" title="ベースに戻す" aria-label="ベースに戻す">↩️</button>
            </td>`;
        });
        html += '</tr>';

        html += '</tbody></table>';
        container.innerHTML = html;

        // セルクリックイベント
        container.querySelectorAll('.tt-list-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                this._openSubjectPicker(cell.dataset.date, parseInt(cell.dataset.period), cell);
            });
        });

        // 一括削除ボタン
        container.querySelectorAll('.tt-clear-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._clearDaySchedule(btn.dataset.date);
            });
        });

        // ベースに戻すボタン
        container.querySelectorAll('.tt-reset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._resetDayToBase(btn.dataset.date);
            });
        });
    },

    /**
     * 科目選択ポップアップを開く
     */
    _openSubjectPicker(dateKey, period, cell) {
        document.querySelector('.subject-picker-popup')?.remove();

        const subjects = this.activeTimetable === 'class' ? this.classSubjects : this.mySubjects;

        const popup = document.createElement('div');
        popup.className = 'subject-picker-popup';
        popup.innerHTML = `
            <div class="subject-picker-header">科目を選択</div>
            <div class="subject-picker-list">
                <div class="subject-item" data-subject="">（空欄）</div>
                ${subjects.map(s => `<div class="subject-item" data-subject="${escapeHtml(s)}">${escapeHtml(s)}</div>`).join('')}
            </div>
        `;

        // 位置調整
        const rect = cell.getBoundingClientRect();
        popup.style.position = 'fixed';
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + 5}px`;

        document.body.appendChild(popup);

        // 科目選択
        popup.querySelectorAll('.subject-item').forEach(item => {
            item.addEventListener('click', () => {
                const subject = item.dataset.subject;
                this._setDayPeriodValue(dateKey, period, subject);
                popup.remove();
                // 保存後に一覧を再描画して反映確認
                this._renderTimetableList();
            });
        });

        // 外側クリックで閉じる
        setTimeout(() => {
            document.addEventListener('click', function closePopup(e) {
                if (!popup.contains(e.target) && e.target !== cell) {
                    popup.remove();
                    document.removeEventListener('click', closePopup);
                }
            });
        }, 0);
    },

    _setDayPeriodValue(dateKey, period, value) {
        if (!this.dailyChanges[this.activeTimetable]) {
            this.dailyChanges[this.activeTimetable] = {};
        }
        if (!this.dailyChanges[this.activeTimetable][dateKey]) {
            this.dailyChanges[this.activeTimetable][dateKey] = {};
        }
        // periodは0ベース（data-period属性のpをそのまま受け取る）
        this.dailyChanges[this.activeTimetable][dateKey][period] = value;
        this.saveData();
    },

    async _clearDaySchedule(dateKey) {
        if (!await UI.confirm(`${dateKey} の時間割を全て空にします。`, { title: '時間割を空にする', confirmLabel: '全て空にする', danger: true })) return;
        const data = window.StorageManager?.getCurrentData() || {};
        const periodsPerDay = data.appSettings?.periodsPerDay || { mon: 6, tue: 6, wed: 6, thu: 6, fri: 6 };
        const d = new Date(dateKey);
        const dayKey = WEEKDAY_KEYS[d.getDay()];
        const periods = periodsPerDay[dayKey] || 6;

        if (!this.dailyChanges[this.activeTimetable]) {
            this.dailyChanges[this.activeTimetable] = {};
        }
        this.dailyChanges[this.activeTimetable][dateKey] = {};
        for (let p = 0; p < periods; p++) {
            this.dailyChanges[this.activeTimetable][dateKey][p] = '';
        }
        this.saveData();
        this._renderTimetableList();
    },

    async _resetDayToBase(dateKey) {
        if (!await UI.confirm(`${dateKey} の時間割を、変更前のベースの時間割に戻します。`, { title: 'ベースに戻す', confirmLabel: 'ベースに戻す', danger: true })) return;
        if (this.dailyChanges[this.activeTimetable]) {
            delete this.dailyChanges[this.activeTimetable][dateKey];
        }
        this.saveData();
        this._renderTimetableList();
    },

    // 指定日の時限数を取得（設定から）
    _getPeriodCountForDay(date) {
        const data = StorageManager.getCurrentData();
        const settings = data.appSettings || {};
        const periodsPerDay = settings.periodsPerDay || {};
        const dayOfWeek = date.getDay();
        const dayName = WEEKDAY_KEYS[dayOfWeek];
        return periodsPerDay[dayName] || 6;
    }
});
