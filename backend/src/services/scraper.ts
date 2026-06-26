import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapeResult {
  url: string;
  title: string;
  text: string;
  truncated: boolean;
}

const MAX_CHARS = 8000;

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const response = await axios.get(url, {
    timeout: 60000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ai-orchestration-bot/1.0)' },
    maxContentLength: 5 * 1024 * 1024,
  });

  const $ = cheerio.load(response.data as string);

  // remove noise
  $('script, style, nav, footer, header, iframe, noscript, [aria-hidden="true"]').remove();

  const title = $('title').text().trim() || $('h1').first().text().trim();

  const paragraphs: string[] = [];
  $('p, h1, h2, h3, h4, li, td, th, span, div').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t.length > 30) paragraphs.push(t);
  });

  // deduplicate
  const seen = new Set<string>();
  const unique = paragraphs.filter(p => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });

  let text = unique.join('\n');
  const truncated = text.length > MAX_CHARS;
  if (truncated) text = text.slice(0, MAX_CHARS);

  return { url, title, text, truncated };
}
