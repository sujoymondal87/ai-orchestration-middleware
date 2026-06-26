// Mirrors the real pipe protocol: T|{lang}:{text} · B|blockId|{lang}:label · C|command · D|$Var:val · I|intentDetected:TYPE|blockId:id|$Var:val|$summary:brief

export interface ParsedSignal {
  type: 'T' | 'B' | 'C' | 'D' | 'I';
  raw: string;
  // T
  lang?: string;
  text?: string;
  // B
  blockId?: string;
  label?: string;
  imageFile?: string;
  // C
  command?: string;
  // D  — collected data map
  data?: Record<string, string>;
  // I
  intentType?: string;
  intentBlockId?: string;
  intentVars?: Record<string, string>;
  summary?: string;
}

export interface ParsedResponse {
  signals: ParsedSignal[];
  displayText: string;
  buttons: Array<{ blockId: string; label: string; imageFile?: string }>;
  command?: string;
  collectedData: Record<string, string>;
  intentType?: string;
  intentBlockId?: string;
  summary?: string;
}

export function parseProtocol(raw: string, responseLanguage = 'en'): ParsedResponse {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const signals: ParsedSignal[] = [];
  const textParts: string[] = [];
  const buttons: Array<{ blockId: string; label: string; imageFile?: string }> = [];
  const collectedData: Record<string, string> = {};
  let command: string | undefined;
  let intentType: string | undefined;
  let intentBlockId: string | undefined;
  let summary: string | undefined;
  let intentVars: Record<string, string> = {};

  for (const line of lines) {
    if (line.startsWith('T|')) {
      // T|{lang}:{text}   or legacy T|{text}
      const rest = line.slice(2);
      const colonIdx = rest.indexOf(':');
      let lang = responseLanguage;
      let text = rest;
      if (colonIdx !== -1 && colonIdx <= 3) {
        // looks like a lang code
        lang = rest.slice(0, colonIdx);
        text = rest.slice(colonIdx + 1);
      }
      signals.push({ type: 'T', raw: line, lang, text });
      textParts.push(text);

    } else if (line.startsWith('B|')) {
      // B|blockId|{lang}:label|i:filename
      const parts = line.slice(2).split('|');
      const blockId = parts[0] || '';
      let label = '';
      let imageFile: string | undefined;
      for (let i = 1; i < parts.length; i++) {
        if (parts[i].startsWith('i:')) {
          imageFile = parts[i].slice(2);
        } else {
          // lang:label
          const ci = parts[i].indexOf(':');
          label = ci !== -1 ? parts[i].slice(ci + 1) : parts[i];
        }
      }
      signals.push({ type: 'B', raw: line, blockId, label, imageFile });
      buttons.push({ blockId, label, imageFile });

    } else if (line.startsWith('C|')) {
      command = line.slice(2).trim();
      signals.push({ type: 'C', raw: line, command });

    } else if (line.startsWith('D|')) {
      // D|$Var1:val1|$Var2:val2   or D|null
      const rest = line.slice(2);
      const data: Record<string, string> = {};
      if (rest !== 'null') {
        rest.split('|').forEach(pair => {
          const ci = pair.indexOf(':');
          if (ci !== -1) {
            const k = pair.slice(0, ci).trim();
            const v = pair.slice(ci + 1).trim();
            if (k && v) {
              data[k] = v;
              collectedData[k] = v;
            }
          }
        });
      }
      signals.push({ type: 'D', raw: line, data });

    } else if (line.startsWith('I|')) {
      // I|intentDetected:TYPE|blockId:ID|$Var:val|$summary:brief   or I|null
      const rest = line.slice(2);
      if (rest !== 'null') {
        const parts = rest.split('|');
        const iVars: Record<string, string> = {};
        for (const part of parts) {
          const ci = part.indexOf(':');
          if (ci === -1) continue;
          const k = part.slice(0, ci).trim();
          const v = part.slice(ci + 1).trim();
          if (k === 'intentDetected') intentType = v;
          else if (k === 'blockId') intentBlockId = v;
          else if (k === '$summary') summary = v;
          else {
            iVars[k] = v;
            collectedData[k] = v;
          }
        }
        intentVars = iVars;
        signals.push({ type: 'I', raw: line, intentType, intentBlockId, intentVars, summary });
      }

    } else if (textParts.length === 0) {
      // plain text fallback — treat as T
      signals.push({ type: 'T', raw: line, lang: responseLanguage, text: line });
      textParts.push(line);
    }
  }

  return {
    signals,
    displayText: textParts.join('\n'),
    buttons,
    command,
    collectedData,
    intentType,
    intentBlockId,
    summary,
  };
}

/** Wrap plain text response into proper T|D|I format, as production does */
export function wrapPlainText(text: string, lang: string): string {
  const escaped = text.replace(/\|/g, ' ').slice(0, 500);
  return `T|${lang}:${escaped}\nD|null\nI|null`;
}
