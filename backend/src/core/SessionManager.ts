import Redis from 'ioredis';
import { ChatMessage } from '../providermultiai/base/AIProvider.interface';

export interface SessionData {
  messages: ChatMessage[];
  turnCount: number;
  collectedData: Record<string, string>;
  ongoingDiscussionSummary?: string;  // rolling summary — mirrors production field name
  summarizedAt: number[];
  goalMet: boolean;
}

// Mirrors production Redis key patterns exactly
const AGENT_PROMPT_KEY = (clientId: string, appId: string, blockId: string) =>
  `ai_agent_system_prompt:${clientId}_${appId}:${blockId}`;

const AGENT_CONFIG_KEY = (clientId: string, appId: string, blockId: string) =>
  `ai_agent_config:${clientId}_${appId}:${blockId}`;

const SESSION_KEY = (clientId: string, appId: string, userId: string, sessionId: string) =>
  `ai_assistant_client_end:${clientId}:${appId}:${userId}:${sessionId}`;

export class SessionManager {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
    this.redis.on('error', (err) => console.error('[Redis]', err.message));
  }

  async saveAgent(clientId: string, appId: string, blockId: string, systemPrompt: string, config?: object): Promise<void> {
    await this.redis.set(AGENT_PROMPT_KEY(clientId, appId, blockId), systemPrompt);
    if (config) {
      await this.redis.set(AGENT_CONFIG_KEY(clientId, appId, blockId), JSON.stringify(config));
    }
  }

  async getAgent(clientId: string, appId: string, blockId: string): Promise<string | null> {
    return this.redis.get(AGENT_PROMPT_KEY(clientId, appId, blockId));
  }

  async getAgentConfig(clientId: string, appId: string, blockId: string): Promise<object | null> {
    const raw = await this.redis.get(AGENT_CONFIG_KEY(clientId, appId, blockId));
    if (!raw) return null;
    return JSON.parse(raw);
  }

  async getSession(clientId: string, appId: string, userId: string, sessionId: string): Promise<SessionData> {
    const raw = await this.redis.get(SESSION_KEY(clientId, appId, userId, sessionId));
    if (!raw) return { messages: [], turnCount: 0, collectedData: {}, summarizedAt: [], goalMet: false };
    return JSON.parse(raw) as SessionData;
  }

  async saveSession(
    clientId: string, appId: string, userId: string, sessionId: string,
    data: SessionData
  ): Promise<void> {
    await this.redis.set(
      SESSION_KEY(clientId, appId, userId, sessionId),
      JSON.stringify(data),
      'EX',
      86400
    );
  }

  async clearSession(clientId: string, appId: string, userId: string, sessionId: string): Promise<void> {
    await this.redis.del(SESSION_KEY(clientId, appId, userId, sessionId));
  }

  async ping(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }
}

export const sessionManager = new SessionManager();
