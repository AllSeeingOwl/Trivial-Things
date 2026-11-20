/* ASHWGA ("Ah shit, here we go again") cliché bingo. No backend: the card is rebuilt from the URL hash
 * (deck + seed, plus the squares themselves for a custom card), and marks are
 * kept in localStorage for that exact card.
 *
 * A card whose squares were edited (swapped, removed, added) carries its 24
 * squares in the link as `k`, so a friend gets exactly that card. Deck edits
 * (squares removed from or added to a deck) are this browser's own and only
 * shape the cards it deals from then on. */
(function () {
  'use strict';

  var DECKS = window.ASHWGA_DECKS || [];
  var SIZE = 5;
  var CENTRE = 12;
  var NEEDED = SIZE * SIZE - 1;
  var MAX_CUSTOM = 100;
  var MAX_LEN = 80;
  var MAX_ADDED = 50;
  var MAX_ALSO = 5;       // variations per square
  var MAX_ALSO_LEN = 60;
  var LINES = buildLines();

  var state = {
    deck: null,     // {id, title, free, squares, accent, blurb, custom}
    seed: '',
    cells: [],      // 25 strings; CENTRE is the free square
    marked: [],     // 25 booleans
    t0: 0,          // first mark (ms)
    t1: 0,          // full house (ms)
    celebrated: 0,  // 0 none, 1 first line, 2 full house
    focus: 0,
    picking: null,  // a square waiting for the player to tap where it goes
  };
  var suppressClick = false; // a press-and-hold just showed variations; don't also mark the square

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    decks: $('decks'), grid: $('grid'), title: $('deckTitle'), code: $('cardCode'),
    lines: $('lines'), timer: $('timer'), pct: $('pct'), meter: $('meter'), verdict: $('verdict'),
    banner: $('banner'), bannerTitle: $('bannerTitle'), bannerSub: $('bannerSub'),
    blurb: $('deckBlurb'), toast: $('toast'), announce: $('announce'),
    cTitle: $('cTitle'), cFree: $('cFree'), cSquares: $('cSquares'), cCount: $('cCount'), cPlay: $('cPlay'),
    customPanel: $('customPanel'),
    editPanel: $('editPanel'), eSummary: $('eSummary'), eNew: $('eNew'), eCard: $('eCard'), eRest: $('eRest'),
    eRemoved: $('eRemoved'), eRemovedWrap: $('eRemovedWrap'), eCardCount: $('eCardCount'), eRestCount: $('eRestCount'),
    pickHint: $('pickHint'), pickText: $('pickText'), alsoPop: $('alsoPop'),
  };

  /* ---------- helpers ---------- */

  function buildLines() {
    var out = [], r, c, row, col;
    for (r = 0; r < SIZE; r++) { row = []; for (c = 0; c < SIZE; c++) row.push(r * SIZE + c); out.push(row); }
    for (c = 0; c < SIZE; c++) { col = []; for (r = 0; r < SIZE; r++) col.push(r * SIZE + c); out.push(col); }
    var d1 = [], d2 = [];
    for (r = 0; r < SIZE; r++) { d1.push(r * SIZE + r); d2.push(r * SIZE + (SIZE - 1 - r)); }
    out.push(d1, d2);
    return out;
  }

  function hashString(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57, i, ch;
    for (i = 0; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0) * 4294967296 + (h1 >>> 0);
  }

  function rng(seed) {
    var a = hashString(seed) >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function newSeed() {
    var chars = 'abcdefghjkmnpqrstuvwxyz23456789', s = '', i;
    var buf = new Uint32Array(6);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (i = 0; i < 6; i++) s += chars[buf[i] % chars.length];
    return s;
  }

  function store(key, value) {
    try {
      if (value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* private mode or storage blocked: play on without saving */ }
  }
  function load(key) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }

  function b64urlEncode(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj)), bin = '', i;
    for (i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(str) {
    try {
      var b = str.replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      var bin = atob(b), bytes = new Uint8Array(bin.length), i;
      for (i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) { return null; }
  }

  function cleanSquare(s) {
    return String(s || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
  }

  function cleanSquares(list, cap) {
    var seen = {}, out = [];
    list.forEach(function (s) {
      var t = cleanSquare(s);
      var k = t.toLowerCase();
      if (t && !seen[k]) { seen[k] = true; out.push(t); }
    });
    return out.slice(0, cap || MAX_CUSTOM);
  }

  function lowerSet(list) {
    var set = {};
    list.forEach(function (t) { set[t.toLowerCase()] = true; });
    return set;
  }

  function sameList(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  /* ---------- variations ("close enough counts") ---------- */

  function cleanAlso(list) {
    return cleanSquares((Array.isArray(list) ? list : []).map(function (v) { return String(v || '').slice(0, MAX_ALSO_LEN); }), MAX_ALSO);
  }

  /* "Square | variation | variation" -> { text, also } */
  function splitLine(line) {
    var parts = String(line || '').split('|');
    return { text: cleanSquare(parts[0]), also: cleanAlso(parts.slice(1)) };
  }

  /* A {square: [variations]} map, keeping only squares in `allowed` and dropping empties. */
  function cleanAlsoMap(map, allowed) {
    var out = {}, ok = allowed ? lowerSet(allowed) : null;
    if (!map || typeof map !== 'object') return out;
    Object.keys(map).forEach(function (k) {
      var key = cleanSquare(k), vs = cleanAlso(map[k]);
      if (key && vs.length && (!ok || ok[key.toLowerCase()])) out[key] = vs;
    });
    return out;
  }

  function findAlso(map, text) {
    if (!map) return null;
    if (map[text]) return map[text];
    var lower = text.toLowerCase();
    for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k) && k.toLowerCase() === lower) return map[k];
    return null;
  }

  /* Other ways this square's cliché turns up: the deck's own list plus any the player added. */
  function alsoFor(text) {
    if (!state.deck) return [];
    var mine = findAlso(loadEdits(state.deck).v, text) || [];
    return cleanSquares((findAlso(state.deck.also, text) || []).concat(mine), MAX_ALSO * 2);
  }

  function withAlso(text, also) {
    return also && also.length ? text + ' | ' + also.join(' | ') : text;
  }

  function customDeck(data) {
    if (!data || !Array.isArray(data.q)) return null;
    var squares = cleanSquares(data.q);
    if (squares.length < NEEDED) return null;
    var free = String(data.f || 'Free square').trim().slice(0, 60) || 'Free square';
    return {
      id: 'custom', custom: true, accent: 'custom',
      title: String(data.t || 'My card').trim().slice(0, 40) || 'My card',
      free: free,
      squares: squares,
      also: cleanAlsoMap(data.v, squares.concat(free)),
      blurb: 'A card you made. Copy the card link to send it, squares and all, to a friend.',
    };
  }

  function customPayload(deck) {
    var p = { t: deck.title, f: deck.free, q: deck.squares };
    if (deck.also && Object.keys(deck.also).length) p.v = deck.also;
    return p;
  }

  function fmtTime(ms) {
    var s = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(s / 60), h = Math.floor(m / 60);
    s %= 60;
    if (h) return h + ':' + String(m % 60).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
  }

  /* Smooth scrolling only for people who haven't asked their system for reduced motion. */
  function scrollTo(elm) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    elm.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.toast.hidden = true; }, 2400);
  }

  function say(msg) {
    el.announce.textContent = '';
    setTimeout(function () { el.announce.textContent = msg; }, 30);
  }

  /* ---------- the card ---------- */

  function deckById(id) {
    for (var i = 0; i < DECKS.length; i++) if (DECKS[i].id === id) return DECKS[i];
    return null;
  }

  function hashFor(deck, seed, cells) {
    var h = 'd=' + encodeURIComponent(deck.id) + '&s=' + encodeURIComponent(seed);
    if (deck.custom) h += '&c=' + b64urlEncode(customPayload(deck));
    if (cells && !sameList(cells, buildCells(deck, seed))) {
      h += '&k=' + b64urlEncode(cells.filter(function (_, i) { return i !== CENTRE; }));
    }
    return h;
  }

  /* ---------- deck edits (this browser only) ---------- */

  function deckKey(deck) {
    return deck.custom ? 'custom:' + hashString(JSON.stringify(deck.squares) + deck.free).toString(36) : deck.id;
  }

  function loadEdits(deck) {
    var e = load('ashwga:edits:' + deckKey(deck)) || {};
    return {
      r: Array.isArray(e.r) ? cleanSquares(e.r, 500) : [],  // removed
      a: Array.isArray(e.a) ? cleanSquares(e.a, MAX_ADDED) : [],  // added
      v: cleanAlsoMap(e.v),  // the player's own variations
    };
  }

  function saveEdits(deck, e) {
    var any = e.r.length || e.a.length || Object.keys(e.v || {}).length;
    store('ashwga:edits:' + deckKey(deck), any ? e : undefined);
  }

  /* The squares new cards are dealt from: the deck, plus additions, minus removals. */
  function poolFor(deck, edits) {
    edits = edits || loadEdits(deck);
    var removed = lowerSet(edits.r);
    return cleanSquares(deck.squares.concat(edits.a), 1000).filter(function (t) { return !removed[t.toLowerCase()]; });
  }

  function storageKey() {
    var k = 'ashwga:v1:' + state.deck.id + ':' + state.seed;
    if (state.deck.custom) k += ':' + hashString(JSON.stringify(state.deck.squares) + state.deck.free).toString(36);
    return k;
  }

  /* Without a pool this is the card the seed alone describes (the one a link without `k` means). */
  function buildCells(deck, seed, pool) {
    pool = (pool || deck.squares).slice();
    var r = rng(deck.id + ':' + seed), i, j, tmp;
    for (i = pool.length - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
    pool = pool.slice(0, NEEDED);
    pool.splice(CENTRE, 0, deck.free);
    return pool;
  }

  function openCard(deck, seed, opts) {
    opts = opts || {};
    state.deck = deck;
    state.seed = seed;
    state.cells = opts.cells || buildCells(deck, seed);
    var saved = load(storageKey()) || {};
    // Marks saved for a different layout of this card don't belong to this one.
    if (!sameList(saved.cells || buildCells(deck, seed), state.cells)) saved = {};
    state.marked = state.cells.map(function (_, i) { return i === CENTRE || (saved.m || []).indexOf(i) !== -1; });
    state.t0 = saved.t0 || 0;
    state.t1 = saved.t1 || 0;
    state.celebrated = saved.c || 0;
    state.focus = Math.min(state.focus, 24);

    rememberCard();

    document.body.dataset.accent = deck.accent || 'showcase';
    el.title.textContent = deck.title;
    el.code.textContent = seed.toUpperCase();
    el.blurb.textContent = deck.blurb || '';
    document.title = 'ASHWGA: ' + deck.title + ' bingo';
    hideBanner();
    stopPicking();
    renderDecks();
    renderGrid();
    update(false);
    renderEditor();
    if (opts.announce) say(deck.title + ' card ' + seed.toUpperCase() + ' ready.');
  }

  /* Deal a fresh card from the deck as this browser has edited it. */
  function dealCard(deck, opts) {
    var seed = newSeed();
    openCard(deck, seed, Object.assign({ cells: buildCells(deck, seed, poolFor(deck)) }, opts || {}));
  }

  /* Put the card in the address bar and remember it, so switching decks comes back to it. */
  function rememberCard() {
    var h = hashFor(state.deck, state.seed, state.cells);
    if (location.hash.slice(1) !== h) history.replaceState(null, '', '#' + h);
    store('ashwga:last', h);
    if (!state.deck.custom) store('ashwga:lastcard:' + state.deck.id, h);
    else store('ashwga:custom', Object.assign(customPayload(state.deck), { s: state.seed, h: h }));
  }

  function save() {
    var m = [];
    state.marked.forEach(function (v, i) { if (v && i !== CENTRE) m.push(i); });
    var rec = { m: m, t0: state.t0, t1: state.t1, c: state.celebrated };
    if (!sameList(state.cells, buildCells(state.deck, state.seed))) rec.cells = state.cells;
    store(storageKey(), rec);
  }

  function score() {
    var done = 0, near = {};
    LINES.forEach(function (line) {
      var open = line.filter(function (i) { return !state.marked[i]; });
      if (open.length === 0) done++;
      else if (open.length === 1) near[open[0]] = true;
    });
    var count = state.marked.filter(Boolean).length - 1;
    return { lines: done, near: near, count: count, full: count === NEEDED };
  }

  /* ---------- rendering ---------- */

  function renderDecks() {
    var hadFocus = el.decks.contains(document.activeElement);
    el.decks.textContent = '';
    var list = DECKS.slice();
    var custom = state.deck && state.deck.custom ? state.deck : customDeck(load('ashwga:custom'));
    if (custom) list.push(custom);
    list.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'deck';
      b.textContent = d.custom ? d.title + ' (yours)' : d.title;
      b.style.setProperty('--dot', 'var(--a-' + (d.accent || 'custom') + ')');
      b.style.setProperty('--dotfill', 'var(--f-' + (d.accent || 'custom') + ')');
      b.setAttribute('aria-pressed', String(!!state.deck && state.deck.id === d.id));
      b.addEventListener('click', function () { switchDeck(d); });
      if (hadFocus && state.deck && state.deck.id === d.id) setTimeout(function () { b.focus(); }, 0);
      el.decks.appendChild(b);
    });
  }

  /* Bigger text for short squares, slightly smaller for long ones. */
  function sizeClass(text, free) {
    var n = text.length + (free ? 6 : 0); // the free square also carries a FREE label
    if (n <= 14) return ' short';
    if (n > 30) return ' long';
    return '';
  }

  /* Give wordier columns more width, so long squares wrap onto fewer lines
   * instead of shrinking. A column's demand mixes its average length, its
   * longest square and its longest single word (which can't wrap at all). */
  function columnTemplate(cells) {
    var cols = [], c, r;
    for (c = 0; c < SIZE; c++) {
      var lens = [], longestWord = 0;
      for (r = 0; r < SIZE; r++) {
        var t = cells[r * SIZE + c] + (r * SIZE + c === CENTRE ? ' FREE' : '');
        lens.push(t.length);
        t.split(/\s+/).forEach(function (w) { longestWord = Math.max(longestWord, w.length); });
      }
      var mean = lens.reduce(function (a, b) { return a + b; }, 0) / SIZE;
      var score = 0.6 * mean + 0.4 * Math.max.apply(null, lens);
      var weight = 0.85 + 0.5 * Math.min(1, Math.max(0, (score - 16) / 18));
      weight = Math.max(weight, Math.min(1.5, 0.7 + 0.05 * longestWord)); // 12 letters ~ 1.3
      cols.push('minmax(0,' + weight.toFixed(2) + 'fr)');
    }
    return cols.join(' ');
  }

  /* If a square's longest word is wider than the square, step its text
   * down until the word fits whole, rather than breaking it mid-word. Below
   * 8.5px it stops: very narrow phones let the word wrap (Safari hyphenates). */
  // Does the longest word fit? Each label is measured at its narrowest
  // (min-content, word breaking off) against the room inside the padding,
  // using fractional widths so a 1px overflow is not rounded away.
  var FIT_SPARE = 1; // px of room every word keeps, so tiny rendering differences between devices can't tip it over
  function overflows(b) {
    var cs = getComputedStyle(b);
    var room = b.getBoundingClientRect().width - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth) -
      parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var widest = 0, k, c;
    for (k = 0; k < b.children.length; k++) {
      c = b.children[k];
      c.style.width = 'min-content';
      widest = Math.max(widest, c.getBoundingClientRect().width);
      c.style.width = '';
    }
    return widest > room - FIT_SPARE;
  }

  function fitText() {
    var squares = el.grid.children, i, b, size, guard;
    for (i = 0; i < squares.length; i++) {
      b = squares[i];
      b.style.fontSize = '';
      b.classList.add('measuring');
      size = parseFloat(getComputedStyle(b).fontSize);
      guard = 0;
      while (overflows(b) && size - 0.5 >= 8.5 && guard++ < 20) {
        size -= 0.5;
        b.style.fontSize = size + 'px';
      }
      b.classList.remove('measuring');
    }
  }

  /* Press and hold (touch), hover (mouse) or ? (keyboard) shows a square's variations. */
  var press = null, hoverTimer = null;
  function clearPress() { if (press) { clearTimeout(press.t); press = null; } }
  function bindAlso(b, i) {
    b.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      clearPress();
      press = { x: e.clientX, y: e.clientY, t: setTimeout(function () {
        press = null;
        suppressClick = true;
        showAlso(i);
      }, 450) };
    });
    b.addEventListener('pointermove', function (e) {
      if (press && Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y) > 12) clearPress();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { b.addEventListener(ev, clearPress); });
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    b.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () { showAlso(i); }, 350);
    });
    b.addEventListener('pointerleave', function (e) {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(hoverTimer);
      // Give the pointer time to move onto the popover, so its text can be read under magnification.
      hoverTimer = setTimeout(function () { if (!el.alsoPop.matches(':hover')) hideAlso(); }, 300);
    });
  }

  function showAlso(i) {
    var also = alsoFor(state.cells[i]), sq = el.grid.children[i], pop = el.alsoPop;
    if (!also.length || !sq) return;
    pop.textContent = '';
    var head = document.createElement('b');
    head.textContent = 'Also counts';
    var ul = document.createElement('ul');
    also.forEach(function (v) { var li = document.createElement('li'); li.textContent = v; ul.appendChild(li); });
    pop.appendChild(head);
    pop.appendChild(ul);
    pop.hidden = false;
    pop.dataset.i = i;
    var t = document.getElementById('ticket').getBoundingClientRect(), r = sq.getBoundingClientRect();
    var w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.max(8, Math.min(r.left - t.left + r.width / 2 - w / 2, t.width - w - 8));
    var top = r.bottom - t.top + 6;
    if (top + h > t.height - 8) top = Math.max(8, r.top - t.top - h - 6);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function hideAlso() {
    if (el.alsoPop) el.alsoPop.hidden = true;
  }

  function renderGrid() {
    hideAlso();
    el.grid.textContent = '';
    document.getElementById('ticket').style.setProperty('--cols', columnTemplate(state.cells));
    state.cells.forEach(function (text, i) {
      var b = document.createElement('button');
      b.type = 'button';
      var also = alsoFor(text);
      b.className = 'sq' + (i === CENTRE ? ' free' : '') + sizeClass(text, i === CENTRE) + (also.length ? ' has-also' : '');
      b.dataset.i = i;
      b.tabIndex = i === state.focus ? 0 : -1;
      if (i === CENTRE) {
        var small = document.createElement('small');
        small.textContent = 'Free';
        b.appendChild(small);
        b.appendChild(document.createTextNode(' ')); // so the text reads "Free Name-drops…", not "FreeName-drops…"
        b.setAttribute('aria-disabled', 'true');
      }
      var span = document.createElement('span');
      span.textContent = text;
      b.appendChild(span);
      b.setAttribute('aria-pressed', String(state.marked[i]));
      b.addEventListener('click', function () {
        if (suppressClick) { suppressClick = false; return; }
        toggle(i);
      });
      if (also.length) bindAlso(b, i);
      b.addEventListener('keydown', onKey);
      b.addEventListener('focus', function () { setFocus(i, false); });
      el.grid.appendChild(b);
    });
    fitText();
  }

  function update(fromUser) {
    var s = score();
    var buttons = el.grid.children;
    var inLine = {};
    LINES.forEach(function (line) {
      if (line.every(function (i) { return state.marked[i]; })) line.forEach(function (i) { inLine[i] = true; });
    });
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', String(state.marked[i]));
      buttons[i].classList.toggle('near', !!s.near[i] && !s.full);
      buttons[i].classList.toggle('inline', !!inLine[i]);
      var also = alsoFor(state.cells[i]);
      // The name starts with the visible text (WCAG 2.5.3), so the free square leads with its "Free" label.
      var label = (i === CENTRE ? 'Free ' + state.cells[i] + ' (always marked)' : state.cells[i]) +
        (s.near[i] && !state.marked[i] ? ', would complete a line' : '') +
        (also.length ? '. Also counts: ' + also.join('; ') : '');
      buttons[i].setAttribute('aria-label', label);
    }

    el.lines.textContent = s.lines;
    var pct = Math.round((s.count / NEEDED) * 100);
    el.pct.textContent = pct + '%';
    el.meter.style.width = pct + '%';

    var nearCount = Object.keys(s.near).length;
    var v = '';
    el.verdict.classList.remove('near');
    if (s.full) v = 'Full house. Not one single surprise.';
    else if (s.lines >= 3) v = s.lines + ' lines. They are reading from the same script as everyone else.';
    else if (s.lines === 2) v = 'Two lines. This is getting embarrassing for them.';
    else if (s.lines === 1) v = 'Line! Ah shit, here we go again.';
    else if (nearCount) { v = 'One away from a line…'; el.verdict.classList.add('near'); }
    else if (s.count === 0) v = 'Waiting for the first cliché. It won’t be long.';
    el.verdict.textContent = v;

    tick();

    if (!fromUser) return;
    if (s.full && state.celebrated < 2) {
      state.celebrated = 2;
      showBanner('FULL HOUSE!', 'Every square, in ' + fmtTime(state.t1 - state.t0) + '.');
    } else if (s.lines > 0 && state.celebrated < 1) {
      state.celebrated = 1;
      showBanner('LINE!', 'Called it, ' + fmtTime(Date.now() - state.t0) + ' in.');
    } else if (s.lines === 0 && state.celebrated === 1) {
      state.celebrated = 0; // un-marked back below a line: allow the banner again
    }
    if (state.celebrated === 2 && !s.full) state.celebrated = s.lines ? 1 : 0;
    save();
  }

  function tick() {
    var end = state.t1 || Date.now();
    el.timer.textContent = state.t0 ? fmtTime(end - state.t0) : '0:00';
  }

  function showBanner(title, sub) {
    el.bannerTitle.textContent = title;
    el.bannerSub.textContent = sub;
    el.banner.hidden = false;
    el.banner.classList.remove('pop');
    void el.banner.offsetWidth;
    el.banner.classList.add('pop');
    $('bannerClose').focus({ preventScroll: true });
  }
  function hideBanner() { el.banner.hidden = true; }

  /* ---------- actions ---------- */

  function toggle(i) {
    if (i === CENTRE) return;
    if (state.picking) { placePicked(i); return; }
    state.marked[i] = !state.marked[i];
    if (state.marked[i] && !state.t0) state.t0 = Date.now();
    var s = score();
    if (s.full && !state.t1) state.t1 = Date.now();
    if (!s.full) state.t1 = 0;
    if (s.count === 0) state.t0 = 0;
    setFocus(i, false);
    update(true);
    if (el.editPanel.open) renderEditor();
  }

  function setFocus(i, move) {
    var buttons = el.grid.children;
    if (buttons[state.focus]) buttons[state.focus].tabIndex = -1;
    state.focus = i;
    if (buttons[i]) { buttons[i].tabIndex = 0; if (move) buttons[i].focus(); }
  }

  function onKey(e) {
    var i = state.focus, r = Math.floor(i / SIZE), c = i % SIZE;
    if (e.key === '?' || e.key === 'i') {
      e.preventDefault();
      if (!el.alsoPop.hidden && el.alsoPop.dataset.i === String(i)) hideAlso();
      else if (alsoFor(state.cells[i]).length) showAlso(i);
      else toast('No variations listed for this one. Close enough still counts.');
      return;
    }
    hideAlso();
    switch (e.key) {
      case 'ArrowRight': c = Math.min(SIZE - 1, c + 1); break;
      case 'ArrowLeft': c = Math.max(0, c - 1); break;
      case 'ArrowDown': r = Math.min(SIZE - 1, r + 1); break;
      case 'ArrowUp': r = Math.max(0, r - 1); break;
      case 'Home': c = 0; if (e.ctrlKey) r = 0; break;
      case 'End': c = SIZE - 1; if (e.ctrlKey) r = SIZE - 1; break;
      default: return;
    }
    e.preventDefault();
    setFocus(r * SIZE + c, true);
  }

  function switchDeck(d) {
    if (state.deck && d.id === state.deck.id && !d.custom) return;
    var last = d.custom ? (load('ashwga:custom') || {}).h : load('ashwga:lastcard:' + d.id);
    if (last && openHash(last, { announce: true })) return;
    var seed = d.custom ? (load('ashwga:custom') || {}).s : load('ashwga:seed:' + d.id); // saved before card edits existed
    if (seed) openCard(d, seed, { announce: true });
    else dealCard(d, { announce: true });
  }

  function resultText() {
    var s = score(), rows = [], r, c, line;
    for (r = 0; r < SIZE; r++) {
      line = '';
      for (c = 0; c < SIZE; c++) {
        var i = r * SIZE + c;
        line += i === CENTRE ? '⭐' : state.marked[i] ? '🟧' : '⬜';
      }
      rows.push(line);
    }
    var t = state.t0 ? fmtTime((state.t1 || Date.now()) - state.t0) : '';
    var summary;
    if (s.full) summary = 'FULL HOUSE in ' + t + '. Nothing surprised me.';
    else if (s.lines) summary = s.lines + (s.lines === 1 ? ' line' : ' lines') + ' in ' + t + ' · ' + s.count + '/' + NEEDED + ' squares';
    else summary = s.count + '/' + NEEDED + ' squares, no line yet';
    return 'ASHWGA bingo: ' + state.deck.title + ' (card ' + state.seed.toUpperCase() + ')\n' + summary + '\n' + rows.join('\n') + '\n' + location.href;
  }

  function copy(text, done) {
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      toast(ok ? done : 'Could not copy. Your browser blocked it.');
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast(done); }, fallback);
    else fallback();
  }

  function share() {
    var text = resultText();
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (navigator.share && coarse) {
      navigator.share({ text: text }).catch(function (e) { if (e && e.name !== 'AbortError') copy(text, 'Result copied'); });
    } else copy(text, 'Result copied. Paste it anywhere.');
  }

  /* ---------- editing a card and its deck ---------- */

  function onCard(text) {
    var t = text.toLowerCase();
    for (var i = 0; i < state.cells.length; i++) if (i !== CENTRE && state.cells[i].toLowerCase() === t) return i;
    return -1;
  }

  function spares() {
    var used = lowerSet(state.cells);
    return poolFor(state.deck).filter(function (t) { return !used[t.toLowerCase()]; });
  }

  /* Put `text` in square i. The new square starts unmarked; every other mark stays. */
  function replaceCell(i, text) {
    state.cells[i] = text;
    state.marked[i] = false;
    var s = score();
    if (!s.full) state.t1 = 0;
    if (s.count === 0) state.t0 = 0;
    rememberCard();
    renderGrid();
    update(true);
    renderEditor();
  }

  function swapOut(i) {
    var options = spares();
    if (!options.length) { toast('No spare squares left in this deck. Add or restore one first.'); return false; }
    var old = state.cells[i], pick = options[Math.floor(Math.random() * options.length)];
    replaceCell(i, pick);
    say('Swapped ' + old + ' for ' + pick + '.');
    return true;
  }

  function removeSquare(text) {
    var deck = state.deck, edits = loadEdits(deck), lower = text.toLowerCase();
    var added = edits.a.some(function (t) { return t.toLowerCase() === lower; });
    if (poolFor(deck, edits).length - 1 < NEEDED) { toast('A deck needs at least ' + NEEDED + ' squares to deal a card.'); return; }
    var i = onCard(text);
    if (i !== -1) {
      // Take it off the card first; if nothing can replace it, the removal is cancelled.
      var options = spares().filter(function (t) { return t.toLowerCase() !== lower; });
      if (!options.length) { toast('No spare squares to put in its place. Add or restore one first.'); return; }
      replaceCell(i, options[Math.floor(Math.random() * options.length)]);
    }
    if (added) {
      edits.a = edits.a.filter(function (t) { return t.toLowerCase() !== lower; });
      Object.keys(edits.v).forEach(function (k) { if (k.toLowerCase() === lower) delete edits.v[k]; });
    } else edits.r.push(text);
    saveEdits(deck, edits);
    renderEditor();
    toast(added ? 'Deleted your square' : 'Removed from this deck' + (i !== -1 ? ' and swapped off your card' : ''));
  }

  function restoreSquare(text) {
    var edits = loadEdits(state.deck), lower = text.toLowerCase();
    edits.r = edits.r.filter(function (t) { return t.toLowerCase() !== lower; });
    saveEdits(state.deck, edits);
    renderEditor();
    toast('Back in the deck');
  }

  /* Returns the square as it now appears in the deck, or null if it couldn't be added. */
  function addSquare(raw) {
    var parsed = splitLine(raw), text = parsed.text;
    if (!text) { toast('Type a square first'); return null; }
    var deck = state.deck, edits = loadEdits(deck), lower = text.toLowerCase();
    var existing = poolFor(deck, edits).filter(function (t) { return t.toLowerCase() === lower; })[0];
    if (existing) {
      if (parsed.also.length) {
        edits.v[existing] = parsed.also;
        saveEdits(deck, edits);
        renderGrid(); update(false); renderEditor();
        toast('Variations saved for that square');
      } else toast('That one’s already in the deck');
      return existing;
    }
    var original = deck.squares.filter(function (t) { return t.toLowerCase() === lower; })[0];
    if (original) {
      edits.r = edits.r.filter(function (t) { return t.toLowerCase() !== lower; });
      text = original;
    } else {
      if (edits.a.length >= MAX_ADDED) { toast('That’s the most squares you can add to one deck'); return null; }
      edits.a.push(text);
    }
    if (parsed.also.length) edits.v[text] = parsed.also;
    saveEdits(deck, edits);
    renderEditor();
    return text;
  }

  function startPicking(text) {
    if (onCard(text) !== -1) { toast('That square is already on your card'); return; }
    state.picking = text;
    el.pickText.textContent = text;
    el.pickHint.hidden = false;
    document.body.classList.add('picking');
    setFocus(state.focus === CENTRE ? 0 : state.focus, true);
    scrollTo(el.pickHint);
    say('Choose the square on your card that ' + text + ' should replace, or press Escape to cancel.');
  }

  function stopPicking() {
    state.picking = null;
    if (el.pickHint) el.pickHint.hidden = true;
    document.body.classList.remove('picking');
  }

  function placePicked(i) {
    var text = state.picking, old = state.cells[i];
    stopPicking();
    replaceCell(i, text);
    setFocus(i, true);
    toast('Swapped in. “' + old + '” went back to the deck.');
  }

  function row(text, actions, opts) {
    var li = document.createElement('li');
    var label = document.createElement('span');
    label.className = 'sqtext';
    label.textContent = text;
    li.appendChild(label);
    if (opts && opts.yours) { var y = document.createElement('em'); y.className = 'tag'; y.textContent = 'yours'; li.appendChild(y); }
    if (opts && opts.marked) { var m = document.createElement('em'); m.className = 'tag marked'; m.textContent = 'marked'; li.appendChild(m); }
    var also = alsoFor(text);
    if (also.length) {
      var v = document.createElement('small');
      v.className = 'alsoline';
      v.textContent = 'Also counts: ' + also.join(' · ');
      li.appendChild(v);
    }
    var box = document.createElement('span');
    box.className = 'rowbtns';
    actions.forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mini' + (a.primary ? ' primary' : '');
      b.textContent = a.label;
      b.setAttribute('aria-label', a.label + ': ' + text);
      b.addEventListener('click', a.run);
      box.appendChild(b);
    });
    li.appendChild(box);
    return li;
  }

  /* Rebuilding a list destroys the focused button. Remember where focus was
   * (which list, which row, which button) so it can land on the same spot after. */
  function editorFocus() {
    var a = document.activeElement, li = a && a.closest && a.closest('.sqlist > li');
    if (!li || !el.editPanel.contains(li)) return null;
    var btns = [].slice.call(li.querySelectorAll('button'));
    return { list: li.parentNode.id, row: [].indexOf.call(li.parentNode.children, li), btn: btns.indexOf(a) };
  }
  function restoreEditorFocus(f) {
    if (!f) return;
    var list = document.getElementById(f.list), rows = list ? list.children : [];
    var li = rows[Math.min(f.row, rows.length - 1)];
    var target = li ? li.querySelectorAll('button')[f.btn] || li.querySelector('button') : el.editPanel.querySelector('summary');
    if (target) target.focus();
  }

  function renderEditor() {
    if (!el.editPanel || !state.deck) return;
    var focus = editorFocus();
    var deck = state.deck, edits = loadEdits(deck), pool = poolFor(deck, edits);
    var yours = lowerSet(edits.a), onCardSet = lowerSet(state.cells);
    var rest = pool.filter(function (t) { return !onCardSet[t.toLowerCase()]; });
    var removed = edits.r.filter(function (t) { return deck.squares.some(function (d) { return d.toLowerCase() === t.toLowerCase(); }); });

    el.eCard.textContent = '';
    state.cells.forEach(function (t, i) {
      if (i === CENTRE) return;
      el.eCard.appendChild(row(t, [
        { label: 'Swap', run: function () { swapOut(i); } },
        { label: yours[t.toLowerCase()] ? 'Delete' : 'Remove', run: function () { removeSquare(t); } },
      ], { yours: yours[t.toLowerCase()], marked: state.marked[i] }));
    });
    el.eRest.textContent = '';
    rest.forEach(function (t) {
      el.eRest.appendChild(row(t, [
        { label: 'Put on card', primary: true, run: function () { startPicking(t); } },
        { label: yours[t.toLowerCase()] ? 'Delete' : 'Remove', run: function () { removeSquare(t); } },
      ], { yours: yours[t.toLowerCase()] }));
    });
    el.eRemoved.textContent = '';
    removed.forEach(function (t) {
      el.eRemoved.appendChild(row(t, [{ label: 'Restore', run: function () { restoreSquare(t); } }]));
    });
    el.eRemovedWrap.hidden = !removed.length;
    el.eCardCount.textContent = '(' + NEEDED + ')';
    el.eRestCount.textContent = '(' + rest.length + ')';
    el.eSummary.textContent = pool.length + ' squares in play: ' + NEEDED + ' on your card and ' + rest.length + ' more in the deck' +
      (edits.a.length ? ', including ' + edits.a.length + ' of your own' : '') +
      (removed.length ? '. ' + removed.length + ' removed.' : '.') + ' The free square, “' + deck.free + '”, is always on the card.';
    $('eReset').disabled = !edits.a.length && !edits.r.length;
    restoreEditorFocus(focus);
  }

  /* ---------- custom cards ---------- */

  /* Each line is a square, optionally followed by variations: "Square | variation | variation". */
  function customInput() {
    var squares = [], also = {};
    el.cSquares.value.split('\n').forEach(function (line) {
      var p = splitLine(line);
      if (!p.text) return;
      squares.push(p.text);
      if (p.also.length) also[p.text] = p.also;
    });
    var free = splitLine(el.cFree.value);
    if (free.text && free.also.length) also[free.text] = free.also;
    return { squares: cleanSquares(squares), also: also, free: free.text };
  }
  function updateCount() {
    var n = customInput().squares.length;
    el.cCount.textContent = n >= NEEDED ? n + ' squares. Ready to play.' : n + ' of ' + NEEDED + ' squares';
    el.cCount.classList.toggle('ok', n >= NEEDED);
    el.cPlay.disabled = n < NEEDED;
  }

  /* ---------- start ---------- */

  /* An edited card's squares, from a link. Ignored unless it's 24 distinct squares. */
  function cellsFromK(k, deck) {
    var list = b64urlDecode(k || '');
    if (!Array.isArray(list) || list.length !== NEEDED) return null;
    var clean = cleanSquares(list);
    if (clean.length !== NEEDED || clean.some(function (t, i) { return t !== list[i]; })) return null;
    clean.splice(CENTRE, 0, deck.free);
    return clean;
  }

  function openHash(hash, opts) {
    var p = new URLSearchParams(hash);
    var id = p.get('d'), seed = (p.get('s') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
    if (!id) return false;
    var deck = id === 'custom' ? customDeck(b64urlDecode(p.get('c') || '')) : deckById(id);
    if (!deck) return false;
    if (!seed) { dealCard(deck, opts); return true; }
    var cells = p.get('k') ? cellsFromK(p.get('k'), deck) : null;
    openCard(deck, seed, Object.assign({ cells: cells || undefined }, opts || {}));
    return true;
  }

  function fromHash() {
    return openHash(location.hash.slice(1));
  }

  function start() {
    if (!DECKS.length) { el.verdict.textContent = 'No decks found.'; return; }
    if (!fromHash()) {
      var last = load('ashwga:last');
      if (last) { history.replaceState(null, '', '#' + last); }
      if (!last || !fromHash()) dealCard(DECKS[0]);
    }

    $('newCard').addEventListener('click', function () {
      dealCard(state.deck, { announce: true });
      toast('Fresh card dealt');
    });
    $('clear').addEventListener('click', function () {
      state.marked = state.cells.map(function (_, i) { return i === CENTRE; });
      state.t0 = 0; state.t1 = 0; state.celebrated = 0;
      hideBanner();
      update(false); save();
      toast('Marks cleared');
    });
    $('copyLink').addEventListener('click', function () { copy(location.href, 'Card link copied. Your friend gets this exact card.'); });
    $('share').addEventListener('click', share);
    $('bannerShare').addEventListener('click', share);
    $('bannerClose').addEventListener('click', function () { hideBanner(); setFocus(state.focus, true); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!el.alsoPop.hidden) { hideAlso(); return; }
      if (state.picking) { stopPicking(); say('Cancelled.'); return; }
      if (!el.banner.hidden) { hideBanner(); setFocus(state.focus, true); }
    });

    // Editing squares
    $('editSquares').addEventListener('click', function () {
      el.editPanel.open = true;
      renderEditor();
      scrollTo(el.editPanel);
    });
    el.editPanel.addEventListener('toggle', function () { if (el.editPanel.open) renderEditor(); });
    $('pickCancel').addEventListener('click', function () { stopPicking(); toast('Cancelled'); });
    $('eAdd').addEventListener('click', function () {
      var t = addSquare(el.eNew.value);
      if (t) { el.eNew.value = ''; toast('Added to the deck. New cards can draw it.'); }
    });
    $('eAddPlace').addEventListener('click', function () {
      var t = addSquare(el.eNew.value);
      if (t) { el.eNew.value = ''; startPicking(t); }
    });
    el.eNew.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('eAdd').click(); } });
    $('eReset').addEventListener('click', function () {
      saveEdits(state.deck, { r: [], a: [] });
      renderEditor();
      toast('Deck reset. Your card stays as it is.');
    });

    el.cSquares.addEventListener('input', updateCount);
    $('cFromDeck').addEventListener('click', function () {
      el.cTitle.value = state.deck.custom ? state.deck.title : 'My ' + state.deck.title;
      el.cFree.value = withAlso(state.deck.free, alsoFor(state.deck.free));
      el.cSquares.value = poolFor(state.deck).map(function (t) { return withAlso(t, alsoFor(t)); }).join('\n');
      updateCount();
      el.cSquares.focus();
    });
    $('cPlay').addEventListener('click', function () {
      var input = customInput();
      var deck = customDeck({ t: el.cTitle.value, f: input.free, q: input.squares, v: input.also });
      if (!deck) return;
      dealCard(deck, { announce: true });
      scrollTo(document.getElementById('ticket'));
      toast('Your card is ready');
    });
    updateCount();

    window.addEventListener('hashchange', fromHash);
    // Any new touch or click starts a fresh gesture: forget an earlier press-and-hold, and close the popover.
    document.addEventListener('pointerdown', function (e) {
      suppressClick = false;
      if (!el.alsoPop.hidden && (e.pointerType !== 'mouse' || !el.alsoPop.contains(e.target))) hideAlso();
    }, true);
    window.addEventListener('resize', hideAlso);
    el.alsoPop.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hideAlso(); });
    var resizeTimer;
    window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(fitText, 120); });
    // Web fonts change word widths, so measure again once each one arrives.
    if (document.fonts) {
      if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', fitText);
      if (document.fonts.ready) document.fonts.ready.then(fitText);
    }
    window.addEventListener('load', fitText);
    setInterval(function () { if (state.t0 && !state.t1) tick(); }, 1000);
  }

  start();
})();
