"""GitHub Pages builds every Markdown file with Jekyll, which treats `{%` and `{{` as
Liquid tags. Jinja snippets in docs (even in code spans) break the Pages build."""
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def test_markdown_has_no_liquid_tags():
    files = subprocess.run(
        ["git", "ls-files", "-z", "*.md"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout.split("\0")
    offenders = []
    for name in filter(None, files):
        text = (ROOT / name).read_text(encoding="utf-8")
        # A {% raw %} ... {% endraw %} block is allowed: it is how to show such syntax on purpose.
        text = re.sub(r"{%-?\s*raw\s*-?%}.*?{%-?\s*endraw\s*-?%}", "", text, flags=re.S)
        for lineno, line in enumerate(text.splitlines(), 1):
            if "{%" in line or "{{" in line:
                offenders.append(f"{name}:{lineno}")
    assert not offenders, "Liquid-style tags break the GitHub Pages build: " + ", ".join(offenders)
