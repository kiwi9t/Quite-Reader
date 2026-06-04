export type LLMRole = "system" | "user";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMResponse {
  content: string;
}

export interface LLMInvokeOptions {
  signal?: AbortSignal;
}

export interface MinimalLLMClient {
  invoke(messages: LLMMessage[], options?: LLMInvokeOptions): Promise<LLMResponse>;
}
