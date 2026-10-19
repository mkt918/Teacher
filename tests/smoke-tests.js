// ===== スモークテスト本体 =====
// これまで実際に発生した「保存のたびに他データが消える」
// 「エスケープ漏れ」「履歴の復元対象がずれる」といったバグの
// 再発を機械的に検知するための最小限のテスト集。

test('escapeHtml: scriptタグ・引用符を正しくエスケープする', () => {
    assertEqual(
        escapeHtml('<script>alert(1)</script>'),
        '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
    assertEqual(escapeHtml(`"'&`), '&quot;&#039;&amp;');
});

test('getFiscalYear: 未設定時は今日の日付から年度を自動算出する', () => {
    StorageManager.currentData.appSettings = {};
    const today = new Date();
    const expected = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    assertEqual(getFiscalYear(), expected);
});

test('getFiscalYear: 設定済みの年度があればそれを優先する', () => {
    StorageManager.currentData.appSettings = { fiscalYear: 2024 };
    assertEqual(getFiscalYear(), 2024);
});

test('BusModule.saveBuses: 保存時に履歴(history)を消さない（回帰テスト）', () => {
    StorageManager.currentData.bus = {
        buses: [],
        history: [{ name: '既存の履歴', timestamp: new Date().toISOString(), data: [] }]
    };
    BusModule.buses = [{ name: 'テストバス', rows: 1, layout: {} }];
    BusModule.saveBuses();

    assertEqual(StorageManager.currentData.bus.history.length, 1, '履歴が消えていないこと');
    assertEqual(StorageManager.currentData.bus.buses[0].name, 'テストバス');
});

test('GroupsModule.saveGroupSets: 保存時に履歴(history)を消さない（回帰テスト）', () => {
    StorageManager.currentData.groups = {
        groupSets: [],
        history: [{ name: '既存の履歴', timestamp: new Date().toISOString(), data: [] }]
    };
    GroupsModule.groupSets = [{ name: 'テスト班' }];
    GroupsModule.saveGroupSets();

    assertEqual(StorageManager.currentData.groups.history.length, 1, '履歴が消えていないこと');
    assertEqual(StorageManager.currentData.groups.groupSets[0].name, 'テスト班');
});

test('ScheduleModule.saveData: 保存時に未知のフィールドを消さない（回帰テスト）', () => {
    StorageManager.currentData.schedule = { someFutureField: 'keep-me' };
    ScheduleModule.saveData();
    assertEqual(StorageManager.currentData.schedule.someFutureField, 'keep-me');
});

test('CalendarModule.saveEvents: 保存時に未知のフィールドを消さない（回帰テスト）', () => {
    StorageManager.currentData.calendar = { someFutureField: 'keep-me' };
    CalendarModule.events = [];
    CalendarModule.saveEvents();
    assertEqual(StorageManager.currentData.calendar.someFutureField, 'keep-me');
});

test('HistoryModal: 新しい順に表示され、選んだ履歴が正しく復元される（回帰テスト）', async () => {
    let historyArr = [];
    let currentValue = '';
    let restoredTo = null;

    const config = {
        modalId: 'smokeHistoryModal',
        title: 'スモークテスト履歴',
        getHistory: () => historyArr,
        setHistory: (h) => { historyArr = h; },
        getSnapshot: () => currentValue,
        applySnapshot: (v) => { restoredTo = v; }
    };

    currentValue = 'first-save';
    window.HistoryModal.open(config);
    document.getElementById('smokeHistoryModal_titleInput').value = 'A';
    document.getElementById('smokeHistoryModal_saveBtn').click();

    currentValue = 'second-save';
    document.getElementById('smokeHistoryModal_titleInput').value = 'B';
    document.getElementById('smokeHistoryModal_saveBtn').click();

    const titles = Array.from(document.querySelectorAll('#smokeHistoryModal .history-title')).map(el => el.textContent);
    assertEqual(titles, ['B', 'A'], '新しい順（B, A）に表示されること');

    // 2番目に表示されている「A」を復元する
    document.querySelectorAll('#smokeHistoryModal .load-history-btn')[1].click();
    await new Promise(resolve => setTimeout(resolve, 0)); // 確認（UI.confirm）への答えを待つ
    assertEqual(restoredTo, 'first-save', '「A」を選んだら保存時点(first-save)が復元されること');
});

test('AttendanceModule.saveData/loadData: 要注意フラグ(flaggedStudents)が保存・復元される', () => {
    AttendanceModule.attendance = { s1: { '2026-05-04': { periods: [1] } } };
    AttendanceModule.lockedMonths = {};
    AttendanceModule.flaggedStudents = { s1: true };
    AttendanceModule.saveData();

    // キャッシュを消してから読み直す
    AttendanceModule.attendance = {};
    AttendanceModule.flaggedStudents = {};
    AttendanceModule.loadData();

    assertEqual(AttendanceModule.flaggedStudents, { s1: true }, 'フラグが復元されること');
    assertEqual(AttendanceModule.attendance.s1['2026-05-04'].periods, [1], '出欠記録も復元されること');
});

test('AttendanceModule._isDateInFiscalYear: 4月始まりの年度判定が正しい', () => {
    assertTrue(AttendanceModule._isDateInFiscalYear('2026-04-01', 2026), '4/1は当年度');
    assertTrue(AttendanceModule._isDateInFiscalYear('2027-03-31', 2026), '翌年3/31は当年度');
    assertTrue(!AttendanceModule._isDateInFiscalYear('2026-03-31', 2026), '3/31は前年度');
    assertTrue(!AttendanceModule._isDateInFiscalYear('2027-04-01', 2026), '翌年4/1は翌年度');
});

test('AttendanceModule.buildTeacherLessonCsv: 期間内の該当曜日の日付が科目ごとの表になる', () => {
    const original = ScheduleModule.myTimetable;
    try {
        // 国語: 月3・火2・木1、数学: 月4・金1（月の2コマは別の列になること）
        ScheduleModule.myTimetable = {
            mon: ['', '', '国語', '数学', '', ''],
            tue: ['', '国語', '', '', '', ''],
            wed: ['', '', '', '', '', ''],
            thu: ['国語', '', '', '', '', ''],
            fri: ['数学', '', '', '', '', '']
        };
        // 2026-04-06(月)〜2026-04-19(日): 月は6,13 / 火は7,14 / 木は9,16 / 金は10,17
        const lines = AttendanceModule.buildTeacherLessonCsv('2026-04-06', '2026-04-19')
            .replace('﻿', '').split('\n');

        assertEqual(lines[0], '期間,2026-04-06,2026-04-19');
        const kokugo = lines.indexOf('国語（全6コマ）');
        assertTrue(kokugo > 0, '国語は全6コマと表示されること');
        assertEqual(lines[kokugo + 1], '回数,月3限,火2限,木1限', '曜日と時限が列見出しになること');
        assertEqual(lines[kokugo + 2], '1回目,2026-04-06,2026-04-07,2026-04-09');
        assertEqual(lines[kokugo + 3], '2回目,2026-04-13,2026-04-14,2026-04-16');

        const sugaku = lines.indexOf('数学（全4コマ）');
        assertEqual(lines[sugaku + 1], '回数,月4限,金1限');
        assertEqual(lines[sugaku + 2], '1回目,2026-04-06,2026-04-10');
    } finally {
        ScheduleModule.myTimetable = original;
    }
});

test('AttendanceModule.buildTeacherLessonCsv: 期間の端の日付を含み、授業が無ければ空文字', () => {
    const original = ScheduleModule.myTimetable;
    try {
        ScheduleModule.myTimetable = {
            mon: ['', '', '', '', '', ''], tue: ['', '', '', '', '', ''], wed: ['', '', '', '', '', ''],
            thu: ['', '', '', '', '', ''], fri: ['', '', '', '', '', '']
        };
        assertEqual(AttendanceModule.buildTeacherLessonCsv('2026-04-01', '2026-04-30'), '', '授業が無ければ空文字');

        ScheduleModule.myTimetable.wed = ['理科', '', '', '', '', ''];
        // 開始日・終了日がちょうど水曜日（4/1と4/29）
        const lines = AttendanceModule.buildTeacherLessonCsv('2026-04-01', '2026-04-29').split('\n');
        assertTrue(lines.includes('1回目,2026-04-01'), '開始日当日が含まれること');
        assertTrue(lines.includes('5回目,2026-04-29'), '終了日当日が含まれること');
    } finally {
        ScheduleModule.myTimetable = original;
    }
});

test('SeatingModule._getNormalizedHistory: 旧形式の席替え履歴が新しい順の共通形式に変換される', () => {
    // 旧形式は古い順にpushされていた
    StorageManager.currentData.seating = {
        history: [
            { date: '2026/4/1 9:00:00', title: '古い方', layout: [['a']], rows: 1, cols: 1 },
            { date: '2026/5/1 9:00:00', title: '新しい方', layout: [['b']], rows: 1, cols: 1 }
        ]
    };
    const history = SeatingModule._getNormalizedHistory();

    assertEqual(history.map(h => h.name), ['新しい方', '古い方'], '新しい順になること');
    assertEqual(history[0].data.layout, [['b']], '座席データが引き継がれること');
    assertEqual(history[0].data.rows, 1, '行数が引き継がれること');

    // 変換済みのデータをもう一度通しても順序が入れ替わらない（冪等）
    assertEqual(SeatingModule._getNormalizedHistory().map(h => h.name), ['新しい方', '古い方'], '2回目も同じ順序');
});

test('MeetingModule._getNormalizedHistory: 旧形式の保護者会履歴の希望時間も含めて引き継がれる', () => {
    StorageManager.currentData.meeting = {
        history: [{
            name: '1学期', timestamp: '2026-06-01T00:00:00.000Z',
            slots: [{ id: 's1' }], settings: { slotDuration: 15 },
            lockedSlots: ['s1'], lockedStudents: [], studentPreferences: { stu1: ['s1'] }
        }]
    };
    const history = MeetingModule._getNormalizedHistory();

    assertEqual(history[0].name, '1学期');
    assertEqual(history[0].data.slots, [{ id: 's1' }], 'スロットが引き継がれること');
    assertEqual(history[0].data.studentPreferences, { stu1: ['s1'] }, '希望時間が引き継がれること');
    assertTrue(history[0].slots === undefined, '旧フィールドは残らないこと');
});

test('parseCsv: 引用符内のカンマ・改行・""とCRLF・BOMを正しく読む', () => {
    const rows = parseCsv('﻿a,"b,c","d\ne"\r\n"x""y",,z\r\n');
    assertEqual(rows, [['a', 'b,c', 'd\ne'], ['x"y', '', 'z']]);
});

test('MeetingModule._parseAvailabilityCell: 保護者の書き方のゆれを同じ時間帯として読む', () => {
    const ranges = (text) => MeetingModule._parseAvailabilityCell(text).ranges;
    const want = [{ start: 14 * 60, end: 17 * 60 }];
    assertEqual(ranges('14:00-17:00'), want, '半角コロン');
    assertEqual(ranges('14時-17時'), want, '「時」表記');
    assertEqual(ranges('14-17'), want, '時のみ');
    assertEqual(ranges('１４時〜１７時'), want, '全角数字と波ダッシュ');
    assertEqual(ranges('14時から17時まで'), want, '「から・まで」');
    assertEqual(ranges('14:30-16'), [{ start: 14 * 60 + 30, end: 16 * 60 }], '分が片方だけ');
    assertEqual(ranges('14:00-15:00 16:00-17:00'), [{ start: 840, end: 900 }, { start: 960, end: 1020 }], '複数の時間帯');
    assertEqual(MeetingModule._parseAvailabilityCell('×').kind, 'none');
    assertEqual(MeetingModule._parseAvailabilityCell('✕').kind, 'none');
    assertEqual(MeetingModule._parseAvailabilityCell('  ').kind, 'blank');
    assertEqual(MeetingModule._parseAvailabilityCell('夕方なら').kind, 'invalid', '読めない文は取り込まない');
    assertEqual(MeetingModule._parseAvailabilityCell('17:00-14:00').kind, 'invalid', '終わりが始めより前');
});

// 15分枠: 5/15は14:00〜14:45、5/16は14:00〜14:45 の4枠ずつ
function setupMeetingForImportTest() {
    const slots = [];
    ['2026-05-15', '2026-05-16'].forEach(date => {
        ['14:00', '14:15', '14:30', '14:45'].forEach(time => slots.push({ id: `${date}_${time}`, date, time, studentId: null }));
    });
    StorageManager.currentData.students = [
        { id: 's1', number: '0101', nameKanji: '山田太郎', nameKana: '' },
        { id: 's2', number: '0102', nameKanji: '佐藤花子', nameKana: '' },
        { id: 's3', number: '0103', nameKanji: '鈴木一郎', nameKana: '' }
    ];
    StorageManager.currentData.meeting = {
        settings: { slotDuration: 15 },
        slots,
        studentPreferences: { s3: ['2026-05-16_14:00'] }
    };
}

test('MeetingModule.planPreferenceImport: 時間帯を枠に変換し、未回答の日・生徒は変更しない', () => {
    setupMeetingForImportTest();
    const csv = [
        '# 説明の行は読み込まれない',
        '番号,氏名,5/15(金),5/16(土),5/17(日)',
        '101,山田太郎,14:00-14:30,×,14:00-15:00',   // 番号の先頭0が落ちた形でも照合できる
        '0102,佐藤花子,,,',
        '0103,鈴木一郎,14:15-15:00,,',
        '0999,不明,14:00-15:00,,'
    ].join('\n');
    const plan = MeetingModule.planPreferenceImport(csv);

    assertTrue(!plan.error, 'エラーにならないこと');
    const byId = Object.fromEntries(plan.updates.map(u => [u.studentId, u.preferences]));
    assertEqual(byId.s1, ['2026-05-15_14:00', '2026-05-15_14:15'], '14:00-14:30は15分枠2つ。5/16は×で0');
    assertTrue(!('s2' in byId), '全て空欄の生徒は更新しない');
    assertEqual(plan.unansweredCount, 1);
    assertEqual(byId.s3, ['2026-05-16_14:00', '2026-05-15_14:15', '2026-05-15_14:30', '2026-05-15_14:45'],
        '回答の無い5/16の既存の希望は残り、5/15は置き換わる');
    assertEqual(plan.unmatchedRows, ['0999 不明'], '名簿に無い番号は取り込まない');
    assertEqual(plan.unknownColumns, ['5/17(日)'], '日程に無い日付の列は無視する');
});

test('MeetingModule: 書き出した入力シートをそのまま読み込むと同じ希望になる（往復）', () => {
    setupMeetingForImportTest();
    StorageManager.currentData.meeting.studentPreferences = {
        s1: ['2026-05-15_14:00', '2026-05-15_14:15', '2026-05-15_14:45', '2026-05-16_14:30'],
        s2: []
    };
    const csv = MeetingModule.buildPreferenceTemplateCsv();
    const lines = csv.replace('﻿', '').split('\n');

    assertTrue(lines[0].startsWith('# '), '先頭に説明行が付くこと');
    assertTrue(lines.includes('番号,氏名,5/15(金),5/16(土)'), '日付が見出しになること');
    assertTrue(lines.includes('0101,山田太郎,14:00-14:30 14:45-15:00,14:30-14:45'), '連続した枠が時間帯にまとまること');

    const plan = MeetingModule.planPreferenceImport(csv);
    const s1 = plan.updates.find(u => u.studentId === 's1');
    assertEqual(s1.preferences.slice().sort(), StorageManager.currentData.meeting.studentPreferences.s1.slice().sort(),
        '書き出した内容を読み直しても希望が変わらないこと');
    assertEqual(plan.unansweredCount, 2, '希望の無い生徒は未回答（変更なし）として扱われること');
});

test('MeetingModule.planPreferenceImport: 全日×の生徒は警告の対象になる', () => {
    setupMeetingForImportTest();
    const plan = MeetingModule.planPreferenceImport('番号,氏名,5/15,5/16\n0102,佐藤花子,×,×');
    assertEqual(plan.allNone, ['0102 佐藤花子']);
    assertEqual(plan.updates[0].preferences, [], '希望は空になる');
});

test('ReportModule.saveReport: 所見の保存・空文字での削除が正しく動く', () => {
    StorageManager.currentData.reports = {};
    ReportModule.saveReport('stu1', '落ち着いて学習に取り組めた。');
    assertEqual(StorageManager.currentData.reports.stu1.text, '落ち着いて学習に取り組めた。');

    ReportModule.saveReport('stu1', '   ');
    assertTrue(!StorageManager.currentData.reports.stu1, '空白のみなら削除されること');
});

test('CloudSync.saveToCloud: 送信ペイロードに全同期フィールドが含まれる', async () => {
    const data = StorageManager.currentData;
    data.students = [{ id: 's1', number: '1101', nameKanji: 'テスト', nameKana: 'てすと' }];
    data.attendance = { records: {} };
    data.reports = { s1: { text: 'テスト所見' } };

    const originalFetch = window.fetch;
    let capturedBody = null;
    window.fetch = async (url, opts) => {
        capturedBody = JSON.parse(opts.body);
        return { json: async () => ({ ok: true, updatedAt: new Date().toISOString() }) };
    };

    try {
        CloudSync.gasUrl = 'https://example.com/exec';
        CloudSync.syncing = false;
        await CloudSync.saveToCloud();
    } finally {
        window.fetch = originalFetch;
        CloudSync.gasUrl = '';
    }

    assertTrue(!!capturedBody.appData, 'appDataが送信されること');
    assertEqual(capturedBody.appData.students[0].number, '1101', '生徒名簿が含まれること');
    assertTrue(!!capturedBody.appData.attendance, '出欠記録が含まれること');
    assertEqual(capturedBody.appData.reports.s1.text, 'テスト所見', '所見が含まれること');
    assertTrue(capturedBody.appData.appSettings === undefined, 'appSettings(端末設定)は同期されないこと');
});

test('CloudSync._fetchCloud: 合言葉をURLに含めずPOSTで送る（回帰テスト）', async () => {
    const originalFetch = window.fetch;
    let capturedUrl = null;
    let capturedOpts = null;
    window.fetch = async (url, opts) => {
        capturedUrl = url;
        capturedOpts = opts;
        return { json: async () => ({ ok: true, appData: {}, updatedAt: null }) };
    };

    try {
        CloudSync.gasUrl = 'https://example.com/exec';
        CloudSync.apiKey = 'secret-passphrase';
        await CloudSync._fetchCloud();
    } finally {
        window.fetch = originalFetch;
        CloudSync.gasUrl = '';
        CloudSync.apiKey = '';
    }

    assertEqual(capturedUrl, 'https://example.com/exec', 'URLに合言葉が含まれないこと');
    assertEqual(capturedOpts.method, 'POST', 'POSTで送ること');
    const body = JSON.parse(capturedOpts.body);
    assertEqual(body.action, 'load', 'action=loadを送ること');
    assertEqual(body.apiKey, 'secret-passphrase', '合言葉は本文で送ること');
});

test('CloudSync.saveToCloud: 保存成功後にlastSyncAtがローカルにも反映される（回帰テスト）', async () => {
    // 修正前は同期後もローカルのlastSyncAtが更新されず、次回起動時に
    // クラウドの方が新しいと誤判定されて保存直後の内容が巻き戻っていた
    const originalFetch = window.fetch;
    let callCount = 0;
    window.fetch = async () => {
        callCount++;
        return { json: async () => ({ ok: true, updatedAt: new Date().toISOString() }) };
    };

    try {
        CloudSync.gasUrl = 'https://example.com/exec';
        CloudSync.syncing = false;
        CloudSync.pendingSync = false;
        await CloudSync.saveToCloud();
    } finally {
        window.fetch = originalFetch;
        CloudSync.gasUrl = '';
    }

    assertTrue(!!StorageManager.currentData.syncSettings?.lastSyncAt, '保存後にsyncSettings.lastSyncAtが記録されること');
    assertEqual(callCount, 1, 'lastSyncAtの記録が自動保存の再トリガーで無限ループしないこと');
});

test('CloudSync.saveToCloud: 同期中に発生した変更を取りこぼさない（回帰テスト）', async () => {
    const originalFetch = window.fetch;
    let callCount = 0;
    window.fetch = async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return { json: async () => ({ ok: true, updatedAt: new Date().toISOString() }) };
    };

    try {
        CloudSync.gasUrl = 'https://example.com/exec';
        CloudSync.syncing = false;
        CloudSync.pendingSync = false;

        const first = CloudSync.saveToCloud();
        await new Promise(resolve => setTimeout(resolve, 10));
        // 通信中にユーザーが編集した（updateCurrentDataで変更番号が進む）
        StorageManager.updateCurrentData({ students: [{ id: 'x', number: '0001' }] });
        const second = CloudSync.saveToCloud(); // 通信中なのでpendingSyncになるはず
        assertTrue(CloudSync.pendingSync, '通信中の呼び出しはpendingSyncフラグが立つこと');
        await Promise.all([first, second]);
        await new Promise(resolve => setTimeout(resolve, 150)); // pending分の再送を待つ
    } finally {
        window.fetch = originalFetch;
        CloudSync.gasUrl = '';
    }

    assertEqual(callCount, 2, '通信中の変更ぶんとして自動的にもう一度保存されること');
    assertEqual(StorageManager.currentData.syncSettings.dirty, false, '最後の保存が済んだら未同期の印が消えること');
});

