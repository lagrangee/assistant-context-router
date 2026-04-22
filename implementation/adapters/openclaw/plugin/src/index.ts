import {
  buildMissingSessionKeyMessage,
  handleProjectCommand,
  parseProjectCommandArgs,
  renderProjectCommandHelp,
  resolveSessionKeyFromCommandContext,
} from "./commands/project.ts";
import { handleProjectLaneCommand } from "./commands/project-lane.ts";
import { handleProjectGovernanceCommand } from "./commands/project-governance.ts";
import {
  handleProjectCatalogSyncCommand,
  type ProjectCatalogSyncRunner,
} from "./commands/project-catalog-sync.ts";
import {
  handleProjectWorkSurfaceSyncCommand,
  type ProjectWorkSurfaceSyncRunner,
} from "./commands/project-work-surface-sync.ts";
import { handleProjectsCommand } from "./commands/projects.ts";
import { parseStructuredAutomationMessage } from "./protocols/automation-message.ts";
import { getProjectById } from "../../../../core/src/projects/registry.ts";
import { loadProjectRouterConfig, loadRouterConfig, mergeRouterConfigs } from "../../../../core/src/routing/config.ts";
import { appendBusinessNotificationRecord } from "../../../../core/src/routing/business-notification-log.ts";
import { buildGovernanceDeliverySeed } from "../../../../core/src/routing/governance-delivery.ts";
import { appendProjectSessionEvent } from "../../../../core/src/routing/project-session-lane.ts";
import {
  buildBusinessNotificationRecord,
  buildMainSessionEscalationSeed,
} from "../../../../core/src/routing/signal-records.ts";
import { buildBusinessNotificationDeliveryPlan } from "../../../../core/src/routing/business-notification-delivery.ts";
import {
  buildWorkSurfaceProjectionSnapshot,
  writeWorkSurfaceProjectionSnapshot,
} from "../../../../core/src/routing/work-surface-projection.ts";
import {
  decideSignalPromotion,
  deriveProjectSessionSignalKind,
} from "../../../../core/src/routing/signal-promotion.ts";
import { createInternalServiceRegistry } from "../../../../core/src/routing/services.ts";
import { createServiceBridgeRegistry } from "../../../../core/src/routing/service-bridge.ts";
import { loadRuntimeBindingsConfig, resolveMainSessionBinding } from "../../runtime/src/bindings.ts";
import {
  loadWorkflowBindingsConfig,
  resolveWorkflowDefaultReplyTarget,
} from "../../runtime/src/workflow-bindings.ts";
import {
  createOpenClawProjectSessionDeliveryAdapter,
  createProjectSessionDeliveryRegistry,
} from "../../runtime/src/project-session-delivery.ts";
import { createOpenClawGovernanceDeliveryAdapter } from "../../runtime/src/governance-delivery.ts";
import { createValidationFixtureServiceBridgeAdapter } from "../../runtime/src/validation-fixture-service-bridge.ts";
import { handleSaveCommand } from "./commands/save.ts";
import { createBeforePromptBuildHook } from "./hooks/before-prompt-build.ts";
import { decideRoute } from "../../../../core/src/routing/decision.ts";
import { normalizeIngressEvent } from "../../../../core/src/routing/ingress.ts";
import { createSaveModeLlmOutputHook } from "./hooks/save-mode.ts";
import { createMainSessionEscalationStore } from "../../../../core/src/state/main-session-escalation-store.ts";
import { createGovernanceDeliveryOutbox } from "../../../../core/src/state/governance-delivery-outbox.ts";
import { createBusinessNotificationDeliveryOutbox } from "../../../../core/src/state/business-notification-delivery-outbox.ts";
import { createSessionProjectStore } from "../../../../core/src/state/session-project-store.ts";
import { createRouteTraceFromDecision } from "../../../../core/src/trace/route-trace.ts";
import type {
  BusinessNotificationRecord,
  CommandContextLike,
  MainSessionEscalationRecord,
  NormalizedEnvelope,
} from "../../../../core/src/types.ts";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveGovernanceDeliveryBinding,
} from "../../../feishu/src/config-host.ts";
import {
  resolveDefaultFeishuProjectCatalogSyncOptions,
  runFeishuProjectCatalogSync,
} from "../../../feishu/src/project-catalog-sync.ts";
import {
  hasFeishuTaskBugWritebackAnchors,
  resolveDefaultFeishuTaskBugWritebackOptions,
  runFeishuTaskBugWriteback,
} from "../../../feishu/src/task-bug-writeback.ts";
import {
  resolveDefaultFeishuWorkSurfaceManualSyncOptions,
  runFeishuWorkSurfaceManualSync,
} from "../../../work-surfaces/feishu/src/manual-sync.ts";
import { createOpenClawFeishuBusinessNotificationDeliveryAdapter } from "../../runtime/src/business-notification-delivery.ts";
import { handleProjectNotificationsCommand } from "./commands/project-notifications.ts";

interface PluginApiLike {
  config?: {
    registryPath?: string;
    dataDir?: string;
    routerConfigPath?: string;
    runtimeBindingsPath?: string;
    feishuConfigPath?: string;
    workflowBindingsPath?: string;
  };
  pluginConfig?: {
    registryPath?: string;
    dataDir?: string;
    routerConfigPath?: string;
    runtimeBindingsPath?: string;
    feishuConfigPath?: string;
    workflowBindingsPath?: string;
  };
  runtime?: {
    state?: {
      resolveStateDir?: () => string;
    };
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
  };
  logger?: {
    debug?: (message: string) => void;
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  };
  registerCommand?: (command: {
    name: string;
    description: string;
    acceptsArgs?: boolean;
    requireAuth?: boolean;
    handler: (ctx: CommandContextLike) => Promise<{ text: string }>;
  }) => void;
  on?: (
    eventName: "before_prompt_build" | "before_dispatch" | "llm_output",
    handler: (event: Record<string, unknown>, ctx?: unknown) => Promise<Record<string, unknown>>,
    options?: { priority?: number },
  ) => void;
}

