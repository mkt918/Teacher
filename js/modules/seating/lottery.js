/**
 * SeatingLottery - くじ引きモード機能
 * seating/index.js から利用される
 */

import { createEmptyGrid, shuffleGrid } from '../../utils/grid.js';

/**
 * トランプスーツ定義
 */
export const SUITS = [
    { id: 'spade', symbol: '♠', color: 'black', label: 'スペード' },
    { id: 'club', symbol: '♣', color: 'black', label: 'クラブ' },
    { id: 'heart', symbol: '♥', color: 'red', label: 'ハート' },
    { id: 'diamond', symbol: '♦', color: 'red', label: 'ダイヤ' }
];

/**
 * カードをシャッフルして配置
 * @param {number} rows - 行数
 * @param {number} cols - 列数
 * @param {Array} lockedCards - ロックされたカード位置
 * @param {Object} existingCards - 既存のカード配置
 */
export function shuffleCards(rows, cols, lockedCards = [], existingCards = {}) {
    const totalSeats = rows * cols;
    const newCards = { ...existingCards };

    // 新しいカードセットを生成
    const availableCards = [];
    let cardNum = 1;

    for (const suit of SUITS) {
        for (let n = 1; n <= Math.ceil(totalSeats / SUITS.length); n++) {
            if (cardNum <= totalSeats) {
                availableCards.push({ suit: suit.id, number: n });
                cardNum++;
            }
        }
    }

    // ロックされていない位置を収集
    const unlockedPositions = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const key = `${r}-${c}`;
            const isLocked = lockedCards.some(lc => lc.row === r && lc.col === c);
            if (!isLocked) {
                unlockedPositions.push({ row: r, col: c, key });
                delete newCards[key]; // ロックされていないカードは再配置対象
            }
        }
    }

    // カードをシャッフル
    for (let i = availableCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableCards[i], availableCards[j]] = [availableCards[j], availableCards[i]];
    }

    // ロックされていない位置に配置
    unlockedPositions.forEach((pos, index) => {
        if (index < availableCards.length) {
            newCards[pos.key] = availableCards[index];
        }
    });

    return newCards;
}

/**
 * カードを入れ替え
 * @param {Object} cards - カード配置オブジェクト
 * @param {number} fromRow - 移動元行
 * @param {number} fromCol - 移動元列
 * @param {number} toRow - 移動先行
 * @param {number} toCol - 移動先列
 */
export function swapCards(cards, fromRow, fromCol, toRow, toCol) {
    const fromKey = `${fromRow}-${fromCol}`;
    const toKey = `${toRow}-${toCol}`;

    const newCards = { ...cards };
    const temp = newCards[fromKey];
    newCards[fromKey] = newCards[toKey];
    newCards[toKey] = temp;

    return newCards;
}

/**
 * くじ引きグリッドのHTMLを生成
 * @param {Object} config - 設定
 */
export function renderLotteryGridHtml(config) {
    const {
        rows,
        cols,
        cards,
        lockedSeats = [],
        lockedCards = [],
        onCardClick,
        onLockClick
    } = config;

    let html = '';

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const key = `${r}-${c}`;
            const card = cards[key];
            const isLocked = lockedSeats.some(s => s.row === r && s.col === c);
            const isCardLocked = lockedCards.some(lc => lc.row === r && lc.col === c);

            let cardContent = '';
            if (card) {
                const suit = SUITS.find(s => s.id === card.suit);
                cardContent = `
                    <div class="card-suit ${suit.color}">${suit.symbol}</div>
                    <div class="card-number ${suit.color}">${card.number}</div>
                `;
            } else {
                cardContent = '<div class="seat-empty">空席</div>';
            }

            html += `
                <div class="seat ${isLocked ? 'locked' : ''} ${isCardLocked ? 'card-locked' : ''}" 
                     data-row="${r}" data-col="${c}">
                    <div class="seat-card" draggable="${!isCardLocked}" 
                         data-row="${r}" data-col="${c}">
                        ${cardContent}
                        <button class="card-lock-btn ${isCardLocked ? 'active' : ''}"
                                data-row="${r}" data-col="${c}">
                            ${isCardLocked ? '🔒' : '🔓'}
                        </button>
                    </div>
                </div>
            `;
        }
    }

    return html;
}

/**
 * くじ引き結果入力モーダルのHTMLを生成
 * @param {Object} config - 設定
 */
export function generateLotteryInputHtml(config) {
    const { rows, cols, cards, students } = config;

    let inputsHtml = '';
    const sortedCards = [];

    // カードをスート・番号順にソート
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const key = `${r}-${c}`;
            const card = cards[key];
            if (card) {
                sortedCards.push({ ...card, row: r, col: c, key });
            }
        }
    }

    sortedCards.sort((a, b) => {
        const suitOrder = { spade: 0, club: 1, heart: 2, diamond: 3 };
        if (suitOrder[a.suit] !== suitOrder[b.suit]) {
            return suitOrder[a.suit] - suitOrder[b.suit];
        }
        return a.number - b.number;
    });

    sortedCards.forEach(card => {
        const suit = SUITS.find(s => s.id === card.suit);
        inputsHtml += `
            <div class="lottery-input-row">
                <span class="lottery-card-label ${suit.color}">
                    ${suit.symbol}${card.number}
                </span>
                <input type="text" class="lottery-input" 
                       data-row="${card.row}" data-col="${card.col}"
                       placeholder="出席番号">
            </div>
        `;
    });

    return inputsHtml;
}

// グローバルに公開（移行期間中の互換性のため）
if (typeof window !== 'undefined') {
    window.SeatingLottery = {
        SUITS,
        shuffleCards,
        swapCards,
        renderLotteryGridHtml,
        generateLotteryInputHtml
    };
}