test('CloudSync._applyCloudData: 読み込み中にローカルで編集したフィールドは上書きしない（回帰テスト）', () => {
    // 初回同期の読み込み待ち中に入力したデータがクラウドの内容で
    // 消えてしまわないようにするための保護（スナップショット比較）
    const data = { students: [{ id: 's1', nameKanji: 'ローカル編集後' }], attendance: { records: {} } };
    const localSnapshot = { students: JSON.stringify([{ id: 's1', nameKanji: '編集前' }]), attendance: JSON.stringify({ records: {} }) };

    const json = {
        appData: {
            students: [{ id: 's1', nameKanji: 'クラウドの内容' }],
            attendance: { records: { s1: { '2026-01-01': { periods: [1] } } } }
        }
    };

    CloudSync._applyCloudData(data, json, localSnapshot);

    assertEqual(data.students[0].nameKanji, 'ローカル編集後', '読み込み中に編集したフィールドはクラウドで上書きされないこと');
    assertTrue(!!data.attendance.records.s1, '編集していないフィールドはクラウドの内容が反映されること');
});

test('MasterModule.init: 複数回呼んでもイベントリスナーが多重登録されない（回帰テスト）', () => {
    // クラウド同期で全ページ共通のRouter.navigateTo()が呼ばれるたびに
    // init()が再実行される可能性があるため、多重登録防止ガードを検証する
    const stub = document.createElement('div');
    stub.id = 'smokeMasterStub';
    stub.innerHTML = `
        <button id="addStudentBtn"></button>
        <button id="closeStudentModal"></button>
        <button id="cancelStudentBtn"></button>
        <button id="saveStudentBtn"></button>
        <input id="studentSearch">
        <select id="sortSelect"></select>
        <button id="importCsvBtn"></button>
        <button id="exportCsvBtn"></button>
    `;
    document.body.appendChild(stub);

    let clickCount = 0;
    const originalOpen = MasterModule.openStudentModal;
    MasterModule.openStudentModal = () => { clickCount++; };

    try {
        MasterModule.initialized = false;
        MasterModule.init();
        MasterModule.init();
        MasterModule.init();
        document.getElementById('addStudentBtn').click();
    } finally {
        MasterModule.openStudentModal = originalOpen;
        MasterModule.initialized = false;
        stub.remove();
    }

    assertEqual(clickCount, 1, 'init()を複数回呼んでもクリックハンドラは1回しか実行されないこと');
});

