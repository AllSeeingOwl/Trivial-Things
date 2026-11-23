// A clickable picture that holds a pin. Used by the game.
// Coordinates are fractions (0 to 1) of the picture's width and height.
window.PictureFrame = (function () {
    var STEP = 0.01;
    var BIG_STEP = 0.05;

    function clamp(v) { return Math.min(1, Math.max(0, v)); }

    // Keep tall pictures on screen: cap the height at 60% of the window while
    // keeping the shape, so the pin and answer box still line up with the image.
    function fit(img, inner) {
        function apply() {
            if (img.naturalWidth && img.naturalHeight) {
                inner.style.maxWidth = 'calc(60vh * ' + (img.naturalWidth / img.naturalHeight).toFixed(4) + ')';
            }
        }
        if (img.complete) apply(); else img.addEventListener('load', apply);
    }

    function create(src, label, onPin) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'frame';
        button.setAttribute('aria-label', label);

        var inner = document.createElement('span');
        inner.className = 'frame-inner';
        var img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.draggable = false;
        var pin = document.createElement('span');
        pin.className = 'pin';
        pin.hidden = true;
        pin.setAttribute('aria-hidden', 'true');
        inner.appendChild(img);
        inner.appendChild(pin);
        button.appendChild(inner);
        fit(img, inner);

        var state = { x: null, y: null, disabled: false };

        function place(x, y) {
            state.x = clamp(x);
            state.y = clamp(y);
            pin.style.left = (state.x * 100) + '%';
            pin.style.top = (state.y * 100) + '%';
            pin.hidden = false;
            button.classList.add('pinned');
            button.setAttribute('aria-label', label + ', pin at ' + Math.round(state.x * 100) + '% across, ' + Math.round(state.y * 100) + '% down');
            onPin(state.x, state.y);
        }

        button.addEventListener('click', function (e) {
            if (state.disabled) return;
            if (e.detail === 0) {
                // Keyboard "click" (Enter or Space): drop the pin in the middle.
                if (state.x === null) place(0.5, 0.5); else onPin(state.x, state.y);
                return;
            }
            var rect = img.getBoundingClientRect();
            place((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
        });

        button.addEventListener('keydown', function (e) {
            if (state.disabled) return;
            var moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
            var m = moves[e.key];
            if (!m) return;
            e.preventDefault();
            var step = e.shiftKey ? BIG_STEP : STEP;
            var x = state.x === null ? 0.5 : state.x;
            var y = state.y === null ? 0.5 : state.y;
            place(x + m[0] * step, y + m[1] * step);
        });

        return {
            el: button,
            clearPin: function () {
                state.x = state.y = null;
                pin.hidden = true;
                button.classList.remove('pinned');
                button.setAttribute('aria-label', label);
            },
            disable: function () {
                state.disabled = true;
                button.classList.add('locked');
                button.setAttribute('aria-disabled', 'true');
            },
            showArea: function (area) {
                var box = document.createElement('span');
                box.className = 'answer-area';
                box.setAttribute('aria-hidden', 'true');
                box.style.left = (area.left * 100) + '%';
                box.style.top = (area.top * 100) + '%';
                box.style.width = (area.width * 100) + '%';
                box.style.height = (area.height * 100) + '%';
                inner.appendChild(box);
            },
            mark: function (cls, text) {
                button.classList.add(cls);
                if (text) {
                    var tag = document.createElement('span');
                    tag.className = 'frame-tag';
                    tag.textContent = text;
                    inner.appendChild(tag);
                }
            }
        };
    }

    return { create: create, fit: fit };
})();
