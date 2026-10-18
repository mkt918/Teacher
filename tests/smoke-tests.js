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

test('HistoryModal: 新しい順に表示され、選んだ履歴が正しく復元される（回帰テスト）', () => {
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
        const second = CloudSync.saveToCloud(); // 通信中なのでpendingSyncになるはず
        assertTrue(CloudSync.pendingSync, '通信中の呼び出しはpendingSyncフラグが立つこと');
        await Promise.all([first, second]);
        await new Promise(resolve => setTimeout(resolve, 100)); // pending分の再送を待つ
    } finally {
        window.fetch = originalFetch;
        CloudSync.gasUrl = '';
    }

    assertEqual(callCount, 2, '通信中の変更ぶんとして自動的にもう一度保存されること');
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
