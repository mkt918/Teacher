/**
 * GroupsModule - グループ分けツール
 * 
 * 機能:
 * - 修学旅行、遠足等のグループ編成
 * - 複数のグループセット管理（班、部屋割りなど）
 * - 条件付きグループ分け（男女別、人数均等など）
 * - グループごとの色分け
 * - 印刷機能
 */

const GroupsModule = {
    name: 'GroupsModule',
    initialized: false,

    // グループセット（班、部屋割りなど複数管理）
    groupSets: [],
    currentSetIndex: 0,

    /**
     * 初期化
     */
    init() {
        if (this.initialized) return;
        this.setupEventListeners();
        this.initialized = true;
        console.log('👥 GroupsModule initialized');
    },

    /**
     * イベントリスナーのセットアップ
     */
    setupEventListeners() {
        this._setupButton('addGroupSetBtn', () => this.addGroupSet());
        this._setupButton('addGroupBtn', () => this.addGroup());
        this._setupButton('autoGroupBtn', () => this.autoGroup());
        this._setupButton('sortGroupsBtn', () => this.sortGroupsByNumber());
        this._setupButton('printGroupsBtn', () => this.printGroups());
        this._setupButton('groupsHistoryBtn', () => this.showHistory());
        this._setupButton('saveGroupsHistoryBtn', () => this.saveToHistory());
    },

    _setupButton(id, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', callback);
    },

    /**
     * 描画
     */
    render() {
        this.loadGroupSets(); // データ読み込みを必ず実行
        this.renderGroupSetTabs();
        this.renderGroups();
        this.renderUnassignedStudents();
    },

    /**
     * グループセットタブを描画
     */
    renderGroupSetTabs() {
        const container = document.getElementById('groupSetTabs');
        if (!container) return;

        container.innerHTML = this.groupSets.map((set, index) => `
            <button class="group-set-tab ${index === this.currentSetIndex ? 'active' : ''}"
                    data-index="${index}">
                ${escapeHtml(set.name)}
            </button>
        `).join('');

        // タブクリックイベント
        container.querySelectorAll('.group-set-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.currentSetIndex = parseInt(tab.dataset.index);
                this.render();
            });
        });
    },

    /**
     * グループを描画
     */
    renderGroups() {
        const container = document.getElementById('groupsContainer');
        if (!container) return;

        const currentSet = this.groupSets[this.currentSetIndex];
        if (!currentSet) {
            container.innerHTML = '<p>グループセットを作成してください</p>';
            return;
        }

        container.innerHTML = currentSet.groups.map((group, index) => `
            <div class="group-card" style="border-color: ${group.color}">
                <div class="group-header" style="background-color: ${group.color}">
                    <span class="group-name">${escapeHtml(group.name)}</span>
                    <span class="group-count">${group.members.length}名</span>
                </div>
                <div class="group-members" data-group-index="${index}">
                    ${this._renderGroupMembers(group.members)}
                </div>
            </div>
        `).join('');
    },

    /**
     * グループメンバーのHTMLを生成
     */
    _renderGroupMembers(memberIds) {
        const data = window.StorageManager?.getCurrentData() || {};
        const students = data.students || [];

        return memberIds.map(id => {
            const student = students.find(s => s.id === id);
            if (!student) return '';
            return `
                <div class="group-member" draggable="true" data-student-id="${id}">
                    <span class="member-number">${escapeHtml(student.number)}</span>
                    <span class="member-name">${escapeHtml(student.nameKanji)}</span>
                </div>
            `;
        }).join('');
    },

    /**
     * 未配置生徒リストを描画
     */
    renderUnassignedStudents() {
        const container = document.getElementById('groupsUnassigned');
        if (!container) return;

        const data = window.StorageManager?.getCurrentData() || {};
        const students = data.students || [];
        const currentSet = this.groupSets[this.currentSetIndex];

        // 現在のセットに配置済みの生徒ID
        const assignedIds = new Set();
        if (currentSet) {
            currentSet.groups.forEach(g => {
                g.members.forEach(id => assignedIds.add(id));
            });
        }

        const unassigned = students.filter(s => !assignedIds.has(s.id));

        if (unassigned.length === 0) {
            container.innerHTML = '<div class="empty-state-small"><p>全員配置済み</p></div>';
            return;
        }

        container.innerHTML = unassigned.map(student => `
            <div class="unassigned-student" draggable="true" data-student-id="${student.id}">
                <div class="student-number">${escapeHtml(student.number)}</div>
                <div class="student-name">${escapeHtml(student.nameKanji)}</div>
            </div>
        `).join('');

        this._setupDragEvents();
    },

    draggedStudent: null,

    /**
     * ドラッグイベントのセットアップ
     */
    _setupDragEvents() {
        // 未配置エリア
        const unassignedContainer = document.getElementById('groupsUnassigned');
        if (unassignedContainer) {
            unassignedContainer.querySelectorAll('.unassigned-student').forEach(el => {
                el.addEventListener('dragstart', (e) => {
                    this.draggedStudent = { id: el.dataset.studentId, fromGroup: null };
                    e.dataTransfer.effectAllowed = 'move';
                    el.classList.add('dragging');
                });
                el.addEventListener('dragend', () => el.classList.remove('dragging'));
            });

            // 未配置エリアへのドロップ
            unassignedContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                unassignedContainer.classList.add('drag-over');
            });
            unassignedContainer.addEventListener('dragleave', () => unassignedContainer.classList.remove('drag-over'));
            unassignedContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                unassignedContainer.classList.remove('drag-over');
                this._onDropToUnassigned();
            });
        }

        // グループメンバー
        const groupsContainer = document.getElementById('groupsContainer');
        if (groupsContainer) {
            groupsContainer.querySelectorAll('.group-member').forEach(el => {
                el.addEventListener('dragstart', (e) => {
                    const membersList = el.closest('.group-members');
                    this.draggedStudent = {
                        id: el.dataset.studentId,
                        fromGroup: parseInt(membersList.dataset.groupIndex)
                    };
                    e.dataTransfer.effectAllowed = 'move';
                    el.classList.add('dragging');
                });
                el.addEventListener('dragend', () => el.classList.remove('dragging'));
            });

            // グループへのドロップ
            groupsContainer.querySelectorAll('.group-members').forEach(members => {
                members.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    members.classList.add('drag-over');
                });
                members.addEventListener('dragleave', () => members.classList.remove('drag-over'));
                members.addEventListener('drop', (e) => {
                    e.preventDefault();
                    members.classList.remove('drag-over');
                    this._onDropToGroup(parseInt(members.dataset.groupIndex));
                });
            });
        }
    },

    _onDropToUnassigned() {
        if (!this.draggedStudent) return;

        const { id, fromGroup } = this.draggedStudent;
        if (fromGroup !== null) {
            const currentSet = this.groupSets[this.currentSetIndex];
            const group = currentSet.groups[fromGroup];
            group.members = group.members.filter(m => m !== id);
            this.saveGroupSets();
            this.render();
        }
        this.draggedStudent = null;
    },

    _onDropToGroup(toGroupIndex) {
        if (!this.draggedStudent) return;

        const { id, fromGroup } = this.draggedStudent;
        const currentSet = this.groupSets[this.currentSetIndex];

        // 元のグループから削除
        if (fromGroup !== null) {
            currentSet.groups[fromGroup].members = currentSet.groups[fromGroup].members.filter(m => m !== id);
        }

        // 新しいグループに追加
        if (!currentSet.groups[toGroupIndex].members.includes(id)) {
            currentSet.groups[toGroupIndex].members.push(id);
        }

        this.saveGroupSets();
        this.render();
        this.draggedStudent = null;
    },

    /**
     * グループセットを追加
     */
    addGroupSet() {
        const name = prompt('グループセット名を入力してください（例：班、部屋割り）');
        if (!name) return;

        this.groupSets.push({
            name,
            groups: []
        });
        this.currentSetIndex = this.groupSets.length - 1;
        this.saveGroupSets();
        this.render();
    },

    /**
     * グループを追加
     */
    addGroup() {
        const currentSet = this.groupSets[this.currentSetIndex];
        if (!currentSet) {
            alert('先にグループセットを作成してください');
            return;
        }

        const name = prompt('グループ名を入力してください', `${currentSet.groups.length + 1}班`);
        if (!name) return;

        const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
        const color = colors[currentSet.groups.length % colors.length];

        currentSet.groups.push({
            name,
            color,
            members: []
        });
        this.saveGroupSets();
        this.render();
    },

    /**
     * 自動グループ分け
     */
    autoGroup() {
        const currentSet = this.groupSets[this.currentSetIndex];
        if (!currentSet || currentSet.groups.length === 0) {
            alert('先にグループを作成してください');
            return;
        }

        const numGroups = currentSet.groups.length;
        const data = window.StorageManager?.getCurrentData() || {};
        const students = [...(data.students || [])];

        // シャッフル
        for (let i = students.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [students[i], students[j]] = [students[j], students[i]];
        }

        // グループに均等配分
        currentSet.groups.forEach(g => g.members = []);
        students.forEach((student, index) => {
            const groupIndex = index % numGroups;
            currentSet.groups[groupIndex].members.push(student.id);
        });

        this.saveGroupSets();
        this.render();
    },

    /**
     * 班内を番号順に並び替え
     */
    sortGroupsByNumber() {
        const currentSet = this.groupSets[this.currentSetIndex];
        if (!currentSet || currentSet.groups.length === 0) {
            alert('グループがありません');
            return;
        }

        const data = window.StorageManager?.getCurrentData() || {};
        const students = data.students || [];

        // 生徒データマップ作成（ID -> 生徒オブジェクト）
        const studentMap = new Map(students.map(s => [s.id, s]));

        let updated = false;

        currentSet.groups.forEach(group => {
            if (group.members.length > 1) {
                // 番号順にソート（比較関数）
                group.members.sort((aId, bId) => {
                    const studentA = studentMap.get(aId);
                    const studentB = studentMap.get(bId);
                    if (!studentA || !studentB) return 0;

                    const numA = parseInt(studentA.number) || 0;
                    const numB = parseInt(studentB.number) || 0;
                    return numA - numB;
                });
                updated = true;
            }
        });

        if (updated) {
            this.saveGroupSets();
            this.render();
        } else {
            alert('並び替える必要がありません');
        }
    },

    /**
     * グループ表を印刷
     */
    printGroups() {
        const currentSet = this.groupSets[this.currentSetIndex];
        if (!currentSet) {
            alert('グループセットを選択してください');
            return;
        }

        const data = window.StorageManager?.getCurrentData() || {};
        const students = data.students || [];

        let groupsHtml = '<div class="print-groups">';
        currentSet.groups.forEach(group => {
            groupsHtml += `
                <div class="print-group">
                    <div class="print-group-header" style="background-color: ${group.color}; color: white; padding: 8px;">
                        ${escapeHtml(group.name)}（${group.members.length}名）
                    </div>
                    <div class="print-group-members">
            `;
            group.members.forEach(id => {
                const student = students.find(s => s.id === id);
                if (student) {
                    groupsHtml += `<div class="print-member">${escapeHtml(student.number)} ${escapeHtml(student.nameKanji)}</div>`;
                }
            });
            groupsHtml += '</div></div>';
        });
        groupsHtml += '</div>';

        const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>${escapeHtml(currentSet.name)}</title>
        <style>
            body { font-family: sans-serif; padding: 20px; }
            h1 { text-align: center; }
            .print-groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
            .print-group { border: 1px solid #333; }
            .print-group-header { font-weight: bold; }
            .print-group-members { padding: 10px; }
            .print-member { padding: 3px 0; border-bottom: 1px solid #eee; }
        </style></head><body>
        <h1>${escapeHtml(currentSet.name)}</h1>
        <p style="text-align:center">${new Date().toLocaleDateString('ja-JP')}</p>
        ${groupsHtml}
        </body></html>`;

        const win = safeWindowOpen('', '', 'width=800,height=600');
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); }, 500);
    },

    /**
     * 履歴に保存
     */
    saveToHistory() {
        const name = prompt('この状態に名前を付けてください');
        if (!name) return;

        const data = window.StorageManager?.getCurrentData() || {};
        if (!data.groups) data.groups = {};
        if (!data.groups.history) data.groups.history = [];

        data.groups.history.unshift({
            name,
            timestamp: new Date().toISOString(),
            groupSets: JSON.parse(JSON.stringify(this.groupSets))
        });

        data.groups.history = data.groups.history.slice(0, 10);
        window.StorageManager?.updateCurrentData(data);
        alert('履歴に保存しました');
    },

    /**
     * 履歴を表示
     */
    showHistory() {
        const data = window.StorageManager?.getCurrentData() || {};
        const history = data.groups?.history || [];

        if (history.length === 0) {
            alert('履歴がありません');
            return;
        }

        let msg = '履歴一覧:\n';
        history.forEach((item, i) => {
            const date = new Date(item.timestamp).toLocaleString('ja-JP');
            msg += `${i + 1}. ${item.name} (${date})\n`;
        });
        msg += '\n読み込む番号を入力してください（キャンセルは空欄）:';

        const input = prompt(msg);
        if (!input) return;

        const idx = parseInt(input) - 1;
        if (idx >= 0 && idx < history.length) {
            if (confirm(`「${history[idx].name}」を読み込みますか？`)) {
                this.groupSets = JSON.parse(JSON.stringify(history[idx].groupSets));
                this.currentSetIndex = 0;
                this.saveGroupSets();
                this.render();
            }
        } else {
            alert('無効な番号です');
        }
    },

    /**
     * グループセットを保存
     */
    saveGroupSets() {
        const data = window.StorageManager?.getCurrentData() || {};
        data.groups = { groupSets: this.groupSets };
        window.StorageManager?.updateCurrentData(data);
    },

    /**
     * グループセットを読み込み（データがなければデフォルト作成）
     */
    loadGroupSets() {
        const data = window.StorageManager?.getCurrentData() || {};
        this.groupSets = data.groups?.groupSets || [];

        // データがない場合はデフォルトセットを作成
        if (this.groupSets.length === 0) {
            this.groupSets = [{
                name: '班分け',
                groups: [
                    { name: '1班', members: [], color: '#3b82f6' },
                    { name: '2班', members: [], color: '#10b981' },
                    { name: '3班', members: [], color: '#f59e0b' },
                    { name: '4班', members: [], color: '#ef4444' }
                ]
            }];
            this.saveGroupSets();
        }
    }
};

// グローバルに公開
if (typeof window !== 'undefined') {
    window.GroupsModule = GroupsModule;
}
