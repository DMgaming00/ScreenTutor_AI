# Sponsor Integrations — ScreenTutor AI

ScreenTutor AI integrates exactly seven sponsor technologies. Each integration has a clean interface abstraction with a fully functional mock fallback that runs locally out of the box without requiring external API keys.

---

## 1. Claude (Anthropic AI)

### Why It Is Used
Claude is used for visual screen understanding and multi-modal reasoning. It acts as the "brain" of ScreenTutor, reading screenshot pixels and answering tutoring questions by returning structured responses (hints, drawing commands, and speech outputs).

### What Code Uses It
- **[anthropic-provider.ts](file:///C:/Users/User/Desktop/2nd_brain/services/orchestrator/src/providers/anthropic-provider.ts)**: Implements the `AIProvider` interface, making raw POST requests to the Anthropic Messages API.
- **[mock-provider.ts](file:///C:/Users/User/Desktop/2nd_brain/services/orchestrator/src/providers/mock-provider.ts)**: Mock fallback.

### Real vs. Mock Behavior
- **Real**: Sends the base64 screenshot and prompt to Claude Sonnet, returning a structured JSON matching `TutorResponse`.
- **Mock**: Matches the selected demo lesson ID and query keyword to return a deterministic, structured tutoring response with precise overlay drawing paths.

### Env Vars
- `AI_PROVIDER=claude` (to activate real Claude)
- `ANTHROPIC_API_KEY=sk-ant-...`
- `CLAUDE_MODEL=claude-3-5-sonnet-20241022`

### Data Sent
- Base64 image strings of the captured screen (sent only on explicit user action).
- Question text submitted by the user.

### Privacy Protections
- Screen capture is blocked entirely if privacy mode is active or the active window title contains key terms on the denylist.
- Screenshots are processed in memory and never written to disk or logged.

### Demo Step
1. Open the bundled **Calculus: u-substitution** lesson.
2. Ask *"Explain this integral"*.
3. Watch the overlay drawings appear instantly based on the mock visual analysis.

---

## 2. Redis

### Why It Is Used
Redis provides fast, persistent storage for learner profiles, weak concepts, session turns, and recent questions.

### What Code Uses It
- **[redis-memory.ts](file:///C:/Users/User/Desktop/2nd_brain/services/orchestrator/src/memory/redis-memory.ts)**: Implements `MemoryService` using the `ioredis` package.
- **[in-memory.ts](file:///C:/Users/User/Desktop/2nd_brain/services/orchestrator/src/memory/in-memory.ts)**: InMemory RAM fallback.

### Real vs. Mock Behavior
- **Real**: Reads/writes profiles (`screentutor:profile:{userId}`) and appends session turns (`screentutor:session:{sessionId}:turns`) to Redis.
- **Mock / Fallback**: If `REDIS_URL` is omitted or connection fails, the orchestrator prints a warning and falls back to `InMemoryService` in RAM.

### Env Vars
- `REDIS_URL=redis://localhost:6379`
- `MEMORY_ENABLED=true`

### Data Sent
- Learner profile metadata (weak/strong concepts, confidence metrics, and rolling lists of summarized questions).
- Session turn metadata (timestamps, selected agent, coordinate validity, and screenshot hashes).

### Privacy Protections
- Raw screenshots are **never** written to Redis; only the MD5 hash is stored.
- Memory updates are completely skipped if memory is disabled in the profile or if privacy mode is active.

### Demo Step
1. Trigger a lesson question and review the updated weak concepts list.
2. Open the **Memory** panel to view the saved profiles.
3. Toggle memory recording off and verify that no subsequent questions are logged.
4. Click **Clear Memory** to execute the database purge.

---

## 3. Browserbase

### Why It Is Used
Browserbase is a headless browser platform used to navigate educational websites and scrape context summaries when the user enters **Research** mode.

### What Code Uses It
- **[browserbase.ts](file:///C:/Users/User/Desktop/2nd_brain/services/orchestrator/src/integrations/browserbase.ts)**: Handles REST API calls to the Browserbase service.
- **[resource-finder.ts](file:///C:/Users/User/Desktop/2nd_brain/services/orchestrator/src/agents/resource-finder.ts)**: Routes requests to Browserbase.

### Real vs. Mock Behavior
- **Real**: Spawns a headless browser session to request a page (e.g. Wikipedia), retrieves the content in markdown format, and extracts key takeaways.
- **Mock**: Returns predefined summaries and citation urls immediately.

### Env Vars
- `BROWSERBASE_ENABLED=true`
- `BROWSERBASE_API_KEY=your-key`
- `BROWSERBASE_PROJECT_ID=your-project-id`

### Data Sent
- The research query topic or concept keywords (e.g. `u_substitution`, `chain_rule`).

### Privacy Protections
- Requests are blocked if the user is in privacy mode or focused on a denied application title.

### Demo Step
1. Switch to the **Research** tab.
2. Submit the question *"Research u-substitution techniques"*.
3. Review the returned markdown summary card with source citation URLs.

---

## 4. Simular

### Why It Is Used
Simular provides agentic computer control capabilities to propose keyboard/mouse interactions on the user's desktop when in **Co-drive** mode.

### What Code Uses It
- **[simular.ts](file:///C:/Users/User/Desktop/2nd_brain/services/orchestrator/src/integrations/simular.ts)**: Implements the Simular proposed action interfaces.

### Real vs. Mock Behavior
- **Real**: Resolves natural language goals to mouse click coordinate vectors and inputs text using Simular's model.
- **Mock**: Returns simulated, safe action items (e.g., clicking a "Next Problem" button).

### Env Vars
- `SIMULAR_ENABLED=true`
- `SIMULAR_API_KEY=your-simular-key`
- `ENABLE_SAFE_ACTIONS=true` (global safety switch)

### Data Sent
- Target question and active application window title.

### Privacy Protections
- All actions require **explicit user approval** in the UI via card interfaces before they are executed.
- `checkActionSafety` blocks any high-risk action descriptions (e.g., matching terminal, buying, deleting files, or password inputs).
- Blocked in privacy mode.

### Demo Step
1. Open the **Co-drive** tab.
2. Observe the proposed mouse click cards matching your task context.
3. Show the risk badge level indicator (e.g. `Low Risk`).
4. Click **Approve** or **Reject** to test the verification check.

---

## 5. Fetch AI / Agentverse

### Why It Is Used
Fetch AI inspired the multi-agent routing model of ScreenTutor. Agent Router routes queries to specialized sub-agents based on context keywords and modes.

### What Code Uses It
- **[agent-router.ts](file:///C:/Users/User/Desktop/2nd_brain/services/orchestrator/src/agents/agent-router.ts)**: Coordinates agent routing.
- **[fetch-provider.ts](file:///C:/Users/User/Desktop/2nd_brain/services/orchestrator/src/agents/fetch-provider.ts)**: Integrates with Agentverse endpoints.

### Real vs. Mock Behavior
- **Real**: Looks up published agent addresses on the Agentverse directory and delegates reasoning to them.
- **Mock / Local**: Routes queries locally to standard agent classes (`MathTutor`, `MisconceptionDetector`, `QuizGenerator`, `LearningPlan`, `ResourceFinder`).

### Env Vars
- `FETCH_AGENTVERSE_ENABLED=true`
- `FETCH_AGENTVERSE_API_KEY=your-fetch-key`
- `FETCH_AGENTVERSE_AGENT_ADDRESS=agent-address-here`

### Data Sent
- User questions and preference settings.

### Privacy Protections
- Local-first execution falls back to local routing if Agentverse credentials are not provided.
- Denylisted text and raw screenshots are stripped from the payload prior to routing.

### Demo Step
1. Type *"Quiz me on derivatives"* in the prompt.
2. Look at the terminal logs to see the routing decision: `[Agent Router Routing Decision] Routing query: "Quiz me..." to QuizGeneratorAgent.`

---

## 6. Arize

### Why It Is Used
Arize/Phoenix is used for large language model (LLM) observability. It records trace spans, logs execution steps (AI model call, memory writes, research lookups), captures latencies, and logs evaluations.

### What Code Uses It
- **[observability-service.ts](file:///C:/Users/User/Desktop/2nd_brain/services/orchestrator/src/observability/observability-service.ts)**: Sends tracing spans to the Arize Phoenix collector.

### Real vs. Mock Behavior
- **Real**: Resolves traces and POSTs telemetry spans to local or cloud Phoenix collectors.
- **Mock**: Prints clean telemetry summaries to the server console out.

### Env Vars
- `ARIZE_ENABLED=true`
- `ARIZE_API_KEY=your-arize-key`
- `PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006/v1/traces`

### Data Sent
- Spans, execution times, latency metrics, input prompt strings (redacted), and model parameters.

### Privacy Protections
- A shared `RedactionService` scrubs screenshots, accessibility trees, query parameters, passwords, and emails from all logs before they are posted to Phoenix.

### Demo Step
1. Submit a question in the desktop UI.
2. View the console logs to see the trace ID and evaluations printed (e.g. `point_tag_valid=1`).

---

## 7. Sentry

### Why It Is Used
Sentry provides runtime exception reporting and crash analytics for the desktop main process, Electron renderer, and orchestrator backend.

### What Code Uses It
- **[sentry.ts (desktop main)](file:///C:/Users/User/Desktop/2nd_brain/apps/desktop/src/main/sentry.ts)**: Configures Sentry Node for Electron.
- **[sentry.ts (desktop renderer)](file:///C:/Users/User/Desktop/2nd_brain/apps/desktop/src/renderer/sentry.ts)**: Configures Sentry React.
- **[sentry.ts (orchestrator)](file:///C:/Users/User/Desktop/2nd_brain/services/orchestrator/src/observability/sentry.ts)**: Configures Sentry on the Fastify backend.

### Real vs. Mock Behavior
- **Real**: Transmits crash stack traces and performance profiling directly to Sentry dashboard.
- **Mock / Disabled**: Silently logs exceptions to the local console without making external posts.

### Env Vars
- `SENTRY_ENABLED=true`
- `SENTRY_DSN=https://your-dsn-key@o0.ingest.sentry.io/0`

### Data Sent
- Error message strings, trace stacks, system details (OS version, Electron version).

### Privacy Protections
- All events are scrubbed recursively through `RedactionService.redactMetadata` inside Sentry's `beforeSend` interceptors. API keys, emails, passwords, and raw base64 screenshots are completely redacted.

### Demo Step
1. Trigger a mock error using the debug button in the desktop UI.
2. Verify in Sentry panel that the error was recorded with all sensitive data redacted.
