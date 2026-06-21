import { createHash } from 'crypto';
import type { MemoryService } from '../memory/memory-service.js';
import type { TutorInput, TutorResponse } from '@screentutor/shared';

export class SemanticCache {
  constructor(
    private memory: MemoryService | null,
    private enabled: boolean
  ) {}

  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.memory) return null;
    try {
      const raw = await this.memory.semanticCacheGet(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.enabled || !this.memory) return;
    try {
      await this.memory.semanticCacheSet(key, JSON.stringify(value), ttlSeconds);
    } catch (err) {
      console.warn('[SemanticCache] Failed to write cache entry:', err);
    }
  }
}

export function hashScreenshot(base64?: string): string | undefined {
  if (!base64) return undefined;
  return createHash('md5').update(base64).digest('hex');
}

export function buildTutorResponseCacheKey(
  input: TutorInput,
  screenshotHash: string | undefined,
  weakConcepts: string[]
): string {
  const payload = [
    input.mode,
    input.question.trim().toLowerCase(),
    screenshotHash ?? 'no-screenshot',
    input.demoLessonId ?? '',
    input.learnerPreferences?.explanationStyle ?? '',
    [...weakConcepts].sort().join(','),
  ].join('|');

  return `tutor:${createHash('sha256').update(payload).digest('hex')}`;
}

/** Strip runtime-only fields before persisting a tutor response. */
export function sanitizeResponseForCache(response: TutorResponse): TutorResponse {
  const { observability: _obs, ...rest } = response;
  return rest as TutorResponse;
}

export function buildResearchCacheKey(
  kind: 'research' | 'summary' | 'simpler' | 'practice',
  parts: string[]
): string {
  const payload = [kind, ...parts.map((p) => p.trim().toLowerCase())].join('|');
  return `research:${createHash('sha256').update(payload).digest('hex')}`;
}