function buildDefaultWorkSurfaceSyncRunner(config: {
  feishuConfigPath?: string | null;
  env?: NodeJS.ProcessEnv;
} = {}): ProjectWorkSurfaceSyncRunner {
  return async (input) => {
    const binding = await resolveDefaultFeishuWorkSurfaceManualSyncOptions({
      configPath: config.feishuConfigPath,
      env: config.env,
      dataDir: input.dataDir,
    });

    return runFeishuWorkSurfaceManualSync({
      projectId: input.projectId,
      dataDir: input.dataDir,
      apply: input.apply,
      ...binding,
    });
  };
}

function buildDefaultProjectCatalogSyncRunner(config: {
  feishuConfigPath?: string | null;
  env?: NodeJS.ProcessEnv;
} = {}): ProjectCatalogSyncRunner {
  return async (input) => {
    const binding = await resolveDefaultFeishuProjectCatalogSyncOptions({
      configPath: config.feishuConfigPath,
      env: config.env,
      dataDir: input.dataDir,
    });

    return runFeishuProjectCatalogSync({
      registryPath: input.registryPath,
      projectId: input.projectId,
      dataDir: input.dataDir,
      apply: input.apply,
      ...binding,
    });
  };
}

export interface GovernanceDeliveryObserverInput {
  escalation: MainSessionEscalationRecord;
  dataDir?: string;
}

export type GovernanceDeliveryObserver = (
  input: GovernanceDeliveryObserverInput,
) => Promise<unknown>;

export interface BusinessNotificationDeliveryObserverInput {
  notification: BusinessNotificationRecord;
  envelope: NormalizedEnvelope;
  dataDir?: string;
}

export type BusinessNotificationDeliveryObserver = (
  input: BusinessNotificationDeliveryObserverInput,
) => Promise<unknown>;

export interface TaskBugWritebackObserverInput {
  projectId: string;
  envelope: NormalizedEnvelope;
  serviceResult: import("../../../../core/src/types.ts").ServiceResult;
  routerConfig: import("../../../../core/src/types.ts").RouterConfig;
  dataDir?: string;
}

export type TaskBugWritebackObserver = (
  input: TaskBugWritebackObserverInput,
) => Promise<unknown>;

function buildDefaultGovernanceDeliveryObserver(config: {
  feishuConfigPath?: string | null;
  env?: NodeJS.ProcessEnv;
  runtime?: PluginApiLike["runtime"];
  runtimeBindings?: Awaited<ReturnType<typeof loadRuntimeBindingsConfig>>;
} = {}): GovernanceDeliveryObserver {
  return async (input) => {
    const binding = await resolveGovernanceDeliveryBinding({
      configPath: config.feishuConfigPath,
      env: config.env,
      dataDir: input.dataDir,
    });

    if (!binding) {
      return null;
    }

    const outbox = createGovernanceDeliveryOutbox({
      dataDir: input.dataDir,
    });
    const record = await outbox.upsertPending(
      buildGovernanceDeliverySeed({
        escalation: input.escalation,
        binding,
      }),
    );

    const deliveryAdapter = createOpenClawGovernanceDeliveryAdapter({
      runtime: config.runtime,
      runtimeBindings: config.runtimeBindings,
    });
    const deliveryResult = await deliveryAdapter(record);

    return outbox.markDelivery({
      deliveryId: record.delivery_id,
      status: deliveryResult.status,
      runtimeTargetId: deliveryResult.runtime_target_id,
      errorReason: deliveryResult.error_reason,
      tracePatch: deliveryResult.trace_patch,
    });
  };
}

function buildDefaultBusinessNotificationDeliveryObserver(config: {
  env?: NodeJS.ProcessEnv;
  workflowBindingsPath?: string | null;
} = {}): BusinessNotificationDeliveryObserver {
  return async (input) => {
    const workflowBindings = await loadWorkflowBindingsConfig(
      config.workflowBindingsPath,
      config.env,
      input.dataDir,
    );
    const outbox = createBusinessNotificationDeliveryOutbox({
      dataDir: input.dataDir,
    });
    const plan = buildBusinessNotificationDeliveryPlan({
      notification: input.notification,
      envelope: input.envelope,
      defaultReplyTarget: resolveWorkflowDefaultReplyTarget({
        workflow: input.notification.workflow ?? input.envelope.workflow,
        config: workflowBindings,
      }),
    });
    const record = await outbox.upsertPending(plan.seed);

    if (!plan.deliverable) {
      return outbox.markDelivery({
        deliveryId: record.delivery_id,
        status: "record_only",
        errorReason: plan.error_reason,
        tracePatch: {
          delivered_by: "record_only_fallback",
        },
      });
    }

    const deliveryAdapter = createOpenClawFeishuBusinessNotificationDeliveryAdapter({
      env: config.env,
    });
    const deliveryResult = await deliveryAdapter(record);

    return outbox.markDelivery({
      deliveryId: record.delivery_id,
      status: deliveryResult.status,
      runtimeTargetId: deliveryResult.runtime_target_id,
      errorReason: deliveryResult.error_reason,
      tracePatch: deliveryResult.trace_patch,
    });
  };
}

function buildDefaultTaskBugWritebackObserver(config: {
  feishuConfigPath?: string | null;
  env?: NodeJS.ProcessEnv;
} = {}): TaskBugWritebackObserver {
  return async (input) => {
    if (!hasFeishuTaskBugWritebackAnchors(input.envelope.parameters)) {
      return null;
    }

    const binding = await resolveDefaultFeishuTaskBugWritebackOptions({
      configPath: config.feishuConfigPath,
      env: config.env,
      dataDir: input.dataDir,
    });

    return runFeishuTaskBugWriteback({
      envelope: input.envelope,
      serviceResult: input.serviceResult,
      routerConfig: input.routerConfig,
      dataDir: input.dataDir,
      apply: true,
      ...binding,
    });
  };
}

