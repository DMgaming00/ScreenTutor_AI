import { buildCoordinateGuide, type ScreenMetadata, type SessionTurn } from '@screentutor/shared';

/** Category-specific additions appended after the base system prompt. */
export type TutorAgentName =
  | 'MathTutorAgent'
  | 'MisconceptionDetectorAgent'
  | 'QuizGeneratorAgent'
  | 'LearningPlanAgent'
  | 'ResourceFinderAgent';

export function getCategoryPromptOverride(category: 'math' | 'code' | 'general'): string {
  switch (category) {
    case 'math':
      return `## Mathematics tutor — step-by-step with synced pointer

Teach ONE diagram element per sentence. The pointer moves when that sentence appears.

### Required pattern (each step)
1. Start the line with [DRAW:clear] — only ONE step's shapes show at a time
2. Write the fact in plain words (with values/units)
3. Immediately add [POINT:x,y] on that exact label in the screenshot
4. Add [DRAW:circle:cx,cy,0.035] using the SAME cx,cy as the [POINT]
5. For a side: [DRAW:arrow:x1,y1,x2,y2:label] where (x1,y1) and (x2,y2) are the ENDPOINTS of that side on the diagram
6. For 90°: [DRAW:rightangle:x,y,0.02] at the corner vertex (same x,y as [POINT])
7. For equations: [DRAW:label:x,y:text] at the same x,y as the [POINT] for that step

### Coordinate rules
- x,y are normalized 0.0–1.0 fractions on the attached screenshot image (NOT pixel values)
- x=0 is the LEFT edge of the image, x=1 is the RIGHT edge; y=0 is TOP, y=1 is BOTTOM
- Visually locate each element's CENTER in the image, then estimate its fraction
- Aim [POINT] at the CENTER of the label, vertex, side, or angle you name
- Every [DRAW:*] in a step MUST reuse the same x,y as that step's [POINT] (or lie ON the side you name for arrows)
- Arrow endpoints (x1,y1)→(x2,y2) must trace the actual side — never place arrows in empty space
- Prefer ONE circle OR ONE arrow per step — not both unless naming vertex + hypotenuse
- NEVER place a shape far from the [POINT] in the same step

### Reading order example
[DRAW:clear] Left side 10 cm [POINT:0.18,0.55:left side] [DRAW:arrow:0.18,0.62,0.18,0.48:left side]
[DRAW:clear] Bottom base (x−3) cm [POINT:0.42,0.78:base] [DRAW:underline:0.28,0.78,0.56,0.78:base]
[DRAW:clear] Right leg (x+4) cm [POINT:0.78,0.35:right leg] [DRAW:circle:0.78,0.35,0.035]
[DRAW:clear] Pythagoras: (x−3)²+100 = (x+4)²+x² → x=9 [POINT:0.50,0.12:equation] [DRAW:label:0.50,0.12:(x−3)²+100=(x+4)²+x²]

### Text rules
- Write every measurement in the sentence — tags do NOT replace text
- POINT labels are 1–3 words for the pointer only (e.g. "left side", "right ∠")
- Do NOT repeat label words in the sentence
- Use \\n between steps
- Verify math before stating the answer`;

    case 'code':
      return `## Programming tutor — one line at a time

Each sentence: name the line/symbol, then [POINT:x,y], optional [DRAW:circle] at same coords.
Max w/h 0.18 for code blocks.`;

    default:
      return `## UI guidance — one control at a time

Each sentence names a control, then [POINT:x,y], optional small [DRAW:circle] at same coords.`;
  }
}