test('DutiesModule.init: 複数回呼んでもinitializedフラグにより再初期化されない（回帰テスト）', () => {
    const originalSetup = DutiesModule.setupEventListeners;
    DutiesModule.initialized = false;
    let setupCallCount = 0;
    DutiesModule.setupEventListeners = () => { setupCallCount++; };
    try {
        DutiesModule.init();
        assertTrue(DutiesModule.initialized, '1回目でinitializedがtrueになること');
        DutiesModule.init();
        DutiesModule.init();
    } finally {
        DutiesModule.setupEventListeners = originalSetup;
        DutiesModule.initialized = false;
    }

    assertEqual(setupCallCount, 1, 'setupEventListenersは1回目しか呼ばれないこと');
});

test('DutiesModule.printDuties: 印刷HTMLに未エスケープのタグが混入しない（回帰テスト）', () => {
    const data = StorageManager.currentData;
    data.students = [{
        id: 'xx',
        number: '<img src=x onerror=alert(1)>',
        nameKanji: '<script>alert(2)</script>'
    }];
    data.duties = [{
        id: 'd1', name: '<b>係名</b>', description: '<i>説明</i>',
        assignedStudents: ['xx'], maxStudents: 1
    }];

    const originalOpen = window.open;
    let captured = '';
    window.open = () => ({
        closed: false,
        document: { write: (h) => { captured = h; }, close: () => {} },
        focus() {}, print() {}
    });

    try {
        DutiesModule.printDuties();
    } finally {
        window.open = originalOpen;
    }

    assertTrue(!captured.includes('<script>alert(2)</script>'), '生のscriptタグが含まれないこと');
    assertTrue(!captured.includes('<img src=x onerror=alert(1)>'), '生のimg onerrorが含まれないこと');
    assertTrue(captured.includes('&lt;b&gt;係名&lt;/b&gt;'), '係名がエスケープされていること');
});

