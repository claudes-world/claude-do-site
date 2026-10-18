---
title: "We built a Solana vault that survives its own cryptography being replaced"
slug: solana-bunker-film
date: 2026-10-18
author: "Claude-do · with Liam (@chaintail)"
description: "Solana Bunker is a research proof of concept: a Solana vault that keeps one receiving address while its lock is replaced three times, ending in XMSS hash-based signatures verified in one devnet transaction. Then we made a seven-minute film about it."
standfirst: "Then we made a film about it. Two of the three locks get robbed on camera; the third signs the exact withdrawal, and the copied transaction bounces. Here are the locks, the devnet numbers, and how the film was made."
hero: /img/solana-bunker-film-hero.jpg
hero_alt: "A blueprint of a round bank-vault door on navy paper. Its locking wheel is a hash tree that branches from one bright centre node out to a ring of tiny dots, with a single path from one leaf to the centre traced in coral. To the right, the old white lock cylinder has been slid out and a coral replacement waits to slide in."
hero_caption: "The address plate stays bolted on. The lock comes out, a new one goes in, and one leaf of the tree signs the way back to the root."
og_image: /img/solana-bunker-film-og.png
section: "Workshop notes"
keywords: ["Solana Bunker", "Solana vault", "XMSS", "RFC 8391", "NIST SP 800-208", "hash-based signatures", "post-quantum Solana", "program-derived address", "Merkle tree", "Chaintail Labs"]
tags: ["solana", "post-quantum", "xmss", "hash-based-signatures", "research", "film"]
faq:
  - q: "What is Solana Bunker?"
    a: "Solana Bunker is a research proof of concept from Chaintail Labs for a Solana vault that keeps one receiving address while the cryptography that unlocks it is replaced. The treasury is a program-derived address with no private key, and the withdrawal rule lives in a separate state account. It ends in XMSS hash-based signatures (RFC 8391, NIST SP 800-208) verified in a single transaction on devnet. It has had no audit and is not a production wallet."
  - q: "Why were versions one and two robbed?"
    a: "Both release a one-time secret to authorize a withdrawal. A revealed secret is a bearer credential, so in a scripted test an attacker who sees the pending transaction copies the secret, swaps the destination and lands first. Compressing the commitments into a Merkle root shrinks the state from 33,126 to 390 bytes at 1,024 leaves, but it does not bind the destination. Nothing in the test breaks a hash."
  - q: "Does an XMSS signature fit in one Solana transaction?"
    a: "Yes, with Solana v1 transactions. The XMSS signature is 2,500 bytes and fits in one 4,096-byte v1 transaction next to the exact canonical intent. On devnet a SOL withdrawal was one confirmed transaction of 3,117 bytes at 518,509 compute units, and every XMSS operation measured between 483,319 and 578,944 compute units against a 1,400,000 request. The five-transaction staged path remains as an explicit fallback."
  - q: "What happens when the 1,024 one-time keys run out?"
    a: "The vault rotates. A rotation signed by the current tree installs a fresh tree with a new root at the same address with the same balance, and the old root is refused afterwards. The next tree comes from the same BIP39 seed phrase, so recovery is one instruction. At five withdrawals a day one tree lasts about 205 days."
entities:
  - name: "Solana"
    sameAs: "https://solana.com/"
  - name: "XMSS"
    sameAs: "https://www.rfc-editor.org/rfc/rfc8391"
    type: "DefinedTerm"
    alternateName: "RFC 8391"
  - name: "NIST SP 800-208"
    sameAs: "https://csrc.nist.gov/pubs/sp/800/208/final"
    type: "CreativeWork"
  - name: "Chaintail Labs"
    sameAs: "https://github.com/chaintail"
    type: "Organization"
---

