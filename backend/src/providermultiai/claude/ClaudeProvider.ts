import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, ChatMessage, CompletionOptions, CompletionResult } from '../base/AIProvider.interface';

export class ClaudeProvider implements AIProvider {
  name = 'claude';
  priority = 10;

  private client: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
  }

  isAvailable(): boolean {
    return !!this.client;
  }

  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult> {
    if (!this.client) throw new Error('Claude not configured');
    const model = options?.model?.startsWith('claude') ? options.model : 'claude-haiku-4-5-20251001';
    const systemMsg = messages.find(m => m.role === 'system');
    const filtered = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const response = await this.client.messages.create({
      model,
      system: systemMsg?.content,
      messages: filtered,
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.7,
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');

    return { text, provider: 'claude', model };
  }
}
