import { patchConsole } from '@screentutor/shared';
patchConsole();

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import type { AIProvider } from './providers/ai-provider.js';
import type { BrowserbaseIntegration } from './integrations/browserbase.js';
import type { SimularIntegration } from './integrations/simular.js';
import type { ElevenLabsIntegration } from './integrations/elevenlabs.js';
import type { ObservabilityService } from './observability/observability-service.js';
import type { TutorOrchestrator } from './orchestrator/tutor-orchestrator.js';
import * as Sentry from '@sentry/node';
import { initOrchestratorSentry } from './observability/sentry.js';

// Initialize Sentry error tracing
initOrchestratorSentry();

import { healthRoutes } from './routes/health.js';
import { tutorRoutes } from './routes/tutor.js';
import { memoryRoutes } from './routes/memory.js';
import { researchRoutes } from './routes/research.js';
import { actionRoutes } from './routes/actions.js';
import { sponsorRoutes } from './routes/sponsors.js';
import { ttsRoutes } from './routes/tts.js';

// Setup fastify instance
const fastify = Fastify({ logger: true });

// Decorate fastify so routes can access services
declare module 'fastify' {
  interface FastifyInstance {
    getOrchestrator(): Promise<TutorOrchestrator>;
    getMemory(): Promise<any>;
    getBrowserbase(): Promise<BrowserbaseIntegration>;
    getSimular(): Promise<SimularIntegration>;
    getElevenLabs(): Promise<ElevenLabsIntegration>;
    getObservability(): Promise<ObservabilityService>;
  }
}

let aiProviderInstance: AIProvider | null = null;
async function getAIProvider(): Promise<AIProvider> {
  if (!aiProviderInstance) {
    if (!config.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is missing! Please provide it in the .env file.");
    }
    const { ClaudeProvider } = await import('./providers/anthropic-provider.js');
    aiProviderInstance = new ClaudeProvider(config.ANTHROPIC_API_KEY);
  }
  return aiProviderInstance;
}

let memoryInstance: any = null;
async function getMemory(): Promise<any> {
  if (!memoryInstance) {
    const { RedisMemoryService } = await import('./memory/redis-memory.js');
    memoryInstance = await RedisMemoryService.create(config.REDIS_URL);
  }
  return memoryInstance;
}

let browserbaseInstance: BrowserbaseIntegration | null = null;
async function getBrowserbase(): Promise<BrowserbaseIntegration> {
  if (!browserbaseInstance) {
    const { BrowserbaseService, MockBrowserbaseService } = await import('./integrations/browserbase.js');
    if (config.BROWSERBASE_ENABLED && config.BROWSERBASE_API_KEY) {
      const mem = await getMemory();
      browserbaseInstance = new BrowserbaseService(config.BROWSERBASE_API_KEY, config.BROWSERBASE_PROJECT_ID, mem);
    } else {
      browserbaseInstance = new MockBrowserbaseService();
    }
  }
  return browserbaseInstance;
}

let simularInstance: SimularIntegration | null = null;
async function getSimular(): Promise<SimularIntegration> {
  if (!simularInstance) {
    const { RealSimularService, MockSimularService } = await import('./integrations/simular.js');
    simularInstance = (config.SIMULAR_ENABLED && config.SIMULAR_API_KEY)
      ? new RealSimularService(config.SIMULAR_API_KEY, config.ENABLE_SAFE_ACTIONS)
      : new MockSimularService();
  }
  return simularInstance;
}

let elevenLabsInstance: ElevenLabsIntegration | null = null;
async function getElevenLabs(): Promise<ElevenLabsIntegration> {
  if (!elevenLabsInstance) {
    const { ElevenLabsService, MockElevenLabsService } = await import('./integrations/elevenlabs.js');
    elevenLabsInstance = (config.ELEVENLABS_ENABLED && config.ELEVENLABS_API_KEY && config.ELEVENLABS_VOICE_ID)
      ? new ElevenLabsService(config.ELEVENLABS_API_KEY, config.ELEVENLABS_VOICE_ID, config.ELEVENLABS_MODEL_ID)
      : new MockElevenLabsService();
  }
  return elevenLabsInstance;
}

let observabilityInstance: ObservabilityService | null = null;
async function getObservability(): Promise<ObservabilityService> {
  if (!observabilityInstance) {
    const { ArizePhoenixObservabilityService, NoopObservabilityService } = await import('./observability/observability-service.js');
    observabilityInstance = (config.ARIZE_ENABLED && config.PHOENIX_COLLECTOR_ENDPOINT)
      ? new ArizePhoenixObservabilityService(config.ARIZE_API_KEY, config.PHOENIX_COLLECTOR_ENDPOINT)
      : new NoopObservabilityService();
  }
  return observabilityInstance;
}

let orchestratorInstance: TutorOrchestrator | null = null;
async function getOrchestrator(): Promise<TutorOrchestrator> {
  if (!orchestratorInstance) {
    const aiProv = await getAIProvider();
    const mem = await getMemory();
    const bb = await getBrowserbase();
    const sim = await getSimular();
    const obs = await getObservability();

    const { AgentRouter } = await import('./agents/agent-router.js');
    const { TutorOrchestrator } = await import('./orchestrator/tutor-orchestrator.js');

    const agentRouter = new AgentRouter(aiProv, mem, bb, obs);
    orchestratorInstance = new TutorOrchestrator(aiProv, mem, agentRouter, bb, sim, obs);
  }
  return orchestratorInstance;
}

fastify.decorate('getOrchestrator', getOrchestrator);
fastify.decorate('getMemory', getMemory);
fastify.decorate('getBrowserbase', getBrowserbase);
fastify.decorate('getSimular', getSimular);
fastify.decorate('getElevenLabs', getElevenLabs);
fastify.decorate('getObservability', getObservability);

import { RedactionService } from '@screentutor/shared';

// Global error handler to redact error responses
fastify.setErrorHandler((error: any, request, reply) => {
  fastify.log.error(error);
  const safeError = RedactionService.redactError(error);
  reply.status(error.statusCode || 500).send({
    statusCode: error.statusCode || 500,
    error: safeError.name || 'Internal Server Error',
    message: safeError.message || 'An error occurred'
  });
});

// Register plugins
await fastify.register(cors, { origin: '*' });

// Register routes
await fastify.register(healthRoutes);
await fastify.register(tutorRoutes);
await fastify.register(memoryRoutes);
await fastify.register(researchRoutes);
await fastify.register(actionRoutes);
await fastify.register(sponsorRoutes);
await fastify.register(ttsRoutes);

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: config.ORCHESTRATOR_PORT, host: '0.0.0.0' });
    console.log(`Server listening at http://localhost:${config.ORCHESTRATOR_PORT}`);
    console.log(`AI Provider: ${config.ANTHROPIC_API_KEY ? 'claude' : 'none'}`);
    console.log(`Browserbase Configured: ${!!config.BROWSERBASE_API_KEY}`);
    console.log(`Simular Configured: ${!!config.SIMULAR_API_KEY} (Safe Actions: ${config.ENABLE_SAFE_ACTIONS})`);
    console.log(`ElevenLabs Configured: ${!!config.ELEVENLABS_API_KEY && !!config.ELEVENLABS_VOICE_ID} (Enabled: ${config.ELEVENLABS_ENABLED})`);
  } catch (err) {
    Sentry.captureException(err);
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
