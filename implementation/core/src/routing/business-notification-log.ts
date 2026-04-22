import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { BusinessNotificationRecord } from "../types.ts";

function sanitizeProjectId(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function notificationRoot(dataDir?: string): string {
  const root =
    dataDir ??
    process.env.OPENCLAW_PLUGIN_DATA_DIR ??
    process.env.OPENCLAW_DATA_DIR ??
    path.resolve(process.cwd(), ".local");

  return path.join(root, "assistant-context-router", "business-notifications");
}

export function businessNotificationLogPath(projectId: string, dataDir?: string): string {
  return path.join(notificationRoot(dataDir), `${sanitizeProjectId(projectId)}.jsonl`);
}

export async function appendBusinessNotificationRecord(input: {
  record: BusinessNotificationRecord;
  dataDir?: string;
}): Promise<string> {
  const filePath = businessNotificationLogPath(input.record.project_id, input.dataDir);
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(input.record)}\n`, "utf8");
  return filePath;
}

export async function readBusinessNotificationRecords(input: {
  projectId: string;
  dataDir?: string;
}): Promise<BusinessNotificationRecord[]> {
  const filePath = businessNotificationLogPath(input.projectId, input.dataDir);
  try {
    const raw = await readFile(filePath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as BusinessNotificationRecord);
  } catch {
    return [];
  }
}