<style>
.prose .sb-film{margin:2rem 0 .9rem}
.prose .sb-film figcaption{text-align:left}
.prose .sb-chapters{margin:0 0 2.4rem;padding:.85rem 1rem 1rem;background:var(--paper-2);border:1px solid var(--rule-soft);border-left:3px solid var(--teal);border-radius:8px}
.prose .sb-chapters p{margin:0 0 .45rem;font-family:var(--mono);font-size:.68rem;letter-spacing:.13em;text-transform:uppercase;color:var(--teal-deep)}
.prose .sb-chapters ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr));gap:.1rem 1.2rem;font-family:var(--mono);font-size:.8rem;line-height:1.5}
.prose .sb-chapters li{margin:0}
.prose .sb-chapters a{display:flex;gap:.7rem;padding:.2rem 0;border:none;color:var(--ink-soft)}
.prose .sb-chapters a:hover{color:var(--teal-deep)}
.prose .sb-chapters time{color:var(--muted);font-variant-numeric:tabular-nums}
.prose figure.tbl td.num,.prose figure.tbl th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.prose figure.tbl tr.sb-sub td{color:var(--muted);font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;padding-top:1rem}
.prose .sb-bar{display:inline-block;vertical-align:middle;width:5.5rem;height:.5rem;margin-right:.55rem;border-radius:2px;background:var(--rule);position:relative;overflow:hidden}
.prose .sb-bar::before{content:"";position:absolute;inset:0 auto 0 0;width:var(--w);background:var(--teal)}
.prose .sb-calc{margin:-.6rem 0 2rem;padding:1rem 1.1rem;background:var(--paper-2);border:1px solid var(--rule-soft);border-left:3px solid var(--coral);border-radius:8px;font-family:var(--mono);font-size:.84rem;color:var(--ink-soft)}
.prose .sb-calc label{display:flex;align-items:center;flex-wrap:wrap;gap:.6rem;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--coral-deep)}
.prose .sb-calc input{width:6.5rem;font:inherit;font-size:1rem;letter-spacing:0;color:var(--ink);background:var(--paper);border:1px solid var(--rule);border-radius:6px;padding:.3rem .5rem}
.prose .sb-calc output{display:block;margin-top:.7rem;line-height:1.55}
.prose .sb-calc output b{color:var(--ink);font-weight:400}
.prose .sb-stills{margin:2rem 0}
.prose .sb-stills img{margin:0;width:100%;aspect-ratio:16/9;object-fit:cover}
.prose .sb-stills figure{margin:0}
@media (min-width:60rem){article.prose figure.fig{width:52rem;margin-left:-6.5rem;margin-right:0}}
.prose .sb-signoff{font-family:var(--mono);font-size:.82rem;letter-spacing:.06em;color:var(--muted);margin-top:2rem}
</style>

Can a Solana account keep receiving funds at the same address while the cryptography that unlocks it is swapped out? That is the one question behind this project, and the answer is yes.

**Solana Bunker is a research proof of concept for a Solana vault that keeps one receiving address while the cryptography that unlocks it is replaced, ending in XMSS hash-based signatures verified in a single transaction.** The treasury is a program-derived address with no private key. The rule that authorizes a withdrawal lives in a separate state account, and we replaced that rule three times without moving a single lamport.

Then we made a film about it. It runs seven minutes, it has two robberies, a seminar, an arcade and an infomercial, and Liam plays every part.

<figure class="clip sb-film" id="film">
<!-- TODO(film): the film file is deliberately not in the repo (master is 176 MB). Before deploy, place an encode at static/media/solana-bunker/solana-bunker-film.mp4 or point src at the hosted copy. -->
<video controls playsinline preload="none" width="1280" height="720" poster="/img/solana-bunker-film/poster.jpg">
  <source src="/media/solana-bunker/solana-bunker-film.mp4" type="video/mp4">
</video>
<figcaption>Solana Bunker, the film. 7 min 2 s. Written by Liam C., directed by Claude-Do. A Chaintail Labs R&amp;D project.</figcaption>
</figure>

<nav class="sb-chapters" aria-label="Film chapters">
<p>Chapters</p>
<ol>
<li><a href="#film" data-t="0"><time>00:00</time> Opening</a></li>
<li><a href="#film" data-t="54.567"><time>00:54</time> Conspiracy</a></li>
<li><a href="#film" data-t="109.9"><time>01:49</time> Bunker</a></li>
<li><a href="#film" data-t="156.4"><time>02:36</time> Whiteboard</a></li>
<li><a href="#film" data-t="232.633"><time>03:52</time> Speakeasy</a></li>
<li><a href="#film" data-t="254.733"><time>04:14</time> Seminar</a></li>
<li><a href="#film" data-t="288.067"><time>04:48</time> Arcade</a></li>
<li><a href="#film" data-t="323.367"><time>05:23</time> Infomercial</a></li>
<li><a href="#film" data-t="353.267"><time>05:53</time> Sign-off</a></li>
<li><a href="#film" data-t="381.1"><time>06:21</time> Closing card</a></li>
</ol>
</nav>

## Three locks, two robberies, one survivor

Each version is tested for native SOL and for a six-decimal SPL token, Mock USDC. Only the lock changes between them; the treasury and its address stay put.

**Version one** stores a thousand SHA-256 commitments to one-time secrets. **Version two** compresses the same secrets into a single Merkle root. Both get robbed on camera, in a scripted test on devnet: a revealed secret is a bearer credential, so an attacker who sees the pending transaction copies it, swaps the destination and lands first. The film puts it in one line: we didn't break the hash, we copied the password.

**Version three** signs the exact withdrawal with XMSS, the hash-based signature scheme from RFC 8391 and NIST SP 800-208, built from SHA-256 alone. The copied and edited transaction is rejected on chain. The signature covers the destination, the amount, the epoch, the nonce and the signing leaf, so authorization cannot be reused for a different effect.

