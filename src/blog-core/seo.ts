import type { ArticleData, BrandConfig } from './types';

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
            '@type': 'Thing',
            name: entity.name,
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
