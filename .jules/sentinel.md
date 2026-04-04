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

## 2024-07-06 - [MEDIUM] Prevent unhandled TypeError (500) during chain dictionary lookup
**Vulnerability:** The `/api/mark_used` endpoint in `sliding_rows_flashcards/app.py` extracted the `chain_id` from the JSON payload and passed it to `update_chain_used_status`, where it was used directly as a dictionary key (`chains[chain_id]`). Passing an unhashable type (e.g., a dictionary or list) would throw an unhandled `TypeError`, resulting in a 500 error and stack trace leakage.
**Learning:** Just like with coordinate mapping, any untrusted JSON parameter that will be utilized in a dictionary lookup needs to be verified for appropriate hashable types to prevent 500 crashes and DoS.
**Prevention:** Always validate the type of data extracted from `request.json`. For `chain_id`, assert `isinstance(chain_id, str)` before calling backend lookup functions.

## 2024-07-15 - [CRITICAL] Prevent unhandled AttributeError (500) from unexpected JSON payload structure
**Vulnerability:** The `/api/score` endpoint in `where_in_the_world/app.py` extracted `data = request.json` and immediately called `data.get('lat')`. When a client maliciously or accidentally sent a JSON array (e.g., `[1, 2, 3]`), `request.json` parsed it as a Python list, which lacks a `.get()` method. This triggered an unhandled `AttributeError`, resulting in a 500 Internal Server Error, DoS risk, and potential stack trace leakage.
**Learning:** `request.json` can be of any valid JSON type (list, bool, string, etc.), not just a dictionary. Calling dictionary-specific methods like `.get()` on it without type validation is unsafe and can lead to immediate application crashes.
**Prevention:** Always validate the structure of `request.json` (e.g., `isinstance(data, dict)`) before interacting with its keys or methods.

## 2026-04-04 - [CRITICAL] Harden Flask debug configuration in pdf_grid_flashcards
**Vulnerability:** Relying solely on `app.run(debug=False)` only disables the Werkzeug debugger when the script is run directly. If the app is launched via the Flask CLI (`flask run`) or a WSGI server, the debugger could still be enabled if `FLASK_DEBUG` is set, leading to RCE.
**Learning:** Explicitly setting `app.config['DEBUG'] = False` within the application code ensures the debugger is disabled regardless of the execution environment.
**Prevention:** Always include `app.config['DEBUG'] = False` in the Flask application initialization and maintain `debug=False` in `app.run()`.
## 2025-05-15 - Boundary Check on CSV Row Access
 **Vulnerability:** Missing boundary check when using user-provided IDs to index CSV rows.
 **Learning:** Directly using integer-converted user input to index lists can lead to IndexError or unauthorized row modification (including header corruption).
 **Prevention:** Implement explicit range checks against the list length and verify if the index refers to a protected row (like a header) before performing any data operations.
## 2024-10-24 - [MEDIUM] Added Security Headers to Flask Response
**Vulnerability:** Flask web apps were serving content without any baseline HTTP security headers, leaving them vulnerable to MIME-sniffing, clickjacking, and XSS.
**Learning:** Implementing an `@app.after_request` hook provides a centralized, robust method to enforce global security headers (like CSP, X-Frame-Options, X-Content-Type-Options) without modifying individual route logic.
**Prevention:** Establish a default security header middleware or decorator for all Flask applications in the project.
