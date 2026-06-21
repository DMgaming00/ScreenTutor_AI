import { describe, it, expect } from 'vitest';
import { mapCoordinatesToGlobal, CapturedDisplay } from '@screentutor/shared';

describe('Coordinate Mapping Logic', () => {
  const displays: CapturedDisplay[] = [
    {
      screenNumber: 1,
      imageWidthPixels: 1920,
      imageHeightPixels: 1080,
      displayWidth: 1920,
      displayHeight: 1080,
      displayFrameX: 0,
      displayFrameY: 0,
      displayScaleFactor: 1.0,
      isCursorDisplay: true,
    },
    {
      screenNumber: 2,
      imageWidthPixels: 3840, // High-DPI monitor
      imageHeightPixels: 2160,
      displayWidth: 1920,
      displayHeight: 1080,
      displayFrameX: 1920, // Offset horizontally (multi-monitor setup)
      displayFrameY: 0,
      displayScaleFactor: 2.0, // Scale factor = 2.0
      isCursorDisplay: false,
    }
  ];

  it('maps coordinates correctly for a single standard display', () => {
    const res = mapCoordinatesToGlobal({
      x: 960,
      y: 540,
      screenNumber: 1,
      displays
    });

    expect(res).not.toBeNull();
    expect(res!.globalX).toBe(960);
    expect(res!.globalY).toBe(540);
    expect(res!.targetDisplay.screenNumber).toBe(1);
  });

  it('maps coordinates correctly for a high-DPI display', () => {
    const res = mapCoordinatesToGlobal({
      x: 1000, // half-way on high-DPI would be 1920/2 = 960 global offset from display edge
      y: 800,
      screenNumber: 2,
      displays
    });

    expect(res).not.toBeNull();
    // 1920 displayOffset + (1000 / 2.0 scale) = 1920 + 500 = 2420
    expect(res!.globalX).toBe(2420);
    // 0 displayOffset + (800 / 2.0 scale) = 400
    expect(res!.globalY).toBe(400);
    expect(res!.targetDisplay.screenNumber).toBe(2);
  });

  it('clamps coordinates that are out-of-bounds', () => {
    // Test right-side clamping
    const resRight = mapCoordinatesToGlobal({
      x: 5000, // exceeds screen 2 imageWidth (3840)
      y: 3000, // exceeds screen 2 imageHeight (2160)
      screenNumber: 2,
      displays
    });

    expect(resRight).not.toBeNull();
    // Clamped to 3840 => 1920 + (3840 / 2.0) = 1920 + 1920 = 3840
    expect(resRight!.globalX).toBe(3840);
    // Clamped to 2160 => 0 + (2160 / 2.0) = 1080
    expect(resRight!.globalY).toBe(1080);

    // Test negative coordinates (left/top clamping)
    const resLeft = mapCoordinatesToGlobal({
      x: -100,
      y: -50,
      screenNumber: 1,
      displays
    });

    expect(resLeft).not.toBeNull();
    expect(resLeft!.globalX).toBe(0);
    expect(resLeft!.globalY).toBe(0);
  });

  it('handles missing screen number by defaulting to active cursor display', () => {
    const res = mapCoordinatesToGlobal({
      x: 192,
      y: 108,
      screenNumber: undefined,
      displays
    });

    expect(res).not.toBeNull();
    // Screen 1 isCursorDisplay = true, so maps to screen 1
    expect(res!.targetDisplay.screenNumber).toBe(1);
    expect(res!.globalX).toBe(192);
    expect(res!.globalY).toBe(108);
  });

  it('handles missing screen number defaulting to first display if no cursor display is set', () => {
    const headlessDisplays = displays.map(d => ({ ...d, isCursorDisplay: false }));
    const res = mapCoordinatesToGlobal({
      x: 100,
      y: 100,
      displays: headlessDisplays
    });

    expect(res).not.toBeNull();
    expect(res!.targetDisplay.screenNumber).toBe(1); // falls back to displays[0]
  });

  it('returns null if the displays list is empty', () => {
    const res = mapCoordinatesToGlobal({
      x: 100,
      y: 100,
      displays: []
    });
    expect(res).toBeNull();
  });
});
