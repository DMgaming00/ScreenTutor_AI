import { AIProvider } from './ai-provider.js';
import { TutorInput, TutorResponse, prepareOverlayText, stripForTts } from '@screentutor/shared';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { buildUserPrompt, TUTOR_SYSTEM_PROMPT } from '../prompts/tutor-system-prompt.js';
import { buildCoordinateGuide } from '@screentutor/shared';

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
      screenMetadata: input.screenMetadata,
      appMetadata: input.appMetadata,
      accessibilityTree: input.accessibilityTree,
      researchContext: input.researchContext,
    });

    const base64Data = input.screenshotBase64?.split(',')[1] || '';
    const mediaType = input.screenshotBase64?.split(';')[0].split(':')[1] || 'image/png';

    const content: Anthropic.MessageParam['content'] = [];
    if (base64Data) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
          data: base64Data,
        },
      });
    }
    content.push({ type: 'text', text: promptText });

    try {
      let textResponse = '';
      const selectedPrompt = systemPromptOverride
        ? `${TUTOR_SYSTEM_PROMPT}\n\n${systemPromptOverride}`
        : TUTOR_SYSTEM_PROMPT;

      if (onDelta) {
        const stream = this.anthropic.messages.stream({
          model: config.CLAUDE_MODEL,
          max_tokens: 8000,
          system: selectedPrompt,
          messages: [{ role: 'user', content }],
        });

        let isAccumulatingSpoken = false;
        let hasSpokenKeyBeenFound = false;

        stream.on('text', (textDelta) => {
          textResponse += textDelta;

          if (!hasSpokenKeyBeenFound) {
            const keyIndex = textResponse.indexOf('"spokenText"');
            if (keyIndex !== -1) {
              const colonIndex = textResponse.indexOf(':', keyIndex);
              const firstQuoteIndex = colonIndex !== -1 ? textResponse.indexOf('"', colonIndex) : -1;
              if (firstQuoteIndex !== -1) {
                hasSpokenKeyBeenFound = true;
                const valStart = firstQuoteIndex + 1;
                if (textResponse.length > valStart) {
                  const initialText = textResponse.substring(valStart);
                  isAccumulatingSpoken = true;
                  for (let i = 0; i < initialText.length; i++) {
                    const char = initialText[i];
                    if (char === '"' && (i === 0 || initialText[i - 1] !== '\\')) {
                      isAccumulatingSpoken = false;
                      break;
                    }
                    onDelta(char);
                  }
                } else {
                  isAccumulatingSpoken = true;
                }
              }
            }
          } else if (isAccumulatingSpoken) {
            for (let i = 0; i < textDelta.length; i++) {
              const char = textDelta[i];
              const absIdx = textResponse.length - textDelta.length + i - 1;
              if (char === '"' && textResponse[absIdx] !== '\\') {
                isAccumulatingSpoken = false;
                break;
              }
              onDelta(char);
            }
          }
        });

        const finalMessage = await stream.finalMessage();
        textResponse = finalMessage.content?.[0]?.type === 'text' ? finalMessage.content[0].text : '';
      } else {
        const response = await this.anthropic.messages.create({
          model: config.CLAUDE_MODEL,
          max_tokens: 8000,
          system: selectedPrompt,
          messages: [{ role: 'user', content }],
        });
        textResponse = response.content?.[0]?.type === 'text' ? response.content[0].text : '';
      }

      const jsonStart = textResponse.indexOf('{');
      if (jsonStart === -1) {
        throw new Error(`Failed to find JSON block in Claude response: ${textResponse}`);
      }

      let braceCount = 0;
      let inString = false;
      let escapeNext = false;
      let jsonEnd = -1;

      for (let i = jsonStart; i < textResponse.length; i++) {
        const char = textResponse[i];
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '{') braceCount++;
          else if (char === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEnd = i;
              break;
            }
          }
        }
      }

      if (jsonEnd === -1) {
        jsonEnd = textResponse.lastIndexOf('}');
      }

      const parsed = JSON.parse(textResponse.substring(jsonStart, jsonEnd + 1));

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
