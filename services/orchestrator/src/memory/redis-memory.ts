import { Redis } from 'ioredis';
import type { MemoryService } from './memory-service.js';
import type { SessionTurn, LearnerProfile, WeakConcept } from '@screentutor/shared';
import { InMemoryService } from './in-memory.js';
import * as Sentry from '@sentry/node';

const profileCache = new Map<string, { profile: LearnerProfile; expiresAt: number }>();

export class RedisMemoryService implements MemoryService {
  private redis: Redis;
  private redisUrl: string;

  private constructor(redisClient: Redis, redisUrl: string) {
    this.redis = redisClient;
    this.redisUrl = redisUrl;
  }

  static async create(redisUrl: string): Promise<MemoryService> {
    const redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 2) return null; // stop retrying
        return Math.min(times * 50, 2000);
      }
    });

    // Swallowed background connection error logs to prevent unhandled node event flooding
    if (typeof redis.on === 'function') {
      redis.on('error', () => {});
    }

    try {
      await redis.connect();
      await redis.ping();
      console.log('Connected to Redis successfully.');
      return new RedisMemoryService(redis, redisUrl);
    } catch (error) {
      Sentry.captureException(error);
      console.warn('Failed to connect to Redis, falling back to InMemoryService.');
      
      try {
        redis.disconnect();
      } catch (_) {}

      return new InMemoryService();
    }
  }

  async getLearnerProfile(userId: string): Promise<LearnerProfile> {
    const cached = profileCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.profile;
    }

    const results = await this.redis.pipeline()
      .get(`screentutor:profile:${userId}`)
      .smembers(`screentutor:user:${userId}:sessions`)
      .exec();

    const data = results && results[0] ? (results[0][1] as string | null) : null;
    let profile: LearnerProfile;
    if (data) {
      profile = JSON.parse(data);
    } else {
      profile = {
        userId,
        preferredExplanationStyle: undefined,
        weakConcepts: [],
        strongConcepts: [],
        recentQuestions: [],
        quizOutcomes: [],
        totalQuestionsAsked: 0,
        lastModeUsed: '',
        lastActiveAt: new Date().toISOString(),
        memoryEnabled: true,
      };
      await this.redis.set(`screentutor:profile:${userId}`, JSON.stringify(profile));
    }

    profileCache.set(userId, {
      profile,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes TTL
    });
    return profile;
  }

  async updateLearnerProfile(userId: string, patch: Partial<LearnerProfile>): Promise<void> {
    const profile = await this.getLearnerProfile(userId);
    Object.assign(profile, patch);
    profile.lastActiveAt = new Date().toISOString();
    await this.redis.set(`screentutor:profile:${userId}`, JSON.stringify(profile));
    profileCache.set(userId, {
      profile,
      expiresAt: Date.now() + 5 * 60 * 1000 // refresh TTL
    });
  }

  async appendSessionTurn(sessionId: string, turn: SessionTurn): Promise<void> {
    const profile = await this.getLearnerProfile(turn.userId);
    if (profile.memoryEnabled === false) return;

    const key = `screentutor:session:${sessionId}:turns`;
    const userSessionsKey = `screentutor:user:${turn.userId}:sessions`;

    await this.redis.pipeline()
      .rpush(key, JSON.stringify(turn))
      .expire(key, 604800)
      .sadd(userSessionsKey, sessionId)
      .expire(userSessionsKey, 604800)
      .exec();
  }

  async getRecentTurns(sessionId: string, limit?: number): Promise<SessionTurn[]> {
    const key = `screentutor:session:${sessionId}:turns`;
    let rawTurns: string[];
    if (limit !== undefined) {
      rawTurns = await this.redis.lrange(key, -limit, -1);
    } else {
      rawTurns = await this.redis.lrange(key, 0, -1);
    }
    return rawTurns.map(t => JSON.parse(t));
  }

  async rememberWeakConcept(userId: string, concept: string, evidence: string, confidence?: number): Promise<void> {
    const profile = await this.getLearnerProfile(userId);
    if (profile.memoryEnabled === false) return;

    const existing = profile.weakConcepts.find(c => c.concept === concept);
    const now = new Date().toISOString();

    if (existing) {
      existing.evidence = evidence;
      existing.timesSeen += 1;
      existing.confidence = Math.min(1.0, confidence !== undefined ? confidence : existing.confidence + 0.1);
      existing.lastSeenAt = now;
    } else {
      profile.weakConcepts.push({
        concept,
        evidence,
        confidence: confidence !== undefined ? confidence : 0.5,
        timesSeen: 1,
        firstSeenAt: now,
        lastSeenAt: now,
      });
    }
    await this.updateLearnerProfile(userId, profile);
  }

  async markConceptImproved(userId: string, concept: string): Promise<void> {
    const profile = await this.getLearnerProfile(userId);
    profile.weakConcepts = profile.weakConcepts.filter(c => c.concept !== concept);
    if (!profile.strongConcepts.includes(concept)) {
      profile.strongConcepts.push(concept);
    }
    await this.updateLearnerProfile(userId, profile);
  }

  async getWeakConcepts(userId: string): Promise<WeakConcept[]> {
    const profile = await this.getLearnerProfile(userId);
    return profile.weakConcepts;
  }

  async clearUserMemory(userId: string): Promise<void> {
    profileCache.delete(userId);
    const sessionIds = await this.redis.smembers(`screentutor:user:${userId}:sessions`);
    const pipe = this.redis.pipeline();
    for (const sid of sessionIds) {
      pipe.del(`screentutor:session:${sid}:turns`);
    }
    pipe.del(`screentutor:user:${userId}:sessions`);
    pipe.del(`screentutor:profile:${userId}`);
    await pipe.exec();
  }

  async semanticCacheGet(cacheKey: string): Promise<string | null> {
    return this.redis.get(`screentutor:cache:${cacheKey}`);
  }

  async semanticCacheSet(cacheKey: string, value: string, ttlSeconds = 3600): Promise<void> {
    await this.redis.set(`screentutor:cache:${cacheKey}`, value, 'EX', ttlSeconds);
  }

  async healthCheck(): Promise<{ status: string; type: 'redis' | 'in-memory'; details?: any }> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latencyMs = Date.now() - start;
      return {
        status: 'healthy',
        type: 'redis',
        details: {
          redisUrl: this.redisUrl.replace(/\/\/.*@/, '//****@'), // redact password
          latencyMs
        }
      };
    } catch (err: any) {
      return {
        status: 'unhealthy',
        type: 'redis',
        details: {
          error: err.message || String(err)
        }
      };
    }
  }
}
