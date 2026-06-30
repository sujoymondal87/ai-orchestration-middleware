import { useState, useEffect } from 'react';
import AdminPanel from './components/AdminPanel';
import ClientPanel from './components/ClientPanel';
import { apiUrl } from './api';

export interface CompiledAgent {
  agentId: string;
  systemPrompt: string;
  tokenCount: number;
  config: AIBlockConfig;
  totalFields: number;
}

export interface AIBlockConfig {
  basicInfo: {
    youAre: string; aiFor: string; businessBackground: string;
    targetCustomers: string; geographicScope: string; operatingHours: string;
  };
  conversationRules: {
    scopeOfDiscussion: string; cannotDiscuss: string; personality: string;
    mainObjectives: string; dialogueTemplates: string; objectionHandling: string;
  };
  intents: {
    orders?: { isIntentEnable: boolean; dataCollection?: string[] };
    leadGeneration?: { isIntentEnable: boolean; dataCollection?: string[] };
    newsletter?: { isIntentEnable: boolean; dataCollection?: string[] };
    customIntents?: Array<{ intentDescription: string; captureAttribute?: string }>;
  };
}

interface HealthData {
  status: string;
  redis: string;
  providers: Array<{ name: string; available: boolean; isDefault?: boolean }>;
}

export default function App() {
  const [compiledAgent, setCompiledAgent] = useState<CompiledAgent | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [chatStarted, setChatStarted] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/health'))
      .then(r => r.json())
      .then(setHealth)
      .catch(() => {});
  }, []);

  const activeProvider = health?.providers?.find(p => p.isDefault && p.available)
    || health?.providers?.find(p => p.available);

  const apiOk = health?.status === 'ok';
  const redisOk = health?.redis === 'connected';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top bar */}
      <header style={s.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={s.logoText}>AI Orchestration Middleware</span>
          <span style={s.logoDivider}>·</span>
          <span style={s.logoSub}>scrape → compile → agent → chat</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <StatusDot label="API Status" ok={apiOk} value={apiOk ? 'Healthy' : 'Offline'} />
          <StatusDot label="Redis" ok={redisOk} value={redisOk ? 'Connected' : 'Disconnected'} />
          {activeProvider && (
            <div style={s.providerBadge}>
              <span style={s.statLabel}>Provider</span>
              <span style={{ color: '#e8e8ea', fontWeight: 600, fontSize: 13 }}>
                {activeProvider.name.charAt(0).toUpperCase() + activeProvider.name.slice(1)}
              </span>
            </div>
          )}
          <a href="https://github.com/sujoymondal87/ai-orchestration-middleware" target="_blank"
            rel="noreferrer" style={s.docsBtn}>
            View Docs
          </a>
        </div>
      </header>

      {/* Main panels */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden', borderRight: '1px solid #2e2e38' }}>
          <AdminPanel onAgentCompiled={agent => { setCompiledAgent(agent); setChatStarted(false); }} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ClientPanel
            compiledAgent={compiledAgent}
            onChatStarted={() => setChatStarted(true)}
            chatStarted={chatStarted}
          />
        </div>
      </div>

      {/* Mobile sidebar (hidden on desktop via CSS) */}
      <div className="mobile-sidebar" style={s.mobileSidebar}>
        <MobileSidebarContent health={health} compiledAgent={compiledAgent} />
      </div>

      {/* Feature strip */}
      <footer style={s.featureStrip}>
        {FEATURES.map(f => (
          <div key={f.label} style={s.featureItem}>
            <span style={s.featureIcon}>{f.icon}</span>
            <div>
              <div style={s.featureLabel}>{f.label}</div>
              <div style={s.featureSub}>{f.sub}</div>
            </div>
          </div>
        ))}
      </footer>
    </div>
  );
}

function StatusDot({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div>
      <div style={s.statLabel}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: ok ? '#00d084' : '#f87171', flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: ok ? '#00d084' : '#f87171', fontWeight: 600 }}>{value}</span>
      </div>
    </div>
  );
}

function MobileSidebarContent({ health, compiledAgent }: { health: HealthData | null; compiledAgent: CompiledAgent | null }) {
  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '12px 20px', overflowX: 'auto' }}>
      {health?.providers?.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.available ? '#00d084' : '#555' }} />
          <span style={{ fontSize: 12, color: '#888', textTransform: 'capitalize' }}>{p.name}</span>
          <span style={{ fontSize: 11, color: p.available ? '#00d084' : '#555' }}>{p.available ? 'Available' : 'Unavailable'}</span>
        </div>
      ))}
      {compiledAgent && (
        <div style={{ fontSize: 12, color: '#888' }}>
          Agent: <span style={{ color: '#a78bfa' }}>{compiledAgent.agentId}</span>
        </div>
      )}
    </div>
  );
}

const FEATURES = [
  { icon: '⚡', label: 'Multi-Model Orchestration', sub: 'DeepSeek → Gemini → Claude' },
  { icon: '🎯', label: 'Goal-Aware Agents', sub: 'Business goal drives the agent' },
  { icon: '💾', label: 'Redis-Backed Sessions', sub: 'Persistent & scalable memory' },
  { icon: '↻', label: 'Rolling Summarization', sub: 'Every 8 user turns' },
  { icon: '▸', label: 'Structured Protocol', sub: 'T| D| I| for deterministic output' },
  { icon: '✦', label: 'No Framework Lock-in', sub: 'Pure Node.js + TypeScript' },
];

const s: Record<string, React.CSSProperties> = {
  topBar: {
    background: '#13131a', borderBottom: '1px solid #2e2e38',
    padding: '0 20px', height: 48, display: 'flex',
    alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
  },
  logoText: { fontSize: 14, fontWeight: 700, color: '#e8e8ea', letterSpacing: '-0.01em' },
  logoDivider: { color: '#333', fontSize: 14 },
  logoSub: { fontSize: 12, color: '#555' },
  statLabel: { fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' },
  providerBadge: { display: 'flex', flexDirection: 'column', gap: 1 },
  docsBtn: {
    background: '#1a1a1f', border: '1px solid #2e2e38', borderRadius: 6,
    padding: '5px 12px', fontSize: 12, color: '#e8e8ea', textDecoration: 'none', fontWeight: 500,
  },
  mobileSidebar: {
    background: '#0d0d12', borderTop: '1px solid #2e2e38',
    flexShrink: 0, display: 'none',
  },
  featureStrip: {
    background: '#0d0d12', borderTop: '1px solid #1a1a1f',
    display: 'flex', alignItems: 'center',
    padding: '0', height: 56, flexShrink: 0,
  },
  featureItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '0 16px', borderRight: '1px solid #1a1a1f',
    height: '100%', flex: 1,
  },
  featureIcon: { fontSize: 16, opacity: 0.7 },
  featureLabel: { fontSize: 11, fontWeight: 600, color: '#c0c0d0' },
  featureSub: { fontSize: 10, color: '#555' },
};
