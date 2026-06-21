# 3-Minute Demo Script — ScreenTutor AI

This script guides you through a compelling 3-minute live demonstration of ScreenTutor AI.

---

## Setup & Preparation (30 seconds)
1. Launch ScreenTutor:
   ```bash
   powershell -ExecutionPolicy Bypass -Command "pnpm dev"
   ```
2. Have the desktop application open. Ensure it is in mock mode (default, no API keys required).
3. Open the developer debug panel in the UI.

---

## 0:00 — Hook & The Bundled Lesson (30s)
1. **Say**: *"ScreenTutor AI is a cursor-native AI tutor. It lives as a floating buddy near your cursor and captures screen contents only when triggered. Let's open our bundled lessons to see it in action."*
2. **Action**: Click the **Graduate Cap (🎓)** icon in the header.
3. **Action**: Select the **Calculus: u-substitution** lesson (`∫ 2x cos(x^2) dx`).
4. **Point out**: *"Notice that the application instantly locks onto the lesson context. We can demonstrate every capability offline without relying on external websites or paid API accounts."*

---

## 0:30 — Request Explanation & Buddy Pointing (45s)
1. **Action**: In the chat input, type: *"Explain this integral"* and press Enter.
2. **Say**: *"The request routes to our MathTutorAgent. Watch how Buddy responds and draws annotations directly on top of the screen."*
3. **Action**: Point out the transparent SVG overlay drawing:
   - A highlighted box over `u = x^2`.
   - Drawing arrows showing the substitution.
4. **Action**: Observe the Buddy window moving (flying) smoothly to snap near the highlighted integral.
5. **Say**: *"Buddy uses our Normalized Coordinates utility to calculate the high-DPI scaling factor and display offsets, letting Buddy fly directly to point at the target element."*

---

## 1:15 — Hint Mode & Redis Memory (45s)
1. **Action**: Switch to the **Hint** tab. Type: *"Give me a hint, not the answer"* and submit.
2. **Say**: *"Instead of giving the final solution, ScreenTutor uses a Hint Ladder, starting with a conceptual hint and progressing step-by-step."*
3. **Action**: Click the **Memory** panel (🧠 icon).
4. **Say**: *"Because we requested help, our Redis Memory Service immediately logged 'u_substitution' as a weak concept in our persistent profile. It tracks our learning history dynamically. Let's check the profile logs."*

---

## 2:00 — Research & Agent Routing (30s)
1. **Action**: Switch to the **Research** tab. Type: *"Research u-substitution techniques"* and submit.
2. **Say**: *"Research mode uses Browserbase to launch a headless browser session, scrape Wiki references, and summarize them. Looking at our backend logs, we can see Fetch AI agent routing in action: it routed the query to our ResourceFinderAgent based on the context."*
3. **Action**: Point to the wiki summary card rendered in the chat panel.

---

## 2:30 — Action Co-driving & Safety (30s)
1. **Action**: Switch to the **Co-drive** tab.
2. **Say**: *"In Co-drive mode, ScreenTutor uses Simular to propose actions. It proposes clicking the next problem button."*
3. **Action**: Point out the proposed action card showing `requiresApproval: true` and the `Low Risk` badge.
4. **Say**: *"For safety, no action can execute automatically. The user has complete control to Approve or Reject every proposed step."*

---

## 3:00 — Observability: Arize & Sentry (30s)
1. **Action**: Point out the developer debug panel in the UI.
2. **Say**: *"Finally, every step of our AI pipeline is instrumented. We log trace spans to Arize Phoenix and exceptions to Sentry. To protect learner privacy, our shared Redaction Service automatically scrubs raw screenshots, API keys, passwords, and emails from all logs. If we toggle the Developer Override checkbox, we can inspect the raw tracing parameters locally for debugging."*
3. **Say**: *"ScreenTutor AI — a visual, safe, and agentic tutor right at your cursor. Thank you!"*
