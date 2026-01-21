/**
 * DashboardModule - ダッシュボード管理（スケジュール＆ToDo）
 * 
 * 機能:
 * - 4週間スケジュール表の表示
 * - 日付付きToDoリストの管理
 * - 各種バッジ更新
 */

const DashboardModule = {
    name: 'DashboardModule',
    initialized: false,

    // ToDoデータ
    todos: [],
    // ToDoソート順: 'date' (日付・タスク順) | 'manual' (手動)
    todoSortOrder: 'manual',

    // 週オフセット（0で今週、-1で先週、1で来週...）
    weekOffset: 0,

    /**
     * 初期化
     */
    init() {
        if (this.initialized) return;

        // 依存モジュールの初期化
        if (window.ScheduleModule) window.ScheduleModule.init();
        if (window.CalendarModule) window.CalendarModule.init();

        this.setupEventListeners();
        this.loadTodos();
        this.initialized = true;
        console.log('🏠 DashboardModule initialized (Schedule Mode)');
    },

    /**
     * イベントリスナー
     */
    setupEventListeners() {
        const addBtn = document.getElementById('addTodoBtn');
        const textInput = document.getElementById('todoInput');
        const dateInput = document.getElementById('todoDateInput');

        if (addBtn && textInput) {
            addBtn.addEventListener('click', () => this.addTodo());
            textInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addTodo();
            });
            if (dateInput) {
                dateInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.addTodo();
                });
            }
        }

        // 週ずらしボタン
        document.getElementById('prevWeekBtn')?.addEventListener('click', () => {
            this.weekOffset--;
            this.render();
        });
        document.getElementById('nextWeekBtn')?.addEventListener('click', () => {
            this.weekOffset++;
            this.render();
        });
        document.getElementById('todayBtn')?.addEventListener('click', () => {
            this.weekOffset = 0;
            this.render();
        });
    },

    /**
     * 描画
     */
    render() {
        // 今日の日付を表示
        this._updateTodayDateDisplay();

        // 週表示範囲を更新
        this._updateWeekRangeDisplay();

        // スケジュール表の描画
        if (window.ScheduleModule) {
            // 週オフセットをScheduleModuleに渡す
            window.ScheduleModule.weekOffset = this.weekOffset;
            this._syncEventsToSchedule();
            window.ScheduleModule.render('dashboardSchedule');
        }

        // 行事一覧を表示（今月の行事）
        this._renderMonthEvents();

        this.renderTodos();
        this.updateBadges();
    },

    // 今日の日付をyyyy-mm-dd(曜日)形式で表示
    _updateTodayDateDisplay() {
        const container = document.getElementById('todayDateDisplay');
        if (!container) return;

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        const dayName = weekdays[today.getDay()];

        container.textContent = `📅 ${yyyy}-${mm}-${dd}(${dayName})`;
    },

    _updateWeekRangeDisplay() {
        const display = document.getElementById('weekRangeDisplay');
        if (!display) return;

        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() + this.weekOffset * 7);
        const startOfWeek = new Date(baseDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // 月曜
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 4); // 金曜

        const formatDate = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
        const label = this.weekOffset === 0 ? '今週' : (this.weekOffset > 0 ? `${this.weekOffset}週後` : `${Math.abs(this.weekOffset)}週前`);
        display.textContent = `${formatDate(startOfWeek)} 〜 ${formatDate(endOfWeek)} (${label})`;
    },

    _renderMonthEvents() {
        // 年間行事を表示（ToDoパネルの上）
        let container = document.getElementById('monthEventsDisplay');
        if (!container) {
            // 既存のweekEventsDisplayがあれば削除
            const oldContainer = document.getElementById('weekEventsDisplay');
            if (oldContainer) oldContainer.remove();

            const todoPanel = document.querySelector('.todo-panel');
            if (todoPanel) {
                container = document.createElement('div');
                container.id = 'monthEventsDisplay';
                container.style.marginBottom = '15px';
                container.style.padding = '10px';
                container.style.background = '#f0f9ff';
                container.style.borderRadius = '8px';
                container.style.border = '1px solid #bae6fd';
                container.style.cursor = 'pointer';
                // クリックで年間行事予定に遷移
                container.addEventListener('click', () => {
                    if (window.Router) {
                        window.Router.navigateTo('calendar');
                    }
                });
                todoPanel.parentNode.insertBefore(container, todoPanel);
            }
        }

        if (!container || !window.CalendarModule) return;

        // weekOffsetに基づいて基準日を計算
        const baseDate = new Date();
        baseDate.setDate(baseDate.getDate() + this.weekOffset * 7);

        // 基準日の月を「今月」として使用
        const thisYear = baseDate.getFullYear();
        const thisMonth = baseDate.getMonth();

        // 来月
        const nextMonthDate = new Date(thisYear, thisMonth + 1, 1);
        const nextYear = nextMonthDate.getFullYear();
        const nextMonth = nextMonthDate.getMonth();

        const thisMonthEvents = window.CalendarModule.getEventsForMonth(thisYear, thisMonth);
        const nextMonthEvents = window.CalendarModule.getEventsForMonth(nextYear, nextMonth);

        // 日付パースヘルパー
        const parseAsLocalDate = (dateStr) => {
            if (!dateStr) return null;
            if (dateStr instanceof Date) return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
            const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (match) {
                return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
            }
            const d = new Date(dateStr);
            return new Date(d.getFullYear(), d.getMonth(), d.getDate());
        };

        // ミニカレンダーを生成する関数（月曜始まり）
        const renderMiniCalendar = (year, month, events) => {
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const daysInMonth = lastDay.getDate();

            // 月曜始まりに調整（0=月, 1=火, ..., 6=日）
            let startDayOfWeek = firstDay.getDay() - 1;
            if (startDayOfWeek < 0) startDayOfWeek = 6;

            // 行事がある日のセットを作成
            const eventDays = new Set();
            const highlightDays = new Set();
            events.forEach(e => {
                const start = parseAsLocalDate(e.start);
                if (start) {
                    eventDays.add(start.getDate());
                    if (e.highlight) highlightDays.add(start.getDate());
                }
            });

            // 今日の日付
            const today = new Date();
            const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
            const todayDate = today.getDate();

            // カレンダーHTML生成
            let calendarHtml = `
                <div style="flex: 1; min-width: 140px; max-width: 180px;">
                    <div style="text-align: center; font-weight: bold; margin-bottom: 5px; font-size: 0.85em;">
                        ${year}年${month + 1}月
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.7em; table-layout: fixed;">
                        <thead>
                            <tr style="background: #e0f2fe;">
                                <th style="padding: 2px; text-align: center;">月</th>
                                <th style="padding: 2px; text-align: center;">火</th>
                                <th style="padding: 2px; text-align: center;">水</th>
                                <th style="padding: 2px; text-align: center;">木</th>
                                <th style="padding: 2px; text-align: center;">金</th>
                                <th style="padding: 2px; text-align: center; color: #0369a1;">土</th>
                                <th style="padding: 2px; text-align: center; color: #dc2626;">日</th>
                            </tr>
                        </thead>
                        <tbody>`;

            let dayCount = 1;
            for (let week = 0; week < 6; week++) {
                if (dayCount > daysInMonth) break;
                calendarHtml += '<tr>';
                for (let dow = 0; dow < 7; dow++) {
                    if (week === 0 && dow < startDayOfWeek) {
                        calendarHtml += '<td style="padding: 2px;"></td>';
                    } else if (dayCount > daysInMonth) {
                        calendarHtml += '<td style="padding: 2px;"></td>';
                    } else {
                        const hasEvent = eventDays.has(dayCount);
                        const hasHighlight = highlightDays.has(dayCount);
                        const isToday = isCurrentMonth && dayCount === todayDate;
                        const isSaturday = dow === 5;
                        const isSunday = dow === 6;

                        let cellStyle = 'padding: 2px; text-align: center;';
                        if (isToday) {
                            cellStyle += ' background: #fef3c7; border-radius: 50%; font-weight: bold;';
                        }
                        if (hasHighlight) {
                            cellStyle += ' color: #dc2626; font-weight: bold;';
                        } else if (hasEvent) {
                            cellStyle += ' background: #dbeafe; border-radius: 3px;';
                        } else if (isSunday) {
                            cellStyle += ' color: #dc2626;';
                        } else if (isSaturday) {
                            cellStyle += ' color: #0369a1;';
                        }

                        calendarHtml += `<td style="${cellStyle}">${dayCount}</td>`;
                        dayCount++;
                    }
                }
                calendarHtml += '</tr>';
            }

            calendarHtml += '</tbody></table></div>';
            return calendarHtml;
        };

        // イベントをHTML化する関数
        const renderEvents = (events, monthLabel) => {
            if (events.length === 0) {
                return `<div style="margin-bottom: 10px;">
                    <strong>📅 ${monthLabel}</strong>
                    <p style="margin: 5px 0 0; color: #999; font-size: 0.9em;">予定なし</p>
                </div>`;
            }

            return `<div style="margin-bottom: 10px;">
                <strong>📅 ${monthLabel}</strong>
                ${events.map(e => {
                const start = parseAsLocalDate(e.start);
                const dateStr = `${start.getMonth() + 1}/${start.getDate()}`;
                let endStr = '';
                if (e.end) {
                    const end = parseAsLocalDate(e.end);
                    if (start.getTime() !== end.getTime()) {
                        endStr = `〜${end.getDate()}`;
                    }
                }
                const weekday = ['日', '月', '火', '水', '木', '金', '土'][start.getDay()];
                const highlightStyle = e.highlight ? 'color: #dc2626; font-weight: bold;' : '';
                return `<div style="margin-top: 5px; font-size: 0.9em; ${highlightStyle}">
                        <span style="color: ${e.highlight ? '#dc2626' : '#0369a1'};">${dateStr}${endStr}(${weekday})</span> ${this._escapeHtml(e.title)}
                    </div>`;
            }).join('')}
            </div>`;
        };

        // ミニカレンダー2ヶ月分を横並びで表示
        const calendarsHtml = `
            <div style="display: flex; gap: 10px; margin-bottom: 15px; justify-content: center;">
                ${renderMiniCalendar(thisYear, thisMonth, thisMonthEvents)}
                ${renderMiniCalendar(nextYear, nextMonth, nextMonthEvents)}
            </div>
        `;

        container.innerHTML = calendarsHtml +
            renderEvents(thisMonthEvents, `今月の行事（${thisMonth + 1}月）`) +
            renderEvents(nextMonthEvents, `来月の行事（${nextMonth + 1}月）`) +
            '<p style="margin: 0; font-size: 0.8em; color: #64748b; text-align: right;">クリックで編集 →</p>';
    },

    /**
     * カレンダーの予定をスケジュールの日次変更データに反映（表示用）
     */
    _syncEventsToSchedule() {
        if (!window.CalendarModule || !window.ScheduleModule) return;

        // 向こう4週間分の日付について処理
        const weeks = window.ScheduleModule._generateWeeks(4);
        weeks.forEach(week => {
            week.forEach(date => {
                const dateStr = date.toISOString().split('T')[0];
                const events = window.CalendarModule.getEventsForDate(dateStr);

                // 行事予定があれば反映（既存の手動変更は維持）
                if (events.length > 0) {
                    // 同一日でも複数の行事がある場合は連結、ただし備考として表示するなど工夫が必要
                    // ここではシンプルに行事名を表示
                    const eventNames = events.map(e => e.title).join(', ');

                    // 日付ヘッダー部分へのイベント表示ロジックはScheduleModule側で対応
                    // ここではScheduleModuleのdailyEventsプロパティ等にセットする形が望ましいが
                    // ScheduleModuleの設計に合わせて、DOM更新時にイベントラベルへ書き込むアプローチをとる

                    // ScheduleModuleのrender後にDOM操作を行うため、ここでは何もしない
                    // またはScheduleModuleに行事データセット用のメソッドを追加する
                }
            });
        });

        // 実際のDOM更新はScheduleModule.render後に、イベントリスナー内かcallbackで行う必要があるが
        // 今回はScheduleModule.render内でCalendarModuleを直接参照するように改修する方がスマート。
        // （後ほどScheduleModuleを微修正する）
    },

    /**
     * ToDoリストを描画
     */
    renderTodos() {
        const container = document.getElementById('todoList');
        if (!container) return;

        // コントロールエリアの追加（初回のみ）
        let controls = document.getElementById('todoControls');
        if (!controls) {
            controls = document.createElement('div');
            controls.id = 'todoControls';
            controls.className = 'todo-controls';
            controls.innerHTML = `
                <div class="todo-sort-btns">
                    <button class="btn-icon ${this.todoSortOrder === 'date' ? 'active' : ''}" id="sortDateBtn" title="日付・タスク順">📅</button>
                    <button class="btn-icon ${this.todoSortOrder === 'manual' ? 'active' : ''}" id="sortManualBtn" title="手動並び替え">✋</button>
                    <button class="btn-icon" id="addSeparatorBtn" title="区切り線を追加">➖</button>
                </div>
            `;
            // inputArea（既存）の前、あるいはヘッダー付近に入れたいが
            // ここではコンテナの直前に挿入してみる
            const inputArea = document.querySelector('.todo-input-area');
            if (inputArea) {
                inputArea.parentNode.insertBefore(controls, inputArea.nextSibling);

                // イベント設定
                document.getElementById('sortDateBtn').onclick = () => { this.todoSortOrder = 'date'; this.renderTodos(); };
                document.getElementById('sortManualBtn').onclick = () => { this.todoSortOrder = 'manual'; this.renderTodos(); };
                document.getElementById('addSeparatorBtn').onclick = () => { this.addSeparator(); };
            }
        } else {
            // ボタン状態更新
            document.getElementById('sortDateBtn').className = `btn-icon ${this.todoSortOrder === 'date' ? 'active' : ''}`;
            document.getElementById('sortManualBtn').className = `btn-icon ${this.todoSortOrder === 'manual' ? 'active' : ''}`;
        }

        if (this.todos.length === 0) {
            container.innerHTML = `
                <div class="empty-state-small">
                    <p>タスクはありません</p>
                </div>
            `;
            return;
        }

        let displayTodos = [...this.todos];

        if (this.todoSortOrder === 'date') {
            displayTodos.sort((a, b) => {
                // 区切り線は最後に回すか、あるいは日付がないので先頭か？
                // 日付順モードでは区切り線は無視または下部に集めるのが無難だが、
                // ユーザーは「区切り線も好きに並び替え」と言っている。
                // 日付順モードでも区切り線が機能するようにするには、
                // 「日付順」はあくまで「自動ソート」であり、区切り線の位置は制御不能になる。
                // 今回はシンプルに：日付順モードでは日付＞名前でソート。区切り線は日付なしとして扱う。

                if (a.type === 'separator' && b.type !== 'separator') return 1;
                if (a.type !== 'separator' && b.type === 'separator') return -1;

                if (a.completed !== b.completed) return a.completed ? 1 : -1;

                // 日付比較
                if (!a.dueDate && b.dueDate) return 1;
                if (a.dueDate && !b.dueDate) return -1;
                if (a.dueDate && b.dueDate) {
                    if (a.dueDate !== b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
                }

                // タスク名順
                return (a.text || '').localeCompare(b.text || '');
            });
        }
        // manualモードなら配列順（そのまま）

        const today = new Date().toISOString().split('T')[0];

        container.innerHTML = displayTodos.map((todo, index) => {
            if (todo.type === 'separator') {
                return `
                    <div class="todo-separator" draggable="${this.todoSortOrder === 'manual'}" data-id="${todo.id}" data-index="${index}">
                        <hr>
                        <button class="todo-delete separator-delete" title="削除">×</button>
                    </div>
                `;
            }

            const isOverdue = !todo.completed && todo.dueDate && todo.dueDate < today;
            const isToday = !todo.completed && todo.dueDate === today;

            let dateLabel = '';
            if (todo.dueDate) {
                const date = new Date(todo.dueDate);
                dateLabel = `<span class="todo-date ${isOverdue ? 'overdue' : ''} ${isToday ? 'today' : ''}" style="margin-right: 4px; white-space: nowrap;">
                    ${date.getMonth() + 1}/${date.getDate()}
                </span>`;
            }

            return `
            <div class="todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue-item' : ''}" 
                 draggable="${this.todoSortOrder === 'manual'}" 
                 data-id="${todo.id}" data-index="${index}">
                <div class="todo-drag-handle" style="${this.todoSortOrder === 'manual' ? '' : 'display:none'}">⋮⋮</div>
                <div class="todo-main" style="display: flex; align-items: center; width: 100%;">
                    <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
                    ${dateLabel}
                    <span class="todo-text" style="flex: 1; margin-left: 8px;">${this._escapeHtml(todo.text)}</span>
                </div>
                <button class="todo-delete">×</button>
            </div>
            `;
        }).join('');

        this._setupTodoEvents(container);
        if (this.todoSortOrder === 'manual') {
            this._setupTodoDnD(container);
        }
    },

    addSeparator() {
        this.todos.push({
            id: Date.now().toString(),
            type: 'separator',
            text: '---',
            completed: false,
            createdAt: new Date().toISOString()
        });
        this.saveTodos();
        this.renderTodos(); // 描画更新
    },

    _setupTodoDnD(container) {
        let draggedItem = null;

        const items = container.querySelectorAll('.todo-item, .todo-separator');
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                e.dataTransfer.effectAllowed = 'move';
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                draggedItem = null;
                item.classList.remove('dragging');
                container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (item === draggedItem) return;

                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;

                item.classList.remove('drag-over-top', 'drag-over-bottom');
                if (e.clientY < midpoint) {
                    item.classList.add('drag-over-top');
                } else {
                    item.classList.add('drag-over-bottom');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over-top', 'drag-over-bottom');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over-top', 'drag-over-bottom');
                if (!draggedItem || item === draggedItem) return;

                const fromIndex = parseInt(draggedItem.dataset.index);
                const toIndex = parseInt(item.dataset.index);

                // 並び替え処理
                const rect = item.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                let newIndex = toIndex;

                // 下半分へのドロップなら、その要素の後ろへ
                if (e.clientY >= midpoint) {
                    // 下への移動でかつ... 少し複雑だが、spliceで処理する
                }

                // シンプルに配列操作
                const movedItem = this.todos[fromIndex];
                this.todos.splice(fromIndex, 1);

                // 削除した分、インデックスがずれるのを考慮
                let targetIndex = toIndex;
                if (fromIndex < toIndex) targetIndex--;

                if (e.clientY >= midpoint) targetIndex++;

                this.todos.splice(targetIndex, 0, movedItem);

                this.saveTodos();
                this.renderTodos();
            });
        });
    },

    _setupTodoEvents(container) {
        container.querySelectorAll('.todo-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.closest('.todo-item').dataset.id;
                this.toggleTodo(id);
            });
        });

        container.querySelectorAll('.todo-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // .todo-itemまたは.todo-separatorからIDを取得
                const parent = e.target.closest('.todo-item') || e.target.closest('.todo-separator');
                if (parent) {
                    this.deleteTodo(parent.dataset.id);
                }
            });
        });
    },

    /**
     * ToDoを追加
     */
    addTodo() {
        const textInput = document.getElementById('todoInput');
        const dateInput = document.getElementById('todoDateInput');

        if (!textInput) return;

        const text = textInput.value.trim();
        const dueDate = dateInput ? dateInput.value : '';

        if (!text) return;

        this.todos.push({
            id: Date.now().toString(),
            text: text,
            dueDate: dueDate,
            completed: false,
            createdAt: new Date().toISOString()
        });

        textInput.value = '';
        if (dateInput) dateInput.value = ''; // 日付もリセット

        this.saveTodos();
        this.renderTodos();
    },

    /**
     * ToDo完了切り替え
     */
    toggleTodo(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            this.saveTodos();
            this.renderTodos();
        }
    },

    /**
     * ToDo削除
     */
    deleteTodo(id) {
        if (!confirm('このタスクを削除しますか？')) return;
        this.todos = this.todos.filter(t => t.id !== id);
        this.saveTodos();
        this.renderTodos();
    },

    /**
     * 各種バッジ更新
     */
    updateBadges() {
        // ... (既存ロジックと同じ) ...
        const data = window.StorageManager?.getCurrentData() || {};
        const studentCount = document.getElementById('studentCount');
        if (studentCount) studentCount.textContent = `${data.students?.length || 0}名`;
    },

    /**
     * データ保存・読み込み
     */
    saveTodos() {
        const data = window.StorageManager?.getCurrentData() || {};
        data.todos = this.todos;
        window.StorageManager?.updateCurrentData(data);
    },

    loadTodos() {
        const data = window.StorageManager?.getCurrentData() || {};
        this.todos = data.todos || [];
    },

    _escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
    }
};



if (typeof window !== 'undefined') {
    window.DashboardModule = DashboardModule;
}
