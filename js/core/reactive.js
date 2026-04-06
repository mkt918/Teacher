/**
 * 簡易的なリアクティブ（状態監視）システム
 * Proxy を用いてオブジェクトの変更を検知し、指定されたコールバックを自動で発火させます。
 * デバウンス処理を含み、短期間の連続する変更でもコールバックは1回のみ呼ばれます。
 */

function createReactiveState(initialState, callback) {
    let updateScheduled = false;

    // 非同期で（次のレンダリングサイクルで）1回だけコールバックを呼ぶ
    function scheduleUpdate() {
        if (!callback || updateScheduled) return;
        updateScheduled = true;
        
        // 連続更新をまとめるため setTimeout (あるいは requestAnimationFrame) を使用
        setTimeout(() => {
            callback();
            updateScheduled = false;
        }, 5);
    }

    const handler = {
        get(target, key, receiver) {
            const value = Reflect.get(target, key, receiver);
            // オブジェクトや配列なら深く（ディープに）Proxy化する
            if (typeof value === 'object' && value !== null) {
                return new Proxy(value, handler);
            }
            return value;
        },
        set(target, key, value, receiver) {
            const oldValue = Reflect.get(target, key, receiver);
            const result = Reflect.set(target, key, value, receiver);
            if (oldValue !== value) {
                scheduleUpdate();
            }
            return result;
        },
        deleteProperty(target, key) {
            const result = Reflect.deleteProperty(target, key);
            scheduleUpdate();
            return result;
        }
    };

    return new Proxy(initialState, handler);
}

if (typeof window !== 'undefined') {
    window.CoreReactivity = { createReactiveState };
}
