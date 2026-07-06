import OpenAI from 'openai';
import { config } from '../config.js';
import { getNarratorPrompt } from '../prompts/store.js';
import { getTtsVoice } from '../settings.js';
import { updateNarrationScript, updateNarrationVoice } from '../db.js';
import {
  deleteNarrationAudio,
  readNarrationAudio,
  writeNarrationAudio,
} from '../narration-audio.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

function formatTranscript(transcript) {
  if (!transcript?.length) {
    return '(No full transcript available — use the structured summary only.)';
  }

  return transcript
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`)
    .join('\n\n');
}

export function buildRecordContext(detail) {
  const { record, transcript } = detail;

  return `REFLECTION DATE: ${record.recordDate}

STRUCTURED SUMMARY:
${record.summary}

HIGHLIGHTS:
${record.highlights.map((item) => `- ${item}`).join('\n') || '(none)'}

KEYWORDS:
${record.keywords.join(', ') || '(none)'}

NOTABLE QUOTES FROM USER:
${record.notableQuotes.map((item) => `- "${item}"`).join('\n') || '(none)'}

OPEN QUESTIONS:
${record.openQuestions.map((item) => `- ${item}`).join('\n') || '(none)'}

FULL TRANSCRIPT:
${formatTranscript(transcript)}`;
}

export function buildRevisitContext(detail) {
  return buildRecordContext(detail);
}

export async function generateNarrationScript(detail) {
  const response = await openai.chat.completions.create({
    model: config.chatModel,
    temperature: 0.7,
    messages: [
      { role: 'system', content: getNarratorPrompt() },
      {
        role: 'user',
        content: `Write the narration script for this reflection:\n\n${buildRecordContext(detail)}`,
      },
    ],
  });

  const script = response.choices[0]?.message?.content?.trim();
  if (!script) {
    throw new Error('Narrator returned no script');
  }

  return script;
}

export async function speakNarration(script, voice = getTtsVoice()) {
  const speech = await openai.audio.speech.create({
    model: config.ttsModel,
    voice,
    input: script,
  });

  const audioBuffer = Buffer.from(await speech.arrayBuffer());

  return {
    audioBuffer,
    audioBase64: audioBuffer.toString('base64'),
    mimeType: 'audio/mpeg',
    voice,
  };
}

export async function playNarrationForRecord(detail, { saveIfGenerated = false } = {}) {
  const recordId = detail.record.id;
  const voice = getTtsVoice();
  let script = detail.record.narrationScript;
  let scriptCached = Boolean(script);

  if (!script) {
    script = await generateNarrationScript(detail);
    scriptCached = false;
    deleteNarrationAudio(recordId);

    if (saveIfGenerated) {
      updateNarrationScript(recordId, script);
      detail.record.narrationScript = script;
      detail.record.narrationVoice = null;
    }
  }

  const canUseCachedAudio = detail.record.narrationVoice === voice;
  if (canUseCachedAudio) {
    const cachedAudio = readNarrationAudio(recordId);
    if (cachedAudio) {
      return {
        script,
        scriptCached,
        audioCached: true,
        voice,
        ...cachedAudio,
      };
    }
  }

  const spoken = await speakNarration(script, voice);
  writeNarrationAudio(recordId, spoken.audioBuffer);
  updateNarrationVoice(recordId, voice);
  detail.record.narrationVoice = voice;

  return {
    script,
    scriptCached,
    audioCached: false,
    voice,
    audioBase64: spoken.audioBase64,
    mimeType: spoken.mimeType,
  };
}
