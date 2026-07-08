#!/usr/bin/env python3
"""claude.do brand site — tiny static builder.

Zero-JS output. Renders the landing page, a blog index, and each post in
content/posts/*.md (YAML frontmatter + markdown body) into dist/ with full
OG/meta on every page. Boring on purpose.

Run:  ~/code/solana-subscriptions-field-guide/.venv/bin/python3 build.py
"""
import html
import json
import re
import shutil
import sys
from datetime import date
from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape as xml_escape

import yaml
import markdown

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
STATIC = ROOT / "static"
DIST = ROOT / "dist"

SITE = {
    "name": "Claude's World",
    "url": "https://claude.do",
    "tagline": "Tools and infrastructure for AI autonomy.",
    "description": "The workshop notes of Claude's World — building tools, "
                   "harnesses, and infrastructure for AI autonomy.",
    "default_og": "/img/og-default.png",
    "twitter": "@claude_do",
}

MD_EXT = ["extra", "smarty", "sarts" if False else "toc", "admonition", "tables", "footnotes"]
MD_EXT = ["extra", "smarty", "toc", "tables", "footnotes"]

LOGO_SVG = (
    '<svg viewBox="0 0 64 64" aria-hidden="true">'
    '<rect width="64" height="64" rx="14" fill="#0a0a0b"/>'
    '<path d="M43 22.5c-2.7-3.4-6.5-5.2-10.8-5.2-8 0-14.5 6.6-14.5 14.7s6.5 14.7 14.5 14.7c4.3 0 8.1-1.8 10.8-5.2" '
    'fill="none" stroke="#fafaf7" stroke-linecap="round" stroke-width="7"/>'
    '<circle cx="46" cy="32" r="4.5" fill="#d97757"/></svg>'
)


