(function () {
    var IMAGE_BASE = '/pictures/';
    var VERDICT_TEXT = { correct: 'Spot on!', close: 'So close!', wrong: 'Not quite.', timeout: "Time's up!" };
    var TEAMS_KEY = 'point-it-out-teams';
    var MAX_TEAMS = 8;
    var ADJUST_STEP = 5;
    var WARNING_SECONDS = 5;

    var els = {};
    ['start-screen', 'game-screen', 'end-screen', 'round-select', 'round-label', 'timer-select', 'start-btn',
     'start-message', 'team-setup', 'team-list', 'team-form', 'team-name', 'team-message', 'round-counter',
     'score-counter', 'turn-banner', 'current-category', 'current-question', 'current-hint', 'pictures',
     'result', 'lock-btn', 'next-btn', 'timer', 'timer-display', 'pause-btn', 'timer-announce', 'scoreboard',
     'scoreboard-list', 'final-line', 'standings', 'summary', 'end-title', 'play-again-btn'
    ].forEach(function (id) { els[id] = document.getElementById(id); });

    var teamNames = loadTeamNames();
    var game = newGame([], 'solo', [], 0);
    var timer = { remaining: 0, deadline: 0, interval: null, paused: false };

    function newGame(questions, mode, names, seconds) {
        return {
            questions: questions, mode: mode, seconds: seconds,
            teams: names.map(function (n) { return { name: n, score: 0 }; }),
            round: 0, score: 0, frames: [], choice: null, history: [], setOrders: {}, answering: false
        };
    }

    // --- Team names (remembered between visits) ---------------------------

    function loadTeamNames() {
        try {
            var saved = JSON.parse(localStorage.getItem(TEAMS_KEY) || '[]');
            return Array.isArray(saved) ? saved.filter(function (n) { return typeof n === 'string' && n.trim(); }).slice(0, MAX_TEAMS) : [];
        } catch (e) {
            return [];
        }
    }

    function saveTeamNames() {
        try { localStorage.setItem(TEAMS_KEY, JSON.stringify(teamNames)); } catch (e) { /* private mode */ }
    }

    function renderTeamList() {
        els['team-list'].innerHTML = '';
        teamNames.forEach(function (name, i) {
            var li = document.createElement('li');
            var span = document.createElement('span');
            span.textContent = name;
            var remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'link-btn';
            remove.textContent = 'Remove';
            remove.setAttribute('aria-label', 'Remove ' + name);
            remove.addEventListener('click', function () {
                teamNames.splice(i, 1);
                saveTeamNames();
                renderTeamList();
                els['team-message'].textContent = name + ' removed.';
                els['team-name'].focus();
            });
            li.appendChild(span);
            li.appendChild(remove);
            els['team-list'].appendChild(li);
        });
        var full = teamNames.length >= MAX_TEAMS;
        els['team-name'].disabled = full;
        els['team-form'].querySelector('button').disabled = full;
    }

    els['team-form'].addEventListener('submit', function (e) {
        e.preventDefault();
        var name = els['team-name'].value.trim().replace(/\s+/g, ' ');
        if (!name) return;
        var clash = teamNames.some(function (n) { return n.toLowerCase() === name.toLowerCase(); });
        if (clash) {
            els['team-message'].textContent = 'There is already a team called ' + name + '.';
            return;
        }
        teamNames.push(name);
        saveTeamNames();
        renderTeamList();
        els['team-name'].value = '';
        els['team-message'].textContent = name + ' added. ' + teamNames.length + ' team' + (teamNames.length === 1 ? '' : 's') + ' so far.';
        if (!els['team-name'].disabled) els['team-name'].focus();
    });

    function selectedMode() {
        return document.querySelector('input[name="mode"]:checked').value;
    }

    function updateModeUI() {
        var teams = selectedMode() === 'teams';
        els['team-setup'].hidden = !teams;
        els['round-label'].textContent = teams ? 'Questions per team:' : 'Number of rounds:';
        els['start-message'].textContent = '';
    }
    document.querySelectorAll('input[name="mode"]').forEach(function (r) { r.addEventListener('change', updateModeUI); });

    // --- Screens and stats -------------------------------------------------

    function show(screenId) {
        ['start-screen', 'game-screen', 'end-screen'].forEach(function (id) {
            els[id].classList.toggle('active', id === screenId);
        });
    }

    function isTeams() { return game.mode === 'teams'; }

    function currentTeam() { return game.teams[game.round % game.teams.length]; }

    function updateStats() {
        if (!game.questions.length) {
            els['round-counter'].textContent = '';
            els['score-counter'].textContent = '';
            return;
        }
        els['round-counter'].textContent = 'Round ' + Math.min(game.round + 1, game.questions.length) + ' / ' + game.questions.length;
        els['score-counter'].textContent = isTeams() ? '' : 'Score: ' + game.score;
    }

    function renderScoreboard() {
        els['scoreboard'].hidden = !isTeams();
        if (!isTeams()) return;
        var current = game.round < game.questions.length ? currentTeam() : null;
        var list = els['scoreboard-list'];
        var scored = game.teams.some(function (t) { return t.score !== 0; });
        list.innerHTML = '';
        ranked().forEach(function (entry) {
            var team = entry.team;
            var li = document.createElement('li');
            li.className = 'score-row' + (team === current ? ' current' : '');
            if (team === current) li.setAttribute('aria-current', 'true');
            var rank = document.createElement('span');
            rank.className = 'score-rank';
            // No places until somebody has scored: "=1" for everyone is just noise.
            rank.textContent = scored ? entry.rank : '';
            var name = document.createElement('span');
            name.className = 'score-name';
            name.textContent = team.name;
            var pts = document.createElement('span');
            pts.className = 'score-points';
            pts.textContent = team.score;
            var minus = adjustButton(team, -ADJUST_STEP);
            var plus = adjustButton(team, ADJUST_STEP);
            [rank, name, pts, minus, plus].forEach(function (n) { li.appendChild(n); });
            list.appendChild(li);
        });
    }

    function adjustButton(team, amount) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'adjust-btn';
        b.textContent = (amount > 0 ? '+' : '−') + Math.abs(amount);
        b.setAttribute('aria-label', (amount > 0 ? 'Add ' : 'Take ') + Math.abs(amount) + ' points ' + (amount > 0 ? 'to ' : 'from ') + team.name);
        b.addEventListener('click', function () {
            team.score += amount;
            renderScoreboard();
            // Keep focus on the same button after the list re-sorts.
            var label = b.getAttribute('aria-label');
            var again = Array.prototype.find.call(els['scoreboard-list'].querySelectorAll('.adjust-btn'),
                function (n) { return n.getAttribute('aria-label') === label; });
            if (again) again.focus();
        });
        return b;
    }

    // Teams sorted by score, with joint places sharing a rank ("1", "=2", "=2", "4").
    function ranked() {
        var sorted = game.teams.map(function (t, i) { return { team: t, i: i }; })
            .sort(function (a, b) { return b.team.score - a.team.score || a.i - b.i; });
        return sorted.map(function (entry, pos) {
            var first = pos;
            while (first > 0 && sorted[first - 1].team.score === entry.team.score) first -= 1;
            var tied = sorted.filter(function (o) { return o.team.score === entry.team.score; }).length > 1;
            return { team: entry.team, place: first + 1, rank: (tied ? '=' : '') + (first + 1) };
        });
    }

    // --- Timer -------------------------------------------------------------

    function formatTime(s) {
        var m = Math.floor(s / 60);
        var sec = s % 60;
        return m + ':' + (sec < 10 ? '0' : '') + sec;
    }

    function drawTimer() {
        els['timer-display'].textContent = formatTime(timer.remaining);
        els['timer'].classList.toggle('warning', timer.remaining <= WARNING_SECONDS && timer.remaining > 0);
        els['timer'].classList.toggle('expired', timer.remaining === 0);
        els['timer'].classList.toggle('paused', timer.paused);
    }

    function startTimer() {
        stopTimer();
        els['timer'].hidden = !game.seconds;
        if (!game.seconds) return;
        timer.remaining = game.seconds;
        timer.paused = false;
        els['pause-btn'].textContent = 'Pause';
        els['pause-btn'].hidden = false;
        timer.deadline = Date.now() + timer.remaining * 1000;
        drawTimer();
        timer.interval = setInterval(tick, 200);
    }

    function tick() {
        if (timer.paused) return;
        var left = Math.max(0, Math.ceil((timer.deadline - Date.now()) / 1000));
        if (left === timer.remaining) return;
        timer.remaining = left;
        drawTimer();
        if (left === 10 || left === WARNING_SECONDS) els['timer-announce'].textContent = left + ' seconds left';
        if (left === 0) {
            stopTimer();
            els['timer-announce'].textContent = "Time's up";
            timeUp();
        }
    }

    function stopTimer() {
        if (timer.interval) clearInterval(timer.interval);
        timer.interval = null;
        els['pause-btn'].hidden = true;
    }

    els['pause-btn'].addEventListener('click', function () {
        if (!timer.interval) return;
        if (timer.paused) {
            timer.paused = false;
            timer.deadline = Date.now() + timer.remaining * 1000;
            els['pause-btn'].textContent = 'Pause';
            els['timer-announce'].textContent = 'Timer resumed';
        } else {
            timer.paused = true;
            els['pause-btn'].textContent = 'Resume';
            els['timer-announce'].textContent = 'Timer paused';
        }
        drawTimer();
    });

    // Out of time: lock in whatever pin is down, or reveal the answer for no points.
    function timeUp() {
        if (game.answering) return;
        if (game.choice) lockIn();
        else submit({ id: game.questions[game.round].id, timed_out: true });
    }

    // --- Playing -----------------------------------------------------------

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
        var mode = selectedMode();
        var names = mode === 'teams' ? teamNames.slice() : [];
        if (mode === 'teams' && names.length < 2) {
            els['start-message'].textContent = 'Add at least two teams first.';
            els['team-name'].focus();
            return;
        }
        var perTeam = parseInt(els['round-select'].value, 10);
        var count = mode === 'teams' ? perTeam * names.length : perTeam;
        var seconds = parseInt(els['timer-select'].value, 10) || 0;
        els['start-btn'].disabled = true;
        els['start-message'].textContent = '';
        fetch('/api/questions?count=' + encodeURIComponent(count))
            .then(function (r) { return r.json(); })
            .then(function (questions) {
                els['start-btn'].disabled = false;
                if (mode === 'teams') {
                    // Give every team the same number of turns.
                    questions = questions.slice(0, questions.length - questions.length % names.length);
                }
                if (!questions.length) {
                    els['start-message'].textContent = 'There aren’t enough questions for that. Add more to Point It Out.csv.';
                    return;
                }
                game = newGame(questions, mode, names, seconds);
                show('game-screen');
                renderRound();
            })
            .catch(function () {
                els['start-btn'].disabled = false;
                els['start-message'].textContent = 'Could not load questions. Is the server running?';
            });
    }

    // "Space · Solar System: question 2 of 4"
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
        game.answering = false;
        updateStats();
        renderScoreboard();

        els['turn-banner'].hidden = !isTeams();
        if (isTeams()) els['turn-banner'].textContent = currentTeam().name + ', it’s your turn';

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
        els['timer-announce'].textContent = '';

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

        startTimer();
        els['current-question'].focus();
    }

    function lockIn() {
        if (!game.choice || game.answering) return;
        var q = game.questions[game.round];
        submit({ id: q.id, picture: game.choice.picture, x: game.choice.x, y: game.choice.y });
    }

    function submit(payload) {
        if (game.answering) return;
        game.answering = true;
        stopTimer();
        els['lock-btn'].disabled = true;
        var q = game.questions[game.round];
        fetch('/api/answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(function (r) {
                if (!r.ok) throw new Error('bad response');
                return r.json();
            })
            .then(function (res) { showResult(q, res); })
            .catch(function () {
                game.answering = false;
                els['lock-btn'].disabled = !game.choice;
                els['result'].textContent = 'Could not check that answer. Try again.';
            });
    }

    function showResult(q, res) {
        var team = isTeams() ? currentTeam() : null;
        if (team) team.score += res.points;
        else game.score += res.points;
        game.history.push({ question: q.question, verdict: res.verdict, points: res.points, team: team && team.name });
        updateStats();
        renderScoreboard();

        game.frames.forEach(function (f) {
            f.disable();
            if (f.realIndex === res.correct_picture) {
                (res.areas || []).forEach(function (box) { f.showArea(box); });
                f.mark('correct', q.pictures.length > 1 ? 'Answer' : '');
            } else if (game.choice && f.realIndex === game.choice.picture && res.verdict !== 'timeout') {
                f.mark('wrong', team ? team.name + '’s pick' : 'Your pick');
            }
        });

        var result = els['result'];
        result.className = 'result ' + (res.verdict === 'timeout' ? 'wrong' : res.verdict);
        result.innerHTML = '';
        var title = document.createElement('p');
        title.className = 'verdict';
        var who = team ? team.name + ': ' : '';
        title.textContent = VERDICT_TEXT[res.verdict] + ' ' + who + '+' + res.points + ' point' + (res.points === 1 ? '' : 's');
        result.appendChild(title);
        if (res.explanation) {
            var p = document.createElement('p');
            p.textContent = res.explanation;
            result.appendChild(p);
        }

        els['lock-btn'].hidden = true;
        var last = game.round + 1 >= game.questions.length;
        if (last) els['next-btn'].textContent = isTeams() ? 'See the final scores' : 'See final score';
        else if (isTeams()) els['next-btn'].textContent = 'Next: ' + game.teams[(game.round + 1) % game.teams.length].name;
        else els['next-btn'].textContent = 'Next round';
        els['next-btn'].hidden = false;
        els['next-btn'].focus();
    }

    function next() {
        game.round += 1;
        if (game.round < game.questions.length) {
            renderRound();
            return;
        }
        finish();
    }

    function finish() {
        stopTimer();
        els['turn-banner'].hidden = true;
        var standings = els['standings'];
        standings.innerHTML = '';
        standings.hidden = !isTeams();
        if (isTeams()) {
            var places = ranked();
            var winners = places.filter(function (p) { return p.place === 1; }).map(function (p) { return p.team.name; });
            els['final-line'].textContent = winners.length === 1
                ? winners[0] + ' win!'
                : 'It’s a tie between ' + winners.slice(0, -1).join(', ') + ' and ' + winners[winners.length - 1] + '!';
            places.forEach(function (p) {
                var li = document.createElement('li');
                li.className = p.place === 1 ? 'winner' : '';
                var rank = document.createElement('span');
                rank.className = 'score-rank';
                rank.textContent = p.rank;
                var name = document.createElement('span');
                name.className = 'score-name';
                name.textContent = p.team.name;
                var pts = document.createElement('span');
                pts.className = 'score-points';
                pts.textContent = p.team.score + ' points';
                [rank, name, pts].forEach(function (n) { li.appendChild(n); });
                standings.appendChild(li);
            });
        } else {
            els['final-line'].textContent = 'Final score: ' + game.score + ' out of ' + game.questions.length * 10;
        }
        els['summary'].innerHTML = '';
        game.history.forEach(function (h) {
            var li = document.createElement('li');
            li.className = h.verdict === 'timeout' ? 'wrong' : h.verdict;
            li.textContent = (h.team ? h.team + ' — ' : '') + h.question + ': ' + VERDICT_TEXT[h.verdict] + ' (+' + h.points + ')';
            els['summary'].appendChild(li);
        });
        show('end-screen');
        els['end-title'].focus();
    }

    els['start-btn'].addEventListener('click', startGame);
    els['lock-btn'].addEventListener('click', lockIn);
    els['next-btn'].addEventListener('click', next);
    els['play-again-btn'].addEventListener('click', function () {
        game = newGame([], 'solo', [], 0);
        updateStats();
        renderTeamList();
        show('start-screen');
    });

    renderTeamList();
    updateModeUI();
})();
