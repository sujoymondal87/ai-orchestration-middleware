import { registry } from '../providermultiai/base/ProviderRegistry';
import { sessionManager } from '../core/SessionManager';

// Mirrors the real AIBlockConfig schema from production
export interface AIBlockConfig {
  knowledgeSource?: { scraperUrl?: string; manualText?: string };
  basicInfo: {
    youAre: string;
    aiFor: string;
    businessBackground: string;
    targetCustomers: string;
    geographicScope: string;
    operatingHours: string;
  };
  conversationRules: {
    scopeOfDiscussion: string;
    cannotDiscuss: string;
    personality: string;
    mainObjectives: string;
    dialogueTemplates: string;
    objectionHandling: string;
  };
  mediaLibrary?: Array<{ src: string; alt: string }>;
  intents: {
    orders?: {
      isIntentEnable: boolean;
      intentDescription?: string;
      jumpToDestination?: string | null;
      dataCollection?: string[];
    };
    leadGeneration?: {
      isIntentEnable: boolean;
      intentDescription?: string;
      jumpToDestination?: string | null;
      dataCollection?: string[];
    };
    newsletter?: {
      isIntentEnable: boolean;
      intentDescription?: string;
      jumpToDestination?: string | null;
      dataCollection?: string[];
    };
    customIntents?: Array<{
      intentDescription: string;
      jumpTo?: string | null;
      captureAttribute?: string;
    }>;
  };
}

// Mirrors production buildScraperSystemPrompt()
function buildScraperSystemPrompt(): string {
  return `You are an expert web content analyzer and AI agent configurator. Analyze the website content provided and extract structured configuration for a conversational AI agent.

Return ONLY valid JSON matching this exact structure:

{
  "knowledgeSource": { "scraperUrl": "https://example.com" },
  "basicInfo": {
    "youAre": "Business Name Assistant",
    "aiFor": "Business Name",
    "businessBackground": "2-3 sentence description of the business",
    "targetCustomers": "Who the customers are",
    "geographicScope": "Where they operate",
    "operatingHours": "Business hours"
  },
  "conversationRules": {
    "scopeOfDiscussion": "Topics the agent can discuss",
    "cannotDiscuss": "Topics to avoid",
    "personality": "Friendly, professional",
    "mainObjectives": "What the agent should achieve",
    "dialogueTemplates": "Sample opening phrases",
    "objectionHandling": "How to handle objections"
  },
  "intents": {
    "orders": {
      "isIntentEnable": true,
      "intentDescription": "When user wants to purchase or order",
      "jumpToDestination": null,
      "dataCollection": ["$CustomerName", "$ContactEmail", "$ContactPhone"]
    },
    "leadGeneration": {
      "isIntentEnable": true,
      "intentDescription": "When user shows interest but is not ready to buy",
      "jumpToDestination": null,
      "dataCollection": ["$LeadName", "$LeadEmail", "$LeadPhone"]
    },
    "newsletter": {
      "isIntentEnable": false,
      "intentDescription": "When user wants to subscribe to updates",
      "jumpToDestination": null,
      "dataCollection": ["$SubscriberEmail"]
    },
    "customIntents": []
  }
}

IMPORTANT:
- Set isIntentEnable true ONLY if the intent is clearly relevant to this business
- Use $variable names for all data collection fields (e.g. $CustomerName, $ContactEmail)
- Be specific — extract real information from the content provided
- Return ONLY the JSON, no markdown or extra text`;
}

