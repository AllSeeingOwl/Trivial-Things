#!/usr/bin/env python3
"""Build the weekly redundancy report.

Used by .github/workflows/weekly-redundancy-report.yml. Looks for things the
repository carries but does not need: leftover and generated files, files that
.gitignore says should not be tracked, duplicate files, folders whose names
differ only in case, Python dependencies nothing imports, the largest files,
and (from the raw tool output in the audit directory) unused Python code
(vulture) and unused Next.js files, exports and packages (knip).

It only reads. Every finding is a candidate to review, not something to delete
blindly: unused-code tools in particular cannot see dynamic use (Flask routes,
pytest fixtures, Next.js conventions). Missing or malformed tool output is
reported in the Markdown instead of raising, so a report is always produced.

Usage: build_redundancy_report.py <audit-dir> <output-markdown>
Run from the repository root.
"""

import hashlib
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path, PurePosixPath

MAX_ROWS = 25
LARGE_FILE_ROWS = 15

# Files that are almost always leftovers when committed.
LEFTOVER_PATTERNS = [
    (r"\.(orig|rej|bak|old|tmp|swp|swo)$|~$", "editor / merge leftover"),
    (r"\.log$", "log file"),
    (r"\.(db|sqlite|sqlite3)(-journal|-wal|-shm)?$", "database file (apps create these at runtime)"),
    (r"(^|/)__pycache__/|\.py[co]$", "compiled Python"),
    (r"(^|/)(\.DS_Store|Thumbs\.db|desktop\.ini)$", "OS metadata"),
    (r"\.(diff|patch)$", "patch file"),
]
# Empty files that are fine to keep.
EMPTY_OK = re.compile(r"(^|/)(__init__\.py|\.gitkeep|\.keep|py\.typed)$")

# Requirement name -> module it is imported as, where they differ.
IMPORT_ALIASES = {
    "pymupdf": "fitz",
    "beautifulsoup4": "bs4",
    "python_dotenv": "dotenv",
    "pillow": "PIL",
    "pyyaml": "yaml",
    "python_dateutil": "dateutil",
    "scikit_learn": "sklearn",
}
# Packages used from the command line or by other packages rather than imported.
NOT_IMPORTED = {"gunicorn", "waitress", "uvicorn", "pytest", "sqlalchemy", "werkzeug"}


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, check=True).stdout


def tracked_files():
    return [p for p in git("ls-files", "-z").split("\0") if p and os.path.isfile(p)]


def read_text(path, default=""):
    try:
        return Path(path).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return default


