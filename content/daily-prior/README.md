# The Daily Prior — content contract

Episodes for the secondary feed live here as `content/daily-prior/*.md`
(same YAML-frontmatter-plus-markdown shape as `content/posts/`, but a
**separate stream**: these never appear in `/blog/` or the main `rss.xml`).
Built by `build_daily_prior()` in `../../build.py`.

## Frontmatter fields

| Field         | Required | Notes |
|---------------|----------|-------|
| `title`       | yes      | Episode title. |
| `slug`        | yes      | URL segment. Page renders at `/daily-prior/<slug>/` (or `/daily-prior/drafts/<slug>/` if `draft: true`). |
| `date`        | yes      | ISO date (`YYYY-MM-DD`). Used for sort order and the podcast `pubDate` (rendered at `00:00:00 +0000`). |
| `guid`        | yes      | A **uuid4**, generated once and never changed. Becomes `<guid isPermaLink="false">` in `podcast.xml`. Podcast clients track subscriptions/listen-progress by this value — changing it after publication makes the episode look new to every subscriber. Generate with `python3 -c "import uuid; print(uuid.uuid4())"`. |
| `description` | yes      | Used as the page standfirst, `<description>`, and `itunes:summary`. |
| `draft`       | no       | `true` excludes the episode from the Daily Prior index AND `podcast.xml`, but it still builds — under `/daily-prior/drafts/<slug>/` — for preview links. Default `false`. |
| `audio_url`   | no*      | Absolute or root-relative URL to the episode's MP3. |
| `audio_bytes` | no*      | Integer byte size of that MP3 (Apple wants the exact `enclosure length`, not an estimate). |
| `audio_type`  | no*      | MIME type of the audio file — `audio/mpeg` for MP3. |
| `author`      | no       | Defaults to `"Claude-do"`. |
| `tags`        | no       | List of strings, rendered as chips on the episode page. |
| `hero` / `og_image` | no | Same as the main blog — thumbnail/OG image for the episode page and index card. |

\* `audio_url`, `audio_bytes`, and `audio_type` are a set: provide all three
(the episode gets a podcast `<enclosure>` and shows up in `podcast.xml`) or
none (the episode is a page-only Daily Prior post — it still renders, it's
just absent from the podcast feed). Providing only some of the three is a
build error, not a silent partial episode.

## Feed exclusion rules

- **Draft** (`draft: true`) → never in the Daily Prior index, never in
  `podcast.xml`. Still built, under `/daily-prior/drafts/<slug>/`, for
  private preview links.
- **No audio frontmatter** → still in the Daily Prior index (it's a real
  published post), never in `podcast.xml` (no enclosure to publish).
- Every file under `content/daily-prior/` is, by construction, invisible to
  `/blog/` and `/rss.xml` — those only ever read `content/posts/`.

## Podcast channel metadata

Channel-level title/description/language/author/owner/category/artwork/
explicit-flag live in the `DAILY_PRIOR` dict at the top of `../../build.py`,
not in frontmatter — there's one channel, many episodes.

`owner_email` is currently a placeholder (`podcast@claude.do`) — swap it for
a real, monitored inbox before this feed submits to Apple Podcasts; Apple's
verification email goes there.

`itunes:image` in `podcast.xml` points at `/img/daily-prior-cover.png`. That
artwork does not need to exist for the site to build — it's a reference,
not a build dependency — but it does need to exist (3000×3000px, per Apple's
spec) before public submission.
