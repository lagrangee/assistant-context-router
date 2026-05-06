function pickTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const AUTOMATION_OPEN_MARKER = "[ACR_AUTOMATION]";
const AUTOMATION_CLOSE_MARKER = "[/ACR_AUTOMATION]";

interface IngressTextResolutionInput {
  event: Record<string, unknown>;
  ctx?: unknown;
}

type HostTextExtractor = (text: string) => string | null;

function extractAutomationTextFromFeishuRichPostRecord(value: unknown): string | null {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  if (!record) {
    return null;
  }

  const rows = Array.isArray(record.elements) ? record.elements : null;
  if (rows) {
    for (const row of rows) {
      if (!Array.isArray(row)) {
        continue;
      }
      for (const element of row) {
        const cell = element && typeof element === "object" ? (element as Record<string, unknown>) : null;
        if (!cell) {
          continue;
        }
        if (
          cell.tag === "text" &&
          typeof cell.text === "string" &&
          cell.text.includes(AUTOMATION_OPEN_MARKER) &&
          cell.text.includes(AUTOMATION_CLOSE_MARKER)
        ) {
          return cell.text;
        }
      }
    }
  }

  if (typeof record.user_dsl === "string" && record.user_dsl.trim()) {
    try {
      const parsedDsl = JSON.parse(record.user_dsl) as Record<string, unknown>;
      const elements = Array.isArray(parsedDsl.elements) ? parsedDsl.elements : null;
      if (elements) {
        for (const element of elements) {
          const dslElement =
            element && typeof element === "object" ? (element as Record<string, unknown>) : null;
          if (
            dslElement &&
            typeof dslElement.content === "string" &&
            dslElement.content.includes(AUTOMATION_OPEN_MARKER) &&
            dslElement.content.includes(AUTOMATION_CLOSE_MARKER)
          ) {
            return dslElement.content;
          }
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}

function extractFeishuMessageIdPrefix(text: string): string | null {
  const trimmed = text.trim();
  const lines = trimmed.split("\n");
  if (trimmed.startsWith("[message_id:") && lines.length > 1) {
    return lines.slice(1).join("\n");
  }
  return null;
}

function extractFeishuSenderRichPostEnvelope(text: string): string | null {
  const trimmed = text.trim();
  const senderRichPostMatch = trimmed.match(/^ou_[^:]+:\s*(\{[\s\S]*\})$/);
  return senderRichPostMatch?.[1] ?? null;
}

function extractJsonTextEnvelope(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof parsed.text === "string" && parsed.text.trim()) {
      return parsed.text;
    }
  } catch {
    return null;
  }

  return null;
}

function extractFeishuRichPostEnvelope(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return extractAutomationTextFromFeishuRichPostRecord(parsed);
  } catch {
    return null;
  }
}

const hostTextExtractors: HostTextExtractor[] = [
  extractFeishuMessageIdPrefix,
  extractFeishuSenderRichPostEnvelope,
  extractJsonTextEnvelope,
  extractFeishuRichPostEnvelope,
];

function unwrapHostTextEnvelope(rawText: string): string {
  let current = rawText.trim();
  const seen = new Set<string>();

  while (current && !seen.has(current)) {
    seen.add(current);
    let next: string | null = null;
    for (const extractor of hostTextExtractors) {
      const extracted = extractor(current);
      const trimmed = typeof extracted === "string" ? extracted.trim() : "";
      if (trimmed && trimmed !== current) {
        next = trimmed;
        break;
      }
    }

    if (!next) {
      return current;
    }
    current = next;
  }

  return current;
}

export function resolveIngressMessageText(input: IngressTextResolutionInput): string {
  const messageRecord =
    input.event.message && typeof input.event.message === "object"
      ? (input.event.message as Record<string, unknown>)
      : null;
  const payloadRecord =
    input.event.payload && typeof input.event.payload === "object"
      ? (input.event.payload as Record<string, unknown>)
      : null;
  const ctxRecord =
    input.ctx && typeof input.ctx === "object" ? (input.ctx as Record<string, unknown>) : null;

  const candidates = [
    input.event.text,
    input.event.body,
    input.event.content,
    input.event.input,
    input.event.rawText,
    input.event.commandBody,
    typeof input.event.message === "string" ? input.event.message : undefined,
    messageRecord?.text,
    messageRecord?.body,
    messageRecord?.content,
    payloadRecord?.text,
    payloadRecord?.body,
    payloadRecord?.content,
    ctxRecord?.text,
    ctxRecord?.body,
    ctxRecord?.content,
    ctxRecord?.input,
    ctxRecord?.commandBody,
  ];

  for (const value of candidates) {
    const text = pickTrimmedString(value);
    if (text) {
      return unwrapHostTextEnvelope(text);
    }
  }

  return "";
}
