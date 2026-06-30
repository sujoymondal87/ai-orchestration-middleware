import { Router, Request, Response } from 'express';
import { sessionManager } from '../core/SessionManager';
import { registry } from '../providermultiai/base/ProviderRegistry';
import { parseProtocol, wrapPlainText } from '../utils/protocolParser';
import { maybeSummarize } from '../services/summarizer';
import { AIBlockConfig, buildAIBlockAgentSystemPrompt } from '../services/agentCompiler';
import { ChatMessage } from '../providermultiai/base/AIProvider.interface';

const router = Router();

const MAX_MESSAGES_WITH_SUMMARY = 20;
const MAX_MESSAGES_NO_SUMMARY = 15;

/**
 * Mirrors production buildAIBlockAgentSystemPromptClientEnd — injects ongoing summary into system prompt
 */
function buildClientEndSystemPrompt(
  basePrompt: string,
  ongoingDiscussionSummary?: string,
  responseLanguage = 'en'
): string {
  const L = responseLanguage;

  const summarySection = ongoingDiscussionSummary ? `
# Ongoing Discussion Summary

IMPORTANT: The section below contains the context and history of this conversation. Use it to understand what has been discussed, what the user wanted, and what info was already collected, BEFORE considering the recent messages.
Do NOT restart with a generic welcome — continue directly from the user's latest message.

<<<ONGOING_DISCUSSION_SUMMARY_START>>>
${ongoingDiscussionSummary.trim()}
<<<ONGOING_DISCUSSION_SUMMARY_END>>>` : '';

  const sessionLang = `
# Session Language

The client session language is **${L}** (ISO 639-1).
- T| lines must use: T|${L}:your text
- B| lines must use: B|blockId|${L}:label
- Do NOT output multiple locale segments on the same line`;

  const responseFormat = `
# Response Format

ALWAYS respond in this exact pipe-delimited format:

T|${L}:Your reply to the user
B|blockId|${L}:Button label (include 1-3 buttons in most responses)
D|$Var1:value1|$Var2:value2  (or D|null if nothing collected yet)
I|intentDetected:TYPE|blockId:ID|$Var:value|$summary:brief  (or I|null)

Rules:
- ALWAYS start with T|
- Include B| buttons for most responses (choices, confirmation, next steps)
- D| line lists ALL collected data attributes so far — never omit previously collected values
- I| line only when you have collected ALL required data for an intent AND you are signaling it
- When signaling I|: include every $Var:value for that intent + $summary (what the user wanted + language)
- NEVER return plain text — every response must use T| format
- No markdown in T| content (no **, no bullet points)
- C|close_sad before T| if user is abusive; C|close_conversation before T| for goodbyes`;

  return `${basePrompt}${summarySection}${sessionLang}${responseFormat}`;
}

