// ===== 席替えツールモジュール (履歴管理) =====

Object.assign(SeatingModule, {

    openSaveHistoryModal() {
        window.HistoryModal.open({
            modalId: 'seatingHistoryModal',
            title: '席配置の保存・読取',
            getHistory: () => this._getNormalizedHistory(),
            setHistory: (history) => {
                const data = StorageManager.getCurrentData();
                data.seating.history = history;
                StorageManager.updateCurrentData(data);
            },
            getSnapshot: () => ({
                layout: this.currentLayout,
                lotterySettings: this.lotterySettings,
                // 行数・列数も保存しないと、保存後に行数を変えてから復元した際に
                // グリッドの表示サイズと座席データのサイズが食い違う
                rows: this.rows,
                cols: this.cols
            }),
            applySnapshot: (snapshot) => {
                const data = StorageManager.getCurrentData();
                if (snapshot.lotterySettings) this.lotterySettings = snapshot.lotterySettings;
                // 古い履歴で行列数が未保存の場合は、実際のlayoutの寸法から復元する
                this.rows = snapshot.rows || snapshot.layout.length || this.rows;
                this.cols = snapshot.cols || (snapshot.layout[0] ? snapshot.layout[0].length : this.cols);
                data.seating.current = snapshot.layout;
                StorageManager.updateCurrentData(data);
                this.currentLayout = data.seating.current;
                this.render();
            }
        });
    },

    // 旧形式（{date, title, layout, ...} を古い順にpush）の履歴を、
    // 共通のHistoryModal形式（{name, data} を新しい順）へ変換して返す
    _getNormalizedHistory() {
        const data = StorageManager.getCurrentData();
        let history = data.seating.history || [];
        const isLegacy = (item) => item.data === undefined && item.layout !== undefined;

        if (history.some(isLegacy)) {
            const allLegacy = history.every(isLegacy);
            const converted = history.map(item => isLegacy(item) ? {
                name: item.title || '(無題)',
                date: item.date,
                data: {
                    layout: item.layout,
                    lotterySettings: item.lotterySettings,
                    rows: item.rows,
                    cols: item.cols
                }
            } : item);
            history = allLegacy ? converted.reverse() : converted;
            data.seating.history = history;
        }
        return history;
    }
});
