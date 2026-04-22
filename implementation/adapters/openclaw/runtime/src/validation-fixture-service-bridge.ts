import { readFile } from "node:fs/promises";

import type {
  ServiceBridgeAdapter,
  ServiceResult,
} from "../../../../core/src/types.ts";

interface ValidationFixtureFile {
  version?: number;
  by_trace_id?: Record<string, ServiceResult>;
  by_action_name?: Record<string, ServiceResult>;
  default_result?: ServiceResult | null;
}

function buildMissingFixtureResult(input: {
  targetRef: string;
  traceId: string | null;
  actionName: string;
  reason: string;
}): ServiceResult {
  return {
    status: "needs_escalation",
    result_kind: "needs_escalation",
    summary: `Validation fixture missing for ${input.actionName}`,
    reply_payload: null,
    needs_escalation: true,
    escalation_reason: `validation_fixture_missing:${input.reason}`,
    run_id: null,
    queue_ref: null,
    trace_patch: {
      bridge_adapter: "validation_fixture",
      target_ref: input.targetRef,
      trace_id: input.traceId,
      action_name: input.actionName,
      reason: input.reason,
    },
  };
}

async function readFixtureFile(targetRef: string): Promise<ValidationFixtureFile> {
  const raw = await readFile(targetRef, "utf8");
  return JSON.parse(raw) as ValidationFixtureFile;
}

function cloneServiceResult(result: ServiceResult): ServiceResult {
  return {
    ...result,
    artifact_ref: result.artifact_ref ? { ...result.artifact_ref } : null,
    trace_patch: result.trace_patch ? { ...result.trace_patch } : null,
  };
}

export function createValidationFixtureServiceBridgeAdapter(): ServiceBridgeAdapter {
  return async function validationFixtureServiceBridge({
    binding,
    request,
  }) {
    try {
      const fixtureFile = await readFixtureFile(binding.target_ref);
      const traceId = request.trace_id;
      const byTraceId =
        traceId && fixtureFile.by_trace_id && fixtureFile.by_trace_id[traceId]
          ? fixtureFile.by_trace_id[traceId]
          : null;
      const byActionName =
        fixtureFile.by_action_name && fixtureFile.by_action_name[request.action_name]
          ? fixtureFile.by_action_name[request.action_name]
          : null;
      const selected =
        byTraceId ?? byActionName ?? fixtureFile.default_result ?? null;

      if (!selected) {
        return buildMissingFixtureResult({
          targetRef: binding.target_ref,
          traceId,
          actionName: request.action_name,
          reason: "no_matching_fixture_result",
        });
      }

      const result = cloneServiceResult(selected);
      result.trace_patch = {
        ...(result.trace_patch ?? {}),
        bridge_adapter: "validation_fixture",
        target_ref: binding.target_ref,
        matched_by: byTraceId ? "trace_id" : byActionName ? "action_name" : "default_result",
      };
      return result;
    } catch (error) {
      return buildMissingFixtureResult({
        targetRef: binding.target_ref,
        traceId: request.trace_id,
        actionName: request.action_name,
        reason: String((error as Error)?.message ?? error),
      });
    }
  };
}
