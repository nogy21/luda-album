export const MAX_EVENT_NAME_COUNT = 5;
export const MAX_EVENT_NAME_LENGTH = 30;

const collapseWhitespace = (value: string) => {
  return value.replace(/\s+/g, " ").trim();
};

export const normalizeEventName = (value: string) => {
  return collapseWhitespace(value).toLowerCase();
};

export const normalizeEventLabel = (value: string) => {
  return collapseWhitespace(value);
};

export const sanitizeEventNames = (names: string[]) => {
  const unique = new Set<string>();
  const sanitized: string[] = [];

  for (const raw of names) {
    const label = normalizeEventLabel(raw);

    if (!label) {
      continue;
    }

    if (label.length > MAX_EVENT_NAME_LENGTH) {
      continue;
    }

    const normalized = normalizeEventName(label);

    if (unique.has(normalized)) {
      continue;
    }

    unique.add(normalized);
    sanitized.push(label);

    if (sanitized.length >= MAX_EVENT_NAME_COUNT) {
      break;
    }
  }

  return sanitized;
};

export const parseEventNamesPayload = (value: unknown) => {
  if (value === undefined) {
    return { eventNames: undefined as string[] | undefined };
  }

  if (!Array.isArray(value)) {
    return { error: "eventNames는 문자열 배열이어야 해요." };
  }

  const unique = new Set<string>();
  const eventNames: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") {
      return { error: "eventNames 항목은 문자열이어야 해요." };
    }

    const label = normalizeEventLabel(entry);

    if (!label) {
      return { error: "eventNames 항목은 비워둘 수 없어요." };
    }

    if (label.length > MAX_EVENT_NAME_LENGTH) {
      return { error: `이벤트명은 ${MAX_EVENT_NAME_LENGTH}자 이하여야 해요.` };
    }

    const normalized = normalizeEventName(label);

    if (unique.has(normalized)) {
      continue;
    }

    if (eventNames.length >= MAX_EVENT_NAME_COUNT) {
      return { error: `eventNames는 최대 ${MAX_EVENT_NAME_COUNT}개까지 입력할 수 있어요.` };
    }

    unique.add(normalized);
    eventNames.push(label);
  }

  return { eventNames };
};
