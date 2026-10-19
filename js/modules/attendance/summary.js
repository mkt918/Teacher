// ===== 出欠モジュール: 出欠サマリー =====
// 科目別の欠席状況・単位数・警告レベルの計算と、サマリー／科目詳細の表示。
// 本体(AttendanceModule)は index.js。このファイルは index.js より後に読み込むこと。

Object.assign(AttendanceModule, {

    // 生徒1人分の科目別欠席状況から、警告レベル情報を計算する
    _calculateStudentWarningInfo(absenceCounts, credits, subjectNames) {
        let worstLevel = 'ok'; // 'ok' | 'warn' | 'strong' | 'retention'
        const subjectRows = subjectNames.map(sub => {
            const count = absenceCounts[sub] || 0;
            const credit = credits[sub];
            const limitWarn = credit * 7;
            const limitStrong = credit * 9;
            const limitRetain = credit * 11;

            let level = 'ok';
            if (count > limitRetain) level = 'retention';
            else if (count > limitStrong) level = 'strong';
            else if (count > limitWarn) level = 'warn';

            const order = { ok: 0, warn: 1, strong: 2, retention: 3 };
            if (order[level] > order[worstLevel]) worstLevel = level;

            const remaining = limitRetain - count;
            const remainingText = remaining >= 0 ? `あと${remaining}` : '留年';

            return { sub, count, level, remainingText };
        });
        return { worstLevel, subjectRows };
    },

    // 生徒1人分のアコーディオン項目HTMLを生成
    _renderStudentAccordionItem(student, credits, subjectNames, levelLabel) {
        const absenceCounts = this.calculateAbsenceCounts(student.id);
        const { worstLevel, subjectRows } = this._calculateStudentWarningInfo(absenceCounts, credits, subjectNames);
        const isFlagged = !!this.flaggedStudents?.[student.id];

        return `
            <div class="att-accordion-item" data-id="${escapeHtml(student.id)}">
                <div class="att-accordion-header-row">
                    <button type="button" class="att-accordion-header" data-id="${escapeHtml(student.id)}" aria-expanded="false">
                        <span class="att-acc-number">${escapeHtml(student.number)}</span>
                        <span class="att-acc-name">${escapeHtml(student.nameKanji)}</span>
                        <span class="att-acc-status att-level-${worstLevel}">${levelLabel[worstLevel]}</span>
                        <span class="att-acc-arrow">▶</span>
                    </button>
                    <button type="button" class="att-acc-flag-btn ${isFlagged ? 'active' : ''}" data-id="${escapeHtml(student.id)}"
                        title="${isFlagged ? '要注意フラグを外す' : '要注意フラグを付ける'}" aria-label="${isFlagged ? '要注意フラグを外す' : '要注意フラグを付ける'}">⚠️</button>
                </div>
                <div class="att-accordion-body" style="display:none;">
                    <table class="att-acc-subject-table">
                        <thead><tr><th>科目</th><th>単位</th><th>欠席数</th><th>残り</th></tr></thead>
                        <tbody>
                            ${subjectRows.map(r => `
                                <tr class="att-acc-subject-row att-level-${r.level}" data-subject="${escapeHtml(r.sub)}" title="クリックで授業一覧">
                                    <td class="text-left">${escapeHtml(r.sub)}</td>
                                    <td>${credits[r.sub]}</td>
                                    <td>${r.count}</td>
                                    <td>${r.remainingText}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div class="att-acc-actions">
                        <button class="btn btn-primary btn-sm att-acc-input-btn" data-id="${escapeHtml(student.id)}">📝 出欠を入力する</button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * 出欠サマリー描画
     */
    renderAttendanceSummary() {
        const container = document.getElementById('attendanceSummary');
        if (!container) return;

        const data = window.StorageManager?.getCurrentData() || {};
        const students = data.students || [];

        const credits = this.calculateSubjectCredits();
        const subjectNames = Object.keys(credits).sort();

        const levelLabel = { ok: '順調', warn: '注意', strong: '要注意', retention: '留年基準超過' };

        const flagged = students.filter(s => this.flaggedStudents?.[s.id]);
        const others = students.filter(s => !this.flaggedStudents?.[s.id]);

        let html = '<div class="attendance-accordion">';
        html += '<div class="att-summary-guide">⚠️マークで要注意の生徒を常に表示しておけます。生徒をクリックすると出欠状況の詳細が開きます</div>';

        // 要注意（手動フラグ）の生徒：常に表に出しておく
        html += '<div class="att-flagged-section">';
        html += '<h4 class="att-flagged-title">⚠️ 要注意の生徒</h4>';
        if (flagged.length === 0) {
            html += '<p class="att-flagged-empty">現在、要注意フラグが付いている生徒はいません（各生徒の⚠️ボタンで追加できます）</p>';
        } else {
            flagged.forEach(student => {
                html += this._renderStudentAccordionItem(student, credits, subjectNames, levelLabel);
            });
        }
        html += '</div>';

        // それ以外の生徒：まとめて折りたたんでおく
        html += `
            <button type="button" class="att-list-toggle-btn" id="attListToggleBtn" aria-expanded="false">
                <span>👥 生徒一覧を表示（${others.length}人）</span>
                <span class="att-acc-arrow">▶</span>
            </button>
            <div class="att-student-list-body" id="attStudentListBody" style="display:none;">
        `;
        if (others.length === 0) {
            html += '<div class="empty-state-small"><p>生徒名簿から生徒を登録してください</p></div>';
        } else {
            others.forEach(student => {
                html += this._renderStudentAccordionItem(student, credits, subjectNames, levelLabel);
            });
        }
        html += '</div>';

        html += '</div>';

        if (window.CoreDOM) {
            window.CoreDOM.updateDOMWithState(container, html);
        } else {
            container.innerHTML = html;
        }

        // 毎回リスナーを付け直す（古いものを削除してから）
        const oldHandler = container._clickHandler;
        if (oldHandler) container.removeEventListener('click', oldHandler);

        const handler = (e) => {
            // 要注意フラグの切り替え
            const flagBtn = e.target.closest('.att-acc-flag-btn');
            if (flagBtn) {
                this.toggleFlaggedStudent(flagBtn.dataset.id);
                this.renderAttendanceSummary();
                return;
            }

            // 生徒一覧セクション全体の開閉
            const listToggle = e.target.closest('#attListToggleBtn');
            if (listToggle) {
                const body = document.getElementById('attStudentListBody');
                const arrow = listToggle.querySelector('.att-acc-arrow');
                const nextOpen = body.style.display === 'none';
                body.style.display = nextOpen ? 'block' : 'none';
                listToggle.setAttribute('aria-expanded', String(nextOpen));
                arrow.textContent = nextOpen ? '▼' : '▶';
                return;
            }

            // 科目一覧を開く（アコーディオン内の科目行）
            const subjectRow = e.target.closest('.att-acc-subject-row');
            if (subjectRow) {
                this.openSubjectDetailModal(subjectRow.dataset.subject);
                return;
            }

            // 出欠入力モーダルを開く
            const inputBtn = e.target.closest('.att-acc-input-btn');
            if (inputBtn) {
                const data2 = window.StorageManager?.getCurrentData() || {};
                const student = (data2.students || []).find(s => s.id === inputBtn.dataset.id);
                if (student) this.openStudentAttendanceModal(student);
                return;
            }

            // アコーディオンの開閉（同じグループ内では対象の生徒以外はすべて閉じる＝1人だけ開く）
            const header = e.target.closest('.att-accordion-header');
            if (header) {
                const targetId = header.dataset.id;
                const targetItem = header.closest('.att-accordion-item');
                const group = targetItem.closest('.att-flagged-section') || targetItem.closest('#attStudentListBody');
                const scope = group ? group.querySelectorAll('.att-accordion-item') : [targetItem];

                scope.forEach(item => {
                    const body = item.querySelector('.att-accordion-body');
                    const h = item.querySelector('.att-accordion-header');
                    const arrow = h.querySelector('.att-acc-arrow');
                    const isTarget = item.dataset.id === targetId;
                    const isCurrentlyOpen = body.style.display !== 'none';

                    if (isTarget) {
                        // 対象は開閉トグル
                        const nextOpen = !isCurrentlyOpen;
                        body.style.display = nextOpen ? 'block' : 'none';
                        h.setAttribute('aria-expanded', String(nextOpen));
                        arrow.textContent = nextOpen ? '▼' : '▶';
                    } else {
                        // 対象以外はすべて閉じる（アコーディオンに収納）
                        body.style.display = 'none';
                        h.setAttribute('aria-expanded', 'false');
                        arrow.textContent = '▶';
                    }
                });
            }
        };
        container._clickHandler = handler;
        container.addEventListener('click', handler);
    },

    // timetableType: 'class'（生徒出欠サマリー用）または 'my'（授業担当統計用）
    // startDate/endDate: Date オブジェクト（省略時は年度始め〜今日）
    openSubjectDetailModal(subjectName, timetableType = 'class', startDate = null, endDate = null) {
        const sm = window.ScheduleModule;
        if (!sm) return;

        const dayKeys  = WEEKDAY_KEYS;
        const dayLabel = WEEKDAY_LABELS;

        const baseTimetable = timetableType === 'my' ? (sm.myTimetable || {}) : (sm.classTimetable || {});
        const dailyChanges  = timetableType === 'my' ? (sm.dailyChanges?.my || {}) : (sm.dailyChanges?.class || {});

        const today = new Date();
        const fiscalYear = getFiscalYear();
        const rangeStart = startDate || new Date(fiscalYear, 3, 1);
        const rangeEnd   = endDate   || today;
        // 時刻を切り捨てて日付のみで比較
        rangeStart.setHours(0, 0, 0, 0);
        rangeEnd.setHours(23, 59, 59, 999);

        const lessons = [];
        const cur = new Date(rangeStart);
        while (cur <= rangeEnd) {
            const dow = cur.getDay();
            const dayKey = dayKeys[dow];
            if (dow !== 0 && dow !== 6) {
                const dateStr = formatDate(cur);
                const base = baseTimetable[dayKey] || [];
                const changes = dailyChanges[dateStr] || {};
                base.forEach((sub, idx) => {
                    const effective = changes[idx] !== undefined ? changes[idx] : sub;
                    if (effective === subjectName) {
                        lessons.push({ dateStr, dow, period: idx + 1 });
                    }
                });
            }
            cur.setDate(cur.getDate() + 1);
        }

        const rows = lessons.map(({ dateStr, dow, period }, i) => {
            const [y, m, d] = dateStr.split('-');
            return `<tr>
                <td class="lesson-no">${i + 1}</td>
                <td>${parseInt(m)}/${parseInt(d)}</td>
                <td>${dayLabel[dow]}曜日</td>
                <td class="text-center">${period}限</td>
            </tr>`;
        }).join('');

        const rangeLabel = `${rangeStart.getMonth()+1}/${rangeStart.getDate()} 〜 ${rangeEnd.getMonth()+1}/${rangeEnd.getDate()}`;

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `
            <div class="modal-content modal-scroll modal-narrow">
                <div class="modal-header">
                    <h3>${escapeHtml(subjectName)}（${lessons.length}コマ）</h3>
                    <button class="modal-close" aria-label="閉じる" id="closeSubjectModal">✕</button>
                </div>
                <div class="modal-body modal-body-scroll">
                    <div class="lesson-range">📅 ${rangeLabel}</div>
                    <table class="lesson-table">
                        <thead><tr>
                            <th class="lesson-no">回数</th>
                            <th>日付</th>
                            <th>曜日</th>
                            <th class="text-center">時限</th>
                        </tr></thead>
                        <tbody>${rows || '<tr><td colspan="4" class="table-empty">授業記録なし</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;

        document.body.appendChild(modal);
        modal.querySelector('#closeSubjectModal').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    },

    calculateSubjectCredits() {
        const sm = window.ScheduleModule;
        const timetable = sm ? sm.classTimetable : { mon: [], tue: [], wed: [], thu: [], fri: [] };
        const credits = {};

        Object.values(timetable).forEach(periods => {
            periods.forEach(sub => {
                if (sub) {
                    credits[sub] = (credits[sub] || 0) + 1;
                }
            });
        });

        // 基本時間割には無いが、当日の時間割変更（振替等）にだけ登場する科目も
        // 出欠サマリーの集計対象に含める。含めないと、その科目での欠席が
        // 出欠サマリーから完全に見えなくなってしまう。
        // 基本時間割上の「単位（週あたりコマ数）」を持たないため、暫定的に
        // 最低1（週1コマ相当）として扱う。
        if (sm?.dailyChanges?.class) {
            Object.values(sm.dailyChanges.class).forEach(dayChanges => {
                Object.values(dayChanges || {}).forEach(sub => {
                    if (sub && !credits[sub]) {
                        credits[sub] = 1;
                    }
                });
            });
        }

        return credits;
    },

    // dateStrが指定年度（4月始まり）に属するか判定
    _isDateInFiscalYear(dateStr, fiscalYear) {
        const [y, m] = dateStr.split('-').map(Number);
        const recordFiscalYear = m >= 4 ? y : y - 1;
        return recordFiscalYear === fiscalYear;
    },

    calculateAbsenceCounts(studentId) {
        const counts = {};
        const records = this.attendance[studentId] || {};
        const sm = window.ScheduleModule;

        if (!sm) return counts;

        const fiscalYear = getFiscalYear();

        Object.entries(records).forEach(([dateStr, record]) => {
            // 選択中の年度以外の記録は累計に含めない
            if (!this._isDateInFiscalYear(dateStr, fiscalYear)) return;

            const date = new Date(dateStr);
            const dayKey = WEEKDAY_KEYS[date.getDay()];
            if (dayKey === 'sun' || dayKey === 'sat') return;

            const baseSchedule = sm.classTimetable[dayKey] || [];
            const changes = sm.dailyChanges?.class?.[dateStr] || {};

            record.periods.forEach(periodNum => {
                const periodIndex = periodNum - 1;
                const subject = changes[periodIndex] !== undefined ? changes[periodIndex] : baseSchedule[periodIndex];

                if (subject) {
                    counts[subject] = (counts[subject] || 0) + 1;
                }
            });
        });

        return counts;
    }
});