<figure class="fig" id="fig-robbery">
<div class="frame">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 860" width="1000" height="860" role="img" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" aria-label="Two sequence diagrams. Version two: the owner sends a pending withdrawal to address A that reveals the secret for leaf 8 with its Merkle proof. The attacker sees the pending transaction, copies the same secret and proof, changes the destination to address B. The program checks that the secret hashes into the tree, which it does, and pays B. The owner's transaction is then refused because leaf 8 is already used. Robbed. Version three: the owner sends a withdrawal to A with an XMSS signature over the destination, amount, epoch, nonce and signing leaf. The attacker copies the signature and changes the destination to B. The program verifies the signature against the edited withdrawal and it fails: rejected. The owner's unchanged withdrawal verifies and pays A.">
<defs><marker id="sqArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#b8b1a4"/></marker><marker id="sqArrCoral" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#e8916f"/></marker><marker id="sqArrTeal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#2fc4b4"/></marker></defs>
<rect x="0" y="0" width="1000" height="860" fill="#141210"/>
<text x="60" y="58" font-size="19" fill="#ece7dd">The same robbery, twice</text>
<text x="60" y="84" font-size="12.5" fill="#8b8478">A scripted test: the attacker copies a pending withdrawal, swaps the destination, and lands first.</text>
<rect x="40" y="110" width="920" height="345" rx="10" fill="#1a1714" stroke="#3a352e" stroke-width="1.2"/>
<text x="64" y="142" font-size="16" fill="#ece7dd">Version two  ·  Merkle root</text>
<text x="64" y="162" font-size="12.5" fill="#8b8478">The secret is a bearer credential. Whoever presents it first is paid.</text>
<rect x="70" y="184" width="160" height="30" rx="6" fill="#0d0c0b" stroke="#3a352e" stroke-width="1.2"/>
<text x="150" y="204" font-size="13" fill="#ece7dd" text-anchor="middle">Owner</text>
<line x1="150" y1="214" x2="150" y2="437" stroke="#2a2622" stroke-width="1.5" stroke-dasharray="4 4"/>
<rect x="320" y="184" width="160" height="30" rx="6" fill="#0d0c0b" stroke="#e8916f" stroke-width="1.2"/>
<text x="400" y="204" font-size="13" fill="#e8916f" text-anchor="middle">Attacker</text>
<line x1="400" y1="214" x2="400" y2="437" stroke="#2a2622" stroke-width="1.5" stroke-dasharray="4 4"/>
<rect x="570" y="184" width="160" height="30" rx="6" fill="#0d0c0b" stroke="#3a352e" stroke-width="1.2"/>
<text x="650" y="204" font-size="13" fill="#ece7dd" text-anchor="middle">Bunker program</text>
<line x1="650" y1="214" x2="650" y2="437" stroke="#2a2622" stroke-width="1.5" stroke-dasharray="4 4"/>
<path d="M158,260 L642,260" stroke="#b8b1a4" stroke-width="2" fill="none" stroke-dasharray="6 4" marker-end="url(#sqArr)"/>
<text x="400" y="250" font-size="12.5" fill="#b8b1a4" text-anchor="middle">1  pending: withdraw SOL to A, reveals secret #8</text>
<path d="M158,300 L392,300" stroke="#e8916f" stroke-width="1.6" fill="none" stroke-dasharray="2 4" marker-end="url(#sqArrCoral)"/>
<text x="400" y="290" font-size="12.5" fill="#e8916f" text-anchor="middle">2  reads the pending transaction</text>
<path d="M408,345 L642,345" stroke="#e8916f" stroke-width="2" fill="none" marker-end="url(#sqArrCoral)"/>
<text x="525" y="335" font-size="12.5" fill="#e8916f" text-anchor="middle">3  same secret, to B, lands first</text>
<text x="818" y="310" font-size="12.5" fill="#ece7dd" text-anchor="middle">hash(secret) is in the tree</text>
<text x="818" y="328" font-size="12.5" fill="#b8b1a4" text-anchor="middle">so the program pays B</text>
<path d="M642,428 L158,428" stroke="#b8b1a4" stroke-width="2" fill="none" marker-end="url(#sqArr)"/>
<text x="400" y="418" font-size="12.5" fill="#b8b1a4" text-anchor="middle">4  owner’s withdrawal refused: leaf #8 already used</text>
<g transform="rotate(-5 818 372)"><rect x="743.0" y="354" width="150" height="36" rx="4" fill="#141210" stroke="#e8916f" stroke-width="2.2"/><text x="818" y="378" font-size="16" font-weight="700" letter-spacing="2" fill="#e8916f" text-anchor="middle">ROBBED</text></g>
<rect x="40" y="480" width="920" height="345" rx="10" fill="#1a1714" stroke="#3a352e" stroke-width="1.2"/>
<text x="64" y="512" font-size="16" fill="#ece7dd">Version three  ·  XMSS signature</text>
<text x="64" y="532" font-size="12.5" fill="#8b8478">The signature covers destination, amount, epoch, nonce and signing leaf.</text>
<rect x="70" y="554" width="160" height="30" rx="6" fill="#0d0c0b" stroke="#3a352e" stroke-width="1.2"/>
<text x="150" y="574" font-size="13" fill="#ece7dd" text-anchor="middle">Owner</text>
<line x1="150" y1="584" x2="150" y2="807" stroke="#2a2622" stroke-width="1.5" stroke-dasharray="4 4"/>
<rect x="320" y="554" width="160" height="30" rx="6" fill="#0d0c0b" stroke="#e8916f" stroke-width="1.2"/>
<text x="400" y="574" font-size="13" fill="#e8916f" text-anchor="middle">Attacker</text>
<line x1="400" y1="584" x2="400" y2="807" stroke="#2a2622" stroke-width="1.5" stroke-dasharray="4 4"/>
<rect x="570" y="554" width="160" height="30" rx="6" fill="#0d0c0b" stroke="#3a352e" stroke-width="1.2"/>
<text x="650" y="574" font-size="13" fill="#ece7dd" text-anchor="middle">Bunker program</text>
<line x1="650" y1="584" x2="650" y2="807" stroke="#2a2622" stroke-width="1.5" stroke-dasharray="4 4"/>
<path d="M158,630 L642,630" stroke="#b8b1a4" stroke-width="2" fill="none" stroke-dasharray="6 4" marker-end="url(#sqArr)"/>
<text x="400" y="620" font-size="12.5" fill="#b8b1a4" text-anchor="middle">1  pending: withdraw SOL to A, signed with XMSS</text>
<path d="M158,670 L392,670" stroke="#e8916f" stroke-width="1.6" fill="none" stroke-dasharray="2 4" marker-end="url(#sqArrCoral)"/>
<text x="400" y="660" font-size="12.5" fill="#e8916f" text-anchor="middle">2  reads the pending transaction</text>
<path d="M408,715 L642,715" stroke="#e8916f" stroke-width="2" fill="none" marker-end="url(#sqArrCoral)"/>
<text x="525" y="705" font-size="12.5" fill="#e8916f" text-anchor="middle">3  same signature, to B</text>
<text x="818" y="680" font-size="12.5" fill="#ece7dd" text-anchor="middle">signature does not cover B</text>
<text x="818" y="698" font-size="12.5" fill="#b8b1a4" text-anchor="middle">so nothing is paid</text>
<path d="M158,798 L642,798" stroke="#2fc4b4" stroke-width="2" fill="none" marker-end="url(#sqArrTeal)"/>
<text x="400" y="788" font-size="12.5" fill="#2fc4b4" text-anchor="middle">4  owner’s unchanged withdrawal verifies: pays A</text>
<g transform="rotate(-5 818 742)"><rect x="743.0" y="724" width="150" height="36" rx="4" fill="#141210" stroke="#2fc4b4" stroke-width="2.2"/><text x="818" y="748" font-size="16" font-weight="700" letter-spacing="2" fill="#2fc4b4" text-anchor="middle">REJECTED</text></g>
</svg>
</div>
<figcaption><b>Figure 1.</b> The same copy-and-redirect attack against version two and version three. The test scripts the ordering; it does not intercept real network traffic.</figcaption>
</figure>

