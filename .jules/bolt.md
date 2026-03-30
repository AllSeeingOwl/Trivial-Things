## 2024-05-24 - Redundant file I/O operations and Caching
**Learning:** This application previously read and parsed the entire CSV database on every single `/api/question` and `/api/stats` endpoint access. Because the frontend sequentially accesses these endpoints per question skip or mark used, each UI action triggered two redundant file reads. Storing a persistent, module-level in-memory cache directly avoids this and resolves a noticeable bottleneck when reading big CSV databases.
**Action:** When a web application relies purely on file parsing for its data access, use module-level variables or an in-memory database representation to cache the results and only sync writes to disk to greatly cut down on file system access per request.

## 2024-05-24 - Batching API responses for statistics
**Learning:** The frontend made sequentially dependent HTTP requests: loading a question via `/api/question` and then immediately fetching stats via `/api/stats`. This caused significant network overhead and duplication of effort on the backend to count used questions on every UI cycle.
**Action:** When data dependencies are closely tied to the same backend state and always required together (like a question and current statistics), modify the primary endpoint to return a batched data payload. This effectively halves the total number of network HTTP requests needed by the UI to render.

## 2026-03-25 - Batch DOM Insertions with DocumentFragment
**Learning:** Inserting DOM elements one-by-one inside a loop causes unnecessary repaints and reflows. Across `what_the_spell`, `pdf_grid_flashcards`, and `sliding_rows_flashcards`, large loops appending elements directly to `gridContainer` or `chainContainer` were causing layout trashing.
**Action:** Use `const fragment = document.createDocumentFragment()` to batch DOM nodes before inserting them into the actual document. This reduces reflows and repaints to exactly 1 operation.

## 2026-03-26 - Providing payloads on 404 responses
**Learning:** When batching network requests, returning a `404` status code for an exhausted list (e.g. no more questions) can inadvertently skip updating batched fields like statistics if the response is completely empty. The frontend might still need that data to display the "0 remaining" state accurately.
**Action:** Always include the batched data payload alongside the `error` message in `404 Not Found` API responses, and ensure the frontend parses it even if the request is not "ok".
## 2026-03-27 - Redundant Expensive PyMuPDF Method Calls
**Learning:** In the `pdf_grid_flashcards` application, the expensive `page.get_drawings()` vector graphic extraction was originally called twice for the best matching page—once during the discovery loop and again afterward. Caching expensive method outputs within iterative searches prevents major redundant compute overhead, significantly reducing parsing time (30-50% improvement for typical 1-page files).
**Action:** When searching through items using an expensive operation, define a tracking variable (`best_drawings = None`) to store the result along with the optimal item, so it does not need to be recomputed when the search loop finishes.

## 2026-03-28 - Removing redundant O(N) operations in lookups
**Learning:** In `where_in_the_world`, a fast O(1) dictionary lookup for retrieving questions by ID was already implemented, but an older O(N) linear search using a generator expression was still left in the code, completely overriding the fast lookup.
**Action:** When converting lists to dictionaries for O(1) lookups, ensure that all subsequent O(N) searches using the old list structure within the same scope are completely removed, otherwise the performance optimization is negated.

## 2026-03-29 - O(N) Cache Sync to O(1) Dictionary Lookup
**Learning:** In the `mcq_flashcards` and `trivia_flashcards` applications, keeping the in-memory cache synchronized with the CSV disk writes caused an O(N) linear search bottleneck inside `update_used_status()`. Converting the entire cache from a `list` to a `dict` (indexed by question ID) changed this operation to an O(1) lookup.
**Action:** When working with frequently accessed in-memory caches that require updates to individual elements, structure the cache as a dictionary `key: object` instead of a flat list, eliminating costly O(N) loops when modifying state.
