import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../../.env') });

export const config = {
  ORCHESTRATOR_PORT: parseInt(process.env.ORCHESTRATOR_PORT || '4317', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  CLAUDE_MODEL: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',

  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  MEMORY_ENABLED: process.env.MEMORY_ENABLED !== 'false',
  RECENT_TURNS_CONTEXT_LIMIT: parseInt(process.env.RECENT_TURNS_CONTEXT_LIMIT || '5', 10),
  SEMANTIC_CACHE_ENABLED: process.env.SEMANTIC_CACHE_ENABLED !== 'false',
  TUTOR_CACHE_TTL_SECONDS: parseInt(process.env.TUTOR_CACHE_TTL_SECONDS || '1800', 10),
  RESEARCH_CACHE_TTL_SECONDS: parseInt(process.env.RESEARCH_CACHE_TTL_SECONDS || '3600', 10),

  BROWSERBASE_API_KEY: process.env.BROWSERBASE_API_KEY || '',
  BROWSERBASE_PROJECT_ID: process.env.BROWSERBASE_PROJECT_ID || '',
  BROWSERBASE_ENABLED: process.env.BROWSERBASE_ENABLED === 'true',

  SIMULAR_API_KEY: process.env.SIMULAR_API_KEY || '',
  SIMULAR_ENABLED: process.env.SIMULAR_ENABLED === 'true',
  ENABLE_SAFE_ACTIONS: process.env.ENABLE_SAFE_ACTIONS === 'true',

  FETCH_AGENTVERSE_API_KEY: process.env.FETCH_AGENTVERSE_API_KEY || '',
  FETCH_AGENTVERSE_AGENT_ADDRESS: process.env.FETCH_AGENTVERSE_AGENT_ADDRESS || '',
  FETCH_AGENTVERSE_ENABLED: process.env.FETCH_AGENTVERSE_ENABLED === 'true',

  ARIZE_API_KEY: process.env.ARIZE_API_KEY || '',
  PHOENIX_COLLECTOR_ENDPOINT: process.env.PHOENIX_COLLECTOR_ENDPOINT || '',
  ARIZE_ENABLED: process.env.ARIZE_ENABLED === 'true',

  SENTRY_DSN: process.env.SENTRY_DSN || '',
  SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT || 'development',
  SENTRY_ENABLED: process.env.SENTRY_ENABLED === 'true',

  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || '',
  ELEVENLABS_MODEL_ID: process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5',
  ELEVENLABS_ENABLED: process.env.ELEVENLABS_ENABLED !== 'false',

  SCREENSHOT_STORAGE: process.env.SCREENSHOT_STORAGE || 'none',
  PRIVACY_MODE_DEFAULT: process.env.PRIVACY_MODE_DEFAULT === 'true',
  DEBUG_COORDINATES: process.env.DEBUG_COORDINATES === 'true',
};
