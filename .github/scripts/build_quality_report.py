#!/usr/bin/env python3
"""Build the weekly quality report from raw audit output.

Used by .github/workflows/weekly-quality-report.yml. Reads whatever raw files
the audit steps managed to produce in the audit directory and writes a Markdown
report. Every section is best-effort: missing or malformed input is reported in
the Markdown instead of raising, so a report is always produced.

Usage: build_quality_report.py <audit-dir> <output-markdown>
"""

import json
import os
import re
import sys
from pathlib import Path

MAX_ROWS = 15
SEVERITY_ORDER = {"critical": 0, "high": 1, "moderate": 2, "medium": 2, "low": 3, "info": 4}
LIGHTHOUSE_CATEGORIES = ["performance", "accessibility", "best-practices", "seo"]


def load_json(path):
    """Return (data, None) on success or (None, reason) on failure."""
    try:
        text = Path(path).read_text(encoding="utf-8", errors="replace")
    except FileNotFoundError:
        return None, "output file was not created"
    except OSError as exc:
        return None, f"could not read output ({exc})"
    if not text.strip():
        return None, "output file was empty"
    try:
        return json.loads(text), None
    except json.JSONDecodeError as exc:
        return None, f"output was not valid JSON ({exc.msg})"


def read_text(path, default=""):
    try:
        return Path(path).read_text(encoding="utf-8", errors="replace").strip()
    except OSError:
        return default


def tail(path, lines=8):
    text = read_text(path)
    return "\n".join(text.splitlines()[-lines:]) if text else ""


def cell(value, limit=160):
    """Make a value safe for a single Markdown table cell."""
    text = re.sub(r"\s+", " ", str(value if value is not None else "")).strip()
    text = text.replace("|", "\\|")
    return text if len(text) <= limit else text[: limit - 1] + "…"


def strip_md_links(text):
    return re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text or "")


def code_block(text):
    return ["```text", text.replace("```", "'''"), "```"] if text else []


# --------------------------------------------------------------------------- #
# Bandit
# --------------------------------------------------------------------------- #
def bandit_section(audit):
    out = ["## Python static analysis (Bandit)", ""]
    data, err = load_json(audit / "bandit.json")
    if err:
        out.append(f"- ⚠️ Bandit could not be summarised: {err}.")
        log = tail(audit / "bandit.log")
        if log:
            out += ["", *code_block(log)]
        return out + [""]

    results = data.get("results") or []
    errors = data.get("errors") or []
    loc = (data.get("metrics") or {}).get("_totals", {}).get("loc")
    counts = {}
    for r in results:
        counts[r.get("issue_severity", "UNDEFINED")] = counts.get(r.get("issue_severity", "UNDEFINED"), 0) + 1

    out.append(
        f"Scanned all Python files in the repository (medium severity and above; "
        f"{loc if loc is not None else 'unknown'} lines of code)."
    )
    if not results:
        out.append("- ✅ No medium- or high-severity findings.")
    else:
        summary = ", ".join(f"{k.lower()}: {v}" for k, v in sorted(counts.items()))
        out += [f"- **{len(results)} finding(s)** ({summary}).", ""]
        out += ["| Severity / confidence | Test | Location | Issue |", "| --- | --- | --- | --- |"]
        ranked = sorted(
            results,
            key=lambda r: (
                SEVERITY_ORDER.get(str(r.get("issue_severity", "")).lower(), 9),
                SEVERITY_ORDER.get(str(r.get("issue_confidence", "")).lower(), 9),
                r.get("filename", ""),
            ),
        )
        for r in ranked[:MAX_ROWS]:
            loc_ref = f"`{str(r.get('filename', '?')).lstrip('./')}:{r.get('line_number', '?')}`"
            out.append(
                f"| {cell(r.get('issue_severity'))} / {cell(r.get('issue_confidence'))} "
                f"| {cell(r.get('test_id'))} {cell(r.get('test_name'))} | {loc_ref} | {cell(r.get('issue_text'))} |"
            )
        if len(results) > MAX_ROWS:
            out.append(f"\n_{len(results) - MAX_ROWS} more finding(s) in `bandit.json` in the workflow artifact._")
    if errors:
        out.append(f"- ⚠️ Bandit reported {len(errors)} file(s) it could not parse (see `bandit.json`).")
    return out + [""]


# --------------------------------------------------------------------------- #
# pip-audit
# --------------------------------------------------------------------------- #
def unpinned_requirements(manifest):
    """Return requirement lines that are not pinned with ==."""
    names = []
    for raw in read_text(manifest).splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line or line.startswith("-"):
            continue
        if "==" not in line:
            names.append(line)
    return names