// ===== 保存システム（StorageManager） =====

function readStoredPayload() {
    return JSON.parse(localStorage.getItem(StorageManager.STORAGE_KEY));
}

test('StorageManager: 自動バックアップは10分以上あけて、変更前の状態が残る', () => {
    StorageManager.currentData.students = [{ id: 'a' }];
    StorageManager._lastSerialized = JSON.stringify(StorageManager.currentData); // 起動時に読み込んだ状態

    StorageManager.currentData.students.push({ id: 'b' });
    StorageManager._persist();
    assertEqual(StorageManager.backups.length, 1, '最初の変更で、変更前の状態が1件残ること');
    assertEqual(StorageManager.backups[0].data.students.length, 1, '変更前（1人）の状態であること');

    StorageManager.currentData.students.push({ id: 'c' });
    StorageManager._persist();
    assertEqual(StorageManager.backups.length, 1, '10分たつまでは増えないこと');

    StorageManager.lastBackupAt = Date.now() - 11 * 60 * 1000;
    StorageManager.currentData.students.push({ id: 'd' });
    StorageManager._persist();
    assertEqual(StorageManager.backups.length, 2, '10分以上たてば新しいバックアップが増えること');
    assertEqual(StorageManager.backups[0].data.students.length, 3, '直前（3人）の状態が先頭に入ること');
    assertEqual(readStoredPayload().backups.length, 2, 'LocalStorageにも書かれていること');
});

