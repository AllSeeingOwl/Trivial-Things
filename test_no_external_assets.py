"""No app page loads scripts or stylesheets from another site at runtime.
Four apps used to pull Tailwind, React and Babel from CDNs, so they broke or went
unstyled whenever a CDN was slow, down or blocked. Their files are now built by
tools/frontend/build.sh and served from each app's static folder."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXTERNAL = re.compile(
    r'<script[^>]*\ssrc="(?:https?:)?//|<link[^>]*rel="stylesheet"[^>]*href="(?:https?:)?//', re.I)


def test_templates_load_nothing_from_other_sites():
    offenders = []
    for page in sorted(ROOT.glob("*/templates/*.html")):
        if EXTERNAL.search(page.read_text()):
            offenders.append(str(page.relative_to(ROOT)))
    assert not offenders, offenders


def test_prebuilt_files_exist():
    for app in ["periodic_name", "price_time_machine", "quarterly_calendar", "whovian_degrees"]:
        assert (ROOT / app / "static" / "css" / "tailwind.css").stat().st_size > 1000, app
    for rel in ["static/js/app.js", "static/vendor/react.production.min.js", "static/vendor/react-dom.production.min.js"]:
        assert (ROOT / "whovian_degrees" / rel).is_file(), rel


def test_csp_names_no_cdn():
    for app_py in ["periodic_name/periodic_name_app.py", "price_time_machine/price_time_machine_app.py",
                   "quarterly_calendar/quarterly_calendar_app.py", "whovian_degrees/whovian_degrees_app.py"]:
        text = (ROOT / app_py).read_text()
        for host in ("cdn.tailwindcss.com", "cdn.jsdelivr.net", "unpkg.com"):
            assert host not in text, f"{app_py} still allows {host}"
