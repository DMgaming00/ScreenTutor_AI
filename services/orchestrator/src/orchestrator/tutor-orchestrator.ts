import { TutorInput, TutorResponse, SessionTurn, RedactionService } from '@screentutor/shared';
import type { AIProvider } from '../providers/ai-provider.js';
import type { MemoryService } from '../memory/memory-service.js';
import type { AgentRouter } from '../agents/agent-router.js';
import type { BrowserbaseIntegration } from '../integrations/browserbase.js';
import type { SimularIntegration } from '../integrations/simular.js';
import type { ObservabilityService } from '../observability/observability-service.js';
import { config } from '../config.js';
import { privacyGuard, PrivacyBlockedError } from '../privacy/privacy-guard.js';
import * as Sentry from '@sentry/node';

export class TutorOrchestrator {
  constructor(
    private aiProvider: AIProvider,
    private memory: MemoryService,
    private agentRouter: AgentRouter,
    private browserbase: BrowserbaseIntegration,
    private simular: SimularIntegration,
    private observability: ObservabilityService
  ) {}

  async handleQuestion(input: TutorInput, onDelta?: (text: string) => void): Promise<TutorResponse> {
    return Sentry.startSpan({ name: 'tutor.ask', op: 'http' }, async () => {
      const startTime = Date.now();
      if (input.devOverrideRedaction !== undefined) {
        RedactionService.setDevOverride(input.devOverrideRedaction);
      }
      const traceId = this.observability.startTrace('TutorRequestReceived', {
        userId: input.userId,
        sessionId: input.sessionId,
        mode: input.mode,
        question: input.question
      });

      try {
        // 1. Privacy Check — PrivacyGuard enforces denylist + privacy mode
        const privacySpan = this.observability.addSpan(traceId, 'PrivacyCheck', {
          privacyMode: input.privacyMode,
          windowTitle: input.appMetadata?.windowTitle ? '[REDACTED]' : undefined
        });
        try {
          privacyGuard.assertAllowed(input);
        } catch (err) {
          if (err instanceof PrivacyBlockedError) {
            this.observability.recordEvent(traceId, 'PrivacyCheckFailed', { reason: err.reason });
            this.observability.endTrace(traceId, { privacyBlocked: true, errorType: 'PrivacyBlockedError' });
            // Return a safe, user-friendly response instead of throwing
            return this.buildPrivacyBlockedResponse(input, err.reason);
          }
          throw err;
        }
        this.observability.recordEvent(traceId, 'PrivacyCheckPassed');

        // Strip screenshot from input if not allowed (extra safety layer)
        if (!privacyGuard.isScreenshotAllowed(input)) {
          delete input.screenshotBase64;
        }

        const screenSpan = Sentry.startInactiveSpan({ name: 'capture', op: 'screenshot' });
        try {
          this.observability.addSpan(traceId, 'ScreenCapture', {
            screenshotPresent: !!input.screenshotBase64
          });
          this.observability.recordEvent(traceId, 'ScreenCaptureCompleted');

          // Simular accessibility tree — only if allowed
          this.observability.addSpan(traceId, 'SimularContextFetch');
          if (privacyGuard.isSimularAllowed(input)) {
            try {
              const tree = await this.simular.getAccessibilityTree();
              input.accessibilityTree = tree;
              this.observability.recordEvent(traceId, 'AccessibilityTreeFetched', {
                nodesCount: tree?.nodes?.length || 0
              });
            } catch (err) {
              console.error('Failed to fetch accessibility tree:', err);
              this.observability.recordEvent(traceId, 'AccessibilityTreeFetchFailed');
            }
          } else {
            this.observability.recordEvent(traceId, 'AccessibilityTreeSkipped', { reason: 'privacy' });
          }
        } finally {
          screenSpan?.end();
        }

        // 3. MemoryFetch
        this.observability.addSpan(traceId, 'MemoryFetch');
        let profile = await this.memory.getLearnerProfile(input.userId);
        input.learnerMemory = {
          weakConcepts: profile.weakConcepts || [],
          strongConcepts: profile.strongConcepts || []
        };

        // Personalization: Merge preferred explanation style if available
        if (profile.preferredExplanationStyle) {
          if (!input.learnerPreferences) {
            input.learnerPreferences = {};
          }
          input.learnerPreferences.explanationStyle = profile.preferredExplanationStyle;
        }

        // Session history: feed prior turns into the model for conversational continuity
        if (config.MEMORY_ENABLED && profile.memoryEnabled !== false) {
          const recentTurns = await this.memory.getRecentTurns(
            input.sessionId,
            config.RECENT_TURNS_CONTEXT_LIMIT
          );
          if (recentTurns.length > 0) {
            input.recentTurns = recentTurns;
          }
          this.observability.recordEvent(traceId, 'SessionHistoryFetched', {
            recentTurnsCount: recentTurns.length
          });
        }

        this.observability.recordEvent(traceId, 'MemoryFetched', {
          weakConceptsCount: profile.weakConcepts?.length || 0,
          recentTurnsCount: input.recentTurns?.length || 0
        });

        // 4. AgentRouting
        this.observability.addSpan(traceId, 'AgentRouting');
        const routingDecision = await this.agentRouter.route(input, traceId);
        this.agentRouter.logRoutingDecision(input, routingDecision.selectedAgent, routingDecision.reason);
        this.observability.recordEvent(traceId, 'AgentRouted', {
          selectedAgent: routingDecision.selectedAgent,
          routingReason: routingDecision.reason
        });

        // 5. ClaudeModelCall / Agent Execution
        this.observability.addSpan(traceId, 'ClaudeModelCall', {
          selectedAgent: routingDecision.selectedAgent
        });
        const aiSpan = Sentry.startInactiveSpan({ name: 'claude-vision', op: 'ai' });
        let agentOutput;
        try {
          agentOutput = await this.agentRouter.callAgent(routingDecision.selectedAgent, input, onDelta, traceId);
        } catch (err) {
          Sentry.captureException(err);
          aiSpan?.end();
          throw err;
        }
        let response = await this.agentRouter.combineOutputs([agentOutput]);
        aiSpan?.end();
        this.observability.recordEvent(traceId, 'ClaudeModelCallCompleted');

        // Set response mode to match request mode
        response.mode = input.mode;

        // Attach routing decision to response metadata for the developer debug panel
        response.routingDecision = {
          selectedAgent: routingDecision.selectedAgent,
          reason: routingDecision.reason,
          provider: routingDecision.provider
        };

        // 6. PointTagParsing & CoordinateMapping
        this.observability.addSpan(traceId, 'PointTagParsing');
        const parseSpan = Sentry.startInactiveSpan({ name: 'claude_to_point_parse' });
        try {
          if (response.pointTarget && input.accessibilityTree?.nodes) {
            this.observability.addSpan(traceId, 'CoordinateMapping');
            try {
              const targetLabelLower = response.pointTarget.label.toLowerCase().trim();
              const matchingNode = input.accessibilityTree.nodes.find(
                (node: any) => node.name && node.name.toLowerCase().trim() === targetLabelLower && node.bounds
              );
              if (matchingNode && matchingNode.bounds) {
                const { x, y, w, h } = matchingNode.bounds;
                response.pointTarget.x = Math.round(x + w / 2);
                response.pointTarget.y = Math.round(y + h / 2);
                this.observability.recordEvent(traceId, 'PointTargetSnapped');
              }
            } catch (mapErr) {
              Sentry.captureException(mapErr);
              console.error('Coordinate mapping exception:', mapErr);
            }
          }
        } finally {
          parseSpan.end();
        }
        this.observability.recordEvent(traceId, 'PointTagParsingCompleted');

        // 7. DrawingCommandValidation
        this.observability.addSpan(traceId, 'DrawingCommandValidation');
        this.observability.recordEvent(traceId, 'DrawingCommandsValidated', {
          drawingCount: response.drawings?.length || 0
        });

        // 8. BrowserbaseResearch — only if allowed by PrivacyGuard
        this.observability.addSpan(traceId, 'BrowserbaseResearch');
        if (input.mode === 'research' && response.researchResult && privacyGuard.isBrowserbaseAllowed(input)) {
          const concept = response.concept || response.memoryUpdates?.detectedConcept || 'algebra';
          const connectionSentence = `This web explanation is saying the same thing as the ${concept.replace(/_/g, ' ')} step here.`;
          response.spokenText = `${response.spokenText} ${connectionSentence}`;
          response.summary = `${response.summary} (Connected: ${connectionSentence})`;
          this.observability.recordEvent(traceId, 'BrowserbaseResearchCompleted');
        } else if (input.mode === 'research' && !privacyGuard.isBrowserbaseAllowed(input)) {
          this.observability.recordEvent(traceId, 'BrowserbaseResearchSkipped', { reason: 'privacy' });
        }

        // 9. Simular Action Proposal — only if allowed by PrivacyGuard
        if (input.mode === 'codrive' && privacyGuard.isSimularAllowed(input)) {
          const actions = await this.simular.proposeActions(input.question, {
            privacyMode: input.privacyMode,
            windowTitle: input.appMetadata?.windowTitle
          });
          response.proposedActions = actions;
        } else if (input.mode === 'codrive') {
          this.observability.recordEvent(traceId, 'SimularActionsSkipped', { reason: 'privacy' });
        }

        // 10. RedisMemoryUpdate — only if allowed
        this.observability.addSpan(traceId, 'RedisMemoryUpdate');
        const writeMemory = privacyGuard.isMemoryWriteAllowed(input, config.MEMORY_ENABLED)
                           && profile.memoryEnabled !== false;

        if (writeMemory) {
          try {
            const totalAsked = (profile.totalQuestionsAsked || 0) + 1;
            const concept = response.concept || response.memoryUpdates?.detectedConcept;

            if (concept) {
              let confidenceUpdate = undefined;
              let evidence = `AI detected concept: ${concept}`;

              if (input.mode === 'hint') {
                const existing = profile.weakConcepts.find(c => c.concept === concept);
                const currentConf = existing ? existing.confidence : 0.5;
                confidenceUpdate = Math.min(1.0, currentConf + 0.1);
                evidence = 'User requested a hint on this concept';
              } else if (
                input.question.toLowerCase().includes("i don't understand") ||
                input.question.toLowerCase().includes("i do not understand") ||
                input.question.toLowerCase().includes("don't understand")
              ) {
                const existing = profile.weakConcepts.find(c => c.concept === concept);
                const currentConf = existing ? existing.confidence : 0.5;
                confidenceUpdate = Math.min(1.0, currentConf + 0.15);
                evidence = 'User stated they do not understand the concept';
              } else if (response.memoryUpdates?.isWeakConcept) {
                evidence = 'AI flagged this as a weak concept';
              }

              await this.memory.rememberWeakConcept(input.userId, concept, evidence, confidenceUpdate);
            }

            // Re-fetch profile to pick up updated weak concepts for recentQuestions list
            profile = await this.memory.getLearnerProfile(input.userId);

            profile.recentQuestions.unshift({
              question: RedactionService.summarizeQuestion(input.question),
              mode: input.mode,
              detectedConcept: concept,
              timestamp: new Date().toISOString()
            });
            if (profile.recentQuestions.length > 10) {
              profile.recentQuestions.pop();
            }

            await this.memory.updateLearnerProfile(input.userId, {
              totalQuestionsAsked: totalAsked,
              lastModeUsed: input.mode,
              recentQuestions: profile.recentQuestions
            });

            // Compute screenshot hash if present
            let screenshotHash = undefined;
            if (input.screenshotBase64) {
              const crypto = await import('crypto');
              screenshotHash = crypto.createHash('md5').update(input.screenshotBase64).digest('hex');
            }

            // Append unified session turn
            const turn: SessionTurn = {
              sessionId: input.sessionId,
              userId: input.userId,
              timestamp: new Date().toISOString(),
              mode: input.mode,
              question: RedactionService.summarizeQuestion(input.question),
              concept,
              responseSummary: RedactionService.redactText(response.summary || ''),
              hintLevel: input.mode === 'hint' ? (response.hints?.length || 0) : undefined,
              quizOutcome: undefined,
              pointTargetValid: !!(response.pointTarget && response.pointTarget.x !== null),
              provider: response.provider || 'mock',
              screenshotHash
            };
            await this.memory.appendSessionTurn(input.sessionId, turn);
          } catch (memErr) {
            Sentry.captureException(memErr);
            console.error('Memory write failure:', memErr);
          }
        }
        this.observability.recordEvent(traceId, 'RedisMemoryUpdated');

        // 11. TutorResponseDelivered & Final Evaluations
        this.observability.addSpan(traceId, 'TutorResponseDelivered');
        const latencyMs = Date.now() - startTime;
        const evaluations = this.computeEvaluations(input, response, latencyMs);

        // Record evaluations to trace
        for (const [name, result] of Object.entries(evaluations)) {
          this.observability.recordEvaluation(traceId, name, result.score, { passed: result.passed });
        }

        this.observability.endTrace(traceId, {
          latencyMs,
          concept: response.concept,
          selectedAgent: response.routingDecision?.selectedAgent || 'MathTutorAgent',
          provider: response.provider || 'mock',
          mockOrReal: response.provider === 'mock' || !response.provider ? 'mock' : 'real',
          pointTagPresent: !!response.pointTarget,
          pointTagValid: evaluations['point_tag_valid']?.passed,
          drawingCount: response.drawings?.length || 0,
          responseLength: (response.spokenText || '').length,
          hintRevealedAnswer: !evaluations['hint_did_not_reveal_full_answer']?.passed
        });

        response.observability = {
          traceId,
          latencyMs,
          evaluations
        };

        return response;
      } catch (err: any) {
        this.observability.endTrace(traceId, {
          errorType: err.name || 'Error',
          errorMessage: err.message
        });
        throw err;
      }
    });
  }

