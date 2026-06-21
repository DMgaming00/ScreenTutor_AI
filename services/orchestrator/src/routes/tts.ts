import type { FastifyPluginAsync } from 'fastify';
import { RedactionService } from '@screentutor/shared';
import { config } from '../config.js';

export const ttsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/tts/status', async () => {
    const configured = !!(config.ELEVENLABS_API_KEY && config.ELEVENLABS_VOICE_ID);
    return {
      enabled: config.ELEVENLABS_ENABLED && configured,
      configured,
    };
  });

  fastify.post('/api/tts/speak', async (request, reply) => {
    try {
      const { text } = request.body as { text?: string };
      if (!text?.trim()) {
        return reply.status(400).send({ error: 'text is required' });
      }

      if (!config.ELEVENLABS_ENABLED) {
        return reply.status(503).send({ error: 'ElevenLabs TTS is disabled' });
      }

      const elevenlabs = await fastify.getElevenLabs();
      if (!elevenlabs.isConfigured()) {
        return reply.status(503).send({ error: 'ElevenLabs TTS is not configured' });
      }

      const audio = await elevenlabs.synthesizeSpeech(text);
      return reply.header('Content-Type', 'audio/mpeg').send(audio);
    } catch (err: any) {
      fastify.log.error(err);
      const safeError = RedactionService.redactError(err);
      return reply.status(500).send({ error: safeError.message || 'TTS failed' });
    }
  });
};
