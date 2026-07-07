import { Router } from 'express';
import { playNarrationForRecord } from '../agents/narrator.js';
import { askAboutPast } from '../agents/revisit.js';
import { buildDailyReport } from '../agents/retrieval.js';
import { getRecordDetail, listThoughtRecords, deleteThoughtRecord } from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ records: listThoughtRecords() });
});

router.get('/report', (_req, res) => {
  res.json(buildDailyReport(3));
});

router.get('/:id', (req, res) => {
  const detail = getRecordDetail(req.params.id);
  if (!detail) {
    res.status(404).json({ error: 'Record not found' });
    return;
  }
  res.json(detail);
});

router.delete('/:id', (req, res) => {
  const deleted = deleteThoughtRecord(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Record not found' });
    return;
  }
  res.json({ ok: true });
});

router.post('/:id/narrate', async (req, res) => {
  const detail = getRecordDetail(req.params.id);
  if (!detail) {
    res.status(404).json({ error: 'Record not found' });
    return;
  }

  try {
    const result = await playNarrationForRecord(detail, { saveIfGenerated: true });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate narration',
      details: error.message,
    });
  }
});

router.post('/:id/ask', async (req, res) => {
  const detail = getRecordDetail(req.params.id);
  if (!detail) {
    res.status(404).json({ error: 'Record not found' });
    return;
  }

  const { question, history } = req.body ?? {};
  if (!question?.trim()) {
    res.status(400).json({ error: 'question is required' });
    return;
  }

  try {
    const result = await askAboutPast(detail, question.trim(), history ?? []);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to answer question',
      details: error.message,
    });
  }
});

export default router;
