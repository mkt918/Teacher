// ===== 共通UI部品 =====
// - UI.toast : 画面を止めずに数秒だけ出る通知（alert()の代わり）
// - UI.form  : 入力欄付きのダイアログ（prompt()を何度も続ける代わり）
// - モーダル共通: Escキーで一番手前のモーダルを閉じる

const UI = {
    /**
     * 数秒で消える通知を出す
     * @param {string} message
     * @param {'success'|'error'|'info'} type
     * @param {number} duration - 表示時間(ms)。エラーは読み切れるよう長めにする
     */
    toast(message, type = 'success', duration) {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            container.setAttribute('role', 'status');
            container.setAttribute('aria-live', 'polite');
            document.body.appendChild(container);
        }

        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.textContent = message;
        el.addEventListener('click', () => el.remove());
        container.appendChild(el);
        setTimeout(() => el.remove(), duration || (type === 'error' ? 6000 : 3000));
    },

    /**
     * 入力欄付きのダイアログを開き、入力値を返す
     * @param {Object} options
     * @param {string} options.title
     * @param {string} [options.description] - 入力欄の上に出す説明
     * @param {Array<Object>} options.fields - { name, label, type('text'|'number'|'date'|'textarea'|'select'),
     *        value, placeholder, required, min, max, maxlength, rows(textarea), options([{value,label}]), help }
     * @param {boolean} [options.wide=false] - 長い文章を貼り付ける入力など、幅の広いダイアログにする
     * @param {string} [options.submitLabel='OK']
     * @param {(values:Object)=>string|null} [options.validate] - エラー文を返すと閉じずに表示する
     * @param {Array<{label:string, action:string, danger?:boolean}>} [options.extraButtons]
     *        押すと { action } で閉じる（例: 編集ダイアログの「削除」）
     * @returns {Promise<Object|null>} 入力値（キャンセル時はnull）
     */
    form(options) {
        const { title, description, fields, submitLabel = 'OK', validate, extraButtons = [], wide = false } = options;

        return new Promise(resolve => {
            const modal = document.createElement('div');
            modal.className = `modal active ui-dialog${wide ? ' ui-dialog-wide' : ''}`;
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');

            const fieldHtml = fields.map((f, i) => {
                const id = `uiDialogField${i}`;
                const common = `id="${id}" name="${escapeHtml(f.name)}"` +
                    (f.required ? ' required' : '') +
                    (f.placeholder ? ` placeholder="${escapeHtml(f.placeholder)}"` : '') +
                    (f.maxlength ? ` maxlength="${f.maxlength}"` : '');
                const value = f.value === undefined || f.value === null ? '' : String(f.value);
                let input;
                if (f.type === 'textarea') {
                    input = `<textarea ${common} rows="${f.rows || 4}">${escapeHtml(value)}</textarea>`;
                } else if (f.type === 'select') {
                    input = `<select ${common}>${(f.options || []).map(o =>
                        `<option value="${escapeHtml(String(o.value))}" ${String(o.value) === value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}</select>`;
                } else {
                    const range = (f.min !== undefined ? ` min="${f.min}"` : '') + (f.max !== undefined ? ` max="${f.max}"` : '');
                    input = `<input type="${f.type || 'text'}" ${common}${range} value="${escapeHtml(value)}" autocomplete="off">`;
                }
                return `<div class="form-group">
                    <label for="${id}">${escapeHtml(f.label)}${f.required ? ' <span class="ui-required">必須</span>' : ''}</label>
                    ${input}
                    ${f.help ? `<p class="help-text">${escapeHtml(f.help)}</p>` : ''}
                </div>`;
            }).join('');

            modal.innerHTML = `
                <form class="modal-content" novalidate>
                    <div class="modal-header">
                        <h3>${escapeHtml(title)}</h3>
                        <button type="button" class="modal-close" aria-label="閉じる">✕</button>
                    </div>
                    <div class="modal-body">
                        ${description ? `<p class="ui-dialog-description">${escapeHtml(description)}</p>` : ''}
                        ${fieldHtml}
                        <p class="ui-dialog-error" role="alert"></p>
                    </div>
                    <div class="modal-footer">
                        ${extraButtons.map((b, i) => `<button type="button" class="btn ${b.danger ? 'btn-danger' : 'btn-secondary'} ui-extra-btn" data-index="${i}">${escapeHtml(b.label)}</button>`).join('')}
                        <span class="ui-dialog-spacer"></span>
                        <button type="button" class="btn btn-secondary ui-cancel-btn">キャンセル</button>
                        <button type="submit" class="btn btn-primary">${escapeHtml(submitLabel)}</button>
                    </div>
                </form>`;
            document.body.appendChild(modal);

            const form = modal.querySelector('form');
            const errorEl = modal.querySelector('.ui-dialog-error');
            const close = (result) => {
                modal.remove();
                resolve(result);
            };
            const readValues = () => {
                const values = {};
                fields.forEach((f, i) => {
                    const raw = modal.querySelector(`#uiDialogField${i}`).value;
                    values[f.name] = f.type === 'number' ? (raw === '' ? null : Number(raw)) : raw.trim();
                });
                return values;
            };

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const values = readValues();
                const missing = fields.find(f => f.required && (values[f.name] === '' || values[f.name] === null));
                const error = missing ? `「${missing.label}」を入力してください` : (validate ? validate(values) : null);
                if (error) {
                    errorEl.textContent = error;
                    return;
                }
                close(values);
            });
            modal.querySelector('.modal-close').addEventListener('click', () => close(null));
            modal.querySelector('.ui-cancel-btn').addEventListener('click', () => close(null));
            modal.addEventListener('click', (e) => { if (e.target === modal) close(null); });
            modal.querySelectorAll('.ui-extra-btn').forEach(btn => {
                btn.addEventListener('click', () => close({ action: extraButtons[Number(btn.dataset.index)].action }));
            });

            const first = modal.querySelector('input, textarea, select');
            if (first) {
                first.focus();
                if (first.select) first.select();
            }
        });
    },

    // Escキーで一番手前のモーダルを閉じる。各モーダルの「閉じる」ボタンを押したのと同じ扱いにして、
    // モーダルごとの後片付け（再描画など）もそのまま動かす
    setupModalKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const open = Array.from(document.querySelectorAll('.modal.active'));
            const top = open[open.length - 1];
            if (!top) return;
            const closeBtn = top.querySelector('.modal-close');
            if (closeBtn) closeBtn.click();
            else top.classList.remove('active');
        });
    }
};

window.UI = UI;