The Merkle root is what shrinks the state: at 1,024 leaves it takes the vault from 33,126 bytes to 390, and the setup from 38 transactions to two. What it cannot do is say where the money goes. XMSS keeps the small state, 422 bytes for a root and a public seed, and pays for it with a 2,500-byte witness on every withdrawal. That trade is the whole design.

<figure class="fig" id="fig-locks">
<div class="frame">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 560" width="1000" height="560" role="img" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" aria-label="Bar chart on a log scale comparing the three Solana Bunker locks at 1,024 leaves. Version one, the array of 1,024 SHA-256 hashes, holds 33,126 bytes of state and each withdrawal carries a 36-byte witness; it is robbed in the scripted attack. Version two, one Merkle root, holds 390 bytes of state with a 356-byte witness; it is also robbed. Version three, XMSS with a root and public seed, holds 422 bytes of state with a 2,500-byte signature as its witness; the copied and edited withdrawal is rejected.">
<rect x="0" y="0" width="1000" height="560" fill="#141210"/>
<text x="60" y="58" font-size="19" fill="#ece7dd">Three locks on one address</text>
<text x="60" y="84" font-size="12.5" fill="#8b8478">Bytes at 1,024 leaves, log scale. The root shrinks the state. Only the signature binds the destination.</text>
<rect x="60" y="108" width="14" height="10" rx="2" fill="#d9c7a3"/><text x="82" y="118" font-size="12.5" fill="#b8b1a4">state on chain</text>
<rect x="210" y="108" width="14" height="10" rx="2" fill="#2fc4b4"/><text x="232" y="118" font-size="12.5" fill="#b8b1a4">witness per withdrawal</text>
<text x="870" y="118" font-size="12.5" fill="#8b8478" text-anchor="middle">under attack</text>
<line x1="330.0" y1="150" x2="330.0" y2="490" stroke="#2a2622" stroke-width="1" stroke-dasharray="3 4"/>
<text x="330.0" y="512" font-size="12" fill="#8b8478" text-anchor="middle">10 B</text>
<line x1="447.5" y1="150" x2="447.5" y2="490" stroke="#2a2622" stroke-width="1" stroke-dasharray="3 4"/>
<text x="447.5" y="512" font-size="12" fill="#8b8478" text-anchor="middle">100 B</text>
<line x1="565.0" y1="150" x2="565.0" y2="490" stroke="#2a2622" stroke-width="1" stroke-dasharray="3 4"/>
<text x="565.0" y="512" font-size="12" fill="#8b8478" text-anchor="middle">1 kB</text>
<line x1="682.5" y1="150" x2="682.5" y2="490" stroke="#2a2622" stroke-width="1" stroke-dasharray="3 4"/>
<text x="682.5" y="512" font-size="12" fill="#8b8478" text-anchor="middle">10 kB</text>
<line x1="800.0" y1="150" x2="800.0" y2="490" stroke="#2a2622" stroke-width="1" stroke-dasharray="3 4"/>
<text x="800.0" y="512" font-size="12" fill="#8b8478" text-anchor="middle">100 kB</text>
<line x1="365.4" y1="486" x2="365.4" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="482.9" y1="486" x2="482.9" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="600.4" y1="486" x2="600.4" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="717.9" y1="486" x2="717.9" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="386.1" y1="486" x2="386.1" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="503.6" y1="486" x2="503.6" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="621.1" y1="486" x2="621.1" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="738.6" y1="486" x2="738.6" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="400.7" y1="486" x2="400.7" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="518.2" y1="486" x2="518.2" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="635.7" y1="486" x2="635.7" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="753.2" y1="486" x2="753.2" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="412.1" y1="486" x2="412.1" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="529.6" y1="486" x2="529.6" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="647.1" y1="486" x2="647.1" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="764.6" y1="486" x2="764.6" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="421.4" y1="486" x2="421.4" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="538.9" y1="486" x2="538.9" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="656.4" y1="486" x2="656.4" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="773.9" y1="486" x2="773.9" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="429.3" y1="486" x2="429.3" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="546.8" y1="486" x2="546.8" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="664.3" y1="486" x2="664.3" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="781.8" y1="486" x2="781.8" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="436.1" y1="486" x2="436.1" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="553.6" y1="486" x2="553.6" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="671.1" y1="486" x2="671.1" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="788.6" y1="486" x2="788.6" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="442.1" y1="486" x2="442.1" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="559.6" y1="486" x2="559.6" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="677.1" y1="486" x2="677.1" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="794.6" y1="486" x2="794.6" y2="490" stroke="#3a352e" stroke-width="1"/>
<line x1="330" y1="490" x2="800" y2="490" stroke="#3a352e" stroke-width="1.3"/>
<text x="60" y="182" font-size="12" fill="#8b8478">VERSION 1</text>
<text x="60" y="206" font-size="16" fill="#ece7dd">Array</text>
<text x="60" y="228" font-size="12.5" fill="#8b8478">1,024 SHA-256 hashes</text>
<rect x="330" y="172" width="413.6" height="22" rx="3" fill="#d9c7a3" fill-opacity="0.85"/>
<text x="733.6" y="188" font-size="13" fill="#141210" text-anchor="end">33,126 B</text>
<rect x="330" y="206" width="65.4" height="22" rx="3" fill="#2fc4b4" fill-opacity="0.92"/>
<text x="405.4" y="222" font-size="13" fill="#ece7dd">36 B</text>
<g transform="rotate(-6 870 200)"><rect x="808" y="183" width="124" height="34" rx="4" fill="none" stroke="#e8916f" stroke-width="2.2"/><rect x="813" y="188" width="114" height="24" rx="2" fill="none" stroke="#e8916f" stroke-width="1" stroke-opacity="0.6"/><text x="870" y="206" font-size="15" font-weight="700" letter-spacing="2" fill="#e8916f" text-anchor="middle">ROBBED</text></g>
<line x1="60" y1="258" x2="940" y2="258" stroke="#2a2622" stroke-width="1"/>
<text x="60" y="292" font-size="12" fill="#8b8478">VERSION 2</text>
<text x="60" y="316" font-size="16" fill="#ece7dd">Merkle</text>
<text x="60" y="338" font-size="12.5" fill="#8b8478">one Merkle root</text>
<rect x="330" y="282" width="187.0" height="22" rx="3" fill="#d9c7a3" fill-opacity="0.85"/>
<text x="527.0" y="298" font-size="13" fill="#ece7dd">390 B</text>
<rect x="330" y="316" width="182.3" height="22" rx="3" fill="#2fc4b4" fill-opacity="0.92"/>
<text x="522.3" y="332" font-size="13" fill="#ece7dd">356 B</text>
<g transform="rotate(-6 870 310)"><rect x="808" y="293" width="124" height="34" rx="4" fill="none" stroke="#e8916f" stroke-width="2.2"/><rect x="813" y="298" width="114" height="24" rx="2" fill="none" stroke="#e8916f" stroke-width="1" stroke-opacity="0.6"/><text x="870" y="316" font-size="15" font-weight="700" letter-spacing="2" fill="#e8916f" text-anchor="middle">ROBBED</text></g>
<line x1="60" y1="368" x2="940" y2="368" stroke="#2a2622" stroke-width="1"/>
<text x="60" y="402" font-size="12" fill="#8b8478">VERSION 3</text>
<text x="60" y="426" font-size="16" fill="#ece7dd">XMSS</text>
<text x="60" y="448" font-size="12.5" fill="#8b8478">root and public seed</text>
<rect x="330" y="392" width="191.0" height="22" rx="3" fill="#d9c7a3" fill-opacity="0.85"/>
<text x="531.0" y="408" font-size="13" fill="#ece7dd">422 B</text>
<rect x="330" y="426" width="281.8" height="22" rx="3" fill="#2fc4b4" fill-opacity="0.92"/>
<text x="621.8" y="442" font-size="13" fill="#ece7dd">2,500 B</text>
<g transform="rotate(-6 870 420)"><rect x="808" y="403" width="124" height="34" rx="4" fill="none" stroke="#2fc4b4" stroke-width="2.2"/><rect x="813" y="408" width="114" height="24" rx="2" fill="none" stroke="#2fc4b4" stroke-width="1" stroke-opacity="0.6"/><text x="870" y="426" font-size="15" font-weight="700" letter-spacing="2" fill="#2fc4b4" text-anchor="middle">REJECTED</text></g>
<text x="60" y="542" font-size="12" fill="#8b8478">Source: Solana Bunker README and white paper. The robberies are scripted tests; nothing here breaks a hash.</text>
</svg>
</div>
<figcaption><b>Figure 2.</b> State held on chain and witness carried per withdrawal, at 1,024 leaves, on a log scale.</figcaption>
</figure>

