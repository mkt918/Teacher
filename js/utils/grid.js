/**
 * GridUtils - 座席表共通ユーティリティ
 * 席替え、バス座席表、グループ分けなどで共通利用
 */

/**
 * 空のグリッドレイアウトを作成
 * @param {number} rows - 行数
 * @param {number} cols - 列数
 * @param {*} defaultValue - デフォルト値
 */
export function createEmptyGrid(rows, cols, defaultValue = null) {
    const grid = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push(defaultValue);
        }
        grid.push(row);
    }
    return grid;
}

/**
 * グリッドを複製
 * @param {Array<Array>} grid - グリッド
 */
export function cloneGrid(grid) {
    return grid.map(row => [...row]);
}

/**
 * グリッド内の全セルに対してコールバックを実行
 * @param {Array<Array>} grid - グリッド
 * @param {Function} callback - コールバック (value, row, col) => void
 */
export function forEachCell(grid, callback) {
    grid.forEach((row, r) => {
        row.forEach((value, c) => {
            callback(value, r, c);
        });
    });
}

/**
 * グリッド内の全セルをマップ
 * @param {Array<Array>} grid - グリッド
 * @param {Function} mapper - マッパー (value, row, col) => newValue
 */
export function mapGrid(grid, mapper) {
    return grid.map((row, r) =>
        row.map((value, c) => mapper(value, r, c))
    );
}

/**
 * グリッド内の非null値をカウント
 * @param {Array<Array>} grid - グリッド
 */
export function countOccupied(grid) {
    let count = 0;
    forEachCell(grid, (value) => {
        if (value !== null) count++;
    });
    return count;
}

/**
 * グリッドから特定の値を持つセルの位置を取得
 * @param {Array<Array>} grid - グリッド
 * @param {*} value - 検索する値
 */
export function findCellByValue(grid, value) {
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c] === value) {
                return { row: r, col: c };
            }
        }
    }
    return null;
}

/**
 * 番号順に並べる位置リストを生成（教卓側が前）
 * @param {number} rows - 行数
 * @param {number} cols - 列数
 * @param {Array} lockedPositions - ロックされた位置 [{row, col}]
 * @param {string} direction - 'rightToLeft' (右前から) or 'leftToRight' (左前から)
 * @param {boolean} teacherAtBottom - 教卓が下側か
 */
export function getOrderedPositions(rows, cols, lockedPositions = [], direction = 'rightToLeft', teacherAtBottom = true) {
    const positions = [];
    const colStart = direction === 'rightToLeft' ? cols - 1 : 0;
    const colEnd = direction === 'rightToLeft' ? -1 : cols;
    const colStep = direction === 'rightToLeft' ? -1 : 1;

    const rowStart = teacherAtBottom ? rows - 1 : 0;
    const rowEnd = teacherAtBottom ? -1 : rows;
    const rowStep = teacherAtBottom ? -1 : 1;

    for (let c = colStart; c !== colEnd; c += colStep) {
        for (let r = rowStart; r !== rowEnd; r += rowStep) {
            const isLocked = lockedPositions.some(pos => pos.row === r && pos.col === c);
            if (!isLocked) {
                positions.push({ row: r, col: c });
            }
        }
    }

    return positions;
}

/**
 * グリッドをシャッフル（ロックされた位置を除外）
 * @param {Array<Array>} grid - グリッド
 * @param {Array} lockedPositions - ロックされた位置 [{row, col}]
 */
export function shuffleGrid(grid, lockedPositions = []) {
    const newGrid = cloneGrid(grid);
    const unlockiedValues = [];
    const unlockedPositions = [];

    // ロックされていないセルの値と位置を収集
    forEachCell(grid, (value, r, c) => {
        const isLocked = lockedPositions.some(pos => pos.row === r && pos.col === c);
        if (!isLocked && value !== null) {
            unlockiedValues.push(value);
            unlockedPositions.push({ row: r, col: c });
        }
    });

    // シャッフル
    for (let i = unlockiedValues.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [unlockiedValues[i], unlockiedValues[j]] = [unlockiedValues[j], unlockiedValues[i]];
    }

    // 再配置
    unlockedPositions.forEach((pos, index) => {
        newGrid[pos.row][pos.col] = index < unlockiedValues.length ? unlockiedValues[index] : null;
    });

    return newGrid;
}

// グローバルに公開（移行期間中の互換性のため）
window.GridUtils = {
    createEmptyGrid,
    cloneGrid,
    forEachCell,
    mapGrid,
    countOccupied,
    findCellByValue,
    getOrderedPositions,
    shuffleGrid
};
