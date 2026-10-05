import assert from 'node:assert/strict';
import test from 'node:test';
import { postSchema } from '../src/blog-core/content.ts';
import { absoluteUrl, buildArticleJsonLd, pngDimensions, postKeywords, serializeJsonLd } from '../src/blog-core/seo.ts';

const brand = {
  name: "Claude's World",
  url: 'https://claude.do',
  publisherLogo: '/img/claude-do-mark.svg',
};

test('absoluteUrl preserves absolute inputs and normalizes root-relative paths', () => {
  assert.equal(absoluteUrl(brand, '/img/example.png'), 'https://claude.do/img/example.png');
  assert.equal(absoluteUrl(brand, 'https://cdn.example/og.png'), 'https://cdn.example/og.png');
});

test('WORLD-200 optional fields reach Article, FAQ, and breadcrumb JSON-LD', () => {
  const jsonLd = buildArticleJsonLd(brand, {
    title: 'Structured post',
    description: 'A structured description.',
    slug: 'structured-post',
    date: new Date('2026-01-02T00:00:00.000Z'),
    updated: new Date('2026-01-03T00:00:00.000Z'),
    author: 'Claude-do',
    hero: '/img/hero.png',
    entities: [{ name: 'Astro', sameAs: 'https://astro.build/' }],
    faq: [{ q: 'Does this render?', a: 'Yes, visibly and in JSON-LD.' }],
  });

  const [article, breadcrumbs, faq] = jsonLd['@graph'];
  assert.equal(article.datePublished, '2026-01-02');
  assert.equal(article.dateModified, '2026-01-03');
  assert.equal(article.image, 'https://claude.do/img/hero.png');
  assert.deepEqual(article.about, [
    { '@type': 'Thing', name: 'Astro', sameAs: 'https://astro.build/' },
  ]);
  assert.equal(breadcrumbs.itemListElement[2].item, 'https://claude.do/blog/structured-post/');
  assert.equal(faq.mainEntity[0].acceptedAnswer.text, 'Yes, visibly and in JSON-LD.');
});

test('JSON-LD serializer neutralizes HTML-significant characters', () => {
  const serialized = serializeJsonLd({ value: '</script><b>&' });
  assert.equal(serialized, '{"value":"\\u003c/script\\u003e\\u003cb\\u003e\\u0026"}');
  assert.equal(JSON.parse(serialized).value, '</script><b>&');
});

test('content schema preserves ISO-date and WORLD-200 validation', () => {
  const valid = postSchema.parse({
    title: 'Validated post',
    slug: 'validated-post',
    date: '2026-01-02',
    updated: '2026-01-03',
    description: 'Validated.',
    faq: [{ q: 'Valid?', a: 'Yes.' }],
    entities: [{ name: 'Astro', sameAs: 'https://astro.build/' }],
  });
  assert.equal(valid.date.toISOString(), '2026-01-02T00:00:00.000Z');
  assert.equal(valid.updated.toISOString(), '2026-01-03T00:00:00.000Z');

  assert.equal(postSchema.safeParse({ ...valid, updated: '2026-01-01' }).success, false);
  assert.equal(postSchema.safeParse({ ...valid, date: 'January 2, 2026' }).success, false);
  assert.equal(postSchema.safeParse({ ...valid, faq: [{ q: 'Missing answer' }] }).success, false);
});

test('entity type and alternateName reach JSON-LD about[]', () => {
  const jsonLd = buildArticleJsonLd(brand, {
    title: 'Entities',
    description: 'd',
    slug: 'entities',
    date: new Date('2026-07-19T00:00:00.000Z'),
    entities: [
      { name: 'PulsePlay', type: 'Organization', alternateName: '0xPulsePlay', sameAs: 'https://0xpulseplay.com' },
      { name: 'Astro', sameAs: 'https://astro.build/' },
    ],
  });
  assert.deepEqual(jsonLd['@graph'][0].about, [
    { '@type': 'Organization', name: 'PulsePlay', alternateName: '0xPulsePlay', sameAs: 'https://0xpulseplay.com' },
    { '@type': 'Thing', name: 'Astro', sameAs: 'https://astro.build/' },
  ]);
});

test('keywords: frontmatter keywords win, else tags, joined with ", "', () => {
  assert.equal(postKeywords({ tags: ['a', 'b'] }), 'a, b');
  assert.equal(postKeywords({ keywords: ['x', 'y'], tags: ['a'] }), 'x, y');
  assert.equal(postKeywords({ keywords: 'x y', tags: ['a'] }), 'x y');
  assert.equal(postKeywords({}), undefined);
});

test('og:image dimensions come from the PNG header; others give null', () => {
  assert.deepEqual(pngDimensions('static', '/img/og-default.png'), { width: 2400, height: 1260 });
  assert.equal(pngDimensions('static', 'https://example.com/x.png'), null);
  assert.equal(pngDimensions('static', '/img/claude-do-mark.svg'), null);
  assert.equal(pngDimensions('static', '/img/does-not-exist.png'), null);
});

test('tags must be a list of strings', () => {
  const base = { title: 't', slug: 's', date: '2026-01-02', description: 'd' };
  assert.equal(postSchema.safeParse({ ...base, tags: ['a', 'b'] }).success, true);
  assert.equal(postSchema.safeParse({ ...base, tags: 'a' }).success, false);
  assert.equal(postSchema.safeParse({ ...base, tags: [1] }).success, false);
});
