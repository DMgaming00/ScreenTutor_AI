import { globalShortcut } from 'electron';
import * as Sentry from '@sentry/node';

export interface HoldDictationCallbacks {
  onStart: () => void;
  onEnd: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let holdActive = false;
let callbacks: HoldDictationCallbacks | null = null;
let tapToggleActive = false;

const POLL_MS = 40;

async function loadWin32Poll() {
  if (process.platform !== 'win32') return null;
  try {
    return await import('./hold-key-poll.win32.js');
  } catch (err) {
    console.warn('Win32 key poll unavailable:', err);
    return null;
  }
}

function registerTapToggleFallback(onStart: () => void, onEnd: () => void) {
  const registered = globalShortcut.register('CommandOrControl+Shift+E', () => {
    if (!tapToggleActive) {
      tapToggleActive = true;
      holdActive = true;
      onStart();
    } else {
      tapToggleActive = false;
      holdActive = false;
      onEnd();
    }
  });

  if (!registered) {
    console.warn('CommandOrControl+Shift+E registration failed.');
    Sentry.captureMessage('Global hotkey CommandOrControl+Shift+E registration failed.');
  } else {
    console.log('Hold-to-dictate fallback: Ctrl+Shift+E toggles listening');
  }
}

/** Register Ctrl+Shift+E hold-to-dictate (start on press, end on release). */
export async function registerHoldDictationShortcuts(onStart: () => void, onEnd: () => void) {
  callbacks = { onStart, onEnd };
  holdActive = false;
  tapToggleActive = false;

  const win32 = await loadWin32Poll();

  if (win32) {
    pollTimer = setInterval(() => {
      if (!callbacks) return;

      let comboDown = false;
      try {
        comboDown = win32.isHoldComboPressed();
      } catch (err) {
        console.warn('Key poll error:', err);
        return;
      }

      if (comboDown && !holdActive) {
        holdActive = true;
        callbacks.onStart();
      } else if (!comboDown && holdActive) {
        holdActive = false;
        callbacks.onEnd();
      }
    }, POLL_MS);

    console.log('Hold-to-dictate registered: Ctrl+Shift+E (Win32 poll)');
    return;
  }

  registerTapToggleFallback(
    () => callbacks?.onStart(),
    () => callbacks?.onEnd()
  );
}

export function unregisterHoldDictationShortcuts() {
  holdActive = false;
  tapToggleActive = false;
  callbacks = null;

  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  try {
    globalShortcut.unregister('CommandOrControl+Shift+E');
  } catch {
    // ignore
  }
}
