---
name: PR target policy for this demo
trigger_description: Use whenever opening a pull request on any apache/superset-derived task in this demo environment.
---

For ALL tasks in this demo:
- The PR MUST be opened against `jellybean0211/superset` (the demo fork), NOT against `apache/superset`.
- Push the working branch to `jellybean0211/superset` directly (or to a fork of it under your bot account, then PR into `jellybean0211/superset:main`).
- Never run `gh pr create --repo apache/superset`. If a tool tries to default to upstream, override `--repo jellybean0211/superset`.

PR body template:
```
## Issue
Closes apache/superset#<N>  ← link upstream issue for context, but do NOT use the GitHub "closes" keyword if this would auto-close upstream; use "Refs" instead.

## Root cause
<one paragraph>

## Fix
<bullets>

## Verification
<what you ran / what you observed>

---
_Opened to jellybean0211/superset as part of a Devin autonomy demo. The upstream-targeted fix would mirror this diff against apache/superset:main._
```
