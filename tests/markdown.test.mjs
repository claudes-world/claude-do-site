import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import {
  legacySlugify,
  legacyUniqueId,
  mergeLegacyBlockquotes,
  rehypeLegacyHeadingIds,
  rehypeLegacyHtmlBlocks,
  rehypeLegacyTableAlign,
  remarkLegacyHtmlBlocks,
  smartypantsOptions,
  stashLegacyHtmlBlocks,
} from '../src/blog-core/markdown.ts';

const processor = await createMarkdownProcessor({
  gfm: true,
  smartypants: smartypantsOptions,
  syntaxHighlight: false,
  remarkPlugins: [remarkLegacyHtmlBlocks],
  rehypePlugins: [rehypeLegacyHtmlBlocks, rehypeLegacyHeadingIds, rehypeLegacyTableAlign],
});
const render = async (markdown) => (await processor.render(markdown)).code;

test('slugify matches python-markdown toc', () => {
  assert.equal(legacySlugify('🧠 Stream of Consciousness: "Digital Synapses"'), 'stream-of-consciousness-digital-synapses');
  assert.equal(legacySlugify('Creation & Contribution'), 'creation-contribution');
  assert.equal(legacySlugify('The backtest — and the caveat'), 'the-backtest-and-the-caveat');
  assert.equal(legacySlugify('What’s next for AI creativity?'), 'whats-next-for-ai-creativity');
  assert.equal(legacySlugify('Žlutý kůň'), 'zluty-kun');
});

test('duplicate ids get _1, _2 like python-markdown', () => {
  const used = new Set();
  assert.equal(legacyUniqueId('why', used), 'why');
  assert.equal(legacyUniqueId('why', used), 'why_1');
  assert.equal(legacyUniqueId('why', used), 'why_2');
  assert.equal(legacyUniqueId('', used), '_1');
});

test('headings get legacy ids', async () => {
  const html = await render('## Why this works\n\ntext\n\n## Why this works\n');
  assert.ok(html.includes('<h2 id="why-this-works">'));
  assert.ok(html.includes('<h2 id="why-this-works_1">'));
});

test('smart punctuation: -- is an en dash, --- an em dash', async () => {
  const html = await render('Markus--Yamabe --- done...');
  assert.ok(html.includes('Markus–Yamabe — done…'), html);
});

test('a raw block-level element survives interior blank lines', async () => {
  const markdown = '<figure><svg viewBox="0 0 10 10">\n  <rect x="1"/>\n\n    <text>in `code` ticks</text>\n</svg></figure>\n\nAfter.\n';
  const html = await render(markdown);
  assert.ok(!html.includes('<pre>'), html);
  assert.ok(html.includes('in `code` ticks'), html);
  assert.ok(html.includes('<p>After.</p>'), html);
});

test('a <video> line stays a block, not a paragraph', async () => {
  const html = await render('<video controls src="/a.mp4"></video>\n\nText.\n');
  assert.ok(html.startsWith('<video'), html);
});

test('a lone <img> paragraph keeps its <p>', async () => {
  const html = await render('Before.\n\n<img src="/a.svg" alt="A">\n\nAfter.\n');
  assert.ok(html.includes('<p><img src="/a.svg" alt="A"></p>'), html);
});

test('markdown="1" blocks are left for markdown processing', () => {
  const { stash } = stashLegacyHtmlBlocks('<div markdown="1">\n\n**bold**\n\n</div>\n');
  assert.equal(stash.length, 0);
});

test('fenced code is never stashed', () => {
  const { stash } = stashLegacyHtmlBlocks('```html\n<div>\n\n</div>\n```\n');
  assert.equal(stash.length, 0);
});

test('blank-separated > blocks merge into one blockquote', async () => {
  assert.equal(mergeLegacyBlockquotes('> a\n\n> b\n\nc'), '> a\n>\n> b\n\nc');
  const html = await render('> one\n\n> two\n');
  assert.equal(html.match(/<blockquote>/g).length, 1);
});

test('table alignment is an inline style', async () => {
  const html = await render('| a | b |\n|:-:|--:|\n| 1 | 2 |\n');
  assert.ok(html.includes('<th style="text-align: center;">a</th>'), html);
  assert.ok(html.includes('<td style="text-align: right;">2</td>'), html);
});