def pip_audit_section(audit, repo_root):
    out = ["## Python dependencies (pip-audit)", ""]
    index_file = audit / "pip-audit" / "manifests.tsv"
    rows = []
    for line in read_text(index_file).splitlines():
        parts = line.split("\t")
        if len(parts) >= 3:
            rows.append(parts[:3])  # manifest, slug, exit code

    if not rows:
        out.append("- ⚠️ No `requirements*.txt` manifests were recorded, so no Python dependencies were audited.")
        return out + [""]

    table = ["| Manifest | Result | Notes |", "| --- | --- | --- |"]
    vulns = []
    failed = []
    for manifest, slug, code in rows:
        data, err = load_json(audit / "pip-audit" / f"{slug}.json")
        unpinned = unpinned_requirements(repo_root / manifest)
        notes = []
        if unpinned:
            notes.append("unpinned: " + ", ".join(f"`{n}`" for n in unpinned) + " (latest resolvable version audited)")
        if err or not isinstance(data, dict):
            failed.append(manifest)
            reason = err or "unexpected output format"
            log = tail(audit / "pip-audit" / f"{slug}.log", 1)
            table.append(f"| `{manifest}` | ⚠️ not audited (exit {cell(code)}) | {cell(reason)}{'; ' + cell(log, 200) if log else ''} |")
            continue
        deps = data.get("dependencies") or []
        found = [(d, v) for d in deps for v in (d.get("vulns") or [])]
        skipped = [d for d in deps if d.get("skip_reason")]
        if skipped:
            notes.append(f"{len(skipped)} package(s) skipped by pip-audit")
        for d, v in found:
            vulns.append((manifest, d, v))
        result = f"❌ {len(found)} known vulnerability(ies)" if found else f"✅ no known vulnerabilities ({len(deps)} packages)"
        table.append(f"| `{manifest}` | {result} | {cell('; '.join(notes), 300)} |")

    out.append(f"Checked {len(rows)} manifest(s); {len(rows) - len(failed)} audited successfully.")
    if failed:
        out.append(f"- ⚠️ **Could not audit:** {', '.join(f'`{m}`' for m in failed)}. Raw logs are in the artifact.")
    out += ["", *table, ""]
    if vulns:
        out += ["### Vulnerable Python packages", "", "| Manifest | Package | Advisory | Fixed in |", "| --- | --- | --- | --- |"]
        for manifest, d, v in vulns[:MAX_ROWS * 2]:
            ids = ", ".join([v.get("id", "?"), *(v.get("aliases") or [])][:3])
            fixes = ", ".join(v.get("fix_versions") or []) or "no fix listed"
            out.append(f"| `{manifest}` | {cell(d.get('name'))} {cell(d.get('version'))} | {cell(ids)} | {cell(fixes)} |")
        out.append("")
    return out


# --------------------------------------------------------------------------- #
# pnpm audit (Next.js app)
# --------------------------------------------------------------------------- #
def pnpm_section(audit):
    out = ["## Next.js dependencies (`right-here-right-now`, pnpm audit)", ""]
    status = read_text(audit / "pnpm-audit.status")
    if status.startswith("skipped"):
        out.append(f"- ⚠️ Not audited: {status}.")
        return out + [""]

    data, err = load_json(audit / "pnpm-audit.json")
    if not err and isinstance(data, dict) and "error" in data:
        e = data["error"]
        err = f"pnpm reported an error: {e.get('code', '')} {e.get('message', e) if isinstance(e, dict) else e}"
    if err or not isinstance(data, dict) or "metadata" not in data:
        out.append(f"- ⚠️ Could not audit: {err or 'unexpected output format'}.")
        log = tail(audit / "pnpm-audit.log")
        if log:
            out += ["", *code_block(log)]
        return out + [""]

    meta = data.get("metadata") or {}
    counts = meta.get("vulnerabilities") or {}
    total = sum(v for v in counts.values() if isinstance(v, int))
    out.append(
        f"Audited `right-here-right-now/pnpm-lock.yaml` ({meta.get('totalDependencies', '?')} resolved packages, "
        f"including dev dependencies). No install or fix was performed."
    )
    if not total:
        out.append("- ✅ No known vulnerabilities.")
        return out + [""]

    order = ["critical", "high", "moderate", "low", "info"]
    out.append("- **" + str(total) + " advisory match(es)**: " + ", ".join(f"{k}: {counts.get(k, 0)}" for k in order) + ".")
    # Group advisories by package so one noisy transitive dependency does not hide the rest.
    packages = {}
    for a in (data.get("advisories") or {}).values():
        if isinstance(a, dict):
            packages.setdefault(a.get("module_name", "?"), []).append(a)

    def rank(a):
        return SEVERITY_ORDER.get(str(a.get("severity")).lower(), 9)

    rows = sorted(packages.items(), key=lambda kv: (min(rank(a) for a in kv[1]), -len(kv[1]), kv[0]))
    if rows:
        out += [
            "",
            "| Package | Highest severity | Advisories | Worst advisory | Example dependency path |",
            "| --- | --- | --- | --- | --- |",
        ]
        for name, advs in rows[:MAX_ROWS]:
            worst = min(advs, key=rank)
            paths = [p for f in (worst.get("findings") or []) for p in (f.get("paths") or [])]
            title = cell(worst.get("title"), 90)
            link = f"[{title}]({worst.get('url')})" if worst.get("url") else title
            out.append(
                f"| {cell(name)} | {cell(worst.get('severity'))} | {len(advs)} "
                f"| {link} (patched: `{cell(worst.get('patched_versions'), 40)}`) | `{cell(paths[0] if paths else '', 90)}` |"
            )
        if len(rows) > MAX_ROWS:
            out.append(f"\n_{len(rows) - MAX_ROWS} more package(s) in `pnpm-audit.json` in the workflow artifact._")
    return out + [""]


