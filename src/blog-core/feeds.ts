import type { CollectionEntry } from 'astro:content';
import { rssDate, sortPosts } from './dates';
import { escapeHtml, escapeXml } from './escape';
import type { BrandConfig } from './types';

function quoteSlug(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function buildRss(brand: BrandConfig, entries: CollectionEntry<'posts'>[]): string {
  const items = sortPosts(entries)
    .map((post) => {
      const link = `${brand.url}/blog/${post.data.slug}/`;
      return `<item>
<title>${escapeHtml(post.data.title)}</title>
<link>${link}</link>
<guid>${link}</guid>
<pubDate>${rssDate(post.data.date)}</pubDate>
<description>${escapeHtml(post.data.description || '')}</description>
</item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${brand.name}</title>
<link>${brand.url}/</link>
<description>${escapeHtml(brand.description)}</description>
<language>en</language>
${items}
</channel></rss>
`;
}

export function buildSitemap(brand: BrandConfig, entries: CollectionEntry<'posts'>[]): string {
  const siteUrl = escapeXml(brand.url);
  const urls = [
    `  <url><loc>${siteUrl}/</loc></url>`,
    `  <url><loc>${siteUrl}/blog/</loc></url>`,
    ...sortPosts(entries).map((post) => {
      const slug = quoteSlug(post.data.slug);
      const loc = escapeXml(`${brand.url}/blog/${slug}/`);
      const lastmod = (post.data.updated || post.data.date).toISOString().slice(0, 10);
      return `  <url><loc>${loc}</loc><lastmod>${escapeXml(lastmod)}</lastmod></url>`;
    }),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}
