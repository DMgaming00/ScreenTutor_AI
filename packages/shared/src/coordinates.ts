export interface CapturedDisplay {
  screenNumber: number;
  imageWidthPixels: number;
  imageHeightPixels: number;
  displayWidth: number;
  displayHeight: number;
  displayFrameX: number;
  displayFrameY: number;
  displayScaleFactor: number;
  isCursorDisplay: boolean;
}

export interface MapCoordinatesParams {
  x: number;
  y: number;
  screenNumber?: number | null;
  displays: CapturedDisplay[];
}

export interface MappedCoordinatesResult {
  globalX: number;
  globalY: number;
  targetDisplay: CapturedDisplay;
}

/**
 * Maps screenshot coordinates (usually pixel coords on a target screen) to global
 * screen coordinates in Device Independent Pixels (DIP).
 */
export function mapCoordinatesToGlobal({
  x,
  y,
  screenNumber,
  displays
}: MapCoordinatesParams): MappedCoordinatesResult | null {
  if (displays.length === 0) {
    return null;
  }

  // 1. Locate the target display
  let targetDisplay = displays.find(d => d.isCursorDisplay);
  if (screenNumber && typeof screenNumber === 'number') {
    const matchedDisplay = displays.find(d => d.screenNumber === screenNumber);
    if (matchedDisplay) {
      targetDisplay = matchedDisplay;
    }
  }

  // If still no display found, fallback to first
  if (!targetDisplay) {
    targetDisplay = displays[0];
  }

  // 2. Map normalized percentages (0.0 - 1.0) to Device Independent Pixels (DIP)
  const clampedX = Math.max(0, Math.min(x, 1.0));
  const clampedY = Math.max(0, Math.min(y, 1.0));

  const dipX = clampedX * targetDisplay.displayWidth;
  const dipY = clampedY * targetDisplay.displayHeight;

  // 4. Convert to global coordinates using display offset (displayFrameX, displayFrameY)
  const globalX = targetDisplay.displayFrameX + dipX;
  const globalY = targetDisplay.displayFrameY + dipY;

  return {
    globalX,
    globalY,
    targetDisplay
  };
}
