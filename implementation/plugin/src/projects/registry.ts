import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseSimpleYaml } from "../lib/simple-yaml.ts";
import type { ProjectDefinition, ProjectRegistryEntry } from "../types.ts";

interface ProjectIndexFile {
  projects?: Array<Record<string, unknown>>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function inferProjectRoot(absoluteFilePath: string): string {
  const basename = path.basename(absoluteFilePath).toLowerCase();
  if (basename === "project.yaml" || basename === "project.yml" || basename === "readme.md") {
    return path.dirname(absoluteFilePath);
  }
  return path.dirname(absoluteFilePath);
}

export async function loadProjectIndex(
  registryPath: string,
): Promise<ProjectRegistryEntry[]> {
  const raw = await readFile(registryPath, "utf8");
  const parsed = parseSimpleYaml<ProjectIndexFile>(raw);
  const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
  const registryRoot = path.dirname(registryPath);

  return projects
    .map((project) => {
      const file = asString(project.file);
      const projectId = asString(project.project_id);
      if (!file || !projectId) {
        return null;
      }

      const absoluteFilePath = path.resolve(registryRoot, file);
      return {
        project_id: projectId,
        title: asString(project.title),
        type: asString(project.type),
        status: asString(project.status),
        owner: asString(project.owner),
        cadence: asString(project.cadence),
        file,
        absolute_file_path: absoluteFilePath,
        project_root: inferProjectRoot(absoluteFilePath),
      } satisfies ProjectRegistryEntry;
    })
    .filter((entry): entry is ProjectRegistryEntry => entry !== null);
}

export async function getProjectById(
  registryPath: string,
  projectId: string,
): Promise<ProjectRegistryEntry | null> {
  const entries = await loadProjectIndex(registryPath);
  return entries.find((entry) => entry.project_id === projectId) ?? null;
}

export async function loadProjectDefinition(
  entry: ProjectRegistryEntry,
): Promise<ProjectDefinition> {
  const candidatePaths = [entry.absolute_file_path];
  const basename = path.basename(entry.absolute_file_path).toLowerCase();

  if (basename === "readme.md") {
    candidatePaths.unshift(path.join(entry.project_root, "project.yaml"));
    candidatePaths.unshift(path.join(entry.project_root, "project.yml"));
  }

  for (const candidatePath of candidatePaths) {
    try {
      const raw = await readFile(candidatePath, "utf8");
      if (candidatePath.endsWith(".md")) {
        return {};
      }
      const parsed = parseSimpleYaml<ProjectDefinition>(raw);
      return parsed ?? {};
    } catch {
      continue;
    }
  }

  return {};
}