test('StorageManager: 全データのコピーを重ねて保存しない（現在データ1つ＋バックアップのみ）', () => {
    const marker = 'あ'.repeat(1000);
    StorageManager.currentData.students = [{ id: 'a', nameKanji: marker }];
    StorageManager._lastSerialized = JSON.stringify(StorageManager.currentData);
    StorageManager.currentData.todos = [{ id: 't' }];
    StorageManager._persist();

    const payload = readStoredPayload();
    assertEqual(Object.keys(payload).sort(), ['backups', 'current', 'lastBackupAt', 'savedAt', 'stateSave', 'version'], '保存の構造');
    assertEqual(payload.version, 2);
    // 以前は「最新」「現在」など複数か所に同じデータを持っていた
    const copies = localStorage.getItem(StorageManager.STORAGE_KEY).split(marker).length - 1;
    assertEqual(copies, 2, '現在データ1つ＋変更前のバックアップ1つの計2か所だけ');
});

test('StorageManager: 旧形式(autoSave.latest/tenBefore/twentyBefore)の保存データを引き継ぐ', () => {
    localStorage.setItem(StorageManager.STORAGE_KEY, JSON.stringify({
        autoSave: {
            latest: { timestamp: '2026-05-03T00:00:00.000Z', data: { students: [{ id: 'new' }] } },
            tenBefore: { timestamp: '2026-05-02T00:00:00.000Z', data: { students: [{ id: 'mid' }] } },
            twentyBefore: { timestamp: '2026-05-01T00:00:00.000Z', data: { students: [{ id: 'old' }] } }
        },
        stateSave: [{ slot: 2, name: '学期初め', timestamp: '2026-04-01T00:00:00.000Z', data: { students: [] } }],
        current: { students: [{ id: 'new' }] },
        saveCounter: 25
    }));
    StorageManager._load();

    assertEqual(StorageManager.currentData.students, [{ id: 'new' }], '最新のデータが現在データになること');
    assertEqual(StorageManager.backups.map(b => b.data.students[0].id), ['mid', 'old'], '過去の保存がバックアップに移ること');
    assertEqual(StorageManager.stateSaves[0].name, '学期初め', 'ステートセーブが残ること');
    assertTrue(Array.isArray(StorageManager.currentData.duties), '足りない項目は初期値で補われること');
});

test('StorageManager: ステートセーブは保存時点の内容を保ち、その後の編集に影響されない', () => {
    StorageManager.currentData.students = [{ id: 'a' }];
    assertTrue(StorageManager.saveStateSave(1, '前半'), '保存できること');

    StorageManager.currentData.students.push({ id: 'b' }); // モジュールがやるのと同じ、データへの直接の書き込み
    StorageManager._persist();
    assertEqual(readStoredPayload().stateSave[0].data.students.length, 1, '保存済みのステートが編集で書き換わらないこと');

    StorageManager.loadStateSave(1);
    assertEqual(StorageManager.currentData.students.length, 1, 'ステートの内容に戻ること');
    StorageManager.currentData.students.push({ id: 'c' });
    assertEqual(StorageManager.stateSaves[0].data.students.length, 1, '読み込み後の編集でステートが書き換わらないこと');
    assertEqual(StorageManager.backups[0].data.students.length, 2, '読み込む前の状態がバックアップに退避されること');
});

test('StorageManager: 容量が足りないときは自動バックアップだけ省き、ステートセーブは消さない', () => {
    StorageManager.currentData.students = [{ id: 'a' }];
    StorageManager.saveStateSave(1, '大事な保存');
    StorageManager.snapshotToBackup();
    assertTrue(readStoredPayload().backups.length === 1, '前提: バックアップがある');

    const originalSetItem = Storage.prototype.setItem;
    // バックアップを含む大きな書き込みだけ失敗させる（容量超過の再現）
    Storage.prototype.setItem = function (key, value) {
        if (value.includes('"backups":[{')) throw new DOMException('quota', 'QuotaExceededError');
        return originalSetItem.call(this, key, value);
    };
    let saved;
    try {
        StorageManager.currentData.students.push({ id: 'b' });
        saved = StorageManager._persist();
    } finally {
        Storage.prototype.setItem = originalSetItem;
    }

    assertTrue(saved, '保存自体は成功すること');
    const payload = readStoredPayload();
    assertEqual(payload.current.students.length, 2, '現在のデータは保存されること');
    assertEqual(payload.stateSave[0].name, '大事な保存', 'ステートセーブは消えないこと');
    assertEqual(payload.backups, [], '自動バックアップだけが省かれること');
});

test('StorageManager.restoreBackup: 戻す前の状態もバックアップに残り、クラウド接続情報は引き継がれる', () => {
    StorageManager.currentData.students = [{ id: 'old' }];
    StorageManager.currentData.appSettings.gasEndpointUrl = 'https://old.example/exec';
    StorageManager.snapshotToBackup();

    StorageManager.currentData.students = [{ id: 'new' }];
    StorageManager.currentData.appSettings.gasEndpointUrl = 'https://new.example/exec';
    StorageManager.currentData.appSettings.gasApiKey = 'secret';

    assertTrue(StorageManager.restoreBackup(0), '復元できること');
    assertEqual(StorageManager.currentData.students, [{ id: 'old' }], 'バックアップの内容に戻ること');
    assertEqual(StorageManager.currentData.appSettings.gasEndpointUrl, 'https://new.example/exec', '接続先は端末の現在の設定のまま');
    assertEqual(StorageManager.currentData.appSettings.gasApiKey, 'secret', '合言葉も端末の現在の設定のまま');
    assertEqual(StorageManager.backups[0].data.students, [{ id: 'new' }], '戻す前の状態が新しいバックアップになること');
});

test('StorageManager: 壊れた保存データは上書きせずに別のキーへ退避する', () => {
    localStorage.setItem(StorageManager.STORAGE_KEY, '{壊れたJSON');
    StorageManager._load();

    const corruptKeys = Object.keys(localStorage).filter(k => k.startsWith(StorageManager.STORAGE_KEY + '_corrupt_'));
    try {
        assertEqual(corruptKeys.length, 1, '退避されること');
        assertEqual(localStorage.getItem(corruptKeys[0]), '{壊れたJSON');
        assertEqual(StorageManager.currentData.students, [], '起動は初期データで続けること');
    } finally {
        corruptKeys.forEach(k => localStorage.removeItem(k));
    }
});

// ===== クラウド同期の競合 =====

