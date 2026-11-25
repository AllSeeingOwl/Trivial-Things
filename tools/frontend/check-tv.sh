#!/usr/bin/env bash
# Checks the pages that run on TVs against the older smart-TV browsers in tv-browsers.txt:
#   - What The Spell's board
#   - the Trivia, MCQ and Sliding Rows boards while they follow a phone remote
#   - TV Link's TV page
# Scripts must be ES5 and use only APIs those browsers have; stylesheets may only use newer
# features with a fallback (see ALLOWED in doiuse-check.mjs).
set -euo pipefail
cd "$(dirname "$0")"
ROOT=../..

JS=(
  what_the_spell/static/js/script.js
  what_the_spell/static/js/spelling.js
  shared/remote/remote-follow.js
  trivia_flashcards/static/js/remote-tv.js
  mcq_flashcards/static/js/remote-tv.js
  sliding_rows_flashcards/static/js/remote-tv.js
  tv_link/static/js/tv.js
)
CSS=(
  shared/quiz_night/quiz-night.css
  shared/portal_nav/portal-nav.css
  shared/remote/remote.css
  what_the_spell/static/css/style.css
  trivia_flashcards/static/css/remote-view.css
  mcq_flashcards/static/css/remote-view.css
  sliding_rows_flashcards/static/css/remote-view.css
  tv_link/static/css/style.css
  tv_link/static/css/tv.css
)

npx es-check es5 "${JS[@]/#/$ROOT/}"
node lint-tv-apis.mjs "${JS[@]}"
node doiuse-check.mjs "${CSS[@]/#/$ROOT/}"
