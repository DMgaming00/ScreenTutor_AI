import { AIProvider } from './ai-provider.js';
import { TutorInput, TutorResponse, prepareOverlayText, stripForTts } from '@screentutor/shared';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { buildUserPrompt, TUTOR_SYSTEM_PROMPT } from '../prompts/tutor-system-prompt.js';
import { JsonStringFieldStreamer } from './json-field-stream.js';

/**
 * Structured-output schema for every tutor turn. Property order matters:
 * `spokenText` is generated first so it can stream to the client early.
 */
export const TUTOR_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    spokenText: { type: 'string' },
    visualText: { type: 'string' },
    summary: { type: 'string' },
    concept: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: ['spokenText', 'visualText', 'summary', 'concept', 'confidence'],
  additionalProperties: false,
} as const;

/** Server-side refusal fallback, routed by refusal category. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

type MediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';

export class ClaudeProvider implements AIProvider {
  readonly name = 'claude';
  private anthropic: Anthropic;

  constructor(private apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  async analyzeScreenAndQuestion(
    input: TutorInput,
    onDelta?: (text: string) => void,
    systemPromptOverride?: string
  ): Promise<TutorResponse> {
    if (!this.apiKey) {
      throw new Error('Anthropic API Key not configured.');
    }

    const promptText = buildUserPrompt({
      question: input.question,
      mode: input.mode,
      learnerMemory: input.learnerMemory,
      recentTurns: input.recentTurns,
      screenMetadata: input.screenMetadata,
      appMetadata: input.appMetadata,
      accessibilityTree: input.accessibilityTree,
      researchContext: input.researchContext,
    });

    const content: Anthropic.ContentBlockParam[] = [];
    const image = parseDataUrl(input.screenshotBase64);
    if (image) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: image.mediaType, data: image.data },
      });
    }
    content.push({ type: 'text', text: promptText });

    try {
      const stream = this.anthropic.beta.messages.stream({
        model: config.CLAUDE_MODEL,
        max_tokens: config.CLAUDE_MAX_TOKENS,
        system: buildSystemBlocks(systemPromptOverride),
        messages: [{ role: 'user', content }],
        output_config: {
          effort: config.CLAUDE_EFFORT,
          format: { type: 'json_schema', schema: TUTOR_OUTPUT_SCHEMA },
        },
        betas: [FALLBACK_BETA],
        // SDK types only model the array form; "default" picks the fallback per refusal category.
        fallbacks: 'default' as unknown as Anthropic.Beta.Messages.BetaFallbackParam[],
      });

      if (onDelta) {
        const spoken = new JsonStringFieldStreamer('spokenText', onDelta);
        stream.on('text', (textDelta) => spoken.push(textDelta));
      }

      const finalMessage = await stream.finalMessage();
      logUsage(finalMessage.usage);

      if (finalMessage.stop_reason === 'refusal') {
        throw new Error('Claude declined to answer this request.');
      }
      if (finalMessage.stop_reason === 'max_tokens') {
        throw new Error(`Claude response hit max_tokens (${config.CLAUDE_MAX_TOKENS}) before finishing.`);
      }

      const textResponse = finalMessage.content
        .filter((block): block is Anthropic.Beta.Messages.BetaTextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const parsed = JSON.parse(textResponse);

      const rawSpoken = parsed.spokenText || '';
      const rawVisual = parsed.visualText || '';
      const prepared = prepareOverlayText(rawSpoken, rawVisual);

      parsed.overlayText = prepared.overlayText;
      parsed.visualText = prepared.displayText;
      parsed.spokenText = stripForTts(rawSpoken);
      parsed.spokenExplanation = parsed.spokenText;
      parsed.pointTarget = prepared.pointTarget;
      if (input.screenMetadata?.screenNumber != null && parsed.pointTarget) {
        parsed.pointTarget.screenNumber = input.screenMetadata.screenNumber;
      }
      parsed.drawings = [];

      if (!/\[DRAW:/i.test(prepared.overlayText)) {
        console.warn(
          '[Tutor] Response overlayText has no [DRAW:*] tags — shapes may not render. visualText length:',
          rawVisual.length
        );
      } else {
        console.log('[Tutor] overlayText includes spatial tags (DRAW/POINT)');
      }
      parsed.concept = parsed.concept || 'General Explanation';
      parsed.confidence = parsed.confidence ?? 1.0;
      parsed.summary = parsed.summary || prepared.displayText.slice(0, 80) || 'Explanation';
      parsed.mode = parsed.mode || input.mode;
      parsed.provider = 'claude';
      parsed.timestamp = new Date().toISOString();
      parsed.rawModelText = textResponse;

      TutorResponse.parse(parsed);
      return parsed as TutorResponse;
    } catch (error) {
      console.error('Claude request or validation failed:', error);
      throw error;
    }
  }
}

/**
 * Base prompt and per-agent override as separate blocks, each a cache breakpoint:
 * the base prefix is shared by every agent, the override is stable per agent.
 * Nothing volatile (question, screenshot, memory) goes in the system prompt.
 */
export function buildSystemBlocks(systemPromptOverride?: string): Anthropic.Beta.Messages.BetaTextBlockParam[] {
  const blocks: Anthropic.Beta.Messages.BetaTextBlockParam[] = [
    { type: 'text', text: TUTOR_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
  ];
  if (systemPromptOverride) {
    blocks.push({ type: 'text', text: systemPromptOverride, cache_control: { type: 'ephemeral' } });
  }
  return blocks;
}

export function parseDataUrl(dataUrl?: string): { mediaType: MediaType; data: string } | null {
  const match = dataUrl ? /^data:(image\/(?:png|jpeg|gif|webp));base64,(.+)$/s.exec(dataUrl) : null;
  if (!match) return null;
  return { mediaType: match[1] as MediaType, data: match[2] };
}

function logUsage(usage: Anthropic.Beta.Messages.BetaUsage): void {
  console.log(
    `[Tutor] tokens in=${usage.input_tokens} cache_read=${usage.cache_read_input_tokens ?? 0} ` +
      `cache_write=${usage.cache_creation_input_tokens ?? 0} out=${usage.output_tokens}`
  );
}