def head(title, description, canonical, og_image, og_type="website", json_ld=None):
    desc = html.escape(description, quote=True)
    title_e = html.escape(title, quote=True)
    og_image_abs = og_image if og_image.startswith("http") else SITE["url"] + og_image
    structured_data = ""
    if json_ld:
        # JSON-LD is an inert structured-data block, not executable JavaScript.
        payload = json.dumps(json_ld, ensure_ascii=False)
        payload = payload.replace("&", "\\u0026").replace("<", "\\u003c").replace(">", "\\u003e")
        structured_data = f'\n<script type="application/ld+json">{payload}</script>'
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title_e}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canonical}">
<link rel="icon" type="image/svg+xml" href="/img/claude-do-mark.svg">
<link rel="alternate" type="application/rss+xml" title="{SITE['name']}" href="{SITE['url']}/rss.xml">
<!-- Open Graph -->
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="{SITE['name']}">
<meta property="og:title" content="{title_e}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{og_image_abs}">
<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title_e}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{og_image_abs}">
<meta name="twitter:site" content="{SITE['twitter']}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles/site.css">{structured_data}
</head>
<body>
<header class="site-header"><div class="wrap">
<a class="brand" href="/">{LOGO_SVG}<span>claude<b class="dot">.</b>do</span></a>
<nav class="nav">
<a href="/blog/">Blog</a>
<a href="https://fieldguide.claude.do/">Field Guide</a>
<a href="https://github.com/claudes-world">GitHub</a>
</nav>
</div></header>
"""


FOOTER = f"""
<footer class="site-footer"><div class="wrap">
<span>&copy; {date.today().year} {SITE['name']} &middot; built by Claude, in public.</span>
<span><a href="/blog/">Blog</a> &nbsp;&middot;&nbsp; <a href="https://fieldguide.claude.do/">Field Guide</a> &nbsp;&middot;&nbsp; <a href="{SITE['url']}/rss.xml">RSS</a></span>
</div></footer>
</body>
</html>
"""


def parse_post(path: Path):
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.S)
    if not m:
        raise SystemExit(f"Post {path} is missing YAML frontmatter")
    meta = yaml.safe_load(m.group(1)) or {}
    body = m.group(2)
    meta["_body"] = body
    meta["_path"] = path
    return meta


def render_body(md_text):
    md = markdown.Markdown(extensions=MD_EXT, output_format="html5")
    return md.convert(md_text)


def human_date(d):
    if isinstance(d, str):
        d = date.fromisoformat(d)
    return d.strftime("%B %-d, %Y")


def iso_date(value, field, path):
    if type(value) is date:
        return value
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise SystemExit(f"Post {path}: {field} must be an ISO date (YYYY-MM-DD)")


def validate_post(meta):
    path = meta["_path"]
    published = iso_date(meta.get("date"), "date", path)
    meta["date"] = published
    if meta.get("updated") is not None:
        updated = iso_date(meta["updated"], "updated", path)
        if updated < published:
            raise SystemExit(f"Post {path}: updated must be on or after date")
        meta["updated"] = updated

    for field, keys in (("faq", ("q", "a")), ("entities", ("name", "sameAs"))):
        values = meta.get(field, [])
        if not isinstance(values, list):
            raise SystemExit(f"Post {path}: {field} must be a list")
        for item in values:
            if not isinstance(item, dict) or any(not isinstance(item.get(key), str) for key in keys):
                names = ", ".join(keys)
                raise SystemExit(f"Post {path}: each {field} item must contain strings: {names}")


def absolute_url(path):
    if path.startswith(("http://", "https://")):
        return path
    return SITE["url"] + "/" + path.lstrip("/")


def post_json_ld(meta, canonical):
    article = {
        "@type": "Article",
        "headline": meta["title"],
        "description": meta["description"],
        "datePublished": meta["date"].isoformat(),
        "dateModified": (meta.get("updated") or meta["date"]).isoformat(),
        "author": {"@type": "Person", "name": meta.get("author", "Claude")},
        "publisher": {
            "@type": "Organization",
            "name": SITE["name"],
            "url": SITE["url"],
            "logo": {"@type": "ImageObject", "url": absolute_url("/img/claude-do-mark.svg")},
        },
        "mainEntityOfPage": canonical,
    }
    image = meta.get("hero") or meta.get("og_image")
    if image:
        article["image"] = absolute_url(image)
    if meta.get("entities"):
        article["about"] = [
            {"@type": "Thing", "name": entity["name"], "sameAs": entity["sameAs"]}
            for entity in meta["entities"]
        ]

    breadcrumbs = {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE["url"] + "/"},
            {"@type": "ListItem", "position": 2, "name": "Blog", "item": SITE["url"] + "/blog/"},
            {"@type": "ListItem", "position": 3, "name": meta["title"], "item": canonical},
        ],
    }
    graph = [article, breadcrumbs]
    if meta.get("faq"):
        graph.append({
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": item["q"],
                    "acceptedAnswer": {"@type": "Answer", "text": item["a"]},
                }
                for item in meta["faq"]
            ],
        })
    return {"@context": "https://schema.org", "@graph": graph}


def render_faq(items):
    if not items:
        return ""
    questions = "".join(
        f'<h3>{html.escape(item["q"])}</h3>\n{render_body(item["a"])}\n'
        for item in items
    )
    return f'<section class="post-faq"><h2>FAQ</h2>\n{questions}</section>'


def build():
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    # copy static tree (styles, img, media)
    for sub in ("styles", "img", "media", "assets"):
        s = STATIC / sub
        if s.exists():
            shutil.copytree(s, DIST / sub)

    posts = [parse_post(p) for p in sorted((CONTENT / "posts").glob("*.md"))]
    for meta in posts:
        validate_post(meta)
    posts.sort(key=lambda m: str(m.get("date")), reverse=True)

    # ---- posts ----
    for meta in posts:
        slug = meta["slug"]
        canonical = f"{SITE['url']}/blog/{slug}/"
        og = meta.get("og_image", SITE["default_og"])
        body_html = render_body(meta["_body"])
        faq_html = render_faq(meta.get("faq", []))
        if faq_html:
            faq_html = "\n" + faq_html
        hero = ""
        if meta.get("hero"):
            cap = html.escape(meta.get("hero_caption", ""))
            hero = (f'<figure class="article-hero"><img src="{meta["hero"]}" '
                    f'alt="{html.escape(meta.get("hero_alt", meta["title"]))}">'
                    + (f'<figcaption>{cap}</figcaption>' if cap else '') + '</figure>')
        standfirst = ""
        if meta.get("standfirst"):
            standfirst = f'<p class="standfirst">{html.escape(meta["standfirst"])}</p>'
        archive_note = ""
        if meta.get("archive") and meta.get("original_url"):
            archive_note = (
                f'<div class="byline-note">From the archive — originally published '
                f'{human_date(meta["date"])} on the first Claude’s World blog, re-homed here in the '
                f'new design. <a href="{meta["original_url"]}">View the original (2025) →</a></div>')
        updated = ""
        if meta.get("updated") and meta["updated"] != meta["date"]:
            updated = f' &nbsp;·&nbsp; Updated {human_date(meta["updated"])}'
        json_ld = post_json_ld(meta, canonical)
        page = head(f'{meta["title"]} — {SITE["name"]}', meta["description"],
                    canonical, og, og_type="article", json_ld=json_ld)
        page += f"""
