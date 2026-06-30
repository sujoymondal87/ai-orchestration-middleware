import { Router, Request, Response } from 'express';
import { scrapeUrl } from '../services/scraper';
import { extractConfigFromPage, AIBlockConfig } from '../services/agentCompiler';

const router = Router();

function calculateConfidence(config: AIBlockConfig): number {
  const fields = [
    config.basicInfo.youAre,
    config.basicInfo.aiFor,
    config.basicInfo.businessBackground,
    config.basicInfo.targetCustomers,
    config.basicInfo.geographicScope,
    config.basicInfo.operatingHours,
    config.conversationRules.scopeOfDiscussion,
    config.conversationRules.personality,
    config.conversationRules.mainObjectives,
    config.conversationRules.objectionHandling,
  ];
  const filled = fields.filter(f => typeof f === 'string' && f.trim().length > 15).length;
  return Math.round((filled / fields.length) * 100);
}

router.post('/api/scrape-and-fill-config', async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    const scraped = await scrapeUrl(url);
    const config = await extractConfigFromPage(scraped.text, url);
    const confidence = calculateConfidence(config);

    res.json({
      success: true,
      scraped: {
        title: scraped.title,
        truncated: scraped.truncated,
        contentSizeKb: scraped.contentSizeKb,
      },
      config,
      confidence,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
