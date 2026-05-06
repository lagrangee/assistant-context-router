import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultPlaybookManifest,
  loadPlaybookRegistry,
  validatePlaybookManifest,
  type PlaybookManifest,
} from "../../harness/src/playbook-registry/index.ts";

test("default harness playbook manifest loads candidate seed playbooks", async () => {
  const registry = await loadPlaybookRegistry();

  assert.deepEqual(
    registry.playbooks.map((playbook) => playbook.id).sort(),
    [
      "acr-boundary-protocol",
      "feishu-base-navigation",
      "work-item-card-semantics",
      "work-surface-execution",
    ].sort(),
  );
  assert.ok(
    registry.playbooks.every((playbook) => playbook.status === "candidate"),
  );
  assert.match(
    registry.playbooks.find((playbook) => playbook.id === "work-surface-execution")
      ?.content ?? "",
    /Work Surface Execution/,
  );
});

test("playbook registry fails closed for unsupported manifest values", async () => {
  const manifest = createDefaultPlaybookManifest();
  const invalid = {
    playbooks: [
      {
        ...manifest.playbooks[0],
        scope: "feishu",
        status: "active",
        path: "",
      },
    ],
  } as unknown as PlaybookManifest;

  const errors = validatePlaybookManifest(invalid);
  assert.deepEqual(errors, [
    "playbooks[0].scope is unsupported: feishu",
    "playbooks[0].status is unsupported: active",
    "playbooks[0].path must be a non-empty string",
  ]);

  await assert.rejects(
    () => loadPlaybookRegistry({ manifest: invalid }),
    /invalid-playbook-manifest/,
  );
});
