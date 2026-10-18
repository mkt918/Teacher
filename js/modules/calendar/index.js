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
        this._setupButton('addEventBtn', () => this.openEventForm(null, this._defaultNewEventDate()));
        this._setupButton('prevMonthBtn', () => this.changeMonth(-1));
        this._setupButton('nextMonthBtn', () => this.changeMonth(1));
        this._setupButton('printCalendarBtn', () => this.printCalendar());

        // CSVエクスポート/インポート
        this._setupButton('exportCalendarCsvBtn', () => this.openCsvExportModal());
        this._setupButton('importCalendarCsvBtn', () => this.openCsvImportModal());
        this._setupButton('closeCalendarCsvExportModal', () => this.closeCsvExportModal());
        this._setupButton('cancelCalendarCsvExportBtn', () => this.closeCsvExportModal());
        this._setupButton('confirmCalendarCsvExportBtn', () => this._onConfirmExport());
        this._setupButton('closeCalendarCsvImportModal', () => this.closeCsvImportModal());
        this._setupButton('cancelCalendarCsvImportBtn', () => this.closeCsvImportModal());
        this._setupButton('confirmCalendarCsvImportBtn', () => this._onConfirmImport());
        document.querySelectorAll('input[name="csvImportMode"]').forEach(radio => {
            radio.addEventListener('change', () => this._updateImportWarning());
        });

        // カレンダー: 行事をクリックで編集、日付の空いたところをクリックで追加
        document.getElementById('calendarGrid')?.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-event-id]');
            if (chip) {
                this.openEventForm(this.events.find(ev => ev.id === chip.dataset.eventId));
                return;
            }
            const cell = e.target.closest('.cal-day[data-date]');
            if (cell) this.openEventForm(null, cell.dataset.date);
        });

        // 行事一覧: ☆で強調、🗑️で削除、行のクリックで編集
        document.getElementById('eventList')?.addEventListener('click', (e) => {
            const row = e.target.closest('[data-event-id]');
            if (!row) return;
            const event = this.events.find(ev => ev.id === row.dataset.eventId);
            if (!event) return;
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'highlight') this.toggleHighlight(event.id);
            else if (action === 'delete') this.confirmDeleteEvent(event);
            else this.openEventForm(event);
        });
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
        this.currentYear = now.getFullYear();
        this.currentMonth = now.getMonth();
    },

    // 「＋行事を追加」の初期日付: 表示中の月が今月なら今日、そうでなければその月の1日
    _defaultNewEventDate() {
        const today = new Date();
        if (today.getFullYear() === this.currentYear && today.getMonth() === this.currentMonth) {
            return formatDate(today);
        }
        return formatDate(new Date(this.currentYear, this.currentMonth, 1));
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

    // 月曜始まりの月カレンダーのHTML（画面と印刷で共通）
    _buildMonthGridHtml(maxEventsPerDay) {
        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDate = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        // 月曜始まりのための補正 (0:日曜 -> 6, 1:月曜 -> 0)
        const leadingBlanks = (firstDay.getDay() + 6) % 7;
        const today = formatDate(new Date());

        let html = '<div class="cal-weekdays">' +
            ['月', '火', '水', '木', '金', '土', '日'].map((d, i) =>
                `<div class="${i === 5 ? 'sat' : i === 6 ? 'sun' : ''}">${d}</div>`).join('') +
            '</div><div class="cal-days">';

        for (let i = 0; i < leadingBlanks; i++) {
            html += '<div class="cal-day blank"></div>';
        }

        for (let d = 1; d <= lastDate; d++) {
            const dateStr = formatDate(new Date(this.currentYear, this.currentMonth, d));
            const dayEvents = this.getEventsForDate(dateStr);
            const dow = new Date(this.currentYear, this.currentMonth, d).getDay();
            const dowClass = dow === 0 ? 'sun' : dow === 6 ? 'sat' : '';
            const shown = maxEventsPerDay ? dayEvents.slice(0, maxEventsPerDay) : dayEvents;

            html += `<div class="cal-day ${dowClass ? 'weekend' : ''} ${dateStr === today ? 'today' : ''}" data-date="${dateStr}">
                <div class="cal-day-num ${dowClass}">${d}</div>
                <div class="cal-day-events">
                    ${shown.map(e => `<div class="cal-chip ${e.highlight ? 'highlight' : ''}" data-event-id="${escapeHtml(e.id)}" title="${escapeHtml(e.title)}（クリックで編集）">${escapeHtml(e.title)}</div>`).join('')}
                    ${dayEvents.length > shown.length ? `<div class="cal-more">他${dayEvents.length - shown.length}件</div>` : ''}
                </div>
            </div>`;
        }
        return html + '</div>';
    },

    renderCalendarGrid() {
        const container = document.getElementById('calendarGrid');
        if (!container) return;
        container.innerHTML = this._buildMonthGridHtml(2);
    },

    renderEventList() {
        const container = document.getElementById('eventList');
        if (!container) return;

        // 前月から続く期間行事も、この月の行事として載せる
        const monthEvents = this.getEventsForMonth(this.currentYear, this.currentMonth);
        if (monthEvents.length === 0) {
            container.innerHTML = '<p class="cal-empty">この月の行事はありません（カレンダーの日付をクリックすると追加できます）</p>';
            return;
        }

        container.innerHTML = '<h4>今月の行事一覧</h4>' + monthEvents.map(e => `
            <div class="cal-event-row ${e.highlight ? 'highlight' : ''}" data-event-id="${escapeHtml(e.id)}" title="クリックで編集">
                <span class="cal-event-date">${escapeHtml(this._formatEventPeriod(e))}</span>
                <span class="cal-event-title">${escapeHtml(e.title)}</span>
                <button class="btn-icon" data-action="highlight" title="${e.highlight ? '強調を解除' : '強調表示'}" aria-label="${e.highlight ? '強調を解除' : '強調表示'}">${e.highlight ? '⭐' : '☆'}</button>
                <button class="btn-icon" data-action="delete" title="削除" aria-label="削除">🗑️</button>
            </div>`).join('');
    },

    // 「5/15(金)」「5/15(金)〜5/17(日)」
    _formatEventPeriod(event) {
        const label = (str) => {
            const [y, m, d] = str.split('-').map(Number);
            return `${m}/${d}(${WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()]})`;
        };
        const start = label(event.start);
        return event.type === 'period' && event.end && event.end !== event.start
            ? `${start}〜${label(event.end)}` : start;
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

    /**
     * 行事の追加・編集フォーム
     * @param {Object|null} existing - 編集する行事（追加ならnull）
     * @param {string} [defaultDate] - 追加時の初期日付 'YYYY-MM-DD'
     */
    async openEventForm(existing, defaultDate) {
        const values = await UI.form({
            title: existing ? '行事を編集' : '行事を追加',
            fields: [
                { name: 'title', label: '行事名', required: true, value: existing?.title, placeholder: '例: 体育祭' },
                { name: 'start', label: '日付（複数日なら開始日）', type: 'date', required: true, value: existing?.start || defaultDate },
                { name: 'end', label: '終了日', type: 'date', value: existing?.type === 'period' ? existing.end : '', help: '2日以上続く行事のときだけ入力します' },
                {
                    name: 'highlight', label: '強調表示', type: 'select', value: existing?.highlight ? '1' : '0',
                    options: [{ value: '0', label: 'しない' }, { value: '1', label: 'する（赤字で目立たせる）' }]
                }
            ],
            submitLabel: existing ? '保存' : '追加',
            validate: (v) => (v.end && v.end < v.start ? '終了日は開始日以降にしてください' : null),
            extraButtons: existing ? [{ label: '🗑️ 削除', action: 'delete', danger: true }] : []
        });
        if (!values) return;
        if (values.action === 'delete') {
            this.confirmDeleteEvent(existing);
            return;
        }

        const isPeriod = !!values.end && values.end > values.start;
        const fields = {
            title: values.title,
            start: values.start,
            end: isPeriod ? values.end : null,
            type: isPeriod ? 'period' : 'day',
            highlight: values.highlight === '1'
        };
        if (existing) {
            Object.assign(existing, fields);
            this.saveEvents();
        } else {
            this.addEvent({ ...fields, memo: '', files: [] });
        }
        this.render();
        UI.toast(existing ? '行事を更新しました' : `「${fields.title}」を追加しました`);
    },

    async confirmDeleteEvent(event) {
        if (!await UI.confirm(`「${event.title}」を削除します。`, { title: '行事を削除', confirmLabel: '削除する', danger: true })) return;
        this.deleteEvent(event.id);
        this.render();
        UI.toast('行事を削除しました', 'info');
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

    deleteEvent(id) {
        this.events = this.events.filter(e => e.id !== id);
        this.saveEvents();
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
        if (!data.calendar) data.calendar = {};
        // 今後calendarに他フィールド(設定・履歴等)が増えても消さないよう、eventsのみ上書きする
        data.calendar.events = this.events;
        window.StorageManager?.updateCurrentData(data);
    },

    /**
     * 読み込み
     */
    loadEvents() {
        const data = window.StorageManager?.getCurrentData() || {};
        this.events = data.calendar?.events || [];
    },

    // 表示中の月のカレンダー（行事はすべて表示）と行事一覧を A4 横で印刷する
    printCalendar() {
        this.loadEvents();
        const monthEvents = this.getEventsForMonth(this.currentYear, this.currentMonth);
        const listHtml = monthEvents.length === 0
            ? '<p>この月の行事はありません</p>'
            : `<table class="list"><tbody>${monthEvents.map(e => `
                <tr class="${e.highlight ? 'hl' : ''}"><td class="d">${escapeHtml(this._formatEventPeriod(e))}</td><td>${escapeHtml(e.title)}</td></tr>`).join('')}
               </tbody></table>`;

        const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">
            <title>${this.currentYear}年${this.currentMonth + 1}月 行事予定</title>
            <style>
                @page { size: A4 landscape; margin: 10mm; }
                body { font-family: "Hiragino Kaku Gothic ProN", Meiryo, sans-serif; color: #111; margin: 0; }
                h1 { font-size: 18px; margin: 0 0 8px; }
                .wrap { display: flex; gap: 12px; align-items: flex-start; }
                .month { flex: 3; }
                .side { flex: 1; font-size: 11px; }
                .cal-weekdays, .cal-days { display: grid; grid-template-columns: repeat(7, 1fr); }
                .cal-weekdays div { text-align: center; font-weight: bold; padding: 3px 0; border-bottom: 2px solid #333; }
                .cal-day { min-height: 80px; border: 1px solid #999; margin: -1px 0 0 -1px; padding: 3px; font-size: 10px; }
                .cal-day.blank { border-color: transparent; }
                .cal-day.weekend { background: #f5f5f5; }
                .cal-day-num { font-weight: bold; font-size: 12px; }
                .sat { color: #1d4ed8; } .sun { color: #b91c1c; }
                .cal-chip { margin-top: 2px; }
                .cal-chip.highlight { font-weight: bold; color: #b91c1c; }
                table.list { width: 100%; border-collapse: collapse; }
                table.list td { border-bottom: 1px solid #ccc; padding: 3px 4px; vertical-align: top; }
                table.list td.d { white-space: nowrap; }
                tr.hl td { font-weight: bold; color: #b91c1c; }
            </style></head><body>
            <h1>${this.currentYear}年${this.currentMonth + 1}月 行事予定</h1>
            <div class="wrap">
                <div class="month">${this._buildMonthGridHtml(0)}</div>
                <div class="side"><strong>行事一覧</strong>${listHtml}</div>
            </div>
            </body></html>`;
        printHtmlInNewWindow(html, 'width=1200,height=800');
    },

    // ---- CSVエクスポートモーダル ----

    openCsvExportModal() {
        // デフォルト値: 設定された年度の4月1日〜翌年3月31日
        const fiscalYear = getFiscalYear();
        document.getElementById('csvExportStartDate').value = `${fiscalYear}-04-01`;
        document.getElementById('csvExportEndDate').value = `${fiscalYear + 1}-03-31`;
        document.getElementById('calendarCsvExportModal').classList.add('active');
    },

    closeCsvExportModal() {
        document.getElementById('calendarCsvExportModal').classList.remove('active');
    },

    // ---- CSVインポートモーダル ----

    openCsvImportModal() {
        // ラジオを「追加」にリセット
        const appendRadio = document.querySelector('input[name="csvImportMode"][value="append"]');
        if (appendRadio) appendRadio.checked = true;
        this._updateImportWarning();
        document.getElementById('calendarCsvImportModal').classList.add('active');
    },

    closeCsvImportModal() {
        document.getElementById('calendarCsvImportModal').classList.remove('active');
    },

    _updateImportWarning() {
        const mode = document.querySelector('input[name="csvImportMode"]:checked')?.value;
        const warning = document.getElementById('csvImportWarning');
        const confirmBtn = document.getElementById('confirmCalendarCsvImportBtn');
        if (!warning || !confirmBtn) return;
        if (mode === 'overwrite') {
            warning.style.display = 'block';
            confirmBtn.className = 'btn btn-danger';
        } else {
            warning.style.display = 'none';
            confirmBtn.className = 'btn btn-primary';
        }
    },

    // ---- エクスポート確定ハンドラ ----

    _onConfirmExport() {
        const startDate = document.getElementById('csvExportStartDate').value;
        const endDate = document.getElementById('csvExportEndDate').value;
        if (!startDate || !endDate) {
            UI.toast('開始日と終了日を入力してください', 'error');
            return;
        }
        if (startDate > endDate) {
            UI.toast('終了日は開始日以降に設定してください', 'error');
            return;
        }
        this.exportCSVTemplate(startDate, endDate);
        this.closeCsvExportModal();
    },

    // ---- インポート確定ハンドラ ----

    async _onConfirmImport() {
        const mode = document.querySelector('input[name="csvImportMode"]:checked')?.value || 'append';
        if (mode === 'overwrite') {
            if (!await UI.confirm('現在登録されている全ての行事を削除して、CSVの内容だけにします。\nこの操作は元に戻せません。', { title: 'CSVで完全に上書き', confirmLabel: '全て削除してインポート', danger: true })) return;
        }
        this.closeCsvImportModal();

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,text/csv';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                this.importCSV(await readCsvFileAsText(file), mode);
            } catch (err) {
                UI.toast('CSVファイルの読み込みに失敗しました', 'error');
                console.error(err);
            }
        };
        input.click();
    },

    // ---- CSVテンプレート出力 ----

    /**
     * 期間を指定してCSVテンプレートを出力する
     * - 指定期間の全日付を行として出力
     * - 既存データがあれば行事1〜3列に埋め込む
     * @param {string} startDate  "YYYY-MM-DD"
     * @param {string} endDate    "YYYY-MM-DD"
     */
    exportCSVTemplate(startDate, endDate) {
        const parseLocal = (str) => {
            const [y, m, d] = str.split('-').map(Number);
            return new Date(y, m - 1, d);
        };
        const start = parseLocal(startDate);
        const end   = parseLocal(endDate);

        // 既存イベントを日付でマッピング（期間イベントは開始日〜終了日の
        // 全日に展開する。展開しないと期間イベントの2日目以降が
        // エクスポートから漏れてしまう）
        const byDate = {};
        const addToDate = (ds, title) => {
            if (!byDate[ds]) byDate[ds] = [];
            byDate[ds].push(title);
        };
        this.events.forEach(ev => {
            if (ev.type === 'period' && ev.end) {
                const cur = parseLocal(ev.start);
                const evEnd = parseLocal(ev.end);
                while (cur <= evEnd) {
                    addToDate(formatDate(cur), ev.title);
                    cur.setDate(cur.getDate() + 1);
                }
            } else {
                addToDate(ev.start, ev.title);
            }
        });

        // 出力対象期間内で1日あたり最大何件の行事があるかを調べ、
        // 列数を固定3列ではなく必要な分だけ用意する
        // （固定3列だと4件目以降が黙って欠落してしまうため）
        let maxPerDay = 1;
        const cur0 = new Date(start);
        while (cur0 <= end) {
            const count = (byDate[formatDate(cur0)] || []).length;
            if (count > maxPerDay) maxPerDay = count;
            cur0.setDate(cur0.getDate() + 1);
        }

        // BOM付きUTF-8（Excelの文字化け防止）
        const headerCols = Array.from({ length: maxPerDay }, (_, i) => `行事${i + 1}`);
        let csv = '\uFEFF日付,' + headerCols.join(',') + '\n';
        const cur = new Date(start);
        while (cur <= end) {
            const ds = formatDate(cur);
            const titles = byDate[ds] || [];
            const cols = Array.from({ length: maxPerDay }, (_, i) => csvEscape(titles[i]));
            csv += `${ds},${cols.join(',')}\n`;
            cur.setDate(cur.getDate() + 1);
        }

        downloadTextFile(csv, `年間行事計画テンプレート_${formatDate(new Date())}.csv`, 'text/csv');
    },

    // ---- CSVインポート ----

    /**
     * CSVをインポートして行事データに登録する
     * @param {string} csvText  CSVファイルの中身
     * @param {'overwrite'|'append'} mode  インポートモード
     */
    importCSV(csvText, mode) {
        const rows = parseCsv(csvText).filter(r => r.some(c => String(c).trim() !== ''));
        // 1行目が「日付,行事1...」の見出しなら読み飛ばす
        const hasHeader = rows.length > 0 && String(rows[0][0]).trim().startsWith('日付');
        const dataRows = hasHeader ? rows.slice(1) : rows;

        // 先にすべての行を検証・収集する（this.eventsはまだ一切変更しない）。
        // 「上書き」モードで先に既存データを消してから検証すると、
        // 不正なCSVを選んだ場合に0件のまま既存データだけ失ってしまうため
        const newEvents = [];
        const errors = [];

        dataRows.forEach((cols, idx) => {
            const lineNo = idx + (hasHeader ? 2 : 1);
            const raw = String(cols[0] || '').trim();
            // Excelで開いて保存し直すと「2026/4/1」の形になるため、区切りと桁数のゆれを許す
            const m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
            if (!m) {
                if (raw) errors.push(`${lineNo}行目: 日付を読み取れません「${raw}」`);
                return;
            }
            const y = Number(m[1]);
            const mo = Number(m[2]);
            const d = Number(m[3]);
            const dateObj = new Date(y, mo - 1, d);
            if (dateObj.getFullYear() !== y || dateObj.getMonth() + 1 !== mo || dateObj.getDate() !== d) {
                errors.push(`${lineNo}行目: 存在しない日付「${raw}」`);
                return;
            }
            const dateStr = formatDate(dateObj);

            // 日付列より後ろの列すべてを、その日の行事として読む
            cols.slice(1).forEach(title => {
                const t = String(title || '').trim();
                if (!t) return;
                newEvents.push({
                    id: Date.now().toString() + Math.random().toString(36).slice(2),
                    title: t,
                    start: dateStr,
                    end: null,
                    type: 'day',
                    memo: '',
                    files: [],
                    highlight: false
                });
            });
        });

        const errorSummary = errors.length === 0 ? '' :
            `\n読み飛ばした行: ${errors.slice(0, 3).join('、')}${errors.length > 3 ? ` ほか${errors.length - 3}件` : ''}`;

        // 有効な行が1件も無ければ、上書きモードでも既存データを一切変更せず中断する
        if (newEvents.length === 0) {
            UI.toast('取り込める行事が1件もありませんでした。既存のデータは変更していません' + errorSummary, 'error', 10000);
            return;
        }

        // ここまで検証が済んでから、まとめて反映する
        this.events = mode === 'overwrite' ? newEvents : [...this.events, ...newEvents];
        this.saveEvents();
        this.render();
        UI.toast(`${newEvents.length}件の行事を登録しました` + errorSummary, errors.length ? 'info' : 'success', errors.length ? 10000 : 3000);
    }
};

if (typeof window !== 'undefined') {
    window.CalendarModule = CalendarModule;
}

