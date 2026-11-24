// MCQ Flashcards: the quizmaster's phone remote (/host). Uses remote-host.js.
(function () {
    const $ = (id) => document.getElementById(id);
    const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

    function render(s) {
        const st = s.stats || {};
        $('host-stats').textContent = `Remaining: ${st.remaining} | Used: ${st.used} | Total: ${st.total}`;
        const box = $('host-choices');
        box.textContent = '';
        const reveal = $('host-reveal-btn');
        if (s.empty) {
            $('host-question').textContent = "That's every question. Reset all questions to play them again.";
            $('host-tv-state').textContent = '';
            reveal.disabled = $('host-eliminate-btn').disabled = $('host-skip-btn').disabled = true;
            return;
        }
        $('host-question').textContent = s.question;
        reveal.disabled = s.revealed;
        $('host-eliminate-btn').disabled = $('host-skip-btn').disabled = false;

        s.choices.forEach((choice, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'host-choice';
            if (i === s.picked) b.classList.add('is-picked');
            if (i === s.correct) b.classList.add('is-correct');
            b.disabled = s.revealed;
            b.setAttribute('aria-pressed', i === s.picked ? 'true' : 'false');
            b.dataset.choice = String(i);
            b.textContent = `${LETTERS[i] || i + 1}. ${choice}${i === s.correct ? ' ✓' : ''}`;
            b.setAttribute('aria-label', `${LETTERS[i] || i + 1}, ${choice}${i === s.correct ? ', the right answer' : ''}`);
            box.appendChild(b);
        });

        if (s.revealed) {
            const right = s.picked === s.correct;
            $('host-tv-state').textContent = s.picked === null
                ? 'The TV shows the right answer.'
                : (right ? 'The TV shows: correct!' : 'The TV shows: not quite, with the right answer.');
        } else {
            $('host-tv-state').textContent = s.picked === null
                ? 'The TV shows the question and choices. Tap the team’s answer, then show it.'
                : `The TV shows answer ${LETTERS[s.picked]} locked in. The right answer is hidden.`;
        }
    }

    $('host-choices').addEventListener('click', (e) => {
        const b = e.target.closest('.host-choice');
        if (!b) return;
        const s = RemoteHost.state();
        const choice = parseInt(b.dataset.choice, 10);
        RemoteHost.act('pick', { choice: s && s.picked === choice ? null : choice });
    });
    $('host-reveal-btn').addEventListener('click', () => RemoteHost.act('reveal'));
    $('host-skip-btn').addEventListener('click', () => RemoteHost.act('skip'));
    $('host-eliminate-btn').addEventListener('click', () => RemoteHost.act('eliminate'));
    $('host-reset-btn').addEventListener('click', () => {
        if (confirm('Reset all questions? Eliminated questions come back into play.')) RemoteHost.act('reset');
    });

    RemoteHost.init({ render });
})();
