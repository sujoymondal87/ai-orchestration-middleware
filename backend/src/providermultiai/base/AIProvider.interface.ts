export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface CompletionResult {
  text: string;
  provider: string;
  model: string;
}

export interface AIProvider {
  name: string;
  priority: number;
  isAvailable(): boolean;
  complete(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult>;
}
