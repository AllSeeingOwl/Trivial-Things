// Sliding Rows: the quizmaster's phone remote (/host). Uses remote-host.js.
(function () {
    const $ = (id) => document.getElementById(id);

    function render(s) {
        const st = s.stats || {};
        $('host-stats').textContent = `Chains remaining: ${st.remaining}/${st.total}`;
        const list = $('host-rows');
        // Keep focus on the same button after the list is redrawn.
        const focused = document.activeElement && document.activeElement.closest ? document.activeElement.closest('[data-row]') : null;
        const refocus = focused ? `[data-row="${focused.dataset.row}"][data-part="${focused.dataset.part}"]` : null;
        list.textContent = '';
        if (s.empty) {
            $('host-tv-state').textContent = "That's every chain. Reset all chains to play them again.";
            $('host-next-btn').disabled = true;
            return;
        }
        $('host-next-btn').disabled = false;
        $('host-next-btn').textContent = s.complete ? 'Next chain' : 'Skip to next chain';
        s.rows.forEach((row, i) => {
            const li = document.createElement('li');
            li.className = 'host-row' + (row.state === 1 ? ' is-question' : '') + (row.state === 2 ? ' is-answer' : '');
            const text = document.createElement('div');
            text.className = 'host-row-text';
            const q = document.createElement('p');
            q.className = 'host-row-q';
            q.textContent = `${i + 1}. ${row.question}`;
            const a = document.createElement('p');
            a.className = 'host-row-a';
            a.textContent = row.answer;
            text.append(q, a);
            const buttons = document.createElement('div');
            buttons.className = 'host-row-buttons';
            for (const [part, label, level] of [['question', 'Show question', 1], ['answer', 'Show answer', 2]]) {
                const b = document.createElement('button');
                b.type = 'button';
                b.dataset.row = String(i);
                b.dataset.part = part;
                b.className = part === 'answer' ? 'qn-go' : 'qn-skip';
                b.disabled = row.state >= level;
                b.textContent = row.state >= level ? (part === 'answer' ? 'Answer shown' : 'Question shown') : label;
                b.setAttribute('aria-label', `${b.textContent}, row ${i + 1}`);
                buttons.appendChild(b);
            }
            li.append(text, buttons);
            list.appendChild(li);
        });
        if (refocus) {
            const again = list.querySelector(refocus);
            if (again && !again.disabled) again.focus({ preventScroll: true });
        }
        const shown = s.rows.filter((r) => r.state === 2).length;
        $('host-tv-state').textContent = s.complete
            ? 'Chain complete! It has been marked as used.'
            : `${shown} of ${s.rows.length} answers shown on the TV.`;
    }

    $('host-rows').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-row]');
        if (!b || b.disabled) return;
        RemoteHost.act('show', { row: parseInt(b.dataset.row, 10), part: b.dataset.part });
    });
    $('host-next-btn').addEventListener('click', () => {
        const s = RemoteHost.state();
        if (s && !s.complete && !confirm('Skip this chain? It stays unplayed and can come up again.')) return;
        RemoteHost.act('next');
    });
    $('host-reset-btn').addEventListener('click', () => {
        if (confirm('Reset all chains? Finished chains come back into play.')) RemoteHost.act('reset');
    });

    RemoteHost.init({ render });
})();
