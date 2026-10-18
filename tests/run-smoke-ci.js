// ===== CIでスモークテストをヘッドレス実行するためのスクリプト =====
// tests/smoke.html はブラウザで直接開いても動作するが、
// GitHub Actionsで自動判定するためにPlaywrightで開いて結果を読み取る。
// ローカルの開発体験（npm不要でファイルを開くだけ）には影響しない。

const { chromium } = require('playwright');

const TARGET_URL = process.env.SMOKE_TEST_URL || 'http://localhost:8080/tests/smoke.html';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // テストファイル自体に構文エラーなどがあると、テストが1件も登録されないまま
    // 「全件成功」に見えてしまうため、ページ上のエラーは失敗として扱う
    const pageErrors = [];
    page.on('pageerror', (err) => {
        pageErrors.push(err.message);
        console.error('[pageerror]', err.message);
    });

    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    // テスト結果が出るまで待機（最大10秒）
    await page.waitForFunction(
        () => document.body.dataset.smokeStatus !== undefined,
        { timeout: 10000 }
    );

    const results = await page.evaluate(() => window.__SMOKE_RESULTS__);
    const status = await page.evaluate(() => document.body.dataset.smokeStatus);

    await browser.close();

    console.log('');
    results.forEach((r) => {
        console.log(`${r.pass ? '✅' : '❌'} ${r.name}${r.error ? ' — ' + r.error : ''}`);
    });
    console.log('');

    if (results.length === 0) {
        console.error('❌ テストが1件も実行されませんでした（テストファイルの読み込みに失敗した可能性があります）。');
        process.exit(1);
    }
    if (pageErrors.length > 0) {
        console.error('❌ テスト実行中にページでエラーが発生しました。');
        process.exit(1);
    }
    if (status !== 'pass') {
        console.error('❌ スモークテストに失敗しました。');
        process.exit(1);
    }
    console.log('✅ すべてのスモークテストが成功しました。');
})().catch((err) => {
    console.error('テスト実行エラー:', err);
    process.exit(1);
});
