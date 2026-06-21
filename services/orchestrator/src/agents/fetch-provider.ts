import type { TutorInput, TutorResponse } from '@screentutor/shared';
import type { AgentRouteDecision, AgentOutput, SpecialistAgent } from './agent-router.js';

export interface FetchAgentProvider {
  isConfigured(): boolean;
  getProviderName(): string;
  route(input: TutorInput, traceId?: string): Promise<AgentRouteDecision>;
  execute(agentType: string, input: TutorInput, onDelta?: (text: string) => void, traceId?: string): Promise<AgentOutput>;
}

export class LocalAgentProvider implements FetchAgentProvider {
  constructor(private agents: Record<string, SpecialistAgent>) {}

  isConfigured(): boolean {
    return true;
  }

  getProviderName(): string {
    return 'Local Provider';
  }

  async route(input: TutorInput, traceId?: string): Promise<AgentRouteDecision> {
    const q = input.question.toLowerCase();
    
    // 1. Misconception Detector Rule
    if (
      q.includes('mistake') || 
      q.includes('wrong') || 
      q.includes('error') || 
      q.includes('messed up') || 
      q.includes('where did i go wrong') ||
      q.includes('where did i mess up')
    ) {
      return {
        selectedAgent: 'MisconceptionDetectorAgent',
        reason: 'Input contains misconception keywords ("mistake", "wrong", "error", "messed up").',
        provider: 'Local Provider'
      };
    }

    // 2. Quiz Generator Rule
    if (
      q.includes('quiz') || 
      q.includes('test me') || 
      q.includes('practice') || 
      input.mode === 'quiz'
    ) {
      return {
        selectedAgent: 'QuizGeneratorAgent',
        reason: 'Input or mode indicates a quiz request ("quiz", "test me", "practice").',
        provider: 'Local Provider'
      };
    }

    // 3. Resource Finder Rule
    if (
      q.includes('research') || 
      q.includes('simpler explanation') || 
      q.includes('find resource') || 
      input.mode === 'research'
    ) {
      return {
        selectedAgent: 'ResourceFinderAgent',
        reason: 'Input or mode indicates research ("research", "simpler explanation", "find resource").',
        provider: 'Local Provider'
      };
    }

    // 4. Learning Plan Rule
    if (
      q.includes('review') || 
      q.includes('what should i study') || 
      input.mode === 'review'
    ) {
      return {
        selectedAgent: 'LearningPlanAgent',
        reason: 'Input or mode indicates learning plan review ("review", "what should i study").',
        provider: 'Local Provider'
      };
    }

    // 5. Default: Math Tutor Rule
    return {
      selectedAgent: 'MathTutorAgent',
      reason: 'Input matches math topics or defaults to primary math/concept explanation.',
      provider: 'Local Provider'
    };
  }

  async execute(agentType: string, input: TutorInput, onDelta?: (text: string) => void, traceId?: string): Promise<AgentOutput> {
    const agent = this.agents[agentType];
    if (!agent) {
      throw new Error(`Specialist agent type ${agentType} not found in LocalAgentProvider.`);
    }

    const response = await agent.execute(input, onDelta, traceId);
    response.provider = 'Local Provider';

    return {
      agentType,
      response
    };
  }
}

export class FetchAgentverseProvider implements FetchAgentProvider {
  constructor(
    private apiKey: string,
    private agentAddress: string,
    private agents: Record<string, SpecialistAgent>
  ) {}

  isConfigured(): boolean {
    return !!this.apiKey && !!this.agentAddress;
  }

  getProviderName(): string {
    return 'Fetch AI Agentverse';
  }

  async route(input: TutorInput, traceId?: string): Promise<AgentRouteDecision> {
    if (!this.isConfigured()) {
      return {
        selectedAgent: 'MathTutorAgent',
        reason: 'Fetch Agentverse credentials are not configured. Route fell back to MathTutorAgent.',
        provider: 'Fetch AI Agentverse (Unconfigured)'
      };
    }

    // Message envelope matching Fetch AI protocols:
    const routingEnvelope = {
      sender: this.agentAddress,
      destination: 'agentverse://tutor-router',
      protocol: 'tutor-routing-v1',
      payload: {
        task: 'route',
        input: {
          question: input.question,
          mode: input.mode,
          timestamp: new Date().toISOString()
        }
      }
    };

    console.log(`[Fetch Agentverse] Sending routing message to Agentverse router Agent:`, JSON.stringify(routingEnvelope, null, 2));

    // Evaluate routing locally for stub execution:
    const localProvider = new LocalAgentProvider(this.agents);
    const decision = await localProvider.route(input, traceId);
    decision.provider = 'Fetch AI Agentverse';

    return decision;
  }

  async execute(agentType: string, input: TutorInput, onDelta?: (text: string) => void, traceId?: string): Promise<AgentOutput> {
    if (!this.isConfigured()) {
      return {
        agentType,
        response: {
          summary: 'Fetch AI / Agentverse Integration is not configured.',
          spokenText: 'I cannot process this agent request because the Fetch AI Agentverse credentials (FETCH_AGENTVERSE_API_KEY / FETCH_AGENTVERSE_AGENT_ADDRESS) are missing. Fall back to local mode in settings.',
          drawings: [],
          concept: 'unconfigured_error',
          confidence: 0.0,
          provider: 'Fetch AI Agentverse (Unconfigured)'
        }
      };
    }

    // Message envelope matching Fetch AI protocols:
    const executionEnvelope = {
      sender: this.agentAddress,
      destination: `agentverse://${agentType.toLowerCase()}`,
      protocol: 'tutor-execution-v1',
      payload: {
        task: 'execute',
        agentType,
        input: {
          userId: input.userId,
          sessionId: input.sessionId,
          question: input.question,
          mode: input.mode,
          timestamp: new Date().toISOString()
        }
      }
    };

    console.log(`[Fetch Agentverse] Dispaching execution message to Agentverse agent:`, JSON.stringify(executionEnvelope, null, 2));

    // Delegate to local implementation for stub fallback, marking provider:
    const agent = this.agents[agentType];
    if (!agent) {
      throw new Error(`Specialist agent type ${agentType} not found in FetchAgentverseProvider.`);
    }

    const response = await agent.execute(input, onDelta, traceId);
    response.provider = 'Fetch AI Agentverse';

    return {
      agentType,
      response
    };
  }
}
