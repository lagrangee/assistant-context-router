import assert from "node:assert/strict";

import { createAssistantContextRouterPlugin } from "../../adapters/openclaw/plugin/src/index.ts";

export type OpenClawTestHandler = (
  event: Record<string, unknown>,
  ctx?: unknown,
) => Promise<Record<string, unknown>>;

type PluginInput = Parameters<typeof createAssistantContextRouterPlugin>[0];
type HandlerName = "before_dispatch" | "before_prompt_build" | "llm_output";

export async function registerOpenClawTestPlugin(
  input: PluginInput,
  api: Record<string, unknown> = {},
) {
  const plugin = createAssistantContextRouterPlugin(input);
  const commands: string[] = [];
  const commandHandlers = new Map<
    string,
    (ctx: Record<string, unknown>) => Promise<{ text: string }>
  >();
  const hooks: string[] = [];
  const handlers = new Map<string, OpenClawTestHandler>();
  const registerCommand = (api as {
    registerCommand?: (command: { name: string }) => void;
  }).registerCommand;
  const on = (api as {
    on?: (eventName: string, handler: OpenClawTestHandler) => void;
  }).on;

  await plugin.register({
    ...api,
    registerCommand(command) {
      commands.push(command.name);
      commandHandlers.set(
        command.name,
        command.handler as (ctx: Record<string, unknown>) => Promise<{ text: string }>,
      );
      registerCommand?.(command);
    },
    on(eventName, handler) {
      hooks.push(eventName);
      handlers.set(eventName, handler);
      on?.(eventName, handler);
    },
  });

  function requireHandler(name: HandlerName): OpenClawTestHandler {
    const handler = handlers.get(name);
    assert.ok(handler, `missing ${name} test handler`);
    return handler;
  }

  return {
    plugin,
    commands,
    commandHandlers,
    hooks,
    handlers,
    beforeDispatch: requireHandler("before_dispatch"),
    beforePromptBuild: requireHandler("before_prompt_build"),
    llmOutput: requireHandler("llm_output"),
  };
}
