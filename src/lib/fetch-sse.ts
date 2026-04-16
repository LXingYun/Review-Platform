import { ApiRequestError } from "./api";

export interface FetchSseEvent {
  event: string;
  data: string;
}

export interface FetchSseOptions {
  url: string;
  token?: string | null;
  signal?: AbortSignal;
  onOpen?: (response: Response) => void;
  onEvent: (event: FetchSseEvent) => void;
}

const parseLine = (
  line: string,
  onEvent: (event: FetchSseEvent) => void,
  state: { event: string; data: string[] },
) => {
  if (line === "") {
    if (state.data.length > 0) {
      onEvent({
        event: state.event || "message",
        data: state.data.join("\n"),
      });
    }
    state.event = "message";
    state.data = [];
    return;
  }

  if (line.startsWith(":")) {
    return;
  }

  const separatorIndex = line.indexOf(":");
  const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
  let value = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : "";
  if (value.startsWith(" ")) {
    value = value.slice(1);
  }

  if (field === "event") {
    state.event = value || "message";
    return;
  }

  if (field === "data") {
    state.data.push(value);
  }
};

export const fetchSse = async (options: FetchSseOptions) => {
  const response = await fetch(options.url, {
    method: "GET",
    headers: options.token ? { Authorization: `Bearer ${options.token}` } : {},
    signal: options.signal,
  });

  if (!response.ok) {
    throw new ApiRequestError("SSE request failed", { status: response.status });
  }

  if (!response.body) {
    throw new ApiRequestError("SSE response stream missing");
  }

  options.onOpen?.(response);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const state = { event: "message", data: [] as string[] };
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let lineBreakIndex = buffer.indexOf("\n");
    while (lineBreakIndex >= 0) {
      const rawLine = buffer.slice(0, lineBreakIndex);
      buffer = buffer.slice(lineBreakIndex + 1);
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
      parseLine(line, options.onEvent, state);
      lineBreakIndex = buffer.indexOf("\n");
    }
  }

  if (buffer.length > 0) {
    parseLine(buffer, options.onEvent, state);
  }
  parseLine("", options.onEvent, state);
};
