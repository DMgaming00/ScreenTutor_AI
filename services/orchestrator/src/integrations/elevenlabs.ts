export interface ElevenLabsIntegration {
  isConfigured(): boolean;
  synthesizeSpeech(text: string): Promise<Buffer>;
}

export class ElevenLabsService implements ElevenLabsIntegration {
  constructor(
    private apiKey: string,
    private voiceId: string,
    private modelId: string
  ) {}

  isConfigured(): boolean {
    return !!this.apiKey && !!this.voiceId;
  }

  async synthesizeSpeech(text: string): Promise<Buffer> {
    if (!this.isConfigured()) {
      throw new Error('ElevenLabs is not configured.');
    }

    const cleanText = text.replace(/\[POINT:[^\]]+\]/gi, '').trim();
    if (!cleanText) {
      throw new Error('Empty text for TTS.');
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: this.modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`ElevenLabs TTS failed (${response.status}): ${errBody}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}

export class MockElevenLabsService implements ElevenLabsIntegration {
  isConfigured(): boolean {
    return false;
  }

  async synthesizeSpeech(_text: string): Promise<Buffer> {
    throw new Error('ElevenLabs TTS is not configured.');
  }
}
