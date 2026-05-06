import { getProjectById } from "../../../../../core/src/projects/registry.ts";
import { summarizeProjectSessionEvents } from "../../../../../core/src/routing/project-session-lane.ts";
import { readCurrentProjectBinding } from "../../../../../core/src/state/current-project-binding.ts";
import type { MainSessionEscalationStore } from "../../../../../core/src/state/main-session-escalation-store.ts";
import { resolveMainSessionBinding } from "../../../runtime/src/bindings.ts";
import { createSafeFailTrace } from "../../../../../core/src/trace/route-trace.ts";
import type { SessionProjectStore } from "../../../../../core/src/state/session-project-store.ts";
import type {
  ArtifactRef,
  BeforePromptBuildEventLike,
  BeforePromptBuildResult,
  PendingSemanticExecution,
  PromptBuildLikePayload,
  RuntimeBindingsConfig,
} from "../../../../../core/src/types.ts";
import {
  assembleExecutionContext,
  createExecutionEnvelopeFromPendingSemanticExecution,
  type AssembledExecutionContext,
} from "../../../../../harness/src/index.ts";
import { loadProjectContext } from "../../../../../core/src/context/project-context-loader.ts";
import { createSaveModePromptHook } from "./save-mode.ts";

function resolveSessionKey(payload: PromptBuildLikePayload, ctx?: unknown): string | null {
  const ctxRecord = ctx && typeof ctx === "object" ? (ctx as Record<string, unknown>) : null;
  const ctxSession =
    (typeof ctxRecord?.sessionKey === "string" && ctxRecord.sessionKey) ||
    (typeof ctxRecord?.sessionId === "string" && ctxRecord.sessionId) ||
    (ctxRecord?.session && typeof ctxRecord.session === "object"
      ? ((typeof (ctxRecord.session as Record<string, unknown>).sessionKey === "string" &&
          ((ctxRecord.session as Record<string, unknown>).sessionKey as string)) ||
        (typeof (ctxRecord.session as Record<string, unknown>).key === "string" &&
          ((ctxRecord.session as Record<string, unknown>).key as string)))
      : null);

  return (
    ctxSession ??
    payload.sessionKey ??
    payload.session?.sessionKey ??
    payload.session?.key ??
    null
  );
}

function buildContextBlock(renderedContext: string): string {
  return [
    "Assistant Context Router project context:",
    renderedContext,
    "Use this project context as the primary working boundary for the current session.",
  ].join("\n\n");
}

function latestMessageText(messages: unknown[] | undefined): string | null {
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const item = messages[index];
    if (typeof item === "string" && item.trim()) {
      return item.trim();
    }
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const candidates = [
        record.content,
        record.text,
        record.body,
        record.input,
        record.prompt,
      ];
      for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
          return candidate.trim();
        }
      }
    }
  }

  return null;
}

function shouldIncludeLaneSummary(messages: unknown[] | undefined): boolean {
  const text = latestMessageText(messages)?.toLowerCase();
  if (!text) {
    return false;
  }

  const strongKeywords = [
    "blocked",
    "blocker",
    "review",
    "progress",
    "automation",
    "lane",
    "what happened",
    "needs my attention",
    "run",
    "signal",
    "卡住",
    "阻塞",
    "进度",
    "评审",
    "自动化",
    "需要我",
    "有什么需要我处理",
    "发生了什么",
    "运行",
    "信号",
  ];

  return strongKeywords.some((keyword) => text.includes(keyword));
}

function renderArtifactRef(input: ArtifactRef | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const label = input.label?.trim() || input.target;
  return `${label} | ${input.kind} | ${input.target}`;
}

function buildMainSessionEscalationBlock(input: {
  projectId: string;
  records: Array<{
    signal_kind: string;
    action_name: string | null;
    reason: string;
    summary: string | null;
    trace_id: string | null;
    artifact_ref: ArtifactRef | null;
  }>;
}): string | null {
  if (input.records.length === 0) {
    return null;
  }

  const lines = [
    "Assistant Context Router main-session escalations:",
    `project_id: ${input.projectId}`,
    "These are unresolved governance items that require main-session attention.",
    "open_escalations:",
  ];

  for (const record of input.records.slice(-5)) {
    const parts = [
      record.signal_kind,
      record.action_name ?? "unknown_action",
      record.reason,
    ].filter(Boolean);
    lines.push(`- ${parts.join(" | ")}`);
    if (record.summary) {
      lines.push(`  summary: ${record.summary}`);
    }
    if (record.trace_id) {
      lines.push(`  trace_id: ${record.trace_id}`);
    }
    const artifact = renderArtifactRef(record.artifact_ref);
    if (artifact) {
      lines.push(`  artifact_ref: ${artifact}`);
    }
  }

  lines.push(
    "Treat these as governance/escalation items, not as replacements for project truth docs.",
  );

  return lines.join("\n");
}

