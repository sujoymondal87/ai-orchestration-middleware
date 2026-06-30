import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapeResult {
  url: string;
  title: string;
  text: string;
  truncated: boolean;
  contentSizeKb: number;
}

const MAX_CHARS = 8000;

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const response = await axios.get(url, {
    timeout: 60000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ai-orchestration-bot/1.0)' },
    maxContentLength: 5 * 1024 * 1024,
  });

  const $ = cheerio.load(response.data as string);
  $('script, style, nav, footer, header, iframe, noscript, [aria-hidden="true"]').remove();

  const title = $('title').text().trim() || $('h1').first().text().trim();

  const paragraphs: string[] = [];
  $('p, h1, h2, h3, h4, li, td, th, span, div').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t.length > 30) paragraphs.push(t);
  });

  const seen = new Set<string>();
  const unique = paragraphs.filter(p => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });

  let text = unique.join('\n');
  const rawSizeKb = Math.round(Buffer.byteLength(text, 'utf8') / 102.4) / 10;
  const truncated = text.length > MAX_CHARS;
  if (truncated) text = text.slice(0, MAX_CHARS);

  return { url, title, text, truncated, contentSizeKb: rawSizeKb };
}