# --------------------------------------------------------------------------- #
# Lighthouse
# --------------------------------------------------------------------------- #
def lighthouse_section(audit, url):
    out = ["## Lighthouse (deployed site)", ""]
    out.append(f"Target: <{url}>")
    probe, _ = load_json(audit / "lighthouse-probe.json")
    if isinstance(probe, dict):
        title = read_text(audit / "lighthouse-probe.title") or "(no <title> found)"
        out.append(
            f"- Pre-check: HTTP {probe.get('http_code', '?')}, final URL `{probe.get('url_effective', '?')}`, "
            f"page title “{cell(title, 120)}”."
        )
    if "trivial-things.onrender.com" in url:
        out.append(
            "- **Coverage limitation:** this URL is the `trivial-things` Render *static site* that publishes `portal/`. "
            "It is a landing page whose app links point to `localhost` ports, so these scores describe only the portal "
            "page. The Flask apps and the Next.js app (`right-here-right-now`) are separate Render services and are "
            "**not** covered by this Lighthouse run."
        )
    else:
        out.append("- **Coverage limitation:** only this single URL was tested; other apps were not.")
    out.append("")

    data, err = load_json(audit / "lighthouse.report.json")
    if err or not isinstance(data, dict):
        out.append(f"- ⚠️ Lighthouse results unavailable: {err or 'unexpected output format'}.")
        log = tail(audit / "lighthouse.log")
        if log:
            out += ["", *code_block(log)]
        return out + [""]

    runtime = data.get("runtimeError") or {}
    if runtime.get("code"):
        out.append(f"- ⚠️ Lighthouse runtime error `{runtime.get('code')}`: {cell(runtime.get('message'), 300)}")
    for warning in (data.get("runWarnings") or [])[:3]:
        out.append(f"- ⚠️ Lighthouse warning: {cell(strip_md_links(warning), 300)}")
    if data.get("finalDisplayedUrl"):
        out.append(f"- Final URL tested: `{data['finalDisplayedUrl']}` (Lighthouse {data.get('lighthouseVersion', '?')}, "
                   f"{(data.get('configSettings') or {}).get('formFactor', '?')} emulation)")

    categories = data.get("categories") or {}
    audits = data.get("audits") or {}
    out += ["", "| Category | Score |", "| --- | --- |"]
    for cid in LIGHTHOUSE_CATEGORIES:
        cat = categories.get(cid)
        score = cat.get("score") if isinstance(cat, dict) else None
        if isinstance(score, (int, float)):
            pct = round(score * 100)
            badge = "🟢" if pct >= 90 else "🟠" if pct >= 50 else "🔴"
            out.append(f"| {cat.get('title', cid)} | {badge} {pct}/100 |")
        else:
            out.append(f"| {cid} | n/a |")

    # Failed audits / opportunities, limited to the four reported categories.
    weighted = {}
    for cid in LIGHTHOUSE_CATEGORIES:
        cat = categories.get(cid)
        for ref in (cat.get("auditRefs") or []) if isinstance(cat, dict) else []:
            aid = ref.get("id")
            if aid and (aid not in weighted or ref.get("weight", 0) > weighted[aid][1]):
                weighted[aid] = (cat.get("title", cid), ref.get("weight", 0))

    failed = []
    for aid, (cat_title, weight) in weighted.items():
        a = audits.get(aid)
        if not isinstance(a, dict):
            continue
        score = a.get("score")
        if a.get("scoreDisplayMode") in {"notApplicable", "informative", "manual", "error"} or not isinstance(score, (int, float)):
            continue
        if score >= 0.9:
            continue
        savings = 0
        details = a.get("details") or {}
        if isinstance(details, dict):
            savings = details.get("overallSavingsMs") or 0
        failed.append((score, -weight, -savings, aid, cat_title, a))

    failed.sort()
    out += ["", "### Most relevant failed audits / opportunities", ""]
    if not weighted or runtime.get("code"):
        out.append("- ⚠️ No usable audit results (see the runtime error above and `lighthouse.log`).")
    elif not failed:
        out.append("- ✅ No audits in these categories scored below 90.")
    else:
        for score, _, _, aid, cat_title, a in failed[:10]:
            desc = strip_md_links(a.get("description", "")).split(". ")[0].strip()
            display = f" — {cell(a.get('displayValue'), 80)}" if a.get("displayValue") else ""
            out.append(f"- **{cell(a.get('title', aid), 120)}** ({cat_title}, score {round(score * 100)}){display}. {cell(desc, 220)}")
        if len(failed) > 10:
            out.append(f"- _{len(failed) - 10} more in the Lighthouse HTML/JSON report in the artifact._")
    return out + [""]


