import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  addMessage,
  createSession,
  discardSession,
  getMessages,
  getSession,
  getThoughtRecordBySession,
} from '../db.js';
import { extractThoughtRecord } from '../agents/extractor.js';

const router = Router();

router.post('/start', (_req, res) => {
  const session = createSession(randomUUID());
  res.json({ session });
});

router.get('/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.json({
    session,
    messages: getMessages(req.params.id),
    thoughtRecord: getThoughtRecordBySession(req.params.id),
  });
});

router.post('/:id/messages', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const { role, content } = req.body;
  if (!role || !content) {
    res.status(400).json({ error: 'role and content are required' });
    return;
  }

  if (!['user', 'assistant'].includes(role)) {
    res.status(400).json({ error: 'role must be user or assistant' });
    return;
  }

  addMessage(req.params.id, role, content.trim());
  res.json({ ok: true });
});

router.post('/:id/discard', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (session.status === 'completed') {
    res.status(400).json({ error: 'Cannot discard a saved session' });
    return;
  }

  discardSession(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/end', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (session.status === 'completed') {
    const thoughtRecord = getThoughtRecordBySession(req.params.id);
    res.json({ session: getSession(req.params.id), thoughtRecord });
    return;
  }

  try {
    const thoughtRecord = await extractThoughtRecord(req.params.id);
    res.json({
      session: getSession(req.params.id),
      thoughtRecord,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to extract thought record',
      details: error.message,
    });
  }
});

export default router;
