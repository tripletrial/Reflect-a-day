import { config } from './config.js';

// Voices supported by both Realtime conversation output and gpt-4o-mini-tts narration.
// See: https://developers.openai.com/api/docs/guides/realtime-conversations#voice-options
// See: https://developers.openai.com/api/docs/guides/text-to-speech#voice-options
export const VOICEVER_OPTIONS = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'ash', label: 'Ash' },
  { id: 'ballad', label: 'Ballad' },
  { id: 'cedar', label: 'Cedar' },
  { id: 'coral', label: 'Coral' },
  { id: 'echo', label: 'Echo' },
  { id: 'marin', label: 'Marin' },
  { id: 'sage', label: 'Sage' },
  { id: 'shimmer', label: 'Shimmer' },
  { id: 'verse', label: 'Verse' },
];

export const TTS_VOICES = VOICEVER_OPTIONS.map((voice) => voice.id);

const DEFAULT_SETTINGS = {
  generateNarrationOnSave: true,
  ttsVoice: config.ttsVoice || 'alloy',
};

export function getDefaultSettings() {
  return { ...DEFAULT_SETTINGS };
}

export function isValidTtsVoice(voice) {
  return TTS_VOICES.includes(voice);
}

export function getVoiceLabel(voiceId) {
  return VOICEVER_OPTIONS.find((voice) => voice.id === voiceId)?.label ?? voiceId;
}
