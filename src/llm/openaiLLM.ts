import type {
  LLMInvokeOptions,
  LLMMessage,
  LLMResponse,
  MinimalLLMClient,
} from "./types";

interface OpenAILLMOptions {
  apiKey: string;
  model: string;
}

interface OpenAIResponseBody {
  output_text?: string;
  output?: Array<{
    type?: string;
    role?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
}

export class OpenAILLM implements MinimalLLMClient {
  constructor(private readonly options: OpenAILLMOptions) {}

  async invoke(
    messages: LLMMessage[],
    options: LLMInvokeOptions = {}
  ): Promise<LLMResponse> {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: options.signal,
      body: JSON.stringify({
        model: this.options.model,
        input: messages.map((message) => ({
          role: message.role === "system" ? "developer" : "user",
          content: [
            {
              type: "input_text",
              text: message.content,
            },
          ],
        })),
      }),
    });

    const body = (await response.json()) as OpenAIResponseBody;

    if (!response.ok) {
      throw new Error(
        `OpenAI request failed (${response.status}): ${
          body.error?.message ?? response.statusText
        }`
      );
    }

    const content = extractOpenAIText(body);

    if (!content) {
      throw new Error("OpenAI response did not contain text output.");
    }

    return { content };
  }
}

function extractOpenAIText(body: OpenAIResponseBody): string {
  if (body.output_text) {
    return body.output_text;
  }

  return (
    body.output
      ?.flatMap((item) => item.content ?? [])
      .filter((content) => content.type === "output_text" && content.text)
      .map((content) => content.text)
      .join("\n") ?? ""
  );
}
