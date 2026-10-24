# 🎓 ScreenTutor AI

**A cursor-native AI tutor that lives near your cursor, captures the screen on demand, and draws overlays directly on top of your windows.**

![Mock AI Mode](https://img.shields.io/badge/Mock_AI-Included-blueviolet)
![Redis Optional](https://img.shields.io/badge/Redis-Optional-green)
![Privacy First](https://img.shields.io/badge/Privacy-First-blue)

---

## What It Does

- **Cursor-Native Buddy**: Buddy lives near your cursor, follows you around in a compact bubble state, and expands to a full chat panel on request. When explaining concepts, Buddy smoothly animates (flies) to coordinates on your screen to point at items.
- **Captures Screen on Demand**: Trigger screen capture explicitly using `Ctrl+Shift+E` or the floating microphone button. Never records in the background or polls your screen silently.
- **Draws Overlays on Top of Apps**: Draws circles, arrows, highlighters, step badges, and text labels directly on a transparent SVG window layered over your active screen content.
- **Remembers Weak Concepts**: Uses Redis (or in-memory fallback) to log weak concepts, track question patterns, and adapt explanation styles dynamically.
- **Speech Interactivity**: Push-to-talk microphone input records audio chunk sessions safely. Text-to-speech engine speaks answers out loud while stripping coordinate tags.

---

## Quick Start

### Prerequisites
- **Node.js 20+**
- **pnpm 9+**
- **Docker** (optional — only needed for Redis container)

### Install & Run
```bash
# 1. Clone the repository
git clone <repo-url>
cd 2nd_brain

# 2. Install dependencies
pnpm install

# 3. Create env file
cp .env.example .env

# 4. Start Redis (optional — falls back to in-memory)
docker compose up -d redis

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

### 2. Redis Memory
To persist profile records, weak concepts, and user sessions across app restarts.
```env
REDIS_URL=redis://localhost:6379
MEMORY_ENABLED=true
```
*Note: If Redis is unavailable or fails to connect, the orchestrator automatically logs a warning and falls back to `InMemoryService` in RAM.*

### 3. Claude (Anthropic AI)
For real-time multi-modal screen capture analysis and chat responses.
```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
CLAUDE_MODEL=claude-opus-5-5   # default
CLAUDE_EFFORT=low              # raise to medium/high for harder diagrams
```
Responses use structured outputs (JSON schema), the system prompt is prompt-cached, and refusals fall back server-side.

### Cartesia (Voice)
Streaming Sonic text-to-speech and Ink speech-to-text. The orchestrator only mints short-lived access tokens; the desktop app streams audio directly to/from Cartesia. Falls back to the system voice and browser speech recognition when unset.
```env
CARTESIA_API_KEY=sk_car_your-key
CARTESIA_VOICE_ID=your-voice-id
```

### 4. Browserbase (Research Mode)
Allows the tutor to spawn headless browser sessions to search Wikipedia/web resources for tutoring material.
```env
BROWSERBASE_ENABLED=true
BROWSERBASE_API_KEY=your-api-key
BROWSERBASE_PROJECT_ID=your-project-id
```

### 5. Simular (Co-drive Actions)
Proposes desktop actions (clicks, keypresses) that the user can review and approve.
```env
SIMULAR_ENABLED=true
SIMULAR_API_KEY=your-simular-key
ENABLE_SAFE_ACTIONS=true
```

### 6. Fetch AI / Agentverse (Specialist Agent Routing)
Registers and routes tutoring tasks to local or remote Fetch-compatible agents.
```env
FETCH_AGENTVERSE_ENABLED=true
FETCH_AGENTVERSE_API_KEY=your-agentverse-key
FETCH_AGENTVERSE_AGENT_ADDRESS=agent-address-here
```

### 7. Arize / Phoenix (Observability Tracing)
Tracks telemetry spans, latency metrics, and LLM evaluations.
```env
ARIZE_ENABLED=true
ARIZE_API_KEY=your-arize-key
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006/v1/traces
```

### 8. Sentry (Error Tracking)
Captures backend runtime errors and desktop crashes.
```env
SENTRY_ENABLED=true
SENTRY_DSN=https://your-dsn-key@o0.ingest.sentry.io/0
```

---

## Privacy Model & Redaction

- **On-Demand Capture Only**: Captures the screen only when the hotkey is triggered. No background polling or recordings.
- **Sensitive Window Denylist**: Analysis is immediately blocked if any of the 16 sensitive window title terms (e.g. `password`, `keychain`, `bank`, `email`, `stripe`) are active.
- **Data Redaction Layer**: A shared `RedactionService` automatically strips passwords, API keys, emails, credit cards, and query parameters from all logs, Sentry events, Arize telemetry, and UI debug views.
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

### `Error: connect ECONNREFUSED 127.0.0.1:6379`
- **Cause**: Redis container is not running.
- **Fix**: Redis is completely optional. The app falls back to memory storage. To enable Redis, start the container: `docker compose up -d redis`.

### Hotkey `Ctrl+Shift+E` Not Working
- **macOS**: Ensure Electron has **Accessibility** permissions granted in System Preferences → Privacy & Security → Accessibility.
- **Windows**: Run as Administrator if hotkeys are intercepted by other fullscreen windows.

### Screen Capture Black / Empty
- **macOS**: Ensure Electron has **Screen Recording** permissions granted in System Preferences → Privacy & Security → Screen Recording.

### `listen EADDRINUSE :::4317`
- **Cause**: Port 4317 is already in use by another process.
- **Fix**: Change `ORCHESTRATOR_PORT` in your `.env` file to a free port.
