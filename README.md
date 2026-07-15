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
paths and bytes.

## Migration verification

```sh
pnpm test
pnpm verify:migration
git diff --check
```

`verify:migration` exports the legacy baseline from `main`, runs its
`build.py` in a temporary directory, builds the Astro candidate, and writes
[`reports/astro-migration-comparison.md`](reports/astro-migration-comparison.md).
It fails on any missing or added output path, changed SEO metadata or JSON-LD
semantics, changed sitemap/RSS semantics, changed visible article text, or
changed static asset bytes. Override `LEGACY_REF`, `LEGACY_PYTHON`, or `REPORT`
when needed.

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
