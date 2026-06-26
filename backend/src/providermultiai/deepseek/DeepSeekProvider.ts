import OpenAI from 'openai';
import { AIProvider, ChatMessage, CompletionOptions, CompletionResult } from '../base/AIProvider.interface';

export class DeepSeekProvider implements AIProvider {
  name = 'deepseek';
  priority = 5;

  private client: OpenAI | null = null;

  constructor() {
    if (process.env.DEEPSEEK_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      });
    }
  }

  isAvailable(): boolean {
    return !!this.client;
  }

  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult> {
    if (!this.client) throw new Error('DeepSeek not configured');
    const model = options?.model || 'deepseek-v4-flash';
    const response = await this.client.chat.completions.create({
      model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2048,
    });
    return {
      text: response.choices[0].message.content || '',
      provider: 'deepseek',
      model,
    };
  }
}
