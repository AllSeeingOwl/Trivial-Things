// TV Link, phone side: connect to a TV by its code, then pick what it shows.
(function () {
    'use strict';

    const POLL_MS = 2000;
    const STORE_KEY = 'tv-link-phone';
    const RECENT_KEY = 'tv-link-recent-messages';
    const CODE_LENGTH = Number(document.body.dataset.codeLength) || 5;
    // Photos are shrunk to fit a 1080p TV before they're sent: quicker, and kinder to the server.
    const MAX_W = 1920;
    const MAX_H = 1080;

    const $ = (id) => document.getElementById(id);

    let link = null;    // { code, token }
    let state = null;
    let offset = 0;     // server clock minus this phone's clock
    let pollTimer = null;
    let shownPhotos = '';
    let uploading = false;

    // --- storage (may be blocked: everything still works for this visit) ----------------

    function load(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    }
    function store(key, value) {
        try {
            if (value === null) localStorage.removeItem(key);
            else localStorage.setItem(key, JSON.stringify(value));
        } catch { /* ignore */ }
    }

    // --- talking to the server ----------------------------------------------------------

    function normalise(code) { return String(code || '').replace(/\s+/g, '').toUpperCase(); }

    async function api(path, options = {}) {
        const headers = Object.assign({}, options.headers);
        if (link) headers['X-Phone-Token'] = link.token;
        let response;
        try {
            response = await fetch('/api/screens/' + encodeURIComponent(link ? link.code : options.code) + path,
                Object.assign({}, options, { headers, cache: 'no-store' }));
        } catch {
            throw Object.assign(new Error("Can't reach the server. Check your connection."), { status: 0 });
        }
        let body = null;
        try { body = await response.json(); } catch { /* not JSON */ }
        if (!response.ok) {
            throw Object.assign(new Error((body && body.error) || 'Something went wrong. Try again.'),
                { status: response.status });
        }
        return body;
    }

    function act(action, extra = {}) {
        return api('/actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.assign({ action }, extra)),
        }).then(apply, failed);
    }

    function failed(err) {
        if (err.status === 404 || err.status === 403) {
            disconnect(err.message);
        } else {
            say(err.message);
        }
    }

    function say(text) { $('control-message').textContent = text || ''; }

    // --- connecting ---------------------------------------------------------------------

    async function join(code) {
        code = normalise(code);
        const message = $('join-message');
        if (!new RegExp('^[A-Z]{' + CODE_LENGTH + '}$').test(code)) {
            message.textContent = 'TV codes are ' + CODE_LENGTH + ' letters.';
            return;
        }
        message.textContent = 'Connecting…';
        try {
            const body = await api('/join', { method: 'POST', code });
            link = { code: body.code, token: body.token };
            store(STORE_KEY, link);
            message.textContent = '';
            connected(body.state);
        } catch (err) {
            message.textContent = err.message;
            $('join-code').focus();
        }
    }

    function connected(first) {
        $('join-view').hidden = true;
        $('control-view').hidden = false;
        $('now-code').textContent = link.code;
        say('');
        apply(first);
        clearInterval(pollTimer);
        pollTimer = setInterval(poll, POLL_MS);
    }

    function disconnect(message) {
        clearInterval(pollTimer);
        link = null;
        state = null;
        shownPhotos = '';
        store(STORE_KEY, null);
        $('control-view').hidden = true;
        $('join-view').hidden = false;
        $('join-message').textContent = message || '';
        $('join-code').value = '';
        $('join-code').focus();
    }

    async function poll() {
        if (!link || document.hidden) return;
        try {
            apply(await api('/state'));
        } catch (err) {
            if (err.status === 404 || err.status === 403) disconnect(err.message);
        }
    }

    // --- showing the TV's state ---------------------------------------------------------

    function currentPhotoIndex() {
        const c = state.content;
        const n = state.photos.length;
        if (state.mode !== 'photo' || !n) return -1;
        let index = c.index || 0;
        if (c.slideshow) index += Math.floor((Date.now() + offset - c.started) / (c.slideshow * 1000));
        return ((index % n) + n) % n;
    }

    function describe() {
        const c = state.content;
        switch (state.mode) {
        case 'home': return 'The TV is showing its code.';
        case 'photo': {
            const which = 'Photo ' + (currentPhotoIndex() + 1) + ' of ' + state.photos.length;
            return c.slideshow ? which + ' · slideshow, ' + c.slideshow + ' s each' : which;
        }
        case 'message': return 'Message: “' + c.text + '”';
        case 'video': return 'YouTube video' + (c.playing ? '' : ' (paused)') + (c.muted ? ' · muted' : '');
        case 'timer': return 'Timer';
        case 'clock': return 'Clock';
        case 'blank': return 'Blank screen';
        default: return '';
        }
    }

    function apply(next) {
        if (!next) return;
        offset = next.now - Date.now();
        state = next;
        let text = describe();
        if (!next.tv_online) text += ' The TV seems to be off or asleep.';
        $('now-showing').textContent = text;
        renderPhotos();
        renderVideo();
        renderTimer();
    }

    function photoUrl(id) {
        return '/api/screens/' + encodeURIComponent(link.code) + '/photos/' + encodeURIComponent(id);
    }

    function renderPhotos() {
        const grid = $('photo-grid');
        const key = state.photos.join(',');
        if (key !== shownPhotos) {
            shownPhotos = key;
            grid.textContent = '';
            state.photos.forEach((id, i) => {
                const li = document.createElement('li');
                const show = document.createElement('button');
                show.type = 'button';
                show.className = 'thumb';
                show.dataset.photo = id;
                show.setAttribute('aria-label', 'Show photo ' + (i + 1));
                const img = document.createElement('img');
                img.src = photoUrl(id);
                img.alt = '';
                img.loading = 'lazy';
                show.appendChild(img);
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'thumb-remove';
                remove.dataset.remove = id;
                remove.setAttribute('aria-label', 'Remove photo ' + (i + 1));
                remove.textContent = '×';
                li.append(show, remove);
                grid.appendChild(li);
            });
        }
        const current = currentPhotoIndex();
        grid.querySelectorAll('.thumb').forEach((btn, i) => {
            btn.classList.toggle('is-current', i === current);
            btn.setAttribute('aria-pressed', i === current ? 'true' : 'false');
        });
        const has = state.photos.length > 0;
        $('photo-empty').hidden = has;
        $('prev-btn').disabled = $('next-btn').disabled = !has;
        const running = state.mode === 'photo' && state.content.slideshow;
        const btn = $('slideshow-btn');
        btn.disabled = !has;
        btn.textContent = running ? 'Stop' : 'Start';
        btn.setAttribute('aria-pressed', running ? 'true' : 'false');
    }

    function renderVideo() {
        const on = state.mode === 'video';
        $('video-controls').hidden = !on;
        if (!on) return;
        $('video-play-btn').textContent = state.content.playing ? 'Pause' : 'Play';
        $('video-mute-btn').textContent = state.content.muted ? 'Unmute' : 'Mute';
    }

    function duration(ms) {
        let s = Math.ceil(ms / 1000);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        s %= 60;
        const ss = String(s).padStart(2, '0');
        return h ? h + ':' + String(m).padStart(2, '0') + ':' + ss : m + ':' + ss;
    }

    function renderTimer() {
        const on = state && state.mode === 'timer';
        $('timer-controls').hidden = !on;
        const out = $('timer-now');
        if (!on) { out.textContent = ''; return; }
        const c = state.content;
        const paused = c.remaining !== null && c.remaining !== undefined;
        const left = paused ? c.remaining : Math.max(0, c.ends - (Date.now() + offset));
        out.textContent = left <= 0 ? "Time's up" : duration(left) + (paused ? ' · paused' : '');
        $('timer-pause-btn').textContent = paused ? 'Resume' : 'Pause';
        $('timer-pause-btn').disabled = left <= 0;
    }

    // --- photos -------------------------------------------------------------------------

    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read " + file.name + '.')); };
            img.src = url;
        });
    }

    async function shrink(file) {
        const img = await loadImage(file);
        const scale = Math.min(1, MAX_W / img.naturalWidth, MAX_H / img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000'; // transparent PNGs get a black background, like the TV
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read " + file.name + '.'))),
                'image/jpeg', 0.88);
        });
    }

    async function addPhotos(files) {
        if (uploading || !files.length) return;
        uploading = true;
        const progress = $('photo-progress');
        const total = files.length;
        let sent = 0;
        let problem = '';
        for (const file of files) {
            progress.textContent = 'Sending photo ' + (sent + 1) + ' of ' + total + '…';
            try {
                const blob = await shrink(file);
                // The first new photo goes straight onto the TV.
                const body = await api('/photos' + (sent === 0 ? '?show=1' : ''), {
                    method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob,
                });
                sent += 1;
                apply(body.state);
            } catch (err) {
                if (err.status === 404 || err.status === 403) { uploading = false; failed(err); return; }
                problem = err.message;
                if (err.status === 503 || /full|already has/i.test(problem)) break;
            }
        }
        uploading = false;
        progress.textContent = (sent === 1 ? '1 photo sent.' : sent + ' photos sent.') + (problem ? ' ' + problem : '');
    }

    // --- timer --------------------------------------------------------------------------

    function readDuration(text) {
        text = text.trim();
        let m;
        if ((m = /^(\d+):(\d{1,2}):(\d{1,2})$/.exec(text))) return +m[1] * 3600 + +m[2] * 60 + +m[3];
        if ((m = /^(\d+):(\d{1,2})$/.exec(text))) return +m[1] * 60 + +m[2];
        if ((m = /^(\d+(?:\.\d+)?)$/.exec(text))) return Math.round(parseFloat(m[1]) * 60); // plain number = minutes
        return 0;
    }

    // --- messages -----------------------------------------------------------------------

    function renderRecent() {
        const recent = load(RECENT_KEY, []);
        const list = $('recent-list');
        list.textContent = '';
        $('recent-title').hidden = recent.length === 0;
        recent.forEach((text) => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'recent-item';
            btn.dataset.text = text;
            btn.textContent = text;
            li.appendChild(btn);
            list.appendChild(li);
        });
    }

    function sendMessage(text) {
        text = text.trim();
        if (!text) { say('Type a message first.'); return; }
        const recent = load(RECENT_KEY, []).filter((t) => t !== text);
        recent.unshift(text);
        store(RECENT_KEY, recent.slice(0, 6));
        renderRecent();
        act('message', { text });
    }

    // --- tabs ---------------------------------------------------------------------------

    function selectTab(tab, focus) {
        document.querySelectorAll('[role=tab]').forEach((t) => {
            const on = t === tab;
            t.setAttribute('aria-selected', on ? 'true' : 'false');
            t.tabIndex = on ? 0 : -1;
            $(t.getAttribute('aria-controls')).hidden = !on;
        });
        if (focus) tab.focus();
    }

    // --- wiring -------------------------------------------------------------------------

    function wire() {
        $('tv-url').textContent = location.host + '/tv';

        $('join-form').addEventListener('submit', (e) => { e.preventDefault(); join($('join-code').value); });
        $('disconnect-btn').addEventListener('click', () => disconnect(''));

        // Any button with data-action (Home, Clock, Blank, Restart, Stop, +30 s…).
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn || !link) return;
            const extra = btn.dataset.seconds ? { seconds: Number(btn.dataset.seconds) } : {};
            act(btn.dataset.action, extra);
        });

        $('photo-input').addEventListener('change', (e) => {
            addPhotos(Array.from(e.target.files || []));
            e.target.value = '';
        });
        $('photo-grid').addEventListener('click', (e) => {
            const show = e.target.closest('[data-photo]');
            if (show) { act('show_photo', { photo: show.dataset.photo }); return; }
            const remove = e.target.closest('[data-remove]');
            if (remove) act('remove_photo', { photo: remove.dataset.remove });
        });
        $('prev-btn').addEventListener('click', () => act('step_photo', { delta: -1 }));
        $('next-btn').addEventListener('click', () => act('step_photo', { delta: 1 }));
        $('slideshow-btn').addEventListener('click', () => {
            const running = state && state.mode === 'photo' && state.content.slideshow;
            act('slideshow', { seconds: running ? 0 : Number($('slide-seconds').value) });
        });
        $('slide-seconds').addEventListener('change', () => {
            if (state && state.mode === 'photo' && state.content.slideshow) {
                act('slideshow', { seconds: Number($('slide-seconds').value) });
            }
        });

        const input = $('message-input');
        input.addEventListener('input', () => {
            $('message-count').textContent = input.value.length + ' / ' + input.maxLength;
        });
        $('message-form').addEventListener('submit', (e) => { e.preventDefault(); sendMessage(input.value); });
        $('recent-list').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-text]');
            if (btn) { input.value = btn.dataset.text; sendMessage(btn.dataset.text); }
        });
        renderRecent();

        $('video-form').addEventListener('submit', (e) => {
            e.preventDefault();
            act('video', { url: $('video-input').value });
        });
        $('video-play-btn').addEventListener('click', () => act(state.content.playing ? 'video_pause' : 'video_play'));
        $('video-mute-btn').addEventListener('click', () => act('video_mute', { muted: !state.content.muted }));

        document.querySelectorAll('[data-timer]').forEach((btn) => {
            btn.addEventListener('click', () => act('timer', { seconds: Number(btn.dataset.timer) }));
        });
        $('timer-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const seconds = readDuration($('timer-input').value);
            if (!seconds) { say('Type a time like 3:00 (minutes and seconds) or 5 (minutes).'); return; }
            act('timer', { seconds });
        });
        $('timer-pause-btn').addEventListener('click', () => {
            const paused = state.content.remaining !== null && state.content.remaining !== undefined;
            act(paused ? 'timer_resume' : 'timer_pause');
        });

        const tabs = Array.from(document.querySelectorAll('[role=tab]'));
        tabs.forEach((tab, i) => {
            tab.addEventListener('click', () => selectTab(tab, false));
            tab.addEventListener('keydown', (e) => {
                const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
                if (step) { e.preventDefault(); selectTab(tabs[(i + step + tabs.length) % tabs.length], true); }
            });
        });

        // Keep the timer and slideshow counters moving between polls.
        setInterval(() => { if (state) { renderTimer(); if (state.mode === 'photo') { renderPhotos(); $('now-showing').textContent = describe(); } } }, 500);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
    }

    async function boot() {
        wire();
        const params = new URLSearchParams(location.search);
        const wanted = normalise(params.get('code'));
        if (wanted) history.replaceState(null, '', location.pathname);
        const saved = load(STORE_KEY, null);
        if (saved && saved.code && saved.token && (!wanted || wanted === saved.code)) {
            link = saved;
            try {
                connected(await api('/state'));
                return;
            } catch (err) {
                link = null;
                store(STORE_KEY, null);
                if (!wanted) { $('join-message').textContent = err.status === 404 ? 'That TV code has ended.' : ''; }
            }
        }
        if (wanted) {
            $('join-code').value = wanted;
            join(wanted);
        } else {
            $('join-code').focus();
        }
    }

    boot();
})();
