// Trivia Flashcards: draws the board while it follows a phone remote (see remote-follow.js).
// ES5 for older smart-TV browsers. The server only sends the answer once it's shown.
(function () {
    'use strict';
    if (!window.RemoteFollow) return;

    function byId(id) { return document.getElementById(id); }

    window.RemoteFollow.start({
        render: function (state) {
            var stats = state.stats || {};
            byId('rv-stats').textContent = 'Remaining: ' + stats.remaining + ' | Used: ' + stats.used + ' | Total: ' + stats.total;

            var answer = byId('rv-answer');
            if (state.empty) {
                byId('rv-question').textContent = "That's every question. The quizmaster can reset them from the phone.";
                answer.textContent = '';
                answer.className = 'rv-answer is-empty';
                return;
            }
            byId('rv-question').textContent = state.question;
            if (state.revealed) {
                answer.textContent = state.answer;
                answer.className = 'rv-answer is-shown';
            } else {
                answer.textContent = 'Answer hidden';
                answer.className = 'rv-answer';
            }
        }
    });
})();
