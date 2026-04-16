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

## 2026-03-30 - Parallelize Asynchronous API Calls with UI Animations
**Learning:** In applications like `mcq_flashcards` and `trivia_flashcards`, the UI sequentially waited for a 300ms CSS flip animation to complete before it even initiated the network request (`fetch('/api/question')`) for the next item. This strictly linear execution meant users experienced both the animation time AND the network latency consecutively.
**Action:** When transitioning state requires both a UI animation (like a timeout or transition end) and a data fetch, decouple them. Initiate the `fetch()` Promise immediately *before* awaiting the UI animation, and `await` the network response *after* the animation block. This allows the network request to run concurrently, effectively hiding the network latency behind the animation timeframe.

## 2026-03-31 - Python Generator Expressions vs Intermediate Lists
**Learning:** In Python, creating intermediate lists using list comprehension just to count items using `len()` (e.g., `len([x for x in items if condition])`) has significant memory overhead, especially for larger datasets.
**Action:** Always use generator expressions with `sum()` (e.g., `sum(1 for x in items if condition)`) when counting filtered items to avoid constructing and storing unnecessary intermediate lists in memory.

## 2026-04-01 - Prevent Memory Leaks in Large DOM Renders using Event Delegation
**Learning:** In frontend grids (`pdf_grid_flashcards`, `what_the_spell`), generating DOM elements in double-loops and assigning anonymous `click` and `keydown` event listeners directly to every individual cell allocates O(N) separate closures per render. On frequent re-renders (like resetting the board or parsing a new PDF), this causes significant memory overhead and garbage collection pauses.
**Action:** Always implement the Event Delegation pattern for interactive grid structures. Attach a single `click` and `keydown` event listener to the parent container, and resolve the interacted child using `event.target.closest('.cell')`. This reduces listener count to O(1) and eliminates closure leaks across re-renders.

## 2026-04-05 - O(log N) Binary Search for Coordinate Matching
**Learning:** In the `pdf_grid_flashcards` application, using the built-in `min()` function over an entire array sequentially for every coordinate on every word caused an O(N) performance bottleneck when iterating over thousands of words in a PDF.
**Action:** When finding the closest numerical value from a large list of elements (e.g. coordinates), sort the list and use `bisect.bisect_left` to perform an O(log N) binary search. This drastically reduces coordinate matching time and improves parsing speeds.

## 2026-04-06 - Caching Rate-Limited External APIs on the Frontend
**Learning:** When interacting with third-party, rate-limited APIs (like Nominatim for geocoding) on the frontend, redundant network requests for identical user queries can cause unnecessary UI latency and trigger API limits. In `where_in_the_world`, repeated searches for the same location name triggered multiple `fetch` calls.
**Action:** Use a JavaScript `Map` in the application state to cache responses from external rate-limited APIs, using the user's query as the key. Always check the cache (`.has()`) and return the saved result before initiating a new network fetch, completely avoiding redundant requests.

## 2026-04-07 - Event Delegation for Frontend Performance
**Learning:** Attaching separate `click` and `keydown` event listeners inside loops when generating lists or rows creates O(N) memory overhead and potential garbage collection pauses when those lists are frequently re-rendered. In `sliding_rows_flashcards`, row event listeners also required preserving closure variables for state.
**Action:** Always use Event Delegation by attaching a single event listener to the parent container. Use DOM data attributes (like `data-state`) to replace closure-bound variables, allowing the generic handler to retrieve and manage individual item state securely.

## 2026-04-08 - Skip Default Values During Bulk Resets
**Learning:** In operations that reset data to a default state (like `reset_all_questions`), iteratively padding and rewriting every single row—including those already in the default state—causes unnecessary memory allocation and string operations.
**Action:** Always add an early `continue` guard (e.g., `if not item['used']: continue`) inside reset loops. This skips processing for items that are already clean, saving O(N) list operations on mostly-unused data structures.

## 2026-04-09 - Eliminate Redundant Disk Reads on CSV State Updates
**Learning:** In applications that manage state by writing back to CSV files (like `mcq_flashcards`, `trivia_flashcards`, `sliding_rows_flashcards`), the previous `update_used_status()` and `reset()` functions read the entire CSV from disk just to modify a single row before writing it back. While `_questions_cache` stored the transformed data for fast lookups, it didn't store the raw row structure, forcing this redundant I/O.
**Action:** Always maintain a synchronized `_raw_csv_cache` (e.g. `list(csv.reader(f))`) alongside the transformed object cache. This allows write operations to instantly modify the in-memory raw array and directly write to disk, completely eliminating the O(N) disk read bottleneck on every state update.

## 2026-04-10 - Stabilizing Object References to Prevent Re-renders
**Learning:** In the React component `DashboardMasonry` for the Next.js `right-here-right-now` app, passing an inline or locally instantiated object (like `breakpointColumnsObj`) as a prop to a complex layout component (like `Masonry`) causes it to be re-created on every render. This forces the child component to unnecessarily re-render, consuming CPU cycles and potentially causing layout shifts.
**Action:** Always move static configuration objects outside the React component function definition, so they hold a stable reference across renders, preventing expensive unnecessary layout re-renders.
## 2026-04-14 - Stabilizing array reference in WidgetCardSkeleton
**Learning:** In the `right-here-right-now` application, using inline array creation `[...Array(5)]` inside a frequently rendered component like `WidgetCardSkeleton` causes unnecessary memory allocation and garbage collection overhead on every render cycle.
**Action:** Always extract static arrays and objects (like `SKELETON_ROWS`) outside of React component definitions so they maintain a stable reference across renders.

## 2026-04-17 - Pure CSS Replacement for Client-Side Masonry
**Learning:** In the `right-here-right-now` application, the `DashboardMasonry` component relied on the `react-masonry-css` library. This necessitated the `'use client'` directive, pulling down JavaScript layout code to the browser and executing layout calculations on window resizes (causing layout thrashing). Next.js Server Components are completely bypassed by this.
**Action:** Always replace heavy JS-driven layout libraries with native CSS features when possible. Using Tailwind's `columns-1 md:columns-1 lg:columns-2 xl:columns-3 2xl:columns-4` alongside `break-inside-avoid` completely replicates masonry. Crucially, removing the `'use client'` directive converts the component into a 100% Server Component, massively reducing client JS bundle size and improving Time to Interactive.

## 2024-04-18 - Avoid string splitting before regex search
**Learning:** In the `where_in_the_world` application, the text was split by newline (`text.split('\n')`) creating an intermediate list of string segments, before iterating over them with `re.search()`. Python's `re.search()` naturally searches multiline strings without needing this. This redundant split caused significant memory allocation overhead.
**Action:** Always let `re.search()` search over a complete string if you only need a single match anywhere in the string, rather than manually splitting the string and searching line-by-line.
