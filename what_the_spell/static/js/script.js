const gridSelect = document.getElementById('grid-select');
const loadBtn = document.getElementById('load-btn');
const resetBtn = document.getElementById('reset-btn');
const gridContainer = document.getElementById('grid');
const currentWordEl = document.getElementById('current-word');
const expectedSpellingEl = document.getElementById('expected-spelling');
const modeBtns = document.querySelectorAll('.mode-btn');

let currentGridData = null;
let currentMode = 'normal';
let currentWord = '';

// While the board follows a phone remote, this holds { code, version, timer, busy }.
let remote = null;

loadBtn.addEventListener('click', loadGrid);
resetBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to reset the board?")) {
        resetBtn.disabled = true;
        resetBtn.setAttribute('aria-busy', 'true');
        renderGrid();
        resetChallenge();
        setTimeout(() => {
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
    const cell = event.target.closest('.cell.word-cell');
    if (!cell) return;

    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') {
        return;
    }

    if (event.type === 'keydown') {
        event.preventDefault();
    }

    revealCell(cell);
}

gridContainer.addEventListener('click', handleGridInteraction);
gridContainer.addEventListener('keydown', handleGridInteraction);

function revealCell(element) {
    element.textContent = element.dataset.word;
    element.classList.add('revealed');
    element.setAttribute('aria-expanded', 'true');
    if (element.dataset.row && element.dataset.col) {
        element.setAttribute('aria-label', `${element.dataset.word}, row ${element.dataset.row}, column ${element.dataset.col}`);
    }
    currentWord = element.dataset.word;
    updateChallenge();
}

function setModeButtons(mode) {
    modeBtns.forEach(b => {
        const on = b.getAttribute('data-mode') === mode;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
}

modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (remote) return;
        currentMode = e.target.getAttribute('data-mode');
        setModeButtons(currentMode);
        updateChallenge();
    });
});

async function loadGrid() {
    const gridIdx = gridSelect.value;

    // Add loading state
    loadBtn.disabled = true;
    loadBtn.setAttribute('aria-busy', 'true');
    const originalText = loadBtn.textContent;
    loadBtn.textContent = 'Loading...';

    try {
        const response = await fetch(`/api/grid/${gridIdx}`);
        const data = await response.json();

        if (data.grid) {
            currentGridData = data.grid;
            renderGrid();
            resetChallenge();
        } else {
            alert('Error loading grid');
        }
    } catch (error) {
        console.error('Error fetching grid:', error);
    } finally {
        // Restore state
        loadBtn.disabled = false;
        loadBtn.setAttribute('aria-busy', 'false');
        loadBtn.textContent = originalText;
    }
}

function renderGrid() {
    if (!currentGridData) return;

    gridContainer.textContent = '';

    // ⚡ Bolt Optimization: DocumentFragment for DOM insertions
    // Batch DOM insertions using a DocumentFragment to prevent multiple reflows
    // and repaints during grid rendering.
    const fragment = document.createDocumentFragment();

    // Data Rows
    currentGridData.forEach((row, rowIndex) => {
        row.forEach((word, colIndex) => {
            const cell = createCell(word, 'word-cell');
            // Initially hide the word (could show coordinate like A1, B2 instead, or just mask)
            cell.textContent = `Word ${rowIndex + 1}-${colIndex + 1}`;
            cell.dataset.word = word;
            cell.dataset.row = rowIndex + 1;
            cell.dataset.col = colIndex + 1;
            cell.setAttribute('aria-label', `Reveal word at row ${rowIndex + 1}, column ${colIndex + 1}`);

            fragment.appendChild(cell);
        });
    });

    gridContainer.appendChild(fragment);
}

function createCell(content, className) {
    const div = document.createElement('div');
    div.className = `cell ${className}`;
    div.textContent = content;
    if (className.includes('word-cell')) {
        div.setAttribute('tabindex', '0');
        div.setAttribute('role', 'button');
        div.setAttribute('aria-expanded', 'false');
    }
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
    // Format expected spelling with dashes between letters
    expectedSpellingEl.textContent = window.WhatTheSpell.expectedSpelling(currentWord, currentMode);
}

// --- Phone remote: this board follows a quizmaster's phone ---------------------------------
// The server only ever sends this page words the quizmaster has shown, so a chosen word
// can't be seen here (or found in the page) until it is revealed.

const remoteOpenBtn = document.getElementById('remote-open-btn');
const remoteForm = document.getElementById('remote-form');
const remoteCodeInput = document.getElementById('remote-code');
const remoteMessage = document.getElementById('remote-message');
const remoteCancelBtn = document.getElementById('remote-cancel-btn');
const remoteStatus = document.getElementById('remote-status');
const remoteStatusCode = document.getElementById('remote-status-code');
const remoteDisconnectBtn = document.getElementById('remote-disconnect-btn');
const POLL_MS = 1000;

