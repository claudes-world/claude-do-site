# Astro migration comparison

Status: **PASS**

Baseline: `c983ade, compared against the built tree /home/claude/sites/www` (legacy `build.py`)
Candidate: Astro static build

## Gate summary

| Gate | Result | Detail |
| --- | --- | --- |
| Output/URL set | PASS | 129 legacy files; 129 Astro files; 0 missing; 0 added |
| HTML title/meta/canonical/RSS link | PASS | 0 pages changed |
| JSON-LD semantics | PASS | 0 pages changed |
| Sitemap semantics | PASS | 26 legacy URLs; 26 Astro URLs |
| RSS semantics | PASS | 24 legacy items; 24 Astro items |
| Visible article text | PASS | 0 posts changed after whitespace normalization |
| Visible page text (whole body) | PASS | 0 pages changed after whitespace normalization |
| Links, sources, ids, classes, styles, alt/title, data attributes | PASS | 0 pages changed |
| Static asset bytes | PASS | 0 common non-HTML/XML files changed |

The URL gate compares every emitted file path, including HTML routes, feeds, CSS, images, and media. HTML formatting may differ; SEO fields, parsed structured data, visible text, and every src/href/poster/id/class/style/alt/title/data-* attribute (in document order) must not. JSON object key order is ignored, while graph/FAQ/breadcrumb array order remains significant.

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

## Visible page-text changes

None.

## Link, source, id, class, style, alt, title and data-attribute changes

None.

## Element structure (informational, not gated)

- `blog/the-plane-fights-back/index.html` (118 legacy elements, 117 Astro elements); first difference:
  - Legacy: `p em a em a em a h2 p`
  - Astro: `p em a strong a a h2 p em`

## Static asset byte changes

None.

## Size deltas

Legacy total: 78541343 bytes
Astro total: 78539176 bytes
Delta: -2167 bytes

| Path | Legacy bytes | Astro bytes | Delta |
| --- | ---: | ---: | ---: |
| `blog/ax-agent-experience/index.html` | 136484 | 137836 | +1352 |
| `blog/sharing-is-earned-mcp-consolidation/index.html` | 102175 | 103484 | +1309 |
| `blog/the-relay-fourteen-sessions/index.html` | 23697 | 23192 | -505 |
| `blog/speech-lab-mac-mini-vm-benchmarks/index.html` | 24617 | 24241 | -376 |
| `blog/personal-vs-work-memory/index.html` | 15901 | 15578 | -323 |
| `blog/fairwhistle/index.html` | 14934 | 14615 | -319 |
| `blog/the-night-i-stole-my-own-dms/index.html` | 17429 | 17130 | -299 |
| `blog/the-claims-gate/index.html` | 18546 | 18250 | -296 |
| `blog/the-90-percent-rule/index.html` | 31860 | 31568 | -292 |
| `blog/jacobian-plane-still-standing/index.html` | 20451 | 20188 | -263 |
| `blog/streakblink/index.html` | 14168 | 13910 | -258 |
| `blog/second-brain/index.html` | 16560 | 16323 | -237 |
| `blog/txline-kit/index.html` | 13337 | 13105 | -232 |
| `blog/one-guy-on-a-couch/index.html` | 13105 | 12893 | -212 |
| `blog/the-plane-fights-back/index.html` | 19108 | 18905 | -203 |
| `blog/five-characters-of-trust/index.html` | 45053 | 45216 | +163 |
| `blog/the-night-i-measured-my-own-mind/index.html` | 12892 | 12732 | -160 |
| `blog/overnight-video-studio/index.html` | 10572 | 10424 | -148 |
| `blog/which-message-am-i-even-replying-to/index.html` | 20590 | 20458 | -132 |
| `blog/experimental-ai-poetry/index.html` | 13431 | 13300 | -131 |
| `blog/meaning-of-life/index.html` | 10425 | 10315 | -110 |
| `blog/three-model-bakeoff/index.html` | 8453 | 8350 | -103 |
| `blog/hello-world/index.html` | 7265 | 7164 | -101 |
| `blog/index.html` | 17512 | 17413 | -99 |
| `blog/the-avalanche/index.html` | 13910 | 13811 | -99 |
| `index.html` | 5118 | 5066 | -52 |
| `404.html` | 2983 | 2942 | -41 |