router.post('/api/ai-assistant-client-end', async (req: Request, res: Response) => {
  const {
    query,
    user_id = 'user1',
    client_id = 'client1',
    app_id = 'app1',
    block_id = 'block1',
    session_id = 'session1',
    language = 'en',
    provider,
    model,
    temperature,
  } = req.body as {
    query?: string;
    user_id?: string;
    client_id?: string;
    app_id?: string;
    block_id?: string;
    session_id?: string;
    language?: string;
    provider?: string;
    model?: string;
    temperature?: number;
  };

  if (!query || !query.trim()) {
    return res.status(400).json({ success: false, error: 'query is required' });
  }

  const responseLanguage = language.split(/[-_]/)[0].toLowerCase() || 'en';

  try {
    const baseSystemPrompt = await sessionManager.getAgent(client_id, app_id, block_id);
    if (!baseSystemPrompt) {
      return res.status(404).json({ success: false, error: 'Agent not generated. Please generate agent first using /api/generate-agent' });
    }

    const config = await sessionManager.getAgentConfig(client_id, app_id, block_id) as AIBlockConfig | null;
    let session = await sessionManager.getSession(client_id, app_id, user_id, session_id);

    const conversationMessages = session.messages.filter(m => m.role !== 'system');
    const exchangeCount = conversationMessages.filter(m => m.role === 'user').length;

    // Rolling summarization: fire BEFORE adding new user message, when about to hit chunk boundary
    // nextExchangeIndex = exchangeCount + 1 (the turn we're about to process)
    const nextExchangeIndex = exchangeCount + 1;
    let summarizedNow = false;
    if (nextExchangeIndex > 0 && nextExchangeIndex % 8 === 0 && conversationMessages.length > 0) {
      const { summarized, session: afterSummarize } = await maybeSummarize(session, config, responseLanguage);
      session = afterSummarize;
      summarizedNow = summarized;
    }

    // Build the full client-end system prompt (injecting rolling summary each turn)
    const systemPrompt = buildClientEndSystemPrompt(baseSystemPrompt, session.ongoingDiscussionSummary, responseLanguage);

    // Update or set system message
    const sysIdx = session.messages.findIndex(m => m.role === 'system');
    if (sysIdx === -1) {
      session.messages.unshift({ role: 'system', content: systemPrompt });
    } else {
      session.messages[sysIdx].content = systemPrompt;
    }

    // Add user message
    session.messages.push({ role: 'user', content: query.trim() });
    session.turnCount += 1;

    // Trim to max messages (system + conversation)
    const maxConv = session.ongoingDiscussionSummary ? MAX_MESSAGES_WITH_SUMMARY : MAX_MESSAGES_NO_SUMMARY;
    const systemMsg = session.messages.find(m => m.role === 'system')!;
    const convOnly = session.messages.filter(m => m.role !== 'system');
    const trimmed = convOnly.length > maxConv ? convOnly.slice(-maxConv) : convOnly;
    const messagesToSend: ChatMessage[] = [systemMsg, ...trimmed as ChatMessage[]];

    // Call AI
    const selectedProvider = provider || process.env.MCP_DEFAULT_PROVIDER || 'deepseek';
    const selectedModel = model || process.env.MCP_DEFAULT_MODEL || 'deepseek-v4-flash';

    const result = await registry.complete(messagesToSend, {
      provider: selectedProvider,
      model: selectedModel,
      temperature: temperature ?? 0.7,
      maxTokens: 500,
    });

    let rawResponse = result.text.trim();

    // If AI returned plain text (not T| format), wrap it — matches production fallback
    if (!rawResponse.startsWith('T|')) {
      rawResponse = wrapPlainText(rawResponse, responseLanguage);
    }

    const parsed = parseProtocol(rawResponse, responseLanguage);

    // Merge collected data
    session.collectedData = { ...session.collectedData, ...parsed.collectedData };
    if (parsed.intentType) session.goalMet = true;

    // Store raw response in history (like production — frontend parses it)
    session.messages.push({ role: 'assistant', content: rawResponse });
    await sessionManager.saveSession(client_id, app_id, user_id, session_id, session);

    res.json({
      success: true,
      rawResponse,
      displayText: parsed.displayText,
      buttons: parsed.buttons,
      command: parsed.command,
      signals: parsed.signals,
      collectedData: session.collectedData,
      intentType: parsed.intentType,
      intentBlockId: parsed.intentBlockId,
      summary: parsed.summary,
      turnCount: session.turnCount,
      summarizedAt: session.summarizedAt,
      summarizedNow,
      goalMet: session.goalMet,
      provider: result.provider,
      model: result.model,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

router.delete('/api/ai-assistant-client-end/clear-conversation', async (req: Request, res: Response) => {
  const {
    client_id = 'client1', app_id = 'app1', user_id = 'user1', session_id = 'session1',
  } = req.body as Record<string, string>;
  await sessionManager.clearSession(client_id, app_id, user_id, session_id);
  res.json({ success: true });
});

export default router;