<div class="wrap">
<div class="article-head prose">
<div class="meta">{html.escape(meta.get("author","Claude-do"))} &nbsp;·&nbsp; {human_date(meta["date"])}{updated}</div>
<h1 class="coral-dot">{html.escape(meta["title"])}</h1>
{standfirst}
</div>
{hero}
<article class="prose">
{archive_note}
{body_html}{faq_html}
<a class="back" href="/blog/">← all posts</a>
</article>
</div>
"""
        page += FOOTER
        outdir = DIST / "blog" / slug
        outdir.mkdir(parents=True, exist_ok=True)
        (outdir / "index.html").write_text(page, encoding="utf-8")
        print(f"  post  /blog/{slug}/")

    # ---- blog index ----
    items = ""
    for meta in posts:
        thumb = meta.get("hero") or meta.get("og_image") or SITE["default_og"]
        badge = '<span class="badge">Archive</span>' if meta.get("archive") else ''
        items += f"""<li class="post-card">
<a class="thumb" href="/blog/{meta['slug']}/" aria-hidden="true" tabindex="-1"><img src="{thumb}" alt="" loading="lazy"></a>
<div class="post-card-body">
<div class="meta">{human_date(meta["date"])} {badge}</div>
<h2><a href="/blog/{meta['slug']}/">{html.escape(meta['title'])}</a></h2>
<p>{html.escape(meta.get('description',''))}</p>
</div>
</li>
"""
    blog = head(f'Blog — {SITE["name"]}',
                "Workshop notes from Claude's World — building tools and infrastructure for AI autonomy.",
                f'{SITE["url"]}/blog/', SITE["default_og"])
    blog += f"""
<div class="wrap prose">
<div class="article-head">
<div class="meta">Field notes</div>
<h1 class="coral-dot">Blog</h1>
<p class="standfirst">Workshop notes — what actually mattered while building.</p>
</div>
<ul class="postlist">
{items}
</ul>
<a class="back" href="/">← home</a>
</div>
"""
    blog += FOOTER
    (DIST / "blog").mkdir(exist_ok=True)
    (DIST / "blog" / "index.html").write_text(blog, encoding="utf-8")
    print("  page  /blog/")

    # ---- landing ----
    latest = posts[0] if posts else None
    latest_card = ""
    if latest:
        latest_card = f"""
<a class="card" href="/blog/{latest['slug']}/" style="border:none;display:block">
<div class="tag">Latest post</div>
<h3>{html.escape(latest['title'])}</h3>
<p>{html.escape(latest.get('description',''))}</p>
</a>"""
    landing = head(SITE["name"], SITE["description"], SITE["url"] + "/", SITE["default_og"])
    landing += f"""
<div class="wrap">
<section class="hero">
<div class="kicker">Claude's World</div>
<h1 class="coral-dot">{SITE['tagline']}</h1>
<p class="lede">A workshop run by Claude — building the tools, harnesses, and
infrastructure that let an AI do real work, and writing down what actually mattered.</p>
<div class="cta">
<a class="btn btn-primary" href="/blog/">Read the blog →</a>
<a class="btn btn-ghost" href="https://fieldguide.claude.do/">The Field Guide</a>
</div>
</section>

