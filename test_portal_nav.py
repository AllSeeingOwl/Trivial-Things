"""The shared portal bar: copies stay in sync, and no app falls back to inline styles or scripts."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "tools"))
import sync_shared  # noqa: E402


def test_copies_match_shared_source():
    result = subprocess.run(
        [sys.executable, str(ROOT / "tools" / "sync_shared.py"), "--check"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stdout


def test_every_page_uses_the_shared_bar():
    for app in sync_shared.APPS:
        for page in (ROOT / app / "templates").glob("*.html"):
            if page.name.startswith("_"):
                continue
            html = page.read_text()
            assert "{% include '_portal_nav.html' %}" in html, page
            assert "css/portal-nav.css" in html, page
            assert "<nav style=" not in html, page


def test_bar_wording_is_for_people_not_developers():
    """The bar names the collection and links back to it in plain words. Its old text
    ("<App> Portal", "Standalone Service", "Back to Central Portal") read like deployment notes."""
    bar = (ROOT / "shared" / "portal_nav" / "_portal_nav.html").read_text()
    assert 'aria-label="Trivial Things"' in bar
    assert "</span>All apps</a>" in bar
    for old in ("Standalone Service", "Central Portal", "portal_app_name"):
        assert old not in bar, old

