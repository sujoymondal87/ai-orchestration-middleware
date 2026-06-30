import { Router, Request, Response } from 'express';
import { compileAgent, AIBlockConfig } from '../services/agentCompiler';
import { sessionManager } from '../core/SessionManager';
import { registry } from '../providermultiai/base/ProviderRegistry';

const router = Router();

function generateAgentId(config: AIBlockConfig): string {
  const slug = (config.basicInfo.aiFor || 'agent')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 12);
  return `${slug}_${Date.now()}`;
}

router.post('/api/generate-agent', async (req: Request, res: Response) => {
  const { config, clientId = 'client1', appId = 'app1', blockId = 'block1' } =
    req.body as { config?: AIBlockConfig; clientId?: string; appId?: string; blockId?: string };

  if (!config) return res.status(400).json({ error: 'config is required' });

  try {
    const systemPrompt = await compileAgent(config, clientId, appId, blockId);
    const agentId = generateAgentId(config);
    const tokenCount = Math.round(systemPrompt.length / 4);

    res.json({
      success: true,
      systemPrompt,
      agentId,
      tokenCount,
      clientId,
      appId,
      blockId,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/api/get-agent', async (req: Request, res: Response) => {
  const { clientId = 'client1', appId = 'app1', blockId = 'block1' } = req.query as Record<string, string>;

  try {
    const systemPrompt = await sessionManager.getAgent(clientId, appId, blockId);
    if (!systemPrompt) return res.status(404).json({ error: 'Agent not found. Compile one first.' });
    const config = await sessionManager.getAgentConfig(clientId, appId, blockId);
    res.json({ success: true, systemPrompt, config, clientId, appId, blockId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/api/providers', (_req, res) => {
  const providers = registry.list().map(p => ({
    name: p.name,
    priority: p.priority,
    available: p.isAvailable(),
    isDefault: p.name === (process.env.MCP_DEFAULT_PROVIDER || 'deepseek'),
  }));
  res.json({ providers });
});

export default router;