function debugLog(api: PluginApiLike, message: string): void {
  api.logger?.info?.(`[assistant-context-router] ${message}`);
}

function formatCommandError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  const fallback = String(error).trim();
  return fallback || "Command failed.";
}

function resolveDefaultRegistryPath(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(currentDir, "../../../../../../../index.yaml");
}

function pickTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeSlashLikeText(rawText: string): string {
  let text = rawText.trim();

  // Some surfaces prepend a lightweight timestamp/metainfo wrapper before the
  // actual user input, e.g. `[Sat ...] /project foo`. Strip those wrappers so
  // slash commands can still be recognized by before_dispatch.
  while (text.startsWith("[")) {
    if (text.startsWith("[ACR_AUTOMATION]")) {
      return text;
    }
    const closeIndex = text.indexOf("]");
    if (closeIndex === -1) {
      break;
    }
    const remainder = text.slice(closeIndex + 1).trimStart();
    if (!remainder) {
      break;
    }
    text = remainder;
  }

  return text;
}

function resolveMessageText(event: Record<string, unknown>, ctx?: unknown): string {
  const messageRecord =
    event.message && typeof event.message === "object"
      ? (event.message as Record<string, unknown>)
      : null;
  const payloadRecord =
    event.payload && typeof event.payload === "object"
      ? (event.payload as Record<string, unknown>)
      : null;
  const ctxRecord = ctx && typeof ctx === "object" ? (ctx as Record<string, unknown>) : null;

  const candidates = [
    event.text,
    event.body,
    event.content,
    event.input,
    event.rawText,
    event.commandBody,
    typeof event.message === "string" ? event.message : undefined,
    messageRecord?.text,
    messageRecord?.body,
    messageRecord?.content,
    payloadRecord?.text,
    payloadRecord?.body,
    payloadRecord?.content,
    ctxRecord?.text,
    ctxRecord?.body,
    ctxRecord?.content,
    ctxRecord?.input,
    ctxRecord?.commandBody,
  ];

  for (const value of candidates) {
    const text = pickTrimmedString(value);
      if (text) {
      return normalizeSlashLikeText(text);
    }
  }
  return "";
}

function resolveSessionKeyFromEvent(event: Record<string, unknown>, ctx?: unknown): string | null {
  const eventSession =
    (typeof event.sessionKey === "string" && event.sessionKey.trim()) ||
    (event.session && typeof event.session === "object" && event.session !== null
      ? ((typeof (event.session as Record<string, unknown>).sessionKey === "string" &&
          ((event.session as Record<string, unknown>).sessionKey as string).trim()) ||
        (typeof (event.session as Record<string, unknown>).key === "string" &&
          ((event.session as Record<string, unknown>).key as string).trim()))
      : null);
  if (eventSession) {
    return eventSession;
  }

  if (ctx && typeof ctx === "object") {
    const commandCtx = ctx as CommandContextLike;
    return resolveSessionKeyFromCommandContext(commandCtx);
  }

  return null;
}

async function handleSlashLikeInput(input: {
  text: string;
  sessionKey: string | null;
  registryPath: string;
  store: ReturnType<typeof createSessionProjectStore>;
  dataDir?: string;
  workSurfaceSync: ProjectWorkSurfaceSyncRunner;
  projectCatalogSync: ProjectCatalogSyncRunner;
}): Promise<{ text: string } | null> {
  const text = input.text.trim();
  if (text === "/project" || text.startsWith("/project ")) {
    const parsed = parseProjectCommandArgs(text.slice("/project".length).trim());

    if (parsed.action === "help") {
      return { text: renderProjectCommandHelp() };
    }

    if (parsed.action === "list") {
      const result = await handleProjectsCommand({
        registryPath: input.registryPath,
        query: parsed.projectId,
      });
      return { text: result.content };
    }

    if (parsed.action === "lane") {
      const result = await handleProjectLaneCommand({
        registryPath: input.registryPath,
        store: input.store,
        sessionKey: input.sessionKey,
        projectId: parsed.projectId,
        dataDir: input.dataDir,
      });
      return { text: result.content };
    }

    if (parsed.action === "notifications") {
      const result = await handleProjectNotificationsCommand({
        registryPath: input.registryPath,
        store: input.store,
        sessionKey: input.sessionKey,
        projectId: parsed.projectId,
        dataDir: input.dataDir,
      });
      return { text: result.content };
    }

    if (parsed.action === "governance") {
      const result = await handleProjectGovernanceCommand({
        registryPath: input.registryPath,
        store: input.store,
        sessionKey: input.sessionKey,
        projectId: parsed.projectId,
        dataDir: input.dataDir,
      });
      return { text: result.content };
    }

    if (parsed.action === "surface_sync") {
      const result = await handleProjectWorkSurfaceSyncCommand({
        registryPath: input.registryPath,
        store: input.store,
        sessionKey: input.sessionKey,
        projectId: parsed.projectId,
        dataDir: input.dataDir,
        apply: parsed.apply,
        sync: input.workSurfaceSync,
      });
      return { text: result.content };
    }

    if (parsed.action === "catalog_sync") {
      const result = await handleProjectCatalogSyncCommand({
        registryPath: input.registryPath,
        store: input.store,
        sessionKey: input.sessionKey,
        projectId: parsed.projectId,
        dataDir: input.dataDir,
        apply: parsed.apply,
        sync: input.projectCatalogSync,
      });
      return { text: result.content };
    }

    if (parsed.action === "save") {
      if (!input.sessionKey) {
        return { text: buildMissingSessionKeyMessage() };
      }

      const result = await handleSaveCommand({
        sessionKey: input.sessionKey,
        registryPath: input.registryPath,
        store: input.store,
        mode: parsed.saveMode,
      });

      if (parsed.saveMode === "arm") {
        return null;
      }

      return { text: result.content };
    }

    if (!parsed.projectId) {
      return { text: renderProjectCommandHelp() };
    }
    if (!input.sessionKey) {
      return { text: buildMissingSessionKeyMessage(parsed.projectId) };
    }
    const result = await handleProjectCommand({
      registryPath: input.registryPath,
      projectId: parsed.projectId,
      sessionKey: input.sessionKey,
      store: input.store,
    });
    return { text: result.content };
  }

  return null;
}

