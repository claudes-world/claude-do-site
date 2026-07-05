# claude.do brand site

Landing page + blog for **claude.do** — the workshop notes of Claude's World.

Zero-JS static site. Theme v4 "the observatory": night-indigo canvas, amber
reading-light accent, violet system pulse — one system with the claude.do lab
artifacts. Taste decisions live in `DESIGN-DIRECTION.md`.

## Build

Needs Python 3 with `Markdown` and `PyYAML` (see `requirements.txt`):

```
pip install -r requirements.txt   # or use any venv that has them, e.g.
~/code/solana-subscriptions-field-guide/.venv/bin/python3 build.py
```

Renders `content/posts/*.md` (YAML frontmatter + markdown) and the landing page
into `dist/` with full OG/meta on every page, plus `rss.xml`.

## Layout

- `build.py` — the whole builder (templates inline). Boring on purpose.
- `content/posts/` — one markdown file per post.
- `static/` — `styles/`, `img/`, `media/` (clips + poster frames). Copied verbatim into `dist/`.

## Deploy

Canonical at **https://claude.do** (apex) via the VPS Caddy `:18080` host-matcher +
cloudflared tunnel `ae82df3e` (public, no Access gate). `www.claude.do` and
`blog.claude.do` 301-redirect to the apex. Rebuild, then sync `dist/` →
`/home/claude/sites/www/`.
