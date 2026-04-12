import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseStructuredJsonContent, requestStructuredAiReview } from "../../server/services/ai-client-service";

describe("parseStructuredJsonContent", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalApiKeys = process.env.OPENAI_API_KEYS;
  const originalBaseUrl = process.env.OPENAI_BASE_URL;
  const originalModel = process.env.OPENAI_MODEL;
  const originalRetryBaseDelay = process.env.AI_RETRY_BASE_DELAY_MS;
  const originalRetryMaxAttempts = process.env.AI_RETRY_MAX_ATTEMPTS;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }

    if (originalApiKeys === undefined) {
      delete process.env.OPENAI_API_KEYS;
    } else {
      process.env.OPENAI_API_KEYS = originalApiKeys;
    }

    if (originalBaseUrl === undefined) {
      delete process.env.OPENAI_BASE_URL;
    } else {
      process.env.OPENAI_BASE_URL = originalBaseUrl;
    }

    if (originalModel === undefined) {
      delete process.env.OPENAI_MODEL;
    } else {
      process.env.OPENAI_MODEL = originalModel;
    }

    if (originalRetryBaseDelay === undefined) {
      delete process.env.AI_RETRY_BASE_DELAY_MS;
    } else {
      process.env.AI_RETRY_BASE_DELAY_MS = originalRetryBaseDelay;
    }

    if (originalRetryMaxAttempts === undefined) {
      delete process.env.AI_RETRY_MAX_ATTEMPTS;
    } else {
      process.env.AI_RETRY_MAX_ATTEMPTS = originalRetryMaxAttempts;
    }
  });

  it("parses valid JSON content", () => {
    expect(
      parseStructuredJsonContent<{ findings: string[] }>('{"findings":["ok"]}'),
    ).toEqual({ findings: ["ok"] });
  });

  it("parses JSON wrapped in markdown fences", () => {
    expect(
      parseStructuredJsonContent<{ findings: Array<{ title: string }> }>([
        "```json",
        '{ "findings": [{ "title": "章节问题" }] }',
        "```",
      ].join("\n")),
    ).toEqual({ findings: [{ title: "章节问题" }] });
  });

  it("normalizes smart-quote JSON delimiters", () => {
    expect(
      parseStructuredJsonContent<{ findings: Array<{ title: string; risk: string }> }>([
        "{",
        '  "findings": [',
        "    {",
        '      "title": “人员、设备、资金等方面具有相应的施工能力表述较为原则”,',
        '      "risk": “中”',
        "    }",
        "  ]",
        "}",
      ].join("\n")),
    ).toEqual({
      findings: [
        {
          title: "人员、设备、资金等方面具有相应的施工能力表述较为原则",
          risk: "中",
        },
      ],
    });
  });

  it("retries after a 429 and calls onRetry with rate-limit metadata", async () => {
    process.env.OPENAI_API_KEYS = "k1,k2";
    delete process.env.OPENAI_API_KEY;
    process.env.OPENAI_BASE_URL = "https://example.test/v1";
    process.env.OPENAI_MODEL = "test-model";
    process.env.AI_RETRY_BASE_DELAY_MS = "1";
    process.env.AI_RETRY_MAX_ATTEMPTS = "3";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          headers: { "retry-after": "0" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    findings: [],
                  }),
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const retryEvents: Array<{ rateLimited: boolean; statusCode?: number }> = [];

    const result = await requestStructuredAiReview<{ findings: unknown[] }>({
      systemPrompt: "system",
      userPrompt: "user",
      onRetry: (event) => {
        retryEvents.push({
          rateLimited: event.rateLimited,
          statusCode: event.statusCode,
        });
      },
    });

    expect(result).toEqual({ findings: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retryEvents).toEqual([{ rateLimited: true, statusCode: 429 }]);
  });
});
