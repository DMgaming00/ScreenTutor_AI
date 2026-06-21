import { useState, useEffect, useCallback } from 'react';
import { captureResultToScreenMetadata, type ScreenMetadata } from '@screentutor/shared';

export interface ScreenshotCapture {
  base64: string;
  width: number;
  height: number;
  screenNumber?: number;
  displayId?: string;
  displayWidth?: number;
  displayHeight?: number;
  scaleFactor?: number;
}

export function getScreenMetadata(
  capture: Partial<ScreenshotCapture> & { base64?: string } | null | undefined
): ScreenMetadata | undefined {
  if (!capture?.screenNumber && !capture?.width) return undefined;
  if (!capture.screenNumber || !capture.width || !capture.height) return undefined;
  return captureResultToScreenMetadata({
    width: capture.width,
    height: capture.height,
    screenNumber: capture.screenNumber,
    displayId: capture.displayId ?? '',
    displayWidth: capture.displayWidth ?? capture.width,
    displayHeight: capture.displayHeight ?? capture.height,
    scaleFactor: capture.scaleFactor ?? 1,
  });
}

export function useScreenCapture() {
  const [screenshot, setScreenshot] = useState<ScreenshotCapture | null>(null);

  useEffect(() => {
    window.electronAPI.onScreenCaptured((data: ScreenshotCapture) => {
      if (data) setScreenshot(data);
    });
  }, []);

  const captureScreen = useCallback(async () => {
    const data = await window.electronAPI.captureScreen();
    if (data) setScreenshot(data);
    return data;
  }, []);

  const clearScreenshot = useCallback(() => {
    setScreenshot(null);
  }, []);

  return { screenshot, captureScreen, clearScreenshot, getScreenMetadata: () => getScreenMetadata(screenshot) };
}
