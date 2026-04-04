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

loadBtn.addEventListener('click', loadGrid);
resetBtn.addEventListener('click', renderGrid);

// ⚡ Bolt Optimization: Event Delegation
// Attach a single listener to the parent container instead of O(N) listeners
// on every single cell. This prevents memory leaks on re-renders and reduces overhead.
function handleGridInteraction(event) {
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
    currentWord = element.dataset.word;
    updateChallenge();
}

modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        modeBtns.forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
        });
        e.target.classList.add('active');
        e.target.setAttribute('aria-pressed', 'true');
        currentMode = e.target.getAttribute('data-mode');
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

    let result = currentWord;

    if (currentMode === 'no-vowels' || currentMode === 'both') {
        result = result.replace(/[aeiouAEIOU]/g, '');
    }

    if (currentMode === 'backwards' || currentMode === 'both') {
        result = result.split('').reverse().join('');
    }

    // Format expected spelling with dashes between letters
    expectedSpellingEl.textContent = result.toUpperCase().split('').join('-');
}

// Load the first grid initially
if (gridSelect.options.length > 0) {
    loadGrid();
}
