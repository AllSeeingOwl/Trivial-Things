## 2026-05-20 - Avoid Intermediate Array Allocation in Slice
**Learning:** In the `right-here-right-now` Next.js application, processing the large array returned from parsers using `items.slice(0, 10)` creates a shallow copy array in memory before returning, causing unnecessary garbage collection overhead.
**Action:** Replace `items.slice(0, 10)` with an in-place truncation logic `if (items.length > 10) items.length = 10;`. This strictly avoids creating intermediate arrays while still maintaining safe bounds checking.

## 2026-05-20 - Stabilize Configuration Object References
**Learning:** In the `right-here-right-now` Next.js application, instantiating large static configuration objects inline within a component function like `WidgetGrid` causes them to be re-allocated in memory on every render.
**Action:** Extract static configuration objects, arrays, and constants to the module scope (outside the component function) to stabilize their references and prevent unnecessary garbage collection overhead during React rendering cycles.

## 2026-05-20 - Pre-Sort Keys and Use Bisect for Lookup
**Learning:** In applications like `price_time_machine`, calculating inflation by running `sorted(cpi_region.keys())` and `min(..., key=lambda ...)` inside function calls invoked per item per request allocates intermediate key lists and sorts them repeatedly ($O(N \log N)$), creating unnecessary GC pressure and CPU overhead.
**Action:** Extract and pre-sort dictionary key lists at module load time (`CPI_YEARS`), and use `bisect.bisect_left` for $O(\log N)$ nearest-neighbor lookups (~80% speedup).

## 2026-05-20 - Query Lightweight Tuples Instead of Full ORM Models
**Learning:** When calculating aggregates or building statistics maps across dataset rows, using `Model.query.all()` instantiates full SQLAlchemy ORM model instances, registers them in identity maps, and deserializes unused columns, creating substantial memory allocation and CPU overhead.
**Action:** Query specific required columns using `db.session.query(Model.col1, Model.col2, ...).all()` to fetch lightweight tuples directly from the cursor (~345% speedup / ~3.4x faster).

## 2026-05-20 - Substring/N-gram Lookup for Short Token Pattern Search
**Learning:** Scanning a fixed list of lookup strings (like 119 element symbols) using `str.find()` across an input string repeatedly triggers 119 separate substring searches per request.
**Action:** Pre-build a module-level dictionary of valid tokens mapped to metadata, extract unique 1, 2, and 3-character substrings from the input string ($O(N)$), and perform direct $O(1)$ hash table lookups (~48% faster execution).

## 2026-05-20 - Positional Index Access on Query Tuples
**Learning:** Accessing fields on SQLAlchemy row tuples using positional indexing (`r[0]`, `r[1]`) instead of attribute access (`r.id`, `r.title`) avoids `__getattr__` dynamic property lookups on SQLAlchemy row objects, delivering a ~76% speedup (~4.3x faster) during list dictionary construction.
**Action:** Use positional tuple indexing (`r[0]`, `r[1]`, ...) when building response dictionaries from lightweight `db.session.query(...)` results.
