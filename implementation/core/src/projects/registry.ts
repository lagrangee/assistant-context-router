import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseSimpleYaml } from "../lib/simple-yaml.ts";
import type { ProjectDefinition, ProjectRegistryEntry } from "../types.ts";

interface ProjectIndexFile {
  projects?: Array<Record<string, unknown>>;
}

function normalizeProjectToken(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSearchText(value: string): string[] {
  return normalizeSearchText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (!a) {
    return b.length;
  }
  if (!b) {
    return a.length;
  }

  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[] = new Array(rows * cols).fill(0);
  const index = (row: number, col: number) => row * cols + col;

  for (let row = 0; row < rows; row += 1) {
    dp[index(row, 0)] = row;
  }
  for (let col = 0; col < cols; col += 1) {
    dp[index(0, col)] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const substitutionCost = a[row - 1] === b[col - 1] ? 0 : 1;
      dp[index(row, col)] = Math.min(
        dp[index(row - 1, col)] + 1,
        dp[index(row, col - 1)] + 1,
        dp[index(row - 1, col - 1)] + substitutionCost,
      );
    }
  }

  return dp[index(rows - 1, cols - 1)];
}

function inferProjectRoot(absoluteFilePath: string): string {
  const basename = path.basename(absoluteFilePath).toLowerCase();
  if (basename === "project.yaml" || basename === "project.yml" || basename === "readme.md") {
    return path.dirname(absoluteFilePath);
  }
  return path.dirname(absoluteFilePath);
}

function buildSearchHaystack(entry: ProjectRegistryEntry): string {
  return normalizeSearchText(
    [
      entry.project_id,
      entry.title ?? "",
      entry.file,
      path.basename(entry.project_root),
      path.basename(path.dirname(entry.project_root)),
    ].join(" "),
  );
}

function scoreProjectMatch(entry: ProjectRegistryEntry, query: string): number {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = tokenizeSearchText(query);
  const projectId = normalizeProjectToken(entry.project_id);
  const title = normalizeSearchText(entry.title ?? "");
  const haystack = buildSearchHaystack(entry);

  if (!normalizedQuery) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  if (projectId === normalizeProjectToken(query)) {
    score += 10_000;
  }

  if (haystack.includes(normalizedQuery)) {
    score += 300;
  }
  if (title && title.includes(normalizedQuery)) {
    score += 220;
  }
  if (projectId.includes(normalizeProjectToken(query))) {
    score += 180;
  }

  const allTokensInHaystack =
    queryTokens.length > 0 && queryTokens.every((token) => haystack.includes(token));
  const allTokensInProjectId =
    queryTokens.length > 0 && queryTokens.every((token) => projectId.includes(token));

  if (allTokensInHaystack) {
    score += 140 + queryTokens.length * 12;
  }
  if (allTokensInProjectId) {
    score += 110 + queryTokens.length * 10;
  }

  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      score += 18;
    }
    if (projectId.includes(token)) {
      score += 14;
    }
    if (title.includes(token)) {
      score += 12;
    }
  }

  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const compactProjectId = projectId.replace(/[^a-z0-9]+/g, "");
  const compactTitle = title.replace(/\s+/g, "");
  score -= Math.min(levenshteinDistance(compactQuery, compactProjectId), 50);
  if (compactTitle) {
    score -= Math.min(levenshteinDistance(compactQuery, compactTitle), 40);
  }

  return score;
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
  const normalizedTarget = normalizeProjectToken(projectId);
  return (
    entries.find((entry) => normalizeProjectToken(entry.project_id) === normalizedTarget) ?? null
  );
}

export async function findClosestProjects(
  registryPath: string,
  projectId: string,
  limit = 3,
): Promise<ProjectRegistryEntry[]> {
  const entries = await loadProjectIndex(registryPath);

  const scored = entries
    .map((entry) => {
      return {
        entry,
        score: scoreProjectMatch(entry, projectId),
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.entry.project_id.localeCompare(right.entry.project_id),
    );

  if (scored.length === 0) {
    return [];
  }

  const bestScore = scored[0]?.score ?? Number.NEGATIVE_INFINITY;
  const threshold = Math.max(10, bestScore - 120);

  return scored
    .filter((candidate, index) => index < limit && candidate.score >= threshold)
    .map((candidate) => candidate.entry);
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
