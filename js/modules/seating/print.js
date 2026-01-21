/**
 * SeatingPrint - 席替えの印刷機能
 * seating/index.js から利用される
 */

import { generatePrintHtml, openPrintWindow } from '../../utils/print.js';

/**
 * 通常モードの座席表印刷HTMLを生成
 * @param {Object} config - 設定
 */
export function generateSeatingPrintHtml(config) {
    const {
        rows,
        cols,
        layout,
        students,
        title = '座席表',
        zoom = 0.9
    } = config;

    let gridHtml = '<div class="seating-grid">';

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const studentId = layout[r]?.[c];
            let content = '<div class="seat-empty">空席</div>';

            if (studentId) {
                const student = students.find(s => s.id === studentId);
                if (student) {
                    content = `
                        <div class="seat-number">${student.number}</div>
                        <div class="seat-name">${student.nameKanji}</div>
                    `;
                }
            }

            gridHtml += `<div class="seat">${content}</div>`;
        }
    }

    gridHtml += '</div>';
    gridHtml += '<div class="teacher-desk">教卓</div>';

    const additionalStyles = `
        .seating-grid {
            display: grid;
            grid-template-columns: repeat(${cols}, 1fr);
            gap: 8px;
            max-width: 270mm;
            margin: 0 auto;
            zoom: ${zoom};
        }
        .seat {
            border: 2px solid #333;
            padding: 10px;
            min-height: 60px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            background: white;
        }
        .seat-number {
            font-size: 0.9em;
            color: #666;
        }
        .seat-name {
            font-size: 1.1em;
            font-weight: bold;
        }
        .seat-empty {
            color: #999;
            font-size: 0.9em;
        }
        .teacher-desk {
            margin-top: 20px;
            padding: 15px;
            background: #333;
            color: white;
            text-align: center;
            font-weight: bold;
            border-radius: 5px;
        }
    `;

    return generatePrintHtml({
        title,
        content: gridHtml,
        orientation: 'landscape',
        additionalStyles
    });
}

/**
 * くじ引きモードの印刷HTMLを生成
 * @param {Object} config - 設定
 */
export function generateLotteryPrintHtml(config) {
    const {
        rows,
        cols,
        cards,
        suits,
        title = 'くじ引き席替え',
        zoom = 0.9
    } = config;

    // 座席表部分（カード情報付き）
    let seatGridHtml = '<div class="lottery-seats">';
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const key = `${r}-${c}`;
            const card = cards[key];
            let cardContent = '';

            if (card) {
                const suit = suits.find(s => s.id === card.suit);
                cardContent = `
                    <div class="card-info ${suit.color}">
                        <span class="card-suit">${suit.symbol}</span>
                        <span class="card-num">${card.number}</span>
                    </div>
                `;
            }

            seatGridHtml += `
                <div class="lottery-seat">
                    ${cardContent}
                    <div class="result-line"></div>
                </div>
            `;
        }
    }
    seatGridHtml += '</div>';
    seatGridHtml += '<div class="teacher-desk">教卓</div>';

    // 注意事項
    const instructionHtml = `
        <div class="lottery-instruction">
            <p>※ 各自のカードに対応する席に座ってください</p>
        </div>
    `;

    // 結果記入表
    let resultHtml = '<div class="result-area"><h3>結果記入欄</h3><div class="result-grid">';
    const sortedCards = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const key = `${r}-${c}`;
            const card = cards[key];
            if (card) {
                sortedCards.push({ ...card, row: r, col: c });
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
        const suit = suits.find(s => s.id === card.suit);
        resultHtml += `
            <div class="result-item">
                <span class="${suit.color}">${suit.symbol}${card.number}</span>
                <span class="result-blank">____</span>
            </div>
        `;
    });
    resultHtml += '</div></div>';

    const additionalStyles = `
        .lottery-seats {
            display: grid;
            grid-template-columns: repeat(${cols}, 1fr);
            gap: 5px;
            max-width: 250mm;
            margin: 0 auto 15px;
            zoom: ${zoom};
        }
        .lottery-seat {
            border: 2px solid #333;
            padding: 8px;
            min-height: 50px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
        }
        .card-info {
            font-size: 1.2em;
            font-weight: bold;
        }
        .card-info.red { color: #dc2626; }
        .card-info.black { color: #000; }
        .result-line {
            width: 100%;
            border-bottom: 1px dashed #999;
            margin-top: 5px;
        }
        .teacher-desk {
            margin: 15px auto;
            padding: 10px;
            background: #333;
            color: white;
            text-align: center;
            max-width: 200px;
            border-radius: 5px;
        }
        .lottery-instruction {
            margin: 15px 0;
            padding: 10px;
            background: #fffbeb;
            border: 1px solid #f59e0b;
            border-radius: 5px;
            text-align: center;
        }
        .result-area {
            margin-top: 20px;
            padding: 15px;
            border: 1px solid #ddd;
        }
        .result-area h3 {
            margin: 0 0 10px 0;
            font-size: 1.1em;
        }
        .result-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        .result-item {
            display: flex;
            gap: 5px;
            min-width: 80px;
        }
        .result-item .red { color: #dc2626; }
        .result-item .black { color: #000; }
        .result-blank { color: #999; }
    `;

    return generatePrintHtml({
        title,
        content: seatGridHtml + instructionHtml + resultHtml,
        orientation: 'landscape',
        additionalStyles
    });
}

/**
 * 座席表を印刷
 * @param {Object} config - 設定
 */
export function printSeating(config) {
    const { isLotteryMode = false, ...rest } = config;

    const html = isLotteryMode
        ? generateLotteryPrintHtml(rest)
        : generateSeatingPrintHtml(rest);

    openPrintWindow(html);
}

// グローバルに公開（移行期間中の互換性のため）
if (typeof window !== 'undefined') {
    window.SeatingPrint = {
        generateSeatingPrintHtml,
        generateLotteryPrintHtml,
        printSeating
    };
}
