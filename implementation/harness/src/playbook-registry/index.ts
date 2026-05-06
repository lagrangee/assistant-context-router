import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type PlaybookScope = "generic" | "domain" | "adapter" | "project";
export type PlaybookStatus = "draft" | "candidate" | "stable" | "deprecated";

export interface PlaybookAppliesWhen {
  has_work_surface_origin?: boolean;
  has_boundary_requirements?: boolean;
  has_pending_semantic_execution?: boolean;
  source_system?: string;
  surface_kind?: string;
  work_item_kind?: string;
  capability?: string;
}

export interface PlaybookManifestEntry {
  id: string;
  scope: PlaybookScope;
  path: string;
  applies_when: PlaybookAppliesWhen;
  priority: number;
  status: PlaybookStatus;
}

export interface PlaybookManifest {
  playbooks: PlaybookManifestEntry[];
}

export interface RegisteredPlaybook extends PlaybookManifestEntry {
  absolute_path: string;
  content: string;
}

export interface PlaybookRegistry {
  playbooks: RegisteredPlaybook[];
}

const ALLOWED_SCOPES = new Set<PlaybookScope>([
  "generic",
  "domain",
  "adapter",
  "project",
]);
const ALLOWED_STATUSES = new Set<PlaybookStatus>([
  "draft",
  "candidate",
  "stable",
  "deprecated",
]);

function defaultPath(relativeUrl: string): string {
  return fileURLToPath(new URL(relativeUrl, import.meta.url));
}

export function createDefaultPlaybookManifest(): PlaybookManifest {
  return {
    playbooks: [
      {
        id: "work-surface-execution",
        scope: "generic",
        path: defaultPath("../../playbooks/work-surface-execution/SKILL.md"),
        applies_when: {
          has_work_surface_origin: true,
        },
        priority: 100,
        status: "candidate",
      },
      {
        id: "acr-boundary-protocol",
        scope: "generic",
        path: defaultPath("../../playbooks/acr-boundary-protocol/SKILL.md"),
        applies_when: {
          has_boundary_requirements: true,
        },
        priority: 100,
        status: "candidate",
      },
      {
        id: "work-item-card-semantics",
        scope: "domain",
        path: defaultPath(
          "../../../domains/work-items/playbooks/work-item-card-semantics/SKILL.md",
        ),
        applies_when: {
          surface_kind: "project_management",
        },
        priority: 80,
        status: "candidate",
      },
      {
        id: "feishu-base-navigation",
        scope: "adapter",
        path: defaultPath(
          "../../../adapters/work-surfaces/feishu/playbooks/feishu-base-navigation/SKILL.md",
        ),
        applies_when: {
          source_system: "feishu_base",
        },
        priority: 90,
        status: "candidate",
      },
    ],
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validatePlaybookManifest(manifest: PlaybookManifest): string[] {
  const errors: string[] = [];
  if (!Array.isArray(manifest.playbooks)) {
    return ["manifest.playbooks must be an array"];
  }

  const seenIds = new Set<string>();
  for (const [index, playbook] of manifest.playbooks.entries()) {
    const prefix = `playbooks[${index}]`;
    if (!playbook.id || typeof playbook.id !== "string") {
      errors.push(`${prefix}.id must be a non-empty string`);
    } else if (seenIds.has(playbook.id)) {
      errors.push(`${prefix}.id duplicates ${playbook.id}`);
    } else {
      seenIds.add(playbook.id);
    }

    if (!ALLOWED_SCOPES.has(playbook.scope)) {
      errors.push(`${prefix}.scope is unsupported: ${String(playbook.scope)}`);
    }
    if (!ALLOWED_STATUSES.has(playbook.status)) {
      errors.push(`${prefix}.status is unsupported: ${String(playbook.status)}`);
    }
    if (!playbook.path || typeof playbook.path !== "string") {
      errors.push(`${prefix}.path must be a non-empty string`);
    }
    if (!Number.isFinite(playbook.priority)) {
      errors.push(`${prefix}.priority must be a finite number`);
    }
    if (!isObject(playbook.applies_when)) {
      errors.push(`${prefix}.applies_when must be an object`);
    }
  }

  return errors;
}

export async function loadPlaybookRegistry(input: {
  manifest?: PlaybookManifest;
  baseDir?: string;
} = {}): Promise<PlaybookRegistry> {
  const manifest = input.manifest ?? createDefaultPlaybookManifest();
  const errors = validatePlaybookManifest(manifest);
  if (errors.length > 0) {
    throw new Error(`invalid-playbook-manifest:${errors.join(";")}`);
  }

  const playbooks: RegisteredPlaybook[] = [];
  for (const playbook of manifest.playbooks) {
    const absolutePath = path.isAbsolute(playbook.path)
      ? playbook.path
      : path.resolve(input.baseDir ?? process.cwd(), playbook.path);
    const content = await readFile(absolutePath, "utf8");
    playbooks.push({
      ...playbook,
      absolute_path: absolutePath,
      content,
    });
  }

  return { playbooks };
}

let defaultRegistryPromise: Promise<PlaybookRegistry> | null = null;

export function loadDefaultPlaybookRegistry(): Promise<PlaybookRegistry> {
  if (!defaultRegistryPromise) {
    defaultRegistryPromise = loadPlaybookRegistry();
  }
  return defaultRegistryPromise;
}
