## 2024-05-24 - [CRITICAL] Disable debug=True in where_in_the_world Flask app
**Vulnerability:** The `where_in_the_world` sub-application was running with `app.run(port=5004, debug=True)`. This exposes the interactive Werkzeug debugger on unhandled exceptions.
**Learning:** Leaving `debug=True` in production or globally exposed Flask apps allows remote code execution (RCE) and leaks sensitive stack traces, undermining the security of the application.
**Prevention:** Always verify `debug=False` for Flask applications. Implement automated checks (e.g., linters or security scanners) to detect `debug=True` in `app.run()` calls before merging code.

## 2024-05-27 - [MEDIUM] Fix unhandled ValueError in /api/questions
**Vulnerability:** The `/api/questions` endpoint converted `request.args.get('count')` directly to an integer without wrapping it in a `try/except` block or checking bounds. Submitting `count=abc` resulted in an unhandled `ValueError`, crashing the application and leaking a 500 error stack trace.
**Learning:** All user inputs, especially query parameters used for size or count limits, must be validated and bounded. Failing to do so can lead to DoS or information disclosure via stack traces.
**Prevention:** Always validate route parameters expecting integers using `try/except ValueError` blocks and perform necessary bound checks (e.g. `count <= 0`).

## 2024-06-12 - [HIGH] Prevent DOM-based XSS by replacing innerText with textContent
**Vulnerability:** Frontend JavaScript files (`mcq_flashcards/static/js/script.js` and `trivia_flashcards/static/js/script.js`) were using `.innerText` to insert untrusted data (questions, answers, stats) into the DOM. While generally safe, `.textContent` provides better performance and security consistency across browsers.
**Learning:** Using `.textContent` is superior to `.innerText` because it prevents DOM-based XSS attacks natively by preventing HTML tags from being evaluated, and avoids CSS parsing and layout recalculation, increasing performance.
**Prevention:** Strictly enforce the use of `document.createElement()` and `.textContent` for dynamic DOM insertion, avoiding `.innerHTML` or `.innerText` completely.

## 2024-07-02 - [MEDIUM] Prevent unhandled TypeError (500) during dictionary lookup
**Vulnerability:** The `/api/score` endpoint in `where_in_the_world/app.py` extracted the `id` from the JSON payload and used it directly in a dictionary lookup (`QUESTIONS_BY_ID.get(target_id)`). Passing an unhashable type (e.g., a list or a dict like `{"id": []}`) caused Python to throw an unhandled `TypeError`, resulting in a 500 Internal Server Error, which can lead to DoS or stack trace leakage.
**Learning:** Python dictionary lookups (`.get()`) are not safe against unhashable types if the input comes directly from untrusted JSON payloads. User inputs mapping to dictionary keys must be type-checked before usage.
**Prevention:** Always validate the type of data extracted from `request.json` before passing it to native Python functions that expect specific types. For IDs, explicitly assert `isinstance(target_id, str)` (or `int`, depending on the structure).
