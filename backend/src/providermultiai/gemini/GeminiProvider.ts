import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, ChatMessage, CompletionOptions, CompletionResult } from '../base/AIProvider.interface';

export class GeminiProvider implements AIProvider {
  name = 'gemini';
  priority = 6;

  private client: GoogleGenerativeAI | null = null;

  constructor() {
    if (process.env.GEMINI_API_KEY) {
      this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
  }

  isAvailable(): boolean {
    return !!this.client;
  }

  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult> {
    if (!this.client) throw new Error('Gemini not configured');
    const modelId = options?.model?.startsWith('gemini') ? options.model : 'gemini-1.5-flash';
    const model = this.client.getGenerativeModel({ model: modelId });

    const systemMsg = messages.find(m => m.role === 'system');
    const history = messages
      .filter(m => m.role !== 'system')
      .slice(0, -1)
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const lastUser = messages.filter(m => m.role !== 'system').at(-1);
    const chat = model.startChat({
      history,
      systemInstruction: systemMsg?.content,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 2048,
      },
    });

    const result = await chat.sendMessage(lastUser?.content || '');
    return {
      text: result.response.text(),
      provider: 'gemini',
      model: modelId,
    };
  }
}
