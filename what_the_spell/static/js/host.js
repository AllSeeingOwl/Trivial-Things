// What The Spell: the quizmaster's phone remote.
// Starts a room on the server, then picks words, shows them on the TV and changes the mode.
// The room's code and private host key are kept on this phone so a refresh keeps control.
(function () {
    const STORE_KEY = 'what-the-spell-remote';
    const $ = (id) => document.getElementById(id);
    const startSection = $('host-start');
    const live = $('host-live');
    const message = $('host-message');
    const modeBtns = document.querySelectorAll('.host-modes .mode-btn');
    let session = null; // { code, token }
    let state = null;

    function loadSession() {
        try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch (e) { return null; }
    }
    function saveSession(s) {
        try {
            if (s) localStorage.setItem(STORE_KEY, JSON.stringify(s));
            else localStorage.removeItem(STORE_KEY);
        } catch (e) { /* private mode: control lasts until the page is closed */ }
    }

    function say(text) { message.textContent = text || ''; }

    async function api(path, options) {
        const opts = Object.assign({ cache: 'no-store' }, options || {});
        opts.headers = Object.assign({ 'X-Host-Token': session.token }, opts.headers || {});
        const res = await fetch(path, opts);
        let body = null;
        try { body = await res.json(); } catch (e) { /* no body */ }
        if (!res.ok) {
            const err = new Error((body && body.error) || `Something went wrong (${res.status}).`);
            err.status = res.status;
            throw err;
        }
        return body;
    }

    async function act(action, data) {
        say('');
        try {
            render(await api(`/api/rooms/${session.code}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({ action: action }, data || {}))
            }));
        } catch (err) {
            if (err.status === 404 || err.status === 403) return lost();
            say(err.message === 'Failed to fetch' ? "Couldn't reach the server. Check the connection and try again." : err.message);
        }
    }

    function lost() {
        session = null;
        saveSession(null);
        live.hidden = true;
        startSection.hidden = false;
        say('That remote has ended. Start a new one, then connect the board again.');
    }

    $('host-start-btn').addEventListener('click', async () => {
        const btn = $('host-start-btn');
        btn.disabled = true;
        say('');
        try {
            const res = await fetch('/api/rooms', { method: 'POST', cache: 'no-store' });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error || 'Could not start a remote.');
            session = { code: body.code, token: body.token };
            saveSession(session);
            render(body.state);
        } catch (err) {
            say(err.message === 'Failed to fetch' ? "Couldn't reach the server. Try again in a moment." : err.message);
        } finally {
            btn.disabled = false;
        }
    });

    $('host-reveal-btn').addEventListener('click', () => act('reveal'));
    $('host-clear-btn').addEventListener('click', () => act('clear'));
    $('host-reset-btn').addEventListener('click', () => {
        if (confirm('Hide every word on the TV again?')) act('reset');
    });
    $('host-grid-select').addEventListener('change', (e) => {
        act('grid', { grid: parseInt(e.target.value, 10) });
    });
    $('host-end-btn').addEventListener('click', () => {
        if (!confirm('Stop using this phone as the remote? The board will stop following it.')) return;
        session = null;
        saveSession(null);
        state = null;
        live.hidden = true;
        startSection.hidden = false;
        say('');
    });
    modeBtns.forEach(btn => btn.addEventListener('click', () => act('mode', { mode: btn.dataset.mode })));

    $('host-words').addEventListener('click', (e) => {
        const btn = e.target.closest('.host-word');
        if (!btn) return;
        act('choose', { row: parseInt(btn.dataset.row, 10), col: parseInt(btn.dataset.col, 10) });
    });

    function render(s) {
        state = s;
        // The word list is redrawn below; remember which word had focus so it keeps it.
        const focused = document.activeElement && document.activeElement.closest
            ? document.activeElement.closest('.host-word') : null;
        const refocus = focused ? `.host-word[data-row="${focused.dataset.row}"][data-col="${focused.dataset.col}"]` : null;
        startSection.hidden = true;
        live.hidden = false;

        $('host-code').textContent = session.code;
        const tvUrl = `${window.location.origin}/?remote=${session.code}`;
        $('host-tv-link').href = tvUrl;
        $('host-tv-link').textContent = tvUrl.replace(/^https?:\/\//, '');

        const select = $('host-grid-select');
        if (select.options.length !== s.num_grids) {
            select.textContent = '';
            for (let i = 0; i < s.num_grids; i++) {
                const opt = document.createElement('option');
                opt.value = String(i);
                opt.textContent = `Grid ${i + 1}`;
                select.appendChild(opt);
            }
        }
        select.value = String(s.grid);

        modeBtns.forEach(b => {
            const on = b.dataset.mode === s.mode;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        $('host-mode-name').textContent = window.WhatTheSpell.MODES[s.mode] || s.mode;

        const chosenKey = s.chosen ? `${s.chosen[0]}-${s.chosen[1]}` : null;
        const words = $('host-words');
        words.textContent = '';
        const fragment = document.createDocumentFragment();
        s.words.forEach((row, r) => {
            row.forEach((word, c) => {
                const key = `${r}-${c}`;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'host-word';
                btn.dataset.row = String(r);
                btn.dataset.col = String(c);
                const pos = document.createElement('span');
                pos.className = 'host-word-pos';
                pos.textContent = `${r + 1}-${c + 1}`;
                const text = document.createElement('span');
                text.textContent = word;
                btn.append(pos, text);
                const shown = Object.prototype.hasOwnProperty.call(s.revealed, key);
                if (shown) btn.classList.add('is-shown');
                if (key === chosenKey) {
                    btn.classList.add('is-chosen');
                    btn.setAttribute('aria-pressed', 'true');
                } else {
                    btn.setAttribute('aria-pressed', 'false');
                }
                btn.setAttribute('aria-label', `${word}, row ${r + 1}, column ${c + 1}${shown ? ', shown on TV' : ''}`);
                fragment.appendChild(btn);
            });
        });
        words.appendChild(fragment);
        if (refocus) {
            const again = words.querySelector(refocus);
            if (again) again.focus({ preventScroll: true });
        }

        const revealBtn = $('host-reveal-btn');
        const clearBtn = $('host-clear-btn');
        if (chosenKey) {
            const word = s.words[s.chosen[0]][s.chosen[1]];
            $('host-chosen-word').textContent = word;
            $('host-spelling').textContent = window.WhatTheSpell.expectedSpelling(word, s.mode);
            revealBtn.disabled = s.chosen_revealed;
            clearBtn.disabled = false;
            $('host-tv-state').textContent = s.chosen_revealed ? 'Showing on the TV.' : 'Hidden on the TV.';
        } else {
            $('host-chosen-word').textContent = 'Nothing chosen yet';
            $('host-spelling').textContent = '---';
            revealBtn.disabled = true;
            clearBtn.disabled = true;
            $('host-tv-state').textContent = '';
        }
    }

    // Pick up where we left off after a refresh.
    session = loadSession();
    if (session && session.code && session.token) {
        api(`/api/rooms/${session.code}/host`).then(render).catch((err) => {
            if (err.status === 404 || err.status === 403) lost();
            else say("Couldn't reach the server. Refresh to try again.");
        });
    } else {
        session = null;
    }
})();
