# Security Review — GEX Dashboard

**Branch:** `master` (full repository review)
**Date:** 2026-05-14
**Reviewer:** Automated security analysis

---

## How to Run

Before each commit, run the security review via Claude Code:

```
/security-review
```

---

## Summary

No high-confidence (≥8/10) exploitable vulnerabilities were found in the codebase. Four candidate issues were identified and each was ruled out after deeper analysis:

| Finding | Disposition | Reason |
|---|---|---|
| Path injection via `symbol` param | False positive | `symbol` only controls URL path on a fixed `base_url` — not host/protocol; excluded per SSRF-path-only rule |
| CORS `allow_credentials` misconfiguration | False positive | Exploit requires attacker control of the `CORS_ORIGINS` env var, which is a trusted deployment value |
| `dangerouslySetInnerHTML` in `StatCard.jsx` | False positive | `StatCard` is dead code — zero imports or usages outside its own file; no attack surface today |
| Raw exception strings in 502 responses | False positive | `httpx` exceptions stringify to status codes and URLs only — request headers (incl. `X-API-Key`) are never included |

---

## Notable Observations (Non-Blocking)

These are not vulnerabilities, but worth noting for future hardening:

- **`symbol` parameter lacks a regex pattern** — the `expiry` parameter correctly uses `pattern=r"^\d{4}-\d{2}-\d{2}$|^0dte$"` but `symbol` has no equivalent constraint across any route. Adding `pattern=r"^[A-Z0-9.\-]{1,10}$"` is low-effort defense-in-depth.
- **`StatCard.jsx` uses `dangerouslySetInnerHTML`** — before wiring this component into any view that passes API-sourced data into `sub1`, replace with plain `{sub1}` text or add DOMPurify sanitization.
- **Raw exceptions forwarded to clients** — `str(e)` in `HTTPException(detail=...)` leaks internal stack context. Logging exceptions server-side and returning a generic message is better practice regardless of immediate key-leak risk.
