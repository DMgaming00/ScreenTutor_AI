import { describe, it, expect } from 'vitest';
import { buildNarrationSteps, estimateSpeechDurationMs } from '@screentutor/shared';

describe('buildNarrationSteps', () => {
  it('pairs spoken and overlay lines by index', () => {
    const spoken = 'Left side is 10 cm.\nBase is x minus 3.\nSolve x equals 9.';
    const overlay =
      'Left side 10 cm [POINT:0.18,0.55:left]\nBase (x−3) cm [POINT:0.42,0.78:base]\n(x−3)²+100=(x+4)²+x² → x=9 [POINT:0.5,0.12:eq]';

    const steps = buildNarrationSteps(spoken, overlay);
    expect(steps).toHaveLength(3);
    expect(steps[0].spoken).toContain('Left side');
    expect(steps[0].display).toContain('Left side 10 cm');
    expect(steps[0].events.some((e) => e.type === 'point')).toBe(true);
    expect(steps[2].display).toContain('x=9');
  });

  it('returns empty for blank input', () => {
    expect(buildNarrationSteps('', '')).toEqual([]);
  });
});

describe('estimateSpeechDurationMs', () => {
  it('scales with text length', () => {
    expect(estimateSpeechDurationMs('hi')).toBeGreaterThanOrEqual(3000);
    expect(estimateSpeechDurationMs('a'.repeat(200))).toBeGreaterThan(3000);
  });
});
