# Astro migration design and adoption path

This document records the WORLD-357/WORLD-201 migration plan implemented on
`feat/astro-migration`. WORLD-200's SEO/GEO behavior is a compatibility
contract, not an opportunity to redesign content or URLs.

## Legacy inventory

The legacy generator consumed `content/posts/*.md` with YAML frontmatter and a
Markdown body. Required fields were `title`, `slug`, `date`, `description`;
`author`, hero/OG fields, standfirst, and archive fields controlled visible
presentation. WORLD-200 added authored `updated`, `faq`, and `entities` fields
with validation.

It emitted:

- `/`, `/blog/`, `/blog/<slug>/`, and `/404.html`;
- `/rss.xml` and `/sitemap.xml`;
- static `styles`, `img`, `media`, and optional `assets` trees;
- description/canonical metadata, Open Graph, and Twitter cards on every HTML
  page;
- Article and BreadcrumbList JSON-LD on every post;
- optional FAQPage and `Article.about` JSON-LD, visible FAQ answers, and visible
  updated dates from authored frontmatter;
- authored `dateModified` and sitemap `lastmod` values.

Later on the live line (merged into `feat/astro-migration-catchup`):
`tags` chips and meta keywords, `keywords`, `section`, `article:*` Open Graph
tags, `og:image:width/height` read from PNG headers, entity `type` and
`alternateName` in `Article.about`, and the audio tour (per-section players,
`/assets/audio-tour.css` and `/assets/audio-tour.js`, opt-in by the presence of
`static/media/audio/<slug>/`).

The legacy site did not emit `llms.txt` or `robots.txt`. Both now exist in
`static/` on the live line, but `build.py` only copies `styles`, `img`, `media`
and `assets`, so they are not deployed. The Astro migration
does not invent either artifact because the output/URL contract is intentionally
unchanged.

## Astro mapping

Astro's content-layer glob loader reads the Markdown files from their existing
directory; no content move or rewrite is required. The shared schema preserves
the legacy frontmatter names and WORLD-200 validation, including ISO calendar
dates, `updated >= date`, FAQ question/answer strings, and entity name/authority
URL strings.

The output remains fully static and uses no client directives. `static/` is
Astro's `publicDir`, avoiding asset hashing or path churn. Custom RSS and sitemap
endpoints intentionally preserve the old URL and field semantics rather than
switching to a plugin's different defaults. The base layout centralizes all
head emissions, while the post route uses the shared JSON-LD builder.

Markdown parity: python-markdown and CommonMark disagree on a few inputs the
posts use. `src/blog-core/markdown.ts` closes each gap: raw HTML blocks that
start with a python-markdown block-level tag are kept whole until their closing
tag (inline SVGs with blank lines inside, `<video>` lines), a lone inline tag
between blank lines keeps its `<p>`, blank-separated `>` blocks merge into one
blockquote, heading ids use python-markdown's toc slugify and `_N` suffixes,
`--`/`---` become en/em dashes, table alignment is an inline style, and code
blocks are left unhighlighted. One known difference remains and is accepted:
in `the-plane-fights-back` python-markdown drops the `**bold**` nested inside
the opening italic paragraph, and Astro renders it as written.

The comparison gate treats formatting-only HTML serialization differences as
acceptable, but parses and compares titles, meta fields, canonical/RSS links,
JSON-LD, sitemap entries, RSS entries, visible article and whole-page text,
every src/href/poster/id/class/style/alt/title/data-* attribute in document
order, and static bytes. The ordered element sequence is reported but not
gated.
Missing or newly invented paths also fail so the serving contract stays exact.

## Deployment and rollback boundary

Caddy receives the public tunnel request on local port 18080 and serves the
apex from `/home/claude/sites/www`; `www.claude.do` redirects to the apex. There
is no site-specific runtime service. This branch only produces `dist/` and does
not sync it, edit Caddy/cloudflared, or restart anything. Cutover is a separate
Director-reviewed operation. The existing live directory remains the rollback
artifact until that review.

## Multi-brand adoption path

Only claude.do is migrated here. A sibling adopts the core in a separate,
reviewed change:

1. Extract or workspace-link `src/blog-core/` as an internal package once a
   second real blog consumer exists. Keeping it local tonight avoids publishing
   a one-consumer package prematurely, while its imports and brand-neutral types
   already define the package boundary.
2. Supply a sibling `BrandConfig` containing canonical origin, publisher/logo,
   social defaults, wordmark, navigation, and footer links.
3. Keep that brand's content in its repository and point a collection loader at
   it. Map legacy frontmatter at the loader/config edge; do not rewrite posts to
   fit a theme.
4. Reuse the shared base head, Article/FAQ/Breadcrumb JSON-LD builder, date/order
   helpers, RSS builder, and sitemap builder. Provide brand-owned page copy,
   CSS, and public assets.
5. Add a legacy-vs-Astro report using this repository's comparison script and
   require zero lost URLs or SEO/GEO emissions before any serving cutover.

`chaintail-brand` currently builds template-driven agency/brandbook pages rather
than a blog, so its appropriate increment is adoption when its blog content
exists—not replacing unrelated pages tonight. `claude-do-fable-theme` is a
sibling worktree/theme line of this same site; it can port its CSS and brand
config onto the core after this migration lands, with its own output comparison.
