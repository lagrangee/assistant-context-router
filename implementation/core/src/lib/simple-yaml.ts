function stripComment(line: string): string {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (char === "#" && !inSingle && !inDouble) {
      if (i === 0 || /\s/.test(line[i - 1])) {
        return line.slice(0, i).trimEnd();
      }
    }
  }

  return line;
}

function scalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "") {
    return "";
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (trimmed === "null") {
    return null;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed;
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function cleanedLines(input: string): string[] {
  return input
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => stripComment(line))
    .filter((line) => line.trim() !== "");
}

function nextChildIndent(lines: string[], start: number, parentIndent: number): number | null {
  for (let i = start; i < lines.length; i += 1) {
    const indent = indentOf(lines[i]);
    if (indent > parentIndent) {
      return indent;
    }
    if (indent <= parentIndent) {
      return null;
    }
  }
  return null;
}

function parseBlock(
  lines: string[],
  startIndex: number,
  indent: number,
): [unknown, number] {
  const first = lines[startIndex].trim();
  if (first.startsWith("- ")) {
    return parseSequence(lines, startIndex, indent);
  }
  return parseMapping(lines, startIndex, indent);
}

function parseSequence(
  lines: string[],
  startIndex: number,
  indent: number,
): [unknown[], number] {
  const sequence: unknown[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    const currentIndent = indentOf(line);
    const trimmed = line.trim();
    if (currentIndent !== indent || !trimmed.startsWith("- ")) {
      break;
    }

    const rest = trimmed.slice(2).trim();
    if (rest === "") {
      const childIndent = nextChildIndent(lines, index + 1, indent);
      if (childIndent === null) {
        sequence.push("");
        index += 1;
      } else {
        const [child, next] = parseBlock(lines, index + 1, childIndent);
        sequence.push(child);
        index = next;
      }
      continue;
    }

    const keyValueIndex = rest.indexOf(":");
    const looksLikeInlineMap =
      keyValueIndex > 0 && /^[A-Za-z0-9_-]+:\s*/.test(rest);

    if (!looksLikeInlineMap) {
      sequence.push(scalar(rest));
      index += 1;
      continue;
    }

    const key = rest.slice(0, keyValueIndex).trim();
    const valuePart = rest.slice(keyValueIndex + 1).trim();
    const item: Record<string, unknown> = {};

    if (valuePart === "") {
      const childIndent = nextChildIndent(lines, index + 1, indent);
      if (childIndent === null) {
        item[key] = "";
        index += 1;
      } else {
        const [child, next] = parseBlock(lines, index + 1, childIndent);
        item[key] = child;
        index = next;
      }
    } else {
      item[key] = scalar(valuePart);
      index += 1;
    }

    while (index < lines.length) {
      const nextLine = lines[index];
      const nextIndent = indentOf(nextLine);
      const nextTrimmed = nextLine.trim();
      if (nextIndent !== indent + 2 || nextTrimmed.startsWith("- ")) {
        break;
      }

      const separator = nextTrimmed.indexOf(":");
      if (separator < 1) {
        break;
      }

      const childKey = nextTrimmed.slice(0, separator).trim();
      const childValuePart = nextTrimmed.slice(separator + 1).trim();
      if (childValuePart === "") {
        const childIndent = nextChildIndent(lines, index + 1, nextIndent);
        if (childIndent === null) {
          item[childKey] = "";
          index += 1;
        } else {
          const [childValue, next] = parseBlock(lines, index + 1, childIndent);
          item[childKey] = childValue;
          index = next;
        }
      } else {
        item[childKey] = scalar(childValuePart);
        index += 1;
      }
    }

    sequence.push(item);
  }

  return [sequence, index];
}

function parseMapping(
  lines: string[],
  startIndex: number,
  indent: number,
): [Record<string, unknown>, number] {
  const mapping: Record<string, unknown> = {};
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    const currentIndent = indentOf(line);
    if (currentIndent !== indent) {
      break;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      break;
    }

    const separator = trimmed.indexOf(":");
    if (separator < 1) {
      index += 1;
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const valuePart = trimmed.slice(separator + 1).trim();
    if (valuePart === "") {
      const childIndent = nextChildIndent(lines, index + 1, currentIndent);
      if (childIndent === null) {
        mapping[key] = "";
        index += 1;
      } else {
        const [child, next] = parseBlock(lines, index + 1, childIndent);
        mapping[key] = child;
        index = next;
      }
    } else {
      mapping[key] = scalar(valuePart);
      index += 1;
    }
  }

  return [mapping, index];
}

export function parseSimpleYaml<T = Record<string, unknown>>(input: string): T {
  const lines = cleanedLines(input);
  if (lines.length === 0) {
    return {} as T;
  }

  const [parsed] = parseBlock(lines, 0, indentOf(lines[0]));
  return parsed as T;
}
