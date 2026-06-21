import type { ResearchResult } from '@screentutor/shared';
import * as Sentry from '@sentry/node';

export interface BrowserbaseIntegration {
  isConfigured(): boolean;
  researchConcept(concept: string, learnerLevel: string, currentScreenSummary: string): Promise<ResearchResult>;
  fetchPageSummary(url: string): Promise<string>;
  findSimplerExplanation(concept: string): Promise<string>;
  generatePracticeFromWebResource(concept: string): Promise<string>;
}

let cachedSessionId: string | null = null;
const researchCache = new Map<string, { value: any; expiresAt: number }>();

export class BrowserbaseService implements BrowserbaseIntegration {
  constructor(private apiKey: string, private projectId: string) {}

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async researchConcept(concept: string, learnerLevel: string, currentScreenSummary: string): Promise<ResearchResult> {
    if (!this.isConfigured()) {
      throw new Error('Browserbase is not configured.');
    }

    const cacheKey = `research:${concept}:${learnerLevel}:${currentScreenSummary}`;
    const cached = researchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(concept)}`;
      const markdown = await this.fetchPageContent(url);
      
      const lines = markdown.split('\n').filter(line => line.trim().length > 40);
      const summaryLine = lines.length > 0 ? lines[0] : 'No summary line found.';
      const summary = summaryLine.substring(0, 300) + '...';

      const result: ResearchResult = {
        title: `Web Research: ${concept.replace(/_/g, ' ')}`,
        summary: `Retrieved from Wikipedia: ${summary}`,
        keyTakeaways: [
          `Foundational concept: ${concept.replace(/_/g, ' ')}.`,
          `Analyzed at a ${learnerLevel} level.`,
          `Visual reference matches: "${currentScreenSummary}".`
        ],
        suggestedPractice: `Review details on ${concept.replace(/_/g, ' ')} and try completing a representative derivation.`,
        confidence: 0.85,
        sourceUrl: url,
        providerMetadata: { source: 'real_browserbase', length: markdown.length }
      };

      researchCache.set(cacheKey, { value: result, expiresAt: Date.now() + 60 * 1000 });
      return result;
    } catch (err: any) {
      Sentry.captureException(err);
      console.error('Real Browserbase research failed:', err);
      return {
        title: `Web Research (Fallback): ${concept}`,
        summary: `Could not reach live Browserbase: ${err.message}`,
        keyTakeaways: ['Verify configuration parameters.', 'Verify network availability.'],
        suggestedPractice: 'Seek tutorials on open platforms like Khan Academy.',
        confidence: 0.5,
        providerMetadata: { error: err.message }
      };
    }
  }

  async fetchPageSummary(url: string): Promise<string> {
    if (!this.isConfigured()) return 'Browserbase not configured';

    const cacheKey = `summary:${url}`;
    const cached = researchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      const markdown = await this.fetchPageContent(url);
      const summary = markdown.substring(0, 250) + '...';
      researchCache.set(cacheKey, { value: summary, expiresAt: Date.now() + 60 * 1000 });
      return summary;
    } catch (err: any) {
      Sentry.captureException(err);
      return `Failed to fetch page summary: ${err.message}`;
    }
  }

  async findSimplerExplanation(concept: string): Promise<string> {
    if (!this.isConfigured()) return 'Browserbase not configured';

    const cacheKey = `simpler:${concept}`;
    const cached = researchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    try {
      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(concept)}`;
      const markdown = await this.fetchPageContent(url);
      const firstLines = markdown.split('\n').filter(l => l.trim().length > 20).slice(0, 3).join(' ');
      const explanation = `Simpler explanation based on web article: ${firstLines.substring(0, 200)}...`;
      researchCache.set(cacheKey, { value: explanation, expiresAt: Date.now() + 60 * 1000 });
      return explanation;
    } catch (err: any) {
      Sentry.captureException(err);
      return `Could not load simpler explanation: ${err.message}`;
    }
  }

  async generatePracticeFromWebResource(concept: string): Promise<string> {
    return `Practice problem from web: Solve a standard exercise involving ${concept.replace(/_/g, ' ')}.`;
  }

  private async getOrCreateSessionId(): Promise<string> {
    if (cachedSessionId) {
      try {
        const res = await fetch('https://api.browserbase.com/v1/sessions', {
          method: 'GET',
          headers: {
            'X-BB-API-Key': this.apiKey
          }
        });
        if (res.ok) {
          const sessions = await res.json() as Array<{ id: string; status: string }>;
          const activeSession = sessions.find(s => s.id === cachedSessionId && s.status === 'RUNNING');
          if (activeSession) {
            return activeSession.id;
          }
        }
      } catch (err) {
        console.warn('Failed to verify Browserbase session status, creating a new one:', err);
      }
    }

    const res = await fetch('https://api.browserbase.com/v1/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BB-API-Key': this.apiKey
      },
      body: JSON.stringify({ projectId: this.projectId })
    });
    if (!res.ok) {
      throw new Error(`Failed to create Browserbase session: ${res.statusText}`);
    }
    const session = await res.json() as { id: string };
    cachedSessionId = session.id;
    return session.id;
  }

  private async fetchPageContent(url: string): Promise<string> {
    const sessionId = await this.getOrCreateSessionId();
    const res = await fetch('https://api.browserbase.com/v1/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BB-API-Key': this.apiKey
      },
      body: JSON.stringify({
        url,
        format: 'markdown',
        sessionId
      })
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Browserbase Fetch error: ${res.statusText} (${txt})`);
    }
    const data = await res.json() as { content: string };
    return data.content || '';
  }
}

export class MockBrowserbaseService implements BrowserbaseIntegration {
  isConfigured(): boolean {
    return false;
  }

  async researchConcept(concept: string, learnerLevel: string, currentScreenSummary: string): Promise<ResearchResult> {
    return {
      title: `Web Research: ${concept.replace(/_/g, ' ')}`,
      summary: `Detailed web findings for ${concept.replace(/_/g, ' ')} at a ${learnerLevel} level. Web sources confirm this describes the relationship between rate of change and composite function components.`,
      keyTakeaways: [
        `Takeaway 1: Focus on the inner and outer components when analyzing ${concept.replace(/_/g, ' ')}.`,
        `Takeaway 2: This aligns with the visual representation identified as "${currentScreenSummary}".`,
        'Takeaway 3: Practice with simple examples before moving to compound applications.'
      ],
      suggestedPractice: `Expand or solve: Find the derivative of f(x) = (3x + 2)^5 using the ${concept.replace(/_/g, ' ')}.`,
      confidence: 0.9,
      sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(concept)}`,
      providerMetadata: { source: 'mock_browserbase', latencyMs: 120 }
    };
  }

  async fetchPageSummary(url: string): Promise<string> {
    return `Simulated page summary for ${url}. The resource covers foundational guides, interactive widgets, and worksheets for practice.`;
  }

  async findSimplerExplanation(concept: string): Promise<string> {
    return `Think of ${concept.replace(/_/g, ' ')} like a machine with a box inside it. First you figure out what the outer machine does, and then you multiply it by what the inner box does.`;
  }

  async generatePracticeFromWebResource(concept: string): Promise<string> {
    return `Interactive Web Quiz: Solve the derivative of y = sin(x^2) using ${concept.replace(/_/g, ' ')}.`;
  }
}
