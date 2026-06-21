const API_BASE = 'http://localhost:4317';

export interface TTSProvider {
  speak(text: string, onStart?: () => void, onEnd?: () => void): void;
  stop(): void;
  isSpeaking(): boolean;
}

import { stripStreamTags } from '@screentutor/shared';

function stripPointTags(text: string): string {
  return stripStreamTags(text);
}

export class MockTTSProvider implements TTSProvider {
  private activeTimeout: NodeJS.Timeout | null = null;
  private speaking = false;
  private onEndCallback: (() => void) | undefined = undefined;

  speak(text: string, onStart?: () => void, onEnd?: () => void): void {
    this.stop();
    const cleanText = stripPointTags(text);
    if (!cleanText) {
      onEnd?.();
      return;
    }

    this.speaking = true;
    this.onEndCallback = onEnd;
    onStart?.();

    const duration = Math.min(6000, Math.max(1500, cleanText.length * 40));
    this.activeTimeout = setTimeout(() => {
      this.speaking = false;
      onEnd?.();
      this.activeTimeout = null;
    }, duration);
  }

  stop(): void {
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = null;
    }
    if (this.speaking) {
      this.speaking = false;
      this.onEndCallback?.();
    }
  }

  isSpeaking(): boolean {
    return this.speaking;
  }
}

export class SystemTTSProvider implements TTSProvider {
  private activeUtterance: SpeechSynthesisUtterance | null = null;

  speak(text: string, onStart?: () => void, onEnd?: () => void): void {
    this.stop();

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn('System speech synthesis is not supported in this environment.');
      onEnd?.();
      return;
    }

    const cleanText = stripPointTags(text);
    if (!cleanText) {
      onEnd?.();
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      this.activeUtterance = utterance;

      utterance.onstart = () => {
        onStart?.();
      };

      const handleEnd = () => {
        if (this.activeUtterance === utterance) {
          this.activeUtterance = null;
        }
        onEnd?.();
      };

      utterance.onend = handleEnd;
      utterance.onerror = (e) => {
        console.error('Speech synthesis utterance error:', e);
        handleEnd();
      };

      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Error starting system speech synthesis:', err);
      onEnd?.();
    }
  }

  stop(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (err) {
        console.error('Error canceling speech synthesis:', err);
      }
    }
    this.activeUtterance = null;
  }

  isSpeaking(): boolean {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      return window.speechSynthesis.speaking;
    }
    return false;
  }
}

export class ElevenLabsTTSProvider implements TTSProvider {
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private abortController: AbortController | null = null;
  private speaking = false;
  private fallback = new SystemTTSProvider();

  speak(text: string, onStart?: () => void, onEnd?: () => void): void {
    this.stop();

    const cleanText = stripPointTags(text);
    if (!cleanText) {
      onEnd?.();
      return;
    }

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    fetch(`${API_BASE}/api/tts/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText }),
      signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`TTS API error: ${res.status}`);
        }

        const blob = await res.blob();
        if (signal.aborted) {
          return;
        }

        this.objectUrl = URL.createObjectURL(blob);
        this.audio = new Audio(this.objectUrl);
        this.speaking = true;

        this.audio.onplay = () => onStart?.();

        const handleEnd = () => {
          this.cleanup();
          onEnd?.();
        };

        this.audio.onended = handleEnd;
        this.audio.onerror = () => {
          console.error('Audio playback error');
          handleEnd();
        };

        await this.audio.play();
      })
      .catch((err) => {
        if (signal.aborted) {
          return;
        }
        console.warn('ElevenLabs TTS unavailable, falling back to system voice:', err);
        this.fallback.speak(text, onStart, onEnd);
      });
  }

  private cleanup(): void {
    this.speaking = false;
    if (this.audio) {
      this.audio.onplay = null;
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  stop(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.fallback.stop();
    if (this.audio || this.objectUrl) {
      this.cleanup();
    } else {
      this.speaking = false;
    }
  }

  isSpeaking(): boolean {
    return this.speaking || this.fallback.isSpeaking();
  }
}

export const ttsProvider = new ElevenLabsTTSProvider();
