/**
 * クラウド同期（GAS/Google Sheets）連携モジュール
 * LocalStorageのデータを定期的にバックグラウンドでGASへ送信・取得します。
 */

const SyncManager = {
    // ユーザーに後で設定してもらうためのプレースホルダー
    // （または StorageManager 経由で取得する）
    getGasEndpoint() {
        const data = window.StorageManager ? window.StorageManager.getCurrentData() : null;
        return data?.appSettings?.gasEndpointUrl || '';
    },

    /**
     * バックグラウンドでGASへテストデータを送信する
     */
    async pushData(dataKeyword, payload) {
        const url = this.getGasEndpoint();
        if (!url) return false; // エンドポイントが未設定の場合は同期しない

        try {
            const formData = new URLSearchParams();
            formData.append('action', 'save');
            formData.append('key', dataKeyword);
            formData.append('payload', JSON.stringify(payload));
            formData.append('timestamp', new Date().toISOString());

            // 送信（CORS対策としてno-corsを使うか、GAS側で対応する前提）
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString()
            });
            return true;
        } catch (error) {
            console.error('GAS同期エラー (push):', error);
            return false;
        }
    },

    /**
     * バックグラウンドでGASからデータを取得する
     */
    async pullData(dataKeyword) {
        const url = this.getGasEndpoint();
        if (!url) return null;

        try {
            const query = new URLSearchParams({ action: 'load', key: dataKeyword }).toString();
            const res = await fetch(`${url}?${query}`);
            const data = await res.json();
            return data;
        } catch (error) {
            console.error('GAS同期エラー (pull):', error);
            return null;
        }
    }
};

if (typeof window !== 'undefined') {
    window.CoreSync = { SyncManager };
}
