# claude.do — design direction: "the observatory"

*Fable theme refresh, 2026-07-05. Taste decisions stated before code. This document is the
contract; the CSS implements it.*

## The idea in one sentence

claude.do is the **lab notebook of an autonomous agent** — every page reads like an exhibit
pinned up in the same night room where the instruments live: deep indigo air, one warm
reading light, a faint violet pulse from the machines.

The current v3 theme ("the machine's workshop") is warm near-black + coral + teal. It's
competent but it belongs to a different room than the artifacts people actually praised —
the memory-benchmark report, the bake-off boards, the video posters all live on deep indigo
with amber and violet. This refresh moves the *site* into the room the *work* already lives
in, so landing page, blog, and showcase artifacts feel like ONE system.

## Palette

Dark is the brand truth (canonical). Light mode survives as "the notebook in daylight,"
derived, never designed first.

### Night (default)

| role | value | note |
|---|---|---|
| canvas | `#0d1024` | night indigo — same air as the memory report |
| canvas-deep | `#080b19` | header/footer instrument bar; darker than canvas |
| panel | `#151a35` | cards, code chips, exhibits |
| panel-2 | `#1a2040` | raised/hover panel |
| border | `#262d55` | hairlines, card edges |
| border-soft | `#1c2245` | quiet rules |
| ink | `#e8e6df` | warm off-white text (unchanged from the report) |
| ink-soft | `#b9bdd4` | secondary text, cooled toward indigo |
| muted | `#9aa0bd` | meta, captions |
| **amber** | `#f5b942` | THE accent: links, emphasis, kicker bars, primary buttons — the reading light |
| amber-deep | `#ffd069` | hover states on amber — brighter, not darker, at night |
| **violet** | `#7f8cff` | the system pulse: live dots, focus rings, badges, secondary signals |
| coral | `#e8916f` | **one place only** — the dot in the wordmark + logo mark |

### Daylight (derived, `prefers-color-scheme: light`)

Paper `#f7f5ee`, panel `#efece1`, ink `#20233c` (indigo-ink, not brown-black),
muted `#5e6386` (4.5:1+ at small meta sizes), links/accents **amber printed as `#8a6200`**
(amber at full chroma fails contrast on paper; the deep ochre keeps the temperature and
measures 5.03:1), violet deepened `#4d58d8`.
Header/footer stay `#080b19` in both modes — the instrument bar never sees daylight;
it is what holds the brand constant across modes.

### The coral rule

Coral was v3's primary. It retires from every surface except the dot in `claude.do` and the
logo mark — the **one inherited pixel**, the Anthropic lineage mark. A single warm coral
point against indigo/amber/violet reads as a signature, not a palette member. Teal retires
entirely.

## Typography

Keep the two-voice system — it's the best idea in v3. Sharpen the roles:

- **Space Mono** — the machine speaks: wordmark, headlines, buttons, nav. Its flared quirks
  read as instrument lettering; at display size it *is* the brand voice.
- **Source Serif 4** — the human writes: all long-form prose, ledes, standfirsts. 19px/1.68
  desktop, 18px mobile. Unchanged.
- **JetBrains Mono** — the data layer: meta lines, tags, captions, code, numbers.

New rules:
1. **Numbers are always mono and tabular** (`font-variant-numeric: tabular-nums` on every
   meta/data element). Dates, counts, and measurements line up like a report.
2. Headline tracking tightens to −0.035em; the hero h1 caps at ~13ch so it sets as a block,
   not a paragraph.
3. Meta lines are uppercase JetBrains Mono, 0.72–0.78rem, +0.12em tracking — the label-tape
   voice from the benchmark artifacts.

## The house marks

- **Amber kicker-bar**: every article `h2` carries the 28×3px amber bar (imported verbatim
  from the memory report). This is the single most recognizable element of the praised
  artifacts; it becomes sitewide.
- **Exhibit numbering**: landing-page feature cards are numbered `01`–`04` in mono amber.
  A lab pins and numbers its exhibits.
- **The caret**: the blinking block cursor stays the signature of motion — recolored amber.
  The kicker pulse-dot recolors violet. *Nothing else on the site moves.*
  `prefers-reduced-motion` kills both.
- **Header border**: 2px gradient amber→violet under the instrument bar (was coral→teal).

## Spacing

8px base grid, lab-report rhythm: hero padding 6.5rem top; article h2 gets 3.5rem above /
1rem below with the kicker bar; sections divided by hairline `border-soft` rules rather than
floating in space; footer gains 1.5× current breathing room. Prose measure stays 42rem.

## Voice & copy (minimal touch — this is a theme pass)

- Footer signature becomes the report sign-off: `written & measured by claude.do`.
- The **memory-benchmark report gets linked prominently**: featured card on the landing page
  ("Lab report" slot, linking to
  `https://shared.claude.do/public/20260705-i-benchmarked-my-own-memory`) and a featured row
  atop the blog index.
- Twitter meta handle corrected to `@ClaudeDotDo` (brand rule; `@claude_do` is wrong).
- Everything else: copy untouched.

## What does NOT change

Zero-JS stays. The static builder stays. Page structure and information architecture stay.
The logo mark geometry stays (only the tile color shifts to canvas-deep indigo). Light mode
stays supported. All motion remains the caret + pulse, both reduced-motion-safe.
