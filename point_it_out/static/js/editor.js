(function () {
    var IMAGE_BASE = '/pictures/';
    var $ = function (id) { return document.getElementById(id); };

    var state = { pictures: [], correct: 0, area: null };  // area in percent

    function round1(v) { return Math.round(v * 10) / 10; }
    function clampPct(v) { return Math.min(100, Math.max(0, v)); }

    function csvField(value) {
        value = String(value);
        return /[",\n\r]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
    }

    function updateOutput() {
        var area = state.area
            ? [state.area.left, state.area.top, state.area.width, state.area.height].map(round1).join(', ')
            : '';
        var fields = [
            $('ed-category').value.trim(),
            $('ed-question').value.trim(),
            state.pictures.join(' | '),
            state.pictures.length ? state.correct + 1 : '',
            area,
            $('ed-explanation').value.trim()
        ];
        $('ed-output').value = fields.map(csvField).join(',');

        ['left', 'top', 'width', 'height'].forEach(function (k) {
            var input = $('ed-' + k);
            if (document.activeElement !== input) input.value = state.area ? round1(state.area[k]) : '';
        });
    }

    function render() {
        var box = $('ed-pictures');
        box.innerHTML = '';
        box.className = 'pictures editor-pictures count-' + Math.min(Math.max(state.pictures.length, 1), 4);
        state.pictures.forEach(function (name, i) {
            var wrap = document.createElement('div');
            wrap.className = 'frame editor-frame' + (i === state.correct ? ' correct' : '');

            var inner = document.createElement('div');
            inner.className = 'frame-inner';
            var img = document.createElement('img');
            img.src = IMAGE_BASE + encodeURIComponent(name);
            img.alt = name;
            img.draggable = false;
            inner.appendChild(img);

            if (i === state.correct && state.area) {
                var areaBox = document.createElement('span');
                areaBox.className = 'answer-area';
                areaBox.style.left = state.area.left + '%';
                areaBox.style.top = state.area.top + '%';
                areaBox.style.width = state.area.width + '%';
                areaBox.style.height = state.area.height + '%';
                inner.appendChild(areaBox);
            }
            if (i === state.correct) {
                var tag = document.createElement('span');
                tag.className = 'frame-tag';
                tag.textContent = 'Correct';
                inner.appendChild(tag);
            }
            wrap.appendChild(inner);
            PictureFrame.fit(img, inner);

            var bar = document.createElement('div');
            bar.className = 'frame-bar';
            var label = document.createElement('span');
            label.textContent = (i + 1) + '. ' + name;
            var correctBtn = document.createElement('button');
            correctBtn.type = 'button';
            correctBtn.className = 'link-btn';
            correctBtn.textContent = i === state.correct ? 'Correct picture' : 'Make correct';
            correctBtn.disabled = i === state.correct;
            correctBtn.addEventListener('click', function () { setCorrect(i); });
            var remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'link-btn';
            remove.textContent = 'Remove';
            remove.setAttribute('aria-label', 'Remove ' + name);
            remove.addEventListener('click', function () {
                state.pictures.splice(i, 1);
                if (state.correct === i) { state.correct = 0; state.area = null; }
                else if (state.correct > i) state.correct -= 1;
                render();
            });
            bar.appendChild(label);
            bar.appendChild(correctBtn);
            bar.appendChild(remove);
            wrap.appendChild(bar);

            attachDrawing(inner, img, i);
            box.appendChild(wrap);
        });
        updateOutput();
    }

    function setCorrect(i) {
        if (state.correct !== i) state.area = null;
        state.correct = i;
        render();
    }

    // Click a picture to make it correct; drag on it to draw the answer area.
    function attachDrawing(inner, img, index) {
        var start = null;
        var preview = null;

        function pct(e) {
            var r = img.getBoundingClientRect();
            return { x: clampPct((e.clientX - r.left) / r.width * 100), y: clampPct((e.clientY - r.top) / r.height * 100) };
        }

        inner.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            start = pct(e);
            inner.setPointerCapture(e.pointerId);
        });
        inner.addEventListener('pointermove', function (e) {
            if (!start) return;
            var p = pct(e);
            if (!preview) {
                if (Math.abs(p.x - start.x) < 1 && Math.abs(p.y - start.y) < 1) return;
                inner.querySelectorAll('.answer-area').forEach(function (n) { n.remove(); });
                preview = document.createElement('span');
                preview.className = 'answer-area';
                inner.appendChild(preview);
            }
            preview.style.left = Math.min(start.x, p.x) + '%';
            preview.style.top = Math.min(start.y, p.y) + '%';
            preview.style.width = Math.abs(p.x - start.x) + '%';
            preview.style.height = Math.abs(p.y - start.y) + '%';
        });
        inner.addEventListener('pointerup', function (e) {
            if (!start) return;
            var p = pct(e);
            var dragged = preview !== null;
            var s = start;
            start = null;
            preview = null;
            if (dragged) {
                state.correct = index;
                state.area = {
                    left: Math.min(s.x, p.x), top: Math.min(s.y, p.y),
                    width: Math.abs(p.x - s.x), height: Math.abs(p.y - s.y)
                };
                render();
            } else {
                setCorrect(index);
            }
        });
        inner.addEventListener('pointercancel', function () { start = null; preview = null; render(); });
    }

    function readAreaInputs() {
        var v = {};
        var ok = ['left', 'top', 'width', 'height'].every(function (k) {
            var n = parseFloat($('ed-' + k).value);
            v[k] = clampPct(n);
            return isFinite(n);
        });
        if (ok && v.width > 0 && v.height > 0) {
            v.width = Math.min(v.width, 100 - v.left);
            v.height = Math.min(v.height, 100 - v.top);
            state.area = v;
            render();
        }
    }

    fetch('/api/images')
        .then(function (r) { return r.json(); })
        .then(function (names) {
            var select = $('ed-image-select');
            names.forEach(function (n) {
                var opt = document.createElement('option');
                opt.value = n;
                opt.textContent = n;
                select.appendChild(opt);
            });
        });

    $('ed-add').addEventListener('click', function () {
        var name = $('ed-image-select').value;
        if (!name) return;
        state.pictures.push(name);
        render();
    });
    $('ed-clear-area').addEventListener('click', function () { state.area = null; render(); });
    ['left', 'top', 'width', 'height'].forEach(function (k) {
        $('ed-' + k).addEventListener('change', readAreaInputs);
    });
    ['ed-category', 'ed-question', 'ed-explanation'].forEach(function (id) {
        $(id).addEventListener('input', updateOutput);
    });
    $('ed-copy').addEventListener('click', function () {
        var out = $('ed-output');
        var done = function () { $('ed-status').textContent = 'Copied.'; };
        if (navigator.clipboard) {
            navigator.clipboard.writeText(out.value).then(done, function () { out.select(); document.execCommand('copy'); done(); });
        } else {
            out.select();
            document.execCommand('copy');
            done();
        }
    });

    render();
})();
