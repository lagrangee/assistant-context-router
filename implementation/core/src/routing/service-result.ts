import type { ServiceResult, ServiceResultKind } from "../types.ts";

function inferResultKind(status: ServiceResult["status"]): ServiceResultKind {
  if (status === "needs_escalation") {
    return "needs_escalation";
  }
  if (status === "error") {
    return "rejected";
  }
  return "accepted";
}

export function normalizeServiceResult(result: ServiceResult): ServiceResult {
  return {
    ...result,
    result_kind: result.result_kind ?? inferResultKind(result.status),
    summary: result.summary ?? result.reply_payload ?? null,
    run_id: result.run_id ?? null,
    queue_ref: result.queue_ref ?? null,
    artifact_ref: result.artifact_ref ?? null,
    trace_patch: result.trace_patch ?? null,
  };
}
