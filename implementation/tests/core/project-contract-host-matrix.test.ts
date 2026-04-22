import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  buildSaveSourceNotes,
  listSaveApplyTargets,
  resolveProjectContractHostMatrix,
} from "../../core/src/save/project-contract-host-matrix.ts";

test("project contract host matrix resolves the default docs and excludes README/COLLAB from default apply", () => {
  const projectDir = "/tmp/demo-project";
  const matrix = resolveProjectContractHostMatrix(projectDir);
  const applyTargets = listSaveApplyTargets(matrix);

  assert.equal(matrix.readme.path, path.join(projectDir, "README.md"));
  assert.equal(matrix.status.path, path.join(projectDir, "STATUS.md"));
  assert.equal(matrix.resume.path, path.join(projectDir, "RESUME.md"));
  assert.equal(matrix.collab.path, path.join(projectDir, "execution", "COLLAB.md"));
  assert.deepEqual(
    applyTargets.map((target) => target.doc_key),
    ["RESUME.md", "STATUS.md"],
  );
});

test("buildSaveSourceNotes describes binding scope and default apply hosts", () => {
  const notes = buildSaveSourceNotes({
    projectId: "proj-sample",
    selectedVia: "manual",
  });

  assert.match(notes[0] ?? "", /current project binding only/);
  assert.match(notes.join("\n"), /Default apply hosts: RESUME\.md/);
  assert.match(notes.join("\n"), /README\.md and execution\/COLLAB\.md are excluded/);
});