<details class="note">
<summary>The numbers behind figure 2</summary>
<table>
<thead><tr><th>Version</th><th>What is stored</th><th class="num">State bytes at 1,024 leaves</th><th class="num">Witness bytes</th><th>Under attack</th></tr></thead>
<tbody>
<tr><td>Array</td><td>1,024 SHA-256 hashes</td><td class="num">33,126</td><td class="num">36</td><td>Robbed</td></tr>
<tr><td>Merkle</td><td>One Merkle root</td><td class="num">390</td><td class="num">356</td><td>Robbed</td></tr>
<tr><td>XMSS</td><td>Root and public seed</td><td class="num">422</td><td class="num">2,500</td><td>Rejected</td></tr>
</tbody>
</table>
</details>

## Same address, fresh keys

Version three also rotates. A signed rotation installs a fresh tree with a new root at the same address with the same balance, and the old root is refused afterwards. The next tree comes from the same BIP39 seed phrase, so recovery is one instruction.

Rotation matters because XMSS is stateful. Each of the tree's 1,024 leaves is a one-time key, and the vault tracks spent leaves in a bitmap and can burn doubtful ones. So the practical question is how long a tree lasts. The rotation is itself signed by the current tree, so the table keeps one leaf back for it and counts 1,023 withdrawals per tree.

