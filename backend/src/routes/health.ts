import { Router } from 'express';
import { registry } from '../providermultiai/base/ProviderRegistry';
import { sessionManager } from '../core/SessionManager';

const router = Router();

router.get('/health', async (_req, res) => {
  const redisOk = await sessionManager.ping();
  const providers = registry.list().map(p => ({
    name: p.name,
    priority: p.priority,
    available: p.isAvailable(),
  }));
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: redisOk ? 'connected' : 'disconnected',
    providers,
  });
});

export default router;
