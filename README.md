# superset-devin-demo

A Dockerized CLI that spawns a Devin session to fix an Apache Superset issue.
Use it for local testing, manual one-off runs, and prompt iteration.

> **The automated webhook flow (GH Action that triggers on `issues.labeled`) lives
> inside the Superset fork at [`jellybean0211/superset`](https://github.com/jellybean0211/superset),
> under `.devin/` and `.github/workflows/devin-on-issue.yml`. This repo is for
> manual/simulated runs only.**

## What's in here

| Path | Purpose |
|---|---|
| `Dockerfile` | Container image — Node 20 Alpine + tsx |
| `src/index.ts` | Spawn entrypoint — creates Devin session for one issue |
| `src/devin.ts` | Typed Devin API client (v3 organization endpoints) |
| `src/prompt.ts` | Prompt template — issue context → Devin instructions |
| `src/upload-knowledge.ts` | One-time helper to push knowledge notes to Devin org |
| `knowledge/*.md` | Three knowledge entries Devin uses for Superset context |

## Prerequisites

- Docker
- Devin service-user credential (`cog_*` API key) and org ID (`org-*`)
- Devin GitHub App installed on `jellybean0211/superset` (for the PR step;
  not required for `--dry-run`)

## Setup

```bash
cp .env.example .env
# edit .env and fill in DEVIN_API_KEY and DEVIN_ORG_ID
docker build -t superset-devin-demo .
```

## Simulate the workflow (no Devin API calls)

Prints the prompt that would be sent to Devin and exits. Use this to iterate on
the prompt without burning ACUs.

```bash
docker run --rm \
  -e DEVIN_API_KEY=dummy -e DEVIN_ORG_ID=dummy \
  -e TARGET_REPO=jellybean0211/superset \
  -e UPSTREAM_REPO=apache/superset \
  -e ISSUE_NUMBER=33884 \
  -e ISSUE_TITLE="OpenAPI spec wrong on dashboard endpoint" \
  -e ISSUE_BODY="owners/roles/tags arrays declared as single objects" \
  -e ISSUE_URL=https://github.com/apache/superset/issues/33884 \
  superset-devin-demo --dry-run
```

## Run the workflow manually (real Devin session)

This is the same code path the GH Action runs — useful for testing the
integration before relying on the label-triggered flow.

```bash
docker run --rm --env-file .env \
  -e TARGET_REPO=jellybean0211/superset \
  -e UPSTREAM_REPO=apache/superset \
  -e ISSUE_NUMBER=<N> \
  -e ISSUE_TITLE="<title>" \
  -e ISSUE_BODY="<body>" \
  -e ISSUE_URL=https://github.com/jellybean0211/superset/issues/<N> \
  superset-devin-demo
```

The container creates the session, prints `Session: <id>` and the watch URL,
then exits. Devin continues asynchronously and opens a PR against
`jellybean0211/superset` when done.

## One-time setup: upload knowledge to Devin

The three files under `knowledge/` give Devin Superset-specific context.
Upload them once via the API (or paste them into Devin's UI manually):

```bash
docker run --rm --env-file .env \
  --entrypoint npx \
  -v "$PWD/knowledge:/app/knowledge:ro" \
  superset-devin-demo tsx src/upload-knowledge.ts
```

Or without Docker:

```bash
npm install
npm run upload-knowledge
```

## Environment variables

| Name | Required | Description |
|---|---|---|
| `DEVIN_API_KEY` | yes | Devin service-user credential (`cog_*`) |
| `DEVIN_ORG_ID` | yes | Devin organization ID (`org-*`) |
| `TARGET_REPO` | yes | Where Devin opens the PR (e.g. `jellybean0211/superset`) |
| `UPSTREAM_REPO` | no | Reference for issue context (default `apache/superset`) |
| `ISSUE_NUMBER` | yes | Issue number |
| `ISSUE_TITLE` | yes | Issue title |
| `ISSUE_BODY` | no | Issue body (may be empty) |
| `ISSUE_URL` | yes | Full URL to the issue |
| `DEVIN_API_BASE` | no | Override Devin API base (default `https://api.devin.ai`) |

## Issues remediated by this demo

| Issue | Upstream link | PR (in `jellybean0211/superset`) |
|---|---|---|
| OpenAPI spec misdeclares dashboard `owners`/`roles`/`tags` as objects instead of arrays | [apache/superset#33884](https://github.com/apache/superset/issues/33884) | _(filled in after Devin completes)_ |

## How the production flow works

The webhook automation is in the Superset fork, not here. High-level:

```
Issue labeled 'devin' in jellybean0211/superset
        │
        ▼ (issues.labeled event)
GitHub Actions (.github/workflows/devin-on-issue.yml in the fork)
        │
        ▼ docker build + docker run (this same image, from .devin/Dockerfile)
Devin API: POST /v3/organizations/{org}/sessions
        │
        ▼
Devin VM clones the repo via its installed GitHub App
        │
        ▼
Edits code, runs tests, opens PR, comments on the issue
```

For the workflow file and `.devin/` setup, see
[`jellybean0211/superset`](https://github.com/jellybean0211/superset).
