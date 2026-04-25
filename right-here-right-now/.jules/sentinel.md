## 2025-05-14 - Timing Attack Vulnerability in Secret Comparison

**Vulnerability:** Using standard string comparison (`===` or `!==`) for secrets or tokens allows attackers to use timing analysis to guess the secret character by character, as the comparison often returns early upon finding a mismatch.

**Learning:** `crypto.timingSafeEqual` in Node.js provides a constant-time comparison, but it requires both buffers to have the same length. To safely compare strings of potentially different lengths without leaking length information, both strings should be hashed (e.g., using SHA-256) before passing them to `timingSafeEqual`.

**Prevention:** Always use timing-safe comparison functions for sensitive data like API keys, tokens, or passwords. In Node.js, combine `crypto.createHash` and `crypto.timingSafeEqual` to ensure both safety and constant-time execution regardless of input length.
