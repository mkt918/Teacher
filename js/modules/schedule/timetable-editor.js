// ===== スケジュールモジュール: 時間割の編集 =====
// 時間割のドラッグ&ドロップ編集と、時間割設定ページ（科目の登録）。
// 本体(ScheduleModule)は index.js。このファイルは index.js より後に読み込むこと。

Object.assign(ScheduleModule, {

    _renderTimetableEditWithDnD(containerId, timetable, type) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const days = [
            { key: 'mon', label: '月' }, { key: 'tue', label: '火' }, { key: 'wed', label: '水' },
            { key: 'thu', label: '木' }, { key: 'fri', label: '金' }
        ];
        const subjects = type === 'class' ? this.classSubjects : this.mySubjects;
        const typeLabel = type === 'class' ? 'クラス時間割' : '自分の時間割';

        let html = `<h4 class="tt-edit-title">${typeLabel}</h4>`;
        html += '<table class="timetable-edit-table"><thead><tr><th></th>';
        days.forEach(d => { html += `<th>${d.label}</th>`; });
        html += '</tr></thead><tbody>';

        for (let period = 1; period <= 6; period++) {
            html += `<tr><td class="tt-edit-period">${period}限</td>`;
            days.forEach(d => {
                const subject = timetable[d.key][period - 1] || '';
                html += `<td class="tt-cell ${subject ? 'filled' : ''}" data-type="${type}" data-day="${d.key}" data-period="${period}">${this._ttCellInnerHtml(subject)}</td>`;
            });
            html += '</tr>';
        }
        html += '</tbody></table>';

        html += `<div class="subjects-tally-area" id="${containerId}_tally">
            <strong>科目別集計 (週次):</strong>
            <div class="tally-content"></div>
        </div>`;

        html += `<div class="subject-master-area">
            <div class="subject-master-header">
                <span>↑ 科目を上のセルにドラッグ、または科目をクリックで選んでからセルをクリック</span>
                <button class="btn btn-sm add-subject-btn" data-type="${type}">＋ 科目追加</button>
            </div>
            <div class="subject-cards">`;
        subjects.forEach((subj, idx) => {
            const displayText = typeof subj === 'object' ? `${subj.class} ${subj.name}` : subj;
            html += `<div class="subject-card" draggable="true" data-type="${type}" data-index="${idx}" data-value="${escapeHtml(displayText)}">
                <span>${escapeHtml(displayText)}</span>
                <button class="edit-subject-btn" data-type="${type}" data-index="${idx}" title="名前変更" aria-label="名前変更">✏️</button>
                <button class="delete-subject-btn" data-type="${type}" data-index="${idx}" title="科目を削除" aria-label="科目を削除">×</button>
            </div>`;
        });
        html += '</div></div>';

        container.innerHTML = html;
        this._updateSubjectsTally(containerId, timetable);
        this._setupTimetableDnD(container, type, timetable);
        this._setupSubjectEvents(container, type);
    },

    // 時間割設定のセルの中身（科目名と、科目があるときの「×」ボタン）
    _ttCellInnerHtml(subject) {
        return subject
            ? `<span class="cell-content">${escapeHtml(subject)}</span><button class="cell-clear-btn" title="この時限を空にする" aria-label="この時限を空にする">×</button>`
            : '<span class="cell-content"><span class="tt-cell-empty">—</span></span>';
    },

    _updateSubjectsTally(containerId, timetable) {
        const tallyContainer = document.querySelector(`#${containerId} .tally-content`);
        if (!tallyContainer) return;
        const counts = {};
        Object.values(timetable).forEach(dayPeriods => {
            dayPeriods.forEach(subject => {
                if (subject && subject.trim()) counts[subject] = (counts[subject] || 0) + 1;
            });
        });
        const sortedSubjects = Object.keys(counts).sort();
        if (sortedSubjects.length === 0) {
            tallyContainer.innerHTML = '<span class="tally-empty">設定されている科目はありません</span>';
            return;
        }
        tallyContainer.innerHTML = sortedSubjects.map(sub => `
            <div class="tally-item"><strong>${escapeHtml(sub)}</strong>: ${counts[sub]}時間</div>
        `).join('');
    },

    _setupTimetableDnD(container, type, timetable) {
        let selectedMasterValue = null;
        container.querySelectorAll('.subject-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', card.dataset.value);
                e.dataTransfer.effectAllowed = 'copy';
                card.classList.add('dragging');
            });
            card.addEventListener('dragend', () => card.classList.remove('dragging'));
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                const wasSelected = card.classList.contains('selected');
                container.querySelectorAll('.subject-card').forEach(c => c.classList.remove('selected'));
                selectedMasterValue = wasSelected ? null : card.dataset.value;
                card.classList.toggle('selected', !wasSelected);
            });
        });

        // セルの中身を書き換える（「×」もこの中で作り直す）
        const setCell = (cell, value) => {
            const { day, period } = cell.dataset;
            if (type === 'class') this.setClassTimetable(day, parseInt(period), value);
            else this.setMyTimetable(day, parseInt(period), value);
            cell.innerHTML = this._ttCellInnerHtml(value);
            cell.classList.toggle('filled', !!value);
            this._updateSubjectsTally(container.id, timetable);
        };

        container.querySelectorAll('.tt-cell').forEach(cell => {
            cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drag-over'); });
            cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
            cell.addEventListener('drop', (e) => {
                e.preventDefault();
                cell.classList.remove('drag-over');
                setCell(cell, e.dataTransfer.getData('text/plain'));
            });
            cell.addEventListener('click', (e) => {
                if (e.target.closest('.cell-clear-btn')) {
                    setCell(cell, '');
                    return;
                }
                if (selectedMasterValue) setCell(cell, selectedMasterValue);
                else UI.toast('下の科目をクリックで選んでからセルをクリックするか、科目をセルへドラッグしてください', 'info');
            });
        });
    },

    /**
     * 時間割設定ページの描画
     */
    renderSettingsPage() {
        this.loadData();

        // 科目マスターのデフォルト値
        if (this.classSubjects.length === 0) {
            this.classSubjects = ['国語', '算数', '理科', '社会', '英語', '体育', '音楽', '図工', '道徳', '総合'];
        }
        if (this.mySubjects.length === 0) {
            this.mySubjects = [];
        }

        // 自分の時間割を上に表示
        this._renderTimetableEditWithDnD('myTimetableEdit', this.myTimetable, 'my');
        this._renderTimetableEditWithDnD('classTimetableEdit', this.classTimetable, 'class');

        const saveBtn = document.getElementById('saveTimetableBtn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                this.saveData();
                UI.toast('時間割を保存しました', 'success');
            };
        }
    },


    _setupSubjectEvents(container, type) {
        // 科目追加ボタン
        container.querySelectorAll('.add-subject-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const values = await UI.form({
                    title: '＋ 科目を追加',
                    fields: [{
                        name: 'subject',
                        label: type === 'class' ? '科目名' : '科目名とクラス',
                        required: true,
                        placeholder: type === 'class' ? '例: 国語' : '例: 1-1 国語'
                    }],
                    submitLabel: '追加'
                });
                if (!values) return;
                if (type === 'class') {
                    this.classSubjects.push(values.subject);
                } else {
                    this.mySubjects.push(values.subject);
                }
                this.saveData();
                this.renderSettingsPage();
            });
        });

        // 科目編集ボタン
        container.querySelectorAll('.edit-subject-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                const subjects = type === 'class' ? this.classSubjects : this.mySubjects;
                const current = typeof subjects[idx] === 'object'
                    ? `${subjects[idx].class} ${subjects[idx].name}`
                    : subjects[idx];
                const values = await UI.form({
                    title: '✏️ 科目名を変更',
                    description: '時間割と、これまでの時間割変更の中の同じ科目名も、まとめて新しい名前に変わります。',
                    fields: [{ name: 'subject', label: type === 'class' ? '科目名' : '科目名とクラス', required: true, value: current }],
                    submitLabel: '変更'
                });
                if (values && values.subject !== current) {
                    const newVal = values.subject;

                    // マスター更新
                    if (type === 'class') {
                        this.classSubjects[idx] = newVal;
                    } else {
                        this.mySubjects[idx] = newVal;
                    }

                    // 時間割セルを過去にさかのぼって一括置換
                    const timetables = type === 'class'
                        ? [this.classTimetable]
                        : [this.myTimetable];
                    timetables.forEach(tt => {
                        Object.keys(tt).forEach(day => {
                            tt[day] = tt[day].map(s => s === current ? newVal : s);
                        });
                    });

                    // dailyChanges も置換
                    const changesKey = type === 'class' ? 'class' : 'my';
                    const changes = this.dailyChanges[changesKey] || {};
                    Object.keys(changes).forEach(dateStr => {
                        const day = changes[dateStr];
                        Object.keys(day).forEach(periodIdx => {
                            if (day[periodIdx] === current) day[periodIdx] = newVal;
                        });
                    });

                    this.saveData();
                    this.renderSettingsPage();
                }
            });
        });

        // 科目削除ボタン
        container.querySelectorAll('.delete-subject-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                if (type === 'class') {
                    this.classSubjects.splice(idx, 1);
                } else {
                    this.mySubjects.splice(idx, 1);
                }
                this.saveData();
                this.renderSettingsPage();
            });
        });
    }
});