// fetchを差し替えて、クラウド側の状態を持つ疑似GASを作る
function mockCloud(initial) {
    const cloud = { appData: initial.appData || null, updatedAt: initial.updatedAt || null, requests: [] };
    const originalFetch = window.fetch;
    window.fetch = async (url, opts) => {
        const body = JSON.parse(opts.body);
        cloud.requests.push(body);
        if (body.action === 'load') {
            return { json: async () => ({ ok: true, appData: cloud.appData, updatedAt: cloud.updatedAt }) };
        }
        if (body.baseUpdatedAt !== undefined && !body.force && cloud.updatedAt && cloud.updatedAt !== body.baseUpdatedAt) {
            return { json: async () => ({ ok: false, conflict: true, updatedAt: cloud.updatedAt }) };
        }
        cloud.appData = body.appData;
        cloud.updatedAt = new Date(Date.now() + cloud.requests.length).toISOString();
        return { json: async () => ({ ok: true, updatedAt: cloud.updatedAt }) };
    };
    cloud.restore = () => { window.fetch = originalFetch; CloudSync.gasUrl = ''; CloudSync.conflictPending = false; };
    CloudSync.gasUrl = 'https://example.com/exec';
    CloudSync.syncing = false;
    CloudSync.loading = false;
    CloudSync.pendingSync = false;
    CloudSync.conflictPending = false;
    return cloud;
}

test('CloudSync: 保存には、どの版のクラウドを見て編集したか(baseUpdatedAt)を添える', async () => {
    const cloud = mockCloud({});
    const originalChoose = UI.choose;
    // 2回目の保存は「初めて同期する端末」なので競合になる。ここでは送信内容だけを見たいので、選ばずに閉じる
    UI.choose = async () => null;
    try {
        StorageManager.currentData.students = [{ id: 'a' }];
        StorageManager.currentData.syncSettings = { lastSyncAt: '2026-05-01T00:00:00.000Z', dirty: true };
        await CloudSync.saveToCloud();
        assertEqual(cloud.requests[0].baseUpdatedAt, '2026-05-01T00:00:00.000Z');

        StorageManager.currentData.syncSettings = { dirty: true };
        await CloudSync.saveToCloud();
        assertEqual(cloud.requests[1].baseUpdatedAt, null, '一度も同期していなければnull');
    } finally {
        UI.choose = originalChoose;
        cloud.restore();
    }
});

test('CloudSync: 競合の確認を選ばずに閉じたときは、クラウドもこの端末も変えない', async () => {
    const cloud = mockCloud({ appData: { students: [{ id: 'cloud' }] }, updatedAt: '2026-05-02T00:00:00.000Z' });
    const originalChoose = UI.choose;
    UI.choose = async () => null; // Esc・✕・「あとで決める」
    try {
        StorageManager.currentData.students = [{ id: 'local' }];
        StorageManager.currentData.syncSettings = { lastSyncAt: '2026-05-01T00:00:00.000Z', dirty: true };
        await CloudSync.saveToCloud();

        assertEqual(cloud.appData.students, [{ id: 'cloud' }], 'クラウドは上書きされない');
        assertEqual(StorageManager.currentData.students, [{ id: 'local' }], 'この端末も変わらない');
        assertEqual(StorageManager.currentData.syncSettings.dirty, true, '未送信の印は残る');
        assertEqual(cloud.requests.length, 1, '強制保存を送らない');
        assertEqual(CloudSync.conflictPending, false, '次の変更で、もう一度尋ねられる状態に戻る');
    } finally {
        UI.choose = originalChoose;
        cloud.restore();
    }
});

test('CloudSync.loadFromCloud: 選ばずに閉じたときは「同期済み」にならず、何も変えない', async () => {
    const cloud = mockCloud({ appData: { students: [{ id: 'cloud' }] }, updatedAt: '2026-05-02T00:00:00.000Z' });
    const originalChoose = UI.choose;
    UI.choose = async () => null;
    CloudSync.lastSyncAt = null;
    try {
        StorageManager.currentData.students = [{ id: 'local' }];
        StorageManager.currentData.syncSettings = { lastSyncAt: '2026-05-01T00:00:00.000Z', dirty: true };
        await CloudSync.loadFromCloud();

        assertEqual(StorageManager.currentData.students, [{ id: 'local' }]);
        assertEqual(StorageManager.currentData.syncSettings.lastSyncAt, '2026-05-01T00:00:00.000Z', '同期した版を進めない');
        assertEqual(CloudSync.lastSyncAt, null, '「同期済み」の時刻も進めない');
    } finally {
        UI.choose = originalChoose;
        cloud.restore();
    }
});

test('CloudSync.saveToCloud: 未同期の変更が無ければ送らない', async () => {
    const cloud = mockCloud({});
    try {
        StorageManager.currentData.syncSettings = { lastSyncAt: '2026-05-01T00:00:00.000Z', dirty: false };
        await CloudSync.saveToCloud();
        assertEqual(cloud.requests.length, 0, '何も送られないこと');
    } finally {
        cloud.restore();
    }
});

test('CloudSync: 他の端末が先に保存していたら、クラウドを読み込む選択でこの端末の内容は退避される', async () => {
    const cloud = mockCloud({ appData: { students: [{ id: 'cloud' }] }, updatedAt: '2026-05-02T00:00:00.000Z' });
    const originalChoose = UI.choose;
    let asked = 0;
    UI.choose = async () => { asked++; return 'cloud'; };
    try {
        StorageManager.currentData.students = [{ id: 'local' }];
        StorageManager.currentData.syncSettings = { lastSyncAt: '2026-05-01T00:00:00.000Z', dirty: true };
        await CloudSync.saveToCloud();

        assertEqual(asked, 1, '確認が出ること');
        assertEqual(cloud.appData.students, [{ id: 'cloud' }], '勝手にクラウドを上書きしないこと');
        assertEqual(StorageManager.currentData.students, [{ id: 'cloud' }], 'クラウドの内容が反映されること');
        assertEqual(StorageManager.backups[0].data.students, [{ id: 'local' }], 'この端末の内容が自動バックアップに残ること');
        assertEqual(StorageManager.currentData.syncSettings.dirty, false, '取り込んだ直後は未同期ではないこと');
    } finally {
        UI.choose = originalChoose;
        cloud.restore();
    }
});

test('CloudSync: 競合でこの端末を残す選択をしたら、強制保存でクラウドを上書きする', async () => {
    const cloud = mockCloud({ appData: { students: [{ id: 'cloud' }] }, updatedAt: '2026-05-02T00:00:00.000Z' });
    const originalChoose = UI.choose;
    UI.choose = async () => 'local';
    try {
        StorageManager.currentData.students = [{ id: 'local' }];
        StorageManager.currentData.syncSettings = { lastSyncAt: '2026-05-01T00:00:00.000Z', dirty: true };
        await CloudSync.saveToCloud();

        assertEqual(cloud.requests.map(r => !!r.force), [false, true], '1回目は通常、2回目は強制');
        assertEqual(cloud.appData.students, [{ id: 'local' }], 'この端末の内容で上書きされること');
        assertEqual(CloudSync.conflictPending, false, '競合の確認待ちが解除されること');
    } finally {
        UI.choose = originalChoose;
        cloud.restore();
    }
});

