// What The Spell: the board. This page is often shown on a TV, so it is written in ES5
// and uses XMLHttpRequest, which older smart-TV browsers understand.
// `npm run check:tv` in tools/frontend checks it against the TV browsers in tv-browsers.txt.
(function () {
    'use strict';

    var gridSelect = document.getElementById('grid-select');
    var loadBtn = document.getElementById('load-btn');
    var resetBtn = document.getElementById('reset-btn');
    var gridContainer = document.getElementById('grid');
    var currentWordEl = document.getElementById('current-word');
    var expectedSpellingEl = document.getElementById('expected-spelling');
    var modeBtns = toArray(document.querySelectorAll('.mode-btn'));

    var currentGridData = null;
    var currentMode = 'normal';
    var currentWord = '';

    // While the board follows a phone remote, this holds { code, version, timer, busy }.
    var remote = null;

    function toArray(list) { return Array.prototype.slice.call(list); }

    // GET a JSON URL. callback(error, status, body)
    function getJSON(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Cache-Control', 'no-store');
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

    // --- The board on its own ---------------------------------------------------------------

    loadBtn.addEventListener('click', loadGrid);
    resetBtn.addEventListener('click', function () {
        if (confirm('Are you sure you want to reset the board?')) {
            resetBtn.disabled = true;
            resetBtn.setAttribute('aria-busy', 'true');
            renderGrid();
            resetChallenge();
            setTimeout(function () {
                resetBtn.disabled = false;
                resetBtn.setAttribute('aria-busy', 'false');
            }, 150);
        }
    });

    // ⚡ Bolt Optimization: Event Delegation
    // Attach a single listener to the parent container instead of O(N) listeners
    // on every single cell. This prevents memory leaks on re-renders and reduces overhead.
    function handleGridInteraction(event) {
        if (remote) return; // the phone decides what is shown
        var cell = closestCell(event.target);
        if (!cell) return;
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ' &&
                event.keyCode !== 13 && event.keyCode !== 32) {
            return;
        }
        if (event.type === 'keydown') event.preventDefault();
        revealCell(cell);
    }

    function closestCell(el) {
        while (el && el !== gridContainer) {
            if (el.classList && el.classList.contains('word-cell')) return el;
            el = el.parentNode;
        }
        return null;
    }

    gridContainer.addEventListener('click', handleGridInteraction);
    gridContainer.addEventListener('keydown', handleGridInteraction);

    function revealCell(element) {
        element.textContent = element.getAttribute('data-word');
        element.classList.add('revealed');
        element.setAttribute('aria-expanded', 'true');
        element.setAttribute('aria-label', element.getAttribute('data-word') + ', row ' +
            element.getAttribute('data-row') + ', column ' + element.getAttribute('data-col'));
        currentWord = element.getAttribute('data-word');
        updateChallenge();
    }

    function setModeButtons(mode) {
        modeBtns.forEach(function (b) {
            var on = b.getAttribute('data-mode') === mode;
            if (on) b.classList.add('active'); else b.classList.remove('active');
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    modeBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (remote) return;
            currentMode = btn.getAttribute('data-mode');
            setModeButtons(currentMode);
            updateChallenge();
        });
    });

    function loadGrid() {
        var gridIdx = gridSelect.value;
        loadBtn.disabled = true;
        loadBtn.setAttribute('aria-busy', 'true');
        var originalText = loadBtn.textContent;
        loadBtn.textContent = 'Loading...';

        getJSON('/api/grid/' + encodeURIComponent(gridIdx), function (err, status, data) {
            loadBtn.disabled = false;
            loadBtn.setAttribute('aria-busy', 'false');
            loadBtn.textContent = originalText;
            if (err) {
                if (window.console) console.error('Error fetching grid:', err);
                return;
            }
            if (data && data.grid) {
                currentGridData = data.grid;
                renderGrid();
                resetChallenge();
            } else {
                alert('Error loading grid');
            }
        });
    }

    function renderGrid() {
        if (!currentGridData) return;
        gridContainer.textContent = '';

        // ⚡ Bolt Optimization: DocumentFragment for DOM insertions
        var fragment = document.createDocumentFragment();
        currentGridData.forEach(function (row, rowIndex) {
            row.forEach(function (word, colIndex) {
                var cell = createCell('word-cell');
                cell.textContent = 'Word ' + (rowIndex + 1) + '-' + (colIndex + 1);
                cell.setAttribute('data-word', word);
                cell.setAttribute('data-row', String(rowIndex + 1));
                cell.setAttribute('data-col', String(colIndex + 1));
                cell.setAttribute('aria-label', 'Reveal word at row ' + (rowIndex + 1) + ', column ' + (colIndex + 1));
                fragment.appendChild(cell);
            });
        });
        gridContainer.appendChild(fragment);
    }

    function createCell(className) {
        var div = document.createElement('div');
        div.className = 'cell ' + className;
        div.setAttribute('tabindex', '0');
        div.setAttribute('role', 'button');
        div.setAttribute('aria-expanded', 'false');
        return div;
    }

    function resetChallenge() {
        currentWord = '';
        currentWordEl.textContent = '---';
        expectedSpellingEl.textContent = '---';
    }

    function updateChallenge() {
        if (!currentWord) return;
        currentWordEl.textContent = currentWord;
        expectedSpellingEl.textContent = window.WhatTheSpell.expectedSpelling(currentWord, currentMode);
    }

    // --- Phone remote: this board follows a quizmaster's phone -------------------------------
    // The server only ever sends this page words the quizmaster has shown, and each remote
    // deals the words into its own hidden layout, so a chosen word can't be worked out here.

    var remoteOpenBtn = document.getElementById('remote-open-btn');
    var remoteForm = document.getElementById('remote-form');
    var remoteCodeInput = document.getElementById('remote-code');
    var remoteMessage = document.getElementById('remote-message');
    var remoteCancelBtn = document.getElementById('remote-cancel-btn');
    var remoteStatus = document.getElementById('remote-status');
    var remoteStatusCode = document.getElementById('remote-status-code');
    var remoteDisconnectBtn = document.getElementById('remote-disconnect-btn');
    var POLL_MS = 1000;
    var wakeLock = null;

    document.getElementById('remote-host-url').textContent =
        window.location.protocol + '//' + window.location.host + '/host';

    function showRemoteForm(show) {
        remoteForm.hidden = !show;
        remoteOpenBtn.setAttribute('aria-expanded', show ? 'true' : 'false');
        if (show) {
            remoteMessage.textContent = '';
            remoteCodeInput.focus();
        }
    }

    remoteOpenBtn.addEventListener('click', function () { showRemoteForm(remoteForm.hidden); });
    remoteCancelBtn.addEventListener('click', function () {
        showRemoteForm(false);
        remoteOpenBtn.focus();
    });
    remoteForm.addEventListener('submit', function (e) {
        e.preventDefault();
        connectRemote(normaliseCode(remoteCodeInput.value), true, null);
    });
    remoteDisconnectBtn.addEventListener('click', function () { disconnectRemote(''); });

    function normaliseCode(value) {
        return String(value || '').replace(/\s+/g, '').toUpperCase();
    }

    // Keeps the URL as ?remote=CODE while following, so a refresh rejoins.
    function setRemoteParam(code) {
        if (!window.history || !window.history.replaceState) return;
        var path = window.location.pathname + (code ? '?remote=' + encodeURIComponent(code) : '');
        window.history.replaceState(null, '', path + window.location.hash);
    }

    function readRemoteParam() {
        var match = /[?&]remote=([^&#]*)/.exec(window.location.search);
        return match ? normaliseCode(decodeURIComponent(match[1])) : '';
    }

    function keepScreenOn() {
        // Not every TV supports this; where it doesn't, the TV's own settings decide.
        try {
            if (navigator.wakeLock && navigator.wakeLock.request) {
                navigator.wakeLock.request('screen').then(function (lock) { wakeLock = lock; }, function () {});
            }
        } catch (e) { /* ignore */ }
    }

    function releaseScreen() {
        try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignore */ }
        wakeLock = null;
    }

    document.addEventListener('visibilitychange', function () {
        if (remote && document.visibilityState === 'visible') keepScreenOn();
    });

    function connectRemote(code, fromForm, done) {
        function finish() { if (done) done(); }
        if (!/^[A-Z]{4}$/.test(code)) {
            remoteMessage.textContent = 'Codes are four letters.';
            if (!fromForm) showRemoteForm(true);
            return finish();
        }
        remoteMessage.textContent = 'Connecting…';
        getJSON('/api/rooms/' + encodeURIComponent(code), function (err, status, state) {
            if (err || (status !== 200 && status !== 404)) {
                remoteMessage.textContent = "Couldn't reach the server. Try again.";
                if (!fromForm) showRemoteForm(true);
                return finish();
            }
            if (status === 404 || !state) {
                remoteMessage.textContent = "There's no remote with the code " + code + '. Check the code on the phone.';
                if (!fromForm) showRemoteForm(true);
                return finish();
            }

            remote = { code: code, version: -1, timer: null, busy: false };
            document.body.className += ' remote-on';
            showRemoteForm(false);
            remoteStatus.hidden = false;
            remoteStatusCode.textContent = code;
            modeBtns.forEach(function (b) { b.disabled = true; });
            setRemoteParam(code);
            keepScreenOn();

            renderRemote(state);
            remote.timer = setInterval(pollRemote, POLL_MS);
            remoteDisconnectBtn.focus();
            finish();
        });
    }

    function pollRemote() {
        if (!remote || remote.busy) return;
        remote.busy = true;
        var code = remote.code;
        getJSON('/api/rooms/' + encodeURIComponent(code), function (err, status, state) {
            if (!remote || remote.code !== code) return;
            remote.busy = false;
            if (err || (status !== 200 && status !== 404)) return; // a blip, or the server waking up: keep trying
            if (status === 404) {
                disconnectRemote('That remote has ended. Start a new one on the phone to carry on.');
                return;
            }
            renderRemote(state);
        });
    }

    function disconnectRemote(message) {
        if (remote && remote.timer) clearInterval(remote.timer);
        remote = null;
        releaseScreen();
        document.body.className = document.body.className.replace(/\s*\bremote-on\b/g, '');
        remoteStatus.hidden = true;
        modeBtns.forEach(function (b) { b.disabled = false; });
        setModeButtons(currentMode);
        setRemoteParam('');
        if (message) {
            showRemoteForm(true);
            remoteMessage.textContent = message;
        } else {
            remoteOpenBtn.focus();
        }
        loadGrid();
    }

    function renderRemote(state) {
        if (!remote || !state || state.version === remote.version) return;
        remote.version = state.version;
        setModeButtons(state.mode);

        var chosenKey = state.chosen ? state.chosen[0] + '-' + state.chosen[1] : null;
        var revealed = state.revealed || {};
        gridContainer.textContent = '';
        var fragment = document.createDocumentFragment();
        for (var r = 0; r < state.rows; r++) {
            for (var c = 0; c < state.cols; c++) {
                var key = r + '-' + c;
                var word = Object.prototype.hasOwnProperty.call(revealed, key) ? revealed[key] : null;
                var cell = document.createElement('div');
                cell.className = 'cell word-cell remote-cell';
                var label = 'row ' + (r + 1) + ', column ' + (c + 1);
                if (word) {
                    cell.className += ' revealed';
                    cell.textContent = word;
                    cell.setAttribute('aria-label', word + ', ' + label);
                } else {
                    cell.textContent = 'Word ' + (r + 1) + '-' + (c + 1);
                    cell.setAttribute('aria-label', 'Hidden word, ' + label);
                }
                if (key === chosenKey) {
                    cell.className += ' chosen';
                    cell.setAttribute('aria-current', 'true');
                }
                fragment.appendChild(cell);
            }
        }
        gridContainer.appendChild(fragment);

        if (chosenKey && state.chosen_revealed) {
            var shown = revealed[chosenKey];
            currentWordEl.textContent = shown;
            expectedSpellingEl.textContent = window.WhatTheSpell.expectedSpelling(shown, state.mode);
        } else if (chosenKey) {
            currentWordEl.textContent = 'Word ' + (state.chosen[0] + 1) + '-' + (state.chosen[1] + 1);
            expectedSpellingEl.textContent = 'hidden until the quizmaster shows it';
        } else {
            resetChallenge();
        }
    }

    // Join a remote straight away if the link carried a code (?remote=ABCD); otherwise
    // load the first grid as usual.
    var linkedCode = readRemoteParam();
    if (linkedCode) {
        connectRemote(linkedCode, false, function () {
            if (!remote && gridSelect.options.length > 0) loadGrid();
        });
    } else if (gridSelect.options.length > 0) {
        loadGrid();
    }
})();
