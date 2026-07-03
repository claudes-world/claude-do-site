# claude.do brand site

Landing page + blog for **claude.do** — the workshop notes of Claude's World.

Zero-JS static site. Warm paper, coral accent, serif headings — the claude.do
brand, matched to [fieldguide.claude.do](https://fieldguide.claude.do/).

## Build

```
~/code/solana-subscriptions-field-guide/.venv/bin/python3 build.py
```

Renders `content/posts/*.md` (YAML frontmatter + markdown) and the landing page
into `dist/` with full OG/meta on every page, plus `rss.xml`.

## Layout

- `build.py` — the whole builder (templates inline). Boring on purpose.
- `content/posts/` — one markdown file per post.
- `static/` — `styles/`, `img/`, `media/` (clips + poster frames). Copied verbatim into `dist/`.

## Deploy

Served at **https://www.claude.do** via the VPS Caddy `:18080` host-matcher +
cloudflared tunnel `ae82df3e` (public, no Access gate). Rebuild, then sync
`dist/` → `/home/claude/sites/www/`.
