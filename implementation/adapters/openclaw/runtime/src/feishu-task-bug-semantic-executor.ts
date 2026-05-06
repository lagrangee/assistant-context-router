import type {
  PendingSemanticExecutionContext,
  RuntimeBindingsConfig,
  ServiceResult,
  WorkSurfaceActionName,
} from "../../../../core/src/types.ts";
import type { SessionProjectStore } from "../../../../core/src/state/session-project-store.ts";
import {
  assembleExecutionContext,
  validateBoundaryResult,
  type PlaybookRegistry,
} from "../../../../harness/src/index.ts";
import {
  type FeishuTaskBugExecutionContext,
  type FeishuTaskBugSemanticExecutor,
  type FeishuTaskBugSemanticExecutorInput,
} from "../../../feishu/src/task-bug-semantic-service-bridge.ts";
import { resolveMainSessionBinding } from "./bindings.ts";

interface OpenClawRuntimeLike {
  system?: {
    enqueueSystemEvent?: (
      text: string,
      options: {
        sessionKey: string;
        contextKey?: string | null;
        deliveryContext?: Record<string, unknown>;
        trusted?: boolean;
      },
    ) => boolean;
    runHeartbeatOnce?: (options?: {
      reason?: string;
      sessionKey?: string;
      heartbeat?: {
        target?: string;
      };
    }) => Promise<
      | { status: "ran"; durationMs: number }
      | { status: "skipped"; reason: string }
      | { status: "failed"; reason: string }
    >;
    requestHeartbeatNow?: (options?: {
      reason?: string;
      sessionKey?: string;
    }) => unknown;
  };
}

