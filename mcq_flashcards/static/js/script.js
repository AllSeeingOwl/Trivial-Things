let currentQuestion = null;
let selectedChoice = false;

// ⚡ Bolt Optimization: Cache DOM Elements
// Cache frequently accessed DOM elements at the top level to prevent
// repetitive and expensive document.getElementById lookups during interactions.
const flashcardEl = document.getElementById('flashcard');
const answerTextEl = document.getElementById('answer-text');
const errorMsgEl = document.getElementById('error-msg');
const flashcardContainerEl = document.getElementById('flashcard-container');
const nextBtnEl = document.getElementById('next-btn');
const eliminateBtnEl = document.getElementById('eliminate-btn');
const questionTextEl = document.getElementById('question-text');
const choicesContainerEl = document.getElementById('mcq-choices');
const statsContainerEl = document.getElementById('stats-container');

flashcardEl.addEventListener('click', flipCard);
flashcardEl.addEventListener('keydown', function(event) {
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
    flashcardEl.classList.toggle('is-flipped');

    if (flashcardEl.classList.contains('is-flipped')) {
        flashcardEl.setAttribute('aria-expanded', 'true');
        answerTextEl.setAttribute('aria-hidden', 'false');
    } else {
        flashcardEl.setAttribute('aria-expanded', 'false');
        answerTextEl.setAttribute('aria-hidden', 'true');
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
    errorMsgEl.classList.remove('hidden');
    errorMsgEl.style.color = 'transparent'; // Invisible to sighted users temporarily
    errorMsgEl.textContent = isCorrect ? 'Correct!' : 'Incorrect.';

    setTimeout(() => {
        errorMsgEl.textContent = '';
        errorMsgEl.style.color = 'var(--btn-danger)';
        errorMsgEl.classList.add('hidden');
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
            nextBtnEl.classList.add('hidden');
            eliminateBtnEl.classList.add('hidden');

            const errorEl = document.getElementById('error-msg');
            errorEl.textContent = data.error || "No more questions!";
            errorEl.classList.remove('hidden');
            errorMsgEl.innerText = data.error || "No more questions!";
            errorMsgEl.classList.remove('hidden');
            return;
        }

        const data = await res.json();
        currentQuestion = data;

        flashcardContainerEl.classList.remove('hidden');
        nextBtnEl.classList.remove('hidden');
        eliminateBtnEl.classList.remove('hidden');

        document.getElementById('question-text').textContent = data.question;
        document.getElementById('answer-text').textContent = data.answer;

        selectedChoice = false;

        questionTextEl.innerText = data.question;
        answerTextEl.innerText = data.answer;

        selectedChoice = false;

        // Sentinel: Prevent DOM-based XSS by using textContent instead of innerHTML
        choicesContainerEl.textContent = '';

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
                choicesContainerEl.appendChild(btn);
            });
        } else {
            const p = document.createElement('p');
            p.textContent = 'No choices available';
            choicesContainerEl.appendChild(p);
        }

        if (data.stats) {
            statsContainerEl.innerText =
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
