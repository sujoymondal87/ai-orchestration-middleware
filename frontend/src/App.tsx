import { useState } from 'react';
import AdminPanel from './components/AdminPanel';
import ClientPanel from './components/ClientPanel';

export default function App() {
  const [agentReady, setAgentReady] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={styles.appHeader}>
        <span style={styles.logo}>AI Orchestration Middleware</span>
        <span style={styles.subtitle}>scrape → compile → agent → chat</span>
        {agentReady && <span style={styles.readyBadge}>Agent Ready</span>}
      </header>
      <div style={styles.panels}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <AdminPanel onAgentCompiled={() => setAgentReady(true)} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ClientPanel agentReady={agentReady} />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  appHeader: {
    background: '#13131a',
    borderBottom: '1px solid #2e2e38',
    padding: '10px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexShrink: 0,
  },
  logo: { fontSize: 14, fontWeight: 700, color: '#e8e8ea', letterSpacing: '-0.01em' },
  subtitle: { fontSize: 12, color: '#555' },
  readyBadge: {
    marginLeft: 'auto',
    background: '#0d3b2e',
    color: '#00d084',
    borderRadius: 4,
    padding: '3px 10px',
    fontSize: 12,
    fontWeight: 600,
  },
  panels: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
};
