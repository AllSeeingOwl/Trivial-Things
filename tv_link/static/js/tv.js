// TV Link, TV side: gets a code, then shows whatever the connected phones pick.
//
// Written in ES5 with XMLHttpRequest so it runs in older smart-TV browsers; checked by
// `npm run check:tv` in tools/frontend.
(function () {
    'use strict';

    var POLL_MS = 1000;
    var STORE_KEY = 'tv-link-screen';
    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
        'September', 'October', 'November', 'December'];
    var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    var screen = null;      // { code, tv_token }
    var state = null;       // the last state from the server
    var version = -1;
    var offset = 0;         // server clock minus this TV's clock, in ms
    var busy = false;
    var failures = 0;
    var tick = null;
    var shownPhoto = '';
    var slideFront = 'photo-a';
    var video = { id: '', start: 0, command: -1, restart: 0 };
    var wakeLock = null;

    function byId(id) { return document.getElementById(id); }

    function now() { return new Date().getTime() + offset; }

    function request(method, url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        xhr.timeout = 15000;
        if (screen) xhr.setRequestHeader('X-TV-Token', screen.tv_token);
        xhr.onload = function () {
            var body = null;
            try { body = JSON.parse(xhr.responseText); } catch (e) { /* not JSON */ }
            callback(xhr.status, body);
        };
        xhr.onerror = function () { callback(0, null); };
        xhr.ontimeout = function () { callback(0, null); };
        xhr.send();
    }

    // --- remembering the code across reloads ------------------------------------------------

    function saved() {
        try {
            var value = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null');
            if (value && value.code && value.tv_token) return value;
        } catch (e) { /* storage blocked or empty */ }
        return null;
    }

    function save(value) {
        try {
            if (value) window.localStorage.setItem(STORE_KEY, JSON.stringify(value));
            else window.localStorage.removeItem(STORE_KEY);
        } catch (e) { /* storage blocked: a reload will just get a new code */ }
    }

    // --- getting a code ---------------------------------------------------------------------

    function setStatus(text) { byId('home-status').textContent = text; }

    function newScreen() {
        screen = null;
        version = -1;
        setStatus('Getting a code…');
        request('POST', '/api/screens', function (status, body) {
            if (status === 201 && body) {
                screen = { code: body.code, tv_token: body.tv_token };
                save(screen);
                showCode();
                apply(body.state);
            } else {
                setStatus(status === 503 && body ? body.error : "Can't reach the server. Trying again…");
                setTimeout(newScreen, 5000);
            }
        });
    }

    function showCode() {
        byId('home-code').textContent = screen.code;
        var qr = byId('home-qr');
        qr.onload = function () { byId('home-qr-box').hidden = false; };
        qr.onerror = function () { byId('home-qr-box').hidden = true; };
        qr.src = '/qr.svg?code=' + encodeURIComponent(screen.code);
    }

    function endScreen() {
        if (!screen) return;
        var old = screen;
        request('POST', '/api/screens/' + encodeURIComponent(old.code) + '/tv/end', function () {});
        save(null);
        newScreen();
    }

    // --- following the phones ---------------------------------------------------------------

    function poll() {
        if (busy || !screen) return;
        busy = true;
        request('GET', '/api/screens/' + encodeURIComponent(screen.code) + '/tv', function (status, body) {
            busy = false;
            if (status === 200 && body) {
                failures = 0;
                apply(body);
            } else if (status === 404 || status === 403) {
                save(null);
                newScreen();
            } else {
                failures += 1;
                if (failures === 5) byId('corner').textContent = 'Reconnecting…';
            }
        });
    }

    function apply(next) {
        offset = next.now - new Date().getTime();
        if (failures === 0) byId('corner').textContent = '';
        var phones = next.phones === 1 ? '1 phone connected' : next.phones + ' phones connected';
        setStatus(next.phones ? phones + '. Pick something to show on your phone.' : 'Waiting for a phone…');
        if (next.version === version) return;
        version = next.version;
        state = next;
        render();
    }

    function setMode(mode) {
        var body = document.body;
        body.className = body.className.replace(/\bmode-\w+/g, '').replace(/\s+$/, '') + ' mode-' + mode;
        if (mode !== 'video') stopVideo();
        if (mode !== 'photo') shownPhoto = '';
    }

    function render() {
        var mode = state.mode;
        setMode(mode);
        if (mode === 'home') byId('new-code-btn').focus();
        else if (mode === 'photo') renderPhoto();
        else if (mode === 'message') renderMessage(state.content.text);
        else if (mode === 'video') renderVideo(state.content);
        renderClocks();
    }

    // --- photos -----------------------------------------------------------------------------

    function currentPhoto() {
        var photos = state.photos;
        if (!photos.length) return '';
        var c = state.content;
        var index = c.index || 0;
        if (c.slideshow) index += Math.floor((now() - c.started) / (c.slideshow * 1000));
        return photos[((index % photos.length) + photos.length) % photos.length];
    }

    function renderPhoto() {
        var id = currentPhoto();
        if (!id || id === shownPhoto) return;
        shownPhoto = id;
        var url = '/api/screens/' + encodeURIComponent(state.code) + '/photos/' + encodeURIComponent(id);
        // Load it first, then fade it in over the last one.
        var img = new Image();
        img.onload = function () {
            if (shownPhoto !== id) return;
            var back = slideFront === 'photo-a' ? 'photo-b' : 'photo-a';
            byId(back).style.backgroundImage = 'url("' + url + '")';
            byId(back).className = 'photo-slide is-front';
            byId(slideFront).className = 'photo-slide';
            slideFront = back;
        };
        img.src = url;
        // The next slide, so it's ready in time.
        if (state.content.slideshow && state.photos.length > 1) {
            var next = state.photos[(indexOf(state.photos, id) + 1) % state.photos.length];
            new Image().src = '/api/screens/' + encodeURIComponent(state.code) + '/photos/' + encodeURIComponent(next);
        }
    }

    function indexOf(list, item) {
        for (var i = 0; i < list.length; i += 1) if (list[i] === item) return i;
        return -1;
    }

    // --- messages ---------------------------------------------------------------------------

    function renderMessage(text) {
        var el = byId('message-text');
        el.textContent = text;
        // Biggest size that fits: start large and step down.
        var box = byId('message');
        var size = Math.floor(Math.min(box.clientWidth / 4, box.clientHeight / 2.2));
        el.style.fontSize = size + 'px';
        while (size > 18 && (el.scrollHeight > box.clientHeight * 0.86 || el.scrollWidth > box.clientWidth * 0.92)) {
            size = Math.floor(size * 0.92);
            el.style.fontSize = size + 'px';
        }
    }

    // --- YouTube ----------------------------------------------------------------------------

    function videoCommand(func, args) {
        var frame = byId('video-frame');
        if (!frame || !frame.contentWindow) return;
        try {
            frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: args || [] }), '*');
        } catch (e) { /* the player isn't ready yet */ }
    }

    function sendVideoState(c) {
        videoCommand(c.muted ? 'mute' : 'unMute');
        videoCommand(c.playing ? 'playVideo' : 'pauseVideo');
    }

    function renderVideo(c) {
        if (c.youtube !== video.id || c.start !== video.start) {
            stopVideo();
            video = { id: c.youtube, start: c.start, command: c.command, restart: c.restart || 0 };
            var frame = document.createElement('iframe');
            frame.id = 'video-frame';
            frame.className = 'video-frame';
            frame.setAttribute('allow', 'autoplay; encrypted-media; fullscreen');
            frame.setAttribute('allowfullscreen', '');
            frame.setAttribute('title', 'YouTube video');
            frame.onload = function () {
                // Ask the player to listen, then repeat the phone's last request once it's ready.
                setTimeout(function () { sendVideoState(state.content); }, 1200);
            };
            frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(c.youtube) +
                '?autoplay=1&enablejsapi=1&playsinline=1&rel=0&start=' + (c.start || 0) +
                '&origin=' + encodeURIComponent(window.location.protocol + '//' + window.location.host);
            byId('video').appendChild(frame);
            frame.focus();
            return;
        }
        if (c.command !== video.command) {
            video.command = c.command;
            if ((c.restart || 0) !== video.restart) {
                video.restart = c.restart || 0;
                videoCommand('seekTo', [c.start || 0, true]);
            }
            sendVideoState(c);
        }
    }

    function stopVideo() {
        var box = byId('video');
        while (box.firstChild) box.removeChild(box.firstChild);
        video = { id: '', start: 0, command: -1, restart: 0 };
    }

    // --- timer and clock (redrawn several times a second) -----------------------------------

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function duration(ms) {
        var s = Math.ceil(ms / 1000);
        var h = Math.floor(s / 3600);
        var m = Math.floor((s % 3600) / 60);
        s %= 60;
        return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
    }

    function renderTimer() {
        var c = state.content;
        var left = c.remaining !== null && c.remaining !== undefined ? c.remaining : Math.max(0, c.ends - now());
        var text = byId('timer-text');
        var done = left <= 0;
        text.textContent = done ? "Time's up" : duration(left);
        byId('timer-note').textContent = c.remaining !== null && c.remaining !== undefined && !done ? 'Paused' : '';
        document.body.className = document.body.className.replace(/\s*timer-done/g, '') + (done ? ' timer-done' : '');
        var fraction = c.total ? Math.max(0, Math.min(1, left / (c.total * 1000))) : 0;
        byId('timer-fill').style.width = (fraction * 100).toFixed(2) + '%';
    }

    function renderClock() {
        var d = new Date(now());
        byId('clock-time').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
        byId('clock-date').textContent = DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    }

    function renderClocks() {
        if (!state) return;
        if (state.mode === 'timer') renderTimer();
        else if (state.mode === 'clock') renderClock();
        else if (state.mode === 'photo' && state.content.slideshow) renderPhoto();
    }

    // --- start ------------------------------------------------------------------------------

    function keepScreenOn() {
        try {
            if (navigator.wakeLock && navigator.wakeLock.request) {
                navigator.wakeLock.request('screen').then(function (lock) { wakeLock = lock; }, function () {});
            }
        } catch (e) { /* not supported: the TV's own settings decide */ }
    }

    function boot() {
        byId('home-url').textContent = window.location.host;
        byId('new-code-btn').onclick = endScreen;
        keepScreenOn();
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') keepScreenOn();
        });
        window.onresize = function () {
            if (state && state.mode === 'message') renderMessage(state.content.text);
        };

        screen = saved();
        if (screen) {
            showCode();
            poll();
        } else {
            newScreen();
        }
        setInterval(poll, POLL_MS);
        tick = setInterval(renderClocks, 250);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
