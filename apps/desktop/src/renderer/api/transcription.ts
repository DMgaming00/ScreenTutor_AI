import { DEMO_LESSONS } from '@screentutor/shared';

export interface TranscriptionProvider {
  startSession(): Promise<void>;
  pushAudioChunk(chunk: Blob): void;
  stopSession(): Promise<void>;
  getFinalTranscript(activeLessonId?: string): Promise<string>;
}

export class MockTranscriptionProvider implements TranscriptionProvider {
  private static lastIndices: Record<string, number> = {};
  private genericIndex = -1;

  async startSession(): Promise<void> {
    // Mock starts instantly
  }

  pushAudioChunk(_chunk: Blob): void {
    // No-op for mock
  }

  async stopSession(): Promise<void> {
    // Mock stops instantly
  }

  async getFinalTranscript(activeLessonId?: string): Promise<string> {
    if (activeLessonId) {
      const lesson = DEMO_LESSONS.find(l => l.id === activeLessonId);
      if (lesson && lesson.suggestedQuestions.length > 0) {
        const idx = MockTranscriptionProvider.lastIndices[activeLessonId] ?? -1;
        const nextIdx = (idx + 1) % lesson.suggestedQuestions.length;
        MockTranscriptionProvider.lastIndices[activeLessonId] = nextIdx;
        return lesson.suggestedQuestions[nextIdx].label;
      }
    }
    const defaults = [
      "Explain the step shown on my screen.",
      "Give me a hint to solve this problem.",
      "What mistake is in this code?",
      "Can you quiz me on this topic?"
    ];
    this.genericIndex = (this.genericIndex + 1) % defaults.length;
    return defaults[this.genericIndex];
  }
}

export class WebAudioTranscriptionProvider implements TranscriptionProvider {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private recognition: any = null;
  private transcript = '';
  private isRecognitionActive = false;

  async startSession(): Promise<void> {
    this.audioChunks = [];
    this.transcript = '';
    
    // Start standard media recording to keep system mic active
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.pushAudioChunk(event.data);
        }
      };
      this.mediaRecorder.start();
    } catch (err) {
      console.error('Microphone access denied or failed:', err);
      throw err;
    }

    // Start Web Speech API Recognition in parallel
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            }
          }
          if (finalTranscript) {
            this.transcript += finalTranscript;
          }
        };

        this.recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
        };

        this.recognition.onend = () => {
          this.isRecognitionActive = false;
        };

        this.isRecognitionActive = true;
        this.recognition.start();
      } catch (err) {
        console.error('Speech recognition failed to start:', err);
      }
    } else {
      console.warn('SpeechRecognition not supported in this browser environment.');
    }
  }

  pushAudioChunk(chunk: Blob): void {
    this.audioChunks.push(chunk);
  }

  async stopSession(): Promise<void> {
    if (this.recognition && this.isRecognitionActive) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.error('Error stopping speech recognition:', e);
      }
      this.isRecognitionActive = false;
    }

    return new Promise((resolve) => {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = () => {
          this.cleanupStream();
          resolve();
        };
        this.mediaRecorder.stop();
      } else {
        this.cleanupStream();
        resolve();
      }
    });
  }

  private cleanupStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.error('Error stopping track:', e);
        }
      });
      this.stream = null;
    }
    this.mediaRecorder = null;
  }

  async getFinalTranscript(activeLessonId?: string): Promise<string> {
    const trimmed = this.transcript.trim();
    if (trimmed) {
      console.log('Real speech recognition transcript:', trimmed);
      return trimmed;
    }
    // Fall back to deterministic mock transcript matching the current lesson/context
    const mock = new MockTranscriptionProvider();
    return mock.getFinalTranscript(activeLessonId);
  }
}

export const transcriptionProvider = new WebAudioTranscriptionProvider();
