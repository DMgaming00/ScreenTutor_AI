import { AIProvider } from './ai-provider.js';
import { TutorInput, TutorResponse } from '@screentutor/shared';
import { MockClaudeProvider } from './mock-provider.js';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private mockFallback = new MockClaudeProvider();

  constructor(private apiKey: string) {}

  async analyzeScreenAndQuestion(input: TutorInput): Promise<TutorResponse> {
    if (!this.apiKey) {
      console.warn('OpenAI API Key not configured. Falling back to MockAIProvider.');
      return this.mockFallback.analyzeScreenAndQuestion(input);
    }
    // TODO: Implement OpenAI Vision API integration
    console.log('OpenAI integration stubbed out. Falling back to mock.');
    return this.mockFallback.analyzeScreenAndQuestion(input);
  }
}
