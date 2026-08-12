/* ─────────────────────────────────────────────────────────────
   audio-tour.js — listen-along tour for long-form posts.
   Vanilla, no dependencies, safe to include twice (guarded).

   SELECTOR CONTRACT
     [data-audio-tour="<slug>"]         tour root; slug namespaces localStorage
     [data-audio-section]               one per section, in document order,
                                        containing exactly one <audio>
       data-audio-section="4"           optional explicit number (else DOM order)
       data-audio-title="…"            optional label for a11y (drives the
                                        floating core's aria-label)
     [data-audio-tour-mount]            optional: where the whole-post button goes
                                        (default: before the first section)

   BEHAVIOUR
     · one player at a time      · autoplay chain, never steals scroll
     · every player card carries its own progress ring + §number (the "core")
       and fills with a soft progress wash as the section plays
     · ONE OBJECT, TWO STATES: when the playing card scrolls off-screen its own
       core element is re-parented into a fixed "morph shell" whose geometry is
       interpolated from the card's rectangle to a circle at the floating
       anchor. Progress is driven by how far the card is off-screen, so
       scrubbing the scroll scrubs the morph. A decaying spring settles it when
       the morph completes.
     · scrolling the card back — by hand or by tapping the core — runs the same
       morph in reverse: the circle stretches back into the card and the core
       lands in its slot at the exact frame the card reaches the viewport edge.
     · done ticks · resume from localStorage · prefers-reduced-motion aware
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.__audioTourLoaded) return;
  window.__audioTourLoaded = true;

  var SETTLE = 0.20;           // player rests this far down the viewport
  var SCROLL_MS = 820;         // tap-to-merge scroll duration
  var FLASH_MS = 1000;         // section flash hold
  var SAVE_EVERY = 2;          // seconds between resume writes
  var RANGE = 220;             // px of occlusion past the content edge = full morph (Liam: doubled back from 110 after feel-test)
  var RUN_FRAC = 0.85;         // …but never more than this share of the card's own
                               // height: the FAB is what is LEFT of the player, so
                               // it must be fully formed while the card still has
                               // rect left to give.
  var RUN_MIN = 48;            // floor, for a very short card
  var CORE = 56;               // the core's SVG viewBox; the real box is measured
  var SPRING_MS = 520;         // overshoot/settle when the morph completes
  var LIVE_AT = 0.32;          // morph progress at which the shell is tappable

  var CIRC = 2 * Math.PI * 25.6;

  function reduced() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  // smoothstep: the shape eases in and out of the travel without ever
  // reversing, so the morph stays monotonic in the scroll offset.
  function smooth(t) { return t * t * (3 - 2 * t); }
  function maxScroll() {
    return Math.max(0, (document.documentElement.scrollHeight || 0) - window.innerHeight);
  }

  function init(root) {
    var slug = root.getAttribute('data-audio-tour') || 'post';
    var KEY = 'audio-tour:' + slug;
    var nodes = root.querySelectorAll('[data-audio-section]');
    var sections = [];
    var i;

    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var audio = el.querySelector('audio');
      if (!audio) continue;
      var num = parseInt(el.getAttribute('data-audio-section'), 10);
      sections.push({
        el: el,
        audio: audio,
        row: audio.closest('.listen') || audio.parentElement || el,
        num: isFinite(num) && num > 0 ? num : sections.length + 1,
        title: el.getAttribute('data-audio-title') || ('Section ' + (sections.length + 1)),
        idx: sections.length,
        visible: true,
        done: false,
        metrics: null
      });
    }
    if (!sections.length) return;
    root.classList.add('at-tour');

    /* ── the core, one per card ──────────────────────────────
       The ring and the §number are part of the player card. The playing
       card's core is the same node that later floats — nothing is cloned. */
    sections.forEach(function (s) {
      var slot = document.createElement('span');
      slot.className = 'at-slot';
      var core = document.createElement('span');
      core.className = 'at-core';
      core.innerHTML =
        '<svg viewBox="0 0 56 56" aria-hidden="true">' +
          '<circle class="at-ring-bg" cx="28" cy="28" r="25.6"></circle>' +
          '<circle class="at-ring-fg" cx="28" cy="28" r="25.6"></circle>' +
        '</svg>' +
        '<span class="at-num">§' + s.num + '</span>' +
        '<span class="at-dir" aria-hidden="true">▾</span>';
      slot.appendChild(core);
      s.row.insertBefore(slot, s.row.firstChild);
      s.slot = slot;
      s.core = core;
      s.ringFg = core.querySelector('.at-ring-fg');
      s.dirEl = core.querySelector('.at-dir');
      s.ringFg.style.strokeDasharray = CIRC.toFixed(2);
      s.ringFg.style.strokeDashoffset = CIRC.toFixed(2);
      s.row.style.setProperty('--at-prog', '0');
    });

    /* ── persistence ─────────────────────────────────────── */
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
    if (!saved || typeof saved !== 'object') saved = null;

    function persist() {
      try {
        localStorage.setItem(KEY, JSON.stringify({
          idx: current ? current.idx : (saved && saved.idx) || 0,
          t: current ? Math.floor(current.audio.currentTime) : (saved && saved.t) || 0,
          done: sections.filter(function (s) { return s.done; })
                        .map(function (s) { return s.idx; })
        }));
      } catch (e) { /* private mode — resume is a nicety, not a requirement */ }
    }
    if (saved && saved.done && saved.done.length) {
      saved.done.forEach(function (n) {
        var s = sections[n];
        if (!s) return;
        s.done = true;
        s.row.setAttribute('data-at-done', '1');
        s.row.style.setProperty('--at-prog', '1');
        s.ringFg.style.strokeDashoffset = '0';
      });
    }

    /* ── the morph shell: the card's silhouette, compressed ── */
    var shell = document.createElement('button');
    shell.className = 'at-morph';
    shell.type = 'button';
    shell.setAttribute('data-pos', 'below');
    shell.setAttribute('aria-hidden', 'true');
    shell.tabIndex = -1;
    shell.innerHTML =
      '<span class="at-morph-shadow"></span>' +
      '<span class="at-morph-glow"></span>' +
      '<span class="at-morph-clip">' +
        '<span class="at-morph-face"></span>' +
        '<span class="at-morph-wash"></span>' +
        '<span class="at-morph-ghost">' +
          '<span class="at-ghost-label"></span><span class="at-ghost-ctl"></span>' +
        '</span>' +
      '</span>';
    document.body.appendChild(shell);
    var shadowEl = shell.querySelector('.at-morph-shadow');
    var glowEl = shell.querySelector('.at-morph-glow');
    var faceEl = shell.querySelector('.at-morph-face');
    var washEl = shell.querySelector('.at-morph-wash');
    var ghostEl = shell.querySelector('.at-morph-ghost');
    var gLabel = shell.querySelector('.at-ghost-label');
    var gCtl = shell.querySelector('.at-ghost-ctl');

    // the resting geometry of the floating core, owned by CSS and measured
    var anchor = document.createElement('div');
    anchor.className = 'at-anchor';
    anchor.setAttribute('data-pos', 'below');
    anchor.setAttribute('aria-hidden', 'true');
    document.body.appendChild(anchor);

    /* ── THE CONTENT BAND: one coordinate space ───────────────
       Everything the morph touches — the card's rect, the shell's fixed
       transform, the anchor's resting offset — is resolved in client
       (layout-viewport) px, the space getBoundingClientRect reports in.
       The band is the strip of that space you can actually SEE and that
       nothing is drawn over: from the sticky header's bottom edge down to
       the visible bottom. The visual viewport is folded in so a webview
       with an expanded unsafe region (iOS in-app browsers) resolves to the
       real visible box instead of the layout one. */
    var hdrEl = null, hdrPinned = false;
    function findHeader() {
      hdrEl = document.querySelector('header');
      hdrPinned = false;
      if (hdrEl) {
        var cs = getComputedStyle(hdrEl);
        hdrPinned = (cs.position === 'sticky' || cs.position === 'fixed');
      }
    }
    findHeader();

    function band() {
      var vv = window.visualViewport;
      var vTop = vv ? vv.offsetTop : 0;
      var vBot = vv ? (vv.offsetTop + vv.height) : (window.innerHeight || 1);
      var top = vTop;
      if (hdrPinned && hdrEl) {
        var hr = hdrEl.getBoundingClientRect();
        if (hr.bottom > top && hr.top < vBot) top = hr.bottom;
      }
      return { top: top, bottom: Math.max(top + 1, vBot) };
    }
    // CSS still owns the spacing; the band owns which edge it is measured from.
    function fabGap() {
      var g = parseFloat(getComputedStyle(anchor).getPropertyValue('--at-fab-gap'));
      return isFinite(g) ? g : 14;
    }
    function placeAnchor(b, side) {
      var g = fabGap();
      var ah = anchor.offsetHeight || CORE;
      var y = side === 'above' ? (b.top + g) : (b.bottom - g - ah);
      anchor.style.setProperty('--at-fab-y', y.toFixed(1) + 'px');
    }
    placeAnchor(band(), 'below');

    /* ── whole-post button ───────────────────────────────── */
    var allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'at-all';
    allBtn.innerHTML = '<span class="at-all-ico" aria-hidden="true"></span><span class="at-all-txt"></span>';
    var allTxt = allBtn.querySelector('.at-all-txt');
    var bar = document.createElement('div');
    bar.className = 'at-bar';
    bar.appendChild(allBtn);
    var hint = document.createElement('span');
    hint.className = 'at-hint';
    hint.textContent = sections.length + ' sections · plays straight through';
    bar.appendChild(hint);

    var mount = root.querySelector('[data-audio-tour-mount]');
    if (mount) mount.appendChild(bar);
    else sections[0].el.parentNode.insertBefore(bar, sections[0].el);

    function labelAll() {
      if (current && !current.audio.paused) {
        allBtn.setAttribute('data-state', 'playing');
        allTxt.textContent = 'Pause §' + current.num;
        return;
      }
      allBtn.removeAttribute('data-state');
      var r = resumePoint();
      allTxt.textContent = r ? ('Resume from §' + sections[r.idx].num)
                             : 'Listen to the whole post';
    }
    function resumePoint() {
      if (!saved || typeof saved.idx !== 'number' || !sections[saved.idx]) return null;
      if (saved.idx === 0 && (!saved.t || saved.t < 5)) return null;
      return saved;
    }

    /* ── card measurements (once per card, refreshed on resize) ──
       Everything is read against `.listen`, which is the offsetParent of the
       slot, the label and the <audio>, so the ghost lands exactly where the
       card's own contents are. */
    function measureCard(s) {
      var label = s.row.querySelector('.label');
      var au = s.audio;
      var m = {
        slotLeft: s.slot.offsetLeft,
        slotTop: s.slot.offsetTop,
        slotW: s.slot.offsetWidth || 40,
        slotH: s.slot.offsetHeight || 40,
        // the core's own untransformed box — NOT the SVG viewBox. The phone
        // media query shrinks --at-fab-size, so a hardcoded 56 here is what
        // left the ring off-centre in the shell on mobile.
        coreBox: s.core.offsetWidth || CORE,
        labLeft: label ? label.offsetLeft : s.slot.offsetLeft + s.slot.offsetWidth + 12,
        labTop: label ? label.offsetTop : 0,
        labH: label ? label.offsetHeight : 14,
        labTxt: label ? label.textContent : 'Listen along',
        auLeft: au.offsetLeft, auTop: au.offsetTop,
        auW: au.offsetWidth, auH: au.offsetHeight
      };
      s.metrics = m;
      return m;
    }
    function forget() { sections.forEach(function (s) { s.metrics = null; }); }

    /* ── single-player rule + chain ──────────────────────── */
    var current = null;

    sections.forEach(function (s) {
      s.audio.addEventListener('play', function () {
        sections.forEach(function (o) {
          if (o !== s && !o.audio.paused) o.audio.pause();
          o.row.removeAttribute('data-at-current');
        });
        handing = false;
        current = s;
        s.row.setAttribute('data-at-current', '1');
        startTick();
        schedule();
        labelAll();
      });
      s.audio.addEventListener('pause', function () {
        if (current === s) { schedule(); labelAll(); }
      });
      s.audio.addEventListener('timeupdate', function () {
        if (current === s) {
          drawRing();
          if (Math.floor(s.audio.currentTime) % SAVE_EVERY === 0) persist();
        }
      });
      s.audio.addEventListener('ended', function () {
        s.done = true;
        s.row.setAttribute('data-at-done', '1');
        s.row.removeAttribute('data-at-current');
        s.row.style.setProperty('--at-prog', '1');
        s.ringFg.style.strokeDashoffset = '0';
        persist();
        var next = sections[s.idx + 1];
        if (!next) { current = null; handing = false; deactivate(); labelAll(); return; }
        // Hold the floating state open across the gap. 'ended' leaves the old
        // audio paused, and without this the shell would tear down and rebuild
        // itself between the two sections — a one-frame blink, and the pulse
        // would be wiped with it.
        handing = true;
        setTimeout(function () {                 // play() refused: let it settle
          if (handing) { handing = false; schedule(); }
        }, 900);
        // Start the attention beat BEFORE play(): the 'play' event is queued
        // asynchronously, so this keeps the pulse in step with the handoff
        // instead of racing it.
        handoffPulse();
        // hand off WITHOUT touching scroll
        var p = next.audio.play();
        if (p && p.catch) p.catch(function () { /* blocked: leave it paused */ });
      });
    });

    function handoffPulse() {
      if (reduced() || !shown) return;
      shell.classList.remove('at-handoff');
      void shell.offsetWidth;                      // restart the animation
      shell.classList.add('at-handoff');
      setTimeout(function () { shell.classList.remove('at-handoff'); }, 820);
    }

    /* ── progress: the ring AND the card's wash ─────────── */
    var tick = 0;
    function drawRing() {
      if (!current) return;
      var s = current;
      var d = s.audio.duration;
      var f = (d && isFinite(d)) ? clamp(s.audio.currentTime / d, 0, 1) : 0;
      s.ringFg.style.strokeDashoffset = (CIRC * (1 - f)).toFixed(2);
      s.row.style.setProperty('--at-prog', f.toFixed(4));
      washEl.style.setProperty('--at-prog', f.toFixed(4));
    }
    function startTick() {
      if (tick) return;
      (function loop(now) {
        tick = 0;
        drawRing();
        update(now || performance.now());   // one measure + one write per frame
        if (current && !current.audio.paused) tick = requestAnimationFrame(loop);
      })();
    }

    /* ── visibility (kept for QA state + as a cheap scheduler) ─ */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var s = sections.filter(function (x) { return x.row === e.target; })[0];
        if (s) s.visible = e.isIntersecting;
      });
      schedule();
    }, { threshold: 0 });
    sections.forEach(function (s) { io.observe(s.row); });

    /* ── THE MORPH ───────────────────────────────────────── */
    var pending = 0;        // scheduled rAF
    var handing = false;    // mid-chain-handoff: keep the floating state alive
    var morphP = 0;         // 0 = card, 1 = floating core
    var shown = false, live = false;
    var host = null;        // the section whose core currently sits in the shell
    var sideLock = null;    // hold the side steady through a tap-merge
    var springT0 = 0, springDir = 1, wasFull = false;
    var merging = false, lastMerge = null;

    function schedule() {
      if (pending) return;
      pending = requestAnimationFrame(function (t) { pending = 0; update(t); });
    }

    function adopt(s) {
      if (host === s) return;
      var handoff = shown && !!host && !reduced();
      release();
      shell.appendChild(s.core);              // the SAME node, re-parented
      host = s;
      if (handoff) {
        // the shell stays put and the number arrives with a flip, so a chain
        // advance is revealed rather than snapped
        s.core.classList.remove('at-enter');
        void s.core.offsetWidth;
        s.core.classList.add('at-enter');
        setTimeout(function () { s.core.classList.remove('at-enter'); }, 520);
      }
      shell.setAttribute('aria-label', 'Jump to §' + s.num + ': ' + s.title);
      applyGhost(s.metrics || measureCard(s));
    }
    function applyGhost(m) {
      gLabel.textContent = m.labTxt;
      gLabel.style.left = m.labLeft + 'px';
      gLabel.style.top = m.labTop + 'px';
      gLabel.style.height = m.labH + 'px';
      gCtl.style.left = m.auLeft + 'px';
      gCtl.style.top = m.auTop + 'px';
      gCtl.style.width = m.auW + 'px';
      gCtl.style.height = m.auH + 'px';
    }
    function release() {
      if (!host) return;
      host.row.style.setProperty('--at-shed', '0');   // the card is whole again
      host.core.style.transform = '';          // back to the CSS card scale
      host.core.classList.remove('at-enter');
      host.slot.appendChild(host.core);
      host = null;
    }

    function update(now) {
      var s = current;
      // `paused` flips to true the instant playback reaches the end, a frame or
      // two BEFORE the 'ended' event that starts the handoff — tearing down on
      // that frame is what would blink the floating state between sections.
      if (!s || (s.audio.paused && !handing && !s.audio.ended)) { deactivate(); return; }

      var b = band();
      var cr = s.row.getBoundingClientRect();
      // OCCLUSION, not off-screen distance. The horizon is the band's edge:
      // above, the instant the card's top slips under the header's bottom;
      // below, the instant the card's bottom passes the visible bottom. Either
      // is 0 the frame the card is tangent to that edge — exactly where the
      // card and the shell coincide.
      var offAbove = b.top - cr.top;
      var offBelow = cr.bottom - b.bottom;
      var above = offAbove >= offBelow;
      var off = above ? offAbove : offBelow;
      if (off <= 0) {
        // they have become one again. A hand-scrolled return gets the same
        // beat the tapped merge gets; the merge's own step() owns its pop.
        var rejoined = morphP > 0.45 && !merging && !reduced();
        deactivate();
        if (rejoined) absorb(s);
        return;
      }

      var side = sideLock || (above ? 'above' : 'below');
      if (anchor.getAttribute('data-pos') !== side) {
        anchor.setAttribute('data-pos', side);
        shell.setAttribute('data-pos', side);
      }
      var caret = side === 'below' ? '▾' : '▴';
      if (s.dirEl.textContent !== caret) s.dirEl.textContent = caret;

      adopt(s);
      var m = s.metrics || measureCard(s);
      placeAnchor(b, side);
      var ar = anchor.getBoundingClientRect();
      var soft = reduced();
      // the runway is capped by the card's own height, so the transformation
      // finishes while there is still card left rather than after it is gone
      var run = Math.max(RUN_MIN, Math.min(RANGE, cr.height * RUN_FRAC));
      var p = soft ? 1 : smooth(clamp(off / run, 0, 1));
      morphP = p;

      /* the "breaks free" beat: a decaying spring the frame the morph lands */
      if (!soft && !merging && p > 0.999 && !wasFull) {
        wasFull = true; springT0 = now; springDir = side === 'below' ? 1 : -1;
      }
      if (p < 0.985) { wasFull = false; springT0 = 0; }
      var sc = 1, sy = 0;
      if (springT0) {
        var st = (now - springT0) / SPRING_MS;
        if (st >= 1) { springT0 = 0; }
        else {
          var e = Math.exp(-5.4 * st) * Math.sin(st * Math.PI * 2.6);
          sc = 1 + 0.08 * e;
          sy = springDir * 7 * e;
          schedule();                        // keep the spring's frames coming
        }
      }

      var cb = m.coreBox || CORE;
      var x, y, w, h, rad, k;
      if (soft) {
        x = ar.left; y = ar.top; w = ar.width; h = ar.height;
        rad = ar.width / 2; k = ar.width / cb;
      } else {
        // Travel runs ahead of the compression, so the silhouette does its
        // shedding where you can actually watch it rather than at the edge.
        var pT = 1 - Math.pow(1 - p, 1.85);
        x = lerp(cr.left, ar.left, pT);
        y = lerp(cr.top, ar.top, pT);
        w = lerp(cr.width, ar.width, p);
        h = lerp(cr.height, ar.height, p);
        // the corner resolves slightly ahead of the size, so the silhouette
        // passes through a stadium on its way to the circle
        rad = Math.min(lerp(8, ar.width / 2, clamp(p * 1.18, 0, 1)), Math.min(w, h) / 2);
        k = lerp(m.slotW / cb, ar.width / cb, p);
      }

      /* The shell lives INSIDE the band at every p. It is what is left of the
         player, so it never slides under the header or off the bottom — as the
         card is occluded the silhouette's edge pins to the band and the rest of
         the morph is the shrink. The clamp is a no-op at p = 0, where the card
         is tangent to the band by definition, so card and shell still coincide. */
      var pad = h * Math.max(0, sc - 1) / 2;        // the spring's own overshoot
      var yLo = b.top + pad;
      var yHi = Math.max(yLo, b.bottom - h - pad);
      var yv = clamp(y + sy, yLo, yHi);

      shell.style.width = w.toFixed(1) + 'px';
      shell.style.height = h.toFixed(1) + 'px';
      shell.style.borderRadius = rad.toFixed(1) + 'px';
      shell.style.transform =
        'translate3d(' + x.toFixed(1) + 'px,' + yv.toFixed(1) + 'px,0) scale(' + sc.toFixed(4) + ')';

      /* Concentricity by construction. In the shell the core is pinned to
         50%/50% with its own centre as the transform origin, so
         translate(-50%,-50%) lands its centre on the shell's centre for ANY
         scale, in any engine — no measured box sizes, nothing to drift. All the
         morph supplies is a centre-to-centre offset that decays to exactly 0. */
      var dx = soft ? 0 : lerp(m.slotLeft + m.slotW / 2 - w / 2, 0, p);
      var dy = soft ? 0 : lerp(m.slotTop + m.slotH / 2 - h / 2, 0, p);
      s.core.style.transform =
        'translate(-50%,-50%) translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px)' +
        ' scale(' + k.toFixed(4) + ')';

      /* What the card sheds on the way down to its core — including the card
         ITSELF. The horizon is now the header's edge rather than the viewport's,
         so the shell starts shrinking while the real row is still on screen
         below the header: without this the player would be visible twice, the
         silhouette and the sliver it left behind. The row rides the ghost's own
         curve, so the thing you are watching stays one object. */
      var shed = soft ? 1 : clamp(p / 0.42, 0, 1);
      s.row.style.setProperty('--at-shed', shed.toFixed(3));
      ghostEl.style.opacity = (1 - shed).toFixed(3);
      washEl.style.opacity = soft ? '0' : clamp(1 - p / 0.62, 0, 1).toFixed(3);
      shadowEl.style.opacity = soft ? '0' : (1 - p).toFixed(3);
      glowEl.style.opacity = soft ? '1' : p.toFixed(3);
      faceEl.style.setProperty('--at-face2', soft ? '1' : p.toFixed(3));

      if (!shown) { shown = true; shell.classList.add('at-show'); }
      var wantLive = soft || p >= LIVE_AT;
      if (wantLive !== live) {
        live = wantLive;
        shell.classList.toggle('at-live', live);
        shell.tabIndex = live ? 0 : -1;
        if (live) shell.removeAttribute('aria-hidden');
        else shell.setAttribute('aria-hidden', 'true');
      }
    }

    function deactivate() {
      morphP = 0; springT0 = 0; wasFull = false;
      if (shown) {
        shown = false; live = false;
        shell.classList.remove('at-show', 'at-live', 'at-handoff');
        shell.tabIndex = -1;
        shell.setAttribute('aria-hidden', 'true');
        if (document.activeElement === shell) shell.blur();
      }
      release();
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', function () {
      forget();
      findHeader();                              // the header may have unstuck
      if (host) applyGhost(measureCard(host));   // the card may have re-wrapped
      schedule();
    }, { passive: true });
    // a webview whose visible box changes (chrome collapsing, unsafe region
    // resolving, pinch) moves the band without moving the scroll
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', schedule);
      window.visualViewport.addEventListener('scroll', schedule);
    }

    /* ── THE MERGE: the same morph, run backwards ─────────
       Tapping the floating core scrolls the card back to its settle depth.
       The morph is scroll-coupled, so the circle stretches back into the
       rectangle on its own and the core lands in its slot at the frame the
       card touches the viewport edge. Nothing here animates the shape. */
    function flashSection(s) {
      s.el.classList.add('at-flash');
      setTimeout(function () { s.el.classList.remove('at-flash'); }, FLASH_MS);
    }
    function absorb(s) {
      s.row.classList.add('at-absorb');
      setTimeout(function () { s.row.classList.remove('at-absorb'); }, 460);
    }

    shell.addEventListener('click', function () {
      if (!current || merging || morphP < 0.2) return;
      var s = current;
      var y0 = window.pageYOffset;
      // settle depth is measured inside the band, so the card lands clear of
      // the header rather than under it
      var b0 = band();
      var yT = clamp(s.row.getBoundingClientRect().top + y0 -
                     (b0.top + (b0.bottom - b0.top) * SETTLE),
                     0, maxScroll());
      sideLock = shell.getAttribute('data-pos');

      if (reduced()) {
        window.scrollTo(0, yT);
        sideLock = null;
        deactivate();
        flashSection(s);
        lastMerge = { reduced: true, ms: 0, at: 1 };
        return;
      }

      merging = true; springT0 = 0; wasFull = false;
      var t0 = performance.now();
      var span = yT - y0;
      var landed = false;

      (function step(now) {
        var t = clamp((now - t0) / SCROLL_MS, 0, 1);
        window.scrollTo(0, y0 + span * easeInOut(t));
        update(now);
        if (!landed && morphP <= 0.02) {
          landed = true;
          absorb(s);                       // the instant they become one
          lastMerge = { at: t, ms: Math.round(now - t0), remainingPx: Math.round(Math.abs(yT - window.pageYOffset)) };
        }
        if (t < 1) requestAnimationFrame(step);
        else {
          merging = false; sideLock = null;
          if (!landed) { absorb(s); lastMerge = { at: 1, ms: SCROLL_MS, remainingPx: 0 }; }
          flashSection(s);
          update(performance.now());
        }
      })(t0);
    });

    /* ── whole-post / resume ────────────────────────────── */
    allBtn.addEventListener('click', function () {
      if (current && !current.audio.paused) { current.audio.pause(); labelAll(); return; }
      var r = resumePoint();
      var s = r ? sections[r.idx] : sections[0];
      if (r && r.t) { try { s.audio.currentTime = r.t; } catch (e) {} }
      saved = null;                    // consumed
      var p = s.audio.play();
      if (p && p.catch) p.catch(function () {});
    });

    labelAll();
    /* Pin the button to its widest possible label so toggling
       play/pause never changes its width — a narrower "Pause §N"
       otherwise lets the hint reflow onto the button's line and the
       page jumps on every toggle. */
    (function lockAllWidth() {
      var keep = allTxt.textContent, maxN = sections[sections.length - 1].num;
      var widest = 0;
      ['Listen to the whole post', 'Resume from §' + maxN, 'Pause §' + maxN]
        .forEach(function (t) {
          allTxt.textContent = t;
          widest = Math.max(widest, allBtn.offsetWidth);
        });
      allTxt.textContent = keep;
      if (widest) allBtn.style.minWidth = Math.ceil(widest) + 'px';
    })();
    window.addEventListener('pagehide', persist);
    window.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') persist();
    });

    // expose a tiny handle for QA / future posts
    window.audioTour = {
      sections: sections,
      fab: shell,                       // the morph shell IS the floating core
      shell: shell,
      anchor: anchor,
      play: function (n) { sections[n] && sections[n].audio.play(); },
      band: band,
      header: function () { return hdrPinned ? hdrEl : null; },
      runway: function () {
        if (!current) return null;
        var ch = current.row.getBoundingClientRect().height;
        return Math.max(RUN_MIN, Math.min(RANGE, ch * RUN_FRAC));
      },
      // |shellCentre − coreCentre|, borders included. The morph centres the core
      // by construction, so this is 0 at rest in every engine; the harness
      // asserts it permanently because a per-engine drift here is invisible
      // until it is a visibly off-centre FAB.
      concentricity: function () {
        if (!host) return null;
        var a = shell.getBoundingClientRect(), c = host.core.getBoundingClientRect();
        return Math.max(Math.abs((a.left + a.right) / 2 - (c.left + c.right) / 2),
                        Math.abs((a.top + a.bottom) / 2 - (c.top + c.bottom) / 2));
      },
      state: function () {
        return {
          current: current ? current.num : null,
          playing: !!(current && !current.audio.paused),
          morph: Math.round(morphP * 1000) / 1000,
          coreInShell: !!host,
          fabVisible: shown && morphP > 0.5,
          shellShown: shown,
          interactive: live,
          fabPos: shell.getAttribute('data-pos'),
          ariaLabel: shell.getAttribute('aria-label'),
          done: sections.filter(function (s) { return s.done; }).map(function (s) { return s.num; }),
          lastMerge: lastMerge
        };
      }
    };
  }

  function boot() {
    var roots = document.querySelectorAll('[data-audio-tour]');
    for (var i = 0; i < roots.length; i++) init(roots[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
