import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { getExtractorPrompt } from '../prompts/store.js';
import {
  completeSession,
  failSession,
  getMessages,
  markSessionProcessing,
  saveThoughtRecord,
  updateNarrationScript,
} from '../db.js';
import { generateNarrationScript } from './narrator.js';
import { getSettings } from '../settings.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

function formatTranscript(messages) {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n\n');
}

function parseExtractorJson(raw) {
  const trimmed = raw.trim();
  const withoutFences = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '');
  return JSON.parse(withoutFences);
}

export async function extractThoughtRecord(sessionId) {
  const messages = getMessages(sessionId);
  if (messages.length === 0) {
    throw new Error('Cannot extract from an empty session');
  }

  markSessionProcessing(sessionId);

  try {
    const response = await openai.chat.completions.create({
      model: config.chatModel,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: getExtractorPrompt() },
        {
          role: 'user',
          content: `Extract a thought record from this reflection session transcript:\n\n${formatTranscript(messages)}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Extractor returned no content');
    }

    const parsed = parseExtractorJson(content);
    const embedText = [
      parsed.summary,
      ...(parsed.highlights || []),
      ...(parsed.keywords || []),
    ].join('\n');

    const embeddingResponse = await openai.embeddings.create({
      model: config.embeddingModel,
      input: embedText,
    });

    const embedding = embeddingResponse.data[0]?.embedding;
    const recordId = randomUUID();
    const createdAt = new Date().toISOString();

    const record = saveThoughtRecord({
      id: recordId,
      sessionId,
      recordDate: createdAt.slice(0, 10),
      summary: parsed.summary,
      highlights: parsed.highlights || [],
      keywords: parsed.keywords || [],
      openQuestions: parsed.openQuestions || [],
      notableQuotes: parsed.notableQuotes || [],
      embedding,
      createdAt,
    });

    const settings = getSettings();

    if (settings.generateNarrationOnSave) {
      const detail = {
        record,
        transcript: messages.map((message) => ({
          role: message.role,
          content: message.content,
          createdAt: message.created_at,
        })),
      };

      const narrationScript = await generateNarrationScript(detail);
      updateNarrationScript(recordId, narrationScript);
      record.narrationScript = narrationScript;
    }

    completeSession(sessionId);
    return record;
  } catch (error) {
    failSession(sessionId);
    throw error;
  }
}
