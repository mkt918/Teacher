/**
 * ManualModule - マニュアル・業務ガイドツール
 * 
 * 機能:
 * - 業務別マニュアルの表示
 * - 関連ファイルへのリンク
 * - ステップバイステップガイド
 * - チェックリスト機能
 */

const ManualModule = {
    name: 'ManualModule',
    initialized: false,

    // マニュアル定義
    manuals: [
        {
            id: 'new_term',
            title: '新学期の準備',
            category: '学期始め',
            icon: '🌸',
            steps: [
                { title: '生徒名簿の作成', description: '新しいクラスの生徒情報を登録します', link: '#master', done: false },
                { title: '座席表の作成', description: '初期の座席配置を決めます', link: '#seating', done: false },
                { title: '係・当番の決定', description: 'クラス係を決めて登録します', link: '#duties', done: false },
                { title: '保護者会の日程調整', description: '個人面談の日程を決めます', link: '#meeting', done: false }
            ],
            relatedFiles: ['学級編成表', '座席表テンプレート']
        },
        {
            id: 'field_trip',
            title: '遠足・修学旅行の準備',
            category: '行事',
            icon: '🚌',
            steps: [
                { title: 'グループ分け', description: '班やグループを編成します', link: '#groups', done: false },
                { title: 'バス座席表の作成', description: 'バスの座席配置を決めます', link: '#bus', done: false },
                { title: '持ち物リストの作成', description: '必要な持ち物をリストアップします', done: false },
                { title: '緊急連絡先の確認', description: '保護者連絡先を確認します', done: false }
            ],
            relatedFiles: ['しおりテンプレート', '健康調査票']
        },
        {
            id: 'parent_meeting',
            title: '保護者会の準備',
            category: '保護者対応',
            icon: '👨‍👩‍👧',
            steps: [
                { title: '日程の設定', description: '面談期間と時間枠を設定します', link: '#meeting', done: false },
                { title: '希望調査の配布・回収', description: '保護者の希望日時を集めます', done: false },
                { title: 'スケジュール調整', description: '全員の日程を調整します', link: '#meeting', done: false },
                { title: '面談資料の準備', description: '各生徒の資料を準備します', done: false }
            ],
            relatedFiles: ['面談希望調査票', '面談記録用紙']
        }
    ],

    currentManual: null,

    /**
     * 初期化
     */
    init() {
        if (this.initialized) return;
        this.setupEventListeners();
        this.loadProgress();
        this.initialized = true;
        console.log('📖 ManualModule initialized');
    },

    /**
     * イベントリスナーのセットアップ
     */
    setupEventListeners() {
        this._setupButton('addManualBtn', () => this.addManual());
    },

    _setupButton(id, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', callback);
    },

    /**
     * 描画
     */
    render() {
        if (this.currentManual) {
            this.renderManualDetail();
        } else {
            this.renderManualList();
        }
    },

    /**
     * マニュアル一覧を描画
     */
    renderManualList() {
        const container = document.getElementById('manualContent');
        if (!container) return;

        // カテゴリでグループ化
        const categories = {};
        this.manuals.forEach(manual => {
            if (!categories[manual.category]) categories[manual.category] = [];
            categories[manual.category].push(manual);
        });

        let html = '';
        for (const [category, manualsInCategory] of Object.entries(categories)) {
            html += `<h3 class="manual-category-title">${category}</h3>`;
            html += '<div class="manual-list">';

            manualsInCategory.forEach(manual => {
                const progress = this.getProgress(manual.id);
                html += `
                    <div class="manual-card" data-manual-id="${manual.id}">
                        <div class="manual-icon">${manual.icon}</div>
                        <div class="manual-info">
                            <div class="manual-title">${escapeHtml(manual.title)}</div>
                            <div class="manual-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${progress}%"></div>
                                </div>
                                <span class="progress-text">${progress}%</span>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
        }

        container.innerHTML = html;

        // カードクリックイベント
        container.querySelectorAll('.manual-card').forEach(card => {
            card.addEventListener('click', () => {
                this.currentManual = card.dataset.manualId;
                this.render();
            });
        });
    },

    /**
     * マニュアル詳細を描画
     */
    renderManualDetail() {
        const container = document.getElementById('manualContent');
        if (!container) return;

        const manual = this.manuals.find(m => m.id === this.currentManual);
        if (!manual) return;

        let html = `
            <button class="back-btn" id="backToManualList">← 一覧に戻る</button>
            <div class="manual-detail">
                <div class="manual-header">
                    <span class="manual-icon-large">${manual.icon}</span>
                    <h2>${manual.title}</h2>
                </div>
                <div class="manual-steps">
                    <h3>手順</h3>
        `;

        manual.steps.forEach((step, index) => {
            const stepState = this.getStepState(manual.id, index);
            html += `
                <div class="manual-step ${stepState ? 'done' : ''}" data-step-index="${index}">
                    <div class="step-checkbox">
                        <input type="checkbox" ${stepState ? 'checked' : ''} data-manual-id="${manual.id}" data-step="${index}">
                    </div>
                    <div class="step-content">
                        <div class="step-number">Step ${index + 1}</div>
                        <div class="step-title">${escapeHtml(step.title)}</div>
                        <div class="step-description">${escapeHtml(step.description)}</div>
                        ${step.link ? `<a href="${escapeHtml(step.link)}" class="step-link">→ ツールを開く</a>` : ''}
                    </div>
                </div>
            `;
        });

        html += '</div>';

        // 関連ファイル
        if (manual.relatedFiles && manual.relatedFiles.length > 0) {
            html += '<div class="related-files"><h3>関連ファイル</h3><ul>';
            manual.relatedFiles.forEach(file => {
                html += `<li><a href="#">📄 ${escapeHtml(file)}</a></li>`;
            });
            html += '</ul></div>';
        }

        html += '</div>';
        container.innerHTML = html;

        // 戻るボタン
        document.getElementById('backToManualList')?.addEventListener('click', () => {
            this.currentManual = null;
            this.render();
        });

        // チェックボックス
        container.querySelectorAll('.step-checkbox input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const manualId = e.target.dataset.manualId;
                const stepIndex = parseInt(e.target.dataset.step);
                this.setStepState(manualId, stepIndex, e.target.checked);
            });
        });
    },

    /**
     * 進捗率を取得
     */
    getProgress(manualId) {
        const manual = this.manuals.find(m => m.id === manualId);
        if (!manual) return 0;

        const data = window.StorageManager?.getCurrentData() || {};
        const progress = data.manual?.progress?.[manualId] || {};

        const doneCount = manual.steps.filter((_, i) => progress[i]).length;
        return Math.round((doneCount / manual.steps.length) * 100);
    },

    /**
     * ステップの状態を取得
     */
    getStepState(manualId, stepIndex) {
        const data = window.StorageManager?.getCurrentData() || {};
        return data.manual?.progress?.[manualId]?.[stepIndex] || false;
    },

    /**
     * ステップの状態を設定
     */
    setStepState(manualId, stepIndex, done) {
        const data = window.StorageManager?.getCurrentData() || {};
        if (!data.manual) data.manual = {};
        if (!data.manual.progress) data.manual.progress = {};
        if (!data.manual.progress[manualId]) data.manual.progress[manualId] = {};

        data.manual.progress[manualId][stepIndex] = done;
        window.StorageManager?.updateCurrentData(data);
        this.render();
    },

    /**
     * マニュアルを追加
     */
    addManual() {
        const title = prompt('マニュアルのタイトルを入力してください');
        if (!title) return;

        const category = prompt('カテゴリを入力してください（例: 学期始め, 行事, 保護者対応）', '独自');
        if (!category) return;

        const newManual = {
            id: 'custom_' + Date.now(),
            title: title,
            category: category,
            icon: '📝',
            steps: [],
            relatedFiles: [],
            isCustom: true
        };

        this.manuals.push(newManual);
        this.saveCustomManuals();
        this.currentManual = newManual.id;
        this.render();
    },

    /**
     * マニュアルを編集
     */
    editManual(manualId) {
        const manual = this.manuals.find(m => m.id === manualId);
        if (!manual || !manual.isCustom) {
            alert('このマニュアルは編集できません');
            return;
        }

        const newTitle = prompt('タイトルを編集', manual.title);
        if (newTitle) {
            manual.title = newTitle;
            this.saveCustomManuals();
            this.render();
        }
    },

    /**
     * マニュアルを削除
     */
    deleteManual(manualId) {
        const manual = this.manuals.find(m => m.id === manualId);
        if (!manual || !manual.isCustom) {
            alert('このマニュアルは削除できません');
            return;
        }

        if (!confirm(`「${manual.title}」を削除しますか？`)) return;

        this.manuals = this.manuals.filter(m => m.id !== manualId);
        this.saveCustomManuals();
        this.currentManual = null;
        this.render();
    },

    /**
     * ステップを追加
     */
    addStep(manualId) {
        const manual = this.manuals.find(m => m.id === manualId);
        if (!manual) return;

        const title = prompt('ステップのタイトルを入力');
        if (!title) return;

        const description = prompt('説明を入力（省略可）', '');

        manual.steps.push({
            title: title,
            description: description || '',
            link: null,
            done: false
        });

        this.saveCustomManuals();
        this.render();
    },

    /**
     * ファイルをマニュアルにリンク
     */
    linkFile(manualId) {
        const manual = this.manuals.find(m => m.id === manualId);
        if (!manual) return;

        // ファイル管理から登録済みファイルを取得
        const data = window.StorageManager?.getCurrentData() || {};
        const files = data.files?.list || [];

        if (files.length === 0) {
            alert('ファイル管理に登録されたファイルがありません。\n先にファイル管理でファイルを登録してください。');
            return;
        }

        let msg = '添付するファイルを選択してください:\n';
        files.forEach((file, i) => {
            msg += `${i + 1}. ${file.name}\n`;
        });

        const input = prompt(msg);
        if (!input) return;

        const idx = parseInt(input) - 1;
        if (idx >= 0 && idx < files.length) {
            if (!manual.relatedFiles) manual.relatedFiles = [];
            const fileName = files[idx].name;
            if (!manual.relatedFiles.includes(fileName)) {
                manual.relatedFiles.push(fileName);
                this.saveCustomManuals();
                this.render();
                alert(`「${fileName}」をリンクしました`);
            } else {
                alert('既にリンク済みです');
            }
        } else {
            alert('無効な番号です');
        }
    },

    /**
     * カスタムマニュアルを保存
     */
    saveCustomManuals() {
        const data = window.StorageManager?.getCurrentData() || {};
        if (!data.manual) data.manual = {};
        data.manual.customManuals = this.manuals.filter(m => m.isCustom);
        window.StorageManager?.updateCurrentData(data);
    },

    /**
     * カスタムマニュアルを読み込み
     */
    loadCustomManuals() {
        const data = window.StorageManager?.getCurrentData() || {};
        const customManuals = data.manual?.customManuals || [];
        // デフォルトマニュアルにカスタムマニュアルを追加
        customManuals.forEach(cm => {
            if (!this.manuals.find(m => m.id === cm.id)) {
                this.manuals.push(cm);
            }
        });
    },

    /**
     * 進捗を読み込み
     */
    loadProgress() {
        this.loadCustomManuals();
    },

    /**
     * マニュアル詳細を描画（編集機能付き）
     */
    renderManualDetail() {
        const container = document.getElementById('manualContent');
        if (!container) return;

        const manual = this.manuals.find(m => m.id === this.currentManual);
        if (!manual) return;

        let html = `
            <button class="back-btn" id="backToManualList">← 一覧に戻る</button>
            <div class="manual-detail">
                <div class="manual-header">
                    <span class="manual-icon-large">${manual.icon}</span>
                    <h2>${escapeHtml(manual.title)}</h2>
                    ${manual.isCustom ? `
                        <div class="manual-actions">
                            <button class="btn btn-sm" id="editManualBtn">✏️ 編集</button>
                            <button class="btn btn-sm btn-danger" id="deleteManualBtn">🗑️ 削除</button>
                        </div>
                    ` : ''}
                </div>
                <div class="manual-steps">
                    <h3>手順 ${manual.isCustom ? `<button class="btn btn-sm" id="addStepBtn">+ ステップ追加</button>` : ''}</h3>
        `;

        manual.steps.forEach((step, index) => {
            const stepState = this.getStepState(manual.id, index);
            html += `
                <div class="manual-step ${stepState ? 'done' : ''}" data-step-index="${index}">
                    <div class="step-checkbox">
                        <input type="checkbox" ${stepState ? 'checked' : ''} data-manual-id="${manual.id}" data-step="${index}">
                    </div>
                    <div class="step-content">
                        <div class="step-number">Step ${index + 1}</div>
                        <div class="step-title">${escapeHtml(step.title)}</div>
                        <div class="step-description">${escapeHtml(step.description)}</div>
                        ${step.link ? `<a href="${escapeHtml(step.link)}" class="step-link">→ ツールを開く</a>` : ''}
                    </div>
                </div>
            `;
        });

        html += '</div>';

        // 関連ファイル
        html += `<div class="related-files">
            <h3>関連ファイル ${manual.isCustom ? `<button class="btn btn-sm" id="linkFileBtn">+ ファイル追加</button>` : ''}</h3>`;
        if (manual.relatedFiles && manual.relatedFiles.length > 0) {
            html += '<ul>';
            manual.relatedFiles.forEach((fileName, idx) => {
                html += `<li><a href="#" class="related-file-link" data-file-name="${escapeHtml(fileName)}" data-idx="${idx}">📄 ${escapeHtml(fileName)}</a></li>`;
            });
            html += '</ul>';
        } else {
            html += '<p class="empty-hint">関連ファイルがありません</p>';
        }
        html += '</div>';

        html += '</div>';
        container.innerHTML = html;

        // イベントリスナー
        document.getElementById('backToManualList')?.addEventListener('click', () => {
            this.currentManual = null;
            this.render();
        });

        document.getElementById('editManualBtn')?.addEventListener('click', () => {
            this.editManual(manual.id);
        });

        document.getElementById('deleteManualBtn')?.addEventListener('click', () => {
            this.deleteManual(manual.id);
        });

        document.getElementById('addStepBtn')?.addEventListener('click', () => {
            this.addStep(manual.id);
        });

        document.getElementById('linkFileBtn')?.addEventListener('click', () => {
            this.linkFile(manual.id);
        });

        // チェックボックス
        container.querySelectorAll('.step-checkbox input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const manualId = e.target.dataset.manualId;
                const stepIndex = parseInt(e.target.dataset.step);
                this.setStepState(manualId, stepIndex, e.target.checked);
            });
        });

        // 関連ファイルリンク
        container.querySelectorAll('.related-file-link').forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                const fileName = link.dataset.fileName;
                await this.openRelatedFile(fileName);
            });
        });
    },

    /**
     * 関連ファイルを開く
     */
    async openRelatedFile(fileName) {
        // FilesModuleからファイル情報を取得
        const data = window.StorageManager?.getCurrentData() || {};
        const files = data.files?.list || [];
        const file = files.find(f => f.name === fileName);

        if (!file) {
            alert(`ファイル「${fileName}」が見つかりません。\nファイル管理で登録してください。`);
            return;
        }

        if (!file.storedInDB) {
            alert('このファイルはブラウザに保存されていません。');
            return;
        }

        // IndexedDBからファイルを取得して開く
        try {
            const blobUrl = await window.FileStorageDB.getFileAsURL(file.id);
            if (blobUrl) {
                safeWindowOpen(blobUrl, '_blank');
                // 少し遅らせてURLを解放
                setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
            } else {
                alert('ファイルデータを取得できませんでした。');
            }
        } catch (err) {
            console.error('ファイル取得エラー:', err);
            alert('ファイルを開く際にエラーが発生しました。');
        }
    }
};

// グローバルに公開
if (typeof window !== 'undefined') {
    window.ManualModule = ManualModule;
}

