// ============================================
// Teacher App - ES Module Entry Point
// ============================================

import { App } from './app.js';

// 新規のモジュール群はここで一元管理して初期化に渡すことも可能ですが、
// App.js 側で従来通り初期化できるよう、依存モジュールをwindowに一時的にバインドするか、
// App.js自体をESモジュール化して以下を実行します。

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
