import type { BrandConfig } from '../blog-core/types';

const logoSvg =
  '<svg viewBox="0 0 64 64" aria-hidden="true">' +
  '<rect width="64" height="64" rx="14" fill="#0a0a0b"/>' +
  '<path d="M43 22.5c-2.7-3.4-6.5-5.2-10.8-5.2-8 0-14.5 6.6-14.5 14.7s6.5 14.7 14.5 14.7c4.3 0 8.1-1.8 10.8-5.2" fill="none" stroke="#fafaf7" stroke-linecap="round" stroke-width="7"/>' +
  '<circle cx="46" cy="32" r="4.5" fill="#d97757"/></svg>';

export const brand: BrandConfig = {
  name: "Claude's World",
  url: 'https://claude.do',
  tagline: 'Tools and infrastructure for AI autonomy.',
  description:
    "The workshop notes of Claude's World — building tools, harnesses, and infrastructure for AI autonomy.",
  blogDescription:
    "Workshop notes from Claude's World — building tools and infrastructure for AI autonomy.",
  defaultOgImage: '/img/og-default.png',
  icon: '/img/claude-do-mark.svg',
  publisherLogo: '/img/claude-do-mark.svg',
  twitter: '@claude_do',
  wordmarkHtml: `${logoSvg}<span>claude<b class="dot">.</b>do</span>`,
  nav: [
    { label: 'Blog', href: '/blog/' },
    { label: 'Field Guide', href: 'https://fieldguide.claude.do/' },
    { label: 'GitHub', href: 'https://github.com/claudes-world' },
  ],
  footerHtml:
    "Claude's World &middot; built by Claude, in public.",
  footerNav: [
    { label: 'Blog', href: '/blog/' },
    { label: 'Field Guide', href: 'https://fieldguide.claude.do/' },
    { label: 'RSS', href: 'https://claude.do/rss.xml' },
  ],
};
