import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { GovernanceDeliveryRecord } from "../types.ts";
import { deriveGovernanceDeliveryDedupKey } from "../routing/governance-delivery.ts";

interface GovernanceDeliveryStateFile {
  version: number;
  deliveries: GovernanceDeliveryRecord[];
}

export interface GovernanceDeliveryOutbox {
  upsertPending(
    seed: Omit<
      GovernanceDeliveryRecord,
      "delivery_id" | "created_at" | "updated_at" | "status" | "runtime_target_id" | "error_reason" | "trace_patch"
    >,
  ): Promise<GovernanceDeliveryRecord>;
  markDelivery(input: {
    deliveryId: string;
    status: GovernanceDeliveryRecord["status"];
    runtimeTargetId?: string | null;
    errorReason?: string | null;
    tracePatch?: Record<string, unknown> | null;
  }): Promise<GovernanceDeliveryRecord | null>;
  listByProject(input: { projectId: string }): Promise<GovernanceDeliveryRecord[]>;
}

export function governanceDeliveryOutboxPath(dataDir?: string): string {
  const root =
    dataDir ??
    process.env.OPENCLAW_PLUGIN_DATA_DIR ??
    process.env.OPENCLAW_DATA_DIR ??
    path.resolve(process.cwd(), ".local");

  return path.join(root, "assistant-context-router", "governance-delivery-outbox.json");
}

function emptyState(): GovernanceDeliveryStateFile {
  return {
    version: 1,
    deliveries: [],
  };
}

async function readStateFile(stateFilePath: string): Promise<GovernanceDeliveryStateFile> {
  try {
    const raw = await readFile(stateFilePath, "utf8");
    const parsed = JSON.parse(raw) as GovernanceDeliveryStateFile;
    return {
      version: 1,
      deliveries: Array.isArray(parsed.deliveries) ? parsed.deliveries : [],
    };
  } catch {
    return emptyState();
  }
}

async function writeStateFile(
  stateFilePath: string,
  state: GovernanceDeliveryStateFile,
): Promise<void> {
  await mkdir(path.dirname(stateFilePath), { recursive: true });
  const tempPath = `${stateFilePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(state, null, 2));
  await rename(tempPath, stateFilePath);
}

export function createGovernanceDeliveryOutbox(options?: {
  dataDir?: string;
  now?: () => Date;
}): GovernanceDeliveryOutbox {
  const stateFilePath = governanceDeliveryOutboxPath(options?.dataDir);
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
    async upsertPending(seed) {
      return withLock(async () => {
        const state = await readStateFile(stateFilePath);
        const timestamp = now().toISOString();
        const deliveryId = deriveGovernanceDeliveryDedupKey({
          escalationId: seed.escalation_id,
          binding: {
            channel_type: seed.channel_type,
            target_kind: seed.target_kind,
            target_ref: seed.target_ref,
            delivery_mode: seed.delivery_mode,
          },
        });
        const index = state.deliveries.findIndex((record) => record.delivery_id === deliveryId);

        if (index >= 0) {
          const existing = state.deliveries[index];
          const updated: GovernanceDeliveryRecord = {
            ...existing,
            ...seed,
            delivery_id: deliveryId,
            updated_at: timestamp,
            status: "pending",
            runtime_target_id: null,
            error_reason: null,
            trace_patch: null,
          };
          state.deliveries[index] = updated;
          await writeStateFile(stateFilePath, state);
          return updated;
        }

        const created: GovernanceDeliveryRecord = {
          ...seed,
          delivery_id: deliveryId,
          created_at: timestamp,
          updated_at: timestamp,
          status: "pending",
          runtime_target_id: null,
          error_reason: null,
          trace_patch: null,
        };
        state.deliveries.push(created);
        await writeStateFile(stateFilePath, state);
        return created;
      });
    },

    async markDelivery(input) {
      return withLock(async () => {
        const state = await readStateFile(stateFilePath);
        const index = state.deliveries.findIndex((record) => record.delivery_id === input.deliveryId);
        if (index === -1) {
          return null;
        }

        const existing = state.deliveries[index];
        const updated: GovernanceDeliveryRecord = {
          ...existing,
          updated_at: now().toISOString(),
          status: input.status,
          runtime_target_id: input.runtimeTargetId ?? existing.runtime_target_id,
          error_reason: input.errorReason ?? null,
          trace_patch: input.tracePatch ?? null,
        };
        state.deliveries[index] = updated;
        await writeStateFile(stateFilePath, state);
        return updated;
      });
    },

    async listByProject(input) {
      return withLock(async () => {
        const state = await readStateFile(stateFilePath);
        return state.deliveries
          .filter((record) => record.project_id === input.projectId)
          .sort((left, right) => left.updated_at.localeCompare(right.updated_at));
      });
    },
  };
}

export async function readGovernanceDeliveryRecords(input?: {
  dataDir?: string;
}): Promise<GovernanceDeliveryRecord[]> {
  const state = await readStateFile(governanceDeliveryOutboxPath(input?.dataDir));
  return state.deliveries.sort((left, right) => left.updated_at.localeCompare(right.updated_at));
}
