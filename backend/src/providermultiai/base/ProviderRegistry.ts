import { AIProvider, ChatMessage, CompletionOptions, CompletionResult } from './AIProvider.interface';

export class ProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();
  private defaultProvider: string;
  private defaultModel: string;

  constructor() {
    this.defaultProvider = process.env.MCP_DEFAULT_PROVIDER || 'deepseek';
    this.defaultModel = process.env.MCP_DEFAULT_MODEL || 'deepseek-v4-flash';
  }

  register(provider: AIProvider): void {
    this.providers.set(provider.name, provider);
  }

  list(): AIProvider[] {
    return Array.from(this.providers.values()).sort((a, b) => b.priority - a.priority);
  }

  resolve(model?: string, providerName?: string): AIProvider {
    const target = providerName || this.defaultProvider;
    const provider = this.providers.get(target);
    if (provider && provider.isAvailable()) return provider;

    // fallback by priority descending
    const fallback = this.list().find(p => p.isAvailable());
    if (!fallback) throw new Error('No AI providers available');
    return fallback;
  }

  async complete(
    messages: ChatMessage[],
    options?: CompletionOptions & { provider?: string }
  ): Promise<CompletionResult> {
    const model = options?.model || this.defaultModel;
    const providerName = options?.provider || this.defaultProvider;

    const ordered = [providerName, ...this.list().map(p => p.name)];
    const tried = new Set<string>();

    for (const name of ordered) {
      if (tried.has(name)) continue;
      tried.add(name);
      const provider = this.providers.get(name);
      if (!provider || !provider.isAvailable()) continue;
      try {
        return await provider.complete(messages, { ...options, model });
      } catch (err) {
        console.warn(`[ProviderRegistry] ${name} failed, trying next:`, (err as Error).message);
      }
    }
    throw new Error('All providers failed');
  }
}

export const registry = new ProviderRegistry();
