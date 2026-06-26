import React, { useState, useRef, useEffect } from 'react';
import { apiUrl } from '../api';

interface Signal {
  type: 'T' | 'B' | 'C' | 'D' | 'I';
  raw: string;
  text?: string;
  blockId?: string;
  label?: string;
  command?: string;
  data?: Record<string, string>;
  intentType?: string;
}

interface Button {
  blockId: string;
  label: string;
  imageFile?: string;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  buttons?: Button[];
  command?: string;
}

interface ClientPanelProps {
  agentReady: boolean;
}

const generateSessionId = () => `session_${Date.now()}`;

const BASE_IDS = {
  client_id: 'client1',
  app_id: 'app1',
  block_id: 'block1',
  user_id: 'user1',
  language: 'en',
};

export default function ClientPanel({ agentReady }: ClientPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [summarizedAt, setSummarizedAt] = useState<number[]>([]);
  const [collectedData, setCollectedData] = useState<Record<string, string>>({});
  const [intentType, setIntentType] = useState<string | undefined>();
  const [goalMet, setGoalMet] = useState(false);
  const [sessionId, setSessionId] = useState(generateSessionId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || sending || goalMet) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text.trim() }]);
    setSending(true);

    try {
      const res = await fetch(apiUrl('/api/ai-assistant-client-end'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text.trim(), ...BASE_IDS, session_id: sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessages(prev => {
        const next = [...prev];
        if (data.summarizedNow) {
          next.push({ role: 'system', content: '↻ Conversation summarized to preserve context' });
        }
        next.push({
          role: 'assistant',
          content: data.displayText || '',
          buttons: data.buttons || [],
          command: data.command,
        });
        return next;
      });

      setTurnCount(data.turnCount || 0);
      setSummarizedAt(data.summarizedAt || []);
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
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...BASE_IDS, session_id: sessionId }),

    });
    setMessages([]);
    setTurnCount(0);
    setSummarizedAt([]);
    setCollectedData({});
    setIntentType(undefined);
    setGoalMet(false);
    setSessionId(generateSessionId());
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={styles.badge}>CLIENT</span>
          <h2 style={styles.title}>Chat</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={styles.turnBadge}>Turn {turnCount}</span>
          {summarizedAt.length > 0 && (
            <span style={styles.summaryBadge}>↻ Summarized @ turn {summarizedAt.join(', ')}</span>
          )}
          <button onClick={handleClear} style={styles.btnClear}>Clear</button>
        </div>
      </div>

      {!agentReady ? (
        <div style={styles.emptyState}>Compile an agent in the Admin panel first →</div>
      ) : (
        <>
          <div style={styles.messages}>
            {messages.length === 0 && (
              <div style={styles.placeholder}>Send a message to start the conversation.</div>
            )}
            {messages.map((msg, i) => {
              if (msg.role === 'system') {
                return <div key={i} style={styles.systemNote}>{msg.content}</div>;
              }
              if (msg.role === 'user') {
                return <div key={i} style={styles.userBubble}>{msg.content}</div>;
              }
              return (
                <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                  {msg.command && (
                    <div style={styles.commandBadge}>
                      {msg.command === 'close_sad' ? '⚠ Session closed — inappropriate content' : '✓ Conversation ended'}
                    </div>
                  )}
                  <div style={styles.assistantBubble}>{msg.content}</div>
                  {msg.buttons && msg.buttons.length > 0 && (
                    <div style={styles.buttonRow}>
                      {msg.buttons.map((btn, j) => (
                        <button key={j} onClick={() => sendMessage(btn.label)} style={styles.btnAction}>
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

          {/* Collected signals bar */}
          {(Object.keys(collectedData).length > 0 || intentType) && (
            <div style={styles.signalBar}>
              <span style={styles.signalLabel}>Signals:</span>
              {intentType && <span className="tag tag-I">I| {intentType}</span>}
              {Object.entries(collectedData).slice(0, 6).map(([k, v]) => (
                <span key={k} className="tag tag-D">{k}: {v}</span>
              ))}
              {Object.keys(collectedData).length > 6 && (
                <span style={{ color: '#555', fontSize: 11 }}>+{Object.keys(collectedData).length - 6} more</span>
              )}
            </div>
          )}

          {goalMet && (
            <div style={styles.goalBanner}>
              Intent detected: <strong>{intentType}</strong> — goal reached.
            </div>
          )}

          <div style={styles.inputRow}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={goalMet ? 'Goal reached — clear to start over' : 'Type a message…'}
              style={{ flex: 1, minHeight: 44, maxHeight: 120 }}
              disabled={!agentReady || goalMet}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={sending || !input.trim() || goalMet}
              style={styles.btnSend}
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  header: { padding: '16px 20px', borderBottom: '1px solid #2e2e38', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#13131a', flexWrap: 'wrap', gap: 8 },
  badge: { background: '#0d3b2e', color: '#00d084', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' },
  title: { fontSize: 16, fontWeight: 600, color: '#e8e8ea' },
  turnBadge: { fontSize: 12, color: '#888', background: '#1a1a1f', borderRadius: 4, padding: '3px 8px' },
  summaryBadge: { fontSize: 11, color: '#f59e0b', background: '#2d1f00', borderRadius: 4, padding: '3px 8px' },
  btnClear: { background: '#2e2e38', color: '#888', fontSize: 12 },
  messages: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 },
  placeholder: { color: '#555', fontSize: 14, textAlign: 'center', marginTop: 40 },
  emptyState: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 14 },
  userBubble: { alignSelf: 'flex-end', background: '#6c5ce7', color: '#fff', borderRadius: '12px 12px 2px 12px', padding: '10px 14px', maxWidth: '75%', fontSize: 14, lineHeight: 1.5 },
  assistantBubble: { background: '#1a1a1f', border: '1px solid #2e2e38', borderRadius: '2px 12px 12px 12px', padding: '10px 14px', fontSize: 14, lineHeight: 1.5, color: '#e8e8ea' },
  systemNote: { alignSelf: 'center', color: '#f59e0b', fontSize: 12, background: '#2d1f00', borderRadius: 4, padding: '4px 10px' },
  commandBadge: { fontSize: 11, color: '#f87171', background: '#3b1010', borderRadius: 4, padding: '3px 8px', marginBottom: 4 },
  buttonRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  btnAction: { background: '#1a1a2e', border: '1px solid #6c5ce7', color: '#a78bfa', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' },
  signalBar: { padding: '8px 20px', borderTop: '1px solid #2e2e38', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, background: '#0d0d12' },
  signalLabel: { fontSize: 11, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  goalBanner: { background: '#0d3b2e', color: '#00d084', textAlign: 'center' as const, padding: '8px', fontSize: 13, fontWeight: 600 },
  inputRow: { display: 'flex', gap: 8, padding: '12px 20px', borderTop: '1px solid #2e2e38', background: '#13131a', alignItems: 'flex-end' },
  btnSend: { background: '#6c5ce7', color: '#fff', padding: '10px 20px', alignSelf: 'flex-end' as const },
};
