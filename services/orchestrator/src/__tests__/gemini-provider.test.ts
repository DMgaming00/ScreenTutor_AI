import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProvider } from '../providers/gemini-provider.js';
import type { TutorInput } from '@screentutor/shared';

describe('GeminiProvider', () => {
  const baseInput: TutorInput = {
    userId: 'u1',
    sessionId: 's1',
    mode: 'explain',
    question: 'Explain this distributive property step.',
    screenshotBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  };

  let originalFetch: any;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('falls back to MockClaudeProvider if apiKey is missing', async () => {
    const provider = new GeminiProvider('');
    const res = await provider.analyzeScreenAndQuestion(baseInput);

    // Should return a response even without key (mock fallback)
    expect(res).toBeDefined();
    expect(res.provider).toBe('mock');
  });

  it('queries Gemini API and parses successful structured response correctly', async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  summary: 'Explanation of distributive property',
                  spokenText: 'This is the distributive property. [POINT:100,200:focus]',
                  drawings: [
                    {
                      id: 'd1',
                      type: 'circle',
                      coordinates: { x: 0.1, y: 0.2 },
                      label: 'focus',
                      confidence: 0.9
                    }
                  ],
                  concept: 'distributive_property',
                  confidence: 0.95
                })
              }
            ]
          }
        }
      ]
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse
    } as any);
    global.fetch = fetchMock;

    const provider = new GeminiProvider('AIzaSy_test_key');
    const res = await provider.analyzeScreenAndQuestion(baseInput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('generativelanguage.googleapis.com');
    expect(calledUrl).toContain('key=AIzaSy_test_key');

    const body = JSON.parse(calledOptions.body as string);
    expect(body.systemInstruction).toBeDefined();
    expect(body.contents[0].parts.length).toBe(2); // image inlineData + text prompt
    expect(body.contents[0].parts[0].inlineData).toBeDefined();

    expect(res.provider).toBe('gemini');
    expect(res.concept).toBe('distributive_property');
    expect(res.spokenText).toBe('This is the distributive property.');
    expect(res.pointTarget).toEqual({
      x: 100,
      y: 200,
      label: 'focus',
      rawTag: '[POINT:100,200:focus]'
    });
  });

  it('repairs missing point tag by appending POINT:none', async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  summary: 'Distributive property',
                  spokenText: 'This is the distributive property.',
                  drawings: [],
                  concept: 'distributive_property',
                  confidence: 0.95
                })
              }
            ]
          }
        }
      ]
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse
    } as any);
    global.fetch = fetchMock;

    const provider = new GeminiProvider('AIzaSy_test_key');
    const res = await provider.analyzeScreenAndQuestion(baseInput);

    expect(res.provider).toBe('gemini');
    expect(res.spokenText).toBe('This is the distributive property.');
    expect(res.pointTarget).toEqual({
      x: null,
      y: null,
      label: '',
      rawTag: '[POINT:none]'
    });
  });

  it('falls back to MockClaudeProvider if Gemini API returns non-ok status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request'
    } as any);
    global.fetch = fetchMock;

    const provider = new GeminiProvider('AIzaSy_test_key');
    const res = await provider.analyzeScreenAndQuestion(baseInput);

    // Should gracefully fallback to mock provider
    expect(res).toBeDefined();
    expect(res.provider).toBe('mock');
  });

  it('falls back to MockClaudeProvider if fetch throws network error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = fetchMock;

    const provider = new GeminiProvider('AIzaSy_test_key');
    const res = await provider.analyzeScreenAndQuestion(baseInput);

    // Should gracefully fallback to mock provider
    expect(res).toBeDefined();
    expect(res.provider).toBe('mock');
  });
});
