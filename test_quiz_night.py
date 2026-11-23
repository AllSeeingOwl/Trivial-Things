"""The quiz apps share the Quiz Night look: every page loads the shared stylesheet
before its own, and each app sets its own accent colour."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "tools"))
import sync_shared  # noqa: E402


def test_every_quiz_page_uses_quiz_night():
    for app in sync_shared.QUIZ_NIGHT_APPS:
        pages = [p for p in (ROOT / app / "templates").glob("*.html") if not p.name.startswith("_")]
        assert pages, app
        for page in pages:
            html = page.read_text()
            assert '<body class="quiz-night"' in html, page
            shared = html.find("css/quiz-night.css")
            own = html.find("css/style.css")
            assert shared != -1, f"{page} does not load quiz-night.css"
            assert own == -1 or shared < own, f"{page} must load quiz-night.css before style.css"


def test_each_quiz_app_has_its_own_accent():
    accents = {}
    for app in sync_shared.QUIZ_NIGHT_APPS:
        css = (ROOT / app / "static" / "css" / "style.css").read_text()
        match = re.search(r"--qn-accent:\s*(#[0-9a-fA-F]{6})", css)
        assert match, f"{app} sets no --qn-accent"
        accents[app] = match.group(1).lower()
    assert len(set(accents.values())) == len(accents), accents
