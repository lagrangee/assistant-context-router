import { loadProjectIndex } from "../projects/registry.ts";
import type { ProjectsCommandResult } from "../types.ts";

export async function handleProjectsCommand(input: {
  registryPath: string;
  type?: string;
  status?: string;
}): Promise<ProjectsCommandResult> {
  const entries = await loadProjectIndex(input.registryPath);
  const filtered = entries.filter((entry) => {
    if (input.type && entry.type !== input.type) {
      return false;
    }
    if (input.status && entry.status !== input.status) {
      return false;
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
