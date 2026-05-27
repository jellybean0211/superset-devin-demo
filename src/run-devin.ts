import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const TARGET = process.env.TARGET_REPO ?? "jellybean0211/superset";
const UPSTREAM = process.env.UPSTREAM_REPO ?? "apache/superset";

type GhIssue = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  pull_request?: unknown;
};

function parseArgs(argv: string[]): { issueNumber: number; dryRun: boolean } {
  const args = argv.slice(2);
  let issueNumber: number | undefined;
  let dryRun = false;

  for (const a of args) {
    if (a === "--dry-run") {
      dryRun = true;
    } else if (!issueNumber) {
      const n = Number(a);
      if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid issue number: ${a}`);
      issueNumber = n;
    } else {
      throw new Error(`Unexpected argument: ${a}`);
    }
  }

  if (!issueNumber) {
    throw new Error(
      "Usage: npm run devin -- <issue-number> [--dry-run]\n" +
        `  Spawns a Devin session for ${TARGET}#<issue-number> and opens a PR.`,
    );
  }
  return { issueNumber, dryRun };
}

function main() {
  const { issueNumber, dryRun } = parseArgs(process.argv);

  console.log(`Fetching ${TARGET}#${issueNumber}...`);
  const raw = execFileSync(
    "gh",
    ["api", `repos/${TARGET}/issues/${issueNumber}`, "-H", "Accept: application/vnd.github+json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const issue = JSON.parse(raw) as GhIssue;
  if (issue.pull_request) {
    throw new Error(`${TARGET}#${issueNumber} is a pull request, not an issue.`);
  }

  const indexPath = resolve(dirname(fileURLToPath(import.meta.url)), "index.ts");
  const child = spawnSync(
    "npx",
    ["tsx", indexPath, ...(dryRun ? ["--dry-run"] : [])],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        TARGET_REPO: TARGET,
        UPSTREAM_REPO: UPSTREAM,
        ISSUE_NUMBER: String(issue.number),
        ISSUE_TITLE: issue.title,
        ISSUE_BODY: issue.body ?? "",
        ISSUE_URL: issue.html_url,
      },
    },
  );
  process.exit(child.status ?? 1);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
