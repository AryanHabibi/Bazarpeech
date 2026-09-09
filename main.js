/* ==========================================================================
   BazarPeech — interaction & motion
   Meaning first: every section is fully readable with this file disabled.
   This only adds: header state, mobile menu, meeting dialog, and restrained
   reveal / count-up / draw animations that respect prefers-reduced-motion.
   ========================================================================== */
"use strict";
(function () {
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------------------------------------------------------------- header */
  const header = $("#site-header");
  const setScrolled = () => header.toggleAttribute("data-scrolled", scrollY > 8);
  addEventListener("scroll", setScrolled, { passive: true });
  setScrolled();

  /* ------------------------------------------------------------ mobile nav */
  const toggle = $("#menu-toggle");
  const menu = $("#mobile-menu");
  function closeMenu() {
    menu.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
  }
  function openMenu() {
    menu.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
  }
  toggle.addEventListener("click", () =>
    toggle.getAttribute("aria-expanded") === "true" ? closeMenu() : openMenu());
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) closeMenu(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) closeMenu(); });
  const mq = matchMedia("(min-width: 1001px)");
  mq.addEventListener("change", (e) => { if (e.matches) closeMenu(); });

  /* --------------------------------------------------------------- footer year */
  $("#year").textContent = new Date().getFullYear();

  /* =====================================================================
     REVEAL / STAGED ANIMATIONS  (IntersectionObserver, once each)
     ===================================================================== */
  function onceInView(el, cb, ratio = 0.25) {
    if (REDUCE || !("IntersectionObserver" in window)) { cb(); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { cb(); io.disconnect(); }
      });
    }, { threshold: ratio });
    io.observe(el);
  }

  /* generic .reveal fade/slide */
  if (REDUCE || !("IntersectionObserver" in window)) {
    $$(".reveal").forEach((el) => el.classList.add("is-in"));
  } else {
    const revIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); revIO.unobserve(en.target); }
      });
    }, { threshold: 0.2 });
    $$(".reveal").forEach((el) => revIO.observe(el));
  }

  /* easing + number helpers */
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  function animateNumber(el, to, { decimals = 0, prefix = "", suffix = "", dur = 900 }) {
    if (REDUCE) { el.textContent = prefix + fmt(to, decimals) + suffix; return; }
    const from = 0, t0 = performance.now();
    (function tick(now) {
      const k = Math.min((now - t0) / dur, 1);
      const v = from + (to - from) * easeOut(k);
      el.textContent = prefix + fmt(v, decimals) + suffix;
      if (k < 1) requestAnimationFrame(tick);
      else el.textContent = prefix + fmt(to, decimals) + suffix;
    })(t0);
  }
  function fmt(v, d) {
    const n = d ? v.toFixed(d) : Math.round(v);
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  /* =====================================================================
     03 · THE JOURNEY OF A POSITION
     Scroll drives progress 0..3 across three acts:
       0-1  trend recognition — candles draw in, each scored
       1-2  trigger signal — a trend-aligned bull bar fires; entry/SL/TP placed
       2-3  money management — size is calculated, order opens, runs to target
     Pure function of progress, so it scrubs both ways. Reduced-motion / small
     screens get the finished composite instead of the scrub.
     ===================================================================== */
  const jSection = $("#trend");
  if (jSection && window.BZP && BZP.journey) {
    const J = BZP.journey;
    const CLOSES = J.closes, SCORES = J.scores, N = CLOSES.length, TRIG = J.triggerIndex;
    const E = J.levels.entry, S = J.levels.sl, T = J.levels.tp;
    const MM = J.money;

    /* real closes -> OHLC bars [o,h,l,c,score] (open = previous close) */
    let jseed = 97;
    const jr = () => { jseed ^= jseed << 13; jseed >>>= 0; jseed ^= jseed >> 17; jseed ^= jseed << 5; jseed >>>= 0; return jseed / 4294967296; };
    const BARS = CLOSES.map((c, i) => {
      const o = i === 0 ? c - (CLOSES[1] - CLOSES[0]) * 0.4 : CLOSES[i - 1];
      const rng = Math.max(Math.abs(c - o), c * 0.003) * (0.5 + jr() * 1.3);
      return [o, Math.max(o, c) + jr() * rng, Math.min(o, c) - jr() * rng, c, SCORES[i]];
    });

    /* geometry */
    const PX0 = 44, PX1 = 632, SBt = 10, SBb = 38, PYt = 54, PYb = 286;
    const slot = (PX1 - PX0) / N;
    const bw = Math.max(3, slot * 0.62);
    const xAt = (k) => PX0 + (k + 0.5) * slot;
    let lo = Infinity, hi = -Infinity;
    BARS.forEach((b) => { lo = Math.min(lo, b[2]); hi = Math.max(hi, b[1]); });
    lo = Math.min(lo, S); hi = Math.max(hi, T);
    const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    const yP = (v) => PYb - (v - lo) / (hi - lo) * (PYb - PYt);
    const yScore = (s) => SBt + (1 - s) * (SBb - SBt);
    const sCol = (s) => (s >= 0.62 ? "#34E8A5" : s <= 0.38 ? "#FF5C7A" : "#EAB308");

    const inner = $(".journey__inner", jSection);
    const svg = $("#jchart"),
          gCand = $("#j-candles"), gScore = $("#j-scores"), gLvl = $("#j-levels"),
          gZone = $("#j-zones"), gTrig = $("#j-trigger");
    const ebEl = $("#j-eyebrow"), bodyEl = $("#j-body"), stEl = $("#j-state"),
          subEl = $("#j-sub"), labEl = $("#j-chart-label"),
          steps = [$("#j-step-1"), $("#j-step-2"), $("#j-step-3")],
          panels = [$("#jp-trend"), $("#jp-trigger"), $("#jp-money")],
          jtScore = $("#jt-score"), jtState = $("#jt-state"),
          pipeSteps = $$(".pipe__step", $("#j-pipe")),
          mmSize = $("#mm-size");

    /* fill the illustrative values once, from data */
    $("#jg-entry").textContent = E; $("#jg-sl").textContent = S; $("#jg-tp").textContent = T;
    $("#jg-type").textContent = J.signalType;
    $("#mm-equity").textContent = MM.equity; $("#mm-risk").textContent = MM.riskLine;
    $("#mm-stop").textContent = MM.stopLine; $("#mm-perlot").textContent = MM.perLotLine;
    mmSize.textContent = MM.size;

    const COPY = [
      { eb: "01 · Trend recognition",
        body: "Every candle is scored for directional tendency. The system reads the trend and waits — no score, on its own, is a trade.",
        badge: "Reading the trend", sub: "Directional score, candle by candle", cls: "is-flat", lab: "XAU/USD · reading the trend" },
      { eb: "02 · Trigger signal",
        body: "A bullish trigger bar fires in line with the trend. Entry, stop-loss and take-profit are fixed now — before the position exists.",
        badge: "Trigger — aligned with the trend", sub: `Entry ${E} · SL ${S} · TP ${T}`, cls: "is-long", lab: "XAU/USD · the trigger" },
      { eb: "03 · Money management",
        body: "Only now is size calculated: the risk budget divided by the distance to the stop. Then the order is placed and managed to target or stop.",
        badge: "Sizing the position", sub: `${MM.size} · risk ${MM.rr}`, cls: "is-long", lab: "XAU/USD · position live" }
    ];

    let sizeShown = false;
    function showSize() {
      if (sizeShown) { mmSize.textContent = MM.size; return; }
      sizeShown = true;
      if (REDUCE) { mmSize.textContent = MM.size; return; }
      const target = parseFloat(MM.size) || 0.29, t0 = performance.now();
      (function tick(now) {
        const k = Math.min((now - t0) / 550, 1);
        mmSize.textContent = (easeOut(k) * target).toFixed(2) + " lots";
        if (k < 1) requestAnimationFrame(tick); else mmSize.textContent = MM.size;
      })(t0);
    }

    function drawCandles(revealed) {
      const full = Math.min(Math.floor(revealed), N - 1);
      let out = "";
      for (let k = 0; k <= full; k++) {
        const g = clamp(revealed - k, 0, 1), e = easeOut(g);
        const o = BARS[k][0], mid = (BARS[k][0] + BARS[k][3]) / 2;
        const c = lerp(o, BARS[k][3], e), h = lerp(mid, BARS[k][1], e), l = lerp(mid, BARS[k][2], e);
        const up = c >= o, cls = (up ? "u" : "d") + (k === TRIG ? " tg" : "");
        const x = xAt(k), yT = yP(Math.max(o, c)), yB = yP(Math.min(o, c));
        const w = k === TRIG ? bw + 2 : bw;
        out += `<line class="wk ${up ? "u" : "d"}" x1="${x.toFixed(1)}" y1="${yP(h).toFixed(1)}" x2="${x.toFixed(1)}" y2="${yP(l).toFixed(1)}"/>`;
        out += `<rect class="bd ${cls}" x="${(x - w / 2).toFixed(1)}" y="${yT.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(1, yB - yT).toFixed(1)}" rx="1"/>`;
      }
      gCand.innerHTML = out;
    }

    function drawScores(revealed) {
      const full = Math.min(Math.floor(revealed), N - 1);
      let out = "";
      for (let k = 0; k <= full; k++) {
        const g = clamp(revealed - k, 0, 1), s = BARS[k][4];
        const r = 1.8 + Math.abs(s - 0.5) * 2 * 2.2;
        out += `<circle cx="${xAt(k).toFixed(1)}" cy="${yScore(s).toFixed(1)}" r="${r.toFixed(1)}" fill="${sCol(s)}" opacity="${(0.3 + 0.7 * g).toFixed(2)}"/>`;
        if (k === full && g > 0.4) out += `<text x="${xAt(k).toFixed(1)}" y="${(yScore(s) - 7).toFixed(1)}" text-anchor="middle">${s.toFixed(2)}</text>`;
      }
      gScore.innerHTML = out;
    }

    function drawLevels(p) {
      const eR = clamp((p - 1.05) / 0.22, 0, 1);
      const sR = clamp((p - 1.30) / 0.30, 0, 1);
      const tR = clamp((p - 1.55) / 0.30, 0, 1);
      const x0 = xAt(TRIG), yE = yP(E), yS = yP(S), yT = yP(T);
      let z = "", ln = "";
      if (sR > 0) z += `<rect class="zone-risk" x="${x0.toFixed(1)}" y="${Math.min(yE, yS).toFixed(1)}" width="${(lerp(x0, PX1, sR) - x0).toFixed(1)}" height="${Math.abs(yS - yE).toFixed(1)}"/>`;
      if (tR > 0) z += `<rect class="zone-reward" x="${x0.toFixed(1)}" y="${Math.min(yE, yT).toFixed(1)}" width="${(lerp(x0, PX1, tR) - x0).toFixed(1)}" height="${Math.abs(yT - yE).toFixed(1)}"/>`;
      if (eR > 0) { ln += `<line class="lv-entry" x1="${x0.toFixed(1)}" y1="${yE.toFixed(1)}" x2="${lerp(x0, PX1, eR).toFixed(1)}" y2="${yE.toFixed(1)}"/><text x="${(x0 - 5).toFixed(1)}" y="${(yE - 3).toFixed(1)}">ENTRY ${E}</text>`; }
      if (sR > 0) { ln += `<line class="lv-sl" x1="${x0.toFixed(1)}" y1="${yS.toFixed(1)}" x2="${lerp(x0, PX1, sR).toFixed(1)}" y2="${yS.toFixed(1)}"/><text x="${(x0 - 5).toFixed(1)}" y="${(yS + 10).toFixed(1)}">SL ${S}</text>`; }
      if (tR > 0) { ln += `<line class="lv-tp" x1="${x0.toFixed(1)}" y1="${yT.toFixed(1)}" x2="${lerp(x0, PX1, tR).toFixed(1)}" y2="${yT.toFixed(1)}"/><text x="${(x0 - 5).toFixed(1)}" y="${(yT - 3).toFixed(1)}">TP ${T}</text>`; }
      gZone.innerHTML = z; gLvl.innerHTML = ln;
    }

    function drawTrigger(p) {
      const r = clamp((p - 1.0) / 0.2, 0, 1);
      if (r <= 0) { gTrig.innerHTML = ""; return; }
      const cx = xAt(TRIG), cy = yP((BARS[TRIG][0] + BARS[TRIG][3]) / 2);
      const rad = 15 * (1 + (1 - easeOut(r)) * 0.9);
      gTrig.innerHTML =
        `<circle class="tg-ring" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad.toFixed(1)}" opacity="${r.toFixed(2)}"/>` +
        `<text x="${cx.toFixed(1)}" y="${(cy - rad - 5).toFixed(1)}" text-anchor="middle" opacity="${r.toFixed(2)}">TRIGGER · LONG</text>`;
    }

    function render(p) {
      p = clamp(p, 0, 3);
      const act = Math.min(Math.floor(p), 2);

      let revealed;
      if (p < 1) revealed = lerp(3, TRIG, easeInOut(p));
      else if (p < 2) revealed = TRIG + 1;
      else revealed = lerp(TRIG + 1, N, easeInOut(clamp((p - 2.35) / 0.6, 0, 1)));

      drawCandles(revealed);
      drawScores(revealed);
      drawLevels(p);
      drawTrigger(p);

      const c = COPY[act];
      let badge = c.badge;
      if (act === 2 && p > 2.55) badge = "Position opened — managing to target / stop";
      ebEl.textContent = c.eb;
      bodyEl.textContent = c.body;
      stEl.textContent = badge;
      stEl.className = "journey__badge " + c.cls;
      subEl.textContent = c.sub;
      labEl.textContent = c.lab;
      steps.forEach((el, i) => el.toggleAttribute("data-on", i <= act));

      /* side panel swaps in step with the act */
      panels.forEach((el, i) => { if (el.hidden !== (i !== act)) el.hidden = i !== act; });

      if (act === 0) {
        const k = Math.min(Math.round(revealed), N - 1), s = SCORES[k];
        jtScore.textContent = s.toFixed(2);
        jtState.textContent = s > 0.66 ? "strong long conviction" : s > 0.55 ? "long-leaning" : s < 0.34 ? "strong short conviction" : s < 0.45 ? "short-leaning" : "balanced";
      } else if (act === 1) {
        const stage = Math.floor(clamp(p - 1, 0, 1) * 5.999);
        pipeSteps.forEach((el, i) => { el.dataset.state = i < stage ? "done" : i === stage ? "active" : ""; });
      } else {
        if (p >= 2.15) showSize();
      }
    }

    const SCROLL = !REDUCE && matchMedia("(min-width: 1000px)").matches;
    if (SCROLL) {
      jSection.classList.add("is-scroll");
      let ticking = false;
      const upd = () => {
        ticking = false;
        const r = jSection.getBoundingClientRect();
        const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 68;
        const travel = jSection.offsetHeight - inner.offsetHeight;
        const prog = travel > 0 ? clamp((navH - r.top) / travel, 0, 1) : 0;
        render(prog * 3);
      };
      addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
      addEventListener("resize", upd);
      upd();
    } else if (!REDUCE) {
      render(0);
      onceInView(svg, () => {
        const dur = 4600, t0 = performance.now();
        (function play(now) {
          const k = Math.min((now - t0) / dur, 1);
          render(easeInOut(k) * 3);
          if (k < 1) requestAnimationFrame(play); else render(3);
        })(t0);
      }, 0.3);
    } else {
      render(3);
    }
  }

  /* ---- performance metric tiles: count up ---- */
  $$(".metric__val[data-count]").forEach((el) => {
    const raw = el.dataset.count;
    const to = parseFloat(raw);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const prefix = el.dataset.prefix || (to < 0 ? "−" : "");
    const suffix = el.dataset.suffix || "";
    const absTo = Math.abs(to);
    onceInView(el, () => {
      if (REDUCE) return;
      const t0 = performance.now();
      (function tick(now) {
        const k = Math.min((now - t0) / 1000, 1);
        el.textContent = prefix + fmt(absTo * easeOut(k), decimals) + suffix;
        if (k < 1) requestAnimationFrame(tick);
        else el.textContent = prefix + fmt(absTo, decimals) + suffix;
      })(t0);
    }, 0.5);
  });

  /* ---- equity curve: draw left to right ---- */
  const line = $("#equity-line");
  if (line) {
    const len = line.getTotalLength ? line.getTotalLength() : 1400;
    if (!REDUCE) {
      line.style.strokeDasharray = String(len);
      line.style.strokeDashoffset = String(len);
      line.style.transition = "stroke-dashoffset 1.6s ease";
      onceInView($("#equity-svg"), () => {
        requestAnimationFrame(() => { line.style.strokeDashoffset = "0"; });
      }, 0.3);
    }
  }

  /* ---- fundamental flow arrows: one pulse ---- */
  const rmFlow = $(".rm-flow");
  if (rmFlow && !REDUCE) {
    onceInView(rmFlow, () => {
      $$(".rm-arrow", rmFlow).forEach((a, i) => {
        setTimeout(() => a.classList.add("pulse-once"), i * 180);
      });
    }, 0.4);
  }

  /* =====================================================================
     MEETING DIALOG  — email -> existing server endpoint (data.js)
     ===================================================================== */
  const modal = $("#meeting-modal");
  const wrap = $("#meeting-form-wrap");
  const form = $("#meeting-form");
  const email = $("#meeting-email");
  const submit = $("#meeting-submit");
  const msg = $("#meeting-msg");
  const done = $("#meeting-done");
  const FOCUSABLE = 'button,[href],input,[tabindex]:not([tabindex="-1"])';
  let opener = null, sending = false;

  function openModal(btn) {
    opener = btn || null;
    modal.hidden = false;
    requestAnimationFrame(() => modal.setAttribute("data-open", ""));
    setTimeout(() => email.focus(), 60);
    addEventListener("keydown", trap, true);
  }
  function closeModal() {
    modal.removeAttribute("data-open");
    removeEventListener("keydown", trap, true);
    setTimeout(() => {
      modal.hidden = true;
      wrap.hidden = false; done.hidden = true;
      form.reset(); msg.textContent = "";
      email.removeAttribute("aria-invalid");
      submit.disabled = false; submit.textContent = "Send";
      if (opener) opener.focus();
    }, 240);
  }
  function trap(e) {
    if (e.key === "Escape") { e.preventDefault(); closeModal(); return; }
    if (e.key !== "Tab") return;
    const items = $$(FOCUSABLE, modal).filter((el) => el.offsetParent !== null && !el.disabled);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  $$("[data-meeting]").forEach((b) => b.addEventListener("click", () => {
    if (!menu.hidden) closeMenu();
    openModal(b);
  }));
  $$("[data-close]", modal).forEach((b) => b.addEventListener("click", closeModal));

  const MESSAGES = {
    invalid_email: "That address doesn't look right.",
    rate_limited: "Too many attempts. Please try again in a few minutes.",
    too_large: "That address is too long.",
    bad_request: "Something went wrong. Please try again."
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;
    const value = email.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(value)) {
      email.setAttribute("aria-invalid", "true");
      msg.textContent = MESSAGES.invalid_email;
      email.focus();
      return;
    }
    email.removeAttribute("aria-invalid");
    msg.textContent = "";
    sending = true; submit.disabled = true; submit.textContent = "Sending…";

    try {
      const endpoint = (window.BZP && window.BZP.meetingEndpoint) || "/api/waitlist";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) { wrap.hidden = true; done.hidden = false; return; }
      msg.textContent = MESSAGES[data.error] || MESSAGES.bad_request;
    } catch {
      msg.textContent = "Couldn't reach the server. Please try again.";
    } finally {
      sending = false; submit.disabled = false; submit.textContent = "Send";
    }
  });

  /* =====================================================================
     HERO CANDLESTICK BACKDROP  (decorative, deterministic, illustrative)
     ===================================================================== */
  const svg = $("#hero-candles");
  if (svg && !REDUCE) {
    let s = 7; const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const W = 900, H = 460, m = 46, step = W / (m + 2), bw = step * 0.44;
    let price = 100, lo = 100, hi = 100;
    const raw = [];
    for (let i = 0; i < m; i++) {
      const o = price;
      price += (rnd() - 0.42) * 6.2;
      const c = price;
      const h = Math.max(o, c) + rnd() * 3, l = Math.min(o, c) - rnd() * 3;
      raw.push([o, c, h, l]); lo = Math.min(lo, l); hi = Math.max(hi, h);
    }
    const Y = (v) => 30 + (hi - v) * (H - 60) / (hi - lo);
    let out = "";
    raw.forEach(([o, c, h, l], i) => {
      const x = step * (i + 1), up = c >= o, cls = up ? "u" : "d";
      const yt = Y(Math.max(o, c)), yb = Y(Math.min(o, c));
      out += `<rect class="wk ${cls}" x="${(x - 0.7).toFixed(1)}" y="${Y(h).toFixed(1)}" width="1.4" height="${(Y(l) - Y(h)).toFixed(1)}"/>`;
      out += `<rect class="cd ${cls}" x="${(x - bw / 2).toFixed(1)}" y="${yt.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(2, yb - yt).toFixed(1)}" rx="1"/>`;
    });
    svg.innerHTML = out;
  }
})();