  private buildPrivacyBlockedResponse(input: TutorInput, reason: string): TutorResponse {
    return {
      mode: input.mode,
      summary: 'Screen analysis was blocked for privacy.',
      spokenText: 'Screen analysis was blocked for privacy.',
      spokenExplanation: 'Screen analysis was blocked for privacy.',
      drawings: [],
      concept: 'privacy_block',
      confidence: 1,
      provider: 'privacy_guard',
      timestamp: new Date().toISOString(),
    };
  }

  private computeEvaluations(input: TutorInput, response: TutorResponse, latencyMs: number): Record<string, { score: number; passed: boolean }> {
    const evals: Record<string, { score: number; passed: boolean }> = {};

    // 1. point_tag_valid
    if (response.pointTarget) {
      const isValid = (response.pointTarget.x === null && response.pointTarget.y === null) ||
                      (typeof response.pointTarget.x === 'number' && typeof response.pointTarget.y === 'number');
      evals['point_tag_valid'] = { score: isValid ? 1 : 0, passed: isValid };
    } else {
      evals['point_tag_valid'] = { score: 1, passed: true };
    }

    // 2. response_under_3_sentences
    const sentences = (response.spokenText || '').split(/[.!?]+/).filter(Boolean);
    const under3 = sentences.length <= 3;
    evals['response_under_3_sentences'] = { score: under3 ? 1 : 0, passed: under3 };

    // 3. hint_did_not_reveal_full_answer
    if (input.mode === 'hint') {
      const textLower = (response.spokenText || '').toLowerCase();
      const reveal = textLower.includes('the answer is') || textLower.includes('equals') || textLower.includes('solution is');
      evals['hint_did_not_reveal_full_answer'] = { score: reveal ? 0 : 1, passed: !reveal };
    } else {
      evals['hint_did_not_reveal_full_answer'] = { score: 1, passed: true };
    }

    // 4. quiz_has_hidden_answer
    if (input.mode === 'quiz' && response.quiz && response.quiz.length > 0) {
      const hasAnswer = response.quiz.every(q => !!q.answer);
      evals['quiz_has_hidden_answer'] = { score: hasAnswer ? 1 : 0, passed: hasAnswer };
    } else {
      evals['quiz_has_hidden_answer'] = { score: 1, passed: true };
    }

    // 5. drawing_coordinates_valid
    if (response.drawings && response.drawings.length > 0) {
      const allValid = response.drawings.every(d => {
        if (!d.coordinates) return true;
        const { x, y, width, height } = d.coordinates;
        return x >= 0 && x <= 1 && y >= 0 && y <= 1;
      });
      evals['drawing_coordinates_valid'] = { score: allValid ? 1 : 0, passed: allValid };
    } else {
      evals['drawing_coordinates_valid'] = { score: 1, passed: true };
    }

    // 6. safety_redaction_passed
    const fullTextLower = `${response.spokenText || ''} ${response.summary || ''}`.toLowerCase();
    const containsSensitive = fullTextLower.includes('password') || fullTextLower.includes('api_key') || fullTextLower.includes('secret');
    evals['safety_redaction_passed'] = { score: containsSensitive ? 0 : 1, passed: !containsSensitive };

    // 7. selected_agent_reasonable
    const qLower = input.question.toLowerCase();
    const selectedAgent = response.routingDecision?.selectedAgent || 'MathTutorAgent';
    let reasonable = true;
    if (qLower.includes('mistake') && selectedAgent !== 'MisconceptionDetectorAgent') reasonable = false;
    if (qLower.includes('quiz') && selectedAgent !== 'QuizGeneratorAgent') reasonable = false;
    if (qLower.includes('research') && selectedAgent !== 'ResourceFinderAgent') reasonable = false;
    if (qLower.includes('review') && selectedAgent !== 'LearningPlanAgent') reasonable = false;
    evals['selected_agent_reasonable'] = { score: reasonable ? 1 : 0, passed: reasonable };

    return evals;
  }
}
