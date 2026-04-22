import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { parseSimpleYaml } from "../../../../core/src/lib/simple-yaml.ts";
import {
  findSessionKeysForProject,
  parseValidateOpenClawCliArgs,
  patchOpenClawConfigForValidation,
  renderValidateOpenClawCliUsage,
  sessionProjectStorePath,
} from "../src/validation/openclaw-cli-harness.ts";

const execFileAsync = promisify(execFile);

interface ExecResult {
  ok: boolean;
  code: number;
  stdout: string;
  stderr: string;
}

interface HarnessPaths {
  repoRoot: string;
  pluginRoot: string;
  registryPath: string;
  defaultProjectRef: string;
}

function cap(value: string, limit = 4000): string {
  if (value.length <= limit) {
    return value;
  }
  return value.slice(value.length - limit);
}

async function execOpenClaw(
  cliBin: string,
  args: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    allowFailure?: boolean;
  },
): Promise<ExecResult> {
  try {
    const result = await execFileAsync(cliBin, args, {
      cwd: options.cwd,
      env: options.env,
      timeout: options.timeoutMs ?? 30_000,
      maxBuffer: 10 * 1024 * 1024,
      encoding: "utf8",
    });
    return {
      ok: true,
      code: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    const failure = {
      ok: false,
      code:
        typeof (error as { code?: number | string }).code === "number"
          ? ((error as { code: number }).code)
          : 1,
      stdout: String((error as { stdout?: string }).stdout ?? ""),
      stderr: String((error as { stderr?: string }).stderr ?? (error instanceof Error ? error.message : error)),
    };

    if (!options.allowFailure) {
      throw new Error(
        [
          `${cliBin} ${args.join(" ")} failed with code ${failure.code}`,
          failure.stderr.trim() || failure.stdout.trim() || "unknown-error",
        ].join("\n"),
      );
    }

    return failure;
  }
}

async function reserveLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("failed-to-resolve-port")));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function chooseGatewayPort(requestedPort: number | null): Promise<{
  port: number;
  strategy: "explicit" | "ephemeral" | "fallback-random";
}> {
  if (requestedPort) {
    return {
      port: requestedPort,
      strategy: "explicit",
    };
  }

  try {
    return {
      port: await reserveLoopbackPort(),
      strategy: "ephemeral",
    };
  } catch {
    return {
      port: 19001 + Math.floor(Math.random() * 1000),
      strategy: "fallback-random",
    };
  }
}

async function resolveHarnessPaths(): Promise<HarnessPaths> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(currentDir, "../../../../..");
  const pluginRoot = path.resolve(currentDir, "..");
  const registryPath = path.resolve(repoRoot, "../../index.yaml");
  const projectYamlPath = path.join(repoRoot, "project.yaml");
  const projectYaml = await readFile(projectYamlPath, "utf8");
  const parsed = parseSimpleYaml<{ project_id?: string }>(projectYaml);
  const defaultProjectRef =
    typeof parsed.project_id === "string" && parsed.project_id.trim()
      ? parsed.project_id.trim()
      : "proj-assistant-context-router";

  return {
    repoRoot,
    pluginRoot,
    registryPath,
    defaultProjectRef,
  };
}

async function resolveValidationModel(
  cliBin: string,
  cwd: string,
): Promise<string | null> {
  const result = await execOpenClaw(
    cliBin,
    ["config", "get", "agents.defaults.model.primary"],
    {
      cwd,
      allowFailure: true,
      timeoutMs: 5000,
    },
  );
  if (!result.ok) {
    return null;
  }
  const trimmed = result.stdout.trim();
  return trimmed || null;
}

