import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const narrationsDir = path.join(path.dirname(config.dbPath), 'narrations');

export function ensureNarrationsDir() {
  if (!fs.existsSync(narrationsDir)) {
    fs.mkdirSync(narrationsDir, { recursive: true });
  }
}

export function getNarrationAudioPath(recordId) {
  return path.join(narrationsDir, `${recordId}.mp3`);
}

export function narrationAudioExists(recordId) {
  return fs.existsSync(getNarrationAudioPath(recordId));
}

export function readNarrationAudio(recordId) {
  const filePath = getNarrationAudioPath(recordId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return {
    audioBase64: fs.readFileSync(filePath).toString('base64'),
    mimeType: 'audio/mpeg',
  };
}

export function writeNarrationAudio(recordId, audioBuffer) {
  ensureNarrationsDir();
  fs.writeFileSync(getNarrationAudioPath(recordId), audioBuffer);
}

export function deleteNarrationAudio(recordId) {
  const filePath = getNarrationAudioPath(recordId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
