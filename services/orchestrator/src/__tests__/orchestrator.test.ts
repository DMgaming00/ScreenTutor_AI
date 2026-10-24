import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TutorOrchestrator } from '../orchestrator/tutor-orchestrator.js';
import { MockClaudeProvider } from '../providers/mock-provider.js';
import { InMemoryService } from '../memory/in-memory.js';
import { RedisMemoryService } from '../memory/redis-memory.js';
import { AgentRouter } from '../agents/agent-router.js';
import { MockResearchService } from '../integrations/research.js';
import { MockCoDriveService } from '../integrations/codrive.js';
import { NoopObservabilityService } from '../observability/observability-service.js';

let shouldRedisFail = false;

// Mock ioredis before imports/usage
vi.mock('ioredis', () => {
  const store = new Map<string, string>();
  const lists = new Map<string, string[]>();
  const sets = new Map<string, Set<string>>();

  function MockRedis(this: any) {
    this.connect = vi.fn().mockImplementation(async () => {
      if (shouldRedisFail) {
        throw new Error('Connection failed');
      }
    });
    this.ping = vi.fn().mockImplementation(async () => {
      if (shouldRedisFail) {
        throw new Error('Ping failed');
      }
      return 'PONG';
    });
    this.get = vi.fn().mockImplementation(async (key) => store.get(key) || null);
    this.set = vi.fn().mockImplementation(async (key, val) => {
      store.set(key, val);
      return 'OK';
    });
    this.rpush = vi.fn().mockImplementation(async (key, val) => {
      if (!lists.has(key)) lists.set(key, []);
      lists.get(key)!.push(val);
      return lists.get(key)!.length;
    });
    this.expire = vi.fn().mockResolvedValue(1);
    this.sadd = vi.fn().mockImplementation(async (key, val) => {
      if (!sets.has(key)) sets.set(key, new Set());
      sets.get(key)!.add(val);
      return 1;
    });
    this.lrange = vi.fn().mockImplementation(async (key, start, end) => {
      const list = lists.get(key) || [];
      return list.slice(start, end === -1 ? undefined : end + 1);
    });
    this.smembers = vi.fn().mockImplementation(async (key) => {
      return Array.from(sets.get(key) || new Set());
    });
    this.del = vi.fn().mockImplementation(async (key) => {
      store.delete(key);
      lists.delete(key);
      sets.delete(key);
      return 1;
    });
    this.pipeline = vi.fn().mockImplementation(() => {
      const chain: any[] = [];
      const pipelineObj = {
        get: (key: string) => {
          chain.push(async () => [null, await this.get(key)]);
          return pipelineObj;
        },
        set: (key: string, val: string) => {
          chain.push(async () => [null, await this.set(key, val)]);
          return pipelineObj;
        },
        rpush: (key: string, val: string) => {
          chain.push(async () => [null, await this.rpush(key, val)]);
          return pipelineObj;
        },
        expire: (key: string, ttl: number) => {
          chain.push(async () => [null, await this.expire(key, ttl)]);
          return pipelineObj;
        },
        sadd: (key: string, val: string) => {
          chain.push(async () => [null, await this.sadd(key, val)]);
          return pipelineObj;
        },
        smembers: (key: string) => {
          chain.push(async () => [null, await this.smembers(key)]);
          return pipelineObj;
        },
        del: (key: string) => {
          chain.push(async () => [null, await this.del(key)]);
          return pipelineObj;
        },
        exec: async () => {
          const results = [];
          for (const fn of chain) {
            results.push(await fn());
          }
          return results;
        }
      };
      return pipelineObj;
    });
  }

  return {
    Redis: MockRedis
  };
});

