import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRouter } from '../agents/agent-router.js';
import { MockClaudeProvider } from '../providers/mock-provider.js';
import { InMemoryService } from '../memory/in-memory.js';
import { MockBrowserbaseService } from '../integrations/browserbase.js';
import { LocalAgentProvider, FetchAgentverseProvider } from '../agents/fetch-provider.js';
import type { TutorInput } from '@screentutor/shared';

describe('AgentRouter Routing Rules', () => {
  let router: AgentRouter;

  beforeEach(() => {
    const ai = new MockClaudeProvider();
    const memory = new InMemoryService();
    const bb = new MockBrowserbaseService();
    router = new AgentRouter(ai, memory, bb);
  });

  it('routes misconception keywords to MisconceptionDetectorAgent', async () => {
    const input: TutorInput = {
      userId: 'u1',
      sessionId: 's1',
      mode: 'explain',
      question: 'What mistake did I make here?'
    };
    const decision = await router.route(input);
    expect(decision.selectedAgent).toBe('MisconceptionDetectorAgent');
    expect(decision.reason).toContain('misconception');
  });

  it('routes quiz keywords or mode to QuizGeneratorAgent', async () => {
    const input: TutorInput = {
      userId: 'u1',
      sessionId: 's1',
      mode: 'quiz',
      question: 'Quiz me on derivatives'
    };
    const decision = await router.route(input);
    expect(decision.selectedAgent).toBe('QuizGeneratorAgent');
  });

  it('routes research keywords or mode to ResourceFinderAgent', async () => {
    const input: TutorInput = {
      userId: 'u1',
      sessionId: 's1',
      mode: 'research',
      question: 'Find simpler explanation of limits'
    };
    const decision = await router.route(input);
    expect(decision.selectedAgent).toBe('ResourceFinderAgent');
  });

  it('routes review keywords or mode to LearningPlanAgent', async () => {
    const input: TutorInput = {
      userId: 'u1',
      sessionId: 's1',
      mode: 'review',
      question: 'What should I study next?'
    };
    const decision = await router.route(input);
    expect(decision.selectedAgent).toBe('LearningPlanAgent');
  });

  it('defaults to MathTutorAgent', async () => {
    const input: TutorInput = {
      userId: 'u1',
      sessionId: 's1',
      mode: 'explain',
      question: 'Calculate the integral of 2x'
    };
    const decision = await router.route(input);
    expect(decision.selectedAgent).toBe('MathTutorAgent');
  });
});

describe('FetchAgentverseProvider', () => {
  it('returns unconfigured response if API keys are missing', async () => {
    const provider = new FetchAgentverseProvider('', '', {});
    expect(provider.isConfigured()).toBe(false);

    const input: TutorInput = {
      userId: 'u1',
      sessionId: 's1',
      mode: 'explain',
      question: 'Explain'
    };

    const routing = await provider.route(input);
    expect(routing.provider).toContain('Unconfigured');

    const output = await provider.execute('MathTutorAgent', input);
    expect(output.response.concept).toBe('unconfigured_error');
    expect(output.response.summary).toContain('is not configured');
  });
});
