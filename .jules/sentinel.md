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
## 2024-10-24 - [MEDIUM] Added Security Headers to Flask Response
**Vulnerability:** Flask web apps were serving content without any baseline HTTP security headers, leaving them vulnerable to MIME-sniffing, clickjacking, and XSS.
**Learning:** Implementing an `@app.after_request` hook provides a centralized, robust method to enforce global security headers (like CSP, X-Frame-Options, X-Content-Type-Options) without modifying individual route logic.
**Prevention:** Establish a default security header middleware or decorator for all Flask applications in the project.

## 2025-05-15 - Boundary Check on CSV Row Access in trivia_flashcards
 **Vulnerability:** Missing boundary check when using user-provided IDs to index CSV rows in trivia_flashcards.
 **Learning:** Directly using integer-converted user input to index lists can lead to IndexError or unauthorized row modification (including header corruption). By lacking boundary checks, an attacker could attempt to overwrite the header or crash the service with out-of-bounds indices.
 **Prevention:** Implement explicit range checks against the list length and verify if the index refers to a protected row (like a header) before performing any data operations. This was applied to `update_used_status`.
## 2026-04-08 - [HIGH] Add Boundary Check to CSV Row Index in sliding_rows_flashcards
**Vulnerability:** The `/api/mark_used` endpoint calls `update_chain_used_status` which directly used the user-supplied `row_idx` from a JSON payload to modify lines in `Questions_And_Segues.csv`. There was no verification that the index was within bounds (`< len(rows)`) or that it wasn't targeting the header row (`0`).
**Learning:** Directly using integer-converted user input to index arrays without validation leads to unhandled `IndexError` crashes (DoS vulnerability) and potential unauthorized modification of sensitive data metadata, such as corrupting the CSV header row.
**Prevention:** Always implement boundary checks (`< 0` or `>= len(rows)`) and protect special indices (like header rows) when using user-supplied indices to retrieve or mutate array elements.
## 2024-07-28 - [MEDIUM] Enforce Content-Security-Policy across all Flask micro-apps
**Vulnerability:** The Flask micro-apps (, , , , and ) were missing a `Content-Security-Policy` header, leaving them susceptible to cross-site scripting (XSS), data injection, and other content-based attacks if existing protections (like using `.textContent`) ever failed.
**Learning:** Implementing a strict CSP (e.g., `default-src 'self'`) adds an important layer of defense-in-depth by restricting the browser to only load resources from trusted origins, mitigating the impact of potential vulnerabilities.
**Prevention:** Ensure that all applications, regardless of size or apparent lack of external dependencies, implement a baseline `Content-Security-Policy` via an `@app.after_request` middleware to enforce strict resource loading policies.

## 2024-07-28 - [MEDIUM] Enforce Content-Security-Policy across all Flask micro-apps
**Vulnerability:** The Flask micro-apps (`mcq_flashcards`, `pdf_grid_flashcards`, `sliding_rows_flashcards`, `trivia_flashcards`, and `what_the_spell`) were missing a `Content-Security-Policy` header, leaving them susceptible to cross-site scripting (XSS), data injection, and other content-based attacks if existing protections (like using `.textContent`) ever failed.
**Learning:** Implementing a strict CSP (e.g., `default-src 'self'`) adds an important layer of defense-in-depth by restricting the browser to only load resources from trusted origins, mitigating the impact of potential vulnerabilities.
**Prevention:** Ensure that all applications, regardless of size or apparent lack of external dependencies, implement a baseline `Content-Security-Policy` via an `@app.after_request` middleware to enforce strict resource loading policies.
## 2026-04-10 - Removed unsafe-eval from CSP
**Vulnerability:** The 'where_in_the_world' application's Content Security Policy included 'unsafe-eval' in the 'script-src' directive, unnecessarily exposing the application to DOM-based XSS attacks via arbitrary code execution.
**Learning:** Mapping libraries like Leaflet do not inherently require 'unsafe-eval' to function. Its inclusion is often a misconfiguration or leftover from development.
**Prevention:** Strictly verify whether external libraries genuinely require 'unsafe-eval' before including it in CSP headers. Omit it by default to maintain robust protection against XSS.

## 2026-04-12 - [HIGH] Fix Authorization Bypass in Cron Endpoints
**Vulnerability:** The `/api/cron/route.ts` endpoint verified the authorization header against the `CRON_SECRET` environment variable, but it skipped the check entirely if the variable was not defined (`if (process.env.CRON_SECRET && ...)`). This meant that if the environment variable was missing (e.g., in a local or misconfigured environment), the endpoint became completely open to unauthenticated requests.
**Learning:** Authorization checks should fail securely. If a required authentication secret is missing from the environment, the application should reject all requests rather than bypassing the check, preventing unauthorized access.
**Prevention:** Use an explicit missing variable check (`if (!process.env.CRON_SECRET || authHeader !== ...)`) to ensure the route fails securely.
## 2026-04-12 - [MEDIUM] Added MAX_CONTENT_LENGTH to Flask Apps
**Vulnerability:** Several Flask web applications (`trivia_flashcards`, `sliding_rows_flashcards`, `what_the_spell`, and `where_in_the_world`) were accepting arbitrary-length payload sizes by default. This missing boundary allows an attacker to send an excessively large payload, leading to a Denial of Service (DoS) by exhausting the server's memory.
**Learning:** Default Flask configurations do not enforce a maximum payload size. You must explicitly instruct the server to drop large requests using `MAX_CONTENT_LENGTH`.
**Prevention:** Always set `app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024` (or whatever size is appropriate for the application) to ensure large payloads are rejected safely at the framework level before application logic processes them.

## 2026-04-10 - Removed unsafe-eval and unsafe-inline from Next.js CSP
**Vulnerability:** The 'right-here-right-now' Next.js application's Content Security Policy included 'unsafe-eval' and 'unsafe-inline' in the 'script-src' directive, exposing the application to XSS attacks.
**Learning:** Next.js production builds generally do not require 'unsafe-eval' or 'unsafe-inline' for scripts to function properly.
**Prevention:** Remove 'unsafe-eval' and 'unsafe-inline' from 'script-src' in the CSP headers to enforce a strict security policy against unauthorized script execution.

## 2026-04-16 - [HIGH] Prevent File Upload Race Condition in pdf_grid_flashcards
**Vulnerability:** The `/api/upload` endpoint in `pdf_grid_flashcards/app.py` saved uploaded files using their sanitized original filename (`secure_filename(file.filename)`). If multiple users uploaded a file with the same name simultaneously, the application would overwrite the files on disk, causing a race condition where one user could receive the parsed grid data of another user's PDF.
**Learning:** Relying solely on the client-provided filename (even when sanitized) for temporary storage on a shared filesystem introduces race conditions and potential information disclosure during concurrent requests.
**Prevention:** Always append or prepend a unique identifier (like a UUID) to the filename before saving temporary user uploads to the filesystem, ensuring complete isolation between concurrent request processing.
