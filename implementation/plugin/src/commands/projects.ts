import { loadProjectIndex } from "../projects/registry.ts";
import type { ProjectsCommandResult } from "../types.ts";

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildEntrySearchHaystack(entry: {
  project_id: string;
  title?: string;
  type?: string;
  status?: string;
  file: string;
  project_root: string;
}): string {
  return normalizeSearchText(
    [
      entry.project_id,
      entry.title ?? "",
      entry.type ?? "",
      entry.status ?? "",
      entry.file,
      entry.project_root,
    ].join(" "),
  );
}

export async function handleProjectsCommand(input: {
  registryPath: string;
  type?: string;
  status?: string;
  query?: string;
}): Promise<ProjectsCommandResult> {
  const entries = await loadProjectIndex(input.registryPath);
  const queryTokens = normalizeSearchText(input.query ?? "")
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
  const filtered = entries.filter((entry) => {
    if (input.type && entry.type !== input.type) {
      return false;
    }
    if (input.status && entry.status !== input.status) {
      return false;
    }
    if (queryTokens.length > 0) {
      const haystack = buildEntrySearchHaystack(entry);
      if (!queryTokens.every((token) => haystack.includes(token))) {
        return false;
      }
    }
    return true;
  });

  const lines = filtered.map((entry) => {
    const parts = [
      entry.project_id,
      entry.title ?? "Untitled",
      entry.type ?? "unknown",
      entry.status ?? "unknown",
    ];
    if (entry.cadence) {
      parts.push(`cadence=${entry.cadence}`);
    }
    return `- ${parts.join(" | ")}`;
  });

  const content =
    lines.length > 0
      ? ["Projects:", ...lines].join("\n")
      : "Projects:\n- No matching projects found";

  return {
    content,
    count: filtered.length,
  };
}
