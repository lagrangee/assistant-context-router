export type SelectedVia = "manual" | "anchor" | "binding" | "route";

export type RouteSource =
  | "manual"
  | "anchor"
  | "binding"
  | "automation"
  | "protocol"
  | "unresolved";

export type WorkflowFamily = "general" | "dispatch" | "review";
export type ServiceResultKind = "accepted" | "queued" | "rejected" | "needs_escalation";
export type WorkSurfaceActionName =
  | "dispatch"
  | "review"
  | "review_request"
  | "review_resolution"
  | "complete"
  | "blocked";

export type SourceType = "human" | "agent" | "automation";

export type TargetKind = "main_session" | "project_session" | "service" | "safe_fail";

export type ReplyTargetKind = "channel" | "main_session" | "project_session" | "silent_log";

export type ReplyVisibility = "human_facing" | "system_facing";

export type ReplyMode = "direct" | "escalate" | "silent_log";

export type ChannelType = "tui" | "wechat" | "feishu" | "discord" | "unknown";

export type ProjectSessionDeliveryStatus =
  | "delivered"
  | "queued"
  | "failed"
  | "unresolved_binding";

export interface ArtifactRef {
  kind: string;
  label: string | null;
  target: string;
}

export interface ProjectRegistryEntry {
  project_id: string;
  title?: string;
  type?: string;
  status?: string;
  owner?: string;
  cadence?: string;
  file: string;
  absolute_file_path: string;
  project_root: string;
}

export interface ProjectDefinition {
  project_id?: string;
  title?: string;
  kind?: string;
  type?: string;
  owner?: string;
  status?: string;
  objective?: string;
  constraints?: Record<string, unknown> | string[] | string;
  next_action?: string;
  principles?: string[];
  acceptance_criteria?: string[];
  primary_docs?: string[];
  [key: string]: unknown;
}

export interface RouteTrace {
  trace_id: string | null;
  timestamp: string;
  source_type: SourceType | null;
  channel_type: ChannelType | null;
  project_ref: string | null;
  resolved_project_id: string | "unresolved";
  route_source: RouteSource;
  workflow: WorkflowFamily | null;
  target_kind: TargetKind | null;
  target_id: string | null;
  route_evidence: string[];
  main_session_binding_id?: string | null;
  project_session_runtime_kind?: string | null;
  project_session_delivery_status?: ProjectSessionDeliveryStatus | null;
  project_session_runtime_target_id?: string | null;
  fallback_used?: boolean;
  escalation_reason: string | null;
  safe_fail: boolean;
  safe_fail_reason: string | null;
  reason: string;
}

export interface MainSessionBinding {
  binding_id: string;
  runtime_kind: string;
  canonical_session_key: string;
  aliases: string[];
  metadata?: Record<string, unknown> | null;
}

