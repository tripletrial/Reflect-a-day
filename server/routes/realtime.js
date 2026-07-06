import { Router } from 'express';
import OpenAI from 'openai';
import { config } from '../config.js';
import { getInterviewerPrompt } from '../prompts/store.js';
import { getTtsVoice } from '../settings.js';
import { getSession } from '../db.js';

const router = Router();
const openai = new OpenAI({ apiKey: config.openaiApiKey });

router.post('/token', async (req, res) => {
  const { sessionId } = req.body ?? {};

  if (sessionId) {
    const session = getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
  }

  try {
    const clientSecret = await openai.realtime.clientSecrets.create({
      expires_after: { anchor: 'created_at', seconds: 60 * 30 },
      session: {
        type: 'realtime',
        model: config.realtimeModel,
        instructions: getInterviewerPrompt(),
        output_modalities: ['audio'],
        audio: {
          input: {
            turn_detection: null,
            transcription: {
              model: 'gpt-4o-mini-transcribe',
            },
          },
          output: {
            voice: getTtsVoice(),
          },
        },
      },
    });

    res.json({
      ephemeralKey: clientSecret.value,
      model: config.realtimeModel,
      expiresAt: clientSecret.expires_at ?? null,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create realtime session token',
      details: error.message,
    });
  }
});

export default router;
