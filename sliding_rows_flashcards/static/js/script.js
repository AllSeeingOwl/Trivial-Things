document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const chainContainer = document.getElementById('chain-container');
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error-message');
    const navControls = document.getElementById('nav-controls');
    const nextChainBtn = document.getElementById('next-chain-button');
    const resetBtn = document.getElementById('reset-button');
    const practiceAgainBtn = document.getElementById('practice-again-btn');
    const emptyStateEl = document.getElementById('empty-state');
    const chainsRemainingEl = document.getElementById('chains-remaining');
    const chainsTotalEl = document.getElementById('chains-total');

    // State
    let currentChainId = null;
    let currentQuestions = [];
    let revealedAnswersCount = 0; // Tracks when all questions are fully revealed

    // Initialization
    function init() {
        loadNextChain();
        nextChainBtn.addEventListener('click', loadNextChain);
        resetBtn.addEventListener('click', resetAll);
        if (practiceAgainBtn) practiceAgainBtn.addEventListener('click', resetAll);

        // ⚡ Bolt Optimization: Event Delegation
        // Attach a single click and keydown listener to the parent container
        // instead of attaching them inside a loop for every row.
        chainContainer.addEventListener('click', handleRowInteraction);
        chainContainer.addEventListener('keydown', handleRowInteraction);
    }

    function handleRowInteraction(e) {
        const handleDiv = e.target.closest('.row-handle');
        if (!handleDiv) return;

        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') {
            return;
        }

        if (e.type === 'keydown') {
            e.preventDefault();
        }

        const rowDiv = handleDiv.closest('.sliding-row');
        if (!rowDiv) return;

        const statusText = handleDiv.querySelector('.row-status-text');
        if (!statusText) return;

        let currentState = parseInt(rowDiv.getAttribute('data-state') || '1', 10);

        if (currentState === 1) {
            // Transition to State 2: Question Revealed
            rowDiv.setAttribute('data-state', '2');
            rowDiv.classList.add('state-question');
            statusText.textContent = "Click for Answer";
            handleDiv.setAttribute('aria-expanded', 'true');
        } else if (currentState === 2) {
            // Transition to State 3: Answer Revealed
            rowDiv.setAttribute('data-state', '3');
            rowDiv.classList.remove('state-question');
            rowDiv.classList.add('state-answer');
            statusText.textContent = "✓ Answered"; // Avoid relying on color alone!

            revealedAnswersCount++;
            checkChainCompletion();
        }
        // If currentState === 3, do nothing on click.
    }

    // Update Stats UI
    function updateStats(data) {
        if (data && data.stats) {
            chainsTotalEl.textContent = data.stats.total;
            chainsRemainingEl.textContent = data.stats.remaining;
        }
    }

    // Load next unused chain
    async function loadNextChain() {
        // Hide controls, show loading
        chainContainer.textContent = '';
        navControls.classList.add('hidden');
        errorEl.classList.add('hidden');
        if (emptyStateEl) emptyStateEl.classList.add('hidden');
        loadingEl.classList.remove('hidden');
        currentChainId = null;
        currentQuestions = [];
        revealedAnswersCount = 0;

        try {
            const response = await fetch('/api/get_chain');
            loadingEl.classList.add('hidden');
            const data = await response.json();

            // Still update stats even if 404 since it's batched now
            updateStats(data);

            if (response.status === 404) {
                if (emptyStateEl) {
                    emptyStateEl.classList.remove('hidden');
                } else {
                    errorEl.textContent = "You've completed all available question chains!";
                    errorEl.classList.remove('hidden');
                }
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            currentChainId = data.chain_id;
            currentQuestions = data.questions;

            renderChain(currentQuestions);
        } catch (error) {
            loadingEl.classList.add('hidden');
            errorEl.textContent = "An error occurred while loading the question chain.";
            errorEl.classList.remove('hidden');
            console.error('Error:', error);
        }
    }

    // Reset everything
    async function resetAll() {
        if (!confirm("Are you sure you want to reset all progress? You will start over.")) {
            return;
        }

        const originalText = resetBtn.textContent;
        resetBtn.disabled = true;
        resetBtn.setAttribute('aria-busy', 'true');
        resetBtn.textContent = 'Resetting...';

        let practiceOriginalText = '';
        if (practiceAgainBtn) {
            practiceOriginalText = practiceAgainBtn.textContent;
            practiceAgainBtn.disabled = true;
            practiceAgainBtn.setAttribute('aria-busy', 'true');
            practiceAgainBtn.textContent = 'Resetting...';
        }

        try {
            const res = await fetch('/api/reset', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                updateStats(data);
                loadNextChain();
            }
        } catch (e) {
            console.error('Reset failed:', e);
        } finally {
            resetBtn.disabled = false;
            resetBtn.setAttribute('aria-busy', 'false');
            resetBtn.textContent = originalText;
            if (practiceAgainBtn) {
                practiceAgainBtn.disabled = false;
                practiceAgainBtn.setAttribute('aria-busy', 'false');
                practiceAgainBtn.textContent = practiceOriginalText;
            }
        }
    }

    // Render the DOM elements for the rows
    function renderChain(questions) {
        // ⚡ Bolt Optimization: DocumentFragment for DOM insertions
        // Batch DOM insertions using a DocumentFragment to prevent multiple reflows
        // and repaints during chain rendering.
        const fragment = document.createDocumentFragment();

        questions.forEach((q, index) => {
            // Container for the row
            const rowDiv = document.createElement('div');
            rowDiv.classList.add('sliding-row');
            // State 1: Hidden (default state, no state class added yet)
            rowDiv.setAttribute('data-state', '1');

            // The clickable handle (just shows the number initially)
            const handleDiv = document.createElement('div');
            handleDiv.classList.add('row-handle');
            handleDiv.setAttribute('role', 'button');
            handleDiv.setAttribute('tabindex', '0');
            handleDiv.setAttribute('aria-expanded', 'false');

            const numDiv = document.createElement('div');
            numDiv.classList.add('row-number');
            numDiv.textContent = q.order;

            const statusText = document.createElement('div');
            statusText.classList.add('row-status-text');
            statusText.textContent = "Click to reveal question";

            handleDiv.appendChild(numDiv);
            handleDiv.appendChild(statusText);

            // The sliding content area
            const contentDiv = document.createElement('div');
            contentDiv.classList.add('row-content');

            const questionEl = document.createElement('div');
            questionEl.classList.add('question-text');
            questionEl.textContent = q.question;

            const answerEl = document.createElement('div');
            answerEl.classList.add('answer-text');
            answerEl.textContent = q.answer;

            contentDiv.appendChild(questionEl);
            contentDiv.appendChild(answerEl);

            rowDiv.appendChild(handleDiv);
            rowDiv.appendChild(contentDiv);

            fragment.appendChild(rowDiv);
        });

        chainContainer.appendChild(fragment);
    }

    // Check if we reached the end of the line for this specific chain
    async function checkChainCompletion() {
        if (revealedAnswersCount === currentQuestions.length) {
            // Entire chain has been answered
            navControls.classList.remove('hidden');

            // Mark this chain as used in the backend
            try {
                const res = await fetch('/api/mark_used', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chain_id: currentChainId })
                });
                if (res.ok) {
                    const data = await res.json();
                    updateStats(data); // Refresh the counter with batched stats
                }
            } catch (error) {
                console.error('Failed to mark chain as used:', error);
            }
        }
    }

    // Run
    init();
});
