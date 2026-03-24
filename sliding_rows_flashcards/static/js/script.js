document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const chainContainer = document.getElementById('chain-container');
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error-message');
    const navControls = document.getElementById('nav-controls');
    const nextChainBtn = document.getElementById('next-chain-button');
    const resetBtn = document.getElementById('reset-button');
    const chainsRemainingEl = document.getElementById('chains-remaining');
    const chainsTotalEl = document.getElementById('chains-total');

    // State
    let currentChainId = null;
    let currentQuestions = [];
    let revealedAnswersCount = 0; // Tracks when all questions are fully revealed

    // Initialization
    function init() {
        updateStats();
        loadNextChain();
        nextChainBtn.addEventListener('click', loadNextChain);
        resetBtn.addEventListener('click', resetAll);
    }

    // Fetch Stats
    async function updateStats() {
        try {
            const res = await fetch('/api/stats');
            if (res.ok) {
                const data = await res.json();
                chainsTotalEl.textContent = data.total;
                chainsRemainingEl.textContent = data.remaining;
            }
        } catch (e) {
            console.error('Failed to update stats:', e);
        }
    }

    // Load next unused chain
    async function loadNextChain() {
        // Hide controls, show loading
        chainContainer.innerHTML = '';
        navControls.classList.add('hidden');
        errorEl.classList.add('hidden');
        loadingEl.classList.remove('hidden');
        currentChainId = null;
        currentQuestions = [];
        revealedAnswersCount = 0;

        try {
            const response = await fetch('/api/get_chain');
            loadingEl.classList.add('hidden');

            if (response.status === 404) {
                errorEl.textContent = "You've completed all available question chains!";
                errorEl.classList.remove('hidden');
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
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
        try {
            const res = await fetch('/api/reset', { method: 'POST' });
            if (res.ok) {
                await updateStats();
                loadNextChain();
            }
        } catch (e) {
            console.error('Reset failed:', e);
        }
    }

    // Render the DOM elements for the rows
    function renderChain(questions) {
        questions.forEach((q, index) => {
            // Container for the row
            const rowDiv = document.createElement('div');
            rowDiv.classList.add('sliding-row');
            // State 1: Hidden (default state, no state class added yet)

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

            // Event listener for sliding logic
            let currentState = 1; // 1=Hidden, 2=Question, 3=Answer

            const advanceState = () => {
                if (currentState === 1) {
                    // Transition to State 2: Question Revealed
                    currentState = 2;
                    rowDiv.classList.add('state-question');
                    statusText.textContent = "Click for Answer";
                    handleDiv.setAttribute('aria-expanded', 'true');
                } else if (currentState === 2) {
                    // Transition to State 3: Answer Revealed
                    currentState = 3;
                    rowDiv.classList.remove('state-question');
                    rowDiv.classList.add('state-answer');
                    statusText.textContent = "✓ Answered"; // Avoid relying on color alone!

                    revealedAnswersCount++;
                    checkChainCompletion();
                }
                // If currentState === 3, do nothing on click.
            };

            // Support click and enter key for accessibility
            handleDiv.addEventListener('click', advanceState);
            handleDiv.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    advanceState();
                }
            });

            chainContainer.appendChild(rowDiv);
        });
    }

    // Check if we reached the end of the line for this specific chain
    async function checkChainCompletion() {
        if (revealedAnswersCount === currentQuestions.length) {
            // Entire chain has been answered
            navControls.classList.remove('hidden');

            // Mark this chain as used in the backend
            try {
                await fetch('/api/mark_used', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chain_id: currentChainId })
                });
                updateStats(); // Refresh the counter
            } catch (error) {
                console.error('Failed to mark chain as used:', error);
            }
        }
    }

    // Run
    init();
});
