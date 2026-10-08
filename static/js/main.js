(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── Math ─────────────────────────────────────────────────────────────── */
  if (window.renderMathInElement) {
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false
    });
  }

  /* ── Videos: load lazily, play in view, keep pairs in sync ────────────── */
  // A "group" is a pair card (two clips that should start together) or a
  // single PhyWorld clip.
  function videosOf(group) {
    return Array.prototype.slice.call(group.querySelectorAll("video"));
  }

  function ensureLoaded(video) {
    if (!video.getAttribute("src") && video.dataset.src) {
      video.setAttribute("src", video.dataset.src);
      video.load();
    }
  }

  function whenReady(video) {
    return new Promise(function (resolve) {
      if (video.readyState >= 3) return resolve();
      var done = function () {
        video.removeEventListener("canplay", done);
        video.removeEventListener("error", done);
        resolve();
      };
      video.addEventListener("canplay", done);
      video.addEventListener("error", done);
    });
  }

  function playGroup(group, restart) {
    var vids = videosOf(group);
    vids.forEach(ensureLoaded);
    if (reduceMotion && !group._userStarted) return;
    Promise.all(vids.map(whenReady)).then(function () {
      if (!group._visible && !group._userStarted) return;
      if (restart || !group._started) {
        vids.forEach(function (v) { v.currentTime = 0; });
        group._started = true;
      }
      vids.forEach(function (v) {
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      });
    });
  }

  function pauseGroup(group) {
    videosOf(group).forEach(function (v) { v.pause(); });
  }

  var groups = Array.prototype.slice.call(document.querySelectorAll(".pair, .clip.phy"));

  if (reduceMotion) {
    // No autoplay: show posters with native controls.
    groups.forEach(function (g) {
      videosOf(g).forEach(function (v) { v.controls = true; v.preload = "metadata"; ensureLoaded(v); });
    });
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var g = entry.target;
        g._visible = entry.isIntersecting;
        if (entry.isIntersecting) playGroup(g, false);
        else pauseGroup(g);
      });
    }, { rootMargin: "120px 0px", threshold: 0.15 });
    groups.forEach(function (g) { io.observe(g); });
  } else {
    groups.forEach(function (g) { g._visible = true; playGroup(g, false); });
  }

  // Replay button: restart both clips of a pair together.
  document.querySelectorAll(".pair .replay").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var g = btn.closest(".pair");
      g._userStarted = true;
      playGroup(g, true);
    });
  });

  // Clicking a clip toggles play/pause for its whole group.
  groups.forEach(function (g) {
    videosOf(g).forEach(function (v) {
      v.addEventListener("click", function (e) {
        if (v.controls) return;
        e.preventDefault();
        var anyPlaying = videosOf(g).some(function (x) { return !x.paused; });
        if (anyPlaying) { pauseGroup(g); }
        else { g._userStarted = true; playGroup(g, false); }
      });
    });
  });

  /* ── Tabs (benchmarks, figure views): each tablist switches its own panels ── */
  document.querySelectorAll('[role="tablist"]').forEach(function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));

    function selectTab(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (!panel) return;
        panel.hidden = !on;
        if (!on) panel.querySelectorAll(".pair, .clip.phy").forEach(pauseGroup);
      });
      if (focus) tab.focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { selectTab(tab, false); });
      tab.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === "Home") next = tabs[0];
        else if (e.key === "End") next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); selectTab(next, true); }
      });
    });
  });

  /* ── Example switcher (InfLevel rows) ─────────────────────────────────── */
  document.querySelectorAll("[data-examples]").forEach(function (row) {
    var buttons = Array.prototype.slice.call(row.querySelectorAll(".example-switch button"));
    var pairs = Array.prototype.slice.call(row.querySelectorAll(".pair"));
    buttons.forEach(function (btn, i) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b, j) { b.setAttribute("aria-pressed", j === i ? "true" : "false"); });
        pairs.forEach(function (p, j) {
          var show = j === i;
          if (!show) pauseGroup(p);
          p.hidden = !show;
        });
        // The observer fires for the newly shown pair; start it from the top.
        pairs[i]._started = false;
      });
    });
  });

  /* ── Sticky nav: show after the hero, highlight the current section ──── */
  var nav = document.querySelector(".topnav");
  var hero = document.querySelector(".hero");
  if (nav && hero && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      nav.classList.toggle("is-visible", !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(hero);

    var links = Array.prototype.slice.call(nav.querySelectorAll(".topnav-links a"));
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var link = byId[entry.target.id];
        links.forEach(function (a) { a.classList.toggle("is-active", a === link); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) spy.observe(el);
    });
  } else if (nav) {
    nav.classList.add("is-visible");
  }

  /* ── Copy BibTeX ──────────────────────────────────────────────────────── */
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var src = document.querySelector(btn.getAttribute("data-copy"));
      if (!src) return;
      var text = src.textContent;
      var done = function () {
        btn.textContent = "Copied";
        setTimeout(function () { btn.textContent = "Copy"; }, 1600);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
      function fallback() {
        var range = document.createRange();
        range.selectNodeContents(src);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        try { document.execCommand("copy"); done(); } catch (e) { /* text stays selected */ }
      }
    });
  });
})();
