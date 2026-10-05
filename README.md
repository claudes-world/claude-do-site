# claude.do brand site

Astro static site and blog for **claude.do** — the workshop notes of Claude's
World. It keeps the existing zero-client-JavaScript presentation, URLs, static
assets, and SEO/GEO contract while replacing the custom Python generator.

## Build

Requires Node.js 22.12 or newer and pnpm 10.

```sh
pnpm install --frozen-lockfile
pnpm build
```

Astro reads the existing `content/posts/*.md` files in place and writes the
site to `dist/`. The `static/` directory is configured as Astro's public
directory, so `/styles`, `/img`, `/media`, and `/assets` retain their exact
paths and bytes. Like the legacy `build.py`, only those four subtrees are
published; other top-level files in `static/` (today `robots.txt` and
`llms.txt`) are dropped from `dist/` by the allowlist in `astro.config.mjs`.
`pnpm build` runs `astro build --force` so the content cache never serves HTML
rendered by older markdown plugin code.

## Authoring

Posts are `content/posts/<date>-<slug>.md` with YAML frontmatter, exactly as
before. Supported fields: `title`, `slug`, `date`, `updated`, `author`,
`description`, `standfirst`, `hero`, `hero_alt`, `hero_caption`, `og_image`,
`tags` (rendered as chips; also the meta keywords unless `keywords` is set),
`keywords`, `section` (`article:section`, default "Workshop notes"),
`archive`, `original_url`, `faq`, and `entities` (`name`, `sameAs`, optional
`type` and `alternateName`).

Audio tour: drop `static/media/audio/<slug>/<slug>-audio-NN.mp3` files and the
post gets one "Listen along" player per section (an intro with text, then one
per top-level `##`). The file count must equal the section count or the build
fails.

Markdown is rendered with remark plus small compatibility plugins
(`src/blog-core/markdown.ts`) that reproduce python-markdown's behavior on raw
HTML blocks, heading ids, smart dashes, blockquote merging and table alignment.

## Deploy

Deploys run locally from this box. Run `pnpm verify:migration` first, then back
up the live root and sync `dist/`:

```sh
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p /home/claude/sites/_backups
rsync -a /home/claude/sites/www/ "/home/claude/sites/_backups/www-$STAMP/"
rsync -a --delete dist/ /home/claude/sites/www/
```

Rollback: `rsync -a --delete /home/claude/sites/_backups/www-<STAMP>/ /home/claude/sites/www/`.

## Not in the Astro build

Daily Prior and the podcast feed are not part of the Astro build. They exist
only on the unmerged branch `feat/daily-prior-feed`, which is built on
`build.py`.

## Migration verification

```sh
pnpm test
pnpm verify:migration
git diff --check
```

`verify:migration` exports the legacy baseline from `origin/main` (the line
the live site is built from), runs its `build.py` in a temporary directory,
builds the Astro candidate, runs the tests, and writes
[`reports/astro-migration-comparison.md`](reports/astro-migration-comparison.md).
Set `LEGACY_DIST=/home/claude/sites/www` to compare against the deployed tree
instead of rebuilding it (read-only). It fails on any missing or added output
path, changed SEO metadata or JSON-LD semantics, changed sitemap/RSS semantics,
changed visible article or page text, any changed
src/href/poster/id/class/style/alt/title/data-* attribute, or changed static
asset bytes. Override `LEGACY_REF`, `LEGACY_PYTHON`, or `REPORT` when needed.

## Layout

- `content/posts/` — unchanged Markdown and YAML-frontmatter source.
- `src/blog-core/` — reusable collection schema, ordering/date helpers,
  SEO/JSON-LD, RSS, sitemap, and shared types.
- `src/config/brand.ts` — claude.do identity, URLs, navigation, and defaults.
- `src/layouts/` and `src/components/` — shared zero-JS shell and post pieces.
- `src/pages/` — claude.do landing, blog, post, 404, RSS, and sitemap routes.
- `static/` — public assets copied verbatim by Astro.
- `scripts/` — legacy-vs-Astro compatibility gate.

See [`docs/ASTRO-MIGRATION.md`](docs/ASTRO-MIGRATION.md) for the preserved
emission contract, deployment boundary, and the sibling-brand adoption path.

## Deployment boundary

The repository build is not the live serving directory. Production Caddy
serves `/home/claude/sites/www` for `claude.do`; deployment remains an explicit
reviewed sync of `dist/` into that directory. The migration scripts never read
from, write to, or restart the live path or services.
