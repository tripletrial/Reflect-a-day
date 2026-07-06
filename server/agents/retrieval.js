import { listThoughtRecords } from '../db.js';

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildDailyReport(limit = 3) {
  const records = listThoughtRecords(30);
  if (records.length === 0) {
    return { items: [], message: 'No reflections saved yet. Start a session to capture your first thoughts.' };
  }

  const weighted = shuffle(records).slice(0, Math.min(limit, records.length));
  const items = weighted.map((record) => ({
    id: record.id,
    sessionId: record.sessionId,
    recordDate: record.recordDate,
    summary: record.summary,
    highlight: record.highlights[0] || record.summary,
    keywords: record.keywords.slice(0, 5),
    notableQuote: record.notableQuotes[0] || null,
  }));

  return {
    items,
    message: 'A few ideas from past you — pick one up if it sparks something.',
  };
}
