import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Prefer project .env over any OPENAI_API_KEY already set in the shell.
dotenv.config({ path: path.join(rootDir, '.env'), override: true });
