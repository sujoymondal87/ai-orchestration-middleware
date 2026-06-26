import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { registry } from './providermultiai/base/ProviderRegistry';
import { DeepSeekProvider } from './providermultiai/deepseek/DeepSeekProvider';
import { GeminiProvider } from './providermultiai/gemini/GeminiProvider';
import { ClaudeProvider } from './providermultiai/claude/ClaudeProvider';
import healthRouter from './routes/health';
import scrapeRouter from './routes/scrape';
import agentRouter from './routes/agent';
import chatRouter from './routes/chat';

// register providers
registry.register(new DeepSeekProvider());
registry.register(new GeminiProvider());
registry.register(new ClaudeProvider());

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use(healthRouter);
app.use(scrapeRouter);
app.use(agentRouter);
app.use(chatRouter);

app.get('/api/env-check', (_req, res) => {
  res.json({
    DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    REDIS_URL: !!process.env.REDIS_URL,
    MCP_DEFAULT_PROVIDER: process.env.MCP_DEFAULT_PROVIDER || 'deepseek',
    MCP_DEFAULT_MODEL: process.env.MCP_DEFAULT_MODEL || 'deepseek-v4-flash',
  });
});

const PORT = parseInt(process.env.API_PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`[server] running on port ${PORT}`);
  const available = registry.list().filter(p => p.isAvailable()).map(p => p.name);
  console.log(`[providers] available: ${available.join(', ') || 'none — check .env'}`);
});
