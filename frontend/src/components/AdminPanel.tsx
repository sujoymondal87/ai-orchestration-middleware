import React, { useState } from 'react';

interface AIBlockConfig {
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
  intents: {
    orders?: { isIntentEnable: boolean; dataCollection?: string[] };
    leadGeneration?: { isIntentEnable: boolean; dataCollection?: string[] };
    newsletter?: { isIntentEnable: boolean; dataCollection?: string[] };
    customIntents?: Array<{ intentDescription: string; captureAttribute?: string }>;
  };
}

interface AdminPanelProps {
  onAgentCompiled: () => void;
}

export default function AdminPanel({ onAgentCompiled }: AdminPanelProps) {
  const [url, setUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [config, setConfig] = useState<AIBlockConfig | null>(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [error, setError] = useState('');
  const [scrapeInfo, setScrapeInfo] = useState<{ title: string; truncated: boolean } | null>(null);

  const handleScrape = async () => {
    if (!url.trim()) return;
    setScraping(true);
    setError('');
    setConfig(null);
    setSystemPrompt('');
    try {
      const res = await fetch('/api/scrape-and-fill-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfig(data.config);
      setScrapeInfo(data.scraped);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScraping(false);
    }
  };

  const handleCompile = async () => {
    if (!config) return;
    setCompiling(true);
    setError('');
    try {
      const res = await fetch('/api/generate-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, clientId: 'client1', appId: 'app1', blockId: 'block1' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSystemPrompt(data.systemPrompt);
      onAgentCompiled();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCompiling(false);
    }
  };

  const enabledIntents = config ? [
    config.intents.orders?.isIntentEnable && 'ORDER',
    config.intents.leadGeneration?.isIntentEnable && 'LEAD_GENERATION',
    config.intents.newsletter?.isIntentEnable && 'NEWSLETTER',
    ...(config.intents.customIntents?.map(ci => ci.intentDescription) ?? []),
  ].filter(Boolean) as string[] : [];

  const allDataFields = config ? [
    ...(config.intents.orders?.isIntentEnable ? config.intents.orders.dataCollection ?? [] : []),
    ...(config.intents.leadGeneration?.isIntentEnable ? config.intents.leadGeneration.dataCollection ?? [] : []),
    ...(config.intents.newsletter?.isIntentEnable ? config.intents.newsletter.dataCollection ?? [] : []),
  ] : [];

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.badge}>ADMIN</span>
        <h2 style={styles.title}>Agent Builder</h2>
      </div>

      <div style={styles.body}>
        <label style={styles.label}>Business URL</label>
        <div style={styles.row}>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com"
            onKeyDown={e => e.key === 'Enter' && handleScrape()}
          />
          <button onClick={handleScrape} disabled={scraping || !url.trim()} style={styles.btnPrimary}>
            {scraping ? 'Scraping…' : 'Scrape'}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {scrapeInfo && (
          <div style={styles.info}>
            Scraped: <strong>{scrapeInfo.title || '(no title)'}</strong>
            {scrapeInfo.truncated && ' · text truncated to 8k chars'}
          </div>
        )}

        {config && (
          <>
            <div style={styles.section}>
              <label style={styles.label}>Extracted Config</label>
              <div style={styles.configGrid}>
                <ConfigRow label="Agent name" value={config.basicInfo.youAre} />
                <ConfigRow label="Business" value={config.basicInfo.aiFor} />
                <ConfigRow label="Background" value={config.basicInfo.businessBackground} />
                <ConfigRow label="Customers" value={config.basicInfo.targetCustomers} />
                <ConfigRow label="Location" value={config.basicInfo.geographicScope} />
                <ConfigRow label="Hours" value={config.basicInfo.operatingHours} />
                <ConfigRow label="Personality" value={config.conversationRules.personality} />
                <ConfigRow label="Objectives" value={config.conversationRules.mainObjectives} />
                {enabledIntents.length > 0 && (
                  <ConfigRow label="Active intents" value={enabledIntents.join(' · ')} />
                )}
                {allDataFields.length > 0 && (
                  <ConfigRow label="Data to collect" value={allDataFields.join(', ')} />
                )}
              </div>
            </div>

            <button onClick={handleCompile} disabled={compiling} style={styles.btnCompile}>
              {compiling ? 'Compiling…' : 'Compile Agent → Store in Redis'}
            </button>
          </>
        )}

        {systemPrompt && (
          <div style={styles.section}>
            <label style={styles.label}>
              System Prompt &nbsp;
              <span style={{ color: '#00d084', fontWeight: 700 }}>✓ stored in Redis</span>
              <span style={{ color: '#555', fontWeight: 400, marginLeft: 8, fontSize: 11 }}>
                key: ai_agent_system_prompt:client1_app1:block1
              </span>
            </label>
            <div style={styles.promptBox}>{systemPrompt}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 2, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 13, color: '#e8e8ea', lineHeight: 1.4 }}>{value || '—'}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', borderRight: '1px solid #2e2e38' },
  header: { padding: '16px 20px', borderBottom: '1px solid #2e2e38', display: 'flex', alignItems: 'center', gap: 10, background: '#13131a' },
  badge: { background: '#2d1b4e', color: '#a78bfa', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' },
  title: { fontSize: 16, fontWeight: 600, color: '#e8e8ea' },
  body: { flex: 1, overflowY: 'auto', padding: '20px' },
  label: { fontSize: 11, color: '#666', display: 'block', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  row: { display: 'flex', gap: 8, marginBottom: 12 },
  btnPrimary: { background: '#6c5ce7', color: '#fff', whiteSpace: 'nowrap' as const, padding: '8px 14px', minWidth: 80 },
  btnCompile: { background: '#00b386', color: '#fff', width: '100%', padding: '10px', fontSize: 14, marginTop: 4, marginBottom: 16 },
  error: { background: '#3b1010', border: '1px solid #7f1d1d', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#f87171', marginBottom: 12 },
  info: { fontSize: 12, color: '#777', marginBottom: 12 },
  section: { marginTop: 16, marginBottom: 4 },
  configGrid: { background: '#13131a', border: '1px solid #2e2e38', borderRadius: 8, padding: '14px 16px', marginBottom: 12 },
  promptBox: { background: '#13131a', border: '1px solid #2e2e38', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#a0a0b0', whiteSpace: 'pre-wrap' as const, lineHeight: 1.6, maxHeight: 260, overflowY: 'auto' as const },
};