function buildProjectLaneSummaryBlock(input: {
  projectId: string;
  summary: Awaited<ReturnType<typeof summarizeProjectSessionEvents>>;
}): string | null {
  if (
    input.summary.blocked_count === 0 &&
    input.summary.review_request_count === 0 &&
    input.summary.high_signal_completion_count === 0 &&
    input.summary.service_error_count === 0
  ) {
    return null;
  }

  const lines = [
    "Assistant Context Router project lane summary:",
    `project_id: ${input.projectId}`,
    `latest_signal: ${input.summary.latest_signal}`,
    input.summary.latest_event_at ? `latest_event_at: ${input.summary.latest_event_at}` : null,
    input.summary.blocked_count > 0 ? `blocked_count: ${input.summary.blocked_count}` : null,
    input.summary.review_request_count > 0
      ? `review_request_count: ${input.summary.review_request_count}`
      : null,
    input.summary.high_signal_completion_count > 0
      ? `high_signal_completion_count: ${input.summary.high_signal_completion_count}`
      : null,
    input.summary.service_error_count > 0
      ? `service_error_count: ${input.summary.service_error_count}`
      : null,
  ].filter(Boolean) as string[];

  if (input.summary.notable_events.length > 0) {
    lines.push("recent_notable_events:");
    for (const event of input.summary.notable_events) {
      lines.push(
        `- ${event.signal_kind} | ${event.envelope.action_name ?? "unknown_action"} | ${event.decision.route_reason}`,
      );
      const artifact = renderArtifactRef(event.service_result?.artifact_ref);
      if (artifact) {
        lines.push(`  artifact_ref: ${artifact}`);
      }
    }
  }

  lines.push(
    "Use this only as a high-signal execution hint. Do not treat it as a replacement for project truth docs.",
  );

  return lines.join("\n");
}

function compactSemanticAgentContext(input: AssembledExecutionContext): string {
  const lines = input.agent_context.split(/\r?\n/);
  const compact: string[] = [];
  let skippingOriginJson = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "work_surface_origin_json:") {
      compact.push(
        "work_surface_origin_json: <omitted from prompt; use the work_surface_origin summary above>",
      );
      skippingOriginJson = true;
      continue;
    }

    if (skippingOriginJson) {
      if (trimmed === "execution_context:") {
        skippingOriginJson = false;
        compact.push(line);
      }
      continue;
    }

    compact.push(line);
  }

  return compact.join("\n").replace(/\n{3,}/g, "\n\n");
}

async function buildPendingSemanticExecutionBlock(input: {
  pending: PendingSemanticExecution | null | undefined;
  projectRoot: string;
}): Promise<string | null> {
  if (!input.pending) {
    return null;
  }
  const envelope = createExecutionEnvelopeFromPendingSemanticExecution({
    pending: input.pending,
    projectRoot: input.projectRoot,
  });
  const assembled = await assembleExecutionContext({ envelope });
  return [
    "Assistant Context Router pending semantic execution:",
    compactSemanticAgentContext(assembled),
  ].join("\n");
}

export function createBeforePromptBuildHook(input: {
  registryPath: string;
  store: SessionProjectStore;
  escalationStore?: MainSessionEscalationStore;
  dataDir?: string;
  runtimeBindings?: RuntimeBindingsConfig;
}) {
  const saveModeHook = createSaveModePromptHook({ store: input.store });

  return async function beforePromptBuild(
    event: BeforePromptBuildEventLike,
    ctx?: unknown,
  ): Promise<BeforePromptBuildResult> {
    const sessionKey = resolveSessionKey(event as PromptBuildLikePayload, ctx);
    if (!sessionKey) {
      return {};
    }
    const canonicalSessionKey = resolveMainSessionBinding(
      sessionKey,
      input.runtimeBindings,
    ).canonical_session_key;

    const sessionState = await input.store.get(canonicalSessionKey);
    const binding = readCurrentProjectBinding(sessionState);
    if (!binding) {
      return {};
    }

    const entry = await getProjectById(input.registryPath, binding.project_id);
    if (!entry) {
      await input.store.invalidate(canonicalSessionKey, {
        last_route_trace: createSafeFailTrace(
          `Current project ${binding.project_id} could not be resolved`,
        ),
      });
      return {
        prependSystemContext:
          "Assistant Context Router note: previous project binding was invalidated because its project entry could not be resolved. Continue without project-bound context unless the user reselects a project.",
      };
    }

    const context = await loadProjectContext({ entry });
    if (!context.rendered) {
      await input.store.invalidate(canonicalSessionKey, {
        last_route_trace: createSafeFailTrace(
          `Project context for ${binding.project_id} could not be loaded`,
        ),
      });
      return {
        prependSystemContext:
          "Assistant Context Router note: previous project binding was invalidated because its context could not be loaded. Continue without project-bound context unless the user reselects a project.",
      };
    }

    const saveModeResult = await saveModeHook(event, ctx);
    const prependParts = [buildContextBlock(context.rendered)];
    const pendingSemanticBlock = await buildPendingSemanticExecutionBlock({
      pending: sessionState.pending_semantic_execution,
      projectRoot: entry.project_root,
    });
    if (pendingSemanticBlock) {
      prependParts.push(pendingSemanticBlock);
    }
    if (input.escalationStore) {
      const openEscalations = await input.escalationStore.listOpen({
        canonicalSessionKey,
        projectId: binding.project_id,
      });
      const escalationBlock = buildMainSessionEscalationBlock({
        projectId: binding.project_id,
        records: openEscalations,
      });
      if (escalationBlock) {
        prependParts.push(escalationBlock);
      }
    }
    if (shouldIncludeLaneSummary(event.messages)) {
      const laneSummary = await summarizeProjectSessionEvents({
        projectId: binding.project_id,
        dataDir: input.dataDir,
      });
      const laneBlock = buildProjectLaneSummaryBlock({
        projectId: binding.project_id,
        summary: laneSummary,
      });
      if (laneBlock) {
        prependParts.push(laneBlock);
      }
    }
    if (saveModeResult.prependSystemContext) {
      prependParts.push(saveModeResult.prependSystemContext);
    }

    return {
      prependSystemContext: prependParts.join("\n\n"),
    };
  };
}