function buildAutomationSafeFailMessage(reason: string): string {
  return `Assistant Context Router safe-fail: ${reason}.`;
}

function buildAutomationProtocolErrorMessage(reason: string): string {
  return `Assistant Context Router safe-fail: malformed automation message (${reason}).`;
}

async function recordSignalPromotion(input: {
  runtime: PluginRuntimeContext;
  projectId: string;
  canonicalSessionKey: string | null;
  decision: import("../../../../core/src/types.ts").RouteDecision;
  envelope: import("../../../../core/src/types.ts").NormalizedEnvelope;
  serviceResult?: import("../../../../core/src/types.ts").ServiceResult | null;
  deliveryResult?: import("../../../../core/src/types.ts").ProjectSessionDeliveryResult | null;
}): Promise<import("../../../../core/src/types.ts").SignalPromotionDecision> {
  const signalKind = deriveProjectSessionSignalKind({
    decision: input.decision,
    envelope: input.envelope,
    serviceResult: input.serviceResult,
    deliveryResult: input.deliveryResult,
  });
  const promotion = decideSignalPromotion({
    signalKind,
    decision: input.decision,
    serviceResult: input.serviceResult,
    deliveryResult: input.deliveryResult,
  });

  const workSurfaceProjection = buildWorkSurfaceProjectionSnapshot({
    projectId: input.projectId,
    signalKind,
    decision: input.decision,
    envelope: input.envelope,
    serviceResult: input.serviceResult,
    deliveryResult: input.deliveryResult,
  });

  if (workSurfaceProjection) {
    const snapshotPath = await writeWorkSurfaceProjectionSnapshot({
      dataDir: input.runtime.resolvedDataDir,
      snapshot: workSurfaceProjection,
    });
    await input.runtime.workSurfaceProjectionObserver?.({
      projectId: input.projectId,
      snapshot: workSurfaceProjection,
      snapshotPath,
      dataDir: input.runtime.resolvedDataDir,
    });
  }

  if (promotion.business_notification) {
    const notification = buildBusinessNotificationRecord({
      projectId: input.projectId,
      signalKind,
      decision: input.decision,
      envelope: input.envelope,
      serviceResult: input.serviceResult,
      deliveryResult: input.deliveryResult,
    });
    await appendBusinessNotificationRecord({
      dataDir: input.runtime.resolvedDataDir,
      record: notification,
    });
    await input.runtime.businessNotificationDeliveryObserver?.({
      notification,
      envelope: input.envelope,
      dataDir: input.runtime.resolvedDataDir,
    });
  }

  if (promotion.main_session_escalation && input.canonicalSessionKey) {
    const escalation = await input.runtime.escalationStore.upsertOpen(
      buildMainSessionEscalationSeed({
        canonicalSessionKey: input.canonicalSessionKey,
        projectId: input.projectId,
        signalKind,
        decision: input.decision,
        envelope: input.envelope,
        serviceResult: input.serviceResult,
        deliveryResult: input.deliveryResult,
      }),
    );
    await input.runtime.governanceDeliveryObserver?.({
      escalation,
      dataDir: input.runtime.resolvedDataDir,
    });
  }

  return promotion;
}

type ServiceHandlers = Record<string, import("../../../../core/src/types.ts").InternalServiceHandler>;
type ServiceBridgeAdapters = Record<
  string,
  import("../../../../core/src/types.ts").ServiceBridgeAdapter
>;
type ProjectSessionDeliveryAdapters = Record<
  string,
  import("../../../../core/src/types.ts").ProjectSessionDeliveryAdapter
>;

export interface WorkSurfaceProjectionObserverInput {
  projectId: string;
  snapshot: import("../../../../core/src/types.ts").WorkSurfaceProjectionSnapshot;
  snapshotPath: string;
  dataDir?: string;
}

export type WorkSurfaceProjectionObserver = (
  input: WorkSurfaceProjectionObserverInput,
) => Promise<unknown>;

interface PluginRuntimeContext {
  resolvedDataDir?: string;
  store: ReturnType<typeof createSessionProjectStore>;
  escalationStore: ReturnType<typeof createMainSessionEscalationStore>;
  businessNotificationDeliveryObserver: BusinessNotificationDeliveryObserver | null;
  taskBugWritebackObserver: TaskBugWritebackObserver | null;
  governanceDeliveryObserver: GovernanceDeliveryObserver | null;
  routerConfig: Awaited<ReturnType<typeof loadRouterConfig>>;
  runtimeBindings: Awaited<ReturnType<typeof loadRuntimeBindingsConfig>>;
  serviceRegistry: ReturnType<typeof createInternalServiceRegistry>;
  serviceBridgeRegistry: ReturnType<typeof createServiceBridgeRegistry>;
  deliveryRegistry: ReturnType<typeof createProjectSessionDeliveryRegistry>;
  workSurfaceProjectionObserver: WorkSurfaceProjectionObserver | null;
}

