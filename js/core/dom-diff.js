/**
 * 軽量 DOM 更新ユーティリティ
 * 単純な `innerHTML` 上書きによるフォーカス（キャレット位置）消失を防ぐため、
 * 更新前に現在アクティブな要素の状態を記憶し、更新後に復元します。
 */

function updateDOMWithState(container, newHTML) {
    if (!container) return;

    // 1. アクティブな要素の状態を記憶
    const activeEl = document.activeElement;
    let focusState = null;

    if (activeEl && container.contains(activeEl)) {
        // IDや独自データ属性（data-qidなど）で特定
        const identifier = activeEl.id || activeEl.dataset.id || activeEl.name;
        
        if (identifier) {
            focusState = {
                id: activeEl.id,
                name: activeEl.name,
                tagName: activeEl.tagName,
                selectionStart: activeEl.selectionStart || 0,
                selectionEnd: activeEl.selectionEnd || 0,
                datasetId: activeEl.dataset.id
            };
        }
    }

    // 2. DOMの更新
    // ※本格的な仮想DOMではなく簡易上書きを使用（速度優先）
    container.innerHTML = newHTML;

    // 3. アクティブ要素の復元
    if (focusState) {
        let targetReFocus = null;

        // IDで検索
        if (focusState.id) {
            targetReFocus = container.querySelector(`#${focusState.id}`);
        } 
        // IDが無い場合はnameかdataset.idで検索
        else if (focusState.tagName && (focusState.name || focusState.datasetId)) {
            const sels = [];
            if (focusState.name) sels.push(`[name="${focusState.name}"]`);
            if (focusState.datasetId) sels.push(`[data-id="${focusState.datasetId}"]`);
            if (sels.length > 0) {
                 targetReFocus = container.querySelector(`${focusState.tagName}${sels.join('')}`);
            }
        }

        // フォーカス復旧
        if (targetReFocus) {
            targetReFocus.focus();
            try {
                // テキスト入力関連の要素ならキャレット位置も復旧
                if (targetReFocus.setSelectionRange) {
                    targetReFocus.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
                }
            } catch (e) {
                // Number input など setSelectionRange に対応していない要素のエラーを握り潰す
            }
        }
    }
}

if (typeof window !== 'undefined') {
    window.CoreDOM = { updateDOMWithState };
}
