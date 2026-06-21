import { desktopCapturer, screen } from 'electron';
import { createHash } from 'crypto';
import { isWindowDenied } from './privacy.js';
import * as Sentry from '@sentry/node';
import { CapturedDisplay } from '@screentutor/shared';

export let capturedDisplays: CapturedDisplay[] = [];

export interface CaptureResult {
  base64: string;
  /** Image pixel width sent to the model */
  width: number;
  /** Image pixel height sent to the model */
  height: number;
  screenNumber: number;
  displayId: string;
  displayWidth: number;
  displayHeight: number;
  displayFrameX: number;
  displayFrameY: number;
  scaleFactor: number;
}

export function updateCapturedDisplays() {
  try {
    const displays = screen.getAllDisplays();
    const cursorPoint = screen.getCursorScreenPoint();
    const cursorDisplay = screen.getDisplayNearestPoint(cursorPoint);

    capturedDisplays = displays.map((display, index) => {
      return {
        screenNumber: index + 1,
        imageWidthPixels: Math.round(display.bounds.width * display.scaleFactor),
        imageHeightPixels: Math.round(display.bounds.height * display.scaleFactor),
        displayWidth: display.bounds.width,
        displayHeight: display.bounds.height,
        displayFrameX: display.bounds.x,
        displayFrameY: display.bounds.y,
        displayScaleFactor: display.scaleFactor,
        isCursorDisplay: display.id === cursorDisplay.id,
      };
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error('Failed to update captured displays:', err);
  }
}

export function getCursorDisplayMeta(): CapturedDisplay | null {
  if (capturedDisplays.length === 0) {
    updateCapturedDisplays();
  }
  return capturedDisplays.find((d) => d.isCursorDisplay) ?? capturedDisplays[0] ?? null;
}

export async function captureScreen(): Promise<CaptureResult | null> {
  try {
    updateCapturedDisplays();

    const cursorPoint = screen.getCursorScreenPoint();
    const cursorDisplay = screen.getDisplayNearestPoint(cursorPoint);
    const targetMeta = getCursorDisplayMeta();
    if (!targetMeta) {
      Sentry.captureMessage('No display metadata available for capture.');
      return null;
    }

    const thumbW = targetMeta.imageWidthPixels;
    const thumbH = targetMeta.imageHeightPixels;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: thumbW, height: thumbH },
    });

    let matchedSource = sources.find((s) => s.display_id === String(cursorDisplay.id));
    if (!matchedSource) {
      const displayIndex = screen.getAllDisplays().findIndex((d) => d.id === cursorDisplay.id);
      matchedSource = displayIndex >= 0 ? sources[displayIndex] : sources[0];
    }

    if (!matchedSource) {
      Sentry.captureMessage('No screen source captured for cursor display.');
      return null;
    }

    if (isWindowDenied(matchedSource.name)) {
      console.warn(`Privacy warning: Refusing to capture screen containing denied app: ${matchedSource.name}`);
      return null;
    }

    const image = matchedSource.thumbnail;
    const size = image.getSize();
    const base64 = image.toDataURL();

    logScreenshotMetadata(base64, size.width, size.height);

    console.log(
      `[Screenshot] display=${targetMeta.screenNumber} image=${size.width}x${size.height} dip=${targetMeta.displayWidth}x${targetMeta.displayHeight} scale=${targetMeta.displayScaleFactor}`
    );

    return {
      base64,
      width: size.width,
      height: size.height,
      screenNumber: targetMeta.screenNumber,
      displayId: String(cursorDisplay.id),
      displayWidth: targetMeta.displayWidth,
      displayHeight: targetMeta.displayHeight,
      displayFrameX: targetMeta.displayFrameX,
      displayFrameY: targetMeta.displayFrameY,
      scaleFactor: targetMeta.displayScaleFactor,
    };
  } catch (err) {
    Sentry.captureException(err);
    console.error('Failed to capture screen:', err);
    throw err;
  }
}

export function logScreenshotMetadata(base64: string, width: number, height: number): void {
  try {
    const raw = base64.replace(/^data:[^;]+;base64,/, '');
    const sizeKb = Math.round(Buffer.byteLength(raw, 'base64') / 1024);
    const hash = createHash('md5').update(raw).digest('hex').slice(0, 8);
    console.log(`[Screenshot] size=${sizeKb}KB hash=${hash} dimensions=${width}x${height}`);
  } catch {
    // Silently ignore
  }
}
