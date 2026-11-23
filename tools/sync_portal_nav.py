#!/usr/bin/env python3
"""Copy the shared portal bar into every Flask app.

Each app is built and deployed from its own directory, so it needs its own copy of
the bar. The canonical files live in shared/portal_nav/; run this after editing them.
`--check` exits non-zero if any copy is out of date (used by the tests).
"""
import filecmp
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "shared" / "portal_nav"

APPS = [
    "interactive_scoreboard",
    "mcq_flashcards",
    "pdf_grid_flashcards",
    "periodic_name",
    "point_it_out",
    "price_time_machine",
    "quarterly_calendar",
    "sliding_rows_flashcards",
    "trivia_flashcards",
    "what_the_spell",
    "where_in_the_world",
]

# source file name -> path inside each app
FILES = {
    "_portal_nav.html": Path("templates") / "_portal_nav.html",
    "portal-nav.css": Path("static") / "css" / "portal-nav.css",
    "portal-nav.js": Path("static") / "js" / "portal-nav.js",
}


def targets():
    for app in APPS:
        for name, rel in FILES.items():
            yield SOURCE / name, ROOT / app / rel


def main(argv):
    check = "--check" in argv
    stale = []
    for src, dest in targets():
        if dest.exists() and filecmp.cmp(src, dest, shallow=False):
            continue
        if check:
            stale.append(dest.relative_to(ROOT))
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dest)
            print(f"updated {dest.relative_to(ROOT)}")
    if stale:
        print("Out of date (run python3 tools/sync_portal_nav.py):")
        for path in stale:
            print(f"  {path}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
