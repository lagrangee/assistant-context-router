import path from "node:path";

export interface ProjectContractHostTarget {
  doc_key: "README.md" | "STATUS.md" | "RESUME.md" | "COLLAB.md";
  path: string;
  purpose: "identity" | "current_state" | "working_state" | "collaboration";
  included_in_apply: boolean;
}

export interface ProjectContractHostMatrix {
  readme: ProjectContractHostTarget;
  status: ProjectContractHostTarget;
  resume: ProjectContractHostTarget;
  collab: ProjectContractHostTarget;
}

export function resolveProjectContractHostMatrix(projectDir: string): ProjectContractHostMatrix {
  return {
    readme: {
      doc_key: "README.md",
      path: path.join(projectDir, "README.md"),
      purpose: "identity",
      included_in_apply: false,
    },
    status: {
      doc_key: "STATUS.md",
      path: path.join(projectDir, "STATUS.md"),
      purpose: "current_state",
      included_in_apply: true,
    },
    resume: {
      doc_key: "RESUME.md",
      path: path.join(projectDir, "RESUME.md"),
      purpose: "working_state",
      included_in_apply: true,
    },
    collab: {
      doc_key: "COLLAB.md",
      path: path.join(projectDir, "execution", "COLLAB.md"),
      purpose: "collaboration",
      included_in_apply: false,
    },
  };
}

export function listSaveApplyTargets(matrix: ProjectContractHostMatrix): ProjectContractHostTarget[] {
  return [matrix.resume, matrix.status].filter((target) => target.included_in_apply);
}

export function buildSaveSourceNotes(input: {
  projectId: string;
  selectedVia: string | null | undefined;
}): string[] {
  return [
    `Save scope: current project binding only (${input.projectId}).`,
    "Primary source hierarchy: current conversation in save mode -> current project hall docs -> current binding metadata -> recent route/session state.",
    `Binding source: ${input.selectedVia ?? "unknown"}.`,
    "Default apply hosts: RESUME.md (working_state) and STATUS.md (current_state).",
    "README.md and execution/COLLAB.md are excluded from default /save apply unless a future contract explicitly promotes changes there.",
    "No silent write: preview/apply remains the only default write path.",
  ];
}
