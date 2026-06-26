import { Router, Request, Response } from 'express';
import { scrapeUrl } from '../services/scraper';
import { extractConfigFromPage } from '../services/agentCompiler';

const router = Router();

router.post('/api/scrape-and-fill-config', async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    const scraped = await scrapeUrl(url);
    const config = await extractConfigFromPage(scraped.text, url);
    res.json({ success: true, scraped: { title: scraped.title, truncated: scraped.truncated }, config });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
