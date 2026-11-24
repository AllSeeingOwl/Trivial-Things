#!/usr/bin/env bash
# Builds the front-end files for the apps that used to load them from CDNs at runtime:
#   - Tailwind CSS for Periodic Name, Price Time Machine, Quarterly Calendar and Whovian Degrees
#   - React (vendored) and the compiled JSX for Whovian Degrees
# Run after changing Tailwind classes in those apps' templates or scripts, or Whovian's src/*.jsx:
#   cd tools/frontend && npm ci && ./build.sh
# The outputs are committed, so the apps need no build step to run or deploy.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
BIN="$PWD/node_modules/.bin"

for app in periodic_name price_time_machine quarterly_calendar whovian_degrees; do
    "$BIN/tailwindcss" -c "$ROOT/$app/tailwind.config.js" -i "$ROOT/$app/tailwind.input.css" \
        -o "$ROOT/$app/static/css/tailwind.css" --minify
done

WHO="$ROOT/whovian_degrees"
mkdir -p "$WHO/static/js" "$WHO/static/vendor"
"$BIN/babel" --no-babelrc --presets @babel/preset-react \
    "$WHO/src/App.jsx" "$WHO/src/main.jsx" --out-file "$WHO/static/js/app.js"
cp node_modules/react/umd/react.production.min.js "$WHO/static/vendor/react.production.min.js"
cp node_modules/react-dom/umd/react-dom.production.min.js "$WHO/static/vendor/react-dom.production.min.js"
cp node_modules/react/LICENSE "$WHO/static/vendor/LICENSE-react.txt"
echo "Built."
