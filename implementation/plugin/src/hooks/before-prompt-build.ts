import { getProjectById } from "../projects/registry.ts";
import { createSafeFailTrace } from "../trace/route-trace.ts";
import type { SessionProjectStore } from "../state/session-project-store.ts";
import type {
  BeforePromptBuildEventLike,
  BeforePromptBuildResult,
  PromptBuildLikePayload,
} from "../types.ts";
import { loadProjectContext } from "../context/project-context-loader.ts";

function resolveSessionKey(payload: PromptBuildLikePayload): string | null {
  return payload.sessionKey ?? payload.session?.sessionKey ?? payload.session?.key ?? null;
}

function buildContextBlock(renderedContext: string): string {
  return [
    "Assistant Context Router project context:",
    renderedContext,
    "Use this project context as the primary working boundary for the current session.",
  ].join("\n\n");
}

export function createBeforePromptBuildHook(input: {
  registryPath: string;
  store: SessionProjectStore;
}) {
  return async function beforePromptBuild(
    event: BeforePromptBuildEventLike,
    _ctx?: unknown,
  ): Promise<BeforePromptBuildResult> {
    const sessionKey = resolveSessionKey(event as PromptBuildLikePayload);
    if (!sessionKey) {
      return {};
    }

    const sessionState = await input.store.get(sessionKey);
    if (!sessionState?.current_project_id) {
      return {};
    }

    const entry = await getProjectById(input.registryPath, sessionState.current_project_id);
    if (!entry) {
      await input.store.invalidate(sessionKey, {
        last_route_trace: createSafeFailTrace(
          `Current project ${sessionState.current_project_id} could not be resolved`,
        ),
      });
      return {
        prependSystemContext:
          "Assistant Context Router note: previous project binding was invalidated because its project entry could not be resolved. Continue without project-bound context unless the user reselects a project.",
      };
    }

    const context = await loadProjectContext({ entry });
    if (!context.rendered) {
      await input.store.invalidate(sessionKey, {
        last_route_trace: createSafeFailTrace(
          `Project context for ${sessionState.current_project_id} could not be loaded`,
        ),
      });
      return {
        prependSystemContext:
          "Assistant Context Router note: previous project binding was invalidated because its context could not be loaded. Continue without project-bound context unless the user reselects a project.",
      };
    }

    return {
      prependSystemContext: buildContextBlock(context.rendered),
    };
  };
}