def table(headers, rows, limit=MAX_ROWS):
    if not rows:
        return "_None found._\n"
    out = ["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
    for row in rows[:limit]:
        out.append("| " + " | ".join(str(c).replace("|", "\\|") for c in row) + " |")
    if len(rows) > limit:
        out.append(f"\n_…and {len(rows) - limit} more; see the workflow artifact for the full list._")
    return "\n".join(out) + "\n"


def human_size(n):
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024


def code(path):
    return f"`{path}`"


# --- checks -----------------------------------------------------------------

def find_leftovers(files):
    rows = []
    for path in files:
        size = os.path.getsize(path)
        for pattern, reason in LEFTOVER_PATTERNS:
            if re.search(pattern, path):
                rows.append((code(path), reason, human_size(size)))
                break
        else:
            if size == 0 and not EMPTY_OK.search(path):
                rows.append((code(path), "empty file", "0 B"))
    return rows


def find_ignored_but_tracked():
    out = git("ls-files", "-ci", "--exclude-standard", "-z")
    return [(code(p),) for p in out.split("\0") if p]


def find_duplicates(files):
    by_hash = defaultdict(list)
    for path in files:
        size = os.path.getsize(path)
        if size == 0:
            continue  # empty files are reported as leftovers
        with open(path, "rb") as fh:
            by_hash[(size, hashlib.sha256(fh.read()).hexdigest())].append(path)
    groups = [(size, paths) for (size, _), paths in by_hash.items() if len(paths) > 1]
    groups.sort(key=lambda g: g[0] * (len(g[1]) - 1), reverse=True)
    return [
        (len(paths), human_size(size), human_size(size * (len(paths) - 1)), "<br>".join(code(p) for p in sorted(paths)))
        for size, paths in groups
    ]


def find_case_collisions(files):
    seen = defaultdict(set)
    for path in files:
        parts = PurePosixPath(path).parts
        for i in range(1, len(parts) + 1):
            prefix = "/".join(parts[:i])
            seen[prefix.lower()].add(prefix)
    return [("<br>".join(code(v) for v in sorted(variants)),)
            for _, variants in sorted(seen.items()) if len(variants) > 1
            # only report the shallowest point where names diverge
            and len({str(PurePosixPath(v).parent) for v in variants}) == 1]


def normalise(name):
    return re.sub(r"[-_.]+", "_", name).lower()


IMPORT_RE = re.compile(r"^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w., ]+))", re.M)


def find_unused_requirements(files):
    rows = []
    for req in sorted(p for p in files if re.search(r"(^|/)requirements[^/]*\.txt$", p)):
        folder = os.path.dirname(req)
        imported = set()
        other_text = ""
        for path in files:
            if folder and not path.startswith(folder + "/"):
                continue
            if path.endswith(".py"):
                for frm, imp in IMPORT_RE.findall(read_text(path)):
                    for mod in (frm or imp).split(","):
                        mod = mod.strip().split(" ")[0]
                        if mod:
                            imported.add(normalise(mod.split(".")[0]))
            elif re.search(r"(Dockerfile|Procfile|\.ya?ml|\.sh|\.toml|\.ini|\.cfg)$", path):
                other_text += read_text(path).lower()
        for line in read_text(req).splitlines():
            name = re.split(r"[=<>~!;\[\s]", line.strip(), maxsplit=1)[0]
            if not name or name.startswith(("#", "-")):
                continue
            key = normalise(name)
            module = normalise(IMPORT_ALIASES.get(key, key))
            if module in imported or key in imported:  # e.g. `import pymupdf` or `import fitz`
                continue
            if key in NOT_IMPORTED:
                if name.lower() in other_text or key in imported:
                    continue
                note = "not imported or referenced in a Dockerfile/config; may still be a transitive or CLI need"
                if key in {"sqlalchemy", "werkzeug"}:
                    note = "not imported directly; usually pulled in by Flask / Flask-SQLAlchemy anyway"
            else:
                note = "never imported in this folder"
            rows.append((code(req), code(name), note))
    return rows


def find_large_files(files):
    sized = sorted(((os.path.getsize(p), p) for p in files), reverse=True)
    total = sum(s for s, _ in sized)
    rows = [(code(p), human_size(s)) for s, p in sized[:LARGE_FILE_ROWS]]
    return rows, total, len(sized)


VULTURE_RE = re.compile(r"^(?P<file>.+?):(?P<line>\d+): (?P<msg>.+?) \((?P<conf>\d+)% confidence")


def parse_vulture(audit_dir):
    raw = read_text(Path(audit_dir) / "vulture.txt", None)
    if raw is None:
        return None, "vulture did not run (no output file)"
    rows = []
    for line in raw.splitlines():
        m = VULTURE_RE.match(line)
        if m:
            rows.append((f"`{m['file']}:{m['line']}`", m["msg"], f"{m['conf']}%"))
    rows.sort(key=lambda r: -int(r[2].rstrip("%")))
    return rows, None


KNIP_KINDS = {
    "files": "unused file",
    "dependencies": "unused dependency",
    "devDependencies": "unused devDependency",
    "unlisted": "used but not in package.json",
    "binaries": "binary not provided by any dependency",
    "exports": "unused export",
    "types": "unused exported type",
    "enumMembers": "unused enum member",
    "duplicates": "duplicate export",
}


def parse_knip(audit_dir, app_dir):
    status = read_text(Path(audit_dir) / "knip.status").strip()
    try:
        data = json.loads(read_text(Path(audit_dir) / "knip.json"))
    except json.JSONDecodeError:
        return None, status or "knip did not produce JSON output"
    rows = []
    for issue in data.get("issues", []):
        for kind, label in KNIP_KINDS.items():
            for item in issue.get(kind) or []:
                name = item.get("name", "") if isinstance(item, dict) else str(item)
                where = f"{app_dir}/{issue.get('file', '')}"
                if isinstance(item, dict) and item.get("line"):
                    where += f":{item['line']}"
                rows.append((label, code(name), code(where)))
    order = list(KNIP_KINDS.values())
    rows.sort(key=lambda r: order.index(r[0]))
    return rows, None


# --- report -----------------------------------------------------------------

def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    audit_dir, out_path = sys.argv[1], sys.argv[2]
    app_dir = os.environ.get("NEXT_APP_DIR", "right-here-right-now")
    files = tracked_files()

    leftovers = find_leftovers(files)
    ignored = find_ignored_but_tracked()
    duplicates = find_duplicates(files)
    collisions = find_case_collisions(files)
    unused_reqs = find_unused_requirements(files)
    large, total, count = find_large_files(files)
    vulture, vulture_err = parse_vulture(audit_dir)
    knip, knip_err = parse_knip(audit_dir, app_dir)

    def n(rows):
        return "not run" if rows is None else len(rows)

    sections = [
        f"# Weekly redundancy report — {os.environ.get('GITHUB_REPOSITORY', 'Trivial-Things')}",
        f"_Generated {os.environ.get('REPORT_DATE', '')} UTC. Read-only: nothing was changed or deleted. "
        "Each item is a candidate to review — check it is really unused before removing it._",
        "## Summary",
        table(["Check", "Findings"], [
            ("Leftover / generated files committed", n(leftovers)),
            ("Tracked files that .gitignore excludes", n(ignored)),
            ("Groups of identical files", n(duplicates)),
            ("Names differing only in case", n(collisions)),
            ("Python requirements never imported", n(unused_reqs)),
            ("Unused Python code (vulture)", n(vulture)),
            (f"Unused Next.js files / exports / packages (knip, `{app_dir}`)", n(knip)),
            ("Tracked files / total size", f"{count} / {human_size(total)}"),
        ]),
        "## Leftover and generated files",
        "Backups, merge leftovers, logs, local databases, compiled Python, patch files and empty files. "
        "These are usually safe to delete and add to `.gitignore`.\n",
        table(["File", "Why it looks like a leftover", "Size"], leftovers),
        "## Tracked files that `.gitignore` excludes",
        "These were committed before (or despite) a `.gitignore` rule. Remove with `git rm --cached`.\n",
        table(["File"], ignored),
        "## Identical files",
        "Byte-for-byte copies. Some are intentional (a shared helper copied into each app so it deploys alone); "
        "others are stale copies.\n",
        table(["Copies", "Size each", "Wasted", "Files"], duplicates),
        "## Names that differ only in case",
        "These collide on macOS and Windows, where only one of them can exist on disk.\n",
        table(["Paths"], collisions),
        "## Python requirements that nothing imports",
        "Heuristic: compares each `requirements*.txt` with the imports in the same folder.\n",
        table(["Manifest", "Package", "Note"], unused_reqs),
        "## Unused Python code (vulture, ≥80% confidence)",
        "vulture cannot see dynamic use such as Flask routes or pytest fixtures, so check each one.\n",
        f"_{vulture_err}_\n" if vulture is None else table(["Location", "Finding", "Confidence"], vulture),
        f"## Unused Next.js code and packages (knip, `{app_dir}`)",
        f"_knip {read_text(Path(audit_dir) / 'knip.status').strip()}._\n" if knip is not None and read_text(Path(audit_dir) / "knip.status").strip() else "",
        f"_{knip_err}_\n" if knip is None else table(["Kind", "Name", "Location"], knip),
        f"## Largest tracked files (top {LARGE_FILE_ROWS})",
        table(["File", "Size"], large),
    ]
    run_url = os.environ.get("RUN_URL")
    if run_url:
        sections.append(f"\nRaw tool output: {run_url}\n")
    Path(out_path).write_text("\n\n".join(sections), encoding="utf-8")


if __name__ == "__main__":
    main()
