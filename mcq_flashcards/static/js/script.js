let currentQuestion = null;
let selectedChoice = false;

document.getElementById('flashcard').addEventListener('click', flipCard);
document.getElementById('flashcard').addEventListener('keydown', function(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        // Prevent intercepting Enter/Space key presses on child interactive elements (like MCQ buttons)
        if (event.target !== event.currentTarget) {
            return;
        }
        event.preventDefault();
        if (selectedChoice) flipCard();
    }
});

function flipCard() {
    const card = document.getElementById('flashcard');
    const backFace = document.getElementById('answer-text');

    card.classList.toggle('is-flipped');

    if (card.classList.contains('is-flipped')) {
        card.setAttribute('aria-expanded', 'true');
        backFace.setAttribute('aria-hidden', 'false');
    } else {
        card.setAttribute('aria-expanded', 'false');
        backFace.setAttribute('aria-hidden', 'true');
    }
}

function handleChoice(choiceStr, btnEl) {
    // Prevent multiple selections
    if (selectedChoice) return;
    selectedChoice = true;

    // Mark correct/incorrect styling directly
    const isCorrect = choiceStr === currentQuestion.answer;
    btnEl.style.backgroundColor = isCorrect ? 'var(--btn-success)' : 'var(--btn-danger)';
    btnEl.style.color = '#fff';

    // Append icon to innerText to avoid relying on color alone (WCAG 1.4.1)
    btnEl.textContent = choiceStr + (isCorrect ? ' ✓' : ' ✗');

    // Announce choice outcome via ARIA live
    const liveAnnouncer = document.getElementById('error-msg');
    liveAnnouncer.classList.remove('hidden');
    liveAnnouncer.style.color = 'transparent'; // Invisible to sighted users temporarily
    liveAnnouncer.textContent = isCorrect ? 'Correct!' : 'Incorrect.';

    setTimeout(() => {
        liveAnnouncer.textContent = '';
        liveAnnouncer.style.color = 'var(--btn-danger)';
        liveAnnouncer.classList.add('hidden');
    }, 2000);

    // Always show correct answer eventually or just flip the card
    setTimeout(() => {
        flipCard();
    }, 800);
}

async function fetchStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        document.getElementById('stats-container').textContent =
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
            document.getElementById('next-btn').classList.add('hidden');
            document.getElementById('eliminate-btn').classList.add('hidden');

            const errorEl = document.getElementById('error-msg');
            errorEl.textContent = data.error || "No more questions!";
            errorEl.classList.remove('hidden');
            return;
        }

        const data = await res.json();
        currentQuestion = data;

        document.getElementById('flashcard-container').classList.remove('hidden');
        document.getElementById('next-btn').classList.remove('hidden');
        document.getElementById('eliminate-btn').classList.remove('hidden');

        document.getElementById('question-text').textContent = data.question;
        document.getElementById('answer-text').textContent = data.answer;

        selectedChoice = false;

        const choicesContainer = document.getElementById('mcq-choices');
        choicesContainer.textContent = '';

        if (data.choices && data.choices.length > 0) {
            data.choices.forEach(choice => {
                const btn = document.createElement('button');
                btn.textContent = choice;
                btn.style.backgroundColor = 'rgba(255,255,255,0.2)';
                btn.style.color = '#fff';
                btn.style.border = '2px solid rgba(255,255,255,0.5)';
                btn.style.padding = '10px';
                btn.style.cursor = 'pointer';
                btn.style.borderRadius = '5px';
                btn.style.transition = 'all 0.2s';
                btn.onmouseover = () => { if(!selectedChoice) btn.style.backgroundColor = 'rgba(255,255,255,0.4)'; };
                btn.onmouseout = () => { if(!selectedChoice) btn.style.backgroundColor = 'rgba(255,255,255,0.2)'; };
                btn.onclick = (e) => {
                    e.stopPropagation(); // prevent flashcard click
                    handleChoice(choice, btn);
                };
                // Make keyboard accessible within choices
                btn.setAttribute('aria-label', `Select choice: ${choice}`);
                choicesContainer.appendChild(btn);
            });
        } else {
            const p = document.createElement('p');
            p.textContent = 'No choices available';
            choicesContainer.appendChild(p);
        }

        if (data.stats) {
            document.getElementById('stats-container').textContent =
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
