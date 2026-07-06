import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import sessionsRouter from './routes/sessions.js';
import realtimeRouter from './routes/realtime.js';
import recordsRouter from './routes/records.js';
import promptsRouter from './routes/prompts.js';
import settingsRouter from './routes/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(publicDir));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'Reflect a Day',
    chatModel: config.chatModel,
    realtimeModel: config.realtimeModel,
  });
});

app.use('/api/sessions', sessionsRouter);
app.use('/api/realtime', realtimeRouter);
app.use('/api/records', recordsRouter);
app.use('/api/prompts', promptsRouter);
app.use('/api/settings', settingsRouter);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`Reflect a Day running at http://localhost:${config.port}`);
});