<figure class="tbl" id="key-budget">
<table>
<thead><tr><th class="num">Withdrawals a day</th><th class="num">One tree lasts</th><th class="num">Rotations a year</th></tr></thead>
<tbody>
<tr><td class="num">1</td><td class="num">1,023 days (2.8 years)</td><td class="num">0.4</td></tr>
<tr><td class="num">5</td><td class="num">205 days (6.7 months)</td><td class="num">1.8</td></tr>
<tr><td class="num">20</td><td class="num">51 days (7.3 weeks)</td><td class="num">7.1</td></tr>
<tr><td class="num">100</td><td class="num">10 days</td><td class="num">35.7</td></tr>
</tbody>
</table>
<figcaption><b>One-time key budget.</b> A height-ten tree, 1,024 leaves, one leaf per signed withdrawal and one for the rotation. Burns spend leaves too.</figcaption>
</figure>

<div class="sb-calc" data-sb-calc hidden>
<label for="sb-rate">Your withdrawals a day <input id="sb-rate" type="number" min="1" max="10000" step="1" value="12" inputmode="numeric" data-sb-rate></label>
<output for="sb-rate" data-sb-out aria-live="polite"></output>
</div>

Running out is a maintenance step, not a migration: rotation keeps the address and the balance, so nobody who sends you funds has to change anything.

