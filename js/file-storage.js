/**
 * FileStorageDB - IndexedDBを使用したファイルストレージ
 * 
 * ファイルのバイナリデータ（Blob）をブラウザ内に永続保存する
 */

const FileStorageDB = {
    DB_NAME: 'TeacherAppFileStorage',
    DB_VERSION: 1,
    STORE_NAME: 'files',
    db: null,

    /**
     * データベースを初期化
     */
    init() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }

            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                console.error('❌ FileStorageDB: 初期化に失敗', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ FileStorageDB: 初期化完了');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
                    console.log('📁 FileStorageDB: ストア作成完了');
                }
            };
        });
    },

    /**
     * ファイルを保存
     * @param {string} id - ファイルID
     * @param {Blob|File} blob - ファイルデータ
     * @param {string} mimeType - MIMEタイプ
     */
    async saveFile(id, blob, mimeType) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);

            const data = {
                id: id,
                blob: blob,
                mimeType: mimeType || blob.type,
                savedAt: new Date().toISOString()
            };

            const request = store.put(data);

            request.onsuccess = () => {
                console.log(`📁 FileStorageDB: ファイル保存完了 (${id})`);
                resolve(true);
            };

            request.onerror = () => {
                console.error('❌ FileStorageDB: ファイル保存に失敗', request.error);
                reject(request.error);
            };
        });
    },

    /**
     * ファイルを取得
     * @param {string} id - ファイルID
     * @returns {Promise<{blob: Blob, mimeType: string} | null>}
     */
    async getFile(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                if (request.result) {
                    resolve({
                        blob: request.result.blob,
                        mimeType: request.result.mimeType
                    });
                } else {
                    resolve(null);
                }
            };

            request.onerror = () => {
                console.error('❌ FileStorageDB: ファイル取得に失敗', request.error);
                reject(request.error);
            };
        });
    },

    /**
     * ファイルをBlobURLとして取得
     * @param {string} id - ファイルID
     * @returns {Promise<string | null>} Blob URL
     */
    async getFileAsURL(id) {
        const fileData = await this.getFile(id);
        if (fileData && fileData.blob) {
            return URL.createObjectURL(fileData.blob);
        }
        return null;
    },

    /**
     * ファイルを削除
     * @param {string} id - ファイルID
     */
    async deleteFile(id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                console.log(`🗑️ FileStorageDB: ファイル削除完了 (${id})`);
                resolve(true);
            };

            request.onerror = () => {
                console.error('❌ FileStorageDB: ファイル削除に失敗', request.error);
                reject(request.error);
            };
        });
    },

    /**
     * 全ファイルを取得（デバッグ用）
     */
    async getAllFiles() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }
};

// グローバルに公開
if (typeof window !== 'undefined') {
    window.FileStorageDB = FileStorageDB;
}
