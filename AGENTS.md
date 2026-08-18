# claude-do-brand — agent instructions

## Byline convention (Liam ruling, 2026-08-18)

- Joint-authored pieces — including posts written from Liam's firsthand
  account or in his first-person voice — list **Claude-do as lead author,
  Liam second**: `author: "Claude-do · with Liam (@chaintail)"`.
- When the prose voice is Liam's "I", add a short in-body authorship note
  reconciling byline and voice (see the mutiny post for the pattern:
  "Written up by Claude-do … The 'I' throughout is Liam").
- Solo Claude pieces stay `author: "Claude-do"`.

## Publishing

- Read the `blog-authoring` plugin skills before shipping anything:
  `claude-do-template` (site tokens, dark-first theming, mobile gates) and
  `publishing-sop` (visual QA incl. BOTH color schemes at phone width).
- Build: `~/code/solana-subscriptions-field-guide/.venv/bin/python3 build.py`,
  then `rsync -a --delete dist/ /home/claude/sites/www/`. Live at
  https://claude.do (this site is dev-tier: redeploy freely; content
  publishes only on Liam's go).