document.getElementById('remote-host-url').textContent = `${window.location.origin}/host`;

function showRemoteForm(show) {
    remoteForm.hidden = !show;
    remoteOpenBtn.setAttribute('aria-expanded', show ? 'true' : 'false');
    if (show) {
        remoteMessage.textContent = '';
        remoteCodeInput.focus();
    }
}

remoteOpenBtn.addEventListener('click', () => showRemoteForm(remoteForm.hidden));
remoteCancelBtn.addEventListener('click', () => {
    showRemoteForm(false);
    remoteOpenBtn.focus();
});

remoteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    connectRemote(remoteCodeInput.value.trim().toUpperCase(), true);
});

remoteDisconnectBtn.addEventListener('click', () => disconnectRemote(''));

async function fetchRemoteState(code) {
    const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function connectRemote(code, fromForm) {
    if (!/^[A-Z]{4}$/.test(code)) {
        remoteMessage.textContent = 'Codes are four letters.';
        return;
    }
    remoteMessage.textContent = 'Connecting…';
    let state;
    try {
        state = await fetchRemoteState(code);
    } catch (err) {
        remoteMessage.textContent = "Couldn't reach the server. Try again.";
        return;
    }
    if (!state) {
        remoteMessage.textContent = `There's no remote with the code ${code}. Check the code on the phone.`;
        if (!fromForm) showRemoteForm(true);
        return;
    }

    remote = { code: code, version: -1, timer: null, busy: false };
    document.body.classList.add('remote-on');
    showRemoteForm(false);
    remoteStatus.hidden = false;
    remoteStatusCode.textContent = code;
    modeBtns.forEach(b => { b.disabled = true; });
    const url = new URL(window.location.href);
    url.searchParams.set('remote', code);
    window.history.replaceState(null, '', url);

    renderRemote(state);
    remote.timer = setInterval(pollRemote, POLL_MS);
}

async function pollRemote() {
    if (!remote || remote.busy) return;
    remote.busy = true;
    try {
        const state = await fetchRemoteState(remote.code);
        if (!state) {
            disconnectRemote('That remote has ended. Start a new one on the phone to carry on.');
            return;
        }
        renderRemote(state);
    } catch (err) {
        // A blip (or a sleeping server waking up): keep trying.
    } finally {
        if (remote) remote.busy = false;
    }
}

function disconnectRemote(message) {
    if (remote && remote.timer) clearInterval(remote.timer);
    remote = null;
    document.body.classList.remove('remote-on');
    remoteStatus.hidden = true;
    modeBtns.forEach(b => { b.disabled = false; });
    setModeButtons(currentMode);
    const url = new URL(window.location.href);
    url.searchParams.delete('remote');
    window.history.replaceState(null, '', url);
    if (message) {
        showRemoteForm(true);
        remoteMessage.textContent = message;
    }
    loadGrid();
}

function renderRemote(state) {
    if (!remote || state.version === remote.version) return;
    remote.version = state.version;

    setModeButtons(state.mode);

    const chosenKey = state.chosen ? `${state.chosen[0]}-${state.chosen[1]}` : null;
    gridContainer.textContent = '';
    const fragment = document.createDocumentFragment();
    for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
            const key = `${r}-${c}`;
            const word = state.revealed[key];
            const cell = document.createElement('div');
            cell.className = 'cell word-cell remote-cell';
            const label = `row ${r + 1}, column ${c + 1}`;
            if (word) {
                cell.classList.add('revealed');
                cell.textContent = word;
                cell.setAttribute('aria-label', `${word}, ${label}`);
            } else {
                cell.textContent = `Word ${r + 1}-${c + 1}`;
                cell.setAttribute('aria-label', `Hidden word, ${label}`);
            }
            if (key === chosenKey) {
                cell.classList.add('chosen');
                cell.setAttribute('aria-current', 'true');
            }
            fragment.appendChild(cell);
        }
    }
    gridContainer.appendChild(fragment);

    if (chosenKey && state.chosen_revealed) {
        const word = state.revealed[chosenKey];
        currentWordEl.textContent = word;
        expectedSpellingEl.textContent = window.WhatTheSpell.expectedSpelling(word, state.mode);
    } else if (chosenKey) {
        currentWordEl.textContent = `Word ${state.chosen[0] + 1}-${state.chosen[1] + 1}`;
        expectedSpellingEl.textContent = 'hidden until the quizmaster shows it';
    } else {
        resetChallenge();
    }
}

// Join a remote straight away if the link carried a code (?remote=ABCD); otherwise
// load the first grid as usual.
const linkedCode = new URLSearchParams(window.location.search).get('remote');
if (linkedCode) {
    connectRemote(linkedCode.trim().toUpperCase(), false).then(() => {
        if (!remote && gridSelect.options.length > 0) loadGrid();
    });
} else if (gridSelect.options.length > 0) {
    loadGrid();
}
