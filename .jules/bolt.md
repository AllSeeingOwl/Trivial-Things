## 2026-05-20 - Avoid Intermediate Array Allocation in Slice
**Learning:** In the `right-here-right-now` Next.js application, processing the large array returned from parsers using `items.slice(0, 10)` creates a shallow copy array in memory before returning, causing unnecessary garbage collection overhead.
**Action:** Replace `items.slice(0, 10)` with an in-place truncation logic `if (items.length > 10) items.length = 10;`. This strictly avoids creating intermediate arrays while still maintaining safe bounds checking.
## 2026-05-20 - Stabilize Configuration Object References
**Learning:** In the `right-here-right-now` Next.js application, instantiating large static configuration objects inline within a component function like `WidgetGrid` causes them to be re-allocated in memory on every render.
**Action:** Extract static configuration objects, arrays, and constants to the module scope (outside the component function) to stabilize their references and prevent unnecessary garbage collection overhead during React rendering cycles.
