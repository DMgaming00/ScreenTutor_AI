import type { FastifyPluginAsync } from 'fastify';
import { ActionApprovalRequest, RedactionService } from '@screentutor/shared';

export const actionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/actions/propose', async (request, reply) => {
    const body = request.body as any;
    const simular = await fastify.getSimular();
    const actions = await simular.proposeActions(body.goal, body.screenContext);
    return actions;
  });

  fastify.post('/api/actions/approve', async (request, reply) => {
    try {
      const req = ActionApprovalRequest.parse(request.body);
      if (!req.approved) {
        return { actionId: req.actionId, success: false, message: 'Action rejected by user' };
      }
      const simular = await fastify.getSimular();
      const result = await simular.executeApprovedAction(req.actionId);
      return result;
    } catch (err: any) {
      const safeError = RedactionService.redactError(err);
      return reply.status(400).send({ error: safeError.message || 'Invalid Request' });
    }
  });
};
