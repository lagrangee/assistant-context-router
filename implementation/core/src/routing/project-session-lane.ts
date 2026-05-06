import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import type {
  NormalizedEnvelope,
  ProjectSessionEvent,
  ProjectSessionSummary,
  ProjectSessionDeliveryResult,
  RouteDecision,
  ServiceResult,
} from "../types.ts";
import {
  deriveProjectSessionSignalKind,
  type SignalPromotionPolicy,
} from "./signal-promotion.ts";

function sanitizeProjectId(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function laneRoot(dataDir?: string): string {
  const root =
    dataDir ??
    process.env.OPENCLAW_PLUGIN_DATA_DIR ??
    process.env.OPENCLAW_DATA_DIR ??
    path.resolve(process.cwd(), ".local");

  return path.join(root, "assistant-context-router", "project-session-events");
}

export function projectSessionEventPath(projectId: string, dataDir?: string): string {
  return path.join(laneRoot(dataDir), `${sanitizeProjectId(projectId)}.jsonl`);
}

export async function appendProjectSessionEvent(input: {
  projectId: string;
  decision: RouteDecision;
  envelope: NormalizedEnvelope;
  dataDir?: string;
  serviceResult?: ServiceResult | null;
  deliveryResult?: ProjectSessionDeliveryResult | null;
  signalPolicy?: SignalPromotionPolicy | null;
}): Promise<string> {
  const filePath = projectSessionEventPath(input.projectId, input.dataDir);
  await mkdir(path.dirname(filePath), { recursive: true });

  const payload: ProjectSessionEvent = {
    recorded_at: new Date().toISOString(),
    project_id: input.projectId,
    signal_kind: deriveProjectSessionSignalKind({
      decision: input.decision,
      envelope: input.envelope,
      deliveryResult: input.deliveryResult,
      serviceResult: input.serviceResult,
      signalPolicy: input.signalPolicy,
    }),
    decision: {
      target_kind: input.decision.target_kind,
      target_id: input.decision.target_id,
      route_reason: input.decision.route_reason,
      route_evidence: input.decision.route_evidence,
      workflow: input.decision.workflow,
      route_source: input.decision.route_source,
      escalation_reason: input.decision.escalation_reason,
      safe_fail_reason: input.decision.safe_fail_reason,
    },
    envelope: {
      source_type: input.envelope.source_type,
      channel_type: input.envelope.channel_type,
      project_ref: input.envelope.project_ref,
      resolved_project_id: input.envelope.resolved_project_id,
      action_name: input.envelope.action_name,
      parameters: input.envelope.parameters,
      trace_id: input.envelope.trace_id,
      workflow: input.envelope.workflow,
      raw_message_ref: input.envelope.raw_message_ref,
      text: input.envelope.text,
    },
    service_result: input.serviceResult
      ? {
          status: input.serviceResult.status,
          result_kind: input.serviceResult.result_kind ?? null,
          work_surface_action: input.serviceResult.work_surface_action ?? null,
          summary: input.serviceResult.summary ?? null,
          reply_payload: input.serviceResult.reply_payload,
          needs_escalation: input.serviceResult.needs_escalation,
          escalation_reason: input.serviceResult.escalation_reason,
          run_id: input.serviceResult.run_id ?? null,
          queue_ref: input.serviceResult.queue_ref ?? null,
          artifact_ref: input.serviceResult.artifact_ref ?? null,
          trace_patch: input.serviceResult.trace_patch ?? null,
        }
      : null,
    delivery_result: input.deliveryResult
      ? {
          status: input.deliveryResult.status,
          runtime_target_id: input.deliveryResult.runtime_target_id,
          fallback_used: input.deliveryResult.fallback_used,
          error_reason: input.deliveryResult.error_reason,
          trace_patch: input.deliveryResult.trace_patch ?? null,
        }
      : null,
  };

  await appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
  return filePath;
}

export async function readProjectSessionEvents(input: {
  projectId: string;
  dataDir?: string;
}): Promise<ProjectSessionEvent[]> {
  const filePath = projectSessionEventPath(input.projectId, input.dataDir);
  try {
    const raw = await readFile(filePath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ProjectSessionEvent);
  } catch {
    return [];
  }
}

export async function summarizeProjectSessionEvents(input: {
  projectId: string;
  dataDir?: string;
  limit?: number;
}): Promise<ProjectSessionSummary> {
  const events = await readProjectSessionEvents(input);
  const latestEvents = events.slice(-(input.limit ?? 20));

  const blocked = latestEvents.filter((event) => event.signal_kind === "blocked");
  const review = latestEvents.filter((event) => event.signal_kind === "review_request");
  const completions = latestEvents.filter(
    (event) => event.signal_kind === "high_signal_completion",
  );
  const errors = latestEvents.filter((event) => event.signal_kind === "service_error");

  const notableEvents = latestEvents.filter((event) => event.signal_kind !== "none");
  const latest = latestEvents[latestEvents.length - 1] ?? null;

  return {
    project_id: input.projectId,
    total_events: latestEvents.length,
    blocked_count: blocked.length,
    review_request_count: review.length,
    high_signal_completion_count: completions.length,
    service_error_count: errors.length,
    latest_signal: latest?.signal_kind ?? "none",
    latest_event_at: latest?.recorded_at ?? null,
    notable_events: notableEvents.slice(-5),
  };
}
