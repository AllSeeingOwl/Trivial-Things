## 2024-05-24 - [CRITICAL] Disable debug=True in where_in_the_world Flask app
**Vulnerability:** The `where_in_the_world` sub-application was running with `app.run(port=5004, debug=True)`. This exposes the interactive Werkzeug debugger on unhandled exceptions.
**Learning:** Leaving `debug=True` in production or globally exposed Flask apps allows remote code execution (RCE) and leaks sensitive stack traces, undermining the security of the application.
**Prevention:** Always verify `debug=False` for Flask applications. Implement automated checks (e.g., linters or security scanners) to detect `debug=True` in `app.run()` calls before merging code.

## 2024-05-27 - [MEDIUM] Fix unhandled ValueError in /api/questions
**Vulnerability:** The `/api/questions` endpoint converted `request.args.get('count')` directly to an integer without wrapping it in a `try/except` block or checking bounds. Submitting `count=abc` resulted in an unhandled `ValueError`, crashing the application and leaking a 500 error stack trace.
**Learning:** All user inputs, especially query parameters used for size or count limits, must be validated and bounded. Failing to do so can lead to DoS or information disclosure via stack traces.
**Prevention:** Always validate route parameters expecting integers using `try/except ValueError` blocks and perform necessary bound checks (e.g. `count <= 0`).
