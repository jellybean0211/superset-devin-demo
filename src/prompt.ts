export interface PromptVars {
  upstreamRepo: string;
  targetRepo: string;
  issueNumber: number;
}

export function buildSupersetIssuePrompt({
  upstreamRepo,
  targetRepo,
  issueNumber,
}: PromptVars): string {
  return `You are fixing apache/superset issue #${issueNumber}.

## Issue summary
The \`/api/v1/dashboard\` endpoint returns \`owners\`, \`roles\`, and \`tags\` as arrays at runtime,
but the generated OpenAPI spec at \`docs/static/resources/openapi.json\` declares them as bare
\`$ref\` objects (single objects) instead of \`{ "type": "array", "items": { "$ref": ... } }\`.
This breaks generated clients (e.g. NSwag).

## Root cause (confirmed in issue thread)
In \`superset/dashboards/schemas.py\`, \`DashboardGetResponseSchema\` declares:
  - \`owners\` and \`roles\` with \`fields.List(fields.Nested(...))\`
  - \`tags\` with \`fields.Nested(TagSchema, many=True)\`
The apispec generator mis-renders all three as single \`$ref\` objects in the get-list response.

## What you should do
1. Clone \`https://github.com/${upstreamRepo}\` and check out main at the latest commit.
2. Inspect \`superset/dashboards/schemas.py\` and confirm the field definitions on
   \`DashboardGetResponseSchema\`. Normalize \`tags\` to the same
   \`fields.List(fields.Nested(TagSchema))\` shape used by \`owners\`/\`roles\`.
3. Regenerate the OpenAPI spec by running \`superset update-api-docs\` (or the equivalent
   documented in \`docs/static/resources/\`). If the CLI requires a working DB/app context that
   is hard to provision, instead patch the spec directly using the \`jq\` workaround from the
   issue thread for \`owners\`, \`roles\`, and \`tags\` under
   \`components.schemas["DashboardRestApi.get_list"].properties\`. Prefer regeneration; only
   fall back to the jq patch if regeneration is infeasible. Hardcoding the patch IS acceptable
   for this demo if needed.
4. Verify by inspecting the regenerated \`docs/static/resources/openapi.json\` and confirming
   each of those three properties is now \`{ "type": "array", "items": { "$ref": ... } }\`.
5. Run any related unit tests under \`tests/unit_tests/dashboards/\` and
   \`tests/integration_tests/dashboards/\` that touch the schema. Don't worry about the full
   suite — just the dashboard schema tests.
6. Push a branch to \`https://github.com/${targetRepo}\` (NOT the upstream apache repo) and
   open a pull request against \`${targetRepo}\`'s default branch.

## PR requirements
- Title: \`fix(api): correct OpenAPI schema for dashboard owners/roles/tags arrays (#${issueNumber})\`
- Body must include:
  - Link back to https://github.com/${upstreamRepo}/issues/${issueNumber}
  - One-paragraph root cause
  - Before/after diff snippet of the OpenAPI properties
  - A note that this PR is opened to \`${targetRepo}\` as a demo fork; the upstream fix would
    target apache/superset.
- Keep the changeset minimal and focused. No drive-by formatting, no unrelated edits.

## Hard constraints
- DO NOT push or open a PR to apache/superset. The PR target is \`${targetRepo}\` only.
- DO NOT modify CI configuration, pre-commit hooks, or unrelated schemas.
- If you get blocked on environment setup for >30 minutes, stop, leave a comment on the
  session, and report what you tried.

Report back with the PR URL when done.`;
}
