import { useState, useEffect, useCallback } from 'react';

export function useScreenCapture() {
  const [screenshot, setScreenshot] = useState<{ base64: string; width: number; height: number } | null>(null);

  useEffect(() => {
    window.electronAPI.onScreenCaptured((data: any) => {
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

  return { screenshot, captureScreen, clearScreenshot };
}
