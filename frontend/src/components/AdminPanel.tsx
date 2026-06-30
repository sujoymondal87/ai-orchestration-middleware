import React, { useState } from 'react';
import { apiUrl } from '../api';
import type { CompiledAgent, AIBlockConfig } from '../App';

interface AdminPanelProps {
  onAgentCompiled: (agent: CompiledAgent) => void;
}

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { n: 1, label: 'Scrape', sub: 'Website' },
  { n: 2, label: 'Extract', sub: 'Config' },
  { n: 3, label: 'Compile', sub: 'Agent' },
  { n: 4, label: 'Agent', sub: 'Ready' },
  { n: 5, label: 'Test', sub: 'Chat' },
];

export default function AdminPanel({ onAgentCompiled }: AdminPanelProps) {
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<Step>(1);
  const [scraping, setScraping] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [config, setConfig] = useState<AIBlockConfig | null>(null);
  const [scrapeInfo, setScrapeInfo] = useState<{ title: string; contentSizeKb: number; truncated: boolean } | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [compiled, setCompiled] = useState<CompiledAgent | null>(null);
  const [error, setError] = useState('');
  const [showRedisModal, setShowRedisModal] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  const handleScrape = async () => {
    if (!url.trim()) return;
    setScraping(true); setError(''); setConfig(null); setCompiled(null); setStep(1);
    try {
      const res = await fetch(apiUrl('/api/scrape-and-fill-config'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfig(data.config);
      setScrapeInfo(data.scraped);
      setConfidence(data.confidence ?? 0);
      setStep(2);
    } catch (e) { setError((e as Error).message); }
    finally { setScraping(false); }
  };

  const handleCompile = async () => {
    if (!config) return;
    setCompiling(true); setError('');
    try {
      const res = await fetch(apiUrl('/api/generate-agent'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, clientId: 'client1', appId: 'app1', blockId: 'block1' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const allFields = [
        ...(config.intents.orders?.isIntentEnable ? config.intents.orders.dataCollection ?? [] : []),
        ...(config.intents.leadGeneration?.isIntentEnable ? config.intents.leadGeneration.dataCollection ?? [] : []),
        ...(config.intents.newsletter?.isIntentEnable ? config.intents.newsletter.dataCollection ?? [] : []),
      ];

      const agent: CompiledAgent = {
        agentId: data.agentId,
        systemPrompt: data.systemPrompt,
        tokenCount: data.tokenCount,
        config,
        totalFields: allFields.length,
      };
      setCompiled(agent);
      setStep(4);
      onAgentCompiled(agent);
    } catch (e) { setError((e as Error).message); }
    finally { setCompiling(false); }
  };

  const handleExportConfig = () => {
    if (!config) return;
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `agent-config-${Date.now()}.json`;
    a.click();
  };

  const enabledIntents = config ? [
    config.intents.orders?.isIntentEnable && 'ORDER',
    config.intents.leadGeneration?.isIntentEnable && 'LEAD_GENERATION',
    config.intents.newsletter?.isIntentEnable && 'NEWSLETTER',
  ].filter(Boolean) as string[] : [];

  const allDataFields = config ? [
    ...(config.intents.orders?.isIntentEnable ? config.intents.orders.dataCollection ?? [] : []),
    ...(config.intents.leadGeneration?.isIntentEnable ? config.intents.leadGeneration.dataCollection ?? [] : []),
    ...(config.intents.newsletter?.isIntentEnable ? config.intents.newsletter.dataCollection ?? [] : []),
  ] : [];

  return (
    <div style={s.panel}>
      {/* Step progress */}
      <div style={s.stepBar}>
        {STEPS.map((st, i) => {
          const done = step > st.n;
          const active = step === st.n || (st.n === 5 && step === 4 && compiled);
          return (
            <React.Fragment key={st.n}>
              <div style={s.stepItem}>
                <div style={{
                  ...s.stepCircle,
                  background: done ? '#6c5ce7' : active ? '#2d1b4e' : '#1a1a1f',
                  border: `1px solid ${done ? '#6c5ce7' : active ? '#6c5ce7' : '#2e2e38'}`,
                  color: done || active ? '#fff' : '#555',
                }}>
                  {done ? '✓' : st.n}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: done || active ? '#e8e8ea' : '#555' }}>{st.label}</div>
                  <div style={{ fontSize: 10, color: '#555' }}>{st.sub}</div>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ ...s.stepLine, background: done ? '#6c5ce7' : '#2e2e38' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div style={s.body}>
        {error && <div style={{ ...s.error, marginBottom: 12 }}>{error}</div>}

        {/* Section 1: Scraper */}
        <div style={s.bodyGap}>
        <Section icon="🌐" number={1} title="Website Scraper" active={step >= 1}>
          <label style={s.fieldLabel}>BUSINESS / WEBSITE URL</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com"
              onKeyDown={e => e.key === 'Enter' && handleScrape()} />
            <button onClick={handleScrape} disabled={scraping || !url.trim()} style={s.btnPurple}>
              {scraping ? 'Scraping…' : 'Scrape Website'}
            </button>
          </div>
          <div style={s.hint}>We'll extract content and understand the business automatically.</div>
          {scrapeInfo && (
            <div style={s.checkList}>
              <CheckItem label={`Content scraped — ${scrapeInfo.contentSizeKb} MB`} />
              <CheckItem label={`Business understood — ${confidence}% confidence`} />
              <CheckItem label={`Config generated — ${Object.keys(config?.basicInfo ?? {}).length + Object.keys(config?.conversationRules ?? {}).length} sections`} />
            </div>
          )}
        </Section>
        </div>

        {/* Section 2: Extracted Config */}
        {config && (
        <div style={s.bodyGap}>
          <Section icon="⚙️" number={2} title="Extracted Configuration" active badge="Ready">
            <div style={s.configGrid}>
              <div style={s.configCol}>
                <ConfigRow label="Business Type" value={config.basicInfo.aiFor} />
                <ConfigRow label="Domain" value={enabledIntents[0] ? 'Goal-driven' : 'General'} />
                <ConfigRow label="Primary Goal" value={config.conversationRules.mainObjectives} short />
                <ConfigRow label="Target Audience" value={config.basicInfo.targetCustomers} short />
                <ConfigRow label="Tone" value={config.conversationRules.personality} short />
                <ConfigRow label="Language" value="English" />
                <ConfigRow label="Data Fields" value={allDataFields.slice(0, 4).join(', ') + (allDataFields.length > 4 ? '…' : '')} />
              </div>
              <div style={s.configRight}>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Extracted from Website</div>
                {scrapeInfo && <>
                  <CheckItem label={`Content scraped — ${scrapeInfo.contentSizeKb} MB`} />
                  <CheckItem label={`Business understood — ${confidence}% confidence`} />
                  <CheckItem label={`Config generated — ${enabledIntents.length} intent sections`} />
                </>}
                <button style={{ ...s.btnGhost, marginTop: 12, width: '100%' }}
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
                    setCopyToast(true);
                    setTimeout(() => setCopyToast(false), 2000);
                  }}>
                  {copyToast ? '✓ Copied!' : '↗ Copy Config JSON'}
                </button>
              </div>
            </div>
            {enabledIntents.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {enabledIntents.map(i => <span key={i} className="tag tag-I">{i}</span>)}
              </div>
            )}
          </Section>
        </div>
        )}

        {/* Section 3: Compile */}
        {config && !compiled && (
        <div style={s.bodyGap}>
          <Section icon="⚡" number={3} title="Compile Agent" active>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>
              Compile the extracted configuration into a goal-aware agent.
            </div>
            <button onClick={handleCompile} disabled={compiling} style={{ ...s.btnGreen, width: '100%', padding: '10px' }}>
              {compiling ? 'Compiling…' : '▶ Compile Agent'}
            </button>
            <AdvancedOptions />
          </Section>
        </div>
        )}

        {/* Section 4: Compilation Result */}
        {compiled && (
        <div style={s.bodyGap}>
          <Section icon="📋" number={4} title="Compilation Result" active badge="Completed">
            <div style={s.resultGrid}>
              <div style={s.resultCol}>
                <ResultRow label="Agent ID" value={compiled.agentId} mono />
                <ResultRow label="System Prompt" value={`${compiled.tokenCount.toLocaleString()} tokens`} />
                <ResultRow label="Goal" value={compiled.config.conversationRules.mainObjectives} short />
                <ResultRow label="Memory" value="Redis (Upstash)" />
                <ResultRow label="Redis Key" value={`ai_agent_system_prompt:client1_app1:block1`} mono small />
              </div>
              <div style={s.resultCol}>
                <div style={s.providerRouting}>
                  <div style={{ fontSize: 11, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Provider Routing (Priority)</div>
                  <ProviderRow n={1} name="DeepSeek" note="default" status="available" />
                  <ProviderRow n={2} name="Gemini" note="" status="available" />
                  <ProviderRow n={3} name="Claude" note="" status="available" />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={s.btnGhost} onClick={() => document.querySelector<HTMLTextAreaElement>('.chat-input')?.focus()}>
                ↗ Test in Chat Panel
              </button>
              <button style={s.btnGhost} onClick={() => setShowRedisModal(true)}>
                🗄 View in Redis
              </button>
              <button style={s.btnGhost} onClick={handleExportConfig}>
                ↓ Export Config
              </button>
            </div>
          </Section>
        </div>
        )}
      </div>

      {/* Redis modal */}
      {showRedisModal && compiled && (
        <RedisModal
          agentId={compiled.agentId}
          systemPrompt={compiled.systemPrompt}
          onClose={() => setShowRedisModal(false)}
        />
      )}
    </div>
  );
}

/* ── Sub-components ── */

function Section({ icon, number, title, active, badge, children }: {
  icon: string; number: number; title: string; active?: boolean; badge?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ ...s.section, opacity: active ? 1 : 0.45 }}>
      <div style={s.sectionHeader}>
        <span style={s.sectionIcon}>{icon}</span>
        <span style={s.sectionNum}>{number}.</span>
        <span style={s.sectionTitle}>{title}</span>
        {badge && <span style={s.sectionBadge}>{badge}</span>}
      </div>
      <div style={s.sectionBody}>{children}</div>
    </div>
  );
}

function ConfigRow({ label, value, short }: { label: string; value: string; short?: boolean }) {
  const display = short && value.length > 60 ? value.slice(0, 57) + '…' : value;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={s.miniLabel}>{label}</div>
      <div style={{ fontSize: 12, color: '#c0c0d0', lineHeight: 1.4 }}>{display || '—'}</div>
    </div>
  );
}

function ResultRow({ label, value, mono, small, short }: { label: string; value: string; mono?: boolean; small?: boolean; short?: boolean }) {
  const display = short && value.length > 50 ? value.slice(0, 47) + '…' : value;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={s.miniLabel}>{label}</div>
      <div style={{ fontSize: small ? 10 : 12, color: mono ? '#a78bfa' : '#c0c0d0', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{display}</div>
    </div>
  );
}

function CheckItem({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
      <span style={{ color: '#00d084', fontSize: 12 }}>✓</span>
      <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
    </div>
  );
}

function ProviderRow({ n, name, note, status }: { n: number; name: string; note: string; status: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: '#555', width: 14 }}>{n}</span>
      <span style={{ fontSize: 12, color: '#c0c0d0', flex: 1 }}>{name}{note ? ` (${note})` : ''}</span>
      <span style={{ fontSize: 11, color: '#00d084', background: '#0d3b2e', padding: '1px 7px', borderRadius: 3 }}>
        {status}
      </span>
    </div>
  );
}

function AdvancedOptions() {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(0.7);

  return (
    <div style={{ marginTop: 12 }}>
      <button style={s.btnGhost} onClick={() => setOpen(o => !o)}>
        {open ? '▾' : '▸'} Advanced Options
      </button>
      {open && (
        <div style={s.advancedBox}>
          <div style={{ marginBottom: 12 }}>
            <div style={s.miniLabel}>Provider</div>
            <select defaultValue="gemini" style={{ marginTop: 4 }}>
              <option value="gemini">Gemini</option>
              <option value="deepseek" disabled>DeepSeek — Insufficient credits</option>
              <option value="claude" disabled>Claude — Insufficient credits</option>
            </select>
            <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>
              DeepSeek and Claude require API credits. Gemini free tier is active.
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={s.miniLabel}>Temperature</span>
              <span style={{ fontSize: 11, color: '#a78bfa' }}>{temp}</span>
            </div>
            <input type="range" min={0.1} max={1.0} step={0.05} value={temp}
              onChange={e => setTemp(parseFloat(e.target.value))} style={{ width: '100%' }} />
            <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>
              Default 0.7 — applies to all providers (production Kimi uses 0.3 for structured output).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RedisModal({ agentId, systemPrompt, onClose }: { agentId: string; systemPrompt: string; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8ea' }}>🗄 Redis — Stored Agent</span>
          <button onClick={onClose} style={{ background: '#2e2e38', color: '#888', padding: '4px 10px' }}>✕</button>
        </div>
        <div>
          <div style={s.miniLabel}>KEY</div>
          <div style={s.redisKey}>ai_agent_system_prompt:client1_app1:block1</div>
        </div>
        <div>
          <div style={s.miniLabel}>AGENT ID</div>
          <div style={{ fontSize: 12, color: '#a78bfa', fontFamily: 'monospace', marginBottom: 8 }}>{agentId}</div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={s.miniLabel}>STORED VALUE (system prompt)</div>
          <pre style={s.redisValue}>{systemPrompt}</pre>
        </div>
        <button style={s.btnGhost} onClick={() => navigator.clipboard.writeText(systemPrompt)}>
          Copy System Prompt
        </button>
      </div>
    </div>
  );
}

/* ── Styles ── */
const s: Record<string, React.CSSProperties> = {
  panel: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#0f0f11', minHeight: 0 },
  stepBar: {
    display: 'flex', alignItems: 'center', padding: '10px 20px',
    borderBottom: '1px solid #1a1a1f', background: '#0d0d12', flexShrink: 0,
  },
  stepItem: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  stepCircle: {
    width: 24, height: 24, borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
  },
  stepLine: { flex: 1, height: 1, margin: '0 6px', minWidth: 12 },
  body: { flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 20px 32px', display: 'block' },
  bodyGap: { marginBottom: 12 },
  error: { background: '#3b1010', border: '1px solid #7f1d1d', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#f87171' },
  section: { background: '#13131a', border: '1px solid #1e1e28', borderRadius: 10, overflow: 'hidden' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #1e1e28' },
  sectionIcon: { fontSize: 14 },
  sectionNum: { fontSize: 13, fontWeight: 700, color: '#6c5ce7' },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: '#e8e8ea', flex: 1 },
  sectionBadge: { fontSize: 10, color: '#00d084', background: '#0d3b2e', padding: '2px 7px', borderRadius: 3, fontWeight: 600 },
  sectionBody: { padding: '12px 14px' },
  fieldLabel: { fontSize: 10, color: '#555', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' },
  miniLabel: { fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 },
  hint: { fontSize: 11, color: '#555' },
  checkList: { marginTop: 10, padding: '10px 12px', background: '#0f0f11', borderRadius: 6 },
  configGrid: { display: 'flex', gap: 16 },
  configCol: { flex: 1 },
  configRight: { width: 180, flexShrink: 0 },
  resultGrid: { display: 'flex', gap: 16 },
  resultCol: { flex: 1 },
  providerRouting: { background: '#0f0f11', borderRadius: 6, padding: '10px 12px' },
  btnPurple: { background: '#6c5ce7', color: '#fff', padding: '8px 14px', whiteSpace: 'nowrap', flexShrink: 0 },
  btnGreen: { background: '#00b386', color: '#fff' },
  btnGhost: { background: '#1a1a1f', border: '1px solid #2e2e38', color: '#888', padding: '6px 12px', fontSize: 12 },
  advancedBox: { background: '#0f0f11', border: '1px solid #1e1e28', borderRadius: 8, padding: '12px 14px', marginTop: 8 },
  redisKey: { fontFamily: 'monospace', fontSize: 12, color: '#a78bfa', background: '#0f0f11', padding: '8px 10px', borderRadius: 6, marginBottom: 8, wordBreak: 'break-all' },
  redisValue: { fontFamily: 'monospace', fontSize: 11, color: '#888', background: '#0f0f11', padding: '10px', borderRadius: 6, overflowY: 'auto', flex: 1, maxHeight: '40vh', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 },
};