# --------------------------------------------------------------------------- #
def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    audit = Path(sys.argv[1])
    output = Path(sys.argv[2])
    repo_root = Path(os.environ.get("GITHUB_WORKSPACE", "."))
    url = os.environ.get("LIGHTHOUSE_URL", "https://trivial-things.onrender.com/")
    run_url = "{}/{}/actions/runs/{}".format(
        os.environ.get("GITHUB_SERVER_URL", "https://github.com"),
        os.environ.get("GITHUB_REPOSITORY", "AllSeeingOwl/Trivial-Things"),
        os.environ.get("GITHUB_RUN_ID", "local"),
    )

    sections = [
        ["# Weekly quality report — Trivial-Things", ""],
        [
            f"- Generated: {os.environ.get('REPORT_DATE', 'unknown')} (UTC)",
            f"- Commit: `{os.environ.get('GITHUB_SHA', 'unknown')[:12]}` on `{os.environ.get('GITHUB_REF_NAME', 'unknown')}`",
            f"- Workflow run and raw artifacts: {run_url}",
            "",
            "This is an automated, read-only assessment. **No code was changed and no fixes were applied.** "
            "Findings are unverified tool output and may include false positives.",
            "",
            "**Scope:** Bandit (all Python code), pip-audit (each `requirements*.txt`), pnpm audit "
            "(`right-here-right-now` lockfile), and Lighthouse on the portal landing page only. "
            "Deployed Flask apps and the deployed Next.js app are not Lighthouse-tested.",
            "",
        ],
    ]
    for builder in (
        lambda: bandit_section(audit),
        lambda: pip_audit_section(audit, repo_root),
        lambda: pnpm_section(audit),
        lambda: lighthouse_section(audit, url),
    ):
        try:
            sections.append(builder())
        except Exception as exc:  # never let one section stop the report
            sections.append([f"- ⚠️ A report section failed to render: {type(exc).__name__}: {exc}", ""])

    sections.append([
        "## AI-agent handoff",
        "",
        "To a future coding agent picking up this report:",
        "",
        "1. **Verify each finding against the relevant app** before acting. Check the cited file/line, the app's own "
        "`requirements.txt` or `package.json`, and whether the code is reachable in the deployed app "
        "(e.g. Bandit `B104` bind-all-interfaces is usually intentional inside a container; dev-only npm packages "
        "are lower risk than runtime ones).",
        "2. **Ignore false positives** and say briefly why each was dismissed.",
        "3. **Recommend small, high-impact fixes only.** Prioritise security, then accessibility, then performance "
        "and polish. Do not change code solely to raise a score.",
        "4. For each accepted finding, give: affected app and files, why it matters, risk level, the recommended fix, "
        "and validation steps (e.g. the app's `pytest` suite via `tox -e <env>`, `pnpm build`/`pnpm test` in "
        "`right-here-right-now`, or re-running this workflow).",
        "5. Remember the Lighthouse scores cover only the portal page, not the individual apps.",
        "",
    ])

    output.write_text("\n".join(line for section in sections for line in section) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
