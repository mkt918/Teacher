/**
 * PrintUtils - 印刷共通ユーティリティ
 */

/**
 * 印刷ウィンドウを開く
 * @param {string} html - 印刷するHTML
 * @param {Object} options - オプション
 */
export function openPrintWindow(html, options = {}) {
    const { width = 900, height = 700 } = options;
    const win = window.open('', '', `width=${width},height=${height}`);
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
        win.focus();
        win.print();
    }, 500);
    return win;
}

/**
 * A4印刷用のベースHTMLを生成
 * @param {Object} config - 設定
 */
export function generatePrintHtml(config) {
    const {
        title = '印刷',
        content = '',
        orientation = 'portrait',
        margin = '10mm',
        fontSize = '12px',
        showDate = true,
        additionalStyles = ''
    } = config;

    const dateHtml = showDate ?
        `<div class="print-date">${new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</div>` : '';

    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        @page {
            size: A4 ${orientation};
            margin: ${margin};
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif;
            font-size: ${fontSize};
            line-height: 1.5;
            color: #333;
        }
        .print-header {
            text-align: center;
            margin-bottom: 15px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
        }
        .print-title {
            font-size: 1.5em;
            font-weight: bold;
        }
        .print-date {
            font-size: 0.9em;
            color: #666;
            margin-top: 5px;
        }
        .print-content {
            padding: 10px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            border: 1px solid #333;
            padding: 6px 8px;
            text-align: center;
        }
        th {
            background-color: #f0f0f0;
            font-weight: bold;
        }
        ${additionalStyles}
    </style>
</head>
<body>
    <div class="print-header">
        <div class="print-title">${title}</div>
        ${dateHtml}
    </div>
    <div class="print-content">
        ${content}
    </div>
</body>
</html>`;
}

/**
 * 座席表印刷用のグリッドHTMLを生成
 * @param {Object} config - 設定
 */
export function generateGridPrintHtml(config) {
    const {
        title = '座席表',
        rows = 6,
        cols = 6,
        cells = [], // { row, col, content }[]
        cellWidth = '80px',
        cellHeight = '60px',
        zoom = 0.9
    } = config;

    let gridHtml = '<div class="grid-container">';
    for (let r = 0; r < rows; r++) {
        gridHtml += '<div class="grid-row">';
        for (let c = 0; c < cols; c++) {
            const cell = cells.find(cell => cell.row === r && cell.col === c);
            const content = cell ? cell.content : '';
            const classes = cell?.classes || '';
            gridHtml += `<div class="grid-cell ${classes}">${content}</div>`;
        }
        gridHtml += '</div>';
    }
    gridHtml += '</div>';

    const additionalStyles = `
        .grid-container {
            display: flex;
            flex-direction: column;
            gap: 5px;
            zoom: ${zoom};
        }
        .grid-row {
            display: flex;
            gap: 5px;
        }
        .grid-cell {
            width: ${cellWidth};
            height: ${cellHeight};
            border: 1px solid #333;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            font-size: 0.9em;
        }
        .grid-cell.empty {
            background-color: #f5f5f5;
        }
    `;

    return generatePrintHtml({
        title,
        content: gridHtml,
        orientation: 'landscape',
        additionalStyles
    });
}

// グローバルに公開（移行期間中の互換性のため）
window.PrintUtils = { openPrintWindow, generatePrintHtml, generateGridPrintHtml };
