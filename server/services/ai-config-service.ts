export const getAiConfig = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  return {
    enabled: Boolean(apiKey),
    apiKey,
    baseUrl,
    model,
  };
};