function summarizeExecResult(result: ExecResult): Record<string, unknown> {
  return {
    ok: result.ok,
    code: result.code,
    stdout: cap(result.stdout.trim()),
    stderr: cap(result.stderr.trim()),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildGatewayCallArgs(
  method: string,
  params: Record<string, unknown>,
  options?: {
    expectFinal?: boolean;
    timeoutMs?: number;
  },
): string[] {
  const args = ["gateway", "call", "--json"];
  if (options?.expectFinal) {
    args.push("--expect-final");
  }
  if (options?.timeoutMs) {
    args.push("--timeout", String(options.timeoutMs));
  }
  args.push("--params", JSON.stringify(params), method);
  return args;
}

async function waitForProjectSwitch(
  storePath: string,
  projectRef: string,
  timeoutMs: number,
): Promise<{
  raw: string;
  sessionKeys: string[];
}> {
  const deadline = Date.now() + timeoutMs;
  let lastRaw = "";
  let lastKeys: string[] = [];

  while (Date.now() < deadline) {
    lastRaw = await readFile(storePath, "utf8").catch(() => "");
    lastKeys = findSessionKeysForProject(lastRaw, projectRef);
    if (lastKeys.length > 0) {
      return {
        raw: lastRaw,
        sessionKeys: lastKeys,
      };
    }
    await sleep(250);
  }

  return {
    raw: lastRaw,
    sessionKeys: lastKeys,
  };
}

async function waitForGatewayLogSubstring(
  getLog: () => string,
  substring: string,
  startIndex: number,
  timeoutMs: number,
): Promise<{
  observed: boolean;
  log: string;
}> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const log = getLog();
    if (log.slice(startIndex).includes(substring)) {
      return {
        observed: true,
        log,
      };
    }
    await sleep(250);
  }

  return {
    observed: false,
    log: getLog(),
  };
}

async function waitForGatewayHealthy(
  cliBin: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastFailure = "";

  while (Date.now() < deadline) {
    const result = await execOpenClaw(cliBin, ["health"], {
      cwd,
      env,
      allowFailure: true,
      timeoutMs: 3000,
    });
    if (result.ok) {
      return;
    }
    lastFailure = result.stderr.trim() || result.stdout.trim() || lastFailure;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `gateway-health-timeout:${timeoutMs}${lastFailure ? `\n${cap(lastFailure, 1500)}` : ""}`,
  );
}

function captureGatewayLogs(gateway: ChildProcessWithoutNullStreams): {
  getLog: () => string;
} {
  let stdout = "";
  let stderr = "";

  gateway.stdout.setEncoding("utf8");
  gateway.stderr.setEncoding("utf8");

  gateway.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  gateway.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  return {
    getLog: () => `${stdout}${stderr}`,
  };
}

async function stopGateway(gateway: ChildProcessWithoutNullStreams | null): Promise<void> {
  if (!gateway || gateway.exitCode !== null) {
    return;
  }

  const stopped = new Promise<void>((resolve) => {
    gateway.once("exit", () => resolve());
  });

  gateway.kill("SIGINT");

  await Promise.race([
    stopped,
    new Promise<void>((resolve) => {
      setTimeout(() => {
        if (gateway.exitCode === null) {
          gateway.kill("SIGTERM");
        }
        resolve();
      }, 3000);
    }),
  ]);
}

