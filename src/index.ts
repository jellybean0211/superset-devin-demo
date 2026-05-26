import "dotenv/config";
import { appendFile } from "node:fs/promises";
import { DevinClient, ACTIVE_STATUSES } from "./devin.ts";
import { buildGenericIssuePrompt } from "./prompt.ts";

const MAX_ACU_PER_SESSION = 5;
const DEDUP_WINDOW_DAYS = 14;

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var ${key}`);
  return v;
}

async function writeGithubOutputs(outputs: Record<string, string>) {
  const outFile = process.env.GITHUB_OUTPUT;
  if (!outFile) return;
  const lines = Object.entries(outputs)
    .map(([k, v]) => `${k}=${v.replace(/\r?\n/g, " ")}`)
    .join("\n");
  await appendFile(outFile, lines + "\n");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const upstreamRepo = process.env.UPSTREAM_REPO ?? "apache/superset";
  const targetRepo = env("TARGET_REPO");
  const issueNumber = Number(env("ISSUE_NUMBER"));
  const issueTitle = env("ISSUE_TITLE");
  const issueBody = process.env.ISSUE_BODY ?? "";
  const issueUrl = env("ISSUE_URL");

  if (dryRun) {
    const prompt = buildGenericIssuePrompt({
      upstreamRepo,
      targetRepo,
      issueNumber,
      issueTitle,
      issueBody,
      issueUrl,
    });
    console.log("=== DRY RUN — prompt that would be sent to Devin ===\n");
    console.log(prompt);
    console.log("\n=== END ===");
    console.log("\nNo Devin API calls were made. Remove --dry-run to spawn for real.");
    return;
  }

  const client = new DevinClient(
    env("DEVIN_API_KEY"),
    env("DEVIN_ORG_ID"),
    process.env.DEVIN_API_BASE ?? "https://api.devin.ai",
  );

  // --- Edge case #1: duplicate session on relabel ---
  // Skip if there's an active session OR a completed session that already opened a PR
  // within the dedup window for the same issue.
  const issueTag = `issue-${issueNumber}`;
  const since = new Date(Date.now() - DEDUP_WINDOW_DAYS * 86_400_000).toISOString();
  const existing = await client.listSessions({
    tags: [issueTag],
    first: 50,
    created_after: since,
  });

  const activeMatch = existing.items.find((s) => ACTIVE_STATUSES.includes(s.status));
  if (activeMatch) {
    console.log(`Skip: active Devin session already exists for ${issueTag}: ${activeMatch.url}`);
    await writeGithubOutputs({
      session_id: activeMatch.session_id,
      session_url: activeMatch.url,
      skipped: "active-session-exists",
    });
    return;
  }
  const prMatch = existing.items.find((s) => (s.pull_requests ?? []).some((p) => p.pr_url));
  if (prMatch) {
    const prUrl = prMatch.pull_requests?.find((p) => p.pr_url)?.pr_url ?? "";
    console.log(`Skip: prior Devin session for ${issueTag} already opened a PR: ${prUrl}`);
    await writeGithubOutputs({
      session_id: prMatch.session_id,
      session_url: prMatch.url,
      pr_url: prUrl,
      skipped: "pr-already-opened",
    });
    return;
  }

  const prompt = buildGenericIssuePrompt({
    upstreamRepo,
    targetRepo,
    issueNumber,
    issueTitle,
    issueBody,
    issueUrl,
  });

  console.log(`Spawning Devin session for ${upstreamRepo}#${issueNumber} → PR to ${targetRepo}`);
  const session = await client.createSession({
    prompt,
    title: `${upstreamRepo}#${issueNumber}: ${issueTitle}`.slice(0, 120),
    tags: ["gh-action", issueTag],
    repos: [targetRepo, upstreamRepo],
    max_acu_limit: MAX_ACU_PER_SESSION, // --- Edge case #2: cap blast radius ---
  });

  console.log(`Session: ${session.session_id}`);
  console.log(`URL:     ${session.url}`);

  await writeGithubOutputs({
    session_id: session.session_id,
    session_url: session.url,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
