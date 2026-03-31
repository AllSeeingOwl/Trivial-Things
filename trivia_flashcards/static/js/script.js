let currentQuestion = null;

// ⚡ Bolt Optimization: Cache DOM Elements
// Cache frequently accessed DOM elements at the top level to prevent
// repetitive and expensive document.getElementById lookups during interactions.
const flashcardEl = document.getElementById('flashcard');
const answerTextEl = document.getElementById('answer-text');
const errorMsgEl = document.getElementById('error-msg');
const flashcardContainerEl = document.getElementById('flashcard-container');
const flipBtnEl = document.getElementById('flip-btn');
const nextBtnEl = document.getElementById('next-btn');
const eliminateBtnEl = document.getElementById('eliminate-btn');
const questionTextEl = document.getElementById('question-text');
const statsContainerEl = document.getElementById('stats-container');

flashcardEl.addEventListener('click', flipCard);
flashcardEl.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        flipCard();
    }
});

function flipCard() {
    flashcardEl.classList.toggle('is-flipped');

    // Manage focus and ARIA attributes for a11y
    if (flashcardEl.classList.contains('is-flipped')) {
        flashcardEl.setAttribute('aria-expanded', 'true');
        answerTextEl.setAttribute('aria-hidden', 'false');
    } else {
        flashcardEl.setAttribute('aria-expanded', 'false');
        answerTextEl.setAttribute('aria-hidden', 'true');
    }
}

async function fetchStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        statsContainerEl.textContent =
            `Remaining: ${data.remaining} | Used: ${data.used} | Total: ${data.total}`;
    } catch (error) {
        console.error("Failed to load stats", error);
    }
}

async function loadNextQuestion() {
    if (flashcardEl.classList.contains('is-flipped')) {
        flashcardEl.classList.remove('is-flipped');
        flashcardEl.setAttribute('aria-expanded', 'false');
        answerTextEl.setAttribute('aria-hidden', 'true');
        // Wait for flip animation to finish before updating text
        await new Promise(r => setTimeout(r, 300));
    } else {
        flashcardEl.setAttribute('aria-expanded', 'false');
        answerTextEl.setAttribute('aria-hidden', 'true');
    }

    errorMsgEl.classList.add('hidden');

    try {
        const res = await fetch('/api/question');
        if (!res.ok) {
            const data = await res.json();
            flashcardContainerEl.classList.add('hidden');
            flipBtnEl.classList.add('hidden');
            nextBtnEl.classList.add('hidden');
            eliminateBtnEl.classList.add('hidden');

            errorMsgEl.textContent = data.error || "No more questions!";
            errorMsgEl.classList.remove('hidden');
            return;
        }

        const data = await res.json();
        currentQuestion = data;

        flashcardContainerEl.classList.remove('hidden');
        flipBtnEl.classList.remove('hidden');
        nextBtnEl.classList.remove('hidden');
        eliminateBtnEl.classList.remove('hidden');

        questionTextEl.textContent = data.question;
        answerTextEl.textContent = data.answer;

        if (data.stats) {
            statsContainerEl.textContent =
                `Remaining: ${data.stats.remaining} | Used: ${data.stats.used} | Total: ${data.stats.total}`;
        } else {
            fetchStats();
        }
    } catch (error) {
        console.error("Failed to load question", error);
    }
}

async function eliminateAndNext() {
    if (!currentQuestion) return;

    try {
        const res = await fetch('/api/mark_used', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: currentQuestion.id })
        });

        if (res.ok) {
            loadNextQuestion();
        }
    } catch (error) {
        console.error("Failed to mark question as used", error);
    }
}

async function resetAll() {
    if (!confirm("Are you sure you want to reset all questions? They will all become available again.")) {
        return;
    }

    try {
        const res = await fetch('/api/reset', { method: 'POST' });
        if (res.ok) {
            loadNextQuestion();
        }
    } catch (error) {
        console.error("Failed to reset questions", error);
    }
}

// Initialize
loadNextQuestion();