export interface OpenClawMainSessionSemanticExecutorConfig {
  runtime?: OpenClawRuntimeLike;
  runtimeBindings?: RuntimeBindingsConfig;
  store?: SessionProjectStore;
  playbookRegistry?: PlaybookRegistry;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function isPlaceholderString(value: string): boolean {
  return /^<[^>]+>$/.test(value.trim());
}

function pickConcreteString(...values: unknown[]): string | null {
  const value = pickString(...values);
  if (!value || isPlaceholderString(value)) {
    return null;
  }
  return value;
}

function targetRefLooksLikeExecutorTarget(value: string | null): boolean {
  if (!value) {
    return false;
  }
  if (value.startsWith("feishu://")) {
    return false;
  }
  if (value === "tasks-bugs" || value === "base") {
    return false;
  }
  return true;
}

function resolveTargetSessionKey(input: {
  request: FeishuTaskBugSemanticExecutorInput;
  runtimeBindings?: RuntimeBindingsConfig;
}): {
  targetSessionKey: string | null;
  aliasMatched: string | null;
  source: string | null;
} {
  const metadata = asObject(input.request.binding.metadata);
  const explicitTarget = pickString(
    metadata?.executor_session_key,
    metadata?.main_session_key,
    metadata?.target_session_key,
    targetRefLooksLikeExecutorTarget(input.request.binding.target_ref)
      ? input.request.binding.target_ref
      : null,
  );

  if (!explicitTarget) {
    return {
      targetSessionKey: null,
      aliasMatched: null,
      source: null,
    };
  }

  const resolution = resolveMainSessionBinding(
    explicitTarget,
    input.runtimeBindings,
  );

  return {
    targetSessionKey: resolution.canonical_session_key,
    aliasMatched: resolution.alias_matched,
    source: explicitTarget,
  };
}

function toPendingExecutionContext(
  context: FeishuTaskBugExecutionContext,
): PendingSemanticExecutionContext {
  return {
    kind: context.kind,
    record_id: context.record_id,
    status: context.status,
    headline: context.headline,
    project: context.project,
    priority: context.priority,
    assignee: context.assignee,
    acceptance_mode: context.acceptance_mode,
    completion_notify_mode: context.completion_notify_mode,
    next_action: context.next_action,
    business_fields: context.business_fields,
    ...(context.work_surface_origin
      ? { work_surface_origin: context.work_surface_origin }
      : {}),
  };
}

async function buildSemanticExecutionSystemEvent(
  input: FeishuTaskBugSemanticExecutorInput,
  registry?: PlaybookRegistry,
): Promise<string> {
  const assembled = await assembleExecutionContext({
    envelope: input.execution_envelope,
    registry,
  });
  return assembled.agent_context;
}

function pendingSemanticRecordIds(
  input: FeishuTaskBugSemanticExecutorInput,
): {
  taskRecordId: string | null;
  bugRecordId: string | null;
} {
  return {
    taskRecordId: pickString(
      input.request.parameters?.task_record_id,
      input.request.parameters?.taskRecordId,
      input.contexts.find((context) => context.kind === "task")?.record_id,
    ),
    bugRecordId: pickString(
      input.request.parameters?.bug_record_id,
      input.request.parameters?.bugRecordId,
      input.contexts.find((context) => context.kind === "bug")?.record_id,
    ),
  };
}

function boundarySummary(
  input: FeishuTaskBugSemanticExecutorInput,
  fallback: string,
): string {
  return (
    pickString(
      input.request.parameters?.summary,
      input.request.parameters?.comment,
      input.request.parameters?.reason,
      input.contexts[0]?.headline,
    ) ?? fallback
  );
}

function completeBoundarySummary(input: FeishuTaskBugSemanticExecutorInput): string | null {
  return pickConcreteString(
    input.request.parameters?.summary,
    input.request.parameters?.completion_summary,
    input.request.parameters?.completionSummary,
  );
}

function terminalResult(input: {
  executorInput: FeishuTaskBugSemanticExecutorInput;
  action: WorkSurfaceActionName;
  status: ServiceResult["status"];
  resultKind: NonNullable<ServiceResult["result_kind"]>;
  summary: string;
  escalationReason?: string | null;
}): ServiceResult {
  return {
    status: input.status,
    result_kind: input.resultKind,
    work_surface_action: input.action,
    summary: input.summary,
    reply_payload: input.summary,
    needs_escalation: input.status === "needs_escalation",
    escalation_reason: input.escalationReason ?? null,
    trace_patch: {
      executor: "openclaw_main_session_mediated",
      executor_mode: "terminal_boundary_passthrough",
      semantic_boundary_action: input.action,
      semantic_context_count: input.executorInput.contexts.length,
    },
  };
}

async function wakeTargetSession(input: {
  runtime: OpenClawRuntimeLike;
  targetSessionKey: string;
  wakeReason: string;
}): Promise<Record<string, unknown>> {
  if (input.runtime.system?.requestHeartbeatNow) {
    input.runtime.system.requestHeartbeatNow({
      reason: input.wakeReason,
      sessionKey: input.targetSessionKey,
    });
    return {
      heartbeat_status: "requested",
    };
  }

  if (input.runtime.system?.runHeartbeatOnce) {
    void input.runtime.system.runHeartbeatOnce({
      reason: input.wakeReason,
      sessionKey: input.targetSessionKey,
      heartbeat: {
        target: "last",
      },
    }).catch(() => {
      // Dispatch ACK/writeback must not be blocked by the target session heartbeat.
    });

    return {
      heartbeat_status: "requested",
      heartbeat_mode: "run_once_async",
    };
  }

  return {
    heartbeat_status: "not_available",
  };
}

export function createOpenClawMainSessionSemanticExecutor(
  config: OpenClawMainSessionSemanticExecutorConfig,
): FeishuTaskBugSemanticExecutor {
  return async (input) => {
    if (input.request.action_name === "complete") {
      const validation = validateBoundaryResult({
        action_name: input.request.action_name,
        parameters: input.request.parameters,
        work_items: input.execution_envelope.work_items,
        accepted_bug_fix_results:
          input.execution_envelope.boundary_requirements.bug_fix_result_values,
      });
      const summary = validation.boundary?.summary ?? completeBoundarySummary(input);
      if (!validation.ok || !summary) {
        return terminalResult({
          executorInput: input,
          action: "blocked",
          status: "needs_escalation",
          resultKind: "needs_escalation",
          summary: `Semantic complete boundary invalid: ${validation.errors.join(", ")}`,
          escalationReason: validation.escalation_reason ?? "semantic_boundary_invalid",
        });
      }
      return terminalResult({
        executorInput: input,
        action: "complete",
        status: "ok",
        resultKind: "accepted",
        summary,
      });
    }

    if (input.request.action_name === "review_resolution") {
      return terminalResult({
        executorInput: input,
        action: "review_resolution",
        status: "ok",
        resultKind: "accepted",
        summary: `Review resolution recorded for ${input.request.resolved_project_id}`,
      });
    }

    if (
      input.request.action_name === "review" ||
      input.request.action_name === "review_request"
    ) {
      const validation = validateBoundaryResult({
        action_name: input.request.action_name,
        parameters: input.request.parameters,
        work_items: input.execution_envelope.work_items,
      });
      if (!validation.ok) {
        return terminalResult({
          executorInput: input,
          action: "blocked",
          status: "needs_escalation",
          resultKind: "needs_escalation",
          summary: `Semantic review boundary invalid: ${validation.errors.join(", ")}`,
          escalationReason: validation.escalation_reason ?? "semantic_boundary_invalid",
        });
      }
      return terminalResult({
        executorInput: input,
        action: "review_request",
        status: "needs_escalation",
        resultKind: "needs_escalation",
        summary: boundarySummary(input, "Semantic execution requires review"),
        escalationReason: "semantic_execution_review_required",
      });
    }

    if (input.request.action_name === "blocked") {
      const validation = validateBoundaryResult({
        action_name: input.request.action_name,
        parameters: input.request.parameters,
        work_items: input.execution_envelope.work_items,
      });
      if (!validation.ok) {
        return terminalResult({
          executorInput: input,
          action: "blocked",
          status: "needs_escalation",
          resultKind: "needs_escalation",
          summary: `Semantic blocked boundary invalid: ${validation.errors.join(", ")}`,
          escalationReason: validation.escalation_reason ?? "semantic_boundary_invalid",
        });
      }
      return terminalResult({
        executorInput: input,
        action: "blocked",
        status: "needs_escalation",
        resultKind: "needs_escalation",
        summary: boundarySummary(input, "Semantic execution is blocked"),
        escalationReason: "semantic_execution_blocked",
      });
    }

    const targetResolution = resolveTargetSessionKey({
      request: input,
      runtimeBindings: config.runtimeBindings,
    });
    const targetSessionKey = targetResolution.targetSessionKey;

    if (!targetSessionKey) {
      return {
        status: "needs_escalation",
        result_kind: "needs_escalation",
        work_surface_action: "blocked",
        summary: "Semantic executor target main session is not configured",
        reply_payload: null,
        needs_escalation: true,
        escalation_reason: "semantic_executor_target_not_configured",
        trace_patch: {
          executor: "openclaw_main_session_mediated",
          executor_target_configured: false,
        },
      };
    }

    const enqueueSystemEvent = config.runtime?.system?.enqueueSystemEvent;
    if (!enqueueSystemEvent) {
      return {
        status: "needs_escalation",
        result_kind: "needs_escalation",
        work_surface_action: "blocked",
        summary: "OpenClaw runtime system API is not available for semantic execution",
        reply_payload: null,
        needs_escalation: true,
        escalation_reason: "missing_openclaw_runtime_system_api",
        trace_patch: {
          executor: "openclaw_main_session_mediated",
          executor_target_configured: true,
          target_session_key: targetSessionKey,
        },
      };
    }

    const wakeReason = "acr:semantic_execution";
    const accepted = enqueueSystemEvent(await buildSemanticExecutionSystemEvent(
      input,
      config.playbookRegistry,
    ), {
      sessionKey: targetSessionKey,
      contextKey: `acr:semantic:${input.request.resolved_project_id}`,
      trusted: true,
      deliveryContext: {
        project_id: input.request.resolved_project_id,
        trace_id: input.request.trace_id,
        action_name: input.request.action_name,
        context_count: input.contexts.length,
      },
    });

    if (!accepted) {
      return {
        status: "needs_escalation",
        result_kind: "needs_escalation",
        work_surface_action: "blocked",
        summary: "OpenClaw rejected semantic execution system event",
        reply_payload: null,
        needs_escalation: true,
        escalation_reason: "openclaw_semantic_execution_event_rejected",
        trace_patch: {
          executor: "openclaw_main_session_mediated",
          target_session_key: targetSessionKey,
        },
      };
    }

    const pendingRecordIds = pendingSemanticRecordIds(input);
    await config.store?.set(targetSessionKey, {
      current_project_id: input.request.resolved_project_id,
      selected_via: "route",
      current_workflow: input.request.workflow ?? null,
      pending_semantic_execution: {
        created_at: new Date().toISOString(),
        project_id: input.request.resolved_project_id,
        action_name: input.request.action_name,
        workflow: input.request.workflow,
        trace_id: input.request.trace_id,
        task_record_id: pendingRecordIds.taskRecordId,
        bug_record_id: pendingRecordIds.bugRecordId,
        adapter_facts: input.execution_envelope.adapter_facts,
        execution_contexts: input.contexts.map(toPendingExecutionContext),
      },
    });

    const wakeTrace = await wakeTargetSession({
      runtime: config.runtime ?? {},
      targetSessionKey,
      wakeReason,
    });

    return {
      status: "ok",
      result_kind: "queued",
      work_surface_action: "dispatch",
      summary: `Semantic execution request queued for ${input.request.resolved_project_id}`,
      reply_payload: `Semantic execution request queued for ${input.request.resolved_project_id}`,
      needs_escalation: false,
      escalation_reason: null,
      queue_ref: `openclaw:${targetSessionKey}:${input.request.trace_id ?? "no-trace"}`,
      trace_patch: {
        executor: "openclaw_main_session_mediated",
        executor_target_configured: true,
        target_session_key: targetSessionKey,
        target_source: targetResolution.source,
        target_alias_matched: targetResolution.aliasMatched,
        semantic_context_count: input.contexts.length,
        delivery_mode: "system_event",
        wake_reason: wakeReason,
        ...wakeTrace,
      },
    };
  };
}
