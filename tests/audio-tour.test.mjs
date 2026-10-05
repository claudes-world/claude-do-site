// Port of the legacy tests/test_audio_tour.py (build.py audio-tour wiring)
// to the Astro implementation in src/blog-core/audio-tour.ts.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  AUDIO_FILENAME_RE,
  AudioTourError,
  audioFilesFor,
  sortAudioFiles,
  topLevelH2Bounds,
  wrapAudioSections,
} from '../src/blog-core/audio-tour.ts';

test('a heading nested in a blockquote is not a section boundary', () => {
  const lines = [
    '<p>Intro.</p>',
    '<blockquote>',
    '<p>Some quoted setup.</p>',
    '<h2 id="nested-heading">Nested Heading</h2>',
    '<p>More quoted text.</p>',
    '</blockquote>',
    '<h2 id="real-section">Real Section</h2>',
    '<p>Body.</p>',
  ];
  const bounds = topLevelH2Bounds(lines);
  assert.deepEqual(bounds, [0, 6, 8]);
  const chunks = bounds.slice(0, -1).map((start, index) => lines.slice(start, bounds[index + 1]));
  assert.ok(chunks[0].includes('<blockquote>'));
  assert.ok(chunks[0].includes('</blockquote>'));
  assert.ok(chunks[1][0].startsWith('<h2 id="real-section"'));
});

test('plain two-section post', () => {
  const lines = ['<p>Intro.</p>', '<h2 id="one">One</h2>', '<p>Body one.</p>', '<h2 id="two">Two</h2>', '<p>Body two.</p>'];
  assert.deepEqual(topLevelH2Bounds(lines), [0, 1, 3, 5]);
});

test('audio files sort numerically, not lexicographically', () => {
  assert.deepEqual(
    sortAudioFiles(['post-audio-1.mp3', 'post-audio-10.mp3', 'post-audio-2.mp3', 'post-audio-9.mp3']),
    ['post-audio-1.mp3', 'post-audio-2.mp3', 'post-audio-9.mp3', 'post-audio-10.mp3'],
  );
});

test('audio filename shape', () => {
  assert.equal(AUDIO_FILENAME_RE.test('post-audio-final.mp3'), false);
  assert.equal(AUDIO_FILENAME_RE.test('post-audio-04.mp3'), true);
});

test('audioFilesFor: absent directory means no tour; near-miss names fail loudly', () => {
  const root = mkdtempSync(join(tmpdir(), 'audio-tour-test-'));
  assert.deepEqual(audioFilesFor(root, 'missing'), []);
  mkdirSync(join(root, 'post'));
  for (const name of ['post-audio-10.mp3', 'post-audio-02.mp3', 'post-audio-01.mp3', 'other.mp3']) {
    writeFileSync(join(root, 'post', name), '');
  }
  assert.deepEqual(audioFilesFor(root, 'post'), ['post-audio-01.mp3', 'post-audio-02.mp3', 'post-audio-10.mp3']);
  writeFileSync(join(root, 'post', 'post-audio-final.mp3'), '');
  assert.throws(() => audioFilesFor(root, 'post'), AudioTourError);
});

test('fewer files than sections fails', () => {
  const body = '<p>Intro.</p>\n<h2 id="one">One</h2>\n<p>Body one.</p>\n<h2 id="two">Two</h2>\n<p>Body two.</p>';
  assert.throws(() => wrapAudioSections(body, 'slug', ['slug-audio-01.mp3'], 'fake-path'), AudioTourError);
});

test('more files than sections fails', () => {
  assert.throws(
    () => wrapAudioSections('<p>Intro only, no headings.</p>', 'slug', ['slug-audio-01.mp3', 'slug-audio-02.mp3'], 'fake-path'),
    AudioTourError,
  );
});

test('exact match wraps cleanly', () => {
  const out = wrapAudioSections(
    '<p>Intro.</p>\n<h2 id="one">One</h2>\n<p>Body one.</p>',
    'slug',
    ['slug-audio-01.mp3', 'slug-audio-02.mp3'],
    'fake-path',
  );
  assert.equal(out.match(/data-audio-section=/g).length, 2);
  assert.ok(out.includes('/media/audio/slug/slug-audio-01.mp3'));
  assert.ok(out.includes('/media/audio/slug/slug-audio-02.mp3'));
  assert.ok(out.includes('aria-label="Read aloud: Introduction"'));
});

test('an intro with no visible text gets no section or player', () => {
  const html = '\n<style>\n.prose{--x:1}\n</style>\n<h2 id="one">One</h2>\n<p>Body one.</p>\n<h2 id="two">Two</h2>\n<p>Body two.</p>';
  const files = ['s-audio-01.mp3', 's-audio-02.mp3'];
  const out = wrapAudioSections(html, 's', files, 'post.md');
  assert.equal(out.match(/<section class="at-section"/g).length, 2);
  assert.ok(out.includes('<style>'));
  assert.ok(!out.includes('Introduction'));
  assert.ok(out.includes('data-audio-section="1" data-audio-title="One"'));
  assert.ok(out.split('</section>')[0].includes('s-audio-01.mp3'));
  assert.throws(() => wrapAudioSections(html, 's', [...files, 's-audio-03.mp3'], 'post.md'), AudioTourError);
});

test('an intro with text keeps its section', () => {
  const out = wrapAudioSections('<p>Intro.</p>\n<h2 id="one">One</h2>\n<p>Body one.</p>', 's', ['s-audio-01.mp3', 's-audio-02.mp3'], 'post.md');
  assert.ok(out.includes('data-audio-title="Introduction"'));
});

test('section titles are tag-stripped and attribute-escaped', () => {
  const out = wrapAudioSections('<h2 id="x">Say <em>"hi"</em></h2>\n<p>Body.</p>', 's', ['s-audio-01.mp3'], 'post.md');
  assert.ok(out.includes('data-audio-title="Say &quot;hi&quot;"'));
});
