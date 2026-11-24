// Sliding Rows: draws the board while it follows a phone remote (see remote-follow.js).
// ES5 for older smart-TV browsers. The server only sends each question and answer once shown.
(function () {
    'use strict';
    if (!window.RemoteFollow) return;

    function byId(id) { return document.getElementById(id); }
    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }

    window.RemoteFollow.start({
        render: function (state) {
            var stats = state.stats || {};
            byId('rv-stats').textContent = 'Chains remaining: ' + stats.remaining + '/' + stats.total;
            var list = byId('rv-rows');
            list.textContent = '';
            if (state.empty) {
                byId('rv-note').textContent = "That's every chain. The quizmaster can reset them from the phone.";
                return;
            }
            for (var i = 0; i < state.rows.length; i++) {
                var row = state.rows[i];
                var item = el('li', 'rv-row' + (row.state === 1 ? ' is-question' : '') + (row.state === 2 ? ' is-answer' : ''));
                item.appendChild(el('span', 'rv-num', String(i + 1)));
                item.appendChild(el('span', 'rv-q', row.state >= 1 ? row.question : ''));
                item.appendChild(el('span', 'rv-a', row.state === 2 ? row.answer : (row.state === 1 ? '?' : '')));
                list.appendChild(item);
            }
            byId('rv-note').textContent = state.complete ? 'Chain complete!' : '';
        }
    });
})();
