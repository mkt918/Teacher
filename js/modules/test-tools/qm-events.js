/**
 * TestToolsQMEvents - 作問補助ツールのイベントリスナー設定
 */
const TestToolsQMEvents = {
    setup(qmCore) {
        // 基本情報の変更を即時反映（状態代理Proxyが自動的に描画をキックするため呼出不要）
        ['qmTitle','qmGrade','qmDate','qmPeriod','qmNotes'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', e => {
                const k = id.replace('qm','').toLowerCase();
                const map = { title:'title', grade:'grade', date:'date', period:'period', notes:'notes' };
                qmCore.qm[map[k] || k] = e.target.value;
            });
        });

        // 観点追加
        document.getElementById('qmAddCriteriaBtn')?.addEventListener('click', () => {
            const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];
            qmCore.qm.criteria.push({
                id: 'c' + Date.now(),
                label: '観点' + (qmCore.qm.criteria.length + 1),
                color: colors[qmCore.qm.criteria.length % colors.length],
            });
        });

        // 大問追加
        document.getElementById('qmAddSectionBtn')?.addEventListener('click', () => {
            qmCore.qm.sections.push({
                id: 'sec' + Date.now(),
                title: '',
                intro: '',
                questions: [],
            });
        });

        // PDF出力
        document.getElementById('qmPrintBtn')?.addEventListener('click', () => qmCore.printPDF());

        // テンプレート管理
        qmCore.updateQMTemplateSelect();
        document.getElementById('qmSaveTemplateBtn')?.addEventListener('click', () => qmCore.saveTemplate());
        document.getElementById('qmLoadTemplateBtn')?.addEventListener('click', () => qmCore.loadTemplate());
        document.getElementById('qmDeleteTemplateBtn')?.addEventListener('click', () => qmCore.deleteTemplate());

        // 観点リストのイベント委任
        this._setupCriteriaEvents(qmCore);
        // 大問・設問のイベント委任
        this.setupSectionEvents(qmCore);
    },

    _setupCriteriaEvents(qmCore) {
        const list = document.getElementById('qmCriteriaList');
        if (!list) return;
        list.addEventListener('input', e => {
            const row = e.target.closest('[data-cid]');
            if (!row) return;
            const cid = row.dataset.cid;
            const c = qmCore.qm.criteria.find(x => x.id === cid);
            if (!c) return;
            if (e.target.classList.contains('qm-criteria-label')) {
                c.label = e.target.value;
            }
            if (e.target.classList.contains('qm-criteria-color')) {
                c.color = e.target.value;
            }
        });
        list.addEventListener('click', e => {
            if (!e.target.classList.contains('qm-remove-criteria')) return;
            const row = e.target.closest('[data-cid]');
            if (!row) return;
            qmCore.qm.criteria = qmCore.qm.criteria.filter(c => c.id !== row.dataset.cid);
        });
    },

    setupSectionEvents(qmCore) {
        const list = document.getElementById('qmSectionList');
        if (!list) return;

        // イベントが重複して登録されないようにする（refreshSectionList等で再呼ばれる可能性があるため）
        // ただし、イベント委任ならそもそも1回の登録で良い
        if (!list.dataset.eventsBound) {
            list.dataset.eventsBound = 'true';
            
            list.addEventListener('input', e => {
                const secEl = e.target.closest('[data-sid]');
                if (!secEl) return;
                const sid = secEl.dataset.sid;
                const sec = qmCore.qm.sections.find(s => s.id === sid);
                if (!sec) return;

                if (e.target.classList.contains('qm-sec-title')) {
                    sec.title = e.target.value;
                }
                if (e.target.classList.contains('qm-sec-intro')) {
                    sec.intro = e.target.value;
                }
                // 設問フィールド
                const qEl = e.target.closest('[data-qid]');
                if (qEl) {
                    const q = sec.questions.find(q => q.id === qEl.dataset.qid);
                    if (!q) return;
                    if (e.target.classList.contains('qm-q-text'))     q.text       = e.target.value;
                    if (e.target.classList.contains('qm-q-answer'))   q.answer     = e.target.value;
                    if (e.target.classList.contains('qm-q-points'))   q.points     = parseInt(e.target.value) || 0;
                    if (e.target.classList.contains('qm-q-criteria')) q.criteriaId = e.target.value;
                }
            });

            list.addEventListener('click', e => {
                // 大問削除
                if (e.target.classList.contains('qm-remove-section')) {
                    const sid = e.target.dataset.sid;
                    qmCore.qm.sections = qmCore.qm.sections.filter(s => s.id !== sid);
                    return;
                }
                // 設問追加
                if (e.target.classList.contains('qm-add-question')) {
                    const sid = e.target.dataset.sid;
                    const sec = qmCore.qm.sections.find(s => s.id === sid);
                    if (sec) {
                        sec.questions.push({ id: 'q' + Date.now(), text: '', answer: '', points: 0, criteriaId: '' });
                    }
                    return;
                }
                // 設問削除
                if (e.target.classList.contains('qm-remove-question')) {
                    const sid = e.target.dataset.sid;
                    const qid = e.target.dataset.qid;
                    const sec = qmCore.qm.sections.find(s => s.id === sid);
                    if (sec) {
                        sec.questions = sec.questions.filter(q => q.id !== qid);
                    }
                    return;
                }
                // 大問移動
                if (e.target.closest('.qm-move-section')) {
                    const btn = e.target.closest('.qm-move-section');
                    const sid = btn.dataset.sid;
                    const dir = btn.dataset.dir;
                    const idx = qmCore.qm.sections.findIndex(s => s.id === sid);
                    if (idx === -1) return;

                    if (dir === 'up' && idx > 0) {
                        [qmCore.qm.sections[idx - 1], qmCore.qm.sections[idx]] = [qmCore.qm.sections[idx], qmCore.qm.sections[idx - 1]];
                    } else if (dir === 'down' && idx < qmCore.qm.sections.length - 1) {
                        [qmCore.qm.sections[idx], qmCore.qm.sections[idx + 1]] = [qmCore.qm.sections[idx + 1], qmCore.qm.sections[idx]];
                    }
                    return;
                }
            });
        }
    }
};

if (typeof window !== 'undefined') {
    window.TestToolsQMEvents = TestToolsQMEvents;
}
