export interface GenericIssuePromptVars {
  upstreamRepo: string;
  targetRepo: string;
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  issueUrl: string;
}

export function buildGenericIssuePrompt({
  upstreamRepo,
  targetRepo,
  issueNumber,
  issueTitle,
  issueBody,
  issueUrl,
}: GenericIssuePromptVars): string {
  const isFork = upstreamRepo !== targetRepo;
  const demoForkNote = isFork
    ? `\n  - A note that this PR is opened to \`${targetRepo}\` as a demo fork; the upstream fix would\n    target ${upstreamRepo}.`
    : "";
  const pushTargetNote = isFork ? " (NOT the upstream repo)" : "";
  const noUpstreamPushConstraint = isFork
    ? `\n- DO NOT push or open a PR to ${upstreamRepo}. The PR target is \`${targetRepo}\` only.`
    : "";
  return `You are solving issue #${issueNumber} from ${upstreamRepo}.

## Issue
${issueUrl}

### Title (snapshot at trigger time — may be stale)
${issueTitle}

### Body (snapshot at trigger time — may be stale)
${issueBody || "(no body provided)"}

## What you should do
1. **Fetch fresh state.** The title/body above are a snapshot from when the GH Action fired.
   Before doing anything else, run:
   \`\`\`
   gh issue view ${issueNumber} --repo ${upstreamRepo} --json title,body,comments,state,labels
   \`\`\`
   Use the fresh content as your source of truth — including any new comments that may have
   added context, repro steps, or root-cause analysis since the label was applied.

2. **Acknowledge — but only if no ACK is already there.** Run:
   \`\`\`
   gh issue view ${issueNumber} --repo ${upstreamRepo} --json comments --jq '.comments[].body'
   \`\`\`
   If any existing comment starts with \`🤖 on it\`, SKIP the ACK step entirely (a previous
   session already acknowledged). Otherwise post exactly one comment:
   \`🤖 on it — analyzing this issue now. will update with a PR or findings when done.\`

3. Clone \`https://github.com/${upstreamRepo}\` and check out the default branch at HEAD.

4. Reproduce the bug or understand the feature request. Read the relevant code paths.

5. Implement the smallest correct fix. Add or update tests where appropriate. If the issue
   thread discusses root cause or a workaround (e.g. a \`jq\` patch, a one-line schema
   change), use that as a starting point — hardcoding is acceptable when proper regeneration
   is infeasible in the sandbox.

6. Run tests relevant to your change (not the full suite).

7. Push a branch to \`https://github.com/${targetRepo}\`${pushTargetNote} and open a
   pull request against \`${targetRepo}\`'s default branch.

8. **Completion comment.** Once the PR is open (or you concluded no fix is feasible), post
   one final comment on ${issueUrl} with either:
   - \`✅ PR opened: <pr_url>\` plus a one-line summary of the change, OR
   - \`⚠️ Could not produce a PR. Reason: <short reason>.\`
   Do not post more than these two comments (the ACK and the completion). No progress chatter
   in between.

## PR requirements
- Use a Conventional Commits title (e.g. \`fix(scope): ...\`, \`feat(scope): ...\`).
- Body must include:
  - Link to ${issueUrl}
  - One-paragraph root cause / motivation
  - Summary of the change
  - **Reproduction steps** — the minimal user-facing steps that surface the bug (or, for
    a feature, the acceptance criteria). 3–6 numbered steps. This is the failing scenario,
    not the test you wrote.
  - **Blast radius** — list the other call sites / consumers of the code you touched and
    explicitly state why each remains correct under your change. If you grep'd, say what
    you grep'd for. If the change is genuinely local (e.g. a leaf component with no other
    callers), say so plainly.
  - **Alternatives considered** — one or two alternatives you weighed and why you didn't
    take them. One sentence each, not an essay. Skip only if the change is a one-line
    obvious fix with no real alternative.
  - **Confidence & unknowns** — three short labelled lines:
    - \`High confidence:\` what you are sure works and why
    - \`Lower confidence:\` assumptions you made that a reviewer should sanity-check
    - \`Did not verify:\` scenarios you couldn't exercise (mobile, specific DB engine,
      large datasets, etc.) — be honest, "none" is rarely the right answer
  - How you verified it
  - **Test results** — paste the actual command(s) you ran (e.g. \`npm run test -- foo\`,
    \`pytest tests/unit_tests/bar.py\`) and their pass/fail summary inside a fenced code
    block. If a relevant test could not be run in the sandbox, say so explicitly and name
    what would need to run in CI.
  - **Screenshots / GIFs** — REQUIRED for any change that affects rendered UI. Capture
    before/after using the browser tooling available to you. OMIT this section entirely
    for pure-backend changes; do not write "N/A".
  - **Out of scope / follow-ups** — anything you deliberately did not address that a
    reviewer might otherwise ask about (a related bug you noticed, a refactor that would
    be larger than this PR, etc.). Only include real items you actually noticed — do NOT
    invent follow-ups to look thorough. If there are none, omit the section.${demoForkNote}
- Keep the changeset minimal and focused. No drive-by formatting, no unrelated edits.

## Hard constraints${noUpstreamPushConstraint}
- DO NOT modify CI configuration, pre-commit hooks, or unrelated schemas.
- If you get blocked on environment setup for >30 minutes, stop and post the completion
  comment with the \`⚠️\` outcome.`;
}
