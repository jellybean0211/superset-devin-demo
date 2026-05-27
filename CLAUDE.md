# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A Dockerized CLI that spawns a Devin session to fix one GitHub issue, plus npm-script helpers for manual/local runs. **The production automation (the GitHub Actions webhook that fires on `issues.labeled`) lives in the Superset fork at `jellybean0211/superset` under `.devin/` and `.github/workflows/devin-on-issue.yml`** — this repo is the spawner image source and the place to iterate on the prompt. Changes here only affect production once the image built from this repo (or its mirror under `.devin/` in the fork) is rebuilt.

## Commands

```bash
# Typecheck (no emit — runtime uses tsx)
npm run typecheck

# Dry-run the spawner — prints the prompt without calling Devin
# (requires the ISSUE_* + TARGET_REPO env vars; see README for the docker form)
npx tsx src/index.ts --dry-run

# Helpers (need gh auth for apache/superset read + jellybean0211/superset read/write)
npm run devin:issues:clone -- <upstream-issue-#> [--label devin]
npm run devin:issues:ls                  # open, limit 20 (defaults)
npm run devin:issues:ls all 50           # bare positional aliases: all → --all, N → --limit N
npm run devin:sessions:ls                # running sessions for this project
npm run devin:sessions:ls all 3

# Upload knowledge/*.md to the Devin org (one-time, needs DEVIN_API_KEY + DEVIN_ORG_ID)
npm run upload-knowledge

# Build/run the spawner image
npm run docker:build
npm run docker:spawn                      # consumes ISSUE_NUMBER/ISSUE_TITLE/... from env
```

### npm flag-stripping gotcha

`npm run` swallows flags it recognizes (`--all`, `--limit`, …) before they reach the script. The `devin:*:ls` scripts therefore accept **bare positional aliases**: `all` means `--all`, a bare integer means `--limit N`. To pass real flags, use the `--` separator: `npm run devin:issues:ls -- --all --limit 50`.

## Architecture

```
src/index.ts            Entry. Reads ISSUE_* + TARGET_REPO env, dedups against prior
                        sessions for the same issue tag, calls DevinClient.createSession.
src/devin.ts            Typed Devin v3 organizations API client (sessions + knowledge).
                        ACTIVE_STATUSES enumerates the statuses treated as "in flight".
src/prompt.ts           buildGenericIssuePrompt — the prompt template sent to Devin.
                        Branches on isFork (upstreamRepo !== targetRepo) to add the
                        "demo fork" notes and the "do not push to upstream" constraint.
src/upload-knowledge.ts Reads knowledge/*.md (YAML frontmatter: name + trigger_description
                        + optional pinned_repo), posts to /knowledge/notes.
src/devin-issues-*.ts   gh-CLI wrappers. clone copies an apache/superset issue into the
                        fork (with a header linking back); ls/sessions:ls list state.
src/format-sessions.ts  Shared formatting for sessions:ls output.
knowledge/*.md          Three Markdown notes with frontmatter (name, trigger_description,
                        pinned_repo) — Devin's knowledge base for Superset context.
Dockerfile              node:20-alpine, ENTRYPOINT is `npx tsx src/index.ts`. Override
                        with `--entrypoint` for upload-knowledge.
```

### Key behaviors baked into `src/index.ts`

- **Dedup on relabel.** Before spawning, it lists prior sessions tagged `issue-<N>` within the last 14 days. Skips if any are still active, or if a prior one already opened a PR. Writes `skipped=…` to `$GITHUB_OUTPUT` so the Action can branch on it.
- **ACU cap.** `MAX_ACU_PER_SESSION = 5` is the per-session blast-radius limit passed to Devin.
- **GitHub Action contract.** When `$GITHUB_OUTPUT` is set, it appends `session_id`, `session_url`, and (if applicable) `pr_url` / `skipped`. That env var only exists in CI, so locally these are no-ops.

### Prompt contract

`src/prompt.ts` is the source of truth for what Devin is told to do. Two things to know before editing it:

1. The PR-body structure in the prompt (Reproduction steps / Blast radius / Alternatives / Confidence & unknowns / Test results / Screenshots / Out of scope) is mirrored in the README's "What a Devin PR looks like" section. Keep them in sync.
2. The `isFork` branch (`upstreamRepo !== targetRepo`) toggles the demo-fork disclaimer and the explicit "do not push to upstream" constraint. The `UPSTREAM_REPO` env var defaults to `apache/superset` and `TARGET_REPO` is the fork — so the default path always takes the fork branch.

### Devin API specifics

- All endpoints used are under `/v3/organizations/{org}/…`.
- `listSessions` accepts `created_after` as **Unix seconds**, but the client takes an ISO string and converts internally — pass ISO.
- Session list responses do **not** include repos, so the `devin:sessions:ls` "this project" filter uses tags, not repo matching.

## Environment

Required for any real API call: `DEVIN_API_KEY` (`cog_*`), `DEVIN_ORG_ID` (`org-*`). Required for a spawn: `TARGET_REPO`, `ISSUE_NUMBER`, `ISSUE_TITLE`, `ISSUE_URL`. Optional: `UPSTREAM_REPO` (default `apache/superset`), `ISSUE_BODY`, `DEVIN_API_BASE`. `.env.example` is the canonical list.

## Style

- Pure ESM (`"type": "module"`) + `tsx` at runtime — relative imports use the `.ts` extension (see existing files). Do not strip them.
- No build step. `npm run typecheck` is `tsc --noEmit`; nothing emits JS.
- No test framework is configured. If you add one, update this file.
