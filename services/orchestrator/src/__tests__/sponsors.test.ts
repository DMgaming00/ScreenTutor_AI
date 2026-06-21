import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SponsorRegistry } from '../sponsors/SponsorRegistry.js';
import { InMemoryService } from '../memory/in-memory.js';
import { RedisMemoryService } from '../memory/redis-memory.js';
import { config } from '../config.js';

describe('SponsorRegistry Configurations', () => {
  // Store initial configuration state to restore after tests
  let originalConfig: any;

  beforeEach(() => {
    originalConfig = { ...config };
  });

  afterEach(() => {
    Object.assign(config, originalConfig);
  });

  it('detects Claude mock vs real configurations correctly', async () => {
    const memory = new InMemoryService();
    const registry = new SponsorRegistry(memory);

    // 1. Mock status
    config.AI_PROVIDER = 'mock';
    config.ANTHROPIC_API_KEY = '';
    let status = await registry.getStatus();
    let claude = status.find(s => s.name === 'claude');
    expect(claude).toBeDefined();
    expect(claude!.status).toBe('mock');
    expect(claude!.configured).toBe(false);

    // 2. Real status with key
    config.AI_PROVIDER = 'claude';
    config.ANTHROPIC_API_KEY = 'sk-ant-12345';
    status = await registry.getStatus();
    claude = status.find(s => s.name === 'claude');
    expect(claude!.status).toBe('real');
    expect(claude!.configured).toBe(true);

    // 3. Error status when configured as real but key is missing
    config.AI_PROVIDER = 'claude';
    config.ANTHROPIC_API_KEY = '';
    status = await registry.getStatus();
    claude = status.find(s => s.name === 'claude');
    expect(claude!.status).toBe('error');
  });

  it('detects Gemini disabled vs real vs error configurations correctly', async () => {
    const memory = new InMemoryService();
    const registry = new SponsorRegistry(memory);

    // 1. Disabled status
    config.AI_PROVIDER = 'mock';
    config.GEMINI_API_KEY = '';
    let status = await registry.getStatus();
    let gemini = status.find(s => s.name === 'gemini');
    expect(gemini).toBeDefined();
    expect(gemini!.status).toBe('disabled');
    expect(gemini!.configured).toBe(false);

    // 2. Real status with key
    config.AI_PROVIDER = 'gemini';
    config.GEMINI_API_KEY = 'AIzaSy12345';
    status = await registry.getStatus();
    gemini = status.find(s => s.name === 'gemini');
    expect(gemini!.status).toBe('real');
    expect(gemini!.configured).toBe(true);

    // 3. Error status when configured as real but key is missing
    config.AI_PROVIDER = 'gemini';
    config.GEMINI_API_KEY = '';
    status = await registry.getStatus();
    gemini = status.find(s => s.name === 'gemini');
    expect(gemini!.status).toBe('error');
  });

  it('detects Redis connected/real vs fallback/mock status', async () => {
    // 1. Falling back to InMemory
    const inMemory = new InMemoryService();
    let registry = new SponsorRegistry(inMemory);
    config.MEMORY_ENABLED = true;
    config.REDIS_URL = 'redis://localhost:6379';
    let status = await registry.getStatus();
    let redis = status.find(s => s.name === 'redis');
    expect(redis!.status).toBe('mock'); // InMemory is used in place of Redis
    expect(redis!.configured).toBe(true); // url exists

    // 2. Real connection active (simulated via RedisMemoryService mock class instantiation)
    const mockRedisClient = {} as any; // simple mock client
    const redisService = (RedisMemoryService as any).constructor.prototype;
    // Instantiate a fake class instance that passes the constructor name check
    const fakeRedisService = Object.create(RedisMemoryService.prototype);
    fakeRedisService.redis = mockRedisClient;
    fakeRedisService.redisUrl = 'redis://localhost:6379';

    registry = new SponsorRegistry(fakeRedisService);
    status = await registry.getStatus();
    redis = status.find(s => s.name === 'redis');
    expect(redis!.status).toBe('real');
  });

  it('detects Browserbase configured vs mock status', async () => {
    const memory = new InMemoryService();
    const registry = new SponsorRegistry(memory);

    // 1. Enabled but unconfigured
    config.BROWSERBASE_ENABLED = true;
    config.BROWSERBASE_API_KEY = '';
    config.BROWSERBASE_PROJECT_ID = '';
    let status = await registry.getStatus();
    let bb = status.find(s => s.name === 'browserbase');
    expect(bb!.status).toBe('mock');

    // 2. Enabled and configured
    config.BROWSERBASE_API_KEY = 'bb-key';
    config.BROWSERBASE_PROJECT_ID = 'bb-proj';
    status = await registry.getStatus();
    bb = status.find(s => s.name === 'browserbase');
    expect(bb!.status).toBe('real');

    // 3. Disabled
    config.BROWSERBASE_ENABLED = false;
    status = await registry.getStatus();
    bb = status.find(s => s.name === 'browserbase');
    expect(bb!.status).toBe('disabled');
  });

  it('detects Simular configured vs mock status', async () => {
    const memory = new InMemoryService();
    const registry = new SponsorRegistry(memory);

    // 1. Enabled but unconfigured
    config.SIMULAR_ENABLED = true;
    config.SIMULAR_API_KEY = '';
    let status = await registry.getStatus();
    let simular = status.find(s => s.name === 'simular');
    expect(simular!.status).toBe('mock');

    // 2. Configured
    config.SIMULAR_API_KEY = 'simular-key';
    status = await registry.getStatus();
    simular = status.find(s => s.name === 'simular');
    expect(simular!.status).toBe('real');

    // 3. Disabled
    config.SIMULAR_ENABLED = false;
    status = await registry.getStatus();
    simular = status.find(s => s.name === 'simular');
    expect(simular!.status).toBe('disabled');
  });

  it('detects Fetch local vs remote status', async () => {
    const memory = new InMemoryService();
    const registry = new SponsorRegistry(memory);

    // 1. Enabled but unconfigured (falls back to mock/local)
    config.FETCH_AGENTVERSE_ENABLED = true;
    config.FETCH_AGENTVERSE_API_KEY = '';
    config.FETCH_AGENTVERSE_AGENT_ADDRESS = '';
    let status = await registry.getStatus();
    let fetch = status.find(s => s.name === 'fetch_agentverse');
    expect(fetch!.status).toBe('mock');

    // 2. Enabled and configured (real/remote)
    config.FETCH_AGENTVERSE_API_KEY = 'fetch-key';
    config.FETCH_AGENTVERSE_AGENT_ADDRESS = 'agent-addr';
    status = await registry.getStatus();
    fetch = status.find(s => s.name === 'fetch_agentverse');
    expect(fetch!.status).toBe('real');

    // 3. Disabled
    config.FETCH_AGENTVERSE_ENABLED = false;
    status = await registry.getStatus();
    fetch = status.find(s => s.name === 'fetch_agentverse');
    expect(fetch!.status).toBe('disabled');
  });

  it('detects Arize and Sentry enabled vs disabled status', async () => {
    const memory = new InMemoryService();
    const registry = new SponsorRegistry(memory);

    // Arize disabled
    config.ARIZE_ENABLED = false;
    config.ARIZE_API_KEY = 'key';
    let status = await registry.getStatus();
    let arize = status.find(s => s.name === 'arize');
    expect(arize!.status).toBe('disabled');

    // Arize enabled & configured
    config.ARIZE_ENABLED = true;
    status = await registry.getStatus();
    arize = status.find(s => s.name === 'arize');
    expect(arize!.status).toBe('real');

    // Sentry disabled
    config.SENTRY_ENABLED = false;
    config.SENTRY_DSN = 'dsn';
    status = await registry.getStatus();
    let sentry = status.find(s => s.name === 'sentry');
    expect(sentry!.status).toBe('disabled');

    // Sentry enabled & configured
    config.SENTRY_ENABLED = true;
    status = await registry.getStatus();
    sentry = status.find(s => s.name === 'sentry');
    expect(sentry!.status).toBe('real');
  });

  it('guarantees that excluded sponsors are completely absent from registry statuses', async () => {
    const memory = new InMemoryService();
    const registry = new SponsorRegistry(memory);
    const status = await registry.getStatus();

    const allowedSponsors = ['claude', 'gemini', 'redis', 'browserbase', 'simular', 'fetch_agentverse', 'arize', 'sentry', 'elevenlabs'];
    for (const item of status) {
      expect(allowedSponsors).toContain(item.name);
    }

    const excludedSponsors = ['qnx', 'zoox', 'cognition', 'devin', 'annapurna', 'aws', 'poke', 'interaction_co'];
    for (const excluded of excludedSponsors) {
      const found = status.some(s => s.name.toLowerCase() === excluded);
      expect(found).toBe(false);
    }
  });
});
