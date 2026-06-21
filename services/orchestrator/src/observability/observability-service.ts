import { config } from '../config.js';
import crypto from 'crypto';
import { RedactionService } from '@screentutor/shared';

export interface ObservabilityService {
  startTrace(name: string, metadata?: Record<string, any>): string;
  addSpan(traceId: string, name: string, metadata?: Record<string, any>): string;
  recordEvent(traceId: string, eventName: string, metadata?: Record<string, any>): void;
  recordEvaluation(traceId: string, evalName: string, score: number, metadata?: Record<string, any>): void;
  endTrace(traceId: string, metadata?: Record<string, any>): void;
  isConfigured(): boolean;
}

export class NoopObservabilityService implements ObservabilityService {
  isConfigured(): boolean {
    return false;
  }

  startTrace(name: string, metadata?: Record<string, any>): string {
    return crypto.randomBytes(16).toString('hex');
  }

  addSpan(traceId: string, name: string, metadata?: Record<string, any>): string {
    return crypto.randomBytes(8).toString('hex');
  }

  recordEvent(traceId: string, eventName: string, metadata?: Record<string, any>): void {}

  recordEvaluation(traceId: string, evalName: string, score: number, metadata?: Record<string, any>): void {}

  endTrace(traceId: string, metadata?: Record<string, any>): void {}
}

export class ArizePhoenixObservabilityService implements ObservabilityService {
  private activeTraces = new Map<string, {
    name: string;
    startTimeUnixNano: string;
    metadata: Record<string, any>;
    spans: Array<{
      spanId: string;
      parentSpanId?: string;
      name: string;
      startTimeUnixNano: string;
      endTimeUnixNano?: string;
      metadata: Record<string, any>;
    }>;
    events: Array<{
      name: string;
      timeUnixNano: string;
      metadata: Record<string, any>;
    }>;
    evaluations: Array<{
      name: string;
      score: number;
      metadata: Record<string, any>;
    }>;
  }>();

  private arizeQueue: any[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(private apiKey: string, private collectorEndpoint: string) {
    this.startFlushTimer();
  }

  private startFlushTimer() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flushQueue().catch(err => {
        console.error('[Arize/Phoenix] Error in background flush:', err.message);
      });
    }, 10000);
    
    if (this.flushTimer && typeof this.flushTimer.unref === 'function') {
      this.flushTimer.unref();
    }
  }

  private async flushQueue(): Promise<void> {
    if (this.arizeQueue.length === 0 || !this.collectorEndpoint) return;

    const resourceSpans = [...this.arizeQueue];
    this.arizeQueue = [];

    const otlpPayload = {
      resourceSpans
    };

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) {
        headers['space-key'] = this.apiKey;
      }

      await fetch(this.collectorEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(otlpPayload)
      });
    } catch (err: any) {
      console.error('[Arize/Phoenix] Failed to post telemetry traces:', err.message);
    }
  }

  isConfigured(): boolean {
    return !!this.collectorEndpoint;
  }

  startTrace(name: string, metadata?: Record<string, any>): string {
    const traceId = crypto.randomBytes(16).toString('hex');
    const cleanedMeta = this.scrubMetadata(metadata);
    
    this.activeTraces.set(traceId, {
      name,
      startTimeUnixNano: (Date.now() * 1000000).toString(),
      metadata: cleanedMeta,
      spans: [],
      events: [],
      evaluations: []
    });

    return traceId;
  }

  addSpan(traceId: string, name: string, metadata?: Record<string, any>): string {
    const trace = this.activeTraces.get(traceId);
    const spanId = crypto.randomBytes(8).toString('hex');
    if (trace) {
      const parentSpanId = trace.spans.length > 0 ? trace.spans[trace.spans.length - 1].spanId : undefined;
      trace.spans.push({
        spanId,
        parentSpanId,
        name,
        startTimeUnixNano: (Date.now() * 1000000).toString(),
        metadata: this.scrubMetadata(metadata)
      });
    }
    return spanId;
  }

  recordEvent(traceId: string, eventName: string, metadata?: Record<string, any>): void {
    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.events.push({
        name: eventName,
        timeUnixNano: (Date.now() * 1000000).toString(),
        metadata: this.scrubMetadata(metadata)
      });
    }
  }

  recordEvaluation(traceId: string, evalName: string, score: number, metadata?: Record<string, any>): void {
    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.evaluations.push({
        name: evalName,
        score,
        metadata: this.scrubMetadata(metadata)
      });
    }
  }

  async endTrace(traceId: string, metadata?: Record<string, any>): Promise<void> {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    const endTimeUnixNano = (Date.now() * 1000000).toString();
    const finalMeta = { ...trace.metadata, ...this.scrubMetadata(metadata) };
    
    // Auto-close open spans
    for (const span of trace.spans) {
      if (!span.endTimeUnixNano) {
        span.endTimeUnixNano = endTimeUnixNano;
      }
    }

    this.activeTraces.delete(traceId);

    const resourceSpan = {
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'screentutor-orchestrator' } },
          { key: 'arize.project', value: { stringValue: 'screentutor' } }
        ]
      },
      scopeSpans: [{
        scope: { name: 'screentutor-traces' },
        spans: trace.spans.map(span => ({
          traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId,
          name: span.name,
          kind: 1, // INTERNAL
          startTimeUnixNano: span.startTimeUnixNano,
          endTimeUnixNano: span.endTimeUnixNano,
          attributes: Object.entries({ ...span.metadata, ...finalMeta }).map(([k, v]) => ({
            key: k,
            value: this.formatAttributeValue(v)
          })),
          events: trace.events.map(ev => ({
            name: ev.name,
            timeUnixNano: ev.timeUnixNano,
            attributes: Object.entries(ev.metadata).map(([k, v]) => ({
              key: k,
              value: this.formatAttributeValue(v)
            }))
          }))
        }))
      }]
    };

    this.arizeQueue.push(resourceSpan);
  }

  private scrubMetadata(metadata?: Record<string, any>): Record<string, any> {
    if (!metadata) return {};
    return RedactionService.redactMetadata(metadata);
  }

  private formatAttributeValue(val: any) {
    if (typeof val === 'boolean') return { boolValue: val };
    if (typeof val === 'number') return { doubleValue: val };
    return { stringValue: String(val) };
  }
}
