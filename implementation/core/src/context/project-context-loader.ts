import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadProjectDefinition } from "../projects/registry.ts";
import type {
  ProjectContextPayload,
  ProjectDefinition,
  ProjectRegistryEntry,
} from "../types.ts";

const TOTAL_CHAR_BUDGET = 2600;
const STATUS_CAP = 700;
const README_CAP = 450;
const RESUME_CAP = 650;
const PROJECT_YAML_CAP = 300;
const MANIFEST_CAP = 380;

function normalizeText(input: string): string {
  return input.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
}

function truncate(input: string, cap: number): string {
  if (input.length <= cap) {
    return input;
  }
  return `${input.slice(0, Math.max(0, cap - 1)).trimEnd()}…`;
}

function pushSection(
  sections: ProjectContextPayload["sections"],
  label: string,
  text: string | null,
  cap: number,
): void {
  if (!text) {
    return;
  }
  const normalized = truncate(normalizeText(text), cap);
  if (!normalized) {
    return;
  }
  sections.push({
    label,
    text: normalized,
    chars: normalized.length,
  });
}

function buildManifest(input: {
  entry: ProjectRegistryEntry;
  definition: ProjectDefinition;
}): string {
  const truthDocs = ["STATUS.md", "RESUME.md", "README.md"];
  const readOrder = ["1. STATUS.md", "2. RESUME.md", "3. README.md", "4. project.yaml (identity metadata only)"];

  const lines = [
    `current_project_id: ${input.entry.project_id}`,
    input.entry.title ? `project_title: ${input.entry.title}` : null,
    `project_root: ${input.entry.project_root}`,
    "truth_docs:",
    ...truthDocs.map((doc) => `- ${doc}`),
    "default_read_order:",
    ...readOrder,
    "working_rule: Read truth docs as needed; anchors below are hints, not a replacement for file reading.",
    input.definition.next_action ? `known_next_action: ${input.definition.next_action}` : null,
  ].filter(Boolean);

  return lines.join("\n");
}

function summarizeProjectDefinition(definition: ProjectDefinition): string {
  const lines: string[] = [];
  const maybePush = (label: string, value: unknown): void => {
    if (typeof value === "string" && value.trim() !== "") {
      lines.push(`${label}: ${value.trim()}`);
    }
  };

  maybePush("project_id", definition.project_id);
  maybePush("title", definition.title);
  maybePush("kind", definition.kind ?? definition.type);
  maybePush("status", definition.status);
  maybePush("objective", definition.objective);
  maybePush("next_action", definition.next_action);

  if (Array.isArray(definition.principles) && definition.principles.length > 0) {
    lines.push(`principles: ${definition.principles.slice(0, 4).join(" | ")}`);
  }

  if (
    Array.isArray(definition.acceptance_criteria) &&
    definition.acceptance_criteria.length > 0
  ) {
    lines.push(
      `acceptance_criteria: ${definition.acceptance_criteria.slice(0, 3).join(" | ")}`,
    );
  }

  if (Array.isArray(definition.primary_docs) && definition.primary_docs.length > 0) {
    lines.push(`primary_docs: ${definition.primary_docs.slice(0, 5).join(" | ")}`);
  }

  const constraints = definition.constraints;
  if (typeof constraints === "string" && constraints.trim() !== "") {
    lines.push(`constraints: ${constraints.trim()}`);
  } else if (Array.isArray(constraints) && constraints.length > 0) {
    lines.push(`constraints: ${constraints.slice(0, 3).join(" | ")}`);
  } else if (constraints && typeof constraints === "object") {
    const compact = Object.entries(constraints)
      .slice(0, 4)
      .map(([key, value]) => `${key}=${String(value)}`);
    if (compact.length > 0) {
      lines.push(`constraints: ${compact.join(" | ")}`);
    }
  }

  return lines.join("\n");
}

async function readOptionalFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function extractReadmeSummary(readme: string): string | null {
  const lines = normalizeText(readme).split("\n");
  const buffer: string[] = [];
  let seenTopHeading = false;

  for (const line of lines) {
    if (!seenTopHeading) {
      if (line.startsWith("# ")) {
        seenTopHeading = true;
      }
      continue;
    }

    if (line.startsWith("## ")) {
      break;
    }

    buffer.push(line);
  }

  return buffer.join("\n").trim() || null;
}

function extractNamedSections(markdown: string, headings: string[]): string | null {
  const lines = normalizeText(markdown).split("\n");
  const wanted = new Set(headings.map((heading) => heading.toLowerCase()));
  const sections: string[] = [];
  let currentHeading: string | null = null;
  let buffer: string[] = [];

  const flush = (): void => {
    if (!currentHeading || buffer.length === 0) {
      buffer = [];
      return;
    }
    sections.push(`## ${currentHeading}`);
    sections.push(...buffer);
    sections.push("");
    buffer = [];
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      const heading = line.slice(3).trim();
      currentHeading = wanted.has(heading.toLowerCase()) ? heading : null;
      continue;
    }

    if (currentHeading) {
      buffer.push(line);
    }
  }

  flush();

  return sections.join("\n").trim() || null;
}

function extractStatusSummary(status: string): string | null {
  const extracted = extractNamedSections(status, [
    "TL;DR（一句话）",
    "当前阶段（你现在在哪）",
    "下一步（从这里继续推进主线）",
  ]);
  if (extracted) {
    return extracted;
  }

  return normalizeText(status).split("\n").slice(0, 14).join("\n").trim() || null;
}

function extractResumeSummary(resume: string): string | null {
  const extracted = extractNamedSections(resume, [
    "Current phase",
    "Current mainline",
    "Immediate next actions",
    "Guardrail",
  ]);
  if (extracted) {
    return extracted;
  }

  return normalizeText(resume).split("\n").slice(0, 18).join("\n").trim() || null;
}

export async function loadProjectContext(input: {
  entry: ProjectRegistryEntry;
}): Promise<ProjectContextPayload> {
  const definition = await loadProjectDefinition(input.entry);
  const sections: ProjectContextPayload["sections"] = [];

  pushSection(
    sections,
    "manifest",
    buildManifest({
      entry: input.entry,
      definition,
    }),
    MANIFEST_CAP,
  );

  const status = await readOptionalFile(path.join(input.entry.project_root, "STATUS.md"));
  pushSection(sections, "anchor:STATUS.md", status ? extractStatusSummary(status) : null, STATUS_CAP);

  const readme = await readOptionalFile(path.join(input.entry.project_root, "README.md"));
  pushSection(sections, "anchor:README.md", readme ? extractReadmeSummary(readme) : null, README_CAP);

  const resume = await readOptionalFile(path.join(input.entry.project_root, "RESUME.md"));
  pushSection(
    sections,
    "anchor:RESUME.md",
    resume ? extractResumeSummary(resume) : null,
    RESUME_CAP,
  );

  pushSection(
    sections,
    "identity:project.yaml",
    summarizeProjectDefinition(definition),
    PROJECT_YAML_CAP,
  );

  let totalChars = sections.reduce((sum, section) => sum + section.chars, 0);
  while (totalChars > TOTAL_CHAR_BUDGET && sections.length > 2) {
    sections.pop();
    totalChars = sections.reduce((sum, section) => sum + section.chars, 0);
  }

  const rendered = sections
    .map((section) => `[${section.label}]\n${section.text}`)
    .join("\n\n")
    .trim();

  return {
    projectId: input.entry.project_id,
    title: input.entry.title ?? definition.title,
    sections,
    totalChars,
    rendered,
  };
}
