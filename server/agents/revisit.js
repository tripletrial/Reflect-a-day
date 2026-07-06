import OpenAI from 'openai';
import { config } from '../config.js';
import { buildRevisitContext } from './narrator.js';
import { getRevisitPrompt } from '../prompts/store.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export async function askAboutPast(detail, question, history = []) {
  const context = buildRevisitContext(detail);

  const messages = [
    {
      role: 'system',
      content: `${getRevisitPrompt()}\n\n--- REFLECTION CONTEXT ---\n${context}`,
    },
    ...history.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    {
      role: 'user',
      content: question,
    },
  ];

  const response = await openai.chat.completions.create({
    model: config.chatModel,
    temperature: 0.5,
    messages,
  });

  const answer = response.choices[0]?.message?.content?.trim();
  if (!answer) {
    throw new Error('Revisit agent returned no answer');
  }

  return { answer };
}
