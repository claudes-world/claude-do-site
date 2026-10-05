import { closeSync, openSync, readSync } from 'node:fs';
import { join } from 'node:path';
import type { ArticleData, BrandConfig } from './types';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Width/height from a local static PNG's IHDR chunk, for og:image:width and
 * og:image:height. Remote URLs, non-PNGs and unreadable files give null.
 */
export function pngDimensions(staticDir: string, imagePath: string): { width: number; height: number } | null {
  if (imagePath.startsWith('http')) return null;
  const header = Buffer.alloc(24);
  let read = 0;
  try {
    const fd = openSync(join(staticDir, imagePath.replace(/^\/+/, '')), 'r');
    try {
      read = readSync(fd, header, 0, 24, 0);
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
  if (read < 24 || !header.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

/** The meta keywords string: frontmatter `keywords`, else `tags`, joined with ", ". */
export function postKeywords(post: Pick<ArticleData, 'keywords' | 'tags'>): string | undefined {
  const value = post.keywords && post.keywords.length ? post.keywords : post.tags;
  if (!value || !value.length) return undefined;
  return Array.isArray(value) ? value.join(', ') : value;
}

export function absoluteUrl(brand: BrandConfig, path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${brand.url}/${path.replace(/^\/+/, '')}`;
}

export function postCanonical(brand: BrandConfig, slug: string): string {
  return `${brand.url}/blog/${slug}/`;
}

export function buildArticleJsonLd(brand: BrandConfig, post: ArticleData) {
  const canonical = postCanonical(brand, post.slug);
  const image = post.hero || post.og_image;
  const article = {
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date.toISOString().slice(0, 10),
    dateModified: (post.updated || post.date).toISOString().slice(0, 10),
    author: { '@type': 'Person', name: post.author || 'Claude' },
    publisher: {
      '@type': 'Organization',
      name: brand.name,
      url: brand.url,
      logo: { '@type': 'ImageObject', url: absoluteUrl(brand, brand.publisherLogo) },
    },
    mainEntityOfPage: canonical,
    ...(image ? { image: absoluteUrl(brand, image) } : {}),
    ...(post.entities?.length
      ? {
          about: post.entities.map((entity) => ({
            '@type': entity.type || 'Thing',
            name: entity.name,
            ...(entity.alternateName ? { alternateName: entity.alternateName } : {}),
            sameAs: entity.sameAs,
          })),
        }
      : {}),
  };
  const breadcrumbs = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${brand.url}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${brand.url}/blog/` },
      { '@type': 'ListItem', position: 3, name: post.title, item: canonical },
    ],
  };
  const faq = post.faq?.length
    ? {
        '@type': 'FAQPage',
        mainEntity: post.faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      }
    : null;

  return {
    '@context': 'https://schema.org',
    '@graph': [article, breadcrumbs, ...(faq ? [faq] : [])],
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('&', '\\u0026')
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e');
}
