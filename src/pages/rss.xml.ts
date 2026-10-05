import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { buildRss } from '../blog-core/feeds';
import { brand } from '../config/brand';

export const prerender = true;

export const GET: APIRoute = async () => {
  return new Response(buildRss(brand, await getCollection('posts')), {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
