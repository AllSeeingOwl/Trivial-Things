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
            gridContainer.innerHTML = `<p style="color:red;" role="alert">Error: ${data.error || 'No grid data found.'}</p>`;
            gridContainer.style.display = 'block';
        }
    } catch (error) {
        console.error('Error uploading PDF:', error);
        gridContainer.innerHTML = `<p style="color:red;" role="alert">Upload failed.</p>`;
        gridContainer.style.display = 'block';
    } finally {
        loadingDiv.style.display = 'none';
        loadingDiv.setAttribute('aria-busy', 'false');
    }
});

resetBtn.addEventListener('click', renderGrid);

function renderGrid() {
    if (!currentGridData || currentGridData.length === 0) return;

    gridContainer.innerHTML = '';

    // Determine columns dynamically from the first row
    const numCols = currentGridData[0].length;
    gridContainer.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;
    gridContainer.style.display = 'grid';

    currentGridData.forEach((row, rowIndex) => {
        row.forEach((cellData, colIndex) => {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.textContent = cellData.text;
            cell.setAttribute('tabindex', '0');
            cell.setAttribute('role', 'button');
            cell.dataset.status = cellData.status;

            function revealCell(element) {
                if (element.dataset.status === 'correct') {
                    element.classList.add('correct');
                    element.setAttribute('aria-label', `${element.textContent} - Correct`);
                } else if (element.dataset.status === 'incorrect') {
                    element.classList.add('incorrect');
                    element.setAttribute('aria-label', `${element.textContent} - Incorrect`);
                }
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
