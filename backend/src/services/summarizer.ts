import { ChatMessage } from '../providermultiai/base/AIProvider.interface';
import { registry } from '../providermultiai/base/ProviderRegistry';
import { SessionData } from '../core/SessionManager';
import { AIBlockConfig } from './agentCompiler';

export const CHUNK_SIZE = 8; // mirrors production CHUNK_SIZE

function extractTextFromAssistantMessage(content: string, lang: string): string {
  if (!content.startsWith('T|')) return content;
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('T|')) {
      const rest = line.slice(2);
      const ci = rest.indexOf(':');
      if (ci !== -1 && ci <= 3) return rest.slice(ci + 1);
      return rest;
    }
  }
  return content;
}

export async function maybeSummarize(
  session: SessionData,
  config: AIBlockConfig | null,
  responseLanguage: string
): Promise<{ summarized: boolean; session: SessionData }> {
  const conversationMessages = session.messages.filter(m => m.role !== 'system');
  if (conversationMessages.length === 0) return { summarized: false, session };

  // Format history into human-readable text (strip T|B|I| for summarization)
  const formatted = conversationMessages.map(m => {
    const role = m.role === 'user' ? 'User' : 'Assistant';
    let content = m.content || '';
    if (m.role === 'assistant' && content.startsWith('T|')) {
      content = extractTextFromAssistantMessage(content, responseLanguage);
    }
    return `${role}: ${content}`;
  }).join('\n');

  // Build hint about configured data vars
  const orderVars = config?.intents?.orders?.dataCollection ?? [];
  const leadVars = config?.intents?.leadGeneration?.dataCollection ?? [];
  const newsletterVars = config?.intents?.newsletter?.dataCollection ?? [];
  const allVars = [...new Set([...orderVars, ...leadVars, ...newsletterVars])];
  const dataVarsHint = allVars.length
    ? ` Attributes to extract when present: ${allVars.join(', ')}.`
    : ' Extract any names, emails, phones, addresses, product choices mentioned.';

  const systemPrompt = `You are a conversation summarizer. Produce a brief that MUST include: (1) what the user wanted; (2) ALL collected data values with their actual values — list each attribute and value (e.g. CustomerName: X, ContactEmail: Y) so the assistant will NOT ask for them again; (3) language if evident.${dataVarsHint} The brief is used as context for the next turn — if you omit a collected value, the user will be asked again. Be concise but complete for collected data.`;

  const userContent = session.ongoingDiscussionSummary
    ? `Previous summary (keep all collected data from it):\n${session.ongoingDiscussionSummary}\n\nNew messages to add:\n${formatted}\n\nProduce an UPDATED summary that merges both. Preserve every collected data value from the previous summary and add any new ones. Do not drop any collected attribute.`
    : `Summarize this conversation. Include what the user wanted and list EVERY piece of data already collected with values:\n\n${formatted}`;

  try {
    const result = await registry.complete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ], { temperature: 0.3, maxTokens: 400 });

    if (!result.text.trim()) return { summarized: false, session };

    const newSummary = result.text.trim();

    // Keep last exchange (last user + last assistant) — matches production behavior
    const systemMsg = session.messages.find(m => m.role === 'system');
    const lastExchange: ChatMessage[] = conversationMessages.length >= 2
      ? conversationMessages.slice(-2) as ChatMessage[]
      : conversationMessages as ChatMessage[];

    const updatedSession: SessionData = {
      ...session,
      messages: [...(systemMsg ? [systemMsg] : []), ...lastExchange],
      ongoingDiscussionSummary: newSummary,
      summarizedAt: [...session.summarizedAt, session.turnCount],
    };

    return { summarized: true, session: updatedSession };
  } catch (err) {
    console.warn('[summarizer] failed, continuing without summarization:', (err as Error).message);
    return { summarized: false, session };
  }
}
