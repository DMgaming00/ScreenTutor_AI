import { describe, it, expect } from 'vitest';
import { MockClaudeProvider } from '../providers/mock-provider.js';
import type { TutorInput } from '@screentutor/shared';

describe('MockClaudeProvider', () => {
  const provider = new MockClaudeProvider();
  
  const baseInput: TutorInput = {
    userId: 'u1',
    sessionId: 's1',
    mode: 'explain',
    question: ''
  };

  // 1. Algebra: distributive property
  describe('distributive property lesson', () => {
    it('handles "Explain this step."', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'algebra_distributive',
        mode: 'explain',
        question: 'Explain this step.'
      });
      expect(res.concept).toBe('distributive_property');
      expect(res.drawings.length).toBeGreaterThan(0);
      expect(res.pointTarget?.label).toBe('outer factor 2');
    });

    it('handles "Why does the 2 multiply both terms?"', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'algebra_distributive',
        mode: 'explain',
        question: 'Why does the 2 multiply both terms?'
      });
      expect(res.concept).toBe('distributive_property');
      expect(res.drawings.length).toBe(1);
    });

    it('handles "Give me a hint."', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'algebra_distributive',
        mode: 'hint',
        question: 'Give me a hint.'
      });
      expect(res.concept).toBe('distributive_property');
      expect(res.hintLadder).toBeDefined();
    });

    it('handles "Quiz me."', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'algebra_distributive',
        mode: 'quiz',
        question: 'Quiz me.'
      });
      expect(res.concept).toBe('distributive_property');
      expect(res.quiz?.length).toBeGreaterThan(0);
    });
  });

  // 2. Algebra: common mistake
  describe('common mistake lesson', () => {
    it('handles "What mistake did I make?"', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'algebra_sqrt_mistake',
        mode: 'mistake',
        question: 'What mistake did I make?'
      });
      expect(res.concept).toBe('sqrt_distribution_error');
      expect(res.drawings.length).toBe(1);
    });

    it('handles "Why is this wrong?"', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'algebra_sqrt_mistake',
        mode: 'explain',
        question: 'Why is this wrong?'
      });
      expect(res.concept).toBe('sqrt_distribution_error');
    });

    it('handles "Give me a hint."', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'algebra_sqrt_mistake',
        mode: 'hint',
        question: 'Give me a hint.'
      });
      expect(res.concept).toBe('sqrt_distribution_error');
      expect(res.hintLadder).toBeDefined();
    });
  });

  // 3. Calculus: chain rule
  describe('chain rule lesson', () => {
    it('handles "Explain this derivative."', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'calculus_chain_rule',
        mode: 'explain',
        question: 'Explain this derivative.'
      });
      expect(res.concept).toBe('chain_rule');
    });

    it('handles "Where is the inner function?"', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'calculus_chain_rule',
        mode: 'explain',
        question: 'Where is the inner function?'
      });
      expect(res.concept).toBe('chain_rule');
      expect(res.pointTarget?.label).toBe('x² inner');
    });

    it('handles "Give me a hint."', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'calculus_chain_rule',
        mode: 'hint',
        question: 'Give me a hint.'
      });
      expect(res.concept).toBe('chain_rule');
      expect(res.hintLadder).toBeDefined();
    });
  });

  // 4. Calculus: u-substitution
  describe('u-substitution lesson', () => {
    it('handles "Explain this integral."', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'calculus_u_sub',
        mode: 'explain',
        question: 'Explain this integral.'
      });
      expect(res.concept).toBe('u_substitution');
    });

    it('handles "Why did they choose u?"', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'calculus_u_sub',
        mode: 'explain',
        question: 'Why did they choose u?'
      });
      expect(res.concept).toBe('u_substitution');
    });

    it('handles "Give me a hint, not the answer."', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'calculus_u_sub',
        mode: 'hint',
        question: 'Give me a hint, not the answer.'
      });
      expect(res.concept).toBe('u_substitution');
    });

    it('handles "Quiz me."', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'calculus_u_sub',
        mode: 'quiz',
        question: 'Quiz me.'
      });
      expect(res.concept).toBe('u_substitution');
    });
  });

  // 5. Graph interpretation
  describe('graph interpretation lesson', () => {
    it('handles "Explain this graph."', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'graph_interpretation',
        mode: 'explain',
        question: 'Explain this graph.'
      });
      expect(res.concept).toBe('parabola_analysis');
    });

    it('handles "Where is the slope positive?"', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'graph_interpretation',
        mode: 'explain',
        question: 'Where is the slope positive?'
      });
      expect(res.concept).toBe('slope_positive_region');
    });

    it('handles "Quiz me."', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'graph_interpretation',
        mode: 'quiz',
        question: 'Quiz me.'
      });
      expect(res.concept).toBe('parabola_analysis');
    });
  });

  // 6. Coding error
  describe('coding error lesson', () => {
    it('handles "Explain this error."', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'code_error',
        mode: 'explain',
        question: 'Explain this error.'
      });
      expect(res.concept).toBe('off_by_one_error');
    });

    it('handles "What mistake did I make?"', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'code_error',
        mode: 'mistake',
        question: 'What mistake did I make?'
      });
      expect(res.concept).toBe('off_by_one_error');
    });

    it('handles "Give me a hint."', async () => {
      const res = await provider.analyzeScreenAndQuestion({
        ...baseInput,
        demoLessonId: 'code_error',
        mode: 'hint',
        question: 'Give me a hint.'
      });
      expect(res.concept).toBe('off_by_one_error');
    });
  });

  describe('validation of all mock responses for valid point tags and drawing coordinates', () => {
    const lessons = [
      { id: 'algebra_distributive', questions: ['Explain this step.', 'Why does the 2 multiply both terms?', 'Give me a hint.', 'Quiz me.'] },
      { id: 'algebra_sqrt_mistake', questions: ['What mistake did I make?', 'Why is this wrong?', 'Give me a hint.'] },
      { id: 'calculus_chain_rule', questions: ['Explain this derivative.', 'Where is the inner function?', 'Give me a hint.', 'Quiz me.'] },
      { id: 'calculus_u_sub', questions: ['Explain this integral.', 'Why did they choose u?', 'Give me a hint, not the answer.', 'Quiz me.'] },
      { id: 'graph_interpretation', questions: ['Explain this graph.', 'Where is the slope positive?', 'Quiz me.'] },
      { id: 'code_error', questions: ['Explain this error.', 'What mistake did I make?', 'Give me a hint.'] }
    ];

    for (const lesson of lessons) {
      for (const question of lesson.questions) {
        it(`lesson ${lesson.id} question "${question}" has valid point tags and drawings`, async () => {
          const res = await provider.analyzeScreenAndQuestion({
            ...baseInput,
            demoLessonId: lesson.id,
            question
          });

          // 1. Verify pointTarget coordinates are valid
          if (res.pointTarget) {
            const { x, y } = res.pointTarget;
            expect((x === null && y === null) || (typeof x === 'number' && typeof y === 'number')).toBe(true);
          }

          // 2. Verify drawing coordinates are normalized [0, 1]
          if (res.drawings && res.drawings.length > 0) {
            for (const drawing of res.drawings) {
              if (drawing.coordinates) {
                const { x, y, width, height } = drawing.coordinates;
                expect(x).toBeGreaterThanOrEqual(0);
                expect(x).toBeLessThanOrEqual(1);
                expect(y).toBeGreaterThanOrEqual(0);
                expect(y).toBeLessThanOrEqual(1);
                if (width !== undefined) {
                  expect(width).toBeGreaterThanOrEqual(0);
                  expect(width).toBeLessThanOrEqual(1);
                }
                if (height !== undefined) {
                  expect(height).toBeGreaterThanOrEqual(0);
                  expect(height).toBeLessThanOrEqual(1);
                }
              }
            }
          }
        });
      }
    }
  });
});
