## 2026-10-24 - Tailwind CDN Skip Link Positioning
**Learning:** In applications using Browser CDN Tailwind CSS, CSS position transitions like `-top-16` on unfocused skip links can cause text bleeding/clipping depending on parent container layout and overflow settings. Using standard `sr-only focus:not-sr-only focus:absolute` cleanly clips unfocused skip links out of visual flow without layout interference.
**Action:** Always prefer `sr-only focus:not-sr-only focus:absolute` for accessible skip navigation links.
