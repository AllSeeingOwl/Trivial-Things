let currentQuestion = null;

document.getElementById('flashcard').addEventListener('click', flipCard);
document.getElementById('flashcard').addEventListener('keydown', function(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        flipCard();
    }
});

function flipCard() {
    const card = document.getElementById('flashcard');
    const backFace = document.getElementById('answer-text');

    card.classList.toggle('is-flipped');

    // Manage focus and ARIA attributes for a11y
    if (card.classList.contains('is-flipped')) {
        card.setAttribute('aria-expanded', 'true');
        backFace.setAttribute('aria-hidden', 'false');
    } else {
        card.setAttribute('aria-expanded', 'false');
        backFace.setAttribute('aria-hidden', 'true');
    }
}

async function fetchStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        document.getElementById('stats-container').innerText =
            `Remaining: ${data.remaining} | Used: ${data.used} | Total: ${data.total}`;
    } catch (error) {
        console.error("Failed to load stats", error);
    }
}

async function loadNextQuestion() {
    const card = document.getElementById('flashcard');
    const backFace = document.getElementById('answer-text');

    if (card.classList.contains('is-flipped')) {
        card.classList.remove('is-flipped');
        card.setAttribute('aria-expanded', 'false');
        backFace.setAttribute('aria-hidden', 'true');
        // Wait for flip animation to finish before updating text
        await new Promise(r => setTimeout(r, 300));
    } else {
        card.setAttribute('aria-expanded', 'false');
        backFace.setAttribute('aria-hidden', 'true');
    }

    document.getElementById('error-msg').classList.add('hidden');

    try {
        const res = await fetch('/api/question');
        if (!res.ok) {
            const data = await res.json();
            document.getElementById('flashcard-container').classList.add('hidden');
            document.getElementById('flip-btn').classList.add('hidden');
            document.getElementById('next-btn').classList.add('hidden');
            document.getElementById('eliminate-btn').classList.add('hidden');

            const errorEl = document.getElementById('error-msg');
            errorEl.innerText = data.error || "No more questions!";
            errorEl.classList.remove('hidden');
            return;
        }

        const data = await res.json();
        currentQuestion = data;

        document.getElementById('flashcard-container').classList.remove('hidden');
        document.getElementById('flip-btn').classList.remove('hidden');
        document.getElementById('next-btn').classList.remove('hidden');
        document.getElementById('eliminate-btn').classList.remove('hidden');

        document.getElementById('question-text').innerText = data.question;
        document.getElementById('answer-text').innerText = data.answer;

        fetchStats();
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
