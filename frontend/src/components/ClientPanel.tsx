import React, { useState, useRef, useEffect } from 'react';
import { apiUrl } from '../api';
import type { CompiledAgent } from '../App';

interface Button { blockId: string; label: string; }

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  buttons?: Button[];
  rawProtocol?: string;
  command?: string;
  signals?: Array<{ type: string; field?: string; value?: string; intent?: string; }>;
}

interface RuntimeStatus {
  provider: string;
  model: string;
  turns: number;
  summaryReady: boolean;
  lastSummaryAt: number | null;
}

interface ClientPanelProps {
  compiledAgent: CompiledAgent | null;
  onChatStarted: () => void;
  chatStarted: boolean;
}

const generateSessionId = () => `session_${Date.now()}`;
const BASE_IDS = { client_id: 'client1', app_id: 'app1', block_id: 'block1', user_id: 'user1', language: 'en' };

export default function ClientPanel({ compiledAgent, onChatStarted, chatStarted }: ClientPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(generateSessionId);
  const [collectedData, setCollectedData] = useState<Record<string, string>>({});
  const [intentType, setIntentType] = useState<string | undefined>();
  const [goalMet, setGoalMet] = useState(false);
  const [showProtocol, setShowProtocol] = useState(false);
  const [lastRaw, setLastRaw] = useState('');
  const [runtime, setRuntime] = useState<RuntimeStatus>({
    provider: 'gemini', model: 'gemini-1.5-flash',
    turns: 0, summaryReady: false, lastSummaryAt: null,
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const agentReady = !!compiledAgent;
  const totalFields = compiledAgent?.totalFields ?? 0;
  const configFields: string[] = compiledAgent ? [
    ...(compiledAgent.config.intents.orders?.isIntentEnable ? compiledAgent.config.intents.orders.dataCollection ?? [] : []),
    ...(compiledAgent.config.intents.leadGeneration?.isIntentEnable ? compiledAgent.config.intents.leadGeneration.dataCollection ?? [] : []),
    ...(compiledAgent.config.intents.newsletter?.isIntentEnable ? compiledAgent.config.intents.newsletter.dataCollection ?? [] : []),
  ] : [];
  const collectedCount = Object.keys(collectedData).length;
  const pendingFields = configFields.filter(f => !collectedData[f]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || sending || goalMet || !agentReady) return;
    setInput('');
    if (!chatStarted) onChatStarted();
    setMessages(prev => [...prev, { role: 'user', content: text.trim() }]);
    setSending(true);

    try {
      const res = await fetch(apiUrl('/api/ai-assistant-client-end'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text.trim(), ...BASE_IDS, session_id: sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setLastRaw(data.rawResponse || '');
      setMessages(prev => {
        const next = [...prev];
        if (data.summarizedNow) {
          next.push({ role: 'system', content: `↻ Conversation summarized at turn ${data.turnCount}` });
        }
        next.push({
          role: 'assistant',
          content: data.displayText || '',
          buttons: data.buttons || [],
          rawProtocol: data.rawResponse,
          command: data.command,
          signals: data.signals?.filter((s: { type: string }) => s.type === 'D' || s.type === 'I') || [],
        });
        return next;
      });

      setRuntime({
        provider: data.provider || 'gemini',
        model: data.model || 'gemini-1.5-flash',
        turns: data.turnCount || 0,
        summaryReady: (data.summarizedAt?.length ?? 0) > 0,
        lastSummaryAt: data.summarizedAt?.at(-1) ?? null,
      });
      setCollectedData(data.collectedData || {});
      if (data.intentType) setIntentType(data.intentType);
      if (data.goalMet) setGoalMet(true);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${(e as Error).message}` }]);
    } finally {
      setSending(false);
    }
  };

  const handleClear = async () => {
    await fetch(apiUrl('/api/ai-assistant-client-end/clear-conversation'), {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...BASE_IDS, session_id: sessionId }),
    });
    setMessages([]); setCollectedData({}); setIntentType(undefined);
    setGoalMet(false); setLastRaw('');
    setRuntime(r => ({ ...r, turns: 0, summaryReady: false, lastSummaryAt: null }));
  };

  return (
    <div style={s.outer}>
      {/* Chat + right sidebar */}
      <div style={s.main}>
        {/* Chat column */}
        <div style={s.chatCol}>
          {/* Header */}
          <div style={s.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={s.badge}>CLIENT</span>
              <span style={s.title}>Chat</span>
              <span style={{ fontSize: 12, color: '#555' }}>Test your compiled agent</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={s.turnBadge}>Turn {runtime.turns}</span>
              {runtime.summaryReady && (
                <span style={s.summaryBadge}>↻ Summary @ {runtime.lastSummaryAt}</span>
              )}
              <button onClick={handleClear} style={s.btnClear}>Clear Chat</button>
            </div>
          </div>

          {/* Agent info bar */}
          {compiledAgent && (
            <div style={s.agentBar}>
              <InfoChip icon="🤖" label="Agent ID" value={compiledAgent.agentId} mono />
              <InfoChip icon="⚡" label="Provider" value={runtime.provider} />
              <InfoChip icon="💾" label="Session Store" value="Redis (Upstash)" />
              <InfoChip icon="↻" label="Summary" value="Every 8 turns" />
              <InfoChip icon="📋" label="Fields Collected" value={`${collectedCount} / ${totalFields}`}
                highlight={collectedCount > 0} />
            </div>
          )}

          {/* Messages */}
          <div style={s.messages}>
            {!agentReady && (
              <div style={s.emptyState}>Compile an agent in the Admin panel first →</div>
            )}
            {agentReady && messages.length === 0 && (
              <div style={s.emptyState}>Send a message to start the conversation.</div>
            )}
            {messages.map((msg, i) => {
              if (msg.role === 'system') return (
                <div key={i} style={s.systemNote}>{msg.content}</div>
              );
              if (msg.role === 'user') return (
                <div key={i} style={s.userBubble}>{msg.content}</div>
              );
              return (
                <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                  {msg.command && (
                    <div style={s.commandNote}>
                      {msg.command === 'close_sad' ? '⚠ Inappropriate content detected' : '✓ Conversation closed'}
                    </div>
                  )}
                  <div style={s.assistantBubble}>
                    <div>{msg.content}</div>
                    {/* Inline I| chips only */}
                    {msg.signals && msg.signals.filter(s => s.type === 'I' && s.intent).length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {msg.signals.filter(s => s.type === 'I' && s.intent).map((sig, j) => (
                          <span key={j} className="tag tag-I">I| {sig.intent}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.buttons && msg.buttons.length > 0 && (
                    <div style={s.buttonRow}>
                      {msg.buttons.map((btn, j) => (
                        <button key={j} onClick={() => sendMessage(btn.label)} style={s.btnAction}>
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Goal banner */}
          {goalMet && (
            <div style={s.goalBanner}>
              Intent detected: <strong>{intentType}</strong> — goal reached.
            </div>
          )}

          {/* Footer protocol legend + input */}
          <div style={s.footerBar}>
            <span style={s.protocolLegend}>
              Protocol: <span className="tag tag-T">T|</span> (Text) &nbsp;
              <span className="tag tag-D">D|</span> (Data) &nbsp;
              <span className="tag tag-I">I|</span> (Intent)
            </span>
            <span style={{ fontSize: 11, color: '#444' }}>Auto-summary every 8 turns · Redis-backed session</span>
          </div>
          <div style={s.inputRow}>
            <textarea
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={!agentReady ? 'Compile an agent first…' : goalMet ? 'Goal reached — clear to restart' : 'Type your message…'}
              style={{ flex: 1, minHeight: 44, maxHeight: 100 }}
              disabled={!agentReady || goalMet}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            />
            <button onClick={() => sendMessage(input)} disabled={sending || !input.trim() || !agentReady || goalMet} style={s.btnSend}>
              {sending ? '…' : '▶'}
            </button>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="right-sidebar" style={s.sidebar}>
          {/* Runtime status */}
          <SideSection title="RUNTIME STATUS">
            <SideRow label="Provider" value={runtime.provider} highlight />
            <SideRow label="Model" value={runtime.model} small />
            <SideRow label="Session ID" value={sessionId.slice(0, 16) + '…'} mono small />
            <SideRow label="Turns" value={String(runtime.turns)} />
            <SideRow label="Summary" value={runtime.summaryReady ? 'Ready' : 'Waiting'} ok={runtime.summaryReady} />
            {runtime.lastSummaryAt && <SideRow label="Last Summary" value={`${runtime.turns - runtime.lastSummaryAt} turns ago`} />}
          </SideSection>

          {/* Intent & Data */}
          <SideSection title="INTENT & DATA">
            {intentType ? (
              <div style={{ marginBottom: 8 }}>
                <div style={s.sideLabel}>Current Intent</div>
                <span className="tag tag-I">{intentType}</span>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>No intent detected yet</div>
            )}
            <div style={s.sideLabel}>Fields Collected ({collectedCount}/{totalFields})</div>
            {configFields.slice(0, 6).map(f => (
              <div key={f} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                <span style={{ color: '#888' }}>• {f.replace('$', '')}</span>
                <span style={{ color: collectedData[f] ? '#00d084' : '#444', fontWeight: collectedData[f] ? 600 : 400 }}>
                  {collectedData[f] ? collectedData[f].slice(0, 14) : 'Pending'}
                </span>
              </div>
            ))}
            {pendingFields.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={s.sideLabel}>Pending Fields</div>
                {pendingFields.slice(0, 4).map(f => (
                  <div key={f} style={{ fontSize: 11, color: '#444', marginBottom: 3 }}>• {f.replace('$', '')}</div>
                ))}
              </div>
            )}
          </SideSection>

          {/* Protocol view */}
          <SideSection title="PROTOCOL VIEW" action={
            <button onClick={() => setShowProtocol(p => !p)} style={s.toggle}>
              <span style={{ fontSize: 11, marginRight: 4 }}>Show</span>
              <div style={{ ...s.toggleThumb, background: showProtocol ? '#6c5ce7' : '#2e2e38' }}>
                <div style={{ ...s.toggleDot, transform: showProtocol ? 'translateX(12px)' : 'translateX(2px)' }} />
              </div>
            </button>
          }>
            {showProtocol && lastRaw ? (
              <pre style={s.rawProtocol}>{lastRaw}</pre>
            ) : (
              <div style={{ fontSize: 11, color: '#444' }}>{lastRaw ? 'Toggle to view raw protocol' : 'No response yet'}</div>
            )}
          </SideSection>
        </div>
      </div>

      {/* Mobile sidebar (shown below panels on small screens) */}
      <div className="mobile-sidebar" style={s.mobileSidebar}>
        <InfoChip icon="⚡" label="Provider" value={runtime.provider} />
        <InfoChip icon="↻" label="Turns" value={String(runtime.turns)} />
        {intentType && <InfoChip icon="🎯" label="Intent" value={intentType} />}
        <InfoChip icon="📋" label="Fields" value={`${collectedCount}/${totalFields}`} highlight={collectedCount > 0} />
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function InfoChip({ icon, label, value, mono, highlight }: { icon: string; label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', borderRight: '1px solid #1a1a1f', height: '100%', flexShrink: 0 }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 11, color: highlight ? '#00d084' : mono ? '#a78bfa' : '#c0c0d0', fontFamily: mono ? 'monospace' : 'inherit', fontWeight: 600 }}>{value}</div>
      </div>
    </div>
  );
}

function SideSection({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid #1a1a1f', padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: '#555', fontWeight: 700, letterSpacing: '0.08em' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function SideRow({ label, value, highlight, ok, mono, small }: { label: string; value: string; highlight?: boolean; ok?: boolean; mono?: boolean; small?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 11, color: '#555' }}>{label}</span>
      <span style={{
        fontSize: small ? 10 : 11,
        color: ok ? '#00d084' : highlight ? '#a78bfa' : '#c0c0d0',
        fontFamily: mono ? 'monospace' : 'inherit',
        textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all',
      }}>{value}</span>
    </div>
  );
}

/* ── Styles ── */
const s: Record<string, React.CSSProperties> = {
  outer: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  main: { display: 'flex', flex: 1, overflow: 'hidden' },
  chatCol: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
  sidebar: { width: 220, flexShrink: 0, borderLeft: '1px solid #1a1a1f', overflowY: 'auto', overflowX: 'hidden', background: '#0d0d12', height: '100%' },
  header: {
    padding: '10px 16px', borderBottom: '1px solid #1a1a1f', display: 'flex',
    alignItems: 'center', justifyContent: 'space-between', background: '#13131a', flexShrink: 0,
  },
  badge: { background: '#0d3b2e', color: '#00d084', borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' },
  title: { fontSize: 14, fontWeight: 600, color: '#e8e8ea' },
  turnBadge: { fontSize: 11, color: '#888', background: '#1a1a1f', borderRadius: 4, padding: '3px 8px' },
  summaryBadge: { fontSize: 10, color: '#f59e0b', background: '#2d1f00', borderRadius: 4, padding: '3px 8px' },
  btnClear: { background: '#1a1a1f', border: '1px solid #2e2e38', color: '#888', fontSize: 12, padding: '5px 10px' },
  agentBar: {
    display: 'flex', borderBottom: '1px solid #1a1a1f', background: '#0d0d12',
    flexShrink: 0, overflowX: 'auto', height: 44,
  },
  messages: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 },
  emptyState: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: 13 },
  userBubble: { alignSelf: 'flex-end', background: '#6c5ce7', color: '#fff', borderRadius: '12px 12px 2px 12px', padding: '9px 13px', maxWidth: '72%', fontSize: 13, lineHeight: 1.5 },
  assistantBubble: { background: '#13131a', border: '1px solid #1e1e28', borderRadius: '2px 12px 12px 12px', padding: '9px 13px', fontSize: 13, lineHeight: 1.5, color: '#e8e8ea' },
  systemNote: { alignSelf: 'center', color: '#f59e0b', fontSize: 11, background: '#2d1f00', borderRadius: 4, padding: '3px 10px' },
  commandNote: { fontSize: 11, color: '#f87171', background: '#3b1010', borderRadius: 4, padding: '3px 8px', marginBottom: 4 },
  buttonRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  btnAction: { background: '#1a1a2e', border: '1px solid #6c5ce7', color: '#a78bfa', borderRadius: 6, padding: '5px 11px', fontSize: 12 },
  goalBanner: { background: '#0d3b2e', color: '#00d084', textAlign: 'center', padding: '7px', fontSize: 12, fontWeight: 600, flexShrink: 0 },
  footerBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 14px', borderTop: '1px solid #1a1a1f', background: '#0d0d12', flexShrink: 0 },
  protocolLegend: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#555' },
  inputRow: { display: 'flex', gap: 8, padding: '10px 14px', borderTop: '1px solid #1a1a1f', background: '#13131a', alignItems: 'flex-end', flexShrink: 0 },
  btnSend: { background: '#6c5ce7', color: '#fff', padding: '10px 16px', alignSelf: 'flex-end', fontSize: 14 },
  sideLabel: { fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 },
  toggle: { display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: '#888' },
  toggleThumb: { width: 28, height: 16, borderRadius: 8, position: 'relative', transition: 'background 0.2s' },
  toggleDot: { position: 'absolute', top: 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'transform 0.2s' },
  rawProtocol: { fontFamily: 'monospace', fontSize: 10, color: '#a78bfa', background: '#0f0f11', padding: '8px', borderRadius: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5, maxHeight: 200, overflowY: 'auto' },
  mobileSidebar: { display: 'none', gap: 0, borderTop: '1px solid #1a1a1f', background: '#0d0d12', height: 44, flexShrink: 0 },
};
