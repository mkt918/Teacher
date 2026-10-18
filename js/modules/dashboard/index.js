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
    todoSortOrder: 'date',

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

        // ソートボタン（入力行に統合）
        document.getElementById('sortDateBtn')?.addEventListener('click', () => {
            this.todoSortOrder = 'date';
            this.renderTodos();
        });
        document.getElementById('sortManualBtn')?.addEventListener('click', () => {
            this.todoSortOrder = 'manual';
            this.renderTodos();
        });

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

        // ToDo詳細モーダルのイベント
        document.getElementById('saveTodoDetailBtn')?.addEventListener('click', () => this.saveTodoDetail());
        document.getElementById('cancelTodoDetailBtn')?.addEventListener('click', () => this.closeTodoDetailModal());
        document.getElementById('closeTodoDetailModal')?.addEventListener('click', () => this.closeTodoDetailModal());
        document.getElementById('deleteTodoDetailBtn')?.addEventListener('click', async () => {
            const id = document.getElementById('todoDetailId').value;
            // 確認でキャンセルしたときは、詳細画面を閉じない
            if (id && await this.deleteTodo(id)) this.closeTodoDetailModal();
        });
    },

    closeTodoDetailModal() {
        const modal = document.getElementById('todoDetailModal');
        if (modal) modal.classList.remove('active');
    },

    /**
     * 描画
     */
    render() {
        // 今日の日付を表示
        this._updateTodayDateDisplay();

        // 週表示範囲を更新
        this._updateWeekRangeDisplay();

        if (window.ScheduleModule) {
            window.ScheduleModule.weekOffset = this.weekOffset;
            window.ScheduleModule.render('dashboardSchedule');
        }

        this._renderMonthEvents();
        this.renderTodos();
    },

    // 今日の日付をyyyy-mm-dd(曜日)形式で表示
    _updateTodayDateDisplay() {
        const container = document.getElementById('todayDateDisplay');
        if (!container) return;

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const weekdays = WEEKDAY_LABELS;
        const dayName = weekdays[today.getDay()];

        container.textContent = `📅 ${yyyy}-${mm}-${dd}(${dayName})`;
    },

    _updateWeekRangeDisplay() {
        const display = document.getElementById('weekRangeDisplay');
        if (!display) return;

        // 時間割（ScheduleModule._generateWeeks）と同じく、日曜日は「その週（前の月曜〜）」として扱う
        const base = new Date();
        base.setDate(base.getDate() + this.weekOffset * 7);
        const day = base.getDay();
        const monday = new Date(base);
        monday.setDate(base.getDate() - (day === 0 ? 6 : day - 1));
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);

        const md = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
        const label = this.weekOffset === 0 ? '今週' : (this.weekOffset > 0 ? `${this.weekOffset}週後` : `${Math.abs(this.weekOffset)}週前`);
        display.textContent = `${md(monday)} 〜 ${md(friday)} (${label})`;
    },

    // ToDoパネルの上に、今月・来月のミニカレンダーと行事一覧を表示する（クリックで年間行事予定へ）
    _renderMonthEvents() {
        let container = document.getElementById('monthEventsDisplay');
        if (!container) {
            const todoPanel = document.querySelector('.todo-panel');
            if (!todoPanel) return;
            container = document.createElement('div');
            container.id = 'monthEventsDisplay';
            container.className = 'month-events-panel';
            container.title = 'クリックで年間行事予定を開く';
            container.addEventListener('click', () => window.Router?.navigateTo('calendar'));
            todoPanel.parentNode.insertBefore(container, todoPanel);
        }
        const calendar = window.CalendarModule;
        if (!calendar) return;

        const base = new Date();
        base.setDate(base.getDate() + this.weekOffset * 7);
        const months = [
            { year: base.getFullYear(), month: base.getMonth(), label: '今月' },
            (() => {
                const next = new Date(base.getFullYear(), base.getMonth() + 1, 1);
                return { year: next.getFullYear(), month: next.getMonth(), label: '来月' };
            })()
        ];
        months.forEach(m => { m.events = calendar.getEventsForMonth(m.year, m.month); });

        container.innerHTML = `
            <div class="mini-calendars">${months.map(m => this._miniCalendarHtml(m.year, m.month)).join('')}</div>
            <div class="month-events-lists">
                ${months.map(m => `
                    <div class="month-events-list">
                        <strong>📅 ${m.label}の行事（${m.month + 1}月）</strong>
                        ${m.events.length === 0
                            ? '<p class="month-events-empty">予定なし</p>'
                            : m.events.map(e => `
                                <div class="month-event ${e.highlight ? 'highlight' : ''}">
                                    <span class="month-event-date">${escapeHtml(calendar._formatEventPeriod(e))}</span> ${escapeHtml(e.title)}
                                </div>`).join('')}
                    </div>`).join('')}
            </div>
            <p class="month-events-hint">クリックで編集 →</p>`;
    },

    // 月曜始まりの小さなカレンダー。行事のある日（期間行事の途中の日も含む）に色を付ける
    _miniCalendarHtml(year, month) {
        const calendar = window.CalendarModule;
        const lastDate = new Date(year, month + 1, 0).getDate();
        const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;
        const today = formatDate(new Date());

        const cells = [];
        for (let i = 0; i < leadingBlanks; i++) cells.push('<td></td>');
        for (let d = 1; d <= lastDate; d++) {
            const date = new Date(year, month, d);
            const dateStr = formatDate(date);
            const events = calendar.getEventsForDate(dateStr);
            const dow = date.getDay();
            const classes = [
                dow === 0 ? 'sun' : dow === 6 ? 'sat' : '',
                events.some(e => e.highlight) ? 'highlight' : events.length > 0 ? 'has-event' : '',
                dateStr === today ? 'today' : ''
            ].filter(Boolean).join(' ');
            const title = events.map(e => e.title).join('、');
            cells.push(`<td class="${classes}"${title ? ` title="${escapeHtml(title)}"` : ''}>${d}</td>`);
        }
        while (cells.length % 7 !== 0) cells.push('<td></td>');

        const rows = [];
        for (let i = 0; i < cells.length; i += 7) rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);

        return `
            <div class="mini-calendar">
                <div class="mini-calendar-title">${year}年${month + 1}月</div>
                <table>
                    <thead><tr><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th><th class="sat">土</th><th class="sun">日</th></tr></thead>
                    <tbody>${rows.join('')}</tbody>
                </table>
            </div>`;
    },

    /**
     * ToDoリストを描画（2カラム版）
     */
    renderTodos() {
        const importantContainer = document.getElementById('todoListImportant');
        const normalContainer = document.getElementById('todoListNormal');
        if (!importantContainer || !normalContainer) return;

        // ソートボタンの状態更新
        const sortDateBtn = document.getElementById('sortDateBtn');
        const sortManualBtn = document.getElementById('sortManualBtn');
        if (sortDateBtn) sortDateBtn.className = `btn-sort-inline ${this.todoSortOrder === 'date' ? 'active' : ''}`;
        if (sortManualBtn) sortManualBtn.className = `btn-sort-inline ${this.todoSortOrder === 'manual' ? 'active' : ''}`;

        // カラム別にフィルタリング
        const importantTodos = this.todos.filter(t => t.important && t.type !== 'separator');
        const normalTodos = this.todos.filter(t => !t.important || t.type === 'separator');

        // ソート適用
        const sortedImportant = this._sortTodos(importantTodos);
        const sortedNormal = this._sortTodos(normalTodos);

        // 重要カラムのカウンタ更新
        const importantActiveCount = importantTodos.filter(t => !t.completed).length;
        const importantCountEl = document.getElementById('importantCount');
        if (importantCountEl) importantCountEl.textContent = `${importantActiveCount}/5`;

        // 上限超過の視覚フィードバック
        const importantCol = document.getElementById('todoColumnImportant');
        if (importantCol) {
            importantCol.classList.toggle('todo-column--over-limit', importantActiveCount > 5);
        }

        // 通常カラムのカウンタ更新
        const normalActiveCount = normalTodos.filter(t => !t.completed && t.type !== 'separator').length;
        const normalCountEl = document.getElementById('normalCount');
        if (normalCountEl) normalCountEl.textContent = normalActiveCount;

        // 各カラムを描画
        importantContainer.innerHTML = this._buildTodoHtml(sortedImportant, 'important');
        normalContainer.innerHTML = this._buildTodoHtml(sortedNormal, 'normal');

        // イベント設定
        this._setupTodoEvents(importantContainer);
        this._setupTodoEvents(normalContainer);

        // DnD設定（常に有効化）
        this._setupTodoDnDv2(importantContainer, normalContainer);
    },

    /**
     * ToDoリストのソート（カラム別）
     */
    _sortTodos(todos) {
        if (this.todoSortOrder !== 'date') return todos;

        return [...todos].sort((a, b) => {
            if (a.type === 'separator' && b.type !== 'separator') return 1;
            if (a.type !== 'separator' && b.type === 'separator') return -1;
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            if (!a.dueDate && b.dueDate) return 1;
            if (a.dueDate && !b.dueDate) return -1;
            if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
                return new Date(a.dueDate) - new Date(b.dueDate);
            }
            return (a.text || '').localeCompare(b.text || '');
        });
    },

    /**
     * ToDoアイテムのHTML生成
     */
    _buildTodoHtml(todos, columnKey) {
        if (todos.length === 0) {
            const msg = columnKey === 'important' ? '重要タスクなし' : 'タスクはありません';
            return `<div class="empty-state-small"><p>${msg}</p></div>`;
        }

        const today = formatDate(new Date());

        return todos.map((todo, index) => {
            // 区切り線（通常カラムのみ）
            if (todo.type === 'separator') {
                return `
                    <div class="todo-separator" draggable="true"
                         data-id="${todo.id}" data-index="${index}" data-column="${columnKey}">
                        <div class="todo-drag-handle">⋮⋮</div>
                        <hr>
                        <button class="todo-delete separator-delete" title="削除" aria-label="削除">×</button>
                    </div>`;
            }

            const isOverdue = !todo.completed && todo.dueDate && todo.dueDate < today;
            const isToday = !todo.completed && todo.dueDate === today;

            let dateLabel = '';
            if (todo.dueDate) {
                const d = new Date(todo.dueDate + 'T00:00:00');
                dateLabel = `<span class="todo-date ${isOverdue ? 'overdue' : ''} ${isToday ? 'today' : ''}">
                    ${d.getMonth() + 1}/${d.getDate()}
                </span>`;
            }

            // ⭐ ボタン（カラム間移動用）
            const starBtn = `<button class="todo-star ${todo.important ? 'active' : ''}"
                data-id="${todo.id}" title="${todo.important ? '重要を解除' : '重要にする'}">⭐</button>`;

            const hasNote = todo.note && todo.note.trim() !== '';

            return `
            <div class="todo-item ${todo.completed ? 'completed' : ''} ${isOverdue ? 'overdue-item' : ''}"
                 draggable="true"
                 data-id="${todo.id}" data-index="${index}" data-column="${columnKey}">
                <div class="todo-drag-handle">⋮⋮</div>
                <div class="todo-main">
                    <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
                    ${dateLabel}
                    <span class="todo-text">${escapeHtml(todo.text)}${hasNote ? ' <small class="todo-note-mark" title="メモあり">📝</small>' : ''}</span>
                </div>
                ${starBtn}
                <button class="todo-delete" aria-label="削除">×</button>
            </div>`;
        }).join('');
    },

    /**
     * ToDoイベント設定（チェック・削除・⭐ボタン）
     */
    _setupTodoEvents(container) {
        container.querySelectorAll('.todo-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.closest('.todo-item').dataset.id;
                this.toggleTodo(id);
            });
        });

        container.querySelectorAll('.todo-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const parent = e.target.closest('.todo-item') || e.target.closest('.todo-separator');
                if (parent) {
                    this.deleteTodo(parent.dataset.id);
                }
            });
        });

        // ⭐ ボタン：カラム間移動
        container.querySelectorAll('.todo-star').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleImportant(btn.dataset.id);
            });
        });

        // 詳細表示
        container.querySelectorAll('.todo-main').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox') return;
                const id = e.target.closest('.todo-item').dataset.id;
                this.openTodoDetail(id);
            });
        });
    },

    /**
     * ToDo詳細モーダルを開く
     */
    openTodoDetail(id) {
        const todo = this.todos.find(t => t.id === id);
        if (!todo) return;

        document.getElementById('todoDetailId').value = todo.id;
        document.getElementById('todoDetailText').value = todo.text || '';
        document.getElementById('todoDetailDate').value = todo.dueDate || '';
        document.getElementById('todoDetailNote').value = todo.note || '';
        document.getElementById('todoDetailImportant').checked = !!todo.important;

        const modal = document.getElementById('todoDetailModal');
        if (modal) modal.classList.add('active');
    },

    /**
     * ToDo詳細を保存
     */
    saveTodoDetail() {
        const id = document.getElementById('todoDetailId').value;
        const text = document.getElementById('todoDetailText').value.trim();
        const dueDate = document.getElementById('todoDetailDate').value;
        const note = document.getElementById('todoDetailNote').value;
        const important = document.getElementById('todoDetailImportant').checked;

        if (!text) {
            UI.toast('タスク名を入力してください。', 'error');
            return;
        }

        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            // 重要フラグの変更がある場合の上限チェック
            if (important && !todo.important) {
                const importantActiveCount = this.todos.filter(
                    t => t.important && !t.completed && t.type !== 'separator'
                ).length;
                if (importantActiveCount >= 5) {
                    UI.toast('重要タスクは最大5件までです。', 'error');
                    return;
                }
            }

            todo.text = text;
            todo.dueDate = dueDate;
            todo.note = note;
            todo.important = important;

            this.saveTodos();
            this.renderTodos();
            this.closeTodoDetailModal();
        }
    },

    /**
     * 2カラム対応のドラッグアンドドロップ設定
     */
    _setupTodoDnDv2(importantContainer, normalContainer) {
        const containers = [importantContainer, normalContainer];

        containers.forEach(container => {
            // ドラッグ開始
            container.querySelectorAll('[draggable="true"]').forEach(item => {
                item.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify({
                        id: item.dataset.id,
                        fromColumn: item.dataset.column
                    }));
                    e.dataTransfer.effectAllowed = 'move';
                    item.classList.add('dragging');
                    // ドラッグ中は全コンテナをドロップ可能状態に
                    containers.forEach(c => c.classList.add('dnd-active'));
                });

                item.addEventListener('dragend', () => {
                    item.classList.remove('dragging');
                    containers.forEach(c => {
                        c.classList.remove('dnd-active', 'drag-over-container');
                        c.querySelectorAll('.drag-over-top, .drag-over-bottom')
                         .forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
                    });
                });
            });

            // アイテム上へのドロップ
            container.querySelectorAll('.todo-item, .todo-separator').forEach(item => {
                item.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    const rect = item.getBoundingClientRect();
                    const mid = rect.top + rect.height / 2;
                    item.classList.remove('drag-over-top', 'drag-over-bottom');
                    item.classList.add(e.clientY < mid ? 'drag-over-top' : 'drag-over-bottom');
                });

                item.addEventListener('dragleave', () => {
                    item.classList.remove('drag-over-top', 'drag-over-bottom');
                });

                item.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    item.classList.remove('drag-over-top', 'drag-over-bottom');
                    this._handleDrop(e, item);
                });
            });

            // コンテナの空き領域へのドロップ（末尾追加）
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                container.classList.add('drag-over-container');
            });

            container.addEventListener('dragleave', (e) => {
                // コンテナの子要素へのdragleaveは無視
                if (!container.contains(e.relatedTarget)) {
                    container.classList.remove('drag-over-container');
                }
            });

            container.addEventListener('drop', (e) => {
                container.classList.remove('drag-over-container');
                // アイテム上のドロップは各アイテムのdropが処理済みのため
                // ここではコンテナの空き部分へのドロップのみ処理
                const target = e.target.closest('.todo-item, .todo-separator');
                if (!target) {
                    this._handleDropToContainer(e, container);
                }
            });
        });
    },

    /**
     * アイテム上へのドロップ処理
     */
    _handleDrop(e, targetItem) {
        let payload;
        try {
            payload = JSON.parse(e.dataTransfer.getData('text/plain'));
        } catch { return; }

        const { id: draggedId, fromColumn } = payload;
        const toColumnEl = targetItem.closest('.todo-column');
        if (!toColumnEl) return;
        const toColumn = toColumnEl.dataset.column;
        const toId = targetItem.dataset.id;

        if (draggedId === toId) return;

        // 重要カラムへの移動時に上限チェック
        if (toColumn === 'important' && fromColumn === 'normal') {
            const count = this.todos.filter(t => t.important && !t.completed && t.type !== 'separator').length;
            if (count >= 5) {
                UI.toast('重要タスクは最大5件までです。', 'error');
                return;
            }
        }

        const rect = targetItem.getBoundingClientRect();
        const insertAfter = e.clientY >= rect.top + rect.height / 2;

        // 手動モードでなければ切り替え
        if (this.todoSortOrder !== 'manual') {
            this.todoSortOrder = 'manual';
            // 通知（オプション）
            // console.log('Switched to manual sort mode');
        }

        // 配列操作
        const draggedIndex = this.todos.findIndex(t => t.id === draggedId);
        if (draggedIndex === -1) return;
        const movedItem = this.todos.splice(draggedIndex, 1)[0];

        // important フラグを更新
        if (movedItem.type !== 'separator') {
            movedItem.important = (toColumn === 'important');
        }

        // ターゲットの位置を探して挿入
        let targetIndex = this.todos.findIndex(t => t.id === toId);
        if (targetIndex === -1) targetIndex = this.todos.length;
        if (insertAfter) targetIndex++;

        this.todos.splice(targetIndex, 0, movedItem);
        this.saveTodos();
        this.renderTodos();
    },

    /**
     * コンテナの空き領域へのドロップ処理（末尾追加）
     */
    _handleDropToContainer(e, container) {
        let payload;
        try {
            payload = JSON.parse(e.dataTransfer.getData('text/plain'));
        } catch { return; }

        const { id: draggedId, fromColumn } = payload;
        const toColumnEl = container.closest('.todo-column');
        if (!toColumnEl) return;
        const toColumn = toColumnEl.dataset.column;

        // 手動モードでなければ切り替え
        if (this.todoSortOrder !== 'manual') {
            this.todoSortOrder = 'manual';
        }

        if (toColumn === 'important' && fromColumn === 'normal') {
            const count = this.todos.filter(t => t.important && !t.completed && t.type !== 'separator').length;
            if (count >= 5) {
                UI.toast('重要タスクは最大5件までです。', 'error');
                return;
            }
        }

        const draggedIndex = this.todos.findIndex(t => t.id === draggedId);
        if (draggedIndex === -1) return;
        const movedItem = this.todos.splice(draggedIndex, 1)[0];

        if (movedItem.type !== 'separator') {
            movedItem.important = (toColumn === 'important');
        }

        // そのカラムの最後のアイテムの後ろに挿入
        let insertAt = -1;
        for (let i = this.todos.length - 1; i >= 0; i--) {
            const t = this.todos[i];
            const isTargetColumn = toColumn === 'important' ? (t.important && t.type !== 'separator') : (!t.important || t.type === 'separator');
            if (isTargetColumn) {
                insertAt = i + 1;
                break;
            }
        }
        if (insertAt === -1) insertAt = this.todos.length;

        this.todos.splice(insertAt, 0, movedItem);
        this.saveTodos();
        this.renderTodos();
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
            important: false,
            createdAt: new Date().toISOString()
        });

        textInput.value = '';
        if (dateInput) dateInput.value = '';

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
     * ToDo重要フラグ切り替え（⭐ボタン）
     */
    toggleImportant(id) {
        const todo = this.todos.find(t => t.id === id);
        if (!todo) return;

        // 重要カラムへの昇格時に上限チェック
        if (!todo.important) {
            const importantActiveCount = this.todos.filter(
                t => t.important && !t.completed && t.type !== 'separator'
            ).length;
            if (importantActiveCount >= 5) {
                UI.toast('重要タスクは最大5件までです。\n完了済みのタスクを確認してください。', 'error');
                return;
            }
        }

        todo.important = !todo.important;
        this.saveTodos();
        this.renderTodos();
    },

    /**
     * ToDo削除
     */
    async deleteTodo(id) {
        if (!await UI.confirm('このタスクを削除します。', { title: 'タスクを削除', confirmLabel: '削除する', danger: true })) return false;
        this.todos = this.todos.filter(t => t.id !== id);
        this.saveTodos();
        this.renderTodos();
        return true;
    },

    saveTodos() {
        const data = window.StorageManager?.getCurrentData() || {};
        data.todos = this.todos;
        window.StorageManager?.updateCurrentData(data);
    },

    loadTodos() {
        const data = window.StorageManager?.getCurrentData() || {};
        // 既存データに important フィールドがない場合はデフォルト false を付与
        this.todos = (data.todos || []).map(todo => ({
            important: false,
            ...todo
        }));
    }
};

if (typeof window !== 'undefined') {
    window.DashboardModule = DashboardModule;
}
