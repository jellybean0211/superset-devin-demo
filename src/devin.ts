import { setTimeout as sleep } from "node:timers/promises";

export type SessionStatus =
  | "new"
  | "claimed"
  | "running"
  | "exit"
  | "error"
  | "suspended"
  | "resuming";

export interface CreateSessionInput {
  prompt: string;
  title?: string;
  tags?: string[];
  knowledge_ids?: string[];
  repos?: string[];
  max_acu_limit?: number;
  devin_mode?: "normal" | "fast";
  bypass_approval?: boolean;
}

export interface CreateSessionResponse {
  session_id: string;
  url: string;
  org_id: string;
  status: SessionStatus;
  status_detail?: string;
}

export interface PullRequestRef {
  pr_url?: string;
  pr_state?: string;
}

export interface SessionDetails {
  session_id: string;
  url: string;
  status: SessionStatus;
  status_detail?: string;
  title?: string;
  created_at: string;
  updated_at: string;
  pull_requests?: PullRequestRef[];
  acus_consumed?: number;
  tags?: string[];
}

export interface CreateKnowledgeInput {
  name: string;
  body: string;
  trigger: string;
  pinned_repo?: string;
}

export interface KnowledgeResponse {
  note_id: string;
  name: string;
  trigger: string;
  pinned_repo?: string | null;
}

export class DevinClient {
  constructor(
    private readonly apiKey: string,
    private readonly orgId: string,
    private readonly baseUrl: string = "https://api.devin.ai",
  ) {
    if (!apiKey) throw new Error("DEVIN_API_KEY is required");
    if (!orgId) throw new Error("DEVIN_ORG_ID is required (format: org-xxxxxxxx)");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Devin API ${init?.method ?? "GET"} ${path} failed: ${res.status} ${text}`);
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  private orgPath(suffix: string): string {
    return `/v3/organizations/${this.orgId}${suffix}`;
  }

  createSession(input: CreateSessionInput): Promise<CreateSessionResponse> {
    return this.request<CreateSessionResponse>(this.orgPath("/sessions"), {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  getSession(sessionId: string): Promise<SessionDetails> {
    return this.request<SessionDetails>(this.orgPath(`/sessions/${sessionId}`));
  }

  createKnowledge(input: CreateKnowledgeInput): Promise<KnowledgeResponse> {
    return this.request<KnowledgeResponse>(this.orgPath("/knowledge/notes"), {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async *poll(sessionId: string, intervalMs = 30_000): AsyncGenerator<SessionDetails> {
    const terminal: SessionStatus[] = ["exit", "error", "suspended"];
    while (true) {
      const details = await this.getSession(sessionId);
      yield details;
      if (terminal.includes(details.status)) return;
      await sleep(intervalMs);
    }
  }
}
