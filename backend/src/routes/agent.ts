import { Router, Request, Response } from 'express';
import { compileAgent, AIBlockConfig } from '../services/agentCompiler';
import { sessionManager } from '../core/SessionManager';

const router = Router();

router.post('/api/generate-agent', async (req: Request, res: Response) => {
  const { config, clientId = 'client1', appId = 'app1', blockId = 'block1' } =
    req.body as { config?: AIBlockConfig; clientId?: string; appId?: string; blockId?: string };

  if (!config) return res.status(400).json({ error: 'config is required' });

  try {
    const systemPrompt = await compileAgent(config, clientId, appId, blockId);
    res.json({ success: true, systemPrompt, clientId, appId, blockId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/api/get-agent', async (req: Request, res: Response) => {
  const { clientId = 'client1', appId = 'app1', blockId = 'block1' } = req.query as Record<string, string>;

  try {
    const systemPrompt = await sessionManager.getAgent(clientId, appId, blockId);
    if (!systemPrompt) return res.status(404).json({ error: 'Agent not found. Compile one first.' });
    res.json({ success: true, systemPrompt, clientId, appId, blockId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/api/providers', (_req, res) => {
  const { registry } = require('../providermultiai/base/ProviderRegistry');
  const providers = registry.list().map((p: { name: string; priority: number; isAvailable: () => boolean }) => ({
    name: p.name,
    priority: p.priority,
    available: p.isAvailable(),
    isDefault: p.name === (process.env.MCP_DEFAULT_PROVIDER || 'deepseek'),
  }));
  res.json({ providers });
});

export default router;