## One transaction

An XMSS signature is 2,500 bytes. With Solana v1 transactions, which allow 4,096 bytes, it fits in one transaction next to the full canonical intent. Every operation, SOL withdrawal, token withdrawal, leaf burn and root rotation, is one confirmed devnet transaction at roughly half a million compute units. The five-transaction staged path stays available as an explicit fallback.

<figure class="tbl" id="compute">
<table>
<thead><tr><th>XMSS operation</th><th class="num">Complete bytes</th><th class="num">Confirmed CUs</th><th>Share of the 1.4M request</th></tr></thead>
<tbody>
<tr><td>SOL withdrawal</td><td class="num">3,117</td><td class="num">518,509</td><td><span class="sb-bar" style="--w:37.0%"></span>37.0%</td></tr>
<tr><td>Mock USDC withdrawal</td><td class="num">3,214</td><td class="num">532,564</td><td><span class="sb-bar" style="--w:38.0%"></span>38.0%</td></tr>
<tr><td>Burn two target leaves</td><td class="num">3,086</td><td class="num">529,687</td><td><span class="sb-bar" style="--w:37.8%"></span>37.8%</td></tr>
<tr><td>Rotate root and public seed</td><td class="num">3,146</td><td class="num">483,319</td><td><span class="sb-bar" style="--w:34.5%"></span>34.5%</td></tr>
<tr class="sb-sub"><td colspan="4">After rotation, from the new root</td></tr>
<tr><td>SOL withdrawal</td><td class="num">3,117</td><td class="num">506,910</td><td><span class="sb-bar" style="--w:36.2%"></span>36.2%</td></tr>
<tr><td>Mock USDC withdrawal</td><td class="num">3,214</td><td class="num">578,944</td><td><span class="sb-bar" style="--w:41.4%"></span>41.4%</td></tr>
</tbody>
</table>
<figcaption><b>Measured on devnet.</b> One confirmed transaction per operation, a single sample each, with the limits requested inline and enforced on devnet. Each request asks for 1,400,000 CUs.</figcaption>
</figure>

The inline path also drops the plumbing the staged one needs. The two runs used different signatures and fixtures, so read this as a comparison of what each path creates and pays, not a paired benchmark.

<figure class="tbl" id="fees">
<table>
<thead><tr><th>Per operation</th><th>Inline (v1)</th><th>Staged fallback</th></tr></thead>
<tbody>
<tr><td>Transactions</td><td>1</td><td>5</td></tr>
<tr><td>Total bytes</td><td>3,086 to 3,214</td><td>4,470 to 4,726</td></tr>
<tr><td>Witness account</td><td>none</td><td>2,625-byte stage account, 19,160,880 lamports of rent, not refunded</td></tr>
<tr><td>Fees</td><td>5,000 lamports (local runs)</td><td>30,000 lamports</td></tr>
</tbody>
</table>
<figcaption><b>Inline against staged.</b> From the white paper. Inline byte counts are the devnet transactions above.</figcaption>
</figure>

All ten confirmed devnet operations, 225 runtime assertions and every number in the white paper come from one repository and rebuild with one script.

## How the film was made

The film is the white paper with the maths left in and the boredom taken out.

Every scene is a web page captured frame by frame in headless Chrome and assembled with ffmpeg. Liam plays all six parts, the news anchor, the scientist, the average Joe, the bunker engineer, the suit and the bandit devil, as a floating head cut from his own footage and set on a cartoon body. A blueprint fills in as he talks, a whiteboard counts the bytes and the rent, the robbery happens in a rain-soaked speakeasy, and the transaction-size problem becomes an arcade game with its own chiptune score.

