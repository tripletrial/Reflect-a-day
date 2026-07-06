import './env.js';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  openaiApiKey: requireEnv('OPENAI_API_KEY'),
  chatModel: process.env.CHAT_MODEL || 'gpt-5.4-mini',
  realtimeModel: process.env.REALTIME_MODEL || 'gpt-realtime-mini',
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  ttsModel: process.env.TTS_MODEL || 'gpt-4o-mini-tts',
  ttsVoice: process.env.TTS_VOICE || 'alloy',
  dbPath: process.env.DB_PATH || 'data/reflect.db',
};
