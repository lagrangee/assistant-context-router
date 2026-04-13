import test from "node:test";
import assert from "node:assert/strict";

import { createSessionProjectStore } from "../src/state/session-project-store.ts";
import { createRouteTrace } from "../src/trace/route-trace.ts";
import { makeTempProjectWorkspace } from "./test-helpers.ts";

test("session store isolates state by session key", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:a", {
    current_project_id: "proj-one",
    selected_via: "manual",
    selected_at: "2026-04-04T00:00:00.000Z",
    last_route_trace: createRouteTrace({
      resolvedProjectId: "proj-one",
      routeSource: "manual",
      reason: "manual",
      timestamp: "2026-04-04T00:00:00.000Z",
    }),
  });

  await store.set("session:b", {
    current_project_id: "proj-two",
    selected_via: "binding",
    selected_at: "2026-04-04T00:00:00.000Z",
  });

  const a = await store.get("session:a");
  const b = await store.get("session:b");

  assert.equal(a?.current_project_id, "proj-one");
  assert.equal(b?.current_project_id, "proj-two");
});

test("session store prunes expired records during read", async () => {
  const workspace = await makeTempProjectWorkspace();
  let current = new Date("2026-04-04T00:00:00.000Z");
  const store = createSessionProjectStore({
    dataDir: workspace.dataDir,
    ttlMs: 1000,
    now: () => current,
  });

  await store.set("session:ttl", {
    current_project_id: "proj-sample",
    selected_via: "manual",
    selected_at: current.toISOString(),
  });

  current = new Date("2026-04-04T00:00:02.000Z");
  const result = await store.get("session:ttl");
  assert.equal(result, null);
});

test("session store invalidate clears current project while keeping trace", async () => {
  const workspace = await makeTempProjectWorkspace();
  const store = createSessionProjectStore({ dataDir: workspace.dataDir });

  await store.set("session:invalidate", {
    current_project_id: "proj-sample",
    selected_via: "manual",
    selected_at: "2026-04-04T00:00:00.000Z",
  });

  const next = await store.invalidate("session:invalidate", {
    last_route_trace: createRouteTrace({
      resolvedProjectId: "unresolved",
      routeSource: "unresolved",
      reason: "invalid binding",
      safeFail: true,
      timestamp: "2026-04-04T00:00:01.000Z",
    }),
  });

  assert.equal(next.current_project_id, null);
  assert.equal(next.last_route_trace?.safe_fail, true);
});

test("metadata adapter boundary is honored when provided", async () => {
  let storedProjectId: string | null = null;
  const store = createSessionProjectStore({
    metadataAdapter: {
      async get() {
        return storedProjectId
          ? {
              current_project_id: storedProjectId,
              selected_at: "2026-04-04T00:00:00.000Z",
              selected_via: "manual",
              current_workflow: null,
              updated_at: "2026-04-04T00:00:00.000Z",
              expires_at: "2026-04-11T00:00:00.000Z",
              last_route_trace: null,
              pending_save_draft: null,
            }
          : null;
      },
      async set(_sessionKey, patch) {
        storedProjectId = patch.current_project_id ?? null;
        return {
          current_project_id: storedProjectId,
          selected_at: patch.selected_at ?? "2026-04-04T00:00:00.000Z",
          selected_via: patch.selected_via ?? "manual",
          current_workflow: patch.current_workflow ?? null,
          updated_at: patch.updated_at ?? "2026-04-04T00:00:00.000Z",
          expires_at: patch.expires_at ?? "2026-04-11T00:00:00.000Z",
          last_route_trace: patch.last_route_trace ?? null,
          pending_save_draft: patch.pending_save_draft ?? null,
        };
      },
      async clear() {
        storedProjectId = null;
      },
    },
  });

  await store.set("session:adapter", {
    current_project_id: "proj-via-adapter",
    selected_via: "manual",
  });

  const result = await store.get("session:adapter");
  assert.equal(result?.current_project_id, "proj-via-adapter");
});
