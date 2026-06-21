import type { CanvasDrawShape } from './stream-tag-parser.js';
import { sanitizeDrawShape } from './draw-shape-sanitize.js';

const POINT_INNER = /\[POINT:([^\]]+)\]/i;
const DRAW_INNER = /\[DRAW:([^\]]+)\]/gi;

function parsePointCoords(content: string): { x: number; y: number } | null {
  const trimmed = content.trim();
  if (trimmed.toLowerCase() === 'none') return null;
  const parts = trimmed.split(':');
  if (parts.length < 2) return null;
  const coords = parts[0].split(',');
  if (coords.length !== 2) return null;
  const x = parseFloat(coords[0]);
  const y = parseFloat(coords[1]);
  return isNaN(x) || isNaN(y) ? null : { x, y };
}

function shapeCenter(shape: CanvasDrawShape): { x: number; y: number } {
  const [a, b, c, d] = shape.coords;
  switch (shape.kind) {
    case 'circle':
      return { x: a, y: b };
    case 'rect':
    case 'highlight':
      return { x: a + c / 2, y: b + d / 2 };
    case 'arrow':
    case 'underline':
      return { x: (a + c) / 2, y: (b + d) / 2 };
    case 'label':
    case 'rightangle':
      return { x: a, y: b };
    default:
      return { x: 0.5, y: 0.5 };
  }
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Prefer a tight circle at the anchor point instead of a misplaced box. */
export function snapShapeToPoint(
  shape: CanvasDrawShape,
  point: { x: number; y: number } | null
): CanvasDrawShape | null {
  const sanitized = sanitizeDrawShape(shape);
  if (!sanitized) return null;
  if (!point) return sanitized;

  const center = shapeCenter(sanitized);
  const drift = dist(center, point);

  if (sanitized.kind === 'circle') {
    return { ...sanitized, coords: [point.x, point.y, sanitized.coords[2]] };
  }

  if (sanitized.kind === 'rect' || sanitized.kind === 'highlight') {
    if (drift > 0.08) {
      return {
        kind: 'circle',
        coords: [point.x, point.y, 0.035],
        label: sanitized.label,
      };
    }
    const [x, y, w, h] = sanitized.coords;
    const px = Math.max(0, Math.min(1 - w, point.x - w / 2));
    const py = Math.max(0, Math.min(1 - h, point.y - h / 2));
    return { ...sanitized, coords: [px, py, w, h] };
  }

  return sanitized;
}

/**
 * Rewrite overlay tags so draws follow the nearest preceding POINT and cap count.
 * Prevents orphan rectangles floating away from the diagram.
 */
export function refineOverlayAnnotationTags(text: string): string {
  if (!text) return text;

  const parts: string[] = [];
  let lastIndex = 0;
  let lastPoint: { x: number; y: number } | null = null;
  let drawCount = 0;
  const MAX_DRAWS = 20;

  const tagRegex = /\[(POINT|DRAW):([^\]]+)\]/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(text)) !== null) {
    parts.push(text.substring(lastIndex, match.index));
    const kind = match[1].toUpperCase();
    const content = match[2];

    if (kind === 'POINT') {
      const pt = parsePointCoords(content);
      if (pt) lastPoint = pt;
      parts.push(match[0]);
    } else if (content.trim().toLowerCase() === 'clear') {
      drawCount = 0;
      parts.push(match[0]);
    } else if (drawCount >= MAX_DRAWS) {
      // drop excess draw tags
    } else {
      const inner = content.trim();
      const kindDraw = inner.split(':')[0]?.toLowerCase();
      const coordPart = inner.split(':')[1];
      const label = inner.split(':').slice(2).join(':');
      const nums = coordPart?.split(',').map((n) => parseFloat(n.trim())) ?? [];

      let shape: CanvasDrawShape | null = null;
      if (kindDraw === 'circle' && nums.length >= 3) {
        shape = { kind: 'circle', coords: nums.slice(0, 3), label };
      } else if ((kindDraw === 'rect' || kindDraw === 'highlight') && nums.length >= 4) {
        shape = { kind: kindDraw as 'rect' | 'highlight', coords: nums.slice(0, 4), label };
      } else if ((kindDraw === 'arrow' || kindDraw === 'underline') && nums.length >= 4) {
        shape = { kind: kindDraw as 'arrow' | 'underline', coords: nums.slice(0, 4), label };
      } else if (kindDraw === 'label' && nums.length >= 2) {
        shape = { kind: 'label', coords: nums.slice(0, 2), label: label || 'label' };
      } else if (kindDraw === 'rightangle' && nums.length >= 2) {
        shape = { kind: 'rightangle', coords: [nums[0], nums[1], nums[2] ?? 0.02] };
      }

      if (shape) {
        const snapped = snapShapeToPoint(shape, lastPoint);
        if (snapped) {
          drawCount++;
          parts.push(formatDrawTag(snapped));
        }
      }
    }

    lastIndex = match.index + match[0].length;
  }

  parts.push(text.substring(lastIndex));
  return parts.join('');
}

function formatDrawTag(shape: CanvasDrawShape): string {
  const label = shape.label ? `:${shape.label}` : '';
  switch (shape.kind) {
    case 'circle':
      return `[DRAW:circle:${shape.coords.join(',')}${label}]`;
    case 'rect':
      return `[DRAW:rect:${shape.coords.join(',')}${label}]`;
    case 'highlight':
      return `[DRAW:highlight:${shape.coords.join(',')}${label}]`;
    case 'arrow':
      return `[DRAW:arrow:${shape.coords.join(',')}${label}]`;
    case 'underline':
      return `[DRAW:underline:${shape.coords.join(',')}${label}]`;
    case 'label':
      return `[DRAW:label:${shape.coords.join(',')}${label}]`;
    case 'rightangle':
      return `[DRAW:rightangle:${shape.coords.join(',')}]`;
    default:
      return '';
  }
}

export { POINT_INNER, DRAW_INNER };
