import { clipboard, screen } from 'electron';
import { mapNormalizedToDisplayLocal, type ProposedAction } from '@screentutor/shared';
import { capturedDisplays, lastCaptureRegion, updateCapturedDisplays } from './screenshot.js';
import { getActiveWindowTitle, getPrivacyMode, isWindowDenied } from './privacy.js';

export interface DesktopActionResult {
  success: boolean;
  message: string;
}

type Win32Input = typeof import('./desktop-input.win32.js');
let win32: Promise<Win32Input | null> | null = null;

function loadWin32(): Promise<Win32Input | null> {
  if (process.platform !== 'win32') return Promise.resolve(null);
  win32 ??= import('./desktop-input.win32.js').catch((err) => {
    console.error('[Co-drive] Failed to load Windows input:', err);
    return null;
  });
  return win32;
}

/** Normalized screenshot coordinates -> physical screen pixels for input APIs. */
function toScreenPoint(action: ProposedAction): { x: number; y: number } | null {
  if (!action.coordinates) return null;
  if (capturedDisplays.length === 0) updateCapturedDisplays();
  const local = mapNormalizedToDisplayLocal(
    action.coordinates.x,
    action.coordinates.y,
    capturedDisplays,
    action.screenNumber,
    lastCaptureRegion
  );
  if (!local) return null;
  const dip = {
    x: local.targetDisplay.displayFrameX + local.localX,
    y: local.targetDisplay.displayFrameY + local.localY,
  };
  return process.platform === 'win32' ? screen.dipToScreenPoint(dip) : dip;
}

/**
 * Performs one Co-drive action the learner approved in the UI. Re-checks privacy
 * mode and the window denylist at the moment of execution, since the screen may
 * have changed since the action was proposed.
 */
export async function performApprovedAction(action: ProposedAction): Promise<DesktopActionResult> {
  if (action.status !== 'approved') {
    return { success: false, message: 'Only approved actions can run.' };
  }
  if (getPrivacyMode()) {
    return { success: false, message: 'Privacy mode is on, so Co-drive will not control the desktop.' };
  }
  const title = await getActiveWindowTitle();
  if (title && isWindowDenied(title)) {
    return { success: false, message: 'The active window is on the privacy denylist; action skipped.' };
  }

  const input = await loadWin32();
  if (!input) {
    return { success: false, message: 'Desktop control is only implemented on Windows so far. Please do this step yourself.' };
  }

  try {
    switch (action.type) {
      case 'click': {
        const point = toScreenPoint(action);
        if (!point) return { success: false, message: 'Could not map the click to a screen position.' };
        input.click(point.x, point.y, action.button ?? 'left', action.clickCount ?? 1, action.modifiers);
        return { success: true, message: 'Clicked.' };
      }
      case 'type': {
        if (!action.text) return { success: false, message: 'Nothing to type.' };
        // Paste instead of per-character key events: handles any Unicode and is instant.
        const previous = clipboard.readText();
        clipboard.writeText(action.text);
        input.pressCombo('ctrl+v');
        setTimeout(() => clipboard.writeText(previous), 500);
        return { success: true, message: 'Typed.' };
      }
      case 'hotkey': {
        if (!action.text) return { success: false, message: 'No key to press.' };
        input.pressCombo(action.text);
        return { success: true, message: `Pressed ${action.text}.` };
      }
      case 'scroll': {
        if (!action.scroll) return { success: false, message: 'No scroll direction.' };
        input.scroll(action.scroll.direction, action.scroll.amount, toScreenPoint(action) ?? undefined);
        return { success: true, message: `Scrolled ${action.scroll.direction}.` };
      }
      default:
        return { success: false, message: `Action type "${action.type}" is not supported.` };
    }
  } catch (err) {
    return { success: false, message: `Action failed: ${(err as Error).message}` };
  }
}
