import { join, resolve } from 'node:path';

// Astro builds run from the project root (pnpm build / astro build).
export const STATIC_DIR = resolve(process.cwd(), 'static');
export const AUDIO_DIR = join(STATIC_DIR, 'media', 'audio');
