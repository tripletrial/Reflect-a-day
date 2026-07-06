import { Router } from 'express';
import { getPrompt, listPrompts, savePrompt } from '../prompts/store.js';

const router = Router();

router.get('/', (_req, res) => {
  const prompts = listPrompts().map((name) => {
    const prompt = getPrompt(name);
    return { name, content: prompt.content };
  });
  res.json({ prompts });
});

router.get('/:name', (req, res) => {
  try {
    res.json(getPrompt(req.params.name));
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.put('/:name', (req, res) => {
  try {
    const prompt = savePrompt(req.params.name, req.body?.content ?? '');
    res.json(prompt);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
