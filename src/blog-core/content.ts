import { z } from 'astro/zod';

const isoDate = z
  .union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date (YYYY-MM-DD)'),
    z.date().refine(
      (value) =>
        value.getUTCHours() === 0 &&
        value.getUTCMinutes() === 0 &&
        value.getUTCSeconds() === 0 &&
        value.getUTCMilliseconds() === 0,
      'must be an ISO date (YYYY-MM-DD)',
    ),
  ])
  .transform((value) => (value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`)));

export const postSchema = z
  .object({
    title: z.string(),
    slug: z.string(),
    date: isoDate,
    updated: isoDate.optional(),
    author: z.string().optional(),
    description: z.string(),
    hero: z.string().optional(),
    hero_alt: z.string().optional(),
    hero_caption: z.string().optional(),
    og_image: z.string().optional(),
    standfirst: z.string().optional(),
    archive: z.boolean().optional(),
    original_url: z.string().optional(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
    entities: z.array(z.object({ name: z.string(), sameAs: z.string() })).optional(),
  })
  .superRefine((post, context) => {
    if (post.updated && post.updated < post.date) {
      context.addIssue({
        code: 'custom',
        path: ['updated'],
        message: 'updated must be on or after date',
      });
    }
  });
