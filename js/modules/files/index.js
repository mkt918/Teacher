/**
 * FilesModule - ファイル管理ツール
 * 
 * 機能:
 * - Word/Excel/PDFなどのファイルをカテゴリ別に管理
 * - ファイルのアップロード・ダウンロード
 * - ファイル検索
 * - 業務カテゴリとの紐付け
 */

const FilesModule = {
    name: 'FilesModule',
    initialized: false,

    // ファイル一覧
    files: [],

    // カテゴリ定義
    categories: [
        { id: 'homeroom', name: '学級経営', icon: '🏫' },
        { id: 'grade', name: '成績関連', icon: '📝' },
        { id: 'event', name: '行事関連', icon: '🎉' },
        { id: 'meeting', name: '保護者会', icon: '👨‍👩‍👧' },
        { id: 'guidance', name: '生徒指導', icon: '📋' },
        { id: 'other', name: 'その他', icon: '📁' }
    ],

    currentCategory: null,

    /**
     * 初期化
     */
    init() {
        if (this.initialized) return;
        this.setupEventListeners();
        this.loadFiles();
        this.initialized = true;
        console.log('📁 FilesModule initialized');
    },

    /**
     * イベントリスナーのセットアップ
     */
    setupEventListeners() {
        this._setupButton('uploadFileBtn', () => this.openUploadDialog());
        this._setupButton('searchFilesBtn', () => this.searchFiles());

        // ファイル入力
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // D&Dイベントは render() 後に設定
    },

    /**
     * D&Dイベントのセットアップ
     */
    _setupDragDropEvents() {
        const fileList = document.getElementById('fileList');
        if (!fileList) return;

        // ドロップゾーンをファイルリストエリアに設定
        fileList.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileList.classList.add('drag-over');
        });

        fileList.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileList.classList.remove('drag-over');
        });

        fileList.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileList.classList.remove('drag-over');
            this._handleDrop(e);
        });
    },

    /**
     * ドロップ処理
     */
    async _handleDrop(e) {
        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        let savedCount = 0;
        for (const file of Array.from(files)) {
            const extension = file.name.split('.').pop().toLowerCase();
            const fileId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

            // IndexedDBにファイル本体を保存
            try {
                await window.FileStorageDB.saveFile(fileId, file, file.type);

                this.files.push({
                    id: fileId,
                    name: file.name,
                    type: extension,
                    size: file.size,
                    mimeType: file.type,
                    category: this.currentCategory || 'other',
                    uploadDate: new Date().toLocaleDateString('ja-JP'),
                    storedInDB: true  // IndexedDBに保存済みフラグ
                });
                savedCount++;
            } catch (err) {
                console.error('ファイル保存エラー:', err);
            }
        }

        this.saveFiles();
        this.render();
        if (savedCount > 0) {
            alert(`${savedCount}件のファイルをブラウザに保存しました。`);
        }
    },

    _setupButton(id, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', callback);
    },

    /**
     * 描画
     */
    render() {
        this.renderCategories();
        this.renderFileList();
        this._setupDragDropEvents(); // D&Dイベントを描画後に設定
    },

    /**
     * カテゴリ一覧を描画
     */
    renderCategories() {
        const container = document.getElementById('fileCategories');
        if (!container) return;

        container.innerHTML = this.categories.map(cat => `
            <button class="category-btn ${this.currentCategory === cat.id ? 'active' : ''}"
                    data-category="${cat.id}">
                <span class="category-icon">${cat.icon}</span>
                <span class="category-name">${escapeHtml(cat.name)}</span>
                <span class="category-count">${this.getFileCountByCategory(cat.id)}</span>
            </button>
        `).join('');

        container.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentCategory = this.currentCategory === btn.dataset.category
                    ? null
                    : btn.dataset.category;
                this.render();
            });
        });
    },

    /**
     * ファイル一覧を描画（Googleドライブ風カード表示）
     */
    renderFileList() {
        const container = document.getElementById('fileList');
        if (!container) return;

        let filteredFiles = this.files;
        if (this.currentCategory) {
            filteredFiles = this.files.filter(f => f.category === this.currentCategory);
        }

        if (filteredFiles.length === 0) {
            container.innerHTML = `
                <div class="file-drop-zone">
                    <div class="drop-zone-content">
                        <div class="drop-icon">📂</div>
                        <p>ファイルをここにドロップ</p>
                        <p class="drop-hint">または「ファイル登録」ボタンをクリック</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="file-cards-grid">
                ${filteredFiles.map(file => `
                    <div class="file-card-drive" data-file-id="${file.id}">
                        <div class="file-card-icon">${this.getFileIcon(file.type)}</div>
                        <div class="file-card-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                        <div class="file-card-meta">
                            <span class="file-type">${escapeHtml(file.type.toUpperCase())}</span>
                            <span class="file-size">${this.formatFileSize(file.size)}</span>
                        </div>
                        <div class="file-card-category">
                            ${this.categories.find(c => c.id === file.category)?.icon || '📁'}
                            ${escapeHtml(this.categories.find(c => c.id === file.category)?.name || '未分類')}
                        </div>
                        <div class="file-card-actions">
                            <button class="btn-preview" data-file-id="${file.id}" title="プレビュー">👁️</button>
                            <button class="btn-edit-category" data-file-id="${file.id}" title="カテゴリ変更">📂</button>
                            <button class="btn-delete" data-file-id="${file.id}" title="削除">🗑️</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="file-drop-hint">ファイルをここにドロップで追加</div>
        `;

        // ファイル操作イベント
        container.querySelectorAll('.btn-preview').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showPreview(btn.dataset.fileId);
            });
        });

        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._deleteFile(btn.dataset.fileId);
            });
        });

        container.querySelectorAll('.btn-edit-category').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._editCategory(btn.dataset.fileId);
            });
        });
    },

    /**
     * ファイルを削除
     */
    async _deleteFile(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (!file) return;

        if (!confirm(`「${file.name}」を削除しますか？`)) return;

        // IndexedDBからも削除
        if (file.storedInDB) {
            try {
                await window.FileStorageDB.deleteFile(fileId);
            } catch (err) {
                console.error('IndexedDB削除エラー:', err);
            }
        }

        this.files = this.files.filter(f => f.id !== fileId);
        this.saveFiles();
        this.render();
    },

    /**
     * カテゴリを変更
     */
    _editCategory(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (!file) return;

        let msg = `「${file.name}」のカテゴリを選択:\n`;
        this.categories.forEach((cat, i) => {
            msg += `${i + 1}. ${cat.name}\n`;
        });

        const input = prompt(msg);
        if (!input) return;

        const idx = parseInt(input) - 1;
        if (idx >= 0 && idx < this.categories.length) {
            file.category = this.categories[idx].id;
            this.saveFiles();
            this.render();
        } else {
            alert('無効な番号です');
        }
    },

    /**
     * カテゴリ別ファイル数を取得
     */
    getFileCountByCategory(categoryId) {
        return this.files.filter(f => f.category === categoryId).length;
    },

    /**
     * ファイルアイコンを取得
     */
    getFileIcon(type) {
        const icons = {
            'pdf': '📄',
            'doc': '📝',
            'docx': '📝',
            'xls': '📊',
            'xlsx': '📊',
            'ppt': '📽️',
            'pptx': '📽️',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'png': '🖼️',
            'gif': '🖼️'
        };
        return icons[type] || '📎';
    },

    /**
     * ファイルプレビュー表示
     */
    async showPreview(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (!file) return;

        const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        const previewableTypes = ['pdf', ...imageTypes];

        let previewHtml = '';
        let blobUrl = null;

        // IndexedDBからファイルを取得
        if (file.storedInDB) {
            try {
                blobUrl = await window.FileStorageDB.getFileAsURL(fileId);
            } catch (err) {
                console.error('ファイル取得エラー:', err);
            }
        }

        if (blobUrl) {
            if (imageTypes.includes(file.type)) {
                previewHtml = `<img src="${blobUrl}" alt="${escapeHtml(file.name)}" style="max-width: 100%; max-height: 400px;">`;
            } else if (file.type === 'pdf') {
                previewHtml = `<p>PDFファイルを開く</p><a href="${blobUrl}" target="_blank" class="btn btn-primary">PDFを開く</a>`;
            } else {
                // その他のファイルはダウンロードリンク
                previewHtml = `<p>このファイル形式はプレビューに対応していません</p>
                    <a href="${blobUrl}" download="${escapeHtml(file.name)}" class="btn btn-primary">ダウンロード</a>`;
            }
        } else {
            previewHtml = `<p>ファイルデータが見つかりません</p>`;
        }

        const modal = document.createElement('div');
        modal.className = 'file-preview-modal';
        modal.innerHTML = `
            <div class="file-preview-overlay"></div>
            <div class="file-preview-content">
                <div class="file-preview-header">
                    <h3>${escapeHtml(file.name)}</h3>
                    <button class="file-preview-close">&times;</button>
                </div>
                <div class="file-preview-body">
                    ${previewHtml}
                </div>
                <div class="file-preview-info">
                    <span>種類: ${escapeHtml(file.type.toUpperCase())}</span>
                    <span>サイズ: ${this.formatFileSize(file.size)}</span>
                    <span>登録日: ${escapeHtml(file.uploadDate)}</span>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 閉じるイベント（BlobURLの解放も行う）
        const closeModal = () => {
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            modal.remove();
        };
        modal.querySelector('.file-preview-close').addEventListener('click', closeModal);
        modal.querySelector('.file-preview-overlay').addEventListener('click', closeModal);
    },

    /**
     * ファイルサイズをフォーマット
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    /**
     * アップロードダイアログを開く
     */
    openUploadDialog() {
        document.getElementById('fileInput')?.click();
    },

    /**
     * ファイルアップロード処理
     */
    async handleFileUpload(e) {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        let savedCount = 0;
        for (const file of Array.from(files)) {
            const extension = file.name.split('.').pop().toLowerCase();
            const fileId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

            // IndexedDBにファイル本体を保存
            try {
                await window.FileStorageDB.saveFile(fileId, file, file.type);

                this.files.push({
                    id: fileId,
                    name: file.name,
                    type: extension,
                    size: file.size,
                    mimeType: file.type,
                    category: this.currentCategory || 'other',
                    uploadDate: new Date().toLocaleDateString('ja-JP'),
                    storedInDB: true
                });
                savedCount++;
            } catch (err) {
                console.error('ファイル保存エラー:', err);
            }
        }

        this.saveFiles();
        this.render();

        // 入力をリセット
        e.target.value = '';

        if (savedCount > 0) {
            alert(`${savedCount}件のファイルをブラウザに保存しました。`);
        }
    },

    /**
     * ファイル検索
     */
    searchFiles() {
        const query = prompt('検索キーワードを入力してください');
        if (!query) return;

        const results = this.files.filter(f =>
            f.name.toLowerCase().includes(query.toLowerCase())
        );

        alert(`${results.length}件のファイルが見つかりました`);
    },

    /**
     * ファイル一覧を保存
     */
    saveFiles() {
        const data = window.StorageManager?.getCurrentData() || {};
        data.files = { list: this.files };
        window.StorageManager?.updateCurrentData(data);
    },

    /**
     * ファイル一覧を読み込み
     */
    loadFiles() {
        const data = window.StorageManager?.getCurrentData() || {};
        this.files = data.files?.list || [];
    }
};

// グローバルに公開
if (typeof window !== 'undefined') {
    window.FilesModule = FilesModule;
}
