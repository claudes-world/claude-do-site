/* ─────────────────────────────────────────────────────────────
   audio-tour.js — listen-along tour for long-form posts.
   Vanilla, no dependencies, safe to include twice (guarded).

   SELECTOR CONTRACT
     [data-audio-tour="<slug>"]         tour root; slug namespaces localStorage
     [data-audio-section]               one per section, in document order,
                                        containing exactly one <audio>
       data-audio-section="4"           optional explicit number (else DOM order)
       data-audio-title="…"            optional label for a11y
     [data-audio-tour-mount]            optional: where the whole-post button goes
                                        (default: before the first section)

   BEHAVIOUR
     · one player at a time      · autoplay chain, never steals scroll
     · directional FAB (top-left when the playing player is above the
       viewport, bottom-left when below) with a progress ring + §number
     · tapping the FAB scrolls the player into the FAB, merges the two,
       settles the player at ~20% from the top, then flashes the section
     · done ticks · resume from localStorage · prefers-reduced-motion aware
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.__audioTourLoaded) return;
  window.__audioTourLoaded = true;

  var SETTLE = 0.20;           // player rests this far down the viewport
  var SCROLL_MS = 820;         // merge choreography duration
  var MERGE_MS = 260;          // FAB dissolve duration (matches CSS)
  var FLASH_MS = 1000;         // section flash hold
  var SAVE_EVERY = 2;          // seconds between resume writes

  function reduced() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
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
        done: false
      });
    }
    if (!sections.length) return;
    root.classList.add('at-tour');

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
        if (sections[n]) { sections[n].done = true; sections[n].row.setAttribute('data-at-done', '1'); }
      });
    }

    /* ── the FAB ─────────────────────────────────────────── */
    var fab = document.createElement('button');
    fab.className = 'at-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Jump to the section that is playing');
    fab.innerHTML =
      '<svg viewBox="0 0 56 56" aria-hidden="true">' +
        '<circle class="at-ring-bg" cx="28" cy="28" r="25.6"></circle>' +
        '<circle class="at-ring-fg" cx="28" cy="28" r="25.6"></circle>' +
      '</svg>' +
      '<span class="at-num">§1</span>' +
      '<span class="at-dir" aria-hidden="true">▾</span>';
    document.body.appendChild(fab);
    var ringFg = fab.querySelector('.at-ring-fg');
    var numEl = fab.querySelector('.at-num');
    var dirEl = fab.querySelector('.at-dir');
    var CIRC = 2 * Math.PI * 25.6;
    ringFg.style.strokeDasharray = CIRC.toFixed(2);
    ringFg.style.strokeDashoffset = CIRC.toFixed(2);

    // keep the top-left FAB clear of any sticky site header
    (function fabTop() {
      var hdr = document.querySelector('header');
      var h = 0;
      if (hdr) {
        var cs = getComputedStyle(hdr);
        if (cs.position === 'sticky' || cs.position === 'fixed') h = hdr.offsetHeight;
      }
      fab.style.setProperty('--at-fab-top', (h + 14) + 'px');
    })();

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

    /* ── single-player rule + chain ──────────────────────── */
    var current = null;

    sections.forEach(function (s) {
      s.audio.addEventListener('play', function () {
        sections.forEach(function (o) {
          if (o !== s && !o.audio.paused) o.audio.pause();
          o.row.removeAttribute('data-at-current');
        });
        current = s;
        s.row.setAttribute('data-at-current', '1');
        if (!flipping) setNum(s);        // a handoff flip owns the number until it lands
        startTick();
        updateFab();
        labelAll();
      });
      s.audio.addEventListener('pause', function () {
        if (current === s) { updateFab(); labelAll(); }
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
        persist();
        var next = sections[s.idx + 1];
        if (!next) { current = null; hideFab(); labelAll(); return; }
        // Start the attention beat BEFORE play(): the 'play' event is queued
        // asynchronously, so this is what keeps the number flip in step with
        // the pulse instead of racing it.
        handoffPulse(next);
        // hand off WITHOUT touching scroll
        var p = next.audio.play();
        if (p && p.catch) p.catch(function () { /* blocked: leave it paused */ });
      });
    });

    var flipping = false;
    function setNum(s) { numEl.textContent = '§' + s.num; }

    function handoffPulse(next) {
      if (reduced()) { setNum(next); return; }
      fab.classList.remove('at-handoff');
      void fab.offsetWidth;                        // restart the animation
      fab.classList.add('at-handoff');
      flipping = true;
      // swap the digits at the flip's midpoint, while the glyph is edge-on
      setTimeout(function () { setNum(next); }, 250);
      setTimeout(function () {
        fab.classList.remove('at-handoff');
        flipping = false;
        setNum(current || next);
      }, 820);
    }

    /* ── progress ring ──────────────────────────────────── */
    var tick = 0;
    function drawRing() {
      if (!current) return;
      var d = current.audio.duration;
      var f = (d && isFinite(d)) ? clamp(current.audio.currentTime / d, 0, 1) : 0;
      ringFg.style.strokeDashoffset = (CIRC * (1 - f)).toFixed(2);
    }
    function startTick() {
      if (tick) return;
      (function loop() {
        tick = 0;
        drawRing();
        if (current && !current.audio.paused) tick = requestAnimationFrame(loop);
      })();
    }

    /* ── visibility → FAB direction ─────────────────────── */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var s = sections.filter(function (x) { return x.row === e.target; })[0];
        if (s) s.visible = e.isIntersecting;
      });
      updateFab();
    }, { threshold: 0 });
    sections.forEach(function (s) { io.observe(s.row); });

    var merging = false;
    var lastMerge = null;
    function hideFab() { fab.classList.remove('at-show'); }

    function updateFab() {
      if (merging) return;
      if (!current || current.audio.paused || current.visible) { hideFab(); return; }
      var r = current.row.getBoundingClientRect();
      var below = r.top >= window.innerHeight * 0.5;
      fab.setAttribute('data-pos', below ? 'below' : 'above');
      dirEl.textContent = below ? '▾' : '▴';
      fab.classList.add('at-show');
    }
    window.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; updateFab(); });
    }, { passive: true });
    var raf = 0;
    window.addEventListener('resize', updateFab, { passive: true });

    /* ── THE MERGE ──────────────────────────────────────── */
    function flashSection(s) {
      s.el.classList.add('at-flash');
      setTimeout(function () { s.el.classList.remove('at-flash'); }, FLASH_MS);
    }

    fab.addEventListener('click', function () {
      if (!current || merging) return;
      var s = current;
      var y0 = window.pageYOffset;
      var rect = s.row.getBoundingClientRect();
      var docTop = rect.top + y0;
      var yT = clamp(docTop - window.innerHeight * SETTLE, 0, maxScroll());

      if (reduced()) {
        merging = true;
        fab.classList.add('at-merging');
        window.scrollTo(0, yT);
        setTimeout(function () { finishMerge(s); }, 120);
        return;
      }

      // Where the FAB sits, and the scroll position at which the player's
      // leading edge physically touches it. Contact is detected against the
      // live scroll offset (not a time fraction) so the dissolve starts on
      // the frame the two shapes meet, whatever the easing is doing.
      var fr = fab.getBoundingClientRect();
      var fabCX = fr.left + fr.width / 2;
      var span = yT - y0;
      var up = span < 0;                       // scrolling up: player enters from the top
      var yContact = up ? (docTop + rect.height - fr.top)   // its bottom edge meets the FAB's top
                        : (docTop - fr.bottom);             // its top edge meets the FAB's bottom
      // keep contact strictly inside the travel, leaving room for the dissolve
      var lo = Math.min(y0, yT), hi = Math.max(y0, yT);
      var guard = Math.abs(span) * 0.06;
      if (!isFinite(yContact) || yContact <= lo + guard || yContact >= hi - guard) {
        yContact = y0 + span * 0.72;
      }

      merging = true;
      var t0 = performance.now();
      var fired = false;

      (function step(now) {
        var p = clamp((now - t0) / SCROLL_MS, 0, 1);
        var y = y0 + span * easeInOut(p);
        window.scrollTo(0, y);

        if (!fired && (up ? y <= yContact : y >= yContact)) {
          fired = true;
          // one continuous motion: the FAB is already touching the player,
          // so it dissolves inward toward the player's centre.
          var pr = s.row.getBoundingClientRect();
          fab.style.setProperty('--at-mx', Math.round((pr.left + pr.width / 2) - fabCX) * 0.55 + 'px');
          fab.style.setProperty('--at-my', '0px');
          fab.classList.add('at-merging');
          s.row.classList.add('at-absorb');
          lastMerge = { at: p, ms: Math.round(now - t0), remainingPx: Math.round(Math.abs(yT - y)) };
          setTimeout(function () { s.row.classList.remove('at-absorb'); }, 460);
        }
        if (p < 1) requestAnimationFrame(step);
        else {
          if (!fired) { fab.classList.add('at-merging'); }
          setTimeout(function () { finishMerge(s); }, MERGE_MS / 2);
        }
      })(t0);
    });

    function finishMerge(s) {
      hideFab();
      fab.classList.remove('at-merging');
      fab.style.removeProperty('--at-mx');
      fab.style.removeProperty('--at-my');
      merging = false;
      flashSection(s);
      updateFab();      // player is in view now → stays hidden
    }

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
    window.addEventListener('pagehide', persist);
    window.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') persist();
    });

    // expose a tiny handle for QA / future posts
    window.audioTour = {
      sections: sections,
      fab: fab,
      play: function (n) { sections[n] && sections[n].audio.play(); },
      state: function () {
        return {
          current: current ? current.num : null,
          playing: !!(current && !current.audio.paused),
          fabVisible: fab.classList.contains('at-show'),
          fabPos: fab.getAttribute('data-pos'),
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
