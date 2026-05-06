import type { ExecutionEnvelope } from "../execution-envelope/index.ts";
import type {
  PlaybookAppliesWhen,
  PlaybookRegistry,
  RegisteredPlaybook,
} from "../playbook-registry/index.ts";

export interface PlaybookSelectionFacts {
  has_work_surface_origin: boolean;
  has_boundary_requirements: boolean;
  has_pending_semantic_execution: boolean;
  source_system: string | null;
  surface_kind: string | null;
  work_item_kinds: string[];
  capabilities: string[];
}

export interface SelectedPlaybook {
  id: string;
  scope: RegisteredPlaybook["scope"];
  status: RegisteredPlaybook["status"];
  priority: number;
  absolute_path: string;
  content: string;
  matched_when: PlaybookAppliesWhen;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && !!item.trim());
}

export function derivePlaybookSelectionFacts(
  envelope: ExecutionEnvelope,
): PlaybookSelectionFacts {
  const origin =
    envelope.work_surface_origin ??
    envelope.work_items.find((item) => item.work_surface_origin)?.work_surface_origin ??
    null;
  return {
    has_work_surface_origin: !!origin,
    has_boundary_requirements: !!envelope.boundary_requirements,
    has_pending_semantic_execution: envelope.adapter_facts.pending_semantic_execution === true,
    source_system: origin?.source_system ?? null,
    surface_kind: origin?.surface_kind ?? null,
    work_item_kinds: [...new Set(envelope.work_items.map((item) => item.kind).filter(Boolean))],
    capabilities: asStringArray(envelope.adapter_facts.capabilities),
  };
}

function matchesAppliesWhen(
  appliesWhen: PlaybookAppliesWhen,
  facts: PlaybookSelectionFacts,
): boolean {
  if (
    appliesWhen.has_work_surface_origin !== undefined &&
    appliesWhen.has_work_surface_origin !== facts.has_work_surface_origin
  ) {
    return false;
  }
  if (
    appliesWhen.has_boundary_requirements !== undefined &&
    appliesWhen.has_boundary_requirements !== facts.has_boundary_requirements
  ) {
    return false;
  }
  if (
    appliesWhen.has_pending_semantic_execution !== undefined &&
    appliesWhen.has_pending_semantic_execution !== facts.has_pending_semantic_execution
  ) {
    return false;
  }
  if (appliesWhen.source_system && appliesWhen.source_system !== facts.source_system) {
    return false;
  }
  if (appliesWhen.surface_kind && appliesWhen.surface_kind !== facts.surface_kind) {
    return false;
  }
  if (
    appliesWhen.work_item_kind &&
    !facts.work_item_kinds.includes(appliesWhen.work_item_kind)
  ) {
    return false;
  }
  if (appliesWhen.capability && !facts.capabilities.includes(appliesWhen.capability)) {
    return false;
  }
  return true;
}

export function selectPlaybooks(input: {
  registry: PlaybookRegistry;
  envelope: ExecutionEnvelope;
  maxTotal?: number;
}): SelectedPlaybook[] {
  const facts = derivePlaybookSelectionFacts(input.envelope);
  const maxTotal = input.maxTotal ?? 8;

  return input.registry.playbooks
    .filter((playbook) => playbook.status !== "deprecated")
    .filter((playbook) => matchesAppliesWhen(playbook.applies_when, facts))
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))
    .slice(0, maxTotal)
    .map((playbook) => ({
      id: playbook.id,
      scope: playbook.scope,
      status: playbook.status,
      priority: playbook.priority,
      absolute_path: playbook.absolute_path,
      content: playbook.content,
      matched_when: playbook.applies_when,
    }));
}
