import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { buildSitemap } from '../blog-core/feeds';
import { brand } from '../config/brand';

export const prerender = true;

export const GET: APIRoute = async () => {
  return new Response(buildSitemap(brand, await getCollection('posts')), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
