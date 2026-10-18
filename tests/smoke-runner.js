// ===== 最小限のブラウザテストランナー（npm不要・依存なし） =====
// tests/smoke.html から読み込んで使う。ビルドツールを導入せず、
// ブラウザでファイルを開くだけで結果が見えることを重視した設計。

// 確認ダイアログは画面を待たせるので、テストでは自動で「OK」と答えるスタブに差し替える
// （個別のテストで、キャンセルした場合などに上書きして使う）。
UI.realConfirm = UI.confirm; // ダイアログ自体のテスト用に本物を残す
UI.confirm = async () => true;

// ブラウザ標準の confirm()/alert()/prompt() は使わない決まり。うっかり使われたら、
// 画面が止まるのではなくテストが失敗するようにしておく。
['confirm', 'alert', 'prompt'].forEach(name => {
    window[name] = () => {
        throw new Error(`${name}() は使わず、UI.confirm / UI.notice / UI.toast / UI.form を使ってください`);
    };
});

const SmokeTests = [];

function test(name, fn) {
    SmokeTests.push({ name, fn });
}

function assertEqual(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        throw new Error(`${msg ? msg + ': ' : ''}期待値 ${e} に対し実際は ${a}`);
    }
}

function assertTrue(cond, msg) {
    if (!cond) throw new Error(msg || 'assertion failed');
}

// 各テスト前にアプリの状態をクリーンな状態にリセットする
function resetAppState() {
    localStorage.removeItem(StorageManager.STORAGE_KEY);
    StorageManager._resetInMemory();
}

async function runSmokeTests() {
    const results = [];
    for (const t of SmokeTests) {
        window.__currentTest = t.name; // 止まったとき、どのテストか分かるように
        resetAppState();
        try {
            await t.fn();
            results.push({ name: t.name, pass: true });
        } catch (e) {
            results.push({ name: t.name, pass: false, error: e.message });
        }
    }

    // 後片付け（作成した一時DOM等が残っていれば削除）
    document.querySelectorAll('[id^="smoke"]').forEach(el => el.remove());

    window.__SMOKE_RESULTS__ = results;
    renderResults(results);
    return results;
}

function renderResults(results) {
    const out = document.getElementById('results');
    if (!out) return;

    const passCount = results.filter(r => r.pass).length;
    // テストが1件も無いのは、テストファイルの読み込みに失敗したときなので失敗扱いにする
    const failCount = results.length === 0 ? 1 : results.length - passCount;

    let html = `<h2>${failCount === 0 ? '✅' : '❌'} ${passCount} / ${results.length} 件成功</h2>`;
    html += '<ul>';
    results.forEach(r => {
        html += `<li style="color:${r.pass ? 'green' : 'red'}">${r.pass ? '✅' : '❌'} ${r.name}${r.error ? ` — ${r.error}` : ''}</li>`;
    });
    html += '</ul>';
    out.innerHTML = html;

    // Playwright等のヘッドレス実行から機械的に判定できるよう、bodyに結果を明示する
    document.body.dataset.smokeStatus = failCount === 0 ? 'pass' : 'fail';
}
