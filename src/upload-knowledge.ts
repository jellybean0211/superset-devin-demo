import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { DevinClient, type CreateKnowledgeInput } from "./devin.ts";

const KNOWLEDGE_DIR = new URL("../knowledge/", import.meta.url).pathname;

function parseFrontmatter(raw: string, filename: string): CreateKnowledgeInput {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`${filename}: missing YAML frontmatter with name/trigger_description`);
  }
  const [, fm, body] = match;
  const meta: Record<string, string> = {};
  for (const line of fm!.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key) meta[key] = value;
  }
  const name = meta.name ?? basename(filename, ".md");
  const trigger = meta.trigger_description ?? meta.trigger;
  if (!trigger) {
    throw new Error(`${filename}: trigger_description (or trigger) is required in frontmatter`);
  }
  return {
    name,
    body: body!.trim(),
    trigger,
    pinned_repo: meta.pinned_repo,
  };
}

async function main() {
  const apiKey = process.env.DEVIN_API_KEY;
  const orgId = process.env.DEVIN_ORG_ID;
  if (!apiKey) throw new Error("Missing env var DEVIN_API_KEY");
  if (!orgId) throw new Error("Missing env var DEVIN_ORG_ID");
  const client = new DevinClient(apiKey, orgId, process.env.DEVIN_API_BASE ?? "https://api.devin.ai");

  const files = (await readdir(KNOWLEDGE_DIR)).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    console.log("No knowledge files found in knowledge/");
    return;
  }

  for (const file of files) {
    const raw = await readFile(join(KNOWLEDGE_DIR, file), "utf8");
    const parsed = parseFrontmatter(raw, file);
    console.log(`Uploading: ${parsed.name}`);
    const result = await client.createKnowledge(parsed);
    console.log(`  → note_id=${result.note_id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
