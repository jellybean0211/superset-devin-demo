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

7. Push a branch to \`https://github.com/${targetRepo}\` (NOT the upstream repo) and open a
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
  - How you verified it
  - A note that this PR is opened to \`${targetRepo}\` as a demo fork; the upstream fix would
    target ${upstreamRepo}.
- Keep the changeset minimal and focused. No drive-by formatting, no unrelated edits.

## Hard constraints
- DO NOT push or open a PR to ${upstreamRepo}. The PR target is \`${targetRepo}\` only.
- DO NOT modify CI configuration, pre-commit hooks, or unrelated schemas.
- If you get blocked on environment setup for >30 minutes, stop and post the completion
  comment with the \`⚠️\` outcome.`;
}
