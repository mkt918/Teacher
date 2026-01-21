/**
 * DragDropManager - ドラッグ＆ドロップ共通ユーティリティ
 */

/**
 * 要素をドラッグ可能にする
 * @param {HTMLElement} element - 対象要素
 * @param {Function} getDataFn - ドラッグデータを返す関数
 * @param {Object} options - オプション
 */
export function makeDraggable(element, getDataFn, options = {}) {
    const {
        dragClass = 'dragging',
        effectAllowed = 'move',
        onStart = null,
        onEnd = null
    } = options;

    element.draggable = true;

    element.addEventListener('dragstart', (e) => {
        const data = getDataFn(element);
        e.dataTransfer.effectAllowed = effectAllowed;
        e.dataTransfer.setData('application/json', JSON.stringify(data));
        element.classList.add(dragClass);
        if (onStart) onStart(e, data, element);
    });

    element.addEventListener('dragend', (e) => {
        element.classList.remove(dragClass);
        if (onEnd) onEnd(e, element);
    });
}

/**
 * 要素をドロップターゲットにする
 * @param {HTMLElement} element - 対象要素
 * @param {Function} onDropFn - ドロップ時のコールバック
 * @param {Object} options - オプション
 */
export function makeDropTarget(element, onDropFn, options = {}) {
    const {
        dropClass = 'drag-over',
        dropEffect = 'move',
        canDrop = () => true
    } = options;

    element.addEventListener('dragover', (e) => {
        if (canDrop(e)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = dropEffect;
            element.classList.add(dropClass);
        }
    });

    element.addEventListener('dragleave', (e) => {
        // 子要素への移動を無視
        if (!element.contains(e.relatedTarget)) {
            element.classList.remove(dropClass);
        }
    });

    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove(dropClass);
        try {
            const jsonData = e.dataTransfer.getData('application/json');
            const data = jsonData ? JSON.parse(jsonData) : null;
            onDropFn(e, data, element);
        } catch (error) {
            console.error('DragDrop: Failed to parse drop data', error);
            onDropFn(e, null, element);
        }
    });
}

// グローバルに公開（移行期間中の互換性のため）
window.DragDropUtils = { makeDraggable, makeDropTarget };
