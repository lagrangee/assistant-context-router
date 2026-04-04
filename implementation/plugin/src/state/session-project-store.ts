import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  SessionProjectState,
  SessionProjectStatePatch,
} from "../types.ts";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface SessionStateFile {
  version: number;
  sessions: Record<string, SessionProjectState>;
}

export interface SessionProjectStore {
  get(sessionKey: string): Promise<SessionProjectState | null>;
  set(sessionKey: string, patch: SessionProjectStatePatch): Promise<SessionProjectState>;
  clear(sessionKey: string): Promise<void>;
  invalidate(sessionKey: string, patch?: SessionProjectStatePatch): Promise<SessionProjectState>;
  cleanup(): Promise<void>;
}

export interface SessionMetadataAdapter {
  get(sessionKey: string): Promise<SessionProjectState | null>;
  set(sessionKey: string, patch: SessionProjectStatePatch): Promise<SessionProjectState>;
  clear(sessionKey: string): Promise<void>;
}

function defaultStateFilePath(dataDir?: string): string {
  const providedDir =
    dataDir ??
    process.env.OPENCLAW_PLUGIN_DATA_DIR ??
    process.env.OPENCLAW_DATA_DIR;

  if (providedDir) {
    return path.join(providedDir, "assistant-context-router", "session-project-store.json");
  }

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "../../.local/session-project-store.json");
}

function emptyState(): SessionStateFile {
  return {
    version: 1,
    sessions: {},
  };
}

async function readStateFile(stateFilePath: string): Promise<SessionStateFile> {
  try {
    const raw = await readFile(stateFilePath, "utf8");
    const parsed = JSON.parse(raw) as SessionStateFile;
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
  state: SessionStateFile,
): Promise<void> {
  await mkdir(path.dirname(stateFilePath), { recursive: true });
  const tempPath = `${stateFilePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(state, null, 2));
  await rename(tempPath, stateFilePath);
}

export function createSessionProjectStore(options?: {
  dataDir?: string;
  metadataAdapter?: SessionMetadataAdapter;
  ttlMs?: number;
  now?: () => Date;
}): SessionProjectStore {
  if (options?.metadataAdapter) {
    return options.metadataAdapter;
  }

  const stateFilePath = defaultStateFilePath(options?.dataDir);
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
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

  const pruneExpired = (state: SessionStateFile, current: Date): void => {
    for (const [sessionKey, sessionState] of Object.entries(state.sessions)) {
      if (new Date(sessionState.expires_at).getTime() < current.getTime()) {
        delete state.sessions[sessionKey];
      }
    }
  };

  return {
    async get(sessionKey) {
      return withLock(async () => {
        const current = now();
        const state = await readStateFile(stateFilePath);
        pruneExpired(state, current);
        await writeStateFile(stateFilePath, state);
        return state.sessions[sessionKey] ?? null;
      });
    },

    async set(sessionKey, patch) {
      return withLock(async () => {
        const current = now();
        const state = await readStateFile(stateFilePath);
        pruneExpired(state, current);

        const existing = state.sessions[sessionKey];
        const updatedAt = patch.updated_at ?? current.toISOString();
        const expiresAt =
          patch.expires_at ?? new Date(current.getTime() + ttlMs).toISOString();

        const nextState: SessionProjectState = {
          current_project_id:
            patch.current_project_id ?? existing?.current_project_id ?? null,
          selected_at: patch.selected_at ?? existing?.selected_at ?? updatedAt,
          selected_via: patch.selected_via ?? existing?.selected_via ?? "manual",
          current_workflow:
            patch.current_workflow !== undefined
              ? patch.current_workflow
              : (existing?.current_workflow ?? null),
          updated_at: updatedAt,
          expires_at: expiresAt,
          last_route_trace:
            patch.last_route_trace !== undefined
              ? patch.last_route_trace
              : (existing?.last_route_trace ?? null),
        };

        state.sessions[sessionKey] = nextState;
        await writeStateFile(stateFilePath, state);
        return nextState;
      });
    },

    async clear(sessionKey) {
      await withLock(async () => {
        const current = now();
        const state = await readStateFile(stateFilePath);
        pruneExpired(state, current);
        delete state.sessions[sessionKey];
        await writeStateFile(stateFilePath, state);
      });
    },

    async invalidate(sessionKey, patch) {
      return withLock(async () => {
        const current = now();
        const state = await readStateFile(stateFilePath);
        pruneExpired(state, current);

        const existing = state.sessions[sessionKey];
        const updatedAt = patch?.updated_at ?? current.toISOString();
        const expiresAt =
          patch?.expires_at ?? new Date(current.getTime() + ttlMs).toISOString();

        const nextState: SessionProjectState = {
          current_project_id: null,
          selected_at: patch?.selected_at ?? existing?.selected_at ?? updatedAt,
          selected_via: patch?.selected_via ?? existing?.selected_via ?? "route",
          current_workflow:
            patch?.current_workflow !== undefined
              ? patch.current_workflow
              : (existing?.current_workflow ?? null),
          updated_at: updatedAt,
          expires_at: expiresAt,
          last_route_trace:
            patch?.last_route_trace !== undefined
              ? patch.last_route_trace
              : (existing?.last_route_trace ?? null),
        };

        state.sessions[sessionKey] = nextState;
        await writeStateFile(stateFilePath, state);
        return nextState;
      });
    },

    async cleanup() {
      await withLock(async () => {
        const state = await readStateFile(stateFilePath);
        pruneExpired(state, now());
        await writeStateFile(stateFilePath, state);
      });
    },
  };
}
