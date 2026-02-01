// ===== 席替えツールモジュール (印刷) =====

Object.assign(SeatingModule, {

    // 印刷 (くじ引き対応)
    printSeating() {
        const data = StorageManager.getCurrentData();
        const isLottery = this.isLotteryMode;
        const settings = this.lotterySettings;

        if (isLottery) {
            document.body.classList.add('print-lottery');
        } else {
            document.body.classList.remove('print-lottery');
        }

        let title = '座席表';
        if (isLottery) {
            title = settings.type === 'numbers' ? '席・番号くじ配置図' : '席・トランプ配置図';
        }

        let html = `
            <!DOCTYPE html>
            <html lang="ja">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    @page {
                        size: A4 ${isLottery ? 'portrait' : 'landscape'};
                        margin: 10mm;
                    }
                    body {
                        font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif;
                        margin: 0;
                        padding: 0;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        width: 100%;
                        height: 100%;
                    }
                    h1 { margin: 0 0 5px 0; font-size: 18px; text-align: center; }
                    .date { margin-bottom: 10px; font-size: 12px; color: #666; text-align: right; width: 95%; }

                    /* 座席グリッド */
                    .seating-grid {
                        display: grid;
                        grid-template-columns: repeat(${this.cols}, 1fr);
                        gap: ${isLottery ? '4px' : '5px'};
                        width: ${isLottery ? '90%' : '80%'};
                        margin: 0 auto;
                        padding-bottom: ${isLottery ? '10px' : '0'};
                        margin-bottom: ${isLottery ? '10px' : '15px'};
                    }

                    .seat {
                        border: 1px solid #333;
                        padding: ${isLottery ? '2px' : '4px'};
                        text-align: center;
                        aspect-ratio: ${isLottery ? '4 / 2.5' : '4 / 3'};
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        position: relative;
                        background: #fff;
                    }

                    /* くじ引き */
                    .card-suit { font-size: 24px; line-height: 1; display: block; }
                    .card-number { font-size: 20px; font-weight: bold; margin-top: 2px; display: block; }

                    .ticket-label { font-size: 10px; color: #666; }
                    .ticket-number { font-size: 24px; font-weight: bold; }

                    .red { color: #e53e3e; }
                    .black { color: #1a202c; }

                    /* 通常 */
                    .seat-number { font-size: 14px; color: #666; margin-bottom: 2px; }
                    .seat-name { font-weight: bold; font-size: 16px; font-family: Meiryo, sans-serif; }
                    .seat-kana { font-size: 10px; color: #555; margin-bottom: 2px; }

                    .teacher-desk {
                        margin: 10px auto;
                        width: 150px;
                        height: 30px;
                        border: 1px solid #333;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        background: #f0f0f0;
                        font-size: 14px;
                    }

                    /* くじ引き用下部レイアウト */
                    .lottery-instruction {
                        width: 90%;
                        border: 1px solid #e53e3e;
                        background-color: #fff5f5;
                        color: #c53030;
                        padding: 5px;
                        margin-bottom: 10px;
                        font-weight: bold;
                        font-size: 11px;
                        text-align: center;
                        box-sizing: border-box;
                    }

                    /* トランプ用レイアウト */
                    .lottery-area-cards {
                        display: flex;
                        justify-content: space-between;
                        width: 90%;
                        gap: 8px;
                        margin-top: 5px;
                    }
                    .suit-col {
                        flex: 1;
                        border: 1px solid #000;
                        display: flex;
                        flex-direction: column;
                    }
                    .suit-header {
                        text-align: center;
                        font-weight: bold;
                        border-bottom: 1px solid #000;
                        background: #f0f0f0;
                        padding: 4px;
                        font-size: 14px;
                    }
                    .row {
                        display: flex;
                        border-bottom: 1px solid #ccc;
                        flex: 1;
                        min-height: 25px;
                    }
                    .row:last-child { border-bottom: none; }
                    .num {
                        width: 25px;
                        border-right: 1px solid #ccc;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 12px;
                        background: #fafafa;
                    }
                    .field {
                        flex: 1;
                        position: relative;
                    }
                    .field::after {
                        content: "(番号・名前)";
                        position: absolute;
                        bottom: 1px;
                        right: 2px;
                        font-size: 7px;
                        color: #ddd;
                    }

                    /* 番号くじ用レイアウト */
                     .lottery-area-numbers {
                        width: 90%;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 10px;
                        justify-content: flex-start;
                    }
                    .number-entry {
                        width: 130px;
                        border-bottom: 1px solid #333;
                        padding: 5px;
                        display: flex;
                        align-items: flex-end;
                        font-size: 12px;
                    }
                    .number-entry .no-label {
                        font-weight: bold;
                        margin-right: 5px;
                        font-size: 14px;
                        width: 30px;
                        text-align: right;
                    }
                    .number-entry .write-space {
                        flex: 1;
                        text-align: center;
                        color: #ccc;
                        font-size: 10px;
                    }

                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <div class="date">作成日: ${new Date().toLocaleDateString('ja-JP')}</div>

                ${!isLottery ? `` : ''}

                <div class="seating-grid">
        `;

        const cards = data.seating.cards || {};
        const lockedSeats = data.seating.lockedSeats || [];

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const studentId = this.currentLayout[r] && this.currentLayout[r][c];
                let content = '';

                if (isLottery) {
                    const isLocked = lockedSeats.some(s => s.row === r && s.col === c);
                    if (isLocked && studentId) {
                        const student = data.students.find(s => s.id === studentId);
                        content = `
                            <div class="seat" style="background:#f7fafc;">
                                <div style="font-size:9px;">${student ? student.number : ''}</div>
                                <div style="font-size:11px; font-weight:bold;">${student ? student.nameKanji : '固定'}</div>
                            </div>
                        `;
                    } else {
                        const item = cards[`${r}-${c}`];
                        if (item) {
                            if (item.type === 'number') {
                                // 番号くじ
                                content = `
                                    <div class="seat">
                                        <div class="ticket-label">No.</div>
                                        <div class="ticket-number">${item.value}</div>
                                    </div>
                                `;
                            } else {
                                // トランプ
                                const suitInfo = this.suits.find(s => s.id === item.suit);
                                if (suitInfo) {
                                    content = `
                                        <div class="seat">
                                            <span class="card-suit ${suitInfo.color}">${suitInfo.symbol}</span>
                                            <span class="card-number ${suitInfo.color}">${item.number}</span>
                                        </div>
                                    `;
                                } else {
                                    content = `<div class="seat">?</div>`;
                                }
                            }
                        } else {
                            content = `<div class="seat"></div>`;
                        }
                    }
                } else {
                    if (studentId) {
                        const student = data.students.find(s => s.id === studentId);
                        if (student) {
                            content = `
                                <div class="seat">
                                    <div class="seat-number">${student.number}</div>
                                    <div class="seat-kana">${student.nameKana || ''}</div>
                                    <div class="seat-name">${student.nameKanji}</div>
                                </div>
                            `;
                        } else {
                            content = `<div class="seat"></div>`;
                        }
                    } else {
                        content = `<div class="seat"></div>`;
                    }
                }
                html += content;
            }
        }

        html += `</div>`;

        html += `<div class="teacher-desk" style="margin-bottom: 20px;">教卓</div>`;

        if (isLottery) {
            html += `
                <div class="lottery-instruction">【注意】引いたくじと同じマーク・番号のマスに、あなたの「4桁の生徒番号」と「名前」を記入してください。</div>
            `;

            if (settings.type === 'numbers') {
                // 番号くじ用リスト
                const { start, end } = settings.numberRange;
                html += `<div class="lottery-area-numbers">`;
                for (let i = start; i <= end; i++) {
                    html += `
                        <div class="number-entry">
                            <span class="no-label">${i}</span>
                            <span class="write-space">(名前)</span>
                        </div>
                    `;
                }
                html += `</div>`;

            } else {
                // トランプ用リスト
                html += `<div class="lottery-area-cards">`;
                this.suits.forEach(suit => {
                    const count = settings.cardCounts[suit.id] || 0;
                    if (count === 0) return;

                    html += `
                        <div class="suit-col">
                            <div class="suit-header">${suit.symbol} ${suit.label}</div>
                            ${Array.from({ length: count }, (_, i) => i + 1).map(num => `
                                <div class="row">
                                    <div class="num">${num}</div>
                                    <div class="field"></div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                });
                html += `</div>`;
            }
        }

        html += `</body></html>`;

        const printWindow = window.open('', '', 'width=1100,height=800');
        printWindow.document.write(html);
        printWindow.document.close();

        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 500);
    }
});
