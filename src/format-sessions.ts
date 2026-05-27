import type { SessionSummary } from "./devin.ts";

function toMillis(raw: string | number): number {
  // Devin returns created_at as unix-seconds (number or numeric string), not ISO.
  // Fall back to Date.parse for actual ISO inputs.
  if (typeof raw === "number") return raw < 1e12 ? raw * 1000 : raw;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    return n < 1e12 ? n * 1000 : n;
  }
  return Date.parse(raw);
}

function ago(raw: string | number): string {
  const ms = toMillis(raw);
  if (!Number.isFinite(ms)) return "—";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86_400)}d`;
}

export function formatSessions(items: SessionSummary[]): string {
  if (items.length === 0) return "(no sessions)";

  const rows = items.map((s) => {
    const pr = s.pull_requests?.find((p) => p.pr_url)?.pr_url ?? "—";
    const acu = s.acus_consumed != null ? `${s.acus_consumed.toFixed(1)} ACU` : "—";
    const tags = (s.tags ?? []).join(",") || "—";
    return {
      status: s.status,
      age: ago(s.created_at),
      session: s.session_id,
      tags,
      acu,
      pr,
      url: s.url,
    };
  });

  const headers = ["STATUS", "AGE", "SESSION", "TAGS", "ACU", "PR", "URL"];
  const cols: (keyof (typeof rows)[number])[] = [
    "status",
    "age",
    "session",
    "tags",
    "acu",
    "pr",
    "url",
  ];
  const widths = cols.map((c, i) =>
    Math.max(headers[i]!.length, ...rows.map((r) => String(r[c]).length)),
  );

  const fmt = (cells: string[]) => cells.map((v, i) => v.padEnd(widths[i]!)).join("  ");
  return [fmt(headers), ...rows.map((r) => fmt(cols.map((c) => String(r[c]))))].join("\n");
}
