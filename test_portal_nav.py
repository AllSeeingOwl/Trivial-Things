"""The shared portal bar: copies stay in sync, and no app falls back to inline styles or scripts."""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "tools"))
import sync_portal_nav  # noqa: E402


def test_copies_match_shared_source():
    result = subprocess.run(
        [sys.executable, str(ROOT / "tools" / "sync_portal_nav.py"), "--check"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stdout


def test_every_page_uses_the_shared_bar():
    for app in sync_portal_nav.APPS:
        for page in (ROOT / app / "templates").glob("*.html"):
            if page.name.startswith("_"):
                continue
            html = page.read_text()
            assert "{% include '_portal_nav.html' %}" in html, page
            assert re.search(r"{% set portal_app_name = \"[^\"]+\" %}", html), page
            assert "css/portal-nav.css" in html, page
            assert "<nav style=" not in html, page
