import { execFileSync } from "node:child_process";

const UPSTREAM = process.env.UPSTREAM_REPO ?? "apache/superset";
const TARGET = process.env.TARGET_REPO ?? "jellybean0211/superset";

type GhIssue = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  user: { login: string } | null;
  labels: { name: string }[];
};

function gh(args: string[]): string {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

function parseArgs(argv: string[]): { issueNumber: number; labels: string[] } {
  const args = argv.slice(2);
  const labels: string[] = [];
  let issueNumber: number | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--label" || a === "-l") {
      const v = args[++i];
      if (!v) throw new Error("--label requires a value");
      labels.push(v);
    } else if (a.startsWith("--label=")) {
      labels.push(a.slice("--label=".length));
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
      "Usage: npm run clone-issue -- <issue-number> [--label <name>]...\n" +
        "  Clones an issue from apache/superset to jellybean0211/superset.",
    );
  }
  return { issueNumber, labels };
}

async function main() {
  const { issueNumber, labels } = parseArgs(process.argv);

  console.log(`Fetching ${UPSTREAM}#${issueNumber}...`);
  const raw = gh([
    "api",
    `repos/${UPSTREAM}/issues/${issueNumber}`,
    "-H",
    "Accept: application/vnd.github+json",
  ]);
  const issue = JSON.parse(raw) as GhIssue;

  if ((issue as unknown as { pull_request?: unknown }).pull_request) {
    throw new Error(`${UPSTREAM}#${issueNumber} is a pull request, not an issue.`);
  }

  const upstreamLabels = issue.labels.map((l) => l.name).filter(Boolean);
  const header =
    `> Cloned from [${UPSTREAM}#${issue.number}](${issue.html_url})` +
    (issue.user ? ` (opened by @${issue.user.login})` : "") +
    (upstreamLabels.length ? `\n> Upstream labels: ${upstreamLabels.join(", ")}` : "") +
    "\n\n---\n\n";
  const body = header + (issue.body ?? "_(no body)_");

  const createArgs = [
    "issue",
    "create",
    "--repo",
    TARGET,
    "--title",
    issue.title,
    "--body",
    body,
  ];
  for (const l of labels) {
    createArgs.push("--label", l);
  }

  console.log(`Creating issue in ${TARGET}${labels.length ? ` with labels: ${labels.join(", ")}` : ""}...`);
  const url = gh(createArgs).trim();
  console.log(url);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
