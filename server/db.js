import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';
import { deleteNarrationAudio } from './narration-audio.js';

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(config.dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active', 'completed', 'processing', 'failed'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS thought_records (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
    record_date TEXT NOT NULL,
    summary TEXT NOT NULL,
    highlights_json TEXT NOT NULL DEFAULT '[]',
    keywords_json TEXT NOT NULL DEFAULT '[]',
    open_questions_json TEXT NOT NULL DEFAULT '[]',
    notable_quotes_json TEXT NOT NULL DEFAULT '[]',
    embedding_json TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_thought_records_date ON thought_records(record_date DESC);
`);

const thoughtRecordColumns = db.prepare(`PRAGMA table_info(thought_records)`).all();
if (!thoughtRecordColumns.some((column) => column.name === 'narration_script')) {
  db.exec(`ALTER TABLE thought_records ADD COLUMN narration_script TEXT`);
}
if (!thoughtRecordColumns.some((column) => column.name === 'narration_voice')) {
  db.exec(`ALTER TABLE thought_records ADD COLUMN narration_voice TEXT`);
}

export function createSession(id, startedAt = new Date().toISOString()) {
  db.prepare(
    `INSERT INTO sessions (id, started_at, status) VALUES (?, ?, 'active')`
  ).run(id, startedAt);
  return getSession(id);
}

export function getSession(id) {
  return db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id);
}

export function listSessions(limit = 50) {
  return db
    .prepare(
      `SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?`
    )
    .all(limit);
}

export function addMessage(sessionId, role, content, createdAt = new Date().toISOString()) {
  const result = db
    .prepare(
      `INSERT INTO messages (session_id, role, content, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(sessionId, role, content, createdAt);
  return result.lastInsertRowid;
}

export function getMessages(sessionId) {
  return db
    .prepare(
      `SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC, id ASC`
    )
    .all(sessionId);
}

export function markSessionProcessing(id) {
  db.prepare(`UPDATE sessions SET status = 'processing' WHERE id = ?`).run(id);
}

export function completeSession(id, endedAt = new Date().toISOString()) {
  db.prepare(
    `UPDATE sessions SET status = 'completed', ended_at = ? WHERE id = ?`
  ).run(endedAt, id);
}

export function failSession(id) {
  db.prepare(`UPDATE sessions SET status = 'failed' WHERE id = ?`).run(id);
}

export function discardSession(id) {
  const result = db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function saveThoughtRecord(record) {
  db.prepare(
    `INSERT INTO thought_records (
      id, session_id, record_date, summary,
      highlights_json, keywords_json, open_questions_json,
      notable_quotes_json, embedding_json, narration_script, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.id,
    record.sessionId,
    record.recordDate,
    record.summary,
    JSON.stringify(record.highlights),
    JSON.stringify(record.keywords),
    JSON.stringify(record.openQuestions),
    JSON.stringify(record.notableQuotes),
    record.embedding ? JSON.stringify(record.embedding) : null,
    record.narrationScript ?? null,
    record.createdAt
  );
  return record;
}

export function updateNarrationScript(recordId, narrationScript) {
  deleteNarrationAudio(recordId);
  db.prepare(
    `UPDATE thought_records SET narration_script = ?, narration_voice = NULL WHERE id = ?`
  ).run(narrationScript, recordId);
}

export function updateNarrationVoice(recordId, narrationVoice) {
  db.prepare(
    `UPDATE thought_records SET narration_voice = ? WHERE id = ?`
  ).run(narrationVoice, recordId);
}

export function listThoughtRecords(limit = 50) {
  return db
    .prepare(
      `SELECT * FROM thought_records ORDER BY record_date DESC, created_at DESC LIMIT ?`
    )
    .all(limit)
    .map(parseThoughtRecord);
}

export function getThoughtRecord(id) {
  const row = db.prepare(`SELECT * FROM thought_records WHERE id = ?`).get(id);
  return row ? parseThoughtRecord(row) : null;
}

export function getThoughtRecordBySession(sessionId) {
  const row = db
    .prepare(`SELECT * FROM thought_records WHERE session_id = ?`)
    .get(sessionId);
  return row ? parseThoughtRecord(row) : null;
}

export function getRecordDetail(id) {
  const record = getThoughtRecord(id);
  if (!record) {
    return null;
  }

  const messages = getMessages(record.sessionId);
  return {
    record,
    transcript: messages.map((message) => ({
      role: message.role,
      content: message.content,
      createdAt: message.created_at,
    })),
  };
}

export function deleteThoughtRecord(id) {
  const record = getThoughtRecord(id);
  if (!record) {
    return false;
  }

  deleteNarrationAudio(id);
  const result = db.prepare(`DELETE FROM thought_records WHERE id = ?`).run(id);
  return result.changes > 0;
}

function parseThoughtRecord(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    recordDate: row.record_date,
    summary: row.summary,
    highlights: JSON.parse(row.highlights_json),
    keywords: JSON.parse(row.keywords_json),
    openQuestions: JSON.parse(row.open_questions_json),
    notableQuotes: JSON.parse(row.notable_quotes_json),
    embedding: row.embedding_json ? JSON.parse(row.embedding_json) : null,
    narrationScript: row.narration_script || null,
    narrationVoice: row.narration_voice || null,
    createdAt: row.created_at,
  };
}
