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

  it('snapShapeToPoint centers misplaced arrow on anchor', () => {
    const shape = snapShapeToPoint(
      { kind: 'arrow', coords: [0.1, 0.1, 0.9, 0.9], label: 'side' },
      { x: 0.2, y: 0.5 }
    );
    expect(shape?.kind).toBe('arrow');
    const midX = ((shape?.coords[0] ?? 0) + (shape?.coords[2] ?? 0)) / 2;
    const midY = ((shape?.coords[1] ?? 0) + (shape?.coords[3] ?? 0)) / 2;
    expect(midX).toBeCloseTo(0.2, 1);
    expect(midY).toBeCloseTo(0.5, 1);
  });
});
