/* Called It! cliché bingo. No backend: the card is rebuilt from the URL hash
 * (deck + seed, plus the squares themselves for a custom card), and marks are
 * kept in localStorage for that exact card. */
(function () {
  'use strict';

  var DECKS = window.CALLED_IT_DECKS || [];
  var SIZE = 5;
  var CENTRE = 12;
  var NEEDED = SIZE * SIZE - 1;
  var MAX_CUSTOM = 100;
  var MAX_LEN = 80;
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
  };

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    decks: $('decks'), grid: $('grid'), title: $('deckTitle'), code: $('cardCode'),
    lines: $('lines'), timer: $('timer'), pct: $('pct'), meter: $('meter'), verdict: $('verdict'),
    banner: $('banner'), bannerTitle: $('bannerTitle'), bannerSub: $('bannerSub'),
    blurb: $('deckBlurb'), toast: $('toast'), announce: $('announce'),
    cTitle: $('cTitle'), cFree: $('cFree'), cSquares: $('cSquares'), cCount: $('cCount'), cPlay: $('cPlay'),
    customPanel: $('customPanel'),
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

  function cleanSquares(list) {
    var seen = {}, out = [];
    list.forEach(function (s) {
      var t = String(s || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
      var k = t.toLowerCase();
      if (t && !seen[k]) { seen[k] = true; out.push(t); }
    });
    return out.slice(0, MAX_CUSTOM);
  }

  function customDeck(data) {
    if (!data || !Array.isArray(data.q)) return null;
    var squares = cleanSquares(data.q);
    if (squares.length < NEEDED) return null;
    return {
      id: 'custom', custom: true, accent: 'custom',
      title: String(data.t || 'My card').trim().slice(0, 40) || 'My card',
      free: String(data.f || 'Free square').trim().slice(0, 60) || 'Free square',
      squares: squares,
      blurb: 'A card you made. Copy the card link to send it, squares and all, to a friend.',
    };
  }

  function fmtTime(ms) {
    var s = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(s / 60), h = Math.floor(m / 60);
    s %= 60;
    if (h) return h + ':' + String(m % 60).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return m + ':' + String(s).padStart(2, '0');
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

  function hashFor(deck, seed) {
    var h = 'd=' + encodeURIComponent(deck.id) + '&s=' + encodeURIComponent(seed);
    if (deck.custom) h += '&c=' + b64urlEncode({ t: deck.title, f: deck.free, q: deck.squares });
    return h;
  }

  function storageKey() {
    var k = 'calledit:v1:' + state.deck.id + ':' + state.seed;
    if (state.deck.custom) k += ':' + hashString(JSON.stringify(state.deck.squares) + state.deck.free).toString(36);
    return k;
  }

  function buildCells(deck, seed) {
    var pool = deck.squares.slice(), r = rng(deck.id + ':' + seed), i, j, tmp;
    for (i = pool.length - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
    pool = pool.slice(0, NEEDED);
    pool.splice(CENTRE, 0, deck.free);
    return pool;
  }

  function openCard(deck, seed, opts) {
    opts = opts || {};
    state.deck = deck;
    state.seed = seed;
    state.cells = buildCells(deck, seed);
    var saved = load(storageKey()) || {};
    state.marked = state.cells.map(function (_, i) { return i === CENTRE || (saved.m || []).indexOf(i) !== -1; });
    state.t0 = saved.t0 || 0;
    state.t1 = saved.t1 || 0;
    state.celebrated = saved.c || 0;
    state.focus = Math.min(state.focus, 24);

    var h = hashFor(deck, seed);
    if (location.hash.slice(1) !== h) history.replaceState(null, '', '#' + h);
    store('calledit:last', h);
    if (!deck.custom) store('calledit:seed:' + deck.id, seed);
    else store('calledit:custom', { t: deck.title, f: deck.free, q: deck.squares, s: seed });

    document.body.dataset.accent = deck.accent || 'showcase';
    el.title.textContent = deck.title;
    el.code.textContent = seed.toUpperCase();
    el.blurb.textContent = deck.blurb || '';
    document.title = 'Called It! ' + deck.title + ' bingo';
    hideBanner();
    renderDecks();
    renderGrid();
    update(false);
    if (opts.announce) say(deck.title + ' card ' + seed.toUpperCase() + ' ready.');
  }

  function save() {
    var m = [];
    state.marked.forEach(function (v, i) { if (v && i !== CENTRE) m.push(i); });
    store(storageKey(), { m: m, t0: state.t0, t1: state.t1, c: state.celebrated });
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
    el.decks.textContent = '';
    var list = DECKS.slice();
    var custom = state.deck && state.deck.custom ? state.deck : customDeck(load('calledit:custom'));
    if (custom) list.push(custom);
    list.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'deck';
      b.textContent = d.custom ? d.title + ' (yours)' : d.title;
      b.style.setProperty('--dot', 'var(--a-' + (d.accent || 'custom') + ')');
      b.setAttribute('aria-pressed', String(!!state.deck && state.deck.id === d.id));
      b.addEventListener('click', function () { switchDeck(d); });
      el.decks.appendChild(b);
    });
  }

  function renderGrid() {
    el.grid.textContent = '';
    state.cells.forEach(function (text, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'sq' + (i === CENTRE ? ' free' : '') + (text.length > (i === CENTRE ? 26 : 32) ? ' long' : '');
      b.dataset.i = i;
      b.tabIndex = i === state.focus ? 0 : -1;
      if (i === CENTRE) {
        var small = document.createElement('small');
        small.textContent = 'Free';
        b.appendChild(small);
        b.setAttribute('aria-disabled', 'true');
      }
      var span = document.createElement('span');
      span.textContent = text;
      b.appendChild(span);
      b.setAttribute('aria-pressed', String(state.marked[i]));
      b.addEventListener('click', function () { toggle(i); });
      b.addEventListener('keydown', onKey);
      b.addEventListener('focus', function () { setFocus(i, false); });
      el.grid.appendChild(b);
    });
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
      var label = state.cells[i] + (i === CENTRE ? ', free square' : '') + (s.near[i] && !state.marked[i] ? ', would complete a line' : '');
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
    else if (s.lines === 1) v = 'Line! Called it.';
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
    state.marked[i] = !state.marked[i];
    if (state.marked[i] && !state.t0) state.t0 = Date.now();
    var s = score();
    if (s.full && !state.t1) state.t1 = Date.now();
    if (!s.full) state.t1 = 0;
    if (s.count === 0) state.t0 = 0;
    setFocus(i, false);
    update(true);
  }

  function setFocus(i, move) {
    var buttons = el.grid.children;
    if (buttons[state.focus]) buttons[state.focus].tabIndex = -1;
    state.focus = i;
    if (buttons[i]) { buttons[i].tabIndex = 0; if (move) buttons[i].focus(); }
  }

  function onKey(e) {
    var i = state.focus, r = Math.floor(i / SIZE), c = i % SIZE;
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
    var seed = d.custom ? ((load('calledit:custom') || {}).s || newSeed()) : (load('calledit:seed:' + d.id) || newSeed());
    openCard(d, seed, { announce: true });
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
    return 'Called It! ' + state.deck.title + ' bingo (card ' + state.seed.toUpperCase() + ')\n' + summary + '\n' + rows.join('\n') + '\n' + location.href;
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

  /* ---------- custom cards ---------- */

  function customInput() {
    return cleanSquares(el.cSquares.value.split('\n'));
  }
  function updateCount() {
    var n = customInput().length;
    el.cCount.textContent = n >= NEEDED ? n + ' squares. Ready to play.' : n + ' of ' + NEEDED + ' squares';
    el.cCount.classList.toggle('ok', n >= NEEDED);
    el.cPlay.disabled = n < NEEDED;
  }

  /* ---------- start ---------- */

  function fromHash() {
    var p = new URLSearchParams(location.hash.slice(1));
    var id = p.get('d'), seed = (p.get('s') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
    if (!id) return false;
    var deck = id === 'custom' ? customDeck(b64urlDecode(p.get('c') || '')) : deckById(id);
    if (!deck) return false;
    openCard(deck, seed || newSeed());
    return true;
  }

  function start() {
    if (!DECKS.length) { el.verdict.textContent = 'No decks found.'; return; }
    if (!fromHash()) {
      var last = load('calledit:last');
      if (last) { history.replaceState(null, '', '#' + last); }
      if (!last || !fromHash()) openCard(DECKS[0], load('calledit:seed:' + DECKS[0].id) || newSeed());
    }

    $('newCard').addEventListener('click', function () {
      openCard(state.deck, newSeed(), { announce: true });
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
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !el.banner.hidden) { hideBanner(); setFocus(state.focus, true); } });

    el.cSquares.addEventListener('input', updateCount);
    $('cFromDeck').addEventListener('click', function () {
      el.cTitle.value = state.deck.custom ? state.deck.title : 'My ' + state.deck.title;
      el.cFree.value = state.deck.free;
      el.cSquares.value = state.deck.squares.join('\n');
      updateCount();
      el.cSquares.focus();
    });
    $('cPlay').addEventListener('click', function () {
      var deck = customDeck({ t: el.cTitle.value, f: el.cFree.value, q: customInput() });
      if (!deck) return;
      openCard(deck, newSeed(), { announce: true });
      document.getElementById('ticket').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('Your card is ready');
    });
    updateCount();

    window.addEventListener('hashchange', fromHash);
    setInterval(function () { if (state.t0 && !state.t1) tick(); }, 1000);
  }

  start();
})();
