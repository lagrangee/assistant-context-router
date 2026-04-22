import test from "node:test";
import assert from "node:assert/strict";

import {
  bindingMatchesProject,
  createCurrentProjectBindingPatch,
  readCurrentProjectBinding,
} from "../../core/src/state/current-project-binding.ts";

test("readCurrentProjectBinding returns null without a selected project", () => {
  const result = readCurrentProjectBinding({
    current_project_id: null,
    selected_at: "2026-04-17T00:00:00.000Z",
    selected_via: "manual",
    current_workflow: null,
    updated_at: "2026-04-17T00:00:00.000Z",
    expires_at: "2026-04-24T00:00:00.000Z",
    last_route_trace: null,
    pending_save_mode: null,
    pending_save_draft: null,
  });

  assert.equal(result, null);
});

test("readCurrentProjectBinding returns a stable binding view", () => {
  const result = readCurrentProjectBinding({
    current_project_id: "proj-sample",
    selected_at: "2026-04-17T00:00:00.000Z",
    selected_via: "manual",
    current_workflow: "dispatch",
    updated_at: "2026-04-17T00:00:01.000Z",
    expires_at: "2026-04-24T00:00:00.000Z",
    last_route_trace: null,
    pending_save_mode: null,
    pending_save_draft: null,
  });

  assert.deepEqual(result, {
    project_id: "proj-sample",
    selected_at: "2026-04-17T00:00:00.000Z",
    selected_via: "manual",
    current_workflow: "dispatch",
    updated_at: "2026-04-17T00:00:01.000Z",
  });
});

test("createCurrentProjectBindingPatch can clear pending save state on explicit switch", () => {
  const patch = createCurrentProjectBindingPatch({
    projectId: "proj-sample",
    selectedAt: "2026-04-17T00:00:00.000Z",
    selectedVia: "manual",
    clearPendingSave: true,
  });

  assert.equal(patch.current_project_id, "proj-sample");
  assert.equal(patch.selected_via, "manual");
  assert.equal(patch.pending_save_mode, null);
  assert.equal(patch.pending_save_draft, null);
});

test("bindingMatchesProject compares pending state against the current binding", () => {
  const matches = bindingMatchesProject(
    {
      current_project_id: "proj-sample",
      selected_at: "2026-04-17T00:00:00.000Z",
      selected_via: "manual",
      current_workflow: null,
      updated_at: "2026-04-17T00:00:01.000Z",
      expires_at: "2026-04-24T00:00:00.000Z",
      last_route_trace: null,
      pending_save_mode: null,
      pending_save_draft: null,
    },
    "proj-sample",
  );

  assert.equal(matches, true);
  assert.equal(
    bindingMatchesProject(
      {
        current_project_id: "proj-sample",
        selected_at: "2026-04-17T00:00:00.000Z",
        selected_via: "manual",
        current_workflow: null,
        updated_at: "2026-04-17T00:00:01.000Z",
        expires_at: "2026-04-24T00:00:00.000Z",
        last_route_trace: null,
        pending_save_mode: null,
        pending_save_draft: null,
      },
      "proj-other",
    ),
    false,
  );
});