describe('TutorOrchestrator Integration Tests', () => {
  let orchestrator: TutorOrchestrator;
  let memory: InMemoryService;
  let browserbase: MockResearchService;
  let simular: MockCoDriveService;
  let aiProvider: MockClaudeProvider;

  beforeEach(() => {
    shouldRedisFail = false;
    memory = new InMemoryService();
    browserbase = new MockResearchService();
    simular = new MockCoDriveService();
    aiProvider = new MockClaudeProvider();
    orchestrator = new TutorOrchestrator(
      aiProvider,
      memory,
      new AgentRouter(aiProvider, memory, browserbase),
      browserbase,
      simular,
      new NoopObservabilityService()
    );
  });

  // ── 1. TUTOR MODES ────────────────────────────────────────────────────────
  describe('Tutor Modes', () => {
    it('Explain returns explanation and coordinates', async () => {
      const response = await orchestrator.handleQuestion({
        userId: 'u1',
        sessionId: 's1',
        mode: 'explain',
        question: 'Explain this distributive property step.',
        demoLessonId: 'algebra_distributive'
      });
      expect(response.mode).toBe('explain');
      expect(response.spokenText).toContain('multiply the factor outside the parentheses');
      expect(response.pointTarget?.x).toBe(200);
      expect(response.pointTarget?.y).toBe(310);
      expect(response.drawings.length).toBeGreaterThan(0);
    });

    it('Hint does not reveal full answer', async () => {
      const response = await orchestrator.handleQuestion({
        userId: 'u1',
        sessionId: 's1',
        mode: 'hint',
        question: 'Give me a hint.',
        demoLessonId: 'algebra_distributive'
      });
      expect(response.mode).toBe('hint');
      expect(response.hintLadder).toBeDefined();
      expect(response.hintLadder!.conceptual).toBeDefined();
      // Ensure it does not say "2x + 6" in the main spoken text
      expect(response.spokenText.toLowerCase()).not.toContain('2x + 6');
    });

    it('Mistake identifies likely error', async () => {
      const response = await orchestrator.handleQuestion({
        userId: 'u1',
        sessionId: 's1',
        mode: 'mistake',
        question: 'What mistake did I make?',
        demoLessonId: 'algebra_sqrt_mistake'
      });
      expect(response.mode).toBe('mistake');
      expect(response.concept).toBe('sqrt_distribution_error');
      expect(response.spokenText).toContain('square root does not distribute over addition');
    });

    it('Quiz creates hidden answer', async () => {
      const response = await orchestrator.handleQuestion({
        userId: 'u1',
        sessionId: 's1',
        mode: 'quiz',
        question: 'Quiz me.',
        demoLessonId: 'algebra_distributive'
      });
      expect(response.mode).toBe('quiz');
      expect(response.quiz).toBeDefined();
      expect(response.quiz![0].answer).toBe('3x + 15');
      // Ensure answer is not spoken out loud in response.spokenText
      expect(response.spokenText).not.toContain('3x + 15');
    });

    it('Review uses weak concepts from learner memory to personalize response', async () => {
      // 1. Setup a weak concept in memory
      await memory.rememberWeakConcept('u1', 'calculus_chain_rule', 'trouble finding inner function');

      const response = await orchestrator.handleQuestion({
        userId: 'u1',
        sessionId: 's1',
        mode: 'review',
        question: 'Let us do a review.',
      });

      expect(response.mode).toBe('review');
      expect(response.spokenText).toContain('calculus chain rule');
    });

    it('Research calls Browserbase only in Research mode', async () => {
      const spy = vi.spyOn(browserbase, 'researchConcept');

      // 1. Call Explain mode (should NOT call Browserbase)
      await orchestrator.handleQuestion({
        userId: 'u1',
        sessionId: 's1',
        mode: 'explain',
        question: 'Explain this',
      });
      expect(spy).not.toHaveBeenCalled();

      // 2. Call Research mode (should call Browserbase)
      await orchestrator.handleQuestion({
        userId: 'u1',
        sessionId: 's1',
        mode: 'research',
        question: 'Research this topic',
      });
      expect(spy).toHaveBeenCalled();
    });

    it('Co-drive returns proposed actions requiring approval', async () => {
      const response = await orchestrator.handleQuestion({
        userId: 'u1',
        sessionId: 's1',
        mode: 'codrive',
        question: 'What action should I take next?',
      });
      expect(response.mode).toBe('codrive');
      expect(response.proposedActions).toBeDefined();
      expect(response.proposedActions![0].requiresApproval).toBe(true);
    });
  });

  // ── 2. REDIS & MEMORY OPERATION ───────────────────────────────────────────
  describe('Memory Operations', () => {
    it('stores recent question and weak concepts dynamically, and supports clearing user memory', async () => {
      const response = await orchestrator.handleQuestion({
        userId: 'u1',
        sessionId: 's1',
        mode: 'mistake',
        question: 'What mistake did I make?',
        demoLessonId: 'algebra_sqrt_mistake',
        devOverrideRedaction: true
      });

      // Verify question stored
      const profile = await memory.getLearnerProfile('u1');
      expect(profile.recentQuestions.length).toBe(1);
      expect(profile.recentQuestions[0].question).toBe('What mistake did I make?');

      // Verify weak concept stored
      expect(profile.weakConcepts.length).toBe(1);
      expect(profile.weakConcepts[0].concept).toBe('sqrt_distribution_error');

      // Verify session turn stored
      const turnsBefore = await memory.getRecentTurns('s1');
      expect(turnsBefore.length).toBe(1);

      // Clear memory
      await memory.clearUserMemory('u1');
      const clearedProfile = await memory.getLearnerProfile('u1');
      expect(clearedProfile.recentQuestions.length).toBe(0);
      expect(clearedProfile.weakConcepts.length).toBe(0);

      const turnsAfter = await memory.getRecentTurns('s1');
      expect(turnsAfter.length).toBe(0);
    });

    it('falls back to InMemoryService without crashing when Redis connection fails', async () => {
      shouldRedisFail = true;
      const dbService = await RedisMemoryService.create('redis://127.0.0.1:6379');
      // Should fallback to InMemoryService
      expect(dbService.constructor.name).toBe('InMemoryService');

      // Verify standard operations still function correctly on fallback
      await dbService.rememberWeakConcept('u_fallback', 'algebra', 'forgot rules');
      const profile = await dbService.getLearnerProfile('u_fallback');
      expect(profile.weakConcepts[0].concept).toBe('algebra');
    });

    it('works successfully with Redis when connection succeeds', async () => {
      shouldRedisFail = false;
      const dbService = await RedisMemoryService.create('redis://127.0.0.1:6379');
      expect(dbService.constructor.name).toBe('RedisMemoryService');

      await dbService.rememberWeakConcept('u_redis', 'calculus', 'limits');
      const profile = await dbService.getLearnerProfile('u_redis');
      expect(profile.weakConcepts[0].concept).toBe('calculus');
    });

    it('does not store raw screenshotBase64 in memory turns (hash only)', async () => {
      const response = await orchestrator.handleQuestion({
        userId: 'u1',
        sessionId: 's1',
        mode: 'explain',
        question: 'Explain this',
        screenshotBase64: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
        devOverrideRedaction: true
      });

      const turns = await memory.getRecentTurns('s1');
      expect(turns.length).toBe(1);
      // Ensure raw screenshot is absent
      expect((turns[0] as any).screenshotBase64).toBeUndefined();
      expect((turns[0] as any).screenshot).toBeUndefined();
      // Ensure md5 hash of screenshot exists
      expect(turns[0].screenshotHash).toBeDefined();
      expect(turns[0].screenshotHash!.length).toBe(32);
    });
  });

  // ── 3. PRIVACY CHECKS ─────────────────────────────────────────────────────
  describe('Privacy Controls', () => {
    it('privacy mode blocks screenshots, Browserbase, and Simular proposed actions', async () => {
      const response = await orchestrator.handleQuestion({
        userId: 'u1',
        sessionId: 's1',
        mode: 'codrive',
        question: 'What is next?',
        privacyMode: true,
        screenshotBase64: 'data:image/png;base64,iVBORw0KGgoAAAANS...'
      });

      // Returns privacy block text safely instead of crashing
      expect(response.concept).toBe('privacy_block');
      expect(response.spokenText).toContain('blocked for privacy');
      
      // Ensure proposed actions is absent
      expect(response.proposedActions).toBeUndefined();

      // Ensure no turns stored in memory because memory writes are blocked in privacy mode
      const turns = await memory.getRecentTurns('s1');
      expect(turns.length).toBe(0);
    });

    it('denylisted app window title immediately triggers privacy block', async () => {
      const response = await orchestrator.handleQuestion({
        userId: 'u1',
        sessionId: 's1',
        mode: 'explain',
        question: 'Explain',
        appMetadata: {
          windowTitle: 'Chase Online Banking - Chrome' // banking is denylisted
        }
      });

      expect(response.concept).toBe('privacy_block');
      expect(response.spokenText).toContain('blocked for privacy');
    });

    it('memory off blocks writes', async () => {
      // Set memory off in learner profile
      await memory.updateLearnerProfile('u1', { memoryEnabled: false });

      await orchestrator.handleQuestion({
        userId: 'u1',
        sessionId: 's1',
        mode: 'explain',
        question: 'Explain this distributive property step.',
        demoLessonId: 'algebra_distributive'
      });

      // Recent questions list must remain empty
      const profile = await memory.getLearnerProfile('u1');
      expect(profile.recentQuestions.length).toBe(0);

      // Session turns must remain empty
      const turns = await memory.getRecentTurns('s1');
      expect(turns.length).toBe(0);
    });
  });
});
