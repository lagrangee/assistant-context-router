function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

const OPEN_MARKER = "[ACR_AUTOMATION]";
const CLOSE_MARKER = "[/ACR_AUTOMATION]";

function normalizeAutomationJsonCandidate(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ")
    .trim();
}

function parseAutomationJson(value: string): Record<string, unknown> | null {
  const normalized = normalizeAutomationJsonCandidate(value);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized);
    return asRecord(parsed);
  } catch {
    return null;
  }
}

export interface ParsedAutomationMessage {
  matched: boolean;
  event: Record<string, unknown> | null;
  error: string | null;
  match_source: "wrapper" | "bare_json" | null;
}

function looksLikeAutomationEnvelope(record: Record<string, unknown>): boolean {
  const payloadRecord = asRecord(record.payload);
  const automationRecord = payloadRecord ?? record;

  const sourceType = pickString(
    automationRecord.source_type,
    automationRecord.sourceType,
  );
  if (sourceType === "automation") {
    return true;
  }

  return Boolean(
    pickString(
      automationRecord.project_id,
      automationRecord.projectId,
      automationRecord.project_ref,
      automationRecord.projectRef,
      automationRecord.action_name,
      automationRecord.actionName,
      automationRecord.trace_id,
      automationRecord.traceId,
    ) || asRecord(automationRecord.parameters),
  );
}

function normalizeAutomationEvent(input: {
  parsedRecord: Record<string, unknown>;
  event: Record<string, unknown>;
  ctx?: unknown;
}): Record<string, unknown> {
  const parsedRecord = input.parsedRecord;
  const payloadRecord =
    asRecord(parsedRecord.payload) ??
    ({
      ...parsedRecord,
    } satisfies Record<string, unknown>);

  const normalizedPayload = {
    ...payloadRecord,
    source_type: pickString(payloadRecord.source_type, "automation"),
  };

  const sourceEvent = input.event;
  const ctxRecord = asRecord(input.ctx);
  const channel = pickString(
    parsedRecord.channel,
    sourceEvent.channel,
    sourceEvent.channel_type,
    ctxRecord?.channel,
    ctxRecord?.channel_type,
  );

  return {
    ...parsedRecord,
    ...(channel ? { channel } : {}),
    payload: normalizedPayload,
  };
}

export function parseStructuredAutomationMessage(input: {
  text: string;
  event: Record<string, unknown>;
  ctx?: unknown;
}): ParsedAutomationMessage {
  const text = input.text.trim();
  const openIndex = text.indexOf(OPEN_MARKER);
  if (openIndex === -1) {
    if (!text.startsWith("{")) {
      return {
        matched: false,
        event: null,
        error: null,
        match_source: null,
      };
    }

    const bareRecord = parseAutomationJson(text);
    if (!bareRecord) {
      return {
        matched: false,
        event: null,
        error: null,
        match_source: null,
      };
    }
    if (!looksLikeAutomationEnvelope(bareRecord)) {
      return {
        matched: false,
        event: null,
        error: null,
        match_source: null,
      };
    }

    return {
      matched: true,
      event: normalizeAutomationEvent({
        parsedRecord: bareRecord,
        event: input.event,
        ctx: input.ctx,
      }),
      error: null,
      match_source: "bare_json",
    };
  }

  const closeIndex = text.indexOf(CLOSE_MARKER, openIndex + OPEN_MARKER.length);
  if (closeIndex === -1) {
    return {
      matched: true,
      event: null,
      error: "missing_protocol_closer",
      match_source: "wrapper",
    };
  }

  const inner = text
    .slice(openIndex + OPEN_MARKER.length, closeIndex)
    .trim();
  if (!inner) {
    return {
      matched: true,
      event: null,
      error: "empty_protocol_payload",
      match_source: "wrapper",
    };
  }

  const parsedRecord = parseAutomationJson(inner);
  if (!parsedRecord) {
    return {
      matched: true,
      event: null,
      error: "invalid_protocol_json",
      match_source: "wrapper",
    };
  }

  return {
    matched: true,
    event: normalizeAutomationEvent({
      parsedRecord,
      event: input.event,
      ctx: input.ctx,
    }),
    error: null,
    match_source: "wrapper",
  };
}
