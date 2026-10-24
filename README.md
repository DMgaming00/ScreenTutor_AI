# 🎓 ScreenTutor AI

**A cursor-native AI tutor that lives near your cursor, captures the screen on demand, and draws overlays directly on top of your windows.**

![Mock AI Mode](https://img.shields.io/badge/Mock_AI-Included-blueviolet)
![Convex Memory](https://img.shields.io/badge/Convex-Memory-orange)
![Privacy First](https://img.shields.io/badge/Privacy-First-blue)

---

## What It Does

- **Cursor-Native Buddy**: Buddy lives near your cursor, follows you around in a compact bubble state, and expands to a full chat panel on request. When explaining concepts, Buddy smoothly animates (flies) to coordinates on your screen to point at items.
- **Captures Screen on Demand**: Trigger screen capture explicitly using `Ctrl+Shift+E` or the floating microphone button. Never records in the background or polls your screen silently.
- **Draws Overlays on Top of Apps**: Draws circles, arrows, highlighters, step badges, and text labels directly on a transparent SVG window layered over your active screen content.
- **Remembers Weak Concepts**: Stores learner profiles and session history in Convex (or an in-memory fallback), and builds spaced-repetition study plans with a Fetch.ai agent.
- **Co-drive**: Claude computer use proposes the next click or keystroke; nothing happens on your desktop until you approve it.
- **Speech Interactivity**: Push-to-talk microphone input records audio chunk sessions safely. Text-to-speech engine speaks answers out loud while stripping coordinate tags.

---

## Quick Start

### Prerequisites
- **Node.js 20+**
- **pnpm 9+**
- **Python 3.11+** (optional — only for the Fetch.ai study-planner agent)

### Install & Run
```bash
# 1. Clone the repository
git clone <repo-url>
cd 2nd_brain

# 2. Install dependencies
pnpm install

# 3. Create env file
cp .env.example .env

# 4. Start Convex for learner memory (optional — falls back to in-memory)
cd services/orchestrator && npx convex dev   # leave running; copy the URL into CONVEX_URL

# 4b. Start the Fetch.ai study planner (optional — see services/fetch-agent/README.md)

# 5. Start development environment (orchestrator + desktop concurrently)
powershell -ExecutionPolicy Bypass -Command "pnpm dev"
```

---

## Configuration & Setup

ScreenTutor AI works **out of the box** in **Mock Mode** using local templates for lessons. To configure real integrations, set the following environment variables in `.env`:

### 1. Mock Mode (Default)
Runs entirely locally without external API connections or paid accounts.
```env
AI_PROVIDER=mock
MEMORY_ENABLED=true
```

### 2. Convex (Memory)
Learner profiles, weak concepts, session turns and the response cache live in Convex. Functions are in `services/orchestrator/convex/`.
```env
CONVEX_URL=https://your-deployment.convex.cloud   # printed by `npx convex dev`
SCREENTUTOR_CONVEX_SECRET=any-long-random-string
```
Set the same secret on the deployment: `npx convex env set SCREENTUTOR_CONVEX_SECRET <value>`. Without these, the orchestrator uses in-process memory.

### Moss (Semantic Cache)
Reuses an answer when a reworded question is asked about the *same* screenshot.
```env
MOSS_PROJECT_ID=your-project-id
MOSS_PROJECT_KEY=your-project-key
```

### 3. Claude (Anthropic AI)
For real-time multi-modal screen capture analysis and chat responses.
```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
CLAUDE_MODEL=claude-opus-5-5   # default
CLAUDE_EFFORT=low              # raise to medium/high for harder diagrams
CLAUDE_SPEED=fast              # default: Opus fast mode (~2.5x faster, premium price); "standard" to save cost
```
Measured on a geometry screenshot (full answer): Opus 5.5 standard 16.7 s, **Opus 5.5 fast 6.7 s**, Sonnet 5.5 with `CLAUDE_THINKING=off` 8.6 s, Haiku 5.5 with thinking off 4.5 s.
Responses use structured outputs (JSON schema), the system prompt is prompt-cached, and refusals fall back server-side.

### Cartesia (Voice)
Streaming Sonic text-to-speech and Ink speech-to-text. The orchestrator only mints short-lived access tokens; the desktop app streams audio directly to/from Cartesia. Falls back to the system voice and browser speech recognition when unset.
```env
CARTESIA_API_KEY=sk_car_your-key
CARTESIA_VOICE_ID=your-voice-id
```

### Apify (Research Mode)
Searches the web for the concept at the learner's level and summarizes the top pages (RAG Web Browser actor).
```env
APIFY_API_TOKEN=apify_api_your-token
```

### Claude Computer Use (Co-drive)
Uses your `ANTHROPIC_API_KEY`. Claude proposes up to three steps as approval cards; approved steps run on your desktop (Windows) only when desktop control is on.
```env
CODRIVE_ENABLED=true
ENABLE_SAFE_ACTIONS=true   # off by default: approvals are shown but not performed
```

### Fetch.ai / Agentverse (Study Planner Agent)
A uAgent in `services/fetch-agent` routes questions and builds spaced-repetition study plans; it registers on Agentverse via a mailbox.
```env
FETCH_AGENTVERSE_ENABLED=true
FETCH_AGENT_URL=http://localhost:8001
```

### Elastic (Observability)
Each tutoring step is exported as an OpenTelemetry span (OTLP/HTTP protobuf) with latencies and evaluation scores.
```env
ELASTIC_OTLP_ENDPOINT=https://<id>.ingest.<region>.elastic.cloud:443
ELASTIC_API_KEY=your-api-key
```

### Sentry (Error Tracking)
Captures backend runtime errors and desktop crashes.
```env
SENTRY_ENABLED=true
SENTRY_DSN=https://your-dsn-key@o0.ingest.sentry.io/0
```

---

## Privacy Model & Redaction

- **On-Demand Capture Only**: Captures the screen only when the hotkey is triggered. No background polling or recordings.
- **Sensitive Window Denylist**: Analysis is immediately blocked if any of the 16 sensitive window title terms (e.g. `password`, `keychain`, `bank`, `email`, `stripe`) are active.
- **Data Redaction Layer**: A shared `RedactionService` automatically strips passwords, API keys, emails, credit cards, and query parameters from all logs, Sentry events, Elastic traces, and UI debug views.
- **Developer Redaction Override**: Available as a toggle in the developer panel, allowing developers to see raw data for debugging. It is turned off by default.
- **No Screenshot Storage**: Screenshots are processed in memory and never written to disk or sent to observability endpoints. Only a secure MD5 hash is stored.

---

## Bundled Demo Lessons

ScreenTutor includes six bundled offline lessons accessible by clicking the **Graduate Cap (🎓)** icon in the header:
1. **Algebra: distributive property**
2. **Algebra: common mistake**
3. **Calculus: chain rule**
4. **Calculus: u-substitution**
5. **Graph interpretation: vertex/slope**
6. **Coding error: off-by-one IndexError**

Selecting a lesson displays a static lesson preview and allows you to test the hotkey, drawing overlays, and voice synthesis without external network calls.

---

## Troubleshooting

### `Failed to reach Convex, falling back to InMemoryService`
- **Cause**: `CONVEX_URL` is wrong, `npx convex dev` isn't running, or the secret doesn't match the deployment's `SCREENTUTOR_CONVEX_SECRET`.
- **Fix**: Memory is optional; the app keeps working in RAM. Re-run `npx convex env set SCREENTUTOR_CONVEX_SECRET <value>` with the value from `.env`.

### Hotkey `Ctrl+Shift+E` Not Working
- **macOS**: Ensure Electron has **Accessibility** permissions granted in System Preferences → Privacy & Security → Accessibility.
- **Windows**: Run as Administrator if hotkeys are intercepted by other fullscreen windows.

### Screen Capture Black / Empty
- **macOS**: Ensure Electron has **Screen Recording** permissions granted in System Preferences → Privacy & Security → Screen Recording.

### `listen EADDRINUSE :::4317`
- **Cause**: Port 4317 is already in use by another process.
- **Fix**: Change `ORCHESTRATOR_PORT` in your `.env` file to a free port.
