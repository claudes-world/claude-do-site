#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

function parseArgs(argv) {
  const args = {
    old: '.migration-artifacts/legacy-dist',
    new: 'dist',
    report: 'reports/astro-migration-comparison.md',
    baseline: 'main',
  };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, '');
    if (!key || !(key in args) || argv[index + 1] === undefined) {
      throw new Error(`Usage: compare-builds.mjs [--old DIR] [--new DIR] [--report FILE] [--baseline REF]`);
    }
    args[key] = argv[index + 1];
  }
  return args;
}

async function filesUnder(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(relative(root, path).split(sep).join('/'));
    }
  }
  await walk(root);
  return files.sort();
}

function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lsquo;/g, '‘')
    .replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function parseAttributes(tag) {
  const attributes = {};
  const pattern = /([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4]);
  }
  return attributes;
}

function htmlSeo(html) {
  const title = decodeEntities(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const meta = {};
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    const key = attributes.name || attributes.property;
    if (key && attributes.content !== undefined) meta[key] = attributes.content;
  }
  const links = {};
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    if (attributes.rel === 'canonical') links.canonical = attributes.href;
    if (attributes.rel === 'alternate' && attributes.type === 'application/rss+xml') {
      links.rss = attributes.href;
      links.rssTitle = attributes.title;
    }
  }
  return { title, meta, links };
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function jsonLd(html) {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => stable(JSON.parse(match[1])))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function articleText(html) {
  const article = html.match(/<article\b[^>]*class=["'][^"']*\bprose\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/i)?.[1];
  if (article === undefined) return null;
  return decodeEntities(
    article
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
}

function sitemap(xml) {
  return [...xml.matchAll(/<url>\s*<loc>([\s\S]*?)<\/loc>(?:\s*<lastmod>([\s\S]*?)<\/lastmod>)?\s*<\/url>/g)]
    .map((match) => ({ loc: decodeEntities(match[1]), ...(match[2] ? { lastmod: decodeEntities(match[2]) } : {}) }))
    .sort((left, right) => left.loc.localeCompare(right.loc));
}

function rss(xml) {
  const channel = xml.match(/<channel>([\s\S]*?)<item>/)?.[1] ?? xml.match(/<channel>([\s\S]*?)<\/channel>/)?.[1] ?? '';
  const tag = (source, name) => decodeEntities(source.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`))?.[1] ?? '');
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => ({
    title: tag(match[1], 'title'),
    link: tag(match[1], 'link'),
    guid: tag(match[1], 'guid'),
    pubDate: tag(match[1], 'pubDate'),
    description: tag(match[1], 'description'),
  }));
  return {
    title: tag(channel, 'title'),
    link: tag(channel, 'link'),
    description: tag(channel, 'description'),
    language: tag(channel, 'language'),
    items,
  };
}

function hash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function equal(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function textDifference(path, oldValue, newValue) {
  let index = 0;
  while (oldValue[index] === newValue[index] && index < oldValue.length && index < newValue.length) index += 1;
  const start = Math.max(0, index - 80);
  const end = index + 160;
  return {
    path,
    oldExcerpt: oldValue.slice(start, end),
    newExcerpt: newValue.slice(start, end),
  };
}

function asList(values, empty = 'None.') {
  return values.length ? values.map((value) => `- \`${value}\``).join('\n') : empty;
}

function jsonDetails(details) {
  if (!details.length) return 'None.';
  return details.map(({ path, oldValue, newValue }) =>
    `#### \`${path}\`\n\nOld:\n\n\`\`\`json\n${JSON.stringify(oldValue, null, 2)}\n\`\`\`\n\nNew:\n\n\`\`\`json\n${JSON.stringify(newValue, null, 2)}\n\`\`\``
  ).join('\n\n');
}

const args = parseArgs(process.argv.slice(2));
const oldRoot = resolve(args.old);
const newRoot = resolve(args.new);
const reportPath = resolve(args.report);
const [oldFiles, newFiles] = await Promise.all([filesUnder(oldRoot), filesUnder(newRoot)]);
const oldSet = new Set(oldFiles);
const newSet = new Set(newFiles);
const missing = oldFiles.filter((path) => !newSet.has(path));
const added = newFiles.filter((path) => !oldSet.has(path));
const common = oldFiles.filter((path) => newSet.has(path));

const seoChanges = [];
const jsonLdChanges = [];
const articleTextChanges = [];
const assetChanges = [];
const sizeChanges = [];

for (const path of common) {
  const [oldBuffer, newBuffer] = await Promise.all([
    readFile(resolve(oldRoot, path)),
    readFile(resolve(newRoot, path)),
  ]);
  if (oldBuffer.length !== newBuffer.length) {
    sizeChanges.push({ path, oldSize: oldBuffer.length, newSize: newBuffer.length, delta: newBuffer.length - oldBuffer.length });
  }
  if (path.endsWith('.html')) {
    const oldHtml = oldBuffer.toString('utf8');
    const newHtml = newBuffer.toString('utf8');
    const oldSeo = htmlSeo(oldHtml);
    const newSeo = htmlSeo(newHtml);
    if (!equal(oldSeo, newSeo)) seoChanges.push({ path, oldValue: oldSeo, newValue: newSeo });
    const oldJsonLd = jsonLd(oldHtml);
    const newJsonLd = jsonLd(newHtml);
    if (!equal(oldJsonLd, newJsonLd)) jsonLdChanges.push({ path, oldValue: oldJsonLd, newValue: newJsonLd });
    const oldArticle = articleText(oldHtml);
    const newArticle = articleText(newHtml);
    if (oldArticle !== newArticle) articleTextChanges.push(textDifference(path, oldArticle ?? '', newArticle ?? ''));
  } else if (!path.endsWith('.xml') && hash(oldBuffer) !== hash(newBuffer)) {
    assetChanges.push(path);
  }
}

const oldSitemap = sitemap(await readFile(resolve(oldRoot, 'sitemap.xml'), 'utf8'));
const newSitemap = sitemap(await readFile(resolve(newRoot, 'sitemap.xml'), 'utf8'));
const sitemapChanged = !equal(oldSitemap, newSitemap);
const oldRss = rss(await readFile(resolve(oldRoot, 'rss.xml'), 'utf8'));
const newRss = rss(await readFile(resolve(newRoot, 'rss.xml'), 'utf8'));
const rssChanged = !equal(oldRss, newRss);

const oldBytes = (await Promise.all(oldFiles.map((path) => stat(resolve(oldRoot, path))))).reduce((sum, item) => sum + item.size, 0);
const newBytes = (await Promise.all(newFiles.map((path) => stat(resolve(newRoot, path))))).reduce((sum, item) => sum + item.size, 0);
const failures = [
  missing.length > 0,
  added.length > 0,
  seoChanges.length > 0,
  jsonLdChanges.length > 0,
  articleTextChanges.length > 0,
  assetChanges.length > 0,
  sitemapChanged,
  rssChanged,
].filter(Boolean).length;
const status = failures === 0 ? 'PASS' : 'FAIL';
const sizeRows = sizeChanges
  .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
  .map(({ path, oldSize, newSize, delta }) => `| \`${path}\` | ${oldSize} | ${newSize} | ${delta >= 0 ? '+' : ''}${delta} |`)
  .join('\n');

const report = `# Astro migration comparison

Status: **${status}**

Baseline: \`${args.baseline}\` (legacy \`build.py\`)
Candidate: Astro static build

## Gate summary

| Gate | Result | Detail |
| --- | --- | --- |
| Output/URL set | ${missing.length === 0 && added.length === 0 ? 'PASS' : 'FAIL'} | ${oldFiles.length} legacy files; ${newFiles.length} Astro files; ${missing.length} missing; ${added.length} added |
| HTML title/meta/canonical/RSS link | ${seoChanges.length === 0 ? 'PASS' : 'FAIL'} | ${seoChanges.length} pages changed |
| JSON-LD semantics | ${jsonLdChanges.length === 0 ? 'PASS' : 'FAIL'} | ${jsonLdChanges.length} pages changed |
| Sitemap semantics | ${sitemapChanged ? 'FAIL' : 'PASS'} | ${oldSitemap.length} legacy URLs; ${newSitemap.length} Astro URLs |
| RSS semantics | ${rssChanged ? 'FAIL' : 'PASS'} | ${oldRss.items.length} legacy items; ${newRss.items.length} Astro items |
| Visible article text | ${articleTextChanges.length === 0 ? 'PASS' : 'FAIL'} | ${articleTextChanges.length} posts changed after whitespace normalization |
| Static asset bytes | ${assetChanges.length === 0 ? 'PASS' : 'FAIL'} | ${assetChanges.length} common non-HTML/XML files changed |

The URL gate compares every emitted file path, including HTML routes, feeds, CSS, images, and media. HTML formatting may differ; SEO fields and parsed structured data must not. JSON object key order is ignored, while graph/FAQ/breadcrumb array order remains significant.

## URL set diff

### Missing from Astro

${asList(missing)}

### Added by Astro

${asList(added)}

## SEO/meta changes

${jsonDetails(seoChanges)}

## JSON-LD changes

${jsonDetails(jsonLdChanges)}

## Sitemap comparison

${sitemapChanged ? jsonDetails([{ path: 'sitemap.xml', oldValue: oldSitemap, newValue: newSitemap }]) : 'Semantically identical.'}

## RSS comparison

${rssChanged ? jsonDetails([{ path: 'rss.xml', oldValue: oldRss, newValue: newRss }]) : 'Semantically identical.'}

## Visible article-text changes

${articleTextChanges.length ? articleTextChanges.map(({ path, oldExcerpt, newExcerpt }) => `- \`${path}\`\n  - Legacy: \`${oldExcerpt}\`\n  - Astro: \`${newExcerpt}\``).join('\n') : 'None.'}

## Static asset byte changes

${asList(assetChanges)}

## Size deltas

Legacy total: ${oldBytes} bytes
Astro total: ${newBytes} bytes
Delta: ${newBytes - oldBytes >= 0 ? '+' : ''}${newBytes - oldBytes} bytes

| Path | Legacy bytes | Astro bytes | Delta |
| --- | ---: | ---: | ---: |
${sizeRows || '| No size changes | — | — | 0 |'}
`;

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, report, 'utf8');
console.log(`${status}: wrote ${reportPath}`);
if (failures > 0) process.exitCode = 1;
