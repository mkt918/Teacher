/**
 * CalendarModule - 年間行事計画管理
 * 
 * 機能:
 * - 4月始まりの年間カレンダー管理
 * - 予定（1日、期間）の登録・編集
 * - スケジュール表へのデータ提供
 */

const CalendarModule = {
    name: 'CalendarModule',
    initialized: false,

    // 行事データ
    // events: [ { id, title, start, end, type: 'day'|'period', memo, files: [] } ]
    events: [],

    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(),

    /**
     * 初期化
     */
    init() {
        if (this.initialized) return;
        this._determineFiscalYear();
        this.loadEvents();
        this.setupEventListeners();
        this.initialized = true;
        console.log('🗓️ CalendarModule initialized');
    },

    /**
     * イベントリスナーのセットアップ
     */
    setupEventListeners() {
        this._setupButton('addEventBtn', () => this.promptAddEvent());
        this._setupButton('prevMonthBtn', () => this.changeMonth(-1));
        this._setupButton('nextMonthBtn', () => this.changeMonth(1));
        this._setupButton('printCalendarBtn', () => this.printCalendar());
    },

    _setupButton(id, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', callback);
    },

    /**
     * 今日の日付から表示年月を決定（常に現在の年月を表示）
     */
    _determineFiscalYear() {
        const now = new Date();
        // 常に現在の年月を表示
        this.currentYear = now.getFullYear();
        this.currentMonth = now.getMonth();
    },

    /**
     * 描画
     */
    render() {
        this.loadEvents();
        this.renderMonthDisplay();
        this.renderCalendarGrid();
        this.renderEventList();
    },

    renderMonthDisplay() {
        const display = document.getElementById('calendarMonthDisplay');
        if (display) {
            display.textContent = `${this.currentYear}年 ${this.currentMonth + 1}月`;
        }
    },

    renderCalendarGrid() {
        const container = document.getElementById('calendarGrid');
        if (!container) return;

        const days = ['月', '火', '水', '木', '金', '土', '日'];
        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);

        // 月曜始まりのための補正 (0:日曜 -> 6, 1:月曜 -> 0)
        let startDayOfWeek = firstDay.getDay() - 1;
        if (startDayOfWeek < 0) startDayOfWeek = 6;

        let html = '<div class="calendar-header" style="display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-weight: bold; margin-bottom: 5px;">';
        days.forEach((d, i) => {
            // 月曜始まり: インデックス6(日曜)を赤、5(土曜)を青
            const color = i === 6 ? 'color: #e53e3e;' : (i === 5 ? 'color: #3b82f6;' : '');
            html += `<div style="${color}">${d}</div>`;
        });
        html += '</div><div class="calendar-body" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;">';

        // 前月の空白
        for (let i = 0; i < startDayOfWeek; i++) {
            html += '<div class="calendar-cell" style="padding: 5px; min-height: 60px; background: #f9f9f9;"></div>';
        }

        // 日付
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayEvents = this.getEventsForDate(dateStr);
            const dayOfWeek = new Date(this.currentYear, this.currentMonth, d).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const bgColor = isWeekend ? '#fef2f2' : '#fff';

            html += `<div class="calendar-cell" data-date="${dateStr}" style="padding: 5px; min-height: 60px; border: 1px solid #e5e7eb; background: ${bgColor}; cursor: pointer;">
                <div style="font-weight: bold; ${dayOfWeek === 0 ? 'color: #e53e3e;' : (dayOfWeek === 6 ? 'color: #3b82f6;' : '')}">${d}</div>
                <div style="font-size: 0.75em;">
                    ${dayEvents.slice(0, 2).map(e => {
                const eventBg = e.highlight ? '#fecaca' : '#dbeafe';
                const eventColor = e.highlight ? '#b91c1c' : 'inherit';
                return `<div style="background: ${eventBg}; color: ${eventColor}; border-radius: 2px; padding: 1px 3px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: ${e.highlight ? 'bold' : 'normal'};">${e.title}</div>`;
            }).join('')}
                    ${dayEvents.length > 2 ? `<div style="color: #6b7280;">他${dayEvents.length - 2}件</div>` : ''}
                </div>
            </div>`;
        }

        html += '</div>';
        container.innerHTML = html;

        // セルクリックでイベント追加
        container.querySelectorAll('.calendar-cell[data-date]').forEach(cell => {
            cell.addEventListener('click', () => {
                this.promptAddEvent(cell.dataset.date);
            });
        });
    },

    renderEventList() {
        const container = document.getElementById('eventList');
        if (!container) return;

        const monthEvents = this.events.filter(e => {
            const d = new Date(e.start);
            return d.getFullYear() === this.currentYear && d.getMonth() === this.currentMonth;
        }).sort((a, b) => a.start.localeCompare(b.start));

        if (monthEvents.length === 0) {
            container.innerHTML = '<p style="color: #999;">この月の行事はありません</p>';
            return;
        }

        container.innerHTML = '<h4>今月の行事一覧</h4>' + monthEvents.map(e => {
            const d = new Date(e.start);
            const weekday = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
            const highlightStyle = e.highlight
                ? 'background: linear-gradient(135deg, #fef2f2, #fecaca); border-left: 4px solid #ef4444; color: #b91c1c;'
                : '';
            const highlightIcon = e.highlight ? '⭐' : '☆';
            return `<div style="display: flex; gap: 10px; padding: 8px; border-bottom: 1px solid #eee; align-items: center; border-radius: 4px; ${highlightStyle}">
                <span style="min-width: 100px; font-weight: ${e.highlight ? 'bold' : 'normal'};">${e.start.substring(5)} (${weekday})</span>
                <span style="flex: 1; font-weight: ${e.highlight ? 'bold' : 'normal'};">${e.title}</span>
                <button class="btn-icon" onclick="CalendarModule.toggleHighlight('${e.id}')" title="強調表示">${highlightIcon}</button>
                <button class="btn-icon" onclick="CalendarModule.deleteEvent('${e.id}'); CalendarModule.render();">🗑️</button>
            </div>`;
        }).join('');
    },

    // 強調表示をトグル
    toggleHighlight(id) {
        const event = this.events.find(e => e.id === id);
        if (event) {
            event.highlight = !event.highlight;
            this.saveEvents();
            this.render();
        }
    },

    changeMonth(delta) {
        this.currentMonth += delta;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.render();
    },

    promptAddEvent(date) {
        const eventDate = date || prompt('開始日を入力してください (YYYY-MM-DD形式)',
            `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-01`);
        if (!eventDate) return;

        const title = prompt('行事名を入力してください');
        if (!title) return;

        // 期間設定を確認
        const isPeriod = confirm('期間を設定しますか？（OKで期間設定、キャンセルで単日）');
        let endDate = null;
        let eventType = 'day';

        if (isPeriod) {
            endDate = prompt('終了日を入力してください (YYYY-MM-DD形式)', eventDate);
            if (endDate && endDate >= eventDate) {
                eventType = 'period';
            } else if (endDate) {
                alert('終了日は開始日以降に設定してください');
                return;
            }
        }

        this.addEvent({
            start: eventDate,
            end: endDate,
            title: title,
            type: eventType
        });
        this.render();
    },

    /**
     * イベントを追加
     */
    addEvent(event) {
        const newEvent = {
            id: Date.now().toString(),
            ...event
        };
        this.events.push(newEvent);
        this.saveEvents();
        return newEvent;
    },

    /**
     * イベントを更新
     */
    updateEvent(id, updates) {
        const index = this.events.findIndex(e => e.id === id);
        if (index !== -1) {
            this.events[index] = { ...this.events[index], ...updates };
            this.saveEvents();
        }
    },

    /**
     * イベントを削除
     */
    deleteEvent(id) {
        this.events = this.events.filter(e => e.id !== id);
        this.saveEvents();
    },

    /**
     * 特定の月のカレンダーイベントを取得
     */
    getEventsForMonth(year, month) {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0);

        return this.events.filter(e => {
            const eStart = new Date(e.start);
            const eEnd = e.end ? new Date(e.end) : eStart;
            return eStart <= end && eEnd >= start;
        });
    },

    /**
     * 特定の日付のイベントを取得（スケジュール表連携用）
     */
    getEventsForDate(dateStr) {
        const target = new Date(dateStr);
        target.setHours(0, 0, 0, 0);

        return this.events.filter(e => {
            const start = new Date(e.start);
            start.setHours(0, 0, 0, 0);

            if (e.type === 'day') {
                return start.getTime() === target.getTime();
            } else if (e.type === 'period' && e.end) {
                const end = new Date(e.end);
                end.setHours(0, 0, 0, 0);
                return start <= target && target <= end;
            }
            return start.getTime() === target.getTime();
        });
    },

    /**
     * 指定した週の行事を取得
     */
    getEventsForWeek(startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);

        return this.events.filter(e => {
            const eStart = new Date(e.start);
            const eEnd = e.end ? new Date(e.end) : eStart;
            return eStart <= end && eEnd >= start;
        });
    },

    /**
     * 保存
     */
    /**
     * 指定した月のイベントを取得
     * @param {number} year 
     * @param {number} month 0-11
     */
    getEventsForMonth(year, month) {
        // デフォルトは現在設定中の年月
        if (year === undefined) year = this.currentYear;
        if (month === undefined) month = this.currentMonth;

        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

        // 日付文字列 (YYYY-MM-DD...) をローカル日付の0時0分としてパースするヘルパー
        const parseAsLocalDate = (dateStr) => {
            if (!dateStr) return null;
            if (dateStr instanceof Date) return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());

            // YYYY-MM-DD 形式を想定
            const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (match) {
                return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
            }
            // フォールバック
            const d = new Date(dateStr);
            return new Date(d.getFullYear(), d.getMonth(), d.getDate());
        };

        return this.events.filter(event => {
            const start = parseAsLocalDate(event.start);
            if (!start) return false;

            let end;
            if (event.end) {
                const endDate = parseAsLocalDate(event.end);
                // 終了日はその日の終わり(23:59:59)にする
                end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
            } else {
                end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59);
            }

            // 期間が重なっているかチェック
            return start <= endOfMonth && end >= startOfMonth;
        }).sort((a, b) => {
            const dateA = parseAsLocalDate(a.start);
            const dateB = parseAsLocalDate(b.start);
            return dateA - dateB;
        });
    },

    saveEvents() {
        const data = window.StorageManager?.getCurrentData() || {};
        data.calendar = { events: this.events };
        window.StorageManager?.updateCurrentData(data);
    },

    /**
     * 読み込み
     */
    loadEvents() {
        const data = window.StorageManager?.getCurrentData() || {};
        this.events = data.calendar?.events || [];
    },

    printCalendar() {
        alert('印刷機能は実装準備中です');
    }
};

if (typeof window !== 'undefined') {
    window.CalendarModule = CalendarModule;
}

