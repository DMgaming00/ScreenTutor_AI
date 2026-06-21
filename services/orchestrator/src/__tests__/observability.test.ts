import { describe, it, expect, beforeEach } from 'vitest';
import { NoopObservabilityService, ArizePhoenixObservabilityService } from '../observability/observability-service.js';
import { TutorOrchestrator } from '../orchestrator/tutor-orchestrator.js';
import { MockClaudeProvider } from '../providers/mock-provider.js';
import { InMemoryService } from '../memory/in-memory.js';
import { AgentRouter } from '../agents/agent-router.js';
import { MockBrowserbaseService } from '../integrations/browserbase.js';
import { MockSimularService } from '../integrations/simular.js';
import type { TutorInput } from '@screentutor/shared';

describe('NoopObservabilityService', () => {
  it('handles tracing without emitting OTLP logs', () => {
    const obs = new NoopObservabilityService();
    expect(obs.isConfigured()).toBe(false);
    
    const traceId = obs.startTrace('trace-noop');
    expect(traceId).toBeDefined();
    expect(traceId.length).toBe(32);

    const spanId = obs.addSpan(traceId, 'span-noop');
    expect(spanId).toBeDefined();
    expect(spanId.length).toBe(16);
  });
});

describe('ArizePhoenixObservabilityService metadata scrubbing', () => {
  it('scrubs passwords, api keys, and accessibility trees', () => {
    const obs = new ArizePhoenixObservabilityService('', 'http://localhost:6006/v1/traces');
    expect(obs.isConfigured()).toBe(true);

    const traceId = obs.startTrace('trace-secure', {
      apiKey: 'secret_anthropic_key',
      password: 'mypassword123',
      windowTitle: 'Super Password Manager',
      accessibilityTree: { nodes: [{ id: '1', role: 'button', name: 'Submit' }] },
      mode: 'quiz'
    });

    const activeTrace = (obs as any).activeTraces.get(traceId);
    expect(activeTrace).toBeDefined();
    expect(activeTrace.metadata.apiKey).toBe('[REDACTED]');
    expect(activeTrace.metadata.password).toBe('[REDACTED]');
    expect(activeTrace.metadata.windowTitlePresent).toBe(true);
    expect(activeTrace.metadata.accessibilityTreeNodesCount).toBe(1);
    expect(activeTrace.metadata.mode).toBe('quiz');
  });
});

describe('TutorOrchestrator Evaluations Integration', () => {
  let orchestrator: TutorOrchestrator;
  let obs: ArizePhoenixObservabilityService;

  beforeEach(() => {
    const memory = new InMemoryService();
    const bb = new MockBrowserbaseService();
    const ai = new MockClaudeProvider();
    obs = new ArizePhoenixObservabilityService('', 'http://localhost:6006/v1/traces');
    orchestrator = new TutorOrchestrator(
      ai,
      memory,
      new AgentRouter(ai, memory, bb),
      bb,
      new MockSimularService(),
      obs
    );
  });

  it('runs evaluations on handles questions and populates response observability metadata', async () => {
    const input: TutorInput = {
      userId: 'user_123',
      sessionId: 'sess_123',
      mode: 'quiz',
      question: 'quiz me on derivatives'
    };

    const response = await orchestrator.handleQuestion(input);
    expect(response.observability).toBeDefined();
    expect(response.observability!.traceId).toBeDefined();
    expect(response.observability!.latencyMs).toBeGreaterThanOrEqual(0);

    const evals = response.observability!.evaluations;
    expect(evals.point_tag_valid).toBeDefined();
    expect(evals.response_under_3_sentences).toBeDefined();
    expect(evals.quiz_has_hidden_answer).toBeDefined();
    expect(evals.drawing_coordinates_valid).toBeDefined();
    expect(evals.safety_redaction_passed).toBeDefined();
    expect(evals.selected_agent_reasonable).toBeDefined();

    expect(evals.point_tag_valid.score).toBe(1);
    expect(evals.quiz_has_hidden_answer.score).toBe(1);
    expect(evals.drawing_coordinates_valid.score).toBe(1);
    expect(evals.safety_redaction_passed.score).toBe(1);
  });
});
