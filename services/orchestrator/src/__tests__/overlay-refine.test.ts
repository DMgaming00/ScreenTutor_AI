import { describe, it, expect } from 'vitest';
import { refineOverlayAnnotationTags, snapShapeToPoint } from '@screentutor/shared';

describe('overlay-refine', () => {
  it('snaps misplaced rect to circle at last point', () => {
    const raw =
      'Left 10 cm [POINT:0.2,0.5:left] [DRAW:rect:0.6,0.6,0.2,0.2:orphan]';
    const refined = refineOverlayAnnotationTags(raw);

    expect(refined).toContain('[DRAW:circle:0.2,0.5,0.035');
    expect(refined).not.toContain('[DRAW:rect:0.6');
  });

  it('snapShapeToPoint converts far rect to circle at anchor', () => {
    const shape = snapShapeToPoint(
      { kind: 'rect', coords: [0.6, 0.6, 0.15, 0.15], label: 'x' },
      { x: 0.2, y: 0.5 }
    );
    expect(shape?.kind).toBe('circle');
    expect(shape?.coords[0]).toBeCloseTo(0.2);
    expect(shape?.coords[1]).toBeCloseTo(0.5);
  });
});
