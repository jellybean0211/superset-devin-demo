import { execFileSync } from "node:child_process";

const TARGET = process.env.TARGET_REPO ?? "jellybean0211/superset";

type GhIssue = {
  number: number;
  title: string;
  state: string;
  createdAt: string;
  labels: { name: string }[];
};

function parseArgs(argv: string[]): { all: boolean; limit: number } {
  const args = argv.slice(2);
  let all = false;
  let limit = 20;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--all" || a === "all") {
      // npm strips `--all` before it reaches the script; bare `all` works too.
      all = true;
    } else if (a === "--limit") {
      const v = args[++i];
      if (!v) throw new Error("--limit requires a value");
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid --limit: ${v}`);
      limit = n;
    } else if (a.startsWith("--limit=")) {
      const n = Number(a.slice("--limit=".length));
      if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid --limit: ${a}`);
      limit = n;
    } else {
      const n = Number(a);
      if (Number.isInteger(n) && n > 0) {
        limit = n;
      } else {
        throw new Error(`Unexpected argument: ${a}`);
      }
    }
  }
  return { all, limit };
}

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}

function format(issues: GhIssue[]): string {
  if (issues.length === 0) return "(no issues)";
  const rows = issues.map((i) => ({
    num: `#${i.number}`,
    state: i.state.toLowerCase(),
    age: ago(i.createdAt),
    labels: i.labels.map((l) => l.name).join(",") || "—",
    title: i.title.replace(/\s+/g, " ").slice(0, 80),
  }));
  const headers = ["NUMBER", "STATE", "AGE", "LABELS", "TITLE"];
  const cols: (keyof (typeof rows)[number])[] = ["num", "state", "age", "labels", "title"];
  const widths = cols.map((c, i) =>
    Math.max(headers[i]!.length, ...rows.map((r) => String(r[c]).length)),
  );
  const fmt = (cells: string[]) => cells.map((v, i) => v.padEnd(widths[i]!)).join("  ");
  return [fmt(headers), ...rows.map((r) => fmt(cols.map((c) => String(r[c]))))].join("\n");
}

function main() {
  const { all, limit } = parseArgs(process.argv);
  const state = all ? "all" : "open";

  const raw = execFileSync(
    "gh",
    [
      "issue",
      "list",
      "--repo",
      TARGET,
      "--state",
      state,
      "--label",
      "devin",
      "--limit",
      String(limit),
      "--json",
      "number,title,state,createdAt,labels",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const issues = JSON.parse(raw) as GhIssue[];

  console.log(`${TARGET} issues (${all ? "all states" : "open only"}) — showing ${issues.length}`);
  console.log(format(issues));
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
