import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  buildWorkSurfaceProjectionSnapshot,
  readWorkSurfaceProjectionSnapshot,
  workSurfaceProjectionPath,
  writeWorkSurfaceProjectionSnapshot,
} from "../../core/src/routing/work-surface-projection.ts";

test("buildWorkSurfaceProjectionSnapshot derives minimal blocked snapshot", () => {
  const snapshot = buildWorkSurfaceProjectionSnapshot({
    projectId: "demo-acr",
    signalKind: "blocked",
    decision: {
      target_kind: "service",
      target_id: "demo-acr:dispatch",
      resolved_project_id: "demo-acr",
      project_ref: "demo-acr",
      route_source: "automation",
      route_reason: "Structured automation routed to internal service",
      route_evidence: ["service action"],
      workflow: "dispatch",
      fallback_to_main_session: false,
      escalation_reason: "blocked waiting for approval",
      safe_fail_reason: null,
    },
    envelope: {
      source_type: "automation",
      channel_type: "feishu",
      project_ref: "demo-acr",
      resolved_project_id: "demo-acr",
      action_name: "dispatch",
      parameters: null,
      reply_target: null,
      trace_id: "trace-001",
      workflow: "dispatch",
      raw_message_ref: "msg-001",
      text: null,
    },
    serviceResult: {
      status: "needs_escalation",
      result_kind: "needs_escalation",
      summary: "Dispatch blocked until approval arrives.",
      reply_payload: null,
      needs_escalation: true,
      escalation_reason: "blocked waiting for approval",
      run_id: "run-001",
      queue_ref: "queue-001",
      artifact_ref: {
        kind: "approval_request",
        label: "Approval payload",
        target: "file:///tmp/approval-payload.json",
      },
      trace_patch: null,
    },
    now: () => new Date("2026-04-19T12:00:00.000Z"),
  });

  assert.ok(snapshot);
  assert.equal(snapshot.project_id, "demo-acr");
  assert.equal(snapshot.signal_kind, "blocked");
  assert.equal(snapshot.surface_status, "blocked");
  assert.equal(snapshot.headline, "Blocked: dispatch");
  assert.equal(snapshot.summary, "Dispatch blocked until approval arrives.");
  assert.equal(snapshot.artifact_ref?.target, "file:///tmp/approval-payload.json");
});

test("buildWorkSurfaceProjectionSnapshot returns null for local-only signal", () => {
  const snapshot = buildWorkSurfaceProjectionSnapshot({
    projectId: "demo-acr",
    signalKind: "none",
    decision: {
      target_kind: "service",
      target_id: "demo-acr:dispatch",
      resolved_project_id: "demo-acr",
      project_ref: "demo-acr",
      route_source: "automation",
      route_reason: "Structured automation routed to internal service",
      route_evidence: [],
      workflow: "dispatch",
      fallback_to_main_session: false,
      escalation_reason: null,
      safe_fail_reason: null,
    },
    envelope: {
      source_type: "automation",
      channel_type: "feishu",
      project_ref: "demo-acr",
      resolved_project_id: "demo-acr",
      action_name: "dispatch",
      parameters: null,
      reply_target: null,
      trace_id: "trace-002",
      workflow: "dispatch",
      raw_message_ref: "msg-002",
      text: null,
    },
  });

  assert.equal(snapshot, null);
});

test("writeWorkSurfaceProjectionSnapshot persists latest snapshot", async () => {
  const dataDir = await mkdtemp(path.join(process.env.TMPDIR ?? "/tmp", "acr-work-surface-"));
  const snapshot = buildWorkSurfaceProjectionSnapshot({
    projectId: "demo-acr",
    signalKind: "high_signal_completion",
    decision: {
      target_kind: "service",
      target_id: "demo-acr:dispatch",
      resolved_project_id: "demo-acr",
      project_ref: "demo-acr",
      route_source: "automation",
      route_reason: "Structured automation routed to internal service",
      route_evidence: ["service action"],
      workflow: "dispatch",
      fallback_to_main_session: false,
      escalation_reason: null,
      safe_fail_reason: null,
    },
    envelope: {
      source_type: "automation",
      channel_type: "feishu",
      project_ref: "demo-acr",
      resolved_project_id: "demo-acr",
      action_name: "dispatch",
      parameters: null,
      reply_target: null,
      trace_id: "trace-003",
      workflow: "dispatch",
      raw_message_ref: "msg-003",
      text: null,
    },
    serviceResult: {
      status: "ok",
      result_kind: "accepted",
      summary: "Dispatch accepted for demo-acr",
      reply_payload: "Accepted dispatch for demo-acr",
      needs_escalation: false,
      escalation_reason: null,
      run_id: "run-003",
      queue_ref: "queue-003",
      artifact_ref: {
        kind: "pull_request",
        label: "PR #42",
        target: "https://example.test/pr/42",
      },
      trace_patch: null,
    },
    now: () => new Date("2026-04-19T12:05:00.000Z"),
  });

  assert.ok(snapshot);

  const filePath = await writeWorkSurfaceProjectionSnapshot({
    snapshot,
    dataDir,
  });

  assert.equal(filePath, workSurfaceProjectionPath("demo-acr", dataDir));

  const stored = await readWorkSurfaceProjectionSnapshot({
    projectId: "demo-acr",
    dataDir,
  });

  assert.ok(stored);
  assert.equal(stored.surface_status, "completed");
  assert.equal(stored.headline, "Completed: dispatch");
  assert.equal(stored.artifact_ref?.label, "PR #42");
});
