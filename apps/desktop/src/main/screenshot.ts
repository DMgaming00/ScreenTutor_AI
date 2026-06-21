import { desktopCapturer, screen } from 'electron';
import { createHash } from 'crypto';
import { isWindowDenied } from './privacy.js';
import * as Sentry from '@sentry/node';
import { CapturedDisplay } from '@screentutor/shared';

export let capturedDisplays: CapturedDisplay[] = [];

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

export async function captureScreen(): Promise<{ base64: string; width: number; height: number } | null> {
  try {
    updateCapturedDisplays();

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });

    const primaryScreen = sources[0]; // simplistic for MVP
    if (!primaryScreen) {
      Sentry.captureMessage('No primary screen source captured.');
      return null;
    }

    // Basic privacy check on primary screen name
    if (isWindowDenied(primaryScreen.name)) {
      console.warn(`Privacy warning: Refusing to capture screen containing denied app: ${primaryScreen.name}`);
      return null;
    }

    const image = primaryScreen.thumbnail;
    const base64 = image.toDataURL();

    // Log metadata only — never log image content or raw base64
    logScreenshotMetadata(base64, image.getSize().width, image.getSize().height);

    return {
      base64,
      width: image.getSize().width,
      height: image.getSize().height
    };
  } catch (err) {
    Sentry.captureException(err);
    console.error('Failed to capture screen:', err);
    throw err;
  }
}

/**
 * Logs screenshot metadata (hash + size in KB) without exposing any image content.
 * SCREENSHOT_STORAGE=none by default — raw images are never written to disk.
 */
export function logScreenshotMetadata(base64: string, width: number, height: number): void {
  try {
    // Strip the data URI prefix before hashing
    const raw = base64.replace(/^data:[^;]+;base64,/, '');
    const sizeKb = Math.round(Buffer.byteLength(raw, 'base64') / 1024);
    const hash = createHash('md5').update(raw).digest('hex').slice(0, 8);
    console.log(`[Screenshot] size=${sizeKb}KB hash=${hash} dimensions=${width}x${height}`);
  } catch {
    // Silently ignore — logging failure must never break capture
  }
}
