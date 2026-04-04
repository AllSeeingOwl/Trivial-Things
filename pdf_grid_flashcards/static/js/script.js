const uploadForm = document.getElementById('upload-form');
const pdfFileInput = document.getElementById('pdf-file');
const resetBtn = document.getElementById('reset-btn');
const gridContainer = document.getElementById('grid');
const loadingDiv = document.getElementById('loading');

let currentGridData = null;

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = pdfFileInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const submitBtn = uploadForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';
    submitBtn.setAttribute('aria-busy', 'true');

    loadingDiv.style.display = 'block';
    loadingDiv.setAttribute('aria-busy', 'true');
    gridContainer.style.display = 'none';
    resetBtn.style.display = 'none';

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.grid && data.grid.length > 0) {
            currentGridData = data.grid;
            renderGrid();
            resetBtn.style.display = 'inline-block';
        } else {
            gridContainer.textContent = '';
            const errorMsg = document.createElement('p');
            errorMsg.style.color = 'red';
            errorMsg.setAttribute('role', 'alert');
            // Sentinel: Prevent DOM-based XSS by using textContent instead of innerHTML
            errorMsg.textContent = `Error: ${data.error || 'No grid data found.'}`;
            gridContainer.appendChild(errorMsg);
            gridContainer.style.display = 'block';
        }
    } catch (error) {
        console.error('Error uploading PDF:', error);
        gridContainer.textContent = '';
        const errorMsg = document.createElement('p');
        errorMsg.style.color = 'red';
        errorMsg.setAttribute('role', 'alert');
        errorMsg.textContent = 'Upload failed.';
        gridContainer.appendChild(errorMsg);
        gridContainer.style.display = 'block';
    } finally {
        loadingDiv.style.display = 'none';
        loadingDiv.setAttribute('aria-busy', 'false');

        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
        submitBtn.setAttribute('aria-busy', 'false');
    }
});

resetBtn.addEventListener('click', renderGrid);

// ⚡ Bolt Optimization: Event Delegation
// Attach a single listener to the parent container instead of O(N) listeners
// on every single cell. This prevents memory leaks on re-renders and reduces overhead.
function handleGridInteraction(event) {
    const cell = event.target.closest('.cell');
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
    // Prevent duplicate icons
    if (element.classList.contains('correct') || element.classList.contains('incorrect')) {
        return;
    }
    element.setAttribute('aria-expanded', 'true');
    if (element.dataset.status === 'correct') {
        element.classList.add('correct');
        element.textContent += ' ✓';
        element.setAttribute('aria-label', `${element.textContent} - Correct`);
    } else if (element.dataset.status === 'incorrect') {
        element.classList.add('incorrect');
        element.textContent += ' ✗';
        element.setAttribute('aria-label', `${element.textContent} - Incorrect`);
    }
}

function renderGrid() {
    if (!currentGridData || currentGridData.length === 0) return;

    gridContainer.textContent = '';

    // Determine columns dynamically from the first row
    const numCols = currentGridData[0].length;
    gridContainer.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;
    gridContainer.style.display = 'grid';

    // ⚡ Bolt Optimization: DocumentFragment for DOM insertions
    // Batch DOM insertions using a DocumentFragment to prevent multiple reflows
    // and repaints during grid rendering.
    const fragment = document.createDocumentFragment();

    currentGridData.forEach((row, rowIndex) => {
        row.forEach((cellData, colIndex) => {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.textContent = cellData.text;
            cell.setAttribute('tabindex', '0');
            cell.setAttribute('role', 'button');
            cell.setAttribute('aria-expanded', 'false');
            cell.dataset.status = cellData.status;

            fragment.appendChild(cell);
        });
    });

    gridContainer.appendChild(fragment);
}
