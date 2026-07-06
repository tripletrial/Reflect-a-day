import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { getDefaultSettings, isValidTtsVoice, TTS_VOICES } from './tts-voices.js';

const settingsPath = path.join(path.dirname(config.dbPath), 'settings.json');

function ensureSettingsFile() {
  const dir = path.dirname(settingsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify(getDefaultSettings(), null, 2), 'utf8');
  }
}

export function getSettings() {
  ensureSettingsFile();
  const raw = fs.readFileSync(settingsPath, 'utf8');
  return { ...getDefaultSettings(), ...JSON.parse(raw) };
}

export function getTtsVoice() {
  const { ttsVoice } = getSettings();
  return isValidTtsVoice(ttsVoice) ? ttsVoice : getDefaultSettings().ttsVoice;
}

export function saveSettings(partial) {
  const current = getSettings();
  const next = { ...current, ...partial };

  if (typeof next.generateNarrationOnSave !== 'boolean') {
    throw new Error('generateNarrationOnSave must be a boolean');
  }

  if (!isValidTtsVoice(next.ttsVoice)) {
    throw new Error(`ttsVoice must be one of: ${TTS_VOICES.join(', ')}`);
  }

  fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