// Mirrors production buildAIBlockAgentSystemPrompt(config)
export function buildAIBlockAgentSystemPrompt(config: AIBlockConfig): string {
  const { basicInfo, conversationRules, intents } = config;

  const identity = `# Identity

${basicInfo.youAre} for ${basicInfo.aiFor}

Business: ${basicInfo.businessBackground}
Customers: ${basicInfo.targetCustomers}
Location: ${basicInfo.geographicScope}
Hours: ${basicInfo.operatingHours}`;

  const rules = `# Rules

Can discuss: ${conversationRules.scopeOfDiscussion}
Cannot discuss: ${conversationRules.cannotDiscuss}
Personality: ${conversationRules.personality}
Objectives: ${conversationRules.mainObjectives}
Templates: ${conversationRules.dialogueTemplates}
Objections: ${conversationRules.objectionHandling}`;

  // Intent detection
  let intentSection = `# Intent Detection\n\nDetect user intents proactively and respond accordingly.`;

  if (intents.orders?.isIntentEnable) {
    intentSection += `\n\n## ORDER INTENT\nWhen: ${intents.orders.intentDescription || 'User wants to purchase/order'}\nCollect: ${intents.orders.dataCollection?.join(', ') || 'Order details'}\nBlock: ${intents.orders.jumpToDestination || 'N/A'}`;
  }
  if (intents.leadGeneration?.isIntentEnable) {
    intentSection += `\n\n## LEAD_GENERATION INTENT\nWhen: ${intents.leadGeneration.intentDescription || 'User shows interest but not ready to buy'}\nCollect: ${intents.leadGeneration.dataCollection?.join(', ') || 'Contact info'}\nBlock: ${intents.leadGeneration.jumpToDestination || 'N/A'}`;
  }
  if (intents.newsletter?.isIntentEnable) {
    intentSection += `\n\n## NEWSLETTER INTENT\nWhen: ${intents.newsletter.intentDescription || 'User wants updates'}\nCollect: ${intents.newsletter.dataCollection?.join(', ') || 'Email'}\nBlock: ${intents.newsletter.jumpToDestination || 'N/A'}`;
  }
  if (intents.customIntents?.length) {
    intentSection += `\n\n## CUSTOM INTENTS`;
    intents.customIntents.forEach((ci, i) => {
      intentSection += `\n\n### Custom Intent ${i + 1}\nWhen: ${ci.intentDescription}\nCapture: ${ci.captureAttribute || 'Relevant info'}\nBlock: ${ci.jumpTo || 'N/A'}`;
    });
  }

  // Data collection
  const allVars = new Set<string>();
  if (intents.orders?.isIntentEnable) intents.orders.dataCollection?.forEach(v => allVars.add(v));
  if (intents.leadGeneration?.isIntentEnable) intents.leadGeneration.dataCollection?.forEach(v => allVars.add(v));
  if (intents.newsletter?.isIntentEnable) intents.newsletter.dataCollection?.forEach(v => allVars.add(v));
  intents.customIntents?.forEach(ci => { if (ci.captureAttribute) allVars.add(ci.captureAttribute); });

  let dataSection = `# Data Collection\n\nCollect these variables when relevant:`;
  allVars.forEach(v => { dataSection += `\n- ${v}`; });
  dataSection += `\n\nAsk for values naturally, one at a time. List every collected attribute on the D| line after each reply. CRITICAL: Do NOT translate $Var keys or their values — keep them exactly as configured.`;

  const guidelines = `# Guidelines

- Language: use ONLY the session language passed by the system. Do not switch language based on user messages.
- Keep answers SHORT (one paragraph max), ask ONE question at a time
- Detect intents proactively, collect all required data before signaling intent
- Do NOT use filler phrases — vary your responses and progress the conversation
- When user wants to buy/order: detect ORDER intent immediately
- Do NOT hallucinate — stay on topic`;

  return `${identity}\n\n${rules}\n\n${intentSection}\n\n${dataSection}\n\n${guidelines}`;
}

export async function extractConfigFromPage(pageText: string, url?: string): Promise<AIBlockConfig> {
  const content = url
    ? `Website URL: ${url}\n\nWebsite content:\n${pageText}`
    : `Website content:\n${pageText}`;

  const result = await registry.complete([
    { role: 'system', content: buildScraperSystemPrompt() },
    { role: 'user', content: content },
  ], { temperature: 0.3 });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not extract JSON config from AI response');
  return JSON.parse(jsonMatch[0]) as AIBlockConfig;
}

export async function compileAgent(
  config: AIBlockConfig,
  clientId: string,
  appId: string,
  blockId: string
): Promise<string> {
  const systemPrompt = buildAIBlockAgentSystemPrompt(config);
  // Store both the system prompt and the config (mirrors production — config is needed per turn)
  await sessionManager.saveAgent(clientId, appId, blockId, systemPrompt, config);
  return systemPrompt;
}