function createRuntimeContextLoader(input: {
  registryPath: string;
  dataDir?: string;
  routerConfigPath?: string;
  runtimeBindingsPath?: string;
  feishuConfigPath?: string;
  workflowBindingsPath?: string;
  serviceHandlers?: ServiceHandlers;
  serviceBridgeAdapters?: ServiceBridgeAdapters;
  projectSessionDeliveryAdapters?: ProjectSessionDeliveryAdapters;
  workSurfaceProjectionObserver?: WorkSurfaceProjectionObserver;
  businessNotificationDeliveryObserver?: BusinessNotificationDeliveryObserver;
  taskBugWritebackObserver?: TaskBugWritebackObserver;
  governanceDeliveryObserver?: GovernanceDeliveryObserver;
  api: PluginApiLike;
}): () => Promise<PluginRuntimeContext> {
  let runtimePromise: Promise<PluginRuntimeContext> | null = null;

  return () => {
    if (!runtimePromise) {
      runtimePromise = (async () => {
        const resolvedDataDir =
          input.dataDir ?? input.api.config?.dataDir ?? input.api.runtime?.state?.resolveStateDir?.();
        const store = createSessionProjectStore({ dataDir: resolvedDataDir });
        const escalationStore = createMainSessionEscalationStore({
          dataDir: resolvedDataDir,
        });
        const routerConfig = await loadRouterConfig(
          input.routerConfigPath ??
            input.api.pluginConfig?.routerConfigPath ??
            input.api.config?.routerConfigPath,
        );
        const runtimeBindings = await loadRuntimeBindingsConfig(
          input.runtimeBindingsPath ??
            input.api.pluginConfig?.runtimeBindingsPath ??
            input.api.config?.runtimeBindingsPath,
          process.env,
          resolvedDataDir ?? null,
        );
        const serviceRegistry = createInternalServiceRegistry(input.serviceHandlers);
        const serviceBridgeRegistry = createServiceBridgeRegistry({
          validation_fixture: createValidationFixtureServiceBridgeAdapter(),
          ...(input.serviceBridgeAdapters ?? {}),
        });
        const deliveryRegistry = createProjectSessionDeliveryRegistry(
          {
            openclaw_session: createOpenClawProjectSessionDeliveryAdapter(input.api.runtime),
            ...(input.projectSessionDeliveryAdapters ?? {}),
          },
        );
        const workSurfaceProjectionObserver = input.workSurfaceProjectionObserver
          ? async (observerInput: WorkSurfaceProjectionObserverInput) => {
              try {
                await input.workSurfaceProjectionObserver?.(observerInput);
              } catch (error) {
                debugLog(
                  input.api,
                  `work-surface projection observer failed projectId=${observerInput.projectId} reason=${error instanceof Error ? error.message : String(error)}`,
                );
              }
            }
          : null;
        const businessNotificationDeliveryHandler =
          input.businessNotificationDeliveryObserver ??
          buildDefaultBusinessNotificationDeliveryObserver({
            env: process.env,
            workflowBindingsPath:
              input.workflowBindingsPath ??
              input.api.pluginConfig?.workflowBindingsPath ??
              input.api.config?.workflowBindingsPath ??
              null,
          });
        const businessNotificationDeliveryObserver = businessNotificationDeliveryHandler
          ? async (observerInput: BusinessNotificationDeliveryObserverInput) => {
              try {
                await businessNotificationDeliveryHandler(observerInput);
              } catch (error) {
                debugLog(
                  input.api,
                  `business notification delivery observer failed notificationId=${observerInput.notification.notification_id} reason=${error instanceof Error ? error.message : String(error)}`,
                );
              }
            }
          : null;
        const taskBugWritebackHandler =
          input.taskBugWritebackObserver ??
          buildDefaultTaskBugWritebackObserver({
            feishuConfigPath:
              input.feishuConfigPath ??
              input.api.pluginConfig?.feishuConfigPath ??
              input.api.config?.feishuConfigPath ??
              null,
            env: process.env,
          });
        const taskBugWritebackObserver = taskBugWritebackHandler
          ? async (observerInput: TaskBugWritebackObserverInput) => {
              try {
                await taskBugWritebackHandler(observerInput);
              } catch (error) {
                debugLog(
                  input.api,
                  `task/bug writeback observer failed projectId=${observerInput.projectId} traceId=${observerInput.envelope.trace_id ?? "none"} reason=${error instanceof Error ? error.message : String(error)}`,
                );
              }
            }
          : null;
        const governanceDeliveryHandler =
          input.governanceDeliveryObserver ??
          buildDefaultGovernanceDeliveryObserver({
            feishuConfigPath:
              input.feishuConfigPath ??
              input.api.pluginConfig?.feishuConfigPath ??
              input.api.config?.feishuConfigPath ??
              null,
            runtime: input.api.runtime,
            runtimeBindings,
          });
        const governanceDeliveryObserver = governanceDeliveryHandler
          ? async (observerInput: GovernanceDeliveryObserverInput) => {
              try {
                await governanceDeliveryHandler(observerInput);
              } catch (error) {
                debugLog(
                  input.api,
                  `governance delivery observer failed escalationId=${observerInput.escalation.escalation_id} reason=${error instanceof Error ? error.message : String(error)}`,
                );
              }
            }
          : null;

        debugLog(
          input.api,
          `register complete commands=project hooks=before_dispatch,before_prompt_build,llm_output registryPath=${input.registryPath} dataDir=${resolvedDataDir ?? "default"}`,
        );

        return {
          resolvedDataDir,
          store,
          escalationStore,
          businessNotificationDeliveryObserver,
          taskBugWritebackObserver,
          governanceDeliveryObserver,
          routerConfig,
          runtimeBindings,
          serviceRegistry,
          serviceBridgeRegistry,
          deliveryRegistry,
          workSurfaceProjectionObserver,
        };
      })();
    }
    return runtimePromise;
  };
}

