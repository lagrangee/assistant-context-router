import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MainSessionEscalationRecord } from "../types.ts";
import { deriveEscalationDedupKey } from "../routing/signal-records.ts";

interface EscalationStateFile {
  version: number;
  sessions: Record<string, MainSessionEscalationRecord[]>;
}

export interface MainSessionEscalationStore {
  upsertOpen(
    seed: Omit<
      MainSessionEscalationRecord,
      "escalation_id" | "created_at" | "updated_at" | "status"
    >,
  ): Promise<MainSessionEscalationRecord>;
  listOpen(input: {
    canonicalSessionKey: string;
    projectId?: string;
  }): Promise<MainSessionEscalationRecord[]>;
  resolve(input: {
    canonicalSessionKey: string;
    escalationId: string;
    resolution?: string | null;
  }): Promise<MainSessionEscalationRecord | null>;
}

function defaultStateFilePath(dataDir?: string): string {
  const root =
    dataDir ??
    process.env.OPENCLAW_PLUGIN_DATA_DIR ??
    process.env.OPENCLAW_DATA_DIR ??
    path.resolve(process.cwd(), ".local");

  return path.join(root, "assistant-context-router", "main-session-escalations.json");
}

function emptyState(): EscalationStateFile {
  return {
    version: 1,
    sessions: {},
  };
}

async function readStateFile(stateFilePath: string): Promise<EscalationStateFile> {
  try {
    const raw = await readFile(stateFilePath, "utf8");
    const parsed = JSON.parse(raw) as EscalationStateFile;
    return {
      version: 1,
      sessions: parsed.sessions ?? {},
    };
  } catch {
    return emptyState();
  }
}

async function writeStateFile(
  stateFilePath: string,
  state: EscalationStateFile,
): Promise<void> {
  await mkdir(path.dirname(stateFilePath), { recursive: true });
  const tempPath = `${stateFilePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(state, null, 2));
  await rename(tempPath, stateFilePath);
}

export function createMainSessionEscalationStore(options?: {
  dataDir?: string;
  now?: () => Date;
}): MainSessionEscalationStore {
  const stateFilePath = defaultStateFilePath(options?.dataDir);
  const now = options?.now ?? (() => new Date());
  let queue = Promise.resolve();

  const withLock = async <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work, work);
    queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  return {
    async upsertOpen(seed) {
      return withLock(async () => {
        const state = await readStateFile(stateFilePath);
        const sessionRecords = state.sessions[seed.canonical_session_key] ?? [];
        const timestamp = now().toISOString();
        const escalationId = deriveEscalationDedupKey(seed);
        const index = sessionRecords.findIndex((record) => record.escalation_id === escalationId);

        if (index >= 0) {
          const existing = sessionRecords[index];
          const updated: MainSessionEscalationRecord = {
            ...existing,
            ...seed,
            escalation_id: escalationId,
            updated_at: timestamp,
            status: existing.status === "resolved" ? "open" : existing.status,
            resolution: existing.status === "resolved" ? null : existing.resolution,
          };
          sessionRecords[index] = updated;
          state.sessions[seed.canonical_session_key] = sessionRecords;
          await writeStateFile(stateFilePath, state);
          return updated;
        }

        const created: MainSessionEscalationRecord = {
          ...seed,
          escalation_id: escalationId,
          created_at: timestamp,
          updated_at: timestamp,
          status: "open",
        };
        sessionRecords.push(created);
        state.sessions[seed.canonical_session_key] = sessionRecords;
        await writeStateFile(stateFilePath, state);
        return created;
      });
    },

    async listOpen(input) {
      return withLock(async () => {
        const state = await readStateFile(stateFilePath);
        const sessionRecords = state.sessions[input.canonicalSessionKey] ?? [];
        return sessionRecords
          .filter((record) => record.status !== "resolved")
          .filter((record) => !input.projectId || record.project_id === input.projectId)
          .sort((left, right) => left.updated_at.localeCompare(right.updated_at));
      });
    },

    async resolve(input) {
      return withLock(async () => {
        const state = await readStateFile(stateFilePath);
        const sessionRecords = state.sessions[input.canonicalSessionKey] ?? [];
        const index = sessionRecords.findIndex((record) => record.escalation_id === input.escalationId);
        if (index === -1) {
          return null;
        }
        const updated: MainSessionEscalationRecord = {
          ...sessionRecords[index],
          status: "resolved",
          resolution: input.resolution ?? null,
          updated_at: now().toISOString(),
        };
        sessionRecords[index] = updated;
        state.sessions[input.canonicalSessionKey] = sessionRecords;
        await writeStateFile(stateFilePath, state);
        return updated;
      });
    },
  };
}
