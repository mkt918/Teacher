/**
 * TestToolsUtil - テスト問題補助ツール用ユーティリティ群
 */
const TestToolsUtil = {
    labelStyle() {
        return 'display:block; font-size:0.8em; color:#64748b; margin-bottom:3px;';
    },
    inputStyle() {
        return 'width:100%; padding:6px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.9em; box-sizing:border-box; outline:none;';
    },
    esc(str) {
        return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    escapeHtml(str) {
        return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/\n/g,'<br>');
    },
    async copyText(elementId, btnId) {
        const el = document.getElementById(elementId);
        const btn = document.getElementById(btnId);
        if (!el) return;

        const html = el.innerHTML;
        const text = el.innerText;

        try {
            // HTML形式とプレーンテキスト形式の両方をセット（Word対応）
            const blobHtml = new Blob([html], { type: 'text/html' });
            const blobText = new Blob([text], { type: 'text/plain' });
            const data = [new ClipboardItem({
                'text/html': blobHtml,
                'text/plain': blobText
            })];
            await navigator.clipboard.write(data);
            this.showCopyDone(btn);
        } catch (err) {
            console.warn('Clipboard write HTML failed', err);
            // フォールバック: プレーンテキストのみ
            navigator.clipboard.writeText(text).then(() => this.showCopyDone(btn));
        }
    },
    showCopyDone(btn) {
        if (!btn) return;
        const orig = btn.textContent;
        const origBg = btn.style.background;
        btn.textContent = '✅ コピー済み';
        btn.style.background = '#6b7280';
        setTimeout(() => {
            btn.textContent = orig;
            btn.style.background = origBg;
        }, 1800);
    }
};

if (typeof window !== 'undefined') {
    window.TestToolsUtil = TestToolsUtil;
}
