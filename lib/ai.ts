import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { isZeroCostOpenRouterModel } from "@/lib/openrouter-models";

export type AiProvider = "OPENAI" | "OPENROUTER" | "CUSTOM";

export type AiConfiguration = {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
  imageModel?: string;
  systemPrompt?: string;
  zeroCostOnly?: boolean;
  customerPortalEnabled?: boolean;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

function trimBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export async function loadAiConfiguration(userId?: string) {
  if (userId) {
    const personal = await db.aiUserSetting.findUnique({ where: { userId } });
    if (personal && !personal.useServerConfig) {
      if (!personal.encryptedJson) throw new Error("Your personal AI configuration is incomplete");
      const value = JSON.parse(decryptSecret(personal.encryptedJson)) as Partial<AiConfiguration>;
      if (!value.provider || !value.apiKey || !value.model || !value.baseUrl) {
        throw new Error("Your personal AI configuration is incomplete");
      }
      return value as AiConfiguration;
    }
  }
  const row = await db.integrationSetting.findUnique({ where: { provider: "AI_ASSISTANT" } });
  if (!row?.enabled || !row.encryptedJson) throw new Error("AI assistant is not configured");
  const value = JSON.parse(decryptSecret(row.encryptedJson)) as Partial<AiConfiguration>;
  if (!value.provider || !value.apiKey || !value.model || !value.baseUrl) {
    throw new Error("AI assistant configuration is incomplete");
  }
  return value as AiConfiguration;
}

export async function aiApiRequest(url: string, apiKey: string, body: unknown, extraHeaders: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const payload = await response.json().catch(() => ({})) as any;
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `AI provider returned HTTP ${response.status}`;
    throw new Error(String(message).slice(0, 500));
  }
  return payload;
}

export async function createAiReply(config: AiConfiguration, systemPrompt: string, messages: ChatMessage[]) {
  if(config.provider==="OPENROUTER"&&config.zeroCostOnly&& !isZeroCostOpenRouterModel(config.model)){
    throw new Error("This account is restricted to zero-cost OpenRouter models. Select openrouter/free or a model ending in :free.");
  }
  if (config.provider === "OPENAI") {
    const payload = await aiApiRequest(
      `${trimBaseUrl(config.baseUrl)}/responses`,
      config.apiKey,
      {
        model: config.model,
        instructions: systemPrompt,
        input: messages.map((message) => ({ role: message.role, content: message.content })),
      },
    );
    const direct = typeof payload.output_text === "string" ? payload.output_text : "";
    const nested = Array.isArray(payload.output)
      ? payload.output.flatMap((item: any) => item?.content || []).map((item: any) => item?.text || "").join("")
      : "";
    const text = (direct || nested).trim();
    if (!text) throw new Error("OpenAI returned an empty response");
    return text;
  }

  const endpoint = `${trimBaseUrl(config.baseUrl)}/chat/completions`;
  const headers: Record<string, string> = config.provider === "OPENROUTER"
    ? {
        "HTTP-Referer": process.env.TITAN_BASE_URL || "http://localhost:1200",
        "X-OpenRouter-Title": "Project TITAN",
      }
    : {};
  const payload = await aiApiRequest(endpoint, config.apiKey, {
    model: config.model,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  }, headers);
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("AI provider returned an empty response");
  return text.trim();
}

export async function createOpenAiImage(
  config: AiConfiguration,
  prompt: string,
  options: { size: string; quality: string },
) {
  if (config.provider !== "OPENAI") throw new Error("Image generation requires the OpenAI provider");
  const payload = await aiApiRequest(
    `${trimBaseUrl(config.baseUrl)}/images/generations`,
    config.apiKey,
    {
      model: config.imageModel || "gpt-image-2",
      prompt,
      n: 1,
      size: options.size,
      quality: options.quality,
      output_format: "png",
    },
  );
  const encoded = payload?.data?.[0]?.b64_json;
  if (typeof encoded !== "string" || !encoded) throw new Error("OpenAI returned no image data");
  return {
    bytes: Buffer.from(encoded, "base64"),
    model: config.imageModel || "gpt-image-2",
    revisedPrompt: payload?.data?.[0]?.revised_prompt as string | undefined,
  };
}

export function defaultBaseUrl(provider: AiProvider) {
  if (provider === "OPENAI") return "https://api.openai.com/v1";
  if (provider === "OPENROUTER") return "https://openrouter.ai/api/v1";
  return "http://host.docker.internal:11434/v1";
}
