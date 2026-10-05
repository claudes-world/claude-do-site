// Audio tour: per-section narration players, opt-in by presence of
// static/media/audio/<slug>/<slug>-audio-NN.mp3. Port of the legacy
// build.py audio-tour wiring (feat/audio-tour-support, PR #10, plus the
// empty-intro fix in c8d35f8). Same contract, same loud failures.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { escapeHtml } from './escape.ts';

export const AUDIO_TOUR_CSS = '/assets/audio-tour.css';
export const AUDIO_TOUR_SCRIPT = '/assets/audio-tour.js';

// <slug>-audio-NN.mp3; NN is zero-padded by convention, sorted numerically.
export const AUDIO_FILENAME_RE = /-audio-(\d+)\.mp3$/;
const H2_RE = /<h2[^>]*>([\s\S]*?)<\/h2>/;
const TAG_RE = /<[^>]+>/g;
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr',
]);
const TAG_SCAN_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;

export class AudioTourError extends Error {}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Net change in block-nesting depth contributed by one line's tags. */
export function lineDepthDelta(line: string): number {
  let delta = 0;
  for (const match of line.matchAll(TAG_SCAN_RE)) {
    const closing = match[1];
    const tag = match[2].toLowerCase();
    if (VOID_ELEMENTS.has(tag) || match[0].endsWith('/>')) continue;
    delta += closing ? -1 : 1;
  }
  return delta;
}

/** Line indices of section boundaries: 0, every depth-0 line opening with <h2, and the end. */
export function topLevelH2Bounds(lines: string[]): number[] {
  const bounds = [0];
  let depth = 0;
  lines.forEach((line, index) => {
    if (line.startsWith('<h2') && depth === 0) bounds.push(index);
    depth += lineDepthDelta(line);
  });
  bounds.push(lines.length);
  return bounds;
}

/** Sort audio file names numerically on the trailing -audio-NN. */
export function sortAudioFiles(names: string[]): string[] {
  return [...names].sort(
    (left, right) =>
      Number(AUDIO_FILENAME_RE.exec(left)![1]) - Number(AUDIO_FILENAME_RE.exec(right)![1]),
  );
}

/**
 * Audio files for a post, numerically ordered. Missing directory means no
 * audio tour. A file matching `<slug>-audio-*.mp3` without the exact
 * `<slug>-audio-<digits>.mp3` shape fails the build.
 */
export function audioFilesFor(audioRoot: string, slug: string): string[] {
  const directory = join(audioRoot, slug);
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return [];
  const glob = new RegExp(`^${escapeRegExp(slug)}-audio-.*\\.mp3$`);
  const files = readdirSync(directory).filter((name) => glob.test(name));
  const bad = files.filter((name) => !AUDIO_FILENAME_RE.test(name));
  if (bad.length) {
    throw new AudioTourError(
      `${directory}: file(s) matching '${slug}-audio-*.mp3' but not the exact ` +
        `'${slug}-audio-<digits>.mp3' shape: ${bad.join(', ')} — fix the filename, ` +
        `don't let it sort in silently.`,
    );
  }
  return sortAudioFiles(files);
}

/**
 * Wrap rendered post HTML into one <section> per top-level <h2> (the intro
 * before the first <h2> is section 1 when it has visible text), pairing each
 * with an audio file in order. Counts must match exactly.
 */
export function wrapAudioSections(
  bodyHtml: string,
  slug: string,
  audioFiles: string[],
  sourcePath: string,
  audioRoot = 'static/media/audio',
): string {
  const lines = bodyHtml.split('\n');
  const bounds = topLevelH2Bounds(lines);
  let chunks = bounds.slice(0, -1).map((start, index) => lines.slice(start, bounds[index + 1]));
  const introHtml = chunks[0].join('\n').replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, '');
  const hasIntro = introHtml.replace(TAG_RE, '').trim().length > 0;
  let passthrough: string[] = [];
  if (!hasIntro) {
    passthrough = chunks[0];
    chunks = chunks.slice(1);
  }
  if (audioFiles.length !== chunks.length) {
    throw new AudioTourError(
      `Post ${sourcePath} (slug '${slug}'): ${audioFiles.length} audio file(s) in ` +
        `${join(audioRoot, slug)} but ${chunks.length} section(s) found (` +
        `${hasIntro ? '1 intro + ' : 'no intro text, so '}one per top-level <h2>) — ` +
        `counts must match exactly; check for numbering drift.`,
    );
  }
  const out = [...passthrough];
  chunks.forEach((chunk, index) => {
    let title: string;
    if (index === 0 && hasIntro) {
      title = 'Introduction';
    } else {
      const match = H2_RE.exec(chunk[0]);
      title = match ? match[1].replace(TAG_RE, '') : `Section ${index + 1}`;
    }
    const titleAttribute = escapeHtml(title);
    out.push(
      `<section class="at-section" data-audio-section="${index + 1}" data-audio-title="${titleAttribute}">`,
    );
    out.push(
      `<div class="listen"><span class="label">Listen along</span>` +
        `<audio controls preload="none" src="/media/audio/${slug}/${audioFiles[index]}" ` +
        `aria-label="Read aloud: ${titleAttribute}"></audio></div>`,
    );
    out.push(...chunk);
    out.push('</section>');
  });
  return out.join('\n');
}
