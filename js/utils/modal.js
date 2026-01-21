/**
 * ModalManager - モーダル管理ユーティリティ
 */

/**
 * モーダルを開く
 * @param {string} modalId - モーダルのID
 */
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * モーダルを閉じる
 * @param {string} modalId - モーダルのID
 */
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * モーダル外クリックで閉じる設定
 * @param {string} modalId - モーダルのID
 */
export function setupModalCloseOnOutsideClick(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }
}

/**
 * 全モーダルに外クリッククローズを設定
 */
export function setupAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

// グローバルに公開（移行期間中の互換性のため）
window.ModalUtils = { openModal, closeModal, setupModalCloseOnOutsideClick, setupAllModals };
