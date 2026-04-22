import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  NormalizedEnvelope,
  ProjectSessionDeliveryResult,
  ProjectSessionSignalKind,
  RouteDecision,
  ServiceResult,
  WorkSurfaceProjectionSnapshot,
  WorkSurfaceStatus,
} from "../types.ts";

function sanitizeProjectId(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function projectionRoot(dataDir?: string): string {
  const root =
    dataDir ??
    process.env.OPENCLAW_PLUGIN_DATA_DIR ??
    process.env.OPENCLAW_DATA_DIR ??
    path.resolve(process.cwd(), ".local");

  return path.join(root, "assistant-context-router", "work-surface-projections");
}

export function workSurfaceProjectionPath(projectId: string, dataDir?: string): string {
  return path.join(projectionRoot(dataDir), `${sanitizeProjectId(projectId)}.json`);
}

function deriveWorkSurfaceStatus(signalKind: ProjectSessionSignalKind): WorkSurfaceStatus {
  switch (signalKind) {
    case "blocked":
      return "blocked";
    case "review_request":
      return "in_review";
    case "high_signal_completion":
      return "completed";
    case "service_error":
      return "failed";
    default:
      return "none";
  }
}

function deriveHeadline(input: {
  signalKind: ProjectSessionSignalKind;
  actionName: string | null;
}): string {
  const actionName = input.actionName ?? "workflow";

  switch (input.signalKind) {
    case "blocked":
      return `Blocked: ${actionName}`;
    case "review_request":
      return `Review requested: ${actionName}`;
    case "high_signal_completion":
      return `Completed: ${actionName}`;
    case "service_error":
      return `Service error: ${actionName}`;
    default:
      return `Activity: ${actionName}`;
  }
}

function deriveSummary(input: {
  decision: RouteDecision;
  serviceResult?: ServiceResult | null;
  deliveryResult?: ProjectSessionDeliveryResult | null;
}): string | null {
  return (
    input.serviceResult?.summary ??
    input.serviceResult?.reply_payload ??
    input.deliveryResult?.error_reason ??
    input.decision.escalation_reason ??
    input.decision.safe_fail_reason ??
    null
  );
}

export function buildWorkSurfaceProjectionSnapshot(input: {
  projectId: string;
  signalKind: ProjectSessionSignalKind;
  decision: RouteDecision;
  envelope: NormalizedEnvelope;
  serviceResult?: ServiceResult | null;
  deliveryResult?: ProjectSessionDeliveryResult | null;
  now?: () => Date;
}): WorkSurfaceProjectionSnapshot | null {
  if (input.signalKind === "none") {
    return null;
  }

  return {
    project_id: input.projectId,
    updated_at: (input.now ?? (() => new Date()))().toISOString(),
    signal_kind: input.signalKind,
    surface_status: deriveWorkSurfaceStatus(input.signalKind),
    headline: deriveHeadline({
      signalKind: input.signalKind,
      actionName: input.envelope.action_name,
    }),
    summary: deriveSummary(input),
    trace_id: input.envelope.trace_id,
    action_name: input.envelope.action_name,
    workflow: input.envelope.workflow,
    run_id: input.serviceResult?.run_id ?? null,
    queue_ref: input.serviceResult?.queue_ref ?? null,
    artifact_ref: input.serviceResult?.artifact_ref ?? null,
  };
}

export async function writeWorkSurfaceProjectionSnapshot(input: {
  snapshot: WorkSurfaceProjectionSnapshot;
  dataDir?: string;
}): Promise<string> {
  const filePath = workSurfaceProjectionPath(input.snapshot.project_id, input.dataDir);
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(input.snapshot, null, 2));
  await rename(tempPath, filePath);
  return filePath;
}

export async function readWorkSurfaceProjectionSnapshot(input: {
  projectId: string;
  dataDir?: string;
}): Promise<WorkSurfaceProjectionSnapshot | null> {
  const filePath = workSurfaceProjectionPath(input.projectId, input.dataDir);
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as WorkSurfaceProjectionSnapshot;
  } catch {
    return null;
  }
}
