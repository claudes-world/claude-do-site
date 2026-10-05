import type { CollectionEntry } from 'astro:content';

export function humanDate(value: Date): string {
  return value.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function rssDate(value: Date): string {
  const day = value.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const month = value.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const date = String(value.getUTCDate()).padStart(2, '0');
  return `${day}, ${date} ${month} ${value.getUTCFullYear()} 00:00:00 +0000`;
}

export function sortPosts(posts: CollectionEntry<'posts'>[]): CollectionEntry<'posts'>[] {
  return [...posts].sort((left, right) => {
    // Legacy order: newest first; posts sharing a date keep source-filename order.
    const byDate = right.data.date.getTime() - left.data.date.getTime();
    const leftKey = left.filePath ?? left.id;
    const rightKey = right.filePath ?? right.id;
    return byDate || (leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0);
  });
}