export interface RuntimeChannelTargetBinding {
  binding_id: string;
  channel_type: string;
  target_kind: string;
  target_ref: string;
  delivery_mode: string;
  aliases: string[];
  runtime_channel_id?: string | null;
  account_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface MainSessionResolution {
  binding: MainSessionBinding | null;
  canonical_session_key: string;
  alias_matched: string | null;
}

export interface ReplyTarget {
  target_kind: ReplyTargetKind;
  target_id: string | null;
  visibility: ReplyVisibility;
  reply_mode: ReplyMode;
}

export interface NormalizedEnvelope {
  source_type: SourceType;
  channel_type: ChannelType;
  project_ref: string | null;
  resolved_project_id: string | null;
  action_name: string | null;
  parameters: Record<string, unknown> | null;
  reply_target: ReplyTarget | null;
  trace_id: string | null;
  workflow: WorkflowFamily | null;
  raw_message_ref: string | null;
  text: string | null;
}

export interface RouteDecision {
  target_kind: TargetKind;
  target_id: string | null;
  resolved_project_id: string | "unresolved";
  project_ref: string | null;
  route_source: RouteSource;
  route_reason: string;
  route_evidence: string[];
  workflow: WorkflowFamily | null;
  fallback_to_main_session: boolean;
  escalation_reason: string | null;
  safe_fail_reason: string | null;
}

export interface ServiceResult {
  status: "ok" | "error" | "needs_escalation";
  result_kind?: ServiceResultKind | null;
  work_surface_action?: WorkSurfaceActionName | null;
  summary?: string | null;
  reply_payload: string | null;
  needs_escalation: boolean;
  escalation_reason: string | null;
  run_id?: string | null;
  queue_ref?: string | null;
  artifact_ref?: ArtifactRef | null;
  trace_patch?: Record<string, unknown> | null;
}

export interface InternalServiceRequest {
  action_name: string;
  resolved_project_id: string;
  workflow: WorkflowFamily | null;
  parameters: Record<string, unknown> | null;
  trace_id: string | null;
  reply_target: ReplyTarget | null;
}

export type InternalServiceHandler = (
  request: InternalServiceRequest,
) => Promise<ServiceResult>;

export interface ProjectSessionBinding {
  runtime_kind: string;
  target_ref: string;
  metadata?: Record<string, unknown> | null;
}

export interface ServiceBinding {
  runtime_kind: string;
  target_ref: string;
  metadata?: Record<string, unknown> | null;
}

export interface ProjectSessionDeliveryRequest {
  project_id: string;
  binding: ProjectSessionBinding;
  envelope: NormalizedEnvelope;
  route_decision: RouteDecision;
  reply_target: ReplyTarget | null;
}

export interface ProjectSessionDeliveryResult {
  status: ProjectSessionDeliveryStatus;
  runtime_target_id: string | null;
  fallback_used: boolean;
  error_reason: string | null;
  trace_patch?: Record<string, unknown> | null;
}

export type ProjectSessionDeliveryAdapter = (
  request: ProjectSessionDeliveryRequest,
) => Promise<ProjectSessionDeliveryResult>;

export interface ServiceBridgeRequest {
  binding: ServiceBinding;
  request: InternalServiceRequest;
}

export type ServiceBridgeAdapter = (
  request: ServiceBridgeRequest,
) => Promise<ServiceResult>;

export interface ActionRouteConfig {
  target_kind?: "service" | "project_session";
  workflow?: WorkflowFamily | null;
  requires_resolved_project?: boolean;
}

export type TaskBugAcceptanceMode = "manual_acceptance" | "agent_can_finalize";

export type TaskBugCompletionNotifyMode =
  | "dm_on_completion_boundary"
  | "no_dm_on_completion_boundary";

export type TaskBugStartMode =
  | "manual_only"
  | "dispatch_on_create"
  | "agent_may_claim";

export interface TaskBugPolicyDefaults {
  acceptance_mode?: TaskBugAcceptanceMode | null;
  completion_notify_mode?: TaskBugCompletionNotifyMode | null;
  start_mode?: TaskBugStartMode | null;
}

export interface TaskBugPolicyConfig {
  defaults?: TaskBugPolicyDefaults | null;
}

export interface RouterConfig {
  actions?: Record<string, ActionRouteConfig>;
  service_binding?: ServiceBinding | null;
  project_session_binding?: ProjectSessionBinding | null;
  task_bug_policy?: TaskBugPolicyConfig | null;
}

export interface RuntimeBindingsConfig {
  main_sessions?: MainSessionBinding[];
  channel_targets?: RuntimeChannelTargetBinding[];
}

export interface WorkflowSurfaceReplyTargetBinding {
  channel_type: ChannelType;
  target_kind: ReplyTargetKind;
  target_id: string;
  visibility: ReplyVisibility;
  reply_mode: ReplyMode;
}

export interface WorkflowSurfaceBindingConfig {
  default_reply_target?: WorkflowSurfaceReplyTargetBinding | null;
}

export interface WorkflowBindingsConfig {
  general?: WorkflowSurfaceBindingConfig | null;
  dispatch?: WorkflowSurfaceBindingConfig | null;
  review?: WorkflowSurfaceBindingConfig | null;
}

export type ProjectSessionSignalKind =
  | "none"
  | "blocked"
  | "review_request"
  | "high_signal_completion"
  | "service_error";

export type WorkSurfaceStatus =
  | "none"
  | "blocked"
  | "in_review"
  | "completed"
  | "failed";

export interface SignalPromotionDecision {
  signal_kind: ProjectSessionSignalKind;
  business_notification: boolean;
  main_session_escalation: boolean;
  collab_promotion: "none" | "persistent_only";
  reason: string;
}

export type SignalPromotionSource =
  | "route_decision"
  | "service_result"
  | "delivery_result";

export interface BusinessNotificationRecord {
  notification_id: string;
  created_at: string;
  project_id: string;
  signal_kind: ProjectSessionSignalKind;
  source: SignalPromotionSource;
  trace_id: string | null;
  action_name: string | null;
  workflow: WorkflowFamily | null;
  reason: string;
  summary: string | null;
  run_id: string | null;
  queue_ref: string | null;
  artifact_ref: ArtifactRef | null;
  status: "recorded";
}

export type BusinessNotificationDeliveryStatus =
  | "record_only"
  | "pending"
  | "delivered"
  | "queued"
  | "failed";

export interface BusinessNotificationDeliveryRecord {
  delivery_id: string;
  created_at: string;
  updated_at: string;
  notification_id: string;
  project_id: string;
  signal_kind: ProjectSessionSignalKind;
  trace_id: string | null;
  action_name: string | null;
  workflow: WorkflowFamily | null;
  reason: string;
  summary: string | null;
  artifact_ref: ArtifactRef | null;
  channel_type: string | null;
  target_kind: string | null;
  target_ref: string | null;
  delivery_mode: string | null;
  rendered_message: string;
  status: BusinessNotificationDeliveryStatus;
  runtime_target_id: string | null;
  error_reason: string | null;
  trace_patch: Record<string, unknown> | null;
}

export type MainSessionEscalationStatus = "open" | "acknowledged" | "resolved";

export interface MainSessionEscalationRecord {
  escalation_id: string;
  created_at: string;
  updated_at: string;
  canonical_session_key: string;
  project_id: string;
  signal_kind: ProjectSessionSignalKind;
  source: SignalPromotionSource;
  target: "main_session";
  status: MainSessionEscalationStatus;
  reason: string;
  summary: string | null;
  trace_id: string | null;
  action_name: string | null;
  workflow: WorkflowFamily | null;
  run_id: string | null;
  queue_ref: string | null;
  artifact_ref: ArtifactRef | null;
  resolution: string | null;
}

export type GovernanceDeliveryStatus = "pending" | "delivered" | "queued" | "failed";

export interface GovernanceDeliveryRecord {
  delivery_id: string;
  created_at: string;
  updated_at: string;
  escalation_id: string;
  canonical_session_key: string;
  project_id: string;
  signal_kind: ProjectSessionSignalKind;
  trace_id: string | null;
  action_name: string | null;
  workflow: WorkflowFamily | null;
  reason: string;
  summary: string | null;
  artifact_ref: ArtifactRef | null;
  channel_type: string;
  target_kind: string;
  target_ref: string;
  delivery_mode: string;
  rendered_message: string;
  status: GovernanceDeliveryStatus;
  runtime_target_id: string | null;
  error_reason: string | null;
  trace_patch: Record<string, unknown> | null;
}

export interface ProjectSessionEvent {
  recorded_at: string;
  project_id: string;
  signal_kind: ProjectSessionSignalKind;
  decision: {
    target_kind: TargetKind;
    target_id: string | null;
    route_reason: string;
    route_evidence: string[];
    workflow: WorkflowFamily | null;
    route_source: RouteSource;
    escalation_reason: string | null;
    safe_fail_reason: string | null;
  };
  envelope: {
    source_type: SourceType;
    channel_type: ChannelType;
    project_ref: string | null;
    resolved_project_id: string | null;
    action_name: string | null;
    parameters: Record<string, unknown> | null;
    trace_id: string | null;
    workflow: WorkflowFamily | null;
    raw_message_ref: string | null;
    text: string | null;
  };
  service_result: {
    status: ServiceResult["status"];
    result_kind: ServiceResultKind | null;
    work_surface_action: WorkSurfaceActionName | null;
    summary: string | null;
    reply_payload: string | null;
    needs_escalation: boolean;
    escalation_reason: string | null;
    run_id: string | null;
    queue_ref: string | null;
    artifact_ref: ArtifactRef | null;
    trace_patch: Record<string, unknown> | null;
  } | null;
  delivery_result: {
    status: ProjectSessionDeliveryStatus;
    runtime_target_id: string | null;
    fallback_used: boolean;
    error_reason: string | null;
    trace_patch: Record<string, unknown> | null;
  } | null;
}

export interface ProjectSessionSummary {
  project_id: string;
  total_events: number;
  blocked_count: number;
  review_request_count: number;
  high_signal_completion_count: number;
  service_error_count: number;
  latest_signal: ProjectSessionSignalKind;
  latest_event_at: string | null;
  notable_events: ProjectSessionEvent[];
}

export interface WorkSurfaceProjectionSnapshot {
  project_id: string;
  updated_at: string;
  signal_kind: ProjectSessionSignalKind;
  surface_status: WorkSurfaceStatus;
  headline: string;
  summary: string | null;
  trace_id: string | null;
  action_name: string | null;
  workflow: WorkflowFamily | null;
  run_id: string | null;
  queue_ref: string | null;
  artifact_ref: ArtifactRef | null;
}

export interface PendingSaveDraft {
  created_at: string;
  project_id: string;
  updated_files: string[];
  host_targets?: Array<{
    doc_key: "README.md" | "STATUS.md" | "RESUME.md" | "COLLAB.md";
    path: string;
    purpose: "identity" | "current_state" | "working_state" | "collaboration";
    included_in_apply: boolean;
  }>;
  resume_draft: string;
  status_draft: string | null;
  summary_for_chat: string;
  source_notes?: string[];
}

export interface PendingSaveMode {
  created_at: string;
  project_id: string;
  debug_dry_run?: boolean;
}

export interface PendingSemanticExecution {
  created_at: string;
  project_id: string;
  action_name: string;
  workflow: WorkflowFamily | null;
  trace_id: string | null;
  task_record_id: string | null;
  bug_record_id: string | null;
  adapter_facts?: Record<string, unknown>;
  execution_contexts?: PendingSemanticExecutionContext[];
}

export interface PendingSemanticExecutionContext {
  kind: string;
  record_id: string;
  status: string | null;
  headline: string | null;
  project: string | null;
  priority: string | null;
  assignee: string | null;
  acceptance_mode: string | null;
  completion_notify_mode: string | null;
  next_action: string | null;
  business_fields: Record<string, string | null>;
  work_surface_origin?: WorkSurfaceOrigin | null;
}

export interface WorkSurfaceOrigin {
  source_system: string;
  surface_kind: string | null;
  adapter: string | null;
  identity: string | null;
  config_path: string | null;
  base_ref: string | null;
  table_id: string | null;
  table_name: string | null;
  record_id: string | null;
}

export interface CurrentProjectBinding {
  project_id: string;
  selected_at: string;
  selected_via: SelectedVia;
  current_workflow: WorkflowFamily | null;
  updated_at: string;
}

export interface SessionProjectState {
  current_project_id: string | null;
  selected_at: string;
  selected_via: SelectedVia;
  current_workflow: WorkflowFamily | null;
  updated_at: string;
  expires_at: string;
  last_route_trace: RouteTrace | null;
  pending_save_mode: PendingSaveMode | null;
  pending_save_draft: PendingSaveDraft | null;
  pending_semantic_execution: PendingSemanticExecution | null;
}

export interface SessionProjectStatePatch {
  current_project_id?: string | null;
  selected_at?: string;
  selected_via?: SelectedVia;
  current_workflow?: WorkflowFamily | null;
  updated_at?: string;
  expires_at?: string;
  last_route_trace?: RouteTrace | null;
  pending_save_mode?: PendingSaveMode | null;
  pending_save_draft?: PendingSaveDraft | null;
  pending_semantic_execution?: PendingSemanticExecution | null;
}

export interface ProjectContextPayload {
  projectId: string;
  title?: string;
  sections: Array<{
    label: string;
    text: string;
    chars: number;
  }>;
  totalChars: number;
  rendered: string;
}

export interface ProjectsCommandResult {
  content: string;
  count: number;
}

export interface ProjectLaneCommandResult {
  content: string;
}

export interface ProjectWorkSurfaceSyncCommandResult {
  content: string;
}

export interface ProjectGovernanceCommandResult {
  content: string;
}

export interface ProjectCatalogSyncCommandResult {
  content: string;
}

export interface ProjectNotificationsCommandResult {
  content: string;
}

export interface ProjectSwitchResult {
  content: string;
  entry: ProjectRegistryEntry;
  state: SessionProjectState;
}

export interface SaveCommandResult {
  content: string;
  updatedFiles: string[];
  dryRun?: boolean;
  needsConfirmation?: boolean;
}

export interface PromptBuildLikePayload {
  sessionKey?: string;
  messages?: unknown[];
  session?: {
    key?: string;
    sessionKey?: string;
  };
  systemPrompt?: string;
  contextSections?: Array<Record<string, unknown>>;
  projectContextBlock?: string;
  [key: string]: unknown;
}

export interface CommandContextLike {
  senderId?: string;
  channel?: string;
  channelId?: string;
  isAuthorizedSender?: boolean;
  args?: string;
  commandBody?: string;
  config?: unknown;
  logger?: {
    debug?: (message: string) => void;
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string) => void;
  };
  sessionKey?: string;
  session?: {
    key?: string;
    sessionKey?: string;
  };
  [key: string]: unknown;
}

export interface BeforePromptBuildEventLike {
  sessionKey?: string;
  session?: {
    key?: string;
    sessionKey?: string;
  };
  messages?: unknown[];
  systemPrompt?: string;
  [key: string]: unknown;
}

export interface BeforePromptBuildResult {
  prependSystemContext?: string;
}

export interface LlmOutputEventLike {
  runId?: string;
  sessionId?: string;
  provider?: string;
  model?: string;
  assistantTexts?: string[];
}
