// Trivia Flashcards: the quizmaster's phone remote (/host). Uses remote-host.js.
(function () {
    const $ = (id) => document.getElementById(id);

    function render(s) {
        const st = s.stats || {};
        $('host-stats').textContent = `Remaining: ${st.remaining} | Used: ${st.used} | Total: ${st.total}`;
        const reveal = $('host-reveal-btn');
        if (s.empty) {
            $('host-question').textContent = "That's every question.";
            $('host-answer').textContent = 'Reset all questions to play them again.';
            $('host-tv-state').textContent = '';
            reveal.disabled = $('host-eliminate-btn').disabled = $('host-skip-btn').disabled = true;
            return;
        }
        $('host-question').textContent = s.question;
        $('host-answer').textContent = s.answer;
        reveal.disabled = $('host-eliminate-btn').disabled = $('host-skip-btn').disabled = false;
        reveal.textContent = s.revealed ? 'Hide answer on TV' : 'Show answer on TV';
        reveal.className = s.revealed ? 'qn-skip' : 'qn-go';
        $('host-tv-state').textContent = s.revealed ? 'The answer is showing on the TV.' : 'The TV shows the question. The answer is hidden.';
    }

    $('host-reveal-btn').addEventListener('click', () => {
        const s = RemoteHost.state();
        RemoteHost.act(s && s.revealed ? 'hide' : 'reveal');
    });
    $('host-skip-btn').addEventListener('click', () => RemoteHost.act('skip'));
    $('host-eliminate-btn').addEventListener('click', () => RemoteHost.act('eliminate'));
    $('host-reset-btn').addEventListener('click', () => {
        if (confirm('Reset all questions? Eliminated questions come back into play.')) RemoteHost.act('reset');
    });

    RemoteHost.init({ render });
})();