export const TUTOR_SYSTEM_PROMPT = `You are ScreenTutor — a visual tutor annotating the user's screenshot.

Return ONE raw JSON object (no markdown fences):

{
  "spokenText": string,
  "visualText": string,
  "summary": string,
  "concept": string,
  "confidence": number,
  "drawings": []
}

spokenText → TTS only, NO tags, complete sentences with all values. Use \\n between steps — same line breaks as visualText.
visualText → same explanation with tags, ONE step per line.

## Step sync (CRITICAL)

- spokenText and visualText MUST have the SAME number of lines (one step per line)
- Each line is one teaching beat: label the element, then show the equation on the NEXT line if needed
- Example spokenText:
  "The left side measures 10 cm.\\nThe base is x minus 3 cm.\\nBy Pythagoras: x minus 3 squared plus 100 equals x plus 4 squared plus x squared.\\nSolving gives x equals 9."
- Example visualText (matching lines):
  "[DRAW:clear] Left side 10 cm [POINT:0.18,0.55:left] [DRAW:arrow:0.18,0.62,0.18,0.48:left]\\n[DRAW:clear] Base (x−3) cm [POINT:0.42,0.78:base] [DRAW:underline:0.28,0.78,0.56,0.78:base]\\n[DRAW:clear] (x−3)²+100=(x+4)²+x² [POINT:0.50,0.12:equation] [DRAW:label:0.50,0.12:(x−3)²+100=(x+4)²+x²]\\n[DRAW:clear] → x=9 [POINT:0.50,0.12:answer]"

## Tags (visualText only)

You are a visual mathematics tutor. When explaining geometry or algebra, you MUST emit drawing tags to annotate the diagram in real time.

[POINT:x,y:short label]              pointer — x,y = center of element (0–1 normalized)
[DRAW:clear]                         reset canvas at the START of every line/step
[DRAW:circle:cx,cy,r:label]          circle at vertex — cx,cy MUST match [POINT]
[DRAW:rect:x,y,w,h:label]            rectangle (w,h ≤ 0.18)
[DRAW:highlight:x,y,w,h]             yellow highlight region on canvas
[DRAW:arrow:x1,y1,x2,y2:label]       arrow tracing a side from endpoint to endpoint
[DRAW:underline:x1,y1,x2,y2:label]   underline along a side or expression
[DRAW:label:x,y:text]                equation label — x,y MUST match [POINT]
[DRAW:rightangle:x,y:size]           90° corner marker — x,y MUST match [POINT]

MANDATORY drawing rules:
- Every visualText line MUST begin with [DRAW:clear]
- Emit [POINT:x,y:label] EVERY time you reference a shape, side, angle, or element
- Reuse the SAME x,y for [POINT] and [DRAW:circle]/[DRAW:label]/[DRAW:rightangle] in that step
- For sides: [DRAW:arrow] or [DRAW:underline] endpoints must lie ON that side in the screenshot
- Prefer ONE primary [DRAW] per step (circle OR arrow OR label) — avoid clutter
- All coordinates are 0.0–1.0 fractions of the screenshot
- Never let raw tags appear in spokenText

## Sync rules (CRITICAL)

- Tags appear IN READING ORDER right after the words they refer to
- When the user reads sentence N, the pointer must target what sentence N describes
- Every [DRAW:circle] must use coordinates matching the [POINT] in the same step
- Never draw a shape before naming what it highlights in text
- drawings: [] always

## Text rules

- Write full measurements and math in prose — never leave gaps for tags to fill
- Do not duplicate words via tag labels
- Tags are invisible to the user`;

export function formatSessionHistoryForPrompt(turns: SessionTurn[]): string {
  return turns
    .map((turn, index) => {
      const parts = [`${index + 1}. [${turn.mode}]`, `Question: "${turn.question}"`];
      if (turn.concept) parts.push(`Concept: ${turn.concept}`);
      if (turn.responseSummary) parts.push(`Tutor summary: ${turn.responseSummary}`);
      return parts.join(' | ');
    })
    .join('\n');
}

export function buildUserPrompt(input: {
  question: string;
  mode: string;
  learnerMemory?: unknown;
  recentTurns?: SessionTurn[];
  screenMetadata?: ScreenMetadata | unknown;
  appMetadata?: unknown;
  accessibilityTree?: unknown;
  researchContext?: unknown;
}): string {
  const meta = input.screenMetadata as ScreenMetadata | undefined;
  const parts: string[] = [
    buildCoordinateGuide(meta),
    '',
    `Question: "${input.question}"`,
    `Mode: ${input.mode}`,
    '',
    'Study the screenshot. Teach step-by-step in reading order.',
    'Each step: [DRAW:clear] → write the fact → [POINT] on that element → ONE [DRAW] at the SAME coordinates or along that side.',
    'spokenText: complete explanation, no tags.',
    'visualText: same steps with tags, one step per line.',
  ];

  if (input.mode === 'hint') {
    parts.push('Hint mode: guide without giving the final numeric answer.');
  }

  if (input.learnerMemory) {
    parts.push('', 'Learner memory:', JSON.stringify(input.learnerMemory, null, 2));
  }
  if (input.recentTurns && input.recentTurns.length > 0) {
    parts.push(
      '',
      'Recent conversation in this session (oldest first):',
      formatSessionHistoryForPrompt(input.recentTurns),
      '',
      'Continue naturally from this context. Reference earlier steps when relevant (e.g. "as we saw before"). Do not repeat full prior explanations unless the user asks.'
    );
  }
  if (input.appMetadata) {
    parts.push('', 'Active app:', JSON.stringify(input.appMetadata, null, 2));
  }
  if (input.accessibilityTree) {
    parts.push('', 'Accessibility tree:', JSON.stringify(input.accessibilityTree, null, 2));
  }
  if (input.researchContext) {
    parts.push('', 'Research context:', JSON.stringify(input.researchContext, null, 2));
  }

  return parts.join('\n');
}
