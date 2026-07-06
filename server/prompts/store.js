import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_EXTRACTOR_PROMPT,
  DEFAULT_INTERVIEWER_PROMPT,
  DEFAULT_NARRATOR_PROMPT,
  DEFAULT_REVISIT_PROMPT,
} from './defaults.js';

const promptsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'prompts');

const PROMPT_FILES = {
  interviewer: {
    filename: 'interviewer.txt',
    defaultContent: DEFAULT_INTERVIEWER_PROMPT,
  },
  extractor: {
    filename: 'extractor.txt',
    defaultContent: DEFAULT_EXTRACTOR_PROMPT,
  },
  narrator: {
    filename: 'narrator.txt',
    defaultContent: DEFAULT_NARRATOR_PROMPT,
  },
  revisit: {
    filename: 'revisit.txt',
    defaultContent: DEFAULT_REVISIT_PROMPT,
  },
};

function ensurePromptsDir() {
  if (!fs.existsSync(promptsDir)) {
    fs.mkdirSync(promptsDir, { recursive: true });
  }
}

function promptPath(name) {
  const prompt = PROMPT_FILES[name];
  if (!prompt) {
    throw new Error(`Unknown prompt: ${name}`);
  }
  return path.join(promptsDir, prompt.filename);
}

export function listPrompts() {
  return Object.keys(PROMPT_FILES);
}

export function getPrompt(name) {
  ensurePromptsDir();
  const meta = PROMPT_FILES[name];
  const filePath = promptPath(name);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, meta.defaultContent, 'utf8');
  }

  return {
    name,
    content: fs.readFileSync(filePath, 'utf8'),
    path: filePath,
  };
}

export function savePrompt(name, content) {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Prompt content cannot be empty');
  }

  ensurePromptsDir();
  const filePath = promptPath(name);
  fs.writeFileSync(filePath, content.trimEnd() + '\n', 'utf8');

  return getPrompt(name);
}

export function getInterviewerPrompt() {
  return getPrompt('interviewer').content;
}

export function getExtractorPrompt() {
  return getPrompt('extractor').content;
}

export function getNarratorPrompt() {
  return getPrompt('narrator').content;
}

export function getRevisitPrompt() {
  return getPrompt('revisit').content;
}
