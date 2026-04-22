import test from "node:test";
import assert from "node:assert/strict";

import {
  appendBusinessNotificationRecord,
  readBusinessNotificationRecords,
} from "../../core/src/routing/business-notification-log.ts";
import { makeTempProjectWorkspace } from "../test-helpers.ts";

test("business notification log appends independent project-scoped records", async () => {
  const workspace = await makeTempProjectWorkspace();

  await appendBusinessNotificationRecord({
    dataDir: workspace.dataDir,
    record: {
      notification_id: "notification:test:1",
      created_at: "2026-04-17T12:00:00.000Z",
      project_id: "proj-sample",
      signal_kind: "review_request",
      source: "service_result",
      trace_id: "trace-review-1",
      action_name: "review",
      workflow: "review",
      reason: "review required",
      summary: "Review target is ready",
      run_id: "run-review-1",
      queue_ref: null,
      artifact_ref: {
        kind: "review_target",
        label: "Diff bundle",
        target: "file:///tmp/review-target.diff",
      },
      status: "recorded",
    },
  });

  const records = await readBusinessNotificationRecords({
    projectId: "proj-sample",
    dataDir: workspace.dataDir,
  });

  assert.equal(records.length, 1);
  assert.equal(records[0]?.signal_kind, "review_request");
  assert.equal(records[0]?.status, "recorded");
  assert.equal(records[0]?.artifact_ref?.kind, "review_target");
});
