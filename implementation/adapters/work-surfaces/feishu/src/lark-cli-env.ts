import os from "node:os";
import path from "node:path";

function pickNonEmpty(value: string | undefined | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function fallbackUsername(homePath: string): string {
  const base = path.basename(homePath);
  return base && base !== path.sep ? base : "unknown";
}

export function buildNormalizedLarkCliEnv(
  overrides?: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const merged: NodeJS.ProcessEnv = overrides ? { ...overrides } : { ...process.env };

  const home = pickNonEmpty(merged.HOME) ?? os.homedir();
  merged.HOME = home;

  const user =
    pickNonEmpty(merged.USER) ??
    pickNonEmpty(merged.LOGNAME) ??
    fallbackUsername(home);
  merged.USER = user;
  merged.LOGNAME = pickNonEmpty(merged.LOGNAME) ?? user;

  const shell = pickNonEmpty(merged.SHELL) ?? pickNonEmpty(process.env.SHELL);
  if (shell) {
    merged.SHELL = shell;
  }

  return merged;
}
