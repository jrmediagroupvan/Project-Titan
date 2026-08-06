import type { AiConfiguration } from "@/lib/ai";
import { aiApiRequest } from "@/lib/ai";
import type { AiActor, AiToolDefinition, AiToolMode } from "@/lib/ai-tools";
import { buildAiTools, executeAiTool } from "@/lib/ai-tools";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Citation = { title: string; url: string };
export type AiAgentReply = { text: string; citations: Citation[]; toolsUsed: string[] };

const trimBaseUrl = (value: string) => value.replace(/\/+$/, "");

function safeArguments(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function responseText(payload: any) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  return (Array.isArray(payload?.output) ? payload.output : [])
    .filter((item: any) => item?.type === "message")
    .flatMap((item: any) => item?.content || [])
    .filter((item: any) => item?.type === "output_text")
    .map((item: any) => item?.text || "")
    .join("")
    .trim();
}

function responseCitations(payload: any): Citation[] {
  const unique = new Map<string, Citation>();
  for (const output of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(output?.content) ? output.content : []) {
      for (const annotation of Array.isArray(content?.annotations) ? content.annotations : []) {
        if (annotation?.type === "url_citation" && typeof annotation.url === "string") {
          unique.set(annotation.url, { title: String(annotation.title || annotation.url).slice(0, 200), url: annotation.url });
        }
      }
    }
  }
  return [...unique.values()].slice(0, 12);
}

export function isToolCompatibilityError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /tool(?:s| use| calling)?(?:\s|_|-)*(?:unsupported|not supported|unavailable)|does not support (?:tool|function)|no endpoints? found.*(?:tool|parameter)|unsupported parameter.*(?:tool|tool_choice)|(?:tool|tool_choice).*(?:unsupported|not supported)/i.test(message);
}

async function openAiAgent(
  config: AiConfiguration,
  actor: AiActor,
  conversationId: string,
  instructions: string,
  messages: ChatMessage[],
  tools: AiToolDefinition[],
  nativeWebSearch: boolean,
): Promise<AiAgentReply> {
  const input: any[] = messages.map(message => ({
    role: message.role,
    content: [{ type: "input_text", text: message.content }],
  }));
  const declaredTools: any[] = [...tools];
  if (nativeWebSearch) declaredTools.push({ type: "web_search", external_web_access: true });
  const used = new Set<string>();
  let citations: Citation[] = [];

  for (let turn = 0; turn < 8; turn++) {
    const payload = await aiApiRequest(`${trimBaseUrl(config.baseUrl)}/responses`, config.apiKey, {
      model: config.model,
      instructions,
      input,
      tools: declaredTools,
      tool_choice: "auto",
      include: nativeWebSearch ? ["web_search_call.action.sources"] : undefined,
    });
    citations = [...citations, ...responseCitations(payload)];
    const calls = (Array.isArray(payload?.output) ? payload.output : [])
      .filter((item: any) => item?.type === "function_call");
    if (!calls.length) {
      const finalText = responseText(payload);
      if (!finalText) throw new Error("OpenAI returned an empty response");
      if (nativeWebSearch && (payload.output || []).some((item: any) => item?.type === "web_search_call")) used.add("web_search");
      return { text: finalText, citations: [...new Map(citations.map(item => [item.url, item])).values()], toolsUsed: [...used] };
    }
    input.push(...payload.output);
    for (const call of calls) {
      const name = String(call.name || "");
      used.add(name);
      let output: unknown;
      try {
        output = await executeAiTool(actor, conversationId, name, safeArguments(call.arguments));
      } catch (error) {
        output = { error: error instanceof Error ? error.message : "Tool failed" };
      }
      input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(output) });
    }
  }
  throw new Error("TITAN AI reached its tool-call safety limit");
}

async function compatibleAgent(
  config: AiConfiguration,
  actor: AiActor,
  conversationId: string,
  instructions: string,
  messages: ChatMessage[],
  tools: AiToolDefinition[],
): Promise<AiAgentReply> {
  const endpoint = `${trimBaseUrl(config.baseUrl)}/chat/completions`;
  const headers: Record<string,string> = config.provider === "OPENROUTER"
    ? { "HTTP-Referer": process.env.TITAN_BASE_URL || "http://localhost:1200", "X-OpenRouter-Title": "Project TITAN" }
    : {};
  const chat: any[] = [{ role: "system", content: instructions }, ...messages];
  const declaredTools = tools.map(tool => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
  const used = new Set<string>();

  for (let turn = 0; turn < 8; turn++) {
    let payload;
    try {
      payload = await aiApiRequest(endpoint, config.apiKey, {
        model: config.model,
        messages: chat,
        tools: declaredTools.length ? declaredTools : undefined,
        tool_choice: declaredTools.length ? "auto" : undefined,
      }, headers);
    } catch (error) {
      const mayRetryWithoutTools =
        turn === 0 &&
        config.provider === "OPENROUTER" &&
        declaredTools.length > 0 &&
        isToolCompatibilityError(error);
      if (!mayRetryWithoutTools) throw error;

      const fallback = await aiApiRequest(endpoint, config.apiKey, {
        model: config.model,
        messages: [
          ...chat,
          {
            role: "system",
            content: "The selected free model endpoint cannot call TITAN tools. Answer only from general knowledge. Do not claim to have searched TITAN records, calculated a TITAN quote, inspected files, searched the live web, or completed an action.",
          },
        ],
      }, headers);
      const fallbackText = fallback?.choices?.[0]?.message?.content;
      if (typeof fallbackText !== "string" || !fallbackText.trim()) {
        throw new Error("The selected OpenRouter model does not support TITAN tools and returned no chat response. Choose another free model with tool support.");
      }
      return {
        text: `${fallbackText.trim()}\n\nNote: This reply used basic chat mode because the selected free OpenRouter endpoint does not support TITAN CRM tools. Choose a tool-capable model for CRM, pricing, file, or live-search questions.`,
        citations: [],
        toolsUsed: [],
      };
    }
    const message = payload?.choices?.[0]?.message;
    if (!message) throw new Error("AI provider returned an empty response");
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (!calls.length) {
      const finalText = typeof message.content === "string" ? message.content.trim() : "";
      if (!finalText) throw new Error("AI provider returned an empty response");
      return { text: finalText, citations: [], toolsUsed: [...used] };
    }
    chat.push(message);
    for (const call of calls) {
      const name = String(call?.function?.name || "");
      used.add(name);
      let output: unknown;
      try {
        output = await executeAiTool(actor, conversationId, name, safeArguments(call?.function?.arguments));
      } catch (error) {
        output = { error: error instanceof Error ? error.message : "Tool failed" };
      }
      chat.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(output) });
    }
  }
  throw new Error("TITAN AI reached its tool-call safety limit");
}

export async function createTitanAgentReply(options: {
  config: AiConfiguration;
  actor: AiActor;
  conversationId: string;
  instructions: string;
  messages: ChatMessage[];
  mode: AiToolMode;
  allowNativeWebSearch: boolean;
}) {
  const tools = await buildAiTools(options.actor, options.mode);
  if (options.config.provider === "OPENAI") {
    return openAiAgent(
      options.config,
      options.actor,
      options.conversationId,
      options.instructions,
      options.messages,
      tools,
      options.allowNativeWebSearch,
    );
  }
  return compatibleAgent(
    options.config,
    options.actor,
    options.conversationId,
    options.instructions,
    options.messages,
    tools,
  );
}