export function createAssistantContextRouterPlugin(input: {
  registryPath: string;
  dataDir?: string;
  routerConfigPath?: string;
  serviceHandlers?: ServiceHandlers;
  serviceBridgeAdapters?: ServiceBridgeAdapters;
  runtimeBindingsPath?: string;
  feishuConfigPath?: string;
  workflowBindingsPath?: string;
  projectSessionDeliveryAdapters?: ProjectSessionDeliveryAdapters;
  workSurfaceProjectionObserver?: WorkSurfaceProjectionObserver;
  businessNotificationDeliveryObserver?: BusinessNotificationDeliveryObserver;
  taskBugWritebackObserver?: TaskBugWritebackObserver;
  governanceDeliveryObserver?: GovernanceDeliveryObserver;
  workSurfaceSync?: ProjectWorkSurfaceSyncRunner;
  projectCatalogSync?: ProjectCatalogSyncRunner;
}) {
  return {
    id: "assistant-context-router",
    name: "Assistant Context Router",
    register(api: PluginApiLike) {
      debugLog(api, `register start registryPath=${input.registryPath}`);
      const loadRuntimeContext = createRuntimeContextLoader({
        ...input,
        api,
      });
      const workSurfaceSync =
        input.workSurfaceSync ??
        buildDefaultWorkSurfaceSyncRunner({
          feishuConfigPath:
            input.feishuConfigPath ??
            api.pluginConfig?.feishuConfigPath ??
            api.config?.feishuConfigPath ??
            null,
        });
      const projectCatalogSync =
        input.projectCatalogSync ??
        buildDefaultProjectCatalogSyncRunner({
          feishuConfigPath:
            input.feishuConfigPath ??
            api.pluginConfig?.feishuConfigPath ??
            api.config?.feishuConfigPath ??
            null,
        });

      api.registerCommand?.({
        name: "project",
        description: "Unified project command: switch focus, list projects, inspect lanes and notifications, save, and sync work surfaces",
        acceptsArgs: true,
        requireAuth: true,
        handler: async (ctx) => {
          try {
            const runtime = await loadRuntimeContext();
            const parsed = parseProjectCommandArgs(ctx.args);
            debugLog(
              api,
              `project command invoked action=${parsed.action} projectId=${parsed.projectId || "<empty>"} channel=${ctx.channel ?? ctx.channelId ?? "unknown"}`,
            );

            const rawSessionKey = resolveSessionKeyFromCommandContext(ctx);
            const mainSession = rawSessionKey
              ? resolveMainSessionBinding(rawSessionKey, runtime.runtimeBindings)
              : null;
            const sessionKey = mainSession?.canonical_session_key ?? rawSessionKey;

            if (parsed.action === "help") {
              return { text: renderProjectCommandHelp() };
            }

            if (parsed.action === "list") {
              const result = await handleProjectsCommand({
                registryPath: input.registryPath,
                query: parsed.projectId,
              });
              return { text: result.content };
            }

            if (parsed.action === "lane") {
              const result = await handleProjectLaneCommand({
                registryPath: input.registryPath,
                store: runtime.store,
                sessionKey,
                projectId: parsed.projectId,
                dataDir: runtime.resolvedDataDir,
              });
              return { text: result.content };
            }

            if (parsed.action === "notifications") {
              const result = await handleProjectNotificationsCommand({
                registryPath: input.registryPath,
                store: runtime.store,
                sessionKey,
                projectId: parsed.projectId,
                dataDir: runtime.resolvedDataDir,
              });
              return { text: result.content };
            }

            if (parsed.action === "governance") {
              const result = await handleProjectGovernanceCommand({
                registryPath: input.registryPath,
                store: runtime.store,
                sessionKey,
                projectId: parsed.projectId,
                dataDir: runtime.resolvedDataDir,
              });
              return { text: result.content };
            }

            if (parsed.action === "surface_sync") {
              const result = await handleProjectWorkSurfaceSyncCommand({
                registryPath: input.registryPath,
                store: runtime.store,
                sessionKey,
                projectId: parsed.projectId,
                dataDir: runtime.resolvedDataDir,
                apply: parsed.apply,
                sync: workSurfaceSync,
              });
              return { text: result.content };
            }

            if (parsed.action === "catalog_sync") {
              const result = await handleProjectCatalogSyncCommand({
                registryPath: input.registryPath,
                store: runtime.store,
                sessionKey,
                projectId: parsed.projectId,
                dataDir: runtime.resolvedDataDir,
                apply: parsed.apply,
                sync: projectCatalogSync,
              });
              return { text: result.content };
            }

            if (parsed.action === "save") {
              if (!sessionKey) {
                return { text: buildMissingSessionKeyMessage() };
              }
              const result = await handleSaveCommand({
                sessionKey,
                registryPath: input.registryPath,
                store: runtime.store,
                mode: parsed.saveMode,
              });
              return { text: result.content };
            }

            if (!parsed.projectId) {
              return { text: renderProjectCommandHelp() };
            }

            debugLog(
              api,
              `project command session resolution sessionKey=${sessionKey ?? "missing"}`,
            );
            if (!sessionKey) {
              return { text: buildMissingSessionKeyMessage(parsed.projectId) };
            }

            const result = await handleProjectCommand({
              registryPath: input.registryPath,
              store: runtime.store,
              sessionKey,
              projectId: parsed.projectId,
              mainSessionBinding: mainSession?.binding ?? null,
            });
            return { text: result.content };
          } catch (error) {
            return { text: formatCommandError(error) };
          }
        },
      });

      api.on?.(
        "before_dispatch",
        async (event, ctx) => {
          const runtime = await loadRuntimeContext();
          const text = resolveMessageText(event, ctx);
          const rawSessionKey = resolveSessionKeyFromEvent(event, ctx);
          const mainSession = rawSessionKey
            ? resolveMainSessionBinding(rawSessionKey, runtime.runtimeBindings)
            : null;
          const sessionKey = mainSession?.canonical_session_key ?? rawSessionKey;
          debugLog(
            api,
            `before_dispatch text=${JSON.stringify(text.slice(0, 120))} sessionKey=${sessionKey ?? "missing"}`,
          );
          let response: { text: string } | null;
          try {
            response = await handleSlashLikeInput({
              text,
              sessionKey,
              registryPath: input.registryPath,
              store: runtime.store,
              dataDir: runtime.resolvedDataDir,
              workSurfaceSync,
              projectCatalogSync,
            });
          } catch (error) {
            debugLog(
              api,
              `before_dispatch slash-like error=${JSON.stringify(formatCommandError(error))}`,
            );
            return {
              handled: true,
              text: formatCommandError(error),
            };
          }
          if (!response) {
            const structuredMessage = parseStructuredAutomationMessage({
              text,
              event,
              ctx,
            });
            if (structuredMessage.matched && structuredMessage.error) {
              debugLog(
                api,
                `before_dispatch structured automation parse failed source=${structuredMessage.match_source ?? "unknown"} reason=${structuredMessage.error}`,
              );
              return {
                handled: true,
                text: buildAutomationProtocolErrorMessage(structuredMessage.error),
              };
            }

            const ingressEvent =
              structuredMessage.matched && structuredMessage.event
                ? structuredMessage.event
                : event;
            if (structuredMessage.matched) {
              debugLog(
                api,
                `before_dispatch structured automation message recognized source=${structuredMessage.match_source ?? "unknown"}`,
              );
            }

            const envelope = normalizeIngressEvent({ event: ingressEvent, ctx });
            if (envelope?.source_type === "automation") {
              const projectLookupId = envelope.resolved_project_id ?? envelope.project_ref;
              const resolvedProjectEntry = projectLookupId
                ? await getProjectById(input.registryPath, projectLookupId)
                : null;
              const routingEnvelope = resolvedProjectEntry
                ? {
                    ...envelope,
                    resolved_project_id: resolvedProjectEntry.project_id,
                  }
                : {
                    ...envelope,
                    resolved_project_id: null,
                  };
              const sessionState = sessionKey ? await runtime.store.get(sessionKey) : null;
              const decision = decideRoute({
                envelope: routingEnvelope,
                sessionKey,
                sessionState,
                availableServiceActions: new Set(
                  Object.keys(input.serviceHandlers ?? {}),
                ),
                actionConfig: null,
              });

              const projectIdForConfig =
                decision.resolved_project_id !== "unresolved"
                  ? decision.resolved_project_id
                  : resolvedProjectEntry?.project_id ?? null;
              const projectEntry =
                projectIdForConfig && resolvedProjectEntry?.project_id === projectIdForConfig
                  ? resolvedProjectEntry
                  : projectIdForConfig
                    ? await getProjectById(input.registryPath, projectIdForConfig)
                    : null;
              const projectRouterConfig = projectEntry
                ? await loadProjectRouterConfig(projectEntry)
                : {};
              const effectiveRouterConfig = mergeRouterConfigs(
                runtime.routerConfig,
                projectRouterConfig,
              );
              const finalDecision = decideRoute({
                envelope: routingEnvelope,
                sessionKey,
                sessionState,
                availableServiceActions:
                  envelope.action_name &&
                  (
                    runtime.serviceRegistry.has(envelope.action_name, projectIdForConfig) ||
                    (!!effectiveRouterConfig.service_binding &&
                      effectiveRouterConfig.actions?.[envelope.action_name]?.target_kind === "service")
                  )
                    ? new Set([envelope.action_name])
                    : new Set<string>(),
                actionConfig: envelope.action_name
                  ? (effectiveRouterConfig.actions?.[envelope.action_name] ?? null)
                  : null,
              });

              if (sessionKey) {
                await runtime.store.set(sessionKey, {
                  current_workflow: finalDecision.workflow ?? sessionState?.current_workflow ?? null,
                  last_route_trace: createRouteTraceFromDecision(finalDecision, {
                    traceId: envelope.trace_id,
                    sourceType: envelope.source_type,
                    channelType: envelope.channel_type,
                    mainSessionBindingId: mainSession?.binding?.binding_id ?? null,
                  }),
                });
              }

              if (finalDecision.target_kind === "safe_fail") {
                debugLog(api, `before_dispatch automation safe-fail reason=${finalDecision.safe_fail_reason ?? "unknown"}`);
                return {
                  handled: true,
                  text: buildAutomationSafeFailMessage(
                    finalDecision.safe_fail_reason ?? finalDecision.route_reason,
                  ),
                };
              }

              if (finalDecision.target_kind === "project_session") {
                const projectId =
                  finalDecision.resolved_project_id === "unresolved"
                    ? null
                    : finalDecision.resolved_project_id;
                if (projectId) {
                  const deliveryResult = effectiveRouterConfig.project_session_binding
                    ? await runtime.deliveryRegistry.deliver({
                        project_id: projectId,
                        binding: effectiveRouterConfig.project_session_binding,
                        envelope: routingEnvelope,
                        route_decision: finalDecision,
                        reply_target: routingEnvelope.reply_target,
                      })
                    : {
                        status: "unresolved_binding" as const,
                        runtime_target_id: null,
                        fallback_used: true,
                        error_reason: "missing_project_session_binding",
                        trace_patch: null,
                      };
                  const lanePath = await appendProjectSessionEvent({
                    projectId,
                    decision: finalDecision,
                    envelope: routingEnvelope,
                    dataDir: runtime.resolvedDataDir,
                    deliveryResult,
                  });
                  if (sessionKey) {
                    await runtime.store.set(sessionKey, {
                      last_route_trace: createRouteTraceFromDecision(finalDecision, {
                        traceId: envelope.trace_id,
                        sourceType: envelope.source_type,
                        channelType: envelope.channel_type,
                        mainSessionBindingId: mainSession?.binding?.binding_id ?? null,
                        projectSessionRuntimeKind:
                          effectiveRouterConfig.project_session_binding?.runtime_kind ?? null,
                        projectSessionDeliveryStatus: deliveryResult.status,
                        projectSessionRuntimeTargetId: deliveryResult.runtime_target_id,
                        fallbackUsed: deliveryResult.fallback_used,
                      }),
                    });
                  }
                  await recordSignalPromotion({
                    runtime,
                    projectId,
                    canonicalSessionKey: sessionKey,
                    decision: finalDecision,
                    envelope: routingEnvelope,
                    deliveryResult,
                  });
                  debugLog(
                    api,
                    `before_dispatch automation routed to project session lane path=${lanePath} delivery=${deliveryResult.status}`,
                  );
                }
                return { handled: true };
              }

              if (finalDecision.target_kind === "service" && envelope.action_name) {
                const serviceRequest = {
                  action_name: envelope.action_name,
                  resolved_project_id:
                    finalDecision.resolved_project_id === "unresolved"
                      ? ""
                      : finalDecision.resolved_project_id,
                  workflow: finalDecision.workflow,
                  parameters: envelope.parameters,
                  trace_id: envelope.trace_id,
                  reply_target: envelope.reply_target,
                };
                const hasDirectHandler = runtime.serviceRegistry.has(
                  envelope.action_name,
                  projectIdForConfig,
                );
                const serviceResult = hasDirectHandler
                  ? await runtime.serviceRegistry.execute(envelope.action_name, serviceRequest)
                  : effectiveRouterConfig.service_binding
                    ? await runtime.serviceBridgeRegistry.execute({
                        binding: effectiveRouterConfig.service_binding,
                        request: serviceRequest,
                      })
                    : await runtime.serviceRegistry.execute(envelope.action_name, serviceRequest);

                const projectId =
                  finalDecision.resolved_project_id === "unresolved"
                    ? null
                    : finalDecision.resolved_project_id;
                if (projectId) {
                  const lanePath = await appendProjectSessionEvent({
                    projectId,
                    decision: finalDecision,
                    envelope: routingEnvelope,
                    dataDir: runtime.resolvedDataDir,
                    serviceResult,
                  });
                  await runtime.taskBugWritebackObserver?.({
                    projectId,
                    envelope: routingEnvelope,
                    serviceResult,
                    routerConfig: effectiveRouterConfig,
                    dataDir: runtime.resolvedDataDir,
                  });
                  await recordSignalPromotion({
                    runtime,
                    projectId,
                    canonicalSessionKey: sessionKey,
                    decision: finalDecision,
                    envelope: routingEnvelope,
                    serviceResult,
                  });
                  debugLog(api, `before_dispatch service result logged to project session lane path=${lanePath}`);
                }

                if (serviceResult.needs_escalation) {
                  return { handled: true };
                }

                if (
                  serviceResult.reply_payload &&
                  envelope.reply_target?.target_kind === "channel" &&
                  envelope.reply_target.reply_mode === "direct"
                ) {
                  return {
                    handled: true,
                    text: serviceResult.reply_payload,
                  };
                }

                return { handled: true };
              }
            }
            debugLog(api, "before_dispatch no slash-like match");
            return {};
          }
          debugLog(api, `before_dispatch handled slash-like input sessionKey=${sessionKey ?? "missing"}`);
          return {
            handled: true,
            text: response.text,
          };
        },
        { priority: 50 },
      );

      api.on?.(
        "llm_output",
        async (event, ctx) => {
          const runtime = await loadRuntimeContext();
          const rawSessionKey =
            ctx && typeof ctx === "object" && typeof (ctx as { sessionKey?: string }).sessionKey === "string"
              ? (ctx as { sessionKey?: string }).sessionKey ?? null
              : null;
          const sessionKey = rawSessionKey
            ? resolveMainSessionBinding(rawSessionKey, runtime.runtimeBindings).canonical_session_key
            : undefined;
          await createSaveModeLlmOutputHook({ store: runtime.store })(event, { sessionKey });
          return {};
        },
        { priority: 10 },
      );

      api.on?.(
        "before_prompt_build",
        async (event, ctx) => {
            const runtime = await loadRuntimeContext();
            const result = await createBeforePromptBuildHook({
              registryPath: input.registryPath,
              store: runtime.store,
              escalationStore: runtime.escalationStore,
              dataDir: runtime.resolvedDataDir,
              runtimeBindings: runtime.runtimeBindings,
            })(event, ctx);
            debugLog(
              api,
              `before_prompt_build result=${result.prependSystemContext ? "prependSystemContext" : "empty"}`,
            );
            return result;
        },
        { priority: 10 },
      );
    },
  };
}

const plugin = {
  id: "assistant-context-router",
  name: "Assistant Context Router",
  register(api: PluginApiLike) {
    const registryPath =
      api.pluginConfig?.registryPath ??
      api.config?.registryPath ??
      resolveDefaultRegistryPath();
    const runtimePlugin = createAssistantContextRouterPlugin({
      registryPath,
      dataDir: api.pluginConfig?.dataDir ?? api.config?.dataDir,
      routerConfigPath: api.pluginConfig?.routerConfigPath ?? api.config?.routerConfigPath,
      runtimeBindingsPath: api.pluginConfig?.runtimeBindingsPath ?? api.config?.runtimeBindingsPath,
      feishuConfigPath: api.pluginConfig?.feishuConfigPath ?? api.config?.feishuConfigPath,
    });
    runtimePlugin.register(api);
  },
};

export default plugin;
