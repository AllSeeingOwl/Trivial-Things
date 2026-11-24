// MCQ Flashcards: draws the board while it follows a phone remote (see remote-follow.js).
// ES5 for older smart-TV browsers. The server only says which choice is right once it's shown.
(function () {
    'use strict';
    if (!window.RemoteFollow) return;

    var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
    function byId(id) { return document.getElementById(id); }

    window.RemoteFollow.start({
        render: function (state) {
            var stats = state.stats || {};
            byId('rv-stats').textContent = 'Remaining: ' + stats.remaining + ' | Used: ' + stats.used + ' | Total: ' + stats.total;
            var list = byId('rv-choices');
            var result = byId('rv-result');
            list.textContent = '';
            if (state.empty) {
                byId('rv-question').textContent = "That's every question. The quizmaster can reset them from the phone.";
                result.textContent = '';
                return;
            }
            byId('rv-question').textContent = state.question;

            for (var i = 0; i < state.choices.length; i++) {
                var item = document.createElement('li');
                var cls = 'rv-choice';
                var mark = '';
                if (state.picked === i) cls += ' is-picked';
                if (state.revealed && state.correct === i) { cls += ' is-correct'; mark = ' ✓'; }
                else if (state.revealed && state.picked === i) { cls += ' is-wrong'; mark = ' ✗'; }
                item.className = cls;
                var letter = document.createElement('span');
                letter.className = 'rv-letter';
                letter.textContent = LETTERS[i] || String(i + 1);
                item.appendChild(letter);
                item.appendChild(document.createTextNode(state.choices[i] + mark));
                list.appendChild(item);
            }

            if (!state.revealed) {
                result.className = 'rv-result';
                result.textContent = state.picked === null || state.picked === undefined
                    ? 'Waiting for an answer'
                    : 'Answer ' + (LETTERS[state.picked] || state.picked + 1) + ' is locked in';
            } else if (state.picked === null || state.picked === undefined) {
                result.className = 'rv-result is-shown';
                result.textContent = 'The answer is ' + (LETTERS[state.correct] || '') + ': ' + state.choices[state.correct];
            } else if (state.picked === state.correct) {
                result.className = 'rv-result is-right';
                result.textContent = 'Correct!';
            } else {
                result.className = 'rv-result is-wrong';
                result.textContent = 'Not quite. It was ' + (LETTERS[state.correct] || '') + ': ' + state.choices[state.correct];
            }
        }
    });
})();
