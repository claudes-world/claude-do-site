// Generate list-card thumbnails: static/img/thumbs/<name>-480.webp and -960.webp
// (16:9 cover crop) for every hero/og_image referenced by a post, plus the default OG image.
// Run: pnpm thumbs  (outputs are committed).
import { readdir, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const postsDir = path.join(root, 'content/posts');
const outDir = path.join(root, 'static/img/thumbs');
const refs = new Set(['/img/og-default.png']);
for (const f of await readdir(postsDir)) {
  if (!f.endsWith('.md')) continue;
  const fm = (await readFile(path.join(postsDir, f), 'utf8')).split(/^---\s*$/m)[1] ?? '';
  const m = fm.match(/^hero:\s*["']?(\S+?)["']?\s*$/m);
  if (m) refs.add(m[1]);
}
await mkdir(outDir, { recursive: true });
for (const ref of [...refs].sort()) {
  const src = path.join(root, 'static', ref);
  if (!ref.startsWith('/img/') || !existsSync(src)) { console.warn('skip (missing):', ref); continue; }
  const name = path.basename(ref, path.extname(ref));
  for (const w of [480, 960]) {
    const out = path.join(outDir, `${name}-${w}.webp`);
    const info = await sharp(src).resize(w, Math.round((w * 9) / 16), { fit: 'cover' }).webp({ quality: 68, effort: 5 }).toFile(out);
    console.log(path.relative(root, out), info.size);
  }
}