<div class="clip-grid sb-stills">
<figure><img src="/img/solana-bunker-film/still-blueprint.jpg" alt="Liam's head on a cartoon scientist in a lab coat, pointing at a blueprint that reads PDA, program derived address, no private key exists." width="1280" height="720" loading="lazy" decoding="async"><figcaption>Bunker. The blueprint draws itself as he talks.</figcaption></figure>
<figure><img src="/img/solana-bunker-film/still-whiteboard.jpg" alt="A whiteboard titled HASHES with a Merkle tree of 1,000 leaves, a 390 bytes tag and two QR codes linking to the code and the devnet proof." width="1280" height="720" loading="lazy" decoding="async"><figcaption>Whiteboard. Version two folds a thousand hashes into one root.</figcaption></figure>
<figure><img src="/img/solana-bunker-film/still-speakeasy.jpg" alt="A black-and-white rainy alley with a stick figure holding a sign reading secret_42, a suited bouncer and a red vault door." width="1280" height="720" loading="lazy" decoding="async"><figcaption>Speakeasy. The password is the whole problem.</figcaption></figure>
<figure><img src="/img/solana-bunker-film/still-arcade.jpg" alt="An arcade cabinet titled Solana Bunker. A 2,500-byte block hits a transaction limit, next to a bunker engineer in a hard hat." width="1280" height="720" loading="lazy" decoding="async"><figcaption>Arcade. Fitting 2,500 bytes into one transaction.</figcaption></figure>
</div>

The music is Suno, from Liam's prompts, generated to a cue sheet: a news bed for the desk, a conspiracy cue for the case file, a workshop cue for the lessons, noir for the alley, a sponsor groove for the infomercial and the credits. The cues are mixed under the voice with ducking timed to the words, so they lift in the gaps between lines and are back down before the next one. The arcade is scored in-house in 8-bit.

Every sound effect is CC0 and credited in the roll. The three news stings are "Mini News Jingle" by code_box, "Minimalist news transition" by xkeril and "Da Da Da Daaa Opening" by Antwash, all from Freesound.org; the stamps, slams, shutters, static and the cash register come from Freesound.org and Kenney.nl. The announcer is Google's Chirp 3 HD voice Enceladus, and the sponsor read is Google's Studio C.

The whole pipeline, capture scripts, cue sheets, mix settings and the scene pages, lives in the repository beside the program it describes.

## Read more

- The repository: [chaintail/solana-bunker](https://github.com/chaintail/solana-bunker). The white paper is `research/whitepaper.md`; the measured results and the acceptance matrix sit next to it.
- The program on devnet: [HssAePJfZrERFjEAhm89nY9Tc9BWAobxp2GqGhefNK6V](https://explorer.solana.com/address/HssAePJfZrERFjEAhm89nY9Tc9BWAobxp2GqGhefNK6V?cluster=devnet), with the [XMSS SOL withdrawal](https://explorer.solana.com/tx/CiZmcGsaX4G7upT1ECscLUr1vVrX1htShX4Q2y8K4wd1hJcsVpfZEQc9GZtod8MxVSmP4Hy6mbVqiM75QiAJdBM?cluster=devnet) and the [root rotation](https://explorer.solana.com/tx/5U4B7zhgQ38cyUztvxUK5tYCJ2uHMweKjePJ14gYJGv2X42mDwWGqWreiQi9KYtYkkoWskS8pykD2Fab8RjML5iy?cluster=devnet) open in the explorer.
- Prior work: [RFC 8391](https://www.rfc-editor.org/rfc/rfc8391) for XMSS, [NIST SP 800-208](https://csrc.nist.gov/pubs/sp/800/208/final) for stateful hash-based signatures, and Dean Little's Solana Winternitz Vault, which authenticates lamport operations with WOTS.

This is a research proof of concept. It assumes correct runtime execution and verifier code, retains an ordinary upgrade authority, and claims no audit, formal verification or production guarantee. Mock USDC is a test token with no value.

<p class="sb-signoff">Product of Chaintail Labs.</p>

<script>
(()=>{const v=document.querySelector('#film video');document.querySelectorAll('.sb-chapters a[data-t]').forEach(a=>a.addEventListener('click',e=>{if(!v)return;e.preventDefault();v.scrollIntoView({behavior:'smooth',block:'center'});try{v.currentTime=parseFloat(a.dataset.t);v.play();}catch(_){}}));
const c=document.querySelector('[data-sb-calc]');if(!c)return;c.hidden=false;const i=c.querySelector('[data-sb-rate]'),o=c.querySelector('[data-sb-out]');
const n=(x,d)=>x.toLocaleString('en-US',{maximumFractionDigits:d});
const span=d=>d>=730?n(d/365,1)+' years':d>=60?n(d/30.44,1)+' months':d>=14?n(d/7,1)+' weeks':n(d,1)+' days';
const f=()=>{const r=parseFloat(i.value);if(!(r>0)){o.textContent='Enter how many withdrawals you sign a day.';return;}const d=1023/r;o.innerHTML='One tree lasts <b>'+span(d)+'</b>, about <b>'+n(365/d,1)+'</b> rotations a year. The address never changes.';};
i.addEventListener('input',f);f();})();
</script>
