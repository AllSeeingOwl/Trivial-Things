"""What The Spell's board is shown on TVs, and smart-TV browsers can be years old.
tools/frontend `npm run check:tv` lints the board's files against tv-browsers.txt; that check
allows a few newer CSS features only because they have fallbacks. These tests keep those
fallbacks in place. See the "Smart TVs" section of what_the_spell/README.md."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def css_without_comments(path):
    return re.sub(r"/\*.*?\*/", "", path.read_text(), flags=re.S)


QUIZ_NIGHT = css_without_comments(ROOT / "shared" / "quiz_night" / "quiz-night.css")
PORTAL_NAV = css_without_comments(ROOT / "shared" / "portal_nav" / "portal-nav.css")
BOARD_CSS = css_without_comments(ROOT / "what_the_spell" / "static" / "css" / "style.css")
BOARD_JS = [(ROOT / "what_the_spell" / "static" / "js" / name) for name in ("script.js", "spelling.js")] + [
    ROOT / "shared" / "remote" / "remote-follow.js",
] + [ROOT / app / "static" / "js" / "remote-tv.js" for app in ("trivia_flashcards", "mcq_flashcards", "sliding_rows_flashcards")]
REMOTE_TV_CSS = {
    path.relative_to(ROOT).as_posix(): css_without_comments(path)
    for path in [ROOT / "shared" / "remote" / "remote.css"] + [
        ROOT / app / "static" / "css" / "remote-view.css"
        for app in ("trivia_flashcards", "mcq_flashcards", "sliding_rows_flashcards")]
}


def strip_supports_blocks(css, condition_pattern):
    """CSS with every @supports block whose condition matches removed."""
    out, i = [], 0
    for m in re.finditer(r"@supports\s+([^{]+)\{", css):
        if m.start() < i:
            continue
        if not re.search(condition_pattern, m.group(1)):
            continue
        depth, j = 1, m.end()
        while depth and j < len(css):
            depth += {"{": 1, "}": -1}.get(css[j], 0)
            j += 1
        out.append(css[i:m.start()])
        i = j
    out.append(css[i:])
    return "".join(out)


def test_type_sizes_have_fixed_fallbacks():
    """clamp() only inside @supports (clamp); old engines get the fixed sizes in :root."""
    outside = strip_supports_blocks(QUIZ_NIGHT, r"clamp")
    assert "clamp(" not in outside
    for step in range(4):
        assert re.search(rf"--qn-step-{step}:\s*[\d.]+rem;", outside), step


def test_board_has_grid_and_gap_fallbacks():
    assert re.search(r"@supports not \(display: grid\)\s*\{\s*\.grid-container\s*\{\s*display: flex", BOARD_CSS)
    assert "@supports not (inset: 0)" in BOARD_CSS
    assert "@supports not (inset: 0)" in PORTAL_NAV


def test_focus_ring_survives_old_engines():
    """Old engines drop a whole rule if any selector in it uses :focus-visible, so it may only
    appear as ':focus:not(:focus-visible)', after a plain ':focus' ring."""
    for name, css in [("quiz-night.css", QUIZ_NIGHT), ("portal-nav.css", PORTAL_NAV), ("style.css", BOARD_CSS)] + list(REMOTE_TV_CSS.items()):
        for selector in re.findall(r"([^{}]+)\{", css):
            if ":focus-visible" in selector:
                assert re.fullmatch(r"\s*[^,]*:focus:not\(:focus-visible\)\s*", selector), (name, selector.strip())
    assert ".quiz-night :focus {" in QUIZ_NIGHT


def test_board_scripts_avoid_newer_javascript():
    """A quick backstop for `npm run check:tv`: the board's scripts stay ES5 and use
    XMLHttpRequest rather than fetch."""
    banned = [r"=>", r"\blet\s", r"\bconst\s", r"\basync\b", r"\bawait\b", r"`", r"\bfetch\(", r"\bclass\s+\w",
              r"\.includes\(", r"\bURLSearchParams\b", r"new URL\(", r"\?\.", r"\?\?"]
    for path in BOARD_JS:
        code = re.sub(r"//[^\n]*|/\*.*?\*/", "", path.read_text(), flags=re.S)
        code = re.sub(r"'(?:\\.|[^'\\])*'", "''", code)
        for pattern in banned:
            assert not re.search(pattern, code), (path.name, pattern)


def test_remote_tv_views_avoid_grid_and_flex_gap():
    """The flashcard boards' TV views use flexbox with margins, so older TV browsers get the
    same layout; shared/remote/remote.css may use flex gap only with its margin fallback."""
    for name, css in REMOTE_TV_CSS.items():
        assert not re.search(r"display:\s*grid|grid-template", css), name
        if name.endswith("remote.css"):
            assert "@supports not (inset: 0)" in css
        else:
            assert not re.search(r"(^|[;{\s])gap:", css), name
