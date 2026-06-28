# AI Orchestration Middleware

A standalone reimplementation of the AI Block Configurator pipeline — the **scrape → compile → agent → chat** flow.

Distilled from Neareo's production system, serving 30+ cultural institution apps across Spain, France, and Belgium.

**Live Demo:** https://goalawareai.vercel.app  
**Backend API:** https://ai-orchestration-middleware.onrender.com/health  
**Case Study:** https://sujoymondal-tech.vercel.app/case-studies/building-ai-orchestration-without-a-framework

## What it demonstrates

- **Multi-model routing** — DeepSeek (default) → Gemini → Claude, priority-based fallback, no LangChain
- **Redis-backed sessions** — Upstash free tier, no Docker
- **URL scraping → AI config extraction → agent compilation**
- **Goal-driven agent** stored in Redis, steers conversation toward operator-defined goal
- **Rolling summarization** every 8 user turns (preserves collected D| data)
- **Structured intent signals**: `T|` (text) · `D|` (data field) · `I|` (intent)
- **Two-panel UI**: Admin (build agent) + Client (chat)

## Architecture

```
Admin panel
  URL → Scrape → extractConfig (AI) → compileAgent (AI) → Redis
                                                              ↓
Client panel                                         system prompt
  User message → getAgent (Redis) → AI call → parseProtocol → UI
                      ↑                                       ↓
               SessionManager                    save session (Redis)
                      ↑
            maybeSummarize (every 8 turns)
```

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js · TypeScript · Express |
| Session store | Redis via Upstash (no Docker) |
| AI Providers | DeepSeek (default) · Gemini · Claude |
| Frontend | React · Vite |
| Deploy | Render (backend) · Vercel (frontend) |

## Quick start

```bash
# 1. Clone
git clone https://github.com/sujoymondal87/ai-orchestration-middleware.git
cd ai-orchestration-middleware

# 2. Backend
cd backend
cp .env.example .env
# fill in your keys in .env
npm install
npm run dev          # starts on port 3000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev          # starts on port 5173, proxies /api to localhost:3000
```

## .env keys

| Variable | Where to get it |
|---|---|
| `DEEPSEEK_API_KEY` | platform.deepseek.com |
| `GEMINI_API_KEY` | aistudio.google.com |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `REDIS_URL` | upstash.com (free tier, copy REST URL) |

## Redis key patterns

| Key | Purpose |
|---|---|
| `ai_agent_system_prompt:{clientId}_{appId}:{blockId}` | Compiled agent system prompt |
| `ai_assistant_client_end:{clientId}:{appId}:{userId}:{sessionId}` | Chat session |

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health + provider status |
| GET | `/api/providers` | List providers |
| POST | `/api/scrape-and-fill-config` | Scrape URL → extract config |
| POST | `/api/generate-agent` | Compile agent → store in Redis |
| GET | `/api/get-agent` | Retrieve compiled agent |
| POST | `/api/ai-assistant-client-end` | Chat with agent |
| DELETE | `/api/ai-assistant-client-end/clear-conversation` | Clear session |
| GET | `/api/env-check` | Check key presence |

## Protocol format

Backend responses embed structured signals:

```
T|Hello! What's your name?
D|name:Alice
I|lead
```

- `T|` — text to display
- `D|fieldname:value` — data field collected
- `I|signal` — intent detected (lead, order, newsletter, etc.)

## Deploy

**Render (backend):**
1. Connect repo, set root directory to `backend`
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Add all `.env` vars in Render dashboard
5. Add `NODE_VERSION=20.18.1` and `NPM_CONFIG_PRODUCTION=false` to env vars

**Vercel (frontend):**
1. Connect repo, set base directory to `frontend`
2. Build command: `npm run build`
3. Publish directory: `frontend/dist`
4. Add `VITE_API_URL=https://ai-orchestration-middleware.onrender.com` to env vars

## Production context

The production system this is derived from routes across 6 AI providers (Claude, OpenAI, DeepSeek, Kimi, GLM, fal.ai), manages Redis-backed sessions at scale across 30+ live apps, and uses the T|D|I| pipe protocol for embedded client widgets inside cultural institution apps across Spain, France, and Belgium. This repo isolates the core scrape → compile → agent → chat pipeline in standalone, runnable form.
