import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { buildNormalizedLarkCliEnv } from "./lark-cli-env.ts";

const execFileAsync = promisify(execFile);

export interface LarkCliTable {
  table_id: string;
  name: string;
  [key: string]: unknown;
}

export interface LarkCliField {
  field_id?: string;
  field_name: string;
  type?: number;
  property?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LarkCliRecord {
  record_id: string;
  fields: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LarkCliRunner {
  run(args: string[]): Promise<unknown>;
}

export interface LarkCliBaseClientOptions {
  baseToken: string;
  identity?: "bot" | "user";
  cliBin?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  runner?: LarkCliRunner;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeTable(value: unknown): LarkCliTable | null {
  const objectValue = asObject(value);
  if (!objectValue) {
    return null;
  }

  const tableId = objectValue.table_id ?? objectValue.id;
  const name = objectValue.name;
  if (typeof tableId !== "string" || typeof name !== "string") {
    return null;
  }

  return {
    ...objectValue,
    table_id: tableId,
    name,
  };
}

function normalizeField(value: unknown): LarkCliField | null {
  const objectValue = asObject(value);
  if (!objectValue) {
    return null;
  }

  const fieldName = objectValue.field_name ?? objectValue.name;
  if (typeof fieldName !== "string") {
    return null;
  }

  return {
    ...objectValue,
    field_id:
      typeof objectValue.field_id === "string"
        ? objectValue.field_id
        : typeof objectValue.id === "string"
          ? objectValue.id
          : undefined,
    field_name: fieldName,
  };
}

function normalizeRecord(value: unknown): LarkCliRecord | null {
  const objectValue = asObject(value);
  if (!objectValue) {
    return null;
  }

  const recordId = objectValue.record_id ?? objectValue.id;
  const fields = asObject(objectValue.fields);
  if (typeof recordId !== "string" || !fields) {
    return null;
  }

  return {
    ...objectValue,
    record_id: recordId,
    fields,
  };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asTables(value: unknown): LarkCliTable[] {
  if (Array.isArray(value)) {
    return value.map(normalizeTable).filter((item): item is LarkCliTable => item !== null);
  }

  const objectValue = asObject(value);
  if (!objectValue) {
    return [];
  }

  const candidates = [
    objectValue.items,
    objectValue.tables,
    asObject(objectValue.data)?.items,
    asObject(objectValue.data)?.tables,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    return candidate
      .map(normalizeTable)
      .filter((item): item is LarkCliTable => item !== null);
  }

  return [];
}

function asFields(value: unknown): LarkCliField[] {
  if (Array.isArray(value)) {
    return value.map(normalizeField).filter((item): item is LarkCliField => item !== null);
  }

  const objectValue = asObject(value);
  if (!objectValue) {
    return [];
  }

  const candidates = [
    objectValue.items,
    objectValue.fields,
    asObject(objectValue.data)?.items,
    asObject(objectValue.data)?.fields,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    return candidate
      .map(normalizeField)
      .filter((item): item is LarkCliField => item !== null);
  }

  return [];
}

function asRecords(value: unknown): LarkCliRecord[] {
  if (Array.isArray(value)) {
    return value.map(normalizeRecord).filter((item): item is LarkCliRecord => item !== null);
  }

  const objectValue = asObject(value);
  if (!objectValue) {
    return [];
  }

  const itemCandidates = [
    objectValue.items,
    asObject(objectValue.data)?.items,
  ];

  for (const candidate of itemCandidates) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    return candidate
      .map(normalizeRecord)
      .filter((item): item is LarkCliRecord => item !== null);
  }

  const rows = asArray(objectValue.data);
  const fields = asArray(objectValue.fields).map((field) => String(field));
  const recordIds = asArray(objectValue.record_id_list).map((recordId) => String(recordId));

  if (rows.length === 0 || fields.length === 0 || recordIds.length === 0) {
    return [];
  }

  return rows
    .map((row, index) => {
      const values = Array.isArray(row) ? row : [];
      const recordId = recordIds[index];
      if (!recordId) {
        return null;
      }

      const recordFields = Object.fromEntries(
        fields.map((fieldName, fieldIndex) => [fieldName, values[fieldIndex]]),
      );

      return {
        record_id: recordId,
        fields: recordFields,
      } satisfies LarkCliRecord;
    })
    .filter((item): item is LarkCliRecord => item !== null);
}

function asRecord(value: unknown, fallbackRecordId?: string | null): LarkCliRecord | null {
  const normalized = normalizeRecord(value);
  if (normalized) {
    return normalized;
  }

  const objectValue = asObject(value);
  if (!objectValue) {
    return null;
  }

  const recordCandidate = objectValue.record;
  const normalizedRecord = normalizeRecord(recordCandidate);
  if (normalizedRecord) {
    return normalizedRecord;
  }

  const fields =
    asObject(recordCandidate) ??
    asObject(objectValue.fields) ??
    (fallbackRecordId && !("record" in objectValue) ? objectValue : null);
  if (!fallbackRecordId || !fields) {
    return null;
  }

  return {
    record_id: fallbackRecordId,
    fields,
  };
}

function unwrapCliPayload(value: unknown): unknown {
  const objectValue = asObject(value);
  if (!objectValue) {
    return value;
  }

  if (objectValue.ok === false) {
    const error = asObject(objectValue.error);
    throw new Error(
      `lark-cli-error:${String(error?.type ?? "unknown")}:${String(error?.message ?? "unknown")}`,
    );
  }

  return objectValue.data ?? objectValue;
}

function parseJsonOutput(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      `lark-cli-invalid-json:${error instanceof Error ? error.message : "unknown"}`,
    );
  }
}

export function createExecFileLarkCliRunner(input: {
  cliBin?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
} = {}): LarkCliRunner {
  const cliBin = input.cliBin ?? "lark-cli";

  return {
    async run(args: string[]): Promise<unknown> {
      const { stdout } = await execFileAsync(cliBin, args, {
        cwd: input.cwd,
        env: buildNormalizedLarkCliEnv(input.env),
      });
      return parseJsonOutput(stdout);
    },
  };
}

export function createLarkCliBaseClient(options: LarkCliBaseClientOptions) {
  const runner =
    options.runner ??
    createExecFileLarkCliRunner({
      cliBin: options.cliBin,
      cwd: options.cwd,
      env: options.env,
    });

  const identity = options.identity ?? "bot";

  async function execute(args: string[]): Promise<unknown> {
    return unwrapCliPayload(await runner.run(args));
  }

  function baseArgs(command: string, extraArgs: string[] = []): string[] {
    return [
      "base",
      command,
      "--base-token",
      options.baseToken,
      "--as",
      identity,
      ...extraArgs,
    ];
  }

  return {
    async listTables(): Promise<LarkCliTable[]> {
      return asTables(await execute(baseArgs("+table-list")));
    },

    async listFields(tableIdOrName: string): Promise<LarkCliField[]> {
      return asFields(
        await execute(baseArgs("+field-list", ["--table-id", tableIdOrName])),
      );
    },

    async listRecords(tableIdOrName: string, limit = 500): Promise<LarkCliRecord[]> {
      return asRecords(
        await execute(
          baseArgs("+record-list", ["--table-id", tableIdOrName, "--limit", String(limit)]),
        ),
      );
    },

    async getRecord(
      tableIdOrName: string,
      recordId: string,
    ): Promise<LarkCliRecord | null> {
      return asRecord(
        await execute(
          baseArgs("+record-get", [
            "--table-id",
            tableIdOrName,
            "--record-id",
            recordId,
          ]),
        ),
        recordId,
      );
    },

    async upsertRecord(input: {
      tableIdOrName: string;
      recordId?: string | null;
      fields: Record<string, unknown>;
    }): Promise<unknown> {
      const args = baseArgs("+record-upsert", [
        "--table-id",
        input.tableIdOrName,
        "--json",
        JSON.stringify(input.fields),
      ]);

      if (input.recordId) {
        args.push("--record-id", input.recordId);
      }

      return execute(args);
    },
  };
}
