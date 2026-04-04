export type SelectedVia = "manual" | "anchor" | "binding" | "route";

export type RouteSource =
  | "manual"
  | "anchor"
  | "binding"
  | "protocol"
  | "unresolved";

export type WorkflowFamily = "dispatch" | "review";

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
  timestamp: string;
  resolved_project_id: string | "unresolved";
  route_source: RouteSource;
  workflow: WorkflowFamily | null;
  safe_fail: boolean;
  reason: string;
}

export interface SessionProjectState {
  current_project_id: string | null;
  selected_at: string;
  selected_via: SelectedVia;
  current_workflow: WorkflowFamily | null;
  updated_at: string;
  expires_at: string;
  last_route_trace: RouteTrace | null;
}

export interface SessionProjectStatePatch {
  current_project_id?: string | null;
  selected_at?: string;
  selected_via?: SelectedVia;
  current_workflow?: WorkflowFamily | null;
  updated_at?: string;
  expires_at?: string;
  last_route_trace?: RouteTrace | null;
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

export interface ProjectSwitchResult {
  content: string;
  entry: ProjectRegistryEntry;
  state: SessionProjectState;
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
