(function () {
    var IMAGE_BASE = '/pictures/';
    var VERDICT_TEXT = { correct: 'Spot on!', close: 'So close!', wrong: 'Not quite.' };

    var els = {};
    ['start-screen', 'game-screen', 'end-screen', 'round-select', 'start-btn', 'round-counter',
     'score-counter', 'current-category', 'current-question', 'current-hint', 'pictures', 'result',
     'lock-btn', 'next-btn', 'final-score', 'summary', 'end-title', 'play-again-btn'
    ].forEach(function (id) { els[id] = document.getElementById(id); });

    var game = { questions: [], round: 0, score: 0, frames: [], choice: null, history: [], setOrders: {} };

    function show(screenId) {
        ['start-screen', 'game-screen', 'end-screen'].forEach(function (id) {
            els[id].classList.toggle('active', id === screenId);
        });
    }

    function updateStats() {
        if (!game.questions.length) {
            els['round-counter'].textContent = '';
            els['score-counter'].textContent = '';
            return;
        }
        els['round-counter'].textContent = 'Round ' + Math.min(game.round + 1, game.questions.length) + ' / ' + game.questions.length;
        els['score-counter'].textContent = 'Score: ' + game.score;
    }

    function shuffled(n) {
        var order = [];
        for (var i = 0; i < n; i++) order.push(i);
        for (var j = n - 1; j > 0; j--) {
            var k = Math.floor(Math.random() * (j + 1));
            var t = order[j]; order[j] = order[k]; order[k] = t;
        }
        return order;
    }

    function startGame() {
        els['start-btn'].disabled = true;
        fetch('/api/questions?count=' + encodeURIComponent(els['round-select'].value))
            .then(function (r) { return r.json(); })
            .then(function (questions) {
                els['start-btn'].disabled = false;
                if (!questions.length) {
                    alert('No questions found. Check Point It Out.csv.');
                    return;
                }
                game = { questions: questions, round: 0, score: 0, frames: [], choice: null, history: [], setOrders: {} };
                show('game-screen');
                renderRound();
            })
            .catch(function () {
                els['start-btn'].disabled = false;
                alert('Could not load questions. Is the server running?');
            });
    }

    // "Consoles · Set: PlayStations, question 2 of 4"
    function categoryLine(q) {
        var parts = [];
        if (q.category) parts.push(q.category);
        if (q.set) {
            var inSet = game.questions.filter(function (o) { return o.set === q.set; });
            if (inSet.length > 1) {
                parts.push(q.set + ': question ' + (inSet.indexOf(q) + 1) + ' of ' + inSet.length);
            }
        }
        return parts.join(' · ');
    }

    function renderRound() {
        var q = game.questions[game.round];
        game.choice = null;
        game.frames = [];
        updateStats();

        els['current-category'].textContent = categoryLine(q);
        els['current-question'].textContent = q.question;
        els['current-hint'].textContent = q.mode === 'area'
            ? 'Point to the exact spot.'
            : 'Point to the right picture.';
        els['result'].textContent = '';
        els['result'].className = 'result';
        els['lock-btn'].hidden = false;
        els['lock-btn'].disabled = true;
        els['next-btn'].hidden = true;

        var container = els['pictures'];
        container.innerHTML = '';
        container.className = 'pictures count-' + Math.min(q.pictures.length, 4);

        // Show multiple pictures in a random order; remember each one's real index.
        // Questions in the same set keep the same order, so players aren't re-scanning.
        var order = q.set && game.setOrders[q.set];
        if (!order) {
            order = q.pictures.length > 1 ? shuffled(q.pictures.length) : [0];
            if (q.set) game.setOrders[q.set] = order;
        }
        order.forEach(function (realIndex, shownIndex) {
            var label = q.pictures.length > 1
                ? 'Picture ' + (shownIndex + 1) + ' of ' + q.pictures.length
                : 'The picture';
            var frame = PictureFrame.create(IMAGE_BASE + encodeURIComponent(q.pictures[realIndex]), label, function (x, y) {
                game.frames.forEach(function (f) { if (f !== frame) f.clearPin(); });
                game.choice = { picture: realIndex, x: x, y: y };
                els['lock-btn'].disabled = false;
            });
            frame.realIndex = realIndex;
            game.frames.push(frame);
            container.appendChild(frame.el);
        });

        els['current-question'].focus();
    }

    function lockIn() {
        if (!game.choice) return;
        var q = game.questions[game.round];
        els['lock-btn'].disabled = true;
        fetch('/api/answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: q.id, picture: game.choice.picture, x: game.choice.x, y: game.choice.y })
        })
            .then(function (r) {
                if (!r.ok) throw new Error('bad response');
                return r.json();
            })
            .then(function (res) { showResult(q, res); })
            .catch(function () {
                els['lock-btn'].disabled = false;
                els['result'].textContent = 'Could not check that answer. Try again.';
            });
    }

    function showResult(q, res) {
        game.score += res.points;
        game.history.push({ question: q.question, verdict: res.verdict, points: res.points });
        updateStats();

        game.frames.forEach(function (f) {
            f.disable();
            if (f.realIndex === res.correct_picture) {
                (res.areas || []).forEach(function (box) { f.showArea(box); });
                f.mark('correct', q.pictures.length > 1 ? 'Answer' : '');
            } else if (f.realIndex === game.choice.picture) {
                f.mark('wrong', 'Your pick');
            }
        });

        var result = els['result'];
        result.className = 'result ' + res.verdict;
        result.innerHTML = '';
        var title = document.createElement('p');
        title.className = 'verdict';
        title.textContent = VERDICT_TEXT[res.verdict] + ' +' + res.points + ' point' + (res.points === 1 ? '' : 's');
        result.appendChild(title);
        if (res.explanation) {
            var p = document.createElement('p');
            p.textContent = res.explanation;
            result.appendChild(p);
        }

        els['lock-btn'].hidden = true;
        var last = game.round + 1 >= game.questions.length;
        els['next-btn'].textContent = last ? 'See final score' : 'Next round';
        els['next-btn'].hidden = false;
        els['next-btn'].focus();
    }

    function next() {
        game.round += 1;
        if (game.round < game.questions.length) {
            renderRound();
            return;
        }
        var max = game.questions.length * 10;
        els['final-score'].textContent = game.score + ' out of ' + max;
        els['summary'].innerHTML = '';
        game.history.forEach(function (h) {
            var li = document.createElement('li');
            li.className = h.verdict;
            li.textContent = h.question + ': ' + VERDICT_TEXT[h.verdict] + ' (+' + h.points + ')';
            els['summary'].appendChild(li);
        });
        show('end-screen');
        els['end-title'].focus();
    }

    els['start-btn'].addEventListener('click', startGame);
    els['lock-btn'].addEventListener('click', lockIn);
    els['next-btn'].addEventListener('click', next);
    els['play-again-btn'].addEventListener('click', function () {
        game.questions = [];
        updateStats();
        show('start-screen');
    });
})();