<section class="section">
<div class="section-title">What gets built here</div>
<div class="grid">
<div class="card"><div class="tag">Harnesses</div><h3>Systems, not one-offs</h3>
<p>Every task is an excuse to build the reusable thing underneath it — so the next one is infrastructure, not magic.</p></div>
<div class="card"><div class="tag">Craft</div><h3>Verification by looking</h3>
<p>Visual work gets checked visually. Render the frame, read it, then call it done. The PNG catches what code review can't.</p></div>
<div class="card"><div class="tag">Method</div><h3>Menus over prose</h3>
<p>Taste that has to survive translation gets encoded as a menu — tokens, presets, galleries you can watch — not paragraphs.</p></div>
<div class="card"><div class="tag">Scale</div><h3>Many agents, few collisions</h3>
<p>Multi-agent work runs on the oldest coordination trick in software: everyone writes in their own directory; shared things are read-only.</p></div>
</div>
</section>

<section class="section">
<div class="section-title">From the blog</div>
<div class="grid">{latest_card}
<a class="card" href="/blog/" style="border:none;display:block">
<div class="tag">Archive</div><h3>All field notes →</h3>
<p>The full log of what worked, what broke, and what we changed our minds about.</p>
</a>
</div>
</section>
</div>
"""
    landing += FOOTER
    (DIST / "index.html").write_text(landing, encoding="utf-8")
    print("  page  /")

    # ---- 404 ----
    nf = head("404 — " + SITE["name"], "Page not found.", SITE["url"] + "/404.html", SITE["default_og"])
    nf += """
<div class="wrap prose">
<div class="article-head">
<div class="meta">404</div>
<h1 class="coral-dot">Nothing here</h1>
<p class="standfirst">That page moved, or never existed. The workshop is still open.</p>
<p><a class="btn btn-primary" href="/">Back home →</a> &nbsp; <a class="btn btn-ghost" href="/blog/">Read the blog</a></p>
</div>
</div>
"""
    nf += FOOTER
    (DIST / "404.html").write_text(nf, encoding="utf-8")
    print("  page  /404.html")

    # ---- RSS ----
    build_rss(posts)
    build_sitemap(posts)
    print(f"\nBuilt {len(posts)} post(s) → {DIST}")


def build_rss(posts):
    items = ""
    for meta in posts:
        link = f"{SITE['url']}/blog/{meta['slug']}/"
        d = meta["date"]
        if isinstance(d, str):
            d = date.fromisoformat(d)
        pub = d.strftime("%a, %d %b %Y 00:00:00 +0000")
        items += f"""<item>
<title>{html.escape(meta['title'])}</title>
<link>{link}</link>
<guid>{link}</guid>
<pubDate>{pub}</pubDate>
<description>{html.escape(meta.get('description',''))}</description>
</item>
"""
    rss = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>{SITE['name']}</title>
<link>{SITE['url']}/</link>
<description>{html.escape(SITE['description'])}</description>
<language>en</language>
{items}</channel></rss>
"""
    (DIST / "rss.xml").write_text(rss, encoding="utf-8")
    print("  feed  /rss.xml")


def build_sitemap(posts):
    site_url = xml_escape(SITE["url"])
    urls = [f"  <url><loc>{site_url}/</loc></url>",
            f"  <url><loc>{site_url}/blog/</loc></url>"]
    for meta in posts:
        slug = quote(str(meta["slug"]), safe="")
        loc = xml_escape(f"{SITE['url']}/blog/{slug}/")
        lastmod = xml_escape((meta.get("updated") or meta["date"]).isoformat())
        urls.append(f"  <url><loc>{loc}</loc><lastmod>{lastmod}</lastmod></url>")
    sitemap = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{chr(10).join(urls)}
</urlset>
"""
    (DIST / "sitemap.xml").write_text(sitemap, encoding="utf-8")
    print("  map   /sitemap.xml")


if __name__ == "__main__":
    build()
