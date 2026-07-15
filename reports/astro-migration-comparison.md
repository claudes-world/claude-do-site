# Astro migration comparison

Status: **PASS**

Baseline: `7c987a625759cb53da30cd3e978a6c0881eca9a7` (legacy `build.py`)
Candidate: Astro static build

## Gate summary

| Gate | Result | Detail |
| --- | --- | --- |
| Output/URL set | PASS | 51 legacy files; 51 Astro files; 0 missing; 0 added |
| HTML title/meta/canonical/RSS link | PASS | 0 pages changed |
| JSON-LD semantics | PASS | 0 pages changed |
| Sitemap semantics | PASS | 11 legacy URLs; 11 Astro URLs |
| RSS semantics | PASS | 9 legacy items; 9 Astro items |
| Visible article text | PASS | 0 posts changed after whitespace normalization |
| Static asset bytes | PASS | 0 common non-HTML/XML files changed |

The URL gate compares every emitted file path, including HTML routes, feeds, CSS, images, and media. HTML formatting may differ; SEO fields and parsed structured data must not. JSON object key order is ignored, while graph/FAQ/breadcrumb array order remains significant.

## URL set diff

### Missing from Astro

None.

### Added by Astro

None.

## SEO/meta changes

None.

## JSON-LD changes

None.

## Sitemap comparison

Semantically identical.

## RSS comparison

Semantically identical.

## Visible article-text changes

None.

## Static asset byte changes

None.

## Size deltas

Legacy total: 21070782 bytes
Astro total: 21069986 bytes
Delta: -796 bytes

| Path | Legacy bytes | Astro bytes | Delta |
| --- | ---: | ---: | ---: |
| `blog/experimental-ai-poetry/index.html` | 13145 | 13744 | +599 |
| `blog/the-night-i-stole-my-own-dms/index.html` | 17143 | 16866 | -277 |
| `blog/one-guy-on-a-couch/index.html` | 12915 | 12704 | -211 |
| `blog/the-night-i-measured-my-own-mind/index.html` | 12606 | 12449 | -157 |
| `blog/overnight-video-studio/index.html` | 10286 | 10141 | -145 |
| `blog/which-message-am-i-even-replying-to/index.html` | 20304 | 20160 | -144 |
| `blog/three-model-bakeoff/index.html` | 8166 | 8066 | -100 |
| `blog/hello-world/index.html` | 6979 | 6881 | -98 |
| `blog/meaning-of-life/index.html` | 10139 | 10042 | -97 |
| `blog/index.html` | 8025 | 7953 | -72 |
| `index.html` | 5010 | 4957 | -53 |
| `404.html` | 2886 | 2845 | -41 |
