#!/usr/bin/env python3
"""Copy the shared front-end files into each Flask app.

Each app is built and deployed from its own directory, so each needs its own copy.
The canonical files live in shared/; run this after editing them.
`--check` exits non-zero if any copy is out of date (used by the tests).

- shared/portal_nav/: the "Trivial Things · All apps" bar, used by every Flask app.
- shared/quiz_night/: the Quiz Night look (stylesheet and font), used by the quiz apps;
  the portal uses the font too.
"""
import filecmp
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHARED = ROOT / "shared"

PORTAL_NAV_APPS = [
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

QUIZ_NIGHT_APPS = [
    "interactive_scoreboard",
    "mcq_flashcards",
    "pdf_grid_flashcards",
    "point_it_out",
    "sliding_rows_flashcards",
    "trivia_flashcards",
    "what_the_spell",
    "where_in_the_world",
]

# Kept for anything that imported the old name.
APPS = PORTAL_NAV_APPS

# (apps, source file under shared/, path inside each app)
GROUPS = [
    (PORTAL_NAV_APPS, "portal_nav/_portal_nav.html", "templates/_portal_nav.html"),
    (PORTAL_NAV_APPS, "portal_nav/portal-nav.css", "static/css/portal-nav.css"),
    (PORTAL_NAV_APPS, "portal_nav/portal-nav.js", "static/js/portal-nav.js"),
    (QUIZ_NIGHT_APPS, "quiz_night/quiz-night.css", "static/css/quiz-night.css"),
    (QUIZ_NIGHT_APPS, "quiz_night/fonts/atkinson-400-latin.woff2", "static/fonts/atkinson-400-latin.woff2"),
    (QUIZ_NIGHT_APPS, "quiz_night/fonts/atkinson-400-latin-ext.woff2", "static/fonts/atkinson-400-latin-ext.woff2"),
    (QUIZ_NIGHT_APPS, "quiz_night/fonts/atkinson-700-latin.woff2", "static/fonts/atkinson-700-latin.woff2"),
    (QUIZ_NIGHT_APPS, "quiz_night/fonts/atkinson-700-latin-ext.woff2", "static/fonts/atkinson-700-latin-ext.woff2"),
    (QUIZ_NIGHT_APPS, "quiz_night/fonts/OFL-atkinsonhyperlegible.txt", "static/fonts/OFL-atkinsonhyperlegible.txt"),
    # The portal (a static site) uses the same font.
    (["portal"], "quiz_night/fonts/atkinson-400-latin.woff2", "fonts/atkinson-400-latin.woff2"),
    (["portal"], "quiz_night/fonts/atkinson-400-latin-ext.woff2", "fonts/atkinson-400-latin-ext.woff2"),
    (["portal"], "quiz_night/fonts/atkinson-700-latin.woff2", "fonts/atkinson-700-latin.woff2"),
    (["portal"], "quiz_night/fonts/atkinson-700-latin-ext.woff2", "fonts/atkinson-700-latin-ext.woff2"),
    (["portal"], "quiz_night/fonts/OFL-atkinsonhyperlegible.txt", "fonts/OFL-atkinsonhyperlegible.txt"),
]


def targets():
    for apps, source, rel in GROUPS:
        for app in apps:
            yield SHARED / source, ROOT / app / rel


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
        print("Out of date (run python3 tools/sync_shared.py):")
        for path in stale:
            print(f"  {path}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