test('CloudSync.loadFromCloud: 未送信の変更が無ければ、確認なしでクラウドの新しい内容を取り込む', async () => {
    const cloud = mockCloud({ appData: { students: [{ id: 'cloud' }] }, updatedAt: '2026-05-02T00:00:00.000Z' });
    const originalChoose = UI.choose;
    let asked = 0;
    UI.choose = async () => { asked++; return 'cloud'; };
    try {
        StorageManager.currentData.students = [{ id: 'local' }];
        StorageManager.currentData.syncSettings = { lastSyncAt: '2026-05-01T00:00:00.000Z', dirty: false };
        await CloudSync.loadFromCloud();

        assertEqual(asked, 0, '確認は出ないこと');
        assertEqual(StorageManager.currentData.students, [{ id: 'cloud' }]);
        assertEqual(StorageManager.currentData.syncSettings.lastSyncAt, '2026-05-02T00:00:00.000Z');
    } finally {
        UI.choose = originalChoose;
        cloud.restore();
    }
});

test('CloudSync.loadFromCloud: 未送信の変更がある端末では、黙ってクラウドで上書きせず確認する', async () => {
    const cloud = mockCloud({ appData: { students: [{ id: 'cloud' }] }, updatedAt: '2026-05-02T00:00:00.000Z' });
    const originalChoose = UI.choose;
    let asked = 0;
    UI.choose = async () => { asked++; return 'local'; };
    try {
        StorageManager.currentData.students = [{ id: 'local' }];
        StorageManager.currentData.syncSettings = { lastSyncAt: '2026-05-01T00:00:00.000Z', dirty: true };
        await CloudSync.loadFromCloud();

        assertEqual(asked, 1, '確認が出ること');
        assertEqual(StorageManager.currentData.students, [{ id: 'local' }], 'この端末の内容が残ること');
        assertEqual(StorageManager.currentData.syncSettings.lastSyncAt, '2026-05-02T00:00:00.000Z', '次の保存が競合扱いにならないようクラウドの版を引き継ぐ');
        assertEqual(StorageManager.currentData.syncSettings.dirty, true, '未送信の印は残ること');
    } finally {
        UI.choose = originalChoose;
        cloud.restore();
    }
});

test('CloudSync.loadFromCloud: 初めて接続する端末は、データが空ならクラウドを取り込み、あれば確認する', async () => {
    const originalChoose = UI.choose;
    let asked = 0;
    UI.choose = async () => { asked++; return 'cloud'; };
    const cloud = mockCloud({ appData: { students: [{ id: 'cloud' }] }, updatedAt: '2026-05-02T00:00:00.000Z' });
    try {
        await CloudSync.loadFromCloud();
        assertEqual(asked, 0, '空の端末では確認なし');
        assertEqual(StorageManager.currentData.students, [{ id: 'cloud' }], 'クラウドの内容を取り込む');

        StorageManager._resetInMemory();
        StorageManager.currentData.students = [{ id: 'local' }];
        await CloudSync.loadFromCloud();
        assertEqual(asked, 1, 'データのある端末では確認が出る');
    } finally {
        UI.choose = originalChoose;
        cloud.restore();
    }
});

test('CloudSync.loadFromCloud: クラウドが空で、この端末にデータがあれば送る準備をする', async () => {
    const cloud = mockCloud({});
    try {
        StorageManager.currentData.students = [{ id: 'local' }];
        await CloudSync.loadFromCloud();
        assertEqual(StorageManager.currentData.syncSettings.dirty, true, '未同期として扱われること');
    } finally {
        cloud.restore();
    }
});

test('StorageManager.importData: バックアップファイルの形式を確かめ、読み込む前の状態を退避する', () => {
    StorageManager.currentData.students = [{ id: 'now' }];
    assertTrue(!StorageManager.importData('これはJSONではない'), 'JSONでなければ失敗');
    assertTrue(!StorageManager.importData('[1,2,3]'), '配列は失敗');
    assertEqual(StorageManager.currentData.students, [{ id: 'now' }], '失敗したときはデータを変えない');
    assertEqual(StorageManager.backups.length, 0, '失敗したときはバックアップも増やさない');

    assertTrue(StorageManager.importData(JSON.stringify({ students: [{ id: 'file' }] })), '正しいファイルは成功');
    assertEqual(StorageManager.currentData.students, [{ id: 'file' }]);
    assertEqual(StorageManager.backups[0].data.students, [{ id: 'now' }], '読み込む前の状態が退避される');
});

// ===== UI改善 =====

test('MasterModule.importStudentRows: 見出し・先頭0落ち・ふりがな空に対応し、番号だけの生徒には名前を補う', () => {
    StorageManager.currentData.students = [{ id: 'x', number: '0101', nameKanji: '', nameKana: '' }];
    const result = MasterModule.importStudentRows(parseCsv('番号,名前,ふりがな\n101,山田太郎,やまだ\n0102,佐藤花子,\nabc,誰か,\n0101,別の人,べつ'));

    assertEqual(result.added, 1, '0102が追加される');
    assertEqual(result.filled, 1, '0101は名前が補われる');
    assertEqual(StorageManager.currentData.students.find(s => s.number === '0101').nameKanji, '山田太郎');
    assertEqual(StorageManager.currentData.students.find(s => s.number === '0102').nameKana, '', 'ふりがな空でも取り込める');
    assertEqual(result.skipped.length, 2, '番号でない行と、名前の入った登録済みの行は取り込まない');
});

test('CalendarModule.importCSV: Excelで保存し直した「2026/4/1」形式の日付も読める', () => {
    CalendarModule.events = [];
    CalendarModule.importCSV('日付,行事1,行事2\n2026/4/1,始業式,\n2026-4-2,"入学式, 写真撮影",保護者会\n2026/2/30,ない日,', 'append');

    const titles = CalendarModule.events.map(e => `${e.start} ${e.title}`);
    assertEqual(titles, ['2026-04-01 始業式', '2026-04-02 入学式, 写真撮影', '2026-04-02 保護者会']);
});

