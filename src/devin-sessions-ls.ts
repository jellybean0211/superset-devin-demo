import "dotenv/config";
import { DevinClient, type SessionSummary } from "./devin.ts";
import { formatSessions } from "./format-sessions.ts";

// Heuristic for "sessions related to this project". The API does not return
// the session's `repos` field on list responses, so we filter by the tags
// the two spawn paths attach (see src/index.ts) plus the legacy `superset` tag.
function isProjectSession(s: SessionSummary): boolean {
  const tags = s.tags ?? [];
  return tags.some((t) => t === "gh-action" || t === "superset" || t.startsWith("issue-"));
}

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var ${key}`);
  return v;
}

function parseArgs(argv: string[]): { limit: number; all: boolean } {
  const args = argv.slice(2);
  let all = false;
  let limit = 20;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--all") {
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
    } else if (a === "all") {
      // npm strips `--all` (it's one of npm's own flags) before it reaches the
      // script, so accept bare `all` as a positional alias: `npm run devin:ls all`.
      all = true;
    } else {
      // Same npm-strip quirk for `--limit N`: only the value reaches us. Accept
      // a bare positive integer as the limit.
      const n = Number(a);
      if (Number.isInteger(n) && n > 0) {
        limit = n;
      } else {
        throw new Error(`Unexpected argument: ${a}`);
      }
    }
  }
  return { limit, all };
}

async function main() {
  const { limit, all } = parseArgs(process.argv);
  const client = new DevinClient(
    env("DEVIN_API_KEY"),
    env("DEVIN_ORG_ID"),
    process.env.DEVIN_API_BASE ?? "https://api.devin.ai",
  );

  // The API's `status` filter param is ignored server-side; we filter client-side.
  // Pull a wider page so the post-filter still has headroom to fill `limit`.
  const fetchFirst = Math.max(limit, 50);
  const res = await client.listSessions({ first: fetchFirst });

  const filtered = all
    ? res.items
    : res.items.filter((s) => s.status === "running").filter(isProjectSession);
  const items = filtered.slice(0, limit);

  const label = all
    ? "all sessions (any status, org-wide)"
    : "running project sessions (jellybean0211/superset)";
  console.log(`${label} — showing ${items.length}${all ? `` : ` of ${filtered.length} matched`}`);
  console.log(formatSessions(items));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