async function main() {
  const paths = await resolveHarnessPaths();
  const defaults = {
    cliBin: process.env.OPENCLAW_BIN ?? "openclaw",
    pluginPath: paths.pluginRoot,
    registryPath: paths.registryPath,
    defaultProjectRef: paths.defaultProjectRef,
    promptMessage: "这个项目下一步是什么？",
    sessionId: "acr-cli-validation",
  };

  let options;
  try {
    options = parseValidateOpenClawCliArgs(process.argv.slice(2), defaults);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("help-requested:")) {
      process.stdout.write(`${message.slice("help-requested:".length)}\n`);
      process.exit(0);
    }
    process.stderr.write(`${message}\n`);
    process.stderr.write(`${renderValidateOpenClawCliUsage(defaults)}\n`);
    process.exit(1);
  }

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "assistant-context-router-openclaw-"));
  const stateDir = path.join(tempRoot, "state");
  const configPath = path.join(tempRoot, "openclaw.json");
  const workspaceDir = path.join(tempRoot, "workspace");
  const dataDir = path.join(tempRoot, "plugin-data");
  const gatewayPort = await chooseGatewayPort(options.gatewayPort);
  const model = options.model ?? (await resolveValidationModel(options.cliBin, paths.repoRoot));
  const env = {
    ...process.env,
    OPENCLAW_STATE_DIR: stateDir,
    OPENCLAW_CONFIG_PATH: configPath,
  };

  let gateway: ChildProcessWithoutNullStreams | null = null;
  let gatewayLog = "";
  let switchCommand: ExecResult | null = null;
  let promptCommand: ExecResult | null = null;
  let promptObserved = false;
  let storeRaw = "";
  let sessionKeys: string[] = [];

  try {
    await execOpenClaw(
      options.cliBin,
      [
        "onboard",
        "--non-interactive",
        "--accept-risk",
        "--mode",
        "local",
        "--workspace",
        workspaceDir,
        "--auth-choice",
        "skip",
        "--skip-channels",
        "--skip-skills",
        "--skip-ui",
        "--skip-search",
        "--skip-daemon",
        "--skip-health",
        "--json",
      ],
      {
        cwd: paths.repoRoot,
        env,
        timeoutMs: 60_000,
      },
    );

    const currentConfig = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
    const patchedConfig = patchOpenClawConfigForValidation({
      config: currentConfig,
      pluginPath: options.pluginPath,
      registryPath: options.registryPath,
      dataDir,
      gatewayPort: gatewayPort.port,
      model,
    });
    await writeFile(configPath, `${JSON.stringify(patchedConfig, null, 2)}\n`, "utf8");

    gateway = spawn(options.cliBin, ["gateway", "run", "--verbose"], {
      cwd: paths.repoRoot,
      env,
      stdio: "pipe",
    });
    const logs = captureGatewayLogs(gateway);

    try {
      await waitForGatewayHealthy(options.cliBin, paths.repoRoot, env, 20_000);
    } catch (error) {
      gatewayLog = logs.getLog();
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${message}${gatewayLog.trim() ? `\nGateway log tail:\n${cap(gatewayLog.trim())}` : ""}`,
      );
    }

    switchCommand = await execOpenClaw(
      options.cliBin,
      buildGatewayCallArgs(
        "chat.send",
        {
          sessionKey: options.sessionId,
          message: `/project ${options.projectRef}`,
          deliver: false,
          timeoutMs: 15_000,
          idempotencyKey: randomUUID(),
        },
        {
          expectFinal: true,
          timeoutMs: 30_000,
        },
      ),
      {
        cwd: paths.repoRoot,
        env,
        allowFailure: true,
        timeoutMs: 35_000,
      },
    );

    const storePath = sessionProjectStorePath(dataDir);
    const switchObservation = await waitForProjectSwitch(storePath, options.projectRef, 10_000);
    storeRaw = switchObservation.raw;
    sessionKeys = switchObservation.sessionKeys;

    if (!options.skipPromptBuild) {
      const logCursor = logs.getLog().length;
      promptCommand = await execOpenClaw(
        options.cliBin,
        buildGatewayCallArgs(
          "chat.send",
          {
            sessionKey: options.sessionId,
            message: options.promptMessage,
            thinking: "minimal",
            deliver: false,
            timeoutMs: 30_000,
            idempotencyKey: randomUUID(),
          },
          {
            expectFinal: true,
            timeoutMs: 60_000,
          },
        ),
        {
          cwd: paths.repoRoot,
          env,
          allowFailure: true,
          timeoutMs: 65_000,
        },
      );
      const promptObservation = await waitForGatewayLogSubstring(
        logs.getLog,
        "before_prompt_build result=prependSystemContext",
        logCursor,
        10_000,
      );
      gatewayLog = promptObservation.log;
      promptObserved = promptObservation.observed;
    } else {
      gatewayLog = logs.getLog();
    }

    const ok = sessionKeys.length > 0 && (options.skipPromptBuild || promptObserved);

    process.stdout.write(
      `${JSON.stringify(
        {
          ok,
          temp_root: tempRoot,
          registry_path: options.registryPath,
          plugin_path: options.pluginPath,
          data_dir: dataDir,
          gateway_port: gatewayPort.port,
          gateway_port_strategy: gatewayPort.strategy,
          model,
          switch_command: switchCommand ? summarizeExecResult(switchCommand) : null,
          session_keys_for_project: sessionKeys,
          prompt_build: options.skipPromptBuild
            ? {
                attempted: false,
                observed_in_gateway_log: false,
              }
            : {
                attempted: true,
                observed_in_gateway_log: promptObserved,
                command: promptCommand ? summarizeExecResult(promptCommand) : null,
              },
          gateway_log_tail: cap(gatewayLog.trim()),
          note:
            "This harness uses an isolated OpenClaw config/state root under /tmp, switches the current repo project through the real Gateway chat.send dispatch path used by TUI/webchat, and checks that assistant-context-router state was written without manual TUI copy/paste.",
        },
        null,
        2,
      )}\n`,
    );

    if (!ok) {
      process.exitCode = 1;
    }
  } finally {
    await stopGateway(gateway);
    if (!options.keepTemp) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
}

await main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
