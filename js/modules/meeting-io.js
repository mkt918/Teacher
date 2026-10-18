// ===== 保護者会時間決定ツールモジュール (希望時間の書き出し・取り込み) =====
// 保護者が日ごとに書いた「行ける時間帯」（例: 14:00-17:00）を、表計算(CSV)を経由して
// 一括登録する。書き出す入力シートと、読み込む形式は同じ。

Object.assign(MeetingModule, {

    // ===== 書き出し =====

    exportPreferenceTemplate() {
        const csv = this.buildPreferenceTemplateCsv();
        if (!csv) {
            UI.toast('先に「① 日程を設定する」で日程を決めてください', 'info');
            return;
        }
        downloadTextFile(csv, `保護者会_希望入力シート_${formatDate(new Date())}.csv`, 'text/csv');
    },

    // 説明つきの入力シートを作る。現在の希望は、連続した枠をまとめた時間帯として入る
    buildPreferenceTemplateCsv() {
        const data = StorageManager.getCurrentData();
        const meeting = data.meeting || {};
        const slots = meeting.slots || [];
        if (slots.length === 0) return '';

        const duration = this._slotDuration(meeting);
        const slotsByDate = this._groupSlotsByDate(slots);
        const dates = Object.keys(slotsByDate);
        const prefs = meeting.studentPreferences || {};

        const notes = [
            `# 保護者会 希望時間 入力シート（出力日: ${formatDate(new Date())}）`,
            '# 【書き方】日付の列に、保護者が行ける時間帯を書きます。例: 14:00-17:00 ／ 時間帯が2つ以上: 14:00-15:00 16:00-17:00 ／ その日は行けない: ×',
            '# 【空欄】未回答として扱い、すでに登録されている希望は変更しません',
            `# 【枠への変換】面談は1回${duration}分です。書かれた時間帯にすっぽり収まる枠だけが「行ける」になります`,
            '# 【注意】番号と見出し（日付）の行は変えないでください。「#」で始まる行は読み込まれません'
        ];

        let csv = '﻿';
        notes.forEach(line => { csv += csvEscape(line) + '\n'; });
        csv += ['番号', '氏名', ...dates.map(d => this._dateColumnLabel(d))].map(csvEscape).join(',') + '\n';

        sortStudentsByNumber(data.students || []).forEach(student => {
            const selected = new Set(prefs[student.id] || []);
            const cells = dates.map(date => this._formatSelectedRanges(slotsByDate[date], selected, duration));
            csv += [student.number, student.nameKanji, ...cells].map(csvEscape).join(',') + '\n';
        });
        return csv;
    },

    // ===== 取り込み =====

    importPreferenceSheet() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,text/csv';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const plan = this.planPreferenceImport(await readCsvFileAsText(file));
                if (plan.error) {
                    UI.toast(plan.error, 'error');
                    return;
                }
                if (plan.updates.length === 0) {
                    UI.notice(this._describePlan(plan), { title: '更新できる回答がありませんでした' });
                    return;
                }
                if (!await UI.confirm(this._describePlan(plan), { title: '希望時間を読み込む', confirmLabel: '希望時間を更新する' })) return;
                this.applyPreferenceImport(plan);
            } catch (err) {
                UI.toast('ファイルの読み込みに失敗しました', 'error');
                console.error(err);
            }
        };
        input.click();
    },

    // CSVを読んで、何がどう変わるかの計画を作る（データはまだ変更しない）
    planPreferenceImport(text) {
        const data = StorageManager.getCurrentData();
        const meeting = data.meeting || {};
        const slots = meeting.slots || [];
        if (slots.length === 0) {
            return { error: '先に「① 日程を設定する」で日程を決めてください' };
        }

        const duration = this._slotDuration(meeting);
        const slotsByDate = this._groupSlotsByDate(slots);
        const dates = Object.keys(slotsByDate);
        const dateOfSlot = new Map(slots.map(s => [s.id, s.date]));

        const rows = parseCsv(text).filter(r =>
            !String(r[0] || '').trim().startsWith('#') && r.some(c => String(c).trim() !== ''));
        const headerIndex = rows.findIndex(r => String(r[0]).trim() === '番号');
        if (headerIndex === -1) {
            return { error: '「番号」で始まる見出し行が見つかりません。書き出した入力シートの形式のまま保存してください' };
        }

        const header = rows[headerIndex];
        const dateColumns = [];
        const unknownColumns = [];
        for (let col = 2; col < header.length; col++) {
            const label = String(header[col]).trim();
            if (!label) continue;
            const date = this._matchScheduleDate(label, dates);
            if (date) dateColumns.push({ col, date, label });
            else unknownColumns.push(label);
        }
        if (dateColumns.length === 0) {
            return { error: '見出し行に、日程設定の日付と一致する列がありません。日程を変更した場合は、入力シートを書き出し直してください' };
        }

        const students = data.students || [];
        const byNumber = new Map(students.map(s => [String(s.number), s]));
        const byName = new Map(students.filter(s => s.nameKanji).map(s => [s.nameKanji.replace(/\s/g, ''), s]));
        const prefs = meeting.studentPreferences || {};

        const plan = {
            updates: [], unansweredCount: 0, allNone: [],
            unmatchedRows: [], invalidCells: [], noSlotCells: [], unknownColumns
        };

        rows.slice(headerIndex + 1).forEach(row => {
            const numberText = String(row[0] || '').trim();
            const nameText = String(row[1] || '').replace(/\s/g, '');
            // Excelで開いて保存し直すと「0101」が「101」になるため、4桁に戻して照合する
            const number = /^\d+$/.test(numberText) ? numberText.padStart(4, '0') : numberText;
            const label = `${numberText} ${String(row[1] || '').trim()}`.trim();
            const student = byNumber.get(number) || byName.get(nameText);
            if (!student) {
                plan.unmatchedRows.push(label);
                return;
            }

            const answeredDates = new Set();
            const newIds = new Set();
            dateColumns.forEach(({ col, date, label: columnLabel }) => {
                const cell = String(row[col] === undefined ? '' : row[col]);
                const parsed = this._parseAvailabilityCell(cell);
                if (parsed.kind === 'blank') return;
                if (parsed.kind === 'invalid') {
                    plan.invalidCells.push(`${label} ${columnLabel}「${cell.trim()}」`);
                    return;
                }
                answeredDates.add(date);
                if (parsed.kind === 'ranges') {
                    const ids = this._slotIdsInRanges(slotsByDate[date], parsed.ranges, duration);
                    if (ids.length === 0) plan.noSlotCells.push(`${label} ${columnLabel}「${cell.trim()}」`);
                    ids.forEach(id => newIds.add(id));
                }
            });

            if (answeredDates.size === 0) {
                plan.unansweredCount++;
                return;
            }

            // 回答のあった日だけ置き換え、回答の無い日の既存の希望は残す
            const kept = (prefs[student.id] || []).filter(id => !answeredDates.has(dateOfSlot.get(id)));
            const merged = [...kept, ...newIds];
            if (merged.length === 0) plan.allNone.push(label);
            plan.updates.push({ studentId: student.id, label, preferences: merged });
        });

        return plan;
    },

    applyPreferenceImport(plan) {
        const data = StorageManager.getCurrentData();
        if (!data.meeting) data.meeting = {};
        if (!data.meeting.studentPreferences) data.meeting.studentPreferences = {};
        plan.updates.forEach(u => {
            data.meeting.studentPreferences[u.studentId] = u.preferences;
        });
        StorageManager.updateCurrentData(data);
        this.render();
    },

    // ===== 内部処理 =====

    _slotDuration(meeting) {
        return parseInt(meeting.settings && meeting.settings.slotDuration, 10) || 15;
    },

    // { 'YYYY-MM-DD': [その日の枠（時刻順）] }。日付の昇順
    _groupSlotsByDate(slots) {
        const grouped = {};
        slots.forEach(slot => {
            if (!grouped[slot.date]) grouped[slot.date] = [];
            grouped[slot.date].push(slot);
        });
        const result = {};
        Object.keys(grouped).sort().forEach(date => {
            result[date] = grouped[date].slice().sort((a, b) => a.time.localeCompare(b.time));
        });
        return result;
    },

    _dateColumnLabel(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return `${m}/${d}(${WEEKDAY_LABELS[new Date(y, m - 1, d).getDay()]})`;
    },

    _timeToMinutes(time) {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    },

    _minutesToTime(minutes) {
        return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    },

    // 選ばれている枠のうち、並びが連続するものを「14:00-15:00」のようにまとめて返す
    _formatSelectedRanges(daySlots, selectedIds, duration) {
        const ranges = [];
        let i = 0;
        while (i < daySlots.length) {
            if (!selectedIds.has(daySlots[i].id)) {
                i++;
                continue;
            }
            let last = i;
            while (last + 1 < daySlots.length && selectedIds.has(daySlots[last + 1].id)) last++;
            const end = this._timeToMinutes(daySlots[last].time) + duration;
            ranges.push(`${daySlots[i].time}-${this._minutesToTime(end)}`);
            i = last + 1;
        }
        return ranges.join(' ');
    },

    // 見出しの「5/15(金)」「2026-05-15」「5月15日」を、日程にある日付に対応づける
    _matchScheduleDate(label, dates) {
        const text = label.normalize('NFKC');
        const iso = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (iso) {
            const date = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
            return dates.includes(date) ? date : null;
        }
        const md = text.match(/(\d{1,2})\s*[\/月.]\s*(\d{1,2})/);
        if (!md) return null;
        const month = Number(md[1]);
        const day = Number(md[2]);
        return dates.find(date => {
            const [, m, d] = date.split('-').map(Number);
            return m === month && d === day;
        }) || null;
    },

    // 1セルの回答を読む。kind: blank(未回答) / none(行けない) / ranges(時間帯あり) / invalid(読めない)
    _parseAvailabilityCell(raw) {
        const text = String(raw === undefined || raw === null ? '' : raw)
            .normalize('NFKC')
            .replace(/から/g, '-')
            .replace(/まで/g, '')
            .replace(/[〜~‐‑–—―−ー]/g, '-')
            .replace(/[、,;\r\n]/g, ' ')
            .trim();
        if (text === '') return { kind: 'blank' };

        // 14 / 14時 / 14:30 / 14時30分 のいずれも1つの時刻として読む
        const time = '(\\d{1,2})(?:[:時](\\d{1,2})?)?分?';
        const rangePattern = new RegExp(`${time}\\s*-\\s*${time}`, 'g');
        const ranges = [];
        let invalid = false;
        for (const m of text.matchAll(rangePattern)) {
            const start = Number(m[1]) * 60 + Number(m[2] || 0);
            const end = Number(m[3]) * 60 + Number(m[4] || 0);
            if (Number(m[1]) > 24 || Number(m[3]) > 24 || Number(m[2] || 0) > 59 || Number(m[4] || 0) > 59 || end <= start) {
                invalid = true;
            } else {
                ranges.push({ start, end });
            }
        }
        if (invalid) return { kind: 'invalid' };
        if (ranges.length > 0) return { kind: 'ranges', ranges };
        if (/^(×|✕|✖|✗|x|-|不可|なし|無し|行けない|不参加|\s)+$/i.test(text)) return { kind: 'none' };
        return { kind: 'invalid' };
    },

    // 面談1回分がどれかの時間帯にすっぽり収まる枠のIDを返す
    _slotIdsInRanges(daySlots, ranges, duration) {
        return daySlots
            .filter(slot => {
                const start = this._timeToMinutes(slot.time);
                return ranges.some(r => start >= r.start && start + duration <= r.end);
            })
            .map(slot => slot.id);
    },

    _describePlan(plan) {
        const list = (items) => {
            const shown = items.slice(0, 5).join('、');
            return items.length > 5 ? `${shown} ほか${items.length - 5}件` : shown;
        };
        const lines = [`希望時間を更新する生徒: ${plan.updates.length}人`];
        if (plan.unansweredCount > 0) {
            lines.push(`未回答（空欄のみ）で変更しない生徒: ${plan.unansweredCount}人`);
        }
        if (plan.allNone.length > 0) {
            lines.push(`⚠️ 行ける時間が1つも無くなる生徒: ${list(plan.allNone)}\n　（自動配置では「希望なし」として扱われ、空き枠のどこかに入ります）`);
        }
        if (plan.noSlotCells.length > 0) {
            lines.push(`⚠️ 時間帯が面談の枠に収まらず、行ける枠が0になった回答: ${list(plan.noSlotCells)}`);
        }
        if (plan.invalidCells.length > 0) {
            lines.push(`⚠️ 読み取れず、取り込まなかった回答: ${list(plan.invalidCells)}`);
        }
        if (plan.unmatchedRows.length > 0) {
            lines.push(`⚠️ 名簿と照合できず、取り込まなかった行: ${list(plan.unmatchedRows)}`);
        }
        if (plan.unknownColumns.length > 0) {
            lines.push(`⚠️ 日程にない日付のため、無視した列: ${list(plan.unknownColumns)}`);
        }
        return lines.join('\n');
    }
});
