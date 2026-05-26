import "dotenv/config";
import { DevinClient } from "./devin.ts";
import { buildSupersetIssuePrompt } from "./prompt.ts";

function env(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (!v) throw new Error(`Missing env var ${key}`);
  return v;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const upstreamRepo = env("UPSTREAM_REPO", "apache/superset");
  const targetRepo = env("TARGET_REPO", "jellybean0211/superset");
  const issueNumber = Number(env("ISSUE_NUMBER", "33884"));

  const prompt = buildSupersetIssuePrompt({ upstreamRepo, targetRepo, issueNumber });

  if (dryRun) {
    console.log("--- DRY RUN: prompt that would be sent to Devin ---\n");
    console.log(prompt);
    console.log("\n--- END ---");
    return;
  }

  const client = new DevinClient(
    env("DEVIN_API_KEY"),
    env("DEVIN_ORG_ID"),
    env("DEVIN_API_BASE", "https://api.devin.ai"),
  );

  console.log(`Creating Devin session for ${upstreamRepo}#${issueNumber} → PR to ${targetRepo}`);
  const session = await client.createSession({
    prompt,
    title: `Fix ${upstreamRepo}#${issueNumber} (OpenAPI array types)`,
    tags: ["demo", "superset", `issue-${issueNumber}`],
    repos: [targetRepo, upstreamRepo],
  });

  console.log(`Session created: ${session.session_id}`);
  console.log(`Watch live:      ${session.url}`);
  console.log("Polling every 30s for status updates...\n");

  let lastStatus = "";
  let lastDetail = "";
  let lastPrUrl = "";
  for await (const details of client.poll(session.session_id, 30_000)) {
    if (details.status !== lastStatus || details.status_detail !== lastDetail) {
      const stamp = new Date().toISOString();
      const detail = details.status_detail ? ` (${details.status_detail})` : "";
      console.log(`[${stamp}] status: ${details.status}${detail}`);
      lastStatus = details.status;
      lastDetail = details.status_detail ?? "";
    }
    const pr = details.pull_requests?.[0]?.pr_url;
    if (pr && pr !== lastPrUrl) {
      console.log(`\nPR opened: ${pr}\n`);
      lastPrUrl = pr;
    }
  }

  const final = await client.getSession(session.session_id);
  console.log("\n=== Session complete ===");
  console.log(`Final status: ${final.status}${final.status_detail ? ` (${final.status_detail})` : ""}`);
  console.log(`ACUs consumed: ${final.acus_consumed ?? "n/a"}`);
  const prs = final.pull_requests ?? [];
  if (prs.length > 0) {
    for (const pr of prs) {
      console.log(`PR: ${pr.pr_url}${pr.pr_state ? ` [${pr.pr_state}]` : ""}`);
    }
  } else {
    console.log("No PR was opened. Check the session URL for details.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
