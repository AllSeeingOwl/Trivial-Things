# Release Readiness Assessment

This report assesses the readiness of the 8 applications in this repository for release or packaging (e.g., as Docker containers, Python packages/PyPI, standalone executables, or stable versioned releases).

## Executive Summary

**Overall Assessment: NOT READY.**
Currently, **none** of the applications meet the 80% readiness benchmark for a formal release. While they are functional as development prototypes, they share several fundamental issues preventing safe and reliable distribution:

1. **Lack of Packaging:** No applications have a `Dockerfile`, `setup.py`, `pyproject.toml`, or configuration for building standalone executables.
2. **Hardcoded Configurations (Resolved):** Flask apps previously had hardcoded host bindings, ports, and data source file paths. These have now been decoupled and use environment variables (`HOST`, `PORT`, `CSV_FILE`).
3. **Incomplete Dependencies:** Some apps (`pdf_grid_flashcards`, `what_the_spell`) are completely missing `requirements.txt` files despite relying on external libraries like `fitz` (PyMuPDF) or `flask`.
4. **Missing Documentation:** Several apps lack their own `README.md` files, providing no setup or usage instructions for users.
5. **Testing Architecture:** While tests exist for most apps, they are currently fragile or broken due to import errors (e.g., namespace collisions between the different `app.py` files in the repository) and lack proper isolation/mocking for the test runner.

---

## Individual App Assessments

### 1. `mcq_flashcards`
*   **Readiness:** ~40%
*   **Documentation:** Has a good `README.md`.
*   **Dependencies:** Has `requirements.txt`.
*   **Testing:** Has unit tests, but they currently fail to run due to import environment issues.
*   **Issues:** CSV file path is configurable but defaults to local. Modifies the CSV in place, which makes it unsuitable for a read-only Docker container or installed Python package unless state is decoupled.
*   **Recommendation:** Docker container (with a mounted volume for the CSV) or PyInstaller executable. Needs path virtualization for the CSV.

### 2. `pdf_grid_flashcards`
*   **Readiness:** ~40%
*   **Documentation:** Has a good `README.md`.
*   **Dependencies:** Has `requirements.txt`.
*   **Testing:** Has `test_app.py`, but it has namespace conflicts.
*   **Issues:** Contains hardcoded directory paths (`bbc_big_read_flashcards/`) in `parse_pdf.py` that don't even exist in the repo. Port is now configurable via environment variables.
*   **Recommendation:** Docker container. Needs major refactoring to remove missing hardcoded local directories.

### 3. `right-here-right-now`
*   **Readiness:** ~60%
*   **Documentation:** Has a generic Next.js `README.md`.
*   **Dependencies:** Has `package.json` and lockfiles.
*   **Testing:** Missing a test suite.
*   **Issues:** It is a Next.js application, making it the closest to being "deployable" (e.g., to Vercel), but it lacks specific documentation explaining what the app does, and it lacks unit/integration tests.
*   **Recommendation:** Vercel deployment or Docker container (via Next.js standalone build). Needs tests and a proper README.

### 4. `sliding_rows_flashcards`
*   **Readiness:** ~40%
*   **Documentation:** Has a good `README.md`.
*   **Dependencies:** Has `requirements.txt`.
*   **Testing:** Has `test_app.py`, but failing due to imports.
*   **Issues:** Port and CSV file path are now configurable via environment variables. Modifies state in place.
*   **Recommendation:** Docker container or PyInstaller. Needs state/configuration decoupling.

### 5. `trivia_flashcards`
*   **Readiness:** ~40%
*   **Documentation:** Has a good `README.md`.
*   **Dependencies:** Has `requirements.txt`.
*   **Testing:** Has tests, but failing.
*   **Issues:** Similar to MCQ Flashcards. Port is configurable. CSV file is modified in-place (configurable path).
*   **Recommendation:** Docker container (with mounted volume) or PyInstaller. Needs configuration abstraction.

### 6. `what_the_spell`
*   **Readiness:** ~40%
*   **Documentation:** Has a good `README.md`. (Also has `What The Spell Grids.md`).
*   **Dependencies:** Has `requirements.txt`.
*   **Testing:** Has `test_app.py`, but failing.
*   **Issues:** Port is configurable via environment variables.
*   **Recommendation:** Docker container or PyInstaller.

### 7. `where_in_the_world`
*   **Readiness:** ~50%
*   **Documentation:** Has a good `README.md`.
*   **Dependencies:** Has `requirements.txt`.
*   **Testing:** Has a decent test suite, but failing environment.
*   **Issues:** Port and CSV read path are configurable via environment variables. Security updates have been applied (no `debug=True`), but lacks packaging structure.
*   **Recommendation:** Docker container or Python Package (if bundled with static assets).

### 8. `whovian_degrees`
*   **Readiness:** ~50%
*   **Documentation:** Has a good `README.md`.
*   **Dependencies:** Has `requirements.txt`.
*   **Testing:** Has `test_app.py`, but failing.
*   **Issues:** Port is configurable via environment variables. Relies on `GEMINI_API_KEY` (which is good practice for secrets).
*   **Recommendation:** Docker container.

---

## Action Plan for Reaching 80% Readiness

To make these apps ready for release, the following generic steps should be applied to the repository:

1. **Decouple Configuration:** ~~Replace hardcoded paths (like `CSV_FILE = '...'`), ports, and host addresses in Flask apps with environment variables (e.g., `os.environ.get('PORT', 5000)`).~~ (Completed)
2. **Complete Dependencies:** ~~Add `requirements.txt` to `pdf_grid_flashcards` and `what_the_spell`.~~ (Completed)
3. **Write Documentation:** ~~Add a standardized `README.md` to the apps currently missing one.~~ (Completed)
4. **Fix Test Discovery:** Rename `app.py` in each folder to something unique, or fix the `pytest` configuration (e.g., adding `__init__.py` files or using isolated test tox/nox environments) so tests run reliably.
5. **Add Packaging:** Create a basic `Dockerfile` for each application. This is the most universal and reliable way to package these types of web apps.