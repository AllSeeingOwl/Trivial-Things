"""Every /static/... file the front-end script refers to must exist.
The red answer marker once pointed at an image that was never added."""
import re
from pathlib import Path

APP = Path(__file__).resolve().parent


def test_script_static_files_exist():
    script = (APP / "static" / "js" / "script.js").read_text()
    refs = set(re.findall(r"['\"]/static/([^'\"?#]+)['\"]", script))
    assert refs, "expected the script to refer to some static files"
    missing = sorted(r for r in refs if not (APP / "static" / r).is_file())
    assert not missing, f"missing static files: {missing}"
