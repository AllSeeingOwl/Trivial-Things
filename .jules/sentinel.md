## 2026-03-21 - [Debug Mode in Production]
**Vulnerability:** Flask was running with `debug=True` bound to a public interface (`0.0.0.0`), allowing potential interactive debugger RCE and information disclosure via stack traces on unhandled exceptions (e.g., malformed `q_id` inputs).
**Learning:** Hardcoded development configurations in the main application entry point pose a severe risk if deployed without environment-specific overrides.
**Prevention:** Always default to `debug=False` and use environment variables (e.g., `FLASK_DEBUG`) to toggle debug features only in local development environments.

## 2026-03-21 - [Missing Null/Type Check for JSON Payload]
**Vulnerability:** The `/api/mark_used` endpoint did not check if `request.json` was `None` or not a dictionary before calling `.get()`. This could lead to a server crash (Internal Server Error) if a request was sent with an invalid or empty JSON payload.
**Learning:** Flask's `request.json` can return `None` if the payload is missing, malformed, or has the wrong `Content-Type`. Directly accessing methods on it without validation is unsafe.
**Prevention:** Always validate that JSON payloads are present and of the expected type (usually `dict`) before attempting to access their fields.

## 2026-03-22 - [Exposed Werkzeug Debugger in Sub-Application]
**Vulnerability:** The Flask application in `what_the_spell/app.py` was configured with `debug=True` and `host='0.0.0.0'`, exposing the Werkzeug interactive debugger to all network interfaces. This allows arbitrary remote code execution (RCE).
**Learning:** Sub-applications or micro-apps within a repository might have different configurations than the main application. It is crucial to verify the security configurations (like debug mode) across all applications in a monorepo or project with multiple entry points.
**Prevention:** Ensure `debug=False` is the default in all production or externally accessible Flask applications. Implement automated checks (e.g., linters or security scanners) to detect `debug=True` in `app.run()` calls before merging code.
## 2024-05-30 - [pdf_grid_flashcards - Prevent RCE via debug mode and limit file uploads]
**Vulnerability:** Flask `app.run(debug=True, host='0.0.0.0')` was exposing the interactive Werkzeug debugger. No file upload limits were set, leading to DoS risks. Internal errors were leaked via generic exception string casts.
**Learning:** Development settings (`debug=True`) left in production endpoints, especially those exposed globally (`0.0.0.0`), can lead to arbitrary code execution (RCE).
**Prevention:** Always verify `debug=False` for Flask applications bound to public interfaces. Implement `MAX_CONTENT_LENGTH` for file uploads, and mask internal errors to prevent information disclosure.

## 2024-05-30 - [pdf_grid_flashcards - Prevent DOM-Based XSS in Error Messages]
**Vulnerability:** The application was vulnerable to DOM-based Cross-Site Scripting (XSS) because it injected API response error messages (`data.error`) directly into the DOM using `.innerHTML`.
**Learning:** Even if the backend controls the error message currently, injecting dynamic data via `.innerHTML` is a risky pattern. If backend validation fails or is changed later to reflect user input in errors, XSS can occur.
**Prevention:** Never use `.innerHTML` with string concatenation containing dynamic data. Always use `document.createElement()` and assign the data safely via `.textContent` to ensure the browser treats it as text, not executable HTML/JavaScript.
