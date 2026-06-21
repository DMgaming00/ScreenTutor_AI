import { desktopCapturer, screen } from 'electron';
import { createHash } from 'crypto';
import { isWindowDenied } from './privacy.js';
import * as Sentry from '@sentry/node';
import { CapturedDisplay, normalizeCaptureRegion, type CaptureRegion } from '@screentutor/shared';

export let capturedDisplays: CapturedDisplay[] = [];
export let lastCaptureRegion: CaptureRegion | null = null;

export interface DipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  captureRegion?: CaptureRegion;
  isRegionCapture?: boolean;
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
  lastCaptureRegion = null;
  return captureScreenInternal(null);
}

/** Capture full display then crop to a display-local DIP rectangle. */
export async function captureScreenRegion(regionDip: DipRect): Promise<CaptureResult | null> {
  return captureScreenInternal(regionDip);
}

async function captureScreenInternal(regionDip: DipRect | null): Promise<CaptureResult | null> {
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
    const fullSize = image.getSize();
    const pixelsPerDip = fullSize.width / targetMeta.displayWidth;

    let outputImage = image;
    let captureRegion: CaptureRegion | undefined;

    if (regionDip) {
      const minSize = 24;
      const dipX = Math.max(0, Math.min(regionDip.x, targetMeta.displayWidth - minSize));
      const dipY = Math.max(0, Math.min(regionDip.y, targetMeta.displayHeight - minSize));
      const dipW = Math.max(minSize, Math.min(regionDip.width, targetMeta.displayWidth - dipX));
      const dipH = Math.max(minSize, Math.min(regionDip.height, targetMeta.displayHeight - dipY));

      const cropRect = {
        x: Math.round(dipX * pixelsPerDip),
        y: Math.round(dipY * pixelsPerDip),
        width: Math.max(1, Math.round(dipW * pixelsPerDip)),
        height: Math.max(1, Math.round(dipH * pixelsPerDip)),
      };

      cropRect.width = Math.min(cropRect.width, fullSize.width - cropRect.x);
      cropRect.height = Math.min(cropRect.height, fullSize.height - cropRect.y);

      outputImage = image.crop(cropRect);
      captureRegion = normalizeCaptureRegion(
        dipX,
        dipY,
        dipW,
        dipH,
        targetMeta.displayWidth,
        targetMeta.displayHeight
      );
      lastCaptureRegion = captureRegion;
      console.log(
        `[Screenshot] region crop dip=(${dipX},${dipY},${dipW}x${dipH}) px=(${cropRect.x},${cropRect.y},${cropRect.width}x${cropRect.height})`
      );
    } else {
      lastCaptureRegion = null;
    }

    const size = outputImage.getSize();
    const base64 = outputImage.toDataURL();

    logScreenshotMetadata(base64, size.width, size.height);

    console.log(
      `[Screenshot] display=${targetMeta.screenNumber} image=${size.width}x${size.height} dip=${targetMeta.displayWidth}x${targetMeta.displayHeight} scale=${targetMeta.displayScaleFactor}${captureRegion ? ' (region)' : ''}`
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
      captureRegion,
      isRegionCapture: !!captureRegion,
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
