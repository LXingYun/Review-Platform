import { getAiConfig } from "./ai-config-service";

export const requestStructuredAiReview = async <T>(params: {
  systemPrompt: string;
  userPrompt: string;
}): Promise<T> => {
  const config = getAiConfig();

  if (!config.enabled || !config.apiKey) {
    throw new Error("AI 服务未配置 OPENAI_API_KEY");
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
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

  return JSON.parse(content) as T;
};
