import { Router } from 'express';
import { getSettings, saveSettings } from '../settings.js';
import { TTS_VOICES, VOICEVER_OPTIONS } from '../tts-voices.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    settings: getSettings(),
    voices: TTS_VOICES,
    voiceOptions: VOICEVER_OPTIONS,
  });
});

router.put('/', (req, res) => {
  try {
    const settings = saveSettings(req.body ?? {});
    res.json({
      settings,
      voices: TTS_VOICES,
      voiceOptions: VOICEVER_OPTIONS,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
