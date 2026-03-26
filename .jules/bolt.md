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