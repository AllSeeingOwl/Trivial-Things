// Phone remote, TV side: lets this board follow a quizmaster's phone.
// Canonical copy: shared/remote/remote-follow.js (copied into each app by tools/sync_shared.py).
//
// Written in ES5 with XMLHttpRequest so it runs in older smart-TV browsers; checked by
// `npm run check:tv` in tools/frontend.
//
// Usage, in this order on the board page:
//   <script src="remote-follow.js"></script>
//   <script src="remote-tv.js"></script>    // the app's renderer: RemoteFollow.start({ render: fn })
//   <script src="script.js"></script>       // the app's own board; it must do nothing when
//                                           // RemoteFollow.wanted() is true
// While following, the page is loaded as ?remote=CODE. Connecting and disconnecting reload the
// page, so the board's own script (which loads answers) never runs on a page that follows a
// phone, and answers never reach the TV before the quizmaster shows them.
(function () {
    'use strict';

    var POLL_MS = 1000;
    var code = readParam();
    var wakeLock = null;
    var timer = null;
    var busy = false;
    var version = -1;
    var render = null;

    function readParam() {
        var match = /[?&]remote=([^&#]*)/.exec(window.location.search);
        return match ? normalise(decodeURIComponent(match[1])) : '';
    }

    function normalise(value) {
        return String(value || '').replace(/\s+/g, '').toUpperCase();
    }

    function byId(id) { return document.getElementById(id); }

    function getJSON(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.timeout = 15000;
        xhr.onload = function () {
            var body = null;
            try { body = JSON.parse(xhr.responseText); } catch (e) { /* not JSON */ }
            callback(null, xhr.status, body);
        };
        xhr.onerror = function () { callback(new Error('network'), 0, null); };
        xhr.ontimeout = function () { callback(new Error('timeout'), 0, null); };
        xhr.send();
    }

    function plainPath() { return window.location.pathname; }

    function go(url) { window.location.replace(url); }

    function keepScreenOn() {
        try {
            if (navigator.wakeLock && navigator.wakeLock.request) {
                navigator.wakeLock.request('screen').then(function (lock) { wakeLock = lock; }, function () {});
            }
        } catch (e) { /* not supported: the TV's own settings decide */ }
    }

    function showForm(show, message) {
        var form = byId('remote-form');
        var openBtn = byId('remote-open-btn');
        if (!form || !openBtn) return;
        form.hidden = !show;
        openBtn.setAttribute('aria-expanded', show ? 'true' : 'false');
        byId('remote-message').textContent = message || '';
        if (show) byId('remote-code').focus();
    }

    function wireForm() {
        var openBtn = byId('remote-open-btn');
        if (!openBtn) return;
        var url = byId('remote-host-url');
        if (url) url.textContent = window.location.protocol + '//' + window.location.host + '/host';

        openBtn.addEventListener('click', function () { showForm(byId('remote-form').hidden, ''); });
        byId('remote-cancel-btn').addEventListener('click', function () {
            showForm(false, '');
            openBtn.focus();
        });
        byId('remote-form').addEventListener('submit', function (e) {
            e.preventDefault();
            var wantedCode = normalise(byId('remote-code').value);
            if (!/^[A-Z]{4}$/.test(wantedCode)) {
                byId('remote-message').textContent = 'Codes are four letters.';
                return;
            }
            byId('remote-message').textContent = 'Connecting…';
            getJSON('/api/rooms/' + encodeURIComponent(wantedCode), function (err, status) {
                if (status === 200) {
                    go(plainPath() + '?remote=' + encodeURIComponent(wantedCode));
                } else if (status === 404) {
                    byId('remote-message').textContent = "There's no remote with the code " + wantedCode +
                        '. Check the code on the phone.';
                } else {
                    byId('remote-message').textContent = "Couldn't reach the server. Try again.";
                }
            });
        });
        byId('remote-disconnect-btn').addEventListener('click', function () { go(plainPath()); });

        if (window.location.hash === '#remote-ended') {
            showForm(true, 'That remote has ended. Start a new one on the phone to carry on.');
        }
    }

    function poll() {
        if (busy) return;
        busy = true;
        getJSON('/api/rooms/' + encodeURIComponent(code), function (err, status, state) {
            busy = false;
            if (err || (status !== 200 && status !== 404)) return; // a blip, or the server waking up
            if (status === 404) {
                go(plainPath() + '#remote-ended');
                return;
            }
            if (state && state.version !== version) {
                version = state.version;
                if (render) render(state);
            }
        });
    }

    function follow() {
        document.body.className += ' remote-on';
        var view = byId('remote-view');
        if (view) view.hidden = false;
        var status = byId('remote-status');
        if (status) status.hidden = false;
        var codeEl = byId('remote-status-code');
        if (codeEl) codeEl.textContent = code;
        keepScreenOn();
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') keepScreenOn();
        });
        poll();
        timer = setInterval(poll, POLL_MS);
    }

    window.RemoteFollow = {
        // True when this page was opened to follow a phone (?remote=CODE).
        wanted: function () { return code !== ''; },
        // The app's renderer: render(state) is called whenever the room changes.
        start: function (options) {
            render = options && options.render;
        }
    };

    function boot() {
        wireForm();
        if (code) follow();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
