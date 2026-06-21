import { SponsorIntegration, SponsorStatus } from '@screentutor/shared';
import { config } from '../config.js';

export class SponsorRegistry {
  constructor(private memoryService: any) {}

  async getStatus(): Promise<SponsorIntegration[]> {
    const sponsors: SponsorIntegration[] = [];

    // 1. Claude
    const claudeConfigured = !!config.ANTHROPIC_API_KEY;
    const claudeEnabled = config.AI_PROVIDER === 'claude' || config.AI_PROVIDER === 'mock';
    let claudeStatus: SponsorStatus = 'disabled';
    if (config.AI_PROVIDER === 'claude') {
      claudeStatus = claudeConfigured ? 'real' : 'error';
    } else if (config.AI_PROVIDER === 'mock') {
      claudeStatus = 'mock';
    }
    sponsors.push({
      name: 'claude',
      status: claudeStatus,
      configured: claudeConfigured,
      enabled: claudeEnabled,
      requiredEnvVars: ['ANTHROPIC_API_KEY'],
      missingEnvVars: claudeConfigured ? [] : ['ANTHROPIC_API_KEY'],
      productUse: 'Visual screen understanding and chat reasoning responses.',
      dataSent: 'Screenshots (base64) and raw chat prompts.',
      privacyNotes: 'Transmitted securely to Anthropic APIs under API usage guidelines.',
      lastHealthCheckAt: new Date().toISOString()
    });

    // 1b. Gemini
    const geminiConfigured = !!config.GEMINI_API_KEY;
    const geminiEnabled = config.AI_PROVIDER === 'gemini';
    let geminiStatus: SponsorStatus = 'disabled';
    if (config.AI_PROVIDER === 'gemini') {
      geminiStatus = geminiConfigured ? 'real' : 'error';
    }
    sponsors.push({
      name: 'gemini',
      status: geminiStatus,
      configured: geminiConfigured,
      enabled: geminiEnabled,
      requiredEnvVars: ['GEMINI_API_KEY'],
      missingEnvVars: geminiConfigured ? [] : ['GEMINI_API_KEY'],
      productUse: 'Visual screen understanding and chat reasoning responses.',
      dataSent: 'Screenshots (base64) and raw chat prompts.',
      privacyNotes: 'Transmitted securely to Google Gemini APIs under API usage guidelines.',
      lastHealthCheckAt: new Date().toISOString()
    });

    // 2. Redis
    let redisStatus: SponsorStatus = 'mock';
    const isRealRedis = this.memoryService && this.memoryService.constructor.name === 'RedisMemoryService';
    const redisConfigured = !!config.REDIS_URL;
    if (isRealRedis) {
      redisStatus = 'real';
    } else if (config.MEMORY_ENABLED) {
      redisStatus = 'mock';
    } else {
      redisStatus = 'disabled';
    }
    sponsors.push({
      name: 'redis',
      status: redisStatus,
      configured: redisConfigured,
      enabled: config.MEMORY_ENABLED,
      requiredEnvVars: ['REDIS_URL'],
      missingEnvVars: redisConfigured ? [] : ['REDIS_URL'],
      productUse: 'Persistent user profile storage and concept mapping.',
      dataSent: 'Session profiles, recent questions, and concept confidence levels.',
      privacyNotes: 'Stored locally in your Redis container database.',
      lastHealthCheckAt: new Date().toISOString()
    });

    // 3. Browserbase
    const bbConfigured = !!config.BROWSERBASE_API_KEY && !!config.BROWSERBASE_PROJECT_ID;
    let bbStatus: SponsorStatus = 'disabled';
    if (config.BROWSERBASE_ENABLED) {
      bbStatus = bbConfigured ? 'real' : 'mock';
    }
    sponsors.push({
      name: 'browserbase',
      status: bbStatus,
      configured: bbConfigured,
      enabled: config.BROWSERBASE_ENABLED,
      requiredEnvVars: ['BROWSERBASE_API_KEY', 'BROWSERBASE_PROJECT_ID'],
      missingEnvVars: [
        ...(config.BROWSERBASE_API_KEY ? [] : ['BROWSERBASE_API_KEY']),
        ...(config.BROWSERBASE_PROJECT_ID ? [] : ['BROWSERBASE_PROJECT_ID'])
      ],
      productUse: 'Headless browser queries for visual web research and scraping.',
      dataSent: 'Search queries and URL text contents.',
      privacyNotes: 'Transmitted to Browserbase servers for hosting browser sessions.',
      lastHealthCheckAt: new Date().toISOString()
    });

    // 4. Simular
    const simularConfigured = !!config.SIMULAR_API_KEY;
    let simularStatus: SponsorStatus = 'disabled';
    if (config.SIMULAR_ENABLED) {
      simularStatus = simularConfigured ? 'real' : 'mock';
    }
    sponsors.push({
      name: 'simular',
      status: simularStatus,
      configured: simularConfigured,
      enabled: config.SIMULAR_ENABLED,
      requiredEnvVars: ['SIMULAR_API_KEY'],
      missingEnvVars: simularConfigured ? [] : ['SIMULAR_API_KEY'],
      productUse: 'Proposing safe desktop interaction actions (clicking/typing).',
      dataSent: 'Goal text and coordinate positioning vectors.',
      privacyNotes: 'Simulated locally when mock, or executed via Simular API.',
      lastHealthCheckAt: new Date().toISOString()
    });

    // 5. Fetch AI / Agentverse
    const fetchConfigured = !!config.FETCH_AGENTVERSE_API_KEY && !!config.FETCH_AGENTVERSE_AGENT_ADDRESS;
    let fetchStatus: SponsorStatus = 'disabled';
    if (config.FETCH_AGENTVERSE_ENABLED) {
      fetchStatus = fetchConfigured ? 'real' : 'mock';
    }
    sponsors.push({
      name: 'fetch_agentverse',
      status: fetchStatus,
      configured: fetchConfigured,
      enabled: config.FETCH_AGENTVERSE_ENABLED,
      requiredEnvVars: ['FETCH_AGENTVERSE_API_KEY', 'FETCH_AGENTVERSE_AGENT_ADDRESS'],
      missingEnvVars: [
        ...(config.FETCH_AGENTVERSE_API_KEY ? [] : ['FETCH_AGENTVERSE_API_KEY']),
        ...(config.FETCH_AGENTVERSE_AGENT_ADDRESS ? [] : ['FETCH_AGENTVERSE_AGENT_ADDRESS'])
      ],
      productUse: 'Specialist agent discovery and routing pipelines.',
      dataSent: 'Agent registrations and task prompts.',
      privacyNotes: 'Communicates with the Fetch AI Agentverse network.',
      lastHealthCheckAt: new Date().toISOString()
    });

    // 6. Arize
    const arizeConfigured = !!config.ARIZE_API_KEY;
    let arizeStatus: SponsorStatus = 'disabled';
    if (config.ARIZE_ENABLED) {
      arizeStatus = arizeConfigured ? 'real' : 'mock';
    }
    sponsors.push({
      name: 'arize',
      status: arizeStatus,
      configured: arizeConfigured,
      enabled: config.ARIZE_ENABLED,
      requiredEnvVars: ['ARIZE_API_KEY'],
      missingEnvVars: arizeConfigured ? [] : ['ARIZE_API_KEY'],
      productUse: 'Observability, tracing prompts, output structures, and latency.',
      dataSent: 'Prompts, model specifications, token count, and latency numbers.',
      privacyNotes: 'Telemetry traces sent securely to Arize Phoenix endpoints.',
      lastHealthCheckAt: new Date().toISOString()
    });

    // 7. Sentry
    const sentryConfigured = !!config.SENTRY_DSN;
    let sentryStatus: SponsorStatus = 'disabled';
    if (config.SENTRY_ENABLED) {
      sentryStatus = sentryConfigured ? 'real' : 'mock';
    }
    sponsors.push({
      name: 'sentry',
      status: sentryStatus,
      configured: sentryConfigured,
      enabled: config.SENTRY_ENABLED,
      requiredEnvVars: ['SENTRY_DSN'],
      missingEnvVars: sentryConfigured ? [] : ['SENTRY_DSN'],
      productUse: 'Capturing runtime errors and performance traces.',
      dataSent: 'Error logs, stack traces, and system specifications.',
      privacyNotes: 'Error logs posted directly to Sentry Ingest endpoint.',
      lastHealthCheckAt: new Date().toISOString()
    });

    // 8. ElevenLabs
    const elevenLabsConfigured = !!config.ELEVENLABS_API_KEY && !!config.ELEVENLABS_VOICE_ID;
    let elevenLabsStatus: SponsorStatus = 'disabled';
    if (config.ELEVENLABS_ENABLED) {
      elevenLabsStatus = elevenLabsConfigured ? 'real' : 'error';
    }
    sponsors.push({
      name: 'elevenlabs',
      status: elevenLabsStatus,
      configured: elevenLabsConfigured,
      enabled: config.ELEVENLABS_ENABLED,
      requiredEnvVars: ['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID'],
      missingEnvVars: [
        ...(config.ELEVENLABS_API_KEY ? [] : ['ELEVENLABS_API_KEY']),
        ...(config.ELEVENLABS_VOICE_ID ? [] : ['ELEVENLABS_VOICE_ID'])
      ],
      productUse: 'Natural text-to-speech for tutor spoken explanations.',
      dataSent: 'spokenText content sent for audio synthesis.',
      privacyNotes: 'Transmitted securely to ElevenLabs API under their usage guidelines.',
      lastHealthCheckAt: new Date().toISOString()
    });

    return sponsors;
  }
}
