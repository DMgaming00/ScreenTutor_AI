import { globalShortcut } from 'electron';
import * as Sentry from '@sentry/node';

export function registerShortcuts(onTrigger: () => void) {
  try {
    const registered = globalShortcut.register('CommandOrControl+Shift+E', onTrigger);
    if (!registered) {
      console.warn('CommandOrControl+Shift+E registration failed. Another app might be using it.');
      Sentry.captureMessage('Global hotkey CommandOrControl+Shift+E registration failed.');
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error('Error registering global shortcuts:', error);
  }
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}
