# superset-devin-demo

Autonomous fix-it loop for Apache Superset issues, powered by Devin.

When an issue in [`jellybean0211/superset`](https://github.com/jellybean0211/superset) is
labeled `devin`, a containerized GitHub Action calls the Devin API to spawn a session.
Devin then clones the repo, analyzes the issue, implements a fix, opens a PR, and posts
status comments on the issue — all autonomously.

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  github.com/jellybean0211/superset                                 │
│                                                                    │
│  Issue labeled 'devin'                                             │
│         │                                                          │
│         ▼ (issues.labeled webhook → internal, no setup)            │
│  .github/workflows/devin-on-issue.yml                              │
│         │                                                          │
│         ▼ docker build + docker run                                │
│  .devin/Dockerfile  ──►  containerized spawn script                │
│         │                                                          │
│         ▼ POST /v3/organizations/{org}/sessions                    │
└─────────┼──────────────────────────────────────────────────────────┘
          │
          ▼
┌────────────────────────────────────────────────────────────────────┐
│  api.devin.ai                                                      │
│                                                                    │
│  Devin VM (separate from GH runner) is spawned                     │
│         │                                                          │
│         ▼ (Devin GitHub App grants clone/push/PR auth)             │
│  Clone jellybean0211/superset → fix → push branch → open PR        │
│  Post ACK + completion comments on the source issue                │
└────────────────────────────────────────────────────────────────────┘
```

## What's in this repo

| Path | Purpose |
|---|---|
| `Dockerfile` | Container image for the spawn script (Node 20 Alpine + tsx) |
| `src/index.ts` | Spawn entrypoint — creates Devin session, writes GH outputs |
| `src/devin.ts` | Typed Devin API client (v3 organization endpoints) |
| `src/prompt.ts` | Prompt template — issue context → Devin instructions |
| `src/upload-knowledge.ts` | One-time helper to push knowledge notes to Devin org |
| `knowledge/*.md` | Three knowledge entries Devin uses for Superset context |
| `.github/workflows/devin-on-issue.yml` | The trigger — labels `devin` → spawns session |

## Issues remediated by this demo

| Issue | Upstream link | PR |
|---|---|---|
| OpenAPI spec misdeclares dashboard `owners`/`roles`/`tags` as objects instead of arrays | [apache/superset#33884](https://github.com/apache/superset/issues/33884) | _(filled in after Devin completes)_ |

## Running it

### Prerequisites

- Devin organization with a service-user credential (`cog_*` API key) and org ID (`org-*`)
- Devin GitHub App installed on the target repo
- GitHub repo with the workflow YAML on the **default branch** (e.g. `master`)
- Repo secrets configured: `DEVIN_API_KEY`, `DEVIN_ORG_ID`

### Deploy to your Superset fork

```bash
# Clone your fork
gh repo clone jellybean0211/superset ~/projects/jellybean-superset
cd ~/projects/jellybean-superset

git checkout -b add-devin-automation

# Drop orchestration files into .devin/ and workflow into .github/workflows/
mkdir -p .devin .github/workflows
cp -r /path/to/superset-devin-demo/{src,knowledge,package.json,package-lock.json,tsconfig.json,.gitignore,Dockerfile,.dockerignore} \
      .devin/
cp /path/to/superset-devin-demo/.github/workflows/devin-on-issue.yml \
      .github/workflows/

git add .devin .github/workflows/devin-on-issue.yml
git commit -m "ci: spawn Devin on issues labeled 'devin'"
git push -u origin add-devin-automation
gh pr create --fill --base master
gh pr merge --squash --auto

# Repo secrets + label (one-time)
gh secret set DEVIN_API_KEY --repo jellybean0211/superset
gh secret set DEVIN_ORG_ID --body "org-..." --repo jellybean0211/superset
gh label create devin --color FFD700 --repo jellybean0211/superset
```

### Trigger Devin

Either label an existing issue or open one with the label pre-applied:

```bash
gh issue create --repo jellybean0211/superset \
  --title "Mirror of apache/superset#33884" \
  --body "Reproduces https://github.com/apache/superset/issues/33884" \
  --label devin
```

The workflow fires within seconds. Watch progress with:

```bash
gh run watch --repo jellybean0211/superset
```

## Simulating the workflow locally (no Devin API calls)

For testing the prompt without burning ACUs:

```bash
# 1. Build the image
docker build -t superset-devin-demo .

# 2. Run with --dry-run — prints the prompt that would be sent
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

## Running for real (manual, outside the GH Action)

```bash
cp .env.example .env  # fill in DEVIN_API_KEY and DEVIN_ORG_ID
docker build -t superset-devin-demo .
docker run --rm --env-file .env \
  -e TARGET_REPO=jellybean0211/superset \
  -e UPSTREAM_REPO=apache/superset \
  -e ISSUE_NUMBER=<N> \
  -e ISSUE_TITLE="..." \
  -e ISSUE_BODY="..." \
  -e ISSUE_URL=https://github.com/jellybean0211/superset/issues/<N> \
  superset-devin-demo
```

## One-time setup: upload knowledge to Devin

The three files under `knowledge/` give Devin Superset-specific context. Upload them
once via the API (or paste them into Devin's UI manually):

```bash
cp .env.example .env  # fill in DEVIN_API_KEY and DEVIN_ORG_ID
npm install
npm run upload-knowledge
```

## Edge cases handled

| # | Edge case | Fix |
|---|---|---|
| 1 | Label removed and re-added → duplicate sessions | `listSessions({tags: [issue-N]})` dedup, 14-day window |
| 2 | Runaway session burns unbounded ACUs | `max_acu_limit: 5` per session |
| 3 | Issue edited after labeling → stale snapshot | Devin's first action re-fetches issue via `gh issue view` |
| 4 | Issue opened with `devin` label pre-applied | Workflow listens for both `opened` and `labeled` |
| 5 | Bulk-labeling N issues → fan-out | GH Actions `concurrency` group per issue |
| 6 | Devin retries → ACK posted twice | Devin checks existing comments before posting ACK |

## Environment variables

| Name | Required | Description |
|---|---|---|
| `DEVIN_API_KEY` | yes | Devin service-user credential (`cog_*`) |
| `DEVIN_ORG_ID` | yes | Devin organization ID (`org-*`) |
| `TARGET_REPO` | yes | Where Devin opens the PR (e.g. `jellybean0211/superset`) |
| `UPSTREAM_REPO` | no | Reference for issue context (default `apache/superset`) |
| `ISSUE_NUMBER` | yes | Issue number from the GitHub event payload |
| `ISSUE_TITLE` | yes | Issue title from the payload |
| `ISSUE_BODY` | no | Issue body (may be empty) |
| `ISSUE_URL` | yes | Full URL to the issue |
| `DEVIN_API_BASE` | no | Override Devin API base (default `https://api.devin.ai`) |
