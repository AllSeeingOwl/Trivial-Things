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
    }
}

function renderGrid() {
    if (!currentGridData) return;

    gridContainer.innerHTML = '';

    // Header Row
    gridContainer.appendChild(createCell('', 'header'));
    for (let i = 1; i <= 6; i++) {
        gridContainer.appendChild(createCell(i, 'header'));
    }

    // Data Rows
    currentGridData.forEach((row, rowIndex) => {
        gridContainer.appendChild(createCell(rowIndex + 1, 'header'));

        row.forEach((word, colIndex) => {
            const cell = createCell(word, 'word-cell');
            // Initially hide the word (could show coordinate like A1, B2 instead, or just mask)
            cell.textContent = `Word ${rowIndex + 1}-${colIndex + 1}`;
            cell.dataset.word = word;

            function revealCell(element) {
                element.textContent = element.dataset.word;
                element.classList.add('revealed');
                currentWord = element.dataset.word;
                updateChallenge();
            }

            cell.addEventListener('click', function() {
                revealCell(this);
            });

            cell.addEventListener('keydown', function(event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    revealCell(this);
                }
            });

            gridContainer.appendChild(cell);
        });
    });
}

function createCell(content, className) {
    const div = document.createElement('div');
    div.className = `cell ${className}`;
    div.textContent = content;
    if (className.includes('word-cell')) {
        div.setAttribute('tabindex', '0');
        div.setAttribute('role', 'button');
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