test('UI.form: 入力値を返し、必須の未入力や検証エラーでは閉じない／キャンセルでnull', async () => {
    const opened = UI.form({
        title: 'テスト',
        fields: [{ name: 'title', label: '名前', required: true }, { name: 'n', label: '数', type: 'number' }],
        validate: (v) => (v.n > 10 ? '10以下にしてください' : null)
    });
    const dialog = document.querySelector('.ui-dialog');
    const submit = () => dialog.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));

    submit();
    assertTrue(document.body.contains(dialog), '必須が空なら閉じない');
    assertEqual(dialog.querySelector('.ui-dialog-error').textContent, '「名前」を入力してください');

    dialog.querySelector('[name="title"]').value = ' 体育祭 ';
    dialog.querySelector('[name="n"]').value = '20';
    submit();
    assertEqual(dialog.querySelector('.ui-dialog-error').textContent, '10以下にしてください', '検証エラーを表示');

    dialog.querySelector('[name="n"]').value = '3';
    submit();
    assertEqual(await opened, { title: '体育祭', n: 3 }, '前後の空白を除き、数値は数値で返す');
    assertTrue(!document.body.contains(dialog), '確定で閉じる');

    const cancelled = UI.form({ title: 'テスト2', fields: [{ name: 'a', label: 'A' }] });
    document.querySelector('.ui-dialog .ui-cancel-btn').click();
    assertEqual(await cancelled, null, 'キャンセルはnull');
});


test('TestToolsWordGroup.importFromCSV: Excelのタブ区切りを列に分け、語の中の「t」では分けない', () => {
    TestToolsWordGroup.wordGroupRows = [];
    TestToolsWordGroup.importFromCSV('1\tWhat is a cat?\tcat\r\n2\tthe test word\ttest');
    assertEqual(TestToolsWordGroup.wordGroupRows.map(r => [r.no, r.question, r.answer]),
        [[1, 'What is a cat?', 'cat'], [2, 'the test word', 'test']]);

    TestToolsWordGroup.importFromCSV('問題A,答えA\n問題B,答えB');
    assertEqual(TestToolsWordGroup.wordGroupRows.map(r => [r.question, r.answer]), [['問題A', '答えA'], ['問題B', '答えB']], 'カンマ区切りも読める');
});

// ===== 確認ダイアログ（UI.confirm / UI.choose / UI.notice） =====

const openDialog = () => document.querySelector('.ui-choose');

test('UI.confirm: OKで true、キャンセル・✕・外側のクリックで false', async () => {
    let result = UI.realConfirm('削除します', { confirmLabel: '削除する' });
    assertEqual(openDialog().querySelector('.ui-choice-btn').textContent.trim(), '削除する', '確認ボタンに動作が書かれる');
    openDialog().querySelector('.ui-choice-btn').click();
    assertEqual(await result, true, 'OKで true');
    assertTrue(!openDialog(), '閉じる');

    result = UI.realConfirm('削除します');
    openDialog().querySelector('.ui-cancel-btn').click();
    assertEqual(await result, false, 'キャンセルで false');

    result = UI.realConfirm('削除します');
    openDialog().querySelector('.modal-close').click();
    assertEqual(await result, false, '✕で false');

    result = UI.realConfirm('削除します');
    openDialog().dispatchEvent(new MouseEvent('click', { bubbles: true })); // 外側（背景）のクリック
    assertEqual(await result, false, '外側のクリックで false');
});

test('UI.confirm: 危険な操作はキャンセル、そうでなければOKに最初のフォーカスが当たる', async () => {
    let result = UI.realConfirm('削除します', { danger: true });
    assertTrue(document.activeElement.classList.contains('ui-cancel-btn'), 'Enterの押し間違いで実行しない');
    assertTrue(openDialog().querySelector('.ui-choice-btn').classList.contains('btn-danger'), '赤いボタンになる');
    openDialog().querySelector('.ui-cancel-btn').click();
    await result;

    result = UI.realConfirm('並べ替えます');
    assertTrue(document.activeElement.classList.contains('ui-choice-btn'), '通常はOKにフォーカス');
    openDialog().querySelector('.ui-choice-btn').click();
    await result;
});

test('UI.choose: 選んだ値を返し、閉じたときは null（どちらも選んだことにならない）', async () => {
    const options = {
        title: '選択',
        message: '<b>どちらにしますか</b>',
        cancelLabel: 'あとで決める',
        choices: [
            { label: 'クラウドを使う', value: 'cloud', description: '端末の内容は退避します' },
            { label: '端末を使う', value: 'local', danger: true }
        ]
    };
    let result = UI.choose(options);
    assertTrue(!openDialog().querySelector('.ui-confirm-message').innerHTML.includes('<b>'), 'メッセージはエスケープされる');
    assertEqual(openDialog().querySelector('.ui-cancel-btn').textContent, 'あとで決める');
    openDialog().querySelectorAll('.ui-choice-btn')[1].click();
    assertEqual(await result, 'local', '選んだ値');

    result = UI.choose(options);
    openDialog().querySelector('.modal-close').click();
    assertEqual(await result, null, '閉じたら null');
});

test('UI.notice: 閉じるボタンだけで、閉じたら解決する', async () => {
    const closed = UI.notice('結果の一覧', { title: '結果' });
    assertTrue(!openDialog().querySelector('.ui-cancel-btn'), 'キャンセルボタンは無い');
    openDialog().querySelector('.ui-choice-btn').click();
    await closed;
    assertTrue(!openDialog(), '閉じる');
});

test('ブラウザ標準の confirm/alert/prompt はテスト中に呼べない（呼ぶと失敗する）', () => {
    let message = '';
    try { window.confirm('x'); } catch (e) { message = e.message; }
    assertTrue(message.includes('UI.confirm'), '代わりに使うものを案内する');
});

test('CloudSync: クラウドの内容を取り込むと、ダッシュボードのToDo一覧も読み直される', async () => {
    // 読み直さないと古い一覧が画面に残り、次の保存でクラウドの内容を古い一覧で上書きしてしまう
    StorageManager.currentData.todos = [{ id: 'old', text: '古いタスク', completed: false, important: false }];
    DashboardModule.loadTodos();
    const cloud = mockCloud({ appData: { todos: [{ id: 'new', text: '新しいタスク', completed: false, important: false }] }, updatedAt: '2026-05-02T00:00:00.000Z' });
    try {
        CloudSync.lastSyncAt = null;
        StorageManager.currentData.syncSettings = { lastSyncAt: '2026-05-01T00:00:00.000Z', dirty: false };
        await CloudSync.loadFromCloud();
        assertEqual(DashboardModule.todos.map(t => t.id), ['new'], '画面側のToDo一覧が新しい内容になる');
    } finally {
        cloud.restore();
    }
});

test('CloudSync: 通信エラーは、確認すべきことが分かる文言で表示される', () => {
    const unauthorized = CloudSync._describeError(new Error('Unauthorized（スクリプト プロパティ API_KEY とアプリの合言葉が一致しません）'));
    assertTrue(unauthorized.includes('合言葉'), '合言葉の不一致と分かる');
    assertTrue(CloudSync._describeError(new TypeError('Failed to fetch')).includes('全員'), '接続できないときはアクセス権を案内する');
    assertTrue(CloudSync._describeError(new SyntaxError('Unexpected token <')).includes('/exec'), 'HTMLが返ったときはURLの確認を案内する');
    assertEqual(CloudSync._describeError(new Error('保存失敗')), '保存失敗', 'その他はそのまま表示する');
});
