import type { FastifyPluginAsync } from 'fastify';
import { ResearchRequest, RedactionService } from '@screentutor/shared';

export const researchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/research', async (request, reply) => {
    try {
      const req = ResearchRequest.parse(request.body);
      const browserbase = await fastify.getBrowserbase();
      const result = await browserbase.researchConcept(req.concept, req.learnerLevel, req.screenSummary);
      return result;
    } catch (err: any) {
      const safeError = RedactionService.redactError(err);
      return reply.status(400).send({ error: safeError.message || 'Invalid Request' });
    }
  });

  fastify.post('/api/research/simpler', async (request, reply) => {
    try {
      const { concept } = request.body as { concept: string };
      if (!concept) {
        return reply.status(400).send({ error: 'Concept parameter is required' });
      }
      const browserbase = await fastify.getBrowserbase();
      const explanation = await browserbase.findSimplerExplanation(concept);
      return { explanation };
    } catch (err: any) {
      const safeError = RedactionService.redactError(err);
      return reply.status(500).send({ error: safeError.message || 'Internal Server Error' });
    }
  });

  fastify.post('/api/research/practice', async (request, reply) => {
    try {
      const { concept } = request.body as { concept: string };
      if (!concept) {
        return reply.status(400).send({ error: 'Concept parameter is required' });
      }
      const browserbase = await fastify.getBrowserbase();
      const practice = await browserbase.generatePracticeFromWebResource(concept);
      return { practice };
    } catch (err: any) {
      const safeError = RedactionService.redactError(err);
      return reply.status(500).send({ error: safeError.message || 'Internal Server Error' });
    }
  });
};
