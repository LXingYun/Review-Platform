import { getAiConfig } from "./ai-config-service";

const stripUtf8Bom = (value: string) => value.replace(/^\uFEFF/, "");

const stripMarkdownCodeFence = (value: string) =>
  value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

const extractJsonEnvelope = (value: string) => {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return value;
  }

  return value.slice(start, end + 1);
};

const normalizeSmartQuoteDelimiters = (value: string) =>
  value
    .replace(/([{,]\s*)[“”]([^“”]+?)[“”](\s*:)/g, '$1"$2"$3')
    .replace(/([:\[,]\s*)[“”]/g, '$1"')
    .replace(/[“”](\s*[,}\]])/g, '"$1')
    .replace(/"\s*：/g, '":');

const unique = <T>(values: T[]) => Array.from(new Set(values));

export const parseStructuredJsonContent = <T>(content: string): T => {
  const cleaned = stripUtf8Bom(content).trim();
  const fenceStripped = stripMarkdownCodeFence(cleaned);
  const jsonEnvelope = extractJsonEnvelope(fenceStripped);
  const normalizedQuotes = normalizeSmartQuoteDelimiters(jsonEnvelope);
  const normalizedFence = normalizeSmartQuoteDelimiters(fenceStripped);

  const attempts = unique([
    cleaned,
    fenceStripped,
    jsonEnvelope,
    normalizedFence,
    normalizedQuotes,
  ]).filter(Boolean);

  let lastError: unknown = null;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI 返回内容无法解析为 JSON");
};

const requestChatCompletion = async (params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}) => {
  const response = await fetch(`${params.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`AI 请求失败: ${payload}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI 返回为空");
  }

  return content;
};

const repairStructuredJson = async <T>(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  rawContent: string;
}) => {
  const repairedContent = await requestChatCompletion({
    apiKey: params.apiKey,
    baseUrl: params.baseUrl,
    model: params.model,
    systemPrompt: [
      "你是 JSON 修复助手。",
      "请把用户提供的内容修复成合法 JSON。",
      "不得添加解释，不得改变字段语义，只返回 JSON。",
    ].join("\n"),
    userPrompt: params.rawContent,
  });

  return parseStructuredJsonContent<T>(repairedContent);
};

export const requestStructuredAiReview = async <T>(params: {
  systemPrompt: string;
  userPrompt: string;
}): Promise<T> => {
  const config = getAiConfig();

  if (!config.enabled || !config.apiKey) {
    throw new Error("AI 服务未配置 OPENAI_API_KEY");
  }

  const content = await requestChatCompletion({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
  });

  try {
    return parseStructuredJsonContent<T>(content);
  } catch (parseError) {
    try {
      return await repairStructuredJson<T>({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        rawContent: content,
      });
    } catch {
      const snippet = stripUtf8Bom(content).replace(/\s+/g, " ").slice(0, 160);
      throw new Error(
        parseError instanceof Error
          ? `${parseError.message}: ${snippet}`
          : `AI 返回了非 JSON 内容: ${snippet}`,
      );
    }
  }
};
