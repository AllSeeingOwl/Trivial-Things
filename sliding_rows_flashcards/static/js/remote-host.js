// Phone remote, phone side: starts a remote, keeps control across refreshes, sends actions.
// Canonical copy: shared/remote/remote-host.js (copied into each app by tools/sync_shared.py).
// The app's own host script calls RemoteHost.init({ render }) and RemoteHost.act(...).
// Expects the markup in _remote_host_start.html and _remote_host_pair.html.
window.RemoteHost = (function () {
    const $ = (id) => document.getElementById(id);
    const storeKey = 'quiz-remote:' + window.location.host;
    let session = null; // { code, token }
    let render = () => {};
    let lastState = null;

    function loadSession() {
        try { return JSON.parse(localStorage.getItem(storeKey)) || null; } catch (e) { return null; }
    }
    function saveSession(s) {
        try {
            if (s) localStorage.setItem(storeKey, JSON.stringify(s));
            else localStorage.removeItem(storeKey);
        } catch (e) { /* private mode: control lasts until the page is closed */ }
    }
    function say(text) { $('host-message').textContent = text || ''; }
    function friendly(err) {
        return err.message === 'Failed to fetch' ? "Couldn't reach the server. Check the connection and try again." : err.message;
    }

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

    function show(state) {
        lastState = state;
        $('host-start').hidden = true;
        $('host-live').hidden = false;
        $('host-code').textContent = session.code;
        const tvUrl = `${window.location.origin}/?remote=${session.code}`;
        $('host-tv-link').href = tvUrl;
        $('host-tv-link').textContent = tvUrl.replace(/^https?:\/\//, '');
        render(state);
    }

    function lost() {
        session = null;
        saveSession(null);
        $('host-live').hidden = true;
        $('host-start').hidden = false;
        say('That remote has ended. Start a new one, then connect the board again.');
    }

    // Sends an action; resolves with the new state (already rendered), or null if refused.
    async function act(action, data) {
        say('');
        try {
            const state = await api(`/api/rooms/${session.code}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.assign({ action: action }, data || {}))
            });
            show(state);
            return state;
        } catch (err) {
            if (err.status === 404 || err.status === 403) lost();
            else say(friendly(err));
            return null;
        }
    }

    function init(options) {
        render = (options && options.render) || render;

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
                show(body.state);
            } catch (err) {
                say(friendly(err));
            } finally {
                btn.disabled = false;
            }
        });

        $('host-end-btn').addEventListener('click', () => {
            if (!confirm('Stop using this phone as the remote? The board will stop following it.')) return;
            session = null;
            saveSession(null);
            $('host-live').hidden = true;
            $('host-start').hidden = false;
            say('');
        });

        session = loadSession();
        if (session && session.code && session.token) {
            api(`/api/rooms/${session.code}/host`).then(show).catch((err) => {
                if (err.status === 404 || err.status === 403) lost();
                else say("Couldn't reach the server. Refresh to try again.");
            });
        } else {
            session = null;
        }
    }

    return { init, act, say, state: () => lastState };
})();
