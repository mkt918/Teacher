/**
 * Event Bus - モジュール間通信のためのイベントシステム
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * イベントをリッスン
     * @param {string} event - イベント名
     * @param {Function} callback - コールバック関数
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * イベントリスナーを解除
     * @param {string} event - イベント名
     * @param {Function} callback - コールバック関数
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    /**
     * イベントを発火
     * @param {string} event - イベント名
     * @param {*} data - イベントデータ
     */
    emit(event, data) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`EventBus: Error in listener for "${event}"`, error);
            }
        });
    }
}

// シングルトンインスタンス
export const eventBus = new EventBus();

// グローバルに公開（移行期間中の互換性のため）
window.eventBus = eventBus;
